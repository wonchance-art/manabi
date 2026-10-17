// 「한자」 탭 넘기기(HANZI-TAB-AL-001 · 인계 #1337 6146776723 §1 · §4) — 화면(HanziBoard)이 쓰는 순수 규칙.
// 기록 규칙: 글자마다 결정 1건. 결정은 곧바로 쓰지 않고 「대기」로 들고 있다가 다른 글자를 결정할 때 · 끝 · 나가기 때
// 확정한다 — 그래서 방금 줄 [몰랐어요] · 이전 · 취소는 기록을 늘리지 않고 그 1건을 바꾸거나 없앤다.

/** 섞기(Fisher–Yates) — 시작할 때마다 새 순서(위치로 외우기 방지). rand는 테스트용. */
export function shuffleHanzi(list, rand = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 표시 — 글자마다 **마지막** `hanzi` 기록. rows는 최신 순(created_at desc)이어야 한다.
 * @returns {Map<string, boolean>} 글자 → 마지막 결정(false = 모름, true = 확인함). 없으면 아직.
 */
export function lastHanziMarks(rows) {
  const marks = new Map();
  for (const r of rows || []) {
    if (!r?.item_key || typeof r.correct !== 'boolean' || marks.has(r.item_key)) continue;
    marks.set(r.item_key, r.correct);
  }
  return marks;
}

/**
 * 글자마다 마지막 hanzi 기록의 정오(REVIEW-ROWS-CAP-001, 2026-10-17 KST). 전에는 화면이 .limit(5000) 한 번으로 읽었는데
 * PostgREST가 1000행에서 말없이 잘라, 많이 푼 사람은 오래 안 본 글자의 표시가 빠졌다.
 * 글자 150개씩 묶어(.in URL 길이) 최신순(created_at desc, id desc) 1000행 페이지로 읽고, 묶음의 글자를 다 찾으면 멈춘다.
 * 앞 페이지(더 최신)가 이긴다. untilIso로 상한을 고정해 읽는 사이 새 기록이 페이지를 밀지 않게 한다. 하나라도 오류면 reject.
 * @returns {Promise<Map<string, boolean>>}
 */
export async function fetchLastHanziMarks(client, userId, chars, { chunk = 150, page = 1000, untilIso = new Date().toISOString() } = {}) {
  const wanted = [...new Set(chars || [])].filter(Boolean);
  const marks = new Map();
  for (let i = 0; i < wanted.length; i += chunk) {
    const part = wanted.slice(i, i + chunk);
    const missing = new Set(part);
    for (let from = 0; missing.size; from += page) {
      const { data, error } = await client.from('review_events').select('id, item_key, correct, created_at')
        .eq('user_id', userId).eq('source', 'hanzi').in('item_key', part).lte('created_at', untilIso)
        .order('created_at', { ascending: false }).order('id', { ascending: false })
        .range(from, from + page - 1);
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('hanzi_marks_unavailable');
      for (const row of data) {
        if (!missing.has(row?.item_key) || typeof row.correct !== 'boolean') continue;
        marks.set(row.item_key, row.correct);
        missing.delete(row.item_key);
      }
      if (data.length < page) break;
    }
  }
  return marks;
}

/**
 * 새 넘기기. order = 넘길 글자(이미 섞은 것 — 「이 글자부터」면 그 글자가 맨 앞).
 * view: 'q' 문제 · 'card' 몰라요 뒤 답 카드 · 'end' 끝
 */
export function startHanziRun(order, { set = null } = {}) {
  return { order: [...order], set, i: 0, view: order.length ? 'q' : 'end', pending: null, last: null, fixed: null, results: {}, hinted: false };
}

const cur = (s) => s.order[s.i] ?? null;

/** 대기 결정을 확정할 기록으로. */
const commitOf = (pending) => (pending ? [{ ch: pending.ch, correct: pending.correct }] : []);

function advance(state) {
  const i = state.i + 1;
  if (i < state.order.length) return { state: { ...state, i, view: 'q' }, commits: [] };
  return { state: { ...state, i: state.order.length, view: 'end', last: null, pending: null }, commits: commitOf(state.pending) };
}

function decide(state, correct) {
  const ch = cur(state);
  if (!ch || state.view !== 'q') return { state, commits: [] };
  const commits = state.pending && state.pending.ch !== ch ? commitOf(state.pending) : [];
  const next = { ...state, pending: { ch, correct }, results: { ...state.results, [ch]: correct }, hinted: true, fixed: null };
  return { state: next, commits };
}

/**
 * 한 걸음 — { state, commits }. commits = 지금 확정할 기록([{ch, correct}]), 화면이 logReviewEvents로 쓴다.
 * 동작: know(알아요) · dontKnow(몰라요) · next(답 카드의 다음) · cancel(몰라요 취소) · fixLast(방금 줄 몰랐어요)
 *       · prev(이전 — 직전 대기 글자 하나까지) · exit(나가기)
 */
export function stepHanziRun(state, action) {
  switch (action) {
    case 'know': {
      const d = decide(state, true);
      if (d.state === state) return d;
      const a = advance({ ...d.state, last: cur(state) });
      return { state: a.state, commits: [...d.commits, ...a.commits] };
    }
    case 'dontKnow': {
      const d = decide(state, false);
      if (d.state === state) return d;
      return { state: { ...d.state, view: 'card', last: null }, commits: d.commits };
    }
    case 'next':
      if (state.view !== 'card') return { state, commits: [] };
      return advance(state);
    case 'cancel': {
      if (state.view !== 'card' || state.pending?.ch !== cur(state)) return { state, commits: [] };
      const results = { ...state.results };
      delete results[state.pending.ch];
      return { state: { ...state, view: 'q', pending: null, results }, commits: [] };
    }
    case 'fixLast': {
      const ch = state.last;
      if (!ch || state.pending?.ch !== ch) return { state, commits: [] };
      return { state: { ...state, pending: { ch, correct: false }, results: { ...state.results, [ch]: false }, last: null, fixed: ch }, commits: [] };
    }
    case 'prev': {
      const before = state.order[state.i - 1];
      if (state.view === 'end' || !before || state.pending?.ch !== before) return { state, commits: [] };
      return { state: { ...state, i: state.i - 1, view: 'q', last: null }, commits: [] };
    }
    case 'exit':
      return { state: { ...state, view: 'end', pending: null, last: null }, commits: commitOf(state.pending) };
    default:
      return { state, commits: [] };
  }
}

/** 지금 화면의 진행(1부터). 끝이면 전체 수. */
export function hanziRunProgress(state) {
  return { n: Math.min(state.i + 1, state.order.length), total: state.order.length };
}

/** 이번 넘기기에서 모른 글자(넘긴 순서). */
export function hanziRunMisses(state) {
  return state.order.filter((ch) => state.results[ch] === false);
}
