-- 프로필 공개 범위 1단계(PROFILES-PRIVACY-001 ①, 오너 승인 2026-10-17 KST): 남의 행 표시용 view만 만든다.
-- 운영 적용 완료(apply_migration, 버전 20261016165910) — 이 파일은 이력 동기화용으로 같은 본문이다.
-- 정책 · 권한은 아직 그대로(2단계에서 전원 공개 정책을 내린다 — 앱이 이 view로 옮긴 뒤). view는 profiles에 의존하는 쪽이라 학습 계약 지문에 들어가지 않는다.
-- 복원: drop view public.public_profiles;
do $$ begin
  if (select contract_hash from fsrs_private.settings) is distinct from fsrs_private.contract_hash()
     or (select contract_hash from fsrs_private.manual_save_settings) is distinct from fsrs_private.manual_contract_hash()
     or (select contract_hash from fsrs_private.admission_settings) is distinct from fsrs_private.admission_contract_hash()
     or (select profile_contract_hash from fsrs_private.activity_settings) is distinct from fsrs_private.activity_profile_hash() then
    raise exception 'learning contracts already drifted — stop';
  end if;
end $$;

create view public.public_profiles with (security_invoker = false) as
  select p.id, p.display_name, p.avatar_url from public.profiles p;
revoke all on public.public_profiles from public;
grant select on public.public_profiles to anon, authenticated;
comment on view public.public_profiles is '남의 행 표시용(댓글 작성자 · 스터디 그룹) — id · display_name · avatar_url만. 본인 전체 열은 profiles(본인 정책).';

do $$ begin
  if (select contract_hash from fsrs_private.settings) is distinct from fsrs_private.contract_hash()
     or (select contract_hash from fsrs_private.manual_save_settings) is distinct from fsrs_private.manual_contract_hash()
     or (select contract_hash from fsrs_private.admission_settings) is distinct from fsrs_private.admission_contract_hash()
     or (select profile_contract_hash from fsrs_private.activity_settings) is distinct from fsrs_private.activity_profile_hash() then
    raise exception 'learning contract drift after view — rolled back';
  end if;
end $$;
