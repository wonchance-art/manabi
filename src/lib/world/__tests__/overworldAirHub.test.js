import { describe, expect, it, vi } from 'vitest';
import {
  AIR_HUB_SAVE_ERROR_MESSAGE,
  overworldAirDestinationById,
  overworldAirDestinations,
  requestOverworldAirTravel,
} from '../overworldAirHub';
import {
  OVERWORLD_REGION_LIST,
  overworldRegionAirSpawn,
  overworldRegionSpawn,
} from '../overworldRegions';

const releasedRegion = Object.freeze({
  id: 'released',
  label: '출시 지역',
  sceneId: 'overworld:released',
  releaseEligible: true,
  gate: Object.freeze({ tile: Object.freeze({ x: 3, y: 4 }) }),
  airGate: Object.freeze({ tile: Object.freeze({ x: 5, y: 6 }) }),
  airArrival: Object.freeze({ tile: Object.freeze({ x: 7, y: 8 }) }),
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

  it('uses dedicated arrivals before air gates while keeping corridor spawns independent', () => {
    expect(overworldAirDestinations({ regions: [releasedRegion] })[0].spawn).toEqual({
      scene: 'overworld:released', x: 7, y: 8,
    });
    expect(overworldRegionSpawn(releasedRegion)).toEqual({
      scene: 'overworld:released', x: 3, y: 4,
    });
  });

  it('maps checked-in air gates and preserves legacy fallback regions', () => {
    const destinations = overworldAirDestinations({ includePreview: true });
    expect(destinations).toHaveLength(OVERWORLD_REGION_LIST.length);
    destinations.forEach((destination) => {
      const region = OVERWORLD_REGION_LIST.find(({ id }) => id === destination.id);
      expect(destination.spawn).toEqual(overworldRegionAirSpawn(region));
      expect(destination.preview).toBe(!region.releaseEligible);
    });
    expect(destinations.find(({ id }) => id === 'emea')?.spawn)
      .toEqual({ scene: 'overworld:emea', x: 214, y: 420 });
    expect(destinations.find(({ id }) => id === 'asia-pacific')?.spawn)
      .toEqual({ scene: 'overworld:asia-pacific', x: 1460, y: 582 });
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

  it('저장 실패는 E2 연결 안내와 같은 목적지 다시 시도를 제공한다', async () => {
    const destination = overworldAirDestinations({ regions: [releasedRegion] })[0];
    const persistPosition = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const setStatus = vi.fn();
    const transition = vi.fn();
    const request = () => requestOverworldAirTravel({
      destination,
      persistPosition,
      setStatus,
      transition,
    });

    await expect(request()).resolves.toBe(false);
    expect(transition).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenLastCalledWith({
      phase: 'error',
      destination,
      message: AIR_HUB_SAVE_ERROR_MESSAGE,
    });

    await expect(request()).resolves.toBe(true);
    expect(persistPosition).toHaveBeenNthCalledWith(1, destination.spawn);
    expect(persistPosition).toHaveBeenNthCalledWith(2, destination.spawn);
    expect(transition).toHaveBeenCalledOnce();
    expect(transition).toHaveBeenCalledWith(destination);
  });
});
