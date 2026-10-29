-- docs/sql/library-hide-conversations.sql 되돌리기 — managed_rows를 적용 전 운영 본문(md5 16963a52f504e3bd9f9b19bc39af73f1)으로 되돌린다.
-- 대화가 다시 서재 「전체」에 보인다. 데이터 변경 0.
BEGIN;
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
  where r.listed or s.target_id is not null or (coalesce((p_filters->>'recent')::boolean,false) and r.opened_at is not null)
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
