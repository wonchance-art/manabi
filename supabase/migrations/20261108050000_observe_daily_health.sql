-- 운영 일일 상태 점검(OPS-HEALTH-001 — 2026-11-08 KST, 오케스트레이터 16:25 「크론 결과 · 오류 · 하루 상한을 한 번에」). 백엔드 · 데이터만(화면은 목업 대상).
-- 적용 경로 = main 병합 → db push, 암묵 트랜잭션 하나. 새 크론 · 새 환경 변수 없음 — 기존 크론 네 경로가 끝에 실행 한 줄을 남기고,
-- 분석 작업 크론(02:45 KST, 하루 마지막 크론)이 사슬 끝에서 점검을 한 번 기록한다.
--
-- 만드는 것(모두 observe 스키마 · RLS 켜짐 · 표 직접 권한 없음 — observe.error_events와 같은 틀):
--   observe.cron_runs      크론 실행 한 줄(job · 시작 · 끝 · ok · 처리 수 · 실패 수 · 짧은 detail). 90일 보존(쓸 때 조금씩 지움).
--   observe.health_checks  하루(KST) 한 줄 점검 기록 — 지문 넷 · 이상 목록 · 보고 전체 · 경보를 남긴 때.
--   public.observe_record_cron_run(...)  크론이 부른다. service_role만.
--   public.observe_daily_health(p_now, p_record)  읽기 전용 보고(jsonb). p_record = true면 그날 줄을 남기고, 이상이 있으면
--     observe.error_events에 kind 'health.alert' 한 줄(하루 한 번 — health_checks.alerted_at). service_role만.
-- 이상 기준(계약 supabase/tests/observe-daily-health.mjs · src/lib/__tests__/opsHealth.test.js):
--   cron_missing:<job>      지난 26시간에 그 크론의 실행 줄이 없음(하루 한 번 예약 + 지연 여유 2시간)
--   cron_failed:<job>       지난 26시간 실행 중 ok = false가 있거나 실패 수 > 0
--   fingerprint_missing:<k> 지문 함수가 없음 · fingerprint_changed:<k> 전날 점검과 다름(의도한 계약 변경이면 한 번 울리고 다음 날 조용해진다)
--   server_errors           지난 24시간 server 쪽 오류 줄 > 0(health.alert 자신은 빼고)
--   suggestions_empty       오늘(KST) 오늘의 소식 0줄인데 수집 크론은 돌았음
--   difficulty_unfilled     공개 · completed 중 난이도 요약(version 1) 없는 자료 > 0인데 분석 작업 크론은 돌았음
-- 학습 계약 지문 범위 밖(observe 스키마 · public 함수 이름 observe_*, fsrs_ 아님) — 사후 검사가 지문 넷 불변 확인.
-- 복원: docs/sql/observe-daily-health-20261108-rollback.sql(함수 둘 · 표 둘 삭제 — 기존 자료 무관).

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TEMP TABLE odh_pins (k text PRIMARY KEY, v text) ON COMMIT DROP;
CREATE FUNCTION pg_temp.odh_measure() RETURNS TABLE (k text, v text) LANGUAGE plpgsql AS $m$
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
END $m$;
INSERT INTO pg_temp.odh_pins SELECT * FROM pg_temp.odh_measure();

DO $pre$
BEGIN
  IF to_regclass('observe.error_events') IS NULL THEN
    RAISE EXCEPTION 'relation observe.error_events does not exist' USING ERRCODE = '42P01';
  END IF;
  IF to_regprocedure('public.observe_record_error(text,text,text,text,text,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'observe_record_error is required' USING ERRCODE = '42883';
  END IF;
END $pre$;

CREATE TABLE IF NOT EXISTS observe.cron_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job text NOT NULL CHECK (job ~ '^[a-z][a-z0-9-]{1,40}$'),
  started_at timestamptz NOT NULL,
  finished_at timestamptz NOT NULL DEFAULT now(),
  ok boolean NOT NULL,
  processed integer NOT NULL DEFAULT 0 CHECK (processed >= 0),
  failed integer NOT NULL DEFAULT 0 CHECK (failed >= 0),
  detail jsonb CHECK (detail IS NULL OR pg_column_size(detail) <= 4000)
);
CREATE INDEX IF NOT EXISTS cron_runs_job_finished_idx ON observe.cron_runs (job, finished_at DESC);
CREATE INDEX IF NOT EXISTS cron_runs_finished_idx ON observe.cron_runs (finished_at);
ALTER TABLE observe.cron_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE observe.cron_runs FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS observe.health_checks (
  day date PRIMARY KEY,
  checked_at timestamptz NOT NULL DEFAULT now(),
  fingerprints jsonb NOT NULL,
  anomalies jsonb NOT NULL,
  report jsonb NOT NULL CHECK (pg_column_size(report) <= 60000),
  alerted_at timestamptz
);
ALTER TABLE observe.health_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE observe.health_checks FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.observe_record_cron_run(
  p_job text, p_started_at timestamptz, p_ok boolean, p_processed integer, p_failed integer, p_detail jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_detail jsonb := p_detail;
BEGIN
  IF p_job IS NULL OR p_job !~ '^[a-z][a-z0-9-]{1,40}$' OR p_ok IS NULL THEN RETURN false; END IF;
  IF v_detail IS NOT NULL AND pg_catalog.pg_column_size(v_detail) > 4000 THEN
    v_detail := pg_catalog.jsonb_build_object('truncated', true);
  END IF;
  INSERT INTO observe.cron_runs (job, started_at, ok, processed, failed, detail)
  VALUES (p_job, coalesce(p_started_at, pg_catalog.now()), p_ok, greatest(coalesce(p_processed, 0), 0), greatest(coalesce(p_failed, 0), 0), v_detail);
  -- 보존 90일: 쓸 때만, 한 번에 100줄까지.
  DELETE FROM observe.cron_runs WHERE id IN (
    SELECT id FROM observe.cron_runs WHERE finished_at < pg_catalog.now() - interval '90 days' ORDER BY finished_at LIMIT 100);
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.observe_daily_health(p_now timestamptz DEFAULT now(), p_record boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_now timestamptz := coalesce(p_now, pg_catalog.now());
  v_since timestamptz := v_now - interval '24 hours';
  v_cron_since timestamptz := v_now - interval '26 hours';
  v_kst_day date := (v_now AT TIME ZONE 'Asia/Seoul')::date;
  v_learning_day date := ((v_now AT TIME ZONE 'Asia/Seoul') - interval '4 hours')::date;
  v_jobs text[] := ARRAY['fetch-suggestions', 'backfill-ipa', 'send-forecast', 'analysis-jobs'];
  v_crons jsonb := '{}'::jsonb;
  v_job text;
  v_row record;
  v_fp jsonb := '{}'::jsonb;
  v_prev jsonb;
  v_val text;
  v_anomalies text[] := ARRAY[]::text[];
  v_suggestions jsonb;
  v_suggest_total integer;
  v_jobs_report jsonb;
  v_errors jsonb;
  v_server_errors integer;
  v_quota jsonb;
  v_materials jsonb;
  v_unfilled integer;
  v_report jsonb;
  v_alerted timestamptz;
BEGIN
  -- ① 크론 — 지난 26시간
  FOREACH v_job IN ARRAY v_jobs LOOP
    SELECT count(*) AS runs, count(*) FILTER (WHERE NOT ok) AS bad_runs, coalesce(sum(processed), 0) AS processed,
           coalesce(sum(failed), 0) AS failed, max(finished_at) AS last_at
      INTO v_row FROM observe.cron_runs WHERE job = v_job AND finished_at >= v_cron_since AND finished_at <= v_now;
    v_crons := v_crons || pg_catalog.jsonb_build_object(v_job, pg_catalog.jsonb_build_object(
      'runs', v_row.runs, 'bad_runs', v_row.bad_runs, 'processed', v_row.processed, 'failed', v_row.failed, 'last_at', v_row.last_at,
      'last_detail', (SELECT detail FROM observe.cron_runs WHERE job = v_job AND finished_at <= v_now ORDER BY finished_at DESC LIMIT 1)));
    IF v_row.runs = 0 THEN v_anomalies := v_anomalies || ('cron_missing:' || v_job);
    ELSIF v_row.bad_runs > 0 OR v_row.failed > 0 THEN v_anomalies := v_anomalies || ('cron_failed:' || v_job); END IF;
  END LOOP;

  -- ② 오늘의 소식(KST 오늘) — 언어 · 출처별
  IF pg_catalog.to_regclass('public.daily_suggestions') IS NOT NULL THEN
    SELECT coalesce(pg_catalog.jsonb_object_agg(language || '/' || source, n), '{}'::jsonb), coalesce(sum(n), 0)::integer
      INTO v_suggestions, v_suggest_total
      FROM (SELECT language, source, count(*) n FROM public.daily_suggestions WHERE date = v_kst_day GROUP BY 1, 2) s;
  ELSE v_suggestions := '{}'::jsonb; v_suggest_total := 0; END IF;
  IF v_suggest_total = 0 AND (v_crons -> 'fetch-suggestions' ->> 'runs')::int > 0 THEN v_anomalies := v_anomalies || 'suggestions_empty'::text; END IF;

  -- ③ 서버 분석 작업(시드 등) — 지난 24시간에 움직인 것
  IF pg_catalog.to_regclass('public.canonical_analysis_jobs') IS NOT NULL THEN
    SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', id, 'kind', kind, 'status', status, 'done', chapters_done,
             'failed', chapters_failed, 'failure_streak', failure_streak, 'updated_at', updated_at) ORDER BY id), '[]'::jsonb)
      INTO v_jobs_report FROM public.canonical_analysis_jobs WHERE updated_at >= v_since;
  ELSE v_jobs_report := '[]'::jsonb; END IF;

  -- ④ 오류 기록 — 지난 24시간, 종류별(줄 · hits), vitals · csp 합계
  SELECT coalesce(pg_catalog.jsonb_object_agg(source || ':' || kind, pg_catalog.jsonb_build_object('rows', n, 'hits', h)), '{}'::jsonb)
    INTO v_errors
    FROM (SELECT source, kind, count(*) n, sum(hits) h FROM observe.error_events WHERE last_seen_at >= v_since AND last_seen_at <= v_now GROUP BY 1, 2) e;
  SELECT count(*) INTO v_server_errors FROM observe.error_events
   WHERE source = 'server' AND kind <> 'health.alert' AND last_seen_at >= v_since AND last_seen_at <= v_now;
  IF v_server_errors > 0 THEN v_anomalies := v_anomalies || 'server_errors'::text; END IF;

  -- ⑤ 하루 상한 사용량(학습일 = KST 04시 경계) — 종류별 합계 · 상위 10(주체는 앞 8자 해시만)
  IF pg_catalog.to_regclass('usage_private.ai_daily_usage') IS NOT NULL THEN
    SELECT pg_catalog.jsonb_build_object(
      'day', v_learning_day,
      'by_kind', coalesce((SELECT pg_catalog.jsonb_object_agg(kind, u) FROM (SELECT kind, sum(units) u FROM usage_private.ai_daily_usage WHERE day = v_learning_day GROUP BY 1) k), '{}'::jsonb),
      'top', coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('kind', kind, 'units', units,
                  'who', split_part(subject, ':', 1) || ':' || left(md5(subject), 8)) ORDER BY units DESC)
                FROM (SELECT * FROM usage_private.ai_daily_usage WHERE day = v_learning_day ORDER BY units DESC LIMIT 10) t), '[]'::jsonb))
      INTO v_quota;
  ELSE v_quota := pg_catalog.jsonb_build_object('day', v_learning_day, 'by_kind', '{}'::jsonb, 'top', '[]'::jsonb); END IF;

  -- ⑥ 공개 자료 · 난이도 요약
  IF pg_catalog.to_regclass('public.reading_materials') IS NOT NULL THEN
    SELECT count(*) FILTER (WHERE visibility = 'public') AS pub,
           count(*) FILTER (WHERE visibility = 'public' AND processed_json->>'status' = 'completed') AS pub_done,
           count(*) FILTER (WHERE visibility = 'public' AND processed_json->>'status' = 'completed'
                            AND processed_json->'metadata'->'difficulty'->>'version' = '1') AS filled
      INTO v_row FROM public.reading_materials;
    v_unfilled := v_row.pub_done - v_row.filled;
    v_materials := pg_catalog.jsonb_build_object('public', v_row.pub, 'public_completed', v_row.pub_done, 'difficulty_filled', v_row.filled, 'difficulty_unfilled', v_unfilled);
  ELSE v_unfilled := 0; v_materials := '{}'::jsonb; END IF;
  IF v_unfilled > 0 AND (v_crons -> 'analysis-jobs' ->> 'runs')::int > 0 THEN v_anomalies := v_anomalies || 'difficulty_unfilled'::text; END IF;

  -- ⑦ 학습 계약 지문 넷 — 전날(가장 최근) 점검과 비교
  FOR v_row IN SELECT * FROM (VALUES ('core', 'contract_hash_live'), ('manual', 'manual_contract_hash_live'),
      ('admission', 'admission_contract_hash_live'), ('activity', 'activity_profile_hash_live')) x(k, fn) LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = 'fsrs_private' AND p.proname = v_row.fn AND p.pronargs = 0) THEN
      EXECUTE pg_catalog.format('SELECT fsrs_private.%I()::text', v_row.fn) INTO v_val;
    ELSE v_val := NULL; END IF;
    v_fp := v_fp || pg_catalog.jsonb_build_object(v_row.k, v_val);
  END LOOP;
  SELECT fingerprints INTO v_prev FROM observe.health_checks WHERE day < v_kst_day ORDER BY day DESC LIMIT 1;
  FOR v_row IN SELECT key AS k, value #>> '{}' AS v FROM pg_catalog.jsonb_each(v_fp) LOOP
    IF v_row.v IS NULL THEN v_anomalies := v_anomalies || ('fingerprint_missing:' || v_row.k);
    ELSIF v_prev IS NOT NULL AND v_prev ? v_row.k AND (v_prev ->> v_row.k) IS DISTINCT FROM v_row.v THEN
      v_anomalies := v_anomalies || ('fingerprint_changed:' || v_row.k);
    END IF;
  END LOOP;

  v_report := pg_catalog.jsonb_build_object(
    'version', 1, 'checked_at', v_now, 'kst_day', v_kst_day, 'window_since', v_since,
    'ok', pg_catalog.cardinality(v_anomalies) = 0, 'anomalies', pg_catalog.to_jsonb(v_anomalies),
    'crons', v_crons, 'suggestions', pg_catalog.jsonb_build_object('total', v_suggest_total, 'by_language_source', v_suggestions),
    'analysis_jobs', v_jobs_report, 'errors', pg_catalog.jsonb_build_object('server_rows', v_server_errors, 'by_kind', v_errors),
    'quota', v_quota, 'materials', v_materials, 'fingerprints', v_fp, 'fingerprints_previous', v_prev);

  IF p_record THEN
    INSERT INTO observe.health_checks AS h (day, checked_at, fingerprints, anomalies, report)
    VALUES (v_kst_day, v_now, v_fp, pg_catalog.to_jsonb(v_anomalies), v_report)
    ON CONFLICT (day) DO UPDATE SET checked_at = EXCLUDED.checked_at, fingerprints = EXCLUDED.fingerprints,
      anomalies = EXCLUDED.anomalies, report = EXCLUDED.report
    RETURNING alerted_at INTO v_alerted;
    IF pg_catalog.cardinality(v_anomalies) > 0 AND v_alerted IS NULL THEN
      PERFORM public.observe_record_error('server', 'health.alert', pg_catalog.array_to_string(v_anomalies, ' '), NULL, NULL,
        '/api/cron/analysis-jobs', NULL, NULL);
      UPDATE observe.health_checks SET alerted_at = v_now WHERE day = v_kst_day;
      v_report := v_report || pg_catalog.jsonb_build_object('alerted', true);
    END IF;
  END IF;
  RETURN v_report;
END;
$function$;

REVOKE ALL ON FUNCTION public.observe_record_cron_run(text, timestamptz, boolean, integer, integer, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.observe_daily_health(timestamptz, boolean) FROM PUBLIC;
DO $grants$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.observe_record_cron_run(text, timestamptz, boolean, integer, integer, jsonb) FROM anon';
    EXECUTE 'REVOKE ALL ON FUNCTION public.observe_daily_health(timestamptz, boolean) FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.observe_record_cron_run(text, timestamptz, boolean, integer, integer, jsonb) FROM authenticated';
    EXECUTE 'REVOKE ALL ON FUNCTION public.observe_daily_health(timestamptz, boolean) FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.observe_record_cron_run(text, timestamptz, boolean, integer, integer, jsonb) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.observe_daily_health(timestamptz, boolean) TO service_role';
  END IF;
END $grants$;

DO $post$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) AND (
         has_function_privilege(r, 'public.observe_record_cron_run(text, timestamptz, boolean, integer, integer, jsonb)', 'EXECUTE')
      OR has_function_privilege(r, 'public.observe_daily_health(timestamptz, boolean)', 'EXECUTE')
      OR has_table_privilege(r, 'observe.cron_runs', 'SELECT') OR has_table_privilege(r, 'observe.health_checks', 'SELECT')) THEN
      RAISE EXCEPTION 'observe daily health must be closed to %', r;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_temp.odh_pins b FULL JOIN pg_temp.odh_measure() a USING (k) WHERE a.v IS DISTINCT FROM b.v) THEN
    RAISE EXCEPTION 'observe daily health: learning contract fingerprint changed — abort';
  END IF;
END $post$;

DROP FUNCTION pg_temp.odh_measure();
