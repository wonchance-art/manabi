/**
 * 망각 예보(Forgetting Forecast) — 순수함수. 기획 v3 §3-A(docs/plan-v3-living-serial.md).
 *
 * FSRS retrievability(R, "지금 이 단어를 기억하고 있을 확률")를 계산해
 * "오늘 안에 70% 아래로 떨어지는 단어"를 뽑아낸다. 죄책감 프레임 금지 —
 * 퍼센트 숫자·"밀림"·"실패" 같은 표현은 이 모듈이 아니라 위젯(UI) 레이어의
 * 책임이다(이 파일은 숫자만 계산하고 카피는 만들지 않는다).
 *
 * FSRS 필드 매핑 (src/lib/fsrs.js와 동일한 user_vocabulary 스키마):
 *   interval         → stability (S, 일 단위)
 *   last_reviewed_at → 마지막 복습 시각(실측 컬럼 — src/lib/fsrs.js의 toCard()가
 *                       due-S로 근사하는 것과 달리 여기선 진짜 값을 그대로 쓴다.
 *                       신규/미학습 판정도 이 컬럼 기준이다 — src/lib/vocabStudy.js의
 *                       isNewWord()와 동일 관례: last_reviewed_at 없으면 학습 이력 없음)
 * next_review_at/ease_factor/repetitions는 여기서 쓰지 않는다 — retrievability는
 * "마지막 복습 이후 며칠 지났는가(elapsed) × stability"만으로 결정된다.
 *
 * retrievability 계산 — ts-fsrs가 export하는 forgetting_curve(w, elapsed_days, S)를
 * 그대로 쓴다(공식: R = (1 + FACTOR·t/S)^DECAY). src/lib/fsrs.js의 scheduler(= fsrs())가
 * 파라미터를 커스터마이즈하지 않으므로 generatorParameters()의 기본 w 배열이 정확히
 * 같은 decay/factor를 준다 — Card.get_retrievability()가 내부적으로 호출하는 것과
 * 동일한 공식을 Card 객체 없이 직접 쓴 것뿐이다(우리는 last_reviewed_at을 이미
 * 갖고 있어 Card로 왕복 변환할 필요가 없다).
 *
 * "오늘 자정"은 사용자 로컬 자정 계산 비용을 피해 now + 24h로 단순화한다
 * (기획 문서가 허용한 단순화 — 예보는 "오늘 안에 붙잡아야 하는가"라는 방향성이
 * 중요하지, 자정 경계의 정밀도가 중요하지 않다).
 *
 * 순수함수: Date는 인자로 받는다(테스트 가능성 — src/lib/__tests__/forecast.test.js).
 * 읽기 전용: 이 모듈은 FSRS 상태를 계산만 하고 절대 쓰지 않는다.
 */

import { forgetting_curve, generatorParameters } from 'ts-fsrs';

const DAY_MS = 24 * 60 * 60 * 1000;

// "오늘 안개 예보"의 기준선. 이 아래로 떨어지면 위젯 대상.
export const RETRIEVABILITY_THRESHOLD = 0.7;

// 대표로 실명 지목할 단어 수(top3 = 손실 회피 극대화용 상위 stability).
const TOP_N = 3;

// src/lib/fsrs.js의 scheduler(= fsrs())와 동일한 기본 파라미터(커스텀 미적용).
// 한 번만 계산해 재사용.
const DEFAULT_W = generatorParameters().w;

// 학습 이력 있는 행만 대상 — 신규 저장만 된 행(interval 0 또는 last_reviewed_at 없음)은 제외.
function hasReviewHistory(row) {
  return !!row && typeof row.interval === 'number' && row.interval > 0 && !!row.last_reviewed_at;
}

// atTs 시점의 retrievability. 계산 불가(잘못된 날짜 등)면 null.
function retrievabilityAt(row, atTs) {
  const stability = Math.max(0.01, row.interval);
  const lastReviewTs = new Date(row.last_reviewed_at).getTime();
  if (!Number.isFinite(lastReviewTs)) return null;
  const elapsedDays = Math.max(0, (atTs - lastReviewTs) / DAY_MS);
  return forgetting_curve(DEFAULT_W, elapsedDays, stability);
}

/**
 * @param {Array<{word_text: string, interval: number, last_reviewed_at: string|null}>} rows
 *   user_vocabulary 행(현재 학습 언어로 이미 필터링된 것을 권장 — 언어 필터는 쿼리 레벨 책임).
 * @param {Date} now - 기준 시각(테스트 가능성을 위해 주입).
 * @returns {{
 *   falling: Array<{word_text: string, retrievabilityNow: number, retrievabilityEndOfDay: number}>,
 *   count: number,
 *   top3: Array<{word_text: string, retrievabilityNow: number, retrievabilityEndOfDay: number}>,
 * }}
 */
export function buildForecast(rows, now) {
  const nowTs = now.getTime();
  const endOfDayTs = nowTs + DAY_MS;

  // stability는 top3 정렬에만 쓰고 falling/top3 출력 항목에는 노출하지 않는다.
  const candidates = [];
  for (const row of rows || []) {
    if (!hasReviewHistory(row)) continue;

    const retrievabilityNow = retrievabilityAt(row, nowTs);
    const retrievabilityEndOfDay = retrievabilityAt(row, endOfDayTs);
    if (retrievabilityNow == null || retrievabilityEndOfDay == null) continue;

    // falling = 지금은 ≥70%인데 오늘 자정엔 70% 아래로 떨어지는 단어.
    // 이미 70% 미만인 행은 제외(이미 안개 속 — due 큐가 담당할 몫이라 예보 대상이 아님).
    if (retrievabilityNow >= RETRIEVABILITY_THRESHOLD && retrievabilityEndOfDay < RETRIEVABILITY_THRESHOLD) {
      candidates.push({
        word_text: row.word_text,
        retrievabilityNow,
        retrievabilityEndOfDay,
        stability: row.interval,
      });
    }
  }

  const falling = candidates.map(({ stability, ...rest }) => rest);

  // top3 = falling 중 stability(안정도) 내림차순 3개 — 잃으면 가장 아까운(손실 회피 극대화) 단어.
  const top3 = [...candidates]
    .sort((a, b) => b.stability - a.stability)
    .slice(0, TOP_N)
    .map(({ stability, ...rest }) => rest);

  return { falling, count: falling.length, top3 };
}
