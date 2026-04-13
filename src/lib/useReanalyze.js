'use client';

import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from './supabase';
import { analyzeText } from './analyzeText';

/**
 * Viewer 재분석 훅 — 전체 재분석 또는 실패 줄만 재시도
 *
 * @param {object} params
 * @param {string} params.materialId
 * @param {object} params.material - reading_materials 로우
 * @param {Function} params.refetch - 머터리얼 재조회
 * @param {Function} params.toast
 */
export function useReanalyze({ materialId, material, refetch, toast }) {
  const abortRef = useRef(null);
  const [confirmState, setConfirmState] = useState(null); // null | { fullReset }

  const failedIndices = material?.processed_json?.failed_indices || [];

  const mutation = useMutation({
    mutationFn: async ({ fullReset = false } = {}) => {
      const rawText = material?.raw_text;
      if (!rawText) throw new Error('원본 텍스트가 없습니다.');

      const controller = new AbortController();
      abortRef.current = controller;

      const hasPartial = !fullReset && failedIndices.length > 0;
      const baseJson = hasPartial ? material.processed_json : null;
      const initMeta = material.processed_json?.metadata || {};

      // 진행 상태 표시
      const statusJson = hasPartial
        ? { ...material.processed_json, status: 'analyzing' }
        : { sequence: [], dictionary: {}, last_idx: -1, status: 'analyzing', metadata: initMeta };
      await supabase.from('reading_materials').update({ processed_json: statusJson }).eq('id', materialId);

      await analyzeText(rawText, controller.signal, {
        metadata: initMeta,
        existingJson: baseJson,
        onBatch: async ({ currentJson }) => {
          const { error: updateError } = await supabase
            .from('reading_materials')
            .update({ processed_json: currentJson })
            .eq('id', materialId);
          if (updateError) console.error('[reanalyze] DB update failed:', updateError.message);
        },
      });
    },
    onSuccess: () => {
      toast?.('재분석 완료!', 'success');
      refetch?.();
    },
    onError: (err) => {
      if (err.name !== 'AbortError') toast?.('재분석 실패: ' + err.message, 'error');
      refetch?.();
    },
  });

  return {
    mutation,
    confirmState,
    failedIndices,
    request: (opts) => setConfirmState(opts),
    confirm: () => { mutation.mutate(confirmState); setConfirmState(null); },
    cancel: () => setConfirmState(null),
    stop: () => abortRef.current?.abort(),
  };
}
