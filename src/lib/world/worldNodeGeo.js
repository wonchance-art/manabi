import { unproject } from './mapGeo.js';
import {
  overworldRegionById,
  projectOverworldRegionCoordinate,
} from './overworldRegions.js';

export const LEGACY_WORLD_REGION_ID = 'asia-pacific';

const roundCoordinate = (value) => Number(value.toFixed(6));

function integerPair(value) {
  return Array.isArray(value) && value.length === 2 && value.every(Number.isInteger);
}

function immutablePair(value, label) {
  if (!integerPair(value)) {
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

export function createRegionalWorldNode(node) {
  if (!node || typeof node.id !== 'string' || node.id.length === 0) {
    throw new TypeError('regional world node must have a non-empty id');
  }
  if (typeof node.regionId !== 'string' || node.regionId.length === 0) {
    throw new TypeError('regional world node must target a region');
  }
  const region = overworldRegionById(node.regionId);
  if (!region) throw new TypeError(`unknown overworld region: ${node.regionId}`);
  if (!Number.isFinite(node.lon) || !Number.isFinite(node.lat)) {
    throw new TypeError(`${node.id} must have verified lon/lat`);
  }

  const lon = roundCoordinate(node.lon);
  const lat = roundCoordinate(node.lat);
  const projected = projectOverworldRegionCoordinate(region, lon, lat);
  if (!projected) throw new Error(`failed to project regional world node ${node.id}`);
  const arrivalOffset = immutablePair(node.arrivalOffset || [0, 0], `${node.id}.arrivalOffset`);
  const overworldTile = Object.freeze([
    projected.x + arrivalOffset[0],
    projected.y + arrivalOffset[1],
  ]);

  return Object.freeze({
    ...node,
    lon,
    lat,
    geoSource: 'verified-input',
    arrivalOffset,
    overworldTile,
  });
}

export function worldNodeReturnSpawn(node) {
  if (!node) return null;
  if (node.regionId === LEGACY_WORLD_REGION_ID && integerPair(node.legacyTile)) {
    return Object.freeze({ scene: 'plaza', x: node.legacyTile[0], y: node.legacyTile[1] });
  }
  const region = overworldRegionById(node.regionId);
  if (!region || !integerPair(node.overworldTile)) return null;
  return Object.freeze({
    scene: region.sceneId,
    x: node.overworldTile[0],
    y: node.overworldTile[1],
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
