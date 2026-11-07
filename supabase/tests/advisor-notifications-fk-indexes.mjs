/** Local, disposable PGlite only — never connects to Supabase (ADVISOR-RECHECK-002 · 2026-11-07 KST).
 * 20261107050000_advisor_notifications_fk_indexes: notifications 중복 정책 3개 정리 + 지문 밖 FK 덮개 인덱스 2개.
 * 증명: ① 운영과 같은 정책 6개(옛 마이그레이션 원문 표 + 운영 식)에서 행위자별 접근 행렬을 잰다
 *       (받는 사람 A · 보낸 사람 B · anon × 읽기 · 고치기 · 넣기(발신자 = 나 / 남 / 없음))
 *       ② 적용 → 정책 3개 · 읽기 · 고치기 · 「내가 보낸 알림 넣기」는 같다 · 줄어드는 것은 발신자 위조와 발신자 없는 삽입뿐(그 밖 확대 · 축소 0)
 *       ③ 두 인덱스가 생긴다 ④ 재실행은 사전 검사가 거절 ⑤ 복원 SQL → 정책 6개 · 접근 행렬 원래대로 · 인덱스 없음
 *       ⑥ 운영 사슬 위에서 사후 검사 실제 실행 — 학습 계약 지문 넷 · capability 정의 불변
 *   node supabase/tests/advisor-notifications-fk-indexes.mjs
 */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const FILE = '20261107050000_advisor_notifications_fk_indexes.sql';
const migration = await readFile(new URL(`../migrations/${FILE}`, import.meta.url), 'utf8');
const rollback = await readFile(new URL('../../docs/sql/advisor-notifications-fk-indexes-20261107-rollback.sql', import.meta.url), 'utf8');
const source = await readFile(new URL('../migrations/20260329000300_notifications.sql', import.meta.url), 'utf8');
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

// 표는 원본 마이그레이션 문장 그대로, 정책 6개는 운영 pg_policies(2026-11-07 KST) 식 그대로 — 대시보드 벌 3개는 원본 마이그레이션이 없다.
const createTable = (() => { const i = source.indexOf('CREATE TABLE IF NOT EXISTS notifications ('); return source.slice(i, source.indexOf(';', i) + 1); })();
const PROD_POLICIES = `
  CREATE POLICY "Auth users insert notifications" ON public.notifications FOR INSERT WITH CHECK (((select auth.uid()) = actor_id));
  CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT USING (((select auth.uid()) = user_id));
  CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (((select auth.uid()) = user_id));
  CREATE POLICY insert_notifications ON public.notifications FOR INSERT WITH CHECK (((select auth.uid()) IS NOT NULL));
  CREATE POLICY read_own_notifications ON public.notifications FOR SELECT USING ((user_id = (select auth.uid())));
  CREATE POLICY update_own_notifications ON public.notifications FOR UPDATE USING ((user_id = (select auth.uid())));`;
const NOTIFICATIONS = `SET search_path = public; ${createTable} RESET search_path;
  ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY; ${PROD_POLICIES}`;
const SIDE_TABLES = `
  CREATE TABLE IF NOT EXISTS public.reading_materials_stub (id bigint PRIMARY KEY);
  CREATE TABLE IF NOT EXISTS public.daily_suggestions (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id uuid, material_id bigint);
  CREATE TABLE IF NOT EXISTS public.reading_progress (user_id uuid, material_id bigint, PRIMARY KEY (user_id, material_id));`;

const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth; create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
  create table public.profiles(id uuid primary key); create table public.forum_posts(id uuid primary key);
  insert into auth.users values ('${A}'), ('${B}'); insert into public.profiles values ('${A}'), ('${B}');
`);
await db.exec(NOTIFICATIONS + SIDE_TABLES);
await db.exec(`grant select, insert, update, delete on public.notifications to authenticated, anon;
  insert into public.notifications(id, user_id, type, actor_id, message) values
    ('10000000-0000-4000-8000-000000000001', '${A}', 'comment', '${B}', 'to A from B'),
    ('10000000-0000-4000-8000-000000000002', '${B}', 'mention', '${A}', 'to B from A');`);

const ACTORS = { A: ['authenticated', A], B: ['authenticated', B], anon: ['anon', ''] };
async function attempt(role, sub, sql) {
  await db.exec('begin');
  try {
    await db.exec(`set local role ${role}; select set_config('request.jwt.claim.sub', '${sub}', true);`);
    const r = await db.query(sql);
    return { ok: true, rows: r.rows };
  } catch (e) { return { ok: false, code: e.code }; }
  finally { await db.exec('rollback'); }
}
async function matrix() {
  const out = {};
  for (const [who, [role, sub]] of Object.entries(ACTORS)) {
    const sel = await attempt(role, sub, 'select message from public.notifications order by message');
    out[`${who}.select`] = sel.ok ? sel.rows.map(r => r.message) : `denied:${sel.code}`;
    const up = await attempt(role, sub, 'update public.notifications set is_read = true returning message');
    out[`${who}.update`] = up.ok ? up.rows.map(r => r.message).sort() : `denied:${up.code}`;
    const other = who === 'A' ? B : A;
    for (const [k, actor] of [['insertAsSelf', sub || null], ['insertSpoofed', other], ['insertNoActor', null]]) {
      const r = await attempt(role, sub, `insert into public.notifications(user_id, type, actor_id, message)
        values ('${other}', 'comment', ${actor ? `'${actor}'` : 'null'}, 'x')`);
      out[`${who}.${k}`] = r.ok ? 'ok' : `denied:${r.code}`;
    }
  }
  return out;
}
const policies = async () => (await db.query(`select policyname, cmd, permissive, roles::text, qual, with_check from pg_policies
  where schemaname='public' and tablename='notifications' order by policyname`)).rows;
const indexes = async () => (await db.query(`select indexname from pg_indexes where schemaname='public'
  and indexname in ('daily_suggestions_material_id_idx','reading_progress_material_id_idx') order by 1`)).rows.map(r => r.indexname);

const before = await matrix();
const beforePolicies = await policies();
await check('운영과 같은 6개 — 받는 사람만 읽고 고친다 · 로그인하면 발신자 위조 삽입이 된다(고칠 구멍)', async () => {
  assert.equal(beforePolicies.length, 6);
  assert.deepEqual(before['A.select'], ['to A from B']);
  assert.deepEqual(before['B.update'], ['to B from A']);
  assert.deepEqual(before['anon.select'], []);
  assert.equal(before['A.insertAsSelf'], 'ok');
  assert.equal(before['A.insertSpoofed'], 'ok');
  assert.equal(before['A.insertNoActor'], 'ok');
  assert.match(before['anon.insertNoActor'], /^denied:/);
});

await db.exec(migration);
const after = await matrix();
await check('적용 — 정책 3개 · 남은 셋은 글자 그대로', async () => {
  const now = await policies();
  assert.deepEqual(now.map(p => p.policyname), ['Auth users insert notifications', 'Users read own notifications', 'Users update own notifications']);
  for (const p of now) assert.deepEqual(p, beforePolicies.find(b => b.policyname === p.policyname));
});
await check('적용 — 읽기 · 고치기 · 내가 보낸 알림 넣기 동일, 줄어드는 것은 위조 · 발신자 없음 삽입뿐', async () => {
  const changed = Object.keys(before).filter(k => JSON.stringify(before[k]) !== JSON.stringify(after[k])).sort();
  assert.deepEqual(changed, ['A.insertNoActor', 'A.insertSpoofed', 'B.insertNoActor', 'B.insertSpoofed']);
  for (const k of changed) { assert.equal(before[k], 'ok'); assert.match(after[k], /^denied:42501$/); }
  assert.equal(after['A.insertAsSelf'], 'ok');
  assert.equal(after['B.insertAsSelf'], 'ok');
});
await check('적용 — FK 덮개 인덱스 2개', async () => assert.deepEqual(await indexes(), ['daily_suggestions_material_id_idx', 'reading_progress_material_id_idx']));
await check('재실행 — 사전 검사가 거절하고 아무것도 바꾸지 않음', async () => {
  const snap = await policies();
  await assert.rejects(db.exec(migration), /unexpected notifications policies/);
  await db.exec('rollback').catch(() => {});
  assert.deepEqual(await policies(), snap);
});
await db.exec(rollback);
await check('복원 — 정책 6개 · 접근 행렬 원래대로 · 인덱스 없음', async () => {
  assert.deepEqual(await policies(), beforePolicies);
  assert.deepEqual(await matrix(), before);
  assert.deepEqual(await indexes(), []);
});
await db.close();
console.log(`advisor-notifications-fk-indexes: ${checks} checks passed`);

// ── 운영 사슬 위에서: 학습 계약 지문(core · manual · admission · activity) · capability가 바뀌지 않음(마이그레이션 사후 검사 실제 실행) ──
import { setup, read } from './perf-snapshot-fixture.mjs';
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
  // notifications · daily_suggestions · reading_progress는 fixture 사슬(191500 이후) 밖에서 만들어진다 — 없으면 위 정의로 세운다.
  if (!(await h.one(`SELECT to_regclass('public.forum_posts') IS NOT NULL ok`)).ok) await h.db.exec('CREATE TABLE public.forum_posts(id uuid PRIMARY KEY)');
  if (!(await h.one(`SELECT to_regclass('public.notifications') IS NOT NULL ok`)).ok) await h.db.exec(NOTIFICATIONS);
  await h.db.exec(SIDE_TABLES);
  const fp = async () => h.one(`SELECT fsrs_private.contract_hash_live() core, fsrs_private.manual_contract_hash_live() manual,
    fsrs_private.admission_contract_hash_live() admission, fsrs_private.activity_profile_hash_live() activity,
    (SELECT contract_hash FROM fsrs_private.settings) = fsrs_private.contract_hash() pinned,
    (SELECT md5(pg_get_functiondef('public.learning_language_capabilities()'::regprocedure))) capability`);
  const pre = await fp();
  // db push처럼 로그인 맥락 없이 적용한다(20261106140000 선례 — capability를 부르면 login_required로 롤백된다).
  await h.db.exec(`SELECT set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', '', false)`);
  await h.db.exec(h.localize(migration));
  await check('운영 사슬 — 사후 검사 통과 · 지문 넷 · capability 정의 그대로 · 게시값과 일치', async () => {
    const post = await fp();
    assert.deepEqual(post, pre);
    assert.equal(post.pinned, true);
    assert.equal((await h.one(`SELECT count(*)::int n FROM pg_policies WHERE schemaname='public' AND tablename='notifications'`)).n, 3);
  });
} finally { await h.db.close(); }
console.log(`advisor-notifications-fk-indexes: ${checks} checks passed (with chain)`);
