// Local, disposable PGlite only. This verifier never connects to Supabase.
// REV-SCOPE-R1B-2: 학습 단계 정책 anki-v2(1분 · 10분) SQL을 운영 정의(M09 fixture) 위에서 확인한다.
// ① 적용 전에는 anki-v2 카드가 막힌다(SQL 손질이 필요한 이유) ② 적용 뒤 네 지문 고정 · 알리는 정책 anki-v2 ·
// 기존 anki-seconds-v1 카드 유효 수 그대로 · 예전 카드가 다음 채점에 같은 단계로 anki-v2로 넘어감 · 직접 담기 1분 ·
// 1분 미만 New 카드 거절 ③ 복원: anki-v2 카드가 있으면 검사는 두고 알리는 정책만, 없으면 관찰본 본문 그대로.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { PGlite } from '@electric-sql/pglite';
import { introduceFsrsCard, scheduleFsrsReview } from '../../src/lib/fsrsScheduler.js';
import { beginFsrsAttempt, finishFsrsAttempt, revealFsrsAttempt } from '../../src/lib/fsrsReviewSession.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const originalTest = await read('./korean-learning-support.mjs');
const marker = 'const modernFixtureSql = ';
const start = originalTest.indexOf(marker) + marker.length;
const end = originalTest.indexOf('\n`;', start);
assert.ok(start >= marker.length && end > start, 'modern fixture source boundary');
const modern = runInNewContext(originalTest.slice(start, end + 2), Object.create(null), { timeout: 1000 });
const fixture = await read('./fixtures/m09-learning-contracts-20261010.sql');
const apply = await read('../../docs/sql/fsrs-anki-v2-policy.sql');
const rollback = await read('../../docs/sql/fsrs-anki-v2-policy-rollback.sql');
const observed = {
  'fsrs_private.valid_card(jsonb)': '9a00ba46e140f8f89454655bf6c44bd3',
  'public.fsrs_apply_operation(uuid,jsonb)': '7ce546f1abdc3aa0023e7fe30cc986f7',
  'public.fsrs_save_manual_vocabulary(uuid,jsonb,jsonb)': '664f815988ddb3171a24d0784c1382d9',
  'public.fsrs_capabilities()': '541fd0626640eff4b9a75ffd19715c5b',
};

const actor = '00000000-0000-4000-8000-000000000001'; // Synthetic local actor.
const ids = { New: '00000000-0000-4000-8000-0000000000a1', Learning: '00000000-0000-4000-8000-0000000000a2',
  Review: '00000000-0000-4000-8000-0000000000a3', Relearning: '00000000-0000-4000-8000-0000000000a4' };
const manualId = '00000000-0000-4000-8000-0000000000b1';
const late = '00000000-0000-4000-8000-0000000000b2';
const iso = ms => new Date(ms).toISOString();

async function install() {
  const db = new PGlite();
  await db.exec(modern);
  await db.exec(await read('../../docs/sql/korean-learning-support.sql'));
  await db.exec(fixture);
  await db.query('INSERT INTO auth.users(id) VALUES ($1)', [actor]);
  await db.query('INSERT INTO public.profiles(id) VALUES ($1)', [actor]);
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [actor]);
  return db;
}
const one = async (db, sql, args) => (await db.query(sql, args)).rows[0];
const pins = db => one(db, `SELECT
 (SELECT contract_hash FROM fsrs_private.settings)=fsrs_private.contract_hash() core,
 (SELECT contract_hash FROM fsrs_private.manual_save_settings)=fsrs_private.manual_contract_hash() manual,
 (SELECT contract_hash FROM fsrs_private.admission_settings)=fsrs_private.admission_contract_hash() admission,
 (SELECT profile_contract_hash FROM fsrs_private.activity_settings)=fsrs_private.activity_profile_hash() activity`);
const allPinned = { core: true, manual: true, admission: true, activity: true };
const policy = async db => (await one(db, 'SELECT public.fsrs_capabilities() value')).value.policyVersion;
const valid = async (db, card) => (await one(db, 'SELECT fsrs_private.valid_card($1) ok', [card])).ok;
const validCount = async db => (await one(db, 'SELECT count(*)::int n FROM public.fsrs_cards WHERE fsrs_private.valid_card(card)')).n;
const bodies = async db => Object.fromEntries(await Promise.all(Object.keys(observed).map(async signature =>
  [signature, (await one(db, 'SELECT md5(prosrc) md5 FROM pg_proc WHERE oid=to_regprocedure($1)', [signature])).md5])));
const operate = (db, operation) => db.query('SELECT public.fsrs_apply_operation($1,$2) result', [actor, operation]);

// 예전 정책 카드 네 상태 — 소개 1시간 전, 학습 · 복습 · 재학습은 실제 채점으로 만든다.
async function seedLegacyCards(db) {
  const intro = Date.now() - 3600000;
  const fresh = introduceFsrsCard(iso(intro));
  const learning = scheduleFsrsReview(fresh, 3, fresh.due).card;
  const review = scheduleFsrsReview(learning, 3, learning.due).card;
  const relearning = scheduleFsrsReview(review, 1, review.due).card;
  const cards = { New: fresh, Learning: learning, Review: review, Relearning: relearning };
  for (const [state, card] of Object.entries(cards)) {
    assert.equal(card.state, state);
    await db.query(`INSERT INTO public.user_vocabulary(id,user_id,word_text,base_form,meaning,language,interval,ease_factor,repetitions,created_at)
      VALUES ($1,$2,$3,$3,'뜻','Japanese',0,0,0,$4)`, [ids[state], actor, `語${state}`, iso(intro)]);
    await db.query('INSERT INTO public.fsrs_cards(card_id,user_id,card) VALUES ($1,$2,$3)', [ids[state], actor, card]);
  }
  return cards;
}

// 학습 중 예전 카드를 서버와 같은 방식(질문 → 정답 보기 → 채점)으로 채점한다.
async function gradeLearning(db, card, policyVersion, rating) {
  const at = Date.now() - 20000;
  const base = { version: 1, userId: actor, cardId: ids.Learning };
  const attempt = beginFsrsAttempt(card, { id: `q-${policyVersion}`, userId: actor, cardId: ids.Learning, at: iso(at) });
  await operate(db, { ...base, id: attempt.id, kind: 'question', expectedRevision: card.revision, nextAttempt: attempt });
  const revealed = revealFsrsAttempt(attempt, iso(at + 2000));
  await operate(db, { ...base, id: `r-${policyVersion}`, kind: 'reveal', expectedRevision: card.revision, nextAttempt: revealed });
  return operate(db, finishFsrsAttempt(revealed, rating, { operationId: `g-${policyVersion}`, at: revealed.revealedAt, policyVersion }));
}

function manualSave(db, cardId, word, initialCard) {
  return db.query('SELECT public.fsrs_save_manual_vocabulary($1,$2,$3) result', [actor,
    { action: 'save', accountId: actor, operationId: `save-${cardId}`, cardId,
      vocabulary: { word_text: word, base_form: word, meaning: '뜻', furigana: '', pos: '', language: 'Japanese' } }, initialCard]);
}

let db;
try {
  db = await install();
  assert.deepEqual(await pins(db), allPinned);
  assert.deepEqual(await bodies(db), observed);
  assert.equal(await policy(db), 'anki-seconds-v1');
  const cards = await seedLegacyCards(db);
  assert.equal(await validCount(db), 4);

  // ① 적용 전: anki-v2 카드는 무효, 예전 카드를 anki-v2로 넘기는 채점은 거절된다.
  const introNow = Date.now() - 120000;
  assert.equal(await valid(db, introduceFsrsCard(iso(introNow), { policyVersion: 'anki-v2' })), false);
  await db.exec('BEGIN');
  await assert.rejects(gradeLearning(db, cards.Learning, 'anki-v2', 1), error => error.message === 'invalid_fsrs_transition');
  await db.exec('ROLLBACK');

  // ② 적용
  await db.exec(apply);
  assert.deepEqual(await pins(db), allPinned);
  assert.equal(await policy(db), 'anki-v2');
  assert.equal(await validCount(db), 4, '기존 anki-seconds-v1 카드는 하나도 무효가 되지 않는다');
  const v2New = introduceFsrsCard(iso(introNow), { policyVersion: 'anki-v2' });
  assert.equal(await valid(db, v2New), true);
  assert.equal(await valid(db, { ...v2New, due: iso(introNow + 30000) }), false, 'anki-v2 New는 1분 미만 대기를 받지 않는다');
  assert.equal(await valid(db, { ...v2New, policyVersion: 'future-policy' }), false);
  assert.equal(await valid(db, introduceFsrsCard(iso(introNow))), true, '배포가 섞인 사이 예전 정책 New 카드도 받는다');

  // 예전 학습 카드 → 다음 채점에 같은 단계 순번으로 anki-v2(다시 = 학습 0단계 · 1분)
  const graded = (await gradeLearning(db, cards.Learning, 'anki-v2', 1)).rows[0].result.card;
  assert.equal(graded.policyVersion, 'anki-v2');
  assert.equal(graded.state, 'Learning');
  assert.equal(graded.step, 0);
  assert.equal(Date.parse(graded.due) - Date.parse(graded.lastReview), 60000);

  // 직접 담기: anki-v2 = 소개 + 1분. 30초 대기 anki-v2 카드는 거절.
  const saved = (await manualSave(db, manualId, '直接', v2New)).rows[0].result;
  assert.equal(saved.state.card.policyVersion, 'anki-v2');
  assert.equal(Date.parse(saved.state.card.due) - Date.parse(saved.state.card.introducedAt), 60000);
  await assert.rejects(manualSave(db, late, '拒否', { ...introduceFsrsCard(iso(introNow), { policyVersion: 'anki-v2' }), due: iso(introNow + 30000) }),
    error => error.message === 'fsrs_invalid_initial_card');
  assert.equal(await validCount(db), 5);
  await assert.rejects(db.exec(apply), error => /anki_v2_unexpected_definition/.test(error.message), '두 번 적용하지 않는다');
  await db.exec('ROLLBACK');

  // ③-1 복원(anki-v2 카드가 있음): 알리는 정책만 되돌리고 두 정책 검사는 둔다 — 카드가 무효로 빠지지 않는다.
  await db.exec(rollback);
  assert.deepEqual(await pins(db), allPinned);
  assert.equal(await policy(db), 'anki-seconds-v1');
  assert.equal(await validCount(db), 5);
  await db.close();

  // ③-2 복원(anki-v2 카드 없음): M09 관찰본 본문 그대로.
  db = await install();
  await db.exec(apply);
  assert.notDeepEqual(await bodies(db), observed);
  await db.exec(rollback);
  assert.deepEqual(await bodies(db), observed);
  assert.deepEqual(await pins(db), allPinned);
  assert.equal(await policy(db), 'anki-seconds-v1');
  console.log('PASS: anki-v2 blocked before / four pins + 4 legacy cards valid + v1→v2 step carry-over + manual 60s after / rollback keeps v2 cards valid, restores exact bodies when none.');
} catch (error) {
  console.error(error.code ?? 'ERROR', error.message);
  process.exitCode = 1;
} finally {
  await db?.close();
}
