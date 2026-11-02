// DUE-PULSE-IDLE-001(오너 결정 E, 2026-11-02 KST) — 복습 펄스는 읽는 손이 멈추면(입력 4초 없음) 돌던 주기를 끝내고 멈추고,
// 다음 입력에 다시 돈다. 손이 움직이는 동안은 지금 모양 그대로다(CSS 규칙 불변). 실측 근거: 뷰어가 열려 있는 내내
// CPU×4에서 주 스레드 약 99 ms/초 · 그리기 180회/초(측정 하네스 pulse.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DUE_PULSE_IDLE_MS, DUE_PULSE_INPUT_EVENTS, DUE_PULSE_NAME,
  createDuePulseIdle, resumeDuePulses, settleDuePulses,
} from '../useDuePulseIdle.js';

const ROOT = path.resolve(__dirname, '../../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const codeOf = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Web Animations의 CSSAnimation 흉내 — 2.5초 주기, 시각은 바깥 시계(t)가 준다. */
function fakePulse(clock, { name = DUE_PULSE_NAME, startedAt = 0 } = {}) {
  const D = 2500;
  const a = {
    animationName: name, iterations: Infinity, start: startedAt, cancelled: false,
    get currentTime() { return Math.min(clock.t - a.start, a.iterations * D); },
    set currentTime(v) { a.start = clock.t - v; },
    get playState() { return a.cancelled ? 'idle' : clock.t - a.start >= a.iterations * D ? 'finished' : 'running'; },
    effect: {
      getTiming: () => ({ duration: D, iterations: a.iterations }),
      getComputedTiming: () => ({ currentIteration: a.playState === 'running' ? Math.floor((clock.t - a.start) / D) : null }),
      updateTiming: ({ iterations }) => { a.iterations = iterations; },
    },
  };
  return a;
}

function fakeEnv({ reduced = false } = {}) {
  const clock = { t: 0 };
  const listeners = { win: new Map(), doc: new Map(), motion: new Set() };
  const on = map => (type, fn, opts) => { map.set(type, { fn, opts }); };
  const off = map => (type, fn) => { if (map.get(type)?.fn === fn) map.delete(type); };
  const attrs = new Map();
  const motion = { matches: reduced, addEventListener: (_t, fn) => listeners.motion.add(fn), removeEventListener: (_t, fn) => listeners.motion.delete(fn) };
  const animations = [];
  const win = {
    performance: { now: () => clock.t },
    setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: id => clearTimeout(id),
    matchMedia: q => (q === '(prefers-reduced-motion: reduce)' ? motion : { matches: false }),
    addEventListener: on(listeners.win), removeEventListener: off(listeners.win),
  };
  const doc = {
    hidden: false,
    // 끝난 CSS 애니메이션(fill 없음)은 목록에서 빠진다 — 실측(Chromium)과 같게.
    getAnimations: () => animations.filter(a => a.playState !== 'finished' && a.playState !== 'idle'),
    documentElement: { setAttribute: (k, v) => attrs.set(k, v), removeAttribute: k => attrs.delete(k) },
    addEventListener: on(listeners.doc), removeEventListener: off(listeners.doc),
  };
  const advance = ms => { clock.t += ms; vi.advanceTimersByTime(ms); };
  const input = (type = 'pointermove') => listeners.win.get(type).fn({ type });
  return { clock, listeners, attrs, motion, animations, win, doc, advance, input };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('CSS 규칙 — 손이 움직이는 동안의 모양은 그대로', () => {
  const css = read('src/index.css');
  it('due-pulse는 2.5초 · ease-in-out · 무한 그대로이고 이름이 훅의 상수와 같다', () => {
    const rule = css.match(/\n\.word-token--due \.surface::before \{[^}]*\}/)?.[0] || '';
    expect(rule).toContain(`animation: ${DUE_PULSE_NAME} 2.5s ease-in-out infinite;`);
    expect(css).toContain(`@keyframes ${DUE_PULSE_NAME} {`);
    // 주기 끝 프레임 = 그림자 0 — 멈춘 그림이 정지 밑줄 · 띠와 같아지는 근거
    expect(css).toMatch(/@keyframes due-pulse \{\s*0%, 100% \{ box-shadow: 0 0 0 0 rgba\(212, 150, 42, 0\); \}/);
  });
  it('CSS로 횟수 · 재생 상태를 바꿔 멈추지 않는다 — 빛나던 그림자가 끊기거나 얼어 버린다(실측)', () => {
    const code = codeOf(css);
    expect(code).not.toMatch(/data-due-pulse/); // 관찰용 표지는 선택자에 쓰지 않는다(스타일 무효화 0)
    const dueRules = code.match(/[^{}]*word-token--due[^{}]*\{[^}]*\}/g) || [];
    for (const rule of dueRules) expect(rule).not.toMatch(/animation-iteration-count/);
  });
});

describe('멈춤 — 돌던 주기를 끝까지', () => {
  it('지금 주기 + 1로 횟수를 줄인다(이미 끝난 · 다른 이름 · 덮어쓴 것은 그대로)', () => {
    const clock = { t: 6200 }; // 셋째 주기(2) 안
    const pulse = fakePulse(clock), other = fakePulse(clock, { name: 'hlStroke' });
    const held = new Set();
    settleDuePulses([pulse, other], held);
    expect(pulse.iterations).toBe(3);
    expect(other.iterations).toBe(Infinity);
    expect([...held]).toEqual([pulse]);
    clock.t = 7499; expect(pulse.playState).toBe('running');   // 주기 끝까지 돈다
    clock.t = 7500; expect(pulse.playState).toBe('finished');  // 주기 끝 프레임에서 멈춘다
    settleDuePulses([pulse], held);
    expect(pulse.iterations).toBe(3);
  });
  it('다시 돌리면 끝난 것은 0초(그림자 0 = 멈춘 그림)부터, 마지막 주기를 돌던 것은 그 자리에서 이어서', () => {
    const clock = { t: 1000 };
    const done = fakePulse(clock), going = fakePulse(clock, { startedAt: 900 });
    const held = new Set();
    settleDuePulses([done, going], held);
    clock.t = 2600; // done은 2500에 끝남 · going은 3400까지
    expect(done.playState).toBe('finished');
    resumeDuePulses(held);
    expect(done.iterations).toBe(Infinity);
    expect(done.currentTime).toBe(0);
    expect(going.iterations).toBe(Infinity);
    expect(going.currentTime).toBe(1700);
  });
  it('복습 상태를 잃은(취소된) 펄스는 되살리지 않는다', () => {
    const clock = { t: 100 };
    const gone = fakePulse(clock);
    const held = new Set();
    settleDuePulses([gone], held);
    gone.cancelled = true;
    let seeked = false;
    Object.defineProperty(gone, 'currentTime', { set: () => { seeked = true; }, get: () => 0 });
    resumeDuePulses(held);
    expect(gone.iterations).toBe(1);
    expect(seeked).toBe(false);
  });
});

describe('배선 — 창 리스너 · 4초 타이머 · 숨김 · 모션 축소 · 정리', () => {
  it('입력 4초가 끊기면 멈추고, 다음 입력에 다시 돈다. 입력이 이어지는 동안은 손대지 않는다', () => {
    const env = fakeEnv();
    const pulse = fakePulse(env.clock);
    env.animations.push(pulse);
    const c = createDuePulseIdle({ win: env.win, doc: env.doc });
    c.start();
    expect(DUE_PULSE_IDLE_MS).toBe(4000);
    for (let i = 0; i < 10; i++) { env.advance(1000); env.input('scroll'); } // 10초 동안 1초마다 스크롤
    expect(pulse.iterations).toBe(Infinity);
    expect(c.idle).toBe(false);
    env.advance(3999);
    expect(c.idle).toBe(false);
    env.advance(1);
    expect(c.idle).toBe(true);
    expect(env.attrs.get('data-due-pulse')).toBe('idle');
    expect(pulse.iterations).toBe(Math.floor(14000 / 2500) + 1); // 14초 = 여섯째 주기 → 6회에서 끝
    env.advance(5000);
    expect(pulse.playState).toBe('finished');
    env.input('keydown');
    expect(c.idle).toBe(false);
    expect(env.attrs.has('data-due-pulse')).toBe(false);
    expect(pulse.iterations).toBe(Infinity);
    expect(pulse.currentTime).toBe(0);
    c.stop();
  });
  it('듣는 신호는 스크롤 · 휠 · 포인터 · 키 · 터치이고 모두 passive · capture다', () => {
    const env = fakeEnv();
    const c = createDuePulseIdle({ win: env.win, doc: env.doc });
    c.start();
    expect(DUE_PULSE_INPUT_EVENTS).toEqual(['scroll', 'wheel', 'pointerdown', 'pointermove', 'keydown', 'touchstart']);
    for (const type of DUE_PULSE_INPUT_EVENTS) expect(env.listeners.win.get(type)?.opts).toEqual({ capture: true, passive: true });
    c.stop();
    expect(env.listeners.win.size).toBe(0);
    expect(env.listeners.doc.size).toBe(0);
    expect(env.listeners.motion.size).toBe(0);
  });
  it('입력마다 타이머를 다시 걸지 않는다(초당 수십 번 오는 pointermove · scroll도 시각만 적는다)', () => {
    const env = fakeEnv();
    const set = vi.spyOn(env.win, 'setTimeout');
    const c = createDuePulseIdle({ win: env.win, doc: env.doc });
    c.start();
    for (let i = 0; i < 200; i++) { env.advance(10); env.input('pointermove'); }
    expect(set.mock.calls.length).toBe(1);
    c.stop();
  });
  it('숨긴 탭에서는 타이머를 멈추고, 돌아오면 다시 잰다', () => {
    const env = fakeEnv();
    const pulse = fakePulse(env.clock); env.animations.push(pulse);
    const c = createDuePulseIdle({ win: env.win, doc: env.doc });
    c.start();
    env.doc.hidden = true; env.listeners.doc.get('visibilitychange').fn();
    env.advance(10000);
    expect(c.idle).toBe(false);
    expect(pulse.iterations).toBe(Infinity);
    env.doc.hidden = false; env.listeners.doc.get('visibilitychange').fn();
    env.advance(4000);
    expect(c.idle).toBe(true);
    c.stop();
  });
  it('멈춘 동안 새로 생긴 펄스(쪽 넘김 · 늦게 온 단어 상태)도 한 주기만 돈다', () => {
    const env = fakeEnv();
    const c = createDuePulseIdle({ win: env.win, doc: env.doc });
    c.start();
    env.advance(4000);
    expect(c.idle).toBe(true);
    const late = fakePulse(env.clock, { startedAt: env.clock.t }); env.animations.push(late);
    env.listeners.doc.get('animationstart').fn({ animationName: DUE_PULSE_NAME });
    expect(late.iterations).toBe(1);
    c.stop();
    expect(late.iterations).toBe(Infinity); // 닫을 때 되돌린다
  });
  it('모션 축소면 아무것도 하지 않고(전역 규칙), 도중에 켜지면 덮어쓴 횟수를 전역 규칙과 같은 1로 되돌린다', () => {
    const quiet = fakeEnv({ reduced: true });
    const p0 = fakePulse(quiet.clock); quiet.animations.push(p0);
    const c0 = createDuePulseIdle({ win: quiet.win, doc: quiet.doc });
    c0.start(); quiet.advance(20000);
    expect(c0.idle).toBe(false);
    expect(p0.iterations).toBe(Infinity);
    c0.stop();

    const env = fakeEnv();
    const pulse = fakePulse(env.clock); env.animations.push(pulse);
    const c = createDuePulseIdle({ win: env.win, doc: env.doc });
    c.start(); env.advance(4000);
    expect(pulse.iterations).toBe(2);
    env.motion.matches = true; for (const fn of env.listeners.motion) fn();
    expect(pulse.iterations).toBe(1);
    expect(c.idle).toBe(false);
    env.motion.matches = false; for (const fn of env.listeners.motion) fn();
    expect(pulse.iterations).toBe(Infinity);
    c.stop();
  });
});

describe('뷰어 연결', () => {
  it('ViewerPage가 훅을 한 번 부르고, 훅은 효과 정리에서 멈춘다(리스너 · 타이머 회수)', () => {
    const viewer = codeOf(read('src/views/ViewerPage.jsx'));
    expect(viewer).toContain("import { useDuePulseIdle } from '../lib/useDuePulseIdle';");
    expect(viewer.match(/useDuePulseIdle\(/g)).toHaveLength(1);
    const hook = codeOf(read('src/lib/useDuePulseIdle.js'));
    expect(hook).toMatch(/controller\.start\(\);\s*return \(\) => controller\.stop\(\);/);
    expect(hook).not.toMatch(/useState|requestAnimationFrame|setInterval/); // 리액트 다시 그리기 · 프레임 루프 0
  });
});
