import { describe, it, expect, vi } from 'vitest';

// net.js → supabase.js 가 모듈 로드 시 env 를 요구하므로 스텁 후 동적 import.
// (여기서 검증하는 건 순수부: lerpState·throttleGate·createThrottle)
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
const { lerpState, throttleGate, createThrottle, backoffDelay } = await import('../world/net.js');

// voice.js 는 supabase 무관 + 브라우저 API 가드 → 정적 import 로 순수부 사용.
import {
  falloffVolume, isOfferer, VOICE_RADIUS,
  voiceGate, epochMatches, VOICE_CONNECT_RADIUS, VOICE_RELEASE_RADIUS,
} from '../world/voice.js';

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
describe('backoffDelay — 재구독 지수 백오프(순수)', () => {
  it('1s→2s→4s→8s→16s→30s(상한) 시퀀스', () => {
    const seq = [0, 1, 2, 3, 4, 5, 6].map((n) => backoffDelay(n));
    expect(seq).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  });
  it('상한(max)을 절대 넘지 않는다', () => {
    for (const n of [5, 6, 10, 50]) {
      expect(backoffDelay(n)).toBeLessThanOrEqual(30000);
    }
  });
  it('음수 attempt 는 0 으로 취급(첫 지연 = base)', () => {
    expect(backoffDelay(-3)).toBe(1000);
    expect(backoffDelay(0)).toBe(1000);
  });
  it('base·max 를 주면 그대로 반영', () => {
    expect(backoffDelay(0, 500, 4000)).toBe(500);
    expect(backoffDelay(3, 500, 4000)).toBe(4000);   // 500*8=4000 = max
    expect(backoffDelay(4, 500, 4000)).toBe(4000);   // 상한
  });
});

// ─────────────────────────────────────────────────────────────
describe('voiceGate — 근접 음성 연결 히스테리시스(순수)', () => {
  it('임계값: 연결 6타일 / 해제 8타일', () => {
    expect(VOICE_CONNECT_RADIUS).toBe(6);
    expect(VOICE_RELEASE_RADIUS).toBe(8);
  });
  it('연결 임계 미만이면 이전 상태와 무관하게 켠다', () => {
    expect(voiceGate(false, 5.9)).toBe(true);
    expect(voiceGate(false, 0)).toBe(true);
  });
  it('해제 임계 이상이면 이전 상태와 무관하게 끈다', () => {
    expect(voiceGate(true, 8)).toBe(false);
    expect(voiceGate(true, 12)).toBe(false);
  });
  it('밴드(6~8)에서는 직전 상태를 유지해 진동을 흡수한다', () => {
    expect(voiceGate(true, 7)).toBe(true);    // 켜져 있었으면 유지
    expect(voiceGate(false, 7)).toBe(false);  // 꺼져 있었으면 유지
    expect(voiceGate(true, 6)).toBe(true);    // 경계(=연결임계): 밴드 하단
    expect(voiceGate(false, 6)).toBe(false);
  });
  it('비유한 거리는 항상 해제(false)', () => {
    expect(voiceGate(true, NaN)).toBe(false);
    expect(voiceGate(true, Infinity)).toBe(false);
  });
  it('경계에서 스래싱 없음: 6↔7 왕복은 상태를 뒤집지 않는다', () => {
    let on = voiceGate(false, 5);   // 연결
    expect(on).toBe(true);
    on = voiceGate(on, 7);          // 밴드로 나감 → 유지
    expect(on).toBe(true);
    on = voiceGate(on, 6);          // 밴드 안 왕복 → 유지
    expect(on).toBe(true);
    on = voiceGate(on, 8);          // 해제 임계 → 끊김
    expect(on).toBe(false);
    on = voiceGate(on, 7);          // 다시 밴드 → 유지(꺼진 채)
    expect(on).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
describe('epochMatches — 시그널 세대 일치 판정(순수)', () => {
  it('동일 세대는 수락', () => {
    expect(epochMatches(3, 3)).toBe(true);
  });
  it('다른 세대는 무시(오래된 offer 의 answer 차단)', () => {
    expect(epochMatches(2, 1)).toBe(false);
    expect(epochMatches(1, 2)).toBe(false);
  });
  it('한쪽이라도 세대 정보 없으면 통과(구버전 호환)', () => {
    expect(epochMatches(null, 1)).toBe(true);
    expect(epochMatches(2, null)).toBe(true);
    expect(epochMatches(null, null)).toBe(true);
    expect(epochMatches(2, undefined)).toBe(true);
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
