-- Add the reviewed N4 course without changing ownership, RLS, existing editions,
-- publication pointers or personal study records. Run as one migration/transaction.
-- Unknown constraint/function versions abort instead of overwriting another change.
do $n4$
declare table_name text; constraint_name text; definition text;
begin
 foreach table_name in array array['textbook_book_drafts','textbook_book_editions','textbook_book_releases'] loop
  constraint_name := table_name || '_book_id_check';
  select pg_get_constraintdef(c.oid) into definition from pg_constraint c
   where c.conrelid=('public.'||table_name)::regclass and c.conname=constraint_name;
  if definition is distinct from 'CHECK ((book_id = ''japanese-n5''::text))' then
   raise exception 'n4_constraint_precondition: %', table_name;
  end if;
  execute format('alter table public.%I drop constraint %I, add constraint %I check (book_id in (''japanese-n5'',''japanese-n4''))',table_name,constraint_name,constraint_name);
 end loop;
end $n4$;

do $n4$
declare definition text; body text;
begin
 select pg_get_functiondef(p.oid),p.prosrc into definition,body from pg_proc p
  where p.oid='public.library_target_accessible(text,text)'::regprocedure;
 if md5(body)<>'c7d79a46ace1456881db64fd584afa01' then raise exception 'n4_access_function_precondition'; end if;
 definition:=replace(definition,'e.book_id=''japanese-n5''','e.book_id in (''japanese-n5'',''japanese-n4'')');
 execute definition;

 select pg_get_functiondef(p.oid),p.prosrc into definition,body from pg_proc p
  where p.oid='library_private.catalog_sources()'::regprocedure;
 if md5(body)<>'93af7fe51e578a7e48aabdc452be572f' then raise exception 'n4_catalog_function_precondition'; end if;
 definition:=replace(definition,'e.book_id=''japanese-n5''','e.book_id in (''japanese-n5'',''japanese-n4'')');
 definition:=replace(definition,'''일본어 N5'', ''Japanese'',''N5''',
  '''일본어 '' || case e.book_id when ''japanese-n4'' then ''N4'' else ''N5'' end, ''Japanese'',case e.book_id when ''japanese-n4'' then ''N4'' else ''N5'' end');
 execute definition;
end $n4$;
