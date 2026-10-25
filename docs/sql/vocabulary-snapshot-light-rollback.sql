-- SNAPSHOT-LIGHT-001 복원 — 20261025150000_vocabulary_snapshot_light.sql을 되돌린다: 가벼운 읽기 함수를 지우고 core 재게시.
-- core는 그 파일 전 값으로 정확히 돌아온다(그 파일이 core 범위에 더한 것은 이 함수 하나다 — 사후 검사 · supabase/tests/vocabulary-snapshot-light.mjs).
-- manual · admission · activity profile · snapshot 본문은 그 파일이 건드리지 않았으므로 그대로다(사후 검사).
-- 순서: 앱이 이 함수를 부르지 않게 먼저 되돌린다(배포 롤백). 앱은 함수가 없으면(PGRST202) 전체 snapshot으로 물러서므로
--   함수를 먼저 지워도 화면은 깨지지 않는다(fsrsVocabulary.readVocabularyLearningSnapshotLight) — 다만 그동안 가벼운 읽기의 이득이 없다.
-- 이 파일은 마이그레이션이 아니다(docs/sql) — db push가 적용하지 않는다. 운영 적용은 오너 승인 후 SQL 편집기에서 본문 그대로.
-- 실행 형태: SQL 편집기 한 번 실행 = 암묵 트랜잭션 하나 → BEGIN/COMMIT 없음, SET LOCAL 실효를 첫 DO가 확인. 어느 검사든 RAISE하면 전부 롤백.
SET LOCAL search_path = '';
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $runner$
BEGIN
 IF pg_catalog.current_setting('search_path') NOT IN ('', '""') OR pg_catalog.current_setting('lock_timeout') <> '5s'
    OR pg_catalog.current_setting('statement_timeout') <> '1min'
 THEN RAISE EXCEPTION 'snapshot_light_rollback: SET LOCAL not in effect (search_path=%, lock_timeout=%, statement_timeout=%)',
   pg_catalog.current_setting('search_path'), pg_catalog.current_setting('lock_timeout'), pg_catalog.current_setting('statement_timeout');
 END IF;
END $runner$;

CREATE FUNCTION pg_temp.lr_contracts() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object(
  'ok', s.contract_hash IS NOT DISTINCT FROM fsrs_private.contract_hash()
    AND m.contract_hash IS NOT DISTINCT FROM fsrs_private.manual_contract_hash()
    AND a.contract_hash IS NOT DISTINCT FROM fsrs_private.admission_contract_hash()
    AND t.profile_contract_hash IS NOT DISTINCT FROM fsrs_private.activity_profile_hash(),
  'core', s.contract_hash, 'manual', m.contract_hash, 'admission', a.contract_hash, 'profile', t.profile_contract_hash)
 FROM fsrs_private.settings s, fsrs_private.manual_save_settings m, fsrs_private.admission_settings a, fsrs_private.activity_settings t
$q$;

CREATE TEMP TABLE lr_state_before ON COMMIT DROP AS
 SELECT pg_temp.lr_contracts() AS contracts,
  (SELECT pg_catalog.md5(p.prosrc) FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure('public.fsrs_vocabulary_snapshot(uuid)')) AS snap,
  (SELECT pg_catalog.md5(p.prosrc) FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure('public.fsrs_vocabulary_snapshot_light(uuid,text,boolean)')) AS light;

DO $pre$
DECLARE b record;
BEGIN
 SELECT * INTO b FROM lr_state_before;
 IF NOT (b.contracts->>'ok')::boolean THEN RAISE EXCEPTION 'snapshot_light_rollback: learning contracts already drifted %', b.contracts; END IF;
 IF b.light IS NOT NULL AND b.light IS DISTINCT FROM '3093ad73ed356efd792114f5aab27985'
 THEN RAISE EXCEPTION 'snapshot_light_rollback: fsrs_vocabulary_snapshot_light is not the reviewed body (%)', b.light; END IF;
 RAISE NOTICE 'snapshot_light_rollback: %', CASE WHEN b.light IS NULL THEN 'function already absent — re-pin only' ELSE 'dropping function' END;
END $pre$;

DROP FUNCTION IF EXISTS public.fsrs_vocabulary_snapshot_light(uuid,text,boolean);

DO $change$
DECLARE n integer;
BEGIN
 UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash() WHERE contract_hash IS DISTINCT FROM fsrs_private.contract_hash();
 GET DIAGNOSTICS n = ROW_COUNT;
 IF n > 1 THEN RAISE EXCEPTION 'snapshot_light_rollback: core pin touched % rows', n; END IF;
END $change$;

DO $post$
DECLARE b record; c jsonb := pg_temp.lr_contracts();
BEGIN
 SELECT * INTO b FROM lr_state_before;
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'snapshot_light_rollback: contracts not consistent after drop %', c; END IF;
 IF c->>'manual' IS DISTINCT FROM b.contracts->>'manual' OR c->>'admission' IS DISTINCT FROM b.contracts->>'admission'
    OR c->>'profile' IS DISTINCT FROM b.contracts->>'profile'
 THEN RAISE EXCEPTION 'snapshot_light_rollback: manual/admission/profile pin moved % -> %', b.contracts, c; END IF;
 IF pg_catalog.to_regprocedure('public.fsrs_vocabulary_snapshot_light(uuid,text,boolean)') IS NOT NULL THEN RAISE EXCEPTION 'snapshot_light_rollback: function still exists'; END IF;
 IF (SELECT pg_catalog.md5(p.prosrc) FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure('public.fsrs_vocabulary_snapshot(uuid)')) IS DISTINCT FROM b.snap
 THEN RAISE EXCEPTION 'snapshot_light_rollback: snapshot body changed'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
 RAISE NOTICE 'snapshot_light_rollback: ok — pins % -> %', b.contracts, c;
END $post$;

DROP FUNCTION pg_temp.lr_contracts();
DROP TABLE pg_temp.lr_state_before;
