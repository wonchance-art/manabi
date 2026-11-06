-- 계정을 삭제하면 그 계정의 하루 상한 사용량 줄(`u:<uid>`)도 바로 지운다(ACCOUNT-DELETE-004 — 처리방침 대조 2026-11-07 KST,
-- 오케스트레이터 순회 ②, 오너 11/4 「백엔드 · 데이터 자율」). 적용 경로 = main 병합 → supabase-migrations.yml(db push), 암묵 트랜잭션 하나.
--
-- 실측: /privacy 3절은 「계정 삭제를 요청하면 즉시 모든 개인 데이터가 삭제」라고 쓰는데, usage_private.ai_daily_usage(20261106170000)는
--   auth.users를 참조하지 않는 문자열 주체(`u:<uid>`)라 탈퇴 때 남고 30일 뒤에야 치워졌다(delete_account_learning_records에 없음 — 운영 확인).
-- 이 파일이 하는 것: public.forget_ai_daily_usage(uuid) — service_role 전용. 그 계정의 `u:<uid>` 줄을 모두 지우고 지운 수를 돌려준다.
--   계정 삭제 경로(src/app/api/account/delete/route.js)가 학습 기록 정리 뒤 · auth 사용자 삭제 앞에서 부른다(다시 불러도 안전).
--   비로그인 `ip:<sha256>` 줄 · 다른 계정 줄 · 표 · 기존 함수 · 학습 계약 지문은 그대로.
-- 복원: drop function if exists public.forget_ai_daily_usage(uuid);  (서버 코드는 함수가 없으면 탈퇴를 막지 않고 넘어간다)

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

create or replace function public.forget_ai_daily_usage(p_user uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare n integer;
begin
  if p_user is null then raise exception 'ai_quota_invalid' using errcode = '22023'; end if;
  delete from usage_private.ai_daily_usage u where u.subject = 'u:' || p_user::text;
  get diagnostics n = row_count;
  return n;
end
$function$;

revoke all on function public.forget_ai_daily_usage(uuid) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on function public.forget_ai_daily_usage(uuid) from anon'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'revoke all on function public.forget_ai_daily_usage(uuid) from authenticated'; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then execute 'grant execute on function public.forget_ai_daily_usage(uuid) to service_role'; end if;
end $$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') and has_function_privilege('anon', 'public.forget_ai_daily_usage(uuid)', 'EXECUTE') then
    raise exception 'forget_ai_daily_usage must be closed to anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') and has_function_privilege('authenticated', 'public.forget_ai_daily_usage(uuid)', 'EXECUTE') then
    raise exception 'forget_ai_daily_usage must be closed to authenticated';
  end if;
end $$;
