-- Owner applies after duplicate-key preflight. Existing notes and tokens are never rewritten.
-- A duplicate legacy key deliberately stops migration instead of silently changing a shared URL.
CREATE UNIQUE INDEX IF NOT EXISTS reading_materials_class_key_unique
ON public.reading_materials ((processed_json #>> '{metadata,team,key}'))
WHERE processed_json #>> '{metadata,team,root}' = 'true';

CREATE OR REPLACE FUNCTION public.classroom_append_entry(
  p_root bigint, p_day text, p_text text, p_operation uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public AS $$
DECLARE
  root_row public.reading_materials%rowtype;
  note public.reading_materials%rowtype;
  team jsonb; j jsonb; meta jsonb; seq jsonb; dict jsonb; failed jsonb; entries jsonb;
  lines text[]; line text; token_id text; line_idx integer; start_idx integer;
  clean text; stamp text; old_text text; prior text; last_token text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE='42501'; END IF;
  clean := btrim(replace(p_text, E'\r', ''), E' \n\t');
  IF p_operation IS NULL OR clean IS NULL OR length(clean)=0 OR length(clean)>5000
    OR p_day IS NULL OR p_day !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION '입력과 수업 날짜를 확인해 주세요.' USING ERRCODE='22023';
  END IF;
  PERFORM p_day::date;
  -- Same root lock serializes initial creation and every append across tabs/devices.
  SELECT * INTO root_row FROM public.reading_materials
    WHERE id=p_root AND owner_id=auth.uid() AND processed_json #>> '{metadata,team,root}'='true'
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '이 수업의 선생님만 저장할 수 있어요.' USING ERRCODE='42501'; END IF;
  team := root_row.processed_json #> '{metadata,team}';
  SELECT * INTO note FROM public.reading_materials
    WHERE owner_id=auth.uid() AND processed_json #>> '{metadata,team,key}'=team->>'key'
      AND processed_json #>> '{metadata,team,day}'=p_day
      AND (processed_json #>> '{metadata,team,root}') IS DISTINCT FROM 'true'
    ORDER BY created_at, id LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    prior := note.processed_json #>> ARRAY['metadata','classOperations',p_operation::text];
    IF prior IS NOT NULL THEN
      IF prior IS DISTINCT FROM clean THEN RAISE EXCEPTION '같은 저장 요청의 내용이 바뀌었어요.' USING ERRCODE='22023'; END IF;
      RETURN jsonb_build_object('material',to_jsonb(note),'replayed',true);
    END IF;
  ELSE
    INSERT INTO public.reading_materials(owner_id,title,raw_text,visibility,processed_json)
    VALUES(auth.uid(),'['||coalesce(team->>'name',team->>'key')||'] '||p_day||' 수업',clean,'private',
      jsonb_build_object('sequence','[]'::jsonb,'dictionary','{}'::jsonb,'failed_indices','[]'::jsonb,'status','pending','last_idx',-1,
        'metadata',jsonb_build_object('language',coalesce(team->>'lang','Japanese'),
          'team',jsonb_strip_nulls(jsonb_build_object('key',team->>'key','day',p_day,'chapterId',team->>'chapterId')))))
    RETURNING * INTO note;
    -- First insert has valid raw_text for existing non-empty source constraints.
    note.raw_text := '';
  END IF;
  old_text := coalesce(note.raw_text,'');
  IF length(old_text)+length(clean)>200000 THEN RAISE EXCEPTION '오늘 노트의 입력 한도에 도달했어요.' USING ERRCODE='22023'; END IF;
  j := coalesce(note.processed_json,'{}'::jsonb); meta := coalesce(j->'metadata','{}'::jsonb);
  seq := coalesce(j->'sequence','[]'::jsonb); dict := coalesce(j->'dictionary','{}'::jsonb);
  failed := coalesce(j->'failed_indices','[]'::jsonb); entries := coalesce(meta->'classEntries','[]'::jsonb);
  stamp := replace(p_operation::text,'-','');
  start_idx := CASE WHEN old_text='' THEN 0 ELSE cardinality(string_to_array(old_text,E'\n'))+1 END;
  IF old_text<>'' THEN
    last_token := seq->>-1;
    IF (dict->last_token->>'text') IS DISTINCT FROM E'\n' THEN
      token_id := 'br_'||(start_idx-2)||'_end_'||stamp;
      seq := seq||jsonb_build_array(token_id); dict := dict||jsonb_build_object(token_id,jsonb_build_object('text',E'\n','pos','개행'));
    END IF;
    token_id := 'br_'||(start_idx-1)||'_'||stamp;
    seq := seq||jsonb_build_array(token_id); dict := dict||jsonb_build_object(token_id,jsonb_build_object('text',E'\n','pos','개행'));
  END IF;
  lines := string_to_array(clean,E'\n'); line_idx := start_idx;
  FOREACH line IN ARRAY lines LOOP
    IF btrim(line,E' \t')<>'' THEN
      token_id := 'failed_'||line_idx||'_'||stamp;
      seq := seq||jsonb_build_array(token_id);
      dict := dict||jsonb_build_object(token_id,jsonb_build_object('text',line,'pos','미분석','failed',true,'original_line_idx',line_idx));
      failed := failed||to_jsonb(line_idx);
      entries := entries||jsonb_build_array(jsonb_build_object('id',p_operation::text||':'||(line_idx-start_idx),'idx',line_idx,'text',btrim(line,E' \t')));
    END IF;
    IF line_idx < start_idx+cardinality(lines)-1 THEN
      token_id := 'br_'||line_idx||'_'||stamp;
      seq := seq||jsonb_build_array(token_id); dict := dict||jsonb_build_object(token_id,jsonb_build_object('text',E'\n','pos','개행'));
    END IF;
    line_idx := line_idx+1;
  END LOOP;
  meta := meta||jsonb_build_object('classEntries',entries,'classOperations',coalesce(meta->'classOperations','{}'::jsonb)||jsonb_build_object(p_operation::text,clean),
    'viewerRevision',p_operation::text,'updated_at',clock_timestamp());
  j := j||jsonb_build_object('sequence',seq,'dictionary',dict,'failed_indices',failed,'status','partial','metadata',meta);
  UPDATE public.reading_materials SET raw_text=CASE WHEN old_text='' THEN clean ELSE old_text||E'\n\n'||clean END,processed_json=j
    WHERE id=note.id AND owner_id=auth.uid() RETURNING * INTO note;
  RETURN jsonb_build_object('material',to_jsonb(note),'replayed',false);
END;
$$;
REVOKE ALL ON FUNCTION public.classroom_append_entry(bigint,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.classroom_append_entry(bigint,text,text,uuid) TO authenticated;
