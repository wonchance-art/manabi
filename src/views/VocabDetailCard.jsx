import { memo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { displayWord } from '../lib/constants';
import { isNewWord } from '../lib/vocabStudy';
import { wordStage } from '../lib/growthStats';

const VocabDetailCard = memo(function VocabDetailCard({ word: v, onClose, speak, ttsSupported }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusInitial = window.setTimeout(() => dialog?.querySelector('[data-dialog-initial-focus]')?.focus(), 0);
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(dialog?.querySelectorAll(selector) || [])].filter(el => !el.disabled);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusInitial);
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus?.();
    };
  }, []);

  const now = new Date();
  const created = new Date(v.created_at);
  const daysSinceCreated = Math.max(1, Math.round((now - created) / 86400000));
  const nextReview = new Date(v.next_review_at);
  const isDue = nextReview <= now;
  const interval = v.interval ?? 0;
  const reps = v.repetitions ?? 0;
  const ease = v.ease_factor ?? 0;
  const retention = Math.round(Math.exp(-1 / Math.max(interval, 0.5)) * 100);

  const isNew = isNewWord(v);
  // 단계 판정은 growthStats가 진다 — 경계값이 「아는 단어」 카운터와 갈리지 않게(부채 ②).
  const stage = wordStage(v);

  return (
    <div className="vocab-detail-overlay" onClick={onClose}>
      <div ref={dialogRef} className="vocab-detail-card" role="dialog" aria-modal="true" aria-labelledby="vocab-detail-title" aria-describedby="vocab-detail-meaning" onClick={e => e.stopPropagation()}>
        <button type="button" className="vocab-detail-card__close" onClick={onClose} aria-label="단어 상세 닫기" data-dialog-initial-focus>✕</button>

        <div className="vocab-detail-card__header">
          {v.furigana && <span className="vocab-detail-card__furigana">{v.furigana}</span>}
          <h2 id="vocab-detail-title" className="vocab-detail-card__word">
            {displayWord(v.word_text, v.pos)}
            {ttsSupported && (
              <button type="button" className="vocab-detail-card__tts" onClick={() => speak(v.word_text, v.language || 'Japanese')} aria-label={`${v.word_text} 발음 듣기`}>▷</button>
            )}
          </h2>
          <p id="vocab-detail-meaning" className="vocab-detail-card__meaning">{v.meaning}</p>
          <div className="vocab-detail-card__badges">
            <span className="badge">{v.pos}</span>
            <span className={`badge badge--stage-${stage.key}`}>
              {stage.label}
            </span>
          </div>
        </div>

        <div className="vocab-detail-card__stats">
          <div className="vocab-detail-stat">
            <span className="vocab-detail-stat__value">{isNew ? '아직' : `${reps}회`}</span>
            <span className="vocab-detail-stat__label">다시 한 횟수</span>
          </div>
          <div className="vocab-detail-stat">
            <span className="vocab-detail-stat__value">{interval < 1 ? '<1일' : `${Math.round(interval)}일`}</span>
            <span className="vocab-detail-stat__label">복습 간격</span>
          </div>
          <div className="vocab-detail-stat">
            <span className="vocab-detail-stat__value">{retention}%</span>
            <span className="vocab-detail-stat__label">기억 강도</span>
          </div>
          <div className="vocab-detail-stat">
            <span className="vocab-detail-stat__value">{ease.toFixed(1)}</span>
            <span className="vocab-detail-stat__label">난이도</span>
          </div>
        </div>

        {/* 학습 타임라인 */}
        <div className="vocab-detail-card__timeline">
          <h3 className="vocab-detail-card__section-title">학습 여정</h3>
          <div className="vocab-detail-timeline">
            <div className="vocab-detail-timeline__item">
              <span className="vocab-detail-timeline__dot" style={{ background: 'var(--primary)' }} aria-hidden="true" />
              <span className="vocab-detail-timeline__date">{created.toLocaleDateString('ko-KR')}</span>
              <span className="vocab-detail-timeline__event">단어 수집</span>
            </div>
            {v.last_reviewed_at && (
              <div className="vocab-detail-timeline__item">
                <span className="vocab-detail-timeline__dot" style={{ background: 'var(--accent)' }} aria-hidden="true" />
                <span className="vocab-detail-timeline__date">{new Date(v.last_reviewed_at).toLocaleDateString('ko-KR')}</span>
                <span className="vocab-detail-timeline__event">마지막 복습{reps > 0 ? ` · 다시 ${reps}회` : ''}</span>
              </div>
            )}
            <div className="vocab-detail-timeline__item">
              <span className="vocab-detail-timeline__dot" style={{ background: isDue ? 'var(--danger)' : 'var(--warning)' }} aria-hidden="true" />
              <span className="vocab-detail-timeline__date">{nextReview.toLocaleDateString('ko-KR')}</span>
              <span className="vocab-detail-timeline__event">{isDue ? '복습 필요!' : '다음 복습 예정'}</span>
            </div>
          </div>
        </div>

        {/* 성장 시각화 */}
        <div className="vocab-detail-card__growth">
          <h3 className="vocab-detail-card__section-title">성장 지표</h3>
          <div className="vocab-detail-growth-bar">
            <span className="vocab-detail-growth-bar__label">기억 강도</span>
            <div className="vocab-detail-growth-bar__track" role="progressbar" aria-label="기억 강도" aria-valuemin="0" aria-valuemax="100" aria-valuenow={retention}>
              <div className="vocab-detail-growth-bar__fill" style={{ width: `${retention}%`, background: retention > 70 ? 'var(--accent)' : retention > 40 ? 'var(--warning)' : 'var(--danger)' }} />
            </div>
            <span className="vocab-detail-growth-bar__pct">{retention}%</span>
          </div>
          <div className="vocab-detail-growth-bar">
            <span className="vocab-detail-growth-bar__label">학습 기간</span>
            <div className="vocab-detail-growth-bar__track" role="progressbar" aria-label="학습 기간" aria-valuemin="0" aria-valuemax="90" aria-valuenow={Math.min(90, daysSinceCreated)} aria-valuetext={`${daysSinceCreated}일 학습`}>
              <div className="vocab-detail-growth-bar__fill" style={{ width: `${Math.min(100, (daysSinceCreated / 90) * 100)}%`, background: 'var(--primary)' }} />
            </div>
            <span className="vocab-detail-growth-bar__pct">{daysSinceCreated}일</span>
          </div>
        </div>

        {/* 출처 자료 링크 */}
        {v.source_material_id && (
          <div className="vocab-detail-card__source">
            <h3 className="vocab-detail-card__section-title">출처 자료</h3>
            {v.source_sentence && (
              <p style={{
                fontSize: '0.85rem', color: 'var(--text-secondary)',
                padding: '8px 12px', background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)', marginBottom: 8, lineHeight: 1.6,
              }}>
                {v.source_sentence.split(v.word_text).map((part, i, arr) =>
                  i < arr.length - 1
                    ? <span key={i}>{part}<mark style={{ background: 'var(--primary-glow)', color: 'var(--primary-light)', padding: '0 3px', borderRadius: 3 }}>{v.word_text}</mark></span>
                    : <span key={i}>{part}</span>
                )}
              </p>
            )}
            <Link
              href={`/viewer/${v.source_material_id}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: '0.85rem', color: 'var(--primary-light)',
                textDecoration: 'none', padding: '6px 12px',
                background: 'var(--bg-secondary)', borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border)',
              }}
            >
              원본 자료로 이동 →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
});

export default VocabDetailCard;
