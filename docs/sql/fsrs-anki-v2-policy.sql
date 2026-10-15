-- REV-SCOPE-R1B-2: 학습 단계 정책 anki-v2(학습 1분 · 10분, 재학습 10분).
-- 상태: 검수용 후보. 운영 DB에 적용하지 않았다(2026-10-14 KST). 적용은 SQL 검수 · 오너 확인 뒤 별도.
--
-- 바꾸는 것(비파괴 — 학습자 행은 읽기만 한다):
--  1. fsrs_private.valid_card: policyVersion 'anki-seconds-v1' · 'anki-v2' 둘 다 받는다.
--     New 카드의 첫 질문 대기 하한은 그 카드 정책의 첫 단계(30초 · 1분)다. 기존 카드는 하나도 무효가 되지 않는다.
--  2. public.fsrs_apply_operation(enroll) · public.fsrs_save_manual_vocabulary: 새 카드 due = 소개 시각 + 그 카드 정책의 첫 단계.
--     두 정책 모두 받으므로 배포가 섞인 사이에 예전 정책으로 만든 새 카드도 그대로 들어간다.
--  3. public.fsrs_capabilities: policyVersion 'anki-v2' — 서버가 새 카드 · 다음 채점을 이 정책으로 계산한다.
--     학습 · 재학습 중인 카드는 다음 채점 때 같은 단계 순번으로 anki-v2로 넘어간다(앱 코드).
--  4. 지문 재게시: fsrs_private.settings.contract_hash · manual_save_settings.contract_hash.
--     admission · activity 지문이 보는 객체는 바꾸지 않으므로 그대로이며, 끝에서 네 지문을 모두 확인한다.
-- 바꾸지 않는 것: 취소 · 중단 뒤 30초 재질문 대기(next_question_at), 테이블 · 정책 · 권한 · 트리거, 학습자 행.
--
-- 순서(필수): ① anki-v2를 읽는 앱 코드(REV-SCOPE-R1B-2 PR)가 운영에 배포된 것을 확인
--            ② 이 파일을 한 트랜잭션으로 실행 ③ 끝의 확인 쿼리를 KST 시각과 함께 기록.
-- ①보다 먼저 실행하면 예전 앱은 'anki-v2'를 모르는 정책으로 보고 새 일정 복습을 멈춘다(fsrs_storage_unavailable).
-- 복원: docs/sql/fsrs-anki-v2-policy-rollback.sql.
-- 검증: node supabase/tests/fsrs-anki-v2-policy.mjs (PGlite + M09 운영 정의 fixture).
BEGIN;
SET LOCAL search_path = '';

DO $anki_v2$
DECLARE
 definition text;
 target record;
BEGIN
 -- 운영 정의가 M09 관찰본(2026-10-10)과 같을 때만 손댄다. 다르면 아무것도 바꾸지 않고 멈춘다.
 FOR target IN SELECT * FROM (VALUES
  ('fsrs_private.valid_card(jsonb)', '9a00ba46e140f8f89454655bf6c44bd3'),
  ('public.fsrs_apply_operation(uuid,jsonb)', '7ce546f1abdc3aa0023e7fe30cc986f7'),
  ('public.fsrs_save_manual_vocabulary(uuid,jsonb,jsonb)', '664f815988ddb3171a24d0784c1382d9'),
  ('public.fsrs_capabilities()', '541fd0626640eff4b9a75ffd19715c5b')) t(signature, md5)
 LOOP
  IF (SELECT pg_catalog.md5(p.prosrc) FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure(target.signature))
     IS DISTINCT FROM target.md5 THEN
   RAISE EXCEPTION 'anki_v2_unexpected_definition %', target.signature;
  END IF;
 END LOOP;
 IF (SELECT contract_hash FROM fsrs_private.settings) IS DISTINCT FROM fsrs_private.contract_hash()
  OR (SELECT contract_hash FROM fsrs_private.manual_save_settings) IS DISTINCT FROM fsrs_private.manual_contract_hash()
  OR (SELECT contract_hash FROM fsrs_private.admission_settings) IS DISTINCT FROM fsrs_private.admission_contract_hash()
  OR (SELECT profile_contract_hash FROM fsrs_private.activity_settings) IS DISTINCT FROM fsrs_private.activity_profile_hash() THEN
  RAISE EXCEPTION 'anki_v2_contract_not_pinned';
 END IF;

 -- 1. valid_card — 두 정책 · New 하한은 카드 정책의 첫 단계
 SELECT pg_catalog.pg_get_functiondef('fsrs_private.valid_card(jsonb)'::pg_catalog.regprocedure) INTO definition;
 IF (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition,
      'OR c->>''policyVersion'' IS DISTINCT FROM ''anki-seconds-v1''', ''))) <> pg_catalog.length('OR c->>''policyVersion'' IS DISTINCT FROM ''anki-seconds-v1''')
  OR (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition,
      'due_at<introduced+interval ''30 seconds''', ''))) <> pg_catalog.length('due_at<introduced+interval ''30 seconds''') THEN
  RAISE EXCEPTION 'anki_v2_valid_card_anchor';
 END IF;
 definition := pg_catalog.replace(definition,
  'OR c->>''policyVersion'' IS DISTINCT FROM ''anki-seconds-v1''',
  'OR c->>''policyVersion'' IS NULL OR c->>''policyVersion'' NOT IN (''anki-seconds-v1'',''anki-v2'')');
 definition := pg_catalog.replace(definition,
  'due_at<introduced+interval ''30 seconds''',
  'due_at<introduced+(CASE c->>''policyVersion'' WHEN ''anki-v2'' THEN interval ''60 seconds'' ELSE interval ''30 seconds'' END)');
 EXECUTE definition;

 -- 2-1. 등록(enroll) — due = 소개 + 카드 정책의 첫 단계
 SELECT pg_catalog.pg_get_functiondef('public.fsrs_apply_operation(uuid,jsonb)'::pg_catalog.regprocedure) INTO definition;
 IF (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition,
      'OR (c->>''due'')::timestamptz<>(c->>''introducedAt'')::timestamptz+interval ''30 seconds''', '')))
     <> pg_catalog.length('OR (c->>''due'')::timestamptz<>(c->>''introducedAt'')::timestamptz+interval ''30 seconds''') THEN
  RAISE EXCEPTION 'anki_v2_enroll_anchor';
 END IF;
 EXECUTE pg_catalog.replace(definition,
  'OR (c->>''due'')::timestamptz<>(c->>''introducedAt'')::timestamptz+interval ''30 seconds''',
  'OR (c->>''due'')::timestamptz<>(c->>''introducedAt'')::timestamptz+(CASE c->>''policyVersion'' WHEN ''anki-v2'' THEN interval ''60 seconds'' ELSE interval ''30 seconds'' END)');

 -- 2-2. 직접 담기 — 같은 규칙
 SELECT pg_catalog.pg_get_functiondef('public.fsrs_save_manual_vocabulary(uuid,jsonb,jsonb)'::pg_catalog.regprocedure) INTO definition;
 IF (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition,
      'OR (p_initial_card->>''due'')::timestamptz<>(p_initial_card->>''introducedAt'')::timestamptz+interval ''30 seconds''', '')))
     <> pg_catalog.length('OR (p_initial_card->>''due'')::timestamptz<>(p_initial_card->>''introducedAt'')::timestamptz+interval ''30 seconds''') THEN
  RAISE EXCEPTION 'anki_v2_manual_anchor';
 END IF;
 EXECUTE pg_catalog.replace(definition,
  'OR (p_initial_card->>''due'')::timestamptz<>(p_initial_card->>''introducedAt'')::timestamptz+interval ''30 seconds''',
  'OR (p_initial_card->>''due'')::timestamptz<>(p_initial_card->>''introducedAt'')::timestamptz+(CASE p_initial_card->>''policyVersion'' WHEN ''anki-v2'' THEN interval ''60 seconds'' ELSE interval ''30 seconds'' END)');

 -- 3. 알리는 정책
 SELECT pg_catalog.pg_get_functiondef('public.fsrs_capabilities()'::pg_catalog.regprocedure) INTO definition;
 IF (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, '''policyVersion'',''anki-seconds-v1''', '')))
     <> pg_catalog.length('''policyVersion'',''anki-seconds-v1''') THEN
  RAISE EXCEPTION 'anki_v2_capabilities_anchor';
 END IF;
 EXECUTE pg_catalog.replace(definition, '''policyVersion'',''anki-seconds-v1''', '''policyVersion'',''anki-v2''');

 -- 4. 지문 재게시 — 바꾼 함수가 속한 두 지문만. 나머지 둘은 그대로여야 한다.
 UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash();
 UPDATE fsrs_private.manual_save_settings SET contract_hash = fsrs_private.manual_contract_hash();
 IF (SELECT contract_hash FROM fsrs_private.admission_settings) IS DISTINCT FROM fsrs_private.admission_contract_hash()
  OR (SELECT profile_contract_hash FROM fsrs_private.activity_settings) IS DISTINCT FROM fsrs_private.activity_profile_hash() THEN
  RAISE EXCEPTION 'anki_v2_unrelated_contract_moved';
 END IF;
 PERFORM fsrs_private.require_admission_integrity();
 -- 이미 저장된 카드는 하나도 무효가 되지 않는다(예전 정책 카드 포함).
 IF EXISTS (SELECT 1 FROM public.fsrs_cards WHERE NOT fsrs_private.valid_card(card)) THEN
  RAISE EXCEPTION 'anki_v2_invalid_existing_card';
 END IF;
END $anki_v2$;

COMMIT;

-- 확인(읽기 전용, 적용 직후 KST 시각과 함께 기록):
-- SELECT public.fsrs_capabilities()->>'policyVersion' AS policy,  -- 'anki-v2' (로그인 세션에서)
--  (SELECT contract_hash FROM fsrs_private.settings)=fsrs_private.contract_hash() AS core_pinned,
--  (SELECT contract_hash FROM fsrs_private.manual_save_settings)=fsrs_private.manual_contract_hash() AS manual_pinned,
--  (SELECT count(*) FROM public.fsrs_cards) AS cards,
--  (SELECT count(*) FROM public.fsrs_cards WHERE fsrs_private.valid_card(card)) AS valid_cards,
--  (SELECT count(*) FROM public.fsrs_cards WHERE card->>'policyVersion'='anki-v2') AS anki_v2_cards;
