-- 공개 영어 3토큰의 pass를 바로잡는다(EN-LEMMA-SS ⑵ — 2026-11-09 KST, 오케스트레이터 03:48 KST 원고 규칙). 적용 경로 = main 병합 → db push, 암묵 트랜잭션 하나.
--
-- 실측(운영, 읽기 전용 03:50 KST): tokenizeEn의 lemmatize가 -ss 명사를 복수로 보고 s를 떼어(pass → pas), 공개 영어 3토큰이
--   base_form 「pas」 · pos 명사 · 뜻 「(발레) 걸음, 스텝」(공유 사전 pas 행)으로 보인다. 원인 수정은 같은 PR의 tokenizeEn.js(새 분석부터).
-- 원고 규칙: 「pass + 사람/물건 (to)」 → 동사 「건네주다」 · 「pass + 시험/관문」 → 「통과하다」 · 「시간·장소를 지나다」 → 「지나가다」.
--   #127 「Pass me the salt, please.」 → 건네주다 · #132 「Pass me the book.」 → 건네주다(확정) · #150 「If you study hard, you will pass the exam.」 → 통과하다.
-- 하는 것: 그 3토큰의 base_form → 'pass' · pos → '동사' · meaning → 위 뜻 · meaning_src 'curated'. text · furigana(/pɑːs/ — pass의 영국식 발음으로도 맞다) ·
--   원문 · sequence · 다른 토큰 · metadata는 그대로. 공유 사전(pas · pass 행)은 건드리지 않는다. 고치기 전 토큰은 backup_private.en_pass_tokens_20261109.
-- 사전 검사: 대상 3토큰이 정확히 옛 값(base_form pas · pos 명사 · 뜻 「(발레) 걸음, 스텝」). 이미 적용(백업 3행) 또는 대상 자료가 없는 환경(fixture 사슬)이면 무변경.
-- 사후 검사: 3토큰 = 백업 + 정해진 칸 · 세 자료의 sequence · 다른 토큰 · dictionary 밖 칸 불변 · 학습 계약 지문 넷 불변.
-- 복원: docs/sql/en-pass-tokens-20261109-rollback.sql(오너 확인 뒤에만).

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $exists$
BEGIN
  IF to_regclass('public.reading_materials') IS NULL THEN
    RAISE EXCEPTION 'relation public.reading_materials does not exist' USING ERRCODE = '42P01';
  END IF;
END $exists$;

CREATE TEMP TABLE ept_pins (k text PRIMARY KEY, v text) ON COMMIT DROP;
CREATE FUNCTION pg_temp.ept_measure() RETURNS TABLE (k text, v text) LANGUAGE plpgsql AS $m$
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
INSERT INTO pg_temp.ept_pins SELECT * FROM pg_temp.ept_measure();

CREATE SCHEMA IF NOT EXISTS backup_private;
REVOKE ALL ON SCHEMA backup_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS backup_private.en_pass_tokens_20261109 (
  material_id bigint NOT NULL,
  token_key text NOT NULL,
  token jsonb NOT NULL,
  backed_up_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (material_id, token_key)
);
ALTER TABLE backup_private.en_pass_tokens_20261109 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON backup_private.en_pass_tokens_20261109 FROM PUBLIC, anon, authenticated;

CREATE TEMP TABLE ept_target (material_id bigint, token_key text, surface text, meaning text, PRIMARY KEY (material_id, token_key)) ON COMMIT DROP;
INSERT INTO pg_temp.ept_target VALUES
  (127, 'id_3_0_1793990006177', 'Pass', '건네주다'),
  (132, 'id_5_0_1793990031966', 'Pass', '건네주다'),
  (150, 'id_1_7_1794076307660', 'pass', '통과하다');

CREATE TEMP TABLE ept_state (go boolean) ON COMMIT DROP;
DO $pre$
DECLARE n_backup int; n_mat int; bad text;
BEGIN
  SELECT count(*) INTO n_backup FROM backup_private.en_pass_tokens_20261109;
  SELECT count(*) INTO n_mat FROM public.reading_materials WHERE id IN (127, 132, 150) AND visibility = 'public'
     AND processed_json->'metadata'->>'language' = 'English';
  IF n_backup > 0 OR n_mat = 0 THEN
    INSERT INTO pg_temp.ept_state VALUES (false);
    RAISE NOTICE 'en pass tokens: nothing to change (backup %, materials %)', n_backup, n_mat;
    RETURN;
  END IF;
  SELECT string_agg(t.material_id || ':' || t.token_key, ', ') INTO bad
  FROM pg_temp.ept_target t LEFT JOIN public.reading_materials m ON m.id = t.material_id
  WHERE (m.processed_json->'dictionary'->t.token_key->>'text') IS DISTINCT FROM t.surface
     OR (m.processed_json->'dictionary'->t.token_key->>'base_form') IS DISTINCT FROM 'pas'
     OR (m.processed_json->'dictionary'->t.token_key->>'pos') IS DISTINCT FROM '명사'
     OR (m.processed_json->'dictionary'->t.token_key->>'meaning') IS DISTINCT FROM '(발레) 걸음, 스텝'
     OR NOT ((m.processed_json->'sequence') ? t.token_key);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'en pass tokens: tokens not in expected state (%) — stop', bad;
  END IF;
  INSERT INTO backup_private.en_pass_tokens_20261109 (material_id, token_key, token)
  SELECT t.material_id, t.token_key, m.processed_json->'dictionary'->t.token_key FROM pg_temp.ept_target t JOIN public.reading_materials m ON m.id = t.material_id;
  INSERT INTO pg_temp.ept_state VALUES (true);
END $pre$;

CREATE TEMP TABLE ept_before ON COMMIT DROP AS
SELECT m.id, md5((m.processed_json->'sequence')::text) seq_md5, md5((m.processed_json - 'dictionary')::text) other_md5,
  md5(coalesce((SELECT jsonb_object_agg(d.key, d.value) FROM jsonb_each(m.processed_json->'dictionary') d
                WHERE NOT EXISTS (SELECT 1 FROM pg_temp.ept_target t WHERE t.material_id = m.id AND t.token_key = d.key)), '{}')::text) rest_md5
FROM public.reading_materials m WHERE m.id IN (127, 132, 150);

UPDATE public.reading_materials m
SET processed_json = jsonb_set(m.processed_json, '{dictionary}', (
  SELECT jsonb_object_agg(d.key, CASE WHEN t.token_key IS NULL THEN d.value
    ELSE d.value || jsonb_build_object('base_form', 'pass', 'pos', '동사', 'meaning', t.meaning, 'meaning_src', 'curated') END)
  FROM jsonb_each(m.processed_json->'dictionary') d
  LEFT JOIN pg_temp.ept_target t ON t.material_id = m.id AND t.token_key = d.key))
WHERE (SELECT go FROM pg_temp.ept_state) AND m.id IN (127, 132, 150);

DO $post$
BEGIN
  IF NOT (SELECT go FROM pg_temp.ept_state) THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM backup_private.en_pass_tokens_20261109 b JOIN pg_temp.ept_target t USING (material_id, token_key)
             JOIN public.reading_materials m ON m.id = b.material_id
             WHERE m.processed_json->'dictionary'->b.token_key IS DISTINCT FROM
                   b.token || jsonb_build_object('base_form', 'pass', 'pos', '동사', 'meaning', t.meaning, 'meaning_src', 'curated'))
     OR (SELECT count(*) FROM backup_private.en_pass_tokens_20261109) <> 3 THEN
    RAISE EXCEPTION 'en pass tokens: changed tokens differ from backup + the decided fields';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_temp.ept_before b JOIN public.reading_materials m ON m.id = b.id
             WHERE md5((m.processed_json->'sequence')::text) <> b.seq_md5
                OR md5((m.processed_json - 'dictionary')::text) <> b.other_md5
                OR md5(coalesce((SELECT jsonb_object_agg(d.key, d.value) FROM jsonb_each(m.processed_json->'dictionary') d
                      WHERE NOT EXISTS (SELECT 1 FROM pg_temp.ept_target t WHERE t.material_id = m.id AND t.token_key = d.key)), '{}')::text) <> b.rest_md5) THEN
    RAISE EXCEPTION 'en pass tokens: sequence or untouched entries changed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_temp.ept_pins b FULL JOIN pg_temp.ept_measure() a USING (k) WHERE a.v IS DISTINCT FROM b.v) THEN
    RAISE EXCEPTION 'en pass tokens: learning contract fingerprint changed — abort';
  END IF;
END $post$;

DROP FUNCTION pg_temp.ept_measure();
