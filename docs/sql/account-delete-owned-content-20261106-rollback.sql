-- 복원: supabase/migrations/20261106160000_account_delete_owned_content.sql → 20261101125000 본문(FSRS 3표만)으로 되돌리고
-- 저장소 목록 함수를 지운다. 되돌리면 작성기 자료가 있는 계정의 삭제가 다시 실패한다 — 필요할 때만 오너 확인 뒤 실행.
-- 라우트(src/app/api/account/delete/route.js)도 account_storage_objects를 부르므로 같이 되돌려야 한다.
BEGIN;
create or replace function public.delete_account_learning_records(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare receipts integer; operations integer; cards integer;
begin
  if p_user is null then raise exception 'account_delete_invalid' using errcode = '22023'; end if;
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
drop function if exists public.account_storage_objects(uuid);
COMMIT;
