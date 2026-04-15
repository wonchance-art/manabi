'use client';

import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from './supabase';
import { analyzeText } from './analyzeText';

const STALE_THRESHOLD_MS = 3 * 60 * 1000; // 3분 이상 움직임 없으면 중단으로 판단

/** 분석이 중단된 상태인지 감지 */
export function isStaleAnalyzing(material) {
  const json = material?.processed_json;
  const status = json?.status || material?.status;
  if (status !== 'analyzing') return false;

  const updatedAt = json?.metadata?.updated_at;
  if (!updatedAt) return true; // 타임스탬프 없으면 stale로 간주
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  return ageMs > STALE_THRESHOLD_MS;
}

/** 아직 처리 안 된 원본 줄 인덱스 배열 반환 */
export function computeMissingLineIndices(material) {
  const rawText = material?.raw_text || '';
  const lines = rawText.split('\n');
  const total = lines.length;
  const sequence = material?.processed_json?.sequence || [];

  // sequence의 토큰 ID에서 원본 줄 idx 추출 (id_{idx}_ · failed_{idx}_ · br_{idx}_)
  const processedIndices = new Set();
  for (const tokenId of sequence) {
    const m = tokenId.match(/^(?:id|failed|br)_(\d+)_/);
    if (m) processedIndices.add(parseInt(m[1]));
  }

  const missing = [];
  for (let i = 0; i < total; i++) {
    if (!processedIndices.has(i) && lines[i].trim()) {
      missing.push(i);
    }
  }
  return missing;
}

/**
 * Viewer 재분석 훅
 * - mode: 'full'(전체 재분석) | 'failed'(실패 줄만) | 'resume'(중단 지점 이어서)
 */
export function useReanalyze({ materialId, material, refetch, toast }) {
  const abortRef = useRef(null);
  const [confirmState, setConfirmState] = useState(null);

  const failedIndices = material?.processed_json?.failed_indices || [];
  const stale = isStaleAnalyzing(material);
  const missingIndices = stale ? computeMissingLineIndices(material) : [];

  const mutation = useMutation({
    mutationFn: async ({ fullReset = false, resume = false } = {}) => {
      const rawText = material?.raw_text;
      if (!rawText) throw new Error('원본 텍스트가 없습니다.');

      const controller = new AbortController();
      abortRef.current = controller;

      const initMeta = {
        ...(material.processed_json?.metadata || {}),
        updated_at: new Date().toISOString(),
      };

      let baseJson = null;
      let statusJson;

      if (fullReset) {
        // 전체 리셋
        statusJson = { sequence: [], dictionary: {}, last_idx: -1, status: 'analyzing', metadata: initMeta, failed_indices: [] };
      } else if (resume && missingIndices.length > 0) {
        // 이어서 분석: 미처리 줄을 failed_indices로 추가
        const mergedFailed = [...new Set([...(failedIndices || []), ...missingIndices])].sort((a, b) => a - b);
        baseJson = { ...material.processed_json, failed_indices: mergedFailed };
        statusJson = { ...baseJson, status: 'analyzing', metadata: initMeta };
      } else if (failedIndices.length > 0) {
        // 실패 줄만
        baseJson = material.processed_json;
        statusJson = { ...baseJson, status: 'analyzing', metadata: initMeta };
      } else {
        // 기본 전체
        statusJson = { sequence: [], dictionary: {}, last_idx: -1, status: 'analyzing', metadata: initMeta, failed_indices: [] };
      }

      await supabase.from('reading_materials').update({ processed_json: statusJson }).eq('id', materialId);

      await analyzeText(rawText, controller.signal, {
        metadata: initMeta,
        existingJson: baseJson,
        concurrency: 8,
        onBatch: async ({ currentJson }) => {
          // updated_at 매번 갱신해서 stale 판단에 활용
          const json = {
            ...currentJson,
            metadata: { ...currentJson.metadata, updated_at: new Date().toISOString() },
          };
          const { error: updateError } = await supabase
            .from('reading_materials')
            .update({ processed_json: json })
            .eq('id', materialId);
          if (updateError) console.error('[reanalyze] DB update failed:', updateError.message);
        },
      });
    },
    onSuccess: () => {
      toast?.('분석 완료!', 'success');
      refetch?.();
    },
    onError: (err) => {
      if (err.name !== 'AbortError') toast?.('분석 실패: ' + err.message, 'error');
      refetch?.();
    },
  });

  return {
    mutation,
    confirmState,
    failedIndices,
    stale,
    missingIndices,
    request: (opts) => setConfirmState(opts),
    confirm: () => { mutation.mutate(confirmState); setConfirmState(null); },
    cancel: () => setConfirmState(null),
    stop: () => abortRef.current?.abort(),
  };
}
