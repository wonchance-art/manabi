-- Add only the reviewed N3 book ID. Preserve N5/N4 editions, publication
-- pointers, learner data, RLS, function owner/security/search_path and ACLs.
-- This block is atomic and fails closed on an unexpected starting contract.
do $n3$
declare
 table_name text;
 constraint_name text;
 definition text;
 body text;
 access_before jsonb;
 catalog_before jsonb;
 security_after jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('textbook-book-support',0));
 perform set_config('lock_timeout','5s',true);

 select jsonb_build_object('owner',p.proowner,'definer',p.prosecdef,'config',p.proconfig,'acl',p.proacl)
 into access_before from pg_proc p where p.oid='public.library_target_accessible(text,text)'::regprocedure;
 select jsonb_build_object('owner',p.proowner,'definer',p.prosecdef,'config',p.proconfig,'acl',p.proacl)
 into catalog_before from pg_proc p where p.oid='library_private.catalog_sources()'::regprocedure;

 foreach table_name in array array['textbook_book_drafts','textbook_book_editions','textbook_book_releases'] loop
  constraint_name:=table_name || '_book_id_check';
  select pg_get_constraintdef(c.oid) into definition from pg_constraint c
   where c.conrelid=('public.'||table_name)::regclass and c.conname=constraint_name;
  if definition is distinct from 'CHECK ((book_id = ANY (ARRAY[''japanese-n5''::text, ''japanese-n4''::text])))' then
   raise exception 'n3_constraint_precondition: %',table_name;
  end if;
  execute format('alter table public.%I drop constraint %I, add constraint %I check (book_id in (''japanese-n5'',''japanese-n4'',''japanese-n3''))',table_name,constraint_name,constraint_name);
 end loop;

 select pg_get_functiondef(p.oid),p.prosrc into definition,body from pg_proc p
  where p.oid='public.library_target_accessible(text,text)'::regprocedure;
 if md5(body) is distinct from '393e7fcb2fb64d210e4d3bb21c8d1e7b'
  or position('e.book_id in (''japanese-n5'',''japanese-n4'')' in definition)=0 then
  raise exception 'n3_access_function_precondition';
 end if;
 definition:=replace(definition,'e.book_id in (''japanese-n5'',''japanese-n4'')','e.book_id in (''japanese-n5'',''japanese-n4'',''japanese-n3'')');
 execute definition;

 select pg_get_functiondef(p.oid),p.prosrc into definition,body from pg_proc p
  where p.oid='library_private.catalog_sources()'::regprocedure;
 if md5(body) is distinct from '94f6115c6629680125080ac143e6fdf1'
  or position('e.book_id in (''japanese-n5'',''japanese-n4'')' in definition)=0
  or position('case e.book_id when ''japanese-n4'' then ''N4'' else ''N5'' end' in definition)=0 then
  raise exception 'n3_catalog_function_precondition';
 end if;
 definition:=replace(definition,'e.book_id in (''japanese-n5'',''japanese-n4'')','e.book_id in (''japanese-n5'',''japanese-n4'',''japanese-n3'')');
 definition:=replace(definition,'case e.book_id when ''japanese-n4'' then ''N4'' else ''N5'' end','case e.book_id when ''japanese-n3'' then ''N3'' when ''japanese-n4'' then ''N4'' else ''N5'' end');
 execute definition;

 select jsonb_build_object('owner',p.proowner,'definer',p.prosecdef,'config',p.proconfig,'acl',p.proacl)
 into security_after from pg_proc p where p.oid='public.library_target_accessible(text,text)'::regprocedure;
 if access_before is null or security_after is distinct from access_before then
  raise exception 'n3_access_security_preservation';
 end if;
 select jsonb_build_object('owner',p.proowner,'definer',p.prosecdef,'config',p.proconfig,'acl',p.proacl)
 into security_after from pg_proc p where p.oid='library_private.catalog_sources()'::regprocedure;
 if catalog_before is null or security_after is distinct from catalog_before then
  raise exception 'n3_catalog_security_preservation';
 end if;
end $n3$;
