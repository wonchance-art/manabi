import { activeVehiclesAt } from '../../lib/world/transit';
import { createOverworldRoute } from '../../lib/world/overworldOverlay.js';
import { WORLD_NODES } from './worldNodes';

const nodeById = new Map(WORLD_NODES.map((node) => [node.id, node]));
const busanPort = nodeById.get('busan-port');
const fukuokaPort = nodeById.get('fukuoka-port');

if (!busanPort || !fukuokaPort) throw new Error('overworld ferry nodes are missing');

export const OVERWORLD_ROUTES = Object.freeze([
  createOverworldRoute({
    id: 'busan-fukuoka-ferry',
    mode: 'ferry',
    points: [busanPort.tile, fukuokaPort.tile],
    color: 0xf4f0d0,
    alpha: 0.72,
    widthTiles: 0.12,
  }),
]);

export const OVERWORLD_TRANSIT_STOPS = Object.freeze([
  Object.freeze({ id: busanPort.id, tile: Object.freeze([...busanPort.tile]) }),
  Object.freeze({ id: fukuokaPort.id, tile: Object.freeze([...fukuokaPort.tile]) }),
]);

export const OVERWORLD_TRANSIT_LINES = Object.freeze([
  Object.freeze({
    id: 'busan-fukuoka-ferry',
    mode: 'ferry',
    stopIds: Object.freeze([busanPort.id, fukuokaPort.id]),
    segmentMinutes: Object.freeze([180]),
    dwellMinutes: 0,
    serviceWindows: Object.freeze([
      Object.freeze({ startMinute: 0, endMinute: 1440, headwayMinutes: 360 }),
    ]),
  }),
]);

export function activeOverworldVehiclesAt(totalGameMinutes) {
  if (!Number.isFinite(totalGameMinutes)) return [];
  return activeVehiclesAt(OVERWORLD_TRANSIT_LINES, OVERWORLD_TRANSIT_STOPS, totalGameMinutes)
    .map((vehicle) => Object.freeze({
      id: vehicle.runId,
      routeId: vehicle.line.id,
      mode: vehicle.line.mode,
      progress: vehicle.direction === 1 ? vehicle.progress : 1 - vehicle.progress,
    }));
}
