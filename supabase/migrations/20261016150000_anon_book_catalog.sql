-- 비로그인 사용자는 책 목록만 본다 — 책 장의 본문·분석은 로그인 뒤에만(BOOK-GUEST-GATE-1, 오너 「권장대로 진행」 2026-10-16 KST).
--
-- 배경: 「함께 읽는 글」 목록과 뷰어는 브라우저에서 anon 키로 reading_materials를 읽는다. 공개 행이면 anon도 모든 칸
--   (raw_text · processed_json의 sequence/dictionary = 본문과 뜻 전부)을 받는다 — 화면에 로그인 버튼만 달면 개발자 도구로
--   본문이 보인다. 그래서 DB에서 막는다.
--
-- 책 = processed_json.metadata.book.key가 비어 있지 않은 자료(서재에서 책 카드로 묶이는 것 — 정본 문학 · 그림책 ·
--   사용자가 공개한 책 전부, 오너 선택 「책으로 묶인 공개 자료 전부」). 책이 아닌 낱개 공개 글은 지금처럼 anon도 읽는다.
--
-- 이 파일이 더하는 것:
--   · anon_book_chapters_hidden — anon SELECT 제한 정책(RESTRICTIVE — 기존 허용 정책들과 AND). 로그인 사용자는 무변경.
--   · public_book_catalog(p_id) — 목록 · 뷰어 안내용 메타만(id · 제목 · 만든 때 · 공개 여부 · 소유자 · 분석 상태 ·
--     metadata.book/literature/language/level). 본문 · 분석 · 뜻 · 경계 기록 없음. p_id를 주면 그 공개 책 장 하나(없으면 0행).
--
-- ── 적용 · 롤백 ──
--   · 적용: main 병합 시 supabase-migrations.yml 이 자동 적용. 재실행 안전(정책은 지우고 다시, 함수는 replace).
--   · 롤백: DROP POLICY IF EXISTS anon_book_chapters_hidden ON public.reading_materials;
--           DROP FUNCTION IF EXISTS public.public_book_catalog(bigint);  (anon이 다시 책 본문을 읽게 된다 — 자료 무접촉)
--   · 무해성: 행 · 칸을 바꾸지 않는다(권한만 좁힌다). 함수가 없으면 화면은 비로그인 목록에서 책 카드만 빠진다.
--
-- ── 검증(적용 후) ──
--   1) select policyname, permissive, roles from pg_policies where tablename='reading_materials' and policyname='anon_book_chapters_hidden';
--      → RESTRICTIVE · {anon}
--   2) set role anon; select count(*) from reading_materials where processed_json->'metadata'->'book'->>'key' is not null; → 0
--   3) set role anon; select processed_json from public_book_catalog() limit 1; → sequence · dictionary 없음

DROP POLICY IF EXISTS anon_book_chapters_hidden ON public.reading_materials;
CREATE POLICY anon_book_chapters_hidden ON public.reading_materials
  AS RESTRICTIVE FOR SELECT TO anon
  USING (NULLIF(processed_json #>> '{metadata,book,key}', '') IS NULL);

CREATE OR REPLACE FUNCTION public.public_book_catalog(p_id bigint DEFAULT NULL)
RETURNS TABLE (id bigint, title text, created_at timestamptz, visibility text, owner_id uuid, processed_json jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.id, m.title, m.created_at, m.visibility, m.owner_id,
    jsonb_build_object(
      'status', m.processed_json -> 'status',
      'metadata', jsonb_build_object(
        'book', m.processed_json #> '{metadata,book}',
        'literature', m.processed_json #> '{metadata,literature}',
        'language', m.processed_json #> '{metadata,language}',
        'level', m.processed_json #> '{metadata,level}'))
  FROM public.reading_materials m
  WHERE m.visibility = 'public'
    AND NULLIF(m.processed_json #>> '{metadata,book,key}', '') IS NOT NULL
    AND (p_id IS NULL OR m.id = p_id)
  ORDER BY m.created_at DESC
$$;

REVOKE ALL ON FUNCTION public.public_book_catalog(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_book_catalog(bigint) TO anon, authenticated;
