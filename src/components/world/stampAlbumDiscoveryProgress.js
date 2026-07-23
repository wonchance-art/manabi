import { loadRouteDiscoveryIds } from './routeDiscoveries.js';

// P1 lazy city registry에서 상세 payload를 요청할 S6 정본 범위.
// 발견 개수와 ID는 로드한 각 도시의 mainRoute.discoveries만 신뢰한다.
export const STAMP_ALBUM_DISCOVERY_CITY_IDS = Object.freeze([
  'seoul',
  'tokyo',
  'osaka',
  'kyoto',
  'lyon',
  'bordeaux',
  'strasbourg',
]);

function cityIdForNode(node) {
  return node?.gate?.type === 'city' && typeof node.gate.to === 'string'
    ? node.gate.to
    : null;
}

export function stampAlbumDiscoveryProgress(node, cityData, storage) {
  const cityId = cityIdForNode(node);
  const discoveries = cityId ? cityData?.[cityId]?.mainRoute?.discoveries : null;
  if (!Array.isArray(discoveries) || discoveries.length === 0) return null;

  const canonicalIds = new Set(
    discoveries
      .map((discovery) => discovery?.id)
      .filter((id) => typeof id === 'string' && id.length > 0),
  );
  if (canonicalIds.size === 0) return null;

  const storedIds = loadRouteDiscoveryIds(cityId, storage);
  let got = 0;
  for (const id of canonicalIds) if (storedIds.has(id)) got += 1;

  return Object.freeze({
    cityId,
    got,
    total: canonicalIds.size,
    label: `발견 ${got}/${canonicalIds.size}`,
  });
}
