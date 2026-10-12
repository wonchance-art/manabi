'use client';
import { useEffect, useLayoutEffect } from 'react';
import { zhPieces, layoutZhRuns } from '../../lib/zhGrid';

/**
 * 중국어 격자 칸(ZH-GRID-001). 전각 글자는 한 칸(.zh-cell), 반각 묶음은 칸 수로 올림한 묶음(.zh-run).
 * 래퍼 없이 조각만 낸다 — 칸이 .surface(또는 ruby)의 직계 형제여야 칸 사이 자간 규칙이 닿는다.
 */
export function ZhText({ text }) {
  return zhPieces(text).map((piece, i) => piece.cell != null
    ? <span key={i} className="zh-cell">{piece.cell}</span>
    : <span key={i} className="zh-run">{piece.run}</span>);
}

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** 반각 묶음의 칸 수를 그리기 전에 맞춘다. 같은 조건이면 다시 재지 않고, 글꼴이 늦게 오면 다시 잰다. */
export function useZhGridRuns(rootRef, enabled) {
  useIsoLayoutEffect(() => { if (enabled) layoutZhRuns(rootRef.current); });
  useEffect(() => {
    const fonts = enabled && typeof document !== 'undefined' ? document.fonts : null;
    if (!fonts) return undefined;
    let live = true;
    const again = () => { if (live) layoutZhRuns(rootRef.current, true); };
    fonts.ready?.then(again);
    fonts.addEventListener?.('loadingdone', again);
    return () => { live = false; fonts.removeEventListener?.('loadingdone', again); };
  }, [enabled, rootRef]);
}
