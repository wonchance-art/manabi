-- 운영 오류 기록(ERROR-OBSERVE-001, 2026-11-06 KST — 오너 11/4 「백엔드 · 데이터 자율」). Vercel Hobby 런타임 로그는 1시간만 남아
-- 오류 화면의 「오류 ID」(digest)를 다음 날 찾을 길이 없었다. 브라우저 오류(/api/client-error)와 서버 오류(instrumentation onRequestError)를
-- 정리된 칸만 30일 남긴다. 화면 변화 없음 · 새 환경 변수 없음(서버 쓰기는 기존 SUPABASE_SERVICE_ROLE_KEY).
--
-- 담는 칸(전부): 시각 · 출처(client | server) · 종류 · 메시지(500자) · 스택 앞부분(1000자) · digest · 경로(쿼리 없음 · ID 자리표) ·
--   배포 판(빌드 SHA 7자리) · 브라우저 계열(예: safari-mobile) · 같은 오류 횟수(hits). 담지 않는 것: IP · 계정 ID · 요청 본문 · 입력 글 · 토큰 ·
--   전체 User-Agent. 계정 ID를 두지 않는 이유: 최소 수집 + profiles · auth.users를 FK로 참조하면 그 표에 내부 트리거가 붙어 activity
--   (→ admission) 지문이 바뀐다(CONV-LOBBY-001 실측) — 이 표는 어떤 표도 참조하지 않는다.
-- 정리(앱 errorEvent.js)를 믿지 않고 이 함수가 다시 자른다(길이 · 모양 · 쿼리). 같은 오류(지문 = 출처 · 종류 · 메시지 · 경로 · digest · 판)는
--   한 시간 칸마다 한 줄(hits만 오른다). 새 줄은 분당 30 · 하루 1000을 넘으면 버린다(쏟아짐 방지). 30일 지난 줄은 새 줄을 쓸 때 200줄씩 지운다
--   (cron 없음 — 상한 = 하루 1000 × 30일).
-- 접근: 스키마 observe(Data API 노출 밖) · RLS 켜짐 · 정책 없음 · anon · authenticated · service_role 표 권한 없음. 쓰기는 SECURITY DEFINER
--   public.observe_record_error 하나(service_role만 실행). 읽기는 SQL 편집기(postgres)에서만 — 질의는 보드 ERROR-OBSERVE-001.
-- 학습 계약 지문 범위 밖: 새 스키마 · 새 표 · 새 함수만(public 표 · fsrs_ 이름 · capability 의존 · public/auth 스키마 권한을 건드리지 않는다).
--   아래 사전 · 사후 측정이 지문 넷(_live) + capability 함수 정의가 적용 전과 같음을 확인한다(#1697 — capability는 부르지 않고 정의를 잰다).
-- 적용 경로: main 병합 → supabase-migrations.yml(db push), 암묵 트랜잭션 하나(검사가 RAISE하면 전부 롤백). 멱등(IF NOT EXISTS · OR REPLACE).
-- 되돌리기: docs/sql/error-events-20261106-rollback.sql(함수 · 스키마 삭제 — 오류 기록만 사라진다, 학습 데이터 무관).

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TEMP TABLE eo_pins (k text PRIMARY KEY, v text) ON COMMIT DROP;
CREATE FUNCTION pg_temp.eo_measure() RETURNS TABLE (k text, v text) LANGUAGE plpgsql AS $m$
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
  -- capability 함수는 로그인 사용자만 부른다(db push엔 로그인 맥락 없음 — #1697) — 정의를 카탈로그에서 잰다.
  k := 'capability';
  SELECT md5(pg_catalog.pg_get_functiondef(p.oid)) || '|' || coalesce(p.proacl::text, '') || '|' || p.proowner::text
           || '|' || p.provolatile::text || '|' || p.prosecdef::text || '|' || coalesce(p.proconfig::text, '')
    INTO v FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'learning_language_capabilities' AND p.pronargs = 0;
  RETURN NEXT;
END $m$;
INSERT INTO pg_temp.eo_pins SELECT * FROM pg_temp.eo_measure();

DO $pre$
BEGIN
  -- 이미 있는 스키마 observe가 이 마이그레이션을 적용하는 역할 것이 아니면 멈춘다(남의 스키마에 표 · 권한을 얹지 않는다). 재실행은 통과(아래가 모두 멱등).
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = 'observe' AND nspowner <> (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user)) THEN
    RAISE EXCEPTION 'error events: schema observe exists with another owner — stop';
  END IF;
  -- 표가 이미 있으면 같은 모양이어야 한다(재실행). 다른 모양이면 멈춘다.
  IF to_regclass('observe.error_events') IS NOT NULL THEN
    IF (SELECT count(*) FROM pg_catalog.pg_attribute WHERE attrelid = to_regclass('observe.error_events') AND attnum > 0 AND NOT attisdropped) <> 14 THEN
      RAISE EXCEPTION 'error events: observe.error_events exists with a different shape — stop';
    END IF;
  END IF;
END $pre$;

CREATE SCHEMA IF NOT EXISTS observe;
REVOKE ALL ON SCHEMA observe FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS observe.error_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  bucket timestamptz NOT NULL,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{32}$'),
  hits integer NOT NULL DEFAULT 1 CHECK (hits >= 1),
  source text NOT NULL CHECK (source IN ('client', 'server')),
  kind text NOT NULL CHECK (kind ~ '^[a-z][a-z0-9_.-]{0,47}$'),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500),
  stack text CHECK (char_length(stack) <= 1000),
  digest text CHECK (digest ~ '^[A-Za-z0-9@:_-]{1,64}$'),
  route text CHECK (char_length(route) <= 200 AND left(route, 1) = '/' AND strpos(route, '?') = 0 AND strpos(route, '#') = 0),
  release text CHECK (release ~ '^[a-z0-9]{3,40}$'),
  browser text CHECK (browser ~ '^[a-z]{2,12}(-mobile)?$'),
  CONSTRAINT error_events_fingerprint_bucket_key UNIQUE (fingerprint, bucket)
);
CREATE INDEX IF NOT EXISTS error_events_created_at_idx ON observe.error_events (created_at);
CREATE INDEX IF NOT EXISTS error_events_digest_idx ON observe.error_events (digest) WHERE digest IS NOT NULL;
ALTER TABLE observe.error_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE observe.error_events FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.observe_record_error(
  p_source text, p_kind text, p_message text, p_stack text, p_digest text, p_route text, p_release text, p_browser text)
 RETURNS text
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_now timestamptz := pg_catalog.now();
  v_bucket timestamptz := pg_catalog.to_timestamp(pg_catalog.floor(pg_catalog.date_part('epoch', pg_catalog.now()) / 3600) * 3600);
  v_message text := left(btrim(regexp_replace(coalesce(p_message, ''), '\s+', ' ', 'g')), 500);
  v_stack text := nullif(left(btrim(coalesce(p_stack, '')), 1000), '');
  v_route text := nullif(left(split_part(split_part(btrim(coalesce(p_route, '')), '?', 1), '#', 1), 200), '');
  v_digest text := CASE WHEN p_digest ~ '^[A-Za-z0-9@:_-]{1,64}$' THEN p_digest END;
  v_release text := CASE WHEN p_release ~ '^[a-z0-9]{3,40}$' THEN p_release END;
  v_browser text := CASE WHEN p_browser ~ '^[a-z]{2,12}(-mobile)?$' THEN p_browser END;
  v_fp text;
BEGIN
  IF p_source IS NULL OR p_source NOT IN ('client', 'server') OR p_kind IS NULL OR p_kind !~ '^[a-z][a-z0-9_.-]{0,47}$' OR v_message = '' THEN
    RETURN 'invalid';
  END IF;
  IF v_route IS NOT NULL AND left(v_route, 1) <> '/' THEN v_route := NULL; END IF;
  v_fp := md5(concat_ws(chr(31), p_source, p_kind, v_message, coalesce(v_route, ''), coalesce(v_digest, ''), coalesce(v_release, '')));

  UPDATE observe.error_events SET hits = least(hits, 2147483646) + 1, last_seen_at = v_now
   WHERE fingerprint = v_fp AND bucket = v_bucket;
  IF FOUND THEN RETURN 'counted'; END IF;

  -- 새 줄 상한(쏟아짐 방지): 분당 30 · 하루 1000. created_at 색인으로 상한 개수만큼만 센다.
  IF (SELECT count(*) FROM (SELECT 1 FROM observe.error_events WHERE created_at > v_now - interval '1 minute' LIMIT 30) s) >= 30
     OR (SELECT count(*) FROM (SELECT 1 FROM observe.error_events WHERE created_at > v_now - interval '1 day' LIMIT 1000) s) >= 1000 THEN
    RETURN 'dropped';
  END IF;

  INSERT INTO observe.error_events (created_at, last_seen_at, bucket, fingerprint, source, kind, message, stack, digest, route, release, browser)
  VALUES (v_now, v_now, v_bucket, v_fp, p_source, p_kind, v_message, v_stack, v_digest, v_route, v_release, v_browser)
  ON CONFLICT (fingerprint, bucket) DO UPDATE SET hits = least(observe.error_events.hits, 2147483646) + 1, last_seen_at = EXCLUDED.last_seen_at;

  -- 보존 30일: 새 줄을 쓸 때만, 한 번에 200줄까지(지울 것이 없으면 색인 한 번 보고 끝).
  DELETE FROM observe.error_events WHERE id IN (
    SELECT id FROM observe.error_events WHERE created_at < v_now - interval '30 days' ORDER BY created_at LIMIT 200);
  RETURN 'recorded';
END;
$function$;

REVOKE ALL ON FUNCTION public.observe_record_error(text, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.observe_record_error(text, text, text, text, text, text, text, text) TO service_role;

DO $post$
BEGIN
  IF has_schema_privilege('anon', 'observe', 'USAGE') OR has_schema_privilege('authenticated', 'observe', 'USAGE')
     OR has_table_privilege('anon', 'observe.error_events', 'SELECT') OR has_table_privilege('authenticated', 'observe.error_events', 'SELECT')
     OR has_table_privilege('service_role', 'observe.error_events', 'SELECT')
     OR has_table_privilege('anon', 'observe.error_events', 'INSERT') OR has_table_privilege('authenticated', 'observe.error_events', 'INSERT') THEN
    RAISE EXCEPTION 'error events: observe.error_events is reachable by an API role — rolled back';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid = 'observe.error_events'::regclass) THEN
    RAISE EXCEPTION 'error events: RLS is off on observe.error_events — rolled back';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid = 'observe.error_events'::regclass) THEN
    RAISE EXCEPTION 'error events: unexpected policy on observe.error_events — rolled back';
  END IF;
  IF has_function_privilege('anon', 'public.observe_record_error(text,text,text,text,text,text,text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.observe_record_error(text,text,text,text,text,text,text,text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.observe_record_error(text,text,text,text,text,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'error events: execute grants differ (service_role only) — rolled back';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_temp.eo_pins b FULL JOIN pg_temp.eo_measure() a USING (k) WHERE a.v IS DISTINCT FROM b.v) THEN
    RAISE EXCEPTION 'error events: learning contract fingerprint changed — rolled back';
  END IF;
END $post$;

DROP FUNCTION pg_temp.eo_measure();
