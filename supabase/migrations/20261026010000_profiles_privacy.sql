-- PROFILES-PRIVACY-001 ② — profiles를 본인 · 관리자만 읽고, 사용자는 자기 행의 열 14개만 고친다(오너 승인 2026-10-26 KST 「권장대로 진행」).
-- 적용 경로 = PR이 main에 병합되면 supabase-migrations.yml(db push)이 운영에 바로 적용한다 → 병합 승인 = 운영 적용 승인.
-- 실행 형태: db push는 파일 전체 + 이력 INSERT를 한 파이프라인(암묵 트랜잭션 하나)으로 보낸다 → BEGIN/COMMIT 없음, SET LOCAL 실효를
--   첫 DO가 확인. 어느 검사든 RAISE하면 이력까지 함께 롤백된다. 실행 주체 postgres(앱 사용자 JWT를 만들지 않는다 — 사후 행동 검사는
--   SET LOCAL ROLE을 되돌리는 하위 트랜잭션 안에서만 anon · authenticated가 된다).
-- 왜(운영 읽기 전용 실측 2026-10-26 KST): SELECT 정책 anyone_read_basic_profile · profiles_select(둘 다 public · USING true) 때문에 anon 키만으로
--   모든 사용자의 모든 열(role · last_login_at · xp · 연속 기록 · dday_label 자유 글 · 학습 언어 · 목표)을 읽는다. 표 권한이 anon · authenticated
--   ALL이라 사용자는 자기 행의 xp · streak_count · streak_freeze_count · last_streak_date를 직접 고칠 수 있다(role만 트리거가 막는다).
--   남의 표시 이름 · 사진은 ①(20261016165910 · 170000)의 public_profiles view(정의자 권한 · SELECT만)로 이미 옮겼다.
-- 바뀌는 것(public.profiles 하나 — 함수 · 다른 표 · view 변경 없음):
--   ⑴ SELECT 정책: anyone_read_basic_profile · profiles_select(전원 공개)를 지우고 profiles_select_admin(authenticated · (SELECT public.is_admin()))을
--      더한다. 남는 SELECT = 본인("Users can read own profile", auth.uid() = id) + 관리자. anon은 오류 없이 0행.
--   ⑵ 표 권한: anon = SELECT만(0행) · authenticated = SELECT + 열 권한 INSERT(id, display_name) · UPDATE(아래 14열). service_role · postgres 그대로.
--      DELETE · TRUNCATE · REFERENCES · TRIGGER · MAINTAIN은 anon · authenticated에서 회수(앱 사용 0 — 계정 삭제는 auth.users CASCADE).
--      UPDATE 14열 = 앱이 사용자 세션으로 쓰는 열 전부(src 전수 — OnboardingModal · MyPage · ProfileStats · learningActivity.recordExplicitProfileLogin):
--        display_name · onboarded · learning_language · learning_level_japanese · learning_level_english · learning_level_french · learning_level_chinese ·
--        last_login_at · goal_review · goal_words · dday_date · dday_label · goal_lang · goal_level.
--      사용자가 못 쓰게 되는 열: id · role · level · streak_count · created_at · avatar_url · learning_level · last_streak_date · xp · goal_read ·
--        active_lang · streak_freeze_count — 쓰는 길은 보안 정의자(소유자 postgres)뿐: update_streak · fsrs_private.append_activity ·
--        legacy_activity_before_epoch(연속 기록) · award_xp(service_role만) · admin_set_user_role(역할) · handle_new_user(가입 행 생성).
--      INSERT(id, display_name) = 로그인 때 행이 없을 때만 하는 upsert(ignoreDuplicates) 그 두 열. 가입 행은 auth.users 트리거 handle_new_user가 만든다.
--   ⑶ 재게시: activity profile(정책 · 표/열 ACL이 지문에 든다) → admission(profile 지문 값을 품는다). core · manual · capability는 범위 밖이라
--      그대로(사후 검사 · post-observation-migrations.mjs).
-- 바꾸지 않는 것: fsrs_private.activity_preflight — 활성화 때만 부르는 증명이고 운영에서 이미 activity_policy_not_attested로 실패한다
--   (활성화 026이 update_streak 본문을 바꾼 뒤라 기대 md5 7f7c…와 실제 355e…가 다르다 — 2026-10-26 KST 읽기 전용 호출로 확인). 런타임
--   (update_streak · require_admission_integrity)은 profile 게시값 = 지문만 본다. 다시 정의하면 core만 움직이고 얻는 것이 없다.
--   is_admin · enforce_role_change_by_admin · update_streak · auth.uid 본문 · ACL은 건드리지 않는다(사전 검사가 md5로 고정).
-- 사전 검사가 받는 상태: ① 고칠 상태 = 정책 7개 · 표 권한 · 열 권한 없음 · 열 26개 · 트리거 하나가 운영 실측 그대로 + profile 게시값 =
--   운영 값(e892…) + 네 계약 동치 ② 이 파일을 이미 적용한 상태(정책 · 권한이 아래 '뒤' 모양) — 아무것도 바꾸지 않는다. 그 밖이면 RAISE.
-- 사후 검사: 네 계약 동치 · core/manual 불변 · profile/admission은 처음 적용일 때만 움직임 · 정책/표/열 권한이 정확히 '뒤' 모양 ·
--   행동(하위 트랜잭션 + 되돌림): anon 0행 · anon 쓰기 거부 / 학습자 본인 1행 · 14열 UPDATE 1행 · 남의 행 0행 · xp · role · 연속 기록 3열 UPDATE 거부 ·
--   INSERT(id, display_name) ON CONFLICT DO NOTHING 통과 · xp를 넣는 INSERT 거부 / 관리자 전체 행 · public_profiles는 anon도 전체 행.
--   캐시 갱신을 지금 실행해 캐시 = 게시값.
-- 복원: docs/sql/profiles-privacy-rollback.sql — 정책 · 표/열 권한을 이 파일 전 모양으로 정확히 되돌리고 profile → admission 재게시.
--   (지문 열쇠에 정책 oid가 들어 다시 만든 두 정책의 oid만큼 게시값은 새 값이 된다 — oid를 뺀 지문은 처음과 같다: supabase/tests/profiles-privacy.mjs)
SET LOCAL search_path = '';
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '180s';

-- 실행기 확인: SET LOCAL이 이 트랜잭션에 실제로 걸렸어야 한다(db push 파이프라인 = 암묵 트랜잭션 하나).
DO $runner$
BEGIN
 IF pg_catalog.current_setting('search_path') NOT IN ('', '""') OR pg_catalog.current_setting('lock_timeout') <> '5s'
    OR pg_catalog.current_setting('statement_timeout') <> '3min'
 THEN RAISE EXCEPTION 'profiles_privacy: SET LOCAL not in effect (search_path=%, lock_timeout=%, statement_timeout=%)',
   pg_catalog.current_setting('search_path'), pg_catalog.current_setting('lock_timeout'), pg_catalog.current_setting('statement_timeout');
 END IF;
END $runner$;

-- ── 공통 도구(pg_temp, 이 세션 전용 · 끝에서 DROP).
CREATE FUNCTION pg_temp.pp_contracts() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object(
  'ok', s.contract_hash IS NOT DISTINCT FROM fsrs_private.contract_hash()
    AND m.contract_hash IS NOT DISTINCT FROM fsrs_private.manual_contract_hash()
    AND a.contract_hash IS NOT DISTINCT FROM fsrs_private.admission_contract_hash()
    AND t.profile_contract_hash IS NOT DISTINCT FROM fsrs_private.activity_profile_hash(),
  'core', s.contract_hash, 'manual', m.contract_hash, 'admission', a.contract_hash, 'profile', t.profile_contract_hash)
 FROM fsrs_private.settings s, fsrs_private.manual_save_settings m, fsrs_private.admission_settings a, fsrs_private.activity_settings t
$q$;
CREATE FUNCTION pg_temp.pp_md5(p_sig text) RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.md5(p.prosrc) FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure(p_sig)
$q$;
-- profiles의 정책 · 표 권한 · 열 권한 · 열 · 트리거(search_path ''에서 — 식은 늘 스키마를 붙여 나온다).
CREATE FUNCTION pg_temp.pp_catalog() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object(
  'policies', (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(p.polname, p.polcmd, p.polpermissive,
      (SELECT pg_catalog.jsonb_agg(coalesce(r.rolname, 'public') ORDER BY coalesce(r.rolname, 'public')) FROM pg_catalog.unnest(p.polroles) x(roid)
        LEFT JOIN pg_catalog.pg_roles r ON r.oid = x.roid),
      pg_catalog.pg_get_expr(p.polqual, p.polrelid), pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid)) ORDER BY p.polname COLLATE "C")
    FROM pg_catalog.pg_policy p WHERE p.polrelid = 'public.profiles'::pg_catalog.regclass),
  'relacl', (SELECT c.relacl::text FROM pg_catalog.pg_class c WHERE c.oid = 'public.profiles'::pg_catalog.regclass),
  'owner', (SELECT pg_catalog.pg_get_userbyid(c.relowner) FROM pg_catalog.pg_class c WHERE c.oid = 'public.profiles'::pg_catalog.regclass),
  'rls', (SELECT pg_catalog.jsonb_build_array(c.relrowsecurity, c.relforcerowsecurity) FROM pg_catalog.pg_class c WHERE c.oid = 'public.profiles'::pg_catalog.regclass),
  'attacl', (SELECT coalesce(pg_catalog.jsonb_object_agg(a.attname, a.attacl::text), '{}'::jsonb) FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = 'public.profiles'::pg_catalog.regclass AND a.attnum > 0 AND NOT a.attisdropped AND a.attacl IS NOT NULL),
  'columns', (SELECT pg_catalog.jsonb_agg(a.attname ORDER BY a.attnum) FROM pg_catalog.pg_attribute a
    WHERE a.attrelid = 'public.profiles'::pg_catalog.regclass AND a.attnum > 0 AND NOT a.attisdropped),
  'triggers', (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(t.tgname, t.tgfoid::pg_catalog.regprocedure::text, t.tgenabled) ORDER BY t.tgname)
    FROM pg_catalog.pg_trigger t WHERE t.tgrelid = 'public.profiles'::pg_catalog.regclass AND NOT t.tgisinternal))
$q$;
-- 고칠 상태(운영 실측 2026-10-26 KST)와 이 파일 뒤 상태. 열 권한 '뒤' = INSERT(id, display_name) + UPDATE(14열), grantor = 표 소유자 postgres.
CREATE FUNCTION pg_temp.pp_expected(p_which text) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $q$
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
 END || pg_catalog.jsonb_build_object(
  'owner', 'postgres', 'rls', '[true,false]'::jsonb,
  'columns', '["id","display_name","role","level","streak_count","created_at","last_login_at","avatar_url","onboarded","learning_language",
    "learning_level","learning_level_japanese","learning_level_english","last_streak_date","xp","goal_review","goal_words","goal_read","active_lang",
    "streak_freeze_count","dday_date","dday_label","learning_level_french","learning_level_chinese","goal_lang","goal_level"]'::jsonb,
  'triggers', '[["trg_enforce_role_change","public.enforce_role_change_by_admin()","O"]]'::jsonb)
$q$;
-- 게시 지문 한 칸을 '지금 계산한 값'으로(바뀔 때만, 정확히 1행). profile → admission 순서(admission이 profile 지문 값을 품는다).
CREATE FUNCTION pg_temp.pp_repin(p_which text) RETURNS void LANGUAGE plpgsql SET search_path = '' AS $q$
DECLARE n integer;
BEGIN
 IF p_which = 'profile' THEN
  UPDATE fsrs_private.activity_settings SET profile_contract_hash = fsrs_private.activity_profile_hash()
   WHERE profile_contract_hash IS DISTINCT FROM fsrs_private.activity_profile_hash();
 ELSIF p_which = 'admission' THEN
  UPDATE fsrs_private.admission_settings SET contract_hash = fsrs_private.admission_contract_hash()
   WHERE contract_hash IS DISTINCT FROM fsrs_private.admission_contract_hash();
 ELSE RAISE EXCEPTION 'profiles_privacy: unknown pin %', p_which; END IF;
 GET DIAGNOSTICS n = ROW_COUNT;
 IF n > 1 THEN RAISE EXCEPTION 'profiles_privacy: % pin touched % rows', p_which, n; END IF;
END
$q$;

DO $pre$
DECLARE c jsonb := pg_temp.pp_contracts(); k jsonb := pg_temp.pp_catalog(); b jsonb := pg_temp.pp_expected('before'); a jsonb := pg_temp.pp_expected('after');
BEGIN
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'profiles_privacy: learning contracts already drifted %', c; END IF;
 PERFORM fsrs_private.require_admission_integrity();
 -- 이 변경이 기대는 본문(운영 실측 md5): 지문 함수 · 역할 판정 · 연속 기록 · 역할 변경 RPC. 다르면 다시 읽고 검토한다.
 IF pg_temp.pp_md5('fsrs_private.activity_profile_hash_live()') IS DISTINCT FROM '2c3b288d2739925159418048da75a65d'
    OR pg_temp.pp_md5('fsrs_private.admission_contract_hash_live()') IS DISTINCT FROM 'ef7227c3f7d3ff47760d9ce06c844231'
    OR pg_temp.pp_md5('fsrs_private.require_admission_integrity()') IS DISTINCT FROM '84a89f959af0863e337a9b55bae8ca3c'
    OR pg_temp.pp_md5('public.is_admin()') IS DISTINCT FROM 'c6285e67e4e39f263d934fac2145035c'
    OR pg_temp.pp_md5('public.enforce_role_change_by_admin()') IS DISTINCT FROM 'a3d315a8c81181eccbb9072e8b9c3c7a'
    OR pg_temp.pp_md5('public.update_streak(uuid)') IS DISTINCT FROM '355e54295750c732c20657f29e43a33a'
    OR pg_temp.pp_md5('public.admin_set_user_role(uuid,text)') IS DISTINCT FROM '5b29b88f44eb060fac3dbc7f0947c35e'
 THEN RAISE EXCEPTION 'profiles_privacy: a reviewed function body changed — re-read before applying'; END IF;
 -- 사용자 열을 닫은 뒤에도 남는 쓰기 길은 보안 정의자(소유자 postgres)뿐이어야 한다. award_xp · handle_new_user는 운영에 있고(정의자 확인
 -- 2026-10-26 KST) 학습 계약 관측 fixture에는 없다 — 있으면 정의자여야 한다(없어도 이 변경이 기대는 길은 아니다: 가입 행은 로그인 upsert가 대신한다).
 IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.oid IN (pg_catalog.to_regprocedure('public.update_streak(uuid)'), pg_catalog.to_regprocedure('public.award_xp(uuid,integer)'),
      pg_catalog.to_regprocedure('public.admin_set_user_role(uuid,text)'), pg_catalog.to_regprocedure('public.handle_new_user()'), pg_catalog.to_regprocedure('public.is_admin()'))
      AND (NOT p.prosecdef OR p.proowner <> 'postgres'::pg_catalog.regrole))
    OR NOT pg_catalog.has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE')
    OR NOT pg_catalog.has_function_privilege('authenticated', 'public.admin_set_user_role(uuid,text)', 'EXECUTE')
 THEN RAISE EXCEPTION 'profiles_privacy: server-side writers / admin helper are not the reviewed security-definer functions'; END IF;
 -- 남의 표시 이름은 public_profiles(정의자 권한 · 세 열 · SELECT만)로 계속 읽힌다.
 IF pg_catalog.to_regclass('public.public_profiles') IS NULL THEN RAISE EXCEPTION 'profiles_privacy: public_profiles view missing (PROFILES-PRIVACY-001 ① first)'; END IF;
 IF (SELECT coalesce((SELECT o.option_value FROM pg_catalog.pg_options_to_table(v.reloptions) o WHERE o.option_name = 'security_invoker'), 'false')
        FROM pg_catalog.pg_class v WHERE v.oid = 'public.public_profiles'::pg_catalog.regclass) <> 'false'
    OR (SELECT pg_catalog.jsonb_agg(a.attname ORDER BY a.attnum) FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'public.public_profiles'::pg_catalog.regclass AND a.attnum > 0)
       IS DISTINCT FROM '["id","display_name","avatar_url"]'::jsonb
    OR NOT pg_catalog.has_table_privilege('anon', 'public.public_profiles', 'SELECT')
    OR pg_catalog.has_table_privilege('anon', 'public.public_profiles', 'INSERT,UPDATE,DELETE')
    OR pg_catalog.has_table_privilege('authenticated', 'public.public_profiles', 'INSERT,UPDATE,DELETE')
 THEN RAISE EXCEPTION 'profiles_privacy: public_profiles is not the reviewed definer view (id, display_name, avatar_url; SELECT only)'; END IF;
 IF k - ARRAY['policies','relacl','attacl'] IS DISTINCT FROM b - ARRAY['policies','relacl','attacl']
 THEN RAISE EXCEPTION 'profiles_privacy: profiles columns / owner / RLS / triggers drifted % (expected %)', k - ARRAY['policies','relacl','attacl'], b - ARRAY['policies','relacl','attacl']; END IF;
 IF k = b THEN
  -- ① 고칠 상태: profile 게시값이 운영에서 확인한 값이어야 한다(지문 범위가 관측 뒤 바뀌지 않았다).
  IF c->>'profile' IS DISTINCT FROM 'e892069f4a99f5ba9565c54d72226740' THEN RAISE EXCEPTION 'profiles_privacy: activity profile pin is not the reviewed one (%)', c->>'profile'; END IF;
  RAISE NOTICE 'profiles_privacy: needs change';
 ELSIF k = a THEN
  RAISE NOTICE 'profiles_privacy: already applied — no-op';
 ELSE
  RAISE EXCEPTION 'profiles_privacy: profiles policies/grants are neither the reviewed current set nor the applied set: %', k;
 END IF;
END $pre$;

CREATE TEMP TABLE pp_state_before ON COMMIT DROP AS
 SELECT pg_temp.pp_contracts() AS contracts, pg_temp.pp_catalog() = pg_temp.pp_expected('after') AS applied;

-- ── 변경(고칠 상태에서만 — 이미 적용했으면 DDL 없이 지나간다).
DO $change$
BEGIN
 IF (SELECT s.applied FROM pp_state_before s) THEN RETURN; END IF;
 -- ⑴ 전원 공개 SELECT 정책 둘을 내리고 관리자 읽기를 더한다(본인 읽기 "Users can read own profile"은 그대로).
 DROP POLICY "anyone_read_basic_profile" ON public.profiles;
 DROP POLICY "profiles_select" ON public.profiles;
 CREATE POLICY profiles_select_admin ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
 -- ⑵ 표 권한: anon · authenticated는 SELECT만 남기고(행은 RLS가 고른다), authenticated에 열 권한 INSERT 2열 · UPDATE 14열.
 REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;
 GRANT SELECT ON TABLE public.profiles TO anon, authenticated;
 GRANT INSERT (id, display_name) ON TABLE public.profiles TO authenticated;
 GRANT UPDATE (display_name, onboarded, learning_language, learning_level_japanese, learning_level_english, learning_level_french,
   learning_level_chinese, last_login_at, goal_review, goal_words, dday_date, dday_label, goal_lang, goal_level) ON TABLE public.profiles TO authenticated;
 -- ⑶ 재게시: profile → admission.
 PERFORM pg_temp.pp_repin('profile');
 PERFORM pg_temp.pp_repin('admission');
END $change$;

-- ── 사후 검사 ⑴: 네 계약 동치 · core/manual 불변 · profile/admission은 처음 적용일 때만 움직임 · 카탈로그가 정확히 '뒤' 모양.
DO $post$
DECLARE b record; c jsonb := pg_temp.pp_contracts(); k jsonb := pg_temp.pp_catalog();
BEGIN
 SELECT * INTO b FROM pp_state_before;
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'profiles_privacy: contracts not consistent after change %', c; END IF;
 IF c->>'core' IS DISTINCT FROM b.contracts->>'core' OR c->>'manual' IS DISTINCT FROM b.contracts->>'manual'
 THEN RAISE EXCEPTION 'profiles_privacy: core/manual pin moved % -> %', b.contracts, c; END IF;
 IF b.applied AND c IS DISTINCT FROM b.contracts THEN RAISE EXCEPTION 'profiles_privacy: already-applied run must not change anything'; END IF;
 IF NOT b.applied AND (c->>'profile' = b.contracts->>'profile' OR c->>'admission' = b.contracts->>'admission')
 THEN RAISE EXCEPTION 'profiles_privacy: profile/admission pins did not move with the policy change % -> %', b.contracts, c; END IF;
 IF (SELECT t.profile_contract_hash FROM fsrs_private.activity_settings t) IS DISTINCT FROM fsrs_private.activity_profile_hash_live()
    OR (SELECT a.contract_hash FROM fsrs_private.admission_settings a) IS DISTINCT FROM fsrs_private.admission_contract_hash_live()
 THEN RAISE EXCEPTION 'profiles_privacy: pins differ from the live fingerprints'; END IF;
 IF k IS DISTINCT FROM pg_temp.pp_expected('after') THEN RAISE EXCEPTION 'profiles_privacy: profiles catalog is not the intended one: %', k; END IF;
 -- 권한 판정 함수로 한 번 더(열 · 표 단위).
 IF pg_catalog.has_table_privilege('anon', 'public.profiles', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR pg_catalog.has_any_column_privilege('anon', 'public.profiles', 'INSERT,UPDATE')
    OR pg_catalog.has_table_privilege('authenticated', 'public.profiles', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR NOT pg_catalog.has_table_privilege('anon', 'public.profiles', 'SELECT') OR NOT pg_catalog.has_table_privilege('authenticated', 'public.profiles', 'SELECT')
    OR EXISTS (SELECT 1 FROM pg_catalog.unnest(ARRAY['id','role','level','streak_count','created_at','avatar_url','learning_level','last_streak_date','xp',
         'goal_read','active_lang','streak_freeze_count']) x(col) WHERE pg_catalog.has_column_privilege('authenticated', 'public.profiles', x.col, 'UPDATE'))
    OR EXISTS (SELECT 1 FROM pg_catalog.unnest(ARRAY['display_name','onboarded','learning_language','learning_level_japanese','learning_level_english',
         'learning_level_french','learning_level_chinese','last_login_at','goal_review','goal_words','dday_date','dday_label','goal_lang','goal_level']) x(col)
       WHERE NOT pg_catalog.has_column_privilege('authenticated', 'public.profiles', x.col, 'UPDATE'))
    OR NOT pg_catalog.has_column_privilege('authenticated', 'public.profiles', 'id', 'INSERT') OR NOT pg_catalog.has_column_privilege('authenticated', 'public.profiles', 'display_name', 'INSERT')
    OR pg_catalog.has_column_privilege('authenticated', 'public.profiles', 'xp', 'INSERT') OR pg_catalog.has_column_privilege('authenticated', 'public.profiles', 'role', 'INSERT')
    OR NOT pg_catalog.has_table_privilege('service_role', 'public.profiles', 'SELECT,INSERT,UPDATE,DELETE')
 THEN RAISE EXCEPTION 'profiles_privacy: privilege functions disagree with the intended grants'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
 RAISE NOTICE 'profiles_privacy: catalog ok — pins % -> %', b.contracts, c;
END $post$;

-- ── 사후 검사 ⑵: 행동. 각 역할 검사는 하위 트랜잭션 안에서 SET LOCAL ROLE · JWT 주장을 걸고, 끝에 표식 예외로 그 하위 트랜잭션을
--    통째로 되돌린다(역할 · 설정 · 같은 값 UPDATE 모두 취소 — 행은 바뀌지 않는다). 결과는 PL/pgSQL 변수(비트랜잭션)에만 남는다.
--    학습자 행은 이 안에서 세기만 하고 밖으로 내보내지 않는다. 학습자 · 관리자가 없으면(빈 DB) 그 검사만 건너뛴다.
DO $behave$
DECLARE me name := current_user; total bigint; learner uuid; other uuid; admin uuid; n bigint; m integer; got text;
 anon_rows bigint; anon_view bigint; anon_update text; anon_insert text; own_rows bigint; own_update integer; foreign_update integer;
 denied text[] := ARRAY[]::text[]; upsert text; insert_xp text; admin_rows bigint;
BEGIN
 SELECT pg_catalog.count(*) INTO total FROM public.profiles;
 SELECT p.id INTO learner FROM public.profiles p WHERE p.role = 'student' AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id) ORDER BY p.id LIMIT 1;
 SELECT p.id INTO other FROM public.profiles p WHERE p.id IS DISTINCT FROM learner ORDER BY p.id LIMIT 1;
 SELECT p.id INTO admin FROM public.profiles p WHERE p.role = 'admin' AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id) ORDER BY p.id LIMIT 1;

 -- anon: 0행(오류 아님) · 쓰기 거부 · public_profiles는 전체 행.
 BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', '', true); PERFORM pg_catalog.set_config('request.jwt.claims', '', true);
  SET LOCAL ROLE anon;
  SELECT pg_catalog.count(*) INTO anon_rows FROM public.profiles;
  SELECT pg_catalog.count(*) INTO anon_view FROM public.public_profiles;
  BEGIN UPDATE public.profiles SET display_name = display_name; anon_update := 'allowed';
  EXCEPTION WHEN insufficient_privilege THEN anon_update := 'denied'; END;
  BEGIN INSERT INTO public.profiles (id) VALUES ('00000000-0000-4000-8000-0000000000ff'); anon_insert := 'allowed';
  EXCEPTION WHEN insufficient_privilege THEN anon_insert := 'denied'; END;
  RAISE EXCEPTION 'pp_probe_rollback';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'pp_probe_rollback' THEN RAISE; END IF;
 END;
 IF current_user <> me THEN RAISE EXCEPTION 'profiles_privacy: role not restored after anon probe (%)', current_user; END IF;
 IF anon_rows <> 0 OR anon_view <> total OR anon_update <> 'denied' OR anon_insert <> 'denied'
 THEN RAISE EXCEPTION 'profiles_privacy: anon probe failed (rows %, view % of %, update %, insert %)', anon_rows, anon_view, total, anon_update, anon_insert; END IF;

 -- 학습자 본인: 자기 행 1행 · 14열 UPDATE · 남의 행 0행 · 서버 열 거부 · 로그인 upsert 모양 통과 · xp INSERT 거부.
 IF learner IS NULL THEN RAISE NOTICE 'profiles_privacy: no learner — owner probe skipped';
 ELSE
  BEGIN
   PERFORM pg_catalog.set_config('request.jwt.claim.sub', learner::text, true); PERFORM pg_catalog.set_config('request.jwt.claims', '', true);
   SET LOCAL ROLE authenticated;
   SELECT pg_catalog.count(*) INTO own_rows FROM public.profiles;
   UPDATE public.profiles SET display_name = display_name, onboarded = onboarded, learning_language = learning_language,
     learning_level_japanese = learning_level_japanese, learning_level_english = learning_level_english, learning_level_french = learning_level_french,
     learning_level_chinese = learning_level_chinese, last_login_at = last_login_at, goal_review = goal_review, goal_words = goal_words,
     dday_date = dday_date, dday_label = dday_label, goal_lang = goal_lang, goal_level = goal_level
    WHERE id = learner;
   GET DIAGNOSTICS own_update = ROW_COUNT;
   UPDATE public.profiles SET display_name = display_name WHERE id = other;
   GET DIAGNOSTICS foreign_update = ROW_COUNT;
   FOREACH got IN ARRAY ARRAY['xp','role','streak_count','streak_freeze_count','last_streak_date'] LOOP
    BEGIN EXECUTE pg_catalog.format('UPDATE public.profiles SET %I = %I WHERE id = $1', got, got) USING learner;
    EXCEPTION WHEN insufficient_privilege THEN denied := denied || got; END;
   END LOOP;
   BEGIN INSERT INTO public.profiles (id, display_name) VALUES (learner, 'probe') ON CONFLICT (id) DO NOTHING; upsert := 'ok';
   EXCEPTION WHEN insufficient_privilege THEN upsert := 'denied'; END;
   BEGIN INSERT INTO public.profiles (id, xp) VALUES (learner, 1) ON CONFLICT (id) DO NOTHING; insert_xp := 'allowed';
   EXCEPTION WHEN insufficient_privilege THEN insert_xp := 'denied'; END;
   RAISE EXCEPTION 'pp_probe_rollback';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'pp_probe_rollback' THEN RAISE; END IF;
  END;
  IF current_user <> me THEN RAISE EXCEPTION 'profiles_privacy: role not restored after owner probe (%)', current_user; END IF;
  IF own_rows <> 1 OR own_update <> 1 OR (other IS NOT NULL AND foreign_update <> 0) OR upsert <> 'ok' OR insert_xp <> 'denied'
     OR denied IS DISTINCT FROM ARRAY['xp','role','streak_count','streak_freeze_count','last_streak_date']
  THEN RAISE EXCEPTION 'profiles_privacy: owner probe failed (rows %, update %, foreign %, denied %, upsert %, insert xp %)',
    own_rows, own_update, foreign_update, denied, upsert, insert_xp; END IF;
 END IF;

 -- 관리자: 전체 행(관리자 화면 fetchAllUsers · 자료 owner embed · 월드 신고 이름).
 IF admin IS NULL THEN RAISE NOTICE 'profiles_privacy: no admin — admin probe skipped';
 ELSE
  BEGIN
   PERFORM pg_catalog.set_config('request.jwt.claim.sub', admin::text, true); PERFORM pg_catalog.set_config('request.jwt.claims', '', true);
   SET LOCAL ROLE authenticated;
   SELECT pg_catalog.count(*) INTO admin_rows FROM public.profiles;
   RAISE EXCEPTION 'pp_probe_rollback';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'pp_probe_rollback' THEN RAISE; END IF;
  END;
  IF current_user <> me THEN RAISE EXCEPTION 'profiles_privacy: role not restored after admin probe (%)', current_user; END IF;
  IF admin_rows <> total THEN RAISE EXCEPTION 'profiles_privacy: admin probe failed (% of % rows)', admin_rows, total; END IF;
 END IF;
 RAISE NOTICE 'profiles_privacy: behaviour ok — anon 0 of % rows · learner % · admin %', total,
   CASE WHEN learner IS NULL THEN 'skipped' ELSE 'own row only, 14 columns, server columns denied' END,
   CASE WHEN admin IS NULL THEN 'skipped' ELSE 'all rows' END;
END $behave$;

-- ── 캐시 갱신을 지금 실행해 본다(커밋 때 할 일과 같은 함수 — 20261023170000). 이 뒤의 DDL은 임시 객체 DROP뿐이라 캐시를 무효로 만들지 않는다.
SET CONSTRAINTS fsrs_private.contract_cache_refresh IMMEDIATE;
SET CONSTRAINTS fsrs_private.contract_cache_refresh DEFERRED;

DO $cache$
DECLARE k record;
BEGIN
 SELECT * INTO STRICT k FROM fsrs_private.contract_cache;
 IF NOT k.valid THEN RAISE EXCEPTION 'profiles_privacy: refresh did not validate the contract cache'; END IF;
 IF (SELECT t.profile_contract_hash FROM fsrs_private.activity_settings t) IS DISTINCT FROM k.profile
    OR (SELECT a.contract_hash FROM fsrs_private.admission_settings a) IS DISTINCT FROM k.admission
    OR (SELECT s.contract_hash FROM fsrs_private.settings s) IS DISTINCT FROM k.core
    OR (SELECT m.contract_hash FROM fsrs_private.manual_save_settings m) IS DISTINCT FROM k.manual
 THEN RAISE EXCEPTION 'profiles_privacy: cached fingerprints differ from the pins'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
END $cache$;

DROP FUNCTION pg_temp.pp_repin(text); DROP FUNCTION pg_temp.pp_expected(text); DROP FUNCTION pg_temp.pp_catalog(); DROP FUNCTION pg_temp.pp_md5(text);
DROP FUNCTION pg_temp.pp_contracts();
DROP TABLE pg_temp.pp_state_before;
