-- 공개 N5 시드 읽기 보정 2건(JA-KANJI-A-001 후속 · 2026-11-11 KST). furigana · meaning만 바꾼다(text · base_form · 토큰 key · raw_text 그대로).
--   ① id 61 머리 「오늘 만나는 한자」 첫 줄 「時 (じ) — 시」: 時 토큰 furigana とき → じ, meaning 때 → 시(바로 뒤 괄호 읽기 · 뜻과 같게).
--   ② id 62 본문 「りんごを 3個 ください」: 3個 furigana みっつこ → さんこ.
-- 둘 다 A-2 전환 전부터 있던 값(backup_private.ja_kanji_a2_20261111과 같음). 전수 조사(공개 일본어 63편, 읽기 전용 11/11):
--   숫자 + 조수사 한 토큰 15종 중 틀린 것 1(3個) · 머리 괄호 읽기 줄 18줄 중 어긋난 것 1(時) — 그 밖은 0.
-- 사전 검사: 대상 토큰의 지금 값 = 옛 값(이미 새 값이면 그 행만 무변경, 둘 다 아니면 멈춤). 학습 기록은 토큰 key · 본문에 묶이므로 영향 없음.
-- 백업: backup_private.ja_reading_fix_20261111(자료 processed_json 통째). 복원: docs/sql/ja-reading-fix-20261111-rollback.sql.
-- 사후 검사: 새 값 · raw_text 그대로 · 토큰 이음 = 원문 · 대상 밖 자료 md5 · 학습 계약 지문 넷. 대상 자료가 없는 환경(fixture 사슬)은 무변경.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $exists$
BEGIN
  IF to_regclass('public.reading_materials') IS NULL THEN
    RAISE EXCEPTION 'relation public.reading_materials does not exist' USING ERRCODE = '42P01';
  END IF;
END $exists$;

CREATE TEMP TABLE jrf_pins (k text PRIMARY KEY, v text) ON COMMIT DROP;
CREATE FUNCTION pg_temp.jrf_measure() RETURNS TABLE (k text, v text) LANGUAGE plpgsql AS $m$
DECLARE f record; val text;
BEGIN
  FOR f IN SELECT * FROM (VALUES ('core', 'fsrs_private', 'contract_hash_live'), ('manual', 'fsrs_private', 'manual_contract_hash_live'),
      ('admission', 'fsrs_private', 'admission_contract_hash_live'), ('activity', 'fsrs_private', 'activity_profile_hash_live')) x(k, sch, fn) LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = f.sch AND p.proname = f.fn AND p.pronargs = 0) THEN
      EXECUTE format('SELECT %I.%I()::text', f.sch, f.fn) INTO val;
    ELSE val := NULL; END IF;
    k := f.k; v := val; RETURN NEXT;
  END LOOP;
END $m$;
INSERT INTO pg_temp.jrf_pins SELECT * FROM pg_temp.jrf_measure();

CREATE SCHEMA IF NOT EXISTS backup_private;
REVOKE ALL ON SCHEMA backup_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS backup_private.ja_reading_fix_20261111 (
  material_id bigint PRIMARY KEY,
  processed_json jsonb NOT NULL,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE backup_private.ja_reading_fix_20261111 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON backup_private.ja_reading_fix_20261111 FROM PUBLIC, anon, authenticated;

-- 고정표: 자료 · 토큰 key · text(확인용) · 옛 값 · 새 값
CREATE TEMP TABLE jrf_fix (mid bigint, k text, tx text, old_furi text, old_mn text, new_furi text, new_mn text, PRIMARY KEY (mid, k)) ON COMMIT DROP;
INSERT INTO pg_temp.jrf_fix VALUES
  (61, 'id_1_0_1793989842149', '時', 'とき', '때', 'じ', '시'),
  (62, 'id_6_3_1793989845047', '3個', 'みっつこ', '3개', 'さんこ', '3개');

CREATE TEMP TABLE jrf_target (mid bigint PRIMARY KEY) ON COMMIT DROP;
CREATE TEMP TABLE jrf_state (go boolean NOT NULL, others_md5 text) ON COMMIT DROP;

DO $pre$
DECLARE f record; d jsonb; n_present int := 0;
BEGIN
  FOR f IN SELECT * FROM pg_temp.jrf_fix LOOP
    SELECT m.processed_json->'dictionary'->f.k INTO d FROM public.reading_materials m WHERE m.id = f.mid;
    IF d IS NULL THEN CONTINUE; END IF; -- 자료나 토큰이 없는 환경
    n_present := n_present + 1;
    IF d->>'text' IS DISTINCT FROM f.tx THEN
      RAISE EXCEPTION 'ja reading fix: % % text is % (expected %)', f.mid, f.k, d->>'text', f.tx;
    END IF;
    IF d->>'furigana' IS NOT DISTINCT FROM f.new_furi AND d->>'meaning' IS NOT DISTINCT FROM f.new_mn THEN CONTINUE; END IF; -- 이미 적용
    IF d->>'furigana' IS DISTINCT FROM f.old_furi OR d->>'meaning' IS DISTINCT FROM f.old_mn THEN
      RAISE EXCEPTION 'ja reading fix: % % is %/% (expected old %/% or new %/%)', f.mid, f.k, d->>'furigana', d->>'meaning', f.old_furi, f.old_mn, f.new_furi, f.new_mn;
    END IF;
    INSERT INTO pg_temp.jrf_target VALUES (f.mid) ON CONFLICT DO NOTHING;
  END LOOP;
  IF n_present = 0 THEN RAISE NOTICE 'ja reading fix: no target materials — nothing to change'; END IF;
  IF EXISTS (SELECT 1 FROM backup_private.ja_reading_fix_20261111 b JOIN pg_temp.jrf_target t ON t.mid = b.material_id) THEN
    RAISE EXCEPTION 'ja reading fix: backup row already exists for a pending target — stop';
  END IF;
  INSERT INTO pg_temp.jrf_state (go, others_md5)
  SELECT EXISTS (SELECT 1 FROM pg_temp.jrf_target), md5(coalesce(string_agg(md5(m::text), '' ORDER BY m.id), ''))
  FROM public.reading_materials m WHERE NOT EXISTS (SELECT 1 FROM pg_temp.jrf_target t WHERE t.mid = m.id);
END $pre$;

DO $apply$
DECLARE f record;
BEGIN
  IF NOT (SELECT go FROM pg_temp.jrf_state) THEN RAISE NOTICE 'ja reading fix: nothing to change'; RETURN; END IF;
  INSERT INTO backup_private.ja_reading_fix_20261111 (material_id, processed_json)
  SELECT m.id, m.processed_json FROM public.reading_materials m JOIN pg_temp.jrf_target t ON t.mid = m.id;
  FOR f IN SELECT x.* FROM pg_temp.jrf_fix x JOIN pg_temp.jrf_target t ON t.mid = x.mid LOOP
    UPDATE public.reading_materials m
       SET processed_json = jsonb_set(jsonb_set(m.processed_json, ARRAY['dictionary', f.k, 'furigana'], to_jsonb(f.new_furi)),
                                      ARRAY['dictionary', f.k, 'meaning'], to_jsonb(f.new_mn))
     WHERE m.id = f.mid;
  END LOOP;
  UPDATE public.reading_materials m
     SET processed_json = jsonb_set(m.processed_json, '{metadata}', (m.processed_json->'metadata') || jsonb_build_object(
           'updated_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'viewerRevision', gen_random_uuid()::text))
   WHERE m.id IN (SELECT mid FROM pg_temp.jrf_target);
  RAISE NOTICE 'ja reading fix: changed % materials', (SELECT count(*) FROM pg_temp.jrf_target);
END $apply$;

DO $post$
DECLARE bad text;
BEGIN
  IF NOT (SELECT go FROM pg_temp.jrf_state) THEN RETURN; END IF;
  SELECT string_agg(f.mid || ':' || f.k, ', ') INTO bad FROM pg_temp.jrf_fix f JOIN public.reading_materials m ON m.id = f.mid
  WHERE m.processed_json->'dictionary'->f.k->>'furigana' IS DISTINCT FROM f.new_furi OR m.processed_json->'dictionary'->f.k->>'meaning' IS DISTINCT FROM f.new_mn;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'ja reading fix: value not applied (%)', bad; END IF;
  SELECT string_agg(m.id::text, ', ') INTO bad FROM public.reading_materials m JOIN pg_temp.jrf_target t ON t.mid = m.id
  JOIN backup_private.ja_reading_fix_20261111 b ON b.material_id = m.id
  WHERE (m.processed_json->'sequence') IS DISTINCT FROM (b.processed_json->'sequence')
     OR (SELECT count(*) FROM jsonb_object_keys(m.processed_json->'dictionary')) <> (SELECT count(*) FROM jsonb_object_keys(b.processed_json->'dictionary'))
     OR m.raw_text IS DISTINCT FROM (SELECT string_agg(CASE WHEN s.k LIKE 'br\_%' THEN E'\n' ELSE m.processed_json->'dictionary'->s.k->>'text' END, '' ORDER BY s.ord)
                                     FROM jsonb_array_elements_text(m.processed_json->'sequence') WITH ORDINALITY s(k, ord));
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'ja reading fix: sequence/dictionary/raw_text changed (%)', bad; END IF;
  IF (SELECT md5(coalesce(string_agg(md5(m::text), '' ORDER BY m.id), '')) FROM public.reading_materials m
      WHERE NOT EXISTS (SELECT 1 FROM pg_temp.jrf_target t WHERE t.mid = m.id)) IS DISTINCT FROM (SELECT others_md5 FROM pg_temp.jrf_state) THEN
    RAISE EXCEPTION 'ja reading fix: other materials changed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_temp.jrf_pins b FULL JOIN pg_temp.jrf_measure() a USING (k) WHERE a.v IS DISTINCT FROM b.v) THEN
    RAISE EXCEPTION 'ja reading fix: learning contract fingerprint changed — abort';
  END IF;
END $post$;

DROP FUNCTION pg_temp.jrf_measure();
