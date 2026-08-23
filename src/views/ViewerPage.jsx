'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { computeHeadingLevels } from '../lib/headingHeuristics';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import { recordActivity } from '../lib/streak';
import { useTTS } from '../lib/useTTS';
import { useViewerSettings } from '../lib/useViewerSettings';
import { useViewerQuiz } from '../lib/useViewerQuiz';
import { useReanalyze } from '../lib/useReanalyze';
import { useReanalyzeUI } from '../lib/useReanalyzeUI';
import { useReadingCompletion } from '../lib/useReadingCompletion';
import { useGrammarNoteSave } from '../lib/useGrammarNoteSave';
import { useInlineReview } from '../lib/useInlineReview';
import { useMaterialComments } from '../lib/useMaterialComments';
import { friendlyToastMessage } from '../lib/errorMessage';
import { normalizeWordText } from '../lib/vocabIO';
import { callGemini } from '../lib/gemini';
import { fetchWordDetailText } from '../lib/wordDetail';
import { pinyinToneClass } from '../lib/pinyinTone';
import { splitRuby } from '../lib/splitRuby';
import { pickableSentences, adjacentSentence } from '../lib/sentenceNav';
import { fitDivisor, isFitLang } from '../lib/fitWord';
import { charDetail, isInspectableChar, wordsWithChar } from '../lib/charInspect';
import { fetchSynAnt, synAntEligible } from '../lib/synAnt';
import ReportMaterialButton from '../components/ReportMaterialButton';
import ReadingTest from '../components/ReadingTest';
import ConversationPanel from '../components/ConversationPanel';
import ViewerBottomSheet from '../components/ViewerBottomSheet';
import ListenControls from '../components/ListenControls';
import { formatDetail } from '../lib/wordDetailFormat';
import { useSeriesNeighbors } from '../lib/useSeriesNeighbors';
import { useTitleEdit } from '../lib/useTitleEdit';
import { useTokenRangeSelect } from '../lib/useTokenRangeSelect';
import { useNextRangeMutation } from '../lib/useNextRangeMutation';
import { useReadProgress } from '../lib/useReadProgress';
import { useGroupReadPush } from '../lib/useGroupReadPush';
import { useScrollRestore } from '../lib/useScrollRestore';
import { listHanjaHunEum, toJaForm } from '../lib/hanjaKo';
import { useGrammarDetail } from '../lib/useGrammarDetail';
import { buildContextPrompt } from '../lib/grammarDetail';
import { analysisCacheKey, clearAnalysisCache, readAnalysisCache, writeAnalysisCache } from '../lib/viewerAnalysisCache';
import { useRefVocabEntry, refLevelLabel } from '../lib/refVocabIndex';
import { recordVocabEncounters } from '../components/world/vocabEncounters';
import { syncVocabEncounters } from '../components/world/vocabEncounterSync';
import { encounterLookupLang, loadMetWordKeys, loadRefVocabLookup } from '../lib/refVocabLookup';
import { normalizeRefWordKey } from '../lib/refWordNormalize';
import { getBook } from '../lib/bookMeta';
import { getJaRef, formatJaRef, getJaWarn } from '../lib/jaRef';
import TokenEditPanel from './TokenEditPanel';
import SourceEditModal from './SourceEditModal';
import TokenPosLabel from './TokenPosLabel';
import TokenRangeGrips from './TokenRangeGrips';
import ViewerComments from './ViewerComments';
import ViewerQuizModal from './ViewerQuizModal';
import { langNameKo } from '../lib/constants';

// 공부 모드 지원 언어 키 — REF_LANGS를 직접 import하면 교재 콘텐츠 전체가 클라 번들에 딸려 온다(1.8MB).
// 실사용은 '이 자료 언어로 세션 생성 가능한가' 멤버십 체크 1곳뿐이라 정적 키 집합으로 대체한다.
// 키는 REF_LANGS와 반드시 일치(user_vocabulary.language·/study 규약).
const STUDY_LANGS = new Set(['Japanese', 'English', 'French', 'Chinese']);

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

async function upsertViewerVocabulary(row, options = { onConflict: 'user_id,word_text' }) {
  const { error } = await supabase.from('user_vocabulary').upsert(row, options);
  if (error) throw error;
}


export default function ViewerPage() {
  const { id } = useParams();
  const { user, profile, fetchProfile } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { speak, supported: ttsSupported } = useTTS();

  // Custom hooks
  const settings = useViewerSettings();
  const { fontSize, setFontSize, lineGap, setLineGap, charGap, setCharGap,
          showHanjaKo, setShowHanjaKo,
          showToneColors, setShowToneColors,
          focusMode, setFocusMode,
          theme, setTheme, fontFamily, setFontFamily, showFurigana, setShowFurigana,
          autoSpeakOnClick, setAutoSpeakOnClick,
          settingsOpen, setSettingsOpen } = settings;

  const quiz = useViewerQuiz();
  const { quizState, completionModal, setCompletionModal, generateQuiz,
          handleQuizAnswer, advanceQuiz, finishQuiz } = quiz;

  const [selectedToken, setSelectedToken] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  // ④ 글자 탐색 — 카드의 큰 단어에서 탭한 한자({ ch, key, reading }). 단어가 바뀌면 리셋.
  const [inspectChar, setInspectChar] = useState(null);
  const [commentInput, setCommentInput] = useState('');
  const [saveAnim, setSaveAnim] = useState(false);
  const [inlineSaving, setInlineSaving] = useState({});
  const { titleEditing, setTitleEditing, titleDraft, setTitleDraft, updateTitleMutation } = useTitleEdit(id, toast);

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

  // [자세히] 인라인 문법 해설(오너 확정) — 모달·체크박스 없이 시트 좌측에서 펼친다.
  const grammar = useGrammarDetail({ materialLang, toast });
  // 자료 언어의 BCP 47 태그 — :lang() 폰트 규칙(zh=SC·ja=JP)의 스위치.
  const contentLangTag = materialLang === 'Chinese' ? 'zh-Hans'
    : materialLang === 'Japanese' ? 'ja' : undefined;

  // 🈁 월드에서 만난 말(rfc-vocab-encounter, 목업 C) — 단어 목록에 조용한 점 하나만 얹는다.
  // 담김은 기존 저장 ✓ 표시가, 익힘은 레퍼런스 어휘의 필터(목업 D)가 담당하므로 여기선 만남만.
  // 집합은 대조 키(§4.7 정규화 — fr 관사형 접기, ja·en·zh는 원문 그대로)로 든다.
  const metCode = { Japanese: 'ja', French: 'fr', Chinese: 'zh', English: 'en' }[materialLang];
  const [metWordSet, setMetWordSet] = useState(() => new Set());
  useEffect(() => {
    setMetWordSet(metCode ? loadMetWordKeys(metCode) : new Set());
  }, [metCode]);
  // 서버 정본 동기화(§4.5) — 로그인 시 쌍방 병합(5분 스로틀). 다른 기기에서 온 만남이 있을 때만
  // 진입 스냅샷을 한 번 다시 뜬다(세션 중 점 번짐 금지 원칙은 그대로 — 내 드래그는 반영 안 됨).
  useEffect(() => {
    if (!user?.id || !metCode) return undefined;
    let cancel = false;
    (async () => {
      if (await syncVocabEncounters(supabase, user.id, metCode) && !cancel) {
        setMetWordSet(loadMetWordKeys(metCode));
      }
    })();
    return () => { cancel = true; };
  }, [user?.id, metCode]);
  const [selectedRangeText, setSelectedRangeText] = useState('');

  const { data: savedWords = { byKey: new Map(), surfaces: new Set(), bases: new Set() } } = useQuery({
    queryKey: ['vocab-words', user?.id],
    queryFn: () => fetchUserVocabWords(user.id),
    enabled: !!user,
    staleTime: 1000 * 30,
  });

  // PDF 출처 메타 (있으면)
  const { data: sourcePdf } = useQuery({
    queryKey: ['source-pdf', material?.source_pdf_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uploaded_pdfs')
        .select('id, title, page_count, storage_path, language, level')
        .eq('id', material.source_pdf_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!material?.source_pdf_id,
  });

  // PDF 출처 자료의 다음 페이지 범위 분석 mutation
  const nextRangeMutation = useNextRangeMutation({ material, sourcePdf, user, toast });

  const { data: readingProgress } = useQuery({
    queryKey: ['reading-progress', user?.id, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reading_progress')
        .select('is_completed')
        .eq('user_id', user.id)
        .eq('material_id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // 시리즈 navigation: 같은 시리즈 prev/next + 시리즈/레벨 완주 안내 + 진척도
  const { prevLesson, nextLesson, seriesEndCard, seriesPosition } = useSeriesNeighbors(id, material?.title);

  // 책 챕터 목록(P1) — metadata.book이 있으면 같은 key의 형제 챕터를 불러 내비를 만든다
  const bookMeta = getBook(material?.processed_json?.metadata);
  const { data: bookChapters } = useQuery({
    queryKey: ['book-chapters', bookMeta?.key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reading_materials')
        .select('id, title, processed_json->status, processed_json->metadata->book')
        .filter('processed_json->metadata->book->>key', 'eq', bookMeta.key);
      if (error) throw error;
      return (data || [])
        .map((r) => ({ id: r.id, title: r.title, status: r.status, order: Number(r.book?.order) || 0 }))
        .sort((a, b) => a.order - b.order);
    },
    enabled: !!bookMeta?.key,
    staleTime: 1000 * 60,
  });
  const bookNav = (() => {
    if (!bookMeta || !bookChapters?.length) return null;
    const idx = bookChapters.findIndex((c) => c.id === Number(id) || String(c.id) === String(id));
    if (idx === -1) return null;
    return {
      title: bookMeta.title,
      pos: idx + 1,
      total: bookChapters.length,
      prev: idx > 0 ? bookChapters[idx - 1] : null,
      next: idx < bookChapters.length - 1 ? bookChapters[idx + 1] : null,
    };
  })();

  const { data: nextMaterial } = useQuery({
    queryKey: ['next-material', id, material?.processed_json?.metadata?.language],
    queryFn: async () => {
      const lang = material?.processed_json?.metadata?.language;
      // 이미 읽은 자료 ID 가져오기
      const { data: readIds, error: readIdsError } = await supabase
        .from('reading_progress')
        .select('material_id')
        .eq('user_id', user.id)
        .eq('is_completed', true);
      if (readIdsError) throw readIdsError;
      const doneSet = new Set((readIds || []).map(r => r.material_id));
      doneSet.add(id); // 현재 자료도 제외

      // 추천 후보는 메타만 필요 — processed_json 통짜(자료당 수백 KB)를 10행씩 끌지 않는다
      // (jsonb 경로 선택 — 책 챕터 쿼리 선례. 전수 조사 쿼리 다이어트).
      let query = supabase
        .from('reading_materials')
        .select('id, title, status:processed_json->>status, language:processed_json->metadata->>language, level:processed_json->metadata->>level')
        .eq('visibility', 'public')
        .neq('id', id)
        .limit(10);

      const { data, error } = await query;
      if (error) throw error;
      if (!data?.length) return null;

      // 같은 언어 → 같은 레벨 우선 필터
      const level = material?.processed_json?.metadata?.level;
      const candidates = data
        .filter(m => !doneSet.has(m.id) && m.status === 'completed')
        .sort((a, b) => {
          const aLang = a.language === lang ? 0 : 1;
          const bLang = b.language === lang ? 0 : 1;
          if (aLang !== bLang) return aLang - bLang;
          const aLevel = a.level === level ? 0 : 1;
          const bLevel = b.level === level ? 0 : 1;
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

  const markCompleteMutation = useReadingCompletion({
    materialId: id, user, profile, fetchProfile,
    material, generateQuiz,
    toast,
  });

  const saveGrammarNoteMutation = useGrammarNoteSave({
    user, materialId: id,
    selectedText: selectedRangeText,
    explanation: grammar.result,
    toast,
  });

  // 재분석 로직 + UI
  const reanalyze = useReanalyze({ materialId: id, material, refetch, toast });
  const reanalyzeMutation = reanalyze.mutation;
  const stopReanalysis = reanalyze.stop;
  const isStaleAnalysis = reanalyze.stale;
  const missingLineCount = reanalyze.missingIndices.length;
  const {
    reanalyzePanel, setReanalyzePanel,
    selectedParas, paragraphs,
    togglePara, startFullReanalyze, startPartialReanalyze,
  } = useReanalyzeUI({ reanalyze, material, toast });

  // ③ 원문 수정(오너 승인) — 소유자 전용, 저장 시 바뀐 줄만 재분석(sourceEdit.js 계획).
  const [sourceEditOpen, setSourceEditOpen] = useState(false);
  const handleSourceEditSave = async (plan) => {
    if (!plan || plan.noop) { setSourceEditOpen(false); return; }
    if (!plan.ok) { toast(plan.reason, 'error'); return; }
    try {
      // raw_text를 먼저 확정 — 분석은 override로 같은 텍스트를 받아 낡은 캐시를 우회
      const { error: rawError } = await supabase
        .from('reading_materials')
        .update({ raw_text: plan.newText })
        .eq('id', id);
      if (rawError) throw rawError;
    } catch (e) {
      toast('원문 저장 실패 — ' + friendlyToastMessage(e), 'error');
      return;
    }
    setSourceEditOpen(false);
    reanalyzeMutation.mutate({
      selectedLineIndices: plan.selected,
      rawTextOverride: plan.newText,
      baseJsonOverride: plan.remapped,
    });
  };

  // 읽기 진행률 바 — readerRef는 본문 컨테이너에 부착
  const { readerRef, readProgress } = useReadProgress(material);
  // 그룹 같이 읽기 진도 push(§4.3) — 이번 주 지정 자료일 때만, 실패 조용히
  useGroupReadPush(material?.id, user?.id, readProgress);

  // 스크롤 위치 저장(debounce 2s) + 재진입 시 자동 복원
  const { saveScrollPosition, tokenRefs } = useScrollRestore({ user, materialId: id, material, readingProgress });

  // 단어 저장 카운트 (복습 유도용)
  const saveCountRef = useRef(0);

  const handleTokenClick = (token, tokenId) => {
    if (token.pos === '개행') return;
    // 집중 모드 단일 규칙(오너 확정 2026-08-20): 지정 문장 '밖' 탭 = 순수 이동 — 지정만
    // 옮기고 카드·분석·발화·시트 없음, 뜻이 필요하면 지정된 문장 '안'에서 한 번 더 탭.
    // '안' 탭 = 아래 기존 단어 카드. 지정 없음(발동 대기)도 같은 규칙의 특수형(모든 탭이
    // 밖 = 첫 탭이 문장 지정). 문장 단위가 아닌 줄(막대 없는 2자 미만)은 무시 — 카드
    // 폴백을 두면 첫 탭이 곧장 카드를 띄우는 뒷문이 된다.
    if (focusMode) {
      const m = tokenId.match(/^(?:id|failed)_(\d+)_/);
      const line = m ? sentences.find((s) => s.rawIdx === parseInt(m[1])) : null;
      if (!line) return;
      if (line.rawIdx !== pickedLineIdx) {
        tokenRange.clearRange();
        setPickedLineIdx(line.rawIdx);
        setSelectedRangeText(line.text);
        clearAnalysisPanels(); // 이전 문장 분석이 낡은 채 남지 않게 — 순수 이동과 동일 원칙
        return;
      }
    }
    const t = { ...token, id: tokenId };
    setSelectedToken(t);
    setIsSheetOpen(true);
    setDragTokens(null);
    setWordDetail(null);
    setInspectChar(null);
    // 집중 모드에서는 단어 열람이 지정을 풀지 않는다 — 풀리면 다음 탭이 다시 '문장
    // 지정'으로 바뀌는 플립플롭이 생긴다(오너 확정 스펙의 동반 수정).
    if (!focusMode) setPickedLineIdx(null);
    setIsEditingToken(false); // 다른 단어로 넘어가면 편집 패널 접기
    tokenRange.clearRange(); // 범위 지정 이펙트와 상호 배타
    setRightSheetSignal(s => s + 1);
    if (settings.autoSpeakOnClick && ttsSupported && t.text) {
      speak(t.text, materialLang);
    }
    // 클릭한 토큰 인덱스를 스크롤 위치로 저장
    const json = material?.processed_json;
    if (json?.sequence) {
      const idx = json.sequence.indexOf(tokenId);
      if (idx >= 0) saveScrollPosition(idx);
    }
  };

  // ② 리스트 단어 탭 → 팝업 대신 단어 카드가 리스트 위에(오너 승인). 문장 컨텍스트
  // (리스트·막대 지정·집중 어둡기)를 유지해야 하므로 dragTokens·pickedLineIdx는 건드리지 않는다.
  const handleListWordClick = (t) => {
    setSelectedToken({ ...t });
    setIsSheetOpen(true);
    setWordDetail(null);
    setInspectChar(null);
    setIsEditingToken(false);
    setRightSheetSignal(s => s + 1);
  };

  const closeWordCard = () => {
    setIsSheetOpen(false);
    setSelectedToken(null);
    setWordDetail(null);
    setInspectChar(null);
    setIsEditingToken(false);
  };

  // ④ 같은 글자 재탭 = 닫기, 다른 글자 = 교체
  const toggleInspectChar = (ch, key, reading) => {
    setInspectChar(prev => (prev?.key === key ? null : { ch, key, reading }));
  };

  // ⑤ 유의어·반의어 칩 — 탭하면 그 단어의 카드로 교체(handleListWordClick 재사용, 새 상태 없음)
  const renderSynAntChips = (list) => list.map((x) => (
    <button
      key={x.w}
      className="syn-ant__chip"
      lang={contentLangTag}
      onClick={() => handleListWordClick({ text: x.w, base_form: x.w, meaning: x.ko, furigana: x.r, pos: '' })}
    >
      <span>{x.w}</span>
      {x.r && <span className="syn-ant__r pinyin-text">{x.r}</span>}
      {x.ko && <span className="syn-ant__ko">{x.ko}</span>}
    </button>
  ));

  // 카드는 패널 맨 위에 붙는다 — 리스트를 내려 본 뒤 탭해도 보이도록 스크롤 복귀
  // (데스크톱 우측 패널 + 모바일 시트 섹션, 둘 다 렌더 사본이라 전부 복귀).
  useEffect(() => {
    if (!selectedToken || !isSheetOpen) return;
    for (const el of document.querySelectorAll('.viewer-side--right, .viewer-sheet__section-body')) el.scrollTop = 0;
  }, [selectedToken, isSheetOpen]);

  // ⑤ 유의어·반의어(오너 승인) — 카드가 열리면 자동 조회. 내용어만(synAntEligible),
  // localStorage 캐시라 단어당 1회 초소형 호출. 늦게 온 응답이 다른 단어에 붙지 않게 가드.
  const [synAnt, setSynAnt] = useState(null);
  useEffect(() => {
    if (!selectedToken || !isSheetOpen || !synAntEligible(selectedToken, materialLang)) {
      setSynAnt(null);
      return undefined;
    }
    let alive = true;
    setSynAnt({ loading: true, syn: [], ant: [] });
    fetchSynAnt(selectedToken, materialLang)
      .then((r) => { if (alive) setSynAnt({ loading: false, ...r }); })
      .catch(() => { if (alive) setSynAnt(null); });
    return () => { alive = false; };
  }, [selectedToken, isSheetOpen, materialLang]);

  // 왼쪽 패널: 번역 + 맥락
  const [leftPanelText, setLeftPanelText] = useState('');
  const [leftPanelResult, setLeftPanelResult] = useState('');
  const [leftPanelLoading, setLeftPanelLoading] = useState(false);

  // 단어 상세 AI 설명
  const [wordDetail, setWordDetail] = useState(null); // { detail, loading }
  const isClient = typeof window !== 'undefined';
  function getDetailCached(key) { if (!isClient) return null; try { return JSON.parse(localStorage.getItem(`pdf_cache:detail:${key}`)); } catch { return null; } }
  function setDetailCached(key, val) { if (!isClient) return; try { localStorage.setItem(`pdf_cache:detail:${key}`, JSON.stringify(val)); } catch {} }

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

  // 🈁 만남 기록 R3(rfc-vocab-encounter §4.2·§4.7) — 드래그로 목록에 뜬 토큰 중 정본 어휘를
  // 저작 표기(refMain)로 남긴다. 표시(metWordSet)는 자료 진입 시점 스냅샷을 유지해 점이
  // 실시간으로 번지지 않게 한다(조용함 우선) — 다음 방문부터 반영. 대조는 언어별 정본
  // 조회(ja 위임·fr/zh/en 표제어 키 인덱스 — 4트랙 전부, §4.7)로 한다.
  useEffect(() => {
    const code = encounterLookupLang(materialLang);
    if (!code || !Array.isArray(dragTokens) || dragTokens.length === 0) return undefined;
    let alive = true;
    (async () => {
      try {
        const lookup = await loadRefVocabLookup(code);
        if (!alive || !lookup) return;
        const met = [];
        for (const t of dragTokens) {
          const hit = lookup.findWord(t.base_form) || lookup.findWord(t.text);
          if (hit?.main) met.push(hit.main);
        }
        // 출처 문맥(R3) — 처음 만난 표기에는 드래그한 자료 문장(첫 줄)을 남긴다.
        const ctxLine = String(leftPanelText || '').split('\n').map((l) => l.trim()).find(Boolean);
        if (met.length > 0) {
          recordVocabEncounters(code, met, undefined, ctxLine ? { text: ctxLine, source: 'viewer' } : null);
        }
      } catch {
        // 부가 기록 — 조용히 생략.
      }
    })();
    return () => { alive = false; };
  }, [dragTokens, materialLang, leftPanelText]);

  // 모바일 시트 재오픈 신호 — active 유지 상태에선 rising edge가 없어, 시트를 닫은 뒤
  // 다른 단어를 탭해도 시트가 다시 안 올라온다(#996). 탭·드래그 때마다 카운터를 올린다.
  const [leftSheetSignal, setLeftSheetSignal] = useState(0);
  const [rightSheetSignal, setRightSheetSignal] = useState(0);

  // 문장 막대로 지정한 줄 — 해당 줄 전체에 지정 이펙트(#1002). 단어 클릭·드래그 시 해제.
  const [pickedLineIdx, setPickedLineIdx] = useState(null);

  // 리딩 테스트
  const [showReadingTest, setShowReadingTest] = useState(false);
  // 회화 연습
  const [showConversation, setShowConversation] = useState(false);

  // 인앱 토큰 범위 지정 — 네이티브 선택 대체(앱 전역 무선택 정책). 데스크톱 즉시 드래그,
  // 모바일 길게 누르기(300ms) 후 드래그. 확정 시 기존 분석 파이프라인에 그대로 투입하고,
  // 문법 버튼 활성 경로(selectedRangeText)도 같은 텍스트로 채운다.
  const tokenRange = useTokenRangeSelect({
    sequence: material?.processed_json?.sequence,
    dictionary: material?.processed_json?.dictionary,
    enabled: true,
    onSelect: (text) => {
      setPickedLineIdx(null); // 막대 지정 이펙트와 상호 배타
      setSelectedRangeText(text);
      grammar.reset(); // 다른 문장의 해설이 남지 않게
      runSelectionAnalysis(text);
    },
  });

  // 드래그 선택·문장 버튼 공용 — 왼쪽 번역+맥락, 오른쪽 단어 리스트 분석
  // 문장 이동(▲/▼) — 지정 가능한 문장 목록. 렌더의 lineGroups와 같은 규칙으로
  // sequence에서 파생한다(문장 막대와 단위 동조 — sentenceNav 계약 참조).
  const sentences = useMemo(() => {
    const seq = material?.processed_json?.sequence;
    const dict = material?.processed_json?.dictionary;
    if (!seq?.length || !dict) return [];
    const rawLines = material?.raw_text?.split('\n') ?? [];
    const lineGroups = [];
    let curGroup = { rawIdx: 0, tokenIds: [] };
    for (const tokenId of seq) {
      const token = dict[tokenId];
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
    return pickableSentences(lineGroups, rawLines);
  }, [material?.processed_json, material?.raw_text]);

  // 집중 모드 순수 이동용 — 좌(번역·맥락)/우(단어 리스트·카드) 패널과 시트 활성 상태를
  // 비운다. 시트 신호는 올리지 않는다(안 띄우는 게 목적). ViewerBottomSheet의 active가
  // 이 상태들에서 유도되므로 비우면 시트도 스스로 잦아든다. 이전 문장 분석이 낡은 채
  // 시트에 남는 불일치도 이걸로 차단.
  const clearAnalysisPanels = () => {
    setLeftPanelText('');
    setLeftPanelResult('');
    setLeftPanelLoading(false);
    setDragTokens(null);
    setDragAnalyzing(false);
    setSelectedToken(null);
    setIsSheetOpen(false);
    setInspectChar(null);
    setWordDetail(null);
  };

  // 이동 = 그 문장의 막대(¦)를 대신 눌러주는 것 — 지정·분석·스크롤이 한 동작.
  // 단, 집중 모드에서는 '순수 이동'(오너 지시 2026-08-20): 문장을 따라 읽는 중이라
  // 번역·맥락 시트가 매번 올라오는 게 방해고, 안 볼 번역에 Gemini 호출을 쓰는 낭비다.
  // 분석 없이 지정·스크롤만 하고 패널은 비운다. 분석이 필요하면 막대(¦)를 누른다 —
  // 그 경로는 본래처럼 전체 분석이다.
  const moveSentence = (dir) => {
    if (pickedLineIdx === null) return;
    const target = adjacentSentence(sentences, pickedLineIdx, dir);
    if (!target) return;
    tokenRange.clearRange();
    setPickedLineIdx(target.rawIdx);
    setSelectedRangeText(target.text);
    if (focusMode) clearAnalysisPanels();
    else runSelectionAnalysis(target.text);
    const el = tokenRefs.current[target.firstTokenId];
    if (el?.scrollIntoView) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    }
  };

  // ▲▼ 한 벌 — 데스크톱 플로팅 필과 모바일 하단 바가 같은 버튼을 다른 옷(className)으로
  // 입는다. 모바일에서 필이 시트(z 95)에 덮여 못 쓰는 문제의 재배치(오너 보고 2026-08-20):
  // 바(z 100)는 시트보다 항상 위·항상 노출이라 겹침이 구조적으로 불가능하다.
  const sentenceNavBtn = (dir, className) => (
    <button
      className={className}
      aria-label={dir < 0 ? '위 문장' : '아래 문장'}
      title={dir < 0 ? '위 문장' : '아래 문장'}
      disabled={!adjacentSentence(sentences, pickedLineIdx, dir)}
      onClick={() => moveSentence(dir)}
    >{dir < 0 ? '▲' : '▼'}</button>
  );

  // 집중 모드 — 본문 창의 '빈 공간'(글자·컨트롤 밖) 탭 = 지정 해제(오너 확정 2026-08-20:
  // "글자 외 다른 부분 클릭 시 해제 — 전문을 살필 수 있게"). 범위 지정도 같은 조망
  // 이펙트라 함께 풀고, 패널도 비운다(해제된 선택의 분석이 낡은 채 남는 불일치 차단 —
  // 순수 이동과 동일 원칙). 토큰·막대(¦)·▲▼필·그립·버튼류는 저마다의 동작이므로 해제
  // 대상이 아니다: ¦·그립은 stopPropagation, 드래그 합성 클릭은 캡처 차단으로 여기
  // 안 오고, 나머지는 closest 가드로 거른다.
  const handleReaderBlankClick = (e) => {
    if (!focusMode) return;
    if (e.target.closest('.word-token, .line-pick, .sentence-nav, .range-grip, button, a')) return;
    if (pickedLineIdx === null && !tokenRange.range) return;
    tokenRange.clearRange();
    setPickedLineIdx(null);
    setSelectedRangeText('');
    clearAnalysisPanels();
  };

  const runSelectionAnalysis = async (sel) => {
    setLeftSheetSignal(s => s + 1);
    setRightSheetSignal(s => s + 1);
    {
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
      const langName = langNameKo(materialLang);
      const cacheKey = `viewer_tx:${materialLang}:${sel.slice(0, 200)}`;
      const cached = (() => { try { return localStorage.getItem(cacheKey); } catch { return null; } })();
      if (cached) {
        setLeftPanelResult(cached);
        setLeftPanelLoading(false);
      }

      // 병렬 실행
      await Promise.allSettled([
        // 번역+맥락 (캐시 미스 시에만)
        cached ? Promise.resolve() : callGemini(buildContextPrompt(sel, langName)).then(raw => {
          const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text || raw || '';
          setLeftPanelResult(text);
          setLeftPanelLoading(false);
          try { if (text) localStorage.setItem(cacheKey, text); } catch {}
        }).catch(() => { setLeftPanelResult(''); setLeftPanelLoading(false); }),

        // 단어 분석 — 문장 단위 캐시(좌측 번역과 대칭). 적중하면 서버 요청 자체가 사라져
        // 문맥 판별·뜻 조회가 함께 절감된다(§C4).
        (async () => {
          const anKey = analysisCacheKey(materialLang, sel);
          const anCached = isClient ? readAnalysisCache(localStorage, anKey) : null;
          if (anCached) { setDragTokens(anCached); setDragAnalyzing(false); return; }
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
          if (isClient) writeAnalysisCache(localStorage, anKey, tokens);
          setDragAnalyzing(false);
        })(),
      ]);
    }
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

  // 인라인 복습: 뷰어에서 단어 보며 바로 FSRS 평가
  const inlineReviewMutation = useInlineReview({ user, fetchProfile, toast });

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
        const { error: logError } = await supabase.from('token_corrections').insert({
          material_id: id,
          token_id: tokenId,
          user_id: user.id,
          before_value: beforeSlim,
          after_value: corrections,
        });
        if (logError) console.warn('[correction log] failed:', logError.message);
      }
      return { tokenId, corrections };
    },
    onSuccess: ({ tokenId, corrections }) => {
      // 교정된 뜻이 캐시된 분석 결과에 남아 낡지 않게 무효화(§C4 무효화 규칙)
      if (isClient) clearAnalysisCache(localStorage);
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
      const { data, error } = await supabase
        .from('token_corrections')
        .select('id, before_value, after_value, created_at, user_id, profiles:user_id(display_name)')
        .eq('material_id', id)
        .eq('token_id', selectedToken.id)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedToken?.id && isSheetOpen,
    staleTime: 1000 * 30,
  });


  // 교정 전역 적용(링큐식) — 공유 사전 승격(user_verified) + 내 단어장 동기.
  // 실패해도 이 자료의 교정(correctTokenMutation)은 이미 반영돼 있다(부분 성공 허용).
  const promoteCorrection = async (token, corrections) => {
    try {
      let authHeader = {};
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) authHeader = { Authorization: `Bearer ${session.access_token}` };
      const res = await fetch('/api/dict-correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          base_form: token.base_form || token.text,
          language: materialLang,
          corrections,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const vocab = findSavedVocab(savedWords, token);
      if (vocab?.id) {
        const patch = {
          ...(corrections.meaning ? { meaning: corrections.meaning } : {}),
          ...(corrections.furigana ? { furigana: corrections.furigana } : {}),
          ...(corrections.pos ? { pos: corrections.pos } : {}),
        };
        if (Object.keys(patch).length > 0) {
          await supabase.from('user_vocabulary').update(patch).eq('id', vocab.id);
          queryClient.invalidateQueries({ queryKey: ['vocab-words', user?.id] });
        }
      }
      if (isClient) clearAnalysisCache(localStorage); // 승격된 뜻 반영(§C4)
      toast('사전과 단어장에도 반영했어요!', 'success');
    } catch {
      toast('전체 적용은 실패했어요 — 이 자료에는 반영됐어요.', 'warning');
    }
  };

  // 한자 대조(옵트인) — 음 테이블은 토글이 켜질 때만 지연 로드(245KB 청크, 이후 캐시).
  // 훈 테이블(①, 143KB)도 같은 조건으로 병행 로드. 표기는 글자별 훈음 나열이 정본
  // ('늙을 로(노) 스승 사' — 옥편 표제 관례, 음 단독 줄은 2026-08-23 오너 확정으로 폐지).
  const [hanjaKoTable, setHanjaKoTable] = useState(null);
  const [hanjaHunTable, setHanjaHunTable] = useState(null);
  const [hanjaJaTable, setHanjaJaTable] = useState(null);
  useEffect(() => {
    // ④ 글자 탐색이 열리면 토글·언어와 무관하게 로드(음 테이블은 신자체도 수록 — 실측 확인)
    const needed = (showHanjaKo && materialLang === 'Chinese') || inspectChar !== null;
    if (!needed || hanjaKoTable) return undefined;
    let alive = true;
    import('../lib/data/hanjaKo.json')
      .then((m) => { if (alive) setHanjaKoTable(m.default || m); })
      .catch(() => {});
    import('../lib/data/hanjaHun.json')
      .then((m) => { if (alive) setHanjaHunTable(m.default || m); })
      .catch(() => {});
    import('../lib/data/hanjaJa.json')
      .then((m) => { if (alive) setHanjaJaTable(m.default || m); })
      .catch(() => {});
    return () => { alive = false; };
  }, [showHanjaKo, materialLang, hanjaKoTable, inspectChar]);
  const hanjaHunOf = (text) => (
    materialLang === 'Chinese' && showHanjaKo && hanjaKoTable && hanjaHunTable
      ? listHanjaHunEum(text, hanjaKoTable, hanjaHunTable)
      : null
  );
  // 일본식 자형(오너 확정: 간체보다 익숙한 신자체 단독 표기 — 본문 간체가 헤더에 있어 병기 불요)
  const jaFormOf = (text) => toJaForm(text, hanjaJaTable);

  // 우리 사전(레퍼런스 어휘) 연동(②) — 급수 뱃지 + 정본 뜻·예문·한자 노트 자동 표시
  const refVocab = useRefVocabEntry(materialLang, selectedToken?.base_form || selectedToken?.text);
  // 정본 뜻 대체(오너 피드백): 우리 사전에 있으면 그 뜻을 뜻 자리에 그대로 쓴다 —
  // AI 뜻과 대부분 겹치므로 별도 블록 없이 하나만. 단, 사용자가 이 토큰의 뜻을
  // 직접 교정했다면 교정이 최우선(편집 기능 계약 유지).
  const hasMeaningCorrection = tokenCorrections.some((c) => c?.after_value?.meaning);
  const refMeaning = !hasMeaningCorrection ? (refVocab?.word?.ko || null) : null;

  // 뜻·발음 수동 편집(링큐식) — 자료 소유자만(materials update RLS가 소유자 한정).
  // 같은 사전 행을 한자 대조(ja 대응 표시)도 쓰므로, 편집 중이거나 대조 토글이 켜져 있으면 조회.
  const [isEditingToken, setIsEditingToken] = useState(false);
  // 편집 중 다른 토큰을 탭하면 편집을 닫는다 — 이전 단어의 편집 상태가 새 단어로
  // 이어지는 혼선 차단(마감 ③). 같은 토큰의 교정 반영(id 불변)에는 발화하지 않는다.
  useEffect(() => { setIsEditingToken(false); }, [selectedToken?.id]);
  const canEditToken = !!user?.id && user.id === material?.owner_id;
  const { data: editDictEntry } = useQuery({
    queryKey: ['token-dict', materialLang, selectedToken?.base_form],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('morpheme_dictionary')
        .select('meanings, reading, pos')
        .eq('language', materialLang)
        .eq('base_form', selectedToken.base_form)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: (isEditingToken || (showHanjaKo && materialLang === 'Chinese')) && !!selectedToken?.base_form,
    staleTime: 1000 * 60,
  });

  const saveInlineVocabulary = async (token) => {
    const key = token.base_form || token.text;
    if (inlineSaving[key]) return;
    setInlineSaving(prev => ({ ...prev, [key]: true }));
    try {
      await upsertViewerVocabulary({
        user_id: user.id,
        word_text: normalizeWordText({ surface: token.text, base: token.base_form }),
        base_form: token.base_form || token.text,
        meaning: token.meaning || '',
        pos: token.pos || '',
        furigana: token.furigana || token.reading || '',
        language: materialLang,
      });
      toast(`"${token.text}" 저장!`, 'success');
      queryClient.invalidateQueries({ queryKey: ['vocab-words', user?.id] });
    } catch {
      toast('저장 실패', 'error');
    } finally {
      setInlineSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  const addToVocab = async () => {
    if (!user) { toast('로그인이 필요합니다.', 'warning'); return; }
    if (!selectedToken) return;

    const sourceSentence = extractSourceSentence(selectedToken.id);

    try {
      const row = {
        user_id: user.id,
        // 저장 규약: 분석기 기본형(base_form)이 있으면 기본형, 없으면 surface 폴백.
        word_text: normalizeWordText({ surface: selectedToken.text, base: selectedToken.base_form }),
        base_form: selectedToken.base_form || selectedToken.text, // kuromoji 경로에서 전달됨
        furigana: selectedToken.furigana || selectedToken.reading || '', // 영어는 IPA 저장
        meaning: selectedToken.meaning || '',
        pos: selectedToken.pos || '',
        next_review_at: new Date().toISOString(),
        language: materialLang,
        source_sentence: sourceSentence || null,
        source_material_id: id || null,
      };

      await upsertViewerVocabulary([row], { onConflict: 'user_id,word_text', ignoreDuplicates: true });
      saveCountRef.current += 1;

      // 저장 애니메이션 → 잠시 보여준 뒤 시트 닫기
      setSaveAnim(true);
      setTimeout(() => {
        setSaveAnim(false);
        setIsSheetOpen(false);
        toast(`"${selectedToken.text}" 단어장에 추가됐어요!`, 'success');
        if (saveCountRef.current === 5) {
          setTimeout(() => toast('단어 5개 모았어요! 복습하러 가볼까요?', 'info', 5000), 600);
        } else if (saveCountRef.current === 10) {
          setTimeout(() => toast('벌써 10개! 단어장에서 복습하면 기억이 오래가요', 'info', 5000), 600);
        }
      }, 800);

      queryClient.invalidateQueries({ queryKey: ['vocab-words', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['vocab', user?.id] });
      recordActivity(user.id, () => fetchProfile(user.id));
    } catch (err) {
      toast('단어 추가 실패 — ' + friendlyToastMessage(err), 'error');
    }
  };

  if (isLoading) return <div className="page-container"><Spinner message="자료 해부 중..." /></div>;
  if (error) {
    const isNotFound = error.code === 'NOT_FOUND' || /not.*found|no.*rows|multiple.*rows/i.test(error.message || '');
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>{isNotFound ? '' : '×'}</div>
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
        <h2 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>비공개 자료입니다</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>이 자료는 작성자만 열람할 수 있습니다.</p>
        <Link href="/materials" className="btn btn--primary">자료실로 돌아가기</Link>
      </div>
    );
  }

  const json = material?.processed_json || { sequence: [], dictionary: {} };
  const status = material?.status || material?.processed_json?.status;
  const isAnalyzing = status === 'analyzing';
  const isPending = status === 'pending'; // 책 챕터 미분석 — 원문 열람 가능, 분석은 온디맨드
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

  // 리스트(문장 분석 결과)와 단어 카드는 독립 조각 — 리스트 단어를 탭하면 카드가
  // 리스트 위에 붙는다(② 오너 승인, 팝업 대체). 합성은 아래 rightPanelContent에서.
  const wordListPanel = dragTokens === null ? null : (
    <>
      <div className="pdf-word-list__header" style={{ marginBottom: 10 }}>
        <span className="pdf-word-list__title">단어 ({dragTokens.length})</span>
      </div>
      {dragAnalyzing && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>분석 중...</div>}
      {dragTokens.map((t, i) => {
        const isSaved = savedWords.surfaces?.has(t.text) || savedWords.bases?.has(t.base_form);
        const saveKey = t.base_form || t.text;
        // 🈁 만남 점 — 만났고 아직 담지 않은 말에만(담긴 말은 기존 ✓가 이미 말해준다).
        // 비교는 대조 키(§4.7) — fr 저작형 "la famille"와 토큰 "famille"가 같은 키로 접힌다.
        const isMet = !isSaved && (
          metWordSet.has(normalizeRefWordKey(metCode, t.base_form)) ||
          metWordSet.has(normalizeRefWordKey(metCode, t.text))
        );
        return (
          <div key={i} className={`pdf-word-item ${isSaved ? 'pdf-word-item--saved' : ''}`}>
            <span className="pdf-word-item__text" onClick={() => handleListWordClick(t)}>
              {isMet && (
                <span
                  title="월드에서 만난 말" aria-label="월드에서 만난 말"
                  style={{ color: 'var(--text-muted)', marginRight: 3, fontWeight: 800 }}
                >·</span>
              )}
              {t.text}
              {t.furigana && <span className="pdf-word-item__reading">{t.furigana}</span>}
            </span>
            <span className="pdf-word-item__meaning" onClick={() => handleListWordClick(t)}>{t.meaning}</span>
            {user && (
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button className="pdf-word-item__save" disabled={isSaved || inlineSaving[saveKey]}
                  onClick={() => saveInlineVocabulary(t)}>
                  {isSaved ? '✓' : inlineSaving[saveKey] ? '…' : '★'}
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
    </>
  );

  const wordDetailCard = !selectedToken || !isSheetOpen ? null : (
    <div className={`word-detail-card${dragTokens !== null ? ' word-detail-card--above-list' : ''}`}>
      <div className="word-detail-card__actions">
        {ttsSupported && (
          <button onClick={() => speak(selectedToken.text, materialLang)} aria-label="발음 듣기" style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', minWidth: 32, minHeight: 32 }} title="발음 듣기">▷</button>
        )}
        <button className="word-detail-card__close" onClick={closeWordCard} aria-label="단어 상세 닫기" title="닫기">✕</button>
      </div>
      {(() => {
        // ① 폭맞춤 확대(오너 승인): CJK는 1em 격자라 크기 = 100cqi ÷ fitDivisor가 CSS
        // 수식으로 성립(.word-fit — 측정 JS 없음). 라틴 자료는 기존 크기 유지.
        // ④ 글자 탐색: 한자만 탭 대상 — zh는 seg가 글자 단위라 병음도 그 글자 것이다.
        const rubySegs = selectedToken.furigana ? splitRuby(selectedToken.text, selectedToken.furigana) : null;
        if (!isFitLang(materialLang)) {
          return (
            <div lang={contentLangTag} style={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1.3 }}>
              {rubySegs
                ? rubySegs.map((seg, i) =>
                    seg.kanji ? <ruby key={i}>{seg.kanji}<rt className={seg.pinyin ? ['pinyin-text', showToneColors && pinyinToneClass(seg.reading)].filter(Boolean).join(' ') : undefined} style={{ fontSize: '0.45em', color: showToneColors && seg.pinyin ? undefined : 'var(--primary-light)' }}>{seg.reading}</rt></ruby> : <span key={i}>{seg.plain}</span>
                  )
                : selectedToken.text}
            </div>
          );
        }
        const charSpan = (ch, key, reading) => isInspectableChar(ch) ? (
          <span
            key={key}
            role="button"
            tabIndex={0}
            className={`word-fit__char${inspectChar?.key === key ? ' word-fit__char--active' : ''}`}
            title="글자 정보"
            onClick={() => toggleInspectChar(ch, key, reading)}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggleInspectChar(ch, key, reading))}
          >{ch}</span>
        ) : <span key={key}>{ch}</span>;
        return (
          <div className="word-fit-wrap">
            <div
              className={`word-fit${rubySegs ? '' : ' word-fit--noruby'}`}
              lang={contentLangTag}
              style={{ '--fit-n': fitDivisor(selectedToken.text, selectedToken.furigana, materialLang) }}
            >
              <span className="surface">
                {rubySegs
                  ? rubySegs.map((seg, i) =>
                      seg.kanji
                        ? <ruby key={i} data-pinyin={seg.pinyin ? '1' : undefined} data-yomi={seg.pinyin ? undefined : '1'}>
                            {[...seg.kanji].map((ch, j) => charSpan(ch, `${i}:${j}`, seg.pinyin ? seg.reading : null))}
                            <span className={['rt-an', showToneColors && seg.pinyin ? pinyinToneClass(seg.reading) : ''].filter(Boolean).join(' ')}>{seg.reading}</span>
                          </ruby>
                        : <span key={i}>{seg.plain}</span>
                    )
                  : [...selectedToken.text].map((ch, j) => charSpan(ch, `p:${j}`, null))}
              </span>
            </div>
          </div>
        );
      })()}
      {inspectChar && (() => {
        // ④ 글자 패널 — 훈음·병음·日 자형(기존 테이블) + 이 글자가 든 내 단어(재인식 앵커)
        const d = charDetail(inspectChar.ch, { koTable: hanjaKoTable, hunTable: hanjaHunTable, jaTable: hanjaJaTable }) || {};
        const related = wordsWithChar(inspectChar.ch, [...(savedWords.byKey?.values() || [])], { language: materialLang, excludeText: selectedToken.text });
        return (
          <div className="char-inspect">
            <div className="char-inspect__row">
              <span className="char-inspect__ch" lang={contentLangTag}>{inspectChar.ch}</span>
              {inspectChar.reading && (
                <span className={['pinyin-text', showToneColors ? pinyinToneClass(inspectChar.reading) : ''].filter(Boolean).join(' ')}>{inspectChar.reading}</span>
              )}
              {(d.hunEum || d.eum) && <span className="char-inspect__hun">{d.hunEum || `음 ${d.eum}`}</span>}
              {d.ja && <span className="char-inspect__ja">日 <span lang="ja">{d.ja}</span></span>}
              {!hanjaKoTable && <span className="char-inspect__loading">옥편 로딩…</span>}
            </div>
            {related.length > 0 && (
              <div className="char-inspect__words">
                <span className="char-inspect__words-label">내 단어</span>
                {related.map((v) => (
                  <button
                    key={v.id || v.word_text}
                    className="char-inspect__word"
                    lang={contentLangTag}
                    onClick={() => handleListWordClick({ text: v.word_text, base_form: v.base_form || v.word_text, meaning: v.meaning, furigana: v.furigana, pos: v.pos })}
                  >{v.word_text}</button>
                ))}
              </div>
            )}
          </div>
        );
      })()}
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4, marginBottom: 12 }}>
        <TokenPosLabel token={selectedToken} />
        {selectedToken.base_form && selectedToken.base_form !== selectedToken.text && ` · ${selectedToken.base_form}`}
        {refVocab && (
          <span style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 999, background: 'var(--primary-glow)', color: 'var(--primary-light)', fontWeight: 700, fontSize: '0.7rem' }}>
            {refLevelLabel(refVocab.level)}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: materialLang === 'English' && selectedToken.reading ? 4 : 14 }}>
        <div style={{ fontSize: '1rem', lineHeight: 1.6, flex: 1, minWidth: 0 }}>
          {refMeaning || selectedToken.meaning || '(뜻 없음)'}
        </div>
        {/* 리스트 단어는 자료 토큰이 아니라(id 없음) 이 자료의 교정 대상이 될 수 없다 */}
        {canEditToken && selectedToken.id && (
          <button
            onClick={() => setIsEditingToken(v => !v)}
            aria-label="뜻·발음 수정"
            title="뜻·발음 수정"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.95rem', minWidth: 28, minHeight: 28, flexShrink: 0, opacity: isEditingToken ? 1 : 0.55 }}
          >✏️</button>
        )}
      </div>
      {/* ⑤ 유의어·반의어(오너 승인) — 뜻 바로 아래, 준비되면 조용히 나타난다(내용어만) */}
      {synAnt && !synAnt.loading && (synAnt.syn.length > 0 || synAnt.ant.length > 0) && (
        <div className="syn-ant">
          {synAnt.syn.length > 0 && (
            <div className="syn-ant__row">
              <span className="syn-ant__label">유의어</span>
              {renderSynAntChips(synAnt.syn)}
            </div>
          )}
          {synAnt.ant.length > 0 && (
            <div className="syn-ant__row">
              <span className="syn-ant__label">반의어</span>
              {renderSynAntChips(synAnt.ant)}
            </div>
          )}
        </div>
      )}
      {isEditingToken && (
        <TokenEditPanel
          key={selectedToken.id} // 토큰 전환 시 리마운트 — 이전 단어 입력값이 새 토큰에 붙는 것 차단(마감 ③)
          token={selectedToken}
          language={materialLang}
          dictEntry={editDictEntry}
          saving={correctTokenMutation.isPending}
          onSave={(corrections, opts) => {
            // 성공 시에만 닫는다 — 실패 시 패널·입력값 유지(재시도 가능). 전역 승격도
            // 자료 교정이 실제로 반영된 뒤에만(부분 성공 허용 계약 유지).
            correctTokenMutation.mutate(
              { tokenId: selectedToken.id, corrections },
              {
                onSuccess: () => {
                  if (opts?.applyGlobal) promoteCorrection(selectedToken, corrections);
                  setIsEditingToken(false);
                },
              }
            );
          }}
          onClose={() => setIsEditingToken(false)}
        />
      )}
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

      {/* 한자 대조 블록(배치 개선 — 뜻 아래 보조 위치): 훈음 줄은 일본식 자형 단독(오너
          확정 — 본문 간체가 헤더에 있어 병기 불요), 글자 그룹 단위 줄바꿈. 日 줄은 어형이
          글자 나열과 같으면 요미만(#1041 원리의 단어판), ⚠ 경고는 日 줄에 통합. */}
      {(() => {
        const ja = materialLang === 'Chinese' && showHanjaKo ? getJaRef(editDictEntry) : null;
        const huns = hanjaHunOf(selectedToken.text);
        const jr = ja ? formatJaRef(ja, selectedToken.text, jaFormOf(selectedToken.text)) : null;
        const warn = getJaWarn(ja);
        // 음 단독 줄은 폐지(2026-08-23 오너 확정) — 훈 없는 글자도 음만으로 훈음 나열에
        // 편입돼(listHanjaHunEum 폴백) 나열이 단어의 유일한 음 앵커다.
        if (!jr && !warn && !huns) return null;
        return (
          <div style={{ fontSize: '0.82rem', marginBottom: 12 }}>
            {huns && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 14px' }}>
                {huns.map(({ ch, label }, i) => (
                  <span key={`${ch}-${i}`} style={{ whiteSpace: 'nowrap' }}>
                    <span lang="ja" style={{ fontWeight: 700 }}>{jaFormOf(ch)}</span>{' '}
                    <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  </span>
                ))}
              </div>
            )}
            {(jr || warn) && (
              <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                日{' '}
                {jr && <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{jr}</span>}
                {warn && (
                  <span style={{ color: 'var(--warning)', fontWeight: 600, marginLeft: jr ? 6 : 0 }}>
                    ⚠ {jaFormOf(selectedToken.text)}는 일본어로 '{warn}'
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* 정본 예문·한자 노트(② — 오너 피드백로 박스 해체): 뜻은 위 뜻 자리가 대체 표시,
          pos는 TokenPosLabel·병음은 헤더와 중복이라 생략. 예문만 새 정보라 자연 배치,
          한자 노트는 한자 대조 토글(훈음 나열)과 겹치므로 토글 꺼짐일 때만. */}
      {refVocab?.word?.ex && (
        // 예문 3줄 스택(오너 확정): 예문 → 병음 → 뜻
        <div style={{ fontSize: '0.84rem', lineHeight: 1.55, marginBottom: 12 }}>
          <div lang="zh-Hans">{refVocab.word.ex.zh}</div>
          <div className="pinyin-text" style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>{refVocab.word.ex.pinyin}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{refVocab.word.ex.ko}</div>
        </div>
      )}
      {refVocab?.word?.hanja && !showHanjaKo && (
        <div style={{ fontSize: '0.76rem', color: '#51A85C', marginBottom: 12 }}>
          한자 · {refVocab.word.hanja}
        </div>
      )}

      {wordDetail?.loading ? (
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>상세 설명 생성 중...</div>
      ) : wordDetail?.detail ? (
        <div className="pdf-detail-popup__text" style={{ marginBottom: 14 }}
          dangerouslySetInnerHTML={{ __html: formatDetail(wordDetail.detail) }} />
      ) : (
        <button
          onClick={() => fetchWordDetail(selectedToken)}
          className="btn btn--ghost btn--sm"
          style={{ width: '100%', marginBottom: 12 }}
        >
          상세 설명 보기
        </button>
      )}

      {user && findSavedVocab(savedWords, selectedToken) && isTokenDue(savedWords, selectedToken) && (
        <div style={{ padding: '10px 12px', background: 'rgba(212,150,42,0.1)', borderRadius: 'var(--radius-md)', marginBottom: 12, border: '1px solid var(--warning)' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--warning)', marginBottom: 8 }}>복습 시점이에요</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[{ label: '모름', rating: 1 }, { label: '애매', rating: 2 }, { label: '알아', rating: 3 }].map(r => (
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
          {saveAnim ? '저장됨' : isWordSaved ? '✓ 단어장에 있음' : '단어장에 저장'}
        </button>
      )}
    </div>
  );

  const rightPanelContent = wordDetailCard || wordListPanel ? (
    <div className="viewer-side__content">
      {wordDetailCard}
      {wordListPanel}
    </div>
  ) : (
    <div className="pdf-side__empty">
      단어 클릭 → 상세<br />문장 드래그 → 단어 목록
    </div>
  );

  const leftPanelContent = leftPanelLoading ? (
    <div className="pdf-side__empty">
      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>번역 + 맥락 생성 중...</span>
    </div>
  ) : leftPanelResult ? (
    <div className="viewer-side__content">
      <div className="pdf-context__title">번역 · 맥락</div>
      {leftPanelText && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
          <div className="pdf-context__original" lang={contentLangTag} style={{ flex: 1, minWidth: 0 }}>"{leftPanelText.length > 120 ? leftPanelText.slice(0, 120) + '…' : leftPanelText}"</div>
          {ttsSupported && (
            <button
              onClick={() => speak(leftPanelText, materialLang)}
              aria-label="지정한 문장 듣기"
              title="지정한 문장 듣기"
              style={{ background: 'none', border: 'none', fontSize: '1.05rem', cursor: 'pointer', minWidth: 32, minHeight: 32, flexShrink: 0, color: 'var(--primary-light)' }}
            >▷</button>
          )}
        </div>
      )}
      <div className="pdf-context__text" dangerouslySetInnerHTML={{ __html: formatDetail(leftPanelResult) }} />

      {/* [자세히] — 문법 온디맨드(구조+패턴 통합, 정본 챕터 연결). 번역·어휘는 이미
          위(맥락)와 오른쪽(단어 목록)이 담당하므로 여기서 반복하지 않는다. */}
      {!grammar.open ? (
        <button
          className="grammar-btn grammar-detail__toggle"
          onClick={() => grammar.run(leftPanelText)}
          disabled={!leftPanelText}
        >자세히 ▾</button>
      ) : (
        <div className="grammar-detail">
          {grammar.loading ? (
            <div className="grammar-detail__loading">문법 해설 생성 중…</div>
          ) : (
            <>
              {grammar.result && (
                <div className="pdf-context__text" dangerouslySetInnerHTML={{ __html: formatDetail(grammar.result) }} />
              )}
              {grammar.chapter && (
                <Link href={grammar.chapter.href} className="grammar-detail__ref">
                  → 정본 해설: 「{grammar.chapter.title}」 ›
                </Link>
              )}
              {user && grammar.result && (
                <button
                  onClick={() => saveGrammarNoteMutation.mutate()}
                  disabled={saveGrammarNoteMutation.isPending || saveGrammarNoteMutation.isSuccess}
                  className="grammar-btn grammar-detail__save"
                >
                  {saveGrammarNoteMutation.isSuccess ? '✓ 저장됨' : saveGrammarNoteMutation.isPending ? '저장 중…' : '노트에 저장'}
                </button>
              )}
              <div className="grammar-detail__ask">
                <input
                  value={grammar.question}
                  onChange={(e) => grammar.setQuestion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') grammar.ask(leftPanelText); }}
                  placeholder="이 문장에 대해 더 묻기"
                  aria-label="문법 추가 질문"
                  className="form-input"
                />
                <button
                  className="grammar-btn"
                  onClick={() => grammar.ask(leftPanelText)}
                  disabled={grammar.asking || !grammar.question.trim()}
                >{grammar.asking ? '…' : '질문'}</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  ) : (
    <div className="pdf-side__empty">
      텍스트를 드래그하면<br />번역과 맥락이 여기에
    </div>
  );

  return (
    // --dragging: 지정 드래그 중 바텀시트 포인터 투과 — 시트가 드래그 도중 자라
    // 경로를 덮어도 elementFromPoint가 밑의 토큰을 잡는다(useTokenRangeSelect 참조)
    <div className={`viewer-3col viewer-theme-${theme}${tokenRange.dragging ? ' viewer-3col--dragging' : ''}`}>

      {/* 왼쪽 — 문법 해설 / 맥락 */}
      <aside className="viewer-side viewer-side--left">
        {leftPanelContent}
      </aside>

      {/* 중앙 — 뷰어 본문 */}
      <main className="viewer-center">
      {!user && (
        <div className="viewer-guest-banner">
          <span>단어를 클릭해 뜻을 확인할 수 있어요.</span>
          <Link href="/auth" className="viewer-guest-banner__cta">
            로그인하면 단어장에 저장하고 복습할 수 있습니다 →
          </Link>
        </div>
      )}

      <header className="page-header viewer-header">
        <Link href="/materials" className="viewer-back-link">← 자료실</Link>
        {(prevLesson || nextLesson) && (
          <div className="viewer-series-nav">
            {prevLesson ? (
              <Link href={`/viewer/${prevLesson.id}`} className="viewer-series-nav__btn" title={prevLesson.title} aria-label="이전 편">◀</Link>
            ) : <span className="viewer-series-nav__btn viewer-series-nav__btn--disabled" aria-hidden="true">◀</span>}
            {seriesPosition && (
              <span className="viewer-series-nav__position" title={`${seriesPosition.level} ${seriesPosition.series}`}>
                {seriesPosition.current}/{seriesPosition.total}
              </span>
            )}
            {nextLesson ? (
              <Link href={`/viewer/${nextLesson.id}`} className="viewer-series-nav__btn" title={nextLesson.title} aria-label="다음 편">▶</Link>
            ) : <span className="viewer-series-nav__btn viewer-series-nav__btn--disabled" aria-hidden="true">▶</span>}
          </div>
        )}
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
                편집
              </button>
            )}
          </h1>
        )}
        {user && material?.visibility === 'public' && material?.owner_id !== user.id && (
          <ReportMaterialButton materialId={material.id} userId={user.id} toast={toast} />
        )}
        {user && savedCount > 0 && (
          <Link href="/vocab" prefetch={false} className="viewer-vocab-counter">
            {savedCount}개 수집 → 단어장
          </Link>
        )}
        {user && dueInMaterial > 0 && (
          <div style={{
            padding: '4px 10px', borderRadius: 'var(--radius-full)',
            background: 'rgba(212,150,42,0.15)', border: '1px solid var(--warning)',
            color: 'var(--warning)', fontSize: '0.78rem', fontWeight: 600,
          }} title="노란 테두리 단어 클릭 → 인라인 복습">
            {dueInMaterial}개 복습 가능
          </div>
        )}
      </header>

      <ListenControls text={material?.raw_text} language={materialLang} />

      {/* PDF 출처 배지 + 다음 범위 분석 */}
      {sourcePdf && material.page_start && (
        <div className="u-highlight-card u-row u-row--between u-row--wrap u-row--gap-md u-mb-sm" style={{ marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--primary-light)', fontWeight: 700 }}>
              PDF 출처
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
                ? '추출 중...'
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
        <button className="viewer-settings__toggle" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(v => !v)}>
          읽기 설정 {settingsOpen ? '▲' : '▼'}
        </button>
        <div className="viewer-settings__body">
        <div className="viewer-settings__left">
          <div className="settings-control">
            <span className="settings-label">크기</span>
            <div className="settings-btn-group">
              <button className="settings-btn" onClick={() => setFontSize(f => Math.max(0.8, f - 0.1))}>-</button>
              <button className="settings-btn" onClick={() => setFontSize(f => Math.min(3, f + 0.1))}>+</button>
            </div>
          </div>

          <div className="settings-control">
            <span className="settings-label">줄 간격</span>
            <input type="range" min="10" max="60" value={lineGap}
              onChange={e => setLineGap(parseInt(e.target.value))}
              className="settings-range settings-range--primary"
            />
          </div>

          <div className="settings-control">
            <span className="settings-label">자간</span>
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
              aria-label="밝은 배경"
              aria-pressed={theme === 'light'}
              className={`theme-btn theme-btn--light ${theme === 'light' ? 'theme-btn--active' : ''}`}
            />
            <button
              onClick={() => setTheme('dark')}
              aria-label="어두운 배경"
              aria-pressed={theme === 'dark'}
              className={`theme-btn theme-btn--dark ${theme === 'dark' ? 'theme-btn--active' : ''}`}
            />
          </div>

          <button
            onClick={() => setShowFurigana(v => !v)}
            className={`grammar-btn ${showFurigana ? '' : 'grammar-btn--active'}`}
            title="후리가나 표시/숨김"
          >
            {showFurigana ? '후리가나 숨기기' : '후리가나 보이기'}
          </button>

          <button
            onClick={() => setFocusMode(v => !v)}
            className={`grammar-btn ${focusMode ? 'grammar-btn--active' : ''}`}
            title="문장 막대(¦)나 드래그로 지정한 문장만 밝게, 나머지는 어둡게"
          >
            {focusMode ? '☑ 집중 모드 켜짐' : '◻ 집중 모드 꺼짐'}
          </button>

          {materialLang === 'Chinese' && (
            <button
              onClick={() => setShowHanjaKo(v => !v)}
              className={`grammar-btn ${showHanjaKo ? 'grammar-btn--active' : ''}`}
              title="단어 상세에 글자별 훈음 병기 — 예: 老师 → 老 늙을 로(노) · 師 스승 사"
            >
              {showHanjaKo ? '☑ 한자 대조 켜짐' : '◻ 한자 대조 꺼짐'}
            </button>
          )}

          {materialLang === 'Chinese' && (
            <button
              onClick={() => setShowToneColors(v => !v)}
              className={`grammar-btn ${showToneColors ? 'grammar-btn--active' : ''}`}
              title="병음을 성조별 색으로 — 1성 빨강·2성 초록·3성 파랑·4성 보라·경성 회색 (Pleco 표준)"
            >
              {showToneColors ? '☑ 성조 색상 켜짐' : '◻ 성조 색상 꺼짐'}
            </button>
          )}

          {ttsSupported && (
            <button
              onClick={() => setAutoSpeakOnClick(v => !v)}
              className={`grammar-btn ${autoSpeakOnClick ? 'grammar-btn--active' : ''}`}
              title="단어 클릭 시 자동 발음"
            >
              {autoSpeakOnClick ? '▷ 자동 발음 켜짐' : '◻ 자동 발음 꺼짐'}
            </button>
          )}


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
                  재분석
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
                        <button className="reanalyze-panel__item" onClick={() => { setReanalyzePanel(null); setSourceEditOpen(true); }}>
                          <strong>원문 수정</strong>
                          <span>텍스트를 고치면 바뀐 줄만 분석합니다</span>
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
              ? <span className="grammar-btn viewer-complete-badge">✓ 읽기 완료</span>
              : <button
                  onClick={() => markCompleteMutation.mutate()}
                  disabled={markCompleteMutation.isPending}
                  className="grammar-btn grammar-btn--complete"
                >
                  {markCompleteMutation.isPending ? '...' : '✓ 읽기 완료 표시'}
                </button>
          )}

          {user && material?.raw_text && STUDY_LANGS.has(materialLang) && (
            <Link
              href={`/study?source=mine&lang=${encodeURIComponent(materialLang)}`}
              className="study-textlink"
              onClick={() => {
                try {
                  localStorage.setItem(`study_source_${materialLang}`, (material.raw_text || '').slice(0, 1500));
                } catch {}
              }}
            >
              이 자료로 오늘 학습 만들기
            </Link>
          )}
        </div>
        </div>{/* viewer-settings__body */}
      </div>

      {/* 책 챕터 내비(P1) — 같은 책의 형제 챕터 사이 이동 */}
      {bookNav && (
        <div className="book-nav">
          {bookNav.prev
            ? <Link href={`/viewer/${bookNav.prev.id}`} className="book-nav__btn">← 이전</Link>
            : <span className="book-nav__btn book-nav__btn--off">← 이전</span>}
          <span className="book-nav__title">
            《{bookNav.title}》 <span className="book-nav__pos">{bookNav.pos}/{bookNav.total}</span>
          </span>
          {bookNav.next
            ? <Link href={`/viewer/${bookNav.next.id}`} className="book-nav__btn">다음 →</Link>
            : <span className="book-nav__btn book-nav__btn--off">다음 →</span>}
        </div>
      )}

      {/* Reader Area — 인앱 토큰 범위 지정(드래그) 이벤트는 여기서 위임 수신 */}
      <div
        ref={readerRef}
        className={`card reader-area reader-area--${theme}${focusMode && (pickedLineIdx !== null || tokenRange.range) ? ' reader-area--focus' : ''}`}
        style={{
          fontSize: `${fontSize}rem`,
          // 자료 언어의 표준 자형이 우선(오너 확정) — 중국어는 SC, 일본어는 JP를 사용자
          // 글꼴 설정 앞에 놓아, 설정 글꼴(KR 계열)이 한자를 자기 자형으로 그리는 것을
          // 막는다. 한글·라틴처럼 그 폰트에 없는 글자는 설정 글꼴로 흘러간다.
          fontFamily: materialLang === 'Chinese'
            ? `var(--font-noto-sc, 'Noto Sans SC'), ${fontFamily}`
            : materialLang === 'Japanese'
              ? `var(--font-noto-jp, 'Noto Sans JP'), ${fontFamily}`
              : fontFamily,
          gap: `${lineGap}px ${charGap}rem`, '--char-gap': `${charGap}rem`,
        }}
        onPointerDown={tokenRange.handlePointerDown}
        onClickCapture={tokenRange.handleClickCapture}
        onClick={handleReaderBlankClick}
      >
        {isAnalyzing && !isStaleAnalysis && (
          <div className="analyzing-banner">
            <span>문단 단위로 분석 중입니다...</span>
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
            <span>분석이 중단된 것 같아요{missingLineCount > 0 && ` (남은 ${missingLineCount}줄)`}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {reanalyzeMutation.isPending
                ? <button onClick={stopReanalysis} className="analyzing-banner__refresh" style={{ background: 'var(--danger)' }}>⏹ 중단</button>
                : <button onClick={() => reanalyze.mutation.mutate({ resume: true })} className="analyzing-banner__refresh" style={{ background: 'var(--accent)' }}>▶ 이어서 분석</button>
              }
            </div>
          </div>
        )}

        {isPending && (
          <div className="analyzing-banner">
            <span>이 챕터는 아직 분석 전이에요 — 원문은 그대로 읽을 수 있어요.</span>
            {user?.id === material?.owner_id && (
              reanalyzeMutation.isPending
                ? <button onClick={stopReanalysis} className="analyzing-banner__refresh" style={{ background: 'var(--danger)' }}>⏹ 중단</button>
                : <button onClick={startFullReanalyze} className="analyzing-banner__refresh">이 챕터 분석하기</button>
            )}
          </div>
        )}

        {isFailed && (
          <div className="analyzing-banner analyzing-banner--error">
            <span>분석에 실패했습니다.</span>
            {reanalyzeMutation.isPending
              ? <button onClick={stopReanalysis} className="analyzing-banner__refresh" style={{ background: 'var(--danger)' }}>⏹ 중단</button>
              : <button onClick={startFullReanalyze} className="analyzing-banner__refresh">재분석</button>
            }
          </div>
        )}

        {isPartial && failedIndices.length > 0 && !reanalyzeMutation.isPending && (
          <div className="analyzing-banner analyzing-banner--warn">
            <span>{failedIndices.length}줄 분석 실패</span>
            <button onClick={() => reanalyze.mutation.mutate()} className="analyzing-banner__refresh">실패 줄 재시도</button>
          </div>
        )}

        {(() => {
          // raw_text 줄 분리 (헤딩 감지 + showRaw 렌더 공용)
          const rawLines = material?.raw_text?.split('\n') ?? [];

          // 헤딩 감지: 명시적 # 마크다운 또는 휴리스틱 자동 감지 (대사 오탐 가드 포함 — #988)
          const HEADING_CLASS = { 1: 'viewer-h1', 2: 'viewer-h2', 3: 'viewer-h3' };
          const headingLevels = computeHeadingLevels(rawLines);

          function getHeadingLevel(lineText, lineIdx) {
            if (lineIdx != null && headingLevels[lineIdx] != null) return headingLevels[lineIdx];
            if (!lineText) return 0;
            const m = lineText.match(/^(#{1,3})\s/);
            return m ? m[1].length : 0;
          }

          const showRaw = (isAnalyzing || isPending) && rawLines.length > 0;

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

          const renderToken = (tokenId, lineHead = null, picked = false) => {
            const token = json.dictionary[tokenId];
            if (!token) return null;
            // 막대 지정(줄 전체)과 인앱 범위 지정이 같은 이펙트 언어를 공유한다(#1002)
            const inRange = tokenRange.rangeTokenIds?.has(tokenId) ?? false;
            const pickedClass = picked || inRange ? ' word-token--picked' : '';
            // 줄 첫 토큰에만 문장 전체 지정 막대 — 한자와 같은 라인박스에 인라인으로 앉혀
            // 루비(요미가나·병음) 유무와 무관하게 본문 글자 높이에 정렬된다.
            const linePick = lineHead ? (
              <button
                className="line-pick"
                aria-label="문장 전체 분석"
                title="문장 전체 분석"
                onMouseUp={e => e.stopPropagation()}
                onClick={e => {
                  e.stopPropagation();
                  tokenRange.clearRange(); // 범위 지정 이펙트와 상호 배타
                  setPickedLineIdx(lineHead.rawIdx); // 문장 전체 지정 이펙트
                  setSelectedRangeText(lineHead.text); // 문법 버튼 활성 경로
                  // 집중 모드 단일 규칙: 지정 '밖' 막대 = 순수 이동(지정 먼저), 지정된
                  // 문장의 막대 재탭 = 본래처럼 전체 분석. 집중 꺼짐 = 항상 분석.
                  if (focusMode && pickedLineIdx !== lineHead.rawIdx) clearAnalysisPanels();
                  else runSelectionAnalysis(lineHead.text);
                }}
              />
            ) : null;
            if (token.failed) {
              return (
                <div key={tokenId} ref={el => { if (el) tokenRefs.current[tokenId] = el; }}
                  data-tid={tokenId}
                  className={`word-token word-token--failed${pickedClass}`} title="분석 실패 — 재시도 버튼을 눌러주세요">
                  {linePick}
                  <span className="furigana" />
                  <span className="surface">{token.text}</span>
                  <span className="failed-marker">!</span>
                </div>
              );
            }
            const isSaved = isTokenSaved(savedWords, token);
            const isDue = isSaved && isTokenDue(savedWords, token);
            // ruby는 토글과 무관하게 항상 만든다 — 폭 예약(ruby[data-pinyin])이 병음을 꺼도
            // 유지돼야 켤 때 글자가 밀리지 않는다(오너 요청 2026-08-19). 끌 때는 rt만 감춘다.
            const rubySegments = token.furigana
              ? splitRuby(token.text, token.furigana)
              : null;
            return (
              <div key={tokenId} ref={el => { if (el) tokenRefs.current[tokenId] = el; }}
                data-tid={tokenId}
                className={`word-token ${isSaved ? 'word-token--saved' : ''} ${isDue ? 'word-token--due' : ''}${pickedClass}`}
                role="button" tabIndex={0}
                onClick={() => handleTokenClick(token, tokenId)}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), handleTokenClick(token, tokenId))}>
                {linePick}
                {rubySegments ? (
                  <span className={`surface${showFurigana ? '' : ' surface--furi-off'}`}>
                    {rubySegments.map((seg, i) =>
                      seg.kanji
                        // 병음 rt는 CSS가 전 음절 단일 크기(최장 병음이 1em 셀에 들어가는
                        // 크기)로 조판한다 — 글자별 속성이 더 필요 없다(오너 확정 2026-08-19).
                        // 요미가나(data-yomi)는 크기 유지 + 절대배치 — 한자 폭 불변(오너 요청).
                        // 독음은 <rt>가 아니라 span(.rt-an) — WebKit이 rt에 한해 절대배치를
                        // 무시해 iOS에서 병음이 흐름으로 새던 실기 결함의 수리(진단기 실측).
                        ? <ruby key={i} data-pinyin={seg.pinyin ? '1' : undefined}
                            data-yomi={seg.pinyin ? undefined : '1'}>
                            {seg.kanji}<span className={['rt-an', showToneColors && seg.pinyin ? pinyinToneClass(seg.reading) : ''].filter(Boolean).join(' ')}>{seg.reading}</span>
                          </ruby>
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
                    ? lineTokens.map(id => renderToken(id))
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

            // 문장 전체 지정 버튼용 원문 — rawLines가 어긋나면 토큰 표면형으로 폴백
            const lineText = (rawLines[rawIdx] ?? '').trim().replace(/^#{1,3}\s/, '')
              || lineTokenIds.slice(startIdx).map(id => json.dictionary[id]?.text || '').join('').trim();

            const isPicked = pickedLineIdx === rawIdx;

            return (
              <span key={gi} className={hClass || undefined} style={{ display: 'contents' }}>
                {lineTokenIds.slice(startIdx).map((id, ti) =>
                  renderToken(id, ti === 0 && lineText.length >= 2 ? { text: lineText, rawIdx } : null, isPicked)
                )}
                {gi < lineGroups.length - 1 && <div className="line-break" />}
              </span>
            );
          });
        })()}

        {/* 문장 이동(▲ 위 / ▼ 아래) — 문장이 지정된 동안에만 나타나는 플로팅 필(데스크톱
            전용 — 모바일은 하단 바 안의 ▲▼가 대신한다, 시트 겹침 재배치). */}
        {pickedLineIdx !== null && sentences.length > 0 && (
          <div className="sentence-nav" role="group" aria-label="문장 이동">
            {sentenceNavBtn(-1, 'sentence-nav__btn')}
            {sentenceNavBtn(1, 'sentence-nav__btn')}
          </div>
        )}

        {/* 지정 범위 양끝 그립 — 잡아 끌어 미세 조정(P3) */}
        <TokenRangeGrips
          range={tokenRange.range}
          sequence={material?.processed_json?.sequence}
          tokenRefs={tokenRefs}
          readerRef={readerRef}
          onGripDown={tokenRange.startGripAdjust}
        />

        {isDone && (
          <div className="reader-hint">
            단어를 <strong>클릭</strong>하면 상세 정보, 문장을 <strong>드래그</strong>하면 번역+맥락
          </div>
        )}

      </div>

      {/* 다음 강의 — 같은 시리즈 next # (primary CTA) */}
      {isDone && nextLesson && (
        <Link href={`/viewer/${nextLesson.id}`} className="next-lesson-card">
          <div className="next-lesson-card__hint">다음 편</div>
          <div className="next-lesson-card__title">{nextLesson.title}</div>
        </Link>
      )}

      {/* 시리즈/레벨 완주 — nextLesson 없을 때 */}
      {isDone && !nextLesson && seriesEndCard && (
        seriesEndCard.material ? (
          <Link href={`/viewer/${seriesEndCard.material.id}`} className="series-end-card">
            <div className="series-end-card__hint">
              {seriesEndCard.type === 'level'
                ? `${seriesEndCard.level} 완주! ${seriesEndCard.nextLevel}로 진학`
                : `${seriesEndCard.level} ${seriesEndCard.fromSeries} 시리즈 완주!`}
            </div>
            <div className="series-end-card__title">{seriesEndCard.material.title}</div>
          </Link>
        ) : (
          <div className="series-end-card series-end-card--top">
            <div className="series-end-card__hint">
              {seriesEndCard.level} {seriesEndCard.fromSeries} 시리즈 완주!
            </div>
            <div className="series-end-card__title" style={{ color: 'var(--text-muted)' }}>
              최고 레벨 도달 — 외부 자료를 활용해보세요
            </div>
          </div>
        )
      )}

      {/* 학습 강화 — 보조 CTA 두 개를 한 줄에 (미니멀) */}
      {isDone && !showReadingTest && !showConversation && (
        <div className="post-reading-actions">
          <button
            className="post-reading-actions__btn"
            onClick={() => setShowReadingTest(true)}
          >
            리딩 테스트
          </button>
          <button
            className="post-reading-actions__btn"
            onClick={() => setShowConversation(true)}
          >
            회화 연습
          </button>
        </div>
      )}

      {/* 리딩 테스트 인라인 확장 */}
      {isDone && showReadingTest && (
        <div className="reading-test-section">
          <ReadingTest
            rawText={material?.raw_text}
            language={materialLang}
            materialId={id}
            onClose={() => setShowReadingTest(false)}
            inline
            nextLesson={nextLesson}
          />
        </div>
      )}

      {/* 회화 연습 인라인 확장 */}
      {isDone && showConversation && (
        <div className="reading-test-section">
          <ConversationPanel
            rawText={material?.raw_text}
            language={materialLang}
            materialId={id}
            materialTitle={material?.title}
            onClose={() => setShowConversation(false)}
            inline
            nextLesson={nextLesson}
          />
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
        leftSignal={leftSheetSignal}
        rightSignal={rightSheetSignal}
        barNav={pickedLineIdx !== null && sentences.length > 0 ? (
          <>
            {sentenceNavBtn(-1, 'viewer-sheet-bar__btn viewer-sheet-bar__btn--nav')}
            {sentenceNavBtn(1, 'viewer-sheet-bar__btn viewer-sheet-bar__btn--nav')}
          </>
        ) : null}
      />


      {user?.id === material?.owner_id && (
        <SourceEditModal
          open={sourceEditOpen}
          initialText={material?.raw_text || ''}
          processedJson={material?.processed_json}
          saving={reanalyzeMutation.isPending}
          onSave={handleSourceEditSave}
          onClose={() => setSourceEditOpen(false)}
        />
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
