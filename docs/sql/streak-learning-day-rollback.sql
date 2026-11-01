-- 복원: 20261101130000_streak_learning_day(STREAK-LEARNING-DAY-001) 되돌리기 — 연속의 하루를 다시 UTC 날짜로.
-- 실행: 운영 SQL 편집기에서 파일 전체를 한 번(한 트랜잭션). 실행 주체 postgres. 데이터 변경 없음 — 전환 뒤 쌓인 영수증의 날(학습일)은
--   그대로 남는다(재생은 날짜 순서만 보므로 연속 계산은 계속 맞다). 계약: supabase/tests/streak-learning-day.mjs가 PGlite로
--   「복원 뒤 본문 · 게시값 = 마이그레이션 전」 · 「복원 재실행 no-op」 · 「다시 적용」을 확인한다.
SET LOCAL search_path = '';
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION pg_temp.sdr_md5(p_sig text) RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $q$
 SELECT pg_catalog.md5(p.prosrc) FROM pg_catalog.pg_proc p WHERE p.oid = pg_catalog.to_regprocedure(p_sig)
$q$;
CREATE FUNCTION pg_temp.sdr_patch(p_sig text, p_old text, p_new text) RETURNS void LANGUAGE plpgsql SET search_path = '' AS $q$
DECLARE def text := pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(p_sig)); n integer;
BEGIN
 n := (pg_catalog.length(def) - pg_catalog.length(pg_catalog.replace(def, p_old, ''))) / pg_catalog.length(p_old);
 IF n <> 1 THEN RAISE EXCEPTION 'streak_day_rollback: % has % copies of the patched text (expected 1)', p_sig, n; END IF;
 EXECUTE pg_catalog.replace(def, p_old, p_new);
END
$q$;

DO $rollback$
DECLARE app text := pg_temp.sdr_md5('fsrs_private.append_activity(uuid,text,text,uuid,timestamp with time zone)');
 upd text := pg_temp.sdr_md5('public.update_streak(uuid)');
BEGIN
 IF app = '72a68724a293020ae410cfaf2d93f010' AND upd = '355e54295750c732c20657f29e43a33a'
    AND pg_catalog.to_regprocedure('fsrs_private.activity_day(timestamptz)') IS NULL THEN
  RAISE NOTICE 'streak_day_rollback: already restored — no-op';
  RETURN;
 END IF;
 IF app IS DISTINCT FROM 'cd68db7e1673552e7b5c05be9c5ab2be' OR upd IS DISTINCT FROM 'f9e83f7b770c391541c961a7704f16c3' THEN
  RAISE EXCEPTION 'streak_day_rollback: unreviewed state (append_activity %, update_streak %)', app, upd;
 END IF;
 PERFORM pg_temp.sdr_patch('public.update_streak(uuid)',
  $l$ day_value:=fsrs_private.activity_day(effective);$l$,
  $l$ day_value:=(effective AT TIME ZONE 'UTC')::date;$l$);
 PERFORM pg_temp.sdr_patch('fsrs_private.append_activity(uuid,text,text,uuid,timestamp with time zone)',
  $l$ -- STREAK-LEARNING-DAY-001 bridge: the first receipt after the switch, at KST 04-09, counts on its UTC date when that keeps
 -- a UTC-continuous streak continuous (once per actor; past receipts are never rewritten).
 IF p_effective>=fsrs_private.activity_day_switch_at() AND day_value<>(p_effective AT TIME ZONE 'UTC')::date
  AND (current_profile->>'last_streak_date')::date=(p_effective AT TIME ZONE 'UTC')::date-1
  AND NOT EXISTS(SELECT 1 FROM fsrs_private.activity_receipts r WHERE r.actor_id=p_actor AND r.effective_at>=fsrs_private.activity_day_switch_at())
 THEN day_value:=(p_effective AT TIME ZONE 'UTC')::date; END IF;
 INSERT INTO fsrs_private.activity_receipts(actor_id,kind,receipt_id,card_id,effective_at,activity_day)$l$,
  $l$ INSERT INTO fsrs_private.activity_receipts(actor_id,kind,receipt_id,card_id,effective_at,activity_day)$l$);
 PERFORM pg_temp.sdr_patch('fsrs_private.append_activity(uuid,text,text,uuid,timestamp with time zone)',
  $l$ day_value:=fsrs_private.activity_day(p_effective);$l$,
  $l$ day_value:=(p_effective AT TIME ZONE 'UTC')::date;$l$);
 DROP FUNCTION fsrs_private.activity_day(timestamptz);
 DROP FUNCTION fsrs_private.activity_day_switch_at();
 UPDATE fsrs_private.activity_settings SET profile_contract_hash = fsrs_private.activity_profile_hash()
  WHERE profile_contract_hash IS DISTINCT FROM fsrs_private.activity_profile_hash();
 UPDATE fsrs_private.settings SET contract_hash = fsrs_private.contract_hash_live() WHERE contract_hash IS DISTINCT FROM fsrs_private.contract_hash_live();
 UPDATE fsrs_private.admission_settings SET contract_hash = fsrs_private.admission_contract_hash_live()
  WHERE contract_hash IS DISTINCT FROM fsrs_private.admission_contract_hash_live();
 IF pg_temp.sdr_md5('fsrs_private.append_activity(uuid,text,text,uuid,timestamp with time zone)') IS DISTINCT FROM '72a68724a293020ae410cfaf2d93f010'
    OR pg_temp.sdr_md5('public.update_streak(uuid)') IS DISTINCT FROM '355e54295750c732c20657f29e43a33a'
 THEN RAISE EXCEPTION 'streak_day_rollback: bodies did not return to the original'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
END $rollback$;

DROP FUNCTION pg_temp.sdr_patch(text, text, text); DROP FUNCTION pg_temp.sdr_md5(text);
