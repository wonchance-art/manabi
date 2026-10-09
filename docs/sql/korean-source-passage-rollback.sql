-- Restore for korean-source-passage.sql (KO-PASSAGE-001); explicit reviewed application.
-- Puts back the four-language lists of 20260908060607_source_passage_study.sql in
--   public.validate_source_passage() and public.open_source_passage(bigint,jsonb,text,text).
-- Non-destructive: the trigger runs BEFORE INSERT only, so Korean passages that already exist keep
-- their rows, analysis, and learning records; only new Korean passages are refused again.
-- Deploy the client that hides Korean passages before running this, or users see the language error.
-- Like the apply file, the capability fingerprint of korean-learning-support.sql is checked before the change
-- (a drifted catalog aborts) and republished after it in the same transaction, so Korean learning stays ready.
-- Unknown installed bodies or attributes abort the whole transaction. Re-running after success is a no-op.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL search_path='';
DO $restore$
DECLARE
  r record;
  p pg_catalog.pg_proc%ROWTYPE;
  q pg_catalog.pg_proc%ROWTYPE;
  c pg_catalog.pg_proc%ROWTYPE;
  d pg_catalog.pg_proc%ROWTYPE;
  src text;
  fingerprint text;
  published text;
  live_before text;
  live_after text;
  cap_src text;
  -- korean-learning-support.sql publishes the constant into this one line; the rest of the body is pinned.
  cap_line constant text := 'ready:=live_hash= ''([0-9a-f]{32})''';
  cap_template_md5 constant text := '4a497440fb53bc1a27c1975875c7d737';
  from_list constant text := 'NOT IN (''Japanese'',''Chinese'',''English'',''French'',''Korean'')';
  to_list constant text := 'NOT IN (''Japanese'',''Chinese'',''English'',''French'')';
BEGIN
  -- 1. Capability RPC: pinned body, and the live catalog must equal what it publishes.
  SELECT * INTO c FROM pg_catalog.pg_proc WHERE oid = pg_catalog.to_regprocedure('public.learning_language_capabilities()');
  IF NOT FOUND THEN RAISE EXCEPTION 'korean_passage_capability_missing'; END IF;
  IF c.prosecdef OR c.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[] OR c.provolatile <> 's'
    OR c.prolang IS DISTINCT FROM (SELECT oid FROM pg_catalog.pg_language WHERE lanname = 'plpgsql')
    OR c.prorettype IS DISTINCT FROM 'jsonb'::pg_catalog.regtype OR c.proretset OR c.pronargs <> 0
  THEN RAISE EXCEPTION 'korean_passage_unexpected_capability_attributes'; END IF;
  IF pg_catalog.md5(pg_catalog.regexp_replace(c.prosrc, cap_line, 'ready:=live_hash= ''<hash>''')) <> cap_template_md5
  THEN RAISE EXCEPTION 'korean_passage_unexpected_capability_body'; END IF;
  published := pg_catalog.substring(c.prosrc, cap_line);
  fingerprint := pg_catalog.substring(c.prosrc, '(WITH RECURSIVE .*FROM objects) INTO live_hash;');
  IF published IS NULL OR fingerprint IS NULL THEN RAISE EXCEPTION 'korean_passage_unexpected_capability_body'; END IF;
  EXECUTE fingerprint INTO live_before;
  IF live_before IS DISTINCT FROM published THEN RAISE EXCEPTION 'korean_passage_capability_not_ready'; END IF;

  -- 2. The two language lists.
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
    src := pg_catalog.replace(p.prosrc, from_list, to_list);
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

  -- 3. Republish only the fingerprint constant (same query, same oid/owner/ACL/attributes).
  EXECUTE fingerprint INTO live_after;
  IF live_after IS DISTINCT FROM published THEN
    cap_src := pg_catalog.replace(c.prosrc, pg_catalog.quote_literal(published), pg_catalog.quote_literal(live_after));
    EXECUTE pg_catalog.format(
      'CREATE OR REPLACE FUNCTION public.learning_language_capabilities() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '''' AS %L',
      cap_src);
  END IF;
  SELECT * INTO d FROM pg_catalog.pg_proc WHERE oid = pg_catalog.to_regprocedure('public.learning_language_capabilities()');
  IF d.oid IS DISTINCT FROM c.oid OR d.proowner IS DISTINCT FROM c.proowner OR d.proacl IS DISTINCT FROM c.proacl
    OR d.prosecdef IS DISTINCT FROM c.prosecdef OR d.proconfig IS DISTINCT FROM c.proconfig
    OR d.provolatile IS DISTINCT FROM c.provolatile OR d.proparallel IS DISTINCT FROM c.proparallel
    OR d.proleakproof IS DISTINCT FROM c.proleakproof OR d.proisstrict IS DISTINCT FROM c.proisstrict
    OR pg_catalog.md5(pg_catalog.regexp_replace(d.prosrc, cap_line, 'ready:=live_hash= ''<hash>''')) <> cap_template_md5
    OR pg_catalog.substring(d.prosrc, cap_line) IS DISTINCT FROM live_after
  THEN RAISE EXCEPTION 'korean_passage_capability_postcondition'; END IF;
  EXECUTE fingerprint INTO live_before;
  IF live_before IS DISTINCT FROM live_after THEN RAISE EXCEPTION 'korean_passage_capability_postcondition'; END IF;
END;
$restore$;
COMMIT;
