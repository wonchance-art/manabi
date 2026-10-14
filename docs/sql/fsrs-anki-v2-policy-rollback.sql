-- REV-SCOPE-R1B-2 복원: docs/sql/fsrs-anki-v2-policy.sql을 되돌린다. 비파괴(학습자 행은 읽기만 한다).
-- 상태: 검수용 후보. 운영 DB에 적용하지 않았다(2026-10-14 KST).
--
-- 항상: fsrs_capabilities가 다시 'anki-seconds-v1'을 알린다 → 새 카드 · 다음 채점이 30초 · 10분 단계로 돌아간다.
-- anki-v2 카드가 하나도 없을 때: valid_card · 등록 · 직접 담기를 M09 관찰본 그대로 되돌린다(본문 MD5 확인).
-- anki-v2 카드가 이미 있을 때: 두 정책을 받는 검사는 그대로 둔다. 되돌리면 그 카드들이 무효가 되어
--   복습에서 빠지기 때문이다. 그 카드들은 다음 채점 때 anki-seconds-v1로 넘어간다(앱 코드).
-- 끝에서 네 지문 · 기존 카드 유효를 확인한다.
BEGIN;
SET LOCAL search_path = '';

DO $anki_v2_rollback$
DECLARE
 definition text;
 has_v2 boolean;
 target record;
BEGIN
 SELECT pg_catalog.pg_get_functiondef('public.fsrs_capabilities()'::pg_catalog.regprocedure) INTO definition;
 IF pg_catalog.strpos(definition, '''policyVersion'',''anki-v2''') = 0 THEN
  RAISE EXCEPTION 'anki_v2_rollback_not_applied';
 END IF;
 EXECUTE pg_catalog.replace(definition, '''policyVersion'',''anki-v2''', '''policyVersion'',''anki-seconds-v1''');

 SELECT EXISTS (SELECT 1 FROM public.fsrs_cards WHERE card->>'policyVersion' = 'anki-v2')
  OR EXISTS (SELECT 1 FROM public.fsrs_operations WHERE operation::text LIKE '%"anki-v2"%')
  INTO has_v2;
 IF NOT has_v2 THEN
  SELECT pg_catalog.pg_get_functiondef('fsrs_private.valid_card(jsonb)'::pg_catalog.regprocedure) INTO definition;
  definition := pg_catalog.replace(definition,
   'OR c->>''policyVersion'' IS NULL OR c->>''policyVersion'' NOT IN (''anki-seconds-v1'',''anki-v2'')',
   'OR c->>''policyVersion'' IS DISTINCT FROM ''anki-seconds-v1''');
  definition := pg_catalog.replace(definition,
   'due_at<introduced+(CASE c->>''policyVersion'' WHEN ''anki-v2'' THEN interval ''60 seconds'' ELSE interval ''30 seconds'' END)',
   'due_at<introduced+interval ''30 seconds''');
  EXECUTE definition;
  SELECT pg_catalog.pg_get_functiondef('public.fsrs_apply_operation(uuid,jsonb)'::pg_catalog.regprocedure) INTO definition;
  EXECUTE pg_catalog.replace(definition,
   'OR (c->>''due'')::timestamptz<>(c->>''introducedAt'')::timestamptz+(CASE c->>''policyVersion'' WHEN ''anki-v2'' THEN interval ''60 seconds'' ELSE interval ''30 seconds'' END)',
   'OR (c->>''due'')::timestamptz<>(c->>''introducedAt'')::timestamptz+interval ''30 seconds''');
  SELECT pg_catalog.pg_get_functiondef('public.fsrs_save_manual_vocabulary(uuid,jsonb,jsonb)'::pg_catalog.regprocedure) INTO definition;
  EXECUTE pg_catalog.replace(definition,
   'OR (p_initial_card->>''due'')::timestamptz<>(p_initial_card->>''introducedAt'')::timestamptz+(CASE p_initial_card->>''policyVersion'' WHEN ''anki-v2'' THEN interval ''60 seconds'' ELSE interval ''30 seconds'' END)',
   'OR (p_initial_card->>''due'')::timestamptz<>(p_initial_card->>''introducedAt'')::timestamptz+interval ''30 seconds''');
  FOR target IN SELECT * FROM (VALUES
   ('fsrs_private.valid_card(jsonb)', '9a00ba46e140f8f89454655bf6c44bd3'),
   ('public.fsrs_apply_operation(uuid,jsonb)', '7ce546f1abdc3aa0023e7fe30cc986f7'),
   ('public.fsrs_save_manual_vocabulary(uuid,jsonb,jsonb)', '664f815988ddb3171a24d0784c1382d9'),
   ('public.fsrs_capabilities()', '541fd0626640eff4b9a75ffd19715c5b')) t(signature, md5)
  LOOP
   IF (SELECT pg_catalog.md5(p.prosrc) FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure(target.signature))
      IS DISTINCT FROM target.md5 THEN
    RAISE EXCEPTION 'anki_v2_rollback_body_mismatch %', target.signature;
   END IF;
  END LOOP;
 END IF;

 UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash();
 UPDATE fsrs_private.manual_save_settings SET contract_hash = fsrs_private.manual_contract_hash();
 IF (SELECT contract_hash FROM fsrs_private.admission_settings) IS DISTINCT FROM fsrs_private.admission_contract_hash()
  OR (SELECT profile_contract_hash FROM fsrs_private.activity_settings) IS DISTINCT FROM fsrs_private.activity_profile_hash() THEN
  RAISE EXCEPTION 'anki_v2_rollback_unrelated_contract_moved';
 END IF;
 PERFORM fsrs_private.require_admission_integrity();
 IF EXISTS (SELECT 1 FROM public.fsrs_cards WHERE NOT fsrs_private.valid_card(card)) THEN
  RAISE EXCEPTION 'anki_v2_rollback_invalid_existing_card';
 END IF;
END $anki_v2_rollback$;

COMMIT;
