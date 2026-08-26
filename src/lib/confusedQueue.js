// ⚔ 헷갈린 단어 재대결 큐 (#1077-15, 오너 승인 2026-08-26) — 순수 선택 모듈.
//
// 집계는 skillRung.computeWeakness **정본만** 쓴다(신규 카운터 금지 — Anki leech 카운터를
// 배제한 이유가 review_events 원장이 더 풍부하다는 것이었다). 주간 약점 세션
// (studyMaterials.buildWeaknessMaterials)과 같은 14일 창·같은 점수라, 이 큐는 새 기능이
// 아니라 **같은 엔진의 상시 진입점**이다 — 일요일을 기다리지 않고 아무 때나 연다.
//
// 이음새(승인된 처리): 배너·선택은 조회만 하고 아무것도 기록하지 않는다. 재대결 채점은
// 기존 복습 세션 경로(recordReviewCompleted → review_events + FSRS)를 그대로 타므로,
// 여기서 맞히면 약점 점수가 내려가 일요일 약점 세션에서 **자연히 빠진다** — 별도 dedup
// 로직이 없는 이유다(공유 원장이 곧 dedup). 약점 '세션' 행(study_paragraphs) 생성은
// 여전히 /study 단독 소유.

import { computeWeakness } from './skillRung';

/** 집계 창 — 주간 약점 세션과 같은 14일(두 화면이 같은 '헷갈림'을 말해야 한다). */
export const CONFUSED_SINCE_DAYS = 14;
/** 큐 상한 — 재대결은 집중 세션이라 짧게 끊는다(목업 "헷갈린 말 12개"). */
export const CONFUSED_CAP = 12;
/** 배너 노출 최소 — 1개로 '재대결'을 띄우면 호들갑이다(약점 세션 최소 2와 같은 결). */
export const CONFUSED_MIN = 2;

/**
 * 최근 오답 가중 상위 단어 → 단어장 행으로.
 * @param {Array<{source, item_key, correct, created_at}>} events - review_events(최근분)
 * @param {Array<{word_text}>} vocabRows - user_vocabulary 행(호출 화면이 이미 든 것 재사용)
 * @param {{now?: number, cap?: number}} opts
 * @returns {Array<{word: object, wrong: number, total: number, score: number}>}
 */
export function confusedVocabWords(events, vocabRows, { now = Date.now(), cap = CONFUSED_CAP } = {}) {
  // vocab 소스만 — grammar·ui 이벤트가 cap 자리를 먹지 않게 집계 전에 거른다.
  const vocabEvents = (events || []).filter((e) => e?.source === 'vocab');
  const sinceMs = now - CONFUSED_SINCE_DAYS * 86400000;
  const weak = computeWeakness(vocabEvents, { sinceMs, cap }).filter((w) => w.wrong > 0);
  // item_key = word_text 매핑(buildWeaknessMaterials 선례) — 삭제된 단어는 자연 탈락.
  const byText = new Map((vocabRows || []).map((v) => [v.word_text, v]));
  return weak
    .map((w) => ({ word: byText.get(w.item_key), wrong: w.wrong, total: w.total, score: w.score }))
    .filter((c) => c.word);
}
