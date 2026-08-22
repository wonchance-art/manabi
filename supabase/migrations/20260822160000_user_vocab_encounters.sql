-- 우리 사전 '만남' 기록 서버 정본(user_vocab_encounters) — rfc-vocab-encounter §4.5.
--
-- 배경: 만남 기록(월드 NPC 대화·노드 설명·도어 프롬프트·뷰어 드래그에서 노출된 정본 어휘)은
--   localStorage `vocab-encounters:<lang>` 로컬 단독으로 완결돼 있다(§4.2). 이 테이블은 그 기록의
--   다기기 동기화 정본이다 — 로컬이 원본이라는 철학은 유지하고(오프라인·게스트 무영향), 학습 웹
--   진입 시 쌍방 병합(pull 합집합 + 로컬 전용분 push)만 한다. 만남은 "처음 본 사실"이라 불변 —
--   update/delete 정책은 두지 않고 first_met_at 을 보존한다(world_stamps own-only 관례).
--
-- 이 파일이 더하는 것:
--   · user_vocab_encounters 신규 테이블 — PK(user_id, lang, word_text)로 언어별 표기당 1행.
--     lang 은 소문자 2자(클라이언트 isEncounterLang 계약과 동일), word_text 는 정본 표기(≤100자).
--   · own-only RLS 2종(select/insert) + REVOKE anon / GRANT authenticated.
--
-- ── 적용·롤백 ──
--   · 적용: main 병합 시 .github/workflows/supabase-migrations.yml 이 `supabase db push` 로 자동 적용.
--   · 재실행 안전: 전면 멱등(CREATE TABLE IF NOT EXISTS · DROP POLICY IF EXISTS 뒤 CREATE · REVOKE/GRANT).
--   · 롤백: 역방향 마이그레이션 파일로 `DROP TABLE IF EXISTS public.user_vocab_encounters;`
--     (로컬 기록이 원본이라 서버 행 삭제로 데이터가 유실되지 않는다 — 다음 병합 때 다시 push 됨).
--   · 무해성: 미적용이어도 vocabEncounterSync 가 조회·insert 실패를 조용히 삼켜 로컬 단독으로
--            동작한다(§4.2 그대로 — 동기화만 비활성).
--
-- ── 검증(적용 후) ──
--   1) 테이블: select to_regclass('public.user_vocab_encounters');  → 'public.user_vocab_encounters'.
--   2) RLS 활성 + own 정책 2종:
--        select relrowsecurity from pg_class where oid='public.user_vocab_encounters'::regclass;  → t
--        select count(*) from pg_policies where tablename='user_vocab_encounters';                → 2
--   3) 왕복(로그인 세션): insert 후 select 로 본인 행만 보인다(타 계정 행 비노출),
--      같은 (lang, word_text) 재-insert 는 충돌(멱등 upsert 는 클라이언트가 ignoreDuplicates 로 수행).

-- ── 1. 테이블 — PK(user_id, lang, word_text)로 표기당 1행(첫 만남 시각 보존) ──
CREATE TABLE IF NOT EXISTS public.user_vocab_encounters (
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lang         text        NOT NULL CHECK (lang ~ '^[a-z]{2}$'),           -- 'ja' 등(클라이언트 계약 동일)
  word_text    text        NOT NULL CHECK (char_length(word_text) BETWEEN 1 AND 100),  -- 정본 표기
  first_met_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lang, word_text)
);

-- ── 2. RLS — own-only select/insert (만남은 불변: update/delete 정책 없음) ──
ALTER TABLE public.user_vocab_encounters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vocab_encounters_select_own" ON public.user_vocab_encounters;
CREATE POLICY "vocab_encounters_select_own" ON public.user_vocab_encounters
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "vocab_encounters_insert_own" ON public.user_vocab_encounters;
CREATE POLICY "vocab_encounters_insert_own" ON public.user_vocab_encounters
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── 3. 권한 — 익명 차단, 로그인 사용자만 읽기/쓰기 ──
REVOKE ALL ON public.user_vocab_encounters FROM anon;
GRANT SELECT, INSERT ON public.user_vocab_encounters TO authenticated;
