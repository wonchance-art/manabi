import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import aozora from '../../content/literature/aozora/manifest.generated.json';
import aozoraDisplay from '../../content/literature/aozora/manifest.display.generated.json';
import aozoraIncipits from '../../content/literature/aozora/manifest.incipits.generated.json';
import standardEbooks from '../../content/literature/standardebooks/manifest.generated.json';
import standardEbooksDisplay from '../../content/literature/standardebooks/manifest.display.generated.json';
import { literatureDisplayTitle, literatureWork, literatureWorkOfBook } from '../literatureWorks.js';
import { standardEbooksWork, standardEbooksWorkOfBook } from '../standardEbooksWorks.js';
import { literatureChapterIncipit } from '../literatureIncipits.js';
import * as canonical from '../literatureCanonical.js';
import * as seCanonical from '../standardEbooksCanonical.js';

// 표시용 정본 대조표(LIT-DISPLAY-001) — 홈이 장 제목 한 줄(literatureDisplayTitle) 때문에 전체 대조표(아오조라 165KB · 해시 · 크레딧 ·
// 장 첫 문장)를 통째로 실었다(운영 청크 64KB 전송, 2026-10-17 KST). 표지 · 제목에 쓰는 필드만 담은 표시용 표를 빌드가 파생하고,
// 화면은 그 표만 읽는다. 해시 대조(뷰어 출처 줄 · 게시 검증)는 계속 전체 대조표다.

const ROOT = process.cwd();
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');

// 계약 ①: 표시용 표는 전체 표에서 **정확히** 파생된다 — 작품 · 장 목록이 같고, 남긴 필드는 값이 같고, 그 밖의 필드는 없다.
// 허용 필드를 여기 따로 적는다(빌드 코드의 목록을 가져다 쓰면 둘이 함께 틀려도 통과한다).
const WORK_FIELDS = ['title', 'author', 'level', 'total', 'division', 'chars', 'words', 'display'];
const CHAPTER_FIELDS = ['order', 'title'];

function expectDerived(full, display) {
  expect(display.schemaVersion).toBe(full.schemaVersion);
  expect(Object.keys(display.works)).toEqual(Object.keys(full.works));
  for (const [key, work] of Object.entries(full.works)) {
    const shown = display.works[key];
    const expected = Object.fromEntries(WORK_FIELDS.filter((field) => field in work).map((field) => [field, work[field]]));
    if (work.literature && 'publishedYear' in work.literature) expected.literature = { publishedYear: work.literature.publishedYear };
    expected.chapters = work.chapters.map((chapter) => Object.fromEntries(CHAPTER_FIELDS.map((field) => [field, chapter[field]])));
    expect(shown).toEqual(expected);
  }
}

describe('표시용 대조표 — 전체 대조표에서 정확히 파생', () => {
  it('아오조라: 작품 · 장 · 필드 값이 같고, 해시 · 크레딧 · 장 첫 문장은 싣지 않는다', () => {
    expectDerived(aozora, aozoraDisplay);
    const text = JSON.stringify(aozoraDisplay);
    expect(text).not.toMatch(/"(sha256|incipit|rights|colophon|cardUrl|sourceSha256|textSha256)"/u);
  });

  it('Standard Ebooks: 같은 파생(장 이름 · 단어 수 · 빅토리아 표지 표기), 해시 · 크레딧 없음', () => {
    expectDerived(standardEbooks, standardEbooksDisplay);
    expect(JSON.stringify(standardEbooksDisplay)).not.toMatch(/"(sha256|rights|repo|sourceFile)"/u);
  });

  it('장 첫 문장 표(서재 카드 목차 줄) — 전체 대조표의 incipit과 장마다 같다', () => {
    expect(Object.keys(aozoraIncipits.works)).toEqual(Object.keys(aozora.works));
    for (const [key, work] of Object.entries(aozora.works)) {
      expect(aozoraIncipits.works[key]).toEqual(Object.fromEntries(work.chapters.map((chapter) => [String(chapter.order), chapter.incipit])));
      for (const chapter of work.chapters) expect(literatureChapterIncipit(key, chapter.order)).toBe(chapter.incipit);
    }
    expect(literatureChapterIncipit('aozora-000879-000042', 9)).toBe(null);
    expect(literatureChapterIncipit('__proto__', 1)).toBe(null);
  });
});

describe('표시 함수 — 표시용 대조표로 전과 같은 판정', () => {
  const chapterOf = (key, order, provider = 'aozora') => ({ book: { key, order }, literature: { provider } });
  it('정본 장 제목 · 작품 찾기 · 책 묶음 판정이 전체 대조표로 하던 결과와 같다', () => {
    for (const [key, work] of Object.entries(aozora.works)) {
      for (const chapter of work.chapters) {
        expect(literatureDisplayTitle(chapterOf(key, chapter.order), 'x')).toBe(canonical.literatureDisplayTitle(chapterOf(key, chapter.order), 'x', aozora.works));
      }
      expect(literatureWork(key)).toBe(aozoraDisplay.works[key]);
      const book = { key, chapters: [{ processed_json: { metadata: chapterOf(key, 1) } }] };
      expect(literatureWorkOfBook(book)).toBe(aozoraDisplay.works[key]);
      expect(literatureWorkOfBook({ ...book, chapters: [{ processed_json: { metadata: chapterOf(key, 1, 'standardebooks') } }] })).toBe(null);
    }
    for (const key of Object.keys(standardEbooks.works)) {
      expect(standardEbooksWork(key)).toBe(standardEbooksDisplay.works[key]);
      expect(standardEbooksWorkOfBook({ key, chapters: [{ processed_json: { metadata: chapterOf(key, 1, 'standardebooks') } }] })).toBe(standardEbooksDisplay.works[key]);
      expect(standardEbooksWorkOfBook({ key, chapters: [{ processed_json: { metadata: chapterOf(key, 1) } }] })).toBe(null);
    }
    expect(literatureDisplayTitle(chapterOf('aozora-000879-000042', 9), '鼻 — 9편')).toBe('鼻 — 9편');
    expect(literatureWork('__proto__')).toBe(null);
  });

  it('기존 모듈은 같은 함수를 다시 내보낸다(호출 경로 보존)', () => {
    expect(canonical.literatureWork).toBe(literatureWork);
    expect(canonical.literatureWorkOfBook).toBe(literatureWorkOfBook);
    expect(canonical.literatureDisplayTitle).toBe(literatureDisplayTitle);
    expect(seCanonical.standardEbooksWork).toBe(standardEbooksWork);
    expect(seCanonical.standardEbooksWorkOfBook).toBe(standardEbooksWorkOfBook);
  });
});

// 계약 ②: 클라이언트 화면 파일은 전체 대조표(manifest.generated.json)를 직접 · 간접 import하지 않는다.
// 정적 import · re-export를 따라간다(동적 import()는 따로 쪼갠 청크라 그 화면 번들에 붙지 않는다 — 따라가지 않는다).
// 수업 · 노트(ROUTE-AUDIT-2 F5, 2026-10-25 KST): 원문 수정 차단 판정만 쓰는 재분석 보존 → 수업 모델 사슬로 /class · /class/* · /notes/[id] 첫 JS에
// 전체 대조표(gz 67 kB)가 실렸다 — 판정은 대조표 없는 literatureCanonicalProvider에서 읽는다.
// 뷰어도 이제 싣지 않는다(VIEWER-LIT-LAZY-001 — 대조 · 표시 표는 그 출처의 정본 장을 열 때 동적 import로).
const CLIENT_SCREENS = ['src/views/HomePage.jsx', 'src/views/MaterialsPage.jsx', 'src/views/ClassHubPage.jsx', 'src/components/notes/StudyNotePage.jsx',
  'src/lib/classroomModel.js', 'src/lib/reanalysisPreservation.js', 'src/views/ViewerPage.jsx', 'src/lib/useCanonicalLiterature.js'];
const FULL_MANIFEST = /\/content\/literature\/[^/]+\/manifest\.generated\.json$/u;
const STATIC_IMPORT = /(?:^|[\n;])\s*(?:import|export)\s+(?:[^'"]*?\sfrom\s*)?['"]([^'"]+)['"]/gu;

function resolveImport(from, spec) {
  let base;
  if (spec.startsWith('@/')) base = path.join(ROOT, 'src', spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return null; // 패키지
  for (const candidate of [base, `${base}.js`, `${base}.jsx`, `${base}.mjs`, path.join(base, 'index.js'), path.join(base, 'index.jsx')]) {
    if (existsSync(candidate) && !candidate.endsWith(path.sep) && path.extname(candidate)) return candidate;
  }
  return null;
}

/** 시작 파일에서 정적 import로 닿는 전체 대조표 경로를 [대조표, 경로 사슬]로 모은다. */
function fullManifestPaths(start) {
  const seen = new Set();
  const found = [];
  const stack = [[path.join(ROOT, start), [start]]];
  while (stack.length) {
    const [file, chain] = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    if (FULL_MANIFEST.test(file)) { found.push(chain.join(' → ')); continue; }
    if (!/\.(m?js|jsx)$/u.test(file)) continue;
    const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/.*$/gmu, '$1');
    for (const [, spec] of source.matchAll(STATIC_IMPORT)) {
      const target = resolveImport(file, spec);
      if (target) stack.push([target, [...chain, path.relative(ROOT, target)]]);
    }
  }
  return found;
}

describe('화면 번들 — 전체 대조표를 싣지 않는다', () => {
  it.each(CLIENT_SCREENS)('%s는 manifest.generated.json에 정적 import로 닿지 않는다', (screen) => {
    expect(fullManifestPaths(screen)).toEqual([]);
  });

  it('검사기가 실제로 닿는 경로를 잡는다(해시 대조 모듈은 전체 대조표를 쓴다 — 음성 대조군)', () => {
    expect(fullManifestPaths('src/lib/literatureCanonical.js').length).toBeGreaterThan(0);
    expect(fullManifestPaths('src/lib/standardEbooksCanonical.js').some((chain) => chain.endsWith('aozora/manifest.generated.json'))).toBe(true);
  });

  it('뷰어는 대조 · 표시 표를 그 출처의 자료를 열 때만 동적 import로 받는다(VIEWER-LIT-LAZY-001 — 문학책 아닌 자료 첫 JS 851 KB)', () => {
    const hook = read('src/lib/useCanonicalLiterature.js');
    for (const mod of ['literatureCanonical', 'standardEbooksCanonical', 'wikisourceCanonical', 'pdSiteCanonical', 'literatureWorks']) {
      expect(hook).toContain(`import('./${mod}')`);
      expect(hook).not.toMatch(new RegExp(`from '\\./${mod}'`, 'u'));
    }
    // 받지 못하면 대조하지 않은 것과 같다(크레딧 없음 — fail-closed).
    expect(hook).toContain('.then((value) => { if (live) setLiterature(value); }, () => {});');
    const viewer = read('src/views/ViewerPage.jsx');
    expect(viewer).toContain("import { isCanonicalLiteratureMaterial } from '../lib/literatureCanonicalProvider';");
    expect(viewer).toContain('const literatureBook = useLiteratureWork(bookMeta?.key, !!canonicalLiterature);');
  });

  it('화면 파일은 표시 함수를 가벼운 모듈에서 직접 import한다', () => {
    expect(read('src/views/HomePage.jsx')).toContain("import { literatureDisplayTitle } from '@/lib/literatureWorks';");
    const materials = read('src/views/MaterialsPage.jsx');
    // 「다음 과 적기」 판정은 대조표 없는 isCanonicalBookKey(접두사 — canonicalBookKey.test.js) 몫이라 표지 함수만 가져온다
    expect(materials).toContain("import { literatureWorkOfBook } from '../lib/literatureWorks';");
    expect(materials).toContain("import { standardEbooksWorkOfBook } from '../lib/standardEbooksWorks';");
    expect(materials).not.toMatch(/from '\.\.\/lib\/(literatureCanonical|standardEbooksCanonical)'/u);
    expect(materials).toContain("import { literatureChapterIncipit } from '../lib/literatureIncipits';");
  });
});

describe('VIEWER-LIT-LAZY-001 — 늦게 받는 대조 함수는 정적 import와 같은 함수', () => {
  it('출처마다 같은 대조 함수로 풀리고, 모르는 출처 · 비어 있는 출처는 받지 않는다', async () => {
    const { loadLiteratureVerifier } = await import('../useCanonicalLiterature.js');
    const [aozora, se, ws, pd] = await Promise.all([import('../literatureCanonical.js'), import('../standardEbooksCanonical.js'),
      import('../wikisourceCanonical.js'), import('../pdSiteCanonical.js')]);
    expect(await loadLiteratureVerifier('aozora')).toBe(aozora.verifiedCanonicalLiterature);
    expect(await loadLiteratureVerifier('standardebooks')).toBe(se.verifiedStandardEbooksLiterature);
    expect(await loadLiteratureVerifier('wikisource')).toBe(ws.verifiedWikisourceLiterature);
    expect(await loadLiteratureVerifier('pdsite')).toBe(pd.verifiedPdSiteLiterature);
    for (const provider of [undefined, null, '', 'toString', '__proto__', 'gutenberg']) expect(loadLiteratureVerifier(provider)).toBeNull();
  });
});
