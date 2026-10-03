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

// Exact M09 audited SQL is embedded so CI needs no external handoff file.
const modernFixtureSql = `-- M09 modern learning catalog fixture, 2026-10-03. LOCAL EMPTY DATABASE ONLY.
-- Source: m09-init-001-live-catalog-report.md and blocks 00-24 (read-only catalog).
-- The seven application tables, constraints, indexes, policies, 15 triggers,
-- 18 function bodies and two view SELECT definitions below are observed catalog facts.
-- Auth infrastructure helpers/tables and service_role BYPASSRLS are SYNTHETIC test
-- scaffolding, not captured production definitions/attributes. No sample/private rows.
-- Ancillary content_sources/morpheme_dictionary full columns are absent from the
-- handoff; omitted rather than fabricated. Their constraints/policies are not tested.
-- No library-private dependency stub is installed: all 18 observed functions
-- reference only this fixture's tables/helpers and PostgreSQL built-ins.
-- Execute once in a new database as postgres; caller seeds synthetic auth.users and
-- public.profiles, then sets request.jwt.claim.sub and SET ROLE for owner tests.
BEGIN;

-- Explicit synthetic auth/role scaffolding. Observed anon/authenticated were
-- nonsuperuser, no bypass, inherit, with no memberships; service attrs not captured.
CREATE ROLE anon NOSUPERUSER NOBYPASSRLS INHERIT;
CREATE ROLE authenticated NOSUPERUSER NOBYPASSRLS INHERIT;
CREATE ROLE service_role NOSUPERUSER BYPASSRLS INHERIT;
CREATE SCHEMA auth;
CREATE SCHEMA library_private;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id));
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
 $$SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS
 $$SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), current_user::text)$$;
-- This deliberate false stub is only an admin-policy dependency. Admin paths are
-- outside fixture validation scope; ordinary authenticated ownership remains real RLS.
CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT false$$;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.role(), public.is_admin() TO anon, authenticated, service_role;


-- Observed columns/defaults/order: reading_materials (15 columns).
CREATE TABLE public.reading_materials (
 id bigint NOT NULL GENERATED BY DEFAULT AS IDENTITY,
 title text,
 raw_text text,
 processed_json jsonb,
 created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
 visibility text DEFAULT 'private'::text,
 owner_id uuid,
 group_id uuid,
 source_pdf_id uuid,
 page_start integer,
 page_end integer,
 lesson_explanation_ko text,
 conversation_script text,
 direction text NOT NULL DEFAULT 'read'::text,
 document_json jsonb
);

-- Observed columns/defaults/order: review_events (8 columns).
CREATE TABLE public.review_events (
 id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
 user_id uuid NOT NULL,
 lang text NOT NULL,
 source text NOT NULL,
 item_key text NOT NULL,
 correct boolean NOT NULL,
 detail jsonb,
 created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Observed columns/defaults/order: uploaded_pdfs (13 columns).
CREATE TABLE public.uploaded_pdfs (
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL,
 title text NOT NULL,
 filename text NOT NULL,
 storage_path text NOT NULL,
 file_size_bytes bigint,
 page_count integer,
 language text,
 level text,
 last_page_read integer DEFAULT 1,
 thumbnail_path text,
 created_at timestamp with time zone NOT NULL DEFAULT now(),
 lang text
);

-- Observed columns/defaults/order: user_known_words (4 columns).
CREATE TABLE public.user_known_words (
 user_id uuid NOT NULL,
 lang text NOT NULL,
 word_text text NOT NULL,
 marked_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Observed columns/defaults/order: user_vocabulary (22 columns).
CREATE TABLE public.user_vocabulary (
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 word_text text NOT NULL,
 furigana text,
 meaning text,
 pos text,
 status text DEFAULT 'New'::text,
 repetitions integer DEFAULT 0,
 next_review_at timestamp with time zone DEFAULT now(),
 last_review timestamp with time zone DEFAULT now(),
 material_id bigint,
 created_at timestamp with time zone DEFAULT now(),
 source_sentence text,
 source_material_id bigint,
 last_reviewed_at timestamp with time zone,
 user_id uuid,
 ease_factor real DEFAULT 2.5,
 interval real DEFAULT 0,
 language text,
 base_form text,
 source_ref text,
 etym text,
 hanja text
);

-- Observed columns/defaults/order: vocabulary_contexts (13 columns).
CREATE TABLE public.vocabulary_contexts (
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid(),
 vocabulary_id uuid NOT NULL,
 kind text NOT NULL,
 lang text NOT NULL,
 chapter_slug text,
 material_id bigint,
 pdf_id uuid,
 locator jsonb NOT NULL DEFAULT '{}'::jsonb,
 quote text NOT NULL,
 translation text NOT NULL DEFAULT ''::text,
 source_key text NOT NULL,
 created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Observed columns/defaults/order: vocabulary_exclusions (8 columns).
CREATE TABLE public.vocabulary_exclusions (
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 language text NOT NULL,
 word_text text NOT NULL,
 vocabulary_id uuid,
 retired_vocabulary_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
 created_at timestamp with time zone NOT NULL DEFAULT now(),
 known_word_keys text[] NOT NULL DEFAULT '{}'::text[]
);

ALTER TABLE public.reading_materials ADD CONSTRAINT "composer_material_is_private" CHECK ((((((processed_json -> 'metadata'::text) -> 'composer'::text) ->> 'version'::text) IS DISTINCT FROM '1'::text) OR ((NOT (visibility IS DISTINCT FROM 'private'::text)) AND (owner_id IS NOT NULL) AND (COALESCE(((processed_json -> 'metadata'::text) ->> 'importAttempt'::text), ''::text) <> ''::text))));

ALTER TABLE public.reading_materials ADD CONSTRAINT "reading_materials_direction_check" CHECK ((direction = ANY (ARRAY['read'::text, 'write'::text])));

ALTER TABLE public.reading_materials ADD CONSTRAINT "reading_materials_document_private_v1" CHECK (((document_json IS NULL) OR (COALESCE((visibility = 'private'::text), false) AND (owner_id IS NOT NULL) AND COALESCE(((((processed_json -> 'metadata'::text) -> 'composer'::text) ->> 'version'::text) = '1'::text), false) AND COALESCE(((document_json ->> 'version'::text) = '1'::text), false) AND COALESCE((jsonb_typeof((document_json -> 'body'::text)) = 'string'::text), false) AND COALESCE(((document_json ->> 'revision'::text) ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'::text), false))));

ALTER TABLE public.reading_materials ADD CONSTRAINT "reading_materials_pdf_source_private" CHECK (((source_pdf_id IS NULL) OR (visibility = 'private'::text)));

ALTER TABLE public.reading_materials ADD CONSTRAINT "reading_materials_pkey" PRIMARY KEY (id);

ALTER TABLE public.reading_materials ADD CONSTRAINT "reading_materials_visibility_check" CHECK ((visibility = ANY (ARRAY['public'::text, 'private'::text])));

ALTER TABLE public.reading_materials ADD CONSTRAINT "source_passage_stays_private" CHECK ((((((processed_json -> 'metadata'::text) -> 'composer'::text) -> 'passage'::text) IS NULL) OR ((NOT (visibility IS DISTINCT FROM 'private'::text)) AND (owner_id IS NOT NULL))));

ALTER TABLE public.review_events ADD CONSTRAINT "review_events_pkey" PRIMARY KEY (id);

ALTER TABLE public.uploaded_pdfs ADD CONSTRAINT "uploaded_pdfs_pkey" PRIMARY KEY (id);

ALTER TABLE public.user_known_words ADD CONSTRAINT "user_known_words_lang_check" CHECK ((lang ~ '^[a-z]{2}$'::text));

ALTER TABLE public.user_known_words ADD CONSTRAINT "user_known_words_pkey" PRIMARY KEY (user_id, lang, word_text);

ALTER TABLE public.user_known_words ADD CONSTRAINT "user_known_words_word_text_check" CHECK (((char_length(word_text) >= 1) AND (char_length(word_text) <= 100)));

ALTER TABLE public.user_vocabulary ADD CONSTRAINT "my_vocabulary_pkey" PRIMARY KEY (id);

ALTER TABLE public.user_vocabulary ADD CONSTRAINT "user_vocabulary_user_word_unique" UNIQUE (user_id, word_text);

ALTER TABLE public.vocabulary_contexts ADD CONSTRAINT "vocabulary_contexts_check" CHECK ((((kind = 'textbook'::text) AND (chapter_slug IS NOT NULL) AND (material_id IS NULL) AND (pdf_id IS NULL)) OR ((kind = 'reading'::text) AND (material_id IS NOT NULL) AND (chapter_slug IS NULL) AND (pdf_id IS NULL)) OR ((kind = 'pdf'::text) AND (pdf_id IS NOT NULL) AND (chapter_slug IS NULL) AND (material_id IS NULL)) OR ((kind = 'class'::text) AND (num_nonnulls(chapter_slug, material_id, pdf_id) = 0) AND (COALESCE((locator ->> 'team'::text), ''::text) ~ '^[a-z0-9][a-z0-9-]{0,15}$'::text) AND (COALESCE((locator ->> 'materialId'::text), ''::text) ~ '^[1-9][0-9]{0,15}$'::text))));

ALTER TABLE public.vocabulary_contexts ADD CONSTRAINT "vocabulary_contexts_kind_check" CHECK ((kind = ANY (ARRAY['textbook'::text, 'reading'::text, 'pdf'::text, 'class'::text])));

ALTER TABLE public.vocabulary_contexts ADD CONSTRAINT "vocabulary_contexts_lang_check" CHECK ((lang = ANY (ARRAY['Japanese'::text, 'Chinese'::text, 'English'::text, 'French'::text])));

ALTER TABLE public.vocabulary_contexts ADD CONSTRAINT "vocabulary_contexts_locator_check" CHECK ((jsonb_typeof(locator) = 'object'::text));

ALTER TABLE public.vocabulary_contexts ADD CONSTRAINT "vocabulary_contexts_pkey" PRIMARY KEY (id);

ALTER TABLE public.vocabulary_contexts ADD CONSTRAINT "vocabulary_contexts_quote_check" CHECK (((length(quote) >= 1) AND (length(quote) <= 4000)));

ALTER TABLE public.vocabulary_contexts ADD CONSTRAINT "vocabulary_contexts_translation_check" CHECK ((length(translation) <= 2000));

ALTER TABLE public.vocabulary_contexts ADD CONSTRAINT "vocabulary_contexts_user_id_vocabulary_id_source_key_key" UNIQUE (user_id, vocabulary_id, source_key);

ALTER TABLE public.vocabulary_exclusions ADD CONSTRAINT "vocabulary_exclusions_language_check" CHECK ((language = ANY (ARRAY['Japanese'::text, 'Chinese'::text, 'English'::text, 'French'::text, 'Unknown'::text])));

ALTER TABLE public.vocabulary_exclusions ADD CONSTRAINT "vocabulary_exclusions_pkey" PRIMARY KEY (id);

ALTER TABLE public.vocabulary_exclusions ADD CONSTRAINT "vocabulary_exclusions_user_id_vocabulary_id_key" UNIQUE (user_id, vocabulary_id);

ALTER TABLE public.vocabulary_exclusions ADD CONSTRAINT "vocabulary_exclusions_word_text_check" CHECK (((length(word_text) >= 1) AND (length(word_text) <= 300)));

ALTER TABLE public.reading_materials ADD CONSTRAINT "reading_materials_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.reading_materials ADD CONSTRAINT "reading_materials_source_pdf_id_fkey" FOREIGN KEY (source_pdf_id) REFERENCES public.uploaded_pdfs(id) ON DELETE CASCADE;

ALTER TABLE public.review_events ADD CONSTRAINT "review_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.uploaded_pdfs ADD CONSTRAINT "uploaded_pdfs_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.user_known_words ADD CONSTRAINT "user_known_words_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_vocabulary ADD CONSTRAINT "my_vocabulary_material_id_fkey" FOREIGN KEY (material_id) REFERENCES public.reading_materials(id) ON DELETE CASCADE;

ALTER TABLE public.user_vocabulary ADD CONSTRAINT "user_vocabulary_source_material_id_fkey" FOREIGN KEY (source_material_id) REFERENCES public.reading_materials(id) ON DELETE SET NULL;

ALTER TABLE public.user_vocabulary ADD CONSTRAINT "user_vocabulary_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.vocabulary_contexts ADD CONSTRAINT "vocabulary_contexts_material_id_fkey" FOREIGN KEY (material_id) REFERENCES public.reading_materials(id) ON DELETE CASCADE;

ALTER TABLE public.vocabulary_contexts ADD CONSTRAINT "vocabulary_contexts_pdf_id_fkey" FOREIGN KEY (pdf_id) REFERENCES public.uploaded_pdfs(id) ON DELETE CASCADE;

ALTER TABLE public.vocabulary_contexts ADD CONSTRAINT "vocabulary_contexts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.vocabulary_contexts ADD CONSTRAINT "vocabulary_contexts_vocabulary_id_fkey" FOREIGN KEY (vocabulary_id) REFERENCES public.user_vocabulary(id) ON DELETE CASCADE;

ALTER TABLE public.vocabulary_exclusions ADD CONSTRAINT "vocabulary_exclusions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.vocabulary_exclusions ADD CONSTRAINT "vocabulary_exclusions_vocabulary_id_fkey" FOREIGN KEY (vocabulary_id) REFERENCES public.user_vocabulary(id) ON DELETE SET NULL;

CREATE INDEX library_material_book_idx ON public.reading_materials USING btree (owner_id, ((processed_json #>> '{metadata,book,key}'::text[]))) WHERE ((processed_json #>> '{metadata,book,key}'::text[]) IS NOT NULL);

CREATE INDEX materials_source_pdf_idx ON public.reading_materials USING btree (source_pdf_id, page_start) WHERE (source_pdf_id IS NOT NULL);

CREATE UNIQUE INDEX reading_materials_class_key_unique ON public.reading_materials USING btree (((processed_json #>> '{metadata,team,key}'::text[]))) WHERE ((processed_json #>> '{metadata,team,root}'::text[]) = 'true'::text);

CREATE UNIQUE INDEX reading_materials_composer_attempt_unique ON public.reading_materials USING btree (owner_id, (((processed_json -> 'metadata'::text) ->> 'importAttempt'::text))) WHERE ((((processed_json -> 'metadata'::text) -> 'composer'::text) ->> 'version'::text) = '1'::text);

CREATE INDEX reading_materials_owner_direction_idx ON public.reading_materials USING btree (owner_id, direction);

CREATE INDEX review_events_user_time_idx ON public.review_events USING btree (user_id, created_at DESC);

CREATE INDEX uploaded_pdfs_owner_idx ON public.uploaded_pdfs USING btree (owner_id, created_at DESC);

CREATE INDEX user_vocab_base_form_idx ON public.user_vocabulary USING btree (user_id, base_form) WHERE (base_form IS NOT NULL);

CREATE INDEX vocabulary_contexts_material ON public.vocabulary_contexts USING btree (material_id);

CREATE INDEX vocabulary_contexts_pdf ON public.vocabulary_contexts USING btree (pdf_id);

CREATE INDEX vocabulary_contexts_vocab ON public.vocabulary_contexts USING btree (vocabulary_id, user_id, created_at);

CREATE UNIQUE INDEX vocabulary_exclusion_unsaved_key ON public.vocabulary_exclusions USING btree (user_id, language, word_text) WHERE (vocabulary_id IS NULL);

CREATE INDEX vocabulary_exclusion_word_key ON public.vocabulary_exclusions USING btree (user_id, language, word_text);

-- Exact observed function definition: block 18.
CREATE OR REPLACE FUNCTION public.save_vocabulary_context_for(p_owner uuid, p_word jsonb, p_source jsonb, p_confirm_id uuid DEFAULT NULL::uuid, p_confirm_meaning text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v public.user_vocabulary%rowtype;
  who uuid := p_owner;
  created boolean := false;
  added integer;
  matches integer;
  word text := btrim(p_word->>'word_text');
  meaning text := btrim(p_word->>'meaning');
begin
  if who is null or (current_user <> 'service_role' and (who is distinct from auth.uid() or p_source->>'kind'='class')) then raise exception 'login_required' using errcode='42501'; end if;
  if word is null or length(word) not between 1 and 300 or meaning is null or length(meaning) not between 1 and 2000
    or p_word->>'language' is null or p_word->>'language' not in ('Japanese','Chinese','English','French')
    or p_source->>'kind' is null or p_source->>'kind' not in ('textbook','reading','pdf','class')
    then raise exception 'invalid_context' using errcode='22023'; end if;

  -- 예전 뷰어가 활용형(word_text=books, base_form=book)으로 저장한 카드도 재사용한다.
  -- 후보가 여러 개면 추측해서 새 카드를 만들거나 임의로 합치지 않는다.
  select * into v from public.user_vocabulary where user_id=who and word_text=word for update;
  if not found then
    select count(*) into matches from public.user_vocabulary where user_id=who and language=p_word->>'language' and base_form=word;
    if matches > 1 then raise exception 'vocabulary_ambiguous_match'; end if;
    if matches = 1 then
      select * into v from public.user_vocabulary where user_id=who and language=p_word->>'language' and base_form=word for update;
    end if;
  end if;
  if v.id is null then
    insert into public.user_vocabulary(user_id,word_text,base_form,meaning,furigana,pos,language,source_sentence,source_material_id,next_review_at)
    values(who,word,word,meaning,coalesce(p_word->>'furigana',''),coalesce(p_word->>'pos',''),p_word->>'language',p_source->>'quote',
      case when p_source->>'kind'='reading' then (p_source->>'materialId')::bigint end,now())
    on conflict(user_id,word_text) do nothing returning * into v;
    created := found;
  end if;
  if not created and v.id is null then
    select * into v from public.user_vocabulary where user_id=who and word_text=word for update;
    if not found then raise exception 'word_not_available'; end if;
  end if;
  if not created then
    if v.language is distinct from p_word->>'language' then raise exception 'vocabulary_language_conflict'; end if;
    if btrim(coalesce(v.meaning,'')) <> meaning and not (
      p_confirm_id is not null and v.id=p_confirm_id and v.meaning is not distinct from p_confirm_meaning
    ) then raise exception 'vocabulary_meaning_conflict' using detail=v.id::text; end if;
  end if;

  insert into public.vocabulary_contexts(user_id,vocabulary_id,kind,lang,chapter_slug,material_id,pdf_id,locator,quote,translation,source_key)
  values(who,v.id,p_source->>'kind',p_word->>'language',p_source->>'chapterSlug',
    (p_source->>'materialId')::bigint,(p_source->>'pdfId')::uuid,coalesce(p_source->'locator','{}'::jsonb),
    p_source->>'quote',coalesce(p_source->>'translation',''),
    md5((p_source - 'translation')::text))
  on conflict(user_id,vocabulary_id,source_key) do nothing;
  get diagnostics added = row_count;
  return jsonb_build_object('vocabularyId',v.id,'created',created,'contextAdded',added>0);
end $function$;

-- Exact observed function definition: block 07.
CREATE OR REPLACE FUNCTION library_private.protect_source_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if current_user='authenticated' then raise exception 'library_use_trash: 내 서재에서 휴지통으로 이동해 주세요.' using errcode='42501';end if;
 return old;
end $function$;

-- Exact observed function definition: block 08.
CREATE OR REPLACE FUNCTION public.classroom_save_vocabulary(p_owner uuid, p_root bigint, p_generation integer, p_material bigint, p_expected_raw text, p_expected_json jsonb, p_word jsonb, p_source jsonb, p_initial jsonb DEFAULT NULL::jsonb, p_confirm_id uuid DEFAULT NULL::uuid, p_confirm_meaning text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare r public.reading_materials%rowtype; src public.reading_materials%rowtype; result jsonb;
begin
 if current_user <> 'service_role' or p_owner is null then raise exception 'login_required' using errcode='42501'; end if;
 select * into r from public.reading_materials where id=p_root and processed_json#>>'{metadata,team,root}'='true' for share;
 if not found or coalesce((r.processed_json#>>'{metadata,team,pwGen}')::integer,0) is distinct from p_generation then raise exception 'class_access_changed' using errcode='42501'; end if;
 select * into src from public.reading_materials where id=p_material and owner_id=r.owner_id for share;
 if not found or (
  (r.processed_json#>>'{metadata,team,bookKey}' is not null and src.processed_json#>>'{metadata,book,key}'=r.processed_json#>>'{metadata,team,bookKey}') or
  (src.processed_json#>>'{metadata,team,key}'=r.processed_json#>>'{metadata,team,key}' and src.processed_json#>>'{metadata,team,root}' is distinct from 'true' and src.processed_json#>>'{metadata,team,day}' is not null)
 ) is not true then raise exception 'class_material_unavailable' using errcode='42501'; end if;
 if src.raw_text is distinct from p_expected_raw or src.processed_json is distinct from p_expected_json then raise exception 'source_changed' using errcode='40001'; end if;
 if p_source->>'kind' is distinct from 'class' or p_source#>>'{locator,team}' is distinct from r.processed_json#>>'{metadata,team,key}'
 or p_source#>>'{locator,materialId}' is distinct from p_material::text then raise exception 'invalid_context' using errcode='22023'; end if;
 result:=public.save_vocabulary_context_for(p_owner,p_word,p_source,p_confirm_id,p_confirm_meaning);
 if (result->>'created')::boolean and p_initial is not null then
  if jsonb_typeof(p_initial)<>'object' or (p_initial->>'interval')::numeric not between 0.01 and 36500
   or (p_initial->>'ease_factor')::numeric not between 1 and 10 or (p_initial->>'repetitions')::integer<0
   or p_initial->>'next_review_at' is null then raise exception 'invalid_initial_grade' using errcode='22023'; end if;
  update public.user_vocabulary set interval=(p_initial->>'interval')::numeric,ease_factor=(p_initial->>'ease_factor')::numeric,
   repetitions=(p_initial->>'repetitions')::integer,next_review_at=(p_initial->>'next_review_at')::timestamptz
   where id=(result->>'vocabularyId')::uuid and user_id=p_owner;
 end if;
 if (result->>'created')::boolean then
  result:=result||jsonb_build_object('word',(select to_jsonb(v) from public.user_vocabulary v where v.id=(result->>'vocabularyId')::uuid and v.user_id=p_owner));
 end if;
 return result;
end $function$;

-- Exact observed function definition: block 09.
CREATE OR REPLACE FUNCTION public.guard_excluded_review_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
 IF NEW.source<>'vocab' THEN RETURN NEW; END IF;
 IF auth.uid() IS NOT NULL THEN PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,731)); END IF;
 -- 기존 카드의 제외 조작과 평가 이벤트를 같은 행 잠금으로 직렬화한다.
 IF NEW.detail->>'word_id' IS NOT NULL THEN PERFORM 1 FROM public.user_vocabulary WHERE user_id=NEW.user_id AND id::text=NEW.detail->>'word_id' FOR UPDATE; END IF;
 IF EXISTS(SELECT 1 FROM public.vocabulary_exclusions e WHERE e.user_id=NEW.user_id AND (
  e.vocabulary_id::text=NEW.detail->>'word_id' OR EXISTS(SELECT 1 FROM unnest(e.retired_vocabulary_ids) retired WHERE retired::text=NEW.detail->>'word_id') OR (e.language=NEW.lang AND e.word_text=normalize(btrim(NEW.item_key),NFC)) OR
  EXISTS(SELECT 1 FROM public.user_vocabulary v WHERE v.user_id=NEW.user_id AND v.id::text=NEW.detail->>'word_id' AND
   e.language=v.language AND e.word_text=normalize(btrim(coalesce(nullif(v.base_form,''),v.word_text)),NFC)) OR
  (NEW.detail->>'word_id' IS NULL AND EXISTS(SELECT 1 FROM public.user_vocabulary v WHERE v.id=e.vocabulary_id AND v.language=NEW.lang AND
   (normalize(btrim(v.word_text),NFC)=normalize(btrim(NEW.item_key),NFC) OR normalize(btrim(v.base_form),NFC)=normalize(btrim(NEW.item_key),NFC))))))
 THEN RAISE EXCEPTION 'vocabulary_excluded' USING ERRCODE='55000'; END IF;
 RETURN NEW;
END $function$;

-- Exact observed function definition: block 10.
CREATE OR REPLACE FUNCTION public.guard_excluded_vocabulary()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
 IF TG_OP='UPDATE' AND ROW(NEW.interval,NEW.ease_factor,NEW.repetitions,NEW.next_review_at,NEW.last_reviewed_at)
  IS NOT DISTINCT FROM ROW(OLD.interval,OLD.ease_factor,OLD.repetitions,OLD.next_review_at,OLD.last_reviewed_at) THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM public.vocabulary_exclusions e WHERE e.user_id=NEW.user_id AND (
  e.vocabulary_id=NEW.id OR (e.language=NEW.language AND
   e.word_text=normalize(btrim(coalesce(nullif(NEW.base_form,''),NEW.word_text)),NFC))))
 THEN RAISE EXCEPTION 'vocabulary_excluded' USING ERRCODE='55000'; END IF;
 RETURN NEW;
END $function$;

-- Exact observed function definition: block 11.
CREATE OR REPLACE FUNCTION public.guard_known_word_review_exclusion()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE active_keys text[];
BEGIN
 SELECT array_agg(k.word_text) INTO active_keys FROM public.user_known_words k WHERE k.user_id=OLD.user_id
  AND k.lang=CASE OLD.language WHEN 'Japanese' THEN 'ja' WHEN 'Chinese' THEN 'zh' WHEN 'English' THEN 'en' WHEN 'French' THEN 'fr' END
  AND k.word_text=ANY(OLD.known_word_keys);
 -- 신뢰된 FK cascade/known 동기화는 사용자·표시 자체를 지운다. 일반 RPC 삭제는 depth=1.
 IF TG_OP='DELETE' AND pg_catalog.pg_trigger_depth()>1 THEN RETURN OLD; END IF;
 IF cardinality(active_keys)>0 AND (TG_OP='DELETE' OR NEW.user_id IS DISTINCT FROM OLD.user_id
  OR NEW.language IS DISTINCT FROM OLD.language OR NEW.word_text IS DISTINCT FROM OLD.word_text
  OR NEW.vocabulary_id IS DISTINCT FROM OLD.vocabulary_id
  OR NOT active_keys <@ NEW.known_word_keys)
 THEN RAISE EXCEPTION 'known_word_active' USING ERRCODE='55000'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $function$;

-- Exact observed function definition: block 12.
CREATE OR REPLACE FUNCTION public.guard_source_passage_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF OLD.processed_json->'metadata'->'composer'->'passage' IS NOT NULL AND
    (NEW.processed_json IS DISTINCT FROM OLD.processed_json OR NEW.raw_text IS DISTINCT FROM OLD.raw_text) AND
    current_setting('manabi.passage_write',true) IS DISTINCT FROM OLD.id::text
  THEN RAISE EXCEPTION 'PASSAGE_USE_ANALYSIS_RPC' USING ERRCODE='40001'; END IF;
  RETURN NEW;
END;
$function$;

-- Exact observed function definition: block 13.
CREATE OR REPLACE FUNCTION public.library_book_preserve_metadata()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
 IF OLD.processed_json#>>'{metadata,book,orderRevision}' IS NOT NULL
  AND coalesce(current_setting('manabi.book_reorder',true),'')<>OLD.id::text THEN
  NEW.processed_json:=jsonb_set(coalesce(NEW.processed_json,'{}'),'{metadata}',
   coalesce(NEW.processed_json->'metadata','{}')||
   jsonb_build_object('book',OLD.processed_json#>'{metadata,book}')||
   CASE WHEN OLD.processed_json#>'{metadata,bookEntry}' IS NOT NULL
    THEN jsonb_build_object('bookEntry',OLD.processed_json#>'{metadata,bookEntry}') ELSE '{}'::jsonb END);
 END IF;
 RETURN NEW;
END;
$function$;

-- Exact observed function definition: block 14.
CREATE OR REPLACE FUNCTION public.lock_vocabulary_exclusion_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
 IF auth.uid() IS NOT NULL THEN PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,731)); END IF;
 RETURN NULL;
END $function$;

-- Exact observed function definition: block 15.
CREATE OR REPLACE FUNCTION public.preserve_deleted_vocabulary_exclusion()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE e public.vocabulary_exclusions%rowtype;
BEGIN
 SELECT * INTO e FROM public.vocabulary_exclusions WHERE user_id=OLD.user_id AND (vocabulary_id=OLD.id OR (language=OLD.language AND word_text=normalize(btrim(coalesce(nullif(OLD.base_form,''),OLD.word_text)),NFC))) ORDER BY (vocabulary_id=OLD.id) DESC NULLS LAST LIMIT 1;
 IF e.id IS NOT NULL AND NOT OLD.id=ANY(e.retired_vocabulary_ids) THEN
  UPDATE public.vocabulary_exclusions SET retired_vocabulary_ids=array_append(retired_vocabulary_ids,OLD.id) WHERE id=e.id RETURNING * INTO e;
 END IF;
 IF e.id IS NULL OR e.vocabulary_id IS DISTINCT FROM OLD.id THEN RETURN OLD; END IF;
 IF EXISTS(SELECT 1 FROM public.vocabulary_exclusions WHERE user_id=e.user_id AND language=e.language AND word_text=e.word_text AND vocabulary_id IS NULL) THEN
  UPDATE public.vocabulary_exclusions SET retired_vocabulary_ids=ARRAY(SELECT DISTINCT unnest(retired_vocabulary_ids||e.retired_vocabulary_ids))
   WHERE user_id=e.user_id AND language=e.language AND word_text=e.word_text AND vocabulary_id IS NULL;
  DELETE FROM public.vocabulary_exclusions WHERE id=e.id;
 ELSE UPDATE public.vocabulary_exclusions SET vocabulary_id=NULL WHERE id=e.id;
 END IF;
 RETURN OLD;
END $function$;

-- Exact observed function definition: block 16.
CREATE OR REPLACE FUNCTION public.protect_composer_source()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF OLD.processed_json->'metadata'->'composer'->>'version' = '1' AND (
    NEW.raw_text IS DISTINCT FROM OLD.raw_text
    OR NEW.processed_json->'metadata'->'composer' IS DISTINCT FROM OLD.processed_json->'metadata'->'composer'
    OR NEW.processed_json->'metadata'->'importAttempt' IS DISTINCT FROM OLD.processed_json->'metadata'->'importAttempt'
  ) THEN
    RAISE EXCEPTION 'composer_source_is_immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

-- Exact observed function definition: block 17.
CREATE OR REPLACE FUNCTION public.save_vocabulary_context(p_word jsonb, p_source jsonb, p_confirm_id uuid DEFAULT NULL::uuid, p_confirm_meaning text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select public.save_vocabulary_context_for(auth.uid(),p_word,p_source,p_confirm_id,p_confirm_meaning);
$function$;

-- Exact observed function definition: block 19.
CREATE OR REPLACE FUNCTION public.set_vocabulary_exclusion(p_language text, p_word text, p_vocabulary_id uuid, p_excluded boolean, p_exclusion_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE who uuid:=auth.uid(); v public.user_vocabulary%rowtype; e public.vocabulary_exclusions%rowtype;
 lang text:=p_language; word text:=normalize(btrim(p_word),NFC); matches integer;
BEGIN
 IF who IS NULL OR p_excluded IS NULL THEN RAISE EXCEPTION 'login_required' USING ERRCODE='42501'; END IF;
 -- 같은 계정의 저장/제외는 행 잠금 전에 직렬화한다(새 단어 저장과 미저장 제외 경쟁 포함).
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(who::text,731));
 IF p_exclusion_id IS NOT NULL THEN
  IF p_excluded THEN RAISE EXCEPTION 'invalid_exclusion'; END IF;
  SELECT * INTO e FROM public.vocabulary_exclusions WHERE id=p_exclusion_id AND user_id=who;
  IF e.id IS NULL THEN RAISE EXCEPTION 'exclusion_not_available' USING ERRCODE='42501'; END IF;
  IF e.vocabulary_id IS NOT NULL THEN PERFORM 1 FROM public.user_vocabulary WHERE id=e.vocabulary_id AND user_id=who FOR UPDATE; END IF;
  DELETE FROM public.vocabulary_exclusions WHERE user_id=who AND (id=e.id OR
   (e.language IN ('Japanese','Chinese','English','French') AND language=e.language AND word_text=e.word_text));
  RETURN jsonb_build_object('excluded',false,'entry',to_jsonb(e));
 END IF;
 IF p_vocabulary_id IS NOT NULL THEN
  SELECT * INTO v FROM public.user_vocabulary WHERE id=p_vocabulary_id AND user_id=who FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'word_not_available' USING ERRCODE='42501'; END IF;
 ELSE
  IF lang IS NULL OR lang NOT IN ('Japanese','Chinese','English','French') OR word IS NULL OR length(word) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'invalid_word'; END IF;
  SELECT count(*) INTO matches FROM public.user_vocabulary WHERE user_id=who AND language=lang
   AND (normalize(btrim(word_text),NFC)=word OR normalize(btrim(base_form),NFC)=word);
  IF matches>1 THEN RAISE EXCEPTION 'vocabulary_ambiguous_match'; END IF;
  IF matches=1 THEN SELECT * INTO v FROM public.user_vocabulary WHERE user_id=who AND language=lang
   AND (normalize(btrim(word_text),NFC)=word OR normalize(btrim(base_form),NFC)=word) FOR UPDATE; END IF;
 END IF;
 IF v.id IS NOT NULL THEN
  lang:=coalesce(v.language,'Unknown'); word:=normalize(btrim(coalesce(nullif(v.base_form,''),v.word_text)),NFC);
  SELECT * INTO e FROM public.vocabulary_exclusions WHERE user_id=who AND vocabulary_id=v.id;
  IF e.id IS NULL THEN SELECT * INTO e FROM public.vocabulary_exclusions WHERE user_id=who AND language=lang AND word_text=word; END IF;
 ELSE SELECT * INTO e FROM public.vocabulary_exclusions WHERE user_id=who AND language=lang AND word_text=word; END IF;
 IF p_excluded THEN
  IF e.id IS NULL THEN
   IF v.id IS NULL THEN
    INSERT INTO public.vocabulary_exclusions(user_id,language,word_text) VALUES(who,lang,word)
     ON CONFLICT(user_id,language,word_text) WHERE vocabulary_id IS NULL DO UPDATE SET word_text=EXCLUDED.word_text RETURNING * INTO e;
   ELSE
    INSERT INTO public.vocabulary_exclusions(user_id,language,word_text,vocabulary_id) VALUES(who,lang,word,v.id)
     ON CONFLICT(user_id,vocabulary_id) DO UPDATE SET vocabulary_id=EXCLUDED.vocabulary_id RETURNING * INTO e;
   END IF;
  ELSIF v.id IS NOT NULL AND e.vocabulary_id IS NULL THEN
   UPDATE public.vocabulary_exclusions SET vocabulary_id=v.id WHERE id=e.id RETURNING * INTO e;
  END IF;
 ELSE
  IF e.id IS NULL THEN
   SELECT * INTO e FROM public.vocabulary_exclusions WHERE user_id=who AND language=lang AND word_text=word;
  END IF;
  IF e.id IS NOT NULL THEN DELETE FROM public.vocabulary_exclusions WHERE user_id=who AND (id=e.id OR
   (e.language IN ('Japanese','Chinese','English','French') AND language=e.language AND word_text=e.word_text));
  ELSE e.id:=gen_random_uuid();e.language:=lang;e.word_text:=word;e.vocabulary_id:=v.id; END IF;
 END IF;
 RETURN jsonb_build_object('excluded',p_excluded,'entry',to_jsonb(e));
END $function$;

-- Exact observed function definition: block 20.
CREATE OR REPLACE FUNCTION public.sync_known_word_review_exclusion()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE who uuid; code text; original text; lang text; key text; affected text[];
BEGIN
 IF TG_OP='INSERT' THEN who:=NEW.user_id;code:=NEW.lang;original:=NEW.word_text;
 ELSE who:=OLD.user_id;code:=OLD.lang;original:=OLD.word_text; END IF;
 lang:=CASE code WHEN 'ja' THEN 'Japanese' WHEN 'zh' THEN 'Chinese' WHEN 'en' THEN 'English' WHEN 'fr' THEN 'French' END;
 IF lang IS NULL THEN RETURN NULL; END IF;
 IF TG_OP='INSERT' THEN
  FOR key IN
   SELECT normalize(btrim(original),NFC)
   UNION SELECT normalize(btrim(coalesce(nullif(v.base_form,''),v.word_text)),NFC)
    FROM public.user_vocabulary v WHERE v.user_id=who AND v.language=lang
    AND (normalize(btrim(v.word_text),NFC)=normalize(btrim(original),NFC)
     OR normalize(btrim(v.base_form),NFC)=normalize(btrim(original),NFC))
  LOOP
   IF length(key) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'invalid_known_word'; END IF;
   INSERT INTO public.vocabulary_exclusions(user_id,language,word_text,known_word_keys)
    VALUES(who,lang,key,ARRAY[original])
    ON CONFLICT(user_id,language,word_text) WHERE vocabulary_id IS NULL
    DO UPDATE SET known_word_keys=ARRAY(SELECT DISTINCT unnest(public.vocabulary_exclusions.known_word_keys||EXCLUDED.known_word_keys));
  END LOOP;
 ELSE
  SELECT array_agg(word_text) INTO affected FROM public.vocabulary_exclusions
   WHERE user_id=who AND language=lang AND original=ANY(known_word_keys);
  UPDATE public.vocabulary_exclusions SET known_word_keys=array_remove(known_word_keys,original)
   WHERE user_id=who AND language=lang AND original=ANY(known_word_keys);
  -- 해제는 새 평가가 아니다. 같은 키의 과거 '제외'도 해제하되 다른 known 표시는 보존한다.
  DELETE FROM public.vocabulary_exclusions e WHERE e.user_id=who AND e.language=lang AND e.word_text=ANY(affected)
   AND NOT EXISTS(SELECT 1 FROM public.vocabulary_exclusions other WHERE other.user_id=who AND other.language=lang
    AND other.word_text=e.word_text AND cardinality(other.known_word_keys)>0);
 END IF;
 RETURN NULL;
END $function$;

-- Exact observed function definition: block 21.
CREATE OR REPLACE FUNCTION public.sync_vocabulary_exclusion_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
 UPDATE public.vocabulary_exclusions SET language=coalesce(NEW.language,'Unknown'),
  word_text=normalize(btrim(coalesce(nullif(NEW.base_form,''),NEW.word_text)),NFC) WHERE vocabulary_id=NEW.id AND user_id=NEW.user_id;
 RETURN NEW;
END $function$;

-- Exact observed function definition: block 22.
CREATE OR REPLACE FUNCTION public.validate_source_passage()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  c jsonb := NEW.processed_json->'metadata'->'composer';
  s jsonb := c->'passage';
  parent public.reading_materials%ROWTYPE;
  d jsonb;
  body text;
BEGIN
  IF s IS NULL THEN RETURN NEW; END IF;
  IF NEW.visibility IS DISTINCT FROM 'private' OR NEW.owner_id IS DISTINCT FROM auth.uid()
    OR c->>'role' IS DISTINCT FROM 'study' OR c->>'version' IS DISTINCT FROM '1'
    OR COALESCE(c->>'parentId','') !~ '^[1-9][0-9]{0,18}$'
    OR jsonb_typeof(s) IS DISTINCT FROM 'object'
    OR s->>'version' IS DISTINCT FROM '1' OR COALESCE(s->>'kind','') NOT IN ('body','pdf','epub')
    OR s->>'textVersion' IS DISTINCT FROM (CASE s->>'kind' WHEN 'body' THEN 'plain-v1' WHEN 'pdf' THEN 'pdf-layer-v1' WHEN 'epub' THEN 'epub-text-v1' END)
    OR COALESCE(char_length(NEW.raw_text),0) NOT BETWEEN 1 AND 1500 OR btrim(NEW.raw_text) = ''
    OR COALESCE(NEW.processed_json->'metadata'->>'language','') NOT IN ('Japanese','Chinese','English','French')
    OR COALESCE(char_length(s->'quote'->>'exact'),0) > 4000
    OR char_length(s::text) > 24000
  THEN RAISE EXCEPTION 'PASSAGE_INVALID' USING ERRCODE='23514'; END IF;
  SELECT * INTO parent FROM public.reading_materials
    WHERE id=(c->>'parentId')::bigint AND owner_id=auth.uid() AND visibility='private' FOR SHARE;
  IF NOT FOUND OR parent.processed_json->'metadata'->'composer'->>'version' IS DISTINCT FROM '1'
    OR parent.processed_json->'metadata'->'composer'->>'role' = 'study'
  THEN RAISE EXCEPTION 'PASSAGE_ACCESS' USING ERRCODE='42501'; END IF;
  d := COALESCE(parent.document_json, jsonb_build_object('revision',NULL,'body',parent.raw_text,
    'assets',parent.processed_json->'metadata'->'composer'->'assets'));
  IF s->>'kind'='body' THEN
    IF d->>'revision' IS DISTINCT FROM s->>'revision' THEN
      RAISE EXCEPTION 'PASSAGE_SOURCE_CHANGED' USING ERRCODE='40001';
    END IF;
    body := d->>'body';
  ELSE
    IF COALESCE(s->>'assetHash','') !~ '^[a-f0-9]{64}$' OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(d->'assets','[]') || COALESCE(d->'retainedAssets','[]')) a
      WHERE a->>'hash'=s->>'assetHash' AND a->>'kind'=s->>'kind'
    ) THEN RAISE EXCEPTION 'PASSAGE_SOURCE_CHANGED' USING ERRCODE='40001'; END IF;
    IF s->>'kind'='pdf' AND (COALESCE(s->>'page','') !~ '^[1-9][0-9]{0,5}$')
      OR s->>'kind'='epub' AND (COALESCE(s->>'chapter','') !~ '^[1-9][0-9]{0,5}$'
        OR COALESCE(s->>'spineIndex','') !~ '^[0-9]{1,6}$'
        OR COALESCE(char_length(s->>'spinePath'),0) NOT BETWEEN 1 AND 1000)
    THEN RAISE EXCEPTION 'PASSAGE_INVALID' USING ERRCODE='23514'; END IF;
  END IF;
  IF s->>'manual' IS DISTINCT FROM 'true' THEN
    IF COALESCE(s->'quote'->>'start','') !~ '^[0-9]{1,9}$'
      OR COALESCE(s->'quote'->>'end','') !~ '^[0-9]{1,9}$'
      OR COALESCE(char_length(s->'quote'->>'exact'),0) < 1
      OR (s->'quote'->>'end')::int-(s->'quote'->>'start')::int <> char_length(s->'quote'->>'exact')
      OR COALESCE(char_length(s->'quote'->>'prefix'),0)>40 OR COALESCE(char_length(s->'quote'->>'suffix'),0)>40
    THEN RAISE EXCEPTION 'PASSAGE_INVALID' USING ERRCODE='23514'; END IF;
    IF s->>'kind'='body' AND substring(body FROM (s->'quote'->>'start')::int+1 FOR char_length(s->'quote'->>'exact'))
      IS DISTINCT FROM s->'quote'->>'exact'
    THEN RAISE EXCEPTION 'PASSAGE_SOURCE_CHANGED' USING ERRCODE='40001'; END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Exact observed function definition: block 23.
CREATE OR REPLACE FUNCTION public.viewer_replace_analysis(p_id bigint, p_expected_raw text, p_expected_json jsonb, p_raw text, p_json jsonb, p_attempt uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE r public.reading_materials%rowtype;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.reading_materials
    WHERE id=p_id AND owner_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '자료가 없거나 수정 권한이 없습니다.' USING ERRCODE='42501'; END IF;
  -- 응답 유실 뒤 동일 요청 재확인은 성공으로 돌려주고 두 번 쓰지 않는다.
  IF r.processed_json->'metadata'->>'viewerRevision'=p_attempt::text
    AND r.raw_text IS NOT DISTINCT FROM p_raw AND r.processed_json IS NOT DISTINCT FROM p_json THEN
    RETURN jsonb_build_object('material',to_jsonb(r));
  END IF;
  IF r.raw_text IS DISTINCT FROM p_expected_raw OR r.processed_json IS DISTINCT FROM p_expected_json THEN
    RAISE EXCEPTION '다른 창에서 자료가 바뀌었어요. 다시 열어 확인해 주세요.' USING ERRCODE='40001';
  END IF;
  IF p_attempt IS NULL OR p_raw IS NULL OR length(btrim(p_raw))=0
    OR jsonb_typeof(p_json->'sequence') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_json->'dictionary') IS DISTINCT FROM 'object'
    OR p_json->'metadata'->>'viewerRevision' IS DISTINCT FROM p_attempt::text THEN
    RAISE EXCEPTION '분석 결과를 확인하지 못했어요.' USING ERRCODE='22023';
  END IF;
  -- 현재 소스 구간 임대 중에는 기존 분석 경로를 침범하지 않는다.
  IF r.processed_json->'metadata'->'passageRun' IS NOT NULL
    AND (r.processed_json->'metadata'->'passageRun'->>'until')::timestamptz > clock_timestamp() THEN
    RAISE EXCEPTION '다른 분석이 진행 중입니다.' USING ERRCODE='40001';
  END IF;
  UPDATE public.reading_materials SET raw_text=p_raw, processed_json=p_json
    WHERE id=p_id AND owner_id=auth.uid() RETURNING * INTO r;
  RETURN jsonb_build_object('material',to_jsonb(r));
END;
$function$;

-- Exact observed function definition: block 24.
CREATE OR REPLACE FUNCTION public.viewer_undo_vocabulary_save(p_id uuid, p_expected jsonb, p_context_ids uuid[])
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v public.user_vocabulary%rowtype; current_ids uuid[]; expected_ids uuid[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE='42501'; END IF;
  SELECT * INTO v FROM public.user_vocabulary WHERE id=p_id AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF to_jsonb(v) IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION '이후 학습이나 수정이 있어 저장을 취소하지 않았어요.' USING ERRCODE='40001';
  END IF;
  SELECT coalesce(array_agg(id ORDER BY id),'{}'::uuid[]) INTO current_ids
    FROM public.vocabulary_contexts WHERE vocabulary_id=p_id;
  SELECT coalesce(array_agg(id ORDER BY id),'{}'::uuid[]) INTO expected_ids FROM unnest(p_context_ids) id;
  IF current_ids IS DISTINCT FROM expected_ids THEN
    RAISE EXCEPTION '다른 문맥이 추가되어 저장을 취소하지 않았어요.' USING ERRCODE='40001';
  END IF;
  DELETE FROM public.user_vocabulary WHERE id=p_id AND user_id=auth.uid();
  RETURN FOUND;
END;
$function$;

CREATE TRIGGER guard_source_passage_write BEFORE UPDATE OF raw_text, processed_json ON public.reading_materials FOR EACH ROW EXECUTE FUNCTION public.guard_source_passage_write();

CREATE TRIGGER library_book_preserve_metadata BEFORE UPDATE OF processed_json ON public.reading_materials FOR EACH ROW EXECUTE FUNCTION public.library_book_preserve_metadata();

CREATE TRIGGER library_protect_material_delete BEFORE DELETE ON public.reading_materials FOR EACH ROW EXECUTE FUNCTION library_private.protect_source_delete();

CREATE TRIGGER protect_composer_source BEFORE UPDATE OF raw_text, processed_json ON public.reading_materials FOR EACH ROW EXECUTE FUNCTION public.protect_composer_source();

CREATE TRIGGER validate_source_passage BEFORE INSERT ON public.reading_materials FOR EACH ROW EXECUTE FUNCTION public.validate_source_passage();

CREATE TRIGGER guard_excluded_review_event BEFORE INSERT ON public.review_events FOR EACH ROW EXECUTE FUNCTION public.guard_excluded_review_event();

CREATE TRIGGER library_protect_pdf_delete BEFORE DELETE ON public.uploaded_pdfs FOR EACH ROW EXECUTE FUNCTION library_private.protect_source_delete();

CREATE TRIGGER lock_known_word_owner BEFORE INSERT OR DELETE ON public.user_known_words FOR EACH STATEMENT EXECUTE FUNCTION public.lock_vocabulary_exclusion_owner();

CREATE TRIGGER sync_known_word_review_exclusion AFTER INSERT OR DELETE ON public.user_known_words FOR EACH ROW EXECUTE FUNCTION public.sync_known_word_review_exclusion();

CREATE TRIGGER guard_excluded_vocabulary BEFORE INSERT OR UPDATE ON public.user_vocabulary FOR EACH ROW EXECUTE FUNCTION public.guard_excluded_vocabulary();

CREATE TRIGGER lock_vocabulary_exclusion_owner BEFORE INSERT OR DELETE OR UPDATE ON public.user_vocabulary FOR EACH STATEMENT EXECUTE FUNCTION public.lock_vocabulary_exclusion_owner();

CREATE TRIGGER preserve_deleted_vocabulary_exclusion BEFORE DELETE ON public.user_vocabulary FOR EACH ROW EXECUTE FUNCTION public.preserve_deleted_vocabulary_exclusion();

CREATE TRIGGER sync_vocabulary_exclusion_identity AFTER UPDATE OF word_text, base_form, language ON public.user_vocabulary FOR EACH ROW EXECUTE FUNCTION public.sync_vocabulary_exclusion_identity();

CREATE TRIGGER guard_known_word_review_exclusion BEFORE DELETE OR UPDATE ON public.vocabulary_exclusions FOR EACH ROW EXECUTE FUNCTION public.guard_known_word_review_exclusion();

CREATE TRIGGER lock_exclusion_owner BEFORE INSERT OR DELETE OR UPDATE ON public.vocabulary_exclusions FOR EACH STATEMENT EXECUTE FUNCTION public.lock_vocabulary_exclusion_owner();

-- Observed view MD5 e171e8add613931bf2d3cbf25056a1f2.
CREATE VIEW public.vocabulary_with_exclusions WITH (security_invoker=true) AS
SELECT id,
    word_text,
    furigana,
    meaning,
    pos,
    status,
    repetitions,
    next_review_at,
    last_review,
    material_id,
    created_at,
    source_sentence,
    source_material_id,
    last_reviewed_at,
    user_id,
    ease_factor,
    "interval",
    language,
    base_form,
    source_ref,
    etym,
    hanja,
    (EXISTS ( SELECT 1
           FROM public.vocabulary_exclusions e
          WHERE e.user_id = v.user_id AND (e.vocabulary_id = v.id OR e.language = v.language AND e.word_text = NORMALIZE(btrim(COALESCE(NULLIF(v.base_form, ''::text), v.word_text)), NFC)))) AS is_excluded
   FROM public.user_vocabulary v;

-- Observed view MD5 008081605dbf386a9242ac58bbfbd02f.
CREATE VIEW public.active_vocabulary WITH (security_invoker=true) AS
SELECT id,
    word_text,
    furigana,
    meaning,
    pos,
    status,
    repetitions,
    next_review_at,
    last_review,
    material_id,
    created_at,
    source_sentence,
    source_material_id,
    last_reviewed_at,
    user_id,
    ease_factor,
    "interval",
    language,
    base_form,
    source_ref,
    etym,
    hanja,
    is_excluded
   FROM public.vocabulary_with_exclusions
  WHERE NOT is_excluded;

ALTER TABLE public.reading_materials ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.review_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.uploaded_pdfs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_known_words ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_vocabulary ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vocabulary_contexts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vocabulary_exclusions ENABLE ROW LEVEL SECURITY;

-- Observed policy definition MD5 0fa523698b02072161aba1444e5deed7.
CREATE POLICY "Enable Read for All" ON public.reading_materials AS PERMISSIVE FOR SELECT TO anon
 USING (true);

-- Observed policy definition MD5 3b210ba8af930bd2ce7658f79e82781d.
CREATE POLICY "Users can insert own materials" ON public.reading_materials AS PERMISSIVE FOR INSERT TO PUBLIC
 WITH CHECK ((owner_id = auth.uid()));

-- Observed policy definition MD5 c67a9387dcbf73b32d3dba40c29d0cc2.
CREATE POLICY "Users can read public or own materials" ON public.reading_materials AS PERMISSIVE FOR SELECT TO PUBLIC
 USING (((visibility = 'public'::text) OR (owner_id = auth.uid())));

-- Observed policy definition MD5 d81eb8e4b136af3e3ddbc715fe5ec31c.
CREATE POLICY "Users can update own materials" ON public.reading_materials AS PERMISSIVE FOR UPDATE TO PUBLIC
 USING ((owner_id = auth.uid()));

-- Observed policy definition MD5 304d161592eb5a1de224ef03c0899d57.
CREATE POLICY "anyone_read_public_materials" ON public.reading_materials AS PERMISSIVE FOR SELECT TO PUBLIC
 USING ((visibility = 'public'::text));

-- Observed policy definition MD5 036c64d27af66b8775a30f65ff6a22b5.
CREATE POLICY "learning_material_visibility_guard" ON public.reading_materials AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING (((visibility = 'public'::text) OR (owner_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin)));

-- Observed policy definition MD5 0a5b88419f8a490741b82b5cd53d567e.
CREATE POLICY "owner_delete_material" ON public.reading_materials AS PERMISSIVE FOR DELETE TO PUBLIC
 USING ((auth.uid() = owner_id));

-- Observed policy definition MD5 8d547e04ec103cab55a24ee8c314c824.
CREATE POLICY "owner_read_private_materials" ON public.reading_materials AS PERMISSIVE FOR SELECT TO PUBLIC
 USING (((visibility = 'private'::text) AND (owner_id = auth.uid())));

-- Observed policy definition MD5 5125365188894cc8dee810c6dd780e0d.
CREATE POLICY "owner_update_material" ON public.reading_materials AS PERMISSIVE FOR UPDATE TO PUBLIC
 USING ((auth.uid() = owner_id));

-- Observed policy definition MD5 9516da351b0ea5ad9277003ea728ac9d.
CREATE POLICY "review_events_insert_own" ON public.review_events AS PERMISSIVE FOR INSERT TO PUBLIC
 WITH CHECK ((auth.uid() = user_id));

-- Observed policy definition MD5 7afbcef7fd5ff91b0bb3d11ca5f249cd.
CREATE POLICY "review_events_select_own" ON public.review_events AS PERMISSIVE FOR SELECT TO PUBLIC
 USING ((auth.uid() = user_id));

-- Observed policy definition MD5 291175792b472c71c5524e3b1b7064d6.
CREATE POLICY "Owner full access" ON public.uploaded_pdfs AS PERMISSIVE FOR ALL TO PUBLIC
 USING ((auth.uid() = owner_id))
 WITH CHECK ((auth.uid() = owner_id));

-- Observed policy definition MD5 5aa1b76c7db798b1bc076c00da396b1a.
CREATE POLICY "user_known_words_delete_own" ON public.user_known_words AS PERMISSIVE FOR DELETE TO authenticated
 USING ((user_id = auth.uid()));

-- Observed policy definition MD5 c6131b84cf0c36af6d1d5d57c382bc5a.
CREATE POLICY "user_known_words_insert_own" ON public.user_known_words AS PERMISSIVE FOR INSERT TO authenticated
 WITH CHECK ((user_id = auth.uid()));

-- Observed policy definition MD5 8a1b3dbbadb76db8dce6ed89b7d3c309.
CREATE POLICY "user_known_words_select_own" ON public.user_known_words AS PERMISSIVE FOR SELECT TO authenticated
 USING ((user_id = auth.uid()));

-- Observed policy definition MD5 cdf0ee1cb369dccedd535c5a887d6fc5.
CREATE POLICY "Users can manage own vocabulary" ON public.user_vocabulary AS PERMISSIVE FOR ALL TO PUBLIC
 USING ((auth.uid() = user_id))
 WITH CHECK ((auth.uid() = user_id));

-- Observed policy definition MD5 419dbf2cb6d3b0b71986b2dc919f5e3c.
CREATE POLICY "vocabulary_class_context_read" ON public.vocabulary_contexts AS PERMISSIVE FOR SELECT TO authenticated
 USING (((kind = 'class'::text) AND (user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.user_vocabulary v
  WHERE ((v.id = vocabulary_contexts.vocabulary_id) AND (v.user_id = ( SELECT auth.uid() AS uid)))))));

-- Observed policy definition MD5 5e89a55d2e8264026e0036cdf41cb39a.
CREATE POLICY "vocabulary_contexts_delete" ON public.vocabulary_contexts AS PERMISSIVE FOR DELETE TO authenticated
 USING ((user_id = ( SELECT auth.uid() AS uid)));

-- Observed policy definition MD5 075762a417947f450b5d0dd424bf2a50.
CREATE POLICY "vocabulary_contexts_insert" ON public.vocabulary_contexts AS PERMISSIVE FOR INSERT TO authenticated
 WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.user_vocabulary v
  WHERE ((v.id = vocabulary_contexts.vocabulary_id) AND (v.user_id = ( SELECT auth.uid() AS uid)) AND (v.language = vocabulary_contexts.lang)))) AND ((kind = 'textbook'::text) OR (EXISTS ( SELECT 1
   FROM public.reading_materials m
  WHERE ((m.id = vocabulary_contexts.material_id) AND ((m.owner_id = ( SELECT auth.uid() AS uid)) OR (m.visibility = 'public'::text))))) OR (EXISTS ( SELECT 1
   FROM public.uploaded_pdfs p
  WHERE ((p.id = vocabulary_contexts.pdf_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))))));

-- Observed policy definition MD5 54bd0bdce05f500318e95579dde19bc2.
CREATE POLICY "vocabulary_contexts_read" ON public.vocabulary_contexts AS PERMISSIVE FOR SELECT TO authenticated
 USING (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.user_vocabulary v
  WHERE ((v.id = vocabulary_contexts.vocabulary_id) AND (v.user_id = ( SELECT auth.uid() AS uid))))) AND ((kind = 'textbook'::text) OR (EXISTS ( SELECT 1
   FROM public.reading_materials m
  WHERE ((m.id = vocabulary_contexts.material_id) AND ((m.owner_id = ( SELECT auth.uid() AS uid)) OR (m.visibility = 'public'::text))))) OR (EXISTS ( SELECT 1
   FROM public.uploaded_pdfs p
  WHERE ((p.id = vocabulary_contexts.pdf_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))))));

-- Observed policy definition MD5 8ecc1c8016ca2dc921fbb085fcfafd2a.
CREATE POLICY "vocabulary_exclusion_owner" ON public.vocabulary_exclusions AS PERMISSIVE FOR ALL TO authenticated
 USING ((( SELECT auth.uid() AS uid) = user_id))
 WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND ((vocabulary_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.user_vocabulary v
  WHERE ((v.id = vocabulary_exclusions.vocabulary_id) AND (v.user_id = ( SELECT auth.uid() AS uid))))))));

REVOKE ALL ON TABLE public.active_vocabulary FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.active_vocabulary TO service_role;

GRANT SELECT ON TABLE public.active_vocabulary TO authenticated;

REVOKE ALL ON TABLE public.reading_materials FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.reading_materials TO anon;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.reading_materials TO authenticated;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.reading_materials TO service_role;

REVOKE ALL ON TABLE public.review_events FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.review_events TO anon;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.review_events TO authenticated;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.review_events TO service_role;

REVOKE ALL ON TABLE public.uploaded_pdfs FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.uploaded_pdfs TO anon;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.uploaded_pdfs TO authenticated;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.uploaded_pdfs TO service_role;

REVOKE ALL ON TABLE public.user_known_words FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.user_known_words TO authenticated;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.user_known_words TO service_role;

REVOKE ALL ON TABLE public.user_vocabulary FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.user_vocabulary TO anon;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.user_vocabulary TO authenticated;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.user_vocabulary TO service_role;

REVOKE ALL ON TABLE public.vocabulary_contexts FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.vocabulary_contexts TO service_role;

GRANT INSERT, SELECT, DELETE ON TABLE public.vocabulary_contexts TO authenticated;

REVOKE ALL ON TABLE public.vocabulary_exclusions FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.vocabulary_exclusions TO service_role;

GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public.vocabulary_exclusions TO authenticated;

REVOKE ALL ON TABLE public.vocabulary_with_exclusions FROM PUBLIC, anon, authenticated, service_role;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.vocabulary_with_exclusions TO service_role;

GRANT SELECT ON TABLE public.vocabulary_with_exclusions TO authenticated;

-- Exact observed function body MD5 306cf4349016b7a66408990ac48a4d63.
REVOKE ALL ON FUNCTION library_private.protect_source_delete() FROM PUBLIC, anon, authenticated, service_role;

-- Exact observed function body MD5 f563cf7209213aa03433ca30be0fe4a5.
REVOKE ALL ON FUNCTION public.classroom_save_vocabulary(uuid,bigint,integer,bigint,text,jsonb,jsonb,jsonb,jsonb,uuid,text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.classroom_save_vocabulary(uuid,bigint,integer,bigint,text,jsonb,jsonb,jsonb,jsonb,uuid,text) TO service_role;

-- Exact observed function body MD5 69b5b53f1cc47887c81e8f4b9a70c06c.
REVOKE ALL ON FUNCTION public.guard_excluded_review_event() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.guard_excluded_review_event() TO service_role;

-- Exact observed function body MD5 ace98b29ea4c10a4d8b8950deda96bd7.
REVOKE ALL ON FUNCTION public.guard_excluded_vocabulary() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.guard_excluded_vocabulary() TO service_role;

-- Exact observed function body MD5 71ab352aa46bf375c16b2627c7dfbf0d.
REVOKE ALL ON FUNCTION public.guard_known_word_review_exclusion() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.guard_known_word_review_exclusion() TO service_role;

-- Exact observed function body MD5 3cca47555822970990d652c1a01205b8.
REVOKE ALL ON FUNCTION public.guard_source_passage_write() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.guard_source_passage_write() TO service_role;

-- Exact observed function body MD5 95b5dc5352234a531599207175baf099.
REVOKE ALL ON FUNCTION public.library_book_preserve_metadata() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.library_book_preserve_metadata() TO service_role;

-- Exact observed function body MD5 0d6c6b7886c4264a3eea0310d4449e41.
REVOKE ALL ON FUNCTION public.lock_vocabulary_exclusion_owner() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.lock_vocabulary_exclusion_owner() TO service_role;

-- Exact observed function body MD5 79f0ef445d24e92c15fff8f4c179a629.
REVOKE ALL ON FUNCTION public.preserve_deleted_vocabulary_exclusion() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.preserve_deleted_vocabulary_exclusion() TO service_role;

-- Exact observed function body MD5 dea10802e0aeaef706714fdace11a603.
REVOKE ALL ON FUNCTION public.protect_composer_source() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.protect_composer_source() TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.protect_composer_source() TO anon;

GRANT EXECUTE ON FUNCTION public.protect_composer_source() TO authenticated;

GRANT EXECUTE ON FUNCTION public.protect_composer_source() TO service_role;

-- Exact observed function body MD5 03b53aa8f7cdad5d23d503a26a873e61.
REVOKE ALL ON FUNCTION public.save_vocabulary_context(jsonb,jsonb,uuid,text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.save_vocabulary_context(jsonb,jsonb,uuid,text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.save_vocabulary_context(jsonb,jsonb,uuid,text) TO service_role;

-- Exact observed function body MD5 1facb74b4b7d33a572cef9642341342f.
REVOKE ALL ON FUNCTION public.save_vocabulary_context_for(uuid,jsonb,jsonb,uuid,text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.save_vocabulary_context_for(uuid,jsonb,jsonb,uuid,text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.save_vocabulary_context_for(uuid,jsonb,jsonb,uuid,text) TO service_role;

-- Exact observed function body MD5 ab2fbcdce90647f4b36360c004aa50e0.
REVOKE ALL ON FUNCTION public.set_vocabulary_exclusion(text,text,uuid,boolean,uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.set_vocabulary_exclusion(text,text,uuid,boolean,uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.set_vocabulary_exclusion(text,text,uuid,boolean,uuid) TO service_role;

-- Exact observed function body MD5 ced5892a8eb03cff1645d997dfca890e.
REVOKE ALL ON FUNCTION public.sync_known_word_review_exclusion() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.sync_known_word_review_exclusion() TO service_role;

-- Exact observed function body MD5 8f484084d6216ba1bd6c1a1b0185d447.
REVOKE ALL ON FUNCTION public.sync_vocabulary_exclusion_identity() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.sync_vocabulary_exclusion_identity() TO service_role;

-- Exact observed function body MD5 043b13610570a95efa49975299a123b2.
REVOKE ALL ON FUNCTION public.validate_source_passage() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.validate_source_passage() TO service_role;

-- Exact observed function body MD5 d9fa14687aa0b2afac161f4c6814781d.
REVOKE ALL ON FUNCTION public.viewer_replace_analysis(bigint,text,jsonb,text,jsonb,uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.viewer_replace_analysis(bigint,text,jsonb,text,jsonb,uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.viewer_replace_analysis(bigint,text,jsonb,text,jsonb,uuid) TO authenticated;

-- Exact observed function body MD5 ace9c01a5df4556170e29f291bf0ed51.
REVOKE ALL ON FUNCTION public.viewer_undo_vocabulary_save(uuid,jsonb,uuid[]) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.viewer_undo_vocabulary_save(uuid,jsonb,uuid[]) TO service_role;

GRANT EXECUTE ON FUNCTION public.viewer_undo_vocabulary_save(uuid,jsonb,uuid[]) TO authenticated;

-- Synthetic sequence ACL scaffolding: sequence catalog was not part of M09.
-- Required for local identity inserts; table/RLS privileges remain observed.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
COMMIT;
`;

async function verifyModernCatalog() {
  const modern = new PGlite();
  const queryRows = async (sql, params = []) => (await modern.query(sql, params)).rows;
  async function asRole(role, owner = null) {
    await modern.exec('RESET ROLE');
    await modern.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [owner || '']);
    if (role) await modern.exec(`SET ROLE ${role}`);
  }
  const readCapabilities = async () => (await queryRows('SELECT public.learning_language_capabilities() AS result'))[0].result;
  const modernSave = async (w, s = source, id = null, meaning = null) => (await queryRows('SELECT public.save_vocabulary_context($1,$2,$3,$4) AS result', [w, s, id, meaning]))[0].result;
  const saveFor = (owner, w, s = source) => modern.query('SELECT public.save_vocabulary_context_for($1,$2,$3,NULL,NULL)', [owner, w, s]);
  const classJson = { metadata: { team: { key: 'class-one', day: '1' } }, sequence: [], dictionary: {} };
  const classSource = { kind: 'class', quote: 'Class source.', locator: { team: 'class-one', materialId: '11', tokenId: 't1' } };
  const classWord = { word_text: 'classword', meaning: 'class meaning', language: 'English' };
  const classroom = async (w = classWord, initial = null, generation = 2, raw = 'Class source.', json = classJson, s = classSource) => (await queryRows(
    'SELECT public.classroom_save_vocabulary($1,10,$2,11,$3,$4,$5,$6,$7,NULL,NULL) AS result', [a, generation, raw, json, w, s, initial]))[0].result;
  const fullSnapshot = async () => ({
    vocabulary: await queryRows('SELECT * FROM public.user_vocabulary ORDER BY id'),
    contexts: await queryRows('SELECT * FROM public.vocabulary_contexts ORDER BY id'),
    known: await queryRows('SELECT * FROM public.user_known_words ORDER BY user_id,lang,word_text'),
    exclusions: await queryRows('SELECT * FROM public.vocabulary_exclusions ORDER BY id'),
    events: await queryRows('SELECT * FROM public.review_events ORDER BY id'),
    materials: await queryRows('SELECT * FROM public.reading_materials ORDER BY id'),
    pdfs: await queryRows('SELECT * FROM public.uploaded_pdfs ORDER BY id'),
  });
  const immutableCatalog = async () => ({
    functions: await queryRows(`SELECT oid::regprocedure::text signature,pg_get_functiondef(oid) definition,proacl::text acl,proowner
      FROM pg_proc WHERE oid IN ('public.save_vocabulary_context(jsonb,jsonb,uuid,text)'::regprocedure,
      'public.classroom_save_vocabulary(uuid,bigint,integer,bigint,text,jsonb,jsonb,jsonb,jsonb,uuid,text)'::regprocedure,
      'public.viewer_replace_analysis(bigint,text,jsonb,text,jsonb,uuid)'::regprocedure,
      'public.viewer_undo_vocabulary_save(uuid,jsonb,uuid[])'::regprocedure) ORDER BY signature`),
    views: await queryRows("SELECT relname,pg_get_viewdef(oid,true) definition,reloptions FROM pg_class WHERE relname IN ('active_vocabulary','vocabulary_with_exclusions') ORDER BY relname"),
    classChecks: await queryRows("SELECT conname,pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conrelid='public.vocabulary_contexts'::regclass AND conname IN ('vocabulary_contexts_kind_check','vocabulary_contexts_check') ORDER BY conname"),
    policies: await queryRows("SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE tablename IN ('user_vocabulary','review_events','vocabulary_contexts') ORDER BY tablename,policyname"),
    cardColumns: await queryRows("SELECT attname,atttypid,atttypmod,attnotnull,pg_get_expr(adbin,adrelid) default_value FROM pg_attribute LEFT JOIN pg_attrdef ON adrelid=attrelid AND adnum=attnum WHERE attrelid='public.user_vocabulary'::regclass AND attnum>0 AND NOT attisdropped ORDER BY attnum"),
    sourceAcls: await queryRows("SELECT relname,relacl::text acl FROM pg_class WHERE relname IN ('reading_materials','uploaded_pdfs') ORDER BY relname"),
  });
  const allPrivileges = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'];
  const grants = async role => queryRows(`SELECT c.relname,p.privilege,has_table_privilege($1,c.oid,p.privilege) allowed FROM pg_class c
    CROSS JOIN unnest($2::text[]) p(privilege) WHERE c.relnamespace='public'::regnamespace
    AND c.relname IN ('user_vocabulary','review_events','user_known_words','vocabulary_contexts','vocabulary_exclusions','active_vocabulary','vocabulary_with_exclusions') ORDER BY c.relname,p.privilege`, [role, allPrivileges]);
  async function expectPreflightFailure(change, error) {
    await asRole(null);
    await modern.exec('BEGIN');
    await modern.exec(change);
    await assert.rejects(modern.exec(support), error);
    await modern.exec('ROLLBACK');
  }
  async function testDrift(change, action) {
    await asRole(null); await modern.exec('BEGIN'); await modern.exec(change);
    await asRole('authenticated', a);
    assert.deepEqual(await readCapabilities(), flags(false));
    await modern.exec('SAVEPOINT denied'); await assert.rejects(action(), /korean_learning_not_ready/);
    await modern.exec('ROLLBACK TO SAVEPOINT denied; RELEASE SAVEPOINT denied');
    await modern.exec('RESET ROLE; ROLLBACK');
    await asRole('authenticated', a); assert.deepEqual(await readCapabilities(), flags(true));
  }
  try {
    await modern.exec(modernFixtureSql);
    await modern.exec(`INSERT INTO auth.users VALUES('${a}'),('${b}'); INSERT INTO public.profiles VALUES('${a}'),('${b}');
      INSERT INTO public.reading_materials(id,owner_id,visibility,title,raw_text,processed_json) VALUES
      (1,'${a}','private','A','책을 읽어요. 책을 읽어요.','{"sequence":[],"dictionary":{}}'),
      (2,'${b}','private','B','Private B.','{}'),(3,'${b}','public','Public','Public source.','{}'),
      (10,'${b}','private','Class root','Root','{"metadata":{"team":{"root":true,"key":"class-one","pwGen":2}}}');`);
    await modern.query('INSERT INTO public.reading_materials(id,owner_id,visibility,title,raw_text,processed_json) VALUES(11,$1,\'private\',\'Class material\',\'Class source.\',$2)', [b, classJson]);
    await modern.query(`INSERT INTO public.user_vocabulary(user_id,word_text,base_form,meaning,language,status,interval,ease_factor,repetitions,next_review_at,last_reviewed_at,last_review,source_sentence,source_ref,etym,hanja,material_id)
      VALUES($1,'books','book','edited legacy meaning','English','Review',30,8.1,7,'2026-10-10','2026-09-01','2026-08-25','old source','legacy-ref','legacy etym','legacy hanja',1)`, [a]);
    await asRole('authenticated', a);
    await modernSave({ word_text: 'book', meaning: 'edited legacy meaning', language: 'English' });
    await modern.query("INSERT INTO public.review_events(user_id,lang,source,item_key,correct,detail,created_at) VALUES($1,'English','vocab','books',true,'{\"legacy\":true}','2026-09-01')", [a]);
    await modern.query("INSERT INTO public.user_known_words(user_id,lang,word_text) VALUES($1,'en','books'),($1,'ko','이미앎')", [a]);
    await asRole('service_role');
    const priorClass = await classroom({ ...classWord, word_text: 'classlegacy' }, calculateFSRS(3));
    assert.equal(priorClass.created, true);
    await asRole(null); await modern.exec("SET search_path=''");
    const before = await fullSnapshot();
    const preserved = await immutableCatalog();
    const serviceBefore = await grants('service_role');
    const authenticatedBefore = await grants('authenticated');

    await check('modern audited preflight rejects shared-body/owner/ACL/class/source drift and leaves baseline data intact', async () => {
      const saveDefinition = (await queryRows("SELECT pg_get_functiondef('public.save_vocabulary_context_for(uuid,jsonb,jsonb,uuid,text)'::regprocedure) definition"))[0].definition;
      await expectPreflightFailure(saveDefinition.replace('p_confirm_meaning text DEFAULT NULL::text', "p_confirm_meaning text DEFAULT 'unrequested confirmation'::text"), /unexpected_modern_function/);
      await expectPreflightFailure('ALTER FUNCTION public.save_vocabulary_context_for(uuid,jsonb,jsonb,uuid,text) SECURITY DEFINER', /unexpected_modern_function/);
      await expectPreflightFailure('ALTER FUNCTION public.classroom_save_vocabulary(uuid,bigint,integer,bigint,text,jsonb,jsonb,jsonb,jsonb,uuid,text) OWNER TO authenticated', /unexpected_modern_function/);
      await expectPreflightFailure('GRANT EXECUTE ON FUNCTION public.classroom_save_vocabulary(uuid,bigint,integer,bigint,text,jsonb,jsonb,jsonb,jsonb,uuid,text) TO authenticated', /unexpected_modern_function_acl/);
      await expectPreflightFailure('ALTER TABLE public.vocabulary_contexts DROP CONSTRAINT vocabulary_contexts_check', /missing_constraint/);
      await expectPreflightFailure('DROP POLICY vocabulary_class_context_read ON public.vocabulary_contexts', /unexpected_class_policy/);
      await expectPreflightFailure('ALTER TABLE public.reading_materials DISABLE TRIGGER validate_source_passage', /unexpected_modern_source_trigger/);
      await expectPreflightFailure('CREATE TRIGGER unknown_source BEFORE UPDATE ON public.reading_materials FOR EACH ROW EXECUTE FUNCTION public.protect_composer_source()', /unexpected_modern_source_trigger/);
      await expectPreflightFailure('GRANT SELECT(word_text) ON public.user_vocabulary TO anon', /unexpected_learning_column_acl/);
      await expectPreflightFailure('GRANT SELECT ON public.user_vocabulary TO authenticated WITH GRANT OPTION', /unexpected_modern_relation_acl/);
      await expectPreflightFailure('GRANT EXECUTE ON FUNCTION public.guard_excluded_review_event() TO service_role WITH GRANT OPTION', /unexpected_modern_function_grant_option/);
      await expectPreflightFailure('ALTER ROLE service_role NOBYPASSRLS', /unsupported_service_role/);
      assert.deepEqual(await fullSnapshot(), before);
    });
    await modern.exec(support);
    await check('modern apply preserves22-column rows/23-column views/class schema/functions/service ACLs and minimally reduces unsafe grants', async () => {
      const after = await fullSnapshot();
      assert.deepEqual({ ...after, exclusions: before.exclusions }, before);
      assert.equal(after.exclusions.length, before.exclusions.length + 1);
      assert.deepEqual(await immutableCatalog(), preserved);
      assert.deepEqual(await grants('service_role'), serviceBefore);
      assert.deepEqual(await grants('authenticated'), authenticatedBefore.map(row => ({ ...row, allowed: row.privilege === 'TRUNCATE' && ['user_vocabulary', 'review_events', 'user_known_words'].includes(row.relname) ? false : row.allowed })));
      for (const row of await grants('anon')) assert.equal(row.allowed, false);
      assert.equal(Object.keys(before.vocabulary[0]).length, 22);
      assert.equal((await queryRows("SELECT count(*)::int n FROM pg_attribute WHERE attrelid='public.active_vocabulary'::regclass AND attnum>0 AND NOT attisdropped"))[0].n, 23);
      await asRole('authenticated', a); assert.deepEqual(await readCapabilities(), flags(true));
      await asRole('service_role'); await assert.rejects(readCapabilities(), /permission denied/);
      await asRole('anon'); await assert.rejects(queryRows('SELECT * FROM public.user_vocabulary'), /permission denied/);
      await assert.rejects(queryRows('SELECT * FROM public.review_events'), /permission denied/);
    });
    let saved;
    await check('modern old-client wrapper and owner-aware path enforce owner/private-source conflicts and initialize only new Korean cards', async () => {
      await asRole('authenticated', a);
      await assert.rejects(saveFor(b, word), /login_required/);
      await assert.rejects(saveFor(a, classWord, classSource), /login_required/);
      await assert.rejects(modernSave({ ...word, word_text: 'private' }, { ...source, materialId: '2' }), /row-level security/);
      await assert.rejects(modernSave({ ...word, word_text: 'books' }), /vocabulary_language_conflict/);
      const stats = calculateFSRS(3);
      saved = await modernSave({ ...word, ...stats });
      const card = (await queryRows('SELECT * FROM public.user_vocabulary WHERE id=$1', [saved.vocabularyId]))[0];
      assert.equal(saved.created, true); assert.equal(card.last_reviewed_at, null);
      assert.ok(card.last_review instanceof Date); // Existing modern default is retained.
      assert.equal(card.next_review_at.toISOString(), stats.next_review_at);
      assert.equal((await queryRows('SELECT * FROM public.review_events')).length, 1);
      for (const [explanationLocale, translation] of [['ko', '책'], ['zh-CN', '书'], ['zh-TW', '書']]) {
        assert.equal((await modernSave({ ...word, ...calculateFSRS(1), explanationLocale }, { ...source, translation })).contextAdded, false);
      }
      assert.deepEqual((await queryRows('SELECT * FROM public.user_vocabulary WHERE id=$1', [saved.vocabularyId]))[0], card);
      await modern.query('UPDATE public.user_vocabulary SET meaning=\'edited Korean\' WHERE id=$1', [saved.vocabularyId]);
      const edited = (await queryRows('SELECT * FROM public.user_vocabulary WHERE id=$1', [saved.vocabularyId]))[0];
      await assert.rejects(modernSave(word), /vocabulary_meaning_conflict/);
      await modernSave(word, { ...source, quote: 'Other quote.' }, saved.vocabularyId, 'edited Korean');
      assert.deepEqual((await queryRows('SELECT * FROM public.user_vocabulary WHERE id=$1', [saved.vocabularyId]))[0], edited);
      await asRole('authenticated', b);
      assert.equal((await queryRows('SELECT * FROM public.vocabulary_contexts')).length, 0);
      await assert.rejects(modern.query('INSERT INTO public.user_known_words(user_id,lang,word_text) VALUES($1,\'ko\',\'forged\')', [a]), /row-level security/);
    });
    await check('service class saves with null learner JWT preserve initial stats/context visibility/conflicts and reject Korean class', async () => {
      await asRole('service_role');
      const stats = calculateFSRS(4);
      const created = await classroom(classWord, stats);
      assert.equal(created.created, true); assert.equal(Object.keys(created.word).length, 22);
      assert.equal(created.word.last_reviewed_at, null); assert.equal(created.word.ease_factor, stats.ease_factor);
      const oldCard = (await queryRows('SELECT * FROM public.user_vocabulary WHERE id=$1', [created.vocabularyId]))[0];
      const duplicate = await classroom(classWord, calculateFSRS(1));
      assert.equal(duplicate.created, false); assert.equal(duplicate.contextAdded, false);
      assert.deepEqual((await queryRows('SELECT * FROM public.user_vocabulary WHERE id=$1', [created.vocabularyId]))[0], oldCard);
      await assert.rejects(classroom(classWord, null, 3), /class_access_changed/);
      await assert.rejects(classroom(classWord, null, 2, 'changed raw'), /source_changed/);
      await assert.rejects(classroom(classWord, null, 2, 'Class source.', { changed: true }), /source_changed/);
      await assert.rejects(classroom(classWord, null, 2, 'Class source.', classJson, { ...classSource, locator: { team: 'wrong-team', materialId: '11' } }), /invalid_context/);
      await assert.rejects(classroom({ ...word, word_text: '한국어수업' }), /invalid_context/);
      await assert.rejects(saveFor(a, { ...word, word_text: '직접수업' }, classSource), /invalid_context/);
      await asRole('authenticated', a);
      assert.equal((await queryRows('SELECT * FROM public.vocabulary_contexts WHERE vocabulary_id=$1', [created.vocabularyId])).length, 1);
      assert.equal((await queryRows('SELECT * FROM public.reading_materials WHERE id=11')).length, 0);
      await assert.rejects(classroom(), /permission denied/);
    });
    await check('modern shared function/ACL/owner/source/index drift disables Korean readiness and guarded writes', async () => {
      const guardedSave = () => modernSave({ ...word, word_text: 'drift' });
      await testDrift('ALTER FUNCTION public.save_vocabulary_context_for(uuid,jsonb,jsonb,uuid,text) SECURITY DEFINER', guardedSave);
      await testDrift('ALTER FUNCTION public.save_vocabulary_context(jsonb,jsonb,uuid,text) STABLE', guardedSave);
      await testDrift('ALTER FUNCTION public.classroom_save_vocabulary(uuid,bigint,integer,bigint,text,jsonb,jsonb,jsonb,jsonb,uuid,text) SECURITY DEFINER', guardedSave);
      await testDrift('ALTER FUNCTION public.viewer_undo_vocabulary_save(uuid,jsonb,uuid[]) SECURITY INVOKER', guardedSave);
      await testDrift('REVOKE EXECUTE ON FUNCTION public.classroom_save_vocabulary(uuid,bigint,integer,bigint,text,jsonb,jsonb,jsonb,jsonb,uuid,text) FROM service_role', guardedSave);
      await testDrift('ALTER FUNCTION public.guard_korean_learning_contract() OWNER TO authenticated', guardedSave);
      await testDrift('ALTER TABLE public.reading_materials DISABLE TRIGGER validate_source_passage', guardedSave);
      await testDrift('DROP INDEX public.user_vocab_base_form_idx', guardedSave);
    });
    await check('modern known/exclusion restore preserves complete cards/events and owner review writes remain protected', async () => {
      await asRole('authenticated', a);
      const beforeCard = await queryRows('SELECT * FROM public.user_vocabulary ORDER BY id');
      await modern.query("INSERT INTO public.user_known_words(user_id,lang,word_text) VALUES($1,'ko','책')", [a]);
      await assert.rejects(modern.query('UPDATE public.user_vocabulary SET interval=40 WHERE id=$1', [saved.vocabularyId]), /vocabulary_excluded/);
      await assert.rejects(modern.query("INSERT INTO public.review_events(user_id,lang,source,item_key,correct,detail) VALUES($1,'Korean','vocab','책',true,$2)", [a, { word_id: saved.vocabularyId }]), /vocabulary_excluded/);
      await modern.query("DELETE FROM public.user_known_words WHERE user_id=$1 AND lang='ko' AND word_text='책'", [a]);
      await modern.query('SELECT public.set_vocabulary_exclusion(\'Korean\',\'책\',$1,true,NULL)', [saved.vocabularyId]);
      await modern.query('SELECT public.set_vocabulary_exclusion(\'Korean\',\'책\',$1,false,NULL)', [saved.vocabularyId]);
      assert.deepEqual(await queryRows('SELECT * FROM public.user_vocabulary ORDER BY id'), beforeCard);
      assert.equal((await queryRows('SELECT * FROM public.review_events')).length, 1);
      await modern.query('UPDATE public.user_vocabulary SET interval=41,last_reviewed_at=now() WHERE id=$1', [saved.vocabularyId]);
      await modern.query("INSERT INTO public.review_events(user_id,lang,source,item_key,correct,detail) VALUES($1,'Korean','vocab','책',true,$2)", [a, { word_id: saved.vocabularyId }]);
      await assert.rejects(modern.query("INSERT INTO public.review_events(user_id,lang,source,item_key,correct,detail) VALUES($1,'Korean','vocab','forged',true,'{}')", [b]), /row-level security/);
    });
    await check('modern apply/rollback/reapply retain all rows, class/service usability, invoker views, and protective reductions', async () => {
      await asRole('authenticated', a);
      await modern.query("INSERT INTO public.user_known_words(user_id,lang,word_text) VALUES($1,'ko','책')", [a]);
      await asRole(null); const frozen = await fullSnapshot();
      await expectPreflightFailure('ALTER FUNCTION public.guard_korean_learning_contract() OWNER TO authenticated', /unexpected_contract_guard/);
      await expectPreflightFailure('ALTER FUNCTION public.learning_language_capabilities() OWNER TO authenticated', /unexpected_capability_rpc/);
      await modern.exec(support); assert.deepEqual(await fullSnapshot(), frozen);
      await modern.exec(rollback); assert.deepEqual(await fullSnapshot(), frozen);
      assert.deepEqual(await immutableCatalog(), preserved);
      assert.deepEqual(await grants('service_role'), serviceBefore);
      for (const row of await grants('anon')) assert.equal(row.allowed, false);
      for (const row of await grants('authenticated')) if (row.privilege === 'TRUNCATE') assert.equal(row.allowed, false);
      await asRole('authenticated', a); assert.deepEqual(await readCapabilities(), flags(false));
      await assert.rejects(modernSave({ ...word, word_text: 'rollback' }), /korean_learning_not_ready/);
      await assert.rejects(modern.query("DELETE FROM public.user_known_words WHERE user_id=$1 AND lang='ko' AND word_text='책'", [a]), /korean_learning_not_ready/);
      await asRole('service_role'); assert.equal((await classroom({ ...classWord, word_text: 'classafterrollback' }, calculateFSRS(3))).created, true);
      await asRole(null); await modern.exec(support);
      await asRole('authenticated', a); assert.deepEqual(await readCapabilities(), flags(true));
      await modern.query("DELETE FROM public.user_known_words WHERE user_id=$1 AND lang='ko' AND word_text='책'", [a]);
      assert.equal((await queryRows('SELECT * FROM public.active_vocabulary WHERE id=$1', [saved.vocabularyId])).length, 1);
    });
  } finally {
    await modern.close();
  }
}

await verifyModernCatalog();
console.log(`${checks} PostgreSQL checks passed across legacy and audited modern catalogs; no live database touched.`);
