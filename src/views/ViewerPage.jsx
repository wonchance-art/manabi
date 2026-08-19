'use client';

import { useState, useRef, useEffect } from 'react';
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
import ReportMaterialButton from '../components/ReportMaterialButton';
import ReadingTest from '../components/ReadingTest';
import ConversationPanel from '../components/ConversationPanel';
import ViewerBottomSheet from '../components/ViewerBottomSheet';
import ListenControls from '../components/ListenControls';
import { formatDetail } from '../lib/wordDetailFormat';
import { useSeriesNeighbors } from '../lib/useSeriesNeighbors';
import { useTitleEdit } from '../lib/useTitleEdit';
import { useDragWordPopup } from '../lib/useDragWordPopup';
import { useTokenRangeSelect } from '../lib/useTokenRangeSelect';
import { useNextRangeMutation } from '../lib/useNextRangeMutation';
import { useReadProgress } from '../lib/useReadProgress';
import { useScrollRestore } from '../lib/useScrollRestore';
import { readHanjaKo, listHanjaHunEum, hunsCoverWord, toJaForm } from '../lib/hanjaKo';
import { useGrammarDetail } from '../lib/useGrammarDetail';
import { buildContextPrompt } from '../lib/grammarDetail';
import { analysisCacheKey, clearAnalysisCache, readAnalysisCache, writeAnalysisCache } from '../lib/viewerAnalysisCache';
import { useRefVocabEntry, refLevelLabel } from '../lib/refVocabIndex';
import { getBook } from '../lib/bookMeta';
import { getJaRef, formatJaRef, getJaWarn } from '../lib/jaRef';
import TokenEditPanel from './TokenEditPanel';
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

  // 중국어 병음: 공백 구분 라틴 음절이 글자 수와 일치하면 글자별로 분배.
  // 단어 전체에 통째로 붙이면 rt가 base보다 훨씬 넓어져(图书馆 3자 vs tú shū guǎn 11자)
  // 글자 간격이 벌어진다 — 글자당 음절이 표준 병음 조판. 일본어 후리가나(가나)는 여기 안 걸린다.
  const zhChars = [...text];
  if (furigana.includes(' ') && !/[぀-ヿ]/.test(furigana) && zhChars.every(isKanji)) {
    const syllables = furigana.trim().split(/\s+/);
    if (syllables.length === zhChars.length) {
      // pinyin 표식 — 이 경로만 rt 절대배치·폭 예약을 적용한다. 일본어 요미가나는
      // 요미가 base보다 긴 경우가 5.7%로 흔해(실측) 절대배치로 바꾸면 겹침이 되살아난다.
      return zhChars.map((ch, i) => ({ kanji: ch, reading: syllables[i], pinyin: true }));
    }
  }

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

  // Custom hooks
  const settings = useViewerSettings();
  const { fontSize, setFontSize, lineGap, setLineGap, charGap, setCharGap,
          showHanjaKo, setShowHanjaKo,
          theme, setTheme, fontFamily, setFontFamily, showFurigana, setShowFurigana,
          autoSpeakOnClick, setAutoSpeakOnClick,
          settingsOpen, setSettingsOpen } = settings;

  const quiz = useViewerQuiz();
  const { quizState, completionModal, setCompletionModal, generateQuiz,
          handleQuizAnswer, advanceQuiz, finishQuiz } = quiz;

  const [selectedToken, setSelectedToken] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
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

      let query = supabase
        .from('reading_materials')
        .select('id, title, processed_json')
        .eq('visibility', 'public')
        .neq('id', id)
        .limit(10);

      const { data, error } = await query;
      if (error) throw error;
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

  // 읽기 진행률 바 — readerRef는 본문 컨테이너에 부착
  const { readerRef, readProgress } = useReadProgress(material);

  // 스크롤 위치 저장(debounce 2s) + 재진입 시 자동 복원
  const { saveScrollPosition, tokenRefs } = useScrollRestore({ user, materialId: id, material, readingProgress });

  // 단어 저장 카운트 (복습 유도용)
  const saveCountRef = useRef(0);

  const handleTokenClick = (token, tokenId) => {
    if (token.pos === '개행') return;
    const t = { ...token, id: tokenId };
    setSelectedToken(t);
    setIsSheetOpen(true);
    setDragTokens(null);
    setWordDetail(null);
    setPickedLineIdx(null);
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

  // 드래그 단어 클릭 → AI 상세 팝업 (PDF와 동일)
  const { popupWord, setPopupWord, handleDragWordClick } = useDragWordPopup(materialLang);

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

  // 한자 대조(옵트인) — 한국 한자음 테이블은 토글이 켜질 때만 지연 로드(245KB 청크,
  // 이후 캐시). 표는 뜻이 아니라 발음 앵커: 老师 → 노사(어두 두음법칙).
  // 훈 테이블(①, 143KB)도 같은 조건으로 병행 로드 — 옥편 표제 관례 '늙을 로(노)' 병기.
  const [hanjaKoTable, setHanjaKoTable] = useState(null);
  const [hanjaHunTable, setHanjaHunTable] = useState(null);
  const [hanjaJaTable, setHanjaJaTable] = useState(null);
  useEffect(() => {
    if (!showHanjaKo || materialLang !== 'Chinese' || hanjaKoTable) return undefined;
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
  }, [showHanjaKo, materialLang, hanjaKoTable]);
  const hanjaKoOf = (text) => (
    materialLang === 'Chinese' && showHanjaKo && hanjaKoTable
      ? readHanjaKo(text, hanjaKoTable)
      : null
  );
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

  // 드래그 상세 팝업 단어의 사전 행 — ja 대응 표시용(대조 토글 시)
  const { data: popupDictEntry } = useQuery({
    queryKey: ['token-dict', materialLang, popupWord?.token?.base_form],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('morpheme_dictionary')
        .select('meanings, reading, pos')
        .eq('language', materialLang)
        .eq('base_form', popupWord.token.base_form)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: showHanjaKo && materialLang === 'Chinese' && !!popupWord?.token?.base_form,
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

  const rightPanelContent = dragTokens !== null ? (
    <div className="viewer-side__content">
      <div className="pdf-word-list__header" style={{ marginBottom: 10 }}>
        <span className="pdf-word-list__title">단어 ({dragTokens.length})</span>
      </div>
      {dragAnalyzing && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>분석 중...</div>}
      {dragTokens.map((t, i) => {
        const isSaved = savedWords.surfaces?.has(t.text) || savedWords.bases?.has(t.base_form);
        const saveKey = t.base_form || t.text;
        return (
          <div key={i} className={`pdf-word-item ${isSaved ? 'pdf-word-item--saved' : ''}`}>
            <span className="pdf-word-item__text" onClick={() => handleDragWordClick(t)}>
              {t.text}
              {t.furigana && <span className="pdf-word-item__reading">{t.furigana}</span>}
            </span>
            <span className="pdf-word-item__meaning" onClick={() => handleDragWordClick(t)}>{t.meaning}</span>
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
    </div>
  ) : selectedToken && isSheetOpen ? (
    <div className="viewer-side__content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div lang={materialLang === 'Chinese' ? 'zh-Hans' : undefined} style={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1.3 }}>
            {selectedToken.furigana
              ? splitRuby(selectedToken.text, selectedToken.furigana).map((seg, i) =>
                  seg.kanji ? <ruby key={i}>{seg.kanji}<rt className={seg.pinyin ? 'pinyin-text' : undefined} style={{ fontSize: '0.45em', color: 'var(--primary-light)' }}>{seg.reading}</rt></ruby> : <span key={i}>{seg.plain}</span>
                )
              : selectedToken.text}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
            <TokenPosLabel token={selectedToken} />
            {selectedToken.base_form && selectedToken.base_form !== selectedToken.text && ` · ${selectedToken.base_form}`}
            {refVocab && (
              <span style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 999, background: 'var(--primary-glow)', color: 'var(--primary-light)', fontWeight: 700, fontSize: '0.7rem' }}>
                {refLevelLabel(refVocab.level)}
              </span>
            )}
          </div>
        </div>
        {ttsSupported && (
          <button onClick={() => speak(selectedToken.text, materialLang)} aria-label="발음 듣기" style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', minWidth: 32, minHeight: 32 }} title="발음 듣기">▷</button>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: materialLang === 'English' && selectedToken.reading ? 4 : 14 }}>
        <div style={{ fontSize: '1rem', lineHeight: 1.6, flex: 1, minWidth: 0 }}>
          {refMeaning || selectedToken.meaning || '(뜻 없음)'}
        </div>
        {canEditToken && (
          <button
            onClick={() => setIsEditingToken(v => !v)}
            aria-label="뜻·발음 수정"
            title="뜻·발음 수정"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.95rem', minWidth: 28, minHeight: 28, flexShrink: 0, opacity: isEditingToken ? 1 : 0.55 }}
          >✏️</button>
        )}
      </div>
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
        // 훈음이 전 글자를 커버하면 한자음 단독 줄은 중복이라 생략(오너 확정)
        const hk = hunsCoverWord(selectedToken.text, huns) ? null : hanjaKoOf(selectedToken.text);
        if (!hk && !jr && !warn && !huns) return null;
        return (
          <div style={{ fontSize: '0.82rem', marginBottom: 12 }}>
            {hk && (
              <div style={{ color: 'var(--text-muted)' }}>
                한자음 <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{hk}</span>
              </div>
            )}
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
          한자 노트는 한자 대조 토글(한자음·훈음)과 겹치므로 토글 꺼짐일 때만. */}
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
          <div className="pdf-context__original" lang={materialLang === 'Chinese' ? 'zh-Hans' : undefined} style={{ flex: 1, minWidth: 0 }}>"{leftPanelText.length > 120 ? leftPanelText.slice(0, 120) + '…' : leftPanelText}"</div>
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
    <div className={`viewer-3col viewer-theme-${theme}`}>

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

          {materialLang === 'Chinese' && (
            <button
              onClick={() => setShowHanjaKo(v => !v)}
              className={`grammar-btn ${showHanjaKo ? 'grammar-btn--active' : ''}`}
              title="단어 상세에 한국 한자음(발음 앵커) 병기 — 예: 老师 → 노사"
            >
              {showHanjaKo ? '☑ 한자 대조 켜짐' : '◻ 한자 대조 꺼짐'}
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
        className={`card reader-area reader-area--${theme}`}
        style={{
          fontSize: `${fontSize}rem`,
          // 중국어 자료는 간체 표준 자형(SC)이 우선(오너 확정) — 사용자 글꼴 설정(KR 계열)이
          // 한자를 자기 자형으로 그리는 것을 막고, 한글·라틴은 설정 글꼴로 흘려보낸다.
          fontFamily: materialLang === 'Chinese'
            ? `var(--font-noto-sc, 'Noto Sans SC'), ${fontFamily}`
            : fontFamily,
          gap: `${lineGap}px ${charGap}rem`, '--char-gap': `${charGap}rem`,
        }}
        onPointerDown={tokenRange.handlePointerDown}
        onClickCapture={tokenRange.handleClickCapture}
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
                  runSelectionAnalysis(lineHead.text);
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
                        ? <ruby key={i} data-pinyin={seg.pinyin ? '1' : undefined}>
                            {seg.kanji}<rt>{seg.reading}</rt>
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
      />


      {/* 드래그 단어 상세 팝업 — PDF와 동일 */}
      {popupWord && (
        <>
          <div className="pdf-detail-overlay" onClick={() => setPopupWord(null)} />
          <div className="pdf-detail-popup">
            <div className="pdf-detail-popup__header">
              <div className="pdf-detail-popup__word" lang={materialLang === 'Chinese' ? 'zh-Hans' : undefined}>
                {popupWord.token.furigana
                  ? splitRuby(popupWord.token.text, popupWord.token.furigana).map((seg, i) =>
                      seg.kanji ? <ruby key={i}>{seg.kanji}<rt className={seg.pinyin ? 'pinyin-text' : undefined}>{seg.reading}</rt></ruby> : <span key={i}>{seg.plain}</span>
                    )
                  : popupWord.token.text}
              </div>
              <button className="pdf-detail-popup__close" onClick={() => setPopupWord(null)}>✕</button>
            </div>
            <div className="pdf-detail-popup__meta">
              <span className="pdf-detail-popup__pos"><TokenPosLabel token={popupWord.token} /></span>
              {popupWord.token.base_form && popupWord.token.base_form !== popupWord.token.text && (
                <span className="pdf-detail-popup__base">{popupWord.token.base_form}</span>
              )}
              {(() => {
                const huns = hanjaHunOf(popupWord.token.text);
                // 훈음 전 글자 커버 시 한자음 단독 표기는 중복이라 생략(오너 확정)
                const hk = hunsCoverWord(popupWord.token.text, huns) ? null : hanjaKoOf(popupWord.token.text);
                return (
                  <>
                    {hk && <span className="pdf-detail-popup__base">한자음 {hk}</span>}
                    {huns && (
                      <span className="pdf-detail-popup__base">
                        {huns.map(({ ch, label }) => `${jaFormOf(ch)} ${label}`).join(' · ')}
                      </span>
                    )}
                  </>
                );
              })()}
              {(() => {
                const ja = materialLang === 'Chinese' && showHanjaKo ? getJaRef(popupDictEntry) : null;
                const jr = ja ? formatJaRef(ja, popupWord.token.text, jaFormOf(popupWord.token.text)) : null;
                const warn = getJaWarn(ja);
                return (
                  <>
                    {jr && <span className="pdf-detail-popup__base">日 {jr}</span>}
                    {warn && (
                      <span className="pdf-detail-popup__base" style={{ color: 'var(--warning)', fontWeight: 600 }}>
                        ⚠ {jaFormOf(popupWord.token.text)}는 일본어로 '{warn}'
                      </span>
                    )}
                  </>
                );
              })()}
              <span className="pdf-detail-popup__short">{popupWord.token.meaning}</span>
            </div>
            <div className="pdf-detail-popup__body">
              {popupWord.loading
                ? <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>상세 설명 생성 중...</div>
                : <div className="pdf-detail-popup__text" dangerouslySetInnerHTML={{ __html: formatDetail(popupWord.detail) }} />
              }
            </div>
            {user && (() => {
              const t = popupWord.token;
              const isSaved = savedWords.surfaces?.has(t.text) || savedWords.bases?.has(t.base_form);
              const saveKey = t.base_form || t.text;
              return (
                <button className={`pdf-detail-popup__save ${isSaved ? 'pdf-detail-popup__save--done' : ''}`}
                  disabled={isSaved || inlineSaving[saveKey]}
                  onClick={() => saveInlineVocabulary(t)}>
                  {isSaved ? '✓ 저장됨' : inlineSaving[saveKey] ? '저장 중…' : '단어장에 저장'}
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
