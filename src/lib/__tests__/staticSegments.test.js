// GUEST-STATIC-001 — 정적 · ISR 세그먼트는 요청자를 읽지 않는다(공유 캐시에 맡기는 HTML은 누구에게나 같은 바이트).
// 대상: src/lib/staticRoutes.js의 STATIC_ROUTES. 각 경로의 세그먼트 사슬(루트까지의 layout · loading · template + page)에서 시작해
// 서버 모듈 import를 끝까지 따라간다('use client' 파일에서 멈춘다 — 브라우저 부품은 서버 요청을 읽을 수 없다).
// 금지: next/headers(cookies · headers · draftMode), next/server connection, unstable_noStore, 쿠키 세션 클라이언트 · 계정 확인
// (createSupabaseServerClient · requireUser · requireAdmin · requireUserClaims · cookieAccessToken), 사슬 파일의 searchParams · force-dynamic.
// 빌드가 실제로 정적으로 구웠는지는 scripts/check-static-routes.mjs가 CI에서 본다(이 파일은 그 앞의 빠른 소스 검사 + 대조기 단위 검사).
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { STATIC_ROUTES, isrPaths, staticRouteErrors } from '../staticRoutes';

const ROOT = process.cwd();
const APP = path.join(ROOT, 'src/app');
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
const EXT = ['.jsx', '.js', '.mjs', '.tsx', '.ts'];
const SEGMENT_FILES = ['layout', 'loading', 'template'];
const DATA_MODULE_BYTES = 256 * 1024;

function pages(dir = APP) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) return d.name === '__tests__' || d.name === 'api' ? [] : pages(full);
    return /^page\.(jsx|js|tsx|ts)$/.test(d.name) ? [full] : [];
  });
}
const routeOf = (page) => '/' + path.relative(APP, path.dirname(page)).split(path.sep).filter((s) => s && !/^\(.*\)$/.test(s)).join('/');
const PAGE_BY_ROUTE = new Map(pages().map((p) => [routeOf(p).replace(/^\/$/, '/'), p]));

function chain(page) {
  const files = [page];
  for (let dir = path.dirname(page); dir.startsWith(APP); dir = path.dirname(dir)) {
    for (const name of SEGMENT_FILES) for (const ext of EXT) { const f = path.join(dir, name + ext); if (fs.existsSync(f)) files.push(f); }
    if (dir === APP) break;
  }
  return files;
}
const IMPORT = /(?:\bimport\s+(?:([^'"()]*?)\s+from\s+)?|\bimport\s*\(\s*|\bexport\s+[^'"]*?\s+from\s+)['"]([^'"]+)['"]/g;
function resolve(from, spec) {
  let base;
  if (spec.startsWith('@/')) base = path.join(ROOT, 'src', spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return null;
  return ['', ...EXT, ...EXT.map((e) => `/index${e}`)].map((e) => base + e).find((p) => fs.existsSync(p) && fs.statSync(p).isFile()) || null;
}
const isClient = (src) => /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/.test(src);
const BANNED_SPEC = { 'next/headers': '요청 쿠키 · 헤더(next/headers)' };
const BANNED_CALL = [
  [/\bunstable_noStore\s*\(/, 'unstable_noStore()'],
  [/\bconnection\s*\(\s*\)/, 'connection()'],
];
const COOKIE_SESSION_NAMES = ['createSupabaseServerClient', 'requireUser', 'requireAdmin', 'requireUserClaims', 'cookieAccessToken'];

/** 한 경로의 서버 그래프에서 금지 사용을 모은다. */
function violations(page) {
  const out = [], seen = new Set();
  const segment = new Set(chain(page));
  const visit = (file) => {
    if (seen.has(file)) return; seen.add(file);
    // 생성 데이터 모듈(도시 geo · 사전 등 수백 KB~수십 MB)은 코드가 아니다 — 읽지 않는다.
    if (fs.statSync(file).size > DATA_MODULE_BYTES) return;
    const raw = fs.readFileSync(file, 'utf8');
    if (isClient(raw)) return;
    const src = strip(raw);
    if (segment.has(file)) {
      if (/\bsearchParams\b/.test(src)) out.push(`${rel(file)}: searchParams(요청마다 다른 값 — 정적 판정이 깨진다)`);
      if (/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/.test(src)) out.push(`${rel(file)}: force-dynamic`);
      if (/export\s+const\s+revalidate\s*=\s*0\b/.test(src)) out.push(`${rel(file)}: revalidate = 0`);
    }
    for (const [re, label] of BANNED_CALL) if (re.test(src)) out.push(`${rel(file)}: ${label}`);
    for (const m of src.matchAll(IMPORT)) {
      const [, names = '', spec] = m;
      if (BANNED_SPEC[spec]) { out.push(`${rel(file)}: ${BANNED_SPEC[spec]}`); continue; }
      const target = resolve(file, spec);
      if (!target) continue;
      if (rel(target) === 'src/lib/supabaseServer.js') {
        // 공개 클라이언트(createSupabasePublicClient)는 쿠키를 만지지 않는다 — 이 모듈만은 가져온 이름으로 본다(PUBLIC-CACHE-COOKIE-001과 같은 방식).
        const used = names.replace(/[{}]/g, '').split(',').map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
        for (const name of used.filter((n) => COOKIE_SESSION_NAMES.includes(n) || n === '*')) out.push(`${rel(file)}: ${name}(쿠키 세션)`);
        continue;
      }
      visit(target);
    }
  };
  for (const f of chain(page)) visit(f);
  return { out, reached: seen.size };
}

describe('정적 · ISR 세그먼트는 요청자를 읽지 않는다', () => {
  for (const { route } of STATIC_ROUTES) {
    it(route, () => {
      const page = PAGE_BY_ROUTE.get(route);
      expect(page, `${route}의 page 파일이 없다 — 표를 고쳐라`).toBeTruthy();
      const { out, reached } = violations(page);
      expect(reached, '공허 통과 방지 — 사슬(page · 루트 layout)은 적어도 두 파일').toBeGreaterThanOrEqual(2);
      expect(out).toEqual([]);
    });
  }

  it('검사기가 실제로 잡는다 — 쿠키를 읽는 동적 화면(쿼리가 붙은 교재 · /materials)은 걸린다', () => {
    expect(violations(PAGE_BY_ROUTE.get('/books/japanese-n5')).out.join('\n')).toMatch(/next\/headers/);
    expect(violations(PAGE_BY_ROUTE.get('/materials')).out.join('\n')).toMatch(/next\/headers|searchParams|force-dynamic/);
  });
});

describe('빌드 산출 대조기(scripts/check-static-routes.mjs)', () => {
  const entry = (srcRoute, initialRevalidateSeconds = false) => ({ srcRoute, initialRevalidateSeconds });
  const table = [{ route: '/auth', revalidate: false }, { route: '/japanese/vocab/[level]', revalidate: false }, { route: '/lessons', revalidate: 3600 }];
  it('표와 같으면 빈 목록', () => {
    const manifest = { routes: { '/auth': entry('/auth'), '/japanese/vocab/n5': entry('/japanese/vocab/[level]'), '/japanese/vocab/n4': entry('/japanese/vocab/[level]'), '/lessons': entry('/lessons', 3600) } };
    expect(staticRouteErrors(manifest, table)).toEqual([]);
  });
  it('동적으로 바뀐 경로(manifest에 없음) · ISR 주기 어긋남을 잡는다', () => {
    const manifest = { routes: { '/japanese/vocab/n5': entry('/japanese/vocab/[level]'), '/lessons': entry('/lessons', 60) } };
    const errors = staticRouteErrors(manifest, table);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatch(/^\/auth: 정적으로 굽지 않았다/);
    expect(errors[1]).toMatch(/^\/lessons: ISR 주기 60 ≠ 표 3600/);
  });
  it('CI e2e 빌드 뒤에 돈다', () => {
    expect(fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8')).toContain('run: node scripts/check-static-routes.mjs');
  });
  it('ISR 판 고르기(e2e 재생성 대상)는 숫자 주기 · 접두 아래만', () => {
    const manifest = { routes: { '/auth': entry('/auth'), '/lessons': entry('/lessons', 3600), '/lessons/lang/Japanese': entry('/lessons/lang/[lang]', 3600), '/lessonsx': entry('/lessonsx', 60), '/discover': entry('/discover', 300) } };
    expect(isrPaths(manifest, '/lessons')).toEqual(['/lessons', '/lessons/lang/Japanese']);
    expect(isrPaths(manifest)).toEqual(['/discover', '/lessons', '/lessons/lang/Japanese', '/lessonsx']);
  });
  it('발행 상태를 바꿔 띄우는 e2e 서버(N3 8880 · N4 8879)는 시험 전에 책장 판을 새로 만든다', () => {
    const ci = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
    for (const port of [8879, 8880]) expect(ci).toContain(`node scripts/e2e-refresh-isr.mjs http://127.0.0.1:${port} /lessons`);
  });
});
