'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import Spinner from '../components/Spinner';
import Button from '../components/Button';

async function fetchMaterial(id) {
  const { data, error } = await supabase
    .from('reading_materials')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export default function ViewerPage() {
  const { id } = useParams();
  const { user } = useAuth();

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
    if (!text) return alert("분석할 문장을 드래그해서 선택해주세요.");

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
    if (!user) return alert("로그인이 필요합니다.");
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
      alert("단어장에 추가되었습니다!");
      setIsSheetOpen(false);
    } catch (err) {
      alert("추가 실패: " + err.message);
    }
  };

  if (isLoading) return <div className="page-container"><Spinner message="자료 해부 중..." /></div>;
  if (error) return <div className="page-container error-banner">❌ 에러: {error.message}</div>;

  const json = material?.processed_json || { sequence: [], dictionary: {} };
  const isAnalyzing = json.status === 'analyzing';

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
            <button onClick={refetch} className="analyzing-banner__refresh">새로고침</button>
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
              {user
                ? <Button onClick={addToVocab} style={{ flex: 2 }}>⭐ 단어장에 추가</Button>
                : <Link href="/auth" className="btn btn--primary" style={{ flex: 2, justifyContent: 'center' }}>🔒 로그인하고 저장하기</Link>
              }
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
