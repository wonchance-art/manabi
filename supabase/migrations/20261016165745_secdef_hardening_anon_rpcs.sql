-- 보안: anon이 실행할 수 있던 SECURITY DEFINER 함수 실행권 회수(SECDEF-HARDEN-001, 오너 승인 2026-10-17 KST).
-- 운영 적용 완료(apply_migration, 버전 20261016165745) — 이 파일은 이력 동기화용으로 같은 본문이다.
--   award_xp: 호출자 확인 없이 아무 사용자 XP를 바꿨다 · 좋아요 4종: p_user_id를 호출자가 정하고 반복 +1 · touch_morphemes: 누구나 사전 통계를 올렸다.
--   셋 다 앱 호출 0곳(touch_morphemes는 서버 service_role만) → service_role만 남기고 search_path 고정.
--   관리자 지표 4종(함수 안에서 관리자 확인)은 anon 회수만(심층 방어), 트리거 함수 2종은 표면 정리.
-- 학습 계약 지문(contract · manual · admission · activity)에 들어가는 enforce_role_change_by_admin은 건드리지 않는다 —
-- 그 함수의 proacl이 activity_profile_hash · admission_contract_hash에 실려 바꾸면 update_streak · 입장 경로가 멈춘다.
-- 앞뒤 검사가 네 계약 동치와 회수를 확인하고, 어긋나면 예외로 전체가 롤백된다. 적용 직후 실측: 네 계약 true · anon award_xp false.
-- 복원: award_xp · 좋아요 4종 · touch_morphemes에 grant execute to public, anon, authenticated + alter function … reset search_path,
--       admin 지표 4종 grant to anon, 트리거 2종 grant to public.
do $$ begin
  if (select contract_hash from fsrs_private.settings) is distinct from fsrs_private.contract_hash()
     or (select contract_hash from fsrs_private.manual_save_settings) is distinct from fsrs_private.manual_contract_hash()
     or (select contract_hash from fsrs_private.admission_settings) is distinct from fsrs_private.admission_contract_hash()
     or (select profile_contract_hash from fsrs_private.activity_settings) is distinct from fsrs_private.activity_profile_hash() then
    raise exception 'learning contracts already drifted — stop';
  end if;
end $$;

revoke execute on function public.award_xp(uuid, integer) from public, anon, authenticated;
grant execute on function public.award_xp(uuid, integer) to service_role;
alter function public.award_xp(uuid, integer) set search_path = public;

revoke execute on function public.add_post_like(uuid, uuid), public.remove_post_like(uuid, uuid),
  public.add_comment_like(uuid, uuid), public.remove_comment_like(uuid, uuid) from public, anon, authenticated;
grant execute on function public.add_post_like(uuid, uuid), public.remove_post_like(uuid, uuid),
  public.add_comment_like(uuid, uuid), public.remove_comment_like(uuid, uuid) to service_role;
alter function public.add_post_like(uuid, uuid) set search_path = public;
alter function public.remove_post_like(uuid, uuid) set search_path = public;
alter function public.add_comment_like(uuid, uuid) set search_path = public;
alter function public.remove_comment_like(uuid, uuid) set search_path = public;

revoke execute on function public.touch_morphemes(text, text[]) from public, anon, authenticated;
grant execute on function public.touch_morphemes(text, text[]) to service_role;
alter function public.touch_morphemes(text, text[]) set search_path = public;

revoke execute on function public.admin_content_health(integer, integer), public.admin_daily_metrics(integer),
  public.admin_funnel(integer), public.admin_v3_metrics(integer) from public, anon;

revoke execute on function public.handle_new_user(), public.sync_comments_count() from public, anon, authenticated;
alter function public.sync_comments_count() set search_path = public;

do $$ begin
  if (select contract_hash from fsrs_private.settings) is distinct from fsrs_private.contract_hash()
     or (select contract_hash from fsrs_private.manual_save_settings) is distinct from fsrs_private.manual_contract_hash()
     or (select contract_hash from fsrs_private.admission_settings) is distinct from fsrs_private.admission_contract_hash()
     or (select profile_contract_hash from fsrs_private.activity_settings) is distinct from fsrs_private.activity_profile_hash() then
    raise exception 'learning contract drift after hardening — rolled back';
  end if;
  if has_function_privilege('anon', 'public.award_xp(uuid,integer)', 'EXECUTE')
     or has_function_privilege('anon', 'public.touch_morphemes(text,text[])', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.add_comment_like(uuid,uuid)', 'EXECUTE') then
    raise exception 'revoke did not take effect';
  end if;
end $$;
