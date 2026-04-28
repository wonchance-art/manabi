'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { callGemini } from '../lib/gemini';
import { fetchWordDetailText } from '../lib/wordDetail';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import PdfDocument from '../components/PdfDocument';
import ViewerBottomSheet from '../components/ViewerBottomSheet';

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

async function getTranslationAndContext(text, language) {
  const langName = language === 'Japanese' ? '일본어' : '영어';
  try {
    const raw = await callGemini(`다음 ${langName} 텍스트를 한국어로 처리해주세요.

"${text}"

아래 형식 정확히 따라 출력. 도입 문구 없이 바로:

**번역**
자연스러운 한국어 번역

**맥락**
내용 이해를 돕는 배경 설명 2~3문장

규칙: 마크다운 **굵게**만 사용, 간결하게`);
    return raw?.candidates?.[0]?.content?.parts?.[0]?.text || raw;
  } catch { return null; }
}

export default function PdfViewerPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();

  const [language, setLanguage] = useState(() => {
    if (typeof window === 'undefined') return 'Japanese';
    return localStorage.getItem('pdf_language') || 'Japanese';
  });
  const [inputText, setInputText] = useState('');
  const [tokens, setTokens] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState({});
  const [contextExpl, setContextExpl] = useState('');
  const [contextLoading, setContextLoading] = useState(false);

  // 마크다운 간이 렌더 — **볼드** → <strong>, 줄바꿈 보존, 섹션 간 여백
  function formatDetail(text) {
    if (!text) return '';
    // 도입 문구 제거 (첫 줄이 **뜻**이 아니면 잘라냄)
    const lines = text.split('\n').map(l => l.trim()).filter(l => l !== '-');
    const startIdx = lines.findIndex(l => l.startsWith('**'));
    const cleaned = (startIdx > 0 ? lines.slice(startIdx) : lines).join('\n');

    return cleaned
      .replace(/\*\*(.+?)\*\*/g, (_, m) => {
        // 섹션 제목(뜻/뉘앙스/예문)인지 인라인 굵게인지 구분
        if (/^(번역|맥락|발음|뜻|뉘앙스|예문)$/.test(m.trim())) return `<hr class="pdf-detail-hr" /><strong class="pdf-detail-heading">${m}</strong>`;
        return `<strong>${m}</strong>`;
      })
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .join('<br />')
      .replace(/(<br \/>){2,}/g, '</p><p>')
      .replace(/^/, '<p>').replace(/$/, '</p>');
  }

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
  const [hideKnown, setHideKnown] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('pdf_hideKnown') !== 'false';
  });

  const isClient = typeof window !== 'undefined';
  function getCached(key) { if (!isClient) return null; try { return JSON.parse(localStorage.getItem(`pdf_cache:${key}`)); } catch { return null; } }
  function setCached(key, val) { if (!isClient) return; try { localStorage.setItem(`pdf_cache:${key}`, JSON.stringify(val)); } catch {} }

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

  const { data: pdfInfo, isLoading, error } = useQuery({
    queryKey: ['pdf-info', id], queryFn: () => fetchPdfInfo(id), enabled: !!id,
  });
  const { data: pdfUrl } = useQuery({
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
    setInputText(t);
    const cacheKey = `${language}:${t.slice(0, 120)}`;

    const ct = getCached(`tokens:${cacheKey}`);
    const cc = getCached(`context:${cacheKey}`);
    if (ct) { setTokens(markKnown(ct)); } else { setTokens([]); setAnalyzing(true); }
    if (cc) { setContextExpl(cc); } else { setContextExpl(''); setContextLoading(true); }

    const promises = [];
    if (!ct) promises.push(quickAnalyze(t, language).then(r => { setCached(`tokens:${cacheKey}`, r); setTokens(markKnown(r)); setAnalyzing(false); }));
    if (!cc) promises.push(getTranslationAndContext(t, language).then(r => { const e = r || ''; setCached(`context:${cacheKey}`, e); setContextExpl(e); setContextLoading(false); }));
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
      const { error } = await supabase.from('user_vocabulary').upsert({
        user_id: user.id, word_text: token.text, base_form: token.base_form || token.text,
        meaning: token.meaning || '', pos: token.pos || '', furigana: token.furigana || '', language,
        source_sentence: inputText.slice(0, 200),
      }, { onConflict: 'user_id,word_text' });
      if (error) throw error;
      setSaving(prev => ({ ...prev, [key]: 'done' }));
      toast(`⭐ "${token.text}" 저장!`, 'success');
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
  const hasResults = tokens.length > 0 || analyzing || contextLoading || contextExpl;

  const leftPanelContent = hasResults ? (
    <div className="pdf-context">
      <div className="pdf-context__title">💡 번역 · 맥락</div>
      {inputText && (
        <div className="pdf-context__original">
          "{inputText.length > 120 ? inputText.slice(0, 120) + '…' : inputText}"
        </div>
      )}
      {contextLoading ? (
        <div className="pdf-context__loading">⏳ 번역 + 맥락 생성 중...</div>
      ) : contextExpl ? (
        <div className="pdf-context__text" dangerouslySetInnerHTML={{ __html: formatDetail(contextExpl) }} />
      ) : null}
    </div>
  ) : (
    <div className="pdf-side__empty">
      <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>💡</div>
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
                <button className="pdf-word-item__save" disabled={saved || !!saving[key]}
                  onClick={() => handleSaveWord(t)}>{saved ? '✓' : '⭐'}</button>
                <button className="pdf-word-item__save pdf-word-item__dismiss"
                  onClick={() => handleDismissWord(t)}>✕</button>
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
  );

  return (
    <div className="pdf-page">
      <div className="pdf-toolbar" style={{ padding: '10px 16px' }}>
        <Link href="/materials" className="pdf-toolbar__back">← 자료실</Link>
        <h1 className="pdf-toolbar__title">{pdfInfo?.title || 'PDF'}</h1>
        <select value={language} onChange={e => { setLanguage(e.target.value); localStorage.setItem('pdf_language', e.target.value); }}
          style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
          <option value="Japanese">🇯🇵</option>
          <option value="English">🇬🇧</option>
        </select>
      </div>

      <div className="pdf-layout">
        {/* 왼쪽 — 맥락 설명 */}
        <aside className={`pdf-side pdf-side--left ${hasResults ? 'pdf-side--active' : ''}`}>
          {leftPanelContent}
        </aside>

        {/* 중앙 — PDF 내장 뷰어 */}
        <main className="pdf-main">
          {pdfUrl ? <PdfDocument pdfUrl={pdfUrl} /> : <Spinner message="로딩 중..." />}
          <div className="pdf-input-bar">
            <button className="btn btn--ghost btn--sm" style={{ flexShrink: 0 }}
              onClick={async () => {
                try { const t = await navigator.clipboard.readText(); if (t?.trim()) handleAnalyze(t.trim()); else toast('클립보드 비어있음', 'info'); }
                catch { toast('클립보드 권한 필요', 'warning'); }
              }}>📋</button>
            <input type="text" value={inputText} onChange={e => setInputText(e.target.value)}
              placeholder="붙여넣기 또는 직접 입력" className="form-input" style={{ flex: 1, fontSize: '0.82rem' }}
              onPaste={e => { const t = e.clipboardData?.getData('text')?.trim(); if (t) { e.preventDefault(); handleAnalyze(t); } }}
              onKeyDown={e => e.key === 'Enter' && handleAnalyze(inputText)} />
            <Button size="sm" onClick={() => handleAnalyze(inputText)} disabled={!inputText.trim() || analyzing}>
              {analyzing ? '⏳' : '→'}
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
              <span className="pdf-detail-popup__pos">{wordDetail.token.pos}</span>
              {wordDetail.token.base_form && wordDetail.token.base_form !== wordDetail.token.text && (
                <span className="pdf-detail-popup__base">{wordDetail.token.base_form}</span>
              )}
              <span className="pdf-detail-popup__short">{wordDetail.token.meaning}</span>
            </div>
            <div className="pdf-detail-popup__body">
              {wordDetail.loading
                ? <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>⏳ 상세 설명 생성 중...</div>
                : <div className="pdf-detail-popup__text" dangerouslySetInnerHTML={{ __html: formatDetail(wordDetail.detail) }} />
              }
            </div>
            {user && (() => {
              const key = wordDetail.token.base_form || wordDetail.token.text;
              const saved = saving[key] === 'done' || savedVocab?.has(wordDetail.token.text) || savedVocab?.has(wordDetail.token.base_form);
              return (
                <button className={`pdf-detail-popup__save ${saved ? 'pdf-detail-popup__save--done' : ''}`}
                  disabled={saved || !!saving[key]}
                  onClick={() => handleSaveWord(wordDetail.token)}>
                  {saved ? '✓ 저장됨' : saving[key] ? '저장 중...' : '⭐ 단어장에 저장'}
                </button>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}
