-- 서버 분석 작업(CANON-SERVER-ANALYSIS-001, 오너 「서버 분석 A안 승인, 권장대로 ㄱㄱ」 2026-10-24 KST).
--
-- 배경: 정본 책 · 그림 책의 장 분석은 관리자 화면(브라우저)이 장마다 한 번씩 돌린다 — 화면을 닫으면 멈춘다(운영 실측 2026-10-24:
--   아오조라 6권 40장 중 3장 · 그림 1권 8장 중 5장만 분석). A안 = 서버가 한 번에 몇 장씩 분석하고 다음 차례를 스스로 다시 부른다
--   (/api/cron/analysis-jobs — 기존 CRON_SECRET, 새 환경 변수 · 외부 서비스 없음). 분석 경로는 브라우저와 같다(같은 라우트를 같은 프로세스 안에서).
--
-- 이 파일이 더하는 것:
--   · canonical_analysis_jobs — 작업 하나 = 한 줄(시작한 관리자 · 책 종류 · 책 key 차례 · 상태 · 진행 수 · 장별 시도 수 · 임대).
--     관리자는 자기 작업을 읽고, 새로 시작(insert — 처음 상태로만)하고, 멈출(status → paused) 수만 있다. 진행 · 임대 · 시도 수는 서버(service role)만 쓴다.
--     관리자 한 사람당 도는(running) 작업은 하나뿐(부분 고유 색인 — 같은 장을 두 작업이 동시에 분석하지 않게).
--   · canonical_analysis_save(...) — 서버 작업의 분석 저장. 뷰어 저장(viewer_replace_analysis)과 같은 비교 저장(읽은 원문 · 분석 그대로일 때만,
--     같은 시도 재전송은 성공)이되, 사용자 세션 대신 작업을 확인한다: 그 작업이 도는(또는 막 멈춘) 중이고, 자료가 작업 관리자 소유 ·
--     작업의 책 key · **비공개** 장일 때만. service role만 실행한다(관리자 · 손님 실행 불가).
--
-- ── 적용 · 롤백 ──
--   · 적용: main 병합 시 supabase-migrations.yml 이 자동 적용. 재실행 안전(표 · 색인 · 정책은 있으면 두고 다시, 함수는 replace).
--   · 롤백: DROP FUNCTION IF EXISTS public.canonical_analysis_save(bigint,bigint,text,jsonb,text,jsonb,uuid);
--           DROP TABLE IF EXISTS public.canonical_analysis_jobs;
--           (자료 무접촉 — 이미 저장한 분석은 그대로, 관리자 화면은 브라우저 분석만 남는다)
--   · 작업 하나 멈추기(SQL 편집기): update public.canonical_analysis_jobs set status = 'paused' where id = <id>;
--   · 무해성: 기존 표 · 행 · 정책 · 함수 · 트리거를 바꾸지 않는다. reading_materials는 이 함수로만, 위 조건의 비공개 장만 쓴다.
--
-- ── 검증(적용 후) ──
--   1) select relrowsecurity from pg_class where oid = 'public.canonical_analysis_jobs'::regclass; → true
--   2) select grantee, privilege_type from information_schema.role_table_grants where table_name = 'canonical_analysis_jobs'
--      and grantee in ('anon','authenticated') order by 1,2; → authenticated INSERT · authenticated SELECT (UPDATE는 열 권한 status만)
--   3) select prosecdef, proconfig from pg_proc where proname = 'canonical_analysis_save'; → true · {search_path=pg_catalog, public}
--   4) select has_function_privilege('authenticated', 'public.canonical_analysis_save(bigint,bigint,text,jsonb,text,jsonb,uuid)', 'execute'); → false
--
-- 학습 지문 범위(reading_materials 정책 · 트리거, profiles, fsrs_*)는 만들거나 바꾸지 않는다.

CREATE TABLE IF NOT EXISTS public.canonical_analysis_jobs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id uuid NOT NULL,
  kind text NOT NULL,
  book_keys text[] NOT NULL,
  status text NOT NULL DEFAULT 'running',
  current_key text,
  chapters_done int NOT NULL DEFAULT 0,
  chapters_failed int NOT NULL DEFAULT 0,
  -- 자료 id(문자열) → 시도 수. 한 장은 세 번까지만(서버 src/lib/server/analysisJobs.js CHAPTER_ATTEMPTS).
  attempts jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_streak int NOT NULL DEFAULT 0,
  last_error text,
  lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT canonical_analysis_jobs_kind CHECK (kind IN ('literature', 'art')),
  CONSTRAINT canonical_analysis_jobs_status CHECK (status IN ('running', 'paused', 'done', 'failed')),
  CONSTRAINT canonical_analysis_jobs_keys CHECK (cardinality(book_keys) BETWEEN 1 AND 200),
  CONSTRAINT canonical_analysis_jobs_counts CHECK (chapters_done >= 0 AND chapters_failed >= 0 AND failure_streak >= 0),
  CONSTRAINT canonical_analysis_jobs_error CHECK (last_error IS NULL OR char_length(last_error) <= 500)
);

CREATE UNIQUE INDEX IF NOT EXISTS canonical_analysis_jobs_one_running
  ON public.canonical_analysis_jobs (owner_id) WHERE status = 'running';
CREATE INDEX IF NOT EXISTS canonical_analysis_jobs_owner_recent
  ON public.canonical_analysis_jobs (owner_id, created_at DESC);

ALTER TABLE public.canonical_analysis_jobs ENABLE ROW LEVEL SECURITY;
-- Supabase 기본 권한(anon · authenticated ALL)을 걷고 필요한 것만 다시 준다(VIEW-WRITE-GRANT-001 선례). 서버(service role)는 RLS 밖이다.
REVOKE ALL ON public.canonical_analysis_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.canonical_analysis_jobs TO authenticated;
GRANT UPDATE (status, updated_at) ON public.canonical_analysis_jobs TO authenticated;

DROP POLICY IF EXISTS canonical_analysis_jobs_admin_read ON public.canonical_analysis_jobs;
CREATE POLICY canonical_analysis_jobs_admin_read ON public.canonical_analysis_jobs
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()) AND owner_id = (SELECT auth.uid()));

-- 새 작업은 처음 상태로만(진행 · 시도 · 임대를 꾸며 넣지 못한다).
DROP POLICY IF EXISTS canonical_analysis_jobs_admin_start ON public.canonical_analysis_jobs;
CREATE POLICY canonical_analysis_jobs_admin_start ON public.canonical_analysis_jobs
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()) AND owner_id = (SELECT auth.uid()) AND status = 'running'
    AND current_key IS NULL AND chapters_done = 0 AND chapters_failed = 0 AND attempts = '{}'::jsonb
    AND failure_streak = 0 AND last_error IS NULL AND lease_until IS NULL);

-- 관리자는 멈추기만(running → paused). 다시 돌리려면 새 작업을 시작한다(시도 수가 새로 센다).
DROP POLICY IF EXISTS canonical_analysis_jobs_admin_pause ON public.canonical_analysis_jobs;
CREATE POLICY canonical_analysis_jobs_admin_pause ON public.canonical_analysis_jobs
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()) AND owner_id = (SELECT auth.uid()) AND status = 'running')
  WITH CHECK ((SELECT public.is_admin()) AND owner_id = (SELECT auth.uid()) AND status = 'paused');

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
  SELECT * INTO r FROM public.reading_materials
    WHERE id = p_id AND owner_id = j.owner_id AND visibility = 'private'
      AND processed_json #>> '{metadata,book,key}' = ANY (j.book_keys)
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '작업의 비공개 장이 아니에요.' USING ERRCODE = '42501'; END IF;
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

REVOKE ALL ON FUNCTION public.canonical_analysis_save(bigint, bigint, text, jsonb, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.canonical_analysis_save(bigint, bigint, text, jsonb, text, jsonb, uuid) TO service_role;
