export const ROUTE_DISCOVERY_DURATION_MS = 4200;

export function routeDiscoveryStorageKey(cityId) {
  return `route-discoveries:${cityId}`;
}

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
  saveRouteDiscoveryIds(cityId, discoveredIds, storage);
  return discovery;
}
