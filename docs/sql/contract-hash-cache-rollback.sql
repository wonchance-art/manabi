-- DB-LOAD C 복원 — 20261023100000_contract_hash_cache.sql을 되돌린다: 지문 함수 넷을 운영 원문(_live 본문)으로 원래 이름에 되돌리고,
-- 캐시 표 · 이벤트 트리거 · 보조 함수를 지운 뒤 manual → core → admission 재게시. 세 게시값은 적용 전 값으로 정확히 돌아온다(PGlite 검사).
-- 이 파일은 마이그레이션이 아니다(docs/sql) — db push가 적용하지 않는다. 운영 적용은 SQL 편집기에서 본문 그대로(한 트랜잭션).
-- 실행 형태: BEGIN/COMMIT 없음, SET LOCAL 실효를 첫 DO가 확인. 어느 검사든 RAISE하면 전체가 롤백된다. 실행 주체 postgres.
-- 학습자 행은 전후 snapshot 비교용 임시 테이블에만 담고 끝에서 지운다.
SET LOCAL search_path = '';
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '180s';

DO $runner$
BEGIN
 IF pg_catalog.current_setting('search_path') NOT IN ('', '""') OR pg_catalog.current_setting('lock_timeout') <> '5s'
    OR pg_catalog.current_setting('statement_timeout') <> '3min'
 THEN RAISE EXCEPTION 'contract_cache_r: SET LOCAL not in effect (search_path=%, lock_timeout=%, statement_timeout=%)',
   pg_catalog.current_setting('search_path'), pg_catalog.current_setting('lock_timeout'), pg_catalog.current_setting('statement_timeout');
 END IF;
END $runner$;

CREATE FUNCTION pg_temp.ccr_contracts() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object(
  'ok', s.contract_hash IS NOT DISTINCT FROM fsrs_private.contract_hash()
    AND m.contract_hash IS NOT DISTINCT FROM fsrs_private.manual_contract_hash()
    AND a.contract_hash IS NOT DISTINCT FROM fsrs_private.admission_contract_hash()
    AND t.profile_contract_hash IS NOT DISTINCT FROM fsrs_private.activity_profile_hash(),
  'core', s.contract_hash, 'manual', m.contract_hash, 'admission', a.contract_hash, 'profile', t.profile_contract_hash)
 FROM fsrs_private.settings s, fsrs_private.manual_save_settings m, fsrs_private.admission_settings a, fsrs_private.activity_settings t
$q$;
CREATE FUNCTION pg_temp.ccr_fn(p_sig text) RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object('md5', pg_catalog.md5(p.prosrc), 'oid', p.oid,
  'attrs', pg_catalog.jsonb_build_array(p.proowner, p.proacl, p.prosecdef, p.proconfig, p.provolatile, p.proparallel,
           p.proleakproof, p.proisstrict, p.prolang, p.prorettype, p.proretset, p.procost, p.prorows, p.prokind,
           pg_catalog.pg_get_function_arguments(p.oid)))
 FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure(p_sig)
$q$;
CREATE FUNCTION pg_temp.ccr_original(p_name text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $q$
 SELECT CASE p_name WHEN 'contract_hash' THEN 'b43887acc3619ca718b0912b15f833af' WHEN 'manual_contract_hash' THEN '9c59598d3a669aa34da38344f514fae6'
  WHEN 'admission_contract_hash' THEN 'ef7227c3f7d3ff47760d9ce06c844231' WHEN 'activity_profile_hash' THEN '2c3b288d2739925159418048da75a65d' END
$q$;
CREATE FUNCTION pg_temp.ccr_repin(p_which text) RETURNS void LANGUAGE plpgsql SET search_path = '' AS $q$
DECLARE n integer;
BEGIN
 IF p_which = 'core' THEN
  UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash() WHERE contract_hash IS DISTINCT FROM fsrs_private.contract_hash();
 ELSIF p_which = 'manual' THEN
  UPDATE fsrs_private.manual_save_settings SET contract_hash = fsrs_private.manual_contract_hash() WHERE contract_hash IS DISTINCT FROM fsrs_private.manual_contract_hash();
 ELSIF p_which = 'admission' THEN
  UPDATE fsrs_private.admission_settings SET contract_hash = fsrs_private.admission_contract_hash() WHERE contract_hash IS DISTINCT FROM fsrs_private.admission_contract_hash();
 ELSE RAISE EXCEPTION 'contract_cache_r: unknown pin %', p_which; END IF;
 GET DIAGNOSTICS n = ROW_COUNT;
 IF n > 1 THEN RAISE EXCEPTION 'contract_cache_r: % pin touched % rows', p_which, n; END IF;
END
$q$;

-- 받는 상태: 20261023100000을 적용한 상태만(_live 넷 = 운영 원문 · 캐시 표 있음 · 네 계약 동치).
DO $pre$
DECLARE c jsonb := pg_temp.ccr_contracts(); n text;
BEGIN
 IF pg_catalog.to_regclass('fsrs_private.contract_cache') IS NULL THEN RAISE EXCEPTION 'contract_cache_r: cache is not installed — nothing to restore'; END IF;
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'contract_cache_r: learning contracts drifted %', c; END IF;
 FOREACH n IN ARRAY ARRAY['contract_hash','manual_contract_hash','admission_contract_hash','activity_profile_hash'] LOOP
  IF pg_temp.ccr_fn('fsrs_private.' || n || '_live()')->>'md5' IS DISTINCT FROM pg_temp.ccr_original(n)
  THEN RAISE EXCEPTION 'contract_cache_r: fsrs_private.%_live() is not the production body', n; END IF;
 END LOOP;
END $pre$;

CREATE TEMP TABLE ccr_snapshot_before ON COMMIT DROP AS
 SELECT u.user_id AS actor, public.fsrs_vocabulary_snapshot(u.user_id) - 'now' AS body
 FROM (SELECT DISTINCT v.user_id FROM public.user_vocabulary v WHERE EXISTS (SELECT 1 FROM auth.users a WHERE a.id = v.user_id)) u;
CREATE TEMP TABLE ccr_state_before ON COMMIT DROP AS
 SELECT pg_temp.ccr_contracts() AS contracts, (SELECT pg_catalog.count(*) FROM ccr_snapshot_before) AS actors,
  pg_catalog.jsonb_build_object(
   'contract_hash', pg_temp.ccr_fn('fsrs_private.contract_hash()'), 'manual_contract_hash', pg_temp.ccr_fn('fsrs_private.manual_contract_hash()'),
   'admission_contract_hash', pg_temp.ccr_fn('fsrs_private.admission_contract_hash()'), 'activity_profile_hash', pg_temp.ccr_fn('fsrs_private.activity_profile_hash()')) AS fns;

-- 이벤트 트리거부터 지운다(그 뒤 DDL이 캐시 행을 건드리지 않게 — DROP EVENT TRIGGER 자체는 이벤트 트리거를 부르지 않는다).
DROP EVENT TRIGGER IF EXISTS fsrs_contract_cache_ddl;
DROP EVENT TRIGGER IF EXISTS fsrs_contract_cache_drop;

-- 원래 이름(같은 oid · 소유자 · ACL)에 운영 원문을 되돌린다 — 본문은 _live에서 그대로 복사.
DO $restore$
DECLARE n text; src text;
BEGIN
 FOREACH n IN ARRAY ARRAY['contract_hash','manual_contract_hash','admission_contract_hash','activity_profile_hash'] LOOP
  SELECT p.prosrc INTO STRICT src FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure('fsrs_private.' || n || '_live()');
  EXECUTE pg_catalog.format('CREATE OR REPLACE FUNCTION fsrs_private.%I() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '''' AS %L', n, src);
 END LOOP;
END $restore$;

DROP TABLE fsrs_private.contract_cache;
DROP FUNCTION fsrs_private.contract_cache_refresh();
DROP FUNCTION fsrs_private.contract_cache_invalidate();
DROP FUNCTION fsrs_private.contract_cache_invalidate_now();
DROP FUNCTION fsrs_private.contract_platform_fingerprint();
DROP FUNCTION fsrs_private.contract_hash_live();
DROP FUNCTION fsrs_private.manual_contract_hash_live();
DROP FUNCTION fsrs_private.admission_contract_hash_live();
DROP FUNCTION fsrs_private.activity_profile_hash_live();

DO $change$
BEGIN
 PERFORM pg_temp.ccr_repin('manual');
 PERFORM pg_temp.ccr_repin('core');
 PERFORM pg_temp.ccr_repin('admission');
END $change$;

DO $post$
DECLARE b record; c jsonb; n text; diffs integer;
BEGIN
 SELECT * INTO b FROM ccr_state_before;
 c := pg_temp.ccr_contracts();
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'contract_cache_r: contracts not consistent after restore %', c; END IF;
 IF c->>'profile' IS DISTINCT FROM b.contracts->>'profile' THEN RAISE EXCEPTION 'contract_cache_r: activity profile pin moved'; END IF;
 FOREACH n IN ARRAY ARRAY['contract_hash','manual_contract_hash','admission_contract_hash','activity_profile_hash'] LOOP
  IF pg_temp.ccr_fn('fsrs_private.' || n || '()')->>'md5' IS DISTINCT FROM pg_temp.ccr_original(n)
  THEN RAISE EXCEPTION 'contract_cache_r: fsrs_private.%() is not the production body', n; END IF;
  IF pg_temp.ccr_fn('fsrs_private.' || n || '()') - 'md5' IS DISTINCT FROM (b.fns->n) - 'md5'
  THEN RAISE EXCEPTION 'contract_cache_r: fsrs_private.%() attributes/owner/ACL changed', n; END IF;
 END LOOP;
 IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.pronamespace = 'fsrs_private'::pg_catalog.regnamespace
    AND (p.proname LIKE '%\_live' OR p.proname LIKE 'contract\_cache\_%' OR p.proname = 'contract_platform_fingerprint'))
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_event_trigger e WHERE e.evtname LIKE 'fsrs\_contract\_cache\_%')
 THEN RAISE EXCEPTION 'contract_cache_r: cache objects left'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
 SELECT pg_catalog.count(*)::integer INTO diffs FROM pg_temp.ccr_snapshot_before s WHERE (public.fsrs_vocabulary_snapshot(s.actor) - 'now') IS DISTINCT FROM s.body;
 IF diffs <> 0 THEN RAISE EXCEPTION 'contract_cache_r: snapshot output changed for % of % actor(s)', diffs, b.actors; END IF;
 RAISE NOTICE 'contract_cache_r: ok — pins % -> %; % actors identical', b.contracts, c, b.actors;
END $post$;

DROP FUNCTION pg_temp.ccr_repin(text); DROP FUNCTION pg_temp.ccr_fn(text); DROP FUNCTION pg_temp.ccr_contracts(); DROP FUNCTION pg_temp.ccr_original(text);
DROP TABLE pg_temp.ccr_state_before, pg_temp.ccr_snapshot_before;
