/**
 * 어휘 숙련 사다리(rung) + EWMA 난이도 다이얼 — 순수 함수 모음.
 *
 * 숙련 사다리(어휘 전용):
 *   0 노출 전 → 1 인지(choice) → 2 회상 타이핑(typing) → 3 청각 회상(listening) → 4 산출(produce)
 *   ※ produce 문항은 D단계에서 추가되지만 알고리즘은 미리 지원한다.
 *
 * 설계 원칙(레드팀 반영):
 *  - rung은 DB 컬럼이 아니라 review_events에서 유도되는 순수 함수다.
 *  - 세션 단위 정답률 트리거는 통계 노이즈라 금지 — 난이도는 EWMA로만 조절한다.
 *  - 강등은 2연속 실패로만 일어난다.
 */

/**
 * qtype → 사다리 레벨.
 * 과거 이벤트에는 qtype이 없을 수 있으므로 누락/미지정은 보수적으로 choice(1) 취급.
 * @param {string} [qtype] - review_events detail.qtype
 * @returns {number} 1~4
 */
export function qtypeRungLevel(qtype) {
  switch (qtype) {
    case 'choice': return 1;
    case 'cloze': return 2;
    case 'typing': return 2;
    case 'listening': return 3;
    case 'produce': return 4;
    default: return 1; // 그 외/누락 — 과거 이벤트 보수 처리
  }
}

/**
 * 한 항목의 이벤트 이력으로 현재 rung을 유도한다.
 * @param {Array<{qtype?: string, correct: boolean}>} events - 시간순(오래된 것부터)
 * @returns {number} 0(노출 전)~4
 */
export function computeRung(events) {
  if (!events || !events.length) return 0;
  let r = 1;
  let upStreak = 0;
  let downStreak = 0;
  for (const ev of events) {
    const q = qtypeRungLevel(ev?.qtype);
    if (ev?.correct) {
      if (q >= r) {
        // 현재 난이도 이상에서의 성공 — 승급 크레딧
        upStreak++;
        downStreak = 0;
        if (upStreak >= 2) { r = Math.min(r + 1, 4); upStreak = 0; }
      } else {
        // 너무 쉬운 성공 — 승급 크레딧 없음, 강등만 리셋
        downStreak = 0;
      }
    } else {
      if (q <= r) {
        // 현재 난이도 이하에서의 실패 — 강등 크레딧
        downStreak++;
        upStreak = 0;
        if (downStreak >= 2) { r = Math.max(1, r - 1); downStreak = 0; }
      } else {
        // 과난도 실패 — 강등 크레딧 없음, 승급만 리셋
        upStreak = 0;
      }
    }
  }
  return r;
}

/**
 * 채점 이벤트의 correct(1/0)를 EWMA(지수가중이동평균)로 집계한다.
 * @param {Array<{correct: boolean}>} events - 시간순(오래된 것부터)
 * @param {number} [alpha=0.15] - 평활 계수
 * @returns {number|null} 이벤트 없으면 null
 */
export function computeEwma(events, alpha = 0.15) {
  if (!events || !events.length) return null;
  let ewma = null;
  for (const ev of events) {
    const x = ev?.correct ? 1 : 0;
    ewma = ewma === null ? x : alpha * x + (1 - alpha) * ewma;
  }
  return ewma;
}

/**
 * EWMA → 난이도 다이얼. 표본이 부족하면 조절하지 않는다(노이즈 방지).
 * @param {number|null} ewma
 * @param {number} [minSamples=20]
 * @param {number} sampleCount
 * @returns {'easy'|'normal'|'hard'}
 */
export function dialFromEwma(ewma, minSamples = 20, sampleCount = 0) {
  if (ewma === null || sampleCount < minSamples) return 'normal';
  if (ewma > 0.9) return 'hard';
  if (ewma < 0.75) return 'easy';
  return 'normal';
}

/**
 * rung + 다이얼 → 어휘 문항 타입.
 * 기본: rung≤1→choice, rung 2→typing, rung≥3→listening.
 * dial 'easy'→무조건 choice. dial 'hard'→한 단계 상향(choice→typing→listening, listening 유지).
 * @param {number} rung
 * @param {'easy'|'normal'|'hard'} [dial='normal']
 * @returns {'vocab-choice'|'vocab-typing'|'vocab-listening'}
 */
export function vocabTypeForRung(rung, dial = 'normal') {
  if (dial === 'easy') return 'vocab-choice';
  let base;
  if (rung <= 1) base = 'vocab-choice';
  else if (rung === 2) base = 'vocab-typing';
  else base = 'vocab-listening';
  if (dial === 'hard') {
    if (base === 'vocab-choice') return 'vocab-typing';
    if (base === 'vocab-typing') return 'vocab-listening';
    return 'vocab-listening'; // 이미 최상위 — 유지
  }
  return base;
}
