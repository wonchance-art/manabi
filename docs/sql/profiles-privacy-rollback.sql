-- PROFILES-PRIVACY-001 ② 복원 — 20261026010000_profiles_privacy.sql을 되돌린다: profiles 정책 · 표/열 권한을 그 파일 전 모양으로 정확히,
--   그리고 activity profile → admission 재게시.
-- 되돌아오는 것(운영 실측 2026-10-26 KST 모양 그대로 — 사후 검사가 바이트 단위로 대조):
--   정책 7개(anyone_read_basic_profile · profiles_select = public · USING true 다시 만듦, profiles_select_admin 지움, 나머지 넷 그대로) ·
--   relacl {postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}(항목 순서까지) ·
--   열 권한 없음(attacl NULL — 표 REVOKE가 열 권한도 함께 지운다).
-- 게시값: 지문 열쇠에 정책 oid가 들어 다시 만든 두 정책은 새 oid라 profile · admission 게시값은 그 파일 전 값(e892… · 운영 admission)과
--   같은 값이 아니다 — 그래서 상수로 박지 않고 지금 지문으로 재게시한다. oid를 뺀 profile 지문은 그 파일 전과 같다(supabase/tests/profiles-privacy.mjs).
--   core · manual은 그 파일이 건드리지 않았으므로 그대로다(사후 검사).
-- 순서: 앱은 바꿀 것이 없다(남의 행은 이미 public_profiles · 관리자는 is_admin 정책 · 서버 관리자 판별은 service role) — 이 SQL만 실행한다.
-- 이 파일은 마이그레이션이 아니다(docs/sql) — db push가 적용하지 않는다. 운영 적용은 오너 승인 후 SQL 편집기에서 본문 그대로.
-- 실행 형태: SQL 편집기 한 번 실행 = 암묵 트랜잭션 하나 → BEGIN/COMMIT 없음, SET LOCAL 실효를 첫 DO가 확인. 어느 검사든 RAISE하면 전부 롤백.
-- 이미 되돌린 상태(정책 · 권한이 그 파일 전 모양)에서 다시 실행하면 아무것도 바꾸지 않는다.
SET LOCAL search_path = '';
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $runner$
BEGIN
 IF pg_catalog.current_setting('search_path') NOT IN ('', '""') OR pg_catalog.current_setting('lock_timeout') <> '5s'
    OR pg_catalog.current_setting('statement_timeout') <> '1min'
 THEN RAISE EXCEPTION 'profiles_privacy_rollback: SET LOCAL not in effect (search_path=%, lock_timeout=%, statement_timeout=%)',
   pg_catalog.current_setting('search_path'), pg_catalog.current_setting('lock_timeout'), pg_catalog.current_setting('statement_timeout');
 END IF;
END $runner$;

CREATE FUNCTION pg_temp.pr_contracts() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object(
  'ok', s.contract_hash IS NOT DISTINCT FROM fsrs_private.contract_hash()
    AND m.contract_hash IS NOT DISTINCT FROM fsrs_private.manual_contract_hash()
    AND a.contract_hash IS NOT DISTINCT FROM fsrs_private.admission_contract_hash()
    AND t.profile_contract_hash IS NOT DISTINCT FROM fsrs_private.activity_profile_hash(),
  'core', s.contract_hash, 'manual', m.contract_hash, 'admission', a.contract_hash, 'profile', t.profile_contract_hash)
 FROM fsrs_private.settings s, fsrs_private.manual_save_settings m, fsrs_private.admission_settings a, fsrs_private.activity_settings t
$q$;
-- 마이그레이션의 pp_catalog와 같은 모양(정책 · 표 권한 · 열 권한).
CREATE FUNCTION pg_temp.pr_catalog() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object(
  'policies', (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(p.polname, p.polcmd, p.polpermissive,
      (SELECT pg_catalog.jsonb_agg(coalesce(r.rolname, 'public') ORDER BY coalesce(r.rolname, 'public')) FROM pg_catalog.unnest(p.polroles) x(roid)
        LEFT JOIN pg_catalog.pg_roles r ON r.oid = x.roid),
      pg_catalog.pg_get_expr(p.polqual, p.polrelid), pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid)) ORDER BY p.polname COLLATE "C")
    FROM pg_catalog.pg_policy p WHERE p.polrelid = 'public.profiles'::pg_catalog.regclass),
  'relacl', (SELECT c.relacl::text FROM pg_catalog.pg_class c WHERE c.oid = 'public.profiles'::pg_catalog.regclass),
  'attacl', (SELECT coalesce(pg_catalog.jsonb_object_agg(a.attname, a.attacl::text), '{}'::jsonb) FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = 'public.profiles'::pg_catalog.regclass AND a.attnum > 0 AND NOT a.attisdropped AND a.attacl IS NOT NULL))
$q$;
CREATE FUNCTION pg_temp.pr_expected(p_which text) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $q$
 SELECT CASE p_which
  WHEN 'before' THEN pg_catalog.jsonb_build_object(
   'policies', '[["Users can read own profile","r",true,["public"],"(auth.uid() = id)",null],
     ["Users can update own profile","w",true,["public"],"(auth.uid() = id)",null],
     ["anyone_read_basic_profile","r",true,["public"],"true",null],
     ["profiles_insert","a",true,["public"],null,"(auth.uid() = id)"],
     ["profiles_insert_student_only","a",false,["authenticated"],null,"(role = ''student''::text)"],
     ["profiles_select","r",true,["public"],"true",null],
     ["profiles_update","w",true,["public"],"(auth.uid() = id)",null]]'::jsonb,
   'relacl', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}',
   'attacl', '{}'::jsonb)
  WHEN 'after' THEN pg_catalog.jsonb_build_object(
   'policies', '[["Users can read own profile","r",true,["public"],"(auth.uid() = id)",null],
     ["Users can update own profile","w",true,["public"],"(auth.uid() = id)",null],
     ["profiles_insert","a",true,["public"],null,"(auth.uid() = id)"],
     ["profiles_insert_student_only","a",false,["authenticated"],null,"(role = ''student''::text)"],
     ["profiles_select_admin","r",true,["authenticated"],"( SELECT public.is_admin() AS is_admin)",null],
     ["profiles_update","w",true,["public"],"(auth.uid() = id)",null]]'::jsonb,
   'relacl', '{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,anon=r/postgres,authenticated=r/postgres}',
   'attacl', '{"id":"{authenticated=a/postgres}","display_name":"{authenticated=aw/postgres}",
     "onboarded":"{authenticated=w/postgres}","learning_language":"{authenticated=w/postgres}",
     "learning_level_japanese":"{authenticated=w/postgres}","learning_level_english":"{authenticated=w/postgres}",
     "learning_level_french":"{authenticated=w/postgres}","learning_level_chinese":"{authenticated=w/postgres}",
     "last_login_at":"{authenticated=w/postgres}","goal_review":"{authenticated=w/postgres}","goal_words":"{authenticated=w/postgres}",
     "dday_date":"{authenticated=w/postgres}","dday_label":"{authenticated=w/postgres}","goal_lang":"{authenticated=w/postgres}",
     "goal_level":"{authenticated=w/postgres}"}'::jsonb)
 END
$q$;

DO $pre$
DECLARE c jsonb := pg_temp.pr_contracts(); k jsonb := pg_temp.pr_catalog();
BEGIN
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'profiles_privacy_rollback: learning contracts already drifted %', c; END IF;
 PERFORM fsrs_private.require_admission_integrity();
 IF k = pg_temp.pr_expected('after') THEN RAISE NOTICE 'profiles_privacy_rollback: needs restore';
 ELSIF k = pg_temp.pr_expected('before') THEN RAISE NOTICE 'profiles_privacy_rollback: already restored — no-op';
 ELSE RAISE EXCEPTION 'profiles_privacy_rollback: profiles policies/grants are not the migrated set (re-read before restoring): %', k; END IF;
END $pre$;

CREATE TEMP TABLE pr_state_before ON COMMIT DROP AS
 SELECT pg_temp.pr_contracts() AS contracts, pg_temp.pr_catalog() = pg_temp.pr_expected('before') AS restored;

DO $restore$
DECLARE n integer;
BEGIN
 IF (SELECT s.restored FROM pr_state_before s) THEN RETURN; END IF;
 DROP POLICY profiles_select_admin ON public.profiles;
 CREATE POLICY "anyone_read_basic_profile" ON public.profiles AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
 CREATE POLICY "profiles_select" ON public.profiles AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
 -- 표 REVOKE는 열 권한도 지운다. service_role도 한 번 회수 · 재부여해 relacl 항목 순서(postgres, anon, authenticated, service_role)까지 원래대로.
 REVOKE ALL ON TABLE public.profiles FROM anon, authenticated, service_role;
 GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;
 UPDATE fsrs_private.activity_settings SET profile_contract_hash = fsrs_private.activity_profile_hash()
  WHERE profile_contract_hash IS DISTINCT FROM fsrs_private.activity_profile_hash();
 GET DIAGNOSTICS n = ROW_COUNT;
 IF n > 1 THEN RAISE EXCEPTION 'profiles_privacy_rollback: profile pin touched % rows', n; END IF;
 UPDATE fsrs_private.admission_settings SET contract_hash = fsrs_private.admission_contract_hash()
  WHERE contract_hash IS DISTINCT FROM fsrs_private.admission_contract_hash();
 GET DIAGNOSTICS n = ROW_COUNT;
 IF n > 1 THEN RAISE EXCEPTION 'profiles_privacy_rollback: admission pin touched % rows', n; END IF;
END $restore$;

DO $post$
DECLARE b record; c jsonb := pg_temp.pr_contracts(); k jsonb := pg_temp.pr_catalog();
BEGIN
 SELECT * INTO b FROM pr_state_before;
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'profiles_privacy_rollback: contracts not consistent after restore %', c; END IF;
 IF c->>'core' IS DISTINCT FROM b.contracts->>'core' OR c->>'manual' IS DISTINCT FROM b.contracts->>'manual'
 THEN RAISE EXCEPTION 'profiles_privacy_rollback: core/manual pin moved % -> %', b.contracts, c; END IF;
 IF b.restored AND c IS DISTINCT FROM b.contracts THEN RAISE EXCEPTION 'profiles_privacy_rollback: already-restored run must not change anything'; END IF;
 IF k IS DISTINCT FROM pg_temp.pr_expected('before') THEN RAISE EXCEPTION 'profiles_privacy_rollback: profiles catalog is not the pre-migration one: %', k; END IF;
 IF (SELECT t.profile_contract_hash FROM fsrs_private.activity_settings t) IS DISTINCT FROM fsrs_private.activity_profile_hash_live()
    OR (SELECT a.contract_hash FROM fsrs_private.admission_settings a) IS DISTINCT FROM fsrs_private.admission_contract_hash_live()
 THEN RAISE EXCEPTION 'profiles_privacy_rollback: pins differ from the live fingerprints'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
 RAISE NOTICE 'profiles_privacy_rollback: ok — pins % -> %', b.contracts, c;
END $post$;

SET CONSTRAINTS fsrs_private.contract_cache_refresh IMMEDIATE;
SET CONSTRAINTS fsrs_private.contract_cache_refresh DEFERRED;

DO $cache$
DECLARE k record;
BEGIN
 SELECT * INTO STRICT k FROM fsrs_private.contract_cache;
 IF NOT k.valid THEN RAISE EXCEPTION 'profiles_privacy_rollback: refresh did not validate the contract cache'; END IF;
 IF (SELECT t.profile_contract_hash FROM fsrs_private.activity_settings t) IS DISTINCT FROM k.profile
    OR (SELECT a.contract_hash FROM fsrs_private.admission_settings a) IS DISTINCT FROM k.admission
 THEN RAISE EXCEPTION 'profiles_privacy_rollback: cached fingerprints differ from the pins'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
END $cache$;

DROP FUNCTION pg_temp.pr_expected(text); DROP FUNCTION pg_temp.pr_catalog(); DROP FUNCTION pg_temp.pr_contracts();
DROP TABLE pg_temp.pr_state_before;
