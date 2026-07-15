export const OVERWORLD_FIXTURE_BASE_URL = '/assets/overworld';

export const OVERWORLD_FIXTURE_PROJECTION = Object.freeze({
  id: 'korea-japan-legacy-equirectangular-screen-axis-v1',
  projection: 'equirectangular',
  axisMode: 'screen-axis',
  lon0: 123.5,
  lat0: 46,
  kx: 19.5,
  ky: 24.7,
  tileMeters: 4500,
});

export const OVERWORLD_FIXTURE_MANIFEST = Object.freeze({
  regionId: 'korea-japan-fixture',
  schemaVersion: 1,
  regionHash: '252e45e282d99a6a79a9a50d552195f06b51e6733bebb7f707406262309cc6c4',
  projectionManifestHash: 'c0e742c38691a8a6095dd3291ebd92d2cafaebe9800a35ced2fe34001ef97dd3',
});
