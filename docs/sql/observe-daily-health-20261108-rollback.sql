-- OPS-HEALTH-001 복원(20261108050000_observe_daily_health) — 오너 확인 뒤에만 실행.
-- 함수 둘 · 표 둘을 지운다. 기존 표(observe.error_events · 자료 · 학습 기록)는 건드리지 않는다.
-- 크론 코드(recordCronRun · 점검 호출)는 함수가 없으면 조용히 건너뛰므로(fail-soft) 이 SQL만으로 운영이 멈추지 않는다.
BEGIN;
SET LOCAL lock_timeout = '5s';
DROP FUNCTION IF EXISTS public.observe_daily_health(timestamptz, boolean);
DROP FUNCTION IF EXISTS public.observe_record_cron_run(text, timestamptz, boolean, integer, integer, jsonb);
DROP TABLE IF EXISTS observe.health_checks;
DROP TABLE IF EXISTS observe.cron_runs;
COMMIT;
