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
import { analyzeText } from '../lib/analyzeText';
import { recordActivity } from '../lib/streak';
import { awardXP, XP_REWARDS } from '../lib/xp';
import { checkAndAwardAchievements } from '../lib/achievements';
import { useCelebration } from '../lib/CelebrationContext';
import { useTTS } from '../lib/useTTS';
import { useViewerSettings } from '../lib/useViewerSettings';
import { useGrammarAnalysis, GRAMMAR_ACTIONS } from '../lib/useGrammarAnalysis';
import { useViewerQuiz } from '../lib/useViewerQuiz';
import { useReanalyze } from '../lib/useReanalyze';
import { useMaterialComments } from '../lib/useMaterialComments';
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
  if (!userId) return { byKey: new Map(), surfaces: new Set(), bases: new Set() };
  const { data, error } = await supabase
    .from('user_vocabulary')
    .select('id, word_text, base_form, meaning, pos, furigana, interval, ease_factor, repetitions, next_review_at, language')
    .eq('user_id', userId);
  if (error) return { byKey: new Map(), surfaces: new Set(), bases: new Set() };

  const byKey = new Map(); // 'surface:<text>' or 'base:<text>' → vocab row
  const surfaces = new Set();
  const bases = new Set();
  for (const v of data || []) {
    if (v.word_text) {
      surfaces.add(v.word_text);
      byKey.set(`surface:${v.word_text}`, v);
    }
    if (v.base_form) {
      bases.add(v.base_form);
      if (!byKey.has(`base:${v.base_form}`)) byKey.set(`base:${v.base_form}`, v);
    }
  }
  return { byKey, surfaces, bases };
}

function findSavedVocab(savedWords, token) {
  if (!token) return null;
  return savedWords.byKey?.get(`surface:${token.text}`)
    || (token.base_form && savedWords.byKey?.get(`base:${token.base_form}`))
    || null;
}

function isTokenSaved(savedWords, token) {
  return !!findSavedVocab(savedWords, token);
}

function isTokenDue(savedWords, token) {
  const v = findSavedVocab(savedWords, token);
  if (!v?.next_review_at) return false;
  return new Date(v.next_review_at) <= new Date();
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

  const { speak, supported: ttsSupported } = useTTS();
  const { celebrate, checkLevelUp } = useCelebration();

  // Custom hooks
  const settings = useViewerSettings();
  const { fontSize, setFontSize, lineGap, setLineGap, charGap, setCharGap,
          theme, setTheme, fontFamily, setFontFamily, showFurigana, setShowFurigana,
          settingsOpen, setSettingsOpen } = settings;

  const quiz = useViewerQuiz();
  const { quizState, completionModal, setCompletionModal, generateQuiz,
          handleQuizAnswer, advanceQuiz, finishQuiz } = quiz;

  const [selectedToken, setSelectedToken] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [readProgress, setReadProgress] = useState(0);
  const [saveAnim, setSaveAnim] = useState(false);

  const { data: material, isLoading, error, refetch } = useQuery({
    queryKey: ['material', id],
    queryFn: () => fetchMaterial(id),
    refetchInterval: (query) => {
      const d = query.state.data;
      const s = d?.status || d?.processed_json?.status;
      return s === 'analyzing' ? 4000 : false;
    },
  });

  const materialLang = material?.processed_json?.metadata?.language || 'Japanese';

  const grammar = useGrammarAnalysis({ toast, materialLang });
  const { isGrammarModalOpen, setIsGrammarModalOpen, grammarAnalysis,
          isGrammarLoading, selectedRangeText, checkedActions, setCheckedActions,
          selectionPopup, grammarFollowUp, setGrammarFollowUp,
          grammarFollowLoading, openGrammarModal, analyzeGrammar,
          requestGrammarAnalysis, analyzeWordInContext, askFollowUp,
          handleTextSelection: handleGrammarTextSelection } = grammar;

  const { data: savedWords = { byKey: new Map(), surfaces: new Set(), bases: new Set() } } = useQuery({
    queryKey: ['vocab-words', user?.id],
    queryFn: () => fetchUserVocabWords(user.id),
    enabled: !!user,
    staleTime: 1000 * 30,
  });

  // 자료와 연관된 공유 단어장 덱
  const { data: relatedDecks = [] } = useQuery({
    queryKey: ['related-decks', id, materialLang],
    queryFn: async () => {
      // 1순위: 이 자료 출처인 덱
      const { data: sourceDecks } = await supabase
        .from('vocab_decks')
        .select('id, title, language, word_count, created_at, owner:profiles(display_name)')
        .eq('source_material_id', id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (sourceDecks && sourceDecks.length >= 3) return sourceDecks;

      // 2순위: 같은 언어 인기 덱 (word_count 순)
      const exclude = sourceDecks?.map(d => d.id) || [];
      let query = supabase
        .from('vocab_decks')
        .select('id, title, language, word_count, created_at, owner:profiles(display_name)')
        .eq('language', materialLang)
        .order('word_count', { ascending: false })
        .limit(3 - (sourceDecks?.length || 0));
      if (exclude.length) query = query.not('id', 'in', `(${exclude.join(',')})`);

      const { data: langDecks } = await query;
      return [...(sourceDecks || []), ...(langDecks || [])];
    },
    enabled: !!id && !!materialLang,
    staleTime: 1000 * 60 * 5,
  });

  // PDF 출처 메타 (있으면)
  const { data: sourcePdf } = useQuery({
    queryKey: ['source-pdf', material?.source_pdf_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('uploaded_pdfs')
        .select('id, title, page_count, storage_path, language, level')
        .eq('id', material.source_pdf_id)
        .maybeSingle();
      return data;
    },
    enabled: !!material?.source_pdf_id,
  });

  // 다음 범위 분석 (PDF 출처일 때만)
  const nextRangeMutation = useMutation({
    mutationFn: async ({ chunkSize = 5 } = {}) => {
      if (!sourcePdf || !material?.page_end) throw new Error('PDF 출처 정보 없음');
      const nextStart = material.page_end + 1;
      if (nextStart > sourcePdf.page_count) throw new Error('PDF 끝에 도달했습니다.');
      const nextEnd = Math.min(nextStart + chunkSize - 1, sourcePdf.page_count);

      const { extractPageRange, getPdfMetadata, ocrPageRange } = await import('../lib/pdfExtract');
      const { getCachedPdf, cachePdf } = await import('../lib/pdfCache');

      // 캐시 먼저, 없으면 Storage에서 다운로드
      let buffer = await getCachedPdf(sourcePdf.id);
      if (!buffer) {
        const { data: signed } = await supabase.storage
          .from('user-pdfs')
          .createSignedUrl(sourcePdf.storage_path, 60);
        if (!signed?.signedUrl) throw new Error('PDF 접근 실패');
        const res = await fetch(signed.signedUrl);
        buffer = await res.arrayBuffer();
        cachePdf(sourcePdf.id, buffer).catch(() => {});
      }

      // 1차: 일반 추출 시도
      let text = await extractPageRange(buffer, nextStart, nextEnd);

      // 텍스트가 너무 적으면 OCR 자동 폴백
      if (!text || text.length < 30) {
        toast('📷 스캔본으로 감지 — OCR로 재시도합니다 (시간이 걸려요)', 'info', 4000);
        const { doc } = await getPdfMetadata(buffer);
        text = await ocrPageRange(doc, nextStart, nextEnd);
      }

      if (!text || text.length < 30) throw new Error('추출된 텍스트가 너무 적습니다.');

      // 새 material 생성
      const initJson = {
        sequence: [], dictionary: {}, last_idx: -1, status: 'analyzing',
        metadata: {
          language: sourcePdf.language || 'Japanese',
          level: sourcePdf.level,
          updated_at: new Date().toISOString(),
        },
      };
      const { data: inserted, error } = await supabase
        .from('reading_materials')
        .insert({
          title: `${sourcePdf.title} (p.${nextStart}-${nextEnd})`,
          raw_text: text,
          processed_json: initJson,
          visibility: 'private',
          owner_id: user.id,
          source_pdf_id: sourcePdf.id,
          page_start: nextStart,
          page_end: nextEnd,
        })
        .select()
        .single();
      if (error) throw error;

      // last_page_read 업데이트 (fire-and-forget)
      supabase.from('uploaded_pdfs').update({ last_page_read: nextEnd }).eq('id', sourcePdf.id).then(() => {});

      // 백그라운드 분석 시작 (fire-and-forget) — 리다이렉트 후에도 계속 실행됨
      (async () => {
        try {
          const finalJson = await analyzeText(text, new AbortController().signal, {
            metadata: initJson.metadata,
            concurrency: 8,
            onBatch: async ({ currentJson }) => {
              await supabase.from('reading_materials')
                .update({ processed_json: currentJson })
                .eq('id', inserted.id);
            },
          });
          await supabase.from('reading_materials')
            .update({ processed_json: finalJson })
            .eq('id', inserted.id);
        } catch (e) {
          console.error('[next-range analyze]', e?.message);
        }
      })();

      return inserted;
    },
    onSuccess: (inserted) => {
      toast('📖 다음 범위 분석 시작! 뷰어로 이동합니다', 'success');
      window.location.href = `/viewer/${inserted.id}`;
    },
    onError: (err) => toast('다음 범위 생성 실패: ' + err.message, 'error'),
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

  // 댓글 로직 (훅)
  const materialComments = useMaterialComments({ materialId: id, user, toast });
  const comments = materialComments.comments;
  const addCommentMutation = materialComments.addMutation;
  const deleteCommentMutation = materialComments.deleteMutation;

  // addMutation 성공 시 입력창 리셋 처리
  useEffect(() => {
    if (addCommentMutation.isSuccess) setCommentInput('');
  }, [addCommentMutation.isSuccess]);

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
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['reading-progress', user?.id, id] });
      queryClient.invalidateQueries({ queryKey: ['reading-progress-list', user?.id] });
      recordActivity(user.id, () => fetchProfile(user.id));
      const prevXP = profile?.xp ?? 0;
      try {
        await awardXP(user.id, XP_REWARDS.MATERIAL_COMPLETED, prevXP);
        checkLevelUp(prevXP, prevXP + XP_REWARDS.MATERIAL_COMPLETED);
        checkAndAwardAchievements(user.id, { xp: prevXP, streak: profile?.streak_count }).then(newBadges => {
          newBadges.forEach(b => celebrate({ type: 'achievement', icon: b.icon, name: b.name, desc: b.desc }));
        });
      } catch {
        console.error('XP 부여 실패 — 완독 기록은 저장됨');
      }
      // 퀴즈 생성 후 완료 모달 표시
      const pendingCompletion = {
        wordsSaved: data.wordsSaved,
        dueCount: data.dueCount,
        streak: (profile?.streak_count || 0) + 1,
      };
      const rawText = material?.raw_text || '';
      const lang = material?.processed_json?.metadata?.language || 'Japanese';
      generateQuiz(rawText, lang, pendingCompletion);
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

  // 재분석 로직 (훅으로 분리)
  const reanalyze = useReanalyze({ materialId: id, material, refetch, toast });
  const reanalyzeMutation = reanalyze.mutation;
  const reanalyzeConfirm = reanalyze.confirmState;
  const requestReanalyze = reanalyze.request;
  const confirmReanalyze = reanalyze.confirm;
  const cancelReanalyze = reanalyze.cancel;
  const stopReanalysis = reanalyze.stop;
  const isStaleAnalysis = reanalyze.stale;
  const missingLineCount = reanalyze.missingIndices.length;

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

  const handleTextSelection = () => handleGrammarTextSelection(isGrammarModalOpen);



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

  // 인라인 복습: 뷰어에서 단어 보며 바로 FSRS 평가
  const inlineReviewMutation = useMutation({
    mutationFn: async ({ vocab, rating }) => {
      const { calculateFSRS } = await import('../lib/fsrs');
      const nextStats = calculateFSRS(rating, {
        interval: vocab.interval ?? 0,
        ease_factor: vocab.ease_factor ?? 0,
        repetitions: vocab.repetitions ?? 0,
        next_review_at: vocab.next_review_at,
      });
      const { error } = await supabase
        .from('user_vocabulary')
        .update({ ...nextStats, last_reviewed_at: new Date().toISOString() })
        .eq('id', vocab.id);
      if (error) throw error;
      return { vocab, rating, nextStats };
    },
    onSuccess: async ({ rating }) => {
      queryClient.invalidateQueries({ queryKey: ['vocab-words', user?.id] });
      const prevXP = profile?.xp ?? 0;
      const xp = rating === 3 ? 12 : rating === 1 ? 5 : 8;
      const { awardXP } = await import('../lib/xp');
      awardXP(user.id, xp, prevXP);
      recordActivity(user.id, () => fetchProfile(user.id));
      toast(`복습 완료! +${xp} XP`, 'success', 2000);
    },
    onError: (err) => toast('복습 저장 실패: ' + err.message, 'error'),
  });

  const correctTokenMutation = useMutation({
    mutationFn: async ({ tokenId, corrections }) => {
      const currentJson = material?.processed_json;
      if (!currentJson?.dictionary?.[tokenId]) throw new Error('토큰을 찾을 수 없습니다.');

      const beforeToken = currentJson.dictionary[tokenId];
      const updatedDict = {
        ...currentJson.dictionary,
        [tokenId]: { ...beforeToken, ...corrections },
      };
      const updatedJson = { ...currentJson, dictionary: updatedDict };

      const { error } = await supabase
        .from('reading_materials')
        .update({ processed_json: updatedJson })
        .eq('id', id);
      if (error) throw error;

      // 교정 히스토리 로그 (실패해도 수정 자체는 유지)
      if (user?.id) {
        const beforeSlim = {
          furigana: beforeToken.furigana || '',
          meaning: beforeToken.meaning || '',
          pos: beforeToken.pos || '',
        };
        await supabase.from('token_corrections').insert({
          material_id: id,
          token_id: tokenId,
          user_id: user.id,
          before_value: beforeSlim,
          after_value: corrections,
        }).then(({ error: logErr }) => {
          if (logErr) console.warn('[correction log] failed:', logErr.message);
        });
      }
      return { tokenId, corrections };
    },
    onSuccess: ({ tokenId, corrections }) => {
      queryClient.invalidateQueries({ queryKey: ['material', id] });
      queryClient.invalidateQueries({ queryKey: ['token-corrections', id, tokenId] });
      // BottomSheet에 표시되는 selectedToken도 업데이트
      setSelectedToken(prev => prev?.id === tokenId ? { ...prev, ...corrections } : prev);
      toast('수정이 저장됐어요!', 'success');
    },
    onError: (err) => toast('수정 실패: ' + err.message, 'error'),
  });

  // 선택된 토큰의 교정 히스토리 조회
  const { data: tokenCorrections = [] } = useQuery({
    queryKey: ['token-corrections', id, selectedToken?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('token_corrections')
        .select('id, before_value, after_value, created_at, user_id, profiles:user_id(display_name)')
        .eq('material_id', id)
        .eq('token_id', selectedToken.id)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!selectedToken?.id && isSheetOpen,
    staleTime: 1000 * 30,
  });

  const handleCorrectToken = (tokenId, corrections) => {
    correctTokenMutation.mutate({ tokenId, corrections });
  };

  const addToVocab = async () => {
    if (!user) { toast('로그인이 필요합니다.', 'warning'); return; }
    if (!selectedToken) return;

    const sourceSentence = extractSourceSentence(selectedToken.id);

    try {
      const row = {
        user_id: user.id,
        word_text: selectedToken.text,
        base_form: selectedToken.base_form || selectedToken.text, // kuromoji 경로에서 전달됨
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
  const status = material?.status || material?.processed_json?.status;
  const isAnalyzing = status === 'analyzing';
  const isFailed = status === 'failed';
  const isDone = status === 'completed' || status === 'partial';
  const isPartial = status === 'partial';
  const failedIndices = material?.processed_json?.failed_indices || [];
  const isCompleted = readingProgress?.is_completed === true;
  const isWordSaved = isTokenSaved(savedWords, selectedToken);
  const savedCount = (savedWords.surfaces?.size || 0);

  // 이 자료에서 복습 가능한 단어 수 (현재 로드된 토큰 기준)
  const dueInMaterial = (() => {
    if (!savedWords.byKey || !material?.processed_json?.dictionary) return 0;
    const dict = material.processed_json.dictionary;
    let count = 0;
    const seen = new Set();
    for (const tokenId of material.processed_json.sequence || []) {
      const t = dict[tokenId];
      if (!t || t.pos === '개행') continue;
      const vocab = findSavedVocab(savedWords, t);
      if (vocab?.next_review_at && new Date(vocab.next_review_at) <= new Date() && !seen.has(vocab.id)) {
        seen.add(vocab.id);
        count++;
      }
    }
    return count;
  })();

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
        {user && savedCount > 0 && (
          <Link href="/vocab" className="viewer-vocab-counter">
            ⭐ {savedCount}개 수집 → 단어장
          </Link>
        )}
        {user && dueInMaterial > 0 && (
          <div style={{
            padding: '4px 10px', borderRadius: 'var(--radius-full)',
            background: 'rgba(212,150,42,0.15)', border: '1px solid var(--warning)',
            color: 'var(--warning)', fontSize: '0.78rem', fontWeight: 600,
          }} title="노란 테두리 단어 클릭 → 인라인 복습">
            🧠 {dueInMaterial}개 복습 가능
          </div>
        )}
      </header>

      {/* PDF 출처 배지 + 다음 범위 분석 */}
      {sourcePdf && material.page_start && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px', marginBottom: 12,
          background: 'var(--primary-glow)', border: '1px solid var(--primary)',
          borderRadius: 'var(--radius-md)', flexWrap: 'wrap', gap: 10,
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 700 }}>
              📘 PDF 출처
            </div>
            <div style={{ fontSize: '0.88rem', marginTop: 2 }}>
              <strong>{sourcePdf.title}</strong> · p.{material.page_start}-{material.page_end}
              <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: '0.78rem' }}>
                (총 {sourcePdf.page_count}p)
              </span>
            </div>
          </div>
          {material.page_end < sourcePdf.page_count && (
            <button
              onClick={() => nextRangeMutation.mutate({ chunkSize: 5 })}
              disabled={nextRangeMutation.isPending}
              className="btn btn--accent btn--sm"
              title={`p.${material.page_end + 1}부터 분석`}
            >
              {nextRangeMutation.isPending
                ? '⏳ 추출 중...'
                : `다음 p.${material.page_end + 1}-${Math.min(material.page_end + 5, sourcePdf.page_count)} 분석 →`}
            </button>
          )}
        </div>
      )}

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
        {isAnalyzing && !isStaleAnalysis && (
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

        {/* 중단된 분석 복구 배너 */}
        {isStaleAnalysis && user?.id === material?.owner_id && (
          <div className="analyzing-banner" style={{ background: 'rgba(252,196,25,0.1)', borderColor: 'rgba(252,196,25,0.4)' }}>
            <span>
              ⚠️ 분석이 중단된 것 같아요
              {missingLineCount > 0 && ` (남은 ${missingLineCount}줄)`}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {reanalyzeMutation.isPending ? (
                <button onClick={stopReanalysis} className="analyzing-banner__refresh" style={{ background: 'var(--danger)' }}>⏹ 중단</button>
              ) : missingLineCount > 0 ? (
                <button
                  onClick={() => reanalyze.mutation.mutate({ resume: true })}
                  className="analyzing-banner__refresh"
                  style={{ background: 'var(--accent)' }}
                >
                  ▶ 이어서 분석하기
                </button>
              ) : (
                <button
                  onClick={() => requestReanalyze({ fullReset: true })}
                  className="analyzing-banner__refresh"
                  style={{ background: 'var(--accent)' }}
                >
                  🔄 처음부터 재분석
                </button>
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
            const isSaved = isTokenSaved(savedWords, token);
            const isDue = isSaved && isTokenDue(savedWords, token);
            const furiganaText = showFurigana && token.furigana
              ? trimOkurigana(token.text, token.furigana)
              : '';
            return (
              <div key={tokenId} ref={el => { if (el) tokenRefs.current[tokenId] = el; }}
                className={`word-token ${isSaved ? 'word-token--saved' : ''} ${isDue ? 'word-token--due' : ''}`}
                role="button" tabIndex={0}
                onClick={() => handleTokenClick(token, tokenId)}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), handleTokenClick(token, tokenId))}>
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

      {/* 관련 공유 단어장 덱 */}
      {isDone && relatedDecks.length > 0 && (
        <div className="card" style={{ marginTop: 16, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
              🃏 이 자료와 관련된 공유 단어장
            </h3>
            <Link href="/vocab?tab=decks" style={{ fontSize: '0.78rem', color: 'var(--primary-light)' }}>
              전체 보기 →
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {relatedDecks.map(deck => (
              <Link
                key={deck.id}
                href={`/vocab?tab=decks&deckId=${deck.id}`}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)', textDecoration: 'none',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{deck.title}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {deck.owner?.display_name || '익명'} · {deck.word_count}단어
                  </span>
                </div>
                <span style={{
                  padding: '3px 10px', borderRadius: 'var(--radius-full)',
                  background: 'var(--primary-glow)', color: 'var(--primary)',
                  fontSize: '0.72rem', fontWeight: 600,
                }}>
                  {deck.language === 'Japanese' ? '🇯🇵' : '🇬🇧'} {deck.language}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <ViewerComments
        user={user} comments={comments} commentInput={commentInput}
        setCommentInput={setCommentInput} addCommentMutation={addCommentMutation}
        deleteCommentMutation={deleteCommentMutation}
      />

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

      <ViewerBottomSheet
        selectedToken={selectedToken} isSheetOpen={isSheetOpen} setIsSheetOpen={setIsSheetOpen}
        ttsSupported={ttsSupported} speak={speak} materialLang={materialLang}
        isWordSaved={isWordSaved} saveAnim={saveAnim} addToVocab={addToVocab}
        user={user} trimOkurigana={trimOkurigana}
        onCorrectToken={handleCorrectToken}
        corrections={tokenCorrections}
        onAnalyzeContext={() => {
          if (!selectedToken?.id) return;
          const sentence = extractSourceSentence(selectedToken.id);
          analyzeWordInContext(selectedToken, sentence);
          setIsSheetOpen(false);
        }}
        reviewableVocab={findSavedVocab(savedWords, selectedToken)}
        isReviewDue={selectedToken ? isTokenDue(savedWords, selectedToken) : false}
        onReview={(rating) => {
          const vocab = findSavedVocab(savedWords, selectedToken);
          if (!vocab) return;
          inlineReviewMutation.mutate({ vocab, rating });
          setIsSheetOpen(false);
        }}
      />

      <ViewerGrammarModal
        isOpen={isGrammarModalOpen} onClose={() => setIsGrammarModalOpen(false)}
        selectedRangeText={selectedRangeText} materialLang={materialLang}
        isGrammarLoading={isGrammarLoading} grammarAnalysis={grammarAnalysis}
        checkedActions={checkedActions} setCheckedActions={setCheckedActions}
        GRAMMAR_ACTIONS={GRAMMAR_ACTIONS} requestGrammarAnalysis={requestGrammarAnalysis}
        grammarFollowUp={grammarFollowUp} setGrammarFollowUp={setGrammarFollowUp}
        grammarFollowLoading={grammarFollowLoading} askFollowUp={askFollowUp}
        saveGrammarNoteMutation={saveGrammarNoteMutation} user={user}
      />

      <ViewerQuizModal
        quizState={quizState} handleQuizAnswer={handleQuizAnswer}
        advanceQuiz={advanceQuiz} finishQuiz={finishQuiz}
        completionModal={completionModal} setCompletionModal={setCompletionModal}
        material={material} nextMaterial={nextMaterial}
      />

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
