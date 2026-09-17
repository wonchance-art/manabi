-- Run only after explicit hosted-DB approval. No credentials or real user rows.
-- All fixture inserts/updates are inside an exception subtransaction that is
-- deliberately rolled back. Unexpected failures abort the statement as well.
do $qa$
declare
 teacher uuid:=gen_random_uuid(); student uuid:=gen_random_uuid(); other_student uuid:=gen_random_uuid();
 root_id bigint:=8000000000000000+floor(random()*1000000000)::bigint;
 source_id bigint; personal_id bigint; pdf_id uuid:=gen_random_uuid();
 team_key text:='qa-'||left(gen_random_uuid()::text,10);
 source_json jsonb; source_ref jsonb; changed_json jsonb;
 word jsonb:='{"word_text":"学习","meaning":"공부하다","furigana":"xué xí","language":"Chinese","pos":"동사"}';
 initial jsonb:='{"interval":8,"ease_factor":2,"repetitions":0,"next_review_at":"2030-01-01T00:00:00Z"}';
 first_result jsonb; result jsonb; original_word jsonb; legacy_kind text; legacy_source jsonb;
 passed text[]:='{}'; rolled_back boolean:=false;
begin
 source_id:=root_id+1; personal_id:=root_id+2;
 source_json:=jsonb_build_object('metadata',jsonb_build_object('language','Chinese','book',jsonb_build_object('key',team_key)),
  'sequence',jsonb_build_array('id_0_one'),'dictionary',jsonb_build_object('id_0_one',jsonb_build_object('text','学习','meaning','공부하다')));
 source_ref:=jsonb_build_object('kind','class','quote','学习','translation','공부하다',
  'locator',jsonb_build_object('team',team_key,'materialId',source_id::text,'tokenId','id_0_one','surface','学习'));
 begin
  insert into auth.users(id) values(teacher),(student),(other_student);
  insert into public.reading_materials(id,owner_id,title,raw_text,visibility,processed_json) overriding system value values
   (root_id,teacher,'transaction-only QA root','root','private',jsonb_build_object('metadata',jsonb_build_object('team',jsonb_build_object('root',true,'key',team_key,'bookKey',team_key,'pwGen',1)))),
   (source_id,teacher,'transaction-only QA source','学习','private',source_json),
   (personal_id,student,'transaction-only QA private','mine','private','{}');
  insert into public.uploaded_pdfs(id,owner_id,title,filename,storage_path)
   values(pdf_id,student,'transaction-only QA','qa.pdf','transaction-only/qa.pdf');
  perform set_config('request.jwt.claim.sub',student::text,true);
  execute 'set local role service_role';
  first_result:=public.classroom_save_vocabulary(student,root_id,1,source_id,'学习',source_json,word,source_ref,initial);
  assert (first_result->>'created')::boolean and (first_result->>'contextAdded')::boolean,'first save';
  assert (first_result#>>'{word,interval}')::numeric=8 and first_result#>>'{word,source_material_id}' is null,'grade/source';
  select to_jsonb(v) into original_word from public.user_vocabulary v where v.id=(first_result->>'vocabularyId')::uuid;
  passed:=array_append(passed,'atomic word/context/initial grade');
  result:=public.classroom_save_vocabulary(student,root_id,1,source_id,'学习',source_json,word,source_ref,initial);
  assert not (result->>'created')::boolean and not (result->>'contextAdded')::boolean,'idempotency';
  assert (select to_jsonb(v)=original_word from public.user_vocabulary v where v.id=(first_result->>'vocabularyId')::uuid),'retry SRS';
  passed:=array_append(passed,'retry preserves the entire personal card');
  execute 'set local role authenticated';
  assert (select count(*)=0 from public.reading_materials where id in(root_id,source_id)),'teacher source privacy';
  assert (select count(*)=1 from public.reading_materials where owner_id=student),'no copied material';
  assert (select count(*)=1 from public.vocabulary_contexts where user_id=student and kind='class'),'own context read';
  begin
   perform public.classroom_save_vocabulary(student,root_id,1,source_id,'学习',source_json,word,source_ref);
   raise exception 'student called service-only RPC';
  exception when insufficient_privilege then null; end;
  begin
   perform public.save_vocabulary_context_for(other_student,word,jsonb_build_object('kind','textbook','chapterSlug','n5-01','quote','学习'));
   raise exception 'student forged another owner';
  exception when insufficient_privilege then null; end;
  begin
   perform public.save_vocabulary_context(word,source_ref);
   raise exception 'student forged class context through old RPC';
  exception when insufficient_privilege then null; end;
  begin
   insert into public.vocabulary_contexts(user_id,vocabulary_id,kind,lang,locator,quote,source_key)
    values(student,(first_result->>'vocabularyId')::uuid,'class','Chinese',source_ref->'locator','学习','forged');
   raise exception 'student directly inserted class context';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',other_student::text,true);
  assert (select count(*)=0 from public.vocabulary_contexts where user_id=student),'cross-account excerpt';
  assert (select count(*)=0 from public.user_vocabulary where user_id=student),'cross-account vocabulary';
  passed:=array_append(passed,'source/owner/context RLS and service-only writes');
  perform set_config('request.jwt.claim.sub',student::text,true);
  execute 'reset role';
  changed_json:=jsonb_set(source_json,'{dictionary,id_0_one,meaning}','"본받다"');
  update public.reading_materials set processed_json=changed_json where id=source_id;
  execute 'set local role service_role';
  begin
   perform public.classroom_save_vocabulary(student,root_id,1,source_id,'学习',source_json,word,source_ref);
   raise exception 'stale source accepted';
  exception when serialization_failure then null; end;
  begin
   perform public.classroom_save_vocabulary(student,root_id,1,source_id,'学习',changed_json,word||'{"meaning":"본받다"}',source_ref);
   raise exception 'personal meaning overwritten';
  exception when raise_exception then if sqlerrm<>'vocabulary_meaning_conflict' then raise; end if; end;
  result:=public.classroom_save_vocabulary(student,root_id,1,source_id,'学习',changed_json,word||'{"meaning":"본받다"}',source_ref,initial,(first_result->>'vocabularyId')::uuid,'공부하다');
  assert not (result->>'created')::boolean,'existing word confirmation';
  assert (select to_jsonb(v)=original_word from public.user_vocabulary v where v.id=(first_result->>'vocabularyId')::uuid),'confirmed meaning/SRS preserved';
  passed:=array_append(passed,'stale source/meaning conflict/explicit confirmation');
  begin
   perform public.classroom_save_vocabulary(student,root_id,2,source_id,'学习',changed_json,word,source_ref);
   raise exception 'revoked password generation accepted';
  exception when insufficient_privilege then null; end;
  begin
   perform public.classroom_save_vocabulary(student,root_id,1,personal_id,'mine','{}',word,source_ref);
   raise exception 'outside source accepted';
  exception when insufficient_privilege then null; end;
  passed:=array_append(passed,'revoked capability and outside material rejected');
  execute 'set local role authenticated';
  foreach legacy_kind in array array['textbook','reading','pdf'] loop
   legacy_source:=jsonb_build_object('kind',legacy_kind,'quote','기존 문맥') || case legacy_kind
    when 'textbook' then jsonb_build_object('chapterSlug','n5-01')
    when 'reading' then jsonb_build_object('materialId',personal_id::text)
    else jsonb_build_object('pdfId',pdf_id) end;
   result:=public.save_vocabulary_context(word||jsonb_build_object('word_text','qa-'||legacy_kind),legacy_source);
   assert (result->>'created')::boolean and (result->>'contextAdded')::boolean,'legacy RPC compatibility';
  end loop;
  passed:=array_append(passed,'existing textbook/reading/PDF save compatibility');
  execute 'reset role';
  delete from public.reading_materials where id=source_id;
  execute 'set local role authenticated';
  assert (select count(*)=1 from public.vocabulary_contexts where user_id=student and kind='class'),'excerpt survives source deletion';
  assert (select to_jsonb(v)=original_word from public.user_vocabulary v where v.id=(first_result->>'vocabularyId')::uuid),'card survives source deletion';
  passed:=array_append(passed,'source deletion preserves the student card/excerpt');
  raise exception using errcode='PZ901',message='rollback all synthetic QA rows';
 exception when sqlstate 'PZ901' then rolled_back:=true;
 end;
 assert rolled_back,'fixture rollback';
 assert not exists(select 1 from auth.users where id in(teacher,student,other_student)),'auth cleanup';
 assert not exists(select 1 from public.profiles where id in(teacher,student,other_student)),'profile cleanup';
 assert not exists(select 1 from public.reading_materials where id in(root_id,source_id,personal_id)),'material cleanup';
 assert not exists(select 1 from public.user_vocabulary where user_id in(teacher,student,other_student)),'vocabulary cleanup';
 assert not exists(select 1 from public.vocabulary_contexts where user_id in(teacher,student,other_student)),'context cleanup';
 assert not exists(select 1 from public.uploaded_pdfs where id=pdf_id),'PDF cleanup';
 perform set_config('manabi.qa_direct_result',jsonb_build_object('checks',passed,'count',cardinality(passed),'fixtureRowsRemaining',0,'existingPersonalRowsModified',0)::text,true);
end $qa$;
select current_setting('manabi.qa_direct_result')::jsonb as verification;
