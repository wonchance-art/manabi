'use client';
import { useEffect, useState } from 'react';

/**
 * 서버 컴포넌트가 넘긴 약속(직렬화된 thenable)의 값 — 화면을 멈추지 않는다(Suspense 없음). 이미 풀린 약속이면 첫 렌더부터
 * 값을 쓰고(React가 status · value를 붙여 둔다), 아니면 풀리는 대로 다시 그린다. 실패 · 없음은 null.
 * 복습방 첫 화면 숫자(VOCAB-FIRST-NUMBERS-001)가 쓴다 — 숫자를 기다리느라 작업 공간 전체가 멈추면 안 된다.
 */
export function usePromiseValue(promise) {
  const [state, setState] = useState(() => ({ promise, value: promise?.status === 'fulfilled' ? promise.value ?? null : null }));
  useEffect(() => {
    if (!promise || typeof promise.then !== 'function') return undefined;
    let alive = true;
    promise.then(value => { if (alive) setState({ promise, value: value ?? null }); }, () => {});
    return () => { alive = false; };
  }, [promise]);
  if (state.promise !== promise) return promise?.status === 'fulfilled' ? promise.value ?? null : null;
  return state.value;
}
