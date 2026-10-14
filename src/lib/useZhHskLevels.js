'use client';
// HSK 2026 급수 표 훅 — 조회 정본은 zhHskLevel.js(서버 조립도 쓰므로 react를 들이지 않는다).
import { useEffect, useState } from 'react';
import { loadZhHskLevels } from './zhHskLevel';

/** 표 훅 — enabled(중국어 화면)일 때만 받는다. 꺼져 있거나 받는 중이면 null. */
export function useZhHskLevels(enabled) {
  const [levels, setLevels] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    loadZhHskLevels().then((t) => { if (alive) setLevels(t); }).catch(() => {});
    return () => { alive = false; };
  }, [enabled]);
  return enabled ? levels : null;
}
