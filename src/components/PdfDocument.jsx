'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

let _pdfjsPromise = null;
async function loadPdfjs() {
  if (_pdfjsPromise) return _pdfjsPromise;
  _pdfjsPromise = (async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    return pdfjs;
  })();
  return _pdfjsPromise;
}

async function analyzeLines(lines, language) {
  if (lines.length === 0) return [];
  let authHeader = {};
  try {
    const { supabase } = await import('../lib/supabase');
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) authHeader = { Authorization: `Bearer ${session.access_token}` };
  } catch {}
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({ lines, language }),
  });
  if (!res.ok) return null;
  return (await res.json()).results;
}

export default function PdfDocument({ fileUrl, pageNumber, scale, onLoadSuccess, language }) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  // 위치 잡힌 토큰: [{ token, x, y, fontSize }]
  const [positionedTokens, setPositionedTokens] = useState([]);
  const analysisCache = useRef({});

  useEffect(() => {
    if (!fileUrl) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        const d = await pdfjs.getDocument(fileUrl).promise;
        if (!cancelled) { setDoc(d); onLoadSuccess?.(d.numPages); }
      } catch (e) { if (!cancelled) setError(e.message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [fileUrl]);

  useEffect(() => { analysisCache.current = {}; setPositionedTokens([]); }, [language]);

  const renderPage = useCallback(async () => {
    if (!doc || !canvasRef.current) return;
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale });

    // Canvas
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = viewport.width * dpr;
    canvas.height = viewport.height * dpr;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    await page.render({ canvasContext: ctx, viewport }).promise;

    if (overlayRef.current) {
      overlayRef.current.style.width = `${viewport.width}px`;
      overlayRef.current.style.height = `${viewport.height}px`;
    }

    // 캐시
    if (analysisCache.current[pageNumber]) {
      setPositionedTokens(analysisCache.current[pageNumber]);
      return;
    }

    // 텍스트 아이템 추출 (위치 포함)
    const textContent = await page.getTextContent();
    const items = textContent.items.filter(it => it.str?.trim());
    if (items.length === 0) { setPositionedTokens([]); return; }

    // 아이템별 위치 계산 — 시작점·끝점 모두 viewport 변환
    const itemMeta = items.map(item => {
      const tx = item.transform;
      const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
      const [vx, vy] = viewport.convertToViewportPoint(tx[4], tx[5]);
      const [vx2] = viewport.convertToViewportPoint(tx[4] + item.width, tx[5]);
      const width = Math.abs(vx2 - vx);
      return { text: item.str, x: vx, y: vy, fontSize, width: width || item.width * scale };
    });

    // 분석
    setAnalyzing(true);
    setPositionedTokens([]);
    const lines = itemMeta.map(m => m.text);
    const results = await analyzeLines(lines, language);
    setAnalyzing(false);

    if (!results) { setPositionedTokens([]); return; }

    // 각 아이템의 분석 토큰에 위치 할당
    const positioned = [];
    results.forEach((result, i) => {
      const meta = itemMeta[i];
      if (!result?.sequence?.length) return;

      // 이 아이템 안에서 토큰별 x 오프셋 계산 (문자 수 비례)
      const totalChars = result.sequence.reduce((sum, id) => sum + (result.dictionary[id]?.text?.length || 0), 0) || 1;
      let charOffset = 0;

      for (const tokenId of result.sequence) {
        const token = result.dictionary[tokenId];
        if (!token || !token.text) continue;
        const ratio = charOffset / totalChars;
        const tokenWidth = (token.text.length / totalChars) * meta.width;
        positioned.push({
          token,
          x: meta.x + ratio * meta.width,
          y: meta.y - meta.fontSize * scale,
          width: tokenWidth,
          height: meta.fontSize * scale * 1.3,
          fontSize: meta.fontSize * scale,
        });
        charOffset += token.text.length;
      }
    });

    analysisCache.current[pageNumber] = positioned;
    setPositionedTokens(positioned);
  }, [doc, pageNumber, scale, language]);

  useEffect(() => { renderPage(); }, [renderPage]);

  if (error) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>{error}</div>;
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>PDF 로딩 중...</div>;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 4, boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }} />

      <div
        ref={overlayRef}
        style={{ position: 'absolute', top: 0, left: 0, overflow: 'hidden', userSelect: 'text', WebkitUserSelect: 'text' }}
        onMouseUp={(e) => {
          const sel = window.getSelection();
          const text = sel?.toString()?.trim();
          if (text && text.length > 1) {
            // 드래그 선택 → 선택 텍스트를 이벤트로 전달
            const evt = new CustomEvent('pdf-text-select', { bubbles: true, detail: text });
            e.currentTarget.dispatchEvent(evt);
          }
        }}
      >
        {analyzing && (
          <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: '0.78rem', zIndex: 10, pointerEvents: 'none' }}>
            ⏳ 분석 중...
          </div>
        )}
        {positionedTokens.map((pt, i) => {
          const { token, x, y, width, height, fontSize } = pt;
          const isPunct = token.pos === '기호' || /^[\s。、！？!?,.:;""''（）()「」『』【】…·\-\/]+$/.test(token.text);
          return (
            <span
              key={i}
              className={isPunct ? 'pdf-hit-punct' : 'pdf-hit-token'}
              style={{
                position: 'absolute',
                left: `${x}px`,
                top: `${y}px`,
                width: `${width}px`,
                height: `${height}px`,
                fontSize: `${fontSize}px`,
                lineHeight: `${height}px`,
              }}
              onClick={(e) => {
                if (isPunct) return;
                // 클릭 (드래그 아님) → 단어 상세
                const sel = window.getSelection();
                if (sel?.toString()?.trim()?.length > 1) return; // 드래그 중이면 무시
                e.stopPropagation();
                const evt = new CustomEvent('pdf-token-click', { bubbles: true, detail: token });
                e.currentTarget.dispatchEvent(evt);
              }}
            >
              {token.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
