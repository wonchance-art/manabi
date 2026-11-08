/** Local, disposable PGlite only — never connects to Supabase (OPS-HEALTH-001 · 2026-11-08 KST).
 * 20261108050000_observe_daily_health: 크론 실행 줄 · 일일 점검(observe_daily_health)의 이상 기준 · 하루 한 줄 경보 · 권한 · 복원.
 *   node supabase/tests/observe-daily-health.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const read = (p) => readFile(new URL(p, import.meta.url), 'utf8');
const errorEvents = await read('../migrations/20261106180000_error_events.sql');
const migration = await read('../migrations/20261108050000_observe_daily_health.sql');
const rollback = await read('../../docs/sql/observe-daily-health-20261108-rollback.sql');
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

const NOW = '2026-11-08T17:50:00Z'; // 11/9 02:50 KST — 분석 작업 크론 직후
const JOBS = ['fetch-suggestions', 'backfill-ipa', 'send-forecast', 'analysis-jobs'];

async function fresh({ fingerprint = 'fp-core' } = {}) {
  const db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema fsrs_private; create schema usage_private;
    create function fsrs_private.contract_hash_live() returns text language sql as $$ select '${fingerprint}' $$;
    create function fsrs_private.manual_contract_hash_live() returns text language sql as $$ select 'fp-manual' $$;
    create function fsrs_private.admission_contract_hash_live() returns text language sql as $$ select 'fp-admission' $$;
    create function fsrs_private.activity_profile_hash_live() returns text language sql as $$ select 'fp-activity' $$;
    create table public.reading_materials (id bigint primary key, visibility text, processed_json jsonb);
    create table public.daily_suggestions (id serial, date date, language text, source text);
    create table public.canonical_analysis_jobs (id bigint primary key, kind text, status text, chapters_done int, chapters_failed int,
      failure_streak int, updated_at timestamptz);
    create table usage_private.ai_daily_usage (subject text, day date, kind text, units int, updated_at timestamptz);`);
  await db.exec(errorEvents);
  await db.exec(migration);
  return db;
}
const health = async (db, record = false, now = NOW) => (await db.query('select public.observe_daily_health($1::timestamptz, $2) r', [now, record])).rows[0].r;
const runAt = (db, job, at, { ok = true, processed = 1, failed = 0 } = {}) => db.query(
  `insert into observe.cron_runs (job, started_at, finished_at, ok, processed, failed, detail) values ($1, $2::timestamptz - interval '1 minute', $2::timestamptz, $3, $4, $5, '{"n":1}')`,
  [job, at, ok, processed, failed]);
async function healthyDay(db) {
  await runAt(db, 'send-forecast', '2026-11-08T11:06:00Z');
  await runAt(db, 'fetch-suggestions', '2026-11-08T15:06:00Z', { processed: 6 });
  await runAt(db, 'backfill-ipa', '2026-11-08T15:36:00Z');
  await runAt(db, 'analysis-jobs', '2026-11-08T17:46:00Z', { processed: 50 });
  await db.exec(`insert into public.daily_suggestions (date, language, source) values ('2026-11-09','English','youtube_ondemand'),('2026-11-09','Japanese','nhk');
    insert into public.reading_materials values (1,'public','{"status":"completed","metadata":{"difficulty":{"version":1}}}'),
      (2,'public','{"status":"completed","metadata":{"difficulty":{"version":1}}}'), (3,'private','{"status":"completed","metadata":{}}');
    insert into usage_private.ai_daily_usage values ('u:aaa','2026-11-08','explain',12,now()),('ip:bbb','2026-11-08','tts',300,now());`);
}

{
  const db = await fresh();
  await healthyDay(db);
  await check('정상인 날 — ok · 이상 0 · 항목 전부(크론 넷 · 소식 · 오류 · 상한 · 자료 · 지문)', async () => {
    const r = await health(db);
    assert.equal(r.ok, true, JSON.stringify(r.anomalies));
    assert.deepEqual(r.anomalies, []);
    assert.deepEqual(Object.keys(r.crons).sort(), [...JOBS].sort());
    assert.equal(r.crons['analysis-jobs'].processed, 50);
    assert.equal(r.suggestions.total, 2);
    assert.equal(r.suggestions.by_language_source['English/youtube_ondemand'], 1);
    assert.deepEqual(r.materials, { public: 2, public_completed: 2, difficulty_filled: 2, difficulty_unfilled: 0 });
    assert.equal(r.quota.day, '2026-11-08');                           // 02:50 KST는 학습일(04시 경계) 11/8
    assert.equal(r.quota.by_kind.tts, 300);
    assert.equal(r.quota.top[0].units, 300);
    assert.match(r.quota.top[0].who, /^ip:[0-9a-f]{8}$/);               // 주체 원문은 내보내지 않는다
    assert.deepEqual(r.fingerprints, { core: 'fp-core', manual: 'fp-manual', admission: 'fp-admission', activity: 'fp-activity' });
    assert.equal(r.kst_day, '2026-11-09');
  });
  await check('읽기만 할 때(p_record false)는 아무것도 쓰지 않는다', async () => {
    assert.equal((await db.query('select count(*)::int n from observe.health_checks')).rows[0].n, 0);
    assert.equal((await db.query("select count(*)::int n from observe.error_events where kind = 'health.alert'")).rows[0].n, 0);
  });
  await check('기록(p_record true) — 그날 한 줄, 이상 없으면 경보 0', async () => {
    const r = await health(db, true);
    assert.equal(r.ok, true);
    assert.equal((await db.query('select count(*)::int n from observe.health_checks')).rows[0].n, 1);
    assert.equal((await db.query("select count(*)::int n from observe.error_events where kind = 'health.alert'")).rows[0].n, 0);
  });
  await db.close();
}

{
  const db = await fresh();
  await healthyDay(db);
  await db.exec("delete from observe.cron_runs where job = 'backfill-ipa'");
  await runAt(db, 'analysis-jobs', '2026-11-08T17:47:00Z', { failed: 2 });
  await runAt(db, 'send-forecast', '2026-11-08T12:00:00Z', { ok: false });
  await db.exec(`insert into public.reading_materials values (4,'public','{"status":"completed","metadata":{}}');
    delete from public.daily_suggestions;`);
  await db.query("select public.observe_record_error('server','server.youtube-collect','youtube_api_channels_403_keyInvalid',null,null,'/api/cron/fetch-suggestions',null,null)");
  // observe_record_error는 실제 now()로 찍는다 — 점검 창(고정 NOW 기준 24시간) 안으로 옮겨야 실행 시각과 무관하게 같은 결과가 난다
  // (11/9 03:50 KST 이후 CI에서 server_errors가 빠지던 시한폭탄, #1780).
  await db.exec("update observe.error_events set created_at = '2026-11-08T17:30:00Z', last_seen_at = '2026-11-08T17:30:00Z' where kind = 'server.youtube-collect'");
  await check('이상 기준 — 크론 미실행 · 실패 · 오늘의 소식 0 · 난이도 미채움 · 서버 오류', async () => {
    const r = await health(db);
    assert.equal(r.ok, false);
    assert.deepEqual([...r.anomalies].sort(), ['cron_failed:analysis-jobs', 'cron_failed:send-forecast', 'cron_missing:backfill-ipa',
      'difficulty_unfilled', 'server_errors', 'suggestions_empty'].sort());
    assert.equal(r.materials.difficulty_unfilled, 1);
    assert.equal(r.errors.by_kind['server:server.youtube-collect'].rows, 1);
  });
  await check('경보 — 기록하면 health.alert 한 줄, 같은 날 다시 기록해도 늘지 않는다(하루 1줄)', async () => {
    const r1 = await health(db, true);
    assert.equal(r1.alerted, true);
    await health(db, true, '2026-11-08T18:30:00Z');
    const alerts = (await db.query("select message, source, route from observe.error_events where kind = 'health.alert'")).rows;
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].source, 'server');
    assert.match(alerts[0].message, /cron_missing:backfill-ipa/);
    // 경보 자신은 다음 점검의 server_errors에 세지 않는다
    assert.equal((await health(db)).errors.server_rows, 1);
  });
  await check('26시간 넘은 실행은 「돌았다」로 치지 않는다', async () => {
    const r = await health(db, false, '2026-11-10T03:00:00Z');
    for (const j of JOBS) assert.ok(r.anomalies.includes(`cron_missing:${j}`), j);
  });
  await db.close();
}

{
  // 지문 — 전날 점검과 비교. 바뀐 날 한 번 울리고, 다음 날(새 값이 전날 값이 되면) 조용해진다.
  const db = await fresh({ fingerprint: 'fp-core' });
  await healthyDay(db);
  await health(db, true, '2026-11-07T17:50:00Z');                    // 11/8 KST 점검
  await db.exec("create or replace function fsrs_private.contract_hash_live() returns text language sql as $$ select 'fp-core-NEW' $$");
  await check('지문 — 전날과 다르면 fingerprint_changed:core, 이튿날은 조용', async () => {
    const r = await health(db, true);
    assert.ok(r.anomalies.includes('fingerprint_changed:core'), JSON.stringify(r.anomalies));
    assert.equal(r.fingerprints_previous.core, 'fp-core');
    await runAt(db, 'send-forecast', '2026-11-09T11:06:00Z'); await runAt(db, 'fetch-suggestions', '2026-11-09T15:06:00Z');
    await runAt(db, 'backfill-ipa', '2026-11-09T15:36:00Z'); await runAt(db, 'analysis-jobs', '2026-11-09T17:46:00Z');
    await db.exec("insert into public.daily_suggestions (date, language, source) values ('2026-11-10','English','x')");
    const next = await health(db, true, '2026-11-09T17:50:00Z');
    assert.ok(!next.anomalies.some((a) => a.startsWith('fingerprint_')), JSON.stringify(next.anomalies));
  });
  await check('지문 함수가 없으면 fingerprint_missing', async () => {
    await db.exec('drop function fsrs_private.manual_contract_hash_live()');
    assert.ok((await health(db, false, '2026-11-09T17:50:00Z')).anomalies.includes('fingerprint_missing:manual'));
  });
  await db.close();
}

{
  const db = await fresh();
  await check('observe_record_cron_run — 잘못된 job은 false · 큰 detail은 잘림 · 90일 지난 줄은 지움', async () => {
    const call = (job, detail = null) => db.query('select public.observe_record_cron_run($1, now(), true, 3, 0, $2::jsonb) r', [job, detail]).then((x) => x.rows[0].r);
    assert.equal(await call('Bad Job'), false);
    assert.equal(await call('fetch-suggestions', JSON.stringify({ big: 'x'.repeat(5000) })), true);
    assert.deepEqual((await db.query("select detail from observe.cron_runs where job='fetch-suggestions'")).rows[0].detail, { truncated: true });
    await db.exec("insert into observe.cron_runs (job, started_at, finished_at, ok) values ('backfill-ipa', now() - interval '100 days', now() - interval '100 days', true)");
    await call('send-forecast');
    assert.equal((await db.query("select count(*)::int n from observe.cron_runs where job='backfill-ipa'")).rows[0].n, 0);
  });
  await check('권한 — anon · authenticated는 두 함수 · 두 표 모두 막힘, service_role은 함수 실행', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select public.observe_daily_health()'), /permission denied/);
      await assert.rejects(db.query("select public.observe_record_cron_run('x-y', now(), true, 0, 0, null)"), /permission denied/);
      await assert.rejects(db.query('select * from observe.cron_runs'), /permission denied/);
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    assert.equal(typeof (await db.query('select public.observe_daily_health() r')).rows[0].r.ok, 'boolean');
    await db.exec('reset role');
  });
  await check('재적용 — 멱등(줄 그대로)', async () => {
    const before = (await db.query('select count(*)::int n from observe.cron_runs')).rows[0].n;
    await db.exec(migration);
    assert.equal((await db.query('select count(*)::int n from observe.cron_runs')).rows[0].n, before);
  });
  await db.exec(rollback);
  await check('복원 — 함수 둘 · 표 둘 없음, error_events는 남음', async () => {
    assert.equal((await db.query("select to_regprocedure('public.observe_daily_health(timestamptz,boolean)') f")).rows[0].f, null);
    assert.equal((await db.query("select to_regclass('observe.cron_runs') t")).rows[0].t, null);
    assert.notEqual((await db.query("select to_regclass('observe.error_events') t")).rows[0].t, null);
  });
  await db.close();
}
{
  const d = new PGlite();
  await check('error_events가 없는 환경 — 42P01(관측 뒤 마이그레이션 사슬이 건너뛴다)', async () => {
    await assert.rejects(d.exec(migration), (e) => e.code === '42P01');
  });
  await d.close();
}
console.log(`observe-daily-health: ${checks} checks passed`);
