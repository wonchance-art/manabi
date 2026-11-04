// Supabase 새 API 키 이전 기간 계약(SUPA-KEYS-001, 오너 승인).
// ⑴ 접근자는 새 이름을 먼저, 없으면 옛 이름 ⑵ 네 이름의 직접 읽기는 접근자 두 파일뿐 ⑶ 공개 키는 Next가 인라인하는 리터럴 접근
// ⑷ 비밀 키 접근자는 브라우저 번들(‘use client’ 진입점에서 닿는 모듈 그래프)에 들어가지 않는다 ⑸ 원시 fetch는 공개 키를 Bearer로 보내지 않는다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { supabasePublicKey } from '../supabaseKeys';
import { supabaseSecretKey } from '../server/supabaseKeys';

const ROOT = process.cwd();
const NAMES = ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const PUBLIC_ACCESSOR = 'src/lib/supabaseKeys.js';
const SECRET_ACCESSOR = 'src/lib/server/supabaseKeys.js';
// playwright 설정은 e2e 더미 값을 자식 서버로 넘기기만 한다(앱 코드가 아니다).
const DIRECT_READ_ALLOW = new Set([PUBLIC_ACCESSOR, SECRET_ACCESSOR, 'playwright.config.mjs']);

const isTest = (rel) => /(^|\/)__tests__\//u.test(rel) || /\.test\.(m?js|jsx)$/u.test(rel);
const walk = (dir) => (existsSync(dir) ? readdirSync(dir) : []).flatMap((name) => {
  const full = path.join(dir, name);
  if (statSync(full).isDirectory()) return name === 'node_modules' || name.startsWith('.') ? [] : walk(full);
  return /\.(m?js|jsx|cjs)$/u.test(name) ? [full] : [];
});
const rel = (file) => path.relative(ROOT, file).split(path.sep).join('/');
const sources = ['src', 'scripts', 'e2e'].flatMap((d) => walk(path.join(ROOT, d)))
  .concat(['next.config.mjs', 'playwright.config.mjs', 'vitest.config.js', 'eslint.config.mjs'].map((f) => path.join(ROOT, f)).filter(existsSync))
  .map((file) => [rel(file), readFileSync(file, 'utf8')])
  .filter(([r]) => !isTest(r));

describe('접근자 — 새 이름 우선, 옛 이름 폴백', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('공개 키: publishable → anon → undefined, 빈 값은 없는 것으로', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_new');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'legacy-anon-jwt');
    expect(supabasePublicKey()).toBe('sb_publishable_new');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    expect(supabasePublicKey()).toBe('legacy-anon-jwt');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    expect(supabasePublicKey()).toBeUndefined();
  });

  it('비밀 키: secret → service_role → undefined, 주입 env도 같은 규칙', () => {
    vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_new');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'legacy-service-jwt');
    expect(supabaseSecretKey()).toBe('sb_secret_new');
    vi.stubEnv('SUPABASE_SECRET_KEY', '');
    expect(supabaseSecretKey()).toBe('legacy-service-jwt');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect(supabaseSecretKey()).toBeUndefined();
    expect(supabaseSecretKey({ SUPABASE_SECRET_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'b' })).toBe('a');
    expect(supabaseSecretKey({ SUPABASE_SERVICE_ROLE_KEY: 'b' })).toBe('b');
    expect(supabaseSecretKey({})).toBeUndefined();
  });
});

describe('직접 읽기는 접근자 두 파일뿐', () => {
  it('src · scripts · e2e · 루트 설정에 네 이름의 process.env / env 읽기가 없다', () => {
    const read = new RegExp(`\\benv\\s*(?:\\.\\s*(?:${NAMES.join('|')})\\b|\\[\\s*['"\`](?:${NAMES.join('|')})['"\`]\\s*\\])`, 'u');
    const destructure = new RegExp(`\\{[^}]*\\b(?:${NAMES.join('|')})\\b[^}]*\\}\\s*=\\s*(?:process\\.)?env\\b`, 'u');
    const offenders = sources.filter(([r, src]) => !DIRECT_READ_ALLOW.has(r) && (read.test(src) || destructure.test(src))).map(([r]) => r);
    expect(offenders).toEqual([]);
  });

  it('공개 접근자는 Next가 빌드 때 바꿔 넣는 리터럴 멤버 접근으로 두 이름을 읽고, 비밀 키 이름은 모른다', () => {
    const code = readFileSync(path.join(ROOT, PUBLIC_ACCESSOR), 'utf8').replace(/^\s*\/\/.*$/gmu, '');
    expect(code).toMatch(/process\.env\.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY\s*\|\|\s*process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY/u);
    expect(code).not.toMatch(/process\.env\[|=\s*process\.env\s*[;,)]|\{[^}]*\}\s*=\s*process\.env|\benv\s*=/u);
    expect(code).not.toMatch(/SUPABASE_SECRET_KEY|SERVICE_ROLE/u);
  });
});

// 모듈 그래프 — 상대 경로 · '@/' 별칭의 정적/동적 import · re-export를 따라간다(패키지 import는 건너뛴다).
const EXTS = ['', '.js', '.jsx', '.mjs', '/index.js', '/index.jsx'];
function resolveImport(fromRel, spec) {
  let base;
  if (spec.startsWith('@/')) base = path.join(ROOT, 'src', spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.join(ROOT, path.dirname(fromRel)), spec);
  else return null;
  for (const ext of EXTS) {
    const candidate = base + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) return rel(candidate);
  }
  return null;
}
const SPEC = /(?:\bimport\s*(?:[\w*{}\s,$]+\s*from\s*)?|\bexport\s*[\w*{}\s,$]*\s*from\s*|\bimport\s*\(\s*)['"]([^'"]+)['"]/gu;
const appFiles = walk(path.join(ROOT, 'src')).map(rel).filter((r) => !isTest(r));
const text = new Map(appFiles.map((r) => [r, readFileSync(path.join(ROOT, r), 'utf8')]));
const importsOf = (r) => [...(text.get(r) || '').matchAll(SPEC)].map((m) => resolveImport(r, m[1])).filter(Boolean);

describe('비밀 키 접근자는 서버에서만', () => {
  it('직접 가져오는 파일은 src/lib/server · src/app/api · route handler뿐', () => {
    const importers = appFiles.filter((r) => r !== SECRET_ACCESSOR && importsOf(r).includes(SECRET_ACCESSOR));
    expect(importers.length).toBeGreaterThan(10);
    const offenders = importers.filter((r) => !(r.startsWith('src/lib/server/') || r.startsWith('src/app/api/') || /\/route\.js$/u.test(r)));
    expect(offenders).toEqual([]);
  });

  it("‘use client’ 진입점에서 닿는 모듈 그래프에 비밀 키 접근자가 없다(브라우저 번들에 안 들어간다)", () => {
    const roots = appFiles.filter((r) => /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*\s*['"]use client['"]/u.test(text.get(r)));
    expect(roots.length).toBeGreaterThan(20);
    const parent = new Map(roots.map((r) => [r, null]));
    const queue = [...roots];
    while (queue.length) {
      const cur = queue.shift();
      for (const next of importsOf(cur)) if (!parent.has(next)) { parent.set(next, cur); queue.push(next); }
    }
    const chain = [];
    for (let at = parent.has(SECRET_ACCESSOR) ? SECRET_ACCESSOR : null; at; at = parent.get(at)) chain.unshift(at);
    expect(chain).toEqual([]);
    // 공개 접근자는 브라우저 클라이언트가 실제로 쓴다 — 그래프가 제대로 이어지는지의 대조군.
    expect(parent.has(PUBLIC_ACCESSOR)).toBe(true);
  });
});

describe('원시 fetch — 새 키는 JWT가 아니다(apikey 헤더에만)', () => {
  it('Supabase REST를 직접 부르는 곳은 키를 Authorization: Bearer로 보내지 않는다', () => {
    const offenders = [];
    for (const [r, src] of sources) {
      // 키를 담은 변수 이름을 Bearer에 다시 싣는 꼴(apikey: K, Authorization: `Bearer ${K}`)
      for (const m of src.matchAll(/apikey\s*:\s*([\w.]+)\s*,[\s\S]{0,120}?Bearer \$\{\s*([\w.]+)\s*\}/giu)) {
        if (m[1] === m[2]) offenders.push(`${r}: ${m[1]}`);
      }
      if (/Bearer \$\{\s*supabase(?:Public|Secret)Key\(/u.test(src)) offenders.push(`${r}: Bearer 접근자`);
    }
    expect(offenders).toEqual([]);
  });

  it('contentOverrides는 공개 키를 apikey로만 보낸다', () => {
    const src = readFileSync(path.join(ROOT, 'src/lib/contentOverrides.js'), 'utf8');
    expect(src).toMatch(/headers:\s*\{\s*apikey: SUPABASE_KEY\s*\}/u);
    expect(src).not.toMatch(/Authorization:\s*`Bearer/u);
  });
});
