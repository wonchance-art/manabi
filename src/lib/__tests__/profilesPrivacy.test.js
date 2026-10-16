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
