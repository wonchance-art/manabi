-- AD-R3 PR④ 단어 경계 규칙 표 — 검수 후보(docs/manabi-viewer-v2-ad-r3.md §5.3).
-- 운영 적용은 지속 실행 승인(2026-10-02)의 비파괴 DB 보완 조건(검수 SQL · 보존 증거 · 복원 경로)을 따른다.
-- supabase/migrations에 두지 않는다(자동 db push 경로 밖) — known-word-controls.sql과 같이 운영 담당이 SQL 편집기에서 적용한다.
--
-- 하는 일: 새 표 2개 + 색인 + RLS 정책 + 권한만 추가한다. 기존 표 · 행 · 함수 · 트리거 · 정책은 하나도 바꾸지 않는다.
-- · user_segment_rules   ② 「내 다른 자료에도」 — 본인 행만(RLS). 분석 때 /api/analyze가 사용자 JWT 클라이언트로 읽는다.
-- · shared_segment_rules ③ 「모든 사용자(관리자)」 — 인증 사용자 읽기 전용. 쓰기 정책이 없어 관리자 라우트
--   /api/admin/segment-rules(requireAdmin)만 service_role로 쓴다.
-- · surface = 규칙 꼴(중·일은 공백 없는 표면, 영어는 소문자 · 단어 사이 공백 하나). cuts = surface의 **공백 뺀** 글자 위치(UTF-16)
--   칼선. [] = 한 단어로 묶기, [칼선…] = 나누기. cuts 값 검사(0 < c < 길이, 오름차순, 영어는 단어 사이만)는 서버 · 화면 공용
--   src/lib/segmentRules.js(validateSegmentRule)가 하고, 분석 때도 다시 검사해 어긋난 행은 적용하지 않는다(계약 segmentRules.test.js).
--
-- 실측으로 정한 것(2026-10-13):
-- · reading_materials.id는 bigint다(운영 관측 카탈로그 supabase/tests/fixtures/m09-learning-contracts-20261010.sql:374-375,
--   viewer_replace_analysis(p_id bigint), user_vocabulary.material_id · vocabulary_contexts.material_id도 bigint).
--   설계서 초안의 uuid는 token_corrections 마이그레이션(material_id uuid → reading_materials(id))을 따른 것인데, 그 외래 키는 bigint 기본 키와
--   타입이 맞지 않는다(운영 token_corrections 실제 타입은 읽기 전용으로 따로 확인할 일). 그래서 source_material_id는 bigint + ON DELETE SET NULL이다(출처 표시용 —
--   자료가 지워져도 규칙은 남는다). reading_materials는 한국어 capability 지문(아키텍처 §4.9-1) 범위지만, 들어오는 외래 키는 지문에
--   잡히지 않는다는 것을 M09 관측 카탈로그 위 PGlite에서 확인했다(segment-rules.mjs: 적용 뒤 Korean ready · FSRS 계약 넷 그대로).
-- · user_id · created_by는 auth.users를 가리킨다(profiles가 아니다 — profiles로 들어오는 외래 키는 FSRS activity preflight가 목록으로 고정).
-- · 적용 · 롤백 전후로 learning_language_capabilities() Korean ready와 FSRS 계약 넷 · fsrs_vocabulary_snapshot이 같다는 것을
--   M09 관측 카탈로그 위 PGlite에서 확인한다(supabase/tests/segment-rules.mjs, CI).
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE public.user_segment_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 language text NOT NULL CHECK (language IN ('Japanese','Chinese','English')),
 surface text NOT NULL CHECK (length(surface) BETWEEN 2 AND 40 AND surface = btrim(surface)),
 cuts integer[] NOT NULL DEFAULT '{}' CHECK (cardinality(cuts) <= 39 AND array_position(cuts, NULL) IS NULL),
 source_material_id bigint REFERENCES public.reading_materials(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (user_id, language, surface)
);
-- UNIQUE (user_id, language, surface)의 색인이 (user_id, language) 조회도 덮는다 — 같은 앞부분의 색인을 따로 만들지 않는다.
ALTER TABLE public.user_segment_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_segment_rules FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_segment_rules TO authenticated;
-- service_role 권한은 Supabase 기본 권한(default privileges)에 기대지 않고 명시한다(관리 · 진단 경로).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_segment_rules TO service_role;
CREATE POLICY user_segment_rules_owner ON public.user_segment_rules FOR ALL TO authenticated
 USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE TABLE public.shared_segment_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 language text NOT NULL CHECK (language IN ('Japanese','Chinese','English')),
 surface text NOT NULL CHECK (length(surface) BETWEEN 2 AND 40 AND surface = btrim(surface)),
 cuts integer[] NOT NULL DEFAULT '{}' CHECK (cardinality(cuts) <= 39 AND array_position(cuts, NULL) IS NULL),
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 note text CHECK (note IS NULL OR length(note) <= 200),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (language, surface)
);
ALTER TABLE public.shared_segment_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shared_segment_rules FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.shared_segment_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_segment_rules TO service_role;
CREATE POLICY shared_segment_rules_read ON public.shared_segment_rules FOR SELECT TO authenticated USING (true);
-- 쓰기 정책 없음: 관리자 라우트(requireAdmin)가 서버에서 service_role로 쓴다.

NOTIFY pgrst, 'reload schema';
COMMIT;
