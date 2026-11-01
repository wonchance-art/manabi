-- CARD-TYPES-001 단계 1 복원 — 20261101090000_fsrs_cards_kind.sql을 되돌린다: public.fsrs_cards에 더한 제약 넷 · 인덱스 둘(UNIQUE · FK 검사용) ·
--   두 열(vocabulary_id 생성 열 · kind)을 지우고 core · admission 재게시. 표는 그 파일 전 모양으로 정확히 돌아온다(PGlite: 게시값도 그 전 값과
--   같다 — 지문 열쇠의 OID는 지운 객체 것뿐이다). 함수 본문은 바꾸지 않는다(그 파일도 바꾸지 않았다).
-- 데이터: 지우는 두 열은 단계 1에서 card_id(생성 열)와 상수('recognition')에서 나온 값뿐이라 잃는 정보가 없다 — 사전 검사가 모든 행이
--   vocabulary_id = card_id · kind = 'recognition'인지 확인한다(단계 1 CHECK가 다른 종류 행을 막아 왔다). 카드 · 연산 · 영수증 행은 그대로다.
-- 단계 2(종류 카드 생성 · DROP EXPRESSION)를 적용한 뒤에는 이 파일로 되돌리지 않는다 — 모양이 달라 사전 검사가 RAISE한다(단계 2의 복원을 먼저).
-- 이 파일은 마이그레이션이 아니다(docs/sql) — db push가 적용하지 않는다. 운영 적용은 오너 승인 후 SQL 편집기에서 본문 그대로.
-- 실행 형태: SQL 편집기 한 번 실행 = 암묵 트랜잭션 하나 → BEGIN/COMMIT 없음, SET LOCAL 실효를 첫 DO가 확인. 어느 검사든 RAISE하면 전부 롤백.
-- 사전 검사가 받는 상태: ① NEW 모양(적용 뒤) · 네 계약 일치 → 되돌림 ② 이미 OLD 모양(되돌린 뒤) → no-op. 그 밖이면 RAISE.
-- 사후 검사: OLD 모양 · 행 수 그대로 · 학습 함수 본문 · 속성 그대로 · 네 계약 동치 · manual · profile 불변 · 캐시 갱신 ·
--   카드가 있는 사용자 전원의 fsrs_vocabulary_snapshot(now 제외) · fsrs_list_states 출력 동일.
SET LOCAL search_path = '';
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '180s';

DO $runner$
BEGIN
 IF pg_catalog.current_setting('search_path') NOT IN ('', '""') OR pg_catalog.current_setting('lock_timeout') <> '5s'
    OR pg_catalog.current_setting('statement_timeout') <> '3min'
 THEN RAISE EXCEPTION 'card_kinds_rollback: SET LOCAL not in effect (search_path=%, lock_timeout=%, statement_timeout=%)',
   pg_catalog.current_setting('search_path'), pg_catalog.current_setting('lock_timeout'), pg_catalog.current_setting('statement_timeout');
 END IF;
END $runner$;

-- ── 공통 도구(pg_temp, 이 세션 전용 · 끝에서 DROP). 모양 · 함수 · 계약 도구는 마이그레이션과 같은 정의다.
CREATE FUNCTION pg_temp.ckr_contracts() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object(
  'ok', s.contract_hash IS NOT DISTINCT FROM fsrs_private.contract_hash()
    AND m.contract_hash IS NOT DISTINCT FROM fsrs_private.manual_contract_hash()
    AND a.contract_hash IS NOT DISTINCT FROM fsrs_private.admission_contract_hash()
    AND t.profile_contract_hash IS NOT DISTINCT FROM fsrs_private.activity_profile_hash(),
  'core', s.contract_hash, 'manual', m.contract_hash, 'admission', a.contract_hash, 'profile', t.profile_contract_hash)
 FROM fsrs_private.settings s, fsrs_private.manual_save_settings m, fsrs_private.admission_settings a, fsrs_private.activity_settings t
$q$;
CREATE FUNCTION pg_temp.ckr_functions() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_object_agg(p.oid::pg_catalog.regprocedure::text, pg_catalog.jsonb_build_array(pg_catalog.md5(p.prosrc), p.proowner,
   p.prosecdef, p.proconfig, p.provolatile, p.proparallel, p.proleakproof, p.proisstrict, p.prolang, p.prorettype, p.proretset, p.proacl::text))
 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'fsrs_private' OR (n.nspname = 'public' AND (p.proname LIKE 'fsrs\_%' ESCAPE '\' OR p.proname LIKE 'learning\_%' ESCAPE '\'))
$q$;
CREATE FUNCTION pg_temp.ckr_shape() RETURNS text[] LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.array_agg(x ORDER BY x COLLATE "C") FROM (
  SELECT pg_catalog.format('column %s %s%s%s', a.attname, pg_catalog.format_type(a.atttypid, a.atttypmod),
    CASE WHEN a.attnotnull THEN ' not null' ELSE '' END,
    CASE WHEN a.attgenerated = 's' THEN ' generated stored ' || pg_catalog.pg_get_expr(d.adbin, d.adrelid)
         WHEN d.adbin IS NOT NULL THEN ' default ' || pg_catalog.pg_get_expr(d.adbin, d.adrelid) ELSE '' END) AS x
  FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE a.attrelid = 'public.fsrs_cards'::pg_catalog.regclass AND a.attnum > 0 AND NOT a.attisdropped
  UNION ALL SELECT 'constraint ' || c.conname || ' ' || pg_catalog.pg_get_constraintdef(c.oid) FROM pg_catalog.pg_constraint c
  WHERE c.conrelid = 'public.fsrs_cards'::pg_catalog.regclass AND c.contype <> 'n'
  UNION ALL SELECT 'index ' || pg_catalog.pg_get_indexdef(i.indexrelid) FROM pg_catalog.pg_index i WHERE i.indrelid = 'public.fsrs_cards'::pg_catalog.regclass
  UNION ALL SELECT 'trigger ' || pg_catalog.pg_get_triggerdef(t.oid) FROM pg_catalog.pg_trigger t
  WHERE t.tgrelid = 'public.fsrs_cards'::pg_catalog.regclass AND NOT t.tgisinternal) q
$q$;
CREATE FUNCTION pg_temp.ckr_old_shape() RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = '' AS $q$
 SELECT ARRAY[
  'column attempt jsonb',
  'column card jsonb not null',
  'column card_id uuid not null',
  'column enrolled_at timestamp with time zone not null default clock_timestamp()',
  'column user_id uuid not null',
  'constraint fsrs_cards_card_check CHECK (fsrs_private.valid_card(card))',
  'constraint fsrs_cards_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.user_vocabulary(id) ON DELETE RESTRICT',
  'constraint fsrs_cards_pkey PRIMARY KEY (card_id)',
  'constraint fsrs_cards_user_id_card_id_key UNIQUE (user_id, card_id)',
  'constraint fsrs_cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT',
  'index CREATE UNIQUE INDEX fsrs_cards_pkey ON public.fsrs_cards USING btree (card_id)',
  'index CREATE UNIQUE INDEX fsrs_cards_user_id_card_id_key ON public.fsrs_cards USING btree (user_id, card_id)',
  'trigger CREATE TRIGGER learning_guard_enrollment BEFORE INSERT ON public.fsrs_cards FOR EACH ROW EXECUTE FUNCTION fsrs_private.guard_learning_enrollment()']
$q$;
CREATE FUNCTION pg_temp.ckr_new_shape() RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = '' AS $q$
 SELECT ARRAY[
  'column attempt jsonb',
  'column card jsonb not null',
  'column card_id uuid not null',
  'column enrolled_at timestamp with time zone not null default clock_timestamp()',
  'column kind text not null default ''recognition''::text',
  'column user_id uuid not null',
  'column vocabulary_id uuid not null generated stored card_id',
  'constraint fsrs_cards_card_check CHECK (fsrs_private.valid_card(card))',
  'constraint fsrs_cards_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.user_vocabulary(id) ON DELETE RESTRICT',
  'constraint fsrs_cards_kind_check CHECK ((kind = ANY (ARRAY[''recognition''::text, ''production''::text, ''listening''::text])))',
  'constraint fsrs_cards_kind_stage1_check CHECK ((kind = ''recognition''::text))',
  'constraint fsrs_cards_pkey PRIMARY KEY (card_id)',
  'constraint fsrs_cards_recognition_identity_check CHECK (((kind <> ''recognition''::text) OR (vocabulary_id = card_id)))',
  'constraint fsrs_cards_user_id_card_id_key UNIQUE (user_id, card_id)',
  'constraint fsrs_cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT',
  'constraint fsrs_cards_user_id_vocabulary_id_kind_key UNIQUE (user_id, vocabulary_id, kind)',
  'constraint fsrs_cards_vocabulary_id_fkey FOREIGN KEY (vocabulary_id) REFERENCES public.user_vocabulary(id) ON DELETE RESTRICT',
  'index CREATE INDEX fsrs_cards_vocabulary_id_idx ON public.fsrs_cards USING btree (vocabulary_id)',
  'index CREATE UNIQUE INDEX fsrs_cards_pkey ON public.fsrs_cards USING btree (card_id)',
  'index CREATE UNIQUE INDEX fsrs_cards_user_id_card_id_key ON public.fsrs_cards USING btree (user_id, card_id)',
  'index CREATE UNIQUE INDEX fsrs_cards_user_id_vocabulary_id_kind_key ON public.fsrs_cards USING btree (user_id, vocabulary_id, kind)',
  'trigger CREATE TRIGGER learning_guard_enrollment BEFORE INSERT ON public.fsrs_cards FOR EACH ROW EXECUTE FUNCTION fsrs_private.guard_learning_enrollment()']
$q$;

CREATE TEMP TABLE ckr_output_before ON COMMIT DROP AS
 SELECT u.user_id AS actor, public.fsrs_vocabulary_snapshot(u.user_id) - 'now' AS snapshot, public.fsrs_list_states(u.user_id) AS states
 FROM (SELECT DISTINCT f.user_id FROM public.fsrs_cards f WHERE EXISTS (SELECT 1 FROM auth.users a WHERE a.id = f.user_id)) u;
CREATE TEMP TABLE ckr_state_before ON COMMIT DROP AS
 SELECT pg_temp.ckr_contracts() AS contracts, pg_temp.ckr_functions() AS functions,
  (SELECT pg_catalog.count(*) FROM public.fsrs_cards) AS cards, (SELECT pg_catalog.count(*) FROM pg_temp.ckr_output_before) AS actors;

DO $pre$
DECLARE c jsonb := pg_temp.ckr_contracts(); shape text[] := pg_temp.ckr_shape(); bad bigint;
BEGIN
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'card_kinds_rollback: learning contracts already drifted %', c; END IF;
 PERFORM fsrs_private.require_admission_integrity();
 IF shape = pg_temp.ckr_new_shape() THEN
  -- 지울 두 열이 card_id · 상수에서 나온 값뿐인지(잃는 정보 없음). 열 이름은 이 갈래에서만 있으니 동적 SQL로 읽는다.
  EXECUTE 'SELECT pg_catalog.count(*) FROM public.fsrs_cards f WHERE f.vocabulary_id IS DISTINCT FROM f.card_id OR f.kind IS DISTINCT FROM ''recognition''' INTO bad;
  IF bad <> 0 THEN RAISE EXCEPTION 'card_kinds_rollback: % cards are not recognition = card id (stage 2 data?)', bad; END IF;
  RAISE NOTICE 'card_kinds_rollback: needs rollback';
 ELSIF shape = pg_temp.ckr_old_shape() THEN
  RAISE NOTICE 'card_kinds_rollback: already rolled back — no-op';
 ELSE
  RAISE EXCEPTION 'card_kinds_rollback: unreviewed state (fsrs_cards shape %)', shape;
 END IF;
END $pre$;

DO $change$
BEGIN
 IF pg_temp.ckr_shape() = pg_temp.ckr_new_shape() THEN
  DROP INDEX public.fsrs_cards_vocabulary_id_idx;
  ALTER TABLE public.fsrs_cards
   DROP CONSTRAINT fsrs_cards_user_id_vocabulary_id_kind_key,
   DROP CONSTRAINT fsrs_cards_vocabulary_id_fkey,
   DROP CONSTRAINT fsrs_cards_kind_stage1_check,
   DROP CONSTRAINT fsrs_cards_recognition_identity_check,
   DROP CONSTRAINT fsrs_cards_kind_check,
   DROP COLUMN kind,
   DROP COLUMN vocabulary_id;
 END IF;
 UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash_live() WHERE contract_hash IS DISTINCT FROM fsrs_private.contract_hash_live();
 UPDATE fsrs_private.admission_settings SET contract_hash = fsrs_private.admission_contract_hash_live()
  WHERE contract_hash IS DISTINCT FROM fsrs_private.admission_contract_hash_live();
END $change$;

DO $post$
DECLARE b record; c jsonb := pg_temp.ckr_contracts();
BEGIN
 SELECT * INTO STRICT b FROM pg_temp.ckr_state_before;
 IF pg_temp.ckr_shape() IS DISTINCT FROM pg_temp.ckr_old_shape() THEN RAISE EXCEPTION 'card_kinds_rollback: post shape differs %', pg_temp.ckr_shape(); END IF;
 IF (SELECT pg_catalog.count(*) FROM public.fsrs_cards) <> b.cards THEN RAISE EXCEPTION 'card_kinds_rollback: card rows changed'; END IF;
 IF pg_temp.ckr_functions() IS DISTINCT FROM b.functions THEN RAISE EXCEPTION 'card_kinds_rollback: a learning function changed'; END IF;
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'card_kinds_rollback: contracts not consistent after repin %', c; END IF;
 IF c->'manual' IS DISTINCT FROM b.contracts->'manual' OR c->'profile' IS DISTINCT FROM b.contracts->'profile'
 THEN RAISE EXCEPTION 'card_kinds_rollback: manual or profile pin moved'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
END $post$;

SET CONSTRAINTS fsrs_private.contract_cache_refresh IMMEDIATE;
SET CONSTRAINTS fsrs_private.contract_cache_refresh DEFERRED;

DO $cache$
DECLARE k record;
BEGIN
 SELECT * INTO STRICT k FROM fsrs_private.contract_cache;
 IF NOT k.valid THEN RAISE EXCEPTION 'card_kinds_rollback: refresh did not validate the contract cache'; END IF;
 IF (SELECT s.contract_hash FROM fsrs_private.settings s) IS DISTINCT FROM k.core
    OR (SELECT a.contract_hash FROM fsrs_private.admission_settings a) IS DISTINCT FROM k.admission
 THEN RAISE EXCEPTION 'card_kinds_rollback: cached core/admission differ from the pins'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
END $cache$;

DO $output$
DECLARE r record; n bigint := 0;
BEGIN
 FOR r IN SELECT o.actor, o.snapshot, o.states FROM pg_temp.ckr_output_before o LOOP
  IF public.fsrs_vocabulary_snapshot(r.actor) - 'now' IS DISTINCT FROM r.snapshot OR public.fsrs_list_states(r.actor) IS DISTINCT FROM r.states
  THEN RAISE EXCEPTION 'card_kinds_rollback: learner output changed'; END IF;
  n := n + 1;
 END LOOP;
 IF n <> (SELECT s.actors FROM pg_temp.ckr_state_before s) THEN RAISE EXCEPTION 'card_kinds_rollback: compared % of % learners', n, (SELECT s.actors FROM pg_temp.ckr_state_before s); END IF;
 RAISE NOTICE 'card_kinds_rollback: % learners with cards — output unchanged', n;
END $output$;

DROP FUNCTION pg_temp.ckr_new_shape(); DROP FUNCTION pg_temp.ckr_old_shape(); DROP FUNCTION pg_temp.ckr_shape(); DROP FUNCTION pg_temp.ckr_functions();
DROP FUNCTION pg_temp.ckr_contracts();
DROP TABLE pg_temp.ckr_output_before; DROP TABLE pg_temp.ckr_state_before;
