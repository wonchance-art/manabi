'use client';

/**
 * 받아쓰기 추천 문장 고르기 (#1077-6 후속 — dictationPick 엔진 합류).
 * 문장 후보는 뷰어 정본 문장 단위(sentenceNav.pickableSentences)를 그대로 받고,
 * 고르기는 pickDictationSentences 엔진에 위임한다(길이 경계·담은 단어 우선·안정 정렬).
 *
 * 목록에 원문을 보이지 않는 것이 이 화면의 핵심 계약이다 — 받아쓰기는 원문 가림이
 * 전제인데 고르는 단계에서 정답이 보이면 훈련이 무너진다. 글자 수만 보여준다.
 */
import { useMemo } from 'react';
import { pickDictationSentences } from '../lib/dictationPick';
import Button from './Button';

export default function DictationPicker({ sentences, savedSet, onPick, onClose }) {
  const picks = useMemo(
    () => pickDictationSentences({ lines: (sentences || []).map((s) => s.text), savedSet }),
    [sentences, savedSet]
  );

  return (
    <div
      role="dialog"
      aria-label="받아쓰기 문장 고르기"
      className="scrim"
      style={{ zIndex: 60 }}
      onClick={onClose}
    >
      <div className="card" style={{ maxWidth: 420, width: '100%', padding: '20px 22px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>🎧 받아쓰기</span>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} aria-label="닫기"
            style={{ background: 'none', border: 'none', fontSize: '1.05rem', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 14px' }}>
          담은 단어가 든 문장부터 골랐어요 · 원문은 가려 둡니다
        </p>

        {picks.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.7 }}>
            받아쓰기에 알맞은 길이의 문장을 찾지 못했어요.<br />
            본문에서 문장을 지정한 뒤 🎧을 눌러 보세요.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {picks.map((p, i) => (
              <div key={p.index}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  border: '1px solid var(--border)', borderRadius: 8,
                }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', minWidth: 18 }}>
                  {i + 1}
                </span>
                <span style={{ flex: 1, fontSize: '0.85rem' }}>
                  {p.text.replace(/\s/g, '').length}자
                  {i === 0 && <span style={{ marginLeft: 6, fontSize: '0.72rem', color: 'var(--primary-light)' }}>★ 추천</span>}
                </span>
                <Button size="sm" variant="secondary" onClick={() => onPick(p.text)}>▷ 듣고 시작</Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
