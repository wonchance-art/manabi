'use client';

// pdfjs-dist는 클라이언트에서만 사용
// workerSrc는 동적 import 시 자동 설정되지 않아 수동 지정 필요

let _pdfjsPromise = null;

async function loadPdfjs() {
  if (_pdfjsPromise) return _pdfjsPromise;
  _pdfjsPromise = (async () => {
    const pdfjs = await import('pdfjs-dist');
    // Next.js 공개 경로에 워커 파일을 올리지 않고 CDN 사용 (버전 자동 매칭)
    pdfjs.GlobalWorkerOptions.workerSrc =
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    return pdfjs;
  })();
  return _pdfjsPromise;
}

/** PDF 메타데이터 (페이지 수 + 첫 페이지 샘플 텍스트) */
export async function getPdfMetadata(fileOrBuffer) {
  const pdfjs = await loadPdfjs();
  const data = fileOrBuffer instanceof File
    ? await fileOrBuffer.arrayBuffer()
    : fileOrBuffer;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const pageCount = doc.numPages;

  // 첫 페이지 텍스트 샘플 (스캔본 감지용)
  let firstPageText = '';
  try {
    const page = await doc.getPage(1);
    const textContent = await page.getTextContent();
    firstPageText = textContent.items.map(it => it.str || '').join('');
  } catch {
    firstPageText = '';
  }

  return {
    doc, // caller가 재사용 가능
    pageCount,
    firstPageText,
    isLikelyScanned: firstPageText.replace(/\s/g, '').length < 50,
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

/** 추천 청크 크기 */
export function suggestChunkSize(totalPages) {
  if (totalPages <= 10) return totalPages;
  if (totalPages <= 50) return 5;
  return 3;
}
