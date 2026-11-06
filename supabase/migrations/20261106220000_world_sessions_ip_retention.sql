-- WORLD-IP-RETENTION-001(2026-11-06 KST, 오너 11/4 「백엔드 · 데이터 관련 개선은 알아서」 · CLAUDE.md) — 월드 접속 IP 보관 상한.
--   world_sessions.ip(20260712000300)는 입장(claim_world_session_v2)마다 접속 IP를 적는다. 정상 퇴장(release_world_session)은 행을
--   지우지만, 탭 강제 종료 · 네트워크 끊김 같은 비정상 퇴장은 행이 남고 ip도 기한 없이 남았다(계정당 1행, 다음 입장 때만 덮어씀).
--   ip를 읽는 곳은 「같은 IP · 다른 계정의 살아 있는(60초 안) 세션」 검사 하나뿐이고 그 검사도 20260712000400부터 꺼져 있다 —
--   임대가 끝난(하트비트 60초 초과) 행의 ip는 어디에도 쓰이지 않는다.
-- 바꾸는 것:
--   ⑴ public.world_sessions_purge_stale_ip() — 마지막 하트비트가 24시간보다 오래된 행의 ip만 NULL로(행 · 토큰 · 시각은 그대로).
--      SECURITY DEFINER · search_path '' · 실행권 없음(public · anon · authenticated · service_role 전부 회수 — 아래 함수 안에서만 부른다).
--   ⑵ public.claim_world_session_v2(text) — 본문 맨 앞(로그인 확인 뒤)에 ⑴을 한 번 부른다. 나머지 본문은 20260712000400과 글자 그대로
--      (임대 판정 · 반환 · IP 차단 해제 상태 — 'duplicate-ip' 거부 분기 없음, db-postconditions 신버전 검사 유지). pg_cron이 없어 청소 잡 대신
--      입장 경로에서 그때그때 지운다(누가 월드에 들어올 때마다 — 표는 계정당 1행이라 UPDATE는 작다).
--   ⑶ 적용 순간 한 번 ⑴을 돌려 이미 쌓인 오래된 ip를 지운다(월드 보류 중이라 입장이 드물다).
--   보관 상한 N = 24시간(마지막 하트비트 기준). 기능상 필요한 기간은 임대 60초뿐이지만, 다시 켤 수 있는 IP 검사(60초 창)와 무관하게
--   여유를 두고 처리방침 문구에 쓰기 쉬운 값으로 정했다. 바꾸려면 ⑴의 interval 한 곳.
-- 바꾸지 않는 것: 표 · 컬럼 · 정책 0개 · 직접 권한 회수 · 다른 임대 RPC 셋(claim v1 · heartbeat · release) · claim v2의 서명 · 반환 · 속성 · 실행권
--   (CREATE OR REPLACE는 proacl · 소유자를 지킨다 — 사후 검사가 확인).
-- 학습 계약 지문(§4.9-1): world_* 표 · 함수는 capability(public 학습 표 9개)와 FSRS 넷(fsrs_* · 학습 표)의 범위 밖이다 — 관측 fixture
--   m09-learning-contracts-20261010.sql에 world가 한 번도 나오지 않는다. 사후 검사가 지문 넷 + capability 정의가 적용 전과 같음을 확인한다.
-- 실행 형태: db push가 파일 전체 + 이력 INSERT를 한 파이프라인(암묵 트랜잭션 하나)으로 보낸다 → BEGIN/COMMIT 없음, SET LOCAL 실효를 첫 DO가 확인.
--   어느 검사든 RAISE하면 이력까지 함께 롤백된다. 실행 주체 postgres, 앱 사용자(JWT)를 만들지 않는다.
-- 적용 전 확인: world_sessions · ip 컬럼 · claim v2가 있다(없는 바탕 = 학습 fixture 사슬은 42P01로 알린다), claim v2 본문 = 20260712000400 본문
--   또는 이 파일 본문(재적용 — 멱등). 사후 확인: 위 ⑴ · ⑵ 모양 · 속성 · 실행권, 오래된 ip 0, 살아 있는(24시간 안) 행의 ip · 모든 행 · 토큰 불변.
-- 복원: docs/sql/world-sessions-ip-retention-rollback.sql(claim v2를 20260712000400 본문으로 · ⑴ DROP). 지운 오래된 ip는 되돌리지 않는다 —
--   지우는 것이 이 변경의 목적이고 그 값은 어떤 기능도 읽지 않는다(행 · 임대 상태는 남는다).
SET LOCAL search_path = '';
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $runner$
BEGIN
 IF pg_catalog.current_setting('search_path') NOT IN ('', '""') OR pg_catalog.current_setting('lock_timeout') <> '5s'
    OR pg_catalog.current_setting('statement_timeout') <> '1min'
 THEN RAISE EXCEPTION 'world_ip_retention: SET LOCAL not in effect (search_path=%, lock_timeout=%, statement_timeout=%)',
   pg_catalog.current_setting('search_path'), pg_catalog.current_setting('lock_timeout'), pg_catalog.current_setting('statement_timeout');
 END IF;
 -- 월드 표가 없는 바탕(학습 계약 fixture 사슬)은 「없는 표」로 알린다 — 운영에는 있다.
 IF pg_catalog.to_regclass('public.world_sessions') IS NULL THEN
   RAISE EXCEPTION 'relation public.world_sessions does not exist' USING ERRCODE = '42P01';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = 'public.world_sessions'::pg_catalog.regclass AND attname = 'ip' AND NOT attisdropped)
    OR pg_catalog.to_regprocedure('public.claim_world_session_v2(text)') IS NULL THEN
   RAISE EXCEPTION 'world_ip_retention: world_sessions.ip or claim_world_session_v2(text) missing';
 END IF;
END $runner$;

-- 적용 전 상태(임시 · ON COMMIT DROP): claim v2 속성, 지문 넷 + capability 정의, 행 전부(ip는 해시로만 — 값 자체를 남기지 않는다).
CREATE TEMP TABLE wir_fn ON COMMIT DROP AS
  SELECT p.oid, p.proowner, p.prosecdef, p.proconfig::text AS config, p.provolatile, p.proacl::text AS acl, p.prorettype, p.prosrc
  FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure('public.claim_world_session_v2(text)');
CREATE TEMP TABLE wir_rows ON COMMIT DROP AS
  SELECT s.user_id, s.session_token, s.heartbeat_at, s.created_at, pg_catalog.md5(s.ip) AS ip_md5,
         s.heartbeat_at < pg_catalog.now() - interval '24 hours' AS stale
  FROM public.world_sessions s;
CREATE TEMP TABLE wir_pins (k text PRIMARY KEY, v text) ON COMMIT DROP;
CREATE FUNCTION pg_temp.wir_measure() RETURNS TABLE (k text, v text) LANGUAGE plpgsql SET search_path = '' AS $m$
DECLARE f record; val text;
BEGIN
  FOR f IN SELECT * FROM (VALUES ('core', 'contract_hash_live'), ('manual', 'manual_contract_hash_live'),
      ('admission', 'admission_contract_hash_live'), ('activity', 'activity_profile_hash_live')) x(k, fn) LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = 'fsrs_private' AND p.proname = f.fn AND p.pronargs = 0) THEN
      EXECUTE pg_catalog.format('SELECT fsrs_private.%I()::text', f.fn) INTO val;
    ELSE val := NULL; END IF;
    k := f.k; v := val; RETURN NEXT;
  END LOOP;
  -- capability 함수는 로그인 사용자만 부른다(db push엔 로그인 맥락이 없다 — 20261106140000 선례) → 부르지 않고 정의를 잰다.
  k := 'capability';
  SELECT pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid)) || '|' || coalesce(p.proacl::text, '') || '|' || p.proowner::text
    INTO v FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'learning_language_capabilities' AND p.pronargs = 0;
  RETURN NEXT;
END $m$;
INSERT INTO pg_temp.wir_pins SELECT * FROM pg_temp.wir_measure();

DO $pre$
DECLARE src text := (SELECT prosrc FROM pg_temp.wir_fn);
BEGIN
  -- 받는 본문 둘: 20260712000400(IP 차단 해제판, 청소 호출 없음) 또는 이 파일(재적용). 그 밖(옛 duplicate-ip 판 · 손댄 본문)은 멈춘다.
  IF pg_catalog.strpos(src, 'jsonb_build_object(''token'', NULL, ''reason'', ''duplicate-account'')') = 0
     OR pg_catalog.strpos(src, '''duplicate-ip''') > 0
     OR pg_catalog.strpos(src, 'ON CONFLICT (user_id) DO UPDATE') = 0 THEN
    RAISE EXCEPTION 'world_ip_retention: claim_world_session_v2 body is not the 20260712000400 version — stop';
  END IF;
END $pre$;

-- ⑴ 오래된 ip 지우기 — N = 24시간(마지막 하트비트 기준). 지운 행 수를 돌려준다.
CREATE OR REPLACE FUNCTION public.world_sessions_purge_stale_ip()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_n integer;
BEGIN
  UPDATE public.world_sessions
     SET ip = NULL
   WHERE ip IS NOT NULL
     AND heartbeat_at < pg_catalog.now() - interval '24 hours';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$function$;

-- 아무 역할도 직접 부르지 않는다(Data API 노출 0) — 소유자(postgres) 권한으로 도는 claim v2 안에서만 부른다.
REVOKE ALL ON FUNCTION public.world_sessions_purge_stale_ip() FROM public, anon, authenticated, service_role;

-- ⑵ 입장 때 그때그때 청소 — 20260712000400 본문 + 로그인 확인 뒤 PERFORM 한 줄.
CREATE OR REPLACE FUNCTION public.claim_world_session_v2(p_ip text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_token uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required' USING errcode = '28000';
  END IF;

  -- IP 보관 상한(WORLD-IP-RETENTION-001): 하트비트가 24시간 넘게 끊긴 행의 ip를 지운다(행 · 임대 상태는 그대로).
  PERFORM public.world_sessions_purge_stale_ip();

  -- IP 동시접속 차단 해제(오너 확정): 같은 IP 다중 접속을 허용한다. ip 는 아래 upsert 로 계속 기록한다.
  -- (미래 IP 차단 재활성 시 여기에 20260712c 의 duplicate-ip EXISTS 블록을 되살리면 된다.)

  INSERT INTO public.world_sessions (user_id, session_token, ip, heartbeat_at, created_at)
  VALUES (v_uid, gen_random_uuid(), p_ip, now(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET session_token = excluded.session_token,
        ip            = excluded.ip,
        heartbeat_at  = excluded.heartbeat_at
    WHERE public.world_sessions.heartbeat_at < now() - interval '60 seconds'
  RETURNING session_token INTO v_token;

  IF v_token IS NULL THEN
    RETURN jsonb_build_object('token', NULL, 'reason', 'duplicate-account');
  END IF;
  RETURN jsonb_build_object('token', v_token, 'reason', NULL);
END;
$$;

-- 실행권은 운영 그대로(20260712000300 · 0400): public · anon 회수, authenticated만. 이미 그 상태면 바뀌지 않는다.
REVOKE ALL ON FUNCTION public.claim_world_session_v2(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_world_session_v2(text) TO authenticated;

-- ⑶ 이미 쌓인 오래된 ip — 적용 순간 한 번.
SELECT public.world_sessions_purge_stale_ip();

DO $post$
DECLARE b record; a record; d record;
BEGIN
  SELECT * INTO STRICT b FROM pg_temp.wir_fn;
  SELECT p.oid, p.proowner, p.prosecdef, p.proconfig::text AS config, p.provolatile, p.proacl::text AS acl, p.prorettype, p.prosrc
    INTO STRICT a FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure('public.claim_world_session_v2(text)');
  IF a.oid <> b.oid OR a.proowner <> b.proowner OR a.prosecdef IS DISTINCT FROM b.prosecdef OR a.config IS DISTINCT FROM b.config
     OR a.provolatile IS DISTINCT FROM b.provolatile OR a.acl IS DISTINCT FROM b.acl OR a.prorettype <> b.prorettype THEN
    RAISE EXCEPTION 'world_ip_retention: claim_world_session_v2 attributes or grants changed';
  END IF;
  IF pg_catalog.strpos(a.prosrc, 'PERFORM public.world_sessions_purge_stale_ip();') = 0
     OR pg_catalog.strpos(a.prosrc, '''duplicate-ip''') > 0
     OR pg_catalog.replace(a.prosrc, E'  -- IP 보관 상한(WORLD-IP-RETENTION-001): 하트비트가 24시간 넘게 끊긴 행의 ip를 지운다(행 · 임대 상태는 그대로).\n  PERFORM public.world_sessions_purge_stale_ip();\n\n', '')
        IS DISTINCT FROM pg_catalog.replace(b.prosrc, E'  -- IP 보관 상한(WORLD-IP-RETENTION-001): 하트비트가 24시간 넘게 끊긴 행의 ip를 지운다(행 · 임대 상태는 그대로).\n  PERFORM public.world_sessions_purge_stale_ip();\n\n', '') THEN
    RAISE EXCEPTION 'world_ip_retention: claim_world_session_v2 body differs from 20260712000400 beyond the purge call';
  END IF;
  IF NOT a.prosecdef OR a.config IS DISTINCT FROM (ARRAY['search_path=""'])::text
     OR NOT pg_catalog.has_function_privilege('authenticated', 'public.claim_world_session_v2(text)', 'EXECUTE')
     OR pg_catalog.has_function_privilege('anon', 'public.claim_world_session_v2(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'world_ip_retention: claim_world_session_v2 must stay definer · search_path '''' · authenticated only';
  END IF;
  SELECT p.prosecdef, p.proconfig::text AS config INTO STRICT d FROM pg_catalog.pg_proc p
   WHERE p.oid = pg_catalog.to_regprocedure('public.world_sessions_purge_stale_ip()');
  IF NOT d.prosecdef OR d.config IS DISTINCT FROM (ARRAY['search_path=""'])::text
     OR pg_catalog.has_function_privilege('anon', 'public.world_sessions_purge_stale_ip()', 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', 'public.world_sessions_purge_stale_ip()', 'EXECUTE')
     OR (pg_catalog.to_regrole('service_role') IS NOT NULL
         AND pg_catalog.has_function_privilege('service_role', 'public.world_sessions_purge_stale_ip()', 'EXECUTE')) THEN
    RAISE EXCEPTION 'world_ip_retention: purge function must be definer · search_path '''' · no direct execute';
  END IF;
  -- 데이터: 오래된 ip 0 · 행 집합 · 토큰 · 시각 그대로 · 살아 있는 행의 ip 그대로 · 오래된 행만 ip NULL.
  IF EXISTS (SELECT 1 FROM public.world_sessions WHERE ip IS NOT NULL AND heartbeat_at < pg_catalog.now() - interval '24 hours') THEN
    RAISE EXCEPTION 'world_ip_retention: stale ip remains';
  END IF;
  IF EXISTS (SELECT user_id, session_token, heartbeat_at, created_at FROM pg_temp.wir_rows
             EXCEPT ALL SELECT user_id, session_token, heartbeat_at, created_at FROM public.world_sessions)
     OR EXISTS (SELECT user_id, session_token, heartbeat_at, created_at FROM public.world_sessions
             EXCEPT ALL SELECT user_id, session_token, heartbeat_at, created_at FROM pg_temp.wir_rows) THEN
    RAISE EXCEPTION 'world_ip_retention: session rows changed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_temp.wir_rows r JOIN public.world_sessions s USING (user_id)
             WHERE (NOT r.stale AND pg_catalog.md5(s.ip) IS DISTINCT FROM r.ip_md5) OR (r.stale AND s.ip IS NOT NULL)) THEN
    RAISE EXCEPTION 'world_ip_retention: ip changed outside the stale rows';
  END IF;
  -- 학습 계약 지문 넷 + capability 정의 불변.
  IF EXISTS (SELECT 1 FROM pg_temp.wir_pins o FULL JOIN pg_temp.wir_measure() n USING (k) WHERE o.v IS DISTINCT FROM n.v) THEN
    RAISE EXCEPTION 'world_ip_retention: learning contract fingerprints changed';
  END IF;
END $post$;

DROP FUNCTION pg_temp.wir_measure();
