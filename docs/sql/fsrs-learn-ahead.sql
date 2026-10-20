-- FSRS-ANKI-R2 (c): 세션 끝 대기 없애기 — Anki learn-ahead(학습 · 재학습 카드는 기한 20분 전부터 물을 수 있다).
-- 상태: 검수용 후보. 운영 DB에 적용하지 않았다(2026-10-18 KST). 적용은 SQL 검수 · 오너 확인 뒤 M09 경로로.
--
-- Anki 근거: rslib/src/scheduler/queue/builder — 학습 단계 카드는 learn_ahead_secs(기본 1200초) 안이면
--   다른 카드가 없을 때 바로 보여 준다. 그래서 1분 · 10분 단계 뒤에 「잠시 뒤」를 기다리며 세션이 끝나지 않는다.
--   어느 때 앞당겨 물을지는 앱이 정한다(다른 카드가 남았으면 기한까지 기다림). DB는 허용 폭만 넓힌다.
--
-- 바꾸는 것(비파괴 — 학습자 행은 읽기만 한다):
--  1. public.fsrs_apply_operation: 질문 · 정답 보기 · 중단의 「기한 전 거절」(fsrs_card_not_due)이
--     학습 · 재학습 카드에 한해 기한 20분 전부터 받는다. 되돌리기 · 중단 뒤 30초 재질문 대기는 그대로 지킨다.
--     복습(Review) · 새(New) 카드는 그대로 기한까지 기다린다. 채점 계산은 앱이 실제 시각으로 하고
--     valid_card(due ≥ lastReview · scheduledDays 범위)는 바꾸지 않는다.
--  2. public.fsrs_capabilities: 'learnAheadSeconds',1200 — 앱은 이 값을 받았을 때만 앞당겨 묻는다.
--     값이 없으면(적용 전 · 복원 뒤) 예전처럼 기한까지 기다린다.
--  3. 지문 재게시: fsrs_private.settings.contract_hash. 나머지 세 지문은 그대로이며 끝에서 확인한다.
-- 바꾸지 않는 것: valid_card, fsrs_private.next_question_at, 테이블 · 정책 · 권한 · 트리거, 학습자 행.
--
-- 순서: 앱 코드(FSRS-ANKI-R2 PR)는 이 SQL 전후 어느 쪽에서도 동작한다(값이 없으면 앞당기지 않음).
--   ① 이 파일을 한 트랜잭션으로 실행 ② 끝의 확인 쿼리를 KST 시각과 함께 기록.
-- 적용 전 본문 MD5는 anki-v2 SQL(docs/sql/fsrs-anki-v2-policy.sql)을 적용한 뒤의 값이다(PGlite 재현). 다르면 아무것도 바꾸지 않는다.
-- 복원: docs/sql/fsrs-learn-ahead-rollback.sql. 검증: node supabase/tests/fsrs-learn-ahead.mjs (PGlite + M09 fixture + anki-v2).
BEGIN;
SET LOCAL search_path = '';

DO $learn_ahead$
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
 FOR target IN SELECT * FROM (VALUES
  ('public.fsrs_apply_operation(uuid,jsonb)', '0a1a8c9922c1d9fbbdbb9621cd9634f8'),
  ('public.fsrs_capabilities()', 'bec668cbc7d88bcf2130278fd2469c13'),
  ('fsrs_private.next_question_at(uuid,uuid)', 'e67483ca4237e6965c7f0b47121d14de')) t(signature, md5)
 LOOP
  IF (SELECT pg_catalog.md5(p.prosrc) FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure(target.signature))
     IS DISTINCT FROM target.md5 THEN
   RAISE EXCEPTION 'learn_ahead_unexpected_definition %', target.signature;
  END IF;
 END LOOP;
 IF (SELECT contract_hash FROM fsrs_private.settings) IS DISTINCT FROM fsrs_private.contract_hash()
  OR (SELECT contract_hash FROM fsrs_private.manual_save_settings) IS DISTINCT FROM fsrs_private.manual_contract_hash()
  OR (SELECT contract_hash FROM fsrs_private.admission_settings) IS DISTINCT FROM fsrs_private.admission_contract_hash()
  OR (SELECT profile_contract_hash FROM fsrs_private.activity_settings) IS DISTINCT FROM fsrs_private.activity_profile_hash() THEN
  RAISE EXCEPTION 'learn_ahead_contract_not_pinned';
 END IF;

 -- 1. 기한 전 거절 — 학습 · 재학습만 20분 앞까지(각 기준 문장은 정확히 한 번 있어야 한다)
 SELECT pg_catalog.pg_get_functiondef('public.fsrs_apply_operation(uuid,jsonb)'::pg_catalog.regprocedure) INTO definition;
 IF (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, due_anchor, ''))) <> pg_catalog.length(due_anchor)
  OR (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, wait_anchor, ''))) <> pg_catalog.length(wait_anchor) THEN
  RAISE EXCEPTION 'learn_ahead_apply_anchor';
 END IF;
 EXECUTE pg_catalog.replace(pg_catalog.replace(definition, due_anchor, due_ahead), wait_anchor, wait_ahead);

 -- 2. 알리는 허용 폭
 SELECT pg_catalog.pg_get_functiondef('public.fsrs_capabilities()'::pg_catalog.regprocedure) INTO definition;
 IF (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, cap_anchor, ''))) <> pg_catalog.length(cap_anchor) THEN
  RAISE EXCEPTION 'learn_ahead_capabilities_anchor';
 END IF;
 EXECUTE pg_catalog.replace(definition, cap_anchor, cap_ahead);

 -- 3. 지문 재게시 — 핵심 지문만. 나머지 셋은 그대로여야 한다.
 UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash();
 IF (SELECT contract_hash FROM fsrs_private.manual_save_settings) IS DISTINCT FROM fsrs_private.manual_contract_hash()
  OR (SELECT contract_hash FROM fsrs_private.admission_settings) IS DISTINCT FROM fsrs_private.admission_contract_hash()
  OR (SELECT profile_contract_hash FROM fsrs_private.activity_settings) IS DISTINCT FROM fsrs_private.activity_profile_hash() THEN
  RAISE EXCEPTION 'learn_ahead_unrelated_contract_moved';
 END IF;
 PERFORM fsrs_private.require_admission_integrity();
 IF EXISTS (SELECT 1 FROM public.fsrs_cards WHERE NOT fsrs_private.valid_card(card)) THEN
  RAISE EXCEPTION 'learn_ahead_invalid_existing_card';
 END IF;
END $learn_ahead$;

COMMIT;

-- 확인(읽기 전용, 적용 직후 KST 시각과 함께 기록):
-- SELECT public.fsrs_capabilities()->>'learnAheadSeconds' AS learn_ahead,  -- '1200' (로그인 세션에서)
--  (SELECT contract_hash FROM fsrs_private.settings)=fsrs_private.contract_hash() AS core_pinned,
--  (SELECT contract_hash FROM fsrs_private.manual_save_settings)=fsrs_private.manual_contract_hash() AS manual_pinned,
--  (SELECT count(*) FROM public.fsrs_cards) AS cards,
--  (SELECT count(*) FROM public.fsrs_cards WHERE fsrs_private.valid_card(card)) AS valid_cards;
