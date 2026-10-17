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

const serverTtsUrl = (text, language) => `/api/tts?lang=${encodeURIComponent(language)}&text=${encodeURIComponent(text)}`;

// ── 소리를 끝내 내지 못했을 때(TTS-GAP-001, 2026-10-17 KST) ──
// 서버 음성 · 브라우저 음성이 모두 막히면 지금까지는 아무 소리 · 안내 없이 끝났다. 이유 하나를 구독자(providers의 안내)에게 알린다.
//   'no-voice' — 서버가 막혔고 이 기기에 그 언어로 낼 브라우저 음성이 없다(한국어 음성 없음 · Web Speech 없음).
//   'failed'   — 서버와 브라우저 음성이 둘 다 실패했다(브라우저 음성 우선 경로의 서버 재시도 실패 포함).
// 같은 이유는 SPEECH_NOTICE_GAP_MS 안에 한 번만 — 단어를 연달아 눌러도 안내가 쌓이지 않게. 취소 · 지난 탭의 실패는 알리지 않는다.
export const SPEECH_NOTICE_GAP_MS = 10 * 1000;
const speechUnavailableListeners = new Set();
const lastSpeechNotice = new Map();
export function onSpeechUnavailable(listener) {
  speechUnavailableListeners.add(listener);
  return () => speechUnavailableListeners.delete(listener);
}
export function notifySpeechUnavailable(reason, now = Date.now()) {
  if (now - (lastSpeechNotice.get(reason) ?? -Infinity) < SPEECH_NOTICE_GAP_MS) return false;
  lastSpeechNotice.set(reason, now);
  for (const listener of speechUnavailableListeners) {
    try { listener(reason); } catch { /* 안내 실패가 재생을 막지 않는다 */ }
  }
  return true;
}

/** 이 기기에서 그 언어를 브라우저 음성으로 낼 수 있는가 — speakFallback의 「낼 수 없음」 조건과 같다. */
function nativeSpeechAvailable(language) {
  if (!getTtsCapabilities().webSpeech) return false;
  if (viewerLanguageInfo(language)?.code !== 'ko') return true;
  return !!immediateSpeechVoice(window.speechSynthesis.getVoices(), language, loadStoredVoice(readerVoiceKey(language)));
}

// ── iOS: 서버 응답 뒤의 브라우저 음성이 탭 밖이라 막히는 문제(TTS-GAP-001 ③) ──
// iOS WebKit은 speechSynthesis.speak()가 사용자 동작 처리 중에 불릴 때만 소리를 낸다(RequireUserGestureForSpeechStart).
// 서버 음성이 실패한 뒤의 대체 발화는 fetch 뒤라 탭 밖이다. 탭 안에서 소리 없는 빈 발화를 한 번 보내 음성 엔진을 열어 둔다
// (선례: 첫 탭에 빈 SpeechSynthesisUtterance를 speak — 실기기 검증은 오너 몫). iOS · iPadOS에서만, 페이지당 한 번.
// 다른 브라우저는 서버 경로에서 브라우저 음성을 건드리지 않는 지금 계약 그대로다.
let speechPrimed = false;
export function needsSpeechGesturePrime(browser = typeof window === 'undefined' ? null : window) {
  const nav = browser?.navigator;
  if (!nav) return false;
  return /iP(hone|ad|od)/.test(String(nav.userAgent || '')) || (nav.platform === 'MacIntel' && Number(nav.maxTouchPoints) > 1);
}
export function primeSpeechSynthesis(browser = typeof window === 'undefined' ? null : window) {
  if (speechPrimed || !needsSpeechGesturePrime(browser) || !getTtsCapabilities(browser).webSpeech) return false;
  try {
    const synth = browser.speechSynthesis;
    synth.resume?.(); // 멈춤 상태로 남은 엔진(백그라운드 복귀 등)을 푼다 — 멈춰 있지 않으면 아무 일도 없다
    const utter = new browser.SpeechSynthesisUtterance('');
    utter.volume = 0;
    synth.speak(utter);
    speechPrimed = true;
    return true;
  } catch { return false; }
}

async function playServerTTS(text, language, playbackRate = 1, generation) {
  const url = serverTtsUrl(text, language);
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
  const url = serverTtsUrl(text, language);
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
        playServerTTS(text, language, opts.playbackRate ?? 1, generation)
          .catch(() => { if (generation === audioGeneration) notifySpeechUnavailable('failed'); });
      };
      if (voice && speakFallback(text, language, opts, voice, retryServer)) return;
    }
    // 서버 다음의 브라우저 음성 — 낼 수 없으면 이유를 알린다(무음 · 무안내로 끝내지 않는다).
    const fallbackNow = () => {
      const onNativeError = () => { if (generation === audioGeneration) notifySpeechUnavailable('failed'); };
      if (!speakFallback(text, language, opts, undefined, onNativeError)) {
        notifySpeechUnavailable(nativeSpeechAvailable(language) ? 'failed' : 'no-voice');
      }
    };
    // 서버가 「서비스 설정」으로 쉬는 중이면(받아 둔 소리도 없으면) 기다리지 않고 지금, 탭 안에서 브라우저 음성으로.
    if (!serverAudioCache.has(serverTtsUrl(text, language)) && serverTtsSkipped()) { fallbackNow(); return; }
    primeSpeechSynthesis();
    playServerTTS(text, language, opts.playbackRate ?? 1, generation).catch(() => { if (generation === audioGeneration) fallbackNow(); });
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
