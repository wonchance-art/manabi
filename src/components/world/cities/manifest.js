const entry = (metadata, load) => Object.freeze({
  ...metadata,
  load,
});

// 긴급 롤백은 이 값만 'eager'로 바꾸면 Phaser 생성 전에 26개 payload를 모두 준비한다.
export const CITY_BOOT_MODE = 'lazy';

// Dynamic import 경로는 번들러가 도시별 chunk 경계를 확정할 수 있도록 literal로 유지한다.
// viewerGroup은 관리자 전체맵의 기존 분류(누락 시 etc 폴백 포함)를 그대로 고정한다.
const ENTRIES = Object.freeze([
  entry({ id: 'fukuoka', name: '후쿠오카', cols: 388, rows: 254, viewerGroup: 'jp' }, () => import('./fukuoka.js').then((module) => module.default)),
  entry({ id: 'tokyo', name: '도쿄', cols: 824, rows: 1086, viewerGroup: 'jp' }, () => import('./tokyo.js').then((module) => module.default)),
  entry({ id: 'osaka', name: '오사카', cols: 641, rows: 668, viewerGroup: 'jp' }, () => import('./osaka.js').then((module) => module.default)),
  entry({ id: 'kyoto', name: '교토', cols: 639, rows: 668, viewerGroup: 'jp' }, () => import('./kyoto.js').then((module) => module.default)),
  entry({ id: 'busan', name: '부산', cols: 1320, rows: 1114, viewerGroup: 'kr' }, () => import('./busan.js').then((module) => module.default)),
  entry({ id: 'seoul', name: '서울', cols: 1721, rows: 1448, viewerGroup: 'kr' }, () => import('./seoul.js').then((module) => module.default)),
  entry({ id: 'grand-paris', name: '파리', cols: 1355, rows: 891, viewerGroup: 'fr' }, () => import('./grand-paris.js').then((module) => module.default)),
  entry({ id: 'mont-saint-michel', name: 'Mont-Saint-Michel', cols: 442, rows: 1030, viewerGroup: 'fr' }, () => import('./mont-saint-michel.js').then((module) => module.default)),
  entry({ id: 'cote-dazur', name: '코트다쥐르', cols: 1571, rows: 1169, viewerGroup: 'fr' }, () => import('./cote-dazur.js').then((module) => module.default)),
  entry({ id: 'brussels', name: '브뤼셀', cols: 352, rows: 613, viewerGroup: 'be' }, () => import('./brussels.js').then((module) => module.default)),
  entry({ id: 'taipei', name: '타이베이', cols: 454, rows: 501, viewerGroup: 'tw' }, () => import('./taipei.js').then((module) => module.default)),
  entry({ id: 'hong-kong', name: '홍콩', cols: 618, rows: 390, viewerGroup: 'hk' }, () => import('./hong-kong.js').then((module) => module.default)),
  entry({ id: 'london', name: '런던', cols: 1213, rows: 1002, viewerGroup: 'gb' }, () => import('./london.js').then((module) => module.default)),
  entry({ id: 'shanghai', name: '상하이', cols: 429, rows: 390, viewerGroup: 'cn' }, () => import('./shanghai.js').then((module) => module.default)),
  entry({ id: 'beijing', name: '베이징', cols: 342, rows: 390, viewerGroup: 'cn' }, () => import('./beijing.js').then((module) => module.default)),
  entry({ id: 'brisbane', name: '브리즈번', cols: 544, rows: 557, viewerGroup: 'au' }, () => import('./brisbane.js').then((module) => module.default)),
  entry({ id: 'sydney', name: '시드니', cols: 648, rows: 780, viewerGroup: 'au' }, () => import('./sydney.js').then((module) => module.default)),
  entry({ id: 'canberra', name: '캔버라', cols: 546, rows: 501, viewerGroup: 'au' }, () => import('./canberra.js').then((module) => module.default)),
  entry({ id: 'melbourne', name: '멜버른', cols: 484, rows: 557, viewerGroup: 'au' }, () => import('./melbourne.js').then((module) => module.default)),
  entry({ id: 'marseille', name: '마르세유', cols: 406, rows: 446, viewerGroup: 'fr' }, () => import('./marseille.js').then((module) => module.default)),
  entry({ id: 'kawaguchiko', name: '가와구치코', cols: 567, rows: 863, viewerGroup: 'jp' }, () => import('./kawaguchiko.js').then((module) => module.default)),
  entry({ id: 'geneva', name: '제네바', cols: 309, rows: 362, viewerGroup: 'ch' }, () => import('./geneva.js').then((module) => module.default)),
  entry({ id: 'leman-riviera', name: '레만호 연안', cols: 1342, rows: 780, viewerGroup: 'etc' }, () => import('./leman-riviera.js').then((module) => module.default)),
  entry({ id: 'lyon', name: '리옹', cols: 428, rows: 501, viewerGroup: 'etc' }, () => import('./lyon.js').then((module) => module.default)),
  entry({ id: 'bordeaux', name: '보르도', cols: 474, rows: 501, viewerGroup: 'etc' }, () => import('./bordeaux.js').then((module) => module.default)),
  entry({ id: 'strasbourg', name: '스트라스부르', cols: 405, rows: 446, viewerGroup: 'etc' }, () => import('./strasbourg.js').then((module) => module.default)),
]);

export const CITY_MANIFEST = Object.freeze(
  ENTRIES.map(({ load: _load, ...metadata }) => Object.freeze(metadata)),
);

const METADATA_BY_ID = new Map(CITY_MANIFEST.map((metadata) => [metadata.id, metadata]));

function cityLoaderError(code, message) {
  return Object.assign(new Error(message), { code });
}

function validatePayload(metadata, payload) {
  if (
    !payload
    || typeof payload !== 'object'
    || payload.id !== metadata.id
    || payload.name !== metadata.name
    || payload.cols !== metadata.cols
    || payload.rows !== metadata.rows
  ) {
    throw cityLoaderError(
      'CITY_PAYLOAD_MISMATCH',
      `City payload does not match manifest metadata: ${metadata.id}`,
    );
  }
  return payload;
}

export function createCityLoaderRegistry(entries) {
  const registryEntries = Object.freeze(entries.map((value) => Object.freeze({ ...value })));
  const entriesById = new Map(registryEntries.map((value) => [value.id, value]));
  if (entriesById.size !== registryEntries.length) {
    throw cityLoaderError('DUPLICATE_CITY', 'City loader registry contains duplicate ids');
  }
  const cache = new Map();

  function loadCityFromRegistry(id) {
    const selected = entriesById.get(id);
    if (!selected) {
      return Promise.reject(cityLoaderError('UNKNOWN_CITY', `Unknown city id: ${String(id)}`));
    }
    const cached = cache.get(id);
    if (cached) return cached;

    const pending = Promise.resolve()
      .then(() => selected.load())
      .then((payload) => validatePayload(selected, payload));
    cache.set(id, pending);
    pending.catch(() => {
      if (cache.get(id) === pending) cache.delete(id);
    });
    return pending;
  }

  return Object.freeze({
    hasCity: (id) => typeof id === 'string' && entriesById.has(id),
    loadCity: loadCityFromRegistry,
    loadAllCities: () => Promise.all(registryEntries.map(({ id }) => loadCityFromRegistry(id))),
  });
}

const registry = createCityLoaderRegistry(ENTRIES);

export function hasCity(id) {
  return typeof id === 'string' && METADATA_BY_ID.has(id);
}

export function cityMetadata(id) {
  return METADATA_BY_ID.get(id) ?? null;
}

export function cityIdFromScene(scene) {
  if (typeof scene !== 'string' || !scene.startsWith('city:')) return null;
  const id = scene.slice(5);
  return hasCity(id) ? id : null;
}

export function initialCityIdForSpawn(spawn) {
  return cityIdFromScene(spawn?.scene);
}

export const loadCity = registry.loadCity;
export const loadAllCities = registry.loadAllCities;

export async function loadCitiesForBoot(
  spawn,
  {
    mode = CITY_BOOT_MODE,
    loadCityFn = loadCity,
    loadAllCitiesFn = loadAllCities,
  } = {},
) {
  if (mode === 'eager') return loadAllCitiesFn();
  if (mode !== 'lazy') {
    throw cityLoaderError('UNKNOWN_BOOT_MODE', `Unknown city boot mode: ${String(mode)}`);
  }
  const id = initialCityIdForSpawn(spawn);
  return id ? [await loadCityFn(id)] : [];
}
