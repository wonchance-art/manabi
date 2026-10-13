// AD-R3 PR④ docs/sql/segment-rules.sql · rollback 검수. 일회용 PGlite만 쓴다 — 운영 연결 · 계정 상태를 읽지 않는다.
// M09 운영 관측 카탈로그(learning-contract-catalog.mjs와 같은 조립) 위에서:
// ① 적용 · 롤백 · 재적용 전후 Korean ready + FSRS 계약 넷 + fsrs_vocabulary_snapshot + 보존 검사(READ ONLY) 결과가 같다
//    (아키텍처 §4.9-1 지문 철사를 건드리지 않는다는 실측).
// ② RLS: 본인 규칙만 읽고 쓴다 · 공유 규칙은 인증 사용자 읽기 전용(쓰기는 service_role = 관리자 라우트) · anon 0.
// ③ CHECK · UNIQUE · 계정 삭제 cascade / SET NULL.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { PGlite } from '@electric-sql/pglite';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const originalTest = await read('./korean-learning-support.mjs');
const marker = 'const modernFixtureSql = ';
const start = originalTest.indexOf(marker) + marker.length;
const end = originalTest.indexOf('\n`;', start);
assert.ok(start >= marker.length && end > start, 'modern fixture source boundary');
const modern = runInNewContext(originalTest.slice(start, end + 2), Object.create(null), { timeout: 1000 });
const fixture = await read('./fixtures/m09-learning-contracts-20261010.sql');
const apply = await read('../../docs/sql/segment-rules.sql');
const rollback = await read('../../docs/sql/segment-rules-rollback.sql');
const preservation = await read('../../docs/sql/segment-rules-preservation-readonly.sql');

const db = new PGlite();
const a = '00000000-0000-4000-8000-0000000000a1'; // 합성 로컬 계정
const b = '00000000-0000-4000-8000-0000000000b2';
const rows = async (sql, p = []) => (await db.query(sql, p)).rows;
const one = async (sql, p = []) => (await rows(sql, p))[0];
let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
async function as(role, id = '') {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
  if (role) await db.exec(`SET ROLE ${role}`);
}
const pins = () => one(`SELECT
 (SELECT contract_hash FROM fsrs_private.settings)=fsrs_private.contract_hash() core,
 (SELECT contract_hash FROM fsrs_private.manual_save_settings)=fsrs_private.manual_contract_hash() manual,
 (SELECT contract_hash FROM fsrs_private.admission_settings)=fsrs_private.admission_contract_hash() admission,
 (SELECT profile_contract_hash FROM fsrs_private.activity_settings)=fsrs_private.activity_profile_hash() activity`);
const korean = async () => {
  await as(null, a); // capability RPC는 로그인 사용자 기준이다
  const value = (await one('SELECT public.learning_language_capabilities() value')).value.languages.Korean;
  await as(null);
  return value;
};
const snapshot = async () => {
  await as(null, a);
  const { now: _now, ...rest } = (await one('SELECT public.fsrs_vocabulary_snapshot($1) value', [a])).value;
  await as(null);
  return rest;
};
// 보존 검사 SQL을 문장별로 그대로 돌려 결과 묶음을 비교한다(READ ONLY 트랜잭션 안).
const preserved = async () => {
  await as(null);
  const results = await db.exec(preservation);
  // 마지막 결과(새 표 이름)는 적용 여부를 보이는 줄이라 비교에서 뺀다.
  return JSON.stringify(results.filter(r => r.fields.length).map(r => r.rows).slice(0, 2));
};
const tables = async () => one("SELECT to_regclass('public.user_segment_rules')::text u, to_regclass('public.shared_segment_rules')::text s");
const ALL_PINS = { core: true, manual: true, admission: true, activity: true };
const ready = { save: true, review: true, known: true, exclude: true };

try {
  await db.exec(modern);
  await db.exec(await read('../../docs/sql/korean-learning-support.sql'));
  await db.exec(fixture);
  // 운영에만 있는 공유 사전 표(관측 카탈로그 밖)는 보존 검사 SQL을 돌릴 수 있게 빈 대역만 둔다.
  await db.exec('CREATE TABLE public.morpheme_dictionary(id bigint)');
  await db.query('INSERT INTO auth.users(id) VALUES ($1),($2)', [a, b]);
  await db.query('INSERT INTO public.profiles(id) VALUES ($1),($2)', [a, b]);
  await db.query("INSERT INTO public.reading_materials(id,owner_id,title,raw_text,processed_json) VALUES (41,$1,'자료','运动员的身体素质非常好。','{\"sequence\":[]}')", [a]);
  assert.deepEqual(await pins(), ALL_PINS);
  assert.deepEqual(await korean(), ready);
  const before = { snap: await snapshot(), kept: await preserved() };

  await check('reading_materials.id는 bigint(규칙 표의 source_material_id와 같은 타입)', async () => {
    const t = await one("SELECT format_type(atttypid, atttypmod) t FROM pg_attribute WHERE attrelid='public.reading_materials'::regclass AND attname='id'");
    assert.equal(t.t, 'bigint');
  });

  await db.exec(apply);
  await check('적용 뒤 Korean ready · FSRS 계약 넷 · snapshot · 보존 검사가 같다', async () => {
    assert.deepEqual(await pins(), ALL_PINS);
    assert.deepEqual(await korean(), ready);
    assert.deepEqual(await snapshot(), before.snap);
    assert.equal(await preserved(), before.kept);
    assert.deepEqual(await tables(), { u: 'user_segment_rules', s: 'shared_segment_rules' });
    const col = await one("SELECT format_type(atttypid, atttypmod) t FROM pg_attribute WHERE attrelid='public.user_segment_rules'::regclass AND attname='source_material_id'");
    assert.equal(col.t, 'bigint');
    // reading_materials로 들어오는 외래 키 하나(ON DELETE SET NULL)는 위 지문 · snapshot을 바꾸지 않는다.
    assert.equal((await one("SELECT count(*)::int n FROM pg_constraint WHERE confrelid='public.reading_materials'::regclass AND conrelid='public.user_segment_rules'::regclass AND confdeltype='n'")).n, 1);
  });

  await check('본인 규칙만 쓰고 읽는다(RLS) · 다른 사람 행 위조 거부', async () => {
    await as('authenticated', a);
    await db.query("INSERT INTO public.user_segment_rules(user_id,language,surface,cuts,source_material_id) VALUES ($1,'Chinese','身体素质','{}',41)", [a]);
    await db.query("INSERT INTO public.user_segment_rules(user_id,language,surface,cuts) VALUES ($1,'Chinese','王先生','{1}')", [a]);
    await assert.rejects(db.query("INSERT INTO public.user_segment_rules(user_id,language,surface) VALUES ($1,'Chinese','个人')", [b]), /row-level security/);
    await as('authenticated', b);
    await db.query("INSERT INTO public.user_segment_rules(user_id,language,surface) VALUES ($1,'English','pick up')", [b]);
    assert.deepEqual((await rows('SELECT surface FROM public.user_segment_rules ORDER BY surface')).map(r => r.surface), ['pick up']);
    const touched = await db.query("UPDATE public.user_segment_rules SET cuts='{2}' WHERE surface='身体素质'");
    assert.equal(touched.affectedRows, 0);
    const removed = await db.query("DELETE FROM public.user_segment_rules WHERE surface='王先生'");
    assert.equal(removed.affectedRows, 0);
    await as('authenticated', a);
    assert.equal((await rows('SELECT * FROM public.user_segment_rules')).length, 2);
    await db.query("UPDATE public.user_segment_rules SET cuts='{2}', updated_at=now() WHERE surface='身体素质'");
    await db.query("UPDATE public.user_segment_rules SET cuts='{}' WHERE surface='身体素质'");
  });

  await check('공유 규칙: 인증 사용자 읽기만 · 쓰기는 service_role(관리자 라우트) · anon 0', async () => {
    await as('service_role');
    await db.query("INSERT INTO public.shared_segment_rules(language,surface,cuts,created_by,note) VALUES ('Chinese','不客气','{}',$1,'운영 교정')", [a]);
    await as('authenticated', b);
    assert.equal((await rows('SELECT surface FROM public.shared_segment_rules'))[0].surface, '不客气');
    await assert.rejects(db.query("INSERT INTO public.shared_segment_rules(language,surface) VALUES ('Chinese','那时候')"), /permission denied/);
    await assert.rejects(db.query("UPDATE public.shared_segment_rules SET cuts='{1}'"), /permission denied/);
    await assert.rejects(db.query('DELETE FROM public.shared_segment_rules'), /permission denied/);
    await as('anon');
    await assert.rejects(db.query('SELECT * FROM public.shared_segment_rules'), /permission denied/);
    await assert.rejects(db.query('SELECT * FROM public.user_segment_rules'), /permission denied/);
  });

  await check('CHECK · UNIQUE: 공백 · 길이 · 언어 · null 칼선 · 중복', async () => {
    await as('authenticated', a);
    const bad = [
      ["'Chinese',' 身体'", 'surface 앞 공백'], ["'Chinese','身'", '1글자'], ["'Korean','도서관'", '한국어'],
      [`'Chinese','${'字'.repeat(41)}'`, '41글자'],
    ];
    for (const [values, why] of bad) {
      await assert.rejects(db.query(`INSERT INTO public.user_segment_rules(user_id,language,surface) VALUES ($1,${values})`, [a]), /check constraint/, why);
    }
    await assert.rejects(db.query("INSERT INTO public.user_segment_rules(user_id,language,surface,cuts) VALUES ($1,'Chinese','那时候',ARRAY[1,NULL]::int[])", [a]), /check constraint/);
    await assert.rejects(db.query("INSERT INTO public.user_segment_rules(user_id,language,surface) VALUES ($1,'Chinese','身体素质')", [a]), /duplicate key/);
    // 화면 쓰기 경로(upsert on conflict)는 같은 꼴의 칼선만 바꾼다.
    await db.query("INSERT INTO public.user_segment_rules(user_id,language,surface,cuts) VALUES ($1,'Chinese','身体素质','{2}') ON CONFLICT (user_id,language,surface) DO UPDATE SET cuts=EXCLUDED.cuts, updated_at=now()", [a]);
    assert.deepEqual((await one("SELECT cuts FROM public.user_segment_rules WHERE surface='身体素质'")).cuts, [2]);
  });

  await check('규칙 쓰기는 학습 기록 · 지문을 바꾸지 않는다', async () => {
    assert.equal(await preserved(), before.kept);
    assert.deepEqual(await pins(), ALL_PINS);
    assert.deepEqual(await snapshot(), before.snap);
  });

  await check('출처 자료가 지워져도 규칙은 남는다(source_material_id만 NULL)', async () => {
    await as(null);
    await db.exec('BEGIN');
    await db.query('DELETE FROM public.reading_materials WHERE id=41');
    const kept = await one("SELECT source_material_id, cuts FROM public.user_segment_rules WHERE surface='身体素质'");
    assert.equal(kept.source_material_id, null);
    assert.deepEqual(kept.cuts, [2]);
    await db.exec('ROLLBACK');
  });

  await check('롤백: 두 표만 사라지고 지문 · snapshot · 보존 검사가 같다 · 두 번 실행해도 안전', async () => {
    await as(null);
    await db.exec(rollback);
    await db.exec(rollback);
    assert.deepEqual(await tables(), { u: null, s: null });
    assert.deepEqual(await pins(), ALL_PINS);
    assert.deepEqual(await korean(), ready);
    assert.deepEqual(await snapshot(), before.snap);
    assert.equal(await preserved(), before.kept);
  });

  await check('복원 경로: 재적용 뒤 같은 상태 · 계정 삭제는 본인 규칙 cascade · 공유 규칙 작성자는 NULL', async () => {
    await db.exec(apply);
    assert.deepEqual(await pins(), ALL_PINS);
    assert.deepEqual(await korean(), ready);
    await as('authenticated', b);
    await db.query("INSERT INTO public.user_segment_rules(user_id,language,surface) VALUES ($1,'Japanese','天気予報')", [b]);
    await as('service_role');
    await db.query("INSERT INTO public.shared_segment_rules(language,surface,created_by) VALUES ('Japanese','映画館',$1)", [b]);
    await as(null);
    await db.query('DELETE FROM public.fsrs_cards WHERE user_id=$1', [b]);
    await db.query('DELETE FROM public.profiles WHERE id=$1', [b]);
    await db.query('DELETE FROM auth.users WHERE id=$1', [b]);
    assert.equal((await one('SELECT count(*)::int n FROM public.user_segment_rules WHERE user_id=$1', [b])).n, 0);
    assert.equal((await one("SELECT created_by FROM public.shared_segment_rules WHERE surface='映画館'")).created_by, null);
    await db.exec(rollback);
  });

  console.log(`PASS: ${checks} segment-rules checks (apply/rollback/reapply on M09 catalog).`);
} catch (error) {
  console.error(error.code ?? 'ERROR', error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
