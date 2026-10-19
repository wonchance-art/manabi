// HSK 단어 페이지 · 한 단어 모드의 세션 줄(오너 확정 2026-10-19 KST · 문서 「한 단어 모드」).
// 순수 상태 — 화면은 이 함수들의 결과만 그린다. 기록은 채점 길(뷰어 · 복습실 정본)이 하고, 여기는 순서만 정한다.
//
// 규칙: 범위의 오늘 볼 단어(오늘 복습 · 담지 않은 새 단어)를 줄 세운다 — 오늘 복습이 먼저, 그다음 새 단어(목록 순).
// 「다시」는 같은 세션에서 몇 장 뒤(AGAIN_GAP) 다시 나오고, 기다리는 카드만 남으면 앞당겨 바로 이어간다(줄 끝이라 곧바로).
// 줄이 비면 끝(「오늘 이 범위 끝」). 되돌리기는 직전 상태로 — 화면이 기록 되돌리기와 같이 부른다.

export const AGAIN_GAP = 3;

/** 세션 시작 — entries = 범위 단어(목록 순), statusOf(key) = 'new' | 'today' | 'review' | 'grad'. */
export function startLevelSession(entries, statusOf) {
  const today = [], fresh = [];
  for (const e of entries || []) {
    const s = statusOf(e.key);
    if (s === 'today') today.push(e.key);
    else if (s === 'new') fresh.push(e.key);
  }
  return { queue: [...today, ...fresh], graded: 0, counts: { 1: 0, 2: 0, 3: 0, 4: 0 }, history: [], total: today.length + fresh.length };
}

export const sessionCurrent = (session) => session?.queue?.[0] ?? null;
export const sessionDone = (session) => !!session && session.queue.length === 0;

/** 지금 카드 채점 — 다시면 AGAIN_GAP장 뒤로(남은 줄이 짧으면 끝으로). */
export function gradeLevelSession(session, key, rating) {
  if (!session || session.queue[0] !== key || ![1, 2, 3, 4].includes(rating)) return session;
  const rest = session.queue.slice(1);
  const queue = rating === 1 ? [...rest.slice(0, AGAIN_GAP), key, ...rest.slice(AGAIN_GAP)] : rest;
  const { history, ...prev } = session;
  return { ...session, queue, graded: session.graded + 1, counts: { ...session.counts, [rating]: session.counts[rating] + 1 },
    history: [...history.slice(-19), prev] };
}

/** 지금 카드를 채점 없이 넘긴다(지금은 채점할 수 없는 카드 — 다른 곳에서 막 채점됨 등). */
export function skipLevelSession(session, key) {
  if (!session || session.queue[0] !== key) return session;
  return { ...session, queue: session.queue.slice(1) };
}

/** 직전 채점 되돌리기 — 그 카드가 다시 맨 앞. */
export function undoLevelSession(session) {
  if (!session?.history?.length) return session;
  const prev = session.history[session.history.length - 1];
  return { ...prev, history: session.history.slice(0, -1) };
}

/**
 * 끝 화면의 「계속 진행」 — 다음 범위. 품사 범위면 다음 품사(기타 다음은 다음 레벨 전체), 전체면 다음 레벨 전체.
 * 마지막 레벨의 끝이면 null.
 */
export function nextLevelScope({ levels, levelKey, range, ranges }) {
  const order = ranges.filter((r) => r !== '전체');
  const at = order.indexOf(range);
  if (at >= 0 && at < order.length - 1) return { levelKey, range: order[at + 1] };
  const li = levels.indexOf(levelKey);
  return li >= 0 && li < levels.length - 1 ? { levelKey: levels[li + 1], range: '전체' } : null;
}
