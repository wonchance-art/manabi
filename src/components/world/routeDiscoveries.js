import bus from './bus.js';
import {
  DISCOVERY_MILESTONE_EVENT,
  claimDiscoveryMilestoneReward,
} from '../../lib/world/discoveryMilestones.js';
import { routeDiscoveryStorageKey } from '../../lib/world/storageSchema.js';

export const ROUTE_DISCOVERY_DURATION_MS = 4200;

export { routeDiscoveryStorageKey };

function defaultStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function loadRouteDiscoveryIds(cityId, storage = defaultStorage()) {
  if (!storage || typeof cityId !== 'string' || cityId.length === 0) return new Set();
  try {
    const parsed = JSON.parse(storage.getItem(routeDiscoveryStorageKey(cityId)) ?? '[]');
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id) => typeof id === 'string' && id.length > 0));
  } catch {
    return new Set();
  }
}

export function saveRouteDiscoveryIds(cityId, discoveredIds, storage = defaultStorage()) {
  if (!storage || !(discoveredIds instanceof Set)) return false;
  try {
    storage.setItem(
      routeDiscoveryStorageKey(cityId),
      JSON.stringify([...discoveredIds].sort()),
    );
    return true;
  } catch {
    return false;
  }
}

export function claimRouteDiscoveryAt({
  cityId,
  discoveries,
  discoveredIds,
  tx,
  ty,
  storage = defaultStorage(),
}) {
  if (!Array.isArray(discoveries) || !(discoveredIds instanceof Set)) return null;
  const discovery = discoveries.find(({ id, tile }) => (
    !discoveredIds.has(id) && tile?.[0] === tx && tile?.[1] === ty
  ));
  if (!discovery) return null;
  discoveredIds.add(discovery.id);
  const saved = saveRouteDiscoveryIds(cityId, discoveredIds, storage);
  if (saved) {
    const reward = claimDiscoveryMilestoneReward({
      cityId,
      discoveries,
      discoveredIds,
      storage,
    });
    if (reward?.unlocked.length) {
      bus.emit(DISCOVERY_MILESTONE_EVENT, reward.unlocked);
    }
  }
  return discovery;
}
