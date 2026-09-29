-- Approval required before applying to the hosted database. No existing material or SRS updates.
begin;
alter table public.vocabulary_contexts drop constraint vocabulary_contexts_kind_check;
alter table public.vocabulary_contexts add constraint vocabulary_contexts_kind_check check(kind in ('textbook','reading','pdf','class'));
alter table public.vocabulary_contexts drop constraint vocabulary_contexts_check;
alter table public.vocabulary_contexts add constraint vocabulary_contexts_check check(
 (kind='textbook' and chapter_slug is not null and material_id is null and pdf_id is null) or
 (kind='reading' and material_id is not null and chapter_slug is null and pdf_id is null) or
 (kind='pdf' and pdf_id is not null and chapter_slug is null and material_id is null) or
 (kind='class' and num_nonnulls(chapter_slug,material_id,pdf_id)=0
  and coalesce(locator->>'team','') ~ '^[a-z0-9][a-z0-9-]{0,15}$'
  and coalesce(locator->>'materialId','') ~ '^[1-9][0-9]{0,15}$'));
-- Saved excerpts belong to the student even after the source is removed. Opening
-- the original still requires a fresh class capability; no source row RLS is relaxed.
create policy vocabulary_class_context_read on public.vocabulary_contexts for select to authenticated using (
 kind='class' and user_id=(select auth.uid()) and exists(
 select 1 from public.user_vocabulary v where v.id=vocabulary_id and v.user_id=(select auth.uid())));
-- Only the authenticated class API may insert class contexts. Existing policies do not permit them.
grant select,insert on public.vocabulary_contexts to service_role;
create function public.save_vocabulary_context_for(p_owner uuid, p_word jsonb, p_source jsonb,
  p_confirm_id uuid default null, p_confirm_meaning text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v public.user_vocabulary%rowtype;
  who uuid := p_owner;
  created boolean := false;
  added integer;
  matches integer;
  word text := btrim(p_word->>'word_text');
  meaning text := btrim(p_word->>'meaning');
begin
  if who is null or (current_user <> 'service_role' and (who is distinct from auth.uid() or p_source->>'kind'='class')) then raise exception 'login_required' using errcode='42501'; end if;
  if word is null or length(word) not between 1 and 300 or meaning is null or length(meaning) not between 1 and 2000
    or p_word->>'language' is null or p_word->>'language' not in ('Japanese','Chinese','English','French')
    or p_source->>'kind' is null or p_source->>'kind' not in ('textbook','reading','pdf','class')
    then raise exception 'invalid_context' using errcode='22023'; end if;

  -- 예전 뷰어가 활용형(word_text=books, base_form=book)으로 저장한 카드도 재사용한다.
  -- 후보가 여러 개면 추측해서 새 카드를 만들거나 임의로 합치지 않는다.
  select * into v from public.user_vocabulary where user_id=who and word_text=word for update;
  if not found then
    select count(*) into matches from public.user_vocabulary where user_id=who and language=p_word->>'language' and base_form=word;
    if matches > 1 then raise exception 'vocabulary_ambiguous_match'; end if;
    if matches = 1 then
      select * into v from public.user_vocabulary where user_id=who and language=p_word->>'language' and base_form=word for update;
    end if;
  end if;
  if v.id is null then
    insert into public.user_vocabulary(user_id,word_text,base_form,meaning,furigana,pos,language,source_sentence,source_material_id,next_review_at)
    values(who,word,word,meaning,coalesce(p_word->>'furigana',''),coalesce(p_word->>'pos',''),p_word->>'language',p_source->>'quote',
      case when p_source->>'kind'='reading' then (p_source->>'materialId')::bigint end,now())
    on conflict(user_id,word_text) do nothing returning * into v;
    created := found;
  end if;
  if not created and v.id is null then
    select * into v from public.user_vocabulary where user_id=who and word_text=word for update;
    if not found then raise exception 'word_not_available'; end if;
  end if;
  if not created then
    if v.language is distinct from p_word->>'language' then raise exception 'vocabulary_language_conflict'; end if;
    if btrim(coalesce(v.meaning,'')) <> meaning and not (
      p_confirm_id is not null and v.id=p_confirm_id and v.meaning is not distinct from p_confirm_meaning
    ) then raise exception 'vocabulary_meaning_conflict' using detail=v.id::text; end if;
  end if;

  insert into public.vocabulary_contexts(user_id,vocabulary_id,kind,lang,chapter_slug,material_id,pdf_id,locator,quote,translation,source_key)
  values(who,v.id,p_source->>'kind',p_word->>'language',p_source->>'chapterSlug',
    (p_source->>'materialId')::bigint,(p_source->>'pdfId')::uuid,coalesce(p_source->'locator','{}'::jsonb),
    p_source->>'quote',coalesce(p_source->>'translation',''),
    md5((p_source - 'translation')::text))
  on conflict(user_id,vocabulary_id,source_key) do nothing;
  get diagnostics added = row_count;
  return jsonb_build_object('vocabularyId',v.id,'created',created,'contextAdded',added>0);
end $$;

revoke all on function public.save_vocabulary_context_for(uuid,jsonb,jsonb,uuid,text) from public,anon;
grant execute on function public.save_vocabulary_context_for(uuid,jsonb,jsonb,uuid,text) to authenticated,service_role;
create or replace function public.save_vocabulary_context(p_word jsonb,p_source jsonb,p_confirm_id uuid default null,p_confirm_meaning text default null)
returns jsonb language sql security invoker set search_path='' as $$
 select public.save_vocabulary_context_for(auth.uid(),p_word,p_source,p_confirm_id,p_confirm_meaning);
$$;
-- Service-only, invoker (no privilege escalation). The API verifies identity and
-- signed team capability; these locks recheck membership, password generation and
-- the exact source read before writing the word+context in one transaction.
create function public.classroom_save_vocabulary(p_owner uuid,p_root bigint,p_generation integer,p_material bigint,
 p_expected_raw text,p_expected_json jsonb,p_word jsonb,p_source jsonb,p_initial jsonb default null,
 p_confirm_id uuid default null,p_confirm_meaning text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.reading_materials%rowtype; src public.reading_materials%rowtype; result jsonb;
begin
 if current_user <> 'service_role' or p_owner is null then raise exception 'login_required' using errcode='42501'; end if;
 select * into r from public.reading_materials where id=p_root and processed_json#>>'{metadata,team,root}'='true' for share;
 if not found or coalesce((r.processed_json#>>'{metadata,team,pwGen}')::integer,0) is distinct from p_generation then raise exception 'class_access_changed' using errcode='42501'; end if;
 select * into src from public.reading_materials where id=p_material and owner_id=r.owner_id for share;
 if not found or (
  (r.processed_json#>>'{metadata,team,bookKey}' is not null and src.processed_json#>>'{metadata,book,key}'=r.processed_json#>>'{metadata,team,bookKey}') or
  (src.processed_json#>>'{metadata,team,key}'=r.processed_json#>>'{metadata,team,key}' and src.processed_json#>>'{metadata,team,root}' is distinct from 'true' and src.processed_json#>>'{metadata,team,day}' is not null)
 ) is not true then raise exception 'class_material_unavailable' using errcode='42501'; end if;
 if src.raw_text is distinct from p_expected_raw or src.processed_json is distinct from p_expected_json then raise exception 'source_changed' using errcode='40001'; end if;
 if p_source->>'kind' is distinct from 'class' or p_source#>>'{locator,team}' is distinct from r.processed_json#>>'{metadata,team,key}'
 or p_source#>>'{locator,materialId}' is distinct from p_material::text then raise exception 'invalid_context' using errcode='22023'; end if;
 result:=public.save_vocabulary_context_for(p_owner,p_word,p_source,p_confirm_id,p_confirm_meaning);
 if (result->>'created')::boolean and p_initial is not null then
  if jsonb_typeof(p_initial)<>'object' or (p_initial->>'interval')::numeric not between 0.01 and 36500
   or (p_initial->>'ease_factor')::numeric not between 1 and 10 or (p_initial->>'repetitions')::integer<0
   or p_initial->>'next_review_at' is null then raise exception 'invalid_initial_grade' using errcode='22023'; end if;
  update public.user_vocabulary set interval=(p_initial->>'interval')::numeric,ease_factor=(p_initial->>'ease_factor')::numeric,
   repetitions=(p_initial->>'repetitions')::integer,next_review_at=(p_initial->>'next_review_at')::timestamptz
   where id=(result->>'vocabularyId')::uuid and user_id=p_owner;
 end if;
 if (result->>'created')::boolean then
  result:=result||jsonb_build_object('word',(select to_jsonb(v) from public.user_vocabulary v where v.id=(result->>'vocabularyId')::uuid and v.user_id=p_owner));
 end if;
 return result;
end $$;
revoke all on function public.classroom_save_vocabulary(uuid,bigint,integer,bigint,text,jsonb,jsonb,jsonb,jsonb,uuid,text) from public,anon,authenticated;
grant execute on function public.classroom_save_vocabulary(uuid,bigint,integer,bigint,text,jsonb,jsonb,jsonb,jsonb,uuid,text) to service_role;
commit;
