// 🧑‍🤝‍🧑 도시 NPC 만남 기록 — 스탬프 우주 밖(noStamp) 대화도 여행 수첩 진척으로 남긴다.
// 저장 형태는 주동선 발견과 같은 도시별 JSON 문자열 배열이며, 서버·DB에는 연결하지 않는다.
// 도시 목록은 고정하지 않는다. 로드된 도시 payload의 NPC 후보가 분모의 단일 진실원이다.

import { npcMeetingStorageKey } from '../../lib/world/storageSchema.js';

export { npcMeetingStorageKey };

export function isNpcMeetingCity(cityId) {
  return typeof cityId === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cityId);
}

// S13 직접 대화 NPC와 채움 라운드 전용 NPC를 같은 계약으로 판정한다.
// chapter와 공용 npc 키를 함께 가진 기존 문화도어 노드는 만남 후보가 아니며,
// 채움 NPC는 node.id와 같은 전용 스크립트 키로 자동 포섭된다.
export function isNpcMeetingCandidate(node) {
  return (
    node?.kind === 'npc'
    && node.noStamp === true
    && typeof node.npc === 'string'
    && node.npc.length > 0
    && typeof node.id === 'string'
    && node.id.length > 0
    && (
      typeof node.chapter !== 'string'
      || node.chapter.length === 0
      || node.npc === node.id
    )
  );
}

function defaultStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function loadNpcMeetingIds(cityId, storage = defaultStorage()) {
  if (!isNpcMeetingCity(cityId) || !storage) return new Set();
  try {
    const parsed = JSON.parse(storage.getItem(npcMeetingStorageKey(cityId)) ?? '[]');
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id) => typeof id === 'string' && id.length > 0));
  } catch {
    return new Set();
  }
}

export function saveNpcMeetingIds(cityId, metIds, storage = defaultStorage()) {
  if (!isNpcMeetingCity(cityId) || !(metIds instanceof Set) || !storage) return false;
  try {
    storage.setItem(
      npcMeetingStorageKey(cityId),
      JSON.stringify([...metIds]
        .filter((id) => typeof id === 'string' && id.length > 0)
        .sort()),
    );
    return true;
  } catch {
    return false;
  }
}

// 완주 콜백은 현재 도시와 실제 상호작용 node.id만 넘긴다. 동일 NPC 재완주는 재기록하지 않는다.
export function recordNpcMeeting({
  cityId,
  node,
  storage = defaultStorage(),
} = {}) {
  if (
    !isNpcMeetingCity(cityId)
    || !isNpcMeetingCandidate(node)
  ) return false;
  const metIds = loadNpcMeetingIds(cityId, storage);
  if (metIds.has(node.id)) return true;
  metIds.add(node.id);
  return saveNpcMeetingIds(cityId, metIds, storage);
}
