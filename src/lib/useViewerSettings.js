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
  const [settingsOpen, setSettingsOpen] = useState(false);

  const setFontSize = (v) => { const val = typeof v === 'function' ? v(fontSize) : v; setFontSizeRaw(val); savePref('fontSize', val); };
  const setLineGap = (v) => { const val = typeof v === 'function' ? v(lineGap) : v; setLineGapRaw(val); savePref('lineGap', val); };
  const setCharGap = (v) => { const val = typeof v === 'function' ? v(charGap) : v; setCharGapRaw(val); savePref('charGap', val); };
  const setTheme = (v) => { setThemeRaw(v); savePref('theme', v); };
  const setFontFamily = (v) => { setFontFamilyRaw(v); savePref('fontFamily', v); };
  const setShowFurigana = (v) => { const val = typeof v === 'function' ? v(showFurigana) : v; setShowFuriganaRaw(val); savePref('showFurigana', val); };

  return {
    fontSize, setFontSize,
    lineGap, setLineGap,
    charGap, setCharGap,
    theme, setTheme,
    fontFamily, setFontFamily,
    showFurigana, setShowFurigana,
    settingsOpen, setSettingsOpen,
  };
}
