import { OVERWORLD_REGION_LIST, overworldRegionAirSpawn } from './overworldRegions';

const compareCodePoint = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

function assertRegion(region, index) {
  if (!region || typeof region !== 'object') throw new TypeError(`regions[${index}] must be an object`);
  for (const key of ['id', 'label', 'sceneId']) {
    if (typeof region[key] !== 'string' || region[key].length === 0) {
      throw new TypeError(`regions[${index}].${key} must be a non-empty string`);
    }
  }
  if (typeof region.releaseEligible !== 'boolean') {
    throw new TypeError(`regions[${index}].releaseEligible must be boolean`);
  }
}

export function overworldAirDestinations({
  regions = OVERWORLD_REGION_LIST,
  includePreview = false,
} = {}) {
  if (!Array.isArray(regions)) throw new TypeError('regions must be an array');
  if (typeof includePreview !== 'boolean') throw new TypeError('includePreview must be boolean');

  const ids = new Set();
  const destinations = [];
  regions.forEach((region, index) => {
    assertRegion(region, index);
    if (ids.has(region.id)) throw new Error(`duplicate overworld air destination: ${region.id}`);
    ids.add(region.id);
    if (!region.releaseEligible && !includePreview) return;

    const spawn = overworldRegionAirSpawn(region);
    if (!spawn) throw new Error(`overworld air destination has no spawn: ${region.id}`);
    destinations.push(Object.freeze({
      id: region.id,
      label: region.label,
      sceneId: region.sceneId,
      preview: !region.releaseEligible,
      spawn,
    }));
  });

  destinations.sort((left, right) => compareCodePoint(left.id, right.id));
  return Object.freeze(destinations);
}

export function overworldAirDestinationById(destinations, id) {
  if (!Array.isArray(destinations) || typeof id !== 'string') return null;
  return destinations.find((destination) => destination.id === id) || null;
}
