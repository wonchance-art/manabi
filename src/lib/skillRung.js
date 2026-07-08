/**
 * 어휘 숙련 사다리(rung) + EWMA 난이도 다이얼 — 순수 함수 모음.
 *
 * 숙련 사다리(어휘 전용):
 *   0 노출 전 → 1 인지(choice) → 2 단서회상(cloze) → 3 자유회상(typing) → 4 청각 회상(listening) → 5 산출(produce)
 *   ※ 인지(선다)와 자유회상(타이핑) 사이의 간극이 커(선다는 맞히나 타이핑은 전멸하는 구간)
 *     단서회상(예문 빈칸 채우기)을 완충 단계로 끼운다 — 학습과학의 cued recall.
 *   ※ produce 문항은 D단계에서 추가되지만 알고리즘은 미리 지원한다.
 *
 * 재번호 안전: rung은 이벤트에서 유도되는 순수함수라 이 재번호가 저장 상태를 깨지 않는다 —
 *   기존 이벤트 이력도 새 qtype→level 매핑으로 전부 재계산될 뿐이다.
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
 * @returns {number} 1~5
 */
export function qtypeRungLevel(qtype) {
  switch (qtype) {
    case 'choice': return 1;
    case 'cloze': return 2;     // 단서회상(예문 빈칸)
    case 'typing': return 3;    // 자유회상(타이핑)
    case 'listening': return 4;
    case 'produce': return 5;
    default: return 1; // 그 외/누락 — 과거 이벤트 보수 처리
  }
}

/**
 * 한 항목의 이벤트 이력으로 현재 rung을 유도한다.
 * @param {Array<{qtype?: string, correct: boolean}>} events - 시간순(오래된 것부터)
 * @returns {number} 0(노출 전)~5
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
        if (upStreak >= 2) { r = Math.min(r + 1, 5); upStreak = 0; }
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
 * 산출 문장에 세션 어휘 단어가 실제로 포함됐는지 판정 — 언어별 규약.
 * 산출 채점(settle) 시 제출 문장에 든 단어별로 vocab/produce 이벤트를 발행하기 위한 순수함수.
 *  - ZH: 정확 부분문자열(공백·경계 개념이 약함).
 *  - EN/FR: 소문자화 + 단어 경계(라틴 액센트 안전을 위해 \p{L} 경계 검사).
 *  - JA: 정확 부분문자열 우선, 실패 시 어간 휴리스틱 — word 끝 1자 제거(어간이 최소 2자 남을 때만)
 *        후 부분문자열. 「食べる→食べ」같은 활용형을 잡기 위한 것으로, 완벽한 형태소 분석이
 *        아닌 휴리스틱이다(과잉/과소 매칭 가능). 측정·rung 유도용이라 이 정도 근사로 충분하다.
 *  - 그 외: 정확 부분문자열.
 * @param {string} sentence 제출 문장
 * @param {string} word 세션 어휘 단어 (word_text)
 * @param {string} [langCode] 'ja'|'zh'|'en'|'fr'|...
 * @returns {boolean}
 */
export function sentenceIncludesWord(sentence, word, langCode) {
  if (!sentence || !word) return false;
  const s = String(sentence);
  const w = String(word);
  if (langCode === 'en' || langCode === 'fr') {
    const sl = s.toLowerCase();
    const wl = w.toLowerCase();
    const escaped = wl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // \b는 액센트 문자(é 등)에서 오작동 → 앞뒤가 '문자(\p{L})가 아님(또는 문자열 경계)'인지로 경계 판정.
    const re = new RegExp(`(^|[^\\p{L}])${escaped}([^\\p{L}]|$)`, 'u');
    return re.test(sl);
  }
  if (langCode === 'ja') {
    if (s.includes(w)) return true;
    // 어간 휴리스틱(활용형 대응) — 끝 1자 제거, 어간 최소 2자 유지.
    if (w.length >= 3) {
      const stem = w.slice(0, -1);
      if (stem.length >= 2 && s.includes(stem)) return true;
    }
    return false;
  }
  // ZH·기타 — 정확 부분문자열
  return s.includes(w);
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
 * 기본: rung≤1→choice, rung 2→cloze(단서회상), rung 3→typing(자유회상), rung≥4→listening.
 *   (rung 5=produce는 세션 슬롯이 없어 listening으로 수렴 — produce는 격일 산출 문항으로 별도 처리.)
 * dial 'easy'→무조건 choice. dial 'hard'→한 단계 상향(choice→cloze→typing→listening, listening 유지).
 * ※ cloze는 예문이 있어야 성립한다 — 예문 부재 시 조립부(buildVocabItems)에서 typing으로 폴백한다.
 * @param {number} rung
 * @param {'easy'|'normal'|'hard'} [dial='normal']
 * @returns {'vocab-choice'|'vocab-cloze'|'vocab-typing'|'vocab-listening'}
 */
export function vocabTypeForRung(rung, dial = 'normal') {
  if (dial === 'easy') return 'vocab-choice';
  let base;
  if (rung <= 1) base = 'vocab-choice';
  else if (rung === 2) base = 'vocab-cloze';
  else if (rung === 3) base = 'vocab-typing';
  else base = 'vocab-listening';
  if (dial === 'hard') {
    if (base === 'vocab-choice') return 'vocab-cloze';
    if (base === 'vocab-cloze') return 'vocab-typing';
    if (base === 'vocab-typing') return 'vocab-listening';
    return 'vocab-listening'; // 이미 최상위 — 유지
  }
  return base;
}
