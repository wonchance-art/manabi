'use client';
import { useState, useEffect, useRef } from 'react';

// strokesvg(OFL) 벤더링 SVG를 인라인해 획순을 CSS로 애니메이션.
// - 요음(2글자)은 기준 글자(い단)를 먼저 다 그린 뒤 작은 ゃ/ゅ/ょ 순서로.
// - 획은 화면에 스크롤로 들어왔을 때 그려진다(IntersectionObserver).
export default function KanaStroke({ kana, kind }) {
  const [glyphs, setGlyphs] = useState([]); // [{ svg, count }]
  const [drawing, setDrawing] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setGlyphs([]);
    Promise.all([...kana].map(ch =>
      fetch(`/kana-strokes/${kind}/${encodeURIComponent(ch)}.svg`)
        .then(r => (r.ok ? r.text() : null))
        .catch(() => null)
    )).then(svgs => {
      if (!alive) return;
      setGlyphs(svgs.map(svg => ({ svg, count: svg ? (svg.match(/--i:/g) || []).length : 0 })));
    });
    return () => { alive = false; };
  }, [kana, kind]);

  // 해당 영역이 보일 때 그리기 (스크롤 진입마다 다시)
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setDrawing(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [glyphs.length]);

  // 글자별 시작 지연(획 단위) — 앞 글자 획수만큼 + 글자 사이 한 박 여유
  let acc = 0;
  const bases = glyphs.map((g, i) => { const b = acc + i; acc += g.count; return b; });

  return (
    <div ref={rootRef} className={`kana-stroke-row${drawing ? ' is-drawing' : ''}`}>
      {glyphs.map((g, i) => (
        g.svg
          ? <div key={i} className="kana-stroke-glyph" style={{ '--base': bases[i] }} lang="ja" dangerouslySetInnerHTML={{ __html: g.svg }} />
          : <div key={i} className="kana-stroke-glyph kana-stroke-glyph--empty" aria-hidden="true" />
      ))}
    </div>
  );
}
