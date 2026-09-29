-- Owner/RLS-scoped compare-and-patch. No row, policy, or existing RPC is changed.
CREATE OR REPLACE FUNCTION public.viewer_correct_token(
  p_id bigint, p_token text, p_before jsonb, p_corrections jsonb, p_expected_raw text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public AS $$
DECLARE r public.reading_materials%ROWTYPE; token jsonb; patched jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'VIEWER_TOKEN_ACCESS' USING ERRCODE='42501'; END IF;
  IF p_token IS NULL OR length(p_token) NOT BETWEEN 1 AND 300
    OR jsonb_typeof(p_before) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_corrections) IS DISTINCT FROM 'object' OR p_corrections='{}'::jsonb
    OR length(p_corrections::text)>12000 THEN
    RAISE EXCEPTION 'VIEWER_TOKEN_INVALID' USING ERRCODE='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_each(p_corrections) AS f(key,value)
    WHERE key NOT IN ('meaning','furigana','pos') OR jsonb_typeof(value)<>'string'
      OR length(value#>>'{}')>3000) THEN
    RAISE EXCEPTION 'VIEWER_TOKEN_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT * INTO r FROM public.reading_materials
    WHERE id=p_id AND owner_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'VIEWER_TOKEN_ACCESS' USING ERRCODE='42501'; END IF;
  -- Source passages retain their own guarded write RPC and trigger contract.
  IF r.processed_json#>'{metadata,composer,passage}' IS NOT NULL THEN
    RAISE EXCEPTION 'VIEWER_TOKEN_PASSAGE' USING ERRCODE='22023';
  END IF;
  IF r.processed_json->>'status'='analyzing' THEN
    RAISE EXCEPTION 'VIEWER_TOKEN_BUSY' USING ERRCODE='40001';
  END IF;
  IF r.raw_text IS DISTINCT FROM p_expected_raw THEN
    RAISE EXCEPTION 'VIEWER_TOKEN_SOURCE_CHANGED' USING ERRCODE='40001';
  END IF;
  token:=r.processed_json->'dictionary'->p_token;
  IF jsonb_typeof(token) IS DISTINCT FROM 'object'
    OR token->>'text' IS DISTINCT FROM p_before->>'text'
    OR jsonb_typeof(r.processed_json->'sequence') IS DISTINCT FROM 'array'
    OR NOT (r.processed_json->'sequence' ? p_token) THEN
    RAISE EXCEPTION 'VIEWER_TOKEN_SOURCE_CHANGED' USING ERRCODE='40001';
  END IF;
  patched:=p_before||p_corrections;
  -- A lost response can be retried without writing the token again.
  IF token IS NOT DISTINCT FROM patched THEN
    RETURN jsonb_build_object('material',to_jsonb(r),'applied',false);
  END IF;
  IF token IS DISTINCT FROM p_before THEN
    RETURN jsonb_build_object('conflict','token','current_token',token);
  END IF;
  UPDATE public.reading_materials
    SET processed_json=jsonb_set(r.processed_json,ARRAY['dictionary',p_token],patched,false)
    WHERE id=p_id AND owner_id=auth.uid() RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'VIEWER_TOKEN_ACCESS' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('material',to_jsonb(r),'applied',true);
END;
$$;
REVOKE ALL ON FUNCTION public.viewer_correct_token(bigint,text,jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.viewer_correct_token(bigint,text,jsonb,jsonb,text) TO authenticated;
