'use client';

import { useEffect, useState } from 'react';
import { useTTS } from '../lib/useTTS';

/**
 * 레퍼런스 발음 버튼 — Web Speech API (fr-FR / ja-JP / en-US)
 * 서버 렌더와의 hydration 불일치를 피하기 위해 mount 후에만 표시.
 */
export default function RefSpeak({ text, lang, size = 'sm' }) {
  const { speak, supported } = useTTS();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !supported || !text) return null;
  return (
    <button
      type="button"
      className={`fr-speak ${size === 'xs' ? 'fr-speak--xs' : ''}`}
      onClick={e => { e.stopPropagation(); speak(text, lang); }}
      aria-label="발음 듣기"
      title="발음 듣기"
    >
      ▷
    </button>
  );
}
