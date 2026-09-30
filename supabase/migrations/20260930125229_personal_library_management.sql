-- Personal organization only; source text, editions, progress and FSRS are never mutated.
create schema if not exists library_private;
revoke all on schema library_private from public,anon;
grant usage on schema library_private to authenticated;

create table public.library_item_state (
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 target_kind text not null check(target_kind in ('material','pdf','book','edition')),
 target_id text not null check(length(target_id) between 1 and 200),
 state text not null default 'active' check(state in ('active','trashed','removed')),
 display_title text check(display_title is null or length(btrim(display_title)) between 1 and 200),
 favorite boolean not null default false,
 revision bigint not null default 1,
 updated_at timestamptz not null default now(),created_at timestamptz not null default now(),
 primary key(owner_id,target_kind,target_id)
);
alter table public.library_item_state enable row level security;
revoke all on public.library_item_state from public,anon;
grant select,insert,update on public.library_item_state to authenticated;
create policy library_state_own on public.library_item_state to authenticated
 using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));

alter table public.library_collections add column parent_id uuid,
 add column revision bigint not null default 1, add column deleted_at timestamptz;
alter table public.library_collections add constraint library_folder_parent
 foreign key(owner_id,parent_id) references public.library_collections(owner_id,id);
create index library_folder_parent_idx on public.library_collections(owner_id,parent_id);

-- The per-owner transaction lock serializes tree checks and item revisions, including old clients.
create function library_private.lock_owner() returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'library_login_required' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,9127));
end $$;

create function public.library_canonical_target(p_kind text,p_id text) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare m public.reading_materials; k text:=p_kind; i text:=p_id;
begin
 if p_kind='material' and p_id ~ '^[0-9]{1,18}$' then
  select * into m from public.reading_materials where id=p_id::bigint;
  if m.processed_json#>>'{metadata,composer,role}'='study' then
   i:=m.processed_json#>>'{metadata,composer,parentId}';
   select * into m from public.reading_materials where id=case when i ~ '^[0-9]{1,18}$' then i::bigint end;
  end if;
  i:=coalesce(m.id::text,i);
  if m.owner_id=auth.uid() and nullif(m.processed_json#>>'{metadata,book,key}','') is not null then
   k:='book';i:=m.processed_json#>>'{metadata,book,key}';
  elsif m.source_pdf_id is not null and exists(select 1 from public.uploaded_pdfs where id=m.source_pdf_id and owner_id=auth.uid()) then
   k:='pdf';i:=m.source_pdf_id::text;
  end if;
 end if;
 return jsonb_build_object('target_kind',k,'target_id',i);
end $$;

create function library_private.state_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare canonical jsonb;
begin
 perform library_private.lock_owner();
 if new.owner_id is distinct from auth.uid() then raise exception 'library_owner' using errcode='42501'; end if;
 if tg_op='UPDATE' and (new.owner_id,new.target_kind,new.target_id) is distinct from (old.owner_id,old.target_kind,old.target_id) then raise exception 'library_identity'; end if;
 canonical:=public.library_canonical_target(new.target_kind,new.target_id);
 if canonical->>'target_kind' is distinct from new.target_kind or canonical->>'target_id' is distinct from new.target_id then raise exception 'library_root_required'; end if;
 if (tg_op='INSERT' or (old.state<>'active' and new.state='active')) and not public.library_target_accessible(new.target_kind,new.target_id) then
  if new.state='active' or not (
   exists(select 1 from public.library_item_state where owner_id=auth.uid() and target_kind=new.target_kind and target_id=new.target_id) or
   exists(select 1 from public.library_collection_items where owner_id=auth.uid() and target_kind=new.target_kind and target_id=new.target_id) or
   exists(select 1 from public.library_bookmarks where owner_id=auth.uid() and material_id::text=new.target_id and new.target_kind='material') or
   exists(select 1 from public.library_reading_activity where owner_id=auth.uid() and target_kind=new.target_kind and target_id=new.target_id)
  ) then raise exception 'library_source_unavailable' using errcode='42501'; end if;
 end if;
 new.revision:=case when tg_op='INSERT' then 1 else old.revision+1 end;
 new.updated_at:=clock_timestamp();new.created_at:=case when tg_op='INSERT' then new.updated_at else old.created_at end;new.display_title:=nullif(btrim(new.display_title),'');
 return new;
end $$;
create trigger library_state_guard before insert or update on public.library_item_state for each row execute function library_private.state_guard();

create function library_private.folder_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 -- Preserve existing privileged account-cleanup cascades; no role receives new DELETE rights.
 if tg_op='DELETE' and current_user not in ('authenticated','anon') then return old;end if;
 perform library_private.lock_owner();
 if tg_op='DELETE' then raise exception 'library_use_folder_trash' using errcode='42501'; end if;
 if new.owner_id is distinct from auth.uid() then raise exception 'library_owner' using errcode='42501'; end if;
 if tg_op='UPDATE' and (new.owner_id,new.id) is distinct from (old.owner_id,old.id) then raise exception 'library_identity'; end if;
 if new.parent_id is not null and not exists(select 1 from public.library_collections where owner_id=auth.uid() and id=new.parent_id and (deleted_at is null or new.deleted_at is not null)) then raise exception 'library_folder_unavailable'; end if;
 if new.id=new.parent_id or exists(with recursive ancestors as (
  select id,parent_id from public.library_collections where owner_id=auth.uid() and id=new.parent_id
  union select c.id,c.parent_id from public.library_collections c join ancestors a on c.id=a.parent_id where c.owner_id=auth.uid()
 ) select 1 from ancestors where id=new.id) then raise exception 'library_folder_cycle'; end if;
 if new.deleted_at is null and (tg_op='INSERT' or (new.name,new.parent_id,new.deleted_at) is distinct from (old.name,old.parent_id,old.deleted_at)) and exists(
  select 1 from public.library_collections where owner_id=auth.uid() and id<>new.id and deleted_at is null and parent_id is not distinct from new.parent_id and lower(btrim(name))=lower(btrim(new.name))
 ) then raise exception 'library_folder_duplicate' using errcode='23505'; end if;
 new.revision:=case when tg_op='INSERT' then 1 else old.revision+1 end;new.name:=btrim(new.name);
 return new;
end $$;
create trigger library_folder_guard before insert or update or delete on public.library_collections for each row execute function library_private.folder_guard();

create function library_private.membership_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare t record; c jsonb;
begin
 if tg_op='DELETE' and current_user not in ('authenticated','anon') then return old;end if;
 perform library_private.lock_owner();
 if tg_op='DELETE' then t:=old;else t:=new;end if;
 if t.owner_id is distinct from auth.uid() then raise exception 'library_owner' using errcode='42501';end if;
 c:=public.library_canonical_target(t.target_kind,t.target_id);
 if tg_op<>'DELETE' then
  if c->>'target_kind' is distinct from t.target_kind or c->>'target_id' is distinct from t.target_id then raise exception 'library_root_required'; end if;
  if not exists(select 1 from public.library_collections where owner_id=auth.uid() and id=t.collection_id and deleted_at is null) then raise exception 'library_folder_unavailable'; end if;
  if exists(select 1 from public.library_item_state where owner_id=auth.uid() and target_kind=t.target_kind and target_id=t.target_id and state<>'active') then raise exception 'library_restore_required';end if;
 end if;
 -- An old client membership change must also invalidate a prepared operation/undo.
 insert into public.library_item_state(owner_id,target_kind,target_id,state)
 values(auth.uid(),t.target_kind,t.target_id,case when public.library_target_accessible(t.target_kind,t.target_id) then 'active' else 'removed' end)
 on conflict(owner_id,target_kind,target_id) do update set revision=library_item_state.revision+1;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
create trigger library_membership_guard before insert or delete on public.library_collection_items for each row execute function library_private.membership_guard();

create function library_private.catalog_sources()
returns table(target_kind text,target_id text,title text,language text,level text,created_at timestamptz,excerpt text,assets jsonb,link_count integer,material_id text,child_count bigint,children jsonb,is_note boolean,owned boolean,listed boolean,completed boolean,opened_at timestamptz,context jsonb,failed boolean,editable boolean)
language sql stable security invoker set search_path='' as $$
 with me as (select auth.uid() id), saved as (
  select material_id,created_at from public.library_bookmarks where owner_id=(select id from me) union select target_id::bigint,created_at from public.library_item_state where owner_id=(select id from me) and target_kind='material' and target_id ~ '^[0-9]{1,18}$' and not exists(select 1 from public.library_bookmarks b where b.owner_id=(select id from me) and b.material_id::text=target_id)
 ), members as (
  select target_kind,target_id,min(created_at) created_at from (select target_kind,target_id,created_at from public.library_collection_items x where owner_id=(select id from me) union all select target_kind,target_id,created_at from public.library_item_state where owner_id=(select id from me)) refs group by target_kind,target_id
 ), historical as (
  select case when m.processed_json#>>'{metadata,composer,role}'='study' then 'material'
   when m.owner_id=(select id from me) and nullif(m.processed_json#>>'{metadata,book,key}','') is not null then 'book'
   when m.source_pdf_id is not null and exists(select 1 from public.uploaded_pdfs p where p.id=m.source_pdf_id and p.owner_id=(select id from me)) then 'pdf' else 'material' end target_kind,
   case when m.processed_json#>>'{metadata,composer,role}'='study' then m.processed_json#>>'{metadata,composer,parentId}'
   when m.owner_id=(select id from me) and nullif(m.processed_json#>>'{metadata,book,key}','') is not null then m.processed_json#>>'{metadata,book,key}'
   when m.source_pdf_id is not null and exists(select 1 from public.uploaded_pdfs p where p.id=m.source_pdf_id and p.owner_id=(select id from me)) then m.source_pdf_id::text else m.id::text end target_id,
   jsonb_build_object('materialId',m.id::text,'mode',case when m.processed_json#>>'{metadata,composer,role}'='study' then 'study' else 'text' end) context,
   rp.updated_at opened_at
  from public.reading_progress rp join public.reading_materials m on m.id=rp.material_id
  where rp.user_id=(select id from me) and rp.last_token_idx>0 and not coalesce(rp.is_completed,false) and rp.updated_at is not null
   and (m.owner_id=(select id from me) or m.visibility='public')
 ), recent as (
  select distinct on(target_kind,target_id) target_kind,target_id,context,opened_at from (
   select target_kind,target_id,context,opened_at from public.library_reading_activity where owner_id=(select id from me)
   union all select * from historical
  ) h order by target_kind,target_id,opened_at desc
 ), material_base as (
  select m.id,m.owner_id,m.title,m.created_at,m.source_pdf_id,m.page_start,m.direction,
   m.processed_json#>'{metadata}' meta,m.processed_json->>'status' status,
   coalesce(m.document_json->>'language',m.processed_json#>>'{metadata,language}') language,
   m.processed_json#>>'{metadata,level}' level,
   left(coalesce(m.document_json->>'excerpt',m.document_json->>'body',m.raw_text,''),180) excerpt,
   (select coalesce(jsonb_agg(jsonb_build_object('name',a->>'name','kind',a->>'kind','hash',a->>'hash')),'[]') from jsonb_array_elements(case when jsonb_typeof(coalesce(m.document_json->'assets',m.processed_json#>'{metadata,composer,assets}','[]'))='array' then coalesce(m.document_json->'assets',m.processed_json#>'{metadata,composer,assets}','[]') else '[]'::jsonb end) a) assets,
   jsonb_array_length(case when jsonb_typeof(coalesce(m.document_json->'links',m.processed_json#>'{metadata,composer,links}','[]'))='array' then coalesce(m.document_json->'links',m.processed_json#>'{metadata,composer,links}','[]') else '[]'::jsonb end) link_count,
   b.created_at bookmarked_at,coalesce(rp.is_completed,false) completed
  from public.reading_materials m
  left join saved b on b.material_id=m.id
  left join public.reading_progress rp on rp.material_id=m.id and rp.user_id=(select id from me)
  where (m.owner_id=(select id from me) or (m.visibility='public' and (b.material_id is not null or exists(select 1 from recent r where r.context->>'materialId'=m.id::text) or exists(select 1 from members x where x.target_kind='material' and x.target_id=m.id::text))))
   and (coalesce(m.processed_json#>>'{metadata,composer,role}','')<>'study' or not exists(select 1 from public.reading_materials parent where parent.id::text=m.processed_json#>>'{metadata,composer,parentId}' and (parent.owner_id=(select id from me) or parent.visibility='public')))
 ), material_keys as (
  select m.*,case when nullif(meta#>>'{book,key}','') is not null and owner_id=(select id from me) then 'book'
   when source_pdf_id is not null and exists(select 1 from public.uploaded_pdfs p where p.id=source_pdf_id and p.owner_id=(select id from me)) then 'pdf' else 'material' end kind,
   case when nullif(meta#>>'{book,key}','') is not null and owner_id=(select id from me) then meta#>>'{book,key}'
   when source_pdf_id is not null and exists(select 1 from public.uploaded_pdfs p where p.id=source_pdf_id and p.owner_id=(select id from me)) then source_pdf_id::text else id::text end key,
   case when coalesce(meta#>>'{book,order}','') ~ '^[0-9]+([.][0-9]+)?$' then (meta#>>'{book,order}')::numeric else coalesce(page_start,2147483647) end order_key
  from material_base m
 ), grouped as (
  select kind,key,
   (array_agg(case when kind='book' then coalesce(nullif(meta#>>'{book,title}',''),title) else title end order by order_key,id))[1] title,
   (array_agg(language order by order_key,id))[1] language,(array_agg(level order by order_key,id))[1] level,
   min(case when owner_id=(select id from me) then created_at else coalesce(bookmarked_at,created_at) end) created_at,(array_agg(excerpt order by order_key,id))[1] excerpt,
   (array_agg(assets order by order_key,id))[1] assets,(array_agg(link_count order by order_key,id))[1] link_count,
   (array_agg(id::text order by order_key,id))[1] material_id,count(*) child_count,
   jsonb_agg(jsonb_build_object('id',id::text,'title',title,'language',language,'level',level,'assets',assets,'order',order_key) order by order_key,id) children,
   bool_and(direction='write' or status='note') is_note,bool_or(owner_id=(select id from me)) owned,
   bool_or((owner_id=(select id from me) and (title not ilike '[%#%]%' or meta#>>'{composer,version}'='1' or kind='book')) or bookmarked_at is not null) listed,bool_and(completed) completed,bool_or(status in ('error','failed')) failed
  from material_keys group by kind,key
 ), roots as (
  select g.kind,g.key,g.title,g.language,g.level,g.created_at,g.excerpt,g.assets,g.link_count,g.material_id,g.child_count,g.children,coalesce(g.is_note,false) is_note,g.owned,g.listed,g.completed,coalesce(g.failed,false) failed from grouped g where kind<>'pdf'
  union all
  select 'pdf',p.id::text,p.title,coalesce(p.language,p.lang),p.level,p.created_at,''::text,
   jsonb_build_array(jsonb_build_object('name',p.filename,'kind','pdf')),0,null::text,coalesce(g.child_count,0),coalesce(g.children,'[]'),false,true,true,false,false
  from public.uploaded_pdfs p left join grouped g on g.kind='pdf' and g.key=p.id::text where p.owner_id=(select id from me)
  union all
  select 'edition',e.edition_id,'일본어 N5', 'Japanese','N5',x.created_at,'', '[]'::jsonb,0,null::text,0,'[]'::jsonb,false,false,x.target_id is not null,false,false
  from public.textbook_book_editions e left join members x on x.target_kind='edition' and x.target_id=e.edition_id
  where e.book_id='japanese-n5' and (x.target_id is not null or exists(select 1 from recent r where r.target_kind='edition' and r.target_id=e.edition_id))
 )
 select b.kind,b.key,b.title,b.language,b.level,b.created_at,b.excerpt,
  (select coalesce(jsonb_agg(jsonb_build_object('name',a->>'name','kind',a->>'kind','hash',a->>'hash')),'[]') from jsonb_array_elements(b.assets) a),
  b.link_count,b.material_id,b.child_count,b.children,b.is_note,b.owned,b.listed or x.target_id is not null,b.completed,r.opened_at,r.context,b.failed,
  (b.kind='material' and b.owned and exists(select 1 from public.reading_materials m where m.id::text=b.material_id and m.processed_json#>>'{metadata,composer,version}'='1'))
 from roots b left join recent r on r.target_kind=b.kind and r.target_id=b.key left join members x on x.target_kind=b.kind and x.target_id=b.key
$$;
create or replace function public.library_catalog_rows()
returns table(target_kind text,target_id text,title text,language text,level text,created_at timestamptz,excerpt text,assets jsonb,link_count integer,material_id text,child_count bigint,children jsonb,is_note boolean,owned boolean,listed boolean,completed boolean,opened_at timestamptz,context jsonb,failed boolean,editable boolean)
language sql stable security invoker set search_path='' as $$
 select r.target_kind,r.target_id,coalesce(s.display_title,r.title),r.language,r.level,r.created_at,r.excerpt,r.assets,r.link_count,r.material_id,r.child_count,r.children,r.is_note,r.owned,r.listed,r.completed,r.opened_at,r.context,r.failed,r.editable from library_private.catalog_sources() r left join public.library_item_state s on s.owner_id=auth.uid() and s.target_kind=r.target_kind and s.target_id=r.target_id where coalesce(s.state,'active')='active'
$$;

create function library_private.managed_rows(p_filters jsonb default '{}') returns setof jsonb
language sql stable security invoker set search_path='' as $$
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
$$;

create function public.personal_library_page_v2(p_filters jsonb default '{}',p_offset integer default 0,p_limit integer default 20) returns jsonb
language sql stable security invoker set search_path='' as $$
 with rows as(select item from library_private.managed_rows(p_filters) item), page as (
 select item||jsonb_build_object('match_child',(
  select jsonb_build_object('id',c->>'id','title',c->>'title') from jsonb_array_elements(item->'children') c
  where coalesce(btrim(p_filters->>'query'),'')<>'' and strpos(lower(c->>'title'),lower(left(btrim(p_filters->>'query'),120)))>0
  order by coalesce((c->>'order')::numeric,0),c->>'id' limit 1
 )) item from rows order by
  case when p_filters->>'sort'='opened' or p_filters->>'recent'='true' then item->>'opened_at' end desc nulls last,
  case when p_filters->>'sort'='title' then lower(item->>'title') end,
  case when p_filters->>'sort'='level' then item->>'level' end,
  item->>'created_at' desc nulls last,item->>'target_kind',item->>'target_id'
 offset greatest(0,least(coalesce(p_offset,0),100000)) limit greatest(1,least(coalesce(p_limit,20),100)))
 select jsonb_build_object('total',(select count(*) from rows),'items',coalesce((select jsonb_agg(item-'children'-'listed') from page),'[]'))
$$;

-- The selection is frozen at click time. Future matches are not added to this manifest.
create function public.library_selection(p_filters jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare keys jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object('target_kind',r->>'target_kind','target_id',r->>'target_id','revision',r->'revision')),'[]') into keys
 from (select * from library_private.managed_rows(p_filters) limit 5001) q(r);
 if jsonb_array_length(keys)>5000 then raise exception 'library_selection_limit' using errcode='22023';end if;
 return keys;
end $$;

create table library_private.operations (
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 id uuid not null, payload jsonb not null, created_at timestamptz not null default now(),
 primary key(owner_id,id)
);
create table library_private.operation_items (
 owner_id uuid not null default auth.uid(),operation_id uuid not null,
 target_kind text not null,target_id text not null,expected_revision bigint not null,
 status text not null default 'pending',before_state jsonb,delta jsonb,after_revision bigint,
 primary key(owner_id,operation_id,target_kind,target_id),
 foreign key(owner_id,operation_id) references library_private.operations(owner_id,id) on delete cascade
);
alter table library_private.operations enable row level security;
alter table library_private.operation_items enable row level security;
create policy library_op_own on library_private.operations to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy library_op_item_own on library_private.operation_items to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
revoke all on library_private.operations,library_private.operation_items from public,anon;
grant select,insert,update,delete on library_private.operations,library_private.operation_items to authenticated;

create function public.library_operation_status(p_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',p_id,'action',o.payload->>'action','items',coalesce((select jsonb_agg(jsonb_build_object('target_kind',i.target_kind,'target_id',i.target_id,'status',i.status,'revision',i.after_revision) order by i.target_kind,i.target_id) from library_private.operation_items i where i.owner_id=auth.uid() and i.operation_id=p_id),'[]'))
 from library_private.operations o where o.owner_id=auth.uid() and o.id=p_id
$$;

create function public.library_operation_prepare(p_id uuid,p_action text,p_targets jsonb,p_options jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare payload jsonb; prior jsonb; t jsonb; canonical jsonb;
begin
 perform library_private.lock_owner();
 if p_action is null or p_targets is null or jsonb_typeof(p_options) is distinct from 'object' or p_action not in ('trash','restore','save','rename','favorite','add','move','remove') or jsonb_typeof(p_targets)<>'array' or jsonb_array_length(p_targets) not between 1 and 5000 then raise exception 'invalid_library_operation' using errcode='22023';end if;
 payload:=jsonb_build_object('action',p_action,'targets',p_targets,'options',p_options);
 select o.payload into prior from library_private.operations o where owner_id=auth.uid() and id=p_id;
 if prior is not null then
  if prior<>payload then raise exception 'library_request_conflict' using errcode='22023';end if;
  return public.library_operation_status(p_id);
 end if;
 -- Bounded, request-driven expiry; no scheduler or source data cleanup.
 delete from library_private.operations where owner_id=auth.uid() and id in (select id from library_private.operations where owner_id=auth.uid() and created_at<now()-interval '7 days' order by created_at limit 20);
 insert into library_private.operations(id,payload) values(p_id,payload);
 for t in select * from jsonb_array_elements(p_targets) loop
  canonical:=public.library_canonical_target(t->>'target_kind',t->>'target_id');
  if canonical is distinct from (t-'revision') or coalesce(t->>'revision','') !~ '^[0-9]{1,16}$' or t->>'target_kind' not in ('material','pdf','book','edition') or length(t->>'target_id') not between 1 and 200 then raise exception 'invalid_library_target' using errcode='22023';end if;
  insert into library_private.operation_items(operation_id,target_kind,target_id,expected_revision) values(p_id,t->>'target_kind',t->>'target_id',(t->>'revision')::bigint) on conflict do nothing;
 end loop;
 return public.library_operation_status(p_id);
end $$;

create function library_private.was_listed(p_kind text,p_id text) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.library_bookmarks where owner_id=auth.uid() and p_kind='material' and material_id::text=p_id)
 or exists(select 1 from public.library_collection_items x where x.owner_id=auth.uid() and x.target_kind=p_kind and x.target_id=p_id)
 or (p_kind in ('book','pdf') and public.library_target_accessible(p_kind,p_id))
 or (p_kind='material' and exists(select 1 from public.reading_materials where id=case when p_id ~ '^[0-9]{1,18}$' then p_id::bigint end and owner_id=auth.uid() and (title not ilike '[%#%]%' or processed_json#>>'{metadata,composer,version}'='1')))
$$;

create function public.library_operation_apply(p_id uuid,p_undo boolean default false) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare op library_private.operations; entry library_private.operation_items; s public.library_item_state;
 action text; opts jsonb; dest uuid; src uuid; v_delta jsonb; before_value jsonb; rev bigint; d jsonb;
begin
 perform library_private.lock_owner();
 select * into op from library_private.operations where owner_id=auth.uid() and id=p_id;
 if not found then raise exception 'library_operation_missing';end if;
 if op.created_at<now()-interval '7 days' then raise exception 'library_operation_expired';end if;
 action:=op.payload->>'action';opts:=op.payload->'options';
 dest:=nullif(opts->>'folder','')::uuid;src:=nullif(opts->>'source','')::uuid;
 for entry in select * from library_private.operation_items where owner_id=auth.uid() and operation_id=p_id and status=case when p_undo then 'success' else 'pending' end order by target_kind,target_id limit 100 loop
  begin
   select * into s from public.library_item_state where owner_id=auth.uid() and target_kind=entry.target_kind and target_id=entry.target_id;
   rev:=coalesce(s.revision,0);
   if rev<>(case when p_undo then entry.after_revision else entry.expected_revision end) then
    update library_private.operation_items set status=case when p_undo then 'undo_conflict' else 'conflict' end where owner_id=auth.uid() and operation_id=p_id and target_kind=entry.target_kind and target_id=entry.target_id;
    continue;
   end if;
   if not p_undo and op.created_at<now()-interval '30 minutes' then raise exception 'library_selection_expired';end if;
   if not p_undo and action<>'trash' and not public.library_target_accessible(entry.target_kind,entry.target_id) then raise exception 'library_source_unavailable' using errcode='42501';end if;
   if not p_undo and action not in ('save','restore','trash') and coalesce(s.state,'active')<>'active' then raise exception 'library_restore_required';end if;
   if p_undo then
    -- Restore only fields/memberships this action changed, guarded by the common item revision.
    before_value:=entry.before_state;
    update public.library_item_state set
     state=before_value->>'state',
     display_title=case when action='rename' then before_value->>'display_title' else display_title end,
     favorite=case when action='favorite' then (before_value->>'favorite')::boolean else favorite end
     where owner_id=auth.uid() and target_kind=entry.target_kind and target_id=entry.target_id;
    for d in select * from jsonb_array_elements(coalesce(entry.delta,'[]')) loop
     if d->>'type'='add' then
      delete from public.library_collection_items where owner_id=auth.uid() and collection_id=(d->>'folder')::uuid and target_kind=entry.target_kind and target_id=entry.target_id;
     elsif exists(select 1 from public.library_collections where owner_id=auth.uid() and id=(d->>'folder')::uuid and deleted_at is null) then
      insert into public.library_collection_items(collection_id,target_kind,target_id) values((d->>'folder')::uuid,entry.target_kind,entry.target_id) on conflict do nothing;
     end if;
    end loop;
   else
    before_value:=jsonb_build_object('state',coalesce(s.state,case when library_private.was_listed(entry.target_kind,entry.target_id) then 'active' else 'removed' end),'display_title',s.display_title,'favorite',coalesce(s.favorite,false));v_delta:='[]';
    if action in ('add','move') and not exists(select 1 from public.library_collections where owner_id=auth.uid() and id=dest and deleted_at is null) then raise exception 'library_folder_unavailable';end if;
    if action in ('move','remove') and not exists(select 1 from public.library_collection_items where owner_id=auth.uid() and collection_id=src and target_kind=entry.target_kind and target_id=entry.target_id) then raise exception 'library_membership_conflict';end if;
    if action='move' and dest=src then raise exception 'library_same_folder';end if;
    insert into public.library_item_state(target_kind,target_id,state,display_title,favorite) values(entry.target_kind,entry.target_id,
     case when action='trash' then 'trashed' when action in ('restore','save') then 'active' else coalesce(s.state,'active') end,
     case when action='rename' then nullif(btrim(opts->>'title'),'') else s.display_title end,
     case when action='favorite' then (opts->>'value')::boolean else coalesce(s.favorite,false) end)
    on conflict(owner_id,target_kind,target_id) do update set state=excluded.state,display_title=excluded.display_title,favorite=excluded.favorite;
    if action in ('add','move') and not exists(select 1 from public.library_collection_items where owner_id=auth.uid() and collection_id=dest and target_kind=entry.target_kind and target_id=entry.target_id) then
     insert into public.library_collection_items(collection_id,target_kind,target_id) values(dest,entry.target_kind,entry.target_id);
     v_delta:=v_delta||jsonb_build_array(jsonb_build_object('type','add','folder',dest));
    end if;
    if action in ('move','remove') then
     delete from public.library_collection_items where owner_id=auth.uid() and collection_id=src and target_kind=entry.target_kind and target_id=entry.target_id;
     v_delta:=v_delta||jsonb_build_array(jsonb_build_object('type','remove','folder',src));
    end if;
   end if;
   select revision into rev from public.library_item_state where owner_id=auth.uid() and target_kind=entry.target_kind and target_id=entry.target_id;
   update library_private.operation_items set status=case when p_undo then 'undone' else 'success' end,
    before_state=case when p_undo then before_state else before_value end,delta=case when p_undo then operation_items.delta else v_delta end,after_revision=rev
    where owner_id=auth.uid() and operation_id=p_id and target_kind=entry.target_kind and target_id=entry.target_id;
  exception when insufficient_privilege then
   update library_private.operation_items set status=case when p_undo then 'undo_unavailable' else 'unavailable' end where owner_id=auth.uid() and operation_id=p_id and target_kind=entry.target_kind and target_id=entry.target_id;
  when check_violation or not_null_violation or invalid_text_representation or raise_exception then
   update library_private.operation_items set status=case when p_undo then 'undo_conflict' else 'conflict' end where owner_id=auth.uid() and operation_id=p_id and target_kind=entry.target_kind and target_id=entry.target_id;
  end;
 end loop;
 return public.library_operation_status(p_id);
end $$;

create table library_private.folder_operations (
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,id uuid not null,payload jsonb not null,
 before_rows jsonb not null,after_rows jsonb not null,undone boolean not null default false,created_at timestamptz not null default now(),primary key(owner_id,id)
);
alter table library_private.folder_operations enable row level security;
create policy library_folder_op_own on library_private.folder_operations to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
revoke all on library_private.folder_operations from public,anon;
grant select,insert,update,delete on library_private.folder_operations to authenticated;

create function public.library_folder_change(p_request uuid,p_action text,p_id uuid,p_revision bigint default 0,p_name text default null,p_parent uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare current public.library_collections; prior library_private.folder_operations; payload jsonb; before_value jsonb; after_value jsonb; ids uuid[]; row_value jsonb;
begin
 perform library_private.lock_owner();
 payload:=jsonb_build_object('action',p_action,'id',p_id,'revision',p_revision,'name',p_name,'parent',p_parent);
 select * into prior from library_private.folder_operations where owner_id=auth.uid() and id=p_request;
 if found then if prior.payload<>payload then raise exception 'library_request_conflict';end if;return jsonb_build_object('id',p_request,'folders',prior.after_rows);end if;
 select * into current from public.library_collections where owner_id=auth.uid() and id=p_id;
 if p_action='create' then
  if current.id is not null then raise exception 'library_folder_conflict';end if;
  before_value:='[]';ids:=array[p_id];
  insert into public.library_collections(id,name,parent_id) values(p_id,p_name,p_parent);
 else
  if current.id is null or current.deleted_at is not null or current.revision<>p_revision then raise exception 'library_folder_conflict';end if;
  if p_action='trash' then
   with recursive tree as(select id from public.library_collections where owner_id=auth.uid() and id=p_id union all select c.id from public.library_collections c join tree t on c.parent_id=t.id where c.owner_id=auth.uid() and c.deleted_at is null) select array_agg(id) into ids from tree;
  else ids:=array[p_id];end if;
  select jsonb_agg(to_jsonb(c)) into before_value from public.library_collections c where owner_id=auth.uid() and id=any(ids);
  if p_action='trash' then update public.library_collections set deleted_at=clock_timestamp() where owner_id=auth.uid() and id=any(ids);
  elsif p_action='rename' then update public.library_collections set name=p_name where owner_id=auth.uid() and id=p_id;
  elsif p_action='move' then update public.library_collections set parent_id=p_parent where owner_id=auth.uid() and id=p_id;
  else raise exception 'invalid_library_folder_action';end if;
 end if;
 select jsonb_agg(to_jsonb(c)) into after_value from public.library_collections c where owner_id=auth.uid() and id=any(ids);
 insert into library_private.folder_operations(id,payload,before_rows,after_rows) values(p_request,payload,before_value,after_value);
 return jsonb_build_object('id',p_request,'folders',after_value);
end $$;

create function public.library_folder_undo(p_request uuid) returns void language plpgsql security invoker set search_path='' as $$
declare op library_private.folder_operations; r jsonb; parent uuid; todo jsonb;
begin
 perform library_private.lock_owner();
 select * into op from library_private.folder_operations where owner_id=auth.uid() and id=p_request;
 if not found or op.created_at<now()-interval '7 days' then raise exception 'library_operation_expired';end if;
 if op.undone then return;end if;
 for r in select * from jsonb_array_elements(op.after_rows) loop
  if not exists(select 1 from public.library_collections where owner_id=auth.uid() and id=(r->>'id')::uuid and revision=(r->>'revision')::bigint) then raise exception 'library_folder_conflict';end if;
 end loop;
 if op.payload->>'action'='create' then
  if exists(select 1 from public.library_collections where owner_id=auth.uid() and parent_id=(op.payload->>'id')::uuid and deleted_at is null) or exists(select 1 from public.library_collection_items where owner_id=auth.uid() and collection_id=(op.payload->>'id')::uuid) then raise exception 'library_folder_conflict';end if;
  update public.library_collections set deleted_at=clock_timestamp() where owner_id=auth.uid() and id=(op.payload->>'id')::uuid;
 else
  todo:=op.before_rows;
  -- Parent-first restoration. Deleted/moved parents outside this operation cause a conflict.
  while jsonb_array_length(todo)>0 loop
   select x into r from jsonb_array_elements(todo) x where not exists(select 1 from jsonb_array_elements(todo) p where p->>'id'=x->>'parent_id') limit 1;
   if r is null then raise exception 'library_folder_cycle';end if;
   update public.library_collections set name=r->>'name',parent_id=(r->>'parent_id')::uuid,deleted_at=(r->>'deleted_at')::timestamptz where owner_id=auth.uid() and id=(r->>'id')::uuid;
   select coalesce(jsonb_agg(x),'[]') into todo from jsonb_array_elements(todo) x where x->>'id'<>r->>'id';
  end loop;
 end if;
 update library_private.folder_operations set undone=true where owner_id=auth.uid() and id=p_request;
end $$;

-- These private functions/tables are not exposed through PostgREST. Invoker grants + RLS are both required.
revoke all on all functions in schema library_private from public,anon;
grant execute on all functions in schema library_private to authenticated;
revoke all on function public.library_canonical_target(text,text),public.personal_library_page_v2(jsonb,integer,integer),public.library_selection(jsonb),public.library_operation_status(uuid),public.library_operation_prepare(uuid,text,jsonb,jsonb),public.library_operation_apply(uuid,boolean),public.library_folder_change(uuid,text,uuid,bigint,text,uuid),public.library_folder_undo(uuid) from public,anon;
grant execute on function public.library_canonical_target(text,text),public.personal_library_page_v2(jsonb,integer,integer),public.library_selection(jsonb),public.library_operation_status(uuid),public.library_operation_prepare(uuid,text,jsonb,jsonb),public.library_operation_apply(uuid,boolean),public.library_folder_change(uuid,text,uuid,bigint,text,uuid),public.library_folder_undo(uuid) to authenticated;

-- Old browser tabs must not cascade-delete reading records. Administrative server maintenance
-- and account removal run with their existing server role; this does not grant a new bypass.
create function library_private.protect_source_delete() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_user='authenticated' then raise exception 'library_use_trash: 내 서재에서 휴지통으로 이동해 주세요.' using errcode='42501';end if;
 return old;
end $$;
revoke all on function library_private.protect_source_delete() from public,anon;
create trigger library_protect_material_delete before delete on public.reading_materials for each row execute function library_private.protect_source_delete();
create trigger library_protect_pdf_delete before delete on public.uploaded_pdfs for each row execute function library_private.protect_source_delete();
-- The legacy PDF path removes Storage objects BEFORE its DB row. Preserve referenced originals
-- and thumbnails; unreferenced failed-upload cleanup remains available through existing policies.
create policy library_preserve_pdf_files on storage.objects as restrictive for delete to authenticated
 using(bucket_id<>'user-pdfs' or not exists(select 1 from public.uploaded_pdfs p where p.owner_id=(select auth.uid()) and (p.storage_path=name or p.thumbnail_path=name)));

-- Older readers use the same lifecycle and active-folder boundary.
create or replace function public.personal_library_page(p_query text default '',p_language text default '',p_kind text default '',p_collection uuid default null,p_sort text default 'newest',p_state text default '',p_level text default '',p_offset integer default 0,p_limit integer default 20,p_recent boolean default false,p_pinned text[] default null)
returns jsonb language sql stable security invoker set search_path='' as $$
 with args as(select lower(left(btrim(coalesce(p_query,'')),120)) q), filtered as (
  select r.*, (
   select jsonb_build_object('id',c->>'id','title',c->>'title') from jsonb_array_elements(r.children) c
   where (select q from args)<>'' and strpos(lower(c->>'title'),(select q from args))>0 order by coalesce((c->>'order')::numeric,0),c->>'id' limit 1
  ) match_child
  from public.library_catalog_rows() r
  where (case when p_recent then r.opened_at is not null else r.listed end)
  and (p_collection is null or exists(select 1 from public.library_collection_items x where x.owner_id=(select auth.uid()) and x.collection_id=p_collection and exists(select 1 from public.library_collections c where c.owner_id=x.owner_id and c.id=x.collection_id and c.deleted_at is null) and x.target_kind=r.target_kind and x.target_id=r.target_id))
  and (coalesce(p_language,'')='' or (p_language='unknown' and coalesce(r.language,'')='') or r.language=p_language or exists(select 1 from jsonb_array_elements(r.children) c where c->>'language'=p_language))
  and (coalesce(p_level,'')='' or r.level=p_level or exists(select 1 from jsonb_array_elements(r.children) c where c->>'level'=p_level))
  and (coalesce(p_kind,'')='' or (p_kind='note' and r.is_note) or (p_kind='book' and r.target_kind in ('book','edition')) or (p_kind='link' and r.link_count>0) or (p_kind='text' and r.excerpt<>'') or exists(select 1 from jsonb_array_elements(r.assets) a where a->>'kind'=p_kind))
  and (coalesce(p_state,'')='' or (p_state='unread' and not r.completed) or (p_state='completed' and r.completed) or (p_state='opened' and r.opened_at is not null))
  and (p_pinned is null or r.material_id=any(p_pinned) or exists(select 1 from jsonb_array_elements(r.children) c where c->>'id'=any(p_pinned)))
  and ((select q from args)='' or strpos(lower(r.title),(select q from args))>0 or exists(select 1 from jsonb_array_elements(r.assets) a where strpos(lower(a->>'name'),(select q from args))>0) or exists(select 1 from jsonb_array_elements(r.children) c where strpos(lower(c->>'title'),(select q from args))>0 or exists(select 1 from jsonb_array_elements(c->'assets') a where strpos(lower(a->>'name'),(select q from args))>0)))
 ), page as (
  select * from filtered order by
   case when p_recent or p_sort='opened' then opened_at end desc nulls last,
   case when p_sort='title' then lower(title) end asc,
   case when p_sort='level' then level end asc nulls last,
   created_at desc nulls last,target_kind,target_id
  offset greatest(0,least(coalesce(p_offset,0),100000)) limit greatest(1,least(coalesce(p_limit,20),50))
 ) select jsonb_build_object('total',(select count(*) from filtered),'unavailable',(select count(*) from (select target_kind,target_id from public.library_collection_items where owner_id=(select auth.uid()) and (p_collection is null or collection_id=p_collection) union select 'material',material_id::text from public.library_bookmarks where owner_id=(select auth.uid()) and p_collection is null) refs where not public.library_target_accessible(target_kind,target_id) and not exists(select 1 from public.library_item_state s where s.owner_id=auth.uid() and s.target_kind=refs.target_kind and s.target_id=refs.target_id and s.state<>'active')),'items',coalesce((select jsonb_agg(to_jsonb(p)-'children'-'listed'-'ord' order by ord) from (select page.*,row_number() over() ord from page) p),'[]'))
$$;
revoke all on function public.personal_library_page(text,text,text,uuid,text,text,text,integer,integer,boolean,text[]) from public,anon;
grant execute on function public.personal_library_page(text,text,text,uuid,text,text,text,integer,integer,boolean,text[]) to authenticated;
