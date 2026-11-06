-- 계정 삭제가 「작성기 자료」에 막히고 비공개 자료 · 저장소 파일을 남기던 것 고침(ACCOUNT-DELETE-002 — 발매 준비 점검 6a · 6c,
-- 오케스트레이터 판정 2026-11-06 KST, 오너 11/4 「백엔드 · 데이터 자율」 · ACCOUNT-DELETE-001(20261101125000) 후속).
-- 적용 경로 = main 병합 → supabase-migrations.yml(db push), 암묵 트랜잭션 하나(검사가 RAISE하면 전부 롤백).
--
-- 운영 실측(읽기 전용, 2026-11-06 KST):
--   reading_materials.owner_id → auth.users 가 ON DELETE SET NULL인데, CHECK 3개(composer_material_is_private ·
--   reading_materials_document_private_v1 · source_passage_stays_private)가 작성기 자료에 owner_id NOT NULL을 요구한다
--   → 작성기 자료가 한 편이라도 있는 계정은 deleteUser의 SET NULL이 CHECK에 걸려 삭제 전체가 실패한다(운영 43행 · 2명).
--   작성기가 아닌 비공개 자료는 주인 없는 행으로 남았다(운영 owner_id null 비공개 10행 — 2~3월. 이 파일은 지우지 않는다: 오너 승인 목록).
--   저장소(user-pdfs · material-originals · teaching-board-pages)는 모든 객체가 `<uid>/…` 경로 · owner = uid(운영 23개 실측)인데
--   삭제 경로가 저장소를 건드리지 않았다.
--
-- 이 파일이 하는 것:
--   ⑴ public.delete_account_learning_records(uuid) 확장 — FSRS 영수증 → 연산 → 카드(그대로) 뒤에 그 계정의 **공개 아닌** 자료를 지운다.
--      순서가 중요하다: 카드가 먼저 없어져야 자료 삭제의 user_vocabulary CASCADE가 guard_legacy_vocabulary에 막히지 않는다.
--      공개 자료는 그대로 둔다(SET NULL — 공개 교재 보존, 일반 사용자는 공개 자료를 만들 수 없다).
--      서재 삭제 보호(library_private.protect_source_delete)는 current_user = authenticated만 막는다 — 이 함수는 SECURITY DEFINER라 통과한다.
--      반환에 materials 칸을 더한다(라우트는 error만 본다). 다시 불러도 안전(0 · 0 · 0 · 0).
--   ⑵ public.account_storage_objects(uuid) — service_role 전용 읽기 함수. 그 계정의 저장소 객체(owner = uid 또는 `<uid>/` 경로)를
--      (bucket_id, name)으로 돌려준다. 실제 삭제는 라우트가 Storage API로 한다(storage.objects 직접 DELETE 금지 — 파일이 남는다).
-- 학습 계약 지문(core · manual · admission · activity) 범위 밖 — 함수 이름이 public.fsrs_% 아님 · 표 · 정책 · 트리거 · 권한 무변경.
--   앞뒤 DO 블록이 네 계약 동치와 실행권(service_role만)을 확인한다.
-- 복원: docs/sql/account-delete-owned-content-20261106-rollback.sql(⑴을 20261101125000 본문으로 되돌리고 ⑵를 지운다).

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

do $$ begin
  if (select contract_hash from fsrs_private.settings) is distinct from fsrs_private.contract_hash()
     or (select contract_hash from fsrs_private.manual_save_settings) is distinct from fsrs_private.manual_contract_hash()
     or (select contract_hash from fsrs_private.admission_settings) is distinct from fsrs_private.admission_contract_hash()
     or (select profile_contract_hash from fsrs_private.activity_settings) is distinct from fsrs_private.activity_profile_hash() then
    raise exception 'learning contracts already drifted — stop';
  end if;
  if to_regprocedure('public.delete_account_learning_records(uuid)') is null then
    raise exception 'account delete: 20261101125000 function missing — stop';
  end if;
end $$;

create or replace function public.delete_account_learning_records(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare receipts integer; operations integer; cards integer; materials integer;
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
  -- 카드가 없어진 뒤 — 자료 삭제의 단어 · 문맥 CASCADE가 보호 장치에 막히지 않는다. 공개 자료는 남긴다(SET NULL).
  delete from public.reading_materials where owner_id = p_user and visibility is distinct from 'public';
  get diagnostics materials = row_count;
  return jsonb_build_object('receipts', receipts, 'operations', operations, 'cards', cards, 'materials', materials);
end
$function$;

revoke all on function public.delete_account_learning_records(uuid) from public, anon, authenticated;
grant execute on function public.delete_account_learning_records(uuid) to service_role;

-- plpgsql이라 storage 스키마가 없는 환경(로컬 fixture)에서도 만들어지고, 부를 때만 storage.objects를 읽는다.
create or replace function public.account_storage_objects(p_user uuid)
returns table (bucket_id text, name text)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if p_user is null then raise exception 'account_delete_invalid' using errcode = '22023'; end if;
  return query
    select o.bucket_id::text, o.name::text from storage.objects o
     where o.owner = p_user or o.name like p_user::text || '/%'
     order by 1, 2;
end
$function$;

revoke all on function public.account_storage_objects(uuid) from public, anon, authenticated;
grant execute on function public.account_storage_objects(uuid) to service_role;

do $$ begin
  if (select contract_hash from fsrs_private.settings) is distinct from fsrs_private.contract_hash()
     or (select contract_hash from fsrs_private.manual_save_settings) is distinct from fsrs_private.manual_contract_hash()
     or (select contract_hash from fsrs_private.admission_settings) is distinct from fsrs_private.admission_contract_hash()
     or (select profile_contract_hash from fsrs_private.activity_settings) is distinct from fsrs_private.activity_profile_hash() then
    raise exception 'learning contract drift after account delete owned content — rolled back';
  end if;
  if has_function_privilege('anon', 'public.delete_account_learning_records(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.delete_account_learning_records(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.account_storage_objects(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.account_storage_objects(uuid)', 'EXECUTE') then
    raise exception 'account delete functions must be service_role only';
  end if;
end $$;
