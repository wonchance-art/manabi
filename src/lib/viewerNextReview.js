// 단어창 하단 저장 줄의 「다음 복습 {날짜}」(VIEWER-V2-ROUNDS-001 §2 하단 · AE-R1 설계서 §3.1) — 순수 함수.
// 날짜는 학습 모델과 같은 달력이다: KST(Asia/Seoul) + 04시 경계(learningDay, FSRS_POLICY) — 새벽 2시에
// 돌아오는 카드는 「그 전날 학습일」의 복습이다. 사람이 읽는 표기는 KST 고정(CLAUDE.md 2026-08-28).
// 표기는 기존 관례 `${월}월 ${일}일`(ProfileStats)이고, 해가 다르면 연도를 붙인다.
// PR ①에서는 화면에 연결하지 않는다.

import { indexedVocabularyNextReview } from './vocabularyDueIndex.js';
import { FSRS_POLICY, learningDay } from './fsrsScheduler.js';

const DAY = 86400000;

function calendarOf(day) {
  const d = new Date(day * DAY);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, date: d.getUTCDate() };
}

/**
 * 다음 복습 시각 → 표시용 날짜.
 * @param {string|null} nextAt ISO 시각(projection.review.nextQuestionAt)
 * @param {{at?:number|string|Date, locale?:string}} options locale = 'ko'(기본) · 'zh-CN' · 'zh-TW'
 * @returns {{label:string, year:number, month:number, date:number, daysAway:number, due:boolean}|null}
 *   daysAway = 오늘 학습일과의 차(0 = 오늘, 음수 = 지난 날), due = 시각이 이미 지났는가.
 */
export function formatNextReviewDate(nextAt, { at = Date.now(), locale = 'ko' } = {}) {
  if (!nextAt) return null;
  let target, today, due;
  try {
    target = learningDay(nextAt, FSRS_POLICY.timeZone, FSRS_POLICY.rolloverHour);
    today = learningDay(at instanceof Date ? at.getTime() : at, FSRS_POLICY.timeZone, FSRS_POLICY.rolloverHour);
    due = new Date(nextAt).getTime() <= new Date(at).getTime();
  } catch { return null; }
  const { year, month, date } = calendarOf(target);
  const sameYear = calendarOf(today).year === year;
  const zh = /^zh/i.test(locale);
  const label = zh
    ? `${sameYear ? '' : `${year}年`}${month}月${date}日`
    : `${sameYear ? '' : `${year}년 `}${month}월 ${date}일`;
  return { label, year, month, date, daysAway: target - today, due };
}

/**
 * savedWords(useQuery 'vocab-words' 인덱스)와 저장 행 → 다음 복습 표시값. 추가 조회 없음.
 * @returns {{label, year, month, date, daysAway, due, at, source}|null}
 */
export function nextReviewForSavedWord(savedWords, row, { at = Date.now(), locale = 'ko' } = {}) {
  const next = indexedVocabularyNextReview(savedWords, row, { at });
  if (!next) return null;
  const formatted = formatNextReviewDate(next.at, { at, locale });
  return formatted && { ...formatted, due: next.due, at: next.at, source: next.source };
}
