'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
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
    .from('uploaded_pdfs')
    .select('*')
    .eq('id', pdfId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('NOT_FOUND');
  return data;
}

async function getPdfUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from('user-pdfs')
    .createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

async function quickAnalyze(text, language) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
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
  if (!res.ok) throw new Error('분석 실패');
  const data = await res.json();
  const tokens = [];
  for (const result of data.results || []) {
    for (const tokenId of result.sequence) {
      const t = result.dictionary[tokenId];
      if (t && t.pos !== '기호' && t.text?.trim()) tokens.push(t);
    }
  }
  return tokens;
}

export default function PdfViewerPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();

  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [language, setLanguage] = useState('Japanese');

  const [selectedText, setSelectedText] = useState('');
  const [analyzedTokens, setAnalyzedTokens] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState({});

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

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString()?.trim();
    if (text && text.length > 0 && text.length < 500) {
      setSelectedText(text);
      setAnalyzedTokens(null);
    }
  }, []);

  async function handleAnalyze() {
    if (!selectedText) return;
    setAnalyzing(true);
    try {
      const tokens = await quickAnalyze(selectedText, language);
      setAnalyzedTokens(tokens);
    } catch (e) {
      toast('분석 실패: ' + e.message, 'error');
    } finally {
      setAnalyzing(false);
    }
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
      toast(`⭐ "${token.text}" 저장!`, 'success');
    } catch (e) {
      toast('저장 실패: ' + e.message, 'error');
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  }

  if (isLoading) return <div className="page-container"><Spinner message="PDF 로딩 중..." /></div>;
  if (error) return (
    <div className="page-container" style={{ textAlign: 'center', paddingTop: 80 }}>
      <div style={{ fontSize: '3rem', marginBottom: 12 }}>📄</div>
      <h2>PDF를 찾을 수 없어요</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>삭제됐거나 권한이 없는 파일입니다.</p>
      <Link href="/materials" className="btn btn--primary">자료실로</Link>
    </div>
  );

  return (
    <div className="page-container" style={{ maxWidth: 900, padding: '16px 8px' }}>
      <div className="pdf-toolbar">
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

      {numPages && (
        <div className="pdf-nav">
          <button className="btn btn--ghost btn--sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>◀ 이전</button>
          <span style={{ fontSize: '0.85rem' }}>{currentPage} / {numPages}</span>
          <button className="btn btn--ghost btn--sm" disabled={currentPage >= numPages} onClick={() => setCurrentPage(p => p + 1)}>다음 ▶</button>
        </div>
      )}

      <div className="pdf-container" onMouseUp={handleMouseUp}>
        {pdfUrl ? (
          <PdfDocumentInner
            fileUrl={pdfUrl}
            pageNumber={currentPage}
            scale={scale}
            onLoadSuccess={setNumPages}
          />
        ) : (
          <Spinner message="PDF URL 가져오는 중..." />
        )}
      </div>

      {selectedText && (
        <div className="pdf-analysis-panel">
          <div className="pdf-analysis-panel__header">
            <span className="pdf-analysis-panel__selected">
              "{selectedText.length > 80 ? selectedText.slice(0, 80) + '…' : selectedText}"
            </span>
            <button className="pdf-analysis-panel__close" onClick={() => { setSelectedText(''); setAnalyzedTokens(null); }}>✕</button>
          </div>

          {!analyzedTokens && !analyzing && (
            <Button size="sm" onClick={handleAnalyze}>🔬 분석하기</Button>
          )}
          {analyzing && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>⏳ 분석 중...</span>}

          {analyzedTokens && (
            <div className="pdf-analysis-panel__tokens">
              {analyzedTokens.map((t, i) => {
                const key = t.base_form || t.text;
                return (
                  <div key={i} className="pdf-token-row">
                    <div className="pdf-token-row__word">
                      {t.furigana ? <ruby>{t.text}<rt>{t.furigana}</rt></ruby> : <span>{t.text}</span>}
                    </div>
                    <span className="pdf-token-row__pos">{t.pos}</span>
                    <span className="pdf-token-row__meaning">{t.meaning || '—'}</span>
                    {user && (
                      <button className="pdf-token-row__save" disabled={saving[key]} onClick={() => handleSaveWord(t)}>
                        {saving[key] ? '...' : '⭐'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
