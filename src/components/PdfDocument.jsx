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

export default function PdfDocument({ fileUrl, pageNumber, scale, onLoadSuccess }) {
  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // PDF 문서 로드
  useEffect(() => {
    if (!fileUrl) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        const loadedDoc = await pdfjs.getDocument(fileUrl).promise;
        if (cancelled) return;
        setDoc(loadedDoc);
        onLoadSuccess?.(loadedDoc.numPages);
      } catch (e) {
        if (!cancelled) setError(e.message || 'PDF 로드 실패');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fileUrl]);

  // 페이지 렌더
  const renderPage = useCallback(async () => {
    if (!doc || !canvasRef.current) return;
    try {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });

      // Canvas 렌더
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      await page.render({ canvasContext: ctx, viewport }).promise;

      // 텍스트 레이어 (선택 가능)
      const textContent = await page.getTextContent();
      const textDiv = textLayerRef.current;
      if (textDiv) {
        textDiv.innerHTML = '';
        textDiv.style.width = `${viewport.width}px`;
        textDiv.style.height = `${viewport.height}px`;

        const pdfjs = await loadPdfjs();
        // pdfjs-dist v4 TextLayer API
        if (pdfjs.TextLayer) {
          const textLayer = new pdfjs.TextLayer({
            textContentSource: textContent,
            container: textDiv,
            viewport,
          });
          await textLayer.render();
        } else {
          // fallback: 수동 span 배치
          for (const item of textContent.items) {
            if (!item.str) continue;
            const tx = pdfjs.Util.transform(viewport.transform, item.transform);
            const span = document.createElement('span');
            span.textContent = item.str;
            span.style.position = 'absolute';
            span.style.left = `${tx[4]}px`;
            span.style.top = `${tx[5] - item.height}px`;
            span.style.fontSize = `${Math.abs(tx[3])}px`;
            span.style.fontFamily = item.fontName || 'sans-serif';
            textDiv.appendChild(span);
          }
        }
      }
    } catch (e) {
      console.error('[PdfDocument] render page failed:', e);
    }
  }, [doc, pageNumber, scale]);

  useEffect(() => { renderPage(); }, [renderPage]);

  if (error) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>PDF를 열 수 없어요: {error}</div>;
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>PDF 로딩 중...</div>;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 4, boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }} />
      <div
        ref={textLayerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          overflow: 'hidden',
          opacity: 0.3,
          lineHeight: 1,
        }}
        className="pdf-text-layer"
      />
    </div>
  );
}
