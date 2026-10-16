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
REVOKE ALL ON public.conversation_lobby_messages, public.conversation_lobby_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.conversation_lobby_messages TO authenticated;
CREATE POLICY lobby_reports_own ON public.conversation_lobby_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());
CREATE POLICY lobby_reports_write ON public.conversation_lobby_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());
GRANT SELECT, INSERT ON public.conversation_lobby_reports TO authenticated;
CREATE FUNCTION public.conversation_lobby_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  NEW.body := btrim(NEW.body);
  NEW.created_at := now();
  NEW.hidden_at := NULL;
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
