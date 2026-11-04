-- PERF-SNAPSHOT-KNOWN-001 — 단어장 snapshot 셋(fsrs_vocabulary_snapshot · _light · _cards)의 「아는 단어」 판정을 같은 값 · 빠른 꼴로(2026-11-04 KST).
--   운영 실측(2026-11-04 KST, 읽기 전용): 가장 큰 학습자(단어 1,664 · 아는 단어 241 · 제외 241)에서 snapshot ≈ 350 ms · light ≈ 290–330 ms,
--   그중 ≈ 210 ms가 아는 단어 LEFT JOIN 둘(kw k1 · kw k2)이다. EXPLAIN ANALYZE: 플래너가 k2를 언어(lang) 하나로만 merge join하고
--   `k2.w = normalize(btrim(v.base_form),NFC)`를 Join Filter로 짝마다 다시 본다(「Rows Removed by Join Filter: 376144」 ≈ 225 ms).
--   같은 운영 데이터에서 아래 꼴로 바꾼 질의는 결과가 같고(두 학습자 id + is_known 해시 동일) 203.8 ms → 4.2 ms였다.
-- 적용 경로 = PR이 main에 병합되면 supabase-migrations.yml(db push)이 운영에 바로 적용한다 → 병합 승인 = 운영 적용 승인
--   (오너 지속 실행 승인 2026-10-02 KST 범위 — 동작 무변경 · 검토한 SQL · 복원 경로).
-- 실행 형태: db push는 파일 전체 + 이력 INSERT를 한 파이프라인(암묵 트랜잭션 하나)으로 보낸다 → BEGIN/COMMIT 없음, SET LOCAL 실효를
--   첫 DO가 확인. 어느 검사든 RAISE하면 이력까지 함께 롤백된다. 실행 주체 postgres, 앱 사용자(JWT)를 만들지 않는다.
--
-- 바꾸는 것(세 본문에서 같은 한 군데 — 표 · 정책 · 인덱스 · 권한 · 속성 · 그 밖의 본문 글자는 그대로):
--   x의 `LEFT JOIN kw k1 … LEFT JOIN kw k2 …` 두 줄과 `(k1.w IS NOT NULL OR k2.w IS NOT NULL) AS is_known` →
--   행마다 키를 먼저 계산하는 CTE vv(id · 언어 코드 lc · NFC(btrim(word_text)) nw · NFC(btrim(base_form)) nb — 옛 조인 조건과 같은 식)와
--   `EXISTS(kw.lang=vv.lc AND kw.w=vv.nw) OR EXISTS(kw.lang=vv.lc AND kw.w=vv.nb)`, x에는 `JOIN vv ON vv.id=v.id` 한 줄.
--   왜 같은 값인가: kw는 (lang, w) DISTINCT라 k1 · k2는 한 행에 많아야 한 짝 → 옛 LEFT JOIN은 행을 늘리지 않았고, 「짝이 있다」 =
--   EXISTS다(짝의 w는 비교한 값과 같아 NULL이 아니다 · NULL 키는 옛것도 새것도 짝이 없다). vv는 v.user_id=p_actor 행 전부의 id(기본 키)로
--   x와 한 번씩만 이어진다(행을 늘리거나 빼지 않는다). 순서 · 머리 · 칸 · 오류 · 계정 검사 · 제외 판정(exid · exw)은 글자 그대로다.
--   exw 조인(language + 정규화 단어)도 같은 꼴인지 PGlite 재현에서 봤다 — 두 키 hash join이라 짝마다 다시 보는 필터가 없다 → 그대로 둔다.
--   본문 md5(사전 = 20261101120000_fsrs_card_kinds 뒤 운영 본문, 사후 = 이 파일):
--     public.fsrs_vocabulary_snapshot(uuid)                    32647a452dc4c8a8c5449ab6a93c4eb9 → 19cbdadfc0b0be3fb86efd86b7542ade
--     public.fsrs_vocabulary_snapshot_light(uuid,text,boolean) 32401c0c1e32163215c7edbbf692c7ba → a66fb7f3098a9ec8c862292c6139b5ce
--     public.fsrs_vocabulary_snapshot_cards(uuid,uuid[])       d33e1c2c65571c80bc4109fc0c5f0dae → 5dc13e8a785a8ac5e298d725dad2a0ba
--   세 본문의 판정 조각(WITH kw … x의 WHERE 앞)은 서로 바이트 그대로다(계약 src/lib/__tests__/snapshotKnownJoin.test.js — 옛 본문에서 이 한 군데만
--   바꿨는지도 원문 대조).
-- 재게시(§4.9-1): 세 함수 = public.fsrs_* → core. snapshot은 manual · admission의 고정 목록에도 든다 → 셋을 _live() 값으로(바뀔 때만, 정확히 1행).
--   activity profile · 한국어 capability 지문은 범위 밖 → 그대로여야 한다(사후 검사). 운영 해시 값은 이 파일에 박지 않는다:
--   사전 = 「네 게시값 = 실측(캐시 · _live 둘 다) · 한국어 게시 = 실측」, 사후 = 「재계산 뒤 같음」. 고정하는 md5는 본문 모양뿐이다 —
--   위 세 본문 md5와 capability 템플릿 4a497440… · 지문 SELECT 2e57290c…(20261104060000과 같은 복사).
-- 사전 검사가 받는 상태: ① 세 본문 = 옛 md5 · 네 계약 일치 · 한국어 ready ② 이 파일을 이미 적용(새 md5 — no-op, CREATE OR REPLACE가 같은
--   본문을 다시 쓰고 재게시는 0행). 섞였거나 다른 본문이면 RAISE.
-- 사후 검사(같은 트랜잭션): 네 게시값 = 캐시 = _live · 처음 적용이면 core · manual · admission이 움직이고 profile 불변 · 재실행이면 아무것도 불변 ·
--   한국어 ready · capability 본문 · 속성 불변 · 세 함수 속성(oid · 소유자 · SECURITY DEFINER · search_path · STABLE · 권한) 불변 · 그 밖의 학습 함수
--   전부 불변 · 단어나 카드가 있는 사용자 전원의 출력이 바꾸기 전과 같다: snapshot(now 제외) · light(언어 NULL + 그 사람의 모든 언어 × 요약/전체) ·
--   cards(앞 50개 id · 아는 단어/제외 행 50개 id) — 학습자 출력은 임시 테이블에만(ON COMMIT DROP), 밖으로 내보내지 않는다.
--   + registry 동일성 계약(PERF-SNAPSHOT P4 — registrySnapshotParity.test.js): 전 사용자 snapshot 동일 · 모든 카드 registry_entry = snapshot.registry.
-- 복원(쓸 일 없음 — 출력이 같다): 세 함수를 20261101120000_fsrs_card_kinds.sql의 세 CREATE OR REPLACE 원문(위 옛 md5)으로 다시 만들고 같은 트랜잭션에서
--   이 파일의 재게시(core · manual · admission을 _live 값으로)를 되풀이한다. 사후 = 네 계약 동치 · 한국어 ready · 출력 동일
--   (supabase/tests/snapshot-known-join.mjs가 복원 · 재적용까지 확인한다).
SET LOCAL search_path = '';
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '180s';

-- 실행기 확인: SET LOCAL이 이 트랜잭션에 실제로 걸렸어야 한다(db push 파이프라인 = 암묵 트랜잭션 하나).
DO $runner$
BEGIN
 IF pg_catalog.current_setting('search_path') NOT IN ('', '""') OR pg_catalog.current_setting('lock_timeout') <> '5s'
    OR pg_catalog.current_setting('statement_timeout') <> '3min'
 THEN RAISE EXCEPTION 'snapshot_known: SET LOCAL not in effect (search_path=%, lock_timeout=%, statement_timeout=%)',
   pg_catalog.current_setting('search_path'), pg_catalog.current_setting('lock_timeout'), pg_catalog.current_setting('statement_timeout');
 END IF;
END $runner$;

-- ── 공통 도구(pg_temp, 이 세션 전용 · 끝에서 DROP).
-- 학습 계약 넷 — 게시값 = 원래 이름(캐시 또는 그 자리 계산) = _live(언제나 그 자리 계산), 그리고 게시값 자체.
CREATE FUNCTION pg_temp.skj_contracts() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object(
  'ok', s.contract_hash IS NOT DISTINCT FROM fsrs_private.contract_hash()
    AND m.contract_hash IS NOT DISTINCT FROM fsrs_private.manual_contract_hash()
    AND a.contract_hash IS NOT DISTINCT FROM fsrs_private.admission_contract_hash()
    AND t.profile_contract_hash IS NOT DISTINCT FROM fsrs_private.activity_profile_hash(),
  'live_ok', s.contract_hash IS NOT DISTINCT FROM fsrs_private.contract_hash_live()
    AND m.contract_hash IS NOT DISTINCT FROM fsrs_private.manual_contract_hash_live()
    AND a.contract_hash IS NOT DISTINCT FROM fsrs_private.admission_contract_hash_live()
    AND t.profile_contract_hash IS NOT DISTINCT FROM fsrs_private.activity_profile_hash_live(),
  'core', s.contract_hash, 'manual', m.contract_hash, 'admission', a.contract_hash, 'profile', t.profile_contract_hash)
 FROM fsrs_private.settings s, fsrs_private.manual_save_settings m, fsrs_private.admission_settings a, fsrs_private.activity_settings t
$q$;

-- 한국어 capability 지문 = learning_language_capabilities() 본문의 그 SELECT를 바이트 그대로(md5 2e57290ce85b8f034f7f304dfdea3ad9 — 20261104060000과 같은 복사).
-- 같은지 아래 skj_cap()이 운영 본문에서 다시 확인한다(fingerprint_ok). 이 파일은 그 범위를 건드리지 않는다 — 값이 그대로여야 한다.
CREATE FUNCTION pg_temp.skj_korean_live_hash() RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $q$
WITH RECURSIVE relevant_roles(oid) AS (
 SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN ('authenticated','anon','service_role')
 UNION SELECT m.roleid FROM pg_catalog.pg_auth_members m JOIN relevant_roles r ON r.oid=m.member
), tables AS (
 SELECT c.* FROM pg_catalog.pg_class c WHERE c.relnamespace='public'::pg_catalog.regnamespace
 AND c.relname IN ('user_vocabulary','vocabulary_contexts','user_known_words','vocabulary_exclusions','review_events','reading_materials','uploaded_pdfs','active_vocabulary','vocabulary_with_exclusions')
), objects AS (
 SELECT 'relation:'||c.relname AS key,pg_catalog.jsonb_build_array(c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.relacl,c.reloptions,c.relowner) AS val FROM tables c
 UNION ALL SELECT 'role:'||r.rolname,pg_catalog.jsonb_build_array(r.rolsuper,r.rolbypassrls,r.rolinherit) FROM pg_catalog.pg_roles r JOIN relevant_roles rr ON rr.oid=r.oid
 UNION ALL SELECT 'membership:'||m.member::text||':'||m.roleid::text,pg_catalog.to_jsonb(m) FROM pg_catalog.pg_auth_members m JOIN relevant_roles r ON r.oid=m.member
 UNION ALL SELECT 'schema:'||n.nspname,pg_catalog.jsonb_build_array(n.nspacl,n.nspowner) FROM pg_catalog.pg_namespace n WHERE n.nspname IN ('public','auth')
 UNION ALL SELECT 'constraint:'||c.relname||':'||x.conname,pg_catalog.to_jsonb(pg_catalog.pg_get_constraintdef(x.oid)) FROM pg_catalog.pg_constraint x JOIN tables c ON c.oid=x.conrelid
 UNION ALL SELECT 'index:'||c.relname||':'||i.indexrelid::text,pg_catalog.jsonb_build_array(pg_catalog.pg_get_indexdef(i.indexrelid),i.indisvalid,i.indisready) FROM pg_catalog.pg_index i JOIN tables c ON c.oid=i.indrelid
 UNION ALL SELECT 'policy:'||c.relname||':'||p.polname,pg_catalog.jsonb_build_array(p.polcmd,p.polpermissive,p.polroles,pg_catalog.pg_get_expr(p.polqual,p.polrelid),pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid)) FROM pg_catalog.pg_policy p JOIN tables c ON c.oid=p.polrelid
 UNION ALL SELECT 'trigger:'||c.relname||':'||t.tgname,pg_catalog.jsonb_build_array(pg_catalog.pg_get_triggerdef(t.oid),t.tgenabled) FROM pg_catalog.pg_trigger t JOIN tables c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal
 UNION ALL SELECT 'view:'||c.relname,pg_catalog.to_jsonb(pg_catalog.pg_get_viewdef(c.oid,true)) FROM tables c WHERE c.relkind='v'
 UNION ALL SELECT 'column:'||c.relname||':'||a.attname,pg_catalog.jsonb_build_array(a.atttypid,a.atttypmod,a.attnotnull,a.attacl,a.attidentity,a.attgenerated,pg_catalog.pg_get_expr(d.adbin,d.adrelid)) FROM pg_catalog.pg_attribute a JOIN tables c ON c.oid=a.attrelid LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attnum>0 AND NOT a.attisdropped
 UNION ALL SELECT 'function:'||p.oid::text,pg_catalog.jsonb_build_array(pg_catalog.pg_get_functiondef(p.oid),p.proacl,p.proowner) FROM pg_catalog.pg_proc p WHERE p.oid IN (
 SELECT pg_catalog.to_regprocedure(f.signature) FROM (VALUES ('public.save_vocabulary_context(jsonb,jsonb,uuid,text)'),('public.set_vocabulary_exclusion(text,text,uuid,boolean,uuid)'),('public.lock_vocabulary_exclusion_owner()'),('public.preserve_deleted_vocabulary_exclusion()'),('public.guard_excluded_vocabulary()'),('public.guard_excluded_review_event()'),('public.sync_vocabulary_exclusion_identity()'),('public.sync_known_word_review_exclusion()'),('public.guard_known_word_review_exclusion()')) f(signature)
 UNION SELECT dependency.oid FROM (VALUES ('public.save_vocabulary_context(jsonb,jsonb,uuid,text)'),('public.save_vocabulary_context_for(uuid,jsonb,jsonb,uuid,text)'),('public.viewer_replace_analysis(bigint,text,jsonb,text,jsonb,uuid)'),('public.viewer_undo_vocabulary_save(uuid,jsonb,uuid[])'),('public.classroom_save_vocabulary(uuid,bigint,integer,bigint,text,jsonb,jsonb,jsonb,jsonb,uuid,text)'),('library_private.protect_source_delete()'),('public.guard_source_passage_write()'),('public.library_book_preserve_metadata()'),('public.validate_source_passage()'),('public.protect_composer_source()')) f(signature)
 JOIN pg_catalog.pg_proc dependency ON dependency.oid::pg_catalog.regprocedure::text=f.signature
 UNION SELECT t.tgfoid FROM pg_catalog.pg_trigger t JOIN tables c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal)
) SELECT pg_catalog.md5(pg_catalog.jsonb_object_agg(key,val ORDER BY key)::text) FROM objects
$q$;

-- capability 상태: 본문 템플릿(고정값 칸만 비운 md5) · 지문 SELECT 동일성 · 고정값 · 실제값 · 본문 md5 · 속성(oid/소유자/ACL/…).
CREATE FUNCTION pg_temp.skj_cap() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object(
  'template_ok', pg_catalog.md5(pg_catalog.regexp_replace(p.prosrc, 'ready:=live_hash= ''([0-9a-f]{32})''', 'ready:=live_hash= ''<hash>''')) = '4a497440fb53bc1a27c1975875c7d737',
  'fingerprint_ok', pg_catalog.md5(pg_catalog.substring(p.prosrc, '(WITH RECURSIVE .*FROM objects) INTO live_hash;')) = '2e57290ce85b8f034f7f304dfdea3ad9'
    AND pg_catalog.md5(pg_catalog.btrim(t.prosrc, E'\n')) = '2e57290ce85b8f034f7f304dfdea3ad9',
  'pinned', pg_catalog.substring(p.prosrc, 'ready:=live_hash= ''([0-9a-f]{32})'''),
  'live', pg_temp.skj_korean_live_hash(),
  'body', pg_catalog.md5(p.prosrc),
  'attrs', pg_catalog.jsonb_build_array(p.oid, p.proowner, p.proacl, p.prosecdef, p.proconfig, p.provolatile, p.proparallel,
           p.proleakproof, p.proisstrict, p.prolang, p.prorettype, p.proretset, p.pronargs, p.procost))
 FROM pg_catalog.pg_proc p, pg_catalog.pg_proc t
 WHERE p.oid = pg_catalog.to_regprocedure('public.learning_language_capabilities()')
   AND t.oid = pg_catalog.to_regprocedure('pg_temp.skj_korean_live_hash()')
$q$;
-- 한국어 ready = 함수 본문이 검토한 모양이고 게시 = 실제(capability 함수의 ready 식과 같다 — 함수 자체는 로그인 사용자만 부른다).
CREATE FUNCTION pg_temp.skj_korean_ready() RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT (c->>'template_ok')::boolean AND (c->>'fingerprint_ok')::boolean AND c->>'pinned' = c->>'live' FROM (SELECT pg_temp.skj_cap() AS c) x
$q$;

-- 이 파일이 바꾸는 세 함수의 본문 md5 · 본문 밖 속성(oid · 소유자 · 권한 · 정의자 · 설정 · 변동성 …) — CREATE OR REPLACE 앞뒤가 같아야 한다.
CREATE FUNCTION pg_temp.skj_md5s() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_object_agg(g.sig, (SELECT pg_catalog.md5(p.prosrc) FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure(g.sig)))
 FROM pg_catalog.unnest(ARRAY['public.fsrs_vocabulary_snapshot(uuid)', 'public.fsrs_vocabulary_snapshot_light(uuid,text,boolean)', 'public.fsrs_vocabulary_snapshot_cards(uuid,uuid[])']) g(sig)
$q$;
CREATE FUNCTION pg_temp.skj_attrs() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_object_agg(p.oid::pg_catalog.regprocedure::text, pg_catalog.jsonb_build_array(p.oid, p.proowner, p.prosecdef, p.proconfig,
   p.provolatile, p.proparallel, p.proleakproof, p.proisstrict, p.prolang, p.prorettype, p.proretset, p.proacl::text, p.pronargdefaults,
   pg_catalog.pg_get_function_arguments(p.oid), p.procost))
 FROM pg_catalog.pg_proc p WHERE p.oid = ANY (ARRAY['public.fsrs_vocabulary_snapshot(uuid)', 'public.fsrs_vocabulary_snapshot_light(uuid,text,boolean)', 'public.fsrs_vocabulary_snapshot_cards(uuid,uuid[])']::pg_catalog.regprocedure[])
$q$;
-- 손대지 않는 학습 함수 전부(fsrs_private · public fsrs_% · learning_% 에서 위 셋을 뺀 것)의 본문 md5 + 속성.
CREATE FUNCTION pg_temp.skj_others() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_object_agg(p.oid::pg_catalog.regprocedure::text, pg_catalog.jsonb_build_array(pg_catalog.md5(p.prosrc), p.proowner,
   p.prosecdef, p.proconfig, p.provolatile, p.proparallel, p.proleakproof, p.proisstrict, p.prolang, p.prorettype, p.proretset, p.proacl::text))
 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
 WHERE (n.nspname = 'fsrs_private' OR (n.nspname = 'public' AND (p.proname LIKE 'fsrs\_%' ESCAPE '\' OR p.proname LIKE 'learning\_%' ESCAPE '\')))
  AND p.oid::pg_catalog.regprocedure::text <> ALL (ARRAY['public.fsrs_vocabulary_snapshot(uuid)', 'public.fsrs_vocabulary_snapshot_light(uuid,text,boolean)', 'public.fsrs_vocabulary_snapshot_cards(uuid,uuid[])'])
$q$;
-- 한 학습자의 출력 셋(now 제외): snapshot · light(언어 NULL + p_langs × 요약 false/true) · cards(p_batches의 id 묶음마다).
-- 같은 인자로 바꾸기 전 · 뒤에 부른다 — 학습자 행은 이 세션의 임시 테이블에만 남는다.
CREATE FUNCTION pg_temp.skj_outputs(p_actor uuid, p_langs text[], p_batches jsonb) RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object(
  'snapshot', public.fsrs_vocabulary_snapshot(p_actor) - 'now',
  'light', (SELECT pg_catalog.jsonb_object_agg(pg_catalog.jsonb_build_array(l.lang, s.summary)::text, public.fsrs_vocabulary_snapshot_light(p_actor, l.lang, s.summary) - 'now')
            FROM pg_catalog.unnest(pg_catalog.array_prepend(NULL::text, p_langs)) l(lang) CROSS JOIN pg_catalog.unnest(ARRAY[false, true]) s(summary)),
  'cards', (SELECT coalesce(pg_catalog.jsonb_agg(public.fsrs_vocabulary_snapshot_cards(p_actor, ARRAY(SELECT pg_catalog.jsonb_array_elements_text(b.x)::uuid)) - 'now' ORDER BY b.n), '[]'::jsonb)
            FROM pg_catalog.jsonb_array_elements(p_batches) WITH ORDINALITY b(x, n)))
$q$;

DO $pre$
DECLARE c jsonb := pg_temp.skj_contracts(); k jsonb := pg_temp.skj_cap(); f jsonb := pg_temp.skj_md5s();
BEGIN
 IF NOT ((k->>'template_ok')::boolean AND (k->>'fingerprint_ok')::boolean) THEN RAISE EXCEPTION 'snapshot_known: capability body drift %', k - 'attrs'; END IF;
 IF NOT (c->>'ok')::boolean OR NOT (c->>'live_ok')::boolean THEN RAISE EXCEPTION 'snapshot_known: learning contracts already drifted %', c; END IF;
 IF pg_temp.skj_korean_ready() IS DISTINCT FROM true THEN RAISE EXCEPTION 'snapshot_known: Korean capability not ready before change (pinned %, live %)', k->>'pinned', k->>'live'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
 IF f->>'public.fsrs_vocabulary_snapshot(uuid)' = '32647a452dc4c8a8c5449ab6a93c4eb9'
    AND f->>'public.fsrs_vocabulary_snapshot_light(uuid,text,boolean)' = '32401c0c1e32163215c7edbbf692c7ba'
    AND f->>'public.fsrs_vocabulary_snapshot_cards(uuid,uuid[])' = 'd33e1c2c65571c80bc4109fc0c5f0dae' THEN
  RAISE NOTICE 'snapshot_known: needs change (three bodies are the 20261101120000 card-kinds bodies)';
 ELSIF f->>'public.fsrs_vocabulary_snapshot(uuid)' = '19cbdadfc0b0be3fb86efd86b7542ade'
    AND f->>'public.fsrs_vocabulary_snapshot_light(uuid,text,boolean)' = 'a66fb7f3098a9ec8c862292c6139b5ce'
    AND f->>'public.fsrs_vocabulary_snapshot_cards(uuid,uuid[])' = '5dc13e8a785a8ac5e298d725dad2a0ba' THEN
  RAISE NOTICE 'snapshot_known: already applied (three bodies rewritten, four contracts and Korean consistent) — no-op';
 ELSE
  RAISE EXCEPTION 'snapshot_known: unreviewed function bodies %', f;
 END IF;
END $pre$;

-- ── 바꾸기 전 출력과 상태(같은 트랜잭션 안). 학습자 출력은 임시 테이블에만 있고(ON COMMIT DROP) 밖으로 내보내지 않는다.
--    대상 = 단어가 있거나 카드가 있는 사용자 전원. light 언어 = NULL + 그 사람의 모든 언어. cards 묶음 = 앞 50개 id ·
--    바꾸기 전 snapshot이 아는 단어 또는 제외로 판정한 행의 앞 50개 id(있을 때만 — 이 파일이 바꾸는 판정을 그 카드에 직접 묻는다).
CREATE TEMP TABLE skj_actors ON COMMIT DROP AS
 SELECT u.user_id AS actor,
  coalesce((SELECT pg_catalog.array_agg(DISTINCT v.language ORDER BY v.language) FROM public.user_vocabulary v WHERE v.user_id = u.user_id AND v.language IS NOT NULL), '{}'::text[]) AS langs,
  (SELECT coalesce(pg_catalog.jsonb_agg(b.ids ORDER BY b.n), '[]'::jsonb) FROM (
    SELECT 1 AS n, (SELECT pg_catalog.jsonb_agg(w.id ORDER BY w.id) FROM (SELECT v.id FROM public.user_vocabulary v WHERE v.user_id = u.user_id ORDER BY v.id LIMIT 50) w) AS ids
    UNION ALL
    SELECT 2, (SELECT pg_catalog.jsonb_agg(w.id ORDER BY w.id) FROM (SELECT (e.x->>'cardId')::uuid AS id
      FROM pg_catalog.jsonb_array_elements(public.fsrs_vocabulary_snapshot(u.user_id)->'registry') e(x)
      WHERE (e.x->>'known')::boolean OR (e.x->>'excluded')::boolean ORDER BY 1 LIMIT 50) w)) b WHERE b.ids IS NOT NULL) AS batches
 FROM (SELECT f.user_id FROM public.fsrs_cards f UNION SELECT v.user_id FROM public.user_vocabulary v) u
 WHERE EXISTS (SELECT 1 FROM auth.users a WHERE a.id = u.user_id);
CREATE TEMP TABLE skj_output_before ON COMMIT DROP AS
 SELECT a.actor, a.langs, a.batches, pg_temp.skj_outputs(a.actor, a.langs, a.batches) AS body FROM pg_temp.skj_actors a;
-- registry 동일성 계약(PERF-SNAPSHOT P4 — src/lib/__tests__/registrySnapshotParity.test.js): 이 파일은 snapshot 집합 계산을 다시 정의한다 →
-- 바꾸기 전 전 사용자 snapshot 출력을 같은 문장으로 담고, 끝에서 출력 · 모든 카드의 두 정의가 같은지 본다. 앞뒤 시각은 알림용(전 학습자 snapshot 한 바퀴).
CREATE TEMP TABLE skj_clock ON COMMIT DROP AS SELECT 'before_start'::text AS mark, pg_catalog.clock_timestamp() AS at;
CREATE TEMP TABLE perf_snapshot_before ON COMMIT DROP AS
 SELECT u.user_id AS actor, public.fsrs_vocabulary_snapshot(u.user_id) - 'now' AS body
 FROM (SELECT DISTINCT v.user_id FROM public.user_vocabulary v WHERE EXISTS (SELECT 1 FROM auth.users a WHERE a.id = v.user_id)) u;
INSERT INTO pg_temp.skj_clock VALUES ('before_end', pg_catalog.clock_timestamp());
CREATE TEMP TABLE skj_state_before ON COMMIT DROP AS
 SELECT pg_temp.skj_contracts() AS contracts, pg_temp.skj_cap() AS cap, pg_temp.skj_attrs() AS attrs, pg_temp.skj_others() AS others,
  pg_temp.skj_md5s()->>'public.fsrs_vocabulary_snapshot(uuid)' = '32647a452dc4c8a8c5449ab6a93c4eb9' AS needs_change,
  (SELECT pg_catalog.count(*) FROM pg_temp.skj_output_before) AS actors;

-- ── 변경: 세 본문(아는 단어 판정 한 군데 — 위 머리 주석). 처음이면 새 본문, 재실행이면 같은 본문을 다시 쓴다.
-- public.fsrs_vocabulary_snapshot(uuid): 본문 md5 32647a452dc4c8a8c5449ab6a93c4eb9 → 19cbdadfc0b0be3fb86efd86b7542ade
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
 IF EXISTS(SELECT 1 FROM public.fsrs_cards f LEFT JOIN public.user_vocabulary v ON v.id=f.vocabulary_id WHERE f.user_id=p_actor AND (v.id IS NULL OR v.user_id IS DISTINCT FROM p_actor)) THEN RAISE EXCEPTION 'fsrs_snapshot_inconsistent' USING ERRCODE='55000'; END IF;
 SELECT * INTO STRICT s FROM fsrs_private.settings;
 -- PERF-SNAPSHOT P4: registry flags as one set operation (hash joins) instead of fsrs_private.vocabulary_registry_entry per row.
 -- Same values: known = any known word of this actor whose (lang, NFC(btrim)) equals the row's NFC(btrim(word_text)) or NFC(btrim(base_form));
 -- excluded = fsrs_private.blocked(actor, card) = known OR an exclusion of this actor by card id, by retired card id, or by
 -- (language, NFC(btrim(coalesce(nullif(base_form,''),word_text)))). registry_entry's per-card guard is the set check above.
 IF EXISTS(SELECT 1 FROM public.fsrs_cards f JOIN public.user_vocabulary v ON v.id=f.vocabulary_id WHERE v.user_id=p_actor AND f.user_id<>p_actor)
 THEN RAISE EXCEPTION 'fsrs_snapshot_inconsistent' USING ERRCODE='55000'; END IF;
 -- CARD-TYPES-001 stage 2: a word row joins its recognition card only (vocabulary_id + kind) — one row per word; production/listening cards are not word rows.
 WITH kw AS (SELECT DISTINCT k.lang, normalize(btrim(k.word_text),NFC) AS w FROM public.user_known_words k WHERE k.user_id=p_actor),
 exid AS (SELECT e.vocabulary_id AS id FROM public.vocabulary_exclusions e WHERE e.user_id=p_actor AND e.vocabulary_id IS NOT NULL
   UNION SELECT r.id FROM public.vocabulary_exclusions e CROSS JOIN LATERAL unnest(e.retired_vocabulary_ids) AS r(id) WHERE e.user_id=p_actor AND r.id IS NOT NULL),
 exw AS (SELECT DISTINCT e.language, e.word_text FROM public.vocabulary_exclusions e WHERE e.user_id=p_actor),
 -- PERF-SNAPSHOT-KNOWN-001: per-row known-word keys (the old join keys, same expressions). kw is DISTINCT on (lang,w), so the old LEFT JOINs
 -- k1/k2 matched at most one row each — EXISTS gives the same is_known without a lang-only join that rechecks the word key per pair.
 vv AS (SELECT v.id, CASE v.language WHEN 'Korean' THEN 'ko' WHEN 'Japanese' THEN 'ja' WHEN 'Chinese' THEN 'zh' WHEN 'English' THEN 'en' WHEN 'French' THEN 'fr' END AS lc,
   normalize(btrim(v.word_text),NFC) AS nw, normalize(btrim(v.base_form),NFC) AS nb FROM public.user_vocabulary v WHERE v.user_id=p_actor),
 x AS (
  SELECT v AS vrow, v.id, f.card_id AS fid, f.card,
   (EXISTS(SELECT 1 FROM kw WHERE kw.lang=vv.lc AND kw.w=vv.nw) OR EXISTS(SELECT 1 FROM kw WHERE kw.lang=vv.lc AND kw.w=vv.nb)) AS is_known,
   (exid.id IS NOT NULL OR exw.language IS NOT NULL) AS is_excluded_only,
   CASE WHEN f.card_id IS NOT NULL THEN fsrs_private.next_question_at(p_actor,f.card_id) END AS wake_at
  FROM public.user_vocabulary v
  LEFT JOIN public.fsrs_cards f ON f.vocabulary_id=v.id AND f.kind='recognition' AND f.user_id=p_actor
  JOIN vv ON vv.id=v.id
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
    'firstQuestionAt',CASE WHEN x.fid IS NOT NULL THEN (SELECT fsrs_private.iso_milliseconds(r.question_at) FROM public.fsrs_new_receipts r WHERE r.card_id=x.fid AND r.user_id=p_actor) END)
   ORDER BY x.id),'[]'::jsonb))
 INTO result FROM x;
 RETURN result;
END $function$;

-- public.fsrs_vocabulary_snapshot_light(uuid,text,boolean): 본문 md5 32401c0c1e32163215c7edbbf692c7ba → a66fb7f3098a9ec8c862292c6139b5ce
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
 IF EXISTS(SELECT 1 FROM public.fsrs_cards f LEFT JOIN public.user_vocabulary v ON v.id=f.vocabulary_id WHERE f.user_id=p_actor AND (v.id IS NULL OR v.user_id IS DISTINCT FROM p_actor)) THEN RAISE EXCEPTION 'fsrs_snapshot_inconsistent' USING ERRCODE='55000'; END IF;
 SELECT * INTO STRICT s FROM fsrs_private.settings;
 -- SNAPSHOT-LIGHT-001: the account checks above and the WITH below are fsrs_vocabulary_snapshot's, byte for byte (P4 set flags);
 -- only the language filter on x, the summary row shape and the omission of default registry entries differ.
 IF EXISTS(SELECT 1 FROM public.fsrs_cards f JOIN public.user_vocabulary v ON v.id=f.vocabulary_id WHERE v.user_id=p_actor AND f.user_id<>p_actor)
 THEN RAISE EXCEPTION 'fsrs_snapshot_inconsistent' USING ERRCODE='55000'; END IF;
 -- CARD-TYPES-001 stage 2: a word row joins its recognition card only (vocabulary_id + kind) — one row per word; production/listening cards are not word rows.
 WITH kw AS (SELECT DISTINCT k.lang, normalize(btrim(k.word_text),NFC) AS w FROM public.user_known_words k WHERE k.user_id=p_actor),
 exid AS (SELECT e.vocabulary_id AS id FROM public.vocabulary_exclusions e WHERE e.user_id=p_actor AND e.vocabulary_id IS NOT NULL
   UNION SELECT r.id FROM public.vocabulary_exclusions e CROSS JOIN LATERAL unnest(e.retired_vocabulary_ids) AS r(id) WHERE e.user_id=p_actor AND r.id IS NOT NULL),
 exw AS (SELECT DISTINCT e.language, e.word_text FROM public.vocabulary_exclusions e WHERE e.user_id=p_actor),
 -- PERF-SNAPSHOT-KNOWN-001: per-row known-word keys (the old join keys, same expressions). kw is DISTINCT on (lang,w), so the old LEFT JOINs
 -- k1/k2 matched at most one row each — EXISTS gives the same is_known without a lang-only join that rechecks the word key per pair.
 vv AS (SELECT v.id, CASE v.language WHEN 'Korean' THEN 'ko' WHEN 'Japanese' THEN 'ja' WHEN 'Chinese' THEN 'zh' WHEN 'English' THEN 'en' WHEN 'French' THEN 'fr' END AS lc,
   normalize(btrim(v.word_text),NFC) AS nw, normalize(btrim(v.base_form),NFC) AS nb FROM public.user_vocabulary v WHERE v.user_id=p_actor),
 x AS (
  SELECT v AS vrow, v.id, f.card_id AS fid, f.card,
   (EXISTS(SELECT 1 FROM kw WHERE kw.lang=vv.lc AND kw.w=vv.nw) OR EXISTS(SELECT 1 FROM kw WHERE kw.lang=vv.lc AND kw.w=vv.nb)) AS is_known,
   (exid.id IS NOT NULL OR exw.language IS NOT NULL) AS is_excluded_only,
   CASE WHEN f.card_id IS NOT NULL THEN fsrs_private.next_question_at(p_actor,f.card_id) END AS wake_at
  FROM public.user_vocabulary v
  LEFT JOIN public.fsrs_cards f ON f.vocabulary_id=v.id AND f.kind='recognition' AND f.user_id=p_actor
  JOIN vv ON vv.id=v.id
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
    'firstQuestionAt',CASE WHEN x.fid IS NOT NULL THEN (SELECT fsrs_private.iso_milliseconds(r.question_at) FROM public.fsrs_new_receipts r WHERE r.card_id=x.fid AND r.user_id=p_actor) END)
   ORDER BY x.id) FILTER (WHERE x.fid IS NOT NULL OR x.is_known OR x.is_excluded_only),'[]'::jsonb))
 INTO result FROM x;
 RETURN result;
END $function$;

-- public.fsrs_vocabulary_snapshot_cards(uuid,uuid[]): 본문 md5 d33e1c2c65571c80bc4109fc0c5f0dae → 5dc13e8a785a8ac5e298d725dad2a0ba
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
 IF EXISTS(SELECT 1 FROM public.fsrs_cards f LEFT JOIN public.user_vocabulary v ON v.id=f.vocabulary_id WHERE f.user_id=p_actor AND (v.id IS NULL OR v.user_id IS DISTINCT FROM p_actor)) THEN RAISE EXCEPTION 'fsrs_snapshot_inconsistent' USING ERRCODE='55000'; END IF;
 SELECT * INTO STRICT s FROM fsrs_private.settings;
 -- SNAPSHOT-CARDS-001: the account checks above and the WITH below are fsrs_vocabulary_snapshot's, byte for byte (P4 set flags);
 -- only the p_ids request check and the id filter on x differ. The account checks stay actor-wide (not narrowed to p_ids).
 IF EXISTS(SELECT 1 FROM public.fsrs_cards f JOIN public.user_vocabulary v ON v.id=f.vocabulary_id WHERE v.user_id=p_actor AND f.user_id<>p_actor)
 THEN RAISE EXCEPTION 'fsrs_snapshot_inconsistent' USING ERRCODE='55000'; END IF;
 -- CARD-TYPES-001 stage 2: a word row joins its recognition card only (vocabulary_id + kind) — one row per word; production/listening cards are not word rows.
 WITH kw AS (SELECT DISTINCT k.lang, normalize(btrim(k.word_text),NFC) AS w FROM public.user_known_words k WHERE k.user_id=p_actor),
 exid AS (SELECT e.vocabulary_id AS id FROM public.vocabulary_exclusions e WHERE e.user_id=p_actor AND e.vocabulary_id IS NOT NULL
   UNION SELECT r.id FROM public.vocabulary_exclusions e CROSS JOIN LATERAL unnest(e.retired_vocabulary_ids) AS r(id) WHERE e.user_id=p_actor AND r.id IS NOT NULL),
 exw AS (SELECT DISTINCT e.language, e.word_text FROM public.vocabulary_exclusions e WHERE e.user_id=p_actor),
 -- PERF-SNAPSHOT-KNOWN-001: per-row known-word keys (the old join keys, same expressions). kw is DISTINCT on (lang,w), so the old LEFT JOINs
 -- k1/k2 matched at most one row each — EXISTS gives the same is_known without a lang-only join that rechecks the word key per pair.
 vv AS (SELECT v.id, CASE v.language WHEN 'Korean' THEN 'ko' WHEN 'Japanese' THEN 'ja' WHEN 'Chinese' THEN 'zh' WHEN 'English' THEN 'en' WHEN 'French' THEN 'fr' END AS lc,
   normalize(btrim(v.word_text),NFC) AS nw, normalize(btrim(v.base_form),NFC) AS nb FROM public.user_vocabulary v WHERE v.user_id=p_actor),
 x AS (
  SELECT v AS vrow, v.id, f.card_id AS fid, f.card,
   (EXISTS(SELECT 1 FROM kw WHERE kw.lang=vv.lc AND kw.w=vv.nw) OR EXISTS(SELECT 1 FROM kw WHERE kw.lang=vv.lc AND kw.w=vv.nb)) AS is_known,
   (exid.id IS NOT NULL OR exw.language IS NOT NULL) AS is_excluded_only,
   CASE WHEN f.card_id IS NOT NULL THEN fsrs_private.next_question_at(p_actor,f.card_id) END AS wake_at
  FROM public.user_vocabulary v
  LEFT JOIN public.fsrs_cards f ON f.vocabulary_id=v.id AND f.kind='recognition' AND f.user_id=p_actor
  JOIN vv ON vv.id=v.id
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
    'firstQuestionAt',CASE WHEN x.fid IS NOT NULL THEN (SELECT fsrs_private.iso_milliseconds(r.question_at) FROM public.fsrs_new_receipts r WHERE r.card_id=x.fid AND r.user_id=p_actor) END)
   ORDER BY x.id),'[]'::jsonb))
 INTO result FROM x;
 RETURN result;
END $function$;

-- ── 재게시: core · manual · admission을 _live 값으로(바뀔 때만, 정확히 1행). profile · 한국어 capability는 범위 밖(사후 검사가 불변 확인).
DO $change$
DECLARE n integer;
BEGIN
 UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash_live() WHERE contract_hash IS DISTINCT FROM fsrs_private.contract_hash_live();
 GET DIAGNOSTICS n = ROW_COUNT; IF n > 1 THEN RAISE EXCEPTION 'snapshot_known: core pin touched % rows', n; END IF;
 UPDATE fsrs_private.manual_save_settings SET contract_hash = fsrs_private.manual_contract_hash_live() WHERE contract_hash IS DISTINCT FROM fsrs_private.manual_contract_hash_live();
 GET DIAGNOSTICS n = ROW_COUNT; IF n > 1 THEN RAISE EXCEPTION 'snapshot_known: manual pin touched % rows', n; END IF;
 UPDATE fsrs_private.admission_settings SET contract_hash = fsrs_private.admission_contract_hash_live()
  WHERE contract_hash IS DISTINCT FROM fsrs_private.admission_contract_hash_live();
 GET DIAGNOSTICS n = ROW_COUNT; IF n > 1 THEN RAISE EXCEPTION 'snapshot_known: admission pin touched % rows', n; END IF;
END $change$;

-- ── 캐시 갱신을 지금 실행한다(커밋 때 할 일과 같은 함수 — 20261023170000). 이 뒤의 DDL은 임시 객체 DROP뿐이라 캐시를 무효로 만들지 않는다.
--    그래서 아래 사후 검사의 출력 비교는 운영 요청과 같은 캐시 경로로 돈다.
SET CONSTRAINTS fsrs_private.contract_cache_refresh IMMEDIATE;
SET CONSTRAINTS fsrs_private.contract_cache_refresh DEFERRED;

DO $post$
DECLARE b record; c jsonb := pg_temp.skj_contracts(); k jsonb := pg_temp.skj_cap(); f jsonb := pg_temp.skj_md5s(); cache record;
BEGIN
 SELECT * INTO STRICT b FROM pg_temp.skj_state_before;
 -- 세 본문 = 이 파일의 본문, 속성 · 권한 불변, 그 밖의 학습 함수 불변.
 IF f->>'public.fsrs_vocabulary_snapshot(uuid)' IS DISTINCT FROM '19cbdadfc0b0be3fb86efd86b7542ade'
    OR f->>'public.fsrs_vocabulary_snapshot_light(uuid,text,boolean)' IS DISTINCT FROM 'a66fb7f3098a9ec8c862292c6139b5ce'
    OR f->>'public.fsrs_vocabulary_snapshot_cards(uuid,uuid[])' IS DISTINCT FROM '5dc13e8a785a8ac5e298d725dad2a0ba'
 THEN RAISE EXCEPTION 'snapshot_known: function bodies are not the reviewed ones %', f; END IF;
 IF pg_temp.skj_attrs() IS DISTINCT FROM b.attrs THEN RAISE EXCEPTION 'snapshot_known: function attributes or grants changed'; END IF;
 IF pg_temp.skj_others() IS DISTINCT FROM b.others THEN RAISE EXCEPTION 'snapshot_known: an untouched learning function changed'; END IF;

 -- 학습 계약: 네 게시값 = 캐시 경로 = _live · profile 불변 · 처음 적용이면 core · manual · admission이 움직인다 · 재실행은 아무것도 움직이지 않는다.
 IF NOT (c->>'ok')::boolean OR NOT (c->>'live_ok')::boolean THEN RAISE EXCEPTION 'snapshot_known: contracts not consistent after change %', c; END IF;
 IF (SELECT s.contract_hash FROM fsrs_private.settings s) IS DISTINCT FROM fsrs_private.contract_hash()
    OR (SELECT m.contract_hash FROM fsrs_private.manual_save_settings m) IS DISTINCT FROM fsrs_private.manual_contract_hash()
    OR (SELECT a.contract_hash FROM fsrs_private.admission_settings a) IS DISTINCT FROM fsrs_private.admission_contract_hash()
    OR (SELECT t.profile_contract_hash FROM fsrs_private.activity_settings t) IS DISTINCT FROM fsrs_private.activity_profile_hash()
 THEN RAISE EXCEPTION 'snapshot_known: a published pin differs from its fingerprint'; END IF;
 IF c->>'profile' IS DISTINCT FROM b.contracts->>'profile' THEN RAISE EXCEPTION 'snapshot_known: activity profile pin moved'; END IF;
 IF b.needs_change AND (c->>'core' = b.contracts->>'core' OR c->>'manual' = b.contracts->>'manual' OR c->>'admission' = b.contracts->>'admission')
 THEN RAISE EXCEPTION 'snapshot_known: core/manual/admission pin did not move with the new bodies % -> %', b.contracts, c; END IF;
 IF NOT b.needs_change AND c IS DISTINCT FROM b.contracts THEN RAISE EXCEPTION 'snapshot_known: already-applied run must not change anything'; END IF;
 SELECT * INTO STRICT cache FROM fsrs_private.contract_cache;
 IF NOT cache.valid OR cache.core IS DISTINCT FROM c->>'core' OR cache.manual IS DISTINCT FROM c->>'manual'
    OR cache.admission IS DISTINCT FROM c->>'admission' OR cache.profile IS DISTINCT FROM c->>'profile'
 THEN RAISE EXCEPTION 'snapshot_known: contract cache not refreshed to the pins'; END IF;
 PERFORM fsrs_private.require_admission_integrity();

 -- 한국어 capability: 범위 밖 — 본문 · 고정값 · 실제 지문 · 속성이 그대로이고 ready.
 IF pg_temp.skj_korean_ready() IS DISTINCT FROM true THEN RAISE EXCEPTION 'snapshot_known: Korean capability ready <> true %', k - 'attrs'; END IF;
 IF k IS DISTINCT FROM b.cap THEN RAISE EXCEPTION 'snapshot_known: Korean capability changed % -> %', b.cap - 'attrs', k - 'attrs'; END IF;
 RAISE NOTICE 'snapshot_known: contracts ok — % ; pins % -> % ; Korean ready (pinned = live %)',
  CASE WHEN b.needs_change THEN 'three bodies rewritten' ELSE 'already applied, nothing changed' END,
  b.contracts - 'ok' - 'live_ok', c - 'ok' - 'live_ok', k->>'pinned';
END $post$;

-- ── 동작 무변경: 전원의 출력 셋(snapshot · light 모든 언어 × 두 모양 · cards 두 묶음)이 바꾸기 전과 같다(같은 인자 · 같은 트랜잭션 · 'now'만 뺀다).
DO $output$
DECLARE n integer; diffs integer; first_bad uuid;
BEGIN
 SELECT pg_catalog.count(*)::integer, pg_catalog.count(*) FILTER (WHERE d.changed)::integer, (pg_catalog.array_agg(d.actor ORDER BY d.actor) FILTER (WHERE d.changed))[1]
   INTO n, diffs, first_bad
   FROM (SELECT o.actor, pg_temp.skj_outputs(o.actor, o.langs, o.batches) IS DISTINCT FROM o.body AS changed FROM pg_temp.skj_output_before o) d;
 IF diffs <> 0 THEN RAISE EXCEPTION 'snapshot_known: vocabulary snapshot output changed for % of % learner(s) (first %)', diffs, n, first_bad; END IF;
 IF n IS DISTINCT FROM (SELECT s.actors FROM pg_temp.skj_state_before s)::integer THEN RAISE EXCEPTION 'snapshot_known: compared % learners', n; END IF;
 RAISE NOTICE 'snapshot_known: % learners — snapshot · light · cards output unchanged (% light calls, % cards calls)', n,
  (SELECT pg_catalog.sum(2 * (1 + pg_catalog.cardinality(o.langs))) FROM pg_temp.skj_output_before o),
  (SELECT pg_catalog.sum(pg_catalog.jsonb_array_length(o.batches)) FROM pg_temp.skj_output_before o);
END $output$;

DO $snapshot$
DECLARE t0 timestamptz := pg_catalog.clock_timestamp(); t1 timestamptz;
BEGIN
 IF (SELECT pg_catalog.count(*) FROM pg_temp.perf_snapshot_before b WHERE (public.fsrs_vocabulary_snapshot(b.actor) - 'now') IS DISTINCT FROM b.body) <> 0
 THEN RAISE EXCEPTION 'snapshot_known: snapshot output changed (P4 gate)'; END IF;
 t1 := pg_catalog.clock_timestamp();
 RAISE NOTICE 'snapshot_known: all-learner snapshot pass % ms before -> % ms after (informational; same session, plan cache warm)',
  (SELECT pg_catalog.round(extract(epoch FROM e.at - s.at) * 1000) FROM pg_temp.skj_clock s, pg_temp.skj_clock e WHERE s.mark = 'before_start' AND e.mark = 'before_end'),
  pg_catalog.round(extract(epoch FROM t1 - t0) * 1000);
END $snapshot$;

DO $parity$
DECLARE cards integer; bad integer;
BEGIN
 SELECT pg_catalog.count(*)::integer,
        pg_catalog.count(*) FILTER (WHERE fsrs_private.vocabulary_registry_entry(s.actor, (e.x->>'cardId')::uuid) IS DISTINCT FROM e.x)::integer
   INTO cards, bad
   FROM (SELECT b.actor, public.fsrs_vocabulary_snapshot(b.actor) AS snap FROM pg_temp.perf_snapshot_before b) s
   CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(s.snap->'registry') AS e(x);
 IF bad <> 0 THEN RAISE EXCEPTION 'snapshot_known: registry_entry differs from snapshot.registry for % of % card(s)', bad, cards; END IF;
 IF cards IS DISTINCT FROM (SELECT pg_catalog.count(*)::integer FROM public.user_vocabulary v WHERE v.user_id IN (SELECT actor FROM pg_temp.perf_snapshot_before))
 THEN RAISE EXCEPTION 'snapshot_known: registry card count differs from vocabulary rows (% cards)', cards; END IF;
 RAISE NOTICE 'snapshot_known: registry_entry = snapshot.registry for all % card(s)', cards;
END $parity$;

DROP FUNCTION pg_temp.skj_outputs(uuid, text[], jsonb); DROP FUNCTION pg_temp.skj_others(); DROP FUNCTION pg_temp.skj_attrs(); DROP FUNCTION pg_temp.skj_md5s();
DROP FUNCTION pg_temp.skj_korean_ready(); DROP FUNCTION pg_temp.skj_cap(); DROP FUNCTION pg_temp.skj_korean_live_hash(); DROP FUNCTION pg_temp.skj_contracts();
DROP TABLE pg_temp.skj_state_before, pg_temp.perf_snapshot_before, pg_temp.skj_clock, pg_temp.skj_output_before, pg_temp.skj_actors;
