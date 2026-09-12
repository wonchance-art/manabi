-- Disposable negative-ID fixtures, whole transaction rolled back. No user content leaves the database.
BEGIN ISOLATION LEVEL REPEATABLE READ;
CREATE TEMP TABLE teaching_verification_result(checks integer, original_materials_unchanged boolean, personal_vocabulary_unchanged boolean);
DO $$
DECLARE actor uuid; original_hash text; vocab_hash text; current_hash text; j jsonb; req jsonb; saved jsonb; again jsonb; op uuid:=gen_random_uuid(); aid uuid:=gen_random_uuid(); checks integer:=0;
BEGIN
 SELECT owner_id INTO actor FROM public.reading_materials WHERE processed_json#>>'{metadata,team,key}'='c1eb773633a54' AND processed_json#>>'{metadata,team,root}'='true' LIMIT 1;
 IF actor IS NULL THEN RAISE EXCEPTION 'QA owner not found'; END IF;
 SELECT md5(string_agg(md5(to_jsonb(m)::text),'' ORDER BY id)) INTO original_hash FROM public.reading_materials m;
 SELECT md5(string_agg(md5(to_jsonb(v)::text),'' ORDER BY id)) INTO vocab_hash FROM public.user_vocabulary v;
 INSERT INTO public.reading_materials(id,owner_id,title,raw_text,visibility,processed_json) VALUES(-9101001,actor,'검수용 수업','검수','private','{"sequence":[],"dictionary":{},"metadata":{"language":"Chinese","team":{"root":true,"key":"qa-ann-0910","bookKey":"qa-ann-book","name":"검수","lang":"Chinese"}}}');
 j:='{"sequence":["id_0_word"],"dictionary":{"id_0_word":{"text":"学校","meaning":"학교","pos":"명사"}},"status":"completed","metadata":{"language":"Chinese","book":{"key":"qa-ann-book","order":1}}}';
 INSERT INTO public.reading_materials(id,owner_id,title,raw_text,visibility,processed_json) VALUES(-9101002,actor,'검수용 교재','学校','private',j);
 req:=jsonb_build_object('id',aid,'revision',0,'body','学校와 学生을 구별해요.','archived',false,'anchor',jsonb_build_object('type','TextQuoteSelector','exact','学校','prefix','','suffix','','start',0,'end',2));
 saved:=public.save_textbook_annotation(actor,-9101002,op,req,jsonb_build_object('sequence',j->'sequence','dictionary',j->'dictionary'));
 IF saved->>'revision'<>'1' THEN RAISE EXCEPTION 'first revision'; END IF;checks:=checks+1;
 again:=public.save_textbook_annotation(actor,-9101002,op,req,'{}');
 IF saved<>again THEN RAISE EXCEPTION 'replay mismatch'; END IF;checks:=checks+1;
 BEGIN PERFORM public.save_textbook_annotation(gen_random_uuid(),-9101002,gen_random_uuid(),req,j);RAISE EXCEPTION 'unauthorized accepted';EXCEPTION WHEN insufficient_privilege THEN checks:=checks+1;END;
 req:=req||'{"revision":1,"body":"수정한 설명"}';
 PERFORM public.save_textbook_annotation(actor,-9101002,gen_random_uuid(),req,jsonb_build_object('sequence',j->'sequence','dictionary',j->'dictionary'));
 BEGIN PERFORM public.save_textbook_annotation(actor,-9101002,gen_random_uuid(),req,jsonb_build_object('sequence',j->'sequence','dictionary',j->'dictionary'));RAISE EXCEPTION 'stale accepted';EXCEPTION WHEN serialization_failure THEN checks:=checks+1;END;
 IF (SELECT count(*) FROM public.textbook_annotation_revisions WHERE annotation_id=aid)<>2 THEN RAISE EXCEPTION 'history count'; END IF;checks:=checks+1;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM public.confirm_class_chapter(-9101001,'2026-09-10',-9101002);
 PERFORM public.confirm_class_chapter(-9101001,'2026-09-10',-9101002);
 IF (SELECT material_ids FROM public.class_teaching_coverage WHERE root_id=-9101001)<>'["-9101002"]' THEN RAISE EXCEPTION 'coverage duplicate'; END IF;checks:=checks+1;
 PERFORM public.confirm_class_chapter(-9101001,'2026-09-10',-9101002,false);
 IF (SELECT material_ids FROM public.class_teaching_coverage WHERE root_id=-9101001)<>'[]' THEN RAISE EXCEPTION 'coverage undo'; END IF;checks:=checks+1;
 IF EXISTS(SELECT 1 FROM public.reading_materials WHERE processed_json#>>'{metadata,team,key}'='qa-ann-0910' AND processed_json#>>'{metadata,team,day}' IS NOT NULL) THEN RAISE EXCEPTION 'unexpected day note'; END IF;checks:=checks+1;
 SELECT md5(string_agg(md5(to_jsonb(m)::text),'' ORDER BY id)) INTO current_hash FROM public.reading_materials m WHERE id NOT IN(-9101001,-9101002);
 IF current_hash IS DISTINCT FROM original_hash THEN RAISE EXCEPTION 'original content changed'; END IF;checks:=checks+1;
 SELECT md5(string_agg(md5(to_jsonb(v)::text),'' ORDER BY id)) INTO current_hash FROM public.user_vocabulary v;
 IF current_hash IS DISTINCT FROM vocab_hash THEN RAISE EXCEPTION 'vocabulary changed'; END IF;checks:=checks+1;
 INSERT INTO teaching_verification_result VALUES(checks,true,true);
END $$;
SELECT * FROM teaching_verification_result;
ROLLBACK;
