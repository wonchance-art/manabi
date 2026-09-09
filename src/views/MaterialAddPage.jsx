'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import Button from '../components/Button';
import { analyzeText } from '../lib/analyzeText';
import { autoSplitParagraphs } from '../lib/splitParagraphs';
import {
  splitTextIntoChapters, CHAPTER_MAX_CHARS, looksLikeSentenceList, LINES_PER_REQUEST_CAP,
} from '../lib/bookSplit';
import { makeBookKey } from '../lib/bookMeta';
import { bookKeyForDraft, appendPlanOf, listAppendableBooks, countContentLines } from '../lib/bookAppend';
import { LEVELS, MATERIAL_DIRECTION } from '../lib/constants';
import { isOnDemandSuggestion, suggestionVideoUrl } from '../lib/suggestionSources';
import { isShareableSource, licenseForSource } from '../lib/videoAttribution';
import MaterialAddPdfSection from './MaterialAddPdfSection';
import MaterialAddEpubSection from '../components/MaterialAddEpubSection';
import MaterialAddSentenceSection from '../components/MaterialAddSentenceSection';
import MaterialAddLinkSection from '../components/MaterialAddLinkSection';
import BookDraftPanel from '../components/BookDraftPanel';
import { friendlyToastMessage } from '../lib/errorMessage';
import { titleFromBody } from '../lib/materialTitle';
import { useQueryClient } from '@tanstack/react-query';
import { createImportAttempt, saveImportOnce, interruptedImportJson, persistImportAnalysis } from '../lib/materialImport';
import './material-import.css';

/** 입구 칩(자료 추가 정돈 R2) — 소스 순서 = 렌더 순서(PDF→EPUB→문장 목록→링크), 아래 렌더와 같은 차례. */
const ENTRIES = [
  ['pdf', '📄 PDF'],
  ['epub', '📚 EPUB'],
  ['sentences', '📋 문장 목록'],
  ['link', '🔗 링크'],
];

/** 내용 줄 수 — 문장 목록 자료에서 "몇 문장"의 정본 셈법(빈 줄 제외). */
const countLines = (t) => String(t || '').split('\n').filter((l) => l.trim()).length;

// --- Component ---
export default function MaterialAddPage() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-container" role="status">계정을 확인하고 있어요…</div>;
  return <MaterialAddForm key={user?.id || 'guest'} />;
}

function MaterialAddForm() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [title, setTitle] = useState('');
  const [rawText, setRawText] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [language, setLanguage] = useState('Japanese');
  const [level, setLevel] = useState('N3 중급');
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
  const [pdfSource, setPdfSource] = useState(null); // { pdf, pageStart, pageEnd }
  const [epubSource, setEpubSource] = useState(false); // 개인 소장 전자책 반입 — 비공개 고정 근거
  // 링크 반입 출처(v2-F R1) — 있으면 metadata.source에 실린다. 다른 입구로 갈아타면 비운다.
  const [linkSource, setLinkSource] = useState(null);
  // U R3 내 노트 — 방향 축. 'write'면 한국어 본문을 허용하고 분석 큐에 넣지 않는다.
  const [direction, setDirection] = useState(() => searchParams.get('direction') === MATERIAL_DIRECTION.WRITE ? MATERIAL_DIRECTION.WRITE : MATERIAL_DIRECTION.READ);
  const isNote = direction === MATERIAL_DIRECTION.WRITE;
  // 자료 추가 정돈 R2(#1077 5547576227) — 입구 4장을 칩 한 줄 + 아코디언(한 번에 하나)으로.
  // 펼침 상태는 여기 하나뿐이다. 입구가 스스로 열어 달라고 할 때(딥링크·본문 폼 넘김)는
  // onOpenChange로 올라오고, 내용을 넘겨준 뒤엔 접는다(폼으로 시선을 옮긴다).
  const [openEntry, setOpenEntry] = useState('');   // '' | 'pdf' | 'epub' | 'sentences' | 'link'
  const [pdfCount, setPdfCount] = useState(0);
  const entryOpenChange = (key) => (v) => setOpenEntry((cur) => (v ? key : (cur === key ? '' : cur)));

  // PDF에서 텍스트가 추출되면 폼에 주입
  const handlePdfRangeReady = ({ pdf, pageStart, pageEnd, rawText: extractedText }) => {
    setPdfSource({ pdf, pageStart, pageEnd });
    setLinkSource(null);
    setOpenEntry('');
    setTitle(`${pdf.title} (p.${pageStart}-${pageEnd})`);
    setRawText(extractedText);
    if (pdf.language) setLanguage(pdf.language);
    if (pdf.level) setLevel(pdf.level);
    setVisibility('private'); // PDF 출처는 항상 private
    toast('추출 완료! 아래에서 확인 후 분석을 시작하세요.', 'success');
    // 스크롤 텍스트 영역으로
    setTimeout(() => {
      const el = document.querySelector('.form-textarea');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  };

  // 책 묶음 초안(P1) — 방대한 양도 일단 다 받아들이되 챕터별 자료로 쪼개 등록한다.
  // 등록 시 분석은 돌리지 않는다(status: 'pending') — 읽을 챕터만 뷰어에서 온디맨드 분석.
  // bookDraft = { title, chapters: [{title, text}], privateOnly, origin }
  //   privateOnly — 개인 소장물(EPUB·문장 목록)은 공개 선택지를 주지 않는다
  //   origin — 'epub' | 'text' | 'sentences'. 미리보기를 **어느 문 옆에 그릴지**와
  //            문단 자동 감지를 걸지 말지를 함께 결정한다.
  //   language·level — 'sentences'는 자기 입구에서 정하고 오므로 초안이 들고 온다.
  const [bookDraft, setBookDraft] = useState(null);
  const [bookRegistering, setBookRegistering] = useState(false);
  const [bookDoneCount, setBookDoneCount] = useState(0);
  const [bookFirstNewId, setBookFirstNewId] = useState(null); // 등록 직후 [바로 읽기]가 여는 첫 새 챕터
  // 이어 적기(#1077 5520128974) — 내 책 목록(문장 목록 입구의 「기존 교재에 이어서」 선택지). 메타 경로만
  // 골라 받는다 — processed_json 통짜를 끌지 않는다(쿼리 다이어트). 게스트는 빈 목록 = 갈래 없음.
  const [myBookRows, setMyBookRows] = useState([]);
  useEffect(() => {
    if (!user?.id) { setMyBookRows([]); return undefined; }
    let alive = true;
    supabase
      .from('reading_materials')
      .select('id, created_at, processed_json->metadata->>language, processed_json->metadata->>level, processed_json->metadata->book')
      .eq('owner_id', user.id)
      .not('processed_json->metadata->book', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (!alive || error) return;
        // listAppendableBooks는 metadata 모양을 읽는다 — 평탄 컬럼을 그 모양으로 되돌린다
        setMyBookRows((data || []).map((r) => ({
          id: r.id, created_at: r.created_at,
          processed_json: { metadata: { language: r.language, level: r.level, book: r.book } },
        })));
      });
    return () => { alive = false; };
  }, [user?.id]);
  const myBooks = useMemo(() => listAppendableBooks(myBookRows), [myBookRows]);
  const appendBookKey = searchParams.get('book') || '';
  // 과당 문장 수 상속 — 가장 최근 등록된 챕터 한 행의 줄 수(문장 목록 책은 곧 과 크기). 못 읽으면 null.
  const inferPerChapter = async (key) => {
    const { data, error } = await supabase
      .from('reading_materials')
      .select('raw_text')
      .eq('owner_id', user.id)
      .filter('processed_json->metadata->book->>key', 'eq', key)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) return null; // 못 읽으면 상속 없이 지금 값 그대로 — 사람이 고친다(무해)
    const n = countContentLines(data?.[0]?.raw_text);
    return n >= 1 ? n : null;
  };
  // 본문 폼에 문장 목록을 붙여넣은 사람을 위쪽 입구로 넘길 때 싣는 텍스트(1회성).
  const [sentenceSeed, setSentenceSeed] = useState('');

  const handleEpubBookReady = ({ bookTitle, language: epubLang, chapters }) => {
    setPdfSource(null);
    setEpubSource(true);
    setOpenEntry('');
    setVisibility('private');
    if (epubLang) { setLanguage(epubLang); setLevel(epubLang === 'Japanese' ? 'N3 중급' : epubLang === 'Chinese' ? 'H3 중급' : 'B1 중급'); }
    // 상한 초과 챕터는 여기서 재분할해 받아들인다("일단 다 받아들이되" 원칙)
    const normalized = chapters.flatMap((ch) =>
      ch.text.length > CHAPTER_MAX_CHARS
        ? splitTextIntoChapters(ch.text).map((sub, i, arr) => ({
            title: arr.length > 1 ? `${ch.title} (${i + 1}/${arr.length})` : ch.title,
            text: sub.text,
          }))
        : [{ title: ch.title, text: ch.text }]
    );
    setBookDraft({ title: bookTitle, chapters: normalized, privateOnly: true, origin: 'epub' });
    setBookDoneCount(0);
    toast(`챕터 ${normalized.length}개를 준비했어요. 목록을 확인하고 등록하세요.`, 'success');
  };

  // 긴 붙여넣기 텍스트 → 챕터 자동 분할 초안(P2). 경계는 아래 목록에서 손볼 수 있다.
  const handleSplitToBook = () => {
    const chapters = splitTextIntoChapters(rawText);
    if (chapters.length < 2) { toast('나눌 챕터 경계를 찾지 못했어요 — 그대로 한 자료로 등록해 주세요.', 'info'); return; }
    setBookDraft({ title: title.trim() || titleFromBody(rawText) || '제목 없는 책', chapters, origin: 'text' });
    setBookDoneCount(0);
  };

  // 문장 목록 입구(PDF·EPUB와 같은 층) — 제목·언어·난이도·과 크기를 거기서 다 정하고 온다.
  // 초안이 자기 언어·난이도를 들고 오므로 등록이 본문 폼 상태에 의존하지 않는다(비동기 어긋남 없음).
  const handleSentenceBookReady = ({ bookTitle, language: lang, level: lvl, chapters, append = null }) => {
    setBookDraft({
      title: bookTitle, chapters, privateOnly: true, origin: 'sentences', language: lang, level: lvl, append,
    });
    setBookDoneCount(0);
    setBookFirstNewId(null);
    setOpenEntry('');
    toast(append
      ? `${append.startOrder}과부터 ${chapters.length}과를 준비했어요. 목록을 확인하고 이어 등록하세요.`
      : `${chapters.length}과로 나눴어요. 목록을 확인하고 등록하세요.`, 'success');
  };

  async function handleBookRegister() {
    if (!user) { toast('로그인이 필요합니다.', 'warning'); return; }
    if (!bookDraft || bookDraft.chapters.length === 0) return;
    setBookRegistering(true);
    try {
      // 이어 적기면 책의 key·다음 순번·기존+새 총수(bookAppend 정본) — 새 책이면 지금까지와 같다.
      const key = bookKeyForDraft(bookDraft, makeBookKey);
      const { startOrder, existingCount, total, lastOrder } = appendPlanOf(bookDraft);
      const rows = bookDraft.chapters.map((ch, i) => ({
        title: `${bookDraft.title} — ${ch.title}`,
        // 문장 목록은 이미 한 줄 한 문장이라 문단 자동 감지가 할 일이 없다. 오히려 개입하면
        // 문장마다 빈 줄이 들어가 문단 수 = 문장 수가 되고, 분석 요청이 챕터당 1건에서 문장
        // 수만큼으로 늘어 분당 20회 제한에 걸린다. 실측(320문장·16문장/과): 일본어는 요청이
        // 20건 → 320건으로 튄다(。+히라가나 시작 조건에 걸린다). 중국어·영어는 지금은 안
        // 걸리지만(한자 시작·마침표가 종결 집합에 없음) 우연이라 기대지 않는다.
        raw_text: bookDraft.origin === 'sentences' ? ch.text : autoSplitParagraphs(ch.text),
        processed_json: {
          sequence: [], dictionary: {}, last_idx: -1,
          status: 'pending', // 미분석 — 뷰어에서 "이 챕터 분석하기"로 온디맨드 실행
          metadata: {
            // 초안이 자기 언어·난이도를 들고 왔으면 그것이 정본(문장 목록 입구는 거기서 정한다).
            language: bookDraft.language || language,
            level: bookDraft.level || level,
            book: { key, title: bookDraft.title, order: startOrder + i, total },
            // 이중 언어 교재의 뜻(v2-AB R0) — 문장 키. 뷰어 드래그 번역이 Gemini 전에 본다.
            ...(ch.translations && Object.keys(ch.translations).length ? { translations: ch.translations } : {}),
            updated_at: new Date().toISOString(),
          },
        },
        visibility: bookDraft.privateOnly ? 'private' : visibility,
        owner_id: user.id,
      }));
      const { data: inserted, error: insertError } = await supabase.from('reading_materials').insert(rows).select('id');
      if (insertError) throw insertError;
      setBookDoneCount(bookDraft.chapters.length);
      setBookFirstNewId(inserted?.[0]?.id ?? null);
      toast(bookDraft.append
        ? `《${bookDraft.title}》 ${startOrder}과~${lastOrder}과를 이었어요(지금 ${existingCount + bookDraft.chapters.length}과). 각 과는 열 때 분석돼요.`
        : `《${bookDraft.title}》 챕터 ${total}개 등록 완료! 각 챕터는 열 때 분석돼요.`, 'success');
    } catch (err) {
      toast('책 등록 실패 — ' + friendlyToastMessage(err), 'error');
    } finally {
      setBookRegistering(false);
    }
  }

  // 링크 반입(v2-F R1) — 남의 자막이라 **기본** 비공개. PDF·EPUB처럼 강제하지는 않는다:
  // 재배포 판단은 사용자 몫이라 토글을 남긴다(설계 §5). 출처는 metadata.source에 남긴다.
  /** 추천(영상)에서 들어온 주소 — 링크 반입 입구가 이걸 받아 자동으로 가져온다. */
  const [linkAutoUrl, setLinkAutoUrl] = useState('');

  const handleLinkReady = ({ title: linkTitle, rawText: linkText, source }) => {
    setPdfSource(null);
    setEpubSource(false);
    setLinkSource(source);
    setOpenEntry('');
    setTitle(linkTitle);
    setRawText(linkText);
    setVisibility('private');
    setTimeout(() => {
      document.querySelector('.form-textarea')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  };

  // EPUB 챕터 반입 — 텍스트만 폼에 주입, 개인 소장물이므로 비공개 고정
  const handleEpubReady = ({ title: epubTitle, rawText: epubText, language: epubLang }) => {
    setPdfSource(null);
    setLinkSource(null);
    setEpubSource(true);
    setOpenEntry('');
    setTitle(epubTitle);
    setRawText(epubText);
    if (epubLang) { setLanguage(epubLang); setLevel(epubLang === 'Japanese' ? 'N3 중급' : 'B1 중급'); }
    setVisibility('private');
    toast('가져왔어요. 아래에서 확인 후 분석을 시작하세요.', 'success');
    setTimeout(() => {
      document.querySelector('.form-textarea')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  };

  // 빠른 분석(/quick)에서 넘어온 초안 — sessionStorage 1회성(읽고 지운다)
  useEffect(() => {
    if (searchParams.get('from') !== 'quick') return;
    try {
      const raw = sessionStorage.getItem('manabi_quick_draft');
      if (!raw) return;
      sessionStorage.removeItem('manabi_quick_draft');
      const draft = JSON.parse(raw);
      if (draft?.text) setRawText(draft.text);
      if (draft?.language) {
        setLanguage(draft.language);
        setLevel(draft.language === 'Japanese' ? 'N3 중급' : 'B1 중급');
      }
    } catch { /* 초안이 깨졌으면 빈 폼 그대로 */ }
  }, []);

  // 추천 자료에서 진입 시 자동 폼 채우기
  //
  // 두 갈래다. 글 소스는 크론이 본문까지 담아 뒀으니 그대로 붓는다. **영상은 다르다** —
  // 크론이 목록만 담고 본문은 없다(v2-F R4: 서버가 남의 자막을 미리 복제하지 않는다).
  // 그래서 주소를 링크 반입 입구(F R1)에 넘겨 **이 사용자의 비공개 자료**로 가져온다.
  // 자막 취득이 실패해도 그 자리에서 붙여넣기 창이 열린다 — 이미 만들어 둔 길이다.
  useEffect(() => {
    const suggestionId = searchParams.get('suggestion');
    if (!suggestionId) return;

    setIsSuggestionLoading(true);
    fetch(`/api/suggestions/today`)
      .then(r => r.json())
      .then(items => {
        const s = items.find(i => i.id === suggestionId);
        if (!s) return;
        setTitle(s.title);
        setLanguage(s.language || 'Japanese');
        if (s.level) setLevel(s.level);
        if (isOnDemandSuggestion(s)) {
          // 공개범위는 여기서 정하지 않는다 — handleLinkReady가 private으로 고정한다.
          setLinkAutoUrl(suggestionVideoUrl(s));
          return;
        }
        setRawText(s.transcript || '');
        setVisibility('public');
        // 공유 가능한 영상(퍼블릭 도메인·CC BY)은 **출처 표기가 조건**이다. 여기서
        // metadata.source에 실어야 뷰어가 보여줄 수 있다 — 안 실으면 라이선스 위반이다.
        if (isShareableSource(s.source)) {
          setLinkSource({
            kind: 'youtube',
            url: suggestionVideoUrl(s),
            videoId: s.video_id,
            channel: s.channel_name || '',
            license: licenseForSource(s.source),
            via: 'suggestion',
          });
        }
      })
      .catch(() => {})
      .finally(() => setIsSuggestionLoading(false));
  }, []);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [completedId, setCompletedId] = useState(null);

  const abortControllerRef = useRef(null);
  const importAttemptRef = useRef(null);
  const savedRecordRef = useRef(null);
  const analysisJsonRef = useRef(null);
  const analysisPromiseRef = useRef(null);
  const busyRef = useRef(false);
  const aliveRef = useRef(true);
  const [analysisState, setAnalysisState] = useState('idle');
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; abortControllerRef.current?.abort(); };
  }, []);

  const refreshLibrary = () => {
    queryClient.invalidateQueries({ queryKey: ['materials'] });
    queryClient.invalidateQueries({ queryKey: ['library-reading-v2', user?.id] });
  };

  async function handleStart() {
    if (busyRef.current || savedRecordRef.current) return;
    if (!user) { toast('로그인이 필요합니다.', 'warning'); return; }
    if (!rawText.trim()) { toast('내용을 입력해주세요.', 'warning'); return; }
    busyRef.current = true;
    setIsProcessing(true);
    setError('');
    setStatus('원문을 서재에 저장하고 있어요…');
    try {
      const initJson = {
        sequence: [], dictionary: {}, last_idx: -1, status: isNote ? 'note' : "analyzing",
        metadata: {
          language, level, updated_at: new Date().toISOString(),
          ...(linkSource ? { source: linkSource } : {}),
        },
      };
      const materialRow = {
        title: title.trim() || titleFromBody(rawText) || "제목 없음",
        raw_text: autoSplitParagraphs(rawText), processed_json: initJson,
        visibility: (pdfSource || epubSource || isNote) ? 'private' : visibility,
        owner_id: user.id,
        ...(isNote ? { direction: MATERIAL_DIRECTION.WRITE } : {}),
        ...(pdfSource ? { source_pdf_id: pdfSource.pdf.id, page_start: pdfSource.pageStart, page_end: pdfSource.pageEnd } : {}),
      };
      const signature = JSON.stringify([title, rawText, language, level, visibility, isNote, pdfSource, epubSource, linkSource]);
      if (importAttemptRef.current?.signature !== signature) {
        importAttemptRef.current = { signature, attempt: createImportAttempt(materialRow, crypto.randomUUID()) };
      }
      const record = await saveImportOnce(supabase, importAttemptRef.current.attempt);
      if (!aliveRef.current) return;
      savedRecordRef.current = record;
      analysisJsonRef.current = record.processed_json;
      setCompletedId(record.id);
      refreshLibrary();
      // Saving an extracted range does not mean the reader has read its final page.
      // PDF page progress remains owned by the PDF reader.
      if (isNote) {
        setStatus('노트를 저장했어요.'); setProgress(100); setAnalysisState('note');
        setIsProcessing(false); busyRef.current = false;
        return;
      }
      setStatus('원문 저장 완료. 읽기 도구를 준비하고 있어요…');
      setProgress(0);
      startAnalysis();
    } catch (err) {
      if (aliveRef.current) { setError('저장 오류 — ' + friendlyToastMessage(err)); setIsProcessing(false); }
      busyRef.current = false;
    }
  }

  function startAnalysis() {
    if (analysisPromiseRef.current || !savedRecordRef.current) return;
    busyRef.current = true;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsProcessing(true); setError(''); setAnalysisState('analyzing');
    analysisPromiseRef.current = runBackgroundAnalysis(savedRecordRef.current, controller.signal)
      .finally(() => { analysisPromiseRef.current = null; busyRef.current = false; });
  }

  function handleCancel() {
    abortControllerRef.current?.abort();
    setStatus('분석을 멈추고 저장된 위치를 확인하고 있어요…');
  }

  async function openSavedMaterial() {
    const record = savedRecordRef.current;
    if (!record) return;
    // Do not leave two analysis writers competing for the same original.
    abortControllerRef.current?.abort();
    await analysisPromiseRef.current;
    if (aliveRef.current) router.push(`/viewer/${record.id}`);
  }

  async function runBackgroundAnalysis(record, signal) {
    let lastJson = analysisJsonRef.current;
    try {
      const finalJson = await analyzeText(record.raw_text, signal, {
        metadata: { ...lastJson.metadata, updated_at: new Date().toISOString() },
        existingJson: lastJson, concurrency: 8,
        onBatch: async ({ currentJson, processed, total }) => {
          if (!aliveRef.current || signal.aborted) throw new DOMException('Aborted', 'AbortError');
          lastJson = structuredClone(currentJson);
          await persistImportAnalysis(supabase, record, lastJson);
          analysisJsonRef.current = lastJson;
          if (!aliveRef.current) return;
          setStatus(`읽기 도구 준비 중 · ${processed} / ${total}줄`);
          setProgress(total ? Math.floor((processed / total) * 100) : 0);
        },
      });
      if (!aliveRef.current) return;
      analysisJsonRef.current = finalJson;
      setAnalysisState(finalJson.status);
      setStatus(finalJson.status === 'failed' ? '원문은 저장됐어요. 분석을 다시 시도할 수 있어요.'
        : finalJson.status === 'partial' ? `원문 저장 완료 · ${finalJson.failed_indices?.length || 0}개 줄 재시도 필요` : '원문과 읽기 도구가 준비됐어요.');
      setProgress(100);
      const suggestionId = searchParams.get('suggestion');
      if (suggestionId) {
        const { error: suggestionLinkError } = await supabase.from('daily_suggestions')
          .update({ material_id: record.id }).eq('id', suggestionId).is('material_id', null);
        if (suggestionLinkError && aliveRef.current) toast('자료는 저장됐지만 추천 자료 연결에 실패했어요.', 'warning');
      }
    } catch (err) {
      if (!aliveRef.current) return;
      const interrupted = interruptedImportJson(record.raw_text, lastJson);
      analysisJsonRef.current = interrupted;
      try { await persistImportAnalysis(supabase, record, interrupted); }
      catch { if (aliveRef.current) setError('원문은 저장됐지만 분석 결과를 저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.'); }
      if (!aliveRef.current) return;
      setAnalysisState('paused');
      setStatus(signal.aborted ? '분석을 멈췄어요. 원문은 서재에 남아 있어요.' : '원문은 저장됐어요. 분석을 다시 시도할 수 있어요.');
      if (!signal.aborted) setError('분석 오류 — ' + friendlyToastMessage(err));
    } finally {
      if (aliveRef.current) { setIsProcessing(false); refreshLibrary(); }
    }
  }

  // 챕터별 문장 범위("1~16번") — 누적 계산이라 [합치기]로 경계를 바꿔도 그대로 맞는다.
  const chapterRanges = useMemo(() => {
    if (bookDraft?.origin !== 'sentences') return [];
    let acc = 0;
    return bookDraft.chapters.map((ch) => {
      const from = acc + 1;
      acc += countLines(ch.text);
      return `${from}~${acc}번`;
    });
  }, [bookDraft]);

  // 제목 칸 placeholder·저장 제목의 정본 — 본문 첫 줄(40자). 비어 있을 때만 쓴다.
  const autoTitle = titleFromBody(rawText);

  if (isSuggestionLoading) {
    return (
      <div className="page-container">
        <div className="spinner-wrap">
          <div className="spinner" />
          <span className="spinner-msg">추천 자료 불러오는 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container add-page">
      <div className="page-header">
        <p className="manabi-eyebrow">IMPORT / 내 서재</p>
        <h1 className="page-header__title">새 자료 추가</h1>
      </div>
      <fieldset className="import-fields" disabled={isProcessing || !!completedId}>

      {/* 입구 한 줄(칩) + 아코디언 — 소스 순서(PDF→EPUB→문장 목록→링크)는 렌더 순서이자 계약이다.
          접힌 입구는 마운트만 되어 있다(훅·딥링크 효과는 산다). 한 번에 하나만 펼친다. */}
      <div className="card add-form add-entries">
        <div className="add-entries__chips" role="tablist" aria-label="가져올 곳">
          {ENTRIES.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={openEntry === key}
              className={`chip ${openEntry === key ? 'chip--active' : ''}`}
              onClick={() => setOpenEntry((cur) => (cur === key ? '' : key))}
            >
              {label}{key === 'pdf' && pdfCount > 0 ? ` · ${pdfCount}권` : ''}
            </button>
          ))}
        </div>

        <MaterialAddPdfSection
          user={user}
          toast={toast}
          onRangeReady={handlePdfRangeReady}
          open={openEntry === 'pdf'}
          onCountChange={setPdfCount}
        />

        <MaterialAddEpubSection toast={toast} onReady={handleEpubReady} onBookReady={handleEpubBookReady} open={openEntry === 'epub'} />

        <MaterialAddSentenceSection
          toast={toast}
          onReady={handleSentenceBookReady}
          seedText={sentenceSeed}
          onSeedConsumed={() => setSentenceSeed('')}
          books={myBooks}
          initialBookKey={appendBookKey}
          inferPerChapter={inferPerChapter}
          open={openEntry === 'sentences'}
          onOpenChange={entryOpenChange('sentences')}
        />

        <MaterialAddLinkSection toast={toast} onReady={handleLinkReady} initialUrl={linkAutoUrl} open={openEntry === 'link'} onOpenChange={entryOpenChange('link')} />
      </div>

      {/* 책 초안은 **그것을 만든 문 옆**에 펼친다 — 위쪽 입구(EPUB·문장 목록)에서 왔으면 여기,
          본문 폼에서 나눴으면 텍스트 칸 아래. 한 자리에 고정하면 누른 자리와 결과가 갈린다. */}
      {(bookDraft?.origin === 'epub' || bookDraft?.origin === 'sentences') && (
        <BookDraftPanel
          draft={bookDraft}
          setDraft={setBookDraft}
          onRegister={handleBookRegister}
          registering={bookRegistering}
          doneCount={bookDoneCount}
          onCancel={() => { setBookDraft(null); setBookDoneCount(0); }}
          onDone={() => router.push('/materials')}
          readHref={bookFirstNewId ? `/viewer/${bookFirstNewId}` : null}
          chapterRanges={chapterRanges}
        />
      )}
      <div className="card add-form">
        {/* PDF 출처 배지 */}
        {pdfSource && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 14px', marginBottom: 16,
            background: 'var(--primary-glow)', border: '1px solid var(--primary)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--primary-light)', fontWeight: 700 }}>
                PDF 출처
              </div>
              <div style={{ fontSize: '0.88rem', marginTop: 2 }}>
                {pdfSource.pdf.title} · p.{pdfSource.pageStart}-{pdfSource.pageEnd}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setPdfSource(null);
                setTitle('');
                setRawText('');
              }}
            >
              ✕ 해제
            </Button>
          </div>
        )}

        {/* 본문이 먼저다(주 행위). 제목·언어·난이도·공개·종류는 아래 두 줄 — 자료 추가 정돈 R2. */}
        <div className="form-field">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label className="form-label" style={{ marginBottom: 0 }}>본문 텍스트</label>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                try {
                  const t = await navigator.clipboard.readText();
                  if (t?.trim()) { setRawText(t); toast('클립보드에서 붙여넣었어요', 'success'); }
                  else toast('클립보드가 비어있어요', 'info');
                } catch {
                  toast('브라우저에서 클립보드 접근을 허용해 주세요', 'warning');
                }
              }}
            >
              클립보드 붙여넣기
            </Button>
          </div>
          <textarea
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            placeholder="분석할 문장을 입력하세요 (엔터로 문단 구분)"
            className="form-textarea"
          />
          {rawText.length > 0 && (
            <div className={`form-char-count ${rawText.length > 50000 ? 'form-char-count--over' : rawText.length > 30000 ? 'form-char-count--warn' : ''}`}>
              {rawText.length.toLocaleString()}자 · 약 {rawText.split('\n').filter(l => l.trim()).length}개 문단
              {rawText.length > 10000 && !bookDraft && (
                <button
                  type="button"
                  onClick={handleSplitToBook}
                  style={{ marginLeft: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-light)', fontSize: '0.8rem', fontWeight: 700, textDecoration: 'underline' }}
                >
                  챕터로 나눠 책으로 등록
                </button>
              )}
            </div>
          )}

          {/* 본문 폼에서 나눈 결과는 누른 자리(텍스트 칸 바로 아래)에 펼친다. */}
          {bookDraft?.origin === 'text' && (
            <div style={{ marginTop: 12 }}>
              <BookDraftPanel
                draft={bookDraft}
                setDraft={setBookDraft}
                onRegister={handleBookRegister}
                registering={bookRegistering}
                doneCount={bookDoneCount}
                onCancel={() => { setBookDraft(null); setBookDoneCount(0); }}
                onDone={() => router.push('/materials')}
                readHref={bookFirstNewId ? `/viewer/${bookFirstNewId}` : null}
                chapterRanges={chapterRanges}
              />
            </div>
          )}

          {/* 문장 목록을 본문 폼에 붙여넣은 경우 — 여기서 처리하지 않고 위쪽 입구로 넘긴다.
              그대로 한 자료로 분석하면 빈 줄 없는 연속 줄이 100줄 캡에 잘려 나머지가 영구
              '미분석'으로 굳는다(bookSplit.js §문장 목록 반입). 문은 하나로 둔다. */}
          {looksLikeSentenceList(rawText) && !bookDraft && (
            <div style={{
              marginTop: 10, padding: '10px 12px', display: 'flex', alignItems: 'center',
              gap: 10, flexWrap: 'wrap',
              background: 'var(--primary-glow)', border: '1px solid var(--primary)',
              borderRadius: 'var(--radius-md)',
            }}>
              <span style={{ flex: 1, minWidth: 200, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                📋 한 줄에 한 문장씩인 목록 같아요 — 이대로 한 자료로 만들면{' '}
                {LINES_PER_REQUEST_CAP}문장까지만 분석돼요.
              </span>
              <Button
                size="sm"
                onClick={() => {
                  setSentenceSeed(rawText);
                  setRawText('');
                  setTimeout(() => {
                    document.getElementById('sentence-text')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 100);
                }}
              >
                문장 목록으로 옮기기
              </Button>
            </div>
          )}

        </div>

        {/* Title — 비우면 본문 첫 줄(40자)로 채운다. placeholder가 그 값을 미리 보여 준다. */}
        <div className="form-field">
          <label className="form-label">제목</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={autoTitle ? `${autoTitle} (본문 첫 줄)` : '비우면 본문 첫 줄로 채워요'}
            className="form-input"
          />
        </div>

        {/* Language + Level */}
        <div className="form-row">
          <div className="form-field">
            <label className="form-label">학습 언어</label>
            <div className="toggle-group import-language-options">
              {/* 해부 분석이 지원하는 언어 — 일본어·영어·중국어·프랑스어 */}
              {[
                ['Japanese', '일본어', 'N3 중급'],
                ['English', '영어', 'B1 중급'],
                ['Chinese', '중국어', 'H3 중급'],
                ['French', '프랑스어', 'B1 중급'],
              ].map(([key, label, defaultLevel]) => (
                <button
                  key={key}
                  aria-pressed={language === key}
                  onClick={() => { setLanguage(key); setLevel(defaultLevel); }}
                  className={`toggle-btn ${language === key ? 'toggle-btn--primary' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">권장 학습 난이도</label>
            <div className="level-group">
              {LEVELS[language].map(lvl => (
                <button
                  key={lvl}
                  onClick={() => setLevel(lvl)}
                  className={`level-btn ${level === lvl ? 'level-btn--active' : ''}`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Visibility + Kind(U R3 — 읽기 자료 / 내 노트) */}
        <div className="form-row">
          <div className="form-field">
            <label className="form-label">
              공개 범위
              {(pdfSource || epubSource || isNote) && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 6 }}>({isNote ? '내 노트' : pdfSource ? 'PDF 출처' : 'EPUB 출처'}는 비공개 고정)</span>}
            </label>
            <div className="toggle-group">
              <button
                onClick={() => !pdfSource && !epubSource && !isNote && setVisibility('private')}
                className={`toggle-btn ${visibility === 'private' ? 'toggle-btn--primary' : ''}`}
                disabled={!!pdfSource || epubSource || isNote}
              >
                비공개
              </button>
              <button
                onClick={() => !pdfSource && !epubSource && !isNote && setVisibility('public')}
                className={`toggle-btn ${visibility === 'public' ? 'toggle-btn--accent' : ''}`}
                disabled={!!pdfSource || epubSource || isNote}
              >
                공용
              </button>
            </div>
          </div>

          {/* U R3 — 자료의 방향: 읽기 자료(목표어 → 나) / 내 노트(나 → 목표어). 노트는 한국어 원문을
              허용하고 분석 큐에 넣지 않는다. /quick의 [자료로 저장]과 같은 형태의 입구 — 저장 흐름 하나. */}
          <div className="form-field">
            <label className="form-label">자료 종류</label>
            <div className="toggle-group" role="group" aria-label="자료 종류">
              <button
                type="button"
                aria-pressed={!isNote}
                onClick={() => setDirection(MATERIAL_DIRECTION.READ)}
                className={`toggle-btn ${!isNote ? 'toggle-btn--primary' : ''}`}
              >
                읽기 자료
              </button>
              <button
                type="button"
                aria-pressed={isNote}
                onClick={() => { setDirection(MATERIAL_DIRECTION.WRITE); setVisibility('private'); }}
                className={`toggle-btn ${isNote ? 'toggle-btn--primary' : ''}`}
              >
                내 노트
              </button>
            </div>
            {isNote && (
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '6px 0 0' }}>
                내 생각·메모를 한국어로 담아 두는 자료예요. 분석하지 않고, 비공개예요. 학습 언어는 「어느 언어로 옮길 노트인가」예요.
              </p>
            )}
          </div>
        </div>

      </div>
      </fieldset>
      <div className="import-result" aria-live="polite">
        {completedId && <p className="import-saved-label">✓ 원문 저장 완료 · {isNote ? '비공개 노트' : visibility === 'public' && !pdfSource && !epubSource ? '공개 자료' : '비공개 자료'}</p>}
        {!isProcessing && status && <p className="import-status">{status}</p>}
        {/* Progress */}
        {isProcessing && (
          <div className="progress-wrap">
            <div className="progress-wrap__header">
              <span className="progress-wrap__status">{status}</span>
              <span>{progress}%</span>
            </div>
            <div className="progress-bar">
              <div className={`progress-bar__fill ${progress >= 100 ? 'progress-bar__fill--done' : ''}`} style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Error */}
        {error && <div className="error-banner" role="alert">{error}</div>}

        {/* Actions */}
        {completedId ? (
          <div className="form-actions form-actions--done">
            <Button size="lg" style={{ flex: 2 }} onClick={openSavedMaterial}>
              지금 바로 읽기
            </Button>
            {isProcessing ? <Button variant="secondary" size="lg" onClick={handleCancel}>분석 중단</Button>
              : ['failed', 'partial', 'paused'].includes(analysisState) ? <Button variant="secondary" size="lg" onClick={startAnalysis}>분석 다시 시도</Button>
              : <Button variant="secondary" size="lg" onClick={() => router.push('/materials?view=owned')}>내 서재 보기</Button>}
          </div>
        ) : (
          <div className="form-actions">
            <Button
              onClick={handleStart}
              disabled={isProcessing}
              size="lg"
              style={{ flex: 3 }}
            >
              {isProcessing ? '원문 저장 중…' : isNote ? '노트 저장하기' : '저장하고 읽기 준비'}
            </Button>
            {isProcessing && (
              <Button onClick={handleCancel} variant="danger" size="lg" style={{ flex: 1 }}>
                중단
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
