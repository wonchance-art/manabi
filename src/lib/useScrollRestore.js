'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { createPositionWriter } from './readingPositionWriter';
import { pagerFor } from './usePagedReader';

/**
 * 자료 재진입 시 마지막 읽은 위치로 자동 스크롤 복원 + 스크롤 위치 저장 (debounce 2s).
 * 쪽 넘김 보기(READER-PAGED-001)에서는 같은 토큰 번호로 그 토큰이 있는 쪽을 연다 — 쪽 번호는 저장하지 않는다.
 * 쪽을 넘길 때의 저장은 뷰어가 usePagedReader의 onUserPage로 saveScrollPosition을 부른다.
 * @returns {{ saveScrollPosition, tokenRefs }}
 *   tokenRefs: 본문 토큰 DOM ref 등록용 (token id → element)
 *   saveScrollPosition(tokenIdx): 호출 시 2초 후 DB 저장
 */
export function useScrollRestore({ user, materialId, material, readingProgress, readerRef }) {
  const writerRef = useRef(null);
  const ownerRef = useRef(user?.id);
  ownerRef.current = user?.id;
  const queryClient = useQueryClient();
  const [positionError, setPositionError] = useState(false);
  const tokenRefs = useRef({});
  const restoredKey = useRef(null);
  const key = `${user?.id || 'guest'}:${materialId}`;

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    setPositionError(false);
    const owner = user.id;
    const writer = createPositionWriter(async index => {
      if (ownerRef.current !== owner) return;
      const { error } = await supabase.from('reading_progress').upsert({
        user_id: owner, material_id: materialId, last_token_idx: index,
      }, { onConflict: 'user_id,material_id' });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['reading-progress', owner, materialId] });
      queryClient.invalidateQueries({ queryKey: ['library-reading-v2', owner] });
      queryClient.invalidateQueries({ queryKey: ['home-v2', owner] });
    }, error => { if (alive) setPositionError(!!error); });
    writerRef.current = { key, writer };
    const flush = () => writer.flush();
    window.addEventListener('pagehide', flush);
    return () => {
      alive = false;
      window.removeEventListener('pagehide', flush);
      writer.close(ownerRef.current === owner);
      writerRef.current = null;
    };
  }, [user?.id, materialId, key, queryClient]);

  const saveScrollPosition = useCallback((tokenIdx) => {
    if (writerRef.current?.key === key) {
      // A delayed query response must not pull the reader back after they moved.
      restoredKey.current = key;
      writerRef.current.writer.schedule(tokenIdx);
    }
  }, [key]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('sourceToken') || params.has('sourceText') || params.has('sourceContext') || params.has('sourceEntry') || params.has('sourceQuote')) return;
    const lastIdx = readingProgress?.last_token_idx;
    if (!Number.isInteger(lastIdx) || lastIdx < 0 || restoredKey.current === key) return;
    const json = material?.processed_json;
    if (!json?.sequence?.length) return;
    const tokenId = json.sequence[lastIdx];
    if (!tokenId) return;
    const timer = setTimeout(() => {
      // Selection may have taken precedence after this restore was scheduled.
      if (restoredKey.current === key) return;
      const el = tokenRefs.current[tokenId];
      if (el) {
        const pager = pagerFor(el);
        if (pager) pager.reveal(el);
        else el.scrollIntoView({ behavior: 'instant', block: 'center' });
        restoredKey.current = key;
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [readingProgress, material, key]);

  // Record the visible text after an intentional scroll, even when no word was tapped.
  useEffect(() => {
    const sequence = material?.processed_json?.sequence;
    if (!sequence?.length || !user?.id) return;
    let timer;
    const remember = () => {
      // 쪽 넘김 보기는 세로 위치로 고르면 다른 단의 토큰이 잡힌다 — 쪽 넘김 쪽(onUserPage)이 저장한다.
      if (pagerFor(readerRef?.current)) return;
      const elements = sequence.map((id, index) => ({ el: tokenRefs.current[id], index })).filter(item => item.el?.isConnected);
      if (!elements.length) return;
      let low = 0, high = elements.length - 1;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (elements[mid].el.getBoundingClientRect().top < 130) low = mid + 1; else high = mid;
      }
      const item = elements[low], rect = item.el.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) saveScrollPosition(item.index);
    };
    const scroll = () => { clearTimeout(timer); if(readerRef?.current?.dataset.layoutRestoring==='true'||readerRef?.current?.dataset.selectionRevealing==='true')return; timer = setTimeout(remember, 450); };
    window.addEventListener('scroll', scroll, { passive: true });
    return () => { clearTimeout(timer); window.removeEventListener('scroll', scroll); };
  }, [material?.processed_json?.sequence, user?.id, saveScrollPosition, readerRef]);

  return { saveScrollPosition, tokenRefs, positionError, retryPosition: () => writerRef.current?.writer.flush() };
}
