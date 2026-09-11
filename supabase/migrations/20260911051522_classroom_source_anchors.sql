-- Classroom source positions use the same UTF-16 units as the reader/annotations.
-- No table or access-policy changes. The existing owner-only atomic RPC stays compatible.
CREATE FUNCTION public.classroom_utf16_length(p_text text) RETURNS bigint
LANGUAGE sql IMMUTABLE STRICT SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT coalesce(sum(CASE WHEN ch='' THEN 0 WHEN ascii(ch)>65535 THEN 2 ELSE 1 END),0)::bigint
 FROM regexp_split_to_table(p_text,'') AS c(ch);
$$;
REVOKE ALL ON FUNCTION public.classroom_utf16_length(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.classroom_utf16_length(text) TO authenticated;

CREATE FUNCTION public.classroom_valid_source_anchor(p_stream text,p_anchor jsonb,p_quote text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE start_at bigint; end_at bigint; char_at bigint; exact text; prefix text; suffix text;
BEGIN
 IF jsonb_typeof(p_anchor) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_anchor) k WHERE k NOT IN ('type','exact','prefix','suffix','start','end'))
    OR p_anchor->>'type' IS DISTINCT FROM 'TextQuoteSelector'
    OR jsonb_typeof(p_anchor->'exact') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_anchor->'prefix') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_anchor->'suffix') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_anchor->'start') IS DISTINCT FROM 'number'
    OR jsonb_typeof(p_anchor->'end') IS DISTINCT FROM 'number'
    OR coalesce(p_anchor->>'start','') !~ '^[0-9]{1,9}$'
    OR coalesce(p_anchor->>'end','') !~ '^[0-9]{1,9}$' THEN RETURN false; END IF;
 exact:=p_anchor->>'exact';prefix:=p_anchor->>'prefix';suffix:=p_anchor->>'suffix';
 start_at:=(p_anchor->>'start')::bigint;end_at:=(p_anchor->>'end')::bigint;
 IF exact IS DISTINCT FROM p_quote OR exact='' OR public.classroom_utf16_length(exact)>5000
    OR public.classroom_utf16_length(prefix)>48 OR public.classroom_utf16_length(suffix)>48
    OR end_at<>start_at+public.classroom_utf16_length(exact) OR end_at>public.classroom_utf16_length(p_stream) THEN RETURN false; END IF;
 IF start_at=0 THEN char_at:=0;
 ELSE
   SELECT ord INTO char_at FROM (
     SELECT ord,sum(CASE WHEN ch='' THEN 0 WHEN ascii(ch)>65535 THEN 2 ELSE 1 END) OVER(ORDER BY ord) units
     FROM regexp_split_to_table(p_stream,'') WITH ORDINALITY AS c(ch,ord)
   ) positions WHERE units=start_at;
   IF char_at IS NULL THEN RETURN false; END IF;
 END IF;
 RETURN substring(p_stream FROM char_at::integer+1 FOR length(exact))=exact
    AND right(left(p_stream,char_at::integer),length(prefix))=prefix
    AND substring(p_stream FROM char_at::integer+length(exact)+1 FOR length(suffix))=suffix;
END;$$;
REVOKE ALL ON FUNCTION public.classroom_valid_source_anchor(text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.classroom_valid_source_anchor(text,jsonb,text) TO authenticated;

-- Classroom reader: text, selected meaning and source commit together. Original RPC remains compatible.
CREATE OR REPLACE FUNCTION public.classroom_append_study(p_root bigint,p_day text,p_text text,p_operation uuid,p_seed jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE
 r public.reading_materials%rowtype; n public.reading_materials%rowtype; src public.reading_materials%rowtype;
 result jsonb; request jsonb; prior jsonb; source jsonb; e jsonb; tok jsonb; j jsonb; meta jsonb;
 clean text; meaning text; reading text; entry_id text; token_id text; failed_id text; idx integer; stream text; old_source jsonb;
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
   SELECT * INTO src FROM public.reading_materials WHERE id=(source->>'materialId')::bigint AND owner_id=auth.uid() FOR SHARE;
   IF NOT FOUND OR (
      (r.processed_json#>>'{metadata,team,bookKey}' IS NOT NULL AND src.processed_json#>>'{metadata,book,key}'=r.processed_json#>>'{metadata,team,bookKey}')
      OR (src.processed_json#>>'{metadata,team,key}'=r.processed_json#>>'{metadata,team,key}' AND src.processed_json#>>'{metadata,team,root}' IS DISTINCT FROM 'true')
   ) IS NOT TRUE THEN RAISE EXCEPTION '현재 수업의 교재에서 선택해 주세요.' USING ERRCODE='42501'; END IF;
   IF coalesce(source->>'quote','')<>clean OR position(clean IN src.raw_text)=0 THEN RAISE EXCEPTION '교재 내용이 바뀌었어요. 표현을 다시 선택해 주세요.' USING ERRCODE='40001'; END IF;
   IF source ? 'anchor' THEN
     SELECT coalesce(string_agg(src.processed_json#>>ARRAY['dictionary',seq.source_token,'text'],'' ORDER BY ord),'') INTO stream
       FROM jsonb_array_elements_text(src.processed_json->'sequence') WITH ORDINALITY AS seq(source_token,ord);
     IF NOT public.classroom_valid_source_anchor(stream,source->'anchor',clean) THEN
       RAISE EXCEPTION '교재 내용이 바뀌었어요. 표현을 다시 선택해 주세요.' USING ERRCODE='40001';
     END IF;
     -- Server-derived text revision is audit data, never a client authorization claim.
     source:=source||jsonb_build_object('streamDigest',md5(stream));
   END IF;
   IF source->>'tokenId' IS NOT NULL THEN
     tok:=src.processed_json#>ARRAY['dictionary',source->>'tokenId'];
     IF tok->>'text' IS DISTINCT FROM clean OR coalesce((tok->>'failed')::boolean,false) THEN RAISE EXCEPTION '단어를 다시 선택해 주세요.' USING ERRCODE='40001'; END IF;
   END IF;
 ELSIF source IS DISTINCT FROM '{"kind":"manual"}'::jsonb THEN RAISE EXCEPTION '출처를 확인해 주세요.' USING ERRCODE='22023'; END IF;
 -- Collapse accidental double-clicks of the same source, while different contexts remain distinct.
 IF source->>'materialId' IS NOT NULL AND NOT coalesce((p_seed->>'repeat')::boolean,false) THEN
   FOR e IN SELECT value FROM jsonb_array_elements(coalesce(n.processed_json#>'{metadata,classEntries}','[]'::jsonb)) LOOP
     old_source:=n.processed_json#>ARRAY['metadata','classSources',e->>'id'];
     IF (e->>'text'=clean OR (source ? 'anchor' AND old_source->>'quote'=clean)) AND (old_source=source OR
       (source ? 'anchor' AND old_source->>'materialId'=source->>'materialId' AND old_source->'anchor'=source->'anchor')) THEN
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
