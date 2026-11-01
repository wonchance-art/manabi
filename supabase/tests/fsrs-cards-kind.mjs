/** Local, disposable PGlite only — never connects to Supabase (CARD-TYPES-001 단계 1).
 * 20261101090000_fsrs_cards_kind: public.fsrs_cards에 vocabulary_id(생성 열 = card_id) · kind('recognition' 기본) 열과 제약만 더한다 —
 * 함수 본문은 그대로, core · admission만 재게시. 운영과 같은 사슬(관측 fixture → 191500 뒤 마이그레이션 → anki-v2 → LEARN-AHEAD까지)에서 시작한다.
 * 증명(실제 SQL 함수 호출 · 합성 학습자):
 *   ① 적용 전에 등록 · 묻기를 한 번 돌려 함수가 이 세션에서 컴파일된 상태로 만든다(운영 연결 풀처럼) · 있던 카드 행(가장자리 학습자 C 3장 + 1장)
 *   ② 적용: 있던 행 = vocabulary_id = card_id · kind = recognition · 행 수 그대로 · snapshot · 목록 출력 그대로 · 함수 본문 그대로 ·
 *      core · admission만 바뀌고 manual · profile · capability 그대로
 *   ③ 같은 세션에서 등록(fsrs_apply_operation enroll) → 새 행 vocabulary_id = card_id · kind = recognition / 학습 카드 묻기 · 보이기 · 채점 그대로
 *   ④ 거절: 같은 단어의 두 번째 단어 → 뜻 카드(PK · 생성 열에 값 쓰기) · 다른 종류 카드(단계 1 CHECK — 단어 id 자리 · 새 uuid 둘 다) ·
 *      목록 밖 종류 · 카드가 있는 단어 삭제(지금과 같은 가드)
 *   ⑤ 재실행 no-op · 일부만 적용된 모양 · 검토하지 않은 반영 함수 위에는 적용하지 않음 · 복원(docs/sql/fsrs-cards-kind-rollback.sql) 뒤
 *      모양 · 게시값이 적용 전과 정확히 같음 · 복원 재실행 no-op · 다시 적용
 *   node supabase/tests/fsrs-cards-kind.mjs
 */
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { read, setup, seedEdgeActor, A, C } from './perf-snapshot-fixture.mjs';
import { introduceFsrsCard } from '../../src/lib/fsrsScheduler.js';
import { beginFsrsAttempt, finishFsrsAttempt, revealFsrsAttempt } from '../../src/lib/fsrsReviewSession.js';

const FILE = '20261101090000_fsrs_cards_kind.sql';
const APPLY = 'public.fsrs_apply_operation(uuid,jsonb)', APPLY_MD5 = '9bf0c8612988174843d69731a953390c';
const OUT_OF_FIXTURE = new Set(['42P01', '42883', '42704', '3F000']);
const migration = await read(`../migrations/${FILE}`), restore = await read('../../docs/sql/fsrs-cards-kind-rollback.sql');
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };

const h = await setup();
const { db, one } = h;
// 운영 순서 — profiles privacy가 요구하는 public_profiles view 둘 → 191500 뒤 마이그레이션(이 파일 전) · anki-v2(docs/sql)는 하루 새 단어 앞.
const PROFILES_VIEW = ['20261016165910_public_profiles_view.sql', '20261016170000_public_profiles_view_select_only.sql'];
const chain = (await readdir(new URL('../migrations/', import.meta.url))).filter(f => f.slice(0, 14) > '20261016191500' && f < FILE && f.endsWith('.sql')).sort();
let ankiV2 = false;
for (const f of [...PROFILES_VIEW, ...chain]) {
  if (!ankiV2 && f >= '20261030050000') { await db.exec(h.localize(await read('../../docs/sql/fsrs-anki-v2-policy.sql'))); ankiV2 = true; }
  try { await db.exec(h.localize(await read(`../migrations/${f}`))); }
  catch (e) { await db.exec('ROLLBACK').catch(() => {}); assert.ok(OUT_OF_FIXTURE.has(e.code), `${f}: ${e.message}`); }
}
assert.ok(ankiV2 && chain.includes('20261101060000_fsrs_learn_ahead.sql'), 'chain reaches LEARN-AHEAD');
await seedEdgeActor(h); // 가장자리 학습자 C — 카드 3장(밀리초 아래 기한 · 중단 시도 · 영수증)

const MIN = 60000, iso = ms => new Date(ms).toISOString();
const pins = async () => { const { ok, core, manual, admission, profile } = await h.pins(); return { ok, core, manual, admission, profile }; };
const operate = async operation => (await one('SELECT public.fsrs_apply_operation($1,$2) r', [A, operation])).r;
const rows = async () => (await db.query('SELECT to_jsonb(f) - ARRAY[\'card\',\'attempt\',\'enrolled_at\'] r FROM public.fsrs_cards f ORDER BY card_id')).rows.map(x => x.r);
const columns = async () => (await db.query(`SELECT attname FROM pg_attribute WHERE attrelid='public.fsrs_cards'::regclass AND attnum>0 AND NOT attisdropped ORDER BY attnum`)).rows.map(x => x.attname);
const outputs = async () => {
  const out = {};
  for (const u of [A, C]) {
    const { now, ...snapshot } = (await one('SELECT public.fsrs_vocabulary_snapshot($1) v', [u])).v;
    out[u] = { snapshot, states: (await one('SELECT public.fsrs_list_states($1) v', [u])).v };
  }
  return out;
};
const fns = async () => (await db.query(`SELECT p.oid::regprocedure::text s, md5(p.prosrc) m, p.proacl::text acl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='fsrs_private' OR (n.nspname='public' AND (p.proname LIKE 'fsrs\\_%' OR p.proname LIKE 'learning\\_%')) ORDER BY 1`)).rows;
const refused = async (promise, pattern) => {
  await assert.rejects(promise, e => { assert.match(`${e.code} ${e.message}`, pattern); return true; });
  await db.exec('ROLLBACK').catch(() => {});
};
let seq = 0;
async function word(createdAt = Date.now() - 10 * MIN) {
  const id = `50000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
  await h.as(A);
  await db.query(`INSERT INTO public.user_vocabulary(id,user_id,word_text,base_form,meaning,language,interval,ease_factor,repetitions,created_at)
    VALUES ($1,$2,$3,$3,'뜻','Chinese',0,0,0,$4)`, [id, A, `종류${seq}`, iso(createdAt)]);
  return id;
}
const enroll = async (id, tag) => operate({ version: 1, id: `enroll-${tag}`, kind: 'enroll', userId: A, cardId: id, expectedRevision: 0,
  nextCard: introduceFsrsCard(iso(Date.now() - 2000), { policyVersion: 'anki-v2' }) });
// 학습 단계 카드(기한 지남) — 묻기 · 보이기 · 채점이 UPDATE … RETURNING * INTO f 길을 탄다.
const learningCard = now => ({ version: 1, engine: 'v5.3.2 using FSRS-6.0', policyVersion: 'anki-v2', timeZone: 'Asia/Seoul', rolloverHour: 4, revision: 0,
  introducedAt: iso(now - 5 * MIN), state: 'Learning', step: 0, reps: 1, lapses: 0, stability: 2.3065, difficulty: 2.118, elapsedDays: 0,
  due: iso(now - MIN), lastReview: iso(now - 2 * MIN), scheduledDays: 0 });
async function review(tag) {
  const now = Date.now(), id = await word(now - 10 * MIN), card = learningCard(now);
  await db.query('INSERT INTO public.fsrs_cards(card_id,user_id,card) VALUES ($1,$2,$3)', [id, A, card]);
  const at = now - 3000;
  const attempt = beginFsrsAttempt(card, { id: `q-${tag}`, userId: A, cardId: id, at: iso(at) });
  await operate({ version: 1, id: `q-${tag}`, kind: 'question', userId: A, cardId: id, expectedRevision: 0, nextAttempt: attempt });
  const revealed = revealFsrsAttempt(attempt, iso(at + 1000));
  await operate({ version: 1, id: `r-${tag}`, kind: 'reveal', userId: A, cardId: id, expectedRevision: 0, nextAttempt: revealed });
  const graded = await operate(finishFsrsAttempt(revealed, 3, { operationId: `g-${tag}`, at: revealed.revealedAt, policyVersion: 'anki-v2' }));
  assert.equal(graded.card.revision, 1);
  assert.equal(graded.cardId, id);
  return id;
}

// ── ① 적용 전
const preEnrolled = await word();
const preReply = await enroll(preEnrolled, 'pre'); // fsrs_apply_operation이 이 세션에서 컴파일된다(카드 행 형 = 옛 모양)
assert.equal(preReply.enrolled, true);
const preReplyKeys = Object.keys(preReply).sort();
await review('pre');
const before = { pins: await pins(), out: await outputs(), fns: await fns(), rows: await rows(), cap: await h.capability(), apply: await h.fnmd5(APPLY) };
await check('before: production chain body (9bf0c861) · no kind columns · cards from the edge learner and A', async () => {
  assert.equal(before.apply, APPLY_MD5);
  assert.equal(before.pins.ok, true);
  assert.deepEqual(await columns(), ['card_id', 'user_id', 'card', 'attempt', 'enrolled_at']);
  assert.equal(before.rows.length, 5);
});

// ── ② 적용
await db.exec(migration);
const applied = await pins();
console.log(`PINS core ${before.pins.core} → ${applied.core} · admission ${before.pins.admission} → ${applied.admission} · manual ${applied.manual} · profile ${applied.profile}`);
await check('applied: existing rows filled vocabulary_id = card_id · kind = recognition (row count unchanged)', async () => {
  const after = await rows();
  assert.equal(after.length, before.rows.length);
  for (const r of after) {
    assert.equal(r.vocabulary_id, r.card_id);
    assert.equal(r.kind, 'recognition');
    assert.ok(before.rows.some(b => b.card_id === r.card_id && b.user_id === r.user_id));
  }
  assert.deepEqual(await columns(), ['card_id', 'user_id', 'card', 'attempt', 'enrolled_at', 'vocabulary_id', 'kind']);
});
await check('applied: learner output (snapshot · list states) and every learning function body unchanged', async () => {
  assert.deepEqual(await outputs(), before.out);
  assert.deepEqual(await fns(), before.fns);
  assert.equal(await h.fnmd5(APPLY), APPLY_MD5);
});
await check('applied: core · admission repinned, manual · profile · Korean capability unchanged', async () => {
  assert.equal(applied.ok, true);
  assert.notEqual(applied.core, before.pins.core, 'core (fsrs_cards columns · constraints · indexes)');
  assert.notEqual(applied.admission, before.pins.admission, 'admission (fsrs_cards triggers — the FK adds RI triggers)');
  assert.deepEqual([applied.manual, applied.profile], [before.pins.manual, before.pins.profile]);
  assert.deepEqual(await h.capability(), before.cap);
  assert.equal(await h.koreanReady(), true);
});

// ── ③ 같은 세션의 등록 · 채점
await check('enroll after the change (same session): the new row is recognition with vocabulary_id = card_id', async () => {
  const id = await word();
  const r = await enroll(id, 'post');
  assert.equal(r.enrolled, true);
  assert.deepEqual(Object.keys(r).sort(), preReplyKeys, 'same reply shape as the enroll before the change');
  const row = (await one('SELECT vocabulary_id, kind FROM public.fsrs_cards WHERE card_id=$1', [id]));
  assert.deepEqual(row, { vocabulary_id: id, kind: 'recognition' });
});
await check('question · reveal · grade after the change: the same path (UPDATE … RETURNING * INTO the card row)', async () => {
  const id = await review('post');
  assert.deepEqual(await one('SELECT vocabulary_id, kind, (card->>\'revision\')::int rev FROM public.fsrs_cards WHERE card_id=$1', [id]), { vocabulary_id: id, kind: 'recognition', rev: 1 });
});

// ── ④ 거절
const insertCard = (cols, vals) => db.query(`INSERT INTO public.fsrs_cards(${cols}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(',')})`, vals);
const card = h.card('2026-10-22T00:00:00Z');
await check('a second recognition card for the same word is refused (one card id per word; vocabulary_id cannot be written)', async () => {
  await refused(insertCard('card_id,user_id,card', [preEnrolled, A, card]), /^23505 .*fsrs_cards_pkey/);
  const other = await word();
  await refused(insertCard('card_id,user_id,card,vocabulary_id', [other, A, card, preEnrolled]), /^428C9 /); // 생성 열
  assert.equal((await one('SELECT count(*)::int n FROM public.fsrs_cards WHERE vocabulary_id=$1', [preEnrolled])).n, 1);
});
await check('stage 1 CHECK: a production / listening card is refused (word id slot or a new uuid)', async () => {
  const free = await word(); // 카드 없는 단어 — 단어 id 자리에 다른 종류가 앉을 수 없다
  await refused(insertCard('card_id,user_id,card,kind', [free, A, card, 'production']), /^23514 .*fsrs_cards_kind_stage1_check/);
  await refused(insertCard('card_id,user_id,card,kind', ['5fffffff-0000-4000-8000-000000000001', A, card, 'listening']), /^23514 .*fsrs_cards_kind_stage1_check/);
  await refused(insertCard('card_id,user_id,card,kind', [free, A, card, 'cloze']), /^23514 .*fsrs_cards_kind_(stage1_)?check/);
  assert.equal((await one('SELECT count(*)::int n FROM public.fsrs_cards WHERE card_id=$1', [free])).n, 0);
});
await check('a word with a card still cannot be deleted (the same guard answers first)', async () => {
  await refused(db.query('DELETE FROM public.user_vocabulary WHERE id=$1', [preEnrolled]), /fsrs_enrolled_card_protected/);
});

// ── ⑤ 재실행 · 거절 · 복원
await check('re-run is a no-op', async () => {
  const shape = await rows();
  await db.exec(migration);
  assert.deepEqual(await pins(), applied);
  assert.deepEqual(await rows(), shape);
});
await check('unreviewed fsrs_apply_operation: the migration refuses (and rolls back)', async () => {
  const tampered = migration.replace(`IS DISTINCT FROM '${APPLY_MD5}'`, "IS DISTINCT FROM 'ffffffffffffffffffffffffffffffff'");
  assert.notEqual(tampered, migration);
  await h.expectFail(tampered, /unreviewed fsrs_apply_operation/);
  assert.deepEqual(await pins(), applied);
});
await check('rollback: shape and pins exactly as before the migration · output unchanged · enroll still works', async () => {
  const out = await outputs();
  await db.exec(restore);
  assert.deepEqual(await columns(), ['card_id', 'user_id', 'card', 'attempt', 'enrolled_at']);
  assert.deepEqual(await pins(), before.pins, 'the same four pins as before the migration');
  assert.deepEqual(await outputs(), out);
  assert.deepEqual(await fns(), before.fns);
  assert.equal((await enroll(await word(), 'rolled-back')).enrolled, true);
  await db.exec(restore); // 되돌린 뒤 다시 실행 = no-op
  assert.deepEqual(await pins(), before.pins);
});
await check('a partly applied shape (kind only, pins republished) is refused by the migration and the rollback', async () => {
  // 지문까지 다시 맞춘 일부 적용 — 계약 검사는 통과하고 모양 검사가 멈춘다(지문이 어긋난 일부 적용은 계약 검사가 먼저 멈춘다).
  const partial = `BEGIN; ALTER TABLE public.fsrs_cards ADD COLUMN kind text NOT NULL DEFAULT 'recognition';
    UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash_live();
    UPDATE fsrs_private.admission_settings SET contract_hash = fsrs_private.admission_contract_hash_live();`;
  await db.exec(partial);
  await assert.rejects(db.exec(migration), e => { assert.match(e.message, /card_kinds: unreviewed state/); return true; });
  await db.exec('ROLLBACK');
  await db.exec(partial);
  await assert.rejects(db.exec(restore), e => { assert.match(e.message, /card_kinds_rollback: unreviewed state/); return true; });
  await db.exec('ROLLBACK');
  await db.exec("BEGIN; ALTER TABLE public.fsrs_cards ADD COLUMN kind text NOT NULL DEFAULT 'recognition';"); // 지문이 어긋난 채
  await assert.rejects(db.exec(migration), e => { assert.match(e.message, /learning_admission_unavailable|already drifted/); return true; });
  await db.exec('ROLLBACK');
  assert.deepEqual(await pins(), before.pins);
  assert.deepEqual(await columns(), ['card_id', 'user_id', 'card', 'attempt', 'enrolled_at']);
});
await check('apply again after rollback lands on the same shape with consistent pins', async () => {
  await db.exec(migration);
  const again = await pins();
  assert.equal(again.ok, true);
  assert.deepEqual(await columns(), ['card_id', 'user_id', 'card', 'attempt', 'enrolled_at', 'vocabulary_id', 'kind']);
  for (const r of await rows()) assert.deepEqual([r.vocabulary_id, r.kind], [r.card_id, 'recognition']);
});
await db.close();
console.log(`fsrs-cards-kind: ${checks} checks passed`);
