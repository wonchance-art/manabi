-- CARD-TYPES-001 단계 2 복원 — 20261101120000_fsrs_card_kinds.sql을 되돌린다(단계 1 뒤 모양으로): 바꾼 함수 12개를 단계 1 뒤 원문(PGlite 재생 사슬의
--   pg_get_functiondef — 옛 md5 그대로)으로 · 새 함수 둘(card_kinds · variant_enrollment_open) · 새 열 둘(admission_policies.card_kinds ·
--   admission_settings.default_card_kinds)을 지우고 · fsrs_cards를 단계 1 모양으로(단계 1 전용 CHECK · 옛 card_id FK 되살리기 · vocabulary_id를 생성 열로).
-- 데이터: 잃는 정보가 없을 때만 — 사전 검사가 ① 종류 카드(kind <> 'recognition')가 없고 ② 모든 카드 vocabulary_id = card_id ③ 계정이 고른 종류가 없고
--   (card_kinds 전부 NULL) ④ 기본값이 단어 → 뜻 하나인지 확인한다. 하나라도 아니면 RAISE(종류 카드를 지우는 결정은 이 파일 밖 — 오너 결정).
--   카드 · 연산 · 영수증 · 정책(하루 새 단어 수 · 판본) 행은 그대로다.
-- vocabulary_id 생성 열: PostgreSQL은 보통 열을 생성 열로 바꾸지 못한다 → 열을 지우고 같은 이름 · 같은 식으로 다시 만든다(표 재작성 — 값은 card_id에서
--   다시 계산, 위 ② 덕분에 같은 값). 그 열에 걸린 단계 1 제약 넷(UNIQUE · FK · 단어 → 뜻 = 단어 id CHECK) · 인덱스도 같은 이름 · 같은 정의로 다시 만든다.
--   모양(열 · 제약 · 인덱스 · 트리거 정의 — 바이트 순 정렬)은 단계 1 뒤와 정확히 같다. 다만 열 번호(attnum)가 바뀌어 core · admission 지문 값은
--   단계 2 전 값과 다르다(재게시로 일치 — manual · profile은 그 전 값 그대로). 단계 1 복원(docs/sql/fsrs-cards-kind-rollback.sql)은 이 뒤에 그대로 돈다.
-- 이 파일은 마이그레이션이 아니다(docs/sql) — db push가 적용하지 않는다. 운영 적용은 오너 승인 후 SQL 편집기에서 본문 그대로.
-- 실행 형태: SQL 편집기 한 번 실행 = 암묵 트랜잭션 하나 → BEGIN/COMMIT 없음, SET LOCAL 실효를 첫 DO가 확인. 어느 검사든 RAISE하면 전부 롤백.
-- 사전 검사가 받는 상태: ① 단계 2 뒤(새 모양 · 새 md5) · 네 계약 일치 → 되돌림 ② 이미 단계 1 뒤(옛 모양 · 옛 md5 · 새 함수 없음) → no-op. 그 밖이면 RAISE.
-- 사후 검사: 옛 상태 · 행 수 그대로 · 바꾼 12개의 속성 · 손대지 않은 학습 함수 그대로 · 네 계약 동치 · profile 불변 · 캐시 갱신 ·
--   전원의 단어장 셋 · 입장 상태(cardKinds 제외) · 카드 목록(단계 2가 덧붙인 세 칸 제외) 출력 동일.
SET LOCAL search_path = '';
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '180s';

DO $runner$
BEGIN
 IF pg_catalog.current_setting('search_path') NOT IN ('', '""') OR pg_catalog.current_setting('lock_timeout') <> '5s'
    OR pg_catalog.current_setting('statement_timeout') <> '3min'
 THEN RAISE EXCEPTION 'card_kinds_stage2_rollback: SET LOCAL not in effect (search_path=%, lock_timeout=%, statement_timeout=%)',
   pg_catalog.current_setting('search_path'), pg_catalog.current_setting('lock_timeout'), pg_catalog.current_setting('statement_timeout');
 END IF;
END $runner$;

-- ── 공통 도구(pg_temp, 이 세션 전용 · 끝에서 DROP). 마이그레이션과 같은 정의 · 같은 두 상태 상수다(계약 테스트가 글자 그대로 비교).
CREATE FUNCTION pg_temp.ck2r_contracts() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object(
  'ok', s.contract_hash IS NOT DISTINCT FROM fsrs_private.contract_hash()
    AND m.contract_hash IS NOT DISTINCT FROM fsrs_private.manual_contract_hash()
    AND a.contract_hash IS NOT DISTINCT FROM fsrs_private.admission_contract_hash()
    AND t.profile_contract_hash IS NOT DISTINCT FROM fsrs_private.activity_profile_hash(),
  'core', s.contract_hash, 'manual', m.contract_hash, 'admission', a.contract_hash, 'profile', t.profile_contract_hash)
 FROM fsrs_private.settings s, fsrs_private.manual_save_settings m, fsrs_private.admission_settings a, fsrs_private.activity_settings t
$q$;
-- 이 파일이 만들거나 바꾸는 함수 14개(바꾸는 12 + 새 2)의 본문 md5(없으면 null).
CREATE FUNCTION pg_temp.ck2r_md5s() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_object_agg(g.sig, (SELECT pg_catalog.md5(p.prosrc) FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure(g.sig)))
 FROM pg_catalog.unnest(ARRAY['fsrs_private.admission_status(uuid,timestamp with time zone)', 'public.learning_configure_admission(uuid,jsonb)', 'public.fsrs_apply_operation(uuid,jsonb)', 'public.fsrs_apply_learning_operation(uuid,jsonb)', 'public.fsrs_read_state(uuid,uuid)', 'public.fsrs_list_states(uuid)', 'fsrs_private.vocabulary_registry_entry(uuid,uuid)', 'public.fsrs_vocabulary_snapshot(uuid)', 'public.fsrs_vocabulary_snapshot_cards(uuid,uuid[])', 'public.fsrs_vocabulary_snapshot_light(uuid,text,boolean)', 'public.fsrs_legacy_boundary(uuid,text,text)', 'public.learning_admit_legacy(uuid,jsonb)', 'fsrs_private.card_kinds(uuid)', 'fsrs_private.variant_enrollment_open(uuid,uuid,uuid,text,boolean,timestamp with time zone)']) g(sig)
$q$;
-- 바꾸는 12개의 본문 밖 속성(소유자 · 권한 · 정의자 · 설정 · 변동성 …) — CREATE OR REPLACE 앞뒤가 같아야 한다.
CREATE FUNCTION pg_temp.ck2r_attrs() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_object_agg(p.oid::pg_catalog.regprocedure::text, pg_catalog.jsonb_build_array(p.proowner, p.prosecdef, p.proconfig,
   p.provolatile, p.proparallel, p.proleakproof, p.proisstrict, p.prolang, p.prorettype, p.proretset, p.proacl::text, p.pronargdefaults,
   pg_catalog.pg_get_function_arguments(p.oid)))
 FROM pg_catalog.pg_proc p WHERE p.oid = ANY (ARRAY['fsrs_private.admission_status(uuid,timestamp with time zone)', 'public.learning_configure_admission(uuid,jsonb)', 'public.fsrs_apply_operation(uuid,jsonb)', 'public.fsrs_apply_learning_operation(uuid,jsonb)', 'public.fsrs_read_state(uuid,uuid)', 'public.fsrs_list_states(uuid)', 'fsrs_private.vocabulary_registry_entry(uuid,uuid)', 'public.fsrs_vocabulary_snapshot(uuid)', 'public.fsrs_vocabulary_snapshot_cards(uuid,uuid[])', 'public.fsrs_vocabulary_snapshot_light(uuid,text,boolean)', 'public.fsrs_legacy_boundary(uuid,text,text)', 'public.learning_admit_legacy(uuid,jsonb)']::pg_catalog.regprocedure[])
$q$;
-- 손대지 않는 학습 함수 전부(fsrs_private · public fsrs_% · learning_% 에서 위 14개를 뺀 것)의 본문 md5 + 속성.
CREATE FUNCTION pg_temp.ck2r_others() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_object_agg(p.oid::pg_catalog.regprocedure::text, pg_catalog.jsonb_build_array(pg_catalog.md5(p.prosrc), p.proowner,
   p.prosecdef, p.proconfig, p.provolatile, p.proparallel, p.proleakproof, p.proisstrict, p.prolang, p.prorettype, p.proretset, p.proacl::text))
 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
 WHERE (n.nspname = 'fsrs_private' OR (n.nspname = 'public' AND (p.proname LIKE 'fsrs\_%' ESCAPE '\' OR p.proname LIKE 'learning\_%' ESCAPE '\')))
  AND p.oid::pg_catalog.regprocedure::text <> ALL (ARRAY['fsrs_private.admission_status(uuid,timestamp with time zone)', 'public.learning_configure_admission(uuid,jsonb)', 'public.fsrs_apply_operation(uuid,jsonb)', 'public.fsrs_apply_learning_operation(uuid,jsonb)', 'public.fsrs_read_state(uuid,uuid)', 'public.fsrs_list_states(uuid)', 'fsrs_private.vocabulary_registry_entry(uuid,uuid)', 'public.fsrs_vocabulary_snapshot(uuid)', 'public.fsrs_vocabulary_snapshot_cards(uuid,uuid[])', 'public.fsrs_vocabulary_snapshot_light(uuid,text,boolean)', 'public.fsrs_legacy_boundary(uuid,text,text)', 'public.learning_admit_legacy(uuid,jsonb)', 'fsrs_private.card_kinds(uuid)', 'fsrs_private.variant_enrollment_open(uuid,uuid,uuid,text,boolean,timestamp with time zone)'])
$q$;
-- 표 모양: 열(이름 · 형 · NOT NULL · 생성식/기본값) · 제약(NOT NULL 행 제외 — 버전마다 다르다) · 인덱스 · 사용자 트리거. 정렬은 바이트 순(단계 1과 같은 식).
CREATE FUNCTION pg_temp.ck2r_shape(p_table pg_catalog.regclass) RETURNS text[] LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.array_agg(x ORDER BY x COLLATE "C") FROM (
  SELECT pg_catalog.format('column %s %s%s%s', a.attname, pg_catalog.format_type(a.atttypid, a.atttypmod),
    CASE WHEN a.attnotnull THEN ' not null' ELSE '' END,
    CASE WHEN a.attgenerated = 's' THEN ' generated stored ' || pg_catalog.pg_get_expr(d.adbin, d.adrelid)
         WHEN d.adbin IS NOT NULL THEN ' default ' || pg_catalog.pg_get_expr(d.adbin, d.adrelid) ELSE '' END) AS x
  FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE a.attrelid = p_table AND a.attnum > 0 AND NOT a.attisdropped
  UNION ALL SELECT 'constraint ' || c.conname || ' ' || pg_catalog.pg_get_constraintdef(c.oid) FROM pg_catalog.pg_constraint c
  WHERE c.conrelid = p_table AND c.contype <> 'n'
  UNION ALL SELECT 'index ' || pg_catalog.pg_get_indexdef(i.indexrelid) FROM pg_catalog.pg_index i WHERE i.indrelid = p_table
  UNION ALL SELECT 'trigger ' || pg_catalog.pg_get_triggerdef(t.oid) FROM pg_catalog.pg_trigger t
  WHERE t.tgrelid = p_table AND NOT t.tgisinternal) q
$q$;
CREATE FUNCTION pg_temp.ck2r_state() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object('cards', pg_catalog.to_jsonb(pg_temp.ck2r_shape('public.fsrs_cards')),
  'policies', pg_catalog.to_jsonb(pg_temp.ck2r_shape('fsrs_private.admission_policies')),
  'settings', pg_catalog.to_jsonb(pg_temp.ck2r_shape('fsrs_private.admission_settings')), 'functions', pg_temp.ck2r_md5s())
$q$;
-- 검토한 두 상태(이 파일 전 = 단계 1 뒤 운영 · 이 파일 뒤). 함수 md5 = 단계 1 뒤 PGlite 재생 사슬(운영 fsrs_apply_operation 9bf0c861…와 같은 사슬)의 본문.
CREATE FUNCTION pg_temp.ck2r_old_state() RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $q$
 SELECT '{"cards": ["column attempt jsonb", "column card jsonb not null", "column card_id uuid not null", "column enrolled_at timestamp with time zone not null default clock_timestamp()", "column kind text not null default ''recognition''::text", "column user_id uuid not null", "column vocabulary_id uuid not null generated stored card_id", "constraint fsrs_cards_card_check CHECK (fsrs_private.valid_card(card))", "constraint fsrs_cards_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.user_vocabulary(id) ON DELETE RESTRICT", "constraint fsrs_cards_kind_check CHECK ((kind = ANY (ARRAY[''recognition''::text, ''production''::text, ''listening''::text])))", "constraint fsrs_cards_kind_stage1_check CHECK ((kind = ''recognition''::text))", "constraint fsrs_cards_pkey PRIMARY KEY (card_id)", "constraint fsrs_cards_recognition_identity_check CHECK (((kind <> ''recognition''::text) OR (vocabulary_id = card_id)))", "constraint fsrs_cards_user_id_card_id_key UNIQUE (user_id, card_id)", "constraint fsrs_cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT", "constraint fsrs_cards_user_id_vocabulary_id_kind_key UNIQUE (user_id, vocabulary_id, kind)", "constraint fsrs_cards_vocabulary_id_fkey FOREIGN KEY (vocabulary_id) REFERENCES public.user_vocabulary(id) ON DELETE RESTRICT", "index CREATE INDEX fsrs_cards_vocabulary_id_idx ON public.fsrs_cards USING btree (vocabulary_id)", "index CREATE UNIQUE INDEX fsrs_cards_pkey ON public.fsrs_cards USING btree (card_id)", "index CREATE UNIQUE INDEX fsrs_cards_user_id_card_id_key ON public.fsrs_cards USING btree (user_id, card_id)", "index CREATE UNIQUE INDEX fsrs_cards_user_id_vocabulary_id_kind_key ON public.fsrs_cards USING btree (user_id, vocabulary_id, kind)", "trigger CREATE TRIGGER learning_guard_enrollment BEFORE INSERT ON public.fsrs_cards FOR EACH ROW EXECUTE FUNCTION fsrs_private.guard_learning_enrollment()"], "functions": {"fsrs_private.admission_status(uuid,timestamp with time zone)": "fc34a8acb06246ddbaf6ec7ffd0df5d4", "fsrs_private.card_kinds(uuid)": null, "fsrs_private.variant_enrollment_open(uuid,uuid,uuid,text,boolean,timestamp with time zone)": null, "fsrs_private.vocabulary_registry_entry(uuid,uuid)": "771d6c4f3ecc170b6ae0eb685771ce4e", "public.fsrs_apply_learning_operation(uuid,jsonb)": "b30fcf098af0fb53e71b67b5529ae569", "public.fsrs_apply_operation(uuid,jsonb)": "9bf0c8612988174843d69731a953390c", "public.fsrs_legacy_boundary(uuid,text,text)": "3e907c04af571ac9f4c9554a277bed48", "public.fsrs_list_states(uuid)": "988a10d4324bc2b9fafc08322f4a3a2d", "public.fsrs_read_state(uuid,uuid)": "413224503b1a27dfc537b73ca7b2779e", "public.fsrs_vocabulary_snapshot(uuid)": "90cb5fb52d43d00eeb4b5c5a41ba8b19", "public.fsrs_vocabulary_snapshot_cards(uuid,uuid[])": "40cea98a04cf45be087f024b6b4aea67", "public.fsrs_vocabulary_snapshot_light(uuid,text,boolean)": "3093ad73ed356efd792114f5aab27985", "public.learning_admit_legacy(uuid,jsonb)": "65e769b7f890cd88f04dc53ae0616c8c", "public.learning_configure_admission(uuid,jsonb)": "e49594d272b7336ab1a0047bcb0136ca"}, "policies": ["column daily_new_limit integer not null default 15", "column revision bigint not null default 0", "column user_id uuid not null", "constraint admission_policies_daily_new_limit_check CHECK ((((daily_new_limit >= 0) AND (daily_new_limit <= 999)) OR (daily_new_limit = 9999)))", "constraint admission_policies_pkey PRIMARY KEY (user_id)", "constraint admission_policies_revision_check CHECK (((revision >= 0) AND (revision < ''9007199254740991''::bigint)))", "constraint admission_policies_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE", "index CREATE UNIQUE INDEX admission_policies_pkey ON fsrs_private.admission_policies USING btree (user_id)"], "settings": ["column contract_hash text", "column enabled boolean not null default false", "column singleton boolean not null default true", "column starts_at timestamp with time zone", "constraint admission_settings_check CHECK (((NOT enabled) OR (starts_at IS NOT NULL)))", "constraint admission_settings_pkey PRIMARY KEY (singleton)", "constraint admission_settings_singleton_check CHECK (singleton)", "index CREATE UNIQUE INDEX admission_settings_pkey ON fsrs_private.admission_settings USING btree (singleton)"]}'::jsonb
$q$;
CREATE FUNCTION pg_temp.ck2r_new_state() RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $q$
 SELECT '{"cards": ["column attempt jsonb", "column card jsonb not null", "column card_id uuid not null", "column enrolled_at timestamp with time zone not null default clock_timestamp()", "column kind text not null default ''recognition''::text", "column user_id uuid not null", "column vocabulary_id uuid not null", "constraint fsrs_cards_card_check CHECK (fsrs_private.valid_card(card))", "constraint fsrs_cards_kind_check CHECK ((kind = ANY (ARRAY[''recognition''::text, ''production''::text, ''listening''::text])))", "constraint fsrs_cards_pkey PRIMARY KEY (card_id)", "constraint fsrs_cards_recognition_identity_check CHECK (((kind <> ''recognition''::text) OR (vocabulary_id = card_id)))", "constraint fsrs_cards_user_id_card_id_key UNIQUE (user_id, card_id)", "constraint fsrs_cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT", "constraint fsrs_cards_user_id_vocabulary_id_kind_key UNIQUE (user_id, vocabulary_id, kind)", "constraint fsrs_cards_vocabulary_id_fkey FOREIGN KEY (vocabulary_id) REFERENCES public.user_vocabulary(id) ON DELETE RESTRICT", "index CREATE INDEX fsrs_cards_vocabulary_id_idx ON public.fsrs_cards USING btree (vocabulary_id)", "index CREATE UNIQUE INDEX fsrs_cards_pkey ON public.fsrs_cards USING btree (card_id)", "index CREATE UNIQUE INDEX fsrs_cards_user_id_card_id_key ON public.fsrs_cards USING btree (user_id, card_id)", "index CREATE UNIQUE INDEX fsrs_cards_user_id_vocabulary_id_kind_key ON public.fsrs_cards USING btree (user_id, vocabulary_id, kind)", "trigger CREATE TRIGGER learning_guard_enrollment BEFORE INSERT ON public.fsrs_cards FOR EACH ROW EXECUTE FUNCTION fsrs_private.guard_learning_enrollment()"], "functions": {"fsrs_private.admission_status(uuid,timestamp with time zone)": "20f1ca38a4c7bcd5d45344b7325cf5a0", "fsrs_private.card_kinds(uuid)": "277fe504e9fd1de2aabf0cbad9c40b14", "fsrs_private.variant_enrollment_open(uuid,uuid,uuid,text,boolean,timestamp with time zone)": "791c633fb91a9d7c61f34da96fe6fef2", "fsrs_private.vocabulary_registry_entry(uuid,uuid)": "965f8d73cad6f2c38c939fb56fbc36b7", "public.fsrs_apply_learning_operation(uuid,jsonb)": "c2f2e2e187263ef39a531541a941c60a", "public.fsrs_apply_operation(uuid,jsonb)": "58997c6ff7c3a20ed32a47a4ab3da50f", "public.fsrs_legacy_boundary(uuid,text,text)": "c84cf97ea0e8ea3b3bd7819778dd5cdd", "public.fsrs_list_states(uuid)": "8eb21a27465c303e872e7ff1c9bdaea5", "public.fsrs_read_state(uuid,uuid)": "8f961a9e2e47bf027601b1b21188c9df", "public.fsrs_vocabulary_snapshot(uuid)": "32647a452dc4c8a8c5449ab6a93c4eb9", "public.fsrs_vocabulary_snapshot_cards(uuid,uuid[])": "d33e1c2c65571c80bc4109fc0c5f0dae", "public.fsrs_vocabulary_snapshot_light(uuid,text,boolean)": "32401c0c1e32163215c7edbbf692c7ba", "public.learning_admit_legacy(uuid,jsonb)": "bcb673e08e0726d36d4392c0ca8c8b99", "public.learning_configure_admission(uuid,jsonb)": "88ef7531f27fdcaf67daa6262608bee9"}, "policies": ["column card_kinds text[]", "column daily_new_limit integer not null default 15", "column revision bigint not null default 0", "column user_id uuid not null", "constraint admission_policies_card_kinds_check CHECK (((card_kinds IS NULL) OR (card_kinds = ''{recognition}''::text[]) OR (card_kinds = ''{recognition,production}''::text[]) OR (card_kinds = ''{recognition,listening}''::text[]) OR (card_kinds = ''{recognition,production,listening}''::text[])))", "constraint admission_policies_daily_new_limit_check CHECK ((((daily_new_limit >= 0) AND (daily_new_limit <= 999)) OR (daily_new_limit = 9999)))", "constraint admission_policies_pkey PRIMARY KEY (user_id)", "constraint admission_policies_revision_check CHECK (((revision >= 0) AND (revision < ''9007199254740991''::bigint)))", "constraint admission_policies_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE", "index CREATE UNIQUE INDEX admission_policies_pkey ON fsrs_private.admission_policies USING btree (user_id)"], "settings": ["column contract_hash text", "column default_card_kinds text[] not null default ''{recognition}''::text[]", "column enabled boolean not null default false", "column singleton boolean not null default true", "column starts_at timestamp with time zone", "constraint admission_settings_check CHECK (((NOT enabled) OR (starts_at IS NOT NULL)))", "constraint admission_settings_default_card_kinds_check CHECK (((default_card_kinds = ''{recognition}''::text[]) OR (default_card_kinds = ''{recognition,production}''::text[]) OR (default_card_kinds = ''{recognition,listening}''::text[]) OR (default_card_kinds = ''{recognition,production,listening}''::text[])))", "constraint admission_settings_pkey PRIMARY KEY (singleton)", "constraint admission_settings_singleton_check CHECK (singleton)", "index CREATE UNIQUE INDEX admission_settings_pkey ON fsrs_private.admission_settings USING btree (singleton)"]}'::jsonb
$q$;

CREATE TEMP TABLE ck2r_output_before ON COMMIT DROP AS
 SELECT u.user_id AS actor, at_time,
  public.fsrs_vocabulary_snapshot(u.user_id) - 'now' AS snapshot,
  CASE WHEN ids IS NOT NULL THEN public.fsrs_vocabulary_snapshot_cards(u.user_id, ids) - 'now' END AS snapshot_cards,
  public.fsrs_vocabulary_snapshot_light(u.user_id, NULL, true) - 'now' AS light_summary,
  public.fsrs_vocabulary_snapshot_light(u.user_id, NULL, false) - 'now' AS light_rows,
  public.fsrs_list_states(u.user_id) AS states, fsrs_private.admission_status(u.user_id, at_time) AS admission
 FROM (SELECT f.user_id FROM public.fsrs_cards f UNION SELECT v.user_id FROM public.user_vocabulary v) u
 CROSS JOIN LATERAL (SELECT pg_catalog.date_trunc('milliseconds', pg_catalog.statement_timestamp()) AS at_time,
  (SELECT pg_catalog.array_agg(w.id ORDER BY w.id) FROM (SELECT v.id FROM public.user_vocabulary v WHERE v.user_id = u.user_id ORDER BY v.id LIMIT 50) w) AS ids) k
 WHERE EXISTS (SELECT 1 FROM auth.users a WHERE a.id = u.user_id);
-- registry 동일성 계약(PERF-SNAPSHOT P4 — src/lib/__tests__/registrySnapshotParity.test.js): 이 파일은 registry 한 칸의 두 정의(vocabulary_registry_entry ·
-- snapshot 집합 계산)를 다시 정의한다 → 바꾸기 전 전 사용자 snapshot 출력을 같은 문장으로 담고, 끝에서 출력 · 모든 카드의 두 정의가 같은지 본다.
CREATE TEMP TABLE perf_snapshot_before ON COMMIT DROP AS
 SELECT u.user_id AS actor, public.fsrs_vocabulary_snapshot(u.user_id) - 'now' AS body
 FROM (SELECT DISTINCT v.user_id FROM public.user_vocabulary v WHERE EXISTS (SELECT 1 FROM auth.users a WHERE a.id = v.user_id)) u;
CREATE TEMP TABLE ck2r_state_before ON COMMIT DROP AS
 SELECT pg_temp.ck2r_contracts() AS contracts, pg_temp.ck2r_attrs() AS attrs, pg_temp.ck2r_others() AS others,
  (SELECT pg_catalog.count(*) FROM public.fsrs_cards) AS cards, (SELECT pg_catalog.count(*) FROM pg_temp.ck2r_output_before) AS actors;

DO $pre$
DECLARE c jsonb := pg_temp.ck2r_contracts(); st jsonb := pg_temp.ck2r_state(); variants bigint; mismatched bigint;
BEGIN
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'card_kinds_stage2_rollback: learning contracts already drifted %', c; END IF;
 PERFORM fsrs_private.require_admission_integrity();
 IF st = pg_temp.ck2r_new_state() THEN
  SELECT pg_catalog.count(*) FILTER (WHERE f.kind <> 'recognition'), pg_catalog.count(*) FILTER (WHERE f.vocabulary_id IS DISTINCT FROM f.card_id)
   INTO variants, mismatched FROM public.fsrs_cards f;
  IF variants <> 0 OR mismatched <> 0 THEN
   RAISE EXCEPTION 'card_kinds_stage2_rollback: % production/listening cards (% rows with vocabulary_id <> card_id) — refusing to drop data', variants, mismatched;
  END IF;
  IF EXISTS (SELECT 1 FROM fsrs_private.admission_policies p WHERE p.card_kinds IS NOT NULL)
     OR (SELECT s.default_card_kinds FROM fsrs_private.admission_settings s) IS DISTINCT FROM '{recognition}'::text[]
  THEN RAISE EXCEPTION 'card_kinds_stage2_rollback: card kinds were chosen (account or default) — refusing to drop them'; END IF;
  RAISE NOTICE 'card_kinds_stage2_rollback: needs change';
 ELSIF st = pg_temp.ck2r_old_state() THEN
  RAISE NOTICE 'card_kinds_stage2_rollback: already rolled back — no-op';
 ELSE
  RAISE EXCEPTION 'card_kinds_stage2_rollback: unreviewed state %', st;
 END IF;
END $pre$;

-- ── 함수 12개를 단계 1 뒤 원문으로(CREATE OR REPLACE — 소유자 · 권한 · 속성 그대로). 옛 본문은 새 함수 · 새 열을 부르지 않는다.
-- fsrs_private.admission_status(uuid,timestamp with time zone): 본문 md5 20f1ca38a4c7bcd5d45344b7325cf5a0 → fc34a8acb06246ddbaf6ec7ffd0df5d4(단계 1 뒤 원문)
CREATE OR REPLACE FUNCTION fsrs_private.admission_status(p_actor uuid, p_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s fsrs_private.admission_settings%rowtype; lim integer; rev bigint; f_count bigint; l_count bigint;
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor) THEN RAISE EXCEPTION 'invalid_learning_actor' USING ERRCODE='42501'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
 SELECT * INTO STRICT s FROM fsrs_private.admission_settings;
 SELECT p.daily_new_limit,p.revision INTO lim,rev FROM fsrs_private.admission_policies p WHERE p.user_id=p_actor;
 lim:=coalesce(lim,15);rev:=coalesce(rev,0);
 WITH receipts AS (
  SELECT card_id,question_at AS first_at,'fsrs' AS cohort FROM public.fsrs_new_receipts WHERE user_id=p_actor
  UNION ALL SELECT card_id,first_question_at,'legacy' FROM fsrs_private.legacy_admissions WHERE user_id=p_actor AND consumed
 ), firsts AS (SELECT DISTINCT ON(card_id) card_id,first_at,cohort FROM receipts ORDER BY card_id,first_at,cohort)
 SELECT count(*) FILTER(WHERE cohort='fsrs'),count(*) FILTER(WHERE cohort='legacy') INTO f_count,l_count FROM firsts WHERE fsrs_private.admission_day(first_at)=fsrs_private.admission_day(p_at);
 RETURN jsonb_build_object('version',1,'actorId',p_actor,'installed',true,'enabled',s.enabled,'active',s.enabled AND s.starts_at IS NOT NULL AND p_at>=s.starts_at,
  'fsrsEnabled',(SELECT enabled FROM fsrs_private.settings),'startsAt',fsrs_private.iso_milliseconds(s.starts_at),'now',fsrs_private.iso_milliseconds(p_at),
  'learningDay',fsrs_private.admission_day(p_at)::text,'timeZone','Asia/Seoul','rolloverHour',4,'limit',lim,'policyRevision',rev,
  'used',f_count+l_count,'remaining',greatest(0,lim-f_count-l_count),'fsrsUsed',f_count,'legacyUsed',l_count,
  'admittedLegacyCardIds',coalesce((SELECT jsonb_agg(card_id ORDER BY card_id) FROM fsrs_private.legacy_admissions WHERE user_id=p_actor),'[]'::jsonb));
END $function$;

-- public.learning_configure_admission(uuid,jsonb): 본문 md5 88ef7531f27fdcaf67daa6262608bee9 → e49594d272b7336ab1a0047bcb0136ca(단계 1 뒤 원문)
CREATE OR REPLACE FUNCTION public.learning_configure_admission(p_actor uuid, p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r jsonb:=p_request; prev fsrs_private.admission_config_receipts%rowtype; current_policy fsrs_private.admission_policies%rowtype; expected bigint; at_time timestamptz;
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor) OR jsonb_typeof(r) IS DISTINCT FROM 'object' OR pg_column_size(r)>4096
  OR (SELECT count(*) FROM jsonb_object_keys(r))<>5 OR NOT r ?& ARRAY['action','accountId','operationId','expectedPolicyRevision','dailyNewLimit']
  OR r->>'action' IS DISTINCT FROM 'configure' OR r->>'accountId' IS DISTINCT FROM p_actor::text
  OR jsonb_typeof(r->'operationId') IS DISTINCT FROM 'string' OR r->>'operationId' !~ '^[A-Za-z0-9_.:-]{1,200}$'
  OR jsonb_typeof(r->'expectedPolicyRevision') IS DISTINCT FROM 'number' OR r->>'expectedPolicyRevision' !~ '^[0-9]+$' OR (r->>'expectedPolicyRevision')::numeric>=9007199254740991
  OR r->'dailyNewLimit' NOT IN(SELECT pg_catalog.to_jsonb(g) FROM pg_catalog.generate_series(0,999) g UNION ALL SELECT '9999'::jsonb)
 THEN RAISE EXCEPTION 'invalid_learning_request' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,731));PERFORM fsrs_private.require_admission_integrity();
 SELECT * INTO prev FROM fsrs_private.admission_config_receipts WHERE user_id=p_actor AND operation_id=r->>'operationId';
 IF prev.operation_id IS NOT NULL THEN
  IF prev.request IS DISTINCT FROM r THEN RAISE EXCEPTION 'learning_operation_replay_mismatch' USING ERRCODE='23505'; END IF;
 ELSE
  SELECT * INTO current_policy FROM fsrs_private.admission_policies WHERE user_id=p_actor FOR UPDATE;
  expected:=(r->>'expectedPolicyRevision')::bigint;
  IF expected<>coalesce(current_policy.revision,0) THEN RAISE EXCEPTION 'learning_policy_conflict' USING ERRCODE='40001'; END IF;
  IF expected>=9007199254740990 THEN RAISE EXCEPTION 'learning_policy_revision_exhausted' USING ERRCODE='55000'; END IF;
  INSERT INTO fsrs_private.admission_policies(user_id,daily_new_limit,revision) VALUES(p_actor,(r->>'dailyNewLimit')::integer,expected+1)
   ON CONFLICT(user_id) DO UPDATE SET daily_new_limit=excluded.daily_new_limit,revision=excluded.revision;
  INSERT INTO fsrs_private.admission_config_receipts(user_id,operation_id,request,received_at) VALUES(p_actor,r->>'operationId',r,date_trunc('milliseconds',clock_timestamp()));
 END IF;
 RETURN jsonb_build_object('version',1,'actorId',p_actor,'operationId',r->>'operationId','duplicate',prev.operation_id IS NOT NULL,'quota',fsrs_private.admission_status(p_actor,date_trunc('milliseconds',clock_timestamp())));
END $function$;

-- public.fsrs_apply_operation(uuid,jsonb): 본문 md5 58997c6ff7c3a20ed32a47a4ab3da50f → 9bf0c8612988174843d69731a953390c(단계 1 뒤 원문)
CREATE OR REPLACE FUNCTION public.fsrs_apply_operation(p_actor uuid, p_operation jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE op jsonb:=p_operation; s fsrs_private.settings%rowtype; v public.user_vocabulary%rowtype;
 f public.fsrs_cards%rowtype; prior public.fsrs_operations%rowtype; target public.fsrs_operations%rowtype;
 cid uuid; oid text; kind text; expected bigint; c jsonb; a jsonb; result jsonb; at_time timestamptz; day_key date; exact_previous jsonb; event jsonb; target_event jsonb;
BEGIN
 IF p_actor IS NULL OR jsonb_typeof(op) IS DISTINCT FROM 'object' OR pg_column_size(op)>32768
  OR op->'version' IS DISTINCT FROM '1'::jsonb OR op->>'userId' IS DISTINCT FROM p_actor::text
  OR jsonb_typeof(op->'id') IS DISTINCT FROM 'string' OR length(op->>'id') NOT BETWEEN 1 AND 200
  OR jsonb_typeof(op->'cardId') IS DISTINCT FROM 'string' OR op->>'kind' NOT IN ('enroll','question','reveal','abandon','grade','undo') OR op->>'kind' IS NULL
  OR jsonb_typeof(op->'expectedRevision') IS DISTINCT FROM 'number' OR op->>'expectedRevision' !~ '^[0-9]+$'
  OR (op->>'expectedRevision')::numeric>=9007199254740991 THEN RAISE EXCEPTION 'invalid_fsrs_operation' USING ERRCODE='22023'; END IF;
 cid:=(op->>'cardId')::uuid; oid:=op->>'id'; kind:=op->>'kind'; expected:=(op->>'expectedRevision')::bigint;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,731));
 SELECT * INTO s FROM fsrs_private.settings FOR SHARE;
 IF NOT s.enabled OR s.contract_hash IS DISTINCT FROM fsrs_private.contract_hash() THEN RAISE EXCEPTION 'fsrs_storage_disabled' USING ERRCODE='55000'; END IF;
 SELECT * INTO v FROM public.user_vocabulary WHERE id=cid AND user_id=p_actor FOR UPDATE;
 IF v.id IS NULL THEN RAISE EXCEPTION 'word_not_available' USING ERRCODE='42501'; END IF;
 SELECT * INTO prior FROM public.fsrs_operations WHERE user_id=p_actor AND id=oid;
 IF prior.id IS NOT NULL THEN
  IF prior.operation IS DISTINCT FROM op THEN RAISE EXCEPTION 'fsrs_operation_replay_mismatch' USING ERRCODE='23505'; END IF;
  RETURN prior.result||jsonb_build_object('duplicate',true);
 END IF;
 IF fsrs_private.blocked(p_actor,cid) THEN RAISE EXCEPTION 'vocabulary_excluded' USING ERRCODE='55000'; END IF;
 SELECT * INTO f FROM public.fsrs_cards WHERE card_id=cid AND user_id=p_actor FOR UPDATE;
 IF kind='enroll' THEN
  c:=op->'nextCard';
  IF f.card_id IS NOT NULL OR expected<>0 OR NOT fsrs_private.valid_card(c) OR c->>'state'<>'New' OR c->>'revision'<>'0'
   OR v.created_at IS NULL OR v.created_at<s.activated_at OR v.created_at>clock_timestamp()
   OR v.repetitions IS DISTINCT FROM 0 OR v.interval IS DISTINCT FROM 0 OR v.last_reviewed_at IS NOT NULL
   OR EXISTS(SELECT 1 FROM public.review_events e WHERE e.user_id=p_actor AND (e.detail->>'word_id'=cid::text
    OR (e.source='vocab' AND e.lang=v.language AND normalize(btrim(e.item_key),NFC) IN (normalize(btrim(v.word_text),NFC),normalize(btrim(v.base_form),NFC)))))
   OR (c->>'introducedAt')::timestamptz<v.created_at OR (c->>'introducedAt')::timestamptz>clock_timestamp()+interval '5 seconds'
   OR (c->>'due')::timestamptz<>(c->>'introducedAt')::timestamptz+(CASE c->>'policyVersion' WHEN 'anki-v2' THEN interval '60 seconds' ELSE interval '30 seconds' END)
  THEN RAISE EXCEPTION 'fsrs_enrollment_not_available' USING ERRCODE='55000'; END IF;
  INSERT INTO public.fsrs_cards(card_id,user_id,card) VALUES(cid,p_actor,c) RETURNING * INTO f;
 ELSE
  IF f.card_id IS NULL THEN RAISE EXCEPTION 'fsrs_card_not_enrolled' USING ERRCODE='55000'; END IF;
  IF (f.card->>'revision')::bigint<>expected THEN RAISE EXCEPTION 'review_revision_conflict' USING ERRCODE='40001'; END IF;
  IF kind IN ('question','reveal','abandon') THEN
   a:=op->'nextAttempt';
   IF jsonb_typeof(a) IS DISTINCT FROM 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(a))<>(CASE WHEN kind='abandon' THEN 10 ELSE 9 END)
    OR NOT a ?& ARRAY['id','userId','cardId','card','phase','eligible','questionAt','revealedAt','hintedAt']
    OR jsonb_typeof(a->'id') IS DISTINCT FROM 'string' OR length(a->>'id') NOT BETWEEN 1 AND 200
    OR a->>'userId' IS DISTINCT FROM p_actor::text OR a->>'cardId' IS DISTINCT FROM cid::text OR a->'card' IS DISTINCT FROM f.card
    OR jsonb_typeof(a->'eligible') IS DISTINCT FROM 'boolean' OR jsonb_typeof(a->'questionAt') IS DISTINCT FROM 'string'
    OR a->>'questionAt' !~ 'T.*(Z|[+-][0-9]{2}:[0-9]{2})$'
   THEN RAISE EXCEPTION 'invalid_fsrs_attempt' USING ERRCODE='22023'; END IF;
   at_time:=(a->>'questionAt')::timestamptz;
   IF NOT isfinite(at_time) OR at_time<(f.card->>'due')::timestamptz-(CASE WHEN f.card->>'state' IN ('Learning','Relearning') THEN interval '20 minutes' ELSE interval '0 seconds' END) OR at_time>clock_timestamp()+interval '5 seconds'
    THEN RAISE EXCEPTION 'fsrs_card_not_due' USING ERRCODE='55000'; END IF;
   -- LEARN-AHEAD-001: learning/relearning cards may be asked up to 20 minutes before due; Review/New cards keep the exact due.
   -- The undo (+30s) and abandon (+30s) waits of next_question_at stay strict: same three bounds with only the due moved earlier.
   IF kind='question' THEN
    IF at_time<fsrs_private.next_question_at(p_actor,cid) AND (f.card->>'state' NOT IN ('Learning','Relearning')
     OR at_time<greatest((f.card->>'due')::timestamptz-interval '20 minutes',
      (SELECT max((o.operation#>>'{log,reviewedAt}')::timestamptz)+interval '30 seconds' FROM public.fsrs_operations o WHERE o.user_id=p_actor AND o.card_id=cid AND o.kind='undo'),
      CASE WHEN f.attempt->>'phase'='abandoned' THEN greatest((f.attempt->>'questionAt')::timestamptz,(f.attempt->>'revealedAt')::timestamptz)+interval '30 seconds' END)) THEN RAISE EXCEPTION 'fsrs_card_not_due' USING ERRCODE='55000'; END IF;
    IF a->>'phase' IS DISTINCT FROM 'question' OR a->'revealedAt' IS DISTINCT FROM 'null'::jsonb OR a->'hintedAt' IS DISTINCT FROM 'null'::jsonb
     OR (f.attempt IS NOT NULL AND f.attempt->>'phase' IN ('question','revealed'))
     OR (f.attempt->>'phase'='abandoned' AND at_time<greatest((f.attempt->>'questionAt')::timestamptz,(f.attempt->>'revealedAt')::timestamptz)+interval '30 seconds')
     THEN RAISE EXCEPTION 'invalid_attempt_phase' USING ERRCODE='55000'; END IF;
    IF op ? 'dailyNewLimit' THEN
     IF op->'dailyNewLimit' NOT IN (SELECT pg_catalog.to_jsonb(g) FROM pg_catalog.generate_series(0,999) g UNION ALL SELECT '9999'::jsonb) THEN RAISE EXCEPTION 'invalid_fsrs_daily_limit' USING ERRCODE='22023'; END IF;
     s.daily_new_limit:=(op->>'dailyNewLimit')::integer;
    END IF;
    IF f.card->>'state'='New' AND NOT EXISTS(SELECT 1 FROM public.fsrs_new_receipts WHERE card_id=cid) THEN
     day_key:=((at_time AT TIME ZONE (f.card->>'timeZone'))-make_interval(hours=>(f.card->>'rolloverHour')::integer))::date;
     IF (SELECT count(*) FROM public.fsrs_new_receipts WHERE user_id=p_actor AND learning_day=day_key)>=s.daily_new_limit
      THEN RAISE EXCEPTION 'fsrs_daily_new_limit' USING ERRCODE='55000'; END IF;
     INSERT INTO public.fsrs_new_receipts(card_id,user_id,operation_id,learning_day,question_at) VALUES(cid,p_actor,oid,day_key,at_time);
    END IF;
   ELSIF kind='abandon' THEN
    IF f.attempt IS NULL OR f.attempt->>'phase' NOT IN ('question','revealed') OR a->>'phase' IS DISTINCT FROM 'abandoned'
     OR (a-ARRAY['phase','abandonedAt']) IS DISTINCT FROM (f.attempt-'phase')
     OR jsonb_typeof(a->'abandonedAt') IS DISTINCT FROM 'string' OR a->>'abandonedAt' !~ 'T.*(Z|[+-][0-9]{2}:[0-9]{2})$'
     OR (a->>'abandonedAt')::timestamptz<greatest((f.attempt->>'questionAt')::timestamptz,(f.attempt->>'revealedAt')::timestamptz)
     OR (a->>'abandonedAt')::timestamptz>clock_timestamp()+interval '5 seconds'
     THEN RAISE EXCEPTION 'invalid_attempt_phase' USING ERRCODE='55000'; END IF;
   ELSE
    IF f.attempt IS NULL OR f.attempt->>'phase'<>'question' OR a->>'phase' IS DISTINCT FROM 'revealed'
     OR (a-ARRAY['phase','eligible','revealedAt','hintedAt']) IS DISTINCT FROM (f.attempt-ARRAY['phase','eligible','revealedAt','hintedAt'])
     OR (a->>'eligible')::boolean AND NOT (f.attempt->>'eligible')::boolean
     OR jsonb_typeof(a->'revealedAt') IS DISTINCT FROM 'string' OR a->>'revealedAt' !~ 'T.*(Z|[+-][0-9]{2}:[0-9]{2})$'
     OR (a->>'revealedAt')::timestamptz<at_time OR (a->>'revealedAt')::timestamptz>clock_timestamp()+interval '5 seconds'
     OR (a->'hintedAt'<>'null'::jsonb AND ((a->>'eligible')::boolean OR a->'hintedAt' IS DISTINCT FROM a->'revealedAt'))
     THEN RAISE EXCEPTION 'invalid_attempt_phase' USING ERRCODE='55000'; END IF;
   END IF;
   UPDATE public.fsrs_cards SET attempt=a WHERE card_id=cid RETURNING * INTO f;
  ELSE
   c:=op->'nextCard';
   IF op->'previousCard' IS DISTINCT FROM f.card OR NOT fsrs_private.valid_card(c) OR (c->>'revision')::bigint<>expected+1
    OR c->'introducedAt' IS DISTINCT FROM f.card->'introducedAt' OR c->'timeZone' IS DISTINCT FROM f.card->'timeZone'
    OR c->'rolloverHour' IS DISTINCT FROM f.card->'rolloverHour' THEN RAISE EXCEPTION 'invalid_fsrs_transition' USING ERRCODE='22023'; END IF;
   IF kind='grade' THEN
    IF f.attempt IS NULL OR f.attempt->>'phase'<>'revealed' OR f.attempt->'eligible' IS DISTINCT FROM 'true'::jsonb
     OR f.attempt->'hintedAt' IS DISTINCT FROM 'null'::jsonb OR op->>'attemptId' IS DISTINCT FROM f.attempt->>'id'
     OR f.attempt->'card' IS DISTINCT FROM f.card OR op#>'{log,questionAt}' IS DISTINCT FROM f.attempt->'questionAt'
     OR op#>'{log,revealedAt}' IS DISTINCT FROM f.attempt->'revealedAt'
     OR op#>'{log,optimizerEligible}' IS DISTINCT FROM 'true'::jsonb OR op#>'{log,rewardEligible}' IS DISTINCT FROM 'true'::jsonb
     OR op#>'{log,rating}' NOT IN ('1'::jsonb,'2'::jsonb,'3'::jsonb,'4'::jsonb) OR op#>'{log,rating}' IS NULL
     OR op#>'{log,reviewedAt}' IS DISTINCT FROM c->'lastReview'
     OR (c->>'lastReview')::timestamptz IS DISTINCT FROM (f.attempt->>'revealedAt')::timestamptz OR (c->>'lastReview')::timestamptz>clock_timestamp()+interval '5 seconds'
     OR (c->>'reps')::bigint<>(f.card->>'reps')::bigint+1
     OR op#>'{log,applied,revision}' IS DISTINCT FROM c->'revision' OR op#>'{log,applied,due}' IS DISTINCT FROM c->'due'
     OR op#>'{log,applied,state}' IS DISTINCT FROM c->'state' OR op#>'{log,applied,step}' IS DISTINCT FROM c->'step'
     THEN RAISE EXCEPTION 'invalid_fsrs_grade' USING ERRCODE='22023'; END IF;
   ELSE
    SELECT * INTO target FROM public.fsrs_operations o WHERE o.user_id=p_actor AND o.card_id=cid AND o.id=op->>'undoneOperationId' AND o.kind='grade';
    exact_previous:=jsonb_set(target.operation->'previousCard','{revision}',to_jsonb(expected+1));
    IF (f.attempt IS NOT NULL AND f.attempt->>'phase' IN ('question','revealed')) OR target.id IS NULL OR target.operation->'nextCard' IS DISTINCT FROM f.card OR c IS DISTINCT FROM exact_previous
     OR op#>'{log,optimizerEligible}' IS DISTINCT FROM 'false'::jsonb OR op#>'{log,rewardEligible}' IS DISTINCT FROM 'false'::jsonb
     OR op#>>'{log,reviewedAt}' IS NULL OR (op#>>'{log,reviewedAt}')::timestamptz<(target.operation#>>'{log,reviewedAt}')::timestamptz
     OR (op#>>'{log,reviewedAt}')::timestamptz>clock_timestamp()+interval '5 seconds'
     THEN RAISE EXCEPTION 'invalid_fsrs_undo' USING ERRCODE='22023'; END IF;
   END IF;
   IF kind='grade' THEN
    event:=jsonb_build_object('user_id',p_actor,'lang',v.language,'source','vocab','item_key',v.word_text,'correct',(op#>>'{log,rating}')::integer>1,
     'detail',jsonb_build_object('word_id',cid,'meaning',v.meaning,'rating',op#>'{log,rating}','mode','flash','qtype','flash',
      'fsrs_operation_id',oid,'fsrs_version',1,'optimizerEligible',true,'rewardEligible',true),'created_at',(op#>>'{log,reviewedAt}')::timestamptz);
   ELSE
    SELECT to_jsonb(e) INTO STRICT target_event FROM public.review_events e WHERE e.user_id=p_actor AND e.source='vocab' AND e.detail->>'fsrs_operation_id'=target.id
     AND e.detail->>'word_id'=cid::text AND e.created_at=(target.operation#>>'{log,reviewedAt}')::timestamptz;
    event:=jsonb_build_object('user_id',p_actor,'lang',target_event->>'lang','source','ui','item_key',target_event->>'item_key','correct',true,
     'detail',jsonb_build_object('qtype','undo','fsrs_operation_id',oid,'undo_of',jsonb_build_object('item_key',target_event->>'item_key',
      'rating',target_event#>'{detail,rating}','reviewed_at',target.operation#>'{log,reviewedAt}')),'created_at',(op#>>'{log,reviewedAt}')::timestamptz);
   END IF;
   INSERT INTO fsrs_private.event_permits(transaction_id,event) VALUES(txid_current(),event);
   -- The trusted actor is already authenticated by the server. Existing Korean guards require auth.uid().
   PERFORM set_config('request.jwt.claim.sub',p_actor::text,true);
   INSERT INTO public.review_events(user_id,lang,source,item_key,correct,detail,created_at)
    VALUES(p_actor,event->>'lang',event->>'source',event->>'item_key',(event->>'correct')::boolean,event->'detail',(event->>'created_at')::timestamptz);
   IF EXISTS(SELECT 1 FROM fsrs_private.event_permits WHERE transaction_id=txid_current()) THEN RAISE EXCEPTION 'fsrs_event_guard_not_installed'; END IF;
   UPDATE public.fsrs_cards SET card=c,attempt=NULL WHERE card_id=cid RETURNING * INTO f;
  END IF;
 END IF;
 result:=jsonb_build_object('cardId',cid,'userId',p_actor,'card',f.card,'attempt',f.attempt,'operationId',oid,'duplicate',false,'enrolled',true,'nextQuestionAt',CASE WHEN kind='undo' THEN greatest((c->>'due')::timestamptz,(op#>>'{log,reviewedAt}')::timestamptz+interval '30 seconds') ELSE fsrs_private.next_question_at(p_actor,cid) END,'excluded',false,'firstQuestionAt',(SELECT question_at FROM public.fsrs_new_receipts WHERE card_id=cid));
 INSERT INTO public.fsrs_operations(user_id,id,card_id,kind,operation,result) VALUES(p_actor,oid,cid,kind,op,result);
 RETURN result;
END $function$;

-- public.fsrs_apply_learning_operation(uuid,jsonb): 본문 md5 c2f2e2e187263ef39a531541a941c60a → b30fcf098af0fb53e71b67b5529ae569(단계 1 뒤 원문)
CREATE OR REPLACE FUNCTION public.fsrs_apply_learning_operation(p_actor uuid, p_operation jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE op jsonb:=p_operation; quota jsonb; result jsonb; prior public.fsrs_operations%rowtype; cid uuid; has_first boolean; expected bigint;
BEGIN
 IF p_actor IS NULL OR jsonb_typeof(op) IS DISTINCT FROM 'object' OR op->>'userId' IS DISTINCT FROM p_actor::text THEN RAISE EXCEPTION 'invalid_learning_request' USING ERRCODE='22023'; END IF;
 cid:=(op->>'cardId')::uuid;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,731));PERFORM fsrs_private.require_admission_integrity();
 SELECT * INTO prior FROM public.fsrs_operations WHERE user_id=p_actor AND id=op->>'id';
 IF prior.id IS NOT NULL THEN
  IF prior.operation IS DISTINCT FROM op THEN RAISE EXCEPTION 'fsrs_operation_replay_mismatch' USING ERRCODE='23505'; END IF;
  RETURN public.fsrs_apply_operation(p_actor,op)||jsonb_build_object('quota',fsrs_private.admission_status(p_actor,date_trunc('milliseconds',clock_timestamp())));
 END IF;
 IF op->>'kind'='question' THEN
  quota:=fsrs_private.admission_status(p_actor,date_trunc('milliseconds',clock_timestamp()));
  IF jsonb_typeof(op#>'{request,expectedPolicyRevision}') IS DISTINCT FROM 'number' OR op#>>'{request,expectedPolicyRevision}' !~ '^[0-9]+$'
   OR (op#>>'{request,expectedPolicyRevision}')::numeric>=9007199254740991 OR (op#>>'{request,expectedPolicyRevision}')::bigint<>(quota->>'policyRevision')::bigint
   OR op->'dailyNewLimit' IS DISTINCT FROM quota->'limit' THEN RAISE EXCEPTION 'learning_policy_conflict' USING ERRCODE='40001'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.fsrs_new_receipts WHERE user_id=p_actor AND card_id=cid) INTO has_first;
  IF NOT has_first AND (SELECT card->>'state'='New' FROM public.fsrs_cards WHERE user_id=p_actor AND card_id=cid) THEN
   IF quota->'active' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'learning_admission_inactive' USING ERRCODE='55000'; END IF;
   IF (quota->>'remaining')::integer<=0 THEN RAISE EXCEPTION 'learning_daily_new_limit' USING ERRCODE='55000'; END IF;
   INSERT INTO fsrs_private.admission_permits(transaction_id,user_id,card_id,operation_id,question_at,daily_new_limit,policy_revision)
    VALUES(txid_current(),p_actor,cid,op->>'id',(op#>>'{nextAttempt,questionAt}')::timestamptz,(quota->>'limit')::integer,(quota->>'policyRevision')::bigint);
  END IF;
 END IF;
 result:=public.fsrs_apply_operation(p_actor,op);
 IF EXISTS(SELECT 1 FROM fsrs_private.admission_permits WHERE transaction_id=txid_current()) THEN RAISE EXCEPTION 'learning_admission_guard_missing' USING ERRCODE='55000'; END IF;
 RETURN result||jsonb_build_object('quota',fsrs_private.admission_status(p_actor,date_trunc('milliseconds',clock_timestamp())));
END $function$;

-- public.fsrs_read_state(uuid,uuid): 본문 md5 8f961a9e2e47bf027601b1b21188c9df → 413224503b1a27dfc537b73ca7b2779e(단계 1 뒤 원문)
CREATE OR REPLACE FUNCTION public.fsrs_read_state(p_actor uuid, p_card_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v public.user_vocabulary%rowtype; f public.fsrs_cards%rowtype;
BEGIN
 IF p_actor IS NULL THEN RAISE EXCEPTION 'invalid_fsrs_actor' USING ERRCODE='42501'; END IF;
 SELECT * INTO v FROM public.user_vocabulary WHERE id=p_card_id AND user_id=p_actor;
 IF v.id IS NULL THEN RAISE EXCEPTION 'word_not_available' USING ERRCODE='42501'; END IF;
 SELECT * INTO f FROM public.fsrs_cards WHERE card_id=p_card_id AND user_id=p_actor;
 RETURN jsonb_build_object('cardId',v.id,'userId',p_actor,'card',f.card,'attempt',f.attempt,'excluded',fsrs_private.blocked(p_actor,p_card_id),
  'enrolled',f.card_id IS NOT NULL,'nextQuestionAt',fsrs_private.next_question_at(p_actor,p_card_id),'firstQuestionAt',(SELECT question_at FROM public.fsrs_new_receipts WHERE card_id=p_card_id),'operations',coalesce((SELECT jsonb_agg(x.operation ORDER BY x.received_at) FROM
   (SELECT operation,received_at FROM public.fsrs_operations WHERE user_id=p_actor AND card_id=p_card_id ORDER BY received_at DESC LIMIT 100) x),'[]'::jsonb));
END $function$;

-- public.fsrs_list_states(uuid): 본문 md5 8eb21a27465c303e872e7ff1c9bdaea5 → 988a10d4324bc2b9fafc08322f4a3a2d(단계 1 뒤 원문)
CREATE OR REPLACE FUNCTION public.fsrs_list_states(p_actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF p_actor IS NULL THEN RAISE EXCEPTION 'invalid_fsrs_actor' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('cardId',f.card_id,'userId',f.user_id,'card',f.card,'attempt',f.attempt,
  'enrolled',true,'nextQuestionAt',fsrs_private.next_question_at(p_actor,f.card_id),'firstQuestionAt',(SELECT question_at FROM public.fsrs_new_receipts r WHERE r.card_id=f.card_id),'excluded',fsrs_private.blocked(p_actor,f.card_id)) ORDER BY f.card_id) FROM public.fsrs_cards f WHERE f.user_id=p_actor),'[]'::jsonb);
END $function$;

-- fsrs_private.vocabulary_registry_entry(uuid,uuid): 본문 md5 965f8d73cad6f2c38c939fb56fbc36b7 → 771d6c4f3ecc170b6ae0eb685771ce4e(단계 1 뒤 원문)
CREATE OR REPLACE FUNCTION fsrs_private.vocabulary_registry_entry(p_actor uuid, p_card_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v public.user_vocabulary%rowtype; f public.fsrs_cards%rowtype; is_known boolean; is_excluded boolean; wake_at timestamptz;
BEGIN
 SELECT * INTO v FROM public.user_vocabulary WHERE id=p_card_id AND user_id=p_actor;
 IF v.id IS NULL THEN RAISE EXCEPTION 'fsrs_vocabulary_not_available' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.fsrs_cards WHERE card_id=p_card_id AND user_id<>p_actor) THEN RAISE EXCEPTION 'fsrs_snapshot_inconsistent' USING ERRCODE='55000'; END IF;
 SELECT * INTO f FROM public.fsrs_cards WHERE card_id=p_card_id AND user_id=p_actor;
 SELECT EXISTS(SELECT 1 FROM public.user_known_words k WHERE k.user_id=p_actor
  AND k.lang=CASE v.language WHEN 'Korean' THEN 'ko' WHEN 'Japanese' THEN 'ja' WHEN 'Chinese' THEN 'zh' WHEN 'English' THEN 'en' WHEN 'French' THEN 'fr' END
  AND normalize(btrim(k.word_text),NFC) IN (normalize(btrim(v.word_text),NFC),normalize(btrim(v.base_form),NFC))) INTO is_known;
 is_excluded:=fsrs_private.blocked(p_actor,p_card_id);
 wake_at:=fsrs_private.next_question_at(p_actor,p_card_id);
 IF wake_at>date_trunc('milliseconds',wake_at) THEN wake_at:=date_trunc('milliseconds',wake_at)+interval '1 millisecond'; END IF;
 RETURN jsonb_build_object('cardId',v.id,'userId',p_actor,'enrolled',f.card_id IS NOT NULL,'card',f.card,
  'known',is_known,'excluded',is_excluded,'eligible',NOT is_known AND NOT is_excluded,
  'nextQuestionAt',CASE WHEN f.card_id IS NOT NULL THEN fsrs_private.iso_milliseconds(wake_at) END,
  'firstQuestionAt',CASE WHEN f.card_id IS NOT NULL THEN (SELECT fsrs_private.iso_milliseconds(question_at) FROM public.fsrs_new_receipts WHERE card_id=p_card_id AND user_id=p_actor) END);
END $function$;

-- public.fsrs_vocabulary_snapshot(uuid): 본문 md5 32647a452dc4c8a8c5449ab6a93c4eb9 → 90cb5fb52d43d00eeb4b5c5a41ba8b19(단계 1 뒤 원문)
CREATE OR REPLACE FUNCTION public.fsrs_vocabulary_snapshot(p_actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s fsrs_private.settings%rowtype; result jsonb;
BEGIN
 PERFORM fsrs_private.require_admission_integrity();
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor) THEN RAISE EXCEPTION 'invalid_fsrs_actor' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.fsrs_cards f LEFT JOIN public.user_vocabulary v ON v.id=f.card_id WHERE f.user_id=p_actor AND (v.id IS NULL OR v.user_id IS DISTINCT FROM p_actor)) THEN RAISE EXCEPTION 'fsrs_snapshot_inconsistent' USING ERRCODE='55000'; END IF;
 SELECT * INTO STRICT s FROM fsrs_private.settings;
 -- PERF-SNAPSHOT P4: registry flags as one set operation (hash joins) instead of fsrs_private.vocabulary_registry_entry per row.
 -- Same values: known = any known word of this actor whose (lang, NFC(btrim)) equals the row's NFC(btrim(word_text)) or NFC(btrim(base_form));
 -- excluded = fsrs_private.blocked(actor, card) = known OR an exclusion of this actor by card id, by retired card id, or by
 -- (language, NFC(btrim(coalesce(nullif(base_form,''),word_text)))). registry_entry's per-card guard is the set check above.
 IF EXISTS(SELECT 1 FROM public.fsrs_cards f JOIN public.user_vocabulary v ON v.id=f.card_id WHERE v.user_id=p_actor AND f.user_id<>p_actor)
 THEN RAISE EXCEPTION 'fsrs_snapshot_inconsistent' USING ERRCODE='55000'; END IF;
 WITH kw AS (SELECT DISTINCT k.lang, normalize(btrim(k.word_text),NFC) AS w FROM public.user_known_words k WHERE k.user_id=p_actor),
 exid AS (SELECT e.vocabulary_id AS id FROM public.vocabulary_exclusions e WHERE e.user_id=p_actor AND e.vocabulary_id IS NOT NULL
   UNION SELECT r.id FROM public.vocabulary_exclusions e CROSS JOIN LATERAL unnest(e.retired_vocabulary_ids) AS r(id) WHERE e.user_id=p_actor AND r.id IS NOT NULL),
 exw AS (SELECT DISTINCT e.language, e.word_text FROM public.vocabulary_exclusions e WHERE e.user_id=p_actor),
 x AS (
  SELECT v AS vrow, v.id, f.card_id AS fid, f.card,
   (k1.w IS NOT NULL OR k2.w IS NOT NULL) AS is_known,
   (exid.id IS NOT NULL OR exw.language IS NOT NULL) AS is_excluded_only,
   CASE WHEN f.card_id IS NOT NULL THEN fsrs_private.next_question_at(p_actor,v.id) END AS wake_at
  FROM public.user_vocabulary v
  LEFT JOIN public.fsrs_cards f ON f.card_id=v.id AND f.user_id=p_actor
  LEFT JOIN kw k1 ON k1.lang=CASE v.language WHEN 'Korean' THEN 'ko' WHEN 'Japanese' THEN 'ja' WHEN 'Chinese' THEN 'zh' WHEN 'English' THEN 'en' WHEN 'French' THEN 'fr' END AND k1.w=normalize(btrim(v.word_text),NFC)
  LEFT JOIN kw k2 ON k2.lang=CASE v.language WHEN 'Korean' THEN 'ko' WHEN 'Japanese' THEN 'ja' WHEN 'Chinese' THEN 'zh' WHEN 'English' THEN 'en' WHEN 'French' THEN 'fr' END AND k2.w=normalize(btrim(v.base_form),NFC)
  LEFT JOIN exid ON exid.id=v.id
  LEFT JOIN exw ON exw.language=v.language AND exw.word_text=normalize(btrim(coalesce(nullif(v.base_form,''),v.word_text)),NFC)
  WHERE v.user_id=p_actor)
 SELECT jsonb_build_object('version',1,'learningAdmissionVersion',1,'actorId',p_actor,'enabled',s.enabled,'registryAvailable',true,'complete',true,
  'now',fsrs_private.iso_milliseconds(statement_timestamp()),
  'rows',coalesce(jsonb_agg(to_jsonb(x.vrow) ORDER BY x.id),'[]'::jsonb),
  'registry',coalesce(jsonb_agg(jsonb_build_object('cardId',x.id,'userId',p_actor,'enrolled',x.fid IS NOT NULL,'card',x.card,
    'known',x.is_known,'excluded',x.is_known OR x.is_excluded_only,'eligible',NOT x.is_known AND NOT (x.is_known OR x.is_excluded_only),
    'nextQuestionAt',CASE WHEN x.fid IS NOT NULL THEN fsrs_private.iso_milliseconds(CASE WHEN x.wake_at>date_trunc('milliseconds',x.wake_at)
      THEN date_trunc('milliseconds',x.wake_at)+interval '1 millisecond' ELSE x.wake_at END) END,
    'firstQuestionAt',CASE WHEN x.fid IS NOT NULL THEN (SELECT fsrs_private.iso_milliseconds(r.question_at) FROM public.fsrs_new_receipts r WHERE r.card_id=x.id AND r.user_id=p_actor) END)
   ORDER BY x.id),'[]'::jsonb))
 INTO result FROM x;
 RETURN result;
END $function$;

-- public.fsrs_vocabulary_snapshot_cards(uuid,uuid[]): 본문 md5 d33e1c2c65571c80bc4109fc0c5f0dae → 40cea98a04cf45be087f024b6b4aea67(단계 1 뒤 원문)
CREATE OR REPLACE FUNCTION public.fsrs_vocabulary_snapshot_cards(p_actor uuid, p_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s fsrs_private.settings%rowtype; result jsonb;
BEGIN
 IF (CASE WHEN p_ids IS NULL OR array_ndims(p_ids) IS DISTINCT FROM 1 OR cardinality(p_ids) NOT BETWEEN 1 AND 50 THEN true ELSE array_position(p_ids, NULL) IS NOT NULL END)
 THEN RAISE EXCEPTION 'invalid_fsrs_request' USING ERRCODE='22023'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor) THEN RAISE EXCEPTION 'invalid_fsrs_actor' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.fsrs_cards f LEFT JOIN public.user_vocabulary v ON v.id=f.card_id WHERE f.user_id=p_actor AND (v.id IS NULL OR v.user_id IS DISTINCT FROM p_actor)) THEN RAISE EXCEPTION 'fsrs_snapshot_inconsistent' USING ERRCODE='55000'; END IF;
 SELECT * INTO STRICT s FROM fsrs_private.settings;
 -- SNAPSHOT-CARDS-001: the account checks above and the WITH below are fsrs_vocabulary_snapshot's, byte for byte (P4 set flags);
 -- only the p_ids request check and the id filter on x differ. The account checks stay actor-wide (not narrowed to p_ids).
 IF EXISTS(SELECT 1 FROM public.fsrs_cards f JOIN public.user_vocabulary v ON v.id=f.card_id WHERE v.user_id=p_actor AND f.user_id<>p_actor)
 THEN RAISE EXCEPTION 'fsrs_snapshot_inconsistent' USING ERRCODE='55000'; END IF;
 WITH kw AS (SELECT DISTINCT k.lang, normalize(btrim(k.word_text),NFC) AS w FROM public.user_known_words k WHERE k.user_id=p_actor),
 exid AS (SELECT e.vocabulary_id AS id FROM public.vocabulary_exclusions e WHERE e.user_id=p_actor AND e.vocabulary_id IS NOT NULL
   UNION SELECT r.id FROM public.vocabulary_exclusions e CROSS JOIN LATERAL unnest(e.retired_vocabulary_ids) AS r(id) WHERE e.user_id=p_actor AND r.id IS NOT NULL),
 exw AS (SELECT DISTINCT e.language, e.word_text FROM public.vocabulary_exclusions e WHERE e.user_id=p_actor),
 x AS (
  SELECT v AS vrow, v.id, f.card_id AS fid, f.card,
   (k1.w IS NOT NULL OR k2.w IS NOT NULL) AS is_known,
   (exid.id IS NOT NULL OR exw.language IS NOT NULL) AS is_excluded_only,
   CASE WHEN f.card_id IS NOT NULL THEN fsrs_private.next_question_at(p_actor,v.id) END AS wake_at
  FROM public.user_vocabulary v
  LEFT JOIN public.fsrs_cards f ON f.card_id=v.id AND f.user_id=p_actor
  LEFT JOIN kw k1 ON k1.lang=CASE v.language WHEN 'Korean' THEN 'ko' WHEN 'Japanese' THEN 'ja' WHEN 'Chinese' THEN 'zh' WHEN 'English' THEN 'en' WHEN 'French' THEN 'fr' END AND k1.w=normalize(btrim(v.word_text),NFC)
  LEFT JOIN kw k2 ON k2.lang=CASE v.language WHEN 'Korean' THEN 'ko' WHEN 'Japanese' THEN 'ja' WHEN 'Chinese' THEN 'zh' WHEN 'English' THEN 'en' WHEN 'French' THEN 'fr' END AND k2.w=normalize(btrim(v.base_form),NFC)
  LEFT JOIN exid ON exid.id=v.id
  LEFT JOIN exw ON exw.language=v.language AND exw.word_text=normalize(btrim(coalesce(nullif(v.base_form,''),v.word_text)),NFC)
  WHERE v.user_id=p_actor AND v.id=ANY(p_ids))
 SELECT jsonb_build_object('version',1,'learningAdmissionVersion',1,'actorId',p_actor,'enabled',s.enabled,'registryAvailable',true,'complete',true,
  'now',fsrs_private.iso_milliseconds(statement_timestamp()),
  'rows',coalesce(jsonb_agg(to_jsonb(x.vrow) ORDER BY x.id),'[]'::jsonb),
  'registry',coalesce(jsonb_agg(jsonb_build_object('cardId',x.id,'userId',p_actor,'enrolled',x.fid IS NOT NULL,'card',x.card,
    'known',x.is_known,'excluded',x.is_known OR x.is_excluded_only,'eligible',NOT x.is_known AND NOT (x.is_known OR x.is_excluded_only),
    'nextQuestionAt',CASE WHEN x.fid IS NOT NULL THEN fsrs_private.iso_milliseconds(CASE WHEN x.wake_at>date_trunc('milliseconds',x.wake_at)
      THEN date_trunc('milliseconds',x.wake_at)+interval '1 millisecond' ELSE x.wake_at END) END,
    'firstQuestionAt',CASE WHEN x.fid IS NOT NULL THEN (SELECT fsrs_private.iso_milliseconds(r.question_at) FROM public.fsrs_new_receipts r WHERE r.card_id=x.id AND r.user_id=p_actor) END)
   ORDER BY x.id),'[]'::jsonb))
 INTO result FROM x;
 RETURN result;
END $function$;

-- public.fsrs_vocabulary_snapshot_light(uuid,text,boolean): 본문 md5 32401c0c1e32163215c7edbbf692c7ba → 3093ad73ed356efd792114f5aab27985(단계 1 뒤 원문)
CREATE OR REPLACE FUNCTION public.fsrs_vocabulary_snapshot_light(p_actor uuid, p_language text, p_summary boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s fsrs_private.settings%rowtype; result jsonb;
BEGIN
 IF p_summary IS NULL THEN RAISE EXCEPTION 'invalid_fsrs_request' USING ERRCODE='22023'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor) THEN RAISE EXCEPTION 'invalid_fsrs_actor' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.fsrs_cards f LEFT JOIN public.user_vocabulary v ON v.id=f.card_id WHERE f.user_id=p_actor AND (v.id IS NULL OR v.user_id IS DISTINCT FROM p_actor)) THEN RAISE EXCEPTION 'fsrs_snapshot_inconsistent' USING ERRCODE='55000'; END IF;
 SELECT * INTO STRICT s FROM fsrs_private.settings;
 -- SNAPSHOT-LIGHT-001: the account checks above and the WITH below are fsrs_vocabulary_snapshot's, byte for byte (P4 set flags);
 -- only the language filter on x, the summary row shape and the omission of default registry entries differ.
 IF EXISTS(SELECT 1 FROM public.fsrs_cards f JOIN public.user_vocabulary v ON v.id=f.card_id WHERE v.user_id=p_actor AND f.user_id<>p_actor)
 THEN RAISE EXCEPTION 'fsrs_snapshot_inconsistent' USING ERRCODE='55000'; END IF;
 WITH kw AS (SELECT DISTINCT k.lang, normalize(btrim(k.word_text),NFC) AS w FROM public.user_known_words k WHERE k.user_id=p_actor),
 exid AS (SELECT e.vocabulary_id AS id FROM public.vocabulary_exclusions e WHERE e.user_id=p_actor AND e.vocabulary_id IS NOT NULL
   UNION SELECT r.id FROM public.vocabulary_exclusions e CROSS JOIN LATERAL unnest(e.retired_vocabulary_ids) AS r(id) WHERE e.user_id=p_actor AND r.id IS NOT NULL),
 exw AS (SELECT DISTINCT e.language, e.word_text FROM public.vocabulary_exclusions e WHERE e.user_id=p_actor),
 x AS (
  SELECT v AS vrow, v.id, f.card_id AS fid, f.card,
   (k1.w IS NOT NULL OR k2.w IS NOT NULL) AS is_known,
   (exid.id IS NOT NULL OR exw.language IS NOT NULL) AS is_excluded_only,
   CASE WHEN f.card_id IS NOT NULL THEN fsrs_private.next_question_at(p_actor,v.id) END AS wake_at
  FROM public.user_vocabulary v
  LEFT JOIN public.fsrs_cards f ON f.card_id=v.id AND f.user_id=p_actor
  LEFT JOIN kw k1 ON k1.lang=CASE v.language WHEN 'Korean' THEN 'ko' WHEN 'Japanese' THEN 'ja' WHEN 'Chinese' THEN 'zh' WHEN 'English' THEN 'en' WHEN 'French' THEN 'fr' END AND k1.w=normalize(btrim(v.word_text),NFC)
  LEFT JOIN kw k2 ON k2.lang=CASE v.language WHEN 'Korean' THEN 'ko' WHEN 'Japanese' THEN 'ja' WHEN 'Chinese' THEN 'zh' WHEN 'English' THEN 'en' WHEN 'French' THEN 'fr' END AND k2.w=normalize(btrim(v.base_form),NFC)
  LEFT JOIN exid ON exid.id=v.id
  LEFT JOIN exw ON exw.language=v.language AND exw.word_text=normalize(btrim(coalesce(nullif(v.base_form,''),v.word_text)),NFC)
  WHERE v.user_id=p_actor AND (p_language IS NULL OR v.language=p_language))
 SELECT jsonb_build_object('version',1,'learningAdmissionVersion',1,'actorId',p_actor,'enabled',s.enabled,'registryAvailable',true,'complete',true,
  'now',fsrs_private.iso_milliseconds(statement_timestamp()),
  'light',jsonb_build_object('version',1,'language',p_language,'summary',p_summary,'registry','sparse','columns',CASE WHEN p_summary THEN
    '["id","word_text","base_form","meaning","language","created_at","interval","ease_factor","repetitions","last_reviewed_at","next_review_at","source_material_id","source_ref"]'::jsonb END),
  'rows',coalesce(jsonb_agg(CASE WHEN p_summary THEN jsonb_build_array((x.vrow).id,(x.vrow).word_text,(x.vrow).base_form,(x.vrow).meaning,(x.vrow).language,
    (x.vrow).created_at,(x.vrow).interval,(x.vrow).ease_factor,(x.vrow).repetitions,(x.vrow).last_reviewed_at,(x.vrow).next_review_at,
    (x.vrow).source_material_id,(x.vrow).source_ref) ELSE to_jsonb(x.vrow) END ORDER BY x.id),'[]'::jsonb),
  'registry',coalesce(jsonb_agg(jsonb_build_object('cardId',x.id,'userId',p_actor,'enrolled',x.fid IS NOT NULL,'card',x.card,
    'known',x.is_known,'excluded',x.is_known OR x.is_excluded_only,'eligible',NOT x.is_known AND NOT (x.is_known OR x.is_excluded_only),
    'nextQuestionAt',CASE WHEN x.fid IS NOT NULL THEN fsrs_private.iso_milliseconds(CASE WHEN x.wake_at>date_trunc('milliseconds',x.wake_at)
      THEN date_trunc('milliseconds',x.wake_at)+interval '1 millisecond' ELSE x.wake_at END) END,
    'firstQuestionAt',CASE WHEN x.fid IS NOT NULL THEN (SELECT fsrs_private.iso_milliseconds(r.question_at) FROM public.fsrs_new_receipts r WHERE r.card_id=x.id AND r.user_id=p_actor) END)
   ORDER BY x.id) FILTER (WHERE x.fid IS NOT NULL OR x.is_known OR x.is_excluded_only),'[]'::jsonb))
 INTO result FROM x;
 RETURN result;
END $function$;

-- public.fsrs_legacy_boundary(uuid,text,text): 본문 md5 c84cf97ea0e8ea3b3bd7819778dd5cdd → 3e907c04af571ac9f4c9554a277bed48(단계 1 뒤 원문)
CREATE OR REPLACE FUNCTION public.fsrs_legacy_boundary(p_card_id uuid DEFAULT NULL::uuid, p_item_key text DEFAULT NULL::text, p_language text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE actor uuid:=auth.uid(); enrolled boolean;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'login_required' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM fsrs_private.settings s WHERE s.contract_hash IS NOT NULL AND s.contract_hash IS DISTINCT FROM fsrs_private.contract_hash()) THEN RAISE EXCEPTION 'fsrs_contract_not_ready' USING ERRCODE='55000'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.fsrs_cards f JOIN public.user_vocabulary v ON v.id=f.card_id WHERE f.user_id=actor
  AND (f.card_id=p_card_id OR (p_language=v.language AND normalize(btrim(p_item_key),NFC) IN
   (normalize(btrim(v.word_text),NFC),normalize(btrim(v.base_form),NFC))))) INTO enrolled;
 RETURN jsonb_build_object('version',1,'actorId',actor,'enrolled',enrolled);
END $function$;

-- public.learning_admit_legacy(uuid,jsonb): 본문 md5 bcb673e08e0726d36d4392c0ca8c8b99 → 65e769b7f890cd88f04dc53ae0616c8c(단계 1 뒤 원문)
CREATE OR REPLACE FUNCTION public.learning_admit_legacy(p_actor uuid, p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r jsonb:=p_request; cid uuid; v public.user_vocabulary%rowtype; prev fsrs_private.admission_requests%rowtype; first fsrs_private.legacy_admissions%rowtype; quota jsonb; at_time timestamptz; consumed_slot boolean:=false; is_duplicate boolean:=false;
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor) OR jsonb_typeof(r) IS DISTINCT FROM 'object' OR pg_column_size(r)>4096
  OR (SELECT count(*) FROM jsonb_object_keys(r))<>5 OR NOT r ?& ARRAY['action','accountId','operationId','cardId','expectedPolicyRevision']
  OR r->>'action' IS DISTINCT FROM 'admit' OR r->>'accountId' IS DISTINCT FROM p_actor::text
  OR jsonb_typeof(r->'operationId') IS DISTINCT FROM 'string' OR r->>'operationId' !~ '^[A-Za-z0-9_.:-]{1,200}$'
  OR jsonb_typeof(r->'cardId') IS DISTINCT FROM 'string'
  OR jsonb_typeof(r->'expectedPolicyRevision') IS DISTINCT FROM 'number' OR r->>'expectedPolicyRevision' !~ '^[0-9]+$' OR (r->>'expectedPolicyRevision')::numeric>=9007199254740991
 THEN RAISE EXCEPTION 'invalid_learning_request' USING ERRCODE='22023'; END IF;
 cid:=(r->>'cardId')::uuid;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,731));PERFORM fsrs_private.require_admission_integrity();
 SELECT * INTO v FROM public.user_vocabulary WHERE user_id=p_actor AND id=cid FOR UPDATE;
 IF v.id IS NULL THEN RAISE EXCEPTION 'learning_word_not_available' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.fsrs_cards WHERE card_id=cid) THEN RAISE EXCEPTION 'learning_card_enrolled' USING ERRCODE='55000'; END IF;
 IF fsrs_private.blocked(p_actor,cid) THEN RAISE EXCEPTION 'vocabulary_excluded' USING ERRCODE='55000'; END IF;
 SELECT * INTO prev FROM fsrs_private.admission_requests WHERE user_id=p_actor AND operation_id=r->>'operationId';
 at_time:=date_trunc('milliseconds',clock_timestamp());quota:=fsrs_private.admission_status(p_actor,at_time);
 IF prev.operation_id IS NOT NULL THEN
  IF prev.request IS DISTINCT FROM r OR prev.card_id<>cid THEN RAISE EXCEPTION 'learning_operation_replay_mismatch' USING ERRCODE='23505'; END IF;
  is_duplicate:=true;
 ELSE
  IF v.last_reviewed_at IS NOT NULL AND v.next_review_at>at_time THEN RAISE EXCEPTION 'learning_card_not_due' USING ERRCODE='55000'; END IF;
  IF (r->>'expectedPolicyRevision')::bigint<>(quota->>'policyRevision')::bigint THEN RAISE EXCEPTION 'learning_policy_conflict' USING ERRCODE='40001'; END IF;
  SELECT * INTO first FROM fsrs_private.legacy_admissions WHERE user_id=p_actor AND card_id=cid;
  IF first.card_id IS NULL THEN
   consumed_slot:=v.last_reviewed_at IS NULL;
   IF consumed_slot THEN
    IF quota->'active' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'learning_admission_inactive' USING ERRCODE='55000'; END IF;
    IF (quota->>'remaining')::integer<=0 THEN RAISE EXCEPTION 'learning_daily_new_limit' USING ERRCODE='55000'; END IF;
   END IF;
   INSERT INTO fsrs_private.legacy_admissions(user_id,card_id,first_question_at,learning_day,consumed,starts_at)
    VALUES(p_actor,cid,at_time,fsrs_private.admission_day(at_time),consumed_slot,(quota->>'startsAt')::timestamptz) RETURNING * INTO first;
  END IF;
  INSERT INTO fsrs_private.admission_requests(user_id,operation_id,card_id,request,admitted_at,learning_day,starts_at,consumed,first_question_at)
   VALUES(p_actor,r->>'operationId',cid,r,at_time,fsrs_private.admission_day(at_time),(quota->>'startsAt')::timestamptz,consumed_slot,CASE WHEN first.consumed THEN first.first_question_at END) RETURNING * INTO prev;
 END IF;
 RETURN jsonb_build_object('version',1,'actorId',p_actor,'operationId',prev.operation_id,'cardId',cid,'admitted',true,'consumed',prev.consumed,'duplicate',is_duplicate,
  'firstQuestionAt',fsrs_private.iso_milliseconds(prev.first_question_at),'admittedAt',fsrs_private.iso_milliseconds(prev.admitted_at),'startsAt',fsrs_private.iso_milliseconds(prev.starts_at),'learningDay',prev.learning_day::text,
  'quota',fsrs_private.admission_status(p_actor,date_trunc('milliseconds',clock_timestamp())));
END $function$;

DROP FUNCTION IF EXISTS fsrs_private.variant_enrollment_open(uuid, uuid, uuid, text, boolean, timestamp with time zone);
DROP FUNCTION IF EXISTS fsrs_private.card_kinds(uuid);

-- ── 표(단계 2 모양일 때만). fsrs_cards: vocabulary_id를 지우면 그 열의 제약 셋 · 인덱스가 함께 지워진다 → 생성 열 · 같은 이름의 제약 · 인덱스로 다시.
DO $tables$
BEGIN
 IF pg_temp.ck2r_state()->'cards' = pg_temp.ck2r_new_state()->'cards' THEN
  ALTER TABLE public.fsrs_cards DROP COLUMN vocabulary_id;
  ALTER TABLE public.fsrs_cards
   ADD COLUMN vocabulary_id uuid NOT NULL GENERATED ALWAYS AS (card_id) STORED,
   ADD CONSTRAINT fsrs_cards_recognition_identity_check CHECK (kind <> 'recognition' OR vocabulary_id = card_id),
   ADD CONSTRAINT fsrs_cards_kind_stage1_check CHECK (kind = 'recognition'),
   ADD CONSTRAINT fsrs_cards_vocabulary_id_fkey FOREIGN KEY (vocabulary_id) REFERENCES public.user_vocabulary (id) ON DELETE RESTRICT,
   ADD CONSTRAINT fsrs_cards_user_id_vocabulary_id_kind_key UNIQUE (user_id, vocabulary_id, kind),
   ADD CONSTRAINT fsrs_cards_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.user_vocabulary (id) ON DELETE RESTRICT;
  CREATE INDEX fsrs_cards_vocabulary_id_idx ON public.fsrs_cards (vocabulary_id);
  ALTER TABLE fsrs_private.admission_policies DROP COLUMN card_kinds;
  ALTER TABLE fsrs_private.admission_settings DROP COLUMN default_card_kinds;
 END IF;
 UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash_live() WHERE contract_hash IS DISTINCT FROM fsrs_private.contract_hash_live();
 UPDATE fsrs_private.manual_save_settings SET contract_hash = fsrs_private.manual_contract_hash_live()
  WHERE contract_hash IS DISTINCT FROM fsrs_private.manual_contract_hash_live();
 UPDATE fsrs_private.admission_settings SET contract_hash = fsrs_private.admission_contract_hash_live()
  WHERE contract_hash IS DISTINCT FROM fsrs_private.admission_contract_hash_live();
END $tables$;

DO $post$
DECLARE b record; c jsonb := pg_temp.ck2r_contracts(); bad bigint; total bigint;
BEGIN
 SELECT * INTO STRICT b FROM pg_temp.ck2r_state_before;
 IF pg_temp.ck2r_state() IS DISTINCT FROM pg_temp.ck2r_old_state() THEN RAISE EXCEPTION 'card_kinds_stage2_rollback: post state differs from stage 1 %', pg_temp.ck2r_state(); END IF;
 SELECT pg_catalog.count(*), pg_catalog.count(*) FILTER (WHERE f.vocabulary_id IS DISTINCT FROM f.card_id OR f.kind IS DISTINCT FROM 'recognition')
  INTO total, bad FROM public.fsrs_cards f;
 IF total <> b.cards OR bad <> 0 THEN RAISE EXCEPTION 'card_kinds_stage2_rollback: rows changed (% → %, % not recognition = card)', b.cards, total, bad; END IF;
 IF pg_temp.ck2r_attrs() IS DISTINCT FROM b.attrs THEN RAISE EXCEPTION 'card_kinds_stage2_rollback: function attributes or grants changed'; END IF;
 IF pg_temp.ck2r_others() IS DISTINCT FROM b.others THEN RAISE EXCEPTION 'card_kinds_stage2_rollback: an untouched learning function changed'; END IF;
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'card_kinds_stage2_rollback: contracts not consistent after repin %', c; END IF;
 IF c->'profile' IS DISTINCT FROM b.contracts->'profile' THEN RAISE EXCEPTION 'card_kinds_stage2_rollback: profile pin moved'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
END $post$;

SET CONSTRAINTS fsrs_private.contract_cache_refresh IMMEDIATE;
SET CONSTRAINTS fsrs_private.contract_cache_refresh DEFERRED;

DO $cache$
DECLARE k record;
BEGIN
 SELECT * INTO STRICT k FROM fsrs_private.contract_cache;
 IF NOT k.valid THEN RAISE EXCEPTION 'card_kinds_stage2_rollback: refresh did not validate the contract cache'; END IF;
 IF (SELECT s.contract_hash FROM fsrs_private.settings s) IS DISTINCT FROM k.core
    OR (SELECT m.contract_hash FROM fsrs_private.manual_save_settings m) IS DISTINCT FROM k.manual
    OR (SELECT a.contract_hash FROM fsrs_private.admission_settings a) IS DISTINCT FROM k.admission
 THEN RAISE EXCEPTION 'card_kinds_stage2_rollback: cached core/manual/admission differ from the pins'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
END $cache$;

-- ── 출력 동일: 되돌리기 전(단계 2) 출력에서 단계 2가 덧붙인 칸(목록 세 칸 · 입장 cardKinds)을 뺀 것 = 되돌린 뒤 출력.
DO $output$
DECLARE r record; n bigint := 0;
BEGIN
 FOR r IN SELECT o.* FROM pg_temp.ck2r_output_before o LOOP
  IF public.fsrs_vocabulary_snapshot(r.actor) - 'now' IS DISTINCT FROM r.snapshot
     OR public.fsrs_vocabulary_snapshot_light(r.actor, NULL, true) - 'now' IS DISTINCT FROM r.light_summary
     OR public.fsrs_vocabulary_snapshot_light(r.actor, NULL, false) - 'now' IS DISTINCT FROM r.light_rows
     OR (r.snapshot_cards IS NOT NULL AND public.fsrs_vocabulary_snapshot_cards(r.actor,
       (SELECT pg_catalog.array_agg(w.id ORDER BY w.id) FROM (SELECT v.id FROM public.user_vocabulary v WHERE v.user_id = r.actor ORDER BY v.id LIMIT 50) w)) - 'now'
       IS DISTINCT FROM r.snapshot_cards)
  THEN RAISE EXCEPTION 'card_kinds_stage2_rollback: vocabulary snapshot output changed'; END IF;
  IF public.fsrs_list_states(r.actor) IS DISTINCT FROM (SELECT coalesce(pg_catalog.jsonb_agg(e.value - ARRAY['vocabularyId', 'kind', 'resting'] ORDER BY e.ordinality), '[]'::jsonb)
      FROM pg_catalog.jsonb_array_elements(r.states) WITH ORDINALITY e)
  THEN RAISE EXCEPTION 'card_kinds_stage2_rollback: card list output changed'; END IF;
  IF fsrs_private.admission_status(r.actor, r.at_time) IS DISTINCT FROM r.admission - 'cardKinds'
  THEN RAISE EXCEPTION 'card_kinds_stage2_rollback: admission status changed'; END IF;
  n := n + 1;
 END LOOP;
 IF n <> (SELECT s.actors FROM pg_temp.ck2r_state_before s) THEN RAISE EXCEPTION 'card_kinds_stage2_rollback: compared % of % learners', n, (SELECT s.actors FROM pg_temp.ck2r_state_before s); END IF;
 RAISE NOTICE 'card_kinds_stage2_rollback: % learners — output unchanged', n;
END $output$;

DO $snapshot$
BEGIN
 IF (SELECT pg_catalog.count(*) FROM pg_temp.perf_snapshot_before b WHERE (public.fsrs_vocabulary_snapshot(b.actor) - 'now') IS DISTINCT FROM b.body) <> 0
 THEN RAISE EXCEPTION 'card_kinds_stage2_rollback: snapshot output changed (P4 gate)'; END IF;
END $snapshot$;

DO $parity$
DECLARE cards integer; bad integer;
BEGIN
 SELECT pg_catalog.count(*)::integer,
        pg_catalog.count(*) FILTER (WHERE fsrs_private.vocabulary_registry_entry(s.actor, (e.x->>'cardId')::uuid) IS DISTINCT FROM e.x)::integer
   INTO cards, bad
   FROM (SELECT b.actor, public.fsrs_vocabulary_snapshot(b.actor) AS snap FROM pg_temp.perf_snapshot_before b) s
   CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(s.snap->'registry') AS e(x);
 IF bad <> 0 THEN RAISE EXCEPTION 'card_kinds_stage2_rollback: registry_entry differs from snapshot.registry for % of % card(s)', bad, cards; END IF;
 IF cards IS DISTINCT FROM (SELECT pg_catalog.count(*)::integer FROM public.user_vocabulary v WHERE v.user_id IN (SELECT actor FROM pg_temp.perf_snapshot_before))
 THEN RAISE EXCEPTION 'card_kinds_stage2_rollback: registry card count differs from vocabulary rows (% cards)', cards; END IF;
 RAISE NOTICE 'card_kinds_stage2_rollback: registry_entry = snapshot.registry for all % card(s)', cards;
END $parity$;

DROP FUNCTION pg_temp.ck2r_new_state(); DROP FUNCTION pg_temp.ck2r_old_state(); DROP FUNCTION pg_temp.ck2r_state(); DROP FUNCTION pg_temp.ck2r_shape(pg_catalog.regclass);
DROP FUNCTION pg_temp.ck2r_others(); DROP FUNCTION pg_temp.ck2r_attrs(); DROP FUNCTION pg_temp.ck2r_md5s(); DROP FUNCTION pg_temp.ck2r_contracts();
DROP TABLE pg_temp.ck2r_output_before; DROP TABLE pg_temp.ck2r_state_before; DROP TABLE pg_temp.perf_snapshot_before;
