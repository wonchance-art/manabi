-- WORLD-IP-RETENTION-001 복원(쓸 일이 생기면) — 20261106220000_world_sessions_ip_retention.sql을 되돌린다.
--   claim_world_session_v2(text)를 20260712000400 본문 그대로로 되돌리고(청소 호출 제거), 청소 함수를 지운다.
--   지운 오래된 ip는 되돌리지 않는다(어떤 기능도 읽지 않는 값 — 이 변경의 목적). 행 · 임대 상태는 그 파일이 바꾸지 않았다.
--   실행권은 CREATE OR REPLACE가 지킨다(authenticated만). 검증: supabase/tests/world-sessions-ip-retention.mjs가 적용 → 복원 → 재적용을 본다.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

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

REVOKE ALL ON FUNCTION public.claim_world_session_v2(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_world_session_v2(text) TO authenticated;

DROP FUNCTION IF EXISTS public.world_sessions_purge_stale_ip();

DO $post$
BEGIN
  IF pg_catalog.strpos((SELECT prosrc FROM pg_catalog.pg_proc
       WHERE oid = pg_catalog.to_regprocedure('public.claim_world_session_v2(text)')), 'world_sessions_purge_stale_ip') > 0
     OR pg_catalog.to_regprocedure('public.world_sessions_purge_stale_ip()') IS NOT NULL THEN
    RAISE EXCEPTION 'world_ip_retention rollback: purge call or function remains';
  END IF;
END $post$;
