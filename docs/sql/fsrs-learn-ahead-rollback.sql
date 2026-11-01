-- LEARN-AHEAD-001 복원 — 20261101060000_fsrs_learn_ahead.sql을 되돌린다: public.fsrs_apply_operation 본문의 같은 한 군데(연속한 네 줄 —
--   묻기 시각 검사 둘)를 원래대로, core 재게시. 본문은 그 파일 전(md5 eaa4c9c3…)으로 정확히 돌아온다. 데이터는 바꾸지 않는다 — 미리 물어
--   채점한 기록(연산 · 채점 이벤트 · 카드)은 그대로 남고, 되돌린 뒤에는 학습 · 재학습 카드도 기한부터 묻는다(그 전과 같다).
-- 순서: 앱이 미리 학습을 내지 않게 먼저 되돌린다(배포 롤백). 그 전에 이 파일을 실행하면 화면이 미리 올린 카드의 채점이
--   fsrs_card_not_due로 거절된다(기록은 깨지지 않는다 — 단어 페이지는 「지금은 채점할 수 없어요」).
-- 이 파일은 마이그레이션이 아니다(docs/sql) — db push가 적용하지 않는다. 운영 적용은 오너 승인 후 SQL 편집기에서 본문 그대로.
-- 실행 형태: SQL 편집기 한 번 실행 = 암묵 트랜잭션 하나 → BEGIN/COMMIT 없음, SET LOCAL 실효를 첫 DO가 확인. 어느 검사든 RAISE하면 전부 롤백.
-- 사전 검사가 받는 상태: ① 본문 = 9bf0c861…(적용 뒤) · 네 계약 일치 → 되돌림 ② 이미 eaa4c9c3…(되돌린 뒤) → no-op. 그 밖이면 RAISE.
SET LOCAL search_path = '';
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $runner$
BEGIN
 IF pg_catalog.current_setting('search_path') NOT IN ('', '""') OR pg_catalog.current_setting('lock_timeout') <> '5s'
    OR pg_catalog.current_setting('statement_timeout') <> '1min'
 THEN RAISE EXCEPTION 'learn_ahead_rollback: SET LOCAL not in effect (search_path=%, lock_timeout=%, statement_timeout=%)',
   pg_catalog.current_setting('search_path'), pg_catalog.current_setting('lock_timeout'), pg_catalog.current_setting('statement_timeout');
 END IF;
END $runner$;

-- ── 공통 도구(pg_temp, 이 세션 전용 · 끝에서 DROP).
CREATE FUNCTION pg_temp.lar_contracts() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object(
  'ok', s.contract_hash IS NOT DISTINCT FROM fsrs_private.contract_hash()
    AND m.contract_hash IS NOT DISTINCT FROM fsrs_private.manual_contract_hash()
    AND a.contract_hash IS NOT DISTINCT FROM fsrs_private.admission_contract_hash()
    AND t.profile_contract_hash IS NOT DISTINCT FROM fsrs_private.activity_profile_hash(),
  'core', s.contract_hash, 'manual', m.contract_hash, 'admission', a.contract_hash, 'profile', t.profile_contract_hash)
 FROM fsrs_private.settings s, fsrs_private.manual_save_settings m, fsrs_private.admission_settings a, fsrs_private.activity_settings t
$q$;
CREATE FUNCTION pg_temp.lar_md5(p_sig text) RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.md5(p.prosrc) FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure(p_sig)
$q$;
CREATE FUNCTION pg_temp.lar_attrs(p_sig text) RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_array(p.proowner, p.prosecdef, p.proconfig, p.provolatile, p.proparallel, p.proleakproof, p.proisstrict,
   p.prolang, p.prorettype, p.proretset, p.proacl::text)
 FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure(p_sig)
$q$;
-- 함수 원문에서 한 군데만 바꿔 같은 정의로 다시 만든다 — 정확히 한 번 나와야 한다.
CREATE FUNCTION pg_temp.lar_patch(p_sig text, p_old text, p_new text) RETURNS void LANGUAGE plpgsql SET search_path = '' AS $q$
DECLARE def text := pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(p_sig)); n integer;
BEGIN
 n := (pg_catalog.length(def) - pg_catalog.length(pg_catalog.replace(def, p_old, ''))) / pg_catalog.length(p_old);
 IF n <> 1 THEN RAISE EXCEPTION 'learn_ahead_rollback: % has % copies of the learn-ahead checks (expected 1)', p_sig, n; END IF;
 EXECUTE pg_catalog.replace(def, p_old, p_new);
END
$q$;

DO $pre$
DECLARE c jsonb := pg_temp.lar_contracts(); app text := pg_temp.lar_md5('public.fsrs_apply_operation(uuid,jsonb)');
BEGIN
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'learn_ahead_rollback: learning contracts drifted %', c; END IF;
 IF app = '9bf0c8612988174843d69731a953390c' THEN RAISE NOTICE 'learn_ahead_rollback: needs change';
 ELSIF app = 'eaa4c9c3bb6c40970bf1ca9ed6560ea4' THEN RAISE NOTICE 'learn_ahead_rollback: already restored — no-op';
 ELSE RAISE EXCEPTION 'learn_ahead_rollback: not a reviewed state (apply %)', app;
 END IF;
END $pre$;

DO $change$
DECLARE c jsonb := pg_temp.lar_contracts(); attrs jsonb := pg_temp.lar_attrs('public.fsrs_apply_operation(uuid,jsonb)');
BEGIN
 IF pg_temp.lar_md5('public.fsrs_apply_operation(uuid,jsonb)') = '9bf0c8612988174843d69731a953390c' THEN
  PERFORM pg_temp.lar_patch('public.fsrs_apply_operation(uuid,jsonb)',
   $l$at_time<(f.card->>'due')::timestamptz-(CASE WHEN f.card->>'state' IN ('Learning','Relearning') THEN interval '20 minutes' ELSE interval '0 seconds' END) OR at_time>clock_timestamp()+interval '5 seconds'
    THEN RAISE EXCEPTION 'fsrs_card_not_due' USING ERRCODE='55000'; END IF;
   -- LEARN-AHEAD-001: learning/relearning cards may be asked up to 20 minutes before due; Review/New cards keep the exact due.
   -- The undo (+30s) and abandon (+30s) waits of next_question_at stay strict: same three bounds with only the due moved earlier.
   IF kind='question' THEN
    IF at_time<fsrs_private.next_question_at(p_actor,cid) AND (f.card->>'state' NOT IN ('Learning','Relearning')
     OR at_time<greatest((f.card->>'due')::timestamptz-interval '20 minutes',
      (SELECT max((o.operation#>>'{log,reviewedAt}')::timestamptz)+interval '30 seconds' FROM public.fsrs_operations o WHERE o.user_id=p_actor AND o.card_id=cid AND o.kind='undo'),
      CASE WHEN f.attempt->>'phase'='abandoned' THEN greatest((f.attempt->>'questionAt')::timestamptz,(f.attempt->>'revealedAt')::timestamptz)+interval '30 seconds' END)) THEN$l$,
   $l$at_time<(f.card->>'due')::timestamptz OR at_time>clock_timestamp()+interval '5 seconds'
    THEN RAISE EXCEPTION 'fsrs_card_not_due' USING ERRCODE='55000'; END IF;
   IF kind='question' THEN
    IF at_time<fsrs_private.next_question_at(p_actor,cid) THEN$l$);
 END IF;
 UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash_live() WHERE contract_hash IS DISTINCT FROM fsrs_private.contract_hash_live();
 IF pg_temp.lar_md5('public.fsrs_apply_operation(uuid,jsonb)') IS DISTINCT FROM 'eaa4c9c3bb6c40970bf1ca9ed6560ea4'
 THEN RAISE EXCEPTION 'learn_ahead_rollback: body did not return to the original'; END IF;
 IF pg_temp.lar_attrs('public.fsrs_apply_operation(uuid,jsonb)') IS DISTINCT FROM attrs
 THEN RAISE EXCEPTION 'learn_ahead_rollback: function attributes or grants changed'; END IF;
 IF NOT (pg_temp.lar_contracts()->>'ok')::boolean
    OR pg_temp.lar_contracts()->'manual' IS DISTINCT FROM c->'manual' OR pg_temp.lar_contracts()->'profile' IS DISTINCT FROM c->'profile'
    OR pg_temp.lar_contracts()->'admission' IS DISTINCT FROM c->'admission'
 THEN RAISE EXCEPTION 'learn_ahead_rollback: contracts not consistent after repin'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
END $change$;

SET CONSTRAINTS fsrs_private.contract_cache_refresh IMMEDIATE;
SET CONSTRAINTS fsrs_private.contract_cache_refresh DEFERRED;

DO $cache$
DECLARE k record;
BEGIN
 SELECT * INTO STRICT k FROM fsrs_private.contract_cache;
 IF NOT k.valid THEN RAISE EXCEPTION 'learn_ahead_rollback: refresh did not validate the contract cache'; END IF;
 IF (SELECT s.contract_hash FROM fsrs_private.settings s) IS DISTINCT FROM k.core
    OR (SELECT a.contract_hash FROM fsrs_private.admission_settings a) IS DISTINCT FROM k.admission
 THEN RAISE EXCEPTION 'learn_ahead_rollback: cached core/admission differ from the pins'; END IF;
END $cache$;

DROP FUNCTION pg_temp.lar_patch(text, text, text); DROP FUNCTION pg_temp.lar_attrs(text);
DROP FUNCTION pg_temp.lar_md5(text); DROP FUNCTION pg_temp.lar_contracts();
