// HSK 단어 페이지 — 단어 하나의 상태 · 채점 미리보기 · 진행(HSK 단어 페이지 개편, 오너 확정 2026-10-19 KST).
// 순수 모듈: 화면(LevelWordPage)과 계약 테스트가 같은 판정을 쓴다. 새 표 · 새 카운터 없음 — 단어장 행의 학습 투영
// (vocabularyLearningRead projection — 옛 일정 칸과 FSRS 카드를 한 모양으로 읽는 정본)과 아는 단어 표시만 읽는다.
//
// 상태 칸(문서 「단어 설명 형식」): ☆ 담지 않음 · 오늘(오늘 복습) · 복습(복습 중) · 졸업(졸업한 단어).
//   졸업 = 다음 복습까지 90일 이상 + 기존 「아는 단어」 표시(복습 제외 포함). 졸업한 단어도 365일 안에 돌아온다(간격 상한).
//   두 글자 이내 · 같은 폭 칸. 화면 읽기에는 온전한 말(aria).
import { calculateFSRS } from './fsrs.js';
import { SAVE_GRADES, gradeToInitialStats } from './vocabIO.js';
import { learningDay, previewFsrsRatings, schedulerTime } from './fsrsScheduler.js';

export const GRAD_DAYS = 90;
const DAY = 86400000;

export const LEVEL_WORD_STATUS = Object.freeze({
  new: Object.freeze({ id: 'new', short: '☆', label: '담기' }),
  today: Object.freeze({ id: 'today', short: '오늘', label: '오늘 복습' }),
  review: Object.freeze({ id: 'review', short: '복습', label: '복습 중' }),
  grad: Object.freeze({ id: 'grad', short: '졸업', label: '졸업한 단어' }),
});

/** 범위 ▾ — 서버 묶음(ZH_POS_GROUPS 이름) → 범위. 대명사 · 수 · 양사 · 기능어 · 표현(성어)은 기타. */
export const LEVEL_RANGES = Object.freeze(['전체', '명사', '동사', '형용사', '부사', '기타']);
export function rangeOfGroup(groupName) {
  return ['명사', '동사', '형용사', '부사'].includes(groupName) ? groupName : '기타';
}
export function entriesInRange(groups, range) {
  return (groups || []).flatMap((g) => (range === '전체' || rangeOfGroup(g.name) === range ? g.entries : []));
}

/**
 * 상태 — projection = 이 단어의 단어장 행 학습 투영(없으면 null), known = 아는 단어 표시.
 * 오늘 = 다음 복습이 오늘 학습일(04시 경계) 안. 일정이 없는 담긴 단어(막 ☆로 담음)도 오늘.
 */
export function levelWordStatus({ projection, known = false, at = Date.now() } = {}) {
  if (known) return 'grad';
  if (!projection) return 'new';
  const review = projection.review;
  if (review.known || review.excluded) return 'grad';
  const next = review.nextQuestionAt;
  if (next === null) return 'today';
  const nextMs = schedulerTime(next), now = schedulerTime(at);
  if (learningDay(nextMs) <= learningDay(now)) return 'today';
  return nextMs - now >= GRAD_DAYS * DAY ? 'grad' : 'review';
}

/** 한 번이라도 채점했는가(진행바 % — 복습 · 졸업 포함). 첫 채점과 함께 담은 단어도 센다(기억 값이 있다). */
export function levelWordGraded({ projection, known = false } = {}) {
  if (known) return true;
  if (!projection) return false;
  if (projection.review.known || projection.review.excluded) return true;
  const m = projection.memory;
  return projection.source === 'fsrs-v1' ? m.state !== 'New' : m.lastReview !== null || Number(m.stability) > 0;
}

/** 진행바 — 범위 단어 중 채점한 단어 비율(0–100 정수). 날이 바뀌어도 0으로 돌아가지 않는다. */
export function levelProgressPercent(keys, gradedOf) {
  const list = keys || [];
  if (!list.length) return 0;
  const done = list.filter((k) => gradedOf(k)).length;
  return Math.floor((done / list.length) * 100);
}

/** 자주 틀린 단어 표시 기준(설계안 D — lapses ≥ 4). */
export const HARD_LAPSES = 4;
export const lapsesOf = (projection) => Number(projection?.memory?.lapses) || 0;
/** 오래된 단어(설계안 C — 마지막 복습에서 60일 이상) — 뜻을 보고 단어를 떠올리는 반대 방향. 오늘 복습인 단어만. */
export const OLD_DAYS = 60;
export function daysSinceReview(projection, at = Date.now()) {
  const last = projection?.memory?.lastReview;
  if (!last) return null;
  return Math.floor((schedulerTime(at) - schedulerTime(last)) / DAY);
}

/** 간격 글자 — 다음 복습까지(ms). 0 이하 = 오늘, 1분 안(학습 첫 단계 30초)은 1분. */
export function intervalLabel(ms) {
  if (!Number.isFinite(ms)) return '';
  if (ms <= 0) return '오늘';
  if (ms < 3600_000) return `${Math.max(1, Math.round(ms / 60_000))}분`;
  if (ms < DAY) return `${Math.round(ms / 3600_000)}시간`;
  return `${Math.round(ms / DAY)}일`;
}

/**
 * 네 칸의 다음 간격 — 엔진마다 실제 계산과 같은 함수를 쓴다(손계산 금지).
 *   담지 않은 단어 = 담으면서 첫 채점(gradeToInitialStats — 뷰어 저장 등급과 같다)
 *   옛 일정 카드 = calculateFSRS(뷰어 인라인 복습과 같다)
 *   FSRS 카드 = previewFsrsRatings(복습실과 같다 · 카드의 학습 단계 정책) — 복습 차례가 아니면 null(채점할 수 없다).
 * 반환: { 1: { label, ms }, … } 또는 null.
 */
export function gradePreviews({ projection, row, at = Date.now() } = {}) {
  const now = schedulerTime(at);
  const out = {};
  if (!projection || !row) {
    for (const g of SAVE_GRADES) {
      const ms = schedulerTime(gradeToInitialStats(g.grade, () => new Date(now).toISOString()).next_review_at) - now;
      out[g.grade] = { label: g.grade === 1 ? '오늘' : intervalLabel(ms), ms };
    }
    return out;
  }
  if (projection.source === 'fsrs-v1') {
    if (!fsrsGradable(projection, at)) return null;
    try {
      const previews = previewFsrsRatings(fsrsCardOf(projection), new Date(now).toISOString());
      for (const g of SAVE_GRADES) {
        const ms = schedulerTime(previews[g.grade].card.due) - now;
        out[g.grade] = { label: intervalLabel(ms), ms };
      }
      return out;
    } catch { return null; }
  }
  for (const g of SAVE_GRADES) {
    const next = calculateFSRS(g.grade, { interval: row.interval ?? 0, ease_factor: row.ease_factor ?? 0,
      repetitions: row.repetitions ?? 0, next_review_at: row.next_review_at });
    const ms = schedulerTime(next.next_review_at) - Date.now();
    out[g.grade] = { label: intervalLabel(ms), ms };
  }
  return out;
}

/** FSRS 카드 원형(투영 memory → 카드). 투영은 카드 칸을 그대로 옮겨 담는다. */
function fsrsCardOf(projection) {
  const { version, state, stability, difficulty, lapses, reps, lastReview, due, revision, policyVersion, engine,
    timeZone, rolloverHour, introducedAt, step, scheduledDays, elapsedDays } = projection.memory;
  return { version, state, stability, difficulty, lapses, reps, lastReview, due, revision, policyVersion, engine,
    timeZone, rolloverHour, introducedAt, step, scheduledDays, elapsedDays };
}

/** FSRS 카드는 복습 차례(다음 질문 시각이 지남)일 때만 채점할 수 있다 — 서버 규칙(답을 가린 채 묻고, 때가 된 단어만). */
export function fsrsGradable(projection, at = Date.now()) {
  if (projection?.source !== 'fsrs-v1' || !projection.review.available) return false;
  const next = projection.review.nextQuestionAt;
  return next !== null && schedulerTime(next) <= schedulerTime(at);
}

/** 이 단어를 지금 네 칸으로 채점할 수 있는가 — 'save'(담으면서) · 'legacy' · 'fsrs' · null(지금은 못 함). */
export function gradeEngine({ projection, row, at = Date.now() } = {}) {
  if (!projection || !row) return 'save';
  if (projection.source === 'fsrs-v1') return fsrsGradable(projection, at) ? 'fsrs' : null;
  if (projection.review.known || projection.review.excluded || !projection.review.eligible) return null;
  return 'legacy';
}

/** 되돌리기 안내 글 — 「알맞음 · 2일 뒤 다시」. */
export function gradeToastText(grade, preview) {
  const g = SAVE_GRADES.find((x) => x.grade === grade);
  if (!g) return '';
  const label = preview?.label;
  if (!label) return g.label;
  return label === '오늘' ? `${g.label} · 오늘 다시` : `${g.label} · ${label} 뒤 다시`;
}
