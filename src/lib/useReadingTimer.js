'use client';

/**
 * 순수 읽기 시간 누적기 (v2-I R1a).
 * 뷰어가 열려 있는 동안 흐른 시간에서 **읽지 않은 구간을 뺀다**(설계 §1 일시정지 3종):
 *   ① 탭 숨김·화면 꺼짐(visibilitychange) ② 단어 카드·번역 시트 열림 ③ 30초 무동작.
 * 계산은 readingTimer(순수)가 하고, 여기는 신호를 모아 ms만 센다.
 *
 * 배경 탭에서 타이머가 새지 않도록 '누적 방식'을 쓴다 — setInterval로 더하지 않고,
 * 활성 구간의 시작 시각만 들고 있다가 멈출 때 차이를 더한다(탭이 얼어도 정확).
 */
import { useCallback, useEffect, useRef } from 'react';
import { IDLE_MS } from './readingTimer';

export function useReadingTimer({ enabled = true, paused = false } = {}) {
  const accRef = useRef(0);        // 누적 읽기 시간(ms)
  const startedRef = useRef(null); // 현재 활성 구간 시작 시각(멈춰 있으면 null)
  const lastActRef = useRef(Date.now());

  const stop = useCallback(() => {
    if (startedRef.current == null) return;
    // 무동작 구간은 마지막 동작 시점까지만 인정한다(그 뒤는 읽은 시간이 아니다).
    const cutoff = Math.min(Date.now(), lastActRef.current + IDLE_MS);
    accRef.current += Math.max(0, cutoff - startedRef.current);
    startedRef.current = null;
  }, []);

  const start = useCallback(() => {
    if (startedRef.current != null) return;
    startedRef.current = Date.now();
    lastActRef.current = Date.now();
  }, []);

  /** 사용자 동작 신호 — 무동작 타이머를 되감고, 쉬고 있었다면 다시 센다. */
  const markActivity = useCallback(() => {
    const now = Date.now();
    if (startedRef.current != null && now - lastActRef.current > IDLE_MS) {
      // 무동작으로 흘러간 구간을 잘라내고 지금부터 다시 잰다.
      accRef.current += Math.max(0, lastActRef.current + IDLE_MS - startedRef.current);
      startedRef.current = now;
    }
    lastActRef.current = now;
  }, []);

  /** 지금까지의 순수 읽기 시간(ms) — 재는 중이면 현재 구간까지 더해 돌려준다. */
  const readMs = useCallback(() => {
    if (startedRef.current == null) return accRef.current;
    const cutoff = Math.min(Date.now(), lastActRef.current + IDLE_MS);
    return accRef.current + Math.max(0, cutoff - startedRef.current);
  }, []);

  const reset = useCallback(() => {
    accRef.current = 0;
    startedRef.current = null;
    lastActRef.current = Date.now();
  }, []);

  // ①③ 가시성 + 동작 신호
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const onVisibility = () => (document.hidden ? stop() : start());
    const onAct = () => markActivity();
    document.addEventListener('visibilitychange', onVisibility);
    for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) {
      window.addEventListener(ev, onAct, { passive: true });
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) {
        window.removeEventListener(ev, onAct);
      }
    };
  }, [start, stop, markActivity]);

  // ② 카드·시트가 열려 있으면 멈춘다(찾아보기 시간은 읽기가 아니다) + 뷰어 이탈 시 정지
  useEffect(() => {
    const shouldRun = enabled && !paused && typeof document !== 'undefined' && !document.hidden;
    if (shouldRun) start(); else stop();
    return () => stop();
  }, [enabled, paused, start, stop]);

  return { readMs, reset, markActivity };
}
