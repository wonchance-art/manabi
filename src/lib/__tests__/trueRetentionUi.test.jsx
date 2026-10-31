import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';

// 계약: 실제 기억률 화면(TRUE-RET-001 · docs/design/true-retention.md 목업 · 오너 결정 2026-10-30 KST 「권장대로 ㄱㄱ. 기억 건강 칸에 한 줄로.」).
// ① 칸 줄 규칙(30일 전체 칸 · 답 10개 미만 「—」 · 목표 괄호 · 색/화살표 없음 · 손님은 줄 없음)
// ② 표(줄 6 · 열 3 · 칸 「88% (22)」/「—」 · 머리칸 scope · 1년/전체는 긴 조회 뒤에만 · 빈 상태 · 꼬리 문구)
// ③ 예전 일정 쓰기 4곳이 detail.prev_interval_days를 싣는다(growthStats.prevIntervalDetail — cardIntervalDays 정본)
// ④ 조회: 진입 땐 30일만, 1년 · 전체는 모달을 열 때만(지연) · detail 통짜 금지 · 연산은 grade/undo의 필요한 칸만.

const h = vi.hoisted(() => ({ calls: [], events: [], operations: [], markers: [] }));
vi.mock('next/link', () => ({ default: ({ href, children, prefetch: _prefetch, ...rest }) => <a href={href} {...rest}>{children}</a> }));
vi.mock('../supabase', () => {
  const query = (table) => {
    const state = { table, select: null, eq: {}, in: {}, gte: null, lte: null, order: [], range: null, limit: null };
    const q = {
      select(cols, opts) { state.select = [cols, opts]; return q; },
      eq(col, v) { state.eq[col] = v; return q; },
      in(col, v) { state.in[col] = v; return q; },
      gte(col, v) { state.gte = [col, v]; return q; },
      lte(col, v) { state.lte = [col, v]; return q; },
      order(col, opts) { state.order.push([col, opts?.ascending]); return q; },
      limit(n) { state.limit = n; return q; },
      range(from, to) { state.range = [from, to]; return q; },
      then(resolve, reject) {
        h.calls.push(state);
        const rows = table === 'fsrs_operations' ? h.operations : state.eq.source === 'ui' ? h.markers : h.events;
        const [from, to] = state.range || [0, rows.length - 1];
        return Promise.resolve({ data: rows.slice(from, to + 1), count: rows.length, error: null }).then(resolve, reject);
      },
    };
    return q;
  };
  return { supabase: { from: query } };
});

const cellText = html => html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const { buildTrueRetention, formatRetentionCell, trueRetentionLine, TRUE_RETENTION_MIN_ANSWERS, TRUE_RETENTION_LABELS } = await import('../trueRetention');
const { ALL_TIME_FROM, fetchTrueRetentionRows, trueRetentionSinceIso, TRUE_RETENTION_EVENT_COLUMNS, TRUE_RETENTION_OPERATION_COLUMNS } = await import('../trueRetentionRows');
const { prevIntervalDetail } = await import('../growthStats');
const { introduceFsrsCard, scheduleFsrsReview } = await import('../fsrsScheduler');
const MemoryHealthCard = (await import('../../components/learn/MemoryHealthCard')).default;
const TrueRetentionTable = (await import('../../components/learn/TrueRetentionTable')).default;

const NOW = Date.parse('2026-10-30T12:00:00+09:00');
const kst = (local) => new Date(Date.parse(`${local}+09:00`)).toISOString().replace('Z', '+00:00');
const read = (f) => fs.readFileSync(f, 'utf8');
// 예전 일정 답 n개(직전 간격 기록 있음) — 맞힘 passed개.
const answers = (n, passed, interval = 30) => Array.from({ length: n }, (_, i) => ({
  lang: 'Japanese', source: 'vocab', item_key: `w${i}`, correct: i < passed, created_at: kst('2026-10-29T09:00:00'),
  detail: { word_id: `id-${i}`, rating: i < passed ? 3 : 1, mode: 'flash', qtype: 'flash', prev_interval_days: interval },
}));
const table = (events) => buildTrueRetention({ events, now: NOW });
const cellOf = (t, key, part) => t.periods.find(p => p.key === key)[part];
const card = (trueRetention) => renderToStaticMarkup(createElement(MemoryHealthCard, { lang: 'Japanese', projections: [], now: NOW, trueRetention, onOpenTrueRetention: () => {} }));
const modal = (props) => renderToStaticMarkup(createElement(TrueRetentionTable, { reviewHref: '/vocab?lang=Japanese', onRetry: () => {}, ...props }));

describe('① 칸 줄 — 지난 30일 전체 칸, 답 10개 미만이면 「—」', () => {
  it('답 9개는 「—」(목표 괄호도 없다) · 10개부터 비율과 「목표 90%」', () => {
    expect(TRUE_RETENTION_MIN_ANSWERS).toBe(10);
    expect(trueRetentionLine(table(answers(9, 9)))).toEqual({ value: '—', target: null, total: 9, measured: false });
    expect(trueRetentionLine(table(answers(10, 9)))).toEqual({ value: '90%', target: '목표 90%', total: 10, measured: true });
    expect(trueRetentionLine(null)).toMatchObject({ value: '—', target: null, measured: false });
  });

  it('줄 글자: 이름 「실제 기억률」 · 조건 「지난 30일 · 목표 90%」 두 줄 + 값 · › — 단추 · 이름표 · 창 표시, 색 · 화살표 없음', () => {
    const html = card({ table: table(answers(100, 91)), loading: false });
    const line = sliceBetween(html, '<button type="button" class="learn-memory__true"', '</button>');
    expect(line).toContain('aria-haspopup="dialog"');
    expect(line).toContain('aria-label="실제 기억률 지난 30일 91%, 목표 90% · 기간별 표 보기"');
    expect(line.replace(/<[^>]+>/g, '')).toBe('실제 기억률지난 30일 · 목표 90%91%›');
    expect(line).not.toMatch(/style=|var\(--(danger|warning|success)|[▲▼↑↓]/);
  });

  it('빈 상태 · 불러오는 중은 「—」 · 손님(trueRetention 없음)은 줄 자체가 없다', () => {
    const empty = sliceBetween(card({ table: table([]), loading: false }), 'class="learn-memory__true"', '</button>');
    expect(empty.replace(/<[^>]+>/g, '').replace(/^[^>]*>/, '')).toBe('실제 기억률지난 30일—›');
    expect(empty).toContain('아직 없음');
    expect(card({ table: null, loading: true })).toContain('aria-busy="true"');
    expect(card(null)).not.toContain('learn-memory__true');
  });

  it('줄은 44px 단추 · 토큰 색만', () => {
    const css = read('src/components/learn/learn.css');
    const rule = css.match(/\.learn-memory__true\{[^}]*\}/)?.[0];
    expect(rule).toMatch(/min-height:(4[4-9]|5\d)px/); // 44px 이상(두 줄 구조라 52px)
    const block = sliceBetween(css, '/* 실제 기억률 한 줄', '.learn-true__empty .learn-button-s');
    expect(block).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    expect(css).toMatch(/\.learn-true__empty \.learn-button-s\{min-height:44px\}/);
  });
});

describe('② 표 — 오늘 · 어제 · 지난 7일 · 지난 30일 · 지난 1년 · 전체 × 익히는 중 · 익숙 · 전체', () => {
  it('칸 글자: 「88% (22)」 · 천 단위 쉼표 · 답 없으면 「—」', () => {
    expect(formatRetentionCell({ passed: 22, failed: 3, total: 25, rate: 0.88 })).toBe('88% (25)');
    expect(formatRetentionCell({ passed: 1013, failed: 100, total: 1113, rate: 1013 / 1113 })).toBe('91% (1,113)');
    expect(formatRetentionCell({ passed: 0, failed: 0, total: 0, rate: null })).toBe('—');
  });

  it('긴 조회가 끝나면 줄 6 · 열 3, 머리칸은 scope로 — 줄 이름은 목업 그대로', () => {
    const t = table([...answers(20, 18, 30), ...answers(5, 4, 3).map((e, i) => ({ ...e, item_key: `y${i}`, detail: { ...e.detail, word_id: `y-${i}` } }))]);
    const html = modal({ table: t, longStatus: 'ready' });
    expect(Object.values(TRUE_RETENTION_LABELS)).toEqual(['오늘', '어제', '지난 7일', '지난 30일', '지난 1년', '전체']);
    const rows = [...html.matchAll(/<th scope="row">([^<]+)<\/th>/g)].map(m => m[1]);
    expect(rows).toEqual(['오늘', '어제', '지난 7일', '지난 30일', '지난 1년', '전체']);
    const cols = [...html.matchAll(/<th scope="col">(?:<span class="sr-only">)?([^<]+)/g)].map(m => m[1]);
    expect(cols).toEqual(['기간', '익히는 중', '익숙', '전체']);
    const yesterday = sliceBetween(html, '<th scope="row">어제</th>', '</tr>');
    expect([...yesterday.matchAll(/<td>(.*?)<\/td>/g)].map(m => cellText(m[1]))).toEqual(['80%답 5', '90%답 20', '88%답 25']); // 퍼센트 위 · 답 수 아래(화면 읽기 「답 N」)
    const today = sliceBetween(html, '<th scope="row">오늘</th>', '</tr>');
    expect([...today.matchAll(/<td>(.*?)<\/td>/g)].map(m => cellText(m[1]))).toEqual(['—', '—', '—']);
    const plain = cellText(html.replace(/<\/(li|span)>/g, '</$1> '));
    for (const sentence of ['복습 단어를 다시 만났을 때 기억해 낸 비율이에요.', '「다시」를 누른 답만 못 떠올린 것으로 쳐요.', '목표는 90%예요.',
      '하루 값은 흔들리니 30일 줄을 보세요.', '익숙은 간격 21일 이상, 작은 숫자는 답 수예요.', '연습 · 되돌린 답 · 학습 단계 답은 빼요.']) expect(plain).toContain(sentence);
    expect(html).not.toContain('어림했어요'); // 기록된 직전 간격만 — 추정 0이면 그 줄이 없다
  });

  it('추정한 답이 있을 때만 그 줄 — 「예전 일정 단어 답 N개는 간격을 어림했어요.」', () => {
    const legacy = (at) => ({ lang: 'Japanese', source: 'vocab', item_key: '食べる', correct: true, created_at: kst(at),
      detail: { word_id: 'w', rating: 3, mode: 'flash', qtype: 'flash' } });
    const t = table([legacy('2026-10-01T09:00:00'), legacy('2026-10-29T09:00:00')]);
    expect(t.estimated).toBe(1);
    expect(modal({ table: t, longStatus: 'ready' })).toContain('<span class="learn-true__ph">예전 일정 단어 답 1개는</span> <span class="learn-true__ph">간격을 어림했어요.</span>');
  });

  it('긴 조회 전에는 1년 · 전체 칸을 「…」(실패면 「—」 + 다시 시도) — 짧은 창 숫자를 1년 값처럼 적지 않는다', () => {
    const t = table(answers(20, 18));
    const loading = modal({ table: t, longStatus: 'loading' });
    expect(loading).toContain('aria-busy="true"');
    const year = sliceBetween(loading, '<th scope="row">지난 1년</th>', '</tr>');
    expect([...year.matchAll(/<td>(.*?)<\/td>/g)].map(m => cellText(m[1]))).toEqual(['…', '…', '…']);
    const month = sliceBetween(loading, '<th scope="row">지난 30일</th>', '</tr>');
    expect(cellText(month)).toContain('90%답 20');
    const failed = modal({ table: t, longStatus: 'error' });
    expect([...sliceBetween(failed, '<th scope="row">전체</th>', '</tr>').matchAll(/<td>(.*?)<\/td>/g)].map(m => cellText(m[1]))).toEqual(['—', '—', '—']);
    expect(failed).toContain('지난 1년 · 전체를 불러오지 못했어요.');
    expect(failed).toMatch(/<button type="button" class="learn-button-s">다시 시도<\/button>/);
  });

  it('빈 상태 — 「아직 실제 기억률을 잴 복습이 없어요」 + [복습하기](칩 언어의 복습 주소)', () => {
    const html = modal({ table: table([]), longStatus: 'ready' });
    expect(html).toContain('<p>아직 실제 기억률을 잴 복습이 없어요</p>');
    expect(html).toContain('<a href="/vocab?lang=Japanese" class="learn-button-s">복습하기</a>');
    expect(html).not.toContain('<table');
    // 30일이 비었어도 긴 조회 전에는 빈 상태로 단정하지 않는다
    expect(modal({ table: table([]), longStatus: 'loading' })).toContain('실제 기억률 불러오는 중…');
    expect(modal({ table: null, longStatus: 'error', failed: true })).toContain('실제 기억률을 불러오지 못했어요.');
  });

  it('현황이 TileModal 정본으로 편다 — 제목 「실제 기억률」 · 복습 주소는 serializeReviewScope({ lang })', () => {
    const page = read('src/views/ProfileStats.jsx');
    expect(page).toMatch(/<TileModal title="실제 기억률" className="tile-modal--wide"/);
    expect(page).toContain('reviewHref={serializeReviewScope({ lang })}');
    expect(page).toContain("onOpenTrueRetention={() => setRetentionOpen(true)}");
    expect(page).toContain('trueRetention={user ? { table: retention, loading: !retention && !recentRetention.isError } : null}');
    expect(sliceBetween(page, 'function TileModal(', '\n}\n')).toContain('className={`card tile-modal ${className}`.trim()}');
  });
});

describe('③ 예전 일정 쓰기 4곳 — detail.prev_interval_days(채점 직전 간격)', () => {
  it('prevIntervalDetail은 cardIntervalDays 정본을 감쌀 뿐 — 잴 수 없으면 빈 객체(detail 모양 그대로)', () => {
    expect(prevIntervalDetail({ last_reviewed_at: '2026-10-01T00:00:00Z', next_review_at: '2026-10-31T00:00:00Z' })).toEqual({ prev_interval_days: 30 });
    expect(prevIntervalDetail({ last_reviewed_at: null, next_review_at: '2026-10-31T00:00:00Z' })).toEqual({});
    const src = read('src/lib/growthStats.js');
    expect(sliceBetween(src, 'export function prevIntervalDetail(', '\n}\n')).toContain('cardIntervalDays(row)');
  });

  it.each([
    ['src/views/VocabPage.jsx', 'detail: { word_id: currentWord.id, meaning: currentWord.meaning, rating, mode: effectiveMode, qtype, ...prevIntervalDetail(currentWord) }'],
    ['src/lib/useInlineReview.js', "detail: { word_id: vocab.id, meaning: vocab.meaning, rating, qtype: 'flash', ...prevIntervalDetail(vocab) }"],
    ['src/components/world/QuestReview.jsx', "detail: { word_id: current.id, meaning: current.meaning, rating, mode: 'world', qtype: 'flash', ...prevIntervalDetail(current) }"],
    ['src/lib/studyExerciseBridge.js', 'detail: { ...reviewRef.detail, ...prevIntervalDetail(word) }'],
  ])('%s — 기존 칸 그대로 + 덧붙이는 칸 하나', (file, detail) => {
    const src = read(file);
    expect(src).toContain(detail);
    expect(src).toMatch(/import \{[^}]*\bprevIntervalDetail\b[^}]*\} from '[./]*(lib\/)?growthStats'/);
    // 예전 일정 채점 길(recordReviewCompleted + calculateVocabFSRS)에 실린다
    expect(src).toContain('recordReviewCompleted');
    expect(src).toContain('calculateVocabFSRS');
  });

  it('기록된 직전 간격이 있으면 추정 수가 0 — 쓰기 모양 그대로 표가 읽는다', () => {
    const row = { id: 'w1', word_text: '猫', last_reviewed_at: '2026-10-05T19:00:00Z', next_review_at: '2026-10-29T19:00:00Z' };
    const events = [
      { lang: 'Japanese', source: 'vocab', item_key: '猫', correct: true, created_at: kst('2026-10-05T09:00:00'), detail: { word_id: 'w1', rating: 3, mode: 'flash', qtype: 'flash' } },
      { lang: 'Japanese', source: 'vocab', item_key: '猫', correct: true, created_at: kst('2026-10-30T09:00:00'),
        detail: { word_id: 'w1', meaning: '고양이', rating: 3, mode: 'flash', qtype: 'flash', ...prevIntervalDetail(row) } },
    ];
    const t = table(events);
    expect(t.estimated).toBe(0);
    expect(cellOf(t, 'today', 'mature').total).toBe(1);
  });
});

describe('④ 조회 — 진입 땐 30일, 1년 · 전체는 모달을 열 때만', () => {
  beforeEach(() => { h.calls = []; h.events = []; h.operations = []; h.markers = []; });

  it('현황: 30일 조회는 로그인만으로, 긴 조회는 모달이 열렸을 때만 켜진다', () => {
    const page = read('src/views/ProfileStats.jsx');
    const recent = sliceBetween(page, "queryKey: trueRetentionQueryKey(user?.id, 'recent')", '});');
    expect(recent).toContain("fetchTrueRetentionRows(user.id, { range: 'recent' })");
    expect(recent).toContain('enabled: !!user,');
    const long = sliceBetween(page, "queryKey: trueRetentionQueryKey(user?.id, 'all')", '});');
    expect(long).toContain("fetchTrueRetentionRows(user.id, { range: 'all' })");
    expect(long).toContain('enabled: !!user && retentionOpen,');
  });

  it('30일 창은 학습일(04시) 경계 — 오늘 포함 30학습일 · 「전체」는 창이 없다', () => {
    expect(trueRetentionSinceIso('recent', NOW)).toBe(new Date(Date.parse('2026-10-01T04:00:00+09:00')).toISOString());
    expect(trueRetentionSinceIso('all', NOW)).toBeNull();
  });

  it('30일: review_events(vocab) 완전 조회 + undo 마커 + fsrs_operations(grade · undo) — detail 통짜 · operation 통짜 없음', async () => {
    h.events = [{ id: 1, source: 'vocab', item_key: '猫', correct: true, created_at: kst('2026-10-30T09:00:00'), lang: 'Japanese',
      word_id: 'card-1', rating: 3, mode: 'flash', qtype: 'flash', warmup: null, fsrs_operation_id: 'op-1', prev_interval_days: null }];
    h.operations = [{ id: 'op-1', kind: 'grade', received_at: '2026-10-30T00:00:01+00:00', prev_state: 'Review', prev_days: '30', undone_id: null }];
    const rows = await fetchTrueRetentionRows('u1', { range: 'recent', now: NOW });
    const ev = h.calls.find(c => c.table === 'review_events' && c.eq.source === 'vocab');
    const ops = h.calls.find(c => c.table === 'fsrs_operations');
    const marks = h.calls.find(c => c.table === 'review_events' && c.eq.source === 'ui');
    expect(ev.select).toEqual([TRUE_RETENTION_EVENT_COLUMNS, { count: 'exact' }]);
    expect(TRUE_RETENTION_EVENT_COLUMNS).not.toMatch(/(^|, )detail(,|$)/); // 경로로만 고른다
    expect(ev.eq.user_id).toBe('u1');
    expect(ev.gte).toEqual(['created_at', trueRetentionSinceIso('recent', NOW)]);
    expect(ev.order).toEqual([['created_at', true], ['id', true]]);
    expect(ops.select).toEqual([TRUE_RETENTION_OPERATION_COLUMNS, { count: 'exact' }]);
    expect(TRUE_RETENTION_OPERATION_COLUMNS).not.toMatch(/(^|, )operation(,|$)/);
    expect(ops.in.kind).toEqual(['grade', 'undo']);
    expect(ops.eq.user_id).toBe('u1');
    expect(Date.parse(ops.gte[1])).toBeLessThan(Date.parse(ev.gte[1])); // 기기 시계 여유 — 창 첫머리 하루
    expect(marks.gte).toEqual(['created_at', trueRetentionSinceIso('recent', NOW)]);
    // 받은 행은 계산 정본이 읽는 모양으로 — 새 일정 채점이 직전 카드(복습 30일)로 익숙에 든다
    expect(rows.events[0].detail).toEqual({ word_id: 'card-1', rating: 3, mode: 'flash', qtype: 'flash', fsrs_operation_id: 'op-1' });
    expect(rows.operations[0]).toEqual({ id: 'op-1', kind: 'grade', previousCard: { state: 'Review', scheduledDays: 30 }, operation: {} });
    const t = buildTrueRetention({ ...rows });
    expect(cellOf(t, 'today', 'mature').total).toBe(1);
    expect(t.skipped.unknown).toBe(0);
  });

  it('전체: 창 없이 처음부터(지금 시각 상한만) · undo 마커는 넉넉히 · undo 연산은 undoneOperationId로 원 채점을 뺀다', async () => {
    let grown = introduceFsrsCard('2026-01-05T01:00:00.000Z');
    for (let i = 0; i < 2; i += 1) grown = scheduleFsrsReview(grown, 3, grown.due).card; // 학습 → 복습(실제 엔진 출력)
    expect(grown.state).toBe('Review');
    h.events = [{ id: 1, source: 'vocab', item_key: '猫', correct: false, created_at: kst('2026-03-01T09:00:00'), lang: 'Japanese',
      word_id: 'card-1', rating: 1, mode: 'flash', qtype: 'flash', fsrs_operation_id: 'op-1' }];
    h.operations = [
      { id: 'op-1', kind: 'grade', received_at: '2026-03-01T00:00:01+00:00', prev_state: grown.state, prev_days: String(grown.scheduledDays), undone_id: null },
      { id: 'op-2', kind: 'undo', received_at: '2026-03-01T00:00:09+00:00', prev_state: null, prev_days: null, undone_id: 'op-1' },
    ];
    const rows = await fetchTrueRetentionRows('u1', { range: 'all', now: NOW });
    const ev = h.calls.find(c => c.table === 'review_events' && c.eq.source === 'vocab');
    expect(ev.gte).toEqual(['created_at', ALL_TIME_FROM]); // 창 없음과 같은 아래 끝
    expect(ev.lte).toEqual(['created_at', new Date(NOW).toISOString()]);
    expect(h.calls.find(c => c.table === 'fsrs_operations').gte).toEqual(['received_at', ALL_TIME_FROM]);
    expect(h.calls.find(c => c.table === 'review_events' && c.eq.source === 'ui').limit).toBe(1000);
    const t = buildTrueRetention({ ...rows });
    expect(cellOf(t, 'all', 'all').total).toBe(0); // 되돌린 채점은 빠진다
  });
});

describe('표 칸 정렬 — 퍼센트가 세로로 같은 자리(오너 2026-10-30)', () => {
  it('칸은 퍼센트 · 답 수 두 조각이고 각자 고정 폭', async () => {
    const { retentionCellParts } = await import('../trueRetention');
    expect(retentionCellParts({ total: 25, rate: 0.88 })).toEqual({ rate: '88%', count: '25' });
    expect(retentionCellParts({ total: 0, rate: null })).toEqual({ rate: '—', count: '' });
    const fs = await import('node:fs');
    const css = fs.readFileSync('src/components/learn/learn.css', 'utf8');
    // 퍼센트 위 · 답 수 아래로 쌓고 칸은 오른쪽 끝 맞춤 — 열 폭과 무관하게 퍼센트가 같은 세로선(320px에서도 창 안).
    expect(css).toMatch(/\.learn-true__rate,\.learn-true__count\{display:block\}/);
    expect(css).toMatch(/\.learn-true__table th,\.learn-true__table td\{[^}]*text-align:right;white-space:nowrap/);
    expect(css).toMatch(/\.learn-true__ph\{display:inline-block\}/);
    expect(fs.readFileSync('src/components/learn/TrueRetentionTable.jsx', 'utf8')).toContain('retentionCellParts(period[col.key])');
  });
});
