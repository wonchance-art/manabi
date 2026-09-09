-- Personal organization is a reference layer. It never owns the source or its learning records.
create function public.library_target_accessible(p_kind text,p_id text)
returns boolean language sql stable security invoker set search_path='' as $$
 select (select auth.uid()) is not null and case p_kind
 when 'material' then exists(select 1 from public.reading_materials m where m.id=case when p_id ~ '^[0-9]{1,18}$' then p_id::bigint end and (m.owner_id=(select auth.uid()) or m.visibility='public'))
 when 'pdf' then exists(select 1 from public.uploaded_pdfs p where p.id::text=p_id and p.owner_id=(select auth.uid()))
 when 'book' then exists(select 1 from public.reading_materials m where m.processed_json#>>'{metadata,book,key}'=p_id and m.owner_id=(select auth.uid()))
 when 'edition' then exists(select 1 from public.textbook_book_editions e where e.book_id='japanese-n5' and e.edition_id=p_id)
 else false end
$$;
revoke all on function public.library_target_accessible(text,text) from public,anon;
grant execute on function public.library_target_accessible(text,text) to authenticated;

create index library_material_book_idx on public.reading_materials(owner_id,(processed_json#>>'{metadata,book,key}')) where processed_json#>>'{metadata,book,key}' is not null;

create table public.library_collections (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 80),
 created_at timestamptz not null default now(),
 unique(owner_id,id)
);
create table public.library_collection_items (
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 collection_id uuid not null,
 target_kind text not null check(target_kind in ('material','pdf','book','edition')),
 target_id text not null check(length(target_id) between 1 and 180),
 created_at timestamptz not null default now(),
 primary key(owner_id,collection_id,target_kind,target_id),
 foreign key(owner_id,collection_id) references public.library_collections(owner_id,id) on delete cascade
);
create index library_collection_target_idx on public.library_collection_items(owner_id,target_kind,target_id);
create table public.library_bookmarks (
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 material_id bigint not null references public.reading_materials(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(owner_id,material_id)
);
create index library_bookmarks_material_idx on public.library_bookmarks(material_id);
create table public.library_reading_activity (
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 target_kind text not null check(target_kind in ('material','pdf','book','edition')),
 target_id text not null check(length(target_id) between 1 and 180),
 context jsonb not null default '{}' check(jsonb_typeof(context)='object' and octet_length(context::text)<=1000),
 opened_at timestamptz not null default clock_timestamp(),
 primary key(owner_id,target_kind,target_id)
);
create index library_reading_recent_idx on public.library_reading_activity(owner_id,opened_at desc);

alter table public.library_collections enable row level security;
alter table public.library_collection_items enable row level security;
alter table public.library_bookmarks enable row level security;
alter table public.library_reading_activity enable row level security;
revoke all on public.library_collections,public.library_collection_items,public.library_bookmarks,public.library_reading_activity from public,anon,authenticated;
grant select,insert,update,delete on public.library_collections to authenticated;
grant select,insert,delete on public.library_collection_items,public.library_bookmarks to authenticated;
grant select,insert,update on public.library_reading_activity to authenticated;
create policy library_collections_own on public.library_collections for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy library_items_read on public.library_collection_items for select to authenticated using(owner_id=(select auth.uid()));
create policy library_items_add on public.library_collection_items for insert to authenticated with check(owner_id=(select auth.uid()) and public.library_target_accessible(target_kind,target_id));
create policy library_items_remove on public.library_collection_items for delete to authenticated using(owner_id=(select auth.uid()));
create policy library_bookmarks_read on public.library_bookmarks for select to authenticated using(owner_id=(select auth.uid()));
create policy library_bookmarks_add on public.library_bookmarks for insert to authenticated with check(owner_id=(select auth.uid()) and exists(select 1 from public.reading_materials m where m.id=material_id and m.visibility='public'));
create policy library_bookmarks_remove on public.library_bookmarks for delete to authenticated using(owner_id=(select auth.uid()));
create policy library_activity_read on public.library_reading_activity for select to authenticated using(owner_id=(select auth.uid()) and public.library_target_accessible(target_kind,target_id));
create policy library_activity_add on public.library_reading_activity for insert to authenticated with check(owner_id=(select auth.uid()) and public.library_target_accessible(target_kind,target_id));
create policy library_activity_update on public.library_reading_activity for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()) and public.library_target_accessible(target_kind,target_id));

-- Client clocks, titles, locations and arbitrary navigation URLs never enter the recent-open index.
create function public.validate_library_activity() returns trigger language plpgsql security invoker set search_path='' as $$
declare m public.reading_materials; c jsonb; expected_kind text; expected_id text;
begin
 if new.context - array['materialId','mode','assetHash','revision','page'] <> '{}'::jsonb then raise exception 'invalid_library_context' using errcode='22023'; end if;
 if new.target_kind in ('material','book') or (new.target_kind='pdf' and new.context ? 'materialId') then
  select * into m from public.reading_materials where id::text=new.context->>'materialId' and (owner_id=auth.uid() or visibility='public');
  if not found then raise exception 'library_source_unavailable' using errcode='42501'; end if;
  c=m.processed_json#>'{metadata,composer}';
  if c->>'role'='study' then
   expected_kind='material'; expected_id=c->>'parentId';
  elsif nullif(m.processed_json#>>'{metadata,book,key}','') is not null and m.owner_id=auth.uid() then
   expected_kind='book'; expected_id=m.processed_json#>>'{metadata,book,key}';
  elsif m.source_pdf_id is not null and exists(select 1 from public.uploaded_pdfs p where p.id=m.source_pdf_id and p.owner_id=auth.uid()) then
   expected_kind='pdf'; expected_id=m.source_pdf_id::text;
  else expected_kind='material'; expected_id=m.id::text; end if;
  if new.target_kind<>expected_kind or new.target_id<>expected_id then raise exception 'invalid_library_target' using errcode='22023'; end if;
  if new.context->>'mode' not in ('text','study','original') or new.context->>'mode' is null then raise exception 'invalid_library_mode' using errcode='22023'; end if;
  if new.context ? 'assetHash' and not exists(select 1 from jsonb_array_elements(case when jsonb_typeof(coalesce(m.document_json->'assets',c->'assets','[]'))='array' then coalesce(m.document_json->'assets',c->'assets','[]') else '[]'::jsonb end) a where a->>'hash'=new.context->>'assetHash') then raise exception 'invalid_library_asset' using errcode='22023'; end if;
 elsif new.target_kind='pdf' then
  if new.context<>'{}'::jsonb then raise exception 'invalid_library_context' using errcode='22023'; end if;
 elsif new.target_kind='edition' then
  if new.context - 'page'<>'{}'::jsonb or coalesce(new.context->>'page','') !~ '^u(0[1-9]|[1-3][0-9]|4[0-2])(-[a-z0-9_-]+)?$' then raise exception 'invalid_library_page' using errcode='22023'; end if;
 end if;
 new.opened_at=clock_timestamp();
 return new;
end $$;
revoke all on function public.validate_library_activity() from public,anon,authenticated;
create trigger library_activity_context before insert or update on public.library_reading_activity for each row execute function public.validate_library_activity();

-- Narrow projections stay inside Postgres. No processed token JSON or private storage path is returned.
create function public.library_catalog_rows()
returns table(target_kind text,target_id text,title text,language text,level text,created_at timestamptz,excerpt text,assets jsonb,link_count integer,material_id text,child_count bigint,children jsonb,is_note boolean,owned boolean,listed boolean,completed boolean,opened_at timestamptz,context jsonb,failed boolean,editable boolean)
language sql stable security invoker set search_path='' as $$
 with me as (select auth.uid() id), saved as (
  select material_id,created_at from public.library_bookmarks where owner_id=(select id from me)
 ), members as (
  select target_kind,target_id,min(created_at) created_at from public.library_collection_items where owner_id=(select id from me) group by target_kind,target_id
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
   min(coalesce(bookmarked_at,created_at)) created_at,(array_agg(excerpt order by order_key,id))[1] excerpt,
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
revoke all on function public.library_catalog_rows() from public,anon,authenticated;
-- Internal helper is also security-invoker and contains only the caller's accessible roots.
grant execute on function public.library_catalog_rows() to authenticated;

create function public.personal_library_page(p_query text default '',p_language text default '',p_kind text default '',p_collection uuid default null,p_sort text default 'newest',p_state text default '',p_level text default '',p_offset integer default 0,p_limit integer default 20,p_recent boolean default false,p_pinned text[] default null)
returns jsonb language sql stable security invoker set search_path='' as $$
 with args as(select lower(left(btrim(coalesce(p_query,'')),120)) q), filtered as (
  select r.*, (
   select jsonb_build_object('id',c->>'id','title',c->>'title') from jsonb_array_elements(r.children) c
   where (select q from args)<>'' and strpos(lower(c->>'title'),(select q from args))>0 order by coalesce((c->>'order')::numeric,0),c->>'id' limit 1
  ) match_child
  from public.library_catalog_rows() r
  where (case when p_recent then r.opened_at is not null else r.listed end)
  and (p_collection is null or exists(select 1 from public.library_collection_items x where x.owner_id=(select auth.uid()) and x.collection_id=p_collection and x.target_kind=r.target_kind and x.target_id=r.target_id))
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
 ) select jsonb_build_object('total',(select count(*) from filtered),'unavailable',(select count(*) from (select target_kind,target_id from public.library_collection_items where owner_id=(select auth.uid()) and (p_collection is null or collection_id=p_collection) union select 'material',material_id::text from public.library_bookmarks where owner_id=(select auth.uid()) and p_collection is null) refs where not public.library_target_accessible(target_kind,target_id)),'items',coalesce((select jsonb_agg(to_jsonb(p)-'children'-'listed'-'ord' order by ord) from (select page.*,row_number() over() ord from page) p),'[]'))
$$;
revoke all on function public.personal_library_page(text,text,text,uuid,text,text,text,integer,integer,boolean,text[]) from public,anon;
grant execute on function public.personal_library_page(text,text,text,uuid,text,text,text,integer,integer,boolean,text[]) to authenticated;

create function public.personal_library_children(p_kind text,p_id text,p_offset integer default 0)
returns jsonb language sql stable security invoker set search_path='' as $$
 with root as(select children from public.library_catalog_rows() where target_kind=p_kind and target_id=p_id), items as (
 select jsonb_build_object('id',c->>'id','title',c->>'title','language',c->>'language') item from root,jsonb_array_elements(children) with ordinality as a(c,n) order by n offset greatest(0,coalesce(p_offset,0)) limit 20
 ) select jsonb_build_object('total',coalesce((select jsonb_array_length(children) from root),0),'items',coalesce((select jsonb_agg(item) from items),'[]'))
$$;
revoke all on function public.personal_library_children(text,text,integer) from public,anon;
grant execute on function public.personal_library_children(text,text,integer) to authenticated;
