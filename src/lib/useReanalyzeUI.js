'use client';
import { useState } from 'react';
import { getParagraphs } from './useReanalyze';

/**
 * 재분석 패널 UI 상태 + 핸들러.
 * 기존 useReanalyze (mutation 자체) 위에 얹는 UI 레이어.
 *
 * @param {{ reanalyze, material, toast }} reanalyze는 useReanalyze 결과
 * @returns {{ reanalyzePanel, setReanalyzePanel, selectedParas, paragraphs,
 *            togglePara, startFullReanalyze, startPartialReanalyze }}
 */
export function useReanalyzeUI({ reanalyze, material, toast }) {
  // 재분석 패널 상태: null | 'menu' | 'pick'
  const [reanalyzePanel, setReanalyzePanel] = useState(null);
  const [selectedParas, setSelectedParas] = useState(new Set());

  const paragraphs = material?.raw_text ? getParagraphs(material.raw_text) : [];

  function togglePara(idx) {
    setSelectedParas(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }
  function startFullReanalyze() {
    setReanalyzePanel(null);
    reanalyze.mutation.mutate({ fullReset: true });
  }
  function startPartialReanalyze() {
    const lineIndices = new Set();
    for (const pi of selectedParas) {
      const para = paragraphs[pi];
      if (para) para.lineIndices.forEach(li => lineIndices.add(li));
    }
    if (lineIndices.size === 0) { toast?.('문단을 선택해주세요.', 'warning'); return; }
    setReanalyzePanel(null);
    setSelectedParas(new Set());
    reanalyze.mutation.mutate({ selectedLineIndices: lineIndices });
  }

  return {
    reanalyzePanel, setReanalyzePanel,
    selectedParas, paragraphs,
    togglePara, startFullReanalyze, startPartialReanalyze,
  };
}
