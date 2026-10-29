// 프로필 공개 범위(PROFILES-PRIVACY-001, 오너 승인 2026-10-17 KST) — 남의 행은 public_profiles view(id · display_name · avatar_url, 운영 20261016165910)로만.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { roleChangeFailureMessage } from '../errorMessage';

const ROOT = process.cwd();
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const full = path.join(dir, name);
  if (statSync(full).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : walk(full);
  return /\.(m?js|jsx)$/u.test(name) ? [full] : [];
});
const files = walk(path.join(ROOT, 'src')).map((file) => [path.relative(ROOT, file), readFileSync(file, 'utf8')]);

describe('profiles 개인정보 — 남의 행은 public_profiles(id · display_name · avatar_url)로만', () => {
  it('클라이언트 embed는 profiles가 아니라 public_profiles를 쓴다(관리자 화면만 예외)', () => {
    const offenders = files.filter(([rel, src]) => rel !== 'src/views/AdminPage.jsx' && /:profiles\(/u.test(src)).map(([rel]) => rel);
    expect(offenders).toEqual([]);
    expect(files.find(([rel]) => rel === 'src/lib/useMaterialComments.js')[1]).toContain('author:public_profiles(display_name)');
  });

  it('public_profiles embed는 세 열 밖을 고르지 않는다', () => {
    for (const [rel, src] of files) {
      for (const [, cols] of src.matchAll(/public_profiles\(([^)]*)\)/gu)) {
        expect(cols.split(',').map((c) => c.trim()).every((c) => ['id', 'display_name', 'avatar_url'].includes(c)), rel).toBe(true);
      }
    }
  });

  it('클라이언트는 xp · 연속 기록 · 역할을 profiles에 직접 쓰지 않는다(보안 정의자 경로만)', () => {
    const writes = files.flatMap(([rel, src]) => [...src.matchAll(/from\('profiles'\)\s*\.(?:update|upsert)\(([\s\S]{0,400}?)\)/gu)].map((m) => [rel, m[1]]));
    for (const [rel, body] of writes) {
      expect(body, rel).not.toMatch(/\b(xp|streak_count|streak_freeze_count|last_streak_date|role)\b/u);
    }
  });
});

// 2단계(전원 공개 정책 회수 · UPDATE 열 제한) 전에 앱이 먼저 갖춰야 할 것 — 운영 적용은 이 배포 확인 뒤.
describe('profiles 공개 범위 2단계 선행 — 서버 관리자 판별 · 역할 변경 RPC', () => {
  const server = files.filter(([rel]) => rel.startsWith('src/app/api/') || rel.startsWith('src/lib/server/'));

  it('서버 코드는 anon 키 클라이언트로 profiles를 읽지 않는다(2단계 뒤 anon은 0행)', () => {
    const offenders = [];
    for (const [rel, src] of server) {
      if (/SUPABASE_SERVICE_ROLE_KEY\s*\|\|\s*process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY/u.test(src)) offenders.push(`${rel}: service-role → anon 폴백`);
      if (/anonClient\(\)\s*\.from\(\s*'profiles'/u.test(src)) offenders.push(`${rel}: anonClient().from('profiles')`);
      for (const [, name, args] of src.matchAll(/const\s+(\w+)\s*=\s*createClient\(([\s\S]*?)\);/gu)) {
        if (!/NEXT_PUBLIC_SUPABASE_ANON_KEY/u.test(args) || /SERVICE_ROLE/u.test(args)) continue;
        if (new RegExp(`\\b${name}\\s*\\.from\\(\\s*'profiles'`, 'u').test(src)) offenders.push(`${rel}: ${name}(anon).from('profiles')`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('backfill-ipa · seed-starters 관리자 판별은 service-role 헬퍼(lib/server/auth)를 쓰고, seed-starters는 키가 없으면 503으로 닫힌다', () => {
    const src = (rel) => files.find(([r]) => r === rel)[1];
    const ipa = src('src/app/api/cron/backfill-ipa/route.js');
    expect(ipa).toMatch(/import \{[^}]*\bisAdminUser\b[^}]*\} from '@\/lib\/server\/auth'/u);
    expect(ipa).toMatch(/isAdmin = await isAdminUser\(auth\.user\.id\)/u);
    expect(ipa).not.toMatch(/from\('profiles'\)/u);
    const seed = src('src/app/api/admin/seed-starters/route.js');
    expect(seed).toMatch(/import \{[^}]*\brequireAdmin\b[^}]*\} from '@\/lib\/server\/auth'/u);
    expect(seed).not.toMatch(/from\('profiles'\)/u);
    expect(seed).not.toMatch(/NEXT_PUBLIC_SUPABASE_ANON_KEY/u);
    expect(seed).toMatch(/if \(!process\.env\.SUPABASE_SERVICE_ROLE_KEY\) \{\s*return Response\.json\([^)]*\{ status: 503 \}\);/u);
    expect(seed.indexOf('SUPABASE_SERVICE_ROLE_KEY)')).toBeLessThan(seed.indexOf('requireAdmin(request)'));
    // backfill-ipa도 키가 없으면 판별 · 쓰기 전에 닫힌 채 503 — 두 라우트가 같은 안내(SERVICE_KEY_MISSING_MESSAGE)
    const closed = /if \(!process\.env\.SUPABASE_SERVICE_ROLE_KEY\) \{\s*return Response\.json\(\{ error: SERVICE_KEY_MISSING_MESSAGE \}, \{ status: 503 \}\);/u;
    expect(ipa).toMatch(closed);
    expect(seed).toMatch(closed);
    expect(ipa.indexOf('SUPABASE_SERVICE_ROLE_KEY)')).toBeLessThan(ipa.indexOf('requireUser(request)'));
  });

  it('service-role 키가 없으면 backfill-ipa는 cron · 관리자 요청 모두 503(seed-starters와 같은 안내)', async () => {
    const { SERVICE_KEY_MISSING_MESSAGE } = await import('../server/auth.js');
    expect(SERVICE_KEY_MISSING_MESSAGE).toBe('서버 설정이 끝나지 않아 지금은 실행할 수 없어요.');
    const saved = { key: process.env.SUPABASE_SERVICE_ROLE_KEY, cron: process.env.CRON_SECRET };
    try {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      process.env.CRON_SECRET = 'cron-test';
      const { GET } = await import('../../app/api/cron/backfill-ipa/route.js');
      for (const authorization of ['Bearer cron-test', 'Bearer user-token', null]) {
        const res = await GET(new Request('https://x.test/api/cron/backfill-ipa', { headers: authorization ? { authorization } : {} }));
        expect(res.status).toBe(503);
        expect(await res.json()).toEqual({ error: SERVICE_KEY_MISSING_MESSAGE });
      }
    } finally {
      if (saved.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = saved.key;
      if (saved.cron === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved.cron;
    }
  });

  it('AdminPage 역할 변경은 admin_set_user_role RPC만 부르고, 강등 값은 CHECK 집합(student · host · admin) 안이다', () => {
    const admin = files.find(([rel]) => rel === 'src/views/AdminPage.jsx')[1];
    expect(admin).toContain("supabase.rpc('admin_set_user_role', { target: userId, new_role: role })");
    expect(admin).not.toMatch(/from\('profiles'\)\s*\.(?:update|upsert)\(/u);
    expect(admin).toContain('onError: (err) => toast(roleChangeFailureMessage(err), \'error\')');
    const sent = [...admin.matchAll(/role: u\.role === 'admin' \? '(\w+)' : '(\w+)'/gu)].flatMap((m) => [m[1], m[2]]);
    expect(sent.length).toBeGreaterThan(0);
    for (const value of sent) expect(['student', 'host', 'admin']).toContain(value);
    expect(admin).not.toMatch(/'user로 변경'|'admin으로 변경'|role: [^\n]*'user'/u);
  });

  it('역할 변경 실패 안내 — RPC 미적용(PGRST202)도 토스트 한 줄로 끝나고 원문을 내지 않는다', () => {
    const cases = [
      [{ code: 'PGRST202', message: 'Could not find the function public.admin_set_user_role(new_role, target) in the schema cache' }, '역할을 바꾸지 못했어요. 역할 변경 기능이 아직 준비 중이에요.'],
      [{ code: '42501', message: 'cannot remove the last admin' }, '마지막 관리자는 학습자로 바꿀 수 없어요. 다른 관리자를 먼저 지정해 주세요.'],
      [{ code: '42501', message: 'permission denied: admin only' }, '역할을 바꾸지 못했어요. 이 작업은 관리자만 할 수 있어요.'],
      [{ code: '22023', message: 'invalid role: user' }, '역할을 바꾸지 못했어요. 학습자 · 호스트 · 관리자 중에서만 고를 수 있어요.'],
    ];
    for (const [err, text] of cases) {
      expect(roleChangeFailureMessage(err)).toBe(text);
      expect(roleChangeFailureMessage(err)).not.toMatch(/[A-Za-z]{3,}/u);
    }
    expect(roleChangeFailureMessage(new Error('weird internal_thing exploded'))).toMatch(/^역할을 바꾸지 못했어요\. /u);
  });

  it('admin_set_user_role 마이그레이션 — 정의자 · 관리자 검사 · 마지막 관리자 거부 · authenticated만 실행 · 앞뒤 네 계약 검사', () => {
    const dir = path.join(ROOT, 'supabase/migrations');
    const name = readdirSync(dir).find((f) => /_admin_set_user_role\.sql$/u.test(f));
    expect(name).toBeTruthy();
    const sql = readFileSync(path.join(dir, name), 'utf8');
    expect(sql).toMatch(/create function public\.admin_set_user_role\(target uuid, new_role text\)[\s\S]*security definer\s+set search_path = public/u);
    expect(sql).toMatch(/if not public\.is_admin\(\) then/u);
    expect(sql).toContain("new_role not in ('student', 'host', 'admin')");
    expect(sql).toContain('cannot remove the last admin');
    expect(sql).toMatch(/revoke all on function public\.admin_set_user_role\(uuid, text\) from public, anon, authenticated, service_role;/u);
    expect(sql).toMatch(/grant execute on function public\.admin_set_user_role\(uuid, text\) to authenticated;/u);
    for (const fn of ['contract_hash', 'manual_contract_hash', 'admission_contract_hash', 'activity_profile_hash']) {
      expect(sql.split(`fsrs_private.${fn}()`).length - 1, fn).toBe(2);
    }
    expect(sql).not.toMatch(/\b(update fsrs_private|alter function public\.(is_admin|enforce_role_change_by_admin)|create or replace function public\.(is_admin|enforce_role_change_by_admin))/iu);
    expect(sql).not.toMatch(/^\s*(begin|commit|rollback)\s*;/imu);
  });
});

// 2단계 본 적용(20261026010000_profiles_privacy.sql) — 마이그레이션이 여는 열 = 앱이 사용자 세션으로 쓰는 열(그 이상도 이하도 아님).
// 실제 권한 · 행동은 supabase/tests/profiles-privacy.mjs(PGlite)가 같은 payload 모양으로 본다. 여기서는 앱 원문과 마이그레이션 원문을 맞댄다.
describe('profiles 공개 범위 2단계 — 정책 · 열 권한 = 앱 사용', () => {
  const dir = path.join(ROOT, 'supabase/migrations');
  const name = readdirSync(dir).find((f) => /^\d{14}_profiles_privacy\.sql$/u.test(f));
  const sql = name ? readFileSync(path.join(dir, name), 'utf8') : '';
  const code = sql.replace(/--[^\n]*/gu, '');
  const grantedUpdate = (code.match(/GRANT UPDATE \(([^)]*)\) ON TABLE public\.profiles TO authenticated;/u)?.[1] || '').split(',').map((c) => c.trim()).filter(Boolean);
  const grantedInsert = (code.match(/GRANT INSERT \(([^)]*)\) ON TABLE public\.profiles TO authenticated;/u)?.[1] || '').split(',').map((c) => c.trim()).filter(Boolean);
  const levelColumns = Object.fromEntries([...files.find(([rel]) => rel === 'src/lib/constants.js')[1]
    .match(/PROFILE_LEVEL_COLUMN = Object\.freeze\(\{([\s\S]*?)\}\)/u)[1].matchAll(/(\w+): '(\w+)'/gu)].map((m) => [m[1], m[2]]));

  // 괄호 균형으로 인자 하나를 자른다(문자열 · 템플릿 안 괄호는 건너뛴다).
  const balanced = (src, at) => {
    const open = src[at], close = { '(': ')', '{': '}', '[': ']' }[open];
    let depth = 0, quote = null;
    for (let i = at; i < src.length; i++) {
      const ch = src[i];
      if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = null; continue; }
      if (ch === "'" || ch === '"' || ch === '`') quote = ch;
      else if (ch === open || '({['.includes(ch)) depth++;
      else if (ch === close || ')}]'.includes(ch)) { depth--; if (depth === 0) return src.slice(at + 1, i); }
    }
    throw new Error('unbalanced');
  };
  const topLevel = (body) => {
    const parts = []; let depth = 0, quote = null, start = 0;
    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = null; continue; }
      if (ch === "'" || ch === '"' || ch === '`') quote = ch;
      else if ('({['.includes(ch)) depth++;
      else if (')}]'.includes(ch)) depth--;
      else if (ch === ',' && depth === 0) { parts.push(body.slice(start, i)); start = i + 1; }
    }
    parts.push(body.slice(start));
    return parts.map((p) => p.trim()).filter(Boolean);
  };
  /** payload 식 → 열 이름 집합. 객체 리터럴 · 배열의 첫 객체 · 같은 파일의 가장 가까운 앞선 const/let 선언 · 펼침 · PROFILE_LEVEL_COLUMN 계산 키. */
  const keysOf = (src, expr, at) => {
    const e = expr.trim();
    if (e.startsWith('[')) return keysOf(src, topLevel(e.slice(1, -1))[0], at);
    if (e.startsWith('{')) {
      return topLevel(e.slice(1, -1)).flatMap((item) => {
        if (item.startsWith('...')) return keysOf(src, item.slice(3), at);
        const computed = item.match(/^\[PROFILE_LEVEL_COLUMN\.(\w+)\]\s*:/u);
        if (computed) return [levelColumns[computed[1]]];
        const key = item.match(/^(\w+)\s*(?::|$)/u);
        if (!key) throw new Error(`해석하지 못한 payload 항목: ${item}`);
        return [key[1]];
      });
    }
    const ident = e.match(/^(\w+)$/u)?.[1];
    if (!ident) throw new Error(`해석하지 못한 payload: ${e}`);
    const decls = [...src.slice(0, at).matchAll(new RegExp(`(?:const|let)\\s+${ident}\\s*=\\s*(?=\\{)`, 'gu'))];
    if (!decls.length) throw new Error(`${ident} 선언 없음`);
    const last = decls.at(-1);
    const from = last.index + last[0].length;
    return keysOf(src, `{${balanced(src, from)}}`, last.index);
  };
  const writes = files.flatMap(([rel, src]) => [...src.matchAll(/from\('profiles'\)\s*\.(update|upsert)\(/gu)].map((m) => {
    const argAt = m.index + m[0].length - 1;
    return { rel, kind: m[1], keys: keysOf(src, topLevel(balanced(src, argAt))[0], m.index) };
  }));

  it('마이그레이션이 있다 · 전원 공개 SELECT 정책 둘을 내리고 관리자 읽기(is_admin)를 더한다 · anon에는 쓰기 권한이 없다', () => {
    expect(name, 'profiles_privacy migration').toBeTruthy();
    expect(name > '20261026000000_cohort_rpc_revoke.sql').toBe(true);
    expect(code).toMatch(/DROP POLICY "anyone_read_basic_profile" ON public\.profiles;\s*DROP POLICY "profiles_select" ON public\.profiles;/u);
    expect(code).toContain('CREATE POLICY profiles_select_admin ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((SELECT public.is_admin()));');
    expect(code).not.toMatch(/CREATE POLICY[^;]*USING \(true\)/iu);
    expect(code).toMatch(/REVOKE ALL ON TABLE public\.profiles FROM anon, authenticated;\s*GRANT SELECT ON TABLE public\.profiles TO anon, authenticated;/u);
    expect(code.replace('GRANT SELECT ON TABLE public.profiles TO anon, authenticated;', '')).not.toMatch(/GRANT[^;]*public\.profiles[^;]*\banon\b/u);
  });

  it('앱의 profiles 쓰기는 모두 해석되고, 열 권한(UPDATE 14 · INSERT 2)이 그 열들과 정확히 같다', () => {
    expect(writes.map((w) => w.rel).sort()).toEqual([
      'src/components/OnboardingModal.jsx', 'src/components/OnboardingModal.jsx',
      // 목표 창(GOAL-SHEET-001) — 현황에 있던 네 갱신(끌어올림 · 하루 목표 · 목표 · 열 부재 재시도)을 그대로 옮겼다.
      'src/components/goal/GoalSheet.jsx', 'src/components/goal/GoalSheet.jsx', 'src/components/goal/GoalSheet.jsx', 'src/components/goal/GoalSheet.jsx',
      'src/lib/learningActivity.js', 'src/lib/learningActivity.js',
      'src/views/MyPage.jsx', 'src/views/MyPage.jsx', 'src/views/MyPage.jsx',
    ]);
    const updated = new Set(writes.filter((w) => w.kind === 'update').flatMap((w) => w.keys));
    const inserted = new Set(writes.filter((w) => w.kind === 'upsert').flatMap((w) => w.keys));
    expect(grantedUpdate).toHaveLength(14);
    expect([...updated].sort()).toEqual([...grantedUpdate].sort());
    expect([...inserted].sort()).toEqual([...grantedInsert].sort());
    expect(grantedInsert).toEqual(['id', 'display_name']);
    for (const col of ['xp', 'role', 'streak_count', 'streak_freeze_count', 'last_streak_date', 'avatar_url', 'created_at']) {
      expect(grantedUpdate, col).not.toContain(col);
    }
  });

  it('관리자 화면 밖의 profiles 읽기는 모두 자기 행(.eq(\'id\', …))이다 — 남의 행은 public_profiles 또는 관리자 정책', () => {
    const offenders = [];
    for (const [rel, src] of files) {
      for (const m of src.matchAll(/from\('profiles'\)\s*\.select\(/gu)) {
        if (rel === 'src/views/AdminPage.jsx') continue;
        const chain = src.slice(m.index, m.index + 160);
        if (!/\)\s*\.eq\('id',/u.test(chain)) offenders.push(`${rel}: ${chain.split('\n')[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('복원 SQL이 있다 — 두 정책을 같은 모양(public · USING true)으로 되살리고 표 권한 순서까지 되돌린다', () => {
    const restore = readFileSync(path.join(ROOT, 'docs/sql/profiles-privacy-rollback.sql'), 'utf8');
    expect(restore).toContain('CREATE POLICY "anyone_read_basic_profile" ON public.profiles AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);');
    expect(restore).toContain('CREATE POLICY "profiles_select" ON public.profiles AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);');
    expect(restore).toContain('DROP POLICY profiles_select_admin ON public.profiles;');
    expect(restore).toMatch(/REVOKE ALL ON TABLE public\.profiles FROM anon, authenticated, service_role;\s*GRANT ALL ON TABLE public\.profiles TO anon, authenticated, service_role;/u);
  });
});
