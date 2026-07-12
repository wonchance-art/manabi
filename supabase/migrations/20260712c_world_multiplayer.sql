-- 학습 월드 멀티플레이 강화(오너 요구 3종) — 좌표 영속화 + IP 단위 동시 접속 차단.
--
-- 이 파일은 세 가지를 더한다(전부 net.js 무변경·기존 RPC 시그니처 무손상):
--   1) world_sessions 에 ip 컬럼 추가(계정 단위 임대는 기존 그대로, IP 단위 검사 재료).
--   2) claim_world_session_v2(p_ip) 신규 RPC — 계정 단위(기존)에 더해 "같은 IP·다른 계정의
--      살아있는 세션" 도 거부하고, 실패 사유를 'duplicate-account' | 'duplicate-ip' 로 구분한다.
--      ⚠️ 기존 claim_world_session() 은 그대로 둔다(net.js 가 아직 이걸 호출). 오버로드 모호성
--         (같은 이름 + DEFAULT 인자)을 피하려고 별도 이름(_v2)으로 신설한다 — net.js 전환은
--         Codex 후속 라운드에서 POST /api/world/session 을 경유해 이 v2 를 부르도록 바꾼다.
--   3) world_positions 신규 테이블 — 마지막 좌표(씬·타일 x·y)를 본인만 read/write(RLS own-only).
--      재접속 시 이 자리에서 스폰한다. RPC 가 아니라 사용자 세션 DML 로 접근(own-only RLS 방어).
--
-- ── 적용·롤백 ──
--   · 적용: main 병합 시 supabase-migrations.yml 이 `supabase db push` 로 자동 적용.
--   · 재실행 안전: 전면 멱등(ADD COLUMN IF NOT EXISTS · CREATE TABLE IF NOT EXISTS ·
--                 CREATE OR REPLACE FUNCTION · DROP POLICY IF EXISTS 뒤 CREATE · REVOKE/GRANT).
--   · 무해성: 미적용이어도 net.js 는 기존 claim_world_session() 로 정상 동작한다(이 파일이 더하는
--            IP 차단·좌표 스폰은 라우트/WorldPage 가 이 스키마를 요구하되, GET 실패 시 스폰은
--            기본(서울)으로 폴백한다).
--
-- ── 검증(적용 후) ──
--   1) 컬럼: select column_name from information_schema.columns
--             where table_schema='public' and table_name='world_sessions' and column_name='ip'; → 1행.
--   2) 함수: select proname from pg_proc where pronamespace='public'::regnamespace
--             and proname='claim_world_session_v2'; → 1행. (claim_world_session 도 여전히 존재)
--   3) world_positions RLS 활성 + own 정책 3종:
--        select count(*) from pg_policies where tablename='world_positions'; → 3
--   4) 관리자 세션으로 select public.claim_world_session_v2('1.2.3.4'); → {"token":"<uuid>","reason":null}.

-- ── 1. world_sessions.ip 컬럼 (IP 단위 동시 접속 검사 재료) ──
ALTER TABLE public.world_sessions ADD COLUMN IF NOT EXISTS ip text;

-- ── 2. claim_world_session_v2(p_ip) — 계정 + IP 단위 임대(사유 구분 반환) ──
-- 반환: jsonb { token: uuid|null, reason: 'duplicate-account'|'duplicate-ip'|null }.
--   · token 있음         → 임대 획득(신규 또는 만료 인수). reason=null.
--   · reason=duplicate-ip → 같은 IP·다른 계정의 살아있는(60초 내) 세션이 있어 거부. token=null.
--   · reason=duplicate-account → 같은 계정의 살아있는 세션이 이미 있어 거부(계정 단위). token=null.
-- IP 검사를 INSERT 앞에 두어, IP 충돌이면 내 임대 행을 만들지 않고 물러난다.
-- 계정 단위 판정은 기존과 동일한 단일 upsert…WHERE(만료 행만 인수)의 0행 여부로 가른다.
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

  -- IP 단위 차단: 같은 IP 로 "다른 계정" 의 살아있는 세션이 있으면 거부(계정 자신은 아래 upsert 로 처리).
  IF p_ip IS NOT NULL AND p_ip <> '' AND EXISTS (
    SELECT 1 FROM public.world_sessions
     WHERE ip = p_ip
       AND user_id <> v_uid
       AND heartbeat_at >= now() - interval '60 seconds'
  ) THEN
    RETURN jsonb_build_object('token', NULL, 'reason', 'duplicate-ip');
  END IF;

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

-- 실행 권한 — authenticated 만(anon·public 회수). 기존 3종과 동일 계약(P2-2).
REVOKE ALL ON FUNCTION public.claim_world_session_v2(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_world_session_v2(text) TO authenticated;

-- ── 3. world_positions — 마지막 좌표(씬·타일 x·y). 본인만 read/write(RLS own-only) ──
-- world_sessions 와 달리 토큰 비밀이 없으므로 직접 DML 을 허용하되 own-only 정책으로 가둔다
-- (사용자 세션 클라이언트가 upsert — service_role 미사용). x·y 는 타일 인덱스(월드 px 아님).
CREATE TABLE IF NOT EXISTS public.world_positions (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  scene      text        NOT NULL DEFAULT 'plaza',   -- 'plaza' | 'airport'
  x          int         NOT NULL,                    -- 타일 x (0..맵폭)
  y          int         NOT NULL,                    -- 타일 y (0..맵높이)
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.world_positions ENABLE ROW LEVEL SECURITY;

-- own-only 정책 3종: 본인 행만 select/insert/update. delete 는 필요 없음(계정 삭제는 FK CASCADE).
DROP POLICY IF EXISTS "world_positions_select_own" ON public.world_positions;
CREATE POLICY "world_positions_select_own"
ON public.world_positions FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "world_positions_insert_own" ON public.world_positions;
CREATE POLICY "world_positions_insert_own"
ON public.world_positions FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "world_positions_update_own" ON public.world_positions;
CREATE POLICY "world_positions_update_own"
ON public.world_positions FOR UPDATE TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

-- 명시 GRANT — authenticated 만(anon 불필요). 컬럼 전체 대상.
REVOKE ALL ON TABLE public.world_positions FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.world_positions TO authenticated;

-- 롤백(역방향 마이그레이션 파일로):
--   DROP TABLE IF EXISTS public.world_positions;
--   DROP FUNCTION IF EXISTS public.claim_world_session_v2(text);
--   ALTER TABLE public.world_sessions DROP COLUMN IF EXISTS ip;
