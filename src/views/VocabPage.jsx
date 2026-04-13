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
import { useCelebration } from '../lib/CelebrationContext';
import { useTTS } from '../lib/useTTS';
import { callGemini } from '../lib/gemini';
import Button from '../components/Button';
import ConfirmModal from '../components/ConfirmModal';
import VocabList from './VocabList';
import VocabReview from './VocabReview';
import VocabStats from './VocabStats';
import VocabNotes from './VocabNotes';
import VocabDecks from './VocabDecks';

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

function VocabDetailCard({ word: v, onClose, speak, ttsSupported }) {
  const now = new Date();
  const created = new Date(v.created_at);
  const daysSinceCreated = Math.max(1, Math.round((now - created) / 86400000));
  const nextReview = new Date(v.next_review_at);
  const isDue = nextReview <= now;
  const interval = v.interval ?? 0;
  const reps = v.repetitions ?? 0;
  const ease = v.ease_factor ?? 0;
  const retention = Math.round(Math.exp(-1 / Math.max(interval, 0.5)) * 100);

  const stageLabel = interval >= 30 ? '숙련' : interval >= 7 ? '학습 중' : interval >= 1 ? '초기' : '신규';
  const stageColor = interval >= 30 ? 'var(--accent)' : interval >= 7 ? 'var(--warning)' : 'var(--danger)';

  return (
    <div className="vocab-detail-overlay" onClick={onClose}>
      <div className="vocab-detail-card" onClick={e => e.stopPropagation()}>
        <button className="vocab-detail-card__close" onClick={onClose}>✕</button>

        <div className="vocab-detail-card__header">
          {v.furigana && <span className="vocab-detail-card__furigana">{v.furigana}</span>}
          <h2 className="vocab-detail-card__word">
            {v.word_text}
            {ttsSupported && (
              <button className="vocab-detail-card__tts" onClick={() => speak(v.word_text, v.language || 'Japanese')}>🔊</button>
            )}
          </h2>
          <p className="vocab-detail-card__meaning">{v.meaning}</p>
          <div className="vocab-detail-card__badges">
            <span className="badge">{v.pos}</span>
            <span className="badge" style={{ background: `color-mix(in srgb, ${stageColor} 15%, transparent)`, color: stageColor }}>
              {stageLabel}
            </span>
          </div>
        </div>

        <div className="vocab-detail-card__stats">
          <div className="vocab-detail-stat">
            <span className="vocab-detail-stat__icon">🔄</span>
            <span className="vocab-detail-stat__value">{reps}회</span>
            <span className="vocab-detail-stat__label">복습 횟수</span>
          </div>
          <div className="vocab-detail-stat">
            <span className="vocab-detail-stat__icon">📏</span>
            <span className="vocab-detail-stat__value">{interval < 1 ? '<1일' : `${Math.round(interval)}일`}</span>
            <span className="vocab-detail-stat__label">복습 간격</span>
          </div>
          <div className="vocab-detail-stat">
            <span className="vocab-detail-stat__icon">🧠</span>
            <span className="vocab-detail-stat__value">{retention}%</span>
            <span className="vocab-detail-stat__label">기억 강도</span>
          </div>
          <div className="vocab-detail-stat">
            <span className="vocab-detail-stat__icon">⚙️</span>
            <span className="vocab-detail-stat__value">{ease.toFixed(1)}</span>
            <span className="vocab-detail-stat__label">난이도</span>
          </div>
        </div>

        {/* 학습 타임라인 */}
        <div className="vocab-detail-card__timeline">
          <h3 className="vocab-detail-card__section-title">학습 여정</h3>
          <div className="vocab-detail-timeline">
            <div className="vocab-detail-timeline__item">
              <span className="vocab-detail-timeline__dot" style={{ background: 'var(--primary)' }} />
              <span className="vocab-detail-timeline__date">{created.toLocaleDateString('ko-KR')}</span>
              <span className="vocab-detail-timeline__event">단어 수집</span>
            </div>
            {reps > 0 && v.last_reviewed_at && (
              <div className="vocab-detail-timeline__item">
                <span className="vocab-detail-timeline__dot" style={{ background: 'var(--accent)' }} />
                <span className="vocab-detail-timeline__date">{new Date(v.last_reviewed_at).toLocaleDateString('ko-KR')}</span>
                <span className="vocab-detail-timeline__event">마지막 복습 ({reps}회차)</span>
              </div>
            )}
            <div className="vocab-detail-timeline__item">
              <span className="vocab-detail-timeline__dot" style={{ background: isDue ? 'var(--danger)' : 'var(--warning)' }} />
              <span className="vocab-detail-timeline__date">{nextReview.toLocaleDateString('ko-KR')}</span>
              <span className="vocab-detail-timeline__event">{isDue ? '복습 필요!' : '다음 복습 예정'}</span>
            </div>
          </div>
        </div>

        {/* 성장 시각화 */}
        <div className="vocab-detail-card__growth">
          <h3 className="vocab-detail-card__section-title">성장 지표</h3>
          <div className="vocab-detail-growth-bar">
            <span className="vocab-detail-growth-bar__label">기억 강도</span>
            <div className="vocab-detail-growth-bar__track">
              <div className="vocab-detail-growth-bar__fill" style={{ width: `${retention}%`, background: retention > 70 ? 'var(--accent)' : retention > 40 ? 'var(--warning)' : 'var(--danger)' }} />
            </div>
            <span className="vocab-detail-growth-bar__pct">{retention}%</span>
          </div>
          <div className="vocab-detail-growth-bar">
            <span className="vocab-detail-growth-bar__label">학습 기간</span>
            <div className="vocab-detail-growth-bar__track">
              <div className="vocab-detail-growth-bar__fill" style={{ width: `${Math.min(100, (daysSinceCreated / 90) * 100)}%`, background: 'var(--primary)' }} />
            </div>
            <span className="vocab-detail-growth-bar__pct">{daysSinceCreated}일</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VocabPage() {
  const { user, profile, fetchProfile } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { speak, supported: ttsSupported } = useTTS();
  const { celebrate, checkLevelUp } = useCelebration();
  const [tab, setTab] = useState('list');
  const [reviewIdx, setReviewIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewFinished, setReviewFinished] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('due');
  const [langFilter, setLangFilter] = useState('all');
  const [showHint, setShowHint] = useState(false);
  const [reviewMode, setReviewMode] = useState('flash');
  const [typingAnswer, setTypingAnswer] = useState('');
  const [contextSelected, setContextSelected] = useState(null);
  const exampleCacheRef = useRef(new Map());
  const [exampleLoading, setExampleLoading] = useState(false);
  const [exampleSentences, setExampleSentences] = useState(null);
  const [deckModal, setDeckModal] = useState(false);
  const [deckTitle, setDeckTitle] = useState('');
  const [deckLang, setDeckLang] = useState('Japanese');
  const [visibleCount, setVisibleCount] = useState(30);
  const [confirmAction, setConfirmAction] = useState(null);
  const [detailWord, setDetailWord] = useState(null);

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
      const prevXP = profile?.xp ?? 0;
      awardXP(user.id, XP_REWARDS.WORD_REVIEWED, prevXP);
      checkLevelUp(prevXP, prevXP + XP_REWARDS.WORD_REVIEWED);
      checkAndAwardAchievements(user.id, { xp: prevXP, streak: profile?.streak_count }).then(newBadges => {
        newBadges.forEach(b => celebrate({ type: 'achievement', icon: b.icon, name: b.name, desc: b.desc }));
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

  useEffect(() => { setVisibleCount(30); }, [search, sortBy, langFilter]);

  const reviewWords = vocab.filter(v => new Date(v.next_review_at) <= new Date());
  const currentWord = reviewWords[reviewIdx];

  const contextOptions = useMemo(() => {
    if (!currentWord) return [];
    const others = vocab.filter(v => v.id !== currentWord.id && v.meaning);
    const shuffled = [...others].sort(() => Math.random() - 0.5).slice(0, 3);
    return [...shuffled, currentWord].sort(() => Math.random() - 0.5);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewIdx, currentWord?.id]);

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
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    scoreMutation.mutate({ id: currentWord.id, nextStats: { next_review_at: tomorrow.toISOString() } });
    goNextReview();
  };

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
        <button onClick={() => setTab('list')} className={`tab-pills__item ${tab === 'list' ? 'tab-pills__item--primary' : ''}`}>
          🗂️ 어휘 목록
        </button>
        <button onClick={() => setTab('review')} className={`tab-pills__item ${tab === 'review' ? 'tab-pills__item--accent' : ''}`}>
          🧠 오늘 복습
        </button>
        <button onClick={() => setTab('stats')} className={`tab-pills__item ${tab === 'stats' ? 'tab-pills__item--primary' : ''}`}>
          📊 학습 통계
        </button>
        <button onClick={() => setTab('notes')} className={`tab-pills__item ${tab === 'notes' ? 'tab-pills__item--accent' : ''}`}>
          📝 문법 노트 {grammarNotes.length > 0 && <span className="tab-badge">{grammarNotes.length}</span>}
        </button>
        <button onClick={() => setTab('decks')} className={`tab-pills__item ${tab === 'decks' ? 'tab-pills__item--primary' : ''}`}>
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
        <VocabList
          filteredVocab={filteredVocab}
          visibleCount={visibleCount}
          setVisibleCount={setVisibleCount}
          search={search}
          setSearch={setSearch}
          sortBy={sortBy}
          setSortBy={setSortBy}
          langFilter={langFilter}
          setLangFilter={setLangFilter}
          ttsSupported={ttsSupported}
          speak={speak}
          setConfirmAction={setConfirmAction}
          deleteMutation={deleteMutation}
          onWordClick={setDetailWord}
        />
      ) : tab === 'review' ? (
        <VocabReview
          vocab={vocab}
          reviewWords={reviewWords}
          reviewIdx={reviewIdx}
          currentWord={currentWord}
          reviewFinished={reviewFinished}
          reviewMode={reviewMode}
          setReviewMode={setReviewMode}
          showAnswer={showAnswer}
          setShowAnswer={setShowAnswer}
          showHint={showHint}
          setShowHint={setShowHint}
          typingAnswer={typingAnswer}
          setTypingAnswer={setTypingAnswer}
          contextSelected={contextSelected}
          setContextSelected={setContextSelected}
          contextOptions={contextOptions}
          handleScore={handleScore}
          handleSkip={handleSkip}
          ttsSupported={ttsSupported}
          speak={speak}
          exampleSentences={exampleSentences}
          exampleLoading={exampleLoading}
          loadExamples={loadExamples}
          setTab={setTab}
          hardWords={vocab.filter(v => (v.repetitions || 0) > 2).length}
        />
      ) : tab === 'stats' ? (
        <VocabStats vocab={vocab} profile={profile} />
      ) : tab === 'notes' ? (
        <VocabNotes grammarNotes={grammarNotes} deleteNoteMutation={deleteNoteMutation} />
      ) : tab === 'decks' ? (
        <VocabDecks
          user={user}
          vocab={vocab}
          publicDecks={publicDecks}
          deckModal={deckModal}
          setDeckModal={setDeckModal}
          deckTitle={deckTitle}
          setDeckTitle={setDeckTitle}
          deckLang={deckLang}
          setDeckLang={setDeckLang}
          createDeckMutation={createDeckMutation}
          deleteDeckMutation={deleteDeckMutation}
          importDeckMutation={importDeckMutation}
          setConfirmAction={setConfirmAction}
        />
      ) : null}

      {detailWord && (
        <VocabDetailCard word={detailWord} onClose={() => setDetailWord(null)} speak={speak} ttsSupported={ttsSupported} />
      )}

      <ConfirmModal
        open={!!confirmAction}
        message={confirmAction?.message}
        onConfirm={confirmAction?.onConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
