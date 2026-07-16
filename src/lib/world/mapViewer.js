function markerFrom(item, source) {
  if (!item || !Array.isArray(item.tile) || item.tile.length !== 2) return null;
  const [x, y] = item.tile;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    id: `${source}:${item.id}`,
    source,
    name: item.name || item.nameJa || item.label || item.id,
    x,
    y,
  };
}

function uniqueMarkers(groups) {
  const seen = new Set();
  const markers = [];
  for (const [source, items] of groups) {
    for (const item of (Array.isArray(items) ? items : [])) {
      const marker = markerFrom(item, source);
      if (!marker) continue;
      const key = `${item.id}:${marker.x}:${marker.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      markers.push(marker);
    }
  }
  return markers;
}

export function worldMapMarkers(nodes) {
  return uniqueMarkers([['world', (Array.isArray(nodes) ? nodes : []).filter((node) => !node?.city)]]);
}

export function cityMapMarkers(city) {
  if (!city) return [];
  return uniqueMarkers([
    ['node', city.nodes],
    ['station', city.stations],
    ['transit', city.transitPoints],
  ]);
}

export function overworldRegionMarkers(region) {
  return [region?.gate, region?.airGate].filter((gate) => (
    gate && Number.isFinite(gate.tile?.x) && Number.isFinite(gate.tile?.y)
  )).map((gate) => ({
    id: `gate:${gate.id}`,
    source: 'gate',
    name: gate.label || gate.id,
    x: gate.tile.x,
    y: gate.tile.y,
  }));
}
