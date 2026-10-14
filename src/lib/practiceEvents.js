// 집중 연습 기록(REV-SCOPE-R1B-1 — 오너 승인 3판 D2, 설계 §2-1 증거 모델 · §6-1 ④⑤).
//
// 집중 연습은 일정(FSRS · 예전 일정)과 새 표현 한도를 건드리지 않는다. 남기는 것은 review_events 한 줄뿐:
//   { source:'practice', item_key: 단어 id, correct, detail:{ qtype, scope, result } }
// - source에 CHECK가 없어 스키마 변경이 필요 없다(20260701000100_grammar_review.sql:47).
// - detail에 word_id를 넣지 않는다: DB의 fsrs_private.guard_legacy_event는 detail.word_id가 FSRS 카드면
//   source와 무관하게 막는다(M09 fixture). 예전 일정 · 새 일정 카드 모두 연습 기록이 막히지 않게 단어 id는
//   item_key에만 둔다. guard_excluded_review_event는 source='vocab'만 본다.
//
// 읽는 곳 표(§6-1 ⑤) — 기본은 모든 기존 읽는 곳에서 제외, 아래만 포함:
//   · 숙련 사다리 · 난이도(skillRung · EWMA) — 정답이 정해진 문항(choice · cloze · typing · listening)만, self 제외
//   · 헷갈린 표현 · 약점(confusedQueue · 약점 계산) — 「몰랐어요」 · 오답(정답이 정해진 문항은 정답도 분모로)
//   · 흐릿 범위(state=fragile) — 지난 14일 연습에서 「몰랐어요」 · 오답을 받은 표현
// 그 밖(주간 리포트 · 복습 수 · 히트맵 · 알림 · 관리자 지표 · 산출 단어 …)은 제외 — isGradedReviewEvent가 거른다.

export const PRACTICE_SOURCE = 'practice';
export const PRACTICE_QTYPES = Object.freeze(['self', 'choice', 'cloze', 'typing', 'listening']);
/** 정답이 정해진 문항 — 숙련 사다리 · 난이도 다이얼에 들어간다. self(자기 채점)는 빠진다. */
export const PRACTICE_GRADED_QTYPES = Object.freeze(['choice', 'cloze', 'typing', 'listening']);
/** result: self = known | unknown(몰랐어요), 정답이 정해진 문항 = correct | wrong. */
export const PRACTICE_RESULTS = Object.freeze({ self: ['known', 'unknown'], graded: ['correct', 'wrong'] });
export const PRACTICE_FRAGILE_DAYS = 14;

export const isPracticeEvent = event => event?.source === PRACTICE_SOURCE;
const gradedQtype = event => PRACTICE_GRADED_QTYPES.includes(event?.detail?.qtype);
const negative = event => event?.detail?.result === 'unknown' || event?.detail?.result === 'wrong';

/**
 * 연습 결과 → review_events 한 줄(logReviewEvents 입력). word = user_vocabulary 행, scope = 범위 주소 문자열.
 * 잘못된 qtype · result는 기록하지 않는다(null).
 */
export function buildPracticeEvent({ word, qtype, scope, result }) {
  if (!word?.id || !PRACTICE_QTYPES.includes(qtype)) return null;
  const allowed = qtype === 'self' ? PRACTICE_RESULTS.self : PRACTICE_RESULTS.graded;
  if (!allowed.includes(result)) return null;
  return {
    lang: word.language || 'unknown',
    source: PRACTICE_SOURCE,
    item_key: String(word.id),
    correct: result === 'known' || result === 'correct',
    detail: { qtype, scope: String(scope || ''), result },
  };
}

/** 숙련 사다리(deriveVocabRungs) · 난이도 다이얼(EWMA)에 들어가는 연습 기록인가 — 정답이 정해진 문항만. */
export const countsForSkillLadder = event => isPracticeEvent(event) && gradedQtype(event);

/** 난이도 다이얼 표본 — 기존 규칙(ui · dict 제외) + 연습 self 제외. */
export const countsForDifficulty = event => !!event && event.source !== 'ui' && event.source !== 'dict'
  && (!isPracticeEvent(event) || gradedQtype(event));

/**
 * 헷갈린 표현 · 약점 계산용 — 연습 기록을 그 단어의 vocab 이벤트 모양(item_key = word_text)으로 옮긴다.
 * 「몰랐어요」는 오답으로, 정답이 정해진 문항은 정오 그대로. 「알았어요」(자기 채점 성공)는 신뢰하지 않아
 * 넣지 않는다(skillRung이 플래시 성공을 무시하는 것과 같은 이유). 단어를 찾지 못하면(지운 단어) 버린다.
 * 연습이 아닌 이벤트는 그대로 둔다.
 */
export function practiceAsWeaknessEvents(events, vocabRows) {
  const byId = new Map((vocabRows || []).map(row => [String(row.id), row]));
  const out = [];
  for (const event of events || []) {
    if (!isPracticeEvent(event)) { out.push(event); continue; }
    if (!gradedQtype(event) && !negative(event)) continue;
    const word = byId.get(String(event.item_key));
    if (!word?.word_text) continue;
    out.push({ ...event, source: 'vocab', item_key: word.word_text, correct: !negative(event) && event.correct === true,
      detail: { qtype: event.detail?.qtype, practice: true } });
  }
  return out;
}

/** 흐릿 범위에 더할 단어 id — 지난 14일 연습에서 「몰랐어요」 · 오답을 받은 표현. */
export function practiceFragileIds(events, { now = Date.now(), days = PRACTICE_FRAGILE_DAYS } = {}) {
  const since = now - days * 86400000;
  const ids = new Set();
  for (const event of events || []) {
    if (!isPracticeEvent(event) || !negative(event)) continue;
    const at = Date.parse(event.created_at);
    if (Number.isFinite(at) && at >= since) ids.add(String(event.item_key));
  }
  return ids;
}
