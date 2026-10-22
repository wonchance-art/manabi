// 단어 페이지(HSK · JLPT)의 오늘 할 줄 — 한 단어 모드와 리스트 모드가 같은 줄을 쓴다(오너 확정 2026-10-19 KST · 문서 「한 단어 모드」 · 「리스트 모드」).
// 순수 상태 — 화면은 이 함수들의 결과만 그린다. 기록은 채점 길(뷰어 · 복습실 정본)이 하고, 여기는 순서만 정한다.
//
// 줄 순서: ① 시간이 된 카드(기다리다 차례가 온 카드, 먼저 된 것부터) ② 오늘 복습 · 담지 않은 새 단어(목록 순) ③ 기다리는 카드(남은 시간 짧은 순).
// 채점해서 다음 차례가 오늘 안(다시 1분 · 어려움 6분 …)이면 그 시각까지 ③에서 기다리고, 내일 이후면 줄에서 빠진다.
// 줄에 기다리는 카드만 남으면 한 단어 모드는 가장 먼저 될 카드를 앞당겨 이어간다. 둘 다 비면 끝(「오늘 이 레벨 끝」).
// 되돌리기는 직전 상태로 — 화면이 기록 되돌리기와 같이 부른다.
// 하루 새 단어(시안 ⑦-1 추천 · 2026-10-21 KST): ② 중 담지 않은 새 단어는 newCap개까지만 줄에 서고 나머지는 held에 남는다.
// 줄이 비면 끝 화면이 「새 단어 N개 더」로 held에서 꺼낸다(막지 않는다). 복습할 때가 된 카드는 한도와 상관없이 다 선다.

const byAt = (a, b) => a.at - b.at;

/**
 * 세션 시작 — entries = 범위 단어(목록 순), statusOf(key) = 'new' | 'today' | 'review' | 'grad',
 * dueAtOf(key) = 다음 차례 시각(ms, 없으면 0). 오늘 복습인데 아직 시각이 안 된 카드(오늘 앞서 채점한 카드)는 기다리는 카드로.
 */
export function startLevelSession(entries, statusOf, dueAtOf = () => 0, at = Date.now(), { newCap = Infinity } = {}) {
  const today = [], fresh = [], waiting = [];
  for (const e of entries || []) {
    const s = statusOf(e.key);
    if (s === 'today') {
      const due = Number(dueAtOf(e.key)) || 0;
      if (due > at) waiting.push({ key: e.key, at: due }); else today.push(e.key);
    } else if (s === 'new') fresh.push(e.key);
  }
  waiting.sort(byAt);
  const cap = Math.max(0, Math.min(fresh.length, newCap));
  return { queue: [...today, ...fresh.slice(0, cap)], held: fresh.slice(cap), waiting, graded: 0, counts: { 1: 0, 2: 0, 3: 0, 4: 0 }, history: [],
    total: today.length + cap + waiting.length };
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
