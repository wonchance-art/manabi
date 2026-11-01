-- LEARN-AHEAD-001 — 미리 학습(Anki 「learn ahead limit」 기본 20분). 오너 승인 2026-11-01 KST: 오늘 줄에 채점할 카드가 남지 않았을 때
--   학습 · 재학습 단계(분 단위 — anki-v2 학습 1분 · 10분, 재학습 10분) 카드는 다음 질문 시각이 20분 안이면 바로 묻고 채점한다.
--   날 단위 복습 카드(Review)와 New 카드는 차례 전에 묻지 않는다(기한 그대로). 「언제 미리 낼지」(채점할 카드가 남지 않았을 때만)는
--   화면이 정하고, 이 함수는 「얼마나 일찍 · 어떤 카드」만 지킨다(20분 · 학습 · 재학습). JS 정본 = src/lib/fsrsScheduler.js
--   FSRS_LEARN_AHEAD_SECONDS · fsrsAskableAt, 서버 전이 = src/lib/server/fsrsLearning.js fsrsQuestionBound(같은 식).
-- 적용 경로 = PR이 main에 병합되면 supabase-migrations.yml(db push)이 운영에 바로 적용한다 → 병합 승인 = 운영 적용 승인
--   (오너 지속 실행 승인 2026-10-02 KST 범위 — 비파괴 · 검토한 SQL · 복원 경로).
-- 실행 형태: db push는 파일 전체 + 이력 INSERT를 한 파이프라인(암묵 트랜잭션 하나)으로 보낸다 → BEGIN/COMMIT 없음, SET LOCAL 실효를
--   첫 DO가 확인. 어느 검사든 RAISE하면 이력까지 함께 롤백된다. 실행 주체 postgres, 앱 사용자(JWT)를 만들지 않는다.
-- 바꾸는 것 — public.fsrs_apply_operation 한 함수, 본문 한 군데(연속한 네 줄 — 묻기 시각 검사 둘)만(본문 md5 eaa4c9c3… → 9bf0c861…):
--   ⑴ 묻기 · 보이기 · 중단의 「시도 질문 시각 ≥ 카드 기한」 → 학습 · 재학습 카드는 「≥ 기한 − 20분」. 보이기 · 중단은 같은 시도의
--      질문 시각(묻기에서 이미 받은 시각)을 다시 보는 검사라 같은 경계여야 미리 물은 시도를 열고 닫을 수 있다.
--   ⑵ 묻기의 「≥ fsrs_private.next_question_at」(기한 · 되돌린 뒤 30초 · 중단 뒤 30초 중 가장 늦은 것) → 복습 · New 카드는 그대로,
--      학습 · 재학습 카드는 같은 셋에서 기한만 20분 당긴 것(되돌리기 · 중단 대기 두 식은 next_question_at 본문 그대로 옮겼다 — 엄격 유지).
--   fsrs_private.next_question_at은 바꾸지 않는다 — 목록 · 상태 읽기 · 반영 응답의 nextQuestionAt(화면의 「4분 후」)은 실제 기한 그대로다.
--   중단 뒤 재질문의 invalid_attempt_phase 검사(30초)와 채점 · 되돌리기 검사도 그대로다.
--   본문은 다시 쓰지 않고 pg_get_functiondef 원문에서 그 한 군데만 바꾼다(정확히 한 번 · 바뀐 뒤 md5가 위 값 — 운영 원문에 같은 치환을
--   적용해 계산한 값: PGlite 재생 fixture의 본문 md5 = 운영 eaa4c9c3…에서 확인).
-- 재게시: core만(fsrs_apply_operation은 core 지문 안 · admission 지문 밖 — 사후 검사가 admission 불변을 확인). manual · activity profile ·
--   한국어 capability 지문은 그대로(사후 검사).
-- 사전 검사가 받는 상태: ① 본문 = eaa4c9c3…(LEVEL-NEW-CUSTOM-001 뒤) · 네 계약 일치 ② 이 파일을 이미 적용(no-op). 그 밖이면 RAISE.
-- 복원: docs/sql/fsrs-learn-ahead-rollback.sql — 같은 한 군데를 원래 네 줄로, core 재게시. 데이터 변경 없음(미리 채점한 기록은 그대로 남는다).
SET LOCAL search_path = '';
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '180s';

DO $runner$
BEGIN
 IF pg_catalog.current_setting('search_path') NOT IN ('', '""') OR pg_catalog.current_setting('lock_timeout') <> '5s'
    OR pg_catalog.current_setting('statement_timeout') <> '3min'
 THEN RAISE EXCEPTION 'learn_ahead: SET LOCAL not in effect (search_path=%, lock_timeout=%, statement_timeout=%)',
   pg_catalog.current_setting('search_path'), pg_catalog.current_setting('lock_timeout'), pg_catalog.current_setting('statement_timeout');
 END IF;
END $runner$;

-- ── 공통 도구(pg_temp, 이 세션 전용 · 끝에서 DROP).
CREATE FUNCTION pg_temp.la_contracts() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object(
  'ok', s.contract_hash IS NOT DISTINCT FROM fsrs_private.contract_hash()
    AND m.contract_hash IS NOT DISTINCT FROM fsrs_private.manual_contract_hash()
    AND a.contract_hash IS NOT DISTINCT FROM fsrs_private.admission_contract_hash()
    AND t.profile_contract_hash IS NOT DISTINCT FROM fsrs_private.activity_profile_hash(),
  'core', s.contract_hash, 'manual', m.contract_hash, 'admission', a.contract_hash, 'profile', t.profile_contract_hash)
 FROM fsrs_private.settings s, fsrs_private.manual_save_settings m, fsrs_private.admission_settings a, fsrs_private.activity_settings t
$q$;
CREATE FUNCTION pg_temp.la_md5(p_sig text) RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.md5(p.prosrc) FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure(p_sig)
$q$;
CREATE FUNCTION pg_temp.la_attrs(p_sig text) RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_array(p.proowner, p.prosecdef, p.proconfig, p.provolatile, p.proparallel, p.proleakproof, p.proisstrict,
   p.prolang, p.prorettype, p.proretset, p.proacl::text)
 FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure(p_sig)
$q$;
-- 손대지 않는 함수 — 묻기 시각 · 입장 · 카드 검사를 나눠 맡는 것들(본문 md5 그대로여야 한다).
CREATE FUNCTION pg_temp.la_others() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_object_agg(p.oid::pg_catalog.regprocedure::text, pg_catalog.md5(p.prosrc)) FROM pg_catalog.pg_proc p
 WHERE p.oid IN ('fsrs_private.next_question_at(uuid,uuid)'::pg_catalog.regprocedure, 'fsrs_private.valid_card(jsonb)'::pg_catalog.regprocedure,
   'public.fsrs_apply_learning_operation(uuid,jsonb)'::pg_catalog.regprocedure, 'public.learning_admit_legacy(uuid,jsonb)'::pg_catalog.regprocedure,
   'public.learning_configure_admission(uuid,jsonb)'::pg_catalog.regprocedure,
   'fsrs_private.admission_status(uuid,timestamp with time zone)'::pg_catalog.regprocedure, 'fsrs_private.guard_learning_first_question()'::pg_catalog.regprocedure,
   'public.fsrs_capabilities()'::pg_catalog.regprocedure, 'public.learning_language_capabilities()'::pg_catalog.regprocedure)
$q$;
-- 함수 원문에서 한 군데만 바꿔 같은 정의로 다시 만든다 — 정확히 한 번 나와야 한다.
CREATE FUNCTION pg_temp.la_patch(p_sig text, p_old text, p_new text) RETURNS void LANGUAGE plpgsql SET search_path = '' AS $q$
DECLARE def text := pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(p_sig)); n integer;
BEGIN
 n := (pg_catalog.length(def) - pg_catalog.length(pg_catalog.replace(def, p_old, ''))) / pg_catalog.length(p_old);
 IF n <> 1 THEN RAISE EXCEPTION 'learn_ahead: % has % copies of the due checks (expected 1)', p_sig, n; END IF;
 EXECUTE pg_catalog.replace(def, p_old, p_new);
END
$q$;

CREATE TEMP TABLE la_state_before ON COMMIT DROP AS
 SELECT pg_temp.la_contracts() AS contracts, pg_temp.la_attrs('public.fsrs_apply_operation(uuid,jsonb)') AS apply_attrs,
  pg_temp.la_others() AS others;

DO $pre$
DECLARE c jsonb := pg_temp.la_contracts(); app text := pg_temp.la_md5('public.fsrs_apply_operation(uuid,jsonb)');
BEGIN
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'learn_ahead: learning contracts already drifted %', c; END IF;
 PERFORM fsrs_private.require_admission_integrity();
 IF app = 'eaa4c9c3bb6c40970bf1ca9ed6560ea4' THEN
  RAISE NOTICE 'learn_ahead: needs change';
 ELSIF app = '9bf0c8612988174843d69731a953390c' THEN
  RAISE NOTICE 'learn_ahead: already applied — no-op';
 ELSE
  RAISE EXCEPTION 'learn_ahead: unreviewed state (apply %)', app;
 END IF;
END $pre$;

-- ── 변경(옛 본문일 때만).
DO $change$
BEGIN
 IF pg_temp.la_md5('public.fsrs_apply_operation(uuid,jsonb)') = 'eaa4c9c3bb6c40970bf1ca9ed6560ea4' THEN
  PERFORM pg_temp.la_patch('public.fsrs_apply_operation(uuid,jsonb)',
   $l$at_time<(f.card->>'due')::timestamptz OR at_time>clock_timestamp()+interval '5 seconds'
    THEN RAISE EXCEPTION 'fsrs_card_not_due' USING ERRCODE='55000'; END IF;
   IF kind='question' THEN
    IF at_time<fsrs_private.next_question_at(p_actor,cid) THEN$l$,
   $l$at_time<(f.card->>'due')::timestamptz-(CASE WHEN f.card->>'state' IN ('Learning','Relearning') THEN interval '20 minutes' ELSE interval '0 seconds' END) OR at_time>clock_timestamp()+interval '5 seconds'
    THEN RAISE EXCEPTION 'fsrs_card_not_due' USING ERRCODE='55000'; END IF;
   -- LEARN-AHEAD-001: learning/relearning cards may be asked up to 20 minutes before due; Review/New cards keep the exact due.
   -- The undo (+30s) and abandon (+30s) waits of next_question_at stay strict: same three bounds with only the due moved earlier.
   IF kind='question' THEN
    IF at_time<fsrs_private.next_question_at(p_actor,cid) AND (f.card->>'state' NOT IN ('Learning','Relearning')
     OR at_time<greatest((f.card->>'due')::timestamptz-interval '20 minutes',
      (SELECT max((o.operation#>>'{log,reviewedAt}')::timestamptz)+interval '30 seconds' FROM public.fsrs_operations o WHERE o.user_id=p_actor AND o.card_id=cid AND o.kind='undo'),
      CASE WHEN f.attempt->>'phase'='abandoned' THEN greatest((f.attempt->>'questionAt')::timestamptz,(f.attempt->>'revealedAt')::timestamptz)+interval '30 seconds' END)) THEN$l$);
 END IF;
 -- 재게시: core를 지금 계산한 값으로(바뀔 때만, 정확히 1행). admission은 이 함수를 지문에 넣지 않는다(사후 검사).
 UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash_live() WHERE contract_hash IS DISTINCT FROM fsrs_private.contract_hash_live();
END $change$;

DO $post$
DECLARE b record; c jsonb := pg_temp.la_contracts();
BEGIN
 SELECT * INTO STRICT b FROM pg_temp.la_state_before;
 IF pg_temp.la_md5('public.fsrs_apply_operation(uuid,jsonb)') IS DISTINCT FROM '9bf0c8612988174843d69731a953390c'
 THEN RAISE EXCEPTION 'learn_ahead: post state differs from the reviewed change'; END IF;
 -- 권한 · 소유자 · 속성은 그대로(CREATE OR REPLACE가 지킨다 — 확인).
 IF pg_temp.la_attrs('public.fsrs_apply_operation(uuid,jsonb)') IS DISTINCT FROM b.apply_attrs
 THEN RAISE EXCEPTION 'learn_ahead: function attributes or grants changed'; END IF;
 IF pg_temp.la_others() IS DISTINCT FROM b.others THEN RAISE EXCEPTION 'learn_ahead: an untouched function changed'; END IF;
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'learn_ahead: contracts not consistent after repin %', c; END IF;
 IF c->'manual' IS DISTINCT FROM b.contracts->'manual' OR c->'profile' IS DISTINCT FROM b.contracts->'profile'
    OR c->'admission' IS DISTINCT FROM b.contracts->'admission'
 THEN RAISE EXCEPTION 'learn_ahead: manual, admission or profile pin moved'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
END $post$;

-- ── 캐시 갱신을 지금 실행해 본다(커밋 때 할 일과 같은 함수 — 20261023170000). 이 뒤의 DDL은 임시 객체 DROP뿐이라 캐시를 무효로 만들지 않는다.
SET CONSTRAINTS fsrs_private.contract_cache_refresh IMMEDIATE;
SET CONSTRAINTS fsrs_private.contract_cache_refresh DEFERRED;

DO $cache$
DECLARE k record;
BEGIN
 SELECT * INTO STRICT k FROM fsrs_private.contract_cache;
 IF NOT k.valid THEN RAISE EXCEPTION 'learn_ahead: refresh did not validate the contract cache'; END IF;
 IF (SELECT s.contract_hash FROM fsrs_private.settings s) IS DISTINCT FROM k.core
    OR (SELECT a.contract_hash FROM fsrs_private.admission_settings a) IS DISTINCT FROM k.admission
 THEN RAISE EXCEPTION 'learn_ahead: cached core/admission differ from the pins'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
END $cache$;

DROP FUNCTION pg_temp.la_patch(text, text, text); DROP FUNCTION pg_temp.la_others(); DROP FUNCTION pg_temp.la_attrs(text);
DROP FUNCTION pg_temp.la_md5(text); DROP FUNCTION pg_temp.la_contracts();
DROP TABLE pg_temp.la_state_before;
