/** Local, disposable PGlite only — never connects to Supabase (STREAK-LEARNING-DAY-001 · STATS-MAP-001 S2).
 * 20261101130000_streak_learning_day: 연속(활동일)의 하루를 UTC 날짜 → KST 04시 학습일로(전환 시각 2026-11-03 04:00 KST).
 * 운영과 같은 사슬(관측 fixture → 191500 뒤 마이그레이션 → anki-v2 → … → 그 직전)에서 시작한다.
 * 증명:
 *   ① 적용: 두 본문 md5 · 새 함수 둘(API 역할 실행권 없음) · core · admission · profile 재게시 · manual · 한국어 capability 그대로 ·
 *      지난 영수증 · 프로필 연속 한 행도 안 바뀜 · 재실행 no-op
 *   ② 날 식: SQL activity_day = 앱 activityDay(전환 전 UTC 날짜 · 뒤 04시 학습일) — 시각 격자 전부
 *   ③ 동작(전환 시각만 시험용으로 과거로 옮겨 실제 append_activity 경로): 전환 전 UTC 날 → 전환 뒤 첫 영수증이 KST 04–09시여도
 *      연속이 이어짐(다리) → 같은 학습일 새벽 3시는 같은 날 → 04시 뒤는 다음 날 · 다리가 없는 사람은 보통 규칙(하루 빔 + 쉼 없음 → 1)
 *   ④ 복원(docs/sql/streak-learning-day-rollback.sql): 본문 · 게시값이 적용 전과 정확히 같음 · 복원 재실행 no-op · 다시 적용
 *   node supabase/tests/streak-learning-day.mjs
 */
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { read, setup } from './perf-snapshot-fixture.mjs';
import { activityDay, liveStreakCount, replayActivityDays } from '../../src/lib/learningActivity.js';

const FILE = '20261101130000_streak_learning_day.sql';
const OUT_OF_FIXTURE = new Set(['42P01', '42883', '42704', '3F000']);
const APPEND = 'fsrs_private.append_activity(uuid,text,text,uuid,timestamp with time zone)', STREAK = 'public.update_streak(uuid)';
const OLD = { append: '72a68724a293020ae410cfaf2d93f010', streak: '355e54295750c732c20657f29e43a33a' };
const NEW = { append: 'cd68db7e1673552e7b5c05be9c5ab2be', streak: 'f9e83f7b770c391541c961a7704f16c3' };
const migration = await read(`../migrations/${FILE}`), restore = await read('../../docs/sql/streak-learning-day-rollback.sql');
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

const h = await setup();
const { db, one } = h;
try {
  const PROFILES_VIEW = ['20261016165910_public_profiles_view.sql', '20261016170000_public_profiles_view_select_only.sql'];
  const chain = (await readdir(new URL('../migrations/', import.meta.url))).filter(f => f.slice(0, 14) > '20261016191500' && f < FILE && f.endsWith('.sql')).sort();
  let ankiV2 = false;
  for (const f of [...PROFILES_VIEW, ...chain]) {
    if (!ankiV2 && f >= '20261030050000') { await db.exec(h.localize(await read('../../docs/sql/fsrs-anki-v2-policy.sql'))); ankiV2 = true; }
    try { await db.exec(h.localize(await read(`../migrations/${f}`))); }
    catch (e) { await db.exec('ROLLBACK').catch(() => {}); assert.ok(OUT_OF_FIXTURE.has(e.code), `${f}: ${e.message}`); }
  }
  assert.ok(chain.includes('20261101090000_fsrs_cards_kind.sql'), 'chain reaches the production order');

  const md5 = async sig => (await one('SELECT md5(prosrc) m FROM pg_proc WHERE oid=to_regprocedure($1)', [sig]))?.m ?? null;
  const pins = async () => { const { ok, core, manual, admission, profile } = await h.pins(); return { ok, core, manual, admission, profile }; };
  const ledger = async () => (await one(`SELECT (SELECT count(*)::int FROM fsrs_private.activity_receipts) n,
    (SELECT md5(string_agg(r::text, ',' ORDER BY r.actor_id, r.kind, r.receipt_id)) FROM fsrs_private.activity_receipts r) receipts,
    (SELECT md5(string_agg(concat_ws('|', p.id, p.streak_count, p.last_streak_date, p.streak_freeze_count), ',' ORDER BY p.id)) FROM public.profiles p) streaks`));
  const before = { pins: await pins(), capability: (await h.capability()).pinned, ledger: await ledger(), append: await md5(APPEND), streak: await md5(STREAK) };
  assert.deepEqual({ append: before.append, streak: before.streak }, OLD, 'chain bodies = production bodies (reviewed OLD)');
  assert.equal(before.pins.ok, true);

  let after;
  await check('① 적용 — 두 본문 · 새 함수 · core · admission · profile 재게시 · manual · capability · 기록 그대로', async () => {
    await db.exec(h.localize(migration));
    after = await pins();
    assert.equal(after.ok, true);
    assert.deepEqual({ append: await md5(APPEND), streak: await md5(STREAK) }, NEW);
    assert.notEqual(after.core, before.pins.core); assert.notEqual(after.admission, before.pins.admission); assert.notEqual(after.profile, before.pins.profile);
    assert.equal(after.manual, before.pins.manual);
    assert.equal((await h.capability()).pinned, before.capability, 'Korean capability pin unchanged');
    assert.deepEqual(await ledger(), before.ledger, 'no receipt or streak row changed');
    const priv = await one(`SELECT has_function_privilege('authenticated','fsrs_private.activity_day(timestamptz)','EXECUTE') a,
      has_function_privilege('anon','fsrs_private.activity_day(timestamptz)','EXECUTE') b`);
    assert.deepEqual({ a: priv.a, b: priv.b }, { a: false, b: false });
  });
  await check('① 재실행 no-op', async () => {
    await db.exec(h.localize(migration));
    assert.deepEqual(await pins(), after);
    assert.deepEqual({ append: await md5(APPEND), streak: await md5(STREAK) }, NEW);
  });

  await check('② 날 식 — SQL activity_day = 앱 activityDay(전환 전 UTC · 뒤 04시 학습일)', async () => {
    const times = [];
    for (let d = Date.parse('2026-11-01T00:00:00+09:00'); d < Date.parse('2026-11-06T00:00:00+09:00'); d += 30 * 60000) times.push(new Date(d).toISOString());
    times.push('2026-11-03T03:59:59.999+09:00', '2026-11-03T04:00:00+09:00');
    const sql = (await db.query('SELECT t, fsrs_private.activity_day(t::timestamptz)::text d FROM unnest($1::text[]) t', [times])).rows;
    for (const { t, d } of sql) assert.equal(d, activityDay(t), t);
    assert.equal(activityDay('2026-11-02T08:00:00+09:00'), '2026-11-01'); // 전환 전: UTC 날짜(11/1 23:00Z)
    assert.equal(activityDay('2026-11-04T08:00:00+09:00'), '2026-11-04'); // 뒤: 학습일
    assert.equal(activityDay('2026-11-04T02:00:00+09:00'), '2026-11-03'); // 뒤 · 04시 전 = 전날
  });

  await check('③ 동작 — 전환 다리 · 같은 학습일 · 다음 날 · 다리 없는 사람은 보통 규칙', async () => {
    // 시험 전용: 전환 시각을 5일 전 KST 04시로(실제 append_activity는 미래 시각을 받지 않는다). 프로필 지문이 이 함수에 걸리면 다시 게시.
    const now = Date.now(), dayMs = 86400000;
    const kstDate = ms => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
    const D0 = kstDate(now - 5 * dayMs);
    const at = (day, hh) => new Date(Date.parse(`${day}T${hh}:00:00+09:00`)).toISOString();
    const plus = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * dayMs).toISOString().slice(0, 10);
    await db.exec(`CREATE OR REPLACE FUNCTION fsrs_private.activity_day_switch_at() RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path TO ''
      AS $f$ SELECT '${D0} 04:00:00+09'::timestamptz $f$`);
    await db.exec(`UPDATE fsrs_private.activity_settings SET profile_contract_hash=fsrs_private.activity_profile_hash();
      UPDATE fsrs_private.settings SET contract_hash=fsrs_private.contract_hash_live();
      UPDATE fsrs_private.admission_settings SET contract_hash=fsrs_private.admission_contract_hash_live()`);
    const X = '00000000-0000-4000-8000-0000000000d1', Y = '00000000-0000-4000-8000-0000000000d2';
    for (const u of [X, Y]) { await db.query('INSERT INTO auth.users(id) VALUES ($1)', [u]); await db.query('INSERT INTO public.profiles(id) VALUES ($1)', [u]); }
    const append = async (u, id, iso) => (await one('SELECT fsrs_private.append_activity($1,\'legacy\',$2,NULL,$3::timestamptz) r', [u, id, iso])).r;
    const profile = async u => one('SELECT streak_count s, last_streak_date::text d, streak_freeze_count f FROM public.profiles WHERE id=$1', [u]);
    // X: 전환 전날 저녁(UTC 날짜 = D0-1) → 전환 뒤 첫 영수증 D0+1 07:00 KST(UTC D0 22:00 · 학습일 D0+1 — 이틀 간격) → 다리로 이어짐.
    await append(X, 'x1', at(plus(D0, -1), '20'));
    assert.deepEqual(await profile(X), { s: 1, d: plus(D0, -1), f: 0 });
    const bridged = await append(X, 'x2', at(plus(D0, 1), '07'));
    assert.equal(bridged.activityDay, D0, 'bridge counts the first post-switch receipt on its UTC date');
    assert.equal((await profile(X)).s, 2, 'streak continues across the switch');
    // 같은 학습일 저녁 → 학습일 D0+1(다리는 한 번뿐 — 하루가 한 번 더 붙는 대가) · 다음 날 새벽 3시 = 같은 학습일 · 04시 뒤 = 다음 날.
    assert.equal((await append(X, 'x3', at(plus(D0, 1), '20'))).activityDay, plus(D0, 1));
    assert.equal((await append(X, 'x4', at(plus(D0, 2), '03'))).activityDay, plus(D0, 1));
    assert.equal((await profile(X)).s, 3);
    assert.equal((await append(X, 'x5', at(plus(D0, 2), '05'))).activityDay, plus(D0, 2));
    assert.deepEqual(await profile(X), { s: 4, d: plus(D0, 2), f: 0 });
    // 앱 재생(replayActivityDays)도 같은 영수증 날로 같은 답.
    const days = (await db.query('SELECT activity_day::text d FROM fsrs_private.activity_receipts WHERE actor_id=$1 ORDER BY effective_at', [X])).rows.map(r => r.d);
    assert.equal(replayActivityDays({ streak_count: 0, last_streak_date: null, streak_freeze_count: 0 }, days).streak_count, 4);
    // Y: 전환 전 마지막이 이틀 전(UTC로도 끊김) → 다리 없음 → 보통 규칙(쉼 0 → 1부터).
    await append(Y, 'y1', at(plus(D0, -2), '20'));
    assert.equal((await append(Y, 'y2', at(plus(D0, 1), '07'))).activityDay, plus(D0, 1));
    assert.deepEqual(await profile(Y), { s: 1, d: plus(D0, 1), f: 0 });
    // 시험용 전환 시각을 원래 상수로 되돌리고 다시 게시(아래 복원 검사가 실제 상태에서 돈다).
    await db.exec(`CREATE OR REPLACE FUNCTION fsrs_private.activity_day_switch_at() RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path TO ''
      AS $f$ SELECT '2026-11-03 04:00:00+09'::timestamptz $f$;
      UPDATE fsrs_private.activity_settings SET profile_contract_hash=fsrs_private.activity_profile_hash();
      UPDATE fsrs_private.settings SET contract_hash=fsrs_private.contract_hash_live();
      UPDATE fsrs_private.admission_settings SET contract_hash=fsrs_private.admission_contract_hash_live()`);
    assert.deepEqual(await pins(), after, 'pins back to the migration result');
    // 앱 표시: 전환 전 마지막 연속일(UTC 11/2) · 지금 11/4 07:00 KST(학습일 11/4, UTC 11/3) → 다리와 같이 살아 있다.
    assert.equal(liveStreakCount({ streak_count: 5, streak_freeze_count: 0, last_streak_date: '2026-11-02' }, Date.parse('2026-11-04T07:00:00+09:00')), 5);
    assert.equal(liveStreakCount({ streak_count: 5, streak_freeze_count: 0, last_streak_date: '2026-11-04' }, Date.parse('2026-11-06T12:00:00+09:00')), 0);
  });

  await check('④ 복원 — 본문 · 게시값이 적용 전과 같음 · 재실행 no-op · 다시 적용', async () => {
    await db.exec(h.localize(restore));
    assert.deepEqual({ append: await md5(APPEND), streak: await md5(STREAK) }, OLD);
    assert.equal((await one("SELECT to_regprocedure('fsrs_private.activity_day(timestamptz)') IS NULL gone")).gone, true);
    assert.deepEqual(await pins(), before.pins);
    await db.exec(h.localize(restore));
    assert.deepEqual(await pins(), before.pins);
    await db.exec(h.localize(migration));
    // 다시 만든 두 함수는 OID가 새로 생겨 core 지문 값은 첫 적용과 다를 수 있다(지문에 OID가 들어간다) — 계약 일치 · 본문 · manual로 본다.
    const again = await pins();
    assert.equal(again.ok, true);
    assert.equal(again.manual, before.pins.manual);
    assert.deepEqual({ append: await md5(APPEND), streak: await md5(STREAK) }, NEW);
  });
  console.log(`PASS streak-learning-day: ${checks} checks`);
} catch (error) {
  console.error(error.code ?? 'ERROR', error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
