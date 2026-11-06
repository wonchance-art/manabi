/** Local, disposable PGlite only — never connects to Supabase (RLS-INITPLAN-001 후속 · 2026-11-06 KST).
 * 20261106140000_library_rls_initplan: library_private 정책 3개의 맨 auth.uid()를 (select auth.uid())로 감싼다.
 * 증명: ① 원래 정의(20260930135103의 create table · policy 그대로)에서 행위자별 접근 행렬을 잰다
 *       (owner A · 다른 사용자 B · anon × 읽기 · 자기 행 쓰기 · 남의 행 쓰기 · 고치기 · 지우기)
 *       ② 마이그레이션 적용 → 세 정책 감쌈 · 되돌리면 원래 식 · 명령/역할/PERMISSIVE 불변 · 접근 행렬 동일(확대 · 축소 0)
 *       ③ 재실행은 사전 검사가 거절 ④ 복원 SQL → 원래 식 · 접근 행렬 동일
 *   node supabase/tests/library-rls-initplan.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const migration = await readFile(new URL('../migrations/20261106140000_library_rls_initplan.sql', import.meta.url), 'utf8');
const rollback = await readFile(new URL('../../docs/sql/library-rls-initplan-20261106-rollback.sql', import.meta.url), 'utf8');
const source = await readFile(new URL('../migrations/20260930135103_personal_library_management.sql', import.meta.url), 'utf8');
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

// 원래 정의는 원본 마이그레이션의 문장을 그대로 잘라 쓴다(손으로 다시 쓰지 않는다).
const stmt = (start) => { const i = source.indexOf(start); assert.ok(i >= 0, start); return source.slice(i, source.indexOf(';', i) + 1); };
const ORIGINAL = [
  stmt('create table library_private.operations ('),
  stmt('create table library_private.operation_items ('),
  stmt('create table library_private.folder_operations ('),
  'alter table library_private.operations enable row level security;',
  'alter table library_private.operation_items enable row level security;',
  'alter table library_private.folder_operations enable row level security;',
  stmt('create policy library_op_own on library_private.operations'),
  stmt('create policy library_op_item_own on library_private.operation_items'),
  stmt('create policy library_folder_op_own on library_private.folder_operations'),
].join('\n');

const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth; create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
  create schema library_private; grant usage on schema library_private to authenticated, anon;
  insert into auth.users values ('${A}'), ('${B}');
`);
await db.exec(ORIGINAL);
await db.exec(`grant select, insert, update, delete on all tables in schema library_private to authenticated, anon;
  insert into library_private.operations(owner_id,id,payload) values ('${A}','10000000-0000-4000-8000-000000000001','{}'),('${B}','10000000-0000-4000-8000-000000000002','{}');
  insert into library_private.operation_items(owner_id,operation_id,target_kind,target_id,expected_revision) values
    ('${A}','10000000-0000-4000-8000-000000000001','m','1',1),('${B}','10000000-0000-4000-8000-000000000002','m','2',1);
  insert into library_private.folder_operations(owner_id,id,payload,before_rows,after_rows) values
    ('${A}','20000000-0000-4000-8000-000000000001','{}','[]','[]'),('${B}','20000000-0000-4000-8000-000000000002','{}','[]','[]');`);

const TABLES = {
  operations: { other: `('${B}','10000000-0000-4000-8000-0000000000ff','{}')`, own: `('${A}','10000000-0000-4000-8000-0000000000aa','{}')`, cols: '(owner_id,id,payload)' },
  operation_items: { other: `('${B}','10000000-0000-4000-8000-000000000002','m','9',1)`, own: `('${A}','10000000-0000-4000-8000-000000000001','m','9',1)`, cols: '(owner_id,operation_id,target_kind,target_id,expected_revision)' },
  folder_operations: { other: `('${B}','20000000-0000-4000-8000-0000000000ff','{}','[]','[]')`, own: `('${A}','20000000-0000-4000-8000-0000000000aa','{}','[]','[]')`, cols: '(owner_id,id,payload,before_rows,after_rows)' },
};
const ACTORS = { ownerA: ['authenticated', A], otherB: ['authenticated', B], anon: ['anon', ''] };

async function attempt(role, sub, sql) {
  await db.exec('begin');
  try {
    await db.exec(`set local role ${role}; select set_config('request.jwt.claim.sub', '${sub}', true);`);
    const r = await db.query(sql);
    return { ok: true, rows: r.rows, affected: r.affectedRows ?? r.rows.length };
  } catch (e) { return { ok: false, code: e.code }; }
  finally { await db.exec('rollback'); }
}
async function matrix() {
  const out = {};
  for (const [who, [role, sub]] of Object.entries(ACTORS)) {
    for (const [t, d] of Object.entries(TABLES)) {
      const sel = await attempt(role, sub, `select owner_id from library_private.${t} order by owner_id`);
      out[`${who}.${t}.select`] = sel.ok ? sel.rows.map(r => r.owner_id) : `denied:${sel.code}`;
      for (const [k, v] of [['insertOwn', d.own], ['insertOther', d.other]]) {
        const r = await attempt(role, sub, `insert into library_private.${t}${d.cols} values ${v}`);
        out[`${who}.${t}.${k}`] = r.ok ? 'ok' : `denied:${r.code}`;
      }
      const up = await attempt(role, sub, `update library_private.${t} set owner_id = owner_id returning owner_id`);
      out[`${who}.${t}.update`] = up.ok ? up.rows.map(r => r.owner_id).sort() : `denied:${up.code}`;
      const del = await attempt(role, sub, `delete from library_private.${t} returning owner_id`);
      out[`${who}.${t}.delete`] = del.ok ? del.rows.map(r => r.owner_id).sort() : `denied:${del.code}`;
    }
  }
  return out;
}
const policies = async () => (await db.query(`select tablename, policyname, cmd, permissive, roles::text, qual, with_check from pg_policies
  where schemaname='library_private' order by policyname`)).rows;

const before = await matrix();
const beforePolicies = await policies();
await check('원래 정의 — 소유자만 자기 행을 읽고 쓴다(남의 행 · anon은 0)', async () => {
  assert.deepEqual(before['ownerA.operations.select'], [A]);
  assert.deepEqual(before['otherB.folder_operations.select'], [B]);
  assert.equal(before['ownerA.operations.insertOwn'], 'ok');
  assert.match(before['ownerA.operations.insertOther'], /^denied:/);
  assert.deepEqual(before['ownerA.operation_items.delete'], [A]);
  assert.deepEqual(before['anon.operations.select'], []);
  assert.equal(beforePolicies.length, 3);
});

await db.exec(migration);
await check('적용 — 세 정책 감쌈 · 되돌리면 원래 식 · 명령/역할/PERMISSIVE 불변', async () => {
  const after = await policies();
  assert.equal(after.length, 3);
  after.forEach((p, i) => {
    const b = beforePolicies[i];
    assert.equal(p.policyname, b.policyname); assert.equal(p.cmd, b.cmd); assert.equal(p.permissive, b.permissive); assert.equal(p.roles, b.roles);
    for (const k of ['qual', 'with_check']) {
      assert.ok(!p[k].replaceAll('( SELECT auth.uid() AS uid)', '').includes('auth.uid()'), `${p.policyname}.${k} bare`);
      assert.equal(p[k].replaceAll('( SELECT auth.uid() AS uid)', 'auth.uid()'), b[k]);
    }
  });
});
await check('적용 — 접근 행렬 동일(권한 확대 · 축소 0)', async () => assert.deepEqual(await matrix(), before));
await check('재실행 — 사전 검사가 거절하고 아무것도 바꾸지 않음', async () => {
  const snap = await policies();
  await assert.rejects(db.exec(migration), /unexpected policy expression/);
  await db.exec('rollback').catch(() => {});
  assert.deepEqual(await policies(), snap);
});
await db.exec(rollback);
await check('복원 — 원래 식 · 접근 행렬 동일', async () => {
  assert.deepEqual(await policies(), beforePolicies);
  assert.deepEqual(await matrix(), before);
});
await db.close();
console.log(`library-rls-initplan: ${checks} checks passed`);

// ── 운영 사슬 위에서: 학습 계약 지문(core · manual · admission · activity) · capability가 바뀌지 않음(마이그레이션 사후 검사 실제 실행) ──
import { readdir } from 'node:fs/promises';
import { setup, read } from './perf-snapshot-fixture.mjs';
const FILE = '20261106140000_library_rls_initplan.sql';
const OUT_OF_FIXTURE = new Set(['42P01', '42883', '42704', '3F000']);
const h = await setup();
try {
  const PROFILES_VIEW = ['20261016165910_public_profiles_view.sql', '20261016170000_public_profiles_view_select_only.sql'];
  const chain = (await readdir(new URL('../migrations/', import.meta.url))).filter(f => f.slice(0, 14) > '20261016191500' && f < FILE && f.endsWith('.sql')).sort();
  let ankiV2 = false;
  for (const f of [...PROFILES_VIEW, ...chain]) {
    if (!ankiV2 && f >= '20261030050000') { await h.db.exec(h.localize(await read('../../docs/sql/fsrs-anki-v2-policy.sql'))); ankiV2 = true; }
    try { await h.db.exec(h.localize(await read(`../migrations/${f}`))); }
    catch (e) { await h.db.exec('ROLLBACK').catch(() => {}); assert.ok(OUT_OF_FIXTURE.has(e.code), `${f}: ${e.message}`); }
  }
  let lib = await h.one(`SELECT count(*)::int n FROM pg_policies WHERE schemaname='library_private' AND policyname IN ('library_op_own','library_op_item_own','library_folder_op_own')`);
  if (lib.n === 0) {
    // 서재 원장은 fixture 사슬(191500 이후) 밖에서 만들어진다 — 원본 마이그레이션 문장 그대로 세운다(지문 함수는 운영 사슬 그대로).
    await h.db.exec(`CREATE SCHEMA IF NOT EXISTS library_private;\n${ORIGINAL}`);
    lib = await h.one(`SELECT count(*)::int n FROM pg_policies WHERE schemaname='library_private'`);
  }
  const fp = async () => h.one(`SELECT fsrs_private.contract_hash_live() core, fsrs_private.manual_contract_hash_live() manual,
    fsrs_private.admission_contract_hash_live() admission, fsrs_private.activity_profile_hash_live() activity,
    (SELECT contract_hash FROM fsrs_private.settings) = fsrs_private.contract_hash() pinned`);
  if (lib.n === 3) {
    const before = await fp();
    await h.db.exec(h.localize(migration));
    await check('운영 사슬 — 사후 검사 통과 · 지문 넷 그대로 · 게시값과 일치', async () => {
      const after = await fp();
      assert.deepEqual(after, before);
      assert.equal(after.pinned, true);
      const wrapped = await h.one(`SELECT count(*)::int n FROM pg_policies WHERE schemaname='library_private' AND qual LIKE '%( SELECT auth.uid() AS uid)%'`);
      assert.equal(wrapped.n, 3);
    });
  } else {
    console.log(`SKIP 운영 사슬 — fixture에 library_private 정책 ${lib.n}/3 (서재 마이그레이션이 fixture 밖)`);
  }
} finally { await h.db.close(); }
console.log(`library-rls-initplan: ${checks} checks passed (with chain)`);
