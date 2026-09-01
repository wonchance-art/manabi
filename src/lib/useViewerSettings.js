import { useState } from 'react';
import { PATTERN_FILTERS } from './patternIndex';

function readPref(key, fallback) {
  try { const v = localStorage.getItem('viewer_' + key); return v !== null ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function savePref(key, value) {
  try { localStorage.setItem('viewer_' + key, JSON.stringify(value)); } catch {}
}

export function useViewerSettings() {
  const [fontSize, setFontSizeRaw] = useState(() => readPref('fontSize', 1.6));
  const [lineGap, setLineGapRaw] = useState(() => readPref('lineGap', 15));
  const [charGap, setCharGapRaw] = useState(() => readPref('charGap', 0.25));
  // 배경 3색: 'light' | 'sepia' | 'dark' (세피아는 읽기 설정 리뉴얼 신설 — 오너 확정 2026-08-27)
  const [theme, setThemeRaw] = useState(() => readPref('theme', 'dark'));
  const [fontFamily, setFontFamilyRaw] = useState(() => readPref('fontFamily', "'Noto Sans KR'"));
  // 발음 표기 3단: 'all' | 'unknown' | 'none' (오너 확정 2026-08-27 — 구 후리가나 토글의 후신).
  // 이관: 구 showFurigana 불리언의 꺼짐 선택을 none으로 승계한다(켜짐·미설정 = all).
  const [pronDisplay, setPronDisplayRaw] = useState(() => {
    const v = readPref('pronDisplay', null);
    if (v === 'all' || v === 'unknown' || v === 'none') return v;
    return readPref('showFurigana', true) ? 'all' : 'none';
  });
  // 탭하면 발음 보기(v1-4 R1) — pronDisplay의 **종속** 스위치. 가려진 단어의 첫 탭이
  // 카드가 아니라 발음 공개가 된다(인출 연습). 기존 탭 의미를 바꾸므로 옵트인: 기본 꺼짐.
  // pronDisplay가 'all'이면 가릴 게 없어 이 값은 효력이 없다(readingSheet가 정본).
  const [pronReveal, setPronRevealRaw] = useState(() => readPref('pronReveal', false));
  const [autoSpeakOnClick, setAutoSpeakOnClickRaw] = useState(() => readPref('autoSpeakOnClick', false));
  // 말하기 속도: 'slow' | 'normal' | 'fast' — 값 매핑은 readingSheet.js(TTS_RATES)가 정본.
  const [ttsRate, setTtsRateRaw] = useState(() => readPref('ttsRate', 'normal'));
  // 한자 대조(중국어) — 한국 한자음 앵커 표시. 옵트인이 전제(오너 확정): 기본 꺼짐.
  const [showHanjaKo, setShowHanjaKoRaw] = useState(() => readPref('showHanjaKo', false));
  // 성조 색상(중국어) — 병음에만 성조별 색(오너 확정 2026-08-19). 옵트인: 기본 꺼짐.
  const [showToneColors, setShowToneColorsRaw] = useState(() => readPref('showToneColors', false));
  // 집중 모드 — 지정 문장만 원래 밝기, 나머지는 어둡게(오너 승인 2026-08-19). 옵트인: 기본 꺼짐.
  const [focusMode, setFocusModeRaw] = useState(() => readPref('focusMode', false));
  // 단어 상태 하이라이트(링큐식 B안 — 배경색, 오너 확정 2026-08-27). 옵트인: 기본 꺼짐.
  const [wordStateHl, setWordStateHlRaw] = useState(() => readPref('wordStateHl', false));
  // 문법 표시(v2-G R1) — 정본 문형의 표지어에 옅은 밑줄. 1단 스캔이라 오탐이 있고,
  // 정본 로드도 따라오므로 옵트인이 전제(설계 §3·§5): 기본 꺼짐.
  const [showPatterns, setShowPatternsRaw] = useState(() => readPref('showPatterns', false));
  // 문법 표시 범위(v2-G R2) — 'all' | 'due'. 정본 문형 484개를 전부 후보로 잡으면
  // "만나기는 하는데 무엇부터 볼지"가 안 정해진다. 복습이 다가온 문법으로 좁힐 길을 둔다.
  const [patternFilter, setPatternFilterRaw] = useState(() => {
    const v = readPref('patternFilter', 'all');
    return PATTERN_FILTERS.includes(v) ? v : 'all';
  });
  // 자동 진행(v2-I R1b) — 지정 문장에 체류하다 다음으로. 집중 모드가 전제. 옵트인: 기본 꺼짐.
  const [autoPace, setAutoPaceRaw] = useState(() => readPref('autoPace', false));
  // 목표 속도(자/분). null = 아직 안 고름 → 언어별 기본값(readingPacer가 정본).
  const [paceCpm, setPaceCpmRaw] = useState(() => readPref('paceCpm', null));
  // 훈련 사다리 단계(v2-I R1b R3) — 목표에 1.05^step을 곱한다. 바탕값(실력)과 훈련
  // 강도를 분리해 두어야 무엇이 올라 목표가 올랐는지 알 수 있다.
  const [paceStep, setPaceStepRaw] = useState(() => readPref('paceStep', 0));
  const [settingsOpen, setSettingsOpen] = useState(false);

  const setFontSize = (v) => { const val = typeof v === 'function' ? v(fontSize) : v; setFontSizeRaw(val); savePref('fontSize', val); };
  const setLineGap = (v) => { const val = typeof v === 'function' ? v(lineGap) : v; setLineGapRaw(val); savePref('lineGap', val); };
  const setCharGap = (v) => { const val = typeof v === 'function' ? v(charGap) : v; setCharGapRaw(val); savePref('charGap', val); };
  const setTheme = (v) => { setThemeRaw(v); savePref('theme', v); };
  const setFontFamily = (v) => { setFontFamilyRaw(v); savePref('fontFamily', v); };
  const setPronDisplay = (v) => { setPronDisplayRaw(v); savePref('pronDisplay', v); };
  const setPronReveal = (v) => { const val = typeof v === 'function' ? v(pronReveal) : v; setPronRevealRaw(val); savePref('pronReveal', val); };
  const setTtsRate = (v) => { setTtsRateRaw(v); savePref('ttsRate', v); };
  const setAutoSpeakOnClick = (v) => { const val = typeof v === 'function' ? v(autoSpeakOnClick) : v; setAutoSpeakOnClickRaw(val); savePref('autoSpeakOnClick', val); };
  const setFocusMode = (v) => { const val = typeof v === 'function' ? v(focusMode) : v; setFocusModeRaw(val); savePref('focusMode', val); };
  const setShowToneColors = (v) => { const val = typeof v === 'function' ? v(showToneColors) : v; setShowToneColorsRaw(val); savePref('showToneColors', val); };
  const setWordStateHl = (v) => { const val = typeof v === 'function' ? v(wordStateHl) : v; setWordStateHlRaw(val); savePref('wordStateHl', val); };
  const setShowHanjaKo = (v) => { const val = typeof v === 'function' ? v(showHanjaKo) : v; setShowHanjaKoRaw(val); savePref('showHanjaKo', val); };
  const setShowPatterns = (v) => { const val = typeof v === 'function' ? v(showPatterns) : v; setShowPatternsRaw(val); savePref('showPatterns', val); };
  const setPatternFilter = (v) => { setPatternFilterRaw(v); savePref('patternFilter', v); };
  const setAutoPace = (v) => { const val = typeof v === 'function' ? v(autoPace) : v; setAutoPaceRaw(val); savePref('autoPace', val); };
  const setPaceCpm = (v) => { const val = typeof v === 'function' ? v(paceCpm) : v; setPaceCpmRaw(val); savePref('paceCpm', val); };
  const setPaceStep = (v) => { const val = typeof v === 'function' ? v(paceStep) : v; setPaceStepRaw(val); savePref('paceStep', val); };

  return {
    fontSize, setFontSize,
    lineGap, setLineGap,
    charGap, setCharGap,
    theme, setTheme,
    fontFamily, setFontFamily,
    pronDisplay, setPronDisplay,
    pronReveal, setPronReveal,
    autoSpeakOnClick, setAutoSpeakOnClick,
    ttsRate, setTtsRate,
    showHanjaKo, setShowHanjaKo,
    showToneColors, setShowToneColors,
    wordStateHl, setWordStateHl,
    showPatterns, setShowPatterns,
    patternFilter, setPatternFilter,
    focusMode, setFocusMode,
    autoPace, setAutoPace,
    paceCpm, setPaceCpm,
    paceStep, setPaceStep,
    settingsOpen, setSettingsOpen,
  };
}
