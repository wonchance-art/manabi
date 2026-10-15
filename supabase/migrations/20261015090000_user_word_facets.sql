-- 단어 목록 탭별 O · X(user_word_facets) — LEVEL-FACET-AO-001, 오너 결정 2026-10-15 KST(「계정에」).
--
-- 배경: 레벨 단어 목록의 보기 탭(단어 · 문장 · 뜻 · 소리)마다 아는지 따로 기록한다.
--   글자를 보고 아는 것(알아보기)과 뜻을 보고 떠올리는 것(떠올리기)은 다른 기억이라
--   한 줄(user_known_words)로 합치면 뭉개진다(Skritter 면별 추적 · Pleco scorefile 선례).
--   설계 /mnt/project-files/notes/level-list-v4-review.md §2.
--
-- 경계: 이 표는 **표시 기록**일 뿐이다.
--   · 복습 일정(FSRS) · 아는 단어(user_known_words) · 단어장 · 이력 어디에도 트리거로 닿지 않는다.
--   · X를 누르면 화면이 따로 기존 저장 경로(FSRS 직접 추가)를 부른다 — 이 표는 그 결과를 바꾸지 않는다.
--
-- 이 파일이 더하는 것:
--   · user_word_facets — PK(user_id, lang, word_text, facet). lang 소문자 2자(user_known_words와 같은 계약),
--     facet ∈ word · sentence · meaning · audio, mark ∈ o · x.
--   · own-only RLS 4종(select/insert/update/delete) + REVOKE anon.
--
-- ── 적용 · 롤백 ──
--   · 적용: main 병합 시 supabase-migrations.yml 이 자동 적용. 재실행 안전(전면 멱등).
--   · 롤백: DROP TABLE IF EXISTS public.user_word_facets; (탭별 표시만 사라진다 — 아는 단어 · 단어장 · 학습 기록 무접촉).
--   · 무해성: 미적용이어도 화면은 조회 · 쓰기 실패를 조용히 삼키고 탭별 표시만 비운다.
--
-- ── 검증(적용 후) ──
--   1) select to_regclass('public.user_word_facets');
--   2) select count(*) from pg_policies where tablename='user_word_facets';  → 4
--   3) 왕복: upsert → select 본인 행만, mark 바꾸기, delete, 타 계정 행 비노출.

CREATE TABLE IF NOT EXISTS public.user_word_facets (
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lang      text NOT NULL CHECK (lang ~ '^[a-z]{2}$'),
  word_text text NOT NULL CHECK (char_length(word_text) BETWEEN 1 AND 100),
  facet     text NOT NULL CHECK (facet IN ('word', 'sentence', 'meaning', 'audio')),
  mark      text NOT NULL CHECK (mark IN ('o', 'x')),
  marked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lang, word_text, facet)
);

ALTER TABLE public.user_word_facets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_word_facets_select_own" ON public.user_word_facets;
CREATE POLICY "user_word_facets_select_own" ON public.user_word_facets
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_word_facets_insert_own" ON public.user_word_facets;
CREATE POLICY "user_word_facets_insert_own" ON public.user_word_facets
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_word_facets_update_own" ON public.user_word_facets;
CREATE POLICY "user_word_facets_update_own" ON public.user_word_facets
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_word_facets_delete_own" ON public.user_word_facets;
CREATE POLICY "user_word_facets_delete_own" ON public.user_word_facets
  FOR DELETE TO authenticated USING (user_id = auth.uid());

REVOKE ALL ON public.user_word_facets FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_word_facets TO authenticated;
