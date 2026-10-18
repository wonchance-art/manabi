// 단어 목록 바퀴 답(LEVEL-ROUND-001 — 설계 「단어장 여러 바퀴」 2판 1번 · H 계약, 오너 「구현 개시」 2026-10-19 KST).
// 목록의 O · X를 상태(아는 단어 · 공부 중 · 탭 표시)와 별도로 「이번 바퀴의 답」으로도 한 건씩 남긴다 — review_events source 'level'.
// 바퀴 답은 활동 기록일 뿐이다: FSRS 일정 · 정답률 · 다이얼에 닿지 않는다(ACTIVITY_ONLY_SOURCES, Anki 필터 덱 선례).
// 기록 규칙은 한자 탭(hanziSession)과 같다: 답은 곧바로 쓰지 않고 「대기」로 들고 있다가 다른 카드의 답 · 화면을 떠날 때 확정한다.
// 그래서 방금 누른 O · X를 다시 눌러 취소하면 기록이 늘지 않는다. 확정 뒤의 취소만 취소 줄(detail.cancel)을 남긴다(표는 append-only).
import { kstDayStartMs } from './growthStats';
import { normalizeKnownWord } from './knownWordControl';

export const LEVEL_SOURCE = 'level';

export const levelAnswerKey = (word, view) => `${normalizeKnownWord(word)}|${view}`;
const keyOf = levelAnswerKey;

/**
 * 같은 날 규칙 — 같은 KST 날 다른 보기에서 이미 답한 단어의 답은 sameDay(설계 B · 「같은 날 다른 탭의 O」).
 * 단기 기억으로 누른 O일 수 있어 「잊은 수 · 졸업 · 탭 완료 · 아는 단어로?」에서 세지 않는다. 막지는 않는다.
 * @param {Map<string, {correct: boolean, at: number}>} answers lastLevelAnswers 결과(+ 이 화면에서 누른 답)
 */
export function isSameDayAnswer(answers, word, view, nowMs = Date.now()) {
  const day = kstDayStartMs(nowMs);
  const head = `${normalizeKnownWord(word)}|`;
  for (const [key, answer] of answers || []) {
    if (!key.startsWith(head) || key === head + view) continue;
    if (Number.isFinite(answer?.at) && kstDayStartMs(answer.at) === day) return true;
  }
  return false;
}

/**
 * 단어 · 보기마다 **마지막** 바퀴 답. rows는 최신 순(created_at desc)이어야 한다. 취소 줄이 마지막이면 답 없음.
 * @returns {Map<string, {correct: boolean, at: number, sameDay: boolean}>} 키 = `${단어}|${보기}`
 */
export function lastLevelAnswers(rows) {
  const seen = new Set();
  const answers = new Map();
  for (const r of rows || []) {
    const view = r?.detail?.view;
    if (!r?.item_key || !view || typeof r.correct !== 'boolean') continue;
    const key = keyOf(r.item_key, view);
    if (seen.has(key)) continue;
    seen.add(key);
    if (r.detail.cancel) continue;
    answers.set(key, { correct: r.correct, at: Date.parse(r.created_at), sameDay: r.detail.sameDay === true });
  }
  return answers;
}

export const levelAnswerOf = (answers, word, view) => answers?.get(keyOf(word, view)) || null;

/**
 * 이 레벨의 바퀴 답 전부(최신 순) — 1,000행 페이지로 끝까지(REVIEW-ROWS-CAP-001: PostgREST는 1000행에서 말없이 자른다).
 * untilIso로 상한을 고정해 읽는 사이 새 기록이 페이지를 밀지 않게 한다. 오류면 reject.
 */
export async function fetchLevelAnswers(client, userId, { lang, level, page = 1000, untilIso = new Date().toISOString() }) {
  const rows = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await client.from('review_events').select('id, item_key, correct, detail, created_at')
      .eq('user_id', userId).eq('source', LEVEL_SOURCE).eq('lang', lang).eq('detail->>level', level)
      .lte('created_at', untilIso)
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(from, from + page - 1);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('level_answers_unavailable');
    rows.push(...data);
    if (data.length < page) return rows;
  }
}

/** 기록할 이벤트 한 건. 1판은 바퀴 표가 없어 지금까지의 답이 모두 1바퀴다(설계 B 「바퀴 줄이 없으면 1바퀴」). */
export function levelAnswerEvent({ lang, word, level, view, correct, sameDay = false, round = 1, at = Date.now() }) {
  return { lang, source: LEVEL_SOURCE, item_key: word, correct, created_at: new Date(at).toISOString(),
    detail: { level, view, round, sameDay } };
}

/** 확정된 답을 취소하는 줄 — 마지막 줄이 이것이면 그 단어 · 보기는 답 없음(lastLevelAnswers). */
export function levelCancelEvent({ lang, word, level, view, round = 1, at = Date.now() }) {
  return { lang, source: LEVEL_SOURCE, item_key: word, correct: false, created_at: new Date(at).toISOString(),
    detail: { level, view, round, cancel: true } };
}

/**
 * 대기 → 확정 큐. 대기는 한 건뿐이다: 다른 단어 · 보기의 답이 오면 앞의 대기를 확정(write)한다.
 * cancel(key)은 그 답이 아직 대기 중이면 지우고 true(쓸 것 없음), 이미 확정됐으면 false(부르는 쪽이 취소 줄을 쓴다).
 */
export function createLevelAnswerQueue(write) {
  let pending = null; // { key, event }
  return {
    answer(word, view, event) {
      const key = keyOf(word, view);
      if (pending && pending.key !== key) write(pending.event);
      pending = { key, event };
    },
    cancel(word, view) {
      if (pending?.key !== keyOf(word, view)) return false;
      pending = null;
      return true;
    },
    flush() {
      if (!pending) return;
      const { event } = pending;
      pending = null;
      write(event);
    },
    get pending() { return pending?.event || null; },
  };
}

/** 이 화면의 답을 Map에 반영(낙관적) — 답이면 넣고, 취소면 뺀다. */
export function applyLevelAnswer(answers, word, view, answer) {
  const next = new Map(answers);
  if (answer) next.set(keyOf(word, view), answer); else next.delete(keyOf(word, view));
  return next;
}
