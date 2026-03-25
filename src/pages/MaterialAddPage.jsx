import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

// --- AI Service Logic (Ported from legacy/ai-service.js) ---
const GEMINI_MODEL = 'gemini-2.0-flash-lite-preview-02-05';

async function callGemini(prompt, options = {}) {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      model: GEMINI_MODEL,
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
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [rawText, setRawText] = useState('');
  const [visibility, setVisibility] = useState('private');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('시스템 대기 중');
  const [error, setError] = useState('');

  const abortControllerRef = useRef(null);

  async function handleStart() {
    if (!user) return alert("로그인이 필요합니다.");
    if (!rawText.trim()) return alert("내용을 입력해주세요.");

    setIsProcessing(true);
    setProgress(5);
    setStatus('⏳ 1단계: 뼈대 저장 중...');
    setError('');

    try {
      // 1. Initial skeleton save
      const initJson = { sequence: [], dictionary: {}, last_idx: -1, status: "analyzing" };
      const { data, error: insertError } = await supabase
        .from('reading_materials')
        .insert([{
          title: title || "제목 없음",
          raw_text: rawText,
          processed_json: initJson,
          visibility: visibility,
          owner_id: user.id
        }])
        .select();

      if (insertError) throw insertError;
      const newId = data[0].id;

      setStatus('✅ 저장 완료! 백그라운드 분석을 시작합니다...');
      setProgress(10);

      // 2. Start background analysis (Parallel)
      runBackgroundAnalysis(newId, rawText);

    } catch (err) {
      setError("저장 오류: " + err.message);
      setIsProcessing(false);
    }
  }

  async function runBackgroundAnalysis(id, text) {
    const lines = text.split('\n');
    const timestamp = Date.now();
    const CONCURRENCY = 5;

    let currentJson = { sequence: [], dictionary: {}, last_idx: -1, status: "analyzing" };

    try {
      for (let i = 0; i < lines.length; i += CONCURRENCY) {
        const batchIndices = [];
        for (let j = 0; j < CONCURRENCY && i + j < lines.length; j++) {
          batchIndices.push(i + j);
        }

        const maxProgress = Math.min(i + CONCURRENCY, lines.length);
        setStatus(`⏳ 병렬 분석 중... (${maxProgress}/${lines.length} 문단)`);
        setProgress(Math.floor((maxProgress / lines.length) * 90) + 10);

        // Promise.all Parallel Requests
        const promises = batchIndices.map(async (idx) => {
          const line = lines[idx].trim();
          if (!line) return { idx, success: true, empty: true };

          const prompt = buildTokenizationPrompt(line);
          let failCount = 0;
          while (failCount < 3) {
            try {
              const rawContent = await callGemini(prompt);
              const payload = parseGeminiJSON(rawContent);
              return { idx, success: true, payload };
            } catch (e) {
              failCount++;
              if (failCount >= 3) return { idx, success: false, err: e.message };
              await new Promise(r => setTimeout(r, 2000));
            }
          }
        });

        const results = await Promise.all(promises);
        let batchFailed = false;

        for (let res of results) {
          if (!res.success) {
            batchFailed = true;
            continue;
          }

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
          setStatus('⚠️ 일부 문단 분석 실패. 나중에 뷰어에서 다시 시도할 수 있습니다.');
          setIsProcessing(false);
          return;
        }

        if (batchIndices[batchIndices.length - 1] === lines.length - 1) {
          currentJson.status = "completed";
        }
        
        await supabase.from('reading_materials').update({ processed_json: currentJson }).eq('id', id);
      }

      setStatus('✅ 전체 분석 완료! 자료실로 이동합니다.');
      setProgress(100);
      setTimeout(() => navigate('/materials'), 1500);

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

      <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>제목</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="기사 제목이나 책 이름을 입력하세요"
            style={{
              width: '100%', padding: '14px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', outline: 'none'
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>공개 범위</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setVisibility('private')}
              style={{
                flex: 1, padding: '10px', borderRadius: 'var(--radius-md)',
                background: visibility === 'private' ? 'var(--primary)' : 'var(--bg-secondary)',
                color: visibility === 'private' ? 'white' : 'var(--text-secondary)',
                border: '1px solid var(--border)', fontSize: '0.9rem'
              }}
            >
              🔒 Private (나만 보기)
            </button>
            <button
              onClick={() => setVisibility('public')}
              style={{
                flex: 1, padding: '10px', borderRadius: 'var(--radius-md)',
                background: visibility === 'public' ? 'var(--accent)' : 'var(--bg-secondary)',
                color: visibility === 'public' ? 'white' : 'var(--text-secondary)',
                border: '1px solid var(--border)', fontSize: '0.9rem'
              }}
            >
              🌐 Public (도서관 공유)
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>본문 텍스트</label>
          <textarea
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            placeholder="분석할 문장을 입력하세요 (엔터로 문단 구분)"
            style={{
              width: '100%', height: '240px', padding: '16px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', outline: 'none', resize: 'vertical',
              lineHeight: '1.6', fontSize: '1rem'
            }}
          />
        </div>

        {isProcessing && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px' }}>
              <span style={{ color: 'var(--primary-light)' }}>{status}</span>
              <span>{progress}%</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: 'var(--bg-secondary)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: '14px', background: 'rgba(255, 107, 107, 0.1)', border: '1px solid rgba(255, 107, 107, 0.3)', color: '#FF6B6B', borderRadius: 'var(--radius-md)', marginBottom: '20px', fontSize: '0.9rem' }}>
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={isProcessing}
          style={{
            width: '100%', padding: '16px', borderRadius: 'var(--radius-md)',
            background: isProcessing ? 'var(--bg-elevated)' : 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
            color: 'white', fontWeight: 700, fontSize: '1.1rem',
            border: 'none', cursor: isProcessing ? 'wait' : 'pointer',
            boxShadow: isProcessing ? 'none' : '0 4px 20px rgba(124, 92, 252, 0.3)',
            transition: 'all 0.2s'
          }}
        >
          {isProcessing ? 'AI 해부 분석 진행 중...' : '🚀 분석 시작하기'}
        </button>
      </div>
    </div>
  );
}
