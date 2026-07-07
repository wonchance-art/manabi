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
    // 비대칭 신뢰: 플래시(자기채점)는 훑기용이라 성공은 관대 편향이 커 신뢰 불가 → 완전 무시,
    // 오답 자인('다시')만 신뢰 가능 → 현재 급의 실패로 인정(강등 신호). 승급 크레딧은 0.
    if (ev?.qtype === 'flash') {
      if (!ev?.correct) {
        downStreak++;
        upStreak = 0;
        if (downStreak >= 2) { r = Math.max(1, r - 1); downStreak = 0; }
      }
      // 정답은 어떤 스트릭도 건드리지 않음 — 자기채점 성공은 신호로 안 씀
      continue;
    }
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
 * due 어휘별 숙련 rung 유도 — 해당 단어의 vocab 소스 이벤트만 시간순으로 모아 computeRung.
 * source 필터가 없으면 같은 item_key를 쓰는 타 소스(reading/grammar) 이벤트가 섞여 rung이 오염된다.
 * 콘텐츠 무의존 순수 함수라 skillRung에 둔다 — 'use client' 소비처(VocabPage)가
 * studyMaterials(→content 레지스트리 6MB)를 전이 import하지 않도록.
 * @param {Array} eventsAsc - review_events (시간 오름차순)
 * @param {Array} dueVocabRows - due 어휘 행 (word_text)
 * @returns {Record<string, number>} word_text → rung
 */
export function deriveVocabRungs(eventsAsc, dueVocabRows) {
  const rungs = {};
  for (const w of dueVocabRows || []) {
    const evs = (eventsAsc || [])
      .filter(e => e.source === 'vocab' && e.item_key === w.word_text)
      .map(e => ({ qtype: e.detail?.qtype, correct: !!e.correct }));
    rungs[w.word_text] = computeRung(evs);
  }
  return rungs;
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
 * 약점 집계 — review_events에서 (source, item_key)별 오답률을 가중해 정렬한다.
 * 점수 = (wrong/total) * ln(total+1) — 오답 비율이 높고 표본이 많을수록 크다.
 * 표본이 얕은 항목은 노이즈라 total>=2만 남긴다.
 * 순수 함수 — 조회는 호출자(studyMaterials) 몫.
 * @param {Array<{source, item_key, correct, created_at}>} events
 * @param {{sinceMs?: number, cap?: number}} opts - sinceMs 이후 이벤트만, 상위 cap개
 * @returns {Array<{source, item_key, wrong, total, score}>} score 내림차순
 */
export function computeWeakness(events, { sinceMs = 0, cap = 5 } = {}) {
  const agg = new Map();
  for (const e of events || []) {
    if (!e || !e.source || !e.item_key) continue;
    if (sinceMs) {
      const t = new Date(e.created_at).getTime();
      if (!(t >= sinceMs)) continue;
    }
    const key = `${e.source}\u0000${e.item_key}`;
    const a = agg.get(key) || { source: e.source, item_key: e.item_key, wrong: 0, total: 0 };
    a.total += 1;
    if (!e.correct) a.wrong += 1;
    agg.set(key, a);
  }
  const out = [];
  for (const a of agg.values()) {
    if (a.total < 2) continue;                       // 표본 부족 — 노이즈 제외
    const score = (a.wrong / a.total) * Math.log(a.total + 1);
    out.push({ ...a, score });
  }
  out.sort((x, y) => y.score - x.score);
  return cap ? out.slice(0, cap) : out;
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
