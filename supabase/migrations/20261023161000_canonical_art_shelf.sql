-- 고전 명작 「그림」 구간의 작품별 서가(DISCOVER-ART-001, 오너 「권장대로 ㄱㄱ」 2026-10-23 KST).
--
-- 배경: 「책」 구간은 책 한 권 = 카드 한 장이라 canonical_book_shelf()의 첫 장 id만으로 연다. 「그림」 구간은 작품 한 점 = 카드 한 장이고,
--   작품 한 점은 그림 책(art-<큐레이션>)의 한 장이다 — 카드마다 그 장의 자료 id가 필요하다.
--
-- 이 파일이 더하는 것:
--   · canonical_art_shelf() — 발행 기록(canonical_book_releases)이 있는 그림 책(art- key)의, 그 기록 관리자 소유 공개 장만:
--     book key · 작품 id(metadata.literature.work) · 장 순서(metadata.book.order) · 자료 id. 본문 · 분석 · 뜻 없음.
--     화면(src/lib/artShelf.js)은 표시(그림 · 제목 · 한 줄 이야기)를 저장소 카탈로그에서 하고, 책 key · 순서 · 작품이 카탈로그와 모두 맞는 줄만 연다.
--   canonical_book_shelf()와 같은 잇기 — 위조 공개 글(같은 key를 단 다른 사람의 글)은 소유자가 달라 빠진다(fail closed).
--
-- ── 적용 · 롤백 ──
--   · 적용: main 병합 시 supabase-migrations.yml 이 자동 적용. 재실행 안전(함수는 replace).
--   · 롤백: DROP FUNCTION IF EXISTS public.canonical_art_shelf();  (자료 무접촉 — 화면은 「그림」 구간이 빈 채로 「책」만 보인다)
--   · 무해성: 기존 표 · 행 · 정책 · 함수를 바꾸지 않는다. canonical_book_releases · reading_materials는 읽기만 한다.
--
-- ── 검증(적용 후) ──
--   1) set role anon; select * from public.canonical_art_shelf(); → 발행 기록이 있는 그림 책의 공개 장만(지금은 0행 — 발행 기록 0줄)
--   2) select prosecdef, proconfig from pg_proc where proname = 'canonical_art_shelf'; → true · {search_path=public}
--
-- 학습 지문 범위(reading_materials 정책 · 트리거, profiles, fsrs_*)는 만들거나 바꾸지 않는다 — 읽기만.

CREATE OR REPLACE FUNCTION public.canonical_art_shelf()
RETURNS TABLE (book_key text, work text, chapter_order int, material_id bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.book_key,
    m.processed_json #>> '{metadata,literature,work}',
    CASE WHEN m.processed_json #>> '{metadata,book,order}' ~ '^[0-9]{1,9}$' THEN (m.processed_json #>> '{metadata,book,order}')::int END,
    m.id
  FROM public.canonical_book_releases r
  JOIN public.reading_materials m
    ON m.owner_id = r.owner_id
   AND m.processed_json #>> '{metadata,book,key}' = r.book_key
   AND m.visibility = 'public'
  WHERE r.book_key LIKE 'art-%'
    AND m.processed_json #>> '{metadata,literature,provider}' = 'art'
  ORDER BY 1, 3 NULLS LAST, 4
$$;

REVOKE ALL ON FUNCTION public.canonical_art_shelf() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.canonical_art_shelf() TO anon, authenticated;
