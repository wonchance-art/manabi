import { describe, expect, it } from 'vitest';
import { searchWiki, wikiCountries, wikiDoc, wikiDomainLabel } from '../travelWiki.js';

// 📱 여행 폰 위키 — 게임 내 다이제틱 기기의 데이터 계층 계약.
// studies 레지스트리 단일 진실원 소비·검색 스니펫·존재/부재 조회를 고정한다.

describe('여행 폰 위키 — 데이터 계층 계약', () => {
  it('나라 사전과 문서 목록이 studies 레지스트리를 그대로 노출한다', () => {
    const countries = wikiCountries();
    expect(countries.length).toBeGreaterThanOrEqual(2); // 일본학·한국학
    const all = searchWiki('');
    expect(all.length).toBeGreaterThanOrEqual(9); // 일본학 6편 + 한국학 3편(이후 증가만)
    for (const result of all) {
      expect(result.title?.length).toBeGreaterThan(0);
      expect(result.snippet?.length).toBeGreaterThan(0);
      expect(wikiDomainLabel(result.domain)?.length).toBeGreaterThan(0);
    }
  });

  it('본문 검색 — 스니펫이 질의 주변 문맥을 담는다', () => {
    const results = searchWiki('경어');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((result) => result.slug === 'jp-life')).toBe(true);
    for (const result of results) expect(result.snippet.includes('…')).toBe(true);
    // 양국 교차 주제 — 임진왜란은 일본학·한국학 역사편 모두에서 검색된다.
    const cross = searchWiki('임진왜란');
    const slugs = cross.map((result) => result.slug);
    expect(slugs).toContain('jp-history-premodern');
    expect(slugs).toContain('kr-history-premodern');
  });

  it('문서 조회 — 존재/부재', () => {
    expect(wikiDoc('japan', 'jp-overview')?.doc.domain).toBe('overview');
    expect(wikiDoc('japan', 'no-such')).toBeNull();
    expect(wikiDoc('nowhere', 'jp-overview')).toBeNull();
    expect(searchWiki('zzz존재하지않는질의zzz')).toEqual([]);
  });
});
