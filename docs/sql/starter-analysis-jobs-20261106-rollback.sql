-- 복원: supabase/migrations/20261106210000_starter_analysis_jobs.sql → starter 작업 줄을 지우고 표 제약 · 저장 함수를 20261024120000으로.
-- 이미 저장한 시드 분석(reading_materials)은 그대로 남는다(되돌리지 않는다 — 다시 idle로 만들 이유가 없다). 필요할 때만 오너 확인 뒤 실행.
BEGIN;
DELETE FROM public.canonical_analysis_jobs WHERE kind = 'starter';
ALTER TABLE public.canonical_analysis_jobs DROP CONSTRAINT IF EXISTS canonical_analysis_jobs_usage;
ALTER TABLE public.canonical_analysis_jobs DROP CONSTRAINT IF EXISTS canonical_analysis_jobs_keys,
  ADD CONSTRAINT canonical_analysis_jobs_keys CHECK (cardinality(book_keys) BETWEEN 1 AND 200);
ALTER TABLE public.canonical_analysis_jobs DROP CONSTRAINT IF EXISTS canonical_analysis_jobs_kind,
  ADD CONSTRAINT canonical_analysis_jobs_kind CHECK (kind IN ('literature', 'art'));
ALTER TABLE public.canonical_analysis_jobs DROP COLUMN IF EXISTS material_ids, DROP COLUMN IF EXISTS llm_usage;
CREATE OR REPLACE FUNCTION public.canonical_analysis_save(
  p_job bigint, p_id bigint, p_expected_raw text, p_expected_json jsonb,
  p_raw text, p_json jsonb, p_attempt uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE
  j public.canonical_analysis_jobs%rowtype;
  r public.reading_materials%rowtype;
BEGIN
  SELECT * INTO j FROM public.canonical_analysis_jobs WHERE id = p_job;
  IF NOT FOUND OR j.status NOT IN ('running', 'paused') THEN
    RAISE EXCEPTION '서버 분석 작업이 끝났어요.' USING ERRCODE = '40001';
  END IF;
  SELECT * INTO r FROM public.reading_materials
    WHERE id = p_id AND owner_id = j.owner_id AND visibility = 'private'
      AND processed_json #>> '{metadata,book,key}' = ANY (j.book_keys)
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '작업의 비공개 장이 아니에요.' USING ERRCODE = '42501'; END IF;
  IF r.processed_json -> 'metadata' ->> 'viewerRevision' = p_attempt::text
    AND r.raw_text IS NOT DISTINCT FROM p_raw AND r.processed_json IS NOT DISTINCT FROM p_json THEN
    RETURN jsonb_build_object('material', to_jsonb(r));
  END IF;
  IF r.raw_text IS DISTINCT FROM p_expected_raw OR r.processed_json IS DISTINCT FROM p_expected_json THEN
    RAISE EXCEPTION '다른 창에서 자료가 바뀌었어요. 다시 열어 확인해 주세요.' USING ERRCODE = '40001';
  END IF;
  IF p_attempt IS NULL OR p_raw IS NULL OR length(btrim(p_raw)) = 0
    OR jsonb_typeof(p_json -> 'sequence') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_json -> 'dictionary') IS DISTINCT FROM 'object'
    OR p_json -> 'metadata' ->> 'viewerRevision' IS DISTINCT FROM p_attempt::text THEN
    RAISE EXCEPTION '분석 결과를 확인하지 못했어요.' USING ERRCODE = '22023';
  END IF;
  IF r.processed_json -> 'metadata' -> 'passageRun' IS NOT NULL
    AND (r.processed_json -> 'metadata' -> 'passageRun' ->> 'until')::timestamptz > clock_timestamp() THEN
    RAISE EXCEPTION '다른 분석이 진행 중입니다.' USING ERRCODE = '40001';
  END IF;
  UPDATE public.reading_materials SET raw_text = p_raw, processed_json = p_json
    WHERE id = p_id RETURNING * INTO r;
  RETURN jsonb_build_object('material', to_jsonb(r));
END;
$$;
REVOKE ALL ON FUNCTION public.canonical_analysis_save(bigint, bigint, text, jsonb, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.canonical_analysis_save(bigint, bigint, text, jsonb, text, jsonb, uuid) TO service_role;
COMMIT;
