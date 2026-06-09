'use client';
import { useCallback, useEffect, useState } from 'react';

const VOICE_KEY = 'tts_voice'; // { ja: voiceURI, en: voiceURI }

function loadStoredVoice(langKey) {
  if (typeof window === 'undefined') return null;
  try {
    const saved = JSON.parse(localStorage.getItem(VOICE_KEY) || '{}');
    return saved[langKey] || null;
  } catch { return null; }
}

function saveStoredVoice(langKey, voiceURI) {
  if (typeof window === 'undefined') return;
  try {
    const saved = JSON.parse(localStorage.getItem(VOICE_KEY) || '{}');
    saved[langKey] = voiceURI;
    localStorage.setItem(VOICE_KEY, JSON.stringify(saved));
  } catch {}
}

/**
 * Web Speech API wrapper. 음성 선택 지원.
 *  - listVoices(lang) → 사용 가능한 음성 목록
 *  - getSelectedVoice(lang) / setSelectedVoice(lang, voiceURI)
 *  - speak(text, lang, opts) — 선택된 음성 + rate·pitch
 */
export function useTTS() {
  const [voicesReady, setVoicesReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    function refresh() {
      if (synth.getVoices().length > 0) setVoicesReady(true);
    }
    refresh();
    synth.addEventListener?.('voiceschanged', refresh);
    return () => synth.removeEventListener?.('voiceschanged', refresh);
  }, []);

  const langCode = (lang) =>
    lang === 'Japanese' || lang === 'ja' ? 'ja-JP'
    : lang === 'French' || lang === 'fr' ? 'fr-FR'
    : 'en-US';
  const langKey = (lang) =>
    lang === 'Japanese' || lang === 'ja' ? 'ja'
    : lang === 'French' || lang === 'fr' ? 'fr'
    : 'en';

  const listVoices = useCallback((lang = 'Japanese') => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return [];
    const all = window.speechSynthesis.getVoices();
    const code = langCode(lang);
    const prefix = code.split('-')[0];
    return all.filter(v => v.lang === code || v.lang.startsWith(prefix + '-'));
  }, [voicesReady]);

  const getSelectedVoice = useCallback((lang = 'Japanese') => {
    return loadStoredVoice(langKey(lang));
  }, []);

  const setSelectedVoice = useCallback((lang, voiceURI) => {
    saveStoredVoice(langKey(lang), voiceURI || null);
  }, []);

  const speak = useCallback((text, language = 'Japanese', opts = {}) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = langCode(language);
    utter.rate = opts.rate ?? 0.85;
    utter.pitch = opts.pitch ?? 1;
    const wantedURI = loadStoredVoice(langKey(language));
    if (wantedURI) {
      const v = window.speechSynthesis.getVoices().find(x => x.voiceURI === wantedURI);
      if (v) utter.voice = v;
    }
    window.speechSynthesis.speak(utter);
  }, [voicesReady]);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
  }, []);

  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  return { speak, stop, supported, listVoices, getSelectedVoice, setSelectedVoice, voicesReady };
}
