'use client';
import { useState } from 'react';
import { getParagraphs } from './useReanalyze';

/**
 * 재분석 패널 UI 상태 + 핸들러.
 * 기존 useReanalyze (mutation 자체) 위에 얹는 UI 레이어.
 *
 * @param {{ reanalyze, material, toast }} reanalyze는 useReanalyze 결과
 * @returns {{ reanalyzePanel, setReanalyzePanel, selectedParas, paragraphs,
 *            togglePara, requestFullReanalyze, startFullReanalyze, startPartialReanalyze }}
 */
export function useReanalyzeUI({ reanalyze, material, toast, panel, onPanelChange }) {
  // 재분석 패널 상태: null | 'menu' | 'confirm-full' | 'pick'
  const [localPanel,setLocalPanel] = useState(null);
  const reanalyzePanel = onPanelChange ? panel : localPanel;
  const setReanalyzePanel = onPanelChange || setLocalPanel;
  const [selectedParas, setSelectedParas] = useState(new Set());

  const paragraphs = material?.raw_text ? getParagraphs(material.raw_text, true) : [];

  function togglePara(idx) {
    setSelectedParas(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }
  // 「자료 관리 > 전체 분석」은 한 번 더 묻는다(WALL-STATES-001 ④) — 기존 분석을 새 결과로 바꾸는
  // 동작이라 한 번 클릭으로 시작하지 않는다. 확인 단계는 같은 창의 'confirm-full' 화면이다.
  // 분석 전·분석 실패 배너의 버튼은 잃을 분석이 없어 startFullReanalyze를 바로 쓴다.
  function requestFullReanalyze() {
    setReanalyzePanel('confirm-full');
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
    if (lineIndices.size === 0) { toast?.('문단을 골라 주세요.', 'warning'); return; }
    setReanalyzePanel(null);
    setSelectedParas(new Set());
    reanalyze.mutation.mutate({ selectedLineIndices: lineIndices });
  }

  return {
    reanalyzePanel, setReanalyzePanel,
    selectedParas, setSelectedParas, paragraphs,
    togglePara, requestFullReanalyze, startFullReanalyze, startPartialReanalyze,
  };
}
