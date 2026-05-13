'use client';

import { useEffect, useRef, useState } from 'react';
import { parseJaSegments } from '../lib/jaSegments';

/**
 * 일본어 본문 렌더러
 *  - vocab 단어: 점선 밑줄. 클릭(데스크탑·모바일 공통) 시 의미 popover.
 *  - 조사 「は」: ruby로 위에 「わ」 작게.
 *  - vocab 클릭은 stopPropagation — 부모(예문 카드)의 TTS는 빈 공간 클릭 시만 동작.
 */
export default function JaText({ ja, vocab }) {
  const segs = parseJaSegments(ja, vocab);
  const [activeIdx, setActiveIdx] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (activeIdx === null) return;
    function onDoc(e) {
      if (!containerRef.current?.contains(e.target)) setActiveIdx(null);
    }
    const t = setTimeout(() => document.addEventListener('click', onDoc), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', onDoc);
    };
  }, [activeIdx]);

  if (segs.length === 0) return <>{ja}</>;

  return (
    <span ref={containerRef} className="ja-text">
      {segs.map((s, i) => {
        if (s.type === 'vocab') {
          const isActive = activeIdx === i;
          return (
            <span key={i} className="ja-vocab-wrap">
              <button
                type="button"
                className={`ja-vocab ${isActive ? 'ja-vocab--active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIdx(prev => (prev === i ? null : i));
                }}
                aria-expanded={isActive}
                aria-label={s.ko ? `${s.text}: ${s.ko}` : s.text}
              >
                {s.text}
              </button>
              {isActive && s.ko && (
                <span className="ja-vocab__popover" role="tooltip">{s.ko}</span>
              )}
            </span>
          );
        }
        if (s.type === 'particle') {
          return (
            <ruby key={i} className="ja-particle">
              {s.text}
              <rt>{s.reading}</rt>
            </ruby>
          );
        }
        return <span key={i}>{s.text}</span>;
      })}
    </span>
  );
}
