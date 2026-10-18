-- 프로필 공개 범위 1단계 보완 — public.public_profiles를 읽기 전용으로(PROFILES-PRIVACY-001 ①-hotfix · VIEW-WRITE-GRANT-001). 운영 적용은 오너 승인 뒤.
-- 발견(2026-10-17 09:4x KST 운영 읽기 전용): 20261016165910이 만든 view는 `revoke all … from public`만 했고, Supabase 기본 권한이
--   anon · authenticated에 INSERT · UPDATE · DELETE까지 남겼다. view는 security_invoker=false · 소유자 postgres(BYPASSRLS) · 단순 SELECT라
--   자동 갱신 가능 → anon 키로 남의 display_name · avatar_url을 바꾸거나 profiles 행을 지우고 넣을 수 있다(RLS를 거치지 않는다).
-- 바뀌는 것: view 권한만 — anon · authenticated는 SELECT만. 학습 계약 지문 범위 밖(view는 profiles에 의존하는 쪽 — 165910과 같은 판정,
--   동적 하네스 · FINGERPRINT-REPIN-001이 확인). service_role · postgres는 그대로.
-- 실행 형태: db push 한 트랜잭션. 앞뒤 검사가 네 계약 동치와 권한을 확인한다. 191500 · 191600 · 191800과 독립(학습 계약 값을 박지 않는다).
-- 번호: 165910 바로 뒤 · 171800 앞 — 다른 대기 파일보다 먼저 단독으로 적용해도 db push 이력 순서가 어긋나지 않는다(--include-all 불필요).
DO $pre$ BEGIN
  IF (SELECT contract_hash FROM fsrs_private.settings) IS DISTINCT FROM fsrs_private.contract_hash()
     OR (SELECT contract_hash FROM fsrs_private.manual_save_settings) IS DISTINCT FROM fsrs_private.manual_contract_hash()
     OR (SELECT contract_hash FROM fsrs_private.admission_settings) IS DISTINCT FROM fsrs_private.admission_contract_hash()
     OR (SELECT profile_contract_hash FROM fsrs_private.activity_settings) IS DISTINCT FROM fsrs_private.activity_profile_hash()
  THEN RAISE EXCEPTION 'public_profiles_hotfix: learning contracts already drifted — stop'; END IF;
  IF pg_catalog.to_regclass('public.public_profiles') IS NULL THEN RAISE EXCEPTION 'public_profiles_hotfix: view missing'; END IF;
END $pre$;

REVOKE ALL ON public.public_profiles FROM anon, authenticated;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

DO $post$ BEGIN
  IF (pg_catalog.has_table_privilege('anon','public.public_profiles','INSERT') OR pg_catalog.has_table_privilege('anon','public.public_profiles','UPDATE') OR pg_catalog.has_table_privilege('anon','public.public_profiles','DELETE') OR pg_catalog.has_table_privilege('authenticated','public.public_profiles','INSERT') OR pg_catalog.has_table_privilege('authenticated','public.public_profiles','UPDATE') OR pg_catalog.has_table_privilege('authenticated','public.public_profiles','DELETE')) THEN RAISE EXCEPTION 'public_profiles_hotfix: view still writable by anon/authenticated'; END IF;
  IF NOT (pg_catalog.has_table_privilege('anon','public.public_profiles','SELECT') AND pg_catalog.has_table_privilege('authenticated','public.public_profiles','SELECT'))
  THEN RAISE EXCEPTION 'public_profiles_hotfix: view read lost'; END IF;
  IF (SELECT contract_hash FROM fsrs_private.settings) IS DISTINCT FROM fsrs_private.contract_hash()
     OR (SELECT contract_hash FROM fsrs_private.manual_save_settings) IS DISTINCT FROM fsrs_private.manual_contract_hash()
     OR (SELECT contract_hash FROM fsrs_private.admission_settings) IS DISTINCT FROM fsrs_private.admission_contract_hash()
     OR (SELECT profile_contract_hash FROM fsrs_private.activity_settings) IS DISTINCT FROM fsrs_private.activity_profile_hash()
  THEN RAISE EXCEPTION 'public_profiles_hotfix: learning contract drift after grant change — rolled back'; END IF;
END $post$;
