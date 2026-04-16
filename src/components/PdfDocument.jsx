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

  const renderPage = useCallback(async () => {
    if (!doc || !canvasRef.current || !textLayerRef.current) return;
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale });

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = viewport.width * dpr;
    canvas.height = viewport.height * dpr;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    await page.render({ canvasContext: ctx, viewport }).promise;

    // TextLayer — pdfjs 원본 그대로, 드래그 선택용
    const textDiv = textLayerRef.current;
    textDiv.innerHTML = '';
    textDiv.style.width = `${viewport.width}px`;
    textDiv.style.height = `${viewport.height}px`;
    textDiv.style.setProperty('--scale-factor', String(scale));

    const textContent = await page.getTextContent();
    const pdfjs = await loadPdfjs();
    try {
      await new pdfjs.TextLayer({ textContentSource: textContent, viewport, container: textDiv }).render();
    } catch {}
  }, [doc, pageNumber, scale]);

  useEffect(() => { renderPage(); }, [renderPage]);

  if (error) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>{error}</div>;
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>PDF 로딩 중...</div>;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 4, boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }} />
      <div
        ref={textLayerRef}
        className="textLayer"
        onMouseUp={() => {
          const sel = window.getSelection();
          const text = sel?.toString()?.trim();
          if (text && text.length >= 1) {
            window.dispatchEvent(new CustomEvent('pdf-text-select', { detail: text }));
          }
        }}
      />
    </div>
  );
}
