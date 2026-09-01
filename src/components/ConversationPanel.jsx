'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { callGemini } from '../lib/gemini';
import { useTTS } from '../lib/useTTS';
import { useOutputWords } from '../lib/useOutputWords';
import Button from './Button';
import OutputWordChips from './OutputWordChips';
import { langNameKo } from '../lib/constants';

const STORAGE_KEY = 'conversation:';

export function isConversationRequestCurrent(requestRef, requestId, materialRef, materialId) {
  return requestRef.current === requestId && materialRef.current === materialId;
}

export default function ConversationPanel({ rawText, language, materialId, materialTitle, onClose, inline = false, nextLesson = null }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [sttSupported, setSttSupported] = useState(false);
  const recognitionRef = useRef(null);
  const requestRef = useRef(0);
  const materialRef = useRef(materialId);
  const skipPersistRef = useRef(false);
  const { speak, supported: ttsSupported } = useTTS();
  const scrollRef = useRef(null);
  // ⚠ 예전엔 `language === 'Japanese' ? 'Japanese' : 'English'`였다. 이 값은 **LLM 프롬프트**
  // 에 그대로 들어가므로(「ONLY in ${targetLang}」), 중국어·프랑스어 지문에서 튜터가
  // **영어로 답했다** — 바로 아래 `targetLangKo`는 「중국어」라고 적으면서.
  // 이미 아는 언어를 접을 이유가 없다.
  const targetLang = language || 'English';
  const targetLangKo = langNameKo(language);
  // 오늘 복습한 말 주입(목업 ③ — #1077-17): 튜터 프롬프트에 조용히, 학생이 쓰면 ✓
  const outputWords = useOutputWords(language);
  const usedWordSet = new Set(
    outputWords
      .filter((w) => messages.some((m) => m.role === 'user' && m.text?.includes(w.word_text)))
      .map((w) => w.word_text)
  );

  materialRef.current = materialId;

  function isCurrentRequest(requestId, requestMaterialId) {
    return isConversationRequestCurrent(requestRef, requestId, materialRef, requestMaterialId);
  }

  function startListening() {
    if (listening || !sttSupported) return;
    const recognitionMaterialId = materialId;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new SR();
    recog.lang = language === 'Japanese' ? 'ja-JP' : 'en-US';
    recog.continuous = false;
    recog.interimResults = false;
    recog.onresult = (event) => {
      if (recognitionRef.current !== recog || materialRef.current !== recognitionMaterialId) return;
      const transcript = event.results[0][0].transcript;
      setInput(prev => (prev ? prev + ' ' : '') + transcript);
    };
    recog.onend = () => {
      if (recognitionRef.current !== recog) return;
      recognitionRef.current = null;
      setListening(false);
    };
    recog.onerror = () => {
      if (recognitionRef.current !== recog) return;
      recognitionRef.current = null;
      setListening(false);
    };
    recognitionRef.current = recog;
    setListening(true);
    try { recog.start(); } catch {
      recognitionRef.current = null;
      setListening(false);
    }
  }

  function stopListening() {
    try { recognitionRef.current?.stop(); } catch {}
    setListening(false);
  }

  useEffect(() => {
    setSttSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
    return () => {
      requestRef.current += 1;
      try { recognitionRef.current?.abort?.(); } catch {}
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    requestRef.current += 1;
    try { recognitionRef.current?.abort?.(); } catch {}
    recognitionRef.current = null;
    setListening(false);
    setLoading(false);
    setInput('');

    skipPersistRef.current = true;
    if (!materialId) {
      setMessages([]);
      return;
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY + materialId);
      setMessages(saved ? JSON.parse(saved) : []);
    } catch { setMessages([]); }
  }, [materialId]);

  useEffect(() => {
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    if (!materialId) return;
    try {
      if (messages.length > 0) localStorage.setItem(STORAGE_KEY + materialId, JSON.stringify(messages));
    } catch {}
  }, [messages, materialId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  async function startConversation() {
    if (messages.length > 0 || loading) return;
    const requestMaterialId = materialId;
    const requestId = ++requestRef.current;
    setLoading(true);
    const prompt = `You are a friendly language tutor having a casual conversation with a student.
The student just read this ${targetLang} passage titled "${materialTitle || ''}":
"""
${(rawText || '').slice(0, 1500)}
"""

Open with ONE warm, specific question about the passage. Rules:
- ONLY in ${targetLang}
- 1-2 sentences
- Friendly tone, not exam-like
- Make the student want to reply${outputWords.length ? `
- If it fits naturally, weave in one of these words the student reviewed today: ${outputWords.map((w) => w.word_text).join(', ')}. Never force them.` : ''}`;
    try {
      const raw = await callGemini(prompt);
      if (!isCurrentRequest(requestId, requestMaterialId)) return;
      const text = (raw?.candidates?.[0]?.content?.parts?.[0]?.text || raw || '').trim();
      if (text) setMessages([{ role: 'ai', text, ts: Date.now() }]);
    } catch {
      if (!isCurrentRequest(requestId, requestMaterialId)) return;
      setMessages([{ role: 'ai', text: '(시작에 실패했어요. 다시 시도해 주세요)', ts: Date.now(), error: true }]);
    } finally {
      if (isCurrentRequest(requestId, requestMaterialId)) setLoading(false);
    }
  }

  async function send() {
    const userText = input.trim();
    if (!userText || loading) return;
    setInput('');
    const next = [...messages, { role: 'user', text: userText, ts: Date.now() }];
    setMessages(next);
    const requestMaterialId = materialId;
    const requestId = ++requestRef.current;
    setLoading(true);

    const history = next.map(m => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.text}`).join('\n');
    const prompt = `You are a language tutor conversing with a student about a ${targetLang} passage:
"""
${(rawText || '').slice(0, 1500)}
"""

Conversation so far:
${history}

Reply in TWO parts.

PART 1 — Tutor reply in ${targetLang}:
- 2-3 sentences max
- Match the student's apparent level
- Stay near the passage topic, ask a follow-up question${outputWords.length ? `
- If it fits naturally, weave in one of these words the student reviewed today: ${outputWords.map((w) => w.word_text).join(', ')}. Never force them.` : ''}

PART 2 — If the student's most recent message contains a clear ${targetLang} error (grammar, word choice, naturalness), give ONE brief correction in Korean. Format EXACTLY:
📝 교정: <한국어로 1-2문장>
If the message has no notable errors, OMIT PART 2 entirely.

Output PART 1, then a blank line, then PART 2 (if any). No labels, no other text.`;
    try {
      const raw = await callGemini(prompt);
      if (!isCurrentRequest(requestId, requestMaterialId)) return;
      const full = (raw?.candidates?.[0]?.content?.parts?.[0]?.text || raw || '').replace(/^Tutor:\s*/i, '').trim();
      const correctionMatch = full.match(/📝\s*교정:\s*(.+)$/s);
      const correction = correctionMatch ? correctionMatch[1].trim() : null;
      const text = (correctionMatch ? full.slice(0, correctionMatch.index) : full).trim();
      setMessages(prev => [
        ...prev,
        { role: 'ai', text: text || '(응답이 비어있어요)', correction, ts: Date.now() },
      ]);
    } catch {
      if (!isCurrentRequest(requestId, requestMaterialId)) return;
      setMessages(prev => [...prev, { role: 'ai', text: '(응답을 받지 못했어요)', ts: Date.now(), error: true }]);
    } finally {
      if (isCurrentRequest(requestId, requestMaterialId)) setLoading(false);
    }
  }

  function reset() {
    setMessages([]);
    if (materialId) localStorage.removeItem(STORAGE_KEY + materialId);
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const placeholder = `${targetLangKo}로 자유롭게 답변해 보세요`;

  return (
    <div className={`conversation-panel ${inline ? 'conversation-panel--inline' : ''}`}>
      <div className="conversation-panel__header">
        <h3 style={{ margin: 0, fontSize: '1.05rem' }}>회화 연습</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {nextLesson && messages.length >= 4 && (
            <Link href={`/viewer/${nextLesson.id}`} className="btn btn--ghost btn--sm" title={nextLesson.title}>
              다음 편 →
            </Link>
          )}
          {messages.length > 0 && (
            <button onClick={reset} className="btn btn--ghost btn--sm" title="대화 초기화">↺ 새 대화</button>
          )}
          {onClose && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
          )}
        </div>
      </div>

      {outputWords.length > 0 && (
        <div style={{ padding: '8px 14px 0' }}>
          <OutputWordChips words={outputWords} usedSet={usedWordSet} />
        </div>
      )}

      <div className="conversation-panel__messages" ref={scrollRef}>
        {messages.length === 0 && !loading && (
          <div className="conversation-panel__empty">
            <p style={{ margin: '0 0 14px', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              {targetLangKo}로 AI 튜터와 본문에 대해 대화해보세요.<br />
              짧고 자연스러운 질문으로 시작합니다.
            </p>
            <Button onClick={startConversation}>대화 시작</Button>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`conversation-msg-wrap conversation-msg-wrap--${m.role}`}>
            <div className={`conversation-msg conversation-msg--${m.role}`}>
              <div className="conversation-msg__bubble">
                {m.text}
              </div>
              {m.role === 'ai' && ttsSupported && !m.error && (
                <button
                  className="conversation-msg__tts"
                  onClick={() => speak(m.text, language)}
                  title="발음 듣기"
                  aria-label="발음 듣기"
                >▷</button>
              )}
            </div>
            {m.role === 'ai' && m.correction && (
              <div className="conversation-correction">
                <span>{m.correction}</span>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="conversation-msg conversation-msg--ai">
            <div className="conversation-msg__bubble conversation-msg__bubble--loading">
              <span className="conversation-msg__dots"><span /><span /><span /></span>
            </div>
          </div>
        )}
      </div>

      {messages.length > 0 && (
        <div className="conversation-panel__input-row">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={listening ? '듣는 중...' : placeholder}
            className="conversation-panel__input"
            rows={2}
            disabled={loading}
          />
          {sttSupported && (
            <button
              type="button"
              className="conversation-panel__mic"
              onClick={listening ? stopListening : startListening}
              title={listening ? '중지' : '음성 입력'}
              aria-label={listening ? '음성 입력 중지' : '음성 입력'}
              disabled={loading}
            >
              {listening ? '⏹' : '●'}
            </button>
          )}
          <Button onClick={send} disabled={loading || !input.trim()}>
            보내기
          </Button>
        </div>
      )}
    </div>
  );
}
