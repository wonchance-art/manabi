/** Local, disposable PGlite only — never connects to Supabase (AI-QUOTA-001 · 2026-11-06 KST).
 * 20261106170000_ai_daily_quota: 비싼 AI 경로의 하루 상한 카운터(usage_private.ai_daily_usage + public.consume_ai_daily_quota).
 * 증명: ① service_role이 한도까지 원자적으로 더하고, 한도에 닿으면 더하지 않고 거절 ② 한 번에 한도를 넘는 단위는 행도 만들지 않음
 *       ③ 주체 · 종류별로 따로 센다 ④ 잘못된 입력 · 원문 IP 주체는 거절 ⑤ anon · authenticated는 함수 · 스키마 · 표 모두 닫힘
 *       ⑥ 학습일 = KST 04시 경계 ⑦ 그날 첫 사용이 30일 지난 행을 치운다 ⑧ 재실행해도 기존 사용량 보존 ⑨ 복원 SQL
 *   node supabase/tests/ai-daily-quota.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(new URL('../migrations/20261106170000_ai_daily_quota.sql', import.meta.url), 'utf8');
const rollback = await readFile(new URL('../../docs/sql/ai-daily-quota-20261106-rollback.sql', import.meta.url), 'utf8');
const U = 'u:00000000-0000-4000-8000-0000000000a1', V = 'u:00000000-0000-4000-8000-0000000000b2';
const IP = 'ip:' + 'ab'.repeat(32);
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

const db = new PGlite();
await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin;
  grant usage on schema public to anon, authenticated, service_role;`);
await db.exec(migration);

const as = async (role) => { await db.exec('reset role'); if (role) await db.exec(`set role ${role}`); };
const consume = async (subject, kind, units, limit) => (await db.query('select public.consume_ai_daily_quota($1,$2,$3,$4) r', [subject, kind, units, limit])).rows[0].r;
const usage = async () => { await as(null); return (await db.query('select subject, kind, units from usage_private.ai_daily_usage order by subject, kind')).rows; };

await check('① 한도까지 더하고, 닿으면 더하지 않고 거절', async () => {
  await as('service_role');
  assert.deepEqual([await consume(U, 'analyze', 1, 3), await consume(U, 'analyze', 1, 3), await consume(U, 'analyze', 1, 3)].map(r => [r.ok, r.used]), [[true, 1], [true, 2], [true, 3]]);
  const over = await consume(U, 'analyze', 1, 3);
  assert.equal(over.ok, false); assert.equal(over.used, 3); assert.equal(over.limit, 3);
  assert.deepEqual(await usage(), [{ subject: U, kind: 'analyze', units: 3 }], 'refused call did not add');
});

await check('② 한 번에 한도를 넘는 단위는 거절 · 행을 만들지 않는다', async () => {
  await as('service_role');
  const r = await consume(V, 'writing', 5, 2);
  assert.equal(r.ok, false); assert.equal(r.used, 0);
  assert.equal((await usage()).filter(x => x.subject === V).length, 0);
});

await check('③ 주체 · 종류별로 따로 센다(IP 해시 주체 포함)', async () => {
  await as('service_role');
  assert.equal((await consume(U, 'tts', 1, 3)).ok, true);
  assert.equal((await consume(V, 'analyze', 1, 3)).ok, true);
  assert.equal((await consume(IP, 'tts', 2, 3)).used, 2);
  assert.deepEqual(await usage(), [
    { subject: IP, kind: 'tts', units: 2 }, { subject: U, kind: 'analyze', units: 3 }, { subject: U, kind: 'tts', units: 1 }, { subject: V, kind: 'analyze', units: 1 },
  ]);
});

await check('④ 잘못된 입력 · 원문 IP 주체는 거절', async () => {
  await as('service_role');
  for (const args of [[U, 'analyze', 0, 3], [U, 'analyze', 1, 0], [null, 'analyze', 1, 3], [U, null, 1, 3]]) {
    await assert.rejects(consume(...args), e => e.code === '22023', `invalid ${JSON.stringify(args)}`);
  }
  await assert.rejects(consume('ip:203.0.113.7', 'tts', 1, 3), e => e.code === '23514', 'raw IP subject rejected by CHECK');
  await assert.rejects(consume(U, 'Bad-Kind', 1, 3), e => e.code === '23514');
});

await check('⑤ anon · authenticated는 함수 · 스키마 · 표 모두 닫힘', async () => {
  for (const role of ['anon', 'authenticated']) {
    await as(role);
    await assert.rejects(consume(U, 'analyze', 1, 300), /permission denied/, `${role} cannot execute`);
    await assert.rejects(db.query('select * from usage_private.ai_daily_usage'), /permission denied/, `${role} cannot read`);
  }
  await as(null);
  const p = (await db.query(`select has_function_privilege('anon','public.consume_ai_daily_quota(text,text,integer,integer)','EXECUTE') a,
    has_function_privilege('authenticated','public.consume_ai_daily_quota(text,text,integer,integer)','EXECUTE') b,
    has_function_privilege('service_role','public.consume_ai_daily_quota(text,text,integer,integer)','EXECUTE') c,
    has_schema_privilege('anon','usage_private','USAGE') d, has_schema_privilege('authenticated','usage_private','USAGE') e`)).rows[0];
  assert.deepEqual({ ...p }, { a: false, b: false, c: true, d: false, e: false });
});

await check('⑥ 학습일 = KST 04시 경계', async () => {
  await as('service_role');
  const r = await consume(V, 'explain', 1, 10);
  await as(null);
  const expected = (await db.query(`select (((now() at time zone 'Asia/Seoul') - interval '4 hours')::date)::text d`)).rows[0].d;
  assert.equal(r.day, expected);
});

await check('⑦ 그날 첫 사용(새 행)이 30일 지난 행을 치운다 · 최근 행은 남긴다', async () => {
  await as(null);
  await db.exec(`insert into usage_private.ai_daily_usage(subject, day, kind, units) values
    ('${U}', current_date - 45, 'analyze', 9), ('${U}', current_date - 10, 'analyze', 9)`);
  await as('service_role');
  await consume(U, 'paragraph', 1, 10); // 새 행 → 정리
  await as(null);
  const days = (await db.query(`select (current_date - day) age from usage_private.ai_daily_usage where subject = $1 and kind = 'analyze' order by day`, [U])).rows.map(r => r.age);
  assert.ok(!days.some(a => a > 31), `old rows removed: ${days}`);
  assert.ok(days.includes(10), 'recent row kept');
});

await check('⑧ 재실행해도 기존 사용량 보존(만들기만 하는 파일)', async () => {
  const before = await usage();
  await db.exec(migration);
  assert.deepEqual(await usage(), before);
});

await check('⑨ 복원 SQL — 함수 · 표 · 스키마 제거', async () => {
  await as(null);
  await db.exec(rollback);
  const r = (await db.query(`select to_regprocedure('public.consume_ai_daily_quota(text,text,integer,integer)') f, to_regnamespace('usage_private') s`)).rows[0];
  assert.deepEqual({ ...r }, { f: null, s: null });
});

await db.close();
console.log(`ai-daily-quota: ${checks} checks passed`);
