import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

export default function ViewerPage() {
  const { id } = useParams();
  const { user } = useAuth();
  
  const [material, setMaterial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Reader Settings
  const [fontSize, setFontSize] = useState(1.6);
  const [lineGap, setLineGap] = useState(15);
  const [charGap, setCharGap] = useState(0.25);
  const [theme, setTheme] = useState('dark'); // Default to dark for premium feel
  const [fontFamily, setFontFamily] = useState("'Noto Sans KR'");

  // Detail Panel
  const [selectedToken, setSelectedToken] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Grammar Modal
  const [isGrammarModalOpen, setIsGrammarModalOpen] = useState(false);
  const [grammarAnalysis, setGrammarAnalysis] = useState('');
  const [isGrammarLoading, setIsGrammarLoading] = useState(false);
  const [selectedRangeText, setSelectedRangeText] = useState('');

  const fetchMaterial = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('reading_materials')
        .select('*')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;
      setMaterial(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchMaterial();
  }, [fetchMaterial]);

  // Handle word click
  const handleTokenClick = (token, tokenId) => {
    if (token.pos === '개행') return;
    setSelectedToken({ ...token, id: tokenId });
    setIsSheetOpen(true);
  };

  // Handle Text Selection for Grammar
  const handleTextSelection = () => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (text.length > 1) {
      setSelectedRangeText(text);
      // In a real app, we'd show a floating toolbar here. 
      // For now, let's allow opening grammar modal via a button if text is selected.
    }
  };

  const analyzeGrammar = async () => {
    const selection = window.getSelection();
    const text = selection.toString().trim() || selectedRangeText;
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
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          model: 'gemini-2.0-flash-lite-preview-02-05'
        })
      });

      const resData = await response.json();
      setGrammarAnalysis(resData.candidates[0].content.parts[0].text);
    } catch (err) {
      setGrammarAnalysis("❌ 분석 중 오류가 발생했습니다: " + err.message);
    } finally {
      setIsGrammarLoading(false);
    }
  };

  if (loading) return <div className="page-container">⏳ 자료 해부 중...</div>;
  if (error) return <div className="page-container">❌ 에러: {error}</div>;

  const json = material?.processed_json || { sequence: [], dictionary: {} };
  const isAnalyzing = json.status === 'analyzing';

  return (
    <div className={`page-container viewer-theme-${theme}`} onMouseUp={handleTextSelection}>
      <header className="page-header" style={{ marginBottom: '20px' }}>
        <Link to="/materials" style={{ color: 'var(--primary-light)', fontSize: '0.9rem', marginBottom: '10px', display: 'block' }}>← 라이브러리</Link>
        <h1 className="page-header__title" style={{ fontSize: '2rem' }}>{material.title}</h1>
      </header>

      {/* Settings Bar */}
      <div className="card" style={{ 
        display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', 
        padding: '12px 20px', marginBottom: '30px', background: 'var(--bg-elevated)',
        border: '1px solid var(--border)' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRight: '1px solid var(--border)', paddingRight: '15px' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>SIZE</span>
          <button className="gnb__profile-btn" style={{ width: '24px', height: '24px', fontSize: '0.8rem' }} onClick={() => setFontSize(f => f - 0.1)}>-</button>
          <button className="gnb__profile-btn" style={{ width: '24px', height: '24px', fontSize: '0.8rem' }} onClick={() => setFontSize(f => f + 0.1)}>+</button>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setTheme('light')} 
            style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#fff', border: '1px solid #ccc', cursor: 'pointer' }} 
          />
          <button 
            onClick={() => setTheme('dark')} 
            style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#1a1a1a', border: '1px solid #444', cursor: 'pointer' }} 
          />
        </div>

        <button 
          onClick={analyzeGrammar}
          style={{ 
            marginLeft: 'auto', background: 'var(--primary-glow)', color: 'var(--primary-light)', 
            border: '1px solid var(--primary)', padding: '6px 14px', borderRadius: 'var(--radius-sm)',
            fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer'
          }}
        >
          💡 AI 문법 해설 (드래그 후 클릭)
        </button>
      </div>

      {/* Reader Area */}
      <div 
        className="card" 
        style={{ 
          minHeight: '60vh', padding: '40px', lineHeight: fontSize * 1.5,
          fontSize: `${fontSize}rem`, fontFamily: fontFamily,
          display: 'flex', flexWrap: 'wrap', gap: `${lineGap}px ${charGap}rem`,
          alignContent: 'flex-start', background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'white'
        }}
      >
        {isAnalyzing && (
          <div style={{ width: '100%', padding: '20px', textAlign: 'center', color: 'var(--primary-light)', background: 'var(--primary-glow)', borderRadius: 'var(--radius-md)', marginBottom: '20px', fontSize: '1rem' }}>
            ⏳ 실시간 AI 해부 분석이 진행 중입니다... (새로고침 시 반영)
          </div>
        )}

        {json.sequence.map((tokenId) => {
          const token = json.dictionary[tokenId];
          if (!token) return null;

          if (token.pos === '개행') {
            return <div key={tokenId} style={{ flexBasis: '100%', height: 0 }} />;
          }

          return (
            <div 
              key={tokenId} 
              className="word-token" 
              onClick={() => handleTokenClick(token, tokenId)}
              style={{ 
                display: 'inline-block', position: 'relative', cursor: 'pointer',
                marginTop: '1.2rem', textAlign: 'center'
              }}
            >
              {token.furigana && (
                <span className="furigana" style={{
                  position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                  fontSize: '0.45em', color: 'var(--primary-light)', whiteSpace: 'nowrap',
                  fontWeight: 400, opacity: 0.8
                }}>
                  {token.furigana}
                </span>
              )}
              <span className="surface" style={{ transition: 'color 0.2s' }}>{token.text}</span>
            </div>
          );
        })}
      </div>

      {/* Bottom Sheet Detail */}
      {isSheetOpen && selectedToken && (
        <>
          <div 
            style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.3)', zIndex: 1000 }} 
            onClick={() => setIsSheetOpen(false)}
          />
          <div style={{ 
            position: 'fixed', bottom: 0, left: 0, width: '100%', 
            background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)',
            borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
            padding: '30px', zIndex: 1001, boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
            animation: 'slideUp 0.3s ease-out'
          }}>
            <div style={{ width: '40px', height: '4px', background: 'var(--border)', borderRadius: '2px', margin: '0 auto 20px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
              <span style={{ fontSize: '0.7rem', padding: '2px 8px', border: '1px solid var(--primary)', color: 'var(--primary-light)', borderRadius: '12px' }}>{selectedToken.pos}</span>
              <h3 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>{selectedToken.text}</h3>
              {selectedToken.furigana && <span style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>[{selectedToken.furigana}]</span>}
            </div>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '20px' }}>{selectedToken.meaning || '(뜻 정보 없음)'}</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="gnb__profile-btn" style={{ flex: 1, height: '44px', borderRadius: '8px' }} onClick={() => setIsSheetOpen(false)}>닫기</button>
              <button style={{ 
                flex: 2, height: '44px', borderRadius: '8px', background: 'var(--primary)', 
                color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer' 
              }}>
                ⭐ 단어장에 추가
              </button>
            </div>
          </div>
        </>
      )}

      {/* Grammar Modal */}
      {isGrammarModalOpen && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100
        }}>
          <div style={{ 
            width: '90%', maxWidth: '600px', maxHeight: '80vh', background: 'var(--bg-elevated)',
            borderRadius: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px rgba(0,0,0,0.3)'
          }}>
            <div style={{ padding: '20px 25px', background: 'var(--primary)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>💡 AI 문법 해설사</h2>
              <button onClick={() => setIsGrammarModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '25px', overflowY: 'auto', color: 'var(--text-primary)', lineHeight: '1.7' }}>
              <div style={{ padding: '15px', background: 'var(--bg-secondary)', borderRadius: '12px', marginBottom: '20px', borderLeft: '4px solid var(--primary)', fontSize: '1.1rem' }}>
                {selectedRangeText}
              </div>
              {isGrammarLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>⏳ AI가 문장을 해부하고 있습니다...</div>
              ) : (
                <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>{grammarAnalysis}</div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .viewer-theme-light {
          --bg-reader: #ffffff;
          --text-reader: #2d3436;
        }
        .viewer-theme-dark {
          --bg-reader: #1a1a1a;
          --text-reader: #f8f8f2;
        }
        .word-token:hover .surface {
          color: var(--primary-light);
          text-shadow: 0 0 8px var(--primary-glow);
        }
      `}</style>
    </div>
  );
}
