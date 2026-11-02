import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { readViewerPreferences, writeViewerPreferences, validateViewerPreferences, viewerDefaults, TAB_KEYS } from './viewerPreferences';
const browserStorage = () => { try { return window.localStorage; } catch { return null; } };
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
// serverDefaults — 서버가 그린 본문(VIEWER-SSR-001)을 하이드레이션하는 첫 렌더는 서버와 같은 기본값으로 그리고, 저장값은 커밋 직후
// (레이아웃 효과)에 읽는다. 저장값이 기본과 다른 기기는 첫 그림 전 판정이 본문을 감춰 두었다가 뷰어가 뗀다(lib/viewerSsr) — 바뀌는 순간은 보이지 않는다.
// hydrated = 저장값을 읽었다(감춤을 뗄 때를 뷰어가 본다).
export function useViewerSettings(language = 'Japanese', { serverDefaults = false } = {}) {
  const [state, setState] = useState(() => ({language, values:readViewerPreferences(serverDefaults ? null : browserStorage(),language), pending:serverDefaults}));
  useIsoLayoutEffect(() => {
    if (state.pending) setState(prev => (prev.pending ? {language:prev.language, values:readViewerPreferences(browserStorage(),prev.language)} : prev));
  }, [state.pending]);
  const [storageError, setStorageError] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const values = state.language === language ? state.values : readViewerPreferences(browserStorage(),language);
  const current = useRef({language,values}); current.current = {language,values};
  useEffect(() => {
    if (state.language !== language) setState({language,values:readViewerPreferences(browserStorage(),language)});
  }, [language,state.language]);
  const update = patch => {
    const snapshot = current.current;
    const next = validateViewerPreferences({...snapshot.values, ...patch},snapshot.language);
    current.current = {language:snapshot.language,values:next};
    setState(current.current);
    try { writeViewerPreferences(browserStorage(),snapshot.language,next); setStorageError(false); }
    catch { setStorageError(true); }
  };
  const setters = Object.fromEntries(Object.keys(values).map(key => ['set'+key[0].toUpperCase()+key.slice(1), value => update({[key]:typeof value === 'function' ? value(current.current.values[key]) : value})]));
  return {...values, ...setters, storageError, settingsOpen, setSettingsOpen, hydrated:!state.pending,
    snapshot:() => ({...current.current.values}), restore:update,
    resetTab:tab => {const defaults=viewerDefaults(language);update(Object.fromEntries(TAB_KEYS[tab].map(k=>[k,defaults[k]])));},
  };
}
