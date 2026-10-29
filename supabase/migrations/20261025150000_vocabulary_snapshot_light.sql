-- SNAPSHOT-LIGHT-001 — 서버가 첫 화면 · /study 조립에 전체 학습 snapshot(3,000단어 ≈ 2.2 MB)을 읽지 않게 하는 가벼운 읽기.
--   오너 승인 2026-10-25 KST 「권장대로」(안 A — ㉠ 복습방 첫 숫자 병합 전 · 로그인 감사 F2 · F8).
-- 적용 경로 = PR이 main에 병합되면 supabase-migrations.yml(db push)이 운영에 바로 적용한다 → 병합 승인 = 운영 적용 승인.
-- 실행 형태: db push는 파일 전체 + 이력 INSERT를 한 파이프라인(암묵 트랜잭션 하나)으로 보낸다 → BEGIN/COMMIT 없음, SET LOCAL 실효를
--   첫 DO가 확인. 어느 검사든 RAISE하면 이력까지 함께 롤백된다. 실행 주체 postgres, 앱 사용자(JWT)를 만들지 않는다.
-- 더하는 것(그 밖은 그대로 — 표 · 정책 · 인덱스 · 기존 함수 본문 변경 없음):
--   public.fsrs_vocabulary_snapshot_light(p_actor uuid, p_language text, p_summary boolean) — snapshot과 같은 판정 · 같은 순서의 부분 집합.
--   ⑴ p_language: NULL = 모든 행, 아니면 language = p_language인 행만(/study는 한 언어 행만 쓴다 — 다른 언어 행 · 등록 정보를 싣지 않는다).
--   ⑵ p_summary: true = 행을 요약 칸(VOCABULARY_LEARNING_SUMMARY_FIELDS − user_id) 배열로(칸 이름을 행마다 되풀이하지 않는다 —
--      복습방 첫 숫자는 이 칸만 읽는다), false = snapshot과 같은 to_jsonb(행).
--   ⑶ registry: 기본값(등록 안 됨 · 아는 단어 아님 · 제외 아님)이 아닌 칸만. 빠진 칸은 JS(expandLightSnapshot)가 snapshot이 내는 그 기본값으로 채운다.
--   판정(아는 단어 · 제외 · 다음 질문 · 첫 질문)과 계정 검사(require_admission_integrity · invalid_fsrs_actor 42501 · 55000 두 가지)는
--   snapshot 본문(md5 90cb5fb52d43d00eeb4b5c5a41ba8b19)의 그 문장을 **바이트 그대로** 쓴다 — 새 판정 없음. 계약:
--   src/lib/__tests__/vocabularySnapshotLight.test.js(마이그레이션 원문에서 두 본문의 판정 조각이 같은지) · 아래 사후 검사 ⑵
--   (모든 사용자 · 모든 언어 · 두 모양에서 light = snapshot의 부분 집합) · supabase/tests/vocabulary-snapshot-light.mjs.
--   권한 = snapshot과 같다: SECURITY DEFINER · STABLE · search_path '' · service_role만 EXECUTE(PUBLIC · anon · authenticated 없음).
-- 재게시: core만(public.fsrs_* 함수가 core 지문 범위다). manual · admission은 고정 목록이라 이 함수가 들지 않는다 → 그대로(사후 검사).
--   activity profile · 한국어 capability 지문도 범위 밖 → 그대로(사후 검사 · post-observation-migrations.mjs).
-- 사전 검사가 받는 상태: ① 함수 없음 · snapshot = 위 md5 · 네 계약 동치 ② 이 파일을 이미 적용(같은 본문 — no-op). 그 밖이면 RAISE.
-- 복원: docs/sql/vocabulary-snapshot-light-rollback.sql — DROP FUNCTION 뒤 core 재게시(이 파일 전 값으로 정확히 돌아온다).
SET LOCAL search_path = '';
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '180s';

-- 실행기 확인: SET LOCAL이 이 트랜잭션에 실제로 걸렸어야 한다(db push 파이프라인 = 암묵 트랜잭션 하나).
DO $runner$
BEGIN
 IF pg_catalog.current_setting('search_path') NOT IN ('', '""') OR pg_catalog.current_setting('lock_timeout') <> '5s'
    OR pg_catalog.current_setting('statement_timeout') <> '3min'
 THEN RAISE EXCEPTION 'snapshot_light: SET LOCAL not in effect (search_path=%, lock_timeout=%, statement_timeout=%)',
   pg_catalog.current_setting('search_path'), pg_catalog.current_setting('lock_timeout'), pg_catalog.current_setting('statement_timeout');
 END IF;
END $runner$;

-- ── 공통 도구(pg_temp, 이 세션 전용 · 끝에서 DROP).
CREATE FUNCTION pg_temp.ls_contracts() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object(
  'ok', s.contract_hash IS NOT DISTINCT FROM fsrs_private.contract_hash()
    AND m.contract_hash IS NOT DISTINCT FROM fsrs_private.manual_contract_hash()
    AND a.contract_hash IS NOT DISTINCT FROM fsrs_private.admission_contract_hash()
    AND t.profile_contract_hash IS NOT DISTINCT FROM fsrs_private.activity_profile_hash(),
  'core', s.contract_hash, 'manual', m.contract_hash, 'admission', a.contract_hash, 'profile', t.profile_contract_hash)
 FROM fsrs_private.settings s, fsrs_private.manual_save_settings m, fsrs_private.admission_settings a, fsrs_private.activity_settings t
$q$;
CREATE FUNCTION pg_temp.ls_fn(p_sig text) RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object('md5', pg_catalog.md5(p.prosrc),
  'attrs', pg_catalog.jsonb_build_array(p.proowner, p.prosecdef, p.proconfig, p.provolatile, p.proparallel, p.proleakproof, p.proisstrict,
           p.prolang, p.prorettype, p.proretset), 'acl', p.proacl::text)
 FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure(p_sig)
$q$;
-- 게시 지문 core 한 칸을 '지금 계산한 값'으로(바뀔 때만, 정확히 1행).
CREATE FUNCTION pg_temp.ls_repin_core() RETURNS void LANGUAGE plpgsql SET search_path = '' AS $q$
DECLARE n integer;
BEGIN
 UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash() WHERE contract_hash IS DISTINCT FROM fsrs_private.contract_hash();
 GET DIAGNOSTICS n = ROW_COUNT;
 IF n > 1 THEN RAISE EXCEPTION 'snapshot_light: core pin touched % rows', n; END IF;
END
$q$;

DO $pre$
DECLARE c jsonb := pg_temp.ls_contracts(); light jsonb := pg_temp.ls_fn('public.fsrs_vocabulary_snapshot_light(uuid,text,boolean)');
BEGIN
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'snapshot_light: learning contracts already drifted %', c; END IF;
 PERFORM fsrs_private.require_admission_integrity();
 -- 판정 조각을 옮겨 온 본문이 지금 운영 snapshot이어야 한다(P4 뒤 그대로).
 IF pg_temp.ls_fn('public.fsrs_vocabulary_snapshot(uuid)')->>'md5' IS DISTINCT FROM '90cb5fb52d43d00eeb4b5c5a41ba8b19'
 THEN RAISE EXCEPTION 'snapshot_light: fsrs_vocabulary_snapshot is not the reviewed P4 body'; END IF;
 IF light IS NULL THEN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.pronamespace = 'public'::pg_catalog.regnamespace AND p.proname = 'fsrs_vocabulary_snapshot_light')
  THEN RAISE EXCEPTION 'snapshot_light: another fsrs_vocabulary_snapshot_light overload exists'; END IF;
  RAISE NOTICE 'snapshot_light: needs function';
 ELSIF light->>'md5' = '3093ad73ed356efd792114f5aab27985' THEN
  RAISE NOTICE 'snapshot_light: already applied — no-op';
 ELSE
  RAISE EXCEPTION 'snapshot_light: fsrs_vocabulary_snapshot_light exists with an unreviewed body';
 END IF;
END $pre$;

CREATE TEMP TABLE ls_state_before ON COMMIT DROP AS
 SELECT pg_temp.ls_contracts() AS contracts, pg_temp.ls_fn('public.fsrs_vocabulary_snapshot(uuid)') AS snap,
  pg_temp.ls_fn('public.fsrs_vocabulary_snapshot_light(uuid,text,boolean)') IS NOT NULL AS applied,
  (SELECT pg_catalog.md5(p.prosrc) FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure('public.learning_language_capabilities()')) AS capability;

-- ── 변경: 가벼운 읽기. 계정 검사 · WITH 판정 · registry 칸은 snapshot 본문 그대로(계약 vocabularySnapshotLight.test.js가 원문 대조).
--    다른 점은 셋뿐: p_summary 검사 · x의 WHERE에 언어 조건 · 출력(light 머리 · 요약 배열 · registry 기본값 생략).
CREATE OR REPLACE FUNCTION public.fsrs_vocabulary_snapshot_light(p_actor uuid, p_language text, p_summary boolean)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
 AS $fn$
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
END $fn$;
REVOKE ALL ON FUNCTION public.fsrs_vocabulary_snapshot_light(uuid,text,boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fsrs_vocabulary_snapshot_light(uuid,text,boolean) TO service_role;

-- ── 재게시: core만(이 함수는 public.fsrs_* — core 지문 범위). 이미 적용한 상태면 지문이 그대로라 0행.
DO $change$
BEGIN
 PERFORM pg_temp.ls_repin_core();
END $change$;

-- ── 사후 검사 ⑴: 네 계약 동치 · manual/admission/profile 불변 · core는 처음 적용일 때만 움직임 · 속성 · 권한 · snapshot 본문 불변.
DO $post$
DECLARE b record; c jsonb; f jsonb := pg_temp.ls_fn('public.fsrs_vocabulary_snapshot_light(uuid,text,boolean)'); snap jsonb := pg_temp.ls_fn('public.fsrs_vocabulary_snapshot(uuid)');
BEGIN
 SELECT * INTO b FROM ls_state_before;
 c := pg_temp.ls_contracts();
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'snapshot_light: contracts not consistent after change %', c; END IF;
 IF c->>'manual' IS DISTINCT FROM b.contracts->>'manual' OR c->>'admission' IS DISTINCT FROM b.contracts->>'admission'
    OR c->>'profile' IS DISTINCT FROM b.contracts->>'profile'
 THEN RAISE EXCEPTION 'snapshot_light: manual/admission/profile pin moved % -> %', b.contracts, c; END IF;
 IF b.applied AND c IS DISTINCT FROM b.contracts THEN RAISE EXCEPTION 'snapshot_light: already-applied run must not change anything'; END IF;
 IF NOT b.applied AND c->>'core' = b.contracts->>'core' THEN RAISE EXCEPTION 'snapshot_light: core pin did not move with the new function'; END IF;
 IF snap IS DISTINCT FROM b.snap THEN RAISE EXCEPTION 'snapshot_light: fsrs_vocabulary_snapshot changed'; END IF;
 IF (SELECT pg_catalog.md5(p.prosrc) FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure('public.learning_language_capabilities()')) IS DISTINCT FROM b.capability
 THEN RAISE EXCEPTION 'snapshot_light: learning_language_capabilities changed'; END IF;
 IF f->>'md5' IS DISTINCT FROM '3093ad73ed356efd792114f5aab27985' THEN RAISE EXCEPTION 'snapshot_light: function body is not the reviewed one (%)', f->>'md5'; END IF;
 -- 속성(소유자 · SECURITY DEFINER · search_path · STABLE · 병렬 · 언어 · 반환형)은 snapshot과 같다.
 IF f->'attrs' IS DISTINCT FROM snap->'attrs' THEN RAISE EXCEPTION 'snapshot_light: attributes differ from the snapshot % vs %', f->'attrs', snap->'attrs'; END IF;
 -- 권한: service_role만 EXECUTE(소유자 제외), PUBLIC · anon · authenticated 없음 — snapshot과 같은 모양.
 IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p, LATERAL pg_catalog.aclexplode(p.proacl) x
            WHERE p.oid = 'public.fsrs_vocabulary_snapshot_light(uuid,text,boolean)'::pg_catalog.regprocedure AND x.grantee <> p.proowner
              AND (x.grantee = 0 OR x.grantee <> (SELECT r.oid FROM pg_catalog.pg_roles r WHERE r.rolname = 'service_role') OR x.privilege_type <> 'EXECUTE'))
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p, LATERAL pg_catalog.aclexplode(p.proacl) x
            WHERE p.oid = 'public.fsrs_vocabulary_snapshot_light(uuid,text,boolean)'::pg_catalog.regprocedure
              AND x.grantee = (SELECT r.oid FROM pg_catalog.pg_roles r WHERE r.rolname = 'service_role') AND x.privilege_type = 'EXECUTE')
    OR pg_catalog.has_function_privilege('anon', 'public.fsrs_vocabulary_snapshot_light(uuid,text,boolean)', 'EXECUTE')
    OR pg_catalog.has_function_privilege('authenticated', 'public.fsrs_vocabulary_snapshot_light(uuid,text,boolean)', 'EXECUTE')
 THEN RAISE EXCEPTION 'snapshot_light: EXECUTE must be service_role only (%)', f->>'acl'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
 RAISE NOTICE 'snapshot_light: ok — pins % -> %', b.contracts, c;
END $post$;

-- ── 사후 검사 ⑵: 모든 사용자 · 모든 언어(+ 전체) · 두 모양에서 light = snapshot의 부분 집합(같은 트랜잭션 · 같은 데이터).
--    full: rows = snapshot rows(그 언어) · registry = snapshot registry(그 언어) 중 기본값이 아닌 칸, 같은 순서.
--    summary: rows = snapshot rows의 요약 칸 배열(같은 값 · 같은 순서) · registry는 full과 같다. 'now'만 문장마다 달라 뺀다.
--    학습자 행은 이 함수 안에서만 비교하고 밖으로 내보내지 않는다. 하나라도 다르면 RAISE → 이력까지 전체 롤백.
CREATE FUNCTION pg_temp.ls_mismatch(p_actor uuid) RETURNS text LANGUAGE plpgsql STABLE SET search_path = '' AS $q$
DECLARE full_snap jsonb := public.fsrs_vocabulary_snapshot(p_actor) - 'now'; l jsonb; lang text; summary boolean; want_rows jsonb; want_registry jsonb;
 cols text[] := ARRAY['id','word_text','base_form','meaning','language','created_at','interval','ease_factor','repetitions','last_reviewed_at','next_review_at','source_material_id','source_ref'];
BEGIN
 FOR lang IN SELECT NULL::text UNION ALL SELECT DISTINCT r->>'language' FROM pg_catalog.jsonb_array_elements(full_snap->'rows') r WHERE r->>'language' IS NOT NULL LOOP
  FOREACH summary IN ARRAY ARRAY[false, true] LOOP
   l := public.fsrs_vocabulary_snapshot_light(p_actor, lang, summary);
   IF (l - ARRAY['now','light','rows','registry']) IS DISTINCT FROM (full_snap - ARRAY['rows','registry']) OR l->>'now' IS NULL
   THEN RETURN pg_catalog.format('envelope %s/%s', lang, summary); END IF;
   IF l->'light' IS DISTINCT FROM pg_catalog.jsonb_build_object('version',1,'language',lang,'summary',summary,'registry','sparse',
        'columns',CASE WHEN summary THEN pg_catalog.to_jsonb(cols) END)
   THEN RETURN pg_catalog.format('header %s/%s', lang, summary); END IF;
   SELECT coalesce(pg_catalog.jsonb_agg(CASE WHEN summary THEN (SELECT pg_catalog.jsonb_agg(r.x->c.k ORDER BY c.n) FROM pg_catalog.unnest(cols) WITH ORDINALITY c(k,n)) ELSE r.x END ORDER BY r.n), '[]'::jsonb)
     INTO want_rows FROM pg_catalog.jsonb_array_elements(full_snap->'rows') WITH ORDINALITY r(x,n) WHERE lang IS NULL OR r.x->>'language' = lang;
   IF l->'rows' IS DISTINCT FROM want_rows THEN RETURN pg_catalog.format('rows %s/%s', lang, summary); END IF;
   SELECT coalesce(pg_catalog.jsonb_agg(e.x ORDER BY e.n), '[]'::jsonb) INTO want_registry
     FROM pg_catalog.jsonb_array_elements(full_snap->'registry') WITH ORDINALITY e(x,n)
     JOIN pg_catalog.jsonb_array_elements(full_snap->'rows') r(x) ON r.x->'id' = e.x->'cardId'
    WHERE (lang IS NULL OR r.x->>'language' = lang)
      AND e.x IS DISTINCT FROM pg_catalog.jsonb_build_object('cardId',e.x->'cardId','userId',p_actor,'enrolled',false,'card',NULL,'known',false,
        'excluded',false,'eligible',true,'nextQuestionAt',NULL,'firstQuestionAt',NULL);
   IF l->'registry' IS DISTINCT FROM want_registry THEN RETURN pg_catalog.format('registry %s/%s', lang, summary); END IF;
  END LOOP;
 END LOOP;
 RETURN NULL;
END
$q$;

DO $parity$
DECLARE actors integer; bad integer; first_bad text;
BEGIN
 SELECT pg_catalog.count(*)::integer, pg_catalog.count(m.why)::integer, pg_catalog.min(m.why) INTO actors, bad, first_bad
   FROM (SELECT pg_temp.ls_mismatch(u.user_id) AS why
           FROM (SELECT DISTINCT v.user_id FROM public.user_vocabulary v WHERE EXISTS (SELECT 1 FROM auth.users a WHERE a.id = v.user_id)) u) m;
 IF bad <> 0 THEN RAISE EXCEPTION 'snapshot_light: light differs from snapshot for % of % actor(s) (first: %)', bad, actors, first_bad; END IF;
 RAISE NOTICE 'snapshot_light: light = snapshot subset for all % actor(s)', actors;
END $parity$;

-- ── 캐시 갱신을 지금 실행해 본다(커밋 때 할 일과 같은 함수 — 20261023170000). 이 뒤의 DDL은 임시 객체 DROP뿐이라 캐시를 무효로 만들지 않는다.
SET CONSTRAINTS fsrs_private.contract_cache_refresh IMMEDIATE;
SET CONSTRAINTS fsrs_private.contract_cache_refresh DEFERRED;

DO $cache$
DECLARE k record;
BEGIN
 SELECT * INTO STRICT k FROM fsrs_private.contract_cache;
 IF NOT k.valid THEN RAISE EXCEPTION 'snapshot_light: refresh did not validate the contract cache'; END IF;
 IF (SELECT s.contract_hash FROM fsrs_private.settings s) IS DISTINCT FROM k.core
    OR (SELECT s.contract_hash FROM fsrs_private.settings s) IS DISTINCT FROM fsrs_private.contract_hash_live()
 THEN RAISE EXCEPTION 'snapshot_light: cached core differs from the pin'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
END $cache$;

DROP FUNCTION pg_temp.ls_mismatch(uuid); DROP FUNCTION pg_temp.ls_repin_core(); DROP FUNCTION pg_temp.ls_fn(text); DROP FUNCTION pg_temp.ls_contracts();
DROP TABLE pg_temp.ls_state_before;
