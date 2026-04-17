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

/**
 * PDF 페이지를 canvas로 렌더 + 해당 페이지 텍스트를 onPageText로 전달.
 * TextLayer 없음 — 텍스트는 별도 패널에서 토큰으로 표시.
 */
export default function PdfDocument({ fileUrl, pageNumber, scale, onLoadSuccess, onPageText }) {
  const canvasRef = useRef(null);
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const textCache = useRef({});

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
    if (!doc || !canvasRef.current) return;
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

    // 텍스트 추출 → 부모에 전달 (캐시)
    if (textCache.current[pageNumber]) {
      onPageText?.(textCache.current[pageNumber], pageNumber);
    } else {
      const textContent = await page.getTextContent();
      const text = textContent.items.map(it => it.str).join('\n');
      textCache.current[pageNumber] = text;
      onPageText?.(text, pageNumber);
    }
  }, [doc, pageNumber, scale]);

  useEffect(() => { renderPage(); }, [renderPage]);

  if (error) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>{error}</div>;
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>PDF 로딩 중...</div>;

  return <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 4, boxShadow: '0 2px 12px rgba(0,0,0,0.15)', maxWidth: '100%' }} />;
}
