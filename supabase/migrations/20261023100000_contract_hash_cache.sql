-- DB-LOAD C — 학습 계약 지문 넷을 구조가 바뀔 때만 계산한다(오너 승인 2026-10-23 KST 「개선안 진행」).
-- 적용 경로 = PR이 main에 병합되면 supabase-migrations.yml(db push)이 운영에 바로 적용한다 → 병합 = 운영 적용.
-- 실행 형태: db push는 파일 전체 + 이력 INSERT를 한 파이프라인(암묵 트랜잭션 하나)으로 보낸다 → BEGIN/COMMIT 없음, SET LOCAL 실효를
--   첫 DO가 확인. 어느 검사든 RAISE하면 이력까지 함께 롤백된다. 실행 주체 postgres, 앱 사용자(JWT)를 만들지 않는다.
-- 왜: fsrs RPC가 부를 때마다 fsrs_private.contract_hash · manual_contract_hash · admission_contract_hash · activity_profile_hash가
--   카탈로그 전체를 다시 읽어 md5를 만든다(운영 읽기 전용 실측 2026-10-23 KST: 합 ≈ 80~300ms, 찬 연결 contract_hash만 412ms).
--   작은 DB(shared_buffers 224MB)에서 몰아 쓰면 fsrs_legacy_boundary · fsrs_vocabulary_snapshot이 8초 제한에 걸렸다(#1535 · #1536).
-- 바뀌는 것:
--   ⑴ 네 지문 함수의 운영 본문을 그대로 fsrs_private.<이름>_live()로 옮긴다(카탈로그 prosrc를 복사 — 손으로 다시 쓰지 않는다).
--   ⑵ 원래 이름(같은 oid · 소유자 · ACL · 속성)은 캐시를 돌려주는 얇은 함수가 된다: 캐시가 유효하고 플랫폼 지문이 같을 때만 캐시,
--      아니면 _live()를 그 자리에서 계산(지금과 같은 값 · 같은 비용). 부르는 쪽(require_admission_integrity 등 14곳)은 그대로다.
--   ⑶ 무효화: 이벤트 트리거(ddl_command_end · sql_drop)가 임시 객체가 아닌 DDL마다 캐시를 무효로 표시하고, 지연 제약 트리거가
--      그 트랜잭션 커밋 직전에 한 번 다시 계산한다(재계산 실패는 경고만 — 캐시는 무효로 남아 _live()가 쓰인다, DDL은 막지 않는다).
--   ⑷ DDL이 아닌 변경(역할 속성 · 소속 · 역할 설정 · DB 로캘 · 이벤트 트리거 자체 · 확장 버전 · 서버 버전)은 이벤트 트리거가 못 본다 →
--      contract_platform_fingerprint()(전역 카탈로그 몇 행, 운영 실측 ≈ 1~3ms)를 부를 때마다 캐시에 적힌 값과 비교한다.
--   게시값(설정 행)은 지문 밖이라 캐시와 무관하다 — require_admission_integrity의 「게시 = 지문」 비교는 지금처럼 부를 때마다 한다.
-- 재게시: manual → core → admission(선례 m09 repair 022 순서). activity profile 지문은 범위 밖이라 그대로(사후 검사).
-- 남는 틈(문서화): Supabase supautils는 superuser(supabase_admin) 세션에서 사용자 이벤트 트리거를 건너뛴다 → 플랫폼이 superuser로
--   fsrs · public 객체를 고치면 캐시가 모른다(서버 · 확장 버전 · 역할 · 이벤트 트리거 변화는 ⑷가 본다). 실패한 CREATE INDEX
--   CONCURRENTLY가 남긴 invalid 인덱스도 ddl_command_end 없이 남는다. 둘 다 SELECT fsrs_private.contract_cache_invalidate_now()로 비운다.
-- 사전 검사가 받는 상태: ① 지문 함수 넷이 운영 원문(md5 아래) · 캐시 없음 ② 이 파일을 이미 적용(_live 넷 = 운영 원문 · 얇은 함수 = 아래 md5).
-- 사후 검사: 네 계약 동치(얇은 함수 · _live 둘 다) · profile 불변 · 함수 속성(oid · 소유자 · ACL) 불변 · 전 사용자 snapshot 출력 동일 ·
--   캐시 갱신을 지금 실행해(SET CONSTRAINTS … IMMEDIATE) 캐시 = _live = 게시값 · 캐시만으로 require_admission_integrity 통과.
-- 복원: docs/sql/contract-hash-cache-rollback.sql — 원문을 원래 이름으로 되돌리고 새 객체를 지운 뒤 세 게시값 재게시(원래 값으로 정확히 돌아온다).
SET LOCAL search_path = '';
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '180s';

-- 실행기 확인: SET LOCAL이 이 트랜잭션에 실제로 걸렸어야 한다(db push 파이프라인 = 암묵 트랜잭션 하나).
DO $runner$
BEGIN
 IF pg_catalog.current_setting('search_path') NOT IN ('', '""') OR pg_catalog.current_setting('lock_timeout') <> '5s'
    OR pg_catalog.current_setting('statement_timeout') <> '3min'
 THEN RAISE EXCEPTION 'contract_cache: SET LOCAL not in effect (search_path=%, lock_timeout=%, statement_timeout=%)',
   pg_catalog.current_setting('search_path'), pg_catalog.current_setting('lock_timeout'), pg_catalog.current_setting('statement_timeout');
 END IF;
END $runner$;

-- ── 공통 도구(pg_temp, 이 세션 전용 · 끝에서 DROP).
-- 학습 계약 넷 — 게시값 = 지금 지문(이름 그대로 부른다: 적용 뒤에는 얇은 함수, 이 트랜잭션 안에서는 캐시가 무효라 _live와 같다).
CREATE FUNCTION pg_temp.cc_contracts() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object(
  'ok', s.contract_hash IS NOT DISTINCT FROM fsrs_private.contract_hash()
    AND m.contract_hash IS NOT DISTINCT FROM fsrs_private.manual_contract_hash()
    AND a.contract_hash IS NOT DISTINCT FROM fsrs_private.admission_contract_hash()
    AND t.profile_contract_hash IS NOT DISTINCT FROM fsrs_private.activity_profile_hash(),
  'core', s.contract_hash, 'manual', m.contract_hash, 'admission', a.contract_hash, 'profile', t.profile_contract_hash)
 FROM fsrs_private.settings s, fsrs_private.manual_save_settings m, fsrs_private.admission_settings a, fsrs_private.activity_settings t
$q$;

-- 함수 속성(본문 md5 + 본문 외 전부). 'attrs'는 oid를 뺀 값(_live와 원래 함수 비교용), 'oid'는 따로.
CREATE FUNCTION pg_temp.cc_fn(p_sig text) RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object('md5', pg_catalog.md5(p.prosrc), 'oid', p.oid,
  'attrs', pg_catalog.jsonb_build_array(p.proowner, p.proacl, p.prosecdef, p.proconfig, p.provolatile, p.proparallel,
           p.proleakproof, p.proisstrict, p.prolang, p.prorettype, p.proretset, p.procost, p.prorows, p.prokind,
           pg_catalog.pg_get_function_arguments(p.oid)))
 FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure(p_sig)
$q$;

-- 게시 지문 한 칸을 '지금 계산한 값'으로(바뀔 때만, 정확히 1행).
CREATE FUNCTION pg_temp.cc_repin(p_which text) RETURNS void LANGUAGE plpgsql SET search_path = '' AS $q$
DECLARE n integer;
BEGIN
 IF p_which = 'core' THEN
  UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash() WHERE contract_hash IS DISTINCT FROM fsrs_private.contract_hash();
 ELSIF p_which = 'manual' THEN
  UPDATE fsrs_private.manual_save_settings SET contract_hash = fsrs_private.manual_contract_hash() WHERE contract_hash IS DISTINCT FROM fsrs_private.manual_contract_hash();
 ELSIF p_which = 'admission' THEN
  UPDATE fsrs_private.admission_settings SET contract_hash = fsrs_private.admission_contract_hash() WHERE contract_hash IS DISTINCT FROM fsrs_private.admission_contract_hash();
 ELSE RAISE EXCEPTION 'contract_cache: unknown pin %', p_which; END IF;
 GET DIAGNOSTICS n = ROW_COUNT;
 IF n > 1 THEN RAISE EXCEPTION 'contract_cache: % pin touched % rows', p_which, n; END IF;
END
$q$;

-- 운영 원문 md5(2026-10-23 KST 읽기 전용 확인 — 관측 fixture + 관측 뒤 마이그레이션의 PGlite 결과와 같다).
CREATE FUNCTION pg_temp.cc_original(p_name text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $q$
 SELECT CASE p_name WHEN 'contract_hash' THEN 'b43887acc3619ca718b0912b15f833af' WHEN 'manual_contract_hash' THEN '9c59598d3a669aa34da38344f514fae6'
  WHEN 'admission_contract_hash' THEN 'ef7227c3f7d3ff47760d9ce06c844231' WHEN 'activity_profile_hash' THEN '2c3b288d2739925159418048da75a65d' END
$q$;

DO $pre$
DECLARE c jsonb := pg_temp.cc_contracts(); n text; applied boolean := pg_catalog.to_regclass('fsrs_private.contract_cache') IS NOT NULL;
BEGIN
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'contract_cache: learning contracts already drifted %', c; END IF;
 PERFORM fsrs_private.require_admission_integrity();
 IF pg_temp.cc_fn('fsrs_private.require_admission_integrity()')->>'md5' IS DISTINCT FROM '84a89f959af0863e337a9b55bae8ca3c'
 THEN RAISE EXCEPTION 'contract_cache: require_admission_integrity is not the reviewed body'; END IF;
 FOREACH n IN ARRAY ARRAY['contract_hash','manual_contract_hash','admission_contract_hash','activity_profile_hash'] LOOP
  IF NOT applied THEN
   -- ① 고칠 상태: 지문 함수가 운영 원문 그대로, 새 객체는 아직 없다
   IF pg_temp.cc_fn('fsrs_private.' || n || '()')->>'md5' IS DISTINCT FROM pg_temp.cc_original(n)
   THEN RAISE EXCEPTION 'contract_cache: fsrs_private.%() is not the reviewed production body', n; END IF;
   IF pg_catalog.to_regprocedure('fsrs_private.' || n || '_live()') IS NOT NULL THEN RAISE EXCEPTION 'contract_cache: unexpected fsrs_private.%_live()', n; END IF;
  ELSE
   -- ② 이미 적용: _live = 운영 원문, 원래 이름 = 아래 얇은 함수(md5는 사후 검사와 같은 값)
   IF pg_temp.cc_fn('fsrs_private.' || n || '_live()')->>'md5' IS DISTINCT FROM pg_temp.cc_original(n)
   THEN RAISE EXCEPTION 'contract_cache: fsrs_private.%_live() is not the reviewed production body', n; END IF;
  END IF;
 END LOOP;
 IF NOT applied AND EXISTS (SELECT 1 FROM pg_catalog.pg_event_trigger e WHERE e.evtname IN ('fsrs_contract_cache_ddl','fsrs_contract_cache_drop'))
 THEN RAISE EXCEPTION 'contract_cache: event triggers exist without the cache table'; END IF;
 RAISE NOTICE 'contract_cache: %', CASE WHEN applied THEN 'already applied — re-run' ELSE 'needs cache' END;
END $pre$;

-- ── 바꾸기 전 출력과 상태(같은 트랜잭션 안). 학습자 행은 임시 테이블에만 있고(ON COMMIT DROP) 밖으로 내보내지 않는다.
CREATE TEMP TABLE cc_snapshot_before ON COMMIT DROP AS
 SELECT u.user_id AS actor, public.fsrs_vocabulary_snapshot(u.user_id) - 'now' AS body
 FROM (SELECT DISTINCT v.user_id FROM public.user_vocabulary v WHERE EXISTS (SELECT 1 FROM auth.users a WHERE a.id = v.user_id)) u;
CREATE TEMP TABLE cc_state_before ON COMMIT DROP AS
 SELECT pg_temp.cc_contracts() AS contracts, (SELECT pg_catalog.count(*) FROM cc_snapshot_before) AS actors,
  pg_catalog.jsonb_build_object(
   'contract_hash', pg_temp.cc_fn('fsrs_private.contract_hash()'), 'manual_contract_hash', pg_temp.cc_fn('fsrs_private.manual_contract_hash()'),
   'admission_contract_hash', pg_temp.cc_fn('fsrs_private.admission_contract_hash()'), 'activity_profile_hash', pg_temp.cc_fn('fsrs_private.activity_profile_hash()')) AS fns;

-- ── ⑴ 운영 원문을 _live로(① 상태에서만 — ②에서 원래 이름은 이미 얇은 함수다). 본문은 카탈로그에서 그대로 복사한다.
DO $live$
DECLARE n text; src text;
BEGIN
 IF pg_catalog.to_regclass('fsrs_private.contract_cache') IS NULL THEN
  FOREACH n IN ARRAY ARRAY['contract_hash','manual_contract_hash','admission_contract_hash','activity_profile_hash'] LOOP
   SELECT p.prosrc INTO STRICT src FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure('fsrs_private.' || n || '()');
   EXECUTE pg_catalog.format('CREATE FUNCTION fsrs_private.%I() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '''' AS %L', n || '_live', src);
   EXECUTE pg_catalog.format('REVOKE ALL ON FUNCTION fsrs_private.%I() FROM PUBLIC, anon, authenticated, service_role', n || '_live');
  END LOOP;
 END IF;
END $live$;

-- ── 캐시(한 행). 지문 넷과 그때의 플랫폼 지문. fsrs_private의 다른 표처럼 소유자 외 권한 없음 · RLS 켬(사후 검사).
--    ① 상태에서만 만든다: ②(재실행)에서는 앞선 DDL이 이미 캐시 행을 무효로 표시해 재계산이 예약돼 있어 ALTER TABLE이
--    「pending trigger events」로 거부된다. 나중에 이 표의 구조를 바꾸는 마이그레이션도 같은 이유로 그 DDL을 맨 앞에 두거나
--    SET CONSTRAINTS fsrs_private.contract_cache_refresh IMMEDIATE 뒤에 둔다.
DO $table$
BEGIN
 IF pg_catalog.to_regclass('fsrs_private.contract_cache') IS NULL THEN
  CREATE TABLE fsrs_private.contract_cache (
   id boolean PRIMARY KEY DEFAULT true CHECK (id),
   valid boolean NOT NULL DEFAULT false,
   fingerprint text,
   core text,
   manual text,
   admission text,
   profile text,
   refreshed_at timestamptz
  );
  ALTER TABLE fsrs_private.contract_cache ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON TABLE fsrs_private.contract_cache FROM PUBLIC, anon, authenticated, service_role;
 END IF;
END $table$;

-- ── ⑷ 이벤트 트리거가 못 보는 전역 상태(역할 · 소속 · 역할 설정 · 이 DB 행 · 이벤트 트리거 · 확장 · 서버 버전).
--    datfrozenxid · datminmxid는 VACUUM이 바꾸므로 뺀다.
CREATE OR REPLACE FUNCTION fsrs_private.contract_platform_fingerprint()
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
 AS $fn$
 SELECT pg_catalog.md5(pg_catalog.jsonb_build_array(
  pg_catalog.current_setting('server_version_num'),
  (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) - 'rolpassword'::text ORDER BY r.oid) FROM pg_catalog.pg_roles r),
  (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(m) ORDER BY m.roleid, m.member, m.grantor) FROM pg_catalog.pg_auth_members m),
  (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(s) ORDER BY s.setdatabase, s.setrole) FROM pg_catalog.pg_db_role_setting s),
  (SELECT pg_catalog.to_jsonb(d) - ARRAY['datfrozenxid','datminmxid']::text[] FROM pg_catalog.pg_database d WHERE d.datname = pg_catalog.current_database()),
  (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(e) ORDER BY e.oid) FROM pg_catalog.pg_event_trigger e),
  (SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) ORDER BY x.oid) FROM pg_catalog.pg_extension x)
 )::text)
$fn$;
REVOKE ALL ON FUNCTION fsrs_private.contract_platform_fingerprint() FROM PUBLIC, anon, authenticated, service_role;

-- ── ⑵ 원래 이름 = 캐시 또는 그 자리 계산(CREATE OR REPLACE — oid · 소유자 · ACL · 속성 유지, 사후 검사).
CREATE OR REPLACE FUNCTION fsrs_private.contract_hash()
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
 AS $fn$
 SELECT coalesce((SELECT c.core FROM fsrs_private.contract_cache c WHERE c.valid AND c.fingerprint = fsrs_private.contract_platform_fingerprint()),
  fsrs_private.contract_hash_live())
$fn$;
CREATE OR REPLACE FUNCTION fsrs_private.manual_contract_hash()
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
 AS $fn$
 SELECT coalesce((SELECT c.manual FROM fsrs_private.contract_cache c WHERE c.valid AND c.fingerprint = fsrs_private.contract_platform_fingerprint()),
  fsrs_private.manual_contract_hash_live())
$fn$;
CREATE OR REPLACE FUNCTION fsrs_private.admission_contract_hash()
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
 AS $fn$
 SELECT coalesce((SELECT c.admission FROM fsrs_private.contract_cache c WHERE c.valid AND c.fingerprint = fsrs_private.contract_platform_fingerprint()),
  fsrs_private.admission_contract_hash_live())
$fn$;
CREATE OR REPLACE FUNCTION fsrs_private.activity_profile_hash()
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
 AS $fn$
 SELECT coalesce((SELECT c.profile FROM fsrs_private.contract_cache c WHERE c.valid AND c.fingerprint = fsrs_private.contract_platform_fingerprint()),
  fsrs_private.activity_profile_hash_live())
$fn$;

-- ── ⑶ 커밋 직전 재계산(지연 제약 트리거). 실패해도 그 트랜잭션(DDL)은 막지 않는다 — 캐시는 무효로 남고 _live가 쓰인다.
CREATE OR REPLACE FUNCTION fsrs_private.contract_cache_refresh()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
 AS $fn$
BEGIN
 BEGIN
  UPDATE fsrs_private.contract_cache SET core = fsrs_private.contract_hash_live(), manual = fsrs_private.manual_contract_hash_live(),
   admission = fsrs_private.admission_contract_hash_live(), profile = fsrs_private.activity_profile_hash_live(),
   fingerprint = fsrs_private.contract_platform_fingerprint(), refreshed_at = pg_catalog.clock_timestamp(), valid = true
  WHERE id AND NOT valid;
 EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fsrs contract cache refresh failed (%): live contract hashes stay in use', SQLSTATE;
 END;
 RETURN NULL;
END
$fn$;
REVOKE ALL ON FUNCTION fsrs_private.contract_cache_refresh() FROM PUBLIC, anon, authenticated, service_role;

-- ⑶ 무효화(이벤트 트리거). 임시 객체만 건드린 DDL은 건너뛴다(캐시 행에 쓰지 않는다).
--    DROP은 sql_drop에서 본다(ddl_command_end에는 DROP 대상 목록이 없다). 그 밖에 대상 목록이 비면 보수적으로 무효화한다.
--    SECURITY DEFINER: Auth 마이그레이션(supabase_auth_admin)처럼 다른 역할의 DDL에서도 캐시를 무효로 표시할 수 있어야 한다.
--    이미 무효여도 다시 표시한다(WHERE valid 없이) — 앞선 재계산이 실패해 무효로 남은 캐시도 다음 DDL의 커밋에서 다시 계산된다.
--    한 트랜잭션에 DDL이 여럿이면 재계산 예약도 여럿이지만, 첫 번째만 계산하고 나머지는 `WHERE … NOT valid` 0행으로 끝난다.
CREATE OR REPLACE FUNCTION fsrs_private.contract_cache_invalidate()
 RETURNS event_trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
 AS $fn$
BEGIN
 IF TG_EVENT = 'sql_drop' THEN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_event_trigger_dropped_objects() o WHERE NOT o.is_temporary) THEN RETURN; END IF;
 ELSIF TG_TAG LIKE 'DROP %' THEN
  RETURN;
 ELSIF EXISTS (SELECT 1 FROM pg_catalog.pg_event_trigger_ddl_commands())
   AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_event_trigger_ddl_commands() c WHERE c.schema_name IS DISTINCT FROM 'pg_temp') THEN
  RETURN;
 END IF;
 UPDATE fsrs_private.contract_cache SET valid = false;
END
$fn$;
REVOKE ALL ON FUNCTION fsrs_private.contract_cache_invalidate() FROM PUBLIC, anon, authenticated, service_role;

-- 손으로 비우기(superuser DDL · 실패한 CREATE INDEX CONCURRENTLY 뒤). 커밋 직전에 다시 계산된다.
CREATE OR REPLACE FUNCTION fsrs_private.contract_cache_invalidate_now()
 RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = ''
 AS $fn$
 UPDATE fsrs_private.contract_cache SET valid = false
$fn$;
REVOKE ALL ON FUNCTION fsrs_private.contract_cache_invalidate_now() FROM PUBLIC, anon, authenticated, service_role;

DO $hooks$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t WHERE t.tgrelid = 'fsrs_private.contract_cache'::pg_catalog.regclass AND t.tgname = 'contract_cache_refresh') THEN
  EXECUTE 'CREATE CONSTRAINT TRIGGER contract_cache_refresh AFTER INSERT OR UPDATE ON fsrs_private.contract_cache DEFERRABLE INITIALLY DEFERRED '
   'FOR EACH ROW WHEN (NOT NEW.valid) EXECUTE FUNCTION fsrs_private.contract_cache_refresh()';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_event_trigger e WHERE e.evtname = 'fsrs_contract_cache_ddl') THEN
  EXECUTE 'CREATE EVENT TRIGGER fsrs_contract_cache_ddl ON ddl_command_end EXECUTE FUNCTION fsrs_private.contract_cache_invalidate()';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_event_trigger e WHERE e.evtname = 'fsrs_contract_cache_drop') THEN
  EXECUTE 'CREATE EVENT TRIGGER fsrs_contract_cache_drop ON sql_drop EXECUTE FUNCTION fsrs_private.contract_cache_invalidate()';
 END IF;
END $hooks$;

-- 캐시 행(무효로 시작 → 커밋 직전 계산). 다시 실행하면 무효로 되돌려 같은 경로로 다시 계산한다.
INSERT INTO fsrs_private.contract_cache (id, valid) VALUES (true, false) ON CONFLICT (id) DO UPDATE SET valid = false;

-- ── 재게시(선례 m09 repair 022 순서: manual → core → admission; 활성화 뒤라 activity_preflight는 넣지 않는다)
DO $change$
BEGIN
 PERFORM pg_temp.cc_repin('manual');
 PERFORM pg_temp.cc_repin('core');
 PERFORM pg_temp.cc_repin('admission');
END $change$;

DO $post$
DECLARE b record; c jsonb; n text; diffs integer;
BEGIN
 SELECT * INTO b FROM cc_state_before;
 c := pg_temp.cc_contracts();
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'contract_cache: contracts not consistent after change %', c; END IF;
 IF (SELECT s.contract_hash FROM fsrs_private.settings s) IS DISTINCT FROM fsrs_private.contract_hash_live()
    OR (SELECT m.contract_hash FROM fsrs_private.manual_save_settings m) IS DISTINCT FROM fsrs_private.manual_contract_hash_live()
    OR (SELECT a.contract_hash FROM fsrs_private.admission_settings a) IS DISTINCT FROM fsrs_private.admission_contract_hash_live()
    OR (SELECT t.profile_contract_hash FROM fsrs_private.activity_settings t) IS DISTINCT FROM fsrs_private.activity_profile_hash_live()
 THEN RAISE EXCEPTION 'contract_cache: pins differ from the live fingerprints'; END IF;
 IF (SELECT t.profile_contract_hash FROM fsrs_private.activity_settings t) IS DISTINCT FROM fsrs_private.activity_profile_hash()
    OR c->>'profile' IS DISTINCT FROM b.contracts->>'profile'
 THEN RAISE EXCEPTION 'contract_cache: activity profile pin moved'; END IF;
 FOREACH n IN ARRAY ARRAY['contract_hash','manual_contract_hash','admission_contract_hash','activity_profile_hash'] LOOP
  IF pg_temp.cc_fn('fsrs_private.' || n || '_live()')->>'md5' IS DISTINCT FROM pg_temp.cc_original(n)
  THEN RAISE EXCEPTION 'contract_cache: fsrs_private.%_live() is not the production body', n; END IF;
  -- 원래 이름: 같은 oid · 소유자 · ACL · 속성(본문만 바뀜). _live: 원래 함수와 같은 소유자 · ACL · 속성.
  IF pg_temp.cc_fn('fsrs_private.' || n || '()') - 'md5' IS DISTINCT FROM (b.fns->n) - 'md5'
  THEN RAISE EXCEPTION 'contract_cache: fsrs_private.%() attributes/owner/ACL changed', n; END IF;
  IF pg_temp.cc_fn('fsrs_private.' || n || '_live()')->'attrs' IS DISTINCT FROM b.fns->n->'attrs'
  THEN RAISE EXCEPTION 'contract_cache: fsrs_private.%_live() attributes/owner/ACL differ from the original', n; END IF;
 END LOOP;
 IF (SELECT pg_catalog.count(*) FROM pg_catalog.pg_event_trigger e WHERE e.evtname IN ('fsrs_contract_cache_ddl','fsrs_contract_cache_drop') AND e.evtenabled = 'O'
      AND e.evtfoid = 'fsrs_private.contract_cache_invalidate()'::pg_catalog.regprocedure) <> 2
 THEN RAISE EXCEPTION 'contract_cache: invalidation event triggers missing or disabled'; END IF;
 IF EXISTS (SELECT 1 FROM pg_catalog.pg_class r, LATERAL pg_catalog.aclexplode(r.relacl) x WHERE r.oid = 'fsrs_private.contract_cache'::pg_catalog.regclass AND x.grantee <> r.relowner)
    OR NOT (SELECT r.relrowsecurity FROM pg_catalog.pg_class r WHERE r.oid = 'fsrs_private.contract_cache'::pg_catalog.regclass)
 THEN RAISE EXCEPTION 'contract_cache: cache table must be owner-only with RLS'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
 SELECT pg_catalog.count(*)::integer INTO diffs FROM pg_temp.cc_snapshot_before s WHERE (public.fsrs_vocabulary_snapshot(s.actor) - 'now') IS DISTINCT FROM s.body;
 IF diffs <> 0 THEN RAISE EXCEPTION 'contract_cache: snapshot output changed for % of % actor(s)', diffs, b.actors; END IF;
 RAISE NOTICE 'contract_cache: ok — pins % -> %; % actors identical', b.contracts, c, b.actors;
END $post$;

-- ── 캐시 갱신을 지금 실행해 본다(커밋 때 할 일과 같은 함수). 이 뒤의 DDL은 임시 객체 DROP뿐이라 캐시를 무효로 만들지 않는다.
SET CONSTRAINTS fsrs_private.contract_cache_refresh IMMEDIATE;
SET CONSTRAINTS fsrs_private.contract_cache_refresh DEFERRED;

DO $cache$
DECLARE k record;
BEGIN
 SELECT * INTO STRICT k FROM fsrs_private.contract_cache;
 IF NOT k.valid THEN RAISE EXCEPTION 'contract_cache: refresh did not validate the cache'; END IF;
 IF k.core IS DISTINCT FROM fsrs_private.contract_hash_live() OR k.manual IS DISTINCT FROM fsrs_private.manual_contract_hash_live()
    OR k.admission IS DISTINCT FROM fsrs_private.admission_contract_hash_live() OR k.profile IS DISTINCT FROM fsrs_private.activity_profile_hash_live()
    OR k.fingerprint IS DISTINCT FROM fsrs_private.contract_platform_fingerprint()
 THEN RAISE EXCEPTION 'contract_cache: cached values differ from the live fingerprints'; END IF;
 IF (SELECT s.contract_hash FROM fsrs_private.settings s) IS DISTINCT FROM fsrs_private.contract_hash()
    OR (SELECT m.contract_hash FROM fsrs_private.manual_save_settings m) IS DISTINCT FROM fsrs_private.manual_contract_hash()
    OR (SELECT a.contract_hash FROM fsrs_private.admission_settings a) IS DISTINCT FROM fsrs_private.admission_contract_hash()
    OR (SELECT t.profile_contract_hash FROM fsrs_private.activity_settings t) IS DISTINCT FROM fsrs_private.activity_profile_hash()
 THEN RAISE EXCEPTION 'contract_cache: cached fingerprints differ from the pins'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
 RAISE NOTICE 'contract_cache: cache valid (refreshed %)', k.refreshed_at;
END $cache$;

DROP FUNCTION pg_temp.cc_repin(text); DROP FUNCTION pg_temp.cc_fn(text); DROP FUNCTION pg_temp.cc_contracts(); DROP FUNCTION pg_temp.cc_original(text);
DROP TABLE pg_temp.cc_state_before, pg_temp.cc_snapshot_before;
