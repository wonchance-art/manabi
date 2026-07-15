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

function freezeRegion(region) {
  const gateTile = projectedTile(region, region.gate.lon, region.gate.lat);
  return Object.freeze({
    ...region,
    bbox: Object.freeze([...region.bbox]),
    projection: Object.freeze({ ...region.projection }),
    manifest: Object.freeze({ ...region.manifest }),
    gate: Object.freeze({ ...region.gate, tile: gateTile }),
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
    gate: {
      id: 'vladivostok-transsib',
      label: '블라디보스토크 횡단열차역',
      corridorStopId: 'vladivostok',
      lon: 131.8855,
      lat: 43.1155,
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
    gate: {
      id: 'moscow-transsib',
      label: '모스크바 횡단열차역',
      corridorStopId: 'moscow',
      lon: 37.6173,
      lat: 55.7558,
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

export function overworldRegionSpawnForCorridorStop(stopId) {
  return overworldRegionSpawn(overworldRegionForCorridorStop(stopId));
}
