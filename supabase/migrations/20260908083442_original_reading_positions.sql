-- Original reading locations are independent from reading_progress and vocabulary/FSRS.
create table public.original_reading_positions (
 owner_id uuid not null references auth.users(id) on delete cascade,
 material_id bigint not null references public.reading_materials(id) on delete cascade,
 source_key text not null,
 source jsonb not null check(jsonb_typeof(source)='object' and octet_length(source::text)<=1024),
 locator jsonb not null check(jsonb_typeof(locator)='object' and octet_length(locator::text)<=4096),
 version bigint not null default 1 check(version>0),
 write_id uuid not null,
 updated_at timestamptz not null default clock_timestamp(),
 primary key(owner_id,material_id,source_key)
);
create index original_reading_positions_recent on public.original_reading_positions(owner_id,material_id,version desc);
alter table public.original_reading_positions enable row level security;
revoke all on public.original_reading_positions from public,anon,authenticated;
grant select,insert,update on public.original_reading_positions to authenticated;
create policy original_positions_own on public.original_reading_positions for all to authenticated
 using(owner_id=(select auth.uid()) and exists(select 1 from public.reading_materials m where m.id=material_id and m.owner_id=(select auth.uid()) and m.visibility='private' and m.processed_json#>>'{metadata,composer,version}'='1' and m.processed_json#>>'{metadata,composer,role}' is distinct from 'study'))
 with check(owner_id=(select auth.uid()) and exists(select 1 from public.reading_materials m where m.id=material_id and m.owner_id=(select auth.uid()) and m.visibility='private' and m.processed_json#>>'{metadata,composer,version}'='1' and m.processed_json#>>'{metadata,composer,role}' is distinct from 'study'));

create function public.original_position_source_key(p_source jsonb) returns text
 language sql immutable security invoker set search_path=pg_catalog as $$
 select case when p_source->>'kind'='body' then 'body:'||coalesce(p_source->>'revision','original')
 when p_source->>'kind' in ('pdf','epub') then 'asset:'||(p_source->>'assetHash') else null end
$$;
revoke all on function public.original_position_source_key(jsonb) from public,anon;
grant execute on function public.original_position_source_key(jsonb) to authenticated;

create function public.validate_original_reading_position() returns trigger
 language plpgsql security invoker set search_path=pg_catalog,public as $$
declare
 m public.reading_materials; d jsonb; a jsonb; kind text:=new.source->>'kind';
begin
 if current_setting('manabi.original_position_write',true) is distinct from 'on' then raise exception 'POSITION_USE_RPC' using errcode='42501'; end if;
 if new.owner_id is distinct from auth.uid() then raise exception 'POSITION_ACCESS' using errcode='42501'; end if;
 select * into m from public.reading_materials where id=new.material_id and owner_id=auth.uid() and visibility='private' for update;
 if not found or m.processed_json#>>'{metadata,composer,version}' is distinct from '1' or m.processed_json#>>'{metadata,composer,role}'='study' then raise exception 'POSITION_ACCESS' using errcode='42501'; end if;
 d:=coalesce(m.document_json,jsonb_build_object('revision',null,'body',m.raw_text,'assets',m.processed_json#>'{metadata,composer,assets}'));
 if kind is null or kind not in ('body','pdf','epub') or new.source_key is distinct from public.original_position_source_key(new.source) then raise exception 'POSITION_INVALID' using errcode='22023'; end if;
 if kind='body' then
  if new.source-array['kind','revision']<>'{}'::jsonb or (new.source->>'revision') is distinct from (d->>'revision') then raise exception 'POSITION_SOURCE_CHANGED' using errcode='22023'; end if;
  if jsonb_typeof(new.locator->'offset') is distinct from 'number' or new.locator-array['offset']<>'{}'::jsonb or coalesce(new.locator->>'offset','')!~'^[0-9]{1,7}$' or (new.locator->>'offset')::bigint>char_length(coalesce(d->>'body','')) or length(trim(coalesce(d->>'body','')))=0 then raise exception 'POSITION_INVALID' using errcode='22023'; end if;
 else
  if new.source-array['kind','assetHash']<>'{}'::jsonb or coalesce(new.source->>'assetHash','')!~'^[a-f0-9]{64}$' then raise exception 'POSITION_INVALID' using errcode='22023'; end if;
  select x into a from jsonb_array_elements(coalesce(d->'assets','[]')||coalesce(d->'retainedAssets','[]')) x where x->>'hash'=new.source->>'assetHash' and x->>'kind'=kind limit 1;
  if a is null then raise exception 'POSITION_SOURCE_CHANGED' using errcode='22023'; end if;
  if kind='pdf' then
   if jsonb_typeof(new.locator->'page') is distinct from 'number' or new.locator-array['page']<>'{}'::jsonb or coalesce(new.locator->>'page','')!~'^[1-9][0-9]{0,5}$' then raise exception 'POSITION_INVALID' using errcode='22023'; end if;
  else
   if jsonb_typeof(new.locator->'chapter') is distinct from 'number' or jsonb_typeof(new.locator->'spineIndex') is distinct from 'number' or jsonb_typeof(new.locator->'offset') is distinct from 'number' or new.locator-array['chapter','spinePath','spineIndex','offset']<>'{}'::jsonb
    or coalesce(new.locator->>'chapter','')!~'^[1-9][0-9]{0,5}$'
    or coalesce(new.locator->>'spineIndex','')!~'^[0-9]{1,6}$'
    or coalesce(new.locator->>'offset','')!~'^[0-9]{1,8}$'
    or jsonb_typeof(new.locator->'spinePath') is distinct from 'string'
    or char_length(new.locator->>'spinePath') not between 1 and 2048
    or (new.locator->>'spinePath')~'[[:cntrl:]]' then raise exception 'POSITION_INVALID' using errcode='22023'; end if;
  end if;
 end if;
 if tg_op='UPDATE' then
  if (new.owner_id,new.material_id,new.source_key,new.source) is distinct from (old.owner_id,old.material_id,old.source_key,old.source) then raise exception 'POSITION_IDENTITY' using errcode='22023'; end if;
 end if;
 select coalesce(max(version),0)+1 into new.version from public.original_reading_positions where owner_id=new.owner_id and material_id=new.material_id;
 new.updated_at:=clock_timestamp();
 return new;
end $$;
revoke all on function public.validate_original_reading_position() from public,anon,authenticated;
create trigger validate_original_reading_position before insert or update on public.original_reading_positions for each row execute function public.validate_original_reading_position();

create function public.save_original_reading_position(p_owner uuid,p_material bigint,p_source jsonb,p_locator jsonb,p_version bigint,p_write uuid) returns jsonb
 language plpgsql security invoker set search_path=pg_catalog,public as $$
declare k text:=public.original_position_source_key(p_source); r public.original_reading_positions; h public.original_reading_positions; m public.reading_materials;
begin
 if p_owner is distinct from auth.uid() or auth.uid() is null then raise exception 'POSITION_ACCESS' using errcode='42501'; end if;
 if k is null or p_write is null or p_version is null or p_version<0 or p_version>9007199254740990 then raise exception 'POSITION_INVALID' using errcode='22023'; end if;
 -- The parent lock serializes all sources of this original, including first inserts.
 select * into m from public.reading_materials where id=p_material and owner_id=p_owner and visibility='private' for update;
 if not found or m.processed_json#>>'{metadata,composer,version}' is distinct from '1' or m.processed_json#>>'{metadata,composer,role}'='study' then raise exception 'POSITION_ACCESS' using errcode='42501'; end if;
 select * into h from public.original_reading_positions where owner_id=p_owner and material_id=p_material order by version desc limit 1;
 select * into r from public.original_reading_positions where owner_id=p_owner and material_id=p_material and source_key=k;
 if r.write_id=p_write then
  if r.locator is distinct from p_locator or r.source is distinct from p_source then raise exception 'POSITION_WRITE_CHANGED' using errcode='22023'; end if;
  return jsonb_build_object('saved',true,'record',to_jsonb(r),'head',to_jsonb(h));
 end if;
 if coalesce(h.version,0)<>p_version then return jsonb_build_object('saved',false,'record',to_jsonb(h)); end if;
 perform set_config('manabi.original_position_write','on',true);
 insert into public.original_reading_positions(owner_id,material_id,source_key,source,locator,write_id)
 values(p_owner,p_material,k,p_source,p_locator,p_write)
 on conflict(owner_id,material_id,source_key) do update set locator=excluded.locator,write_id=excluded.write_id
 returning * into r;
 return jsonb_build_object('saved',true,'record',to_jsonb(r),'head',to_jsonb(r));
end $$;
revoke all on function public.save_original_reading_position(uuid,bigint,jsonb,jsonb,bigint,uuid) from public,anon;
grant execute on function public.save_original_reading_position(uuid,bigint,jsonb,jsonb,bigint,uuid) to authenticated;

create function public.get_original_reading_positions(p_owner uuid,p_material bigint,p_keys text[]) returns jsonb
 language plpgsql stable security invoker set search_path=pg_catalog,public as $$
begin
 if p_owner is distinct from auth.uid() or auth.uid() is null or not exists(select 1 from public.reading_materials m where m.id=p_material and m.owner_id=p_owner and m.visibility='private' and m.processed_json#>>'{metadata,composer,version}'='1' and m.processed_json#>>'{metadata,composer,role}' is distinct from 'study') then raise exception 'POSITION_ACCESS' using errcode='42501'; end if;
 if p_keys is null or cardinality(p_keys)>100 then raise exception 'POSITION_INVALID' using errcode='22023'; end if;
 return jsonb_build_object('head',(select to_jsonb(p) from public.original_reading_positions p where owner_id=p_owner and material_id=p_material order by version desc limit 1),'records',coalesce((select jsonb_agg(to_jsonb(p) order by version desc) from public.original_reading_positions p where owner_id=p_owner and material_id=p_material and source_key=any(p_keys)),'[]'));
end $$;
revoke all on function public.get_original_reading_positions(uuid,bigint,text[]) from public,anon;
grant execute on function public.get_original_reading_positions(uuid,bigint,text[]) to authenticated;
