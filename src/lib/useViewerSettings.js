import { useState } from 'react';

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
  const [theme, setThemeRaw] = useState(() => readPref('theme', 'dark'));
  const [fontFamily, setFontFamilyRaw] = useState(() => readPref('fontFamily', "'Noto Sans KR'"));
  const [showFurigana, setShowFuriganaRaw] = useState(() => readPref('showFurigana', true));
  const [autoSpeakOnClick, setAutoSpeakOnClickRaw] = useState(() => readPref('autoSpeakOnClick', false));
  // 한자 대조(중국어) — 한국 한자음 앵커 표시. 옵트인이 전제(오너 확정): 기본 꺼짐.
  const [showHanjaKo, setShowHanjaKoRaw] = useState(() => readPref('showHanjaKo', false));
  // 성조 색상(중국어) — 병음에만 성조별 색(오너 확정 2026-08-19). 옵트인: 기본 꺼짐.
  const [showToneColors, setShowToneColorsRaw] = useState(() => readPref('showToneColors', false));
  // 집중 모드 — 지정 문장만 원래 밝기, 나머지는 어둡게(오너 승인 2026-08-19). 옵트인: 기본 꺼짐.
  const [focusMode, setFocusModeRaw] = useState(() => readPref('focusMode', false));
  const [settingsOpen, setSettingsOpen] = useState(false);

  const setFontSize = (v) => { const val = typeof v === 'function' ? v(fontSize) : v; setFontSizeRaw(val); savePref('fontSize', val); };
  const setLineGap = (v) => { const val = typeof v === 'function' ? v(lineGap) : v; setLineGapRaw(val); savePref('lineGap', val); };
  const setCharGap = (v) => { const val = typeof v === 'function' ? v(charGap) : v; setCharGapRaw(val); savePref('charGap', val); };
  const setTheme = (v) => { setThemeRaw(v); savePref('theme', v); };
  const setFontFamily = (v) => { setFontFamilyRaw(v); savePref('fontFamily', v); };
  const setShowFurigana = (v) => { const val = typeof v === 'function' ? v(showFurigana) : v; setShowFuriganaRaw(val); savePref('showFurigana', val); };
  const setAutoSpeakOnClick = (v) => { const val = typeof v === 'function' ? v(autoSpeakOnClick) : v; setAutoSpeakOnClickRaw(val); savePref('autoSpeakOnClick', val); };
  const setFocusMode = (v) => { const val = typeof v === 'function' ? v(focusMode) : v; setFocusModeRaw(val); savePref('focusMode', val); };
  const setShowToneColors = (v) => { const val = typeof v === 'function' ? v(showToneColors) : v; setShowToneColorsRaw(val); savePref('showToneColors', val); };
  const setShowHanjaKo = (v) => { const val = typeof v === 'function' ? v(showHanjaKo) : v; setShowHanjaKoRaw(val); savePref('showHanjaKo', val); };

  return {
    fontSize, setFontSize,
    lineGap, setLineGap,
    charGap, setCharGap,
    theme, setTheme,
    fontFamily, setFontFamily,
    showFurigana, setShowFurigana,
    autoSpeakOnClick, setAutoSpeakOnClick,
    showHanjaKo, setShowHanjaKo,
    showToneColors, setShowToneColors,
    focusMode, setFocusMode,
    settingsOpen, setSettingsOpen,
  };
}
