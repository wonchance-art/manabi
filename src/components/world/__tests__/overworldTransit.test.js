import { describe, expect, it } from 'vitest';
import { OVERWORLD_ROUTE_QUANTIZATION } from '../../../lib/world/overworldOverlay.js';
import { getNode } from '../worldNodes.js';
import {
  OVERWORLD_ROUTES,
  OVERWORLD_TRANSIT_LINES,
  OVERWORLD_TRANSIT_STOPS,
  activeOverworldVehiclesAt,
} from '../overworldTransit.js';

describe('오버월드 부산–후쿠오카 페리 fixture', () => {
  it('기존 항구 node ID와 타일을 그대로 route·시간표에 사용한다', () => {
    const busan = getNode('busan-port');
    const fukuoka = getNode('fukuoka-port');
    expect(OVERWORLD_TRANSIT_STOPS.map((stop) => stop.id)).toEqual(['busan-port', 'fukuoka-port']);
    expect(OVERWORLD_TRANSIT_LINES[0].stopIds).toEqual(['busan-port', 'fukuoka-port']);
    expect(OVERWORLD_ROUTES[0].pointsQ).toEqual([
      busan.tile.map((value) => value * OVERWORLD_ROUTE_QUANTIZATION),
      fukuoka.tile.map((value) => value * OVERWORLD_ROUTE_QUANTIZATION),
    ]);
  });

  it('같은 월드 시각은 같은 run ID·route 진행률을 만든다', () => {
    const first = activeOverworldVehiclesAt(90);
    const second = activeOverworldVehiclesAt(90);
    expect(first).toEqual(second);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ routeId: 'busan-fukuoka-ferry', mode: 'ferry', progress: 0.5 });
  });
});
