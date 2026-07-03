'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { calculateFSRS } from '../lib/fsrs';
import { recordActivity } from '../lib/streak';
import { logReviewEvents } from '../lib/reviewEvents';
import { useTTS } from '../lib/useTTS';
import { callGemini } from '../lib/gemini';
import Button from '../components/Button';
import ConfirmModal from '../components/ConfirmModal';
import VocabList from './VocabList';
import VocabReview from './VocabReview';
import VocabDetailCard from './VocabDetailCard';
import { CardGridSkeleton } from '../components/Skeleton';
import { friendlyToastMessage } from '../lib/errorMessage';
import { detectLang } from '../lib/constants';
import { stripSourceLangInMeaning } from '../lib/studySession';
import { useVocabData } from '../lib/useVocabData';
import { deriveVocabRungs } from '../lib/studyMaterials';
import { vocabTypeForRung } from '../lib/skillRung';
import { exportCSV, exportAnki } from '../lib/vocabIO';
import {
  deckOf, fisherYatesShuffle, isNewWord,
  loadIntroIds, saveIntroIds,
  NEW_PER_DAY_OPTIONS, DEFAULT_NEW_PER_DAY,
} from '../lib/vocabStudy';

const MAX_EXAMPLE_CACHE = 50;

export default function VocabPage() {
  const { user, fetchProfile } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { speak, supported: ttsSupported } = useTTS();
  const [tab, setTab] = useState('list');
  const [reviewIdx, setReviewIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewFinished, setReviewFinished] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('due');
  const [langFilter, setLangFilter] = useState(() => {
    if (typeof window === 'undefined') return 'all';
    return localStorage.getItem('vocab_langFilter') || 'all';
  });
  const [showHint, setShowHint] = useState(false);
  const [seriesFilter, setSeriesFilter] = useState(() => {
    if (typeof window === 'undefined') return 'all';
    return localStorage.getItem('vocab_seriesFilter') || 'all';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('vocab_seriesFilter', seriesFilter);
  }, [seriesFilter]);

  const [reviewMode, setReviewMode] = useState(() => {
    if (typeof window === 'undefined') return 'auto';
    return localStorage.getItem('as_review_mode') || 'auto';
  });

  // 자동 모드용: 복습 시작 시 review_events에서 유도한 단어별 숙련 rung (word_text → rung)
  const [vocabRungs, setVocabRungs] = useState({});

  // reviewMode 영속화
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('as_review_mode', reviewMode);
  }, [reviewMode]);

  // 하루 새 단어 한도
  const [newPerDay, setNewPerDay] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_NEW_PER_DAY;
    const n = parseInt(localStorage.getItem('vocab_new_per_day'), 10);
    return Number.isFinite(n) ? n : DEFAULT_NEW_PER_DAY;
  });
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('vocab_new_per_day', String(newPerDay));
  }, [newPerDay]);

  // 오늘 새로 시작한 단어 ID (날짜 바뀌면 자동 리셋)
  const [introIds, setIntroIds] = useState(loadIntroIds);
  const registerNewIntro = (id) => {
    setIntroIds(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      saveIntroIds(next);
      return next;
    });
  };

  // 복습 큐 — startReview에서 스냅샷으로 고정 (채점해도 재배열/스킵 없음)
  const [reviewQueue, setReviewQueue] = useState([]);
  const [typingAnswer, setTypingAnswer] = useState('');
  const [contextSelected, setContextSelected] = useState(null);
  const exampleCacheRef = useRef(new Map());
  const [exampleLoading, setExampleLoading] = useState(false);
  const [exampleSentences, setExampleSentences] = useState(null);
  const [visibleCount, setVisibleCount] = useState(30);
  const [confirmAction, setConfirmAction] = useState(null);
  const [detailWord, setDetailWord] = useState(null);

  const {
    vocab, isLoading,
    scoreMutation, deleteMutation, csvImportMutation,
    updateVocabMutation, bulkDeleteMutation,
  } = useVocabData();

  // 수동 단어 추가 모달
  const [manualAddOpen, setManualAddOpen] = useState(false);
  const [manualDraft, setManualDraft] = useState({ word_text: '', furigana: '', meaning: '', pos: '', language: 'Japanese' });

  const manualAddMutation = useMutation({
    mutationFn: async (draft) => {
      const text = draft.word_text.trim();
      if (!text) throw new Error('단어를 입력해주세요');
      const isJa = /[\u3040-\u30ff\u4e00-\u9fff]/.test(text);
      const row = {
        user_id: user.id,
        word_text: text,
        base_form: isJa ? text : text.toLowerCase(),
        furigana: draft.furigana.trim(),
        meaning: draft.meaning.trim(),
        pos: draft.pos.trim(),
        language: draft.language || (isJa ? 'Japanese' : 'English'),
        next_review_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from('user_vocabulary')
        .upsert([row], { onConflict: 'user_id,word_text', ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocab', user?.id] });
      toast('단어를 추가했어요', 'success');
      setManualAddOpen(false);
      setManualDraft({ word_text: '', furigana: '', meaning: '', pos: '', language: 'Japanese' });
    },
    onError: (err) => toast('추가 실패 — ' + friendlyToastMessage(err), 'error'),
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
    if (seriesFilter !== 'all') {
      list = list.filter(x => deckOf(x._item)?.key === seriesFilter);
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
  }, [vocabSearchIndex, search, sortBy, langFilter, seriesFilter]);

  useEffect(() => { setVisibleCount(30); }, [search, sortBy, langFilter]);

  // 단어가 속한 시리즈 집합 (chip filter용)
  const availableSeries = useMemo(() => {
    const set = new Map(); // key → display label (교재 덱 + 리더 시리즈)
    for (const v of vocab) {
      const d = deckOf(v);
      if (d && !set.has(d.key)) set.set(d.key, d.label);
    }
    return [...set.entries()].map(([key, label]) => ({ key, label }));
  }, [vocab]);

  // seriesFilter 무효화: 더이상 vocab에 없는 시리즈가 선택돼있으면 'all'로
  useEffect(() => {
    if (seriesFilter !== 'all' && !availableSeries.some(s => s.key === seriesFilter)) {
      setSeriesFilter('all');
    }
  }, [seriesFilter, availableSeries]);

  function vocabMatchesSeries(v) {
    if (seriesFilter === 'all') return true;
    return deckOf(v)?.key === seriesFilter;
  }

  // 현재 덱(시리즈 필터) 범위의 단어 — 히어로·현황·복습 큐가 공유
  const deckScope = useMemo(() => vocab.filter(vocabMatchesSeries), [vocab, seriesFilter]);

  // 덱 범위 구성: 미학습(신규)·학습 중·숙련 (서로 안 겹치게 분할)
  const deckStats = useMemo(() => {
    let neu = 0, learning = 0, mastered = 0;
    for (const v of deckScope) {
      if (isNewWord(v)) neu++;
      else if ((v.interval ?? 0) >= 30) mastered++;
      else learning++;
    }
    return { total: deckScope.length, neu, learning, mastered };
  }, [deckScope]);

  // 오늘 세션 미리보기 — 복습 예정 + (하루 한도 내) 새 단어
  const remainingNew = Math.max(0, newPerDay - introIds.length);
  const session = useMemo(() => {
    const now = new Date();
    const reviewsDue = deckScope.filter(v => !isNewWord(v) && new Date(v.next_review_at) <= now);
    const newAvailable = deckScope.filter(v => isNewWord(v) && new Date(v.next_review_at) <= now);
    const newToday = Math.min(newAvailable.length, remainingNew);
    return { reviewsDue, newAvailable, newToday, count: reviewsDue.length + newToday };
  }, [deckScope, remainingNew]);

  // 복습 큐(스냅샷) → 단어 객체. 길이 안정(삭제돼도 null 유지)해 인덱스 정렬 보존.
  const reviewSessionWords = useMemo(
    () => reviewQueue.map(id => vocab.find(v => v.id === id) || null),
    [reviewQueue, vocab]
  );
  const currentWord = useMemo(() => {
    const id = reviewQueue[reviewIdx];
    return id != null ? vocab.find(v => v.id === id) : undefined;
  }, [reviewQueue, reviewIdx, vocab]);

  // 자동 모드: 단어 rung → 세션과 동일한 문항 유형(vocabTypeForRung)을 복습 서브모드로 매핑.
  // rung≤1→choice(문맥 객관식), 2→typing, ≥3→listening. TTS 미지원이면 listening은 문맥으로 강등.
  const autoSubMode = (word) => {
    if (!word) return 'context';
    const rung = vocabRungs[word.word_text] ?? 0;
    const vtype = vocabTypeForRung(rung, 'normal');
    if (vtype === 'vocab-typing') return 'typing';
    if (vtype === 'vocab-listening') return ttsSupported ? 'listening' : 'context';
    return 'context'; // vocab-choice
  };
  const effectiveMode = reviewMode === 'auto' ? autoSubMode(currentWord) : reviewMode;

  const contextOptions = useMemo(() => {
    if (!currentWord) return [];
    const others = vocab.filter(v => v.id !== currentWord.id && v.meaning);
    const distractors = fisherYatesShuffle(others).slice(0, 3);
    // 보기 텍스트는 원어 병기 괄호를 정리 — 정답 식별은 id 기준이라 채점엔 무영향
    return fisherYatesShuffle([...distractors, currentWord])
      .map(v => ({ ...v, meaning: stripSourceLangInMeaning(v.meaning) }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewIdx, currentWord?.id]);

  const handleScore = (rating) => {
    if (!currentWord) return;
    const wasNew = isNewWord(currentWord);
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
      rating,
      prevInterval,
      newInterval: nextStats.interval ?? 0,
    });
    recordActivity(user.id, () => fetchProfile(user.id));
    // 약점 진단 데이터 — 어휘 정오답 적재 ('다시'=오답, 나머지=정답 취급)
    // qtype: 실제 출제된 유형에서 유도 (자동 모드는 rung이 정한 서브모드 → effectiveMode).
    // flash·context=객관식→choice, typing, listening. 이 qtype이 다음 세션 rung 유도의 입력이 된다.
    const qtype = ({ flash: 'choice', context: 'choice', typing: 'typing', listening: 'listening' })[effectiveMode] || 'choice';
    logReviewEvents(user.id, [{
      lang: currentWord.language || detectLang(currentWord.word_text),
      source: 'vocab',
      item_key: currentWord.word_text,
      correct: rating > 1,
      detail: { word_id: currentWord.id, meaning: currentWord.meaning, rating, mode: reviewMode, qtype },
    }]);
    if (wasNew) registerNewIntro(currentWord.id);            // 새 단어 첫 학습 → 오늘 한도 차감
    goNextReview(rating === 1 ? currentWord.id : null);      // '다시'는 이번 세션 끝에 재노출
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

  const goNextReview = (requeueId = null) => {
    setShowHint(false);
    setTypingAnswer('');
    setContextSelected(null);
    const newLen = reviewQueue.length + (requeueId ? 1 : 0);
    if (requeueId) setReviewQueue(q => [...q, requeueId]);
    if (reviewIdx < newLen - 1) {
      setReviewIdx(i => i + 1);
      setShowAnswer(false);
    } else {
      setReviewFinished(true);
      toast('오늘의 복습 완료', 'celebrate', 5000);
    }
  };

  const startReview = async () => {
    // 복습 예정(학습한 단어) 먼저, 그다음 하루 한도 내 새 단어
    const reviews = session.reviewsDue;
    const news = session.newAvailable.slice(0, session.newToday);
    const queueWords = [...reviews, ...news];
    const queue = queueWords.map(v => v.id);
    if (queue.length === 0) return;

    // 자동(추천) 모드용 rung 유도 — review_events 1회 조회(해당 언어들, 최근 400건, desc→asc).
    // 조회 실패·이벤트 0건이면 rung 기본 0 → vocabTypeForRung(0)=choice 위주(무해 폴백).
    let rungs = {};
    try {
      const langs = [...new Set(queueWords.map(v => v.language || detectLang(v.word_text)))];
      const { data, error } = await supabase
        .from('review_events')
        .select('source, item_key, correct, detail, created_at')
        .eq('user_id', user.id)
        .in('lang', langs)
        .order('created_at', { ascending: false })
        .limit(400);
      if (!error && data) {
        const eventsAsc = data.slice().reverse();
        rungs = deriveVocabRungs(eventsAsc, queueWords);
      }
    } catch { /* 폴백: 빈 rung → choice 위주 */ }
    setVocabRungs(rungs);

    setReviewQueue(queue);
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

      {/* 헤더 — 제목 + 요약 수치 */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <h1 className="page-header__title" style={{ margin: 0 }}>어휘</h1>
          {vocab.length > 0 && (
            <div style={{ display: 'flex', gap: 14, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <span>전체 {vocab.length}개</span>
            </div>
          )}
        </div>
      </div>

      {/* 복습 히어로 — 이 페이지의 단 하나의 질문: 오늘 복습했나 */}
      {tab === 'list' && !isLoading && (
        <div className="card vocab-hero">
          <div className="vocab-hero__body">
            <span className="vocab-hero__kicker">{vocab.length === 0 ? '어휘' : '오늘 학습'}</span>
            {vocab.length === 0 ? (
              <span className="vocab-hero__sub">자료를 읽으며 단어를 모아보세요</span>
            ) : session.count > 0 ? (
              <>
                <span className="vocab-hero__num">{session.count}</span>
                <span className="vocab-hero__sub">개 — 복습 {session.reviewsDue.length} · 새 단어 {session.newToday}</span>
              </>
            ) : session.newAvailable.length > 0 ? (
              <span className="vocab-hero__done">
                오늘 학습 끝 · 새 단어 {session.newAvailable.length}개는 내일
              </span>
            ) : (
              <span className="vocab-hero__done">
                오늘 복습 끝{(() => {
                  const next = vocab
                    .filter(v => vocabMatchesSeries(v) && new Date(v.next_review_at) > new Date())
                    .sort((a, b) => new Date(a.next_review_at) - new Date(b.next_review_at))[0];
                  if (!next) return null;
                  const d = new Date(next.next_review_at);
                  const days = Math.ceil((d - new Date()) / 86400000);
                  return ` — 다음 복습 ${days <= 1 ? '내일' : `${days}일 후`}`;
                })()}
              </span>
            )}
          </div>
          <div className="vocab-hero__actions">
            {vocab.length === 0 && (
              <Link href="/materials" className="btn btn--primary btn--sm">자료 읽기 →</Link>
            )}
            {session.count > 0 && (
              <Button onClick={startReview}>복습 시작 →</Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setManualAddOpen(true)}>+ 추가</Button>
            {vocab.length > 0 && (
              <details style={{ position: 'relative' }}>
                <summary className="btn btn--ghost btn--sm" style={{ cursor: 'pointer', listStyle: 'none' }}>⋯</summary>
                <div style={{
                  position: 'absolute', right: 0, top: '100%', marginTop: 4,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                  zIndex: 100, minWidth: 160, overflow: 'hidden',
                }}>
                  <button onClick={() => exportCSV(vocab)} style={{ display: 'block', width: '100%', padding: '10px 14px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                    CSV 내보내기
                  </button>
                  <button onClick={() => exportAnki(vocab)} style={{ display: 'block', width: '100%', padding: '10px 14px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                    Anki 내보내기
                  </button>
                  <label style={{ display: 'block', padding: '10px 14px', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                    CSV 가져오기
                    <input type="file" accept=".csv,text/csv" disabled={csvImportMutation.isPending}
                      onChange={e => { const f = e.target.files?.[0]; if (f) csvImportMutation.mutate(f); e.target.value = ''; }}
                      style={{ display: 'none' }} />
                  </label>
                  <Link href="/home" style={{ display: 'block', padding: '10px 14px', fontSize: '0.85rem', textDecoration: 'none', color: 'var(--text-primary)' }}>
                    학습 통계
                  </Link>
                  <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
                    <label htmlFor="new-per-day" style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 5 }}>
                      하루 새 단어 한도
                    </label>
                    <select
                      id="new-per-day"
                      value={newPerDay}
                      onChange={e => setNewPerDay(parseInt(e.target.value, 10))}
                      style={{
                        width: '100%', padding: '6px 8px', fontSize: '0.85rem',
                        borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                        background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer',
                      }}
                    >
                      {NEW_PER_DAY_OPTIONS.map(n => (
                        <option key={n} value={n}>{n === 0 ? '없음 (복습만)' : `${n}개`}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </details>
            )}
          </div>
        </div>
      )}

      {/* 상단 미니 현황 — 내 단어장 구성(미학습·학습 중·숙련) + 오늘 신규 한도 */}
      {tab === 'list' && !isLoading && vocab.length > 0 && (
        <div className="vocab-stat-strip">
          <span className="vocab-stat">미학습 <strong>{deckStats.neu}</strong></span>
          <span className="vocab-stat">학습 중 <strong>{deckStats.learning}</strong></span>
          <span className="vocab-stat">숙련 <strong>{deckStats.mastered}</strong></span>
          {newPerDay > 0 && (
            <span className="vocab-stat" title="오늘 새로 시작한 단어 / 하루 한도">
              오늘 신규 <strong>{introIds.length}/{newPerDay}</strong>
            </span>
          )}
          <span className="vocab-stat vocab-stat--total">{seriesFilter === 'all' ? '전체' : '이 덱'} <strong>{deckStats.total}</strong></span>
        </div>
      )}

      {/* 복습 세션 중 — 목록 복귀 */}
      {tab === 'review' && !reviewFinished && (
        <button type="button" className="chip" style={{ marginBottom: 12 }} onClick={() => setTab('list')}>
          ← 단어 목록
        </button>
      )}

      {/* 시리즈 필터 (list / review 탭에 공통 적용) */}
      {(tab === 'list' || tab === 'review') && availableSeries.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div className="chip-group">
            <button
              className={`chip ${seriesFilter === 'all' ? 'chip--active' : ''}`}
              onClick={() => setSeriesFilter('all')}
            >
              전체 덱
            </button>
            {availableSeries.map(s => (
              <button
                key={s.key}
                className={`chip ${seriesFilter === s.key ? 'chip--active' : ''}`}
                onClick={() => setSeriesFilter(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
          {tab === 'review' && seriesFilter !== 'all' && (() => {
            const filtered = vocab.filter(vocabMatchesSeries);
            const due = filtered.filter(v => new Date(v.next_review_at) <= new Date()).length;
            return (
              <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
이 덱 단어 <strong>{filtered.length}</strong>개 · 복습 대기 <strong style={{ color: due > 0 ? 'var(--warning)' : 'var(--accent)' }}>{due}</strong>개
              </div>
            );
          })()}
        </div>
      )}

      {isLoading ? (
        <CardGridSkeleton height={120} />
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
          updateVocabMutation={updateVocabMutation}
          onWordClick={setDetailWord}
        />
      ) : tab === 'review' ? (
        <VocabReview
          vocab={vocab}
          reviewWords={reviewSessionWords}
          reviewIdx={reviewIdx}
          currentWord={currentWord}
          reviewFinished={reviewFinished}
          reviewMode={reviewMode}
          effectiveMode={effectiveMode}
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
        />
      ) : null}

      {detailWord && (
        <VocabDetailCard word={detailWord} onClose={() => setDetailWord(null)} speak={speak} ttsSupported={ttsSupported} />
      )}

      {/* 수동 단어 추가 모달 */}
      {manualAddOpen && (
        <div className="modal-overlay" onClick={() => !manualAddMutation.isPending && setManualAddOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1.05rem' }}>단어 직접 추가</h3>

            <label className="u-text-sm u-text-bold" style={{ display: 'block', marginBottom: 4 }}>언어</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {['Japanese', 'English', 'French', 'Chinese'].map(lang => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setManualDraft(d => ({ ...d, language: lang }))}
                  className={`btn btn--sm ${manualDraft.language === lang ? 'btn--primary' : 'btn--ghost'}`}
                  style={{ flex: 1 }}
                >
                  {({ Japanese: '일본어', English: '영어', French: '프랑스어', Chinese: '중국어' })[lang]}
                </button>
              ))}
            </div>

            <label className="u-text-sm u-text-bold" style={{ display: 'block', marginBottom: 4 }}>단어 *</label>
            <input
              type="text"
              value={manualDraft.word_text}
              onChange={e => setManualDraft(d => ({ ...d, word_text: e.target.value }))}
              className="form-input"
              placeholder={manualDraft.language === 'Japanese' ? '예: 食べる' : manualDraft.language === 'French' ? 'ex: bonjour' : manualDraft.language === 'Chinese' ? '例: 北京' : 'e.g. eloquent'}
              autoFocus
              style={{ marginBottom: 12 }}
            />

            <label className="u-text-sm u-text-bold" style={{ display: 'block', marginBottom: 4 }}>
              {manualDraft.language === 'Japanese' ? '후리가나' : '발음 (선택)'}
            </label>
            <input
              type="text"
              value={manualDraft.furigana}
              onChange={e => setManualDraft(d => ({ ...d, furigana: e.target.value }))}
              className="form-input"
              placeholder={manualDraft.language === 'Japanese' ? 'たべる' : '(선택)'}
              style={{ marginBottom: 12 }}
            />

            <label className="u-text-sm u-text-bold" style={{ display: 'block', marginBottom: 4 }}>의미</label>
            <input
              type="text"
              value={manualDraft.meaning}
              onChange={e => setManualDraft(d => ({ ...d, meaning: e.target.value }))}
              className="form-input"
              placeholder="한국어 뜻"
              style={{ marginBottom: 12 }}
            />

            <label className="u-text-sm u-text-bold" style={{ display: 'block', marginBottom: 4 }}>품사 (선택)</label>
            <input
              type="text"
              value={manualDraft.pos}
              onChange={e => setManualDraft(d => ({ ...d, pos: e.target.value }))}
              className="form-input"
              placeholder="동사 / 명사 / 형용사..."
              style={{ marginBottom: 16 }}
            />

            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" onClick={() => setManualAddOpen(false)} disabled={manualAddMutation.isPending} style={{ flex: 1 }}>
                취소
              </Button>
              <Button
                onClick={() => manualAddMutation.mutate(manualDraft)}
                disabled={manualAddMutation.isPending || !manualDraft.word_text.trim()}
                style={{ flex: 2 }}
              >
                {manualAddMutation.isPending ? '추가 중...' : '추가'}
              </Button>
            </div>
          </div>
        </div>
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
