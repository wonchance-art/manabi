-- 복원: supabase/migrations/20261106170000_ai_daily_quota.sql → 일일 상한 함수 · 사용량 표 · 스키마를 지운다.
-- 서버 코드(src/lib/server/dailyQuota.js)는 RPC가 실패하면 요청을 막지 않는다(fail-open) — 되돌리면 상한이 꺼질 뿐 기능은 그대로다.
-- 사용량 행은 하루 단위 집계(개인 내용 없음)라 지워도 학습 기록에 영향이 없다. 필요할 때만 오너 확인 뒤 실행.
BEGIN;
drop function if exists public.consume_ai_daily_quota(text, text, integer, integer);
drop table if exists usage_private.ai_daily_usage;
drop schema if exists usage_private;
COMMIT;
