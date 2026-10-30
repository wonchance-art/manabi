// HSK 단어 페이지 — 단어 하나의 상태 · 채점 미리보기 · 진행(HSK 단어 페이지 개편, 오너 확정 2026-10-19 KST).
// 순수 모듈: 화면(LevelWordPage)과 계약 테스트가 같은 판정을 쓴다. 새 표 · 새 카운터 없음 — 단어장 행의 학습 투영
// (vocabularyLearningRead projection — 옛 일정 칸과 FSRS 카드를 한 모양으로 읽는 정본)과 아는 단어 표시만 읽는다.
//
// 상태 칸(문서 「단어 설명 형식」): ☆ 담지 않음 · 담음(담기만 한 새 단어) · 오늘(오늘 복습) · 복습(복습 중) · 졸업(졸업한 단어).
//   졸업 = 다음 복습까지 90일 이상 + 기존 「아는 단어」 표시(복습 제외 포함). 졸업한 단어도 365일 안에 돌아온다(간격 상한).
//   두 글자 이내 · 같은 폭 칸. 화면 읽기에는 온전한 말(aria).
import { calculateVocabFSRS, vocabStepPhase } from './fsrs.js';
import { currentIndexedProjection, findIndexedVocabulary } from './vocabularyDueIndex.js';
import { projectVocabularyLearning } from './vocabularyLearningRead.js';
import { SAVE_GRADES, gradeToInitialStats } from './vocabIO.js';
import { learningDay, learningDaySpan, previewFsrsRatings, schedulerTime } from './fsrsScheduler.js';

export const GRAD_DAYS = 90;
const DAY = 86400000;

export const LEVEL_WORD_STATUS = Object.freeze({
  new: Object.freeze({ id: 'new', short: '☆', label: '담기' }),
  saved: Object.freeze({ id: 'saved', short: '담음', label: '담은 새 단어' }),
  today: Object.freeze({ id: 'today', short: '오늘', label: '오늘 복습' }),
  review: Object.freeze({ id: 'review', short: '복습', label: '복습 중' }),
  grad: Object.freeze({ id: 'grad', short: '졸업', label: '졸업한 단어' }),
});

/**
 * 상태 — projection = 이 단어의 단어장 행 학습 투영(없으면 null), known = 아는 단어 표시.
 * 담음 = 담기만 하고 한 번도 채점하지 않은 단어(LEVEL-SAVED-TAG-001 · 오너 승인 2026-10-30 KST). FSRS 카드는 New 상태 · 옛 행은
 * 채점 흔적(마지막 채점 · 간격)이 없는 행 — levelWordGraded와 같은 판정. 서버는 이 카드의 첫 문제에서 하루 새 단어 몫을 쓰는데(Anki 규칙),
 * 전에는 담은 직후의 기한(nextQuestionAt = 담은 시각)만 보고 「오늘」로 보여 몫이 다 찬 날 채점이 거절됐다(10-19 담고 10-30 채점 실측).
 * 줄 · 몫 셈에서는 새 단어와 같이 다룬다(levelWordSession). 오늘 = 다음 복습이 오늘 학습일(04시 경계) 안.
 */
export function levelWordStatus({ projection, known = false, at = Date.now() } = {}) {
  if (known) return 'grad';
  if (!projection) return 'new';
  const review = projection.review;
  if (review.known || review.excluded) return 'grad';
  if (!levelWordGraded({ projection })) return 'saved';
  const next = review.nextQuestionAt;
  if (next === null) return 'today';
  const nextMs = schedulerTime(next), now = schedulerTime(at);
  if (learningDay(nextMs) <= learningDay(now)) return 'today';
  return nextMs - now >= GRAD_DAYS * DAY ? 'grad' : 'review';
}

/**
 * 단어 키 → { row, projection } — 뷰어와 같은 단어장 색인(['vocab-words', userId])에서 찾는다.
 * 막 담은 행(색인 뒤에 들어온 행)과 채점 전송 중인 행은 색인 투영이 없다 — 옛 일정 카드로 그 행의 칸만 읽어 바로 보이게 한다
 * (새로 받기 전까지의 화면 값. 저장 · 채점은 늘 서버 정본으로).
 * key는 키 배열도 받는다 — 앞에서부터 찾는다(프랑스어 「famille」 다음 레퍼런스 페이지가 저장한 옛 꼴 「la famille」, entryKeys).
 */
/** 항목이 단어장에서 만나는 키 — 대조 키(key) 다음 옛 저장 꼴(alts — 프랑스어 관사 붙은 표제어). */
export const entryKeys = (entry) => (entry?.alts?.length ? [entry.key, ...entry.alts] : entry?.key);

export function levelRowProjection(index, key, language = 'Chinese', at = Date.now()) {
  if (!index?.byKey) return { row: null, projection: null };
  let row = null;
  for (const k of [].concat(key)) if (!row && k) row = findIndexedVocabulary(index, { text: k, base_form: k }, language);
  if (!row) return { row: null, projection: null };
  let projection = currentIndexedProjection(index, row, at);
  if (!projection && row.user_id === index.actorId) {
    const registered = index.registryById?.get(row.id);
    if (registered?.enrolled) projection = index.projectionsById.get(row.id) || null;
    else {
      const { __pendingReview, ...vocabulary } = row;
      try {
        projection = projectVocabularyLearning({ actorId: index.actorId, vocabulary, enabled: index.enabled, registryAvailable: true,
          complete: true, at: Math.max(schedulerTime(at), schedulerTime(index.now)), registry: registered || { cardId: row.id, userId: index.actorId,
            enrolled: false, card: null, known: false, excluded: false, eligible: true, nextQuestionAt: null, firstQuestionAt: null } });
      } catch { projection = null; }
    }
  }
  return { row, projection };
}

/**
 * 분 단위 학습 · 재학습 단계에 있는가(다시 1분 · 어려움 6분 · 알맞음 10분 뒤의 카드) — 단어장 세션이 이 카드를
 * 줄 맨 앞에 세운다(Anki도 지금 차례가 된 학습 단계 카드를 먼저 낸다). 옛 일정 행은 fsrs.js vocabStepPhase로 읽는다.
 */
export function inLearningStep({ projection, row } = {}) {
  if (!projection) return false;
  if (projection.source === 'fsrs-v1') return projection.memory.state === 'Learning' || projection.memory.state === 'Relearning';
  if (!row) return false;
  const state = vocabStepPhase(row).state;
  return state === 'Learning' || state === 'Relearning';
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

/** 다음 차례 시각(ms) — 투영의 nextQuestionAt. 없으면(지금 차례) 0. */
export const nextDueMs = (projection) => (projection?.review?.nextQuestionAt ? schedulerTime(projection.review.nextQuestionAt) : 0);
/** 채점 미리보기의 다음 차례가 오늘 안이면 그 시각(ms) — 오늘 할 줄에서 기다린다. 내일 이후면 null(줄에서 빠진다). */
export function todayAgainAt(preview, at = Date.now()) {
  const ms = Number(preview?.ms);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const now = schedulerTime(at), next = now + ms;
  return learningDay(next) === learningDay(now) ? next : null;
}

/** 간격 글자 — 다음 복습까지(ms). 0 이하 = 오늘, 1분 안(학습 첫 단계 30초)은 1분. */
/** 간격 → { n, unit } — 1시간 미만 분 · 하루 미만 시간 · 그 밖 일. 0 이하(지금)는 null. 뷰어는 단위별 번역 글을 고른다. */
export function intervalAmount(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  if (ms < 3600_000) return { n: Math.max(1, Math.round(ms / 60_000)), unit: '분' };
  if (ms < DAY) return { n: Math.round(ms / 3600_000), unit: '시간' };
  return { n: Math.round(ms / DAY), unit: '일' };
}
export function intervalLabel(ms) {
  if (!Number.isFinite(ms)) return '';
  return amountLabel(intervalAmount(ms));
}
const amountLabel = (a) => (a ? `${a.n}${a.unit}` : '오늘');
/**
 * 다음 차례까지 — 날 단위 기한(학습일 시작 시각, 2026-10-25 KST)은 남은 시간이 아니라 학습일 수로 센다(Anki 버튼과 같다:
 * 23:00에 누른 「1일」은 5시간 뒤 04:00에 열려도 1일). 분 단위 단계 · 그 전의 24시간 기한은 남은 시간 그대로.
 */
export function dueAmount(due, at = Date.now()) {
  const next = schedulerTime(due), now = schedulerTime(at);
  const days = learningDaySpan(next, now);
  return days ? { n: days, unit: '일' } : intervalAmount(next - now);
}
/** 접힌 「복습 예정」 카드 오른쪽 — 「1일 뒤」(펼친 카드 「2일 뒤 복습」 · 채점 칸 「8일」과 같은 계산), 날짜 없는 알아요 단어는 「졸업」. */
export function laterDueText(next, at = Date.now()) {
  if (next == null) return '졸업';
  const a = dueAmount(next, at);
  return a && schedulerTime(next) > schedulerTime(at) ? `${a.n}${a.unit} 뒤` : '오늘';
}
const previewOf = (due, now) => {
  const amount = dueAmount(due, now);
  return { label: amountLabel(amount), ms: schedulerTime(due) - now, amount };
};

/** 옛 일정 단어 행 하나의 네 칸 간격 — 단어 페이지와 뷰어 인라인 복습이 같은 계산(calculateVocabFSRS)을 쓴다. */
export function legacyGradePreviews(row, at = Date.now()) {
  if (!row) return null;
  const now = schedulerTime(at);
  const out = {};
  for (const g of SAVE_GRADES) {
    const next = calculateVocabFSRS(g.grade, { interval: row.interval ?? 0, ease_factor: row.ease_factor ?? 0,
      repetitions: row.repetitions ?? 0, next_review_at: row.next_review_at, last_reviewed_at: row.last_reviewed_at, created_at: row.created_at }, now);
    out[g.grade] = previewOf(next.next_review_at, now);
  }
  return out;
}

/**
 * 네 칸의 다음 간격 — 엔진마다 실제 계산과 같은 함수를 쓴다(손계산 금지).
 *   담지 않은 단어 = 담으면서 첫 채점(gradeToInitialStats — 뷰어 저장 등급과 같다 · 1분 · 6분 · 10분 · 8일)
 *   옛 일정 카드 = calculateVocabFSRS(뷰어 인라인 복습과 같다 · 학습 단계 anki-v2)
 *   FSRS 카드 = previewFsrsRatings(복습실과 같다 · 카드의 학습 단계 정책) — 복습 차례가 아니면 null(채점할 수 없다).
 * 반환: { 1: { label, ms, amount }, … } 또는 null — amount = dueAmount(날 단위 기한은 학습일 수).
 */
export function gradePreviews({ projection, row, at = Date.now() } = {}) {
  const now = schedulerTime(at);
  const out = {};
  if (!projection || !row) {
    for (const g of SAVE_GRADES) {
      out[g.grade] = previewOf(gradeToInitialStats(g.grade, () => new Date(now).toISOString()).next_review_at, now);
    }
    return out;
  }
  if (projection.source === 'fsrs-v1') {
    const wait = fsrsGradeWait(projection, at);
    if (wait === null) return null;
    try {
      // 곧 차례인 카드(되돌린 직후 등)는 보낼 시각 기준 미리보기 — 서버도 그 시각에 채점한다.
      const previews = previewFsrsRatings(fsrsCardOf(projection), new Date(now + wait).toISOString());
      for (const g of SAVE_GRADES) {
        out[g.grade] = previewOf(previews[g.grade].card.due, now);
      }
      return out;
    } catch { return null; }
  }
  return legacyGradePreviews(row, now);
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

/**
 * 곧 차례가 오는 FSRS 카드의 채점 대기(LEVEL-UNDO-REGRADE-001). 서버는 되돌린 카드를 30초 뒤에야 다시 묻고(next_question_at = 되돌린 시각 + 30초),
 * 1분 학습 단계 카드도 기한 전에는 묻지 않는다. 단어 페이지는 그동안 「복습 차례에만」으로 막아 되돌린 뒤 다시 채점할 수 없었다.
 * 이 창(60초) 안이면 채점을 받아 두었다가 차례가 오면 보낸다(Anki도 학습 카드는 기본 20분 일찍 답하게 한다 — learn ahead).
 * 반환 = 기다릴 ms(0 = 지금), 창 밖이면 null.
 */
export const FSRS_GRADE_WAIT_MS = 60000;
export function fsrsGradeWait(projection, at = Date.now()) {
  if (fsrsGradable(projection, at)) return 0;
  if (!fsrsGradable(projection, at + FSRS_GRADE_WAIT_MS)) return null;
  return schedulerTime(projection.review.nextQuestionAt) - schedulerTime(at);
}

/** 이 단어를 지금 네 칸으로 채점할 수 있는가 — 'save'(담으면서) · 'legacy' · 'fsrs' · null(지금은 못 함). */
export function gradeEngine({ projection, row, at = Date.now() } = {}) {
  if (!projection || !row) return 'save';
  if (projection.source === 'fsrs-v1') return fsrsGradeWait(projection, at) !== null ? 'fsrs' : null;
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

/** 끝 화면 「내일」 — 다음 복습이 내일 학습일(04시 경계)인 단어 수. */
/**
 * 오늘 새로 시작한 단어 수 — 그 언어의 단어장 행 중 오늘 학습일(04시 경계)에 생겼고 채점한 것.
 * 레벨 단어 페이지의 하루 새 단어 한도(복습 설정의 하루 새 단어 수)에서 뺀다 — 레벨을 옮기거나 다시 열어도 같은 하루 몫.
 * 서버 몫(levelDailyLoad levelNewSlots)을 읽지 못한 때(호환 모드 · 실패)의 기기 셈이다 — 전에 담고 오늘 처음 공부한 단어는 세지 못한다.
 * 뷰어에서 등급과 함께 담은 단어도 센다(같은 하루 몫). ☆로만 담은 단어는 채점 흔적이 없어 세지 않는다.
 */
export function newStartedToday(index, language, at = Date.now()) {
  if (!index?.byKey) return 0;
  const today = learningDay(schedulerTime(at));
  const seen = new Set();
  let n = 0;
  for (const row of index.byKey.values()) {
    if (!row?.id || seen.has(row.id)) continue;
    seen.add(row.id);
    const born = row.language === language ? Date.parse(row.created_at) : NaN; // DB 시각은 마이크로초까지라 schedulerTime 대신
    if (!Number.isFinite(born)) continue;
    // ☆ · 원탭 담기도 next_review_at = 담은 시각을 싣는다(buildVocabRow) — 일정 칸이 아니라 채점 흔적(안정도 · 마지막 채점)으로 센다.
    const p = index.projectionsById?.get(row.id);
    const graded = Number(row.interval) > 0 || !!row.last_reviewed_at || (p?.source === 'fsrs-v1' && !!p.review?.nextQuestionAt);
    if (graded && learningDay(born) === today) n += 1;
  }
  return n;
}

export function dueTomorrowCount(projections, at = Date.now()) {
  const tomorrow = learningDay(schedulerTime(at)) + 1;
  let n = 0;
  for (const p of projections || []) {
    const next = p?.review?.available ? p.review.nextQuestionAt : null;
    if (next !== null && next !== undefined && learningDay(schedulerTime(next)) === tomorrow) n += 1;
  }
  return n;
}
