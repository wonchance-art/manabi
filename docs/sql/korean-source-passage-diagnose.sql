-- KO-PASSAGE-001 r2 diagnosis (2026-10-09). DIAGNOSTIC ONLY — ends in ROLLBACK, nothing persists.
-- Why: r2 applied in production published fingerprint = separately computed fingerprint (1c25…), yet the
-- authenticated app saw Korean disabled (M09 22:32 KST). This runs the r2 apply block inside one transaction,
-- captures the capability RPC's own fingerprint objects as the admin role and as authenticated (key + md5 only,
-- no definitions), and the RPC answer for each, before and after — then ROLLBACK.
-- Output: one final row `diagnosis` (jsonb) — answers · digests · role_diffs · changed_keys (tools return only the last SELECT).
-- The apply block below is byte-identical to docs/sql/korean-source-passage.sql at the same commit
-- (supabase/tests/korean-source-passage.mjs checks this).
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL search_path='';

-- Records, for the current role, the capability RPC's own fingerprint objects (key + md5 of value) and its answer.
CREATE TEMP TABLE ko_diag(stage text, who text, key text, h text) ON COMMIT DROP;
CREATE TEMP TABLE ko_answer(stage text, who text, answer text) ON COMMIT DROP;
GRANT SELECT, INSERT ON pg_temp.ko_diag, pg_temp.ko_answer TO authenticated;
CREATE FUNCTION pg_temp.ko_capture(stage text) RETURNS void LANGUAGE plpgsql AS $capture$
DECLARE q text; answer text;
BEGIN
  SELECT pg_catalog.substring(prosrc, '(WITH RECURSIVE .*FROM objects) INTO live_hash;') INTO q
    FROM pg_catalog.pg_proc WHERE oid = pg_catalog.to_regprocedure('public.learning_language_capabilities()');
  q := pg_catalog.replace(q, 'SELECT pg_catalog.md5(pg_catalog.jsonb_object_agg(key,val ORDER BY key)::text) FROM objects',
    'INSERT INTO pg_temp.ko_diag SELECT ' || pg_catalog.quote_literal(stage) || ', current_user, key, pg_catalog.md5(val::text) FROM objects');
  EXECUTE q;
  BEGIN
    answer := public.learning_language_capabilities()::text;
  EXCEPTION WHEN OTHERS THEN answer := 'ERROR ' || SQLSTATE || ' ' || SQLERRM;
  END;
  INSERT INTO pg_temp.ko_answer VALUES (stage, current_user, answer);
END $capture$;
GRANT EXECUTE ON FUNCTION pg_temp.ko_capture(text) TO authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);
SELECT pg_catalog.set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);
SELECT pg_temp.ko_capture('before');
SET LOCAL ROLE authenticated;
SELECT pg_temp.ko_capture('before');
RESET ROLE;
SET LOCAL search_path='';
DO $apply$
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
  from_list constant text := 'NOT IN (''Japanese'',''Chinese'',''English'',''French'')';
  to_list constant text := 'NOT IN (''Japanese'',''Chinese'',''English'',''French'',''Korean'')';
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
$apply$;
SELECT pg_temp.ko_capture('after');
SET LOCAL ROLE authenticated;
SELECT pg_temp.ko_capture('after');
RESET ROLE;
SET LOCAL search_path='';

-- 결과 ①~④: Management API / CLI / MCP는 마지막 SELECT만 돌려주므로(M09 실측 2026-10-09) 한 JSON에 묶는다.
--   answers 단계·역할별 응답 · digests 단계·역할별 키 수·digest · role_diffs 역할에 따라 다른 키 · changed_keys r2가 바꾼 키
SELECT pg_catalog.jsonb_build_object(
  'answers', (SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r)), '[]'::pg_catalog.jsonb) FROM (
SELECT stage, who, answer FROM pg_temp.ko_answer ORDER BY stage DESC, who
  ) r),
  'digests', (SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r)), '[]'::pg_catalog.jsonb) FROM (
SELECT stage, who, pg_catalog.count(*) AS keys, pg_catalog.md5(pg_catalog.string_agg(key || '=' || h, ',' ORDER BY key)) AS digest
  FROM pg_temp.ko_diag GROUP BY stage, who ORDER BY stage DESC, who
  ) r),
  'role_diffs', (SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r)), '[]'::pg_catalog.jsonb) FROM (
SELECT a.stage, COALESCE(a.key, b.key) AS key, a.h AS admin_h, b.h AS authenticated_h
  FROM (SELECT * FROM pg_temp.ko_diag WHERE who <> 'authenticated') a
  FULL JOIN (SELECT * FROM pg_temp.ko_diag WHERE who = 'authenticated') b ON a.stage = b.stage AND a.key = b.key
 WHERE a.h IS DISTINCT FROM b.h ORDER BY 1 DESC, 2
  ) r),
  'changed_keys', (SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r)), '[]'::pg_catalog.jsonb) FROM (
SELECT COALESCE(x.key, y.key) AS key, x.h AS before_h, y.h AS after_h
  FROM (SELECT * FROM pg_temp.ko_diag WHERE stage = 'before' AND who <> 'authenticated') x
  FULL JOIN (SELECT * FROM pg_temp.ko_diag WHERE stage = 'after' AND who <> 'authenticated') y ON x.key = y.key
 WHERE x.h IS DISTINCT FROM y.h ORDER BY 1
  ) r)
) AS diagnosis;
ROLLBACK;
