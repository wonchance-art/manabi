'use client';
import { useEffect, useMemo, useState } from 'react';
import { LEARN_LANG_KEY, learnLanguages } from '@/lib/learnDashboard';

/**
 * 「지금 언어」 — 배움 · 현황이 같은 칩 값을 따른다. 고른 칩은 이 기기에만 기억한다(편의 설정이라
 * 저장 실패 · 사생활 창에서도 화면은 첫 학습 언어로 그대로 동작한다).
 */
export default function useLearnLanguage(profile, vocabCounts = null) {
  const raw = profile?.learning_language;
  const key = `${Array.isArray(raw) ? raw.join(',') : raw || ''}|${JSON.stringify(vocabCounts || {})}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- key가 학습 언어 목록 · 담은 표현 수의 값 동등성이다.
  const langs = useMemo(() => learnLanguages(profile, vocabCounts), [key]);
  const [picked, setPicked] = useState(null);
  useEffect(() => {
    try { setPicked(localStorage.getItem(LEARN_LANG_KEY)); } catch { /* 저장소 차단 — 첫 학습 언어 */ }
  }, []);
  const lang = langs.includes(picked) ? picked : langs[0];
  const choose = next => {
    setPicked(next);
    try { localStorage.setItem(LEARN_LANG_KEY, next); } catch { /* 저장소 차단 — 이번 화면에만 */ }
  };
  return { langs, lang, choose };
}
