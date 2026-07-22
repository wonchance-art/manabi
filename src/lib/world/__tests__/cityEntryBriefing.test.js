import { describe, expect, it } from 'vitest';
import {
  briefingSeenKey,
  cityEntryBriefing,
  claimCityEntryBriefing,
} from '../cityEntryBriefing.js';
import { wikiDoc } from '../travelWiki.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

describe('도시 진입 브리핑 계약', () => {
  it('일본·한국 도시는 실재하는 개관 문서 요약과 딥링크를 돌려준다', () => {
    for (const [cityId, countryId, slug] of [
      ['tokyo', 'japan', 'jp-overview'],
      ['busan', 'korea', 'kr-overview'],
    ]) {
      const briefing = cityEntryBriefing(cityId);
      const found = wikiDoc(countryId, slug);
      expect(briefing).toMatchObject({ countryId, slug, summary: found.doc.summary });
      expect(found.doc.domain).toBe('overview');
      expect(briefing.title).toBe(found.doc.title);
    }
  });

  it('지역학 개관 문서가 없는 나라 도시는 브리핑하지 않는다', () => {
    expect(cityEntryBriefing('paris')).toBeNull();
    expect(cityEntryBriefing('beijing')).toBeNull();
    expect(cityEntryBriefing('no-such-city')).toBeNull();
  });

  it('한 나라의 첫 도시에서만 세션을 넘어 한 번 선점한다', () => {
    const storage = memoryStorage();
    expect(claimCityEntryBriefing('tokyo', storage)?.countryId).toBe('japan');
    expect(storage.getItem(briefingSeenKey('japan'))).toBe('1');
    expect(claimCityEntryBriefing('osaka', storage)).toBeNull();
    expect(claimCityEntryBriefing('kyoto', storage)).toBeNull();
    expect(claimCityEntryBriefing('seoul', storage)?.countryId).toBe('korea');
  });

  it('저장소를 사용할 수 없으면 반복 노출 없이 조용히 생략한다', () => {
    const blocked = { getItem() { throw new Error('blocked'); }, setItem() {} };
    expect(claimCityEntryBriefing('tokyo', blocked)).toBeNull();
  });
});
