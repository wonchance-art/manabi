'use client';
// [자세히] 인라인 문법 해설 훅 — 기존 모달(useGrammarAnalysis)의 대체.
// 모달·체크박스·selection 팝업을 걷어내고, 시트 좌측에서 펼치는 단일 경로만 남긴다.
// 결과는 문장 단위 localStorage 캐시(좌측 번역과 동일 관례) — 두 번째 열람은 무료·즉시.

import { useCallback, useState } from 'react';
import { callGemini, GEMINI_TIER } from './gemini';
import {
  buildGrammarPrompt, formatChapterCandidates, grammarCacheKey, parseGrammarResult,
} from './grammarDetail';

/** 레퍼런스 문법 챕터 후보 — 매니페스트는 무거우므로 [자세히]를 처음 누를 때만 지연 로드. */
async function loadChapterCandidates(language) {
  try {
    const { REF_GRAMMAR_MANIFEST } = await import('../content/refGrammarManifest');
    const lang = REF_GRAMMAR_MANIFEST?.languages?.[language];
    if (!lang?.levels) return [];
    const base = lang.base || '';
    return Object.values(lang.levels)
      .flatMap((lv) => lv?.chapters || [])
      .map((ch) => ({ ...ch, href: `${base}/grammar/${ch.slug}` }));
  } catch {
    return []; // 챕터 링크는 부가 기능 — 실패해도 해설은 나온다
  }
}

export function useGrammarDetail({ materialLang, toast }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [chapter, setChapter] = useState(null); // {slug, title, level}
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);

  /** 지정 문장이 바뀌면 이전 해설을 닫고 비운다(다른 문장 결과가 남지 않게). */
  const reset = useCallback(() => {
    setOpen(false); setResult(''); setChapter(null); setQuestion('');
  }, []);

  const run = useCallback(async (text) => {
    if (!text) return;
    setOpen(true);
    const key = grammarCacheKey(materialLang, text);
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        const saved = JSON.parse(cached);
        setResult(saved.body || '');
        setChapter(saved.chapter || null);
        return;
      }
    } catch { /* 캐시 손상은 무시하고 새로 조회 */ }

    setLoading(true);
    setResult('');
    setChapter(null);
    try {
      const chapters = await loadChapterCandidates(materialLang);
      const byslug = new Map(chapters.map((ch) => [ch.slug, ch]));
      const raw = await callGemini(
        buildGrammarPrompt(text, materialLang, formatChapterCandidates(chapters)),
        null,
        { tier: GEMINI_TIER },
      );
      const { body, chapterSlug } = parseGrammarResult(raw, new Set(byslug.keys()));
      const hit = chapterSlug ? byslug.get(chapterSlug) : null;
      const picked = hit ? { slug: hit.slug, title: hit.title, level: hit.level, href: hit.href } : null;
      setResult(body);
      setChapter(picked);
      try { localStorage.setItem(key, JSON.stringify({ body, chapter: picked })); } catch { /* 용량 초과 무시 */ }
    } catch (err) {
      setResult('');
      toast?.('문법 해설에 실패했어요 — ' + (err?.message || ''), 'error');
    } finally {
      setLoading(false);
    }
  }, [materialLang, toast]);

  /** 꼬리 질문 — 기존 해설을 맥락으로 이어 붙인다(앱 유일의 대화형 학습 경로). */
  const ask = useCallback(async (text) => {
    const q = question.trim();
    if (!q || asking || loading) return;
    setAsking(true);
    try {
      const answer = await callGemini(
        `원문: 「${text}」\n기존 해설:\n${result}\n\n추가 질문: ${q}\n\n위 맥락에서 한국어로 간결하게 답해주세요.`,
        null,
        { tier: GEMINI_TIER },
      );
      setResult((prev) => `${prev}\n\n**Q. ${q}**\n${answer}`);
      setQuestion('');
    } catch {
      toast?.('질문 처리에 실패했어요.', 'error');
    } finally {
      setAsking(false);
    }
  }, [question, asking, loading, result, toast]);

  return { open, loading, result, chapter, question, setQuestion, asking, run, ask, reset };
}
