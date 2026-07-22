// 📚 지역학(스터디즈) 레지스트리 — 언어 트랙과 독립된 나라별 레퍼런스 문서 체계.
// 오너 방향(2026-07-18): 챕터·게임 적용은 보류, 전용 페이지의 전문 레퍼런스 문서가 1기 스코프.
// 구조: 나라 → 도메인(개관/역사/경제/사회/문화/생활) → 문서(slug). 언어 트랙 슬러그와 무충돌
// 접두(jp-, kr-, …). 문서 스키마 계약은 __tests__/studiesRegistry.test.js 가 고정한다.

import JP_OVERVIEW from './japan/overview.js';
import JP_HISTORY_PREMODERN from './japan/historyPremodern.js';
import JP_HISTORY_MODERN from './japan/historyModern.js';
import JP_ECONOMY from './japan/economy.js';
import JP_CULTURE from './japan/culture.js';
import JP_SOCIETY from './japan/society.js';
import JP_LIFE from './japan/life.js';
import KR_OVERVIEW from './korea/overview.js';
import KR_HISTORY_PREMODERN from './korea/historyPremodern.js';
import KR_HISTORY_MODERN from './korea/historyModern.js';
import KR_ECONOMY from './korea/economy.js';
import KR_CULTURE from './korea/culture.js';
import KR_SOCIETY from './korea/society.js';
import KR_LIFE from './korea/life.js';
import FR_OVERVIEW from './france/overview.js';
import FR_HISTORY_PREMODERN from './france/historyPremodern.js';
import FR_HISTORY_MODERN from './france/historyModern.js';
import FR_ECONOMY from './france/economy.js';
import FR_FRANCOPHONIE from './france/francophonie.js';

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
    docs: Object.freeze([JP_OVERVIEW, JP_HISTORY_PREMODERN, JP_HISTORY_MODERN, JP_ECONOMY, JP_CULTURE, JP_SOCIETY, JP_LIFE]),
  }),
  Object.freeze({
    id: 'korea',
    nameKo: '한국학',
    nameLocal: '韓國學',
    intro: '아는 나라를 레퍼런스의 시선으로 — 한국의 지리·인구·경제·사회를 공적 통계 기준으로 재정리한다.',
    docs: Object.freeze([KR_OVERVIEW, KR_HISTORY_PREMODERN, KR_HISTORY_MODERN, KR_ECONOMY, KR_CULTURE, KR_SOCIETY, KR_LIFE]),
  }),
  Object.freeze({
    id: 'france',
    nameKo: '프랑스학',
    nameLocal: 'Études françaises',
    intro: '프랑스에서 불어권 세계까지 — 파리·몽생미셸·브뤼셀·로망디, 그리고 그 너머 프랑코포니의 지리·역사·언어사회를 공적 통계 기준으로 정리한 레퍼런스.',
    docs: Object.freeze([FR_OVERVIEW, FR_HISTORY_PREMODERN, FR_HISTORY_MODERN, FR_ECONOMY, FR_FRANCOPHONIE]),
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
