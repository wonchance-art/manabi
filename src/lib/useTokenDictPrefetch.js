'use client';
// 자료를 열 때 표제어 사전 행을 미리 받아 카드 캐시(['token-dict', lang, key])를 채운다 — tokenDictPrefetch.js.
// 화면 출력은 바꾸지 않는다(같은 데이터를 더 일찍 캐시에 넣을 뿐). 한 번 요청한 키는 실패해도
// 다시 요청하지 않는다 — 실패한 키는 카드를 열 때 기존 단건 경로가 받는다. 시작한 요청은 화면을
// 떠나도 끝까지 받아 공유 캐시에 넣는다(키가 언어별이라 다른 자료와 섞이지 않는다).

import { useEffect, useMemo, useRef } from 'react';
import { collectTokenDictKeys, prefetchTokenDict } from './tokenDictPrefetch.js';

export function useTokenDictPrefetch({ supabase, queryClient, language, processedJson, enabled }) {
  const keys = useMemo(() => (enabled ? collectTokenDictKeys(processedJson) : []), [enabled, processedJson]);
  // 교정 등으로 processed_json 객체가 바뀌어도 표제어 집합이 같으면 다시 돌지 않는다.
  const signature = enabled && keys.length ? `${language}\u0000${keys.join('\u0000')}` : '';
  const requested = useRef(new Map()); // language → Set(요청한 키)
  useEffect(() => {
    if (!signature) return;
    const seen = requested.current.get(language) || new Set();
    requested.current.set(language, seen);
    const fresh = keys.filter((key) => !seen.has(key));
    if (!fresh.length) return;
    for (const key of fresh) seen.add(key);
    prefetchTokenDict({ supabase, queryClient, language, keys: fresh }).catch(() => {});
    // keys는 signature가 대표한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, supabase, queryClient, language]);
}
