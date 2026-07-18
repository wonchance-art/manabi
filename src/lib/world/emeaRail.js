const SCENE_ID = 'overworld:emea';

const freezeHub = (hub) => Object.freeze({
  ...hub,
  tile: Object.freeze([...hub.tile]),
});

const freezeLink = ([first, second]) => Object.freeze([first, second]);

export const EMEA_RAIL_NETWORK = Object.freeze({
  schemaVersion: 1,
  releaseEligible: true,
  sceneId: SCENE_ID,
  routeId: 'emea-rail-network-v1',
  timingStatus: 'owner-decision-required',
  hubs: Object.freeze([
    freezeHub({ id: 'berlin-rail-hub', label: '베를린 철도 허브', contentLocale: 'de', tile: [386, 333] }),
    freezeHub({ id: 'istanbul-rail-hub', label: '이스탄불 철도 허브', contentLocale: 'tr', tile: [632, 617] }),
    freezeHub({ id: 'london-rail-hub', label: '런던 철도 허브', contentLocale: 'en', tile: [172, 358] }),
    freezeHub({ id: 'madrid-rail-hub', label: '마드리드 철도 허브', contentLocale: 'es', tile: [115, 632] }),
    freezeHub({ id: 'paris-rail-hub', label: '파리 철도 허브', contentLocale: 'fr', tile: [211, 424] }),
    freezeHub({ id: 'rome-rail-hub', label: '로마 철도 허브', contentLocale: 'it', tile: [371, 595] }),
    freezeHub({ id: 'vienna-rail-hub', label: '빈 철도 허브', contentLocale: 'de', tile: [433, 440] }),
  ]),
  links: Object.freeze([
    freezeLink(['madrid-rail-hub', 'paris-rail-hub']),
    freezeLink(['paris-rail-hub', 'berlin-rail-hub']),
    freezeLink(['berlin-rail-hub', 'vienna-rail-hub']),
    freezeLink(['vienna-rail-hub', 'rome-rail-hub']),
    freezeLink(['vienna-rail-hub', 'istanbul-rail-hub']),
  ]),
});

const hubById = (config, hubId) => config.hubs.find((hub) => hub.id === hubId) || null;

function neighborsByHub(config) {
  const neighbors = new Map(config.hubs.map((hub) => [hub.id, []]));
  for (const [first, second] of config.links) {
    if (!neighbors.has(first) || !neighbors.has(second) || first === second) {
      throw new Error(`invalid EMEA rail link: ${first}:${second}`);
    }
    neighbors.get(first).push(second);
    neighbors.get(second).push(first);
  }
  for (const values of neighbors.values()) values.sort();
  return neighbors;
}

export function emeaRailHubSpawn(hubId, config = EMEA_RAIL_NETWORK) {
  const hub = hubById(config, hubId);
  if (!hub) return null;
  return Object.freeze({ scene: config.sceneId, x: hub.tile[0], y: hub.tile[1] });
}

export function planEmeaRailRoute(originId, terminalId, config = EMEA_RAIL_NETWORK) {
  if (!hubById(config, originId)) throw new Error(`unknown EMEA rail origin: ${originId}`);
  if (!hubById(config, terminalId)) throw new Error(`unknown EMEA rail terminal: ${terminalId}`);
  if (originId === terminalId) throw new Error('origin and terminal must differ');

  const neighbors = neighborsByHub(config);
  const queue = [originId];
  const previous = new Map([[originId, null]]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    if (current === terminalId) break;
    for (const next of neighbors.get(current)) {
      if (previous.has(next)) continue;
      previous.set(next, current);
      queue.push(next);
    }
  }
  if (!previous.has(terminalId)) throw new Error(`EMEA rail route is disconnected: ${originId}:${terminalId}`);

  const stops = [];
  for (let current = terminalId; current !== null; current = previous.get(current)) stops.push(current);
  return Object.freeze(stops.reverse());
}

export function emeaRailDestinations(originId, config = EMEA_RAIL_NETWORK) {
  if (!hubById(config, originId)) throw new Error(`unknown EMEA rail origin: ${originId}`);
  const neighbors = neighborsByHub(config);
  const reachable = new Set([originId]);
  const queue = [originId];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    for (const next of neighbors.get(queue[cursor])) {
      if (reachable.has(next)) continue;
      reachable.add(next);
      queue.push(next);
    }
  }
  return Object.freeze(config.hubs.filter(({ id }) => id !== originId && reachable.has(id)));
}

export function prepareEmeaRailTrip({ originId, terminalId }, config = EMEA_RAIL_NETWORK) {
  const stopIds = planEmeaRailRoute(originId, terminalId, config);
  return Object.freeze({
    schemaVersion: 1,
    routeId: config.routeId,
    sceneId: config.sceneId,
    timingStatus: config.timingStatus,
    phase: 'awaiting-terminal-persistence',
    originId,
    terminalId,
    stopIds,
    currentStopIndex: 0,
    terminalSpawn: emeaRailHubSpawn(terminalId, config),
    terminalPersisted: false,
  });
}

export function confirmEmeaRailTerminalPersistence(trip, persistedSpawn) {
  if (!trip || trip.phase !== 'awaiting-terminal-persistence') {
    throw new Error('trip must be awaiting terminal persistence');
  }
  const expected = trip.terminalSpawn;
  const matches = persistedSpawn?.scene === expected.scene
    && Number(persistedSpawn?.x) === expected.x
    && Number(persistedSpawn?.y) === expected.y;
  if (!matches) throw new Error('persisted spawn does not match the trip terminal');
  return Object.freeze({ ...trip, phase: 'ready-to-board', terminalPersisted: true });
}

export async function persistEmeaRailTerminalBeforeBoard(trip, persistPosition) {
  if (typeof persistPosition !== 'function') throw new TypeError('persistPosition must be a function');
  const persisted = await persistPosition(trip?.terminalSpawn);
  if (persisted !== true) throw new Error('terminal persistence must succeed before boarding');
  return confirmEmeaRailTerminalPersistence(trip, trip.terminalSpawn);
}

export function boardEmeaRailTrip(trip) {
  if (!trip?.terminalPersisted || trip.phase !== 'ready-to-board') {
    throw new Error('terminal persistence is required before boarding');
  }
  return Object.freeze({
    ...trip,
    phase: 'riding',
    fromId: trip.stopIds[0],
    toId: trip.stopIds[1],
  });
}

export function arriveEmeaRailTrip(trip) {
  if (!trip?.terminalPersisted || trip.phase !== 'riding') throw new Error('trip must be riding');
  const nextIndex = trip.currentStopIndex + 1;
  const isTerminal = nextIndex === trip.stopIds.length - 1;
  const arrived = {
    ...trip,
    phase: isTerminal ? 'terminal' : 'stopped',
    currentStopIndex: nextIndex,
    stopId: trip.stopIds[nextIndex],
    canDisembark: true,
    persistable: false,
    ...(isTerminal ? { fallbackSpawn: trip.terminalSpawn } : {}),
  };
  delete arrived.fromId;
  delete arrived.toId;
  return Object.freeze(arrived);
}

export function continueEmeaRailTrip(trip) {
  if (!trip?.terminalPersisted || trip.phase !== 'stopped') {
    throw new Error('trip must be stopped at an intermediate hub');
  }
  const riding = {
    ...trip,
    phase: 'riding',
    fromId: trip.stopIds[trip.currentStopIndex],
    toId: trip.stopIds[trip.currentStopIndex + 1],
    canDisembark: false,
    persistable: false,
  };
  delete riding.stopId;
  return Object.freeze(riding);
}

export function disembarkEmeaRailTrip(trip, config = EMEA_RAIL_NETWORK) {
  if (!trip?.terminalPersisted) throw new Error('terminal persistence is required before disembarking');
  if (!trip.canDisembark || !['stopped', 'terminal'].includes(trip.phase)) {
    throw new Error('the train must be stopped before disembarking');
  }
  const spawn = emeaRailHubSpawn(trip.stopId, config);
  if (!spawn) throw new Error(`unknown EMEA rail hub: ${trip.stopId}`);
  return Object.freeze({
    phase: 'disembarked',
    stopId: trip.stopId,
    spawn,
    localState: Object.freeze({ ...spawn, persistable: true }),
  });
}

export function emeaRailLogoutFallback(trip) {
  if (!trip?.terminalPersisted || !trip.terminalSpawn) return null;
  return trip.terminalSpawn;
}
