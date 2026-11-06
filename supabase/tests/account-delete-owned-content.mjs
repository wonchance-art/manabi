// Local, disposable PGlite only. This verifier never connects to Supabase.
// ACCOUNT-DELETE-002(발매 준비 점검 6a · 6c, 2026-11-06 KST): reading_materials.owner_id가 ON DELETE SET NULL인데
// 작성기 자료 CHECK 3개가 owner_id NOT NULL을 요구한다 → 작성기 자료가 있는 계정은 삭제 전체가 실패했다(운영 43행 · 2명).
// 운영과 같은 사슬(관측 fixture → 191500 뒤 마이그레이션 → … → 20261106160000)에서
// ① 고치기 전(125000 함수만) — 작성기 자료가 있는 계정 삭제가 CHECK(23514)에 막힌다(운영과 같은 실패)
// ② 적용 뒤 — 함수가 공개 아닌 자료를 지우고(작성기 · 일반 비공개) 계정 삭제가 끝까지 간다 · 공개 자료는 owner null로 남는다
//    · 자료에 딸린 단어 · 문맥이 CASCADE로 사라진다 · 다른 계정 자료 · 단어 그대로 · 사용자의 서재 삭제 보호는 그대로
// ③ 다시 불러도 안전 ④ 저장소 목록 = 그 계정 것만(owner · `<uid>/` 경로) ⑤ service_role만 ⑥ 학습 계약 지문 그대로 ⑦ 복원 SQL.
//   node supabase/tests/account-delete-owned-content.mjs
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { read, setup, seedEdgeActor, A, C } from './perf-snapshot-fixture.mjs';

const FILE = '20261106160000_account_delete_owned_content.sql';
const OUT_OF_FIXTURE = new Set(['42P01', '42883', '42704', '3F000']);
const h = await setup();
const { db, one } = h;
try {
  const PROFILES_VIEW = ['20261016165910_public_profiles_view.sql', '20261016170000_public_profiles_view_select_only.sql'];
  const chain = (await readdir(new URL('../migrations/', import.meta.url))).filter(f => f.slice(0, 14) > '20261016191500' && f < FILE && f.endsWith('.sql')).sort();
  let ankiV2 = false, seeded = false;
  for (const f of [...PROFILES_VIEW, ...chain]) {
    if (!ankiV2 && f >= '20261030050000') { await db.exec(h.localize(await read('../../docs/sql/fsrs-anki-v2-policy.sql'))); ankiV2 = true; }
    if (!seeded && f >= '20261101120000') { await seedEdgeActor(h); seeded = true; }
    try { await db.exec(h.localize(await read(`../migrations/${f}`))); }
    catch (e) { await db.exec('ROLLBACK').catch(() => {}); assert.ok(OUT_OF_FIXTURE.has(e.code), `${f}: ${e.message}`); }
  }
  if (!seeded) await seedEdgeActor(h);
  assert.ok(chain.includes('20261101125000_account_delete_learning_records.sql'), 'chain includes ACCOUNT-DELETE-001');
  // db push처럼 로그인 맥락 없이(fixture가 세션에 남긴 sub를 비운다).
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', '', false); RESET ROLE;`);

  // C: 작성기 자료 1(CHECK 대상) · 일반 비공개 1(단어 · 문맥이 딸림) · 공개 1. A: 비공개 1(남아야 한다).
  const material = async (owner, visibility, meta, title) => Number((await one(
    `INSERT INTO public.reading_materials(title, raw_text, processed_json, visibility, owner_id) VALUES ($1, '本文です。', $2::jsonb, $3, $4) RETURNING id`,
    [title, JSON.stringify({ status: 'saved', sequence: [], dictionary: {}, metadata: { language: 'Japanese', ...meta } }), visibility, owner])).id);
  const cComposer = await material(C, 'private', { composer: { version: '1' }, importAttempt: 'acct-del-002' }, 'composer');
  const cPrivate = await material(C, 'private', {}, 'private');
  const cPublic = await material(C, 'public', {}, 'public');
  const aPrivate = await material(A, 'private', {}, 'a-private');
  const vocabCols = (await one(`SELECT string_agg(column_name, ',') c FROM information_schema.columns WHERE table_schema='public' AND table_name='user_vocabulary'`)).c.split(',');
  assert.ok(vocabCols.includes('material_id'), 'user_vocabulary.material_id exists');
  await db.query(`INSERT INTO public.user_vocabulary(user_id, word_text, language, material_id) VALUES ($1, '本文', 'Japanese', $2)`, [C, cPrivate]);
  const count = async (sql, args = []) => Number((await one(`SELECT count(*)::int n FROM ${sql}`, args)).n);
  const keptA = { materials: await count('public.reading_materials WHERE owner_id=$1', [A]), words: await count('public.user_vocabulary WHERE user_id=$1', [A]) };
  assert.ok(keptA.materials > 0 && keptA.words > 0, 'A has materials and words to keep');
  const pins = async () => { const { ok, core, manual, admission, profile } = await h.pins(); return { ok, core, manual, admission, profile }; };
  const before = await pins();
  assert.equal(before.ok, true, 'contracts consistent before');

  // ① 고치기 전: 125000 함수(FSRS만) 뒤 계정 삭제가 작성기 자료 CHECK에 막힌다.
  await db.exec('BEGIN');
  assert.ok((await one('SELECT public.delete_account_learning_records($1) r', [C])).r.cards >= 1, 'C has FSRS cards (125000 path)');
  await assert.rejects(db.query('DELETE FROM auth.users WHERE id=$1', [C]),
    e => e.code === '23514' && /composer_material_is_private/.test(e.message), 'composer material blocks account delete (production failure)');
  await db.exec('ROLLBACK');
  assert.equal(await count('public.reading_materials WHERE owner_id=$1', [C]), 3, 'blocked delete left C intact');

  // 적용.
  await db.exec(h.localize(await read(`../migrations/${FILE}`)));
  assert.deepEqual(await pins(), before, 'learning contract fingerprints unchanged by the migration');

  // ④ 저장소 목록: storage 스키마는 fixture에 없다 — 운영 모양(bucket_id · name · owner)만 세운다.
  await db.exec(`CREATE SCHEMA IF NOT EXISTS storage; CREATE TABLE IF NOT EXISTS storage.objects(id uuid DEFAULT gen_random_uuid(), bucket_id text, name text, owner uuid);
    INSERT INTO storage.objects(bucket_id, name, owner) VALUES
      ('user-pdfs', '${C}/a.pdf', '${C}'), ('material-originals', '${C}/m/1.txt', NULL), ('teaching-board-pages', 'x/${C}.png', '${C}'),
      ('user-pdfs', '${A}/keep.pdf', '${A}'), ('material-originals', 'other/${C}/no.txt', NULL);`);
  assert.deepEqual((await db.query('SELECT * FROM public.account_storage_objects($1)', [C])).rows, [
    { bucket_id: 'material-originals', name: `${C}/m/1.txt` },
    { bucket_id: 'teaching-board-pages', name: `x/${C}.png` },
    { bucket_id: 'user-pdfs', name: `${C}/a.pdf` },
  ], 'storage objects of C only (owner or <uid>/ prefix)');

  // 사용자 역할의 서재 삭제 보호는 그대로(휴지통 경로).
  await db.exec('BEGIN');
  await db.exec(`SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${C}', true);`);
  await assert.rejects(db.query('DELETE FROM public.reading_materials WHERE id=$1', [cPrivate]), /library_use_trash/, 'user delete still goes through trash');
  await db.exec('ROLLBACK');

  // ② 적용 뒤: 함수 → 계정 삭제가 끝까지 간다.
  const r = (await one('SELECT public.delete_account_learning_records($1) r', [C])).r;
  assert.equal(r.materials, 2, 'composer + private material deleted, public kept');
  await db.query('DELETE FROM auth.users WHERE id=$1', [C]);
  assert.equal(await count('public.reading_materials WHERE id = ANY($1)', [[cComposer, cPrivate]]), 0, 'non-public materials gone');
  assert.equal((await one('SELECT owner_id FROM public.reading_materials WHERE id=$1', [cPublic])).owner_id, null, 'public material kept, owner cleared');
  for (const t of ['public.user_vocabulary', 'public.vocabulary_contexts', 'public.fsrs_cards', 'public.review_events']) {
    assert.equal(await count(`${t} WHERE user_id=$1`, [C]), 0, `${t} cleared for the deleted account`);
  }
  assert.equal(await count('public.reading_materials WHERE owner_id IS NULL AND visibility IS DISTINCT FROM $1', ['public']), 0, 'no ownerless private material left by this delete');
  assert.deepEqual({ materials: await count('public.reading_materials WHERE owner_id=$1', [A]), words: await count('public.user_vocabulary WHERE user_id=$1', [A]) }, keptA, 'other account intact');
  assert.equal(await count('public.reading_materials WHERE id=$1', [aPrivate]), 1);

  // ③ 다시 불러도 안전.
  assert.deepEqual((await one('SELECT public.delete_account_learning_records($1) r', [C])).r, { receipts: 0, operations: 0, cards: 0, materials: 0 });
  // ⑤ 실행권은 service_role만.
  const priv = await one(`SELECT has_function_privilege('anon','public.delete_account_learning_records(uuid)','EXECUTE') a,
    has_function_privilege('authenticated','public.delete_account_learning_records(uuid)','EXECUTE') b,
    has_function_privilege('anon','public.account_storage_objects(uuid)','EXECUTE') c,
    has_function_privilege('authenticated','public.account_storage_objects(uuid)','EXECUTE') d`);
  assert.deepEqual({ ...priv }, { a: false, b: false, c: false, d: false });
  // ⑥ 지문 그대로(삭제 뒤에도).
  assert.deepEqual(await pins(), before, 'learning contract fingerprints unchanged after delete');
  // ⑦ 복원 SQL — 125000 본문으로(반환 칸 셋) · 저장소 함수 없음.
  await db.exec(await read('../../docs/sql/account-delete-owned-content-20261106-rollback.sql'));
  assert.deepEqual((await one('SELECT public.delete_account_learning_records($1) r', [C])).r, { receipts: 0, operations: 0, cards: 0 });
  assert.equal((await one(`SELECT to_regprocedure('public.account_storage_objects(uuid)') f`)).f, null);
  assert.deepEqual(await pins(), before, 'contracts unchanged after rollback');
  console.log('PASS: composer material blocked account delete before; after — non-public materials deleted, account delete completes, public kept (owner null), words/contexts/FSRS cleared, other account intact, user trash guard intact; idempotent; storage list scoped; service_role only; contracts unchanged; rollback restores 125000.');
} catch (error) {
  console.error(error.code ?? 'ERROR', error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
