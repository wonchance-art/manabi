'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 강의 섹션 진척 dot 인디케이터.
 *  - sectionRefs: { [key]: RefObject<HTMLElement> }
 *  - IntersectionObserver로 viewport 안 섹션 추적, intersectionRatio 가장 큰 것 active
 *  - 한 번 활성된 섹션은 visited (학습 진척감)
 *  - 클릭 시 부드러운 스크롤
 */
export default function LessonStepper({ steps, sectionRefs }) {
  const [active, setActive] = useState(steps[0]?.key || null);
  const [visited, setVisited] = useState(() => new Set([steps[0]?.key].filter(Boolean)));
  const visitedRef = useRef(visited);
  visitedRef.current = visited;

  useEffect(() => {
    const elements = steps
      .map(s => ({ key: s.key, el: sectionRefs?.[s.key]?.current }))
      .filter(x => x.el);
    if (elements.length === 0) return;

    const ratios = new Map();
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          ratios.set(e.target.dataset.stepperKey, e.intersectionRatio);
        });
        let bestKey = null;
        let bestRatio = 0;
        for (const [k, r] of ratios) {
          if (r > bestRatio) { bestRatio = r; bestKey = k; }
        }
        if (bestKey && bestRatio > 0) {
          setActive(prev => {
            if (prev === bestKey) return prev;
            if (!visitedRef.current.has(bestKey)) {
              setVisited(v => new Set([...v, bestKey]));
            }
            return bestKey;
          });
        }
      },
      { threshold: [0, 0.2, 0.5, 0.8, 1] },
    );

    elements.forEach(({ key, el }) => {
      el.dataset.stepperKey = key;
      obs.observe(el);
    });
    return () => obs.disconnect();
  }, [steps, sectionRefs]);

  function scrollTo(key) {
    const el = sectionRefs?.[key]?.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 70;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  return (
    <nav className="lesson-stepper" aria-label="강의 진척">
      {steps.map((s) => {
        const isActive = active === s.key;
        const isVisited = visited.has(s.key);
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => scrollTo(s.key)}
            className={`lesson-stepper__step ${isActive ? 'is-active' : ''} ${isVisited ? 'is-visited' : ''}`}
            aria-current={isActive ? 'true' : undefined}
            aria-label={s.label}
          >
            <span className="lesson-stepper__icon" aria-hidden="true">{s.icon}</span>
            <span className="lesson-stepper__label">{s.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
