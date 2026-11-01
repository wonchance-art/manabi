'use client';
import { useEffect, useState } from 'react';
import { onIdle } from './viewerHanjaPanel';

/**
 * 누른 뒤에만 쓰는 모듈(VIEWER-JS-001) — lazyPanel(부품)의 모듈판. 첫 로드 page 청크에서 빼고, 쓸 수 있는 사람(enabled)에게만
 * 첫 렌더 뒤 유휴 시간에 받아 둔다(받아 두면 워커의 정적 조각 캐시에도 남는다 — 끊긴 뒤에도 같은 조각).
 * 받기 전에는 null이다 — 부르는 쪽은 「아직 없음」을 「진입점 없음」으로 그린다(쓰기 경로는 handle.preload()를 기다린다).
 * @param {() => Promise<any>} load  `() => import('…')` — 청크 분리를 위해 경로는 문자열 그대로.
 */
export function deferredModule(load) {
  let mod = null, pending = null;
  const preload = () => (pending ||= load().then(
    (m) => { mod = m; return m; },
    (error) => { pending = null; throw error; },
  ));
  return { preload, current: () => mod };
}

/** enabled일 때 유휴 시간에 받고, 받으면 다시 그린다. 받은 모듈(또는 null)을 돌려준다. 못 받으면 null 그대로(진입점 없음). */
export function useDeferredModule(handle, enabled) {
  const [, setLoaded] = useState(() => !!handle.current());
  useEffect(() => {
    if (!enabled || handle.current()) return undefined;
    let alive = true;
    const cancel = onIdle(() => { handle.preload().then(() => { if (alive) setLoaded(true); }, () => {}); });
    return () => { alive = false; cancel(); };
  }, [handle, enabled]);
  return enabled ? handle.current() : null;
}
