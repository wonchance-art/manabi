-- 단어 목록 바퀴(user_level_rounds) — LEVEL-ROUND-001 ②, 설계 「단어장 여러 바퀴」 2판 G 2번(오너 「구현 개시」 2026-10-19 KST).
--
-- 배경: 레벨 단어 목록을 여러 바퀴 돈다. 바퀴의 답은 review_events(source 'level')에 한 건씩 쌓이고,
--   이 표는 「바퀴가 언제 어떤 범위로 시작했는지」 한 줄씩만 둔다. 답은 started_at 뒤의 것만 이번 바퀴로 센다.
--
-- 경계: 이 표는 바퀴 시작 기록일 뿐이다.
--   · 복습 일정(FSRS) · 아는 단어 · 단어장 · 탭 표시 · review_events 어디에도 트리거로 닿지 않는다.
--   · auth.users만 참조한다 — public.profiles 참조 금지(2026-10-16 장애: profiles 지문이 바뀌어 학습 RPC 500).
--
-- 이 파일이 더하는 것:
--   · user_level_rounds — PK(user_id, lang, level, view, round_no). lang 소문자 2자(user_word_facets와 같은 계약),
--     view ∈ all · word · sentence · meaning · audio, scope ∈ all(처음부터 전부) · missed(모른 것만).
--   · own-only RLS 3종(select/insert/delete — 고치기 없음) + REVOKE 기본 권한.
--
-- ── 적용 · 롤백 ──
--   · 적용: Supabase 연결로 운영 적용(오너 확인 뒤) + schema_migrations에 같은 버전(20261019020000) 기록 — main 병합의 자동 적용과 겹치지 않게. 재실행 안전(전면 멱등).
--   · 롤백: docs/sql/user-level-rounds-rollback.sql (바퀴 구분만 사라지고 화면은 1바퀴로 물러선다 — 답 기록 · 아는 단어 · 단어장 무접촉).
--   · 무해성: 미적용이어도 화면은 조회 실패를 조용히 삼키고 지금까지의 답 전부를 1바퀴로 본다.
--
-- ── 검증(적용 후) ──
--   1) select to_regclass('public.user_level_rounds');
--   2) select count(*) from pg_policies where tablename='user_level_rounds';  → 3
--   3) fsrs_private 지문 4종이 적용 전과 같은지(profiles 무접촉).

CREATE TABLE IF NOT EXISTS public.user_level_rounds (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lang       text NOT NULL CHECK (lang ~ '^[a-z]{2}$'),
  level      text NOT NULL CHECK (level ~ '^[A-Za-z0-9-]{1,12}$'),
  view       text NOT NULL CHECK (view IN ('all', 'word', 'sentence', 'meaning', 'audio')),
  round_no   integer NOT NULL CHECK (round_no BETWEEN 1 AND 10000),
  scope      text NOT NULL CHECK (scope IN ('all', 'missed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lang, level, view, round_no)
);

ALTER TABLE public.user_level_rounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_level_rounds_select_own" ON public.user_level_rounds;
CREATE POLICY "user_level_rounds_select_own" ON public.user_level_rounds
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_level_rounds_insert_own" ON public.user_level_rounds;
CREATE POLICY "user_level_rounds_insert_own" ON public.user_level_rounds
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_level_rounds_delete_own" ON public.user_level_rounds;
CREATE POLICY "user_level_rounds_delete_own" ON public.user_level_rounds
  FOR DELETE TO authenticated USING (user_id = auth.uid());

REVOKE ALL ON public.user_level_rounds FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_level_rounds TO authenticated;
