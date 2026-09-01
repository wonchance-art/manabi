'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { cacheMaterial, getCachedMaterial } from '../lib/offlineCache';
import OfflineNotice from '../components/OfflineNotice';
import { useReadingTimer } from '../lib/useReadingTimer';
import { countReadableChars } from '../lib/readingTimer';
import { useReadingPacer } from '../lib/useReadingPacer';
import { dwellMs, defaultTargetCpm, paceHint, stepCpm } from '../lib/readingPacer';
import { pdfViewerHref } from '../lib/pdfRangeBridge';
import { fetchReadingSpeedRows } from '../lib/readingSpeedRows';
import { recentCpm, suggestTargetCpm } from '../lib/readingSpeedHistory';
import { comprehensionRatio, ladderLabel, ladderTargetCpm, nextLadderStep } from '../lib/pacerLadder';
import { computeHeadingLevels } from '../lib/headingHeuristics';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import PatternCard from '../components/PatternCard';
import { dueChapterSet, filterNote, filterScan, loadPatternIndex, scanTokens, supportsPatterns } from '../lib/patternIndex';
import { fetchDuePatternRows } from '../lib/patternRows';
import { weakChapterSet } from '../lib/weaknessProfile';
import { fetchWeaknessRows } from '../lib/weaknessRows';
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
import { VOCAB_UPSERT, buildVocabRow } from '../lib/vocabIO';
import { callGemini } from '../lib/gemini';
import { fetchWordDetailText } from '../lib/wordDetail';
import { fetchCtxExplain } from '../lib/ctxExplain';
import { pinyinToneClass } from '../lib/pinyinTone';
import { splitRuby } from '../lib/splitRuby';
import { pickableSentences, adjacentSentence } from '../lib/sentenceNav';
import { fitDivisor, isFitLang } from '../lib/fitWord';
import { charDetail, charEtym, isInspectableChar, materialWordsWithChar, wordsWithChar } from '../lib/charInspect';
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
import { usePdfRangeMutation } from '../lib/usePdfRangeMutation';
import { useReadProgress } from '../lib/useReadProgress';
import { useGroupReadPush } from '../lib/useGroupReadPush';
import { useScrollRestore } from '../lib/useScrollRestore';
import { listHanjaHunEum, toJaForm } from '../lib/hanjaKo';
import { useGrammarDetail } from '../lib/useGrammarDetail';
import { useEasierText } from '../lib/useEasierText';
import { buildContextPrompt } from '../lib/grammarDetail';
import { analysisCacheKey, clearAnalysisCache, readAnalysisCache, writeAnalysisCache } from '../lib/viewerAnalysisCache';
import { useRefVocabEntry, refLevelLabel } from '../lib/refVocabIndex';
import { fetchKnownWords, knownWordsLang, markKnown, unmarkKnown } from '../lib/knownWords';
import { mergeKnownIntoIndex } from '../lib/knownWords';
import { materialFit, FIT_MIN_TYPES } from '../lib/materialFit';
import DictationPanel from '../components/DictationPanel';
import DictationPicker from '../components/DictationPicker';
import { recordVocabEncounters } from '../components/world/vocabEncounters';
import { syncVocabEncounters } from '../components/world/vocabEncounterSync';
import { encounterLookupLang, loadMetWordKeys, loadRefVocabLookup } from '../lib/refVocabLookup';
import { normalizeRefWordKey } from '../lib/refWordNormalize';
import { isWordToken, wordStateOf, wordStateExtraClass } from '../lib/wordState';
import { TTS_RATES, ttsOptsFor, pronHiddenFor, pronRevealAvailable, shouldRevealPron, READING_PRESETS, PRESET_META, presetActive } from '../lib/readingSheet';
import { getBook } from '../lib/bookMeta';
import { getJaRef, formatJaRef, getJaWarn } from '../lib/jaRef';
import TokenEditPanel from './TokenEditPanel';
import SourceEditModal from './SourceEditModal';
import TokenPosLabel from './TokenPosLabel';
import TokenRangeGrips from './TokenRangeGrips';
import ViewerComments from './ViewerComments';
import ViewerQuizModal from './ViewerQuizModal';
import { langNameKo } from '../lib/constants';
import { attributionParts } from '../lib/videoAttribution';

// 공부 모드 지원 언어 키 — REF_LANGS를 직접 import하면 교재 콘텐츠 전체가 클라 번들에 딸려 온다(1.8MB).
// 실사용은 '이 자료 언어로 세션 생성 가능한가' 멤버십 체크 1곳뿐이라 정적 키 집합으로 대체한다.
// 키는 REF_LANGS와 반드시 일치(user_vocabulary.language·/study 규약).
const STUDY_LANGS = new Set(['Japanese', 'English', 'French', 'Chinese']);

/**
 * 자료 조회 — 온라인이면 네트워크가 정본(계약 6)이고, 성공분은 오프라인용으로
 * 남긴다(사용자 조작 0 — 뷰어에 들어온 것 자체가 '이 자료를 읽는다'는 신호).
 * 네트워크가 죽었을 때만 캐시로 폴백한다: 지하철·비행기에서 읽던 자료가 이어진다(v2-N R1).
 * NOT_FOUND(자료가 실제로 없음)는 폴백하지 않는다 — 삭제된 자료가 캐시로 되살아나면
 * 그것이야말로 스테일이다.
 */
async function fetchMaterial(id) {
  try {
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
    // fire-and-forget이되 완전 격리 — 캐시 실패가 아래 catch로 새면 네트워크
    // 성공분이 캐시 폴백으로 빠진다(계약 4·6 동시 위반).
    Promise.resolve().then(() => cacheMaterial(data)).catch(() => {});
    return data;
  } catch (err) {
    if (err?.code === 'NOT_FOUND') throw err;
    const cached = await getCachedMaterial(id);
    if (!cached) throw err;   // 캐시가 없으면 기존 에러 화면 그대로(계약 5)
    return { ...cached, __offline: true };
  }
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

async function upsertViewerVocabulary(row, options = VOCAB_UPSERT) {
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
          wordStateHl, setWordStateHl,
          showPatterns, setShowPatterns, patternFilter, setPatternFilter,
          focusMode, setFocusMode,
          autoPace, setAutoPace, paceCpm, setPaceCpm, paceStep, setPaceStep,
          theme, setTheme, fontFamily, setFontFamily, pronDisplay, setPronDisplay,
          pronReveal, setPronReveal,
          autoSpeakOnClick, setAutoSpeakOnClick, ttsRate, setTtsRate,
          settingsOpen, setSettingsOpen } = settings;

  // 읽기 모드 프리셋(오너 확정 2026-08-27) — 표시 키만 대입, 조판은 불가침(readingSheet 계약).
  // v1-4 R1에서 pronReveal이 합류했다 — 프리셋은 '표시 의도'를 통째로 정하므로 새 키도
  // 반드시 대입한다(빠뜨리면 카드 불은 켜졌는데 실제 상태는 다른 유령 활성이 생긴다).
  const applyPreset = (name) => {
    const p = READING_PRESETS[name];
    if (!p) return;
    setPronDisplay(p.pronDisplay);
    setWordStateHl(p.wordStateHl);
    setFocusMode(p.focusMode);
    setShowToneColors(p.showToneColors);
    setPronReveal(p.pronReveal);
  };
  // 탭 시트(B안 — 오너 전환 지시 2026-08-28): 글자/표시/도구. 상태는 페이지 방문 동안만
  // 유지(마지막 탭 기억) — 영속 pref로 만들 만큼의 무게는 아니다.
  const [sheetTab, setSheetTab] = useState('type');

  const quiz = useViewerQuiz();
  const { quizState, completionModal, setCompletionModal, generateQuiz,
          handleQuizAnswer, advanceQuiz, finishQuiz } = quiz;

  const [selectedToken, setSelectedToken] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  // ④ 글자 탐색 — 카드의 큰 단어에서 탭한 한자({ ch, key, reading }). 단어가 바뀌면 리셋.
  const [inspectChar, setInspectChar] = useState(null);
  // 발음을 공개한 토큰(v1-4 R1). **세션 로컬 Set 하나** — localStorage·DB 어디에도 쓰지
  // 않는다. 자료를 나가면 리셋되는 것이 맞다: 다음에 또 인출 연습이 돼야 한다(설계 §4).
  const [revealedPron, setRevealedPron] = useState(() => new Set());
  // 자료를 옮기면 공개를 접는다. 앱 라우터는 /viewer/[id] 사이 이동에서 이 컴포넌트를
  // 다시 마운트하지 않으므로, 지우지 않으면 지난 자료의 공개가 tokenId가 겹치는 만큼
  // 새 자료에 비친다. (빈 Set일 땐 그대로 둔다 — 첫 렌더에 헛 리렌더를 만들지 않는다.)
  useEffect(() => { setRevealedPron((prev) => (prev.size ? new Set() : prev)); }, [id]);
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
  // [더 쉽게] (#1077-3) — 지정 문장을 같은 언어의 쉬운 말로. 같은 패널·같은 결.
  const easier = useEasierText({ materialLang, toast });
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
  const nextRangeMutation = usePdfRangeMutation({ material, sourcePdf, user, toast });

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

  // 유창성 측정(v2-I R1a) — 카드·시트가 열려 있는 동안은 멈춘다: 사전을 찾는 시간을
  // 빼지 않으면 "많이 찾아볼수록 느린 독자"가 되어 숫자가 학습을 왜곡한다(설계 §1).
  // 이번 읽기에서 페이서가 한 번이라도 문장을 넘겼나 — 완독 detail의 paced가 여기서 온다.
  // 페이서로 읽은 속도는 '내가 낸 속도'가 아니라 '내가 설정한 속도'라, 표식 없이 섞이면
  // 유창성 지표가 자기 설정값을 되비추는 거울이 된다(설계 §8).
  const pacedRef = useRef(false);

  const readingTimer = useReadingTimer({
    enabled: !!user && !!material,
    paused: isSheetOpen || !!selectedToken,
  });

  const markCompleteMutation = useReadingCompletion({
    materialId: id, user, profile, fetchProfile,
    material, generateQuiz,
    toast,
    // 완독 순간의 순수 읽기 시간·글자수 — 기록 여부 판정은 훅이 한다.
    readingMetricInput: () => ({
      ms: readingTimer.readMs(),
      chars: countReadableChars(material?.raw_text),
      paced: pacedRef.current,
    }),
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

  // '이미 앎' 표기(목업 ⑤ — #1077-14): 이 언어의 표기 집합. 실패는 빈 셋(버튼만 비활성 결).
  const knownLangCode = knownWordsLang(materialLang);
  const { data: knownWordSet } = useQuery({
    queryKey: ['known-words', user?.id, knownLangCode],
    queryFn: async () => {
      const rows = await fetchKnownWords(user.id, knownLangCode);
      return new Set(rows.map((r) => r.word_text));
    },
    enabled: !!user && !!knownLangCode,
    staleTime: 1000 * 60,
  });
  const knownToggleMutation = useMutation({
    mutationFn: async ({ wordText, known }) => {
      if (known) await unmarkKnown(user.id, knownLangCode, wordText);
      else await markKnown(user.id, knownLangCode, wordText);
      return !known;
    },
    onSuccess: (nowKnown) => {
      queryClient.invalidateQueries({ queryKey: ['known-words', user?.id, knownLangCode] });
      queryClient.invalidateQueries({ queryKey: ['known-words-all', user?.id] });
      if (nowKnown) toast('이미 아는 말로 표시했어요 — 새 단어 셈에서 빠져요', 'success');
    },
    onError: () => toast('잠시 후 다시 시도해 주세요.', 'warning'),
  });

  // 스크롤 위치 저장(debounce 2s) + 재진입 시 자동 복원
  const { saveScrollPosition, tokenRefs } = useScrollRestore({ user, materialId: id, material, readingProgress });

  // 단어 저장 카운트 (복습 유도용)
  const saveCountRef = useRef(0);

  const handleTokenClick = (token, tokenId, opts = {}) => {
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
    // 「가려진 것만 한 번 더」(v1-4 R1) — 탭은 그 자리에서 가장 덜 아는 것을 연다.
    // 순서가 계약이다: ① 집중 모드 문장 밖 = 이동(위에서 이미 return) → ② 발음이
    // 가려져 있으면 공개 → ③ 그 외 카드 시트. 가려지지 않은 단어는 지금과 완전히 같다.
    // 공개는 화면 클래스 한 겹만 벗긴다 — review_events·user_vocabulary에 아무것도 쓰지
    // 않는다. '탭해서 봤다 = 모른다'는 신호가 약해(궁금해서·확인차·오탭) FSRS에 흘리면
    // 복습 전체가 흔들린다(설계 §4).
    if (shouldRevealPron(pronReveal, pronDisplay, { hidden: opts.pronHidden, revealed: opts.pronRevealed })) {
      setRevealedPron((prev) => new Set(prev).add(tokenId));
      return;
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
      speak(t.text, materialLang, ttsOptsFor(ttsRate));
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

  // 문맥 설명 R1(오너 승인 — 버튼형+suspect): 탭 단어의 "이 문장에서" 설명. 카드 즉답을
  // 막지 않는 지연 로드 — [이 문장에서는?]을 눌렀을 때만 /api/explain token 분기 호출.
  // 늦게 온 응답이 다른 단어 카드에 붙지 않게 시퀀스 가드(synAnt와 동일 원칙).
  const [ctxExplain, setCtxExplain] = useState(null); // { loading?, text?, error? }
  const ctxExplainSeq = useRef(0);
  useEffect(() => { ctxExplainSeq.current += 1; setCtxExplain(null); }, [selectedToken?.id, selectedToken?.text]);
  const ctxSentenceOf = (tok) => {
    // 본문 탭 토큰의 id(id_<rawIdx>_…)에서 원문 줄을 되찾는다 — 리스트·칩 경유(무id)는 대상 밖
    const m = typeof tok?.id === 'string' ? tok.id.match(/^(?:id|failed)_(\d+)_/) : null;
    const line = m ? sentences.find((s) => s.rawIdx === parseInt(m[1], 10)) : null;
    return line?.text || null;
  };
  const runCtxExplain = async (tok, sentence) => {
    const seq = ++ctxExplainSeq.current;
    setCtxExplain({ loading: true });
    try {
      const text = await fetchCtxExplain({
        language: materialLang, sentence, token: tok, materialId: id, tokenKey: tok.id,
      });
      if (ctxExplainSeq.current === seq) setCtxExplain(text ? { text } : { error: true });
    } catch {
      if (ctxExplainSeq.current === seq) setCtxExplain({ error: true });
    }
  };

  // 이합사 시각 연동(R4b 오너 확정 2026-08-30: 연동 띠 + 각괘선 아치 — 카드 문구는 A안
  // 현행 유지): zh에서 이합사 조각(base_form 2자 ≠ 표면)을 탭하면, 같은 줄의 파트너
  // 글자에 옅은 띠(word-token--sep-linked)를 켜고 조각 상단→파트너 상단으로 각괘선
  // (수직→수평→수직, 높이 7px)을 한 번만 그린다. 표면·조판 불변 — 밴드 계약(0.58em
  // 산식)의 잉크 상단 좌표만 읽는다. 리사이즈로 낡은 아치는 다음 탭에서 다시 그려진다.
  const sepArcRef = useRef(null);
  const [sepLink, setSepLink] = useState(null); // { partnerIds: string[] }
  useEffect(() => {
    const svg = sepArcRef.current;
    if (svg) svg.innerHTML = '';
    const tok = selectedToken;
    const base = tok?.base_form;
    if (materialLang !== 'Chinese' || !tok?.id || !base || base === tok.text || [...base].length !== 2) {
      setSepLink(null);
      return;
    }
    const partner = [...base].find((ch) => !tok.text.includes(ch));
    const m = typeof tok.id === 'string' ? tok.id.match(/^(?:id|failed)_(\d+)_/) : null;
    if (!partner || !m) { setSepLink(null); return; }
    const linePrefix = new RegExp(`^(?:id|failed)_${m[1]}_`);
    const partnerIds = Object.entries(tokenRefs.current)
      .filter(([tid, el]) => el && el.isConnected && tid !== tok.id && linePrefix.test(tid) && el.dataset.text === partner)
      .map(([tid]) => tid);
    setSepLink(partnerIds.length ? { partnerIds } : null);
    const anchorEl = tokenRefs.current[tok.id];
    const partnerEl = tokenRefs.current[partnerIds[0]];
    const area = readerRef.current;
    if (!svg || !anchorEl || !partnerEl || !area || !partnerIds.length) return;
    const areaRect = area.getBoundingClientRect();
    const inkTop = (el) => {
      const s = el.querySelector('.surface');
      if (!s) return null;
      const r = s.getBoundingClientRect();
      const fs = parseFloat(getComputedStyle(s).fontSize) || 16;
      // 잉크 상단 = 밴드 상단(--hl-band-top = 0.58em) — 밴드 계약과 같은 좌표계
      return { x: r.left - areaRect.left + r.width / 2, y: r.top - areaRect.top + 0.58 * fs };
    };
    const a = inkTop(anchorEl);
    const b = inkTop(partnerEl);
    if (!a || !b) return;
    const top = Math.min(a.y, b.y) - 7; // 각괘선 높이 7px(오너 확정)
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${a.x} ${a.y} L ${a.x} ${top} L ${b.x} ${top} L ${b.x} ${b.y}`);
    svg.appendChild(path);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const len = path.getTotalLength();
      path.style.strokeDasharray = String(len);
      path.style.strokeDashoffset = String(len);
      path.style.transition = 'stroke-dashoffset 0.5s ease-out';
      requestAnimationFrame(() => requestAnimationFrame(() => { path.style.strokeDashoffset = '0'; }));
    }
  }, [selectedToken?.id, selectedToken?.text, selectedToken?.base_form, materialLang]);

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
  // 받아쓰기 패널(목업 ① — #1077-6): 지정 문장 대상, 열림 동안 원문 가림은 패널 몫
  // 받아쓰기 — 대상 문장 하나를 상태로 든다(지정 문장 🎧 · 추천 고르기 두 경로가 같은 패널로 모임).
  const [dictationSentence, setDictationSentence] = useState(null);
  const [dictationPickerOpen, setDictationPickerOpen] = useState(false);

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
      easier.reset();  // 다른 문장의 쉬운 말도 함께
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

  // 어휘 커버리지 배지(#1077-2) — 서재 카드와 **같은 엔진·같은 인덱스**(materialFit ←
  // 담김 ∪ '이미 앎'). 뷰어에서만 다른 수를 보이면 두 화면이 서로를 반증한다.
  // 표본 미달(FIT_MIN_TYPES)·게스트·미분석은 무표기(0% 오표기 금지 — fitBand와 같은 결).
  const coverage = useMemo(() => {
    if (!user || !material?.processed_json) return null;
    const knownRows = [...(knownWordSet || [])].map((word_text) => ({ word_text }));
    const index = knownRows.length ? mergeKnownIntoIndex(savedWords, knownRows) : savedWords;
    const fit = materialFit(material.processed_json, index);
    return fit.total >= FIT_MIN_TYPES ? fit : null;
  }, [user, material?.processed_json, savedWords, knownWordSet]);

  // 받아쓰기 추천용 담은 단어 집합 — 표기·기본형 합집합(엔진이 text.includes로 대조).
  const dictationSavedSet = useMemo(
    () => new Set([...(savedWords?.surfaces || []), ...(savedWords?.bases || [])]),
    [savedWords]
  );

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

  // 자동 진행(v2-I R1b) — 지정 문장에 체류하다 다음으로. 발동 조건이 곧 정지 조건이다:
  // 설정 켬 + 집중 모드 + 문장 지정. 빈 공간 탭으로 지정이 풀리면 셋 중 하나가 깨져
  // 진행도 함께 끝난다(설계 §5 — 별도 ▶/■ 버튼이 필요 없는 이유).
  // 목표 속도 자동 제안(R2) — I-a가 남긴 완독 측정에서 내 최근 속도를 읽어 +10%로 잡는다.
  // 페이서를 켠 사람에게만 조회한다: 안 쓰는 사람에게 쿼리를 태울 이유가 없다.
  const { data: paceHistoryRows } = useQuery({
    queryKey: ['reading-speed', user?.id, materialLang],
    queryFn: () => fetchReadingSpeedRows(user.id, materialLang),
    enabled: !!user && autoPace,
    staleTime: 1000 * 300,
  });
  const myCpm = recentCpm(paceHistoryRows || []);
  const suggestedCpm = suggestTargetCpm(paceHistoryRows || []);

  const pickedSentence = sentences.find((s2) => s2.rawIdx === pickedLineIdx) || null;
  const paceAvgChars = useMemo(() => (
    sentences.length
      ? sentences.reduce((n, s2) => n + countReadableChars(s2.text), 0) / sentences.length
      : null
  ), [sentences]);
  // 바탕값: 직접 고른 값이 언제나 이긴다. 안 골랐으면 내 이력에서 제안하고, 이력도
  // 모자라면 언어별 보수적 기본값으로 떨어진다(설계 §4).
  const paceBaseCpm = paceCpm || suggestedCpm || defaultTargetCpm(materialLang);
  // 여기에 훈련 사다리(1.05^step)를 곱한 것이 실제 목표다(설계 §9). 바탕과 사다리를
  // 분리해 두어야 "실력이 올라서"인지 "훈련을 밀어서"인지 구분된다.
  const paceTargetCpm = ladderTargetCpm(paceBaseCpm, paceStep) || paceBaseCpm;
  const paceArmed = autoPace && focusMode && pickedSentence !== null;
  const paceDwell = paceArmed
    ? dwellMs({ chars: countReadableChars(pickedSentence.text), targetCpm: paceTargetCpm })
    : null;
  // 카드·시트 열림 = 찾아보는 중 — 진행도 측정도 함께 멈춘다(I-a와 같은 신호).
  const paceHeld = isSheetOpen || !!selectedToken;

  useReadingPacer({
    enabled: paceArmed,
    dwell: paceDwell,
    paused: paceHeld,
    cursor: pickedLineIdx,
    onAdvance: () => {
      // 마지막 문장이면 자동 종료 — 넘길 곳이 없으면 paced 표식도 남기지 않는다.
      if (!adjacentSentence(sentences, pickedLineIdx, 1)) return;
      pacedRef.current = true;
      moveSentence(1);
    },
  });

  // 이해도 가드(v2-I R1b R3) — 사다리는 **읽기가 끝날 때가 아니라 이해도 증거가 올 때**
  // 움직인다. 완독 순간에는 이번 회차를 이해했는지 알 길이 없어서, 그때 올리면 가드가
  // 사후 통보가 된다. 페이서로 읽은 회차에만 적용한다: 자기 힘으로 읽은 회차의 이해도는
  // 훈련 강도와 무관하다.
  const handleReadingTestGraded = ({ score, total }) => {
    if (!pacedRef.current) return;
    const { step, verdict } = nextLadderStep(paceStep, comprehensionRatio({ score, total }));
    if (step !== paceStep) setPaceStep(step);
    if (verdict === 'up') toast(`이해도 확인 — 자동 진행을 ${ladderLabel(step)}로 올렸어요`, 'success');
    else if (verdict === 'down') toast('이해가 조금 떨어졌어요 — 자동 진행을 한 칸 낮췄어요', 'info');
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

  // 문법 표시(v2-G R1) — 정본 문형 인덱스는 토글이 켜질 때만 지연 로드(중국어 304KB·
  // 일본어 852문형). 기본 꺼짐인 기능 때문에 모든 독자가 그 값을 치를 이유가 없다.
  // 자료 언어가 바뀌면 인덱스도 갈아야 한다 — 안 갈면 중국어 커널로 일본어를 훑는다.
  const [patternIndex, setPatternIndex] = useState(null);
  const [patternIndexLang, setPatternIndexLang] = useState(null);
  useEffect(() => {
    if (!showPatterns || !supportsPatterns(materialLang) || patternIndexLang === materialLang) return undefined;
    let alive = true;
    loadPatternIndex(materialLang).then((ix) => {
      if (!alive) return;
      setPatternIndex(ix);
      setPatternIndexLang(materialLang);
    }).catch(() => {});
    return () => { alive = false; };
  }, [showPatterns, materialLang, patternIndexLang]);

  // 표지 스캔 — 본문이 바뀌거나 인덱스가 오면 한 번. 토큰 수 × 최대 4의 O(n)이라
  // 자료당 한 번 계산해 두면 렌더는 Map 조회뿐이다(설계 §5 성능 대응).
  const patternScan = useMemo(() => {
    const json = material?.processed_json;
    // 언어가 바뀐 직후 한 프레임 동안 옛 인덱스가 남는다 — 그때 스캔하면 남의 언어
    // 커널로 훑은 밑줄이 잠깐 깜빡인다.
    if (!showPatterns || !patternIndex || patternIndexLang !== materialLang || !json?.sequence) return null;
    const tokens = json.sequence.map((id) => ({ id, text: json.dictionary?.[id]?.text || '' }));
    return scanTokens(tokens, patternIndex);
  }, [showPatterns, patternIndex, patternIndexLang, materialLang, material?.processed_json]);

  // '복습할 것' 필터(v2-G R2) — 이미 쌓이고 있는 grammar_review 큐를 읽기만 한다.
  // 좁힐 때만 조회한다: 전체로 보는 사람에게 쿼리를 태울 이유가 없다(goal-known 결).
  const patternOn = showPatterns && supportsPatterns(materialLang);
  const patternDueOn = patternOn && patternFilter === 'due';
  const { data: dueRows, isPending: duePending } = useQuery({
    queryKey: ['pattern-due', user?.id, materialLang],
    queryFn: () => fetchDuePatternRows(user.id, materialLang),
    enabled: !!user && patternDueOn,
    staleTime: 1000 * 60,
  });
  // 조회에서 한 번 자르지만 순수 함수가 다시 자른다 — 뷰어는 오래 열려 있고,
  // 그 사이 예정 시각이 지난 행이 조용히 남으면 필터가 거짓말을 한다.
  const dueSlugs = useMemo(() => (patternDueOn ? dueChapterSet(dueRows || []) : null), [patternDueOn, dueRows]);

  // '약한 것'(v2-A 결합점) — 약점 정본은 v2-A가 갖고 여기서는 챕터 집합만 받아 쓴다.
  // 조회도 v2-A의 것을 그대로 재사용한다(주간 리포트 한 줄과 같은 재료 — 중복 신설 0).
  const patternWeakOn = patternOn && patternFilter === 'weak';
  const { data: weakRows, isPending: weakPending } = useQuery({
    queryKey: ['pattern-weak', user?.id],
    queryFn: () => fetchWeaknessRows(user.id),
    enabled: !!user && patternWeakOn,
    staleTime: 1000 * 60,
  });
  const weakSlugs = useMemo(
    () => (patternWeakOn ? weakChapterSet(weakRows || []) : null),
    [patternWeakOn, weakRows],
  );

  // 인덱스가 아니라 산출을 거른다 — 인덱스는 자료 사이에서 공유·캐시되는 물건이다.
  const visibleScan = useMemo(
    () => filterScan(patternScan, { mode: patternFilter, dueSlugs, weakSlugs }),
    [patternScan, patternFilter, dueSlugs, weakSlugs],
  );
  // 밑줄이 하나도 없는 화면은 "필터가 걸렸다"가 아니라 "고장"으로 읽힌다(v2-K 빈 상태).
  const patternNote = filterNote({
    mode: patternOn ? patternFilter : 'all',
    signedIn: !!user,
    loading: !!user && (patternDueOn ? duePending : weakPending),
    markedCount: (patternDueOn ? dueSlugs?.size : weakSlugs?.size) || 0,
    hitCount: visibleScan?.hits.length || 0,
  });

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
  // 자원 테이블(증강 R2·R3 — 획수·부수·1단 분해·간번체, 563KB)과 구성 풀이 스토리
  // (R4 — 최빈 시드 저작분)는 글자 카드가 실제로 열릴 때만 지연 로드 — 한자 대조
  // 토글만으로는 안 부른다(단어 줄엔 자원이 안 쓰인다).
  const [hanjaEtymTable, setHanjaEtymTable] = useState(null);
  const [hanjaStoryTable, setHanjaStoryTable] = useState(null);
  useEffect(() => {
    if (inspectChar === null || hanjaEtymTable) return undefined;
    let alive = true;
    import('../lib/data/hanjaEtym.json')
      .then((m) => { if (alive) setHanjaEtymTable(m.default || m); })
      .catch(() => {});
    import('../lib/data/hanjaStory.json')
      .then((m) => { if (alive) setHanjaStoryTable(m.default || m); })
      .catch(() => {});
    return () => { alive = false; };
  }, [inspectChar, hanjaEtymTable]);
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
      await upsertViewerVocabulary(buildVocabRow({
        userId: user.id,
        surface: token.text,
        base: token.base_form,
        meaning: token.meaning,
        pos: token.pos,
        reading: token.furigana || token.reading,   // 영어는 IPA, 중국어는 병음
        language: materialLang,
      }));
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
      // 저장 규약(기본형 우선·출처 동봉)은 정본 조립기가 책임진다 — 저장 경로가 11개라
      // 자리마다 손으로 적으면 갈린다(실측: pdf·quick이 surface를 넣어 행이 둘로 갈렸다).
      const row = buildVocabRow({
        userId: user.id,
        surface: selectedToken.text,
        base: selectedToken.base_form,          // kuromoji 경로에서 전달됨
        meaning: selectedToken.meaning,
        pos: selectedToken.pos,
        reading: selectedToken.furigana || selectedToken.reading,
        language: materialLang,
        sourceSentence,
        sourceMaterialId: id,
      });

      await upsertViewerVocabulary([row], VOCAB_UPSERT);
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
          <button onClick={() => speak(selectedToken.text, materialLang, ttsOptsFor(ttsRate))} aria-label="발음 듣기" style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', minWidth: 32, minHeight: 32 }} title="발음 듣기">▷</button>
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
        // ④ 글자 카드(증강 R1~R3 — 오너 승인 2026-08-28): 헤더는 자기 완결(훈음·병음·자형 칩),
        // 주인공은 구성(1단 분해 — 성분 탭 = 재귀 탐색)과 다시 만나기(이 자료·내 단어).
        // 부수는 설명하지 않는다 — 성분 배지 + 메타 한 줄이 전부(설계 확정).
        const d = charDetail(inspectChar.ch, { koTable: hanjaKoTable, hunTable: hanjaHunTable, jaTable: hanjaJaTable }) || {};
        const etym = charEtym(inspectChar.ch, hanjaEtymTable, { koTable: hanjaKoTable, hunTable: hanjaHunTable, jaTable: hanjaJaTable });
        // ④ 자형 칩 탭 이동(R5 — 오너 확정 "④ 포함"): 日·繁·简·正 어느 자형이든 탭하면
        // 그 자형의 카드로 — 신자체처럼 훈이 '음만'인 글자도 정자 카드로 건너가 온전한
        // 훈음·분해를 본다. 성분 칩의 재귀 탐색과 같은 동작 언어.
        const formChip = (label, chars, langTag) => chars.length > 0 && (
          <span className="char-inspect__ja">
            {label}{' '}
            {chars.map((f) => (
              <button
                key={f}
                className="char-inspect__form"
                lang={langTag}
                title={`${f} 글자 보기`}
                onClick={() => setInspectChar({ ch: f, key: `form_${f}`, reading: null })}
              >{f}</button>
            ))}
          </span>
        );
        const inBook = materialWordsWithChar(inspectChar.ch, material?.processed_json, { excludeText: selectedToken.text });
        const related = wordsWithChar(inspectChar.ch, [...(savedWords.byKey?.values() || [])], { language: materialLang, excludeText: selectedToken.text });
        return (
          <div className="char-inspect">
            <div className="char-inspect__row">
              <span className="char-inspect__ch" lang={contentLangTag}>{inspectChar.ch}</span>
              {inspectChar.reading && (
                <span className={['pinyin-text', showToneColors ? pinyinToneClass(inspectChar.reading) : ''].filter(Boolean).join(' ')}>{inspectChar.reading}</span>
              )}
              {(d.hunEum || d.eum) && <span className="char-inspect__hun">{d.hunEum || `음 ${d.eum}`}</span>}
              {formChip('日', [...new Set([d.ja, etym?.jaOfTrad].filter(Boolean))], 'ja')}
              {formChip('繁', etym?.trad || [], 'zh-Hant')}
              {formChip('简', etym?.simp || [], 'zh-Hans')}
              {formChip('正', etym?.kyu || [], contentLangTag)}
              {!hanjaKoTable && <span className="char-inspect__loading">옥편 로딩…</span>}
            </div>
            {etym?.comps.length > 0 && (
              <div className="char-inspect__comps">
                <span className="char-inspect__words-label">구성</span>
                {etym.comps.map((c, i) => (
                  <span key={`${c.ch}_${i}`} className="char-inspect__comp-slot">
                    {i > 0 && <span className="char-inspect__plus">+</span>}
                    <button
                      className="char-inspect__comp"
                      lang={contentLangTag}
                      title={`${c.ch} 글자 보기`}
                      onClick={() => setInspectChar({ ch: c.ch, key: `comp_${c.ch}`, reading: null })}
                    >
                      <b>{c.ch}</b>
                      {c.label && <span>{c.label}</span>}
                      {c.isRadical && <i className="char-inspect__badge">부수</i>}
                    </button>
                  </span>
                ))}
              </div>
            )}
            {/* 구성 풀이 스토리(R4) — 시드 저작분에만, 미등재는 조용히 생략 */}
            {hanjaStoryTable?.[inspectChar.ch] && (
              <div className="char-inspect__story">{hanjaStoryTable[inspectChar.ch]}</div>
            )}
            {(inBook.length > 0 || related.length > 0) && (
              <div className="char-inspect__group">다시 만나기</div>
            )}
            {inBook.length > 0 && (
              <div className="char-inspect__words">
                <span className="char-inspect__words-label">이 자료</span>
                {inBook.map((t, i) => (
                  <button
                    key={`${t.text}_${i}`}
                    className="char-inspect__word"
                    lang={contentLangTag}
                    onClick={() => handleListWordClick({ text: t.text, base_form: t.base_form || t.text, meaning: t.meaning, furigana: t.furigana, pos: t.pos })}
                  >{t.text}</button>
                ))}
              </div>
            )}
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
            {etym && (etym.strokes > 0 || etym.radical) && (
              <div className="char-inspect__meta">
                {etym.strokes > 0 ? `${etym.strokes}획` : ''}
                {etym.strokes > 0 && etym.radical ? ' · ' : ''}
                {etym.radical ? `부수 ${etym.radical}${etym.radicalHun ? ` ${etym.radicalHun}` : ''}` : ''}
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
        <div style={{ fontSize: '0.76rem', color: 'var(--accent-text)', marginBottom: 12 }}>
          한자 · {refVocab.word.hanja}
        </div>
      )}

      {/* 문형 카드(v2-G R1) — 탭한 단어가 표지일 때만. 챕터 → 자료 역방향을 여는 자리라
          단어 카드 안에 얹는다(새 상호작용을 만들면 단어 탭과 경합한다). */}
      {selectedToken?.id && visibleScan?.byToken.get(selectedToken.id) && (
        <PatternCard hit={visibleScan.byToken.get(selectedToken.id)} dueSlugs={dueSlugs} weakSlugs={weakSlugs} />
      )}

      {/* 문맥 설명 R1 — zh부터(프롬프트 검증 언어), 본문 탭 토큰만(문장 유도 가능할 때).
          즉답 카드는 그대로, 설명은 버튼을 눌러야 온다(스킴 탭 헛호출 0). */}
      {materialLang === 'Chinese' && (() => {
        const ctxSentence = ctxSentenceOf(selectedToken);
        if (!ctxSentence) return null;
        if (ctxExplain?.loading) {
          return <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>문장 속 쓰임을 읽는 중...</div>;
        }
        if (ctxExplain?.text) {
          return (
            <div style={{ fontSize: '0.84rem', lineHeight: 1.55, marginBottom: 12 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>이 문장에서</div>
              <div style={{ color: 'var(--text-secondary)' }}>{ctxExplain.text}</div>
            </div>
          );
        }
        return (
          <button
            onClick={() => runCtxExplain(selectedToken, ctxSentence)}
            className="btn btn--ghost btn--sm"
            style={{ width: '100%', marginBottom: 12 }}
          >
            {ctxExplain?.error ? '이 문장에서는? (다시 시도)' : '이 문장에서는?'}
          </button>
        );
      })()}

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
        <div style={{ padding: '10px 12px', background: 'color-mix(in srgb, var(--warning) 10%, transparent)', borderRadius: 'var(--radius-md)', marginBottom: 12, border: '1px solid var(--warning)' }}>
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
      {/* '이미 알아요'(목업 ⑤) — 담을 필요 없는 아는 말 표시. 저장된 단어에는 무의미라 숨김. */}
      {user && knownLangCode && !isWordSaved && (() => {
        const isKnown = knownWordSet?.has(selectedToken.text)
          || (selectedToken.base_form && knownWordSet?.has(selectedToken.base_form));
        return (
          <button
            type="button"
            onClick={() => knownToggleMutation.mutate({ wordText: selectedToken.text, known: !!isKnown })}
            disabled={knownToggleMutation.isPending}
            className="btn btn--ghost btn--sm"
            style={{ width: '100%', marginTop: 6, color: 'var(--text-muted)' }}
          >
            {isKnown ? '👌 아는 말로 표시됨 — 취소' : '👌 이미 알아요'}
          </button>
        );
      })()}
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
              onClick={() => speak(leftPanelText, materialLang, ttsOptsFor(ttsRate))}
              aria-label="지정한 문장 듣기"
              title="지정한 문장 듣기"
              style={{ background: 'none', border: 'none', fontSize: '1.05rem', cursor: 'pointer', minWidth: 32, minHeight: 32, flexShrink: 0, color: 'var(--primary-light)' }}
            >▷</button>
          )}
          {ttsSupported && (
            <button
              onClick={() => setDictationSentence(leftPanelText)}
              aria-label="이 문장 받아쓰기"
              title="이 문장 받아쓰기 — 듣고 입력하면 글자 단위로 채점해요"
              style={{ background: 'none', border: 'none', fontSize: '1rem', cursor: 'pointer', minWidth: 32, minHeight: 32, flexShrink: 0 }}
            >🎧</button>
          )}
        </div>
      )}
      <div className="pdf-context__text" dangerouslySetInnerHTML={{ __html: formatDetail(leftPanelResult) }} />

      {/* [더 쉽게] (#1077-3) — 번역을 보기 전 원어 안의 한 계단. 결과는 원어 문장이라
          본문과 같은 :lang() 폰트 규칙을 태운다. */}
      {!easier.open ? (
        <button
          className="grammar-btn grammar-detail__toggle"
          onClick={() => easier.run(leftPanelText)}
          disabled={!leftPanelText}
        >🔤 더 쉽게 ▾</button>
      ) : (
        <div className="grammar-detail">
          {easier.loading ? (
            <div className="grammar-detail__loading">쉬운 문장 생성 중…</div>
          ) : (
            <div className="pdf-context__text" lang={contentLangTag} dangerouslySetInnerHTML={{ __html: formatDetail(easier.result) }} />
          )}
        </div>
      )}

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
        {coverage && (
          <div
            style={{
              padding: '4px 10px', borderRadius: 'var(--radius-full)',
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 600,
            }}
            title="담은 단어와 '이미 알아요' 표시를 합쳐 센 값 — 서재 맞춤도와 같은 계산이에요"
          >
            아는 단어 {Math.round(coverage.coverage * 100)}% · 새 단어 {coverage.unknown}개
          </div>
        )}
      </header>

      {/* 출처 표기(v2-F R5) — CC BY는 **표기가 라이선스 조건**이다. `metadata.source`가
          저장만 되고 어디에도 안 보이던 것을 여기서 드러낸다(저장은 표기가 아니다).
          라이선스를 모르는 개인 반입분에도 채널·원본 링크는 준다 — 어차피 필요한 정보다. */}
      {(() => {
        const at = attributionParts(material?.metadata?.source);
        if (!at) return null;
        return (
          <p className="viewer-attribution">
            출처: {at.channel || '유튜브'}
            {at.license && <> · <span className="viewer-attribution__license">{at.license}</span></>}
            {at.url && <> · <a href={at.url} target="_blank" rel="noopener noreferrer">원본 보기</a></>}
          </p>
        );
      })()}

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
            {/* 역방향 다리(v2-H R2) — "이 대목 원문이 어떻게 생겼더라"에서 다시 막히지
                않게. 돌아갈 자리는 자료 행이 이미 알고 있다(page_start). */}
            <Link href={pdfViewerHref(sourcePdf.id, material.page_start)} className="pdf-origin__back">
              원본 PDF 보기 →
            </Link>
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

      {/* 읽기 설정 액션바 — 리뉴얼(오너 확정 2026-08-27, 시연 A안+프리셋 줄): 설정 카드는
          Aa 버튼 + 하단 시트로 대체하고, 설정이 아닌 것(읽기 완료·학습 링크·분석 중단)만 남긴다. */}
      <div className="viewer-actionbar">
        {user?.id === material?.owner_id && reanalyzeMutation.isPending && (
          <button onClick={stopReanalysis} className="grammar-btn grammar-btn--danger">
            분석 중단
          </button>
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

        <button className="viewer-aa" aria-label="읽기 설정" aria-haspopup="dialog" onClick={() => setSettingsOpen(true)}>
          Aa
        </button>
      </div>

      {/* 읽기 설정 시트 — backdrop 무광(본문이 곧 미리보기 — 어둡게 덮지 않는다, 시연 합의).
          행 문법 통일: [2자 라벨][컨트롤]. 프리셋 줄이 최상단(표시 4키만 대입, 조판 불가침). */}
      {settingsOpen && (
        <>
          <div className="rsheet-backdrop" onClick={() => setSettingsOpen(false)} />
          <div className="rsheet" role="dialog" aria-label="읽기 설정">
            <button className="rsheet__grab" aria-label="설정 닫기" onClick={() => setSettingsOpen(false)}><i /></button>
            <div className="rsheet__body">
              <div className="rsheet__sec">읽기 모드</div>
              <div className="rsheet-presets">
                {PRESET_META.map(m => (
                  <button
                    key={m.key}
                    className={`rsheet-pcard${presetActive(m.key, settings) ? ' rsheet-pcard--on' : ''}`}
                    aria-pressed={presetActive(m.key, settings)}
                    onClick={() => applyPreset(m.key)}
                  >
                    <i>{m.icon}</i><b>{m.name}</b><span>{m.desc}</span>
                  </button>
                ))}
              </div>

              {/* 탭 3분할(B안 — 오너 전환 지시 2026-08-28): 프리셋 줄은 탭 무관 상단 고정.
                  탭명이 '글자'이므로 크기 행 라벨은 '크기'(중복 해소 — 오너 문구 지시). */}
              <div className="rsheet-tabs" role="tablist" aria-label="설정 분류">
                <button role="tab" aria-selected={sheetTab === 'type'}
                  className={sheetTab === 'type' ? 'rsheet-tabs__btn--on' : undefined}
                  onClick={() => setSheetTab('type')}>글자</button>
                <button role="tab" aria-selected={sheetTab === 'display'}
                  className={sheetTab === 'display' ? 'rsheet-tabs__btn--on' : undefined}
                  onClick={() => setSheetTab('display')}>표시</button>
                {((ttsSupported && sentences.length > 0) || (user?.id === material?.owner_id && !isAnalyzing && !reanalyzeMutation.isPending)) && (
                  <button role="tab" aria-selected={sheetTab === 'tools'}
                    className={sheetTab === 'tools' ? 'rsheet-tabs__btn--on' : undefined}
                    onClick={() => setSheetTab('tools')}>도구</button>
                )}
              </div>

              {sheetTab === 'type' && (
                <div className="rsheet-tabpane" role="tabpanel" aria-label="글자">
                  <div className="rsheet-row">
                    <span className="rsheet-row__lab">크기</span>
                    <input type="range" min="0.8" max="3" step="0.05" value={fontSize} aria-label="글자 크기"
                      onChange={e => setFontSize(parseFloat(e.target.value))} />
                  </div>
                  <div className="rsheet-row">
                    <span className="rsheet-row__lab">배경</span>
                    <span className="rsheet-swatches">
                      {[['light', '밝은 배경'], ['sepia', '세피아 배경'], ['dark', '어두운 배경']].map(([t, label]) => (
                        <button key={t} onClick={() => setTheme(t)} aria-label={label} aria-pressed={theme === t}
                          className={`rsheet-sw rsheet-sw--${t}${theme === t ? ' rsheet-sw--on' : ''}`} />
                      ))}
                    </span>
                  </div>
                  <div className="rsheet-row">
                    <span className="rsheet-row__lab">폰트</span>
                    <div className="rsheet-fonts">
                      {[["'Noto Sans KR'", '본고딕'], ["'Nanum Myeongjo'", '명조'], ['monospace', '고정폭'], ["'Inter'", 'Inter']].map(([value, name]) => (
                        <button key={value} onClick={() => setFontFamily(value)} aria-pressed={fontFamily === value}
                          className={`rsheet-fcard${fontFamily === value ? ' rsheet-fcard--on' : ''}`}>
                          <b style={{ fontFamily: value }}>{(materialLang === 'Chinese' ? '你' : materialLang === 'Japanese' ? 'あ' : '') + 'Aa'}</b>
                          <span>{name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rsheet-row">
                    <span className="rsheet-row__lab">행간</span>
                    <input type="range" min="10" max="60" value={lineGap} aria-label="행간"
                      onChange={e => setLineGap(parseInt(e.target.value))} />
                  </div>
                  <div className="rsheet-row">
                    <span className="rsheet-row__lab">자간</span>
                    <input type="range" min="0" max="1" step="0.05" value={charGap} aria-label="자간"
                      onChange={e => setCharGap(parseFloat(e.target.value))} />
                  </div>
                </div>
              )}

              {sheetTab === 'display' && (
                <div className="rsheet-tabpane" role="tabpanel" aria-label="표시">
                  <div className="rsheet-segrow">
                    <span className="rsheet-txt"><b>발음 표기</b><span>모르는 단어만 = 아는 단어·담은 단어는 가려요</span></span>
                    <div className="rsheet-miniseg" role="group" aria-label="발음 표기">
                      {[['all', '전체'], ['unknown', '모르는 단어만'], ['none', '없음']].map(([v, label]) => (
                        <button key={v} aria-pressed={pronDisplay === v}
                          className={pronDisplay === v ? 'rsheet-miniseg--on' : undefined}
                          onClick={() => setPronDisplay(v)}>{label}</button>
                      ))}
                    </div>
                  </div>
                  {/* 탭하면 발음 보기(v1-4 R1) — 발음 표기의 **종속** 스위치라 바로 아래 들여쓴다.
                      직교 축이 아니라 3단의 딸림 항목이므로 세그먼트 4번째 값으로 만들지 않는다.
                      「전체」에는 가릴 게 없어 흐린다 — 흐림 판정과 동작 판정이 같은 함수를
                      쓴다(갈리면 "흐린데 눌리는" 스위치가 생긴다). */}
                  <label className={`rsheet-swrow rsheet-swrow--sub${pronRevealAvailable(pronDisplay) ? '' : ' rsheet-swrow--off'}`}>
                    <span className="rsheet-txt"><b>탭하면 발음 보기</b><span>가려진 단어를 한 번 탭하면 발음이 드러나고, 한 번 더 탭하면 뜻 카드가 열려요</span></span>
                    <span className="rsheet-switch"><input type="checkbox" checked={pronReveal} disabled={!pronRevealAvailable(pronDisplay)} onChange={() => setPronReveal(v => !v)} /><span className="rsheet-knob" /></span>
                  </label>
                  <label className="rsheet-swrow">
                    <span className="rsheet-txt"><b>단어 상태</b><span>아는 정도를 색으로</span></span>
                    <span className="rsheet-switch"><input type="checkbox" checked={wordStateHl} onChange={() => setWordStateHl(v => !v)} /><span className="rsheet-knob" /></span>
                  </label>
                  <label className="rsheet-swrow">
                    <span className="rsheet-txt"><b>집중 모드</b><span>지정한 문장만 밝게</span></span>
                    <span className="rsheet-switch"><input type="checkbox" checked={focusMode} onChange={() => setFocusMode(v => !v)} /><span className="rsheet-knob" /></span>
                  </label>
                  {/* 자동 진행(v2-I R1b) — 집중 모드 바로 아래. 전제가 집중 모드라 붙여 둔다.
                      발동은 '문장 지정', 정지는 '빈 공간 탭' — 새 버튼을 만들지 않는다(설계 §5). */}
                  <label className="rsheet-swrow">
                    <span className="rsheet-txt"><b>자동 진행</b><span>집중 모드에서 지정한 문장에 머물다 다음으로</span></span>
                    <span className="rsheet-switch"><input type="checkbox" checked={autoPace} onChange={() => setAutoPace(v => !v)} /><span className="rsheet-knob" /></span>
                  </label>
                  {autoPace && (
                    <div className="rsheet-subrow rsheet-subrow--pace">
                      <span className="rsheet-sublab">속도</span>
                      <div className="rsheet-pace" role="group" aria-label="자동 진행 속도">
                        {/* 직접 조절하면 사다리를 접는다 — 보이는 값을 그대로 바탕값으로
                            굳혀야 "내가 90으로 맞췄는데 왜 104로 도나"가 안 생긴다. */}
                        <button type="button" aria-label="느리게" onClick={() => { setPaceCpm(stepCpm(paceTargetCpm, -1)); setPaceStep(0); }}>− 느리게</button>
                        <b>{paceTargetCpm}자/분</b>
                        <button type="button" aria-label="빠르게" onClick={() => { setPaceCpm(stepCpm(paceTargetCpm, 1)); setPaceStep(0); }}>빠르게 +</button>
                      </div>
                      {/* 이 숫자가 어디서 왔는지 밝힌다 — 자동 제안이 조용히 바뀌면
                          "왜 어제와 다르지?"가 된다. 직접 고른 상태에서는 자동으로
                          되돌아갈 길을 남긴다(한 번 누르면 못 돌아오는 막다른 길 방지). */}
                      {paceCpm ? (
                        <span className="rsheet-pace__src">
                          직접 설정
                          <button type="button" onClick={() => setPaceCpm(null)}>자동으로</button>
                        </span>
                      ) : myCpm ? (
                        <span className="rsheet-pace__src">
                          내 속도 {myCpm}자/분 기준 +10%
                          {ladderLabel(paceStep) && <em>훈련 {ladderLabel(paceStep)}</em>}
                        </span>
                      ) : ladderLabel(paceStep) ? (
                        <span className="rsheet-pace__src"><em>훈련 {ladderLabel(paceStep)}</em></span>
                      ) : null}
                      {/* 조절은 자/분으로 하되 초를 병기한다 — 오너가 처음 말한 "몇 초 후"를
                          그대로 쓸 수 있게(설계 §7②). 숫자 카운트다운은 본문에 두지 않는다. */}
                      <span className="rsheet-pace__hint">
                        {(() => {
                          const h = paceHint({
                            chars: pickedSentence ? countReadableChars(pickedSentence.text) : null,
                            avgChars: paceAvgChars,
                            targetCpm: paceTargetCpm,
                          });
                          const parts = [];
                          if (h.thisSec != null) parts.push(`이 문장(${h.thisChars}자) ≈ ${h.thisSec}초`);
                          if (h.avgSec != null) parts.push(`평균 ≈ ${h.avgSec}초`);
                          return parts.join(' · ');
                        })()}
                      </span>
                    </div>
                  )}
                  {materialLang === 'Chinese' && (
                    <label className="rsheet-swrow">
                      <span className="rsheet-txt"><b>성조 색상</b><span>병음을 성조별 색으로</span></span>
                      <span className="rsheet-switch"><input type="checkbox" checked={showToneColors} onChange={() => setShowToneColors(v => !v)} /><span className="rsheet-knob" /></span>
                    </label>
                  )}
                  {materialLang === 'Chinese' && (
                    <label className="rsheet-swrow">
                      <span className="rsheet-txt"><b>한자 대조</b><span>단어 상세에 훈음 병기</span></span>
                      <span className="rsheet-switch"><input type="checkbox" checked={showHanjaKo} onChange={() => setShowHanjaKo(v => !v)} /><span className="rsheet-knob" /></span>
                    </label>
                  )}
                  {/* 문법 표시(v2-G R1·R3) — 정본 문형이 있는 언어에서만(중국어·일본어).
                      언어 무관 층위(발음 표기·단어 상태·집중 모드) 사이에 끼우면 층위가
                      갈리므로 성조·한자 대조와 같은 구획 끝에 둔다(focusMode 계약). */}
                  {supportsPatterns(materialLang) && (
                    <label className="rsheet-swrow">
                      <span className="rsheet-txt"><b>문법 표시</b><span>정본 문형의 표지에 옅은 밑줄 — 단어를 탭하면 문형과 챕터로</span></span>
                      <span className="rsheet-switch"><input type="checkbox" checked={showPatterns} onChange={() => setShowPatterns(v => !v)} /><span className="rsheet-knob" /></span>
                    </label>
                  )}
                  {/* 범위(v2-G R2) — 정본 484문형을 전부 후보로 잡으면 "무엇부터"가 안 정해진다.
                      '복습할 것'은 시간이 부르고(FSRS 큐), '약한 것'은 기록이 부른다(v2-A 약점
                      정본). 둘 다 집합만 받아 쓰므로 이 화면이 약점을 계산하지 않는다. */}
                  {supportsPatterns(materialLang) && showPatterns && (
                    <div className="rsheet-subrow rsheet-subrow--pattern">
                      <span className="rsheet-sublab">범위</span>
                      <div className="rsheet-miniseg" role="group" aria-label="문법 표시 범위">
                        <button type="button" aria-pressed={patternFilter === 'all'}
                          className={patternFilter === 'all' ? 'rsheet-miniseg--on' : undefined}
                          onClick={() => setPatternFilter('all')}>전체</button>
                        <button type="button" aria-pressed={patternFilter === 'due'}
                          className={patternFilter === 'due' ? 'rsheet-miniseg--on' : undefined}
                          onClick={() => setPatternFilter('due')}>복습할 것</button>
                        <button type="button" aria-pressed={patternFilter === 'weak'}
                          className={patternFilter === 'weak' ? 'rsheet-miniseg--on' : undefined}
                          onClick={() => setPatternFilter('weak')}>약한 것</button>
                      </div>
                      {patternNote && <span className="rsheet-pattern__note">{patternNote}</span>}
                    </div>
                  )}
                  {ttsSupported && (
                    <label className="rsheet-swrow">
                      <span className="rsheet-txt"><b>자동 발음</b><span>단어를 누르면 소리로</span></span>
                      <span className="rsheet-switch"><input type="checkbox" checked={autoSpeakOnClick} onChange={() => setAutoSpeakOnClick(v => !v)} /><span className="rsheet-knob" /></span>
                    </label>
                  )}
                  {ttsSupported && (
                    <div className="rsheet-subrow">
                      <span className="rsheet-sublab">속도</span>
                      <div className="rsheet-miniseg" role="group" aria-label="말하기 속도">
                        {Object.entries(TTS_RATES).map(([k, r]) => (
                          <button key={k} aria-pressed={ttsRate === k}
                            className={ttsRate === k ? 'rsheet-miniseg--on' : undefined}
                            onClick={() => setTtsRate(k)}>{r.label}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {sheetTab === 'tools' && (
                <div className="rsheet-tabpane" role="tabpanel" aria-label="도구">
                  {ttsSupported && sentences.length > 0 && (
                    <button className="rsheet-toolrow" onClick={() => { setSettingsOpen(false); setDictationPickerOpen(true); }}>
                      <span className="rsheet-txt"><b>받아쓰기</b><span>추천 문장을 듣고 받아쓰기</span></span>
                      <em>›</em>
                    </button>
                  )}
                  {user?.id === material?.owner_id && !isAnalyzing && !reanalyzeMutation.isPending && (
                    <button className="rsheet-toolrow" onClick={() => { setSettingsOpen(false); setReanalyzePanel('menu'); }}>
                      <span className="rsheet-txt"><b>재분석</b><span>전체·부분 분석, 원문 수정</span></span>
                      <em>›</em>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 재분석 패널 — position:fixed 중앙이라 설정 카드 해체 후에도 독립 배치(트리 위치 무관) */}
      {user?.id === material?.owner_id && reanalyzePanel && (
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

      {/* 네트워크가 죽어 캐시 사본으로 살아난 화면임을 알린다(v2-N R1) */}
      {material?.__offline && <OfflineNotice what="자료" />}

      {/* Reader Area — 인앱 토큰 범위 지정(드래그) 이벤트는 여기서 위임 수신 */}
      <div
        ref={readerRef}
        className={`card reader-area reader-area--${theme}${focusMode && (pickedLineIdx !== null || tokenRange.range) ? ' reader-area--focus' : ''}${wordStateHl ? ' reader-area--hl' : ''}${paceDwell ? ' reader-area--pacing' : ''}${paceDwell && paceHeld ? ' reader-area--pacing-hold' : ''}`}
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
          // 체류 표시는 CSS 애니메이션이 시간을 잰다 — JS 프레임 루프 0(설계 §7①).
          ...(paceDwell ? { '--pace-dwell': `${paceDwell}ms` } : null),
        }}
        onPointerDown={tokenRange.handlePointerDown}
        onClickCapture={tokenRange.handleClickCapture}
        onClick={handleReaderBlankClick}
      >
        {/* 이합사 연결 아치 오버레이 — reader-area(position:relative, 그립 선례) 좌표계 */}
        <svg ref={sepArcRef} className="sep-arc" aria-hidden="true" />
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
          <div className="analyzing-banner" style={{ background: 'color-mix(in srgb, var(--warning-bright) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--warning-bright) 40%, transparent)' }}>
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

          const renderToken = (tokenId, lineHead = null, picked = false, paceSlice = null) => {
            // 체류 선의 자기 몫 구간(v2-I R1b) — 오른쪽부터 물러나므로 마지막 토큰이 먼저 빈다.
            const paceStyle = paceSlice
              ? { '--pace-from': paceSlice.from, '--pace-to': paceSlice.to }
              : undefined;
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
                  className={`word-token word-token--failed${pickedClass}`} style={paceStyle} title="분석 실패 — 재시도 버튼을 눌러주세요">
                  {linePick}
                  <span className="furigana" />
                  <span className="surface">{token.text}</span>
                  <span className="failed-marker">!</span>
                </div>
              );
            }
            const isSaved = isTokenSaved(savedWords, token);
            const isDue = isSaved && isTokenDue(savedWords, token);
            // 앎 대조는 단어 카드의 isKnown과 동일 계약(표기·base_form) — 상태 하이라이트와
            // 발음 표기 '모르는 단어만'이 공유하고, 둘 다 꺼져 있으면 계산 자체를 생략한다.
            const needKnown = wordStateHl || pronDisplay === 'unknown';
            const tokKnown = needKnown && !!(knownWordSet?.has(token.text) || (token.base_form && knownWordSet?.has(token.base_form)));
            // 상태 하이라이트(B안) — 켰을 때만 만남을 조회해 met/new 클래스를 더한다.
            // 만남 대조는 단어 목록의 조용한 점과 동일 계약(normalizeRefWordKey — §4.7).
            const hlClass = wordStateHl ? wordStateExtraClass(wordStateOf({
              isWord: isWordToken(token),
              isSaved,
              isDue,
              isKnown: tokKnown,
              isMet: !!(metCode && (metWordSet.has(normalizeRefWordKey(metCode, token.base_form)) || metWordSet.has(normalizeRefWordKey(metCode, token.text)))),
            })) : '';
            // ruby는 토글과 무관하게 항상 만든다 — 폭 예약(ruby[data-pinyin])이 병음을 꺼도
            // 유지돼야 켤 때 글자가 밀리지 않는다(오너 요청 2026-08-19). 끌 때는 rt만 감춘다.
            const rubySegments = token.furigana
              ? splitRuby(token.text, token.furigana)
              : null;
            // 발음 표기 3단(오너 확정 2026-08-27) — 감춰도 rt만 숨긴다(폭 예약 불변, furi-off 선례).
            // 「가려져 있다」는 **읽기가 실제로 붙는 토큰**에서만 참이다: furigana가 있어도
            // 한자가 없으면 splitRuby가 plain 한 조각만 내주어 벗길 rt가 없다. 그런 토큰까지
            // 참으로 두면 탭이 아무 일도 없이 먹힌다(카드가 안 열린다).
            const hasReading = !!rubySegments?.some((seg) => seg.kanji);
            const pronHidden = hasReading && pronHiddenFor(pronDisplay, { isKnown: tokKnown, isSaved });
            const pronRevealed = revealedPron.has(tokenId);
            const furiOff = pronHidden && !pronRevealed;
            return (
              <div key={tokenId} ref={el => { if (el) tokenRefs.current[tokenId] = el; }}
                data-tid={tokenId}
                data-text={token.text}
                className={`word-token ${isSaved ? 'word-token--saved' : ''} ${isDue ? 'word-token--due' : ''}${hlClass ? ` ${hlClass}` : ''}${pickedClass}${sepLink?.partnerIds.includes(tokenId) ? ' word-token--sep-linked' : ''}${visibleScan?.byToken.has(tokenId) ? ' word-token--pattern' : ''}`}
                style={paceStyle}
                role="button" tabIndex={0}
                onClick={() => handleTokenClick(token, tokenId, { pronHidden, pronRevealed })}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), handleTokenClick(token, tokenId, { pronHidden, pronRevealed }))}>
                {linePick}
                {rubySegments ? (
                  <span className={`surface${furiOff ? ' surface--furi-off' : ''}`}>
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

            // 자동 진행 체류 선 — 지정 문장 안에서 각 토큰이 '언제 지워질지'를 글자수
            // 비례로 나눈다. 선은 오른쪽 끝에서 물러나므로 토큰 i의 구간은 [1-e, 1-s].
            // 나눗셈은 여기서 한 번이고, 실제 시간은 CSS가 잰다(JS 프레임 루프 0).
            const paceSlices = isPicked && paceDwell ? (() => {
              const ids = lineTokenIds.slice(startIdx);
              const lens = ids.map((id) => countReadableChars(json.dictionary[id]?.text || ''));
              const total = lens.reduce((a, b) => a + b, 0);
              if (!total) return null;
              const m = new Map();
              let acc = 0;
              for (let i = 0; i < ids.length; i++) {
                const s2 = acc / total;
                acc += lens[i];
                m.set(ids[i], { from: 1 - acc / total, to: 1 - s2 });
              }
              return m;
            })() : null;

            return (
              <span key={gi} className={hClass || undefined} style={{ display: 'contents' }}>
                {lineTokenIds.slice(startIdx).map((id, ti) =>
                  renderToken(id, ti === 0 && lineText.length >= 2 ? { text: lineText, rawIdx } : null, isPicked, paceSlices?.get(id) || null)
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
            onGraded={handleReadingTestGraded}
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

      {/* 받아쓰기(목업 ① — 지정 문장 듣고 입력·글자 diff 채점) */}
      {dictationPickerOpen && (
        <DictationPicker
          sentences={sentences}
          savedSet={dictationSavedSet}
          onPick={(text) => { setDictationPickerOpen(false); setDictationSentence(text); }}
          onClose={() => setDictationPickerOpen(false)}
        />
      )}
      {dictationSentence && (
        <DictationPanel
          sentence={dictationSentence}
          lang={materialLang}
          ttsOpts={ttsOptsFor(ttsRate)}
          onClose={() => setDictationSentence(null)}
        />
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
