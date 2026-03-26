'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { calculateFSRS } from '../lib/fsrs';
import Spinner from '../components/Spinner';
import Button from '../components/Button';

async function fetchVocab(userId) {
  const { data, error } = await supabase
    .from('user_vocabulary')
    .select('*')
    .eq('user_id', userId)
    .order('next_review_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

function exportCSV(vocab) {
  const header = ['단어', '후리가나', '의미', '품사', '다음 복습', '안정도(S)', '난이도(D)'];
  const rows = vocab.map(v => [
    v.word_text,
    v.furigana || '',
    v.meaning || '',
    v.pos || '',
    new Date(v.next_review_at).toLocaleDateString('ko-KR'),
    v.interval.toFixed(1),
    v.ease_factor.toFixed(1),
  ]);
  const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `anatomy_vocab_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function VocabPage() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('list');
  const [reviewIdx, setReviewIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewFinished, setReviewFinished] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('due'); // 'due' | 'newest' | 'alpha'

  const { data: vocab = [], isLoading } = useQuery({
    queryKey: ['vocab', user?.id],
    queryFn: () => fetchVocab(user.id),
    enabled: !!user,
  });

  const scoreMutation = useMutation({
    mutationFn: async ({ id, nextStats }) => {
      const { error } = await supabase
        .from('user_vocabulary')
        .update(nextStats)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vocab', user?.id] }),
    onError: (err) => toast('업데이트 실패: ' + err.message, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('user_vocabulary')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocab', user?.id] });
      toast('단어를 삭제했습니다.', 'info');
    },
    onError: (err) => toast('삭제 실패: ' + err.message, 'error'),
  });

  // 검색 + 정렬
  const filteredVocab = useMemo(() => {
    let list = [...vocab];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(v =>
        v.word_text?.toLowerCase().includes(q) ||
        v.meaning?.toLowerCase().includes(q) ||
        v.furigana?.toLowerCase().includes(q)
      );
    }
    if (sortBy === 'due') {
      list.sort((a, b) => new Date(a.next_review_at) - new Date(b.next_review_at));
    } else if (sortBy === 'newest') {
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (sortBy === 'alpha') {
      list.sort((a, b) => (a.word_text || '').localeCompare(b.word_text || '', 'ja'));
    }
    return list;
  }, [vocab, search, sortBy]);

  const reviewWords = vocab.filter(v => new Date(v.next_review_at) <= new Date());
  const currentWord = reviewWords[reviewIdx];

  // 브라우저 알림 요청 — 복습 단어 있을 때만
  useEffect(() => {
    if (!reviewWords.length || Notification.permission !== 'default') return;
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') {
        new Notification('Anatomy Studio', {
          body: `오늘 복습할 단어가 ${reviewWords.length}개 있어요! 🧠`,
          icon: '/icon.svg',
        });
      }
    });
  }, [reviewWords.length]);

  const handleScore = (rating) => {
    if (!currentWord) return;
    const nextStats = calculateFSRS(rating, {
      interval: currentWord.interval,
      ease_factor: currentWord.ease_factor,
      repetitions: currentWord.repetitions,
      next_review_at: currentWord.next_review_at,
    });
    scoreMutation.mutate({ id: currentWord.id, nextStats });

    if (reviewIdx < reviewWords.length - 1) {
      setReviewIdx(i => i + 1);
      setShowAnswer(false);
    } else {
      setReviewFinished(true);
      toast('🎉 오늘의 복습 완료!', 'celebrate', 5000);
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
      {/* 복습 리마인더 배너 */}
      {!isLoading && reviewWords.length > 0 && tab === 'list' && (
        <div className="review-reminder-banner">
          <div className="review-reminder-banner__left">
            <span className="review-reminder-banner__icon">🔔</span>
            <span>오늘 복습할 단어가 <strong>{reviewWords.length}개</strong> 있어요!</span>
          </div>
          <button onClick={startReview} className="btn btn--primary btn--sm">
            지금 복습하기
          </button>
        </div>
      )}

      <div className="page-header page-header--row">
        <div>
          <h1 className="page-header__title">⭐ 내 단어장</h1>
          <p className="page-header__subtitle">FSRS v4 알고리즘으로 과학적인 복습을 경험하세요</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {vocab.length > 0 && (
            <Button onClick={() => exportCSV(vocab)} variant="secondary" size="sm">
              📥 CSV 내보내기
            </Button>
          )}
          {tab === 'list' && reviewWords.length > 0 && (
            <Button onClick={startReview} variant="primary">
              🧠 복습 시작하기 ({reviewWords.length})
            </Button>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="tab-pills" style={{ marginBottom: '24px' }}>
        <button
          onClick={() => setTab('list')}
          className={`tab-pills__item ${tab === 'list' ? 'tab-pills__item--primary' : ''}`}
        >
          🗂️ 어휘 목록
        </button>
        <button
          onClick={() => setTab('review')}
          className={`tab-pills__item ${tab === 'review' ? 'tab-pills__item--accent' : ''}`}
        >
          🧠 오늘 복습
        </button>
        <button
          onClick={() => setTab('stats')}
          className={`tab-pills__item ${tab === 'stats' ? 'tab-pills__item--primary' : ''}`}
        >
          📊 학습 통계
        </button>
      </div>

      {isLoading ? (
        <Spinner message="단어들을 불러오는 중..." />
      ) : tab === 'list' ? (
        <>
          {/* 검색 + 정렬 */}
          <div className="filter-row" style={{ marginBottom: '20px' }}>
            <div className="search-wrap" style={{ flex: 1 }}>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="단어, 의미, 후리가나 검색..."
                className="search-input"
              />
            </div>
            <div className="chip-group">
              {[
                { value: 'due', label: '복습 순' },
                { value: 'newest', label: '최신 순' },
                { value: 'alpha', label: '가나다 순' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSortBy(opt.value)}
                  className={`chip ${sortBy === opt.value ? 'chip--active' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="feature-grid">
            {filteredVocab.length > 0 ? filteredVocab.map(v => (
              <div key={v.id} className="card vocab-card">
                <div className="vocab-card__header">
                  <div>
                    {v.furigana && <div className="vocab-card__furigana">{v.furigana}</div>}
                    <h3 className="vocab-card__word">{v.word_text}</h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="badge" style={{ fontSize: '0.7rem' }}>{v.pos}</span>
                    <button
                      onClick={() => {
                        if (confirm(`"${v.word_text}" 를 단어장에서 삭제할까요?`)) {
                          deleteMutation.mutate(v.id);
                        }
                      }}
                      style={{
                        width: '26px', height: '26px', borderRadius: 'var(--radius-sm)',
                        background: 'transparent', border: '1px solid transparent',
                        color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all var(--transition-fast)',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                      title="삭제"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <p className="vocab-card__meaning">{v.meaning}</p>
                <div className="vocab-card__footer">
                  <span>다음 복습: {new Date(v.next_review_at).toLocaleDateString('ko-KR')}</span>
                  <span>💪 S: {v.interval.toFixed(1)} / D: {v.ease_factor.toFixed(1)}</span>
                </div>
              </div>
            )) : (
              <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                <p>{search ? '검색 결과가 없습니다.' : '아직 수집한 단어가 없습니다. 뷰어에서 단어를 클릭해 저장해보세요!'}</p>
              </div>
            )}
          </div>
        </>
      ) : tab === 'review' ? (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          {reviewFinished ? (
            <div className="card review-card review-card--center">
              <div className="review-card__emoji">🎉</div>
              <h2 style={{ marginBottom: '10px' }}>오늘의 복습 완료!</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>FSRS 알고리즘이 당신의 기억을 강화했습니다.</p>
              <Button onClick={() => setTab('list')}>단어장으로 돌아가기</Button>
            </div>
          ) : reviewWords.length > 0 ? (
            <div className="card review-card">
              <div className="review-card__progress">남은 단어: {reviewWords.length - reviewIdx}</div>
              <div className="review-card__body">
                <h2 className="review-card__word">{currentWord.word_text}</h2>
                {showAnswer && <p className="review-card__furigana">[{currentWord.furigana}]</p>}

                {showAnswer ? (
                  <div className="review-card__answer">
                    <p className="review-card__meaning">{currentWord.meaning}</p>
                    <div className="review-score-grid">
                      <button onClick={() => handleScore(1)} className="review-score-btn review-score-btn--again">다시 (Again)</button>
                      <button onClick={() => handleScore(2)} className="review-score-btn review-score-btn--hard">어려움 (Hard)</button>
                      <button onClick={() => handleScore(3)} className="review-score-btn review-score-btn--good">알맞음 (Good)</button>
                      <button onClick={() => handleScore(4)} className="review-score-btn review-score-btn--easy">쉬움 (Easy)</button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={() => setShowAnswer(true)}
                    style={{ marginTop: '40px', borderRadius: 'var(--radius-full)' }}
                  >
                    정답 확인하기
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="card review-card review-card--center">
              <div className="review-card__emoji">✅</div>
              <h2 style={{ marginBottom: '10px' }}>지금은 복습할 단어가 없어요</h2>
              <p style={{ color: 'var(--text-secondary)' }}>FSRS가 다음 복습 시점을 계산해 줄 거예요.</p>
            </div>
          )}
        </div>
      ) : (
        /* Stats Dashboard */
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card__label">전체 어휘 수</div>
            <div className="stat-card__value stat-card__value--primary">{vocab.length}</div>
            <div className="stat-card__sub">꾸준히 늘려가고 있어요!</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">마스터한 어휘</div>
            <div className="stat-card__value stat-card__value--accent">{vocab.filter(v => v.interval > 14).length}</div>
            <div className="stat-card__sub">안정도(S)가 14일 이상인 단어</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">기억 건강도</div>
            <div className="stat-card__value stat-card__value--green">
              {vocab.length > 0 ? (vocab.reduce((acc, curr) => acc + curr.interval, 0) / vocab.length).toFixed(1) : 0}d
            </div>
            <div className="stat-card__sub">평균 기억 안정도</div>
          </div>

          {/* Forecast Chart */}
          <div className="card" style={{ padding: '24px', gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '20px' }}>향후 7일 복습 스케줄</h3>
            <div className="forecast-chart">
              {[...Array(7)].map((_, i) => {
                const date = new Date();
                date.setDate(date.getDate() + i);
                const count = vocab.filter(v => new Date(v.next_review_at).toDateString() === date.toDateString()).length;
                const maxCount = Math.max(...[...Array(7)].map((_, k) => {
                  const d = new Date(); d.setDate(d.getDate() + k);
                  return vocab.filter(v => new Date(v.next_review_at).toDateString() === d.toDateString()).length;
                }), 1);

                return (
                  <div key={i} className="forecast-col">
                    <div
                      className="forecast-bar"
                      style={{
                        height: `${(count / maxCount) * 100}%`,
                        minHeight: count > 0 ? '4px' : '0',
                        background: i === 0 ? 'var(--accent)' : 'var(--primary-light)',
                      }}
                    />
                    <div className="forecast-label">{i === 0 ? '오늘' : `${date.getMonth()+1}/${date.getDate()}`}</div>
                    {count > 0 && <div className="forecast-count">{count}</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* POS Distribution */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '20px' }}>🏷️ 어휘 구성</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.entries(
                vocab.reduce((acc, curr) => { acc[curr.pos] = (acc[curr.pos] || 0) + 1; return acc; }, {})
              ).map(([pos, count]) => (
                <div key={pos} className="pos-row">
                  <div className="pos-row__label">{pos || '기타'}</div>
                  <div className="pos-row__bar-wrap">
                    <div className="pos-row__bar" style={{ width: `${(count / vocab.length) * 100}%` }} />
                  </div>
                  <div className="pos-row__pct">{((count / vocab.length) * 100).toFixed(0)}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* Daily Goal */}
          <div className="card stat-card stat-card--goal">
            <h3 style={{ fontSize: '1.1rem', alignSelf: 'flex-start' }}>🎯 오늘의 목표</h3>
            <div className="goal-ring-wrap">
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
              <div className="goal-ring-label">
                <div className="goal-ring-label__count">
                  {vocab.filter(v => new Date(v.created_at).toDateString() === new Date().toDateString()).length}
                </div>
                <div className="goal-ring-label__sub">목표 5개</div>
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
              오늘 수집한 새로운 단어
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
