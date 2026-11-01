-- STREAK-LEARNING-DAY-001(STATS-MAP-001 S2) — 연속의 하루를 UTC 날짜에서 04시 학습일(KST)로. 오너 결정 2026-11-01 KST
--   「04시 통일 ㅇㅋ(연속 포함)」 · 「연속 04시도 진행해」. 표시 통계 · FSRS 일정은 이미 04시 학습일(fsrsScheduler.learningDay)이고,
--   연속만 UTC(KST 09시)였다 — 아침 4–9시 학습이 히트맵에서는 오늘, 연속에서는 어제로 갈렸다.
-- 적용 경로 = PR이 main에 병합되면 supabase-migrations.yml(db push)이 운영에 바로 적용한다 → 병합 승인 = 운영 적용 승인
--   (오너 지속 실행 승인 2026-10-02 KST 범위 — 비파괴 · 검토한 SQL · 복원 경로).
-- 실행 형태: db push는 파일 전체 + 이력 INSERT를 한 파이프라인(암묵 트랜잭션 하나)으로 보낸다 → BEGIN/COMMIT 없음, SET LOCAL 실효를
--   첫 DO가 확인. 어느 검사든 RAISE하면 이력까지 함께 롤백된다. 실행 주체 postgres, 앱 사용자(JWT)를 만들지 않는다.
--
-- 바꾸는 것(비파괴 — 지난 영수증 · 연속 · 쉼 · 기준점은 한 행도 고치지 않는다):
--   ⑴ 새 함수 fsrs_private.activity_day_switch_at() = 2026-11-03 04:00 KST(전환 시각, 상수) ·
--      fsrs_private.activity_day(timestamptz) = 그 시각 전은 UTC 날짜(지금 그대로), 그 뒤는 KST 04시 학습일.
--      앱 정본 = src/lib/learningActivity.js ACTIVITY_DAY_SWITCH_AT · activityDay(같은 식).
--   ⑵ fsrs_private.append_activity — 영수증 날 계산 한 줄을 activity_day로 + 전환 다리(아래). 본문 md5 72a68724… → cd68db7e….
--   ⑶ public.update_streak — 예전 일정 활동의 날(영수증 id) 계산 한 줄을 activity_day로. 본문 md5 355e5429… → f9e83f7b….
--   project_activity_days_with_legacy(재생) · legacy_activity_before_epoch(시작 전 경로) · 기록 트리거는 그대로다.
-- 날이 어떻게 바뀌나: 04시 학습일은 UTC 날짜와 같고, KST 04–09시만 하루 뒤다(UTC 전날 19–24시). 날이 앞으로 당겨지는 일은 없다.
-- 전환 다리(한 사람당 한 번): 전환 뒤 첫 영수증이 KST 04–09시이고, 마지막 연속일이 그 UTC 날짜의 전날이면(UTC로는 이어짐 · 학습일로는
--   이틀 간격) 그 한 영수증만 UTC 날짜로 센다 — 전환 때문에 누구의 연속도 끊기거나 쉼이 깎이지 않는다. 대가: 그 사람이 같은 학습일에
--   한 번 더 학습하면 하루가 한 번 더 붙을 수 있다(한 번뿐, 사용자에게 유리한 쪽).
-- 재게시: core(fsrs_private 함수) · admission(append_activity가 지문에 있다) · activity profile(update_streak가 profiles 의존 폐포에 있다 —
--   20261026010000 profiles_privacy와 같은 재게시)을 지금 계산한 값으로. manual · 한국어 capability 지문은 그대로여야 한다(사후 검사).
--   순서: 함수 본문을 바꾼 뒤 profile → core → admission(admission 지문이 profile 계산값을 담는다).
-- 사전 검사가 받는 상태: ① 두 본문 = OLD · 네 계약 일치 · 지금 < 전환 시각 ② 이 파일을 이미 적용(NEW — no-op). 그 밖이면 RAISE.
--   전환 시각 뒤 영수증이 이미 쌓인 뒤 처음 적용하려 하면 RAISE — 시각을 다시 정해 새 파일로 낸다(지난 영수증 날을 바꾸지 않기 위해).
-- 복원: docs/sql/streak-learning-day-rollback.sql — 두 본문을 OLD로, 두 함수 삭제, 같은 두 지문 재게시. 전환 뒤 쌓인 영수증의 날은
--   그대로 남는다(학습일 날짜 — 재생은 날짜 순서만 보므로 연속 계산은 계속 맞다).
SET LOCAL search_path = '';
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '180s';

DO $runner$
BEGIN
 IF pg_catalog.current_setting('search_path') NOT IN ('', '""') OR pg_catalog.current_setting('lock_timeout') <> '5s'
    OR pg_catalog.current_setting('statement_timeout') <> '3min'
 THEN RAISE EXCEPTION 'streak_day: SET LOCAL not in effect (search_path=%, lock_timeout=%, statement_timeout=%)',
   pg_catalog.current_setting('search_path'), pg_catalog.current_setting('lock_timeout'), pg_catalog.current_setting('statement_timeout');
 END IF;
END $runner$;

-- ── 공통 도구(pg_temp, 이 세션 전용 · 끝에서 DROP).
CREATE FUNCTION pg_temp.sd_contracts() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_object(
  'ok', s.contract_hash IS NOT DISTINCT FROM fsrs_private.contract_hash()
    AND m.contract_hash IS NOT DISTINCT FROM fsrs_private.manual_contract_hash()
    AND a.contract_hash IS NOT DISTINCT FROM fsrs_private.admission_contract_hash()
    AND t.profile_contract_hash IS NOT DISTINCT FROM fsrs_private.activity_profile_hash(),
  'core', s.contract_hash, 'manual', m.contract_hash, 'admission', a.contract_hash, 'profile', t.profile_contract_hash)
 FROM fsrs_private.settings s, fsrs_private.manual_save_settings m, fsrs_private.admission_settings a, fsrs_private.activity_settings t
$q$;
CREATE FUNCTION pg_temp.sd_md5(p_sig text) RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.md5(p.prosrc) FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure(p_sig)
$q$;
CREATE FUNCTION pg_temp.sd_attrs(p_sig text) RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_build_array(p.proowner, p.prosecdef, p.proconfig, p.provolatile, p.proparallel, p.proleakproof, p.proisstrict,
   p.prolang, p.prorettype, p.proretset, p.proacl::text)
 FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure(p_sig)
$q$;
-- 손대지 않는 활동 함수(본문 md5 그대로여야 한다).
CREATE FUNCTION pg_temp.sd_others() RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.jsonb_object_agg(p.oid::pg_catalog.regprocedure::text, pg_catalog.md5(p.prosrc)) FROM pg_catalog.pg_proc p
 WHERE p.oid IN ('fsrs_private.project_activity_days_with_legacy(jsonb,date[],date[])'::pg_catalog.regprocedure,
   'fsrs_private.legacy_activity_before_epoch(uuid)'::pg_catalog.regprocedure, 'fsrs_private.record_fsrs_activity(uuid,text)'::pg_catalog.regprocedure,
   'fsrs_private.record_learning_activity()'::pg_catalog.regprocedure, 'public.fsrs_apply_operation(uuid,jsonb)'::pg_catalog.regprocedure)
$q$;
-- 함수 원문에서 한 군데만 바꿔 같은 정의로 다시 만든다 — 정확히 한 번 나와야 한다.
CREATE FUNCTION pg_temp.sd_patch(p_sig text, p_old text, p_new text) RETURNS void LANGUAGE plpgsql SET search_path = '' AS $q$
DECLARE def text := pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(p_sig)); n integer;
BEGIN
 n := (pg_catalog.length(def) - pg_catalog.length(pg_catalog.replace(def, p_old, ''))) / pg_catalog.length(p_old);
 IF n <> 1 THEN RAISE EXCEPTION 'streak_day: % has % copies of the patched text (expected 1)', p_sig, n; END IF;
 EXECUTE pg_catalog.replace(def, p_old, p_new);
END
$q$;

CREATE TEMP TABLE sd_state_before ON COMMIT DROP AS
 SELECT pg_temp.sd_contracts() AS contracts,
  pg_temp.sd_attrs('fsrs_private.append_activity(uuid,text,text,uuid,timestamp with time zone)') AS append_attrs,
  pg_temp.sd_attrs('public.update_streak(uuid)') AS streak_attrs, pg_temp.sd_others() AS others,
  (SELECT pg_catalog.count(*) FROM fsrs_private.activity_receipts) AS receipts,
  (SELECT pg_catalog.md5(pg_catalog.string_agg(r::text, ',' ORDER BY r.actor_id, r.kind, r.receipt_id)) FROM fsrs_private.activity_receipts r) AS receipts_md5,
  (SELECT pg_catalog.md5(pg_catalog.string_agg(pg_catalog.concat_ws('|', p.id, p.streak_count, p.last_streak_date, p.streak_freeze_count), ',' ORDER BY p.id))
     FROM public.profiles p) AS profiles_md5;

DO $pre$
DECLARE c jsonb := pg_temp.sd_contracts();
 app text := pg_temp.sd_md5('fsrs_private.append_activity(uuid,text,text,uuid,timestamp with time zone)');
 upd text := pg_temp.sd_md5('public.update_streak(uuid)');
BEGIN
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'streak_day: learning contracts already drifted %', c; END IF;
 PERFORM fsrs_private.require_admission_integrity();
 IF app = '72a68724a293020ae410cfaf2d93f010' AND upd = '355e54295750c732c20657f29e43a33a' THEN
  -- 전환 시각 뒤 영수증이 이미 있으면(늦게 적용) 그 영수증은 UTC 날짜로 쌓였고 다리 조건도 어긋난다 — 시각을 다시 정해 새 파일로.
  IF EXISTS(SELECT 1 FROM fsrs_private.activity_receipts r WHERE r.effective_at >= '2026-11-03 04:00:00+09'::timestamptz) THEN
   RAISE EXCEPTION 'streak_day: receipts already exist after the switch time — pick a new switch time in a new file';
  END IF;
  RAISE NOTICE 'streak_day: needs change';
 ELSIF app = 'cd68db7e1673552e7b5c05be9c5ab2be' AND upd = 'f9e83f7b770c391541c961a7704f16c3' THEN
  RAISE NOTICE 'streak_day: already applied — no-op';
 ELSE
  RAISE EXCEPTION 'streak_day: unreviewed state (append_activity %, update_streak %)', app, upd;
 END IF;
END $pre$;

-- ── 변경(옛 본문일 때만).
DO $change$
BEGIN
 IF pg_temp.sd_md5('fsrs_private.append_activity(uuid,text,text,uuid,timestamp with time zone)') = '72a68724a293020ae410cfaf2d93f010' THEN
  CREATE FUNCTION fsrs_private.activity_day_switch_at() RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path TO ''
   AS $f$ SELECT '2026-11-03 04:00:00+09'::timestamptz $f$;
  CREATE FUNCTION fsrs_private.activity_day(p_at timestamptz) RETURNS date LANGUAGE sql STABLE SET search_path TO ''
   AS $f$ SELECT CASE WHEN p_at >= fsrs_private.activity_day_switch_at()
     THEN ((p_at AT TIME ZONE 'Asia/Seoul') - interval '4 hours')::date
     ELSE (p_at AT TIME ZONE 'UTC')::date END $f$;
  REVOKE ALL ON FUNCTION fsrs_private.activity_day_switch_at(), fsrs_private.activity_day(timestamptz) FROM PUBLIC;

  PERFORM pg_temp.sd_patch('fsrs_private.append_activity(uuid,text,text,uuid,timestamp with time zone)',
   $l$ day_value:=(p_effective AT TIME ZONE 'UTC')::date;$l$,
   $l$ day_value:=fsrs_private.activity_day(p_effective);$l$);
  PERFORM pg_temp.sd_patch('fsrs_private.append_activity(uuid,text,text,uuid,timestamp with time zone)',
   $l$ INSERT INTO fsrs_private.activity_receipts(actor_id,kind,receipt_id,card_id,effective_at,activity_day)$l$,
   $l$ -- STREAK-LEARNING-DAY-001 bridge: the first receipt after the switch, at KST 04-09, counts on its UTC date when that keeps
 -- a UTC-continuous streak continuous (once per actor; past receipts are never rewritten).
 IF p_effective>=fsrs_private.activity_day_switch_at() AND day_value<>(p_effective AT TIME ZONE 'UTC')::date
  AND (current_profile->>'last_streak_date')::date=(p_effective AT TIME ZONE 'UTC')::date-1
  AND NOT EXISTS(SELECT 1 FROM fsrs_private.activity_receipts r WHERE r.actor_id=p_actor AND r.effective_at>=fsrs_private.activity_day_switch_at())
 THEN day_value:=(p_effective AT TIME ZONE 'UTC')::date; END IF;
 INSERT INTO fsrs_private.activity_receipts(actor_id,kind,receipt_id,card_id,effective_at,activity_day)$l$);
  PERFORM pg_temp.sd_patch('public.update_streak(uuid)',
   $l$ day_value:=(effective AT TIME ZONE 'UTC')::date;$l$,
   $l$ day_value:=fsrs_private.activity_day(effective);$l$);
 END IF;
 -- 재게시: profile → core · admission을 지금 계산한 값으로(바뀔 때만).
 UPDATE fsrs_private.activity_settings SET profile_contract_hash = fsrs_private.activity_profile_hash()
  WHERE profile_contract_hash IS DISTINCT FROM fsrs_private.activity_profile_hash();
 UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash_live() WHERE contract_hash IS DISTINCT FROM fsrs_private.contract_hash_live();
 UPDATE fsrs_private.admission_settings SET contract_hash = fsrs_private.admission_contract_hash_live()
  WHERE contract_hash IS DISTINCT FROM fsrs_private.admission_contract_hash_live();
END $change$;

DO $post$
DECLARE b record; c jsonb := pg_temp.sd_contracts();
BEGIN
 SELECT * INTO STRICT b FROM pg_temp.sd_state_before;
 IF pg_temp.sd_md5('fsrs_private.append_activity(uuid,text,text,uuid,timestamp with time zone)') IS DISTINCT FROM 'cd68db7e1673552e7b5c05be9c5ab2be'
    OR pg_temp.sd_md5('public.update_streak(uuid)') IS DISTINCT FROM 'f9e83f7b770c391541c961a7704f16c3'
 THEN RAISE EXCEPTION 'streak_day: post state differs from the reviewed change (append %, streak %)',
   pg_temp.sd_md5('fsrs_private.append_activity(uuid,text,text,uuid,timestamp with time zone)'), pg_temp.sd_md5('public.update_streak(uuid)'); END IF;
 IF pg_temp.sd_attrs('fsrs_private.append_activity(uuid,text,text,uuid,timestamp with time zone)') IS DISTINCT FROM b.append_attrs
    OR pg_temp.sd_attrs('public.update_streak(uuid)') IS DISTINCT FROM b.streak_attrs
 THEN RAISE EXCEPTION 'streak_day: function attributes or grants changed'; END IF;
 IF pg_temp.sd_others() IS DISTINCT FROM b.others THEN RAISE EXCEPTION 'streak_day: an untouched function changed'; END IF;
 -- 비파괴: 영수증 · 프로필 연속 세 칸은 한 행도 바뀌지 않는다.
 IF (SELECT pg_catalog.count(*) FROM fsrs_private.activity_receipts) <> b.receipts
    OR (SELECT pg_catalog.md5(pg_catalog.string_agg(r::text, ',' ORDER BY r.actor_id, r.kind, r.receipt_id)) FROM fsrs_private.activity_receipts r) IS DISTINCT FROM b.receipts_md5
    OR (SELECT pg_catalog.md5(pg_catalog.string_agg(pg_catalog.concat_ws('|', p.id, p.streak_count, p.last_streak_date, p.streak_freeze_count), ',' ORDER BY p.id))
          FROM public.profiles p) IS DISTINCT FROM b.profiles_md5
 THEN RAISE EXCEPTION 'streak_day: existing receipts or streaks changed'; END IF;
 IF NOT (c->>'ok')::boolean THEN RAISE EXCEPTION 'streak_day: contracts not consistent after repin %', c; END IF;
 IF c->'manual' IS DISTINCT FROM b.contracts->'manual' THEN RAISE EXCEPTION 'streak_day: manual pin moved'; END IF;
 IF pg_catalog.has_function_privilege('authenticated', 'fsrs_private.activity_day(timestamptz)', 'EXECUTE')
    OR pg_catalog.has_function_privilege('anon', 'fsrs_private.activity_day(timestamptz)', 'EXECUTE')
 THEN RAISE EXCEPTION 'streak_day: activity_day must not be callable by API roles'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
END $post$;

-- ── 캐시 갱신을 지금 실행해 본다(커밋 때 할 일과 같은 함수 — 20261023170000).
SET CONSTRAINTS fsrs_private.contract_cache_refresh IMMEDIATE;
SET CONSTRAINTS fsrs_private.contract_cache_refresh DEFERRED;

DO $cache$
DECLARE k record;
BEGIN
 SELECT * INTO STRICT k FROM fsrs_private.contract_cache;
 IF NOT k.valid THEN RAISE EXCEPTION 'streak_day: refresh did not validate the contract cache'; END IF;
 IF (SELECT s.contract_hash FROM fsrs_private.settings s) IS DISTINCT FROM k.core
    OR (SELECT a.contract_hash FROM fsrs_private.admission_settings a) IS DISTINCT FROM k.admission
 THEN RAISE EXCEPTION 'streak_day: cached core/admission differ from the pins'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
END $cache$;

DROP FUNCTION pg_temp.sd_patch(text, text, text); DROP FUNCTION pg_temp.sd_others(); DROP FUNCTION pg_temp.sd_attrs(text);
DROP FUNCTION pg_temp.sd_md5(text); DROP FUNCTION pg_temp.sd_contracts();
DROP TABLE pg_temp.sd_state_before;
