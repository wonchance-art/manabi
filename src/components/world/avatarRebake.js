// 아바타 변경 시 플레이어 텍스처를 재베이크할 (prefix, sceneKey) 정적 목록 — GameCanvas와
// 테스트가 공유하는 순수 계약(Codex #113 P1: 신규 이동 씬 누락 회귀 방지).
// ct_pc(도시 정밀맵)는 활성 도시를 런타임에 찾아야 해서 GameCanvas 쪽 특수 처리로 남긴다.
import { OVERWORLD_REGION_LIST } from '../../lib/world/overworldRegions';

export function overworldRegionAvatarPrefix(regionId) {
  return `region_pc_${regionId.replace(/[^a-z0-9]/g, '_')}`;
}

export const AVATAR_REBAKE_STATIC_TARGETS = Object.freeze([
  Object.freeze(['pc', 'world']),
  Object.freeze(['ax_pc', 'airport']),
  Object.freeze(['ts_pc', 'transsib-corridor']),
  ...OVERWORLD_REGION_LIST.map((region) => Object.freeze([
    overworldRegionAvatarPrefix(region.id),
    region.sceneId,
  ])),
]);
