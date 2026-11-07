-- 중국어 공개 시드 3편의 문맥 오표기 토큰 3개를 바로잡는다(ZH-SEED-QA-001 — 2026-11-08 KST, 오케스트레이터 04:55 순회 ①,
-- 오너 11/4 「백엔드 · 데이터 자율」). 적용 경로 = main 병합 → db push, 암묵 트랜잭션 하나.
--
-- 실측(운영, 읽기 전용 05:00 KST · LLM 없이): 시드 363~371의 저장 토큰(글자 · 병음)은 지금 tokenizeZhLine 출력과 9편 모두 md5 일치,
--   뜻 빈 토큰 0. 문맥에서 틀린 표기 3개만 고친다(공유 사전 morpheme_dictionary는 그대로 — 「온 가족」 · 「미국과 영국」은 문맥 밖 뜻으로 맞다).
--   ① 364 「全家」 — 本文 「叫“全家”」는 편의점 상호인데 뜻이 「온 가족」 → 「패밀리마트(편의점 상호 · 본뜻 '온 가족')」(품사 고유명사 그대로)
--   ② 368 「吃」(夜市吃东西) — 품사 「고유명사」 → 「동사」(같은 자료의 다른 吃 2개는 이미 동사, 뜻 「먹다」 그대로)
--   ③ 370 「美英」(我叫金美英) — 인명(金 + 美英)인데 품사 고유명사 · 뜻 「미국과 영국」 → 품사 「인명」 · 뜻 「미영(이름 — 金美英의 이름 부분)」
--   단어장 · 문맥 · 교정에 이 자료의 행 0(시드 분석 11/8 03:34 직후). 바꾸는 칸은 위 3개 사전 항목의 pos · meaning뿐 — 원문 · 병음 · 순서 ·
--   다른 항목 · status · 소유권 그대로. 고치기 전 항목은 backup_private.zh_seed_tokens_20261108에 남긴다.
-- 사전 검사: 세 항목이 위 「고치기 전」 값 그대로(글자 · 품사 · 뜻 · 병음)여야 한다. 이미 적용(새 값 그대로 · 백업 3) 또는 시드가 없는 환경
--   (fixture 사슬 — 세 자료 없음)이면 무변경. 그 밖은 RAISE.
-- 사후 검사(같은 트랜잭션): 세 항목 = 백업 + 새 값 · 세 자료의 sequence · 다른 항목 · dictionary 밖 칸 불변 · 학습 계약 지문 넷 불변.
-- 복원: docs/sql/zh-seed-token-fixes-20261108-rollback.sql(오너 확인 뒤에만).

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE SCHEMA IF NOT EXISTS backup_private;
REVOKE ALL ON SCHEMA backup_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS backup_private.zh_seed_tokens_20261108 (
  material_id bigint NOT NULL,
  token_key text NOT NULL,
  token jsonb NOT NULL,
  backed_up_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (material_id, token_key)
);
ALTER TABLE backup_private.zh_seed_tokens_20261108 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON backup_private.zh_seed_tokens_20261108 FROM PUBLIC, anon, authenticated;

CREATE TEMP TABLE zs_fix (material_id bigint, token_key text, text text, furigana text, old_pos text, old_meaning text, new_pos text, new_meaning text,
  PRIMARY KEY (material_id, token_key)) ON COMMIT DROP;
INSERT INTO pg_temp.zs_fix VALUES
  (364, 'id_0_9_1794076427610', '全家', 'quán jiā', '고유명사', '온 가족', '고유명사', '패밀리마트(편의점 상호 · 본뜻 ''온 가족'')'),
  (368, 'id_5_7_1794076449029', '吃', 'chī', '고유명사', '먹다', '동사', '먹다'),
  (370, 'id_0_5_1794076460988', '美英', 'měi yīng', '고유명사', '미국과 영국', '인명', '미영(이름 — 金美英의 이름 부분)');

CREATE TEMP TABLE zs_before ON COMMIT DROP AS
SELECT m.id, md5((m.processed_json->'sequence')::text) seq_md5, md5((m.processed_json - 'dictionary')::text) other_md5,
  md5(coalesce((SELECT jsonb_object_agg(d.key, d.value) FROM jsonb_each(m.processed_json->'dictionary') d
                WHERE NOT EXISTS (SELECT 1 FROM pg_temp.zs_fix f WHERE f.material_id = m.id AND f.token_key = d.key)), '{}')::text) rest_md5
FROM public.reading_materials m WHERE m.id IN (364, 368, 370);

CREATE TEMP TABLE zs_pins (k text PRIMARY KEY, v text) ON COMMIT DROP;
CREATE FUNCTION pg_temp.zs_measure() RETURNS TABLE (k text, v text) LANGUAGE plpgsql AS $m$
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
INSERT INTO pg_temp.zs_pins SELECT * FROM pg_temp.zs_measure();

DO $pre$
DECLARE n_old int; n_new int; n_mat int; n_backup int;
BEGIN
  SELECT count(*) INTO n_mat FROM public.reading_materials WHERE id IN (364, 368, 370);
  SELECT count(*) INTO n_backup FROM backup_private.zh_seed_tokens_20261108;
  SELECT count(*) FILTER (WHERE t->>'text' = f.text AND t->>'furigana' = f.furigana AND t->>'pos' = f.old_pos AND t->>'meaning' = f.old_meaning),
         count(*) FILTER (WHERE t->>'text' = f.text AND t->>'furigana' = f.furigana AND t->>'pos' = f.new_pos AND t->>'meaning' = f.new_meaning)
    INTO n_old, n_new
    FROM pg_temp.zs_fix f LEFT JOIN public.reading_materials m ON m.id = f.material_id
    CROSS JOIN LATERAL (SELECT m.processed_json->'dictionary'->f.token_key t) x;
  IF (n_mat = 0 AND n_backup = 0) OR (n_new = 3 AND n_backup = 3) THEN
    RAISE NOTICE 'zh seed fixes: nothing to change (materials %, already fixed %, backup %)', n_mat, n_new, n_backup;
    TRUNCATE pg_temp.zs_fix;
    RETURN;
  END IF;
  IF n_old <> 3 OR n_backup <> 0 THEN
    RAISE EXCEPTION 'zh seed fixes: unexpected state (old %, new %, materials %, backup %) — stop', n_old, n_new, n_mat, n_backup;
  END IF;
  INSERT INTO backup_private.zh_seed_tokens_20261108 (material_id, token_key, token)
  SELECT f.material_id, f.token_key, m.processed_json->'dictionary'->f.token_key
  FROM pg_temp.zs_fix f JOIN public.reading_materials m ON m.id = f.material_id;
END $pre$;

UPDATE public.reading_materials m
SET processed_json = jsonb_set(m.processed_json, ARRAY['dictionary', f.token_key],
      (m.processed_json->'dictionary'->f.token_key) || jsonb_build_object('pos', f.new_pos, 'meaning', f.new_meaning))
FROM pg_temp.zs_fix f WHERE m.id = f.material_id;

DO $post$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_temp.zs_fix f JOIN backup_private.zh_seed_tokens_20261108 b USING (material_id, token_key)
             JOIN public.reading_materials m ON m.id = f.material_id
             WHERE m.processed_json->'dictionary'->f.token_key IS DISTINCT FROM (b.token || jsonb_build_object('pos', f.new_pos, 'meaning', f.new_meaning)))
     OR (SELECT count(*) FROM pg_temp.zs_fix) NOT IN (0, 3) THEN
    RAISE EXCEPTION 'zh seed fixes: changed tokens differ from backup + new values';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_temp.zs_before b JOIN public.reading_materials m ON m.id = b.id
             WHERE md5((m.processed_json->'sequence')::text) <> b.seq_md5 OR md5((m.processed_json - 'dictionary')::text) <> b.other_md5
                OR md5(coalesce((SELECT jsonb_object_agg(d.key, d.value) FROM jsonb_each(m.processed_json->'dictionary') d
                     WHERE d.key NOT IN ('id_0_9_1794076427610', 'id_5_7_1794076449029', 'id_0_5_1794076460988')), '{}')::text) <> b.rest_md5) THEN
    RAISE EXCEPTION 'zh seed fixes: sequence or untouched entries changed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_temp.zs_pins b FULL JOIN pg_temp.zs_measure() a USING (k) WHERE a.v IS DISTINCT FROM b.v) THEN
    RAISE EXCEPTION 'zh seed fixes: learning contract fingerprint changed — abort';
  END IF;
END $post$;

DROP FUNCTION pg_temp.zs_measure();
