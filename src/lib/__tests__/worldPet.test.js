import { describe, it, expect, afterEach } from 'vitest';
import { PET_SPECIES, getPetChoice, setPetChoice, derivePetState } from '../world/pet';
import { WORLD_STORAGE_KEYS } from '../world/storageSchema.js';

// 이 스위트는 기본(vitest 기본값 = node) 환경에서 돈다 — jsdom 없이 typeof window === 'undefined'가
// 참이므로 SSR 가드 자체를 실제로 검증할 수 있다. window가 있는 브라우저 경로는 최소한의 목으로 재현한다.
afterEach(() => {
  delete globalThis.window;
});

describe('derivePetState — 레벨 티어 경계', () => {
  it('totalCorrect 0 → 레벨 1, xp 0, 다음 레벨까지 10', () => {
    expect(derivePetState({ totalCorrect: 0, todayCorrect: 0, sessionsToday: 0 }))
      .toEqual({ level: 1, xp: 0, xpToNext: 10, mood: 'sleepy' });
  });

  it('totalCorrect 9(레벨1 요구치 10 미만) → 레벨 1 유지, xp 9', () => {
    const s = derivePetState({ totalCorrect: 9, todayCorrect: 0, sessionsToday: 0 });
    expect(s.level).toBe(1);
    expect(s.xp).toBe(9);
    expect(s.xpToNext).toBe(10);
  });

  it('totalCorrect 10(경계 정확히) → 레벨 2로 승급, xp 0, 다음 요구치 15(완만히 증가)', () => {
    const s = derivePetState({ totalCorrect: 10, todayCorrect: 0, sessionsToday: 0 });
    expect(s.level).toBe(2);
    expect(s.xp).toBe(0);
    expect(s.xpToNext).toBe(15);
  });

  it('totalCorrect 24(레벨2 요구치 15 미만 누적) → 레벨 2 유지, xp 14', () => {
    // 10(레벨1→2) + 14 = 24 < 10+15=25(레벨2→3 경계)
    const s = derivePetState({ totalCorrect: 24, todayCorrect: 0, sessionsToday: 0 });
    expect(s.level).toBe(2);
    expect(s.xp).toBe(14);
    expect(s.xpToNext).toBe(15);
  });

  it('totalCorrect 25(레벨2→3 경계) → 레벨 3, xp 0, 다음 요구치 20', () => {
    const s = derivePetState({ totalCorrect: 25, todayCorrect: 0, sessionsToday: 0 });
    expect(s.level).toBe(3);
    expect(s.xp).toBe(0);
    expect(s.xpToNext).toBe(20);
  });

  it('음수·미지정 totalCorrect는 0으로 취급(레벨 1 하한)', () => {
    expect(derivePetState({ totalCorrect: -5 }).level).toBe(1);
    expect(derivePetState({}).level).toBe(1);
  });
});

describe('derivePetState — mood 3분기', () => {
  it('todayCorrect 0, 세션 없음 → sleepy', () => {
    expect(derivePetState({ totalCorrect: 0, todayCorrect: 0, sessionsToday: 0 }).mood).toBe('sleepy');
  });

  it('todayCorrect 1~9, 세션 없음 → happy', () => {
    expect(derivePetState({ totalCorrect: 0, todayCorrect: 1, sessionsToday: 0 }).mood).toBe('happy');
    expect(derivePetState({ totalCorrect: 0, todayCorrect: 9, sessionsToday: 0 }).mood).toBe('happy');
  });

  it('todayCorrect 10 이상 → excited', () => {
    expect(derivePetState({ totalCorrect: 0, todayCorrect: 10, sessionsToday: 0 }).mood).toBe('excited');
    expect(derivePetState({ totalCorrect: 0, todayCorrect: 20, sessionsToday: 0 }).mood).toBe('excited');
  });

  it('sessionsToday > 0이면 todayCorrect가 낮아도(0 포함) excited가 우선', () => {
    expect(derivePetState({ totalCorrect: 0, todayCorrect: 0, sessionsToday: 1 }).mood).toBe('excited');
    expect(derivePetState({ totalCorrect: 0, todayCorrect: 5, sessionsToday: 1 }).mood).toBe('excited');
  });
});

describe('getPetChoice / setPetChoice — SSR 가드', () => {
  it('window가 없으면(SSR) getPetChoice는 기본값 dog', () => {
    expect(typeof window).toBe('undefined');
    expect(getPetChoice()).toBe('dog');
  });

  it('window가 없으면 setPetChoice는 예외 없이 조용히 아무 것도 안 함', () => {
    expect(typeof window).toBe('undefined');
    expect(() => setPetChoice('cat')).not.toThrow();
  });

  it('window가 있으면(브라우저) localStorage에서 저장된 선택을 읽는다', () => {
    const store = { [WORLD_STORAGE_KEYS.petChoice]: 'fox' };
    globalThis.window = {
      localStorage: {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = v; },
      },
    };
    expect(getPetChoice()).toBe('fox');
  });

  it('저장된 값이 PET_SPECIES에 없으면(손상) 기본값 dog로 폴백', () => {
    const store = { [WORLD_STORAGE_KEYS.petChoice]: 'dragon' };
    globalThis.window = {
      localStorage: {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = v; },
      },
    };
    expect(getPetChoice()).toBe('dog');
  });

  it('setPetChoice는 유효한 key만 localStorage에 저장하고, 알 수 없는 key는 무시한다', () => {
    const store = {};
    globalThis.window = {
      localStorage: {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = v; },
      },
    };
    setPetChoice('rabbit');
    expect(store[WORLD_STORAGE_KEYS.petChoice]).toBe('rabbit');
    setPetChoice('not-a-real-pet');
    expect(store[WORLD_STORAGE_KEYS.petChoice]).toBe('rabbit'); // 변화 없음
  });
});

describe('PET_SPECIES — 계약 상수', () => {
  it('5종 고정 목록(dog/cat/rabbit/fox/turtle)', () => {
    expect(PET_SPECIES.map(p => p.key)).toEqual(['dog', 'cat', 'rabbit', 'fox', 'turtle']);
    for (const p of PET_SPECIES) {
      expect(p).toHaveProperty('emoji');
      expect(p).toHaveProperty('name');
    }
  });
});
