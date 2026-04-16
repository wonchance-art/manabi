'use client';

// pdfjs-dist는 클라이언트에서만 사용
// Next.js + pdfjs-dist v4 호환: legacy ESM 빌드 사용

let _pdfjsPromise = null;

async function loadPdfjs() {
  if (_pdfjsPromise) return _pdfjsPromise;
  _pdfjsPromise = (async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    // worker 파일을 public/에서 서빙 (CDN 의존 제거)
    // build 시 scripts/copy-pdf-worker로 복사됨
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    return pdfjs;
  })();
  return _pdfjsPromise;
}

/** PDF 메타데이터 (페이지 수 + 스캔본 감지) */
export async function getPdfMetadata(fileOrBuffer) {
  const pdfjs = await loadPdfjs();
  const data = fileOrBuffer instanceof File
    ? await fileOrBuffer.arrayBuffer()
    : fileOrBuffer;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const pageCount = doc.numPages;

  // 최대 3페이지 샘플링하여 스캔본 감지 정확도 향상
  // (표지/백지가 첫 페이지인 경우 오판 방지)
  const samplePagesToCheck = Math.min(3, pageCount);
  let totalChars = 0;
  let sampleText = '';
  for (let i = 1; i <= samplePagesToCheck; i++) {
    try {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(it => it.str || '').join('');
      totalChars += pageText.replace(/\s/g, '').length;
      if (i === 1) sampleText = pageText;
    } catch {/* ignore */}
  }

  // 페이지당 평균 50자 미만이면 스캔본으로 판단
  const avgCharsPerPage = totalChars / samplePagesToCheck;
  const isLikelyScanned = avgCharsPerPage < 50;

  return {
    doc,
    pageCount,
    firstPageText: sampleText,
    isLikelyScanned,
    avgCharsPerPage: Math.round(avgCharsPerPage),
  };
}

/**
 * 지정 페이지 범위의 텍스트 추출 (이미 load된 doc 사용 가능)
 * pageStart/pageEnd: 1-based inclusive
 */
export async function extractPageRange(fileOrBufferOrDoc, pageStart, pageEnd) {
  const pdfjs = await loadPdfjs();
  let doc = fileOrBufferOrDoc;
  if (!doc?.getPage) {
    const data = doc instanceof File ? await doc.arrayBuffer() : doc;
    doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  }

  const totalPages = doc.numPages;
  const start = Math.max(1, Math.min(pageStart, totalPages));
  const end = Math.max(start, Math.min(pageEnd, totalPages));

  const pages = [];
  for (let i = start; i <= end; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    // Y좌표 기준으로 줄 분리 (같은 Y면 X순서대로 공백 없이 연결, 다른 Y면 줄바꿈)
    const lines = [];
    let currentY = null;
    let buffer = '';
    const items = textContent.items;

    // X는 left-to-right, Y는 top-to-bottom이 일반적
    // pdfjs는 transform[5]가 y좌표 (PDF는 bottom-to-top이라 실제로 큰 값이 위)
    for (const it of items) {
      const y = it.transform?.[5] ?? 0;
      if (currentY === null) {
        currentY = y;
        buffer = it.str || '';
      } else if (Math.abs(y - currentY) < 2) {
        buffer += it.str || '';
      } else {
        if (buffer.trim()) lines.push(buffer);
        buffer = it.str || '';
        currentY = y;
      }
    }
    if (buffer.trim()) lines.push(buffer);

    pages.push({ pageNumber: i, lines });
  }

  return postProcessPages(pages);
}

/**
 * 페이지 배열 후처리
 * - 페이지 헤더/풋터 반복 패턴 제거
 * - 페이지 경계 문장 연결 (마지막 줄 끝 구두점 없으면)
 * - 하이픈 끝 단어 결합 (영어)
 */
function postProcessPages(pages) {
  if (pages.length === 0) return '';

  // 반복되는 헤더/풋터 감지 (3페이지 이상 같은 줄이 나오면 제거)
  const headerCounts = {};
  const footerCounts = {};
  pages.forEach(p => {
    if (p.lines.length > 0) {
      const first = p.lines[0].trim();
      if (first.length < 60) headerCounts[first] = (headerCounts[first] || 0) + 1;
      const last = p.lines[p.lines.length - 1].trim();
      if (last.length < 60) footerCounts[last] = (footerCounts[last] || 0) + 1;
    }
  });
  const minRepeat = Math.max(2, Math.floor(pages.length / 2));
  const bannedHeaders = new Set(Object.keys(headerCounts).filter(k => headerCounts[k] >= minRepeat));
  const bannedFooters = new Set(Object.keys(footerCounts).filter(k => footerCounts[k] >= minRepeat));

  // 페이지 번호 패턴 (숫자만 있는 짧은 줄) 제거
  const isPageNumber = (s) => /^\s*[\d\-]{1,6}\s*$/.test(s);

  const cleanedPages = pages.map(p => {
    let lines = p.lines.map(l => l.trim()).filter(Boolean);
    if (lines.length > 0 && bannedHeaders.has(lines[0])) lines = lines.slice(1);
    if (lines.length > 0 && bannedFooters.has(lines[lines.length - 1])) lines = lines.slice(0, -1);
    lines = lines.filter(l => !isPageNumber(l));
    return lines;
  });

  // 페이지 경계 문장 연결 시도
  const allLines = [];
  for (let i = 0; i < cleanedPages.length; i++) {
    const pageLines = cleanedPages[i];
    if (allLines.length > 0 && pageLines.length > 0) {
      const lastLine = allLines[allLines.length - 1];
      // 마지막 줄이 문장 종결 구두점으로 안 끝나면 다음 페이지 첫 줄과 연결
      if (!/[。.!?！？」』\]]$/.test(lastLine)) {
        allLines[allLines.length - 1] = lastLine + pageLines[0];
        allLines.push(...pageLines.slice(1));
        continue;
      }
    }
    allLines.push(...pageLines);
  }

  // 영어 하이픈 줄바꿈 결합 (e.g., "inter-" + "national")
  const joined = [];
  for (let i = 0; i < allLines.length; i++) {
    const cur = allLines[i];
    if (i < allLines.length - 1 && /[a-zA-Z]-$/.test(cur)) {
      allLines[i + 1] = cur.replace(/-$/, '') + allLines[i + 1];
    } else {
      joined.push(cur);
    }
  }

  return joined.join('\n').trim();
}

/** 추천 청크 크기 — "보이는 페이지 빠르게" UX 우선 */
export function suggestChunkSize(totalPages) {
  if (totalPages <= 5) return totalPages;
  if (totalPages <= 30) return 3;
  return 2;
}

/**
 * PDF 한 페이지를 PNG base64로 렌더링 (OCR용)
 * @param {*} doc pdfjs 문서 객체
 * @param {number} pageNum 1-based
 * @param {number} maxWidth 이미지 최대 너비 (리사이즈)
 * @returns base64 문자열 (prefix 'data:image/png;base64,' 제거됨)
 */
export async function renderPageAsBase64(doc, pageNum, maxWidth = 1024) {
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const scale = Math.min(2, maxWidth / viewport.width);
  const scaledViewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = scaledViewport.width;
  canvas.height = scaledViewport.height;
  const ctx = canvas.getContext('2d');

  await page.render({ canvas, canvasContext: ctx, viewport: scaledViewport }).promise;

  // PNG → JPEG (크기 절감, 품질 0.85)
  return canvas.toDataURL('image/jpeg', 0.85).replace(/^data:image\/jpeg;base64,/, '');
}

/**
 * Gemini Vision으로 페이지 OCR (한 페이지씩 순차 호출)
 * @param {*} doc pdfjs 문서
 * @param {number} pageStart 1-based
 * @param {number} pageEnd 1-based
 * @param {Function} onProgress(current, total, pageNum) 진행 콜백
 */
export async function ocrPageRange(doc, pageStart, pageEnd, onProgress) {
  const pages = [];
  const total = pageEnd - pageStart + 1;

  for (let i = pageStart; i <= pageEnd; i++) {
    onProgress?.(i - pageStart, total, i);
    const base64 = await renderPageAsBase64(doc, i);

    const prompt = `이 이미지는 책의 한 페이지입니다. 원문 텍스트를 정확히 추출해 그대로 돌려주세요.

규칙:
- 페이지 번호, 헤더, 푸터는 제외
- 원본의 줄바꿈을 최대한 유지
- 문자만 출력 (설명/주석/코드펜스 금지)
- 일본어는 한자/가나 그대로, 영어는 영어 그대로
- 이미지에 텍스트가 없거나 읽을 수 없으면 빈 문자열 반환`;

    let authHeader = {};
    try {
      const { supabase } = await import('./supabase');
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        authHeader = { Authorization: `Bearer ${session.access_token}` };
      }
    } catch {}

    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: 'image/jpeg', data: base64 } },
          ],
        }],
        generationConfig: { temperature: 0 },
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `페이지 ${i} OCR 실패`);

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    pages.push({ pageNumber: i, lines: text.split('\n').filter(l => l.trim()) });
  }

  onProgress?.(total, total, pageEnd);
  return postProcessPages(pages);
}
