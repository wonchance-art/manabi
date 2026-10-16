-- 운영 이력(supabase_migrations.schema_migrations)에 statements 없이 기록된 버전의 재구성본.
-- 2026-10-16 KST 운영에서 직접 복구한 FK 이동: 대화방 두 표가 profiles 대신 auth.users를 참조한다.
-- profiles를 참조하는 FK가 profiles에 내부 트리거를 붙여 fsrs_private.activity_profile_hash가 어긋났다
-- (learning_admission_status · fsrs_vocabulary_snapshot 500). 근거: bcff0d3c(CONV-LOBBY-001).
-- 내용은 2026-10-17 KST 운영 pg_constraint 실측과 일치한다. 운영에는 이미 적용·기록돼 db push가 다시 실행하지 않는다.
BEGIN;
ALTER TABLE public.conversation_lobby_messages
  DROP CONSTRAINT conversation_lobby_messages_user_id_fkey,
  ADD CONSTRAINT conversation_lobby_messages_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.conversation_lobby_reports
  DROP CONSTRAINT conversation_lobby_reports_reporter_id_fkey,
  ADD CONSTRAINT conversation_lobby_reports_reporter_id_fkey
    FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE CASCADE;
COMMIT;
