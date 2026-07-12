import { describe, it, expect, afterEach } from 'vitest';

// 학습 월드 뮤트 스토어 — 순수 헬퍼(정규화·토글)와 localStorage 브리지(SSR 안전 · 영속 · 통지) 검증.
// worldPet.test 관례: window 를 globalThis 에 심어 브라우저를 흉내내고, 없을 땐 SSR 경로를 검증한다.
import {
  normalizeMutedList, withToggled,
  getMuted, isMuted, toggleMute, onChange,
} from '../muteStore.js';

// 각 테스트가 window 를 심을 수 있으니, 끝나면 반드시 지워 다음 스위트로 새지 않게 한다.
afterEach(() => { delete globalThis.window; });

// 간단한 in-memory localStorage 목 — store 객체를 함께 돌려줘 저장 결과를 직접 검사한다.
function stubWindow(initial = {}) {
  const store = { ...initial };
  globalThis.window = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = v; },
    },
  };
  return store;
}

describe('normalizeMutedList', () => {
  it('배열이 아니면 빈 목록', () => {
    expect(normalizeMutedList(null)).toEqual([]);
    expect(normalizeMutedList('u1')).toEqual([]);
    expect(normalizeMutedList(undefined)).toEqual([]);
  });
  it('비문자열·빈값·중복을 제거한다', () => {
    expect(normalizeMutedList(['u1', '', 'u2', 'u1', 42, null, 'u2'])).toEqual(['u1', 'u2']);
  });
});

describe('withToggled (불변)', () => {
  it('없으면 추가, 있으면 제거', () => {
    expect(withToggled(['u1'], 'u2')).toEqual(['u1', 'u2']);
    expect(withToggled(['u1', 'u2'], 'u1')).toEqual(['u2']);
  });
  it('원본을 변형하지 않고 손상 입력을 정제한다', () => {
    const src = ['u1', 42, 'u1'];
    const out = withToggled(src, 'u2');
    expect(out).toEqual(['u1', 'u2']);
    expect(src).toEqual(['u1', 42, 'u1']); // 원본 불변
  });
  it('빈/비문자열 id 는 목록을 정제만 하고 변화 없음', () => {
    expect(withToggled(['u1'], '')).toEqual(['u1']);
  });
});

describe('SSR (window 없음)', () => {
  it('조회는 빈 목록, 쓰기는 예외 없이 no-op', () => {
    expect(typeof window).toBe('undefined');
    expect(getMuted()).toEqual([]);
    expect(isMuted('u1')).toBe(false);
    expect(() => toggleMute('u1')).not.toThrow();
    expect(toggleMute('u1')).toBe(true); // 통지·반환은 동작(영속만 no-op)
  });
});

describe('localStorage 영속', () => {
  it('저장된 world_muted 를 읽어 getMuted·isMuted 로 노출', () => {
    stubWindow({ world_muted: JSON.stringify(['u1', 'u2']) });
    expect(getMuted()).toEqual(['u1', 'u2']);
    expect(isMuted('u1')).toBe(true);
    expect(isMuted('u9')).toBe(false);
  });
  it('손상된 값은 빈 목록으로 폴백', () => {
    stubWindow({ world_muted: '{not json' });
    expect(getMuted()).toEqual([]);
  });
  it('toggleMute 는 상태를 영속하고 토글 후 상태를 반환', () => {
    const store = stubWindow();
    expect(toggleMute('u1')).toBe(true);
    expect(JSON.parse(store.world_muted)).toEqual(['u1']);
    expect(toggleMute('u1')).toBe(false);
    expect(JSON.parse(store.world_muted)).toEqual([]);
  });
});

describe('onChange 구독', () => {
  it('등록 즉시 현재 목록 1회 통지 + 이후 토글마다 통지, unsubscribe 후 멈춤', () => {
    stubWindow({ world_muted: JSON.stringify(['u1']) });
    const seen = [];
    const off = onChange((list) => seen.push(list));
    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual(['u1']);   // 즉시 통지
    toggleMute('u2');
    expect(seen).toHaveLength(2);
    expect(seen[1]).toEqual(['u1', 'u2']);
    off();
    toggleMute('u3');
    expect(seen).toHaveLength(2);      // 구독 해제 후 통지 없음
  });
});
