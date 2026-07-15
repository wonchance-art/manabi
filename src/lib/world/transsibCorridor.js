const SCENE_ID = 'transsib-corridor';
const EAST_TERMINAL_ID = 'vladivostok';
const WEST_TERMINAL_ID = 'moscow';

const freezeStop = (stop) => Object.freeze({ ...stop, tile: Object.freeze([...stop.tile]) });

export const TRANS_SIBERIAN_CORRIDOR = Object.freeze({
  schemaVersion: 1,
  releaseEligible: false,
  sceneId: SCENE_ID,
  routeId: 'transsib-main-v1',
  timingStatus: 'provisional-owner-review',
  headwayMinutes: 15,
  dwellMinutes: 2,
  stops: Object.freeze([
    freezeStop({ id: EAST_TERMINAL_ID, name: 'Владивосток', lon: 131.8855, lat: 43.1155, tile: [8, 8] }),
    freezeStop({ id: 'khabarovsk', name: 'Хабаровск', lon: 135.0719, lat: 48.4802, tile: [32, 8] }),
    freezeStop({ id: 'chita', name: 'Чита', lon: 113.5009, lat: 52.0336, tile: [56, 8] }),
    freezeStop({ id: 'irkutsk', name: 'Иркутск', lon: 104.2807, lat: 52.2864, tile: [80, 8] }),
    freezeStop({ id: 'krasnoyarsk', name: 'Красноярск', lon: 92.8932, lat: 56.0153, tile: [104, 8] }),
    freezeStop({ id: 'novosibirsk', name: 'Новосибирск', lon: 82.9204, lat: 55.0302, tile: [128, 8] }),
    freezeStop({ id: 'yekaterinburg', name: 'Екатеринбург', lon: 60.5975, lat: 56.8389, tile: [152, 8] }),
    freezeStop({ id: 'kazan', name: 'Казань', lon: 49.1064, lat: 55.7961, tile: [176, 8] }),
    freezeStop({ id: WEST_TERMINAL_ID, name: 'Москва', lon: 37.6173, lat: 55.7558, tile: [200, 8] }),
  ]),
  segmentMinutes: Object.freeze([18, 22, 19, 16, 15, 18, 20, 16]),
});

const stopIndex = (config, stopId) => config.stops.findIndex((stop) => stop.id === stopId);
const stopById = (config, stopId) => config.stops.find((stop) => stop.id === stopId) || null;
const terminalIds = (config) => [config.stops[0]?.id, config.stops.at(-1)?.id];
const finiteMinute = (value, label) => {
  const minute = Number(value);
  if (!Number.isFinite(minute) || minute < 0) throw new RangeError(`${label} must be a non-negative finite minute`);
  return minute;
};
const nextDepartureMinute = (minute, headway) => Math.ceil(minute / headway) * headway;

export function corridorStopSpawn(stopId, config = TRANS_SIBERIAN_CORRIDOR) {
  const stop = stopById(config, stopId);
  if (!stop) return null;
  return Object.freeze({ scene: config.sceneId, x: stop.tile[0], y: stop.tile[1] });
}

export function isCorridorPlatformTile(x, y, config = TRANS_SIBERIAN_CORRIDOR) {
  return config.stops.some((stop) => stop.tile[0] === x && stop.tile[1] === y);
}

export function prepareCorridorTrip({ originId, terminalId, nowMinute }, config = TRANS_SIBERIAN_CORRIDOR) {
  const originIndex = stopIndex(config, originId);
  const terminalIndex = stopIndex(config, terminalId);
  const terminals = terminalIds(config);
  const minute = finiteMinute(nowMinute, 'nowMinute');
  if (originIndex < 0) throw new Error(`unknown corridor origin: ${originId}`);
  if (!terminals.includes(terminalId)) throw new Error(`corridor destination must be a terminal: ${terminalId}`);
  if (originIndex === terminalIndex) throw new Error('origin and terminal must differ');
  const direction = terminalIndex > originIndex ? 1 : -1;
  const headway = Math.max(1, Number(config.headwayMinutes) || 1);
  return Object.freeze({
    schemaVersion: 1,
    routeId: config.routeId,
    sceneId: config.sceneId,
    phase: 'awaiting-terminal-persistence',
    originId,
    terminalId,
    direction,
    preparedMinute: minute,
    departureMinute: nextDepartureMinute(minute, headway),
    terminalSpawn: corridorStopSpawn(terminalId, config),
    terminalPersisted: false,
  });
}

export function confirmCorridorTerminalPersistence(trip, persistedSpawn) {
  if (!trip || trip.phase !== 'awaiting-terminal-persistence') {
    throw new Error('trip must be awaiting terminal persistence');
  }
  const expected = trip.terminalSpawn;
  const matches = persistedSpawn?.scene === expected.scene
    && Number(persistedSpawn?.x) === expected.x
    && Number(persistedSpawn?.y) === expected.y;
  if (!matches) throw new Error('persisted spawn does not match the trip terminal');
  return Object.freeze({ ...trip, phase: 'waiting', terminalPersisted: true });
}

export async function persistCorridorTerminalBeforeBoard(trip, persistPosition) {
  if (typeof persistPosition !== 'function') throw new TypeError('persistPosition must be a function');
  const persisted = await persistPosition(trip?.terminalSpawn);
  if (persisted !== true) throw new Error('terminal persistence must succeed before boarding');
  return confirmCorridorTerminalPersistence(trip, trip.terminalSpawn);
}

function directedLegs(trip, config) {
  const originIndex = stopIndex(config, trip.originId);
  const terminalIndex = stopIndex(config, trip.terminalId);
  const legs = [];
  for (let index = originIndex; index !== terminalIndex; index += trip.direction) {
    const nextIndex = index + trip.direction;
    const segmentIndex = trip.direction === 1 ? index : nextIndex;
    legs.push(Object.freeze({
      fromId: config.stops[index].id,
      toId: config.stops[nextIndex].id,
      minutes: Math.max(1, Number(config.segmentMinutes[segmentIndex]) || 1),
    }));
  }
  return legs;
}

export function corridorTripStateAt(trip, nowMinute, config = TRANS_SIBERIAN_CORRIDOR) {
  const minute = finiteMinute(nowMinute, 'nowMinute');
  if (!trip?.terminalPersisted) {
    return Object.freeze({ phase: 'awaiting-terminal-persistence', persistable: false, terminalSpawn: trip?.terminalSpawn || null });
  }
  if (minute < trip.departureMinute) {
    return Object.freeze({
      phase: 'waiting', stopId: trip.originId, departureMinute: trip.departureMinute,
      persistable: false, canDisembark: false,
    });
  }

  const dwell = Math.max(0, Number(config.dwellMinutes) || 0);
  let cursor = trip.departureMinute;
  const legs = directedLegs(trip, config);
  for (let index = 0; index < legs.length; index += 1) {
    const leg = legs[index];
    const arrivalMinute = cursor + leg.minutes;
    if (minute < arrivalMinute) {
      return Object.freeze({
        phase: 'riding', fromId: leg.fromId, toId: leg.toId,
        progress: (minute - cursor) / leg.minutes, departureMinute: cursor, arrivalMinute,
        persistable: false, canDisembark: false,
      });
    }
    const isTerminal = index === legs.length - 1;
    if (isTerminal) {
      return Object.freeze({
        phase: 'terminal', stopId: leg.toId, arrivalMinute,
        persistable: false, canDisembark: true, fallbackSpawn: trip.terminalSpawn,
      });
    }
    const nextDeparture = arrivalMinute + dwell;
    if (minute < nextDeparture) {
      return Object.freeze({
        phase: 'stopped', stopId: leg.toId, arrivalMinute, departureMinute: nextDeparture,
        persistable: false, canDisembark: true,
      });
    }
    cursor = nextDeparture;
  }
  throw new Error('corridor trip timeline is incomplete');
}

export function disembarkCorridorTrip(trip, state, config = TRANS_SIBERIAN_CORRIDOR) {
  if (!trip?.terminalPersisted) throw new Error('terminal persistence is required before disembarking');
  if (!state?.canDisembark || !['stopped', 'terminal'].includes(state.phase)) {
    throw new Error('the train must be stopped before disembarking');
  }
  const spawn = corridorStopSpawn(state.stopId, config);
  if (!spawn) throw new Error(`unknown corridor stop: ${state.stopId}`);
  return Object.freeze({
    phase: 'disembarked', stopId: state.stopId, spawn,
    localState: Object.freeze({ ...spawn, persistable: true }),
  });
}

export function corridorLogoutFallback(trip) {
  if (!trip?.terminalPersisted || !trip.terminalSpawn) return null;
  return trip.terminalSpawn;
}
