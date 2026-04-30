'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { callGemini } from '../lib/gemini';
import { useTTS } from '../lib/useTTS';
import Button from './Button';

const STORAGE_KEY = 'conversation:';

export default function ConversationPanel({ rawText, language, materialId, materialTitle, onClose, inline = false, nextLesson = null }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const { speak, supported: ttsSupported } = useTTS();
  const scrollRef = useRef(null);
  const targetLang = language === 'Japanese' ? 'Japanese' : 'English';
  const targetLangKo = language === 'Japanese' ? '일본어' : '영어';

  // Web Speech Recognition 지원 체크 (Chrome/Edge/Safari)
  const sttSupported = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  function startListening() {
    if (listening || !sttSupported) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new SR();
    recog.lang = language === 'Japanese' ? 'ja-JP' : 'en-US';
    recog.continuous = false;
    recog.interimResults = false;
    recog.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => (prev ? prev + ' ' : '') + transcript);
    };
    recog.onend = () => setListening(false);
    recog.onerror = () => setListening(false);
    recognitionRef.current = recog;
    setListening(true);
    try { recog.start(); } catch { setListening(false); }
  }

  function stopListening() {
    try { recognitionRef.current?.stop(); } catch {}
    setListening(false);
  }

  useEffect(() => {
    if (!materialId) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY + materialId);
      if (saved) setMessages(JSON.parse(saved));
    } catch {}
  }, [materialId]);

  useEffect(() => {
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
- Make the student want to reply`;
    try {
      const raw = await callGemini(prompt);
      const text = (raw?.candidates?.[0]?.content?.parts?.[0]?.text || raw || '').trim();
      if (text) setMessages([{ role: 'ai', text, ts: Date.now() }]);
    } catch {
      setMessages([{ role: 'ai', text: '(시작에 실패했어요. 다시 시도해 주세요)', ts: Date.now(), error: true }]);
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    const userText = input.trim();
    if (!userText || loading) return;
    setInput('');
    const next = [...messages, { role: 'user', text: userText, ts: Date.now() }];
    setMessages(next);
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
- Stay near the passage topic, ask a follow-up question

PART 2 — If the student's most recent message contains a clear ${targetLang} error (grammar, word choice, naturalness), give ONE brief correction in Korean. Format EXACTLY:
📝 교정: <한국어로 1-2문장>
If the message has no notable errors, OMIT PART 2 entirely.

Output PART 1, then a blank line, then PART 2 (if any). No labels, no other text.`;
    try {
      const raw = await callGemini(prompt);
      const full = (raw?.candidates?.[0]?.content?.parts?.[0]?.text || raw || '').replace(/^Tutor:\s*/i, '').trim();
      const correctionMatch = full.match(/📝\s*교정:\s*(.+)$/s);
      const correction = correctionMatch ? correctionMatch[1].trim() : null;
      const text = (correctionMatch ? full.slice(0, correctionMatch.index) : full).trim();
      setMessages(prev => [
        ...prev,
        { role: 'ai', text: text || '(응답이 비어있어요)', correction, ts: Date.now() },
      ]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: '(응답을 받지 못했어요)', ts: Date.now(), error: true }]);
    } finally {
      setLoading(false);
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
        <h3 style={{ margin: 0, fontSize: '1.05rem' }}>💬 회화 연습</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {nextLesson && messages.length >= 4 && (
            <Link href={`/viewer/${nextLesson.id}`} className="btn btn--ghost btn--sm" title={nextLesson.title}>
              다음 강의 →
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

      <div className="conversation-panel__messages" ref={scrollRef}>
        {messages.length === 0 && !loading && (
          <div className="conversation-panel__empty">
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>💬</div>
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
                >🔊</button>
              )}
            </div>
            {m.role === 'ai' && m.correction && (
              <div className="conversation-correction">
                📝 <span>{m.correction}</span>
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
            placeholder={listening ? '🔴 듣는 중...' : placeholder}
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
              {listening ? '⏹' : '🎤'}
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
