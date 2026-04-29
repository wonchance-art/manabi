'use client';
import { useState } from 'react';
import { fetchWordDetailText } from './wordDetail';

/**
 * 드래그된 단어 리스트의 한 단어 클릭 시 AI 상세 팝업.
 * @returns {{ popupWord, setPopupWord, handleDragWordClick }}
 *   popupWord: { token, detail, loading } | null
 */
export function useDragWordPopup(language) {
  const [popupWord, setPopupWord] = useState(null);

  async function handleDragWordClick(token) {
    setPopupWord({ token, detail: null, loading: true });
    try {
      const detail = await fetchWordDetailText(token, language);
      setPopupWord({ token, detail, loading: false });
    } catch {
      setPopupWord(prev => prev ? { ...prev, detail: '설명을 가져올 수 없었어요.', loading: false } : null);
    }
  }

  return { popupWord, setPopupWord, handleDragWordClick };
}
