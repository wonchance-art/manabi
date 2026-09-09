-- A draft is private. Rendering and publishing are separate, explicit operations.
create table public.textbook_book_drafts (
  book_id text primary key check (book_id = 'japanese-n5'),
  manuscript jsonb not null check (jsonb_typeof(manuscript) = 'object'),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  version bigint not null default 1 check (version > 0),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
create table public.textbook_book_editions (
  book_id text not null check (book_id = 'japanese-n5'),
  edition_id text not null check (edition_id ~ '^[a-f0-9]{24}$'),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  manuscript jsonb not null check (jsonb_typeof(manuscript) = 'object'),
  artifact_manifest jsonb not null check (jsonb_typeof(artifact_manifest) = 'object'),
  published_by uuid not null references auth.users(id),
  published_at timestamptz not null default now(),
  primary key(book_id, edition_id)
);
create table public.textbook_book_releases (
  book_id text primary key check (book_id = 'japanese-n5'),
  edition_id text not null,
  version bigint not null default 1 check (version > 0),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  foreign key(book_id,edition_id) references public.textbook_book_editions(book_id,edition_id)
);
alter table public.textbook_book_drafts enable row level security;
alter table public.textbook_book_editions enable row level security;
alter table public.textbook_book_releases enable row level security;
revoke all on public.textbook_book_drafts,public.textbook_book_editions,public.textbook_book_releases from public,anon,authenticated;
grant select,insert,update on public.textbook_book_drafts to authenticated;
grant select on public.textbook_book_editions,public.textbook_book_releases to anon,authenticated;
grant insert on public.textbook_book_editions to authenticated;
grant insert,update on public.textbook_book_releases to authenticated;
create policy textbook_draft_admin on public.textbook_book_drafts for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy textbook_editions_read on public.textbook_book_editions for select to anon,authenticated using (true);
create policy textbook_editions_insert on public.textbook_book_editions for insert to authenticated with check ((select public.is_admin()) and published_by=(select auth.uid()));
create policy textbook_releases_read on public.textbook_book_releases for select to anon,authenticated using (true);
create policy textbook_releases_insert on public.textbook_book_releases for insert to authenticated with check ((select public.is_admin()) and updated_by=(select auth.uid()));
create policy textbook_releases_update on public.textbook_book_releases for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()) and updated_by=(select auth.uid()));
-- Atomic draft CAS prevents two browser tabs from overwriting each other's work.
create function public.save_textbook_book_draft(p_book_id text,p_manuscript jsonb,p_content_hash text,p_expected_version bigint)
returns public.textbook_book_drafts language plpgsql security invoker set search_path='' as $$
declare result public.textbook_book_drafts;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_book_id,0));
 if p_expected_version is null then
  begin
   insert into public.textbook_book_drafts(book_id,manuscript,content_hash,updated_by) values(p_book_id,p_manuscript,p_content_hash,auth.uid()) returning * into result;
  exception when unique_violation then raise exception 'draft_conflict' using errcode='40001'; end;
 else
  update public.textbook_book_drafts set manuscript=p_manuscript,content_hash=p_content_hash,version=version+1,updated_by=auth.uid(),updated_at=clock_timestamp() where book_id=p_book_id and version=p_expected_version returning * into result;
  if not found then raise exception 'draft_conflict' using errcode='40001'; end if;
 end if;
 return result;
end $$;
-- Publication inserts an immutable snapshot and advances a separately versioned pointer.
-- Re-selecting an old edition restores the pointer without overwriting its manuscript.
create function public.publish_textbook_book(p_book_id text,p_edition_id text,p_content_hash text,p_manuscript jsonb,p_artifact_manifest jsonb,p_expected_draft_version bigint,p_expected_release_version bigint,p_restore boolean default false)
returns public.textbook_book_releases language plpgsql security invoker set search_path='' as $$
declare draft public.textbook_book_drafts; result public.textbook_book_releases; existing public.textbook_book_editions;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
 -- Serialize first publication as well as subsequent pointer updates.
 perform pg_advisory_xact_lock(hashtextextended(p_book_id,0));
 if not p_restore then
  select * into draft from public.textbook_book_drafts where book_id=p_book_id for update;
  if (p_expected_draft_version is null and found) or (p_expected_draft_version is not null and (not found or draft.version<>p_expected_draft_version or draft.content_hash<>p_content_hash)) then raise exception 'draft_conflict' using errcode='40001'; end if;
 end if;
 select * into existing from public.textbook_book_editions where book_id=p_book_id and edition_id=p_edition_id;
 if found then
  if existing.content_hash<>p_content_hash or existing.manuscript<>p_manuscript or existing.artifact_manifest<>p_artifact_manifest then raise exception 'immutable_edition' using errcode='40001'; end if;
 else
  if p_restore then raise exception 'edition_not_found' using errcode='22023'; end if;
  insert into public.textbook_book_editions(book_id,edition_id,content_hash,manuscript,artifact_manifest,published_by) values(p_book_id,p_edition_id,p_content_hash,p_manuscript,p_artifact_manifest,auth.uid());
 end if;
 if p_expected_release_version is null then
  begin
   insert into public.textbook_book_releases(book_id,edition_id,updated_by) values(p_book_id,p_edition_id,auth.uid()) returning * into result;
  exception when unique_violation then raise exception 'release_conflict' using errcode='40001'; end;
 else
  update public.textbook_book_releases set edition_id=p_edition_id,version=version+1,updated_by=auth.uid(),updated_at=clock_timestamp() where book_id=p_book_id and version=p_expected_release_version returning * into result;
  if not found then raise exception 'release_conflict' using errcode='40001'; end if;
 end if;
 return result;
end $$;
revoke all on function public.save_textbook_book_draft(text,jsonb,text,bigint) from public,anon,authenticated;
revoke all on function public.publish_textbook_book(text,text,text,jsonb,jsonb,bigint,bigint,boolean) from public,anon,authenticated;
grant execute on function public.save_textbook_book_draft(text,jsonb,text,bigint) to authenticated;
grant execute on function public.publish_textbook_book(text,text,text,jsonb,jsonb,bigint,bigint,boolean) to authenticated;
