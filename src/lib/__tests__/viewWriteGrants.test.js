// VIEW-WRITE-GRANT-001 (DRAFT): 정의자 권한 view에는 anon · authenticated 쓰기 권한을 남기지 않는다.
// 근거(운영 읽기 전용 실측, 2026-10-17 KST): 20261016165910의 public.public_profiles는 security_invoker=false · 소유자 postgres(BYPASSRLS) ·
// 자동 갱신 가능한 단순 view인데 `revoke all … from public`만 해서 Supabase 기본 권한(anon · authenticated ALL)이 남았다 → anon 키로
// 남의 profiles 행 UPDATE · INSERT · DELETE(DELETE는 19개 표로 CASCADE). `from public` 회수는 역할에 직접 준 기본 권한을 지우지 않는다.
// 규칙: security_invoker=true가 아닌 view를 만드는(create [or replace] view) 마이그레이션은 같은 파일에서 anon과 authenticated 둘 다의
// 쓰기(insert · update · delete 또는 all)를 회수한다. 이미 운영에 나간 위반은 KNOWN에 고친 파일과 함께만.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'supabase/migrations');
const KNOWN = {
  '20261016165910_public_profiles_view.sql': {
    ticket: 'PROFILES-PRIVACY-001 ①-hotfix — anon/authenticated INSERT · UPDATE · DELETE가 view에 남음(운영 2026-10-17 KST 발견)',
    fixedBy: '20261016170000_public_profiles_view_select_only.sql',
  },
};
const strip = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
const read = (f) => strip(readFileSync(path.join(DIR, f), 'utf8'));

/** create [or replace] view <name> [with (...)] as — 이름과 security_invoker 여부 */
export function viewsOf(sql) {
  const out = [];
  for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?view\s+((?:"?[\w]+"?\.)?"?[\w]+"?)\s*(with\s*\(([^)]*)\))?\s*as\b/giu)) {
    const name = m[1].replace(/"/g, '').toLowerCase();
    out.push({ name: name.includes('.') ? name : `public.${name}`, invoker: /security_invoker\s*=\s*(true|on|1)\b/iu.test(m[3] || '') });
  }
  for (const m of sql.matchAll(/alter\s+view\s+((?:"?[\w]+"?\.)?"?[\w]+"?)\s+set\s*\(([^)]*)\)/giu)) {
    const name = m[1].replace(/"/g, '').toLowerCase();
    if (/security_invoker\s*=\s*(true|on|1)\b/iu.test(m[2])) for (const v of out) if (v.name === (name.includes('.') ? name : `public.${name}`)) v.invoker = true;
  }
  return out;
}

/** 이 SQL이 view의 anon · authenticated 쓰기를 회수하는가 (revoke all | revoke insert, update, delete … on [table] <view> from … anon … authenticated) */
export function revokesWrites(sql, view) {
  const short = view.split('.')[1];
  const re = new RegExp(`revoke\\s+([\\w\\s,]+?)\\s+on\\s+(?:table\\s+)?(?:"?public"?\\.)?"?${short}"?\\s+from\\s+([\\w\\s,"]+?)\\s*;`, 'giu');
  const roles = { anon: false, authenticated: false };
  for (const m of sql.matchAll(re)) {
    const privs = m[1].toLowerCase();
    const all = /\ball\b/u.test(privs);
    if (!all && !['insert', 'update', 'delete'].every((p) => privs.includes(p))) continue;
    for (const r of Object.keys(roles)) if (new RegExp(`\\b${r}\\b`, 'iu').test(m[2])) roles[r] = true;
  }
  return roles.anon && roles.authenticated;
}

describe('정의자 권한 view — anon · authenticated 쓰기 권한 회수 (VIEW-WRITE-GRANT-001)', () => {
  it('파서 자체 확인', () => {
    expect(viewsOf('create view public.v with (security_invoker = false) as select 1')).toEqual([{ name: 'public.v', invoker: false }]);
    expect(viewsOf('CREATE OR REPLACE VIEW v WITH (security_invoker=true) AS SELECT 1')).toEqual([{ name: 'public.v', invoker: true }]);
    expect(revokesWrites('revoke all on public.v from public;', 'public.v')).toBe(false);
    expect(revokesWrites('REVOKE ALL ON public.v FROM anon, authenticated;', 'public.v')).toBe(true);
    expect(revokesWrites('revoke insert, update, delete on table v from anon; revoke all on v from authenticated;', 'public.v')).toBe(true);
    expect(revokesWrites('revoke update, delete on v from anon, authenticated;', 'public.v')).toBe(false);
  });

  for (const file of files) {
    const sql = read(file);
    const definer = viewsOf(sql).filter((v) => !v.invoker && v.name.startsWith('public.'));
    if (!definer.length) continue;
    it(file, () => {
      for (const v of definer) {
        if (revokesWrites(sql, v.name)) continue;
        const known = KNOWN[file];
        expect(known, `${file}: ${v.name}는 정의자 권한 view인데 anon · authenticated 쓰기를 회수하지 않는다`).toBeTruthy();
        expect(files, `${file}: 고친 파일 ${known.fixedBy}가 저장소에 없다`).toContain(known.fixedBy);
        expect(revokesWrites(read(known.fixedBy), v.name), `${known.fixedBy}가 ${v.name} 쓰기를 회수하지 않는다`).toBe(true);
      }
    });
  }

  it('KNOWN 항목은 실제 위반만(고쳐진 파일이 들어오면 위반 파일은 그대로 남고 fixedBy가 확인된다)', () => {
    for (const file of Object.keys(KNOWN)) expect(files).toContain(file);
  });
});
