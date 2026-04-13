'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import { callGemini, GEMINI_MODEL } from '../lib/gemini';
import { analyzeText } from '../lib/analyzeText';
import { recordActivity } from '../lib/streak';
import { awardXP, XP_REWARDS } from '../lib/xp';
import { checkAndAwardAchievements } from '../lib/achievements';
import { useCelebration } from '../lib/CelebrationContext';
import { useTTS } from '../lib/useTTS';
import ViewerComments from './ViewerComments';
import ViewerBottomSheet from './ViewerBottomSheet';
import ViewerGrammarModal from './ViewerGrammarModal';
import ViewerQuizModal from './ViewerQuizModal';

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

/**
 * 送り仮名(okurigana) 제거: 요미가나에서 원문에 이미 있는 히라가나 제거
 *
 * 원칙: 원문(text)에 보이는 히라가나는 요미가나에서 중복 제거.
 *       요미가나는 한자 읽기만 남긴다.
 *
 * 超える  + こえる    → こ
 * 食べる  + たべる    → た
 * 思い出す + おもいだす → おもだ   (い・す 제거)
 * 引っ張る + ひっぱる  → ひぱ     (っ・る 모두 원문에 있으므로 제거)
 * 今日    + きょう    → きょう    (한자만이라 그대로)
 *
 * 알고리즘: text의 히라가나 연속 블록을 순서대로 furigana에서 제거 (greedy)
 */
function trimOkurigana(text, furigana) {
  if (!furigana) return furigana;

  const HIRA = /[\u3041-\u3096]/;

  // text에서 히라가나 연속 블록 추출 (순서 유지)
  const hiraBlocks = [];
  let buf = '';
  for (const ch of text) {
    if (HIRA.test(ch)) {
      buf += ch;
    } else {
      if (buf) { hiraBlocks.push(buf); buf = ''; }
    }
  }
  if (buf) hiraBlocks.push(buf);

  if (!hiraBlocks.length) return furigana;

  // furigana에서 각 블록을 순서대로 제거
  let result = furigana;
  for (const block of hiraBlocks) {
    const idx = result.indexOf(block);
    if (idx !== -1) result = result.slice(0, idx) + result.slice(idx + block.length);
  }

  return result || furigana; // 전부 제거되면 원본 반환
}

export default function ViewerPage() {
  const { id } = useParams();
  const { user, profile, fetchProfile } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const reanalyzeAbortRef = useRef(null);
  const [reanalyzeConfirm, setReanalyzeConfirm] = useState(null); // null | { fullReset }

  function requestReanalyze(opts) { setReanalyzeConfirm(opts); }
  function confirmReanalyze() {
    reanalyzeMutation.mutate(reanalyzeConfirm);
    setReanalyzeConfirm(null);
  }
  function cancelReanalyze() { setReanalyzeConfirm(null); }
  function stopReanalysis() { reanalyzeAbortRef.current?.abort(); }
  const { speak, supported: ttsSupported } = useTTS();
  const { celebrate, checkLevelUp } = useCelebration();

  function readPref(key, fallback) {
    try { const v = localStorage.getItem('viewer_' + key); return v !== null ? JSON.parse(v) : fallback; } catch { return fallback; }
  }
  function savePref(key, value) {
    try { localStorage.setItem('viewer_' + key, JSON.stringify(value)); } catch {}
  }

  const [fontSize, setFontSizeRaw] = useState(() => readPref('fontSize', 1.6));
  const [lineGap, setLineGapRaw] = useState(() => readPref('lineGap', 15));
  const [charGap, setCharGapRaw] = useState(() => readPref('charGap', 0.25));
  const [theme, setThemeRaw] = useState(() => readPref('theme', 'dark'));
  const [fontFamily, setFontFamilyRaw] = useState(() => readPref('fontFamily', "'Noto Sans KR'"));
  const [showFurigana, setShowFuriganaRaw] = useState(() => readPref('showFurigana', true));

  function setFontSize(v) { setFontSizeRaw(v); savePref('fontSize', v); }
  function setLineGap(v) { setLineGapRaw(v); savePref('lineGap', v); }
  function setCharGap(v) { setCharGapRaw(v); savePref('charGap', v); }
  function setTheme(v) { setThemeRaw(v); savePref('theme', v); }
  function setFontFamily(v) { setFontFamilyRaw(v); savePref('fontFamily', v); }
  function setShowFurigana(v) { setShowFuriganaRaw(v); savePref('showFurigana', v); }

  const [selectedToken, setSelectedToken] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const [isGrammarModalOpen, setIsGrammarModalOpen] = useState(false);
  const [grammarAnalysis, setGrammarAnalysis] = useState('');
  const [isGrammarLoading, setIsGrammarLoading] = useState(false);
  const [selectedRangeText, setSelectedRangeText] = useState('');
  const [checkedActions, setCheckedActions] = useState(new Set());
  const [selectionPopup, setSelectionPopup] = useState(null); // { x, y } or null
  const [completionModal, setCompletionModal] = useState(null); // { wordsSaved, dueCount, streak, quizScore?, quizTotal? }
  // 퀴즈
  const [quizState, setQuizState] = useState(null);
  // null | { status:'loading' } | { status:'active', questions, currentQ, score, selected }
  // | { status:'done', score, total, pendingCompletion }
  // 문법 튜터 추가 질문
  const [grammarFollowUp, setGrammarFollowUp] = useState('');
  const [grammarFollowLoading, setGrammarFollowLoading] = useState(false);
  // 댓글
  const [commentInput, setCommentInput] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [readProgress, setReadProgress] = useState(0);
  const [saveAnim, setSaveAnim] = useState(false); // 단어 저장 애니메이션

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

  const { data: readingProgress } = useQuery({
    queryKey: ['reading-progress', user?.id, id],
    queryFn: async () => {
      const { data } = await supabase
        .from('reading_progress')
        .select('is_completed')
        .eq('user_id', user.id)
        .eq('material_id', id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // 완독 후 추천할 다음 자료 (같은 언어, 아직 안 읽은 것)
  const { data: nextMaterial } = useQuery({
    queryKey: ['next-material', id, material?.processed_json?.metadata?.language],
    queryFn: async () => {
      const lang = material?.processed_json?.metadata?.language;
      // 이미 읽은 자료 ID 가져오기
      const { data: readIds } = await supabase
        .from('reading_progress')
        .select('material_id')
        .eq('user_id', user.id)
        .eq('is_completed', true);
      const doneSet = new Set((readIds || []).map(r => r.material_id));
      doneSet.add(id); // 현재 자료도 제외

      let query = supabase
        .from('reading_materials')
        .select('id, title, processed_json')
        .eq('visibility', 'public')
        .neq('id', id)
        .limit(10);

      const { data } = await query;
      if (!data?.length) return null;

      // 같은 언어 → 같은 레벨 우선 필터
      const level = material?.processed_json?.metadata?.level;
      const candidates = data
        .filter(m => !doneSet.has(m.id) && m.processed_json?.status === 'completed')
        .sort((a, b) => {
          const aLang = a.processed_json?.metadata?.language === lang ? 0 : 1;
          const bLang = b.processed_json?.metadata?.language === lang ? 0 : 1;
          if (aLang !== bLang) return aLang - bLang;
          const aLevel = a.processed_json?.metadata?.level === level ? 0 : 1;
          const bLevel = b.processed_json?.metadata?.level === level ? 0 : 1;
          return aLevel - bLevel;
        });

      return candidates[0] || null;
    },
    enabled: !!user && !!completionModal,
    staleTime: 1000 * 60 * 5,
  });

  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ['material-comments', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_comments')
        .select('id, content, created_at, user_id, author:profiles(display_name)')
        .eq('material_id', id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (content) => {
      const { error } = await supabase
        .from('material_comments')
        .insert({ material_id: id, user_id: user.id, content });
      if (error) throw error;
    },
    onSuccess: () => {
      setCommentInput('');
      refetchComments();
    },
    onError: (err) => toast('댓글 저장 실패: ' + err.message, 'error'),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId) => {
      const { error } = await supabase
        .from('material_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => refetchComments(),
    onError: (err) => toast('삭제 실패: ' + err.message, 'error'),
  });

  const markCompleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('reading_progress').upsert({
        user_id: user.id,
        material_id: id,
        is_completed: true,
        completed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,material_id' });
      if (error) throw error;

      // 요약 데이터 병렬 조회
      const now = new Date().toISOString();
      const [
        { count: wordsSaved },
        { count: dueCount },
      ] = await Promise.all([
        supabase.from('user_vocabulary').select('*', { count: 'exact', head: true })
          .eq('user_id', user.id).eq('source_material_id', id),
        supabase.from('user_vocabulary').select('*', { count: 'exact', head: true })
          .eq('user_id', user.id).lte('next_review_at', now),
      ]);

      return { wordsSaved: wordsSaved || 0, dueCount: dueCount || 0 };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reading-progress', user?.id, id] });
      queryClient.invalidateQueries({ queryKey: ['reading-progress-list', user?.id] });
      recordActivity(user.id, () => fetchProfile(user.id));
      const prevXP = profile?.xp ?? 0;
      awardXP(user.id, XP_REWARDS.MATERIAL_COMPLETED, prevXP);
      checkLevelUp(prevXP, prevXP + XP_REWARDS.MATERIAL_COMPLETED);
      checkAndAwardAchievements(user.id, { xp: prevXP, streak: profile?.streak_count }).then(newBadges => {
        newBadges.forEach(b => celebrate({ type: 'achievement', icon: b.icon, name: b.name, desc: b.desc }));
      });
      // 퀴즈 생성 후 완료 모달 표시
      const pendingCompletion = {
        wordsSaved: data.wordsSaved,
        dueCount: data.dueCount,
        streak: (profile?.streak_count || 0) + 1,
      };
      generateQuiz(pendingCompletion);
    },
    onError: (err) => toast('오류: ' + err.message, 'error'),
  });

  const saveGrammarNoteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('grammar_notes').insert({
        user_id: user.id,
        material_id: id,
        selected_text: selectedRangeText,
        explanation: grammarAnalysis,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grammar-notes', user?.id] });
      toast('📝 문법 노트에 저장됐어요!', 'success');
    },
    onError: (err) => toast('저장 실패: ' + err.message, 'error'),
  });

  // 재분석 (실패 줄만 타게팅 or 전체)
  const reanalyzeMutation = useMutation({
    mutationFn: async ({ fullReset = false } = {}) => {
      const rawText = material?.raw_text;
      if (!rawText) throw new Error('원본 텍스트가 없습니다.');

      const controller = new AbortController();
      reanalyzeAbortRef.current = controller;

      const hasPartial = !fullReset && failedIndices.length > 0;
      const baseJson = hasPartial ? material.processed_json : null;
      const initMeta = material.processed_json?.metadata || {};

      // 진행 상태 표시
      const statusJson = hasPartial
        ? { ...material.processed_json, status: 'analyzing' }
        : { sequence: [], dictionary: {}, last_idx: -1, status: 'analyzing', metadata: initMeta };
      await supabase.from('reading_materials').update({ processed_json: statusJson }).eq('id', id);

      await analyzeText(rawText, controller.signal, {
        metadata: initMeta,
        existingJson: baseJson,
        onBatch: async ({ currentJson }) => {
          const { error: updateError } = await supabase
            .from('reading_materials')
            .update({ processed_json: currentJson })
            .eq('id', id);
          if (updateError) console.error('[reanalyze] DB update failed:', updateError.message);
        },
      });
    },
    onSuccess: () => {
      toast('재분석 완료!', 'success');
      refetch();
    },
    onError: (err) => {
      if (err.name !== 'AbortError') toast('재분석 실패: ' + err.message, 'error');
      refetch();
    },
  });

  // 스크롤 위치 저장 (debounce 2s, 로그인 + 분석 완료 시만)
  const scrollSaveTimerRef = useRef(null);
  const saveScrollPosition = useCallback((tokenIdx) => {
    if (!user) return;
    clearTimeout(scrollSaveTimerRef.current);
    scrollSaveTimerRef.current = setTimeout(async () => {
      await supabase.from('reading_progress').upsert({
        user_id: user.id,
        material_id: id,
        last_token_idx: tokenIdx,
      }, { onConflict: 'user_id,material_id' });
    }, 2000);
  }, [user, id]);

  // 읽기 진행률 바 (스크롤 기반)
  const readerRef = useRef(null);
  useEffect(() => {
    const el = readerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const rect = el.getBoundingClientRect();
      const total = el.scrollHeight - window.innerHeight;
      if (total <= 0) { setReadProgress(100); return; }
      const scrolled = -rect.top + 80; // header offset
      setReadProgress(Math.min(100, Math.max(0, Math.round((scrolled / total) * 100))));
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [material]);

  // 단어 저장 카운트 (복습 유도용)
  const saveCountRef = useRef(0);

  // 재진입 시 마지막 읽은 위치로 스크롤 복원
  const tokenRefs = useRef({});
  const hasRestoredScroll = useRef(false);
  useEffect(() => {
    const lastIdx = readingProgress?.last_token_idx;
    if (!lastIdx || hasRestoredScroll.current) return;
    const json = material?.processed_json;
    if (!json?.sequence?.length) return;
    const tokenId = json.sequence[lastIdx];
    if (!tokenId) return;
    // DOM이 렌더된 후 스크롤
    const timer = setTimeout(() => {
      const el = tokenRefs.current[tokenId];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        hasRestoredScroll.current = true;
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [readingProgress, material]);

  const handleTokenClick = (token, tokenId) => {
    if (token.pos === '개행') return;
    setSelectedToken({ ...token, id: tokenId });
    setIsSheetOpen(true);
    // 클릭한 토큰 인덱스를 스크롤 위치로 저장
    const json = material?.processed_json;
    if (json?.sequence) {
      const idx = json.sequence.indexOf(tokenId);
      if (idx >= 0) saveScrollPosition(idx);
    }
  };

  const handleTextSelection = () => {
    if (isGrammarModalOpen) return;
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 1) {
      setSelectedRangeText(text);
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      setSelectionPopup({
        x: rect.left + rect.width / 2,
        y: rect.top - 48,
      });
    } else {
      setSelectionPopup(null);
    }
  };

  async function generateQuiz(pendingCompletion) {
    const rawText = material?.raw_text || '';
    const lang = material?.processed_json?.metadata?.language || 'Japanese';
    const excerpt = rawText.slice(0, 1200);
    if (!excerpt.trim()) {
      setCompletionModal(pendingCompletion);
      return;
    }
    setQuizState({ status: 'loading', pendingCompletion });
    try {
      const prompt = `다음 ${lang === 'Japanese' ? '일본어' : '영어'} 텍스트를 읽고 내용 이해를 확인하는 객관식 문제 3개를 만들어주세요.

텍스트:
"""
${excerpt}
"""

규칙:
- 각 문제는 4개 선택지 (0~3번 인덱스)
- 정답은 텍스트에서 명확히 확인 가능해야 함
- 질문과 선택지는 한국어로 작성
- answer는 정답 인덱스 (0~3)

반드시 아래 JSON만 출력:
{"questions":[{"question":"...","options":["...","...","...","..."],"answer":0},{"question":"...","options":["...","...","...","..."],"answer":1},{"question":"...","options":["...","...","...","..."],"answer":2}]}`;

      const raw = await callGemini(prompt, null, { model: GEMINI_MODEL });
      const clean = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean.substring(clean.indexOf('{'), clean.lastIndexOf('}') + 1));
      setQuizState({
        status: 'active',
        questions: parsed.questions,
        currentQ: 0,
        score: 0,
        selected: null,
        pendingCompletion,
      });
    } catch {
      // 퀴즈 생성 실패 시 바로 완료 모달
      setCompletionModal(pendingCompletion);
    }
  }

  function handleQuizAnswer(optIdx) {
    setQuizState(prev => {
      if (prev.status !== 'active' || prev.selected !== null) return prev;
      const correct = prev.questions[prev.currentQ].answer === optIdx;
      const newScore = prev.score + (correct ? 1 : 0);
      const isLast = prev.currentQ === prev.questions.length - 1;
      if (isLast) {
        return { status: 'done', score: newScore, total: prev.questions.length, pendingCompletion: prev.pendingCompletion };
      }
      return { ...prev, selected: optIdx, score: newScore };
    });
  }

  function advanceQuiz() {
    setQuizState(prev => {
      if (prev.status !== 'active') return prev;
      return { ...prev, currentQ: prev.currentQ + 1, selected: null };
    });
  }

  function finishQuiz() {
    const { score, total, pendingCompletion } = quizState;
    setQuizState(null);
    setCompletionModal({ ...pendingCompletion, quizScore: score, quizTotal: total });
  }

  const openGrammarModal = () => {
    const text = window.getSelection().toString().trim() || selectedRangeText;
    if (!text) { toast('분석할 문장을 드래그해서 선택해주세요.', 'warning'); return; }
    setSelectedRangeText(text);
    setGrammarAnalysis('');
    setGrammarFollowUp('');
    setCheckedActions(new Set());
    setIsGrammarModalOpen(true);
    setSelectionPopup(null);
  };

  // 하위 호환: settings bar 버튼용
  const analyzeGrammar = openGrammarModal;

  const GRAMMAR_ACTIONS = [
    { key: 'translation', label: '🌐 전체 번역',   desc: '자연스러운 한국어 번역' },
    { key: 'breakdown',   label: '🔬 문장 분해',   desc: '주어/서술어/조사 구조 설명' },
    { key: 'grammar',     label: '📐 핵심 문법',   desc: '문법 패턴 + 예문' },
    { key: 'vocab',       label: '📖 어휘 체크',   desc: '핵심 단어·표현 정리' },
    { key: 'nuance',      label: '💬 뉘앙스·활용', desc: '실제 회화에서의 쓰임새' },
    { key: 'full',        label: '✨ 전체 분석',   desc: '번역+분해+문법+어휘 한번에' },
  ];

  async function requestGrammarAnalysis(types) {
    const text = selectedRangeText;
    const isJa = materialLang === 'Japanese';
    setIsGrammarLoading(true);
    setGrammarAnalysis('');

    const sectionPrompts = {
      translation: isJa
        ? `## 전체 번역\n반드시 아래 형식으로 출력:\n직역: (원문에 충실한 번역)\n의역: (자연스러운 한국어)\n뉘앙스: (두 번역 차이와 원문 어감, 2~3문장)`
        : `## 전체 번역\nOutput in this exact format:\n직역: (literal translation)\n의역: (natural Korean translation)\n뉘앙스: (difference and original nuance, 2~3 sentences)`,
      breakdown: isJa
        ? `## 문장 분해\n각 성분을 아래 형식으로 출력:\n주어: (해당 부분 + 간단 설명)\n서술어: (동사/형용사 원형과 활용형)\n목적어: (있을 경우)\n조사: (쓰인 조사와 선택 이유)\n참고: (전체 구조 요약 1~2문장)`
        : `## 문장 분해\nOutput each component in this format:\n주어: (subject + brief note)\n서술어: (verb/predicate form)\n목적어: (object if present)\n조사: (particles used and why)\n참고: (overall structure summary)`,
      grammar: isJa
        ? `## 핵심 문법 포인트\n문법 패턴마다 아래 형식으로 출력 (1~2개):\n패턴: (~형태 — 한 줄 요약)\n의미: (정확한 뜻과 뉘앙스)\n예문: (유사 예문 1개)\n활용법: (주의사항 또는 응용 팁)`
        : `## 핵심 문법 포인트\nFor each pattern (1~2):\n패턴: (pattern form — one-line summary)\n의미: (meaning and nuance)\n예문: (one example sentence)\n활용법: (usage tip or caution)`,
      vocab: isJa
        ? `## 어휘 체크\n핵심 단어마다 아래 형식으로 출력:\n단어: (표기 · 읽기 · 품사)\n의미: (한국어 뜻)\n예문: (짧은 예문 1개)\n참고: (관련 표현 또는 주의 사항, 있을 경우)`
        : `## 어휘 체크\nFor each key word:\n단어: (word · part of speech)\n의미: (Korean meaning)\n예문: (short example sentence)\n참고: (related expressions or notes if any)`,
      nuance: isJa
        ? `## 뉘앙스·활용\n아래 형식으로 출력:\n상황: (이 표현이 쓰이는 구체적 상황/관계)\n격식: (격식체 버전)\n반말: (반말/캐주얼 버전)\n유사표현: (비슷한 표현과 차이점)\n활용법: (실전 사용 시 주의점)`
        : `## 뉘앙스·활용\nOutput in this format:\n상황: (specific context/relationship where this is used)\n격식: (formal version)\n반말: (casual version)\n유사표현: (similar expressions and differences)\n활용법: (practical usage tip)`,
    };

    const activeTypes = types.includes('full')
      ? ['translation', 'breakdown', 'grammar', 'vocab', 'nuance']
      : types.filter(t => t !== 'full');

    let prompt;

    if (activeTypes.length === 1) {
      // 단일 선택: 기존 섹션 프롬프트 그대로
      const intro = isJa
        ? `일본어 문장 「${text}」를 분석해주세요. 한국어로 답변.\n\n`
        : `Analyze the English sentence "${text}". Answer in Korean.\n\n`;
      prompt = intro + sectionPrompts[activeTypes[0]];
    } else {
      // 복수 선택: 통합 프롬프트 — 중복 없이 자연스럽게
      const aspectLabels = {
        translation: isJa ? '전체 번역 (직역/의역/뉘앙스)' : '번역 (직역/의역/뉘앙스)',
        breakdown:   isJa ? '문장 구조 분해 (주어/서술어/조사)' : '문장 구조 분해',
        grammar:     isJa ? '핵심 문법 패턴 (패턴/의미/예문/활용법)' : '핵심 문법 패턴',
        vocab:       isJa ? '어휘 체크 (단어/의미/예문)' : '어휘 체크',
        nuance:      isJa ? '뉘앙스·활용 (상황/격식/반말/유사표현)' : '뉘앙스·활용',
      };
      const aspects = activeTypes.map(t => `- ${aspectLabels[t]}`).join('\n');
      const formatNote = isJa
        ? `각 항목의 정보를 아래 레이블 형식으로 출력하세요 (모든 항목에 적용):
직역: / 의역: / 뉘앙스: / 주어: / 서술어: / 목적어: / 조사: / 패턴: / 의미: / 예문: / 활용법: / 단어: / 상황: / 격식: / 반말: / 유사표현: / 참고:`
        : `Use these label formats throughout:
직역: / 의역: / 뉘앙스: / 주어: / 서술어: / 패턴: / 의미: / 예문: / 활용법: / 단어: / 상황: / 격식: / 반말: / 유사표현: / 참고:`;

      const labelExample = isJa
        ? `출력 형식 예시 (반드시 이 형식 준수):
## 전체 번역
직역: 오늘은 날씨가 좋다
의역: 오늘 날씨 정말 좋네
뉘앙스: ~는 대조 강조, 감탄 표현

## 문장 분해
주어: 今日は — 주제/대조 조사
서술어: いいですね — 정중한 감탄형`
        : `Output format example (must follow this format):
## 전체 번역
직역: The weather is nice today
의역: What great weather today
뉘앙스: Casual exclamatory tone`;

      prompt = isJa
        ? `일본어 문장 「${text}」에 대해 아래 항목을 분석해주세요. 한국어로 답변.

분석 항목:
${aspects}

규칙:
- 항목들을 자연스럽게 통합하되, 중복 내용은 한 번만 작성
- 각 섹션은 ## 소제목으로 구분
- 모든 핵심 정보는 반드시 "레이블: 내용" 형식으로 한 줄에 작성 (줄 바꿈 금지)
- 사용 가능한 레이블: 직역 의역 뉘앙스 주어 서술어 목적어 조사 패턴 의미 예문 활용법 단어 상황 격식 반말 유사표현 참고

${labelExample}`
        : `Analyze the English sentence "${text}" covering these aspects. Answer in Korean.

Aspects:
${aspects}

Rules:
- Integrate naturally, mention overlapping info only once
- Separate each section with ## heading
- Write all key info as "레이블: content" on a single line (no line break after colon)
- Available labels: 직역 의역 뉘앙스 주어 서술어 목적어 조사 패턴 의미 예문 활용법 단어 상황 격식 반말 유사표현 참고

${labelExample}`;
    }

    try {
      const result = await callGemini(prompt, null, { model: GEMINI_MODEL });
      setGrammarAnalysis(result);
      setGrammarFollowUp('');
    } catch (err) {
      setGrammarAnalysis('❌ 분석 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setIsGrammarLoading(false);
    }
  }

  async function askFollowUp() {
    const question = grammarFollowUp.trim();
    if (!question || isGrammarLoading || grammarFollowLoading) return;
    setGrammarFollowLoading(true);
    try {
      const prompt = `원문 문장: 「${selectedRangeText}」\n기존 분석:\n${grammarAnalysis}\n\n추가 질문: ${question}\n\n위 분석 맥락에서 질문에 답변해주세요. 한국어로, 간결하게.`;
      const answer = await callGemini(prompt, null, { model: GEMINI_MODEL });
      setGrammarAnalysis(prev => `${prev}\n\n---\n**Q: ${question}**\n${answer}`);
      setGrammarFollowUp('');
    } catch {
      toast('질문 처리에 실패했어요.', 'error');
    } finally {
      setGrammarFollowLoading(false);
    }
  }

  function extractSourceSentence(tokenId) {
    const sequence = json.sequence;
    const dictionary = json.dictionary;
    const idx = sequence.indexOf(tokenId);
    if (idx === -1) return '';

    let start = idx;
    let end = idx;

    // 앞으로 탐색 — 개행 또는 최대 15토큰
    for (let i = idx - 1; i >= 0 && idx - i <= 15; i--) {
      if (dictionary[sequence[i]]?.pos === '개행') break;
      start = i;
    }
    // 뒤로 탐색 — 개행 또는 최대 15토큰
    for (let i = idx + 1; i < sequence.length && i - idx <= 15; i++) {
      if (dictionary[sequence[i]]?.pos === '개행') break;
      end = i;
    }

    return sequence.slice(start, end + 1)
      .map(tid => dictionary[tid]?.text || '')
      .filter(t => t)
      .join('');
  }

  const addToVocab = async () => {
    if (!user) { toast('로그인이 필요합니다.', 'warning'); return; }
    if (!selectedToken) return;

    const sourceSentence = extractSourceSentence(selectedToken.id);

    try {
      const row = {
        user_id: user.id,
        word_text: selectedToken.text,
        furigana: selectedToken.furigana || '',
        meaning: selectedToken.meaning || '',
        pos: selectedToken.pos || '',
        next_review_at: new Date().toISOString(),
        language: material?.language || (/[\u3040-\u30ff\u4e00-\u9fff]/.test(selectedToken.text) ? 'Japanese' : 'English'),
        source_sentence: sourceSentence || null,
        source_material_id: id || null,
      };

      const { error: insertError } = await supabase
        .from('user_vocabulary')
        .upsert([row], { onConflict: 'user_id,word_text', ignoreDuplicates: true });

      if (insertError) throw insertError;
      saveCountRef.current += 1;

      // 저장 애니메이션 → 잠시 보여준 뒤 시트 닫기
      setSaveAnim(true);
      setTimeout(() => {
        setSaveAnim(false);
        setIsSheetOpen(false);
        toast(`"${selectedToken.text}" 단어장에 추가됐어요! ⭐ +${XP_REWARDS.WORD_SAVED} XP`, 'success');
        if (saveCountRef.current === 5) {
          setTimeout(() => toast('단어 5개 모았어요! 🧠 복습하러 가볼까요?', 'info', 5000), 600);
        } else if (saveCountRef.current === 10) {
          setTimeout(() => toast('벌써 10개! 💪 단어장에서 복습하면 기억이 오래가요', 'info', 5000), 600);
        }
      }, 800);

      queryClient.invalidateQueries({ queryKey: ['vocab-words', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['vocab', user?.id] });
      recordActivity(user.id, () => fetchProfile(user.id));
      const prevXP = profile?.xp ?? 0;
      awardXP(user.id, XP_REWARDS.WORD_SAVED, prevXP);
      checkLevelUp(prevXP, prevXP + XP_REWARDS.WORD_SAVED);
      checkAndAwardAchievements(user.id, { xp: prevXP, streak: profile?.streak_count }).then(newBadges => {
        newBadges.forEach(b => celebrate({ type: 'achievement', icon: b.icon, name: b.name, desc: b.desc }));
      });
    } catch (err) {
      toast('추가 실패: ' + err.message, 'error');
    }
  };

  if (isLoading) return <div className="page-container"><Spinner message="자료 해부 중..." /></div>;
  if (error) return (
    <div className="page-container" style={{ textAlign: 'center', paddingTop: '80px' }}>
      <div className="error-banner">❌ 에러: {error.message}</div>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
        <button onClick={() => refetch()} className="btn btn--primary">다시 시도</button>
        <a href="/materials" className="btn btn--secondary">자료실로 돌아가기</a>
      </div>
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
  const materialLang = material?.processed_json?.metadata?.language || 'Japanese';
  const status = material?.status || material?.processed_json?.status;
  const isAnalyzing = status === 'analyzing';
  const isFailed = status === 'failed';
  const isDone = status === 'completed' || status === 'partial';
  const isPartial = status === 'partial';
  const failedIndices = material?.processed_json?.failed_indices || [];
  const isCompleted = readingProgress?.is_completed === true;
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
        {user && savedWords.size > 0 && (
          <Link href="/vocab" className="viewer-vocab-counter">
            ⭐ {savedWords.size}개 수집 → 단어장
          </Link>
        )}
      </header>

      {/* Reading Progress Bar */}
      {isDone && (
        <div className="viewer-progress-bar" aria-label={`읽기 진행률 ${readProgress}%`}>
          <div className="viewer-progress-bar__fill" style={{ width: `${readProgress}%` }} />
          <span className="viewer-progress-bar__label">{readProgress}%</span>
        </div>
      )}

      {/* Settings Bar */}
      <div className={`card viewer-settings ${settingsOpen ? 'viewer-settings--open' : ''}`}>
        <button className="viewer-settings__toggle" onClick={() => setSettingsOpen(v => !v)}>
          ⚙️ 읽기 설정 {settingsOpen ? '▲' : '▼'}
        </button>
        <div className="viewer-settings__body">
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
            onClick={() => setShowFurigana(v => !v)}
            className={`grammar-btn ${showFurigana ? '' : 'grammar-btn--active'}`}
            title="후리가나 표시/숨김"
          >
            {showFurigana ? '🈳 후리가나 숨기기' : '🈳 후리가나 보이기'}
          </button>

          <button
            onClick={analyzeGrammar}
            disabled={isGrammarLoading}
            className={`grammar-btn ${selectedRangeText ? 'grammar-btn--active' : ''}`}
          >
            {isGrammarLoading ? '⏳ 분석 중...' : '💡 AI 문법 해설'}
          </button>

          {user?.id === material?.owner_id && !isAnalyzing && (
            reanalyzeMutation.isPending ? (
              <button onClick={stopReanalysis} className="grammar-btn grammar-btn--danger">
                ⏹ 분석 중단
              </button>
            ) : reanalyzeConfirm !== null ? (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {reanalyzeConfirm.fullReset ? '전체 재분석할까요?' : `실패 ${failedIndices.length}줄만 재분석할까요?`}
                </span>
                <button onClick={confirmReanalyze} className="grammar-btn grammar-btn--active" style={{ padding: '4px 10px' }}>확인</button>
                <button onClick={cancelReanalyze} className="grammar-btn" style={{ padding: '4px 10px' }}>취소</button>
              </div>
            ) : isPartial && failedIndices.length > 0 ? (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => requestReanalyze({ fullReset: false })}
                  className="grammar-btn grammar-btn--active"
                  title={`실패한 ${failedIndices.length}줄만 재분석`}
                >
                  ⚠️ 실패 {failedIndices.length}줄 재분석
                </button>
                <button onClick={() => requestReanalyze({ fullReset: true })} className="grammar-btn" title="전체 다시 분석">
                  🔄 전체
                </button>
              </div>
            ) : (
              <button onClick={() => requestReanalyze({ fullReset: true })} className="grammar-btn" title="원문을 다시 AI로 분석합니다">
                🔄 재분석
              </button>
            )
          )}

          {user && isDone && (
            isCompleted
              ? <span className="grammar-btn viewer-complete-badge">✅ 읽기 완료</span>
              : <button
                  onClick={() => markCompleteMutation.mutate()}
                  disabled={markCompleteMutation.isPending}
                  className="grammar-btn grammar-btn--complete"
                >
                  {markCompleteMutation.isPending ? '⏳...' : '✔ 읽기 완료 표시'}
                </button>
          )}
        </div>
        </div>{/* viewer-settings__body */}
      </div>

      {/* Reader Area */}
      <div
        ref={readerRef}
        className={`card reader-area reader-area--${theme}`}
        style={{ fontSize: `${fontSize}rem`, fontFamily, gap: `${lineGap}px ${charGap}rem` }}
      >
        {isAnalyzing && (
          <div className="analyzing-banner">
            <span>⏳ 실시간 AI 해부 분석이 진행 중입니다...</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => refetch()} className="analyzing-banner__refresh">새로고침</button>
              {user?.id === material?.owner_id && (
                reanalyzeMutation.isPending
                  ? <button onClick={stopReanalysis} className="analyzing-banner__refresh" style={{ background: 'var(--danger)' }}>⏹ 중단</button>
                  : reanalyzeConfirm !== null
                    ? <>
                        <button onClick={confirmReanalyze} className="analyzing-banner__refresh">확인</button>
                        <button onClick={cancelReanalyze} className="analyzing-banner__refresh" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>취소</button>
                      </>
                    : <button onClick={() => requestReanalyze({ fullReset: true })} className="analyzing-banner__refresh" style={{ background: 'var(--accent)' }}>🔄 재시작</button>
              )}
            </div>
          </div>
        )}

        {isFailed && (
          <div className="analyzing-banner analyzing-banner--error">
            <span>❌ 분석에 실패했습니다.</span>
            {reanalyzeMutation.isPending
              ? <button onClick={stopReanalysis} className="analyzing-banner__refresh" style={{ background: 'var(--danger)' }}>⏹ 중단</button>
              : reanalyzeConfirm !== null
                ? <>
                    <button onClick={confirmReanalyze} className="analyzing-banner__refresh">확인</button>
                    <button onClick={cancelReanalyze} className="analyzing-banner__refresh" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>취소</button>
                  </>
                : <button onClick={() => requestReanalyze({ fullReset: true })} className="analyzing-banner__refresh">🔄 재분석 요청</button>
            }
          </div>
        )}

        {isPartial && failedIndices.length > 0 && !reanalyzeMutation.isPending && (
          <div className="analyzing-banner analyzing-banner--warn">
            <span>⚠️ {failedIndices.length}개 단락을 분석하지 못했습니다. 아래 표시된 줄을 재시도할 수 있습니다.</span>
            {reanalyzeConfirm !== null
              ? <>
                  <button onClick={confirmReanalyze} className="analyzing-banner__refresh">확인</button>
                  <button onClick={cancelReanalyze} className="analyzing-banner__refresh" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>취소</button>
                </>
              : <button onClick={() => requestReanalyze({ fullReset: false })} className="analyzing-banner__refresh">실패 줄 재분석</button>
            }
          </div>
        )}

        {(() => {
          // 분석 중: raw_text 줄을 미리 보여주고 처리된 줄만 토큰으로 교체
          const rawLines = material?.raw_text?.split('\n') ?? [];
          const showRaw = isAnalyzing && rawLines.length > 0;

          // lineIdx → [tokenId, ...] 맵 구성
          const tokensByLine = new Map();
          if (showRaw) {
            json.sequence.forEach(tokenId => {
              const m = tokenId.match(/^(?:id|failed)_(\d+)_/);
              if (m) {
                const li = parseInt(m[1]);
                if (!tokensByLine.has(li)) tokensByLine.set(li, []);
                tokensByLine.get(li).push(tokenId);
              }
            });
          }

          const renderToken = (tokenId) => {
            const token = json.dictionary[tokenId];
            if (!token) return null;
            if (token.failed) {
              return (
                <div key={tokenId} ref={el => { if (el) tokenRefs.current[tokenId] = el; }}
                  className="word-token word-token--failed" title="분석 실패 — 재시도 버튼을 눌러주세요">
                  <span className="furigana" />
                  <span className="surface">{token.text}</span>
                  <span className="failed-marker">⚠️</span>
                </div>
              );
            }
            const isSaved = savedWords.has(token.text);
            const furiganaText = showFurigana && token.furigana
              ? trimOkurigana(token.text, token.furigana)
              : '';
            return (
              <div key={tokenId} ref={el => { if (el) tokenRefs.current[tokenId] = el; }}
                className={`word-token ${isSaved ? 'word-token--saved' : ''}`}
                onClick={() => handleTokenClick(token, tokenId)}>
                <span className="furigana">{furiganaText}</span>
                <span className="surface">{token.text}</span>
              </div>
            );
          };

          if (showRaw) {
            return rawLines.map((line, lineIdx) => {
              const lineTokens = tokensByLine.get(lineIdx);
              const isLast = lineIdx === rawLines.length - 1;
              return (
                <span key={lineIdx} style={{ display: 'contents' }}>
                  {lineTokens?.length > 0
                    ? lineTokens.map(renderToken)
                    : line.trim()
                      ? <span className="word-token--raw">{line}</span>
                      : null
                  }
                  {!isLast && <div className="line-break" />}
                </span>
              );
            });
          }

          // 분석 완료 후: 기존 sequence 렌더
          return json.sequence.map((tokenId) => {
            const token = json.dictionary[tokenId];
            if (!token) return null;
            if (token.pos === '개행') return <div key={tokenId} className="line-break" />;
            return renderToken(tokenId);
          });
        })()}

        {isDone && (
          <div className="reader-hint">
            💡 단어를 <strong>클릭</strong>하면 상세 정보, 문장을 <strong>드래그</strong>하면 AI 문법 해설
          </div>
        )}
      </div>

      {/* 💬 자료 댓글 */}
      <div className="card" style={{ marginTop: '24px', padding: '24px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '20px', color: 'var(--text-primary)' }}>
          💬 토론 {comments.length > 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.88rem' }}>({comments.length})</span>}
        </h3>

        {/* 댓글 목록 */}
        {comments.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
            {comments.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: '10px' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--primary-glow)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary-light)',
                }}>
                  {(c.author?.display_name || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {c.author?.display_name || '익명'}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {new Date(c.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                    {c.content}
                  </p>
                </div>
                {user?.id === c.user_id && (
                  <button
                    onClick={() => deleteCommentMutation.mutate(c.id)}
                    disabled={deleteCommentMutation.isPending}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', flexShrink: 0, alignSelf: 'flex-start', padding: '4px' }}
                    title="삭제"
                  >✕</button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '20px' }}>
            첫 번째 댓글을 남겨보세요.
          </p>
        )}

        {/* 댓글 입력 */}
        {user ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={commentInput}
              onChange={e => setCommentInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && commentInput.trim() && addCommentMutation.mutate(commentInput.trim())}
              placeholder="이 자료에 대해 이야기해보세요..."
              className="search-input"
              style={{ flex: 1 }}
              maxLength={500}
            />
            <Button
              size="sm"
              disabled={!commentInput.trim() || addCommentMutation.isPending}
              onClick={() => addCommentMutation.mutate(commentInput.trim())}
            >
              {addCommentMutation.isPending ? '...' : '등록'}
            </Button>
          </div>
        ) : (
          <Link href="/auth" className="btn btn--secondary btn--sm">
            로그인하고 댓글 남기기
          </Link>
        )}
      </div>

      {/* 텍스트 선택 시 플로팅 문법 해설 버튼 */}
      {selectionPopup && (
        <button
          className="grammar-float-btn"
          style={{ top: selectionPopup.y, left: selectionPopup.x }}
          onMouseDown={e => { e.preventDefault(); analyzeGrammar(); }}
        >
          💡 문법 해설
        </button>
      )}

      {/* Bottom Sheet */}
      {isSheetOpen && selectedToken && (
        <>
          <div className="overlay" onClick={() => setIsSheetOpen(false)} />
          <div className="bottom-sheet">
            <div className="bottom-sheet__handle" />
            <div className="bottom-sheet__header">
              <span className="bottom-sheet__pos">{selectedToken.pos}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 className="bottom-sheet__word">{selectedToken.text}</h3>
                {ttsSupported && (
                  <button
                    onClick={() => speak(selectedToken.text, materialLang)}
                    title="발음 듣기"
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-full)',
                      padding: '4px 10px',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      flexShrink: 0,
                    }}
                  >
                    🔊
                  </button>
                )}
              </div>
              {selectedToken.furigana && (() => { const f = trimOkurigana(selectedToken.text, selectedToken.furigana); return f ? <span className="bottom-sheet__furigana">[{f}]</span> : null; })()}
            </div>
            <p className="bottom-sheet__meaning">{selectedToken.meaning || '(뜻 정보 없음)'}</p>
            <div className="bottom-sheet__actions">
              {saveAnim ? (
                <div className="save-anim">
                  <div className="save-anim__burst" aria-hidden="true">
                    {Array.from({ length: 8 }, (_, i) => (
                      <span key={i} className="save-anim__star" style={{ '--angle': `${i * 45}deg` }}>⭐</span>
                    ))}
                  </div>
                  <span className="save-anim__check">✓ 저장 완료!</span>
                </div>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => setIsSheetOpen(false)} style={{ flex: 1 }}>닫기</Button>
                  {user ? (
                    isWordSaved
                      ? <Button variant="secondary" disabled style={{ flex: 2 }}>✓ 이미 저장됨</Button>
                      : <Button onClick={addToVocab} style={{ flex: 2 }}>⭐ 단어장에 추가</Button>
                  ) : (
                    <Link href="/auth" className="btn btn--primary" style={{ flex: 2, justifyContent: 'center' }}>🔒 로그인하고 저장하기</Link>
                  )}
                </>
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
              <div className="modal__quote">
                {materialLang === 'Japanese'
                  ? selectedRangeText.replace(/\s+/g, '')
                  : selectedRangeText}
              </div>

              {/* 분석 유형 선택 */}
              {!isGrammarLoading && (
                <div style={{ marginBottom: '16px' }}>
                  <div className="grammar-action-grid">
                    {GRAMMAR_ACTIONS.map(a => {
                      const checked = checkedActions.has(a.key);
                      return (
                        <button
                          key={a.key}
                          className={`grammar-action-btn ${checked ? 'grammar-action-btn--checked' : ''}`}
                          onClick={() => setCheckedActions(prev => {
                            const next = new Set(prev);
                            if (next.has(a.key)) next.delete(a.key); else next.add(a.key);
                            return next;
                          })}
                        >
                          <span className="grammar-action-btn__check">{checked ? '✓' : ''}</span>
                          <span className="grammar-action-btn__label">{a.label}</span>
                          <span className="grammar-action-btn__desc">{a.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                  {checkedActions.size === 0
                    ? <p style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '10px' }}>원하는 항목을 선택해주세요</p>
                    : <button
                        className="btn btn--primary"
                        style={{ width: '100%', marginTop: '10px' }}
                        onClick={() => requestGrammarAnalysis([...checkedActions])}
                      >
                        ✨ 분석 시작 ({checkedActions.size}개 선택)
                      </button>
                  }
                </div>
              )}

              {isGrammarLoading
                ? <Spinner message="AI가 문장을 해부하고 있습니다..." />
                : grammarAnalysis && (
                    <div className="md-body">
                      {preprocessMd(grammarAnalysis).split('\n').map((line, i) => {
                        const t = line.trim();
                        if (!t) return <div key={i} className="md-gap" />;
                        if (t.startsWith('### ')) return <h4 key={i} className="md-subsection">{t.slice(4)}</h4>;
                        if (t.startsWith('## '))  return <h3 key={i} className="md-section">{t.slice(3)}</h3>;
                        if (t.startsWith('# '))   return <h2 key={i} className="md-title">{t.slice(2)}</h2>;
                        if (t === '---') return <hr key={i} className="md-rule" />;

                        // 레이블: 내용 패턴 감지 → 등급별 스타일
                        const labelMatch = t.match(/^[\*_]*([가-힣A-Za-z·~]+(?:\s[가-힣A-Za-z]+)?)[\*_]*\s*[:：]\s*(.+)/);
                        if (labelMatch) {
                          const label = labelMatch[1].trim();
                          const content = labelMatch[2].trim();

                          const TIER1 = ['직역','의역','주어','서술어','목적어','보어','패턴','단어','상황','격식','반말'];
                          const TIER2 = ['예문','예시','의미','유사표현'];
                          const TIER3 = ['뉘앙스','차이','참고','활용법','조사','Note','Nuance'];

                          if (TIER1.includes(label)) {
                            return (
                              <div key={i} className="md-trans md-trans--main">
                                <span className="md-trans__label">{label}</span>
                                <span className="md-trans__text">{content}</span>
                              </div>
                            );
                          }
                          if (TIER2.includes(label)) {
                            return (
                              <div key={i} className="md-example">
                                <span className="md-example__label">{label}</span>
                                <span className="md-example__text">{content}</span>
                              </div>
                            );
                          }
                          if (TIER3.includes(label)) {
                            return (
                              <p key={i} className="md-nuance">
                                <span className="md-nuance__label">{label}</span>
                                {' '}{content}
                              </p>
                            );
                          }
                        }

                        // 번호 항목: "1." "1)" "① ②" 등
                        const numberedMatch = t.match(/^(\d+[.)]\s+|[①②③④⑤⑥⑦⑧⑨⑩]\s*)(.+)/);
                        if (numberedMatch) {
                          const num = numberedMatch[1].trim();
                          const content = numberedMatch[2];
                          const html = inlineFormat(content);
                          return (
                            <div key={i} className="md-numbered">
                              <span className="md-numbered__num">{num}</span>
                              <span dangerouslySetInnerHTML={{ __html: html }} />
                            </div>
                          );
                        }

                        // 불릿 항목: "- " "· "
                        if (t.startsWith('- ') || t.startsWith('· ')) {
                          const html = inlineFormat(t.slice(2));
                          return <div key={i} className="md-bullet" dangerouslySetInnerHTML={{ __html: html }} />;
                        }

                        const html = inlineFormat(t);
                        return <p key={i} className="md-p" dangerouslySetInnerHTML={{ __html: html }} />;
                      })}
                    </div>
                  )
              }
            </div>
            {!isGrammarLoading && grammarAnalysis && (
              <div className="modal__footer" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={grammarFollowUp}
                    onChange={e => setGrammarFollowUp(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && askFollowUp()}
                    placeholder="이 문장에 대해 질문하기..."
                    className="search-input"
                    style={{ flex: 1, fontSize: '0.88rem' }}
                    disabled={grammarFollowLoading}
                  />
                  <Button size="sm" onClick={askFollowUp} disabled={!grammarFollowUp.trim() || grammarFollowLoading}>
                    {grammarFollowLoading ? '...' : '질문'}
                  </Button>
                </div>
                {user && (
                  <button
                    onClick={() => saveGrammarNoteMutation.mutate()}
                    disabled={saveGrammarNoteMutation.isPending || saveGrammarNoteMutation.isSuccess}
                    className="btn btn--secondary btn--sm"
                  >
                    {saveGrammarNoteMutation.isSuccess ? '✅ 저장됨' : saveGrammarNoteMutation.isPending ? '저장 중...' : '📝 노트에 저장'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 이해도 퀴즈 모달 */}
      {quizState && (
        <div className="modal-overlay completion-overlay">
          <div className="modal completion-modal">
            {quizState.status === 'loading' && (
              <>
                <div className="completion-modal__fireworks">📝</div>
                <h2 className="completion-modal__title">이해도 확인 중...</h2>
                <Spinner message="AI가 퀴즈를 만들고 있어요" />
              </>
            )}

            {quizState.status === 'active' && (() => {
              const q = quizState.questions[quizState.currentQ];
              return (
                <>
                  <div className="modal__header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '20px' }}>
                    <h2 className="modal__title">📝 이해도 퀴즈</h2>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {quizState.currentQ + 1} / {quizState.questions.length}
                    </span>
                  </div>
                  <p style={{ fontSize: '1rem', fontWeight: 500, lineHeight: 1.6, marginBottom: '20px', color: 'var(--text-primary)' }}>
                    {q.question}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                    {q.options.map((opt, i) => {
                      const isSelected = quizState.selected === i;
                      const isCorrect = q.answer === i;
                      const revealed = quizState.selected !== null;
                      let bg = 'var(--bg-secondary)';
                      let border = 'var(--border)';
                      if (revealed) {
                        if (isCorrect) { bg = 'rgba(74,138,92,0.2)'; border = 'var(--accent)'; }
                        else if (isSelected) { bg = 'rgba(200,64,64,0.15)'; border = 'rgba(200,64,64,0.5)'; }
                      }
                      return (
                        <button key={i}
                          disabled={quizState.selected !== null}
                          onClick={() => handleQuizAnswer(i)}
                          style={{
                            padding: '12px 16px', background: bg,
                            border: `1px solid ${border}`, borderRadius: 'var(--radius-md)',
                            textAlign: 'left', cursor: revealed ? 'default' : 'pointer',
                            fontSize: '0.92rem', color: 'var(--text-primary)',
                            transition: 'background 0.2s, border-color 0.2s',
                          }}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {quizState.selected !== null && (
                    <Button onClick={advanceQuiz} style={{ width: '100%' }}>
                      다음 문제 →
                    </Button>
                  )}
                </>
              );
            })()}

            {quizState.status === 'done' && (
              <>
                <div className="completion-modal__fireworks">
                  {quizState.score === quizState.total ? '🏆' : quizState.score >= quizState.total / 2 ? '👍' : '📚'}
                </div>
                <h2 className="completion-modal__title">퀴즈 완료!</h2>
                <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)', margin: '12px 0' }}>
                  {quizState.score} / {quizState.total} 정답
                </p>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.9rem' }}>
                  {quizState.score === quizState.total
                    ? '완벽해요! 내용을 완전히 이해했네요.'
                    : quizState.score >= quizState.total / 2
                      ? '잘 읽었어요. 틀린 부분을 다시 확인해보세요.'
                      : '단어를 복습하고 다시 읽어보세요.'}
                </p>
                <Button onClick={finishQuiz} style={{ width: '100%' }}>
                  결과 확인하기 →
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 읽기 완료 요약 모달 */}
      {completionModal && (
        <div className="modal-overlay completion-overlay">
          <div className="modal completion-modal">
            <div className="completion-modal__fireworks">🎉</div>
            <h2 className="completion-modal__title">읽기 완료!</h2>
            <p className="completion-modal__subtitle">{material.title}</p>

            <div className="completion-stats">
              <div className="completion-stat">
                <span className="completion-stat__value">{completionModal.wordsSaved}</span>
                <span className="completion-stat__label">저장한 단어</span>
              </div>
              <div className="completion-stat completion-stat--divider" />
              <div className="completion-stat">
                <span className="completion-stat__value">🔥 {completionModal.streak}</span>
                <span className="completion-stat__label">일 연속</span>
              </div>
              <div className="completion-stat completion-stat--divider" />
              {completionModal.quizTotal != null ? (
                <div className="completion-stat">
                  <span className="completion-stat__value" style={{ color: completionModal.quizScore === completionModal.quizTotal ? 'var(--accent)' : 'var(--text-primary)' }}>
                    {completionModal.quizScore}/{completionModal.quizTotal}
                  </span>
                  <span className="completion-stat__label">퀴즈 정답</span>
                </div>
              ) : (
                <div className="completion-stat">
                  <span className="completion-stat__value">{completionModal.dueCount}</span>
                  <span className="completion-stat__label">복습 대기 중</span>
                </div>
              )}
            </div>

            <div className="completion-modal__actions">
              {completionModal.dueCount > 0 && (
                <a href="/vocab" className="btn btn--primary btn--md">
                  🧠 지금 복습하기 ({completionModal.dueCount}개)
                </a>
              )}

              {nextMaterial && (
                <a
                  href={`/viewer/${nextMaterial.id}`}
                  className="completion-next-card"
                >
                  <span className="completion-next-card__badge">다음 추천</span>
                  <span className="completion-next-card__flag">
                    {nextMaterial.processed_json?.metadata?.language === 'English' ? '🇬🇧' : '🇯🇵'}
                  </span>
                  <span className="completion-next-card__title">{nextMaterial.title}</span>
                  <span className="completion-next-card__arrow">→</span>
                </a>
              )}

              {!nextMaterial && completionModal.dueCount === 0 && (
                <a href="/materials" className="btn btn--primary btn--md">
                  📰 다른 자료 보기
                </a>
              )}

              <button
                onClick={() => setCompletionModal(null)}
                className="btn btn--ghost btn--md"
              >
                계속 읽기
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .modal__content--markdown { display: flex; flex-direction: column; gap: 8px; }
        .modal__content--markdown p { color: var(--text-primary); line-height: 1.7; }
        .modal__content--markdown strong { color: var(--primary-light); font-weight: 700; }
        .modal__content--markdown em { color: var(--accent); font-style: italic; }
        .modal__content--markdown code { background: var(--bg-secondary); padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 0.88em; }
        .md-h2 { font-size: 1.05rem; font-weight: 700; color: var(--primary-light); margin-top: 8px; }
        .md-h3 { font-size: 0.95rem; font-weight: 700; color: var(--accent); margin-top: 6px; }
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
