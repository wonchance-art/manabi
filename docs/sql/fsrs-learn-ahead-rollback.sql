-- FSRS-ANKI-R2 (c) 복원: docs/sql/fsrs-learn-ahead.sql을 되돌린다. 비파괴(학습자 행은 읽기만 한다).
-- 상태: 검수용 후보. 운영 DB에 적용하지 않았다(2026-10-18 KST).
--
-- fsrs_apply_operation · fsrs_capabilities 본문을 적용 전 그대로 되돌리고(MD5 확인) 핵심 지문을 다시 게시한다.
-- 앱은 learnAheadSeconds가 사라지면 앞당겨 묻지 않는다. 앞당겨 채점한 카드는 valid_card를 그대로 통과한다
-- (valid_card를 바꾸지 않았으므로) — 무효가 되는 카드는 없다.
BEGIN;
SET LOCAL search_path = '';

DO $learn_ahead_rollback$
DECLARE
 definition text;
 target record;
 due_anchor constant text := 'OR at_time<(f.card->>''due'')::timestamptz OR';
 due_ahead constant text := 'OR at_time<(f.card->>''due'')::timestamptz-(CASE WHEN f.card->>''state'' IN (''Learning'',''Relearning'') THEN interval ''20 minutes'' ELSE interval ''0 seconds'' END) OR';
 wait_anchor constant text := 'IF at_time<fsrs_private.next_question_at(p_actor,cid) THEN';
 wait_ahead constant text := 'IF at_time<(CASE WHEN f.card->>''state'' IN (''Learning'',''Relearning'') THEN greatest((f.card->>''due'')::timestamptz-interval ''20 minutes'','
  || '(SELECT max((o.operation#>>''{log,reviewedAt}'')::timestamptz)+interval ''30 seconds'' FROM public.fsrs_operations o WHERE o.user_id=p_actor AND o.card_id=cid AND o.kind=''undo''),'
  || 'CASE WHEN f.attempt->>''phase''=''abandoned'' THEN greatest((f.attempt->>''questionAt'')::timestamptz,(f.attempt->>''revealedAt'')::timestamptz)+interval ''30 seconds'' END)'
  || ' ELSE fsrs_private.next_question_at(p_actor,cid) END) THEN';
 cap_anchor constant text := '''policyVersion'',''anki-v2''';
 cap_ahead constant text := '''policyVersion'',''anki-v2'',''learnAheadSeconds'',1200';
BEGIN
 SELECT pg_catalog.pg_get_functiondef('public.fsrs_capabilities()'::pg_catalog.regprocedure) INTO definition;
 IF pg_catalog.strpos(definition, cap_ahead) = 0 THEN RAISE EXCEPTION 'learn_ahead_rollback_not_applied'; END IF;
 EXECUTE pg_catalog.replace(definition, cap_ahead, cap_anchor);
 SELECT pg_catalog.pg_get_functiondef('public.fsrs_apply_operation(uuid,jsonb)'::pg_catalog.regprocedure) INTO definition;
 EXECUTE pg_catalog.replace(pg_catalog.replace(definition, due_ahead, due_anchor), wait_ahead, wait_anchor);
 FOR target IN SELECT * FROM (VALUES
  ('public.fsrs_apply_operation(uuid,jsonb)', '0a1a8c9922c1d9fbbdbb9621cd9634f8'),
  ('public.fsrs_capabilities()', 'bec668cbc7d88bcf2130278fd2469c13')) t(signature, md5)
 LOOP
  IF (SELECT pg_catalog.md5(p.prosrc) FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure(target.signature))
     IS DISTINCT FROM target.md5 THEN
   RAISE EXCEPTION 'learn_ahead_rollback_body_mismatch %', target.signature;
  END IF;
 END LOOP;

 UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash();
 IF (SELECT contract_hash FROM fsrs_private.manual_save_settings) IS DISTINCT FROM fsrs_private.manual_contract_hash()
  OR (SELECT contract_hash FROM fsrs_private.admission_settings) IS DISTINCT FROM fsrs_private.admission_contract_hash()
  OR (SELECT profile_contract_hash FROM fsrs_private.activity_settings) IS DISTINCT FROM fsrs_private.activity_profile_hash() THEN
  RAISE EXCEPTION 'learn_ahead_rollback_unrelated_contract_moved';
 END IF;
 PERFORM fsrs_private.require_admission_integrity();
 IF EXISTS (SELECT 1 FROM public.fsrs_cards WHERE NOT fsrs_private.valid_card(card)) THEN
  RAISE EXCEPTION 'learn_ahead_rollback_invalid_existing_card';
 END IF;
END $learn_ahead_rollback$;

COMMIT;
