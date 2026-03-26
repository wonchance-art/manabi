'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import Button from '../components/Button';

// --- AI Service Logic ---
const GEMINI_MODEL = 'gemini-2.0-flash-lite-preview-02-05';

async function callGemini(prompt, signal, options = {}) {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      ...(Object.keys(options).length > 0 ? { generationConfig: options } : {})
    })
  });
  const resData = await response.json();
  if (!response.ok) throw new Error(resData.error?.message || "API 요청 실패");
  return resData.candidates[0].content.parts[0].text;
}

function parseGeminiJSON(rawText) {
  const clean = rawText.replace(/```json|```/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error("JSON 괄호를 찾을 수 없습니다.");
  return JSON.parse(clean.substring(start, end + 1));
}

function buildTokenizationPrompt(text) {
  const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `입력된 텍스트 "${escaped}"를 정밀 분석해서 반드시 아래 규칙을 지킨 JSON으로 응답해.

1. 데이터 구조 (Index Mapping):
   - "sequence": ["0", "1", "2", ...] 형태로 원문의 모든 요소를 순서대로 번호를 매길 것.
   - "dictionary": {"0": {...}, "1": {...}} 형태로 정보를 넣을 것.

2. 분석 규칙 (필독):
   - 문단 구분 보존: 원문에 줄 바꿈(\\n)이 있다면 반드시 하나의 독립된 토큰으로 포함할 것.
   - 모든 단어와 기호(따옴표, 콤마, 마침표, 띄어쓰기 등)를 빠짐없이 토큰으로 분리할 것.
   - [영어]: 단어 토큰의 'furigana' 필드에 발음 기호(IPA) 작성 (/ / 포함).
   - [일본어]: 한자가 포함된 토큰만 'furigana' 작성.
   - meaning & pos: 무조건 한국어로 정확한 품사와 뜻 작성.
   - 응답은 무조건 { "sequence": [... ] 로 시작하는 유효한 JSON 포맷이어야 함.

설명 없이 오직 순수한 JSON만 응답할 것.`;
}

// --- Component ---
export default function MaterialAddPage() {
  const { user } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [rawText, setRawText] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [language, setLanguage] = useState('Japanese');
  const [level, setLevel] = useState('N3');

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('시스템 대기 중');
  const [error, setError] = useState('');

  const abortControllerRef = useRef(null);

  // 알림 권한 요청
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const levels = {
    Japanese: ['N5 기초', 'N4 기본', 'N3 중급', 'N2 상급', 'N1 심화'],
    English: ['A1 기초', 'A2 초급', 'B1 중급', 'B2 상급', 'C1 고급', 'C2 마스터']
  };

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
    const lines = text.split('\n');
    const timestamp = Date.now();
    const CONCURRENCY = 5;
    let currentJson = { sequence: [], dictionary: {}, last_idx: -1, status: "analyzing" };

    try {
      for (let i = 0; i < lines.length; i += CONCURRENCY) {
        const batchIndices = [];
        for (let j = 0; j < CONCURRENCY && i + j < lines.length; j++) batchIndices.push(i + j);

        const maxProgress = Math.min(i + CONCURRENCY, lines.length);
        setStatus(`⏳ 병렬 분석 중... (${maxProgress}/${lines.length} 문단)`);
        setProgress(Math.floor((maxProgress / lines.length) * 90) + 10);

        const promises = batchIndices.map(async (idx) => {
          const line = lines[idx].trim();
          if (!line) return { idx, success: true, empty: true };

          let failCount = 0;
          while (failCount < 3) {
            try {
              const rawContent = await callGemini(buildTokenizationPrompt(line), signal);
              return { idx, success: true, payload: parseGeminiJSON(rawContent) };
            } catch (e) {
              if (signal.aborted) throw e;
              failCount++;
              if (failCount >= 3) return { idx, success: false, err: e.message };
              await new Promise(r => setTimeout(r, 2000));
            }
          }
        });

        const results = await Promise.all(promises);
        let batchFailed = false;

        for (let res of results) {
          if (!res.success) { batchFailed = true; continue; }
          if (res.empty) {
            if (res.idx < lines.length - 1) {
              const brId = `br_${res.idx}_${timestamp}`;
              currentJson.sequence.push(brId);
              currentJson.dictionary[brId] = { text: "\n", pos: "개행" };
            }
            currentJson.last_idx = Math.max(currentJson.last_idx, res.idx);
          } else if (res.payload) {
            res.payload.sequence.forEach((oldId, pIdx) => {
              const newId = `id_${res.idx}_${pIdx}_${timestamp}`;
              currentJson.sequence.push(newId);
              currentJson.dictionary[newId] = res.payload.dictionary[oldId];
            });
            if (res.idx < lines.length - 1) {
              const brId = `br_${res.idx}_${timestamp}`;
              currentJson.sequence.push(brId);
              currentJson.dictionary[brId] = { text: "\n", pos: "개행" };
            }
            currentJson.last_idx = Math.max(currentJson.last_idx, res.idx);
          }
        }

        if (batchFailed) {
          currentJson.status = "failed";
          await supabase.from('reading_materials').update({ processed_json: currentJson }).eq('id', id);
          setStatus('⚠️ 일부 문단 분석 실패. 뷰어에서 다시 시도할 수 있습니다.');
          setIsProcessing(false);
          return;
        }

        if (batchIndices[batchIndices.length - 1] === lines.length - 1) currentJson.status = "completed";
        await supabase.from('reading_materials').update({ processed_json: currentJson }).eq('id', id);
      }

      setStatus('✅ 전체 분석 완료! 자료실로 이동합니다.');
      setProgress(100);

      // 브라우저 알림 (탭이 백그라운드일 때 유용)
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('분석 완료! 🎉', {
          body: `"${title || '새 자료'}" 분석이 완료되었습니다.`,
          icon: '/icon.svg',
        });
      }

      setTimeout(() => router.push('/materials'), 1500);
    } catch (err) {
      setError("분석 중 오류: " + err.message);
      setIsProcessing(false);
    }
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
                onClick={() => { setLanguage('Japanese'); setLevel('N3'); }}
                className={`toggle-btn ${language === 'Japanese' ? 'toggle-btn--primary' : ''}`}
              >
                🇯🇵 Japanese
              </button>
              <button
                onClick={() => { setLanguage('English'); setLevel('B1'); }}
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
            {levels[language].map(lvl => (
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
      </div>
    </div>
  );
}
