-- Korean source passage v1 (KO-PASSAGE-001); explicit reviewed application, not a migration.
-- Kept outside supabase/migrations on purpose: merging this file must not trigger the
-- production db-push workflow (known-word-controls.sql precedent, 2026-10-02).
--
-- Scope: add 'Korean' to the one language list in each of
--   public.validate_source_passage()                       (BEFORE INSERT trigger on reading_materials)
--   public.open_source_passage(bigint,jsonb,text,text)     (owner RPC)
-- installed by 20260908060607_source_passage_study.sql. Nothing else in either body changes:
-- the new body is computed from the installed body with one replace() and both md5 values are pinned.
-- No table, row, policy, grant, owner, trigger, or other function is touched. Existing rows are not read
-- or written. Korean vocabulary saves keep the korean-learning-support.sql capability checks
-- (a passage is a reading_materials row, so its saves stay kind='reading').
--
-- Unknown installed bodies or attributes abort the whole transaction. Re-running after success is a no-op.
-- Restore path: docs/sql/korean-source-passage-rollback.sql (Korean passages already created stay intact).
-- Note: korean-learning-support.sql pins the pre-change validate_source_passage md5 in its preflight, so
-- that already-applied file would refuse to re-run after this one. It must not be re-run anyway.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL search_path='';
DO $apply$
DECLARE
  r record;
  p pg_catalog.pg_proc%ROWTYPE;
  q pg_catalog.pg_proc%ROWTYPE;
  src text;
  old_list constant text := 'NOT IN (''Japanese'',''Chinese'',''English'',''French'')';
  new_list constant text := 'NOT IN (''Japanese'',''Chinese'',''English'',''French'',''Korean'')';
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('public.validate_source_passage()', 'public.validate_source_passage', '', 'trigger',
     '043b13610570a95efa49975299a123b2', 'dbae2ddf1a7d5e40b54eb8ed7834e4b8'),
    ('public.open_source_passage(bigint,jsonb,text,text)', 'public.open_source_passage',
     'p_parent bigint, p_source jsonb, p_text text, p_language text', 'jsonb',
     '099b30885e28aa9d888567cade758f39', 'ac4f6a7f38a6a51b249acebae485b1a9')
  ) AS v(sig, name, args, rettype, before_md5, after_md5) LOOP
    SELECT * INTO p FROM pg_catalog.pg_proc WHERE oid = pg_catalog.to_regprocedure(r.sig);
    IF NOT FOUND THEN RAISE EXCEPTION 'korean_passage_missing %', r.sig; END IF;
    IF p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[]
      OR p.prolang IS DISTINCT FROM (SELECT oid FROM pg_catalog.pg_language WHERE lanname = 'plpgsql')
      OR p.prorettype IS DISTINCT FROM r.rettype::pg_catalog.regtype OR p.proretset OR p.provolatile <> 'v'
    THEN RAISE EXCEPTION 'korean_passage_unexpected_attributes %', r.sig; END IF;
    IF pg_catalog.md5(p.prosrc) = r.after_md5 THEN CONTINUE; END IF; -- already applied
    IF pg_catalog.md5(p.prosrc) <> r.before_md5 THEN RAISE EXCEPTION 'korean_passage_unexpected_body %', r.sig; END IF;
    src := pg_catalog.replace(p.prosrc, old_list, new_list);
    IF pg_catalog.md5(src) <> r.after_md5 THEN RAISE EXCEPTION 'korean_passage_unexpected_result %', r.sig; END IF;
    EXECUTE pg_catalog.format(
      'CREATE OR REPLACE FUNCTION %s(%s) RETURNS %s LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS %L',
      r.name, r.args, r.rettype, src);
    SELECT * INTO q FROM pg_catalog.pg_proc WHERE oid = pg_catalog.to_regprocedure(r.sig);
    IF q.oid IS DISTINCT FROM p.oid OR pg_catalog.md5(q.prosrc) <> r.after_md5
      OR q.proowner IS DISTINCT FROM p.proowner OR q.proacl IS DISTINCT FROM p.proacl
      OR q.prosecdef IS DISTINCT FROM p.prosecdef OR q.proconfig IS DISTINCT FROM p.proconfig
      OR q.provolatile IS DISTINCT FROM p.provolatile OR q.proparallel IS DISTINCT FROM p.proparallel
      OR q.proleakproof IS DISTINCT FROM p.proleakproof OR q.proisstrict IS DISTINCT FROM p.proisstrict
    THEN RAISE EXCEPTION 'korean_passage_postcondition %', r.sig; END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid = 'public.reading_materials'::pg_catalog.regclass AND t.tgname = 'validate_source_passage'
      AND t.tgfoid = pg_catalog.to_regprocedure('public.validate_source_passage()')
      AND t.tgenabled = 'O' AND t.tgtype = 7 AND NOT t.tgisinternal)
  THEN RAISE EXCEPTION 'korean_passage_trigger_missing'; END IF;
END;
$apply$;
COMMIT;
