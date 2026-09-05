'use client';
// [더 쉽게] 인라인 훅 (#1077-3) — [자세히](useGrammarDetail)와 같은 결의 온디맨드 1회 조회.
// 결과는 문장 단위 localStorage 캐시(viewer_tx·viewer_gr과 동일 관례) — 두 번째 열람은 무료·즉시.
// 서버 변경 0 — 기존 callGemini(/api/gemini) 재사용.

import { useCallback, useState } from 'react';
import { callGemini, GEMINI_TIER } from './gemini';
import { buildEasierPrompt, easierCacheKey } from './grammarDetail';
import { langNameKo } from './constants';

export function useEasierText({ materialLang, toast }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  /** 지정 문장이 바뀌면 닫고 비운다 — 다른 문장의 쉬운 말이 남지 않게(grammar.reset과 같은 자리). */
  const reset = useCallback(() => {
    setOpen(false); setResult('');
  }, []);

  const run = useCallback(async (text) => {
    if (!text) return;
    setOpen(true);
    const key = easierCacheKey(materialLang, text);
    try {
      const cached = localStorage.getItem(key);
      if (cached) { setResult(cached); return; }
    } catch { /* 캐시 손상은 무시하고 새로 조회 */ }

    setLoading(true);
    setResult('');
    try {
      const raw = await callGemini(buildEasierPrompt(text, langNameKo(materialLang)), null, { tier: GEMINI_TIER });
      const body = typeof raw === 'string' ? raw.trim() : '';
      if (!body) throw new Error('빈 응답');
      setResult(body);
      try { localStorage.setItem(key, body); } catch { /* 용량 초과 무시 */ }
    } catch (err) {
      setOpen(false); // 버튼으로 되돌려 재시도 가능하게 — 빈 패널을 남기지 않는다
      toast?.('쉬운 문장 생성에 실패했어요 — ' + (err?.message || ''), 'error');
    } finally {
      setLoading(false);
    }
  }, [materialLang, toast]);

  return { open, loading, result, run, reset };
}
