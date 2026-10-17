// PUBLIC-CACHE-COOKIE-001 — 공유 캐시에 맡기는 응답(public · s-maxage · immutable · force-static · revalidate)은 쿠키 세션을 만지지 않는다.
// 근거(ASSET-CACHE-COOKIE-001, 2026-10-17 KST): 쿠키 세션 클라이언트(createSupabaseServerClient)로 조회하면 supabase-js가 auth.getSession()을
// 부르고, 만료된 세션이면 서버 클라이언트가 갱신해 route handler 응답에 Set-Cookie(새 접근 · 갱신 토큰)를 싣는다(@supabase/ssr setAll).
// 그 응답이 공유 캐시에 저장되면 남이 그 세션을 받는다. 서버 컴포넌트(page · layout)는 쿠키를 쓸 수 없어(setAll이 조용히 무시) 대상이 아니다 —
// Set-Cookie를 실을 수 있는 자리는 route handler와 middleware다.
// 규칙: ① 공개 캐시 신호가 있는 route 파일은 createSupabaseServerClient · cookies()를 부르지 않고, 그것을 부르는 서버 모듈(한 단계 import)도 쓰지 않는다.
//       ② 쿠키를 읽는 관리자 확인(requireAdmin · requireUser)은 미리보기 갈래에만 — PREVIEW_ONLY에 그 파일과 「공개 캐시가 그 갈래 밖에서만 붙는다」는
//          식을 함께 적은 것만 허용한다. ③ middleware는 /admin 갈래 안에서만 Supabase 클라이언트를 만든다(ISR · 정적 경로 응답에 쿠키를 싣지 않게).
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const full = path.join(dir, name);
  if (statSync(full).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : walk(full);
  return /^route\.(m?js|jsx|ts|tsx)$/u.test(name) ? [full] : [];
});
const rel = (file) => path.relative(ROOT, file).split(path.sep).join('/');
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');

/** 공유 캐시에 맡기는 신호 — 응답 헤더 · 세그먼트 설정 */
export const PUBLIC_CACHE = /['"`]\s*public\s*,|s-maxage|stale-while-revalidate|\bimmutable\b|CDN-Cache-Control|dynamic\s*=\s*['"]force-static['"]|export\s+const\s+revalidate\s*=\s*[1-9]/iu;
/** 쿠키 세션을 만지는 호출 */
export const COOKIE_SESSION = /\bcreateSupabaseServerClient\s*\(|\bcookies\s*\(\s*\)/u;
const COOKIE_GATE = /\b(requireAdmin|requireUser|requireUserClaims)\s*\(/u;

/** 미리보기(미공개) 갈래에서만 쿠키 관리자 확인을 하는 공개 캐시 route — 공개 캐시가 그 갈래 밖에서만 붙는 식과 함께 */
const PREVIEW_ONLY = {
  'src/app/api/books/japanese-n5/[edition]/asset/route.js': {
    why: '발행 기록이 없을 때(미리보기)만 requireAdmin, 그 응답은 private, no-store',
    cacheExpr: /'Cache-Control':published\?PUBLIC_ASSET_CACHE:PREVIEW_ASSET_CACHE/u,
    gateExpr: /if\(!published\)\{const auth=await requireAdmin\(\)/u,
  },
};

/** '@/…' · 상대 import 한 단계를 풀어 그 모듈 본문을 돌려준다(없으면 건너뜀). supabaseServer는 이름 단위로 따로 본다. */
function importedModules(file, src) {
  const out = [];
  for (const [, spec] of src.matchAll(/from\s+['"]([^'"]+)['"]/gu)) {
    if (!spec.startsWith('@/') && !spec.startsWith('.')) continue;
    const base = spec.startsWith('@/') ? path.join(ROOT, 'src', spec.slice(2)) : path.resolve(path.dirname(file), spec);
    const hit = ['', '.js', '.mjs', '.jsx', '/index.js'].map((ext) => base + ext).find((p) => existsSync(p) && statSync(p).isFile());
    if (hit) out.push({ spec, file: hit, src: strip(readFileSync(hit, 'utf8')) });
  }
  return out;
}
const supabaseServerImports = (src) => [...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]@\/lib\/supabaseServer['"]/gu)]
  .flatMap((m) => m[1].split(',').map((s) => s.trim().split(/\s+as\s+/u)[0]).filter(Boolean));

export function violations(file, raw) {
  const src = strip(raw);
  if (!PUBLIC_CACHE.test(src)) return [];
  const out = [];
  if (COOKIE_SESSION.test(src)) out.push('공개 캐시 route가 쿠키 세션(createSupabaseServerClient · cookies())을 만진다');
  if (supabaseServerImports(src).includes('createSupabaseServerClient')) out.push('공개 캐시 route가 createSupabaseServerClient를 import한다');
  for (const mod of importedModules(file, src)) {
    if (mod.spec === '@/lib/supabaseServer') continue;
    if (COOKIE_SESSION.test(mod.src)) out.push(`공개 캐시 route가 쿠키 세션을 쓰는 모듈 ${mod.spec}를 import한다`);
  }
  if (COOKIE_GATE.test(src)) {
    const allowed = PREVIEW_ONLY[rel(file)];
    if (!allowed) out.push('공개 캐시 route가 쿠키를 읽는 확인(requireAdmin · requireUser)을 한다 — PREVIEW_ONLY에 갈래와 함께 적는다');
    else {
      if (!allowed.cacheExpr.test(src)) out.push('PREVIEW_ONLY: 공개 캐시가 미리보기 갈래 밖에서만 붙는 식이 없다');
      if (!allowed.gateExpr.test(src)) out.push('PREVIEW_ONLY: 쿠키 확인이 미리보기 갈래 안에 있지 않다');
    }
  }
  return out;
}

const routes = walk(path.join(ROOT, 'src/app')).map((file) => [file, readFileSync(file, 'utf8')]);

describe('공개 캐시 응답은 쿠키 세션을 만지지 않는다 (PUBLIC-CACHE-COOKIE-001)', () => {
  it('판정 자체 확인 — 위반 모양은 잡고 고친 모양은 통과', () => {
    const f = path.join(ROOT, 'src/app/api/x/route.js');
    expect(violations(f, "import {createSupabaseServerClient} from '@/lib/supabaseServer';\nconst db=await createSupabaseServerClient();\nreturn new Response(b,{headers:{'Cache-Control':'public, max-age=60'}})")).toHaveLength(2);
    expect(violations(f, "export const dynamic='force-static';\nconst jar=await cookies();")).toHaveLength(1);
    expect(violations(f, "export const revalidate = 300;\nconst {user}=await requireUser();")).toHaveLength(1);
    expect(violations(f, "import {createSupabasePublicClient} from '@/lib/supabaseServer';\nconst db=createSupabasePublicClient();\nreturn new Response(b,{headers:{'Cache-Control':'public, max-age=60'}})")).toEqual([]);
    expect(violations(f, "const db=await createSupabaseServerClient();\nreturn Response.json(x,{headers:{'Cache-Control':'private, no-store'}})")).toEqual([]);
    // 쿠키 세션 모듈을 거쳐 쓰는 것도 잡는다(publishedReading → createSupabaseServerClient)
    expect(violations(f, "import {publishedReading} from '@/lib/server/bookReading';\nreturn new Response(b,{headers:{'Cache-Control':'public, s-maxage=60'}})"))
      .toEqual(['공개 캐시 route가 쿠키 세션을 쓰는 모듈 @/lib/server/bookReading를 import한다']);
    // 주석 속 언급은 세지 않는다
    expect(violations(f, "// createSupabaseServerClient()를 쓰지 않는다\nreturn new Response(b,{headers:{'Cache-Control':'public, max-age=60'}})")).toEqual([]);
  });

  it('검사 대상이 비지 않았다(route 수 · 공개 캐시 route가 실제로 있음)', () => {
    expect(routes.length).toBeGreaterThan(30);
    const publicRoutes = routes.filter(([, src]) => PUBLIC_CACHE.test(strip(src))).map(([f]) => rel(f)).sort();
    expect(publicRoutes).toEqual(expect.arrayContaining(['src/app/api/books/japanese-n5/[edition]/asset/route.js', 'src/app/api/goal-catalog/route.js', 'src/app/api/tts/route.js']));
  });

  for (const [file, src] of routes) {
    if (!PUBLIC_CACHE.test(strip(src))) continue;
    it(rel(file), () => { expect(violations(file, src), rel(file)).toEqual([]); });
  }

  it('PREVIEW_ONLY 항목은 실제 파일만', () => {
    for (const f of Object.keys(PREVIEW_ONLY)) expect(routes.map(([p]) => rel(p))).toContain(f);
  });

  it('middleware는 /admin 갈래 안에서만 Supabase 클라이언트를 만든다', () => {
    const src = strip(readFileSync(path.join(ROOT, 'src/middleware.js'), 'utf8'));
    const gate = src.indexOf("if (!pathname.startsWith('/admin')) return NextResponse.next();");
    const client = src.indexOf('createServerClient(');
    expect(gate).toBeGreaterThan(-1);
    expect(client).toBeGreaterThan(gate);
    expect(src.split('createServerClient(').length).toBe(2);
  });
});
