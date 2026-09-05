'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { callGemini } from '../lib/gemini';
import { buildContextPrompt } from '../lib/grammarDetail';
import { fetchWordDetailText } from '../lib/wordDetail';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import PdfDocument from '../components/PdfDocument';
import PdfJsViewer from '../components/PdfJsViewer';
import PdfReadBridge from '../components/PdfReadBridge';
import ViewerBottomSheet from '../components/ViewerBottomSheet';
import ListenControls from '../components/ListenControls';
import { formatDetail } from '../lib/wordDetailFormat';
import { langNameKo } from '../lib/constants';
import { usePdfRangeMutation } from '../lib/usePdfRangeMutation';
import { VOCAB_UPSERT, buildVocabRow } from '../lib/vocabIO';
import SaveContextButton, { saveContext } from '../components/learning/SaveContextButton';
import MaterialChapterLinks from '../components/learning/MaterialChapterLinks';
import TokenPosLabel from './TokenPosLabel';

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
  if (!data?.signedUrl) throw new Error('SIGNED_URL_MISSING');
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
  if (!res.ok) throw new Error(`ANALYZE_FAILED_${res.status}`);
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

async function getTranslationAndContext(text, language) {
  const langName = langNameKo(language);
  // 번역+맥락 프롬프트는 뷰어와 같은 정본(buildContextPrompt) — 하드코딩 사본이
  // 개정(말투 항목 등)에서 이미 표류하고 있었다(구조 정리 C, 이중 수정 차단)
  const raw = await callGemini(buildContextPrompt(text, langName));
  const result = raw?.candidates?.[0]?.content?.parts?.[0]?.text || raw;
  if (!result) throw new Error('CONTEXT_EMPTY');
  return result;
}

export default function PdfViewerPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const usePdfJs = searchParams.get('pdfjs') === '1';
  // 자료 뷰어의 '원본 PDF 보기'가 실어 보내는 쪽(v2-H R2). 없으면 첫 쪽.
  const initialPage = parseInt(searchParams.get('page'), 10) || undefined;
  // pdf.js 경로에서만 살아 있는 '지금 보는 쪽'. 기본 경로는 null이라 last_page_read로 떨어진다.
  const [livePage, setLivePage] = useState(null);
  const { user } = useAuth();
  const toast = useToast();

  const [language, setLanguage] = useState('Japanese');
  const [inputText, setInputText] = useState('');
  const [tokens, setTokens] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState({});
  function pdfContextWord(token) {
    return buildVocabRow({ userId: user?.id, surface: token.text, base: token.base_form, meaning: token.meaning, pos: token.pos,
      reading: token.furigana || token.reading, language, sourceSentence: inputText });
  }
  const [sourcePage,setSourcePage] = useState('');
  useEffect(() => { setSourcePage(initialPage ? String(initialPage) : ''); }, [id, initialPage]);
  useEffect(() => { if (usePdfJs && livePage) setSourcePage(String(livePage)); }, [usePdfJs, livePage]);
  const [contextExpl, setContextExpl] = useState('');
  const [contextLoading, setContextLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState({ tokens: null, context: null });
  const analyzeRequestRef = useRef(0);

  // 단어 상세 팝업
  const [wordDetail, setWordDetail] = useState(null); // { token, detail, loading }

  async function handleWordClick(token) {
    setWordDetail({ token, detail: null, loading: true });
    try {
      const detail = await fetchWordDetailText(token, language);
      setWordDetail({ token, detail, loading: false });
    } catch {
      setWordDetail(prev => prev ? { ...prev, detail: '설명을 가져올 수 없었어요.', loading: false } : null);
    }
  }
  const [hideKnown, setHideKnown] = useState(true);

  // SSR와 hydration 첫 렌더는 같은 기본값을 쓰고, 브라우저 저장값은 마운트 뒤 복원한다.
  useEffect(() => {
    try {
      setLanguage(localStorage.getItem('pdf_language') || 'Japanese');
      setHideKnown(localStorage.getItem('pdf_hideKnown') !== 'false');
    } catch { /* 저장소 차단 시 기본값 유지 */ }
  }, []);

  const isClient = typeof window !== 'undefined';
  function getCached(key) { if (!isClient) return null; try { return JSON.parse(localStorage.getItem(`pdf_cache:${key}`)); } catch { return null; } }
  function setCached(key, val) { if (!isClient) return; try { localStorage.setItem(`pdf_cache:${key}`, JSON.stringify(val)); } catch {} }

  const { data: savedVocab } = useQuery({
    queryKey: ['pdf-saved-vocab', user?.id, language],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_vocabulary').select('word_text, base_form').eq('user_id', user.id).eq('language', language);
      if (error) throw error;
      const set = new Set();
      for (const v of (data || [])) { if (v.word_text) set.add(v.word_text); if (v.base_form) set.add(v.base_form); }
      return set;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const { data: pdfInfo, isLoading, error } = useQuery({
    queryKey: ['pdf-info', id], queryFn: () => fetchPdfInfo(id), enabled: !!id,
  });
  // 다리는 자료 뷰어의 '다음 범위'와 **같은 뮤테이션**을 쓴다 — 여기 sourcePdf가 곧 이 PDF다.
  const rangeMutation = usePdfRangeMutation({ sourcePdf: pdfInfo, user, toast });
  const {
    data: pdfUrl,
    isLoading: isPdfUrlLoading,
    error: pdfUrlError,
    refetch: refetchPdfUrl,
  } = useQuery({
    queryKey: ['pdf-url', pdfInfo?.storage_path], queryFn: () => getPdfUrl(pdfInfo.storage_path),
    enabled: !!pdfInfo?.storage_path, staleTime: 1000 * 60 * 30,
  });

  function markKnown(toks) {
    const dismissed = (() => { try { return new Set(JSON.parse(localStorage.getItem('pdf_dismissed') || '[]')); } catch { return new Set(); } })();
    // 중복 제거 (base_form 기준 첫 등장만)
    const seen = new Set();
    return toks
      .filter(t => {
        if (!t.text?.trim() || !t.meaning) return false;
        if (t.pos === '기호' || /^[\s。、！？!?,.:;""''（）()「」『』【】…·\-\/\[\]{}#@&%$]+$/.test(t.text)) return false;
        const key = t.base_form || t.text;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(t => ({
        ...t,
        _alreadySaved: savedVocab?.has(t.text) || savedVocab?.has(t.base_form)
          || dismissed.has(t.text) || dismissed.has(t.base_form || t.text),
      }));
  }

  async function handleAnalyze(text) {
    if (!text?.trim()) return;
    const t = text.trim();
    const requestId = ++analyzeRequestRef.current;
    setInputText(t);
    setAnalysisError({ tokens: null, context: null });
    const cacheKey = `${language}:${t.slice(0, 120)}`;

    const ct = getCached(`tokens:${cacheKey}`);
    const cc = getCached(`context:${cacheKey}`);
    if (ct) { setTokens(markKnown(ct)); setAnalyzing(false); } else { setTokens([]); setAnalyzing(true); }
    if (cc) { setContextExpl(cc); setContextLoading(false); } else { setContextExpl(''); setContextLoading(true); }

    const promises = [];
    if (!ct) promises.push((async () => {
      try {
        const result = await quickAnalyze(t, language);
        if (requestId !== analyzeRequestRef.current) return;
        setCached(`tokens:${cacheKey}`, result);
        setTokens(markKnown(result));
      } catch {
        if (requestId === analyzeRequestRef.current) {
          setAnalysisError(prev => ({ ...prev, tokens: '단어 분석에 실패했어요.' }));
        }
      } finally {
        if (requestId === analyzeRequestRef.current) setAnalyzing(false);
      }
    })());
    if (!cc) promises.push((async () => {
      try {
        const result = await getTranslationAndContext(t, language);
        if (requestId !== analyzeRequestRef.current) return;
        setCached(`context:${cacheKey}`, result);
        setContextExpl(result);
      } catch {
        if (requestId === analyzeRequestRef.current) {
          setAnalysisError(prev => ({ ...prev, context: '번역과 맥락 생성에 실패했어요.' }));
        }
      } finally {
        if (requestId === analyzeRequestRef.current) setContextLoading(false);
      }
    })());
    await Promise.allSettled(promises);
  }

  // 페이지 어디서든 Ctrl+V → 자동 분석
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const text = e.clipboardData?.getData('text')?.trim();
      if (text) { e.preventDefault(); handleAnalyze(text); }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [language, savedVocab]);

  async function handleSaveWord(token) {
    if (!user) { toast('로그인이 필요합니다.', 'warning'); return; }
    const key = token.base_form || token.text;
    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      // 여기가 `word_text: token.text`(surface)라, 같은 단어를 자료 뷰어(기본형)와
      // 이 화면에서 담으면 **행이 둘로 갈려 복습이 두 번** 왔다. 정본 조립기로 수렴.
      const { error } = await supabase.from('user_vocabulary').upsert(buildVocabRow({
        userId: user.id,
        surface: token.text,
        base: token.base_form,
        meaning: token.meaning,
        pos: token.pos,
        reading: token.furigana || token.reading,
        language,
        sourceSentence: inputText,
      }), VOCAB_UPSERT);
      if (error) throw error;
      setSaving(prev => ({ ...prev, [key]: 'done' }));
      try {
        await saveContext({ word: pdfContextWord(token), source: { kind: 'pdf', pdfId: id, page: sourcePage || null, quote: inputText } });
        toast(`"${token.text}" 저장!`, 'success');
      } catch {
        toast('단어는 저장했지만 문맥 연결이 남아 있어요. 문맥 추가를 눌러 다시 연결해 주세요.', 'warning', 6000);
      }
    } catch (e) { toast('저장 실패', 'error'); setSaving(prev => ({ ...prev, [key]: false })); }
  }

  function handleDismissWord(token) {
    const key = token.base_form || token.text;
    try { const d = JSON.parse(localStorage.getItem('pdf_dismissed') || '[]'); if (!d.includes(key)) { d.push(key); localStorage.setItem('pdf_dismissed', JSON.stringify(d)); } } catch {}
    setTokens(prev => markKnown(prev));
    toast(`"${token.text}" — 아는 단어`, 'info');
  }

  if (isLoading) return <div className="page-container"><Spinner message="PDF 로딩 중..." /></div>;
  if (error) return (
    <div className="page-container" style={{ textAlign: 'center', paddingTop: 80 }}>
      <h2>PDF를 찾을 수 없어요</h2>
      <Link href="/materials" className="btn btn--primary">자료실로</Link>
    </div>
  );

  const visibleTokens = hideKnown ? tokens.filter(t => !t._alreadySaved) : tokens;
  const hasResults = tokens.length > 0 || analyzing || contextLoading || contextExpl
    || analysisError.tokens || analysisError.context;

  const leftPanelContent = hasResults ? (
    <div className="pdf-context">
      <div className="pdf-context__title">번역 · 맥락</div>
      {inputText && (
        <div className="pdf-context__original">
          &quot;{inputText.length > 120 ? inputText.slice(0, 120) + '…' : inputText}&quot;
        </div>
      )}
      {contextLoading ? (
        <div className="pdf-context__loading">번역 + 맥락 생성 중...</div>
      ) : analysisError.context ? (
        <div className="pdf-side__empty">
          {analysisError.context}<br />
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => handleAnalyze(inputText)}>다시 시도</button>
        </div>
      ) : contextExpl ? (
        <div className="pdf-context__text" dangerouslySetInnerHTML={{ __html: formatDetail(contextExpl) }} />
      ) : null}
    </div>
  ) : (
    <div className="pdf-side__empty">
      복사한 텍스트의<br />번역과 맥락이 여기에
    </div>
  );

  const rightPanelContent = visibleTokens.length > 0 ? (
    <div className="pdf-word-list">
      <div className="pdf-word-list__header">
        <span className="pdf-word-list__title">단어 ({visibleTokens.length})</span>
        <button className="pdf-word-list__toggle"
          onClick={() => { const v = !hideKnown; setHideKnown(v); localStorage.setItem('pdf_hideKnown', String(v)); }}>
          {hideKnown ? '전체' : '숨기기'}
        </button>
      </div>
      {visibleTokens.map((t, i) => {
        const key = t.base_form || t.text;
        const saved = t._alreadySaved || saving[key] === 'done';
        return (
          <div key={i} className={`pdf-word-item ${saved ? 'pdf-word-item--saved' : ''} ${wordDetail?.token?.text === t.text ? 'pdf-word-item--active' : ''}`}>
            <span className="pdf-word-item__text" onClick={() => handleWordClick(t)}>{t.text}</span>
            <span className="pdf-word-item__meaning" onClick={() => handleWordClick(t)}>{t.meaning}</span>
            {user && (
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {saved ? <SaveContextButton key={`${language}:${key}:${inputText}:${sourcePage}`} label="문맥 추가" word={pdfContextWord(t)}
                  source={{kind:'pdf',pdfId:id,page:sourcePage||null,quote:inputText}} /> : (
                  <button className="pdf-word-item__save" disabled={!!saving[key]} onClick={() => handleSaveWord(t)}>{saving[key] ? '…' : '★'}</button>
                )}
                <button className="pdf-word-item__save pdf-word-item__dismiss"
                  onClick={() => handleDismissWord(t)}>✕</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  ) : analyzing ? (
    <div className="pdf-side__empty">분석 중...</div>
  ) : analysisError.tokens ? (
    <div className="pdf-side__empty">
      {analysisError.tokens}<br />
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => handleAnalyze(inputText)}>다시 시도</button>
    </div>
  ) : (
    <div className="pdf-side__empty">
      단어 목록이<br />여기에 표시됩니다
    </div>
  );

  return (
    <div className="pdf-page">
      <div className="pdf-toolbar" style={{ padding: '10px 16px' }}>
        <Link href="/materials" className="pdf-toolbar__back">← 자료실</Link>
        <h1 className="pdf-toolbar__title">{pdfInfo?.title || 'PDF'}</h1>
        {/* 자료 뷰어로 건너가는 다리(v2-H R1) — 여기서 범위만 고르고 나머지는 그쪽 몫 */}
        <PdfReadBridge pdfInfo={pdfInfo} livePage={livePage} mutation={rangeMutation} user={user} />
        {inputText && <ListenControls text={inputText} language={language} />}
        <select value={language} onChange={e => { setLanguage(e.target.value); localStorage.setItem('pdf_language', e.target.value); }}
          style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
          <option value="Japanese">일본어</option>
          <option value="English">영어</option>
          <option value="Chinese">중국어</option>
          <option value="French">프랑스어</option>
        </select>
      </div>

      <div style={{padding:'0 16px'}}><MaterialChapterLinks lang={language} kind="pdf" materialId={id} />
        <label className="learning-links__muted">출처 쪽수 {usePdfJs ? '(현재 쪽)' : '(직접 입력)'} <input type="number" aria-label="출처 쪽수" min="1" max={pdfInfo?.page_count||100000} value={sourcePage} onChange={e=>setSourcePage(e.target.value)} style={{width:88,padding:8,fontSize:16}} /></label>
        <p className="learning-links__muted">복사한 문장의 쪽수를 입력하면 복습에서 해당 쪽으로 돌아올 수 있어요.</p>
      </div>
      <div className="pdf-layout">
        {/* 왼쪽 — 맥락 설명 */}
        <aside className={`pdf-side pdf-side--left ${hasResults ? 'pdf-side--active' : ''}`}>
          {leftPanelContent}
        </aside>

        {/* 중앙 — PDF 내장 뷰어 */}
        <main className="pdf-main">
          {pdfUrlError || (pdfInfo && !pdfInfo.storage_path) ? (
            <div className="pdf-side__empty">
              PDF 파일 주소를 불러올 수 없어요.<br />
              {pdfInfo?.storage_path && (
                <button type="button" className="btn btn--primary btn--sm" onClick={() => refetchPdfUrl()}>다시 시도</button>
              )}
            </div>
          ) : isPdfUrlLoading ? (
            <Spinner message="로딩 중..." />
          ) : pdfUrl ? (
            usePdfJs
              ? <PdfJsViewer pdfUrl={pdfUrl} onPageChange={setLivePage} initialPage={initialPage} />
              : <PdfDocument pdfUrl={pdfUrl} page={initialPage} />
          ) : (
            <div className="pdf-side__empty">PDF 파일 주소가 없습니다.</div>
          )}
          <div className="pdf-input-bar">
            <button className="btn btn--ghost btn--sm" style={{ flexShrink: 0 }}
              onClick={async () => {
                try { const t = await navigator.clipboard.readText(); if (t?.trim()) handleAnalyze(t.trim()); else toast('클립보드 비어있음', 'info'); }
                catch { toast('클립보드 권한 필요', 'warning'); }
              }}>붙여넣기</button>
            <input type="text" value={inputText} onChange={e => setInputText(e.target.value)}
              placeholder="붙여넣기 또는 직접 입력" className="form-input" style={{ flex: 1, fontSize: '0.82rem' }}
              onPaste={e => { const t = e.clipboardData?.getData('text')?.trim(); if (t) { e.preventDefault(); handleAnalyze(t); } }}
              onKeyDown={e => e.key === 'Enter' && handleAnalyze(inputText)} />
            <Button size="sm" onClick={() => handleAnalyze(inputText)} disabled={!inputText.trim() || analyzing || contextLoading}>
              {analyzing || contextLoading ? '...' : '→'}
            </Button>
          </div>
        </main>

        {/* 오른쪽 — 단어 리스트 */}
        <aside className={`pdf-side pdf-side--right ${hasResults ? 'pdf-side--active' : ''}`}>
          {rightPanelContent}
        </aside>
      </div>

      <ViewerBottomSheet
        leftContent={leftPanelContent}
        rightContent={rightPanelContent}
        leftActive={contextLoading || !!contextExpl}
        rightActive={analyzing || visibleTokens.length > 0}
        leftBadge={contextLoading ? '생성 중' : null}
        rightBadge={visibleTokens.length > 0 ? `${visibleTokens.length}개` : null}
      />

      {/* 단어 상세 팝업 */}
      {wordDetail && (
        <>
          <div className="pdf-detail-overlay" onClick={() => setWordDetail(null)} />
          <div className="pdf-detail-popup">
            <div className="pdf-detail-popup__header">
              <div className="pdf-detail-popup__word">
                {wordDetail.token.furigana
                  ? <ruby>{wordDetail.token.text}<rt>{wordDetail.token.furigana}</rt></ruby>
                  : wordDetail.token.text}
              </div>
              <button className="pdf-detail-popup__close" onClick={() => setWordDetail(null)}>✕</button>
            </div>
            <div className="pdf-detail-popup__meta">
              <span className="pdf-detail-popup__pos"><TokenPosLabel token={wordDetail.token} /></span>
              {wordDetail.token.base_form && wordDetail.token.base_form !== wordDetail.token.text && (
                <span className="pdf-detail-popup__base">{wordDetail.token.base_form}</span>
              )}
              <span className="pdf-detail-popup__short">{wordDetail.token.meaning}</span>
              {language === 'English' && wordDetail.token.reading && (
                <span style={{
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                  letterSpacing: '0.02em',
                }}>
                  {wordDetail.token.reading}
                </span>
              )}
            </div>
            <div className="pdf-detail-popup__body">
              {wordDetail.loading
                ? <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>상세 설명 생성 중...</div>
                : <div className="pdf-detail-popup__text" dangerouslySetInnerHTML={{ __html: formatDetail(wordDetail.detail) }} />
              }
            </div>
            {user && (() => {
              const key = wordDetail.token.base_form || wordDetail.token.text;
              const t=wordDetail.token;
              const saved = savedVocab?.has(t.text) || savedVocab?.has(t.base_form) || saving[key] === 'done';
              if (!saved) return <button className="btn btn--primary btn--sm" disabled={!!saving[key]} onClick={() => handleSaveWord(t)}>{saving[key] ? '저장 중…' : '출처와 함께 담기'}</button>;
              return <SaveContextButton key={`${language}:${key}:${inputText}:${sourcePage}`} label={saved?'이 문맥 추가':'출처와 함께 담기'}
                word={pdfContextWord(t)}
                source={{kind:'pdf',pdfId:id,page:sourcePage||null,quote:inputText}} />;
            })()}
          </div>
        </>
      )}
    </div>
  );
}
