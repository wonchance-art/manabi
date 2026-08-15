'use client';
// 인앱 토큰 범위 지정 — 브라우저 네이티브 선택을 대체한다(앱 전역 무선택 정책의 본문 담당).
// 데스크톱: 토큰에서 바로 드래그(8px 임계). 모바일: 길게 누르기(300ms) 후 드래그 —
// 임계 전 이동은 스크롤로 판정해 개입하지 않고, 브라우저가 스크롤을 가져가면
// pointercancel로 정리된다. 지정 결과는 토큰 표면형 합성 텍스트(개행 보존)로 기존 분석
// 파이프라인에 그대로 투입되고, 하이라이트는 패널이 열려 있는 동안 유지된다
// (문장 막대 #1002와 같은 수명 규칙 — 단어 클릭·새 지정 시 해제).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const LONG_PRESS_MS = 300;   // 모바일 지정 진입 — OS 텍스트 선택 관례와 동일
export const MOVE_THRESHOLD = 8;    // 데스크톱 드래그 시작 임계(px)
export const SCROLL_CANCEL_PX = 10; // 모바일 long-press 전 이동 허용치 — 넘으면 스크롤 양보

/**
 * 순수 제스처 코어 — 타이머·이동 임계 판정만 담당(DOM 무관, 단독 테스트 대상).
 * down → (마우스: 8px 이동 / 터치: 300ms 유지) → onStart → onUpdate* → up → onEnd.
 * 터치에서 300ms 전 10px 초과 이동은 onCancel('scroll'), 이동 없이 up은 onCancel('tap').
 */
export function createTokenRangeGesture(handlers = {}) {
  const h = handlers;
  let state = 'idle'; // idle | pending | selecting
  let timer = null;
  let startX = 0;
  let startY = 0;
  let isTouch = false;

  const clearTimer = () => { if (timer) { clearTimeout(timer); timer = null; } };

  return {
    get state() { return state; },
    down({ x, y, pointerType }) {
      clearTimer();
      state = 'pending';
      startX = x; startY = y;
      isTouch = pointerType !== 'mouse';
      if (isTouch) {
        timer = setTimeout(() => {
          timer = null;
          state = 'selecting';
          h.onStart?.({ x: startX, y: startY });
        }, LONG_PRESS_MS);
      }
    },
    move({ x, y }) {
      if (state === 'pending') {
        const dist = Math.hypot(x - startX, y - startY);
        if (isTouch) {
          if (dist > SCROLL_CANCEL_PX) { // 스크롤 의도 — 지정 포기
            clearTimer();
            state = 'idle';
            h.onCancel?.('scroll');
          }
        } else if (dist > MOVE_THRESHOLD) {
          state = 'selecting';
          h.onStart?.({ x: startX, y: startY });
          h.onUpdate?.({ x, y });
        }
        return;
      }
      if (state === 'selecting') h.onUpdate?.({ x, y });
    },
    up() {
      clearTimer();
      const was = state;
      state = 'idle';
      if (was === 'selecting') h.onEnd?.();
      else if (was === 'pending') h.onCancel?.('tap');
    },
    cancel() {
      clearTimer();
      const was = state;
      state = 'idle';
      if (was !== 'idle') h.onCancel?.('cancelled');
    },
  };
}

/** 범위 토큰의 표면형 합성 — 개행 토큰은 '\n'으로 보존해 다줄 분석(줄 분리)이 성립한다. */
export function composeRangeText(sequence, dictionary, startIdx, endIdx) {
  let out = '';
  for (let i = startIdx; i <= endIdx; i++) {
    const t = dictionary?.[sequence?.[i]];
    if (!t) continue;
    out += t.pos === '개행' ? '\n' : (t.text || '');
  }
  return out;
}

const AUTO_SCROLL_EDGE = 72; // 뷰포트 상·하단 이 안쪽에서 드래그 중이면 자동 스크롤

/**
 * @param {object} opts
 * @param {string[]} opts.sequence - processed_json.sequence (토큰 순서)
 * @param {object} opts.dictionary - tokenId → 토큰
 * @param {boolean} opts.enabled
 * @param {(text: string) => void} opts.onSelect - 지정 확정(2자 이상) 시 합성 텍스트 전달
 */
export function useTokenRangeSelect({ sequence, dictionary, enabled = true, onSelect }) {
  const [range, setRange] = useState(null); // { start, end } — sequence 인덱스(정렬됨)
  const anchorRef = useRef(null);
  const focusRef = useRef(null);
  const didSelectRef = useRef(false); // 제스처 직후 합성 click 억제 플래그
  const lastPointRef = useRef(null);
  const rafRef = useRef(0);
  const touchBlockRef = useRef(null);
  const docListenersRef = useRef(null);

  const seqIndex = useMemo(() => {
    const m = new Map();
    (sequence || []).forEach((id, i) => m.set(id, i));
    return m;
  }, [sequence]);

  const rangeTokenIds = useMemo(() => {
    if (!range || !sequence) return null;
    const s = new Set();
    for (let i = range.start; i <= range.end; i++) s.add(sequence[i]);
    return s;
  }, [range, sequence]);

  const clearRange = useCallback(() => {
    setRange(null);
    anchorRef.current = null;
    focusRef.current = null;
  }, []);

  // 자료 변경·재분석으로 sequence가 바뀌면 지정 해제(인덱스 무효화)
  useEffect(() => { clearRange(); }, [sequence, clearRange]);

  const tokenIdxFromPoint = useCallback((x, y) => {
    const el = document.elementFromPoint(x, y)?.closest?.('[data-tid]');
    if (!el) return null;
    const idx = seqIndex.get(el.dataset.tid);
    return idx == null ? null : idx;
  }, [seqIndex]);

  const applyFocus = useCallback((idx) => {
    if (idx == null || anchorRef.current == null) return;
    if (focusRef.current === idx) return;
    focusRef.current = idx;
    const a = anchorRef.current;
    setRange(a <= idx ? { start: a, end: idx } : { start: idx, end: a });
  }, []);

  // 지정 중 화면 가장자리 자동 스크롤 — 스크롤 후 같은 좌표의 새 토큰으로 포커스 갱신
  const stepAutoScroll = useCallback(() => {
    const p = lastPointRef.current;
    if (p) {
      const vh = window.innerHeight;
      let dy = 0;
      if (p.y < AUTO_SCROLL_EDGE) dy = -Math.ceil((AUTO_SCROLL_EDGE - p.y) / 6);
      else if (p.y > vh - AUTO_SCROLL_EDGE) dy = Math.ceil((p.y - (vh - AUTO_SCROLL_EDGE)) / 6);
      if (dy) {
        window.scrollBy(0, dy);
        applyFocus(tokenIdxFromPoint(p.x, p.y));
      }
    }
    rafRef.current = requestAnimationFrame(stepAutoScroll);
  }, [applyFocus, tokenIdxFromPoint]);

  const cleanupTransient = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
    if (touchBlockRef.current) {
      document.removeEventListener('touchmove', touchBlockRef.current);
      touchBlockRef.current = null;
    }
    if (docListenersRef.current) {
      const { move, up, cancel } = docListenersRef.current;
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', cancel);
      docListenersRef.current = null;
    }
    lastPointRef.current = null;
  }, []);

  const gestureRef = useRef(null);
  if (!gestureRef.current) {
    gestureRef.current = createTokenRangeGesture({
      onStart: () => {
        if (anchorRef.current == null) return;
        didSelectRef.current = true;
        focusRef.current = anchorRef.current;
        setRange({ start: anchorRef.current, end: anchorRef.current });
        // 지정 확정 후 터치 스크롤 차단 — 아직 스크롤이 시작되지 않은 시점이라 유효
        const block = (e) => e.preventDefault();
        document.addEventListener('touchmove', block, { passive: false });
        touchBlockRef.current = block;
        try { navigator.vibrate?.(10); } catch { /* 미지원 무시 */ }
        rafRef.current = requestAnimationFrame(stepAutoScrollRef.current);
      },
      onUpdate: ({ x, y }) => {
        lastPointRef.current = { x, y };
        applyFocusRef.current(tokenIdxFromPointRef.current(x, y));
      },
      onEnd: () => finishRef.current(),
      onCancel: () => cleanupTransientRef.current(),
    });
  }

  // 제스처 코어는 1회 생성 — 최신 콜백은 ref로 전달
  const applyFocusRef = useRef(applyFocus);
  const tokenIdxFromPointRef = useRef(tokenIdxFromPoint);
  const stepAutoScrollRef = useRef(stepAutoScroll);
  const cleanupTransientRef = useRef(cleanupTransient);
  const finishRef = useRef(() => {});
  useEffect(() => {
    applyFocusRef.current = applyFocus;
    tokenIdxFromPointRef.current = tokenIdxFromPoint;
    stepAutoScrollRef.current = stepAutoScroll;
    cleanupTransientRef.current = cleanupTransient;
  });

  const finish = useCallback(() => {
    cleanupTransient();
    const a = anchorRef.current;
    const f = focusRef.current;
    if (a == null || f == null) { clearRange(); return; }
    const [s, e] = a <= f ? [a, f] : [f, a];
    const text = composeRangeText(sequence, dictionary, s, e).trim();
    if (text.length >= 2) {
      setRange({ start: s, end: e });
      onSelect?.(text);
    } else {
      clearRange(); // 1자 이하는 단어 클릭이 담당 — 지정 무효
    }
  }, [sequence, dictionary, onSelect, cleanupTransient, clearRange]);
  useEffect(() => { finishRef.current = finish; }, [finish]);

  const handlePointerDown = useCallback((e) => {
    if (!enabled) return;
    if (e.button != null && e.button !== 0) return; // 좌클릭·터치만
    const tokenEl = e.target?.closest?.('[data-tid]');
    if (!tokenEl || e.target?.closest?.('.line-pick')) return; // 토큰 밖·문장 막대는 통과
    didSelectRef.current = false;
    const idx = seqIndex.get(tokenEl.dataset.tid);
    if (idx == null) return;
    anchorRef.current = idx;
    focusRef.current = idx;
    const g = gestureRef.current;
    g.down({ x: e.clientX, y: e.clientY, pointerType: e.pointerType });
    // 포인터가 본문 밖으로 나가도 추적 — document 레벨에서 이동·종료 수신
    const move = (ev) => g.move({ x: ev.clientX, y: ev.clientY });
    const up = () => { g.up(); detach(); };
    const cancel = () => { g.cancel(); detach(); };
    const detach = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', cancel);
      if (docListenersRef.current?.move === move) docListenersRef.current = null;
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', cancel);
    docListenersRef.current = { move, up, cancel };
  }, [enabled, seqIndex]);

  // 제스처 직후 합성 click이 단어 시트를 열지 않게 캡처 단계에서 차단
  const handleClickCapture = useCallback((e) => {
    if (didSelectRef.current) {
      e.preventDefault();
      e.stopPropagation();
      didSelectRef.current = false;
    }
  }, []);

  // Escape·언마운트 정리
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') clearRange(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      cleanupTransientRef.current();
    };
  }, [clearRange]);

  return { range, rangeTokenIds, clearRange, handlePointerDown, handleClickCapture };
}
