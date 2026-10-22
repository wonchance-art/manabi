-- 정본 책 발행 기록(CANON-RELEASE-001, 오너 「권장대로 ㄱㄱ」 2026-10-22 KST — 보드의 「발행 기록 C안, 오너 결정 대기」를 이 표로 결정).
--
-- 배경: 공개 자료의 metadata는 누구나 꾸밀 수 있다 — 로그인 사용자가 정본과 같은 book key(aozora- · se- · ws- · pd- · art-)를 단
--   공개 글을 만들 수 있고, DB에는 그것을 막는 장치가 없다. 그래서 공개 목록은 정본 표지 · 제목을 닫아 두었다(BOOK-GROUP-OWNER-001,
--   fail closed). 「이 책이 관리자가 발행한 진짜 정본」이라는 판정이 없으면 산책 「고전 명작」 · 서재 표지 · 작가 링크를 열 수 없다.
--
-- 이 파일이 더하는 것:
--   · canonical_book_releases — 정본으로 발행한 책 하나 = 한 줄(book key · 발행한 관리자 = 그 책 장의 소유자 · 발행 때).
--     읽기는 누구나(손님 포함 — 목록용), 쓰기는 관리자 본인 이름으로만(owner_id = auth.uid()) · 고치기 · 지우기는 화면에서 하지 않는다.
--     외래 키를 두지 않는다 — profiles · auth.users에 내부 트리거가 붙으면 학습 지문(activity → admission)이 어긋난다(CONV-LOBBY-001 선례).
--   · canonical_book_shelf() — 발행 기록이 있고 그 관리자의 공개 장이 있는 책만: key · 첫 장 id · 장 수 · 발행 때. 본문 · 분석 · 뜻 없음.
--     고전 명작(산책)이 표시는 저장소 정본 대조표에서, 「어느 자료를 열까」만 이 함수에서 받는다.
--   · 채우기 — 이미 관리자가 모두 공개한 정본 책(소유자 하나 · 장 전부 공개)을 기록한다. 소유자가 둘 이상인 key가 있으면 멈춘다.
--     (2026-10-22 KST 운영 읽기 실측: 정본 key 행은 아오조라 6권 · 그림 1권, 모두 관리자 소유 · 공개 0장 → 채울 줄 0.)
--   앞으로의 기록은 관리자 발행 API(src/lib/server/bookPublishRoute.js 「공개」)가 장을 공개로 바꾸기 전에 남긴다.
--
-- ── 적용 · 롤백 ──
--   · 적용: main 병합 시 supabase-migrations.yml 이 자동 적용. 재실행 안전(표 · 정책은 있으면 두고 다시, 함수는 replace, 채우기는 on conflict do nothing).
--   · 롤백: DROP FUNCTION IF EXISTS public.canonical_book_shelf(); DROP TABLE IF EXISTS public.canonical_book_releases;
--           (자료 무접촉 — 화면은 고전 명작이 빈 칸으로, 공개 목록 정본 표지는 지금처럼 닫힌 채로 돌아간다)
--   · 한 권 내리기: delete from public.canonical_book_releases where book_key = '<key>'; (SQL 편집기 — 장의 공개 여부는 그대로)
--   · 무해성: 기존 표 · 행 · 정책 · 함수를 바꾸지 않는다. reading_materials는 읽기만 한다.
--
-- ── 검증(적용 후) ──
--   1) select relrowsecurity from pg_class where oid = 'public.canonical_book_releases'::regclass; → true
--   2) select grantee, privilege_type from information_schema.role_table_grants where table_name = 'canonical_book_releases'
--      and grantee in ('anon','authenticated') order by 1,2; → anon SELECT · authenticated INSERT · authenticated SELECT
--   3) select count(*) from public.canonical_book_releases; → 채우기 실측(위 실측이면 0)
--   4) set role anon; select * from public.canonical_book_shelf(); → 발행 기록이 있는 공개 책만
--
-- 학습 지문 범위(reading_materials 정책 · 트리거, profiles, fsrs_*)는 만들거나 바꾸지 않는다 — 읽기만(post-observation-migrations.mjs가 실제 지문으로 다시 본다).

CREATE TABLE IF NOT EXISTS public.canonical_book_releases (
  book_key text PRIMARY KEY,
  owner_id uuid NOT NULL,
  released_at timestamptz NOT NULL DEFAULT now(),
  -- 접두사는 정본 key 생성기와 같다(src/lib/canonicalBookKey.js CANONICAL_BOOK_KEY_PREFIXES — canonicalRelease.test.js가 맞춘다).
  CONSTRAINT canonical_book_releases_key_shape CHECK (book_key ~ '^(aozora|se|ws|pd|art)-[A-Za-z0-9_.-]{1,160}$')
);

ALTER TABLE public.canonical_book_releases ENABLE ROW LEVEL SECURITY;
-- Supabase 기본 권한(anon · authenticated ALL)을 걷고 필요한 것만 다시 준다 — `from public` 회수로는 역할에 직접 준 권한이 남는다(VIEW-WRITE-GRANT-001 선례).
REVOKE ALL ON public.canonical_book_releases FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.canonical_book_releases TO anon, authenticated;
GRANT INSERT ON public.canonical_book_releases TO authenticated;

DROP POLICY IF EXISTS canonical_book_releases_read ON public.canonical_book_releases;
CREATE POLICY canonical_book_releases_read ON public.canonical_book_releases
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS canonical_book_releases_admin_insert ON public.canonical_book_releases;
CREATE POLICY canonical_book_releases_admin_insert ON public.canonical_book_releases
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()) AND owner_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.canonical_book_shelf()
RETURNS TABLE (book_key text, first_material_id bigint, chapters bigint, released_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.book_key,
    (array_agg(m.id ORDER BY
      CASE WHEN m.processed_json #>> '{metadata,book,order}' ~ '^[0-9]{1,9}$' THEN (m.processed_json #>> '{metadata,book,order}')::int END NULLS LAST,
      m.id))[1],
    count(*),
    r.released_at
  FROM public.canonical_book_releases r
  JOIN public.reading_materials m
    ON m.owner_id = r.owner_id
   AND m.processed_json #>> '{metadata,book,key}' = r.book_key
   AND m.visibility = 'public'
  GROUP BY r.book_key, r.released_at
  ORDER BY r.book_key
$$;

REVOKE ALL ON FUNCTION public.canonical_book_shelf() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.canonical_book_shelf() TO anon, authenticated;

-- 채우기 — 관리자 소유 · 장 전부 공개인 정본 책만. 한 key에 소유자가 둘 이상이면(어느 쪽이 정본인지 모른다) 아무것도 채우지 않고 멈춘다.
DO $backfill$
DECLARE
  ambiguous text;
BEGIN
  SELECT string_agg(k, ', ') INTO ambiguous FROM (
    SELECT m.processed_json #>> '{metadata,book,key}' AS k
    FROM public.reading_materials m
    JOIN public.profiles p ON p.id = m.owner_id AND p.role = 'admin'
    WHERE m.visibility = 'public' AND m.processed_json #>> '{metadata,book,key}' ~ '^(aozora|se|ws|pd|art)-'
    GROUP BY 1 HAVING count(DISTINCT m.owner_id) > 1
  ) d;
  IF ambiguous IS NOT NULL THEN
    RAISE EXCEPTION 'canonical_book_releases backfill: key with more than one admin owner — %', ambiguous;
  END IF;

  INSERT INTO public.canonical_book_releases (book_key, owner_id, released_at)
  SELECT m.processed_json #>> '{metadata,book,key}', m.owner_id, min(m.created_at)
  FROM public.reading_materials m
  JOIN public.profiles p ON p.id = m.owner_id AND p.role = 'admin'
  WHERE m.processed_json #>> '{metadata,book,key}' ~ '^(aozora|se|ws|pd|art)-[A-Za-z0-9_.-]{1,160}$'
  GROUP BY 1, 2
  HAVING bool_and(m.visibility = 'public')
  ON CONFLICT (book_key) DO NOTHING;
END
$backfill$;
