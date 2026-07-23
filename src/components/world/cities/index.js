export {
  CITY_BOOT_MODE,
  CITY_MANIFEST,
  cityMetadata,
  cityIdFromScene,
  createCityLoaderRegistry,
  hasCity,
  initialCityIdForSpawn,
  loadAllCities,
  loadCitiesForBoot,
  loadCity,
} from './manifest.js';

// main 진전 중 exact allowlist 밖에서 추가된 두 회귀 테스트가 아직 동기 barrel을 소비한다.
// 제품 번들에서는 빈 호환값이며, Node 22 Vitest에서만 동기 ESM require로 기존 테스트를 보존한다.
// 런타임 소비처와 승인된 전수 테스트는 모두 manifest/loadAllCities 계약을 사용한다.
let legacyTestCities = Object.freeze([]);
if (
  typeof process !== 'undefined'
  && process.env.NODE_ENV === 'test'
  && typeof process.getBuiltinModule === 'function'
) {
  const requireForTest = process.getBuiltinModule('module').createRequire(import.meta.url);
  legacyTestCities = Object.freeze([
    requireForTest('./fukuoka.js').default,
    requireForTest('./tokyo.js').default,
    requireForTest('./osaka.js').default,
    requireForTest('./kyoto.js').default,
    requireForTest('./busan.js').default,
    requireForTest('./seoul.js').default,
    requireForTest('./grand-paris.js').default,
    requireForTest('./mont-saint-michel.js').default,
    requireForTest('./cote-dazur.js').default,
    requireForTest('./brussels.js').default,
    requireForTest('./taipei.js').default,
    requireForTest('./hong-kong.js').default,
    requireForTest('./london.js').default,
    requireForTest('./shanghai.js').default,
    requireForTest('./beijing.js').default,
    requireForTest('./brisbane.js').default,
    requireForTest('./sydney.js').default,
    requireForTest('./canberra.js').default,
    requireForTest('./melbourne.js').default,
    requireForTest('./marseille.js').default,
    requireForTest('./kawaguchiko.js').default,
    requireForTest('./geneva.js').default,
    requireForTest('./leman-riviera.js').default,
    requireForTest('./lyon.js').default,
    requireForTest('./bordeaux.js').default,
    requireForTest('./strasbourg.js').default,
  ]);
}

/** @deprecated 제품 코드에서는 CITY_MANIFEST/loadCity를 사용한다. */
export const CITY_MAPS = legacyTestCities;
/** @deprecated 제품 코드에서는 CITY_MANIFEST/loadCity를 사용한다. */
export const CITY_DATA = Object.freeze(
  Object.fromEntries(legacyTestCities.map((city) => [city.id, city])),
);
