'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { VIEWER_LANGUAGE_PREF_KEY, normalizeViewerLocale, readViewerLanguagePreferences, writeViewerLanguagePreferences } from './viewerLanguage';

function readBrowserPreferences() {
  if (typeof window === 'undefined') return { values: readViewerLanguagePreferences(null), storageError: false };
  try { return { values: readViewerLanguagePreferences(window.localStorage), storageError: false }; }
  catch { return { values: readViewerLanguagePreferences(null), storageError: true }; }
}

export function useViewerLanguage() {
  // 서버/첫 hydration은 동일한 ko 기본값. effect에서 저장된 사용자 선택을 읽는다.
  const [state, setState] = useState(() => ({ values: readViewerLanguagePreferences(null), storageError: false }));
  const current = useRef(state.values);
  const pending = useRef({});

  useEffect(() => {
    const refresh = () => {
      const next = readBrowserPreferences();
      if (next.storageError) {
        setState(previous => ({ ...previous, storageError: true }));
        return;
      }
      current.current = next.values;
      pending.current = {};
      setState(next);
    };
    refresh();
    const onStorage = event => {
      if (event.key !== VIEWER_LANGUAGE_PREF_KEY && event.key !== null) return;
      try { if (event.storageArea && event.storageArea !== window.localStorage) return; }
      catch { setState(previous => ({ ...previous, storageError: true })); return; }
      refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = useCallback((key, value) => {
    const previous = current.current;
    const resolved = typeof value === 'function' ? value(previous[key]) : value;
    const next = { ...previous, [key]: normalizeViewerLocale(resolved, previous[key]) };
    current.current = next;
    pending.current[key] = next[key];
    setState({ values: next, storageError: false });
    try {
      // patch로 별도 설정의 다른 탭 변경과 아직 저장하지 못한 사용자 선택을 함께 보존한다.
      const persisted = writeViewerLanguagePreferences(window.localStorage, pending.current);
      current.current = persisted;
      pending.current = {};
      setState({ values: persisted, storageError: false });
    } catch { setState({ values: next, storageError: true }); }
  }, []);
  const setUiLocale = useCallback(value => update('uiLocale', value), [update]);
  const setExplanationLocale = useCallback(value => update('explanationLocale', value), [update]);
  return { ...state.values, setUiLocale, setExplanationLocale, storageError: state.storageError };
}
