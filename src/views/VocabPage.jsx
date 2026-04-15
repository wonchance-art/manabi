'use client';

import { useState, useMemo, useRef, useEffect, memo } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { calculateFSRS } from '../lib/fsrs';
import { recordActivity } from '../lib/streak';
import { awardXP, XP_REWARDS, getReviewXP } from '../lib/xp';
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
import VocabWriting from './VocabWriting';
import { detectLang } from '../lib/constants';

const MAX_EXAMPLE_CACHE = 50;

function fisherYatesShuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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

const VocabDetailCard = memo(function VocabDetailCard({ word: v, onClose, speak, ttsSupported }) {
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
    <div className="vocab-detail-overlay" role="dialog" aria-modal="true" aria-label="단어 상세" onClick={onClose} onKeyDown={e => e.key === 'Escape' && onClose()}>
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

        {/* 출처 자료 링크 */}
        {v.source_material_id && (
          <div className="vocab-detail-card__source">
            <h3 className="vocab-detail-card__section-title">📖 출처 자료</h3>
            {v.source_sentence && (
              <p style={{
                fontSize: '0.85rem', color: 'var(--text-secondary)',
                padding: '8px 12px', background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)', marginBottom: 8, lineHeight: 1.6,
              }}>
                {v.source_sentence.split(v.word_text).map((part, i, arr) =>
                  i < arr.length - 1
                    ? <span key={i}>{part}<mark style={{ background: 'var(--primary-glow)', color: 'var(--primary-light)', padding: '0 3px', borderRadius: 3 }}>{v.word_text}</mark></span>
                    : <span key={i}>{part}</span>
                )}
              </p>
            )}
            <Link
              href={`/viewer/${v.source_material_id}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: '0.85rem', color: 'var(--primary-light)',
                textDecoration: 'none', padding: '6px 12px',
                background: 'var(--bg-secondary)', borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border)',
              }}
            >
              원본 자료로 이동 →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
});

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
  const [reviewMode, setReviewMode] = useState(() => {
    if (typeof window === 'undefined') return 'flash';
    return localStorage.getItem('as_review_mode') || 'flash';
  });

  // reviewMode 영속화
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('as_review_mode', reviewMode);
  }, [reviewMode]);

  // reviewIdx 영속화 (같은 날 기준, user별)
  useEffect(() => {
    if (!user?.id || tab !== 'review' || reviewFinished) return;
    const key = `as_review_progress_${user.id}`;
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(key, JSON.stringify({ date: today, idx: reviewIdx }));
  }, [reviewIdx, tab, reviewFinished, user?.id]);

  // 재방문 시 같은 날 복원
  useEffect(() => {
    if (!user?.id) return;
    const key = `as_review_progress_${user.id}`;
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      const today = new Date().toISOString().slice(0, 10);
      if (saved?.date === today && saved.idx > 0) {
        setReviewIdx(saved.idx);
      }
    } catch { /* ignore */ }
  }, [user?.id]);
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
        .select('id, selected_text, explanation, created_at, reading_materials(title), interval, ease_factor, repetitions, next_review_at, last_reviewed_at')
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

      // 단어들의 출처 자료 중 가장 빈번한 것을 덱 출처로 기록
      const sourceCounts = {};
      words.forEach(w => {
        if (w.source_material_id) {
          sourceCounts[w.source_material_id] = (sourceCounts[w.source_material_id] || 0) + 1;
        }
      });
      const dominantSource = Object.entries(sourceCounts)
        .sort(([, a], [, b]) => b - a)[0]?.[0];
      // 70% 이상 같은 자료일 때만 연결
      const sourceThreshold = words.length * 0.7;
      const linkedSource = dominantSource && sourceCounts[dominantSource] >= sourceThreshold
        ? dominantSource
        : null;

      const { data: deck, error: deckErr } = await supabase
        .from('vocab_decks')
        .insert({
          owner_id: user.id,
          title: deckTitle.trim(),
          language: deckLang,
          word_count: words.length,
          source_material_id: linkedSource,
        })
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
      // 덱의 실제 언어 정보를 DB에서 가져와 사용
      const { data: deckInfo, error: deckInfoErr } = await supabase
        .from('vocab_decks')
        .select('language')
        .eq('id', deckId)
        .single();
      if (deckInfoErr) throw deckInfoErr;
      const importLang = deckInfo?.language || deckLang;

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
        language: importLang,
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
    mutationFn: async ({ id, nextStats, isGrammar }) => {
      const payload = { ...nextStats, last_reviewed_at: new Date().toISOString() };
      const table = isGrammar ? 'grammar_notes' : 'user_vocabulary';
      const { error } = await supabase
        .from(table)
        .update(payload)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { isGrammar, rating, prevInterval, newInterval }) => {
      if (isGrammar) {
        queryClient.invalidateQueries({ queryKey: ['grammar-notes', user?.id] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['vocab', user?.id] });
      }
      const prevXP = profile?.xp ?? 0;
      const reviewXP = getReviewXP(rating);
      // 마스터(interval 30일 돌파) 보너스
      const crossedMastery = prevInterval < 30 && newInterval >= 30;
      const totalXP = reviewXP + (crossedMastery ? XP_REWARDS.MASTERY_REACHED : 0);

      awardXP(user.id, totalXP, prevXP);
      checkLevelUp(prevXP, prevXP + totalXP);
      if (crossedMastery) {
        celebrate({ type: 'milestone', icon: '🏆', name: '단어 마스터!', desc: `+${XP_REWARDS.MASTERY_REACHED} XP 보너스` });
      }
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

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => {
      if (!ids?.length) return 0;
      const { error } = await supabase
        .from('user_vocabulary')
        .delete()
        .in('id', ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['vocab', user?.id] });
      toast(`${count}개 단어를 삭제했습니다.`, 'info');
    },
    onError: (err) => toast('일괄 삭제 실패: ' + err.message, 'error'),
  });

  // 검색용 인덱스 사전 계산 (vocab이 바뀔 때만 1회)
  const vocabSearchIndex = useMemo(() => {
    return vocab.map(v => ({
      _item: v,
      _searchKey: `${v.word_text || ''} ${v.meaning || ''} ${v.furigana || ''}`.toLowerCase(),
    }));
  }, [vocab]);

  const filteredVocab = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = vocabSearchIndex;

    if (langFilter !== 'all') {
      list = list.filter(x => x._item.language === langFilter);
    }
    if (q) {
      list = list.filter(x => x._searchKey.includes(q));
    }
    list = list.map(x => x._item); // 인덱스 랩 해제

    if (sortBy === 'due') {
      list = [...list].sort((a, b) => new Date(a.next_review_at) - new Date(b.next_review_at));
    } else if (sortBy === 'newest') {
      list = [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (sortBy === 'alpha') {
      list = [...list].sort((a, b) => (a.word_text || '').localeCompare(b.word_text || '', 'ja'));
    }
    return list;
  }, [vocabSearchIndex, search, sortBy, langFilter]);

  useEffect(() => { setVisibleCount(30); }, [search, sortBy, langFilter]);

  const reviewWords = useMemo(() => {
    const now = new Date();
    const dueVocab = vocab.filter(v => new Date(v.next_review_at) <= now);
    const dueGrammar = grammarNotes
      .filter(n => n.next_review_at && new Date(n.next_review_at) <= now)
      .map(n => ({
        ...n,
        _isGrammar: true,
        word_text: n.selected_text,
        meaning: n.explanation?.split('\n')[0]?.slice(0, 80) || '문법 노트',
        furigana: '',
        pos: '문법',
        source_sentence: n.selected_text,
      }));
    return [...dueVocab, ...dueGrammar];
  }, [vocab, grammarNotes]);
  const currentWord = reviewWords[reviewIdx];

  const contextOptions = useMemo(() => {
    if (!currentWord) return [];
    const others = vocab.filter(v => v.id !== currentWord.id && v.meaning);
    const distractors = fisherYatesShuffle(others).slice(0, 3);
    return fisherYatesShuffle([...distractors, currentWord]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewIdx, currentWord?.id]);

  const handleScore = (rating) => {
    if (!currentWord) return;
    const prevInterval = currentWord.interval ?? 0;
    const nextStats = calculateFSRS(rating, {
      interval: prevInterval,
      ease_factor: currentWord.ease_factor ?? 0,
      repetitions: currentWord.repetitions ?? 0,
      next_review_at: currentWord.next_review_at,
    });
    scoreMutation.mutate({
      id: currentWord.id,
      nextStats,
      isGrammar: !!currentWord._isGrammar,
      rating,
      prevInterval,
      newInterval: nextStats.interval ?? 0,
    });
    recordActivity(user.id, () => fetchProfile(user.id));
    goNextReview();
  };

  const handleSkip = () => {
    if (!currentWord) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    scoreMutation.mutate({ id: currentWord.id, nextStats: { next_review_at: tomorrow.toISOString() }, isGrammar: !!currentWord._isGrammar });
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
      const { parseGeminiJSON } = await import('../lib/gemini');
      const parsed = parseGeminiJSON(raw);
      if (!parsed.examples || !Array.isArray(parsed.examples)) throw new Error('예문 형식 오류');
      const cache = exampleCacheRef.current;
      if (cache.size >= MAX_EXAMPLE_CACHE) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
      cache.set(currentWord.id, parsed.examples);
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
      // 진행도 정리
      if (user?.id && typeof window !== 'undefined') {
        localStorage.removeItem(`as_review_progress_${user.id}`);
      }
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

      {/* Tab Switcher — 3개로 축소 */}
      <div className="tab-pills" style={{ marginBottom: '20px' }}>
        <button onClick={() => setTab('list')} className={`tab-pills__item ${tab === 'list' ? 'tab-pills__item--primary' : ''}`}>
          🗂️ 단어장
        </button>
        <button onClick={() => setTab('writing')} className={`tab-pills__item ${tab === 'writing' ? 'tab-pills__item--accent' : ''}`}>
          ✍️ 쓰기 연습
        </button>
        <button onClick={() => setTab('decks')} className={`tab-pills__item ${tab === 'decks' ? 'tab-pills__item--primary' : ''}`}>
          🃏 공유 덱
        </button>
      </div>

      {/* 보조 액션 — 부가 기능 (복습/통계/노트) */}
      {tab === 'list' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {reviewWords.length > 0 && (
            <Button size="sm" variant="accent" onClick={startReview}>
              🧠 카드 복습 ({reviewWords.length})
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setTab('stats')}>📊 통계</Button>
          {grammarNotes.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setTab('notes')}>
              📝 문법 노트 ({grammarNotes.length})
            </Button>
          )}
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto', alignSelf: 'center' }}>
            💡 자료를 읽으면서 노란 단어 클릭으로도 복습 가능
          </span>
        </div>
      )}

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
          bulkDeleteMutation={bulkDeleteMutation}
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
      ) : tab === 'writing' ? (
        <VocabWriting
          vocab={vocab}
          toast={toast}
          user={user}
          awardXPOnSuccess={() => {
            const prevXP = profile?.xp ?? 0;
            awardXP(user.id, XP_REWARDS.WRITING_HIGH_SCORE, prevXP);
            checkLevelUp(prevXP, prevXP + XP_REWARDS.WRITING_HIGH_SCORE);
            recordActivity(user.id, () => fetchProfile(user.id));
          }}
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
