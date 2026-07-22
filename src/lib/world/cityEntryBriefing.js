import { studiesRefForNode } from './studiesRefs';
import { wikiDoc } from './travelWiki';

export const BRIEFING_SEEN_PREFIX = 'briefing-seen:';

export function briefingSeenKey(countryId) {
  return `${BRIEFING_SEEN_PREFIX}${countryId}`;
}

// 도시 게이트 중 지역학 개관 문서가 실재하는 나라(현재 일본·한국)만 브리핑한다.
export function cityEntryBriefing(cityId) {
  const ref = studiesRefForNode(cityId);
  if (!ref) return null;
  const found = wikiDoc(ref.countryId, ref.slug);
  if (!found || found.doc.domain !== 'overview' || !found.doc.summary) return null;
  return Object.freeze({
    countryId: ref.countryId,
    countryName: ref.countryName,
    slug: ref.slug,
    title: found.doc.title,
    summary: found.doc.summary,
  });
}

// 같은 나라의 어느 도시로 들어가든 localStorage 키를 먼저 선점해 세션을 넘어 한 번만 돌려준다.
// 저장소가 막힌 환경에서는 반복 노출보다 안전한 미노출을 택한다.
export function claimCityEntryBriefing(cityId, storage) {
  const briefing = cityEntryBriefing(cityId);
  if (!briefing) return null;
  const key = briefingSeenKey(briefing.countryId);
  try {
    const target = storage ?? globalThis.localStorage;
    if (!target || target.getItem(key) !== null) return null;
    target.setItem(key, '1');
    return briefing;
  } catch {
    return null;
  }
}
