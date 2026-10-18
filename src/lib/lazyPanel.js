'use client';
import { createElement, useEffect, useState } from 'react';

/**
 * 조건부 패널 지연 로드(VIEWER-LAZY-PANELS-001) — 열 때만 청크를 받되, Suspense를 쓰지 않는다.
 * next/dynamic(=React.lazy + Suspense)은 처음 열 때 fallback을 한 번 커밋하고, React가 그 뒤 내용 공개를
 * 약 300ms 묶어 둔다(FALLBACK_THROTTLE_MS). 실측(2026-10-16 KST, 로컬 production): 설정 창 첫 열림 80–90ms → 325–390ms,
 * 청크를 미리 받아 둔 한자 창도 50–80ms → 320–380ms. 여기서는 모듈을 받은 뒤 평범한 상태 갱신으로 그리므로
 * 첫 열림 지연 = 청크 내려받기뿐이고, 미리 받았으면(preload) 첫 렌더부터 동기로 그린다.
 * 서버 렌더에서는 fallback만 그린다(자료를 클라이언트에서 받는 뷰어 패널 전용 — 첫 화면 부품에는 쓰지 않는다).
 * @param {() => Promise<any>} load  `() => import('…')` — 청크 분리를 위해 경로는 문자열 그대로.
 * @param {{fallback?: any}} [opts]  받는 동안 그릴 것(기본 null). 함수면 props를 받는다.
 */
export function lazyPanel(load, { fallback = null } = {}) {
  let Component = null, pending = null;
  const preload = () => (pending ||= load().then(
    (mod) => { Component = mod?.default || mod; return Component; },
    (error) => { pending = null; throw error; },
  ));
  function LazyPanel(props) {
    const [, setLoaded] = useState(!!Component);
    const [error, setError] = useState(null);
    useEffect(() => {
      if (Component) return undefined;
      let alive = true;
      preload().then(() => { if (alive) setLoaded(true); }, (e) => { if (alive) setError(e); });
      return () => { alive = false; };
    }, []);
    if (error) throw error; // 청크를 못 받으면 next/dynamic과 같이 경계(viewer/error.jsx)로 보낸다.
    if (!Component) return typeof fallback === 'function' ? fallback(props) : fallback;
    return createElement(Component, props);
  }
  LazyPanel.preload = preload;
  return LazyPanel;
}
