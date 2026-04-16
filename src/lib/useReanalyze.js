'use client';

import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from './supabase';
import { analyzeText } from './analyzeText';
import { autoSplitParagraphs } from './splitParagraphs';

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
export function getParagraphs(rawText) {
  if (!rawText) return [];
  rawText = autoSplitParagraphs(rawText);
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
  const [confirmState, setConfirmState] = useState(null);

  const failedIndices = material?.processed_json?.failed_indices || [];
  const stale = isStaleAnalyzing(material);
  const missingIndices = stale ? computeMissingLineIndices(material) : [];

  const mutation = useMutation({
    mutationFn: async ({ fullReset = false, resume = false, selectedLineIndices = null } = {}) => {
      let rawText = material?.raw_text;
      if (!rawText) throw new Error('원본 텍스트가 없습니다.');

      // 문단 구분이 안 돼있으면 자동 분리 후 DB에도 반영
      const split = autoSplitParagraphs(rawText);
      if (split !== rawText) {
        rawText = split;
        await supabase.from('reading_materials').update({ raw_text: rawText }).eq('id', materialId);
      }

      const controller = new AbortController();
      abortRef.current = controller;

      const initMeta = {
        ...(material.processed_json?.metadata || {}),
        updated_at: new Date().toISOString(),
      };

      let baseJson = null;
      let statusJson;

      if (selectedLineIndices) {
        // 부분 분석: 선택한 줄만 failed로 마킹 → 나머지 기존 유지
        const failedForPartial = [...selectedLineIndices].sort((a, b) => a - b);
        baseJson = { ...material.processed_json, failed_indices: failedForPartial };
        statusJson = { ...baseJson, status: 'analyzing', metadata: initMeta };
      } else if (fullReset) {
        statusJson = { sequence: [], dictionary: {}, last_idx: -1, status: 'analyzing', metadata: initMeta, failed_indices: [] };
      } else if (resume && missingIndices.length > 0) {
        const mergedFailed = [...new Set([...(failedIndices || []), ...missingIndices])].sort((a, b) => a - b);
        baseJson = { ...material.processed_json, failed_indices: mergedFailed };
        statusJson = { ...baseJson, status: 'analyzing', metadata: initMeta };
      } else if (failedIndices.length > 0) {
        baseJson = material.processed_json;
        statusJson = { ...baseJson, status: 'analyzing', metadata: initMeta };
      } else {
        statusJson = { sequence: [], dictionary: {}, last_idx: -1, status: 'analyzing', metadata: initMeta, failed_indices: [] };
      }

      await supabase.from('reading_materials').update({ processed_json: statusJson }).eq('id', materialId);

      await analyzeText(rawText, controller.signal, {
        metadata: initMeta,
        existingJson: baseJson,
        concurrency: 8,
        onBatch: async ({ currentJson }) => {
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
