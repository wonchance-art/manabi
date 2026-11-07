-- 비공개 자료 7편의 기호 토큰 104개(사전 항목)를 품사 「기호」로 고친다(JA-PUNCT-002 — 2026-11-08 KST, 오케스트레이터 04:15 판정:
-- 「분석기 버그가 남긴 품사 표기 정정 = 비파괴 데이터 정합, 자율 범위」, #1747 후속). 적용 경로 = main 병합 → db push, 암묵 트랜잭션 하나.
--
-- 실측(운영, 읽기 전용 04:20 KST): 비공개 · completed 자료 중 문장부호만으로 된 표면이 기호/개행이 아닌 품사로 남은 자료 13편.
--   그중 13 · 14 · 16 · 17 · 18 · 30은 주인 없는 정리 대상(ORPHAN-MATERIALS-001, 백업 md5로 삭제를 검사한다)이라 제외한다 — 바꾸면
--   삭제 SQL의 백업 = 운영 검사가 깨진다. 남은 7편(소유자 2명): 178(영어 43 · 옛 분석 「명사」, 뜻 있음) · 185(일본어 1, 뜻 있음) ·
--   356 · 357 · 358(일본어 ! ? 각 2) · 361 · 362(일본어 . [ ] 각 27, composer v1 — passage 아님).
--   이 7편: 단어장 · 문맥 · 교정 0행(기호 단어 저장자 0명 재확인), 읽기 진행 4행(줄 위치라 무관).
-- 이 파일이 하는 것: 그 104개 사전 항목의 pos만 '기호'로(furigana는 이미 전부 null — 사전 검사가 확인). 뜻 · 원문 · sequence · 다른 항목 ·
--   status · 소유권 · 다른 자료는 그대로. LLM 재분석 없음. 고치기 전 항목은 backup_private.punct_tokens_private_20261108에 남긴다.
-- 트리거: guard_source_passage_write(passage 없음) · protect_composer_source(원문 · composer · importAttempt 불변) · library_book_preserve_metadata
--   (book 없음) — 7편에서 작동하지 않는다.
-- 사전 검사: 대상 = 정확히 위 7편 · 자료별 항목 수(43 · 1 · 2 · 2 · 2 · 27 · 27) · furigana 전부 null. 이미 적용(대상 0 · 백업 104) 또는 고칠 것이 없는 환경(대상 0 · 백업 0)이면 무변경.
-- 사후 검사(같은 트랜잭션): 대상 0 · 바뀐 항목 = 백업 + {pos 기호} · 7편의 sequence · 다른 항목 · dictionary 밖 칸 불변 · 지문 넷 불변.
-- 복원: docs/sql/punct-pos-private-20261108-rollback.sql(오너 확인 뒤에만).

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE SCHEMA IF NOT EXISTS backup_private;
REVOKE ALL ON SCHEMA backup_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS backup_private.punct_tokens_private_20261108 (
  material_id bigint NOT NULL,
  token_key text NOT NULL,
  token jsonb NOT NULL,
  backed_up_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (material_id, token_key)
);
ALTER TABLE backup_private.punct_tokens_private_20261108 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON backup_private.punct_tokens_private_20261108 FROM PUBLIC, anon, authenticated;

-- 대상 항목(비공개 · completed · 주인 없는 정리 대상 제외 · 문장부호/기호만 · 기호/개행 아님).
CREATE TEMP VIEW pp_target AS
SELECT m.id AS material_id, d.key AS token_key, d.value AS token
FROM public.reading_materials m CROSS JOIN LATERAL jsonb_each(m.processed_json->'dictionary') d
WHERE m.visibility = 'private' AND m.processed_json->>'status' = 'completed'
  AND m.id NOT IN (1, 5, 7, 13, 14, 15, 16, 17, 18, 30) -- 주인 없는 정리 대상(ORPHAN-MATERIALS-001)
  AND d.value->>'text' ~ '^[[:punct:]—–―・「」『』（）［］｛｝【】〈〉《》〔〕“”‘’…〜~／]+$'
  AND coalesce(d.value->>'pos', '') NOT IN ('기호', '개행');

-- 바꾸기 전 7편의 sequence · 대상 밖 사전 항목 지문(사후 비교용).
CREATE TEMP TABLE pp_before ON COMMIT DROP AS
SELECT m.id, md5((m.processed_json->'sequence')::text) seq_md5,
  md5(coalesce((SELECT jsonb_object_agg(d.key, d.value) FROM jsonb_each(m.processed_json->'dictionary') d
                WHERE NOT EXISTS (SELECT 1 FROM pg_temp.pp_target t WHERE t.material_id = m.id AND t.token_key = d.key)
                  AND NOT EXISTS (SELECT 1 FROM backup_private.punct_tokens_private_20261108 x WHERE x.material_id = m.id AND x.token_key = d.key)), '{}')::text) rest_md5,
  md5((m.processed_json - 'dictionary')::text) other_md5
FROM public.reading_materials m WHERE m.id IN (178, 185, 356, 357, 358, 361, 362);

CREATE TEMP TABLE pp_pins (k text PRIMARY KEY, v text) ON COMMIT DROP;
CREATE FUNCTION pg_temp.pp_measure() RETURNS TABLE (k text, v text) LANGUAGE plpgsql AS $m$
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
INSERT INTO pg_temp.pp_pins SELECT * FROM pg_temp.pp_measure();

DO $pre$
DECLARE n_tok int; n_backup int; per jsonb;
BEGIN
  SELECT count(*) INTO n_tok FROM pg_temp.pp_target;
  SELECT count(*) INTO n_backup FROM backup_private.punct_tokens_private_20261108;
  IF n_tok = 0 AND n_backup IN (0, 104) THEN
    -- 이미 적용(백업 104) 또는 고칠 것이 없는 환경(대상 자료가 없는 fixture 사슬 — post-observation-migrations) — 무변경.
    RAISE NOTICE 'punct private: nothing to change (targets 0, backup %)', n_backup;
    RETURN;
  END IF;
  SELECT jsonb_object_agg(material_id::text, n) INTO per FROM (SELECT material_id, count(*) n FROM pg_temp.pp_target GROUP BY 1) x;
  IF n_backup <> 0 OR n_tok <> 104
     OR per IS DISTINCT FROM '{"178": 43, "185": 1, "356": 2, "357": 2, "358": 2, "361": 27, "362": 27}'::jsonb
     OR EXISTS (SELECT 1 FROM pg_temp.pp_target WHERE token->>'furigana' IS NOT NULL) THEN
    RAISE EXCEPTION 'punct private: unexpected target (tokens %, per material %, backup %) — stop', n_tok, per, n_backup;
  END IF;
  INSERT INTO backup_private.punct_tokens_private_20261108 (material_id, token_key, token) SELECT material_id, token_key, token FROM pg_temp.pp_target;
END $pre$;

UPDATE public.reading_materials m
SET processed_json = jsonb_set(m.processed_json, '{dictionary}', (
  SELECT jsonb_object_agg(d.key, CASE WHEN b.token_key IS NULL THEN d.value
                                      ELSE d.value || jsonb_build_object('pos', '기호') END)
  FROM jsonb_each(m.processed_json->'dictionary') d
  LEFT JOIN backup_private.punct_tokens_private_20261108 b ON b.material_id = m.id AND b.token_key = d.key))
WHERE m.id IN (SELECT DISTINCT material_id FROM pg_temp.pp_target);

DO $post$
BEGIN
  IF (SELECT count(*) FROM pg_temp.pp_target) <> 0 THEN
    RAISE EXCEPTION 'punct private: targets remain after update';
  END IF;
  IF (SELECT count(*) FROM backup_private.punct_tokens_private_20261108) NOT IN (0, 104) OR EXISTS (
       SELECT 1 FROM backup_private.punct_tokens_private_20261108 b JOIN public.reading_materials m ON m.id = b.material_id
       WHERE m.processed_json->'dictionary'->b.token_key IS DISTINCT FROM (b.token || jsonb_build_object('pos', '기호'))) THEN
    RAISE EXCEPTION 'punct private: changed tokens differ from backup + {pos 기호}';
  END IF;
  IF EXISTS (
       SELECT 1 FROM pg_temp.pp_before b JOIN public.reading_materials m ON m.id = b.id
       WHERE md5((m.processed_json->'sequence')::text) <> b.seq_md5
          OR md5((m.processed_json - 'dictionary')::text) <> b.other_md5
          OR md5(coalesce((SELECT jsonb_object_agg(d.key, d.value) FROM jsonb_each(m.processed_json->'dictionary') d
                WHERE NOT EXISTS (SELECT 1 FROM backup_private.punct_tokens_private_20261108 x WHERE x.material_id = m.id AND x.token_key = d.key)), '{}')::text) <> b.rest_md5) THEN
    RAISE EXCEPTION 'punct private: sequence or untouched entries changed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_temp.pp_pins b FULL JOIN pg_temp.pp_measure() a USING (k) WHERE a.v IS DISTINCT FROM b.v) THEN
    RAISE EXCEPTION 'punct private: learning contract fingerprint changed — abort';
  END IF;
END $post$;

DROP VIEW pg_temp.pp_target;
DROP FUNCTION pg_temp.pp_measure();
