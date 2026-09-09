'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { analyzeText } from './analyzeText';
import { autoSplitParagraphs } from './splitParagraphs';
import { runPreservedReanalysis } from './reanalysisPreservation';
import { passageOf } from './sourcePassage';
import { runPassageAnalysis } from './passageAnalysis';

const STALE_THRESHOLD_MS = 3 * 60 * 1000;

export function isStaleAnalyzing(material) {
  const json = material?.processed_json;
  const status = json?.status || material?.status;
  if (status !== 'analyzing') return false;
  const updatedAt = json?.metadata?.updated_at;
  if (!updatedAt) return true;
  return Date.now() - new Date(updatedAt).getTime() > STALE_THRESHOLD_MS;
}

export function computeMissingLineIndices(material) {
  const rawText = material?.raw_text || '';
  const lines = rawText.split('\n');
  const sequence = material?.processed_json?.sequence || [];
  const processedIndices = new Set();
  for (const tokenId of sequence) {
    const m = tokenId.match(/^(?:id|failed|br)_(\d+)_/);
    if (m) processedIndices.add(parseInt(m[1]));
  }
  const missing = [];
  for (let i = 0; i < lines.length; i++) {
    if (!processedIndices.has(i) && lines[i].trim()) missing.push(i);
  }
  return missing;
}

/** raw_text를 문단으로 분리 (자동 분리 적용). 각 문단: { index, lineIndices, preview } */
export function getParagraphs(rawText, preserveSource = false) {
  if (!rawText) return [];
  if (!preserveSource) rawText = autoSplitParagraphs(rawText);
  const lines = rawText.split('\n');
  const paragraphs = [];
  let current = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) {
      if (current.length > 0) {
        paragraphs.push(current);
        current = [];
      }
    } else {
      current.push(i);
    }
  }
  if (current.length > 0) paragraphs.push(current);

  return paragraphs.map((lineIndices, index) => ({
    index,
    lineIndices,
    preview: lines[lineIndices[0]].trim().slice(0, 60) + (lines[lineIndices[0]].trim().length > 60 ? '…' : ''),
    lineCount: lineIndices.length,
  }));
}

/**
 * Viewer 재분석 훅
 * mutation opts:
 *   { fullReset: true }           — 전체 재분석
 *   { selectedLineIndices: Set }  — 선택 문단만 재분석 (나머지 기존 유지)
 */
export function useReanalyze({ materialId, material, refetch, toast }) {
  const abortRef = useRef(null);
  const committingRef = useRef(false);
  const [committing, setCommitting] = useState(false);
  const queryClient = useQueryClient();
  useEffect(() => () => abortRef.current?.abort(), [materialId]);
  const [confirmState, setConfirmState] = useState(null);
  const activeId = useRef(materialId);
  activeId.current = materialId;

  const failedIndices = material?.processed_json?.failed_indices || [];
  const stale = isStaleAnalyzing(material);
  const missingIndices = stale ? computeMissingLineIndices(material) : [];

  const mutation = useMutation({
    onMutate: () => ({ materialId }),
    // 편집 초안과 리맵된 분석은 성공한 최종 교체 전까지 메모리에만 둔다.
    mutationFn: async ({ fullReset = false, resume = false, selectedLineIndices = null, rawTextOverride = null, baseJsonOverride = null } = {}) => {
      let rawText = rawTextOverride || material?.raw_text;
      if (!rawText) throw new Error('원본 텍스트가 없습니다.');
      if (passageOf(material)) {
        const controller = new AbortController();
        abortRef.current = controller;
        return runPassageAnalysis(supabase, material, controller.signal, analyzeText,
          record => queryClient.setQueryData(['material', String(materialId)], record));
      }

      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;
      try {
        const record = await runPreservedReanalysis(supabase, material, controller.signal, analyzeText, {
          fullReset, resume, selectedLineIndices, rawTextOverride, baseJsonOverride,
          onCommitting: () => { committingRef.current = true; setCommitting(true); },
        });
        queryClient.setQueryData(['material', String(materialId)], record);
        return record.processed_json;
      } finally { committingRef.current = false; setCommitting(false); }
    },
    onSuccess: (json, variables, scope) => {
      if (activeId.current !== scope?.materialId) return;
      if (json?.__passageNotAcquired) { refetch?.(); return; }
      if (json?.status === 'failed') toast?.('분석에 실패했어요. 원문은 그대로 남아 있어요.', 'error');
      else if (json?.status === 'partial') toast?.('일부 줄은 분석을 다시 시도해야 해요.', 'warning');
      else toast?.('분석 완료!', 'success');
      refetch?.();
    },
    onError: (err, variables, scope) => {
      if (activeId.current !== scope?.materialId) return;
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
    committing,
    request: (opts) => setConfirmState(opts),
    confirm: () => { mutation.mutate(confirmState); setConfirmState(null); },
    cancel: () => setConfirmState(null),
    stop: () => { if (!committingRef.current) abortRef.current?.abort(); },
  };
}
