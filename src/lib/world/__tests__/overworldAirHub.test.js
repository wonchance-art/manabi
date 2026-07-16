import { describe, expect, it } from 'vitest';
import {
  overworldAirDestinationById,
  overworldAirDestinations,
} from '../overworldAirHub';
import { OVERWORLD_REGION_LIST, overworldRegionSpawn } from '../overworldRegions';

const releasedRegion = Object.freeze({
  id: 'released',
  label: '출시 지역',
  sceneId: 'overworld:released',
  releaseEligible: true,
  gate: Object.freeze({ tile: Object.freeze({ x: 3, y: 4 }) }),
});

const previewRegion = Object.freeze({
  id: 'preview',
  label: '미리보기 지역',
  sceneId: 'overworld:preview',
  releaseEligible: false,
  gate: Object.freeze({ tile: Object.freeze({ x: 8, y: 9 }) }),
});

describe('overworld air hub destinations', () => {
  it('keeps unreleased regions hidden without explicit preview access', () => {
    expect(overworldAirDestinations({ regions: [previewRegion] })).toEqual([]);
    expect(overworldAirDestinations({ regions: [releasedRegion, previewRegion] })).toEqual([
      expect.objectContaining({ id: 'released', preview: false }),
    ]);
  });

  it('exposes preview regions only when preview access is explicit', () => {
    const destinations = overworldAirDestinations({
      regions: [releasedRegion, previewRegion],
      includePreview: true,
    });

    expect(destinations.map(({ id }) => id)).toEqual(['preview', 'released']);
    expect(destinations[0]).toEqual({
      id: 'preview',
      label: '미리보기 지역',
      sceneId: 'overworld:preview',
      preview: true,
      spawn: { scene: 'overworld:preview', x: 8, y: 9 },
    });
    expect(Object.isFrozen(destinations)).toBe(true);
    expect(Object.isFrozen(destinations[0])).toBe(true);
  });

  it('maps the checked-in region gates without changing their spawn contract', () => {
    const destinations = overworldAirDestinations({ includePreview: true });
    expect(destinations).toHaveLength(OVERWORLD_REGION_LIST.length);
    destinations.forEach((destination) => {
      const region = OVERWORLD_REGION_LIST.find(({ id }) => id === destination.id);
      expect(destination.spawn).toEqual(overworldRegionSpawn(region));
      expect(destination.preview).toBe(true);
    });
  });

  it('fails closed on duplicate or malformed region definitions', () => {
    expect(() => overworldAirDestinations({ regions: [releasedRegion, releasedRegion] }))
      .toThrow('duplicate overworld air destination');
    expect(() => overworldAirDestinations({ regions: [{ ...releasedRegion, releaseEligible: 'yes' }] }))
      .toThrow('releaseEligible must be boolean');
  });

  it('resolves only known destination ids', () => {
    const destinations = overworldAirDestinations({ regions: [releasedRegion] });
    expect(overworldAirDestinationById(destinations, 'released')?.sceneId).toBe('overworld:released');
    expect(overworldAirDestinationById(destinations, 'missing')).toBeNull();
    expect(overworldAirDestinationById(null, 'released')).toBeNull();
  });
});
