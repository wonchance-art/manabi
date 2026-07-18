import { describe, expect, it } from 'vitest';
import {
  JAGALCHI_MARKET_ACTS,
  JAGALCHI_MARKET_SCENE_KEY,
  nextJagalchiMarketActIndex,
} from '../jagalchiMarketScene.js';

describe('Jagalchi market scene skeleton', () => {
  it('locks the requested four-act order to stable structural ids', () => {
    expect(JAGALCHI_MARKET_SCENE_KEY).toBe('jagalchi-market-scene');
    expect(JAGALCHI_MARKET_ACTS.map((act) => act.id)).toEqual([
      'dawn-pier',
      'auction-floor',
      'hoe-alley',
      'breakwater-lighthouse',
    ]);
    expect(JAGALCHI_MARKET_ACTS.map((act) => act.texture)).toEqual([
      'jagalchi_dawn_pier',
      'jagalchi_auction_floor',
      'jagalchi_hoe_alley',
      'jagalchi_breakwater_lighthouse',
    ]);
  });

  it('advances deterministically and rejects every out-of-range boundary', () => {
    expect(nextJagalchiMarketActIndex(0)).toBe(1);
    expect(nextJagalchiMarketActIndex(1)).toBe(2);
    expect(nextJagalchiMarketActIndex(2)).toBe(3);
    expect(nextJagalchiMarketActIndex(3)).toBeNull();
    expect(nextJagalchiMarketActIndex(-1)).toBeNull();
    expect(nextJagalchiMarketActIndex(4)).toBeNull();
    expect(nextJagalchiMarketActIndex(1.5)).toBeNull();
    expect(nextJagalchiMarketActIndex('1')).toBeNull();
  });
});
