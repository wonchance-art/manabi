'use client';
import { useState, useEffect } from 'react';

// strokesvg(OFL) 벤더링 SVG를 인라인해 획순(stroke-order)을 CSS로 애니메이션.
// 요음(2글자)은 글자별 SVG로 분해해 나란히 그린다.
export default function KanaStroke({ kana, kind }) {
  const chars = [...kana];
  return (
    <div className="kana-stroke-row">
      {chars.map((ch, i) => <StrokeGlyph key={i} ch={ch} kind={kind} />)}
    </div>
  );
}

function StrokeGlyph({ ch, kind }) {
  const [svg, setSvg] = useState(null);
  useEffect(() => {
    let alive = true;
    setSvg(null);
    fetch(`/kana-strokes/${kind}/${encodeURIComponent(ch)}.svg`)
      .then(r => (r.ok ? r.text() : null))
      .then(t => { if (alive) setSvg(t); })
      .catch(() => { if (alive) setSvg(null); });
    return () => { alive = false; };
  }, [ch, kind]);

  if (!svg) return <div className="kana-stroke-glyph kana-stroke-glyph--empty" aria-hidden="true" />;
  return <div className="kana-stroke-glyph" lang="ja" dangerouslySetInnerHTML={{ __html: svg }} />;
}
