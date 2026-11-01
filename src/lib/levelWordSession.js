// 단어 페이지(HSK · JLPT)의 오늘 할 줄 — 한 단어 모드와 리스트 모드가 같은 줄을 쓴다(오너 확정 2026-10-19 KST · 문서 「한 단어 모드」 · 「리스트 모드」).
// 순수 상태 — 화면은 이 함수들의 결과만 그린다. 기록은 채점 길(뷰어 · 복습실 정본)이 하고, 여기는 순서만 정한다.
//
// 줄 순서: ① 시간이 된 카드(기다리다 차례가 온 카드 · 시작할 때 이미 차례가 된 학습 단계 카드, 먼저 된 것부터)
// ② 오늘 복습과 담지 않은 새 단어를 섞은 줄(둘 다 목록 순, 새 단어는 복습 사이에 고르게 — 복습실과 같은 intersperseNew,
// Anki 「복습과 섞기」, 오너 「Anki와 동일하게」 2026-10-25 KST) ③ 기다리는 카드(남은 시간 짧은 순).
// 채점해서 다음 차례가 오늘 안(다시 1분 · 어려움 6분 …)이면 그 시각까지 ③에서 기다리고, 내일 이후면 줄에서 빠진다.
// 줄에 기다리는 카드만 남으면 20분 안의 학습 · 재학습 카드를 바로 물린다(미리 학습 sessionAhead — LEARN-AHEAD-001). 그것도 없으면 한 단어 모드는
// 가장 먼저 될 카드를 앞당겨 보인다 — 채점할 수 없으면(60초 창 밖) 화면이 대기 화면을 낸다(LEVEL-WAIT-001). 둘 다 비면 끝(「오늘 이 레벨 끝」).
// 되돌리기는 직전 상태로 — 화면이 기록 되돌리기와 같이 부른다.
// 하루 새 단어(시안 ⑦-1 추천 · 2026-10-21 KST): ② 중 새 단어(담지 않은 단어 · 담기만 한 담음 단어)는 newCap개까지만 줄에 서고 나머지는 held에 남는다.
// 줄이 비면 끝 화면이 「새 단어 N개 더」로 held에서 꺼낸다(막지 않는다). 복습할 때가 된 카드는 한도와 상관없이 다 선다.
//
// 학습 옵션(LEVEL-STUDY-OPTIONS-001 — 오너 2026-10-31 KST): ② 줄은 「순서」로 짠다(arrangeLine).
// 순서 = mix(위 intersperseNew · 기본) · new-first([새 단어…, 복습…] — Anki 「복습 전에」) · review-first([복습…, 새 단어…] — 「복습 후에」). 칸 이름은 levelWordPrefs 표.
// 어느 순서든 거르지 않는다 — 하루 몫 안의 새 단어와 오늘 복습이 모두 서고, 배우는 중인 카드(시작 때 차례가 된 학습 단계 ①)는 맨 앞,
// 기다리는 카드(③)는 그대로. 「분량」(앞 N장만 · 「이어서 N개」)은 뺐다(LEVEL-WAIT-001 · 오너 승인 2026-11-01 KST) — 그 자리는 「하루」 줄.
// 옵션을 바꾸면 아직 채점하지 않은 몫(줄)만 다시 짠다(arrangeLevelSession) — 채점 수 · 누른 횟수 · history · 기다리는 카드는 그대로.
// 하루 새 단어 수를 바꾸면 같은 길에 newCap을 넘겨 줄의 새 단어와 held를 새 몫으로 다시 나눈다(채점한 단어는 이미 줄 밖이다).
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
  { newCap = Infinity, learningOf = () => false, order = 'mix' } = {}) {
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
  const opts = studyOpts({ order });
  const line = arrangeLine(today, fresh.slice(0, cap), opts);
  return { queue: [...learning.map((l) => l.key), ...line], held: fresh.slice(cap), waiting,
    graded: 0, counts: { 1: 0, 2: 0, 3: 0, 4: 0 }, history: [], total: today.length + learning.length + cap + waiting.length, kind, rank, opts,
    seen: [...today, ...learning.map((l) => l.key), ...fresh, ...waiting.map((w) => w.key)] };
}

/**
 * 줄을 세운 뒤에 생긴 카드를 더한다(CARD-TYPES-001 3단계 — 「카드」 줄로 종류를 켰거나 종류 카드를 막 붙였다). items = [{ key, at(차례 시각 ms · 0 = 지금),
 * learning(학습 단계인가), rank }] — 이 세션에 한 번도 선 적 없는 카드만(seen — 채점해 줄에서 빠진 카드를 다시 세우지 않는다).
 * 차례가 된 카드는 줄(② 끝 — 복습과 같이, 하루 새 단어 몫 밖), 오늘 안 다른 시각이면 기다리는 카드로. 채점 수 · 기록은 그대로.
 */
export function addLevelSessionKeys(session, items, at = Date.now()) {
  if (!session || !items?.length) return session;
  const seen = new Set(session.seen || []);
  const fresh = items.filter((it) => it?.key && !seen.has(it.key));
  if (!fresh.length) return session;
  const kind = { ...session.kind }, rank = { ...session.rank };
  const queue = [...session.queue], waiting = [...session.waiting];
  for (const it of fresh) {
    rank[it.key] = it.rank ?? Infinity;
    if (it.at > at) waiting.push({ key: it.key, at: it.at });
    else { kind[it.key] = it.learning ? 'learn' : 'review'; queue.push(it.key); }
  }
  return { ...session, queue, waiting: waiting.sort(byAt), kind, rank, total: session.total + fresh.length, seen: [...seen, ...fresh.map((it) => it.key)] };
}

/** 쉬게 된 카드(「카드」 줄에서 끈 종류)를 줄에서 뺀다 — 채점 수 · 기록은 그대로. keep(key) = 남길 카드인가. 다시 켜면 addLevelSessionKeys로 다시 선다. */
export function dropLevelSessionKeys(session, keep) {
  if (!session) return session;
  const queue = session.queue.filter(keep), waiting = session.waiting.filter((w) => keep(w.key));
  if (queue.length === session.queue.length && waiting.length === session.waiting.length) return session;
  // 뺀 카드는 「선 적 없음」으로 돌린다 — 그 종류를 다시 켜면 다시 선다(addLevelSessionKeys).
  const dropped = new Set([...session.queue.filter((k) => !keep(k)), ...session.waiting.filter((w) => !keep(w.key)).map((w) => w.key)]);
  return { ...session, queue, waiting, seen: (session.seen || []).filter((k) => !dropped.has(k)),
    total: Math.max(0, session.total - (session.queue.length - queue.length) - (session.waiting.length - waiting.length)) };
}

export const LEVEL_SESSION_ORDERS = Object.freeze(['mix', 'new-first', 'review-first']);
const studyOpts = ({ order = 'mix' } = {}) => ({ order: LEVEL_SESSION_ORDERS.includes(order) ? order : 'mix' });
const sameOpts = (a, b) => !!a && !!b && a.order === b.order;

/** ② 줄 짜기 — reviews · fresh는 각자 차례대로(복습 = 목록 순 · 새 단어 = 목록 순)를 순서 옵션대로 합친다. */
export function arrangeLine(reviews, fresh, { order = 'mix' } = {}) {
  return order === 'new-first' ? [...fresh, ...reviews] : order === 'review-first' ? [...reviews, ...fresh] : intersperseNew(reviews, fresh);
}

/**
 * 옵션을 바꾼 뒤 — 아직 채점하지 않은 몫(줄)만 다시 짠다. 배우는 중인 카드(learn)는 맨 앞 그대로, 복습 · 새 단어는 처음 차례(rank)로 모아
 * arrangeLine. pin = 지금 보고 있는 카드(②에 있으면 ② 맨 앞에 남긴다 — 보던 카드가 옵션을 바꿨다고 사라지지 않게, 되돌리기로 돌아온 카드 포함).
 * 채점 수 · 누른 횟수 · history · 기다리는 카드는 그대로. 옵션이 같으면 그대로 돌려준다(되돌리기 · 실패 복구가 부른다).
 * newCap(하루 새 단어 수를 바꿈 — LEVEL-WAIT-001) = 지금부터 줄에 세울 새 단어 수(남은 몫 · 제한 없음은 Infinity). 줄의 새 단어와 held를
 * 처음 차례로 모아 앞 newCap장만 줄에, 나머지는 held로 — 보던 새 단어(pin)는 몫 한 장으로 세고 남긴다. keepNew = 그사이 다른 곳에서
 * 채점한 held 단어는 건너뛴다(「새 단어 N개 더」와 같은 거르기). newCap이 없으면 held는 그대로(순서만 바꿀 때).
 */
export function arrangeLevelSession(session, options, { pin = null, newCap, keepNew = () => true } = {}) {
  if (!session) return session;
  const opts = studyOpts(options);
  const capping = newCap !== undefined && newCap !== null;
  if (!capping && sameOpts(session.opts, opts)) return session;
  const kind = session.kind || {}, rank = session.rank || {};
  const pool = session.queue;
  const byRank = (a, b) => (rank[a] ?? Infinity) - (rank[b] ?? Infinity);
  const learn = pool.filter((k) => kind[k] === 'learn');
  const reviews = pool.filter((k) => kind[k] !== 'learn' && kind[k] !== 'new').sort(byRank);
  const lined = pool.filter((k) => kind[k] === 'new');
  const pinned = pin && !learn.includes(pin) && pool.includes(pin) ? pin : null;
  let fresh = lined.filter((k) => k !== pinned).sort(byRank);
  let held = session.held || [];
  let total = session.total;
  if (capping) {
    const all = [...fresh, ...held.filter(keepNew)].sort(byRank);
    const room = Math.max(0, (Number.isFinite(newCap) ? Math.floor(newCap) : all.length + 1) - (pinned && kind[pinned] === 'new' ? 1 : 0));
    fresh = all.slice(0, room);
    held = all.slice(room);
    total += fresh.length + (pinned && kind[pinned] === 'new' ? 1 : 0) - lined.length;
  }
  const line = arrangeLine(reviews.filter((k) => k !== pinned), fresh, { order: opts.order });
  return { ...session, queue: [...learn, ...(pinned ? [pinned] : []), ...line], held, total, opts };
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
/**
 * 미리 학습(LEARN-AHEAD-001 · 오너 승인 2026-11-01 KST — Anki 「learn ahead limit」 20분) — 지금 채점할 줄(① + ②)이 비었을 때만,
 * 기다리는 카드(③) 중 지금 미리 물을 수 있는 것(canAhead(key) — 20분 안의 학습 · 재학습 단계 카드, 화면이 levelWordStatus learnAheadable로 판정)을
 * 남은 시간 짧은 순으로. 줄에 채점할 카드가 남아 있으면 빈 줄 — 그동안은 지금처럼 차례가 온 카드만(60초 창은 그대로).
 */
// 방금 채점한 카드(session.last — 「다시」 1분)가 가장 이르더라도 다른 미리 학습 카드가 있으면 한 칸 뒤로 — 답을 막 본 카드를 곧바로 다시
// 묻지 않는다(오너 확인 2026-11-01 KST 권장안 · Anki는 기한 순 그대로라 바로 다시 나온다 — 부분 채택). 그 카드 하나뿐이면 그대로 묻는다.
export const sessionAhead = (session, at = Date.now(), canAhead = () => false) => {
  if (sessionOrder(session, at).length) return [];
  const keys = sessionWaiting(session, at).filter((w) => canAhead(w.key)).map((w) => w.key);
  return keys.length > 1 && keys[0] === session?.last ? [keys[1], keys[0], ...keys.slice(2)] : keys;
};
/** 지금 채점할 차례인 줄(① + ②). */
export const sessionOrder = (session, at = Date.now()) => [...sessionDue(session, at), ...(session?.queue || [])];
/** 다음에 시간이 될 시각 — 화면이 그때 다시 그린다. 없으면 null. */
export const sessionNextAt = (session, at = Date.now()) => sessionWaiting(session, at)[0]?.at ?? null;
/** 지금 카드(한 단어 모드) — 줄 맨 앞, 기다리는 카드만 남았으면 가장 먼저 될 카드를 앞당겨. */
export const sessionCurrent = (session, at = Date.now()) => sessionOrder(session, at)[0] ?? session?.waiting?.[0]?.key ?? null;
export const sessionDone = (session) => !!session && session.queue.length === 0 && session.waiting.length === 0;
export const sessionHas = (session, key) => !!session && (session.queue.includes(key) || session.waiting.some((w) => w.key === key));

const without = (session, key) => ({ queue: session.queue.filter((k) => k !== key), waiting: session.waiting.filter((w) => w.key !== key),
  held: (session.held || []).filter((k) => k !== key) });

/**
 * 카드 하나 채점 — 줄 어디에 있든(리스트는 아무 카드나 누를 수 있다). againAt = 다음 차례가 오늘 안이면 그 시각(ms), 아니면 null.
 * 줄 밖 카드(다음에 볼 단어)도 다시 오늘 안으로 오면 기다리는 카드로 들어온다.
 */
export function gradeLevelSession(session, key, rating, againAt = null) {
  if (!session || ![1, 2, 3, 4].includes(rating)) return session;
  const inLine = sessionHas(session, key);
  if (!inLine && !againAt) return session;
  const { queue, waiting, held } = without(session, key);
  const { history, ...prev } = session;
  return { ...session, queue, held, waiting: againAt ? [...waiting, { key, at: againAt }].sort(byAt) : waiting,
    graded: session.graded + 1, counts: { ...session.counts, [rating]: session.counts[rating] + 1 }, history: [...history.slice(-19), prev], last: key };
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

