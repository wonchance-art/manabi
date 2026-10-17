'use client';
import { useCallback, useEffect, useState } from 'react';
import { bcp47ForLanguage, voicePrefixForLanguage } from './speechLang';
import { viewerLanguageInfo } from './viewerLanguage';

const readerSpeechTag = language => viewerLanguageInfo(language)?.speechLocale || bcp47ForLanguage(language);
const readerVoiceKey = language => viewerLanguageInfo(language)?.code || voicePrefixForLanguage(language);

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
 *  - speak(text, lang, opts) — 고품질 음성 재생; 단어 클릭은 preferBrowser로 즉시 재생
 *  - listVoices / getSelectedVoice / setSelectedVoice — 폴백용 브라우저 음성 선택
 */

// 서버 TTS 재생 캐시 (URL → objectURL) + 현재 재생 핸들
const serverAudioCache = new Map();
let currentAudio = null;
let audioGeneration = 0;

export function getTtsCapabilities(browser = typeof window === 'undefined' ? null : window) {
  if (!browser) return { webSpeech: false, serverAudio: false, supported: false };
  const webSpeech = !!browser.speechSynthesis && typeof browser.SpeechSynthesisUtterance === 'function';
  const serverAudio = typeof browser.fetch === 'function'
    && typeof browser.Audio === 'function'
    && typeof browser.URL?.createObjectURL === 'function';
  return { webSpeech, serverAudio, supported: webSpeech || serverAudio };
}

export function immediateSpeechVoice(voices, language, wantedURI) {
  const code = readerSpeechTag(language).toLowerCase();
  const prefix = code.split('-')[0];
  const matching = voices.filter(v => v.lang?.toLowerCase() === prefix || v.lang?.toLowerCase().startsWith(prefix + '-'));
  return matching.find(v => v.voiceURI === wantedURI)
    || matching.find(v => v.localService && v.lang.toLowerCase() === code)
    || matching.find(v => v.localService)
    || matching.find(v => v.lang.toLowerCase() === code)
    || matching[0];
}

// 서버 음성이 「서비스 설정」(결제 · 크레딧, /api/tts code 'service_config')으로 실패하면 이 탭(세션)에서 SKIP_MS 동안
// 서버를 부르지 않고 바로 브라우저 음성을 쓴다 — 단어를 누를 때마다 실패 왕복(운영 실측 0.55~2.4초)을 기다리던 것(GEMINI-402-GUARD).
// 이미 받아 둔 소리(serverAudioCache)는 그대로 재생한다. 다른 실패(일시 502 등)는 기억하지 않는다(지금처럼 다음 탭에 다시 시도).
export const SERVER_TTS_SKIP_MS = 10 * 60 * 1000;
const SERVER_TTS_SKIP_KEY = 'tts_server_skip_until';
let serverSkipUntil = 0;
export function serverTtsSkipped(now = Date.now()) {
  if (serverSkipUntil > now) return true;
  try {
    const saved = Number(window.sessionStorage?.getItem(SERVER_TTS_SKIP_KEY));
    if (saved > now) { serverSkipUntil = saved; return true; }
  } catch { /* 저장소 없음 — 메모리 값만 */ }
  return false;
}
function rememberServerTtsFailure(now = Date.now()) {
  serverSkipUntil = now + SERVER_TTS_SKIP_MS;
  try { window.sessionStorage?.setItem(SERVER_TTS_SKIP_KEY, String(serverSkipUntil)); } catch { /* 메모리 값만 */ }
}

async function playServerTTS(text, language, playbackRate = 1, generation) {
  const url = `/api/tts?lang=${encodeURIComponent(language)}&text=${encodeURIComponent(text)}`;
  let objUrl = serverAudioCache.get(url);
  if (!objUrl) {
    if (serverTtsSkipped()) throw new Error('tts skipped: service config');
    const res = await window.fetch(url);
    if (!res.ok) {
      const body = typeof res.json === 'function' ? await res.json().catch(() => null) : null;
      if (body?.code === 'service_config') rememberServerTtsFailure();
      throw new Error('tts ' + res.status);
    }
    const blob = await res.blob();
    objUrl = window.URL.createObjectURL(blob);
    serverAudioCache.set(url, objUrl);
  }
  if (generation !== audioGeneration) return;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  const audio = new window.Audio(objUrl);
  // 말하기 속도(오너 확정 2026-08-27) — 캐시는 원음 그대로 두고 재생만 배속한다.
  // preservesPitch 기본값이 true지만 구형 엔진 방어로 명시(실패 무해).
  try { audio.preservesPitch = true; } catch { /* 미지원 엔진 — 배속만 적용 */ }
  audio.playbackRate = playbackRate;
  currentAudio = audio;
  await audio.play();
}

/**
 * 다음 카드 소리 미리 받기(REV-SCOPE-R1B-1 §3-3) — 서버 음성을 재생 캐시에 넣기만 한다. 실패는 조용히(재생할 때 다시 시도).
 * 같은 주소는 한 번만 받는다.
 */
const prefetching = new Map();
export function prefetchSpeech(text, language) {
  if (typeof window === 'undefined' || !text || !getTtsCapabilities().serverAudio || serverTtsSkipped()) return;
  const url = `/api/tts?lang=${encodeURIComponent(language)}&text=${encodeURIComponent(text)}`;
  if (serverAudioCache.has(url) || prefetching.has(url)) return;
  const request = window.fetch(url).then(res => (res.ok ? res.blob() : null)).then(blob => {
    if (blob && !serverAudioCache.has(url)) serverAudioCache.set(url, window.URL.createObjectURL(blob));
  }).catch(() => {}).finally(() => prefetching.delete(url));
  prefetching.set(url, request);
}

/** 세션 시작 단추를 누를 때 오디오를 한 번 열어 둔다(iOS 자동 재생 제한). 소리는 나지 않는다. */
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
export function unlockSpeechAudio() {
  if (typeof window === 'undefined' || typeof window.Audio !== 'function') return;
  try {
    const audio = new window.Audio(SILENT_WAV);
    audio.muted = true;
    audio.play()?.catch?.(() => {});
  } catch { /* 열 수 없으면 카드의 ▷로 재생한다 */ }
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

  const listVoices = useCallback((lang = 'Japanese') => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return [];
    const all = window.speechSynthesis.getVoices();
    const code = readerSpeechTag(lang);
    const prefix = code.split('-')[0];
    return all.filter(v => v.lang === code || v.lang.startsWith(prefix + '-'));
  }, []);

  const getSelectedVoice = useCallback((lang = 'Japanese') => {
    return viewerLanguageInfo(lang)?.code === 'ko' ? loadStoredVoice('ko') : loadStoredVoice(voicePrefixForLanguage(lang));
  }, []);

  const setSelectedVoice = useCallback((lang, voiceURI) => {
    saveStoredVoice(readerVoiceKey(lang), voiceURI || null);
  }, []);

  // 같은 사용자 제스처 안에서 재생한다. 즉시 경로는 해당 언어 음성이 있을 때만 사용한다.
  const speakFallback = useCallback((text, language = 'Japanese', opts = {}, voice, onError) => {
    if (!getTtsCapabilities().webSpeech) return false;
    window.speechSynthesis.cancel();
    const utter = new window.SpeechSynthesisUtterance(text);
    utter.lang = bcp47ForLanguage(language);
    // 기존 언어의 정본 기본값을 유지하고 새 뷰어 어댑터의 음성 태그를 적용한다.
    if (viewerLanguageInfo(language)) utter.lang = readerSpeechTag(language);
    utter.rate = opts.rate ?? 0.85;
    utter.pitch = opts.pitch ?? 1;
    const wantedURI = loadStoredVoice(readerVoiceKey(language));
    if (viewerLanguageInfo(language)?.code === 'ko') {
      voice = immediateSpeechVoice(window.speechSynthesis.getVoices(), language, wantedURI);
      if (!voice) return false;
    }
    if (voice) utter.voice = voice;
    else if (wantedURI) {
      const v = window.speechSynthesis.getVoices().find(x => x.voiceURI === wantedURI);
      if (v) utter.voice = v;
    }
    if (onError) utter.onerror = event => {
      if (!['canceled', 'interrupted'].includes(event.error)) onError();
    };
    try { window.speechSynthesis.speak(utter); return true; } catch { return false; }
  }, []);

  const speak = useCallback((text, language = 'Japanese', opts = {}) => {
    if (typeof window === 'undefined' || !text) return;
    // opts: { playbackRate } = 서버 음성 배속, { rate, pitch } = Web Speech 폴백 — readingSheet.ttsOptsFor가 한 벌로 만든다.
    const generation=++audioGeneration;
    if(currentAudio)currentAudio.pause();
    window.speechSynthesis?.cancel();
    if (opts.preferBrowser && getTtsCapabilities().webSpeech) {
      const voice = immediateSpeechVoice(window.speechSynthesis.getVoices(), language,
        loadStoredVoice(readerVoiceKey(language)));
      const retryServer = () => {
        if (generation !== audioGeneration) return;
        playServerTTS(text, language, opts.playbackRate ?? 1, generation).catch(() => {});
      };
      if (voice && speakFallback(text, language, opts, voice, retryServer)) return;
    }
    playServerTTS(text, language, opts.playbackRate ?? 1, generation).catch(() => {if(generation===audioGeneration)speakFallback(text, language, opts);});
  }, [speakFallback]);

  const stop = useCallback(() => {
    audioGeneration += 1;
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
  }, []);

  // 서버 음성 또는 Web Speech 중 실제 재생 경로가 있는 브라우저에서만 노출한다.
  // 서버 음성을 이미 재생할 수 있는 환경은 Web Speech 부재만으로 차단하지 않는다.
  const supported = getTtsCapabilities().supported;

  return { speak, stop, supported, listVoices, getSelectedVoice, setSelectedVoice, voicesReady };
}
