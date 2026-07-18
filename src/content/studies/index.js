// 📚 지역학(스터디즈) 레지스트리 — 언어 트랙과 독립된 나라별 레퍼런스 문서 체계.
// 오너 방향(2026-07-18): 챕터·게임 적용은 보류, 전용 페이지의 전문 레퍼런스 문서가 1기 스코프.
// 구조: 나라 → 도메인(개관/역사/경제/사회/문화/생활) → 문서(slug). 언어 트랙 슬러그와 무충돌
// 접두(jp-, kr-, …). 문서 스키마 계약은 __tests__/studiesRegistry.test.js 가 고정한다.

import JP_OVERVIEW from './japan/overview.js';

export const STUDY_DOMAINS = Object.freeze([
  Object.freeze({ id: 'overview', label: '개관' }),
  Object.freeze({ id: 'history', label: '역사' }),
  Object.freeze({ id: 'economy', label: '경제' }),
  Object.freeze({ id: 'society', label: '사회' }),
  Object.freeze({ id: 'culture', label: '문화' }),
  Object.freeze({ id: 'life', label: '생활·언어사회' }),
]);

export const STUDY_COUNTRIES = Object.freeze([
  Object.freeze({
    id: 'japan',
    nameKo: '일본학',
    nameLocal: '日本学',
    intro: '언어 너머의 일본 — 지리·역사·경제·사회를 공적 통계와 통설 기준으로 정리한 레퍼런스.',
    docs: Object.freeze([JP_OVERVIEW]),
  }),
]);

const COUNTRY_BY_ID = Object.fromEntries(STUDY_COUNTRIES.map((c) => [c.id, c]));

export function getStudyCountry(id) {
  return COUNTRY_BY_ID[id] ?? null;
}

export function getStudyDoc(countryId, slug) {
  const country = getStudyCountry(countryId);
  return country?.docs.find((doc) => doc.slug === slug) ?? null;
}

export function studyDomainLabel(domainId) {
  return STUDY_DOMAINS.find((d) => d.id === domainId)?.label ?? domainId;
}

const studiesApi = { STUDY_COUNTRIES, STUDY_DOMAINS, getStudyCountry, getStudyDoc, studyDomainLabel };
export default studiesApi;
