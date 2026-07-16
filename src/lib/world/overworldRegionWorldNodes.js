function integerPair(value) {
  return Array.isArray(value) && value.length === 2 && value.every(Number.isInteger);
}

export function overworldRegionWorldNodeMode(node) {
  if (!node?.gate) return 'description';
  if (node.gate.type === 'city') return 'city';
  if (node.gate.type === 'ferry') return 'ferry';
  return 'blocked';
}

export function overworldRegionWorldNodes(region, nodes) {
  if (!region || typeof region.id !== 'string' || !Number.isInteger(region.width)
    || !Number.isInteger(region.height) || !Array.isArray(nodes)) return Object.freeze([]);

  return Object.freeze(nodes
    .filter((node) => node && !node.city && node.regionId === region.id
      && integerPair(node.overworldTile))
    .map((node) => {
      const mode = overworldRegionWorldNodeMode(node);
      return Object.freeze({
        node,
        tile: Object.freeze([...node.overworldTile]),
        mode,
        interactive: mode !== 'blocked',
      });
    })
    .filter(({ tile }) => tile[0] >= 0 && tile[1] >= 0
      && tile[0] < region.width && tile[1] < region.height)
    .sort((left, right) => left.node.id.localeCompare(right.node.id, 'en')));
}

export function nearestOverworldRegionWorldNode(entries, x, y, radius = 1) {
  if (!Array.isArray(entries) || !Number.isInteger(x) || !Number.isInteger(y)
    || !Number.isInteger(radius) || radius < 0) return null;

  return entries
    .filter(({ interactive, tile }) => interactive
      && Math.abs(x - tile[0]) <= radius && Math.abs(y - tile[1]) <= radius)
    .sort((left, right) => {
      const leftDistance = Math.abs(x - left.tile[0]) + Math.abs(y - left.tile[1]);
      const rightDistance = Math.abs(x - right.tile[0]) + Math.abs(y - right.tile[1]);
      return leftDistance - rightDistance || left.node.id.localeCompare(right.node.id, 'en');
    })[0]?.node || null;
}

export function resolveOverworldRegionFerry(entries, sourceNode, destinationId, sceneId) {
  if (!Array.isArray(entries) || sourceNode?.gate?.type !== 'ferry'
    || sourceNode.gate.to !== destinationId || typeof sceneId !== 'string' || sceneId.length === 0) return null;
  const destination = entries.find(({ node, mode }) => node.id === destinationId && mode === 'ferry');
  if (!destination || destination.node.gate.to !== sourceNode.id) return null;
  return Object.freeze({
    source: sourceNode,
    destination: destination.node,
    spawn: Object.freeze({
      scene: sceneId,
      x: destination.tile[0],
      y: destination.tile[1],
    }),
  });
}
