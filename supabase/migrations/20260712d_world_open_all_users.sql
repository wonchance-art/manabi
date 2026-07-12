-- 학습 월드 전체 개방(오너 확정) — 관리자 전용 → 전체 로그인 유저 + IP 동시접속 차단 해제.
--
-- 배경: `/world` 는 지금까지 관리자 전용 실험실이었다. 오너 확정으로 정식 기능이 되어
--   전체 로그인 유저에게 개방한다. 서버측 잠금은 두 지점이었다:
--     1) realtime.messages 의 'world-plaza' 정책 2개가 role='admin' 조건이라, 관리자만
--        broadcast/presence 를 수신(SELECT)·송신(INSERT)할 수 있었다(20260709_world_realtime_rls.sql).
--     2) claim_world_session_v2 가 "같은 IP·다른 계정의 살아있는 세션" 을 duplicate-ip 로 거부했다
--        (20260712c_world_multiplayer.sql). 오너 확정으로 같은 IP 다중 접속을 허용한다.
--   이 파일이 두 지점을 모두 개방한다(멱등·재실행 안전).
--
-- 이 파일이 바꾸는 것:
--   1) realtime 'world-plaza' 정책 2개(수신/송신)를 role='admin' → 전체 authenticated 로그인 유저로 교체.
--      (DROP POLICY IF EXISTS 뒤 CREATE — 멱등. 정책 "이름" 은 유지해 20260709 를 자연 대체한다.)
--   2) claim_world_session_v2 를 CREATE OR REPLACE — ip 는 계속 기록하되 duplicate-ip 거부 로직 제거.
--      계정 단위 동시접속(단일 접속)은 그대로 유지한다. 반환 계약(jsonb {token, reason})은 불변이되
--      reason 은 이제 'duplicate-account'|null 만 발생한다(duplicate-ip 는 미래 재활성 여지로 계약만 남김).
--
-- ⚠️ 이 리포는 마이그레이션 자동 적용 CI가 없을 수 있습니다(20260709 참고).
--    필요 시 Supabase 대시보드 → SQL Editor 에서 이 파일 전체를 붙여넣고 직접 실행하세요.
--    (20260712c 헤더는 supabase-migrations.yml 자동 적용을 전제 — 환경에 맞는 경로로 적용하세요.)
--
-- ── 적용·롤백 ──
--   · 재실행 안전: 전면 멱등(DROP POLICY IF EXISTS 뒤 CREATE · CREATE OR REPLACE FUNCTION · REVOKE/GRANT).
--   · SECURITY DEFINER 함수의 search_path='' 를 유지한다(스키마 한정 이름으로 안전).
--   · 롤백: 20260709 의 admin 정책과 20260712c 의 v2(IP 차단 포함)를 다시 적용하면 관리자 전용·IP 차단으로 복귀.
--
-- ── 검증(적용 후) ──
--   1) 정책이 admin 조건 없이 존재하는지:
--        select policyname, cmd from pg_policies
--         where schemaname='realtime' and tablename='messages'
--           and policyname in ('world_plaza_admin_receive','world_plaza_admin_send'); → 2행.
--   2) 일반(비관리자) 로그인 계정으로 /world 진입 → net.onStatus 'connected', presence 정상.
--   3) 같은 IP 의 서로 다른 두 계정이 동시에 /world 접속 → 둘 다 입장 성공(더 이상 duplicate-ip 없음).
--   4) 같은 계정을 두 기기/탭에서 접속 → 한쪽만 유지(계정 단위 단일 접속은 그대로).

-- ── 1. realtime 'world-plaza' 수신(SELECT) — 전체 로그인 유저 허용 ──
-- (정책 이름은 20260709 와 동일하게 유지해 그 admin 정책을 자연 대체한다.)
DROP POLICY IF EXISTS "world_plaza_admin_receive" ON realtime.messages;
CREATE POLICY "world_plaza_admin_receive"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (select realtime.topic()) = 'world-plaza'
  AND realtime.messages.extension IN ('broadcast', 'presence')
);

-- ── 2. realtime 'world-plaza' 송신(INSERT) — 전체 로그인 유저 허용 ──
DROP POLICY IF EXISTS "world_plaza_admin_send" ON realtime.messages;
CREATE POLICY "world_plaza_admin_send"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (select realtime.topic()) = 'world-plaza'
  AND realtime.messages.extension IN ('broadcast', 'presence')
);

-- ── 3. claim_world_session_v2 — IP 동시접속 차단 해제(ip 는 계속 기록) ──
-- 변경점: 20260712c 의 "같은 IP·다른 계정의 살아있는 세션" 거부 블록을 제거한다.
--   · ip 는 계속 INSERT/UPDATE 로 기록한다(진단·미래 재활성 재료).
--   · 계정 단위 판정은 그대로 — 단일 upsert…WHERE(만료 행만 인수)의 0행 여부로 duplicate-account 를 가른다.
-- 반환 계약(jsonb {token, reason}) 불변. reason 은 이제 'duplicate-account'|null 만 발생한다.
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

-- 실행 권한 — authenticated 만(anon·public 회수). 20260712c 와 동일 계약.
REVOKE ALL ON FUNCTION public.claim_world_session_v2(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_world_session_v2(text) TO authenticated;

-- 롤백:
--   -- 관리자 전용 realtime 정책 복원(20260709 재적용) + IP 차단 v2 복원(20260712c 재적용).
--   -- 즉 이 파일이 교체한 두 지점을 각 원본 마이그레이션으로 되돌리면 관리자 전용·IP 차단으로 복귀한다.
