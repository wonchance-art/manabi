// 학습 월드 여행 스탬프 — 클라이언트 fetch 래퍼(로드/수집). 실패는 조용히 삼킨다(스탬프는 편의 기능).
//
// GameCanvas 가 마운트 시 loadStamps() 로 수집 상태를 씬에 채우고, 노드 첫 상호작용마다
// collectStamp(nodeId) 로 서버에 upsert 한다. API: /api/world/stamps (GET 목록 · POST {nodeId}).
// 순수부(parseStamps)만 분리해 vitest 로 응답 파싱을 검증한다(네트워크 미접촉).

import { isStampAlbumNodeId } from './stampUniverse.js';
import { GUEST_STAMPS_STORAGE_KEY } from './storageSchema.js';

export { GUEST_STAMPS_STORAGE_KEY };

function defaultStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

// API GET 응답(JSON)에서 nodeId 문자열 배열만 안전하게 추출한다(순수 · 부작용 0).
//   허용 형태: { stamps: [{ nodeId, at }, ...] } 또는 { stamps: ['seoul', ...] }.
//   깨진/누락 항목은 조용히 건너뛴다.
export function parseStamps(json) {
  const arr = json && Array.isArray(json.stamps) ? json.stamps : [];
  const ids = [];
  for (const s of arr) {
    const id = typeof s === 'string' ? s : (s && typeof s.nodeId === 'string' ? s.nodeId : null);
    if (id) ids.push(id);
  }
  return ids;
}

// 내 스탬프 목록(nodeId 배열)을 불러온다. 실패/미로그인/미적용이면 빈 배열.
export async function loadStamps() {
  try {
    const r = await fetch('/api/world/stamps', { credentials: 'same-origin' });
    if (!r.ok) return [];
    const j = await r.json().catch(() => null);
    return parseStamps(j);
  } catch {
    return [];
  }
}

// devGuest 전용 로컬 정본. 깨진 JSON·앨범 밖 유령 id·중복은 빈 값/정본 교집합으로 정규화한다.
// 제품 로그인 경로는 이 함수를 호출하지 않고 기존 서버 GET 계약을 그대로 사용한다.
export function loadGuestStamps(storage = defaultStorage()) {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(GUEST_STAMPS_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter(isStampAlbumNodeId))];
  } catch {
    return [];
  }
}

// devGuest 첫 수집을 localStorage에 누적한다. 저장소 차단 시에도 예외를 밖으로 내보내지 않는다.
export function collectGuestStamp(nodeId, storage = defaultStorage()) {
  if (!storage || !isStampAlbumNodeId(nodeId)) return false;
  const ids = loadGuestStamps(storage);
  if (ids.includes(nodeId)) return true;
  try {
    storage.setItem(GUEST_STAMPS_STORAGE_KEY, JSON.stringify([...ids, nodeId]));
    return true;
  } catch {
    return false;
  }
}

// 노드 스탬프를 수집(upsert)한다. 성공 여부(boolean) 반환 — 실패는 조용히 false.
export async function collectStamp(nodeId) {
  if (!nodeId) return false;
  try {
    const r = await fetch('/api/world/stamps', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nodeId }),
    });
    return r.ok;
  } catch {
    return false;
  }
}
