'use client';
import { useCallback, useEffect, useRef } from 'react';
import { supabase } from './supabase';

/**
 * 자료 재진입 시 마지막 읽은 위치로 자동 스크롤 복원 + 스크롤 위치 저장 (debounce 2s).
 * @returns {{ saveScrollPosition, tokenRefs }}
 *   tokenRefs: 본문 토큰 DOM ref 등록용 (token id → element)
 *   saveScrollPosition(tokenIdx): 호출 시 2초 후 DB 저장
 */
export function useScrollRestore({ user, materialId, material, readingProgress }) {
  const scrollSaveTimerRef = useRef(null);
  const tokenRefs = useRef({});
  const hasRestoredScroll = useRef(false);

  const saveScrollPosition = useCallback((tokenIdx) => {
    if (!user) return;
    clearTimeout(scrollSaveTimerRef.current);
    scrollSaveTimerRef.current = setTimeout(async () => {
      await supabase.from('reading_progress').upsert({
        user_id: user.id,
        material_id: materialId,
        last_token_idx: tokenIdx,
      }, { onConflict: 'user_id,material_id' });
    }, 2000);
  }, [user, materialId]);

  useEffect(() => {
    const lastIdx = readingProgress?.last_token_idx;
    if (!lastIdx || hasRestoredScroll.current) return;
    const json = material?.processed_json;
    if (!json?.sequence?.length) return;
    const tokenId = json.sequence[lastIdx];
    if (!tokenId) return;
    const timer = setTimeout(() => {
      const el = tokenRefs.current[tokenId];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        hasRestoredScroll.current = true;
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [readingProgress, material]);

  return { saveScrollPosition, tokenRefs };
}
