-- SNAPSHOT-CARDS-001 — 뷰어 · 단어장 글자 칸이 단어 하나를 담거나 채점할 때마다 전체 학습 snapshot(모든 언어 · 모든 단어 — 3,000단어 ≈ 2.6 MB,
--   운영 무료 DB 1.6~4 s)을 다시 받지 않게 하는 좁은 읽기. 오너 승인 2026-10-26 KST 「A안 적용」.
--   운영 실측(Supabase 로그 2026-10-25 KST): 단어 저장(POST user_vocabulary)과 전체 snapshot RPC가 15분마다 12↔12 · 11↔11로 1:1로 움직였고,
--   그 사이 다른 조회가 3~11 s로 늦어졌다. 다시 받는 까닭은 막 담은 카드의 서버 판정(다음 복습 · 만기 · 아는 단어 · 제외)이 색인에 있어야
--   해서다 — 브라우저가 그 판정을 계산하면 SQL 판정을 둘로 만든다(금지). 그래서 같은 판정을 그 카드에만 묻는다.
-- 적용 경로 = PR이 main에 병합되면 supabase-migrations.yml(db push)이 운영에 바로 적용한다 → 병합 승인 = 운영 적용 승인.
-- 실행 형태: db push는 파일 전체 + 이력 INSERT를 한 파이프라인(암묵 트랜잭션 하나)으로 보낸다 → BEGIN/COMMIT 없음, SET LOCAL 실효를
--   첫 DO가 확인. 어느 검사든 RAISE하면 이력까지 함께 롤백된다. 실행 주체 postgres, 앱 사용자(JWT)를 만들지 않는다.
-- 더하는 것(그 밖은 그대로 — 표 · 정책 · 인덱스 · 기존 함수 본문 변경 없음):
--   public.fsrs_vocabulary_snapshot_cards(p_actor uuid, p_ids uuid[]) — snapshot과 **같은 모양**(같은 머리 · rows = to_jsonb(행) · registry 전체 칸)에서
--   id가 p_ids에 든 행만, 같은 순서(ORDER BY id). 남의 id · 없는 id는 조용히 빠진다(남의 행 존재를 알리지 않는다 — v.user_id=p_actor가 먼저 거른다).
--   p_ids: 1차원 · 1~50개 · NULL 원소 없음(중복은 한 번). 그 밖이면 invalid_fsrs_request(22023, light의 p_summary 검사와 같은 꼴).
--   판정(아는 단어 · 제외 · 다음 질문 · 첫 질문)과 계정 검사(require_admission_integrity · invalid_fsrs_actor 42501 · 55000 두 가지)는
--   snapshot 본문(md5 90cb5fb52d43d00eeb4b5c5a41ba8b19)의 그 문장을 **바이트 그대로** 쓴다 — 새 판정 없음. 다른 것은 p_ids 검사 한 줄과
--   x의 WHERE에 붙은 id 조건 하나다. 계정 검사는 좁히지 않는다(남의 카드가 끼면 어느 id를 물어도 55000 — snapshot과 같다). 계약:
--   src/lib/__tests__/vocabularySnapshotCards.test.js(마이그레이션 원문에서 두 본문의 판정 조각이 같은지) · 아래 사후 검사 ⑵
--   (모든 사용자 × 표본 id 묶음에서 cards = snapshot을 그 id로 거른 것, 정확히) · supabase/tests/vocabulary-snapshot-cards.mjs.
--   권한 = snapshot과 같다: SECURITY DEFINER · STABLE · search_path '' · service_role만 EXECUTE(PUBLIC · anon · authenticated 없음).
-- 재게시: core만(public.fsrs_* 함수가 core 지문 범위다). manual · admission은 고정 목록이라 이 함수가 들지 않는다 → 그대로(사후 검사).
--   activity profile · 한국어 capability 지문도 범위 밖 → 그대로(사후 검사 · post-observation-migrations.mjs). light 본문도 그대로(사후 검사).
-- 사전 검사가 받는 상태: ① 함수 없음 · snapshot = 위 md5 · 네 계약 동치 ② 이 파일을 이미 적용(같은 본문 — no-op). 그 밖이면 RAISE.
-- 복원: docs/sql/vocabulary-snapshot-cards-rollback.sql — DROP FUNCTION 뒤 core 재게시(이 파일 전 값으로 정확히 돌아온다). 앱은 함수가 없으면
--   (PGRST202) 전체 snapshot을 그 id로 걸러 같은 값을 낸다(fsrsVocabulary.readVocabularyLearningSnapshotCards) — 이득만 사라진다.
SET LOCAL search_path = '';
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '180s';

-- 실행기 확인: SET LOCAL이 이 트랜잭션에 실제로 걸렸어야 한다(db push 파이프라인 = 암묵 트랜잭션 하나).
DO $runner$
BEGIN
 IF pg_catalog.current_setting('search_path') NOT IN ('', '""') OR pg_catalog.current_setting('lock_timeout') <> '5s'
    OR pg_catalog.current_setting('statement_timeout') <> '3min'
 THEN RAISE EXCEPTION 'snapshot_cards: SET LOCAL not in effect (search_path=%, lock_timeout=%, statement_timeout=%)',
   pg_catalog.current_setting('search_path'), pg_catalog.current_setting('lock_timeout'), pg_catalog.current_setting('statement_timeout');
 END IF;
END $runner$;

-- ── 공통 도구(pg_temp, 이 세션 전용 · 끝에서 DROP).
CREATE FUNCTION pg_temp.sc_contracts() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object(
  'ok', s.contract_hash IS NOT DISTINCT FROM fsrs_private.contract_hash()
    AND m.contract_hash IS NOT DISTINCT FROM fsrs_private.manual_contract_hash()
    AND a.contract_hash IS NOT DISTINCT FROM fsrs_private.admission_contract_hash()
    AND t.profile_contract_hash IS NOT DISTINCT FROM fsrs_private.activity_profile_hash(),
  'core', s.contract_hash, 'manual', m.contract_hash, 'admission', a.contract_hash, 'profile', t.profile_contract_hash)
 FROM fsrs_private.settings s, fsrs_private.manual_save_settings m, fsrs_private.admission_settings a, fsrs_private.activity_settings t
$q$;
CREATE FUNCTION pg_temp.sc_fn(p_sig text) RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object('md5', pg_catalog.md5(p.prosrc),
  'attrs', pg_catalog.jsonb_build_array(p.proowner, p.prosecdef, p.proconfig, p.provolatile, p.proparallel, p.proleakproof, p.proisstrict,
           p.prolang, p.prorettype, p.proretset), 'acl', p.proacl::text)
 FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure(p_sig)
$q$;
-- 게시 지문 core 한 칸을 '지금 계산한 값'으로(바뀔 때만, 정확히 1행).
CREATE FUNCTION pg_temp.sc_repin_core() RETURNS void LANGUAGE plpgsql SET search_path = '' AS $q$
DECLARE n integer;
BEGIN
 UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash() WHERE contract_hash IS DISTINCT FROM fsrs_private.contract_hash();
 GET DIAGNOSTICS n = ROW_COUNT;
 IF n > 1 THEN RAISE EXCEPTION 'snapshot_cards: core pin touched % rows', n; END IF;
END
$q$;

DO $pre$
DECLARE c jsonb := pg_temp.sc_contracts(); cards jsonb := pg_temp.sc_fn('public.fsrs_vocabulary_snapshot_cards(uuid,uuid[])');
BEGIN
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'snapshot_cards: learning contracts already drifted %', c; END IF;
 PERFORM fsrs_private.require_admission_integrity();
 -- 판정 조각을 옮겨 온 본문이 지금 운영 snapshot이어야 한다(P4 뒤 그대로).
 IF pg_temp.sc_fn('public.fsrs_vocabulary_snapshot(uuid)')->>'md5' IS DISTINCT FROM '90cb5fb52d43d00eeb4b5c5a41ba8b19'
 THEN RAISE EXCEPTION 'snapshot_cards: fsrs_vocabulary_snapshot is not the reviewed P4 body'; END IF;
 IF cards IS NULL THEN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p WHERE p.pronamespace = 'public'::pg_catalog.regnamespace AND p.proname = 'fsrs_vocabulary_snapshot_cards')
  THEN RAISE EXCEPTION 'snapshot_cards: another fsrs_vocabulary_snapshot_cards overload exists'; END IF;
  RAISE NOTICE 'snapshot_cards: needs function';
 ELSIF cards->>'md5' = '40cea98a04cf45be087f024b6b4aea67' THEN
  RAISE NOTICE 'snapshot_cards: already applied — no-op';
 ELSE
  RAISE EXCEPTION 'snapshot_cards: fsrs_vocabulary_snapshot_cards exists with an unreviewed body';
 END IF;
END $pre$;

CREATE TEMP TABLE sc_state_before ON COMMIT DROP AS
 SELECT pg_temp.sc_contracts() AS contracts, pg_temp.sc_fn('public.fsrs_vocabulary_snapshot(uuid)') AS snap,
  pg_temp.sc_fn('public.fsrs_vocabulary_snapshot_light(uuid,text,boolean)') AS light,
  pg_temp.sc_fn('public.fsrs_vocabulary_snapshot_cards(uuid,uuid[])') IS NOT NULL AS applied,
  (SELECT pg_catalog.md5(p.prosrc) FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure('public.learning_language_capabilities()')) AS capability;

-- ── 변경: 카드 몇 장의 snapshot. 계정 검사 · WITH 판정 · 머리 · rows · registry 칸은 snapshot 본문 그대로(계약 vocabularySnapshotCards.test.js가
--    원문 대조). 다른 점은 둘뿐: p_ids 검사 한 줄 · x의 WHERE에 id 조건.
CREATE OR REPLACE FUNCTION public.fsrs_vocabulary_snapshot_cards(p_actor uuid, p_ids uuid[])
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
 AS $fn$
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
END $fn$;
REVOKE ALL ON FUNCTION public.fsrs_vocabulary_snapshot_cards(uuid,uuid[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fsrs_vocabulary_snapshot_cards(uuid,uuid[]) TO service_role;

-- ── 재게시: core만(이 함수는 public.fsrs_* — core 지문 범위). 이미 적용한 상태면 지문이 그대로라 0행.
DO $change$
BEGIN
 PERFORM pg_temp.sc_repin_core();
END $change$;

-- ── 사후 검사 ⑴: 네 계약 동치 · manual/admission/profile 불변 · core는 처음 적용일 때만 움직임 · 속성 · 권한 · snapshot · light 본문 불변.
DO $post$
DECLARE b record; c jsonb; f jsonb := pg_temp.sc_fn('public.fsrs_vocabulary_snapshot_cards(uuid,uuid[])'); snap jsonb := pg_temp.sc_fn('public.fsrs_vocabulary_snapshot(uuid)');
BEGIN
 SELECT * INTO b FROM sc_state_before;
 c := pg_temp.sc_contracts();
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'snapshot_cards: contracts not consistent after change %', c; END IF;
 IF c->>'manual' IS DISTINCT FROM b.contracts->>'manual' OR c->>'admission' IS DISTINCT FROM b.contracts->>'admission'
    OR c->>'profile' IS DISTINCT FROM b.contracts->>'profile'
 THEN RAISE EXCEPTION 'snapshot_cards: manual/admission/profile pin moved % -> %', b.contracts, c; END IF;
 IF b.applied AND c IS DISTINCT FROM b.contracts THEN RAISE EXCEPTION 'snapshot_cards: already-applied run must not change anything'; END IF;
 IF NOT b.applied AND c->>'core' = b.contracts->>'core' THEN RAISE EXCEPTION 'snapshot_cards: core pin did not move with the new function'; END IF;
 IF snap IS DISTINCT FROM b.snap THEN RAISE EXCEPTION 'snapshot_cards: fsrs_vocabulary_snapshot changed'; END IF;
 IF pg_temp.sc_fn('public.fsrs_vocabulary_snapshot_light(uuid,text,boolean)') IS DISTINCT FROM b.light THEN RAISE EXCEPTION 'snapshot_cards: fsrs_vocabulary_snapshot_light changed'; END IF;
 IF (SELECT pg_catalog.md5(p.prosrc) FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure('public.learning_language_capabilities()')) IS DISTINCT FROM b.capability
 THEN RAISE EXCEPTION 'snapshot_cards: learning_language_capabilities changed'; END IF;
 IF f->>'md5' IS DISTINCT FROM '40cea98a04cf45be087f024b6b4aea67' THEN RAISE EXCEPTION 'snapshot_cards: function body is not the reviewed one (%)', f->>'md5'; END IF;
 -- 속성(소유자 · SECURITY DEFINER · search_path · STABLE · 병렬 · 언어 · 반환형)은 snapshot과 같다.
 IF f->'attrs' IS DISTINCT FROM snap->'attrs' THEN RAISE EXCEPTION 'snapshot_cards: attributes differ from the snapshot % vs %', f->'attrs', snap->'attrs'; END IF;
 -- 권한: service_role만 EXECUTE(소유자 제외), PUBLIC · anon · authenticated 없음 — snapshot과 같은 모양.
 IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p, LATERAL pg_catalog.aclexplode(p.proacl) x
            WHERE p.oid = 'public.fsrs_vocabulary_snapshot_cards(uuid,uuid[])'::pg_catalog.regprocedure AND x.grantee <> p.proowner
              AND (x.grantee = 0 OR x.grantee <> (SELECT r.oid FROM pg_catalog.pg_roles r WHERE r.rolname = 'service_role') OR x.privilege_type <> 'EXECUTE'))
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p, LATERAL pg_catalog.aclexplode(p.proacl) x
            WHERE p.oid = 'public.fsrs_vocabulary_snapshot_cards(uuid,uuid[])'::pg_catalog.regprocedure
              AND x.grantee = (SELECT r.oid FROM pg_catalog.pg_roles r WHERE r.rolname = 'service_role') AND x.privilege_type = 'EXECUTE')
    OR pg_catalog.has_function_privilege('anon', 'public.fsrs_vocabulary_snapshot_cards(uuid,uuid[])', 'EXECUTE')
    OR pg_catalog.has_function_privilege('authenticated', 'public.fsrs_vocabulary_snapshot_cards(uuid,uuid[])', 'EXECUTE')
 THEN RAISE EXCEPTION 'snapshot_cards: EXECUTE must be service_role only (%)', f->>'acl'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
 RAISE NOTICE 'snapshot_cards: ok — pins % -> %', b.contracts, c;
END $post$;

-- ── 사후 검사 ⑵: 요청 검사 — NULL · 비었음 · 50개 넘음 · NULL 원소 · 2차원 id 목록은 계정을 보기 전에 22023으로 거절한다.
DO $request$
DECLARE bad uuid[]; k integer := 0;
 many uuid[] := ARRAY(SELECT ('00000000-0000-4000-8000-' || pg_catalog.lpad(g::text, 12, '0'))::uuid FROM pg_catalog.generate_series(1, 51) g);
BEGIN
 FOR bad IN SELECT t.v FROM (VALUES (NULL::uuid[]), ('{}'::uuid[]), (many), (ARRAY[NULL::uuid]), (ARRAY[many[1], NULL]),
   (ARRAY[ARRAY[many[1]], ARRAY[many[2]]])) t(v) LOOP
  -- 다른 오류(예: 행위자 NULL의 42501)는 요청 검사를 지나쳤다는 뜻이다 — 세지 않고 아래에서 함께 멈춘다.
  BEGIN
   PERFORM public.fsrs_vocabulary_snapshot_cards(NULL, bad);
  EXCEPTION WHEN SQLSTATE '22023' THEN k := k + 1; WHEN OTHERS THEN NULL;
  END;
 END LOOP;
 IF k <> 6 THEN RAISE EXCEPTION 'snapshot_cards: only % of 6 bad requests rejected', k; END IF;
END $request$;

-- ── 사후 검사 ⑶: 모든 사용자 × 표본 id 묶음에서 cards = snapshot을 그 id로 거른 것(머리 · rows · registry 전체 칸 · 같은 순서 — 정확히).
--    묶음: 첫 행 · 끝 행 · 고르게 고른 50개 · 판정이 붙은 칸(등록 · 아는 단어 · 제외) 앞 50개 · 첫 행 + 중복 + 없는 id + 남의 id ·
--    남의 id + 없는 id만(빈 결과). 같은 트랜잭션 · 같은 데이터, 'now'만 문장마다 달라 뺀다. 학습자 행은 이 함수 안에서만 비교하고
--    밖으로 내보내지 않는다. 하나라도 다르면 RAISE → 이력까지 전체 롤백.
CREATE FUNCTION pg_temp.sc_differs(p_actor uuid, p_full jsonb, p_ids uuid[]) RETURNS boolean LANGUAGE plpgsql STABLE SET search_path = '' AS $q$
DECLARE got jsonb := public.fsrs_vocabulary_snapshot_cards(p_actor, p_ids); want_rows jsonb; want_registry jsonb;
BEGIN
 IF (got - ARRAY['now','rows','registry']) IS DISTINCT FROM (p_full - ARRAY['now','rows','registry']) OR got->>'now' IS NULL THEN RETURN true; END IF;
 SELECT coalesce(pg_catalog.jsonb_agg(r.x ORDER BY r.n), '[]'::jsonb) INTO want_rows
   FROM pg_catalog.jsonb_array_elements(p_full->'rows') WITH ORDINALITY r(x,n) WHERE (r.x->>'id')::uuid = ANY(p_ids);
 SELECT coalesce(pg_catalog.jsonb_agg(e.x ORDER BY e.n), '[]'::jsonb) INTO want_registry
   FROM pg_catalog.jsonb_array_elements(p_full->'registry') WITH ORDINALITY e(x,n) WHERE (e.x->>'cardId')::uuid = ANY(p_ids);
 RETURN got->'rows' IS DISTINCT FROM want_rows OR got->'registry' IS DISTINCT FROM want_registry;
END
$q$;
CREATE FUNCTION pg_temp.sc_mismatch(p_actor uuid) RETURNS text LANGUAGE plpgsql STABLE SET search_path = '' AS $q$
DECLARE full_snap jsonb := public.fsrs_vocabulary_snapshot(p_actor) - 'now'; ids uuid[]; n integer; other uuid; judged uuid[];
 ghost uuid := '00000000-0000-4000-8000-00000000c0de';
BEGIN
 SELECT coalesce(pg_catalog.array_agg((r.x->>'id')::uuid ORDER BY r.n), '{}') INTO ids FROM pg_catalog.jsonb_array_elements(full_snap->'rows') WITH ORDINALITY r(x,n);
 n := pg_catalog.cardinality(ids);
 SELECT v.id INTO other FROM public.user_vocabulary v WHERE v.user_id <> p_actor ORDER BY v.id LIMIT 1;
 IF n > 0 THEN
  IF pg_temp.sc_differs(p_actor, full_snap, ARRAY[ids[1]]) THEN RETURN 'first'; END IF;
  IF pg_temp.sc_differs(p_actor, full_snap, ARRAY[ids[n]]) THEN RETURN 'last'; END IF;
  IF pg_temp.sc_differs(p_actor, full_snap, ARRAY(SELECT ids[i] FROM pg_catalog.generate_series(1, n, greatest(1, ceil(n / 50.0)::integer)) i LIMIT 50))
  THEN RETURN 'spread'; END IF;
  judged := ARRAY(SELECT (e.x->>'cardId')::uuid FROM pg_catalog.jsonb_array_elements(full_snap->'registry') WITH ORDINALITY e(x,k)
    WHERE (e.x->>'enrolled')::boolean OR (e.x->>'known')::boolean OR (e.x->>'excluded')::boolean ORDER BY e.k LIMIT 50);
  IF pg_catalog.cardinality(judged) > 0 AND pg_temp.sc_differs(p_actor, full_snap, judged) THEN RETURN 'judged'; END IF;
  IF pg_temp.sc_differs(p_actor, full_snap, ARRAY[ids[1], ids[1], ghost] || CASE WHEN other IS NULL THEN '{}'::uuid[] ELSE ARRAY[other] END)
  THEN RETURN 'mixed'; END IF;
 END IF;
 IF pg_temp.sc_differs(p_actor, full_snap, ARRAY[ghost] || CASE WHEN other IS NULL THEN '{}'::uuid[] ELSE ARRAY[other] END) THEN RETURN 'foreign'; END IF;
 RETURN NULL;
END
$q$;

DO $parity$
DECLARE actors integer; bad integer; first_bad text;
BEGIN
 SELECT pg_catalog.count(*)::integer, pg_catalog.count(m.why)::integer, pg_catalog.min(m.why) INTO actors, bad, first_bad
   FROM (SELECT pg_temp.sc_mismatch(u.user_id) AS why
           FROM (SELECT DISTINCT v.user_id FROM public.user_vocabulary v WHERE EXISTS (SELECT 1 FROM auth.users a WHERE a.id = v.user_id)) u) m;
 IF bad <> 0 THEN RAISE EXCEPTION 'snapshot_cards: cards differ from snapshot for % of % actor(s) (first: %)', bad, actors, first_bad; END IF;
 RAISE NOTICE 'snapshot_cards: cards = snapshot filtered by id for all % actor(s)', actors;
END $parity$;

-- ── 캐시 갱신을 지금 실행해 본다(커밋 때 할 일과 같은 함수 — 20261023170000). 이 뒤의 DDL은 임시 객체 DROP뿐이라 캐시를 무효로 만들지 않는다.
SET CONSTRAINTS fsrs_private.contract_cache_refresh IMMEDIATE;
SET CONSTRAINTS fsrs_private.contract_cache_refresh DEFERRED;

DO $cache$
DECLARE k record;
BEGIN
 SELECT * INTO STRICT k FROM fsrs_private.contract_cache;
 IF NOT k.valid THEN RAISE EXCEPTION 'snapshot_cards: refresh did not validate the contract cache'; END IF;
 IF (SELECT s.contract_hash FROM fsrs_private.settings s) IS DISTINCT FROM k.core
    OR (SELECT s.contract_hash FROM fsrs_private.settings s) IS DISTINCT FROM fsrs_private.contract_hash_live()
 THEN RAISE EXCEPTION 'snapshot_cards: cached core differs from the pin'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
END $cache$;

DROP FUNCTION pg_temp.sc_mismatch(uuid); DROP FUNCTION pg_temp.sc_differs(uuid,jsonb,uuid[]); DROP FUNCTION pg_temp.sc_repin_core(); DROP FUNCTION pg_temp.sc_fn(text);
DROP FUNCTION pg_temp.sc_contracts();
DROP TABLE pg_temp.sc_state_before;
