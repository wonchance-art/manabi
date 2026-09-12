-- Classroom reader: text, selected meaning and source commit together. Original RPC remains compatible.
CREATE OR REPLACE FUNCTION public.classroom_append_study(p_root bigint,p_day text,p_text text,p_operation uuid,p_seed jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE
 r public.reading_materials%rowtype; n public.reading_materials%rowtype; src public.reading_materials%rowtype;
 result jsonb; request jsonb; prior jsonb; source jsonb; e jsonb; tok jsonb; j jsonb; meta jsonb;
 clean text; meaning text; reading text; entry_id text; token_id text; failed_id text; idx integer;
BEGIN
 IF auth.uid() IS NULL OR jsonb_typeof(p_seed) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION '수업 입력을 확인해 주세요.' USING ERRCODE='42501'; END IF;
 clean:=btrim(replace(p_text,E'\r',''),E' \n\t');meaning:=coalesce(p_seed->>'meaning','');reading:=coalesce(p_seed->>'reading','');source:=coalesce(p_seed->'source','{"kind":"manual"}'::jsonb);
 IF length(meaning)>500 OR length(reading)>500 OR jsonb_typeof(source)<>'object' THEN RAISE EXCEPTION '표현 정보를 확인해 주세요.' USING ERRCODE='22023'; END IF;
 SELECT * INTO r FROM public.reading_materials WHERE id=p_root AND owner_id=auth.uid() AND processed_json#>>'{metadata,team,root}'='true' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '이 수업의 선생님만 추가할 수 있어요.' USING ERRCODE='42501'; END IF;
 request:=jsonb_build_object('text',clean,'seed',p_seed);
 SELECT * INTO n FROM public.reading_materials WHERE owner_id=auth.uid() AND processed_json#>>'{metadata,team,key}'=r.processed_json#>>'{metadata,team,key}' AND processed_json#>>'{metadata,team,day}'=p_day ORDER BY created_at,id LIMIT 1 FOR UPDATE;
 IF FOUND THEN
   prior:=n.processed_json#>ARRAY['metadata','classStudyOperations',p_operation::text];
   IF prior IS NOT NULL THEN
     IF prior IS DISTINCT FROM request THEN RAISE EXCEPTION '같은 저장 요청의 내용이 바뀌었어요.' USING ERRCODE='22023'; END IF;
     RETURN jsonb_build_object('material',to_jsonb(n),'replayed',true);
   END IF;
   IF n.processed_json#>ARRAY['metadata','classOperations',p_operation::text] IS NOT NULL THEN RAISE EXCEPTION '이미 사용한 저장 요청이에요.' USING ERRCODE='22023'; END IF;
 END IF;
 IF source->>'materialId' IS NOT NULL THEN
   IF source->>'materialId' !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION '교재 위치를 확인해 주세요.' USING ERRCODE='22023'; END IF;
   SELECT * INTO src FROM public.reading_materials WHERE id=(source->>'materialId')::bigint AND owner_id=auth.uid();
   IF NOT FOUND OR (
      (r.processed_json#>>'{metadata,team,bookKey}' IS NOT NULL AND src.processed_json#>>'{metadata,book,key}'=r.processed_json#>>'{metadata,team,bookKey}')
      OR (src.processed_json#>>'{metadata,team,key}'=r.processed_json#>>'{metadata,team,key}' AND src.processed_json#>>'{metadata,team,root}' IS DISTINCT FROM 'true')
   ) IS NOT TRUE THEN RAISE EXCEPTION '현재 수업의 교재에서 선택해 주세요.' USING ERRCODE='42501'; END IF;
   IF coalesce(source->>'quote','')<>clean OR position(clean IN src.raw_text)=0 THEN RAISE EXCEPTION '교재 내용이 바뀌었어요. 표현을 다시 선택해 주세요.' USING ERRCODE='40001'; END IF;
   IF source->>'tokenId' IS NOT NULL THEN
     tok:=src.processed_json#>ARRAY['dictionary',source->>'tokenId'];
     IF tok->>'text' IS DISTINCT FROM clean OR coalesce((tok->>'failed')::boolean,false) THEN RAISE EXCEPTION '단어를 다시 선택해 주세요.' USING ERRCODE='40001'; END IF;
   END IF;
 ELSIF source IS DISTINCT FROM '{"kind":"manual"}'::jsonb THEN RAISE EXCEPTION '출처를 확인해 주세요.' USING ERRCODE='22023'; END IF;
 -- Collapse accidental double-clicks of the same source, while different contexts remain distinct.
 IF source->>'materialId' IS NOT NULL AND NOT coalesce((p_seed->>'repeat')::boolean,false) THEN
   FOR e IN SELECT value FROM jsonb_array_elements(coalesce(n.processed_json#>'{metadata,classEntries}','[]'::jsonb)) LOOP
     IF e->>'text'=clean AND n.processed_json#>ARRAY['metadata','classSources',e->>'id']=source THEN
       RETURN jsonb_build_object('material',to_jsonb(n),'replayed',true,'existingEntry',e->>'id');
     END IF;
   END LOOP;
 END IF;
 result:=public.classroom_append_entry(p_root,p_day,clean,p_operation);
 SELECT * INTO n FROM public.reading_materials WHERE id=(result#>>'{material,id}')::bigint FOR UPDATE;
 j:=n.processed_json;meta:=j->'metadata';
 meta:=meta||jsonb_build_object('classStudyOperations',coalesce(meta->'classStudyOperations','{}'::jsonb)||jsonb_build_object(p_operation::text,request));
 -- One selected expression may span lines; a sentence meaning is never duplicated onto each line.
 FOR e IN SELECT value FROM jsonb_array_elements(meta->'classEntries') LOOP
   IF e->>'id' LIKE p_operation::text||':%' THEN
     entry_id:=e->>'id';idx:=(e->>'idx')::integer;
     meta:=meta||jsonb_build_object('classSources',coalesce(meta->'classSources','{}'::jsonb)||jsonb_build_object(entry_id,source));
     IF e->>'text'=clean THEN
       IF meaning<>'' THEN meta:=meta||jsonb_build_object('classMeanings',coalesce(meta->'classMeanings','{}'::jsonb)||jsonb_build_object(entry_id,jsonb_build_object('text',clean,'meaning',meaning)),
         'classReadings',coalesce(meta->'classReadings','{}'::jsonb)||jsonb_build_object(entry_id,reading));END IF;
       IF tok IS NOT NULL THEN
         failed_id:='failed_'||idx||'_'||replace(p_operation::text,'-','');token_id:='id_'||idx||'_'||replace(p_operation::text,'-','');
         j:=jsonb_set(j,'{sequence}',(SELECT jsonb_agg(CASE WHEN value=to_jsonb(failed_id) THEN to_jsonb(token_id) ELSE value END ORDER BY ord) FROM jsonb_array_elements(j->'sequence') WITH ORDINALITY a(value,ord)));
         j:=jsonb_set(j,'{dictionary}',((j->'dictionary')-failed_id)||jsonb_build_object(token_id,tok||jsonb_build_object('meaning',meaning)));
         j:=jsonb_set(j,'{failed_indices}',coalesce((SELECT jsonb_agg(value) FROM jsonb_array_elements(j->'failed_indices') a(value) WHERE value<>to_jsonb(idx)),'[]'::jsonb));
       END IF;
     END IF;
   END IF;
 END LOOP;
 j:=jsonb_set(j,'{metadata}',meta);
 IF jsonb_array_length(j->'failed_indices')=0 THEN j:=j||'{"status":"completed"}'::jsonb; END IF;
 UPDATE public.reading_materials SET processed_json=j WHERE id=n.id AND owner_id=auth.uid() RETURNING * INTO n;
 RETURN jsonb_build_object('material',to_jsonb(n),'replayed',false);
END;$$;
REVOKE ALL ON FUNCTION public.classroom_append_study(bigint,text,text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.classroom_append_study(bigint,text,text,uuid,jsonb) TO authenticated;

-- The mapping is separate from old copies: existing duplicate rows are preserved for explicit choice.
CREATE TABLE public.class_material_copies (
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 source_material_id bigint NOT NULL,
 copy_material_id bigint NOT NULL UNIQUE REFERENCES public.reading_materials(id) ON DELETE CASCADE,
 source_revision text,
 base_snapshot jsonb,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(owner_id,source_material_id)
);
ALTER TABLE public.class_material_copies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.class_material_copies FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.class_material_copies TO authenticated;
GRANT ALL ON public.class_material_copies TO service_role;
CREATE POLICY class_copy_owner ON public.class_material_copies FOR SELECT TO authenticated USING ((select auth.uid())=owner_id);

CREATE FUNCTION public.class_shared_snapshot(p_row jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('lesson_explanation_ko',p_row->'lesson_explanation_ko','conversation_script',p_row->'conversation_script','direction',to_jsonb(coalesce(p_row->>'direction','read')),'source_pdf_id',p_row->'source_pdf_id','page_start',p_row->'page_start','page_end',p_row->'page_end','document_json',p_row->'document_json','title',coalesce(p_row->>'title',''),'raw_text',coalesce(p_row->>'raw_text',''),
 'processed_json',(coalesce(p_row->'processed_json','{}'::jsonb)-'last_idx')||jsonb_build_object('metadata',coalesce((
 SELECT jsonb_object_agg(key,value) FROM jsonb_each(coalesce(p_row#>'{processed_json,metadata}','{}'::jsonb))
 WHERE key IN ('language','level','book','translations','classEntries','classMeanings','classReadings','viewerCorrections','source','edition','editionId','textbook','classSources')
 ),'{}'::jsonb)));
$$;
REVOKE ALL ON FUNCTION public.class_shared_snapshot(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.class_shared_snapshot(jsonb) TO service_role;

CREATE FUNCTION public.classroom_copy_state(p_owner uuid,p_root bigint,p_generation integer,p_source bigint,p_create boolean DEFAULT false,p_preferred bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE r public.reading_materials%rowtype;src public.reading_materials%rowtype;mine public.reading_materials%rowtype;
 link public.class_material_copies%rowtype; snap jsonb; candidates jsonb; candidate_count integer; chosen bigint; meta jsonb;
BEGIN
 IF p_owner IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.reading_materials WHERE id=p_root AND processed_json#>>'{metadata,team,root}'='true' FOR SHARE;
 IF NOT FOUND OR coalesce((r.processed_json#>>'{metadata,team,pwGen}')::integer,0) IS DISTINCT FROM p_generation THEN RAISE EXCEPTION '수업 암호를 다시 확인해 주세요.' USING ERRCODE='42501'; END IF;
 SELECT * INTO src FROM public.reading_materials WHERE id=p_source AND owner_id=r.owner_id FOR SHARE;
 IF NOT FOUND OR (
   (r.processed_json#>>'{metadata,team,bookKey}' IS NOT NULL AND src.processed_json#>>'{metadata,book,key}'=r.processed_json#>>'{metadata,team,bookKey}') OR
   (src.processed_json#>>'{metadata,team,key}'=r.processed_json#>>'{metadata,team,key}' AND src.processed_json#>>'{metadata,team,root}' IS DISTINCT FROM 'true')
 ) IS NOT TRUE THEN RAISE EXCEPTION '이 수업에 없는 자료예요.' USING ERRCODE='42501'; END IF;
 snap:=public.class_shared_snapshot(to_jsonb(src));
 PERFORM pg_advisory_xact_lock(hashtextextended(p_owner::text||':'||p_source,0));
 SELECT * INTO link FROM public.class_material_copies WHERE owner_id=p_owner AND source_material_id=p_source FOR UPDATE;
 IF FOUND THEN
   SELECT * INTO mine FROM public.reading_materials WHERE id=link.copy_material_id AND owner_id=p_owner FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION '내 자료의 소유권을 확인하지 못했어요.' USING ERRCODE='42501'; END IF;
 ELSE
   SELECT count(*),jsonb_agg(jsonb_build_object('id',id,'title',title,'createdAt',created_at) ORDER BY created_at,id),min(id)
     INTO candidate_count,candidates,chosen FROM public.reading_materials
     WHERE owner_id=p_owner AND processed_json#>>'{metadata,source_ref}'=p_source::text;
   IF candidate_count>1 AND p_preferred IS NULL THEN RETURN jsonb_build_object('state','choose','candidates',candidates); END IF;
   IF p_preferred IS NOT NULL THEN
     IF NOT EXISTS(SELECT 1 FROM public.reading_materials WHERE id=p_preferred AND owner_id=p_owner AND processed_json#>>'{metadata,source_ref}'=p_source::text) THEN RAISE EXCEPTION '기존 사본을 다시 선택해 주세요.' USING ERRCODE='42501'; END IF;
     chosen:=p_preferred;
   END IF;
   IF chosen IS NOT NULL THEN
     SELECT * INTO mine FROM public.reading_materials WHERE id=chosen AND owner_id=p_owner FOR UPDATE;
     INSERT INTO public.class_material_copies(owner_id,source_material_id,copy_material_id,source_revision,base_snapshot)
       VALUES(p_owner,p_source,mine.id,CASE WHEN public.class_shared_snapshot(to_jsonb(mine))=snap THEN md5(snap::text) END,CASE WHEN public.class_shared_snapshot(to_jsonb(mine))=snap THEN snap END) RETURNING * INTO link;
   ELSIF p_create THEN
     meta:=(snap#>'{processed_json,metadata}')||jsonb_build_object('source_ref',p_source::text,'copied_at',clock_timestamp());
     INSERT INTO public.reading_materials(owner_id,title,raw_text,visibility,processed_json,lesson_explanation_ko,conversation_script,direction,source_pdf_id,page_start,page_end,document_json)
       VALUES(p_owner,src.title,src.raw_text,'private',jsonb_set(snap->'processed_json','{metadata}',meta),src.lesson_explanation_ko,src.conversation_script,src.direction,src.source_pdf_id,src.page_start,src.page_end,src.document_json) RETURNING * INTO mine;
     INSERT INTO public.class_material_copies(owner_id,source_material_id,copy_material_id,source_revision,base_snapshot)
       VALUES(p_owner,p_source,mine.id,md5(snap::text),snap) RETURNING * INTO link;
   END IF;
 END IF;
 RETURN jsonb_build_object('state',CASE WHEN mine.id IS NULL THEN 'missing' ELSE 'ready' END,'copy',CASE WHEN mine.id IS NOT NULL THEN to_jsonb(mine) END,'base',link.base_snapshot,'source',snap,'sourceRevision',md5(snap::text));
END;$$;
REVOKE ALL ON FUNCTION public.classroom_copy_state(uuid,bigint,integer,bigint,boolean,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.classroom_copy_state(uuid,bigint,integer,bigint,boolean,bigint) TO service_role;

CREATE FUNCTION public.classroom_update_copy(p_owner uuid,p_root bigint,p_generation integer,p_source bigint,p_expected jsonb,p_source_revision text,p_next jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE state jsonb;mine public.reading_materials%rowtype;meta jsonb;
BEGIN
 state:=public.classroom_copy_state(p_owner,p_root,p_generation,p_source,false,NULL);
 IF state->>'state'<>'ready' OR state->'copy' IS DISTINCT FROM p_expected OR state->>'sourceRevision' IS DISTINCT FROM p_source_revision THEN RAISE EXCEPTION '자료가 바뀌었어요. 변경 내용을 다시 확인해 주세요.' USING ERRCODE='40001'; END IF;
 IF p_next->>'raw_text' IS DISTINCT FROM state#>>'{source,raw_text}' OR jsonb_typeof(p_next->'processed_json') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION '변경 내용을 확인해 주세요.' USING ERRCODE='22023'; END IF;
 meta:=coalesce(p_next#>'{processed_json,metadata}','{}'::jsonb)||jsonb_build_object('source_ref',p_source::text,'viewerRevision',gen_random_uuid(),'updated_at',clock_timestamp());
 UPDATE public.reading_materials SET lesson_explanation_ko=p_next->>'lesson_explanation_ko',conversation_script=p_next->>'conversation_script',direction=coalesce(p_next->>'direction','read'),source_pdf_id=(p_next->>'source_pdf_id')::uuid,page_start=(p_next->>'page_start')::integer,page_end=(p_next->>'page_end')::integer,document_json=p_next->'document_json',title=p_next->>'title',raw_text=p_next->>'raw_text',processed_json=jsonb_set(p_next->'processed_json','{metadata}',meta)
   WHERE id=(state#>>'{copy,id}')::bigint AND owner_id=p_owner RETURNING * INTO mine;
 UPDATE public.class_material_copies SET base_snapshot=state->'source',source_revision=state->>'sourceRevision',updated_at=clock_timestamp() WHERE owner_id=p_owner AND source_material_id=p_source;
 RETURN to_jsonb(mine);
END;$$;
REVOKE ALL ON FUNCTION public.classroom_update_copy(uuid,bigint,integer,bigint,jsonb,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.classroom_update_copy(uuid,bigint,integer,bigint,jsonb,text,jsonb) TO service_role;
