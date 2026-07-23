import {
  loadNpcMeetingIds,
  NPC_MEETING_CITY_IDS,
} from './npcMeetings.js';

// P1 lazy city registry에서 상세 payload를 요청할 S13 정본 범위.
// 분모는 로드한 도시 nodes의 대화 가능한 NPC만 신뢰하고 저장 ID와 교집합한다.
export const STAMP_ALBUM_NPC_MEETING_CITY_IDS = NPC_MEETING_CITY_IDS;

const NPC_MEETING_CITY_ID_SET = new Set(STAMP_ALBUM_NPC_MEETING_CITY_IDS);

function cityIdForNode(node) {
  return node?.gate?.type === 'city' && typeof node.gate.to === 'string'
    ? node.gate.to
    : null;
}

export function stampAlbumNpcMeetingProgress(node, cityData, storage) {
  const cityId = cityIdForNode(node);
  if (!NPC_MEETING_CITY_ID_SET.has(cityId)) return null;

  const nodes = cityData?.[cityId]?.nodes;
  if (!Array.isArray(nodes)) return null;

  const canonicalIds = new Set(nodes
    .filter((candidate) => (
      candidate?.kind === 'npc'
      && candidate.noStamp === true
      && typeof candidate.npc === 'string'
      && candidate.npc.length > 0
      && typeof candidate.id === 'string'
      && candidate.id.length > 0
    ))
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
