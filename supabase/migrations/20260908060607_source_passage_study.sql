-- New private study snapshots reuse reading_materials and its immutable composer source.
CREATE OR REPLACE FUNCTION public.validate_source_passage()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE
  c jsonb := NEW.processed_json->'metadata'->'composer';
  s jsonb := c->'passage';
  parent public.reading_materials%ROWTYPE;
  d jsonb;
  body text;
BEGIN
  IF s IS NULL THEN RETURN NEW; END IF;
  IF NEW.visibility IS DISTINCT FROM 'private' OR NEW.owner_id IS DISTINCT FROM auth.uid()
    OR c->>'role' IS DISTINCT FROM 'study' OR c->>'version' IS DISTINCT FROM '1'
    OR COALESCE(c->>'parentId','') !~ '^[1-9][0-9]{0,18}$'
    OR jsonb_typeof(s) IS DISTINCT FROM 'object'
    OR s->>'version' IS DISTINCT FROM '1' OR COALESCE(s->>'kind','') NOT IN ('body','pdf','epub')
    OR s->>'textVersion' IS DISTINCT FROM (CASE s->>'kind' WHEN 'body' THEN 'plain-v1' WHEN 'pdf' THEN 'pdf-layer-v1' WHEN 'epub' THEN 'epub-text-v1' END)
    OR COALESCE(char_length(NEW.raw_text),0) NOT BETWEEN 1 AND 1500 OR btrim(NEW.raw_text) = ''
    OR COALESCE(NEW.processed_json->'metadata'->>'language','') NOT IN ('Japanese','Chinese','English','French')
    OR COALESCE(char_length(s->'quote'->>'exact'),0) > 4000
    OR char_length(s::text) > 24000
  THEN RAISE EXCEPTION 'PASSAGE_INVALID' USING ERRCODE='23514'; END IF;
  SELECT * INTO parent FROM public.reading_materials
    WHERE id=(c->>'parentId')::bigint AND owner_id=auth.uid() AND visibility='private' FOR SHARE;
  IF NOT FOUND OR parent.processed_json->'metadata'->'composer'->>'version' IS DISTINCT FROM '1'
    OR parent.processed_json->'metadata'->'composer'->>'role' = 'study'
  THEN RAISE EXCEPTION 'PASSAGE_ACCESS' USING ERRCODE='42501'; END IF;
  d := COALESCE(parent.document_json, jsonb_build_object('revision',NULL,'body',parent.raw_text,
    'assets',parent.processed_json->'metadata'->'composer'->'assets'));
  IF s->>'kind'='body' THEN
    IF d->>'revision' IS DISTINCT FROM s->>'revision' THEN
      RAISE EXCEPTION 'PASSAGE_SOURCE_CHANGED' USING ERRCODE='40001';
    END IF;
    body := d->>'body';
  ELSE
    IF COALESCE(s->>'assetHash','') !~ '^[a-f0-9]{64}$' OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(d->'assets','[]') || COALESCE(d->'retainedAssets','[]')) a
      WHERE a->>'hash'=s->>'assetHash' AND a->>'kind'=s->>'kind'
    ) THEN RAISE EXCEPTION 'PASSAGE_SOURCE_CHANGED' USING ERRCODE='40001'; END IF;
    IF s->>'kind'='pdf' AND (COALESCE(s->>'page','') !~ '^[1-9][0-9]{0,5}$')
      OR s->>'kind'='epub' AND (COALESCE(s->>'chapter','') !~ '^[1-9][0-9]{0,5}$'
        OR COALESCE(s->>'spineIndex','') !~ '^[0-9]{1,6}$'
        OR COALESCE(char_length(s->>'spinePath'),0) NOT BETWEEN 1 AND 1000)
    THEN RAISE EXCEPTION 'PASSAGE_INVALID' USING ERRCODE='23514'; END IF;
  END IF;
  IF s->>'manual' IS DISTINCT FROM 'true' THEN
    IF COALESCE(s->'quote'->>'start','') !~ '^[0-9]{1,9}$'
      OR COALESCE(s->'quote'->>'end','') !~ '^[0-9]{1,9}$'
      OR COALESCE(char_length(s->'quote'->>'exact'),0) < 1
      OR (s->'quote'->>'end')::int-(s->'quote'->>'start')::int <> char_length(s->'quote'->>'exact')
      OR COALESCE(char_length(s->'quote'->>'prefix'),0)>40 OR COALESCE(char_length(s->'quote'->>'suffix'),0)>40
    THEN RAISE EXCEPTION 'PASSAGE_INVALID' USING ERRCODE='23514'; END IF;
    IF s->>'kind'='body' AND substring(body FROM (s->'quote'->>'start')::int+1 FOR char_length(s->'quote'->>'exact'))
      IS DISTINCT FROM s->'quote'->>'exact'
    THEN RAISE EXCEPTION 'PASSAGE_SOURCE_CHANGED' USING ERRCODE='40001'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_source_passage BEFORE INSERT ON public.reading_materials
FOR EACH ROW EXECUTE FUNCTION public.validate_source_passage();
ALTER TABLE public.reading_materials ADD CONSTRAINT source_passage_stays_private CHECK (
  processed_json->'metadata'->'composer'->'passage' IS NULL OR
  (visibility IS NOT DISTINCT FROM 'private' AND owner_id IS NOT NULL)
);

CREATE OR REPLACE FUNCTION public.open_source_passage(p_parent bigint, p_source jsonb, p_text text, p_language text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE
  parent public.reading_materials%ROWTYPE;
  result public.reading_materials%ROWTYPE;
  source jsonb;
  attempt uuid;
  location text;
BEGIN
  SELECT * INTO parent FROM public.reading_materials WHERE id=p_parent AND owner_id=auth.uid() AND visibility='private' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PASSAGE_ACCESS' USING ERRCODE='42501'; END IF;
  IF COALESCE(char_length(p_text),0) NOT BETWEEN 1 AND 1500 OR btrim(p_text)='' THEN RAISE EXCEPTION 'PASSAGE_LENGTH'; END IF;
  IF p_language IS NULL OR p_language NOT IN ('Japanese','Chinese','English','French') THEN RAISE EXCEPTION 'PASSAGE_LANGUAGE'; END IF;
  IF p_source IS NULL OR char_length(p_source::text)>24000 THEN RAISE EXCEPTION 'PASSAGE_INVALID'; END IF;
  -- Only the documented locator fields enter immutable source metadata; never signed URLs or paths.
  source := jsonb_strip_nulls(jsonb_build_object('version',1,'kind',p_source->>'kind',
    'textVersion',p_source->>'textVersion','revision',CASE WHEN p_source->>'kind'='body' THEN p_source->>'revision' END,
    'assetHash',p_source->>'assetHash','page',p_source->'page','chapter',p_source->'chapter',
    'spinePath',p_source->>'spinePath','spineIndex',p_source->'spineIndex',
    'manual',COALESCE(p_source->>'manual'='true',false),
    'quote',CASE WHEN p_source->>'manual'='true' THEN NULL ELSE jsonb_build_object(
      'exact',p_source->'quote'->>'exact','prefix',p_source->'quote'->>'prefix','suffix',p_source->'quote'->>'suffix',
      'start',p_source->'quote'->'start','end',p_source->'quote'->'end') END));
  IF source->>'kind'='body' AND parent.document_json->>'revision' IS DISTINCT FROM source->>'revision' THEN
    RAISE EXCEPTION 'PASSAGE_SOURCE_CHANGED' USING ERRCODE='40001';
  END IF;
  -- Hash is an idempotency identity, not an authorization credential. Source location participates.
  attempt := md5(jsonb_build_array(auth.uid(),p_parent,source,p_text,p_language)::text)::uuid;
  SELECT * INTO result FROM public.reading_materials WHERE owner_id=auth.uid()
    AND processed_json->'metadata'->>'importAttempt'=attempt::text;
  IF FOUND THEN RETURN to_jsonb(result); END IF;
  location := CASE source->>'kind' WHEN 'pdf' THEN source->>'page'||'쪽'
    WHEN 'epub' THEN source->>'chapter'||'장' ELSE '본문' END;
  BEGIN
    INSERT INTO public.reading_materials(owner_id,visibility,title,raw_text,processed_json)
    VALUES(auth.uid(),'private',left(parent.title,200)||' · '||location,p_text,
      jsonb_build_object('status','pending','sequence','[]'::jsonb,'dictionary','{}'::jsonb,'last_idx',-1,
        'metadata',jsonb_build_object('language',p_language,'importAttempt',attempt::text,
          'composer',jsonb_build_object('version',1,'role','study','parentId',p_parent::text,
            'passage',source,'hasBody',true,'excerpt',left(p_text,120),'assets','[]'::jsonb,'links','[]'::jsonb))))
    RETURNING * INTO result;
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO result FROM public.reading_materials WHERE owner_id=auth.uid()
      AND processed_json->'metadata'->>'importAttempt'=attempt::text;
    IF NOT FOUND THEN RAISE; END IF;
  END;
  RETURN to_jsonb(result);
END;
$$;

-- Lease checks live in one RPC. Older open clients cannot overwrite a newer analysis run.
CREATE OR REPLACE FUNCTION public.guard_source_passage_write()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
  IF OLD.processed_json->'metadata'->'composer'->'passage' IS NOT NULL AND
    (NEW.processed_json IS DISTINCT FROM OLD.processed_json OR NEW.raw_text IS DISTINCT FROM OLD.raw_text) AND
    current_setting('manabi.passage_write',true) IS DISTINCT FROM OLD.id::text
  THEN RAISE EXCEPTION 'PASSAGE_USE_ANALYSIS_RPC' USING ERRCODE='40001'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_source_passage_write BEFORE UPDATE OF raw_text,processed_json ON public.reading_materials
FOR EACH ROW EXECUTE FUNCTION public.guard_source_passage_write();

CREATE OR REPLACE FUNCTION public.source_passage_analysis(p_id bigint,p_attempt uuid,p_json jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE r public.reading_materials%ROWTYPE; j jsonb; lease jsonb;
BEGIN
  SELECT * INTO r FROM public.reading_materials WHERE id=p_id AND owner_id=auth.uid() AND visibility='private' FOR UPDATE;
  IF NOT FOUND OR r.processed_json->'metadata'->'composer'->'passage' IS NULL OR p_attempt IS NULL
    THEN RAISE EXCEPTION 'PASSAGE_ACCESS' USING ERRCODE='42501'; END IF;
  j := r.processed_json; lease := j->'metadata'->'passageRun';
  IF p_json IS NULL THEN
    IF j->>'status'='completed' OR (lease->>'until')::timestamptz>clock_timestamp() THEN
      RETURN jsonb_build_object('acquired',false,'material',to_jsonb(r));
    END IF;
    j := jsonb_set(j,'{status}','"analyzing"');
  ELSE
    IF lease->>'attempt' IS DISTINCT FROM p_attempt::text OR (lease->>'until')::timestamptz<clock_timestamp()
      THEN RAISE EXCEPTION 'PASSAGE_ANALYSIS_EXPIRED' USING ERRCODE='40001'; END IF;
    IF char_length(p_json::text)>2000000 OR COALESCE(p_json->>'status','') NOT IN ('pending','analyzing','partial','failed','completed')
      OR jsonb_typeof(p_json->'sequence') IS DISTINCT FROM 'array' OR jsonb_typeof(p_json->'dictionary') IS DISTINCT FROM 'object'
      THEN RAISE EXCEPTION 'PASSAGE_INVALID'; END IF;
    j := p_json || jsonb_build_object('metadata',COALESCE(p_json->'metadata','{}') ||
      jsonb_build_object('composer',r.processed_json->'metadata'->'composer',
        'importAttempt',r.processed_json->'metadata'->'importAttempt','language',r.processed_json->'metadata'->'language'));
  END IF;
  j := jsonb_set(j,'{metadata}',j->'metadata' || jsonb_build_object('updated_at',clock_timestamp(),
    'passageRun',jsonb_build_object('attempt',p_attempt::text,'until',
      CASE WHEN j->>'status'='analyzing' THEN clock_timestamp()+interval '3 minutes' ELSE clock_timestamp() END)));
  PERFORM set_config('manabi.passage_write',p_id::text,true);
  UPDATE public.reading_materials SET processed_json=j WHERE id=p_id RETURNING * INTO r;
  PERFORM set_config('manabi.passage_write','',true);
  RETURN jsonb_build_object('acquired',true,'material',to_jsonb(r));
END;
$$;
REVOKE ALL ON FUNCTION public.open_source_passage(bigint,jsonb,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.source_passage_analysis(bigint,uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.validate_source_passage() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.guard_source_passage_write() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.open_source_passage(bigint,jsonb,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.source_passage_analysis(bigint,uuid,jsonb) TO authenticated;
