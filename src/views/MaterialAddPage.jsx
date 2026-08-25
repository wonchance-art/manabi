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
  splitTextIntoChapters, CHAPTER_MAX_CHARS,
  splitLinesIntoChapters, looksLikeSentenceList, sentenceListStats,
  DEFAULT_LINES_PER_CHAPTER, LINES_PER_REQUEST_CAP, clampLinesPerChapter,
} from '../lib/bookSplit';
import { makeBookKey } from '../lib/bookMeta';
import { LEVELS } from '../lib/constants';
import MaterialAddPdfSection from './MaterialAddPdfSection';
import MaterialAddEpubSection from '../components/MaterialAddEpubSection';
import BookDraftPanel from '../components/BookDraftPanel';
import { friendlyToastMessage } from '../lib/errorMessage';

/** 내용 줄 수 — 문장 목록 자료에서 "몇 문장"의 정본 셈법(빈 줄 제외). */
const countLines = (t) => String(t || '').split('\n').filter((l) => l.trim()).length;

// --- Component ---
export default function MaterialAddPage() {
  const { user } = useAuth();
  const toast = useToast();
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

  // PDF에서 텍스트가 추출되면 폼에 주입
  const handlePdfRangeReady = ({ pdf, pageStart, pageEnd, rawText: extractedText }) => {
    setPdfSource({ pdf, pageStart, pageEnd });
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
  //   origin — 'epub' | 'text' | 'sentences'. 미리보기를 **어디에 그릴지**(누른 자리)와
  //            문단 자동 감지를 걸지 말지를 함께 결정한다.
  const [bookDraft, setBookDraft] = useState(null);
  const [bookRegistering, setBookRegistering] = useState(false);
  const [bookDoneCount, setBookDoneCount] = useState(0);
  const [linesPerChapter, setLinesPerChapter] = useState(DEFAULT_LINES_PER_CHAPTER);

  const handleEpubBookReady = ({ bookTitle, language: epubLang, chapters }) => {
    setPdfSource(null);
    setEpubSource(true);
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
    setBookDraft({ title: title || '제목 없는 책', chapters, origin: 'text' });
    setBookDoneCount(0);
  };

  // 문장 목록 → 과 단위 챕터(오너 승인 2026-08-25). 어휘 교재의 예문집처럼 한 줄 한 문장으로
  // 나열된 자료는 글자 수 분할이 한 덩어리로 뭉쳐 놓는데, 그러면 빈 줄 없는 연속 줄이
  // /api/analyze의 100줄 캡에 잘려 영구 부분 실패가 된다(bookSplit.js §문장 목록 반입).
  const handleSplitSentenceList = () => {
    const chapters = splitLinesIntoChapters(rawText, { linesPerChapter });
    if (chapters.length === 0) { toast('나눌 문장이 없어요.', 'info'); return; }
    setBookDraft({ title: title || '제목 없는 책', chapters, privateOnly: true, origin: 'sentences' });
    setBookDoneCount(0);
  };

  async function handleBookRegister() {
    if (!user) { toast('로그인이 필요합니다.', 'warning'); return; }
    if (!bookDraft || bookDraft.chapters.length === 0) return;
    setBookRegistering(true);
    try {
      const key = makeBookKey();
      const total = bookDraft.chapters.length;
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
            language, level,
            book: { key, title: bookDraft.title, order: i + 1, total },
            updated_at: new Date().toISOString(),
          },
        },
        visibility: bookDraft.privateOnly ? 'private' : visibility,
        owner_id: user.id,
      }));
      const { error: insertError } = await supabase.from('reading_materials').insert(rows);
      if (insertError) throw insertError;
      setBookDoneCount(total);
      toast(`《${bookDraft.title}》 챕터 ${total}개 등록 완료! 각 챕터는 열 때 분석돼요.`, 'success');
    } catch (err) {
      toast('책 등록 실패 — ' + friendlyToastMessage(err), 'error');
    } finally {
      setBookRegistering(false);
    }
  }

  // EPUB 챕터 반입 — 텍스트만 폼에 주입, 개인 소장물이므로 비공개 고정
  const handleEpubReady = ({ title: epubTitle, rawText: epubText, language: epubLang }) => {
    setPdfSource(null);
    setEpubSource(true);
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
        setRawText(s.transcript || '');
        setLanguage(s.language || 'Japanese');
        if (s.level) setLevel(s.level);
        setVisibility('public');
      })
      .catch(() => {})
      .finally(() => setIsSuggestionLoading(false));
  }, []);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('시스템 대기 중');
  const [error, setError] = useState('');
  const [completedId, setCompletedId] = useState(null);

  const abortControllerRef = useRef(null);



  async function handleStart() {
    if (!user) { toast('로그인이 필요합니다.', 'warning'); return; }
    if (!rawText.trim()) { toast('내용을 입력해주세요.', 'warning'); return; }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsProcessing(true);
    setError('');

    try {
      const initJson = {
        sequence: [], dictionary: {}, last_idx: -1, status: "analyzing",
        metadata: { language, level, updated_at: new Date().toISOString() }
      };
      const materialRow = {
        title: title || "제목 없음",
        raw_text: autoSplitParagraphs(rawText),
        processed_json: initJson,
        visibility: (pdfSource || epubSource) ? 'private' : visibility, // PDF·EPUB(개인 소장) 출처는 강제 private
        owner_id: user.id,
        ...(pdfSource ? {
          source_pdf_id: pdfSource.pdf.id,
          page_start: pdfSource.pageStart,
          page_end: pdfSource.pageEnd,
        } : {}),
      };
      const { data, error: insertError } = await supabase
        .from('reading_materials')
        .insert([materialRow])
        .select();

      if (insertError) throw insertError;

      // 본문 저장은 성공했으므로 PDF 위치 동기화 실패는 별도로 알리고 분석은 계속한다.
      if (pdfSource) {
        try {
          const { error: pdfProgressError } = await supabase.from('uploaded_pdfs')
            .update({ last_page_read: pdfSource.pageEnd })
            .eq('id', pdfSource.pdf.id);
          if (pdfProgressError) throw pdfProgressError;
        } catch {
          toast('자료는 저장됐지만 PDF 읽기 위치 동기화에 실패했어요.', 'warning');
        }
      }

      setStatus('저장 완료. 백그라운드 분석을 시작합니다...');
      setProgress(10);
      runBackgroundAnalysis(data[0].id, rawText, controller.signal);
    } catch (err) {
      if (err.name === 'AbortError') {
        setStatus('분석이 중단되었습니다.');
      } else {
        setError("저장 오류 — " + friendlyToastMessage(err));
      }
      setIsProcessing(false);
    }
  }

  function handleCancel() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setStatus('중단 요청 중...');
    }
  }

  async function runBackgroundAnalysis(id, text, signal) {
    try {
      const finalJson = await analyzeText(text, signal, {
        metadata: { language, level, updated_at: new Date().toISOString() },
        concurrency: 8, // PDF/페이스트 모두 더 빠르게
        onBatch: async ({ currentJson, processed, total }) => {
          const failedSoFar = currentJson.failed_indices?.length || 0;
          setStatus(`분석 중... (${processed}/${total}줄${failedSoFar > 0 ? ` · 실패 ${failedSoFar}` : ''})`);
          setProgress(Math.floor((processed / total) * 90) + 10);
          const { error: updateError } = await supabase
            .from('reading_materials').update({ processed_json: currentJson }).eq('id', id);
          if (updateError) console.error('[analyzeText onBatch] DB update failed:', updateError.message);
        },
      });

      const failedCount = finalJson.failed_indices?.length || 0;
      setStatus(finalJson.status === 'failed'
        ? '분석에 실패했어요 — 뷰어에서 재분석하거나 잠시 후 다시 시도해 주세요'
        : failedCount > 0
          ? `분석 완료 (${failedCount}개 단락 재시도 필요)`
          : '전체 분석 완료');
      setProgress(100);
      setIsProcessing(false);
      setCompletedId(id);

      // 추천 자료에서 진입했으면 material_id 기록 (이후 유저는 바로 뷰어로)
      const suggestionId = searchParams.get('suggestion');
      if (suggestionId) {
        const { error: suggestionLinkError } = await supabase
          .from('daily_suggestions')
          .update({ material_id: id })
          .eq('id', suggestionId)
          .is('material_id', null); // 이미 연결된 경우 덮어쓰지 않음
        if (suggestionLinkError) {
          toast('분석은 완료됐지만 추천 자료 연결에 실패했어요.', 'warning');
          return;
        }
      }

      if ('Notification' in window) {
        const permission = Notification.permission === 'default'
          ? await Notification.requestPermission()
          : Notification.permission;
        if (permission === 'granted') {
          new Notification('분석 완료', {
            body: `"${title || '새 자료'}" 분석이 완료되었습니다.`,
            icon: '/icon.svg',
          });
        }
      }
    } catch (err) {
      setError('분석 중 오류 — ' + friendlyToastMessage(err));
      setIsProcessing(false);
    }
  }

  // 문장 목록 감지 — 배너 노출 여부·통계·현재 과 크기로 나눴을 때의 챕터 수.
  // 조기 return(로딩)보다 **위**에 둔다(#838 Hooks 순서 사고와 같은 자리).
  const sentenceList = useMemo(() => {
    const detected = looksLikeSentenceList(rawText);
    const stats = detected ? sentenceListStats(rawText) : { lines: 0, blankRatio: 0, avgLen: 0 };
    const per = clampLinesPerChapter(linesPerChapter);
    return { detected, stats, chapterCount: detected ? Math.ceil(stats.lines / per) : 0 };
  }, [rawText, linesPerChapter]);

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
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-header__title">새 자료 추가</h1>
        <p className="page-header__subtitle">AI가 문장을 형태소 단위로 해부해 드립니다</p>
      </div>

      <MaterialAddPdfSection
        user={user}
        toast={toast}
        onRangeReady={handlePdfRangeReady}
      />

      <MaterialAddEpubSection toast={toast} onReady={handleEpubReady} onBookReady={handleEpubBookReady} />

      {/* 책 초안 — EPUB 반입은 EPUB 섹션 바로 아래에서 결과를 보여준다(누른 자리) */}
      {bookDraft?.origin === 'epub' && (
        <BookDraftPanel
          draft={bookDraft}
          setDraft={setBookDraft}
          onRegister={handleBookRegister}
          registering={bookRegistering}
          doneCount={bookDoneCount}
          onCancel={() => { setBookDraft(null); setBookDoneCount(0); }}
          onDone={() => router.push('/materials')}
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

        {/* Title */}
        <div className="form-field">
          <label className="form-label">제목</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="기사 제목이나 책 이름을 입력하세요"
            className="form-input"
          />
        </div>

        {/* Visibility + Language */}
        <div className="form-row">
          <div className="form-field">
            <label className="form-label">
              공개 범위
              {(pdfSource || epubSource) && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 6 }}>({pdfSource ? 'PDF' : 'EPUB'} 출처는 비공개 고정)</span>}
            </label>
            <div className="toggle-group">
              <button
                onClick={() => !pdfSource && !epubSource && setVisibility('private')}
                className={`toggle-btn ${visibility === 'private' ? 'toggle-btn--primary' : ''}`}
                disabled={!!pdfSource || epubSource}
              >
                비공개
              </button>
              <button
                onClick={() => !pdfSource && !epubSource && setVisibility('public')}
                className={`toggle-btn ${visibility === 'public' ? 'toggle-btn--accent' : ''}`}
                disabled={!!pdfSource || epubSource}
              >
                공용
              </button>
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">학습 언어</label>
            <div className="toggle-group">
              {/* 해부 분석이 지원하는 언어 — 일본어(형태소)·영어(표제어)·중국어(단어 분할+병음) */}
              {[
                ['Japanese', '일본어', 'N3 중급'],
                ['English', '영어', 'B1 중급'],
                ['Chinese', '중국어', 'H3 중급'],
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
        </div>

        {/* Level */}
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

        {/* Text */}
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

          {/* 붙여넣기 분할 결과는 누른 자리(텍스트 칸 바로 아래)에 펼친다 — 위쪽에 그리면
              버튼을 눌러도 화면 밖에서 나타나 아무 일도 안 일어난 것처럼 보인다. */}
          {bookDraft && bookDraft.origin !== 'epub' && (
            <div style={{ marginTop: 12 }}>
              <BookDraftPanel
                draft={bookDraft}
                setDraft={setBookDraft}
                onRegister={handleBookRegister}
                registering={bookRegistering}
                doneCount={bookDoneCount}
                onCancel={() => { setBookDraft(null); setBookDoneCount(0); }}
                onDone={() => router.push('/materials')}
                chapterRanges={chapterRanges}
              />
            </div>
          )}

          {/* 문장 목록 감지 배너 — 어휘 교재 예문집처럼 한 줄 한 문장인 자료를 과 단위로 나눈다.
              감지가 틀려도 배너일 뿐이라 무시하고 그냥 등록하면 된다. */}
          {sentenceList.detected && !bookDraft && (
            <div style={{
              marginTop: 10, padding: '12px 14px',
              background: 'var(--primary-glow)', border: '1px solid var(--primary)',
              borderRadius: 'var(--radius-md)',
            }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-light)' }}>
                📋 문장 목록처럼 보여요
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 3 }}>
                {sentenceList.stats.lines.toLocaleString()}줄 · 평균 {Math.round(sentenceList.stats.avgLen)}자 ·
                {' '}한 덩어리로 두면 {LINES_PER_REQUEST_CAP}줄까지만 분석돼요
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <input
                  type="number"
                  min={1}
                  max={LINES_PER_REQUEST_CAP}
                  value={linesPerChapter}
                  onChange={(e) => setLinesPerChapter(e.target.value)}
                  aria-label="한 과에 넣을 문장 수"
                  style={{
                    width: 64, padding: '5px 8px', fontSize: '0.85rem', textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                    border: '1px solid var(--border, var(--text-muted))', borderRadius: 'var(--radius-sm, 6px)',
                  }}
                />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  문장씩 → <strong style={{ color: 'var(--text-primary)' }}>{sentenceList.chapterCount}챕터</strong>
                </span>
                <Button size="sm" onClick={handleSplitSentenceList} style={{ marginLeft: 'auto' }}>
                  챕터로 나누기
                </Button>
              </div>
            </div>
          )}
        </div>

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
        {error && <div className="error-banner">{error}</div>}

        {/* Actions */}
        {completedId ? (
          <div className="form-actions form-actions--done">
            <Button size="lg" style={{ flex: 2 }} onClick={() => router.push(`/viewer/${completedId}`)}>
              지금 바로 읽기
            </Button>
            <Button variant="secondary" size="lg" style={{ flex: 1 }} onClick={() => router.push('/materials')}>
              자료실 보기
            </Button>
          </div>
        ) : (
          <div className="form-actions">
            <Button
              onClick={handleStart}
              disabled={isProcessing}
              size="lg"
              style={{ flex: 3 }}
            >
              {isProcessing ? 'AI 해부 분석 진행 중...' : '분석 시작하기'}
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
