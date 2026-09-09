-- 검토용 DDL. 운영 적용 전 실제 스키마·RLS 검수 필요. 기존 테이블/행은 변경하지 않는다.
CREATE OR REPLACE FUNCTION public.viewer_replace_analysis(
  p_id bigint, p_expected_raw text, p_expected_json jsonb,
  p_raw text, p_json jsonb, p_attempt uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public AS $$
DECLARE r public.reading_materials%rowtype;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.reading_materials
    WHERE id=p_id AND owner_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '자료가 없거나 수정 권한이 없습니다.' USING ERRCODE='42501'; END IF;
  -- 응답 유실 뒤 동일 요청 재확인은 성공으로 돌려주고 두 번 쓰지 않는다.
  IF r.processed_json->'metadata'->>'viewerRevision'=p_attempt::text
    AND r.raw_text IS NOT DISTINCT FROM p_raw AND r.processed_json IS NOT DISTINCT FROM p_json THEN
    RETURN jsonb_build_object('material',to_jsonb(r));
  END IF;
  IF r.raw_text IS DISTINCT FROM p_expected_raw OR r.processed_json IS DISTINCT FROM p_expected_json THEN
    RAISE EXCEPTION '다른 창에서 자료가 바뀌었어요. 다시 열어 확인해 주세요.' USING ERRCODE='40001';
  END IF;
  IF p_attempt IS NULL OR p_raw IS NULL OR length(btrim(p_raw))=0
    OR jsonb_typeof(p_json->'sequence') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_json->'dictionary') IS DISTINCT FROM 'object'
    OR p_json->'metadata'->>'viewerRevision' IS DISTINCT FROM p_attempt::text THEN
    RAISE EXCEPTION '분석 결과를 확인하지 못했어요.' USING ERRCODE='22023';
  END IF;
  -- 현재 소스 구간 임대 중에는 기존 분석 경로를 침범하지 않는다.
  IF r.processed_json->'metadata'->'passageRun' IS NOT NULL
    AND (r.processed_json->'metadata'->'passageRun'->>'until')::timestamptz > clock_timestamp() THEN
    RAISE EXCEPTION '다른 분석이 진행 중입니다.' USING ERRCODE='40001';
  END IF;
  UPDATE public.reading_materials SET raw_text=p_raw, processed_json=p_json
    WHERE id=p_id AND owner_id=auth.uid() RETURNING * INTO r;
  RETURN jsonb_build_object('material',to_jsonb(r));
END;
$$;
REVOKE ALL ON FUNCTION public.viewer_replace_analysis(bigint,text,jsonb,text,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.viewer_replace_analysis(bigint,text,jsonb,text,jsonb,uuid) TO authenticated;

-- 이 저장으로 만든 행과 문맥만 취소한다. 새 복습/수정/문맥 추가가 있으면 중단한다.
-- 소유권을 먼저 확인한 후 RLS로 숨겨진 문맥까지 개수를 대조한다. 숨겨진 출처를
-- CASCADE로 지우는 것을 막기 위해 이 함수만 DEFINER이며 읽은 내용은 반환하지 않는다.
CREATE OR REPLACE FUNCTION public.viewer_undo_vocabulary_save(p_id uuid, p_expected jsonb, p_context_ids uuid[])
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v public.user_vocabulary%rowtype; current_ids uuid[]; expected_ids uuid[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE='42501'; END IF;
  SELECT * INTO v FROM public.user_vocabulary WHERE id=p_id AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF to_jsonb(v) IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION '이후 학습이나 수정이 있어 저장을 취소하지 않았어요.' USING ERRCODE='40001';
  END IF;
  SELECT coalesce(array_agg(id ORDER BY id),'{}'::uuid[]) INTO current_ids
    FROM public.vocabulary_contexts WHERE vocabulary_id=p_id;
  SELECT coalesce(array_agg(id ORDER BY id),'{}'::uuid[]) INTO expected_ids FROM unnest(p_context_ids) id;
  IF current_ids IS DISTINCT FROM expected_ids THEN
    RAISE EXCEPTION '다른 문맥이 추가되어 저장을 취소하지 않았어요.' USING ERRCODE='40001';
  END IF;
  DELETE FROM public.user_vocabulary WHERE id=p_id AND user_id=auth.uid();
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.viewer_undo_vocabulary_save(uuid,jsonb,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.viewer_undo_vocabulary_save(uuid,jsonb,uuid[]) TO authenticated;
