'use client';

/**
 * 복습 펄스 손 멈춤 정지(DUE-PULSE-IDLE-001 — 오너 결정 E, 2026-11-02 KST).
 *
 * `.word-token--due .surface::before`의 due-pulse(box-shadow, 2.5초 무한)는 뷰어가 열려 있는 내내 매 프레임 다시 그린다
 * (실측: CPU×4에서 주 스레드 약 99 ms/초 · 그리기 180회/초). 읽는 손이 멈추면(스크롤 · 포인터 · 키 · 터치 4초 없음)
 * 돌던 주기를 끝까지 돌고 멈춘다 — 멈춘 그림은 주기 끝 프레임(그림자 0 = 밑줄 · 띠만)과 같다. 다음 입력에 다시 돈다.
 * 손이 움직이는 동안은 지금과 한 프레임도 다르지 않다(CSS 규칙 그대로 · 이 모듈은 손대지 않는다).
 *
 * 왜 CSS 클래스(animation-iteration-count)가 아니라 Web Animations인가 — 실측(Chromium, 2026-11-02 KST):
 *  · 한 주기보다 오래 돈 애니메이션에 CSS로 iteration-count: 1을 주면 그 자리에서 끝난다(빛나던 그림자가 뚝 사라진다).
 *    「돌던 주기를 끝까지」에는 토큰마다 지금 몇 번째 주기인지가 필요한데 CSS는 그것을 모른다.
 *  · animation-play-state: paused는 빛나는 도중에 얼린다.
 *  그래서 멈출 때 한 번만 각 펄스의 남은 횟수를 「지금 주기 + 1」로 줄인다(updateTiming — 곧바로 이어지고 끊김 0).
 *  토큰 DOM · 클래스 · 리액트 상태는 건드리지 않는다. 일은 입력이 끊길 때 · 다시 올 때 한 번씩뿐이고 프레임마다 도는 JS는 0이다.
 *
 * 끝난 CSS 애니메이션(fill 없음)은 document.getAnimations()에서 빠진다 — 다시 돌릴 때 찾을 수 있게 멈춘 것을 들고 있는다.
 * 끝난 것은 0초(그림자 0 = 멈춘 그림과 같은 프레임)부터 다시 돌려 이음매가 없다. 아직 마지막 주기를 돌던 것은 횟수만 되돌린다.
 *
 * 모션 축소(prefers-reduced-motion)는 전역 규칙(index.css — 0.01ms × 1회)이 그대로 맡는다. 이 모듈은 그때 아무것도 하지 않고,
 * 도중에 축소로 바뀌면 덮어쓴 횟수를 전역 규칙과 같은 1로 돌려놓는다(덮어쓴 무한 × 0.01ms가 남지 않게).
 */
import { useEffect } from 'react';

/** index.css @keyframes 이름 — 계약 테스트(duePulseIdle.test.js)가 CSS와 같은지 잡는다. */
export const DUE_PULSE_NAME = 'due-pulse';
/** 손 멈춤 판정(오너 결정 E) */
export const DUE_PULSE_IDLE_MS = 4000;
/** 읽는 손의 신호 — 모두 passive · capture(스크롤은 거품이 없어 capture로만 창에서 받는다). */
export const DUE_PULSE_INPUT_EVENTS = ['scroll', 'wheel', 'pointerdown', 'pointermove', 'keydown', 'touchstart'];
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const LISTEN = { capture: true, passive: true };

const isDuePulse = animation => animation?.animationName === DUE_PULSE_NAME;

/** 돌고 있는 펄스마다 남은 횟수를 「지금 주기까지」로 줄인다. 줄인 것은 held에 담는다. */
export function settleDuePulses(animations, held) {
  for (const animation of animations) {
    if (!isDuePulse(animation) || animation.playState === 'idle' || animation.playState === 'finished') continue;
    const effect = animation.effect;
    if (!effect || effect.getTiming().iterations !== Infinity) continue;
    const current = effect.getComputedTiming().currentIteration;
    effect.updateTiming({ iterations: (Number.isFinite(current) ? current : 0) + 1 });
    held.add(animation);
  }
}

/** 다시 무한으로 — 끝난 것은 0초(멈춘 그림과 같은 프레임)부터, 마지막 주기를 돌던 것은 그 자리에서 이어서.
 *  iterations=1은 모션 축소로 바뀔 때 전역 규칙(1회)과 맞추는 자리다. 들고 있는 집합은 부르는 쪽이 비운다. */
export function resumeDuePulses(held, iterations = Infinity) {
  for (const animation of held) {
    if (animation.playState === 'idle') continue; // 토큰이 복습 상태를 잃었거나 사라졌다 — 되살리지 않는다
    const finished = animation.playState === 'finished';
    animation.effect?.updateTiming({ iterations });
    if (finished && iterations === Infinity) animation.currentTime = 0;
  }
}

/**
 * 프레임워크 없는 본체 — 훅은 이것을 열고 닫기만 한다(테스트는 가짜 창 · 문서 · 시계로 돈다).
 * 입력 처리는 시각 하나를 적을 뿐이다(타이머를 매번 다시 걸지 않는다 — pointermove · scroll이 초당 수십 번 와도 일 0).
 */
export function createDuePulseIdle({ win, doc, idleMs = DUE_PULSE_IDLE_MS, now = () => win.performance.now() }) {
  const held = new Set();     // 멈추게 한 펄스(끝나면 getAnimations에서 빠지므로 직접 든다)
  const touched = new Set();  // 한 번이라도 횟수를 덮어쓴 펄스(모션 축소로 바뀔 때 되돌릴 대상)
  let idle = false, timer = 0, last = 0, running = false;
  const motion = win.matchMedia?.(REDUCED_MOTION);
  const reduced = () => !!motion?.matches;

  const clear = () => { if (timer) { win.clearTimeout(timer); timer = 0; } };
  const schedule = delay => { clear(); timer = win.setTimeout(check, delay); };
  const markIdle = () => {
    idle = true;
    for (const animation of touched) if (animation.playState === 'idle') touched.delete(animation); // 사라진 토큰의 펄스는 놓는다
    settleDuePulses(doc.getAnimations?.() ?? [], held);
    for (const animation of held) touched.add(animation);
    // 관찰용 표지(QA · 측정) — 이 속성을 쓰는 CSS 선택자가 없어 스타일 무효화가 0이다(고르는 규칙을 붙이지 말 것).
    doc.documentElement?.setAttribute('data-due-pulse', 'idle');
  };
  const wake = () => {
    idle = false;
    resumeDuePulses(held);
    held.clear();
    doc.documentElement?.removeAttribute('data-due-pulse');
  };
  function check() {
    timer = 0;
    if (doc.hidden || reduced()) return;
    const quiet = now() - last;
    if (quiet >= idleMs) markIdle(); else schedule(idleMs - quiet);
  }
  const onInput = () => {
    last = now();
    if (idle) wake();
    if (!timer && !doc.hidden && !reduced()) schedule(idleMs);
  };
  // 멈춘 동안 새로 생긴 펄스(듣기 따라가기의 쪽 넘김 · 늦게 온 단어 상태)도 한 주기만 돌고 멈춘다.
  const onAnimationStart = event => {
    if (!idle || event.animationName !== DUE_PULSE_NAME) return;
    settleDuePulses(doc.getAnimations?.() ?? [], held);
    for (const animation of held) touched.add(animation);
  };
  // 숨긴 탭은 브라우저가 그리지 않는다 — 타이머만 멈춘다. 돌아오면 손이 온 것으로 본다.
  const onVisibility = () => { if (doc.hidden) clear(); else onInput(); };
  // 도중에 모션 축소가 켜지면 덮어쓴 횟수를 전역 규칙과 같은 1로, 꺼지면 다시 무한으로(끝난 것은 0초부터).
  const onMotion = () => {
    clear();
    idle = false;
    held.clear();
    doc.documentElement?.removeAttribute('data-due-pulse');
    if (reduced()) resumeDuePulses(touched, 1);
    else { resumeDuePulses(touched); onInput(); }
  };

  return {
    start() {
      if (running) return;
      running = true;
      for (const type of DUE_PULSE_INPUT_EVENTS) win.addEventListener(type, onInput, LISTEN);
      doc.addEventListener('animationstart', onAnimationStart, LISTEN);
      doc.addEventListener('visibilitychange', onVisibility);
      motion?.addEventListener?.('change', onMotion);
      onInput();
    },
    stop() {
      if (!running) return;
      running = false;
      clear();
      for (const type of DUE_PULSE_INPUT_EVENTS) win.removeEventListener(type, onInput, LISTEN);
      doc.removeEventListener('animationstart', onAnimationStart, LISTEN);
      doc.removeEventListener('visibilitychange', onVisibility);
      motion?.removeEventListener?.('change', onMotion);
      if (idle) wake();
      touched.clear();
    },
    get idle() { return idle; },
  };
}

/** 뷰어 한 번에 하나 — 열려 있는 동안만 듣고, 닫히면 리스너 · 타이머를 거두고 멈춘 펄스를 되돌린다. */
export function useDuePulseIdle(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof document === 'undefined') return undefined;
    const controller = createDuePulseIdle({ win: window, doc: document });
    controller.start();
    return () => controller.stop();
  }, [enabled]);
}
