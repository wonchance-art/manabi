-- 관리자 역할 변경 RPC(PROFILES-PRIVACY-001 ② 선행). 적용 경로 = PR이 main에 병합되면 supabase-migrations.yml(db push)이
--   운영에 바로 적용한다(별도 apply_migration 없음). 그래서 병합 승인 = 이 함수의 운영 적용 승인이다.
-- 남는 구멍: 마지막 관리자 거부는 이 RPC 안에서만 막는다 — 본인 행 직접 UPDATE(role 열 권한 · 본인 행 정책)는 ② 본 적용이
--   role 열 UPDATE 권한을 회수할 때 닫힌다(그 전까지는 관리자 본인만 스스로 강등할 수 있는 상태 그대로).
-- AdminPage 역할 버튼이 profiles를 직접 update하던 것(본인 행 RLS에 0행 무음 실패 · 강등 값 'user'는 CHECK 23514)을 대신한다.
-- 실측(2026-10-17 KST, 읽기 전용): CHECK profiles_role_check = student · host · admin · 관리자 1명.
-- trg_enforce_role_change(enforce_role_change_by_admin, SECURITY DEFINER)는 is_admin() = auth.uid() 기준이라
--   호출 관리자의 JWT로 판정돼 이 정의자 UPDATE를 통과시킨다(비관리자는 함수 첫 검사에서 막힌다).
-- 학습 계약 지문(contract · manual · admission · activity) 어디에도 들지 않는다 — public의 fsrs_% 아님 · 고정 목록 밖 ·
--   profiles가 참조하는 함수 폐포 밖. is_admin · enforce_role_change_by_admin은 건드리지 않는다. 앞뒤 DO 블록이 네 계약 동치를 확인한다.
-- 기본 ACL(public 함수 → anon · authenticated · service_role EXECUTE)을 회수하고 authenticated만 남긴다.
-- 앱이 먼저 배포돼도 안전하다: RPC가 없으면 PGRST202 → 「역할 변경 기능이 아직 준비 중이에요」 토스트.
-- 복원: drop function if exists public.admin_set_user_role(uuid, text);   (지문 무관 — 재고정 불필요)
do $$ begin
  if (select contract_hash from fsrs_private.settings) is distinct from fsrs_private.contract_hash()
     or (select contract_hash from fsrs_private.manual_save_settings) is distinct from fsrs_private.manual_contract_hash()
     or (select contract_hash from fsrs_private.admission_settings) is distinct from fsrs_private.admission_contract_hash()
     or (select profile_contract_hash from fsrs_private.activity_settings) is distinct from fsrs_private.activity_profile_hash() then
    raise exception 'learning contracts already drifted — stop';
  end if;
  if to_regprocedure('public.admin_set_user_role(uuid,text)') is not null then
    raise exception 'admin_set_user_role already exists — re-read before applying';
  end if;
end $$;

create function public.admin_set_user_role(target uuid, new_role text)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  previous text;
  other_admins integer;
begin
  if not public.is_admin() then
    raise exception 'permission denied: admin only' using errcode = '42501';
  end if;
  if new_role is null or new_role not in ('student', 'host', 'admin') then   -- profiles_role_check와 같은 집합
    raise exception 'invalid role: %', new_role using errcode = '22023';
  end if;
  if target is null then
    raise exception 'target required' using errcode = '22023';
  end if;

  -- 관리자 행 전부를 잠가 동시 강등 두 건이 서로를 「다른 관리자」로 세는 경쟁을 막는다
  perform 1 from public.profiles where role = 'admin' for update;
  select p.role into previous from public.profiles p where p.id = target for update;
  if not found then
    raise exception 'no such user' using errcode = 'P0002';
  end if;
  if previous = new_role then
    return previous;                      -- 무변경(트리거도 role 동일이면 통과)
  end if;

  if previous = 'admin' then
    select count(*) into other_admins from public.profiles p where p.role = 'admin' and p.id <> target;
    if other_admins = 0 then
      raise exception 'cannot remove the last admin' using errcode = '42501';
    end if;
  end if;

  update public.profiles set role = new_role where id = target;   -- trg_enforce_role_change: is_admin() = 호출 관리자 → 통과
  return previous;
end
$fn$;

comment on function public.admin_set_user_role(uuid, text) is
  '관리자 전용 역할 변경(student · host · admin). 마지막 관리자 강등 거부. 반환 = 이전 역할. AdminPage 역할 버튼이 부른다.';

revoke all on function public.admin_set_user_role(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;

do $$ begin
  if (select contract_hash from fsrs_private.settings) is distinct from fsrs_private.contract_hash()
     or (select contract_hash from fsrs_private.manual_save_settings) is distinct from fsrs_private.manual_contract_hash()
     or (select contract_hash from fsrs_private.admission_settings) is distinct from fsrs_private.admission_contract_hash()
     or (select profile_contract_hash from fsrs_private.activity_settings) is distinct from fsrs_private.activity_profile_hash() then
    raise exception 'learning contract drift after admin_set_user_role — rolled back';
  end if;
  if has_function_privilege('anon', 'public.admin_set_user_role(uuid,text)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.admin_set_user_role(uuid,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.admin_set_user_role(uuid,text)', 'EXECUTE') then
    raise exception 'admin_set_user_role grants wrong';
  end if;
end $$;
