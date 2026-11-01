-- LEVEL-NEW-CUSTOM-001 복원 — 20261101030000_daily_new_limit_custom.sql을 되돌린다: 직접 넣은 값(목록 밖)으로 고른 정책을 그 아래 가장
--   가까운 목록 값으로 내린 뒤 허용 값 세 곳을 「제한 없음」 판 목록으로, core · admission 재게시. 두 본문 · CHECK는 그 파일 전
--   (md5 dc409fa3… · f33171a7…)으로 정확히 돌아온다. core · admission 게시값은 그때 계산한 값이다(제약 OID가 지문 열쇠에 들어간다).
-- 순서: 앱이 목록 밖 값을 보내지 않게 먼저 되돌린다(배포 롤백). 그 전에 이 파일을 실행하면 직접 값을 고른 사람의 설정 요청이 거절된다.
-- 이 파일은 마이그레이션이 아니다(docs/sql) — db push가 적용하지 않는다. 운영 적용은 오너 승인 후 SQL 편집기에서 본문 그대로.
-- 실행 형태: SQL 편집기 한 번 실행 = 암묵 트랜잭션 하나 → BEGIN/COMMIT 없음, SET LOCAL 실효를 첫 DO가 확인. 어느 검사든 RAISE하면 전부 롤백.
SET LOCAL search_path = '';
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $runner$
BEGIN
 IF pg_catalog.current_setting('search_path') NOT IN ('', '""') OR pg_catalog.current_setting('lock_timeout') <> '5s'
    OR pg_catalog.current_setting('statement_timeout') <> '1min'
 THEN RAISE EXCEPTION 'new_custom_rollback: SET LOCAL not in effect (search_path=%, lock_timeout=%, statement_timeout=%)',
   pg_catalog.current_setting('search_path'), pg_catalog.current_setting('lock_timeout'), pg_catalog.current_setting('statement_timeout');
 END IF;
END $runner$;

-- ── 공통 도구(pg_temp, 이 세션 전용 · 끝에서 DROP).
CREATE FUNCTION pg_temp.nc_contracts() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object(
  'ok', s.contract_hash IS NOT DISTINCT FROM fsrs_private.contract_hash()
    AND m.contract_hash IS NOT DISTINCT FROM fsrs_private.manual_contract_hash()
    AND a.contract_hash IS NOT DISTINCT FROM fsrs_private.admission_contract_hash()
    AND t.profile_contract_hash IS NOT DISTINCT FROM fsrs_private.activity_profile_hash(),
  'core', s.contract_hash, 'manual', m.contract_hash, 'admission', a.contract_hash, 'profile', t.profile_contract_hash)
 FROM fsrs_private.settings s, fsrs_private.manual_save_settings m, fsrs_private.admission_settings a, fsrs_private.activity_settings t
$q$;
CREATE FUNCTION pg_temp.nc_md5(p_sig text) RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.md5(p.prosrc) FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure(p_sig)
$q$;
CREATE FUNCTION pg_temp.nc_attrs(p_sig text) RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_array(p.proowner, p.prosecdef, p.proconfig, p.provolatile, p.proparallel, p.proleakproof, p.proisstrict,
   p.prolang, p.prorettype, p.proretset, p.proacl::text)
 FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure(p_sig)
$q$;
CREATE FUNCTION pg_temp.nc_check() RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.pg_get_constraintdef(c.oid) FROM pg_catalog.pg_constraint c
 WHERE c.conrelid = 'fsrs_private.admission_policies'::pg_catalog.regclass AND c.conname = 'admission_policies_daily_new_limit_check'
$q$;
-- 함수 원문에서 목록 한 군데만 바꿔 같은 정의로 다시 만든다 — 정확히 한 번 나와야 한다.
CREATE FUNCTION pg_temp.nc_patch(p_sig text, p_old text, p_new text) RETURNS void LANGUAGE plpgsql SET search_path = '' AS $q$
DECLARE def text := pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(p_sig)); n integer;
BEGIN
 n := (pg_catalog.length(def) - pg_catalog.length(pg_catalog.replace(def, p_old, ''))) / pg_catalog.length(p_old);
 IF n <> 1 THEN RAISE EXCEPTION 'new_custom_rollback: % has % copies of the limit list (expected 1)', p_sig, n; END IF;
 EXECUTE pg_catalog.replace(def, p_old, p_new);
END
$q$;


DO $pre$
DECLARE c jsonb := pg_temp.nc_contracts();
BEGIN
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'new_custom_rollback: learning contracts drifted %', c; END IF;
 IF pg_temp.nc_md5('public.learning_configure_admission(uuid,jsonb)') IS DISTINCT FROM 'e49594d272b7336ab1a0047bcb0136ca'
    OR pg_temp.nc_md5('public.fsrs_apply_operation(uuid,jsonb)') IS DISTINCT FROM 'eaa4c9c3bb6c40970bf1ca9ed6560ea4'
    OR pg_temp.nc_check() IS DISTINCT FROM 'CHECK ((((daily_new_limit >= 0) AND (daily_new_limit <= 999)) OR (daily_new_limit = 9999)))'
 THEN RAISE EXCEPTION 'new_custom_rollback: not the applied state'; END IF;
END $pre$;

DO $change$
DECLARE manual text := (SELECT m.contract_hash FROM fsrs_private.manual_save_settings m);
  profile text := (SELECT t.profile_contract_hash FROM fsrs_private.activity_settings t);
BEGIN
 -- 직접 넣은 값(목록 밖)은 그 아래 가장 가까운 목록 값으로(41–999 → 40 · 정책 판본은 그대로 — 열린 첫 문제의 한도 대조가 깨지지 않게).
 UPDATE fsrs_private.admission_policies p SET daily_new_limit = (SELECT pg_catalog.max(x) FROM pg_catalog.unnest(ARRAY[0, 5, 10, 15, 20, 30, 40]) x
  WHERE x <= p.daily_new_limit) WHERE p.daily_new_limit <> ALL (ARRAY[0, 5, 10, 15, 20, 30, 40, 9999]);
 ALTER TABLE fsrs_private.admission_policies DROP CONSTRAINT admission_policies_daily_new_limit_check,
  ADD CONSTRAINT admission_policies_daily_new_limit_check CHECK (daily_new_limit = ANY (ARRAY[0, 5, 10, 15, 20, 30, 40, 9999]));
 PERFORM pg_temp.nc_patch('public.learning_configure_admission(uuid,jsonb)',
  $l$NOT IN(SELECT pg_catalog.to_jsonb(g) FROM pg_catalog.generate_series(0,999) g UNION ALL SELECT '9999'::jsonb)$l$,
  $l$NOT IN('0'::jsonb,'5'::jsonb,'10'::jsonb,'15'::jsonb,'20'::jsonb,'30'::jsonb,'40'::jsonb,'9999'::jsonb)$l$);
 PERFORM pg_temp.nc_patch('public.fsrs_apply_operation(uuid,jsonb)',
  $l$NOT IN (SELECT pg_catalog.to_jsonb(g) FROM pg_catalog.generate_series(0,999) g UNION ALL SELECT '9999'::jsonb)$l$,
  $l$NOT IN ('0'::jsonb,'5'::jsonb,'10'::jsonb,'15'::jsonb,'20'::jsonb,'30'::jsonb,'40'::jsonb,'9999'::jsonb)$l$);
 UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash_live() WHERE contract_hash IS DISTINCT FROM fsrs_private.contract_hash_live();
 UPDATE fsrs_private.admission_settings SET contract_hash = fsrs_private.admission_contract_hash_live()
  WHERE contract_hash IS DISTINCT FROM fsrs_private.admission_contract_hash_live();
 IF pg_temp.nc_md5('public.learning_configure_admission(uuid,jsonb)') IS DISTINCT FROM 'dc409fa33d4c1ddfa413237c8c863676'
    OR pg_temp.nc_md5('public.fsrs_apply_operation(uuid,jsonb)') IS DISTINCT FROM 'f33171a765921d092a5961480e7c7f7c'
 THEN RAISE EXCEPTION 'new_custom_rollback: bodies did not return to the original'; END IF;
 IF NOT (pg_temp.nc_contracts()->>'ok')::boolean
    OR (SELECT m.contract_hash FROM fsrs_private.manual_save_settings m) IS DISTINCT FROM manual
    OR (SELECT t.profile_contract_hash FROM fsrs_private.activity_settings t) IS DISTINCT FROM profile
 THEN RAISE EXCEPTION 'new_custom_rollback: contracts not consistent after repin'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
END $change$;

SET CONSTRAINTS fsrs_private.contract_cache_refresh IMMEDIATE;
SET CONSTRAINTS fsrs_private.contract_cache_refresh DEFERRED;

DROP FUNCTION pg_temp.nc_patch(text, text, text); DROP FUNCTION pg_temp.nc_check(); DROP FUNCTION pg_temp.nc_attrs(text);
DROP FUNCTION pg_temp.nc_md5(text); DROP FUNCTION pg_temp.nc_contracts();
