-- Preserve the existing per-token correction tool without allowing whole-analysis overwrites.
CREATE OR REPLACE FUNCTION public.correct_source_passage_token(p_id bigint,p_token text,p_before jsonb,p_corrections jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE r public.reading_materials%ROWTYPE; token jsonb; j jsonb;
BEGIN
  SELECT * INTO r FROM public.reading_materials WHERE id=p_id AND owner_id=auth.uid() AND visibility='private' FOR UPDATE;
  IF NOT FOUND OR r.processed_json->'metadata'->'composer'->'passage' IS NULL
    THEN RAISE EXCEPTION 'PASSAGE_ACCESS' USING ERRCODE='42501'; END IF;
  IF r.processed_json->>'status'='analyzing' AND
    (r.processed_json->'metadata'->'passageRun'->>'until')::timestamptz>clock_timestamp()
    THEN RAISE EXCEPTION 'PASSAGE_ANALYSIS_BUSY' USING ERRCODE='40001'; END IF;
  token:=r.processed_json->'dictionary'->p_token;
  IF token IS NULL OR token IS DISTINCT FROM p_before THEN
    RAISE EXCEPTION 'PASSAGE_TOKEN_CHANGED' USING ERRCODE='40001'; END IF;
  IF jsonb_typeof(p_corrections) IS DISTINCT FROM 'object' OR char_length(p_corrections::text)>12000
    THEN RAISE EXCEPTION 'PASSAGE_INVALID'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_each(p_corrections) AS field(key,value)
    WHERE key NOT IN ('meaning','furigana','pos') OR jsonb_typeof(value)<>'string' OR char_length(value#>>'{}')>3000)
    THEN RAISE EXCEPTION 'PASSAGE_INVALID'; END IF;
  j:=jsonb_set(r.processed_json,ARRAY['dictionary',p_token],token||p_corrections);
  PERFORM set_config('manabi.passage_write',p_id::text,true);
  UPDATE public.reading_materials SET processed_json=j WHERE id=p_id RETURNING * INTO r;
  PERFORM set_config('manabi.passage_write','',true);
  RETURN to_jsonb(r);
END;
$$;
REVOKE ALL ON FUNCTION public.correct_source_passage_token(bigint,text,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.correct_source_passage_token(bigint,text,jsonb,jsonb) TO authenticated;
