-- 공개 영어 자료의 빈 뜻 토큰을 공유 사전으로 채운다(SEED-QA-002 A · C — 2026-11-08 KST, 오케스트레이터 20:32 승인:
-- 「A 마이그레이션 PR · C ⑴ 같은 PR, 하루 상한 · 공개 자료 한정 · 실행 줄은 observe.cron_runs」). 적용 경로 = main 병합 → db push, 암묵 트랜잭션 하나.
--
-- 실측(운영, 읽기 전용 20:40 KST): 공개 영어 60편 중 33편에 내용어 토큰 50개가 pos null · 뜻 빈칸으로 남아 있다.
--   원인: analyzeCore의 「뜻 조회 실패 · 상한 초과분은 빈 뜻으로 넘기고 다음 요청에서 백필」 설계(analyzeCore.js MAX_MISSING).
--   시드는 저장 뒤 다시 분석 요청이 오지 않으므로 백필이 일어나지 않았다. 원문 · 토큰 이음은 정상(커버리지 어긋남 0), 카드 뜻 · 품사만 빈다.
--   그중 25개(15편 · 표제어 13개)는 지금 공유 사전(morpheme_dictionary)에 pos와 뜻이 있다 → 이 파일이 채운다.
--   나머지 25개(표제어 23개)는 사전에도 없다 → 뜻 생성 · 콘텐츠 검수(B) 뒤 사전에 들어오면, 아래 함수가 같은 규칙으로 채운다.
--
-- 채우는 규칙(analyzeCore 응답 조립과 같은 값): 토큰의 사전 키(sep_link ‖ base_form ‖ text)와 같은 영어 사전 행이 있고
--   pos · 첫 뜻이 비어 있지 않으면 pos = 사전 pos · meaning = 사전 meanings[0].meaning. 출처 표식 meaning_src = 'dictionary'
--   (zh 'curated'와 같은 칸 — 지금 읽는 곳 없음, 복원 표식). 그 밖의 칸(text · base_form · furigana · lemma 후보)과 원문 · sequence ·
--   다른 토큰 · metadata(updated_at · viewerRevision 포함) · status · 공개 범위 · 소유권은 그대로. LLM 호출 없음.
-- 대상: 공개 · completed · 영어 · sequence에 있는 토큰 · 글자가 있는 표면 · pos null · 뜻 빈칸.
-- 함수 public.material_fill_empty_meanings(p_limit): 그 규칙을 자료 p_limit편(기본 50 · 최대 200)까지 적용하고
--   {materials, tokens, ids, remaining(사전으로 채울 수 있는데 남은 토큰), unfillable(사전에 없는 토큰), more}를 돌려준다.
--   쓰는 쪽: src/lib/server/materialMeaningFill.js — 분석 작업 크론(02:45 KST) 사슬 끝에서 한 번, 실행 줄 detail.meaningFill.
--   service_role만 실행(anon · authenticated 닫힘 — 사후 검사).
-- 사전 검사(지금 채움 — A): 대상 안에 실측 25개(자료별 114:1 · 115:1 · 116:1 · 118:1 · 122:1 · 124:1 · 128:4 · 133:3 · 135:3 · 138:1 ·
--   139:1 · 147:3 · 148:1 · 154:2 · 174:1)가 모두 있어야 한다. 사전은 살아 있는 표라 적용 전에 행이 늘 수 있으므로, 늘어난 대상은
--   같은 규칙으로 함께 채우되 전체 50개(빈 뜻 토큰 전부)를 넘으면 멈춘다. 고치기 전 토큰은 backup_private.en_meaning_fill_20261108에 남긴다.
--   이미 적용(채울 대상 0 · 백업 있음) 또는 고칠 것이 없는 환경(대상 0 · 백업 0 — fixture 사슬)이면 무변경.
-- 사후 검사(같은 트랜잭션): 채울 대상 0 · 바뀐 토큰 = 백업 + {pos, meaning, meaning_src} · 해당 자료의 sequence · 다른 토큰 · dictionary 밖 칸 불변 ·
--   학습 계약 지문 넷 불변 · 함수 권한.
-- 복원: docs/sql/en-meaning-fill-20261108-rollback.sql(오너 확인 뒤에만).

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

CREATE TEMP TABLE emf_pins (k text PRIMARY KEY, v text) ON COMMIT DROP;
CREATE FUNCTION pg_temp.emf_measure() RETURNS TABLE (k text, v text) LANGUAGE plpgsql AS $m$
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
INSERT INTO pg_temp.emf_pins SELECT * FROM pg_temp.emf_measure();

CREATE OR REPLACE FUNCTION public.material_fill_empty_meanings(p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_limit integer := least(greatest(coalesce(p_limit, 50), 0), 200);
  r record;
  v_materials integer := 0;
  v_tokens integer := 0;
  v_ids bigint[] := ARRAY[]::bigint[];
  v_remaining integer;
  v_unfillable integer;
  n integer;
BEGIN
  FOR r IN
    WITH c AS (
      SELECT m.id, d.key, md.pos AS dpos, md.meanings->0->>'meaning' AS dmean
      FROM public.reading_materials m
      CROSS JOIN LATERAL jsonb_each(m.processed_json->'dictionary') d
      JOIN public.morpheme_dictionary md
        ON md.language = 'English'
       AND md.base_form = coalesce(nullif(d.value->>'sep_link', ''), nullif(d.value->>'base_form', ''), d.value->>'text')
      WHERE m.visibility = 'public'
        AND m.processed_json->>'status' = 'completed'
        AND m.processed_json->'metadata'->>'language' = 'English'
        AND jsonb_typeof(m.processed_json->'dictionary') = 'object'
        AND jsonb_typeof(d.value) = 'object'
        AND (m.processed_json->'sequence') ? d.key
        AND (d.value->>'pos') IS NULL
        AND coalesce(btrim(d.value->>'meaning'), '') = ''
        AND (d.value->>'text') ~ '[[:alpha:]]'
        AND coalesce(btrim(md.pos), '') <> ''
        AND coalesce(btrim(md.meanings->0->>'meaning'), '') <> ''
    )
    SELECT id, jsonb_object_agg(key, jsonb_build_object('pos', dpos, 'meaning', dmean, 'meaning_src', 'dictionary')) AS patch, count(*) AS n
    FROM c GROUP BY id ORDER BY id LIMIT v_limit
  LOOP
    -- 고르는 사이 다른 쓰기가 끼어들었으면 그 토큰은 건너뛴다(여기서도 pos null · 뜻 빈칸을 다시 본다).
    UPDATE public.reading_materials m
       SET processed_json = jsonb_set(m.processed_json, '{dictionary}', (
         SELECT jsonb_object_agg(d.key, CASE
                  WHEN r.patch ? d.key AND (d.value->>'pos') IS NULL AND coalesce(btrim(d.value->>'meaning'), '') = ''
                    THEN d.value || (r.patch->d.key)
                  ELSE d.value END)
         FROM jsonb_each(m.processed_json->'dictionary') d))
     WHERE m.id = r.id
       AND m.visibility = 'public'
       AND m.processed_json->>'status' = 'completed';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 1 THEN
      v_materials := v_materials + 1;
      v_tokens := v_tokens + r.n;
      v_ids := v_ids || r.id;
    END IF;
  END LOOP;

  SELECT count(*) FILTER (WHERE md.base_form IS NOT NULL AND coalesce(btrim(md.pos), '') <> '' AND coalesce(btrim(md.meanings->0->>'meaning'), '') <> ''),
         count(*) FILTER (WHERE md.base_form IS NULL OR coalesce(btrim(md.pos), '') = '' OR coalesce(btrim(md.meanings->0->>'meaning'), '') = '')
    INTO v_remaining, v_unfillable
  FROM public.reading_materials m
  CROSS JOIN LATERAL jsonb_each(m.processed_json->'dictionary') d
  LEFT JOIN public.morpheme_dictionary md
    ON md.language = 'English'
   AND md.base_form = coalesce(nullif(d.value->>'sep_link', ''), nullif(d.value->>'base_form', ''), d.value->>'text')
  WHERE m.visibility = 'public'
    AND m.processed_json->>'status' = 'completed'
    AND m.processed_json->'metadata'->>'language' = 'English'
    AND jsonb_typeof(m.processed_json->'dictionary') = 'object'
    AND jsonb_typeof(d.value) = 'object'
    AND (m.processed_json->'sequence') ? d.key
    AND (d.value->>'pos') IS NULL
    AND coalesce(btrim(d.value->>'meaning'), '') = ''
    AND (d.value->>'text') ~ '[[:alpha:]]';

  RETURN jsonb_build_object('materials', v_materials, 'tokens', v_tokens, 'ids', to_jsonb(v_ids),
    'remaining', coalesce(v_remaining, 0), 'unfillable', coalesce(v_unfillable, 0), 'more', coalesce(v_remaining, 0) > 0);
END
$function$;

REVOKE ALL ON FUNCTION public.material_fill_empty_meanings(integer) FROM PUBLIC;
DO $grants$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE 'REVOKE ALL ON FUNCTION public.material_fill_empty_meanings(integer) FROM anon'; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE 'REVOKE ALL ON FUNCTION public.material_fill_empty_meanings(integer) FROM authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN EXECUTE 'GRANT EXECUTE ON FUNCTION public.material_fill_empty_meanings(integer) TO service_role'; END IF;
END $grants$;

-- A: 지금 채울 수 있는 것을 채운다(백업 먼저).
CREATE SCHEMA IF NOT EXISTS backup_private;
REVOKE ALL ON SCHEMA backup_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS backup_private.en_meaning_fill_20261108 (
  material_id bigint NOT NULL,
  token_key text NOT NULL,
  token jsonb NOT NULL,
  backed_up_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (material_id, token_key)
);
ALTER TABLE backup_private.en_meaning_fill_20261108 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON backup_private.en_meaning_fill_20261108 FROM PUBLIC, anon, authenticated;

-- 채울 대상(함수와 같은 조건 — 사전으로 채울 수 있는 빈 뜻 토큰).
CREATE TEMP VIEW emf_target AS
SELECT m.id AS material_id, d.key AS token_key, d.value AS token, md.pos AS dpos, md.meanings->0->>'meaning' AS dmean
FROM public.reading_materials m
CROSS JOIN LATERAL jsonb_each(m.processed_json->'dictionary') d
JOIN public.morpheme_dictionary md
  ON md.language = 'English'
 AND md.base_form = coalesce(nullif(d.value->>'sep_link', ''), nullif(d.value->>'base_form', ''), d.value->>'text')
WHERE m.visibility = 'public'
  AND m.processed_json->>'status' = 'completed'
  AND m.processed_json->'metadata'->>'language' = 'English'
  AND jsonb_typeof(m.processed_json->'dictionary') = 'object'
  AND jsonb_typeof(d.value) = 'object'
  AND (m.processed_json->'sequence') ? d.key
  AND (d.value->>'pos') IS NULL
  AND coalesce(btrim(d.value->>'meaning'), '') = ''
  AND (d.value->>'text') ~ '[[:alpha:]]'
  AND coalesce(btrim(md.pos), '') <> ''
  AND coalesce(btrim(md.meanings->0->>'meaning'), '') <> '';

CREATE TEMP TABLE emf_before ON COMMIT DROP AS
SELECT m.id, md5((m.processed_json->'sequence')::text) seq_md5, md5((m.processed_json - 'dictionary')::text) other_md5,
  md5(coalesce((SELECT jsonb_object_agg(d.key, d.value) FROM jsonb_each(m.processed_json->'dictionary') d
                WHERE NOT EXISTS (SELECT 1 FROM pg_temp.emf_target t WHERE t.material_id = m.id AND t.token_key = d.key)), '{}')::text) rest_md5
FROM public.reading_materials m WHERE m.id IN (SELECT DISTINCT material_id FROM pg_temp.emf_target);

DO $pre$
DECLARE n_tok int; n_backup int; per jsonb; expected jsonb := '{"114": 1, "115": 1, "116": 1, "118": 1, "122": 1, "124": 1, "128": 4, "133": 3,
  "135": 3, "138": 1, "139": 1, "147": 3, "148": 1, "154": 2, "174": 1}'::jsonb; k text;
BEGIN
  SELECT count(*) INTO n_tok FROM pg_temp.emf_target;
  SELECT count(*) INTO n_backup FROM backup_private.en_meaning_fill_20261108;
  IF n_tok = 0 THEN
    -- 이미 적용(백업 있음) 또는 고칠 것이 없는 환경(공개 영어 자료가 없는 fixture 사슬) — 무변경.
    RAISE NOTICE 'en meaning fill: nothing to fill now (backup %)', n_backup;
    RETURN;
  END IF;
  SELECT jsonb_object_agg(material_id::text, c) INTO per FROM (SELECT material_id, count(*) c FROM pg_temp.emf_target GROUP BY 1) x;
  IF n_backup <> 0 OR n_tok > 50 THEN
    RAISE EXCEPTION 'en meaning fill: unexpected state (targets %, backup %) — stop', n_tok, n_backup;
  END IF;
  FOR k IN SELECT jsonb_object_keys(expected) LOOP
    IF coalesce((per->>k)::int, 0) < (expected->>k)::int THEN
      RAISE EXCEPTION 'en meaning fill: material % has % targets, expected at least % — stop', k, coalesce(per->>k, '0'), expected->>k;
    END IF;
  END LOOP;
  INSERT INTO backup_private.en_meaning_fill_20261108 (material_id, token_key, token) SELECT material_id, token_key, token FROM pg_temp.emf_target;
  RAISE NOTICE 'en meaning fill: backing up and filling % tokens in % materials', n_tok, (SELECT count(DISTINCT material_id) FROM pg_temp.emf_target);
END $pre$;

CREATE TEMP TABLE emf_expected ON COMMIT DROP AS
SELECT material_id, token_key, token || jsonb_build_object('pos', dpos, 'meaning', dmean, 'meaning_src', 'dictionary') AS token
FROM pg_temp.emf_target;

SELECT public.material_fill_empty_meanings(200);

DO $post$
BEGIN
  IF (SELECT count(*) FROM pg_temp.emf_target) <> 0 THEN
    RAISE EXCEPTION 'en meaning fill: fillable targets remain after fill';
  END IF;
  -- 이번에 채운 것이 있을 때만: 백업 = 채운 토큰 집합 · 지금 값 = 백업 + {pos, meaning, meaning_src}.
  IF EXISTS (SELECT 1 FROM pg_temp.emf_expected) AND (
       EXISTS (SELECT 1 FROM pg_temp.emf_expected e JOIN public.reading_materials m ON m.id = e.material_id
               WHERE m.processed_json->'dictionary'->e.token_key IS DISTINCT FROM e.token)
    OR EXISTS (SELECT 1 FROM pg_temp.emf_expected e
               WHERE NOT EXISTS (SELECT 1 FROM backup_private.en_meaning_fill_20261108 b WHERE b.material_id = e.material_id AND b.token_key = e.token_key))
    OR EXISTS (SELECT 1 FROM backup_private.en_meaning_fill_20261108 b
               WHERE NOT EXISTS (SELECT 1 FROM pg_temp.emf_expected e WHERE e.material_id = b.material_id AND e.token_key = b.token_key))
    OR EXISTS (SELECT 1 FROM backup_private.en_meaning_fill_20261108 b JOIN pg_temp.emf_expected e USING (material_id, token_key)
               WHERE e.token IS DISTINCT FROM b.token || jsonb_build_object('pos', e.token->'pos', 'meaning', e.token->'meaning', 'meaning_src', 'dictionary')
                  OR coalesce(btrim(e.token->>'pos'), '') = '' OR coalesce(btrim(e.token->>'meaning'), '') = '')) THEN
    RAISE EXCEPTION 'en meaning fill: changed tokens differ from backup + {pos, meaning, meaning_src}';
  END IF;
  IF EXISTS (
       SELECT 1 FROM pg_temp.emf_before b JOIN public.reading_materials m ON m.id = b.id
       WHERE md5((m.processed_json->'sequence')::text) <> b.seq_md5
          OR md5((m.processed_json - 'dictionary')::text) <> b.other_md5
          OR md5(coalesce((SELECT jsonb_object_agg(d.key, d.value) FROM jsonb_each(m.processed_json->'dictionary') d
                WHERE NOT EXISTS (SELECT 1 FROM pg_temp.emf_expected x WHERE x.material_id = m.id AND x.token_key = d.key)), '{}')::text) <> b.rest_md5) THEN
    RAISE EXCEPTION 'en meaning fill: sequence or untouched entries changed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AND has_function_privilege('anon', 'public.material_fill_empty_meanings(integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'material_fill_empty_meanings must be closed to anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') AND has_function_privilege('authenticated', 'public.material_fill_empty_meanings(integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'material_fill_empty_meanings must be closed to authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_temp.emf_pins b FULL JOIN pg_temp.emf_measure() a USING (k) WHERE a.v IS DISTINCT FROM b.v) THEN
    RAISE EXCEPTION 'en meaning fill: learning contract fingerprint changed — abort';
  END IF;
END $post$;

DROP VIEW pg_temp.emf_target;
DROP FUNCTION pg_temp.emf_measure();
