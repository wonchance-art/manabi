// Local, disposable PGlite only. This verifier never connects to Supabase.
// FSRS-ANKI-R2 (c): learn-ahead SQL을 운영 정의(M09 fixture + anki-v2 SQL) 위에서 확인한다.
// ① 적용 전: 기한 전 학습 카드 질문은 fsrs_card_not_due ② 적용 뒤: 네 지문 고정 · learnAheadSeconds 1200 ·
// 학습 카드는 기한 20분 전부터 질문 → 정답 보기 → 채점 · 중단 뒤 30초 대기는 그대로 · 복습 · 새 카드는 기한까지 ·
// 기존 카드 유효 수 그대로 · 두 번 적용 거절 ③ 복원: 적용 전 본문 그대로 · 앞당겨 채점한 카드도 유효.
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
const ankiV2 = await read('../../docs/sql/fsrs-anki-v2-policy.sql');
const apply = await read('../../docs/sql/fsrs-learn-ahead.sql');
const rollback = await read('../../docs/sql/fsrs-learn-ahead-rollback.sql');
// anki-v2 적용 뒤 본문(이 SQL의 적용 전 기준).
const observed = {
  'public.fsrs_apply_operation(uuid,jsonb)': '0a1a8c9922c1d9fbbdbb9621cd9634f8',
  'public.fsrs_capabilities()': 'bec668cbc7d88bcf2130278fd2469c13',
  'fsrs_private.next_question_at(uuid,uuid)': 'e67483ca4237e6965c7f0b47121d14de',
};

const actor = '00000000-0000-4000-8000-000000000001'; // Synthetic local actor.
const ids = { learning: '00000000-0000-4000-8000-0000000000c1', relearning: '00000000-0000-4000-8000-0000000000c2',
  review: '00000000-0000-4000-8000-0000000000c3', fresh: '00000000-0000-4000-8000-0000000000c4' };
const iso = ms => new Date(ms).toISOString();
const v2 = { policyVersion: 'anki-v2' };

async function install() {
  const db = new PGlite();
  await db.exec(modern);
  await db.exec(await read('../../docs/sql/korean-learning-support.sql'));
  await db.exec(fixture);
  await db.exec(ankiV2);
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
const capabilities = async db => (await one(db, 'SELECT public.fsrs_capabilities() value')).value;
const validCount = async db => (await one(db, 'SELECT count(*)::int n FROM public.fsrs_cards WHERE fsrs_private.valid_card(card)')).n;
const bodies = async db => Object.fromEntries(await Promise.all(Object.keys(observed).map(async signature =>
  [signature, (await one(db, 'SELECT md5(prosrc) md5 FROM pg_proc WHERE oid=to_regprocedure($1)', [signature])).md5])));
const operate = (db, operation) => db.query('SELECT public.fsrs_apply_operation($1,$2) result', [actor, operation]);
const stored = async (db, cardId) => (await one(db, 'SELECT card FROM public.fsrs_cards WHERE card_id=$1', [cardId])).card;

// 실제 채점으로 만든 카드 — 학습(기한 5분 뒤) · 재학습(기한 5분 뒤) · 복습(기한 며칠 뒤) · 새 카드(기한 1분 뒤).
async function seed(db) {
  const now = Date.now(), intro = now - 200 * 86400000;
  const learning = scheduleFsrsReview(introduceFsrsCard(iso(now - 6 * 60000), v2), 3, iso(now - 5 * 60000), v2).card;
  const first = scheduleFsrsReview(introduceFsrsCard(iso(intro), v2), 4, iso(intro + 60000), v2).card;
  const graduated = scheduleFsrsReview(first, 3, first.due, v2).card;
  assert.ok(Date.parse(graduated.due) < now - 5 * 60000, 'review card is due before its lapse');
  const relearning = scheduleFsrsReview(graduated, 1, iso(now - 5 * 60000), v2).card;
  const review = scheduleFsrsReview(introduceFsrsCard(iso(now - 120000), v2), 4, iso(now - 60000), v2).card;
  const fresh = introduceFsrsCard(iso(now - 1000), v2);
  const cards = { learning, relearning, review, fresh };
  assert.deepEqual(Object.values(cards).map(card => card.state), ['Learning', 'Relearning', 'Review', 'New']);
  for (const [name, card] of Object.entries(cards)) {
    assert.ok(Date.parse(card.due) > now, `${name} is not yet due`);
    await db.query(`INSERT INTO public.user_vocabulary(id,user_id,word_text,base_form,meaning,language,interval,ease_factor,repetitions,created_at)
      VALUES ($1,$2,$3,$3,'뜻','Japanese',0,0,0,$4)`, [ids[name], actor, `語${name}`, iso(intro)]);
    await db.query('INSERT INTO public.fsrs_cards(card_id,user_id,card) VALUES ($1,$2,$3)', [ids[name], actor, card]);
  }
  return cards;
}

const base = cardId => ({ version: 1, userId: actor, cardId });
async function question(db, name, card, tag) {
  const at = Date.now();
  const attempt = beginFsrsAttempt(card, { id: `q-${tag}`, userId: actor, cardId: ids[name], at: iso(at) });
  await operate(db, { ...base(ids[name]), id: attempt.id, kind: 'question', expectedRevision: card.revision, nextAttempt: attempt });
  return attempt;
}
async function answer(db, name, card, tag, rating) {
  const attempt = await question(db, name, card, tag);
  const revealed = revealFsrsAttempt(attempt, iso(Date.parse(attempt.questionAt) + 1));
  await operate(db, { ...base(ids[name]), id: `r-${tag}`, kind: 'reveal', expectedRevision: card.revision, nextAttempt: revealed });
  return (await operate(db, finishFsrsAttempt(revealed, rating, { operationId: `g-${tag}`, at: revealed.revealedAt, ...v2 }))).rows[0].result.card;
}
const notDue = error => error.message === 'fsrs_card_not_due';
async function rejectsInside(db, work, check) {
  await db.exec('BEGIN');
  await assert.rejects(work(), check);
  await db.exec('ROLLBACK');
}

let db;
try {
  db = await install();
  assert.deepEqual(await pins(db), allPinned);
  assert.deepEqual(await bodies(db), observed);
  assert.equal((await capabilities(db)).learnAheadSeconds, undefined);
  const cards = await seed(db);
  assert.equal(await validCount(db), 4);

  // ① 적용 전: 기한 5분 전 학습 카드도 묻지 못한다(이 SQL이 필요한 이유).
  await rejectsInside(db, () => question(db, 'learning', cards.learning, 'before'), notDue);

  // ② 적용
  await db.exec(apply);
  assert.deepEqual(await pins(db), allPinned);
  assert.equal((await capabilities(db)).learnAheadSeconds, 1200);
  assert.equal((await capabilities(db)).policyVersion, 'anki-v2');
  assert.equal(await validCount(db), 4, '기존 카드는 하나도 무효가 되지 않는다');

  // 학습: 기한 전 질문 → 정답 보기 → 채점이 모두 들어간다.
  const learned = await answer(db, 'learning', cards.learning, 'learning', 3);
  assert.equal(learned.state, 'Review');
  assert.ok(Date.parse(learned.lastReview) < Date.parse(cards.learning.due), '기한 전에 채점됐다');
  assert.deepEqual(await stored(db, ids.learning), learned);

  // 복습 · 새 카드는 앞당기지 않는다.
  await rejectsInside(db, () => question(db, 'review', cards.review, 'review'), notDue);
  await rejectsInside(db, () => question(db, 'fresh', cards.fresh, 'fresh'), notDue);

  // 재학습: 기한 전 질문은 들어가고, 중단 뒤 30초 재질문 대기는 learn-ahead 안에서도 지킨다.
  const exposed = await question(db, 'relearning', cards.relearning, 'abandon');
  await operate(db, { ...base(ids.relearning), id: 'a-abandon', kind: 'abandon', expectedRevision: cards.relearning.revision,
    nextAttempt: { ...exposed, phase: 'abandoned', abandonedAt: exposed.questionAt } });
  await rejectsInside(db, () => question(db, 'relearning', cards.relearning, 'retry'), notDue);
  assert.equal(await validCount(db), 4);
  await rejectsInside(db, () => db.exec(apply), error => /learn_ahead_unexpected_definition/.test(error.message));

  // ③ 복원: 적용 전 본문 그대로 · 앞당겨 채점한 카드도 유효 · 다시 기한까지 기다린다.
  await db.exec(rollback);
  assert.deepEqual(await bodies(db), observed);
  assert.deepEqual(await pins(db), allPinned);
  assert.equal((await capabilities(db)).learnAheadSeconds, undefined);
  assert.equal(await validCount(db), 4);
  console.log('PASS: learning ahead blocked before / four pins + learnAheadSeconds 1200 + Learning·Relearning asked 20 min early, Review·New wait, abandon 30s kept / rollback restores exact bodies, early-graded cards stay valid.');
} catch (error) {
  console.error(error.code ?? 'ERROR', error.message);
  process.exitCode = 1;
} finally {
  await db?.close();
}
