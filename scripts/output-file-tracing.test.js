import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import nextConfig from '../next.config.mjs';

describe('kuromoji output file tracing', () => {
  it('tokenizer를 쓰는 두 Node route에 같은 dict glob을 포함한다', () => {
    const includes = nextConfig.outputFileTracingIncludes;
    const dictGlob = './node_modules/kuromoji/dict/**/*';

    expect(includes['/api/analyze']).toContain(dictGlob);
    expect(includes['/api/admin/backfill-base-form']).toContain(dictGlob);
  });
});

// 정본 문학책 장 원문(BUILD-OOM-001 근본, 2026-11-01 KST) — chapters.json(85권 · 약 33MB)을 정적 import하면 webpack 서버 묶음(28.8MB)으로
// 들어가 Vercel 빌드(8GB)가 메모리를 넘겼다. 이제 서버가 파일로 읽으므로(src/lib/server/literatureBooks.js) 배포 함수에 파일이 실려야 하고,
// 문학책을 읽지 않는 함수에는 싣지 않는다(함수 크기). 실측 근거: 빌드의 .next/server/app/**/route.js.nft.json.
describe('정본 문학책 장 원문 — 번들 밖 · 읽는 라우트에만 싣기(BUILD-OOM-001)', () => {
  const CHAPTERS = './src/content/literature/*/*/chapters.json';
  const includes = nextConfig.outputFileTracingIncludes;

  function sourceFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
      return /\.(jsx?|mjs)$/.test(entry.name) && !/\.test\.jsx?$/.test(entry.name) ? [full] : [];
    });
  }

  /**
   * 정본 문학책을 읽는 라우트 = 문학책 읽기 모듈을 import하는 라우트(publishBooks · literatureBooks · 서버 분석 analysisJobs).
   * 파일 추적은 literatureBooks.js의 읽기 경로를 따라 이 라우트들에 원문을 싣는다 — 그래서 원문이 필요 없는 라우트는 이 모듈들을
   * import하지 않는다(그림 책 게시는 artBooks를 바로 쓴다).
   */
  function literatureRoutes() {
    return sourceFiles('src/app').filter((file) => /[\\/]route\.js$/.test(file))
      .filter((file) => /from '@\/lib\/server\/(publishBooks|literatureBooks|analysisJobs)'/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => `/${path.relative('src/app', path.dirname(file)).split(path.sep).filter((part) => !/^\(.*\)$/.test(part)).join('/')}`)
      .sort();
  }

  it('문학책을 읽는 라우트(관리자 게시 · 서버 분석 시작 · 예약 tick)에 chapters.json 글롭을 싣는다 — 그림 책 게시는 빠진다', () => {
    const routes = literatureRoutes();
    expect(routes).toEqual(['/api/admin/analysis-jobs', '/api/admin/literature', '/api/cron/analysis-jobs']);
    for (const route of routes) expect(includes[route], route).toContain(CHAPTERS);
  });

  it('다른 라우트에는 싣지 않는다 — 그림 책 게시(/api/admin/art-books) · 화면 · 다른 API 함수가 33MB 커지지 않게', () => {
    const carrying = Object.entries(includes).filter(([, globs]) => globs.some((glob) => glob.includes('content/literature'))).map(([route]) => route).sort();
    expect(carrying).toEqual(literatureRoutes());
    // 글롭은 작품 폴더의 chapters.json만 — 원문(source.txt · source/*.xhtml) · entry.json · 대조표까지 넓히지 않는다.
    for (const globs of Object.values(includes)) for (const glob of globs.filter((item) => item.includes('content/literature'))) expect(glob).toBe(CHAPTERS);
  });

  it('src 어디에서도 chapters.json을 import하지 않는다(정적 · 동적 · require) — 다시 번들에 들어가면 빌드 메모리가 되돌아간다', () => {
    const offenders = sourceFiles('src').filter((file) => /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)['"`][^'"`]*chapters\.json['"`]/.test(fs.readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
    for (const source of ['aozora', 'standardebooks', 'wikisource', 'pdsite']) {
      const index = fs.readFileSync(`src/content/literature/${source}/index.generated.js`, 'utf8');
      expect(index, source).not.toMatch(/^\s*import\b/m);
      expect(index, source).toMatch(/^export const \w+_BOOK_KEYS = Object\.freeze\(\[$/m);
    }
  });
});
