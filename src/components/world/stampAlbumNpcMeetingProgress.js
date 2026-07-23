import {
  isNpcMeetingCandidate,
  loadNpcMeetingIds,
} from './npcMeetings.js';

function cityIdForNode(node) {
  return node?.gate?.type === 'city' && typeof node.gate.to === 'string'
    ? node.gate.to
    : null;
}

export function stampAlbumNpcMeetingProgress(node, cityData, storage) {
  const cityId = cityIdForNode(node);
  if (!cityId) return null;

  const nodes = cityData?.[cityId]?.nodes;
  if (!Array.isArray(nodes)) return null;

  const canonicalIds = new Set(nodes
    .filter(isNpcMeetingCandidate)
    .map((candidate) => candidate.id));
  if (canonicalIds.size === 0) return null;

  const metIds = loadNpcMeetingIds(cityId, storage);
  let got = 0;
  for (const id of canonicalIds) if (metIds.has(id)) got += 1;

  return Object.freeze({
    cityId,
    got,
    total: canonicalIds.size,
    label: `만난 사람 ${got}/${canonicalIds.size}`,
  });
}
