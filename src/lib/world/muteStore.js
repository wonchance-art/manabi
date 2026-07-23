// 학습 월드 — 뮤트 스토어(로컬 영속).
//
// 내가 조용히 하고 싶은 상대(userId)의 목록을 localStorage('world_muted', userId 배열)에 담아
// 세션·재접속을 넘어 유지한다. 채팅 수신 드랍(chat.js 옵션 주입)과 근접 음성 뮤트
// (voice.mutePeer feature-detect)의 단일 진실 소스다.
//
// net.js·voice.js·chat.js 를 직접 건드리지 않는다 — 각 소비자가 이 스토어를 읽거나(WorldPage 패널),
// 옵션으로 주입받아(chat.js 의 isMuted) 참조한다. 그래서 이 모듈은 브라우저 전역(localStorage)
// 하나에만 의존하고, 순수 헬퍼(normalizeMutedList·withToggled)는 export 해 유닛 테스트한다.
//
// SSR 안전: window 없으면 조회는 빈 목록, 쓰기는 조용한 no-op(펫 스토어 관례와 동형).

import { MUTED_USER_IDS_STORAGE_KEY } from './storageSchema.js';

export { MUTED_USER_IDS_STORAGE_KEY };

// ── 순수 헬퍼 (테스트 대상) ──────────────────────────────────────

// 저장 원본(무엇이든) → 정제된 문자열 id 배열. 비문자열·빈값·중복을 제거한다.
// 손상된 localStorage 값이 들어와도 목록은 항상 유효한 형태를 유지한다.
export function normalizeMutedList(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const v of raw) {
    if (typeof v === 'string' && v && !out.includes(v)) out.push(v);
  }
  return out;
}

// 불변 토글(순수). id 가 목록에 있으면 제거, 없으면 추가한 새 배열을 돌려준다.
export function withToggled(list, id) {
  const base = normalizeMutedList(list);
  if (typeof id !== 'string' || !id) return base;
  return base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
}

// ── localStorage 브리지 (SSR 안전) ──────────────────────────────

function readRaw() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MUTED_USER_IDS_STORAGE_KEY) || '[]');
    return normalizeMutedList(parsed);
  } catch {
    return [];
  }
}

function writeRaw(list) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      MUTED_USER_IDS_STORAGE_KEY,
      JSON.stringify(normalizeMutedList(list)),
    );
  } catch {
    // 저장 실패(사생활 모드 등)는 조용히 — 이번 세션 안에서는 subscriber 통지로 반영은 유지된다.
  }
}

// ── 구독(변경 통지) ─────────────────────────────────────────────
// 같은 탭 안의 소비자(패널·재렌더)에게 변경을 알린다. 다른 탭 동기화는 범위 밖(단순성).
const subscribers = new Set();

function emitChange(list) {
  for (const cb of subscribers) {
    try { cb(list); } catch { /* 구독자 예외는 서로 격리 */ }
  }
}

// ── 공개 API ────────────────────────────────────────────────────

// 현재 뮤트된 userId 배열(방어적 복사본). 매 호출 시 localStorage 를 읽어 최신값을 준다.
export function getMuted() {
  return readRaw();
}

// id 가 지금 뮤트 상태인지.
export function isMuted(id) {
  if (typeof id !== 'string' || !id) return false;
  return readRaw().includes(id);
}

// id 뮤트 토글 → 영속 + 구독자 통지. 반환: 토글 후 뮤트 상태(true=이제 뮤트됨).
export function toggleMute(id) {
  if (typeof id !== 'string' || !id) return false;
  const next = withToggled(readRaw(), id);
  writeRaw(next);
  emitChange(next);
  return next.includes(id);
}

// 변경 구독 — 등록 즉시 현재 목록을 1회 통지한다(초기 렌더 편의). unsubscribe 함수 반환.
export function onChange(cb) {
  if (typeof cb !== 'function') return () => {};
  subscribers.add(cb);
  try { cb(readRaw()); } catch { /* noop */ }
  return () => { subscribers.delete(cb); };
}
