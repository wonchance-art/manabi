-- 서재에서 튜터 대화를 빼는 managed_rows 본문을 마이그레이션 사슬에 싣는다(LIB-FIX-001 ⓑ 후속 · 오케스트레이터 2026-11-24 KST — 비파괴 · 백엔드 자율).
-- 왜: docs/sql/library-hide-conversations.sql(CONV-CHAT-001 8차, 2026-10-17 KST)은 운영에 손으로 적용됐지만(managed_rows 본문 md5 18a33cfe… =
--   그 파일 본문과 바이트 동일, 2026-11-24 실측) supabase/migrations에는 없었다. 그래서 저장소 사슬(새 환경 · PGlite 사슬)은 대화가 서재 「전체」에
--   보이는 옛 본문(20260930135103, md5 16963a52…)을 만든다. LibraryShelf.jsx 주석은 적용됐다고 가정한다.
-- 하는 것: 지금 본문의 md5로 갈래를 나눈다.
--   18a33cfe…(운영 — 이미 적용) → 무변경(NOTICE).
--   16963a52…(옛 본문 — 새 환경 · 사슬) → 위 파일과 같은 본문으로 바꾼다.
--   그 밖 → 멈춘다(모르는 본문을 덮어쓰지 않는다).
-- 데이터 변경 0. 반환 모양 · 권한 · search_path 그대로(CREATE OR REPLACE는 실행권을 지킨다). 복원: docs/sql/library-hide-conversations-rollback.sql.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TEMP TABLE lhc_pins (k text PRIMARY KEY, v text) ON COMMIT DROP;
CREATE FUNCTION pg_temp.lhc_measure() RETURNS TABLE (k text, v text) LANGUAGE plpgsql AS $m$
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
INSERT INTO pg_temp.lhc_pins SELECT * FROM pg_temp.lhc_measure();

DO $mig$
DECLARE cur text;
BEGIN
  IF to_regprocedure('library_private.managed_rows(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'function library_private.managed_rows(jsonb) does not exist' USING ERRCODE = '42883';
  END IF;
  SELECT md5(prosrc) INTO cur FROM pg_catalog.pg_proc WHERE oid = 'library_private.managed_rows(jsonb)'::regprocedure;
  IF cur = '18a33cfe6899cc081875af66238f4362' THEN
    RAISE NOTICE 'library hide conversations: already applied (md5 %) — nothing to change', cur;
    RETURN;
  END IF;
  IF cur IS DISTINCT FROM '16963a52f504e3bd9f9b19bc39af73f1' THEN
    RAISE EXCEPTION 'library hide conversations: managed_rows body % is neither the base nor the applied body — not overwriting', cur;
  END IF;
  EXECUTE $def$CREATE OR REPLACE FUNCTION library_private.managed_rows(p_filters jsonb DEFAULT '{}'::jsonb)
 RETURNS SETOF jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 with refs as (
  select target_kind,target_id from public.library_item_state where owner_id=auth.uid()
  union select target_kind,target_id from public.library_collection_items where owner_id=auth.uid()
  union select 'material',material_id::text from public.library_bookmarks where owner_id=auth.uid()
 ), source as (select * from library_private.catalog_sources()), rows as (
  select to_jsonb(r)||jsonb_build_object('original_title',r.title,'title',coalesce(s.display_title,r.title),'display_title',s.display_title,
   'favorite',coalesce(s.favorite,false),'state',coalesce(s.state,'active'),'revision',coalesce(s.revision,0),'unavailable',false) item
  from source r left join public.library_item_state s on s.owner_id=auth.uid() and s.target_kind=r.target_kind and s.target_id=r.target_id
  where (r.listed or s.target_id is not null or (coalesce((p_filters->>'recent')::boolean,false) and r.opened_at is not null))
   and (p_filters->>'scope' is not distinct from 'trash' or case when r.target_kind='material' and r.material_id ~ '^[0-9]{1,18}$'
    then not exists(select 1 from public.reading_materials m where m.id=r.material_id::bigint and m.processed_json#>'{metadata,conversation}' is not null)
    else true end)
  union all
  select jsonb_build_object('target_kind',r.target_kind,'target_id',r.target_id,'title','접근할 수 없는 자료','unavailable',true,
   'state',coalesce(s.state,'active'),'revision',coalesce(s.revision,0),'favorite',coalesce(s.favorite,false),'assets','[]'::jsonb,'children','[]'::jsonb)
  from refs r left join public.library_item_state s on s.owner_id=auth.uid() and s.target_kind=r.target_kind and s.target_id=r.target_id
  where not exists(select 1 from source c where c.target_kind=r.target_kind and c.target_id=r.target_id)
 ) select item from rows where
 coalesce(item->>'state','active')=case when p_filters->>'scope'='trash' then 'trashed' else 'active' end
 and (p_filters->>'scope' is distinct from 'favorites' or (item->>'favorite')::boolean)
 and (p_filters->>'scope' is distinct from 'unfiled' or not exists(select 1 from public.library_collection_items x join public.library_collections c on c.owner_id=x.owner_id and c.id=x.collection_id and c.deleted_at is null where x.owner_id=auth.uid() and x.target_kind=item->>'target_kind' and x.target_id=item->>'target_id'))
 and (coalesce(p_filters->>'collection','')='' or exists(select 1 from public.library_collection_items x join public.library_collections c on c.owner_id=x.owner_id and c.id=x.collection_id and c.deleted_at is null where x.owner_id=auth.uid() and x.collection_id::text=p_filters->>'collection' and x.target_kind=item->>'target_kind' and x.target_id=item->>'target_id'))
 and (not coalesce((p_filters->>'recent')::boolean,false) or item->>'opened_at' is not null)
 and (coalesce(p_filters->>'language','')='' or (p_filters->>'language'='unknown' and coalesce(item->>'language','')='') or item->>'language'=p_filters->>'language' or exists(select 1 from jsonb_array_elements(item->'children') c where c->>'language'=p_filters->>'language'))
 and (coalesce(p_filters->>'level','')='' or item->>'level'=p_filters->>'level' or exists(select 1 from jsonb_array_elements(item->'children') c where c->>'level'=p_filters->>'level'))
 and (coalesce(p_filters->>'kind','')='' or (p_filters->>'kind'='note' and (item->>'is_note')::boolean) or (p_filters->>'kind'='book' and item->>'target_kind' in ('book','edition')) or (p_filters->>'kind'='text' and item->>'excerpt'<>'') or (p_filters->>'kind'='link' and (item->>'link_count')::int>0) or exists(select 1 from jsonb_array_elements(item->'assets') a where a->>'kind'=p_filters->>'kind'))
 and (coalesce(p_filters->>'state','')='' or (p_filters->>'state'='opened' and item->>'opened_at' is not null) or (p_filters->>'state'='completed' and (item->>'completed')::boolean) or (p_filters->>'state'='unread' and not coalesce((item->>'completed')::boolean,false)))
 and (not coalesce((p_filters->>'pinned')::boolean,false) or coalesce(p_filters->'pinnedIds','[]') ? (item->>'material_id') or exists(select 1 from jsonb_array_elements(item->'children') c where coalesce(p_filters->'pinnedIds','[]') ? (c->>'id')))
 and (coalesce(btrim(p_filters->>'query'),'')='' or strpos(lower(coalesce(item->>'title','')),lower(left(btrim(p_filters->>'query'),120)))>0 or strpos(lower(coalesce(item->>'original_title','')),lower(left(btrim(p_filters->>'query'),120)))>0 or exists(select 1 from jsonb_array_elements(item->'assets') a where strpos(lower(a->>'name'),lower(left(btrim(p_filters->>'query'),120)))>0) or exists(select 1 from jsonb_array_elements(item->'children') c where strpos(lower(c->>'title'),lower(left(btrim(p_filters->>'query'),120)))>0 or exists(select 1 from jsonb_array_elements(c->'assets') a where strpos(lower(a->>'name'),lower(left(btrim(p_filters->>'query'),120)))>0)))
$function$$def$;
  RAISE NOTICE 'library hide conversations: managed_rows replaced (base → conversations hidden)';
END $mig$;

DO $post$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_catalog.pg_proc WHERE oid = 'library_private.managed_rows(jsonb)'::regprocedure) IS DISTINCT FROM '18a33cfe6899cc081875af66238f4362' THEN
    RAISE EXCEPTION 'library hide conversations: managed_rows body is not the applied body';
  END IF;
  IF (SELECT proconfig FROM pg_catalog.pg_proc WHERE oid = 'library_private.managed_rows(jsonb)'::regprocedure) IS DISTINCT FROM ARRAY['search_path=""'] THEN
    RAISE EXCEPTION 'library hide conversations: search_path changed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     AND NOT has_function_privilege('authenticated', 'library_private.managed_rows(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'library hide conversations: authenticated lost EXECUTE on managed_rows';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_temp.lhc_pins b FULL JOIN pg_temp.lhc_measure() a USING (k) WHERE a.v IS DISTINCT FROM b.v) THEN
    RAISE EXCEPTION 'library hide conversations: learning contract fingerprint changed — abort';
  END IF;
END $post$;

DROP FUNCTION pg_temp.lhc_measure();
