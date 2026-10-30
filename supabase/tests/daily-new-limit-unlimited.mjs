/** Local, disposable PGlite only — never connects to Supabase (LEVEL-NEW-UNLIMITED-001).
 * 20261030050000_daily_new_limit_unlimited: 하루 새 단어 수에 「제한 없음」(9999)을 더한다 — 허용 값 목록 세 곳(설정 함수 · 첫 문제 연산 ·
 * 정책 CHECK)만 바꾸고 core · admission만 재게시.
 * 증명: fixture 본문 md5 = 운영(그래서 운영에서도 같은 갈래) · 9999 설정 → 입장 상태 limit 9999 · 남은 몫이 하루 사용량에 막히지 않음 ·
 * 목록 밖 값(9998)은 여전히 거절 · 바뀐 것은 두 본문의 목록 한 군데(나머지 본문 · 권한 · 속성 · 손대지 않은 함수 · manual · profile ·
 * capability 그대로) · 재실행 no-op · 검토하지 않은 본문 위에는 적용하지 않음 · 복원 뒤 두 본문 · CHECK 정확 복귀 · 게시값 일치(9999 정책은 40으로).
 *   node supabase/tests/daily-new-limit-unlimited.mjs
 */
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { read, setup, A, B } from './perf-snapshot-fixture.mjs';

const FILE = '20261030050000_daily_new_limit_unlimited.sql';
const CONFIGURE = 'public.learning_configure_admission(uuid,jsonb)', APPLY = 'public.fsrs_apply_operation(uuid,jsonb)';
const OUT_OF_FIXTURE = new Set(['42P01', '42883', '42704', '3F000']);
const migration = await read(`../migrations/${FILE}`), restore = await read('../../docs/sql/daily-new-limit-unlimited-rollback.sql');
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

const h = await setup();
const { db, one } = h;
// 운영 순서대로 관측 뒤 마이그레이션(191500 이후 · 이 파일 전)을 올린다 — profiles privacy(20261026010000)가 먼저 요구하는 public_profiles view
// 둘(191500 전 · setup 밖)을 앞에 둔다(vocabulary-snapshot-cards.mjs와 같은 사슬). fixture 범위 밖은 건너뛴다.
const PROFILES_VIEW = ['20261016165910_public_profiles_view.sql', '20261016170000_public_profiles_view_select_only.sql'];
for (const f of [...PROFILES_VIEW, ...(await readdir(new URL('../migrations/', import.meta.url))).filter(f => f.slice(0, 14) > '20261016191500' && f < FILE && f.endsWith('.sql')).sort()]) {
  try { await db.exec(h.localize(await read(`../migrations/${f}`))); }
  catch (e) { await db.exec('ROLLBACK').catch(() => {}); assert.ok(OUT_OF_FIXTURE.has(e.code), `${f}: ${e.message}`); }
}
// 운영은 anki-v2 학습 단계 정책(docs/sql/fsrs-anki-v2-policy.sql, SQL 편집기 적용)을 얹었다 — fsrs_apply_operation 본문이 그만큼 다르다
// (New 카드 첫 기한 줄 한 줄). 같은 본문(md5 0a1a8c99 = 운영)에서 시작하게 그것도 올린다.
await db.exec(h.localize(await read('../../docs/sql/fsrs-anki-v2-policy.sql')));
const run = async sql => { await db.exec(sql); };
const state = async () => ({
  configure: await h.fnmd5(CONFIGURE), apply: await h.fnmd5(APPLY),
  check: (await one(`SELECT pg_get_constraintdef(oid) d FROM pg_constraint WHERE conname='admission_policies_daily_new_limit_check'`)).d,
  pins: await h.pins(), cap: await h.capability(),
  attrs: (await db.query(`SELECT oid::regprocedure::text s, proowner, prosecdef, proconfig, proacl::text acl FROM pg_proc WHERE oid IN ($1::regprocedure,$2::regprocedure) ORDER BY 1`, [CONFIGURE, APPLY])).rows,
  others: (await db.query(`SELECT oid::regprocedure::text s, md5(prosrc) m FROM pg_proc WHERE oid IN ('public.fsrs_apply_learning_operation(uuid,jsonb)'::regprocedure,
    'public.learning_admit_legacy(uuid,jsonb)'::regprocedure,'fsrs_private.admission_status(uuid,timestamptz)'::regprocedure,
    'fsrs_private.guard_learning_first_question()'::regprocedure,'public.fsrs_capabilities()'::regprocedure) ORDER BY 1`)).rows,
});
const configure = async (actor, limit, revision, op) => (await one(`SELECT public.learning_configure_admission($1, $2::jsonb) r`,
  [actor, JSON.stringify({ action: 'configure', accountId: actor, operationId: op, expectedPolicyRevision: revision, dailyNewLimit: limit })])).r;

const before = await state();
await check('fixture bodies = production (737c2d4c · 0a1a8c99) — the migration takes the same branch as production', async () => {
  assert.equal(before.configure, '737c2d4ce3a8390baebe80b53359621f');
  assert.equal(before.apply, '0a1a8c9922c1d9fbbdbb9621cd9634f8');
  assert.equal(before.check, 'CHECK ((daily_new_limit = ANY (ARRAY[0, 5, 10, 15, 20, 30, 40])))');
  assert.equal(before.pins.ok, true);
});
await check('before: 9999 is rejected', async () => {
  await assert.rejects(configure(A, 9999, 0, 'pre-1'), /invalid_learning_request/);
  await db.exec('ROLLBACK').catch(() => {});
});

await run(migration);
const after = await state();
await check('applied: the two bodies and the CHECK carry 9999, nothing else moved', async () => {
  assert.equal(after.configure, 'dc409fa33d4c1ddfa413237c8c863676');
  assert.equal(after.apply, 'f33171a765921d092a5961480e7c7f7c');
  assert.equal(after.check, 'CHECK ((daily_new_limit = ANY (ARRAY[0, 5, 10, 15, 20, 30, 40, 9999])))');
  assert.deepEqual(after.attrs, before.attrs, 'owner · security definer · search_path · grants unchanged');
  assert.deepEqual(after.others, before.others, 'value-comparing functions untouched');
  assert.deepEqual(after.cap, before.cap, 'Korean capability untouched');
  assert.equal(after.pins.ok, true, 'four pins consistent');
  assert.equal(after.pins.manual, before.pins.manual); assert.equal(after.pins.profile, before.pins.profile);
  assert.notEqual(after.pins.core, before.pins.core, 'core repinned (fsrs_apply_operation is in core)');
});
await check('9999 configures and the admission quota stops limiting; values off the list still fail', async () => {
  const r = await configure(A, 9999, 0, 'cfg-1');
  assert.equal(r.quota.limit, 9999);
  assert.ok(r.quota.remaining >= 9999 - r.quota.used, `remaining ${r.quota.remaining}`);
  await assert.rejects(configure(B, 9998, 0, 'cfg-2'), /invalid_learning_request/);
  await db.exec('ROLLBACK').catch(() => {});
  const back = await configure(A, 15, 1, 'cfg-3');
  assert.equal(back.quota.limit, 15, 'and back to a normal limit');
  await configure(A, 9999, 2, 'cfg-4');
});
await check('re-run is a no-op', async () => {
  await run(migration);
  const again = await state();
  assert.deepEqual({ ...again, pins: again.pins }, after);
});
await check('unreviewed body: the migration refuses (and rolls back)', async () => {
  await run(restore);
  await db.exec(`CREATE OR REPLACE FUNCTION pg_temp.noop() RETURNS void LANGUAGE sql AS 'SELECT'`);
  const tampered = migration.replace("IF cfg = '737c2d4ce3a8390baebe80b53359621f'", "IF cfg = 'ffffffffffffffffffffffffffffffff'");
  await h.expectFail(tampered, /unreviewed state/);
  assert.equal(await h.fnmd5(CONFIGURE), before.configure, 'nothing applied');
});
await check('rollback returns both bodies and the CHECK exactly, pins consistent (manual · profile unchanged); 9999 policies become 40', async () => {
  const restored = await state();
  assert.equal(restored.configure, before.configure);
  assert.equal(restored.apply, before.apply);
  assert.equal(restored.check, before.check);
  // core · admission 지문 열쇠에 제약 OID가 들어간다('constraint:'||oid) — CHECK를 다시 만들면 정의가 같아도 새 값이다. 일치(ok)만 본다.
  assert.equal(restored.pins.ok, true);
  assert.equal(restored.pins.manual, before.pins.manual); assert.equal(restored.pins.profile, before.pins.profile);
  assert.deepEqual(restored.attrs, before.attrs);
  assert.equal((await one(`SELECT daily_new_limit l FROM fsrs_private.admission_policies WHERE user_id=$1`, [A])).l, 40);
});
await check('apply again after rollback lands on the same state', async () => {
  await run(migration);
  const re = await state();
  assert.equal(re.configure, after.configure); assert.equal(re.apply, after.apply); assert.equal(re.check, after.check);
  assert.equal(re.pins.ok, true); // core · admission은 새 제약 OID로 다시 계산된 값(위 복원과 같은 이유)
});
console.log(`daily-new-limit-unlimited: ${checks} checks passed`);
