import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween.js';

// grammar_review UPDATE 체인을 받아 적는 스텁 — 실제 조건(.eq · .is)과 값, 바뀐 행 수(select)가 무엇이었는지 본다.
const writes = [];
let writeError = null;
let changedRows = [{ slug: 'n5-wa' }]; // 비교 후 쓰기가 바꾼 행(select가 돌려줌) — []이면 0행
vi.mock('../supabase.js', () => ({
  supabase: {
    from: (table) => {
      const call = { table, filters: [] };
      const chain = {
        update: (values) => { call.values = values; writes.push(call); return chain; },
        eq: (col, val) => { call.filters.push(['eq', col, val]); return chain; },
        is: (col, val) => { call.filters.push(['is', col, val]); return chain; },
        or: (expr) => { call.filters.push(['or', expr]); return chain; },
        select: (cols) => {
          call.select = cols;
          return { then: (ok, bad) => Promise.resolve({ data: writeError ? null : changedRows, error: writeError }).then(ok, bad) };
        },
        then: (ok, bad) => Promise.resolve({ error: writeError }).then(ok, bad),
      };
      return chain;
    },
  },
}));
const { createGrammarRetry, GRAMMAR_RETRY_LIMIT, gradeGrammarReview, grammarCasPredicate, sendGrammarGradeKeepalive } = await import('../grammarSrs.js');

// 계약: /study 문법 재스케줄 보류함 — 저장 실패(오프라인 등)를 버리지 않고 남겼다가 같은 정본 함수로 다시 보낸다.
// review_events는 오프라인 큐로 올라가는데 grammar_review 일정만 조용히 사라지던 틈(StudySessionPage가 결과를 버림).

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const row = (slug, extra = {}) => ({ user_id: 'u1', lang: 'Japanese', slug, interval: 1, ...extra });

describe('createGrammarRetry', () => {
  it('실패 → 보류 → online 재시도 성공 → 보류 비움', async () => {
    let online = false;
    const grade = vi.fn(async (r, rating) => (online ? { ...r, rating } : null));
    const box = createGrammarRetry({ grade });
    expect(await box.submit(row('n5-wa'), 3)).toBeNull();
    expect(box.size()).toBe(1);
    online = true;
    await box.retry();
    expect(box.size()).toBe(0);
    expect(grade).toHaveBeenCalledTimes(2);
    // 같은 행 · 같은 채점 · 첫 제출 때 고정한 채점 시각으로 다시
    expect(grade.mock.calls[1]).toEqual([row('n5-wa'), 3, { reviewedAt: grade.mock.calls[0][2].reviewedAt, compareAndSet: true }]);
    expect(grade.mock.calls[0][2].compareAndSet).toBe(true); // 첫 제출도 비교 후 쓰기
    expect(Date.parse(grade.mock.calls[0][2].reviewedAt)).not.toBeNaN();
  });

  it('성공하면 보류하지 않는다', async () => {
    const box = createGrammarRetry({ grade: async (r) => r });
    expect(await box.submit(row('n5-wa'), 4)).toBe(true);
    expect(box.size()).toBe(0);
  });

  it('같은 챕터가 다시 들어오면 마지막 채점만 남는다', async () => {
    const grade = vi.fn(async () => null);
    const box = createGrammarRetry({ grade });
    await box.submit(row('n5-wa', { interval: 1 }), 2);
    await box.submit(row('n5-wa', { interval: 1 }), 4);
    await box.submit(row('n5-ga'), 1);
    expect(box.size()).toBe(2);
    grade.mockClear();
    await box.retry();
    expect(grade.mock.calls.map(([r, rating]) => [r.slug, rating]).sort()).toEqual([['n5-ga', 1], ['n5-wa', 4]]);
  });

  it(`재시도는 ${GRAMMAR_RETRY_LIMIT}번까지 — 넘으면 버리고 알린다`, async () => {
    const grade = vi.fn(async () => null);
    const onGiveUp = vi.fn();
    const box = createGrammarRetry({ grade, onGiveUp });
    await box.submit(row('n5-wa'), 3);
    for (let i = 0; i < GRAMMAR_RETRY_LIMIT + 2; i++) await box.retry();
    expect(grade).toHaveBeenCalledTimes(1 + GRAMMAR_RETRY_LIMIT);
    expect(box.size()).toBe(0);
    expect(onGiveUp).toHaveBeenCalledOnce();
  });

  it('던지는 저장도 실패로 보류하고, 겹친 재시도는 한 번만 보낸다', async () => {
    let calls = 0;
    const grade = vi.fn(async () => { calls += 1; if (calls === 1) throw new Error('offline'); await new Promise((r) => setTimeout(r, 5)); return {}; });
    const box = createGrammarRetry({ grade });
    await box.submit(row('n5-wa'), 3);
    expect(box.size()).toBe(1);
    const a = box.retry(), b = box.retry();
    expect(b).toBe(a);
    await a;
    expect(grade).toHaveBeenCalledTimes(2);
    expect(box.size()).toBe(0);
  });

  it('accept로 다른 계정의 보류분은 보내지 않는다', async () => {
    const grade = vi.fn(async () => null);
    const box = createGrammarRetry({ grade });
    await box.submit(row('n5-wa'), 3);
    grade.mockClear();
    await box.retry((r) => r.user_id === 'u2');
    expect(grade).not.toHaveBeenCalled();
    expect(box.size()).toBe(1);
  });

  it('재시도 도중 같은 챕터 새 채점이 들어오면 새 채점이 남는다', async () => {
    let release;
    const grade = vi.fn()
      .mockResolvedValueOnce(null) // 첫 제출 실패
      .mockImplementationOnce(() => new Promise((r) => { release = r; })) // 재시도 진행 중
      .mockResolvedValueOnce(null); // 새 채점도 실패
    const box = createGrammarRetry({ grade });
    await box.submit(row('n5-wa'), 2);
    const retrying = box.retry();
    await box.submit(row('n5-wa'), 4);
    release({});
    await retrying;
    expect(box.size()).toBe(1); // 옛 재시도 성공이 새 채점을 지우지 않는다
  });
});

describe('오프라인 · 닫힘 · 중복 반영', () => {
  it('오프라인이면 재시도가 횟수를 쓰지 않는다 — 연결이 돌아오면 그대로 보낸다', async () => {
    let online = false;
    const grade = vi.fn(async (r) => (online ? r : null));
    const onGiveUp = vi.fn();
    const box = createGrammarRetry({ grade, onGiveUp, isOnline: () => online });
    await box.submit(row('n5-wa'), 3);
    for (let i = 0; i < GRAMMAR_RETRY_LIMIT + 3; i++) await box.retry();
    expect(grade).toHaveBeenCalledTimes(1); // 첫 제출만 — 오프라인 재시도는 보내지도 세지도 않는다
    expect(onGiveUp).not.toHaveBeenCalled();
    expect(box.size()).toBe(1);
    online = true;
    await box.retry();
    expect(box.size()).toBe(0);
  });

  it('채점 시각은 첫 제출 때 고정되고, 같은 챕터 새 채점은 새 시각을 갖는다', async () => {
    let t = Date.parse('2026-10-16T10:00:00.000Z');
    const grade = vi.fn(async () => null);
    const box = createGrammarRetry({ grade, now: () => new Date(t) });
    await box.submit(row('n5-wa'), 2);
    t += 60_000;
    await box.retry();
    expect(grade.mock.calls.map(c => c[2].reviewedAt)).toEqual(['2026-10-16T10:00:00.000Z', '2026-10-16T10:00:00.000Z']);
    await box.submit(row('n5-wa'), 4);
    expect(grade.mock.calls[2][2].reviewedAt).toBe('2026-10-16T10:01:00.000Z');
  });

  it('beacon(닫힘)은 주어진 전송으로 보내고, 횟수를 쓰지도 포기하지도 않는다 · 오프라인 · 다른 계정이면 보내지 않는다', async () => {
    let online = true;
    const grade = vi.fn(async () => null);
    const onGiveUp = vi.fn();
    const box = createGrammarRetry({ grade, onGiveUp, limit: 2, isOnline: () => online });
    await box.submit(row('n5-wa'), 3);
    const send = vi.fn(async () => false);
    await box.beacon(() => true, send);
    await box.beacon(() => true, send);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]).toEqual([row('n5-wa'), 3, { reviewedAt: grade.mock.calls[0][2].reviewedAt, compareAndSet: true }]);
    expect(onGiveUp).not.toHaveBeenCalled();
    expect(box.size()).toBe(1); // 실패해도 남는다 — bfcache로 돌아오면 다음 retry가 보낸다
    online = false;
    await box.beacon(() => true, send);
    online = true;
    await box.beacon((r) => r.user_id === 'u2', send);
    expect(send).toHaveBeenCalledTimes(2);
    await box.retry(); // 상한 2 중 1번째 — beacon 두 번이 횟수를 썼다면 여기서 버려진다
    expect(onGiveUp).not.toHaveBeenCalled();
    expect(box.size()).toBe(1);
    await box.retry();
    expect(onGiveUp).toHaveBeenCalledOnce();
    await box.submit(row('n5-ga'), 2);
    await box.beacon(() => true, async () => true);
    expect(box.size()).toBe(0);
  });

  it('비교 후 쓰기 조건 — 세션 시작 행의 last_reviewed_at(없으면 is null), 칸이 아예 없으면 조건 없음(옛 프리페치 재료)', () => {
    expect(grammarCasPredicate(row('n5-wa', { last_reviewed_at: '2026-10-10T01:02:03.456+00:00' }))).toEqual({ op: 'eq', value: '2026-10-10T01:02:03.456+00:00' });
    expect(grammarCasPredicate(row('n5-wa', { last_reviewed_at: null }))).toEqual({ op: 'is', value: null });
    expect(grammarCasPredicate(row('n5-wa'))).toBeNull();
  });

  it('gradeGrammarReview(compareAndSet) — 시계를 비교하지 않고 시작 행과 같을 때만 바꾼다 · 0행은 conflict(끝난 채점)', async () => {
    const at = '2026-10-16T10:00:00.000Z', seen = '2026-10-10T01:02:03.456+00:00';
    writes.length = 0; changedRows = [{ slug: 'n5-wa' }];
    const saved = await gradeGrammarReview(row('n5-wa', { last_reviewed_at: seen }), 3, { reviewedAt: at, compareAndSet: true });
    expect(saved).toBeTruthy();
    expect(saved.conflict).toBeUndefined();
    expect(writes[0].table).toBe('grammar_review');
    expect(writes[0].values.last_reviewed_at).toBe(at);
    expect(writes[0].filters).toEqual([
      ['eq', 'user_id', 'u1'], ['eq', 'lang', 'Japanese'], ['eq', 'slug', 'n5-wa'], ['eq', 'last_reviewed_at', seen],
    ]);
    expect(writes[0].select).toBe('slug'); // 바뀐 행 수를 받아야 0행을 가른다
    expect(writes[0].filters.some(([op]) => op === 'or')).toBe(false); // 기기 시계(lt reviewedAt) 조건은 없다
    // 한 번도 채점 안 한 행은 is null
    writes.length = 0;
    await gradeGrammarReview(row('n5-wa', { last_reviewed_at: null }), 3, { reviewedAt: at, compareAndSet: true });
    expect(writes[0].filters.at(-1)).toEqual(['is', 'last_reviewed_at', null]);
    // 0행 — 이미 반영됐거나 그사이 다른 곳에서 채점했다: 실패(null)가 아니라 conflict
    changedRows = [];
    const conflict = await gradeGrammarReview(row('n5-wa', { last_reviewed_at: seen }), 3, { reviewedAt: at, compareAndSet: true });
    expect(conflict).toMatchObject({ slug: 'n5-wa', conflict: true });
    changedRows = [{ slug: 'n5-wa' }];
    // 기존 호출(GrammarReviewSession — 시각 · 조건 없이)은 그대로
    writes.length = 0;
    await gradeGrammarReview(row('n5-wa', { last_reviewed_at: seen }), 3);
    expect(writes[0].filters).toHaveLength(3);
    expect(writes[0].select).toBeUndefined();
    writeError = { message: 'offline' };
    expect(await gradeGrammarReview(row('n5-wa', { last_reviewed_at: seen }), 3, { reviewedAt: at, compareAndSet: true })).toBeNull();
    writeError = null;
  });

  it('0행(conflict)은 보류함에서 빠지고, 실패로 세지도 · 다시 보내지도 · 포기 알림도 하지 않는다', async () => {
    const grade = vi.fn(async (r) => ({ ...r, conflict: true }));
    const onGiveUp = vi.fn();
    const box = createGrammarRetry({ grade, onGiveUp, limit: 0 });
    expect(await box.submit(row('n5-wa', { last_reviewed_at: null }), 3)).toBe(true);
    expect(box.size()).toBe(0);
    await box.retry();
    expect(grade).toHaveBeenCalledTimes(1);
    expect(onGiveUp).not.toHaveBeenCalled();
  });

  it('sendGrammarGradeKeepalive — 같은 UPDATE를 keepalive PATCH로(같은 값 · 같은 비교 후 쓰기 조건 · 세션 토큰 · 바뀐 행 수)', async () => {
    const at = '2026-10-16T10:00:00.000Z', seen = '2026-10-10T01:02:03.456+00:00';
    const r = row('n5-wa', { last_reviewed_at: seen });
    writes.length = 0;
    await gradeGrammarReview(r, 3, { reviewedAt: at, compareAndSet: true }); // FSRS 모듈을 붙잡아 둔다(화면에서는 첫 제출이 한다)
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => [{ slug: 'n5-wa' }] }));
    const ok = await sendGrammarGradeKeepalive(r, 3, { reviewedAt: at, accessToken: 'tok', url: 'https://x.supabase.co', apiKey: 'anon', fetchImpl });
    expect(ok).toBeTruthy();
    expect(ok.conflict).toBeUndefined();
    const [href, init] = fetchImpl.mock.calls[0];
    const u = new URL(href);
    expect(u.origin + u.pathname).toBe('https://x.supabase.co/rest/v1/grammar_review');
    expect(Object.fromEntries(u.searchParams)).toEqual({
      user_id: 'eq.u1', lang: 'eq.Japanese', slug: 'eq.n5-wa', last_reviewed_at: `eq.${seen}`, select: 'slug',
    });
    expect(href).toContain('%2B00%3A00'); // 시각의 + 가 공백으로 읽히지 않게 인코딩된다
    expect(init).toMatchObject({ method: 'PATCH', keepalive: true });
    expect(init.headers).toMatchObject({ apikey: 'anon', Authorization: 'Bearer tok', Prefer: 'return=representation' });
    const body = JSON.parse(init.body);
    expect(body.last_reviewed_at).toBe(at);
    expect(Object.keys(body).sort()).toEqual(Object.keys(writes[0].values).sort());
    // 한 번도 채점 안 한 행은 is.null, 0행은 conflict(끝난 채점)
    const nullRow = row('n5-wa', { last_reviewed_at: null });
    const empty = vi.fn(async () => ({ ok: true, json: async () => [] }));
    expect(await sendGrammarGradeKeepalive(nullRow, 3, { reviewedAt: at, accessToken: 'tok', url: 'https://x', apiKey: 'a', fetchImpl: empty }))
      .toMatchObject({ conflict: true });
    expect(new URL(empty.mock.calls[0][0]).searchParams.get('last_reviewed_at')).toBe('is.null');
    // 토큰이 없거나 응답이 실패면 false — 보류분은 그대로 남는다
    expect(await sendGrammarGradeKeepalive(r, 3, { reviewedAt: at, url: 'https://x', apiKey: 'a', fetchImpl })).toBe(false);
    expect(await sendGrammarGradeKeepalive(r, 3, {
      reviewedAt: at, accessToken: 'tok', url: 'https://x', apiKey: 'a', fetchImpl: async () => ({ ok: false }),
    })).toBe(false);
    expect(await sendGrammarGradeKeepalive(r, 3, {
      reviewedAt: at, accessToken: 'tok', url: 'https://x', apiKey: 'a', fetchImpl: async () => { throw new TypeError('offline'); },
    })).toBe(false);
  });

  it('세션 재료의 문법 행은 last_reviewed_at을 싣는다 — 비교 후 쓰기의 기준', () => {
    const materials = read('src/lib/studyMaterials.js');
    expect(materials.match(/next_review_at: row\.next_review_at, last_reviewed_at: row\.last_reviewed_at \?\? null \}/g)).toHaveLength(2);
    const lib = read('src/lib/grammarSrs.js');
    expect(lib).not.toContain('last_reviewed_at.lt.');
    expect(sliceBetween(lib, 'export function sendGrammarGradeKeepalive(', 'export const GRAMMAR_RETRY_LIMIT')).toContain('grammarCasPredicate(row)');
    expect(sliceBetween(lib, 'export async function gradeGrammarReview(', '\n}')).toContain('grammarCasPredicate(row)');
  });
});

describe('세션 화면 배선', () => {
  const page = read('src/views/StudySessionPage.jsx');

  it('챕터 마지막 문항은 보류함으로 보낸다(결과를 버리지 않는다)', () => {
    // user_id는 세션 계정(recorder — 로그아웃 · 계정 바뀜이면 기록을 멈추고 보류한다, studySessionScreen 계약).
    const write = sliceBetween(page, 'function writeSettle(recorder,', '\n  }\n');
    expect(write).toContain('pendingGrammarRef.current.submit({ ...chapter.srs, user_id: recorder }, chapter.rating)');
    expect(write).toContain('if (!saved) rememberGrammarToken(recorder);');
    expect(page).not.toMatch(/^\s*gradeGrammarReview\(/m);
    expect(page).toContain('createGrammarRetry({ grade: gradeGrammarReview, onGiveUp: () => { grammarGiveUpsRef.current += 1; setGrammarGaveUp(true); } })');
  });

  it('online · 화면 떠남 · 세션 종료(fireEffects)에서 다시 보내고, pagehide는 keepalive로 보낸다', () => {
    const online = sliceBetween(page, "window.addEventListener('online', retryPendingGrammar);", '}, []);');
    expect(online).toContain("window.removeEventListener('online', retryPendingGrammar);");
    // 떠날 때 한 번 더 — 그 시도 뒤에도 남았거나 포기했으면 연결 여부와 무관하게 알린다(알림 영역은 화면과 함께 사라졌다)
    expect(online).toContain('Promise.resolve(retryPendingGrammar()).catch(() => {}).then(() => {');
    expect(online).toContain("if (box.size() > 0 || grammarGiveUpsRef.current > giveUpsBefore) toast(GRAMMAR_NOT_SAVED, 'warning', 6000);");
    expect(online).not.toContain('navigator.onLine');
    const hide = sliceBetween(page, 'function onPageHide() {', "window.addEventListener('pagehide', onPageHide);");
    expect(hide).toMatch(/if \(!recorder\) return;\s*batcherRef\.current\?\.flush\(\);\s*beaconPendingGrammar\(recorder\);/);
    // 로그인이 풀린 채 닫히면 보류분이 사라지는 한계는 주석으로 남긴다(문구 변경은 오너 목업 뒤 — 리뷰 N3)
    expect(hide).toContain('알려진 한계(리뷰 N3');
    const beacon = sliceBetween(page, 'function beaconPendingGrammar(owner) {', '\n  }\n');
    expect(beacon).toContain('if (held?.userId !== owner) { retryPendingGrammar(); return; }');
    expect(beacon).toContain('pendingGrammarRef.current.beacon(row => row.user_id === owner,');
    expect(beacon).toContain('sendGrammarGradeKeepalive(row, rating, { reviewedAt, accessToken: held.token })');
    const token = sliceBetween(page, 'function rememberGrammarToken(owner) {', '\n  }\n');
    expect(token).toContain('sessionTokenFor(owner).then((token) => {');
    expect(token).toContain('if (token && recorderRef.current === owner) grammarTokenRef.current = { userId: owner, token };');
    const fire = sliceBetween(page, 'function fireEffects() {', '\n  }\n');
    expect(fire).toContain('retryPendingGrammar();');
  });

  it('재시도 상한을 넘기면 한 줄 알림 — 알림 영역은 늘 있고 내용만 바뀐다(진행 · 결과 화면 같은 자리)', () => {
    expect(page).toContain("const GRAMMAR_NOT_SAVED = '문법 복습 일정을 저장하지 못했어요. 이 문법은 다음 학습에 다시 나와요.';");
    expect(page).toMatch(/const grammarNotice = \(\s*<div role="status" aria-live="polite">\s*\{grammarGaveUp && <p className="study-record-lost">\{GRAMMAR_NOT_SAVED\}<\/p>\}\s*<\/div>\s*\);/);
    expect(page.match(/<div className="page-container" style=\{\{ maxWidth: 640 \}\}>\s*\{grammarNotice\}\s*\{authBanner\}/g)).toHaveLength(2);
  });
});
