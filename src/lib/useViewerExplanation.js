'use client';
import { useEffect, useRef, useState } from 'react';
import { callGemini } from './gemini';
import { viewerCacheKey } from './viewerReliability';
import { buildViewerWordPrompt, parseViewerExplanation, KOREAN_WORD_EXPLANATION_VERSION } from './viewerExplanation';

// Edited meanings can retain a different locale from their original morphology.
// Missing morphology provenance alone uses the existing meaning/source fallback.
export function storedViewerMorphology(token, locale, sourceLocale = 'ko') {
  const morphologyLocale = token?.explanationLocale || token?.meaningLocale || sourceLocale;
  return morphologyLocale === locale ? token?.morphology || [] : [];
}

// Localized help is a display overlay. Never replace the manuscript or a saved card's meaning.
export function useViewerExplanation({ token, sentence, locale, sourceLocale = 'ko', scope, enabled }) {
  const [state, setState] = useState({ key: '', meaning: '', morphology: [], loading: false, error: false });
  const [retry, setRetry] = useState(0);
  const key = JSON.stringify([scope, token?.id, token?.text, token?.base_form, sentence, locale, sourceLocale]);
  const latest = useRef(key); latest.current = key;
  useEffect(() => {
    // 직렬화한 요청 스냅샷을 사용해 UI 재렌더와 토큰 객체 재생성은 요청을 다시 시작하지 않는다.
    const [scope, , surface, lemma, sentence, locale, sourceLocale] = JSON.parse(key);
    if (!enabled || !surface || locale === sourceLocale) return;
    const controller = new AbortController();
    const current = () => !controller.signal.aborted && latest.current === key;
    setState({ key, meaning: '', morphology: [], loading: true, error: false });
    let deadline;
    (async () => {
      const cacheKey = await viewerCacheKey('viewer_word_locale', [scope, locale, KOREAN_WORD_EXPLANATION_VERSION], [surface, lemma, sentence]);
      if (!current()) return;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const result = parseViewerExplanation(cached, 'word');
          if (current()) setState({ ...result, key, loading: false, error: false });
          return;
        }
      } catch { /* A damaged display cache is regenerated. */ }
      deadline = setTimeout(() => {
        if (current()) setState({ key, meaning: '', morphology: [], loading: false, error: true });
        controller.abort();
      }, 30000);
      const raw = await callGemini(buildViewerWordPrompt({ surface, lemma, sentence, locale }), controller.signal);
      const result = parseViewerExplanation(raw, 'word');
      if (!current()) return;
      setState({ ...result, key, loading: false, error: false });
      try { localStorage.setItem(cacheKey, JSON.stringify(result)); } catch { /* Reading works without storage. */ }
    })().catch(() => {
      if (current()) setState({ key, meaning: '', morphology: [], loading: false, error: true });
    }).finally(() => clearTimeout(deadline));
    return () => { controller.abort(); clearTimeout(deadline); };
  }, [key, enabled, retry]);
  const overlay = enabled && !!token?.text && locale !== sourceLocale;
  return {
    meaning: overlay ? (state.key === key ? state.meaning : '') : token?.meaning || '',
    morphology: overlay ? (state.key === key ? state.morphology || [] : []) : storedViewerMorphology(token, locale, sourceLocale),
    loading: overlay && (state.key !== key || state.loading),
    error: overlay && state.key === key && state.error,
    retry: () => setRetry(value => value + 1),
  };
}
