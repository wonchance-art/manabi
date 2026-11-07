-- 공개 N5 문법 시드 8편(60~67)의 반각 기호 토큰 60개를 품사 「기호」로 고친다(JA-PUNCT-001 — 2026-11-08 KST,
-- 오너 11/4 「백엔드 · 데이터 자율」, 03:40 starter 보고에서 발견). 적용 경로 = main 병합 → supabase-migrations.yml(db push), 암묵 트랜잭션 하나.
--
-- 실측(운영, 읽기 전용 03:45 KST): kuromoji가 반각 ( ) / ~ 와 대시 — 를 미등록어 名詞로 내서, 공개 completed 자료 중 60~67에만
--   문장부호만으로 된 토큰 60개가 pos 「명사」 · 뜻 빈칸으로 들어가 있다(전각 （）／「」…는 記号라 정상). 읽기 화면에서 뜻 없는 단어로
--   눌리고 단어장에 담길 수 있다. 단어장에 담긴 기호 0행 — 학습 기록 영향 없음. 앞으로는 tokenizeJa.js(PUNCT_ONLY)가 막는다.
-- 이 파일이 하는 것: 그 60개 사전 항목만 pos → '기호', furigana → null. 원문 · sequence · 다른 사전 항목 · 뜻 · status · 다른 자료는 그대로.
--   LLM 재분석 없음. 고치기 전 항목은 backup_private.ja_punct_tokens_20261108에 남긴다(anon · authenticated 권한 없음 · RLS 켜짐).
-- 사전 검사: 대상 = 공개 · completed · 기호만으로 된 표면 · pos가 기호/개행이 아님 → 정확히 자료 8편(60~67) · 항목 60개 · 전부 pos 명사 · 뜻 빈칸.
--   이미 적용된 상태(대상 0 · 백업 60행) 또는 고칠 것이 없는 환경(대상 0 · 백업 0 — fixture 사슬)이면 아무것도 바꾸지 않는다. 그 밖의 상태는 RAISE.
-- 사후 검사(같은 트랜잭션): 대상 0 · 바뀐 항목 = 백업 60개(pos 기호 · furigana null, 나머지 칸 그대로) · 8편의 sequence와 다른 사전 항목 불변 ·
--   학습 계약 지문 넷(_live) 불변.
-- 복원: docs/sql/ja-punct-pos-20261108-rollback.sql(백업 항목을 그대로 되돌린다 — 오너 확인 뒤에만).

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE SCHEMA IF NOT EXISTS backup_private;
REVOKE ALL ON SCHEMA backup_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS backup_private.ja_punct_tokens_20261108 (
  material_id bigint NOT NULL,
  token_key text NOT NULL,
  token jsonb NOT NULL,
  backed_up_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (material_id, token_key)
);
ALTER TABLE backup_private.ja_punct_tokens_20261108 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON backup_private.ja_punct_tokens_20261108 FROM PUBLIC, anon, authenticated;

-- 대상 항목(공개 · completed · 문장부호/기호만 · 기호/개행 아님).
CREATE TEMP VIEW jp_target AS
SELECT m.id AS material_id, d.key AS token_key, d.value AS token
FROM public.reading_materials m CROSS JOIN LATERAL jsonb_each(m.processed_json->'dictionary') d
WHERE m.visibility = 'public' AND m.processed_json->>'status' = 'completed'
  AND d.value->>'text' ~ '^[[:punct:]—–―・「」『』（）［］｛｝【】〈〉《》〔〕“”‘’…〜~／]+$'
  AND coalesce(d.value->>'pos', '') NOT IN ('기호', '개행');

-- 바꾸기 전 8편의 sequence · 대상 밖 사전 항목 지문(사후 비교용).
CREATE TEMP TABLE jp_before ON COMMIT DROP AS
SELECT m.id, md5((m.processed_json->'sequence')::text) seq_md5,
  md5(coalesce((SELECT jsonb_object_agg(d.key, d.value) FROM jsonb_each(m.processed_json->'dictionary') d
                WHERE NOT EXISTS (SELECT 1 FROM pg_temp.jp_target t WHERE t.material_id = m.id AND t.token_key = d.key)
                  AND NOT EXISTS (SELECT 1 FROM backup_private.ja_punct_tokens_20261108 x WHERE x.material_id = m.id AND x.token_key = d.key)), '{}')::text) rest_md5,
  md5((m.processed_json - 'dictionary')::text) other_md5
FROM public.reading_materials m WHERE m.id IN (60, 61, 62, 63, 64, 65, 66, 67);

CREATE TEMP TABLE jp_pins (k text PRIMARY KEY, v text) ON COMMIT DROP;
CREATE FUNCTION pg_temp.jp_measure() RETURNS TABLE (k text, v text) LANGUAGE plpgsql AS $m$
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
INSERT INTO pg_temp.jp_pins SELECT * FROM pg_temp.jp_measure();

DO $pre$
DECLARE n_tok int; n_mat int; ids bigint[]; n_backup int;
BEGIN
  SELECT count(*), count(DISTINCT material_id), array_agg(DISTINCT material_id ORDER BY material_id) INTO n_tok, n_mat, ids FROM pg_temp.jp_target;
  SELECT count(*) INTO n_backup FROM backup_private.ja_punct_tokens_20261108;
  IF n_tok = 0 AND n_backup IN (0, 60) THEN
    -- 이미 적용(백업 60) 또는 고칠 것이 없는 환경(공개 시드 60~67이 없는 fixture 사슬 — post-observation-migrations) — 무변경.
    RAISE NOTICE 'ja punct: nothing to change (targets 0, backup %)', n_backup;
    RETURN;
  END IF;
  IF n_backup <> 0 OR n_tok <> 60 OR n_mat <> 8 OR ids IS DISTINCT FROM ARRAY[60, 61, 62, 63, 64, 65, 66, 67]::bigint[]
     OR EXISTS (SELECT 1 FROM pg_temp.jp_target WHERE token->>'pos' <> '명사' OR coalesce(token->>'meaning', '') <> '') THEN
    RAISE EXCEPTION 'ja punct: unexpected target (tokens %, materials %, ids %, backup %) — stop', n_tok, n_mat, ids, n_backup;
  END IF;
  INSERT INTO backup_private.ja_punct_tokens_20261108 (material_id, token_key, token) SELECT material_id, token_key, token FROM pg_temp.jp_target;
END $pre$;

UPDATE public.reading_materials m
SET processed_json = jsonb_set(m.processed_json, '{dictionary}', (
  SELECT jsonb_object_agg(d.key, CASE WHEN b.token_key IS NULL THEN d.value
                                      ELSE d.value || jsonb_build_object('pos', '기호', 'furigana', NULL) END)
  FROM jsonb_each(m.processed_json->'dictionary') d
  LEFT JOIN backup_private.ja_punct_tokens_20261108 b ON b.material_id = m.id AND b.token_key = d.key))
WHERE m.id IN (SELECT DISTINCT material_id FROM pg_temp.jp_target);

DO $post$
BEGIN
  IF (SELECT count(*) FROM pg_temp.jp_target) <> 0 THEN
    RAISE EXCEPTION 'ja punct: targets remain after update';
  END IF;
  IF (SELECT count(*) FROM backup_private.ja_punct_tokens_20261108) NOT IN (0, 60) OR EXISTS (
       SELECT 1 FROM backup_private.ja_punct_tokens_20261108 b JOIN public.reading_materials m ON m.id = b.material_id
       WHERE m.processed_json->'dictionary'->b.token_key IS DISTINCT FROM (b.token || jsonb_build_object('pos', '기호', 'furigana', NULL))) THEN
    RAISE EXCEPTION 'ja punct: changed tokens differ from backup + {pos 기호, furigana null}';
  END IF;
  IF EXISTS (
       SELECT 1 FROM pg_temp.jp_before b JOIN public.reading_materials m ON m.id = b.id
       WHERE md5((m.processed_json->'sequence')::text) <> b.seq_md5
          OR md5((m.processed_json - 'dictionary')::text) <> b.other_md5
          OR md5(coalesce((SELECT jsonb_object_agg(d.key, d.value) FROM jsonb_each(m.processed_json->'dictionary') d
                WHERE NOT EXISTS (SELECT 1 FROM backup_private.ja_punct_tokens_20261108 x WHERE x.material_id = m.id AND x.token_key = d.key)), '{}')::text) <> b.rest_md5) THEN
    RAISE EXCEPTION 'ja punct: sequence or untouched entries changed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_temp.jp_pins b FULL JOIN pg_temp.jp_measure() a USING (k) WHERE a.v IS DISTINCT FROM b.v) THEN
    RAISE EXCEPTION 'ja punct: learning contract fingerprint changed — abort';
  END IF;
END $post$;

DROP VIEW pg_temp.jp_target;
DROP FUNCTION pg_temp.jp_measure();
