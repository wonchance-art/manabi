-- 공개 시드 분석 작업을 이어 돌린다(STARTER-ANALYSIS-001 후속 — 운영 실측 2026-11-07 03:3x KST, 오케스트레이터 판정 · 오너 11/4 「백엔드 · 데이터 자율」).
-- 적용 경로 = main 병합 → supabase-migrations.yml(db push), 암묵 트랜잭션 하나.
--
-- 실측: starter 작업(118편)이 79편 완료 · 1편 포기 뒤 status failed로 멈췄다 — 자료 134 하나의 재시도 3회가 그대로 「연달아 3장 실패」로
--   세졌기 때문(같은 PR의 analysisJobs.jobAfterChapter 고침: 연달아 실패는 포기한 장 단위로 센다). 실패 원인은 그 자료의 분석 완료 판정이고
--   공급자 오류는 0(LLM 로그 전부 성공) — 남은 38편과 무관하다.
-- 이 파일이 하는 것: 그 작업 한 줄만 status running · failure_streak 0 · last_error NULL로 되돌린다. 장별 시도 수(attempts)는 그대로 —
--   자료 134는 시도 3이라 다음 tick이 자동으로 건너뛴다(chapters_failed 1 유지). 진행 · 사용량(chapters_done · llm_usage)도 그대로.
--   다음 깨우기는 기존 하루 한 번 예약 실행(02:45 KST). 자료 · 정책 · 함수 · 학습 계약 지문 무변경.
-- 조건이 맞지 않으면(작업이 없음 · 이미 running/done · 두 줄 이상) 아무것도 바꾸지 않고 알린다.
-- 복원: update public.canonical_analysis_jobs set status = 'failed' where kind = 'starter' and status = 'running'; (필요 없음 — 멈추려면 paused)

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $resume$
DECLARE n int; changed int;
BEGIN
  IF to_regclass('public.canonical_analysis_jobs') IS NULL THEN
    RAISE EXCEPTION 'relation public.canonical_analysis_jobs does not exist' USING ERRCODE = '42P01';
  END IF;
  SELECT count(*) INTO n FROM public.canonical_analysis_jobs WHERE kind = 'starter' AND status = 'failed';
  IF n <> 1 THEN
    RAISE NOTICE 'resume starter job: expected exactly 1 failed starter job, found % — nothing changed', n;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.canonical_analysis_jobs r JOIN public.canonical_analysis_jobs f ON f.owner_id = r.owner_id
             WHERE f.kind = 'starter' AND f.status = 'failed' AND r.status = 'running') THEN
    RAISE NOTICE 'resume starter job: owner already has a running job — nothing changed';
    RETURN;
  END IF;
  UPDATE public.canonical_analysis_jobs
     SET status = 'running', failure_streak = 0, last_error = NULL, lease_until = NULL, updated_at = now()
   WHERE kind = 'starter' AND status = 'failed';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN RAISE EXCEPTION 'resume starter job: expected 1 row, updated %', changed; END IF;
  RAISE NOTICE 'resume starter job: 1 job back to running';
END $resume$;
