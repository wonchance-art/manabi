-- Restore for korean-source-passage.sql (KO-PASSAGE-001); explicit reviewed application.
-- Puts back the four-language lists of 20260908060607_source_passage_study.sql in
--   public.validate_source_passage() and public.open_source_passage(bigint,jsonb,text,text).
-- Non-destructive: the trigger runs BEFORE INSERT only, so Korean passages that already exist keep
-- their rows, analysis, and learning records; only new Korean passages are refused again.
-- Deploy the client that hides Korean passages before running this, or users see the language error.
-- Unknown installed bodies or attributes abort the whole transaction. Re-running after success is a no-op.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL search_path='';
DO $restore$
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
     'dbae2ddf1a7d5e40b54eb8ed7834e4b8', '043b13610570a95efa49975299a123b2'),
    ('public.open_source_passage(bigint,jsonb,text,text)', 'public.open_source_passage',
     'p_parent bigint, p_source jsonb, p_text text, p_language text', 'jsonb',
     'ac4f6a7f38a6a51b249acebae485b1a9', '099b30885e28aa9d888567cade758f39')
  ) AS v(sig, name, args, rettype, before_md5, after_md5) LOOP
    SELECT * INTO p FROM pg_catalog.pg_proc WHERE oid = pg_catalog.to_regprocedure(r.sig);
    IF NOT FOUND THEN RAISE EXCEPTION 'korean_passage_missing %', r.sig; END IF;
    IF p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[]
      OR p.prolang IS DISTINCT FROM (SELECT oid FROM pg_catalog.pg_language WHERE lanname = 'plpgsql')
      OR p.prorettype IS DISTINCT FROM r.rettype::pg_catalog.regtype OR p.proretset OR p.provolatile <> 'v'
    THEN RAISE EXCEPTION 'korean_passage_unexpected_attributes %', r.sig; END IF;
    IF pg_catalog.md5(p.prosrc) = r.after_md5 THEN CONTINUE; END IF; -- already restored
    IF pg_catalog.md5(p.prosrc) <> r.before_md5 THEN RAISE EXCEPTION 'korean_passage_unexpected_body %', r.sig; END IF;
    src := pg_catalog.replace(p.prosrc, new_list, old_list);
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
END;
$restore$;
COMMIT;
