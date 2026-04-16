'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { callGemini } from '../lib/gemini';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import PdfDocumentInner from '../components/PdfDocument';

async function fetchPdfInfo(pdfId) {
  const { data, error } = await supabase
    .from('uploaded_pdfs').select('*').eq('id', pdfId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('NOT_FOUND');
  return data;
}

async function getPdfUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from('user-pdfs').createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

async function quickAnalyze(text, language) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  let authHeader = {};
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) authHeader = { Authorization: `Bearer ${session.access_token}` };
  } catch {}
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({ lines, language }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const tokens = [];
  for (const r of data.results || []) {
    for (const tid of r.sequence) {
      const t = r.dictionary[tid];
      if (t?.text?.trim() && t.meaning) tokens.push(t);
    }
  }
  return tokens;
}

async function getContextExplanation(text, language) {
  const langName = language === 'Japanese' ? '일본어' : '영어';
  const prompt = `다음은 ${langName} 텍스트의 일부입니다. 한국어로 내용을 이해할 수 있도록 맥락을 설명해주세요.

"${text}"

규칙:
- 번역이 아닌 맥락적 이해를 돕는 설명
- 핵심 내용 요약 + 배경지식이 필요하면 간략히
- 3~5문장, 자연스러운 한국어
- 마크다운/코드펜스 금지, 평문만`;

  try {
    const raw = await callGemini(prompt);
    return raw?.candidates?.[0]?.content?.parts?.[0]?.text || raw;
  } catch {
    return null;
  }
}

export default function PdfViewerPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();

  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [language, setLanguage] = useState('Japanese');

  const [selectedText, setSelectedText] = useState('');
  const [tokens, setTokens] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState({});

  // 사용자 기존 단어장 캐시 — 이미 저장된 단어 즉시 표시
  const { data: savedVocab } = useQuery({
    queryKey: ['pdf-saved-vocab', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_vocabulary')
        .select('word_text, base_form, meaning, pos, furigana')
        .eq('user_id', user.id);
      const map = new Map();
      for (const v of (data || [])) {
        if (v.word_text) map.set(v.word_text, v);
        if (v.base_form) map.set(v.base_form, v);
      }
      return map;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  // 영구 캐시 (localStorage) — 같은 텍스트 재분석 방지
  const isClient = typeof window !== 'undefined';
  function getCached(key) {
    if (!isClient) return null;
    try { return JSON.parse(localStorage.getItem(`pdf_cache:${key}`)); } catch { return null; }
  }
  function setCached(key, value) {
    if (!isClient) return;
    try { localStorage.setItem(`pdf_cache:${key}`, JSON.stringify(value)); } catch {}
  }

  function markKnown(tokens) {
    const dismissed = (() => { try { return new Set(JSON.parse(localStorage.getItem('pdf_dismissed') || '[]')); } catch { return new Set(); } })();
    return tokens.map(t => ({
      ...t,
      _alreadySaved: savedVocab?.has(t.text) || savedVocab?.has(t.base_form)
        || dismissed.has(t.text) || dismissed.has(t.base_form || t.text),
    }));
  }

  const [contextExpl, setContextExpl] = useState('');
  const [contextLoading, setContextLoading] = useState(false);
  const [hideKnown, setHideKnown] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('pdf_hideKnown') !== 'false';
  });

  const { data: pdfInfo, isLoading, error } = useQuery({
    queryKey: ['pdf-info', id],
    queryFn: () => fetchPdfInfo(id),
    enabled: !!id,
  });

  const { data: pdfUrl } = useQuery({
    queryKey: ['pdf-url', pdfInfo?.storage_path],
    queryFn: () => getPdfUrl(pdfInfo.storage_path),
    enabled: !!pdfInfo?.storage_path,
    staleTime: 1000 * 60 * 30,
  });

  // 드래그 선택 수신 → 단어 분석 + 맥락 설명 동시 실행
  useEffect(() => {
    const handler = async (e) => {
      const text = e.detail;
      if (!text) return;
      setSelectedText(text);
      const cacheKey = `${language}:${text.slice(0, 120)}`;

      // 1. 단어 분석 — 캐시 확인
      const cachedTokens = getCached(`tokens:${cacheKey}`);
      const cachedContext = getCached(`context:${cacheKey}`);

      if (cachedTokens) {
        setTokens(markKnown(cachedTokens));
        setAnalyzing(false);
      } else {
        setTokens([]);
        setAnalyzing(true);
      }

      if (cachedContext) {
        setContextExpl(cachedContext);
        setContextLoading(false);
      } else {
        setContextExpl('');
        setContextLoading(true);
      }

      // 2. 캐시 미스만 API 호출 (병렬)
      const promises = [];

      if (!cachedTokens) {
        promises.push(
          quickAnalyze(text, language).then(result => {
            setCached(`tokens:${cacheKey}`, result);
            setTokens(markKnown(result));
            setAnalyzing(false);
          })
        );
      }

      if (!cachedContext) {
        promises.push(
          getContextExplanation(text, language).then(r => {
            const expl = r || '설명을 생성할 수 없었어요.';
            setCached(`context:${cacheKey}`, expl);
            setContextExpl(expl);
            setContextLoading(false);
          })
        );
      }

      await Promise.allSettled(promises);
    };
    window.addEventListener('pdf-text-select', handler);
    return () => window.removeEventListener('pdf-text-select', handler);
  }, [language]);

  async function handleDismissWord(token) {
    const key = token.base_form || token.text;
    // localStorage에 "아는 단어" 등록
    try {
      const dismissed = JSON.parse(localStorage.getItem('pdf_dismissed') || '[]');
      if (!dismissed.includes(key)) {
        dismissed.push(key);
        localStorage.setItem('pdf_dismissed', JSON.stringify(dismissed));
      }
    } catch {}
    // 목록 즉시 갱신
    setTokens(prev => markKnown(prev));
    toast(`"${token.text}" — 아는 단어로 등록`, 'info');
  }

  async function handleSaveWord(token) {
    if (!user) { toast('로그인이 필요합니다.', 'warning'); return; }
    const key = token.base_form || token.text;
    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      const { error } = await supabase.from('user_vocabulary').upsert({
        user_id: user.id,
        word_text: token.text,
        base_form: token.base_form || token.text,
        meaning: token.meaning || '',
        pos: token.pos || '',
        furigana: token.furigana || '',
        language,
        source_sentence: selectedText.slice(0, 200),
      }, { onConflict: 'user_id,word_text' });
      if (error) throw error;
      setSaving(prev => ({ ...prev, [key]: 'done' }));
      toast(`⭐ "${token.text}" 저장!`, 'success');
    } catch (e) {
      toast('저장 실패: ' + e.message, 'error');
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  }

  if (isLoading) return <div className="page-container"><Spinner message="PDF 로딩 중..." /></div>;
  if (error) return (
    <div className="page-container" style={{ textAlign: 'center', paddingTop: 80 }}>
      <div style={{ fontSize: '3rem', marginBottom: 12 }}>📄</div>
      <h2>PDF를 찾을 수 없어요</h2>
      <Link href="/materials" className="btn btn--primary">자료실로</Link>
    </div>
  );

  const hasResults = tokens.length > 0 || analyzing || contextLoading || contextExpl;

  return (
    <div className="pdf-page">
      <div className="pdf-toolbar" style={{ padding: '10px 16px' }}>
        <Link href="/materials" className="pdf-toolbar__back">← 자료실</Link>
        <h1 className="pdf-toolbar__title">{pdfInfo?.title || 'PDF'}</h1>
        <div className="pdf-toolbar__controls">
          <select value={language} onChange={e => setLanguage(e.target.value)}
            style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
            <option value="Japanese">🇯🇵 일본어</option>
            <option value="English">🇬🇧 영어</option>
          </select>
          <button className="btn btn--ghost btn--sm" onClick={() => setScale(s => Math.max(0.5, s - 0.2))}>−</button>
          <span style={{ fontSize: '0.8rem', minWidth: 40, textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
          <button className="btn btn--ghost btn--sm" onClick={() => setScale(s => Math.min(3, s + 0.2))}>+</button>
        </div>
      </div>

      <div className="pdf-layout">

        {/* 왼쪽 — 맥락 설명 */}
        <aside className={`pdf-side pdf-side--left ${hasResults ? 'pdf-side--active' : ''}`}>
          {hasResults ? (
            <div className="pdf-context">
              <div className="pdf-context__title">💡 맥락 설명</div>

              {selectedText && (
                <div className="pdf-context__original">
                  "{selectedText.length > 120 ? selectedText.slice(0, 120) + '…' : selectedText}"
                </div>
              )}

              {contextLoading ? (
                <div className="pdf-context__loading">⏳ AI가 설명을 생성하고 있어요...</div>
              ) : contextExpl ? (
                <div className="pdf-context__text">{contextExpl}</div>
              ) : null}
            </div>
          ) : (
            <div className="pdf-side__empty">
              <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>💡</div>
              텍스트를 드래그하면<br />맥락 설명이 여기에
            </div>
          )}
        </aside>

        {/* 중앙 — PDF */}
        <main className="pdf-main">
          {numPages && (
            <div className="pdf-nav">
              <button className="btn btn--ghost btn--sm" disabled={currentPage <= 1} onClick={() => { setCurrentPage(p => p - 1); setTokens([]); setSelectedText(''); setContextExpl(''); }}>◀</button>
              <span style={{ fontSize: '0.85rem' }}>{currentPage} / {numPages}</span>
              <button className="btn btn--ghost btn--sm" disabled={currentPage >= numPages} onClick={() => { setCurrentPage(p => p + 1); setTokens([]); setSelectedText(''); setContextExpl(''); }}>▶</button>
            </div>
          )}
          <div className="pdf-container">
            {pdfUrl ? (
              <PdfDocumentInner fileUrl={pdfUrl} pageNumber={currentPage} scale={scale} onLoadSuccess={setNumPages} />
            ) : (
              <Spinner message="로딩 중..." />
            )}
          </div>
          {!hasResults && (
            <div style={{ textAlign: 'center', padding: '12px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              💡 PDF 위에서 텍스트를 드래그하세요
            </div>
          )}
        </main>

        {/* 오른쪽 — 단어 리스트 */}
        <aside className={`pdf-side pdf-side--right ${hasResults ? 'pdf-side--active' : ''}`}>
          {tokens.length > 0 ? (
            <div className="pdf-word-list">
              <div className="pdf-word-list__header">
                <span className="pdf-word-list__title">단어 ({hideKnown ? tokens.filter(t => !t._alreadySaved).length : tokens.length})</span>
                <button
                  className="pdf-word-list__toggle"
                  onClick={() => { const v = !hideKnown; setHideKnown(v); localStorage.setItem('pdf_hideKnown', String(v)); }}
                >
                  {hideKnown ? '전체 보기' : '아는 단어 숨기기'}
                </button>
              </div>
              {tokens.filter(t => !hideKnown || !t._alreadySaved).map((t, i) => {
                const key = t.base_form || t.text;
                const justSaved = saving[key] === 'done';
                const alreadySaved = t._alreadySaved || justSaved;
                return (
                  <div key={i} className={`pdf-word-item ${alreadySaved ? 'pdf-word-item--saved' : ''}`}>
                    <span className="pdf-word-item__text">{t.text}</span>
                    <span className="pdf-word-item__meaning">{t.meaning}</span>
                    {user && (
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button
                          className="pdf-word-item__save"
                          disabled={alreadySaved || !!saving[key]}
                          onClick={() => handleSaveWord(t)}
                          title="단어장에 저장"
                        >
                          {alreadySaved ? '✓' : saving[key] ? '…' : '⭐'}
                        </button>
                        <button
                          className="pdf-word-item__save pdf-word-item__dismiss"
                          onClick={() => handleDismissWord(t)}
                          title="이미 아는 단어 — 다시 표시 안 함"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : analyzing ? (
            <div className="pdf-side__empty">⏳ 분석 중...</div>
          ) : (
            <div className="pdf-side__empty">
              <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>📝</div>
              단어 목록이<br />여기에 표시됩니다
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
