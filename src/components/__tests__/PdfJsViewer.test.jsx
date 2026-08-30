import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  getPdfJsPageWindow,
  PDFJS_MAX_RENDERED_PAGES,
} from '../PdfJsViewer';

const readSource = (relativePath) => readFileSync(
  new URL(relativePath, import.meta.url),
  'utf8',
);

describe('PdfJsViewer 1단계 계약', () => {
  it('현재 페이지와 양옆 한 장만 렌더 대상으로 유지한다', () => {
    expect(PDFJS_MAX_RENDERED_PAGES).toBe(3);
    expect(getPdfJsPageWindow(1, 10)).toEqual([1, 2]);
    expect(getPdfJsPageWindow(5, 10)).toEqual([4, 5, 6]);
    expect(getPdfJsPageWindow(10, 10)).toEqual([9, 10]);
    expect(getPdfJsPageWindow(1, 0)).toEqual([]);
  });

  it('캔버스와 선택 가능한 TextLayer를 같은 viewport로 렌더한다', () => {
    const source = readSource('../PdfJsViewer.jsx');
    expect(source).toContain("import('pdfjs-dist/legacy/build/pdf.mjs')");
    expect(source).toContain("workerSrc = '/pdf.worker.min.mjs'");
    expect(source).toContain('page.render({');
    expect(source).toContain('new pdfjs.TextLayer({');
    expect(source).toContain('textContentSource: textContent');
    expect(source).toContain("'--scale-factor': pageSize.scale");
    expect(source).toContain('reconstructPdfPageText(textContent)');
  });

  it('?pdfjs=1만 새 뷰어를 노출하고 기본 embed 경로를 보존한다', () => {
    const viewer = readSource('../../views/PdfViewerPage.jsx');
    const embed = readSource('../PdfDocument.jsx');
    expect(viewer).toContain("const usePdfJs = searchParams.get('pdfjs') === '1';");
    // 게이트 자체를 지킨다 — prop은 늘 수 있다(v2-H R1에서 onPageChange가 붙었다).
    // 전체 문자열을 박아 두면 무해한 prop 추가에도 계약이 깨져 의도를 못 말한다.
    expect(viewer).toMatch(/usePdfJs \? <PdfJsViewer pdfUrl=\{pdfUrl\}[^>]*\/> : <PdfDocument pdfUrl=\{pdfUrl\} \/>/);
    expect(embed).toContain('<embed');
    expect(embed).toContain('type="application/pdf"');
  });

  it('pdfjs-dist 버전과 public worker 복사 전략을 고정한다', () => {
    const packageJson = JSON.parse(readSource('../../../package.json'));
    const workerScript = readSource('../../../scripts/copy-pdf-worker.mjs');
    expect(packageJson.dependencies['pdfjs-dist']).toBe('4.10.38');
    expect(packageJson.scripts.predev).toContain('scripts/copy-pdf-worker.mjs');
    expect(packageJson.scripts.prebuild).toContain('scripts/copy-pdf-worker.mjs');
    expect(workerScript).toContain("'pdfjs-dist', 'legacy', 'build', 'pdf.worker.min.mjs'");
    expect(workerScript).toContain("'public', 'pdf.worker.min.mjs'");
  });
});
