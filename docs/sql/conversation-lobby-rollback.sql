-- 모두의 대화방(CONV-LOBBY-001) 되돌리기 — docs/sql/conversation-lobby.sql이 만든 것만 지운다(다른 표 영향 없음).
-- 지우면 방의 말·신고 기록도 사라진다. 필요하면 먼저 두 표를 내보내 보존한다.
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables
             WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversation_lobby_messages') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.conversation_lobby_messages;
  END IF;
END;
$$;
DROP TABLE IF EXISTS public.conversation_lobby_reports;
DROP TABLE IF EXISTS public.conversation_lobby_messages;
DROP FUNCTION IF EXISTS public.conversation_lobby_rate_limit();
DROP FUNCTION IF EXISTS public.conversation_lobby_hide_reported();
COMMIT;
