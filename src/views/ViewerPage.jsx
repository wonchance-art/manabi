'use client';

import { useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import Spinner from '../components/Spinner';
import Button from '../components/Button';

const GEMINI_MODEL = 'gemini-2.0-flash-lite-preview-02-05';

async function callGemini(prompt, signal) {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });
  const resData = await response.json();
  if (!response.ok) throw new Error(resData.error?.message || 'API 요청 실패');
  return resData.candidates[0].content.parts[0].text;
}

function parseGeminiJSON(rawText) {
  const clean = rawText.replace(/```json|```/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('JSON 괄호를 찾을 수 없습니다.');
  return JSON.parse(clean.substring(start, end + 1));
}

function buildTokenizationPrompt(text) {
  const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `입력된 텍스트 "${escaped}"를 정밀 분석해서 반드시 아래 규칙을 지킨 JSON으로 응답해.

1. 데이터 구조 (Index Mapping):
   - "sequence": ["0", "1", "2", ...] 형태로 원문의 모든 요소를 순서대로 번호를 매길 것.
   - "dictionary": {"0": {...}, "1": {...}} 형태로 정보를 넣을 것.

2. 분석 규칙 (필독):
   - 문단 구분 보존: 원문에 줄 바꿈(\\n)이 있다면 반드시 하나의 독립된 토큰으로 포함할 것.
   - 모든 단어와 기호(따옴표, 콤마, 마침표, 띄어쓰기 등)를 빠짐없이 토큰으로 분리할 것.
   - [영어]: 단어 토큰의 'furigana' 필드에 발음 기호(IPA) 작성 (/ / 포함).
   - [일본어]: 한자가 포함된 토큰만 'furigana' 작성.
   - meaning & pos: 무조건 한국어로 정확한 품사와 뜻 작성.
   - 응답은 무조건 { "sequence": [... ] 로 시작하는 유효한 JSON 포맷이어야 함.

설명 없이 오직 순수한 JSON만 응답할 것.`;
}

async function fetchMaterial(id) {
  const { data, error } = await supabase
    .from('reading_materials')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

async function fetchUserVocabWords(userId) {
  if (!userId) return new Set();
  const { data, error } = await supabase
    .from('user_vocabulary')
    .select('word_text')
    .eq('user_id', userId);
  if (error) return new Set();
  return new Set((data || []).map(v => v.word_text));
}

export default function ViewerPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const reanalyzeAbortRef = useRef(null);

  const [fontSize, setFontSize] = useState(1.6);
  const [lineGap, setLineGap] = useState(15);
  const [charGap, setCharGap] = useState(0.25);
  const [theme, setTheme] = useState('dark');
  const [fontFamily, setFontFamily] = useState("'Noto Sans KR'");

  const [selectedToken, setSelectedToken] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const [isGrammarModalOpen, setIsGrammarModalOpen] = useState(false);
  const [grammarAnalysis, setGrammarAnalysis] = useState('');
  const [isGrammarLoading, setIsGrammarLoading] = useState(false);
  const [selectedRangeText, setSelectedRangeText] = useState('');

  const { data: material, isLoading, error, refetch } = useQuery({
    queryKey: ['material', id],
    queryFn: () => fetchMaterial(id),
    // 분석 중일 때 폴링 (RQ v5 signature)
    refetchInterval: (query) => {
      const d = query.state.data;
      const s = d?.status || d?.processed_json?.status;
      return s === 'analyzing' ? 4000 : false;
    },
  });

  const { data: savedWords = new Set() } = useQuery({
    queryKey: ['vocab-words', user?.id],
    queryFn: () => fetchUserVocabWords(user.id),
    enabled: !!user,
    staleTime: 1000 * 30,
  });

  // 재분석
  const reanalyzeMutation = useMutation({
    mutationFn: async () => {
      const rawText = material?.raw_text;
      if (!rawText) throw new Error('원본 텍스트가 없습니다.');

      const controller = new AbortController();
      reanalyzeAbortRef.current = controller;
      setIsReanalyzing(true);

      const initJson = { sequence: [], dictionary: {}, last_idx: -1, status: 'analyzing', metadata: material.processed_json?.metadata || {} };
      await supabase.from('reading_materials').update({ processed_json: initJson }).eq('id', id);

      const lines = rawText.split('\n');
      const timestamp = Date.now();
      const CONCURRENCY = 5;
      let currentJson = { ...initJson };

      for (let i = 0; i < lines.length; i += CONCURRENCY) {
        const batchIndices = [];
        for (let j = 0; j < CONCURRENCY && i + j < lines.length; j++) batchIndices.push(i + j);

        const promises = batchIndices.map(async (idx) => {
          const line = lines[idx].trim();
          if (!line) return { idx, success: true, empty: true };
          let failCount = 0;
          while (failCount < 3) {
            try {
              const raw = await callGemini(buildTokenizationPrompt(line), controller.signal);
              return { idx, success: true, payload: parseGeminiJSON(raw) };
            } catch (e) {
              if (controller.signal.aborted) throw e;
              failCount++;
              if (failCount >= 3) return { idx, success: false };
              await new Promise(r => setTimeout(r, 2000));
            }
          }
        });

        const results = await Promise.all(promises);
        for (const res of results) {
          if (!res || !res.success) { currentJson.status = 'failed'; break; }
          if (res.empty) {
            if (res.idx < lines.length - 1) {
              const brId = `br_${res.idx}_${timestamp}`;
              currentJson.sequence.push(brId);
              currentJson.dictionary[brId] = { text: '\n', pos: '개행' };
            }
          } else if (res.payload) {
            res.payload.sequence.forEach((oldId, pIdx) => {
              const newId = `id_${res.idx}_${pIdx}_${timestamp}`;
              currentJson.sequence.push(newId);
              currentJson.dictionary[newId] = res.payload.dictionary[oldId];
            });
            if (res.idx < lines.length - 1) {
              const brId = `br_${res.idx}_${timestamp}`;
              currentJson.sequence.push(brId);
              currentJson.dictionary[brId] = { text: '\n', pos: '개행' };
            }
          }
        }

        if (currentJson.status === 'failed') break;
        if (batchIndices[batchIndices.length - 1] === lines.length - 1) currentJson.status = 'completed';
        await supabase.from('reading_materials').update({ processed_json: currentJson }).eq('id', id);
      }
    },
    onSuccess: () => {
      setIsReanalyzing(false);
      toast('재분석 완료!', 'success');
      refetch();
    },
    onError: (err) => {
      setIsReanalyzing(false);
      toast('재분석 실패: ' + err.message, 'error');
    },
  });

  const handleTokenClick = (token, tokenId) => {
    if (token.pos === '개행') return;
    setSelectedToken({ ...token, id: tokenId });
    setIsSheetOpen(true);
  };

  const handleTextSelection = () => {
    const text = window.getSelection().toString().trim();
    if (text.length > 1) setSelectedRangeText(text);
  };

  const analyzeGrammar = async () => {
    const text = window.getSelection().toString().trim() || selectedRangeText;
    if (!text) { toast('분석할 문장을 드래그해서 선택해주세요.', 'warning'); return; }

    setIsGrammarModalOpen(true);
    setIsGrammarLoading(true);
    setGrammarAnalysis('');

    try {
      const prompt = `문장 "${text}"를 분석해줘.
1. 전체 번역 (자연스럽게)
2. 주요 문법 포인트 설명 (초/중급자 대상)
3. 핵심 단어 설명

설명은 친절하게 한국어로 작성해줘.`;

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], model: 'gemini-2.0-flash-lite-preview-02-05' })
      });
      const resData = await response.json();
      setGrammarAnalysis(resData.candidates[0].content.parts[0].text);
    } catch (err) {
      setGrammarAnalysis("❌ 분석 중 오류가 발생했습니다: " + err.message);
    } finally {
      setIsGrammarLoading(false);
    }
  };

  const addToVocab = async () => {
    if (!user) { toast('로그인이 필요합니다.', 'warning'); return; }
    if (!selectedToken) return;

    try {
      const { error: insertError } = await supabase
        .from('user_vocabulary')
        .upsert([{
          user_id: user.id,
          word_text: selectedToken.text,
          furigana: selectedToken.furigana || '',
          meaning: selectedToken.meaning || '',
          pos: selectedToken.pos || '',
          interval: 0, ease_factor: 0, repetitions: 0,
          next_review_at: new Date().toISOString()
        }], { onConflict: 'user_id, word_text' });

      if (insertError) throw insertError;
      toast(`"${selectedToken.text}" 단어장에 추가됐어요! ⭐`, 'success');
      queryClient.invalidateQueries({ queryKey: ['vocab-words', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['vocab', user?.id] });
      setIsSheetOpen(false);
    } catch (err) {
      toast('추가 실패: ' + err.message, 'error');
    }
  };

  if (isLoading) return <div className="page-container"><Spinner message="자료 해부 중..." /></div>;
  if (error) return (
    <div className="page-container" style={{ textAlign: 'center', paddingTop: '80px' }}>
      <div className="error-banner">❌ 에러: {error.message}</div>
      <button onClick={() => refetch()} className="btn btn--primary" style={{ marginTop: '16px' }}>다시 시도</button>
    </div>
  );

  // 비공개 자료 접근 제어
  if (material?.visibility === 'private' && material?.owner_id !== user?.id) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔒</div>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>비공개 자료입니다</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>이 자료는 작성자만 열람할 수 있습니다.</p>
        <Link href="/materials" className="btn btn--primary">자료실로 돌아가기</Link>
      </div>
    );
  }

  const json = material?.processed_json || { sequence: [], dictionary: {} };
  const status = material?.status || material?.processed_json?.status;
  const isAnalyzing = status === 'analyzing';
  const isFailed = status === 'failed';
  const isWordSaved = selectedToken ? savedWords.has(selectedToken.text) : false;

  return (
    <div className={`page-container viewer-theme-${theme}`} onMouseUp={handleTextSelection}>
      {/* 비로그인 유도 배너 */}
      {!user && (
        <div className="viewer-guest-banner">
          <span>🔍 단어를 클릭해 뜻을 확인할 수 있어요.</span>
          <Link href="/auth" className="viewer-guest-banner__cta">
            로그인하면 단어장에 저장하고 복습할 수 있습니다 →
          </Link>
        </div>
      )}

      <header className="page-header viewer-header">
        <Link href="/materials" className="viewer-back-link">← 라이브러리</Link>
        <h1 className="page-header__title">{material.title}</h1>
      </header>

      {/* Settings Bar */}
      <div className="card viewer-settings">
        <div className="viewer-settings__left">
          <div className="settings-control">
            <span className="settings-label">SIZE</span>
            <div className="settings-btn-group">
              <button className="settings-btn" onClick={() => setFontSize(f => Math.max(0.8, f - 0.1))}>-</button>
              <button className="settings-btn" onClick={() => setFontSize(f => Math.min(3, f + 0.1))}>+</button>
            </div>
          </div>

          <div className="settings-control">
            <span className="settings-label">LINE</span>
            <input type="range" min="10" max="60" value={lineGap}
              onChange={e => setLineGap(parseInt(e.target.value))}
              className="settings-range settings-range--primary"
            />
          </div>

          <div className="settings-control">
            <span className="settings-label">GAP</span>
            <input type="range" min="0" max="1" step="0.05" value={charGap}
              onChange={e => setCharGap(parseFloat(e.target.value))}
              className="settings-range settings-range--accent"
            />
          </div>

          <select value={fontFamily} onChange={e => setFontFamily(e.target.value)} className="settings-select">
            <option value="'Noto Sans KR'">Noto Sans KR</option>
            <option value="'Nanum Myeongjo'">나눔 명조</option>
            <option value="monospace">Monospace</option>
            <option value="'Inter'">Inter</option>
          </select>
        </div>

        <div className="viewer-settings__right">
          <div className="theme-btns">
            <button
              onClick={() => setTheme('light')}
              className={`theme-btn theme-btn--light ${theme === 'light' ? 'theme-btn--active' : ''}`}
            />
            <button
              onClick={() => setTheme('dark')}
              className={`theme-btn theme-btn--dark ${theme === 'dark' ? 'theme-btn--active' : ''}`}
            />
          </div>

          <button
            onClick={analyzeGrammar}
            disabled={isGrammarLoading}
            className={`grammar-btn ${selectedRangeText ? 'grammar-btn--active' : ''}`}
          >
            {isGrammarLoading ? '⏳ 분석 중...' : '💡 AI 문법 해설'}
          </button>
        </div>
      </div>

      {/* Reader Area */}
      <div
        className={`card reader-area reader-area--${theme}`}
        style={{ fontSize: `${fontSize}rem`, fontFamily, gap: `${lineGap}px ${charGap}rem` }}
      >
        {isAnalyzing && (
          <div className="analyzing-banner">
            <span>⏳ 실시간 AI 해부 분석이 진행 중입니다...</span>
            <button onClick={() => refetch()} className="analyzing-banner__refresh">새로고침</button>
          </div>
        )}

        {isFailed && (
          <div className="analyzing-banner analyzing-banner--error">
            <span>❌ 분석에 실패했습니다.</span>
            <button
              onClick={() => reanalyzeMutation.mutate()}
              disabled={isReanalyzing}
              className="analyzing-banner__refresh"
            >
              {isReanalyzing ? '⏳ 재분석 중...' : '🔄 재분석 요청'}
            </button>
          </div>
        )}

        {json.sequence.map((tokenId) => {
          const token = json.dictionary[tokenId];
          if (!token) return null;
          if (token.pos === '개행') return <div key={tokenId} className="line-break" />;

          return (
            <div key={tokenId} className="word-token" onClick={() => handleTokenClick(token, tokenId)}>
              {token.furigana && <span className="furigana">{token.furigana}</span>}
              <span className="surface">{token.text}</span>
            </div>
          );
        })}
      </div>

      {/* Bottom Sheet */}
      {isSheetOpen && selectedToken && (
        <>
          <div className="overlay" onClick={() => setIsSheetOpen(false)} />
          <div className="bottom-sheet">
            <div className="bottom-sheet__handle" />
            <div className="bottom-sheet__header">
              <span className="bottom-sheet__pos">{selectedToken.pos}</span>
              <h3 className="bottom-sheet__word">{selectedToken.text}</h3>
              {selectedToken.furigana && (
                <span className="bottom-sheet__furigana">[{selectedToken.furigana}]</span>
              )}
            </div>
            <p className="bottom-sheet__meaning">{selectedToken.meaning || '(뜻 정보 없음)'}</p>
            <div className="bottom-sheet__actions">
              <Button variant="ghost" onClick={() => setIsSheetOpen(false)} style={{ flex: 1 }}>닫기</Button>
              {user ? (
                isWordSaved
                  ? <Button variant="secondary" disabled style={{ flex: 2 }}>✓ 이미 저장됨</Button>
                  : <Button onClick={addToVocab} style={{ flex: 2 }}>⭐ 단어장에 추가</Button>
              ) : (
                <Link href="/auth" className="btn btn--primary" style={{ flex: 2, justifyContent: 'center' }}>🔒 로그인하고 저장하기</Link>
              )}
            </div>
          </div>
        </>
      )}

      {/* Grammar Modal */}
      {isGrammarModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal__header">
              <h2 className="modal__title">💡 AI 문법 해설사</h2>
              <button onClick={() => setIsGrammarModalOpen(false)} className="modal__close">✕</button>
            </div>
            <div className="modal__body">
              <div className="modal__quote">{selectedRangeText}</div>
              {isGrammarLoading
                ? <Spinner message="AI가 문장을 해부하고 있습니다..." />
                : <div className="modal__content">{grammarAnalysis}</div>
              }
            </div>
          </div>
        </div>
      )}

      <style>{`
        .analyzing-banner--error {
          border-color: rgba(255, 107, 107, 0.4);
          background: rgba(255, 107, 107, 0.08);
          color: var(--danger);
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .word-token:hover .surface {
          color: var(--primary-light);
          text-shadow: 0 0 8px var(--primary-glow);
        }
      `}</style>
    </div>
  );
}
