import { describe, it, expect, vi } from 'vitest';

// net.js → supabase.js 가 모듈 로드 시 env 를 요구하므로 스텁 후 동적 import.
// (여기서 검증하는 건 순수부: lerpState·throttleGate·createThrottle)
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
const { lerpState, throttleGate, createThrottle } = await import('../world/net.js');

// voice.js 는 supabase 무관 + 브라우저 API 가드 → 정적 import 로 순수부 사용.
import { falloffVolume, isOfferer, VOICE_RADIUS } from '../world/voice.js';

// ─────────────────────────────────────────────────────────────
describe('lerpState — 좌표 보간(순수)', () => {
  it('중점(t=0.5)에서 x·y 를 절반씩 섞는다', () => {
    const r = lerpState({ x: 0, y: 10, dir: 'up' }, { x: 10, y: 20, dir: 'down' }, 0.5);
    expect(r.x).toBe(5);
    expect(r.y).toBe(15);
  });

  it('dir 은 이산값이라 중점 기준으로 스냅한다', () => {
    const a = { x: 0, y: 0, dir: 'up' };
    const b = { x: 1, y: 1, dir: 'down' };
    expect(lerpState(a, b, 0.4).dir).toBe('up');    // 전반부 → prev
    expect(lerpState(a, b, 0.6).dir).toBe('down');  // 후반부 → next
  });

  it('t 를 0~1 로 클램프한다', () => {
    const a = { x: 0, y: 0, dir: 'up' };
    const b = { x: 10, y: 0, dir: 'up' };
    expect(lerpState(a, b, -3).x).toBe(0);
    expect(lerpState(a, b, 5).x).toBe(10);
  });

  it('한쪽이 없으면 있는 쪽을 복제', () => {
    expect(lerpState(null, { x: 2, y: 3, dir: 'l' }, 0.5)).toEqual({ x: 2, y: 3, dir: 'l' });
    expect(lerpState({ x: 4, y: 5, dir: 'r' }, null, 0.5)).toEqual({ x: 4, y: 5, dir: 'r' });
    expect(lerpState(null, null, 0.5)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
describe('throttleGate — 리딩콜 허용 판정(순수)', () => {
  it('lastAt 이 없으면 항상 허용', () => {
    expect(throttleGate(null, 1000, 100)).toBe(true);
  });
  it('interval 이 지나면 허용, 아니면 차단', () => {
    expect(throttleGate(1000, 1050, 100)).toBe(false);  // 50ms 경과
    expect(throttleGate(1000, 1100, 100)).toBe(true);   // 정확히 100ms
    expect(throttleGate(1000, 1200, 100)).toBe(true);   // 초과
  });
});

// ─────────────────────────────────────────────────────────────
describe('createThrottle — 리딩+트레일링 100ms 스로틀', () => {
  it('첫 호출은 즉시 통과, 인터벌 내 반복은 억제', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const t = createThrottle(fn, 100);
    t('a');            // 리딩 → 즉시
    t('b'); t('c');    // 인터벌 내 → 억제(트레일링 예약)
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith('a');
    vi.useRealTimers();
  });

  it('트레일링으로 마지막 인자가 인터벌 뒤 전송된다', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const t = createThrottle(fn, 100);
    t('a');            // 리딩
    t('b'); t('c');    // 마지막 pending = 'c'
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('c');
    vi.useRealTimers();
  });

  it('cancel 은 예약된 트레일링을 취소', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const t = createThrottle(fn, 100);
    t('a'); t('b');
    t.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);  // 리딩만
    vi.useRealTimers();
  });
});

// ─────────────────────────────────────────────────────────────
describe('falloffVolume — 근접 볼륨(순수, 0~1)', () => {
  it('거리 0 → 최대(1), 반경 이상 → 무음(0)', () => {
    expect(falloffVolume(0)).toBe(1);
    expect(falloffVolume(VOICE_RADIUS)).toBe(0);
    expect(falloffVolume(VOICE_RADIUS + 3)).toBe(0);
  });

  it('반경 안에서 거리가 멀수록 단조 감소한다', () => {
    const v1 = falloffVolume(1);
    const v3 = falloffVolume(3);
    const v5 = falloffVolume(5);
    expect(v1).toBeGreaterThan(v3);
    expect(v3).toBeGreaterThan(v5);
    for (const v of [v1, v3, v5]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('사용자 지정 반경을 존중', () => {
    expect(falloffVolume(10, 10)).toBe(0);
    expect(falloffVolume(0, 10)).toBe(1);
  });

  it('비유한값은 무음(0)으로 안전 처리', () => {
    expect(falloffVolume(NaN)).toBe(0);
    expect(falloffVolume(Infinity)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('isOfferer — glare 방지 offerer 판정(사전순)', () => {
  it('사전순 앞선 쪽만 offerer', () => {
    expect(isOfferer('alice', 'bob')).toBe(true);
    expect(isOfferer('bob', 'alice')).toBe(false);
  });
  it('한쪽만 offerer 가 되어 동시 offer 를 막는다', () => {
    const a = 'user-111', b = 'user-999';
    expect(isOfferer(a, b)).not.toBe(isOfferer(b, a));
  });
  it('동일 id 는 offerer 아님', () => {
    expect(isOfferer('x', 'x')).toBe(false);
  });
});
