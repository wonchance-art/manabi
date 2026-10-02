/** Isolated PostgreSQL contract verification. Never connects to an external DB.
 * node supabase/tests/korean-learning-support.mjs
 * PGLITE_MODULE may select an already installed local PGlite package.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { calculateFSRS } from '../../src/lib/fsrs.js';

const { PGlite } = createRequire(import.meta.url)(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const a = '10000000-0000-0000-0000-000000000001';
const b = '10000000-0000-0000-0000-000000000002';
const read = path => fs.readFile(new URL(path, import.meta.url), 'utf8');
const support = await read('../../docs/sql/korean-learning-support.sql');
const rollback = await read('../../docs/sql/korean-learning-support-rollback.sql');
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
let checks = 0;
const check = async (name, fn) => { await fn(); checks++; console.log(`PASS ${name}`); };
async function identity(id) {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id || '']);
  await db.exec(`SET ROLE ${id ? 'authenticated' : 'anon'}`);
}
const capabilities = async () => (await rows('SELECT public.learning_language_capabilities() AS result'))[0].result;
const flags = enabled => ({ version: 1, languages: { Korean: { save: enabled, review: enabled, known: enabled, exclude: enabled } } });
const word = { word_text: '책', meaning: 'book', language: 'Korean' };
const source = { kind: 'reading', materialId: '1', quote: '책을 읽어요. 책을 읽어요.', locator: { tokenId: 'second', surface: '책', sourceRevision: 'r1', start: 9, end: 10 } };
const save = async (w = word, s = source, id = null, meaning = null) => (await rows('SELECT public.save_vocabulary_context($1,$2,$3,$4) AS result', [w, s, id, meaning]))[0].result;
const mark = (lang, text, owner = a) => db.query('INSERT INTO public.user_known_words(user_id,lang,word_text) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [owner, lang, text]);
const unmark = (lang, text) => db.query('DELETE FROM public.user_known_words WHERE user_id=$1 AND lang=$2 AND word_text=$3', [a, lang, text]);
const exclude = (language, text, excluded, id = null) => db.query('SELECT public.set_vocabulary_exclusion($1,$2,$3,$4,NULL)', [language, text, id, excluded]);
const snapshot = async () => ({
  vocabulary: await rows('SELECT * FROM public.user_vocabulary ORDER BY id'),
  known: await rows('SELECT * FROM public.user_known_words ORDER BY user_id,lang,word_text'),
  contexts: await rows('SELECT * FROM public.vocabulary_contexts ORDER BY id'),
  events: await rows('SELECT * FROM public.review_events ORDER BY created_at,item_key'),
});
async function preflightRefuses(change, reason) {
  await db.exec('RESET ROLE; BEGIN');
  await db.exec(change);
  await assert.rejects(db.exec(support), reason);
  await db.exec('ROLLBACK');
}
async function deniedInTransaction(action, reason) {
  await db.exec('SAVEPOINT denied_write');
  await assert.rejects(action(), reason);
  await db.exec('ROLLBACK TO SAVEPOINT denied_write; RELEASE SAVEPOINT denied_write');
}
async function regression(change, action) {
  await db.exec('RESET ROLE; BEGIN');
  await db.exec(change);
  await identity(a);
  assert.deepEqual(await capabilities(), flags(false));
  if (action) await deniedInTransaction(action, /korean_learning_not_ready/);
  await db.exec('RESET ROLE; ROLLBACK');
  await identity(a);
  assert.deepEqual(await capabilities(), flags(true));
}

try {
  // The repository lacks original vocabulary/event DDL. This explicit legacy
  // fixture has owner-only RLS, real language CHECKs, and the real committed RPCs.
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY); GRANT USAGE ON SCHEMA auth TO anon,authenticated;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
    CREATE TABLE public.reading_materials(id bigint PRIMARY KEY,owner_id uuid,visibility text,title text);
    CREATE TABLE public.uploaded_pdfs(id uuid PRIMARY KEY,owner_id uuid,title text);
    CREATE TABLE public.user_vocabulary(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,word_text text,base_form text,meaning text,furigana text,pos text,
      language text CHECK(language IN ('Japanese','Chinese','English','French')),source_sentence text,source_material_id bigint,
      interval real DEFAULT 0,ease_factor real DEFAULT 2.5,repetitions int DEFAULT 0,next_review_at timestamptz,last_reviewed_at timestamptz,UNIQUE(user_id,word_text));
    CREATE TABLE public.review_events(user_id uuid,lang text CHECK(lang IN ('Japanese','Chinese','English','French')),source text,item_key text,correct boolean,detail jsonb,created_at timestamptz DEFAULT now());
    ALTER TABLE public.reading_materials ENABLE ROW LEVEL SECURITY; ALTER TABLE public.uploaded_pdfs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.user_vocabulary ENABLE ROW LEVEL SECURITY; ALTER TABLE public.review_events ENABLE ROW LEVEL SECURITY;
    CREATE POLICY material_read ON public.reading_materials FOR SELECT USING(true);
    CREATE POLICY pdf_owner ON public.uploaded_pdfs FOR ALL TO authenticated USING(owner_id=auth.uid()) WITH CHECK(owner_id=auth.uid());
    CREATE POLICY vocab_owner ON public.user_vocabulary FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
    CREATE POLICY event_owner ON public.review_events FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
    GRANT SELECT,INSERT,UPDATE,DELETE ON public.user_vocabulary TO authenticated;
    GRANT SELECT,INSERT ON public.review_events TO authenticated;
    GRANT SELECT ON public.reading_materials,public.uploaded_pdfs TO authenticated;
    INSERT INTO auth.users VALUES('${a}'),('${b}');
    INSERT INTO public.reading_materials VALUES(1,'${a}','private','A'),(2,'${b}','private','B'),(3,'${b}','public','Public');
    INSERT INTO public.user_vocabulary(user_id,word_text,base_form,meaning,language,source_sentence,interval,ease_factor,repetitions,next_review_at,last_reviewed_at)
      VALUES('${a}','books','book','my edited meaning','English','original source',30,8.1,7,'2026-10-10','2026-09-01'),('${b}','책','책','private B meaning','Chinese','B source',10,3,2,'2026-10-09','2026-09-01');
    INSERT INTO public.review_events(user_id,lang,source,item_key,correct,detail) VALUES('${a}','English','vocab','books',true,'{"legacy":true}');`);
  for (const path of ['../migrations/20260905065205_textbook_material_contexts.sql', '../../docs/sql/vocabulary-exclusion.sql', '../migrations/20260823170000_user_known_words.sql', '../../docs/sql/known-word-controls.sql']) await db.exec(await read(path));
  await identity(a);
  await save({ word_text: 'book', meaning: 'my edited meaning', language: 'English' }, source);
  await mark('en', 'books');
  await mark('ko', '이미앎');
  await db.exec('RESET ROLE');
  const before = await snapshot();

  await check('preflight refuses unexpected function, constraints, triggers, policy coverage, or privileges', async () => {
    await preflightRefuses('ALTER FUNCTION public.save_vocabulary_context(jsonb,jsonb,uuid,text) SECURITY DEFINER', /unexpected_function/);
    await preflightRefuses("ALTER TABLE public.user_vocabulary ADD CONSTRAINT unsupported_language CHECK(language<>'Korean')", /unexpected_language_check/);
    await preflightRefuses("ALTER TABLE public.vocabulary_contexts ADD CONSTRAINT unexpected CHECK(quote<>'blocked')", /unexpected_constraint/);
    await preflightRefuses('ALTER TABLE public.user_known_words DROP CONSTRAINT user_known_words_pkey', /missing_constraint/);
    await preflightRefuses('ALTER TABLE public.vocabulary_exclusions DROP COLUMN retired_vocabulary_ids', /unexpected_column/);
    await preflightRefuses('ALTER TABLE public.review_events ADD CONSTRAINT unreviewed CHECK(correct=true)', /unreviewed_original_table_check/);
    await preflightRefuses('ALTER TABLE public.user_vocabulary DISABLE TRIGGER guard_excluded_vocabulary', /missing_guard/);
    await preflightRefuses('CREATE TRIGGER unreviewed BEFORE UPDATE ON public.user_vocabulary FOR EACH ROW EXECUTE FUNCTION public.guard_excluded_vocabulary()', /unexpected_trigger/);
    await preflightRefuses('DROP POLICY vocab_owner ON public.user_vocabulary; CREATE POLICY only_read ON public.user_vocabulary FOR SELECT TO authenticated USING(user_id=auth.uid())', /missing_owner_policy/);
    await preflightRefuses('CREATE POLICY unsafe ON public.user_vocabulary FOR ALL TO authenticated USING(true) WITH CHECK(true)', /unexpected_owner_policy/);
    await preflightRefuses('GRANT SELECT ON public.user_known_words TO anon', /unsafe_table_privileges/);
    await preflightRefuses('ALTER ROLE authenticated BYPASSRLS', /unsafe_role_membership/);
    assert.deepEqual(await snapshot(), before);
  });
  await db.exec(support);
  await check('apply preserves legacy rows and original ko markers; backfills ko exclusions only', async () => {
    assert.deepEqual(await snapshot(), before);
    const entry = (await rows("SELECT * FROM public.vocabulary_exclusions WHERE language='Korean'"))[0];
    assert.deepEqual(entry.known_word_keys, ['이미앎']);
    assert.equal(entry.vocabulary_id, null);
  });
  await identity(a);
  await check('capability is strict authenticated read-only JSON; reads cause no learning writes', async () => {
    const current = await snapshot();
    assert.deepEqual(await capabilities(), flags(true));
    assert.deepEqual(await capabilities(), flags(true));
    assert.deepEqual(await snapshot(), current);
    await assert.rejects(rows('SELECT public.guard_korean_learning_contract()'), /permission denied/);
    await identity(null);
    await assert.rejects(capabilities(), /permission denied/);
    await identity(a);
  });
  const good = calculateFSRS(3);
  const saved = await save({ ...word, ...good });
  let koreanCard = (await rows('SELECT * FROM public.user_vocabulary WHERE id=$1', [saved.vocabularyId]))[0];
  await check('new Korean card uses server FSRS good schedule without review timestamp/event', async () => {
    assert.equal(saved.created, true);
    assert.equal(saved.contextAdded, true);
    assert.ok(Math.abs(koreanCard.interval - good.interval) < 0.00001);
    assert.ok(Math.abs(koreanCard.ease_factor - good.ease_factor) < 0.00001);
    assert.equal(koreanCard.repetitions, good.repetitions);
    assert.equal(koreanCard.next_review_at.toISOString(), good.next_review_at);
    assert.ok(koreanCard.next_review_at.getTime() > Date.now());
    assert.equal(koreanCard.last_reviewed_at, null);
    assert.equal((await rows('SELECT * FROM public.review_events')).length, 1);
  });
  await check('same-source and changed explanation locale preserve card, schedule, and context identity', async () => {
    const contextBefore = await rows('SELECT * FROM public.vocabulary_contexts WHERE vocabulary_id=$1', [saved.vocabularyId]);
    for (const [explanationLocale, translation] of [['ko', '책'], ['zh-CN', '书'], ['zh-TW', '書']]) {
      // Display metadata stays outside p_source/locator; it is not source identity.
      const duplicate = await save({ ...word, ...calculateFSRS(1), explanationLocale }, { ...source, translation });
      assert.equal(duplicate.created, false);
      assert.equal(duplicate.contextAdded, false);
    }
    assert.deepEqual((await rows('SELECT * FROM public.user_vocabulary WHERE id=$1', [saved.vocabularyId]))[0], koreanCard);
    assert.deepEqual(await rows('SELECT * FROM public.vocabulary_contexts WHERE vocabulary_id=$1', [saved.vocabularyId]), contextBefore);
    const firstOccurrence = { ...source, locator: { ...source.locator, tokenId: 'first', start: 0, end: 1 } };
    assert.equal((await save(word, firstOccurrence)).contextAdded, true);
    assert.equal((await rows('SELECT * FROM public.vocabulary_contexts WHERE vocabulary_id=$1', [saved.vocabularyId])).length, 2);
  });
  await check('Again schedules today; partial/invalid schedules fail and legacy fields are ignored', async () => {
    const now = new Date().toISOString();
    const again = { ...calculateFSRS(1), next_review_at: now };
    const result = await save({ ...word, word_text: '다시', ...again });
    const card = (await rows('SELECT * FROM public.user_vocabulary WHERE id=$1', [result.vocabularyId]))[0];
    assert.equal(card.next_review_at.toISOString(), now);
    assert.equal(card.last_reviewed_at, null);
    await assert.rejects(save({ ...word, word_text: 'partial', interval: 1 }), /invalid_initial_schedule/);
    await assert.rejects(save({ ...word, word_text: 'invalid', ...good, ease_factor: 11 }), /invalid_initial_schedule/);
    const easy = await save({ ...word, word_text: '쉬움', ...calculateFSRS(4) });
    assert.equal((await rows('SELECT ease_factor FROM public.user_vocabulary WHERE id=$1', [easy.vocabularyId]))[0].ease_factor, 1);
    const legacy = await save({ word_text: 'legacynew', meaning: 'meaning', language: 'English', interval: 9, ease_factor: 9, repetitions: 9, next_review_at: '2040-01-01' });
    const row = (await rows('SELECT * FROM public.user_vocabulary WHERE id=$1', [legacy.vocabularyId]))[0];
    assert.equal(row.interval, 0); assert.equal(row.ease_factor, 2.5); assert.equal(row.repetitions, 0);
  });
  await check('edited meaning and exact confirmation preserve protected fields; homographs cannot merge', async () => {
    await db.query('UPDATE public.user_vocabulary SET meaning=$1 WHERE id=$2', ['my meaning', saved.vocabularyId]);
    koreanCard = (await rows('SELECT * FROM public.user_vocabulary WHERE id=$1', [saved.vocabularyId]))[0];
    await assert.rejects(save(word), /vocabulary_meaning_conflict/);
    await assert.rejects(save(word, source, saved.vocabularyId, 'stale meaning'), /vocabulary_meaning_conflict/);
    await save(word, { ...source, quote: 'other exact quote' }, saved.vocabularyId, 'my meaning');
    assert.deepEqual((await rows('SELECT * FROM public.user_vocabulary WHERE id=$1', [saved.vocabularyId]))[0], koreanCard);
    await assert.rejects(save({ ...word, word_text: 'books' }), /vocabulary_language_conflict/);
    await db.query("INSERT INTO public.user_vocabulary(user_id,word_text,base_form,meaning,language) VALUES($1,'갔다','가다','go','Korean'),($1,'가요','가다','go','Korean')", [a]);
    await assert.rejects(save({ ...word, word_text: '가다', meaning: 'go' }), /vocabulary_ambiguous_match/);
  });
  await check('private foreign source/forged owner denied; Korean textbook/PDF expansion remains disabled', async () => {
    await assert.rejects(save({ ...word, word_text: 'secret' }, { ...source, materialId: '2' }), /row-level security/);
    assert.equal((await rows("SELECT * FROM public.user_vocabulary WHERE word_text='secret'")).length, 0);
    await assert.rejects(save({ ...word, word_text: 'course' }, { kind: 'textbook', chapterSlug: 'test', quote: 'quote' }), /invalid_context/);
    await assert.rejects(save({ ...word, word_text: 'pdf' }, { kind: 'pdf', pdfId: '20000000-0000-0000-0000-000000000001', quote: 'quote' }), /invalid_context/);
    await identity(b);
    assert.equal((await rows('SELECT * FROM public.vocabulary_contexts')).length, 0);
    await assert.rejects(mark('ko', 'forged', a), /row-level security/);
    await db.query('DELETE FROM public.vocabulary_contexts WHERE user_id=$1', [a]);
    await assert.rejects(exclude('Korean', '책', true, saved.vocabularyId), /word_not_available/);
    await identity(a);
  });
  await check('Korean/legacy known marks block reviews and restore without changing meanings/SRS/events', async () => {
    const protectedBefore = await rows('SELECT * FROM public.user_vocabulary ORDER BY id');
    const eventsBefore = await rows('SELECT * FROM public.review_events ORDER BY created_at');
    await mark('ko', '책');
    assert.equal((await rows('SELECT * FROM public.active_vocabulary WHERE id=$1', [saved.vocabularyId])).length, 0);
    await assert.rejects(db.query('UPDATE public.user_vocabulary SET interval=80 WHERE id=$1', [saved.vocabularyId]), /vocabulary_excluded/);
    await assert.rejects(db.query("INSERT INTO public.review_events(user_id,lang,source,item_key,correct,detail) VALUES($1,'Korean','vocab','책',true,$2)", [a, { word_id: saved.vocabularyId }]), /vocabulary_excluded/);
    await assert.rejects(exclude('Korean', '책', false), /known_word_active/);
    await unmark('ko', '책'); await unmark('en', 'books');
    assert.equal((await rows('SELECT * FROM public.active_vocabulary WHERE id=$1', [saved.vocabularyId])).length, 1);
    await exclude('Korean', '책', true, saved.vocabularyId);
    await exclude('Korean', '책', false, saved.vocabularyId);
    await exclude('English', 'book', true);
    await exclude('English', 'book', false);
    assert.deepEqual(await rows('SELECT * FROM public.user_vocabulary ORDER BY id'), protectedBefore);
    assert.deepEqual(await rows('SELECT * FROM public.review_events ORDER BY created_at'), eventsBefore);
  });
  await check('restored Korean review changes only chosen card schedule and appends owned event', async () => {
    const legacyBefore = await rows("SELECT * FROM public.user_vocabulary WHERE language<>'Korean' ORDER BY id");
    await db.query('UPDATE public.user_vocabulary SET interval=41,ease_factor=6.2,repetitions=2,last_reviewed_at=now() WHERE id=$1', [saved.vocabularyId]);
    await db.query("INSERT INTO public.review_events(user_id,lang,source,item_key,correct,detail) VALUES($1,'Korean','vocab','책',true,$2)", [a, { word_id: saved.vocabularyId }]);
    assert.deepEqual(await rows("SELECT * FROM public.user_vocabulary WHERE language<>'Korean' ORDER BY id"), legacyBefore);
    assert.equal((await rows('SELECT * FROM public.review_events')).length, 2);
  });
  await check('constraint/function/trigger/view/policy/grant/role drift disables capabilities and Korean writes', async () => {
    await regression('ALTER FUNCTION public.save_vocabulary_context(jsonb,jsonb,uuid,text) SECURITY DEFINER', () => mark('ko', 'drift'));
    await regression('ALTER TABLE public.vocabulary_contexts DROP CONSTRAINT vocabulary_contexts_lang_check', () => save({ ...word, word_text: 'drift' }));
    await regression('ALTER TABLE public.user_vocabulary DISABLE TRIGGER guard_excluded_vocabulary', () => db.query('UPDATE public.user_vocabulary SET interval=1 WHERE id=$1', [saved.vocabularyId]));
    await regression('ALTER VIEW public.active_vocabulary SET (security_invoker=false)', () => exclude('Korean', '책', true, saved.vocabularyId));
    await regression('CREATE POLICY drift ON public.user_vocabulary FOR SELECT TO authenticated USING(true)', () => mark('ko', 'drift'));
    await regression('GRANT SELECT ON public.vocabulary_exclusions TO anon', () => db.query("INSERT INTO public.review_events(user_id,lang,source,item_key,correct,detail) VALUES($1,'English','vocab','책',true,$2)", [a, { word_id: saved.vocabularyId }]));
    await regression('ALTER ROLE authenticated BYPASSRLS', () => mark('ko', 'drift'));
    await regression('GRANT anon TO authenticated', () => mark('ko', 'drift'));
  });
  await check('second apply is idempotent and preserves every learner row', async () => {
    await db.exec('RESET ROLE'); const current = await snapshot();
    const exclusionsBefore = await rows('SELECT * FROM public.vocabulary_exclusions ORDER BY id');
    await db.exec(support);
    assert.deepEqual(await snapshot(), current);
    assert.deepEqual(await rows('SELECT * FROM public.vocabulary_exclusions ORDER BY id'), exclusionsBefore);
    await identity(a); assert.deepEqual(await capabilities(), flags(true));
  });
  await check('safe rollback retains Korean and legacy data/checks; freezes Korean and keeps legacy usable', async () => {
    await mark('ko', '책'); await mark('en', 'books');
    await db.exec('RESET ROLE'); const current = await snapshot();
    const exclusionsBefore = await rows('SELECT * FROM public.vocabulary_exclusions ORDER BY id');
    await db.exec(rollback);
    assert.deepEqual(await snapshot(), current);
    assert.deepEqual(await rows('SELECT * FROM public.vocabulary_exclusions ORDER BY id'), exclusionsBefore);
    await identity(a); assert.deepEqual(await capabilities(), flags(false));
    await assert.rejects(unmark('ko', '책'), /korean_learning_not_ready/);
    await assert.rejects(save({ ...word, word_text: 'afterrollback' }), /korean_learning_not_ready/);
    await unmark('en', 'books');
    await save({ word_text: 'legacyafterrollback', meaning: 'meaning', language: 'English' });
    await db.exec('RESET ROLE'); await db.exec(support); await identity(a);
    assert.deepEqual(await capabilities(), flags(true));
    await unmark('ko', '책');
    assert.equal((await rows('SELECT * FROM public.active_vocabulary WHERE id=$1', [saved.vocabularyId])).length, 1);
  });
  console.log(`${checks} PostgreSQL checks passed; no live database touched.`);
} finally {
  await db.close();
}
