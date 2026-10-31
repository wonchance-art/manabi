// 단어 페이지(HSK · JLPT)의 오늘 할 줄 — 한 단어 모드와 리스트 모드가 같은 줄을 쓴다(오너 확정 2026-10-19 KST · 문서 「한 단어 모드」 · 「리스트 모드」).
// 순수 상태 — 화면은 이 함수들의 결과만 그린다. 기록은 채점 길(뷰어 · 복습실 정본)이 하고, 여기는 순서만 정한다.
//
// 줄 순서: ① 시간이 된 카드(기다리다 차례가 온 카드 · 시작할 때 이미 차례가 된 학습 단계 카드, 먼저 된 것부터)
// ② 오늘 복습과 담지 않은 새 단어를 섞은 줄(둘 다 목록 순, 새 단어는 복습 사이에 고르게 — 복습실과 같은 intersperseNew,
// Anki 「복습과 섞기」, 오너 「Anki와 동일하게」 2026-10-25 KST) ③ 기다리는 카드(남은 시간 짧은 순).
// 채점해서 다음 차례가 오늘 안(다시 1분 · 어려움 6분 …)이면 그 시각까지 ③에서 기다리고, 내일 이후면 줄에서 빠진다.
// 줄에 기다리는 카드만 남으면 한 단어 모드는 가장 먼저 될 카드를 앞당겨 이어간다. 둘 다 비면 끝(「오늘 이 레벨 끝」).
// 되돌리기는 직전 상태로 — 화면이 기록 되돌리기와 같이 부른다.
// 하루 새 단어(시안 ⑦-1 추천 · 2026-10-21 KST): ② 중 새 단어(담지 않은 단어 · 담기만 한 담음 단어)는 newCap개까지만 줄에 서고 나머지는 held에 남는다.
// 줄이 비면 끝 화면이 「새 단어 N개 더」로 held에서 꺼낸다(막지 않는다). 복습할 때가 된 카드는 한도와 상관없이 다 선다.
//
// 학습 옵션(LEVEL-STUDY-OPTIONS-001 — 오너 2026-10-31 KST): ② 줄은 「순서」와 「분량」으로 짠다(arrangeLine).
// 순서 = 혼합(위 intersperseNew · 기본) · 새 단어 먼저([새 단어…, 복습…] — Anki 「복습 전에」) · 복습 먼저([복습…, 새 단어…] — 「복습 뒤에」).
// 어느 순서든 거르지 않는다 — 하루 몫 안의 새 단어와 오늘 복습이 모두 서고, 배우는 중인 카드(시작 때 차례가 된 학습 단계 ①)는 맨 앞,
// 기다리는 카드(③)는 그대로. 분량(N) = 짠 ② 줄의 앞 N장만 줄에 세우고 나머지는 rest에 둔다(버리지 않는다) — 끝 화면 「이어서 N개」가
// rest에서 다음 N장을 꺼낸다(continueLevelSession). held(하루 몫 뒤 새 단어 · 「새 단어 N개 더」)와는 다른 칸이다.
// 옵션을 바꾸면 아직 채점하지 않은 몫(줄 + rest)만 다시 짠다(arrangeLevelSession) — 채점 수 · 누른 횟수 · history · 기다리는 카드는 그대로.
// 다시 짤 때 복습 · 새 단어는 각자 처음 차례(rank — 목록 순)로 돌아가므로, 옵션을 바꿨다 되돌리면 같은 줄이 된다.

import { intersperseNew } from './reviewQueue.js';

const byAt = (a, b) => a.at - b.at;

/**
 * 세션 시작 — entries = 범위 단어(목록 순), statusOf(key) = 'new' | 'saved' | 'today' | 'review' | 'grad',
 * 'saved'(담음 — 담기만 하고 한 번도 채점하지 않은 단어)는 새 단어와 같이 하루 몫(newCap) 안에 선다 — 서버가 첫 문제에서 새 단어 몫을
 * 쓰는 카드라서다(LEVEL-SAVED-TAG-001). 전에는 「오늘 복습」으로 몫 밖에 서서 몫이 찬 날 채점이 거절됐다.
 * dueAtOf(key) = 다음 차례 시각(ms, 없으면 0). 오늘 복습인데 아직 시각이 안 된 카드(오늘 앞서 채점한 카드)는 기다리는 카드로.
 * learningOf(key) = 분 단위 학습 · 재학습 단계 카드인가 — 이미 차례가 됐으면 섞지 않고 맨 앞(먼저 된 것부터).
 */
export function startLevelSession(entries, statusOf, dueAtOf = () => 0, at = Date.now(),
  { newCap = Infinity, learningOf = () => false, order = 'mix', amount = Infinity } = {}) {
  const today = [], learning = [], fresh = [], waiting = [];
  const kind = {}, rank = {};
  (entries || []).forEach((e, i) => {
    const s = statusOf(e.key);
    if (s === 'today') {
      const due = Number(dueAtOf(e.key)) || 0;
      if (due > at) waiting.push({ key: e.key, at: due });
      else if (learningOf(e.key)) { learning.push({ key: e.key, at: due }); kind[e.key] = 'learn'; rank[e.key] = i; }
      else { today.push(e.key); kind[e.key] = 'review'; rank[e.key] = i; }
    } else if (s === 'new' || s === 'saved') { fresh.push(e.key); kind[e.key] = 'new'; rank[e.key] = i; }
  });
  waiting.sort(byAt);
  learning.sort(byAt);
  const cap = Math.max(0, Math.min(fresh.length, newCap));
  const opts = studyOpts({ order, amount });
  const line = arrangeLine(today, fresh.slice(0, cap), opts);
  return { queue: [...learning.map((l) => l.key), ...line.queue], rest: line.rest, held: fresh.slice(cap), waiting,
    graded: 0, counts: { 1: 0, 2: 0, 3: 0, 4: 0 }, history: [], total: today.length + learning.length + cap + waiting.length, kind, rank, opts };
}

export const LEVEL_SESSION_ORDERS = Object.freeze(['mix', 'new-first', 'review-first']);
const studyOpts = ({ order = 'mix', amount = Infinity } = {}) => ({
  order: LEVEL_SESSION_ORDERS.includes(order) ? order : 'mix',
  amount: Number.isInteger(amount) && amount > 0 ? amount : Infinity,
});
const sameOpts = (a, b) => !!a && !!b && a.order === b.order && a.amount === b.amount;

/**
 * ② 줄 짜기 — reviews · fresh는 각자 차례대로(복습 = 목록 순 · 새 단어 = 목록 순). 순서대로 합친 뒤 분량(amount)만큼 queue, 나머지 rest.
 * @returns {{ queue: string[], rest: string[] }}
 */
export function arrangeLine(reviews, fresh, { order = 'mix', amount = Infinity } = {}) {
  const line = order === 'new-first' ? [...fresh, ...reviews] : order === 'review-first' ? [...reviews, ...fresh] : intersperseNew(reviews, fresh);
  const n = Number.isInteger(amount) && amount >= 0 ? amount : line.length;
  return { queue: line.slice(0, n), rest: line.slice(n) };
}

/**
 * 옵션을 바꾼 뒤 — 아직 채점하지 않은 몫(줄 + rest)만 다시 짠다. 배우는 중인 카드(learn)는 맨 앞 그대로, 복습 · 새 단어는 처음 차례(rank)로 모아
 * arrangeLine. pin = 지금 보고 있는 카드(②에 있으면 ② 맨 앞에 남긴다 — 보던 카드가 옵션을 바꿨다고 사라지지 않게, 되돌리기로 돌아온 카드 포함).
 * 채점 수 · 누른 횟수 · history · 기다리는 카드 · held는 그대로. 옵션이 같으면 그대로 돌려준다(되돌리기 · 실패 복구가 부른다).
 */
export function arrangeLevelSession(session, options, { pin = null } = {}) {
  if (!session) return session;
  const opts = studyOpts(options);
  if (sameOpts(session.opts, opts)) return session;
  const kind = session.kind || {}, rank = session.rank || {};
  const pool = [...session.queue, ...(session.rest || [])];
  const byRank = (a, b) => (rank[a] ?? Infinity) - (rank[b] ?? Infinity);
  const learn = pool.filter((k) => kind[k] === 'learn');
  const reviews = pool.filter((k) => kind[k] !== 'learn' && kind[k] !== 'new').sort(byRank);
  const fresh = pool.filter((k) => kind[k] === 'new').sort(byRank);
  const pinned = pin && !learn.includes(pin) && pool.includes(pin) ? pin : null;
  const amount = pinned && Number.isFinite(opts.amount) ? opts.amount - 1 : opts.amount; // 보던 카드도 분량 한 장
  const line = arrangeLine(reviews.filter((k) => k !== pinned), fresh.filter((k) => k !== pinned), { order: opts.order, amount });
  return { ...session, queue: [...learn, ...(pinned ? [pinned] : []), ...line.queue], rest: line.rest, opts };
}

/** 분량에서 멈춘 끝 화면의 「이어서 N개」 — rest에서 n장을 줄 끝에 세운다. keep = 그사이 다른 곳에서 채점해 오늘 할 일이 아닌 단어는 건너뛴다. */
export function continueLevelSession(session, n, keep = () => true) {
  const rest = (session?.rest || []).filter(keep);
  if (!rest.length || !(n > 0)) return session?.rest?.length && !rest.length ? { ...session, rest: [] } : session;
  return { ...session, queue: [...session.queue, ...rest.slice(0, n)], rest: rest.slice(n) };
}

/** 「새 단어 N개 더」 — 하루 한도 뒤에 남긴 새 단어를 n개 줄 끝에 세운다. stillNew = 그사이 다른 곳(다음에 볼 단어 · 뷰어)에서 채점한 단어는 건너뛴다. */
export function moreLevelSession(session, n, stillNew = () => true) {
  const held = (session?.held || []).filter(stillNew);
  if (!held.length || !(n > 0)) return session;
  return { ...session, queue: [...session.queue, ...held.slice(0, n)], held: held.slice(n), total: session.total + Math.min(n, held.length) };
}

/** 한도 뒤에 남긴 새 단어 하나를 줄 맨 앞으로(로그인 · 다른 레벨 단어 카드에서 그 단어로 돌아올 때). */
export function pullLevelSession(session, key) {
  if (!session?.held?.includes(key)) return session;
  return { ...session, queue: [key, ...session.queue], held: session.held.filter((k) => k !== key), total: session.total + 1 };
}

/** 시간이 된 카드(①) — 기다리던 카드 중 시각이 지난 것, 먼저 된 것부터. */
export const sessionDue = (session, at = Date.now()) => (session?.waiting || []).filter((w) => w.at <= at).map((w) => w.key);
/** 기다리는 카드(③) — { key, at }, 남은 시간 짧은 순. */
export const sessionWaiting = (session, at = Date.now()) => (session?.waiting || []).filter((w) => w.at > at);
/** 지금 채점할 차례인 줄(① + ②). */
export const sessionOrder = (session, at = Date.now()) => [...sessionDue(session, at), ...(session?.queue || [])];
/** 다음에 시간이 될 시각 — 화면이 그때 다시 그린다. 없으면 null. */
export const sessionNextAt = (session, at = Date.now()) => sessionWaiting(session, at)[0]?.at ?? null;
/** 지금 카드(한 단어 모드) — 줄 맨 앞, 기다리는 카드만 남았으면 가장 먼저 될 카드를 앞당겨. */
export const sessionCurrent = (session, at = Date.now()) => sessionOrder(session, at)[0] ?? session?.waiting?.[0]?.key ?? null;
export const sessionDone = (session) => !!session && session.queue.length === 0 && session.waiting.length === 0;
export const sessionHas = (session, key) => !!session && (session.queue.includes(key) || session.waiting.some((w) => w.key === key)
  || (session.rest || []).includes(key));

const without = (session, key) => ({ queue: session.queue.filter((k) => k !== key), waiting: session.waiting.filter((w) => w.key !== key),
  held: (session.held || []).filter((k) => k !== key), rest: (session.rest || []).filter((k) => k !== key) });

/**
 * 카드 하나 채점 — 줄 어디에 있든(리스트는 아무 카드나 누를 수 있다). againAt = 다음 차례가 오늘 안이면 그 시각(ms), 아니면 null.
 * 줄 밖 카드(다음에 볼 단어)도 다시 오늘 안으로 오면 기다리는 카드로 들어온다.
 */
export function gradeLevelSession(session, key, rating, againAt = null) {
  if (!session || ![1, 2, 3, 4].includes(rating)) return session;
  const inLine = sessionHas(session, key);
  if (!inLine && !againAt) return session;
  const { queue, waiting, held, rest } = without(session, key);
  const { history, ...prev } = session;
  return { ...session, queue, held, rest, waiting: againAt ? [...waiting, { key, at: againAt }].sort(byAt) : waiting,
    graded: session.graded + 1, counts: { ...session.counts, [rating]: session.counts[rating] + 1 }, history: [...history.slice(-19), prev] };
}

/**
 * 저장에 실패한 채점을 줄에서 되돌린다. 그사이 다른 카드를 채점했으면(current ≠ moved) 그 결과는 두고
 * 이 카드만 채점 전 자리(줄 맨 앞 · 기다리는 카드)로 돌린다 — 통째로 before로 돌리면 뒤 카드의 채점이 사라진다.
 */
export function revertLevelGrade(current, before, moved, key, rating) {
  if (!current || current === moved) return before;
  const rest = without(current, key);
  const waited = before.waiting.find((w) => w.key === key);
  return { ...current, ...rest,
    queue: before.queue.includes(key) ? [key, ...rest.queue] : rest.queue,
    waiting: waited ? [...rest.waiting, waited].sort(byAt) : rest.waiting,
    held: (before.held || []).includes(key) ? [...rest.held, key] : rest.held,
    rest: (before.rest || []).includes(key) ? [key, ...rest.rest] : rest.rest,
    graded: Math.max(0, current.graded - 1), counts: { ...current.counts, [rating]: Math.max(0, current.counts[rating] - 1) } };
}

/** 카드를 채점 없이 줄에서 뺀다(지금은 채점할 수 없는 카드 — 다른 곳에서 막 채점됨 등). */
export function skipLevelSession(session, key) {
  if (!sessionHas(session, key)) return session;
  return { ...session, ...without(session, key) };
}

/** 직전 채점 되돌리기 — 그 카드가 채점 전 자리로. */
export function undoLevelSession(session) {
  if (!session?.history?.length) return session;
  const prev = session.history[session.history.length - 1];
  return { ...prev, history: session.history.slice(0, -1) };
}

/** 끝 화면의 「계속 진행」 — 다음 레벨(품사 범위는 없앴다, 오너 2026-10-20 KST). 마지막 레벨이면 null. */
export function nextLevelKey(levels, levelKey) {
  const li = levels.indexOf(levelKey);
  return li >= 0 && li < levels.length - 1 ? levels[li + 1] : null;
}

/**
 * 줄 밖 단어(리스트 맨 아래 접힌 두 줄, 오너 2026-10-26 KST · 시안 ⑨) — 「복습 예정」 = 한 번 본 단어(다음 복습이 가까운 순,
 * 날짜 없는 알아요 · 뺀 단어는 끝), 「새 단어」 = 아직 안 본 단어(목록 순). 한 줄에 섞여 있으면 진도가 어디까지인지 안 보였다.
 * gradedOf(key) = 한 번이라도 채점(알아요 포함)했는가, nextOf(key) = 다음 복습 시각(ISO · ms, 없으면 null).
 * @returns {{ review: Array<{ entry, next: string|number|null }>, fresh: Array<object> }}
 */
export function splitLaterEntries(entries, inLine, gradedOf, nextOf) {
  const review = [], fresh = [];
  for (const entry of entries || []) {
    if (inLine.has(entry.key)) continue;
    if (!gradedOf(entry.key)) { fresh.push(entry); continue; }
    const next = nextOf(entry.key) ?? null;
    const t = next == null ? NaN : typeof next === 'number' ? next : Date.parse(next);
    review.push({ entry, next: Number.isFinite(t) ? next : null, t: Number.isFinite(t) ? t : Infinity });
  }
  review.sort((a, b) => a.t - b.t); // 같은 시각은 목록 순(안정 정렬)
  return { review: review.map(({ entry, next }) => ({ entry, next })), fresh };
}

