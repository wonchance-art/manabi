'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import Button from '../components/Button';
import { analyzeText } from '../lib/analyzeText';
import { LEVELS } from '../lib/constants';
import MaterialAddPdfSection from './MaterialAddPdfSection';

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
        raw_text: rawText,
        processed_json: initJson,
        visibility: pdfSource ? 'private' : visibility, // PDF 출처는 강제 private
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

      // PDF의 last_page_read 업데이트
      if (pdfSource && !insertError) {
        supabase.from('uploaded_pdfs')
          .update({ last_page_read: pdfSource.pageEnd })
          .eq('id', pdfSource.pdf.id)
          .then(() => {});
      }

      if (insertError) throw insertError;

      setStatus('✅ 저장 완료! 백그라운드 분석을 시작합니다...');
      setProgress(10);
      runBackgroundAnalysis(data[0].id, rawText, controller.signal);
    } catch (err) {
      if (err.name === 'AbortError') {
        setStatus('🛑 분석이 중단되었습니다.');
      } else {
        setError("저장 오류: " + err.message);
      }
      setIsProcessing(false);
    }
  }

  function handleCancel() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setStatus('🛑 중단 요청 중...');
    }
  }

  async function runBackgroundAnalysis(id, text, signal) {
    try {
      const finalJson = await analyzeText(text, signal, {
        metadata: { language, level, updated_at: new Date().toISOString() },
        concurrency: 8, // PDF/페이스트 모두 더 빠르게
        onBatch: async ({ currentJson, processed, total }) => {
          const failedSoFar = currentJson.failed_indices?.length || 0;
          setStatus(`⏳ 분석 중... (${processed}/${total}줄${failedSoFar > 0 ? ` · 실패 ${failedSoFar}` : ''})`);
          setProgress(Math.floor((processed / total) * 90) + 10);
          const { error: updateError } = await supabase
            .from('reading_materials').update({ processed_json: currentJson }).eq('id', id);
          if (updateError) console.error('[analyzeText onBatch] DB update failed:', updateError.message);
        },
      });

      const failedCount = finalJson.failed_indices?.length || 0;
      setStatus(failedCount > 0
        ? `⚠️ 분석 완료 (${failedCount}개 단락 재시도 필요)`
        : '✅ 전체 분석 완료!');
      setProgress(100);
      setIsProcessing(false);
      setCompletedId(id);

      // 추천 자료에서 진입했으면 material_id 기록 (이후 유저는 바로 뷰어로)
      const suggestionId = searchParams.get('suggestion');
      if (suggestionId) {
        await supabase
          .from('daily_suggestions')
          .update({ material_id: id })
          .eq('id', suggestionId)
          .is('material_id', null); // 이미 연결된 경우 덮어쓰지 않음
      }

      if ('Notification' in window) {
        const permission = Notification.permission === 'default'
          ? await Notification.requestPermission()
          : Notification.permission;
        if (permission === 'granted') {
          new Notification('분석 완료! 🎉', {
            body: `"${title || '새 자료'}" 분석이 완료되었습니다.`,
            icon: '/icon.svg',
          });
        }
      }
    } catch (err) {
      setError('분석 중 오류: ' + err.message);
      setIsProcessing(false);
    }
  }

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
        <h1 className="page-header__title">📝 새 자료 추가</h1>
        <p className="page-header__subtitle">AI가 문장을 형태소 단위로 해부해 드립니다</p>
      </div>

      <MaterialAddPdfSection
        user={user}
        toast={toast}
        onRangeReady={handlePdfRangeReady}
      />

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
              <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700 }}>
                📘 PDF 출처
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
              {pdfSource && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 6 }}>(PDF 출처는 Private 고정)</span>}
            </label>
            <div className="toggle-group">
              <button
                onClick={() => !pdfSource && setVisibility('private')}
                className={`toggle-btn ${visibility === 'private' ? 'toggle-btn--primary' : ''}`}
                disabled={!!pdfSource}
              >
                🔒 Private
              </button>
              <button
                onClick={() => !pdfSource && setVisibility('public')}
                className={`toggle-btn ${visibility === 'public' ? 'toggle-btn--accent' : ''}`}
                disabled={!!pdfSource}
              >
                🌐 Public
              </button>
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">학습 언어</label>
            <div className="toggle-group">
              <button
                onClick={() => { setLanguage('Japanese'); setLevel('N3 중급'); }}
                className={`toggle-btn ${language === 'Japanese' ? 'toggle-btn--primary' : ''}`}
              >
                🇯🇵 Japanese
              </button>
              <button
                onClick={() => { setLanguage('English'); setLevel('B1 중급'); }}
                className={`toggle-btn ${language === 'English' ? 'toggle-btn--primary' : ''}`}
              >
                🇬🇧 English
              </button>
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
          <label className="form-label">본문 텍스트</label>
          <textarea
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            placeholder="분석할 문장을 입력하세요 (엔터로 문단 구분)"
            className="form-textarea"
          />
          {rawText.length > 0 && (
            <div className={`form-char-count ${rawText.length > 50000 ? 'form-char-count--over' : rawText.length > 30000 ? 'form-char-count--warn' : ''}`}>
              {rawText.length.toLocaleString()}자 · 약 {rawText.split('\n').filter(l => l.trim()).length}개 문단
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
        {error && <div className="error-banner">⚠️ {error}</div>}

        {/* Actions */}
        {completedId ? (
          <div className="form-actions form-actions--done">
            <Button size="lg" style={{ flex: 2 }} onClick={() => router.push(`/viewer/${completedId}`)}>
              📖 지금 바로 읽기
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
              {isProcessing ? 'AI 해부 분석 진행 중...' : '🚀 분석 시작하기'}
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
