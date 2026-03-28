'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import Button from '../components/Button';
import { analyzeText } from '../lib/analyzeText';
import { LEVELS } from '../lib/constants';

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
      const { data, error: insertError } = await supabase
        .from('reading_materials')
        .insert([{ title: title || "제목 없음", raw_text: rawText, processed_json: initJson, visibility, owner_id: user.id }])
        .select();

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
        onBatch: async ({ currentJson, processed, total, failed }) => {
          setStatus(`⏳ 병렬 분석 중... (${processed}/${total} 문단)`);
          setProgress(Math.floor((processed / total) * 90) + 10);
          await supabase.from('reading_materials').update({ processed_json: currentJson }).eq('id', id);
          if (failed) {
            setStatus('⚠️ 일부 문단 분석 실패. 뷰어에서 다시 시도할 수 있습니다.');
            setIsProcessing(false);
          }
        },
      });

      if (finalJson.status === 'failed') return;

      setStatus('✅ 전체 분석 완료!');
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

      <div className="card add-form">
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
            <label className="form-label">공개 범위</label>
            <div className="toggle-group">
              <button
                onClick={() => setVisibility('private')}
                className={`toggle-btn ${visibility === 'private' ? 'toggle-btn--primary' : ''}`}
              >
                🔒 Private
              </button>
              <button
                onClick={() => setVisibility('public')}
                className={`toggle-btn ${visibility === 'public' ? 'toggle-btn--accent' : ''}`}
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
        </div>

        {/* Progress */}
        {isProcessing && (
          <div className="progress-wrap">
            <div className="progress-wrap__header">
              <span className="progress-wrap__status">{status}</span>
              <span>{progress}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-bar__fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Error */}
        {error && <div className="error-banner">⚠️ {error}</div>}

        {/* Actions */}
        {completedId ? (
          <div className="form-actions">
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
