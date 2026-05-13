'use client';

import { useEffect, useState } from 'react';
import { formatLessonExplanation } from '../lib/wordDetailFormat';
import JaText from './JaText';

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
  const [choice, setChoice] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const key = lessonId != null ? `lesson_cfu:${lessonId}:${sectionIdx}` : null;

  useEffect(() => {
    if (!key || typeof window === 'undefined') return;
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      if (saved && typeof saved.choice === 'number') {
        setChoice(saved.choice);
        setRevealed(true);
      }
    } catch {}
  }, [key]);

  function pick(i) {
    if (revealed) return;
    setChoice(i);
    setRevealed(true);
    if (key && typeof window !== 'undefined') {
      try { localStorage.setItem(key, JSON.stringify({ choice: i, correct: i === cfu.answer })); } catch {}
    }
  }

  function reset() {
    setChoice(null);
    setRevealed(false);
    if (key && typeof window !== 'undefined') {
      try { localStorage.removeItem(key); } catch {}
    }
  }

  return (
    <div className="lesson-cfu">
      <div className="lesson-cfu__label">💡 이해 확인</div>
      <div className="lesson-cfu__q">{cfu.q}</div>
      <ul className="lesson-cfu__options">
        {(cfu.options || []).map((opt, i) => {
          const isCorrect = i === cfu.answer;
          const isChoice = choice === i;
          const cls = [
            'lesson-cfu__option',
            revealed && isCorrect && 'lesson-cfu__option--correct',
            revealed && isChoice && !isCorrect && 'lesson-cfu__option--wrong',
            !revealed && 'lesson-cfu__option--clickable',
          ].filter(Boolean).join(' ');
          return (
            <li key={i}>
              <button type="button" className={cls} onClick={() => pick(i)} disabled={revealed}>
                <span className="lesson-cfu__option-num">{i + 1}</span>
                <span className="lesson-cfu__option-text">{opt}</span>
                {revealed && isCorrect && <span className="lesson-cfu__option-mark">✓</span>}
                {revealed && isChoice && !isCorrect && <span className="lesson-cfu__option-mark">✗</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {revealed && cfu.explain && <div className="lesson-cfu__explain">{cfu.explain}</div>}
      {revealed && (
        <button type="button" className="lesson-cfu__reset" onClick={reset}>다시 풀기</button>
      )}
    </div>
  );
}
