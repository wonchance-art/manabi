-- 계정 삭제가 FSRS 학습 기록에 막히는 것 고침(ACCOUNT-DELETE-001 · STATS-MAP-001, 오너 승인 2026-11-01 KST 「승인」 — 설계 A안).
-- 적용 경로 = PR이 main에 병합되면 supabase-migrations.yml(db push)이 운영에 바로 적용한다. 병합 승인 = 운영 적용 승인이다.
--
-- 운영 실측(읽기 전용 카탈로그, 2026-11-01 KST):
--   fsrs_cards · fsrs_operations · fsrs_new_receipts → auth.users 가 ON DELETE RESTRICT(카드는 user_vocabulary도 RESTRICT).
--   user_vocabulary 삭제는 fsrs_private.guard_legacy_vocabulary가 「FSRS 카드가 있는 단어」면 fsrs_enrolled_card_protected로 막고,
--   review_events 삭제는 fsrs_private.guard_legacy_event가 그 카드에 묶인 기록이면 fsrs_legacy_event_blocked로 막는다.
--   → 새 일정(FSRS)으로 한 번이라도 공부한 계정은 /api/account/delete(auth.admin.deleteUser → CASCADE)가 실패했다.
--     개인정보처리방침 §3 「즉시 완전 삭제」와 어긋난다.
--
-- 이 파일이 하는 것:
--   public.delete_account_learning_records(uuid) — service_role 전용. 한 트랜잭션에서 그 계정의 FSRS 영수증 → 연산 → 카드를 지운다.
--   카드가 없어지면 두 보호 장치는 그 계정의 단어 · 기록을 더는 막지 않으므로, 삭제 라우트가 이 함수 뒤에 deleteUser를 부르면 CASCADE가 끝까지 간다.
--   보호 장치 · 참조 규칙(RESTRICT)은 그대로 둔다 — 열리는 길은 「계정 삭제」 하나뿐이다(B안 — CASCADE + 보호 예외는 배제).
--   같은 계정에 다시 불러도 안전하다(지울 것이 없으면 0 · 0 · 0). deleteUser가 실패하면 라우트가 그대로 다시 시도할 수 있다.
-- 학습 계약 지문(core · manual · admission · activity) 범위 밖이다 — 함수 이름이 public.fsrs_% 아님 · 표 · 트리거 · 권한 무변경.
--   앞뒤 DO 블록이 네 계약 동치를 확인한다. 복원: drop function public.delete_account_learning_records(uuid);
do $$ begin
  if (select contract_hash from fsrs_private.settings) is distinct from fsrs_private.contract_hash()
     or (select contract_hash from fsrs_private.manual_save_settings) is distinct from fsrs_private.manual_contract_hash()
     or (select contract_hash from fsrs_private.admission_settings) is distinct from fsrs_private.admission_contract_hash()
     or (select profile_contract_hash from fsrs_private.activity_settings) is distinct from fsrs_private.activity_profile_hash() then
    raise exception 'learning contracts already drifted — stop';
  end if;
end $$;

create or replace function public.delete_account_learning_records(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare receipts integer; operations integer; cards integer;
begin
  if p_user is null then raise exception 'account_delete_invalid' using errcode = '22023'; end if;
  -- 학습 쓰기와 같은 계정 잠금(append_activity · 보호 장치와 같은 키) — 지우는 사이에 채점이 끼어들지 않게.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 731));
  delete from public.fsrs_new_receipts where user_id = p_user;
  get diagnostics receipts = row_count;
  delete from public.fsrs_operations where user_id = p_user;
  get diagnostics operations = row_count;
  delete from public.fsrs_cards where user_id = p_user;
  get diagnostics cards = row_count;
  return jsonb_build_object('receipts', receipts, 'operations', operations, 'cards', cards);
end
$function$;

revoke all on function public.delete_account_learning_records(uuid) from public, anon, authenticated;
grant execute on function public.delete_account_learning_records(uuid) to service_role;

do $$ begin
  if (select contract_hash from fsrs_private.settings) is distinct from fsrs_private.contract_hash()
     or (select contract_hash from fsrs_private.manual_save_settings) is distinct from fsrs_private.manual_contract_hash()
     or (select contract_hash from fsrs_private.admission_settings) is distinct from fsrs_private.admission_contract_hash()
     or (select profile_contract_hash from fsrs_private.activity_settings) is distinct from fsrs_private.activity_profile_hash() then
    raise exception 'learning contract drift after account delete function — rolled back';
  end if;
  if has_function_privilege('anon', 'public.delete_account_learning_records(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.delete_account_learning_records(uuid)', 'EXECUTE') then
    raise exception 'account delete function must be service_role only';
  end if;
end $$;
