-- 공개 자료의 난이도 요약 한 칸(processed_json.metadata.difficulty)을 쓰는 좁은 RPC(MATERIAL-DIFFICULTY-002 — 2026-11-08 KST,
-- 오케스트레이터 13:15 「디자인 M2 공개 카드 난이도 한 줄」, 오너 11/4 「백엔드 · 데이터 자율」). 적용 경로 = main 병합 → db push, 암묵 트랜잭션 하나.
--
-- 왜: 급수 색인(HSK · JLPT 수천 행)을 브라우저에서 계산하면 손님 목록 JS가 수 MB 늘어난다. 서버가 정본 materialDifficulty(#1743)로
--   미리 셈해 둔다. 계산은 JS 정본만 한다(SQL로 같은 판정을 다시 짜지 않는다 — 나침반 ⑵). 이 함수는 그 결과를 「한 칸만」 쓴다.
-- 쓰는 쪽: src/lib/server/materialDifficultyRefresh.js(서버 분석 작업 예약 실행 tick 끝 — /api/cron/analysis-jobs, 02:45 KST).
--   첫 실행이 공개 132편 백필이고, 이후 새 시드 · 재분석(재분석은 이 칸을 지운다)분을 채운다.
-- 하는 것: 공개 · completed · metadata가 객체인 자료 한 행의 metadata.difficulty만 jsonb_set. 원문 · 분석 · 다른 metadata 칸 · 공개 범위 · 소유권 그대로.
--   p_expected_updated_at(그 행의 metadata.updated_at)이 다르면 쓰지 않는다 — 셈하는 사이 재분석이 끼어들면 옛 결과를 덮지 않게(false).
-- 권한: service_role만 실행(anon · authenticated 닫힘 — 사후 검사). 학습 계약 지문 범위 밖(새 public 함수 · fsrs_ 아님) — 사후 검사가 지문 넷 불변 확인.
-- 복원: docs/sql/material-set-difficulty-20261108-rollback.sql(함수 삭제 + 모든 행의 metadata.difficulty 칸 제거 — 지금 0행에 있다).

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TEMP TABLE msd_pins (k text PRIMARY KEY, v text) ON COMMIT DROP;
CREATE FUNCTION pg_temp.msd_measure() RETURNS TABLE (k text, v text) LANGUAGE plpgsql AS $m$
DECLARE f record; val text;
BEGIN
  FOR f IN SELECT * FROM (VALUES ('core', 'fsrs_private', 'contract_hash_live'), ('manual', 'fsrs_private', 'manual_contract_hash_live'),
      ('admission', 'fsrs_private', 'admission_contract_hash_live'), ('activity', 'fsrs_private', 'activity_profile_hash_live')) x(k, sch, fn) LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = f.sch AND p.proname = f.fn AND p.pronargs = 0) THEN
      EXECUTE format('SELECT %I.%I()::text', f.sch, f.fn) INTO val;
    ELSE val := NULL; END IF;
    k := f.k; v := val; RETURN NEXT;
  END LOOP;
END $m$;
INSERT INTO pg_temp.msd_pins SELECT * FROM pg_temp.msd_measure();

DO $pre$
BEGIN
  IF to_regclass('public.reading_materials') IS NULL THEN
    RAISE EXCEPTION 'relation public.reading_materials does not exist' USING ERRCODE = '42P01';
  END IF;
  RAISE NOTICE 'material difficulty: % rows already carry metadata.difficulty',
    (SELECT count(*) FROM public.reading_materials WHERE processed_json->'metadata' ? 'difficulty');
END $pre$;

CREATE OR REPLACE FUNCTION public.material_set_difficulty(p_id bigint, p_difficulty jsonb, p_expected_updated_at text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE n integer;
BEGIN
  IF p_id IS NULL OR p_difficulty IS NULL OR jsonb_typeof(p_difficulty) <> 'object' OR (p_difficulty->>'version') IS NULL
     OR pg_catalog.length(p_difficulty::text) > 2000 THEN
    RAISE EXCEPTION 'difficulty_invalid' USING ERRCODE = '22023';
  END IF;
  UPDATE public.reading_materials m
     SET processed_json = jsonb_set(m.processed_json, '{metadata,difficulty}', p_difficulty, true)
   WHERE m.id = p_id
     AND m.visibility = 'public'
     AND m.processed_json->>'status' = 'completed'
     AND jsonb_typeof(m.processed_json->'metadata') = 'object'
     AND (m.processed_json->'metadata'->>'updated_at') IS NOT DISTINCT FROM p_expected_updated_at;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 1;
END
$function$;

REVOKE ALL ON FUNCTION public.material_set_difficulty(bigint, jsonb, text) FROM PUBLIC;
DO $grants$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE 'REVOKE ALL ON FUNCTION public.material_set_difficulty(bigint, jsonb, text) FROM anon'; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE 'REVOKE ALL ON FUNCTION public.material_set_difficulty(bigint, jsonb, text) FROM authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN EXECUTE 'GRANT EXECUTE ON FUNCTION public.material_set_difficulty(bigint, jsonb, text) TO service_role'; END IF;
END $grants$;

DO $post$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AND has_function_privilege('anon', 'public.material_set_difficulty(bigint, jsonb, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'material_set_difficulty must be closed to anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') AND has_function_privilege('authenticated', 'public.material_set_difficulty(bigint, jsonb, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'material_set_difficulty must be closed to authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_temp.msd_pins b FULL JOIN pg_temp.msd_measure() a USING (k) WHERE a.v IS DISTINCT FROM b.v) THEN
    RAISE EXCEPTION 'material difficulty: learning contract fingerprint changed — abort';
  END IF;
END $post$;

DROP FUNCTION pg_temp.msd_measure();
