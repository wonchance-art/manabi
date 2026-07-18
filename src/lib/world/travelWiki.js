// 📱 여행 폰 위키 — 게임 안 다이제틱 기기(GTA 휴대폰·포켓몬 PC 개념)의 데이터 계층.
// 지역학(스터디즈) 레지스트리를 게임 오버레이에서 검색·열람할 수 있게 얇게 감싼다.
// React/Phaser 의존 0 — vitest(node)에서 그대로 검증한다. 문서 원본은 studies 가 단일 진실원.

import { STUDY_COUNTRIES, studyDomainLabel } from '../../content/studies';

export function wikiCountries() {
  return STUDY_COUNTRIES;
}

export function wikiDoc(countryId, slug) {
  const country = STUDY_COUNTRIES.find((entry) => entry.id === countryId);
  const doc = country?.docs.find((entry) => entry.slug === slug) ?? null;
  return doc ? { country, doc } : null;
}

export function wikiDomainLabel(domainId) {
  return studyDomainLabel(domainId);
}

// 검색 — 제목·요약·섹션 제목·본문을 훑어 스니펫과 함께 돌려준다(모바일 위키 검색 감각).
// 질의가 비면 전체 문서 목록(나라 순)을 돌려줘 브라우징 진입점으로도 쓴다.
export function searchWiki(query) {
  const q = (query || '').trim().toLowerCase();
  const results = [];
  for (const country of STUDY_COUNTRIES) {
    for (const doc of country.docs) {
      if (!q) {
        results.push({ countryId: country.id, countryName: country.nameKo, slug: doc.slug, title: doc.title, domain: doc.domain, snippet: doc.summary });
        continue;
      }
      const haystacks = [
        ['title', doc.title],
        ['summary', doc.summary],
        ...doc.sections.flatMap((section) => [
          ['heading', section.heading],
          ...section.paras.map((para) => ['para', para]),
        ]),
      ];
      const hit = haystacks.find(([, text]) => text.toLowerCase().includes(q));
      if (!hit) continue;
      const [, text] = hit;
      const at = text.toLowerCase().indexOf(q);
      const start = Math.max(0, at - 24);
      const snippet = `${start > 0 ? '…' : ''}${text.slice(start, at + q.length + 44)}…`;
      results.push({ countryId: country.id, countryName: country.nameKo, slug: doc.slug, title: doc.title, domain: doc.domain, snippet });
    }
  }
  return results;
}
