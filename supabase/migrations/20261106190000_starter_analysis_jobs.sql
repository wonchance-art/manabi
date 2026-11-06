-- 공개 시드(스타터) 자료를 서버 분석 작업으로(STARTER-ANALYSIS-001 — 발매 준비 점검 3, 오케스트레이터 판정 2026-11-06 KST:
-- 「서버 분석 작업에 'starter'(공개 시드) 종류 추가 — 자료 id 목록 명시 · CHECK · 계약 · 일일 상한과 같은 회계 · 실패 3연속 멈춤」,
-- 비용 추정(≤ 약 330회 · ≤ 약 100만 토큰, Claude Haiku 1순위) 승인 · 오너 11/4 「백엔드 · 데이터 자율」).
-- 적용 경로 = main 병합 → supabase-migrations.yml(db push), 암묵 트랜잭션 하나(검사가 RAISE하면 전부 롤백).
--
-- 배경(운영 실측 2026-11-06 KST): 공개 일본어 63편 중 58 · 영어 60편 전부가 idle(분석 전) — 「분석하기」는 소유자에게만 보여
-- 새 사용자는 원문만 보고 단어를 누를 수 없다. 서버 분석 작업(canonical_analysis_jobs, CANON-SERVER-ANALYSIS-001)은 책 전용이었다.
--
-- 이 파일이 하는 것:
--   ⑴ canonical_analysis_jobs: kind에 'starter' · material_ids bigint[](starter만 — 1~200개, 책 key는 빈 배열) · llm_usage jsonb
--      (tick이 이 작업 동안 쓴 LLM 호출 · 토큰을 모델별로 더한다 — 실제 비용 보고용).
--   ⑵ canonical_analysis_save: starter 작업은 「작업 관리자 소유 · 공개 · 작업의 material_ids 안」 자료만 쓴다(책 작업은 그대로 비공개 장만).
--      나머지(비교 저장 · 같은 시도 재전송 · 결과 모양 · 구간 임대)는 한 줄도 다르지 않다.
--   ⑶ 작업 한 줄 시작: 위 조건의 공개 시드(일 · 영, idle/pending/saved, 원문 있음, 수업 팀 · 정본 책 아님 — 관리자 「일괄 분석」 패널
--      BULK-ANALYZE-001과 같은 집합)를 id 차례로. 소유자가 한 사람이고 1~200편이고 그 사람에게 도는 작업이 없을 때만(아니면 건너뛰고 알림).
--      이미 starter 작업이 있으면 다시 만들지 않는다. 깨우기는 기존 하루 한 번 예약 실행(/api/cron/analysis-jobs) — 그 뒤 tick이 스스로 잇는다.
-- 학습 계약 지문(core · manual · admission · activity · capability 9표) 범위 밖 — reading_materials 정책 · 트리거 · 제약 무변경.
--   사후 검사가 네 지문 불변을 확인한다(로그인 없이 읽힌다 — #1696 교훈).
-- 복원: docs/sql/starter-analysis-jobs-20261106-rollback.sql(starter 작업 줄을 지우고 ⑴ ⑵를 되돌린다 — 이미 저장한 분석은 그대로 남는다).

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $pre$
BEGIN
  IF to_regclass('public.canonical_analysis_jobs') IS NULL OR to_regclass('public.reading_materials') IS NULL THEN
    RAISE EXCEPTION 'relation public.canonical_analysis_jobs does not exist' USING ERRCODE = '42P01';
  END IF;
END $pre$;

CREATE TEMP TABLE saj_pins (k text PRIMARY KEY, v text) ON COMMIT DROP;
CREATE FUNCTION pg_temp.saj_measure() RETURNS TABLE (k text, v text) LANGUAGE plpgsql AS $m$
DECLARE f record; val text;
BEGIN
  FOR f IN SELECT * FROM (VALUES ('core', 'contract_hash_live'), ('manual', 'manual_contract_hash_live'),
      ('admission', 'admission_contract_hash_live'), ('activity', 'activity_profile_hash_live')) x(k, fn) LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = 'fsrs_private' AND p.proname = f.fn AND p.pronargs = 0) THEN
      EXECUTE format('SELECT fsrs_private.%I()::text', f.fn) INTO val;
    ELSE val := NULL; END IF;
    k := f.k; v := val; RETURN NEXT;
  END LOOP;
  k := 'materials'; SELECT count(*)::text || '|' || md5(coalesce(string_agg(id::text || ':' || md5(coalesce(processed_json::text, '')), ',' ORDER BY id), ''))
    INTO v FROM public.reading_materials; RETURN NEXT;
END $m$;
INSERT INTO pg_temp.saj_pins SELECT * FROM pg_temp.saj_measure();

-- ⑴ 표
ALTER TABLE public.canonical_analysis_jobs ADD COLUMN IF NOT EXISTS material_ids bigint[];
ALTER TABLE public.canonical_analysis_jobs ADD COLUMN IF NOT EXISTS llm_usage jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.canonical_analysis_jobs DROP CONSTRAINT IF EXISTS canonical_analysis_jobs_kind,
  ADD CONSTRAINT canonical_analysis_jobs_kind CHECK (kind IN ('literature', 'art', 'starter'));
ALTER TABLE public.canonical_analysis_jobs DROP CONSTRAINT IF EXISTS canonical_analysis_jobs_keys,
  ADD CONSTRAINT canonical_analysis_jobs_keys CHECK (
    (kind = 'starter' AND cardinality(book_keys) = 0 AND material_ids IS NOT NULL AND cardinality(material_ids) BETWEEN 1 AND 200)
    OR (kind <> 'starter' AND material_ids IS NULL AND cardinality(book_keys) BETWEEN 1 AND 200));
ALTER TABLE public.canonical_analysis_jobs DROP CONSTRAINT IF EXISTS canonical_analysis_jobs_usage,
  ADD CONSTRAINT canonical_analysis_jobs_usage CHECK (jsonb_typeof(llm_usage) = 'object');

-- ⑵ 저장 함수 — starter 갈래만 더한다(아래 「작업의 자료」 조건 외에는 20261024120000과 같다).
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
  -- 멈춤을 누른 사이 끝난 장은 저장한다(분석 비용을 버리지 않는다). 끝난 · 실패한 작업은 쓰지 않는다.
  IF NOT FOUND OR j.status NOT IN ('running', 'paused') THEN
    RAISE EXCEPTION '서버 분석 작업이 끝났어요.' USING ERRCODE = '40001';
  END IF;
  IF j.kind = 'starter' THEN
    -- 공개 시드: 작업 관리자 소유 · 공개 · 작업이 시작할 때 고른 자료 id 안에서만(STARTER-ANALYSIS-001).
    SELECT * INTO r FROM public.reading_materials
      WHERE id = p_id AND owner_id = j.owner_id AND visibility = 'public' AND p_id = ANY (j.material_ids)
      FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION '작업의 공개 시드 자료가 아니에요.' USING ERRCODE = '42501'; END IF;
  ELSE
    SELECT * INTO r FROM public.reading_materials
      WHERE id = p_id AND owner_id = j.owner_id AND visibility = 'private'
        AND processed_json #>> '{metadata,book,key}' = ANY (j.book_keys)
      FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION '작업의 비공개 장이 아니에요.' USING ERRCODE = '42501'; END IF;
  END IF;
  -- 아래는 viewer_replace_analysis와 같다(응답 유실 뒤 같은 시도 재전송은 성공 · 다른 창 변경은 거절 · 결과 모양 확인 · 구간 임대 존중).
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

REVOKE ALL ON FUNCTION public.canonical_analysis_save(bigint, bigint, text, jsonb, text, jsonb, uuid) FROM PUBLIC;
DO $grants$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE 'REVOKE ALL ON FUNCTION public.canonical_analysis_save(bigint, bigint, text, jsonb, text, jsonb, uuid) FROM anon'; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE 'REVOKE ALL ON FUNCTION public.canonical_analysis_save(bigint, bigint, text, jsonb, text, jsonb, uuid) FROM authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN EXECUTE 'GRANT EXECUTE ON FUNCTION public.canonical_analysis_save(bigint, bigint, text, jsonb, text, jsonb, uuid) TO service_role'; END IF;
END $grants$;

-- ⑶ 작업 한 줄 — 관리자 「일괄 분석」 패널(BULK-ANALYZE-001)과 같은 대상 집합을 id 차례로.
DO $start$
DECLARE owners int; ids bigint[]; who uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.canonical_analysis_jobs WHERE kind = 'starter') THEN
    RAISE NOTICE 'starter job already exists — not creating another'; RETURN;
  END IF;
  SELECT count(DISTINCT owner_id), array_agg(id ORDER BY id), min(owner_id::text)::uuid INTO owners, ids, who
    FROM public.reading_materials
   WHERE visibility = 'public' AND owner_id IS NOT NULL
     AND processed_json ->> 'status' IN ('idle', 'pending', 'saved')
     AND length(btrim(coalesce(raw_text, ''))) > 0
     AND processed_json -> 'metadata' -> 'team' IS NULL
     AND processed_json #>> '{metadata,book,key}' IS NULL
     AND processed_json -> 'metadata' ->> 'language' IN ('Japanese', 'English');
  IF owners IS DISTINCT FROM 1 OR cardinality(ids) NOT BETWEEN 1 AND 200 THEN
    RAISE NOTICE 'starter job not created: % owners, % materials', owners, coalesce(cardinality(ids), 0); RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.canonical_analysis_jobs WHERE owner_id = who AND status = 'running') THEN
    RAISE NOTICE 'starter job not created: owner already has a running job'; RETURN;
  END IF;
  INSERT INTO public.canonical_analysis_jobs (owner_id, kind, book_keys, material_ids) VALUES (who, 'starter', '{}', ids);
  RAISE NOTICE 'starter job created: % materials', cardinality(ids);
END $start$;

DO $post$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'canonical_analysis_jobs_kind'
                 AND pg_get_constraintdef(oid) LIKE '%starter%') THEN
    RAISE EXCEPTION 'starter jobs: kind check not updated';
  END IF;
  IF has_function_privilege('anon', 'public.canonical_analysis_save(bigint,bigint,text,jsonb,text,jsonb,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.canonical_analysis_save(bigint,bigint,text,jsonb,text,jsonb,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'starter jobs: canonical_analysis_save must stay service_role only';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_temp.saj_pins b FULL JOIN pg_temp.saj_measure() a USING (k) WHERE a.v IS DISTINCT FROM b.v) THEN
    RAISE EXCEPTION 'starter jobs: materials or learning contract fingerprints changed — abort';
  END IF;
END $post$;

DROP FUNCTION pg_temp.saj_measure();
