-- Manabi AI Relay — Claude ↔ Codex 전용 내구성 메시지 큐.
--
-- 공개 앱 사용자와 완전히 분리한다. anon/authenticated에는 테이블 권한과 정책을
-- 모두 주지 않고, 서버 API의 service_role만 읽기·쓰기를 수행한다. claim RPC는
-- 동시 폴러가 같은 메시지를 집지 않도록 FOR UPDATE SKIP LOCKED를 사용한다.
--
-- 미적용 시 /api/ai-relay만 503으로 실패하며 게임·학습 기능에는 영향이 없다.

CREATE TABLE public.ai_relay_messages (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_agent      text        NOT NULL CHECK (source_agent IN ('claude', 'codex')),
  recipient_agent   text        NOT NULL CHECK (recipient_agent IN ('claude', 'codex')),
  kind              text        NOT NULL CHECK (kind IN (
    'PLAN', 'WORKING', 'FREEZE', 'CLAUDE_DONE', 'CLAUDE_FIXED',
    'CLAUDE_REVIEW_REQUEST', 'CODEX_IMPL', 'CODEX_REVIEW', 'CODEX_DONE', 'INFO'
  )),
  repo              text        NOT NULL DEFAULT 'wonchance-art/manabi'
                                CHECK (repo = 'wonchance-art/manabi'),
  pr_number         integer     CHECK (pr_number IS NULL OR pr_number > 0),
  head_sha          text        CHECK (head_sha IS NULL OR head_sha ~ '^[0-9a-f]{40}$'),
  branch            text        CHECK (branch IS NULL OR char_length(branch) <= 255),
  message_body      text        NOT NULL DEFAULT '' CHECK (char_length(message_body) <= 10000),
  payload           jsonb       NOT NULL DEFAULT '{}'::jsonb
                                CHECK (jsonb_typeof(payload) = 'object' AND octet_length(payload::text) <= 65536),
  dedupe_key        text        NOT NULL CHECK (char_length(dedupe_key) BETWEEN 1 AND 160),
  status            text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'claimed', 'acked')),
  attempt_count     integer     NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  claimed_by        text        CHECK (claimed_by IS NULL OR claimed_by IN ('claude', 'codex')),
  claimed_at        timestamptz,
  acked_at          timestamptz,
  last_error        text        CHECK (last_error IS NULL OR char_length(last_error) <= 1000),
  created_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  CONSTRAINT ai_relay_distinct_agents CHECK (source_agent <> recipient_agent),
  CONSTRAINT ai_relay_expiry_after_create CHECK (expires_at > created_at),
  CONSTRAINT ai_relay_source_dedupe UNIQUE (source_agent, dedupe_key)
);

CREATE INDEX ai_relay_claim_idx
  ON public.ai_relay_messages (recipient_agent, status, created_at, id)
  WHERE status IN ('pending', 'claimed');

CREATE INDEX ai_relay_expiry_idx
  ON public.ai_relay_messages (expires_at);

ALTER TABLE public.ai_relay_messages ENABLE ROW LEVEL SECURITY;

-- 정책 없음 = anon/authenticated 전면 거부. service_role만 서버에서 사용한다.
REVOKE ALL ON TABLE public.ai_relay_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ai_relay_messages TO service_role;

CREATE OR REPLACE FUNCTION public.claim_ai_relay_messages(
  p_recipient text,
  p_limit integer DEFAULT 20
)
RETURNS SETOF public.ai_relay_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_recipient NOT IN ('claude', 'codex') THEN
    RAISE EXCEPTION 'invalid relay recipient' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT queued.id
      FROM public.ai_relay_messages AS queued
     WHERE queued.recipient_agent = p_recipient
       AND queued.expires_at > now()
       AND (
         queued.status = 'pending'
         OR (
           queued.status = 'claimed'
           AND queued.claimed_at < now() - interval '5 minutes'
         )
       )
     ORDER BY queued.created_at, queued.id
     FOR UPDATE SKIP LOCKED
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100)
  )
  UPDATE public.ai_relay_messages AS message
     SET status = 'claimed',
         claimed_by = p_recipient,
         claimed_at = now(),
         attempt_count = message.attempt_count + 1
    FROM candidates
   WHERE message.id = candidates.id
  RETURNING message.*;
END;
$$;

-- SECURITY DEFINER 기본 EXECUTE 공개를 반드시 회수한다.
REVOKE ALL ON FUNCTION public.claim_ai_relay_messages(text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ai_relay_messages(text, integer)
  TO service_role;

COMMENT ON TABLE public.ai_relay_messages IS
  'Claude와 Codex 사이의 서버 전용 내구성 인계 큐. 공개 사용자 접근 금지.';

-- 적용 후 검증:
--   select relrowsecurity from pg_class where oid='public.ai_relay_messages'::regclass; -- true
--   select grantee, privilege_type from information_schema.role_table_grants
--     where table_schema='public' and table_name='ai_relay_messages'; -- service_role만
--   select has_function_privilege('anon', 'public.claim_ai_relay_messages(text,integer)', 'execute'); -- false
--   select has_function_privilege('authenticated', 'public.claim_ai_relay_messages(text,integer)', 'execute'); -- false
