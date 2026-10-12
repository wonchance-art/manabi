// 영어 기본 뜻 금지 답 표(EN-MEANING-GOLD-001) 채점 — 순수 함수(네트워크·DB·제품 import 없음).
// 세트: docs/verification/en-meaning-gold-20261012.json · 실행기: scripts/eval/en-meaning-gold.mjs
// 계약: src/lib/__tests__/enMeaningGold.test.js (모의 LLM으로 제품 파이프라인의 저장·보류 정책을 이 표로 잰다).
//
// - 자동 판정은 1차 선별이다. accept·forbidden과 대조해 PASS/FAIL, 지정 밖은 REVIEW로 사람에게 넘긴다.
// - 출시 기준: **공유 사전에 저장된** 뜻의 FAIL = 0(알려진 중대한 의미 오류는 출시를 막는다). 저장되지 않고
//   이번 요청에만 돌려준 보류 뜻(HELD)은 따로 센다 — 보류는 검증이 막은 결과라 저장 FAIL과 섞지 않는다.

export const CATEGORIES = Object.freeze(['rare', 'polysemous', 'proper', 'common']);
export const VERDICTS = Object.freeze(['PASS', 'FAIL', 'REVIEW']);
export const OUTCOMES = Object.freeze(['stored', 'held', 'empty']);

const HANGUL = /[가-힣]/;
const clean = (value) => String(value ?? '').normalize('NFC').trim();

/** 1번 뜻의 본문 — 괄호 부분(「(동물)」 같은 분류 꼬리)과 공백을 뺀다. */
export function meaningMain(meaning) {
  return clean(meaning).replace(/\([^)]*\)|（[^）]*）/g, '').replace(/\s+/g, '');
}

/** 뜻 하나를 사례와 대조한다. */
export function scoreMeaning(c, meaning) {
  const main = meaningMain(meaning);
  if (!main) return { verdict: 'REVIEW', main, reason: '빈 뜻' };
  const acceptHit = (c.accept || []).find((a) => main.includes(meaningMain(a)));
  const exactForbidden = (c.forbidden || []).find((f) => main === meaningMain(f));
  if (exactForbidden) return { verdict: 'FAIL', main, reason: `금지 답 「${exactForbidden}」` };
  if (acceptHit) return { verdict: 'PASS', main, reason: `허용 「${acceptHit}」` };
  const partialForbidden = (c.forbidden || []).find((f) => main.includes(meaningMain(f)));
  if (partialForbidden) return { verdict: 'FAIL', main, reason: `금지 답 포함 「${partialForbidden}」` };
  return { verdict: 'REVIEW', main, reason: '지정 밖 — 사람 판정' };
}

/**
 * 파이프라인 결과 하나를 채점한다.
 * @param {object} c - 사례
 * @param {{ stored: object|null, returned: object|null }} run - 공유 사전에 쓴 행 · 이번 요청에 돌려준 항목
 */
export function scoreOutcome(c, { stored = null, returned = null } = {}) {
  const entry = stored || returned;
  const outcome = stored ? 'stored' : returned ? 'held' : 'empty';
  const meaning = entry?.meanings?.[0]?.meaning ?? null;
  if (!meaning) return { id: c.id, word: c.word, outcome, meaning: null, verdict: null, reason: '뜻 없음' };
  const scored = scoreMeaning(c, meaning);
  return {
    id: c.id, word: c.word, outcome, meaning, verdict: scored.verdict, reason: scored.reason,
    verify: entry?.meanings?.[0]?.verify ?? null,
  };
}

/** 세트 형식 검증 — 문제 목록(비면 통과). promptExamples: 제품 프롬프트 예시 단어(겹치면 안 된다). */
export function validateGold(set, { promptExamples = [] } = {}) {
  const problems = [];
  if (!set || !Array.isArray(set.cases)) return ['cases 배열 없음'];
  const ids = new Set();
  const words = new Set();
  const examples = new Set(promptExamples.map((w) => clean(w).toLowerCase()));
  for (const c of set.cases) {
    const tag = c?.id || '(id 없음)';
    if (!c?.id || ids.has(c.id)) problems.push(`${tag}: id 없음·중복`);
    ids.add(c?.id);
    if (!CATEGORIES.includes(c?.cat)) problems.push(`${tag}: 범주 ${c?.cat}`);
    const word = clean(c?.word);
    if (!word || word !== word.toLowerCase() || !/^[a-z][a-z'-]*$/.test(word)) problems.push(`${tag}: word는 소문자 lemma`);
    if (words.has(word)) problems.push(`${tag}: word 중복 ${word}`);
    words.add(word);
    if (examples.has(word)) problems.push(`${tag}: 제품 프롬프트 예시 단어 ${word}`);
    if (!Array.isArray(c?.accept) || c.accept.length === 0 || !c.accept.every((a) => HANGUL.test(a))) problems.push(`${tag}: accept(한국어) 1개 이상`);
    if (!Array.isArray(c?.forbidden) || c.forbidden.length === 0) problems.push(`${tag}: forbidden 1개 이상`);
    for (const f of c?.forbidden || []) {
      if ((c.accept || []).some((a) => meaningMain(a) === meaningMain(f))) problems.push(`${tag}: accept·forbidden 겹침 ${f}`);
    }
  }
  if (set.composition) {
    for (const cat of CATEGORIES) {
      const n = set.cases.filter((c) => c.cat === cat).length;
      if ((set.composition[cat] ?? 0) !== n) problems.push(`범주 ${cat}: composition ${set.composition[cat]} ≠ 실제 ${n}`);
    }
  }
  return problems;
}

/** 집계 + 출시 판정. 저장 FAIL이 하나라도 있으면 BLOCK. */
export function summarize(rows) {
  const count = (pred) => rows.filter(pred).length;
  const by = (outcome) => ({
    total: count((r) => r.outcome === outcome),
    PASS: count((r) => r.outcome === outcome && r.verdict === 'PASS'),
    FAIL: count((r) => r.outcome === outcome && r.verdict === 'FAIL'),
    REVIEW: count((r) => r.outcome === outcome && r.verdict === 'REVIEW'),
  });
  const storedFail = rows.filter((r) => r.outcome === 'stored' && r.verdict === 'FAIL').map((r) => r.id);
  return {
    cases: rows.length,
    stored: by('stored'),
    held: by('held'),
    empty: count((r) => r.outcome === 'empty'),
    fixed: count((r) => r.verify === 'fixed'),
    release: storedFail.length ? { status: 'BLOCK', storedFail } : { status: 'OK', storedFail: [] },
  };
}
