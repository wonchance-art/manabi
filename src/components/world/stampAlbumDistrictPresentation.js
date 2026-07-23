import {
  cityDistrictOpenAt,
  resolveCityDistricts,
} from './cityDistricts.js';

function invariant(condition, message) {
  if (!condition) throw new Error(`stamp album districts: ${message}`);
}

export function stampAlbumDistrictPresentation(node, cityData) {
  const cityId = node?.gate?.type === 'city' ? node.gate.to : null;
  const city = cityId ? cityData?.[cityId] : null;
  if (!city || city.districts == null) return null;
  invariant(typeof city.buildGrid === 'function', `${cityId} city data must be available`);

  // mainRoute 원본은 waypoint 계약이며 CityScene에서 path로 별도 resolve된다.
  // 앨범은 지구 목록만 필요하므로 GameCanvas의 안전 폴백과 같이 city+grid 계약만 소비한다.
  const resolved = resolveCityDistricts(city, city.buildGrid());
  invariant(resolved != null, `${cityId} must resolve district-v1 data`);

  // open 배열만이 v1의 개방 동네 정본이다. 잠금 영역은 개별 동네 목록이 아니므로 세지 않는다.
  // 각 지구의 첫 rect 시작점을 공용 판정기로 재확인해 UI가 resolver와 다른 개방 문법을 만들지 않게 한다.
  const labels = resolved.open
    .filter((district) => district.rects.some(
      ([x0, y0]) => cityDistrictOpenAt(resolved, x0, y0),
    ))
    .map((district) => district.label);

  return Object.freeze({
    cityId,
    openCount: labels.length,
    countLabel: `개방 ${labels.length} 동네`,
    labels: Object.freeze(labels),
  });
}
