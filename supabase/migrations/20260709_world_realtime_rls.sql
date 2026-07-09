-- 학습 월드 실시간 채널 접근 제어 — 'world-plaza' 를 관리자 전용 private 채널로 잠근다.
--
-- 배경: net.js 가 Supabase Realtime broadcast(좌표·WebRTC SDP)와 presence(닉·펫)로
--   참가자 데이터를 실어 나른다. 지금까지 admin 게이트는 클라이언트 UI(WorldPage)뿐이라,
--   토큰만 있으면 누구나 채널을 구독해 좌표·닉네임·SDP 를 엿볼 수 있었다.
--   net.js 를 private 채널(config.private=true)로 바꾸고, 여기에 Realtime Authorization
--   RLS 정책을 걸어 서버측에서 관리자만 수신(SELECT)/송신(INSERT)하도록 강제한다.
--
-- ⚠️ 이 리포는 마이그레이션 자동 적용 CI가 없습니다.
--    Supabase 대시보드 → SQL Editor 에서 이 파일 전체를 붙여넣고 직접 실행하세요.
--
-- ⚠️ 무해성(fallback) 보장: 이 파일을 적용하지 않아도 앱은 깨지지 않는다.
--    private 채널 구독이 거부되면 net.js 상태기계가 조용히 'failed' → 솔로로 떨어진다.
--    (WorldPage 는 이미 관리자 전용 페이지라 일반 사용자는 채널을 열지도 않는다.)
--
-- 참고(공식 문서 재현): Supabase Realtime Broadcast/Presence Authorization 은
--   realtime.messages 테이블의 RLS 로 검증한다.
--     · realtime.topic()               → 접속하려는 채널 topic 이름
--     · realtime.messages.extension    → 'broadcast' | 'presence' (메시지 종류)
--     · 검증은 채널 구독(WebSocket join) 시 1회 수행되어 캐시된다.
--     · private 채널(config.private=true)에만 적용 — 다른 곳의 public 채널은 영향 없음.
--   docs: https://supabase.com/docs/guides/realtime/authorization
--
-- 검증 방법:
--   1) 정책 존재 확인:
--        select policyname, cmd from pg_policies
--         where schemaname = 'realtime' and tablename = 'messages';
--      → world_plaza_admin_receive(SELECT), world_plaza_admin_send(INSERT) 2건.
--   2) 관리자 계정으로 /world 진입 → net.onStatus 가 'connected', presence 동기화 정상.
--   3) 비관리자 토큰으로 private 'world-plaza' 구독 시 CHANNEL_ERROR → 솔로 전환.
--   4) 미적용 상태에서도 관리자 페이지가 솔로(음성/멀티 없음)로 무해 동작하는지.

-- ── 0. realtime.messages RLS 활성화 ─────────────────────────────
-- (Supabase 최신 프로젝트는 기본 활성화되어 있으나, 재실행 안전하게 명시한다.)
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- ── 1. 수신(SELECT) — 관리자만 'world-plaza' 의 broadcast/presence 를 받는다 ──
DROP POLICY IF EXISTS "world_plaza_admin_receive" ON realtime.messages;
CREATE POLICY "world_plaza_admin_receive"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (select realtime.topic()) = 'world-plaza'
  AND realtime.messages.extension IN ('broadcast', 'presence')
  AND EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = (select auth.uid()) AND role = 'admin'
  )
);

-- ── 2. 송신(INSERT) — 관리자만 'world-plaza' 로 broadcast/presence 를 보낸다 ──
DROP POLICY IF EXISTS "world_plaza_admin_send" ON realtime.messages;
CREATE POLICY "world_plaza_admin_send"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (select realtime.topic()) = 'world-plaza'
  AND realtime.messages.extension IN ('broadcast', 'presence')
  AND EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = (select auth.uid()) AND role = 'admin'
  )
);

-- 롤백:
--   DROP POLICY IF EXISTS "world_plaza_admin_receive" ON realtime.messages;
--   DROP POLICY IF EXISTS "world_plaza_admin_send"    ON realtime.messages;
--   (롤백 후 net.js 를 private:false 로 되돌려야 채널이 다시 열린다. 정책만 지우고
--    private 채널을 그대로 두면 구독이 거부되어 솔로로만 동작한다.)
