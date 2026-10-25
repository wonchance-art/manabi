-- 보안 정리(SECDEF-HARDEN-002, Supabase security advisor 2026-10-26 08:30 KST 대응) — 잠든 기수(cohorts) 기능의 RPC 실행권 회수.
-- 적용 경로 = PR이 main에 병합되면 supabase-migrations.yml(db push)이 운영에 바로 적용한다. 병합 승인 = 운영 적용 승인이다.
--
-- 운영 실측(읽기 전용 카탈로그, 2026-10-26 KST — pg_proc.proacl · prosrc · pg_policies):
--   join_cohort(text): PUBLIC · anon · authenticated EXECUTE. 함수는 join_code로만 막는데, cohorts_select_auth(TO authenticated USING true)가
--     로그인 사용자 누구에게나 모든 기수의 join_code를 보여 준다 → 초대 코드 확인이 무의미하다. 아무 로그인 사용자나 모집 · 진행 중 기수에
--     스스로 가입하고, 가입하면 members_select_member · teams_select_member(is_cohort_member)로 그 기수의 멤버 user_id · 팀 구성을 읽는다.
--     앱 · 서버 · 스크립트 호출 0곳(기수 UI 없음 — 최적화 R3 #830에서 미완 기능으로 정리). 정당한 호출자가 없다.
--   is_admin_user() · is_cohort_member(uuid) · can_view_member_progress(uuid): PUBLIC · anon EXECUTE. 이 셋을 부르는 정책은 전부
--     TO authenticated(cohorts · cohort_teams · cohort_members · user_ref_progress)이고 함수 · view 본문에서 부르는 곳은 없다 →
--     anon 실행권은 쓰이지 않는다(불러도 auth.uid() NULL이라 false). authenticated는 정책 평가에 필요하므로 그대로 둔다.
--
-- 이 파일이 바꾸는 것(문장별):
--   ① join_cohort(text) — PUBLIC · anon · authenticated 실행권 회수, service_role만 남긴다(되살릴 때 서버 경로로).
--   ② is_admin_user() · is_cohort_member(uuid) · can_view_member_progress(uuid) — PUBLIC · anon 실행권만 회수.
--      authenticated · service_role은 유지(user_ref_progress 리더 열람 · 기수 정책이 그대로 돈다).
-- 바꾸지 않는 것(advisor 경고가 떠도 그대로 둔다):
--   · is_admin() — reading_materials learning_material_visibility_guard(TO anon, authenticated)가 anon 쿼리에서도 평가한다.
--     anon 실행권을 회수하면 손님의 공개 자료 읽기가 permission denied로 깨진다. 게다가 ACL이 activity 지문에 들어간다.
--   · enforce_role_change_by_admin() — trigger 반환 함수라 RPC로 불러도 「trigger functions can only be called as triggers」 오류뿐.
--     ACL이 activity_profile_hash에 실려 바꾸면 update_streak이 activity_catalog_drift로 멈춘다(SECDEF-HARDEN-001과 같은 판단).
--   · admin_* · update_streak · 학습 · 월드 · 그룹 · 수업 RPC — 함수 안에서 auth.uid() 소유 · 관리자 확인(점검 결과는 PR 본문).
-- 학습 계약 지문(core · manual · admission · activity · capability) 범위 밖이다 — 네 함수 모두 public.fsrs_% 아님 · 지문 고정 목록 밖 ·
--   profiles가 참조하는 함수 폐포(is_admin · enforce_role_change_by_admin · auth.uid) 밖. 앞뒤 DO 블록이 네 계약 동치를 확인한다.
-- 앱 영향: 0(호출 0곳). 복원: docs/sql/cohort-rpc-revoke-rollback.sql
do $$ begin
  if (select contract_hash from fsrs_private.settings) is distinct from fsrs_private.contract_hash()
     or (select contract_hash from fsrs_private.manual_save_settings) is distinct from fsrs_private.manual_contract_hash()
     or (select contract_hash from fsrs_private.admission_settings) is distinct from fsrs_private.admission_contract_hash()
     or (select profile_contract_hash from fsrs_private.activity_settings) is distinct from fsrs_private.activity_profile_hash() then
    raise exception 'learning contracts already drifted — stop';
  end if;
end $$;

-- ①
revoke execute on function public.join_cohort(text) from public, anon, authenticated;
grant execute on function public.join_cohort(text) to service_role;

-- ②
revoke execute on function public.is_admin_user(), public.is_cohort_member(uuid), public.can_view_member_progress(uuid) from public, anon;
grant execute on function public.is_admin_user(), public.is_cohort_member(uuid), public.can_view_member_progress(uuid) to authenticated, service_role;

do $$ begin
  if (select contract_hash from fsrs_private.settings) is distinct from fsrs_private.contract_hash()
     or (select contract_hash from fsrs_private.manual_save_settings) is distinct from fsrs_private.manual_contract_hash()
     or (select contract_hash from fsrs_private.admission_settings) is distinct from fsrs_private.admission_contract_hash()
     or (select profile_contract_hash from fsrs_private.activity_settings) is distinct from fsrs_private.activity_profile_hash() then
    raise exception 'learning contract drift after cohort revoke — rolled back';
  end if;
  if has_function_privilege('anon', 'public.join_cohort(text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.join_cohort(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.is_admin_user()', 'EXECUTE')
     or has_function_privilege('anon', 'public.is_cohort_member(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.can_view_member_progress(uuid)', 'EXECUTE') then
    raise exception 'revoke did not take effect';
  end if;
  if not has_function_privilege('authenticated', 'public.is_admin_user()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.is_cohort_member(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.can_view_member_progress(uuid)', 'EXECUTE')
     or not has_function_privilege('anon', 'public.is_admin()', 'EXECUTE') then
    raise exception 'policy helpers lost the execute grant they need — rolled back';
  end if;
end $$;
