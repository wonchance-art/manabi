-- 공유 사전 캐시의 중국어 얼화 읽기 9행을 저장 꼴 「… r」로 맞춘다 (ZH-ERHUA 안 A 후속 — 오케스트레이터 지시 2026-11-12 KST, 백엔드 자율 범위).
-- 왜: 20261111040000_zh_erhua_r가 자료 토큰 14개를 「nǎ r」로 바꿨지만 morpheme_dictionary.reading은 옛 「nǎ ér」로 남았다 —
--   토큰 고치기 창(buildReadingOptions)이 옛 꼴을 후보로 내고(고르면 손 보정으로 옛 꼴이 되살아난다), 교실 조회가 옛 꼴을 보인다.
--   분석기는 중국어 병음을 토크나이저 값 우선으로 써서(analyzeCore) 새 토큰에는 영향이 없다 — 화면 두 곳의 불일치만 메운다.
-- 무엇을: reading 열만. 뜻 · 품사 · source · usage_count · 시각은 그대로. 대상 = 운영 실측(2026-11-12 KST) 儿로 끝나는 중국어 표제어 10행 중
--   얼화 9행(CC-CEDICT r5 단독 목록 src/lib/server/data/zhErhua.json 안). 실음절 女儿 「nǚ ér」(id 4525)는 대상 밖.
-- 행 단위로 건너뛰고 NOTICE(멈추지 않음): 행 없음 · 표제어 · 언어 다름 · 지금 읽기가 옛 값도 새 값도 아님. 이미 새 값이면 무변경.
-- 백업: backup_private.zh_erhua_dict_20261112(id · base_form · 옛 reading). 복원: docs/sql/zh-erhua-dict-20261112-rollback.sql(행 단위).
-- 사후 검사: 새 값 · reading 밖 열 그대로(백업 시점 행과 비교) · 다른 사전 행 무변경(md5) · 학습 계약 지문 넷.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $exists$
BEGIN
  IF to_regclass('public.morpheme_dictionary') IS NULL THEN
    RAISE EXCEPTION 'relation public.morpheme_dictionary does not exist' USING ERRCODE = '42P01';
  END IF;
END $exists$;

CREATE TEMP TABLE zed_pins (k text PRIMARY KEY, v text) ON COMMIT DROP;
CREATE FUNCTION pg_temp.zed_measure() RETURNS TABLE (k text, v text) LANGUAGE plpgsql AS $m$
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
INSERT INTO pg_temp.zed_pins SELECT * FROM pg_temp.zed_measure();

CREATE SCHEMA IF NOT EXISTS backup_private;
REVOKE ALL ON SCHEMA backup_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS backup_private.zh_erhua_dict_20261112 (
  id bigint PRIMARY KEY,
  base_form text NOT NULL,
  reading text,
  row_before jsonb NOT NULL,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE backup_private.zh_erhua_dict_20261112 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON backup_private.zh_erhua_dict_20261112 FROM PUBLIC, anon, authenticated;

-- 고정표: 사전 행 id · 표제어(확인용) · 옛 읽기 · 새 읽기(儿 자리만 r — 앞 음절 · 一 변조 그대로)
CREATE TEMP TABLE zed_fix (id bigint PRIMARY KEY, bf text NOT NULL, old_r text NOT NULL, new_r text NOT NULL) ON COMMIT DROP;
INSERT INTO pg_temp.zed_fix VALUES
  (3127, '一点儿', 'yì diǎn ér', 'yì diǎn r'),
  (7088, '哪儿', 'nǎ ér', 'nǎ r'),
  (3524, '大伙儿', 'dà huǒ ér', 'dà huǒ r'),
  (4432, '心眼儿', 'xīn yǎn ér', 'xīn yǎn r'),
  (7069, '早点儿', 'zǎo diǎn ér', 'zǎo diǎn r'),
  (7084, '有点儿', 'yǒu diǎn er', 'yǒu diǎn r'),
  (7285, '画儿', 'huà ér', 'huà r'),
  (7109, '这儿', 'zhè ér', 'zhè r'),
  (7107, '那儿', 'nà ér', 'nà r');

CREATE TEMP TABLE zed_go (id bigint PRIMARY KEY) ON COMMIT DROP;
CREATE TEMP TABLE zed_state (others_md5 text) ON COMMIT DROP;

DO $pre$
DECLARE f record; d record;
BEGIN
  FOR f IN SELECT * FROM pg_temp.zed_fix ORDER BY id LOOP
    SELECT * INTO d FROM public.morpheme_dictionary WHERE id = f.id;
    IF NOT FOUND THEN RAISE NOTICE 'zh erhua dict: skip % (row missing)', f.id; CONTINUE; END IF;
    IF d.base_form IS DISTINCT FROM f.bf OR d.language IS DISTINCT FROM 'Chinese' THEN
      RAISE NOTICE 'zh erhua dict: skip % (row is % / %)', f.id, d.base_form, d.language; CONTINUE;
    END IF;
    IF d.reading IS NOT DISTINCT FROM f.old_r THEN INSERT INTO pg_temp.zed_go VALUES (f.id);
    ELSIF d.reading IS DISTINCT FROM f.new_r THEN
      RAISE NOTICE 'zh erhua dict: skip % % (reading is %, expected %)', f.id, f.bf, d.reading, f.old_r;
    END IF;
  END LOOP;
  -- 백업이 이미 있는 행에 할 일이 남았다면(정상이면 없다) 건너뛴다 — 백업을 덮어쓰지 않는다.
  FOR f IN SELECT g.id FROM pg_temp.zed_go g JOIN backup_private.zh_erhua_dict_20261112 b USING (id) LOOP
    RAISE NOTICE 'zh erhua dict: skip % (backup row already exists)', f.id;
    DELETE FROM pg_temp.zed_go WHERE id = f.id;
  END LOOP;
  INSERT INTO pg_temp.zed_state (others_md5)
  SELECT md5(coalesce(string_agg(md5(m::text), '' ORDER BY m.id), '')) FROM public.morpheme_dictionary m
  WHERE NOT EXISTS (SELECT 1 FROM pg_temp.zed_go g WHERE g.id = m.id);
END $pre$;

DO $apply$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_temp.zed_go) THEN RAISE NOTICE 'zh erhua dict: nothing to change'; RETURN; END IF;
  INSERT INTO backup_private.zh_erhua_dict_20261112 (id, base_form, reading, row_before)
  SELECT m.id, m.base_form, m.reading, to_jsonb(m) FROM public.morpheme_dictionary m WHERE m.id IN (SELECT id FROM pg_temp.zed_go);
  UPDATE public.morpheme_dictionary m SET reading = f.new_r
    FROM pg_temp.zed_fix f JOIN pg_temp.zed_go g USING (id) WHERE m.id = f.id;
  RAISE NOTICE 'zh erhua dict: changed % of 9 rows', (SELECT count(*) FROM pg_temp.zed_go);
END $apply$;

DO $post$
DECLARE bad text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_temp.zed_go) THEN RETURN; END IF;
  SELECT string_agg(f.id::text, ', ') INTO bad FROM pg_temp.zed_fix f JOIN pg_temp.zed_go g USING (id)
    JOIN public.morpheme_dictionary m ON m.id = f.id WHERE m.reading IS DISTINCT FROM f.new_r;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'zh erhua dict: value not applied (%)', bad; END IF;
  SELECT string_agg(m.id::text, ', ') INTO bad FROM public.morpheme_dictionary m
    JOIN backup_private.zh_erhua_dict_20261112 b USING (id)
  WHERE m.id IN (SELECT id FROM pg_temp.zed_go) AND (to_jsonb(m) - 'reading') IS DISTINCT FROM (b.row_before - 'reading');
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'zh erhua dict: columns other than reading changed (%)', bad; END IF;
  IF (SELECT md5(coalesce(string_agg(md5(m::text), '' ORDER BY m.id), '')) FROM public.morpheme_dictionary m
      WHERE NOT EXISTS (SELECT 1 FROM pg_temp.zed_go g WHERE g.id = m.id)) IS DISTINCT FROM (SELECT others_md5 FROM pg_temp.zed_state) THEN
    RAISE EXCEPTION 'zh erhua dict: other dictionary rows changed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_temp.zed_pins b FULL JOIN pg_temp.zed_measure() a USING (k) WHERE a.v IS DISTINCT FROM b.v) THEN
    RAISE EXCEPTION 'zh erhua dict: learning contract fingerprint changed — abort';
  END IF;
END $post$;

DROP FUNCTION pg_temp.zed_measure();
