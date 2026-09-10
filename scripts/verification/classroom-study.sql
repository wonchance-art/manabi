-- Owner-authorized verification: isolated rows, no existing class or vocabulary edits.
BEGIN;
SET LOCAL statement_timeout='20s';
DO $$
DECLARE teacher uuid;
BEGIN
 SELECT owner_id INTO teacher FROM public.reading_materials WHERE processed_json#>>'{metadata,team,root}'='true' ORDER BY id LIMIT 1;
 IF teacher IS NULL THEN RAISE EXCEPTION 'An existing teacher is required';END IF;
 PERFORM set_config('request.jwt.claim.sub',teacher::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE root_id bigint;source_id bigint;op uuid:=gen_random_uuid();r jsonb;again jsonb;seed jsonb;rejected boolean;
 key text:='qa-'||substr(replace(gen_random_uuid()::text,'-',''),1,10);
BEGIN
 INSERT INTO public.reading_materials(owner_id,title,raw_text,visibility,processed_json)
 VALUES(auth.uid(),'수업 학습 검수 · 롤백','root','private',jsonb_build_object('metadata',jsonb_build_object('language','Chinese','team',jsonb_build_object('root',true,'key',key,'name','검수','lang','Chinese','pwGen',1,'bookKey',key)))) RETURNING id INTO root_id;
 INSERT INTO public.reading_materials(owner_id,title,raw_text,visibility,lesson_explanation_ko,conversation_script,processed_json)
 VALUES(auth.uid(),'교재 검수 · 롤백','图书馆','private','보존할 해설','보존할 대화',jsonb_build_object('status','completed','sequence',jsonb_build_array('id_0_word'),'dictionary',jsonb_build_object('id_0_word',jsonb_build_object('text','图书馆','meaning','도서관','pos','명사','furigana','tú shū guǎn')),'metadata',jsonb_build_object('language','Chinese','book',jsonb_build_object('key',key,'order',1)))) RETURNING id INTO source_id;
 seed:=jsonb_build_object('meaning','도서관 · 수업 뜻','reading','tú shū guǎn','source',jsonb_build_object('materialId',source_id::text,'quote','图书馆','tokenId','id_0_word'));
 r:=public.classroom_append_study(root_id,'2099-01-01','图书馆',op,seed);
 IF r#>>'{material,raw_text}' IS DISTINCT FROM '图书馆' OR r#>>ARRAY['material','processed_json','metadata','classMeanings',op::text||':0','meaning'] IS DISTINCT FROM '도서관 · 수업 뜻' THEN RAISE EXCEPTION 'Atomic text/meaning save failed';END IF;
 again:=public.classroom_append_study(root_id,'2099-01-01','图书馆',op,seed);
 IF again#>>'{material,id}' IS DISTINCT FROM r#>>'{material,id}' OR again->>'replayed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Replay failed';END IF;
 again:=public.classroom_append_study(root_id,'2099-01-01','图书馆',gen_random_uuid(),seed);
 IF again#>>'{material,raw_text}' IS DISTINCT FROM '图书馆' THEN RAISE EXCEPTION 'Duplicate source added';END IF;
 rejected:=false;BEGIN PERFORM public.classroom_append_study(root_id,'2099-01-01','图书馆',op,seed||'{"meaning":"changed"}');EXCEPTION WHEN SQLSTATE '22023' THEN rejected:=true;END;
 IF NOT rejected THEN RAISE EXCEPTION 'Altered replay accepted';END IF;
 rejected:=false;BEGIN PERFORM public.classroom_copy_state(auth.uid(),root_id,1,source_id,true,NULL);EXCEPTION WHEN insufficient_privilege THEN rejected:=true;END;
 IF NOT rejected THEN RAISE EXCEPTION 'Client called service-only copy function';END IF;
 PERFORM set_config('class_qa.root',root_id::text,true);PERFORM set_config('class_qa.source',source_id::text,true);
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$
DECLARE teacher uuid:=current_setting('request.jwt.claim.sub')::uuid;root_id bigint:=current_setting('class_qa.root')::bigint;source_id bigint:=current_setting('class_qa.source')::bigint;r jsonb;again jsonb;rejected boolean;
BEGIN
 r:=public.classroom_copy_state(teacher,root_id,1,source_id,true,NULL);
 IF r#>>'{copy,visibility}' IS DISTINCT FROM 'private' OR r#>>'{copy,owner_id}' IS DISTINCT FROM teacher::text OR r#>>'{copy,lesson_explanation_ko}' IS DISTINCT FROM '보존할 해설' OR r#>>'{copy,conversation_script}' IS DISTINCT FROM '보존할 대화' THEN RAISE EXCEPTION 'Private content copy failed';END IF;
 again:=public.classroom_copy_state(teacher,root_id,1,source_id,true,NULL);
 IF again#>>'{copy,id}' IS DISTINCT FROM r#>>'{copy,id}' THEN RAISE EXCEPTION 'Duplicate canonical copy';END IF;
 rejected:=false;BEGIN PERFORM public.classroom_copy_state(teacher,root_id,2,source_id,true,NULL);EXCEPTION WHEN insufficient_privilege THEN rejected:=true;END;
 IF NOT rejected THEN RAISE EXCEPTION 'Old class generation accepted';END IF;
 rejected:=false;BEGIN PERFORM public.classroom_update_copy(teacher,root_id,1,source_id,r->'copy','stale',r->'source');EXCEPTION WHEN SQLSTATE '40001' THEN rejected:=true;END;
 IF NOT rejected THEN RAISE EXCEPTION 'Unreviewed revision accepted';END IF;
END $$;
RESET ROLE;
SELECT jsonb_build_object('checks',9,'passed',true,'changes','ROLLBACK') AS verification;
ROLLBACK;
