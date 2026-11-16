import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';

// 인쇄 학습지 배선 계약(PRINT-SHEET-001) — 검색 제외 · AI 0 · 뷰어와 같은 접근 판정 · 출처 줄 · 인쇄 판 CSS.
const ROOT = process.cwd();
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const ROUTE = 'src/app/(app)/viewer/[id]/print/page.jsx';
const PAGE = 'src/views/PrintPage.jsx';
const SHEET = 'src/lib/printSheet.js';
const CSS = 'src/components/viewer/print-sheet.css';
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');

/** 정적 · 동적 import를 따라간 파일 목록(저장소 안 상대 · @/ 경로만). */
function importGraph(entries) {
  const seen = new Set();
  const stack = entries.map((f) => path.join(ROOT, f));
  const resolve = (from, spec) => {
    const base = spec.startsWith('@/') ? path.join(ROOT, 'src', spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(from), spec) : null;
    if (!base) return null;
    return [base, `${base}.js`, `${base}.jsx`, `${base}.mjs`, path.join(base, 'index.js')]
      .find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) || null;
  };
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    if (!/\.(m?js|jsx)$/.test(file)) continue;
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|^import\s+['"]([^'"]+)['"]/gm)) {
      const next = resolve(file, m[1] || m[2] || m[3]);
      if (next) stack.push(next);
    }
  }
  return [...seen].map((f) => path.relative(ROOT, f).split(path.sep).join('/'));
}

describe('인쇄 화면 — 검색 제외 · 진입', () => {
  it('자료마다의 인쇄 주소는 검색에 싣지 않는다(PRIVATE_ROBOTS)', () => {
    const route = read(ROUTE);
    expect(route).toContain("import { PRIVATE_ROBOTS } from '@/lib/seo';");
    expect(route).toContain("export const metadata = { title: '인쇄', robots: PRIVATE_ROBOTS };");
    expect(route).toContain('<PrintPage id={id} />');
  });

  it('뷰어 「학습」 창의 「인쇄」는 분석이 끝난 자료에만(팀 사본 · 한국어 자료 제외), 그 자료의 /print로 간다', () => {
    const viewer = read('src/views/ViewerPage.jsx');
    const item = sliceBetween(viewer, '{isDone&&!isLocalId(id)&&materialLang!==\'Korean\'&&<Link className="reader-activity-menu__item"', '</Link>}');
    expect(item).toContain('href={`/viewer/${encodeURIComponent(id)}/print`}');
    expect(item).toContain('{vt("인쇄")}');
    expect(viewer).toContain("const isDone = status === 'completed' || status === 'partial';");
  });
});

describe('AI를 부르지 않는다 — 번역은 교재 맵 · 기기 사본 읽기뿐', () => {
  const graph = importGraph([PAGE, SHEET]);
  const FORBIDDEN_FILES = ['src/lib/gemini.js', 'src/lib/sentenceTranslation.js', 'src/lib/ctxExplain.js', 'src/lib/analyzeText.js', 'src/lib/server/llm.js'];

  it('import 그래프가 화면 · 선택 모듈을 지나간다(공허 통과 방지)', () => {
    expect(graph).toEqual(expect.arrayContaining([PAGE, SHEET, 'src/lib/viewerReliability.js', 'src/lib/bilingualSplit.js']));
    expect(graph.length).toBeGreaterThan(30);
  });

  it('AI · 분석 모듈을 들이지 않는다(동적 import 포함)', () => {
    expect(graph.filter((f) => FORBIDDEN_FILES.includes(f) || /(^|\/)(gemini|callLLM|llm)\.m?js$/i.test(f))).toEqual([]);
  });

  it('그래프 안 어떤 코드도 AI 호출을 만들지 않는다(주석 제외)', () => {
    const hits = graph.filter((f) => /\.(m?js|jsx)$/.test(f))
      .filter((f) => /\bcallGemini\s*\(|['"`]\/api\/(gemini|analyze|explain)/.test(stripComments(read(f))));
    expect(hits).toEqual([]);
  });

  it('기기 사본은 읽기만 — 인쇄 화면 · 선택 모듈에 setItem이 없다', () => {
    for (const f of [PAGE, SHEET]) expect(stripComments(read(f)), f).not.toMatch(/setItem\s*\(/);
    expect(read(PAGE)).toContain("viewerCacheKey('viewer_tx', scope, sentence)");
  });
});

describe('뷰어와 같은 기록 · 같은 접근 판정', () => {
  const page = read(PAGE);

  it('자료 · 담은 단어 · 아는 단어는 뷰어와 같은 쿼리 키 · 같은 훅', () => {
    expect(page).toContain("queryKey: ['material', id],");
    expect(page).toContain("queryKey: ['vocab-words', user?.id],");
    expect(page).toContain('enabled: !!user,');
    expect(page).toContain('const knownState = useKnownWords(knownLangCode, !!knownLangCode && !!material);');
    expect(page).toContain('const exclusionState = useVocabularyExclusions();');
    expect(page).not.toMatch(/PROTO_KNOWN/);
  });

  it('비공개 자료는 주인만 — 뷰어와 같은 판정 · 같은 문구, 계정 확인 중에는 판정하지 않는다', () => {
    const gate = sliceBetween(page, "if (material.visibility === 'private' && material.owner_id !== user?.id && !material.__local) {", '\n  }');
    expect(gate).toContain('if (authLoading)');
    expect(gate).toContain('title="비공개 자료예요" body="이 자료는 작성자만 볼 수 있어요."');
    expect(read('src/views/ViewerPage.jsx')).toContain("material?.visibility === 'private' && material?.owner_id !== user?.id && !material?.__local");
  });

  it('분석이 끝나지 않은 자료는 인쇄하지 않는다', () => {
    expect(page).toContain("if (status !== 'completed' && status !== 'partial') {");
  });

  it('출처 줄은 늘 머리에 — metadata.source(attributionParts)와 정본 책 크레딧(useCanonicalLiterature)', () => {
    expect(page).toContain('const sources = printAttributionLines(material, literature);');
    expect(page).toContain('const literature = useCanonicalLiterature(material);');
    const head = sliceBetween(page, '<header className="print-head">', '</header>');
    expect(head).toContain('{sources.map((line) => <p key={line} className="print-meta print-meta--source" lang="ko">{line}</p>)}');
    expect(read(SHEET)).toContain('const at = attributionParts(materialSource(material));');
  });

  it('주소는 정본 출처 함수 하나로(직접 쓰지 않는다)', () => {
    expect(page).toContain('siteUrl()');
    expect(page).not.toMatch(/manabi\.co\.kr/);
  });
});

describe('인쇄 판 CSS', () => {
  const css = read(CSS);
  const print = sliceBetween(css, '@media print {', '\n}\n');

  it('인쇄하면 설정 막대 · 앱 머리말 · 꼬리말이 사라지고 종이 테두리를 걷는다', () => {
    expect(print).toMatch(/\.print-controls \{ display: none; \}/);
    expect(print).toContain(':is(.gnb, .mobile-nav, .site-footer, .skip-link, .offline-banner) { display: none !important; }');
    expect(print).toMatch(/\.print-sheet, \.print-page\[data-paper="B5"\] \.print-sheet \{[^}]*border: 0;/);
  });

  it('뷰포트 폭 쿼리 0 — 접힘은 컨테이너 쿼리(ui-conventions §2)', () => {
    expect(css).not.toMatch(/@media[^{]*\((max|min)-width/);
    expect(css).toContain('container-type: inline-size;');
    expect(css).toContain('@container (max-width: 560px) {');
  });

  it('요미 0.5em(JLReq) · 병음 0.5em = 화면의 병음 칸 식(PINYIN_EM)', () => {
    expect(css).toMatch(/\.print-body rt \{ font-size: 0\.5em;/);
    expect(sliceBetween(css, '.print-zh__py {', '}')).toContain('font-size: 0.5em;');
    expect(page()).toContain('const PINYIN_EM = 0.5;');
  });
});

function page() { return read(PAGE); }
