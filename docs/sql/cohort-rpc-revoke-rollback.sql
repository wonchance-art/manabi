-- 복원: supabase/migrations/20261026000000_cohort_rpc_revoke.sql(SECDEF-HARDEN-002) 이전 실행권으로 되돌린다.
-- 적용 전 운영 proacl(2026-10-26 KST 읽기 전용 실측) — 네 함수 모두 같은 모양:
--   {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- 실행권만 바꾼다(본문 · 정책 · 행 무변경). 학습 계약 지문 범위 밖 — 앞뒤로 네 계약 동치를 확인한다.
-- 운영 DB 변경이므로 오너 승인 범위 안에서만 실행한다.
begin;
do $$ begin
  if (select contract_hash from fsrs_private.settings) is distinct from fsrs_private.contract_hash()
     or (select contract_hash from fsrs_private.manual_save_settings) is distinct from fsrs_private.manual_contract_hash()
     or (select contract_hash from fsrs_private.admission_settings) is distinct from fsrs_private.admission_contract_hash()
     or (select profile_contract_hash from fsrs_private.activity_settings) is distinct from fsrs_private.activity_profile_hash() then
    raise exception 'learning contracts already drifted — stop';
  end if;
end $$;

grant execute on function public.join_cohort(text) to public, anon, authenticated, service_role;
grant execute on function public.is_admin_user(), public.is_cohort_member(uuid), public.can_view_member_progress(uuid)
  to public, anon, authenticated, service_role;

do $$ begin
  if (select contract_hash from fsrs_private.settings) is distinct from fsrs_private.contract_hash()
     or (select contract_hash from fsrs_private.manual_save_settings) is distinct from fsrs_private.manual_contract_hash()
     or (select contract_hash from fsrs_private.admission_settings) is distinct from fsrs_private.admission_contract_hash()
     or (select profile_contract_hash from fsrs_private.activity_settings) is distinct from fsrs_private.activity_profile_hash() then
    raise exception 'learning contract drift after rollback — rolled back';
  end if;
end $$;
commit;

-- 확인(읽기 전용): 네 행 모두 =X · anon=X · authenticated=X · service_role=X 가 보여야 한다.
-- select p.proname, p.proacl::text from pg_proc p where p.pronamespace = 'public'::regnamespace
--   and p.proname in ('join_cohort','is_admin_user','is_cohort_member','can_view_member_progress');
