'use client';

import { parseJaSegments } from '../lib/jaSegments';

/**
 * 일본어 본문을 vocab 단어 + 조사 「は」 시각 강조와 함께 렌더.
 *  - vocab 단어: 점선 밑줄 + 호버 시 의미 툴팁
 *  - 조사 「は」: ruby로 위에 「わ」 작게
 */
export default function JaText({ ja, vocab }) {
  const segs = parseJaSegments(ja, vocab);
  if (segs.length === 0) return <>{ja}</>;
  return (
    <>
      {segs.map((s, i) => {
        if (s.type === 'vocab') {
          return (
            <span key={i} className="ja-vocab" title={s.ko || undefined}>{s.text}</span>
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
    </>
  );
}
