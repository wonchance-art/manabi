import { unproject } from './mapGeo.js';
import { projectOverworldRegionCoordinate } from './overworldRegions.js';

export const LEGACY_WORLD_REGION_ID = 'asia-pacific';

const roundCoordinate = (value) => Number(value.toFixed(6));

function immutablePair(value, label) {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(Number.isInteger)) {
    throw new TypeError(`${label} must be an integer [x, y] pair`);
  }
  return Object.freeze([...value]);
}

export function migrateLegacyWorldNode(node) {
  if (!node || typeof node.id !== 'string' || node.id.length === 0) {
    throw new TypeError('legacy world node must have a non-empty id');
  }

  const legacyTile = immutablePair(node.tile, `${node.id}.tile`);
  const hasVerifiedCoordinate = Number.isFinite(node.lon) && Number.isFinite(node.lat);
  const coordinate = hasVerifiedCoordinate
    ? { lon: node.lon, lat: node.lat }
    : unproject(legacyTile[0], legacyTile[1]);
  const lon = roundCoordinate(coordinate.lon);
  const lat = roundCoordinate(coordinate.lat);
  const projected = projectOverworldRegionCoordinate(LEGACY_WORLD_REGION_ID, lon, lat);
  if (!projected) throw new Error(`failed to project legacy world node ${node.id}`);

  const arrivalOffset = immutablePair(node.arrivalOffset || [0, 0], `${node.id}.arrivalOffset`);
  const overworldTile = Object.freeze([
    projected.x + arrivalOffset[0],
    projected.y + arrivalOffset[1],
  ]);

  return Object.freeze({
    ...node,
    tile: legacyTile,
    legacyTile,
    regionId: LEGACY_WORLD_REGION_ID,
    lon,
    lat,
    geoSource: hasVerifiedCoordinate ? 'verified-input' : 'legacy-tile-derived',
    arrivalOffset,
    overworldTile,
  });
}

export function worldNodeGeoManifest(nodes) {
  return Object.freeze([...nodes]
    .sort((a, b) => a.id.localeCompare(b.id, 'en'))
    .map((node) => Object.freeze({
      id: node.id,
      regionId: node.regionId,
      legacyTile: Object.freeze([...node.legacyTile]),
      lon: node.lon,
      lat: node.lat,
      geoSource: node.geoSource,
      arrivalOffset: Object.freeze([...node.arrivalOffset]),
      overworldTile: Object.freeze([...node.overworldTile]),
    })));
}
