import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { calculateFSRS } from '../lib/fsrs';

export default function VocabPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('list'); // 'list' or 'review'
  const [vocab, setVocab] = useState([]);
  const [loading, setLoading] = useState(true);

  // Review State
  const [reviewIdx, setReviewIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewFinished, setReviewFinished] = useState(false);

  const fetchVocab = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_vocabulary')
        .select('*')
        .eq('user_id', user.id)
        .order('next_review_at', { ascending: true });
      
      if (error) throw error;
      setVocab(data || []);
    } catch (err) {
      console.error("단어장 로드 실패:", err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchVocab();
  }, [fetchVocab]);

  const reviewWords = vocab.filter(v => new Date(v.next_review_at) <= new Date());
  const currentWord = reviewWords[reviewIdx];

  const handleScore = async (rating) => {
    if (!currentWord) return;

    const stats = {
      interval: currentWord.interval,
      ease_factor: currentWord.ease_factor,
      repetitions: currentWord.repetitions
    };

    const nextStats = calculateFSRS(rating, stats);

    try {
      const { error } = await supabase
        .from('user_vocabulary')
        .update(nextStats)
        .eq('id', currentWord.id);

      if (error) throw error;

      if (reviewIdx < reviewWords.length - 1) {
        setReviewIdx(i => i + 1);
        setShowAnswer(false);
      } else {
        setReviewFinished(true);
      }
    } catch (err) {
      alert("업데이트 실패: " + err.message);
    }
  };

  const startReview = () => {
    setTab('review');
    setReviewIdx(0);
    setShowAnswer(false);
    setReviewFinished(false);
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '20px', flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-header__title">⭐ 내 단어장</h1>
          <p className="page-header__subtitle">FSRS v4 알고리즘으로 과학적인 복습을 경험하세요</p>
        </div>
        {tab === 'list' && reviewWords.length > 0 && (
          <button 
            onClick={startReview}
            style={{ 
              background: 'var(--accent)', color: 'white', padding: '12px 24px', 
              borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.95rem',
              boxShadow: '0 4px 15px var(--accent-glow)', border: 'none', cursor: 'pointer'
            }}
          >
            🧠 복습 시작하기 ({reviewWords.length})
          </button>
        )}
      </div>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: 'var(--radius-full)', width: 'fit-content', marginBottom: '32px' }}>
        <button
          onClick={() => setTab('list')}
          style={{
            padding: '10px 24px', borderRadius: 'var(--radius-full)',
            fontSize: '0.9rem', fontWeight: 600,
            background: tab === 'list' ? 'var(--primary)' : 'transparent',
            color: tab === 'list' ? 'white' : 'var(--text-secondary)',
            border: 'none', cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          🗂️ 어휘 목록
        </button>
        <button
          onClick={() => setTab('review')}
          style={{
            padding: '10px 24px', borderRadius: 'var(--radius-full)',
            fontSize: '0.9rem', fontWeight: 600,
            background: tab === 'review' ? 'var(--accent)' : 'transparent',
            color: tab === 'review' ? 'white' : 'var(--text-secondary)',
            border: 'none', cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          🧠 오늘 복습
        </button>
        <button
          onClick={() => setTab('stats')}
          style={{
            padding: '10px 24px', borderRadius: 'var(--radius-full)',
            fontSize: '0.9rem', fontWeight: 600,
            background: tab === 'stats' ? 'var(--primary)' : 'transparent',
            color: tab === 'stats' ? 'white' : 'var(--text-secondary)',
            border: 'none', cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          📊 학습 통계
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>⏳ 단어들을 불러오는 중...</div>
      ) : tab === 'list' ? (
        <div className="feature-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {vocab.length > 0 ? vocab.map(v => (
            <div key={v.id} className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  {v.furigana && <div style={{ fontSize: '0.75rem', color: 'var(--primary-light)', marginBottom: '4px' }}>{v.furigana}</div>}
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>{v.word_text}</h3>
                </div>
                <span className="badge" style={{ fontSize: '0.7rem' }}>{v.pos}</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>{v.meaning}</p>
              <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>다음 복습: {new Date(v.next_review_at).toLocaleDateString()}</span>
                <span>💪 S: {v.interval.toFixed(1)} / D: {v.ease_factor.toFixed(1)}</span>
              </div>
            </div>
          )) : (
            <div style={{ gridColumn: '1/-1', padding: '80px', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)' }}>
              <p>아직 수집한 단어가 없습니다. 뷰어에서 단어를 클릭해 저장해보세요!</p>
            </div>
          )}
        </div>
      ) : tab === 'review' ? (
        /* Review Mode */
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          {reviewFinished ? (
            <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '20px' }}>🎉</div>
              <h2 style={{ marginBottom: '10px' }}>오늘의 복습 완료!</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>FSRS 알고리즘이 당신의 기억을 강화했습니다.</p>
              <button 
                onClick={() => { setTab('list'); fetchVocab(); }}
                style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '12px 30px', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}
              >
                단어장으로 돌아가기
              </button>
            </div>
          ) : reviewWords.length > 0 ? (
            <div className="card" style={{ minHeight: '400px', display: 'flex', flexDirection: 'column', padding: '40px', textAlign: 'center' }}>
              <div style={{ marginBottom: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                남은 단어: {reviewWords.length - reviewIdx}
              </div>
              
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '15px' }}>
                <h2 style={{ fontSize: '3.5rem', fontWeight: 800, margin: 0 }}>{currentWord.word_text}</h2>
                {showAnswer && <p style={{ fontSize: '1.5rem', color: 'var(--primary-light)' }}>[{currentWord.furigana}]</p>}
                
                {showAnswer ? (
                  <div style={{ marginTop: '30px', animation: 'fadeIn 0.3s' }}>
                    <p style={{ fontSize: '1.4rem', marginBottom: '40px' }}>{currentWord.meaning}</p>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                      <button onClick={() => handleScore(1)} style={{ background: '#ff6b6b', border: 'none', color: 'white', padding: '12px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>다시 (Again)</button>
                      <button onClick={() => handleScore(2)} style={{ background: '#fcc419', border: 'none', color: 'white', padding: '12px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>어려움 (Hard)</button>
                      <button onClick={() => handleScore(3)} style={{ background: '#51cf66', border: 'none', color: 'white', padding: '12px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>알맞음 (Good)</button>
                      <button onClick={() => handleScore(4)} style={{ background: '#339af0', border: 'none', color: 'white', padding: '12px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>쉬움 (Easy)</button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowAnswer(true)}
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '15px 40px', borderRadius: 'var(--radius-full)', fontWeight: 600, fontSize: '1.1rem', cursor: 'pointer', marginTop: '40px' }}
                  >
                    정답 확인하기
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '20px' }}>✅</div>
              <h2 style={{ marginBottom: '10px' }}>지금은 복습할 단어가 없어요</h2>
              <p style={{ color: 'var(--text-secondary)' }}>FSRS가 다음 복습 시점을 계산해 줄 거예요.</p>
            </div>
          )}
        </div>
      ) : (
        /* Stats Dashboard */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {/* Summary Cards */}
          <div className="card" style={{ padding: '24px', textAlign: 'center', background: 'linear-gradient(135deg, var(--bg-elevated), var(--bg-secondary))' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '8px' }}>전체 어휘 수</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--primary-light)' }}>{vocab.length}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>꾸준히 늘려가고 있어요!</div>
          </div>
          <div className="card" style={{ padding: '24px', textAlign: 'center', background: 'linear-gradient(135deg, var(--bg-elevated), var(--bg-secondary))' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '8px' }}>마스터한 어휘</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--accent)' }}>{vocab.filter(v => v.interval > 14).length}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>안정도(S)가 14일 이상인 단어</div>
          </div>
          <div className="card" style={{ padding: '24px', textAlign: 'center', background: 'linear-gradient(135deg, var(--bg-elevated), var(--bg-secondary))' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '8px' }}>기억 건강도</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#51cf66' }}>
              {vocab.length > 0 ? (vocab.reduce((acc, curr) => acc + curr.interval, 0) / vocab.length).toFixed(1) : 0}d
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>평균 기억 안정도</div>
          </div>

          {/* Forecast Chart (Simplified CSS) */}
          <div className="card" style={{ padding: '24px', gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '20px' }}>향후 7일 복습 스케줄</h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '150px', gap: '12px', padding: '0 10px' }}>
              {[...Array(7)].map((_, i) => {
                const date = new Date();
                date.setDate(date.getDate() + i);
                const count = vocab.filter(v => new Date(v.next_review_at).toDateString() === date.toDateString()).length;
                const maxCount = Math.max(...[...Array(7)].map((_, k) => {
                  const d = new Date(); d.setDate(d.getDate() + k);
                  return vocab.filter(v => new Date(v.next_review_at).toDateString() === d.toDateString()).length;
                }), 1);
                
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{ 
                      width: '100%', 
                      height: `${(count / maxCount) * 100}%`, 
                      minHeight: count > 0 ? '4px' : '0',
                      background: i === 0 ? 'var(--accent)' : 'var(--primary-light)', 
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.5s ease'
                    }} />
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {i === 0 ? '오늘' : `${date.getMonth()+1}/${date.getDate()}`}
                    </div>
                    {count > 0 && <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>{count}</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* POS Distribution & Goals */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '20px' }}>🏷️ 어휘 구성</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.entries(
                vocab.reduce((acc, curr) => {
                  acc[curr.pos] = (acc[curr.pos] || 0) + 1;
                  return acc;
                }, {})
              ).map(([pos, count]) => (
                <div key={pos} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '80px', fontSize: '0.85rem', fontWeight: 600 }}>{pos || '기타'}</div>
                  <div style={{ flex: 1, height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ 
                      width: `${(count / vocab.length) * 100}%`, 
                      height: '100%', 
                      background: 'var(--primary)', 
                      borderRadius: '4px' 
                    }} />
                  </div>
                  <div style={{ width: '40px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                    {((count / vocab.length) * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
            <h3 style={{ fontSize: '1.1rem', alignSelf: 'flex-start' }}>🎯 오늘의 목도</h3>
            <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="120" height="120" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="var(--bg-secondary)" strokeWidth="10" />
                <circle 
                  cx="50" cy="50" r="45" fill="none" stroke="var(--accent)" strokeWidth="10" 
                  strokeDasharray={`${Math.min(100, (vocab.filter(v => new Date(v.created_at).toDateString() === new Date().toDateString()).length / 5) * 100) * 2.82} 282`}
                  transform="rotate(-90 50 50)"
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 1s ease' }}
                />
              </svg>
              <div style={{ position: 'absolute', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{vocab.filter(v => new Date(v.created_at).toDateString() === new Date().toDateString()).length}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>목표 5개</div>
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
              오늘 수집한 새로운 단어
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
