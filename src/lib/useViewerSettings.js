import { useEffect, useRef, useState } from 'react';
import { readViewerPreferences, writeViewerPreferences, validateViewerPreferences, viewerDefaults, TAB_KEYS } from './viewerPreferences';
const browserStorage = () => { try { return window.localStorage; } catch { return null; } };
export function useViewerSettings(language = 'Japanese') {
  const [state, setState] = useState(() => ({language, values:readViewerPreferences(browserStorage(),language)}));
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
  return {...values, ...setters, storageError, settingsOpen, setSettingsOpen,
    snapshot:() => ({...current.current.values}), restore:update,
    resetTab:tab => {const defaults=viewerDefaults(language);update(Object.fromEntries(TAB_KEYS[tab].map(k=>[k,defaults[k]])));},
  };
}
