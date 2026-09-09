-- 운영 적용은 사용자 명시 승인 후. 기존 단어/FSRS 값은 변경하지 않는다.
begin;

-- 2026-09-05 읽기 전용 점검: permissive SELECT true 정책이 공존함.
-- 기존 정책을 삭제하지 않고 비공개 자료의 공개 읽기를 제한한다. 관리자 열람은 유지.
create policy learning_material_visibility_guard on public.reading_materials
  as restrictive for select to anon, authenticated
  using (visibility = 'public' or owner_id = (select auth.uid()) or (select public.is_admin()));

create table public.textbook_material_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  lang text not null check (lang in ('Japanese','Chinese','English','French')),
  chapter_slug text not null check (length(chapter_slug) between 1 and 160),
  material_id bigint references public.reading_materials(id) on delete cascade,
  pdf_id uuid references public.uploaded_pdfs(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (num_nonnulls(material_id,pdf_id) = 1),
  unique (user_id,lang,chapter_slug,material_id),
  unique (user_id,lang,chapter_slug,pdf_id)
);
create index textbook_material_links_reading on public.textbook_material_links(material_id,user_id);
create index textbook_material_links_pdf on public.textbook_material_links(pdf_id,user_id);
alter table public.textbook_material_links enable row level security;
create policy textbook_material_links_read on public.textbook_material_links for select to authenticated using (
  user_id = (select auth.uid()) and (
    exists(select 1 from public.reading_materials m where m.id=material_id and (m.owner_id=(select auth.uid()) or m.visibility='public'))
    or exists(select 1 from public.uploaded_pdfs p where p.id=pdf_id and p.owner_id=(select auth.uid()))
  )
);
create policy textbook_material_links_insert on public.textbook_material_links for insert to authenticated with check (
  user_id = (select auth.uid()) and (
    exists(select 1 from public.reading_materials m where m.id=material_id and (m.owner_id=(select auth.uid()) or m.visibility='public'))
    or exists(select 1 from public.uploaded_pdfs p where p.id=pdf_id and p.owner_id=(select auth.uid()))
  )
);
create policy textbook_material_links_delete on public.textbook_material_links for delete to authenticated using (user_id=(select auth.uid()));
-- Supabase의 기본 ALL 권한(특히 RLS 대상이 아닌 TRUNCATE)을 먼저 회수한다.
revoke all on public.textbook_material_links from public,anon,authenticated;
grant select,insert,delete on public.textbook_material_links to authenticated;

create table public.vocabulary_contexts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  vocabulary_id uuid not null references public.user_vocabulary(id) on delete cascade,
  kind text not null check (kind in ('textbook','reading','pdf')),
  lang text not null check (lang in ('Japanese','Chinese','English','French')),
  chapter_slug text,
  material_id bigint references public.reading_materials(id) on delete cascade,
  pdf_id uuid references public.uploaded_pdfs(id) on delete cascade,
  locator jsonb not null default '{}' check (jsonb_typeof(locator)='object'),
  quote text not null check (length(quote) between 1 and 4000),
  translation text not null default '' check (length(translation)<=2000),
  source_key text not null,
  created_at timestamptz not null default now(),
  check ((kind='textbook' and chapter_slug is not null and material_id is null and pdf_id is null)
    or (kind='reading' and material_id is not null and chapter_slug is null and pdf_id is null)
    or (kind='pdf' and pdf_id is not null and chapter_slug is null and material_id is null)),
  unique(user_id,vocabulary_id,source_key)
);
create index vocabulary_contexts_vocab on public.vocabulary_contexts(vocabulary_id,user_id,created_at);
create index vocabulary_contexts_material on public.vocabulary_contexts(material_id);
create index vocabulary_contexts_pdf on public.vocabulary_contexts(pdf_id);
alter table public.vocabulary_contexts enable row level security;
create policy vocabulary_contexts_read on public.vocabulary_contexts for select to authenticated using (
  user_id=(select auth.uid()) and exists(select 1 from public.user_vocabulary v where v.id=vocabulary_id and v.user_id=(select auth.uid())) and (
    kind='textbook'
    or exists(select 1 from public.reading_materials m where m.id=material_id and (m.owner_id=(select auth.uid()) or m.visibility='public'))
    or exists(select 1 from public.uploaded_pdfs p where p.id=pdf_id and p.owner_id=(select auth.uid()))
  )
);
create policy vocabulary_contexts_insert on public.vocabulary_contexts for insert to authenticated with check (
  user_id=(select auth.uid()) and exists(select 1 from public.user_vocabulary v where v.id=vocabulary_id and v.user_id=(select auth.uid()) and v.language=lang) and (
    kind='textbook'
    or exists(select 1 from public.reading_materials m where m.id=material_id and (m.owner_id=(select auth.uid()) or m.visibility='public'))
    or exists(select 1 from public.uploaded_pdfs p where p.id=pdf_id and p.owner_id=(select auth.uid()))
  )
);
create policy vocabulary_contexts_delete on public.vocabulary_contexts for delete to authenticated using (user_id=(select auth.uid()));
revoke all on public.vocabulary_contexts from public,anon,authenticated;
grant select,insert,delete on public.vocabulary_contexts to authenticated;

-- 단어 등록과 문맥 연결을 한 트랜잭션에서 수행한다. 기존 행은 SELECT만 하고 수정하지 않는다.
-- 다른 뜻은 자동 합치지 않는다. 확인한 기존 ID/뜻이 모두 일치할 때만 연결을 허용한다.
create function public.save_vocabulary_context(p_word jsonb, p_source jsonb,
  p_confirm_id uuid default null, p_confirm_meaning text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v public.user_vocabulary%rowtype;
  who uuid := auth.uid();
  created boolean := false;
  added integer;
  matches integer;
  word text := btrim(p_word->>'word_text');
  meaning text := btrim(p_word->>'meaning');
begin
  if who is null then raise exception 'login_required' using errcode='42501'; end if;
  if word is null or length(word) not between 1 and 300 or meaning is null or length(meaning) not between 1 and 2000
    or p_word->>'language' is null or p_word->>'language' not in ('Japanese','Chinese','English','French')
    or p_source->>'kind' is null or p_source->>'kind' not in ('textbook','reading','pdf')
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
revoke all on function public.save_vocabulary_context(jsonb,jsonb,uuid,text) from public,anon;
grant execute on function public.save_vocabulary_context(jsonb,jsonb,uuid,text) to authenticated;
commit;
