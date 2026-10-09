// 한국어 기본형 뜻(zh-CN·zh-TW) 미사용 표본 채점 — 순수 함수(네트워크 없음).
// 자동 판정은 1차 선별일 뿐이다: PASS/FAIL은 표본의 허용·금지 예시와 정확히 대조한 결과이고,
// 나머지는 REVIEW로 사람에게 넘긴다. 같은 모델의 자기 승인으로 REVIEW를 통과시키지 않는다.

export const LOCALES = Object.freeze(['zh-CN', 'zh-TW']);
export const VERDICTS = Object.freeze(['PASS', 'FAIL', 'REVIEW', 'BLOCKED', 'ERROR']);

const clean = value => String(value ?? '').normalize('NFC').trim();

// 대응어 목록으로 쪼갠다: 쉼표·모점·세미콜론·슬래시, 그리고 괄호 안 어체 설명은 뺀다.
export function meaningTerms(lexicalMeaning) {
  return clean(lexicalMeaning)
    .replace(/[（(][^）)]*[）)]/g, ' ')
    .split(/[、，,;；/／|]|\s+|或者|或/u)
    .map(term => term.replace(/^[「『"'“]+|[」』"'”。.!！]+$/gu, '').trim())
    .filter(Boolean);
}

// 한 글자 금지어는 대응어 단위로만, 두 글자 이상은 대응어 안의 부분 문자열로도 잡는다
// (예: '对'가 '对象' 안에서 오탐되지 않게, '在市场'은 조사 혼입으로 잡히게).
function hits(terms, forbidden) {
  return forbidden.filter(({ term }) => terms.some(t => [...term].length === 1 ? t === term : t.includes(term)));
}

// 같은 사례의 다른 언어 쪽 목록에만 있는 표기(예: zh-TW 답의 '学院', zh-CN 답의 '火車')는 글자체 오류다.
function wrongScript(terms, spec, other) {
  if (!other) return [];
  const mine = new Set([...(spec.accept || []), ...(spec.review || []), ...(spec.forbidden || []).map(f => f.term)]);
  const theirs = [...(other.accept || []), ...(other.review || []), ...(other.forbidden || []).map(f => f.term)];
  return terms.filter(t => !mine.has(t) && theirs.includes(t));
}

/**
 * @param {object} spec 표본의 언어별 항목 {accept, review?, forbidden}
 * @param {{lemmaStatus?:string, lexicalMeaning?:string, error?:string}} result parseKoreanWordMeaning 결과
 * @param {object} [other] 같은 사례의 다른 언어 항목 — 글자체(간체/번체) 혼용 판정용
 */
export function scoreCase(spec, result, other) {
  if (result?.error) return { verdict: 'ERROR', reason: result.error, terms: [] };
  if (result?.lemmaStatus !== 'matched' || !clean(result.lexicalMeaning)) return { verdict: 'BLOCKED', reason: 'lemma uncertain — 저장 차단', terms: [] };
  const terms = meaningTerms(result.lexicalMeaning);
  const bad = hits(terms, spec.forbidden || []);
  if (bad.length) return { verdict: 'FAIL', reason: bad.map(b => `${b.term}: ${b.why}`).join(' / '), terms };
  const script = wrongScript(terms, spec, other);
  if (script.length) return { verdict: 'FAIL', reason: `글자체 오류(다른 언어 표기): ${script.join(', ')}`, terms };
  if ((spec.accept || []).includes(terms[0])) return { verdict: 'PASS', reason: `첫 대응어 ${terms[0]}`, terms };
  if ((spec.review || []).includes(terms[0])) return { verdict: 'REVIEW', reason: `검토 지정 표현 ${terms[0]}`, terms };
  return { verdict: 'REVIEW', reason: '허용 예시 밖 — 사람 판정', terms };
}

export function validateHoldout(set) {
  const problems = [];
  const excluded = new Set(set.excludedLemmas || []);
  const ids = new Set();
  for (const c of set.cases || []) {
    if (ids.has(c.id)) problems.push(`${c.id}: id 중복`);
    ids.add(c.id);
    if (excluded.has(c.lemma)) problems.push(`${c.id}: 기존 66건 기본형 ${c.lemma}`);
    if (!set.categories?.[c.cat]) problems.push(`${c.id}: 범주 ${c.cat} 없음`);
    if (!c.sentence?.includes(c.surface)) problems.push(`${c.id}: 문장에 표면형 없음`);
    for (const locale of LOCALES) {
      const spec = c[locale];
      if (!spec?.accept?.length) { problems.push(`${c.id} ${locale}: accept 비어 있음`); continue; }
      const overlap = spec.accept.filter(a => hits([a], spec.forbidden || []).length);
      if (overlap.length) problems.push(`${c.id} ${locale}: 허용과 금지가 겹침 ${overlap.join(',')}`);
    }
  }
  return problems;
}

/** 언어별 집계와 출시 기준 판정. REVIEW는 사람 판정 전까지 통과로 세지 않는다. */
export function summarize(set, rows) {
  const critical = new Set(set.criticalCategories || []);
  const criteria = set.releaseCriteria || {};
  const out = {};
  for (const locale of LOCALES) {
    const mine = rows.filter(r => r.locale === locale);
    const count = Object.fromEntries(VERDICTS.map(v => [v, mine.filter(r => r.verdict === v).length]));
    const criticalFail = mine.filter(r => r.verdict === 'FAIL' && critical.has(r.cat)).map(r => r.id);
    const reasons = [];
    if (count.ERROR) reasons.push(`호출 오류 ${count.ERROR}건 — 재실행 필요`);
    if (criticalFail.length > (criteria.criticalFail ?? 0)) reasons.push(`치명 범주 FAIL: ${criticalFail.join(', ')}`);
    if (count.FAIL > (criteria.totalFailMax ?? 0)) reasons.push(`FAIL ${count.FAIL}건 > 허용 ${criteria.totalFailMax}`);
    if (count.BLOCKED > (criteria.blockedMax ?? 0)) reasons.push(`BLOCKED ${count.BLOCKED}건 > 허용 ${criteria.blockedMax}`);
    const status = reasons.length ? '보류' : count.REVIEW ? '사람 판정 대기' : '기준 충족';
    out[locale] = { total: mine.length, ...count, criticalFail, status, reasons };
  }
  return out;
}
