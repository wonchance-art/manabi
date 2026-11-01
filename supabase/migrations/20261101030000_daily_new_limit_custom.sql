-- LEVEL-NEW-CUSTOM-001 — 하루 새 단어 수를 직접 입력할 수 있게 허용 값을 「0–999 아무 정수 또는 9999(제한 없음)」로 넓힌다.
--   오너 결정 2026-11-01 KST 「옵션에 직접 입력하는 것도 넣고 싶은데」 → 시안 승인(상한 999 · 그 이상은 ∞). 클라이언트 판정 정본 =
--   src/lib/vocabStudy.js isNewPerDayValue(같은 범위). 고르기 칩(10 · 15 · 20 · 30 · ∞)과 단어장 설정 목록은 그대로다.
-- 적용 경로 = PR이 main에 병합되면 supabase-migrations.yml(db push)이 운영에 바로 적용한다 → 병합 승인 = 운영 적용 승인.
-- 실행 형태: db push는 파일 전체 + 이력 INSERT를 한 파이프라인(암묵 트랜잭션 하나)으로 보낸다 → BEGIN/COMMIT 없음, SET LOCAL 실효를
--   첫 DO가 확인. 어느 검사든 RAISE하면 이력까지 함께 롤백된다. 실행 주체 postgres, 앱 사용자(JWT)를 만들지 않는다.
-- 바꾸는 것 — 20261030050000(제한 없음)과 같은 세 자리의 목록을 범위로(그 밖의 본문 · 표 · 권한은 그대로):
--   ⑴ public.learning_configure_admission — 설정 요청 dailyNewLimit(본문 md5 dc409fa3… → e49594d2…).
--   ⑵ public.fsrs_apply_operation — 첫 문제 operation의 dailyNewLimit(본문 md5 f33171a7… → eaa4c9c3…).
--   ⑶ fsrs_private.admission_policies의 CHECK(daily_new_limit) — 운영 0행(2026-11-01 KST 집계)이라 기존 행 검증 부담 없음.
--   목록 자리를 「NOT IN (0–999를 jsonb로 + 9999)」 부분 질의로 바꾼다 — 바로 뒤 (…)::integer 변환 · 비교는 그대로이고, 문자열 "25" ·
--   1000 · 2.5는 지금처럼 거절된다(PGlite 실측). 본문은 다시 쓰지 않고 pg_get_functiondef 원문에서 그 목록 한 군데만 바꾼다
--   (정확히 한 번 · 바뀐 뒤 md5가 위 값 — 운영 원문에 같은 치환을 적용해 계산한 값). fsrs_private.settings의 CHECK는 전역 설정 행이라
--   그대로(이 경로가 쓰지 않음 — 20261030050000과 같다).
-- 재게시: core(⑵) · admission(⑴ · ⑶)만 지금 계산한 값으로. manual · activity profile · 한국어 capability 지문은 그대로(사후 검사).
-- 사전 검사가 받는 상태: ① 두 본문 = 제한 없음 판 md5 · CHECK = 9999 포함 목록 · 네 계약 일치 ② 이 파일을 이미 적용(no-op). 그 밖이면 RAISE.
-- 복원: docs/sql/daily-new-limit-custom-rollback.sql — 목록 밖 값(직접 넣은 값)을 그 아래 가장 가까운 목록 값으로 내린 뒤 세 자리를
--   9999 포함 목록으로, 같은 두 지문 재게시.
SET LOCAL search_path = '';
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '180s';

DO $runner$
BEGIN
 IF pg_catalog.current_setting('search_path') NOT IN ('', '""') OR pg_catalog.current_setting('lock_timeout') <> '5s'
    OR pg_catalog.current_setting('statement_timeout') <> '3min'
 THEN RAISE EXCEPTION 'new_custom: SET LOCAL not in effect (search_path=%, lock_timeout=%, statement_timeout=%)',
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
 IF n <> 1 THEN RAISE EXCEPTION 'new_custom: % has % copies of the limit list (expected 1)', p_sig, n; END IF;
 EXECUTE pg_catalog.replace(def, p_old, p_new);
END
$q$;

CREATE TEMP TABLE nc_state_before ON COMMIT DROP AS
 SELECT pg_temp.nc_contracts() AS contracts,
  pg_temp.nc_attrs('public.learning_configure_admission(uuid,jsonb)') AS configure_attrs,
  pg_temp.nc_attrs('public.fsrs_apply_operation(uuid,jsonb)') AS apply_attrs,
  (SELECT pg_catalog.jsonb_object_agg(p.oid::pg_catalog.regprocedure::text, pg_catalog.md5(p.prosrc)) FROM pg_catalog.pg_proc p
    WHERE p.oid IN ('public.fsrs_apply_learning_operation(uuid,jsonb)'::pg_catalog.regprocedure, 'public.learning_admit_legacy(uuid,jsonb)'::pg_catalog.regprocedure,
      'fsrs_private.admission_status(uuid,timestamp with time zone)'::pg_catalog.regprocedure, 'fsrs_private.guard_learning_first_question()'::pg_catalog.regprocedure,
      'public.fsrs_capabilities()'::pg_catalog.regprocedure, 'public.learning_language_capabilities()'::pg_catalog.regprocedure)) AS others;

DO $pre$
DECLARE c jsonb := pg_temp.nc_contracts(); cfg text := pg_temp.nc_md5('public.learning_configure_admission(uuid,jsonb)');
  app text := pg_temp.nc_md5('public.fsrs_apply_operation(uuid,jsonb)'); chk text := pg_temp.nc_check();
BEGIN
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'new_custom: learning contracts already drifted %', c; END IF;
 PERFORM fsrs_private.require_admission_integrity();
 IF cfg = 'dc409fa33d4c1ddfa413237c8c863676' AND app = 'f33171a765921d092a5961480e7c7f7c'
    AND chk = 'CHECK ((daily_new_limit = ANY (ARRAY[0, 5, 10, 15, 20, 30, 40, 9999])))' THEN
  RAISE NOTICE 'new_custom: needs change';
 ELSIF cfg = 'e49594d272b7336ab1a0047bcb0136ca' AND app = 'eaa4c9c3bb6c40970bf1ca9ed6560ea4'
    AND chk = 'CHECK ((((daily_new_limit >= 0) AND (daily_new_limit <= 999)) OR (daily_new_limit = 9999)))' THEN
  RAISE NOTICE 'new_custom: already applied — no-op';
 ELSE
  RAISE EXCEPTION 'new_custom: unreviewed state (configure %, apply %, check %)', cfg, app, chk;
 END IF;
END $pre$;

-- ── 변경(옛 상태일 때만).
DO $change$
BEGIN
 IF pg_temp.nc_md5('public.learning_configure_admission(uuid,jsonb)') = 'dc409fa33d4c1ddfa413237c8c863676' THEN
  PERFORM pg_temp.nc_patch('public.learning_configure_admission(uuid,jsonb)',
   $l$NOT IN('0'::jsonb,'5'::jsonb,'10'::jsonb,'15'::jsonb,'20'::jsonb,'30'::jsonb,'40'::jsonb,'9999'::jsonb)$l$,
   $l$NOT IN(SELECT pg_catalog.to_jsonb(g) FROM pg_catalog.generate_series(0,999) g UNION ALL SELECT '9999'::jsonb)$l$);
 END IF;
 IF pg_temp.nc_md5('public.fsrs_apply_operation(uuid,jsonb)') = 'f33171a765921d092a5961480e7c7f7c' THEN
  PERFORM pg_temp.nc_patch('public.fsrs_apply_operation(uuid,jsonb)',
   $l$NOT IN ('0'::jsonb,'5'::jsonb,'10'::jsonb,'15'::jsonb,'20'::jsonb,'30'::jsonb,'40'::jsonb,'9999'::jsonb)$l$,
   $l$NOT IN (SELECT pg_catalog.to_jsonb(g) FROM pg_catalog.generate_series(0,999) g UNION ALL SELECT '9999'::jsonb)$l$);
 END IF;
 IF pg_temp.nc_check() = 'CHECK ((daily_new_limit = ANY (ARRAY[0, 5, 10, 15, 20, 30, 40, 9999])))' THEN
  ALTER TABLE fsrs_private.admission_policies DROP CONSTRAINT admission_policies_daily_new_limit_check,
   ADD CONSTRAINT admission_policies_daily_new_limit_check CHECK ((daily_new_limit BETWEEN 0 AND 999) OR daily_new_limit = 9999);
 END IF;
 -- 재게시: core · admission을 지금 계산한 값으로(바뀔 때만, 정확히 1행).
 UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash_live() WHERE contract_hash IS DISTINCT FROM fsrs_private.contract_hash_live();
 UPDATE fsrs_private.admission_settings SET contract_hash = fsrs_private.admission_contract_hash_live()
  WHERE contract_hash IS DISTINCT FROM fsrs_private.admission_contract_hash_live();
END $change$;

DO $post$
DECLARE b record; c jsonb := pg_temp.nc_contracts();
BEGIN
 SELECT * INTO STRICT b FROM pg_temp.nc_state_before;
 IF pg_temp.nc_md5('public.learning_configure_admission(uuid,jsonb)') IS DISTINCT FROM 'e49594d272b7336ab1a0047bcb0136ca'
    OR pg_temp.nc_md5('public.fsrs_apply_operation(uuid,jsonb)') IS DISTINCT FROM 'eaa4c9c3bb6c40970bf1ca9ed6560ea4'
    OR pg_temp.nc_check() IS DISTINCT FROM 'CHECK ((((daily_new_limit >= 0) AND (daily_new_limit <= 999)) OR (daily_new_limit = 9999)))'
 THEN RAISE EXCEPTION 'new_custom: post state differs from the reviewed change'; END IF;
 -- 권한 · 소유자 · 속성은 그대로(CREATE OR REPLACE가 지킨다 — 확인).
 IF pg_temp.nc_attrs('public.learning_configure_admission(uuid,jsonb)') IS DISTINCT FROM b.configure_attrs
    OR pg_temp.nc_attrs('public.fsrs_apply_operation(uuid,jsonb)') IS DISTINCT FROM b.apply_attrs
 THEN RAISE EXCEPTION 'new_custom: function attributes or grants changed'; END IF;
 -- 값을 비교만 하는 함수 · capability는 손대지 않았다.
 IF (SELECT pg_catalog.jsonb_object_agg(p.oid::pg_catalog.regprocedure::text, pg_catalog.md5(p.prosrc)) FROM pg_catalog.pg_proc p
    WHERE p.oid IN ('public.fsrs_apply_learning_operation(uuid,jsonb)'::pg_catalog.regprocedure, 'public.learning_admit_legacy(uuid,jsonb)'::pg_catalog.regprocedure,
      'fsrs_private.admission_status(uuid,timestamp with time zone)'::pg_catalog.regprocedure, 'fsrs_private.guard_learning_first_question()'::pg_catalog.regprocedure,
      'public.fsrs_capabilities()'::pg_catalog.regprocedure, 'public.learning_language_capabilities()'::pg_catalog.regprocedure)) IS DISTINCT FROM b.others
 THEN RAISE EXCEPTION 'new_custom: an untouched function changed'; END IF;
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'new_custom: contracts not consistent after repin %', c; END IF;
 IF c->'manual' IS DISTINCT FROM b.contracts->'manual' OR c->'profile' IS DISTINCT FROM b.contracts->'profile'
 THEN RAISE EXCEPTION 'new_custom: manual or profile pin moved'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
END $post$;

-- ── 캐시 갱신을 지금 실행해 본다(커밋 때 할 일과 같은 함수 — 20261023170000). 이 뒤의 DDL은 임시 객체 DROP뿐이라 캐시를 무효로 만들지 않는다.
SET CONSTRAINTS fsrs_private.contract_cache_refresh IMMEDIATE;
SET CONSTRAINTS fsrs_private.contract_cache_refresh DEFERRED;

DO $cache$
DECLARE k record;
BEGIN
 SELECT * INTO STRICT k FROM fsrs_private.contract_cache;
 IF NOT k.valid THEN RAISE EXCEPTION 'new_custom: refresh did not validate the contract cache'; END IF;
 IF (SELECT s.contract_hash FROM fsrs_private.settings s) IS DISTINCT FROM k.core
    OR (SELECT a.contract_hash FROM fsrs_private.admission_settings a) IS DISTINCT FROM k.admission
 THEN RAISE EXCEPTION 'new_custom: cached core/admission differ from the pins'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
END $cache$;

DROP FUNCTION pg_temp.nc_patch(text, text, text); DROP FUNCTION pg_temp.nc_check(); DROP FUNCTION pg_temp.nc_attrs(text);
DROP FUNCTION pg_temp.nc_md5(text); DROP FUNCTION pg_temp.nc_contracts();
DROP TABLE pg_temp.nc_state_before;
