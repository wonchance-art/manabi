import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import {
  BRIDGE_MAX_PAGES, bridgeStartPage, embedSrcWithPage, pdfViewerHref, resolveRange,
} from '../pdfRangeBridge.js';

/**
 * 계약: v2-H R1 PDF 읽기 절벽 — 자료 뷰어로 건너갈 다리 (#1077 설계 §1·§2).
 * 12기능을 PDF 뷰어에 이식하지 않는다(이중 구현 부채가 깊어진다). 역할을 나누고
 * 다리만 놓는다 — 그 다리는 자료 뷰어의 '다음 범위'가 이미 쓰던 경로 그대로다.
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
/** 주석 제거 후 대조 — 설명 문구가 계약에 잡히지 않게(v2-L 자기함정 클래스). */
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('§2 범위 — 상한과 경계', () => {
  it('시작 쪽에서 chunk만큼, 문서 끝을 넘지 않는다', () => {
    expect(resolveRange({ startPage: 42, chunkSize: 5, pageCount: 210 })).toEqual({ start: 42, end: 46 });
    expect(resolveRange({ startPage: 208, chunkSize: 5, pageCount: 210 })).toEqual({ start: 208, end: 210 });
    expect(resolveRange({ startPage: 210, chunkSize: 5, pageCount: 210 })).toEqual({ start: 210, end: 210 });
  });

  it('한 번에 가져올 쪽수에 상한이 있다 — 없으면 분석 요청이 쪽수만큼 늘어 제한에 걸린다', () => {
    expect(BRIDGE_MAX_PAGES).toBe(10);
    expect(resolveRange({ startPage: 1, chunkSize: 999, pageCount: 500 }))
      .toEqual({ start: 1, end: BRIDGE_MAX_PAGES });
  });

  it('문서 밖이면 null — 호출자가 거절한다', () => {
    expect(resolveRange({ startPage: 211, chunkSize: 5, pageCount: 210 })).toBeNull();
    expect(resolveRange({ startPage: 0, chunkSize: 5, pageCount: 210 })).toBeNull();
    expect(resolveRange({ startPage: 3, chunkSize: 5, pageCount: 0 })).toBeNull();
    expect(resolveRange({ chunkSize: 5, pageCount: 210 })).toBeNull();
  });

  it('망가진 chunk도 최소 한 쪽은 준다', () => {
    expect(resolveRange({ startPage: 5, chunkSize: 0, pageCount: 10 })).toEqual({ start: 5, end: 5 });
    expect(resolveRange({ startPage: 5, chunkSize: NaN, pageCount: 10 })).toEqual({ start: 5, end: 5 });
  });
});

describe('시작 쪽 — 보고 있는 자리에서 시작한다', () => {
  it('pdf.js 경로는 지금 보는 쪽', () => {
    expect(bridgeStartPage({ livePage: 42, lastPageRead: 7, pageCount: 210 })).toBe(42);
  });

  it('기본 경로(<embed>)는 쪽을 모른다 — last_page_read로 떨어진다(자료 추가 화면과 같은 관례)', () => {
    expect(bridgeStartPage({ livePage: null, lastPageRead: 7, pageCount: 210 })).toBe(7);
    expect(bridgeStartPage({ pageCount: 210 })).toBe(1);
  });

  it('문서 밖 값은 끝 쪽으로 당긴다 — 저장값이 낡아도 범위가 깨지지 않는다', () => {
    expect(bridgeStartPage({ livePage: 999, pageCount: 210 })).toBe(210);
    expect(bridgeStartPage({ livePage: 0, lastPageRead: 0, pageCount: 210 })).toBe(1);
  });
});

describe('§1 이식이 아니라 다리 — 같은 경로를 두 입구가 쓴다', () => {
  const mut = codeOf(read('src/lib/usePdfRangeMutation.js'));

  it('시작 쪽을 주면 그것, 안 주면 지금 자료의 다음 쪽(기존 동작 보존)', () => {
    expect(mut).toContain('const from = Number.isFinite(startPage)');
    expect(mut).toContain('material.page_end + 1');
    expect(mut).toContain('resolveRange({ startPage: from, chunkSize, pageCount: sourcePdf.page_count })');
  });

  it('material 없이도 돈다 — PDF 뷰어에는 자료가 아직 없다', () => {
    expect(mut).toContain("if (!sourcePdf) throw new Error('PDF 출처 정보 없음');");
    expect(mut).not.toContain('!material?.page_end) throw');
  });

  it('PDF 뷰어가 추출·생성을 새로 짜지 않는다 — 규칙이 두 곳으로 갈리면 한쪽만 낡는다', () => {
    const page = codeOf(read('src/views/PdfViewerPage.jsx'));
    expect(page).toContain('usePdfRangeMutation({ sourcePdf: pdfInfo, user, toast })');
    for (const banned of ['extractPageRange', 'ocrPageRange', "from('reading_materials')", 'last_page_read:']) {
      expect(page, `PDF 뷰어가 ${banned}를 직접 하면 안 된다`).not.toContain(banned);
    }
    const bridge = codeOf(read('src/components/PdfReadBridge.jsx'));
    for (const banned of ['supabase', 'extractPageRange', 'insert(']) {
      expect(bridge, `다리 화면이 ${banned}를 알면 안 된다`).not.toContain(banned);
    }
  });

  it('강제 private·last_page_read 동기화가 그 한 곳에 그대로 남아 있다(설계 §2)', () => {
    expect(mut).toContain("visibility: 'private',");
    expect(mut).toContain("update({ last_page_read: nextEnd })");
    expect(mut).toContain('source_pdf_id: sourcePdf.id,');
  });
});

describe('다리 화면 — 고르는 일만 한다', () => {
  const bridge = read('src/components/PdfReadBridge.jsx');

  it('게스트·쪽수 미상이면 아예 뜨지 않는다 — 눌러도 만들 수 없는 버튼은 없느니만 못하다', () => {
    expect(bridge).toContain('if (!user || !Number.isFinite(pageCount) || pageCount < 1) return null;');
  });

  it('상한을 미리 알려 준다 — 눌러 본 뒤 거절당하면 왜 안 되는지 알 수 없다', () => {
    const hint = sliceBetween(bridge, '<p className="pdf-bridge__hint">', '</p>');
    expect(hint).toContain('한 번에 최대 {BRIDGE_MAX_PAGES}쪽');
    expect(bridge).toContain('max={maxEnd}');
  });

  it('고른 범위를 그대로 넘긴다', () => {
    expect(bridge).toContain('mutation.mutate({ startPage: start, chunkSize: pages })');
  });

  it('툴바에 배선돼 있고, 지금 보는 쪽이 흘러든다', () => {
    const page = read('src/views/PdfViewerPage.jsx');
    expect(page).toContain('<PdfReadBridge pdfInfo={pdfInfo} livePage={livePage} mutation={rangeMutation} user={user} />');
    // 배선만 지킨다 — prop은 늘 수 있다(R2에서 initialPage가 붙었다). 통짜 문자열을
    // 박아 두면 무해한 추가에도 깨져 의도를 못 말한다(PdfJsViewer 계약에서 겪은 그 일).
    expect(page).toMatch(/<PdfJsViewer[^>]*onPageChange=\{setLivePage\}/);
    expect(read('src/components/PdfJsViewer.jsx')).toContain('onPageChange?.(pageNumber);');
  });
});

describe('R2 역방향 — 자료에서 원본 PDF 그 쪽으로', () => {
  it('돌아갈 자리를 주소에 싣는다', () => {
    expect(pdfViewerHref('abc', 42)).toBe('/pdf/abc?page=42');
    expect(pdfViewerHref('abc')).toBe('/pdf/abc');       // 쪽을 모르면 첫 쪽
    expect(pdfViewerHref('abc', 0)).toBe('/pdf/abc');
    expect(pdfViewerHref(null, 42)).toBeNull();
  });

  it('기본 경로(<embed>)는 브라우저 내장 뷰어에 조각으로 부탁한다 — 우리가 렌더를 안 쥔다', () => {
    expect(embedSrcWithPage('https://x/y.pdf', 42)).toBe('https://x/y.pdf#toolbar=1&navpanes=0&page=42');
    // 쪽이 없어도 기존 조각은 그대로 — R1 이전 동작 보존
    expect(embedSrcWithPage('https://x/y.pdf')).toBe('https://x/y.pdf#toolbar=1&navpanes=0');
    expect(embedSrcWithPage('')).toBe('');
  });

  it('두 렌더 경로가 모두 그 쪽에서 시작한다', () => {
    const page = read('src/views/PdfViewerPage.jsx');
    expect(page).toContain("const initialPage = parseInt(searchParams.get('page'), 10) || undefined;");
    expect(page).toContain('initialPage={initialPage}');
    expect(page).toContain('page={initialPage}');
    expect(read('src/components/PdfDocument.jsx')).toContain('embedSrcWithPage(pdfUrl, page)');
  });

  it('문서 밖 쪽은 끝 쪽으로 당긴다 — 자료가 낡거나 PDF가 교체돼도 빈 화면이 안 나온다', () => {
    const viewer = read('src/components/PdfJsViewer.jsx');
    expect(viewer).toContain('if (doc?.numPages) setPageNumber((p) => Math.min(Math.max(1, p), doc.numPages));');
  });

  it('자료 뷰어의 PDF 출처 줄에서 되돌아간다 — 주소 조립은 순수 함수 한 곳', () => {
    const viewer = read('src/views/ViewerPage.jsx');
    expect(viewer).toContain('pdfViewerHref(sourcePdf.id, material.page_start)');
    expect(viewer).toContain('원본 PDF 보기');
    // 주소를 손으로 짓지 않는다 — 두 곳에 적으면 파라미터 이름이 갈린다
    expect(codeOf(viewer)).not.toMatch(/`\/pdf\/\$\{/);
  });
});
