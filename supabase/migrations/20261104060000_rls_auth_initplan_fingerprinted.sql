-- RLS 정책 auth 호출 한 번 계산 2단계 — 학습 계약 지문 범위 테이블 6개의 정책 17개(RLS-INITPLAN-001 · 2026-11-04 KST).
--   오너 「1,2번은 진행」(2026-11-03 KST)의 2단계. 1단계(20261103000000_rls_auth_initplan.sql)가 지문 범위라 남겨 둔 나머지다.
-- 적용 경로 = PR이 main에 병합되면 supabase-migrations.yml(db push)이 운영에 바로 적용한다 → 병합 승인 = 운영 적용 승인.
-- 실행 형태: db push는 파일 전체 + 이력 INSERT를 한 파이프라인(암묵 트랜잭션 하나)으로 보낸다 → BEGIN/COMMIT 없음, SET LOCAL 실효를
--   첫 DO가 확인. 어느 검사든 RAISE하면 이력까지 함께 롤백된다. 실행 주체 postgres, 앱 사용자(JWT)를 만들지 않는다.
--
-- 왜: Supabase 성능 진단 auth_rls_initplan — 정책 식의 맨 auth.uid()는 행마다 다시 부른다. (select auth.uid())로 감싸면 질의당
--   한 번(InitPlan)이다. 같은 값이라 결과 행은 같다(1단계와 같은 근거 · 같은 감싸기).
-- 바뀌는 것:
--   ⑴ 아래 17개 정책의 USING / WITH CHECK 식 안 맨 auth.uid()만 (select auth.uid())로. 명령 · 역할 · PERMISSIVE · 절 유무 · 나머지 식 그대로.
--      기준 = 운영 pg_policies(2026-11-03 KST 조회) — 대상에 이미 감싼 호출이 섞인 것이 없다(되돌리기가 정확하다).
--   ⑵ 정책 문자열은 학습 계약 지문에 든다(§4.9-1 · #1504 선례) → 같은 트랜잭션에서 재게시:
--      capability(user_vocabulary · user_known_words · review_events · reading_materials · uploaded_pdfs) 상수 → 지금 실제값
--        (같은 oid · 소유자 · ACL · 속성, 고정값 한 칸만 — 20261016191500 korean_capability_repin과 같은 방식)
--      → FSRS core(capability 함수 정의를 지문에 넣는다) → activity profile(profiles 정책) → admission(profile 지문 값을 품는다).
--      manual은 범위 밖이라 그대로(사후 검사). 재계산은 _live() 함수로 한다 — 원래 이름(캐시)은 이 트랜잭션의 DDL로 캐시가 무효라
--      _live와 같지만, 캐시 갱신 전 값을 쓰지 않도록 게시는 _live에서 읽는다(20261101130000 streak_learning_day 선례).
-- 운영 해시 값은 이 파일에 박지 않는다: 사전 검사 = 「네 게시값 = 실측(_live · 캐시 둘 다) · 한국어 게시 = 실측」, 사후 검사 = 「재계산 뒤 같음」.
--   본문 모양 md5 둘(capability 템플릿 4a497440… · 지문 SELECT 2e57290c…)만 고정한다 — 191500 이후 바뀌지 않은 본문 구조다.
-- 사전 검사가 받는 상태: ① 고칠 상태 = 17개가 아래 원래 식 그대로 · 네 계약 · 한국어 ready ② 이미 적용(17개가 감싼 식) — 아무것도
--   바꾸지 않는다(사후 검사가 무변경 확인). 섞였거나 없거나 다른 식이면 RAISE.
-- 사후 검사(같은 트랜잭션): 네 게시값 = _live = 캐시 · manual 불변 · 한국어 ready · capability 속성 불변 · 감싼 호출을 되돌린 capability 지문 =
--   적용 전 같은 값(지문 변화가 감싸기뿐) · 정책 수 · 명령 · 역할 · PERMISSIVE 불변 · 17개는 되돌리면 원래 식, 나머지 정책은 글자 그대로 ·
--   6개 테이블에 맨 auth.* 0 · 전 학습자 fsrs_vocabulary_snapshot 출력 동일(임시 테이블에만, ON COMMIT DROP).
-- 복원(쓸 일 없음 — 결과 행이 같다): 같은 17개 정책에 `( SELECT auth.uid() AS uid)` → `auth.uid()`로 ALTER POLICY(= 아래 ri2_target의 원래 식)
--   하고 같은 트랜잭션에서 이 파일의 재게시(capability 상수 → core → profile → admission을 _live 값으로)를 되풀이한다. 사후 = 네 계약 동치 ·
--   한국어 ready · snapshot 동일(supabase/tests/rls-auth-initplan-fingerprinted.mjs가 복원 · 재적용까지 확인한다).
SET LOCAL search_path = '';
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '180s';

-- 실행기 확인: SET LOCAL이 이 트랜잭션에 실제로 걸렸어야 한다(db push 파이프라인 = 암묵 트랜잭션 하나).
DO $runner$
BEGIN
 IF pg_catalog.current_setting('search_path') NOT IN ('', '""') OR pg_catalog.current_setting('lock_timeout') <> '5s'
    OR pg_catalog.current_setting('statement_timeout') <> '3min'
 THEN RAISE EXCEPTION 'rls_initplan_fp: SET LOCAL not in effect (search_path=%, lock_timeout=%, statement_timeout=%)',
   pg_catalog.current_setting('search_path'), pg_catalog.current_setting('lock_timeout'), pg_catalog.current_setting('statement_timeout');
 END IF;
END $runner$;

-- ── 대상 17개(운영 pg_policies 2026-11-03 KST — 원래 식). 감싼 식 = auth.uid()를 ( SELECT auth.uid() AS uid)로 바꾼 글자.
CREATE TEMP TABLE ri2_target (tbl text NOT NULL, pol text NOT NULL, cmd text NOT NULL, qual text, with_check text, PRIMARY KEY (tbl, pol)) ON COMMIT DROP;
INSERT INTO pg_temp.ri2_target (tbl, pol, cmd, qual, with_check) VALUES
 ('profiles', 'Users can read own profile', 'SELECT', '(auth.uid() = id)', NULL),
 ('profiles', 'Users can update own profile', 'UPDATE', '(auth.uid() = id)', NULL),
 ('profiles', 'profiles_insert', 'INSERT', NULL, '(auth.uid() = id)'),
 ('profiles', 'profiles_update', 'UPDATE', '(auth.uid() = id)', NULL),
 ('reading_materials', 'Users can insert own materials', 'INSERT', NULL, '(owner_id = auth.uid())'),
 ('reading_materials', 'Users can read public or own materials', 'SELECT', '((visibility = ''public''::text) OR (owner_id = auth.uid()))', NULL),
 ('reading_materials', 'Users can update own materials', 'UPDATE', '(owner_id = auth.uid())', NULL),
 ('reading_materials', 'owner_delete_material', 'DELETE', '(auth.uid() = owner_id)', NULL),
 ('reading_materials', 'owner_read_private_materials', 'SELECT', '((visibility = ''private''::text) AND (owner_id = auth.uid()))', NULL),
 ('reading_materials', 'owner_update_material', 'UPDATE', '(auth.uid() = owner_id)', NULL),
 ('review_events', 'review_events_insert_own', 'INSERT', NULL, '(auth.uid() = user_id)'),
 ('review_events', 'review_events_select_own', 'SELECT', '(auth.uid() = user_id)', NULL),
 ('uploaded_pdfs', 'Owner full access', 'ALL', '(auth.uid() = owner_id)', '(auth.uid() = owner_id)'),
 ('user_known_words', 'user_known_words_delete_own', 'DELETE', '(user_id = auth.uid())', NULL),
 ('user_known_words', 'user_known_words_insert_own', 'INSERT', NULL, '(user_id = auth.uid())'),
 ('user_known_words', 'user_known_words_select_own', 'SELECT', '(user_id = auth.uid())', NULL),
 ('user_vocabulary', 'Users can manage own vocabulary', 'ALL', '(auth.uid() = user_id)', '(auth.uid() = user_id)');

-- ── 공통 도구(pg_temp, 이 세션 전용 · 끝에서 DROP). 정본 함수를 복제 · 실행하지 않는다(선례 191500).
-- 감싸기 · 되돌리기(글자 그대로). 대상 원래 식에는 감싼 호출이 없으므로 둘은 서로의 역이다.
CREATE FUNCTION pg_temp.ri2_wrap(p text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $q$
 SELECT pg_catalog.replace(p, 'auth.uid()', '( SELECT auth.uid() AS uid)')
$q$;
CREATE FUNCTION pg_temp.ri2_unwrap(p text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $q$
 SELECT pg_catalog.regexp_replace(p, '\( SELECT auth\.(uid|role|jwt)\(\) AS (uid|role|jwt)\)', 'auth.\1()', 'g')
$q$;
-- 6개 테이블의 정책 전부(명령 · PERMISSIVE · 역할 · 식).
CREATE FUNCTION pg_temp.ri2_policies() RETURNS TABLE (tbl text, pol text, cmd text, permissive text, roles text[], qual text, with_check text)
 LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT p.tablename::text, p.policyname::text, p.cmd, p.permissive, p.roles::text[], p.qual, p.with_check FROM pg_catalog.pg_policies p
 WHERE p.schemaname = 'public' AND p.tablename IN ('profiles','reading_materials','review_events','uploaded_pdfs','user_known_words','user_vocabulary')
$q$;
-- 17개의 상태: original(17개 다 원래 식) · wrapped(17개 다 감싼 식) · 그 밖(어긋난 정책 수와 함께).
CREATE FUNCTION pg_temp.ri2_target_state() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object(
  'original', pg_catalog.count(*) FILTER (WHERE p.cmd = t.cmd AND p.qual IS NOT DISTINCT FROM t.qual AND p.with_check IS NOT DISTINCT FROM t.with_check),
  'wrapped', pg_catalog.count(*) FILTER (WHERE p.cmd = t.cmd AND p.qual IS NOT DISTINCT FROM pg_temp.ri2_wrap(t.qual)
                                          AND p.with_check IS NOT DISTINCT FROM pg_temp.ri2_wrap(t.with_check)),
  'missing', pg_catalog.count(*) FILTER (WHERE p.pol IS NULL),
  'targets', pg_catalog.count(*))
 FROM pg_temp.ri2_target t LEFT JOIN pg_temp.ri2_policies() p ON p.tbl = t.tbl AND p.pol = t.pol
$q$;
-- 6개 테이블에서 감싸지 않은 auth.* 호출이 남은 정책(대상 포함 여부와 함께).
CREATE FUNCTION pg_temp.ri2_bare() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object(
  'all', pg_catalog.count(*),
  'outside_targets', pg_catalog.count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM pg_temp.ri2_target t WHERE t.tbl = p.tbl AND t.pol = p.pol)))
 FROM pg_temp.ri2_policies() p
 WHERE pg_catalog.regexp_replace(coalesce(p.qual, '') || ' ' || coalesce(p.with_check, ''),
   '\( SELECT auth\.(uid|role|jwt)\(\) AS (uid|role|jwt)\)', '', 'g') ~ 'auth\.(uid|role|jwt)\(\)'
$q$;

-- 한국어 capability 지문 = learning_language_capabilities() 본문의 그 SELECT를 바이트 그대로(md5 2e57290ce85b8f034f7f304dfdea3ad9 — 191500과 같은 복사).
-- 같은지 아래 ri2_cap()이 운영 본문에서 다시 확인한다(fingerprint_ok).
CREATE FUNCTION pg_temp.ri2_korean_live_hash() RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $q$
WITH RECURSIVE relevant_roles(oid) AS (
 SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN ('authenticated','anon','service_role')
 UNION SELECT m.roleid FROM pg_catalog.pg_auth_members m JOIN relevant_roles r ON r.oid=m.member
), tables AS (
 SELECT c.* FROM pg_catalog.pg_class c WHERE c.relnamespace='public'::pg_catalog.regnamespace
 AND c.relname IN ('user_vocabulary','vocabulary_contexts','user_known_words','vocabulary_exclusions','review_events','reading_materials','uploaded_pdfs','active_vocabulary','vocabulary_with_exclusions')
), objects AS (
 SELECT 'relation:'||c.relname AS key,pg_catalog.jsonb_build_array(c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.relacl,c.reloptions,c.relowner) AS val FROM tables c
 UNION ALL SELECT 'role:'||r.rolname,pg_catalog.jsonb_build_array(r.rolsuper,r.rolbypassrls,r.rolinherit) FROM pg_catalog.pg_roles r JOIN relevant_roles rr ON rr.oid=r.oid
 UNION ALL SELECT 'membership:'||m.member::text||':'||m.roleid::text,pg_catalog.to_jsonb(m) FROM pg_catalog.pg_auth_members m JOIN relevant_roles r ON r.oid=m.member
 UNION ALL SELECT 'schema:'||n.nspname,pg_catalog.jsonb_build_array(n.nspacl,n.nspowner) FROM pg_catalog.pg_namespace n WHERE n.nspname IN ('public','auth')
 UNION ALL SELECT 'constraint:'||c.relname||':'||x.conname,pg_catalog.to_jsonb(pg_catalog.pg_get_constraintdef(x.oid)) FROM pg_catalog.pg_constraint x JOIN tables c ON c.oid=x.conrelid
 UNION ALL SELECT 'index:'||c.relname||':'||i.indexrelid::text,pg_catalog.jsonb_build_array(pg_catalog.pg_get_indexdef(i.indexrelid),i.indisvalid,i.indisready) FROM pg_catalog.pg_index i JOIN tables c ON c.oid=i.indrelid
 UNION ALL SELECT 'policy:'||c.relname||':'||p.polname,pg_catalog.jsonb_build_array(p.polcmd,p.polpermissive,p.polroles,pg_catalog.pg_get_expr(p.polqual,p.polrelid),pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid)) FROM pg_catalog.pg_policy p JOIN tables c ON c.oid=p.polrelid
 UNION ALL SELECT 'trigger:'||c.relname||':'||t.tgname,pg_catalog.jsonb_build_array(pg_catalog.pg_get_triggerdef(t.oid),t.tgenabled) FROM pg_catalog.pg_trigger t JOIN tables c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal
 UNION ALL SELECT 'view:'||c.relname,pg_catalog.to_jsonb(pg_catalog.pg_get_viewdef(c.oid,true)) FROM tables c WHERE c.relkind='v'
 UNION ALL SELECT 'column:'||c.relname||':'||a.attname,pg_catalog.jsonb_build_array(a.atttypid,a.atttypmod,a.attnotnull,a.attacl,a.attidentity,a.attgenerated,pg_catalog.pg_get_expr(d.adbin,d.adrelid)) FROM pg_catalog.pg_attribute a JOIN tables c ON c.oid=a.attrelid LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attnum>0 AND NOT a.attisdropped
 UNION ALL SELECT 'function:'||p.oid::text,pg_catalog.jsonb_build_array(pg_catalog.pg_get_functiondef(p.oid),p.proacl,p.proowner) FROM pg_catalog.pg_proc p WHERE p.oid IN (
 SELECT pg_catalog.to_regprocedure(f.signature) FROM (VALUES ('public.save_vocabulary_context(jsonb,jsonb,uuid,text)'),('public.set_vocabulary_exclusion(text,text,uuid,boolean,uuid)'),('public.lock_vocabulary_exclusion_owner()'),('public.preserve_deleted_vocabulary_exclusion()'),('public.guard_excluded_vocabulary()'),('public.guard_excluded_review_event()'),('public.sync_vocabulary_exclusion_identity()'),('public.sync_known_word_review_exclusion()'),('public.guard_known_word_review_exclusion()')) f(signature)
 UNION SELECT dependency.oid FROM (VALUES ('public.save_vocabulary_context(jsonb,jsonb,uuid,text)'),('public.save_vocabulary_context_for(uuid,jsonb,jsonb,uuid,text)'),('public.viewer_replace_analysis(bigint,text,jsonb,text,jsonb,uuid)'),('public.viewer_undo_vocabulary_save(uuid,jsonb,uuid[])'),('public.classroom_save_vocabulary(uuid,bigint,integer,bigint,text,jsonb,jsonb,jsonb,jsonb,uuid,text)'),('library_private.protect_source_delete()'),('public.guard_source_passage_write()'),('public.library_book_preserve_metadata()'),('public.validate_source_passage()'),('public.protect_composer_source()')) f(signature)
 JOIN pg_catalog.pg_proc dependency ON dependency.oid::pg_catalog.regprocedure::text=f.signature
 UNION SELECT t.tgfoid FROM pg_catalog.pg_trigger t JOIN tables c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal)
) SELECT pg_catalog.md5(pg_catalog.jsonb_object_agg(key,val ORDER BY key)::text) FROM objects
$q$;
-- 같은 지문에서 정책 식의 감싼 auth.uid()만 맨 호출로 되돌린 값 — 적용 전 · 뒤가 같으면 지문 변화는 감싸기뿐이다.
CREATE FUNCTION pg_temp.ri2_korean_unwrapped_hash() RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $q$
WITH RECURSIVE relevant_roles(oid) AS (
 SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN ('authenticated','anon','service_role')
 UNION SELECT m.roleid FROM pg_catalog.pg_auth_members m JOIN relevant_roles r ON r.oid=m.member
), tables AS (
 SELECT c.* FROM pg_catalog.pg_class c WHERE c.relnamespace='public'::pg_catalog.regnamespace
 AND c.relname IN ('user_vocabulary','vocabulary_contexts','user_known_words','vocabulary_exclusions','review_events','reading_materials','uploaded_pdfs','active_vocabulary','vocabulary_with_exclusions')
), objects AS (
 SELECT 'relation:'||c.relname AS key,pg_catalog.jsonb_build_array(c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.relacl,c.reloptions,c.relowner) AS val FROM tables c
 UNION ALL SELECT 'role:'||r.rolname,pg_catalog.jsonb_build_array(r.rolsuper,r.rolbypassrls,r.rolinherit) FROM pg_catalog.pg_roles r JOIN relevant_roles rr ON rr.oid=r.oid
 UNION ALL SELECT 'membership:'||m.member::text||':'||m.roleid::text,pg_catalog.to_jsonb(m) FROM pg_catalog.pg_auth_members m JOIN relevant_roles r ON r.oid=m.member
 UNION ALL SELECT 'schema:'||n.nspname,pg_catalog.jsonb_build_array(n.nspacl,n.nspowner) FROM pg_catalog.pg_namespace n WHERE n.nspname IN ('public','auth')
 UNION ALL SELECT 'constraint:'||c.relname||':'||x.conname,pg_catalog.to_jsonb(pg_catalog.pg_get_constraintdef(x.oid)) FROM pg_catalog.pg_constraint x JOIN tables c ON c.oid=x.conrelid
 UNION ALL SELECT 'index:'||c.relname||':'||i.indexrelid::text,pg_catalog.jsonb_build_array(pg_catalog.pg_get_indexdef(i.indexrelid),i.indisvalid,i.indisready) FROM pg_catalog.pg_index i JOIN tables c ON c.oid=i.indrelid
 UNION ALL SELECT 'policy:'||c.relname||':'||p.polname,pg_catalog.jsonb_build_array(p.polcmd,p.polpermissive,p.polroles,pg_catalog.regexp_replace(pg_catalog.pg_get_expr(p.polqual,p.polrelid),'\( SELECT auth\.uid\(\) AS uid\)','auth.uid()','g'),pg_catalog.regexp_replace(pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid),'\( SELECT auth\.uid\(\) AS uid\)','auth.uid()','g')) FROM pg_catalog.pg_policy p JOIN tables c ON c.oid=p.polrelid
 UNION ALL SELECT 'trigger:'||c.relname||':'||t.tgname,pg_catalog.jsonb_build_array(pg_catalog.pg_get_triggerdef(t.oid),t.tgenabled) FROM pg_catalog.pg_trigger t JOIN tables c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal
 UNION ALL SELECT 'view:'||c.relname,pg_catalog.to_jsonb(pg_catalog.pg_get_viewdef(c.oid,true)) FROM tables c WHERE c.relkind='v'
 UNION ALL SELECT 'column:'||c.relname||':'||a.attname,pg_catalog.jsonb_build_array(a.atttypid,a.atttypmod,a.attnotnull,a.attacl,a.attidentity,a.attgenerated,pg_catalog.pg_get_expr(d.adbin,d.adrelid)) FROM pg_catalog.pg_attribute a JOIN tables c ON c.oid=a.attrelid LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attnum>0 AND NOT a.attisdropped
 UNION ALL SELECT 'function:'||p.oid::text,pg_catalog.jsonb_build_array(pg_catalog.pg_get_functiondef(p.oid),p.proacl,p.proowner) FROM pg_catalog.pg_proc p WHERE p.oid IN (
 SELECT pg_catalog.to_regprocedure(f.signature) FROM (VALUES ('public.save_vocabulary_context(jsonb,jsonb,uuid,text)'),('public.set_vocabulary_exclusion(text,text,uuid,boolean,uuid)'),('public.lock_vocabulary_exclusion_owner()'),('public.preserve_deleted_vocabulary_exclusion()'),('public.guard_excluded_vocabulary()'),('public.guard_excluded_review_event()'),('public.sync_vocabulary_exclusion_identity()'),('public.sync_known_word_review_exclusion()'),('public.guard_known_word_review_exclusion()')) f(signature)
 UNION SELECT dependency.oid FROM (VALUES ('public.save_vocabulary_context(jsonb,jsonb,uuid,text)'),('public.save_vocabulary_context_for(uuid,jsonb,jsonb,uuid,text)'),('public.viewer_replace_analysis(bigint,text,jsonb,text,jsonb,uuid)'),('public.viewer_undo_vocabulary_save(uuid,jsonb,uuid[])'),('public.classroom_save_vocabulary(uuid,bigint,integer,bigint,text,jsonb,jsonb,jsonb,jsonb,uuid,text)'),('library_private.protect_source_delete()'),('public.guard_source_passage_write()'),('public.library_book_preserve_metadata()'),('public.validate_source_passage()'),('public.protect_composer_source()')) f(signature)
 JOIN pg_catalog.pg_proc dependency ON dependency.oid::pg_catalog.regprocedure::text=f.signature
 UNION SELECT t.tgfoid FROM pg_catalog.pg_trigger t JOIN tables c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal)
) SELECT pg_catalog.md5(pg_catalog.jsonb_object_agg(key,val ORDER BY key)::text) FROM objects
$q$;

-- capability 상태: 본문 템플릿(고정값 칸만 비운 md5) · 지문 SELECT 동일성 · 고정값 · 실제값 · 속성(oid/소유자/ACL/…).
CREATE FUNCTION pg_temp.ri2_cap() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object(
  'template_ok', pg_catalog.md5(pg_catalog.regexp_replace(p.prosrc, 'ready:=live_hash= ''([0-9a-f]{32})''', 'ready:=live_hash= ''<hash>''')) = '4a497440fb53bc1a27c1975875c7d737',
  'fingerprint_ok', pg_catalog.md5(pg_catalog.substring(p.prosrc, '(WITH RECURSIVE .*FROM objects) INTO live_hash;')) = '2e57290ce85b8f034f7f304dfdea3ad9'
    AND pg_catalog.md5(pg_catalog.btrim(t.prosrc, E'\n')) = '2e57290ce85b8f034f7f304dfdea3ad9',
  'pinned', pg_catalog.substring(p.prosrc, 'ready:=live_hash= ''([0-9a-f]{32})'''),
  'live', pg_temp.ri2_korean_live_hash(),
  'unwrapped', pg_temp.ri2_korean_unwrapped_hash(),
  'attrs', pg_catalog.jsonb_build_array(p.oid, p.proowner, p.proacl, p.prosecdef, p.proconfig, p.provolatile, p.proparallel,
           p.proleakproof, p.proisstrict, p.prolang, p.prorettype, p.proretset, p.pronargs, p.procost))
 FROM pg_catalog.pg_proc p, pg_catalog.pg_proc t
 WHERE p.oid = pg_catalog.to_regprocedure('public.learning_language_capabilities()')
   AND t.oid = pg_catalog.to_regprocedure('pg_temp.ri2_korean_live_hash()')
$q$;
-- 한국어 ready = 함수 본문이 검토한 모양이고 게시 = 실제(capability 함수의 ready 식과 같다 — 함수 자체는 로그인 사용자만 부른다).
CREATE FUNCTION pg_temp.ri2_korean_ready() RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT (c->>'template_ok')::boolean AND (c->>'fingerprint_ok')::boolean AND c->>'pinned' = c->>'live' FROM (SELECT pg_temp.ri2_cap() AS c) x
$q$;

-- 학습 계약 넷 — 게시값 = 원래 이름(캐시 또는 그 자리 계산) = _live(언제나 그 자리 계산), 그리고 게시값 자체.
CREATE FUNCTION pg_temp.ri2_contracts() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object(
  'ok', s.contract_hash IS NOT DISTINCT FROM fsrs_private.contract_hash()
    AND m.contract_hash IS NOT DISTINCT FROM fsrs_private.manual_contract_hash()
    AND a.contract_hash IS NOT DISTINCT FROM fsrs_private.admission_contract_hash()
    AND t.profile_contract_hash IS NOT DISTINCT FROM fsrs_private.activity_profile_hash(),
  'live_ok', s.contract_hash IS NOT DISTINCT FROM fsrs_private.contract_hash_live()
    AND m.contract_hash IS NOT DISTINCT FROM fsrs_private.manual_contract_hash_live()
    AND a.contract_hash IS NOT DISTINCT FROM fsrs_private.admission_contract_hash_live()
    AND t.profile_contract_hash IS NOT DISTINCT FROM fsrs_private.activity_profile_hash_live(),
  'core', s.contract_hash, 'manual', m.contract_hash, 'admission', a.contract_hash, 'profile', t.profile_contract_hash)
 FROM fsrs_private.settings s, fsrs_private.manual_save_settings m, fsrs_private.admission_settings a, fsrs_private.activity_settings t
$q$;

-- capability 고정값만 지금 실제값으로 다시 게시(191500 perf_repin_capability와 같은 방식 — 같은 oid · 소유자 · ACL · 속성, 고정값 한 칸만).
CREATE FUNCTION pg_temp.ri2_repin_capability() RETURNS text LANGUAGE plpgsql SET search_path = '' AS $q$
DECLARE c jsonb := pg_temp.ri2_cap(); d jsonb; src text; n integer;
BEGIN
 IF NOT ((c->>'template_ok')::boolean AND (c->>'fingerprint_ok')::boolean) THEN RAISE EXCEPTION 'rls_initplan_fp: capability body drift %', c; END IF;
 IF c->>'live' IS DISTINCT FROM c->>'pinned' THEN
  SELECT p.prosrc INTO STRICT src FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure('public.learning_language_capabilities()');
  n := (pg_catalog.length(src) - pg_catalog.length(pg_catalog.replace(src, pg_catalog.quote_literal(c->>'pinned'), ''))) / 34;
  IF n <> 1 THEN RAISE EXCEPTION 'rls_initplan_fp: pinned literal occurs % times', n; END IF;
  src := pg_catalog.replace(src, pg_catalog.quote_literal(c->>'pinned'), pg_catalog.quote_literal(c->>'live'));
  EXECUTE pg_catalog.format(
   'CREATE OR REPLACE FUNCTION public.learning_language_capabilities() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '''' AS %L',
   src);
 END IF;
 d := pg_temp.ri2_cap();
 IF d->'attrs' IS DISTINCT FROM c->'attrs' OR NOT (d->>'template_ok')::boolean OR NOT (d->>'fingerprint_ok')::boolean
    OR d->>'pinned' IS DISTINCT FROM c->>'live' OR d->>'live' IS DISTINCT FROM c->>'live'
 THEN RAISE EXCEPTION 'rls_initplan_fp: capability re-pin postcondition % -> %', c, d; END IF;
 RETURN d->>'pinned';
END
$q$;

DO $pre$
DECLARE c jsonb := pg_temp.ri2_contracts(); k jsonb := pg_temp.ri2_cap(); s jsonb := pg_temp.ri2_target_state(); b jsonb := pg_temp.ri2_bare();
BEGIN
 IF NOT ((k->>'template_ok')::boolean AND (k->>'fingerprint_ok')::boolean) THEN RAISE EXCEPTION 'rls_initplan_fp: capability body drift %', k - 'attrs'; END IF;
 IF NOT (c->>'ok')::boolean OR NOT (c->>'live_ok')::boolean THEN RAISE EXCEPTION 'rls_initplan_fp: learning contracts already drifted %', c; END IF;
 IF pg_temp.ri2_korean_ready() IS DISTINCT FROM true THEN RAISE EXCEPTION 'rls_initplan_fp: Korean capability not ready before change (pinned %, live %)', k->>'pinned', k->>'live'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
 IF (s->>'targets')::integer <> 17 OR (s->>'missing')::integer <> 0 THEN RAISE EXCEPTION 'rls_initplan_fp: target policies missing %', s; END IF;
 IF (b->>'outside_targets')::integer <> 0 THEN RAISE EXCEPTION 'rls_initplan_fp: unreviewed bare auth.* policies on the six tables %', b; END IF;
 IF (s->>'original')::integer = 17 THEN
  RAISE NOTICE 'rls_initplan_fp: needs change (17 policies with bare auth.uid())';
 ELSIF (s->>'wrapped')::integer = 17 THEN
  RAISE NOTICE 'rls_initplan_fp: already applied (17 policies wrapped, four contracts and Korean consistent) — no-op';
 ELSE
  RAISE EXCEPTION 'rls_initplan_fp: target policies are neither all original nor all wrapped %', s;
 END IF;
END $pre$;

-- ── 바꾸기 전 출력과 상태(같은 트랜잭션 안). 학습자 행은 임시 테이블에만 있고(ON COMMIT DROP) 밖으로 내보내지 않는다.
CREATE TEMP TABLE ri2_snapshot_before ON COMMIT DROP AS
 SELECT u.user_id AS actor, public.fsrs_vocabulary_snapshot(u.user_id) - 'now' AS body
 FROM (SELECT DISTINCT v.user_id FROM public.user_vocabulary v WHERE EXISTS (SELECT 1 FROM auth.users a WHERE a.id = v.user_id)) u;
CREATE TEMP TABLE ri2_policies_before ON COMMIT DROP AS SELECT * FROM pg_temp.ri2_policies();
CREATE TEMP TABLE ri2_state_before ON COMMIT DROP AS
 SELECT pg_temp.ri2_contracts() AS contracts, pg_temp.ri2_cap() AS cap, (pg_temp.ri2_target_state()->>'original')::integer = 17 AS needs_change,
        (SELECT pg_catalog.count(*) FROM pg_temp.ri2_snapshot_before) AS actors;

-- ── 변경: ⑴ 17개 정책(고칠 상태에서만) ⑵ 재게시 capability → core → profile → admission(바뀔 때만, _live 값으로, 정확히 1행).
DO $change$
DECLARE n integer;
BEGIN
 IF (SELECT b.needs_change FROM pg_temp.ri2_state_before b) THEN
  ALTER POLICY "Users can read own profile" ON public.profiles USING (((select auth.uid()) = id));
  ALTER POLICY "Users can update own profile" ON public.profiles USING (((select auth.uid()) = id));
  ALTER POLICY profiles_insert ON public.profiles WITH CHECK (((select auth.uid()) = id));
  ALTER POLICY profiles_update ON public.profiles USING (((select auth.uid()) = id));
  ALTER POLICY "Users can insert own materials" ON public.reading_materials WITH CHECK ((owner_id = (select auth.uid())));
  ALTER POLICY "Users can read public or own materials" ON public.reading_materials USING (((visibility = 'public'::text) OR (owner_id = (select auth.uid()))));
  ALTER POLICY "Users can update own materials" ON public.reading_materials USING ((owner_id = (select auth.uid())));
  ALTER POLICY owner_delete_material ON public.reading_materials USING (((select auth.uid()) = owner_id));
  ALTER POLICY owner_read_private_materials ON public.reading_materials USING (((visibility = 'private'::text) AND (owner_id = (select auth.uid()))));
  ALTER POLICY owner_update_material ON public.reading_materials USING (((select auth.uid()) = owner_id));
  ALTER POLICY review_events_insert_own ON public.review_events WITH CHECK (((select auth.uid()) = user_id));
  ALTER POLICY review_events_select_own ON public.review_events USING (((select auth.uid()) = user_id));
  ALTER POLICY "Owner full access" ON public.uploaded_pdfs USING (((select auth.uid()) = owner_id)) WITH CHECK (((select auth.uid()) = owner_id));
  ALTER POLICY user_known_words_delete_own ON public.user_known_words USING ((user_id = (select auth.uid())));
  ALTER POLICY user_known_words_insert_own ON public.user_known_words WITH CHECK ((user_id = (select auth.uid())));
  ALTER POLICY user_known_words_select_own ON public.user_known_words USING ((user_id = (select auth.uid())));
  ALTER POLICY "Users can manage own vocabulary" ON public.user_vocabulary USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
 END IF;
 PERFORM pg_temp.ri2_repin_capability();
 UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash_live() WHERE contract_hash IS DISTINCT FROM fsrs_private.contract_hash_live();
 GET DIAGNOSTICS n = ROW_COUNT; IF n > 1 THEN RAISE EXCEPTION 'rls_initplan_fp: core pin touched % rows', n; END IF;
 UPDATE fsrs_private.activity_settings SET profile_contract_hash = fsrs_private.activity_profile_hash_live()
  WHERE profile_contract_hash IS DISTINCT FROM fsrs_private.activity_profile_hash_live();
 GET DIAGNOSTICS n = ROW_COUNT; IF n > 1 THEN RAISE EXCEPTION 'rls_initplan_fp: profile pin touched % rows', n; END IF;
 UPDATE fsrs_private.admission_settings SET contract_hash = fsrs_private.admission_contract_hash_live()
  WHERE contract_hash IS DISTINCT FROM fsrs_private.admission_contract_hash_live();
 GET DIAGNOSTICS n = ROW_COUNT; IF n > 1 THEN RAISE EXCEPTION 'rls_initplan_fp: admission pin touched % rows', n; END IF;
END $change$;

-- ── 캐시 갱신을 지금 실행한다(커밋 때 할 일과 같은 함수 — 20261023170000). 이 뒤의 DDL은 임시 객체 DROP뿐이라 캐시를 무효로 만들지 않는다.
--    그래서 아래 사후 검사의 snapshot은 운영 요청과 같은 캐시 경로로 돈다(재계산 실패 시엔 경고 뒤 _live — 그래도 같은 값).
SET CONSTRAINTS fsrs_private.contract_cache_refresh IMMEDIATE;
SET CONSTRAINTS fsrs_private.contract_cache_refresh DEFERRED;

DO $post$
DECLARE b record; c jsonb := pg_temp.ri2_contracts(); k jsonb := pg_temp.ri2_cap(); s jsonb := pg_temp.ri2_target_state(); bare jsonb := pg_temp.ri2_bare();
 cache record; v_count_before integer; v_count_after integer; v_diff integer; diffs integer; t0 timestamptz; t1 timestamptz;
BEGIN
 SELECT * INTO STRICT b FROM pg_temp.ri2_state_before;

 -- 학습 계약: 네 게시값 = 캐시 경로 = _live, manual 불변, 이미 적용한 재실행은 아무것도 움직이지 않는다.
 IF NOT (c->>'ok')::boolean OR NOT (c->>'live_ok')::boolean THEN RAISE EXCEPTION 'rls_initplan_fp: contracts not consistent after change %', c; END IF;
 IF (SELECT s2.contract_hash FROM fsrs_private.settings s2) IS DISTINCT FROM fsrs_private.contract_hash()
    OR (SELECT m.contract_hash FROM fsrs_private.manual_save_settings m) IS DISTINCT FROM fsrs_private.manual_contract_hash()
    OR (SELECT a.contract_hash FROM fsrs_private.admission_settings a) IS DISTINCT FROM fsrs_private.admission_contract_hash()
    OR (SELECT t.profile_contract_hash FROM fsrs_private.activity_settings t) IS DISTINCT FROM fsrs_private.activity_profile_hash()
 THEN RAISE EXCEPTION 'rls_initplan_fp: a published pin differs from its fingerprint'; END IF;
 IF c->>'manual' IS DISTINCT FROM b.contracts->>'manual' THEN RAISE EXCEPTION 'rls_initplan_fp: manual pin moved'; END IF;
 IF NOT b.needs_change AND (c IS DISTINCT FROM b.contracts OR k IS DISTINCT FROM b.cap) THEN
  RAISE EXCEPTION 'rls_initplan_fp: already-applied run must not change anything';
 END IF;
 SELECT * INTO STRICT cache FROM fsrs_private.contract_cache;
 IF NOT cache.valid OR cache.core IS DISTINCT FROM c->>'core' OR cache.manual IS DISTINCT FROM c->>'manual'
    OR cache.admission IS DISTINCT FROM c->>'admission' OR cache.profile IS DISTINCT FROM c->>'profile'
 THEN RAISE EXCEPTION 'rls_initplan_fp: contract cache not refreshed to the pins'; END IF;
 PERFORM fsrs_private.require_admission_integrity();

 -- 한국어 capability: ready · 속성 불변 · 지문 변화는 감싸기뿐(감싼 호출을 되돌린 지문 = 적용 전).
 IF pg_temp.ri2_korean_ready() IS DISTINCT FROM true THEN RAISE EXCEPTION 'rls_initplan_fp: Korean capability ready <> true %', k - 'attrs'; END IF;
 IF k->'attrs' IS DISTINCT FROM b.cap->'attrs' THEN RAISE EXCEPTION 'rls_initplan_fp: capability function attributes changed'; END IF;
 IF k->>'unwrapped' IS DISTINCT FROM b.cap->>'unwrapped' THEN RAISE EXCEPTION 'rls_initplan_fp: capability fingerprint changed beyond the select-wrap'; END IF;
 IF b.needs_change AND k->>'live' IS NOT DISTINCT FROM b.cap->>'live' THEN RAISE EXCEPTION 'rls_initplan_fp: capability fingerprint did not move — policies not rewritten?'; END IF;

 -- 정책: 수 · 명령 · 역할 · PERMISSIVE 불변, 17개는 감싼 식(되돌리면 원래 식), 나머지는 글자 그대로, 맨 auth.* 0.
 IF (s->>'wrapped')::integer <> 17 THEN RAISE EXCEPTION 'rls_initplan_fp: target policies not all wrapped %', s; END IF;
 SELECT pg_catalog.count(*) INTO v_count_before FROM pg_temp.ri2_policies_before;
 SELECT pg_catalog.count(*) INTO v_count_after FROM pg_temp.ri2_policies();
 IF v_count_before <> v_count_after THEN RAISE EXCEPTION 'rls_initplan_fp: policy count changed (% -> %)', v_count_before, v_count_after; END IF;
 SELECT pg_catalog.count(*) INTO v_diff
 FROM pg_temp.ri2_policies_before o
 LEFT JOIN pg_temp.ri2_policies() a ON a.tbl = o.tbl AND a.pol = o.pol
 LEFT JOIN pg_temp.ri2_target t ON t.tbl = o.tbl AND t.pol = o.pol
 WHERE a.pol IS NULL
    OR a.cmd IS DISTINCT FROM o.cmd OR a.permissive IS DISTINCT FROM o.permissive OR a.roles IS DISTINCT FROM o.roles
    OR (t.pol IS NULL AND (a.qual IS DISTINCT FROM o.qual OR a.with_check IS DISTINCT FROM o.with_check))
    OR (t.pol IS NOT NULL AND (pg_temp.ri2_unwrap(a.qual) IS DISTINCT FROM t.qual OR pg_temp.ri2_unwrap(a.with_check) IS DISTINCT FROM t.with_check
                               OR pg_temp.ri2_unwrap(o.qual) IS DISTINCT FROM t.qual OR pg_temp.ri2_unwrap(o.with_check) IS DISTINCT FROM t.with_check));
 IF v_diff <> 0 THEN RAISE EXCEPTION 'rls_initplan_fp: % policies differ from their originals beyond the select-wrap', v_diff; END IF;
 IF (bare->>'all')::integer <> 0 THEN RAISE EXCEPTION 'rls_initplan_fp: % policies on the six tables still call auth.* per row', bare->>'all'; END IF;

 -- 학습 동작: 전 학습자 snapshot 출력이 바꾸기 전과 같다('now'만 뺀다).
 t0 := pg_catalog.clock_timestamp();
 SELECT pg_catalog.count(*)::integer INTO diffs FROM pg_temp.ri2_snapshot_before x
  WHERE (public.fsrs_vocabulary_snapshot(x.actor) - 'now') IS DISTINCT FROM x.body;
 t1 := pg_catalog.clock_timestamp();
 IF diffs <> 0 THEN RAISE EXCEPTION 'rls_initplan_fp: snapshot output changed for % of % actor(s)', diffs, b.actors; END IF;

 RAISE NOTICE 'rls_initplan_fp: ok — % ; Korean pinned % -> % (ready=%); pins % -> %; % actors identical; snapshot (all actors) % ms',
  CASE WHEN b.needs_change THEN '17 policies wrapped' ELSE 'already applied, nothing changed' END,
  b.cap->>'pinned', k->>'pinned', pg_temp.ri2_korean_ready(), b.contracts - 'ok' - 'live_ok', c - 'ok' - 'live_ok', b.actors,
  pg_catalog.round(extract(epoch FROM t1 - t0) * 1000);
END $post$;

DROP FUNCTION pg_temp.ri2_repin_capability(); DROP FUNCTION pg_temp.ri2_contracts(); DROP FUNCTION pg_temp.ri2_korean_ready();
DROP FUNCTION pg_temp.ri2_cap(); DROP FUNCTION pg_temp.ri2_korean_unwrapped_hash(); DROP FUNCTION pg_temp.ri2_korean_live_hash();
DROP FUNCTION pg_temp.ri2_bare(); DROP FUNCTION pg_temp.ri2_target_state(); DROP FUNCTION pg_temp.ri2_policies();
DROP FUNCTION pg_temp.ri2_unwrap(text); DROP FUNCTION pg_temp.ri2_wrap(text);
DROP TABLE pg_temp.ri2_state_before, pg_temp.ri2_policies_before, pg_temp.ri2_snapshot_before, pg_temp.ri2_target;
