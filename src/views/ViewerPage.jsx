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
import { useReanalyze, getParagraphs } from '../lib/useReanalyze';
import { useMaterialComments } from '../lib/useMaterialComments';
import { friendlyToastMessage } from '../lib/errorMessage';
import { callGemini } from '../lib/gemini';
import { fetchWordDetailText } from '../lib/wordDetail';
import ReportMaterialButton from '../components/ReportMaterialButton';
import ReadingTest from '../components/ReadingTest';
import ConversationPanel from '../components/ConversationPanel';
import ViewerBottomSheet from '../components/ViewerBottomSheet';
import ListenControls from '../components/ListenControls';
import ViewerComments from './ViewerComments';
import ViewerGrammarModal from './ViewerGrammarModal';
import ViewerQuizModal from './ViewerQuizModal';

async function fetchMaterial(id) {
  const { data, error } = await supabase
    .from('reading_materials')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const err = new Error('NOT_FOUND');
    err.code = 'NOT_FOUND';
    throw err;
  }
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
 * 한자·히라가나 혼합 토큰을 ruby 세그먼트로 분리.
 * 例: 取りまとめ + とりまとめ → [{kanji:"取", reading:"と"}, {plain:"りまとめ"}]
 *     引っ張る   + ひっぱる   → [{kanji:"引", reading:"ひ"}, {plain:"っ"}, {kanji:"張", reading:"ぱ"}, {plain:"る"}]
 *     今日       + きょう     → [{kanji:"今日", reading:"きょう"}]
 *
 * 알고리즘: surface의 히라가나 구간을 앵커로 reading을 분할 → 한자 구간에 읽기 할당
 */
function splitRuby(text, furigana) {
  if (!furigana) return [{ plain: text }];

  const KANJI = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/;
  const isKanji = ch => KANJI.test(ch);

  // 1. surface를 [kanji 구간, hira 구간, ...] 으로 분할
  const segments = [];
  let i = 0;
  while (i < text.length) {
    if (isKanji(text[i])) {
      let j = i;
      while (j < text.length && isKanji(text[j])) j++;
      segments.push({ type: 'kanji', text: text.slice(i, j) });
      i = j;
    } else {
      let j = i;
      while (j < text.length && !isKanji(text[j])) j++;
      segments.push({ type: 'plain', text: text.slice(i, j) });
      i = j;
    }
  }

  // 한자가 없으면 plain으로 반환
  if (!segments.some(s => s.type === 'kanji')) return [{ plain: text }];

  // 2. hira 구간들을 앵커로 regex를 만들어 reading을 분할
  //    한자 구간 → (.+?)  /  hira 구간 → 리터럴 이스케이프
  const regexParts = segments.map(s =>
    s.type === 'kanji' ? '(.+?)' : s.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  // 마지막 한자 캡처는 greedy로 (.+)
  const lastKanjiIdx = regexParts.lastIndexOf('(.+?)');
  if (lastKanjiIdx !== -1) regexParts[lastKanjiIdx] = '(.+)';

  try {
    const regex = new RegExp('^' + regexParts.join('') + '$');
    const match = furigana.match(regex);
    if (match) {
      let groupIdx = 1;
      return segments.map(s => {
        if (s.type === 'kanji') {
          return { kanji: s.text, reading: match[groupIdx++] };
        }
        return { plain: s.text };
      });
    }
  } catch {}

  // regex 실패 시 fallback: 전체 한자에 전체 reading
  return segments.map(s =>
    s.type === 'kanji' ? { kanji: s.text, reading: furigana } : { plain: s.text }
  );
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
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

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
    onError: (err) => toast('다음 범위 생성 실패 — ' + friendlyToastMessage(err), 'error'),
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
    onError: (err) => toast(friendlyToastMessage(err), 'error'),
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
    onError: (err) => toast('저장 실패 — ' + friendlyToastMessage(err), 'error'),
  });

  // 재분석 로직
  const reanalyze = useReanalyze({ materialId: id, material, refetch, toast });
  const reanalyzeMutation = reanalyze.mutation;
  const stopReanalysis = reanalyze.stop;
  const isStaleAnalysis = reanalyze.stale;
  const missingLineCount = reanalyze.missingIndices.length;

  // 재분석 패널 상태: null | 'menu' | 'pick'
  const [reanalyzePanel, setReanalyzePanel] = useState(null);
  const [selectedParas, setSelectedParas] = useState(new Set());

  const paragraphs = material?.raw_text ? getParagraphs(material.raw_text) : [];

  function togglePara(idx) {
    setSelectedParas(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }
  function startFullReanalyze() {
    setReanalyzePanel(null);
    reanalyze.mutation.mutate({ fullReset: true });
  }
  function startPartialReanalyze() {
    const lineIndices = new Set();
    for (const pi of selectedParas) {
      const para = paragraphs[pi];
      if (para) para.lineIndices.forEach(li => lineIndices.add(li));
    }
    if (lineIndices.size === 0) { toast('문단을 선택해주세요.', 'warning'); return; }
    setReanalyzePanel(null);
    setSelectedParas(new Set());
    reanalyze.mutation.mutate({ selectedLineIndices: lineIndices });
  }

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
    const t = { ...token, id: tokenId };
    setSelectedToken(t);
    setIsSheetOpen(true);
    setDragTokens(null);
    setWordDetail(null);
    // 클릭한 토큰 인덱스를 스크롤 위치로 저장
    const json = material?.processed_json;
    if (json?.sequence) {
      const idx = json.sequence.indexOf(tokenId);
      if (idx >= 0) saveScrollPosition(idx);
    }
  };

  // 왼쪽 패널: 번역 + 맥락
  const [leftPanelText, setLeftPanelText] = useState('');
  const [leftPanelResult, setLeftPanelResult] = useState('');
  const [leftPanelLoading, setLeftPanelLoading] = useState(false);

  // 단어 상세 AI 설명
  const [wordDetail, setWordDetail] = useState(null); // { detail, loading }
  const isClient = typeof window !== 'undefined';
  function getDetailCached(key) { if (!isClient) return null; try { return JSON.parse(localStorage.getItem(`pdf_cache:detail:${key}`)); } catch { return null; } }
  function setDetailCached(key, val) { if (!isClient) return; try { localStorage.setItem(`pdf_cache:detail:${key}`, JSON.stringify(val)); } catch {} }

  function formatDetail(text) {
    if (!text) return '';
    const lines = text.split('\n').map(l => l.trim()).filter(l => l !== '-');
    const startIdx = lines.findIndex(l => l.startsWith('**'));
    const cleaned = (startIdx > 0 ? lines.slice(startIdx) : lines).join('\n');
    return cleaned
      .replace(/\*\*(.+?)\*\*/g, (_, m) => {
        if (/^(발음|뜻|뉘앙스|예문)$/.test(m.trim())) return `<hr class="pdf-detail-hr" /><strong class="pdf-detail-heading">${m}</strong>`;
        return `<strong>${m}</strong>`;
      })
      .split('\n').map(l => l.trim()).filter(Boolean).join('<br />')
      .replace(/(<br \/>){2,}/g, '</p><p>')
      .replace(/^/, '<p>').replace(/$/, '</p>');
  }

  async function fetchWordDetail(token) {
    setWordDetail({ detail: null, loading: true });
    try {
      const detail = await fetchWordDetailText(token, materialLang);
      setWordDetail({ detail, loading: false });
    } catch {
      setWordDetail({ detail: '설명을 가져올 수 없었어요.', loading: false });
    }
  }

  // 오른쪽 패널: 드래그 시 단어 리스트 모드
  const [dragTokens, setDragTokens] = useState(null); // null이면 단일 클릭 모드
  const [dragAnalyzing, setDragAnalyzing] = useState(false);

  // 리딩 테스트
  const [showReadingTest, setShowReadingTest] = useState(false);
  // 회화 연습
  const [showConversation, setShowConversation] = useState(false);

  // 드래그 단어 클릭 → 팝업 (PDF와 동일)
  const [popupWord, setPopupWord] = useState(null); // { token, detail, loading }

  async function handleDragWordClick(token) {
    setPopupWord({ token, detail: null, loading: true });
    try {
      const detail = await fetchWordDetailText(token, materialLang);
      setPopupWord({ token, detail, loading: false });
    } catch {
      setPopupWord(prev => prev ? { ...prev, detail: '설명을 가져올 수 없었어요.', loading: false } : null);
    }
  }

  const handleTextSelection = () => {
    handleGrammarTextSelection(isGrammarModalOpen);
    setTimeout(async () => {
      const sel = window.getSelection()?.toString()?.trim();
      if (!sel || sel.length < 2) return;

      // 왼쪽: 번역+맥락
      setLeftPanelText(sel);
      setLeftPanelLoading(true);
      setLeftPanelResult('');

      // 오른쪽: 드래그 선택 문장의 단어 추출
      setDragAnalyzing(true);
      setDragTokens([]);
      setSelectedToken(null);
      setIsSheetOpen(false);

      // 번역+맥락 localStorage 캐시 (lang:hash)
      const langName = materialLang === 'Japanese' ? '일본어' : '영어';
      const cacheKey = `viewer_tx:${materialLang}:${sel.slice(0, 200)}`;
      const cached = (() => { try { return localStorage.getItem(cacheKey); } catch { return null; } })();
      if (cached) {
        setLeftPanelResult(cached);
        setLeftPanelLoading(false);
      }

      // 병렬 실행
      await Promise.allSettled([
        // 번역+맥락 (캐시 미스 시에만)
        cached ? Promise.resolve() : callGemini(`다음 ${langName} 텍스트를 한국어로 처리해주세요.

"${sel}"

아래 형식 정확히 따라 출력. 도입 문구 없이 바로:

**번역**
자연스러운 한국어 번역

**맥락**
내용 이해를 돕는 배경 설명 2~3문장

규칙: 마크다운 **굵게**만 사용, 간결하게`).then(raw => {
          const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text || raw || '';
          setLeftPanelResult(text);
          setLeftPanelLoading(false);
          try { if (text) localStorage.setItem(cacheKey, text); } catch {}
        }).catch(() => { setLeftPanelResult(''); setLeftPanelLoading(false); }),

        // 단어 분석
        (async () => {
          let authHeader = {};
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) authHeader = { Authorization: `Bearer ${session.access_token}` };
          } catch {}
          const lines = sel.split('\n').map(l => l.trim()).filter(Boolean);
          const res = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader },
            body: JSON.stringify({ lines, language: materialLang }),
          });
          if (!res.ok) { setDragTokens([]); setDragAnalyzing(false); return; }
          const data = await res.json();
          const tokens = [];
          const seen = new Set();
          for (const r of data.results || []) {
            for (const tid of r.sequence) {
              const t = r.dictionary[tid];
              if (!t?.text?.trim() || !t.meaning) continue;
              if (t.pos === '기호' || /^[\s。、！？!?,.:;""''（）()「」『』【】…·\-\/]+$/.test(t.text)) continue;
              const key = t.base_form || t.text;
              if (seen.has(key)) continue;
              seen.add(key);
              tokens.push(t);
            }
          }
          setDragTokens(tokens);
          setDragAnalyzing(false);
        })(),
      ]);
    }, 100);
  };



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

  // 제목 편집 (owner만)
  const updateTitleMutation = useMutation({
    mutationFn: async (newTitle) => {
      const title = newTitle.trim().slice(0, 200);
      if (!title) throw new Error('제목이 비어있어요');
      const { error } = await supabase
        .from('reading_materials')
        .update({ title })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material', id] });
      setTitleEditing(false);
      toast('제목을 수정했어요', 'success');
    },
    onError: (err) => toast('제목 수정 실패 — ' + friendlyToastMessage(err), 'error'),
  });

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
    onError: (err) => toast('복습 저장 실패 — ' + friendlyToastMessage(err), 'error'),
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
    onError: (err) => toast('수정 실패 — ' + friendlyToastMessage(err), 'error'),
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
        furigana: selectedToken.furigana || selectedToken.reading || '', // 영어는 IPA 저장
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
      toast('단어 추가 실패 — ' + friendlyToastMessage(err), 'error');
    }
  };

  if (isLoading) return <div className="page-container"><Spinner message="자료 해부 중..." /></div>;
  if (error) {
    const isNotFound = error.code === 'NOT_FOUND' || /not.*found|no.*rows|multiple.*rows/i.test(error.message || '');
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>{isNotFound ? '🗑️' : '❌'}</div>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>
          {isNotFound ? '자료를 찾을 수 없어요' : '자료를 불러올 수 없어요'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 20, maxWidth: 400, margin: '0 auto 20px' }}>
          {isNotFound
            ? '이 자료는 삭제됐거나 비공개로 전환됐을 수 있어요. 연결됐던 단어는 단어장에 그대로 남아 있습니다.'
            : (error.message || '잠시 후 다시 시도해주세요.')}
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          {!isNotFound && <button onClick={() => refetch()} className="btn btn--primary">다시 시도</button>}
          <a href="/materials" className="btn btn--secondary">자료실로 돌아가기</a>
        </div>
      </div>
    );
  }

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

  const rightPanelContent = dragTokens !== null ? (
    <div className="viewer-side__content">
      <div className="pdf-word-list__header" style={{ marginBottom: 10 }}>
        <span className="pdf-word-list__title">단어 ({dragTokens.length})</span>
      </div>
      {dragAnalyzing && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>⏳ 분석 중...</div>}
      {dragTokens.map((t, i) => {
        const isSaved = savedWords.surfaces?.has(t.text) || savedWords.bases?.has(t.base_form);
        return (
          <div key={i} className={`pdf-word-item ${isSaved ? 'pdf-word-item--saved' : ''}`}>
            <span className="pdf-word-item__text" onClick={() => handleDragWordClick(t)}>{t.text}</span>
            <span className="pdf-word-item__meaning" onClick={() => handleDragWordClick(t)}>{t.meaning}</span>
            {user && (
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button className="pdf-word-item__save" disabled={isSaved}
                  onClick={async () => {
                    try {
                      await supabase.from('user_vocabulary').upsert({
                        user_id: user.id, word_text: t.text, base_form: t.base_form || t.text,
                        meaning: t.meaning || '', pos: t.pos || '', furigana: t.furigana || t.reading || '',
                        language: materialLang,
                      }, { onConflict: 'user_id,word_text' });
                      toast(`⭐ "${t.text}" 저장!`, 'success');
                      queryClient.invalidateQueries({ queryKey: ['vocab-words', user?.id] });
                    } catch { toast('저장 실패', 'error'); }
                  }}>
                  {isSaved ? '✓' : '⭐'}
                </button>
                <button className="pdf-word-item__save pdf-word-item__dismiss"
                  onClick={() => {
                    setDragTokens(prev => prev?.filter((_, idx) => idx !== i) || null);
                    toast(`"${t.text}" 제거`, 'info');
                  }}>✕</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  ) : selectedToken && isSheetOpen ? (
    <div className="viewer-side__content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1.3 }}>
            {selectedToken.furigana
              ? splitRuby(selectedToken.text, selectedToken.furigana).map((seg, i) =>
                  seg.kanji ? <ruby key={i}>{seg.kanji}<rt style={{ fontSize: '0.45em', color: 'var(--primary-light)' }}>{seg.reading}</rt></ruby> : <span key={i}>{seg.plain}</span>
                )
              : selectedToken.text}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {selectedToken.pos}
            {selectedToken.base_form && selectedToken.base_form !== selectedToken.text && ` · ${selectedToken.base_form}`}
          </div>
        </div>
        {ttsSupported && (
          <button onClick={() => speak(selectedToken.text, materialLang)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }} title="발음 듣기">🔊</button>
        )}
      </div>
      <div style={{ fontSize: '1rem', lineHeight: 1.6, marginBottom: materialLang === 'English' && selectedToken.reading ? 4 : 14 }}>
        {selectedToken.meaning || '(뜻 없음)'}
      </div>
      {materialLang === 'English' && selectedToken.reading && (
        <div style={{
          fontSize: '0.88rem',
          color: 'var(--text-secondary)',
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
          letterSpacing: '0.02em',
          marginBottom: 14,
        }}>
          {selectedToken.reading}
        </div>
      )}

      {wordDetail?.loading ? (
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>⏳ 상세 설명 생성 중...</div>
      ) : wordDetail?.detail ? (
        <div className="pdf-detail-popup__text" style={{ marginBottom: 14 }}
          dangerouslySetInnerHTML={{ __html: formatDetail(wordDetail.detail) }} />
      ) : (
        <button
          onClick={() => fetchWordDetail(selectedToken)}
          className="btn btn--ghost btn--sm"
          style={{ width: '100%', marginBottom: 12 }}
        >
          🔬 상세 설명 보기
        </button>
      )}

      {user && findSavedVocab(savedWords, selectedToken) && isTokenDue(savedWords, selectedToken) && (
        <div style={{ padding: '10px 12px', background: 'rgba(212,150,42,0.1)', borderRadius: 'var(--radius-md)', marginBottom: 12, border: '1px solid var(--warning)' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--warning)', marginBottom: 8 }}>🧠 복습 시점이에요!</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[{ label: '🔴 모름', rating: 1 }, { label: '🟡 애매', rating: 2 }, { label: '🟢 알아', rating: 3 }].map(r => (
              <button key={r.rating} onClick={() => {
                const vocab = findSavedVocab(savedWords, selectedToken);
                if (vocab) inlineReviewMutation.mutate({ vocab, rating: r.rating });
              }} className="btn btn--ghost btn--sm" style={{ flex: 1 }}>{r.label}</button>
            ))}
          </div>
        </div>
      )}
      {user && (
        <button onClick={addToVocab} disabled={isWordSaved}
          className={`btn ${isWordSaved ? 'btn--ghost' : 'btn--primary'} btn--sm`} style={{ width: '100%' }}>
          {saveAnim ? '✨ 저장됨!' : isWordSaved ? '✓ 단어장에 있음' : '⭐ 단어장에 저장'}
        </button>
      )}
    </div>
  ) : (
    <div className="pdf-side__empty">
      <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>📝</div>
      단어 클릭 → 상세<br />문장 드래그 → 단어 목록
    </div>
  );

  const leftPanelContent = leftPanelLoading ? (
    <div className="pdf-side__empty">
      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>⏳ 번역 + 맥락 생성 중...</span>
    </div>
  ) : leftPanelResult ? (
    <div className="viewer-side__content">
      <div className="pdf-context__title">💡 번역 · 맥락</div>
      {leftPanelText && (
        <div className="pdf-context__original">"{leftPanelText.length > 120 ? leftPanelText.slice(0, 120) + '…' : leftPanelText}"</div>
      )}
      <div className="pdf-context__text" dangerouslySetInnerHTML={{ __html:
        leftPanelResult
          .replace(/\*\*(.+?)\*\*/g, (_, m) =>
            /^(번역|맥락)$/.test(m.trim()) ? `<hr class="pdf-detail-hr" /><strong class="pdf-detail-heading">${m}</strong>` : `<strong>${m}</strong>`
          )
          .split('\n').map(l => l.trim()).filter(Boolean).join('<br />')
          .replace(/(<br \/>){2,}/g, '</p><p>')
          .replace(/^/, '<p>').replace(/$/, '</p>')
      }} />
    </div>
  ) : (
    <div className="pdf-side__empty">
      <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>💡</div>
      텍스트를 드래그하면<br />번역과 맥락이 여기에
    </div>
  );

  return (
    <div className={`viewer-3col viewer-theme-${theme}`} onMouseUp={handleTextSelection}>

      {/* 왼쪽 — 문법 해설 / 맥락 */}
      <aside className="viewer-side viewer-side--left">
        {leftPanelContent}
      </aside>

      {/* 중앙 — 뷰어 본문 */}
      <main className="viewer-center">
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
        {titleEditing && user?.id === material?.owner_id ? (
          <form
            onSubmit={e => { e.preventDefault(); updateTitleMutation.mutate(titleDraft); }}
            style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}
          >
            <input
              type="text"
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && setTitleEditing(false)}
              autoFocus
              className="form-input"
              style={{ fontSize: '1.1rem', fontWeight: 600, padding: '6px 10px', flex: 1 }}
              maxLength={200}
            />
            <Button size="sm" type="submit" disabled={updateTitleMutation.isPending || !titleDraft.trim()}>저장</Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setTitleEditing(false)}>취소</Button>
          </form>
        ) : (
          <h1 className="page-header__title" style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            {material.title}
            {user?.id === material?.owner_id && (
              <button
                onClick={() => { setTitleDraft(material.title); setTitleEditing(true); }}
                title="제목 편집"
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: '0.85rem',
                  padding: 4, borderRadius: 4,
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--primary-light)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                ✏️
              </button>
            )}
          </h1>
        )}
        {user && material?.visibility === 'public' && material?.owner_id !== user.id && (
          <ReportMaterialButton materialId={material.id} userId={user.id} toast={toast} />
        )}
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

      <ListenControls text={material?.raw_text} language={materialLang} />

      {/* PDF 출처 배지 + 다음 범위 분석 */}
      {sourcePdf && material.page_start && (
        <div className="u-highlight-card u-row u-row--between u-row--wrap u-row--gap-md u-mb-sm" style={{ marginBottom: 12 }}>
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
            ) : (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setReanalyzePanel(prev => prev ? null : 'menu')}
                  className="grammar-btn"
                >
                  🔄 재분석
                </button>

                {reanalyzePanel && (
                  <>
                    <div className="reanalyze-panel-overlay" onClick={() => setReanalyzePanel(null)} />
                    {reanalyzePanel === 'menu' && (
                      <div className="reanalyze-panel">
                        <button className="reanalyze-panel__item" onClick={startFullReanalyze}>
                          <strong>전체 분석</strong>
                          <span>처음부터 다시 분석합니다</span>
                        </button>
                        <button className="reanalyze-panel__item" onClick={() => { setReanalyzePanel('pick'); setSelectedParas(new Set()); }}>
                          <strong>부분 분석</strong>
                          <span>문단을 선택해서 분석합니다</span>
                        </button>
                      </div>
                    )}
                    {reanalyzePanel === 'pick' && (
                      <div className="reanalyze-panel reanalyze-panel--pick">
                        <div className="reanalyze-panel__header">
                          <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>문단 선택</span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{selectedParas.size}개 선택</span>
                        </div>
                        <div className="reanalyze-panel__list">
                          {paragraphs.map(p => (
                            <label key={p.index} className="reanalyze-panel__para">
                              <input
                                type="checkbox"
                                checked={selectedParas.has(p.index)}
                                onChange={() => togglePara(p.index)}
                              />
                              <span className="reanalyze-panel__preview">{p.preview}</span>
                              <span className="reanalyze-panel__lines">{p.lineCount}줄</span>
                            </label>
                          ))}
                        </div>
                        <div className="reanalyze-panel__actions">
                          <button className="btn btn--ghost btn--sm" onClick={() => setReanalyzePanel(null)}>취소</button>
                          <button className="btn btn--primary btn--sm" onClick={startPartialReanalyze} disabled={selectedParas.size === 0}>
                            {selectedParas.size}개 문단 분석
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
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
            <span>⏳ 문단 단위로 분석 중입니다...</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => refetch()} className="analyzing-banner__refresh">새로고침</button>
              {user?.id === material?.owner_id && reanalyzeMutation.isPending && (
                <button onClick={stopReanalysis} className="analyzing-banner__refresh" style={{ background: 'var(--danger)' }}>⏹ 중단</button>
              )}
            </div>
          </div>
        )}

        {isStaleAnalysis && user?.id === material?.owner_id && (
          <div className="analyzing-banner" style={{ background: 'rgba(252,196,25,0.1)', borderColor: 'rgba(252,196,25,0.4)' }}>
            <span>⚠️ 분석이 중단된 것 같아요{missingLineCount > 0 && ` (남은 ${missingLineCount}줄)`}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {reanalyzeMutation.isPending
                ? <button onClick={stopReanalysis} className="analyzing-banner__refresh" style={{ background: 'var(--danger)' }}>⏹ 중단</button>
                : <button onClick={() => reanalyze.mutation.mutate({ resume: true })} className="analyzing-banner__refresh" style={{ background: 'var(--accent)' }}>▶ 이어서 분석</button>
              }
            </div>
          </div>
        )}

        {isFailed && (
          <div className="analyzing-banner analyzing-banner--error">
            <span>❌ 분석에 실패했습니다.</span>
            {reanalyzeMutation.isPending
              ? <button onClick={stopReanalysis} className="analyzing-banner__refresh" style={{ background: 'var(--danger)' }}>⏹ 중단</button>
              : <button onClick={startFullReanalyze} className="analyzing-banner__refresh">🔄 재분석</button>
            }
          </div>
        )}

        {isPartial && failedIndices.length > 0 && !reanalyzeMutation.isPending && (
          <div className="analyzing-banner analyzing-banner--warn">
            <span>⚠️ {failedIndices.length}줄 분석 실패</span>
            <button onClick={() => reanalyze.mutation.mutate()} className="analyzing-banner__refresh">실패 줄 재시도</button>
          </div>
        )}

        {(() => {
          // raw_text 줄 분리 (헤딩 감지 + showRaw 렌더 공용)
          const rawLines = material?.raw_text?.split('\n') ?? [];

          // 헤딩 감지: 명시적 # 마크다운 또는 휴리스틱 자동 감지
          const SENTENCE_END = /[。！？!?.…」』)）】\]》>~〜]$/;
          const HEADING_CLASS = { 1: 'viewer-h1', 2: 'viewer-h2', 3: 'viewer-h3' };

          const headingLevels = rawLines.map((line, idx) => {
            const trimmed = line.trim();
            if (!trimmed) return 0;

            // 명시적 마크다운
            const md = trimmed.match(/^(#{1,3})\s/);
            if (md) return md[1].length;

            const len = trimmed.length;
            const nextLine = rawLines[idx + 1]?.trim() || '';
            const prevLine = rawLines[idx - 1]?.trim() || '';
            const endsWithPunctuation = SENTENCE_END.test(trimmed);

            // 첫 줄이고 짧고 마침표 없으면 → h1 (제목)
            if (idx === 0 && len <= 40 && !endsWithPunctuation) return 1;

            // 짧은 줄 + 마침표 없음 + 앞이 빈줄(또는 첫줄) + 뒤에 긴 줄 → h2
            if (len <= 30 && !endsWithPunctuation
                && (!prevLine || prevLine === '')
                && nextLine.length > len * 1.5) return 2;

            // 좀 더 긴 짧은 줄 + 마침표 없음 + 앞 빈줄 → h3
            if (len <= 50 && len > 1 && !endsWithPunctuation
                && (!prevLine || prevLine === '')
                && nextLine.length > len) return 3;

            return 0;
          });

          function getHeadingLevel(lineText, lineIdx) {
            if (lineIdx != null && headingLevels[lineIdx] != null) return headingLevels[lineIdx];
            if (!lineText) return 0;
            const m = lineText.match(/^(#{1,3})\s/);
            return m ? m[1].length : 0;
          }

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
            const rubySegments = showFurigana && token.furigana
              ? splitRuby(token.text, token.furigana)
              : null;
            return (
              <div key={tokenId} ref={el => { if (el) tokenRefs.current[tokenId] = el; }}
                className={`word-token ${isSaved ? 'word-token--saved' : ''} ${isDue ? 'word-token--due' : ''}`}
                role="button" tabIndex={0}
                onClick={() => handleTokenClick(token, tokenId)}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), handleTokenClick(token, tokenId))}>
                {rubySegments ? (
                  <span className="surface">
                    {rubySegments.map((seg, i) =>
                      seg.kanji
                        ? <ruby key={i}>{seg.kanji}<rt>{seg.reading}</rt></ruby>
                        : <span key={i}>{seg.plain}</span>
                    )}
                  </span>
                ) : (
                  <span className="surface">{token.text}</span>
                )}
              </div>
            );
          };

          if (showRaw) {
            return rawLines.map((line, lineIdx) => {
              const lineTokens = tokensByLine.get(lineIdx);
              const isLast = lineIdx === rawLines.length - 1;
              const hLevel = getHeadingLevel(line, lineIdx);
              const hClass = HEADING_CLASS[hLevel] || '';
              return (
                <span key={lineIdx} className={hClass || undefined} style={{ display: 'contents' }}>
                  {lineTokens?.length > 0
                    ? lineTokens.map(renderToken)
                    : line.trim()
                      ? <span className="word-token--raw">{line.trim().replace(/^#{1,3}\s/, '')}</span>
                      : null
                  }
                  {!isLast && <div className="line-break" />}
                </span>
              );
            });
          }

          // 분석 완료 후: 줄 단위로 그룹핑 → 헤딩 감지
          // tokenId에서 원본 줄 idx 추출 (id_{lineIdx}_{tokenIdx}_...)
          const lineGroups = []; // [{rawIdx, tokenIds}]
          let curGroup = { rawIdx: 0, tokenIds: [] };
          for (const tokenId of json.sequence) {
            const token = json.dictionary[tokenId];
            if (!token) continue;
            if (token.pos === '개행') {
              lineGroups.push(curGroup);
              const m = tokenId.match(/^(?:id|br|failed)_(\d+)_/);
              curGroup = { rawIdx: m ? parseInt(m[1]) + 1 : curGroup.rawIdx + 1, tokenIds: [] };
            } else {
              const m = tokenId.match(/^(?:id|failed)_(\d+)_/);
              if (m && curGroup.tokenIds.length === 0) curGroup.rawIdx = parseInt(m[1]);
              curGroup.tokenIds.push(tokenId);
            }
          }
          if (curGroup.tokenIds.length) lineGroups.push(curGroup);

          return lineGroups.map((group, gi) => {
            const rawIdx = group.rawIdx;
            const lineTokenIds = group.tokenIds;

            // 명시적 # 토큰 체크
            let mdLevel = 0;
            for (let k = 0; k < Math.min(3, lineTokenIds.length); k++) {
              const t = json.dictionary[lineTokenIds[k]];
              if (t?.text?.trim() === '#') mdLevel++;
              else break;
            }

            // 휴리스틱 fallback (rawLines 기반)
            const hLevel = mdLevel || getHeadingLevel(rawLines[rawIdx], rawIdx);
            const hClass = HEADING_CLASS[hLevel] || '';

            // 명시적 # 토큰 스킵
            const startIdx = mdLevel;

            return (
              <span key={gi} className={hClass || undefined} style={{ display: 'contents' }}>
                {lineTokenIds.slice(startIdx).map(renderToken)}
                {gi < lineGroups.length - 1 && <div className="line-break" />}
              </span>
            );
          });
        })()}

        {isDone && (
          <div className="reader-hint">
            💡 단어를 <strong>클릭</strong>하면 상세 정보, 문장을 <strong>드래그</strong>하면 번역+맥락
          </div>
        )}

      </div>

      {/* 리딩 테스트 — 뷰어 밖, 별도 섹션 */}
      {isDone && (
        <div className="reading-test-section">
          {!showReadingTest ? (
            <div className="reading-test-cta">
              <div className="reading-test-cta__icon">📝</div>
              <div className="reading-test-cta__title">Ready to test your comprehension?</div>
              <div className="reading-test-cta__sub">IELTS-style Reading Test · 5 questions</div>
              <Button onClick={() => setShowReadingTest(true)} style={{ marginTop: 16 }}>Start Test</Button>
            </div>
          ) : (
            <ReadingTest
              rawText={material?.raw_text}
              language={materialLang}
              materialId={id}
              onClose={() => setShowReadingTest(false)}
              inline
            />
          )}
        </div>
      )}

      {/* 회화 연습 — 뷰어 밖, 별도 섹션 */}
      {isDone && (
        <div className="reading-test-section">
          {!showConversation ? (
            <div className="reading-test-cta">
              <div className="reading-test-cta__icon">💬</div>
              <div className="reading-test-cta__title">AI 튜터와 대화해 볼까요?</div>
              <div className="reading-test-cta__sub">방금 읽은 본문을 주제로 {materialLang === 'Japanese' ? '일본어' : '영어'} 회화 연습</div>
              <Button onClick={() => setShowConversation(true)} style={{ marginTop: 16 }}>대화 시작</Button>
            </div>
          ) : (
            <ConversationPanel
              rawText={material?.raw_text}
              language={materialLang}
              materialId={id}
              materialTitle={material?.title}
              onClose={() => setShowConversation(false)}
              inline
            />
          )}
        </div>
      )}

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


      </main>{/* viewer-center end */}

      {/* 오른쪽 — 단어 클릭 상세 or 드래그 단어 리스트 */}
      <aside className="viewer-side viewer-side--right">
        {rightPanelContent}
      </aside>

      <ViewerBottomSheet
        leftContent={leftPanelContent}
        rightContent={rightPanelContent}
        leftActive={leftPanelLoading || !!leftPanelResult}
        rightActive={dragTokens !== null || (selectedToken && isSheetOpen)}
        leftBadge={leftPanelLoading ? '생성 중' : null}
        rightBadge={selectedToken?.text || (dragTokens ? `${dragTokens.length}개` : null)}
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

      {/* 드래그 단어 상세 팝업 — PDF와 동일 */}
      {popupWord && (
        <>
          <div className="pdf-detail-overlay" onClick={() => setPopupWord(null)} />
          <div className="pdf-detail-popup">
            <div className="pdf-detail-popup__header">
              <div className="pdf-detail-popup__word">
                {popupWord.token.furigana
                  ? splitRuby(popupWord.token.text, popupWord.token.furigana).map((seg, i) =>
                      seg.kanji ? <ruby key={i}>{seg.kanji}<rt>{seg.reading}</rt></ruby> : <span key={i}>{seg.plain}</span>
                    )
                  : popupWord.token.text}
              </div>
              <button className="pdf-detail-popup__close" onClick={() => setPopupWord(null)}>✕</button>
            </div>
            <div className="pdf-detail-popup__meta">
              <span className="pdf-detail-popup__pos">{popupWord.token.pos}</span>
              {popupWord.token.base_form && popupWord.token.base_form !== popupWord.token.text && (
                <span className="pdf-detail-popup__base">{popupWord.token.base_form}</span>
              )}
              <span className="pdf-detail-popup__short">{popupWord.token.meaning}</span>
            </div>
            <div className="pdf-detail-popup__body">
              {popupWord.loading
                ? <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>⏳ 상세 설명 생성 중...</div>
                : <div className="pdf-detail-popup__text" dangerouslySetInnerHTML={{ __html: formatDetail(popupWord.detail) }} />
              }
            </div>
            {user && (() => {
              const t = popupWord.token;
              const isSaved = savedWords.surfaces?.has(t.text) || savedWords.bases?.has(t.base_form);
              return (
                <button className={`pdf-detail-popup__save ${isSaved ? 'pdf-detail-popup__save--done' : ''}`}
                  disabled={isSaved}
                  onClick={async () => {
                    try {
                      await supabase.from('user_vocabulary').upsert({
                        user_id: user.id, word_text: t.text, base_form: t.base_form || t.text,
                        meaning: t.meaning || '', pos: t.pos || '', furigana: t.furigana || t.reading || '',
                        language: materialLang,
                      }, { onConflict: 'user_id,word_text' });
                      toast(`⭐ "${t.text}" 저장!`, 'success');
                      queryClient.invalidateQueries({ queryKey: ['vocab-words', user?.id] });
                    } catch { toast('저장 실패', 'error'); }
                  }}>
                  {isSaved ? '✓ 저장됨' : '⭐ 단어장에 저장'}
                </button>
              );
            })()}
          </div>
        </>
      )}

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
