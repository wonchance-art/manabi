-- CARD-TYPES-001 단계 1 — 카드 표에 「어느 단어의 어느 종류」 모양만 더한다(스키마만 · 동작 무변경). 설계 = docs/design/card-types.md §4 · §7
--   (오너 방향 승인 2026-11-01 KST: 단어 하나에 카드 셋 — 단어 → 뜻 · 뜻 → 단어 · 듣기, 안 A = card_id 독립 + vocabulary_id · kind 열).
-- 적용 경로 = PR이 main에 병합되면 supabase-migrations.yml(db push)이 운영에 바로 적용한다 → 병합 승인 = 운영 적용 승인
--   (오너 지속 실행 승인 2026-10-02 KST 범위 — 비파괴 · 검토한 SQL · 복원 경로).
-- 실행 형태: db push는 파일 전체 + 이력 INSERT를 한 파이프라인(암묵 트랜잭션 하나)으로 보낸다 → BEGIN/COMMIT 없음, SET LOCAL 실효를
--   첫 DO가 확인. 어느 검사든 RAISE하면 이력까지 함께 롤백된다. 실행 주체 postgres, 앱 사용자(JWT)를 만들지 않는다.
-- 바꾸는 것 — public.fsrs_cards 한 표(함수 본문은 하나도 바꾸지 않는다 — 사후 검사가 fsrs_private · public fsrs_% · learning_% 전부 확인):
--   ⑴ vocabulary_id uuid NOT NULL GENERATED ALWAYS AS (card_id) STORED — 카드가 묻는 단어. 단계 1에서는 늘 card_id와 같다(생성 열이라
--      값을 따로 쓰는 길이 없다 — 채우기 = 표 재작성 때 계산, UPDATE 없음 → 행 트리거도 돌지 않는다).
--   ⑵ kind text NOT NULL DEFAULT 'recognition' — 카드 종류. CHECK kind IN ('recognition','production','listening')(영구).
--   ⑶ CHECK kind <> 'recognition' OR vocabulary_id = card_id(영구) — 단어 → 뜻 카드의 id는 단어 id 그대로다. 연산 · 영수증 · 옛 입장 기록이
--      card_id(= 단어 id)로 이어진 것이 단계 2 뒤에도 그대로 맞는다.
--   ⑷ CHECK kind = 'recognition'(단계 1 전용 · 이름 fsrs_cards_kind_stage1_check) — 다른 종류 행은 아직 만들 수 없다. 단계 2가 종류 카드를
--      만드는 같은 마이그레이션에서 지운다(그 전에는 등록 경로 없이 생긴 종류 행이 card_id 자리를 차지할 수 없다).
--   ⑸ FK vocabulary_id → user_vocabulary(id) ON DELETE RESTRICT(지금 card_id FK와 같은 동작) · UNIQUE (user_id, vocabulary_id, kind) ·
--      인덱스 (vocabulary_id)(단어 삭제 때 FK 검사가 PK를 못 쓰므로).
--   지금 card_id → user_vocabulary FK(fsrs_cards_card_id_fkey)는 단계 1에서 그대로 둔다 — 모든 행이 여전히 만족하고(카드 = 단어 → 뜻뿐),
--   지우면 「카드 id = 단어 id」 보장이 생성 열 하나에만 남는다. 단계 2(종류 카드 = 새 uuid)에서 생성식을 걷어 내고(DROP EXPRESSION)
--   등록 경로가 vocabulary_id를 명시해 쓰게 바꾸는 것과 함께 지운다.
-- 왜 생성 열인가(BEFORE INSERT 트리거 · 함수 본문 수정 대신): 등록(fsrs_apply_operation의 INSERT … (card_id,user_id,card))이 열을 몰라도
--   값이 정해지고, 숨은 채우기(트리거)가 아니라 표 정의에 보이는 규칙이며, 함수 본문 지문(core)이 그대로다. 트리거는 admission 지문의
--   추적 트리거 · 입장 무결성 검사(그 표의 사용자 트리거 = learning_guard_enrollment 하나)까지 건드린다.
--   출력 무변경: 14개 함수 어디도 카드 행 전체(to_jsonb(f) · f.*)를 내보내지 않는다(열 이름을 골라 쓴다) — 사후 검사가 snapshot · 목록 출력을 비교.
-- 재게시: core(public.fsrs_* 표의 열 · 제약 · 인덱스) · admission(public.fsrs_cards의 트리거 — FK가 내부 RI 트리거 둘을 단다)을 지금
--   계산한 값으로(_live). manual · activity profile · 한국어 capability 지문은 그대로(사후 검사 — user_vocabulary 쪽 RI 트리거는 내부라
--   capability 범위 밖, 제약은 fsrs_cards 소속).
-- 사전 검사가 받는 상태: ① 표 = 아래 OLD 모양 · fsrs_apply_operation 본문 9bf0c861…(LEARN-AHEAD 뒤) · 네 계약 일치 ② 이 파일을 이미 적용
--   (NEW 모양 — no-op). 그 밖이면 RAISE(일부만 적용된 모양 포함).
-- 사후 검사: NEW 모양 · 모든 행 vocabulary_id = card_id · kind = 'recognition' · 행 수 그대로 · 함수 본문 · 속성 그대로 · 네 계약 동치 ·
--   manual · profile 불변 · 캐시 갱신 · 카드가 있는 사용자 전원의 fsrs_vocabulary_snapshot(now 제외) · fsrs_list_states 출력 동일.
-- 잠금: ALTER TABLE이 fsrs_cards를 ACCESS EXCLUSIVE(생성 열 → 표 재작성) · user_vocabulary를 SHARE ROW EXCLUSIVE(FK)로 잠근다 —
--   lock_timeout 5s 안에 못 잡으면 전부 롤백(다시 실행하면 된다).
-- 복원: docs/sql/fsrs-cards-kind-rollback.sql — 더한 제약 · 인덱스 · 두 열을 지우고 같은 두 지문 재게시(PGlite: 게시값이 이 파일 전 값으로
--   정확히 돌아온다). 지우는 두 열은 이 단계에서 card_id · 상수에서 나온 값이라 잃는 정보가 없다(복원 사전 검사가 확인).
SET LOCAL search_path = '';
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '180s';

DO $runner$
BEGIN
 IF pg_catalog.current_setting('search_path') NOT IN ('', '""') OR pg_catalog.current_setting('lock_timeout') <> '5s'
    OR pg_catalog.current_setting('statement_timeout') <> '3min'
 THEN RAISE EXCEPTION 'card_kinds: SET LOCAL not in effect (search_path=%, lock_timeout=%, statement_timeout=%)',
   pg_catalog.current_setting('search_path'), pg_catalog.current_setting('lock_timeout'), pg_catalog.current_setting('statement_timeout');
 END IF;
END $runner$;

-- ── 공통 도구(pg_temp, 이 세션 전용 · 끝에서 DROP).
CREATE FUNCTION pg_temp.ck_contracts() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object(
  'ok', s.contract_hash IS NOT DISTINCT FROM fsrs_private.contract_hash()
    AND m.contract_hash IS NOT DISTINCT FROM fsrs_private.manual_contract_hash()
    AND a.contract_hash IS NOT DISTINCT FROM fsrs_private.admission_contract_hash()
    AND t.profile_contract_hash IS NOT DISTINCT FROM fsrs_private.activity_profile_hash(),
  'core', s.contract_hash, 'manual', m.contract_hash, 'admission', a.contract_hash, 'profile', t.profile_contract_hash)
 FROM fsrs_private.settings s, fsrs_private.manual_save_settings m, fsrs_private.admission_settings a, fsrs_private.activity_settings t
$q$;
CREATE FUNCTION pg_temp.ck_md5(p_sig text) RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.md5(p.prosrc) FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure(p_sig)
$q$;
-- 학습 함수 전부(fsrs_private · public fsrs_% · learning_%)의 본문 md5 + 본문 밖 속성 — 이 파일은 하나도 바꾸지 않는다.
CREATE FUNCTION pg_temp.ck_functions() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_object_agg(p.oid::pg_catalog.regprocedure::text, pg_catalog.jsonb_build_array(pg_catalog.md5(p.prosrc), p.proowner,
   p.prosecdef, p.proconfig, p.provolatile, p.proparallel, p.proleakproof, p.proisstrict, p.prolang, p.prorettype, p.proretset, p.proacl::text))
 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'fsrs_private' OR (n.nspname = 'public' AND (p.proname LIKE 'fsrs\_%' ESCAPE '\' OR p.proname LIKE 'learning\_%' ESCAPE '\'))
$q$;
-- 표 모양: 열(이름 · 형 · NOT NULL · 생성식/기본값) · 제약(NOT NULL 행 제외 — 버전마다 다르다) · 인덱스 · 사용자 트리거. 정렬은 바이트 순.
CREATE FUNCTION pg_temp.ck_shape() RETURNS text[] LANGUAGE sql STABLE SET search_path = '' AS $q$
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
-- 검토한 두 모양(이 파일 전 = 운영 관측 정의 + 관측 뒤 마이그레이션 · 이 파일 뒤).
CREATE FUNCTION pg_temp.ck_old_shape() RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = '' AS $q$
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
CREATE FUNCTION pg_temp.ck_new_shape() RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = '' AS $q$
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

-- ── 바꾸기 전 상태와 출력(같은 트랜잭션 안). 학습자 출력은 임시 테이블에만 있고(ON COMMIT DROP) 밖으로 내보내지 않는다.
--    카드가 있는 사용자만 — 카드가 없는 사용자의 출력은 카드 표 열과 무관하다.
CREATE TEMP TABLE ck_output_before ON COMMIT DROP AS
 SELECT u.user_id AS actor, public.fsrs_vocabulary_snapshot(u.user_id) - 'now' AS snapshot, public.fsrs_list_states(u.user_id) AS states
 FROM (SELECT DISTINCT f.user_id FROM public.fsrs_cards f WHERE EXISTS (SELECT 1 FROM auth.users a WHERE a.id = f.user_id)) u;
CREATE TEMP TABLE ck_state_before ON COMMIT DROP AS
 SELECT pg_temp.ck_contracts() AS contracts, pg_temp.ck_functions() AS functions,
  (SELECT pg_catalog.count(*) FROM public.fsrs_cards) AS cards, (SELECT pg_catalog.count(*) FROM pg_temp.ck_output_before) AS actors;

DO $pre$
DECLARE c jsonb := pg_temp.ck_contracts(); app text := pg_temp.ck_md5('public.fsrs_apply_operation(uuid,jsonb)'); shape text[] := pg_temp.ck_shape();
BEGIN
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'card_kinds: learning contracts already drifted %', c; END IF;
 PERFORM fsrs_private.require_admission_integrity();
 -- 이 파일은 함수를 바꾸지 않는다 — 검토한 반영 함수(LEARN-AHEAD-001 뒤) 위에서만 적용한다.
 IF app IS DISTINCT FROM '9bf0c8612988174843d69731a953390c' THEN RAISE EXCEPTION 'card_kinds: unreviewed fsrs_apply_operation (%)', app; END IF;
 IF shape = pg_temp.ck_old_shape() THEN
  RAISE NOTICE 'card_kinds: needs change';
 ELSIF shape = pg_temp.ck_new_shape() THEN
  RAISE NOTICE 'card_kinds: already applied — no-op';
 ELSE
  RAISE EXCEPTION 'card_kinds: unreviewed state (fsrs_cards shape %)', shape;
 END IF;
END $pre$;

-- ── 변경(옛 모양일 때만). 한 ALTER TABLE — 표 재작성 한 번에 두 열 계산 · 제약 검사. 그다음 FK 검사용 인덱스.
DO $change$
BEGIN
 IF pg_temp.ck_shape() = pg_temp.ck_old_shape() THEN
  ALTER TABLE public.fsrs_cards
   ADD COLUMN vocabulary_id uuid NOT NULL GENERATED ALWAYS AS (card_id) STORED,
   ADD COLUMN kind text NOT NULL DEFAULT 'recognition',
   ADD CONSTRAINT fsrs_cards_kind_check CHECK (kind IN ('recognition', 'production', 'listening')),
   ADD CONSTRAINT fsrs_cards_recognition_identity_check CHECK (kind <> 'recognition' OR vocabulary_id = card_id),
   ADD CONSTRAINT fsrs_cards_kind_stage1_check CHECK (kind = 'recognition'),
   ADD CONSTRAINT fsrs_cards_vocabulary_id_fkey FOREIGN KEY (vocabulary_id) REFERENCES public.user_vocabulary (id) ON DELETE RESTRICT,
   ADD CONSTRAINT fsrs_cards_user_id_vocabulary_id_kind_key UNIQUE (user_id, vocabulary_id, kind);
  CREATE INDEX fsrs_cards_vocabulary_id_idx ON public.fsrs_cards (vocabulary_id);
 END IF;
 -- 재게시: core · admission을 지금 계산한 값으로(바뀔 때만, 정확히 1행).
 UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash_live() WHERE contract_hash IS DISTINCT FROM fsrs_private.contract_hash_live();
 UPDATE fsrs_private.admission_settings SET contract_hash = fsrs_private.admission_contract_hash_live()
  WHERE contract_hash IS DISTINCT FROM fsrs_private.admission_contract_hash_live();
END $change$;

DO $post$
DECLARE b record; c jsonb := pg_temp.ck_contracts(); bad bigint; total bigint;
BEGIN
 SELECT * INTO STRICT b FROM pg_temp.ck_state_before;
 IF pg_temp.ck_shape() IS DISTINCT FROM pg_temp.ck_new_shape() THEN RAISE EXCEPTION 'card_kinds: post shape differs from the reviewed change %', pg_temp.ck_shape(); END IF;
 -- 행은 그대로(지우거나 고친 행 없음) · 모든 카드 = 단어 → 뜻 · 단어 id = 카드 id.
 SELECT pg_catalog.count(*), pg_catalog.count(*) FILTER (WHERE f.vocabulary_id IS DISTINCT FROM f.card_id OR f.kind IS DISTINCT FROM 'recognition')
  INTO total, bad FROM public.fsrs_cards f;
 IF total <> b.cards OR bad <> 0 THEN RAISE EXCEPTION 'card_kinds: rows changed (% → %, % not recognition = card)', b.cards, total, bad; END IF;
 IF pg_temp.ck_functions() IS DISTINCT FROM b.functions THEN RAISE EXCEPTION 'card_kinds: a learning function changed'; END IF;
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'card_kinds: contracts not consistent after repin %', c; END IF;
 IF c->'manual' IS DISTINCT FROM b.contracts->'manual' OR c->'profile' IS DISTINCT FROM b.contracts->'profile'
 THEN RAISE EXCEPTION 'card_kinds: manual or profile pin moved'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
END $post$;

-- ── 캐시 갱신을 지금 실행해 본다(커밋 때 할 일과 같은 함수 — 20261023170000). 이 뒤의 DDL은 임시 객체 DROP뿐이라 캐시를 무효로 만들지 않는다.
SET CONSTRAINTS fsrs_private.contract_cache_refresh IMMEDIATE;
SET CONSTRAINTS fsrs_private.contract_cache_refresh DEFERRED;

DO $cache$
DECLARE k record;
BEGIN
 SELECT * INTO STRICT k FROM fsrs_private.contract_cache;
 IF NOT k.valid THEN RAISE EXCEPTION 'card_kinds: refresh did not validate the contract cache'; END IF;
 IF (SELECT s.contract_hash FROM fsrs_private.settings s) IS DISTINCT FROM k.core
    OR (SELECT a.contract_hash FROM fsrs_private.admission_settings a) IS DISTINCT FROM k.admission
 THEN RAISE EXCEPTION 'card_kinds: cached core/admission differ from the pins'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
END $cache$;

-- ── 동작 무변경: 카드가 있는 사용자 전원의 단어장 출력(now 제외)과 카드 목록 출력이 바꾸기 전과 같다(캐시가 유효해 지문을 다시 계산하지 않는다).
DO $output$
DECLARE r record; n bigint := 0;
BEGIN
 FOR r IN SELECT o.actor, o.snapshot, o.states FROM pg_temp.ck_output_before o LOOP
  IF public.fsrs_vocabulary_snapshot(r.actor) - 'now' IS DISTINCT FROM r.snapshot OR public.fsrs_list_states(r.actor) IS DISTINCT FROM r.states
  THEN RAISE EXCEPTION 'card_kinds: learner output changed'; END IF;
  n := n + 1;
 END LOOP;
 IF n <> (SELECT s.actors FROM pg_temp.ck_state_before s) THEN RAISE EXCEPTION 'card_kinds: compared % of % learners', n, (SELECT s.actors FROM pg_temp.ck_state_before s); END IF;
 RAISE NOTICE 'card_kinds: % learners with cards — output unchanged', n;
END $output$;

DROP FUNCTION pg_temp.ck_new_shape(); DROP FUNCTION pg_temp.ck_old_shape(); DROP FUNCTION pg_temp.ck_shape(); DROP FUNCTION pg_temp.ck_functions();
DROP FUNCTION pg_temp.ck_md5(text); DROP FUNCTION pg_temp.ck_contracts();
DROP TABLE pg_temp.ck_output_before; DROP TABLE pg_temp.ck_state_before;
