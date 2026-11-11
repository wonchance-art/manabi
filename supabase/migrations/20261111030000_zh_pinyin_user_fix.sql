-- 중국어 사용자 자료 병음 보정 7토큰 · 4자료 (ZH-PINYIN-CHECK 2차 — 오케스트레이터 판단 2026-11-11 KST 「적용」). furigana를 바꾸고,
-- 372의 为 두 토큰만 뜻도 바꾼다(병음 wéi에 「~를 위하여」가 붙으면 모순 — 오케스트레이터 지시). text · base_form · 토큰 key · raw_text 그대로. 근거: 새 검증 패스(CC-CEDICT · 낱말 단독 병음 합의)와 규칙 3건이 고치는 자리를
-- 운영 저장 토큰에 낱말 단위로만 대조해 고른 것(본문은 보지 않음). 고정표에는 자료 id · 토큰 key · 낱말 · 옛 → 새 병음만 둔다.
--   284 力量 lì liáng → lì liàng · 372 认为 rèn wèi → rèn wéi · 372 为 ×2 wèi → wéi(결과 보어) ·
--   372 为 뜻: 表现为 자리 「~를 위하여」 → 「~(으)로」 · 称…为 자리 → 「~(이)라고」(옛 뜻이 다르면 뜻만 건너뛰고 NOTICE).
--   263 打着 dǎ zhuó → dǎ zhe · 263 泽地 zé de → zé dì · 261 数着 shù zhuó → shǔ zhe(뜻 「세고 있다」 · 뒤 목적어가 수량 — 세다 shǔ).
-- 사용자 자료라 그 사이 재분석 · 삭제 · 손 보정이 있을 수 있다 — 예외로 멈추지 않고 그 행만 건너뛰고 NOTICE:
--   자료 없음 · 토큰 없음 · text 다름 · 지금 값이 옛 값도 새 값도 아님 · token_corrections나 viewerCorrections에 그 토큰이 있음.
--   이미 새 값이면 그 행은 무변경.
-- 백업: backup_private.zh_pinyin_fix_20261111(바뀌는 자료의 processed_json 통째). 복원: docs/sql/zh-pinyin-fix-20261111-rollback.sql(토큰 단위).
-- 사후 검사: 새 값 · sequence · 사전 키 수 그대로 · 토큰 이음이 백업 시점과 같음(text를 안 바꿈) · raw_text 열이 백업 시점과 같음 ·
--   이 마이그레이션이 다른 행을 안 건드림(md5) · 학습 계약 지문 넷.
--   ⚠ 「토큰 이음 = raw_text」는 검사하지 않는다 — 공개 시드(JA)에서는 성립하지만 사용자 자료는 원래 다를 수 있다
--     (운영 실측 2026-11-11 KST: id 284는 적용 전부터 토큰 이음 ≠ raw_text). 그 불변식을 그대로 가져오면 사후 검사가 예외로 막힌다.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $exists$
BEGIN
  IF to_regclass('public.reading_materials') IS NULL THEN
    RAISE EXCEPTION 'relation public.reading_materials does not exist' USING ERRCODE = '42P01';
  END IF;
END $exists$;

CREATE TEMP TABLE zpf_pins (k text PRIMARY KEY, v text) ON COMMIT DROP;
CREATE FUNCTION pg_temp.zpf_measure() RETURNS TABLE (k text, v text) LANGUAGE plpgsql AS $m$
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
INSERT INTO pg_temp.zpf_pins SELECT * FROM pg_temp.zpf_measure();

CREATE SCHEMA IF NOT EXISTS backup_private;
REVOKE ALL ON SCHEMA backup_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS backup_private.zh_pinyin_fix_20261111 (
  material_id bigint PRIMARY KEY,
  raw_text text,
  processed_json jsonb NOT NULL,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE backup_private.zh_pinyin_fix_20261111 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON backup_private.zh_pinyin_fix_20261111 FROM PUBLIC, anon, authenticated;

-- 고정표: 자료 · 토큰 key · 낱말(확인용) · 옛 병음 · 새 병음
CREATE TEMP TABLE zpf_fix (mid bigint, k text, tx text, old_furi text, new_furi text, old_mn text, new_mn text, PRIMARY KEY (mid, k)) ON COMMIT DROP;
INSERT INTO pg_temp.zpf_fix VALUES
  (261, 'id_6_3_1790833758210', '数着', 'shù zhuó', 'shǔ zhe', NULL, NULL),
  (263, 'id_6_5_1791252878405', '打着', 'dǎ zhuó', 'dǎ zhe', NULL, NULL),
  (263, 'id_16_9_1791252878405', '泽地', 'zé de', 'zé dì', NULL, NULL),
  (284, 'id_3_215_1791836771641', '力量', 'lì liáng', 'lì liàng', NULL, NULL),
  (372, 'id_5_46_1794377282275', '为', 'wèi', 'wéi', '~를 위하여', '~(으)로'),
  (372, 'id_21_18_1794377282275', '为', 'wèi', 'wéi', '~를 위하여', '~(이)라고'),
  (372, 'id_21_27_1794377282275', '认为', 'rèn wèi', 'rèn wéi', NULL, NULL);

-- 할 일: 병음(furi) · 뜻(mn)을 따로 판정한다 — 뜻이 사용자 손 보정 등으로 달라졌으면 병음만 고친다.
CREATE TEMP TABLE zpf_go (mid bigint, k text, furi boolean NOT NULL, mn boolean NOT NULL, PRIMARY KEY (mid, k)) ON COMMIT DROP;
CREATE TEMP TABLE zpf_state (others_md5 text) ON COMMIT DROP;

DO $pre$
DECLARE f record; d jsonb; vc jsonb; why text; corrected boolean; do_furi boolean; do_mn boolean;
BEGIN
  FOR f IN SELECT * FROM pg_temp.zpf_fix ORDER BY mid, k LOOP
    why := NULL; do_furi := false; do_mn := false;
    SELECT m.processed_json->'dictionary'->f.k, m.processed_json->'metadata'->'viewerCorrections' INTO d, vc
      FROM public.reading_materials m WHERE m.id = f.mid;
    IF NOT FOUND THEN why := 'material missing';
    ELSIF d IS NULL THEN why := 'token missing';
    ELSIF d->>'text' IS DISTINCT FROM f.tx THEN why := format('text is %s', d->>'text');
    ELSIF jsonb_typeof(vc) = 'object' AND vc ? f.k THEN why := 'viewerCorrections has this token';
    END IF;
    IF why IS NULL AND to_regclass('public.token_corrections') IS NOT NULL THEN
      EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.token_corrections WHERE material_id = $1 AND token_id = $2)' INTO corrected USING f.mid, f.k;
      IF corrected THEN why := 'token_corrections has this token'; END IF;
    END IF;
    IF why IS NOT NULL THEN RAISE NOTICE 'zh pinyin fix: skip % % (%)', f.mid, f.k, why; CONTINUE; END IF;
    IF d->>'furigana' IS NOT DISTINCT FROM f.old_furi THEN do_furi := true;
    ELSIF d->>'furigana' IS DISTINCT FROM f.new_furi THEN
      RAISE NOTICE 'zh pinyin fix: skip % % (furigana is %, expected %)', f.mid, f.k, d->>'furigana', f.old_furi; CONTINUE;
    END IF;
    IF f.new_mn IS NOT NULL THEN
      IF d->>'meaning' IS NOT DISTINCT FROM f.old_mn THEN do_mn := true;
      ELSIF d->>'meaning' IS DISTINCT FROM f.new_mn THEN
        RAISE NOTICE 'zh pinyin fix: keep meaning of % % (meaning is %, expected %)', f.mid, f.k, d->>'meaning', f.old_mn;
      END IF;
    END IF;
    IF do_furi OR do_mn THEN INSERT INTO pg_temp.zpf_go VALUES (f.mid, f.k, do_furi, do_mn); END IF;
  END LOOP;
  -- 백업이 이미 있는 자료에 할 일이 남았다면(정상이면 없다) 그 자료는 통째로 건너뛴다 — 백업을 덮어쓰지 않는다.
  FOR f IN SELECT DISTINCT g.mid FROM pg_temp.zpf_go g JOIN backup_private.zh_pinyin_fix_20261111 b ON b.material_id = g.mid LOOP
    RAISE NOTICE 'zh pinyin fix: skip material % (backup row already exists)', f.mid;
    DELETE FROM pg_temp.zpf_go WHERE mid = f.mid;
  END LOOP;
  INSERT INTO pg_temp.zpf_state (others_md5)
  SELECT md5(coalesce(string_agg(md5(m::text), '' ORDER BY m.id), '')) FROM public.reading_materials m
  WHERE NOT EXISTS (SELECT 1 FROM pg_temp.zpf_go g WHERE g.mid = m.id);
END $pre$;

DO $apply$
DECLARE f record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_temp.zpf_go) THEN RAISE NOTICE 'zh pinyin fix: nothing to change'; RETURN; END IF;
  INSERT INTO backup_private.zh_pinyin_fix_20261111 (material_id, raw_text, processed_json)
  SELECT m.id, m.raw_text, m.processed_json FROM public.reading_materials m WHERE m.id IN (SELECT DISTINCT mid FROM pg_temp.zpf_go);
  FOR f IN SELECT x.*, g.furi AS do_furi, g.mn AS do_mn FROM pg_temp.zpf_fix x JOIN pg_temp.zpf_go g USING (mid, k) LOOP
    IF f.do_furi THEN
      UPDATE public.reading_materials m SET processed_json = jsonb_set(m.processed_json, ARRAY['dictionary', f.k, 'furigana'], to_jsonb(f.new_furi)) WHERE m.id = f.mid;
    END IF;
    IF f.do_mn THEN
      UPDATE public.reading_materials m SET processed_json = jsonb_set(m.processed_json, ARRAY['dictionary', f.k, 'meaning'], to_jsonb(f.new_mn)) WHERE m.id = f.mid;
    END IF;
  END LOOP;
  UPDATE public.reading_materials m
     SET processed_json = jsonb_set(m.processed_json, '{metadata}', coalesce(m.processed_json->'metadata', '{}'::jsonb) || jsonb_build_object(
           'updated_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'viewerRevision', gen_random_uuid()::text))
   WHERE m.id IN (SELECT DISTINCT mid FROM pg_temp.zpf_go);
  RAISE NOTICE 'zh pinyin fix: changed % tokens in % materials', (SELECT count(*) FROM pg_temp.zpf_go), (SELECT count(DISTINCT mid) FROM pg_temp.zpf_go);
END $apply$;

DO $post$
DECLARE bad text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_temp.zpf_go) THEN RETURN; END IF;
  SELECT string_agg(f.mid || ':' || f.k, ', ') INTO bad FROM pg_temp.zpf_fix f JOIN pg_temp.zpf_go g USING (mid, k)
    JOIN public.reading_materials m ON m.id = f.mid
  WHERE m.processed_json->'dictionary'->f.k->>'furigana' IS DISTINCT FROM f.new_furi
     OR (g.mn AND m.processed_json->'dictionary'->f.k->>'meaning' IS DISTINCT FROM f.new_mn);
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'zh pinyin fix: value not applied (%)', bad; END IF;
  SELECT string_agg(m.id::text, ', ') INTO bad FROM public.reading_materials m
    JOIN backup_private.zh_pinyin_fix_20261111 b ON b.material_id = m.id
  WHERE m.id IN (SELECT mid FROM pg_temp.zpf_go)
    AND ((m.processed_json->'sequence') IS DISTINCT FROM (b.processed_json->'sequence')
     OR (SELECT count(*) FROM jsonb_object_keys(m.processed_json->'dictionary')) <> (SELECT count(*) FROM jsonb_object_keys(b.processed_json->'dictionary'))
     OR (SELECT count(*) FROM jsonb_each(m.processed_json->'dictionary') d WHERE d.value IS DISTINCT FROM (b.processed_json->'dictionary'->d.key))
        <> (SELECT count(*) FROM pg_temp.zpf_go g WHERE g.mid = m.id)
     OR m.raw_text IS DISTINCT FROM b.raw_text
     OR (SELECT string_agg(CASE WHEN s.k LIKE 'br\_%' THEN E'\n' ELSE m.processed_json->'dictionary'->s.k->>'text' END, '' ORDER BY s.ord)
           FROM jsonb_array_elements_text(m.processed_json->'sequence') WITH ORDINALITY s(k, ord))
        IS DISTINCT FROM
        (SELECT string_agg(CASE WHEN s.k LIKE 'br\_%' THEN E'\n' ELSE b.processed_json->'dictionary'->s.k->>'text' END, '' ORDER BY s.ord)
           FROM jsonb_array_elements_text(b.processed_json->'sequence') WITH ORDINALITY s(k, ord)));
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'zh pinyin fix: sequence/dictionary/token text/raw_text changed beyond targets (%)', bad; END IF;
  IF (SELECT md5(coalesce(string_agg(md5(m::text), '' ORDER BY m.id), '')) FROM public.reading_materials m
      WHERE NOT EXISTS (SELECT 1 FROM pg_temp.zpf_go g WHERE g.mid = m.id)) IS DISTINCT FROM (SELECT others_md5 FROM pg_temp.zpf_state) THEN
    RAISE EXCEPTION 'zh pinyin fix: other materials changed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_temp.zpf_pins b FULL JOIN pg_temp.zpf_measure() a USING (k) WHERE a.v IS DISTINCT FROM b.v) THEN
    RAISE EXCEPTION 'zh pinyin fix: learning contract fingerprint changed — abort';
  END IF;
END $post$;

DROP FUNCTION pg_temp.zpf_measure();
