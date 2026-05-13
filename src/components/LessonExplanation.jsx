'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatLessonExplanation } from '../lib/wordDetailFormat';
import JaText from './JaText';

function shuffleIdx(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const VALID_KINDS = new Set(['pattern', 'callout', 'mission']);
const VALID_TONES = new Set(['pronunciation', 'warning', 'tip']);

/**
 * 강의 본문 렌더러
 *  - sections 배열이 있으면 정형 렌더
 *  - 없으면 fallback markdown(formatLessonExplanation)
 */
export default function LessonExplanation({ intro, sections, fallbackText, onJaClick, lessonId, vocab }) {
  const useSections = Array.isArray(sections) && sections.length > 0;

  if (useSections) {
    return (
      <div className="lesson-sections">
        {intro && <p className="lesson-sections__intro">{intro}</p>}
        {sections.map((s, i) => (
          <SectionBlock key={i} section={s} sectionIdx={i} lessonId={lessonId} onJaClick={onJaClick} vocab={vocab} />
        ))}
      </div>
    );
  }

  return (
    <div
      className="lesson-explanation"
      dangerouslySetInnerHTML={{ __html: formatLessonExplanation(fallbackText || '') }}
      onClick={(e) => {
        const el = e.target.closest('[data-ja]');
        if (el) onJaClick?.(el.dataset.ja);
      }}
    />
  );
}

function SectionBlock({ section, sectionIdx, lessonId, onJaClick, vocab }) {
  const kind = section.kind || 'pattern';
  const tone = section.tone ? ` lesson-block--${section.tone}` : '';

  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
    if (!VALID_KINDS.has(kind)) {
      // eslint-disable-next-line no-console
      console.warn(`[LessonExplanation] unknown section.kind: "${kind}". Allowed: ${[...VALID_KINDS].join(', ')}`);
    }
    if (section.tone && !VALID_TONES.has(section.tone)) {
      // eslint-disable-next-line no-console
      console.warn(`[LessonExplanation] unknown section.tone: "${section.tone}". Allowed: ${[...VALID_TONES].join(', ')}`);
    }
    if (!section.heading && !section.body && !section.lead && !section.examples?.length && !section.blanks?.length && !section.cfu) {
      // eslint-disable-next-line no-console
      console.warn('[LessonExplanation] section is empty');
    }
  }

  return (
    <div className={`lesson-block lesson-block--${kind}${tone}`}>
      {section.heading && <h3 className="lesson-block__heading">{section.heading}</h3>}
      {section.lead && <p className="lesson-block__lead">{section.lead}</p>}
      {section.body && <p className="lesson-block__body">{section.body}</p>}
      {Array.isArray(section.examples) && section.examples.length > 0 && (
        <ul className="lesson-examples">
          {section.examples.map((ex, i) => (
            <li
              key={i}
              className="lesson-example"
              onClick={() => onJaClick?.(ex.ja)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onJaClick?.(ex.ja))}
            >
              <span className="lesson-example__ja"><JaText ja={ex.ja} vocab={vocab} /></span>
              {ex.ko && <span className="lesson-example__ko">{ex.ko}</span>}
            </li>
          ))}
        </ul>
      )}
      {Array.isArray(section.blanks) && section.blanks.length > 0 && (
        <ol className="lesson-blanks">
          {section.blanks.map((b, i) => (
            <li key={i} className="lesson-blank">{b}</li>
          ))}
        </ol>
      )}
      {section.cfu && (
        <SectionCFU cfu={section.cfu} sectionIdx={sectionIdx} lessonId={lessonId} />
      )}
    </div>
  );
}

function SectionCFU({ cfu, sectionIdx, lessonId }) {
  const [round, setRound] = useState(0);
  const order = useMemo(() => shuffleIdx((cfu.options || []).length), [cfu, round]);
  const shuffledAnswerIdx = order.indexOf(cfu.answer);

  const [choice, setChoice] = useState(null); // displayed idx (셔플 후)
  const [revealed, setRevealed] = useState(false);
  const [storedCorrect, setStoredCorrect] = useState(null);
  const key = lessonId != null ? `lesson_cfu:${lessonId}:${sectionIdx}` : null;

  useEffect(() => {
    if (!key || typeof window === 'undefined') return;
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      if (saved && typeof saved.correct === 'boolean') {
        setStoredCorrect(saved.correct);
        setRevealed(true);
      }
    } catch {}
  }, [key]);

  function pick(displayedIdx) {
    if (revealed) return;
    setChoice(displayedIdx);
    setRevealed(true);
    const isCorrect = displayedIdx === shuffledAnswerIdx;
    setStoredCorrect(isCorrect);
    if (key && typeof window !== 'undefined') {
      try { localStorage.setItem(key, JSON.stringify({ correct: isCorrect })); } catch {}
    }
  }

  function reset() {
    setChoice(null);
    setRevealed(false);
    setStoredCorrect(null);
    setRound(r => r + 1);
    if (key && typeof window !== 'undefined') {
      try { localStorage.removeItem(key); } catch {}
    }
  }

  return (
    <div className="lesson-cfu">
      <div className="lesson-cfu__label">💡 이해 확인</div>
      <div className="lesson-cfu__q">{cfu.q}</div>
      <ul className="lesson-cfu__options">
        {order.map((origIdx, displayIdx) => {
          const isCorrectOpt = origIdx === cfu.answer;
          const isChoice = choice === displayIdx;
          const cls = [
            'lesson-cfu__option',
            revealed && isCorrectOpt && 'lesson-cfu__option--correct',
            revealed && isChoice && !isCorrectOpt && 'lesson-cfu__option--wrong',
            !revealed && 'lesson-cfu__option--clickable',
          ].filter(Boolean).join(' ');
          return (
            <li key={displayIdx}>
              <button type="button" className={cls} onClick={() => pick(displayIdx)} disabled={revealed}>
                <span className="lesson-cfu__option-num">{displayIdx + 1}</span>
                <span className="lesson-cfu__option-text">{cfu.options[origIdx]}</span>
                {revealed && isCorrectOpt && <span className="lesson-cfu__option-mark">✓</span>}
                {revealed && isChoice && !isCorrectOpt && <span className="lesson-cfu__option-mark">✗</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {revealed && storedCorrect === false && (
        <div className="lesson-cfu__verdict lesson-cfu__verdict--wrong">⚠️ 정답을 다시 살펴보세요</div>
      )}
      {revealed && cfu.explain && <div className="lesson-cfu__explain">{cfu.explain}</div>}
      {revealed && (
        <button type="button" className="lesson-cfu__reset" onClick={reset}>↺ 다시 풀기</button>
      )}
    </div>
  );
}
