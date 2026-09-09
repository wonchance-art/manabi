-- Owner-approved production verification. All test rows and changes roll back.
-- Resolve the existing teacher internally; never copy auth credentials or publish user IDs.
BEGIN;
SET LOCAL statement_timeout = '20s';
DO $$
DECLARE teacher uuid;
BEGIN
  SELECT owner_id INTO teacher FROM public.reading_materials
  WHERE processed_json #>> '{metadata,team,root}'='true' ORDER BY id LIMIT 1;
  IF teacher IS NULL THEN RAISE EXCEPTION 'An existing teacher is required'; END IF;
  PERFORM set_config('request.jwt.claim.sub',teacher::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  root_id bigint; teacher uuid := auth.uid(); note_id bigint;
  op uuid := gen_random_uuid(); r jsonb; again jsonb; before_json jsonb; after_json jsonb;
  rejected boolean; scope_key text := 'verification-'||gen_random_uuid()::text;
BEGIN
  INSERT INTO public.reading_materials(owner_id,title,raw_text,visibility,processed_json)
  VALUES(teacher,'수업 저장 검수 · 롤백','수업 저장 검수','private',
    jsonb_build_object('sequence','[]'::jsonb,'dictionary','{}'::jsonb,
      'metadata',jsonb_build_object('language','Japanese','preserved','keep',
        'team',jsonb_build_object('root',true,'key',scope_key,'name','검수','lang','Japanese'))))
  RETURNING id,processed_json INTO root_id,before_json;

  r := public.classroom_append_entry(root_id,'2099-01-01','また来週',op);
  note_id := (r #>> '{material,id}')::bigint;
  IF r #>> '{material,raw_text}' IS DISTINCT FROM 'また来週' OR r #>> '{material,owner_id}' IS DISTINCT FROM teacher::text
    OR r #>> '{material,visibility}' IS DISTINCT FROM 'private' THEN RAISE EXCEPTION 'Owner/private raw save failed'; END IF;
  again := public.classroom_append_entry(root_id,'2099-01-01','また来週',op);
  IF again #>> '{material,id}' IS DISTINCT FROM note_id::text OR again->>'replayed' IS DISTINCT FROM 'true'
    OR again #>> '{material,raw_text}' IS DISTINCT FROM 'また来週' THEN RAISE EXCEPTION 'Replay duplicated input'; END IF;

  rejected := false;
  BEGIN PERFORM public.classroom_append_entry(root_id,'2099-01-01','changed',op);
  EXCEPTION WHEN SQLSTATE '22023' THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Changed replay was accepted'; END IF;

  r := public.classroom_append_entry(root_id,'2099-01-01','また来週',gen_random_uuid());
  IF r #>> '{material,raw_text}' IS DISTINCT FROM E'また来週\n\nまた来週' THEN RAISE EXCEPTION 'Intentional repetition lost'; END IF;
  UPDATE public.reading_materials SET processed_json=jsonb_set(processed_json,'{metadata,verificationMeaning}','"keep"') WHERE id=note_id;
  r := public.classroom_append_entry(root_id,'2099-01-01',E'一行目\n二行目',gen_random_uuid());
  IF r #>> '{material,raw_text}' IS DISTINCT FROM E'また来週\n\nまた来週\n\n一行目\n二行目'
    OR jsonb_array_length(r #> '{material,processed_json,metadata,classEntries}') IS DISTINCT FROM 4
    THEN RAISE EXCEPTION 'Multiline source or entry count differs'; END IF;
  IF r #>> '{material,processed_json,metadata,verificationMeaning}' IS DISTINCT FROM 'keep'
    THEN RAISE EXCEPTION 'Prior metadata was overwritten'; END IF;
  SELECT processed_json INTO after_json FROM public.reading_materials WHERE id=root_id;
  IF (after_json->'metadata')-'viewerRevision'-'classPresentation' IS DISTINCT FROM before_json->'metadata'
    THEN RAISE EXCEPTION 'Root metadata was overwritten'; END IF;
  IF (SELECT count(*) FROM public.reading_materials WHERE processed_json #>> '{metadata,team,key}'=scope_key
       AND processed_json #>> '{metadata,team,day}'='2099-01-01')<>1
    THEN RAISE EXCEPTION 'Duplicate day note'; END IF;

  PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  rejected := false;
  BEGIN PERFORM public.classroom_append_entry(root_id,'2099-01-01','foreign',gen_random_uuid());
  EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Another account was allowed'; END IF;
  PERFORM set_config('request.jwt.claim.sub','',true);
  rejected := false;
  BEGIN PERFORM public.classroom_append_entry(root_id,'2099-01-01','signed out',gen_random_uuid());
  EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Signed-out request was allowed'; END IF;
END $$;
RESET ROLE;
SELECT jsonb_build_object('assertions',10,'passed',true,'test_changes','ROLLBACK') AS verification;
ROLLBACK;
