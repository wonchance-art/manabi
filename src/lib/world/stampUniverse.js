// 여행 스탬프 단일 진실원 — 전국맵 66노드 뒤에 지역 오버월드 도시 게이트 19개를 붙인다.
// 순서는 저장 인덱스가 아니라 표시 계약이지만, 기존 앨범 66칸을 prefix로 보존하기 위해 고정한다.
// noStamp 는 도시 파사드·학습 도어 같은 상호작용 인스턴스의 명시적 금지 오버라이드다.

import { REGIONAL_WORLD_NODES, WORLD_NODES } from '../../components/world/worldNodes.js';

export const STAMP_ALBUM_NODES = Object.freeze([
  ...WORLD_NODES,
  ...REGIONAL_WORLD_NODES,
].filter((node) => node.noStamp !== true));

const STAMP_ALBUM_NODE_IDS = new Set(STAMP_ALBUM_NODES.map((node) => node.id));

export function isStampAlbumNodeId(nodeId) {
  return typeof nodeId === 'string' && STAMP_ALBUM_NODE_IDS.has(nodeId);
}

// ID 멤버십과 인스턴스별 noStamp 를 함께 본다. 같은 ID를 재사용한 파사드도 발급하지 않는다.
export function canCollectStamp(node) {
  return !!node && node.noStamp !== true && isStampAlbumNodeId(node.id);
}
