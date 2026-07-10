-- 학습 월드 세션 임대(world_sessions) — 동일 계정 단일 접속의 서버 권위 판정.
--
-- 배경(PR #70 Codex 배치 리뷰 P1-2): 중복 접속 판정을 클라이언트에서 DB 로 옮긴다.
--   presence(클라 제공 sessionId·joinedAt)는 위조 가능하고, 직접 테이블 DML 도
--   authenticated 클라이언트가 자기 행의 session/heartbeat 을 조건 없이 UPDATE·DELETE
--   하거나 SELECT 로 토큰을 복제할 수 있어 "서버 권위"가 성립하지 않았다(P1-2). 그래서
--   이 파일은 테이블 직접 접근을 전면 차단하고(정책 0개 + REVOKE), 임대 전이 전부를
--   SECURITY DEFINER RPC 3종으로만 노출한다. 신원(auth.uid())·시각(DB now())·비공개
--   세션 토큰을 서버가 원자 검증하므로 변조 클라이언트가 판정을 뒤집을 수 없다.
--
-- net.js 임대 프로토콜(src/lib/world/net.js · createSessionLease):
--   · join   → public.claim_world_session()      → 새 토큰(uuid) 또는 NULL(살아있는 타 세션)
--   · 유지   → public.heartbeat_world_session(t)  → true(유지) / false(임대 상실)
--   · leave  → public.release_world_session(t)    → 내 토큰의 행만 삭제
--   토큰은 클라이언트 메모리에만 보관(로그 금지). SELECT 가 차단되어 복제 불가.
--   presence 휴리스틱은 임대 미적용(강등) 모드에서만 집행하고, 임대(db) 모드에선 표시 전용.
--
-- 만료 판정은 서버 시각 기준(청소 잡 불필요 — 계정당 최대 1행):
--   heartbeat_at < now() - interval '60 seconds' 면 만료로 보고 새 세션이 인수한다.
--   (claim RPC 의 ON CONFLICT ... WHERE 절이 이 기준으로 만료 행만 원자 인수한다.)
--   TTL 60s / heartbeat 15s (net.js LEASE_TTL_MS·LEASE_HEARTBEAT_MS 와 일치).
--
-- ── 적용·롤백 (P2-3: CI 러너 기준 — 수동 SQL Editor 안내 폐기) ──
--   · 적용: main 병합 시 .github/workflows/supabase-migrations.yml 이 `supabase db push`
--           로 자동 적용한다(SQL Editor 수동 실행 금지 — migration history 에 안 남아
--           러너가 재실행하면 중복 오류가 난다). 로컬 검증은 `supabase db reset`.
--   · 재실행 안전: 아래 DDL 은 전면 멱등(CREATE TABLE IF NOT EXISTS · CREATE OR REPLACE
--           FUNCTION · REVOKE/GRANT). 러너가 같은 파일을 다시 밀어도 오류 없이 수렴한다.
--   · 롤백: 수동 DROP 이 아니라 역방향 마이그레이션 파일을 새로 추가해 러너로 적용한다.
--           예시(새 파일 20260710b_world_sessions_rollback.sql 로):
--             DROP FUNCTION IF EXISTS public.release_world_session(uuid);
--             DROP FUNCTION IF EXISTS public.heartbeat_world_session(uuid);
--             DROP FUNCTION IF EXISTS public.claim_world_session();
--             DROP TABLE    IF EXISTS public.world_sessions;
--           (롤백 후에도 net.js 는 42883/42P01 을 감지해 presence 휴리스틱으로 강등 동작.)
--
-- ⚠️ 무해성(fallback): 미적용 시 net.js 가 함수 부재(42883)/테이블 부재(42P01)를 감지해
--    presence 휴리스틱으로 강등한다(UX 가드 — 보안 집행 아님). 적용하면 자동 서버 권위.
--    단 알 수 없는 DB 오류는 net.js 가 fail-closed(멀티 차단)로 처리한다(P2-5).
--
-- ── 검증(적용 후) ──
--   1) 함수 3종 존재:
--        select proname from pg_proc
--         where pronamespace = 'public'::regnamespace
--           and proname in ('claim_world_session','heartbeat_world_session','release_world_session');
--      → 3행.
--   2) 직접 접근 거부(정책 0개 + REVOKE): authenticated 토큰으로
--        select * from public.world_sessions;   → 권한 오류(42501) 또는 0행(정책 없음).
--        insert into public.world_sessions ...;  → 거부.
--   3) RLS 활성 + 정책 0개 확인:
--        select relrowsecurity from pg_class where oid = 'public.world_sessions'::regclass;  → t
--        select count(*) from pg_policies where tablename = 'world_sessions';                 → 0
--   4) 임대 왕복(관리자 세션): select public.claim_world_session();  → uuid 반환.
--      같은 계정 두 번째 세션에서 다시 호출 → NULL(살아있는 타 세션). 60초 뒤 만료 인수.

-- ── 1. 테이블 — 정책 0개(직접 접근 전면 차단), 접근은 오직 RPC 로 ──
CREATE TABLE IF NOT EXISTS public.world_sessions (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token uuid        NOT NULL,             -- 서버 발급 비공개 토큰(클라 메모리에만 존재)
  heartbeat_at  timestamptz NOT NULL DEFAULT now(),  -- 마지막 생존 신호(서버 시각) — 만료 판정 기준
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- RLS 는 켜되 정책을 하나도 만들지 않는다 = 직접 접근(select/insert/update/delete) 전면 차단.
-- 임대 전이는 아래 SECURITY DEFINER RPC 만 통과한다(정책 우회 아님 — definer 권한으로 실행).
ALTER TABLE public.world_sessions ENABLE ROW LEVEL SECURITY;

-- Data API·역할 직접 권한도 회수한다(P2-4: RLS 이전 단계의 GRANT 도 막아 토큰 SELECT 차단).
-- anon/authenticated 는 테이블에 어떤 직접 DML 도 못 한다 — RPC EXECUTE 만 아래에서 부여.
REVOKE ALL ON TABLE public.world_sessions FROM anon, authenticated;

-- ── 2. 임대 RPC (SECURITY DEFINER · search_path 고정 · public 스키마 한정 참조) ──

-- claim: 내 임대를 원자적으로 획득한다. auth.uid() 필수(null → 예외).
--   내 행이 없거나(신규) heartbeat_at 이 60초 넘게 끊겼으면(만료 인수) 새 토큰으로 upsert 후
--   그 토큰을 반환한다. 살아있는 임대(내것이든 타 세션이든)가 이미 있으면 NULL(임대 실패).
--   단일 INSERT ... ON CONFLICT DO UPDATE ... WHERE 문장이라 "확인 후 탈취" 레이스가 없다
--   (DB 가 직렬화). 토큰은 gen_random_uuid() — 서버 생성이라 클라가 예측·지정할 수 없다.
CREATE OR REPLACE FUNCTION public.claim_world_session()
RETURNS uuid
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

  INSERT INTO public.world_sessions (user_id, session_token, heartbeat_at, created_at)
  VALUES (v_uid, gen_random_uuid(), now(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET session_token = excluded.session_token,
        heartbeat_at  = excluded.heartbeat_at
    WHERE public.world_sessions.heartbeat_at < now() - interval '60 seconds'
  RETURNING session_token INTO v_token;

  RETURN v_token;   -- 삽입/인수 성공 → 새 토큰. 살아있는 임대와 충돌 → 0행 → NULL.
END;
$$;

-- heartbeat: 내 행 AND 토큰 일치 시 heartbeat_at 을 서버 시각으로 갱신하고 true.
--   토큰 불일치(다른 세션이 만료 인수)면 갱신 없이 false → 클라가 임대 상실로 물러난다.
CREATE OR REPLACE FUNCTION public.heartbeat_world_session(p_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hit int;
BEGIN
  IF v_uid IS NULL OR p_token IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.world_sessions
     SET heartbeat_at = now()
   WHERE user_id = v_uid AND session_token = p_token;

  GET DIAGNOSTICS v_hit = ROW_COUNT;
  RETURN v_hit > 0;
END;
$$;

-- release: 내 행 AND 토큰 일치 시에만 삭제(후임 세션의 임대는 못 건드림).
CREATE OR REPLACE FUNCTION public.release_world_session(p_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_token IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.world_sessions
   WHERE user_id = v_uid AND session_token = p_token;
END;
$$;

-- ── 3. 실행 권한 — authenticated 에만 EXECUTE(anon 제외). public 기본 권한은 선회수 ──
REVOKE ALL ON FUNCTION public.claim_world_session()            FROM public;
REVOKE ALL ON FUNCTION public.heartbeat_world_session(uuid)    FROM public;
REVOKE ALL ON FUNCTION public.release_world_session(uuid)      FROM public;

GRANT EXECUTE ON FUNCTION public.claim_world_session()         TO authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat_world_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_world_session(uuid)   TO authenticated;
