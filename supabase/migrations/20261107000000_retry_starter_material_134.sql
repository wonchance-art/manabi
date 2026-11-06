-- 공개 시드 분석 작업에서 포기한 자료 134를 다시 대기열에 올린다(STARTER-ANALYSIS-001 후속 — 오케스트레이터 순회 2026-11-07 04:24 KST,
-- 오너 11/4 「백엔드 · 데이터 자율」). 적용 경로 = main 병합 → supabase-migrations.yml(db push), 암묵 트랜잭션 하나.
--
-- 원인(같은 PR): 영어 토크나이저(tokenizeEnLine)가 숫자 사이 「-」 · 「—」 · $ % ’ 같은 글자를 토큰으로 남기지 않고 버렸다. 줄 검사
--   (tokensCoverLine — 영어는 글자 · 숫자 없는 틈을 허용)는 통과하고 완료 판정(completeAnalysis — 토큰을 이으면 공백만 빼고 원문과
--   같아야 함)은 실패해, 「010-1234-5678」 줄이 있는 자료 134는 몇 번을 돌려도 「새 분석을 완료하지 못했어요」였다(결정적 · LLM 오류 0).
--   토크나이저가 그 글자를 기호 토큰으로 남기게 고쳤으니 다시 돌리면 끝난다.
-- 이 파일이 하는 것: starter 작업 한 줄의 attempts에서 키 "134"를 빼고 chapters_failed를 1 줄인다. 그 밖의 칸(진행 · 사용량 · 상태 ·
--   다른 자료의 시도 수)과 자료 · 정책 · 함수 · 학습 계약 지문은 그대로. 다음 깨우기는 기존 하루 한 번 예약 실행(02:45 KST).
-- 조건이 맞지 않으면(작업이 없음 · 두 줄 이상 · running/paused 아님 · 134가 포기 상태 아님 · 134가 이미 완료) 아무것도 바꾸지 않고 알린다.
-- 복원: update public.canonical_analysis_jobs set attempts = attempts || '{"134": 3}', chapters_failed = chapters_failed + 1
--         where kind = 'starter' and not attempts ? '134';  (필요 없음 — 134만 다시 시도할 뿐, 실패해도 같은 자리로 돌아간다)

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $retry$
DECLARE n int; changed int;
BEGIN
  IF to_regclass('public.canonical_analysis_jobs') IS NULL THEN
    RAISE EXCEPTION 'relation public.canonical_analysis_jobs does not exist' USING ERRCODE = '42P01';
  END IF;
  SELECT count(*) INTO n FROM public.canonical_analysis_jobs WHERE kind = 'starter';
  IF n <> 1 THEN
    RAISE NOTICE 'retry starter 134: expected exactly 1 starter job, found % — nothing changed', n;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.reading_materials WHERE id = 134 AND processed_json ->> 'status' = 'completed') THEN
    RAISE NOTICE 'retry starter 134: material 134 is already completed — nothing changed';
    RETURN;
  END IF;
  UPDATE public.canonical_analysis_jobs
     SET attempts = attempts - '134', chapters_failed = greatest(chapters_failed - 1, 0), updated_at = now()
   WHERE kind = 'starter' AND status IN ('running', 'paused')
     AND 134 = ANY (material_ids) AND (attempts ->> '134')::int >= 3;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed = 0 THEN
    RAISE NOTICE 'retry starter 134: job is not running/paused or 134 was not given up — nothing changed';
    RETURN;
  END IF;
  RAISE NOTICE 'retry starter 134: material 134 back in the queue';
END $retry$;
