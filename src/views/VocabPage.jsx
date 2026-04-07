'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { calculateFSRS } from '../lib/fsrs';
import { recordActivity } from '../lib/streak';
import { awardXP, XP_REWARDS } from '../lib/xp';
import { checkAndAwardAchievements } from '../lib/achievements';
import { useTTS } from '../lib/useTTS';
import { callGemini } from '../lib/gemini';
import Button from '../components/Button';
import ConfirmModal from '../components/ConfirmModal';

// JLPT / CEFR 목표 어휘 수 (학습 연구 기반 추정치)
const LEVEL_MILESTONES = {
  Japanese: { 'N5 기초': 800, 'N4 기본': 1500, 'N3 중급': 3750, 'N2 상급': 6000, 'N1 심화': 10000 },
  English:  { 'A1 기초': 500, 'A2 초급': 1000, 'B1 중급': 2000, 'B2 상급': 4000, 'C1 고급': 7000, 'C2 마스터': 10000 },
};

function detectLang(word) {
  return /[\u3040-\u30ff\u4e00-\u9fff]/.test(word) ? 'Japanese' : 'English';
}

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
    (v.interval ?? 0).toFixed(1),
    (v.ease_factor ?? 0).toFixed(1),
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

/** 플래시카드·타이핑 모드 공통 점수 버튼 섹션 */
function ScoreSection({ word, onScore }) {
  return (
    <div className="review-card__answer">
      <p className="review-card__meaning">{word.meaning}</p>
      {word.source_sentence && (
        <p className="review-card__source">
          {word.source_sentence.split(word.word_text).map((part, i, arr) =>
            i < arr.length - 1
              ? <span key={i}>{part}<mark className="review-card__highlight">{word.word_text}</mark></span>
              : <span key={i}>{part}</span>
          )}
        </p>
      )}
      <p className="review-score-guide">기억이 얼마나 잘 됐나요?</p>
      <div className="review-score-grid">
        <button onClick={() => onScore(1)} className="review-score-btn review-score-btn--again" title="전혀 기억 못 했음 — 오늘 다시 나옴">다시<span className="review-score-btn__sub">기억 안 남</span></button>
        <button onClick={() => onScore(2)} className="review-score-btn review-score-btn--hard" title="겨우 떠올렸음 — 복습 간격 짧아짐">어려움<span className="review-score-btn__sub">겨우 생각남</span></button>
        <button onClick={() => onScore(3)} className="review-score-btn review-score-btn--good" title="정확히 기억했음 — 권장 선택">알맞음<span className="review-score-btn__sub">잘 기억함</span></button>
        <button onClick={() => onScore(4)} className="review-score-btn review-score-btn--easy" title="너무 쉬웠음 — 복습 간격 많이 늘어남">쉬움<span className="review-score-btn__sub">너무 쉬움</span></button>
      </div>
    </div>
  );
}

export default function VocabPage() {
  const { user, profile, fetchProfile } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { speak, supported: ttsSupported } = useTTS();
  const [tab, setTab] = useState('list');
  const [reviewIdx, setReviewIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewFinished, setReviewFinished] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('due'); // 'due' | 'newest' | 'alpha'
  const [langFilter, setLangFilter] = useState('all'); // 'all' | 'Japanese' | 'English'
  const [showHint, setShowHint] = useState(false);
  // 복습 모드: 'flash' | 'typing' | 'context'
  const [reviewMode, setReviewMode] = useState('flash');
  const [typingAnswer, setTypingAnswer] = useState('');
  const [contextSelected, setContextSelected] = useState(null); // 선택한 옵션 인덱스
  // AI 예문
  const exampleCacheRef = useRef(new Map()); // word_id → [{sentence, translation}]
  const [exampleLoading, setExampleLoading] = useState(false);
  const [exampleSentences, setExampleSentences] = useState(null);
  // 단어장 공유 덱
  const [deckModal, setDeckModal] = useState(false); // 덱 만들기 모달
  const [deckTitle, setDeckTitle] = useState('');
  const [deckLang, setDeckLang] = useState('Japanese');
  const [visibleCount, setVisibleCount] = useState(30);
  const [confirmAction, setConfirmAction] = useState(null); // { message, onConfirm }

  const { data: vocab = [], isLoading } = useQuery({
    queryKey: ['vocab', user?.id],
    queryFn: () => fetchVocab(user.id),
    enabled: !!user,
  });

  const { data: grammarNotes = [] } = useQuery({
    queryKey: ['grammar-notes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grammar_notes')
        .select('id, selected_text, explanation, created_at, reading_materials(title)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // 공개 덱 목록 (자신 제외 전체 + 자신 덱)
  const { data: publicDecks = [], refetch: refetchDecks } = useQuery({
    queryKey: ['vocab-decks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vocab_decks')
        .select('id, title, language, word_count, created_at, owner:profiles(display_name), owner_id')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: tab === 'decks',
  });

  const createDeckMutation = useMutation({
    mutationFn: async () => {
      if (!deckTitle.trim()) throw new Error('덱 이름을 입력하세요.');
      const words = vocab.filter(v =>
        (v.language === deckLang) || (!v.language && detectLang(v.word_text) === deckLang)
      );
      if (words.length === 0) throw new Error(`${deckLang} 단어가 없습니다.`);

      const { data: deck, error: deckErr } = await supabase
        .from('vocab_decks')
        .insert({ owner_id: user.id, title: deckTitle.trim(), language: deckLang, word_count: words.length })
        .select('id')
        .single();
      if (deckErr) throw deckErr;

      const rows = words.map(v => ({
        deck_id: deck.id,
        word_text: v.word_text,
        furigana: v.furigana || null,
        meaning: v.meaning || null,
        pos: v.pos || null,
      }));
      const { error: wordsErr } = await supabase.from('vocab_deck_words').insert(rows);
      if (wordsErr) throw wordsErr;
      return words.length;
    },
    onSuccess: (count) => {
      toast(`${count}개 단어로 덱을 공유했습니다!`, 'success');
      setDeckModal(false);
      setDeckTitle('');
      refetchDecks();
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const deleteDeckMutation = useMutation({
    mutationFn: async (deckId) => {
      const { error } = await supabase.from('vocab_decks').delete().eq('id', deckId).eq('owner_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => refetchDecks(),
    onError: (err) => toast('삭제 실패: ' + err.message, 'error'),
  });

  const importDeckMutation = useMutation({
    mutationFn: async (deckId) => {
      const { data: words, error } = await supabase
        .from('vocab_deck_words')
        .select('word_text, furigana, meaning, pos')
        .eq('deck_id', deckId);
      if (error) throw error;

      const rows = words.map(w => ({
        user_id: user.id,
        word_text: w.word_text,
        furigana: w.furigana || '',
        meaning: w.meaning || '',
        pos: w.pos || '',
        language: deckLang,
        interval: 0, ease_factor: 0, repetitions: 0,
        next_review_at: new Date().toISOString(),
      }));
      const { error: importErr } = await supabase
        .from('user_vocabulary')
        .upsert(rows, { onConflict: 'user_id,word_text' });
      if (importErr) throw importErr;
      return words.length;
    },
    onSuccess: (count) => {
      toast(`${count}개 단어를 내 단어장에 추가했습니다!`, 'success');
      queryClient.invalidateQueries({ queryKey: ['vocab', user?.id] });
    },
    onError: (err) => toast('가져오기 실패: ' + err.message, 'error'),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId) => {
      const { error } = await supabase.from('grammar_notes').delete().eq('id', noteId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grammar-notes', user?.id] }),
    onError: (err) => toast('삭제 실패: ' + err.message, 'error'),
  });

  const scoreMutation = useMutation({
    mutationFn: async ({ id, nextStats }) => {
      const payload = { ...nextStats, last_reviewed_at: new Date().toISOString() };
      const { error } = await supabase
        .from('user_vocabulary')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocab', user?.id] });
      awardXP(user.id, XP_REWARDS.WORD_REVIEWED, profile?.xp ?? 0);
      checkAndAwardAchievements(user.id, { xp: profile?.xp, streak: profile?.streak_count }).then(newBadges => {
        newBadges.forEach(b => toast(`🏅 새 뱃지 획득: ${b.icon} ${b.name}`, 'celebrate', 5000));
      });
    },
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
    if (langFilter !== 'all') {
      list = list.filter(v => v.language === langFilter);
    }
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
  }, [vocab, search, sortBy, langFilter]);

  // 필터 변경 시 표시 개수 리셋
  useEffect(() => { setVisibleCount(30); }, [search, sortBy, langFilter]);

  const reviewWords = vocab.filter(v => new Date(v.next_review_at) <= new Date());
  const currentWord = reviewWords[reviewIdx];

  // 문맥 퀴즈용 객관식 보기 (정답 1 + 오답 3)
  const contextOptions = useMemo(() => {
    if (!currentWord) return [];
    const others = vocab.filter(v => v.id !== currentWord.id && v.meaning);
    const shuffled = [...others].sort(() => Math.random() - 0.5).slice(0, 3);
    return [...shuffled, currentWord].sort(() => Math.random() - 0.5);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewIdx, currentWord?.id]);

  // 브라우저 알림 — "복습 시작하기" 클릭 시에만 권한 요청 (startReview에서 호출)

  const handleScore = (rating) => {
    if (!currentWord) return;
    const nextStats = calculateFSRS(rating, {
      interval: currentWord.interval ?? 0,
      ease_factor: currentWord.ease_factor ?? 0,
      repetitions: currentWord.repetitions ?? 0,
      next_review_at: currentWord.next_review_at,
    });
    scoreMutation.mutate({ id: currentWord.id, nextStats });
    recordActivity(user.id, () => fetchProfile(user.id));
    goNextReview();
  };

  const handleSkip = () => {
    if (!currentWord) return;
    // 내일로 미루기
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    scoreMutation.mutate({ id: currentWord.id, nextStats: { next_review_at: tomorrow.toISOString() } });
    goNextReview();
  };

  // 단어 바뀔 때 예문 초기화
  useEffect(() => {
    setExampleSentences(null);
    setExampleLoading(false);
  }, [currentWord?.id]);

  async function loadExamples() {
    if (!currentWord) return;
    const cached = exampleCacheRef.current.get(currentWord.id);
    if (cached) { setExampleSentences(cached); return; }
    setExampleLoading(true);
    try {
      const lang = currentWord.language || detectLang(currentWord.word_text);
      const prompt = `단어: ${currentWord.word_text}\n언어: ${lang}\n의미: ${currentWord.meaning || ''}\n\n이 단어를 자연스럽게 활용한 예문 2개를 만들어주세요. 학습자가 문맥 속에서 단어를 익힐 수 있도록 간결하고 자연스러운 문장으로 작성해주세요.\n\n반드시 아래 JSON 형식으로만 응답하세요:\n{"examples":[{"sentence":"...","translation":"한국어 번역"},{"sentence":"...","translation":"한국어 번역"}]}`;
      const raw = await callGemini(prompt);
      const clean = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean.substring(clean.indexOf('{'), clean.lastIndexOf('}') + 1));
      exampleCacheRef.current.set(currentWord.id, parsed.examples);
      setExampleSentences(parsed.examples);
    } catch {
      toast('예문 생성에 실패했어요.', 'error');
    } finally {
      setExampleLoading(false);
    }
  }

  const goNextReview = () => {
    setShowHint(false);
    setTypingAnswer('');
    setContextSelected(null);
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
    setTypingAnswer('');
    setContextSelected(null);
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  if (!user) {
    return (
      <div className="page-container mypage-guest">
        <h2>로그인이 필요한 페이지입니다</h2>
        <Link href="/auth" className="btn btn--primary btn--md">로그인하러 가기</Link>
      </div>
    );
  }

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
          {vocab.length > 0 ? (
            <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <span>총 <strong style={{ color: 'var(--text-primary)' }}>{vocab.length}</strong>개</span>
              <span>·</span>
              <span style={{ color: reviewWords.length > 0 ? 'var(--danger)' : 'var(--accent)' }}>
                {reviewWords.length > 0 ? `${reviewWords.length}개 복습 대기` : '모두 완료'}
              </span>
              <span>·</span>
              <span>숙련 {vocab.filter(v => v.interval >= 30).length}개</span>
            </div>
          ) : (
            <p className="page-header__subtitle">FSRS v4 알고리즘으로 과학적인 복습을 경험하세요</p>
          )}
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
        <button
          onClick={() => setTab('notes')}
          className={`tab-pills__item ${tab === 'notes' ? 'tab-pills__item--accent' : ''}`}
        >
          📝 문법 노트 {grammarNotes.length > 0 && <span className="tab-badge">{grammarNotes.length}</span>}
        </button>
        <button
          onClick={() => setTab('decks')}
          className={`tab-pills__item ${tab === 'decks' ? 'tab-pills__item--primary' : ''}`}
        >
          🃏 공유 단어장
        </button>
      </div>

      {isLoading ? (
        <div className="skeleton-grid">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="skeleton--card" style={{ height: 120 }}>
              <div className="skeleton-line--short skeleton-line" />
              <div className="skeleton-line--title skeleton-line" style={{ width: '60%' }} />
              <div className="skeleton-line--text skeleton-line" />
            </div>
          ))}
        </div>
      ) : tab === 'list' ? (
        <>
          {/* 검색 + 필터 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            <div className="filter-row">
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
            <div className="chip-group">
              {[
                { value: 'all', label: '🌍 전체' },
                { value: 'Japanese', label: '🇯🇵 일본어' },
                { value: 'English', label: '🇬🇧 영어' },
              ].map(f => (
                <button
                  key={f.value}
                  onClick={() => setLangFilter(f.value)}
                  className={`chip ${langFilter === f.value ? 'chip--active' : ''}`}
                >
                  {f.label}
                </button>
              ))}
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
                {filteredVocab.length}개
              </span>
            </div>
          </div>

          <div className="feature-grid">
            {filteredVocab.length > 0 ? filteredVocab.slice(0, visibleCount).map(v => (
              <div key={v.id} className="card vocab-card">
                <div className="vocab-card__header">
                  <div>
                    {v.furigana && <div className="vocab-card__furigana">{v.furigana}</div>}
                    <h3 className="vocab-card__word">{v.word_text}</h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="badge" style={{ fontSize: '0.7rem' }}>{v.pos}</span>
                    {ttsSupported && (
                      <button
                        onClick={() => speak(v.word_text, v.language || detectLang(v.word_text))}
                        title="발음 듣기"
                        style={{
                          width: '26px', height: '26px', borderRadius: 'var(--radius-sm)',
                          background: 'transparent', border: '1px solid var(--border)',
                          color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        🔊
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmAction({
                        message: `"${v.word_text}" 를 단어장에서 삭제할까요?`,
                        onConfirm: () => { deleteMutation.mutate(v.id); setConfirmAction(null); },
                      })}
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
                  <span>{new Date(v.next_review_at) <= new Date()
                    ? '🔴 복습 필요'
                    : `📅 ${new Date(v.next_review_at).toLocaleDateString('ko-KR')}`}
                  </span>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: v.interval >= 30 ? 'rgba(74,138,92,0.15)' : v.interval >= 7 ? 'rgba(252,196,25,0.15)' : 'rgba(255,107,107,0.1)',
                    color: v.interval >= 30 ? 'var(--accent)' : v.interval >= 7 ? 'var(--warning)' : 'var(--danger)',
                    fontWeight: 600,
                  }}>
                    {v.interval >= 30 ? '숙련' : v.interval >= 7 ? '학습 중' : '초기'}
                  </span>
                </div>
              </div>
            )) : (
              <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                <div className="empty-state__icon">{search ? '🔍' : '⭐'}</div>
                <p className="empty-state__msg">
                  {search
                    ? '검색 결과가 없습니다.'
                    : '아직 수집한 단어가 없어요'}
                </p>
                {!search && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: 320 }}>
                      자료를 읽으면서 모르는 단어를 탭하면<br />자동으로 단어장에 추가돼요
                    </p>
                    <Link href="/materials" className="btn btn--primary btn--md">
                      📰 자료 읽으러 가기 →
                    </Link>
                  </div>
                )}
                {search && (
                  <button className="empty-state__link" onClick={() => setSearch('')}>
                    검색어 지우기
                  </button>
                )}
              </div>
            )}
          </div>
          {filteredVocab.length > visibleCount && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Button variant="secondary" onClick={() => setVisibleCount(c => c + 30)}>
                더 보기 ({filteredVocab.length - visibleCount}개 남음)
              </Button>
            </div>
          )}
        </>
      ) : tab === 'review' ? (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          {reviewFinished ? (
            <div className="card review-card review-card--center">
              <div className="review-card__emoji">🎉</div>
              <h2 style={{ marginBottom: '10px' }}>오늘의 복습 완료!</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>FSRS 알고리즘이 당신의 기억을 강화했습니다.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 280 }}>
                <Link href="/materials" className="btn btn--primary btn--md" style={{ textAlign: 'center' }}>
                  📖 자료 읽으러 가기
                </Link>
                <Link href="/leaderboard" className="btn btn--secondary btn--md" style={{ textAlign: 'center' }}>
                  🏆 랭킹 확인하기
                </Link>
                <Button variant="ghost" onClick={() => setTab('list')}>
                  단어장으로 돌아가기
                </Button>
              </div>
            </div>
          ) : reviewWords.length > 0 ? (
            <>
              {/* 복습 모드 선택 */}
              <div className="chip-group" style={{ marginBottom: '16px', justifyContent: 'center' }}>
                {[
                  { value: 'flash',   label: '🃏 플래시카드' },
                  { value: 'typing',  label: '✏️ 타이핑' },
                  { value: 'context', label: '📝 문맥 퀴즈' },
                ].map(m => (
                  <button
                    key={m.value}
                    onClick={() => {
                      setReviewMode(m.value);
                      setTypingAnswer('');
                      setContextSelected(null);
                      setShowAnswer(false);
                      setShowHint(false);
                    }}
                    className={`chip ${reviewMode === m.value ? 'chip--active' : ''}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="card review-card">
                <div className="review-card__progress">
                  <span>남은 단어: {reviewWords.length - reviewIdx}</span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {reviewMode === 'flash' && !showAnswer && currentWord?.source_sentence && (
                      <button className="review-hint-btn" onClick={() => setShowHint(h => !h)}>
                        {showHint ? '힌트 숨기기' : '💡 힌트'}
                      </button>
                    )}
                    <button className="review-skip-btn" onClick={() => { setShowHint(false); handleSkip(); }} title="내일로 미루기">
                      스킵 →
                    </button>
                  </div>
                </div>

                <div className="review-card__body">
                  {/* ── 단어 헤더 (문맥 퀴즈는 정답 공개 전까지 숨김) ── */}
                  {currentWord && (reviewMode !== 'context' || showAnswer) && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                      <h2 className="review-card__word">{currentWord.word_text}</h2>
                      {ttsSupported && (
                        <button
                          onClick={() => speak(currentWord.word_text, currentWord.language || detectLang(currentWord.word_text))}
                          title="발음 듣기"
                          style={{
                            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-full)', padding: '4px 10px',
                            fontSize: '0.9rem', cursor: 'pointer', color: 'var(--text-secondary)',
                          }}
                        >
                          🔊
                        </button>
                      )}
                    </div>
                  )}

                  {showAnswer && currentWord.furigana && (
                    <p className="review-card__furigana">[{currentWord.furigana}]</p>
                  )}

                  {/* ── 플래시카드 모드 ── */}
                  {reviewMode === 'flash' && (
                    <>
                      {!showAnswer && showHint && currentWord.source_sentence && (
                        <p className="review-card__hint">
                          {currentWord.source_sentence.split(currentWord.word_text).map((part, i, arr) => (
                            i < arr.length - 1
                              ? <span key={i}>{part}<mark className="review-card__highlight review-card__highlight--hint">{currentWord.word_text}</mark></span>
                              : <span key={i}>{part}</span>
                          ))}
                        </p>
                      )}
                      {showAnswer ? (
                        <ScoreSection word={currentWord} onScore={handleScore} />
                      ) : (
                        <Button variant="secondary" size="lg" onClick={() => { setShowAnswer(true); setShowHint(false); }}
                          style={{ marginTop: '40px', borderRadius: 'var(--radius-full)' }}>
                          정답 확인하기
                        </Button>
                      )}
                    </>
                  )}

                  {/* ── 타이핑 모드 ── */}
                  {reviewMode === 'typing' && (
                    <>
                      {!showAnswer ? (
                        <div style={{ marginTop: '30px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <input
                            type="text"
                            value={typingAnswer}
                            onChange={e => setTypingAnswer(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && typingAnswer.trim() && setShowAnswer(true)}
                            placeholder="의미를 입력하세요..."
                            className="search-input"
                            autoFocus
                            style={{ fontSize: '1rem', textAlign: 'center' }}
                          />
                          <Button onClick={() => setShowAnswer(true)} disabled={!typingAnswer.trim()}>
                            확인하기 →
                          </Button>
                        </div>
                      ) : (
                        <div style={{ marginTop: '16px' }}>
                          {typingAnswer && (
                            <div style={{ marginBottom: '12px', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', fontSize: '0.9rem' }}>
                              <span style={{ color: 'var(--text-muted)' }}>내 답: </span>
                              <span>{typingAnswer}</span>
                            </div>
                          )}
                          <ScoreSection word={currentWord} onScore={handleScore} />
                        </div>
                      )}
                    </>
                  )}

                  {/* ── 문맥 퀴즈 모드 ── */}
                  {reviewMode === 'context' && (
                    <>
                      {/* 예문 (단어 블랭크) */}
                      <div style={{ marginBottom: '20px' }}>
                        {currentWord.source_sentence ? (
                          <p className="review-card__hint" style={{ fontSize: '1rem', lineHeight: 1.8 }}>
                            {currentWord.source_sentence.split(currentWord.word_text).map((part, i, arr) =>
                              i < arr.length - 1
                                ? <span key={i}>{part}<mark style={{ background: 'var(--bg-elevated)', color: 'transparent', borderRadius: '4px', padding: '0 4px' }}>{'　'.repeat(Math.max(2, currentWord.word_text.length))}</mark></span>
                                : <span key={i}>{part}</span>
                            )}
                          </p>
                        ) : (
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', textAlign: 'center', marginBottom: '8px' }}>
                            (예문 없음 — 의미를 선택하세요)
                          </p>
                        )}
                      </div>

                      {/* 객관식 보기 */}
                      {!showAnswer ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {contextOptions.map((opt, i) => (
                            <button
                              key={i}
                              disabled={contextSelected !== null}
                              onClick={() => {
                                setContextSelected(i);
                                const isCorrect = opt.id === currentWord.id;
                                if (isCorrect) {
                                  setTimeout(() => handleScore(3), 700);
                                }
                              }}
                              style={{
                                padding: '12px 16px',
                                background: contextSelected === null
                                  ? 'var(--bg-secondary)'
                                  : opt.id === currentWord.id
                                    ? 'rgba(74,138,92,0.25)'
                                    : contextSelected === i
                                      ? 'rgba(200,64,64,0.2)'
                                      : 'var(--bg-secondary)',
                                border: `1px solid ${
                                  contextSelected !== null && opt.id === currentWord.id
                                    ? 'var(--accent)'
                                    : 'var(--border)'
                                }`,
                                borderRadius: 'var(--radius-md)',
                                textAlign: 'left',
                                cursor: contextSelected !== null ? 'default' : 'pointer',
                                fontSize: '0.92rem',
                                color: 'var(--text-primary)',
                                transition: 'background 0.2s, border-color 0.2s',
                              }}
                            >
                              {opt.meaning}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <ScoreSection word={currentWord} onScore={handleScore} />
                      )}

                      {/* 오답 시 재시도 버튼 */}
                      {contextSelected !== null && contextOptions[contextSelected]?.id !== currentWord.id && !showAnswer && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                          <Button onClick={() => handleScore(1)} variant="secondary" style={{ flex: 1 }}>
                            다시 (Again)
                          </Button>
                          <Button onClick={() => { setShowAnswer(true); }} variant="ghost" style={{ flex: 1 }}>
                            정답 보기
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                  {/* ── AI 예문 (정답 공개 후 공통) ── */}
                  {(showAnswer || contextSelected !== null) && (
                    <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                      {exampleSentences ? (
                        <>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            ✨ AI 예문
                          </p>
                          {exampleSentences.map((ex, i) => (
                            <div key={i} style={{
                              marginBottom: '10px', padding: '10px 14px',
                              background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
                            }}>
                              <p style={{ fontSize: '0.95rem', marginBottom: '4px', lineHeight: 1.6 }}>{ex.sentence}</p>
                              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{ex.translation}</p>
                            </div>
                          ))}
                        </>
                      ) : (
                        <button
                          onClick={loadExamples}
                          disabled={exampleLoading}
                          style={{
                            width: '100%', padding: '8px',
                            background: 'none', border: '1px dashed var(--border)',
                            borderRadius: 'var(--radius-md)', cursor: exampleLoading ? 'default' : 'pointer',
                            color: 'var(--text-muted)', fontSize: '0.85rem',
                            opacity: exampleLoading ? 0.6 : 1,
                          }}
                        >
                          {exampleLoading ? '예문 생성 중...' : '✨ AI 예문 보기'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="card review-card review-card--center">
              <div className="review-card__emoji">{vocab.length === 0 ? '⭐' : '✅'}</div>
              <h2 style={{ marginBottom: '10px' }}>
                {vocab.length === 0 ? '단어를 먼저 수집해볼까요?' : '지금은 복습할 단어가 없어요'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                {vocab.length === 0
                  ? '자료를 읽으면서 모르는 단어를 탭하면 자동 저장돼요'
                  : 'FSRS가 다음 복습 시점을 계산해 줄 거예요.'}
              </p>
              {vocab.length === 0 && (
                <Link href="/materials" className="btn btn--primary btn--md">📰 자료 읽으러 가기</Link>
              )}
            </div>
          )}
        </div>
      ) : tab === 'stats' ? (
        /* Stats Dashboard */
        <div className="stats-grid">
          {/* 레벨 진행도 */}
          {(() => {
            const langs = profile?.learning_language || [];
            const cards = [];

            if (langs.includes('Japanese') || vocab.some(v => (v.language === 'Japanese') || detectLang(v.word_text) === 'Japanese')) {
              const jpVocab = vocab.filter(v => (v.language === 'Japanese') || (!v.language && detectLang(v.word_text) === 'Japanese'));
              const targetLevel = profile?.learning_level_japanese || 'N3 중급';
              const target = LEVEL_MILESTONES.Japanese[targetLevel] || 3750;
              const pct = Math.min(100, Math.round((jpVocab.length / target) * 100));
              cards.push(
                <div key="jp" className="card" style={{ padding: '20px', gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                    <h3 style={{ fontSize: '1rem' }}>🇯🇵 일본어 레벨 진행도 — {targetLevel}</h3>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{jpVocab.length} / {target.toLocaleString('ko-KR')}개</span>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-full)', height: '10px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--primary-light)', borderRadius: 'var(--radius-full)', transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <span>{pct}% 달성</span>
                    <span>목표까지 {Math.max(0, target - jpVocab.length).toLocaleString('ko-KR')}개 남음</span>
                  </div>
                </div>
              );
            }

            if (langs.includes('English') || vocab.some(v => (v.language === 'English') || (!v.language && detectLang(v.word_text) === 'English'))) {
              const enVocab = vocab.filter(v => (v.language === 'English') || (!v.language && detectLang(v.word_text) === 'English'));
              const targetLevel = profile?.learning_level_english || 'B1 중급';
              const target = LEVEL_MILESTONES.English[targetLevel] || 2000;
              const pct = Math.min(100, Math.round((enVocab.length / target) * 100));
              cards.push(
                <div key="en" className="card" style={{ padding: '20px', gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                    <h3 style={{ fontSize: '1rem' }}>🇬🇧 영어 레벨 진행도 — {targetLevel}</h3>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{enVocab.length} / {target.toLocaleString('ko-KR')}개</span>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-full)', height: '10px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 'var(--radius-full)', transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <span>{pct}% 달성</span>
                    <span>목표까지 {Math.max(0, target - enVocab.length).toLocaleString('ko-KR')}개 남음</span>
                  </div>
                </div>
              );
            }

            return cards.length > 0 ? cards : null;
          })()}
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
              {vocab.length > 0 ? (vocab.reduce((acc, curr) => acc + (curr.interval ?? 0), 0) / vocab.length).toFixed(1) : 0}d
            </div>
            <div className="stat-card__sub">평균 기억 안정도</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">총 실수 횟수</div>
            <div className="stat-card__value" style={{ color: 'var(--danger)' }}>
              {vocab.reduce((acc, curr) => acc + (curr.repetitions || 0), 0)}
            </div>
            <div className="stat-card__sub">Again 누적 횟수</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">어려운 단어</div>
            <div className="stat-card__value" style={{ color: 'var(--warning, #f59e0b)' }}>
              {vocab.filter(v => (v.repetitions || 0) > 2).length}
            </div>
            <div className="stat-card__sub">3번 이상 틀린 단어</div>
          </div>

          {/* Hard Words List */}
          {vocab.filter(v => (v.repetitions || 0) > 2).length > 0 && (
            <div className="card" style={{ padding: '24px', gridColumn: '1 / -1' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>🔥 요주의 단어 TOP 5</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[...vocab]
                  .filter(v => (v.repetitions || 0) > 0)
                  .sort((a, b) => (b.repetitions || 0) - (a.repetitions || 0) || (a.interval ?? 0) - (b.interval ?? 0))
                  .slice(0, 5)
                  .map(v => (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem', minWidth: '80px' }}>{v.word_text}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', flex: 1 }}>{v.meaning}</span>
                      <span style={{
                        fontSize: '0.78rem', fontWeight: 600,
                        color: (v.repetitions || 0) > 4 ? 'var(--danger)' : 'var(--warning, #f59e0b)',
                        background: 'var(--bg-secondary)', borderRadius: '99px', padding: '2px 10px'
                      }}>
                        Again {v.repetitions ?? 0}회
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>안정도 {(v.interval ?? 0).toFixed(1)}d</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Difficulty Distribution */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>📊 난이도 분포</h3>
            {(() => {
              const easy = vocab.filter(v => (v.ease_factor || 0) < 4).length;
              const medium = vocab.filter(v => (v.ease_factor || 0) >= 4 && (v.ease_factor || 0) <= 7).length;
              const hard = vocab.filter(v => (v.ease_factor || 0) > 7).length;
              const total = vocab.length || 1;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { label: '쉬움', count: easy, color: 'var(--primary)' },
                    { label: '보통', count: medium, color: 'var(--accent)' },
                    { label: '어려움', count: hard, color: 'var(--danger)' },
                  ].map(({ label, count, color }) => (
                    <div key={label} className="pos-row">
                      <div className="pos-row__label">{label}</div>
                      <div className="pos-row__bar-wrap">
                        <div className="pos-row__bar" style={{ width: `${(count / total) * 100}%`, background: color }} />
                      </div>
                      <div className="pos-row__pct">{count}개</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* 어휘 성장 그래프 — 최근 8주 */}
          {vocab.length > 0 && (() => {
            const WEEKS = 8;
            const now = new Date();
            const weekData = Array.from({ length: WEEKS }, (_, i) => {
              const weekStart = new Date(now);
              weekStart.setDate(now.getDate() - (WEEKS - 1 - i) * 7 - now.getDay());
              weekStart.setHours(0, 0, 0, 0);
              const weekEnd = new Date(weekStart);
              weekEnd.setDate(weekStart.getDate() + 7);
              const count = vocab.filter(v => {
                const d = new Date(v.created_at);
                return d >= weekStart && d < weekEnd;
              }).length;
              const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
              return { label, count };
            });

            const maxVal = Math.max(...weekData.map(w => w.count), 1);
            const W = 500, H = 120, PAD = 32;
            const stepX = (W - PAD * 2) / (WEEKS - 1);
            const points = weekData.map((w, i) => ({
              x: PAD + i * stepX,
              y: PAD + (1 - w.count / maxVal) * (H - PAD * 2),
              ...w,
            }));
            const polyline = points.map(p => `${p.x},${p.y}`).join(' ');
            const totalNew = weekData.reduce((s, w) => s + w.count, 0);

            return (
              <div className="card" style={{ padding: '24px', gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '1.1rem' }}>📈 어휘 성장 추이</h3>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>최근 8주 +{totalNew}개</span>
                </div>
                <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}>
                  {/* 가로 격자선 */}
                  {[0.25, 0.5, 0.75, 1].map(r => (
                    <line key={r}
                      x1={PAD} y1={PAD + (1 - r) * (H - PAD * 2)}
                      x2={W - PAD} y2={PAD + (1 - r) * (H - PAD * 2)}
                      stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4"
                    />
                  ))}
                  {/* 채움 영역 */}
                  <polygon
                    points={`${points[0].x},${H - PAD} ${polyline} ${points[points.length-1].x},${H - PAD}`}
                    fill="var(--primary-glow)"
                  />
                  {/* 선 */}
                  <polyline points={polyline} fill="none" stroke="var(--primary-light)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                  {/* 점 + 레이블 */}
                  {points.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r="4" fill="var(--primary-light)" />
                      {p.count > 0 && (
                        <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="10" fill="var(--primary-light)" fontWeight="700">{p.count}</text>
                      )}
                      <text x={p.x} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--text-muted)">{p.label}</text>
                    </g>
                  ))}
                </svg>
              </div>
            );
          })()}

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
      ) : tab === 'notes' ? (
        <div className="grammar-notes-list">
          {grammarNotes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">📝</div>
              <p className="empty-state__msg">저장된 문법 노트가 없습니다.<br />뷰어에서 문장을 드래그해 AI 해설을 받고 저장해보세요!</p>
            </div>
          ) : grammarNotes.map(note => (
            <div key={note.id} className="grammar-note-card">
              <div className="grammar-note-card__header">
                <span className="grammar-note-card__text">"{note.selected_text}"</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                  {note.reading_materials && (
                    <span className="grammar-note-card__source">{note.reading_materials.title}</span>
                  )}
                  <button
                    className="grammar-note-card__delete"
                    onClick={() => deleteNoteMutation.mutate(note.id)}
                    title="삭제"
                  >✕</button>
                </div>
              </div>
              <div className="grammar-note-card__explanation">
                {note.explanation.split('\n').slice(0, 4).map((line, i) => {
                  if (!line.trim()) return null;
                  const formatted = line
                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                    .replace(/`(.+?)`/g, '<code>$1</code>');
                  return <p key={i} dangerouslySetInnerHTML={{ __html: formatted }} style={{ margin: '2px 0', fontSize: '0.88rem', lineHeight: 1.6 }} />;
                })}
              </div>
              <div className="grammar-note-card__footer">
                {new Date(note.created_at).toLocaleDateString('ko-KR')}
              </div>
            </div>
          ))}
        </div>
      ) : tab === 'decks' ? (
        <div>
          {/* 헤더 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              내 단어장을 공유하거나 다른 사람의 덱을 가져와 복습하세요.
            </p>
            {user && (
              <Button size="sm" onClick={() => setDeckModal(true)}>
                + 덱 공유하기
              </Button>
            )}
          </div>

          {/* 덱 만들기 모달 */}
          {deckModal && (
            <div className="card" style={{ marginBottom: '24px', padding: '20px', border: '1px solid var(--primary-glow)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '16px' }}>내 단어장 공유하기</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="form-label">덱 이름</label>
                  <input
                    className="search-input"
                    value={deckTitle}
                    onChange={e => setDeckTitle(e.target.value)}
                    placeholder="예: N3 필수 어휘 200개"
                    maxLength={80}
                  />
                </div>
                <div>
                  <label className="form-label">언어</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['Japanese', 'English'].map(lang => (
                      <button
                        key={lang}
                        onClick={() => setDeckLang(lang)}
                        className={`chip ${deckLang === lang ? 'chip--active' : ''}`}
                      >
                        {lang === 'Japanese' ? '🇯🇵 일본어' : '🇬🇧 영어'}
                      </button>
                    ))}
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                    {vocab.filter(v => (v.language === deckLang) || (!v.language && detectLang(v.word_text) === deckLang)).length}개 단어가 포함됩니다
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button onClick={() => createDeckMutation.mutate()} disabled={!deckTitle.trim() || createDeckMutation.isPending}>
                    {createDeckMutation.isPending ? '공유 중...' : '공유'}
                  </Button>
                  <Button variant="ghost" onClick={() => { setDeckModal(false); setDeckTitle(''); }}>취소</Button>
                </div>
              </div>
            </div>
          )}

          {/* 덱 목록 */}
          {publicDecks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">🃏</div>
              <p className="empty-state__msg">아직 공유된 단어장이 없습니다.<br />첫 번째로 덱을 공유해보세요!</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {publicDecks.map(deck => {
                const isOwn = deck.owner_id === user?.id;
                return (
                  <div key={deck.id} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.85rem' }}>{deck.language === 'Japanese' ? '🇯🇵' : '🇬🇧'}</span>
                        <h4 style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {deck.title}
                        </h4>
                        {isOwn && <span style={{ fontSize: '0.72rem', background: 'var(--primary-glow)', color: 'var(--primary-light)', padding: '1px 6px', borderRadius: 'var(--radius-full)' }}>내 덱</span>}
                      </div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                        {deck.owner?.display_name || '익명'} · {deck.word_count}개 단어 · {new Date(deck.created_at).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      {!isOwn && user && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={importDeckMutation.isPending}
                          onClick={() => importDeckMutation.mutate(deck.id)}
                        >
                          가져오기
                        </Button>
                      )}
                      {isOwn && (
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={deleteDeckMutation.isPending}
                          onClick={() => setConfirmAction({
                            message: `"${deck.title}" 덱을 삭제할까요?`,
                            onConfirm: () => { deleteDeckMutation.mutate(deck.id); setConfirmAction(null); },
                          })}
                        >
                          삭제
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      <ConfirmModal
        open={!!confirmAction}
        message={confirmAction?.message}
        onConfirm={confirmAction?.onConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
