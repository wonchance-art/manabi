'use client';

import { useEffect, useRef, useState } from 'react';
import JaText from './JaText';
import TtsVoicePicker from './TtsVoicePicker';

const RATE_KEY = 'lesson_tts_rate';
const RATE_OPTIONS = [0.7, 1, 1.2];
const VOICE_STORAGE_KEY = 'tts_voice';

function getSelectedVoiceURI(language) {
  if (typeof window === 'undefined') return null;
  const key = language === 'Japanese' || language === 'ja' ? 'ja' : 'en';
  try {
    const saved = JSON.parse(localStorage.getItem(VOICE_STORAGE_KEY) || '{}');
    return saved[key] || null;
  } catch { return null; }
}

/**
 * 강의 회화 섹션
 *  - turns: [{ja, ko}, ...] 또는 문자열 (줄바꿈 구분 fallback)
 *  - ▶ 모두 듣기: 순차 자동 재생 (현재 turn 하이라이트)
 *  - 한국어 가리기 토글: blur 처리 → 호버/탭으로 reveal
 *  - 개별 turn 클릭: 그 줄만 단발 재생
 */
export default function LessonConversation({ turns, language = 'Japanese', ttsSupported, speak, vocab }) {
  const list = normalizeTurns(turns);
  const langCode = language === 'Japanese' ? 'ja-JP' : 'en-US';

  const [playingIdx, setPlayingIdx] = useState(-1);
  const [hideKo, setHideKo] = useState(false);
  const [revealed, setRevealed] = useState(new Set());
  const [rate, setRate] = useState(1);
  const stopRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = Number(localStorage.getItem(RATE_KEY));
      if (RATE_OPTIONS.includes(saved)) setRate(saved);
    } catch {}
  }, []);

  function changeRate(r) {
    setRate(r);
    try { localStorage.setItem(RATE_KEY, String(r)); } catch {}
  }

  useEffect(() => {
    return () => {
      stopRef.current = true;
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function speakAndWait(text) {
    return new Promise(resolve => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        setTimeout(resolve, 1200);
        return;
      }
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = langCode;
        u.rate = rate;
        const wantedURI = getSelectedVoiceURI(language);
        if (wantedURI) {
          const v = window.speechSynthesis.getVoices().find(x => x.voiceURI === wantedURI);
          if (v) u.voice = v;
        }
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
      } catch { resolve(); }
    });
  }

  async function togglePlayAll() {
    if (!ttsSupported) return;
    if (playingIdx >= 0) {
      stopRef.current = true;
      window.speechSynthesis?.cancel();
      setPlayingIdx(-1);
      return;
    }
    stopRef.current = false;
    for (let i = 0; i < list.length; i++) {
      if (stopRef.current) break;
      setPlayingIdx(i);
      await speakAndWait(list[i].ja);
      if (stopRef.current) break;
      await new Promise(r => setTimeout(r, 250));
    }
    setPlayingIdx(-1);
  }

  function playOne(text) {
    if (!ttsSupported || !text || playingIdx >= 0) return;
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = langCode;
        u.rate = rate;
        const wantedURI = getSelectedVoiceURI(language);
        if (wantedURI) {
          const v = window.speechSynthesis.getVoices().find(x => x.voiceURI === wantedURI);
          if (v) u.voice = v;
        }
        window.speechSynthesis.speak(u);
        return;
      } catch {}
    }
    speak(text, language);
  }

  function toggleReveal(i) {
    setRevealed(prev => {
      const n = new Set(prev);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  }

  const playing = playingIdx >= 0;
  const hasKo = list.some(t => t.ko);

  return (
    <div className="lesson-conversation-wrap">
      {(ttsSupported || hasKo) && (
        <div className="lesson-conversation__controls">
          {ttsSupported && (
            <button
              type="button"
              onClick={togglePlayAll}
              className={`btn btn--sm ${playing ? 'btn--ghost' : 'btn--primary'}`}
            >
              {playing ? '■ 정지' : '▶ 모두 듣기'}
            </button>
          )}
          {ttsSupported && (
            <div className="lesson-conversation__rate" role="group" aria-label="재생 속도">
              {RATE_OPTIONS.map(r => (
                <button
                  key={r}
                  type="button"
                  className={`lesson-conversation__rate-btn ${rate === r ? 'is-active' : ''}`}
                  onClick={() => changeRate(r)}
                  aria-pressed={rate === r}
                >
                  {r === 1 ? '1×' : `${r}×`}
                </button>
              ))}
            </div>
          )}
          {ttsSupported && <TtsVoicePicker language={language} />}
          {hasKo && (
            <label className="lesson-conversation__toggle">
              <input
                type="checkbox"
                checked={hideKo}
                onChange={(e) => { setHideKo(e.target.checked); setRevealed(new Set()); }}
              />
              <span>한국어 가리기</span>
            </label>
          )}
        </div>
      )}

      <div className="lesson-conversation">
        {list.map((turn, i) => {
          const isPlaying = playingIdx === i;
          const turnClasses = [
            'lesson-conversation__turn',
            `lesson-conversation__turn--${i % 2 === 0 ? 'a' : 'b'}`,
            isPlaying ? 'lesson-conversation__turn--playing' : '',
          ].filter(Boolean).join(' ');
          const koHidden = hideKo && !revealed.has(i);
          return (
            <div
              key={i}
              className={turnClasses}
              onClick={() => playOne(turn.ja)}
              role="button"
              tabIndex={0}
              aria-current={isPlaying ? 'true' : undefined}
            >
              <div className="lesson-conversation__ja-row">
                <div className="lesson-conversation__ja"><JaText ja={turn.ja} vocab={vocab} /></div>
                {isPlaying && (
                  <span className="lesson-conversation__wave" aria-hidden="true">
                    <span /><span /><span /><span /><span />
                  </span>
                )}
              </div>
              {turn.ko && (
                <div
                  className={`lesson-conversation__ko ${koHidden ? 'lesson-conversation__ko--blurred' : ''}`}
                  onClick={(e) => { if (hideKo) { e.stopPropagation(); toggleReveal(i); } }}
                >
                  {turn.ko}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function normalizeTurns(turns) {
  if (Array.isArray(turns)) {
    return turns
      .map(t => (typeof t === 'string' ? { ja: t } : t))
      .filter(t => t && t.ja);
  }
  return String(turns || '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(ja => ({ ja }));
}
