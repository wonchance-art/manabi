// 한국에서 공개해도 되는가 — 정본 책 권리 선의 공통 정본(LIT-SRC-WS-1, 오너 「미국 기준 없애」 2026-10-17 KST).
//
// manabi는 한국 서비스라 한국 저작권법을 따른다. 한국에서 보호가 끝난 작품은 두 갈래다.
//   ① 한국 보호기간 만료: 사후 70년(기준 연도 - 71년 이전 사망). 그리고 2013-07-01 보호기간 연장(50 → 70년, 법률 제10807호 부칙) 전에
//      이미 끝난 저작물은 되살아나지 않는다 — 1962년 이전 사망 작가는 사후 50년으로 2012년 말까지 끝났다(헤밍웨이 1961 · 카뮈 1960 ·
//      생텍쥐페리 1944).
//   ② 본국 보호기간 만료: 저작권법 제3조 제4항(보호기간 상호주의) — 본국에서 만료된 외국인 저작물은 한국에서도 보호하지 않는다
//      (아오조라 D5 「일본에서만 끝나면 그만」 · 중국 사후 50년).
// 미국 선은 미국이 본국인 작품의 ②에서만 쓴다(출판 95년 — 1978년 전 출판작).

/** 2013-07-01 연장 전에 끝난 선 — 이 해까지 사망한 작가의 저작물은 한국에서 만료다. */
export const KR_PRE_EXTENSION_DEATH_YEAR = 1962;
export const KR_TERM = 70;

/** ① 한국 보호기간 만료인가. reviewYear: 검토일의 해(결정적). */
export function koreaTermExpired(authorDeathYear, reviewYear) {
  if (!Number.isInteger(authorDeathYear) || !Number.isInteger(reviewYear)) return false;
  return authorDeathYear <= KR_PRE_EXTENSION_DEATH_YEAR || authorDeathYear <= reviewYear - KR_TERM - 1;
}

/**
 * 본국 보호기간 — 나라마다 하나의 선. death: 사후 n년 · published: 출판 n년(미국 1978년 전 출판작) · warExtension: 프랑스
 * 「mort pour la France」 +30년(작품마다 mortPourLaFrance를 true/false로 적는다 — 없으면 판정 불가).
 */
export const ORIGIN_RULES = Object.freeze({
  CN: Object.freeze({ death: 50 }),
  FR: Object.freeze({ death: 70, warExtension: 30 }),
  GB: Object.freeze({ death: 70 }),
  IE: Object.freeze({ death: 70 }),
  KR: Object.freeze({ death: 70 }),
  US: Object.freeze({ published: 95 }),
});

/** ② 본국 보호기간 만료인가 — {expired, reason}. 규칙 없는 나라는 expired:false(사유와 함께). */
export function originTermExpired({ publishedYear, authorDeathYear, countryOfOrigin, mortPourLaFrance = null }, reviewYear) {
  const rule = Object.hasOwn(ORIGIN_RULES, countryOfOrigin) ? ORIGIN_RULES[countryOfOrigin] : null;
  if (!rule) return { expired: false, reason: `원산국 ${countryOfOrigin ?? '없음'}은 아직 판정 규칙이 없다(${Object.keys(ORIGIN_RULES).join('·')})` };
  if (rule.published) {
    return Number.isInteger(publishedYear) && publishedYear <= reviewYear - rule.published - 1
      ? { expired: true, reason: null }
      : { expired: false, reason: `${publishedYear} 출판 — 본국(출판 ${rule.published}년) 보호기간이 끝나지 않았다` };
  }
  if (rule.warExtension && typeof mortPourLaFrance !== 'boolean') return { expired: false, reason: '프랑스 원산은 mortPourLaFrance(true/false)를 적는다' };
  const term = rule.death + (rule.warExtension && mortPourLaFrance === true ? rule.warExtension : 0);
  return Number.isInteger(authorDeathYear) && authorDeathYear <= reviewYear - term - 1
    ? { expired: true, reason: null }
    : { expired: false, reason: `작가 ${authorDeathYear} 사망 — 원산국 보호기간(사후 ${term}년)이 끝나지 않았다` };
}

/**
 * 한국 공개 가능 판정 — ① 한국 만료 또는 ② 본국 만료. 기준 연도는 검토일(rights.reviewedAt)의 해라 결정적이다.
 * 번역본(오너 「되는 언어로만」 2026-10-17 KST)은 원작과 번역 둘 다 한국에서 만료여야 한다 — 번역은 그 자체로 저작물이라
 * translator를 {name, deathYear, publishedYear, countryOfOrigin}로 적고 같은 두 갈래(①·②)로 따로 본다. 문자열 하나뿐인
 * translator는 검토 기록이 아니라 불가다. 연도 기록이 없으면 불가(fail-closed).
 * @returns {{ok: boolean, reasons: string[], reviewYear: number|null, basis: 'korea-term'|'origin-term'|null}}
 */
export function koreaPublicDomainVerdict({ publishedYear, authorDeathYear, countryOfOrigin, mortPourLaFrance = null, translator = null, rights } = {}) {
  const reasons = [];
  const reviewYear = /^\d{4}-\d{2}-\d{2}$/u.test(rights?.reviewedAt ?? '') ? Number(rights.reviewedAt.slice(0, 4)) : null;
  if (reviewYear == null) reasons.push('rights.reviewedAt(YYYY-MM-DD)가 필요하다');
  if (!Number.isInteger(publishedYear)) reasons.push('publishedYear가 필요하다');
  if (!Number.isInteger(authorDeathYear)) reasons.push('authorDeathYear가 필요하다');
  if (typeof countryOfOrigin !== 'string' || !countryOfOrigin) reasons.push('countryOfOrigin이 필요하다');
  if (translator != null) reasons.push(...translatorRecordReasons(translator));
  if (reasons.length) return { ok: false, reasons, reviewYear, basis: null };
  const original = termVerdict({ publishedYear, authorDeathYear, countryOfOrigin, mortPourLaFrance }, reviewYear, '작가');
  if (!original.ok) return { ok: false, reasons: original.reasons, reviewYear, basis: null };
  if (translator == null) return { ok: true, reasons: [], reviewYear, basis: original.basis };
  const translation = termVerdict({
    publishedYear: translator.publishedYear,
    authorDeathYear: translator.deathYear,
    countryOfOrigin: translator.countryOfOrigin,
    mortPourLaFrance: translator.mortPourLaFrance ?? null,
  }, reviewYear, `번역자 ${translator.name}`);
  if (!translation.ok) return { ok: false, reasons: translation.reasons, reviewYear, basis: null };
  // 둘 중 늦게 끝난 쪽이 근거다 — 한국 만료끼리면 korea-term, 하나라도 본국 상호주의면 origin-term.
  const basis = original.basis === 'origin-term' || translation.basis === 'origin-term' ? 'origin-term' : 'korea-term';
  return { ok: true, reasons: [], reviewYear, basis };
}

/** 번역 기록의 모양 — 이름·몰년·번역 출판 연도·번역 원산국. 빠지면 그 사유들. */
export function translatorRecordReasons(translator) {
  if (!translator || typeof translator !== 'object' || Array.isArray(translator)) {
    return ['번역자는 {name, deathYear, publishedYear, countryOfOrigin}로 적는다(문자열 하나는 검토 기록이 아니다)'];
  }
  const reasons = [];
  if (typeof translator.name !== 'string' || !translator.name.trim()) reasons.push('translator.name이 필요하다');
  if (!Number.isInteger(translator.deathYear)) reasons.push('translator.deathYear가 필요하다');
  if (!Number.isInteger(translator.publishedYear)) reasons.push('translator.publishedYear(번역 출판)가 필요하다');
  if (typeof translator.countryOfOrigin !== 'string' || !translator.countryOfOrigin) reasons.push('translator.countryOfOrigin이 필요하다');
  return reasons;
}

function termVerdict({ publishedYear, authorDeathYear, countryOfOrigin, mortPourLaFrance }, reviewYear, who) {
  if (koreaTermExpired(authorDeathYear, reviewYear)) return { ok: true, reasons: [], basis: 'korea-term' };
  const origin = originTermExpired({ publishedYear, authorDeathYear, countryOfOrigin, mortPourLaFrance }, reviewYear);
  if (origin.expired) return { ok: true, reasons: [], basis: 'origin-term' };
  return { ok: false, reasons: [`${who} ${authorDeathYear} 사망 — 한국 보호기간이 끝나지 않았다(1962년 이전 사망 또는 사후 70년)`, origin.reason], basis: null };
}
