-- Owner-approved live SQL check. Synthetic material only; all writes roll back.
-- Resolve the already-open verification material internally, without exporting user IDs.
BEGIN;
SET LOCAL statement_timeout = '20s';
DO $$
DECLARE verification_owner uuid;
BEGIN
  SELECT owner_id INTO verification_owner FROM public.reading_materials
  WHERE id=250 AND title LIKE '[검수용 0918]%';
  IF verification_owner IS NULL THEN RAISE EXCEPTION 'Known verification material required'; END IF;
  IF EXISTS(SELECT 1 FROM public.reading_materials WHERE id=-92524114728) THEN
    RAISE EXCEPTION 'Verification material ID already exists';
  END IF;
  PERFORM set_config('request.jwt.claim.sub',verification_owner::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  first_token jsonb := '{"text":"图书馆","meaning":"도서관","furigana":"tú shū guǎn","pos":"명사"}';
  second_token jsonb := '{"text":"学生","meaning":"학생","pos":"명사"}';
  original jsonb; result jsonb; saved jsonb; expected jsonb; rejected boolean;
  owner_id uuid := auth.uid();
BEGIN
  INSERT INTO public.reading_materials(id,owner_id,title,raw_text,visibility,processed_json)
  VALUES(-92524114728,owner_id,'저장 보호 SQL 검수 · 롤백','图书馆 学生','private',
    jsonb_build_object('status','completed','sequence',jsonb_build_array('one','two'),
      'dictionary',jsonb_build_object('one',first_token,'two',second_token),
      'metadata',jsonb_build_object('language','Chinese','preserved','keep')));
  SELECT to_jsonb(m) INTO original FROM public.reading_materials m WHERE id=-92524114728;
  PERFORM public.viewer_correct_token(-92524114728,'one',first_token,'{"meaning":"자료실"}','图书馆 学生');
  PERFORM public.viewer_correct_token(-92524114728,'two',second_token,'{"meaning":"학습자"}','图书馆 学生');
  expected:=jsonb_set(jsonb_set(original,'{processed_json,dictionary,one,meaning}','"자료실"'),
    '{processed_json,dictionary,two,meaning}','"학습자"');
  SELECT to_jsonb(m) INTO saved FROM public.reading_materials m WHERE id=-92524114728;
  IF saved IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Different-token or surrounding data preservation failed'; END IF;

  result:=public.viewer_correct_token(-92524114728,'one',first_token,'{"meaning":"서고"}','图书馆 学生');
  IF result->>'conflict' IS DISTINCT FROM 'token' OR result#>>'{current_token,meaning}' IS DISTINCT FROM '자료실'
    THEN RAISE EXCEPTION 'Same-token conflict failed'; END IF;
  IF saved IS DISTINCT FROM (SELECT to_jsonb(m) FROM public.reading_materials m WHERE id=-92524114728)
    THEN RAISE EXCEPTION 'Conflict changed data'; END IF;
  result:=public.viewer_correct_token(-92524114728,'one',result->'current_token','{"meaning":"서고"}','图书馆 学生');
  IF result#>>'{material,processed_json,dictionary,one,meaning}' IS DISTINCT FROM '서고'
    THEN RAISE EXCEPTION 'Confirmed save failed'; END IF;
  result:=public.viewer_correct_token(-92524114728,'one',first_token||'{"meaning":"자료실"}',
    '{"meaning":"서고"}','图书馆 学生');
  IF result->>'applied' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'Lost-response reconciliation failed'; END IF;

  rejected:=false;
  BEGIN PERFORM public.viewer_correct_token(-92524114728,'one',first_token,'{"meaning":"x"}','changed');
  EXCEPTION WHEN SQLSTATE '40001' THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Changed source accepted'; END IF;
  rejected:=false;
  BEGIN PERFORM public.viewer_correct_token(-92524114728,'one',first_token,'{"text":"changed"}','图书馆 学生');
  EXCEPTION WHEN SQLSTATE '22023' THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Forbidden field accepted'; END IF;
  rejected:=false;
  BEGIN PERFORM public.viewer_correct_token(-92524114728,'missing',first_token,'{"meaning":"x"}','图书馆 学生');
  EXCEPTION WHEN SQLSTATE '40001' THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Missing token accepted'; END IF;

  PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  rejected:=false;
  BEGIN PERFORM public.viewer_correct_token(-92524114728,'one',first_token,'{"meaning":"x"}','图书馆 学生');
  EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Other owner accepted'; END IF;
  PERFORM set_config('request.jwt.claim.sub','',true);
  rejected:=false;
  BEGIN PERFORM public.viewer_correct_token(-92524114728,'one',first_token,'{"meaning":"x"}','图书馆 学生');
  EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Signed-out request accepted'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT jsonb_build_object('assertions',10,'passed',true,'test_changes','ROLLBACK',
  'remaining_test_rows',(SELECT count(*) FROM public.reading_materials WHERE id=-92524114728)) AS verification;
