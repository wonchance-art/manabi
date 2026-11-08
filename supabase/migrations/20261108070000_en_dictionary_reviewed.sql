-- 검수한 영어 뜻을 공유 사전에 넣고, 공개 영어 자료의 남은 빈 뜻 토큰을 채운다(SEED-QA-002 B — 2026-11-08 KST,
-- 오케스트레이터 20:42 · 20:45 KST 원고 · 판단, 20261108060000(A · C) 다음). 적용 경로 = main 병합 → db push, 암묵 트랜잭션 하나.
--
-- 하는 것(네 가지 — 그 밖의 사전 행 · 토큰 · 자료 · 원문 · sequence · metadata는 그대로, LLM 호출 없음):
--   ① 공유 사전(morpheme_dictionary)에 영어 표제어 22개를 새로 넣는다 — source 'user_verified'(영어 LLM 백필
--      needsEnPosBackfill · fetchMeanings 갱신이 덮지 않는 값), 기존 행 모양(meanings [{pos, meaning, priority 1, en_pos_v 1, verify 'ok'}]),
--      reading null(IPA는 backfill-ipa 크론이 채운다). 같은 표제어 행이 이미 있으면 건드리지 않고 NOTICE로 남긴다(백업 표 action 'kept').
--      「st」는 사전에 넣지 않는다 — 1st의 서수 접미라 사전 행을 만들면 다른 자료의 St.(거리)까지 이 뜻이 된다.
--   ② it's 행의 첫 뜻 「그것은」 → 「그것은 ~이다」(다른 칸 · 다른 뜻 그대로), 그 값으로 A가 채운 #135 토큰 3개도 같은 뜻으로.
--   ③ 문맥상 사전 첫 뜻이 어긋나는 토큰 6개만 직접 고친다(출처 표식 meaning_src 'curated' — zh 교재 뜻과 같은 표식):
--      #125 st(1st) 접미사 「~번째(1st의 st)」 · #137 light 명사 「신호등(traffic light)」 · #164 forward 부사 「(look forward to) 기대하다」 ·
--      #138 hotter 형용사 「더 더운(hot의 비교급)」 · #139 hottest 형용사 「가장 더운(hot의 최상급)」(비교급 · 최상급 단원) ·
--      #135 th(…th) 접미사 「~번째(…th의 th)」 + 후리가나 /θ/ 비움(옛 분석의 명사 「th(문자)」).
--   ④ material_fill_empty_meanings(200)로 ①의 새 행이 생긴 빈 뜻 토큰(22개)을 A와 같은 규칙으로 채운다.
-- 고치기 전 값: backup_private.en_dictionary_reviewed_20261108_dict(사전 행) · _tokens(토큰).
-- 사전 검사: A(20261108060000) 적용됨(함수 · 백업 25행) · it's 첫 뜻 「그것은」 · 고칠 토큰 6개 · it's 토큰 3개가 예상 상태.
--   이미 적용(백업 있음) 또는 공개 영어 자료가 없는 환경(fixture 사슬)이면 무변경. 그 밖의 상태는 RAISE.
-- 사후 검사(같은 트랜잭션): 공개 영어 빈 뜻 내용어 토큰 0 · 바뀐 토큰 = 백업 + 정해진 칸 · 사전 새 행 = 원고 · it's 행은 첫 뜻만 ·
--   (다른 사전 행은 이 파일이 쓰지 않는다 — 살아 있는 표라 last_used_at 등 동시 갱신이 있어 전체 비교는 하지 않는다) ·
--   해당 자료의 sequence · 다른 토큰 · dictionary 밖 칸 불변 · 학습 계약 지문 넷 불변.
-- 복원: docs/sql/en-dictionary-reviewed-20261108-rollback.sql(오너 확인 뒤에만).

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $exists$
BEGIN
  IF to_regclass('public.reading_materials') IS NULL THEN
    RAISE EXCEPTION 'relation public.reading_materials does not exist' USING ERRCODE = '42P01';
  END IF;
  IF to_regclass('public.morpheme_dictionary') IS NULL THEN
    RAISE EXCEPTION 'relation public.morpheme_dictionary does not exist' USING ERRCODE = '42P01';
  END IF;
END $exists$;

CREATE TEMP TABLE edr_pins (k text PRIMARY KEY, v text) ON COMMIT DROP;
CREATE FUNCTION pg_temp.edr_measure() RETURNS TABLE (k text, v text) LANGUAGE plpgsql AS $m$
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
INSERT INTO pg_temp.edr_pins SELECT * FROM pg_temp.edr_measure();

CREATE SCHEMA IF NOT EXISTS backup_private;
REVOKE ALL ON SCHEMA backup_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS backup_private.en_dictionary_reviewed_20261108_dict (
  base_form text PRIMARY KEY,
  action text NOT NULL CHECK (action IN ('inserted', 'kept', 'updated')),
  row_before jsonb,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS backup_private.en_dictionary_reviewed_20261108_tokens (
  material_id bigint NOT NULL,
  token_key text NOT NULL,
  token jsonb NOT NULL,
  backed_up_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (material_id, token_key)
);
ALTER TABLE backup_private.en_dictionary_reviewed_20261108_dict ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_private.en_dictionary_reviewed_20261108_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON backup_private.en_dictionary_reviewed_20261108_dict FROM PUBLIC, anon, authenticated;
REVOKE ALL ON backup_private.en_dictionary_reviewed_20261108_tokens FROM PUBLIC, anon, authenticated;

-- 원고(오너 대리 검수 — 오케스트레이터 20:42 · 20:45 KST). 대표 pos는 원고 그대로, 뜻 항목의 pos는 그 첫 품사.
CREATE TEMP TABLE edr_entries (base_form text PRIMARY KEY, pos text NOT NULL, meaning text NOT NULL) ON COMMIT DROP;
INSERT INTO pg_temp.edr_entries VALUES
  ('party', '명사', '파티, 모임'),
  ('adele', '명사', '아델(영국 가수)'),
  ('bright', '형용사', '밝은'),
  ('during', '전치사', '~ 동안'),
  ('everest', '명사', '에베레스트(세계 최고봉)'),
  ('fire', '명사·동사', '불'),
  ('floor', '명사', '바닥, 층'),
  ('forward', '부사', '앞으로'),
  ('half', '명사·형용사', '절반, 반'),
  ('i''ve', '대명사·조동사', '나는 ~해 왔다, ~했다'),
  ('kid', '명사', '아이'),
  ('light', '명사·형용사', '빛; 가벼운'),
  ('max', '명사', '맥스(이름)'),
  ('okay', '감탄사·형용사', '좋아, 괜찮은'),
  ('outside', '부사·전치사', '밖에, 밖으로'),
  ('pass', '동사', '통과하다, 지나가다'),
  ('subject', '명사', '과목, 주제'),
  ('we''re', '대명사·동사', '우리는 ~이다'),
  ('we''ve', '대명사·조동사', '우리는 ~해 왔다, ~했다'),
  ('what''s', '대명사·동사', '무엇이 ~인가'),
  ('why', '부사', '왜'),
  ('you''ll', '대명사·조동사', '너는 ~할 것이다');

-- 문맥 보정 토큰(자료 · 표면 · 바꿀 칸). 키는 운영 실측(읽기 전용 21:10 KST)과 같아야 한다.
-- th(#135 서수 접미)는 옛 분석이 pos 명사 · 뜻 「th(문자)」 · 후리가나 /θ/로 넣어 둔 것 — 후리가나도 비운다(null, 운영 토큰 관례).
CREATE TEMP TABLE edr_curated (material_id bigint, token_key text, surface text, pos text, meaning text, PRIMARY KEY (material_id, token_key)) ON COMMIT DROP;
INSERT INTO pg_temp.edr_curated VALUES
  (125, 'id_5_5_1793989994688', 'st', '접미사', '~번째(1st의 st)'),
  (137, 'id_3_5_1794076235487', 'light', '명사', '신호등(traffic light)'),
  (164, 'id_7_6_1794076348725', 'forward', '부사', '(look forward to) 기대하다'),
  (138, 'id_3_2_1794076243550', 'hotter', '형용사', '더 더운(hot의 비교급)'),
  (139, 'id_3_3_1794076249454', 'hottest', '형용사', '가장 더운(hot의 최상급)'),
  (135, 'id_8_6_1794076225321', 'th', '접미사', '~번째(…th의 th)');

-- 공개 영어 빈 뜻 내용어 토큰(함수 대상 조건과 같다 — 사전 유무와 무관).
CREATE TEMP VIEW edr_empty AS
SELECT m.id AS material_id, d.key AS token_key, d.value AS token
FROM public.reading_materials m CROSS JOIN LATERAL jsonb_each(m.processed_json->'dictionary') d
WHERE m.visibility = 'public' AND m.processed_json->>'status' = 'completed'
  AND m.processed_json->'metadata'->>'language' = 'English'
  AND jsonb_typeof(m.processed_json->'dictionary') = 'object' AND jsonb_typeof(d.value) = 'object'
  AND (m.processed_json->'sequence') ? d.key
  AND (d.value->>'pos') IS NULL AND coalesce(btrim(d.value->>'meaning'), '') = ''
  AND (d.value->>'text') ~ '[[:alpha:]]';

CREATE TEMP TABLE edr_state (applied boolean, nothing boolean) ON COMMIT DROP;

DO $pre$
DECLARE n_backup int; n_empty int; n_pub int; bad text;
BEGIN
  SELECT count(*) INTO n_backup FROM backup_private.en_dictionary_reviewed_20261108_dict;
  SELECT count(*) INTO n_pub FROM public.reading_materials m
   WHERE m.visibility = 'public' AND m.processed_json->'metadata'->>'language' = 'English'
     AND m.id IN (SELECT material_id FROM pg_temp.edr_curated);
  IF n_backup > 0 THEN
    INSERT INTO pg_temp.edr_state VALUES (true, false);
    RAISE NOTICE 'en dictionary reviewed: already applied (dict backup %)', n_backup;
    RETURN;
  END IF;
  IF n_pub = 0 THEN
    -- 공개 영어 자료가 없는 환경(fixture 사슬) — 무변경.
    INSERT INTO pg_temp.edr_state VALUES (false, true);
    RAISE NOTICE 'en dictionary reviewed: no target materials — nothing to change';
    RETURN;
  END IF;
  IF to_regprocedure('public.material_fill_empty_meanings(integer)') IS NULL
     OR to_regclass('backup_private.en_meaning_fill_20261108') IS NULL THEN
    RAISE EXCEPTION 'en dictionary reviewed: 20261108060000 (A · C) must be applied first — stop';
  END IF;
  -- 표가 없을 수 있어 위와 따로 본다(한 식이면 계획 단계에서 relation 오류가 먼저 난다).
  EXECUTE 'SELECT count(*) FROM backup_private.en_meaning_fill_20261108' INTO n_empty;
  IF n_empty < 25 THEN
    RAISE EXCEPTION 'en dictionary reviewed: 20261108060000 (A · C) must be applied first (backup %) — stop', n_empty;
  END IF;
  IF (SELECT meanings->0->>'meaning' FROM public.morpheme_dictionary WHERE language = 'English' AND base_form = 'it''s') IS DISTINCT FROM '그것은' THEN
    RAISE EXCEPTION 'en dictionary reviewed: it''s first meaning is not 그것은 — stop';
  END IF;
  -- 고칠 토큰: st · light · forward = 빈 뜻 그대로, hotter · hottest = A가 사전으로 채운 상태.
  SELECT string_agg(c.material_id || ':' || c.surface, ', ') INTO bad
  FROM pg_temp.edr_curated c LEFT JOIN public.reading_materials m ON m.id = c.material_id
  WHERE lower(m.processed_json->'dictionary'->c.token_key->>'text') IS DISTINCT FROM c.surface
     OR NOT ((m.processed_json->'sequence') ? c.token_key)
     OR (c.surface IN ('st', 'light', 'forward') AND NOT ((m.processed_json->'dictionary'->c.token_key->>'pos') IS NULL
                                                          AND coalesce(m.processed_json->'dictionary'->c.token_key->>'meaning', '') = ''))
     OR (c.surface IN ('hotter', 'hottest') AND (m.processed_json->'dictionary'->c.token_key->>'meaning_src') IS DISTINCT FROM 'dictionary')
     OR (c.surface = 'th' AND NOT (m.processed_json->'dictionary'->c.token_key->>'pos' = '명사'
                                   AND m.processed_json->'dictionary'->c.token_key->>'meaning' = 'th(문자)'));
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'en dictionary reviewed: curated tokens not in expected state (%) — stop', bad;
  END IF;
  IF (SELECT count(*) FROM public.reading_materials m CROSS JOIN LATERAL jsonb_each(m.processed_json->'dictionary') d
      WHERE m.id = 135 AND d.value->>'base_form' = 'it''s' AND d.value->>'meaning_src' = 'dictionary' AND d.value->>'meaning' = '그것은') <> 3 THEN
    RAISE EXCEPTION 'en dictionary reviewed: #135 it''s tokens not in expected state — stop';
  END IF;
  SELECT count(*) INTO n_empty FROM pg_temp.edr_empty;
  IF n_empty <> 25 THEN
    RAISE EXCEPTION 'en dictionary reviewed: expected 25 empty-meaning tokens, found % — stop', n_empty;
  END IF;
  INSERT INTO pg_temp.edr_state VALUES (false, false);
END $pre$;

-- 고치기 전 토큰: 빈 뜻 25개(채움 22 + 직접 보정 3) · A가 채운 hotter · hottest · #135 it's 3개.
INSERT INTO backup_private.en_dictionary_reviewed_20261108_tokens (material_id, token_key, token)
SELECT material_id, token_key, token FROM pg_temp.edr_empty WHERE (SELECT NOT applied AND NOT nothing FROM pg_temp.edr_state)
UNION ALL
SELECT m.id, d.key, d.value FROM public.reading_materials m CROSS JOIN LATERAL jsonb_each(m.processed_json->'dictionary') d
WHERE (SELECT NOT applied AND NOT nothing FROM pg_temp.edr_state)
  AND ((m.id, d.key) IN (SELECT material_id, token_key FROM pg_temp.edr_curated WHERE surface IN ('hotter', 'hottest', 'th'))
       OR (m.id = 135 AND d.value->>'base_form' = 'it''s' AND d.value->>'meaning_src' = 'dictionary'));

CREATE TEMP TABLE edr_before ON COMMIT DROP AS
SELECT m.id, md5((m.processed_json->'sequence')::text) seq_md5, md5((m.processed_json - 'dictionary')::text) other_md5,
  md5(coalesce((SELECT jsonb_object_agg(d.key, d.value) FROM jsonb_each(m.processed_json->'dictionary') d
                WHERE NOT EXISTS (SELECT 1 FROM backup_private.en_dictionary_reviewed_20261108_tokens t WHERE t.material_id = m.id AND t.token_key = d.key)), '{}')::text) rest_md5
FROM public.reading_materials m WHERE m.id IN (SELECT DISTINCT material_id FROM backup_private.en_dictionary_reviewed_20261108_tokens);

DO $apply$
DECLARE e record; old jsonb;
BEGIN
  IF (SELECT applied OR nothing FROM pg_temp.edr_state) THEN RETURN; END IF;
  -- ① 사전 새 행(이미 있으면 그대로 두고 남긴다).
  FOR e IN SELECT * FROM pg_temp.edr_entries ORDER BY base_form LOOP
    SELECT to_jsonb(d) INTO old FROM public.morpheme_dictionary d WHERE d.language = 'English' AND d.base_form = e.base_form;
    IF old IS NOT NULL THEN
      INSERT INTO backup_private.en_dictionary_reviewed_20261108_dict (base_form, action, row_before) VALUES (e.base_form, 'kept', old);
      RAISE NOTICE 'en dictionary reviewed: % already in dictionary — kept as is', e.base_form;
      CONTINUE;
    END IF;
    INSERT INTO public.morpheme_dictionary (base_form, language, pos, reading, meanings, source)
    VALUES (e.base_form, 'English', e.pos, NULL,
      jsonb_build_array(jsonb_build_object('pos', split_part(e.pos, '·', 1), 'verify', 'ok', 'meaning', e.meaning, 'en_pos_v', 1, 'priority', 1)),
      'user_verified');
    INSERT INTO backup_private.en_dictionary_reviewed_20261108_dict (base_form, action, row_before) VALUES (e.base_form, 'inserted', NULL);
  END LOOP;
  -- ② it's 첫 뜻.
  SELECT to_jsonb(d) INTO old FROM public.morpheme_dictionary d WHERE d.language = 'English' AND d.base_form = 'it''s';
  INSERT INTO backup_private.en_dictionary_reviewed_20261108_dict (base_form, action, row_before) VALUES ('it''s', 'updated', old);
  UPDATE public.morpheme_dictionary SET meanings = jsonb_set(meanings, '{0,meaning}', to_jsonb('그것은 ~이다'::text))
   WHERE language = 'English' AND base_form = 'it''s';
END $apply$;

-- ②' #135 it's 토큰 · ③ 문맥 보정 토큰(정해진 칸만).
UPDATE public.reading_materials m
SET processed_json = jsonb_set(m.processed_json, '{dictionary}', (
  SELECT jsonb_object_agg(d.key, CASE
    WHEN c.token_key IS NOT NULL THEN d.value || jsonb_build_object('pos', c.pos, 'meaning', c.meaning, 'meaning_src', 'curated')
                                      || CASE WHEN c.surface = 'th' THEN jsonb_build_object('furigana', NULL) ELSE '{}'::jsonb END
    WHEN m.id = 135 AND d.value->>'base_form' = 'it''s' AND d.value->>'meaning_src' = 'dictionary' AND d.value->>'meaning' = '그것은'
      THEN d.value || jsonb_build_object('meaning', '그것은 ~이다')
    ELSE d.value END)
  FROM jsonb_each(m.processed_json->'dictionary') d
  LEFT JOIN pg_temp.edr_curated c ON c.material_id = m.id AND c.token_key = d.key))
WHERE (SELECT NOT applied AND NOT nothing FROM pg_temp.edr_state)
  AND m.id IN (SELECT material_id FROM pg_temp.edr_curated UNION SELECT 135);

-- ④ 새 사전 행으로 채울 수 있게 된 빈 뜻 토큰(A와 같은 규칙).
DO $fill$
BEGIN
  -- 함수가 없는 환경(fixture 사슬)에서도 파일이 읽히도록 동적으로 부른다 — 적용 갈래에서는 사전 검사가 함수 존재를 확인했다.
  IF (SELECT NOT applied AND NOT nothing FROM pg_temp.edr_state) THEN
    EXECUTE 'SELECT public.material_fill_empty_meanings(200)';
  END IF;
END $fill$;

DO $post$
DECLARE n_left int;
BEGIN
  IF (SELECT applied OR nothing FROM pg_temp.edr_state) THEN
    DROP VIEW pg_temp.edr_empty;
    RETURN;
  END IF;
  SELECT count(*) INTO n_left FROM pg_temp.edr_empty;
  IF n_left <> 0 THEN
    RAISE EXCEPTION 'en dictionary reviewed: % empty-meaning tokens remain', n_left;
  END IF;
  -- 사전: 새 행 = 원고 · it's는 첫 뜻만.
  IF EXISTS (SELECT 1 FROM pg_temp.edr_entries e JOIN backup_private.en_dictionary_reviewed_20261108_dict b ON b.base_form = e.base_form AND b.action = 'inserted'
             LEFT JOIN public.morpheme_dictionary d ON d.language = 'English' AND d.base_form = e.base_form
             WHERE d.id IS NULL OR d.source <> 'user_verified' OR d.pos <> e.pos OR d.meanings->0->>'meaning' <> e.meaning OR jsonb_array_length(d.meanings) <> 1) THEN
    RAISE EXCEPTION 'en dictionary reviewed: inserted rows differ from the reviewed manuscript';
  END IF;
  IF EXISTS (SELECT 1 FROM backup_private.en_dictionary_reviewed_20261108_dict b JOIN public.morpheme_dictionary d ON d.language = 'English' AND d.base_form = b.base_form
             WHERE b.action = 'updated' AND to_jsonb(d) IS DISTINCT FROM jsonb_set(b.row_before, '{meanings,0,meaning}', to_jsonb('그것은 ~이다'::text))) THEN
    RAISE EXCEPTION 'en dictionary reviewed: it''s row changed beyond its first meaning';
  END IF;
  -- 토큰: 바뀐 칸만.
  IF EXISTS (
    SELECT 1 FROM backup_private.en_dictionary_reviewed_20261108_tokens b JOIN public.reading_materials m ON m.id = b.material_id
    LEFT JOIN pg_temp.edr_curated c ON c.material_id = b.material_id AND c.token_key = b.token_key
    LEFT JOIN public.morpheme_dictionary d ON d.language = 'English' AND d.base_form = coalesce(nullif(b.token->>'sep_link', ''), nullif(b.token->>'base_form', ''), b.token->>'text')
    WHERE m.processed_json->'dictionary'->b.token_key IS DISTINCT FROM CASE
      WHEN c.token_key IS NOT NULL THEN b.token || jsonb_build_object('pos', c.pos, 'meaning', c.meaning, 'meaning_src', 'curated')
                                        || CASE WHEN c.surface = 'th' THEN jsonb_build_object('furigana', NULL) ELSE '{}'::jsonb END
      WHEN b.token->>'meaning_src' = 'dictionary' THEN b.token || jsonb_build_object('meaning', '그것은 ~이다')
      ELSE b.token || jsonb_build_object('pos', d.pos, 'meaning', d.meanings->0->>'meaning', 'meaning_src', 'dictionary') END) THEN
    RAISE EXCEPTION 'en dictionary reviewed: changed tokens differ from backup + the decided fields';
  END IF;
  IF (SELECT count(*) FROM backup_private.en_dictionary_reviewed_20261108_tokens) <> 31 THEN
    RAISE EXCEPTION 'en dictionary reviewed: expected 31 backed-up tokens, found %', (SELECT count(*) FROM backup_private.en_dictionary_reviewed_20261108_tokens);
  END IF;
  IF EXISTS (
       SELECT 1 FROM pg_temp.edr_before b JOIN public.reading_materials m ON m.id = b.id
       WHERE md5((m.processed_json->'sequence')::text) <> b.seq_md5
          OR md5((m.processed_json - 'dictionary')::text) <> b.other_md5
          OR md5(coalesce((SELECT jsonb_object_agg(d.key, d.value) FROM jsonb_each(m.processed_json->'dictionary') d
                WHERE NOT EXISTS (SELECT 1 FROM backup_private.en_dictionary_reviewed_20261108_tokens t WHERE t.material_id = m.id AND t.token_key = d.key)), '{}')::text) <> b.rest_md5) THEN
    RAISE EXCEPTION 'en dictionary reviewed: sequence or untouched entries changed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_temp.edr_pins b FULL JOIN pg_temp.edr_measure() a USING (k) WHERE a.v IS DISTINCT FROM b.v) THEN
    RAISE EXCEPTION 'en dictionary reviewed: learning contract fingerprint changed — abort';
  END IF;
  DROP VIEW pg_temp.edr_empty;
END $post$;

DROP FUNCTION pg_temp.edr_measure();
