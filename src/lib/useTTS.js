'use client';
import { useCallback } from 'react';

/**
 * Web Speech API wrapper for TTS (Japanese / English)
 */
export function useTTS() {
  const speak = useCallback((text, language = 'Japanese') => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = language === 'Japanese' ? 'ja-JP' : 'en-US';
    utter.rate = 0.85;
    utter.pitch = 1;
    window.speechSynthesis.speak(utter);
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
  }, []);

  const supported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  return { speak, stop, supported };
}
