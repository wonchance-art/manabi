/**
 * 정본 표제어 → 대조 키 정규화 (rfc-vocab-encounter §4.7 — fr/zh 뷰어 만남).
 * 콘텐츠를 임포트하지 않는 순수 모듈 — 뷰어(만남 점 비교)와 refVocabLookup(인덱스 키),
 * content/french(본편·보강 병합 dedup)가 같은 키 함수를 쓴다(단일 원천).
 */

// 프랑스어 표제어 정규화(관사·엘리지옹·괄호 제거, 대안 표기는 첫 항) — 본편 병합
// dedup(_normFr)에서 이관한 정본. 저작형 "la famille"·"les parents (m. pl.)"와
// 토큰 "famille"·"parents"가 같은 키로 접힌다.
const FR_ARTICLES = /^(l'|d'|s'|le |la |les |un |une |des |du |de la |de l'|de |au |aux |à |se |s')+/i;

export function normalizeFrHeadword(s) {
  s = String(s || '').trim().toLowerCase().replace(/’/g, "'").replace(/\([^)]*\)/g, ' ');
  let p = s.split(/[/,]| ou /)[0].trim(), prev;
  do { prev = p; p = p.replace(FR_ARTICLES, '').trim(); } while (p !== prev);
  return p.replace(/[.!?…»«"]/g, '').trim();
}

/**
 * 언어별 만남 대조 키. fr만 표제어 정규화가 필요하고(관사형 저작), zh는 표기가 곧
 * 표제어(전수 실측: 괄호·대안·공백 0), ja·en은 기존 원문 그대로 비교를 유지한다(불변).
 */
export function normalizeRefWordKey(langCode, text) {
  if (langCode === 'fr') return normalizeFrHeadword(text);
  return String(text || '').trim();
}
