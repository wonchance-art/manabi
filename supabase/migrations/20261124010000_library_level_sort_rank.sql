-- 서재 「급수순」 정렬이 글자순이던 것 고침(LIB-FIX-001 ① · 오케스트레이터 발주 2026-11-24 KST — 오류 수정이라 화면 목업 없음, 화면 배치 변화 0).
-- 증상: personal_library_page_v2의 order by가 `item->>'level'` 문자열 정렬이라 「N1 심화」가 「N5 기초」 앞, 「H1 기초」 · 「A1 기초」 · 「B1 중급」이
--   사전순으로 섞인다(20260930135103_personal_library_management.sql). 지금 이 정렬은 옛 주소(LibraryShelf.jsx)에서만 보인다.
-- 기준(정본 한 곳): 저장 급수 값의 학습 순서 = src/lib/constants.js `LEVELS`의 배열 순서 · `levelRank(language, level)`(0부터).
--   자료실(MaterialsPage)의 급수순이 이미 이 함수를 쓴다. 운영 저장 값이 그 목록 그대로다(「N5 기초」 · 「H5 고급」 · 「A1 기초」 — 2026-11-24 실측).
--   printSheet.js의 materialLevelRank는 이 칸에 맞지 않는다(정규식 `HSK n` · `n급`만 읽어 운영 중국어 「H5 고급」을 급수 없음으로 본다) — 쓰지 않는다.
--   SQL 배열은 LEVELS와 같아야 한다 — 계약 src/lib/__tests__/libraryLevelRank.test.js가 두 목록을 대조하고 PGlite가 값마다 levelRank와 같은지 본다.
-- 급수가 없거나 목록 밖 값 · 언어 모름은 맨 끝(nulls last), 같은 순위끼리는 지금 순서(만든 날 최신 → kind → id) 그대로.
-- 다른 정렬(최근 연 순 · 제목 · 기본)은 order by 첫째 · 둘째 키가 그대로라 바뀌지 않는다.
-- 사전 검사: 운영 함수 본문이 이 파일이 고치는 그 문장(글자순 급수 키)을 지금도 가지고 있어야 한다 — 아니면(그 사이 다른 변경) 멈춘다.
-- 복원: docs/sql/library-level-sort-rank-20261124-rollback.sql(옛 order by로 되돌리고 순위 함수를 지운다).
-- 학습 계약 지문 넷 범위 밖(library_private · personal_library_page_v2는 지문이 읽지 않는다) — 사후 검사에서 다시 잰다.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $pre$
BEGIN
  IF to_regprocedure('public.personal_library_page_v2(jsonb,integer,integer)') IS NULL THEN
    RAISE EXCEPTION 'function public.personal_library_page_v2 does not exist' USING ERRCODE = '42883';
  END IF;
  IF position($q$case when p_filters->>'sort'='level' then item->>'level' end$q$ IN
              pg_get_functiondef('public.personal_library_page_v2(jsonb,integer,integer)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'library level sort: personal_library_page_v2 changed since 20260930135103 — not overwriting';
  END IF;
END $pre$;

CREATE TEMP TABLE lls_pins (k text PRIMARY KEY, v text) ON COMMIT DROP;
CREATE FUNCTION pg_temp.lls_measure() RETURNS TABLE (k text, v text) LANGUAGE plpgsql AS $m$
DECLARE f record; val text;
BEGIN
  FOR f IN SELECT * FROM (VALUES ('core', 'fsrs_private', 'contract_hash_live'), ('manual', 'fsrs_private', 'manual_contract_hash_live'),
      ('admission', 'fsrs_private', 'admission_contract_hash_live'), ('activity', 'fsrs_private', 'activity_profile_hash_live')) x(k, sch, fn) LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = f.sch AND p.proname = f.fn AND p.pronargs = 0) THEN
      EXECUTE format('SELECT %I.%I()::text', f.sch, f.fn) INTO val;
    ELSE val := NULL; END IF;
    k := f.k; v := val; RETURN NEXT;
  END LOOP;
END $m$;
INSERT INTO pg_temp.lls_pins SELECT * FROM pg_temp.lls_measure();

-- 급수 순위(0부터) — src/lib/constants.js levelRank와 같은 값. 목록 밖 · 언어 모름 = null.
-- level-rank:begin (계약이 이 구간의 배열을 LEVELS와 대조한다)
CREATE OR REPLACE FUNCTION library_private.material_level_rank(p_language text, p_level text) RETURNS integer
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT pg_catalog.array_position(CASE p_language
    WHEN 'Japanese' THEN ARRAY['N5 기초', 'N4 기본', 'N3 중급', 'N2 상급', 'N1 심화']
    WHEN 'English' THEN ARRAY['A1 기초', 'A2 초급', 'B1 중급', 'B2 상급', 'C1 고급', 'C2 마스터']
    WHEN 'French' THEN ARRAY['A0 입문', 'A1 기초', 'A2 초급', 'B1 중급', 'B2 상급', 'C1 고급', 'C2 마스터']
    WHEN 'Chinese' THEN ARRAY['OT 입문', 'H1 기초', 'H2 초급', 'H3 중급', 'H4 상급', 'H5 고급', 'H6 마스터']
  END::text[], p_level) - 1
$$;
-- level-rank:end
REVOKE ALL ON FUNCTION library_private.material_level_rank(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION library_private.material_level_rank(text, text) TO authenticated;

-- 본문은 20260930135103 그대로, 급수 키 한 줄만 순위로(글자순 → 학습 순서 · 없는 급수 맨 끝).
CREATE OR REPLACE FUNCTION public.personal_library_page_v2(p_filters jsonb default '{}',p_offset integer default 0,p_limit integer default 20) returns jsonb
language sql stable security invoker set search_path='' as $$
 with rows as(select item from library_private.managed_rows(p_filters) item), page as (
 select item||jsonb_build_object('match_child',(
  select jsonb_build_object('id',c->>'id','title',c->>'title') from jsonb_array_elements(item->'children') c
  where coalesce(btrim(p_filters->>'query'),'')<>'' and strpos(lower(c->>'title'),lower(left(btrim(p_filters->>'query'),120)))>0
  order by coalesce((c->>'order')::numeric,0),c->>'id' limit 1
 )) item from rows order by
  case when p_filters->>'sort'='opened' or p_filters->>'recent'='true' then item->>'opened_at' end desc nulls last,
  case when p_filters->>'sort'='title' then lower(item->>'title') end,
  case when p_filters->>'sort'='level' then library_private.material_level_rank(item->>'language',item->>'level') end nulls last,
  item->>'created_at' desc nulls last,item->>'target_kind',item->>'target_id'
 offset greatest(0,least(coalesce(p_offset,0),100000)) limit greatest(1,least(coalesce(p_limit,20),100)))
 select jsonb_build_object('total',(select count(*) from rows),'items',coalesce((select jsonb_agg(item-'children'-'listed') from page),'[]'))
$$;

DO $post$
BEGIN
  IF position('library_private.material_level_rank' IN pg_get_functiondef('public.personal_library_page_v2(jsonb,integer,integer)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'library level sort: new order key not applied';
  END IF;
  IF library_private.material_level_rank('Japanese', 'N5 기초') IS DISTINCT FROM 0 OR library_private.material_level_rank('Japanese', 'N1 심화') IS DISTINCT FROM 4
     OR library_private.material_level_rank('Chinese', 'H5 고급') IS DISTINCT FROM 5 OR library_private.material_level_rank('English', 'zz') IS NOT NULL THEN
    RAISE EXCEPTION 'library level sort: rank function values differ from levelRank';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     AND NOT has_function_privilege('authenticated', 'public.personal_library_page_v2(jsonb,integer,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'library level sort: authenticated lost EXECUTE on personal_library_page_v2';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND has_function_privilege('anon', 'library_private.material_level_rank(text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'library level sort: anon can execute the rank function';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_temp.lls_pins b FULL JOIN pg_temp.lls_measure() a USING (k) WHERE a.v IS DISTINCT FROM b.v) THEN
    RAISE EXCEPTION 'library level sort: learning contract fingerprint changed — abort';
  END IF;
END $post$;

DROP FUNCTION pg_temp.lls_measure();
