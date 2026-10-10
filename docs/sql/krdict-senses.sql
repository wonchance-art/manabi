-- 한국어기초사전(krdict) 뜻 단위 정본 — 1단계 설치 SQL. 검수 후보이며 migrations가 아니다.
-- 운영 적용은 공식본 대조 → Preview 적용·임포트 → 사후 READ ONLY 확인 뒤 별도로 한다(맨 아래 주석).
-- 출처: 국립국어원 「한국어기초사전」 https://krdict.korean.go.kr · CC BY-SA 2.0 KR.
--
-- 만드는 것(셋 다 새 표, 기존 행 UPDATE 0):
--   krdict_releases          판본 메타(입력 SHA-256·산출 해시·라이선스). 판본 하나 = 행 하나.
--   krdict_senses            뜻 단위 사전 행. (판본, 항목ID, 뜻ID)가 키이고 판본 안에서 불변이다.
--   vocabulary_krdict_senses 카드 ↔ 사전 뜻 연결(senseKey·판본). 1단계는 기록 자리만 만든다.
--
-- user_vocabulary에 열을 더하지 않는 이유(설계 변경, 근거 실측): korean-learning-support.sql의
-- learning_language_capabilities()는 user_vocabulary의 열·제약·인덱스·트리거 목록까지 해시로 봉인한다.
-- 열 하나만 더해도 해시가 달라져 한국어 저장·복습·아는 단어·제외가 전부 false로 꺼진다
-- (supabase/tests/krdict-senses.mjs가 재현). 별도 표 + FK는 봉인 대상 밖이라 기능이 그대로다.
-- 아래 보존 검사가 user_vocabulary의 행과 카탈로그가 적용 전후 같지 않으면 전체를 되돌린다.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL search_path = '';
-- 카드 쓰기를 잠깐 막아 보존 지문 비교가 동시 저장으로 흔들리지 않게 한다(빈 표 3개 생성 동안만).
LOCK TABLE public.user_vocabulary IN SHARE ROW EXCLUSIVE MODE;

DO $preflight$
BEGIN
  IF pg_catalog.to_regclass('public.krdict_releases') IS NOT NULL
     OR pg_catalog.to_regclass('public.krdict_senses') IS NOT NULL
     OR pg_catalog.to_regclass('public.vocabulary_krdict_senses') IS NOT NULL THEN
    RAISE EXCEPTION 'krdict_already_installed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated')
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon')
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
    RAISE EXCEPTION 'krdict_missing_supabase_roles';
  END IF;
  -- 카드 연결 FK가 기댈 user_vocabulary(id uuid)의 단일 열 유일 인덱스가 있어야 한다.
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
    WHERE i.indrelid = 'public.user_vocabulary'::pg_catalog.regclass AND i.indisunique AND i.indnatts = 1
      AND a.attname = 'id' AND a.atttypid = 'uuid'::pg_catalog.regtype) THEN
    RAISE EXCEPTION 'krdict_user_vocabulary_id_unique_missing';
  END IF;
END $preflight$;

-- 보존 지문: 카드 행 전체(행마다 md5 → 묶음 md5. 내용은 출력하지 않는다) + user_vocabulary 카탈로그.
CREATE FUNCTION pg_temp.krdict_user_vocabulary_fingerprint(OUT row_fp text, OUT catalog_fp text)
LANGUAGE sql STABLE AS $fingerprint$
  SELECT
    (SELECT pg_catalog.count(*)::text || ':' || pg_catalog.md5(COALESCE(pg_catalog.string_agg(pg_catalog.md5(v::text), '' ORDER BY v.id), ''))
       FROM public.user_vocabulary v),
    pg_catalog.md5(pg_catalog.concat_ws(E'\n',
      (SELECT pg_catalog.string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text, ',' ORDER BY a.attnum)
         FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'public.user_vocabulary'::pg_catalog.regclass AND a.attnum > 0 AND NOT a.attisdropped),
      (SELECT pg_catalog.string_agg(pg_catalog.pg_get_constraintdef(c.oid), ',' ORDER BY c.conname)
         FROM pg_catalog.pg_constraint c WHERE c.conrelid = 'public.user_vocabulary'::pg_catalog.regclass),
      (SELECT pg_catalog.string_agg(pg_catalog.pg_get_indexdef(i.indexrelid), ',' ORDER BY i.indexrelid::pg_catalog.regclass::text)
         FROM pg_catalog.pg_index i WHERE i.indrelid = 'public.user_vocabulary'::pg_catalog.regclass),
      (SELECT pg_catalog.string_agg(t.tgname || ':' || t.tgenabled::text, ',' ORDER BY t.tgname)
         FROM pg_catalog.pg_trigger t WHERE t.tgrelid = 'public.user_vocabulary'::pg_catalog.regclass AND NOT t.tgisinternal),
      (SELECT pg_catalog.string_agg(p.polname || ':' || COALESCE(pg_catalog.pg_get_expr(p.polqual, p.polrelid), ''), ',' ORDER BY p.polname)
         FROM pg_catalog.pg_policy p WHERE p.polrelid = 'public.user_vocabulary'::pg_catalog.regclass),
      (SELECT COALESCE(c.relacl::text, '') || ':' || c.relrowsecurity::text FROM pg_catalog.pg_class c WHERE c.oid = 'public.user_vocabulary'::pg_catalog.regclass)
    ))
$fingerprint$;
CREATE TEMP TABLE krdict_preservation ON COMMIT DROP AS SELECT * FROM pg_temp.krdict_user_vocabulary_fingerprint();

CREATE TABLE public.krdict_releases (
  id               text PRIMARY KEY CHECK (id ~ '^krdict-[0-9]{8}$'),
  snapshot_date    date NOT NULL,
  source_kind      text NOT NULL CHECK (source_kind IN ('official', 'unofficial-copy')),
  source_label     text NOT NULL CHECK (source_label = '국립국어원 한국어기초사전'),
  source_url       text NOT NULL CHECK (source_url = 'https://krdict.korean.go.kr'),
  license          text NOT NULL CHECK (license = 'CC BY-SA 2.0 KR'),
  license_url      text NOT NULL CHECK (license_url = 'https://creativecommons.org/licenses/by-sa/2.0/kr/'),
  input_format     text NOT NULL CHECK (input_format IN ('xml', 'jsonl')),
  input_files      jsonb NOT NULL CHECK (pg_catalog.jsonb_typeof(input_files) = 'array' AND pg_catalog.jsonb_array_length(input_files) > 0),
  input_digest     text NOT NULL CHECK (input_digest ~ '^[0-9a-f]{64}$'),
  output_sha256    text NOT NULL CHECK (output_sha256 ~ '^[0-9a-f]{64}$'),
  sense_count      integer NOT NULL CHECK (sense_count > 0),
  importer_version text NOT NULL,
  imported_at      timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CHECK (id = 'krdict-' || pg_catalog.to_char(snapshot_date, 'YYYYMMDD')),
  CHECK (source_kind = 'unofficial-copy' OR input_format = 'xml')
);

CREATE TABLE public.krdict_senses (
  release_id          text NOT NULL REFERENCES public.krdict_releases(id),
  entry_id            integer NOT NULL CHECK (entry_id > 0),
  sense_no            smallint NOT NULL CHECK (sense_no > 0),
  sense_key           text GENERATED ALWAYS AS ('krdict:' || entry_id::text || ':' || sense_no::text) STORED,
  headword            text NOT NULL CHECK (headword <> '' AND headword = pg_catalog.btrim(headword)),
  lookup_form         text NOT NULL CHECK (lookup_form <> '' AND lookup_form !~ '[[:space:]-]'),
  homograph_no        smallint NOT NULL CHECK (homograph_no >= 0),
  pos                 text NOT NULL CHECK (pos <> ''),
  vocab_level         text CHECK (vocab_level IN ('초급', '중급', '고급')),
  lexical_unit        text NOT NULL CHECK (lexical_unit IN ('단어', '구', '문법‧표현')),
  display_order       smallint NOT NULL CHECK (display_order > 0),
  definition_ko       text NOT NULL CHECK (definition_ko <> '' AND definition_ko = pg_catalog.btrim(definition_ko)),
  zh_cn_equivalent    text CHECK (zh_cn_equivalent <> ''),
  zh_cn_definition    text CHECK (zh_cn_definition <> ''),
  zh_cn_no_equivalent boolean NOT NULL DEFAULT false,
  PRIMARY KEY (release_id, entry_id, sense_no),
  UNIQUE (release_id, sense_key),
  CHECK (NOT zh_cn_no_equivalent OR (zh_cn_equivalent IS NULL AND zh_cn_definition IS NOT NULL))
);
-- 표제어 조회(활성 판본 + 공백·하이픈 뺀 표제어).
CREATE INDEX krdict_senses_lookup ON public.krdict_senses (release_id, lookup_form);

CREATE TABLE public.vocabulary_krdict_senses (
  vocabulary_id uuid PRIMARY KEY REFERENCES public.user_vocabulary(id) ON DELETE CASCADE,
  release_id    text NOT NULL,
  sense_key     text NOT NULL CHECK (sense_key ~ '^krdict:[1-9][0-9]{0,8}:[1-9][0-9]{0,3}$'),
  created_at    timestamptz NOT NULL DEFAULT pg_catalog.now(),
  -- 판본에 실제로 있는 뜻만 가리킬 수 있고, 카드가 가리키는 뜻 행은 지울 수 없다.
  FOREIGN KEY (release_id, sense_key) REFERENCES public.krdict_senses(release_id, sense_key)
);
CREATE INDEX vocabulary_krdict_senses_sense ON public.vocabulary_krdict_senses (release_id, sense_key);

-- 권한: morpheme_dictionary 선례(인증 사용자 읽기, 쓰기는 service_role). Supabase 기본 권한이
-- 새 표에 anon·authenticated·service_role ALL(TRUNCATE 포함 — RLS 밖)을 주므로 먼저 전부 걷는다.
-- service_role에도 UPDATE·TRUNCATE를 주지 않는다: 판본 행 불변(senseKey+판본 → 같은 문구).
ALTER TABLE public.krdict_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.krdict_senses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocabulary_krdict_senses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.krdict_releases, public.krdict_senses, public.vocabulary_krdict_senses
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.krdict_releases, public.krdict_senses, public.vocabulary_krdict_senses TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.krdict_releases, public.krdict_senses, public.vocabulary_krdict_senses TO service_role;
CREATE POLICY krdict_releases_read ON public.krdict_releases FOR SELECT TO authenticated USING (true);
CREATE POLICY krdict_senses_read ON public.krdict_senses FOR SELECT TO authenticated USING (true);
-- 연결은 자기 카드 것만 읽는다. 1단계는 쓰기 경로가 없다(2단계 저장 경로가 service_role로 기록).
CREATE POLICY vocabulary_krdict_senses_owner_read ON public.vocabulary_krdict_senses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_vocabulary v
                 WHERE v.id = vocabulary_krdict_senses.vocabulary_id AND v.user_id = (SELECT auth.uid())));

DO $preservation$
DECLARE before record; after record;
BEGIN
  SELECT * INTO before FROM pg_temp.krdict_preservation;
  SELECT * INTO after FROM pg_temp.krdict_user_vocabulary_fingerprint();
  IF after.row_fp IS DISTINCT FROM before.row_fp THEN RAISE EXCEPTION 'krdict_user_vocabulary_rows_changed'; END IF;
  IF after.catalog_fp IS DISTINCT FROM before.catalog_fp THEN RAISE EXCEPTION 'krdict_user_vocabulary_catalog_changed'; END IF;
END $preservation$;
DROP FUNCTION pg_temp.krdict_user_vocabulary_fingerprint();

NOTIFY pgrst, 'reload schema';
COMMIT;

-- ───────────────────────────────────────────────────────────────────────────
-- 사후 READ ONLY 확인(적용·임포트 뒤 BEGIN READ ONLY; … ROLLBACK; 으로 실행. 이 파일의 나머지와 별개)
--   SELECT id, source_kind, input_digest, output_sha256, sense_count,
--          (SELECT count(*) FROM public.krdict_senses s WHERE s.release_id = r.id) AS loaded
--     FROM public.krdict_releases r;                       -- loaded = sense_count, 해시 = 임포트 보고서
--   SELECT sense_key, definition_ko, zh_cn_equivalent FROM public.krdict_senses
--    WHERE release_id = 'krdict-20260619'
--      AND sense_key IN ('krdict:71307:1','krdict:66574:1','krdict:29667:1','krdict:65528:1');
--   SELECT relname, relrowsecurity FROM pg_class
--    WHERE oid IN ('public.krdict_releases'::regclass,'public.krdict_senses'::regclass,'public.vocabulary_krdict_senses'::regclass);
--   SELECT table_name, grantee, string_agg(privilege_type, ',' ORDER BY privilege_type)
--     FROM information_schema.role_table_grants
--    WHERE table_schema = 'public' AND table_name IN ('krdict_releases','krdict_senses','vocabulary_krdict_senses')
--    GROUP BY 1, 2 ORDER BY 1, 2;                          -- anon 없음, authenticated SELECT, service_role DELETE,INSERT,SELECT
--   SELECT count(*) FROM public.vocabulary_krdict_senses;  -- 1단계는 0
-- 정상 계정에서 learning_language_capabilities()가 적용 전과 같이 all-true인지 함께 확인한다.
