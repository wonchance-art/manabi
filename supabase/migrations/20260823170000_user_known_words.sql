-- '이미 앎' 표시 서버 정본(user_known_words) — #1077 제안 14, 오너 목업 ⑤ 승인 2026-08-23.
--
-- 배경: 담지 않았지만 이미 아는 단어를 표시해 커버리지(i+1)와 "새 단어" 셈을 정밀화한다
--   (LingQ의 known 선례). 단어장(user_vocabulary)·SRS와는 분리된 미니 표기 목록 —
--   학습 대상이 아니므로 복습 큐·사전 어디에도 편입되지 않고, 커버리지 합류 지점은
--   클라이언트(materialFit 호출부의 인덱스 합집합)뿐이다. 취소 가능(만남과 달리 가변).
--
-- 이 파일이 더하는 것:
--   · user_known_words — PK(user_id, lang, word_text). lang은 소문자 2자
--     (user_vocab_encounters와 동일 계약), word_text는 뷰어 표기(≤100자).
--   · own-only RLS 3종(select/insert/delete — 취소용 delete 포함) + REVOKE anon.
--
-- ── 적용·롤백 ──
--   · 적용: main 병합 시 supabase-migrations.yml 이 자동 적용. 재실행 안전(전면 멱등).
--   · 롤백: DROP TABLE IF EXISTS public.user_known_words; (표시 목록만 사라진다 —
--     단어장·학습 기록 무접촉).
--   · 무해성: 미적용이어도 클라이언트가 조회·쓰기 실패를 조용히 삼켜 버튼만 비활성.
--
-- ── 검증(적용 후) ──
--   1) select to_regclass('public.user_known_words');
--   2) select count(*) from pg_policies where tablename='user_known_words';  → 3
--   3) 왕복: insert → select 본인 행만, delete로 취소, 타 계정 행 비노출.

CREATE TABLE IF NOT EXISTS public.user_known_words (
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lang      text NOT NULL CHECK (lang ~ '^[a-z]{2}$'),
  word_text text NOT NULL CHECK (char_length(word_text) BETWEEN 1 AND 100),
  marked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lang, word_text)
);

ALTER TABLE public.user_known_words ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_known_words_select_own" ON public.user_known_words;
CREATE POLICY "user_known_words_select_own" ON public.user_known_words
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_known_words_insert_own" ON public.user_known_words;
CREATE POLICY "user_known_words_insert_own" ON public.user_known_words
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_known_words_delete_own" ON public.user_known_words;
CREATE POLICY "user_known_words_delete_own" ON public.user_known_words
  FOR DELETE TO authenticated USING (user_id = auth.uid());

REVOKE ALL ON public.user_known_words FROM anon;
GRANT SELECT, INSERT, DELETE ON public.user_known_words TO authenticated;
