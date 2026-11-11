-- 중국어 얼화 병음 백필 14토큰 · 9자료 (ZH-ERHUA 안 A — 오너 「권장대로. ㄱㄱ」 2026-11-11 KST). furigana의 儿 자리 음절만 「r」로 바꾼다
-- (哪儿 nǎ ér → nǎ r · 一点儿 yì diǎn ér → yì diǎn r — 앞 음절과 一 변조는 그대로). 저장 꼴은 글자당 한 음절 그대로(음절 수 = 글자 수).
-- 새 분석은 토크나이저가 같은 꼴을 낸다(src/lib/server/zhErhua.js). 대상 = CC-CEDICT가 儿 자리를 r5로만 적는 낱말(data/zhErhua.json) 중
-- 운영 저장 토큰(실측 2026-11-11 KST: 儿로 끝나는 다글자 토큰 15개 = 얼화 14 + 실음절 女儿 1 — 女儿는 대상 밖).
--   공개 7토큰(365 有点儿 · 早点儿, 366 那儿 · 这儿 · 哪儿, 367 一点儿, 370 一点儿) · 비공개 7토큰(188 · 189 ×2 · 196 · 213 · 263 ×2).
-- ⚠ 반입 순서: 목록 · 복습 카드가 「nǎ r」를 「nǎr」로 붙여 보이는 표시 규칙(Design)이 운영에 나간 **뒤**에 적용한다.
-- text · base_form · meaning · 토큰 key · raw_text 그대로. 고정표에는 자료 id · 토큰 key · 낱말 · 옛 → 새 병음만 둔다(본문은 옮기지 않는다).
-- 틀 = 20261111030000_zh_pinyin_user_fix(같은 날 · 같은 검사). 그 마이그레이션의 불변식을 이 대상에서 먼저 실측했다 —
--   14토큰 모두 자료 있음 · 토큰 있음 · text 일치 · 지금 병음 = 옛 병음 · token_corrections 0 · viewerCorrections 0(검증 기록 참고).
-- 그 사이 재분석 · 삭제 · 손 보정이 있을 수 있다 — 예외로 멈추지 않고 그 행만 건너뛰고 NOTICE:
--   자료 없음 · 토큰 없음 · text 다름 · 지금 값이 옛 값도 새 값도 아님 · token_corrections나 viewerCorrections에 그 토큰이 있음.
--   이미 새 값이면 그 행은 무변경.
-- 백업: backup_private.zh_erhua_r_20261111(바뀌는 자료의 raw_text · processed_json 통째). 복원: docs/sql/zh-erhua-r-20261111-rollback.sql(토큰 단위).
-- 사후 검사: 새 값 · sequence · 사전 키 수 그대로 · 바뀐 사전 항목 수 = 그 자료의 할 일 수 · 토큰 이음이 백업 시점과 같음 ·
--   raw_text 열이 백업 시점과 같음 · 다른 행을 안 건드림(md5) · 학습 계약 지문 넷. 「토큰 이음 = raw_text」는 검사하지 않는다(사용자 자료).

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $exists$
BEGIN
  IF to_regclass('public.reading_materials') IS NULL THEN
    RAISE EXCEPTION 'relation public.reading_materials does not exist' USING ERRCODE = '42P01';
  END IF;
END $exists$;

CREATE TEMP TABLE zer_pins (k text PRIMARY KEY, v text) ON COMMIT DROP;
CREATE FUNCTION pg_temp.zer_measure() RETURNS TABLE (k text, v text) LANGUAGE plpgsql AS $m$
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
INSERT INTO pg_temp.zer_pins SELECT * FROM pg_temp.zer_measure();

CREATE SCHEMA IF NOT EXISTS backup_private;
REVOKE ALL ON SCHEMA backup_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS backup_private.zh_erhua_r_20261111 (
  material_id bigint PRIMARY KEY,
  raw_text text,
  processed_json jsonb NOT NULL,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE backup_private.zh_erhua_r_20261111 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON backup_private.zh_erhua_r_20261111 FROM PUBLIC, anon, authenticated;

-- 고정표: 자료 · 토큰 key · 낱말(확인용) · 공개 여부(NOTICE용) · 옛 병음 · 새 병음(儿 자리만 r) — 운영 실측 2026-11-11 KST 14토큰.
CREATE TEMP TABLE zer_fix (mid bigint, k text, tx text, pub boolean, old_furi text, new_furi text, PRIMARY KEY (mid, k)) ON COMMIT DROP;
INSERT INTO pg_temp.zer_fix VALUES
  (188, 'id_1_7_1788062733607', '一点儿', false, 'yì diǎn ér', 'yì diǎn r'),
  (189, 'id_3_9_1788325545037', '一点儿', false, 'yì diǎn ér', 'yì diǎn r'),
  (189, 'id_7_17_1788325545037', '一点儿', false, 'yì diǎn ér', 'yì diǎn r'),
  (196, 'id_15_16_1794300050097', '画儿', false, 'huà ér', 'huà r'),
  (213, 'id_4_0_1788641732330', '大伙儿', false, 'dà huǒ ér', 'dà huǒ r'),
  (263, 'id_11_3_1791252878405', '心眼儿', false, 'xīn yǎn ér', 'xīn yǎn r'),
  (263, 'id_6_8_1791252878405', '一点儿', false, 'yì diǎn ér', 'yì diǎn r'),
  (365, 'id_3_2_1794076432866', '有点儿', true, 'yǒu diǎn er', 'yǒu diǎn r'),
  (365, 'id_6_5_1794076432866', '早点儿', true, 'zǎo diǎn ér', 'zǎo diǎn r'),
  (366, 'id_2_0_1794076437817', '那儿', true, 'nà ér', 'nà r'),
  (366, 'id_2_2_1794076437817', '这儿', true, 'zhè ér', 'zhè r'),
  (366, 'id_5_1_1794076437817', '哪儿', true, 'nǎ ér', 'nǎ r'),
  (367, 'id_8_10_1794076443155', '一点儿', true, 'yì diǎn ér', 'yì diǎn r'),
  (370, 'id_6_3_1794076460988', '一点儿', true, 'yì diǎn ér', 'yì diǎn r');

-- 할 일: 지금 병음 = 옛 병음인 토큰(병음만 — 뜻은 건드리지 않는다).
CREATE TEMP TABLE zer_go (mid bigint, k text, PRIMARY KEY (mid, k)) ON COMMIT DROP;
CREATE TEMP TABLE zer_state (others_md5 text) ON COMMIT DROP;

DO $pre$
DECLARE f record; d jsonb; vc jsonb; why text; corrected boolean;
BEGIN
  FOR f IN SELECT * FROM pg_temp.zer_fix ORDER BY mid, k LOOP
    why := NULL;
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
    IF why IS NOT NULL THEN RAISE NOTICE 'zh erhua r: skip % % (%)', f.mid, f.k, why; CONTINUE; END IF;
    IF d->>'furigana' IS NOT DISTINCT FROM f.old_furi THEN INSERT INTO pg_temp.zer_go VALUES (f.mid, f.k);
    ELSIF d->>'furigana' IS DISTINCT FROM f.new_furi THEN
      RAISE NOTICE 'zh erhua r: skip % % (furigana is %, expected %)', f.mid, f.k, d->>'furigana', f.old_furi;
    END IF;
  END LOOP;
  -- 백업이 이미 있는 자료에 할 일이 남았다면(정상이면 없다) 그 자료는 통째로 건너뛴다 — 백업을 덮어쓰지 않는다.
  FOR f IN SELECT DISTINCT g.mid FROM pg_temp.zer_go g JOIN backup_private.zh_erhua_r_20261111 b ON b.material_id = g.mid LOOP
    RAISE NOTICE 'zh erhua r: skip material % (backup row already exists)', f.mid;
    DELETE FROM pg_temp.zer_go WHERE mid = f.mid;
  END LOOP;
  INSERT INTO pg_temp.zer_state (others_md5)
  SELECT md5(coalesce(string_agg(md5(m::text), '' ORDER BY m.id), '')) FROM public.reading_materials m
  WHERE NOT EXISTS (SELECT 1 FROM pg_temp.zer_go g WHERE g.mid = m.id);
END $pre$;

DO $apply$
DECLARE f record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_temp.zer_go) THEN RAISE NOTICE 'zh erhua r: nothing to change'; RETURN; END IF;
  INSERT INTO backup_private.zh_erhua_r_20261111 (material_id, raw_text, processed_json)
  SELECT m.id, m.raw_text, m.processed_json FROM public.reading_materials m WHERE m.id IN (SELECT DISTINCT mid FROM pg_temp.zer_go);
  FOR f IN SELECT x.* FROM pg_temp.zer_fix x JOIN pg_temp.zer_go g USING (mid, k) LOOP
    UPDATE public.reading_materials m SET processed_json = jsonb_set(m.processed_json, ARRAY['dictionary', f.k, 'furigana'], to_jsonb(f.new_furi)) WHERE m.id = f.mid;
  END LOOP;
  UPDATE public.reading_materials m
     SET processed_json = jsonb_set(m.processed_json, '{metadata}', coalesce(m.processed_json->'metadata', '{}'::jsonb) || jsonb_build_object(
           'updated_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'viewerRevision', gen_random_uuid()::text))
   WHERE m.id IN (SELECT DISTINCT mid FROM pg_temp.zer_go);
  RAISE NOTICE 'zh erhua r: changed % tokens in % materials', (SELECT count(*) FROM pg_temp.zer_go), (SELECT count(DISTINCT mid) FROM pg_temp.zer_go);
  -- 공개 자료(공개 시드 365 · 366 · 367 · 370)는 대상 수 = 운영 실측 수(7토큰 · 4자료)를 따로 알린다 — 어긋나면 반입자가 NOTICE로 본다.
  RAISE NOTICE 'zh erhua r: public % of 7 tokens (measured 2026-11-11 KST) · private % of 7',
    (SELECT count(*) FROM pg_temp.zer_go g JOIN pg_temp.zer_fix x USING (mid, k) WHERE x.pub),
    (SELECT count(*) FROM pg_temp.zer_go g JOIN pg_temp.zer_fix x USING (mid, k) WHERE NOT x.pub);
END $apply$;

DO $post$
DECLARE bad text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_temp.zer_go) THEN RETURN; END IF;
  SELECT string_agg(f.mid || ':' || f.k, ', ') INTO bad FROM pg_temp.zer_fix f JOIN pg_temp.zer_go g USING (mid, k)
    JOIN public.reading_materials m ON m.id = f.mid
  WHERE m.processed_json->'dictionary'->f.k->>'furigana' IS DISTINCT FROM f.new_furi;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'zh erhua r: value not applied (%)', bad; END IF;
  SELECT string_agg(m.id::text, ', ') INTO bad FROM public.reading_materials m
    JOIN backup_private.zh_erhua_r_20261111 b ON b.material_id = m.id
  WHERE m.id IN (SELECT mid FROM pg_temp.zer_go)
    AND ((m.processed_json->'sequence') IS DISTINCT FROM (b.processed_json->'sequence')
     OR (SELECT count(*) FROM jsonb_object_keys(m.processed_json->'dictionary')) <> (SELECT count(*) FROM jsonb_object_keys(b.processed_json->'dictionary'))
     OR (SELECT count(*) FROM jsonb_each(m.processed_json->'dictionary') d WHERE d.value IS DISTINCT FROM (b.processed_json->'dictionary'->d.key))
        <> (SELECT count(*) FROM pg_temp.zer_go g WHERE g.mid = m.id)
     OR m.raw_text IS DISTINCT FROM b.raw_text
     OR (SELECT string_agg(CASE WHEN s.k LIKE 'br\_%' THEN E'\n' ELSE m.processed_json->'dictionary'->s.k->>'text' END, '' ORDER BY s.ord)
           FROM jsonb_array_elements_text(m.processed_json->'sequence') WITH ORDINALITY s(k, ord))
        IS DISTINCT FROM
        (SELECT string_agg(CASE WHEN s.k LIKE 'br\_%' THEN E'\n' ELSE b.processed_json->'dictionary'->s.k->>'text' END, '' ORDER BY s.ord)
           FROM jsonb_array_elements_text(b.processed_json->'sequence') WITH ORDINALITY s(k, ord)));
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'zh erhua r: sequence/dictionary/token text/raw_text changed beyond targets (%)', bad; END IF;
  IF (SELECT md5(coalesce(string_agg(md5(m::text), '' ORDER BY m.id), '')) FROM public.reading_materials m
      WHERE NOT EXISTS (SELECT 1 FROM pg_temp.zer_go g WHERE g.mid = m.id)) IS DISTINCT FROM (SELECT others_md5 FROM pg_temp.zer_state) THEN
    RAISE EXCEPTION 'zh erhua r: other materials changed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_temp.zer_pins b FULL JOIN pg_temp.zer_measure() a USING (k) WHERE a.v IS DISTINCT FROM b.v) THEN
    RAISE EXCEPTION 'zh erhua r: learning contract fingerprint changed — abort';
  END IF;
END $post$;

DROP FUNCTION pg_temp.zer_measure();
