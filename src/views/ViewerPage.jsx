'use client';
import ClassroomReader from '../components/classroom/ClassroomReader';
import TeachingWord,{WordDisplayControls,useWordAppearance} from '../components/classroom/TeachingWord';
import TextbookAnnotations from '../components/classroom/TextbookAnnotations';
import ClassCopyNotice from '../components/classroom/ClassCopyNotice';
import {createClassSaveIntent} from '../lib/classSaveIntent';
import {classStudyContext,classStudyNeighborHref,studySelection} from '../lib/classStudy';

import { useState, useRef, useEffect, useMemo, useCallback, cloneElement, isValidElement } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {isStudyNote} from '@/lib/studyNoteIdentity';
import OriginalMaterialReader from '@/components/materials/OriginalMaterialReader';
import useLibraryActivity from '@/components/library/useLibraryActivity';
import LibrarySaveButton from '@/components/library/LibrarySaveButton';
import {materialActivity} from '@/lib/libraryActivity';
import { passageOf, sourcePassageHref, passageLocation, correctPassageToken } from '@/lib/sourcePassage';
import { takePassageAnalysis } from '@/lib/passageAnalysis';
import { composerOf, shouldReadComposerOriginal } from '@/lib/materialComposer';
import Link from 'next/link';
import { LibraryReturnLink } from '@/components/web/LibraryReaderLink';
import { readerReturnLabel } from '../lib/libraryReturn';
import ActionIcon from '../components/ActionIcon';
import ViewerReferenceExample from '../components/viewer/ViewerReferenceExample';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { fetchVocabularyLearningRows } from '../lib/vocabularyLearningRows';
import { buildVocabularyWordIndex, countVocabularyDueInMaterial, findIndexedVocabulary, isIndexedVocabularyDue } from '../lib/vocabularyDueIndex';
import { cacheMaterial, getCachedMaterial } from '../lib/offlineCache';
import SaveContextButton, { saveContext } from '../components/learning/SaveContextButton';
import MaterialChapterLinks from '../components/learning/MaterialChapterLinks';
import ReadingSourceFocus from '../components/learning/ReadingSourceFocus';
import ClassSourceFocus from '../components/classroom/ClassSourceFocus';
import { classSentenceEnd, classAnchorAt } from '../lib/classSource';
import { textbookStream } from '../lib/textbookAnnotations';
import OfflineNotice from '../components/OfflineNotice';
import { useReadingTimer } from '../lib/useReadingTimer';
import { countReadableChars } from '../lib/readingTimer';
import { useReadingPacer } from '../lib/useReadingPacer';
import { dwellMs, defaultTargetCpm, paceHint } from '../lib/readingPacer';
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
import { useViewerLanguage } from '../lib/useViewerLanguage';
import { useViewerExplanation } from '../lib/useViewerExplanation';
import { buildViewerWordPrompt, parseViewerExplanation, formatViewerExplanation, VIEWER_EXPLANATION_VERSION } from '../lib/viewerExplanation';
import { ViewerUiLocaleProvider } from '../lib/viewerLocaleContext';
import { viewerLanguageInfo } from '../lib/viewerLanguage';
import { useLearningCapabilities } from '../lib/useLearningCapabilities';
import { koreanReadingSource, learningSourceRevision } from '../lib/learningSources';
import { translateViewerText } from '../lib/viewerMessages';
import { useViewerQuiz } from '../lib/useViewerQuiz';
import { useReanalyze } from '../lib/useReanalyze';
import { useReanalyzeUI } from '../lib/useReanalyzeUI';
import { useReadingCompletion } from '../lib/useReadingCompletion';
import { useGrammarNoteSave } from '../lib/useGrammarNoteSave';
import { useInlineReview, patchVocabWordsCache } from '../lib/useInlineReview';
import { assertLegacyFsrsAllowed } from '../lib/fsrsLegacyBoundary';
import { insertConfirmedVocabulary, preservePendingVocabularyReviews } from '../lib/viewerVocabularyCache';
import { useMaterialComments } from '../lib/useMaterialComments';
import { friendlyToastMessage } from '../lib/errorMessage';
import { SAVE_GRADES, VOCAB_UPSERT, buildVocabRow } from '../lib/vocabIO';
import { useVocabularyExclusions } from '../lib/useVocabularyExclusions';
import { exclusionWord, findVocabularyExclusion } from '../lib/vocabularyExclusion';
import { callGemini } from '../lib/gemini';
import { fetchWordDetailText, peekWordDetailText, fetchSharedDetailText } from '../lib/wordDetail';
import { pinyinToneClass } from '../lib/pinyinTone';
import { splitRuby, KANA_RE } from '../lib/splitRuby';
import { pickedRangeOf } from '../lib/headwordPick';
import { pickableSentences, adjacentSentence } from '../lib/sentenceNav';
import { fitDivisor, isFitLang } from '../lib/fitWord';
import { charDetail, charEtym, isInspectableChar, materialWordsWithChar, wordsWithChar } from '../lib/charInspect';
import { fetchSynAnt, peekSynAnt, synAntEligible } from '../lib/synAnt';
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
import { useReaderLayout, readerVisibleBounds, useSelectedTokenVisibility } from '../lib/useReaderLayout';
import { pinyinCellWidth } from '../lib/pinyinLayout';
import { readerFontFamily } from '../lib/viewerPreferences';
import { textbookThemeStyle } from '../lib/textbookTheme';
import ViewerSettings from '../components/viewer/ViewerSettings';
import HunCell from '../components/viewer/HunCell';
import ViewerModal from '../components/viewer/ViewerModal';
import dynamic from 'next/dynamic';
import '../components/viewer/reader-controls.css';
import '../components/viewer/sentence-move-bar.css';
const ChineseSerif = dynamic(() => import('../components/viewer/ChineseSerif'), {ssr:false});
import { hunRubyCells } from '../lib/viewerHunRuby';
import { sentenceAroundToken, sentenceAroundTerm, clipSentenceToBudget, SENTENCE_LINE_BUDGET_TIGHT } from '../lib/viewerSentenceLine';
import { buildSenseList, senseListCount } from '../lib/viewerSenseList';
import { nextReviewForSavedWord } from '../lib/viewerNextReview';
import { viewerJapaneseGlyphTable } from '../lib/viewerJapaneseReference';
import { glyphRows } from '../lib/glyphColumn';
import { loadJaWordsTable, prefetchGlyphTables } from '../lib/glyphTables';
import { useGrammarDetail } from '../lib/useGrammarDetail';
import { useEasierText } from '../lib/useEasierText';
import { openForSentence, sentencePanelBelongsToLine } from '../lib/viewerSentenceScope';
import { prepareViewerSaveUndo, undoViewerSave } from '../lib/viewerSaveUndo';
import { contextualMeaning, refreshViewerToken, referenceMatchesContext, createViewerRequestGate, viewerCacheKey, viewerCommandAllowed } from '../lib/viewerReliability';
import { clearAnalysisCache, readAnalysisCache, writeAnalysisCache } from '../lib/viewerAnalysisCache';
import { SENTENCE_TX_LOGIN_REQUIRED, SENTENCE_TX_QUERY, canonicalSentence, classifySentenceOpen, fetchSentenceTranslation, peekSentenceTranslationKey,
  sentenceBookMeaning, sentencePrefetchLimiter, sentenceTranslationKey, sentenceTranslationQuery, sentenceTxStats } from '../lib/sentenceTranslation';
import { sentencePanelOriginal, sentencePanelTokenIds, sentencePatternHits, sentenceWordGlosses } from '../lib/viewerSentenceGlosses';
import { useSentencePrefetch } from '../lib/useSentencePrefetch';
import { isLocalId, parseLocalId, chaptersForLocalNav } from '../lib/classBoard';
import { getSharedCopy } from '../lib/sharedStore';
import { readIndexCache } from '../lib/classClient';
import { useRefVocabEntry, useRefVocabIndex, refLevelLabel } from '../lib/refVocabIndex';
import { loadHanjaPanelTable, onIdle, prefetchHanjaPanel } from '../lib/viewerHanjaPanel';
import { useTokenDictPrefetch } from '../lib/useTokenDictPrefetch';
import { tokenDictPrefetchEnabled, tokenDictQueryKey, tokenDictKeyOf, prefetchTokenDict } from '../lib/tokenDictPrefetch';
import { knownWordsLang } from '../lib/knownWords';
import { useKnownWords } from '../lib/useKnownWords';
import { knownWordKeys, normalizeKnownWord, knownWordSetOf } from '../lib/knownWordControl';
import { mergeKnownIntoIndex } from '../lib/knownWords';
import { materialFit, FIT_MIN_TYPES } from '../lib/materialFit';
import DictationPanel from '../components/DictationPanel';
import DictationPicker from '../components/DictationPicker';
import { recordVocabEncounters } from '../components/world/vocabEncounters';
import { syncVocabEncounters } from '../components/world/vocabEncounterSync';
import { encounterLookupLang, loadMetWordKeys, loadRefVocabLookup } from '../lib/refVocabLookup';
import { normalizeRefWordKey } from '../lib/refWordNormalize';
import { isWordToken, wordStateOf, wordStateExtraClass } from '../lib/wordState';
import { TTS_RATES, ttsOptsFor, pronHiddenFor } from '../lib/readingSheet';
import { getBook } from '../lib/bookMeta';
import ViewerGlyphColumn from '../components/viewer/ViewerGlyphColumn';
import ViewerHanjaPopover from '../components/viewer/ViewerHanjaPopover';
import ViewerJapaneseMore from '../components/viewer/ViewerJapaneseMore';
import TokenEditPanel from './TokenEditPanel';
import { senseCorrectionFor, revertCorrections, applyTokenCorrections } from '../lib/tokenEditOptions';
import { senseReviewItems, senseReviewDismissKey, senseReviewOptions, keepSenseCorrection, needsMeaningCheck, isBoundarySuggestion } from '../lib/viewerSenseReview';
import { dismissedBoundaryForms } from '../lib/boundaryEdits';
import ViewerSenseReview from '../components/viewer/ViewerSenseReview';
import { BoundaryMergeConfirm, BoundaryMergeRow, BoundaryPendingList, BoundarySplitPanel } from '../components/viewer/ViewerBoundaryEdit';
import {
  BoundaryEditError, boundaryEditContext, boundaryEntryAllowed, boundaryReasonHidden, boundaryReasonMessage, boundaryTokenOrigin,
  boundaryUndoValid, commitBoundaryEdit, pendingBoundaryRows, planBoundaryMerge, planBoundarySplit, planNeighborMerge, splitPreview,
  undoBoundaryEdit, dismissBoundarySuggestion, koreanBoundaryPiece, koreanSplitEntryAllowed, koreanSplitPreview, planKoreanSplit,
} from '../lib/boundaryEditFlow';
import { koreanFormula, koreanMorphemes } from '../lib/koreanBoundarySplit';
import SourceEditModal from './SourceEditModal';
import TokenPosLabel from './TokenPosLabel';
import TokenRangeGrips from './TokenRangeGrips';
import ViewerComments from './ViewerComments';
import ViewerQuizModal from './ViewerQuizModal';
import { langNameKo, splitSentenceAroundWord, detectLang } from '../lib/constants';
import { attributionParts } from '../lib/videoAttribution';
import { logReviewEvents } from '../lib/reviewEvents';

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
  // 팀 사본(v2-AB R2) — `local:<id>`는 **네트워크 0**: 기기 사본(sharedStore)만 연다. 없으면 LOCAL_MISSING
  // (캐시 폴백·서버 조회 없음 — 받기는 팀 페이지만 한다). 사본이 없어도 팀 페이지로 돌아갈 길은 ?team=가 준다.
  if (isLocalId(id)) {
    const copy = await getSharedCopy(parseLocalId(id));
    if (!copy?.material) {
      const err = new Error('LOCAL_MISSING');
      err.code = 'LOCAL_MISSING';
      throw err;
    }
    return { ...copy.material, __local: true, __team: copy.team };
  }
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

// 단어창 훈음 루비 셀의 기준 칸 — 카드 병음 칸 폭(reader-controls.css `.word-fit ruby[data-pinyin] {width:max(1em,3.1rem)}`
// = 3.1rem ≈ 49.6px). 이 폭 안에 드는 훈음은 한 줄 그대로, 넘으면 그 칸만 벌리고(--hun-n) ×1.6을 넘으면 훈/음 두 줄.
const HUN_RUBY_CELL = Object.freeze({ glyphPx: 49.6 });
// 자형 열(正 · 日)이 없는 카드 — 비중국어 · 시트 닫힘(AE-R3 PR②).
const NO_GLYPH = Object.freeze({ zheng: null, ja: null });

// 가나만(히라가나·가타카나·장음) — ja 읽기 2차 조회에서 가나 표면은 표면 자체가 읽기다
const KANA_ONLY = /^[\u3040-\u30ffー]+$/;

async function fetchUserVocabWords(userId, signal) {
  return buildVocabularyWordIndex(await fetchVocabularyLearningRows(userId, { signal }));
}

function findSavedVocab(savedWords, token, language) {
  return findIndexedVocabulary(savedWords, token, language);
}

function isTokenSaved(savedWords, token, language) {
  return !!findSavedVocab(savedWords, token, language);
}
function isTokenDue(savedWords, token, language) {
  return isIndexedVocabularyDue(savedWords, findSavedVocab(savedWords, token, language));
}
function isTokenInlineDue(savedWords, token, language) {
  return isIndexedVocabularyDue(savedWords, findSavedVocab(savedWords, token, language), { legacyOnly: true });
}

function gradeSaveKey(scope, token) {
  return `${scope}:${token?.sep_link || token?.base_form || token?.text || ''}`;
}

async function upsertViewerVocabulary(row, options = VOCAB_UPSERT) {
  // 반환 = 새로 들어간 행의 id. `ignoreDuplicates`라 **새로 넣었을 때만** [{ id }], 이미 있던
  // 단어면 [] — W R1 undo의 「되돌릴 게 있는가」 판정이 이 사실 하나에 선다(원래 있던 행은
  // 지우면 안 된다).
  const { data, error } = await supabase.from('user_vocabulary').upsert(row, options).select('*');
  if (error) throw error;
  return data || [];
}

// undo 안내 라벨 — 표기용일 뿐이고 동작은 metaKey || ctrlKey 양쪽을 다 받는다.
const UNDO_KEY_LABEL = typeof navigator !== 'undefined'
  && /mac|iphone|ipad/i.test(navigator.userAgentData?.platform || navigator.platform || '') ? '⌘Z' : 'Ctrl+Z';

// 한국어 기본 마크업을 유지하는 공통 글자 슬롯. 번역은 내용만 바꾸며 요소·속성·동작은 공유한다.
function ViewerLabelSlot({locale, text, children}) {
  return locale === 'ko' || !isValidElement(children) ? children : cloneElement(children, {}, text);
}


export default function ViewerPage() {
  const languageSettings = useViewerLanguage();
  const { uiLocale, explanationLocale } = languageSettings;
  const vt = useCallback((text, values) => translateViewerText(uiLocale, text, values), [uiLocale]);
  const { id } = useParams();
  const noteRouter = useRouter();
  const originalParams = useSearchParams();
  const studyContext=classStudyContext(originalParams);
  const classToolbarTarget=useRef(null);
  const [classStudyActive,setClassStudyActive]=useState(false);
  const [classBoardLayout,setClassBoardLayout]=useState('');
  const classBoardTarget=useRef(null),classBoardHeaderTarget=useRef(null);
  const [classBoardRatio,setClassBoardRatio]=useState(60);
  const [classPresenting,setClassPresenting]=useState(false);
  const { user, profile, fetchProfile } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { speak, stop:stopSpeech, supported: browserTtsSupported } = useTTS();
  useEffect(()=>()=>stopSpeech(),[id,stopSpeech]);

  const { data: material, isLoading, error, refetch } = useQuery({
    queryKey: ['material', id],
    queryFn: () => fetchMaterial(id),
    refetchInterval: (query) => {
      const d = query.state.data;
      const s = d?.processed_json?.status || d?.status;
      return s === 'analyzing' ? 4000 : false;
    },
  });

  const materialLang = material?.processed_json?.metadata?.language || 'Japanese';
  // The legacy editor writes one unlocalized meaning into the document/dictionary.
  // Korean reading saves use the separate atomic, confirmed-meaning path.
  const legacyTokenEditingAllowed = materialLang !== 'Korean';
  const legacyTokenEditingAllowedRef = useRef(legacyTokenEditingAllowed);
  legacyTokenEditingAllowedRef.current = legacyTokenEditingAllowed;
  // AD-R3 §7.5 한국어 나누기(오너 B안) — 아래 진입점 판정(koreanSplitAllowed)이 렌더마다 채운다. 경계 쓰기 mutation의 한국어 문.
  const koreanSplitAllowedRef = useRef(false);
  const languageInfo = viewerLanguageInfo(materialLang);
  const ttsSupported = browserTtsSupported && languageInfo?.capabilities.speech === 'supported';
  const effectiveExplanationLocale = languageInfo?.explanationLocales.includes(explanationLocale) ? explanationLocale : 'ko';
  const learningCapabilities = useLearningCapabilities(materialLang);
  const learningStorageSupported = learningCapabilities.save;
  const [koreanSources, setKoreanSources] = useState({ scope: '', byToken: {} });
  const koreanSourceScope = useMemo(() => materialLang === 'Korean' ? JSON.stringify([id, material?.raw_text, material?.processed_json]) : '',
    [materialLang, id, material?.raw_text, material?.processed_json]);
  useEffect(() => {
    if (!koreanSourceScope) return;
    let alive = true;
    const [materialId, rawText, json] = JSON.parse(koreanSourceScope);
    learningSourceRevision(rawText).then(sourceRevision => Promise.all(Object.entries(json?.dictionary || {}).map(async ([tokenId, token]) =>
      [tokenId, await koreanReadingSource({ materialId, rawText, sourceRevision, token: { ...token, id: tokenId } })])))
      .then(entries => { if (alive) setKoreanSources({ scope: koreanSourceScope, byToken: Object.fromEntries(entries) }); })
      .catch(() => { if (alive) setKoreanSources({ scope: koreanSourceScope, byToken: {} }); });
    return () => { alive = false; };
  }, [koreanSourceScope]);
  const [koreanSaveConflict, setKoreanSaveConflict] = useState(null);
  useEffect(() => setKoreanSaveConflict(null), [id, user?.id, effectiveExplanationLocale]);
  useEffect(()=>{if(isStudyNote(material))noteRouter.replace(`/notes/${id}`);},[material,id,noteRouter]);
  const [activeModal, setActiveModal] = useState(null);
  useEffect(()=>{stopSpeech();},[activeModal?.kind,stopSpeech]);
  const [paceRunning, setPaceRunning] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [fontStatus,setFontStatus] = useState('idle');
  const modal = name => activeModal?.kind === name;
  const changeModal = (name,value) => setActiveModal(value ? {kind:name, ...(typeof value === 'string'?{value}:{})} : null);
  const settingsOpen=modal('settings'), setSettingsOpen=value=>changeModal('settings',value);
  const sourceEditOpen=modal('source'), setSourceEditOpen=value=>changeModal('source',value);
  const dictationPickerOpen=modal('dictationPick'), setDictationPickerOpen=value=>changeModal('dictationPick',value);
  const dictationSentence=modal('dictation')?activeModal.value:null, setDictationSentence=value=>changeModal('dictation',value);
  const showReadingTest=modal('reading'), setShowReadingTest=value=>changeModal('reading',value);
  const showConversation=modal('conversation'), setShowConversation=value=>changeModal('conversation',value);
  const dictationDrafts=useRef(new Map());
  useEffect(()=>{setActiveModal(null);setPaceRunning(false);dictationDrafts.current.clear();},[id,user?.id]);
  useEffect(()=>{setActiveModal(prev=>prev?.kind==='source'?prev:null);setPaceRunning(false);dictationDrafts.current.clear();},[material?.raw_text,material?.processed_json]);
  // Custom hooks
  const settings = useViewerSettings(materialLang);
  const { fontSize,lineGap,charGap,showHanjaKo,showToneColors,wordStateHl,showPatterns,patternFilter,
    focusMode,setFocusMode,autoPace,paceCpm,paceStep,setPaceStep,theme,fontFamily,pronDisplay,
    autoSpeakOnClick,ttsRate,pinyinSize } = settings;

  const settingsTrigger = useRef(null);
  const quiz = useViewerQuiz();
  const { quizState, completionModal, setCompletionModal, generateQuiz,
          handleQuizAnswer, advanceQuiz, finishQuiz } = quiz;

  const [selectedToken, setSelectedToken] = useState(null);
  const selectedTokenRef=useRef(selectedToken);selectedTokenRef.current=selectedToken;
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const detailGate = useRef(createViewerRequestGate());
  const selectionGate = useRef(createViewerRequestGate());
  const saveScopeRef = useRef('');
  saveScopeRef.current = `${user?.id || ''}:${id}`;

  // ④ 글자 탐색 — 카드의 큰 단어에서 탭한 한자({ ch, key, reading }). 단어가 바뀌면 리셋.
  const [inspectChar, setInspectChar] = useState(null);
  const [commentInput, setCommentInput] = useState('');
  const [pendingGradeSaves, setPendingGradeSaves] = useState(() => new Set());
  const savingGrade = useRef(new Set());
  const saveAnim = pendingGradeSaves.has(gradeSaveKey(saveScopeRef.current, selectedToken));
  const gradeAction = useRef(0);
  const inlineGradeRequests = useRef(new Set());
  const [pendingInlineGrades, setPendingInlineGrades] = useState(() => new Set());
  const [inlineSaving, setInlineSaving] = useState({});
  const { titleEditing, setTitleEditing, titleDraft, setTitleDraft, updateTitleMutation } = useTitleEdit(id, toast);

  // 기존 자료의 한국어 단일 설명 캐시는 그대로 읽는다. 여러 설명 언어를 지원하는
  // 어댑터만 locale을 추가하여 새 지역 해설이 기존 캐시와 섞이지 않게 한다.
  const cacheScope = useMemo(() => languageInfo?.explanationLocales.length > 1
    ? [user?.id || 'guest', id, materialLang, effectiveExplanationLocale, material?.raw_text, material?.processed_json]
    : [user?.id || 'guest', id, materialLang, material?.raw_text, material?.processed_json],
    [user?.id, id, materialLang, effectiveExplanationLocale, languageInfo, material?.raw_text, material?.processed_json]);
  useEffect(() => {
    const detail = detailGate.current, selection = selectionGate.current;
    detail.cancel();
    selection.cancel();
    setSelectedToken(null);
    setIsSheetOpen(false);
    setLeftPanelLoading(false);
    setDragAnalyzing(false);
    setLeftPanelResult('');
    setWordDetail(null);
    return () => { detail.cancel(); selection.cancel(); };
  }, [id, user?.id, materialLang]);
  useEffect(() => {
    detailGate.current.cancel(); selectionGate.current.cancel();
    setWordDetail(null); setLeftPanelLoading(false); setDragAnalyzing(false); setLeftPanelResult('');
    setSelectedToken(selected => refreshViewerToken(selected, material?.processed_json));
  }, [material?.raw_text, material?.processed_json]);
  useEffect(() => { detailGate.current.cancel(); }, [selectedToken]);

  useLibraryActivity(materialActivity(material,passageOf(material)||originalParams.get('study')==='1'?'study':'text',null,null,user?.id),!!material&&!isLoading&&!error&&!shouldReadComposerOriginal(material,originalParams));

  // [자세히] 인라인 문법 해설(오너 확정) — 모달·체크박스 없이 시트 좌측에서 펼친다.
  const grammar = useGrammarDetail({ materialLang, toast, explanationLocale: effectiveExplanationLocale, scope: cacheScope });
  // [더 쉽게] (#1077-3) — 지정 문장을 같은 언어의 쉬운 말로. 같은 패널·같은 결.
  const easier = useEasierText({ materialLang, toast, explanationLocale: effectiveExplanationLocale, scope: cacheScope });
  // 자료 언어의 BCP 47 태그 — :lang() 폰트 규칙(zh=SC·ja=JP)의 스위치.
  const contentLangTag = materialLang === 'Chinese' ? 'zh-Hans' : languageInfo?.code;

  // 🈁 월드에서 만난 말(rfc-vocab-encounter, 목업 C) — 단어 목록에 조용한 점 하나만 얹는다.
  // 담김은 기존 저장 ✓ 표시가, 익힘은 레퍼런스 어휘의 필터(목업 D)가 담당하므로 여기선 만남만.
  // 집합은 대조 키(§4.7 정규화 — fr 관사형 접기, ja·en·zh는 원문 그대로)로 든다.
  const metCode = { Japanese: 'ja', French: 'fr', Chinese: 'zh', English: 'en' }[materialLang];
  const [metWordSet, setMetWordSet] = useState(() => new Set());
  // 표기 차이로 만난 토큰 text → 저작 표기(main) — 점 대조가 기록과 같은 열쇠를 쓴다(ja 읽기 2차 조회)
  const [metMainByText, setMetMainByText] = useState(() => new Map());
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
  // 지정(막대·드래그·이동) 문장 기록. 노트 저장은 더 이상 이것을 읽지 않는다 — 해설을 만든 문장(grammar.forText)을
  // 쓴다(AE-R2 §5.2). 지정 경로의 기록 자체는 focusMode 계약이 고정하고 있어 그대로 둔다.
  const [, setSelectedRangeText] = useState('');

  const { data: savedWordsData, error: savedWordsError, refetch: refetchSavedWords } = useQuery({
    queryKey: ['vocab-words', user?.id],
    queryFn: async ({ signal }) => preservePendingVocabularyReviews(await fetchUserVocabWords(user.id, signal),
      queryClient.getQueryData(['vocab-words', user.id])),
    enabled: !!user,
    staleTime: 1000 * 30,
  });

  const savedWords = useMemo(() => savedWordsError
    ? { ...savedWordsData, complete: false }
    : savedWordsData || { byKey: new Map(), surfaces: new Set(), bases: new Set() }, [savedWordsData, savedWordsError]);

  const exclusionState = useVocabularyExclusions();

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
    queryKey: ['book-chapters', bookMeta?.key, material?.owner_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reading_materials')
        .select('id, title, processed_json->status, processed_json->metadata->book')
        .filter('processed_json->metadata->book->>key', 'eq', bookMeta.key)
        .eq('owner_id', material.owner_id);
      if (error) throw error;
      return (data || [])
        .map((r) => ({ id: r.id, title: r.title, status: r.status, order: Number(r.book?.order) || 0 }))
        .sort((a, b) => a.order - b.order || Number(a.id) - Number(b.id));
    },
    enabled: !!bookMeta?.key && !material?.__local,
    staleTime: 1000 * 60,
  });
  // 팀 사본(v2-AB R2)의 형제 과는 팀 목록 캐시에서 — 링크는 팀 페이지(?open=)를 거친다(받기 단일 소유).
  const navChapters = material?.__local
    ? chaptersForLocalNav(readIndexCache(material.__team)?.index, material.__team)
    : bookChapters;
  const navId = material?.__local ? parseLocalId(id) : id;
  const bookNav = (() => {
    if (!bookMeta || !navChapters?.length) return null;
    const idx = navChapters.findIndex((c) => c.id === Number(navId) || String(c.id) === String(navId));
    if (idx === -1) return null;
    return {
      title: bookMeta.title,
      pos: idx + 1,
      total: navChapters.length,
      prev: idx > 0 ? navChapters[idx - 1] : null,
      next: idx < navChapters.length - 1 ? navChapters[idx + 1] : null,
      // 이어 적기(#1077 5520128974) — 마지막 과의 「다음 →」 자리에 「다음 과 적기」(내 책만)
      key: bookMeta.key,
      canAppend: !!user?.id && material?.owner_id === user.id,
    };
  })();

  // 형제 내비 **한 문법**(뷰어 정돈 A안, #1077 5547935464) — 교재 시리즈(useSeriesNeighbors)와 책 챕터
  // (bookNav)가 같은 모양·같은 자리(경로 줄). 예전엔 시리즈는 헤더의 ◀ 3/20 ▶, 책은 본문 위 **채워진
  // 바** 50px였다. 이름은 툴팁에만 — H1이 이미 「책 — 과」·시리즈 챕터 제목을 들고 있어 화면에 찍으면
  // 중복이다(v2-Q ③과 같은 규칙을 책에도). 책이 시리즈보다 먼저 — 둘 다인 자료는 없다(책=사용자 등록·시리즈=정본).
  const siblingNav = bookNav
    ? {
        kind: 'book', label: `《${bookNav.title || '제목 없는 교재'}》`,
        pos: bookNav.pos, total: bookNav.total, prev: bookNav.prev, next: bookNav.next,
        prevLabel: '이전 과', nextLabel: '다음 과',
      }
    : (prevLesson || nextLesson)
      ? {
          kind: 'series', label: seriesPosition ? `${seriesPosition.level} ${seriesPosition.series}` : '',
          pos: seriesPosition?.current ?? null, total: seriesPosition?.total ?? null, prev: prevLesson, next: nextLesson,
          prevLabel: '이전 편', nextLabel: '다음 편',
        }
      : null;

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
  // 비공개 자료는 작성자만 연다(아래 접근 제어) — 토론 상대가 없으니 카드도 조회도 없다(뷰어 정돈 A안).
  const materialComments = useMaterialComments({
    materialId: id, user, toast, enabled: !!material && material.visibility !== 'private',
  });
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
    enabled: !!user && !!material && !shouldReadComposerOriginal(material, originalParams),
    paused: isSheetOpen || !!selectedToken || !!activeModal,
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

  // 저장 문장 = 해설을 만든 문장(AE-R2 §5.2). 막대·드래그 지정(selectedRangeText)은 단어창 「번역」 경로에서
  // 바뀌지 않아 빈 문자열이나 앞서 지정한 다른 문장이 저장됐다. 노트 데이터 구조는 그대로다.
  const saveGrammarNoteMutation = useGrammarNoteSave({
    user, materialId: id,
    selectedText: grammar.forText,
    explanation: grammar.result,
    toast,
  });
  // 다른 문장의 해설을 저장한 뒤에도 새 해설의 「노트에 저장」이 「✓ 저장됨」으로 막히지 않게.
  const resetNoteSave = saveGrammarNoteMutation.reset;
  useEffect(() => { resetNoteSave(); }, [grammar.forText, resetNoteSave]);

  // ── AD-R3 PR③ 「이 자료」 한 단어로 묶기 · 나누기 상태(설계서 docs/manabi-viewer-v2-ad-r3.md §4.1·§6) ──
  // boundaryPanel = {kind:'drag', key}(드래그 확인 줄) | {kind:'neighbor', tokenId, side}(⋯ 옆 단어와 묶기) | {kind:'split', tokenId}.
  // boundaryUndo = 「묶었어요/나눴어요 · 되돌리기」 — 그 토큰을 다시 열 때까지. boundaryPendingOpen = 재분석 알림 [보기] 목록.
  const [boundaryPanel, setBoundaryPanel] = useState(null);
  const [boundaryUndo, setBoundaryUndo] = useState(null);
  const [boundaryPendingOpen, setBoundaryPendingOpen] = useState(false);
  // 재분석에서 적용하지 못한 경계(pending)는 목업 문구 + [보기] → [문장] 탭 자리 목록(설계서 §6.3 마지막 목업).
  const showPendingBoundaries = (count) => toast(<span>{vt('분석을 다시 했어요. 직접 고친 단어 경계 {count}개는 이번 분석에 적용하지 못했어요.', { count })}{' '}
    <button type="button" className="btn btn--ghost btn--sm" style={{ pointerEvents: 'auto' }}
      onClick={() => { setSenseReviewIds(null); setBoundaryPendingOpen(true); setSentenceTabSignal(s => s + 1); }}>{vt('보기')}</button></span>, 'warning', 10000);

  // 재분석 로직 + UI
  const reanalyze = useReanalyze({ materialId: id, material, refetch, toast, explanationLocale: effectiveExplanationLocale, onPendingBoundaries: showPendingBoundaries });
  const reanalyzeMutation = reanalyze.mutation;
  const startPassageMutation = reanalyzeMutation.mutate;
  useEffect(() => {
    if (!passageOf(material) || !user?.id || material.owner_id !== user.id) return;
    const timer = setTimeout(() => {
      if (takePassageAnalysis(user.id, material.id)) startPassageMutation({ resume: true });
    }, 0);
    return () => clearTimeout(timer);
  }, [material, user?.id, startPassageMutation]);
  const stopReanalysis = reanalyze.stop;
  const isStaleAnalysis = reanalyze.stale;
  const missingLineCount = reanalyze.missingIndices.length;
  const {
    reanalyzePanel, setReanalyzePanel,
    selectedParas, paragraphs,
    togglePara, startFullReanalyze, startPartialReanalyze,
  } = useReanalyzeUI({ reanalyze, material, toast, panel:modal('manage')?activeModal.value:null, onPanelChange:value=>changeModal('manage',value) });

  // ③ 원문 수정(오너 승인) — 소유자 전용, 저장 시 바뀐 줄만 재분석(sourceEdit.js 계획).

  const handleSourceEditSave = async (plan) => {
    if (composerOf(material)) return;
    if (!plan || plan.noop) { setSourceEditOpen(false); return; }
    if (!plan.ok) { toast(plan.reason, 'error'); return; }
    if (plan.expectedRaw !== material.raw_text || JSON.stringify(plan.expectedJson) !== JSON.stringify(material.processed_json)) {
      toast('편집하는 동안 자료가 바뀌었어요. 초안을 보관한 뒤 다시 열어 주세요.', 'error'); return;
    }
    try {
      await reanalyzeMutation.mutateAsync({
        selectedLineIndices: plan.selected,
        rawTextOverride: plan.newText,
        baseJsonOverride: plan.remapped,
      });
      setSourceEditOpen(false);
    } catch { /* mutation reports the error; keep the editor draft */ }

  };

  // 읽기 진행률 바 — readerRef는 본문 컨테이너에 부착
  const { readerRef, readProgress } = useReadProgress(material);
  const {keepPosition:keepReadingPosition,layoutVersion,cancelPosition:cancelReadingPosition} = useReaderLayout(readerRef, material?.processed_json);
  const [pinyinCell,setPinyinCell] = useState(44);
  useEffect(()=>{
    let live=true;
    const measure=()=>{
      if(!live||materialLang!=='Chinese'||!readerRef.current)return;
      const rootSize=parseFloat(getComputedStyle(document.documentElement).fontSize)||16;
      const ctx=document.createElement('canvas').getContext('2d');
      if(!ctx)return;
      const family=getComputedStyle(readerRef.current).getPropertyValue('--font-noto-sans').trim()||'sans-serif';
      ctx.font=`${pinyinSize*rootSize}px ${family}`;
      setPinyinCell(pinyinCellWidth(text=>ctx.measureText(text).width,fontSize*rootSize));
    };
    measure();document.fonts?.ready.then(measure);window.addEventListener('resize',measure);
    return ()=>{live=false;window.removeEventListener('resize',measure);};
  },[materialLang,fontSize,pinyinSize,material?.id,readerRef]);
  // 그룹 같이 읽기 진도 push(§4.3) — 이번 주 지정 자료일 때만, 실패 조용히
  useGroupReadPush(material?.id, user?.id, readProgress);

  // 아는 단어 표시와 복습 보호 상태는 같은 DB 트랜잭션으로 바뀐다.
  const knownLangCode = knownWordsLang(materialLang, learningCapabilities.known);
  const knownState = useKnownWords(knownLangCode, !!knownLangCode);
  const knownWordSet = useMemo(() => knownWordSetOf(knownState.data, exclusionState.data, knownLangCode), [knownState.data, exclusionState.data, knownLangCode]);

  // 스크롤 위치 저장(debounce 2s) + 재진입 시 자동 복원
  const { saveScrollPosition, tokenRefs, positionError, retryPosition } = useScrollRestore({ user, materialId: id, material, readingProgress, readerRef });
  const [sourceFocusId, setSourceFocusId] = useState(null);
  const [restoredClassSource,setRestoredClassSource]=useState(null);
  useEffect(()=>setRestoredClassSource(null),[id]);
  const classResumeSelection=useRef(null);
  useEffect(()=>{
    const tokenId=originalParams.get('sourceToken');
    const scope=`${id}:${tokenId}`;
    if(originalParams.get('classSaved')!=='1'||originalParams.get('sourceQuote')||!tokenId||classResumeSelection.current===scope)return;
    const token=material?.processed_json?.dictionary?.[tokenId];
    if(!token||(originalParams.get('sourceQuote')&&originalParams.get('sourceQuote')!==token.text))return;
    classResumeSelection.current=scope;setSelectedToken({...token,id:tokenId});setIsSheetOpen(true);
  },[id,material,originalParams]);


  // 단어 저장 카운트 (복습 유도용)
  const saveCountRef = useRef(0);

  // W R1 — 키 `1`~`4` = 등급 저장, `Ctrl/⌘+Z` = 마지막 저장 취소(새로 넣은 행만). 문서 리스너
  // 하나(VocabPage 수동 추가 다이얼로그의 keydown 관용구 — 마운트 등록·언마운트 해제). 가드:
  // 입력 요소 포커스(편집·코멘트·검색)·조합키·카드 닫힘·이미 저장 상태에서는 발동하지 않고,
  // 입력 요소 안의 ⌘Z는 브라우저 기본 undo를 가로채지 않는다. 핸들러는 ref로 읽어 렌더마다
  // 리스너를 갈아 끼우지 않는다.
  const lastSaveRef = useRef(null);
  const keyHandlersRef = useRef({});
  useEffect(() => {
    function onKeyDown(e) {
      const h = keyHandlersRef.current;
      if (lastSaveRef.current?.expiresAt < Date.now()) lastSaveRef.current = null;
      if (lastInlineGradeRef.current?.expiresAt < Date.now()) lastInlineGradeRef.current = null;
      const inField = e.target?.closest?.('input, textarea, select, [contenteditable="true"], [role="textbox"]');
      if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        if (inField || h.blocked || e.isComposing || e.repeat || e.defaultPrevented || (!lastSaveRef.current && !lastInlineGradeRef.current)) return;
        const inViewer = e.target?.closest?.('.viewer-3col, .toast-container')
          || (e.target === document.body && document.querySelector('.viewer-3col'));
        if (!inViewer) return;
        e.preventDefault(); h.undo?.(); return;
      }
      if (!viewerCommandAllowed(e, { cardOpen: h.cardOpen, blocked: h.blocked })) return;
      if (e.metaKey || e.ctrlKey || e.altKey || !/^[1-4]$/.test(e.key)) return;
      if (h.inlineDue) { e.preventDefault(); h.gradeInline?.(Number(e.key)); return; }
      if (!h.saveLocked) { e.preventDefault(); h.addToVocab?.(Number(e.key)); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
  const lastInlineGradeRef = useRef(null);
  const undoBusy = useRef(false);
  useEffect(() => { lastSaveRef.current = null; lastInlineGradeRef.current = null; }, [id, user?.id]);
  useEffect(() => { gradeAction.current += 1; }, [id, user?.id]);

  const handleTokenClick = (token, tokenId) => {
    setRestoredClassSource(null);
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
    // 탭 규칙은 두 단계다(Y 설계 ③ — 발음 공개 단계 제거, 오너 확정 2026-09-05):
    // ① 집중 모드 문장 밖 = 이동(위에서 이미 return) → ② 그 외 단어 카드. 발음이 가려진
    // 단어도 첫 탭에 카드가 열린다(카드가 발음을 보여 준다).
    detailGate.current.cancel();
    selectionGate.current.cancel();
    setLeftPanelLoading(false);
    setDragAnalyzing(false);
    const t = { ...token, id: tokenId };
    // 다른 줄 단어 = [문장] 탭의 앞 문장 번역은 이 카드의 문장이 아니다 — 비워서 남지 않게(AE-R2 §1.2).
    // 같은 줄(막대 문장·그 줄 안 드래그)은 그 줄의 번역이라 둔다. 수업 모드는 자기 경로를 유지한다.
    if (!classStudyActive && !sentencePanelBelongsToLine(leftPanelText, ctxSentenceOf(t))) {
      setLeftPanelText('');
      setLeftPanelResult('');
    }
    resetWordPanelScroll();
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
      speak(t.text, materialLang, { ...ttsOptsFor(ttsRate), preferBrowser: true });
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
  const resetWordPanelScroll = () => {
    for (const panel of document.querySelectorAll('.viewer-inspector [data-panel="right"]')) panel.scrollTop = 0;
  };
  const handleListWordClick = (t) => {
    detailGate.current.cancel();
    resetWordPanelScroll(); // 동일한 단어·문맥을 다시 선택해도 카드가 화면 위에 보이도록.
    t = { ...t, __viewerSentence: ctxSentenceOf(t) ?? leftPanelText, __viewerMaterialId: String(id) };
    setSelectedToken({ ...t });
    setIsSheetOpen(true);
    setWordDetail(null);
    setInspectChar(null);
    setIsEditingToken(false);
    setRightSheetSignal(s => s + 1);
  };

  const closeWordCard = () => {
    const trigger=selectedToken?.id?tokenRefs.current[selectedToken.id]:null;
    trigger?.focus({preventScroll:true});
    detailGate.current.cancel();
    setIsSheetOpen(false);
    setSelectedToken(null);
    setWordDetail(null);
    setInspectChar(null);
    setIsEditingToken(false);
    setSenseReviewIds(null); // AD-R4 「뜻 확인 필요」 목록도 시트와 함께 닫는다
    setBoundaryPendingOpen(false);
  };

  // ④ 같은 글자 재탭 = 닫기, 다른 글자 = 교체
  const closeInspectChar = useCallback(() => setInspectChar(null), []);
  const toggleInspectChar = (ch, key, reading) => {
    setInspectChar(prev => (prev?.key === key ? null : { ch, key, reading }));
  };

  // ⑤ 유의어·반의어 칩 — 탭하면 그 단어의 카드로 교체(handleListWordClick 재사용, 새 상태 없음)
  const renderSynAntChips = (list) => list.map((x) => (
    <button
      key={x.w}
      className="syn-ant__chip"
      lang={contentLangTag}
      onClick={() => handleListWordClick({ text: x.w, base_form: x.w, meaning: x.ko, furigana: x.r, pos: '', __viewerSentence: ctxSentenceOf(selectedToken) ?? leftPanelText, __viewerMaterialId: String(id) })}
    >
      <span>{x.w}</span>
      {x.r && <span className="syn-ant__r pinyin-text">{x.r}</span>}
      {x.ko && <span className="syn-ant__ko">{x.ko}</span>}
    </button>
  ));

  // 카드는 패널 맨 위에 붙는다 — 리스트를 내려 본 뒤 탭해도 보이도록 스크롤 복귀
  // (데스크톱 우측 패널 + 모바일 시트 섹션, 둘 다 렌더 사본이라 전부 복귀).
  useEffect(() => {
    if (!selectedTokenRef.current || !isSheetOpen) return;
    for (const el of document.querySelectorAll('.viewer-inspector .reader-card-body')) el.scrollTop = 0;
    resetWordPanelScroll();
    const frame = requestAnimationFrame(() => {
      for (const card of document.querySelectorAll('.word-detail-card')) {
        if (card.getClientRects().length) { card.focus({ preventScroll: true }); break; }
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedToken?.id, selectedToken?.text, isSheetOpen]);

  // ⑤ 유의어·반의어(오너 승인) — 내용어만(synAntEligible),
  // localStorage 캐시라 단어당 1회 초소형 호출. 늦게 온 응답이 다른 단어에 붙지 않게 가드.
  // AE-R1 「더 알아보기」(VIEWER-V2-ROUNDS-001 §2.1): AI로 새로 만드는 것이라 요청 버튼이다. 이미 만든 결과(캐시)가
  // 있으면 카드를 열 때 버튼 대신 바로 보인다 — 캐시 확인은 localStorage만(네트워크 0). 접기(details)는 없다.
  const [synAntRequest,setSynAntRequest]=useState(0); // 0 = 요청 전(캐시만), n = [✦ 비슷한 말 찾기] n번째 누름
  useEffect(()=>setSynAntRequest(0),[selectedToken?.id,selectedToken?.text]);
  const [synAnt, setSynAnt] = useState(null);
  useEffect(() => {
    if (!selectedToken || !isSheetOpen || !synAntEligible(selectedToken, materialLang)) {
      setSynAnt(null);
      return undefined;
    }
    let alive = true;
    if (!synAntRequest) {
      setSynAnt(null);
      peekSynAnt(selectedToken, materialLang)
        .then((r) => { if (alive && r) setSynAnt({ loading: false, ...r }); })
        .catch(() => {});
      return () => { alive = false; };
    }
    setSynAnt({ loading: true, syn: [], ant: [] });
    fetchSynAnt(selectedToken, materialLang)
      .then((r) => { if (alive) setSynAnt({ loading: false, ...r }); })
      .catch(() => { if (alive) setSynAnt({ loading: false, error: true, syn: [], ant: [] }); });
    return () => { alive = false; };
  }, [selectedToken, isSheetOpen, materialLang, synAntRequest]);

  // AE-R1(VIEWER-V2-ROUNDS-001 §2.1 「없어지는 것」·§3): 단어 탭의 문맥 설명 버튼(이 문장에서는…)과 그 설명 상태를 걷었다.
  // /api/explain token 분기·ctxExplain.js는 AD-R4가 대신할 때까지 남는다(suspect 기록이 비는 것은 정본 §3이 감수).
  // 번역·단어 설명의 요청 문맥은 아래 훅을 평가하기 전에 준비한다.
  const [leftPanelText, setLeftPanelText] = useState('');
  const [leftPanelResult, setLeftPanelResult] = useState('');
  const [leftPanelLoading, setLeftPanelLoading] = useState(false);
  const selectedSentenceRef = useRef(''); selectedSentenceRef.current = leftPanelText;
  // [더 쉽게]·[자세히]는 그 결과를 만든 문장에만 붙는다(AE-R2 §5.1) — 탭 문장이 바뀌는 모든 길(막대·이동·
  // 단어창 「번역」·수업 출처 복원·다른 줄 단어)에서 진행 중 요청까지 끊는다. 표시는 openForSentence가 한 번 더 가린다.
  const resetGrammar = grammar.reset, resetEasier = easier.reset;
  useEffect(() => {
    if (grammar.forText && grammar.forText !== leftPanelText) resetGrammar();
    if (easier.forText && easier.forText !== leftPanelText) resetEasier();
  }, [leftPanelText, grammar.forText, easier.forText, resetGrammar, resetEasier]);
  const explainSelectedSentenceRef = useRef(null);
  const ctxSentenceOf = (tok) => {
    // 본문은 원문 줄, 무id 리스트·칩은 카드가 열린 당시의 문맥을 유지한다.
    const m = typeof tok?.id === 'string' ? tok.id.match(/^(?:id|failed)_(\d+)_/) : null;
    return m ? material?.raw_text?.split('\n')[Number(m[1])] || null
      : tok?.__viewerMaterialId === String(id) ? tok.__viewerSentence ?? null : null;
  };
  // AE-R1 문장 줄(VIEWER-V2-ROUNDS-001 §2.1): 줄 번호 → 그 줄 토큰(json.sequence 순서). 누른 자리를 문자열 검색이 아니라
  // 토큰 순서로 찾아 같은 단어가 여러 번 나와도 누른 곳 하나만 칠한다(sentenceAroundToken).
  const lineTokensByIndex = useMemo(() => {
    const seq = material?.processed_json?.sequence, dict = material?.processed_json?.dictionary;
    const lines = new Map();
    if (!Array.isArray(seq) || !dict) return lines;
    for (const tokenId of seq) {
      const m = /^(?:id|failed)_(\d+)_/.exec(tokenId);
      const token = dict[tokenId];
      if (!m || !token || token.pos === '개행') continue;
      const line = Number(m[1]);
      if (!lines.has(line)) lines.set(line, []);
      lines.get(line).push({ id: tokenId, text: token.text });
    }
    return lines;
  }, [material?.processed_json]);
  const cardSentenceOf = (tok, tight = false) => {
    const line = ctxSentenceOf(tok);
    if (!tok || !line) return null;
    const m = typeof tok.id === 'string' ? /^(?:id|failed)_(\d+)_/.exec(tok.id) : null;
    const tokens = m ? lineTokensByIndex.get(Number(m[1])) || [] : [];
    const index = m ? tokens.findIndex((t) => t.id === tok.id) : -1;
    const found = index >= 0
      ? sentenceAroundToken({ line, tokens, index, language: materialLang, term: tok.text })
      : sentenceAroundTerm({ line, term: tok.text, language: materialLang });
    return found ? clipSentenceToBudget(found, tight ? { budget: SENTENCE_LINE_BUDGET_TIGHT } : undefined) : null;
  };
  // 문형 한 줄의 팝오버(Q6 — 비모달, 접힘 0). 다른 단어로 가면 닫는다.
  const [patternOpen, setPatternOpen] = useState(false);
  useEffect(() => { setPatternOpen(false); }, [selectedToken?.id, selectedToken?.text]);
  // [문장] 탭의 문형 팝오버(AE-R2 PR ③) — 몇 번째 문형이 열렸나. 탭 문장이 바뀌면 닫는다.
  const [sentencePatternOpen, setSentencePatternOpen] = useState(null);
  useEffect(() => { setSentencePatternOpen(null); }, [leftPanelText]);
  const preserveOpenWord = !classStudyActive && !studyContext && !material?.__local
    && !/^\/class\//.test(originalParams.get('returnTo') || '') && !!selectedToken && isSheetOpen;
  // AD-R3 §7.5 한국어 나눈 조각 — 뜻은 저장된 형태 분석 설명뿐이다. 문맥 설명 오버레이(AI)·단어장 저장·등급을 붙이지 않는다.
  const koreanPieceSelected = materialLang === 'Korean' && !!selectedToken?.id && !!koreanBoundaryPiece(material?.processed_json, selectedToken.id);
  const localizedWord = useViewerExplanation({token: selectedToken, sentence: ctxSentenceOf(selectedToken) ?? leftPanelText,
    locale: effectiveExplanationLocale, sourceLocale: selectedToken?.meaningLocale || selectedToken?.explanationLocale || material?.processed_json?.metadata?.explanationLocale || 'ko',
    scope: cacheScope, enabled: materialLang === 'Korean' && isSheetOpen && !koreanPieceSelected});
  const koreanSaveDisplayScope = useRef('');
  koreanSaveDisplayScope.current = JSON.stringify([user?.id, id, effectiveExplanationLocale, selectedToken?.id, selectedToken?.text, material?.raw_text]);
  useEffect(() => {
    detailGate.current.cancel(); selectionGate.current.cancel();
    setLeftPanelLoading(false); setDragAnalyzing(false); setLeftPanelResult('');
    setWordDetail(null);
    resetGrammar(); resetEasier();
    if (selectedSentenceRef.current) explainSelectedSentenceRef.current?.(selectedSentenceRef.current, true);
  }, [effectiveExplanationLocale, resetGrammar, resetEasier]);

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
    const tok = selectedTokenRef.current;
    // 이합사 O 조각은 sep_link(VO)를 들고 온다 — 歉을 눌러도 道로 호를 긋는다(2026-09-02 오너 보고).
    const base = tok?.sep_link || tok?.base_form;
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
      const textNode=[...s.childNodes].find(n=>n.nodeType===Node.TEXT_NODE) || s.querySelector('ruby')?.firstChild;
      const range=document.createRange();
      if(textNode)range.selectNodeContents(textNode);
      const ink=textNode?range.getBoundingClientRect():r;
      return { x: r.left - areaRect.left + r.width / 2, y: ink.top - areaRect.top };
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
  }, [selectedToken?.id, selectedToken?.text, selectedToken?.base_form, selectedToken?.sep_link, materialLang, layoutVersion, fontSize, charGap, lineGap, pinyinCell, fontFamily, fontStatus, readerRef, tokenRefs]);

  // 왼쪽 패널: 번역 + 맥락

  // 단어 상세 AI 설명
  const [wordDetail, setWordDetail] = useState(null); // { detail, loading }
  const isClient = typeof window !== 'undefined';
  function getDetailCached(key) { if (!isClient) return null; try { return JSON.parse(localStorage.getItem(`pdf_cache:detail:${key}`)); } catch { return null; } }
  function setDetailCached(key, val) { if (!isClient) return; try { localStorage.setItem(`pdf_cache:detail:${key}`, JSON.stringify(val)); } catch {} }

  async function fetchWordDetail(token) {
    const request = detailGate.current.start();
    setWordDetail({ detail: null, loading: true });
    const deadline = setTimeout(() => {
      if (detailGate.current.isCurrent(request)) {
        setWordDetail({ detail: '설명 시간이 길어지고 있어요. 다시 시도해 주세요.', loading: false });
        request.abort();
      }
    }, 45000);
    try {
      let detail;
      if (materialLang === 'Korean') {
        const sentence = ctxSentenceOf(token) ?? leftPanelText;
        const cacheKey = await viewerCacheKey('viewer_word_detail', [...cacheScope, VIEWER_EXPLANATION_VERSION], [token.text, token.base_form, sentence]);
        if (!detailGate.current.isCurrent(request)) return;
        detail = getDetailCached(cacheKey);
        if (!detail) {
          const raw = await callGemini(buildViewerWordPrompt({surface: token.text, lemma: token.base_form, sentence, locale: effectiveExplanationLocale}), request.signal);
          detail = formatViewerExplanation(parseViewerExplanation(raw, 'word'), effectiveExplanationLocale, 'word');
          if (!detailGate.current.isCurrent(request)) return;
          setDetailCached(cacheKey, detail);
        }
      } else detail = await fetchWordDetailText(token, materialLang);
      if (detailGate.current.isCurrent(request)) setWordDetail({ detail, loading: false });
    } catch {
      if (detailGate.current.isCurrent(request)) setWordDetail({ detail: '설명을 가져올 수 없었어요.', loading: false });
    } finally { clearTimeout(deadline); }
  }

  // AE-R1 「더 알아보기」(VIEWER-V2-ROUNDS-001 §2.1): 이미 받은 설명(로컬 캐시)이 있으면 [✦ 자세한 설명] 대신
  // 내용을 바로 보인다 — 네트워크·AI 0. 없으면 버튼이 기존 fetchWordDetail 경로를 그대로 부른다.
  useEffect(() => {
    if (!selectedToken || !isSheetOpen || materialLang === 'Korean') return undefined;
    let alive = true;
    peekWordDetailText(selectedToken, materialLang)
      .then((detail) => { if (alive && detail) setWordDetail((current) => current ?? { detail, loading: false }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [selectedToken, isSheetOpen, materialLang]);
  // AE-R1 PR③ 공유 detail_text(정본 §2.1 「이미 만든 결과(공유 detail_text)가 있으면 버튼 대신 내용」): 일괄 미리 받기는
  // detail_text를 싣지 않으므로(최대 4,000자), 「더 알아보기」 구역이 화면에 들어올 때 카드당 1회 그 열만 읽는다
  // (IntersectionObserver, 미지원이면 카드 열림 뒤 1회). 같은 단어 재열람은 메모리 캐시로 0요청, 실패는 조용히 버튼 그대로.
  // 비로그인은 사전 읽기 RLS(인증 사용자만)라 묻지 않는다. AI·/api/word-detail은 부르지 않는다(버튼이 기존 경로를 탄다).
  const learnRef = useRef(null);
  useEffect(() => {
    if (!selectedToken || !isSheetOpen || materialLang === 'Korean' || !user?.id) return undefined;
    let alive = true, asked = false, observer = null;
    const token = selectedToken;
    const ask = () => {
      if (asked) return;
      asked = true;
      observer?.disconnect();
      fetchSharedDetailText(supabase, selectedToken, materialLang)
        .then((shared) => (shared ? peekWordDetailText(token, materialLang) : null))
        // 이미 받은 설명·생성 중인 요청이 있으면 덮지 않는다(버튼 경로 우선).
        .then((detail) => { if (alive && detail) setWordDetail((current) => current?.detail || current?.loading ? current : { detail, loading: false }); })
        .catch(() => {});
    };
    const target = learnRef.current;
    if (typeof IntersectionObserver === 'undefined') ask();
    else if (target) {
      observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) ask(); });
      observer.observe(target);
    }
    return () => { alive = false; observer?.disconnect(); };
  }, [selectedToken?.id, selectedToken?.text, selectedToken?.base_form, isSheetOpen, materialLang, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
        const mainByText = new Map();
        for (const t of dragTokens) {
          if (t.sep_link) continue;   // 이합사 O 조각 — 만남은 V(base_form=VO)가 한 번만 남긴다
          // ja 읽기 2차 조회 — 표면 키가 없을 때 후리가나로 표제어를 찾는다(가나 표면은 표면 자체가 읽기,
          // 토크나이저가 가나 표면의 후리가나를 비운다). 가나↔한자 표기 차이만(어휘 いぬ·본문 犬).
          const reading = code === 'ja' ? (t.furigana || (KANA_ONLY.test(t.text) ? t.text : null)) : null;
          const hit = lookup.findWord(t.base_form) || lookup.findWord(t.text, reading);
          if (hit?.main) {
            met.push(hit.main);
            if (hit.main !== t.text && hit.main !== t.base_form) mainByText.set(t.text, hit.main);
          }
        }
        if (alive) setMetMainByText(mainByText);
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
  const [sentenceTabSignal, setSentenceTabSignal] = useState(0);

  // 문장 막대로 지정한 줄 — 해당 줄 전체에 지정 이펙트(#1002). 단어 클릭·드래그 시 해제.
  const [pickedLineIdx, setPickedLineIdx] = useState(null);
  // 받아쓰기 패널(목업 ① — #1077-6): 지정 문장 대상, 열림 동안 원문 가림은 패널 몫
  // 받아쓰기 — 대상 문장 하나를 상태로 든다(지정 문장 🎧 · 추천 고르기 두 경로가 같은 패널로 모임).



  // 리딩 테스트

  // 회화 연습


  // 인앱 토큰 범위 지정 — 네이티브 선택 대체(앱 전역 무선택 정책). 데스크톱 즉시 드래그,
  // 모바일 길게 누르기(300ms) 후 드래그. 확정 시 기존 분석 파이프라인에 그대로 투입하고,
  // 문법 버튼 활성 경로(selectedRangeText)도 같은 텍스트로 채운다.
  const tokenRange = useTokenRangeSelect({
    sequence: material?.processed_json?.sequence,
    dictionary: material?.processed_json?.dictionary,
    enabled: true,
    onSelect: (text) => {
      setRestoredClassSource(null);
      setPickedLineIdx(null); // 막대 지정 이펙트와 상호 배타
      setSelectedRangeText(text);
      grammar.reset(); // 다른 문장의 해설이 남지 않게
      easier.reset();  // 다른 문장의 쉬운 말도 함께
      setSentenceTabSignal(s => s + 1); // 명시적 드래그 분석은 문장 탭, 기존 단어 정보는 보존.
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
  // 「N개 수집 → 단어장」(AD-R2 설계 Q4) — 이 자료의 내용어 중 단어장에 담긴 수. 같은 엔진에 '이미 앎'을 합치기 전
  // 인덱스를 넣는다(담은 것만 센다). 표본 하한은 두지 않는다 — 수집은 비율이 아니라 개수라 0% 오표기 위험이 없다.
  const collectedInMaterial = useMemo(() => (user && material?.processed_json ? materialFit(material.processed_json, savedWords).known : 0), [user, material?.processed_json, savedWords]);

  // 받아쓰기 추천용 담은 단어 집합 — 표기·기본형 합집합(엔진이 text.includes로 대조).
  const dictationSavedSet = useMemo(
    () => new Set([...(savedWords?.surfaces || []), ...(savedWords?.bases || [])]),
    [savedWords]
  );

  // 이동 전 문장 분석·목록만 비운다. 기본 뷰어의 열린 단어 카드는 별도 선택이며
  // 원래 문맥과 진행 중 상세 요청을 유지한다. 수업 host는 기존 선택 해제를 따른다.
  const clearAnalysisPanels = () => {
    setRestoredClassSource(null);
    selectionGate.current.cancel();
    setLeftPanelText('');
    setLeftPanelResult('');
    setLeftPanelLoading(false);
    setDragTokens(null);
    setDragAnalyzing(false);
    if (!preserveOpenWord) {
      detailGate.current.cancel();
      setSelectedToken(null);
      setIsSheetOpen(false);
      setInspectChar(null);
      setWordDetail(null);
    }
  };

  // 이동 = 그 문장의 막대(¦)를 대신 눌러주는 것 — 지정·분석·스크롤이 한 동작.
  // 단, 집중 모드에서는 '순수 이동'(오너 지시 2026-08-20): 문장을 따라 읽는 중이라
  // 번역·맥락 시트가 매번 올라오는 게 방해고, 안 볼 번역에 Gemini 호출을 쓰는 낭비다.
  // 분석 없이 지정·스크롤만 하고 문장 패널은 비운다. 열린 단어는 유지한다.
  // 분석이 필요하면 막대(¦)를 누른다 —
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
    if (el) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      requestAnimationFrame(()=>{
        if(!el.isConnected)return;
        const bounds=readerVisibleBounds(readerRef.current),rect=el.getBoundingClientRect();
        const top=bounds.top+Math.max(0,(bounds.bottom-bounds.top-rect.height)/3);
        window.scrollBy({top:rect.top-top,behavior:reduce?'instant':'smooth'});
      });
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
  const [background,setBackground]=useState(false);
  useEffect(()=>{const update=()=>setBackground(document.hidden);document.addEventListener('visibilitychange',update);update();return ()=>document.removeEventListener('visibilitychange',update);},[]);
  const modalBlocked=classPresenting||!!activeModal||!!reanalyzePanel||!!quizState||!!completionModal;
  const selectionToReveal = tokenRange.range
    ? material?.processed_json?.sequence?.[tokenRange.range.start]
    : isSheetOpen ? selectedToken?.id : undefined;
  useSelectedTokenVisibility(readerRef, tokenRefs, selectionToReveal, inspectorOpen && (!classStudyActive||!!classBoardLayout) && !modalBlocked && !tokenRange.dragging, material?.processed_json);
  const closeReadingSettings = () => {
    // Once the inspector returns, the selected source owns the visible position.
    // A still-live Aa anchor must not scroll it back underneath the panel.
    if (selectionToReveal && inspectorOpen) cancelReadingPosition();
    setSettingsOpen(false);
  };
  useEffect(()=>{if(!autoPace||!focusMode||pickedLineIdx===null)setPaceRunning(false);},[autoPace,focusMode,pickedLineIdx]);
  useEffect(()=>{
    const stopOnScroll=e=>{if(tokenRange.dragging||e.target?.closest?.('.reader-modal,.viewer-inspector'))return;setPaceRunning(false);};
    window.addEventListener('wheel',stopOnScroll,{passive:true});window.addEventListener('touchmove',stopOnScroll,{passive:true});
    return ()=>{window.removeEventListener('wheel',stopOnScroll);window.removeEventListener('touchmove',stopOnScroll);};
  },[tokenRange.dragging]);
  const startPacer=()=>{
    const bounds=readerVisibleBounds(readerRef.current);
    const visible=sentences.find(sentence=>{const r=tokenRefs.current[sentence.firstTokenId]?.getBoundingClientRect();return r&&r.bottom>bounds.top&&r.top<bounds.bottom;});
    const target=pickedSentence||visible||sentences[0];if(!target)return;
    setFocusMode(true);setPickedLineIdx(target.rawIdx);setPaceRunning(true);
  };
  const paceArmed = paceRunning && autoPace && focusMode && pickedSentence !== null;
  const paceDwell = paceArmed
    ? dwellMs({ chars: countReadableChars(pickedSentence.text), targetCpm: paceTargetCpm })
    : null;
  // 카드·시트 열림 = 찾아보는 중 — 진행도 측정도 함께 멈춘다(I-a와 같은 신호).
  const paceHeld = inspectorOpen || isSheetOpen || modalBlocked || tokenRange.dragging || background;
  // 자동 진행 버튼 한 벌(AD-R2 설계 Q3 A — 바닥 한 자리). 지정 문장이 있으면 문장 이동 막대 안 아이콘(44px),
  // 없으면 바닥에 뜬 「▶ 자동 진행」. 같은 이름·동작을 다른 옷으로 입는다 — 접근 이름 3종은 툴바 시절 그대로다
  // (readingPacer 계약·viewer-reading-controls e2e가 이 이름으로 누른다). 시트·창이 열리면 둘 다 없다(정본 §5).
  const paceFocusRef = useRef(false);
  const paceToggle = (className, withLabel = false) => {
    const name = vt(paceRunning ? (paceHeld ? '자동 진행 대기 · 중지' : '자동 진행 중지') : '자동 진행 시작');
    return <button type="button" className={className} aria-label={name} title={name} aria-pressed={paceRunning} data-icon-action={withLabel ? undefined : ''}
      onClick={e => {
        if (paceRunning) { setPaceRunning(false); return; }
        // 단독 버튼은 시작과 함께 사라진다(막대가 대신 뜬다) — 누른 손의 포커스를 막대 안 ■로 넘긴다.
        paceFocusRef.current = withLabel && e.currentTarget === document.activeElement;
        startPacer();
      }}><ActionIcon name={paceRunning ? 'stop' : 'play'}/>{withLabel&&<span>{vt('자동 진행')}</span>}</button>;
  };
  // 문장 이동 막대가 뜨는 조건(#1356): 지정 문장 + 기본 뷰어(수업 모드는 자기 도크 — 막대 없음) + 보조 패널이 바닥에 없음
  // (패널에 내용이 있으면 막대 대신 시트가 뜬다). 패널은 닫아도 내용이 남으면 접힌 채 바닥에 머문다(sheetPresent).
  const [sheetPresent, setSheetPresent] = useState(false);
  const moveBarShown = pickedSentence !== null && !classStudyActive && !sheetPresent;
  // 접힌 시트(내용이 화면을 덮지 않음)에서도 자동 진행에 닿아야 한다(main은 툴바 ▶가 늘 있었다): 1120 미만은 남은 머리줄 안
  // ▶(collapsedActions)가, 1120 이상은 접힌 시트가 통째로 숨으므로 단독 버튼(--wide, CSS가 그 폭에서만 보인다)이 맡는다.
  const sheetStripShown = sheetPresent && !inspectorOpen && !classStudyActive;
  const paceFloatShown = autoPace && sentences.length > 0 && !moveBarShown && !inspectorOpen && !isSheetOpen && !modalBlocked;

  useReadingPacer({
    enabled: paceArmed,
    dwell: paceDwell,
    paused: paceHeld,
    cursor: pickedLineIdx,
    onAdvance: () => {
      // 마지막 문장이면 자동 종료 — 넘길 곳이 없으면 paced 표식도 남기지 않는다.
      if (!adjacentSentence(sentences, pickedLineIdx, 1)) { setPaceRunning(false); return; }
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
      aria-label={dir < 0 ? vt('위 문장') : vt('아래 문장')}
      title={dir < 0 ? vt('위 문장 · Alt+↑') : vt('아래 문장 · Alt+↓')}
      aria-keyshortcuts={dir < 0 ? 'Alt+ArrowUp' : 'Alt+ArrowDown'}
      disabled={!adjacentSentence(sentences, pickedLineIdx, dir)}
      onClick={() => moveSentence(dir)}
      data-icon-action
    ><ActionIcon name={dir<0?'up':'down'}/></button>
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
    releasePickedSentence();
  };
  // 지정 해제 한 벌 — 빈 공간 탭과 문장 이동 막대의 ×가 같은 해제를 쓴다.
  const releasePickedSentence = () => {
    tokenRange.clearRange();
    setPickedLineIdx(null);
    setSelectedRangeText('');
    clearAnalysisPanels();
  };

  const runSelectionAnalysis = async (sel) => {
    return runSelectedSentence(sel);
  };
  const runSelectedSentence = async (sel, explanationOnly = false) => {
    const request = selectionGate.current.start();
    const current = () => selectionGate.current.isCurrent(request);
    const deadline = setTimeout(() => {
      if (current()) {
        setLeftPanelResult('분석 시간이 길어지고 있어요. 문장을 다시 선택해 주세요.');
        setLeftPanelLoading(false); setDragAnalyzing(false); request.abort();
      }
    }, 45000);
    if (!preserveOpenWord) detailGate.current.cancel();
    setSenseReviewIds(null); // 새 문장 번역이 [문장] 탭 자리를 받는다(AD-R4 목록은 [보기]로 다시 연다)
    setBoundaryPendingOpen(false); // AD-R3 적용 못 한 경계 목록도 같은 자리라 닫는다
    if (!explanationOnly) {
      setLeftSheetSignal(s => s + 1);
      if (!preserveOpenWord) setRightSheetSignal(s => s + 1);
    }
    try {
      // 왼쪽: 번역+맥락
      setLeftPanelText(sel);
      setLeftPanelLoading(true);
      setLeftPanelResult('');

      // 오른쪽: 드래그 선택 문장의 단어 추출
      if (!explanationOnly) {
        setDragAnalyzing(true);
        setDragTokens([]);
        if (!preserveOpenWord) {
          setSelectedToken(null);
          setIsSheetOpen(false);
        }
      }

      // 번역 = 단일 키(AE-R2 PR ② — sentenceTranslation.js). 교재 뜻(v2-AB R0)을 **캐시·AI보다 먼저** 본다 — 정확
      // 일치만, 적중하면 번역 요청 0(비로그인 학생도 교재 뜻은 본다). 그다음 viewer_tx 키의 쿼리 하나: 선처리가
      // 끝났으면 즉시 읽고, 진행 중이면 그 요청에 합류하고, 없으면 지금 시작한다(같은 문장·같은 설정 = 요청 1회).
      // 쿼리는 signal을 쓰지 않아 다른 단어로 가도 끝까지 받아 저장한다 — 패널에는 이 요청이 현재일 때만 반영.
      const bookMeaning = sentenceBookMeaningOf(sel);
      const cacheKey = bookMeaning ? null : await sentenceTranslationKey(cacheScope, sel).catch(() => null);
      if (!current()) return;
      if (bookMeaning) {
        setLeftPanelResult(bookMeaning);
        setLeftPanelLoading(false);
      }
      // 게스트(AE-R2 PR ③ · Q4): AI는 로그인 사용자만 — 캐시·교재 맵이 없으면 요청하지 않고 번역 칸에 로그인 안내를 둔다
      // (예전: /api/gemini 401 → 「설명을 가져오지 못했어요」).
      const translationArgs = { ...sentenceTxArgs(sel), purpose: 'viewer-sentence', onAi: (event) => sentenceTxStats.ai(event),
        ...(user ? {} : { beforeAi: () => false }) };
      const fromCard = cardSentenceOpen.current?.sentence === sel ? cardSentenceOpen.current : null;
      cardSentenceOpen.current = null;
      // 병렬 실행
      await Promise.allSettled([
        // 번역+맥락 (교재 뜻이 없을 때만)
        bookMeaning ? Promise.resolve() : (cacheKey
          ? queryClient.fetchQuery(sentenceTranslationQuery({ cacheKey, ...translationArgs }))
          : fetchSentenceTranslation({ cacheKey: null, ...translationArgs })
        ).then(({ text }) => {
          if (fromCard) sentenceTxStats.ready({ ms: Date.now() - fromCard.at });
          if (!current()) return;
          setLeftPanelResult(text);
          setLeftPanelLoading(false);
        }).catch((error) => {
          if (!current()) return;
          setLeftPanelResult(!user && error?.message === 'SENTENCE_TX_SKIPPED' ? SENTENCE_TX_LOGIN_REQUIRED : '설명을 가져오지 못했어요. 문장을 다시 선택해 주세요.');
          setLeftPanelLoading(false);
        }),

        // 단어 분석 — 문장 단위 캐시(좌측 번역과 대칭). 적중하면 서버 요청 자체가 사라져
        // 문맥 판별·뜻 조회가 함께 절감된다(§C4).
        explanationOnly ? Promise.resolve() : (async () => {
          const anKey = await viewerCacheKey('viewer_an', cacheScope, sel).catch(() => null);
          if (!current()) return;
          const anCached = isClient && anKey ? readAnalysisCache(localStorage, anKey) : null;
          if (anCached) { setDragTokens(anCached); setDragAnalyzing(false); return; }
          let authHeader = {};
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) authHeader = { Authorization: `Bearer ${session.access_token}` };
          } catch {}
          const lines = materialLang === 'Korean' ? sel.split('\n') : sel.split('\n').map(l => l.trim()).filter(Boolean);
          if (!current()) return;
          const res = await fetch(materialLang === 'Korean' ? '/api/analyze/korean' : '/api/analyze', {
            signal: request.signal,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader },
            body: JSON.stringify({ lines, language: materialLang, explanationLocale: effectiveExplanationLocale }),
          });
          if (!res.ok) throw new Error('ANALYSIS_FAILED');
          const data = await res.json();
          if (!current()) return;
          const tokens = [];
          const seen = new Set();
          for (const r of data.results || []) {
            for (const tid of r.sequence || []) {
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
          if (isClient && anKey) writeAnalysisCache(localStorage, anKey, tokens);
          setDragAnalyzing(false);
        })().catch(() => {
          if (current()) { setDragTokens([]); toast('단어 분석을 가져오지 못했어요. 문장을 다시 선택해 주세요.', 'error'); }
        }).finally(() => { if (current()) setDragAnalyzing(false); }),
      ]);
    } finally { clearTimeout(deadline); }
  };
  explainSelectedSentenceRef.current = runSelectedSentence;

  // ── 문장 탭 선처리(AE-R2 PR ② · 정본 §4) — 카드가 열린 채 같은 줄에 0.3초 머물면 그 줄 번역을 같은 키로 미리
  // 받는다. 패널·탭·학습 기록·재분석은 건드리지 않는다(학습 이벤트 0). 교재 맵·viewer_tx 적중이면 요청 0.
  // 수업 모드(현행 경로 유지)·게스트(AI는 로그인 사용자만)·무id 리스트 단어(드래그가 이미 번역을 불렀다)는 0.
  const sentenceTxArgs = (sentence) => ({
    sentence, locale: effectiveExplanationLocale, language: materialLang,
    langName: languageInfo?.labelKo || langNameKo(materialLang), storage: (() => { try { return isClient ? window.localStorage : null; } catch { return null; } })(),
  });
  const sentenceBookMeaningOf = (sentence) => sentenceBookMeaning({
    translations: material?.processed_json?.metadata?.translations, locale: effectiveExplanationLocale, sentence });
  const cardSentenceOpen = useRef(null); // 측정 — 카드에서 [문장] 탭을 연 순간(적중·합류·없음, 준비까지 걸린 시간)
  const lineIndexOfToken = (tok) => {
    const m = typeof tok?.id === 'string' ? /^(?:id|failed)_(\d+)_/.exec(tok.id) : null;
    return m ? Number(m[1]) : null;
  };
  const prefetchLineKey = !classStudyActive && user && isSheetOpen && lineIndexOfToken(selectedToken) !== null
    ? `${id}:${lineIndexOfToken(selectedToken)}:${effectiveExplanationLocale}` : null;
  const prefetchCardSentence = async () => {
    const sentence = canonicalSentence(ctxSentenceOf(selectedToken));
    if (!sentence || sentenceBookMeaningOf(sentence)) return;
    const cacheKey = await sentenceTranslationKey(cacheScope, sentence).catch(() => null);
    if (!cacheKey) return;
    sentenceTxStats.prefetchStart();
    queryClient.prefetchQuery(sentenceTranslationQuery({
      cacheKey, ...sentenceTxArgs(sentence), purpose: 'viewer-sentence-prefetch', attempts: 1,
      beforeAi: () => { const ok = sentencePrefetchLimiter.take(); if (!ok) sentenceTxStats.prefetchLimited(); return ok; },
      onAi: (event) => sentenceTxStats.ai(event),
    }));
  };
  useSentencePrefetch({ lineKey: prefetchLineKey, start: prefetchCardSentence });

  // 문장 이동 막대(VIEWER-R0-BUGS-001 버그 4) — 문장이 지정됐는데 보조 패널에 보일 내용이
  // 없을 때(집중 모드 첫 탭·순수 이동 뒤·단어창을 닫은 뒤) 빈 패널(탭 머리만) 대신 뜬다.
  // 패널에 내용이 생기면 막대는 사라지고 ^/v는 패널 머리(barNav)로 옮겨 간다 — 둘은 동시에 없다.
  // 수업 모드(classStudyActive)는 도크·판이 자기 경로를 가진다 — 판 fallback에서는 막대를 띄우지 않고
  // (예전에도 접힌 패널은 보이지 않았다) Alt+↑/↓도 끈다. runSelectionAnalysis·수업 버튼은 그대로다.
  // 「번역」 = 지정된 문장의 막대(¦) 재탭과 같은 경로(runSelectionAnalysis: 교재 뜻 → 캐시 →
  // 기존 번역 요청). 새 AI 경로를 만들지 않는다. 열리는 곳은 보조 패널의 문장 탭이다.
  const translatePickedSentence = () => {
    if (!pickedSentence) return;
    tokenRange.clearRange();
    setSelectedRangeText(pickedSentence.text);
    setSentenceTabSignal(s => s + 1);
    runSelectionAnalysis(pickedSentence.text);
  };
  const moveBarRef = useRef(null);
  const moveBarFocus = useRef(null);
  const closeMoveBar = () => {
    const first = pickedSentence ? tokenRefs.current[pickedSentence.firstTokenId] : null;
    releasePickedSentence();
    first?.focus({ preventScroll: true }); // 막대가 사라져도 키보드 위치를 문장 머리에 남긴다
  };
  // 경계에서 누른 ^/v가 비활성되면 포커스가 body로 빠진다 — 반대 버튼으로 옮겨 이어서 누르게 한다.
  useEffect(() => {
    const bar = moveBarRef.current, last = moveBarFocus.current;
    if (!bar || !last?.disabled || !bar.contains(last)) return;
    const active = document.activeElement;
    if (active && active !== last && active !== document.body) return;
    bar.querySelector('button:not(:disabled)')?.focus();
  }, [pickedLineIdx]);
  // 단독 「▶ 자동 진행」으로 시작하면 그 버튼은 사라지고 막대가 뜬다 — 키보드 위치를 막대 안 ■에 이어 둔다.
  useEffect(() => {
    if (!paceFocusRef.current || !paceRunning) return;
    paceFocusRef.current = false;
    moveBarRef.current?.querySelector('.sentence-move-bar__pace')?.focus({ preventScroll: true });
  }, [paceRunning, pickedLineIdx]);
  // Alt+↑ / Alt+↓ — 문장이 지정된 동안의 키보드 이동(입력란·모달·조합 중에는 무시).
  // 막대 버튼과 같은 moveSentence라 집중 모드에서는 순수 이동이다.
  const sentenceKeyRef = useRef({});
  sentenceKeyRef.current = {
    // 수업 모드는 자기 도크·판 경로가 있다 — 이 단축키·막대는 기본 뷰어에서만(V2 §0.2 수업 경로 보존).
    active: pickedLineIdx !== null && sentences.length > 0 && !classStudyActive,
    blocked: modalBlocked || tokenRange.dragging, // 설정·받아쓰기·읽기 확인 등은 모두 activeModal — modalBlocked에 든다
    move: moveSentence,
  };
  useEffect(() => {
    function onKeyDown(e) {
      if (!e.altKey || e.metaKey || e.ctrlKey || e.shiftKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      const h = sentenceKeyRef.current;
      if (!h.active || h.blocked || e.defaultPrevented || e.isComposing || e.repeat) return;
      if (e.target?.closest?.('input, textarea, select, [contenteditable="true"], [role="textbox"], dialog')) return;
      e.preventDefault();
      h.move(e.key === 'ArrowUp' ? -1 : 1);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
  const pickedPosition = pickedSentence ? sentences.indexOf(pickedSentence) + 1 : 0;
  const sentenceMoveBar = pickedSentence ? (
    <div ref={moveBarRef} className="sentence-move-bar" role="toolbar" aria-label={vt('문장 이동')} aria-orientation="horizontal"
      onFocus={e => { moveBarFocus.current = e.target; }}
      onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMoveBar(); } }}>
      {sentenceNavBtn(-1, 'sentence-move-bar__btn')}
      <span className="sentence-move-bar__pos" role="status">{pickedPosition} / {sentences.length}</span>
      {sentenceNavBtn(1, 'sentence-move-bar__btn')}
      {autoPace&&paceToggle('sentence-move-bar__btn sentence-move-bar__pace')}
      <button type="button" className="sentence-move-bar__translate" title={vt('이 문장 번역 보기')} onClick={translatePickedSentence}>{vt('번역')}</button>
      <button type="button" className="sentence-move-bar__btn sentence-move-bar__close" aria-label={vt('문장 지정 해제')} title={vt('문장 지정 해제')} onClick={closeMoveBar} data-icon-action><ActionIcon name="close"/></button>
    </div>
  ) : null;



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
  const inlineReview = useInlineReview({ user, fetchProfile, toast });
  const selectedVocab = findSavedVocab(savedWords, selectedToken, materialLang);
  const selectedExclusion = findVocabularyExclusion(exclusionState.rows, {
    vocabularyId: selectedVocab?.id, language: materialLang, word: exclusionWord(selectedToken),
  });
  const selectedKnownKeys = knownWordKeys(knownState.rows, knownLangCode, selectedVocab || selectedToken, exclusionState.rows);
  const selectedKnown = selectedKnownKeys.length > 0;
  const selectedExcluded = selectedKnown || (exclusionState.isSuccess ? !!selectedExclusion : !!selectedVocab?.is_excluded);
  const selectedKnownWord = exclusionWord(selectedVocab || selectedToken);
  const knownPending = knownState.isPendingWord(knownLangCode, selectedKnownWord);
  const wordStateReady = savedWords.complete === true && !learningCapabilities.isLoading && learningStorageSupported && exclusionState.isSuccess && (!knownLangCode || knownState.isSuccess);
  // 다른 단어의 원격 저장이 진행 중이어도 현재 단어를 평가할 수 있다.
  const inlineReviewMutation = { ...inlineReview,
    isPending: pendingInlineGrades.has(`${user?.id}:${selectedVocab?.id}`),
  };

  const correctTokenMutation = useMutation({
    mutationFn: async ({ tokenId, corrections }) => {
      if (!legacyTokenEditingAllowed || !legacyTokenEditingAllowedRef.current) {
        throw new Error('한국어 분석의 뜻은 이 편집 기능으로 수정할 수 없어요.');
      }
      const currentJson = material?.processed_json;
      if (!currentJson?.dictionary?.[tokenId]) throw new Error('토큰을 찾을 수 없습니다.');

      const beforeToken = currentJson.dictionary[tokenId];
      const updatedDict = {
        ...currentJson.dictionary,
        // 뜻을 교정하면 「뜻 확인 필요」 표식(meaningCheck)도 지운다(AD-R4 §6.2·§7) — 같은 PATCH 한 번.
        [tokenId]: applyTokenCorrections(beforeToken, corrections),
      };
      const updatedJson = { ...currentJson, dictionary: updatedDict };

      if (passageOf(material)) {
        const record = await correctPassageToken(supabase, material, tokenId, corrections);
        queryClient.setQueryData(['material', id], record);
      } else {
        const { error } = await supabase.from('reading_materials')
          .update({ processed_json: updatedJson }).eq('id', id);
        if (error) throw error;
        // 다시 받기 전에 다음 교정이 낡은 자료(이 교정 전)를 통째로 덮어쓰지 않게 캐시에 저장한 값을 바로 둔다
        // (AD-R4 목록은 여러 줄을 잇달아 고친다). 무효화·다시 받기는 아래 onSuccess가 그대로 한다.
        queryClient.setQueryData(['material', id], (prev) => (prev ? { ...prev, processed_json: updatedJson } : prev));
      }

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
    onSuccess: ({ tokenId, corrections }, variables) => {
      // 교정된 뜻이 캐시된 분석 결과에 남아 낡지 않게 무효화(§C4 무효화 규칙)
      if (isClient) clearAnalysisCache(localStorage);
      queryClient.invalidateQueries({ queryKey: ['material', id] });
      queryClient.invalidateQueries({ queryKey: ['token-corrections', id, tokenId] });
      if (!legacyTokenEditingAllowed || !legacyTokenEditingAllowedRef.current) return;
      // BottomSheet에 표시되는 selectedToken도 업데이트
      setSelectedToken(prev => prev?.id === tokenId ? applyTokenCorrections(prev, corrections) : prev);
      // 사전 뜻 줄 교정(AE-R1 PR③)은 카드 안 「뜻을 바꿨어요 · 되돌리기」 줄이 알린다 — 토스트를 겹치지 않는다.
      if (!variables?.quiet) toast('수정이 저장됐어요!', 'success');
    },
    onError: (err) => toast('수정 실패 — ' + friendlyToastMessage(err), 'error'),
  });

  // AD-R3 PR③ 묶기·나누기·되돌리기 쓰기 — boundaryEditFlow 하나(그 줄만 /api/analyze boundaries → viewer_replace_analysis
  // 원자 교체(원문 그대로) + token_corrections 이력 1행). 단어장·FSRS·평가 이력·개인 뜻·출처·사전·전역 승격 호출 0(§4.2).
  // correctTokenMutation(기대값 비교 없는 PATCH)을 쓰지 않는다 — 경계는 sequence를 바꾸므로 분석 저장과 경합하면 안 된다(§1.3).
  const analyzeBoundaryLine = async (body) => {
    let authHeader = {};
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) authHeader = { Authorization: `Bearer ${session.access_token}` };
    } catch { /* 비로그인은 소유자가 아니라 여기 오지 않는다 */ }
    const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data;
  };
  const boundaryMutation = useMutation({
    mutationFn: async ({ request, undo }) => {
      if (!legacyTokenEditingAllowedRef.current && !koreanSplitAllowedRef.current) throw new BoundaryEditError('korean');
      const current = queryClient.getQueryData(['material', id]) || material;
      const deps = { client: supabase, analyze: analyzeBoundaryLine, userId: user?.id };
      if (undo) return { ...(await undoBoundaryEdit(current, undo, deps)), kind: 'undo' };
      return commitBoundaryEdit(current, request, deps);
    },
    onSuccess: (out) => {
      if (!out) return;
      queryClient.setQueryData(['material', id], out.material);
      if (isClient) clearAnalysisCache(localStorage); // 드래그 단어 목록 캐시가 옛 분할을 돌려주지 않게(§1.4)
      queryClient.invalidateQueries({ queryKey: ['material', id] });
      tokenRange.clearRange();
      setBoundaryPanel(null);
      const token = out.material?.processed_json?.dictionary?.[out.selectId];
      if (token) {
        // 본문 토큰을 누른 것과 같은 카드(handleTokenClick) — 옛 분할의 드래그 단어 목록은 닫는다(묶은 뒤 카드 목업: 하단 고정).
        detailGate.current.cancel();
        selectionGate.current.cancel();
        setLeftPanelLoading(false);
        setDragAnalyzing(false);
        setDragTokens(null);
        resetWordPanelScroll();
        setSelectedToken({ ...token, id: out.selectId });
        setIsSheetOpen(true);
        setWordDetail(null);
        setInspectChar(null);
        setIsEditingToken(false);
        setRightSheetSignal(s => s + 1);
      }
      setBoundaryUndo(out.kind === 'undo' ? null : { tokenId: out.selectId, kind: out.kind, undo: out.undo });
    },
    onError: (err) => {
      const text = err?.code === '40001' ? vt('다른 창에서 자료가 바뀌었어요. 다시 열어 확인해 주세요.')
        : err instanceof BoundaryEditError && err.reason !== 'analysis_mismatch' ? vt(...boundaryReasonMessage(err.reason))
          : vt('단어 경계를 적용하지 못했어요. 잠시 뒤 다시 해 주세요.');
      toast(text, 'error');
    },
  });
  // AD-R4 PR④ 경계 후보 [아니요] — 그 꼴을 이 자료에서 접는다(metadata.viewerBoundaryDismissed). 묶기·나누기와 같은 원자 RPC 하나,
  // 토큰·기록·단어장·FSRS·사전 쓰기 0. 재분석은 원래 metadata를 이어 쓰므로 접은 꼴은 재분석 뒤에도 접힌 채다.
  const boundaryDismissMutation = useMutation({
    mutationFn: async (form) => {
      if (!legacyTokenEditingAllowedRef.current) throw new BoundaryEditError('korean');
      const current = queryClient.getQueryData(['material', id]) || material;
      return dismissBoundarySuggestion(current, form, { client: supabase });
    },
    onSuccess: (out) => {
      if (!out?.material) return;
      queryClient.setQueryData(['material', id], out.material);
      queryClient.invalidateQueries({ queryKey: ['material', id] });
    },
    onError: (err) => toast(err?.code === '40001' ? vt('다른 창에서 자료가 바뀌었어요. 다시 열어 확인해 주세요.') : vt('저장하지 못했어요. 잠시 뒤 다시 해 주세요.'), 'error'),
  });
  // 다른 단어를 열거나 시트를 닫으면 ⋯ 패널·되돌리기 줄을 닫는다(드래그 확인 줄은 드래그 범위가 정한다).
  useEffect(() => {
    setBoundaryPanel(panel => (panel?.kind === 'drag' || (panel && panel.tokenId === selectedToken?.id && isSheetOpen) ? panel : null));
    setBoundaryUndo(undo => (undo && undo.tokenId === selectedToken?.id && isSheetOpen ? undo : null));
  }, [selectedToken?.id, isSheetOpen]);




  // 교정 전역 적용(링큐식) — 공유 사전 승격(user_verified) + 내 단어장 동기.
  // 실패해도 이 자료의 교정(correctTokenMutation)은 이미 반영돼 있다(부분 성공 허용).
  const promoteCorrection = async (token, corrections) => {
    if (!legacyTokenEditingAllowed || !legacyTokenEditingAllowedRef.current) return;
    try {
      let authHeader = {};
      const { data: { session } } = await supabase.auth.getSession();
      if (!legacyTokenEditingAllowed || !legacyTokenEditingAllowedRef.current) return;
      if (session?.access_token) authHeader = { Authorization: `Bearer ${session.access_token}` };
      const res = await fetch('/api/dict-correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          // 서버는 이 자료의 소유자(또는 관리자)·이 자료에 있는 단어인지 확인한 뒤에만 승격한다.
          material_id: id,
          base_form: token.sep_link || token.base_form || token.text,
          language: materialLang,
          corrections,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!legacyTokenEditingAllowed || !legacyTokenEditingAllowedRef.current) return;
      const vocab = findSavedVocab(savedWords, token, materialLang);
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
  const [teachingDisplay,setTeachingDisplay]=useWordAppearance(user?.id,materialLang);
  const [hanjaKoTable, setHanjaKoTable] = useState(null);
  const [hanjaHunTable, setHanjaHunTable] = useState(null);
  const [hanjaJaTable, setHanjaJaTable] = useState(null);
  // AE-R4 PR②(VIEWER-V2-ROUNDS-001 §9 · 설계서 docs/manabi-viewer-v2-ae-r4.md §8 · §11.4): 중국어 일반 모드에서 표제어 글자를
  // 누르면 글자 카드 대신 한자 창(ViewerHanjaPopover)이 뜬다. 일본어 자료·수업 판서(classStudyActive)는 글자 카드 그대로(Q2).
  const hanjaPopoverMode = materialLang === 'Chinese' && !classStudyActive;
  const [hanjaPanelTable, setHanjaPanelTable] = useState(null);
  // T1: 중국어 자료를 열면 유휴 시간에 한자 창 표(hanjaPanel.json, ≈31KB gzip)를 받아 둔다 — 정체 표(AE-R3)와 같은 시점.
  useEffect(() => {
    if (materialLang !== 'Chinese' || hanjaPanelTable) return undefined;
    let alive = true;
    const cancel = prefetchHanjaPanel({ onLoad: (t) => { if (alive && t) setHanjaPanelTable((cur) => cur || t); } });
    return () => { alive = false; cancel(); };
  }, [materialLang, hanjaPanelTable]);
  // 미리 받기 전에 창이 열리면 바로 받는다.
  useEffect(() => {
    if (!hanjaPopoverMode || !inspectChar || hanjaPanelTable) return undefined;
    let alive = true;
    loadHanjaPanelTable().then((t) => { if (alive) setHanjaPanelTable((cur) => cur || t); }).catch(() => {});
    return () => { alive = false; };
  }, [hanjaPopoverMode, inspectChar, hanjaPanelTable]);
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

    return () => { alive = false; };
  }, [showHanjaKo, materialLang, hanjaKoTable, inspectChar]);
  // AE-R4 PR②(설계서 §8 · §11.2): 한자 창 머리·조각·타일이 훈음 표를 쓰므로 중국어 단어창을 처음 열 때 유휴 시간에 받아 둔다
  // (첫 탭 T1 0.3초). 한자 대조 토글·글자 탭 조건의 즉시 로드(위)는 그대로다.
  useEffect(() => {
    if (materialLang !== 'Chinese' || !isSheetOpen || hanjaKoTable) return undefined;
    let alive = true;
    const cancel = onIdle(() => {
      import('../lib/data/hanjaKo.json').then((m) => { if (alive) setHanjaKoTable((cur) => cur || m.default || m); }).catch(() => {});
      import('../lib/data/hanjaHun.json').then((m) => { if (alive) setHanjaHunTable((cur) => cur || m.default || m); }).catch(() => {});
    });
    return () => { alive = false; cancel(); };
  }, [materialLang, isSheetOpen, hanjaKoTable]);
  // R0+: 중국어 훈음은 정체 꼴로 찾는다(技术 → 재주 술) — 같은 조건에서 정체 표도 지연 로드.
  // AE-R3 PR②(설계서 §8): 정체 표는 자형 열 正 줄도 쓴다 — 단어창을 열면(isSheetOpen) 바로, 그 전에는 아래 유휴 미리 받기.
  const [hanjaTradTable, setHanjaTradTable] = useState(null);
  useEffect(() => {
    if (materialLang !== 'Chinese' || hanjaTradTable || !(showHanjaKo || inspectChar !== null || isSheetOpen)) return undefined;
    let alive = true;
    import('../lib/data/hanjaTrad.json')
      .then((m) => { if (alive) setHanjaTradTable(m.default || m); })
      .catch(() => {});
    return () => { alive = false; };
  }, [showHanjaKo, materialLang, hanjaTradTable, inspectChar, isSheetOpen]);
  // 자형 열 日 줄의 일본어 표기 표(JMdict 파생 jaWords.json, CC BY-SA 4.0) — 정체 표와 함께 T1(설계서 §2.2·§8):
  // 중국어 자료를 열면 유휴 시간에 두 표를 미리 받는다. 한국어·일본어·영어 자료는 받지 않는다.
  const [jaWordsTable, setJaWordsTable] = useState(null);
  useEffect(() => {
    if (materialLang !== 'Chinese') return undefined;
    let alive = true;
    const cancel = prefetchGlyphTables({ onLoad: ({ zheng, jaWords }) => {
      if (!alive) return;
      if (zheng) setHanjaTradTable((cur) => cur || zheng);
      if (jaWords) setJaWordsTable((cur) => cur || jaWords);
    } });
    return () => { alive = false; cancel(); };
  }, [materialLang]);
  useEffect(() => {
    if (materialLang !== 'Chinese' || !isSheetOpen || jaWordsTable) return undefined;
    let alive = true;
    loadJaWordsTable().then((t) => { if (alive) setJaWordsTable(t); }).catch(() => {});
    return () => { alive = false; };
  }, [materialLang, isSheetOpen, jaWordsTable]);
  // 일본식 자형 표(hanjaJa)는 글자 카드 日 칩만 쓴다 — 단어창(日 줄)은 확인된 표기만 보이므로 시트를 열 때 받지 않는다(설계서 §8).
  useEffect(() => {
    if (hanjaJaTable || !inspectChar) return undefined;
    if (hanjaPopoverMode) return undefined; // 한자 창은 日 꼴을 보이지 않는다(설계서 §8 — 일본어 자료·수업 판서 글자 카드만)
    let alive = true;
    import('../lib/data/hanjaJa.json').then(m => {if(alive)setHanjaJaTable(viewerJapaneseGlyphTable(m.default||m));}).catch(()=>{});
    return ()=>{alive=false;};
  }, [inspectChar,hanjaJaTable,hanjaPopoverMode]);
  // 자원 테이블(증강 R2·R3 — 획수·부수·1단 분해·간번체, 563KB)과 구성 풀이 스토리
  // (R4 — 최빈 시드 저작분)는 글자 카드가 실제로 열릴 때만 지연 로드 — 한자 대조
  // 토글만으로는 안 부른다(단어 줄엔 자원이 안 쓰인다).
  const [hanjaEtymTable, setHanjaEtymTable] = useState(null);
  const [hanjaStoryTable, setHanjaStoryTable] = useState(null);
  useEffect(() => {
    // AE-R4 PR②: 중국어 일반 모드는 한자 창이라 자원·스토리 표(165KB gzip)를 받지 않는다(설계서 §8).
    if (inspectChar === null || hanjaEtymTable || hanjaPopoverMode) return undefined;
    let alive = true;
    import('../lib/data/hanjaEtym.json')
      .then((m) => { if (alive) setHanjaEtymTable(m.default || m); })
      .catch(() => {});
    import('../lib/data/hanjaStory.json')
      .then((m) => { if (alive) setHanjaStoryTable(m.default || m); })
      .catch(() => {});
    return () => { alive = false; };
  }, [inspectChar, hanjaEtymTable, hanjaPopoverMode]);
  // 한자 창 입력(AE-R4 PR②) — 표·내 단어·우리 사전 색인. 참조가 바뀔 때만 창이 다시 고른다.
  const hanjaPopTables = useMemo(() => ({ koTable: hanjaKoTable, hunTable: hanjaHunTable, tradTable: hanjaTradTable, panel: hanjaPanelTable }),
    [hanjaKoTable, hanjaHunTable, hanjaTradTable, hanjaPanelTable]);
  const savedRowList = useMemo(() => [...(savedWords.byKey?.values() || [])], [savedWords]);
  const refVocabIndex = useRefVocabIndex(hanjaPopoverMode ? materialLang : null);
  const hanjaHunOf = (text) => (
    materialLang === 'Chinese' && showHanjaKo && hanjaKoTable && hanjaHunTable && hanjaTradTable
      ? hunRubyCells(text, { koTable: hanjaKoTable, hunTable: hanjaHunTable, tradTable: hanjaTradTable }, HUN_RUBY_CELL)
      : null
  );
  // 우리 사전(레퍼런스 어휘) 연동(②) — 급수 뱃지 + 정본 뜻·예문·한자 노트 자동 표시
  // 어휘 키 — 이합사 O 조각(sep_link)은 VO로 조회·저장·표시한다. base_form은 만남 기록 전용으로 남긴다.
  const selectedLexKey = selectedToken?.sep_link || selectedToken?.base_form;
  // 첫 화면 우선 단계(AE-R3 PR② — 아래 cardSentence 주석) — 카드(토큰 · 기본형)마다 따로, 오르기만 한다.
  const glyphCardKey = selectedToken ? `${selectedToken.id || selectedToken.text}:${selectedLexKey || ''}` : '';
  const [glyphBudget, setGlyphBudget] = useState({ key: '', step: 0, zhengBelow: false });
  const glyphStep = glyphBudget.key === glyphCardKey ? glyphBudget.step : 0;
  const glyphZhengBelow = glyphBudget.key === glyphCardKey && glyphBudget.zhengBelow;
  const raiseGlyphBudget = useCallback((key, step) => setGlyphBudget((cur) => (cur.key === key && cur.step >= step ? cur : { key, step, zhengBelow: cur.key === key && cur.zhengBelow })), []);
  const glyphZhengMiss = useCallback((key) => setGlyphBudget((cur) => (cur.key === key && cur.zhengBelow ? cur : { key, step: cur.key === key ? cur.step : 0, zhengBelow: true })), []);
  const refVocab = useRefVocabEntry(materialLang, selectedLexKey || selectedToken?.text);
  // 본문 문맥(수동 교정 포함)이 카드와 저장의 기준. 사전의 다른 뜻은 접어 구분한다.
  const refMeaning = contextualMeaning(selectedToken) || null;
  const referenceMatches = referenceMatchesContext(selectedToken, refVocab?.word);

  // 뜻·발음 수동 편집(링큐식) — 자료 소유자만(materials update RLS가 소유자 한정).
  // 중국어 카드에서는 현재 뜻에 맞는 일본어 대응을 함께 조회한다. 한자 훈음 토글과 독립적이다.
  const [isEditingToken, setIsEditingToken] = useState(false);
  const canEditToken = !!user?.id && user.id === material?.owner_id;
  const toggleTokenEditing = () => {
    if (legacyTokenEditingAllowedRef.current) setIsEditingToken(value => !value);
  };
  // 편집 중 다른 토큰을 탭하면 편집을 닫는다 — 이전 단어의 편집 상태가 새 단어로
  // 이어지는 혼선 차단(마감 ③). 같은 토큰의 교정 반영(id 불변)에는 발화하지 않는다.
  useEffect(() => { setIsEditingToken(false); }, [selectedToken?.id]);
  useEffect(() => {
    if (!canEditToken || !legacyTokenEditingAllowed) setIsEditingToken(false);
  }, [canEditToken, legacyTokenEditingAllowed]);
  // AE-R1 PR③(VIEWER-V2-ROUNDS-001 §2.1 · 설계서 §3.4): 사전 뜻 줄 교정과 ⋯ 메뉴는 ✎와 같은 권한 — 자료 소유자 ·
  // 자료 토큰(id) · 비한국어 · 저장 지원. 수업 모드는 표시만(Q3). 열람자 개인 교정은 새 범위라 하지 않는다(설계서 §10.3).
  const senseEditable = canEditToken && !!selectedToken?.id && legacyTokenEditingAllowed && learningStorageSupported && !classStudyActive;
  const openTokenEditing = () => {
    if (!legacyTokenEditingAllowedRef.current) return;
    setBoundaryPanel(null); // AD-R3 ⋯ 패널(옆 단어와 묶기·나누기)과 편집 패널은 한 번에 하나
    setIsEditingToken(true);
  };
  // 「뜻을 바꿨어요 · 되돌리기」 — 그 토큰을 다시 열 때까지(다른 단어·시트 닫기에서 지운다). before = 바꾼 칸의 이전 값.
  const [senseUndo, setSenseUndo] = useState(null); // { tokenId, before, corrections }
  useEffect(() => { setSenseUndo(null); }, [selectedToken?.id, isSheetOpen]);
  // ── AD-R4 PR③ 「뜻 확인 필요 N개」(설계서 docs/manabi-viewer-v2-ad-r4.md §6·§7) ──
  // 재료 = 토큰 내부 표식 meaningCheck(서버 상수 ZH_SENSE_REVIEW가 켜졌을 때만 붙음 — 꺼진 지금은 0). 중국어만.
  // 목록은 시트 [문장] 탭 자리에 열리고(새 화면 아님), 연 순간의 토큰 id를 붙들어 고친 줄도 그 자리에 남긴다.
  const senseReviewList = useMemo(() => senseReviewItems(material?.processed_json, materialLang), [material?.processed_json, materialLang]);
  const senseReviewKey = senseReviewDismissKey(id, material?.processed_json);
  const [senseReviewDismissed, setSenseReviewDismissed] = useState(null); // 닫은 키(그 자료의 그 viewerRevision)
  useEffect(() => {
    let stored = null;
    try { stored = localStorage.getItem(senseReviewKey) ? senseReviewKey : null; } catch { stored = null; }
    setSenseReviewDismissed(stored);
  }, [senseReviewKey]);
  const dismissSenseReview = () => {
    setSenseReviewDismissed(senseReviewKey);
    try { localStorage.setItem(senseReviewKey, '1'); } catch { /* 개인 편의 — 실패해도 이번 화면에서는 닫힌다 */ }
  };
  const [senseReviewIds, setSenseReviewIds] = useState(null); // null = 목록 닫힘
  const senseReviewOpen = senseReviewIds !== null;
  useEffect(() => { setSenseReviewIds(null); }, [id]);
  // 경계 후보(AD-R4 PR④) 줄은 연 순간의 스냅숏 객체로 붙든다 — 묶거나 접은 뒤에도 그 자리에 「묶었어요」/「확인했어요」로 남게.
  const [suggestConfirm, setSuggestConfirm] = useState(null); // [묶기]로 확인 줄을 연 경계 후보 줄 id
  const senseReviewTokens = (senseReviewIds || []).filter((entry) => typeof entry === 'string').map((tokenId) => {
    const token = material?.processed_json?.dictionary?.[tokenId];
    return token ? { ...token, id: tokenId } : null;
  }).filter(Boolean);
  // 후보 = 카드와 같은 사전 행 캐시(['token-dict', lang, key]). 새 읽기 경로 없이 자료를 열 때의 일괄 조회(prefetchTokenDict)가
  // 채운 값을 구독만 하고, 비어 있는 키만 같은 일괄 조회로 받는다. 실패하면 후보 없이 [이대로 둘게요]만 남는다.
  const senseReviewDictKeys = [...new Set(senseReviewTokens.map(tokenDictKeyOf).filter(Boolean))];
  const senseReviewDictSignature = senseReviewOpen ? `${materialLang}\u0000${senseReviewDictKeys.join('\u0000')}` : '';
  const [senseReviewDictFailed, setSenseReviewDictFailed] = useState('');
  useEffect(() => {
    if (!senseReviewDictSignature) return;
    let alive = true;
    prefetchTokenDict({ supabase, queryClient, language: materialLang, keys: senseReviewDictKeys })
      .then((r) => { if (alive && r.failed) setSenseReviewDictFailed(senseReviewDictSignature); })
      .catch(() => { if (alive) setSenseReviewDictFailed(senseReviewDictSignature); });
    return () => { alive = false; };
    // senseReviewDictKeys는 signature가 대표한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [senseReviewDictSignature, queryClient, materialLang]);
  const senseReviewDict = useQueries({
    queries: (senseReviewOpen ? senseReviewDictKeys : []).map((key) => ({ queryKey: tokenDictQueryKey(materialLang, key), enabled: false })),
  });
  const selectedDictKey=selectedLexKey||selectedToken?.text;
  const { data: editDictEntry, isFetched: dictFetched, isError: dictError } = useQuery({
    queryKey: ['token-dict', materialLang, selectedDictKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('morpheme_dictionary')
        .select('meanings, reading, pos')
        .eq('language', materialLang)
        .eq('base_form', selectedDictKey)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    // R R2: 표제어가 기본형(이합사 VO·활용형 사전형)이면 그 읽기를 사전 reading에서 가져온다 —
    // 조각의 furigana에는 자기 글자 읽기뿐(dào)이라 기본형 전체 읽기의 정본은 사전 행이다.
    enabled: materialLang !== 'Korean' && (isEditingToken || (isSheetOpen && materialLang === 'Chinese') || (!!selectedToken && !!selectedLexKey && selectedLexKey !== selectedToken.text)) && !!selectedDictKey,
    staleTime: 1000 * 60,
  });
  // AE-R1 §5.3: 자료를 열 때 고유 표제어를 100개씩 받아 위 조회와 같은 캐시 키를 미리 채운다(화면 출력 무변경).
  useTokenDictPrefetch({ supabase, queryClient, language: materialLang, processedJson: material?.processed_json,
    enabled: tokenDictPrefetchEnabled({ user, language: materialLang, processedJson: material?.processed_json, status: material?.status }) });
  // R R2 표제어 — 표면 ≠ 기본형(이합사 조각 道→道歉·歉→道歉, 활용형 食べた→食べる)이면 카드
  // 표제어를 기본형으로 쓰고 탭한 구간만 강조한다. 뜻·유의어·예문·日 대응이 전부 기본형의
  // 것인데 표제어만 표면이면 「길 도」 밑에 「사과하다」가 선다(오너 보고 2026-09-02).
  // 토큰 데이터(text·base_form·furigana·분할)는 한 바이트도 안 바뀐다 — 렌더만(R4a 무충돌).
  const headText = selectedToken && selectedLexKey && selectedLexKey !== selectedToken.text ? selectedLexKey : selectedToken?.text;
  const headIsBase = !!selectedToken && headText !== selectedToken.text;
  const headReading = headIsBase ? (editDictEntry?.reading || null) : selectedToken?.furigana;
  // 사전 행이 없으면 기본형을 루비 없이 세우고 메타에 「기본형 …」 라벨 — 조회가 끝난 뒤에만(깜빡임 방지)
  const headFallback = headIsBase && dictFetched && !editDictEntry?.reading;
  const headPicked = headIsBase ? pickedRangeOf(headText, selectedToken.text) : null;

  function readingContextSource(token) {
    if (materialLang === 'Korean') {
      if (!token) return null;
      const source = koreanSources.scope === koreanSourceScope && koreanSources.byToken[token.id];
      return source?.surface === token.text ? source : null;
    }
    const original = material?.processed_json?.dictionary?.[token.id];
    if (original?.text === token.text) return { kind: 'reading', materialId: id, tokenId: token.id };
    const quote = ctxSentenceOf(token) ?? leftPanelText;
    return quote ? { kind: 'reading', materialId: id, quote, surface: token.text } : null;
  }

  function contextWord(token, grade) {
    const meaning = materialLang === 'Korean'
      ? (token.id === selectedToken?.id && token.text === selectedToken?.text ? localizedWord.meaning
        : (token.meaningLocale || token.explanationLocale || material?.processed_json?.metadata?.explanationLocale || 'ko') === effectiveExplanationLocale ? token.meaning : '')
      : token.meaning;
    return buildVocabRow({ userId: user?.id, surface: token.text, base: token.sep_link || token.base_form,
      meaning, language: materialLang, reading: token.furigana || token.reading, pos: token.pos, grade });
  }

  function koreanSaveReady(token) {
    return materialLang !== 'Korean' || (!!token && !koreanBoundaryPiece(material?.processed_json, token.id) && !!readingContextSource(token) && !!contextWord(token).meaning
      && !(token.id === selectedToken?.id && (localizedWord.loading || localizedWord.error)));
  }

  // AD-R3 §7.5 한국어 나눈 조각의 뜻 줄 — 형태소 하나면 그 설명, 여러 개(합친 꼴)면 공식. 형태 분석 언어가 지금 설명 언어와
  // 다르면 다른 언어 설명을 보이지 않고 안내만(문맥 설명 AI 오버레이를 부르지 않는다).
  function koreanPieceMeaning(token) {
    const pieceLocale = token?.explanationLocale || token?.meaningLocale || material?.processed_json?.metadata?.explanationLocale || 'ko';
    if (pieceLocale !== effectiveExplanationLocale) return vt('이 조각 설명은 분석한 설명 언어로만 있어요.');
    const morphemes = koreanMorphemes(token);
    const formula = morphemes.length > 1 ? koreanFormula({ text: token.text, morphemes }) : null;
    return formula ? koreanFormulaText(formula) : token?.meaning || '';
  }
  // 공식 「했어요 = 하다 + -였- + -어요 (줄어든 꼴)」 — 꼴 이름만 화면 언어(vt), 형태는 한글 그대로.
  function koreanFormulaTail(formula) {
    return `= ${formula.terms.join(' + ')}${formula.kind ? ` (${formula.kind === 'contracted' ? vt('줄어든 꼴') : vt('모양이 바뀐 꼴')})` : ''}`;
  }
  function koreanFormulaText(formula) {
    return formula ? `${formula.surface} ${koreanFormulaTail(formula)}` : null;
  }

  async function saveKoreanVocabulary(token, grade) {
    if (!learningCapabilities.save || !wordStateReady || !koreanSaveReady(token)) return null;
    const scope = koreanSaveDisplayScope.current, accountId = user.id;
    try {
      const result = await saveContext({ word: contextWord(token), source: readingContextSource(token),
        ...(Number.isInteger(grade) && grade >= 1 && grade <= 4 ? { initialGrade: grade } : {}) });
      if (result.vocabulary) insertConfirmedVocabulary(queryClient, accountId, result.vocabulary);
      for (const key of ['vocab-words', 'vocab', 'vocabulary-contexts', 'book-review']) {
        queryClient.invalidateQueries({ queryKey: [key, accountId] });
      }
      if (koreanSaveDisplayScope.current !== scope) return result;
      setKoreanSaveConflict(null);
      // The atomic RPC may reuse a card. Never manufacture an INSERT/undo snapshot.
      lastSaveRef.current = null;
      toast(`"${token.text}" 저장!`, 'success');
      return result;
    } catch (error) {
      if (koreanSaveDisplayScope.current !== scope) return null;
      if (error.code === 'meaning_conflict') setKoreanSaveConflict({ tokenId: token.id, text: token.text });
      else toast('저장 실패 — ' + friendlyToastMessage(error), 'error');
      return null;
    }
  }

  // 등급 저장은 기존 조립기·undo를 유지한다. 문맥만 추가하는 RPC는 이미 저장한 FSRS를 수정하지 않는다.
  // 연결 실패는 카드 저장 실패와 구분하고, 저장된 카드의 문맥 추가 버튼으로 재시도할 수 있다.
  async function attachReadingContext(token) {
    try {
      await saveContext({ word: contextWord(token), source: readingContextSource(token) });
      queryClient.invalidateQueries({ queryKey: ['vocabulary-contexts', user?.id] });
      return true;
    } catch (error) {
      toast(error.code==='meaning_conflict'
        ? '기존 카드와 뜻이 달라 문맥을 합치지 않았어요. 이 문맥 추가에서 뜻을 확인해 주세요.'
        : '단어는 저장했지만 문맥 연결이 남아 있어요. 단어를 다시 열어 문맥 추가를 눌러 주세요.', 'warning', 6000);
      return false;
    }
  }

  const saveInlineVocabulary = async (token) => {
    if (!learningStorageSupported || !koreanSaveReady(token)) return;
    const key = token.sep_link || token.base_form || token.text;
    if (inlineSaving[key]) return;
    setInlineSaving(prev => ({ ...prev, [key]: true }));
    try {
      if (materialLang === 'Korean') { await saveKoreanVocabulary(token); return; }
      await upsertViewerVocabulary(buildVocabRow({
        userId: user.id,
        surface: token.text,
        base: token.base_form,
        meaning: token.meaning,
        pos: token.pos,
        reading: token.furigana || token.reading,   // 영어는 IPA, 중국어는 병음
        language: materialLang,
      }));
      const linked = await attachReadingContext(token);
      if (linked) toast(`"${token.text}" 저장!`, 'success');
      queryClient.invalidateQueries({ queryKey: ['vocab-words', user?.id] });
    } catch {
      toast('저장 실패', 'error');
    } finally {
      setInlineSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  // W R1 undo — 이번에 새로 넣은 행 하나만 delete(단일 레벨). upsert 응답 전엔 lastSaveRef가
  // 비어 있어 자연히 무시된다(경쟁 조건 차단).
  const undoLastSave = async (snapshot = lastSaveRef.current) => {
    if (!snapshot || undoBusy.current) return;
    if (snapshot !== lastSaveRef.current) { toast('가장 최근 저장만 취소할 수 있어요.', 'info'); return; }
    undoBusy.current = true;
    try {
      await undoViewerSave(supabase, snapshot, user?.id);
      if (lastSaveRef.current === snapshot) lastSaveRef.current = null;
      queryClient.invalidateQueries({ queryKey: ['vocab-words', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['vocab', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['vocabulary-contexts', user?.id] });
      toast(`"${snapshot.text}" 저장을 취소했어요`, 'info');
    } catch (err) {
      toast('취소 실패 — ' + friendlyToastMessage(err), 'error');
    } finally { undoBusy.current = false; }
  };

  // W R3㉮ 인라인 복습 — 4등급 정본. 스냅샷은 훅이 돌려준 prev·reviewedAt으로 호출부가 만든다.
  const gradeInline = (rating) => {
    if (koreanPieceSelected) return; // AD-R3 §7.5: 한국어 나눈 조각은 등급 대상이 아니다(키 1~4 포함)
    const vocab = findSavedVocab(savedWords, selectedToken, materialLang);
    if (!learningCapabilities.review || !vocab || !isTokenInlineDue(savedWords, selectedToken, materialLang) || selectedExcluded || !wordStateReady || knownPending || exclusionState.mutation.isPending || inlineReviewMutation.isPending) return;
    const requestKey = `${user.id}:${vocab.id}`;
    if (inlineGradeRequests.current.has(requestKey)) return;
    inlineGradeRequests.current.add(requestKey);
    setPendingInlineGrades(prev => new Set(prev).add(requestKey));
    const action = ++gradeAction.current;
    lastInlineGradeRef.current = null;
    lastSaveRef.current = null;
    const gradeScope = saveScopeRef.current;
    const handlers = {
      onSuccess: (res) => {
        if (saveScopeRef.current !== gradeScope || gradeAction.current !== action) return;
        lastInlineGradeRef.current = {
          wordId: vocab.id, itemKey: vocab.word_text, word: vocab.word_text,
          lang: vocab.language || detectLang(vocab.word_text), rating,
          prev: res.prev, reviewedAt: res.reviewedAt, expiresAt: Date.now() + 8000,
          queued: !!res.queued, // 오프라인 큐에 담긴 채점 — undo는 큐 항목 제거(W 후속 ③)
        };
      },
    };
    // 연속 mutate의 단발 콜백은 교체된다. 각 Promise에서 완료와 잠금 해제를 처리한다.
    inlineReviewMutation.mutateAsync({ vocab, rating, userId: user.id }).then(handlers.onSuccess).catch(() => {})
      .finally(() => {
        inlineGradeRequests.current.delete(requestKey);
        setPendingInlineGrades(prev => { const next = new Set(prev); next.delete(requestKey); return next; });
      });
  };
  // undo = R2 모델 그대로(SRS 5필드 복원 + source:'ui' 보상 이벤트). 세션이 없으니 되감을 것은
  // 카드 상태뿐 — vocab-words를 무효화하면 isTokenDue가 다시 참이 되어 「복습 시점이에요」가 저절로 돌아온다.
  const undoInlineGrade = async () => {
    const last = lastInlineGradeRef.current;
    if (!last || inlineReviewMutation.isPending || undoBusy.current || Date.now() > last.expiresAt) return;
    undoBusy.current = true;
    try {
      await assertLegacyFsrsAllowed(supabase, { userId: user.id, cardId: last.wordId,
        itemKey: last.itemKey, language: last.lang });
      if (last.queued) {
        // 기존 outbox는 전송과 삭제 사이의 잠금을 제공하지 않는다. 성공을 가장해
        // 화면만 되돌리거나 전송 중인 기록을 지우지 않고, 후속 outbox 개편까지 보존한다.
        throw new Error('오프라인에 저장한 채점은 동기화 중일 수 있어 여기서 취소할 수 없어요.');
      } else {
        const { last_reviewed_at: prevReviewedAt = null, ...prevStats } = last.prev || {};
        const { data, error } = await supabase.from('user_vocabulary')
          .update({ ...prevStats, last_reviewed_at: prevReviewedAt }).eq('id', last.wordId)
          .eq('user_id', user.id).eq('last_reviewed_at', last.reviewedAt).select('id');
        if (error) throw error;
        if (!data?.length) throw new Error('이후 복습 기록이 있어 되돌리지 않았어요.');
        logReviewEvents(user.id, [{
          lang: last.lang, source: 'ui', item_key: last.itemKey, correct: true,
          detail: { qtype: 'undo', undo_of: { item_key: last.itemKey, rating: last.rating, reviewed_at: last.reviewedAt } },
        }]);
      }
      // 낙관 반영을 prev로 되돌린 뒤 무효화 — 오프라인이면 refetch가 실패해도 카드가 「복습 시점이에요」로 돌아온다
      patchVocabWordsCache(queryClient, user?.id, last.wordId, last.prev || {});
      queryClient.invalidateQueries({ queryKey: ['vocab-words', user?.id] });
      lastInlineGradeRef.current = null;
      toast(`되돌렸어요 — 「${last.word}」 다시 채점`, 'info');
    } catch (err) {
      toast('되돌리기 실패 — ' + friendlyToastMessage(err), 'error');
    } finally { undoBusy.current = false; }
  };
  const undoAny = () => (lastInlineGradeRef.current ? undoInlineGrade() : undoLastSave());

  // 팀 사본에서의 「담기」(v2-AB R2) — 비로그인은 단어를 기기에 적어 두고 로그인 뒤 복제본에서 담는다.
  const rememberGuestSave = async (token, grade) => {
    if (!token || !material?.__local) return null;
    return createClassSaveIntent({
      team: material.__team, day:material.processed_json?.metadata?.team?.day, materialId: parseLocalId(id), tokenId: token.id,
      grade: Number.isInteger(grade)&&grade>=1&&grade<=4?grade:undefined,
      word: { text: token.text, base: token.sep_link || token.base_form,
        meaning: token.meaning, pos: token.pos, reading: token.furigana || token.reading,
        language: materialLang, sourceSentence: extractSourceSentence(token.id) || (ctxSentenceOf(token) ?? leftPanelText) },
    });
  };
  const loginForGuestSave = async (event) => {
    event.preventDefault();
    try {
      const request=await rememberGuestSave(selectedToken);
      if(request)window.location.assign(`/auth?from=${encodeURIComponent(`/class/${material.__team}?classSave=${request}`)}`);
    } catch { toast('이 기기에 저장 요청을 보관하지 못했어요. 로그인 후 표현을 다시 선택해 주세요.','error'); }
  };

  const addToVocab = async (grade) => {
    if (!learningStorageSupported) return;
    if (user && (selectedExcluded || !wordStateReady || knownPending || exclusionState.mutation.isPending)) return;
    if (!user) {
      if (material?.__local) { toast('로그인하면 담겨요 — 카드의 「로그인 · 가입」으로 가세요.', 'info'); return; }
      toast('로그인이 필요합니다.', 'warning');
      return;
    }
    if (!selectedToken || !koreanSaveReady(selectedToken)) return;
    const saveKey = gradeSaveKey(saveScopeRef.current, selectedToken);
    if (savingGrade.current.has(saveKey)) return;
    savingGrade.current.add(saveKey);
    setPendingGradeSaves(prev => new Set(prev).add(saveKey));
    const action = ++gradeAction.current;
    const g = Number.isInteger(grade) && grade >= 1 && grade <= 4 ? grade : undefined;

    const sourceSentence = extractSourceSentence(selectedToken.id) || (ctxSentenceOf(selectedToken) ?? leftPanelText);
    const saveScope = saveScopeRef.current;
    const savedToken = selectedToken;
    const savedSource = readingContextSource(savedToken);
    lastSaveRef.current = null;
    lastInlineGradeRef.current = null;

    let inserted;
    try {
      if (materialLang === 'Korean') { await saveKoreanVocabulary(savedToken, g); return; }
      // 저장 규약(기본형 우선·출처 동봉)은 정본 조립기가 책임진다 — 저장 경로가 11개라
      // 자리마다 손으로 적으면 갈린다(실측: pdf·quick이 surface를 넣어 행이 둘로 갈렸다).
      const row = buildVocabRow({
        userId: user.id,
        surface: selectedToken.text,
        base: selectedToken.sep_link || selectedToken.base_form,   // kuromoji 경로·이합사 O 조각
        meaning: selectedToken.meaning,
        pos: selectedToken.pos,
        reading: headIsBase ? headReading : selectedToken.furigana || selectedToken.reading,
        language: materialLang,
        sourceSentence,
        sourceMaterialId: id,
        grade: g,
      });

      inserted = await upsertViewerVocabulary([row], VOCAB_UPSERT);
      // INSERT가 확인된 행을 즉시 반영한다. 문맥 RPC/undo 조회를 기다리거나 refetch를 추가로 기다리지 않는다.
      insertConfirmedVocabulary(queryClient, user.id, inserted[0]);
      queryClient.invalidateQueries({ queryKey: ['vocab-words', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['vocab', user?.id] });
      if (saveScopeRef.current === saveScope) saveCountRef.current += 1;
    } catch (err) {
      if (saveScopeRef.current === saveScope) toast('단어 추가 실패 — ' + friendlyToastMessage(err), 'error');
      return;
    } finally {
      savingGrade.current.delete(saveKey);
      setPendingGradeSaves(prev => { const next = new Set(prev); next.delete(saveKey); return next; });
    }
    // 부가 저장도 끝까지 확인한다. 실패는 기존 문맥 추가 경로로 재시도하고 안전한 undo만 제공한다.
    if (saveScopeRef.current !== saveScope) return;
    const linked = await attachReadingContext(savedToken);
    const undo = await prepareViewerSaveUndo(supabase, inserted[0], savedSource, linked).catch(() => null);
    if (saveScopeRef.current !== saveScope) return;
    recordActivity(user.id, () => {
      if (saveScopeRef.current === saveScope) fetchProfile(user.id);
    });
    if (gradeAction.current !== action) return;
    const snapshot = undo ? { ...undo, text: savedToken.text } : null;
    lastSaveRef.current = snapshot;
    if (linked || snapshot) toast(<span>「{savedToken.text}{vt("」 저장됨")}{snapshot && <ViewerLabelSlot locale={uiLocale} text={<>{vt('저장 취소 ·')} {UNDO_KEY_LABEL}</>}><button type="button" className="btn btn--ghost btn--sm" style={{ pointerEvents: 'auto' }} onClick={() => undoLastSave(snapshot)}>저장 취소 · {UNDO_KEY_LABEL}</button></ViewerLabelSlot>}</span>, 'success', 8000);
  };

  const isDragSelection=dragTokens!==null;
  const classSelection=useMemo(()=>{
    const currentJson=material?.processed_json;
    const selection=studySelection(material,isSheetOpen&&selectedToken?{...selectedToken,meaning:refMeaning||selectedToken.meaning,furigana:headReading||selectedToken.furigana}:null,isDragSelection?leftPanelText:!isSheetOpen?pickedSentence?.text||'':'',tokenRange.range?{first:currentJson?.sequence?.[tokenRange.range.start],last:currentJson?.sequence?.[tokenRange.range.end]}:!isSheetOpen&&pickedSentence?{first:pickedSentence.firstTokenId,last:classSentenceEnd(currentJson,pickedSentence.firstTokenId)}:null);
    // Reanalysis may merge our quote into a larger token. Keep the exact saved
    // text position while that restored selection is active, never the whole token.
    return selection&&isDragSelection&&tokenRange.range&&restoredClassSource?.quote===selection.text?{...selection,source:restoredClassSource}:selection;
  },[material,isSheetOpen,selectedToken,refMeaning,headReading,isDragSelection,leftPanelText,pickedSentence,tokenRange.range,restoredClassSource]);

  if (isLoading) return <div className="page-container"><Spinner message="자료 해부 중..." /></div>;
  if (isStudyNote(material)) return <div className="page-container"><Spinner message="개인 노트를 펼치고 있어요…" /></div>;
  if (error?.code === 'LOCAL_MISSING') {
    // 팀 사본이 없다(7일이 지났거나 다른 기기) — 팀 페이지가 다시 받는다. ?team=이 돌아갈 길.
    const teamKey = originalParams.get('team');
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>{vt("사본이 없어요")}</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 20, maxWidth: 400, margin: '0 auto 20px' }}>{vt("이 기기에 받아 둔 사본이 지워졌어요 — 7일이 지났거나 다른 기기예요. 팀 페이지에서 다시 열면 받아요.")}</p>
        <Link href={teamKey ? `/class/${teamKey}` : '/class'} className="btn btn--primary">{vt("팀 페이지로 →")}</Link>
      </div>
    );
  }
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
          {!isNotFound && <button onClick={() => refetch()} className="btn btn--primary">{vt("다시 시도")}</button>}
          <LibraryReturnLink className="btn btn--secondary" aria-label={vt(readerReturnLabel(originalParams.get('returnTo')))}><span aria-hidden="true">←</span></LibraryReturnLink>
        </div>
      </div>
    );
  }

  // 비공개 자료 접근 제어 — 팀 사본(__local)은 암호 뒤 토큰으로 받은 것이라 여기서 막지 않는다.
  if (material?.visibility === 'private' && material?.owner_id !== user?.id && !material?.__local) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>{vt("비공개 자료입니다")}</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>{vt("이 자료는 작성자만 열람할 수 있습니다.")}</p>
        <LibraryReturnLink className="btn btn--primary" aria-label={vt(readerReturnLabel(originalParams.get('returnTo')))}><span aria-hidden="true">←</span></LibraryReturnLink>
      </div>
    );
  }

  if (shouldReadComposerOriginal(material, originalParams)) {
    return <OriginalMaterialReader key={`${material.owner_id}:${material.id}:${material.document_json?.revision || 'original'}`} material={material} />;
  }

  const json = material?.processed_json || { sequence: [], dictionary: {} };
  // The body and Aa preview read the same existing learning records. The preview
  // has no token identifiers or handlers, so it cannot record an encounter/read.
  function tokenDisplayState(token) {
    const isSaved = isTokenSaved(savedWords, token, materialLang);
    const isDue = isSaved && isTokenDue(savedWords, token, materialLang);
    const isKnown = (wordStateHl || pronDisplay === 'unknown') && !!(knownWordSet?.has(normalizeKnownWord(token.text)) || knownWordSet?.has(exclusionWord(token)));
    const highlight = wordStateHl ? wordStateExtraClass(wordStateOf({
      isWord: isWordToken(token), isSaved: isSaved && !isKnown, isDue: isDue && !isKnown, isKnown,
      isMet: !!(metCode && (metWordSet.has(normalizeRefWordKey(metCode, token.base_form)) || metWordSet.has(normalizeRefWordKey(metCode, token.text)) || metWordSet.has(normalizeRefWordKey(metCode, metMainByText.get(token.text))))),
    })) : '';
    return {isSaved: isSaved && !isKnown, isDue: isDue && !isKnown, isKnown, highlight};
  }
  const previewTokens = settingsOpen ? (() => {
    const rangeStart = tokenRange.range ? json.sequence[tokenRange.range.start] : null;
    const line = pickedLineIdx ?? Number((rangeStart || selectedToken?.id || json.sequence[0])?.split('_')[1] || 0);
    return json.sequence.filter(key => key.startsWith(`id_${line}_`)).flatMap(key => {
      const token = json.dictionary[key];
      if (!token || token.pos === '개행') return [];
      const state = tokenDisplayState(token);
      return [{...token, previewSaved:state.isSaved, previewDue:state.isDue, previewKnown:state.isKnown, previewHighlight:state.highlight, previewPicked:pickedLineIdx === line || !!tokenRange.rangeTokenIds?.has(key)}];
    });
  })() : [];
  const status = material?.processed_json?.status || material?.status;
  const isAnalyzing = (status === 'analyzing' && !isStaleAnalysis) || reanalyzeMutation.isPending;
  const isPending = !isAnalyzing && (status === 'pending' || status === 'saved'); // 책 챕터 미분석 — 원문 열람 가능, 분석은 온디맨드
  const isFailed = status === 'failed';
  const isDone = status === 'completed' || status === 'partial';
  const needsRecovery = !passageOf(material) && (isStaleAnalysis || (isDone && missingLineCount > 0));
  const isCompleted = readingProgress?.is_completed === true;
  const isWordSaved = isTokenSaved(savedWords, selectedToken, materialLang);
  keyHandlersRef.current = {
    addToVocab, gradeInline, undo: undoAny,
    cardOpen: !!selectedToken && isSheetOpen,
    blocked: settingsOpen || sourceEditOpen || isEditingToken || !!reanalyzePanel || showReadingTest || showConversation || dictationPickerOpen || !!dictationSentence || !!quizState || !!completionModal,
    saveLocked: isWordSaved || saveAnim || selectedExcluded || !wordStateReady || knownPending || exclusionState.mutation.isPending,
    inlineDue: !!user && !selectedExcluded && wordStateReady && !knownPending && !exclusionState.mutation.isPending && isWordSaved && isTokenInlineDue(savedWords, selectedToken, materialLang) && !inlineReviewMutation.isPending,
  };
  const savedCount = (savedWords.surfaces?.size || 0);

  // 이 자료에서 복습 가능한 단어 수 (현재 로드된 토큰 기준)
  const dueInMaterial = countVocabularyDueInMaterial(savedWords, material);

  // 리스트(문장 분석 결과)와 단어 카드는 독립 조각 — 리스트 단어를 탭하면 카드가
  // 리스트 위에 붙는다(② 오너 승인, 팝업 대체). 합성은 아래 rightPanelContent에서.
  const wordListPanel = dragTokens === null ? null : (
    <>
      <div className="pdf-word-list__header" style={{ marginBottom: 10 }}>
        <span className="pdf-word-list__title">{vt("단어 (")}{dragTokens.length})</span>
      </div>
      {dragAnalyzing && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>{vt("분석 중...")}</div>}
      {dragTokens.map((t, i) => {
        const isSaved = savedWords.surfaces?.has(t.text) || savedWords.bases?.has(t.base_form);
        const saveKey = t.base_form || t.text;
        // 🈁 만남 점 — 만났고 아직 담지 않은 말에만(담긴 말은 기존 ✓가 이미 말해준다).
        // 비교는 대조 키(§4.7) — fr 저작형 "la famille"와 토큰 "famille"가 같은 키로 접힌다.
        const isMet = !isSaved && (
          metWordSet.has(normalizeRefWordKey(metCode, t.base_form)) ||
          metWordSet.has(normalizeRefWordKey(metCode, t.text)) ||
          metWordSet.has(normalizeRefWordKey(metCode, metMainByText.get(t.text)))
        );
        return (
          <div key={i} className={`pdf-word-item ${isSaved ? 'pdf-word-item--saved' : ''}`}>
            <span className="pdf-word-item__text" onClick={() => handleListWordClick(t)}>
              {isMet && (
                <span
                  title={vt("월드에서 만난 말")} aria-label={vt("월드에서 만난 말")}
                  style={{ color: 'var(--text-muted)', marginRight: 3, fontWeight: 800 }}
                >·</span>
              )}
              {t.text}
              {t.furigana && <span className="pdf-word-item__reading">{t.furigana}</span>}
            </span>
            <span className="pdf-word-item__meaning" onClick={() => handleListWordClick(t)}>{materialLang !== 'Korean' || (t.meaningLocale || t.explanationLocale || 'ko') === effectiveExplanationLocale ? t.meaning : ''}</span>
            {user && learningStorageSupported && koreanSaveReady(t) && (
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {isSaved ? <SaveContextButton key={`${id}:${saveKey}:${leftPanelText}:${materialLang === 'Korean' ? `${effectiveExplanationLocale}:${readingContextSource(t)?.sourceRevision}` : ''}`} label={vt("문맥 추가")}
                  word={contextWord(t)} source={readingContextSource(t)} /> : (
                  <button className="pdf-word-item__save" disabled={inlineSaving[saveKey]}
                    onClick={() => saveInlineVocabulary(t)}>{inlineSaving[saveKey] ? '…' : '★'}</button>
                )}
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

  // ── AE-R1 단어창 골격(VIEWER-V2-ROUNDS-001 §2·§3 · 설계서 docs/manabi-viewer-v2-ae-r1.md §2·§8 PR②) ──
  // 첫 화면(T0, 네트워크 0) = 문장 줄 · 칩 줄 · 표제어(병음 위 · 훈음 아래) · 이 문장 뜻 · 하단. 그 아래는 늦게 와도
  // 위쪽을 밀지 않는다. 일반 모드 단어 탭에는 접힘(details·aria-expanded=false)이 없다. 수업 모드는 수업 전용
  // 버튼·뜻 출처·접힘·runSelectionAnalysis 경로를 지금대로 두고 공통 배치(문장 줄·칩·표제어·뜻)만 같이 바뀐다(정본 §0.2).
  // 문장 줄: 누른 토큰이 든 한 문장, 누른 자리만 칠한다(3줄 예산 밖은 앞뒤 …, 안전망 CSS line-clamp).
  // 첫 화면 우선(AE-R3 PR② — 메인 세션 결정 10-08, AE-R1 PR② 합격 계약): 표제어·이 문장 뜻 줄·하단이 시트 첫 화면에 다 보여야 한다.
  // 자형 열이 뜻 줄을 본문 밖으로 밀면(ViewerGlyphColumn이 잰다) 1단계 = 문장 줄 2줄 예산, 2단계 = 자형 표를 뜻 줄 아래로
  // (표제어 옆에는 正 한 칸만). 카드마다 오르기만 하고, 다른 단어를 열면 0으로 돌아간다.
  const cardSentence = selectedToken && isSheetOpen ? cardSentenceOf(selectedToken, glyphStep >= 1) : null;
  // 사전 뜻 목록(B안 · 표시만 — 줄을 눌러 이 자리 뜻으로 교정하는 것은 PR ③): 사전 행(≤3) + refVocab, 정규화로 합치고
  // 이 문장 뜻과 같은 줄을 칠한다. 「AI」 표시는 없다(오너 결정 2026-10-07 23:45 KST — Q4).
  const senseGroups = selectedToken && isSheetOpen ? buildSenseList({ dictEntry: editDictEntry, refWord: refVocab?.word, token: selectedToken, language: materialLang, reading: headReading }) : [];
  // 하단 저장 줄의 다음 복습 — savedWords projection(추가 조회 0). FSRS 코호트가 복습 시점이면 「복습 차례」(Q7:
  // 뷰어 인라인 평가를 넓히지 않는다 — 학습 기록 경로 무변경).
  const selectedSavedRow = user && isWordSaved ? findSavedVocab(savedWords, selectedToken, materialLang) : null;
  const nextReview = selectedSavedRow ? nextReviewForSavedWord(savedWords, selectedSavedRow, { locale: uiLocale }) : null;
  // 자형 열(正 · 日, AE-R3 PR② — 정본 §6 · 설계서 §2·§3): 표제어(기본형) · 정체 표 · 사전 행(日 판정) · 일본어 표기 표.
  // 日 줄은 확인된 표기만 — 글자 변환(toJaForm) 폴백은 확인되지 않은 꼴이라 올리지 않는다(메인 세션 결정 10-08, 설계서 §3.2).
  const glyph = materialLang === 'Chinese' && selectedToken && isSheetOpen ? glyphRows({ word: headText, tradTable: hanjaTradTable, dictEntry: editDictEntry, jaTable: jaWordsTable }) : NO_GLYPH;
  // 훈음 표(한자 대조 켬)가 아직 없으면 루비 줄 높이를 먼저 잡는다(설계서 §5.2 — 표는 자료를 열 때 받는다).
  const hunPending = materialLang === 'Chinese' && showHanjaKo && !(hanjaKoTable && hanjaHunTable && hanjaTradTable);
  // 기본형 표제어 읽기가 아직 오지 않았으면 루비 자리(line-height 1.9)를 비워 둔다 — 조회 뒤 읽기가 없을 때만 noruby.
  const headReadingPending = headIsBase && !dictFetched && !dictError;
  // Q1: 단어 탭의 「번역」 버튼 대신 [문장] 탭을 누르면 그 문장을 기존 번역 전용 경로로 연다(경로·캐시·AI 조건 동일).
  // AE-R2 PR ②: 문장은 막대와 같은 정리(canonicalSentence)라 카드·막대·선처리가 같은 키를 쓴다. 누르는 즉시 같은 키로
  // 시작한다(0.3초 대기 없음) — 선처리가 끝났으면 바로 읽고, 진행 중이면 합류한다. 측정은 열린 순간의 상태만 센다.
  const openSentenceTranslation = () => {
    if (classStudyActive || !selectedToken || !isSheetOpen || senseReviewOpen) return; // 목록이 열려 있으면 [문장] 탭 = 그 목록
    const sentence = canonicalSentence(ctxSentenceOf(selectedToken));
    if (!sentence || (sentence === leftPanelText && (leftPanelLoading || leftPanelResult))) return;
    const key = peekSentenceTranslationKey(cacheScope, sentence);
    const ready = sentenceBookMeaningOf(sentence) ? 'book' : classifySentenceOpen(key ? queryClient.getQueryState([SENTENCE_TX_QUERY, key]) : null);
    sentenceTxStats.open({ key, ready });
    cardSentenceOpen.current = { sentence, at: Date.now() };
    runSelectedSentence(sentence, true);
  };
  // AE-R1 PR③ 사전 뜻 줄 → 「이 자리 뜻」 교정(정본 §2.1 · 설계서 §3.4). 쓰기는 TokenEditPanel과 같은 correctTokenMutation
  // (processed_json + token_corrections 이력) 하나 — 전역 승격(promoteCorrection)·단어장·FSRS는 건드리지 않는다(정본 §0.2).
  // 누른 줄이 「문맥상」 줄(버튼 아님)로 바뀌므로 포커스를 잃지 않게 되돌리기 버튼으로, 되돌린 뒤에는 그 줄로 옮긴다.
  const focusInCard = (selector) => requestAnimationFrame(() => [...document.querySelectorAll(`#inspector-word ${selector}`)].find((el) => el.getClientRects().length)?.focus({ preventScroll: true }));
  const senseBusy = correctTokenMutation.isPending;
  const chooseSense = (item) => {
    if (!senseEditable || senseBusy || !legacyTokenEditingAllowedRef.current) return;
    const corrections = senseCorrectionFor(selectedToken, editDictEntry, item.meaning);
    if (!corrections) return;
    const before = revertCorrections(selectedToken, corrections);
    const tokenId = selectedToken.id;
    correctTokenMutation.mutate(
      { tokenId: selectedToken.id, corrections, quiet: true },
      { onSuccess: () => { setSenseUndo({ tokenId, before, corrections }); focusInCard('.reader-card-sense-undo button'); } }
    );
  };
  const undoSense = () => {
    if (!senseUndo || senseUndo.tokenId !== selectedToken?.id || senseBusy) return;
    const chosen = senseUndo.corrections.meaning;
    correctTokenMutation.mutate(
      { tokenId: senseUndo.tokenId, corrections: senseUndo.before, quiet: true },
      { onSuccess: () => { setSenseUndo(null); focusInCard(`.reader-card-sense__pick[data-meaning="${CSS.escape(chosen || '')}"]`); } }
    );
  };
  // ── AD-R3 PR③ 「이 자료」 묶기·나누기 진입점(설계서 §6.1 · §4.4 · Q4 · §12.2) ──
  // 소유자(canEditToken) · 중·일·영 · 수업 사본(source_ref·기기 사본)·구간 학습(passage)·수업 모드 제외 · 분석 완료 · 재분석 중 아님.
  // 한국어는 어절 칼선 오너 결정 전이라 메뉴·드래그 항목 자체가 없다(legacyTokenEditingAllowed 포함).
  const boundaryCtx = boundaryEditContext(material, { userId: user?.id, classMode: classStudyActive, passage: !!passageOf(material) });
  const boundaryAllowed = canEditToken && legacyTokenEditingAllowed && boundaryEntryAllowed(boundaryCtx) && isDone
    && !material?.__offline && !reanalyzeMutation.isPending;
  const boundaryBusy = boundaryMutation.isPending;
  // AD-R3 §7.5 한국어 나누기(오너 B안 2026-10-09) — 어절 안 나누기만, 같은 권한 조건(소유자 · 사본/구간/수업 모드 제외 · 분석 완료 ·
  // 재분석 중 아님). 형태 분석이 지금 설명 언어로 있고 형태소가 둘 이상일 때만 ⋯ 「나누기」. 어절을 넘는 묶기(드래그 · 옆 단어와 묶기)는 없다.
  const koreanSplitAllowed = materialLang === 'Korean' && canEditToken && koreanSplitEntryAllowed(boundaryCtx) && isDone
    && !material?.__offline && !reanalyzeMutation.isPending;
  koreanSplitAllowedRef.current = koreanSplitAllowed;
  const koreanCardTokenId = koreanSplitAllowed && selectedToken?.id && isSheetOpen ? selectedToken.id : null;
  const koreanPlan = koreanCardTokenId ? planKoreanSplit(material, koreanCardTokenId, boundaryCtx, { locale: effectiveExplanationLocale }) : null;
  const koreanMenuShown = !!koreanPlan && (koreanPlan.ok || koreanPlan.reason === 'no_literal_cut');
  const koreanPiece = koreanCardTokenId ? koreanBoundaryPiece(json, koreanCardTokenId) : null;
  const renderKoreanBoundaryCard = () => {
    const panel = boundaryPanel?.tokenId === koreanCardTokenId && boundaryPanel.kind === 'split' ? boundaryPanel : null;
    const undoShown = boundaryUndo?.tokenId === koreanCardTokenId && boundaryUndoValid(json, boundaryUndo.undo);
    const restore = koreanPiece ? { line: koreanPiece.record.line, start: koreanPiece.record.start, end: koreanPiece.record.end, cuts: [] } : null;
    return <>
      {restore && <p className="reader-card-boundary"><span>{vt('나눈 조각')}</span>{' · '}<button type="button" className="btn btn--ghost btn--sm"
        disabled={boundaryBusy} onClick={() => boundaryMutation.mutate({ request: restore })}>{vt('원래대로')}</button></p>}
      {undoShown && <p className="reader-card-boundary-undo"><span role="status">{vt(boundaryUndo.kind === 'restore' ? '원래대로 했어요' : '나눴어요')}</span>{' · '}<button type="button"
        className="btn btn--ghost btn--sm" disabled={boundaryBusy} onClick={() => boundaryMutation.mutate({ undo: boundaryUndo.undo })}>{vt('되돌리기')}</button></p>}
      {panel && koreanPlan && <BoundarySplitPanel key={`ko-split:${koreanCardTokenId}`} plan={koreanPlan} reasonText={koreanPlan.ok ? null : boundaryReasonMessage(koreanPlan.reason)}
        note={koreanPlan.ok ? null : koreanFormulaText(koreanPlan.formula)} initialCuts={koreanPlan.ok ? koreanPlan.initialCuts : []}
        preview={cuts => splitPreview(koreanPlan, cuts)}
        glosses={cuts => koreanSplitPreview(koreanPlan, cuts).map(piece => ({ text: piece.text, lang: piece.formula ? undefined : effectiveExplanationLocale,
          note: piece.formula ? koreanFormulaTail(piece.formula) : piece.morphemes.map(m => m.function).filter(Boolean).join(' · ') }))}
        busy={boundaryBusy} contentLang={contentLangTag} vt={vt}
        onConfirm={cuts => boundaryMutation.mutate({ request: { line: koreanPlan.line, start: koreanPlan.start, end: koreanPlan.end, cuts } })} onCancel={() => setBoundaryPanel(null)} />}
    </>;
  };
  const boundarySavedParts = (tokenIds) => [...new Set((tokenIds || []).map(tid => json.dictionary?.[tid]).filter(t => t && isTokenSaved(savedWords, t, materialLang)).map(t => t.text))];
  const openBoundaryPanel = (panel) => { setIsEditingToken(false); setBoundaryPanel(panel); };
  // 드래그 「한 단어로 묶기」 — [문장] 탭 원문 줄 아래(목업). 드래그 동작·번역 경로는 그대로, 버튼 하나만 더한다.
  const dragRange = boundaryAllowed && tokenRange.range && !tokenRange.dragging ? tokenRange.range : null;
  const dragKey = dragRange ? `${dragRange.start}:${dragRange.end}` : '';
  const dragPlan = dragRange ? planBoundaryMerge(material, dragRange.start, dragRange.end, boundaryCtx) : null;
  const boundaryMergeBlock = dragPlan && !boundaryReasonHidden(dragPlan.reason) ? (
    boundaryPanel?.kind === 'drag' && boundaryPanel.key === dragKey
      ? <BoundaryMergeConfirm key={dragKey} plan={dragPlan} savedWords={boundarySavedParts(dragPlan.ids)} busy={boundaryBusy} contentLang={contentLangTag} vt={vt}
        onConfirm={() => boundaryMutation.mutate({ request: dragPlan.request })} onCancel={() => setBoundaryPanel(null)} />
      : <BoundaryMergeRow plan={dragPlan} reasonText={dragPlan.ok ? null : boundaryReasonMessage(dragPlan.reason)} vt={vt}
        onStart={() => setBoundaryPanel({ kind: 'drag', key: dragKey })} />
  ) : null;
  // 카드: 「직접 묶은 단어 · [나누기]」(Q1) · 「묶었어요/나눴어요 · [되돌리기]」 · ⋯ 패널(옆 단어와 묶기 · 나누기).
  const cardTokenId = boundaryAllowed && selectedToken?.id && isSheetOpen ? selectedToken.id : null;
  const boundaryOrigin = cardTokenId ? boundaryTokenOrigin(json, cardTokenId) : null;
  const boundaryUndoShown = !!cardTokenId && boundaryUndo?.tokenId === cardTokenId && boundaryUndoValid(json, boundaryUndo.undo);
  const renderBoundaryCard = () => {
    if (koreanCardTokenId) return renderKoreanBoundaryCard();
    if (!cardTokenId) return null;
    const panel = boundaryPanel?.tokenId === cardTokenId ? boundaryPanel : null;
    let panelNode = null;
    if (panel?.kind === 'split') {
      const plan = planBoundarySplit(material, cardTokenId, boundaryCtx);
      panelNode = <BoundarySplitPanel key={`split:${cardTokenId}`} plan={plan} reasonText={plan.ok ? null : boundaryReasonMessage(plan.reason)}
        preview={cuts => splitPreview(plan, cuts)} busy={boundaryBusy} contentLang={contentLangTag} vt={vt}
        onConfirm={cuts => boundaryMutation.mutate({ request: { line: plan.line, start: plan.start, end: plan.end, cuts } })} onCancel={() => setBoundaryPanel(null)} />;
    } else if (panel?.kind === 'neighbor') {
      const plans = planNeighborMerge(material, cardTokenId, boundaryCtx);
      const side = panel.side || (plans.next.ok || !plans.prev.ok ? 'next' : 'prev');
      const plan = plans[side];
      const reason = plan.ok ? null : boundaryReasonMessage(plan.reason === 'no_neighbor' && side === 'next' && plans.prev.reason !== 'no_neighbor' ? plans.prev.reason : plan.reason);
      panelNode = <BoundaryMergeConfirm key={`neighbor:${cardTokenId}`} plan={plan} reasonText={reason} busy={boundaryBusy} contentLang={contentLangTag} vt={vt}
        choice={plans.prev.ok || plans.next.ok ? { value: side, prev: plans.prev.ok, next: plans.next.ok, onChange: value => setBoundaryPanel({ ...panel, side: value }) } : null}
        savedWords={plan.ok ? boundarySavedParts(plan.ids) : []}
        onConfirm={() => plan.ok && boundaryMutation.mutate({ request: plan.request })} onCancel={() => setBoundaryPanel(null)} />;
    }
    return <>
      {boundaryOrigin === 'merged' && <p className="reader-card-boundary"><span>{vt('직접 묶은 단어')}</span>{' · '}<button type="button" className="btn btn--ghost btn--sm"
        disabled={boundaryBusy} onClick={() => openBoundaryPanel({ kind: 'split', tokenId: cardTokenId })}>{vt('나누기')}</button></p>}
      {boundaryUndoShown && <p className="reader-card-boundary-undo"><span role="status">{vt(boundaryUndo.kind === 'merge' ? '묶었어요' : '나눴어요')}</span>{' · '}<button type="button"
        className="btn btn--ghost btn--sm" disabled={boundaryBusy} onClick={() => boundaryMutation.mutate({ undo: boundaryUndo.undo })}>{vt('되돌리기')}</button></p>}
      {panelNode}
    </>;
  };
  const boundaryPendingRows = boundaryPendingOpen && canEditToken && (legacyTokenEditingAllowed || materialLang === 'Korean') ? pendingBoundaryRows(material) : [];
  const boundaryPendingContent = boundaryPendingRows.length ? <BoundaryPendingList rows={boundaryPendingRows} contentLang={contentLangTag} vt={vt} /> : null;
  // 머리줄 ⋯ = 분석 고치기(정본 §2). 「뜻·발음 수정」 + AD-R3 「옆 단어와 묶기」·「나누기」(이 자료 소유자 · 중·일·영). 고칠 것이 없으면 ⋯도 없다.
  const sheetMenu = senseEditable && selectedToken && isSheetOpen ? {
    label: vt('분석 고치기'),
    items: [{ id: 'edit', label: vt('뜻·발음 수정'), onSelect: openTokenEditing },
      ...(cardTokenId ? [
        { id: 'merge-neighbor', label: vt('옆 단어와 묶기'), onSelect: () => openBoundaryPanel({ kind: 'neighbor', tokenId: cardTokenId, side: null }) },
        { id: 'split', label: vt('나누기'), onSelect: () => openBoundaryPanel({ kind: 'split', tokenId: cardTokenId }) },
      ] : [])],
  } : koreanMenuShown ? {
    // 한국어(§7.5): 뜻·발음 수정·옆 단어와 묶기 없이 「나누기」 하나.
    label: vt('분석 고치기'),
    items: [{ id: 'split', label: vt('나누기'), onSelect: () => openBoundaryPanel({ kind: 'split', tokenId: koreanCardTokenId }) }],
  } : null;
  // AD-R4 PR③ 「뜻 확인 필요 N개 [보기]」 — 자료 소유자(고칠 수 있는 사람)만, N>0일 때만, 분석이 끝난 뒤(§6.1).
  // 권한은 사전 뜻 줄 교정(senseEditable)과 같은 판정이고, 수업 모드에서는 숨긴다(§13). 구간 학습(passage)은 교정 RPC가
  // 표식을 지울 수 없어(토큰 || 교정 병합) 제외한다. 열람자에게는 줄·목록이 없고 카드 ⓘ만 보인다.
  const senseReviewAllowed = canEditToken && legacyTokenEditingAllowed && learningStorageSupported && !classStudyActive
    && materialLang === 'Chinese' && isDone && !passageOf(material);
  const senseReviewShown = senseReviewAllowed && senseReviewList.length > 0 && senseReviewDismissed !== senseReviewKey;
  const openSenseReview = () => {
    if (!senseReviewAllowed || !senseReviewList.length) return;
    setBoundaryPendingOpen(false);
    setSuggestConfirm(null);
    setSenseReviewIds(senseReviewList.map((item) => (isBoundarySuggestion(item) ? { ...item, sentence: boundarySuggestSentence(item) } : item.id)));
    setSenseReviewDictFailed('');
    setSentenceTabSignal(s => s + 1);
  };
  // 목록 교정 = 카드 사전 뜻 줄 교정과 같은 규칙(senseCorrectionFor)·같은 쓰기(correctTokenMutation, quiet) 한 번.
  // 표식 삭제는 그 mutation 안(applyTokenCorrections)에서. 전역 승격·단어장·FSRS·사전 쓰기 0(§7).
  const chooseReviewSense = (row, meaning) => {
    if (!senseReviewAllowed || senseBusy || !legacyTokenEditingAllowedRef.current) return;
    const corrections = senseCorrectionFor(row.token, row.dictEntry, meaning);
    if (!corrections) return;
    correctTokenMutation.mutate({ tokenId: row.id, corrections, quiet: true });
  };
  // [이대로 둘게요] = 지금 뜻을 확정 교정으로 저장(§6.2) — 같은 mutation이라 이력이 남고 재분석 때 이 뜻이 보존된다.
  const keepReviewSense = (row) => {
    if (!senseReviewAllowed || senseBusy || !legacyTokenEditingAllowedRef.current) return;
    const corrections = keepSenseCorrection(row.token);
    if (!corrections) return;
    correctTokenMutation.mutate({ tokenId: row.id, corrections, quiet: true });
  };
  const senseReviewRows = senseReviewTokens.map((token) => {
    const key = tokenDictKeyOf(token);
    const query = senseReviewDict[senseReviewDictKeys.indexOf(key)];
    const dictEntry = query?.data;
    const pending = dictEntry === undefined && senseReviewDictFailed !== senseReviewDictSignature;
    return { id: token.id, token, dictEntry: dictEntry ?? null, sentence: cardSentenceOf(token),
      options: pending ? null : senseReviewOptions(dictEntry ?? null, token), resolved: !needsMeaningCheck(token) };
  });
  // ── AD-R4 PR④ 경계 후보 줄(설계서 §6.2) — [묶기]는 그 자리에서 AD-R3 확인 줄(planBoundaryMerge → boundaryMutation → commitBoundaryEdit,
  // 새 쓰기 경로 0), [아니요]는 boundaryDismissMutation. [묶기]를 열 수 있는 조건은 AD-R3 진입점과 같다(boundaryAllowed).
  const boundarySuggestSentence = (item) => {
    const found = cardSentenceOf(item.token);
    if (!found || found.term !== item.parts[0] || !found.after.startsWith(item.parts[1])) return null;
    return { before: found.before, after: found.after.slice(item.parts[1].length) };
  };
  const liveSuggestions = new Set(senseReviewList.filter(isBoundarySuggestion).map((item) => `${item.id}|${item.form}`));
  const dismissedSuggestions = dismissedBoundaryForms(material?.processed_json);
  const suggestBusy = boundaryMutation.isPending || boundaryDismissMutation.isPending;
  const planSuggestedMerge = (snap) => {
    const sequence = json.sequence || [];
    const start = sequence.indexOf(snap.tokenId);
    return start >= 0 && sequence[start + 1] === snap.nextId ? planBoundaryMerge(material, start, start + 1, boundaryCtx) : { ok: false, reason: 'invalid_range' };
  };
  const boundarySuggestRow = (snap) => {
    const active = liveSuggestions.has(`${snap.id}|${snap.form}`);
    const plan = active && boundaryAllowed && suggestConfirm === snap.id ? planSuggestedMerge(snap) : null;
    return {
      ...snap, active, dismissed: dismissedSuggestions.has(snap.form), joinable: boundaryAllowed,
      confirm: plan ? <BoundaryMergeConfirm key={`suggest:${snap.id}`} plan={plan} reasonText={plan.ok ? null : boundaryReasonMessage(plan.reason)}
        savedWords={plan.ok ? boundarySavedParts(plan.ids) : []} busy={suggestBusy} contentLang={contentLangTag} vt={vt}
        onConfirm={() => plan.ok && boundaryMutation.mutate({ request: plan.request })} onCancel={() => setSuggestConfirm(null)} /> : null,
    };
  };
  const joinSuggestion = (row) => { if (boundaryAllowed && !suggestBusy) setSuggestConfirm(row.id); };
  const dismissSuggestion = (row) => { if (canEditToken && !suggestBusy) boundaryDismissMutation.mutate(row.form); };
  const senseReviewRowById = new Map(senseReviewRows.map((row) => [row.id, row]));
  const senseReviewAllRows = (senseReviewIds || []).map((entry) => (typeof entry === 'string' ? senseReviewRowById.get(entry) : boundarySuggestRow(entry))).filter(Boolean);
  const senseReviewContent = senseReviewOpen && senseReviewAllowed ? (
    <ViewerSenseReview rows={senseReviewAllRows} remaining={senseReviewList.length} busy={senseBusy}
      onChoose={chooseReviewSense} onKeep={keepReviewSense} onJoin={joinSuggestion} onDismiss={dismissSuggestion} boundaryBusy={suggestBusy}
      contentLang={contentLangTag} vt={vt} />
  ) : null;
  // 수업 모드는 수업 전용 버튼과 경로(runSelectionAnalysis)를 지금대로 둔다(정본 §0.2).
  const renderClassSentenceAction = () => (
    ctxSentenceOf(selectedToken) ? <div className="word-detail-card__actrow reader-card-class-actions">
      <button className="btn btn--ghost btn--sm" aria-label={vt("문장 번역")} title={vt("문장 번역")} onClick={()=>{setSentenceTabSignal(s=>s+1);runSelectionAnalysis(ctxSentenceOf(selectedToken));}}>{vt("번역")}</button>
    </div> : null
  );
  const renderWordDetailCard = (classAction=null,classMeaning=null) => !selectedToken || !isSheetOpen ? null : (
    <div key={selectedToken.id||selectedToken.text} tabIndex={-1} className={`word-detail-card${dragTokens !== null ? ' word-detail-card--above-list' : ''}`}>
      <div className="reader-card-body">
      {cardSentence && <p className="reader-card-sentence" data-tight={glyphStep >= 1 || undefined} lang={contentLangTag} key={`sentence:${selectedToken.id||selectedToken.text}`}>{cardSentence.before}{cardSentence.term && <mark className="reader-card-sentence__term">{cardSentence.term}</mark>}{cardSentence.after}</p>}
      <div className="word-detail-card__actions">
        <div className="word-detail-card__meta">
          <span className="reader-card-tag"><TokenPosLabel token={selectedToken} /></span>
          {/* 기본형은 표제어가 보여 준다(R R2) — 「품사 · 기본형」이 겸류 구분자와 같은 모양이라
              품사 오염으로 읽히던 중의성 소멸. 사전 읽기가 없어 표제어가 폴백일 때만 라벨 텍스트. */}
          <ViewerLabelSlot locale={uiLocale} text={vt('기본형')}>{headFallback && <span className="word-detail-card__base">기본형</span>}</ViewerLabelSlot>
          {materialLang === 'Korean' && selectedToken.text !== headText && <span lang="ko">{selectedToken.text} → {headText}</span>}
          {refVocab && <span className="word-detail-card__level">{refLevelLabel(refVocab.level)}</span>}
        </div>
        {/* 듣기는 칩 줄 끝(정본 §2.1 칩 줄 — 44px 누름 영역). 수업 모드는 판서 단어 옆 듣기를 그대로 쓴다. */}
        {!classStudyActive && ttsSupported && <button className="word-detail-card__speak" onClick={() => speak(headText, materialLang, { ...ttsOptsFor(ttsRate), preferBrowser: true })} aria-label="발음 듣기" {...(uiLocale === 'ko' ? {} : {'aria-label': vt('발음 듣기')})} title={vt("발음 듣기")} data-icon-action><ActionIcon name="audio"/></button>}
      </div>
      {classStudyActive?<div className="reader-teaching-word"><TeachingWord entry={{text:headText,reading:headReading,meaning:classMeaning?.meaning??refMeaning??selectedToken.meaning??''}} language={materialLang} display={teachingDisplay} onChar={(ch,index)=>toggleInspectChar(ch,`teaching:${index}`,null)}/><div className="reader-teaching-actions"><details><summary>{vt("표시")}</summary><WordDisplayControls language={materialLang} value={teachingDisplay} onChange={setTeachingDisplay}/></details>{ttsSupported&&<button className="word-detail-card__speak" onClick={()=>speak(headText,materialLang,ttsOptsFor(ttsRate))} aria-label={vt("발음 듣기")} title={vt("발음 듣기")} data-icon-action><ActionIcon name="audio"/></button>}{canEditToken&&selectedToken.id&&!classMeaning&&legacyTokenEditingAllowed&&<button className="word-detail-card__edit" aria-label={vt("뜻·발음 수정")} onClick={toggleTokenEditing}><ActionIcon name="edit"/></button>}</div></div>:<div className="reader-card-headword">
      <div className="reader-card-lexeme">
      {(() => {
        // ① 폭맞춤 확대(오너 승인): CJK는 1em 격자라 크기 = 100cqi ÷ fitDivisor가 CSS
        // 수식으로 성립(.word-fit — 측정 JS 없음). 라틴 자료는 기존 크기 유지.
        // ④ 글자 탐색: 한자만 탭 대상 — zh는 seg가 글자 단위라 병음도 그 글자 것이다.
        const rubySegs = headReading ? splitRuby(headText, headReading) : null;
        let at = 0; // 표제어 안 코드포인트 위치 — 탭한 구간(headPicked) 강조용
        if (!isFitLang(materialLang)) {
          return (
            <div lang={contentLangTag} style={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1.3 }}>
              {rubySegs
                ? rubySegs.map((seg, i) =>
                    seg.kanji ? <ruby key={i}>{seg.kanji}<rt className={seg.pinyin ? ['pinyin-text', showToneColors && pinyinToneClass(seg.reading)].filter(Boolean).join(' ') : undefined} style={{ fontSize: '0.45em', color: showToneColors && seg.pinyin ? undefined : 'var(--primary-light)' }}>{seg.reading}</rt></ruby> : <span key={i}>{seg.plain}</span>
                  )
                : headText}
            </div>
          );
        }
        // 훈음 루비(정본 §2.1 표제어 덩어리, AE-R1): 한자 아래 셀 — 표제어(기본형) 글자 기준, R0+ 정체 조회(hunRubyCells →
        // hanjaReadingsOf). 셀이 글자 칸보다 넓으면 그 칸만 벌리고(--hun-n), 그래도 넘치면 훈/음 두 줄. 별도 훈음 목록은 없다.
        const hunCells = hanjaHunOf(headText);
        const hunAt = (i) => hunCells?.[i] || null;
        const column = (key, glyph, cells) => <span key={key} className="word-fit__col">{glyph}<span className="word-fit__hunrow">{cells}</span></span>;
        const isPickedAt = (i) => !!headPicked && i >= headPicked[0] && i < headPicked[1];
        // data-glyph-i = 표제어 안 코드포인트 순번 — 자형 열 안 2 표가 이 자리를 재서 칸을 맞춘다(AE-R3).
        const charSpan = (ch, key, reading, i) => isInspectableChar(ch) ? (
          <span
            key={key}
            data-glyph-i={i}
            data-inspect-key={key}
            role="button"
            tabIndex={0}
            aria-haspopup={hanjaPopoverMode ? 'dialog' : undefined}
            className={`word-fit__char${inspectChar?.key === key ? ' word-fit__char--active' : ''}${isPickedAt(i) ? ' word-fit__char--picked' : ''}`}
            title={vt("글자 정보")}
            onClick={() => toggleInspectChar(ch, key, reading)}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggleInspectChar(ch, key, reading))}
          >{ch}</span>
        ) : <span key={key} data-glyph-i={i} className={isPickedAt(i) ? 'word-fit__char--picked' : undefined}>{ch}</span>;
        return (
          <div className="word-fit-wrap">
            <div
              className={`word-fit${rubySegs || headReadingPending ? '' : ' word-fit--noruby'}${hunCells ? ' word-fit--hun' : hunPending ? ' word-fit--hun-reserved' : ''}`}
              lang={contentLangTag}
              style={{ '--fit-n': fitDivisor(headText, headReading, materialLang) }}
            >
              <span className="surface">
                {rubySegs
                  ? rubySegs.map((seg, i) => {
                      if (!seg.kanji) return <span key={i}>{[...seg.plain].map((ch, j) => { const n = at++; const glyph = charSpan(ch, `${i}:${j}`, null, n); return hunCells ? column(`${i}:${j}`, glyph, <HunCell cell={hunAt(n)} />) : glyph; })}</span>;
                      const chars = [...seg.kanji];
                      // 分散配置(JLReq) — 요미가 본체보다 길면 CSS가 **본체 글자를 벌린다**.
                      // 넘기는 것은 요미 글자수뿐이고 폭 계산(× 0.5em)은 CSS가 한다
                      // (`--fit-n`과 같은 패턴). 0.5em/자는 **가나** 전제라 가나 읽기에만
                      // 넘긴다 — 혼종 중국어 토큰의 병음은 라틴이라 훨씬 좁다.
                      const yomiN = !seg.pinyin && KANA_RE.test(seg.reading || '')
                        ? [...seg.reading].length : null;
                      // Joined pinyin remains one reading group; do not infer per-character readings.
                      const hasPinyin=seg.pinyin||(materialLang==='Chinese'&&!KANA_RE.test(seg.reading||'')&&/\p{Script=Latin}/u.test(seg.reading||''));
                      const first = at;
                      const glyphs=chars.map((ch, j) => charSpan(ch, `${i}:${j}`, seg.pinyin ? seg.reading : null, at++));
                      const ruby = (
                        <ruby key={i} data-pinyin={hasPinyin ? '1' : undefined} data-yomi={hasPinyin ? undefined : '1'}
                          style={yomiN ? { '--yomi-n': yomiN } : undefined}>
                          {hasPinyin?<span className="reader-card-ruby-glyphs">{glyphs}</span>:glyphs}
                          <span className={['rt-an', showToneColors && seg.pinyin ? pinyinToneClass(seg.reading) : ''].filter(Boolean).join(' ')}>{seg.reading}</span>
                        </ruby>
                      );
                      const cells = chars.map((_, j) => hunAt(first + j));
                      return hunCells ? column(i, ruby, cells.map((cell, j) => <HunCell key={j} cell={cell} />)) : ruby;
                    })
                  : [...headText].map((ch, j) => charSpan(ch, `p:${j}`, null, j)).map((glyph, j) => hunCells ? column(`p:${j}`, glyph, <HunCell cell={hunAt(j)} />) : glyph)}
              </span>
            </div>
            {/* 자형 열(正 · 日) — 표제어 오른쪽(안 1) 또는 글자 칸에 맞춘 표(안 2). 수업 모드 판서에는 없다(설계서 Q3). */}
            {materialLang === 'Chinese' && (glyphStep < 2
              ? <ViewerGlyphColumn word={headText} zheng={glyph.zheng} ja={glyph.ja} hunCells={hunCells} cardKey={glyphCardKey} labels={{ zheng: vt('대만 정체'), ja: vt('일본어 표기') }} budgetStep={glyphStep} onBudget={(step) => raiseGlyphBudget(glyphCardKey, step)} />
              : !glyphZhengBelow && <ViewerGlyphColumn word={headText} zheng={glyph.zheng} ja={null} hunCells={hunCells} cardKey={`${glyphCardKey}:side`} labels={{ zheng: vt('대만 정체'), ja: vt('일본어 표기') }} sideOnly onSideMiss={() => glyphZhengMiss(glyphCardKey)} />)}
          </div>
        );
      })()}
      {materialLang === 'English' && selectedToken.reading && <div className="reader-card-pronunciation">{selectedToken.reading}</div>}
      </div>
      </div>}
      {inspectChar && !hanjaPopoverMode && (() => {
        // ④ 글자 카드(증강 R1~R3 — 오너 승인 2026-08-28): 헤더는 자기 완결(훈음·병음·자형 칩),
        // 주인공은 구성(1단 분해 — 성분 탭 = 재귀 탐색)과 다시 만나기(이 자료·내 단어).
        // 부수는 설명하지 않는다 — 성분 배지 + 메타 한 줄이 전부(설계 확정).
        // R0+: 중국어 표제어 글자는 단어의 정체 꼴로 찾는다(단어창 훈음과 같은 조회). 성분·자형 칩은 글자 그대로.
        const inspectWord = materialLang === 'Chinese' && !/^(form|comp)_/.test(inspectChar.key) ? { word: headText, tradTable: hanjaTradTable } : null;
        const d = charDetail(inspectChar.ch, { koTable: hanjaKoTable, hunTable: hanjaHunTable, jaTable: hanjaJaTable }, inspectWord) || {};
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
              {!hanjaKoTable && <span className="char-inspect__loading">{vt("옥편 로딩…")}</span>}
            </div>
            {etym?.comps.length > 0 && (
              <div className="char-inspect__comps">
                <span className="char-inspect__words-label">{vt("구성")}</span>
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
                      {c.isRadical && <i className="char-inspect__badge">{vt("부수")}</i>}
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
              <div className="char-inspect__group">{vt("다시 만나기")}</div>
            )}
            {inBook.length > 0 && (
              <div className="char-inspect__words">
                <span className="char-inspect__words-label">{vt("이 자료")}</span>
                {inBook.map((t, i) => (
                  <button
                    key={`${t.text}_${i}`}
                    className="char-inspect__word"
                    lang={contentLangTag}
                    onClick={() => handleListWordClick({ ...t, id: json.sequence.find(tid => json.dictionary[tid] === t) })}
                  >{t.text}</button>
                ))}
              </div>
            )}
            {related.length > 0 && (
              <div className="char-inspect__words">
                <span className="char-inspect__words-label">{vt("내 단어")}</span>
                {related.map((v) => (
                  <button
                    key={v.id || v.word_text}
                    className="char-inspect__word"
                    lang={contentLangTag}
                    onClick={() => handleListWordClick({ text: v.word_text, base_form: v.base_form || v.word_text, meaning: v.meaning, furigana: v.furigana, pos: v.pos,
                      __viewerMaterialId: String(id), __viewerSentence: String(v.source_material_id) === String(id)
                        && v.source_sentence?.includes(v.word_text) && material?.raw_text?.includes(v.source_sentence) ? v.source_sentence : '' })}
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
      {classMeaning?.editor||(!classStudyActive&&<div className={`word-detail-card__meaningrow${materialLang === 'English' && selectedToken.reading ? ' word-detail-card__meaningrow--tight' : ''}`}>
        <div className="word-detail-card__meaning" lang={materialLang === 'Korean' ? effectiveExplanationLocale : undefined}>
          {materialLang === 'Korean' ? (koreanPieceSelected ? koreanPieceMeaning(selectedToken) : localizedWord.loading ? vt('문맥 뜻을 불러오는 중…') : localizedWord.error ? <button onClick={localizedWord.retry}>{vt('설명을 다시 불러오기')}</button> : localizedWord.meaning) : refMeaning || selectedToken.meaning || '(뜻 없음)'}
        </div>
        {/* 리스트 단어는 자료 토큰이 아니라(id 없음) 이 자료의 교정 대상이 될 수 없다 */}
        {canEditToken && selectedToken.id && (
          legacyTokenEditingAllowed && learningStorageSupported &&
          <button
            onClick={toggleTokenEditing}
            aria-label={vt("뜻·발음 수정")}
            title={vt("뜻·발음 수정")}
            className={`word-detail-card__edit${isEditingToken ? ' is-on' : ''}`} data-icon-action
          ><svg className="action-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m4 16 12-12 4 4L8 20H4v-4ZM13 7l4 4"/></svg></button>
        )}
      </div>)}
      {/* AD-R4 PR③ 카드 ⓘ(설계서 §6.3) — 뜻 확인 필요 표식이 있을 때만, 뜻 줄 아래. 사전 뜻 줄에서 다른 뜻을 고르면 교정이 표식을 지워 사라진다. 「AI」 표시 없음. */}
      {!classStudyActive && materialLang === 'Chinese' && needsMeaningCheck(selectedToken) && <p className="reader-card-meaning-check"><span aria-hidden="true">ⓘ </span>{vt('문맥과 다를 수 있어요')}</p>}
      {/* AD-R3 PR③ 직접 묶은 단어 · 되돌리기 · ⋯ 패널(설계서 §6.3 목업 — 뜻 줄 바로 아래). 이 자료 소유자 · 중·일·영만. 「AI」 표시 없음. */}
      {!classStudyActive && renderBoundaryCard()}
      {/* 첫 화면 우선 2단계: 자형 표를 뜻 줄 아래로(스크롤 아래 — 표제어 옆에는 正 한 칸만). 접힘 0. */}
      {!classStudyActive && materialLang === 'Chinese' && glyphStep >= 2 && <ViewerGlyphColumn className="reader-card-glyph--below" forceLayout="stack" word={headText} zheng={glyphZhengBelow ? glyph.zheng : null} ja={glyph.ja} cardKey={`${glyphCardKey}:below`} labels={{ zheng: vt('대만 정체'), ja: vt('일본어 표기') }} />}
      {/* 사전 뜻 줄 교정 직후 한 줄(설계서 §3.4) — 되돌리기 = 이전 값 그대로 같은 mutation 1회. 그 토큰을 다시 열 때까지. */}
      {senseUndo?.tokenId === selectedToken.id && <p className="reader-card-sense-undo"><span role="status">{vt('뜻을 바꿨어요')}</span>{' · '}<button type="button" className="btn btn--ghost btn--sm" disabled={senseBusy} onClick={undoSense}>{vt('되돌리기')}</button></p>}
      {isEditingToken && !classMeaning && (
        legacyTokenEditingAllowed && canEditToken &&
        <TokenEditPanel
          key={selectedToken.id} // 토큰 전환 시 리마운트 — 이전 단어 입력값이 새 토큰에 붙는 것 차단(마감 ③)
          token={selectedToken}
          language={materialLang}
          dictEntry={editDictEntry}
          saving={correctTokenMutation.isPending}
          onSave={(corrections, opts) => {
            if (!legacyTokenEditingAllowed || !legacyTokenEditingAllowedRef.current) return;
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
      {classStudyActive && materialLang === 'English' && selectedToken.reading && <div className="reader-card-pronunciation">{selectedToken.reading}</div>}
      {classStudyActive && renderClassSentenceAction()}

      {/* 읽기를 이어 갈 단어·뜻을 먼저, 켜 둔 참고 정보는 그 아래에 바로 표시한다. */}
      {materialLang === 'Korean' && <><small>{vt('분석 결과는 자동 생성되었어요.')}</small>{localizedWord.morphology.length > 0 && <section className="reader-card-visible"><h3>{vt('문법 해설')}</h3><ul>{localizedWord.morphology.map((item,index)=><li key={index}>{typeof item === 'string' ? item : `${item.form}: ${item.function}`}</li>)}</ul></section>}</>}

      {/* 문형 한 줄(정본 §2.1) — 문법 밑줄이 붙은 단어만. 누르면 그 자리에 비모달 팝오버로 문형 카드(Q6: 접힘 0 유지). */}
      {selectedToken?.id && visibleScan?.byToken.get(selectedToken.id) && (
        <div className="reader-card-pattern" key={`pattern:${selectedToken.id}`}>
          <button type="button" className="reader-card-pattern__line" aria-haspopup="dialog" onClick={() => setPatternOpen(v => !v)}>
            <span className="reader-card-pattern__label">{vt('문형')}</span>{' · '}<span lang={contentLangTag}>{visibleScan.byToken.get(selectedToken.id).patterns?.[0]?.pattern || visibleScan.byToken.get(selectedToken.id).kernel}</span>{' ›'}
          </button>
          {patternOpen && (
            <div className="reader-card-pattern__pop" role="dialog" aria-label={vt('문형')} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setPatternOpen(false); } }}>
              <PatternCard hit={visibleScan.byToken.get(selectedToken.id)} dueSlugs={dueSlugs} weakSlugs={weakSlugs} />
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPatternOpen(false)}>{vt('닫기')}</button>
            </div>
          )}
        </div>
      )}

      {senseListCount(senseGroups) > 0 && (() => {
        // 예문(우리 사전 refVocab)은 그 뜻 바로 아래 — 복습 카드의 정본 헬퍼로 기본형을 <mark>. 이합사 삽입형(道了歉)처럼
        // 기본형이 연속으로 없으면 term이 null이라 강조 없이 둔다(조각 오탐 금지). 수업 모드는 예문 접힘을 지금대로 둔다.
        const example = refVocab?.word?.ex ? (
          <div className="reader-card-example__text">
            <div lang="zh-Hans">{(() => {
              const { parts, term } = splitSentenceAroundWord(refVocab.word.ex.zh, headText, null);
              return parts.map((part, i, arr) => (
                i < arr.length - 1
                  ? <span key={i}>{part}<mark className="review-card__highlight">{term}</mark></span>
                  : <span key={i}>{part}</span>
              ));
            })()}</div>
            <div className="pinyin-text reader-card-example__reading">{refVocab.word.ex.pinyin}</div>
            <div className="reader-card-example__meaning">{refVocab.word.ex.ko}</div>
          </div>
        ) : null;
        const count = senseListCount(senseGroups);
        return <>
          <section className="reader-card-senses" aria-label={vt('사전 뜻 · {count}개', { count })} key={`senses:${selectedToken.id||selectedToken.text}`}>
            <h3 className="reader-card-section__label">{vt('사전 뜻 · {count}개', { count })}</h3>
            <ol className="reader-card-sense-list">
              {senseGroups.flatMap((group) => group.items.map((item, k) => {
                const line = <>
                  <span className="reader-card-sense__pos">{k === 0 && group.pos ? vt(group.pos) : ''}</span>
                  <span className="reader-card-sense__n" aria-hidden="true">{'①②③④⑤⑥⑦⑧⑨⑩'[item.n - 1] || `${item.n}.`}</span>
                  <span className="reader-card-sense__meaning">{item.meaning}</span>
                  {item.current && <span className="reader-card-sense__context">{vt('문맥상')}</span>}
                </>;
                return <li key={item.n} className={`reader-card-sense${item.current ? ' is-current' : ''}`}>
                  {/* PR③: 권한이 있으면 「문맥상」이 아닌 줄을 눌러 그 뜻을 이 자리 뜻으로(정본 §2.1). 없으면 표시만(Q3). */}
                  {senseEditable && !item.current ? <button type="button" className="reader-card-sense__pick" data-meaning={item.meaning}
                    aria-label={vt('이 자리 뜻으로 바꾸기 · {meaning}', { meaning: item.meaning })} title={vt('이 자리 뜻으로 바꾸기 · {meaning}', { meaning: item.meaning })}
                    disabled={senseBusy} onClick={() => chooseSense(item)}>{line}</button> : line}
                  {item.example && !classStudyActive && example}
                </li>;
              }))}
            </ol>
          </section>
          {classStudyActive && example && <ViewerReferenceExample key={`example:${selectedToken.id || selectedToken.text}`} matches={referenceMatches} meaning={refVocab.word.ko || vt('뜻 확인')} uiLocale={uiLocale} visible={false}>{example}</ViewerReferenceExample>}
        </>;
      })()}

      {/* 한자 정보(우리 사전 노트, 가짜 동족어 경고 포함) — 한자 대조가 꺼져 있을 때, 사전 뜻 다음. 일반 모드 접힘 0, 수업 모드 접힘 그대로. */}
      {refVocab?.word?.hanja && !showHanjaKo && (
        classStudyActive?<details key={`hanja:${selectedToken.id||selectedToken.text}`}><ViewerLabelSlot locale={uiLocale} text={vt('한자 정보')}><summary>한자 정보</summary></ViewerLabelSlot><p>{refVocab.word.hanja}</p></details>:<section className="reader-card-visible reader-card-hanja" key={`hanja:${selectedToken.id||selectedToken.text}`}><h3>{vt('한자 정보')}</h3><p>{refVocab.word.hanja}</p></section>
      )}

      {/* 일반 모드 = 교재 설명(접힘 없는 section), 수업 모드 = 수업 상세 + 교재 설명(지금대로). */}
      {classAction}

      {/* 더 알아보기(정본 §2.1) — AI로 새로 만드는 것이라 요청 버튼. 이미 만든 결과(캐시)가 있으면 버튼 대신 내용.
          한국어 나눈 조각(§7.5)은 기존 형태 분석 설명만 쓴다 — AI 요청 버튼을 두지 않는다. */}
      {!koreanPieceSelected && <section ref={learnRef} className="reader-card-learn" aria-label={vt('더 알아보기')} key={`learn:${selectedToken.id||selectedToken.text}`}>
        <h3 className="reader-card-section__label">{vt('더 알아보기')}</h3>
        {synAntEligible(selectedToken,materialLang) && (synAnt?.loading ? <p role="status">{vt("불러오는 중…")}</p>
          : synAnt && !synAnt.error ? <div className="syn-ant"><div className="syn-ant__row"><span>{vt("유의어")}</span>{renderSynAntChips(synAnt.syn)}</div><div className="syn-ant__row"><span>{vt("반의어")}</span>{renderSynAntChips(synAnt.ant)}</div>{!synAnt.syn.length&&!synAnt.ant.length&&<p>{vt("표시할 항목이 없어요.")}</p>}</div>
          : <>{synAnt?.error && <p role="status">{vt("불러오지 못했어요.")}</p>}<button type="button" className="btn btn--ghost btn--sm reader-card-learn__ask" onClick={() => setSynAntRequest(n => n + 1)}>{vt("✦ 비슷한 말 찾기")}</button></>)}
        {wordDetail?.loading ? <p role="status">{vt("상세 설명 생성 중...")}</p>
          : wordDetail?.detail ? <div className="reader-card-learn__detail"><small>{vt('일반 사전 설명 · 본문과 다른 뜻이 포함될 수 있어요')}</small><div className="pdf-detail-popup__text" lang={effectiveExplanationLocale} dangerouslySetInnerHTML={{ __html: formatDetail(wordDetail.detail) }} /></div>
          : <button type="button" onClick={() => fetchWordDetail(selectedToken)} className="btn btn--ghost btn--sm reader-card-learn__ask">{vt("✦ 자세한 설명")}</button>}
        {/* 일본어로는(AE-R3 PR② — 일본어 대조 블록 대체, 설계서 §5): 日 줄이 숨겨졌을 때만(수업 모드는 자형 열이 없으므로 항상) —
            사전 diff/warn이 있으면 내용, 없으면 로그인 사용자에게 요청 버튼(기존 클라 AI 그대로, 「AI」 표 없음). 쓰기 0. */}
        {materialLang === 'Chinese' && (classStudyActive || !glyph.ja) && <ViewerJapaneseMore key={`ja:${selectedToken.id||selectedToken.text}:${refMeaning||''}`} userId={user?.id} word={headText} meaning={refMeaning||selectedToken.meaning||''} pos={selectedToken.pos} dictEntry={editDictEntry} jaTable={jaWordsTable} dictLoading={!dictFetched&&!dictError} />}
      </section>}
      {/* 출처 줄(정본 §2.1 · 설계서 §6 O1 보수안): 日 줄이 JMdict 파생 표에서 왔을 때만 — EDRDG가 화면마다 표기를 요구한다. */}
      {glyph.ja?.source === 'jmdict' && !classStudyActive && <p className="reader-card-credit"><Link href="/credits#jmdict">{vt('일본어 읽기 · JMdict (EDRDG) · CC BY-SA 4.0')}{' ›'}</Link></p>}

      </div>
      <div className="reader-card-actions">
      {koreanPieceSelected && <p className="reader-card-boundary-note" role="status">{vt('나눈 조각은 단어장에 담지 않아요.')}</p>}
      {!learningStorageSupported && !koreanPieceSelected && <p role="status">{vt("한국어 단어 저장·복습은 아직 준비 중이에요.")}</p>}
      {user && learningStorageSupported && !koreanPieceSelected && (() => {
        // 아는 단어 = 등급 줄(또는 저장 줄) 오른쪽 체크(정본 §2.1 하단, 오너 확정). aria-pressed·문구·쓰기 경로는 그대로.
        const knownToggle = learningCapabilities.known && knownLangCode && <button type="button" className="btn btn--ghost btn--sm word-detail-card__known" aria-pressed={selectedKnown}
          title={vt(selectedKnown ? '아는 단어 표시 해제' : '아는 단어로 표시')}
          disabled={!wordStateReady || knownPending || exclusionState.mutation.isPending || inlineReviewMutation.isPending || saveAnim || !selectedKnownWord || [...selectedKnownWord].length > 100}
          onClick={() => knownState.mutation.mutate({ lang: knownLangCode, wordText: selectedKnownWord,
            known: !selectedKnown, removeKeys: selectedKnownKeys })}>
          {vt(selectedKnown ? '✓ 아는 단어' : '아는 단어')}
        </button>;
        // 저장(복습 전) = 등급 대신 한 줄 「✓ 단어장에 있음 · 다음 복습 날짜 [이 문맥 추가] ☐ 아는 단어」.
        const savedRow = !selectedExcluded && isWordSaved && !saveAnim && !inlineReviewMutation.isPending && !isTokenInlineDue(savedWords, selectedToken, materialLang);
        if (!savedRow) return <div className="save-grade__header">
          <p className="save-grade__guide">{vt("얼마나 알겠어요?")}</p>
          {knownToggle}
        </div>;
        return (
          <div className="word-detail-card__actrow save-grade__saved">
            <span className="save-grade__status">
              <button disabled className="btn btn--ghost btn--sm save-grade__in">{vt('✓ 단어장에 있음')}</button>
              {nextReview && <span className="save-grade__next">{nextReview.due ? vt('복습 차례') : vt('다음 복습 {date}', { date: nextReview.label })}</span>}
            </span>
            {koreanSaveReady(selectedToken) && <SaveContextButton key={`${id}:${selectedToken.id || selectedToken.text}:${leftPanelText}:${materialLang === 'Korean' ? `${effectiveExplanationLocale}:${readingContextSource(selectedToken)?.sourceRevision}` : ''}`}
              label={vt("이 문맥 추가")} word={contextWord(selectedToken)} source={readingContextSource(selectedToken)} />}
            {knownToggle}
          </div>
        );
      })()}
      {user && (exclusionState.isError || knownState.isError) && <button type="button" className="btn btn--ghost btn--sm" onClick={() => { exclusionState.refetch(); knownState.refetch(); }}>{vt("상태 다시 확인")}</button>}

      {user && learningCapabilities.review && !koreanPieceSelected && findSavedVocab(savedWords, selectedToken, materialLang) && isTokenInlineDue(savedWords, selectedToken, materialLang) && !inlineReviewMutation.isPending && (
        // W R3㉮ — 척도를 정본에 맞춘다: 모름/애매/알아=1/2/3(Easy 없음)이 아니라 복습 화면과 같은 4등급.
        // 라벨·순서·클래스 = SAVE_GRADES(복습 화면 ScoreSection과 동일 계약). 키 1~4·⌘Z는 카드 리스너.
        <div style={{ padding: '10px 12px', background: 'color-mix(in srgb, var(--warning) 10%, transparent)', borderRadius: 'var(--radius-md)', marginBottom: 12, border: '1px solid var(--warning)' }}>

          <div className="review-score-grid save-grade save-grade--inline">
            {SAVE_GRADES.map((g) => (
              <button
                key={g.grade}
                type="button"
                onClick={() => gradeInline(g.grade)}
                disabled={selectedExcluded || !wordStateReady || knownPending || exclusionState.mutation.isPending || inlineReviewMutation.isPending}
                className={`review-score-btn review-score-btn--${g.cls}`}
                title={vt('{label} (키 {key})', {label: vt(g.label), key: g.key})}
              >
                <span className="save-grade__key" aria-hidden="true">{g.key}</span>
                {vt(g.label)}
              </button>
            ))}
          </div>
        </div>
      )}
      {!user && material?.__local && !koreanPieceSelected && (
        // 팀 사본(v2-AB R2 S2) — 담기 CTA. 「로그인이 필요합니다」 토스트 대신 돌아올 길이 있는 시트.
        <div className="save-grade__guest">
          <p className="save-grade__guide">{vt('로그인하면 「{word}」이(가) 내 단어장에 담기고 며칠 뒤 복습으로 돌아와요.', {word: headText})}</p>
          <div className="word-detail-card__actrow">
            <Link
              href={`/auth?from=${encodeURIComponent(`/class/${material.__team}`)}`}
              className="btn btn--primary btn--sm"
              onClick={loginForGuestSave}
            >{vt("로그인 · 가입 →")}</Link>
          </div>
        </div>
      )}
      {user && learningStorageSupported && materialLang === 'Korean' && koreanSaveConflict && koreanSaveConflict.tokenId === selectedToken.id && koreanSaveConflict.text === selectedToken.text && koreanSaveReady(selectedToken) &&
        <SaveContextButton key={`${id}:${selectedToken.id}:${effectiveExplanationLocale}:${readingContextSource(selectedToken)?.sourceRevision}:conflict`} label={vt("이 문맥 추가")}
          word={contextWord(selectedToken)} source={readingContextSource(selectedToken)} onSaved={() => setKoreanSaveConflict(null)} />}
      {user && learningStorageSupported && !koreanPieceSelected && (() => {
        // 네 등급은 FSRS 평가다. 아는 단어 표시는 별도로 복습을 멈추며 원래 기록을 보존한다.
        if (isWordSaved && isTokenInlineDue(savedWords, selectedToken, materialLang) && !inlineReviewMutation.isPending) return null;
        if (!selectedExcluded && (saveAnim || inlineReviewMutation.isPending)) {
          return (
            <div className="word-detail-card__actrow">
              <button disabled className="btn btn--ghost btn--sm">{vt('저장 중…')}</button>
            </div>
          );
        }
        // 저장(복습 전)은 위 저장 줄(save-grade__saved)이 맡는다.
        if (!selectedExcluded && isWordSaved) return null;
        return (
          <>
            <div className="review-score-grid save-grade">
              {SAVE_GRADES.map((g) => (
                <button
                  key={g.grade}
                  type="button"
                  onClick={() => addToVocab(g.grade)}
                  disabled={selectedExcluded || !wordStateReady || !koreanSaveReady(selectedToken) || knownPending || exclusionState.mutation.isPending}
                  className={`review-score-btn review-score-btn--${g.cls}`}
                  title={vt('{label} — {sub} 다시 만나요 (키 {key})', {label: vt(g.label), sub: vt(g.sub), key: g.key})}
                >
                  <span className="save-grade__key" aria-hidden="true">{g.key}</span>
                  {vt(g.label)}
                  <span className="save-grade__sub">{vt(g.sub)}</span>
                </button>
              ))}
            </div>

          </>
        );
      })()}
      </div>
      {/* 한자 창(AE-R4 PR② — 설계서 §4): 단어창 위 층. 본문 스크롤 상자 밖이라 잘리지 않고, 카드 흐름 밖이라 카드 요소 이동 0.
          표시만(쓰기 0). 중국어 일반 모드만 — 일본어 자료·수업 판서는 위 글자 카드. */}
      {inspectChar && hanjaPopoverMode && <div className="hanja-pop-layer">
        <ViewerHanjaPopover inspect={inspectChar} word={headText} tables={hanjaPopTables} savedRows={savedRowList} material={material?.processed_json}
          refIndex={refVocabIndex} showToneColors={showToneColors} uiLocale={uiLocale} vt={vt} onClose={closeInspectChar} />
      </div>}
    </div>
  );

  const renderRightPanelContent = (classAction=null,classMeaning=null) => {
    const wordDetailCard=renderWordDetailCard(classAction,classMeaning);
    return wordDetailCard || wordListPanel ? (
    <div className="viewer-side__content">
      {wordDetailCard}
      {wordListPanel}
    </div>
  ) : (
    <div className="pdf-side__empty">{vt("단어 클릭 → 상세")}<br />{vt("문장 드래그 → 단어 목록")}</div>
  );

  };
  const rightPanelContent=renderRightPanelContent();

  // ── [문장] 탭(뷰어 v2 AE-R2 PR ③ · 설계서 docs/manabi-viewer-v2-ae-r2.md §3·§11 목업, 정본 §4) ──
  // 순서: 원문 줄(누른 단어만 칠) → 번역 → [더 쉽게][자세히] → 문형 → 단어별 뜻. 번역만 늦게 오고(T3) 나머지는 T0라
  // 진행 표시는 번역 칸에만 둔다 — 원문 줄과 번역 칸 머리는 번역이 와도 움직이지 않고 그 아래만 밀린다.
  // 내용의 원천은 지금처럼 패널 상태(leftPanelText·Result) 하나다(카드 [문장] 탭·막대·이동·드래그·수업이 같은 경로).
  // 단어별 뜻·문형은 자료 토큰에서 만든다(재분석·드래그 목록·만남 기록 0 — 설계서 §3.3). 「AI」 표시는 두지 않는다.
  const renderSentencePanel = () => {
    const cardLine = selectedToken && isSheetOpen ? lineIndexOfToken(selectedToken) : null;
    const fromCard = cardLine !== null && canonicalSentence(ctxSentenceOf(selectedToken)) === leftPanelText;
    const json = material?.processed_json;
    const tokenIds = sentencePanelTokenIds({ text: leftPanelText, rawLines: material?.raw_text?.split('\n') || [], lineTokens: lineTokensByIndex,
      sequence: json?.sequence, dictionary: json?.dictionary, range: tokenRange.range });
    const original = sentencePanelOriginal({ text: leftPanelText, tokens: fromCard ? lineTokensByIndex.get(cardLine) || [] : [], tokenId: fromCard ? selectedToken.id : null });
    const glosses = sentenceWordGlosses(json?.dictionary, tokenIds, { language: materialLang });
    const patterns = sentencePatternHits(visibleScan, tokenIds);
    // 번역 칸 머리는 결과와 같은 마크업(formatDetail의 **번역** 제목, 설명 언어)으로 먼저 그린다 — 결과가 와도 제자리.
    const headLocale = ['ko', 'zh-CN', 'zh-TW'].includes(effectiveExplanationLocale) ? effectiveExplanationLocale : 'ko';
    const head = `**${translateViewerText(headLocale, '번역')}**`;
    const result = leftPanelLoading || leftPanelResult === SENTENCE_TX_LOGIN_REQUIRED ? '' : leftPanelResult;
    return (
      <div className="viewer-side__content reader-sentence">
        {leftPanelText && (
          <div className="reader-sentence__source">
            <p className="pdf-context__original reader-sentence__original" lang={contentLangTag}>{original.before}{original.term && <mark className="reader-card-sentence__term">{original.term}</mark>}{original.after}</p>
            {ttsSupported && (
              <button
                className="reader-sentence__icon"
                onClick={() => speak(leftPanelText, materialLang, ttsOptsFor(ttsRate))}
                aria-label={vt("지정한 문장 듣기")}
                title={vt("지정한 문장 듣기")}
                data-icon-action
              ><ActionIcon name="audio"/></button>
            )}
            {ttsSupported && (
              <button
                className="reader-sentence__icon"
                onClick={() => setDictationSentence(leftPanelText)}
                aria-label={vt("이 문장 받아쓰기")}
                title={vt("이 문장 받아쓰기 — 듣고 입력하면 글자 단위로 채점해요")}
                data-icon-action
              ><ActionIcon name="headphones"/></button>
            )}
          </div>
        )}
        {/* AD-R3 PR③: 드래그한 범위 「⊕ 한 단어로 묶기」 — 원문 줄 아래 · 번역 위(목업). 같은 자리에 확인 줄. 번역 대기 중에도 같은 자리. */}
        {boundaryMergeBlock}
        <div className="reader-sentence__translation">
          {result ? (
            <div className="pdf-context__text" lang={effectiveExplanationLocale} dangerouslySetInnerHTML={{ __html: formatDetail(/\*\*/.test(result) ? result : `${head}\n${result}`) }} />
          ) : (
            <>
              <div className="pdf-context__text" lang={effectiveExplanationLocale} dangerouslySetInnerHTML={{ __html: formatDetail(head) }} />
              {leftPanelResult === SENTENCE_TX_LOGIN_REQUIRED
                ? <Link href="/auth" className="reader-sentence__login">{vt('로그인하면 이 문장의 번역을 볼 수 있어요 →')}</Link>
                : <p className="reader-sentence__pending" role="status">{vt('번역 중…')}</p>}
            </>
          )}
        </div>

        {/* [더 쉽게] (#1077-3) · [자세히] — 한 줄에 나란히(목업 §11). 번역과 무관해 T0부터 누를 수 있다. */}
        <div className="reader-sentence__actions">
          {!openForSentence(easier, leftPanelText) && (
            <button
              className="grammar-btn grammar-detail__toggle"
              onClick={() => easier.run(leftPanelText)}
              disabled={!leftPanelText}
              aria-label={vt("🔤 더 쉽게 ▾")}
            ><ActionIcon name="type"/><span>{vt("🔤 더 쉽게 ▾").replace('🔤 ','').replace(' ▾','')}</span></button>
          )}
          {!openForSentence(grammar, leftPanelText) && (
            <button
              className="grammar-btn grammar-detail__toggle"
              onClick={() => grammar.run(leftPanelText)}
              disabled={!leftPanelText}
              aria-label={vt("자세히 ▾")}
            ><ActionIcon name="book"/><span>{vt("자세히 ▾").replace(' ▾','')}</span></button>
          )}
        </div>
        {/* 쉬운 문장은 원어라 본문과 같은 :lang() 폰트 규칙을 태운다. */}
        {openForSentence(easier, leftPanelText) && (
          <div className="grammar-detail">
            {easier.loading ? (
              <div className="grammar-detail__loading">{vt("쉬운 문장 생성 중…")}</div>
            ) : (
              <div className="pdf-context__text" lang={contentLangTag} dangerouslySetInnerHTML={{ __html: formatDetail(easier.result) }} />
            )}
          </div>
        )}
        {/* [자세히] — 문법 온디맨드(구조+패턴 통합, 정본 챕터 연결). 번역은 위 칸이, 단어 뜻은 아래 단어별 뜻이 맡는다. */}
        {openForSentence(grammar, leftPanelText) && (
          <div className="grammar-detail">
            {grammar.loading ? (
              <div className="grammar-detail__loading">{vt("문법 해설 생성 중…")}</div>
            ) : (
              <>
                {grammar.result && (
                  <div className="pdf-context__text" lang={effectiveExplanationLocale} dangerouslySetInnerHTML={{ __html: formatDetail(grammar.result) }} />
                )}
                {grammar.chapter?.href && (
                  <Link href={grammar.chapter.href} className="grammar-detail__ref">{vt("→ 정본 해설: 「")}{grammar.chapter.title}」 ›
                  </Link>
                )}
                {grammar.chapter && !grammar.chapter.href && <p className="grammar-detail__loading grammar-detail__archived">{vt("→ 정본 해설: 「")}{grammar.chapter.title}」 · {vt("보관된 교재라 열 수 없어요")}</p>}
                {user && learningStorageSupported && grammar.result && grammar.forText && (
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
                    placeholder={vt("이 문장에 대해 더 묻기")}
                    aria-label={vt("문법 추가 질문")}
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

        {/* 문형 — 문법 표시를 켰을 때 이 문장 토큰에 걸린 문형. 카드의 「문형 한 줄」과 같은 요약 문구·PatternCard. */}
        {patterns.length > 0 && (
          <div className="reader-sentence__patterns">
            {patterns.map((hit, index) => (
              <div key={`${hit.kernel}:${(hit.tokenIds || []).join(',')}`}>
                <button type="button" className="reader-card-pattern__line" aria-haspopup="dialog" aria-expanded={sentencePatternOpen === index}
                  onClick={() => setSentencePatternOpen(open => open === index ? null : index)}>
                  <span className="reader-card-pattern__label">{vt('문형')}</span>{' · '}<span lang={contentLangTag}>{hit.patterns?.[0]?.pattern || hit.kernel}</span>{' ›'}
                </button>
                {sentencePatternOpen === index && (
                  <div className="reader-card-pattern__pop" role="dialog" aria-label={vt('문형')} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setSentencePatternOpen(null); } }}>
                    <PatternCard hit={hit} dueSlugs={dueSlugs} weakSlugs={weakSlugs} />
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSentencePatternOpen(null)}>{vt('닫기')}</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 단어별 뜻 — 자료 토큰(이미 화면의 뜻·교정 반영), 요청 0. 탭 이름에는 표시가 없다(정본). */}
        {glosses.length > 0 && (
          <section className="reader-sentence__glosses" aria-label={vt('단어별 뜻')}>
            <p className="reader-card-section__label">{vt('단어별 뜻')}</p>
            <ul>
              {glosses.map(g => (
                <li key={g.key}><span lang={contentLangTag}>{g.text}</span>{g.reading && <> <span className="reader-sentence__reading" lang={contentLangTag}>{g.reading}</span></>} <span>{g.meaning}</span></li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  };
  const leftPanelContent = leftPanelLoading || leftPanelResult ? renderSentencePanel() : (
    <div className="pdf-side__empty">{vt("텍스트를 드래그하면")}<br />{vt("번역과 맥락이 여기에")}</div>
  );

  // --dragging: 지정 드래그 중 바텀시트 포인터 투과 — 시트가 드래그 도중 자라
  // 경로를 덮어도 elementFromPoint가 밑의 토큰을 잡는다(useTokenRangeSelect 참조)
  return (
    <ViewerUiLocaleProvider value={uiLocale}>
    <div className="viewer-workspace-boundary" data-active={!!(classStudyActive&&classBoardLayout)}>
    <div className={`viewer-3col viewer-layout viewer-theme-${theme}${tokenRange.dragging ? ' viewer-3col--dragging' : ''}`}
      style={{...textbookThemeStyle(materialLang),'--board-ratio':`${classBoardRatio}%`,'--reader-font':readerFontFamily(materialLang,fontFamily),'--pinyin-size':`${pinyinSize}rem`,'--pinyin-cell':`${pinyinCell}px`}}
      lang={uiLocale} data-ui-locale={uiLocale} data-explanation-locale={effectiveExplanationLocale} data-reader-theme={theme} data-language={materialLang} data-class-study={classStudyActive} data-teaching-board={classStudyActive?classBoardLayout:''} data-inspector-open={inspectorOpen&&!modalBlocked}
      data-pron-spacing={materialLang==='Chinese'&&pronDisplay!=='none'?'reserved':'natural'}
      data-left-active={!!(leftPanelLoading || leftPanelResult)}
      data-right-active={!!(dragTokens !== null || (selectedToken && isSheetOpen))}>

      {/* 중앙 — 뷰어 본문 */}
      {materialLang==='Chinese'&&fontFamily==='serif'&&<ChineseSerif rootRef={readerRef} onStatus={setFontStatus}/>}
      <div ref={classBoardHeaderTarget} className="teaching-board-topbar-host" hidden={!classStudyActive||!classBoardLayout}/>
      <div ref={classBoardTarget} className="teaching-board-host" hidden={!classStudyActive||!classBoardLayout}/>
      <div className="viewer-center" inert={dictationPickerOpen||!!dictationSentence?true:undefined} aria-hidden={dictationPickerOpen||!!dictationSentence?true:undefined} data-answer-hidden={dictationPickerOpen||!!dictationSentence}>
      {explanationLocale !== effectiveExplanationLocale && <p role="status">{vt('이 자료의 설명 언어는 한국어로 제공돼요.')}</p>}
      {!user && (
        <div className="viewer-guest-banner">
          <span>{vt("단어를 클릭해 뜻을 확인할 수 있어요.")}</span>
          <Link href="/auth" className="viewer-guest-banner__cta">{vt("로그인하면 단어장에 저장하고 복습할 수 있습니다 →")}</Link>
        </div>
      )}

        {/* 경로 줄(뷰어 정돈 A안) — 왼쪽 [← 자료실 · 형제 내비], 오른쪽 [도구]. 본문 위에는 경로·제목·도구만
            남고, 끝의 행동(읽기 완료·오늘 학습·다음 범위)은 본문 **아래**로 갔다(「끝은 끝에」). 예전 액션바는
            폰에서 두 줄(89px)로 꺾였고, 그 위에 뒤로가기 줄·시리즈 내비 줄이 따로 있었다. */}
        <div ref={classToolbarTarget} className="class-workspace-topbar" hidden={!classStudyActive}/>
        <div className="viewer-topbar">
          {classStudyActive&&originalParams.get('returnTo')?.includes('view=history')&&<LibraryReturnLink className="viewer-back-link">{vt("← 수업 기록")}</LibraryReturnLink>}
          {!classStudyActive&&(material?.__local
            ? <Link href={`/class/${material.__team}`} className="viewer-back-link">{vt("← 팀 페이지")}</Link>
            : <LibraryReturnLink className="viewer-back-link viewer-back-link--icon" aria-label={vt(readerReturnLabel(originalParams.get('returnTo')))} title={vt(readerReturnLabel(originalParams.get('returnTo')))} data-icon-action><ActionIcon name="back"/></LibraryReturnLink>)}
          {composerOf(material) && <Link className="viewer-back-link" href={sourcePassageHref(material,originalParams.get('returnTo')) || `/viewer/${composerOf(material)?.parentId || id}?returnTo=${encodeURIComponent(originalParams.get('returnTo') || '/materials?view=owned')}`}>{passageOf(material)?`원본의 ${passageLocation(passageOf(material))}으로 ↗`:'현재 글과 첨부 원본 ↗'}</Link>}
          {siblingNav && (
            <div className="viewer-series-nav" title={siblingNav.label}>
              {siblingNav.prev ? (
                <Link href={classStudyNeighborHref(siblingNav.prev,studyContext,originalParams.get('returnTo'))} className="viewer-series-nav__btn" title={siblingNav.prev.title} aria-label={siblingNav.prevLabel} data-icon-action><ActionIcon name="previous"/></Link>
              ) : <span className="viewer-series-nav__btn viewer-series-nav__btn--disabled" aria-hidden="true"><ActionIcon name="previous"/></span>}
              {siblingNav.pos != null && (
                <span className="viewer-series-nav__position" title={siblingNav.label}>
                  {siblingNav.pos}/{siblingNav.total}
                </span>
              )}
              {siblingNav.next ? (
                <Link href={classStudyNeighborHref(siblingNav.next,studyContext,originalParams.get('returnTo'))} className="viewer-series-nav__btn" title={siblingNav.next.title} aria-label={siblingNav.nextLabel} data-icon-action><ActionIcon name="next"/></Link>
              ) : <span className="viewer-series-nav__btn viewer-series-nav__btn--disabled" aria-hidden="true"><ActionIcon name="next"/></span>}
            </div>
          )}
          {/* 도구는 도구끼리 오른쪽(v2-Q 축 그대로). 분석 중단은 지금 도는 분석에 대한 일시 제어라 여기.
              AD-R2(VIEWER-V2-ROUNDS-001 §5): 아이콘 + 보이는 짧은 라벨(듣기 · Aa · 학습). 접근 이름은 그대로라
              보이는 라벨이 이름 안에 든다(Aa는 「Aa 읽기 설정」 — WCAG 2.5.3). ⋯ 자료 관리는 「학습」 창 항목으로(설계 Q1 ③ — 시리즈 내비 + 소유자의
              390px 두 줄 해소), 자동 진행은 바닥 한 자리(단독 버튼 ↔ 문장 이동 막대 안, 설계 Q3 A)로 옮겼다. */}
          <div className="viewer-topbar__tools">
            {user?.id === material?.owner_id && reanalyzeMutation.isPending && (
              <button onClick={stopReanalysis} disabled={reanalyze.committing} className="grammar-btn grammar-btn--danger">{vt("분석 중단")}</button>
            )}
            {ttsSupported && <ListenControls text={material?.raw_text} language={materialLang} stopSignal={activeModal?.kind} playbackRate={TTS_RATES[ttsRate].web} compact uiLocale={uiLocale} />}
            <button ref={settingsTrigger} className="viewer-tool viewer-tool--aa" aria-label={`Aa ${vt("읽기 설정")}`} title={vt("읽기 설정")} aria-haspopup="dialog" onClick={() => setSettingsOpen(true)}>
              <span aria-hidden="true">Aa</span>
            </button>
            <button className="viewer-tool" aria-haspopup="dialog" onClick={()=>changeModal('activities',true)}>
              <ActionIcon name="book"/><span>{vt("학습")}</span>
            </button>
          </div>
        </div>
      <ClassSourceFocus material={material} user={user} params={originalParams} tokenRefs={tokenRefs} onResolve={(target,source)=>{
        closeWordCard();clearAnalysisPanels();tokenRange.clearRange();setPickedLineIdx(null);setSelectedRangeText(source.quote);
        if(target.first===target.last&&json.dictionary[target.first]?.text===source.quote){setSelectedToken({...json.dictionary[target.first],id:target.first});setIsSheetOpen(true);setRightSheetSignal(v=>v+1);}
        else {tokenRange.restoreRange(target.first,target.last);setRestoredClassSource({materialId:String(material.id),quote:source.quote,anchor:classAnchorAt(textbookStream(json).text,target.start,target.end,source.quote)});setLeftPanelText(source.quote);const from=json.sequence.indexOf(target.first),to=json.sequence.indexOf(target.last);setDragTokens(json.sequence.slice(from,to+1).filter(tid=>json.dictionary[tid]?.pos!=='개행').map(tid=>({...json.dictionary[tid],id:tid})));setRightSheetSignal(v=>v+1);}
      }}/>
      <ClassCopyNotice key={String(id)} material={material} user={user} returnTo={originalParams.get('returnTo')}/>
      <header className="page-header viewer-header">
        <p className="reader-metadata reader-edition">{vt(languageInfo?.labelKo || langNameKo(materialLang))}{material?.processed_json?.metadata?.level ? ` · ${material.processed_json.metadata.level}` : ''} · {vt(material.visibility === 'public' ? '공개 읽기' : '내 자료')}</p>
        {composerOf(material) && <p className="reader-metadata">{passageOf(material)?`${passageLocation(passageOf(material))}에서 고른 학습 구간이에요. 원본은 위의 링크에서 열 수 있어요.`:'학습에 사용한 본문이에요. 현재 글은 위의 링크에서 열 수 있어요.'}</p>}
        {titleEditing && user?.id === material?.owner_id && !composerOf(material) ? (
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
            <Button size="sm" type="submit" disabled={updateTitleMutation.isPending || !titleDraft.trim()}>{vt("저장")}</Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setTitleEditing(false)}>{vt("취소")}</Button>
          </form>
        ) : (
          /* `편집`이 h1 **안** 인라인이라 상첨자처럼 떠 제목의 일부로 읽혔다. h1은
             그라디언트 텍스트라 버튼 글자까지 그 클립에 얹혀 있었고, hover 색을 JS로
             매만지고 있었다(:hover가 할 일). 밖으로 빼고 baseline으로 맞춘다.
             ※ 여기 있던 `flex: 1`은 죽은 값이었다 — 부모(.page-header)가 flex가 아니다. */
          <div className="viewer-titlerow">
            <h1 className="page-header__title">{material.title}</h1>
            {user?.id === material?.owner_id && !composerOf(material) && (
              <button
                className="viewer-title-edit"
                onClick={() => { setTitleDraft(material.title); setTitleEditing(true); }}
                title={vt("제목 편집")}
                aria-label={vt("제목 편집")} data-icon-action
              ><ActionIcon name="edit"/></button>
            )}
          </div>
        )}
        {!classStudyActive&&<LibrarySaveButton material={material}/>}
        {user && material?.visibility === 'public' && material?.owner_id !== user.id && (
          <ReportMaterialButton materialId={material.id} userId={user.id} toast={toast} />
        )}
        {/* 배지 3종은 여태 header의 **직계 자식**이었다 — 래퍼가 없어 폭이 제각각이었고
            (inline-block 하나 vs 전체 폭 둘) 세로도 3줄을 먹었다. 한 줄로 모은다.
            인라인 style 3벌은 공용 클래스로 — v2-K R1 토큰화가 남긴 나머지다. */}
        {savedWordsError && <p role="alert">{vt("잠시 후 다시 시도해주세요.")} <button type="button" onClick={() => refetchSavedWords()}>{vt("다시 시도")}</button></p>}
        {((user && dueInMaterial > 0) || coverage || collectedInMaterial > 0) && (
          <div className="viewer-badges">
            {user && dueInMaterial > 0 && (
              <span className="viewer-badge viewer-badge--due" title={vt("복습할 것")}>
                {vt('{count}개 복습 가능', {count: dueInMaterial})}</span>
            )}
            {/* 통계 줄 한 덩어리(AD-R2 §5 「크롬 정리」): 커버리지 · 이 자료에서 담은 수 → 단어장. 수집 칩은 #1331이
                지웠고(전체 단어장 수였다), 여기서는 이 자료 기준 수로 같은 줄에 되돌린다(설계 Q4). */}
            {(coverage || collectedInMaterial > 0) && (
              <span className="viewer-badge viewer-stats">
                {coverage && <span title={vt("담은 단어와 '이미 알아요' 표시를 합쳐 센 값 — 서재 맞춤도와 같은 계산이에요")}>{vt('아는 단어 {percent}% · 새 단어 {count}개', {percent: Math.round(coverage.coverage * 100), count: coverage.unknown})}</span>}
                {coverage && collectedInMaterial > 0 && ' · '}
                {collectedInMaterial > 0 && <Link href="/vocab" prefetch={false} className="viewer-stats__vocab">{vt('{count}개 수집 → 단어장', {count: collectedInMaterial})}</Link>}
              </span>
            )}
          </div>
        )}
        {/* AD-R4 PR③ 「뜻 확인 필요 N개 [보기]」(설계서 §6.1·§6.4) — 통계 줄 아래 한 줄. 소유자만 · N>0만 · ✕는 이 viewerRevision 동안. 「AI」 표시 없음. */}
        {senseReviewShown && (
          <p className="viewer-sense-review-line">
            <span aria-hidden="true" className="viewer-sense-review-line__icon">ⓘ</span>
            <span className="viewer-sense-review-line__text">{vt('뜻 확인 필요 {count}개', {count: senseReviewList.length})}</span>
            <button type="button" className="btn btn--ghost btn--sm viewer-sense-review-line__open" aria-expanded={senseReviewOpen} onClick={openSenseReview}>{vt('보기')}</button>
            <button type="button" className="viewer-sense-review-line__close" aria-label={vt('뜻 확인 필요 알림 닫기')} title={vt('뜻 확인 필요 알림 닫기')} onClick={dismissSenseReview} data-icon-action><ActionIcon name="close"/></button>
          </p>
        )}
      </header>
      {!originalParams.get('sourceEntry')&&!originalParams.get('sourceQuote')&&<ReadingSourceFocus rawText={material?.raw_text} materialId={id} ready={!!material?.processed_json?.sequence?.length} json={material?.processed_json} onTarget={setSourceFocusId} />}
      {positionError && <div className="error-banner" role="status">{vt("읽기 위치를 저장하지 못했어요.")}<button type="button" className="btn btn--ghost" onClick={retryPosition}>{vt("다시 저장")}</button></div>}

      {/* 출처 표기(v2-F R5) — CC BY는 **표기가 라이선스 조건**이다. `metadata.source`가
          저장만 되고 어디에도 안 보이던 것을 여기서 드러낸다(저장은 표기가 아니다).
          라이선스를 모르는 개인 반입분에도 채널·원본 링크는 준다 — 어차피 필요한 정보다. */}
      {(() => {
        const at = attributionParts(material?.metadata?.source);
        if (!at) return null;
        return (
          <p className="viewer-attribution">{vt("출처:")}{at.channel || '유튜브'}
            {at.license && <> · <span className="viewer-attribution__license">{at.license}</span></>}
            {at.url && <> · <a href={at.url} target="_blank" rel="noopener noreferrer">{vt("원본 보기")}</a></>}
          </p>
        );
      })()}

      {/* PDF 출처 — 유튜브 출처와 **같은 한 줄 문법**(뷰어 정돈 A안). 예전엔 148px 카드(제목·쪽·총쪽·원본
          링크·다음 범위 버튼)였다. 「다음 p.N 분석」은 성격이 「다음 편」이라 본문 아래 다음 카드로 갔다.
          역방향 다리(v2-H R2)는 그대로 — 돌아갈 자리는 자료 행이 이미 안다(page_start). */}
      {sourcePdf && material.page_start && (
        <p className="viewer-attribution">{vt("출처: PDF 《")}{sourcePdf.title}》 p.{material.page_start}-{material.page_end}
          <span className="viewer-attribution__muted"> / {sourcePdf.page_count}p</span>
          {' · '}<Link href={pdfViewerHref(sourcePdf.id, material.page_start)}>{vt("원본 PDF 보기 →")}</Link>
        </p>
      )}

      {/* Reading Progress Bar */}
      {isDone && (
        <div className="viewer-progress-bar" aria-label={`읽기 진행률 ${readProgress}%`}>
          <div className="viewer-progress-bar__fill" style={{ width: `${readProgress}%` }} />
          <span className="viewer-progress-bar__label">{readProgress}%</span>
        </div>
      )}

      {/* (액션바 자리) — 도구는 경로 줄 오른쪽으로, 행동은 본문 아래 「다 읽었다면」으로 갔다(뷰어 정돈 A안). */}

      {/* 재분석 패널 — position:fixed 중앙이라 설정 카드 해체 후에도 독립 배치(트리 위치 무관) */}
      {user?.id === material?.owner_id && reanalyzePanel && (
        <ViewerModal uiLocale={uiLocale} title={vt("자료 관리")} onClose={()=>setReanalyzePanel(null)}>
          {reanalyzePanel === 'menu' && (
            <div className="reader-manage">
              <button className="reanalyze-panel__item" onClick={startFullReanalyze}>
                <strong>{vt("전체 분석")}</strong>
                <span>{vt("처음부터 다시 분석합니다")}</span>
              </button>
              <button className="reanalyze-panel__item" onClick={() => { setReanalyzePanel('pick'); setSelectedParas(new Set()); }}>
                <strong>{vt("부분 분석")}</strong>
                <span>{vt("문단을 선택해서 분석합니다")}</span>
              </button>
              {!composerOf(material) && <button className="reanalyze-panel__item" onClick={() => { setReanalyzePanel(null); setSourceEditOpen(true); }}>
                <strong>{vt("원문 수정")}</strong>
                <span>{vt("텍스트를 고치면 바뀐 줄만 분석합니다")}</span>
              </button>}
            </div>
          )}
          {reanalyzePanel === 'pick' && (
            <div className="reader-manage reader-manage--pick">
              <div className="reanalyze-panel__header">
                <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{vt("문단 선택")}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{vt('{count}개 선택', {count: selectedParas.size})}</span>
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
                    <span className="reanalyze-panel__lines">{vt('{count}줄', {count: p.lineCount})}</span>
                  </label>
                ))}
              </div>
              <div className="reanalyze-panel__actions">
                <button className="btn btn--ghost btn--sm" onClick={() => setReanalyzePanel(null)}>{vt("취소")}</button>
                <button className="btn btn--primary btn--sm" onClick={startPartialReanalyze} disabled={selectedParas.size === 0}>
                  {vt('{count}개 문단 분석', {count: selectedParas.size})}</button>
              </div>
            </div>
          )}
        </ViewerModal>
      )}

      {/* (책 챕터 내비 바 자리) — 경로 줄의 형제 내비(siblingNav)와 본문 아래 다음 카드로 갔다(뷰어 정돈 A안). */}

      {/* 네트워크가 죽어 캐시 사본으로 살아난 화면임을 알린다(v2-N R1) */}
      {material?.__offline && <OfflineNotice what="자료" />}

      {/* Reader Area — 인앱 토큰 범위 지정(드래그) 이벤트는 여기서 위임 수신 */}
      <div
        ref={readerRef}
        className={`reader-area reader-area--${theme}${focusMode && (pickedLineIdx !== null || tokenRange.range) ? ' reader-area--focus' : ''}${wordStateHl ? ' reader-area--hl' : ''}${paceDwell ? ' reader-area--pacing' : ''}${paceDwell && paceHeld ? ' reader-area--pacing-hold' : ''}`}
        style={{
          fontSize: `${fontSize*(classStudyActive&&classBoardLayout==='split'?.8:1)}rem`,
          fontFamily: readerFontFamily(materialLang,fontFamily),
          gap: `max(${lineGap}px, var(--hl-row-gap-min, 0px)) ${charGap}rem`, '--char-gap': `${charGap}rem`,
          // 체류 표시는 CSS 애니메이션이 시간을 잰다 — JS 프레임 루프 0(설계 §7①).
          ...(paceDwell ? { '--pace-dwell': `${paceDwell}ms` } : null),
        }}
        onPointerDown={tokenRange.handlePointerDown}
        onClickCapture={tokenRange.handleClickCapture}
        onClick={handleReaderBlankClick}
      >
        {/* 이합사 연결 아치 오버레이 — reader-area(position:relative, 그립 선례) 좌표계 */}
        <svg ref={sepArcRef} className="sep-arc" aria-hidden="true" />
        {isAnalyzing && !needsRecovery && (
          <div className="analyzing-banner">
            <span>{vt(reanalyze.committing ? '검증한 분석을 저장 중입니다…' : reanalyzeMutation.isPending ? '새 분석을 준비 중입니다. 기존 자료는 유지됩니다.' : '문단 단위로 분석 중입니다...')}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => refetch()} className="analyzing-banner__refresh">{vt("새로고침")}</button>
              {user?.id === material?.owner_id && reanalyzeMutation.isPending && (
                <button onClick={stopReanalysis} disabled={reanalyze.committing} className="analyzing-banner__refresh" style={{ background: 'var(--danger)' }}>{vt("⏹ 중단")}</button>
              )}
            </div>
          </div>
        )}

        {needsRecovery && user?.id === material?.owner_id && (
          <div className="analyzing-banner" style={{ background: 'color-mix(in srgb, var(--warning-bright) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--warning-bright) 40%, transparent)' }}>
            <span role="status" aria-live="polite">{reanalyze.committing
              ? '검증한 분석을 저장 중입니다…'
              : reanalyze.recovery
                ? `${reanalyze.recovery.total}곳 중 ${reanalyze.recovery.completed}곳을 복구했어요. 기존 내용은 그대로 볼 수 있어요.`
                : reanalyzeMutation.isPending ? '새 분석을 준비 중입니다. 기존 자료는 유지됩니다.'
                  : missingLineCount > 0 ? `분석이 끝나지 않은 부분이 ${missingLineCount}곳 있어요.` : '분석 결과를 확인하고 마무리할 수 있어요.'}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {reanalyzeMutation.isPending
                ? <button onClick={stopReanalysis} disabled={reanalyze.committing} className="analyzing-banner__refresh" style={{ background: 'var(--danger)' }}>{vt("⏹ 중단")}</button>
                : <button onClick={() => reanalyze.mutation.mutate({ resume: true })} className="analyzing-banner__refresh" style={{ background: 'var(--reader-accent)' }}>{vt("▶ 이어서 분석")}</button>
              }
            </div>
          </div>
        )}

        {isPending && (
          <div className="analyzing-banner">
            <span>{composerOf(material) ? '저장한 본문이에요. 표현을 공부할 때 분석을 시작하세요.' : '이 챕터는 아직 분석 전이에요 — 원문은 그대로 읽을 수 있어요.'}</span>
            {user?.id === material?.owner_id && (
              reanalyzeMutation.isPending
                ? <button onClick={stopReanalysis} disabled={reanalyze.committing} className="analyzing-banner__refresh" style={{ background: 'var(--danger)' }}>{vt("⏹ 중단")}</button>
                : <button onClick={startFullReanalyze} className="analyzing-banner__refresh">{composerOf(material) ? '본문 분석하기' : '이 챕터 분석하기'}</button>
            )}
          </div>
        )}

        {isFailed && (
          <div className="analyzing-banner analyzing-banner--error">
            <span>{vt("분석에 실패했습니다.")}</span>
            {reanalyzeMutation.isPending
              ? <button onClick={stopReanalysis} disabled={reanalyze.committing} className="analyzing-banner__refresh" style={{ background: 'var(--danger)' }}>{vt("⏹ 중단")}</button>
              : <button onClick={startFullReanalyze} className="analyzing-banner__refresh">{vt("재분석")}</button>
            }
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

          const showRaw = (isAnalyzing || isPending || needsRecovery) && rawLines.length > 0;

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
                aria-label={vt("문장 전체 분석")}
                title={vt("문장 전체 분석")}
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
                data-source-token={tokenId}
                data-source-text={token.text}
                  className={`word-token word-token--failed${pickedClass}${sourceFocusId === tokenId ? ' learning-source-highlight' : ''}`} style={paceStyle} title={vt("분석 실패 — 재시도 버튼을 눌러주세요")}>
                  {linePick}
                  <span className="furigana" />
                  <span className="surface">{token.text}</span>
                  <span className="failed-marker">!</span>
                </div>
              );
            }
            const {isSaved, isDue, isKnown:tokKnown, highlight:hlClass} = tokenDisplayState(token);
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
            const furiOff = pronHidden;
            // 문형 밑줄은 전용 요소 — .surface::after는 지정 이음매 자리라 고르면 사라졌다(R0 버그 1).
            const patternMark = visibleScan?.byToken.has(tokenId) ? <span className="pattern-mark" aria-hidden="true" /> : null;
            return (
              <div key={tokenId} ref={el => { if (el) tokenRefs.current[tokenId] = el; }}
                data-tid={tokenId}
                data-source-token={tokenId}
                data-source-text={token.text}
                data-text={token.text}
                data-selected={selectedToken?.id===tokenId&&isSheetOpen?true:undefined}
                className={`word-token ${isSaved ? 'word-token--saved' : ''} ${isDue ? 'word-token--due' : ''}${hlClass ? ` ${hlClass}` : ''}${pickedClass}${sepLink?.partnerIds.includes(tokenId) ? ' word-token--sep-linked' : ''}${visibleScan?.byToken.has(tokenId) ? ' word-token--pattern' : ''}${sourceFocusId === tokenId ? ' learning-source-highlight' : ''}`}
                style={paceStyle}
                role="button" tabIndex={0}
                onClick={() => handleTokenClick(token, tokenId)}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), handleTokenClick(token, tokenId))}>
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
                    )}{patternMark}
                  </span>
                ) : (
                  <span className="surface">{token.text}{patternMark}</span>
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
          <div className="sentence-nav" role="group" aria-label={vt("문장 이동")}>
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

        {/* 조작 안내는 첫 자료의 일(뷰어 정돈 A안) — 단어를 한 번이라도 담은 사람에겐 100번째 자료에서도
            뜨던 문장을 접는다. 게스트는 위 배너가 같은 말을 하므로 여기서는 안 한다. 데스크톱은 오른쪽 빈
            패널이 같은 안내를 상시로 하니 CSS가 감춘다(안내는 한 벌). */}
        {isDone && user && savedCount === 0 && (
          <div className="reader-hint">{vt("단어를")}<strong>{vt("클릭")}</strong>{vt("하면 상세 정보, 문장을")}<strong>{vt("드래그")}</strong>{vt("하면 번역+맥락")}</div>
        )}

      </div>

      {/* 다 읽었다면(뷰어 정돈 A안) — **끝의 행동은 끝에**. 읽기 완료(누르면 퀴즈·완독 화면)·오늘 학습은
          예전에 본문 **위** 액션바에 상시로 있었고, 리딩 테스트·회화는 아래에 있어 두 자리로 갈려 있었다.
          한 줄로 모은다. 이벤트·퀴즈·오늘 학습 핸드오프(study_source_*)는 그대로 — 자리만 옮겼다. */}
      {(isDone || isPending) && !showReadingTest && !showConversation && (
        <div className="post-reading">
          <ViewerLabelSlot locale={uiLocale} text={vt('다 읽었다면')}><div className="post-reading__label">다 읽었다면</div></ViewerLabelSlot>
          <div className="post-reading-actions">
            {user && isDone && (
              isCompleted
                ? <span className="post-reading-actions__btn post-reading-actions__btn--done">{vt("✓ 읽기 완료")}</span>
                : <button
                    onClick={() => markCompleteMutation.mutate()}
                    disabled={markCompleteMutation.isPending}
                    className="post-reading-actions__btn post-reading-actions__btn--primary"
                  >
                    {markCompleteMutation.isPending ? '...' : '✓ 읽기 완료'}
                  </button>
            )}
            {user && material?.raw_text && STUDY_LANGS.has(materialLang) && (
              <Link
                href={`/study?source=mine&lang=${encodeURIComponent(materialLang)}`}
                className="post-reading-actions__btn"
                onClick={() => {
                  try {
                    localStorage.setItem(`study_source_${materialLang}`, (material.raw_text || '').slice(0, 1500));
                  } catch {}
                }}
              >{vt("이 글로 연습")}</Link>
            )}
            {isDone && (
              <button className="post-reading-actions__btn" onClick={() => setShowReadingTest(true)}>{vt("리딩 테스트")}</button>
            )}
            {isDone && (
              <button className="post-reading-actions__btn" onClick={() => setShowConversation(true)}>{vt("회화 연습")}</button>
            )}
          </div>
        </div>
      )}


      {STUDY_LANGS.has(materialLang) && <MaterialChapterLinks lang={materialLang} kind="reading" materialId={id} />}

      {/* 다음 — 한 자리에 하나(뷰어 정돈 A안): 시리즈 다음 편 → 책 다음 과 → 마지막 과면 「다음 과 적기」(내 책만,
          이어 적기 #1077 5520128974) → PDF 다음 범위(예전엔 본문 위 카드의 버튼) → 시리즈·레벨 완주. */}
      {(isDone || isPending) && (() => {
        if (nextLesson) {
          return (
            <Link href={classStudyNeighborHref(nextLesson,studyContext,originalParams.get('returnTo'))} className="next-lesson-card">
              <div className="next-lesson-card__hint">{vt("다음 편")}</div>
              <div className="next-lesson-card__title">{nextLesson.title}</div>
            </Link>
          );
        }
        if (bookNav?.next) {
          return (
            <Link href={classStudyNeighborHref(bookNav.next,studyContext,originalParams.get('returnTo'))} className="next-lesson-card">
              <div className="next-lesson-card__hint">{vt("다음 과 ·")}{bookNav.pos + 1}/{bookNav.total}</div>
              <div className="next-lesson-card__title">{bookNav.next.title}</div>
            </Link>
          );
        }
        if (bookNav?.canAppend) {
          return (
            <Link href={`/materials/add?book=${encodeURIComponent(bookNav.key)}`} className="next-lesson-card">
              <div className="next-lesson-card__hint">{vt("+ 다음 과 적기")}</div>
              <div className="next-lesson-card__title">《{bookNav.title || '제목 없는 교재'}》 {bookNav.total}{vt("과가 담겨 있어요 — 이어서 적기")}</div>
            </Link>
          );
        }
        if (sourcePdf && material.page_end && material.page_end < sourcePdf.page_count) {
          const to = Math.min(material.page_end + 5, sourcePdf.page_count);
          return (
            <button
              type="button"
              className="next-lesson-card next-lesson-card--button"
              onClick={() => nextRangeMutation.mutate({ chunkSize: 5 })}
              disabled={nextRangeMutation.isPending}
              title={`p.${material.page_end + 1}부터 분석`}
            >
              <div className="next-lesson-card__hint">{vt("다음 범위")}</div>
              <div className="next-lesson-card__title">
                {nextRangeMutation.isPending ? '추출 중...' : `p.${material.page_end + 1}-${to} 분석 →`}
              </div>
            </button>
          );
        }
        if (isDone && seriesEndCard) {
          return seriesEndCard.material ? (
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
                {seriesEndCard.level} {seriesEndCard.fromSeries}{vt("시리즈 완주!")}</div>
              <div className="series-end-card__title" style={{ color: 'var(--text-muted)' }}>{vt("최고 레벨 도달 — 외부 자료를 활용해보세요")}</div>
            </div>
          );
        }
        return null;
      })()}

      {/* 토론은 공개 자료에만(뷰어 정돈 A안) — 비공개는 작성자만 여니 상대가 없다. 공개로 돌리면 예전 댓글은 그대로. */}
      {material?.visibility !== 'private' && (
        <ViewerComments
          user={user} comments={comments} commentInput={commentInput}
          setCommentInput={setCommentInput} addCommentMutation={addCommentMutation}
          deleteCommentMutation={deleteCommentMutation}
        />
      )}


      </div>{/* viewer-center end */}

      <TextbookAnnotations key={`${id}:${user?.id||'guest'}`} material={material} user={user}
        team={studyContext?.team||/^\/class\/([a-z0-9-]+)(?:\?|$)/.exec(originalParams.get('returnTo')||'')?.[1]}
        first={tokenRange.range?json.sequence[tokenRange.range.start]:isSheetOpen?selectedToken?.id:pickedSentence?.firstTokenId}
        last={tokenRange.range?json.sequence[tokenRange.range.end]:undefined}
        blocked={modalBlocked} onClose={closeWordCard} onPresenting={setClassPresenting}>
      {(annotationContent,annotationOpen,closeWordCard)=><ClassroomReader toolbarTarget={classToolbarTarget} boardTarget={classBoardTarget} boardHeaderTarget={classBoardHeaderTarget} onBoardRatio={setClassBoardRatio} vocabularyIndex={savedWords} onBoardLayout={setClassBoardLayout} annotationContent={annotationContent} context={studyContext} user={user} material={material}
        selection={classSelection} selectionSignal={rightSheetSignal}
        wordContent={(dragTokens!==null||(selectedToken&&isSheetOpen))?renderRightPanelContent:null}
        sentenceContent={(leftPanelLoading||leftPanelResult)?leftPanelContent:null}
        onActive={setClassStudyActive} onPresenting={setClassPresenting} suppressed={modalBlocked&&!classPresenting}
        onSelectionClose={closeWordCard}
        fallback={boardActions=>(annotationOpen || leftPanelLoading || leftPanelResult || senseReviewContent || boundaryPendingContent || dragTokens !== null || (selectedToken && isSheetOpen)) ? <ViewerBottomSheet
        actions={boardActions}
        uiLocale={uiLocale}
        className={boardActions?'viewer-inspector--board':''}
        onClose={closeWordCard}
        suppressed={modalBlocked}
        preserveFocus={annotationOpen&&!isSheetOpen&&dragTokens===null}
        preserveWordTab={preserveOpenWord}
        onOpenChange={setInspectorOpen}
        onPresentChange={setSheetPresent}
        collapsedActions={autoPace&&sentences.length>0&&!modalBlocked?paceToggle('viewer-inspector__pace'):null}
        leftContent={senseReviewContent || boundaryPendingContent || leftPanelContent}
        rightContent={selectedToken&&isSheetOpen?renderRightPanelContent(annotationContent&&<section className="reader-card-notes" aria-label={vt("교재 설명")}><h3 className="reader-card-section__label">{vt("교재 설명")}</h3>{annotationContent}</section>):<>{annotationContent}{rightPanelContent}</>}
        leftActive={leftPanelLoading || !!leftPanelResult || !!senseReviewContent || !!boundaryPendingContent}
        rightActive={annotationOpen || dragTokens !== null || (selectedToken && isSheetOpen)}
        leftSignal={leftSheetSignal}
        rightSignal={rightSheetSignal}
        sentenceTabSignal={sentenceTabSignal}
        onSentenceTab={openSentenceTranslation}
        menu={sheetMenu}
        barNav={pickedLineIdx !== null && sentences.length > 0 ? (
          <>
            {sentenceNavBtn(-1, 'viewer-sheet-bar__btn viewer-sheet-bar__btn--nav')}
            {sentenceNavBtn(1, 'viewer-sheet-bar__btn viewer-sheet-bar__btn--nav')}
          </>
        ) : null}
      /> : boardActions ? null : sentenceMoveBar} />}
      </TextbookAnnotations>
      {paceFloatShown&&<div className={`viewer-pace-float${sheetStripShown?' viewer-pace-float--wide':''}`}>{paceToggle('viewer-pace-float__btn',true)}</div>}

      {settingsOpen&&<ViewerSettings settings={settings} language={materialLang} languageSettings={languageSettings} onClose={closeReadingSettings} keepPosition={keepReadingPosition} previewTokens={previewTokens} paceTargetCpm={paceTargetCpm} paceEstimate={paceHint({chars:pickedSentence?countReadableChars(pickedSentence.text):null,avgChars:paceAvgChars,targetCpm:paceTargetCpm})} myCpm={myCpm} patternNote={patternNote} ttsSupported={ttsSupported} fontStatus={fontStatus}/>}
      {modal('activities')&&<ViewerModal uiLocale={uiLocale} title={vt("학습")} onClose={()=>setActiveModal(null)}><div className="reader-activity-menu">
        {user&&!String(id).startsWith('local:')&&<Link className="btn btn--secondary" href={`/notes/new?${new URLSearchParams({material:String(id),language:materialLang})}`}>{vt("내 학습 노트 펼치기 ↗")}</Link>}
        {ttsSupported&&sentences.length>0&&<button onClick={()=>setDictationPickerOpen(true)}><b>{vt("받아쓰기")}</b><span>{vt("추천 문장 하나를 골라 듣고 써요")}</span></button>}
        {ttsSupported&&pickedSentence&&<button onClick={()=>setDictationSentence(pickedSentence.text)}><b>{vt("선택 문장 받아쓰기")}</b><span>{vt("지금 지정한 문장으로 시작해요")}</span></button>}
        {isDone&&<><button onClick={()=>setShowReadingTest(true)}><b>{vt("읽기 확인")}</b><span>{vt("전체 자료 · 기존 읽기 확인 기록에 연결돼요")}</span></button><button onClick={()=>setShowConversation(true)}><b>{vt("회화 연습")}</b><span>{vt("전체 자료를 주제로 대화해요")}</span></button></>}
        {!isDone&&<p>{vt("자료 분석이 끝나면 읽기 확인과 회화 연습을 사용할 수 있어요.")}</p>}
        {/* 툴바 ⋯의 후신(AD-R2 설계 Q1 ③) — 조건·동작은 그대로, 자리만 「학습」 창의 마지막 항목. */}
        {user?.id===material?.owner_id&&!passageOf(material)&&!isAnalyzing&&<button onClick={()=>{setActiveModal(null);setReanalyzePanel('menu');}}><b>{vt("자료 관리")}</b><span>{vt("다시 분석하거나 원문을 고쳐요")}</span></button>}
      </div></ViewerModal>}
      {/* 리딩 테스트 인라인 확장 */}
      {isDone && showReadingTest && (
        <ViewerModal uiLocale={uiLocale} title={vt("읽기 확인 · 전체 자료")} onClose={()=>setShowReadingTest(false)}>
          <ReadingTest
            rawText={material?.raw_text}
            language={materialLang}
            materialId={id}
            onClose={() => setShowReadingTest(false)}
            onGraded={handleReadingTestGraded}
            inline
            nextLesson={nextLesson}
          />
        </ViewerModal>
      )}

      {/* 회화 연습 인라인 확장 */}
      {isDone && showConversation && (
        <ViewerModal uiLocale={uiLocale} title={vt("회화 연습 · 전체 자료")} onClose={()=>setShowConversation(false)}>
          <ConversationPanel
            rawText={material?.raw_text}
            language={materialLang}
            materialId={id}
            materialTitle={material?.title}
            onClose={() => setShowConversation(false)}
            inline
            nextLesson={nextLesson}
          />
        </ViewerModal>
      )}


      {user?.id === material?.owner_id && (
        <SourceEditModal
          open={sourceEditOpen}
          committing={reanalyze.committing}
          onStop={stopReanalysis}
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
          draftStore={dictationDrafts.current}
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
    </div></div>
    </ViewerUiLocaleProvider>
  );
}
