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
 * TTS 래퍼 — 1순위 서버 고품질 음성(/api/tts, Gemini TTS), 실패 시 Web Speech API 폴백.
 *  - speak(text, lang, opts) — 고품질 음성 재생 (같은 문장은 메모리+HTTP 캐시)
 *  - listVoices / getSelectedVoice / setSelectedVoice — 폴백용 브라우저 음성 선택
 */

// 서버 TTS 재생 캐시 (URL → objectURL) + 현재 재생 핸들
const serverAudioCache = new Map();
let currentAudio = null;

async function playServerTTS(text, language) {
  const url = `/api/tts?lang=${encodeURIComponent(language)}&text=${encodeURIComponent(text)}`;
  let objUrl = serverAudioCache.get(url);
  if (!objUrl) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('tts ' + res.status);
    const blob = await res.blob();
    objUrl = URL.createObjectURL(blob);
    serverAudioCache.set(url, objUrl);
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  const audio = new Audio(objUrl);
  currentAudio = audio;
  await audio.play();
}

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

  // 브라우저 내장 음성 — 서버 TTS 실패 시 폴백 전용
  const speakFallback = useCallback((text, language = 'Japanese', opts = {}) => {
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

  const speak = useCallback((text, language = 'Japanese', opts = {}) => {
    if (typeof window === 'undefined' || !text) return;
    playServerTTS(text, language).catch(() => speakFallback(text, language, opts));
  }, [speakFallback]);

  const stop = useCallback(() => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
  }, []);

  // 서버 TTS는 브라우저 의존성이 없어 클라이언트면 항상 지원
  const supported = typeof window !== 'undefined';

  return { speak, stop, supported, listVoices, getSelectedVoice, setSelectedVoice, voicesReady };
}
