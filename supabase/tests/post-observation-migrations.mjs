// Local, disposable PGlite only. This verifier never connects to Supabase (FINGERPRINT-REPIN-002).
//
// 운영 관측 fixture(supabase/tests/fixtures/m09-learning-contracts-20261010.sql — 지문 함수 · 계약 넷 포함) 위에, 관측일 뒤의
// 마이그레이션을 버전 순서대로 적용하며 매번 「FSRS 계약 핀 넷 = 실측」과 「learning_language_capabilities() 모든 언어 ready」를
// 확인한다. 정적 계약(src/lib/__tests__/migrationFingerprintRepin.test.js)이 문장 모양으로 잡는 것을 실제 지문 계산으로 다시 본다 —
// #1504(20261016150000_anon_book_catalog.sql)는 둘 다로 「운영 한국어 학습 꺼짐」이 재현된다.
//
// 이미 운영에 나간 위반은 EXPECTED_BREAKS에 정확한 상태로 적는다(CI 녹색 유지). 그 뒤 마이그레이션이 상태를 되돌리면(재게시)
// 자동으로 통과하고 항목을 지우라고 알린다. 위반 이유(상태)가 적힌 것과 다르거나, 다른 마이그레이션이 깨뜨리면 실패한다.
// node supabase/tests/post-observation-migrations.mjs [후보.sql …]  — 인자로 준 후보 SQL(예: 고칠 재게시 마이그레이션 초안)을 저장소
// 마이그레이션 뒤에 이어 적용해 본다(되돌림 · 자동 전환 확인용). 인자 없이 = CI.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { PGlite } from '@electric-sql/pglite';
import { containsProductionConstants, localConstants, localize } from './lib/production-constants.mjs';
import { A, B, C, seedEdgeActor, seedLearners } from './perf-snapshot-fixture.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const OBSERVED_AFTER = '20261010999999';
const MIGRATIONS = new URL('../migrations/', import.meta.url);
const actor = '00000000-0000-4000-8000-000000000001'; // 합성 로컬 행위자(capability 확인용 — 단어 없음)
// 합성 학습자(perf-snapshot-fixture): A · B(보통 · 아는 단어 · 제외 3종) + C(가장자리 — NFD/NFC · 공백 · 빈 base_form · NULL 언어 ·
// NULL 섞인 retired · 등록 카드 3장). 마이그레이션 자신의 데이터 검사(전 사용자 snapshot 출력 동일 · registry 동치)가 0행이 아니라
// 실제 행 위에서 돌고, 이 검사도 건강한 매 단계에서 「snapshot 출력이 처음과 같다」를 본다.
const LEARNERS = [A, B, C];
/** 학습 동작(snapshot 출력)을 일부러 바꾸는 마이그레이션 — 이유와 함께만. 그 파일 뒤 기준을 새 출력으로 바꾼다. */
const EXPECTED_SNAPSHOT_CHANGES = {};

/**
 * 운영에 이미 나간 위반. state = 그 파일 적용 직후의 정확한 상태. healedBy가 있으면 그 파일이 되돌린 이력이다(되돌림까지 확인).
 * healedBy가 없으면 고칠 마이그레이션을 기다리는 중 — 그 마이그레이션이 들어오면 자동으로 통과하고 healedBy를 채우라고 알린다.
 */
const EXPECTED_BREAKS = {
  '20261016061725_conversation_lobby.sql': {
    ticket: 'CONV-LOBBY-001 — 대화방 FK가 profiles를 참조해 profiles에 내부 트리거가 붙어 activity(→ admission) 지문이 어긋났다(운영 2026-10-16 KST)',
    state: {
      pins: { core: true, manual: true, admission: false, activity: false },
      languages: { Korean: { save: true, review: true, known: true, exclude: true } },
    },
    healedBy: '20261016075000_conversation_lobby_fk_auth_users.sql',
  },
  '20261016150000_anon_book_catalog.sql': {
    ticket: 'KO-CAP-REPIN-001 — reading_materials 정책 anon_book_chapters_hidden 뒤 capability 상수 · FSRS core 재게시',
    state: {
      pins: { core: true, manual: true, admission: true, activity: true },
      languages: { Korean: { save: false, review: false, known: false, exclude: false } },
    },
    healedBy: '20261016191500_korean_capability_repin.sql',
  },
};

/**
 * 마이그레이션이 아니라 docs/sql로 운영에 들어간 변경 — 운영과 같은 순서로 그 자리에서 적용한다(before = 이 버전 이상 파일 앞).
 * 없으면 그 뒤 「운영 본문 md5」를 사전 검사하는 마이그레이션(예: LEVEL-NEW-UNLIMITED-001)이 관측 본문을 만나 거절한다.
 */
const OUT_OF_BAND = [
  { before: '20261016000000', sql: '../../docs/sql/fsrs-anki-v2-policy.sql', ticket: 'REV-SCOPE-R1B-2 — 운영 10-15경 적용 · 10-19 KST 확인' },
];

// 적용해 보지 못하는 마이그레이션 — fixture는 학습 계약 범위만 담는다(대화 · 커뮤니티 등은 없다). 정의되지 않은 대상 오류만
// 「범위 밖 · 건너뜀」으로 보고, 마이그레이션 자신의 검사(RAISE) 등 다른 오류는 실패다.
const OUT_OF_FIXTURE = new Set(['42P01', '42883', '42704', '3F000']);

/**
 * VIEW-WRITE-GRANT-001 동적 판정: 정의자 권한(security_invoker가 true가 아닌) public view에 anon · authenticated 쓰기 권한이 남으면
 * RLS를 거치지 않는 쓰기 길이다. 운영과 같은 Supabase 기본 권한(postgres가 public에 만드는 표 · view → anon · authenticated ALL)을 켜고
 * 매 파일 뒤 본다. 이미 운영에 나간 위반은 고친 파일과 함께만 — 그 파일까지 열려 있어도 되고, 그 뒤에는 닫혀 있어야 한다.
 */
const VIEW_WRITE_KNOWN = {
  '20261016165910_public_profiles_view.sql': {
    ticket: 'PROFILES-PRIVACY-001 ①-hotfix — public_profiles에 anon · authenticated INSERT · UPDATE · DELETE(운영 2026-10-17 KST)',
    views: ['public_profiles'], fixedBy: '20261016170000_public_profiles_view_select_only.sql',
  },
};

const originalTest = await read('./korean-learning-support.mjs');
const marker = 'const modernFixtureSql = ';
const start = originalTest.indexOf(marker) + marker.length;
const end = originalTest.indexOf('\n`;', start);
assert.ok(start >= marker.length && end > start, 'modern fixture source boundary');
const modern = runInNewContext(originalTest.slice(start, end + 2), Object.create(null), { timeout: 1000 });
const fixture = await read('./fixtures/m09-learning-contracts-20261010.sql');

const db = new PGlite();
const queryOne = async sql => (await db.query(sql)).rows[0];
const pins = () => queryOne(`SELECT
 (SELECT contract_hash FROM fsrs_private.settings)=fsrs_private.contract_hash() core,
 (SELECT contract_hash FROM fsrs_private.manual_save_settings)=fsrs_private.manual_contract_hash() manual,
 (SELECT contract_hash FROM fsrs_private.admission_settings)=fsrs_private.admission_contract_hash() admission,
 (SELECT profile_contract_hash FROM fsrs_private.activity_settings)=fsrs_private.activity_profile_hash() activity`);
const languages = async () => {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [actor]);
  return (await queryOne('SELECT public.learning_language_capabilities() value')).value.languages;
};
const state = async () => ({ pins: await pins(), languages: await languages() });
const snapshots = async () => {
  const out = {};
  for (const u of LEARNERS) { const { now, ...rest } = (await queryOne(`SELECT public.fsrs_vocabulary_snapshot('${u}') v`)).v; out[u] = rest; }
  return out;
};
const healthy = s => Object.values(s.pins).every(Boolean)
  && Object.keys(s.languages).length > 0
  && Object.values(s.languages).every(flags => Object.keys(flags).length > 0 && Object.values(flags).every(v => v === true));
const show = s => JSON.stringify(s);

const started = Date.now();
try {
  await db.exec(modern);
  await db.exec(await read('../../docs/sql/korean-learning-support.sql'));
  await db.exec(fixture);
  await db.query('INSERT INTO auth.users(id) VALUES ($1)', [actor]);
  await db.query('INSERT INTO public.profiles(id) VALUES ($1)', [actor]);
  const initial = await state();
  assert.ok(healthy(initial), `관측 fixture가 처음부터 건강하지 않다: ${show(initial)}`);
  // 한국어 행은 capability가 켜져 있어야 넣을 수 있다 — 어떤 마이그레이션도 적용하기 전에 심는다.
  const learnerFixture = { db, as: u => db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [u]) };
  await seedLearners(learnerFixture);
  await seedEdgeActor(learnerFixture);
  let baseline = await snapshots();
  const cards = Object.values(baseline).reduce((n, s) => n + s.registry.length, 0);
  assert.ok(cards >= 20 && Object.values(baseline).every(s => s.registry.length > 0), `합성 학습자 카드가 비었다(${cards})`);
  console.log(`SEED 합성 학습자 ${LEARNERS.length}명 · 카드 ${cards}장`);
  // 운영과 같은 기본 권한 — 관측 뒤 마이그레이션이 만드는 public 표 · view는 anon · authenticated ALL을 받는다(Supabase 기본).
  await db.exec('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role');
  const writableDefinerViews = async () => (await db.query(`SELECT c.relname::text v FROM pg_class c
    WHERE c.relnamespace='public'::regnamespace AND c.relkind='v'
      AND coalesce((SELECT option_value FROM pg_options_to_table(c.reloptions) WHERE option_name='security_invoker'),'false') NOT IN ('true','on','1')
      AND (has_table_privilege('anon',c.oid,'INSERT,UPDATE,DELETE') OR has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE'))
    ORDER BY 1`)).rows.map(r => r.v);
  assert.deepEqual(await writableDefinerViews(), [], '관측 fixture에 이미 쓰기 가능한 정의자 view가 있다');
  const openViews = new Map(); // view → 연 파일

  const candidates = process.argv.slice(2);
  const files = [...(await readdir(MIGRATIONS)).filter(f => f.endsWith('.sql') && f.slice(0, 14) > OBSERVED_AFTER).sort(), ...candidates];
  assert.ok(files.includes('20261016150000_anon_book_catalog.sql'), '대상 마이그레이션 목록(빈 목록 통과 방지)');
  let broken = null; // { file, state }
  const seen = new Set(), resolved = [];
  const outOfBand = [...OUT_OF_BAND];
  for (const file of files) {
    while (outOfBand.length && file.split('/').pop().slice(0, 14) >= outOfBand[0].before) {
      const { sql: path, ticket } = outOfBand.shift();
      await db.exec(await read(path));
      console.log(`OUT-OF-BAND ${path.split('/').pop()} — ${ticket}`);
    }
    const raw = await readFile(candidates.includes(file) ? file : new URL(file, MIGRATIONS), 'utf8');
    // 운영 상태를 상수로 박은 수리 마이그레이션(예: 191500 재게시)은 그 여섯 상수만 같은 순간의 fixture 값으로 바꿔 실행한다.
    const sql = containsProductionConstants(raw) ? localize(raw, await localConstants(db)) : raw;
    if (sql !== raw) console.log(`LOCALIZE ${file} — 운영 상수 여섯을 fixture 지역값으로`);
    try {
      await db.exec('BEGIN');
      await db.exec(sql);
      await db.exec('COMMIT');
    } catch (error) {
      await db.exec('ROLLBACK').catch(() => {});
      if (!OUT_OF_FIXTURE.has(error.code)) throw new Error(`${file}: 적용 실패 ${error.code ?? ''} ${error.message}`);
      console.log(`SKIP ${file} — fixture 밖 대상(${error.code} ${error.message.split('\n')[0]})`);
      continue;
    }
    {
      const name = file.split('/').pop();
      const open = await writableDefinerViews();
      for (const v of open) if (!openViews.has(v)) {
        const known = VIEW_WRITE_KNOWN[name];
        if (!known?.views.includes(v)) throw new Error(`${name}: 정의자 권한 view ${v}에 anon · authenticated 쓰기 권한이 남는다(VIEW-WRITE-GRANT-001)`);
        openViews.set(v, name);
        console.log(`VIEW-WRITE ${name} — ${v} 쓰기 가능(${known.ticket.split(' — ')[0]}) · ${known.fixedBy}가 닫는다`);
      }
      for (const [v, by] of [...openViews]) if (!open.includes(v)) {
        assert.equal(name, VIEW_WRITE_KNOWN[by].fixedBy, `${v}를 닫은 파일이 기록(fixedBy)과 다르다`);
        openViews.delete(v);
        console.log(`VIEW-CLOSE ${name} — ${v} 읽기 전용`);
      }
    }
    const now = await state();
    const expected = EXPECTED_BREAKS[file];
    if (healthy(now)) {
      if (broken) {
        const recorded = EXPECTED_BREAKS[broken.file].healedBy;
        if (recorded) assert.equal(file, recorded, `${broken.file}의 깨짐을 되돌린 파일이 기록(healedBy)과 다르다`);
        else resolved.push({ ...broken, by: file });
        console.log(`HEAL ${file} — ${broken.file}의 깨짐을 되돌렸다`);
      }
      else if (expected) throw new Error(`${file}: EXPECTED_BREAKS에 있지만 적용 뒤 건강하다 — 항목을 지운다(${expected.ticket})`);
      broken = null;
      // 건강한 상태에서는 학습 동작(snapshot 출력)이 처음과 같아야 한다 — 일부러 바꾼 파일만 EXPECTED_SNAPSHOT_CHANGES로.
      const now2 = await snapshots();
      const name = file.split('/').pop();
      if (EXPECTED_SNAPSHOT_CHANGES[name]) { assert.notDeepEqual(now2, baseline, `${name}: EXPECTED_SNAPSHOT_CHANGES에 있지만 출력이 그대로다`); baseline = now2; }
      else assert.deepEqual(now2, baseline, `${name}가 학습자 snapshot 출력을 바꿨다(합성 학습자 ${LEARNERS.length}명)`);
      console.log(`OK   ${file}`);
      continue;
    }
    if (broken) {
      // 이미 깨진 상태 — 다음 마이그레이션은 상태를 바꾸지 않아야 한다(다른 깨짐이 겹치면 이유가 가려진다).
      assert.deepEqual(now, broken.state, `${file}: ${broken.file}로 깨진 상태가 더 바뀌었다 — ${show(broken.state)} → ${show(now)}`);
      console.log(`HOLD ${file} — ${broken.file}의 깨짐 그대로(${EXPECTED_BREAKS[broken.file].ticket.split(' — ')[0]})`);
      continue;
    }
    if (!expected) throw new Error(`${file}가 학습 계약을 깨뜨린다(§4.9-1 재게시 누락): ${show(now)}`);
    assert.deepEqual(now, expected.state, `${file}: 깨짐 이유가 EXPECTED_BREAKS와 다르다(${expected.ticket}) — 기대 ${show(expected.state)} / 실측 ${show(now)}`);
    broken = { file, state: now };
    seen.add(file);
    console.log(`EXPECTED-BREAK ${file} — ${expected.ticket}`);
  }
  for (const [file, entry] of Object.entries(EXPECTED_BREAKS)) {
    assert.ok(seen.has(file), `EXPECTED_BREAKS의 ${file}가 깨짐을 일으키지 않았다(파일이 고쳐졌거나 없어졌다) — 항목을 지운다`);
    if (entry.healedBy) assert.ok(files.includes(entry.healedBy) && broken?.file !== file, `${file}: 기록된 되돌림(${entry.healedBy})이 일어나지 않았다`);
  }
  if (broken) assert.equal(EXPECTED_BREAKS[broken.file].healedBy, undefined, '되돌림이 기록된 깨짐이 끝까지 남았다');
  for (const [v, by] of openViews) assert.ok(!files.includes(VIEW_WRITE_KNOWN[by].fixedBy), `${v}: 고친 파일 ${VIEW_WRITE_KNOWN[by].fixedBy}를 적용했는데 아직 쓰기 가능하다`);
  for (const [v, by] of openViews) console.log(`NOTICE ${v}는 ${by} 뒤 아직 쓰기 가능 — 고칠 파일 ${VIEW_WRITE_KNOWN[by].fixedBy} 대기`);
  for (const r of resolved) console.log(`NOTICE ${r.file}의 깨짐은 ${r.by}가 되돌렸다 — EXPECTED_BREAKS 항목을 지운다(${EXPECTED_BREAKS[r.file]?.ticket})`);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(broken
    ? `PASS(expected failure): 관측 뒤 ${files.length}개 적용 · ${broken.file}로 깨진 상태 그대로(${EXPECTED_BREAKS[broken.file].ticket.split(' — ')[0]}) · ${seconds}s`
    : `PASS: 관측 뒤 ${files.length}개 적용 · FSRS 핀 넷 · 모든 언어 ready · ${seconds}s`);
} catch (error) {
  console.error('FAIL', error.code ?? '', error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
