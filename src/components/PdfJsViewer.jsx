'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Spinner from './Spinner';
import { reconstructPdfPageText } from '../lib/pdfText';

export const PDFJS_PAGE_WINDOW_RADIUS = 1;
export const PDFJS_MAX_RENDERED_PAGES = PDFJS_PAGE_WINDOW_RADIUS * 2 + 1;

let pdfjsPromise = null;

function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs').then((pdfjs) => {
      // Next의 webpack worker graph에 pdf.worker를 넣지 않고 predev/prebuild에서
      // public/으로 복사해 동일 출처 정적 파일로 고정한다(scripts/copy-pdf-worker.mjs).
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

export function getPdfJsPageWindow(pageNumber, pageCount) {
  if (!Number.isInteger(pageCount) || pageCount < 1) return [];
  const current = Math.min(Math.max(Number(pageNumber) || 1, 1), pageCount);
  const start = Math.max(1, current - PDFJS_PAGE_WINDOW_RADIUS);
  const end = Math.min(pageCount, current + PDFJS_PAGE_WINDOW_RADIUS);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function PdfJsPage({ doc, pdfjs, pageNumber, current, onPageText }) {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const [hostWidth, setHostWidth] = useState(0);
  const [pageSize, setPageSize] = useState(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const updateWidth = () => setHostWidth(Math.max(0, host.clientWidth));
    updateWidth();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(updateWidth);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const textLayerContainer = textLayerRef.current;
    if (!canvas || !textLayerContainer || hostWidth <= 0) return undefined;

    let active = true;
    let loadedPage = null;
    let renderTask = null;
    let textLayer = null;

    (async () => {
      const page = await doc.getPage(pageNumber);
      loadedPage = page;
      if (!active) return;

      const baseViewport = page.getViewport({ scale: 1 });
      const availableWidth = Math.max(240, hostWidth - 32);
      const scale = Math.min(1.5, Math.max(0.5, availableWidth / baseViewport.width));
      const viewport = page.getViewport({ scale });
      const outputScale = Math.min(window.devicePixelRatio || 1, 2);
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('PDF_CANVAS_CONTEXT_UNAVAILABLE');

      canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
      canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      setPageSize({
        width: Math.floor(viewport.width),
        height: Math.floor(viewport.height),
        scale: viewport.scale,
      });

      const textContent = await page.getTextContent({ includeMarkedContent: true });
      if (!active) return;
      textLayerContainer.replaceChildren();
      textLayer = new pdfjs.TextLayer({
        textContentSource: textContent,
        container: textLayerContainer,
        viewport,
      });
      renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
      });

      await Promise.all([renderTask.promise, textLayer.render()]);
      if (active) onPageText?.(pageNumber, reconstructPdfPageText(textContent));
    })().catch((error) => {
      if (active && error?.name !== 'RenderingCancelledException' && error?.name !== 'AbortException') {
        console.error('[PdfJsViewer] page render failed', { pageNumber, error });
      }
    });

    return () => {
      active = false;
      renderTask?.cancel();
      textLayer?.cancel();
      loadedPage?.cleanup();
      textLayerContainer.replaceChildren();
      canvas.width = 1;
      canvas.height = 1;
    };
  }, [doc, hostWidth, onPageText, pageNumber, pdfjs]);

  return (
    <section
      ref={hostRef}
      className={`pdfjs-page${current ? ' pdfjs-page--current' : ''}`}
      data-page-number={pageNumber}
      data-current={current ? 'true' : 'false'}
    >
      <div
        className="pdfjs-page__surface"
        style={pageSize ? {
          width: pageSize.width,
          height: pageSize.height,
          '--scale-factor': pageSize.scale,
        } : undefined}
      >
        <canvas ref={canvasRef} className="pdfjs-page__canvas" />
        <div ref={textLayerRef} className="textLayer pdfjs-page__text-layer" />
      </div>
    </section>
  );
}

export default function PdfJsViewer({ pdfUrl, onPageText, onPageChange }) {
  const pagesRef = useRef(null);
  const [pdfjs, setPdfjs] = useState(null);
  const [doc, setDoc] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    let loadingTask = null;
    let loadedDoc = null;
    setDoc(null);
    setError(null);
    setPageNumber(1);

    (async () => {
      const loadedPdfjs = await loadPdfjs();
      if (!active) return;
      setPdfjs(loadedPdfjs);
      loadingTask = loadedPdfjs.getDocument({ url: pdfUrl });
      loadedDoc = await loadingTask.promise;
      if (active) setDoc(loadedDoc);
    })().catch((loadError) => {
      if (active) setError(loadError);
    });

    return () => {
      active = false;
      if (loadedDoc) loadedDoc.destroy();
      else loadingTask?.destroy();
    };
  }, [pdfUrl]);

  const pageWindow = useMemo(
    () => getPdfJsPageWindow(pageNumber, doc?.numPages || 0),
    [doc?.numPages, pageNumber],
  );

  // 지금 보고 있는 쪽을 밖으로 알린다(v2-H R1) — '이 부분부터 읽기'가 이 값으로 시작 쪽을
  // 잡는다. 기본 경로(<embed>)는 쪽을 모르므로 그쪽은 last_page_read로 떨어진다.
  useEffect(() => {
    if (doc) onPageChange?.(pageNumber);
  }, [doc, pageNumber, onPageChange]);

  useEffect(() => {
    const pages = pagesRef.current;
    const currentPage = pages?.querySelector(`[data-page-number="${pageNumber}"]`);
    if (!pages || !currentPage) return undefined;
    const frame = requestAnimationFrame(() => {
      pages.scrollTo({ top: currentPage.offsetTop, behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [pageNumber, pageWindow]);

  if (error) return <div className="pdf-side__empty">PDF 파일 주소를 불러올 수 없어요.</div>;
  if (!doc || !pdfjs) return <Spinner message="로딩 중..." />;

  return (
    <div className="pdfjs-viewer">
      <div className="pdf-nav">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          aria-label="←"
          onClick={() => setPageNumber((page) => Math.max(1, page - 1))}
          disabled={pageNumber <= 1}
        >
          ←
        </button>
        <span aria-live="polite">{pageNumber} / {doc.numPages}</span>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          aria-label="→"
          onClick={() => setPageNumber((page) => Math.min(doc.numPages, page + 1))}
          disabled={pageNumber >= doc.numPages}
        >
          →
        </button>
      </div>
      <div ref={pagesRef} className="pdfjs-pages">
        {pageWindow.map((visiblePage) => (
          <PdfJsPage
            key={visiblePage}
            doc={doc}
            pdfjs={pdfjs}
            pageNumber={visiblePage}
            current={visiblePage === pageNumber}
            onPageText={onPageText}
          />
        ))}
      </div>
    </div>
  );
}
