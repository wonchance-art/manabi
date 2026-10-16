-- 튜터 대화를 서재에서 뺀다(CONV-CHAT-001 8차, 오너 결정 「대화방에만」 2026-10-17 03:02 KST).
-- 대화(reading_materials.processed_json.metadata.conversation이 있는 자료)는 대화 탭 방 목록에서만 연다.
-- 서재 「전체」·즐겨찾기·미분류·모음·필터·「읽던 곳에서」 목록(personal_library_page_v2 → managed_rows)에서 뺀다.
-- 휴지통(scope=trash)에는 그대로 남겨 지운 대화를 되돌릴 수 있게 한다(대화방 ⋯ 「지우기」 = 서재 휴지통).
-- 바꾸는 것은 managed_rows의 첫 갈래 조건 한 줄뿐이다. 반환 모양·권한·search_path는 그대로다.
-- 기준: 운영 본문 md5 16963a52f504e3bd9f9b19bc39af73f1(2026-10-17 03:10 KST). 데이터 변경 0 — 대화 기록·단어·복습 그대로.
-- 되돌리기: docs/sql/library-hide-conversations-rollback.sql
BEGIN;
DO $$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'library_private.managed_rows(jsonb)'::regprocedure) <> '16963a52f504e3bd9f9b19bc39af73f1' THEN
    RAISE EXCEPTION 'managed_rows가 기준 본문과 다르다 — 운영 정의를 다시 읽고 이 파일을 갱신할 것';
  END IF;
END;
$$;
CREATE OR REPLACE FUNCTION library_private.managed_rows(p_filters jsonb DEFAULT '{}'::jsonb)
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
$function$;
COMMIT;
