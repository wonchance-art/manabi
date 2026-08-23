-- 만남 출처 문맥(user_vocab_encounters.context) — rfc-adaptive-quiz R3.
--
-- 배경: 만남 행은 표기(word_text)와 첫 만남 시각(first_met_at)만 가진다. 학습자가 그 말을
--   "어느 문장에서" 만났는지를 함께 남기면, /study 복습 빈칸(cloze)의 예문을 일반 정본
--   예문 대신 **실제로 마주친 그 문장**으로 낼 수 있다(서버 조립이 직접 소비).
--   첫 만남 문장만 남긴다 — first_met_at 보존과 같은 불변 철학(이후 만남은 덮지 않음).
--
-- 이 파일이 더하는 것:
--   · context text — 첫 만남 문장(≤200자, 클라이언트 상한과 동일 계약). NULL 허용
--     (기존 행·문맥 없는 기록 경로는 그대로 유효).
--   · context_source text — 출처 표지(npc/node/door/viewer, ≤20자). NULL 허용.
--   · update/delete 정책은 계속 없음 — 문맥은 최초 insert에만 실리므로 불변이 구조로 성립.
--
-- ── 적용·롤백 ──
--   · 적용: main 병합 시 .github/workflows/supabase-migrations.yml 이 `supabase db push` 로 자동 적용.
--   · 재실행 안전: 전면 멱등(ADD COLUMN IF NOT EXISTS).
--   · 롤백: 역방향 마이그레이션 파일로
--       ALTER TABLE public.user_vocab_encounters DROP COLUMN IF EXISTS context, DROP COLUMN IF EXISTS context_source;
--     (문맥은 부가 정보 — 컬럼 삭제로 만남 기록 자체는 무손상).
--   · 무해성: 미적용이어도 vocabEncounterSync 의 push 가 insert 실패를 조용히 삼켜
--            로컬 단독으로 동작한다(§4.5 무해성 계약 그대로). 서버 조립의 문맥 조회도
--            실패 시 기존 정본 예문으로 폴백한다.
--
-- ── 검증(적용 후) ──
--   1) 컬럼: select column_name from information_schema.columns
--        where table_name='user_vocab_encounters' and column_name in ('context','context_source');  → 2행.
--   2) 왕복(로그인 세션): context 포함 insert 후 select 로 본인 행의 context 가 보인다.

ALTER TABLE public.user_vocab_encounters
  ADD COLUMN IF NOT EXISTS context text CHECK (context IS NULL OR char_length(context) <= 200),
  ADD COLUMN IF NOT EXISTS context_source text CHECK (context_source IS NULL OR char_length(context_source) <= 20);
