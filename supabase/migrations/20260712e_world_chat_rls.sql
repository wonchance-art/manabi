-- 학습 월드 도트 채팅 — 'world-chat' Realtime broadcast 개방(전체 로그인 유저).
--
-- 배경: 월드에 포켓몬 대화창풍 도트 채팅을 붙인다. net.js 의 'world-plaza'(좌표·presence)와
--   완전히 분리된 자체 채널 'world-chat' 을 src/lib/world/chat.js 가 private broadcast 로 연다.
--   private 채널은 realtime.messages RLS 로 잠기므로, 이 토픽에 대한 SELECT(수신)·INSERT(송신)
--   정책을 전체 authenticated 로그인 유저에게 열어 준다(20260712d 의 'world-plaza' 개방과 동형).
--   presence 는 쓰지 않으므로 extension 은 'broadcast' 만 허용한다.
--
-- 이 파일이 바꾸는 것:
--   realtime.messages 에 'world-chat' 토픽 정책 2개(수신 SELECT · 송신 INSERT)를 추가한다.
--   (DROP POLICY IF EXISTS 뒤 CREATE — 멱등·재실행 안전. 정책 이름으로 자연 대체.)
--
-- 적용: main 병합 시 supabase-migrations.yml CI 가 `supabase db push` 로 자동 적용한다
--       (#77·#80 에서 동작 확인). 수동 실행이 필요하면 SQL Editor 에 전체 붙여넣기.
--
-- ── 적용·롤백 ──
--   · 재실행 안전: 전면 멱등(DROP POLICY IF EXISTS 뒤 CREATE).
--   · 롤백: 아래 두 정책을 DROP POLICY IF EXISTS 로 제거하면 'world-chat' 은 다시 잠긴다(채팅 비활성).
--
-- ── 검증(적용 후) ──
--   1) 정책 존재:
--        select policyname, cmd from pg_policies
--         where schemaname='realtime' and tablename='messages'
--           and policyname in ('world_chat_receive','world_chat_send'); → 2행.
--   2) 두 로그인 계정으로 /world 접속 → 한쪽에서 입력·전송 시 상대 대화창에 즉시 표시.

-- ── 1. 'world-chat' 수신(SELECT) — 전체 로그인 유저 허용 ──
DROP POLICY IF EXISTS "world_chat_receive" ON realtime.messages;
CREATE POLICY "world_chat_receive"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (select realtime.topic()) = 'world-chat'
  AND realtime.messages.extension = 'broadcast'
);

-- ── 2. 'world-chat' 송신(INSERT) — 전체 로그인 유저 허용 ──
DROP POLICY IF EXISTS "world_chat_send" ON realtime.messages;
CREATE POLICY "world_chat_send"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (select realtime.topic()) = 'world-chat'
  AND realtime.messages.extension = 'broadcast'
);

-- 롤백:
--   DROP POLICY IF EXISTS "world_chat_receive" ON realtime.messages;
--   DROP POLICY IF EXISTS "world_chat_send" ON realtime.messages;
