-- 모두의 대화방(CONV-LOBBY-001, 오너 결정 2026-10-15 17:54 KST 「기록 남기기」).
--
-- 대화 방 목록 맨 위의 사용자끼리 이야기하는 방. 학습 언어마다 방이 하나이고 지난 말이 남는다.
-- 이 파일이 만드는 것(기존 표·데이터는 건드리지 않는다):
--   · public.conversation_lobby_messages — 방의 말(언어·쓴 사람·본문 300자·시각·가림 시각)
--   · public.conversation_lobby_reports  — 신고(한 사람이 한 말에 한 번). 서로 다른 3명이 신고하면 그 말을 가린다
--   · 접근 규칙: 로그인한 사람은 가려지지 않은 말을 읽고, 자기 이름으로만 쓰고, 자기 말만 지운다.
--     관리자(public.is_admin())는 가린 말도 보고 어떤 말이든 지운다. 고치기(UPDATE)는 열지 않는다.
--   · 도배 막기: 한 사람이 10초에 5건을 넘게 쓰면 거절(lobby_rate_limited)
--   · 새 말 실시간 알림: supabase_realtime 발행에 이 표를 더한다(접근 규칙이 그대로 걸린다)
--
-- 적용: 운영은 #1337로 M09가 적용한다(supabase/migrations 자동 적용 경로는 쓰지 않는다). 한 번만 실행한다(새 표 생성).
-- 되돌리기: docs/sql/conversation-lobby-rollback.sql(이 두 표·두 함수만 지운다. 다른 표 영향 없음).
-- 적용 전에는 화면이 「아직 준비 중」으로 물러선다(src/lib/conversation/lobby.js isLobbyMissing) — 저장 오류를 보이지 않는다.
-- 검수: supabase/tests/conversation-lobby.mjs(PGlite 일회용 DB).
BEGIN;

CREATE TABLE public.conversation_lobby_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  language text NOT NULL CHECK (language IN ('Chinese', 'Japanese', 'English', 'French')),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  hidden_at timestamptz
);
CREATE INDEX conversation_lobby_messages_room ON public.conversation_lobby_messages (language, created_at DESC);
CREATE INDEX conversation_lobby_messages_author ON public.conversation_lobby_messages (user_id, created_at DESC);

CREATE TABLE public.conversation_lobby_reports (
  message_id bigint NOT NULL REFERENCES public.conversation_lobby_messages(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, reporter_id)
);

ALTER TABLE public.conversation_lobby_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_lobby_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY lobby_messages_read ON public.conversation_lobby_messages FOR SELECT TO authenticated
  USING (hidden_at IS NULL OR user_id = auth.uid() OR public.is_admin());
CREATE POLICY lobby_messages_write ON public.conversation_lobby_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND hidden_at IS NULL);
CREATE POLICY lobby_messages_delete ON public.conversation_lobby_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
-- Supabase 기본 권한(새 표에 anon·authenticated 전부)을 걷고 필요한 것만 다시 준다 — 고치기·비우기는 아무에게도 없다.
REVOKE ALL ON public.conversation_lobby_messages, public.conversation_lobby_reports FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.conversation_lobby_messages TO authenticated;

CREATE POLICY lobby_reports_own ON public.conversation_lobby_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());
CREATE POLICY lobby_reports_write ON public.conversation_lobby_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());
GRANT SELECT, INSERT ON public.conversation_lobby_reports TO authenticated;

-- 도배 막기 — 자기 말만 세므로 호출자 권한(INVOKER)으로 충분하다.
CREATE FUNCTION public.conversation_lobby_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  NEW.body := btrim(NEW.body);
  IF (SELECT count(*) FROM public.conversation_lobby_messages
      WHERE user_id = NEW.user_id AND created_at > now() - interval '10 seconds') >= 5 THEN
    RAISE EXCEPTION 'lobby_rate_limited' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER conversation_lobby_rate_limit BEFORE INSERT ON public.conversation_lobby_messages
  FOR EACH ROW EXECUTE FUNCTION public.conversation_lobby_rate_limit();
REVOKE ALL ON FUNCTION public.conversation_lobby_rate_limit() FROM PUBLIC, anon, authenticated;

-- 서로 다른 3명이 신고하면 가린다 — 신고자는 남의 말을 고칠 수 없으므로 이 함수만 정의자 권한으로 가림 시각을 쓴다.
CREATE FUNCTION public.conversation_lobby_hide_reported()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT count(*) FROM public.conversation_lobby_reports WHERE message_id = NEW.message_id) >= 3 THEN
    UPDATE public.conversation_lobby_messages SET hidden_at = now() WHERE id = NEW.message_id AND hidden_at IS NULL;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER conversation_lobby_hide_reported AFTER INSERT ON public.conversation_lobby_reports
  FOR EACH ROW EXECUTE FUNCTION public.conversation_lobby_hide_reported();
REVOKE ALL ON FUNCTION public.conversation_lobby_hide_reported() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_lobby_messages;
  END IF;
END;
$$;

COMMIT;
