const DEG = Math.PI / 180;
const EARTH_RADIUS_METERS = 6371008.8;
const METERS_PER_TILE = 4500;

const roundHalfAwayFromZero = (value) => (value < 0 ? -Math.round(-value) : Math.round(value));

function projectedTile({ bbox, projection }, lon, lat) {
  const standardCos = Math.cos(projection.standardLat * DEG);
  const minX = EARTH_RADIUS_METERS * (bbox[0] - projection.lon0) * DEG * standardCos;
  const maxY = EARTH_RADIUS_METERS * bbox[3] * DEG;
  const x = (EARTH_RADIUS_METERS * (lon - projection.lon0) * DEG * standardCos - minX) / METERS_PER_TILE;
  const y = (maxY - EARTH_RADIUS_METERS * lat * DEG) / METERS_PER_TILE;
  return Object.freeze({ x: roundHalfAwayFromZero(x), y: roundHalfAwayFromZero(y) });
}

function unprojectedCoordinate({ bbox, projection }, x, y) {
  const standardCos = Math.cos(projection.standardLat * DEG);
  const minX = EARTH_RADIUS_METERS * (bbox[0] - projection.lon0) * DEG * standardCos;
  const maxY = EARTH_RADIUS_METERS * bbox[3] * DEG;
  return Object.freeze({
    lon: ((x * METERS_PER_TILE + minX) / (EARTH_RADIUS_METERS * DEG * standardCos)) + projection.lon0,
    lat: (maxY - y * METERS_PER_TILE) / (EARTH_RADIUS_METERS * DEG),
  });
}

function freezeRegion(region) {
  const projectedArrival = (point) => {
    if (!point) return null;
    const projected = projectedTile(region, point.lon, point.lat);
    const offset = point.arrivalOffset || [0, 0];
    if (!Array.isArray(offset) || offset.length !== 2 || !offset.every(Number.isInteger)) {
      throw new TypeError(`${point.id}.arrivalOffset must be an integer [x, y] pair`);
    }
    return Object.freeze({
      ...point,
      ...(point.arrivalOffset ? { arrivalOffset: Object.freeze([...point.arrivalOffset]) } : {}),
      tile: Object.freeze({ x: projected.x + offset[0], y: projected.y + offset[1] }),
    });
  };
  const gate = projectedArrival(region.gate);
  const airGate = region.airGate
    ? projectedArrival(region.airGate) : null;
  const airArrival = region.airArrival
    ? projectedArrival(region.airArrival) : null;
  return Object.freeze({
    ...region,
    bbox: Object.freeze([...region.bbox]),
    projection: Object.freeze({ ...region.projection }),
    manifest: Object.freeze({ ...region.manifest }),
    nodeSource: Object.freeze({ ...region.nodeSource }),
    overlaySources: Object.freeze((region.overlaySources || []).map((source) => Object.freeze({
      ...source,
      style: Object.freeze({ ...source.style }),
    }))),
    gate,
    airGate,
    airArrival,
  });
}

export const OVERWORLD_REGIONS = Object.freeze({
  'asia-pacific': freezeRegion({
    id: 'asia-pacific',
    sceneId: 'overworld:asia-pacific',
    label: '아시아·태평양',
    releaseEligible: false,
    width: 2631,
    height: 2669,
    bbox: [60, -47, 180, 61],
    projection: {
      id: 'apac-equirectangular-screen-axis-v1',
      method: 'equirectangular',
      axisMode: 'screen-axis',
      lon0: 125,
      lat0: 27.5,
      standardLat: 27.5,
    },
    assetBaseUrl: '/assets/overworld',
    manifest: {
      regionId: 'asia-pacific-playability-preview-v1',
      schemaVersion: 1,
      regionHash: '17e9935e9c81775d8b4e0f91b9f67259458444e78d17b6933243bf07e889fdf1',
      projectionManifestHash: 'ef9de068363aa70971dc7beda5128690d4d0c6f3b052b9a43bd1a2f1d10a4d1c',
    },
    nodeSource: {
      regionId: 'asia-pacific-transport-nodes-preview-v1',
      regionHash: 'ac65a1b4c1b4ea371c0e010adab69d9155f7fdfd038c1bd4aeed5e11fded8f5b',
      projectionManifestHash: 'ef9de068363aa70971dc7beda5128690d4d0c6f3b052b9a43bd1a2f1d10a4d1c',
      width: 2631,
      height: 2669,
      pathPrefix: 'nodes',
    },
    overlaySources: [
      {
        regionId: 'asia-pacific-terrain-preview-v1',
        regionHash: '55a7c3d2665600dc5bf5def2368b005f7b7b2fbbc5cf37f2a8cbdc9c52e32610',
        projectionManifestHash: 'ef9de068363aa70971dc7beda5128690d4d0c6f3b052b9a43bd1a2f1d10a4d1c',
        width: 2631,
        height: 2669,
        kind: 'river-segments',
        pathPrefix: 'rivers',
        style: { color: 0x4f8faa, alpha: 0.88, widthTiles: 0.08, rankStepTiles: 0.018, maxScaleRank: 5, depth: 1 },
      },
      {
        regionId: 'asia-pacific-transport-preview-v1',
        regionHash: '362f2f38416475d75232c1d73d22c9931d4e4d2a43769b529fc96de98718201b',
        projectionManifestHash: 'ef9de068363aa70971dc7beda5128690d4d0c6f3b052b9a43bd1a2f1d10a4d1c',
        width: 2631,
        height: 2669,
        kind: 'rail-segments',
        pathPrefix: 'rail',
        style: { color: 0x5b4638, alpha: 0.84, widthTiles: 0.045, rankStepTiles: 0.006, maxScaleRank: 5, depth: 2 },
      },
    ],
    gate: {
      id: 'vladivostok-transsib',
      type: 'transsib-gate',
      label: '블라디보스토크 횡단열차역',
      contentLocale: 'ru',
      corridorStopId: 'vladivostok',
      lon: 131.8855,
      lat: 43.1155,
    },
    airArrival: {
      id: 'incheon-air-arrival',
      label: '인천공항',
      contentLocale: 'ko',
      airportCode: 'ICN',
      lon: 126.4407,
      lat: 37.4602,
      arrivalOffset: [4, 0],
    },
  }),
  emea: freezeRegion({
    id: 'emea',
    sceneId: 'overworld:emea',
    label: '유럽·지중해·중동',
    releaseEligible: false,
    width: 964,
    height: 1137,
    bbox: [-11, 20, 50, 66],
    projection: {
      id: 'emea-equirectangular-screen-axis-v1',
      method: 'equirectangular',
      axisMode: 'screen-axis',
      lon0: 25,
      lat0: 45,
      standardLat: 50.25,
    },
    assetBaseUrl: '/assets/overworld',
    manifest: {
      regionId: 'europe-mediterranean-middle-east-playability-preview-v1',
      schemaVersion: 1,
      regionHash: '1cbab17ae4f9c8631aa74f2c8d3c42c39c54d8b651e81f72267d67e1bcde5fb3',
      projectionManifestHash: '7e579e41f15467366187c478f0dcd48e02a3c17ea9e0d0265dfc537e8208aeb9',
    },
    nodeSource: {
      regionId: 'europe-mediterranean-middle-east-transport-nodes-preview-v1',
      regionHash: '68e92866ef5556d5a0251bc6038e82d2c95d9a9d2d0b858151547bbcfe117697',
      projectionManifestHash: '7e579e41f15467366187c478f0dcd48e02a3c17ea9e0d0265dfc537e8208aeb9',
      width: 964,
      height: 1137,
      pathPrefix: 'nodes',
    },
    overlaySources: [
      {
        regionId: 'europe-mediterranean-middle-east-terrain-preview-v1',
        regionHash: '4232e35ecbd9c53fb5fd7f184377a8ca7867588ce030673d62edb018484fee28',
        projectionManifestHash: '7e579e41f15467366187c478f0dcd48e02a3c17ea9e0d0265dfc537e8208aeb9',
        width: 964,
        height: 1137,
        kind: 'river-segments',
        pathPrefix: 'rivers',
        style: { color: 0x4f8faa, alpha: 0.88, widthTiles: 0.08, rankStepTiles: 0.018, maxScaleRank: 5, depth: 1 },
      },
      {
        regionId: 'europe-mediterranean-middle-east-transport-preview-v1',
        regionHash: 'af317944cf983ac8cf36f2d24d8d2fe714c832d6d9d54c93360fafe3acc2e961',
        projectionManifestHash: '7e579e41f15467366187c478f0dcd48e02a3c17ea9e0d0265dfc537e8208aeb9',
        width: 964,
        height: 1137,
        kind: 'rail-segments',
        pathPrefix: 'rail',
        style: { color: 0x5b4638, alpha: 0.84, widthTiles: 0.045, rankStepTiles: 0.006, maxScaleRank: 5, depth: 2 },
      },
      {
        regionId: 'europe-mediterranean-middle-east-boundary-preview-v1',
        regionHash: '29053acb53bdb93305fff32414f3be96e605bab06dde53c69343dfec375ba8a6',
        projectionManifestHash: '7e579e41f15467366187c478f0dcd48e02a3c17ea9e0d0265dfc537e8208aeb9',
        width: 964,
        height: 1137,
        kind: 'boundary-segments',
        pathPrefix: 'boundaries',
        style: {
          color: 0x6f665f,
          neutralDisputedColor: 0x8a817a,
          alpha: 0.72,
          neutralDisputedAlpha: 0.76,
          widthTiles: 0.035,
          rankStepTiles: 0.003,
          maxScaleRank: 10,
          dashTiles: 0.18,
          gapTiles: 0.14,
          depth: 1.5,
        },
      },
    ],
    gate: {
      id: 'moscow-transsib',
      type: 'transsib-gate',
      label: '모스크바 횡단열차역',
      contentLocale: 'ru',
      corridorStopId: 'moscow',
      lon: 37.6173,
      lat: 55.7558,
    },
    airGate: {
      id: 'paris-cdg-air',
      type: 'air-gate',
      label: '파리 샤를 드골 공항',
      contentLocale: 'fr',
      airportCode: 'CDG',
      lon: 2.55,
      lat: 49.0097,
    },
  }),
});

export const OVERWORLD_REGION_LIST = Object.freeze(Object.values(OVERWORLD_REGIONS));

export function overworldRegionById(id) {
  return OVERWORLD_REGIONS[id] || null;
}

export function overworldRegionByScene(sceneId) {
  return OVERWORLD_REGION_LIST.find((region) => region.sceneId === sceneId) || null;
}

export function overworldRegionForCorridorStop(stopId) {
  return OVERWORLD_REGION_LIST.find((region) => region.gate.corridorStopId === stopId) || null;
}

export function projectOverworldRegionCoordinate(regionOrId, lon, lat) {
  const region = typeof regionOrId === 'string' ? overworldRegionById(regionOrId) : regionOrId;
  if (!region || !Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return projectedTile(region, lon, lat);
}

export function unprojectOverworldRegionTile(regionOrId, x, y) {
  const region = typeof regionOrId === 'string' ? overworldRegionById(regionOrId) : regionOrId;
  if (!region || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return unprojectedCoordinate(region, x, y);
}

export function isOverworldRegionTile(sceneId, x, y) {
  const region = overworldRegionByScene(sceneId);
  return !!region && Number.isInteger(x) && Number.isInteger(y)
    && x >= 0 && y >= 0 && x < region.width && y < region.height;
}

export function overworldRegionSpawn(regionOrId) {
  const region = typeof regionOrId === 'string' ? overworldRegionById(regionOrId) : regionOrId;
  if (!region) return null;
  return Object.freeze({ scene: region.sceneId, x: region.gate.tile.x, y: region.gate.tile.y });
}

export function overworldRegionAirSpawn(regionOrId) {
  const region = typeof regionOrId === 'string' ? overworldRegionById(regionOrId) : regionOrId;
  if (!region) return null;
  const gate = region.airArrival || region.airGate || region.gate;
  return Object.freeze({ scene: region.sceneId, x: gate.tile.x, y: gate.tile.y });
}

export function overworldRegionSpawnForCorridorStop(stopId) {
  return overworldRegionSpawn(overworldRegionForCorridorStop(stopId));
}
