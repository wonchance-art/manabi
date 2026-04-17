'use client';

import { useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
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

async function analyzePageText(text, language) {
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
      if (t) tokens.push(t);
    }
    tokens.push({ text: '\n', pos: '개행' });
  }
  return tokens;
}

// splitRuby — ViewerPage와 동일
function splitRuby(text, furigana) {
  if (!furigana) return [{ plain: text }];
  const isKanji = ch => /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/.test(ch);
  const segments = [];
  let i = 0;
  while (i < text.length) {
    if (isKanji(text[i])) {
      let j = i; while (j < text.length && isKanji(text[j])) j++;
      segments.push({ type: 'kanji', text: text.slice(i, j) }); i = j;
    } else {
      let j = i; while (j < text.length && !isKanji(text[j])) j++;
      segments.push({ type: 'plain', text: text.slice(i, j) }); i = j;
    }
  }
  if (!segments.some(s => s.type === 'kanji')) return [{ plain: text }];
  const regexParts = segments.map(s =>
    s.type === 'kanji' ? '(.+?)' : s.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  const lastIdx = regexParts.lastIndexOf('(.+?)');
  if (lastIdx !== -1) regexParts[lastIdx] = '(.+)';
  try {
    const match = furigana.match(new RegExp('^' + regexParts.join('') + '$'));
    if (match) {
      let gi = 1;
      return segments.map(s => s.type === 'kanji' ? { kanji: s.text, reading: match[gi++] } : { plain: s.text });
    }
  } catch {}
  return segments.map(s => s.type === 'kanji' ? { kanji: s.text, reading: furigana } : { plain: s.text });
}

export default function PdfViewerPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();

  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [language, setLanguage] = useState('Japanese');

  const [tokens, setTokens] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);
  const [saving, setSaving] = useState({});
  const analysisCache = useRef({});

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

  // 사용자 단어장 — 이미 저장된 단어 표시
  const { data: savedVocab } = useQuery({
    queryKey: ['pdf-saved-vocab', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('user_vocabulary').select('word_text, base_form').eq('user_id', user.id);
      const set = new Set();
      for (const v of (data || [])) { if (v.word_text) set.add(v.word_text); if (v.base_form) set.add(v.base_form); }
      return set;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  // PDF 페이지 텍스트 수신 → 자동 분석
  const handlePageText = useCallback(async (text, pageNum) => {
    if (analysisCache.current[pageNum]) {
      setTokens(analysisCache.current[pageNum]);
      return;
    }
    if (!text?.trim()) { setTokens([]); return; }
    setAnalyzing(true);
    setTokens([]);
    setSelectedToken(null);
    const result = await analyzePageText(text, language);
    analysisCache.current[pageNum] = result;
    setTokens(result);
    setAnalyzing(false);
  }, [language]);

  // 언어 변경 시 캐시 초기화
  function changeLanguage(lang) {
    setLanguage(lang);
    analysisCache.current = {};
    setTokens([]);
    setSelectedToken(null);
  }

  function changePage(pg) {
    setCurrentPage(pg);
    setSelectedToken(null);
  }

  async function handleSaveWord(token) {
    if (!user) { toast('로그인이 필요합니다.', 'warning'); return; }
    const key = token.base_form || token.text;
    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      const { error } = await supabase.from('user_vocabulary').upsert({
        user_id: user.id, word_text: token.text, base_form: token.base_form || token.text,
        meaning: token.meaning || '', pos: token.pos || '', furigana: token.furigana || '', language,
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

  return (
    <div className="pdf-page">
      {/* 상단 바 */}
      <div className="pdf-toolbar" style={{ padding: '10px 16px' }}>
        <Link href="/materials" className="pdf-toolbar__back">← 자료실</Link>
        <h1 className="pdf-toolbar__title">{pdfInfo?.title || 'PDF'}</h1>
        <div className="pdf-toolbar__controls">
          <select value={language} onChange={e => changeLanguage(e.target.value)}
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
        {/* 왼쪽 — PDF 원본 */}
        <main className="pdf-main">
          {numPages && (
            <div className="pdf-nav">
              <button className="btn btn--ghost btn--sm" disabled={currentPage <= 1} onClick={() => changePage(currentPage - 1)}>◀</button>
              <span style={{ fontSize: '0.85rem' }}>{currentPage} / {numPages}</span>
              <button className="btn btn--ghost btn--sm" disabled={currentPage >= numPages} onClick={() => changePage(currentPage + 1)}>▶</button>
            </div>
          )}
          <div className="pdf-container">
            {pdfUrl ? (
              <PdfDocumentInner
                fileUrl={pdfUrl}
                pageNumber={currentPage}
                scale={scale}
                onLoadSuccess={setNumPages}
                onPageText={handlePageText}
              />
            ) : (
              <Spinner message="로딩 중..." />
            )}
          </div>
        </main>

        {/* 오른쪽 — 분석된 텍스트 (클릭 가능 토큰) */}
        <aside className="pdf-text-panel">
          <div className="pdf-text-panel__header">
            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>📖 {currentPage}p 분석</span>
            {analyzing && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>⏳ 분석 중...</span>}
          </div>

          {tokens.length > 0 ? (
            <div className="pdf-text-panel__body">
              {tokens.map((token, i) => {
                if (token.pos === '개행') return <br key={i} />;
                if (!token.text?.trim()) return null;

                const isPunct = /^[\s。、！？!?,.:;""''（）()「」『』【】…·\-\/]+$/.test(token.text);
                if (isPunct) return <span key={i} className="pdf-text-punct">{token.text}</span>;

                const isSaved = savedVocab?.has(token.text) || savedVocab?.has(token.base_form);
                const justSaved = saving[token.base_form || token.text] === 'done';
                const isActive = selectedToken === i;
                const rubySegs = token.furigana ? splitRuby(token.text, token.furigana) : null;

                return (
                  <span
                    key={i}
                    className={`pdf-text-token ${isActive ? 'pdf-text-token--active' : ''} ${isSaved || justSaved ? 'pdf-text-token--saved' : ''}`}
                    onClick={() => setSelectedToken(isActive ? null : i)}
                  >
                    {rubySegs ? (
                      rubySegs.map((seg, j) =>
                        seg.kanji ? <ruby key={j}>{seg.kanji}<rt>{seg.reading}</rt></ruby> : <span key={j}>{seg.plain}</span>
                      )
                    ) : token.text}
                  </span>
                );
              })}
            </div>
          ) : !analyzing ? (
            <div className="pdf-side__empty">
              <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>📖</div>
              페이지 텍스트가<br />여기에 표시됩니다
            </div>
          ) : null}

          {/* 선택 단어 상세 */}
          {selectedToken !== null && tokens[selectedToken]?.meaning && (
            <div className="pdf-text-panel__detail">
              <div className="pdf-text-panel__detail-word">
                {tokens[selectedToken].furigana
                  ? <ruby>{tokens[selectedToken].text}<rt>{tokens[selectedToken].furigana}</rt></ruby>
                  : tokens[selectedToken].text}
              </div>
              <div className="pdf-text-panel__detail-pos">{tokens[selectedToken].pos}</div>
              <div className="pdf-text-panel__detail-meaning">{tokens[selectedToken].meaning}</div>
              {user && (() => {
                const t = tokens[selectedToken];
                const key = t.base_form || t.text;
                const saved = saving[key] === 'done' || savedVocab?.has(t.text) || savedVocab?.has(t.base_form);
                return (
                  <Button size="sm" style={{ marginTop: 8, width: '100%' }} disabled={saved || !!saving[key]}
                    onClick={() => handleSaveWord(t)}>
                    {saved ? '✓ 저장됨' : saving[key] ? '저장 중...' : '⭐ 단어장에 저장'}
                  </Button>
                );
              })()}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
