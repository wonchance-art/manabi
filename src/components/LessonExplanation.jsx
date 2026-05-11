'use client';

import { formatLessonExplanation } from '../lib/wordDetailFormat';

/**
 * 강의 본문 렌더러
 *  - sections 배열이 있으면 정형 렌더 (헤딩 + 예문 + 콜아웃 + 미션)
 *  - 없으면 fallback markdown(formatLessonExplanation)
 */
export default function LessonExplanation({ intro, sections, fallbackText, onJaClick }) {
  const useSections = Array.isArray(sections) && sections.length > 0;

  if (useSections) {
    return (
      <div className="lesson-sections">
        {intro && <p className="lesson-sections__intro">{intro}</p>}
        {sections.map((s, i) => <SectionBlock key={i} section={s} onJaClick={onJaClick} />)}
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

function SectionBlock({ section, onJaClick }) {
  const kind = section.kind || 'pattern';
  const tone = section.tone ? ` lesson-block--${section.tone}` : '';
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
              <span className="lesson-example__ja">{ex.ja}</span>
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
    </div>
  );
}
