-- 한국어 학습 capability 고정값 재게시 — #1504 회귀 복구(KO-CAP-REPIN-001). 적용 경로 = PR이 main에 병합되면
--   supabase-migrations.yml(db push)이 운영에 바로 적용한다. 그래서 병합 승인 = 이 재게시의 운영 적용 승인이다.
-- 원인(2026-10-17 KST 운영 읽기 · 조정자 독립 재확인): #1504(20261016150000_anon_book_catalog)가 reading_materials에
--   RESTRICTIVE 정책 anon_book_chapters_hidden을 더했다. reading_materials 정책은 learning_language_capabilities() 지문 범위라
--   실제값 'da2c7548aa782ebb81d55e69d913cd52' ≠ 게시값 '1c25422cdd5f6be088ac624e8858cb3d' → 한국어 ready=false
--   (한국어 저장 · 복습 · 아는 단어 · 제외가 꺼짐). 그 정책 키 하나를 뺀 지문 = 게시값 — 원인은 그것 하나다(사전 검사가 다시 확인).
--   §4.9-1(지문 범위를 건드리면 같은 트랜잭션에서 재게시)이 그 마이그레이션에서 빠졌다.
-- 바뀌는 것: ⑴ capability 본문의 고정값 한 칸 → 이 트랜잭션에서 계산한 실제값(검토 시 'da2c7548aa782ebb81d55e69d913cd52') — 같은 oid · 소유자 ·
--   ACL · 속성, 나머지 본문 불변(템플릿 md5 4a497440fb53bc1a27c1975875c7d737) ⑵ 그 정의를 해시하는 FSRS core 게시값 fsrs_private.settings.contract_hash
--   ('9dcbdd2614642e67911d4fcf2055b42d' → 계산값). manual · admission · activity profile 게시값과 학습자 행은 그대로(사후 검사).
-- 앞 마이그레이션 20261016171800_admin_set_user_role(같은 push에서 먼저 적용)은 새 public 함수 하나라 네 계약 · 이 지문 어디에도
--   들지 않는다(지문 함수 목록 = 고정 목록 + 9개 표의 트리거 함수, core = fsrs_private · public.fsrs_% · capability) — 그래서 사전
--   검사의 고정 기대값이 병합 시점에도 유효하다. 다르면 사전 검사가 멈추고 아무것도 바꾸지 않는다.
-- 멱등: 오너가 병합 전에 같은 재게시를 SQL 편집기로 먼저 적용했으면(게시 = 실제 = 'da2c7548aa782ebb81d55e69d913cd52', 네 계약 동치) 사전 검사가
--   「이미 고친 상태」로 받아 아무것도 바꾸지 않고 끝난다(사후 검사가 무변경을 확인). 그 두 상태 밖이면 RAISE.
-- 실행 형태: db push는 이 파일 전체 + 이력 INSERT를 한 파이프라인(암묵 트랜잭션 하나)으로 보낸다 → BEGIN/COMMIT 없음, SET LOCAL 유효
--   (첫 DO가 실제로 걸렸는지 확인). 어느 검사든 RAISE하면 이력 기록까지 함께 롤백된다.
-- 복원(= 한국어를 다시 끄는 고장 상태로 되돌리기 — 쓸 일 없음): 같은 도구로 perf_repin_capability('1c25422cdd5f6be088ac624e8858cb3d') → perf_repin('core'),
--   사후 검사 = 네 게시값이 원래 값('9dcbdd2614642e67911d4fcf2055b42d' 등)과 같음 · Korean ready=false · snapshot 동일.
-- 실행 주체: postgres. 앱 사용자(JWT)를 만들지 않는다. 학습자 행은 비교용 임시 테이블에만 담고 끝에서 지운다.
SET LOCAL search_path = '';
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '180s';

-- 실행기 확인: SET LOCAL이 이 트랜잭션에 실제로 걸렸어야 한다(db push 파이프라인 = 암묵 트랜잭션 하나).
DO $runner$
BEGIN
 IF pg_catalog.current_setting('search_path') NOT IN ('', '""') OR pg_catalog.current_setting('lock_timeout') <> '5s'
    OR pg_catalog.current_setting('statement_timeout') <> '3min'
 THEN RAISE EXCEPTION 'korean_capability_repin: SET LOCAL not in effect (search_path=%, lock_timeout=%, statement_timeout=%)',
   pg_catalog.current_setting('search_path'), pg_catalog.current_setting('lock_timeout'), pg_catalog.current_setting('statement_timeout');
 END IF;
END $runner$;

-- ── 공통 도구(pg_temp, 이 세션 전용 · 끝에서 DROP). 정본 함수를 복제 · 실행하지 않는다(선례 m09 repair 019).
-- 한국어 capability 지문 = learning_language_capabilities() 본문의 그 SELECT를 바이트 그대로(md5 2e57290ce85b8f034f7f304dfdea3ad9).
-- 같은지 아래 perf_cap()이 운영 본문에서 다시 확인한다(fingerprint_ok).
CREATE FUNCTION pg_temp.perf_korean_live_hash() RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $q$
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
CREATE FUNCTION pg_temp.perf_korean_live_hash_without(p_key text) RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $q$
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
) SELECT pg_catalog.md5(pg_catalog.jsonb_object_agg(key,val ORDER BY key)::text) FROM objects WHERE key <> p_key
$q$;

-- capability 상태: 본문 템플릿(고정값 칸만 비운 md5) · 지문 SELECT 동일성 · 고정값 · 실제값 · 속성(oid/소유자/ACL/…).
CREATE FUNCTION pg_temp.perf_cap() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object(
  'template_ok', pg_catalog.md5(pg_catalog.regexp_replace(p.prosrc, 'ready:=live_hash= ''([0-9a-f]{32})''', 'ready:=live_hash= ''<hash>''')) = '4a497440fb53bc1a27c1975875c7d737',
  'fingerprint_ok', pg_catalog.md5(pg_catalog.substring(p.prosrc, '(WITH RECURSIVE .*FROM objects) INTO live_hash;')) = '2e57290ce85b8f034f7f304dfdea3ad9'
    AND pg_catalog.md5(pg_catalog.btrim(t.prosrc, E'\n')) = '2e57290ce85b8f034f7f304dfdea3ad9',
  'pinned', pg_catalog.substring(p.prosrc, 'ready:=live_hash= ''([0-9a-f]{32})'''),
  'live', pg_temp.perf_korean_live_hash(),
  'attrs', pg_catalog.jsonb_build_array(p.oid, p.proowner, p.proacl, p.prosecdef, p.proconfig, p.provolatile, p.proparallel,
           p.proleakproof, p.proisstrict, p.prolang, p.prorettype, p.proretset, p.pronargs, p.procost))
 FROM pg_catalog.pg_proc p, pg_catalog.pg_proc t
 WHERE p.oid = pg_catalog.to_regprocedure('public.learning_language_capabilities()')
   AND t.oid = pg_catalog.to_regprocedure('pg_temp.perf_korean_live_hash()')
$q$;
CREATE FUNCTION pg_temp.perf_korean_ready() RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT (c->>'template_ok')::boolean AND (c->>'fingerprint_ok')::boolean AND c->>'pinned' = c->>'live' FROM (SELECT pg_temp.perf_cap() AS c) x
$q$;

-- 학습 계약 넷 — 게시된 지문 = 지금 계산한 지문, 그리고 게시값 자체.
CREATE FUNCTION pg_temp.perf_contracts() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object(
  'ok', s.contract_hash IS NOT DISTINCT FROM fsrs_private.contract_hash()
    AND m.contract_hash IS NOT DISTINCT FROM fsrs_private.manual_contract_hash()
    AND a.contract_hash IS NOT DISTINCT FROM fsrs_private.admission_contract_hash()
    AND t.profile_contract_hash IS NOT DISTINCT FROM fsrs_private.activity_profile_hash(),
  'core', s.contract_hash, 'manual', m.contract_hash, 'admission', a.contract_hash, 'profile', t.profile_contract_hash)
 FROM fsrs_private.settings s, fsrs_private.manual_save_settings m, fsrs_private.admission_settings a, fsrs_private.activity_settings t
$q$;

-- 함수 속성(본문 md5 + 본문 외 전부). CREATE OR REPLACE 뒤 '본문 외'가 그대로인지 비교한다.
CREATE FUNCTION pg_temp.perf_fn(p_sig text) RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object('md5', pg_catalog.md5(p.prosrc),
  'attrs', pg_catalog.jsonb_build_array(p.oid, p.proowner, p.proacl, p.prosecdef, p.proconfig, p.provolatile, p.proparallel,
           p.proleakproof, p.proisstrict, p.prolang, p.prorettype, p.proretset, p.procost, p.prorows,
           pg_catalog.pg_get_function_arguments(p.oid)))
 FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure(p_sig)
$q$;

-- capability 고정값만 다시 게시(선례 docs/sql/korean-source-passage.sql §3과 같은 방식 — 같은 oid · 소유자 · ACL · 속성).
-- p_value NULL = 지금 실제값(같은 트랜잭션에서 계산), 아니면 그 값(restore_p0 전용 — 옛 값으로 되돌림).
CREATE FUNCTION pg_temp.perf_repin_capability(p_value text) RETURNS text LANGUAGE plpgsql SET search_path = '' AS $q$
DECLARE c jsonb := pg_temp.perf_cap(); d jsonb; target text; src text; n integer;
BEGIN
 IF NOT ((c->>'template_ok')::boolean AND (c->>'fingerprint_ok')::boolean) THEN RAISE EXCEPTION 'perf: capability body drift %', c; END IF;
 target := coalesce(p_value, c->>'live');
 IF target IS DISTINCT FROM c->>'pinned' THEN
  SELECT p.prosrc INTO STRICT src FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure('public.learning_language_capabilities()');
  n := (pg_catalog.length(src) - pg_catalog.length(pg_catalog.replace(src, pg_catalog.quote_literal(c->>'pinned'), ''))) / 34;
  IF n <> 1 THEN RAISE EXCEPTION 'perf: pinned literal occurs % times', n; END IF;
  src := pg_catalog.replace(src, pg_catalog.quote_literal(c->>'pinned'), pg_catalog.quote_literal(target));
  EXECUTE pg_catalog.format(
   'CREATE OR REPLACE FUNCTION public.learning_language_capabilities() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '''' AS %L',
   src);
 END IF;
 d := pg_temp.perf_cap();
 IF d->'attrs' IS DISTINCT FROM c->'attrs' OR NOT (d->>'template_ok')::boolean OR NOT (d->>'fingerprint_ok')::boolean
    OR d->>'pinned' IS DISTINCT FROM target OR d->>'live' IS DISTINCT FROM c->>'live'
 THEN RAISE EXCEPTION 'perf: capability re-pin postcondition % -> %', c, d; END IF;
 RETURN target;
END
$q$;

-- 게시 지문 한 칸을 '지금 계산한 값'으로(바뀔 때만, 정확히 1행).
CREATE FUNCTION pg_temp.perf_repin(p_which text) RETURNS void LANGUAGE plpgsql SET search_path = '' AS $q$
DECLARE n integer;
BEGIN
 IF p_which = 'core' THEN
  UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash() WHERE contract_hash IS DISTINCT FROM fsrs_private.contract_hash();
 ELSIF p_which = 'manual' THEN
  UPDATE fsrs_private.manual_save_settings SET contract_hash = fsrs_private.manual_contract_hash() WHERE contract_hash IS DISTINCT FROM fsrs_private.manual_contract_hash();
 ELSIF p_which = 'admission' THEN
  UPDATE fsrs_private.admission_settings SET contract_hash = fsrs_private.admission_contract_hash() WHERE contract_hash IS DISTINCT FROM fsrs_private.admission_contract_hash();
 ELSE RAISE EXCEPTION 'perf: unknown pin %', p_which; END IF;
 GET DIAGNOSTICS n = ROW_COUNT;
 IF n > 1 THEN RAISE EXCEPTION 'perf: % pin touched % rows', p_which, n; END IF;
END
$q$;


DO $pre$
DECLARE c jsonb := pg_temp.perf_contracts(); k jsonb := pg_temp.perf_cap();
BEGIN
 IF NOT ((k->>'template_ok')::boolean AND (k->>'fingerprint_ok')::boolean) THEN RAISE EXCEPTION 'korean_capability_repin: capability body drift %', k; END IF;
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'korean_capability_repin: learning contracts already drifted %', c; END IF;
 PERFORM fsrs_private.require_admission_integrity();

 -- 받아들이는 상태는 둘뿐: ① 고칠 상태(게시 = #1393 값, 실제 = #1504 값, core = 원래 게시값)
 --                      ② 이미 고친 상태(SQL 편집기로 먼저 적용 — 게시 = 실제 = #1504 값, 네 계약 동치) → 아래 변경이 전부 무변경(no-op).
 IF k->>'live' IS DISTINCT FROM 'da2c7548aa782ebb81d55e69d913cd52' THEN RAISE EXCEPTION 'korean_capability_repin: live value is not the reviewed #1504 state %', k->>'live'; END IF;
 IF pg_temp.perf_korean_live_hash_without('policy:reading_materials:anon_book_chapters_hidden') IS DISTINCT FROM '1c25422cdd5f6be088ac624e8858cb3d' THEN RAISE EXCEPTION 'korean_capability_repin: drift is not only anon_book_chapters_hidden'; END IF;
 IF pg_catalog.to_regclass('public.user_known_words_norm_word_idx') IS NOT NULL THEN RAISE EXCEPTION 'korean_capability_repin: run P0 before P3'; END IF;
 IF c->>'manual' IS DISTINCT FROM 'edef271bed593ff8cec045bb5661fde3' OR c->>'admission' IS DISTINCT FROM 'af33cb37ca276d0b23af51f0f46c012b' OR c->>'profile' IS DISTINCT FROM 'e892069f4a99f5ba9565c54d72226740'
 THEN RAISE EXCEPTION 'korean_capability_repin: pins are not the reviewed values %', c; END IF;
 IF k->>'pinned' = '1c25422cdd5f6be088ac624e8858cb3d' THEN
  IF c->>'core' IS DISTINCT FROM '9dcbdd2614642e67911d4fcf2055b42d' THEN RAISE EXCEPTION 'korean_capability_repin: core pin is not the reviewed value %', c; END IF;
  RAISE NOTICE 'korean_capability_repin: needs repair (pinned=%, live=%)', k->>'pinned', k->>'live';
 ELSIF k->>'pinned' = 'da2c7548aa782ebb81d55e69d913cd52' THEN
  IF c->>'core' = '9dcbdd2614642e67911d4fcf2055b42d' THEN RAISE EXCEPTION 'korean_capability_repin: capability repaired but core pin not republished %', c; END IF;
  RAISE NOTICE 'korean_capability_repin: already repaired (pinned = live = %, four contracts consistent) — no-op', k->>'live';
 ELSE
  RAISE EXCEPTION 'korean_capability_repin: pinned value is neither the #1393 value nor the repaired value %', k->>'pinned';
 END IF;
END $pre$;

-- ── 바꾸기 전 출력과 상태(같은 트랜잭션 안).
CREATE TEMP TABLE perf_snapshot_before ON COMMIT DROP AS
 SELECT u.user_id AS actor, public.fsrs_vocabulary_snapshot(u.user_id) - 'now' AS body
 FROM (SELECT DISTINCT v.user_id FROM public.user_vocabulary v WHERE EXISTS (SELECT 1 FROM auth.users a WHERE a.id = v.user_id)) u;
CREATE TEMP TABLE perf_state_before ON COMMIT DROP AS
 SELECT pg_temp.perf_contracts() AS contracts, pg_temp.perf_cap() AS cap, pg_temp.perf_korean_ready() AS korean_ready,
        (SELECT pg_catalog.count(*) FROM perf_snapshot_before) AS actors;

-- 같은 트랜잭션 비교 대상: 바꾸기 전 snapshot 출력(사용자마다) — fsrs_vocabulary_snapshot은 STABLE plpgsql이고 SELECT만 한다
-- (정의 확인: require_admission_integrity · vocabulary_registry_entry · blocked · next_question_at · iso_milliseconds 모두 STABLE, 쓰기 없음).
-- 'now'(statement_timestamp)만 문장마다 달라 뺀다. 학습자 행은 임시 테이블에만 있고(ON COMMIT DROP) 밖으로 내보내지 않는다.
CREATE FUNCTION pg_temp.perf_snapshot_diffs() RETURNS integer LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.count(*)::integer FROM pg_temp.perf_snapshot_before b
 WHERE (public.fsrs_vocabulary_snapshot(b.actor) - 'now') IS DISTINCT FROM b.body
$q$;

-- ── 변경: capability 고정값 → FSRS core 게시값(선례 korean-source-passage.sql §3 · §4).
DO $change$
BEGIN
 PERFORM pg_temp.perf_repin_capability(NULL);
 PERFORM pg_temp.perf_repin('core');
END $change$;

DO $post$
DECLARE b record; c jsonb; diffs integer; t0 timestamptz; t1 timestamptz;
BEGIN
 SELECT * INTO b FROM perf_state_before;

 IF (pg_temp.perf_cap()->>'pinned') IS DISTINCT FROM 'da2c7548aa782ebb81d55e69d913cd52' THEN RAISE EXCEPTION 'korean_capability_repin: unexpected new pin'; END IF;
 IF b.cap->>'pinned' = 'da2c7548aa782ebb81d55e69d913cd52' AND (pg_temp.perf_contracts() IS DISTINCT FROM b.contracts OR pg_temp.perf_cap() IS DISTINCT FROM b.cap)
 THEN RAISE EXCEPTION 'korean_capability_repin: already-repaired run must not change anything'; END IF;
 IF (pg_temp.perf_contracts()->>'manual') IS DISTINCT FROM 'edef271bed593ff8cec045bb5661fde3' OR (pg_temp.perf_contracts()->>'admission') IS DISTINCT FROM 'af33cb37ca276d0b23af51f0f46c012b'
 THEN RAISE EXCEPTION 'korean_capability_repin: manual/admission pin moved'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
 c := pg_temp.perf_contracts();
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'korean_capability_repin: contracts not consistent after change %', c; END IF;
 IF c->>'profile' IS DISTINCT FROM b.contracts->>'profile' THEN RAISE EXCEPTION 'korean_capability_repin: activity profile pin moved'; END IF;
 IF pg_temp.perf_korean_ready() IS DISTINCT FROM true THEN RAISE EXCEPTION 'korean_capability_repin: Korean capability ready <> true %', pg_temp.perf_cap(); END IF;
 t0 := pg_catalog.clock_timestamp();
 diffs := pg_temp.perf_snapshot_diffs();
 t1 := pg_catalog.clock_timestamp();
 IF diffs <> 0 THEN RAISE EXCEPTION 'korean_capability_repin: snapshot output changed for % of % actor(s)', diffs, b.actors; END IF;
 RAISE NOTICE 'korean_capability_repin: ok — pins % -> %; Korean ready=%; % actors identical; snapshot (all actors) % ms',
  b.contracts, c, pg_temp.perf_korean_ready(), b.actors, pg_catalog.round(extract(epoch FROM t1 - t0) * 1000);
END $post$;

DROP FUNCTION pg_temp.perf_snapshot_diffs(); DROP FUNCTION pg_temp.perf_repin(text); DROP FUNCTION pg_temp.perf_repin_capability(text);
DROP FUNCTION pg_temp.perf_fn(text); DROP FUNCTION pg_temp.perf_contracts(); DROP FUNCTION pg_temp.perf_korean_ready();
DROP FUNCTION pg_temp.perf_cap(); DROP FUNCTION pg_temp.perf_korean_live_hash_without(text); DROP FUNCTION pg_temp.perf_korean_live_hash();
DROP TABLE pg_temp.perf_state_before, pg_temp.perf_snapshot_before;
