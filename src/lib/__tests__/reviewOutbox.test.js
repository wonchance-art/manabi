import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  shouldApplyGrade, outboxEventRow, dedupeEntries, pickOutboxDrops, flushReviews, MAX_OUTBOX,
} from '../reviewOutbox';

/**
 * 계약: v2-N R2 — 오프라인 복습 + 동기화 큐 (오너 "N ㄱㄱ").
 *
 * 착수 실측이 범위를 좁혔다. R1 뒤로 오프라인에서 **이미 되던 것**: 단어장 조회
 * (스냅샷 폴백)·복습 세션 시작(rung 조회 실패 폴백). 깨지던 건 **쓰기 하나**다.
 * 그래서 이 라운드가 지키는 것도 "큐가 있다"가 아니라 **잃지 않는다 + 왜곡하지
 * 않는다** 둘이다.
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const T = (iso) => new Date(iso).toISOString();
const entry = (over = {}) => ({
  seq: 1, userId: 'u1', source: 'vocab', itemKey: '単語', lang: 'Japanese',
  correct: true, reviewedAt: T('2026-08-31T02:00:00Z'),
  detail: { word_id: 'w1', rating: 3 }, nextStats: { interval: 3 },
  ...over,
});

describe('N R2 — 복습 시각을 잃지 않는다', () => {
  it('이벤트 행에 created_at이 실린다 — 이게 없으면 비행기 복습이 착륙 시각으로 찍힌다', () => {
    // 실측: logReviewEvents는 created_at을 안 보내고 서버 DEFAULT now()에 기댄다.
    // 그대로 재시도하면 14일 창(헷갈린 말·유형 큐·약점)·주 경계·연속일이 전부 밀린다.
    const row = outboxEventRow(entry(), 'u1');
    expect(row.created_at).toBe(T('2026-08-31T02:00:00Z'));
    expect(row).toMatchObject({
      user_id: 'u1', lang: 'Japanese', source: 'vocab', item_key: '単語', correct: true,
    });
  });

  it('detail을 그대로 옮긴다 — 큐는 재해석이 아니라 충실한 재생이다', () => {
    // A R2가 심은 resp·qtype이 여기서 떨어지면 오프라인 복습만 약점 진단에서 빠진다.
    const d = { word_id: 'w1', rating: 1, qtype: 'typing', resp: 'まちがい' };
    expect(outboxEventRow(entry({ detail: d }), 'u1').detail).toEqual(d);
  });
});

describe('N R2 — 최신 상태를 덮어쓰지 않는다', () => {
  it('서버가 더 최신이면 적용하지 않는다 — 재생이 남의 복습을 되돌리면 안 된다', () => {
    const e = entry({ reviewedAt: T('2026-08-31T02:00:00Z') });
    expect(shouldApplyGrade(e, { last_reviewed_at: T('2026-08-31T05:00:00Z') })).toBe(false);
    expect(shouldApplyGrade(e, { last_reviewed_at: T('2026-08-31T01:00:00Z') })).toBe(true);
  });

  it('한 번도 채점된 적 없는 단어에는 적용한다', () => {
    expect(shouldApplyGrade(entry(), null)).toBe(true);
    expect(shouldApplyGrade(entry(), { last_reviewed_at: null })).toBe(true);
  });

  it('시각이 망가진 항목은 적용하지 않는다 — 판단 못 하면 건드리지 않는다', () => {
    expect(shouldApplyGrade(entry({ reviewedAt: 'not-a-date' }), null)).toBe(false);
  });
});

describe('N R2 — 중복을 만들지 않는다', () => {
  it('완전 일치(출처·항목·시각)만 걸러낸다', () => {
    // 유니크 제약이 없다(스키마 변경은 하드리밋). 그래서 flush가 직접 거른다.
    const a = entry({ seq: 1, reviewedAt: T('2026-08-31T02:00:00Z') });
    const b = entry({ seq: 2, reviewedAt: T('2026-08-31T03:00:00Z') });
    const kept = dedupeEntries([a, b], [
      { source: 'vocab', item_key: '単語', created_at: T('2026-08-31T02:00:00Z') },
    ]);
    expect(kept.map((e) => e.seq), '같은 단어라도 다른 시각이면 다른 복습이다').toEqual([2]);
  });

  it('기존 이벤트가 없으면 전부 보낸다', () => {
    expect(dedupeEntries([entry()], [])).toHaveLength(1);
    expect(dedupeEntries([entry()], null)).toHaveLength(1);
  });
});

describe('N R2 — 오래됐다고 버리지 않는다 (R1 캐시와 다른 점)', () => {
  it('TTL이 없다 — 큐가 담은 건 파생 사본이 아니라 원본 이력이다', () => {
    // R1 offlineCache는 파생 사본이라 7일 TTL이 맞다. 여기서 같은 걸 하면 그 복습이
    // 세상에서 사라진다. 소스에 TTL이 되살아나면 이 계약이 잡는다.
    const old = entry({ seq: 1, reviewedAt: T('2025-01-01T00:00:00Z') });
    expect(pickOutboxDrops([old], { max: MAX_OUTBOX })).toEqual([]);
    expect(read('src/lib/reviewOutbox.js'), '큐에 TTL을 들이지 않는다').not.toMatch(/TTL_MS|ttl\s*[=:]/);
  });

  it('개수 상한만 있다 — 넘치면 오래된 것부터', () => {
    const base = Date.parse('2026-08-20T00:00:00Z');
    const many = Array.from({ length: 5 }, (_, i) =>
      entry({ seq: i + 1, reviewedAt: new Date(base + i * 86400000).toISOString() }));
    // max=3이면 5개 중 오래된 2개(seq 1·2)를 버린다. 픽스처가 상한을 실제로 넘겨야
    // 이 검사가 성립한다(A 축에서 공허한 하한 검사에 두 번 물렸다).
    expect(many).toHaveLength(5);
    expect(pickOutboxDrops(many, { max: 3 })).toEqual([1, 2]);
  });
});

/* ── flush 실동작 ── */

function fakeClient({ existing = [], insertError = null, words = [] } = {}) {
  const calls = { inserted: null };
  return {
    calls,
    from(table) {
      if (table === 'review_events') {
        return {
          select: () => ({ eq: () => ({ gte: () => ({ lte: () => Promise.resolve({ data: existing }) }) }) }),
          insert: (rows) => { calls.inserted = rows; return Promise.resolve({ error: insertError }); },
        };
      }
      return { select: () => ({ eq: () => ({ in: () => Promise.resolve({ data: words }) }) }) };
    },
  };
}

describe('N R2 — flush', () => {
  // load·remove를 주입한다 — IndexedDB가 없는 환경에서 pendingReviews가 빈 배열을
  // 돌려주면 아래 계약들이 전부 공허하게 통과한다(A 축에서 실제로 물렸던 함정).
  const deps = (entries, extra = {}) => ({
    load: vi.fn(async () => entries),
    remove: vi.fn(async () => {}),
    ...extra,
  });

  it('이벤트 적재가 실패하면 큐를 지우지 않는다 — 잃지 않는 것이 첫 요구다', async () => {
    const d = deps([entry({ seq: 7 })], { persist: vi.fn() });
    const r = await flushReviews(fakeClient({ insertError: new Error('offline') }), 'u1', d);
    expect(d.load, '픽스처가 실제로 항목을 실어야 이 검사가 성립한다').toHaveBeenCalled();
    expect(r).toEqual({ sent: 0, kept: 1, applied: 0 });
    expect(d.remove, '실패한 복습을 지우면 그대로 유실이다').not.toHaveBeenCalled();
    expect(d.persist, '이벤트가 안 실렸으면 FSRS도 건드리지 않는다').not.toHaveBeenCalled();
  });

  it('성공하면 created_at을 실어 보내고 큐를 비운다', async () => {
    const d = deps([entry({ seq: 7 })], { persist: vi.fn() });
    const client = fakeClient({ words: [{ id: 'w1', last_reviewed_at: null }] });
    const r = await flushReviews(client, 'u1', d);
    expect(client.calls.inserted).toHaveLength(1);
    expect(client.calls.inserted[0].created_at).toBe(T('2026-08-31T02:00:00Z'));
    expect(r.sent).toBe(1);
    expect(d.remove).toHaveBeenCalledWith([7]);
  });

  it('서버가 더 최신이면 이벤트는 남기고 FSRS만 건너뛴다 — 기록과 상태는 층이 다르다', async () => {
    const d = deps([entry({ seq: 7 })], { persist: vi.fn() });
    const client = fakeClient({ words: [{ id: 'w1', last_reviewed_at: T('2026-08-31T09:00:00Z') }] });
    const r = await flushReviews(client, 'u1', d);
    expect(client.calls.inserted, '이벤트는 append-only라 언제나 실린다').toHaveLength(1);
    expect(d.persist, '옛 상태로 최신을 덮으면 안 된다').not.toHaveBeenCalled();
    expect(r).toMatchObject({ sent: 1, applied: 0 });
  });

  it('이미 착지한 이벤트는 다시 보내지 않는다 — 중복은 정답률을 부풀린다', async () => {
    const d = deps([entry({ seq: 7 })], { persist: vi.fn() });
    const client = fakeClient({
      existing: [{ source: 'vocab', item_key: '単語', created_at: T('2026-08-31T02:00:00Z') }],
      words: [{ id: 'w1', last_reviewed_at: null }],
    });
    const r = await flushReviews(client, 'u1', d);
    expect(client.calls.inserted, '중복이면 insert 자체를 하지 않는다').toBeNull();
    expect(r.sent, '그래도 큐에서는 비운다 — 이미 서버에 있으니 할 일이 끝났다').toBe(1);
    expect(d.remove).toHaveBeenCalledWith([7]);
  });

  it('로그인·클라이언트가 없으면 아무 일도 하지 않는다', async () => {
    expect(await flushReviews(null, 'u1')).toEqual({ sent: 0, kept: 0, applied: 0 });
    expect(await flushReviews(fakeClient(), null)).toEqual({ sent: 0, kept: 0, applied: 0 });
  });
});

describe('N R2 — 배선', () => {
  it('DB를 새로 열지 않고 R1의 것을 확장한다 — 두 DB는 버전이 갈려 서로를 막는다', () => {
    const cache = read('src/lib/offlineCache.js');
    expect(cache).toContain('const DB_VERSION = 2;');
    expect(cache).toContain("export const STORE_OUTBOX = 'outbox';");
    expect(cache).toContain("db.createObjectStore(STORE_OUTBOX, { keyPath: 'seq', autoIncrement: true })");
    expect(read('src/lib/reviewOutbox.js'), '큐는 R1의 openDb를 쓴다')
      .toContain("import { openDb, STORE_OUTBOX } from './offlineCache'");
    expect(read('src/lib/reviewOutbox.js'), '두 번째 IndexedDB를 열면 안 된다')
      .not.toContain('indexedDB.open');
  });

  it('supabase를 직접 붙들지 않는다 — 주입식이라야 순수 검증이 선다', () => {
    expect(read('src/lib/reviewOutbox.js')).not.toMatch(/from '\.\/supabase'/);
  });

  it('이벤트 정본은 created_at을 주면 존중한다 — 가산 변경(기존 14개 호출처 무영향)', () => {
    const src = read('src/lib/reviewEvents.js');
    expect(src).toContain('...(e.created_at ? { created_at: e.created_at } : {})');
    // 무조건 찍으면 기존 호출처의 시각 출처가 서버→기기로 통째로 바뀐다.
    expect(src, 'created_at을 무조건 싣지 않는다')
      .not.toMatch(/created_at:\s*new Date\(\)\.toISOString\(\)/);
  });

  it('오프라인이면 네트워크를 건드리지 않고 큐로 — 부분 성공이 생길 여지를 없앤다', () => {
    const store = read('src/lib/learn/progressStore.js');
    expect(store).toContain("navigator.onLine === false");
    // 오프라인 분기가 원격 호출 **앞**에 있어야 반쪽 쓰기가 안 생긴다.
    const offlineAt = store.indexOf('navigator.onLine === false');
    const remoteAt = store.indexOf('await recordReviewEventRemote');
    expect(offlineAt).toBeGreaterThan(0);
    expect(offlineAt, '오프라인 분기가 원격 호출보다 먼저여야 한다').toBeLessThan(remoteAt);
  });

  it('큐에 못 담았으면 성공이라 말하지 않는다 — 사생활 모드는 진짜 유실이다', () => {
    // 자체 검수에서 잡은 결함: 오프라인 분기가 enqueue 결과를 안 보고 무조건
    // {ok:true}를 돌려주면, IndexedDB를 못 쓰는 환경에서 유실이 무증상이 된다.
    expect(read('src/lib/learn/progressStore.js'))
      .toContain("return queued ? { ok: true, queued: true } : { ok: false, error: new Error('offline-queue-unavailable') };");
  });

  it('온라인 경로도 같은 복습 시각을 싣는다 — 중복 제거가 성립하는 근거다', () => {
    // 큐는 reviewedAt, 온라인은 서버 now()였다면 완전 일치 대조가 영영 안 맞는다.
    const store = read('src/lib/learn/progressStore.js');
    expect(store).toContain('const reviewedAt = new Date().toISOString();');
    expect(store).toContain('detail, created_at: reviewedAt }');
  });

  it('실패해도 큐에 담기면 사용자에게 실패라 하지 않는다 — 거짓말을 안 한다', () => {
    const store = read('src/lib/learn/progressStore.js');
    expect(store).toContain('if (queued) return { ok: true, queued: true };');
    // 큐마저 못 쓰는 환경에서만 ok:false — 그때는 진짜 유실이라 알려야 한다.
    expect(store).toContain('return { ok: false, error: err };');
  });

  it('동기화는 앱 진입과 온라인 복귀 두 시점 — 폴링하지 않는다', () => {
    const layout = read('src/components/Layout.jsx');
    expect(layout).toContain("window.addEventListener('online', sync)");
    expect(layout).toContain('flushReviews(supabase, user.id, { persist: persistVocabGrade })');
    expect(layout, '동기화에 타이머를 걸지 않는다').not.toMatch(/setInterval\([^)]*sync/);
  });

  it("'안 A' — 채점마다 토스트를 띄우지 않고, 저장된 뒤 한 번만 말한다", () => {
    const layout = read('src/components/Layout.jsx');
    expect(layout).toContain('복습 ${r.sent}개를 저장했어요.');
    expect(layout, '보낼 게 없으면 조용하다').toContain('if (!alive || r.sent === 0) return;');
    // 큐에 담는 지점(progressStore)은 화면에 말을 걸지 않는다 — toast를 모른다.
    expect(read('src/lib/learn/progressStore.js'), '큐 적재는 조용하다').not.toContain('toast');
  });

  it('대기 수는 신호로 갱신한다 — 폴링 금지', () => {
    const page = read('src/views/VocabPage.jsx');
    expect(page).toContain('<PendingReviewsNotice count={pendingReviewCount} />');
    expect(page).toContain("window.addEventListener('manabi:outbox-flushed', recount)");
    expect(page, '대기 수를 타이머로 세지 않는다').not.toMatch(/setInterval\([^)]*recount/);
  });
});
