'use client';

/**
 * 받아쓰기 패널 (#1077-6, 목업 ①) — 지정한 문장을 듣고 타이핑해 채점한다.
 * 채점은 dictation 엔진(gradeDictation — diffChars LCS), 듣기는 useTTS 재사용.
 * 패널이 열려 있는 동안 원문은 가려진다([본문 보기] 전까지) — 듣기 훈련의 전제.
 */
import { useState } from 'react';
import { useTTS } from '../lib/useTTS';
import { gradeDictation } from '../lib/dictation';
import Button from './Button';

const SEG_STYLE = {
  eq: {},
  ins: { color: 'var(--primary-light)', fontWeight: 700 }, // 정답에만 — 놓친 글자
  del: { color: 'var(--warning)', textDecoration: 'line-through' }, // 입력에만 — 잉여
};

export default function DictationPanel({ sentence, lang, onClose }) {
  const { speak, supported: ttsSupported } = useTTS();
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState(null);
  const [revealed, setRevealed] = useState(false);

  const grade = () => setResult(gradeDictation(sentence, typed, lang));
  const retry = () => {
    setTyped('');
    setResult(null);
    setRevealed(false);
  };

  return (
    <div
      role="dialog"
      aria-label="받아쓰기"
      style={{
        position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'rgba(0,0,0,0.45)', padding: 16,
      }}
      onClick={onClose}
    >
      <div className="card" style={{ maxWidth: 480, width: '100%', padding: '20px 22px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>🎧 받아쓰기</span>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.05rem', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
        </div>

        {ttsSupported ? (
          <Button size="sm" variant="secondary" onClick={() => speak(sentence, lang)}>▷ 다시 듣기</Button>
        ) : (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
            이 브라우저는 소리 재생을 지원하지 않아요.
          </p>
        )}

        <textarea
          className="form-input"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="들리는 대로 입력해 보세요"
          rows={2}
          lang={lang === 'Japanese' ? 'ja' : lang === 'Chinese' ? 'zh' : lang === 'French' ? 'fr' : 'en'}
          style={{ width: '100%', margin: '12px 0 10px', resize: 'vertical', fontSize: '1rem', lineHeight: 1.6 }}
        />

        {result && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 6 }}>
              {result.correct ? '✓ 완벽해요!' : result.accuracy != null ? `정답률 ${Math.round(result.accuracy * 100)}%` : '채점할 원문이 없어요'}
            </div>
            {!result.correct && (
              <div style={{ fontSize: '0.95rem', lineHeight: 1.7 }} lang={lang === 'Japanese' ? 'ja' : undefined}>
                {result.segments.map((s, i) => (
                  <span key={i} style={SEG_STYLE[s.type]}>{s.text}</span>
                ))}
              </div>
            )}
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 4 }}>
              파랑 = 놓친 글자 · 취소선 = 잘못 들어간 글자
            </div>
          </div>
        )}

        {revealed && (
          <div className="pdf-context__original" style={{ marginBottom: 10 }}>"{sentence}"</div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {!revealed && (
            <button type="button" onClick={() => setRevealed(true)}
              className="btn btn--ghost btn--sm">본문 보기</button>
          )}
          {result && (
            <button type="button" onClick={retry} className="btn btn--ghost btn--sm">한 번 더</button>
          )}
          <Button size="sm" disabled={!typed.trim()} onClick={grade}>채점</Button>
        </div>
      </div>
    </div>
  );
}
