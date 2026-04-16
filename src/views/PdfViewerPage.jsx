'use client';

import { useState, useEffect, useRef } from 'react';
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

export default function PdfViewerPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const containerRef = useRef(null);

  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [language, setLanguage] = useState('Japanese');
  const [selectedToken, setSelectedToken] = useState(null);
  const [saving, setSaving] = useState(false);

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

  const [selectedText, setSelectedText] = useState(null); // 드래그 선택 텍스트

  // 토큰 클릭 + 드래그 선택 이벤트 수신
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onToken = (e) => { setSelectedToken(e.detail); setSelectedText(null); };
    const onSelect = (e) => { setSelectedText(e.detail); setSelectedToken(null); };
    el.addEventListener('pdf-token-click', onToken);
    el.addEventListener('pdf-text-select', onSelect);
    return () => {
      el.removeEventListener('pdf-token-click', onToken);
      el.removeEventListener('pdf-text-select', onSelect);
    };
  }, []);

  function changePage(pg) {
    setCurrentPage(pg);
    setSelectedToken(null);
  }

  async function handleSaveWord() {
    if (!user || !selectedToken) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('user_vocabulary').upsert({
        user_id: user.id,
        word_text: selectedToken.text,
        base_form: selectedToken.base_form || selectedToken.text,
        meaning: selectedToken.meaning || '',
        pos: selectedToken.pos || '',
        furigana: selectedToken.furigana || '',
        language,
      }, { onConflict: 'user_id,word_text' });
      if (error) throw error;
      toast(`⭐ "${selectedToken.text}" 저장!`, 'success');
    } catch (e) {
      toast('저장 실패: ' + e.message, 'error');
    } finally {
      setSaving(false);
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
          <button className="btn btn--ghost btn--sm" disabled={currentPage <= 1} onClick={() => changePage(currentPage - 1)}>◀ 이전</button>
          <span style={{ fontSize: '0.85rem' }}>{currentPage} / {numPages}</span>
          <button className="btn btn--ghost btn--sm" disabled={currentPage >= numPages} onClick={() => changePage(currentPage + 1)}>다음 ▶</button>
        </div>
      )}

      {/* PDF + 오버레이 */}
      <div ref={containerRef} className="pdf-container">
        {pdfUrl ? (
          <PdfDocumentInner
            fileUrl={pdfUrl}
            pageNumber={currentPage}
            scale={scale}
            onLoadSuccess={setNumPages}
            language={language}
          />
        ) : (
          <Spinner message="PDF URL 가져오는 중..." />
        )}
      </div>

      {/* 단어 클릭 팝업 */}
      {selectedToken && (
        <div className="pdf-analysis-panel">
          <div className="pdf-analysis-panel__header">
            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>
                {selectedToken.furigana
                  ? <ruby>{selectedToken.text}<rt style={{ fontSize: '0.5em' }}>{selectedToken.furigana}</rt></ruby>
                  : selectedToken.text}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {selectedToken.pos}
                {selectedToken.base_form && selectedToken.base_form !== selectedToken.text && ` · ${selectedToken.base_form}`}
              </div>
            </div>
            <button className="pdf-analysis-panel__close" onClick={() => setSelectedToken(null)}>✕</button>
          </div>
          <div style={{ fontSize: '1rem', marginBottom: 12 }}>{selectedToken.meaning || '(뜻 없음)'}</div>
          {user && (
            <Button size="sm" disabled={saving} onClick={handleSaveWord}>
              {saving ? '저장 중...' : '⭐ 단어장에 저장'}
            </Button>
          )}
        </div>
      )}

      {/* 드래그 선택 팝업 */}
      {selectedText && (
        <div className="pdf-analysis-panel">
          <div className="pdf-analysis-panel__header">
            <div style={{ fontSize: '0.95rem', lineHeight: 1.6, flex: 1 }}>
              "{selectedText.length > 100 ? selectedText.slice(0, 100) + '…' : selectedText}"
            </div>
            <button className="pdf-analysis-panel__close" onClick={() => setSelectedText(null)}>✕</button>
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 8 }}>
            선택한 텍스트를 분석해서 단어를 찾습니다
          </div>
          <Button size="sm" onClick={async () => {
            try {
              let authHeader = {};
              try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.access_token) authHeader = { Authorization: `Bearer ${session.access_token}` };
              } catch {}
              const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeader },
                body: JSON.stringify({ lines: selectedText.split('\n').filter(Boolean), language }),
              });
              if (!res.ok) throw new Error('실패');
              const data = await res.json();
              const tokens = [];
              for (const r of data.results || []) {
                for (const tid of r.sequence) {
                  const t = r.dictionary[tid];
                  if (t && t.meaning && t.pos !== '기호') tokens.push(t);
                }
              }
              if (tokens.length > 0) {
                // 첫 번째 의미 있는 토큰 선택
                setSelectedToken(tokens[0]);
                setSelectedText(null);
              } else {
                toast('분석 결과가 없어요.', 'info');
              }
            } catch (e) {
              toast('분석 실패: ' + e.message, 'error');
            }
          }}>
            🔬 분석하기
          </Button>
        </div>
      )}
    </div>
  );
}
