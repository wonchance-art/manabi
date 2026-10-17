-- PERF-SNAPSHOT P4 복원 — 20261016191600_vocabulary_snapshot_set_flags.sql을 되돌린다: snapshot을 운영 원문(md5 f31dd8681a092d3df84746a0dfea9c79)으로, manual → core → admission 재게시.
-- manual · admission은 원래 게시값으로 정확히 돌아와야 한다(사후 검사). 운영 적용은 오너 승인 후 SQL 편집기에서 본문 그대로.
-- 이 파일은 마이그레이션이 아니다(docs/sql) — db push가 적용하지 않는다.
-- 실행 형태: db push는 파일 전체 + 이력 INSERT를 한 파이프라인(암묵 트랜잭션 하나)으로 보낸다 → BEGIN/COMMIT 없음, SET LOCAL 실효를
--   첫 DO가 확인. 어느 검사든 RAISE하면 이력까지 함께 롤백된다. 실행 주체 postgres, 앱 사용자(JWT)를 만들지 않는다.
-- 학습자 행은 전후 snapshot 비교용 임시 테이블에만 담고 끝에서 지운다.
-- 사후 검사: 전 사용자 snapshot 출력 동일 · registry_entry = snapshot.registry · 네 계약 · Korean ready.
SET LOCAL search_path = '';
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '180s';

-- 실행기 확인: SET LOCAL이 이 트랜잭션에 실제로 걸렸어야 한다(db push 파이프라인 = 암묵 트랜잭션 하나).
DO $runner$
BEGIN
 IF pg_catalog.current_setting('search_path') NOT IN ('', '""') OR pg_catalog.current_setting('lock_timeout') <> '5s'
    OR pg_catalog.current_setting('statement_timeout') <> '3min'
 THEN RAISE EXCEPTION 'perf_r4: SET LOCAL not in effect (search_path=%, lock_timeout=%, statement_timeout=%)',
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
 IF NOT ((k->>'template_ok')::boolean AND (k->>'fingerprint_ok')::boolean) THEN RAISE EXCEPTION 'perf_r4: capability body drift %', k; END IF;
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'perf_r4: learning contracts already drifted %', c; END IF;
 PERFORM fsrs_private.require_admission_integrity();

 IF NOT pg_temp.perf_korean_ready() THEN RAISE EXCEPTION 'perf_r4: Korean capability is not ready — 20261016191500_korean_capability_repin must be applied first %', k; END IF;
 IF k->>'live' IS DISTINCT FROM 'da2c7548aa782ebb81d55e69d913cd52' THEN RAISE EXCEPTION 'perf_r4: capability fingerprint is not the reviewed post-KO-CAP-REPIN state %', k; END IF;
 IF pg_catalog.to_regclass('public.user_known_words_norm_word_idx') IS NOT NULL THEN RAISE EXCEPTION 'perf_r4: unexpected index public.user_known_words_norm_word_idx (PERF-SNAPSHOT P3 is held)'; END IF;
 IF c->>'profile' IS DISTINCT FROM 'e892069f4a99f5ba9565c54d72226740' THEN RAISE EXCEPTION 'perf_r4: activity profile pin is not the reviewed value %', c; END IF;
 IF pg_temp.perf_fn('fsrs_private.blocked(uuid,uuid)')->>'md5' IS DISTINCT FROM '49c0d23698f8b9ebe3401f54f44418c9' THEN RAISE EXCEPTION 'perf_r4: fsrs_private.blocked drift'; END IF;
 IF pg_temp.perf_fn('fsrs_private.vocabulary_registry_entry(uuid,uuid)')->>'md5' IS DISTINCT FROM '771d6c4f3ecc170b6ae0eb685771ce4e' THEN RAISE EXCEPTION 'perf_r4: vocabulary_registry_entry is not the reviewed body'; END IF;
 IF pg_temp.perf_fn('public.fsrs_vocabulary_snapshot(uuid)')->>'md5' IS DISTINCT FROM '90cb5fb52d43d00eeb4b5c5a41ba8b19' THEN RAISE EXCEPTION 'perf_r4: snapshot is not the P4 body — nothing to restore'; END IF;
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

CREATE TEMP TABLE perf_fn_before ON COMMIT DROP AS
 SELECT pg_temp.perf_fn('fsrs_private.vocabulary_registry_entry(uuid,uuid)') AS reg, pg_temp.perf_fn('public.fsrs_vocabulary_snapshot(uuid)') AS snap;

-- ── snapshot을 P4 직전 운영 원문으로(바이트 그대로)
CREATE OR REPLACE FUNCTION public.fsrs_vocabulary_snapshot(p_actor uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
 AS $fn$
DECLARE s fsrs_private.settings%rowtype; result jsonb;
BEGIN
 PERFORM fsrs_private.require_admission_integrity();
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor) THEN RAISE EXCEPTION 'invalid_fsrs_actor' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.fsrs_cards f LEFT JOIN public.user_vocabulary v ON v.id=f.card_id WHERE f.user_id=p_actor AND (v.id IS NULL OR v.user_id IS DISTINCT FROM p_actor)) THEN RAISE EXCEPTION 'fsrs_snapshot_inconsistent' USING ERRCODE='55000'; END IF;
 SELECT * INTO STRICT s FROM fsrs_private.settings;
 IF s.contract_hash IS DISTINCT FROM fsrs_private.contract_hash() OR (SELECT contract_hash FROM fsrs_private.manual_save_settings) IS DISTINCT FROM fsrs_private.manual_contract_hash() THEN RAISE EXCEPTION 'fsrs_snapshot_unavailable' USING ERRCODE='55000'; END IF;
 SELECT jsonb_build_object('version',1,'learningAdmissionVersion',1,'actorId',p_actor,'enabled',s.enabled,'registryAvailable',true,'complete',true,
  'now',fsrs_private.iso_milliseconds(statement_timestamp()),
  'rows',coalesce(jsonb_agg(to_jsonb(v) ORDER BY v.id),'[]'::jsonb),
  'registry',coalesce(jsonb_agg(fsrs_private.vocabulary_registry_entry(p_actor,v.id) ORDER BY v.id),'[]'::jsonb))
 INTO result FROM public.user_vocabulary v WHERE v.user_id=p_actor;
 RETURN result;
END $fn$;

DO $change$
BEGIN
 PERFORM pg_temp.perf_repin('manual');
 PERFORM pg_temp.perf_repin('core');
 PERFORM pg_temp.perf_repin('admission');
END $change$;

DO $post$
DECLARE b record; c jsonb; diffs integer; t0 timestamptz; t1 timestamptz;
BEGIN
 SELECT * INTO b FROM perf_state_before;

 IF pg_temp.perf_fn('public.fsrs_vocabulary_snapshot(uuid)')->>'md5' IS DISTINCT FROM 'f31dd8681a092d3df84746a0dfea9c79' THEN RAISE EXCEPTION 'perf_r4: snapshot body is not the expected one'; END IF;
 IF pg_temp.perf_fn('fsrs_private.blocked(uuid,uuid)')->>'md5' IS DISTINCT FROM '49c0d23698f8b9ebe3401f54f44418c9' THEN RAISE EXCEPTION 'perf_r4: fsrs_private.blocked drift'; END IF;
 IF (SELECT f.reg IS DISTINCT FROM pg_temp.perf_fn('fsrs_private.vocabulary_registry_entry(uuid,uuid)') OR f.snap->'attrs' IS DISTINCT FROM pg_temp.perf_fn('public.fsrs_vocabulary_snapshot(uuid)')->'attrs' FROM perf_fn_before f)
 THEN RAISE EXCEPTION 'perf_r4: registry entry changed or snapshot attributes/owner/ACL changed'; END IF;
 IF pg_temp.perf_cap() IS DISTINCT FROM b.cap THEN RAISE EXCEPTION 'perf_r4: capability changed'; END IF;
 IF (pg_temp.perf_contracts()->>'manual') IS DISTINCT FROM 'edef271bed593ff8cec045bb5661fde3' OR (pg_temp.perf_contracts()->>'admission') IS DISTINCT FROM 'af33cb37ca276d0b23af51f0f46c012b'
 THEN RAISE EXCEPTION 'perf_r4: manual/admission did not return to the original pins %', pg_temp.perf_contracts(); END IF;
 PERFORM fsrs_private.require_admission_integrity();
 c := pg_temp.perf_contracts();
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'perf_r4: contracts not consistent after change %', c; END IF;
 IF c->>'profile' IS DISTINCT FROM b.contracts->>'profile' THEN RAISE EXCEPTION 'perf_r4: activity profile pin moved'; END IF;
 IF pg_temp.perf_korean_ready() IS DISTINCT FROM true THEN RAISE EXCEPTION 'perf_r4: Korean capability ready <> true %', pg_temp.perf_cap(); END IF;
 t0 := pg_catalog.clock_timestamp();
 diffs := pg_temp.perf_snapshot_diffs();
 t1 := pg_catalog.clock_timestamp();
 IF diffs <> 0 THEN RAISE EXCEPTION 'perf_r4: snapshot output changed for % of % actor(s)', diffs, b.actors; END IF;
 RAISE NOTICE 'perf_r4: ok — pins % -> %; Korean ready=%; % actors identical; snapshot (all actors) % ms',
  b.contracts, c, pg_temp.perf_korean_ready(), b.actors, pg_catalog.round(extract(epoch FROM t1 - t0) * 1000);
END $post$;

-- ── 사후 검사 ⑵: 단일 카드 정의와 집합 정의가 모든 사용자의 모든 카드에서 같다 — vocabulary_registry_entry(actor, id) = snapshot.registry[i].
--    (사후 검사 ⑴은 위 DO: 바꾸기 전과 후 전 사용자 snapshot 출력이 같다.) 하나라도 다르면 RAISE → 이력까지 전체 롤백.
DO $parity$
DECLARE cards integer; bad integer;
BEGIN
 SELECT pg_catalog.count(*)::integer,
        pg_catalog.count(*) FILTER (WHERE fsrs_private.vocabulary_registry_entry(s.actor, (e.x->>'cardId')::uuid) IS DISTINCT FROM e.x)::integer
   INTO cards, bad
   FROM (SELECT b.actor, public.fsrs_vocabulary_snapshot(b.actor) AS snap FROM pg_temp.perf_snapshot_before b) s
   CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(s.snap->'registry') AS e(x);
 IF bad <> 0 THEN RAISE EXCEPTION 'perf_r4: registry_entry differs from snapshot.registry for % of % card(s)', bad, cards; END IF;
 IF cards IS DISTINCT FROM (SELECT pg_catalog.count(*)::integer FROM public.user_vocabulary v WHERE v.user_id IN (SELECT actor FROM pg_temp.perf_snapshot_before))
 THEN RAISE EXCEPTION 'perf_r4: registry card count differs from vocabulary rows (% cards)', cards; END IF;
 RAISE NOTICE 'perf_r4: registry_entry = snapshot.registry for all % card(s)', cards;
END $parity$;

DROP FUNCTION pg_temp.perf_snapshot_diffs(); DROP FUNCTION pg_temp.perf_repin(text); DROP FUNCTION pg_temp.perf_repin_capability(text);
DROP FUNCTION pg_temp.perf_fn(text); DROP FUNCTION pg_temp.perf_contracts(); DROP FUNCTION pg_temp.perf_korean_ready();
DROP FUNCTION pg_temp.perf_cap(); DROP FUNCTION pg_temp.perf_korean_live_hash_without(text); DROP FUNCTION pg_temp.perf_korean_live_hash();
DROP TABLE pg_temp.perf_fn_before, pg_temp.perf_state_before, pg_temp.perf_snapshot_before;
