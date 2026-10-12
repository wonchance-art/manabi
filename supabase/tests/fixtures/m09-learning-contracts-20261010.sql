-- LEARN-CONTRACT-CATALOG-001: observed production metadata, 2026-10-10.
-- Source: #1337 comment 6093632776; READ ONLY extraction, no learner rows.
-- PGLITE EMPTY DATABASE ONLY. NOT a migration or an operational apply script.
-- Run after modernFixtureSql (korean-learning-support.mjs) and
-- docs/sql/korean-learning-support.sql, BEFORE seeding any synthetic learner.
-- Function bodies, table/view definitions, policies, triggers, owners and ACLs
-- are observed facts. OIDs and local contract pins are deliberately local.
-- auth.users/auth.role remain the preceding fixture's synthetic infrastructure.
-- Supabase binary extensions are unavailable here; their captured SQL wrappers
-- and event hooks are preserved. No extension implementation is fabricated.
BEGIN;
SET LOCAL search_path = '';
SET LOCAL check_function_bodies = off;
DO $local_only$
BEGIN
 IF position('PGlite' IN version()) = 0 THEN
  RAISE EXCEPTION 'm09_fixture_requires_pglite';
 END IF;
 IF EXISTS (SELECT FROM auth.users) THEN
  RAISE EXCEPTION 'm09_fixture_requires_empty_auth';
 END IF;
END $local_only$;


DO $empty_only$
DECLARE target text; occupied boolean;
BEGIN
 FOREACH target IN ARRAY ARRAY['fsrs_private.activity_baselines','fsrs_private.activity_receipts','fsrs_private.activity_settings','fsrs_private.admission_config_receipts','fsrs_private.admission_permits','fsrs_private.admission_policies','fsrs_private.admission_requests','fsrs_private.admission_settings','fsrs_private.event_permits','fsrs_private.legacy_admissions','fsrs_private.manual_save_settings','fsrs_private.settings','public.fsrs_cards','public.fsrs_manual_save_receipts','public.fsrs_new_receipts','public.fsrs_operations','public.profiles','public.reading_materials','public.review_events','public.uploaded_pdfs','public.user_known_words','public.user_vocabulary','public.vocabulary_contexts','public.vocabulary_exclusions'] LOOP
  IF pg_catalog.to_regclass(target) IS NOT NULL THEN
   EXECUTE 'SELECT EXISTS (SELECT FROM ' || target || ')' INTO occupied;
   IF occupied THEN RAISE EXCEPTION 'm09_fixture_requires_empty_table: %', target; END IF;
  END IF;
 END LOOP;
END $empty_only$;


DO $role$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'dashboard_user') THEN CREATE ROLE "dashboard_user" NOLOGIN; END IF; END $role$;

ALTER ROLE "dashboard_user" NOSUPERUSER INHERIT NOBYPASSRLS CREATEDB CREATEROLE REPLICATION;

DO $role$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE "authenticated" NOLOGIN; END IF; END $role$;

ALTER ROLE "authenticated" NOSUPERUSER INHERIT NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;

DO $role$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN CREATE ROLE "anon" NOLOGIN; END IF; END $role$;

ALTER ROLE "anon" NOSUPERUSER INHERIT NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;

DO $role$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE "service_role" NOLOGIN; END IF; END $role$;

ALTER ROLE "service_role" NOSUPERUSER INHERIT BYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;

DO $role$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'supabase_admin') THEN CREATE ROLE "supabase_admin" NOLOGIN; END IF; END $role$;

ALTER ROLE "supabase_admin" SUPERUSER INHERIT BYPASSRLS CREATEDB CREATEROLE REPLICATION;

DO $role$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'supabase_auth_admin') THEN CREATE ROLE "supabase_auth_admin" NOLOGIN; END IF; END $role$;

ALTER ROLE "supabase_auth_admin" NOSUPERUSER NOINHERIT NOBYPASSRLS NOCREATEDB CREATEROLE NOREPLICATION;

DO $role$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'supabase_read_only_user') THEN CREATE ROLE "supabase_read_only_user" NOLOGIN; END IF; END $role$;

ALTER ROLE "supabase_read_only_user" NOSUPERUSER INHERIT BYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;

DO $role$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'supabase_privileged_role') THEN CREATE ROLE "supabase_privileged_role" NOLOGIN; END IF; END $role$;

ALTER ROLE "supabase_privileged_role" NOSUPERUSER INHERIT NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;

DO $role$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticator') THEN CREATE ROLE "authenticator" NOLOGIN; END IF; END $role$;

ALTER ROLE "authenticator" NOSUPERUSER NOINHERIT NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;

CREATE SCHEMA IF NOT EXISTS "extensions";

CREATE SCHEMA IF NOT EXISTS "graphql_public";

CREATE SCHEMA IF NOT EXISTS "auth";

CREATE SCHEMA IF NOT EXISTS "public";

CREATE SCHEMA IF NOT EXISTS "library_private";

CREATE SCHEMA IF NOT EXISTS "fsrs_private";

SET LOCAL ROLE "supabase_admin";

GRANT "supabase_privileged_role" TO "postgres" WITH ADMIN false, INHERIT true, SET true;

RESET ROLE;

SET LOCAL ROLE "supabase_admin";

GRANT "pg_create_subscription" TO "postgres" WITH ADMIN true, INHERIT true, SET true;

RESET ROLE;

SET LOCAL ROLE "supabase_admin";

GRANT "pg_signal_backend" TO "postgres" WITH ADMIN true, INHERIT true, SET true;

RESET ROLE;

SET LOCAL ROLE "supabase_admin";

GRANT "pg_read_all_data" TO "postgres" WITH ADMIN true, INHERIT true, SET true;

RESET ROLE;

SET LOCAL ROLE "supabase_admin";

GRANT "pg_monitor" TO "postgres" WITH ADMIN true, INHERIT true, SET true;

RESET ROLE;

SET LOCAL ROLE "supabase_admin";

GRANT "authenticator" TO "postgres" WITH ADMIN true, INHERIT true, SET true;

RESET ROLE;

SET LOCAL ROLE "supabase_admin";

GRANT "service_role" TO "postgres" WITH ADMIN true, INHERIT true, SET true;

RESET ROLE;

SET LOCAL ROLE "supabase_admin";

GRANT "authenticated" TO "postgres" WITH ADMIN true, INHERIT true, SET true;

RESET ROLE;

SET LOCAL ROLE "supabase_admin";

GRANT "anon" TO "postgres" WITH ADMIN true, INHERIT true, SET true;

RESET ROLE;

SET LOCAL ROLE "supabase_admin";

GRANT "pg_monitor" TO "supabase_read_only_user" WITH ADMIN false, INHERIT true, SET true;

RESET ROLE;

SET LOCAL ROLE "supabase_admin";

GRANT "pg_read_all_data" TO "supabase_read_only_user" WITH ADMIN false, INHERIT true, SET true;

RESET ROLE;

SET LOCAL ROLE "supabase_admin";

GRANT "service_role" TO "authenticator" WITH ADMIN false, INHERIT false, SET true;

RESET ROLE;

SET LOCAL ROLE "supabase_admin";

GRANT "authenticated" TO "authenticator" WITH ADMIN false, INHERIT false, SET true;

RESET ROLE;

SET LOCAL ROLE "supabase_admin";

GRANT "anon" TO "authenticator" WITH ADMIN false, INHERIT false, SET true;

RESET ROLE;

-- Rebuild only the guarded, empty local fixture relations.

DROP VIEW IF EXISTS "public"."fsrs_effective_reviews" CASCADE;

DROP VIEW IF EXISTS "public"."vocabulary_with_exclusions" CASCADE;

DROP VIEW IF EXISTS "public"."active_vocabulary" CASCADE;

DROP TABLE IF EXISTS "fsrs_private"."activity_baselines", "fsrs_private"."activity_receipts", "fsrs_private"."activity_settings", "fsrs_private"."admission_config_receipts", "fsrs_private"."admission_permits", "fsrs_private"."admission_policies", "fsrs_private"."admission_requests", "fsrs_private"."admission_settings", "fsrs_private"."event_permits", "fsrs_private"."legacy_admissions", "fsrs_private"."manual_save_settings", "fsrs_private"."settings", "public"."fsrs_cards", "public"."fsrs_manual_save_receipts", "public"."fsrs_new_receipts", "public"."fsrs_operations", "public"."profiles", "public"."reading_materials", "public"."review_events", "public"."uploaded_pdfs", "public"."user_known_words", "public"."user_vocabulary", "public"."vocabulary_contexts", "public"."vocabulary_exclusions" CASCADE;

CREATE TABLE "fsrs_private"."activity_baselines" (
 "actor_id" uuid NOT NULL,
 "baseline" jsonb NOT NULL,
 "projected" jsonb NOT NULL,
 "captured_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);

ALTER TABLE "fsrs_private"."activity_baselines" OWNER TO "postgres";

CREATE TABLE "fsrs_private"."activity_receipts" (
 "actor_id" uuid NOT NULL,
 "kind" text NOT NULL,
 "receipt_id" text NOT NULL,
 "card_id" uuid,
 "effective_at" timestamp with time zone NOT NULL,
 "activity_day" date NOT NULL,
 "policy_version" text DEFAULT 'streak-freeze-earn-v1'::text NOT NULL,
 "received_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);

ALTER TABLE "fsrs_private"."activity_receipts" OWNER TO "postgres";

CREATE TABLE "fsrs_private"."activity_settings" (
 "singleton" boolean DEFAULT true NOT NULL,
 "enabled" boolean DEFAULT false NOT NULL,
 "starts_at" timestamp with time zone,
 "policy_version" text DEFAULT 'streak-freeze-earn-v1'::text NOT NULL,
 "profile_contract_hash" text
);

ALTER TABLE "fsrs_private"."activity_settings" OWNER TO "postgres";

CREATE TABLE "fsrs_private"."admission_config_receipts" (
 "user_id" uuid NOT NULL,
 "operation_id" text NOT NULL,
 "request" jsonb NOT NULL,
 "received_at" timestamp with time zone NOT NULL
);

ALTER TABLE "fsrs_private"."admission_config_receipts" OWNER TO "postgres";

CREATE TABLE "fsrs_private"."admission_permits" (
 "transaction_id" bigint NOT NULL,
 "user_id" uuid NOT NULL,
 "card_id" uuid NOT NULL,
 "operation_id" text NOT NULL,
 "question_at" timestamp with time zone NOT NULL,
 "daily_new_limit" integer NOT NULL,
 "policy_revision" bigint NOT NULL
);

ALTER TABLE "fsrs_private"."admission_permits" OWNER TO "postgres";

CREATE TABLE "fsrs_private"."admission_policies" (
 "user_id" uuid NOT NULL,
 "daily_new_limit" integer DEFAULT 15 NOT NULL,
 "revision" bigint DEFAULT 0 NOT NULL
);

ALTER TABLE "fsrs_private"."admission_policies" OWNER TO "postgres";

CREATE TABLE "fsrs_private"."admission_requests" (
 "user_id" uuid NOT NULL,
 "operation_id" text NOT NULL,
 "card_id" uuid NOT NULL,
 "request" jsonb NOT NULL,
 "admitted_at" timestamp with time zone NOT NULL,
 "learning_day" date NOT NULL,
 "starts_at" timestamp with time zone,
 "consumed" boolean NOT NULL,
 "first_question_at" timestamp with time zone
);

ALTER TABLE "fsrs_private"."admission_requests" OWNER TO "postgres";

CREATE TABLE "fsrs_private"."admission_settings" (
 "singleton" boolean DEFAULT true NOT NULL,
 "enabled" boolean DEFAULT false NOT NULL,
 "starts_at" timestamp with time zone,
 "contract_hash" text
);

ALTER TABLE "fsrs_private"."admission_settings" OWNER TO "postgres";

CREATE TABLE "fsrs_private"."event_permits" (
 "transaction_id" bigint NOT NULL,
 "event" jsonb NOT NULL
);

ALTER TABLE "fsrs_private"."event_permits" OWNER TO "postgres";

CREATE TABLE "fsrs_private"."legacy_admissions" (
 "user_id" uuid NOT NULL,
 "card_id" uuid NOT NULL,
 "first_question_at" timestamp with time zone NOT NULL,
 "learning_day" date NOT NULL,
 "consumed" boolean NOT NULL,
 "starts_at" timestamp with time zone
);

ALTER TABLE "fsrs_private"."legacy_admissions" OWNER TO "postgres";

CREATE TABLE "fsrs_private"."manual_save_settings" (
 "singleton" boolean DEFAULT true NOT NULL,
 "enabled" boolean DEFAULT true NOT NULL,
 "contract_hash" text
);

ALTER TABLE "fsrs_private"."manual_save_settings" OWNER TO "postgres";

CREATE TABLE "fsrs_private"."settings" (
 "singleton" boolean DEFAULT true NOT NULL,
 "enabled" boolean DEFAULT false NOT NULL,
 "activated_at" timestamp with time zone,
 "contract_hash" text,
 "daily_new_limit" integer DEFAULT 15 NOT NULL
);

ALTER TABLE "fsrs_private"."settings" OWNER TO "postgres";

CREATE TABLE "public"."fsrs_cards" (
 "card_id" uuid NOT NULL,
 "user_id" uuid NOT NULL,
 "card" jsonb NOT NULL,
 "attempt" jsonb,
 "enrolled_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);

ALTER TABLE "public"."fsrs_cards" OWNER TO "postgres";

CREATE TABLE "public"."fsrs_manual_save_receipts" (
 "user_id" uuid NOT NULL,
 "operation_id" text NOT NULL,
 "requested_card_id" uuid NOT NULL,
 "vocabulary_id" uuid NOT NULL,
 "request" jsonb NOT NULL,
 "created" boolean NOT NULL,
 "received_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);

ALTER TABLE "public"."fsrs_manual_save_receipts" OWNER TO "postgres";

CREATE TABLE "public"."fsrs_new_receipts" (
 "card_id" uuid NOT NULL,
 "user_id" uuid NOT NULL,
 "operation_id" text NOT NULL,
 "learning_day" date NOT NULL,
 "question_at" timestamp with time zone NOT NULL
);

ALTER TABLE "public"."fsrs_new_receipts" OWNER TO "postgres";

CREATE TABLE "public"."fsrs_operations" (
 "user_id" uuid NOT NULL,
 "id" text NOT NULL,
 "card_id" uuid NOT NULL,
 "kind" text NOT NULL,
 "operation" jsonb NOT NULL,
 "result" jsonb NOT NULL,
 "received_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);

ALTER TABLE "public"."fsrs_operations" OWNER TO "postgres";

CREATE TABLE "public"."profiles" (
 "id" uuid NOT NULL,
 "display_name" text,
 "role" text DEFAULT 'student'::text,
 "level" text DEFAULT 'beginner'::text,
 "streak_count" integer DEFAULT 0,
 "created_at" timestamp with time zone DEFAULT now(),
 "last_login_at" timestamp with time zone DEFAULT now(),
 "avatar_url" text,
 "onboarded" boolean DEFAULT false,
 "learning_language" text[] DEFAULT ARRAY['Japanese'::text],
 "learning_level" text DEFAULT 'N3'::text,
 "learning_level_japanese" text DEFAULT 'N3 중급'::text,
 "learning_level_english" text DEFAULT 'B1 중급'::text,
 "last_streak_date" date,
 "xp" integer DEFAULT 0 NOT NULL,
 "goal_review" integer DEFAULT 5 NOT NULL,
 "goal_words" integer DEFAULT 5 NOT NULL,
 "goal_read" integer DEFAULT 1 NOT NULL,
 "active_lang" text,
 "streak_freeze_count" integer DEFAULT 0 NOT NULL,
 "dday_date" date,
 "dday_label" text,
 "learning_level_french" text,
 "learning_level_chinese" text,
 "goal_lang" text,
 "goal_level" text
);

ALTER TABLE "public"."profiles" OWNER TO "postgres";

CREATE TABLE "public"."reading_materials" (
 "id" bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
 "title" text,
 "raw_text" text,
 "processed_json" jsonb,
 "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
 "visibility" text DEFAULT 'private'::text,
 "owner_id" uuid,
 "group_id" uuid,
 "source_pdf_id" uuid,
 "page_start" integer,
 "page_end" integer,
 "lesson_explanation_ko" text,
 "conversation_script" text,
 "direction" text DEFAULT 'read'::text NOT NULL,
 "document_json" jsonb
);

ALTER TABLE "public"."reading_materials" OWNER TO "postgres";

CREATE TABLE "public"."review_events" (
 "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
 "user_id" uuid NOT NULL,
 "lang" text NOT NULL,
 "source" text NOT NULL,
 "item_key" text NOT NULL,
 "correct" boolean NOT NULL,
 "detail" jsonb,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public"."review_events" OWNER TO "postgres";

CREATE TABLE "public"."uploaded_pdfs" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "owner_id" uuid NOT NULL,
 "title" text NOT NULL,
 "filename" text NOT NULL,
 "storage_path" text NOT NULL,
 "file_size_bytes" bigint,
 "page_count" integer,
 "language" text,
 "level" text,
 "last_page_read" integer DEFAULT 1,
 "thumbnail_path" text,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "lang" text
);

ALTER TABLE "public"."uploaded_pdfs" OWNER TO "postgres";

CREATE TABLE "public"."user_known_words" (
 "user_id" uuid NOT NULL,
 "lang" text NOT NULL,
 "word_text" text NOT NULL,
 "marked_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public"."user_known_words" OWNER TO "postgres";

CREATE TABLE "public"."user_vocabulary" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "word_text" text NOT NULL,
 "furigana" text,
 "meaning" text,
 "pos" text,
 "status" text DEFAULT 'New'::text,
 "repetitions" integer DEFAULT 0,
 "next_review_at" timestamp with time zone DEFAULT now(),
 "last_review" timestamp with time zone DEFAULT now(),
 "material_id" bigint,
 "created_at" timestamp with time zone DEFAULT now(),
 "source_sentence" text,
 "source_material_id" bigint,
 "last_reviewed_at" timestamp with time zone,
 "user_id" uuid,
 "ease_factor" real DEFAULT 2.5,
 "interval" real DEFAULT 0,
 "language" text,
 "base_form" text,
 "source_ref" text,
 "etym" text,
 "hanja" text
);

ALTER TABLE "public"."user_vocabulary" OWNER TO "postgres";

CREATE TABLE "public"."vocabulary_contexts" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "user_id" uuid DEFAULT auth.uid() NOT NULL,
 "vocabulary_id" uuid NOT NULL,
 "kind" text NOT NULL,
 "lang" text NOT NULL,
 "chapter_slug" text,
 "material_id" bigint,
 "pdf_id" uuid,
 "locator" jsonb DEFAULT '{}'::jsonb NOT NULL,
 "quote" text NOT NULL,
 "translation" text DEFAULT ''::text NOT NULL,
 "source_key" text NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public"."vocabulary_contexts" OWNER TO "postgres";

CREATE TABLE "public"."vocabulary_exclusions" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "user_id" uuid NOT NULL,
 "language" text NOT NULL,
 "word_text" text NOT NULL,
 "vocabulary_id" uuid,
 "retired_vocabulary_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "known_word_keys" text[] DEFAULT '{}'::text[] NOT NULL
);

ALTER TABLE "public"."vocabulary_exclusions" OWNER TO "postgres";

-- Exact pg_get_functiondef bodies; no admission/hash checks removed.

-- Observed prosrc MD5 cdef18c69c4f4cbbced2eaf81e628b49; production OID 16542.

CREATE OR REPLACE FUNCTION auth.uid()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS E'\n  select \n  coalesce(\n    nullif(current_setting(''request.jwt.claim.sub'', true), ''''),\n    (nullif(current_setting(''request.jwt.claims'', true), '''')::jsonb ->> ''sub'')\n  )::uuid\n';

ALTER FUNCTION "auth"."uid"() OWNER TO "supabase_auth_admin";

-- Observed prosrc MD5 3a3917aad6ddd66182bf45b7490c3029; production OID 16551.

CREATE OR REPLACE FUNCTION extensions.grant_pg_cron_access()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
    revoke trigger on cron.job_run_details from postgres;
  END IF;
END;
$function$;

ALTER FUNCTION "extensions"."grant_pg_cron_access"() OWNER TO "supabase_admin";

-- Observed prosrc MD5 dd3f3e2bb94cff45ef24b9cecb6af1c8; production OID 16572.

CREATE OR REPLACE FUNCTION extensions.grant_pg_graphql_access()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
    if not exists (
        select 1
        from pg_catalog.pg_event_trigger_ddl_commands() ev
        join pg_catalog.pg_extension e on ev.objid = e.oid
        where e.extname = 'pg_graphql'
    ) then
        return;
    end if;

    drop function if exists graphql_public.graphql;
    create or replace function graphql_public.graphql(
        "operationName" text default null,
        query text default null,
        variables jsonb default null,
        extensions jsonb default null
    )
        returns jsonb
        language sql
    as $$
        select graphql.resolve(
            query := query,
            variables := coalesce(variables, '{}'),
            "operationName" := "operationName",
            extensions := extensions
        );
    $$;

    -- Attach the wrapper to the extension so DROP EXTENSION cascades to it,
    -- which in turn triggers set_graphql_placeholder to reinstall the "not enabled" stub.
    alter extension pg_graphql add function graphql_public.graphql(text, text, jsonb, jsonb);

    grant usage on schema graphql to postgres, anon, authenticated, service_role;
    grant execute on function graphql.resolve to postgres, anon, authenticated, service_role;
    grant usage on schema graphql to postgres with grant option;
    grant usage on schema graphql_public to postgres with grant option;
end;
$function$;

ALTER FUNCTION "extensions"."grant_pg_graphql_access"() OWNER TO "supabase_admin";

-- Observed prosrc MD5 2ee4e6920eeba3068bcfa838105352e2; production OID 16553.

CREATE OR REPLACE FUNCTION extensions.grant_pg_net_access()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8.0', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$function$;

ALTER FUNCTION "extensions"."grant_pg_net_access"() OWNER TO "supabase_admin";

-- Observed prosrc MD5 7f27b8118fea5c88b0164331292859e3; production OID 16563.

CREATE OR REPLACE FUNCTION extensions.pgrst_ddl_watch()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $function$;

ALTER FUNCTION "extensions"."pgrst_ddl_watch"() OWNER TO "supabase_admin";

-- Observed prosrc MD5 bc09cc3003d66f91844af4cb05e203b7; production OID 16564.

CREATE OR REPLACE FUNCTION extensions.pgrst_drop_watch()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $function$;

ALTER FUNCTION "extensions"."pgrst_drop_watch"() OWNER TO "supabase_admin";

-- Observed prosrc MD5 a2bc2d00b2cc2f5e8d2d6b8d73e2c360; production OID 16574.

CREATE OR REPLACE FUNCTION extensions.set_graphql_placeholder()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
            set search_path to ''
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$function$;

ALTER FUNCTION "extensions"."set_graphql_placeholder"() OWNER TO "supabase_admin";

-- Observed prosrc MD5 bea659eb1614d2b39eb1925017e9b6ee; production OID 40378.

CREATE OR REPLACE FUNCTION fsrs_private.activity_function_acl(p_oid oid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT coalesce(jsonb_agg(jsonb_build_array(coalesce(r.rolname,'PUBLIC'),a.privilege_type,a.is_grantable,grantor.rolname)
 ORDER BY coalesce(r.rolname,'PUBLIC'),a.privilege_type,a.is_grantable,grantor.rolname),'[]'::jsonb)
 FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
 LEFT JOIN pg_catalog.pg_roles r ON r.oid=a.grantee JOIN pg_catalog.pg_roles grantor ON grantor.oid=a.grantor WHERE p.oid=p_oid;
$function$;

ALTER FUNCTION "fsrs_private"."activity_function_acl"(p_oid oid) OWNER TO "postgres";

-- Observed prosrc MD5 fd4ce12cd45cd4dd1afe1ce88c252b52; production OID 40380.

CREATE OR REPLACE FUNCTION fsrs_private.activity_namespace_acl(p_name text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT coalesce(jsonb_agg(jsonb_build_array(coalesce(r.rolname,'PUBLIC'),a.privilege_type,a.is_grantable,grantor.rolname)
 ORDER BY coalesce(r.rolname,'PUBLIC') COLLATE "C",a.privilege_type,a.is_grantable,grantor.rolname),'[]'::jsonb)
 FROM pg_catalog.pg_namespace n CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(n.nspacl,pg_catalog.acldefault('n',n.nspowner))) a
 LEFT JOIN pg_catalog.pg_roles r ON r.oid=a.grantee JOIN pg_catalog.pg_roles grantor ON grantor.oid=a.grantor WHERE n.nspname=p_name;
$function$;

ALTER FUNCTION "fsrs_private"."activity_namespace_acl"(p_name text) OWNER TO "postgres";

-- Observed prosrc MD5 5e76c86d0fe5fddf1329cf17de1ba732; production OID 40379.

CREATE OR REPLACE FUNCTION fsrs_private.activity_platform_role_catalog()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 WITH RECURSIVE relevant(oid) AS (
  SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN ('postgres','supabase_admin','supabase_auth_admin','dashboard_user','anon','authenticated','service_role','pg_database_owner')
  UNION SELECT CASE WHEN m.roleid=r.oid THEN m.member ELSE m.roleid END FROM relevant r JOIN pg_catalog.pg_auth_members m ON m.roleid=r.oid OR m.member=r.oid
 ) SELECT jsonb_build_object(
  'roles',(SELECT jsonb_agg(to_jsonb(r)-ARRAY['rolpassword','rolvaliduntil'] ORDER BY r.oid) FROM pg_catalog.pg_roles r WHERE r.oid IN (SELECT oid FROM relevant)),
  'memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor) FROM pg_catalog.pg_auth_members m WHERE m.roleid IN (SELECT oid FROM relevant) OR m.member IN (SELECT oid FROM relevant)));
$function$;

ALTER FUNCTION "fsrs_private"."activity_platform_role_catalog"() OWNER TO "postgres";

-- Observed prosrc MD5 de5daad700de189605798023e312ccd1; production OID 40382.

CREATE OR REPLACE FUNCTION fsrs_private.activity_preflight()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE p pg_catalog.pg_proc%rowtype; c pg_catalog.pg_class%rowtype; helper pg_catalog.pg_proc%rowtype;
 cols integer; actual_policies jsonb; expected_policies jsonb; actual_acl jsonb;
 minimal_acl jsonb:='[["PUBLIC","EXECUTE",false,"postgres"],["postgres","EXECUTE",false,"postgres"]]'::jsonb;
 explicit_acl jsonb:='[["PUBLIC","EXECUTE",false,"postgres"],["anon","EXECUTE",false,"postgres"],["authenticated","EXECUTE",false,"postgres"],["postgres","EXECUTE",false,"postgres"],["service_role","EXECUTE",false,"postgres"]]'::jsonb;
BEGIN
 SELECT * INTO p FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('public.update_streak(uuid)');
 IF p.oid IS NULL OR md5(p.prosrc)<>'7f7c5295ab5c3e91beb70cef04990b6c'
  OR NOT p.prosecdef OR p.provolatile<>'v' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public']::text[]
  OR p.prorettype<>'void'::regtype OR p.prolang<>(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
  OR p.proowner<>(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='postgres')
  OR p.proowner<>(SELECT nspowner FROM pg_catalog.pg_namespace WHERE nspname='fsrs_private')
  OR p.prokind<>'f' OR p.proretset OR p.proleakproof OR p.provariadic<>0 OR p.proargdefaults IS NOT NULL
  OR p.proargnames IS DISTINCT FROM ARRAY['uid']::text[] OR p.proparallel<>'u' OR p.prosupport<>0
  OR p.proisstrict OR p.procost<>100 OR p.prorows<>0 OR p.pronargdefaults<>0 OR p.probin IS NOT NULL OR p.prosqlbody IS NOT NULL
 THEN RAISE EXCEPTION 'activity_policy_not_attested' USING ERRCODE='55000'; END IF;
 actual_acl:=fsrs_private.activity_function_acl(p.oid);
 IF actual_acl IS DISTINCT FROM explicit_acl
 THEN RAISE EXCEPTION 'activity_policy_acl_not_attested' USING ERRCODE='55000'; END IF;
 SELECT * INTO c FROM pg_catalog.pg_class WHERE oid=pg_catalog.to_regclass('public.profiles');
 IF c.oid IS NULL OR c.relkind<>'r' OR c.relowner<>p.proowner OR NOT c.relrowsecurity OR c.relforcerowsecurity
  OR c.relhasrules OR c.relispartition OR EXISTS(SELECT 1 FROM pg_catalog.pg_inherits WHERE inhparent=c.oid OR inhrelid=c.oid)
  OR c.relam IS DISTINCT FROM (SELECT oid FROM pg_catalog.pg_am WHERE amname='heap' AND amtype='t' AND amhandler='pg_catalog.heap_tableam_handler(internal)'::regprocedure)
 THEN RAISE EXCEPTION 'activity_profile_catalog_not_attested' USING ERRCODE='55000'; END IF;
 SELECT count(*) INTO cols FROM pg_catalog.pg_attribute WHERE attrelid=c.oid AND attnum>0 AND NOT attisdropped
  AND attgenerated='' AND attidentity='' AND (attname,atttypid) IN
   (('id','uuid'::regtype),('streak_count','integer'::regtype),('last_streak_date','date'::regtype),('streak_freeze_count','integer'::regtype),('role','text'::regtype));
 IF cols<>5 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid=c.oid AND attname='role' AND NOT attisdropped
  AND attcollation='pg_catalog."default"'::regcollation) THEN RAISE EXCEPTION 'activity_profile_columns_not_attested' USING ERRCODE='55000'; END IF;
 -- Exact reported trigger, including event/timing/row/enabled state and absence
 -- of WHEN, arguments, column restrictions, constraint or transition machinery.
 IF (SELECT count(*) FROM pg_catalog.pg_trigger WHERE tgrelid=c.oid AND NOT tgisinternal)<>1 OR NOT EXISTS(
  SELECT 1 FROM pg_catalog.pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal AND t.tgname='trg_enforce_role_change'
   AND t.tgfoid=pg_catalog.to_regprocedure('public.enforce_role_change_by_admin()') AND t.tgtype=19 AND t.tgenabled='O'
   AND t.tgnargs=0 AND t.tgargs=''::bytea AND t.tgqual IS NULL AND t.tgattr=''::int2vector
   AND t.tgconstraint=0 AND t.tgconstrrelid=0 AND t.tgconstrindid=0 AND NOT t.tgdeferrable AND NOT t.tginitdeferred
   AND t.tgoldtable IS NULL AND t.tgnewtable IS NULL)
 THEN RAISE EXCEPTION 'activity_profile_trigger_not_attested' USING ERRCODE='55000'; END IF;
 SELECT * INTO helper FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('public.enforce_role_change_by_admin()');
 IF helper.oid IS NULL OR md5(helper.prosrc)<>'a3d315a8c81181eccbb9072e8b9c3c7a' OR NOT helper.prosecdef
  OR helper.provolatile<>'v' OR helper.proconfig IS DISTINCT FROM ARRAY['search_path=public']::text[] OR helper.prorettype<>'trigger'::regtype
  OR helper.prolang<>(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql') OR helper.proowner<>p.proowner
  OR helper.prokind<>'f' OR helper.proretset OR helper.proleakproof OR helper.provariadic<>0 OR helper.proargdefaults IS NOT NULL
  OR helper.proargnames IS NOT NULL OR helper.proparallel<>'u' OR helper.prosupport<>0
  OR helper.proisstrict OR helper.procost<>100 OR helper.prorows<>0 OR helper.pronargdefaults<>0 OR helper.probin IS NOT NULL OR helper.prosqlbody IS NOT NULL
 THEN RAISE EXCEPTION 'activity_role_guard_not_attested' USING ERRCODE='55000'; END IF;
 IF fsrs_private.activity_function_acl(helper.oid) IS DISTINCT FROM explicit_acl
 THEN RAISE EXCEPTION 'activity_role_guard_acl_not_attested' USING ERRCODE='55000'; END IF;
 SELECT * INTO helper FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('public.is_admin()');
 IF helper.oid IS NULL OR md5(helper.prosrc)<>'c6285e67e4e39f263d934fac2145035c' OR NOT helper.prosecdef
  OR helper.provolatile<>'s' OR helper.proconfig IS DISTINCT FROM ARRAY['search_path=public']::text[] OR helper.prorettype<>'boolean'::regtype
  OR helper.prolang<>(SELECT oid FROM pg_catalog.pg_language WHERE lanname='sql') OR helper.proowner<>p.proowner
  OR helper.prokind<>'f' OR helper.proretset OR helper.proleakproof OR helper.provariadic<>0 OR helper.proargdefaults IS NOT NULL
  OR helper.proargnames IS NOT NULL OR helper.proparallel<>'u' OR helper.prosupport<>0
  OR helper.proisstrict OR helper.procost<>100 OR helper.prorows<>0 OR helper.pronargdefaults<>0 OR helper.probin IS NOT NULL OR helper.prosqlbody IS NOT NULL
 THEN RAISE EXCEPTION 'activity_admin_helper_not_attested' USING ERRCODE='55000',DETAIL='Read-only evidence must include exact public.is_admin() definition and pg_proc/owner/ACL metadata.'; END IF;
 IF fsrs_private.activity_function_acl(helper.oid) IS DISTINCT FROM explicit_acl
 THEN RAISE EXCEPTION 'activity_admin_helper_acl_not_attested' USING ERRCODE='55000'; END IF;
 SELECT * INTO helper FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('auth.uid()');
 IF helper.oid IS NULL OR md5(helper.prosrc)<>'cdef18c69c4f4cbbced2eaf81e628b49' OR helper.prosecdef
  OR helper.provolatile<>'s' OR helper.proconfig IS NOT NULL OR helper.prorettype<>'uuid'::regtype
  OR helper.prolang<>(SELECT oid FROM pg_catalog.pg_language WHERE lanname='sql') OR helper.proowner<>(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='supabase_auth_admin')
  OR helper.prokind<>'f' OR helper.proretset OR helper.proleakproof OR helper.provariadic<>0 OR helper.proargdefaults IS NOT NULL
  OR helper.proargnames IS NOT NULL OR helper.proparallel<>'u' OR helper.prosupport<>0
  OR helper.proisstrict OR helper.procost<>100 OR helper.prorows<>0 OR helper.pronargdefaults<>0 OR helper.probin IS NOT NULL OR helper.prosqlbody IS NOT NULL
 THEN RAISE EXCEPTION 'activity_identity_helper_not_attested' USING ERRCODE='55000',DETAIL='Exact auth.uid source, ownership and execution metadata must match M09 catalog evidence.'; END IF;
 IF fsrs_private.activity_function_acl(helper.oid) IS DISTINCT FROM '[["PUBLIC","EXECUTE",false,"supabase_auth_admin"],["dashboard_user","EXECUTE",false,"supabase_auth_admin"],["supabase_auth_admin","EXECUTE",false,"supabase_auth_admin"]]'::jsonb
 THEN RAISE EXCEPTION 'activity_identity_helper_acl_not_attested' USING ERRCODE='55000'; END IF;
 -- No policy names, roles or expression normalization is inferred. PUBLIC read
 -- policies are accepted as the existing catalog, never created by this fragment.
 SELECT jsonb_agg(jsonb_build_array(polname,polcmd,polpermissive,
  (SELECT jsonb_agg(coalesce(r.rolname,'public') ORDER BY coalesce(r.rolname,'public')) FROM unnest(polroles) roid LEFT JOIN pg_catalog.pg_roles r ON r.oid=roid),
  pg_get_expr(polqual,polrelid),pg_get_expr(polwithcheck,polrelid)) ORDER BY polname COLLATE "C") INTO actual_policies
 FROM pg_catalog.pg_policy WHERE polrelid=c.oid;
 expected_policies:='[
 ["Users can read own profile","r",true,["public"],"(auth.uid() = id)",null],
 ["Users can update own profile","w",true,["public"],"(auth.uid() = id)",null],
 ["anyone_read_basic_profile","r",true,["public"],"true",null],
 ["profiles_insert","a",true,["public"],null,"(auth.uid() = id)"],
 ["profiles_insert_student_only","a",false,["authenticated"],null,"(role = ''student''::text)"],
 ["profiles_select","r",true,["public"],"true",null],
 ["profiles_update","w",true,["public"],"(auth.uid() = id)",null]]'::jsonb;
 IF actual_policies IS DISTINCT FROM expected_policies THEN RAISE EXCEPTION 'activity_profile_policy_not_attested' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(fsrs_private.activity_profile_dependencies()) d
  WHERE (d->>'schema'<>'pg_catalog' AND NOT (
   (d->>'source'='role_guard' AND d->>'schema'='public' AND d->>'name'='enforce_role_change_by_admin')
   OR (d->>'source'='admin_helper' AND d->>'schema'='public' AND d->>'name'='is_admin')
   OR (d->>'source' IN ('policy','identity_helper') AND d->>'schema'='auth' AND d->>'name'='uid')))
   OR (d#>>'{definition,volatility}'='v' AND NOT (
    (d->>'source'='default' AND d->>'schema'='pg_catalog' AND d->>'name'='gen_random_uuid')
    OR (d->>'source'='role_guard' AND d->>'schema'='public' AND d->>'name'='enforce_role_change_by_admin')
    OR (d->>'source'='internal_fk' AND d->>'schema'='pg_catalog' AND d->>'name' IN ('RI_FKey_cascade_del','RI_FKey_noaction_upd','RI_FKey_setnull_del','RI_FKey_check_ins','RI_FKey_check_upd')))))
 THEN RAISE EXCEPTION 'activity_profile_dependency_not_attested' USING ERRCODE='55000'; END IF;


 -- Supplied profile shape is complete. PG18 represents NOT NULL twice (a
 -- contype=n row plus attnotnull); shape compares exact attnotnull for all26
 -- columns and the PG17 three legacy constraints. Raw constraints stay hashed.
 -- No extra executable default/CHECK/index
 -- expression may be adopted as a harmless metadata difference.
 IF fsrs_private.activity_profile_shape() IS DISTINCT FROM '{"columns":[{"acl":null,"name":"id","type":"uuid","number":1,"default":null,"identity":"","not_null":true,"collation":null,"generated":""},{"acl":null,"name":"display_name","type":"text","number":2,"default":null,"identity":"","not_null":false,"collation":"\"default\"","generated":""},{"acl":null,"name":"role","type":"text","number":3,"default":"''student''::text","identity":"","not_null":false,"collation":"\"default\"","generated":""},{"acl":null,"name":"level","type":"text","number":4,"default":"''beginner''::text","identity":"","not_null":false,"collation":"\"default\"","generated":""},{"acl":null,"name":"streak_count","type":"integer","number":5,"default":"0","identity":"","not_null":false,"collation":null,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","number":6,"default":"now()","identity":"","not_null":false,"collation":null,"generated":""},{"acl":null,"name":"last_login_at","type":"timestamp with time zone","number":7,"default":"now()","identity":"","not_null":false,"collation":null,"generated":""},{"acl":null,"name":"avatar_url","type":"text","number":8,"default":null,"identity":"","not_null":false,"collation":"\"default\"","generated":""},{"acl":null,"name":"onboarded","type":"boolean","number":9,"default":"false","identity":"","not_null":false,"collation":null,"generated":""},{"acl":null,"name":"learning_language","type":"text[]","number":10,"default":"ARRAY[''Japanese''::text]","identity":"","not_null":false,"collation":"\"default\"","generated":""},{"acl":null,"name":"learning_level","type":"text","number":11,"default":"''N3''::text","identity":"","not_null":false,"collation":"\"default\"","generated":""},{"acl":null,"name":"learning_level_japanese","type":"text","number":12,"default":"''N3 중급''::text","identity":"","not_null":false,"collation":"\"default\"","generated":""},{"acl":null,"name":"learning_level_english","type":"text","number":13,"default":"''B1 중급''::text","identity":"","not_null":false,"collation":"\"default\"","generated":""},{"acl":null,"name":"last_streak_date","type":"date","number":14,"default":null,"identity":"","not_null":false,"collation":null,"generated":""},{"acl":null,"name":"xp","type":"integer","number":15,"default":"0","identity":"","not_null":true,"collation":null,"generated":""},{"acl":null,"name":"goal_review","type":"integer","number":16,"default":"5","identity":"","not_null":true,"collation":null,"generated":""},{"acl":null,"name":"goal_words","type":"integer","number":17,"default":"5","identity":"","not_null":true,"collation":null,"generated":""},{"acl":null,"name":"goal_read","type":"integer","number":18,"default":"1","identity":"","not_null":true,"collation":null,"generated":""},{"acl":null,"name":"active_lang","type":"text","number":19,"default":null,"identity":"","not_null":false,"collation":"\"default\"","generated":""},{"acl":null,"name":"streak_freeze_count","type":"integer","number":20,"default":"0","identity":"","not_null":true,"collation":null,"generated":""},{"acl":null,"name":"dday_date","type":"date","number":21,"default":null,"identity":"","not_null":false,"collation":null,"generated":""},{"acl":null,"name":"dday_label","type":"text","number":22,"default":null,"identity":"","not_null":false,"collation":"\"default\"","generated":""},{"acl":null,"name":"learning_level_french","type":"text","number":23,"default":null,"identity":"","not_null":false,"collation":"\"default\"","generated":""},{"acl":null,"name":"learning_level_chinese","type":"text","number":24,"default":null,"identity":"","not_null":false,"collation":"\"default\"","generated":""},{"acl":null,"name":"goal_lang","type":"text","number":25,"default":null,"identity":"","not_null":false,"collation":"\"default\"","generated":""},{"acl":null,"name":"goal_level","type":"text","number":26,"default":null,"identity":"","not_null":false,"collation":"\"default\"","generated":""}],"constraints":[{"name":"profiles_id_fkey","type":"f","validated":true,"definition":"FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE"},{"name":"profiles_pkey","type":"p","validated":true,"definition":"PRIMARY KEY (id)"},{"name":"profiles_role_check","type":"c","validated":true,"definition":"CHECK ((role = ANY (ARRAY[''student''::text, ''host''::text, ''admin''::text])))"}],"indexes":[{"name":"public.profiles_pkey","ready":true,"valid":true,"unique":true,"definition":"CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id)"}]}'::jsonb THEN
  RAISE EXCEPTION 'activity_profile_shape_not_attested' USING ERRCODE='55000'; END IF;
 IF c.relpersistence<>'p' OR c.reloptions IS NOT NULL OR
  (SELECT coalesce(jsonb_agg(jsonb_build_array(coalesce(r.rolname,'PUBLIC'),a.privilege_type,a.is_grantable,g.rolname) ORDER BY coalesce(r.rolname,'PUBLIC') COLLATE "C",a.privilege_type,a.is_grantable,g.rolname),'[]'::jsonb)
   FROM pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) a LEFT JOIN pg_catalog.pg_roles r ON r.oid=a.grantee JOIN pg_catalog.pg_roles g ON g.oid=a.grantor) IS DISTINCT FROM '[["anon","DELETE",false,"postgres"],["anon","INSERT",false,"postgres"],["anon","MAINTAIN",false,"postgres"],["anon","REFERENCES",false,"postgres"],["anon","SELECT",false,"postgres"],["anon","TRIGGER",false,"postgres"],["anon","TRUNCATE",false,"postgres"],["anon","UPDATE",false,"postgres"],["authenticated","DELETE",false,"postgres"],["authenticated","INSERT",false,"postgres"],["authenticated","MAINTAIN",false,"postgres"],["authenticated","REFERENCES",false,"postgres"],["authenticated","SELECT",false,"postgres"],["authenticated","TRIGGER",false,"postgres"],["authenticated","TRUNCATE",false,"postgres"],["authenticated","UPDATE",false,"postgres"],["postgres","DELETE",false,"postgres"],["postgres","INSERT",false,"postgres"],["postgres","MAINTAIN",false,"postgres"],["postgres","REFERENCES",false,"postgres"],["postgres","SELECT",false,"postgres"],["postgres","TRIGGER",false,"postgres"],["postgres","TRUNCATE",false,"postgres"],["postgres","UPDATE",false,"postgres"],["service_role","DELETE",false,"postgres"],["service_role","INSERT",false,"postgres"],["service_role","MAINTAIN",false,"postgres"],["service_role","REFERENCES",false,"postgres"],["service_role","SELECT",false,"postgres"],["service_role","TRIGGER",false,"postgres"],["service_role","TRUNCATE",false,"postgres"],["service_role","UPDATE",false,"postgres"]]'::jsonb
 THEN RAISE EXCEPTION 'activity_profile_privileges_not_attested' USING ERRCODE='55000'; END IF;
 IF (SELECT r.rolname FROM pg_catalog.pg_namespace n JOIN pg_catalog.pg_roles r ON r.oid=n.nspowner WHERE n.nspname='public') IS DISTINCT FROM 'pg_database_owner'
 OR (SELECT r.rolname FROM pg_catalog.pg_namespace n JOIN pg_catalog.pg_roles r ON r.oid=n.nspowner WHERE n.nspname='auth') IS DISTINCT FROM 'supabase_admin'
 OR NOT pg_catalog.has_schema_privilege('postgres','public','CREATE')
 THEN RAISE EXCEPTION 'activity_dependency_namespace_owner_not_attested' USING ERRCODE='55000'; END IF;
 IF fsrs_private.activity_namespace_acl('public') IS DISTINCT FROM '[["PUBLIC","USAGE",false,"pg_database_owner"],["anon","USAGE",false,"pg_database_owner"],["authenticated","USAGE",false,"pg_database_owner"],["pg_database_owner","CREATE",false,"pg_database_owner"],["pg_database_owner","USAGE",false,"pg_database_owner"],["postgres","USAGE",false,"pg_database_owner"],["service_role","USAGE",false,"pg_database_owner"]]'::jsonb
 OR fsrs_private.activity_namespace_acl('auth') IS DISTINCT FROM '[["anon","USAGE",false,"supabase_admin"],["authenticated","USAGE",false,"supabase_admin"],["dashboard_user","CREATE",false,"supabase_admin"],["dashboard_user","USAGE",false,"supabase_admin"],["postgres","USAGE",false,"supabase_admin"],["service_role","USAGE",false,"supabase_admin"],["supabase_admin","CREATE",false,"supabase_admin"],["supabase_admin","USAGE",false,"supabase_admin"],["supabase_auth_admin","CREATE",false,"supabase_admin"],["supabase_auth_admin","USAGE",false,"supabase_admin"]]'::jsonb
 THEN RAISE EXCEPTION 'activity_dependency_namespace_not_attested' USING ERRCODE='55000'; END IF;
 IF (SELECT jsonb_agg(jsonb_build_object('role',rolname,'login',rolcanlogin,'inherit',rolinherit,'create_db',rolcreatedb,'superuser',rolsuper,'bypass_rls',rolbypassrls,'create_role',rolcreaterole,'replication',rolreplication) ORDER BY rolname COLLATE "C") FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated','pg_database_owner','postgres','service_role','supabase_admin','supabase_auth_admin')) IS DISTINCT FROM '[{"role":"anon","login":false,"inherit":true,"create_db":false,"superuser":false,"bypass_rls":false,"create_role":false,"replication":false},{"role":"authenticated","login":false,"inherit":true,"create_db":false,"superuser":false,"bypass_rls":false,"create_role":false,"replication":false},{"role":"pg_database_owner","login":false,"inherit":true,"create_db":false,"superuser":false,"bypass_rls":false,"create_role":false,"replication":false},{"role":"postgres","login":true,"inherit":true,"create_db":true,"superuser":false,"bypass_rls":true,"create_role":true,"replication":true},{"role":"service_role","login":false,"inherit":true,"create_db":false,"superuser":false,"bypass_rls":true,"create_role":false,"replication":false},{"role":"supabase_admin","login":true,"inherit":true,"create_db":true,"superuser":true,"bypass_rls":true,"create_role":true,"replication":true},{"role":"supabase_auth_admin","login":true,"inherit":false,"create_db":false,"superuser":false,"bypass_rls":false,"create_role":true,"replication":false}]'::jsonb
 THEN RAISE EXCEPTION 'activity_platform_roles_not_attested' USING ERRCODE='55000'; END IF;
 IF (SELECT jsonb_agg(jsonb_build_object('role',r.rolname,'member',u.rolname,'grantor',g.rolname,'set_option',m.set_option,'admin_option',m.admin_option,'inherit_option',m.inherit_option) ORDER BY r.rolname COLLATE "C",u.rolname COLLATE "C",g.rolname COLLATE "C") FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles r ON r.oid=m.roleid JOIN pg_catalog.pg_roles u ON u.oid=m.member JOIN pg_catalog.pg_roles g ON g.oid=m.grantor WHERE r.rolname IN ('postgres','supabase_admin','supabase_auth_admin','dashboard_user','pg_database_owner','anon','authenticated','service_role') OR u.rolname IN ('postgres','supabase_admin','supabase_auth_admin','dashboard_user','pg_database_owner','anon','authenticated','service_role')) IS DISTINCT FROM '[{"role":"anon","member":"authenticator","grantor":"supabase_admin","set_option":true,"admin_option":false,"inherit_option":false},{"role":"anon","member":"postgres","grantor":"supabase_admin","set_option":true,"admin_option":true,"inherit_option":true},{"role":"authenticated","member":"authenticator","grantor":"supabase_admin","set_option":true,"admin_option":false,"inherit_option":false},{"role":"authenticated","member":"postgres","grantor":"supabase_admin","set_option":true,"admin_option":true,"inherit_option":true},{"role":"authenticator","member":"postgres","grantor":"supabase_admin","set_option":true,"admin_option":true,"inherit_option":true},{"role":"pg_create_subscription","member":"postgres","grantor":"supabase_admin","set_option":true,"admin_option":true,"inherit_option":true},{"role":"pg_monitor","member":"postgres","grantor":"supabase_admin","set_option":true,"admin_option":true,"inherit_option":true},{"role":"pg_read_all_data","member":"postgres","grantor":"supabase_admin","set_option":true,"admin_option":true,"inherit_option":true},{"role":"pg_signal_backend","member":"postgres","grantor":"supabase_admin","set_option":true,"admin_option":true,"inherit_option":true},{"role":"postgres","member":"cli_login_postgres","grantor":"supabase_admin","set_option":true,"admin_option":false,"inherit_option":false},{"role":"service_role","member":"authenticator","grantor":"supabase_admin","set_option":true,"admin_option":false,"inherit_option":false},{"role":"service_role","member":"postgres","grantor":"supabase_admin","set_option":true,"admin_option":true,"inherit_option":true},{"role":"supabase_privileged_role","member":"postgres","grantor":"supabase_admin","set_option":true,"admin_option":false,"inherit_option":true}]'::jsonb
 THEN RAISE EXCEPTION 'activity_platform_memberships_not_attested' USING ERRCODE='55000'; END IF;
 -- Existing dashboard/auth administration grants are trusted platform grants;
 -- application identities must not reach those privileges through membership.
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_namespace n WHERE r.rolname IN ('anon','authenticated','service_role') AND n.nspname IN ('public','auth') AND pg_catalog.has_schema_privilege(r.oid,n.oid,'CREATE'))
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles app CROSS JOIN pg_catalog.pg_roles platform WHERE app.rolname IN ('anon','authenticated','service_role') AND platform.rolname IN ('postgres','supabase_admin','supabase_auth_admin','dashboard_user','pg_database_owner') AND pg_catalog.pg_has_role(app.oid,platform.oid,'MEMBER'))
 THEN RAISE EXCEPTION 'activity_platform_privilege_path_not_attested' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_depend d WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.deptype='e' AND d.objid IN ('public.update_streak(uuid)'::regprocedure,'public.enforce_role_change_by_admin()'::regprocedure,'public.is_admin()'::regprocedure,'auth.uid()'::regprocedure))
 THEN RAISE EXCEPTION 'activity_helper_extension_not_attested' USING ERRCODE='55000'; END IF;
 -- Only core RI trigger machinery may be attached internally. Both sides of
 -- each constraint are pinned to profiles(id); shipped activity only updates
 -- streak columns, so core RI update triggers observe an unchanged key.
 IF (SELECT count(*) FROM pg_catalog.pg_trigger WHERE tgrelid=c.oid AND tgisinternal)<>40
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_trigger t LEFT JOIN pg_catalog.pg_constraint co ON co.oid=t.tgconstraint LEFT JOIN pg_catalog.pg_proc fn ON fn.oid=t.tgfoid LEFT JOIN pg_catalog.pg_namespace n ON n.oid=fn.pronamespace WHERE t.tgrelid=c.oid AND t.tgisinternal AND (
  t.tgenabled<>'O' OR t.tgnargs<>0 OR t.tgargs<>''::bytea OR t.tgqual IS NOT NULL OR t.tgattr<>''::int2vector OR t.tgdeferrable OR t.tginitdeferred OR t.tgoldtable IS NOT NULL OR t.tgnewtable IS NOT NULL OR co.contype IS DISTINCT FROM 'f' OR n.nspname IS DISTINCT FROM 'pg_catalog' OR
  NOT ((co.conrelid=c.oid AND co.conname='profiles_id_fkey' AND co.confrelid='auth.users'::regclass AND co.conkey=ARRAY[1]::smallint[] AND co.confkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid='auth.users'::regclass AND attname='id')]::smallint[] AND t.tgconstrrelid=co.confrelid AND ((t.tgtype=5 AND fn.proname='RI_FKey_check_ins') OR (t.tgtype=17 AND fn.proname='RI_FKey_check_upd')))
  OR (co.confrelid=c.oid AND co.confkey=ARRAY[1]::smallint[] AND t.tgconstrrelid=co.conrelid AND ((t.tgtype=9 AND ((co.confdeltype='c' AND fn.proname='RI_FKey_cascade_del') OR (co.confdeltype='n' AND fn.proname='RI_FKey_setnull_del'))) OR (t.tgtype=17 AND co.confupdtype='a' AND fn.proname='RI_FKey_noaction_upd'))))
 )) THEN RAISE EXCEPTION 'activity_internal_fk_not_attested' USING ERRCODE='55000'; END IF;
 IF (SELECT jsonb_agg(jsonb_build_array(n.nspname,r.relname,co.confdeltype,co.confupdtype,counted.n) ORDER BY n.nspname COLLATE "C",r.relname COLLATE "C",co.confdeltype,co.confupdtype)
 FROM (SELECT tgconstraint,count(*) n FROM pg_catalog.pg_trigger WHERE tgrelid=c.oid AND tgisinternal GROUP BY tgconstraint) counted JOIN pg_catalog.pg_constraint co ON co.oid=counted.tgconstraint JOIN pg_catalog.pg_class r ON r.oid=co.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=r.relnamespace WHERE co.confrelid=c.oid) IS DISTINCT FROM '[["public","focus_circle_members","c","a",2],["public","focus_circles","c","a",2],["public","focus_entries","c","a",2],["public","focus_meetings","c","a",2],["public","forum_comment_likes","c","a",2],["public","forum_comments","c","a",2],["public","forum_likes","c","a",2],["public","forum_post_likes","c","a",2],["public","forum_posts","c","a",2],["public","material_comments","c","a",2],["public","notifications","c","a",2],["public","notifications","n","a",2],["public","study_group_comments","c","a",2],["public","study_group_goals","n","a",2],["public","study_group_members","c","a",2],["public","study_group_reads","n","a",2],["public","uploaded_pdfs","c","a",2],["public","user_achievements","c","a",2],["public","vocab_decks","c","a",2]]'::jsonb
 THEN RAISE EXCEPTION 'activity_inbound_fk_not_attested' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_operator WHERE oid='pg_catalog.->>(jsonb,text)'::regoperator AND oprcode='pg_catalog.jsonb_object_field_text(jsonb,text)'::regprocedure AND oprresult='text'::regtype AND oprleft='jsonb'::regtype AND oprright='text'::regtype)
 THEN RAISE EXCEPTION 'activity_identity_operator_not_attested' USING ERRCODE='55000'; END IF;
 -- Resolved core function names, raw internal symbol hashes and execution
 -- attributes are fixed, not arbitrary pg_catalog-shaped user functions.
 IF EXISTS(SELECT 1 FROM (VALUES
  ('pg_catalog."RI_FKey_cascade_del"()','2f31bc6a0634a61665919631336df3a0','trigger','v','s'),
  ('pg_catalog."RI_FKey_noaction_upd"()','5909814be8c209a36e3f00dad2047ec7','trigger','v','s'),
  ('pg_catalog."RI_FKey_setnull_del"()','b1cc723bfa4e6e7daf3f769789a148ab','trigger','v','s'),
  ('pg_catalog."RI_FKey_check_ins"()','0202d6016df4e8a81b0062a40c6023ec','trigger','v','s'),
  ('pg_catalog."RI_FKey_check_upd"()','b95e5133ec61e5d6ef06f767aa556993','trigger','v','s'),
  ('pg_catalog.current_setting(text,boolean)','4348de2f4ad02b7ff16c7fd393ea533c','text','s','s'),
  ('pg_catalog.now()','97bc592b27a9ada2d9a4bb418ed0ebed','timestamp with time zone','s','s'),
  ('pg_catalog.texteq(text,text)','c0a12881799fef79f18c0bf960f118a3','boolean','i','s'),
  ('pg_catalog.uuid_eq(uuid,uuid)','449f471a03ad272f46b6c7a0d0977e9a','boolean','i','s'),
  ('pg_catalog.heap_tableam_handler(internal)','c465225bc429d7cd80e6d70e7aa77e38','table_am_handler','v','s'),
  -- Reviewed PostgreSQL17 core symbols for casts/operator in supplied auth.uid;
  -- these three symbol identities are independently verified, not represented
  -- as additional live M09 observations.
  ('pg_catalog.uuid_in(cstring)','2514a1b913f278e2fc2c0b9e38e5e2f8','uuid','i','s'),
  ('pg_catalog.jsonb_in(cstring)','47a0ae06e0345b76fe5673ef8944c676','jsonb','i','s'),
  ('pg_catalog.jsonb_object_field_text(jsonb,text)','714a8f318111c19d56969f1699343963','text','i','s')
 ) known(signature,source_md5,result_type,volatility,parallel) LEFT JOIN pg_catalog.pg_proc fn ON fn.oid=pg_catalog.to_regprocedure(known.signature) LEFT JOIN pg_catalog.pg_language lang ON lang.oid=fn.prolang WHERE fn.oid IS NULL OR md5(fn.prosrc)<>known.source_md5 OR lang.lanname<>'internal' OR fn.prorettype<>known.result_type::regtype OR fn.prokind<>'f' OR fn.prosecdef OR fn.proconfig IS NOT NULL OR NOT fn.proisstrict OR fn.provolatile::text<>known.volatility OR fn.proparallel::text<>known.parallel OR fn.probin IS NOT NULL OR fn.prosupport<>0 OR fn.proowner IS DISTINCT FROM (SELECT oid FROM pg_catalog.pg_roles WHERE rolname='supabase_admin') OR fn.proacl IS NOT NULL OR fn.proleakproof IS DISTINCT FROM (fn.proname IN ('texteq','uuid_eq')) OR EXISTS(SELECT 1 FROM pg_catalog.pg_depend dep WHERE dep.classid='pg_catalog.pg_proc'::regclass AND dep.objid=fn.oid AND dep.deptype='e'))
 THEN RAISE EXCEPTION 'activity_core_dependency_not_attested' USING ERRCODE='55000'; END IF;

 IF current_setting('TimeZone') NOT IN ('UTC','Etc/UTC') OR EXISTS(
  SELECT 1 FROM pg_catalog.pg_db_role_setting d,LATERAL unnest(d.setconfig) value
  WHERE lower(split_part(value,'=',1))='timezone' AND lower(split_part(value,'=',2)) NOT IN ('utc','etc/utc'))
 THEN RAISE EXCEPTION 'activity_timezone_not_attested' USING ERRCODE='55000'; END IF;
 RETURN jsonb_build_object('ok',true,'policyVersion','streak-freeze-earn-v1','activityTimeZone','UTC',
  'catalogVersion','m09-reported-20261004-exact-022','limitations','Exact supplied profile and identity catalog attested; isolated verification is not normal-account or deployment acceptance.');
END $function$;

ALTER FUNCTION "fsrs_private"."activity_preflight"() OWNER TO "postgres";

-- Observed prosrc MD5 fb3ef1748e3b6a46e1e59f775bfa6260; production OID 40377.

CREATE OR REPLACE FUNCTION fsrs_private.activity_profile_dependencies()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 WITH RECURSIVE expressions(source,body) AS (
  SELECT 'constraint',conbin::text FROM pg_catalog.pg_constraint WHERE conrelid='public.profiles'::regclass
  UNION ALL SELECT 'default',adbin::text FROM pg_catalog.pg_attrdef WHERE adrelid='public.profiles'::regclass
  UNION ALL SELECT 'index',indexprs::text FROM pg_catalog.pg_index WHERE indrelid='public.profiles'::regclass
  UNION ALL SELECT 'index',indpred::text FROM pg_catalog.pg_index WHERE indrelid='public.profiles'::regclass
  UNION ALL SELECT 'policy',polqual::text FROM pg_catalog.pg_policy WHERE polrelid='public.profiles'::regclass
  UNION ALL SELECT 'policy',polwithcheck::text FROM pg_catalog.pg_policy WHERE polrelid='public.profiles'::regclass
 ), roots(source,classid,objid) AS (
  -- PostgreSQL omits pinned built-in functions from pg_depend. Also read their
  -- resolved OIDs from the catalog expression trees; names/SQL search are insufficient.
  SELECT source,'pg_catalog.pg_proc'::regclass,(f.id)[1]::oid FROM expressions e,
   LATERAL regexp_matches(e.body,':(?:funcid|opfuncid) ([0-9]+)','g') f(id) WHERE (f.id)[1]<>'0'
  UNION SELECT 'constraint','pg_catalog.pg_constraint'::regclass,oid FROM pg_catalog.pg_constraint WHERE conrelid='public.profiles'::regclass
  UNION SELECT 'default','pg_catalog.pg_attrdef'::regclass,oid FROM pg_catalog.pg_attrdef WHERE adrelid='public.profiles'::regclass
  UNION SELECT 'index','pg_catalog.pg_class'::regclass,indexrelid FROM pg_catalog.pg_index WHERE indrelid='public.profiles'::regclass
  UNION SELECT 'policy','pg_catalog.pg_policy'::regclass,oid FROM pg_catalog.pg_policy WHERE polrelid='public.profiles'::regclass
  UNION SELECT 'role_guard','pg_catalog.pg_proc'::regclass,tgfoid FROM pg_catalog.pg_trigger WHERE tgrelid='public.profiles'::regclass AND NOT tgisinternal
  UNION SELECT 'internal_fk','pg_catalog.pg_proc'::regclass,tgfoid FROM pg_catalog.pg_trigger WHERE tgrelid='public.profiles'::regclass AND tgisinternal
  -- PL/pgSQL and string-body SQL do not record call dependencies in pg_depend.
  -- These exact reviewed bodies have this finite recursive closure: guard ->
  -- public.is_admin -> auth.uid; policy -> auth.uid. Unknown bodies are rejected.
  UNION SELECT 'admin_helper','pg_catalog.pg_proc'::regclass,pg_catalog.to_regprocedure('public.is_admin()')::oid
  UNION SELECT 'identity_helper','pg_catalog.pg_proc'::regclass,pg_catalog.to_regprocedure('auth.uid()')::oid
  -- Resolved built-ins used by the known string-body helper closure are not
  -- recorded by pg_depend either. Pin and hash that executable tail explicitly.
  UNION SELECT 'identity_builtin','pg_catalog.pg_proc'::regclass,oid FROM unnest(ARRAY[
   'pg_catalog.current_setting(text,boolean)'::regprocedure::oid,
   'pg_catalog.jsonb_in(cstring)'::regprocedure::oid,
   'pg_catalog.jsonb_object_field_text(jsonb,text)'::regprocedure::oid,
   'pg_catalog.uuid_in(cstring)'::regprocedure::oid,
   'pg_catalog.uuid_eq(uuid,uuid)'::regprocedure::oid,
   'pg_catalog.texteq(text,text)'::regprocedure::oid]) oid
  UNION SELECT 'identity_builtin','pg_catalog.pg_operator'::regclass,'pg_catalog.->>(jsonb,text)'::regoperator::oid
  UNION SELECT 'column','pg_catalog.pg_type'::regclass,atttypid FROM pg_catalog.pg_attribute WHERE attrelid='public.profiles'::regclass AND attnum>0 AND NOT attisdropped
 ), dependencies(source,classid,objid) AS (
  SELECT * FROM roots UNION
  SELECT x.source,d.refclassid,d.refobjid FROM dependencies x JOIN pg_catalog.pg_depend d ON d.classid=x.classid AND d.objid=x.objid
  WHERE d.refclassid=ANY(ARRAY['pg_catalog.pg_proc'::regclass,'pg_catalog.pg_operator'::regclass,'pg_catalog.pg_opclass'::regclass,'pg_catalog.pg_type'::regclass])
 ), objects AS (
  SELECT d.source,d.classid,d.objid,n.nspname schema,p.proname name,
   jsonb_build_object('definition',pg_get_functiondef(p.oid),'catalog',to_jsonb(p),'owner',p.proowner,'acl',p.proacl,'volatility',p.provolatile) definition
  FROM dependencies d JOIN pg_catalog.pg_proc p ON d.classid='pg_catalog.pg_proc'::regclass AND p.oid=d.objid
  JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE p.prokind IN ('f','p')
  UNION ALL SELECT d.source,d.classid,d.objid,n.nspname,o.oprname,to_jsonb(o) FROM dependencies d
   JOIN pg_catalog.pg_operator o ON d.classid='pg_catalog.pg_operator'::regclass AND o.oid=d.objid JOIN pg_catalog.pg_namespace n ON n.oid=o.oprnamespace
  UNION ALL SELECT d.source,d.classid,d.objid,n.nspname,o.opcname,to_jsonb(o) FROM dependencies d
   JOIN pg_catalog.pg_opclass o ON d.classid='pg_catalog.pg_opclass'::regclass AND o.oid=d.objid JOIN pg_catalog.pg_namespace n ON n.oid=o.opcnamespace
  UNION ALL SELECT d.source,d.classid,d.objid,n.nspname,t.typname,to_jsonb(t) FROM dependencies d
   JOIN pg_catalog.pg_type t ON d.classid='pg_catalog.pg_type'::regclass AND t.oid=d.objid JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
 ) SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY source,classid,objid),'[]'::jsonb) FROM objects o;
$function$;

ALTER FUNCTION "fsrs_private"."activity_profile_dependencies"() OWNER TO "postgres";

-- Observed prosrc MD5 2c3b288d2739925159418048da75a65d; production OID 40384.

CREATE OR REPLACE FUNCTION fsrs_private.activity_profile_hash()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 WITH objects AS (
 SELECT 'dependencies' k,fsrs_private.activity_profile_dependencies() v
 UNION ALL SELECT 'table' k,jsonb_build_array(c.relkind,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity,c.reloptions,c.relispartition,c.relhasrules,c.relhassubclass,c.relam) v FROM pg_catalog.pg_class c WHERE c.oid='public.profiles'::regclass
 UNION ALL SELECT 'col:'||a.attnum,jsonb_build_array(a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attacl,a.attidentity,a.attgenerated,a.attcollation,pg_get_expr(d.adbin,d.adrelid)) FROM pg_catalog.pg_attribute a
 LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='public.profiles'::regclass AND a.attnum>0 AND NOT a.attisdropped
 UNION ALL SELECT 'constraint:'||oid,jsonb_build_array(pg_get_constraintdef(oid),to_jsonb(c)) FROM pg_catalog.pg_constraint c WHERE conrelid='public.profiles'::regclass
 UNION ALL SELECT 'policy:'||oid,jsonb_build_array(polname,polcmd,polpermissive,polroles,pg_get_expr(polqual,polrelid),pg_get_expr(polwithcheck,polrelid)) FROM pg_catalog.pg_policy WHERE polrelid='public.profiles'::regclass
 UNION ALL SELECT 'trigger:'||oid,jsonb_build_array(tgname,pg_get_triggerdef(oid),tgenabled,tgfoid,tgtype,tgargs,tgqual,tgconstraint,tgconstrrelid,tgconstrindid,tgdeferrable,tginitdeferred,tgoldtable,tgnewtable) FROM pg_catalog.pg_trigger WHERE tgrelid='public.profiles'::regclass
 UNION ALL SELECT 'index:'||indexrelid,jsonb_build_array(pg_get_indexdef(indexrelid),to_jsonb(i)) FROM pg_catalog.pg_index i WHERE indrelid='public.profiles'::regclass
 UNION ALL SELECT 'access_method',jsonb_build_array(to_jsonb(am),pg_get_functiondef(p.oid),to_jsonb(p)) FROM pg_catalog.pg_am am JOIN pg_catalog.pg_proc p ON p.oid=am.amhandler WHERE am.oid=(SELECT relam FROM pg_catalog.pg_class WHERE oid='public.profiles'::regclass)
 UNION ALL SELECT 'inheritance:'||inhrelid||':'||inhparent,to_jsonb(i) FROM pg_catalog.pg_inherits i WHERE inhparent='public.profiles'::regclass OR inhrelid='public.profiles'::regclass
 UNION ALL SELECT 'internal_fk_constraint:'||co.oid,to_jsonb(co) FROM pg_catalog.pg_constraint co WHERE co.oid IN (SELECT tgconstraint FROM pg_catalog.pg_trigger WHERE tgrelid='public.profiles'::regclass AND tgisinternal)
 UNION ALL SELECT 'column_collation:'||oid,to_jsonb(co) FROM pg_catalog.pg_collation co WHERE co.oid IN (SELECT attcollation FROM pg_catalog.pg_attribute WHERE attrelid='public.profiles'::regclass AND attnum>0 AND NOT attisdropped)
 UNION ALL SELECT 'database_locale',jsonb_build_object('owner',d.datdba,'encoding',d.encoding,'provider',to_jsonb(d)->'datlocprovider','collate',d.datcollate,'ctype',d.datctype,'locale',to_jsonb(d)->'datlocale','icuLocale',to_jsonb(d)->'daticulocale','icuRules',to_jsonb(d)->'daticurules','version',to_jsonb(d)->'datcollversion') FROM pg_catalog.pg_database d WHERE datname=current_database()
 UNION ALL SELECT 'namespace:'||oid,jsonb_build_array(nspname,nspowner,nspacl) FROM pg_catalog.pg_namespace WHERE nspname IN ('public','auth')
 UNION ALL SELECT 'role_closure',fsrs_private.activity_platform_role_catalog()
 UNION ALL SELECT 'role_database_override:'||setdatabase||':'||setrole,to_jsonb(d) FROM pg_catalog.pg_db_role_setting d WHERE setdatabase IN (0,(SELECT oid FROM pg_catalog.pg_database WHERE datname=current_database())) AND (setrole=0 OR setrole IN (SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN ('postgres','supabase_admin','supabase_auth_admin','dashboard_user','anon','authenticated','service_role')))
 UNION ALL SELECT 'function:'||oid,jsonb_build_array(pg_get_functiondef(oid),to_jsonb(p)) FROM pg_catalog.pg_proc p WHERE oid=pg_catalog.to_regprocedure('public.update_streak(uuid)')
 ) SELECT md5(string_agg(k||':'||v::text,E'\n' ORDER BY k)) FROM objects;
$function$;

ALTER FUNCTION "fsrs_private"."activity_profile_hash"() OWNER TO "postgres";

-- Observed prosrc MD5 8997d99b42435c648d934dc3ccd8f745; production OID 40381.

CREATE OR REPLACE FUNCTION fsrs_private.activity_profile_shape()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT jsonb_build_object(
  'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'number',a.attnum,'default',pg_catalog.pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity,'not_null',a.attnotnull,'collation',CASE WHEN a.attcollation=0 THEN NULL ELSE a.attcollation::regcollation::text END,'generated',a.attgenerated,'acl',a.attacl) ORDER BY a.attnum) FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='public.profiles'::regclass AND a.attnum>0 AND NOT a.attisdropped),
  'constraints',(SELECT jsonb_agg(jsonb_build_object('name',conname,'type',contype,'validated',convalidated,'definition',pg_catalog.pg_get_constraintdef(oid)) ORDER BY conname COLLATE "C") FROM pg_catalog.pg_constraint WHERE conrelid='public.profiles'::regclass AND contype<>'n'),
  'indexes',(SELECT jsonb_agg(jsonb_build_object('name',indexrelid::regclass::text,'ready',indisready,'valid',indisvalid,'unique',indisunique,'definition',pg_catalog.pg_get_indexdef(indexrelid)) ORDER BY indexrelid::regclass::text COLLATE "C") FROM pg_catalog.pg_index WHERE indrelid='public.profiles'::regclass));
$function$;

ALTER FUNCTION "fsrs_private"."activity_profile_shape"() OWNER TO "postgres";

-- Observed prosrc MD5 ef7227c3f7d3ff47760d9ce06c844231; production OID 40394.

CREATE OR REPLACE FUNCTION fsrs_private.admission_contract_hash()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 WITH tables AS (SELECT c.* FROM pg_class c WHERE c.oid IN ('fsrs_private.admission_settings'::regclass,'fsrs_private.admission_policies'::regclass,'fsrs_private.admission_config_receipts'::regclass,'fsrs_private.legacy_admissions'::regclass,'fsrs_private.admission_requests'::regclass,'fsrs_private.admission_permits'::regclass,'fsrs_private.activity_settings'::regclass,'fsrs_private.activity_baselines'::regclass,'fsrs_private.activity_receipts'::regclass)),
 tracked_triggers AS (SELECT t.* FROM pg_trigger t WHERE t.tgrelid IN ('fsrs_private.admission_settings'::regclass,'fsrs_private.admission_policies'::regclass,'fsrs_private.admission_config_receipts'::regclass,'fsrs_private.legacy_admissions'::regclass,'fsrs_private.admission_requests'::regclass,'fsrs_private.admission_permits'::regclass,'fsrs_private.activity_settings'::regclass,'fsrs_private.activity_baselines'::regclass,'fsrs_private.activity_receipts'::regclass,'public.fsrs_cards'::regclass,'public.fsrs_operations'::regclass,'public.fsrs_new_receipts'::regclass)),
 functions AS (SELECT unnest(ARRAY['fsrs_private.admission_day(timestamptz)'::regprocedure,'fsrs_private.require_admission_integrity()'::regprocedure,'fsrs_private.admission_status(uuid,timestamptz)'::regprocedure,'public.learning_admission_status(uuid)'::regprocedure,'public.learning_configure_admission(uuid,jsonb)'::regprocedure,'public.learning_admit_legacy(uuid,jsonb)'::regprocedure,'fsrs_private.guard_learning_enrollment()'::regprocedure,'fsrs_private.guard_learning_first_question()'::regprocedure,'public.fsrs_apply_learning_operation(uuid,jsonb)'::regprocedure,'public.fsrs_learning_admission_marker(uuid)'::regprocedure,'fsrs_private.activity_profile_dependencies()'::regprocedure,'fsrs_private.activity_function_acl(oid)'::regprocedure,'fsrs_private.activity_platform_role_catalog()'::regprocedure,'fsrs_private.activity_namespace_acl(text)'::regprocedure,'fsrs_private.activity_profile_shape()'::regprocedure,'fsrs_private.activity_preflight()'::regprocedure,'fsrs_private.activity_profile_hash()'::regprocedure,'fsrs_private.project_activity_days_with_legacy(jsonb,date[],date[])'::regprocedure,'fsrs_private.project_activity_days(jsonb,date[])'::regprocedure,'fsrs_private.append_activity(uuid,text,text,uuid,timestamptz)'::regprocedure,'fsrs_private.record_fsrs_activity(uuid,text)'::regprocedure,'fsrs_private.legacy_activity_before_epoch(uuid)'::regprocedure,'fsrs_private.record_learning_activity()'::regprocedure,'public.fsrs_vocabulary_snapshot(uuid)'::regprocedure,'fsrs_private.admission_contract_hash()'::regprocedure,'fsrs_private.contract_hash()'::regprocedure,'fsrs_private.manual_contract_hash()'::regprocedure]) oid UNION SELECT tgfoid FROM tracked_triggers),
 objects AS (
 SELECT 'relation:'||c.oid::text k,jsonb_build_array(c.relkind,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity,c.reloptions,c.relhasrules) v FROM tables c
 UNION ALL SELECT 'column:'||c.oid::text||':'||a.attnum::text,jsonb_build_array(a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attacl,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid)) FROM tables c JOIN pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE a.attnum>0 AND NOT a.attisdropped
 UNION ALL SELECT 'constraint:'||c.oid::text,to_jsonb(pg_get_constraintdef(c.oid)) FROM pg_constraint c JOIN tables t ON t.oid=c.conrelid
 UNION ALL SELECT 'policy:'||p.oid::text,jsonb_build_array(p.polcmd,p.polpermissive,p.polroles,pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid)) FROM pg_policy p JOIN tables t ON t.oid=p.polrelid
 UNION ALL SELECT 'index:'||i.indexrelid::text,jsonb_build_array(pg_get_indexdef(i.indexrelid),i.indisvalid,i.indisready) FROM pg_index i JOIN tables t ON t.oid=i.indrelid
 UNION ALL SELECT 'trigger:'||t.oid::text,jsonb_build_array(pg_get_triggerdef(t.oid),t.tgenabled) FROM tracked_triggers t
 UNION ALL SELECT 'rule:'||r.oid::text,jsonb_build_array(pg_get_ruledef(r.oid),r.ev_enabled) FROM pg_rewrite r WHERE r.ev_class IN ('fsrs_private.admission_settings'::regclass,'fsrs_private.admission_policies'::regclass,'fsrs_private.admission_config_receipts'::regclass,'fsrs_private.legacy_admissions'::regclass,'fsrs_private.admission_requests'::regclass,'fsrs_private.admission_permits'::regclass,'fsrs_private.activity_settings'::regclass,'fsrs_private.activity_baselines'::regclass,'fsrs_private.activity_receipts'::regclass,'public.fsrs_cards'::regclass,'public.fsrs_operations'::regclass,'public.fsrs_new_receipts'::regclass)
 UNION ALL SELECT 'function:'||p.oid::text,jsonb_build_array(pg_get_functiondef(p.oid),p.proacl,p.proowner) FROM pg_proc p JOIN functions f ON f.oid=p.oid
 UNION ALL SELECT 'profile_catalog',to_jsonb(fsrs_private.activity_profile_hash())
 UNION ALL SELECT 'platform_catalog',(WITH functions AS (SELECT 'extensions.grant_pg_cron_access()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'procost',p.procost,'prokind',p.prokind,'prorows',p.prorows,'support',p.prosupport::pg_catalog.regproc::text,'language',l.lanname,'proconfig',p.proconfig,'proretset',p.proretset,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proargnames',p.proargnames,'proargtypes',p.proargtypes::text,'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provariadic',p.provariadic::pg_catalog.regtype::text,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'pronargdefaults',p.pronargdefaults,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('extensions.grant_pg_cron_access()') UNION ALL SELECT 'extensions.grant_pg_graphql_access()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'procost',p.procost,'prokind',p.prokind,'prorows',p.prorows,'support',p.prosupport::pg_catalog.regproc::text,'language',l.lanname,'proconfig',p.proconfig,'proretset',p.proretset,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proargnames',p.proargnames,'proargtypes',p.proargtypes::text,'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provariadic',p.provariadic::pg_catalog.regtype::text,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'pronargdefaults',p.pronargdefaults,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('extensions.grant_pg_graphql_access()') UNION ALL SELECT 'extensions.grant_pg_net_access()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'procost',p.procost,'prokind',p.prokind,'prorows',p.prorows,'support',p.prosupport::pg_catalog.regproc::text,'language',l.lanname,'proconfig',p.proconfig,'proretset',p.proretset,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proargnames',p.proargnames,'proargtypes',p.proargtypes::text,'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provariadic',p.provariadic::pg_catalog.regtype::text,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'pronargdefaults',p.pronargdefaults,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('extensions.grant_pg_net_access()') UNION ALL SELECT 'extensions.pgrst_ddl_watch()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'procost',p.procost,'prokind',p.prokind,'prorows',p.prorows,'support',p.prosupport::pg_catalog.regproc::text,'language',l.lanname,'proconfig',p.proconfig,'proretset',p.proretset,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proargnames',p.proargnames,'proargtypes',p.proargtypes::text,'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provariadic',p.provariadic::pg_catalog.regtype::text,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'pronargdefaults',p.pronargdefaults,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('extensions.pgrst_ddl_watch()') UNION ALL SELECT 'extensions.pgrst_drop_watch()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'procost',p.procost,'prokind',p.prokind,'prorows',p.prorows,'support',p.prosupport::pg_catalog.regproc::text,'language',l.lanname,'proconfig',p.proconfig,'proretset',p.proretset,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proargnames',p.proargnames,'proargtypes',p.proargtypes::text,'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provariadic',p.provariadic::pg_catalog.regtype::text,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'pronargdefaults',p.pronargdefaults,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('extensions.pgrst_drop_watch()') UNION ALL SELECT 'extensions.set_graphql_placeholder()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'procost',p.procost,'prokind',p.prokind,'prorows',p.prorows,'support',p.prosupport::pg_catalog.regproc::text,'language',l.lanname,'proconfig',p.proconfig,'proretset',p.proretset,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proargnames',p.proargnames,'proargtypes',p.proargtypes::text,'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provariadic',p.provariadic::pg_catalog.regtype::text,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'pronargdefaults',p.pronargdefaults,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('extensions.set_graphql_placeholder()') UNION ALL SELECT 'graphql_public.graphql(text,text,jsonb,jsonb)' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'prokind',p.prokind,'language',l.lanname,'proconfig',p.proconfig,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('graphql_public.graphql(text,text,jsonb,jsonb)') UNION ALL SELECT 'pg_event_trigger_ddl_commands()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'prokind',p.prokind,'language',l.lanname,'proconfig',p.proconfig,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e')) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('pg_event_trigger_ddl_commands()') UNION ALL SELECT 'pg_event_trigger_dropped_objects()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'prokind',p.prokind,'language',l.lanname,'proconfig',p.proconfig,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e')) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('pg_event_trigger_dropped_objects()') UNION ALL SELECT 'auth.uid()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'procost',p.procost,'prokind',p.prokind,'prorows',p.prorows,'support',p.prosupport::pg_catalog.regproc::text,'language',l.lanname,'proconfig',p.proconfig,'proretset',p.proretset,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proargnames',p.proargnames,'proargtypes',p.proargtypes::text,'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provariadic',p.provariadic::pg_catalog.regtype::text,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'pronargdefaults',p.pronargdefaults,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('auth.uid()') UNION ALL SELECT 'public.is_admin()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'procost',p.procost,'prokind',p.prokind,'prorows',p.prorows,'support',p.prosupport::pg_catalog.regproc::text,'language',l.lanname,'proconfig',p.proconfig,'proretset',p.proretset,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proargnames',p.proargnames,'proargtypes',p.proargtypes::text,'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provariadic',p.provariadic::pg_catalog.regtype::text,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'pronargdefaults',p.pronargdefaults,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('public.is_admin()') UNION ALL SELECT 'public.enforce_role_change_by_admin()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'procost',p.procost,'prokind',p.prokind,'prorows',p.prorows,'support',p.prosupport::pg_catalog.regproc::text,'language',l.lanname,'proconfig',p.proconfig,'proretset',p.proretset,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proargnames',p.proargnames,'proargtypes',p.proargtypes::text,'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provariadic',p.provariadic::pg_catalog.regtype::text,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'pronargdefaults',p.pronargdefaults,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('public.enforce_role_change_by_admin()')) SELECT jsonb_build_object('hooks',(SELECT jsonb_agg(jsonb_build_object('name',e.evtname,'tags',e.evttags,'event',e.evtevent,'owner',pg_catalog.pg_get_userbyid(e.evtowner),'enabled',e.evtenabled,'function',e.evtfoid::pg_catalog.regprocedure::text) ORDER BY e.evtname) FROM pg_catalog.pg_event_trigger e),'functions',(SELECT jsonb_object_agg(key,value ORDER BY key) FROM functions),'schemas',(SELECT jsonb_agg(jsonb_build_object('acl',n.nspacl::text,'owner',pg_catalog.pg_get_userbyid(n.nspowner),'schema',n.nspname) ORDER BY n.nspname) FROM pg_catalog.pg_namespace n WHERE n.nspname IN ('auth','extensions','public')),'extensions',(SELECT coalesce(jsonb_agg(e.extname ORDER BY e.extname),'[]'::jsonb) FROM pg_catalog.pg_extension e WHERE e.extname IN ('pg_graphql','pg_net','pg_cron')),'dormant_targets',(SELECT coalesce(jsonb_agg(p.oid::pg_catalog.regprocedure::text ORDER BY p.oid::pg_catalog.regprocedure::text),'[]'::jsonb) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='graphql' AND p.proname='resolve' OR n.nspname='net' AND p.proname IN ('http_get','http_post'))) )
 ) SELECT md5(jsonb_object_agg(k,v ORDER BY k)::text) FROM objects
$function$;

ALTER FUNCTION "fsrs_private"."admission_contract_hash"() OWNER TO "postgres";

-- Observed prosrc MD5 0d6d63c3fe88125ae25c4944387a197c; production OID 40317.

CREATE OR REPLACE FUNCTION fsrs_private.admission_day(p_at timestamp with time zone)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 SELECT ((p_at AT TIME ZONE 'Asia/Seoul')-interval '4 hours')::date
$function$;

ALTER FUNCTION "fsrs_private"."admission_day"(p_at timestamp with time zone) OWNER TO "postgres";

-- Observed prosrc MD5 fc34a8acb06246ddbaf6ec7ffd0df5d4; production OID 40319.

CREATE OR REPLACE FUNCTION fsrs_private.admission_status(p_actor uuid, p_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s fsrs_private.admission_settings%rowtype; lim integer; rev bigint; f_count bigint; l_count bigint;
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor) THEN RAISE EXCEPTION 'invalid_learning_actor' USING ERRCODE='42501'; END IF;
 PERFORM fsrs_private.require_admission_integrity();
 SELECT * INTO STRICT s FROM fsrs_private.admission_settings;
 SELECT p.daily_new_limit,p.revision INTO lim,rev FROM fsrs_private.admission_policies p WHERE p.user_id=p_actor;
 lim:=coalesce(lim,15);rev:=coalesce(rev,0);
 WITH receipts AS (
  SELECT card_id,question_at AS first_at,'fsrs' AS cohort FROM public.fsrs_new_receipts WHERE user_id=p_actor
  UNION ALL SELECT card_id,first_question_at,'legacy' FROM fsrs_private.legacy_admissions WHERE user_id=p_actor AND consumed
 ), firsts AS (SELECT DISTINCT ON(card_id) card_id,first_at,cohort FROM receipts ORDER BY card_id,first_at,cohort)
 SELECT count(*) FILTER(WHERE cohort='fsrs'),count(*) FILTER(WHERE cohort='legacy') INTO f_count,l_count FROM firsts WHERE fsrs_private.admission_day(first_at)=fsrs_private.admission_day(p_at);
 RETURN jsonb_build_object('version',1,'actorId',p_actor,'installed',true,'enabled',s.enabled,'active',s.enabled AND s.starts_at IS NOT NULL AND p_at>=s.starts_at,
  'fsrsEnabled',(SELECT enabled FROM fsrs_private.settings),'startsAt',fsrs_private.iso_milliseconds(s.starts_at),'now',fsrs_private.iso_milliseconds(p_at),
  'learningDay',fsrs_private.admission_day(p_at)::text,'timeZone','Asia/Seoul','rolloverHour',4,'limit',lim,'policyRevision',rev,
  'used',f_count+l_count,'remaining',greatest(0,lim-f_count-l_count),'fsrsUsed',f_count,'legacyUsed',l_count,
  'admittedLegacyCardIds',coalesce((SELECT jsonb_agg(card_id ORDER BY card_id) FROM fsrs_private.legacy_admissions WHERE user_id=p_actor),'[]'::jsonb));
END $function$;

ALTER FUNCTION "fsrs_private"."admission_status"(p_actor uuid, p_at timestamp with time zone) OWNER TO "postgres";

-- Observed prosrc MD5 72a68724a293020ae410cfaf2d93f010; production OID 40387.

CREATE OR REPLACE FUNCTION fsrs_private.append_activity(p_actor uuid, p_kind text, p_id text, p_card uuid, p_effective timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE settings fsrs_private.activity_settings%rowtype; prior fsrs_private.activity_receipts%rowtype;
 actor_state fsrs_private.activity_baselines%rowtype; current_profile jsonb; next_profile jsonb; days date[]; legacy_days date[]; day_value date;
BEGIN
 IF p_actor IS NULL OR p_kind NOT IN ('fsrs','legacy') OR p_id IS NULL OR p_id='' OR p_effective IS NULL OR NOT isfinite(p_effective)
  OR p_effective>clock_timestamp()+interval '5 seconds' THEN RAISE EXCEPTION 'activity_invalid_request' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,731));
 SELECT * INTO settings FROM fsrs_private.activity_settings FOR SHARE;
 IF NOT settings.enabled THEN RETURN jsonb_build_object('recorded',false,'reason','disabled'); END IF;
 IF settings.profile_contract_hash IS DISTINCT FROM fsrs_private.activity_profile_hash() THEN RAISE EXCEPTION 'activity_catalog_drift' USING ERRCODE='55000'; END IF;
 -- Revealed before the forward epoch remains historical; delivery time cannot promote it.
 IF p_effective<settings.starts_at THEN RETURN jsonb_build_object('recorded',false,'reason','before_epoch'); END IF;
 day_value:=(p_effective AT TIME ZONE 'UTC')::date;
 SELECT * INTO prior FROM fsrs_private.activity_receipts WHERE actor_id=p_actor AND kind=p_kind AND receipt_id=p_id;
 IF prior.actor_id IS NOT NULL THEN
  IF prior.card_id IS DISTINCT FROM p_card OR prior.effective_at IS DISTINCT FROM p_effective THEN RAISE EXCEPTION 'activity_replay_mismatch' USING ERRCODE='23505'; END IF;
  RETURN jsonb_build_object('recorded',true,'duplicate',true,'activityDay',prior.activity_day,'effectiveAt',prior.effective_at);
 END IF;
 -- Dynamic SELECT keeps passive installation possible before the live profile gate.
 EXECUTE 'SELECT jsonb_build_object(''streak_count'',streak_count,''last_streak_date'',last_streak_date,''streak_freeze_count'',streak_freeze_count) FROM public.profiles WHERE id=$1 FOR UPDATE'
 INTO current_profile USING p_actor;
 IF current_profile IS NULL THEN RAISE EXCEPTION 'activity_profile_missing' USING ERRCODE='55000'; END IF;
 SELECT * INTO actor_state FROM fsrs_private.activity_baselines WHERE actor_id=p_actor;
 IF actor_state.actor_id IS NULL THEN
  INSERT INTO fsrs_private.activity_baselines(actor_id,baseline,projected) VALUES(p_actor,current_profile,current_profile) RETURNING * INTO actor_state;
 ELSIF current_profile IS DISTINCT FROM actor_state.projected THEN RAISE EXCEPTION 'activity_profile_changed_outside_contract' USING ERRCODE='55000'; END IF;
 INSERT INTO fsrs_private.activity_receipts(actor_id,kind,receipt_id,card_id,effective_at,activity_day)
 VALUES(p_actor,p_kind,p_id,p_card,p_effective,day_value);
 SELECT array_agg(DISTINCT activity_day ORDER BY activity_day),array_agg(DISTINCT activity_day ORDER BY activity_day) FILTER(WHERE kind='legacy')
 INTO days,legacy_days FROM fsrs_private.activity_receipts WHERE actor_id=p_actor;
 next_profile:=fsrs_private.project_activity_days_with_legacy(actor_state.baseline,days,coalesce(legacy_days,ARRAY[]::date[]));
 IF next_profile IS DISTINCT FROM current_profile THEN
  EXECUTE 'UPDATE public.profiles SET streak_count=($2->>''streak_count'')::integer,last_streak_date=($2->>''last_streak_date'')::date,streak_freeze_count=($2->>''streak_freeze_count'')::integer WHERE id=$1'
   USING p_actor,next_profile;
  UPDATE fsrs_private.activity_baselines SET projected=next_profile WHERE actor_id=p_actor;
 END IF;
 RETURN jsonb_build_object('recorded',true,'duplicate',false,'activityDay',day_value,'effectiveAt',p_effective);
END $function$;

ALTER FUNCTION "fsrs_private"."append_activity"(p_actor uuid, p_kind text, p_id text, p_card uuid, p_effective timestamp with time zone) OWNER TO "postgres";

-- Observed prosrc MD5 49c0d23698f8b9ebe3401f54f44418c9; production OID 39958.

CREATE OR REPLACE FUNCTION fsrs_private.blocked(p_actor uuid, p_card uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT EXISTS(SELECT 1 FROM public.user_vocabulary v WHERE v.id=p_card AND v.user_id=p_actor AND (
 EXISTS(SELECT 1 FROM public.vocabulary_exclusions e WHERE e.user_id=p_actor AND (e.vocabulary_id=v.id OR v.id=ANY(e.retired_vocabulary_ids)
  OR (e.language=v.language AND e.word_text=normalize(btrim(coalesce(nullif(v.base_form,''),v.word_text)),NFC))))
 OR EXISTS(SELECT 1 FROM public.user_known_words k WHERE k.user_id=p_actor
  AND k.lang=CASE v.language WHEN 'Korean' THEN 'ko' WHEN 'Japanese' THEN 'ja' WHEN 'Chinese' THEN 'zh' WHEN 'English' THEN 'en' WHEN 'French' THEN 'fr' END
  AND normalize(btrim(k.word_text),NFC) IN (normalize(btrim(v.word_text),NFC),normalize(btrim(v.base_form),NFC)))))
$function$;

ALTER FUNCTION "fsrs_private"."blocked"(p_actor uuid, p_card uuid) OWNER TO "postgres";

-- Observed prosrc MD5 b43887acc3619ca718b0912b15f833af; production OID 39975.

CREATE OR REPLACE FUNCTION fsrs_private.contract_hash()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 WITH RECURSIVE relevant_roles(oid) AS (
  SELECT oid FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') OR oid=(SELECT nspowner FROM pg_namespace WHERE nspname='fsrs_private')
  UNION SELECT m.roleid FROM pg_auth_members m JOIN relevant_roles r ON r.oid=m.member
 ), tables AS (SELECT c.* FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='fsrs_private' OR (n.nspname='public' AND c.relname LIKE 'fsrs\_%' ESCAPE '\')),
 objects AS (
  SELECT 'relation:'||c.oid::text k,jsonb_build_array(c.relkind,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity,c.reloptions) v FROM tables c
  UNION ALL SELECT 'column:'||c.oid::text||':'||a.attnum::text,jsonb_build_array(a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attacl,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid)) FROM tables c JOIN pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE a.attnum>0 AND NOT a.attisdropped
  UNION ALL SELECT 'constraint:'||x.oid::text,to_jsonb(pg_get_constraintdef(x.oid)) FROM pg_constraint x JOIN tables c ON x.conrelid=c.oid
  UNION ALL SELECT 'policy:'||p.oid::text,jsonb_build_array(p.polcmd,p.polpermissive,p.polroles,pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid)) FROM pg_policy p JOIN tables c ON p.polrelid=c.oid
  UNION ALL SELECT 'view:'||c.oid::text,to_jsonb(pg_get_viewdef(c.oid,true)) FROM tables c WHERE c.relkind='v'
  UNION ALL SELECT 'index:'||i.indexrelid::text,jsonb_build_array(pg_get_indexdef(i.indexrelid),i.indisvalid,i.indisready) FROM pg_index i JOIN tables c ON c.oid=i.indrelid
  UNION ALL SELECT 'function:'||p.oid::text,jsonb_build_array(pg_get_functiondef(p.oid),p.proacl,p.proowner) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='fsrs_private' OR (n.nspname='public' AND (p.proname LIKE 'fsrs\_%' ESCAPE '\' OR p.proname='learning_language_capabilities'))
  UNION ALL SELECT 'trigger:'||t.oid::text,jsonb_build_array(pg_get_triggerdef(t.oid),t.tgenabled) FROM pg_trigger t WHERE t.tgname IN ('fsrs_guard_legacy_vocabulary','fsrs_guard_legacy_event')
  UNION ALL SELECT 'schema:'||n.oid::text,jsonb_build_array(n.nspowner,n.nspacl) FROM pg_namespace n WHERE n.nspname IN ('fsrs_private','public','auth')
  UNION ALL SELECT 'role:'||r.oid::text,jsonb_build_array(r.rolsuper,r.rolbypassrls,r.rolinherit) FROM pg_roles r JOIN relevant_roles rr ON rr.oid=r.oid
  UNION ALL SELECT 'membership:'||m.member::text||':'||m.roleid::text,to_jsonb(m) FROM pg_auth_members m JOIN relevant_roles r ON r.oid=m.member
 ) SELECT md5(jsonb_object_agg(k,v ORDER BY k)::text) FROM objects
$function$;

ALTER FUNCTION "fsrs_private"."contract_hash"() OWNER TO "postgres";

-- Observed prosrc MD5 08f70b0084732d8f5d788d93558b24ae; production OID 40324.

CREATE OR REPLACE FUNCTION fsrs_private.guard_learning_enrollment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text,731));PERFORM fsrs_private.require_admission_integrity();
 IF EXISTS(SELECT 1 FROM fsrs_private.legacy_admissions WHERE user_id=NEW.user_id AND card_id=NEW.card_id) THEN RAISE EXCEPTION 'learning_legacy_card_already_exposed' USING ERRCODE='55000'; END IF;
 RETURN NEW;
END $function$;

ALTER FUNCTION "fsrs_private"."guard_learning_enrollment"() OWNER TO "postgres";

-- Observed prosrc MD5 6660f399d0777496b11d0e343de801b2; production OID 40326.

CREATE OR REPLACE FUNCTION fsrs_private.guard_learning_first_question()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE permit fsrs_private.admission_permits%rowtype; quota jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text,731));PERFORM fsrs_private.require_admission_integrity();
 DELETE FROM fsrs_private.admission_permits WHERE transaction_id=txid_current() AND user_id=NEW.user_id AND card_id=NEW.card_id AND operation_id=NEW.operation_id AND question_at=NEW.question_at RETURNING * INTO permit;
 IF permit.transaction_id IS NULL THEN RAISE EXCEPTION 'learning_admission_required' USING ERRCODE='55000'; END IF;
 quota:=fsrs_private.admission_status(NEW.user_id,date_trunc('milliseconds',clock_timestamp()));
 IF quota->'active' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'learning_admission_inactive' USING ERRCODE='55000'; END IF;
 IF permit.policy_revision<>(quota->>'policyRevision')::bigint OR permit.daily_new_limit<>(quota->>'limit')::integer THEN RAISE EXCEPTION 'learning_policy_conflict' USING ERRCODE='40001'; END IF;
 IF fsrs_private.admission_day(NEW.question_at)::text IS DISTINCT FROM quota->>'learningDay' THEN RAISE EXCEPTION 'learning_day_conflict' USING ERRCODE='40001'; END IF;
 IF (quota->>'remaining')::integer<=0 THEN RAISE EXCEPTION 'learning_daily_new_limit' USING ERRCODE='55000'; END IF;
 RETURN NEW;
END $function$;

ALTER FUNCTION "fsrs_private"."guard_learning_first_question"() OWNER TO "postgres";

-- Observed prosrc MD5 93dae088671147055b906af20f2aeacd; production OID 39974.

CREATE OR REPLACE FUNCTION fsrs_private.guard_legacy_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r jsonb; authorized boolean:=false;
BEGIN
 IF TG_OP='INSERT' THEN
  DELETE FROM fsrs_private.event_permits WHERE transaction_id=txid_current() AND event=to_jsonb(NEW)-'id' RETURNING true INTO authorized;
  IF authorized THEN RETURN NEW; END IF;
 END IF;
 IF TG_OP<>'DELETE' THEN PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text,731)); ELSE PERFORM pg_advisory_xact_lock(hashtextextended(OLD.user_id::text,731)); END IF;
 FOR r IN SELECT x FROM unnest(CASE WHEN TG_OP='INSERT' THEN ARRAY[to_jsonb(NEW)] WHEN TG_OP='DELETE' THEN ARRAY[to_jsonb(OLD)] ELSE ARRAY[to_jsonb(OLD),to_jsonb(NEW)] END) x LOOP
  IF EXISTS(SELECT 1 FROM public.fsrs_cards f JOIN public.user_vocabulary v ON v.id=f.card_id WHERE f.user_id::text=r->>'user_id'
   AND (r#>>'{detail,word_id}'=f.card_id::text OR (r->>'source'='vocab' AND r->>'lang'=v.language
    AND normalize(btrim(r->>'item_key'),NFC) IN (normalize(btrim(v.word_text),NFC),normalize(btrim(v.base_form),NFC)))
    OR (r->>'source'='ui' AND r#>>'{detail,qtype}'='undo' AND r->>'lang'=v.language
     AND normalize(btrim(r#>>'{detail,undo_of,item_key}'),NFC) IN (normalize(btrim(v.word_text),NFC),normalize(btrim(v.base_form),NFC)))
    OR (r->>'source'='ui' AND r#>>'{detail,qtype}'='undo' AND EXISTS(SELECT 1 FROM public.review_events e WHERE e.user_id=f.user_id
     AND e.source='vocab' AND e.detail->>'word_id'=f.card_id::text AND e.lang=r->>'lang' AND e.item_key=r#>>'{detail,undo_of,item_key}'))))
   THEN RAISE EXCEPTION 'fsrs_legacy_event_blocked' USING ERRCODE='55000'; END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $function$;

ALTER FUNCTION "fsrs_private"."guard_legacy_event"() OWNER TO "postgres";

-- Observed prosrc MD5 712ee0b0c87fba26bc699009accc6b15; production OID 39973.

CREATE OR REPLACE FUNCTION fsrs_private.guard_legacy_vocabulary()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF EXISTS(SELECT 1 FROM public.fsrs_cards f WHERE f.card_id=OLD.id) THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'fsrs_enrolled_card_protected' USING ERRCODE='55000'; END IF;
  IF ROW(NEW.id,NEW.user_id,NEW.interval,NEW.ease_factor,NEW.repetitions,NEW.next_review_at,NEW.last_reviewed_at,NEW.last_review,NEW.status)
   IS DISTINCT FROM ROW(OLD.id,OLD.user_id,OLD.interval,OLD.ease_factor,OLD.repetitions,OLD.next_review_at,OLD.last_reviewed_at,OLD.last_review,OLD.status)
   THEN RAISE EXCEPTION 'fsrs_legacy_write_blocked' USING ERRCODE='55000'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $function$;

ALTER FUNCTION "fsrs_private"."guard_legacy_vocabulary"() OWNER TO "postgres";

-- Observed prosrc MD5 add674af992af196e741d68e525bcdbe; production OID 40113.

CREATE OR REPLACE FUNCTION fsrs_private.iso_milliseconds(p_time timestamp with time zone)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 SELECT to_char(date_trunc('milliseconds',p_time) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$function$;

ALTER FUNCTION "fsrs_private"."iso_milliseconds"(p_time timestamp with time zone) OWNER TO "postgres";

-- Observed prosrc MD5 dd1570f7a9ccc39b53cad6303d4f4621; production OID 40389.

CREATE OR REPLACE FUNCTION fsrs_private.legacy_activity_before_epoch(p_actor uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE last_date date; today_date date:=current_date; freezes integer; new_streak integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,731));
 SELECT last_streak_date,streak_freeze_count INTO last_date,freezes FROM public.profiles WHERE id=p_actor FOR UPDATE;
 IF last_date=today_date THEN RETURN;
 ELSIF last_date=today_date-INTERVAL '1 day' THEN
  UPDATE public.profiles SET streak_count=coalesce(streak_count,0)+1,last_streak_date=today_date WHERE id=p_actor RETURNING streak_count INTO new_streak;
  IF new_streak%7=0 THEN UPDATE public.profiles SET streak_freeze_count=least(streak_freeze_count+1,2) WHERE id=p_actor; END IF;
 ELSIF last_date=today_date-INTERVAL '2 day' AND freezes>0 THEN
  UPDATE public.profiles SET streak_count=coalesce(streak_count,0)+1,last_streak_date=today_date,streak_freeze_count=streak_freeze_count-1 WHERE id=p_actor RETURNING streak_count INTO new_streak;
  IF new_streak%7=0 THEN UPDATE public.profiles SET streak_freeze_count=least(streak_freeze_count+1,2) WHERE id=p_actor; END IF;
 ELSE
  UPDATE public.profiles SET streak_count=1,last_streak_date=today_date WHERE id=p_actor;
 END IF;
END $function$;

ALTER FUNCTION "fsrs_private"."legacy_activity_before_epoch"(p_actor uuid) OWNER TO "postgres";

-- Observed prosrc MD5 9c59598d3a669aa34da38344f514fae6; production OID 40120.

CREATE OR REPLACE FUNCTION fsrs_private.manual_contract_hash()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 WITH tables AS (SELECT c.* FROM pg_class c WHERE c.oid IN ('fsrs_private.manual_save_settings'::regclass,'public.fsrs_manual_save_receipts'::regclass)),
 functions AS (SELECT unnest(ARRAY['fsrs_private.iso_milliseconds(timestamp with time zone)'::regprocedure::oid,
  'fsrs_private.vocabulary_registry_entry(uuid,uuid)'::regprocedure::oid,'public.fsrs_vocabulary_snapshot(uuid)'::regprocedure::oid,
  'public.fsrs_save_manual_vocabulary(uuid,jsonb,jsonb)'::regprocedure::oid,'fsrs_private.manual_contract_hash()'::regprocedure::oid]) oid
  UNION SELECT t.tgfoid FROM pg_trigger t JOIN tables c ON c.oid=t.tgrelid),
 objects AS (
  SELECT 'relation:'||c.oid::text k,jsonb_build_array(c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity,c.reloptions) v FROM tables c
  UNION ALL SELECT 'column:'||c.oid::text||':'||a.attnum::text,jsonb_build_array(a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attacl,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid)) FROM tables c JOIN pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE a.attnum>0 AND NOT a.attisdropped
  UNION ALL SELECT 'constraint:'||x.oid::text,to_jsonb(pg_get_constraintdef(x.oid)) FROM pg_constraint x JOIN tables c ON c.oid=x.conrelid
  UNION ALL SELECT 'policy:'||p.oid::text,jsonb_build_array(p.polcmd,p.polpermissive,p.polroles,pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid)) FROM pg_policy p JOIN tables c ON c.oid=p.polrelid
  UNION ALL SELECT 'index:'||i.indexrelid::text,jsonb_build_array(pg_get_indexdef(i.indexrelid),i.indisvalid,i.indisready) FROM pg_index i JOIN tables c ON c.oid=i.indrelid
  UNION ALL SELECT 'trigger:'||t.oid::text,jsonb_build_array(pg_get_triggerdef(t.oid),t.tgenabled) FROM pg_trigger t JOIN tables c ON c.oid=t.tgrelid
  UNION ALL SELECT 'rule:'||r.oid::text,jsonb_build_array(pg_get_ruledef(r.oid),r.ev_enabled) FROM pg_rewrite r JOIN tables c ON c.oid=r.ev_class
  UNION ALL SELECT 'function:'||p.oid::text,jsonb_build_array(pg_get_functiondef(p.oid),p.proacl,p.proowner) FROM pg_proc p JOIN functions f ON f.oid=p.oid
 ) SELECT md5(jsonb_object_agg(k,v ORDER BY k)::text) FROM objects
$function$;

ALTER FUNCTION "fsrs_private"."manual_contract_hash"() OWNER TO "postgres";

-- Observed prosrc MD5 e67483ca4237e6965c7f0b47121d14de; production OID 39959.

CREATE OR REPLACE FUNCTION fsrs_private.next_question_at(p_actor uuid, p_card_id uuid)
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT greatest((f.card->>'due')::timestamptz,
  (SELECT max((o.operation#>>'{log,reviewedAt}')::timestamptz)+interval '30 seconds' FROM public.fsrs_operations o WHERE o.user_id=p_actor AND o.card_id=p_card_id AND o.kind='undo'),
  CASE WHEN f.attempt->>'phase'='abandoned' THEN greatest((f.attempt->>'questionAt')::timestamptz,(f.attempt->>'revealedAt')::timestamptz)+interval '30 seconds' END)
 FROM public.fsrs_cards f WHERE f.user_id=p_actor AND f.card_id=p_card_id
$function$;

ALTER FUNCTION "fsrs_private"."next_question_at"(p_actor uuid, p_card_id uuid) OWNER TO "postgres";

-- Observed prosrc MD5 52acd9eada6378cea3f784ad02d75069; production OID 40386.

CREATE OR REPLACE FUNCTION fsrs_private.project_activity_days(p_baseline jsonb, p_days date[])
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 SELECT fsrs_private.project_activity_days_with_legacy(p_baseline,p_days,ARRAY[]::date[]);
$function$;

ALTER FUNCTION "fsrs_private"."project_activity_days"(p_baseline jsonb, p_days date[]) OWNER TO "postgres";

-- Observed prosrc MD5 be7f74e7dd3c767fded0e83cb68d9801; production OID 40385.

CREATE OR REPLACE FUNCTION fsrs_private.project_activity_days_with_legacy(p_baseline jsonb, p_days date[], p_legacy_days date[])
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
DECLARE result jsonb:=p_baseline; last_day date:=(p_baseline->>'last_streak_date')::date;
 count_value integer:=coalesce((p_baseline->>'streak_count')::integer,0);
 freezes integer:=(p_baseline->>'streak_freeze_count')::integer; day_value date;
BEGIN
 IF count_value<0 OR freezes<0 THEN RAISE EXCEPTION 'activity_invalid_profile'; END IF;
 FOR day_value IN SELECT DISTINCT d FROM unnest(p_days) d WHERE d IS NOT NULL ORDER BY d LOOP
  IF day_value=last_day THEN CONTINUE; END IF;
  -- Historical FSRS reveals cannot rewrite a baseline from a later activity day.
  -- A real generic legacy call still mirrors the original current_date reset
  -- even if an existing future last_streak_date was stored before activation.
  IF day_value<last_day AND NOT day_value=ANY(p_legacy_days) THEN CONTINUE; END IF;
  IF last_day=day_value-1 OR (last_day=day_value-2 AND freezes>0) THEN
   count_value:=count_value+1;
   IF last_day=day_value-2 THEN freezes:=freezes-1; END IF;
   IF count_value%7=0 THEN freezes:=least(freezes+1,2); END IF;
  ELSE count_value:=1; END IF;
  last_day:=day_value;
  result:=jsonb_build_object('streak_count',count_value,'last_streak_date',last_day,'streak_freeze_count',freezes);
 END LOOP;
 RETURN result;
END $function$;

ALTER FUNCTION "fsrs_private"."project_activity_days_with_legacy"(p_baseline jsonb, p_days date[], p_legacy_days date[]) OWNER TO "postgres";

-- Observed prosrc MD5 595459efdebdb9bd26e5fdc4984d71e2; production OID 40388.

CREATE OR REPLACE FUNCTION fsrs_private.record_fsrs_activity(p_actor uuid, p_operation_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE op public.fsrs_operations%rowtype; payload jsonb; effective timestamptz;
BEGIN
 SELECT * INTO op FROM public.fsrs_operations WHERE user_id=p_actor AND id=p_operation_id;
 payload:=op.operation;
 IF op.id IS NULL OR payload->'version' IS DISTINCT FROM '1'::jsonb OR op.kind<>'grade' OR payload->>'kind'<>'grade' OR payload->>'userId' IS DISTINCT FROM p_actor::text
  OR payload->>'cardId' IS DISTINCT FROM op.card_id::text OR payload->>'id' IS DISTINCT FROM op.id
  OR payload#>'{log,optimizerEligible}' IS DISTINCT FROM 'true'::jsonb OR payload#>'{log,rewardEligible}' IS DISTINCT FROM 'true'::jsonb
  OR payload#>'{log,rating}' NOT IN ('1'::jsonb,'2'::jsonb,'3'::jsonb,'4'::jsonb) OR payload#>'{log,rating}' IS NULL
  OR payload#>>'{log,reviewedAt}' IS NULL OR payload#>>'{log,revealedAt}' IS NULL OR payload#>>'{log,questionAt}' IS NULL
  OR coalesce(length(payload->>'attemptId'),0) NOT BETWEEN 1 AND 200
 THEN RAISE EXCEPTION 'activity_unverified_grade' USING ERRCODE='22023'; END IF;
 effective:=(payload#>>'{log,reviewedAt}')::timestamptz;
 IF effective IS DISTINCT FROM (payload#>>'{log,revealedAt}')::timestamptz
  OR effective IS DISTINCT FROM (payload#>>'{nextCard,lastReview}')::timestamptz
  OR effective<(payload#>>'{log,questionAt}')::timestamptz
 THEN RAISE EXCEPTION 'activity_unverified_time' USING ERRCODE='22023'; END IF;
 RETURN fsrs_private.append_activity(p_actor,'fsrs',op.id,op.card_id,effective);
END $function$;

ALTER FUNCTION "fsrs_private"."record_fsrs_activity"(p_actor uuid, p_operation_id text) OWNER TO "postgres";

-- Observed prosrc MD5 c257f17a800e2e35055f61ebf23afe92; production OID 40392.

CREATE OR REPLACE FUNCTION fsrs_private.record_learning_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 PERFORM fsrs_private.require_admission_integrity();
 IF NEW.kind='grade' THEN PERFORM fsrs_private.record_fsrs_activity(NEW.user_id,NEW.id); END IF;
 RETURN NEW;
END $function$;

ALTER FUNCTION "fsrs_private"."record_learning_activity"() OWNER TO "postgres";

-- Observed prosrc MD5 84a89f959af0863e337a9b55bae8ca3c; production OID 40318.

CREATE OR REPLACE FUNCTION fsrs_private.require_admission_integrity()
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF (SELECT contract_hash FROM fsrs_private.settings) IS DISTINCT FROM fsrs_private.contract_hash()
  OR (SELECT contract_hash FROM fsrs_private.manual_save_settings) IS DISTINCT FROM fsrs_private.manual_contract_hash()
  OR (SELECT contract_hash FROM fsrs_private.admission_settings) IS DISTINCT FROM fsrs_private.admission_contract_hash()
 THEN RAISE EXCEPTION 'learning_admission_unavailable' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM fsrs_private.admission_settings a CROSS JOIN fsrs_private.activity_settings t WHERE a.enabled AND (NOT t.enabled OR a.starts_at IS DISTINCT FROM t.starts_at OR t.profile_contract_hash IS DISTINCT FROM fsrs_private.activity_profile_hash())) THEN RAISE EXCEPTION 'learning_admission_unavailable' USING ERRCODE='55000';END IF;
END $function$;

ALTER FUNCTION "fsrs_private"."require_admission_integrity"() OWNER TO "postgres";

-- Observed prosrc MD5 9a00ba46e140f8f89454655bf6c44bd3; production OID 39881.

CREATE OR REPLACE FUNCTION fsrs_private.valid_card(c jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
DECLARE n text; introduced timestamptz; due_at timestamptz; reviewed timestamptz; local_time timestamp;
BEGIN
 IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR c->'version' IS DISTINCT FROM '1'::jsonb
  OR c->>'engine' IS DISTINCT FROM 'v5.3.2 using FSRS-6.0' OR c->>'policyVersion' IS DISTINCT FROM 'anki-seconds-v1'
  OR c->>'state' NOT IN ('New','Learning','Review','Relearning') OR c->>'state' IS NULL
  OR (SELECT count(*) FROM jsonb_object_keys(c))<>17
  OR NOT c ?& ARRAY['version','engine','policyVersion','timeZone','rolloverHour','introducedAt','revision','state','step','stability','difficulty','reps','lapses','due','lastReview','scheduledDays','elapsedDays'] THEN RETURN false; END IF;
 FOREACH n IN ARRAY ARRAY['revision','reps','lapses','step','scheduledDays','elapsedDays','rolloverHour'] LOOP
  IF jsonb_typeof(c->n) IS DISTINCT FROM 'number' OR c->>n !~ '^[0-9]+$' OR ((c->>n)::numeric>9007199254740991 OR (n IN ('revision','reps') AND (c->>n)::numeric>=9007199254740991)) THEN RETURN false; END IF;
 END LOOP;
 IF (c->>'rolloverHour')::integer NOT BETWEEN 0 AND 23 OR (c->>'lapses')::bigint>(c->>'reps')::bigint THEN RETURN false; END IF;
 FOREACH n IN ARRAY ARRAY['stability','difficulty'] LOOP
  IF jsonb_typeof(c->n) IS DISTINCT FROM 'number' OR (c->>n)::numeric < 0 OR (c->>n)::numeric > (CASE WHEN n='stability' THEN 36500 ELSE 10 END) THEN RETURN false; END IF;
 END LOOP;
 FOREACH n IN ARRAY ARRAY['introducedAt','due'] LOOP
  IF jsonb_typeof(c->n) IS DISTINCT FROM 'string' OR c->>n !~ 'T.*(Z|[+-][0-9]{2}:[0-9]{2})$' THEN RETURN false; END IF;
 END LOOP;
 IF jsonb_typeof(c->'timeZone') IS DISTINCT FROM 'string' THEN RETURN false; END IF;
 introduced:=(c->>'introducedAt')::timestamptz; due_at:=(c->>'due')::timestamptz;
 IF NOT isfinite(introduced) OR NOT isfinite(due_at) THEN RETURN false; END IF;
 local_time:=due_at AT TIME ZONE (c->>'timeZone');
 IF c->>'state'='New' THEN
  IF c->'lastReview' IS DISTINCT FROM 'null'::jsonb OR (c->>'stability')::numeric<>0 OR (c->>'difficulty')::numeric<>0
   OR (c->>'reps')::bigint<>0 OR (c->>'elapsedDays')::bigint<>0 OR (c->>'step')::integer<>0 OR due_at<introduced+interval '30 seconds' THEN RETURN false; END IF;
 ELSE
  IF jsonb_typeof(c->'lastReview') IS DISTINCT FROM 'string' OR c->>'lastReview' !~ 'T.*(Z|[+-][0-9]{2}:[0-9]{2})$' THEN RETURN false; END IF;
  reviewed:=(c->>'lastReview')::timestamptz;
  IF NOT isfinite(reviewed) OR reviewed<introduced OR due_at<reviewed OR (c->>'reps')::bigint<1
   OR (c->>'stability')::numeric<0.001 OR (c->>'difficulty')::numeric NOT BETWEEN 1 AND 10 THEN RETURN false; END IF;
 END IF;
 IF (c->>'state'='Learning' AND (c->>'step')::integer>1)
  OR (c->>'state'<>'Learning' AND (c->>'step')::integer<>0)
  OR (c->>'state'<>'Review' AND (c->>'scheduledDays')::bigint<>0)
  OR (c->>'state'='Review' AND (c->>'scheduledDays')::bigint NOT BETWEEN 1 AND 36500) THEN RETURN false; END IF;
 RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $function$;

ALTER FUNCTION "fsrs_private"."valid_card"(c jsonb) OWNER TO "postgres";

-- Observed prosrc MD5 771d6c4f3ecc170b6ae0eb685771ce4e; production OID 40114.

CREATE OR REPLACE FUNCTION fsrs_private.vocabulary_registry_entry(p_actor uuid, p_card_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v public.user_vocabulary%rowtype; f public.fsrs_cards%rowtype; is_known boolean; is_excluded boolean; wake_at timestamptz;
BEGIN
 SELECT * INTO v FROM public.user_vocabulary WHERE id=p_card_id AND user_id=p_actor;
 IF v.id IS NULL THEN RAISE EXCEPTION 'fsrs_vocabulary_not_available' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.fsrs_cards WHERE card_id=p_card_id AND user_id<>p_actor) THEN RAISE EXCEPTION 'fsrs_snapshot_inconsistent' USING ERRCODE='55000'; END IF;
 SELECT * INTO f FROM public.fsrs_cards WHERE card_id=p_card_id AND user_id=p_actor;
 SELECT EXISTS(SELECT 1 FROM public.user_known_words k WHERE k.user_id=p_actor
  AND k.lang=CASE v.language WHEN 'Korean' THEN 'ko' WHEN 'Japanese' THEN 'ja' WHEN 'Chinese' THEN 'zh' WHEN 'English' THEN 'en' WHEN 'French' THEN 'fr' END
  AND normalize(btrim(k.word_text),NFC) IN (normalize(btrim(v.word_text),NFC),normalize(btrim(v.base_form),NFC))) INTO is_known;
 is_excluded:=fsrs_private.blocked(p_actor,p_card_id);
 wake_at:=fsrs_private.next_question_at(p_actor,p_card_id);
 IF wake_at>date_trunc('milliseconds',wake_at) THEN wake_at:=date_trunc('milliseconds',wake_at)+interval '1 millisecond'; END IF;
 RETURN jsonb_build_object('cardId',v.id,'userId',p_actor,'enrolled',f.card_id IS NOT NULL,'card',f.card,
  'known',is_known,'excluded',is_excluded,'eligible',NOT is_known AND NOT is_excluded,
  'nextQuestionAt',CASE WHEN f.card_id IS NOT NULL THEN fsrs_private.iso_milliseconds(wake_at) END,
  'firstQuestionAt',CASE WHEN f.card_id IS NOT NULL THEN (SELECT fsrs_private.iso_milliseconds(question_at) FROM public.fsrs_new_receipts WHERE card_id=p_card_id AND user_id=p_actor) END);
END $function$;

ALTER FUNCTION "fsrs_private"."vocabulary_registry_entry"(p_actor uuid, p_card_id uuid) OWNER TO "postgres";

-- Observed prosrc MD5 4b822d188772a248642fbe43342f9f17; production OID 35719.

CREATE OR REPLACE FUNCTION graphql_public.graphql("operationName" text DEFAULT NULL::text, query text DEFAULT NULL::text, variables jsonb DEFAULT NULL::jsonb, extensions jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $function$;

ALTER FUNCTION "graphql_public"."graphql"("operationName" text, query text, variables jsonb, extensions jsonb) OWNER TO "supabase_admin";

-- Observed prosrc MD5 306cf4349016b7a66408990ac48a4d63; production OID 39600.

CREATE OR REPLACE FUNCTION library_private.protect_source_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if current_user='authenticated' then raise exception 'library_use_trash: 내 서재에서 휴지통으로 이동해 주세요.' using errcode='42501';end if;
 return old;
end $function$;

ALTER FUNCTION "library_private"."protect_source_delete"() OWNER TO "postgres";

-- Observed prosrc MD5 f563cf7209213aa03433ca30be0fe4a5; production OID 39282.

CREATE OR REPLACE FUNCTION public.classroom_save_vocabulary(p_owner uuid, p_root bigint, p_generation integer, p_material bigint, p_expected_raw text, p_expected_json jsonb, p_word jsonb, p_source jsonb, p_initial jsonb DEFAULT NULL::jsonb, p_confirm_id uuid DEFAULT NULL::uuid, p_confirm_meaning text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare r public.reading_materials%rowtype; src public.reading_materials%rowtype; result jsonb;
begin
 if current_user <> 'service_role' or p_owner is null then raise exception 'login_required' using errcode='42501'; end if;
 select * into r from public.reading_materials where id=p_root and processed_json#>>'{metadata,team,root}'='true' for share;
 if not found or coalesce((r.processed_json#>>'{metadata,team,pwGen}')::integer,0) is distinct from p_generation then raise exception 'class_access_changed' using errcode='42501'; end if;
 select * into src from public.reading_materials where id=p_material and owner_id=r.owner_id for share;
 if not found or (
  (r.processed_json#>>'{metadata,team,bookKey}' is not null and src.processed_json#>>'{metadata,book,key}'=r.processed_json#>>'{metadata,team,bookKey}') or
  (src.processed_json#>>'{metadata,team,key}'=r.processed_json#>>'{metadata,team,key}' and src.processed_json#>>'{metadata,team,root}' is distinct from 'true' and src.processed_json#>>'{metadata,team,day}' is not null)
 ) is not true then raise exception 'class_material_unavailable' using errcode='42501'; end if;
 if src.raw_text is distinct from p_expected_raw or src.processed_json is distinct from p_expected_json then raise exception 'source_changed' using errcode='40001'; end if;
 if p_source->>'kind' is distinct from 'class' or p_source#>>'{locator,team}' is distinct from r.processed_json#>>'{metadata,team,key}'
 or p_source#>>'{locator,materialId}' is distinct from p_material::text then raise exception 'invalid_context' using errcode='22023'; end if;
 result:=public.save_vocabulary_context_for(p_owner,p_word,p_source,p_confirm_id,p_confirm_meaning);
 if (result->>'created')::boolean and p_initial is not null then
  if jsonb_typeof(p_initial)<>'object' or (p_initial->>'interval')::numeric not between 0.01 and 36500
   or (p_initial->>'ease_factor')::numeric not between 1 and 10 or (p_initial->>'repetitions')::integer<0
   or p_initial->>'next_review_at' is null then raise exception 'invalid_initial_grade' using errcode='22023'; end if;
  update public.user_vocabulary set interval=(p_initial->>'interval')::numeric,ease_factor=(p_initial->>'ease_factor')::numeric,
   repetitions=(p_initial->>'repetitions')::integer,next_review_at=(p_initial->>'next_review_at')::timestamptz
   where id=(result->>'vocabularyId')::uuid and user_id=p_owner;
 end if;
 if (result->>'created')::boolean then
  result:=result||jsonb_build_object('word',(select to_jsonb(v) from public.user_vocabulary v where v.id=(result->>'vocabularyId')::uuid and v.user_id=p_owner));
 end if;
 return result;
end $function$;

ALTER FUNCTION "public"."classroom_save_vocabulary"(p_owner uuid, p_root bigint, p_generation integer, p_material bigint, p_expected_raw text, p_expected_json jsonb, p_word jsonb, p_source jsonb, p_initial jsonb, p_confirm_id uuid, p_confirm_meaning text) OWNER TO "postgres";

-- Observed prosrc MD5 a3d315a8c81181eccbb9072e8b9c3c7a; production OID 26824.

CREATE OR REPLACE FUNCTION public.enforce_role_change_by_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT is_admin() THEN
      RAISE EXCEPTION 'permission denied: only admins can change user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

ALTER FUNCTION "public"."enforce_role_change_by_admin"() OWNER TO "postgres";

-- Observed prosrc MD5 b30fcf098af0fb53e71b67b5529ae569; production OID 40328.

CREATE OR REPLACE FUNCTION public.fsrs_apply_learning_operation(p_actor uuid, p_operation jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE op jsonb:=p_operation; quota jsonb; result jsonb; prior public.fsrs_operations%rowtype; cid uuid; has_first boolean; expected bigint;
BEGIN
 IF p_actor IS NULL OR jsonb_typeof(op) IS DISTINCT FROM 'object' OR op->>'userId' IS DISTINCT FROM p_actor::text THEN RAISE EXCEPTION 'invalid_learning_request' USING ERRCODE='22023'; END IF;
 cid:=(op->>'cardId')::uuid;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,731));PERFORM fsrs_private.require_admission_integrity();
 SELECT * INTO prior FROM public.fsrs_operations WHERE user_id=p_actor AND id=op->>'id';
 IF prior.id IS NOT NULL THEN
  IF prior.operation IS DISTINCT FROM op THEN RAISE EXCEPTION 'fsrs_operation_replay_mismatch' USING ERRCODE='23505'; END IF;
  RETURN public.fsrs_apply_operation(p_actor,op)||jsonb_build_object('quota',fsrs_private.admission_status(p_actor,date_trunc('milliseconds',clock_timestamp())));
 END IF;
 IF op->>'kind'='question' THEN
  quota:=fsrs_private.admission_status(p_actor,date_trunc('milliseconds',clock_timestamp()));
  IF jsonb_typeof(op#>'{request,expectedPolicyRevision}') IS DISTINCT FROM 'number' OR op#>>'{request,expectedPolicyRevision}' !~ '^[0-9]+$'
   OR (op#>>'{request,expectedPolicyRevision}')::numeric>=9007199254740991 OR (op#>>'{request,expectedPolicyRevision}')::bigint<>(quota->>'policyRevision')::bigint
   OR op->'dailyNewLimit' IS DISTINCT FROM quota->'limit' THEN RAISE EXCEPTION 'learning_policy_conflict' USING ERRCODE='40001'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.fsrs_new_receipts WHERE user_id=p_actor AND card_id=cid) INTO has_first;
  IF NOT has_first AND (SELECT card->>'state'='New' FROM public.fsrs_cards WHERE user_id=p_actor AND card_id=cid) THEN
   IF quota->'active' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'learning_admission_inactive' USING ERRCODE='55000'; END IF;
   IF (quota->>'remaining')::integer<=0 THEN RAISE EXCEPTION 'learning_daily_new_limit' USING ERRCODE='55000'; END IF;
   INSERT INTO fsrs_private.admission_permits(transaction_id,user_id,card_id,operation_id,question_at,daily_new_limit,policy_revision)
    VALUES(txid_current(),p_actor,cid,op->>'id',(op#>>'{nextAttempt,questionAt}')::timestamptz,(quota->>'limit')::integer,(quota->>'policyRevision')::bigint);
  END IF;
 END IF;
 result:=public.fsrs_apply_operation(p_actor,op);
 IF EXISTS(SELECT 1 FROM fsrs_private.admission_permits WHERE transaction_id=txid_current()) THEN RAISE EXCEPTION 'learning_admission_guard_missing' USING ERRCODE='55000'; END IF;
 RETURN result||jsonb_build_object('quota',fsrs_private.admission_status(p_actor,date_trunc('milliseconds',clock_timestamp())));
END $function$;

ALTER FUNCTION "public"."fsrs_apply_learning_operation"(p_actor uuid, p_operation jsonb) OWNER TO "postgres";

-- Observed prosrc MD5 7ce546f1abdc3aa0023e7fe30cc986f7; production OID 39965.

CREATE OR REPLACE FUNCTION public.fsrs_apply_operation(p_actor uuid, p_operation jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE op jsonb:=p_operation; s fsrs_private.settings%rowtype; v public.user_vocabulary%rowtype;
 f public.fsrs_cards%rowtype; prior public.fsrs_operations%rowtype; target public.fsrs_operations%rowtype;
 cid uuid; oid text; kind text; expected bigint; c jsonb; a jsonb; result jsonb; at_time timestamptz; day_key date; exact_previous jsonb; event jsonb; target_event jsonb;
BEGIN
 IF p_actor IS NULL OR jsonb_typeof(op) IS DISTINCT FROM 'object' OR pg_column_size(op)>32768
  OR op->'version' IS DISTINCT FROM '1'::jsonb OR op->>'userId' IS DISTINCT FROM p_actor::text
  OR jsonb_typeof(op->'id') IS DISTINCT FROM 'string' OR length(op->>'id') NOT BETWEEN 1 AND 200
  OR jsonb_typeof(op->'cardId') IS DISTINCT FROM 'string' OR op->>'kind' NOT IN ('enroll','question','reveal','abandon','grade','undo') OR op->>'kind' IS NULL
  OR jsonb_typeof(op->'expectedRevision') IS DISTINCT FROM 'number' OR op->>'expectedRevision' !~ '^[0-9]+$'
  OR (op->>'expectedRevision')::numeric>=9007199254740991 THEN RAISE EXCEPTION 'invalid_fsrs_operation' USING ERRCODE='22023'; END IF;
 cid:=(op->>'cardId')::uuid; oid:=op->>'id'; kind:=op->>'kind'; expected:=(op->>'expectedRevision')::bigint;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,731));
 SELECT * INTO s FROM fsrs_private.settings FOR SHARE;
 IF NOT s.enabled OR s.contract_hash IS DISTINCT FROM fsrs_private.contract_hash() THEN RAISE EXCEPTION 'fsrs_storage_disabled' USING ERRCODE='55000'; END IF;
 SELECT * INTO v FROM public.user_vocabulary WHERE id=cid AND user_id=p_actor FOR UPDATE;
 IF v.id IS NULL THEN RAISE EXCEPTION 'word_not_available' USING ERRCODE='42501'; END IF;
 SELECT * INTO prior FROM public.fsrs_operations WHERE user_id=p_actor AND id=oid;
 IF prior.id IS NOT NULL THEN
  IF prior.operation IS DISTINCT FROM op THEN RAISE EXCEPTION 'fsrs_operation_replay_mismatch' USING ERRCODE='23505'; END IF;
  RETURN prior.result||jsonb_build_object('duplicate',true);
 END IF;
 IF fsrs_private.blocked(p_actor,cid) THEN RAISE EXCEPTION 'vocabulary_excluded' USING ERRCODE='55000'; END IF;
 SELECT * INTO f FROM public.fsrs_cards WHERE card_id=cid AND user_id=p_actor FOR UPDATE;
 IF kind='enroll' THEN
  c:=op->'nextCard';
  IF f.card_id IS NOT NULL OR expected<>0 OR NOT fsrs_private.valid_card(c) OR c->>'state'<>'New' OR c->>'revision'<>'0'
   OR v.created_at IS NULL OR v.created_at<s.activated_at OR v.created_at>clock_timestamp()
   OR v.repetitions IS DISTINCT FROM 0 OR v.interval IS DISTINCT FROM 0 OR v.last_reviewed_at IS NOT NULL
   OR EXISTS(SELECT 1 FROM public.review_events e WHERE e.user_id=p_actor AND (e.detail->>'word_id'=cid::text
    OR (e.source='vocab' AND e.lang=v.language AND normalize(btrim(e.item_key),NFC) IN (normalize(btrim(v.word_text),NFC),normalize(btrim(v.base_form),NFC)))))
   OR (c->>'introducedAt')::timestamptz<v.created_at OR (c->>'introducedAt')::timestamptz>clock_timestamp()+interval '5 seconds'
   OR (c->>'due')::timestamptz<>(c->>'introducedAt')::timestamptz+interval '30 seconds'
  THEN RAISE EXCEPTION 'fsrs_enrollment_not_available' USING ERRCODE='55000'; END IF;
  INSERT INTO public.fsrs_cards(card_id,user_id,card) VALUES(cid,p_actor,c) RETURNING * INTO f;
 ELSE
  IF f.card_id IS NULL THEN RAISE EXCEPTION 'fsrs_card_not_enrolled' USING ERRCODE='55000'; END IF;
  IF (f.card->>'revision')::bigint<>expected THEN RAISE EXCEPTION 'review_revision_conflict' USING ERRCODE='40001'; END IF;
  IF kind IN ('question','reveal','abandon') THEN
   a:=op->'nextAttempt';
   IF jsonb_typeof(a) IS DISTINCT FROM 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(a))<>(CASE WHEN kind='abandon' THEN 10 ELSE 9 END)
    OR NOT a ?& ARRAY['id','userId','cardId','card','phase','eligible','questionAt','revealedAt','hintedAt']
    OR jsonb_typeof(a->'id') IS DISTINCT FROM 'string' OR length(a->>'id') NOT BETWEEN 1 AND 200
    OR a->>'userId' IS DISTINCT FROM p_actor::text OR a->>'cardId' IS DISTINCT FROM cid::text OR a->'card' IS DISTINCT FROM f.card
    OR jsonb_typeof(a->'eligible') IS DISTINCT FROM 'boolean' OR jsonb_typeof(a->'questionAt') IS DISTINCT FROM 'string'
    OR a->>'questionAt' !~ 'T.*(Z|[+-][0-9]{2}:[0-9]{2})$'
   THEN RAISE EXCEPTION 'invalid_fsrs_attempt' USING ERRCODE='22023'; END IF;
   at_time:=(a->>'questionAt')::timestamptz;
   IF NOT isfinite(at_time) OR at_time<(f.card->>'due')::timestamptz OR at_time>clock_timestamp()+interval '5 seconds'
    THEN RAISE EXCEPTION 'fsrs_card_not_due' USING ERRCODE='55000'; END IF;
   IF kind='question' THEN
    IF at_time<fsrs_private.next_question_at(p_actor,cid) THEN RAISE EXCEPTION 'fsrs_card_not_due' USING ERRCODE='55000'; END IF;
    IF a->>'phase' IS DISTINCT FROM 'question' OR a->'revealedAt' IS DISTINCT FROM 'null'::jsonb OR a->'hintedAt' IS DISTINCT FROM 'null'::jsonb
     OR (f.attempt IS NOT NULL AND f.attempt->>'phase' IN ('question','revealed'))
     OR (f.attempt->>'phase'='abandoned' AND at_time<greatest((f.attempt->>'questionAt')::timestamptz,(f.attempt->>'revealedAt')::timestamptz)+interval '30 seconds')
     THEN RAISE EXCEPTION 'invalid_attempt_phase' USING ERRCODE='55000'; END IF;
    IF op ? 'dailyNewLimit' THEN
     IF op->'dailyNewLimit' NOT IN ('0'::jsonb,'5'::jsonb,'10'::jsonb,'15'::jsonb,'20'::jsonb,'30'::jsonb,'40'::jsonb) THEN RAISE EXCEPTION 'invalid_fsrs_daily_limit' USING ERRCODE='22023'; END IF;
     s.daily_new_limit:=(op->>'dailyNewLimit')::integer;
    END IF;
    IF f.card->>'state'='New' AND NOT EXISTS(SELECT 1 FROM public.fsrs_new_receipts WHERE card_id=cid) THEN
     day_key:=((at_time AT TIME ZONE (f.card->>'timeZone'))-make_interval(hours=>(f.card->>'rolloverHour')::integer))::date;
     IF (SELECT count(*) FROM public.fsrs_new_receipts WHERE user_id=p_actor AND learning_day=day_key)>=s.daily_new_limit
      THEN RAISE EXCEPTION 'fsrs_daily_new_limit' USING ERRCODE='55000'; END IF;
     INSERT INTO public.fsrs_new_receipts(card_id,user_id,operation_id,learning_day,question_at) VALUES(cid,p_actor,oid,day_key,at_time);
    END IF;
   ELSIF kind='abandon' THEN
    IF f.attempt IS NULL OR f.attempt->>'phase' NOT IN ('question','revealed') OR a->>'phase' IS DISTINCT FROM 'abandoned'
     OR (a-ARRAY['phase','abandonedAt']) IS DISTINCT FROM (f.attempt-'phase')
     OR jsonb_typeof(a->'abandonedAt') IS DISTINCT FROM 'string' OR a->>'abandonedAt' !~ 'T.*(Z|[+-][0-9]{2}:[0-9]{2})$'
     OR (a->>'abandonedAt')::timestamptz<greatest((f.attempt->>'questionAt')::timestamptz,(f.attempt->>'revealedAt')::timestamptz)
     OR (a->>'abandonedAt')::timestamptz>clock_timestamp()+interval '5 seconds'
     THEN RAISE EXCEPTION 'invalid_attempt_phase' USING ERRCODE='55000'; END IF;
   ELSE
    IF f.attempt IS NULL OR f.attempt->>'phase'<>'question' OR a->>'phase' IS DISTINCT FROM 'revealed'
     OR (a-ARRAY['phase','eligible','revealedAt','hintedAt']) IS DISTINCT FROM (f.attempt-ARRAY['phase','eligible','revealedAt','hintedAt'])
     OR (a->>'eligible')::boolean AND NOT (f.attempt->>'eligible')::boolean
     OR jsonb_typeof(a->'revealedAt') IS DISTINCT FROM 'string' OR a->>'revealedAt' !~ 'T.*(Z|[+-][0-9]{2}:[0-9]{2})$'
     OR (a->>'revealedAt')::timestamptz<at_time OR (a->>'revealedAt')::timestamptz>clock_timestamp()+interval '5 seconds'
     OR (a->'hintedAt'<>'null'::jsonb AND ((a->>'eligible')::boolean OR a->'hintedAt' IS DISTINCT FROM a->'revealedAt'))
     THEN RAISE EXCEPTION 'invalid_attempt_phase' USING ERRCODE='55000'; END IF;
   END IF;
   UPDATE public.fsrs_cards SET attempt=a WHERE card_id=cid RETURNING * INTO f;
  ELSE
   c:=op->'nextCard';
   IF op->'previousCard' IS DISTINCT FROM f.card OR NOT fsrs_private.valid_card(c) OR (c->>'revision')::bigint<>expected+1
    OR c->'introducedAt' IS DISTINCT FROM f.card->'introducedAt' OR c->'timeZone' IS DISTINCT FROM f.card->'timeZone'
    OR c->'rolloverHour' IS DISTINCT FROM f.card->'rolloverHour' THEN RAISE EXCEPTION 'invalid_fsrs_transition' USING ERRCODE='22023'; END IF;
   IF kind='grade' THEN
    IF f.attempt IS NULL OR f.attempt->>'phase'<>'revealed' OR f.attempt->'eligible' IS DISTINCT FROM 'true'::jsonb
     OR f.attempt->'hintedAt' IS DISTINCT FROM 'null'::jsonb OR op->>'attemptId' IS DISTINCT FROM f.attempt->>'id'
     OR f.attempt->'card' IS DISTINCT FROM f.card OR op#>'{log,questionAt}' IS DISTINCT FROM f.attempt->'questionAt'
     OR op#>'{log,revealedAt}' IS DISTINCT FROM f.attempt->'revealedAt'
     OR op#>'{log,optimizerEligible}' IS DISTINCT FROM 'true'::jsonb OR op#>'{log,rewardEligible}' IS DISTINCT FROM 'true'::jsonb
     OR op#>'{log,rating}' NOT IN ('1'::jsonb,'2'::jsonb,'3'::jsonb,'4'::jsonb) OR op#>'{log,rating}' IS NULL
     OR op#>'{log,reviewedAt}' IS DISTINCT FROM c->'lastReview'
     OR (c->>'lastReview')::timestamptz IS DISTINCT FROM (f.attempt->>'revealedAt')::timestamptz OR (c->>'lastReview')::timestamptz>clock_timestamp()+interval '5 seconds'
     OR (c->>'reps')::bigint<>(f.card->>'reps')::bigint+1
     OR op#>'{log,applied,revision}' IS DISTINCT FROM c->'revision' OR op#>'{log,applied,due}' IS DISTINCT FROM c->'due'
     OR op#>'{log,applied,state}' IS DISTINCT FROM c->'state' OR op#>'{log,applied,step}' IS DISTINCT FROM c->'step'
     THEN RAISE EXCEPTION 'invalid_fsrs_grade' USING ERRCODE='22023'; END IF;
   ELSE
    SELECT * INTO target FROM public.fsrs_operations o WHERE o.user_id=p_actor AND o.card_id=cid AND o.id=op->>'undoneOperationId' AND o.kind='grade';
    exact_previous:=jsonb_set(target.operation->'previousCard','{revision}',to_jsonb(expected+1));
    IF (f.attempt IS NOT NULL AND f.attempt->>'phase' IN ('question','revealed')) OR target.id IS NULL OR target.operation->'nextCard' IS DISTINCT FROM f.card OR c IS DISTINCT FROM exact_previous
     OR op#>'{log,optimizerEligible}' IS DISTINCT FROM 'false'::jsonb OR op#>'{log,rewardEligible}' IS DISTINCT FROM 'false'::jsonb
     OR op#>>'{log,reviewedAt}' IS NULL OR (op#>>'{log,reviewedAt}')::timestamptz<(target.operation#>>'{log,reviewedAt}')::timestamptz
     OR (op#>>'{log,reviewedAt}')::timestamptz>clock_timestamp()+interval '5 seconds'
     THEN RAISE EXCEPTION 'invalid_fsrs_undo' USING ERRCODE='22023'; END IF;
   END IF;
   IF kind='grade' THEN
    event:=jsonb_build_object('user_id',p_actor,'lang',v.language,'source','vocab','item_key',v.word_text,'correct',(op#>>'{log,rating}')::integer>1,
     'detail',jsonb_build_object('word_id',cid,'meaning',v.meaning,'rating',op#>'{log,rating}','mode','flash','qtype','flash',
      'fsrs_operation_id',oid,'fsrs_version',1,'optimizerEligible',true,'rewardEligible',true),'created_at',(op#>>'{log,reviewedAt}')::timestamptz);
   ELSE
    SELECT to_jsonb(e) INTO STRICT target_event FROM public.review_events e WHERE e.user_id=p_actor AND e.source='vocab' AND e.detail->>'fsrs_operation_id'=target.id
     AND e.detail->>'word_id'=cid::text AND e.created_at=(target.operation#>>'{log,reviewedAt}')::timestamptz;
    event:=jsonb_build_object('user_id',p_actor,'lang',target_event->>'lang','source','ui','item_key',target_event->>'item_key','correct',true,
     'detail',jsonb_build_object('qtype','undo','fsrs_operation_id',oid,'undo_of',jsonb_build_object('item_key',target_event->>'item_key',
      'rating',target_event#>'{detail,rating}','reviewed_at',target.operation#>'{log,reviewedAt}')),'created_at',(op#>>'{log,reviewedAt}')::timestamptz);
   END IF;
   INSERT INTO fsrs_private.event_permits(transaction_id,event) VALUES(txid_current(),event);
   -- The trusted actor is already authenticated by the server. Existing Korean guards require auth.uid().
   PERFORM set_config('request.jwt.claim.sub',p_actor::text,true);
   INSERT INTO public.review_events(user_id,lang,source,item_key,correct,detail,created_at)
    VALUES(p_actor,event->>'lang',event->>'source',event->>'item_key',(event->>'correct')::boolean,event->'detail',(event->>'created_at')::timestamptz);
   IF EXISTS(SELECT 1 FROM fsrs_private.event_permits WHERE transaction_id=txid_current()) THEN RAISE EXCEPTION 'fsrs_event_guard_not_installed'; END IF;
   UPDATE public.fsrs_cards SET card=c,attempt=NULL WHERE card_id=cid RETURNING * INTO f;
  END IF;
 END IF;
 result:=jsonb_build_object('cardId',cid,'userId',p_actor,'card',f.card,'attempt',f.attempt,'operationId',oid,'duplicate',false,'enrolled',true,'nextQuestionAt',CASE WHEN kind='undo' THEN greatest((c->>'due')::timestamptz,(op#>>'{log,reviewedAt}')::timestamptz+interval '30 seconds') ELSE fsrs_private.next_question_at(p_actor,cid) END,'excluded',false,'firstQuestionAt',(SELECT question_at FROM public.fsrs_new_receipts WHERE card_id=cid));
 INSERT INTO public.fsrs_operations(user_id,id,card_id,kind,operation,result) VALUES(p_actor,oid,cid,kind,op,result);
 RETURN result;
END $function$;

ALTER FUNCTION "public"."fsrs_apply_operation"(p_actor uuid, p_operation jsonb) OWNER TO "postgres";

-- Observed prosrc MD5 541fd0626640eff4b9a75ffd19715c5b; production OID 39960.

CREATE OR REPLACE FUNCTION public.fsrs_capabilities()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s fsrs_private.settings%rowtype;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'login_required' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT s FROM fsrs_private.settings;
 RETURN jsonb_build_object('version',1,'enabled',s.enabled AND s.contract_hash IS NOT DISTINCT FROM fsrs_private.contract_hash(),'policyVersion','anki-seconds-v1','dailyNewLimit',s.daily_new_limit);
END $function$;

ALTER FUNCTION "public"."fsrs_capabilities"() OWNER TO "postgres";

-- Observed prosrc MD5 be6e8d6c8ca0db366ec9d1220fc2f3f3; production OID 40329.

CREATE OR REPLACE FUNCTION public.fsrs_learning_admission_marker(p_actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor) THEN RAISE EXCEPTION 'invalid_learning_actor' USING ERRCODE='42501';END IF;
 PERFORM fsrs_private.require_admission_integrity();
 RETURN jsonb_build_object('version',1,'actorId',p_actor,'installed',true);
END $function$;

ALTER FUNCTION "public"."fsrs_learning_admission_marker"(p_actor uuid) OWNER TO "postgres";

-- Observed prosrc MD5 3e907c04af571ac9f4c9554a277bed48; production OID 39964.

CREATE OR REPLACE FUNCTION public.fsrs_legacy_boundary(p_card_id uuid DEFAULT NULL::uuid, p_item_key text DEFAULT NULL::text, p_language text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE actor uuid:=auth.uid(); enrolled boolean;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'login_required' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM fsrs_private.settings s WHERE s.contract_hash IS NOT NULL AND s.contract_hash IS DISTINCT FROM fsrs_private.contract_hash()) THEN RAISE EXCEPTION 'fsrs_contract_not_ready' USING ERRCODE='55000'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.fsrs_cards f JOIN public.user_vocabulary v ON v.id=f.card_id WHERE f.user_id=actor
  AND (f.card_id=p_card_id OR (p_language=v.language AND normalize(btrim(p_item_key),NFC) IN
   (normalize(btrim(v.word_text),NFC),normalize(btrim(v.base_form),NFC))))) INTO enrolled;
 RETURN jsonb_build_object('version',1,'actorId',actor,'enrolled',enrolled);
END $function$;

ALTER FUNCTION "public"."fsrs_legacy_boundary"(p_card_id uuid, p_item_key text, p_language text) OWNER TO "postgres";

-- Observed prosrc MD5 988a10d4324bc2b9fafc08322f4a3a2d; production OID 39961.

CREATE OR REPLACE FUNCTION public.fsrs_list_states(p_actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF p_actor IS NULL THEN RAISE EXCEPTION 'invalid_fsrs_actor' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('cardId',f.card_id,'userId',f.user_id,'card',f.card,'attempt',f.attempt,
  'enrolled',true,'nextQuestionAt',fsrs_private.next_question_at(p_actor,f.card_id),'firstQuestionAt',(SELECT question_at FROM public.fsrs_new_receipts r WHERE r.card_id=f.card_id),'excluded',fsrs_private.blocked(p_actor,f.card_id)) ORDER BY f.card_id) FROM public.fsrs_cards f WHERE f.user_id=p_actor),'[]'::jsonb);
END $function$;

ALTER FUNCTION "public"."fsrs_list_states"(p_actor uuid) OWNER TO "postgres";

-- Observed prosrc MD5 9c5ef623cac06e033e0b43ada9d4785f; production OID 39963.

CREATE OR REPLACE FUNCTION public.fsrs_read_operation(p_actor uuid, p_card_id uuid, p_operation_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF p_actor IS NULL THEN RAISE EXCEPTION 'invalid_fsrs_actor' USING ERRCODE='42501'; END IF;
 RETURN (SELECT operation FROM public.fsrs_operations WHERE user_id=p_actor AND card_id=p_card_id AND id=p_operation_id);
END $function$;

ALTER FUNCTION "public"."fsrs_read_operation"(p_actor uuid, p_card_id uuid, p_operation_id text) OWNER TO "postgres";

-- Observed prosrc MD5 413224503b1a27dfc537b73ca7b2779e; production OID 39962.

CREATE OR REPLACE FUNCTION public.fsrs_read_state(p_actor uuid, p_card_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v public.user_vocabulary%rowtype; f public.fsrs_cards%rowtype;
BEGIN
 IF p_actor IS NULL THEN RAISE EXCEPTION 'invalid_fsrs_actor' USING ERRCODE='42501'; END IF;
 SELECT * INTO v FROM public.user_vocabulary WHERE id=p_card_id AND user_id=p_actor;
 IF v.id IS NULL THEN RAISE EXCEPTION 'word_not_available' USING ERRCODE='42501'; END IF;
 SELECT * INTO f FROM public.fsrs_cards WHERE card_id=p_card_id AND user_id=p_actor;
 RETURN jsonb_build_object('cardId',v.id,'userId',p_actor,'card',f.card,'attempt',f.attempt,'excluded',fsrs_private.blocked(p_actor,p_card_id),
  'enrolled',f.card_id IS NOT NULL,'nextQuestionAt',fsrs_private.next_question_at(p_actor,p_card_id),'firstQuestionAt',(SELECT question_at FROM public.fsrs_new_receipts WHERE card_id=p_card_id),'operations',coalesce((SELECT jsonb_agg(x.operation ORDER BY x.received_at) FROM
   (SELECT operation,received_at FROM public.fsrs_operations WHERE user_id=p_actor AND card_id=p_card_id ORDER BY received_at DESC LIMIT 100) x),'[]'::jsonb));
END $function$;

ALTER FUNCTION "public"."fsrs_read_state"(p_actor uuid, p_card_id uuid) OWNER TO "postgres";

-- Observed prosrc MD5 664f815988ddb3171a24d0784c1382d9; production OID 40116.

CREATE OR REPLACE FUNCTION public.fsrs_save_manual_vocabulary(p_actor uuid, p_request jsonb, p_initial_card jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE req jsonb:=p_request; w jsonb; oid text; cid uuid; s fsrs_private.settings%rowtype;
 receipt public.fsrs_manual_save_receipts%rowtype; v public.user_vocabulary%rowtype; collision public.user_vocabulary%rowtype;
 count_matches integer; created_row boolean:=false; duplicate_op boolean:=false; entry jsonb; field text; at_time timestamptz;
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor) OR jsonb_typeof(req) IS DISTINCT FROM 'object'
  OR pg_column_size(req)>16384 OR (SELECT count(*) FROM jsonb_object_keys(req))<>5
  OR NOT req ?& ARRAY['action','accountId','operationId','cardId','vocabulary'] OR req->>'action' IS DISTINCT FROM 'save'
  OR req->>'accountId' IS DISTINCT FROM p_actor::text OR jsonb_typeof(req->'operationId') IS DISTINCT FROM 'string'
  OR req->>'operationId' !~ '^[A-Za-z0-9_.:-]{1,200}$' OR jsonb_typeof(req->'cardId') IS DISTINCT FROM 'string'
 THEN RAISE EXCEPTION 'fsrs_invalid_request' USING ERRCODE='22023'; END IF;
 oid:=req->>'operationId'; cid:=(req->>'cardId')::uuid; w:=req->'vocabulary';
 IF jsonb_typeof(w) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(w))<>6
  OR NOT w ?& ARRAY['word_text','base_form','meaning','furigana','pos','language'] THEN RAISE EXCEPTION 'fsrs_invalid_request' USING ERRCODE='22023'; END IF;
 FOREACH field IN ARRAY ARRAY['word_text','base_form','meaning','furigana','pos','language'] LOOP
  IF jsonb_typeof(w->field) IS DISTINCT FROM 'string' OR w->>field IS DISTINCT FROM normalize(btrim(w->>field),NFC) THEN RAISE EXCEPTION 'fsrs_invalid_request' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF length(w->>'word_text') NOT BETWEEN 1 AND 200 OR length(w->>'base_form') NOT BETWEEN 1 AND 200
  OR length(w->>'meaning')>2000 OR length(w->>'furigana')>500 OR length(w->>'pos')>80
  OR w->>'language' NOT IN ('Korean','Japanese','Chinese','English','French') THEN RAISE EXCEPTION 'fsrs_invalid_request' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,731));
 SELECT * INTO STRICT s FROM fsrs_private.settings FOR SHARE;
 IF NOT s.enabled OR s.contract_hash IS DISTINCT FROM fsrs_private.contract_hash()
  OR NOT (SELECT enabled FROM fsrs_private.manual_save_settings WHERE singleton)
  OR (SELECT contract_hash FROM fsrs_private.manual_save_settings) IS DISTINCT FROM fsrs_private.manual_contract_hash()
 THEN RAISE EXCEPTION 'fsrs_storage_disabled' USING ERRCODE='55000'; END IF;
 SELECT * INTO receipt FROM public.fsrs_manual_save_receipts WHERE user_id=p_actor AND operation_id=oid;
 IF receipt.operation_id IS NOT NULL THEN
  IF receipt.request IS DISTINCT FROM req OR receipt.requested_card_id<>cid THEN RAISE EXCEPTION 'fsrs_operation_replay_mismatch' USING ERRCODE='23505'; END IF;
  SELECT * INTO v FROM public.user_vocabulary WHERE id=receipt.vocabulary_id AND user_id=p_actor FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'fsrs_saved_vocabulary_not_available' USING ERRCODE='55000'; END IF;
  created_row:=receipt.created;duplicate_op:=true;
 ELSE
  -- Manual-save receipt IDs and 018 review IDs are distinct namespaces.
  IF EXISTS(SELECT 1 FROM public.fsrs_manual_save_receipts WHERE user_id=p_actor AND requested_card_id=cid)
  THEN RAISE EXCEPTION 'fsrs_operation_replay_mismatch' USING ERRCODE='23505'; END IF;
  -- A claimed UUID cannot hide a collision behind the duplicate-word path.
  SELECT * INTO collision FROM public.user_vocabulary WHERE id=cid;
  IF collision.id IS NOT NULL AND (collision.user_id IS DISTINCT FROM p_actor
   OR normalize(btrim(collision.word_text),NFC) IS DISTINCT FROM w->>'word_text')
  THEN RAISE EXCEPTION 'fsrs_requested_card_conflict' USING ERRCODE='23505'; END IF;
  SELECT count(*) INTO count_matches FROM public.user_vocabulary WHERE user_id=p_actor AND normalize(btrim(word_text),NFC)=w->>'word_text';
  IF count_matches>1 THEN RAISE EXCEPTION 'fsrs_vocabulary_ambiguous_match' USING ERRCODE='23505'; END IF;
  IF count_matches=1 THEN
   SELECT * INTO v FROM public.user_vocabulary WHERE user_id=p_actor AND normalize(btrim(word_text),NFC)=w->>'word_text' FOR UPDATE;
   -- Existing duplicate data is returned exactly, including language/meaning/source and any enrollment.
  ELSE
   IF NOT fsrs_private.valid_card(p_initial_card) OR p_initial_card->>'state'<>'New' OR p_initial_card->>'revision'<>'0'
    OR (p_initial_card->>'due')::timestamptz<>(p_initial_card->>'introducedAt')::timestamptz+interval '30 seconds'
   THEN RAISE EXCEPTION 'fsrs_invalid_initial_card' USING ERRCODE='22023'; END IF;
   at_time:=(p_initial_card->>'introducedAt')::timestamptz;
   IF at_time<s.activated_at OR at_time>clock_timestamp()+interval '5 seconds' THEN RAISE EXCEPTION 'fsrs_invalid_initial_card' USING ERRCODE='22023'; END IF;
   IF EXISTS(SELECT 1 FROM public.vocabulary_exclusions e WHERE e.user_id=p_actor AND (e.vocabulary_id=cid OR cid=ANY(e.retired_vocabulary_ids)
    OR (e.language=w->>'language' AND e.word_text IN (w->>'word_text',w->>'base_form'))))
    OR EXISTS(SELECT 1 FROM public.user_known_words k WHERE k.user_id=p_actor
     AND k.lang=CASE w->>'language' WHEN 'Korean' THEN 'ko' WHEN 'Japanese' THEN 'ja' WHEN 'Chinese' THEN 'zh' WHEN 'English' THEN 'en' WHEN 'French' THEN 'fr' END
     AND normalize(btrim(k.word_text),NFC) IN (w->>'word_text',w->>'base_form'))
   THEN RAISE EXCEPTION 'vocabulary_excluded' USING ERRCODE='55000'; END IF;
   -- Trusted service actor propagation is internal and does not count as normal-user acceptance.
   PERFORM set_config('request.jwt.claim.sub',p_actor::text,true);
   INSERT INTO public.user_vocabulary(id,user_id,word_text,base_form,meaning,furigana,pos,language,interval,repetitions,last_reviewed_at,created_at)
    VALUES(cid,p_actor,w->>'word_text',w->>'base_form',w->>'meaning',w->>'furigana',w->>'pos',w->>'language',0,0,NULL,at_time) RETURNING * INTO v;
   PERFORM public.fsrs_apply_operation(p_actor,jsonb_build_object('version',1,'id','manual-enroll:'||cid::text,'kind','enroll','userId',p_actor,'cardId',cid,
    'expectedRevision',0,'nextCard',p_initial_card,'request',req));
   created_row:=true;
  END IF;
  INSERT INTO public.fsrs_manual_save_receipts(user_id,operation_id,requested_card_id,vocabulary_id,request,created)
   VALUES(p_actor,oid,cid,v.id,req,created_row);
 END IF;
 entry:=fsrs_private.vocabulary_registry_entry(p_actor,v.id);
 RETURN jsonb_build_object('version',1,'actorId',p_actor,'operationId',oid,'requestedCardId',cid,'vocabularyId',v.id,
  'created',created_row,'enrolled',(entry->>'enrolled')::boolean,'duplicate',duplicate_op,'row',to_jsonb(v),'state',entry,
  'now',fsrs_private.iso_milliseconds(clock_timestamp()));
END $function$;

ALTER FUNCTION "public"."fsrs_save_manual_vocabulary"(p_actor uuid, p_request jsonb, p_initial_card jsonb) OWNER TO "postgres";

-- Observed prosrc MD5 f31dd8681a092d3df84746a0dfea9c79; production OID 40115.

CREATE OR REPLACE FUNCTION public.fsrs_vocabulary_snapshot(p_actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s fsrs_private.settings%rowtype; result jsonb;
BEGIN
 PERFORM fsrs_private.require_admission_integrity();
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor) THEN RAISE EXCEPTION 'invalid_fsrs_actor' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.fsrs_cards f LEFT JOIN public.user_vocabulary v ON v.id=f.card_id WHERE f.user_id=p_actor AND (v.id IS NULL OR v.user_id IS DISTINCT FROM p_actor)) THEN RAISE EXCEPTION 'fsrs_snapshot_inconsistent' USING ERRCODE='55000'; END IF;
 SELECT * INTO STRICT s FROM fsrs_private.settings;
 IF s.contract_hash IS DISTINCT FROM fsrs_private.contract_hash() OR (SELECT contract_hash FROM fsrs_private.manual_save_settings) IS DISTINCT FROM fsrs_private.manual_contract_hash() THEN RAISE EXCEPTION 'fsrs_snapshot_unavailable' USING ERRCODE='55000'; END IF;
 SELECT jsonb_build_object('version',1,'learningAdmissionVersion',1,'actorId',p_actor,'enabled',s.enabled,'registryAvailable',true,'complete',true,
  'now',fsrs_private.iso_milliseconds(statement_timestamp()),
  'rows',coalesce(jsonb_agg(to_jsonb(v) ORDER BY v.id),'[]'::jsonb),
  'registry',coalesce(jsonb_agg(fsrs_private.vocabulary_registry_entry(p_actor,v.id) ORDER BY v.id),'[]'::jsonb))
 INTO result FROM public.user_vocabulary v WHERE v.user_id=p_actor;
 RETURN result;
END $function$;

ALTER FUNCTION "public"."fsrs_vocabulary_snapshot"(p_actor uuid) OWNER TO "postgres";

-- Observed prosrc MD5 69b5b53f1cc47887c81e8f4b9a70c06c; production OID 39728.

CREATE OR REPLACE FUNCTION public.guard_excluded_review_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
 IF NEW.source<>'vocab' THEN RETURN NEW; END IF;
 IF auth.uid() IS NOT NULL THEN PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,731)); END IF;
 -- 기존 카드의 제외 조작과 평가 이벤트를 같은 행 잠금으로 직렬화한다.
 IF NEW.detail->>'word_id' IS NOT NULL THEN PERFORM 1 FROM public.user_vocabulary WHERE user_id=NEW.user_id AND id::text=NEW.detail->>'word_id' FOR UPDATE; END IF;
 IF EXISTS(SELECT 1 FROM public.vocabulary_exclusions e WHERE e.user_id=NEW.user_id AND (
  e.vocabulary_id::text=NEW.detail->>'word_id' OR EXISTS(SELECT 1 FROM unnest(e.retired_vocabulary_ids) retired WHERE retired::text=NEW.detail->>'word_id') OR (e.language=NEW.lang AND e.word_text=normalize(btrim(NEW.item_key),NFC)) OR
  EXISTS(SELECT 1 FROM public.user_vocabulary v WHERE v.user_id=NEW.user_id AND v.id::text=NEW.detail->>'word_id' AND
   e.language=v.language AND e.word_text=normalize(btrim(coalesce(nullif(v.base_form,''),v.word_text)),NFC)) OR
  (NEW.detail->>'word_id' IS NULL AND EXISTS(SELECT 1 FROM public.user_vocabulary v WHERE v.id=e.vocabulary_id AND v.language=NEW.lang AND
   (normalize(btrim(v.word_text),NFC)=normalize(btrim(NEW.item_key),NFC) OR normalize(btrim(v.base_form),NFC)=normalize(btrim(NEW.item_key),NFC))))))
 THEN RAISE EXCEPTION 'vocabulary_excluded' USING ERRCODE='55000'; END IF;
 RETURN NEW;
END $function$;

ALTER FUNCTION "public"."guard_excluded_review_event"() OWNER TO "postgres";

-- Observed prosrc MD5 ace98b29ea4c10a4d8b8950deda96bd7; production OID 39726.

CREATE OR REPLACE FUNCTION public.guard_excluded_vocabulary()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
 IF TG_OP='UPDATE' AND ROW(NEW.interval,NEW.ease_factor,NEW.repetitions,NEW.next_review_at,NEW.last_reviewed_at)
  IS NOT DISTINCT FROM ROW(OLD.interval,OLD.ease_factor,OLD.repetitions,OLD.next_review_at,OLD.last_reviewed_at) THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM public.vocabulary_exclusions e WHERE e.user_id=NEW.user_id AND (
  e.vocabulary_id=NEW.id OR (e.language=NEW.language AND
   e.word_text=normalize(btrim(coalesce(nullif(NEW.base_form,''),NEW.word_text)),NFC))))
 THEN RAISE EXCEPTION 'vocabulary_excluded' USING ERRCODE='55000'; END IF;
 RETURN NEW;
END $function$;

ALTER FUNCTION "public"."guard_excluded_vocabulary"() OWNER TO "postgres";

-- Observed prosrc MD5 70d0bab5521ce7afa3956dc12bd60f10; production OID 39741.

CREATE OR REPLACE FUNCTION public.guard_known_word_review_exclusion()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE active_keys text[];
BEGIN
 SELECT array_agg(k.word_text) INTO active_keys FROM public.user_known_words k WHERE k.user_id=OLD.user_id
  AND k.lang=CASE OLD.language WHEN 'Japanese' THEN 'ja' WHEN 'Chinese' THEN 'zh' WHEN 'English' THEN 'en' WHEN 'French' THEN 'fr' WHEN 'Korean' THEN 'ko' END
  AND k.word_text=ANY(OLD.known_word_keys);
 -- 신뢰된 FK cascade/known 동기화는 사용자·표시 자체를 지운다. 일반 RPC 삭제는 depth=1.
 IF TG_OP='DELETE' AND pg_catalog.pg_trigger_depth()>1 THEN RETURN OLD; END IF;
 IF cardinality(active_keys)>0 AND (TG_OP='DELETE' OR NEW.user_id IS DISTINCT FROM OLD.user_id
  OR NEW.language IS DISTINCT FROM OLD.language OR NEW.word_text IS DISTINCT FROM OLD.word_text
  OR NEW.vocabulary_id IS DISTINCT FROM OLD.vocabulary_id
  OR NOT active_keys <@ NEW.known_word_keys)
 THEN RAISE EXCEPTION 'known_word_active' USING ERRCODE='55000'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $function$;

ALTER FUNCTION "public"."guard_known_word_review_exclusion"() OWNER TO "postgres";

-- Observed prosrc MD5 4d76f715e7ff2f0a11bfd507cd99e0a2; production OID 39846.

CREATE OR REPLACE FUNCTION public.guard_korean_learning_contract()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE old_korean boolean:=false; new_korean boolean:=false; ready boolean;
BEGIN
 IF TG_OP<>'INSERT' THEN old_korean:=coalesce(to_jsonb(OLD)->>'language',to_jsonb(OLD)->>'lang') IN ('Korean','ko'); END IF;
 IF TG_OP<>'DELETE' THEN new_korean:=coalesce(to_jsonb(NEW)->>'language',to_jsonb(NEW)->>'lang') IN ('Korean','ko'); END IF;
 IF TG_TABLE_NAME='review_events' AND TG_OP<>'DELETE' AND EXISTS(
  SELECT 1 FROM public.user_vocabulary v WHERE v.user_id=NEW.user_id AND v.language='Korean' AND v.id::text=to_jsonb(NEW)->'detail'->>'word_id') THEN new_korean:=true; END IF;
 IF TG_TABLE_NAME IN ('vocabulary_exclusions','vocabulary_contexts') THEN
  IF TG_OP<>'INSERT' AND EXISTS(SELECT 1 FROM public.user_vocabulary v WHERE v.id::text=to_jsonb(OLD)->>'vocabulary_id' AND v.user_id=OLD.user_id AND v.language='Korean') THEN old_korean:=true; END IF;
  IF TG_OP<>'DELETE' AND EXISTS(SELECT 1 FROM public.user_vocabulary v WHERE v.id::text=to_jsonb(NEW)->>'vocabulary_id' AND v.user_id=NEW.user_id AND v.language='Korean') THEN new_korean:=true; END IF;
 END IF;
 IF old_korean OR new_korean THEN
  ready:=(public.learning_language_capabilities()->'languages'->'Korean'->>'save')::boolean;
  IF ready IS DISTINCT FROM true THEN RAISE EXCEPTION 'korean_learning_not_ready' USING ERRCODE='55000'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $function$;

ALTER FUNCTION "public"."guard_korean_learning_contract"() OWNER TO "postgres";

-- Observed prosrc MD5 3cca47555822970990d652c1a01205b8; production OID 38781.

CREATE OR REPLACE FUNCTION public.guard_source_passage_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF OLD.processed_json->'metadata'->'composer'->'passage' IS NOT NULL AND
    (NEW.processed_json IS DISTINCT FROM OLD.processed_json OR NEW.raw_text IS DISTINCT FROM OLD.raw_text) AND
    current_setting('manabi.passage_write',true) IS DISTINCT FROM OLD.id::text
  THEN RAISE EXCEPTION 'PASSAGE_USE_ANALYSIS_RPC' USING ERRCODE='40001'; END IF;
  RETURN NEW;
END;
$function$;

ALTER FUNCTION "public"."guard_source_passage_write"() OWNER TO "postgres";

-- Observed prosrc MD5 c6285e67e4e39f263d934fac2145035c; production OID 26823.

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$function$;

ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";

-- Observed prosrc MD5 34faab448b0ca232a7c94573c1dca08a; production OID 40320.

CREATE OR REPLACE FUNCTION public.learning_admission_status(p_actor uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT fsrs_private.admission_status(p_actor,date_trunc('milliseconds',statement_timestamp()))
$function$;

ALTER FUNCTION "public"."learning_admission_status"(p_actor uuid) OWNER TO "postgres";

-- Observed prosrc MD5 65e769b7f890cd88f04dc53ae0616c8c; production OID 40322.

CREATE OR REPLACE FUNCTION public.learning_admit_legacy(p_actor uuid, p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r jsonb:=p_request; cid uuid; v public.user_vocabulary%rowtype; prev fsrs_private.admission_requests%rowtype; first fsrs_private.legacy_admissions%rowtype; quota jsonb; at_time timestamptz; consumed_slot boolean:=false; is_duplicate boolean:=false;
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor) OR jsonb_typeof(r) IS DISTINCT FROM 'object' OR pg_column_size(r)>4096
  OR (SELECT count(*) FROM jsonb_object_keys(r))<>5 OR NOT r ?& ARRAY['action','accountId','operationId','cardId','expectedPolicyRevision']
  OR r->>'action' IS DISTINCT FROM 'admit' OR r->>'accountId' IS DISTINCT FROM p_actor::text
  OR jsonb_typeof(r->'operationId') IS DISTINCT FROM 'string' OR r->>'operationId' !~ '^[A-Za-z0-9_.:-]{1,200}$'
  OR jsonb_typeof(r->'cardId') IS DISTINCT FROM 'string'
  OR jsonb_typeof(r->'expectedPolicyRevision') IS DISTINCT FROM 'number' OR r->>'expectedPolicyRevision' !~ '^[0-9]+$' OR (r->>'expectedPolicyRevision')::numeric>=9007199254740991
 THEN RAISE EXCEPTION 'invalid_learning_request' USING ERRCODE='22023'; END IF;
 cid:=(r->>'cardId')::uuid;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,731));PERFORM fsrs_private.require_admission_integrity();
 SELECT * INTO v FROM public.user_vocabulary WHERE user_id=p_actor AND id=cid FOR UPDATE;
 IF v.id IS NULL THEN RAISE EXCEPTION 'learning_word_not_available' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.fsrs_cards WHERE card_id=cid) THEN RAISE EXCEPTION 'learning_card_enrolled' USING ERRCODE='55000'; END IF;
 IF fsrs_private.blocked(p_actor,cid) THEN RAISE EXCEPTION 'vocabulary_excluded' USING ERRCODE='55000'; END IF;
 SELECT * INTO prev FROM fsrs_private.admission_requests WHERE user_id=p_actor AND operation_id=r->>'operationId';
 at_time:=date_trunc('milliseconds',clock_timestamp());quota:=fsrs_private.admission_status(p_actor,at_time);
 IF prev.operation_id IS NOT NULL THEN
  IF prev.request IS DISTINCT FROM r OR prev.card_id<>cid THEN RAISE EXCEPTION 'learning_operation_replay_mismatch' USING ERRCODE='23505'; END IF;
  is_duplicate:=true;
 ELSE
  IF v.last_reviewed_at IS NOT NULL AND v.next_review_at>at_time THEN RAISE EXCEPTION 'learning_card_not_due' USING ERRCODE='55000'; END IF;
  IF (r->>'expectedPolicyRevision')::bigint<>(quota->>'policyRevision')::bigint THEN RAISE EXCEPTION 'learning_policy_conflict' USING ERRCODE='40001'; END IF;
  SELECT * INTO first FROM fsrs_private.legacy_admissions WHERE user_id=p_actor AND card_id=cid;
  IF first.card_id IS NULL THEN
   consumed_slot:=v.last_reviewed_at IS NULL;
   IF consumed_slot THEN
    IF quota->'active' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'learning_admission_inactive' USING ERRCODE='55000'; END IF;
    IF (quota->>'remaining')::integer<=0 THEN RAISE EXCEPTION 'learning_daily_new_limit' USING ERRCODE='55000'; END IF;
   END IF;
   INSERT INTO fsrs_private.legacy_admissions(user_id,card_id,first_question_at,learning_day,consumed,starts_at)
    VALUES(p_actor,cid,at_time,fsrs_private.admission_day(at_time),consumed_slot,(quota->>'startsAt')::timestamptz) RETURNING * INTO first;
  END IF;
  INSERT INTO fsrs_private.admission_requests(user_id,operation_id,card_id,request,admitted_at,learning_day,starts_at,consumed,first_question_at)
   VALUES(p_actor,r->>'operationId',cid,r,at_time,fsrs_private.admission_day(at_time),(quota->>'startsAt')::timestamptz,consumed_slot,CASE WHEN first.consumed THEN first.first_question_at END) RETURNING * INTO prev;
 END IF;
 RETURN jsonb_build_object('version',1,'actorId',p_actor,'operationId',prev.operation_id,'cardId',cid,'admitted',true,'consumed',prev.consumed,'duplicate',is_duplicate,
  'firstQuestionAt',fsrs_private.iso_milliseconds(prev.first_question_at),'admittedAt',fsrs_private.iso_milliseconds(prev.admitted_at),'startsAt',fsrs_private.iso_milliseconds(prev.starts_at),'learningDay',prev.learning_day::text,
  'quota',fsrs_private.admission_status(p_actor,date_trunc('milliseconds',clock_timestamp())));
END $function$;

ALTER FUNCTION "public"."learning_admit_legacy"(p_actor uuid, p_request jsonb) OWNER TO "postgres";

-- Observed prosrc MD5 737c2d4ce3a8390baebe80b53359621f; production OID 40321.

CREATE OR REPLACE FUNCTION public.learning_configure_admission(p_actor uuid, p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r jsonb:=p_request; prev fsrs_private.admission_config_receipts%rowtype; current_policy fsrs_private.admission_policies%rowtype; expected bigint; at_time timestamptz;
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor) OR jsonb_typeof(r) IS DISTINCT FROM 'object' OR pg_column_size(r)>4096
  OR (SELECT count(*) FROM jsonb_object_keys(r))<>5 OR NOT r ?& ARRAY['action','accountId','operationId','expectedPolicyRevision','dailyNewLimit']
  OR r->>'action' IS DISTINCT FROM 'configure' OR r->>'accountId' IS DISTINCT FROM p_actor::text
  OR jsonb_typeof(r->'operationId') IS DISTINCT FROM 'string' OR r->>'operationId' !~ '^[A-Za-z0-9_.:-]{1,200}$'
  OR jsonb_typeof(r->'expectedPolicyRevision') IS DISTINCT FROM 'number' OR r->>'expectedPolicyRevision' !~ '^[0-9]+$' OR (r->>'expectedPolicyRevision')::numeric>=9007199254740991
  OR r->'dailyNewLimit' NOT IN('0'::jsonb,'5'::jsonb,'10'::jsonb,'15'::jsonb,'20'::jsonb,'30'::jsonb,'40'::jsonb)
 THEN RAISE EXCEPTION 'invalid_learning_request' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,731));PERFORM fsrs_private.require_admission_integrity();
 SELECT * INTO prev FROM fsrs_private.admission_config_receipts WHERE user_id=p_actor AND operation_id=r->>'operationId';
 IF prev.operation_id IS NOT NULL THEN
  IF prev.request IS DISTINCT FROM r THEN RAISE EXCEPTION 'learning_operation_replay_mismatch' USING ERRCODE='23505'; END IF;
 ELSE
  SELECT * INTO current_policy FROM fsrs_private.admission_policies WHERE user_id=p_actor FOR UPDATE;
  expected:=(r->>'expectedPolicyRevision')::bigint;
  IF expected<>coalesce(current_policy.revision,0) THEN RAISE EXCEPTION 'learning_policy_conflict' USING ERRCODE='40001'; END IF;
  IF expected>=9007199254740990 THEN RAISE EXCEPTION 'learning_policy_revision_exhausted' USING ERRCODE='55000'; END IF;
  INSERT INTO fsrs_private.admission_policies(user_id,daily_new_limit,revision) VALUES(p_actor,(r->>'dailyNewLimit')::integer,expected+1)
   ON CONFLICT(user_id) DO UPDATE SET daily_new_limit=excluded.daily_new_limit,revision=excluded.revision;
  INSERT INTO fsrs_private.admission_config_receipts(user_id,operation_id,request,received_at) VALUES(p_actor,r->>'operationId',r,date_trunc('milliseconds',clock_timestamp()));
 END IF;
 RETURN jsonb_build_object('version',1,'actorId',p_actor,'operationId',r->>'operationId','duplicate',prev.operation_id IS NOT NULL,'quota',fsrs_private.admission_status(p_actor,date_trunc('milliseconds',clock_timestamp())));
END $function$;

ALTER FUNCTION "public"."learning_configure_admission"(p_actor uuid, p_request jsonb) OWNER TO "postgres";

-- Observed prosrc MD5 22f34f634ecce02e533bb008003e2867; production OID 39852.

CREATE OR REPLACE FUNCTION public.learning_language_capabilities()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
 DECLARE live_hash text; ready boolean:=false;
 BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'login_required' USING ERRCODE='42501'; END IF;
  WITH RECURSIVE relevant_roles(oid) AS (
 SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN ('authenticated','anon','service_role')
 UNION SELECT m.roleid FROM pg_catalog.pg_auth_members m JOIN relevant_roles r ON r.oid=m.member
), tables AS (
 SELECT c.* FROM pg_catalog.pg_class c WHERE c.relnamespace='public'::pg_catalog.regnamespace
 AND c.relname IN ('user_vocabulary','vocabulary_contexts','user_known_words','vocabulary_exclusions','review_events','reading_materials','uploaded_pdfs','active_vocabulary','vocabulary_with_exclusions')
), objects AS (
 SELECT 'relation:'||c.relname AS key,pg_catalog.jsonb_build_array(c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.relacl,c.reloptions,c.relowner) AS val FROM tables c
 UNION ALL SELECT 'role:'||r.rolname,pg_catalog.jsonb_build_array(r.rolsuper,r.rolbypassrls,r.rolinherit) FROM pg_catalog.pg_roles r JOIN relevant_roles rr ON rr.oid=r.oid
 UNION ALL SELECT 'membership:'||m.member::text||':'||m.roleid::text,pg_catalog.to_jsonb(m) FROM pg_catalog.pg_auth_members m JOIN relevant_roles r ON r.oid=m.member
 UNION ALL SELECT 'schema:'||n.nspname,pg_catalog.jsonb_build_array(n.nspacl,n.nspowner) FROM pg_catalog.pg_namespace n WHERE n.nspname IN ('public','auth')
 UNION ALL SELECT 'constraint:'||c.relname||':'||x.conname,pg_catalog.to_jsonb(pg_catalog.pg_get_constraintdef(x.oid)) FROM pg_catalog.pg_constraint x JOIN tables c ON c.oid=x.conrelid
 UNION ALL SELECT 'index:'||c.relname||':'||i.indexrelid::text,pg_catalog.jsonb_build_array(pg_catalog.pg_get_indexdef(i.indexrelid),i.indisvalid,i.indisready) FROM pg_catalog.pg_index i JOIN tables c ON c.oid=i.indrelid
 UNION ALL SELECT 'policy:'||c.relname||':'||p.polname,pg_catalog.jsonb_build_array(p.polcmd,p.polpermissive,p.polroles,pg_catalog.pg_get_expr(p.polqual,p.polrelid),pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid)) FROM pg_catalog.pg_policy p JOIN tables c ON c.oid=p.polrelid
 UNION ALL SELECT 'trigger:'||c.relname||':'||t.tgname,pg_catalog.jsonb_build_array(pg_catalog.pg_get_triggerdef(t.oid),t.tgenabled) FROM pg_catalog.pg_trigger t JOIN tables c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal
 UNION ALL SELECT 'view:'||c.relname,pg_catalog.to_jsonb(pg_catalog.pg_get_viewdef(c.oid,true)) FROM tables c WHERE c.relkind='v'
 UNION ALL SELECT 'column:'||c.relname||':'||a.attname,pg_catalog.jsonb_build_array(a.atttypid,a.atttypmod,a.attnotnull,a.attacl,a.attidentity,a.attgenerated,pg_catalog.pg_get_expr(d.adbin,d.adrelid)) FROM pg_catalog.pg_attribute a JOIN tables c ON c.oid=a.attrelid LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attnum>0 AND NOT a.attisdropped
 UNION ALL SELECT 'function:'||p.oid::text,pg_catalog.jsonb_build_array(pg_catalog.pg_get_functiondef(p.oid),p.proacl,p.proowner) FROM pg_catalog.pg_proc p WHERE p.oid IN (
 SELECT pg_catalog.to_regprocedure(f.signature) FROM (VALUES ('public.save_vocabulary_context(jsonb,jsonb,uuid,text)'),('public.set_vocabulary_exclusion(text,text,uuid,boolean,uuid)'),('public.lock_vocabulary_exclusion_owner()'),('public.preserve_deleted_vocabulary_exclusion()'),('public.guard_excluded_vocabulary()'),('public.guard_excluded_review_event()'),('public.sync_vocabulary_exclusion_identity()'),('public.sync_known_word_review_exclusion()'),('public.guard_known_word_review_exclusion()')) f(signature)
 UNION SELECT dependency.oid FROM (VALUES ('public.save_vocabulary_context(jsonb,jsonb,uuid,text)'),('public.save_vocabulary_context_for(uuid,jsonb,jsonb,uuid,text)'),('public.viewer_replace_analysis(bigint,text,jsonb,text,jsonb,uuid)'),('public.viewer_undo_vocabulary_save(uuid,jsonb,uuid[])'),('public.classroom_save_vocabulary(uuid,bigint,integer,bigint,text,jsonb,jsonb,jsonb,jsonb,uuid,text)'),('library_private.protect_source_delete()'),('public.guard_source_passage_write()'),('public.library_book_preserve_metadata()'),('public.validate_source_passage()'),('public.protect_composer_source()')) f(signature)
 JOIN pg_catalog.pg_proc dependency ON dependency.oid::pg_catalog.regprocedure::text=f.signature
 UNION SELECT t.tgfoid FROM pg_catalog.pg_trigger t JOIN tables c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal)
) SELECT pg_catalog.md5(pg_catalog.jsonb_object_agg(key,val ORDER BY key)::text) FROM objects INTO live_hash;
  ready:=live_hash= '47e0b3e8bb95bfdb705d279547f92b23';
  RETURN pg_catalog.jsonb_build_object('version',1,'languages',pg_catalog.jsonb_build_object('Korean',
   pg_catalog.jsonb_build_object('save',ready,'review',ready,'known',ready,'exclude',ready)));
 END $function$;

ALTER FUNCTION "public"."learning_language_capabilities"() OWNER TO "postgres";

-- Observed prosrc MD5 95b5dc5352234a531599207175baf099; production OID 39612.

CREATE OR REPLACE FUNCTION public.library_book_preserve_metadata()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
 IF OLD.processed_json#>>'{metadata,book,orderRevision}' IS NOT NULL
  AND coalesce(current_setting('manabi.book_reorder',true),'')<>OLD.id::text THEN
  NEW.processed_json:=jsonb_set(coalesce(NEW.processed_json,'{}'),'{metadata}',
   coalesce(NEW.processed_json->'metadata','{}')||
   jsonb_build_object('book',OLD.processed_json#>'{metadata,book}')||
   CASE WHEN OLD.processed_json#>'{metadata,bookEntry}' IS NOT NULL
    THEN jsonb_build_object('bookEntry',OLD.processed_json#>'{metadata,bookEntry}') ELSE '{}'::jsonb END);
 END IF;
 RETURN NEW;
END;
$function$;

ALTER FUNCTION "public"."library_book_preserve_metadata"() OWNER TO "postgres";

-- Observed prosrc MD5 0d6c6b7886c4264a3eea0310d4449e41; production OID 39721.

CREATE OR REPLACE FUNCTION public.lock_vocabulary_exclusion_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
 IF auth.uid() IS NOT NULL THEN PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,731)); END IF;
 RETURN NULL;
END $function$;

ALTER FUNCTION "public"."lock_vocabulary_exclusion_owner"() OWNER TO "postgres";

-- Observed prosrc MD5 099b30885e28aa9d888567cade758f39; production OID 38780.

CREATE OR REPLACE FUNCTION public.open_source_passage(p_parent bigint, p_source jsonb, p_text text, p_language text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  parent public.reading_materials%ROWTYPE;
  result public.reading_materials%ROWTYPE;
  source jsonb;
  attempt uuid;
  location text;
BEGIN
  SELECT * INTO parent FROM public.reading_materials WHERE id=p_parent AND owner_id=auth.uid() AND visibility='private' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PASSAGE_ACCESS' USING ERRCODE='42501'; END IF;
  IF COALESCE(char_length(p_text),0) NOT BETWEEN 1 AND 1500 OR btrim(p_text)='' THEN RAISE EXCEPTION 'PASSAGE_LENGTH'; END IF;
  IF p_language IS NULL OR p_language NOT IN ('Japanese','Chinese','English','French') THEN RAISE EXCEPTION 'PASSAGE_LANGUAGE'; END IF;
  IF p_source IS NULL OR char_length(p_source::text)>24000 THEN RAISE EXCEPTION 'PASSAGE_INVALID'; END IF;
  -- Only the documented locator fields enter immutable source metadata; never signed URLs or paths.
  source := jsonb_strip_nulls(jsonb_build_object('version',1,'kind',p_source->>'kind',
    'textVersion',p_source->>'textVersion','revision',CASE WHEN p_source->>'kind'='body' THEN p_source->>'revision' END,
    'assetHash',p_source->>'assetHash','page',p_source->'page','chapter',p_source->'chapter',
    'spinePath',p_source->>'spinePath','spineIndex',p_source->'spineIndex',
    'manual',COALESCE(p_source->>'manual'='true',false),
    'quote',CASE WHEN p_source->>'manual'='true' THEN NULL ELSE jsonb_build_object(
      'exact',p_source->'quote'->>'exact','prefix',p_source->'quote'->>'prefix','suffix',p_source->'quote'->>'suffix',
      'start',p_source->'quote'->'start','end',p_source->'quote'->'end') END));
  IF source->>'kind'='body' AND parent.document_json->>'revision' IS DISTINCT FROM source->>'revision' THEN
    RAISE EXCEPTION 'PASSAGE_SOURCE_CHANGED' USING ERRCODE='40001';
  END IF;
  -- Hash is an idempotency identity, not an authorization credential. Source location participates.
  attempt := md5(jsonb_build_array(auth.uid(),p_parent,source,p_text,p_language)::text)::uuid;
  SELECT * INTO result FROM public.reading_materials WHERE owner_id=auth.uid()
    AND processed_json->'metadata'->>'importAttempt'=attempt::text;
  IF FOUND THEN RETURN to_jsonb(result); END IF;
  location := CASE source->>'kind' WHEN 'pdf' THEN source->>'page'||'쪽'
    WHEN 'epub' THEN source->>'chapter'||'장' ELSE '본문' END;
  BEGIN
    INSERT INTO public.reading_materials(owner_id,visibility,title,raw_text,processed_json)
    VALUES(auth.uid(),'private',left(parent.title,200)||' · '||location,p_text,
      jsonb_build_object('status','pending','sequence','[]'::jsonb,'dictionary','{}'::jsonb,'last_idx',-1,
        'metadata',jsonb_build_object('language',p_language,'importAttempt',attempt::text,
          'composer',jsonb_build_object('version',1,'role','study','parentId',p_parent::text,
            'passage',source,'hasBody',true,'excerpt',left(p_text,120),'assets','[]'::jsonb,'links','[]'::jsonb))))
    RETURNING * INTO result;
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO result FROM public.reading_materials WHERE owner_id=auth.uid()
      AND processed_json->'metadata'->>'importAttempt'=attempt::text;
    IF NOT FOUND THEN RAISE; END IF;
  END;
  RETURN to_jsonb(result);
END;
$function$;

ALTER FUNCTION "public"."open_source_passage"(p_parent bigint, p_source jsonb, p_text text, p_language text) OWNER TO "postgres";

-- Observed prosrc MD5 79f0ef445d24e92c15fff8f4c179a629; production OID 39724.

CREATE OR REPLACE FUNCTION public.preserve_deleted_vocabulary_exclusion()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE e public.vocabulary_exclusions%rowtype;
BEGIN
 SELECT * INTO e FROM public.vocabulary_exclusions WHERE user_id=OLD.user_id AND (vocabulary_id=OLD.id OR (language=OLD.language AND word_text=normalize(btrim(coalesce(nullif(OLD.base_form,''),OLD.word_text)),NFC))) ORDER BY (vocabulary_id=OLD.id) DESC NULLS LAST LIMIT 1;
 IF e.id IS NOT NULL AND NOT OLD.id=ANY(e.retired_vocabulary_ids) THEN
  UPDATE public.vocabulary_exclusions SET retired_vocabulary_ids=array_append(retired_vocabulary_ids,OLD.id) WHERE id=e.id RETURNING * INTO e;
 END IF;
 IF e.id IS NULL OR e.vocabulary_id IS DISTINCT FROM OLD.id THEN RETURN OLD; END IF;
 IF EXISTS(SELECT 1 FROM public.vocabulary_exclusions WHERE user_id=e.user_id AND language=e.language AND word_text=e.word_text AND vocabulary_id IS NULL) THEN
  UPDATE public.vocabulary_exclusions SET retired_vocabulary_ids=ARRAY(SELECT DISTINCT unnest(retired_vocabulary_ids||e.retired_vocabulary_ids))
   WHERE user_id=e.user_id AND language=e.language AND word_text=e.word_text AND vocabulary_id IS NULL;
  DELETE FROM public.vocabulary_exclusions WHERE id=e.id;
 ELSE UPDATE public.vocabulary_exclusions SET vocabulary_id=NULL WHERE id=e.id;
 END IF;
 RETURN OLD;
END $function$;

ALTER FUNCTION "public"."preserve_deleted_vocabulary_exclusion"() OWNER TO "postgres";

-- Observed prosrc MD5 dea10802e0aeaef706714fdace11a603; production OID 38677.

CREATE OR REPLACE FUNCTION public.protect_composer_source()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF OLD.processed_json->'metadata'->'composer'->>'version' = '1' AND (
    NEW.raw_text IS DISTINCT FROM OLD.raw_text
    OR NEW.processed_json->'metadata'->'composer' IS DISTINCT FROM OLD.processed_json->'metadata'->'composer'
    OR NEW.processed_json->'metadata'->'importAttempt' IS DISTINCT FROM OLD.processed_json->'metadata'->'importAttempt'
  ) THEN
    RAISE EXCEPTION 'composer_source_is_immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

ALTER FUNCTION "public"."protect_composer_source"() OWNER TO "postgres";

-- Observed prosrc MD5 03b53aa8f7cdad5d23d503a26a873e61; production OID 38476.

CREATE OR REPLACE FUNCTION public.save_vocabulary_context(p_word jsonb, p_source jsonb, p_confirm_id uuid DEFAULT NULL::uuid, p_confirm_meaning text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select public.save_vocabulary_context_for(auth.uid(),p_word,p_source,p_confirm_id,p_confirm_meaning);
$function$;

ALTER FUNCTION "public"."save_vocabulary_context"(p_word jsonb, p_source jsonb, p_confirm_id uuid, p_confirm_meaning text) OWNER TO "postgres";

-- Observed prosrc MD5 541ab691c7dc776410b8e746cf898319; production OID 39278.

CREATE OR REPLACE FUNCTION public.save_vocabulary_context_for(p_owner uuid, p_word jsonb, p_source jsonb, p_confirm_id uuid DEFAULT NULL::uuid, p_confirm_meaning text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v public.user_vocabulary%rowtype;
  who uuid := p_owner;
  created boolean := false;
  added integer;
  matches integer;
  word text := btrim(p_word->>'word_text');
  meaning text := btrim(p_word->>'meaning');
begin
  if who is null or (current_user <> 'service_role' and (who is distinct from auth.uid() or p_source->>'kind'='class')) then raise exception 'login_required' using errcode='42501'; end if;
  if word is null or length(word) not between 1 and 300 or meaning is null or length(meaning) not between 1 and 2000
    or p_word->>'language' is null or p_word->>'language' not in ('Japanese','Chinese','English','French','Korean')
    or (p_word->>'language'='Korean' and p_source->>'kind'<>'reading')
    or p_source->>'kind' is null or p_source->>'kind' not in ('textbook','reading','pdf','class')
    then raise exception 'invalid_context' using errcode='22023'; end if;

  if p_word->>'language'='Korean' then
    if (public.learning_language_capabilities()->'languages'->'Korean'->>'save')::boolean is distinct from true
      then raise exception 'korean_learning_not_ready' using errcode='55000'; end if;
    if p_word ?| array['interval','ease_factor','repetitions','next_review_at'] then
      if jsonb_typeof(p_word->'interval') is distinct from 'number'
        or jsonb_typeof(p_word->'ease_factor') is distinct from 'number'
        or jsonb_typeof(p_word->'repetitions') is distinct from 'number'
        or jsonb_typeof(p_word->'next_review_at') is distinct from 'string'
        then raise exception 'invalid_initial_schedule' using errcode='22023'; end if;
      if (p_word->>'interval')::numeric not between 0 and 36500
        or (p_word->>'ease_factor')::numeric not between 1 and 10
        or (p_word->>'repetitions')::numeric not between 0 and 100000
        or (p_word->>'repetitions')::numeric<>trunc((p_word->>'repetitions')::numeric)
        or not isfinite((p_word->>'next_review_at')::timestamptz)
        then raise exception 'invalid_initial_schedule' using errcode='22023'; end if;
    end if;
  end if;

  -- 예전 뷰어가 활용형(word_text=books, base_form=book)으로 저장한 카드도 재사용한다.
  -- 후보가 여러 개면 추측해서 새 카드를 만들거나 임의로 합치지 않는다.
  select * into v from public.user_vocabulary where user_id=who and word_text=word for update;
  if not found then
    select count(*) into matches from public.user_vocabulary where user_id=who and language=p_word->>'language' and base_form=word;
    if matches > 1 then raise exception 'vocabulary_ambiguous_match'; end if;
    if matches = 1 then
      select * into v from public.user_vocabulary where user_id=who and language=p_word->>'language' and base_form=word for update;
    end if;
  end if;
  if v.id is null then
    insert into public.user_vocabulary(user_id,word_text,base_form,meaning,furigana,pos,language,source_sentence,source_material_id,next_review_at)
    values(who,word,word,meaning,coalesce(p_word->>'furigana',''),coalesce(p_word->>'pos',''),p_word->>'language',p_source->>'quote',
      case when p_source->>'kind'='reading' then (p_source->>'materialId')::bigint end,now())
    on conflict(user_id,word_text) do nothing returning * into v;
    created := found;
    if created and p_word->>'language'='Korean' and p_word ? 'interval' then
      update public.user_vocabulary set interval=(p_word->>'interval')::real,
        ease_factor=(p_word->>'ease_factor')::real,repetitions=(p_word->>'repetitions')::integer,
        next_review_at=(p_word->>'next_review_at')::timestamptz where id=v.id and user_id=who returning * into v;
    end if;
  end if;
  if not created and v.id is null then
    select * into v from public.user_vocabulary where user_id=who and word_text=word for update;
    if not found then raise exception 'word_not_available'; end if;
  end if;
  if not created then
    if v.language is distinct from p_word->>'language' then raise exception 'vocabulary_language_conflict'; end if;
    if btrim(coalesce(v.meaning,'')) <> meaning and not (
      p_confirm_id is not null and v.id=p_confirm_id and v.meaning is not distinct from p_confirm_meaning
    ) then raise exception 'vocabulary_meaning_conflict' using detail=v.id::text; end if;
  end if;

  insert into public.vocabulary_contexts(user_id,vocabulary_id,kind,lang,chapter_slug,material_id,pdf_id,locator,quote,translation,source_key)
  values(who,v.id,p_source->>'kind',p_word->>'language',p_source->>'chapterSlug',
    (p_source->>'materialId')::bigint,(p_source->>'pdfId')::uuid,coalesce(p_source->'locator','{}'::jsonb),
    p_source->>'quote',coalesce(p_source->>'translation',''),
    md5((p_source - 'translation')::text))
  on conflict(user_id,vocabulary_id,source_key) do nothing;
  get diagnostics added = row_count;
  return jsonb_build_object('vocabularyId',v.id,'created',created,'contextAdded',added>0);
end $function$;

ALTER FUNCTION "public"."save_vocabulary_context_for"(p_owner uuid, p_word jsonb, p_source jsonb, p_confirm_id uuid, p_confirm_meaning text) OWNER TO "postgres";

-- Observed prosrc MD5 026a8d6e4463b0b202bf0a6acb3fa65a; production OID 39720.

CREATE OR REPLACE FUNCTION public.set_vocabulary_exclusion(p_language text, p_word text, p_vocabulary_id uuid, p_excluded boolean, p_exclusion_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE who uuid:=auth.uid(); v public.user_vocabulary%rowtype; e public.vocabulary_exclusions%rowtype;
 lang text:=p_language; word text:=normalize(btrim(p_word),NFC); matches integer;
BEGIN
 IF who IS NULL OR p_excluded IS NULL THEN RAISE EXCEPTION 'login_required' USING ERRCODE='42501'; END IF;
 IF p_language='Korean' AND (public.learning_language_capabilities()->'languages'->'Korean'->>'exclude')::boolean IS DISTINCT FROM true
  THEN RAISE EXCEPTION 'korean_learning_not_ready' USING ERRCODE='55000'; END IF;
 -- 같은 계정의 저장/제외는 행 잠금 전에 직렬화한다(새 단어 저장과 미저장 제외 경쟁 포함).
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(who::text,731));
 IF p_exclusion_id IS NOT NULL THEN
  IF p_excluded THEN RAISE EXCEPTION 'invalid_exclusion'; END IF;
  SELECT * INTO e FROM public.vocabulary_exclusions WHERE id=p_exclusion_id AND user_id=who;
  IF e.id IS NULL THEN RAISE EXCEPTION 'exclusion_not_available' USING ERRCODE='42501'; END IF;
  IF e.vocabulary_id IS NOT NULL THEN PERFORM 1 FROM public.user_vocabulary WHERE id=e.vocabulary_id AND user_id=who FOR UPDATE; END IF;
  DELETE FROM public.vocabulary_exclusions WHERE user_id=who AND (id=e.id OR
   (e.language IN ('Japanese','Chinese','English','French','Korean') AND language=e.language AND word_text=e.word_text));
  RETURN jsonb_build_object('excluded',false,'entry',to_jsonb(e));
 END IF;
 IF p_vocabulary_id IS NOT NULL THEN
  SELECT * INTO v FROM public.user_vocabulary WHERE id=p_vocabulary_id AND user_id=who FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'word_not_available' USING ERRCODE='42501'; END IF;
 ELSE
  IF lang IS NULL OR lang NOT IN ('Japanese','Chinese','English','French','Korean') OR word IS NULL OR length(word) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'invalid_word'; END IF;
  SELECT count(*) INTO matches FROM public.user_vocabulary WHERE user_id=who AND language=lang
   AND (normalize(btrim(word_text),NFC)=word OR normalize(btrim(base_form),NFC)=word);
  IF matches>1 THEN RAISE EXCEPTION 'vocabulary_ambiguous_match'; END IF;
  IF matches=1 THEN SELECT * INTO v FROM public.user_vocabulary WHERE user_id=who AND language=lang
   AND (normalize(btrim(word_text),NFC)=word OR normalize(btrim(base_form),NFC)=word) FOR UPDATE; END IF;
 END IF;
 IF v.id IS NOT NULL THEN
  lang:=coalesce(v.language,'Unknown'); word:=normalize(btrim(coalesce(nullif(v.base_form,''),v.word_text)),NFC);
  SELECT * INTO e FROM public.vocabulary_exclusions WHERE user_id=who AND vocabulary_id=v.id;
  IF e.id IS NULL THEN SELECT * INTO e FROM public.vocabulary_exclusions WHERE user_id=who AND language=lang AND word_text=word; END IF;
 ELSE SELECT * INTO e FROM public.vocabulary_exclusions WHERE user_id=who AND language=lang AND word_text=word; END IF;
 IF p_excluded THEN
  IF e.id IS NULL THEN
   IF v.id IS NULL THEN
    INSERT INTO public.vocabulary_exclusions(user_id,language,word_text) VALUES(who,lang,word)
     ON CONFLICT(user_id,language,word_text) WHERE vocabulary_id IS NULL DO UPDATE SET word_text=EXCLUDED.word_text RETURNING * INTO e;
   ELSE
    INSERT INTO public.vocabulary_exclusions(user_id,language,word_text,vocabulary_id) VALUES(who,lang,word,v.id)
     ON CONFLICT(user_id,vocabulary_id) DO UPDATE SET vocabulary_id=EXCLUDED.vocabulary_id RETURNING * INTO e;
   END IF;
  ELSIF v.id IS NOT NULL AND e.vocabulary_id IS NULL THEN
   UPDATE public.vocabulary_exclusions SET vocabulary_id=v.id WHERE id=e.id RETURNING * INTO e;
  END IF;
 ELSE
  IF e.id IS NULL THEN
   SELECT * INTO e FROM public.vocabulary_exclusions WHERE user_id=who AND language=lang AND word_text=word;
  END IF;
  IF e.id IS NOT NULL THEN DELETE FROM public.vocabulary_exclusions WHERE user_id=who AND (id=e.id OR
   (e.language IN ('Japanese','Chinese','English','French','Korean') AND language=e.language AND word_text=e.word_text));
  ELSE e.id:=gen_random_uuid();e.language:=lang;e.word_text:=word;e.vocabulary_id:=v.id; END IF;
 END IF;
 RETURN jsonb_build_object('excluded',p_excluded,'entry',to_jsonb(e));
END $function$;

ALTER FUNCTION "public"."set_vocabulary_exclusion"(p_language text, p_word text, p_vocabulary_id uuid, p_excluded boolean, p_exclusion_id uuid) OWNER TO "postgres";

-- Observed prosrc MD5 fce35cab736c4986913d0e07043d67ce; production OID 39739.

CREATE OR REPLACE FUNCTION public.sync_known_word_review_exclusion()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE who uuid; code text; original text; lang text; key text; affected text[];
BEGIN
 IF TG_OP='INSERT' THEN who:=NEW.user_id;code:=NEW.lang;original:=NEW.word_text;
 ELSE who:=OLD.user_id;code:=OLD.lang;original:=OLD.word_text; END IF;
 lang:=CASE code WHEN 'ja' THEN 'Japanese' WHEN 'zh' THEN 'Chinese' WHEN 'en' THEN 'English' WHEN 'fr' THEN 'French' WHEN 'ko' THEN 'Korean' END;
 IF lang IS NULL THEN RETURN NULL; END IF;
 IF TG_OP='INSERT' THEN
  FOR key IN
   SELECT normalize(btrim(original),NFC)
   UNION SELECT normalize(btrim(coalesce(nullif(v.base_form,''),v.word_text)),NFC)
    FROM public.user_vocabulary v WHERE v.user_id=who AND v.language=lang
    AND (normalize(btrim(v.word_text),NFC)=normalize(btrim(original),NFC)
     OR normalize(btrim(v.base_form),NFC)=normalize(btrim(original),NFC))
  LOOP
   IF length(key) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION 'invalid_known_word'; END IF;
   INSERT INTO public.vocabulary_exclusions(user_id,language,word_text,known_word_keys)
    VALUES(who,lang,key,ARRAY[original])
    ON CONFLICT(user_id,language,word_text) WHERE vocabulary_id IS NULL
    DO UPDATE SET known_word_keys=ARRAY(SELECT DISTINCT unnest(public.vocabulary_exclusions.known_word_keys||EXCLUDED.known_word_keys));
  END LOOP;
 ELSE
  SELECT array_agg(word_text) INTO affected FROM public.vocabulary_exclusions
   WHERE user_id=who AND language=lang AND original=ANY(known_word_keys);
  UPDATE public.vocabulary_exclusions SET known_word_keys=array_remove(known_word_keys,original)
   WHERE user_id=who AND language=lang AND original=ANY(known_word_keys);
  -- 해제는 새 평가가 아니다. 같은 키의 과거 '제외'도 해제하되 다른 known 표시는 보존한다.
  DELETE FROM public.vocabulary_exclusions e WHERE e.user_id=who AND e.language=lang AND e.word_text=ANY(affected)
   AND NOT EXISTS(SELECT 1 FROM public.vocabulary_exclusions other WHERE other.user_id=who AND other.language=lang
    AND other.word_text=e.word_text AND cardinality(other.known_word_keys)>0);
 END IF;
 RETURN NULL;
END $function$;

ALTER FUNCTION "public"."sync_known_word_review_exclusion"() OWNER TO "postgres";

-- Observed prosrc MD5 8f484084d6216ba1bd6c1a1b0185d447; production OID 39730.

CREATE OR REPLACE FUNCTION public.sync_vocabulary_exclusion_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
 UPDATE public.vocabulary_exclusions SET language=coalesce(NEW.language,'Unknown'),
  word_text=normalize(btrim(coalesce(nullif(NEW.base_form,''),NEW.word_text)),NFC) WHERE vocabulary_id=NEW.id AND user_id=NEW.user_id;
 RETURN NEW;
END $function$;

ALTER FUNCTION "public"."sync_vocabulary_exclusion_identity"() OWNER TO "postgres";

-- Observed prosrc MD5 355e54295750c732c20657f29e43a33a; production OID 26881.

CREATE OR REPLACE FUNCTION public.update_streak(uid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE settings fsrs_private.activity_settings%rowtype; effective timestamptz; prior fsrs_private.activity_receipts%rowtype; day_value date;
BEGIN
 -- Inspect identity metadata before evaluating the existing identity helper.
 PERFORM fsrs_private.require_admission_integrity();
 IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM uid THEN RAISE EXCEPTION 'activity_actor_mismatch' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,731));
 SELECT * INTO settings FROM fsrs_private.activity_settings FOR SHARE;
 IF NOT settings.enabled THEN RAISE EXCEPTION 'activity_disabled' USING ERRCODE='55000'; END IF;
 IF settings.profile_contract_hash IS DISTINCT FROM fsrs_private.activity_profile_hash() THEN RAISE EXCEPTION 'activity_catalog_drift' USING ERRCODE='55000'; END IF;
 -- The predecessor uses current_date, which is the UTC transaction date.
 -- Using the transaction's real start timestamp preserves that boundary even
 -- if a long transaction crosses midnight. FSRS grades keep reveal timestamps.
 effective:=transaction_timestamp();
 IF effective<settings.starts_at THEN PERFORM fsrs_private.legacy_activity_before_epoch(uid); RETURN; END IF;
 day_value:=(effective AT TIME ZONE 'UTC')::date;
 SELECT * INTO prior FROM fsrs_private.activity_receipts WHERE actor_id=uid AND kind='legacy' AND receipt_id=day_value::text;
 -- The generic legacy API has no command ID. Its receipt identity is actor/day;
 -- repeat calls preserve the original actual server timestamp.
 IF prior.actor_id IS NOT NULL THEN effective:=prior.effective_at; END IF;
 PERFORM fsrs_private.append_activity(uid,'legacy',day_value::text,NULL,effective);
END $function$;

ALTER FUNCTION "public"."update_streak"(uid uuid) OWNER TO "postgres";

-- Observed prosrc MD5 043b13610570a95efa49975299a123b2; production OID 38777.

CREATE OR REPLACE FUNCTION public.validate_source_passage()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  c jsonb := NEW.processed_json->'metadata'->'composer';
  s jsonb := c->'passage';
  parent public.reading_materials%ROWTYPE;
  d jsonb;
  body text;
BEGIN
  IF s IS NULL THEN RETURN NEW; END IF;
  IF NEW.visibility IS DISTINCT FROM 'private' OR NEW.owner_id IS DISTINCT FROM auth.uid()
    OR c->>'role' IS DISTINCT FROM 'study' OR c->>'version' IS DISTINCT FROM '1'
    OR COALESCE(c->>'parentId','') !~ '^[1-9][0-9]{0,18}$'
    OR jsonb_typeof(s) IS DISTINCT FROM 'object'
    OR s->>'version' IS DISTINCT FROM '1' OR COALESCE(s->>'kind','') NOT IN ('body','pdf','epub')
    OR s->>'textVersion' IS DISTINCT FROM (CASE s->>'kind' WHEN 'body' THEN 'plain-v1' WHEN 'pdf' THEN 'pdf-layer-v1' WHEN 'epub' THEN 'epub-text-v1' END)
    OR COALESCE(char_length(NEW.raw_text),0) NOT BETWEEN 1 AND 1500 OR btrim(NEW.raw_text) = ''
    OR COALESCE(NEW.processed_json->'metadata'->>'language','') NOT IN ('Japanese','Chinese','English','French')
    OR COALESCE(char_length(s->'quote'->>'exact'),0) > 4000
    OR char_length(s::text) > 24000
  THEN RAISE EXCEPTION 'PASSAGE_INVALID' USING ERRCODE='23514'; END IF;
  SELECT * INTO parent FROM public.reading_materials
    WHERE id=(c->>'parentId')::bigint AND owner_id=auth.uid() AND visibility='private' FOR SHARE;
  IF NOT FOUND OR parent.processed_json->'metadata'->'composer'->>'version' IS DISTINCT FROM '1'
    OR parent.processed_json->'metadata'->'composer'->>'role' = 'study'
  THEN RAISE EXCEPTION 'PASSAGE_ACCESS' USING ERRCODE='42501'; END IF;
  d := COALESCE(parent.document_json, jsonb_build_object('revision',NULL,'body',parent.raw_text,
    'assets',parent.processed_json->'metadata'->'composer'->'assets'));
  IF s->>'kind'='body' THEN
    IF d->>'revision' IS DISTINCT FROM s->>'revision' THEN
      RAISE EXCEPTION 'PASSAGE_SOURCE_CHANGED' USING ERRCODE='40001';
    END IF;
    body := d->>'body';
  ELSE
    IF COALESCE(s->>'assetHash','') !~ '^[a-f0-9]{64}$' OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(d->'assets','[]') || COALESCE(d->'retainedAssets','[]')) a
      WHERE a->>'hash'=s->>'assetHash' AND a->>'kind'=s->>'kind'
    ) THEN RAISE EXCEPTION 'PASSAGE_SOURCE_CHANGED' USING ERRCODE='40001'; END IF;
    IF s->>'kind'='pdf' AND (COALESCE(s->>'page','') !~ '^[1-9][0-9]{0,5}$')
      OR s->>'kind'='epub' AND (COALESCE(s->>'chapter','') !~ '^[1-9][0-9]{0,5}$'
        OR COALESCE(s->>'spineIndex','') !~ '^[0-9]{1,6}$'
        OR COALESCE(char_length(s->>'spinePath'),0) NOT BETWEEN 1 AND 1000)
    THEN RAISE EXCEPTION 'PASSAGE_INVALID' USING ERRCODE='23514'; END IF;
  END IF;
  IF s->>'manual' IS DISTINCT FROM 'true' THEN
    IF COALESCE(s->'quote'->>'start','') !~ '^[0-9]{1,9}$'
      OR COALESCE(s->'quote'->>'end','') !~ '^[0-9]{1,9}$'
      OR COALESCE(char_length(s->'quote'->>'exact'),0) < 1
      OR (s->'quote'->>'end')::int-(s->'quote'->>'start')::int <> char_length(s->'quote'->>'exact')
      OR COALESCE(char_length(s->'quote'->>'prefix'),0)>40 OR COALESCE(char_length(s->'quote'->>'suffix'),0)>40
    THEN RAISE EXCEPTION 'PASSAGE_INVALID' USING ERRCODE='23514'; END IF;
    IF s->>'kind'='body' AND substring(body FROM (s->'quote'->>'start')::int+1 FOR char_length(s->'quote'->>'exact'))
      IS DISTINCT FROM s->'quote'->>'exact'
    THEN RAISE EXCEPTION 'PASSAGE_SOURCE_CHANGED' USING ERRCODE='40001'; END IF;
  END IF;
  RETURN NEW;
END;
$function$;

ALTER FUNCTION "public"."validate_source_passage"() OWNER TO "postgres";

-- Observed prosrc MD5 d9fa14687aa0b2afac161f4c6814781d; production OID 38822.

CREATE OR REPLACE FUNCTION public.viewer_replace_analysis(p_id bigint, p_expected_raw text, p_expected_json jsonb, p_raw text, p_json jsonb, p_attempt uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE r public.reading_materials%rowtype;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.reading_materials
    WHERE id=p_id AND owner_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '자료가 없거나 수정 권한이 없습니다.' USING ERRCODE='42501'; END IF;
  -- 응답 유실 뒤 동일 요청 재확인은 성공으로 돌려주고 두 번 쓰지 않는다.
  IF r.processed_json->'metadata'->>'viewerRevision'=p_attempt::text
    AND r.raw_text IS NOT DISTINCT FROM p_raw AND r.processed_json IS NOT DISTINCT FROM p_json THEN
    RETURN jsonb_build_object('material',to_jsonb(r));
  END IF;
  IF r.raw_text IS DISTINCT FROM p_expected_raw OR r.processed_json IS DISTINCT FROM p_expected_json THEN
    RAISE EXCEPTION '다른 창에서 자료가 바뀌었어요. 다시 열어 확인해 주세요.' USING ERRCODE='40001';
  END IF;
  IF p_attempt IS NULL OR p_raw IS NULL OR length(btrim(p_raw))=0
    OR jsonb_typeof(p_json->'sequence') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_json->'dictionary') IS DISTINCT FROM 'object'
    OR p_json->'metadata'->>'viewerRevision' IS DISTINCT FROM p_attempt::text THEN
    RAISE EXCEPTION '분석 결과를 확인하지 못했어요.' USING ERRCODE='22023';
  END IF;
  -- 현재 소스 구간 임대 중에는 기존 분석 경로를 침범하지 않는다.
  IF r.processed_json->'metadata'->'passageRun' IS NOT NULL
    AND (r.processed_json->'metadata'->'passageRun'->>'until')::timestamptz > clock_timestamp() THEN
    RAISE EXCEPTION '다른 분석이 진행 중입니다.' USING ERRCODE='40001';
  END IF;
  UPDATE public.reading_materials SET raw_text=p_raw, processed_json=p_json
    WHERE id=p_id AND owner_id=auth.uid() RETURNING * INTO r;
  RETURN jsonb_build_object('material',to_jsonb(r));
END;
$function$;

ALTER FUNCTION "public"."viewer_replace_analysis"(p_id bigint, p_expected_raw text, p_expected_json jsonb, p_raw text, p_json jsonb, p_attempt uuid) OWNER TO "postgres";

-- Observed prosrc MD5 ace9c01a5df4556170e29f291bf0ed51; production OID 38823.

CREATE OR REPLACE FUNCTION public.viewer_undo_vocabulary_save(p_id uuid, p_expected jsonb, p_context_ids uuid[])
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v public.user_vocabulary%rowtype; current_ids uuid[]; expected_ids uuid[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE='42501'; END IF;
  SELECT * INTO v FROM public.user_vocabulary WHERE id=p_id AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF to_jsonb(v) IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION '이후 학습이나 수정이 있어 저장을 취소하지 않았어요.' USING ERRCODE='40001';
  END IF;
  SELECT coalesce(array_agg(id ORDER BY id),'{}'::uuid[]) INTO current_ids
    FROM public.vocabulary_contexts WHERE vocabulary_id=p_id;
  SELECT coalesce(array_agg(id ORDER BY id),'{}'::uuid[]) INTO expected_ids FROM unnest(p_context_ids) id;
  IF current_ids IS DISTINCT FROM expected_ids THEN
    RAISE EXCEPTION '다른 문맥이 추가되어 저장을 취소하지 않았어요.' USING ERRCODE='40001';
  END IF;
  DELETE FROM public.user_vocabulary WHERE id=p_id AND user_id=auth.uid();
  RETURN FOUND;
END;
$function$;

ALTER FUNCTION "public"."viewer_undo_vocabulary_save"(p_id uuid, p_expected jsonb, p_context_ids uuid[]) OWNER TO "postgres";

ALTER TABLE "fsrs_private"."activity_baselines" ADD CONSTRAINT "activity_baselines_baseline_check" CHECK ((jsonb_typeof(baseline) = 'object'::text));

ALTER TABLE "fsrs_private"."activity_baselines" ADD CONSTRAINT "activity_baselines_pkey" PRIMARY KEY (actor_id);

ALTER TABLE "fsrs_private"."activity_baselines" ADD CONSTRAINT "activity_baselines_projected_check" CHECK ((jsonb_typeof(projected) = 'object'::text));

ALTER TABLE "fsrs_private"."activity_receipts" ADD CONSTRAINT "activity_receipts_check" CHECK ((((kind = 'fsrs'::text) AND (card_id IS NOT NULL)) OR ((kind = 'legacy'::text) AND (card_id IS NULL))));

ALTER TABLE "fsrs_private"."activity_receipts" ADD CONSTRAINT "activity_receipts_effective_at_check" CHECK (isfinite(effective_at));

ALTER TABLE "fsrs_private"."activity_receipts" ADD CONSTRAINT "activity_receipts_kind_check" CHECK ((kind = ANY (ARRAY['fsrs'::text, 'legacy'::text])));

ALTER TABLE "fsrs_private"."activity_receipts" ADD CONSTRAINT "activity_receipts_pkey" PRIMARY KEY (actor_id, kind, receipt_id);

ALTER TABLE "fsrs_private"."activity_receipts" ADD CONSTRAINT "activity_receipts_policy_version_check" CHECK ((policy_version = 'streak-freeze-earn-v1'::text));

ALTER TABLE "fsrs_private"."activity_settings" ADD CONSTRAINT "activity_settings_check" CHECK (((NOT enabled) OR ((starts_at IS NOT NULL) AND (profile_contract_hash IS NOT NULL))));

ALTER TABLE "fsrs_private"."activity_settings" ADD CONSTRAINT "activity_settings_pkey" PRIMARY KEY (singleton);

ALTER TABLE "fsrs_private"."activity_settings" ADD CONSTRAINT "activity_settings_policy_version_check" CHECK ((policy_version = 'streak-freeze-earn-v1'::text));

ALTER TABLE "fsrs_private"."activity_settings" ADD CONSTRAINT "activity_settings_singleton_check" CHECK (singleton);

ALTER TABLE "fsrs_private"."admission_config_receipts" ADD CONSTRAINT "admission_config_receipts_pkey" PRIMARY KEY (user_id, operation_id);

ALTER TABLE "fsrs_private"."admission_permits" ADD CONSTRAINT "admission_permits_pkey" PRIMARY KEY (transaction_id);

ALTER TABLE "fsrs_private"."admission_policies" ADD CONSTRAINT "admission_policies_daily_new_limit_check" CHECK ((daily_new_limit = ANY (ARRAY[0, 5, 10, 15, 20, 30, 40])));

ALTER TABLE "fsrs_private"."admission_policies" ADD CONSTRAINT "admission_policies_pkey" PRIMARY KEY (user_id);

ALTER TABLE "fsrs_private"."admission_policies" ADD CONSTRAINT "admission_policies_revision_check" CHECK (((revision >= 0) AND (revision < '9007199254740991'::bigint)));

ALTER TABLE "fsrs_private"."admission_requests" ADD CONSTRAINT "admission_requests_pkey" PRIMARY KEY (user_id, operation_id);

ALTER TABLE "fsrs_private"."admission_settings" ADD CONSTRAINT "admission_settings_check" CHECK (((NOT enabled) OR (starts_at IS NOT NULL)));

ALTER TABLE "fsrs_private"."admission_settings" ADD CONSTRAINT "admission_settings_pkey" PRIMARY KEY (singleton);

ALTER TABLE "fsrs_private"."admission_settings" ADD CONSTRAINT "admission_settings_singleton_check" CHECK (singleton);

ALTER TABLE "fsrs_private"."event_permits" ADD CONSTRAINT "event_permits_pkey" PRIMARY KEY (transaction_id);

ALTER TABLE "fsrs_private"."legacy_admissions" ADD CONSTRAINT "legacy_admissions_pkey" PRIMARY KEY (user_id, card_id);

ALTER TABLE "fsrs_private"."manual_save_settings" ADD CONSTRAINT "manual_save_settings_pkey" PRIMARY KEY (singleton);

ALTER TABLE "fsrs_private"."manual_save_settings" ADD CONSTRAINT "manual_save_settings_singleton_check" CHECK (singleton);

ALTER TABLE "fsrs_private"."settings" ADD CONSTRAINT "settings_check" CHECK (((NOT enabled) OR ((activated_at IS NOT NULL) AND (contract_hash IS NOT NULL))));

ALTER TABLE "fsrs_private"."settings" ADD CONSTRAINT "settings_daily_new_limit_check" CHECK ((daily_new_limit = ANY (ARRAY[0, 5, 10, 15, 20, 30, 40])));

ALTER TABLE "fsrs_private"."settings" ADD CONSTRAINT "settings_pkey" PRIMARY KEY (singleton);

ALTER TABLE "fsrs_private"."settings" ADD CONSTRAINT "settings_singleton_check" CHECK (singleton);

ALTER TABLE "public"."fsrs_cards" ADD CONSTRAINT "fsrs_cards_card_check" CHECK (fsrs_private.valid_card(card));

ALTER TABLE "public"."fsrs_cards" ADD CONSTRAINT "fsrs_cards_pkey" PRIMARY KEY (card_id);

ALTER TABLE "public"."fsrs_cards" ADD CONSTRAINT "fsrs_cards_user_id_card_id_key" UNIQUE (user_id, card_id);

ALTER TABLE "public"."fsrs_manual_save_receipts" ADD CONSTRAINT "fsrs_manual_save_receipts_operation_id_check" CHECK ((operation_id ~ '^[A-Za-z0-9_.:-]{1,200}$'::text));

ALTER TABLE "public"."fsrs_manual_save_receipts" ADD CONSTRAINT "fsrs_manual_save_receipts_pkey" PRIMARY KEY (user_id, operation_id);

ALTER TABLE "public"."fsrs_manual_save_receipts" ADD CONSTRAINT "fsrs_manual_save_receipts_request_check" CHECK ((jsonb_typeof(request) = 'object'::text));

ALTER TABLE "public"."fsrs_manual_save_receipts" ADD CONSTRAINT "fsrs_manual_save_receipts_user_id_requested_card_id_key" UNIQUE (user_id, requested_card_id);

ALTER TABLE "public"."fsrs_new_receipts" ADD CONSTRAINT "fsrs_new_receipts_pkey" PRIMARY KEY (card_id);

ALTER TABLE "public"."fsrs_operations" ADD CONSTRAINT "fsrs_operations_id_check" CHECK (((length(id) >= 1) AND (length(id) <= 200)));

ALTER TABLE "public"."fsrs_operations" ADD CONSTRAINT "fsrs_operations_kind_check" CHECK ((kind = ANY (ARRAY['enroll'::text, 'question'::text, 'reveal'::text, 'abandon'::text, 'grade'::text, 'undo'::text])));

ALTER TABLE "public"."fsrs_operations" ADD CONSTRAINT "fsrs_operations_operation_check" CHECK ((jsonb_typeof(operation) = 'object'::text));

ALTER TABLE "public"."fsrs_operations" ADD CONSTRAINT "fsrs_operations_pkey" PRIMARY KEY (user_id, id);

ALTER TABLE "public"."fsrs_operations" ADD CONSTRAINT "fsrs_operations_result_check" CHECK ((jsonb_typeof(result) = 'object'::text));

ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_role_check" CHECK ((role = ANY (ARRAY['student'::text, 'host'::text, 'admin'::text])));

ALTER TABLE "public"."reading_materials" ADD CONSTRAINT "composer_material_is_private" CHECK ((((((processed_json -> 'metadata'::text) -> 'composer'::text) ->> 'version'::text) IS DISTINCT FROM '1'::text) OR ((NOT (visibility IS DISTINCT FROM 'private'::text)) AND (owner_id IS NOT NULL) AND (COALESCE(((processed_json -> 'metadata'::text) ->> 'importAttempt'::text), ''::text) <> ''::text))));

ALTER TABLE "public"."reading_materials" ADD CONSTRAINT "reading_materials_direction_check" CHECK ((direction = ANY (ARRAY['read'::text, 'write'::text])));

ALTER TABLE "public"."reading_materials" ADD CONSTRAINT "reading_materials_document_private_v1" CHECK (((document_json IS NULL) OR (COALESCE((visibility = 'private'::text), false) AND (owner_id IS NOT NULL) AND COALESCE(((((processed_json -> 'metadata'::text) -> 'composer'::text) ->> 'version'::text) = '1'::text), false) AND COALESCE(((document_json ->> 'version'::text) = '1'::text), false) AND COALESCE((jsonb_typeof((document_json -> 'body'::text)) = 'string'::text), false) AND COALESCE(((document_json ->> 'revision'::text) ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'::text), false))));

ALTER TABLE "public"."reading_materials" ADD CONSTRAINT "reading_materials_pdf_source_private" CHECK (((source_pdf_id IS NULL) OR (visibility = 'private'::text)));

ALTER TABLE "public"."reading_materials" ADD CONSTRAINT "reading_materials_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."reading_materials" ADD CONSTRAINT "reading_materials_visibility_check" CHECK ((visibility = ANY (ARRAY['public'::text, 'private'::text])));

ALTER TABLE "public"."reading_materials" ADD CONSTRAINT "source_passage_stays_private" CHECK ((((((processed_json -> 'metadata'::text) -> 'composer'::text) -> 'passage'::text) IS NULL) OR ((NOT (visibility IS DISTINCT FROM 'private'::text)) AND (owner_id IS NOT NULL))));

ALTER TABLE "public"."review_events" ADD CONSTRAINT "review_events_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."uploaded_pdfs" ADD CONSTRAINT "uploaded_pdfs_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."user_known_words" ADD CONSTRAINT "user_known_words_lang_check" CHECK ((lang ~ '^[a-z]{2}$'::text));

ALTER TABLE "public"."user_known_words" ADD CONSTRAINT "user_known_words_pkey" PRIMARY KEY (user_id, lang, word_text);

ALTER TABLE "public"."user_known_words" ADD CONSTRAINT "user_known_words_word_text_check" CHECK (((char_length(word_text) >= 1) AND (char_length(word_text) <= 100)));

ALTER TABLE "public"."user_vocabulary" ADD CONSTRAINT "my_vocabulary_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."user_vocabulary" ADD CONSTRAINT "user_vocabulary_user_word_unique" UNIQUE (user_id, word_text);

ALTER TABLE "public"."vocabulary_contexts" ADD CONSTRAINT "vocabulary_contexts_check" CHECK ((((kind = 'textbook'::text) AND (chapter_slug IS NOT NULL) AND (material_id IS NULL) AND (pdf_id IS NULL)) OR ((kind = 'reading'::text) AND (material_id IS NOT NULL) AND (chapter_slug IS NULL) AND (pdf_id IS NULL)) OR ((kind = 'pdf'::text) AND (pdf_id IS NOT NULL) AND (chapter_slug IS NULL) AND (material_id IS NULL)) OR ((kind = 'class'::text) AND (num_nonnulls(chapter_slug, material_id, pdf_id) = 0) AND (COALESCE((locator ->> 'team'::text), ''::text) ~ '^[a-z0-9][a-z0-9-]{0,15}$'::text) AND (COALESCE((locator ->> 'materialId'::text), ''::text) ~ '^[1-9][0-9]{0,15}$'::text))));

ALTER TABLE "public"."vocabulary_contexts" ADD CONSTRAINT "vocabulary_contexts_kind_check" CHECK ((kind = ANY (ARRAY['textbook'::text, 'reading'::text, 'pdf'::text, 'class'::text])));

ALTER TABLE "public"."vocabulary_contexts" ADD CONSTRAINT "vocabulary_contexts_lang_check" CHECK ((lang = ANY (ARRAY['Japanese'::text, 'Chinese'::text, 'English'::text, 'French'::text, 'Korean'::text])));

ALTER TABLE "public"."vocabulary_contexts" ADD CONSTRAINT "vocabulary_contexts_locator_check" CHECK ((jsonb_typeof(locator) = 'object'::text));

ALTER TABLE "public"."vocabulary_contexts" ADD CONSTRAINT "vocabulary_contexts_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."vocabulary_contexts" ADD CONSTRAINT "vocabulary_contexts_quote_check" CHECK (((length(quote) >= 1) AND (length(quote) <= 4000)));

ALTER TABLE "public"."vocabulary_contexts" ADD CONSTRAINT "vocabulary_contexts_translation_check" CHECK ((length(translation) <= 2000));

ALTER TABLE "public"."vocabulary_contexts" ADD CONSTRAINT "vocabulary_contexts_user_id_vocabulary_id_source_key_key" UNIQUE (user_id, vocabulary_id, source_key);

ALTER TABLE "public"."vocabulary_exclusions" ADD CONSTRAINT "vocabulary_exclusions_language_check" CHECK ((language = ANY (ARRAY['Japanese'::text, 'Chinese'::text, 'English'::text, 'French'::text, 'Korean'::text, 'Unknown'::text])));

ALTER TABLE "public"."vocabulary_exclusions" ADD CONSTRAINT "vocabulary_exclusions_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."vocabulary_exclusions" ADD CONSTRAINT "vocabulary_exclusions_user_id_vocabulary_id_key" UNIQUE (user_id, vocabulary_id);

ALTER TABLE "public"."vocabulary_exclusions" ADD CONSTRAINT "vocabulary_exclusions_word_text_check" CHECK (((length(word_text) >= 1) AND (length(word_text) <= 300)));

ALTER TABLE "fsrs_private"."activity_baselines" ADD CONSTRAINT "activity_baselines_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "fsrs_private"."activity_receipts" ADD CONSTRAINT "activity_receipts_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "fsrs_private"."admission_config_receipts" ADD CONSTRAINT "admission_config_receipts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "fsrs_private"."admission_policies" ADD CONSTRAINT "admission_policies_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "fsrs_private"."admission_requests" ADD CONSTRAINT "admission_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "fsrs_private"."legacy_admissions" ADD CONSTRAINT "legacy_admissions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."fsrs_cards" ADD CONSTRAINT "fsrs_cards_card_id_fkey" FOREIGN KEY (card_id) REFERENCES public.user_vocabulary(id) ON DELETE RESTRICT;

ALTER TABLE "public"."fsrs_cards" ADD CONSTRAINT "fsrs_cards_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE "public"."fsrs_manual_save_receipts" ADD CONSTRAINT "fsrs_manual_save_receipts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."fsrs_new_receipts" ADD CONSTRAINT "fsrs_new_receipts_card_id_fkey" FOREIGN KEY (card_id) REFERENCES public.fsrs_cards(card_id) ON DELETE RESTRICT;

ALTER TABLE "public"."fsrs_new_receipts" ADD CONSTRAINT "fsrs_new_receipts_user_id_card_id_fkey" FOREIGN KEY (user_id, card_id) REFERENCES public.fsrs_cards(user_id, card_id);

ALTER TABLE "public"."fsrs_new_receipts" ADD CONSTRAINT "fsrs_new_receipts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE "public"."fsrs_operations" ADD CONSTRAINT "fsrs_operations_card_id_fkey" FOREIGN KEY (card_id) REFERENCES public.fsrs_cards(card_id) ON DELETE RESTRICT;

ALTER TABLE "public"."fsrs_operations" ADD CONSTRAINT "fsrs_operations_user_id_card_id_fkey" FOREIGN KEY (user_id, card_id) REFERENCES public.fsrs_cards(user_id, card_id);

ALTER TABLE "public"."fsrs_operations" ADD CONSTRAINT "fsrs_operations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."reading_materials" ADD CONSTRAINT "reading_materials_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."reading_materials" ADD CONSTRAINT "reading_materials_source_pdf_id_fkey" FOREIGN KEY (source_pdf_id) REFERENCES public.uploaded_pdfs(id) ON DELETE CASCADE;

ALTER TABLE "public"."review_events" ADD CONSTRAINT "review_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."uploaded_pdfs" ADD CONSTRAINT "uploaded_pdfs_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE "public"."user_known_words" ADD CONSTRAINT "user_known_words_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."user_vocabulary" ADD CONSTRAINT "my_vocabulary_material_id_fkey" FOREIGN KEY (material_id) REFERENCES public.reading_materials(id) ON DELETE CASCADE;

ALTER TABLE "public"."user_vocabulary" ADD CONSTRAINT "user_vocabulary_source_material_id_fkey" FOREIGN KEY (source_material_id) REFERENCES public.reading_materials(id) ON DELETE SET NULL;

ALTER TABLE "public"."user_vocabulary" ADD CONSTRAINT "user_vocabulary_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."vocabulary_contexts" ADD CONSTRAINT "vocabulary_contexts_material_id_fkey" FOREIGN KEY (material_id) REFERENCES public.reading_materials(id) ON DELETE CASCADE;

ALTER TABLE "public"."vocabulary_contexts" ADD CONSTRAINT "vocabulary_contexts_pdf_id_fkey" FOREIGN KEY (pdf_id) REFERENCES public.uploaded_pdfs(id) ON DELETE CASCADE;

ALTER TABLE "public"."vocabulary_contexts" ADD CONSTRAINT "vocabulary_contexts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."vocabulary_contexts" ADD CONSTRAINT "vocabulary_contexts_vocabulary_id_fkey" FOREIGN KEY (vocabulary_id) REFERENCES public.user_vocabulary(id) ON DELETE CASCADE;

ALTER TABLE "public"."vocabulary_exclusions" ADD CONSTRAINT "vocabulary_exclusions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."vocabulary_exclusions" ADD CONSTRAINT "vocabulary_exclusions_vocabulary_id_fkey" FOREIGN KEY (vocabulary_id) REFERENCES public.user_vocabulary(id) ON DELETE SET NULL;

CREATE INDEX activity_receipts_actor_day ON fsrs_private.activity_receipts USING btree (actor_id, activity_day);

CREATE INDEX fsrs_daily_new_count ON public.fsrs_new_receipts USING btree (user_id, learning_day);

CREATE UNIQUE INDEX fsrs_one_undo ON public.fsrs_operations USING btree (user_id, ((operation ->> 'undoneOperationId'::text))) WHERE (kind = 'undo'::text);

CREATE INDEX fsrs_card_operations ON public.fsrs_operations USING btree (user_id, card_id, received_at);

CREATE UNIQUE INDEX reading_materials_composer_attempt_unique ON public.reading_materials USING btree (owner_id, (((processed_json -> 'metadata'::text) ->> 'importAttempt'::text))) WHERE ((((processed_json -> 'metadata'::text) -> 'composer'::text) ->> 'version'::text) = '1'::text);

CREATE INDEX reading_materials_owner_direction_idx ON public.reading_materials USING btree (owner_id, direction);

CREATE INDEX library_material_book_idx ON public.reading_materials USING btree (owner_id, ((processed_json #>> '{metadata,book,key}'::text[]))) WHERE ((processed_json #>> '{metadata,book,key}'::text[]) IS NOT NULL);

CREATE INDEX materials_source_pdf_idx ON public.reading_materials USING btree (source_pdf_id, page_start) WHERE (source_pdf_id IS NOT NULL);

CREATE UNIQUE INDEX reading_materials_class_key_unique ON public.reading_materials USING btree (((processed_json #>> '{metadata,team,key}'::text[]))) WHERE ((processed_json #>> '{metadata,team,root}'::text[]) = 'true'::text);

CREATE INDEX review_events_user_time_idx ON public.review_events USING btree (user_id, created_at DESC);

CREATE INDEX uploaded_pdfs_owner_idx ON public.uploaded_pdfs USING btree (owner_id, created_at DESC);

CREATE INDEX user_vocab_base_form_idx ON public.user_vocabulary USING btree (user_id, base_form) WHERE (base_form IS NOT NULL);

CREATE INDEX vocabulary_contexts_vocab ON public.vocabulary_contexts USING btree (vocabulary_id, user_id, created_at);

CREATE INDEX vocabulary_contexts_material ON public.vocabulary_contexts USING btree (material_id);

CREATE INDEX vocabulary_contexts_pdf ON public.vocabulary_contexts USING btree (pdf_id);

CREATE UNIQUE INDEX vocabulary_exclusion_unsaved_key ON public.vocabulary_exclusions USING btree (user_id, language, word_text) WHERE (vocabulary_id IS NULL);

CREATE INDEX vocabulary_exclusion_word_key ON public.vocabulary_exclusions USING btree (user_id, language, word_text);

CREATE VIEW "public"."fsrs_effective_reviews" WITH (security_invoker=true) AS
 SELECT user_id,
    card_id,
    id,
    operation,
    received_at
   FROM public.fsrs_operations o
  WHERE kind = 'grade'::text AND NOT (EXISTS ( SELECT 1
           FROM public.fsrs_operations u
          WHERE u.user_id = o.user_id AND u.kind = 'undo'::text AND (u.operation ->> 'undoneOperationId'::text) = o.id));

ALTER VIEW "public"."fsrs_effective_reviews" OWNER TO "postgres";

CREATE VIEW "public"."vocabulary_with_exclusions" WITH (security_invoker=true) AS
 SELECT id,
    word_text,
    furigana,
    meaning,
    pos,
    status,
    repetitions,
    next_review_at,
    last_review,
    material_id,
    created_at,
    source_sentence,
    source_material_id,
    last_reviewed_at,
    user_id,
    ease_factor,
    "interval",
    language,
    base_form,
    source_ref,
    etym,
    hanja,
    (EXISTS ( SELECT 1
           FROM public.vocabulary_exclusions e
          WHERE e.user_id = v.user_id AND (e.vocabulary_id = v.id OR e.language = v.language AND e.word_text = NORMALIZE(btrim(COALESCE(NULLIF(v.base_form, ''::text), v.word_text)), NFC)))) AS is_excluded
   FROM public.user_vocabulary v;

ALTER VIEW "public"."vocabulary_with_exclusions" OWNER TO "postgres";

CREATE VIEW "public"."active_vocabulary" WITH (security_invoker=true) AS
 SELECT id,
    word_text,
    furigana,
    meaning,
    pos,
    status,
    repetitions,
    next_review_at,
    last_review,
    material_id,
    created_at,
    source_sentence,
    source_material_id,
    last_reviewed_at,
    user_id,
    ease_factor,
    "interval",
    language,
    base_form,
    source_ref,
    etym,
    hanja,
    is_excluded
   FROM public.vocabulary_with_exclusions
  WHERE NOT is_excluded;

ALTER VIEW "public"."active_vocabulary" OWNER TO "postgres";

ALTER SCHEMA "extensions" OWNER TO "postgres";

REVOKE ALL ON SCHEMA "extensions" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT USAGE ON SCHEMA "extensions" TO "postgres";

GRANT CREATE ON SCHEMA "extensions" TO "postgres";

GRANT USAGE ON SCHEMA "extensions" TO "anon";

GRANT USAGE ON SCHEMA "extensions" TO "authenticated";

GRANT USAGE ON SCHEMA "extensions" TO "service_role";

GRANT USAGE ON SCHEMA "extensions" TO "dashboard_user";

GRANT CREATE ON SCHEMA "extensions" TO "dashboard_user";

ALTER SCHEMA "graphql_public" OWNER TO "supabase_admin";

REVOKE ALL ON SCHEMA "graphql_public" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT USAGE ON SCHEMA "graphql_public" TO "supabase_admin";

GRANT CREATE ON SCHEMA "graphql_public" TO "supabase_admin";

GRANT USAGE ON SCHEMA "graphql_public" TO "postgres" WITH GRANT OPTION;

GRANT USAGE ON SCHEMA "graphql_public" TO "anon";

GRANT USAGE ON SCHEMA "graphql_public" TO "authenticated";

GRANT USAGE ON SCHEMA "graphql_public" TO "service_role";

ALTER SCHEMA "auth" OWNER TO "supabase_admin";

REVOKE ALL ON SCHEMA "auth" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT USAGE ON SCHEMA "auth" TO "supabase_admin";

GRANT CREATE ON SCHEMA "auth" TO "supabase_admin";

GRANT USAGE ON SCHEMA "auth" TO "anon";

GRANT USAGE ON SCHEMA "auth" TO "authenticated";

GRANT USAGE ON SCHEMA "auth" TO "service_role";

GRANT USAGE ON SCHEMA "auth" TO "supabase_auth_admin";

GRANT CREATE ON SCHEMA "auth" TO "supabase_auth_admin";

GRANT USAGE ON SCHEMA "auth" TO "dashboard_user";

GRANT CREATE ON SCHEMA "auth" TO "dashboard_user";

GRANT USAGE ON SCHEMA "auth" TO "postgres";

ALTER SCHEMA "public" OWNER TO "pg_database_owner";

REVOKE ALL ON SCHEMA "public" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT USAGE ON SCHEMA "public" TO "pg_database_owner";

GRANT CREATE ON SCHEMA "public" TO "pg_database_owner";

GRANT USAGE ON SCHEMA "public" TO PUBLIC;

GRANT USAGE ON SCHEMA "public" TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "anon";

GRANT USAGE ON SCHEMA "public" TO "authenticated";

GRANT USAGE ON SCHEMA "public" TO "service_role";

ALTER SCHEMA "library_private" OWNER TO "postgres";

REVOKE ALL ON SCHEMA "library_private" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT USAGE ON SCHEMA "library_private" TO "postgres";

GRANT CREATE ON SCHEMA "library_private" TO "postgres";

GRANT USAGE ON SCHEMA "library_private" TO "authenticated";

ALTER SCHEMA "fsrs_private" OWNER TO "postgres";

REVOKE ALL ON SCHEMA "fsrs_private" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT USAGE ON SCHEMA "fsrs_private" TO "postgres";

GRANT CREATE ON SCHEMA "fsrs_private" TO "postgres";

REVOKE ALL ON FUNCTION "auth"."uid"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "auth"."uid"() TO PUBLIC;

GRANT EXECUTE ON FUNCTION "auth"."uid"() TO "supabase_auth_admin";

GRANT EXECUTE ON FUNCTION "auth"."uid"() TO "dashboard_user";

REVOKE ALL ON FUNCTION "extensions"."grant_pg_cron_access"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "extensions"."grant_pg_cron_access"() TO PUBLIC;

GRANT EXECUTE ON FUNCTION "extensions"."grant_pg_cron_access"() TO "supabase_admin" WITH GRANT OPTION;

GRANT EXECUTE ON FUNCTION "extensions"."grant_pg_cron_access"() TO "dashboard_user";

REVOKE ALL ON FUNCTION "extensions"."grant_pg_graphql_access"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "extensions"."grant_pg_graphql_access"() TO PUBLIC;

GRANT EXECUTE ON FUNCTION "extensions"."grant_pg_graphql_access"() TO "supabase_admin";

GRANT EXECUTE ON FUNCTION "extensions"."grant_pg_graphql_access"() TO "postgres" WITH GRANT OPTION;

REVOKE ALL ON FUNCTION "extensions"."grant_pg_net_access"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "extensions"."grant_pg_net_access"() TO PUBLIC;

GRANT EXECUTE ON FUNCTION "extensions"."grant_pg_net_access"() TO "supabase_admin" WITH GRANT OPTION;

GRANT EXECUTE ON FUNCTION "extensions"."grant_pg_net_access"() TO "dashboard_user";

REVOKE ALL ON FUNCTION "extensions"."pgrst_ddl_watch"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "extensions"."pgrst_ddl_watch"() TO PUBLIC;

GRANT EXECUTE ON FUNCTION "extensions"."pgrst_ddl_watch"() TO "supabase_admin";

GRANT EXECUTE ON FUNCTION "extensions"."pgrst_ddl_watch"() TO "postgres" WITH GRANT OPTION;

REVOKE ALL ON FUNCTION "extensions"."pgrst_drop_watch"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "extensions"."pgrst_drop_watch"() TO PUBLIC;

GRANT EXECUTE ON FUNCTION "extensions"."pgrst_drop_watch"() TO "supabase_admin";

GRANT EXECUTE ON FUNCTION "extensions"."pgrst_drop_watch"() TO "postgres" WITH GRANT OPTION;

REVOKE ALL ON FUNCTION "extensions"."set_graphql_placeholder"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "extensions"."set_graphql_placeholder"() TO PUBLIC;

GRANT EXECUTE ON FUNCTION "extensions"."set_graphql_placeholder"() TO "supabase_admin";

GRANT EXECUTE ON FUNCTION "extensions"."set_graphql_placeholder"() TO "postgres" WITH GRANT OPTION;

REVOKE ALL ON FUNCTION "fsrs_private"."activity_function_acl"(p_oid oid) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "fsrs_private"."activity_function_acl"(p_oid oid) TO "postgres";

REVOKE ALL ON FUNCTION "fsrs_private"."activity_namespace_acl"(p_name text) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "fsrs_private"."activity_namespace_acl"(p_name text) TO "postgres";

REVOKE ALL ON FUNCTION "fsrs_private"."activity_platform_role_catalog"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "fsrs_private"."activity_platform_role_catalog"() TO "postgres";

REVOKE ALL ON FUNCTION "fsrs_private"."activity_preflight"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "fsrs_private"."activity_preflight"() TO "postgres";

REVOKE ALL ON FUNCTION "fsrs_private"."activity_profile_dependencies"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "fsrs_private"."activity_profile_dependencies"() TO "postgres";

REVOKE ALL ON FUNCTION "fsrs_private"."activity_profile_hash"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "fsrs_private"."activity_profile_hash"() TO "postgres";

REVOKE ALL ON FUNCTION "fsrs_private"."activity_profile_shape"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "fsrs_private"."activity_profile_shape"() TO "postgres";

REVOKE ALL ON FUNCTION "fsrs_private"."admission_contract_hash"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "fsrs_private"."admission_contract_hash"() TO "postgres";

REVOKE ALL ON FUNCTION "fsrs_private"."admission_day"(p_at timestamp with time zone) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "fsrs_private"."admission_day"(p_at timestamp with time zone) TO "postgres";

REVOKE ALL ON FUNCTION "fsrs_private"."admission_status"(p_actor uuid, p_at timestamp with time zone) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "fsrs_private"."admission_status"(p_actor uuid, p_at timestamp with time zone) TO "postgres";

REVOKE ALL ON FUNCTION "fsrs_private"."append_activity"(p_actor uuid, p_kind text, p_id text, p_card uuid, p_effective timestamp with time zone) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "fsrs_private"."append_activity"(p_actor uuid, p_kind text, p_id text, p_card uuid, p_effective timestamp with time zone) TO "postgres";

REVOKE ALL ON FUNCTION "fsrs_private"."blocked"(p_actor uuid, p_card uuid) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "fsrs_private"."blocked"(p_actor uuid, p_card uuid) TO "postgres";

REVOKE ALL ON FUNCTION "fsrs_private"."contract_hash"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "fsrs_private"."contract_hash"() TO "postgres";

REVOKE ALL ON FUNCTION "fsrs_private"."guard_learning_enrollment"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "fsrs_private"."guard_learning_enrollment"() TO "postgres";

REVOKE ALL ON FUNCTION "fsrs_private"."guard_learning_first_question"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "fsrs_private"."guard_learning_first_question"() TO "postgres";

REVOKE ALL ON FUNCTION "fsrs_private"."guard_legacy_event"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "fsrs_private"."guard_legacy_event"() TO "postgres";

REVOKE ALL ON FUNCTION "fsrs_private"."guard_legacy_vocabulary"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "fsrs_private"."guard_legacy_vocabulary"() TO "postgres";

REVOKE ALL ON FUNCTION "fsrs_private"."iso_milliseconds"(p_time timestamp with time zone) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "fsrs_private"."iso_milliseconds"(p_time timestamp with time zone) TO "postgres";

REVOKE ALL ON FUNCTION "fsrs_private"."legacy_activity_before_epoch"(p_actor uuid) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "fsrs_private"."legacy_activity_before_epoch"(p_actor uuid) TO "postgres";

REVOKE ALL ON FUNCTION "fsrs_private"."manual_contract_hash"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "fsrs_private"."manual_contract_hash"() TO "postgres";

REVOKE ALL ON FUNCTION "fsrs_private"."next_question_at"(p_actor uuid, p_card_id uuid) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "fsrs_private"."next_question_at"(p_actor uuid, p_card_id uuid) TO "postgres";

REVOKE ALL ON FUNCTION "fsrs_private"."project_activity_days"(p_baseline jsonb, p_days date[]) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "fsrs_private"."project_activity_days"(p_baseline jsonb, p_days date[]) TO "postgres";

REVOKE ALL ON FUNCTION "fsrs_private"."project_activity_days_with_legacy"(p_baseline jsonb, p_days date[], p_legacy_days date[]) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "fsrs_private"."project_activity_days_with_legacy"(p_baseline jsonb, p_days date[], p_legacy_days date[]) TO "postgres";

REVOKE ALL ON FUNCTION "fsrs_private"."record_fsrs_activity"(p_actor uuid, p_operation_id text) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "fsrs_private"."record_fsrs_activity"(p_actor uuid, p_operation_id text) TO "postgres";

REVOKE ALL ON FUNCTION "fsrs_private"."record_learning_activity"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "fsrs_private"."record_learning_activity"() TO "postgres";

REVOKE ALL ON FUNCTION "fsrs_private"."require_admission_integrity"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "fsrs_private"."require_admission_integrity"() TO "postgres";

REVOKE ALL ON FUNCTION "fsrs_private"."valid_card"(c jsonb) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "fsrs_private"."valid_card"(c jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "fsrs_private"."vocabulary_registry_entry"(p_actor uuid, p_card_id uuid) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "fsrs_private"."vocabulary_registry_entry"(p_actor uuid, p_card_id uuid) TO "postgres";

REVOKE ALL ON FUNCTION "graphql_public"."graphql"("operationName" text, query text, variables jsonb, extensions jsonb) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "graphql_public"."graphql"("operationName" text, query text, variables jsonb, extensions jsonb) TO PUBLIC;

GRANT EXECUTE ON FUNCTION "graphql_public"."graphql"("operationName" text, query text, variables jsonb, extensions jsonb) TO "supabase_admin";

GRANT EXECUTE ON FUNCTION "graphql_public"."graphql"("operationName" text, query text, variables jsonb, extensions jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "graphql_public"."graphql"("operationName" text, query text, variables jsonb, extensions jsonb) TO "anon";

GRANT EXECUTE ON FUNCTION "graphql_public"."graphql"("operationName" text, query text, variables jsonb, extensions jsonb) TO "authenticated";

GRANT EXECUTE ON FUNCTION "graphql_public"."graphql"("operationName" text, query text, variables jsonb, extensions jsonb) TO "service_role";

REVOKE ALL ON FUNCTION "library_private"."protect_source_delete"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "library_private"."protect_source_delete"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."classroom_save_vocabulary"(p_owner uuid, p_root bigint, p_generation integer, p_material bigint, p_expected_raw text, p_expected_json jsonb, p_word jsonb, p_source jsonb, p_initial jsonb, p_confirm_id uuid, p_confirm_meaning text) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."classroom_save_vocabulary"(p_owner uuid, p_root bigint, p_generation integer, p_material bigint, p_expected_raw text, p_expected_json jsonb, p_word jsonb, p_source jsonb, p_initial jsonb, p_confirm_id uuid, p_confirm_meaning text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."classroom_save_vocabulary"(p_owner uuid, p_root bigint, p_generation integer, p_material bigint, p_expected_raw text, p_expected_json jsonb, p_word jsonb, p_source jsonb, p_initial jsonb, p_confirm_id uuid, p_confirm_meaning text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."enforce_role_change_by_admin"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."enforce_role_change_by_admin"() TO PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."enforce_role_change_by_admin"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."enforce_role_change_by_admin"() TO "anon";

GRANT EXECUTE ON FUNCTION "public"."enforce_role_change_by_admin"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."enforce_role_change_by_admin"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."fsrs_apply_learning_operation"(p_actor uuid, p_operation jsonb) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."fsrs_apply_learning_operation"(p_actor uuid, p_operation jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."fsrs_apply_learning_operation"(p_actor uuid, p_operation jsonb) TO "service_role";

REVOKE ALL ON FUNCTION "public"."fsrs_apply_operation"(p_actor uuid, p_operation jsonb) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."fsrs_apply_operation"(p_actor uuid, p_operation jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."fsrs_apply_operation"(p_actor uuid, p_operation jsonb) TO "service_role";

REVOKE ALL ON FUNCTION "public"."fsrs_capabilities"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."fsrs_capabilities"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."fsrs_capabilities"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."fsrs_learning_admission_marker"(p_actor uuid) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."fsrs_learning_admission_marker"(p_actor uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."fsrs_learning_admission_marker"(p_actor uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."fsrs_legacy_boundary"(p_card_id uuid, p_item_key text, p_language text) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."fsrs_legacy_boundary"(p_card_id uuid, p_item_key text, p_language text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."fsrs_legacy_boundary"(p_card_id uuid, p_item_key text, p_language text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."fsrs_list_states"(p_actor uuid) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."fsrs_list_states"(p_actor uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."fsrs_list_states"(p_actor uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."fsrs_read_operation"(p_actor uuid, p_card_id uuid, p_operation_id text) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."fsrs_read_operation"(p_actor uuid, p_card_id uuid, p_operation_id text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."fsrs_read_operation"(p_actor uuid, p_card_id uuid, p_operation_id text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."fsrs_read_state"(p_actor uuid, p_card_id uuid) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."fsrs_read_state"(p_actor uuid, p_card_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."fsrs_read_state"(p_actor uuid, p_card_id uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."fsrs_save_manual_vocabulary"(p_actor uuid, p_request jsonb, p_initial_card jsonb) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."fsrs_save_manual_vocabulary"(p_actor uuid, p_request jsonb, p_initial_card jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."fsrs_save_manual_vocabulary"(p_actor uuid, p_request jsonb, p_initial_card jsonb) TO "service_role";

REVOKE ALL ON FUNCTION "public"."fsrs_vocabulary_snapshot"(p_actor uuid) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."fsrs_vocabulary_snapshot"(p_actor uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."fsrs_vocabulary_snapshot"(p_actor uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."guard_excluded_review_event"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."guard_excluded_review_event"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."guard_excluded_review_event"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."guard_excluded_vocabulary"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."guard_excluded_vocabulary"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."guard_excluded_vocabulary"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."guard_known_word_review_exclusion"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."guard_known_word_review_exclusion"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."guard_known_word_review_exclusion"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."guard_korean_learning_contract"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."guard_korean_learning_contract"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."guard_source_passage_write"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."guard_source_passage_write"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."guard_source_passage_write"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."is_admin"() TO PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."is_admin"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_admin"() TO "anon";

GRANT EXECUTE ON FUNCTION "public"."is_admin"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."is_admin"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."learning_admission_status"(p_actor uuid) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."learning_admission_status"(p_actor uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."learning_admission_status"(p_actor uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."learning_admit_legacy"(p_actor uuid, p_request jsonb) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."learning_admit_legacy"(p_actor uuid, p_request jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."learning_admit_legacy"(p_actor uuid, p_request jsonb) TO "service_role";

REVOKE ALL ON FUNCTION "public"."learning_configure_admission"(p_actor uuid, p_request jsonb) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."learning_configure_admission"(p_actor uuid, p_request jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."learning_configure_admission"(p_actor uuid, p_request jsonb) TO "service_role";

REVOKE ALL ON FUNCTION "public"."learning_language_capabilities"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."learning_language_capabilities"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."learning_language_capabilities"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."library_book_preserve_metadata"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."library_book_preserve_metadata"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."library_book_preserve_metadata"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."lock_vocabulary_exclusion_owner"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."lock_vocabulary_exclusion_owner"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."lock_vocabulary_exclusion_owner"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."open_source_passage"(p_parent bigint, p_source jsonb, p_text text, p_language text) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."open_source_passage"(p_parent bigint, p_source jsonb, p_text text, p_language text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."open_source_passage"(p_parent bigint, p_source jsonb, p_text text, p_language text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."open_source_passage"(p_parent bigint, p_source jsonb, p_text text, p_language text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."preserve_deleted_vocabulary_exclusion"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."preserve_deleted_vocabulary_exclusion"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."preserve_deleted_vocabulary_exclusion"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."protect_composer_source"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."protect_composer_source"() TO PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."protect_composer_source"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."protect_composer_source"() TO "anon";

GRANT EXECUTE ON FUNCTION "public"."protect_composer_source"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."protect_composer_source"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."save_vocabulary_context"(p_word jsonb, p_source jsonb, p_confirm_id uuid, p_confirm_meaning text) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."save_vocabulary_context"(p_word jsonb, p_source jsonb, p_confirm_id uuid, p_confirm_meaning text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."save_vocabulary_context"(p_word jsonb, p_source jsonb, p_confirm_id uuid, p_confirm_meaning text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."save_vocabulary_context"(p_word jsonb, p_source jsonb, p_confirm_id uuid, p_confirm_meaning text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."save_vocabulary_context_for"(p_owner uuid, p_word jsonb, p_source jsonb, p_confirm_id uuid, p_confirm_meaning text) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."save_vocabulary_context_for"(p_owner uuid, p_word jsonb, p_source jsonb, p_confirm_id uuid, p_confirm_meaning text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."save_vocabulary_context_for"(p_owner uuid, p_word jsonb, p_source jsonb, p_confirm_id uuid, p_confirm_meaning text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."save_vocabulary_context_for"(p_owner uuid, p_word jsonb, p_source jsonb, p_confirm_id uuid, p_confirm_meaning text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_vocabulary_exclusion"(p_language text, p_word text, p_vocabulary_id uuid, p_excluded boolean, p_exclusion_id uuid) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."set_vocabulary_exclusion"(p_language text, p_word text, p_vocabulary_id uuid, p_excluded boolean, p_exclusion_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_vocabulary_exclusion"(p_language text, p_word text, p_vocabulary_id uuid, p_excluded boolean, p_exclusion_id uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."set_vocabulary_exclusion"(p_language text, p_word text, p_vocabulary_id uuid, p_excluded boolean, p_exclusion_id uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."sync_known_word_review_exclusion"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."sync_known_word_review_exclusion"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."sync_known_word_review_exclusion"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."sync_vocabulary_exclusion_identity"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."sync_vocabulary_exclusion_identity"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."sync_vocabulary_exclusion_identity"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_streak"(uid uuid) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."update_streak"(uid uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."update_streak"(uid uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."validate_source_passage"() FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."validate_source_passage"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."validate_source_passage"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."viewer_replace_analysis"(p_id bigint, p_expected_raw text, p_expected_json jsonb, p_raw text, p_json jsonb, p_attempt uuid) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."viewer_replace_analysis"(p_id bigint, p_expected_raw text, p_expected_json jsonb, p_raw text, p_json jsonb, p_attempt uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."viewer_replace_analysis"(p_id bigint, p_expected_raw text, p_expected_json jsonb, p_raw text, p_json jsonb, p_attempt uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."viewer_replace_analysis"(p_id bigint, p_expected_raw text, p_expected_json jsonb, p_raw text, p_json jsonb, p_attempt uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."viewer_undo_vocabulary_save"(p_id uuid, p_expected jsonb, p_context_ids uuid[]) FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT EXECUTE ON FUNCTION "public"."viewer_undo_vocabulary_save"(p_id uuid, p_expected jsonb, p_context_ids uuid[]) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."viewer_undo_vocabulary_save"(p_id uuid, p_expected jsonb, p_context_ids uuid[]) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."viewer_undo_vocabulary_save"(p_id uuid, p_expected jsonb, p_context_ids uuid[]) TO "authenticated";

REVOKE ALL ON TABLE "fsrs_private"."activity_baselines" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT INSERT ON TABLE "fsrs_private"."activity_baselines" TO "postgres";

GRANT SELECT ON TABLE "fsrs_private"."activity_baselines" TO "postgres";

GRANT UPDATE ON TABLE "fsrs_private"."activity_baselines" TO "postgres";

GRANT DELETE ON TABLE "fsrs_private"."activity_baselines" TO "postgres";

GRANT TRUNCATE ON TABLE "fsrs_private"."activity_baselines" TO "postgres";

GRANT REFERENCES ON TABLE "fsrs_private"."activity_baselines" TO "postgres";

GRANT TRIGGER ON TABLE "fsrs_private"."activity_baselines" TO "postgres";

GRANT MAINTAIN ON TABLE "fsrs_private"."activity_baselines" TO "postgres";

ALTER TABLE "fsrs_private"."activity_baselines" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "fsrs_private"."activity_receipts" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT INSERT ON TABLE "fsrs_private"."activity_receipts" TO "postgres";

GRANT SELECT ON TABLE "fsrs_private"."activity_receipts" TO "postgres";

GRANT UPDATE ON TABLE "fsrs_private"."activity_receipts" TO "postgres";

GRANT DELETE ON TABLE "fsrs_private"."activity_receipts" TO "postgres";

GRANT TRUNCATE ON TABLE "fsrs_private"."activity_receipts" TO "postgres";

GRANT REFERENCES ON TABLE "fsrs_private"."activity_receipts" TO "postgres";

GRANT TRIGGER ON TABLE "fsrs_private"."activity_receipts" TO "postgres";

GRANT MAINTAIN ON TABLE "fsrs_private"."activity_receipts" TO "postgres";

ALTER TABLE "fsrs_private"."activity_receipts" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "fsrs_private"."activity_settings" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT INSERT ON TABLE "fsrs_private"."activity_settings" TO "postgres";

GRANT SELECT ON TABLE "fsrs_private"."activity_settings" TO "postgres";

GRANT UPDATE ON TABLE "fsrs_private"."activity_settings" TO "postgres";

GRANT DELETE ON TABLE "fsrs_private"."activity_settings" TO "postgres";

GRANT TRUNCATE ON TABLE "fsrs_private"."activity_settings" TO "postgres";

GRANT REFERENCES ON TABLE "fsrs_private"."activity_settings" TO "postgres";

GRANT TRIGGER ON TABLE "fsrs_private"."activity_settings" TO "postgres";

GRANT MAINTAIN ON TABLE "fsrs_private"."activity_settings" TO "postgres";

ALTER TABLE "fsrs_private"."activity_settings" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "fsrs_private"."admission_config_receipts" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT INSERT ON TABLE "fsrs_private"."admission_config_receipts" TO "postgres";

GRANT SELECT ON TABLE "fsrs_private"."admission_config_receipts" TO "postgres";

GRANT UPDATE ON TABLE "fsrs_private"."admission_config_receipts" TO "postgres";

GRANT DELETE ON TABLE "fsrs_private"."admission_config_receipts" TO "postgres";

GRANT TRUNCATE ON TABLE "fsrs_private"."admission_config_receipts" TO "postgres";

GRANT REFERENCES ON TABLE "fsrs_private"."admission_config_receipts" TO "postgres";

GRANT TRIGGER ON TABLE "fsrs_private"."admission_config_receipts" TO "postgres";

GRANT MAINTAIN ON TABLE "fsrs_private"."admission_config_receipts" TO "postgres";

ALTER TABLE "fsrs_private"."admission_config_receipts" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "fsrs_private"."admission_permits" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT INSERT ON TABLE "fsrs_private"."admission_permits" TO "postgres";

GRANT SELECT ON TABLE "fsrs_private"."admission_permits" TO "postgres";

GRANT UPDATE ON TABLE "fsrs_private"."admission_permits" TO "postgres";

GRANT DELETE ON TABLE "fsrs_private"."admission_permits" TO "postgres";

GRANT TRUNCATE ON TABLE "fsrs_private"."admission_permits" TO "postgres";

GRANT REFERENCES ON TABLE "fsrs_private"."admission_permits" TO "postgres";

GRANT TRIGGER ON TABLE "fsrs_private"."admission_permits" TO "postgres";

GRANT MAINTAIN ON TABLE "fsrs_private"."admission_permits" TO "postgres";

ALTER TABLE "fsrs_private"."admission_permits" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "fsrs_private"."admission_policies" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT INSERT ON TABLE "fsrs_private"."admission_policies" TO "postgres";

GRANT SELECT ON TABLE "fsrs_private"."admission_policies" TO "postgres";

GRANT UPDATE ON TABLE "fsrs_private"."admission_policies" TO "postgres";

GRANT DELETE ON TABLE "fsrs_private"."admission_policies" TO "postgres";

GRANT TRUNCATE ON TABLE "fsrs_private"."admission_policies" TO "postgres";

GRANT REFERENCES ON TABLE "fsrs_private"."admission_policies" TO "postgres";

GRANT TRIGGER ON TABLE "fsrs_private"."admission_policies" TO "postgres";

GRANT MAINTAIN ON TABLE "fsrs_private"."admission_policies" TO "postgres";

ALTER TABLE "fsrs_private"."admission_policies" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "fsrs_private"."admission_requests" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT INSERT ON TABLE "fsrs_private"."admission_requests" TO "postgres";

GRANT SELECT ON TABLE "fsrs_private"."admission_requests" TO "postgres";

GRANT UPDATE ON TABLE "fsrs_private"."admission_requests" TO "postgres";

GRANT DELETE ON TABLE "fsrs_private"."admission_requests" TO "postgres";

GRANT TRUNCATE ON TABLE "fsrs_private"."admission_requests" TO "postgres";

GRANT REFERENCES ON TABLE "fsrs_private"."admission_requests" TO "postgres";

GRANT TRIGGER ON TABLE "fsrs_private"."admission_requests" TO "postgres";

GRANT MAINTAIN ON TABLE "fsrs_private"."admission_requests" TO "postgres";

ALTER TABLE "fsrs_private"."admission_requests" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "fsrs_private"."admission_settings" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT INSERT ON TABLE "fsrs_private"."admission_settings" TO "postgres";

GRANT SELECT ON TABLE "fsrs_private"."admission_settings" TO "postgres";

GRANT UPDATE ON TABLE "fsrs_private"."admission_settings" TO "postgres";

GRANT DELETE ON TABLE "fsrs_private"."admission_settings" TO "postgres";

GRANT TRUNCATE ON TABLE "fsrs_private"."admission_settings" TO "postgres";

GRANT REFERENCES ON TABLE "fsrs_private"."admission_settings" TO "postgres";

GRANT TRIGGER ON TABLE "fsrs_private"."admission_settings" TO "postgres";

GRANT MAINTAIN ON TABLE "fsrs_private"."admission_settings" TO "postgres";

ALTER TABLE "fsrs_private"."admission_settings" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "fsrs_private"."event_permits" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT INSERT ON TABLE "fsrs_private"."event_permits" TO "postgres";

GRANT SELECT ON TABLE "fsrs_private"."event_permits" TO "postgres";

GRANT UPDATE ON TABLE "fsrs_private"."event_permits" TO "postgres";

GRANT DELETE ON TABLE "fsrs_private"."event_permits" TO "postgres";

GRANT TRUNCATE ON TABLE "fsrs_private"."event_permits" TO "postgres";

GRANT REFERENCES ON TABLE "fsrs_private"."event_permits" TO "postgres";

GRANT TRIGGER ON TABLE "fsrs_private"."event_permits" TO "postgres";

GRANT MAINTAIN ON TABLE "fsrs_private"."event_permits" TO "postgres";

REVOKE ALL ON TABLE "fsrs_private"."legacy_admissions" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT INSERT ON TABLE "fsrs_private"."legacy_admissions" TO "postgres";

GRANT SELECT ON TABLE "fsrs_private"."legacy_admissions" TO "postgres";

GRANT UPDATE ON TABLE "fsrs_private"."legacy_admissions" TO "postgres";

GRANT DELETE ON TABLE "fsrs_private"."legacy_admissions" TO "postgres";

GRANT TRUNCATE ON TABLE "fsrs_private"."legacy_admissions" TO "postgres";

GRANT REFERENCES ON TABLE "fsrs_private"."legacy_admissions" TO "postgres";

GRANT TRIGGER ON TABLE "fsrs_private"."legacy_admissions" TO "postgres";

GRANT MAINTAIN ON TABLE "fsrs_private"."legacy_admissions" TO "postgres";

ALTER TABLE "fsrs_private"."legacy_admissions" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "fsrs_private"."manual_save_settings" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT INSERT ON TABLE "fsrs_private"."manual_save_settings" TO "postgres";

GRANT SELECT ON TABLE "fsrs_private"."manual_save_settings" TO "postgres";

GRANT UPDATE ON TABLE "fsrs_private"."manual_save_settings" TO "postgres";

GRANT DELETE ON TABLE "fsrs_private"."manual_save_settings" TO "postgres";

GRANT TRUNCATE ON TABLE "fsrs_private"."manual_save_settings" TO "postgres";

GRANT REFERENCES ON TABLE "fsrs_private"."manual_save_settings" TO "postgres";

GRANT TRIGGER ON TABLE "fsrs_private"."manual_save_settings" TO "postgres";

GRANT MAINTAIN ON TABLE "fsrs_private"."manual_save_settings" TO "postgres";

REVOKE ALL ON TABLE "public"."active_vocabulary" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT INSERT ON TABLE "public"."active_vocabulary" TO "postgres";

GRANT SELECT ON TABLE "public"."active_vocabulary" TO "postgres";

GRANT UPDATE ON TABLE "public"."active_vocabulary" TO "postgres";

GRANT DELETE ON TABLE "public"."active_vocabulary" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."active_vocabulary" TO "postgres";

GRANT REFERENCES ON TABLE "public"."active_vocabulary" TO "postgres";

GRANT TRIGGER ON TABLE "public"."active_vocabulary" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."active_vocabulary" TO "postgres";

GRANT INSERT ON TABLE "public"."active_vocabulary" TO "service_role";

GRANT SELECT ON TABLE "public"."active_vocabulary" TO "service_role";

GRANT UPDATE ON TABLE "public"."active_vocabulary" TO "service_role";

GRANT DELETE ON TABLE "public"."active_vocabulary" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."active_vocabulary" TO "service_role";

GRANT REFERENCES ON TABLE "public"."active_vocabulary" TO "service_role";

GRANT TRIGGER ON TABLE "public"."active_vocabulary" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."active_vocabulary" TO "service_role";

GRANT SELECT ON TABLE "public"."active_vocabulary" TO "authenticated";

REVOKE ALL ON TABLE "public"."fsrs_cards" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT INSERT ON TABLE "public"."fsrs_cards" TO "postgres";

GRANT SELECT ON TABLE "public"."fsrs_cards" TO "postgres";

GRANT UPDATE ON TABLE "public"."fsrs_cards" TO "postgres";

GRANT DELETE ON TABLE "public"."fsrs_cards" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."fsrs_cards" TO "postgres";

GRANT REFERENCES ON TABLE "public"."fsrs_cards" TO "postgres";

GRANT TRIGGER ON TABLE "public"."fsrs_cards" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."fsrs_cards" TO "postgres";

GRANT SELECT ON TABLE "public"."fsrs_cards" TO "authenticated";

CREATE POLICY "fsrs_card_owner" ON "public"."fsrs_cards" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = ( SELECT auth.uid() AS uid)));

ALTER TABLE "public"."fsrs_cards" ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER learning_guard_enrollment BEFORE INSERT ON public.fsrs_cards FOR EACH ROW EXECUTE FUNCTION fsrs_private.guard_learning_enrollment();

REVOKE ALL ON TABLE "public"."fsrs_effective_reviews" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT INSERT ON TABLE "public"."fsrs_effective_reviews" TO "postgres";

GRANT SELECT ON TABLE "public"."fsrs_effective_reviews" TO "postgres";

GRANT UPDATE ON TABLE "public"."fsrs_effective_reviews" TO "postgres";

GRANT DELETE ON TABLE "public"."fsrs_effective_reviews" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."fsrs_effective_reviews" TO "postgres";

GRANT REFERENCES ON TABLE "public"."fsrs_effective_reviews" TO "postgres";

GRANT TRIGGER ON TABLE "public"."fsrs_effective_reviews" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."fsrs_effective_reviews" TO "postgres";

GRANT SELECT ON TABLE "public"."fsrs_effective_reviews" TO "authenticated";

REVOKE ALL ON TABLE "public"."fsrs_manual_save_receipts" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT INSERT ON TABLE "public"."fsrs_manual_save_receipts" TO "postgres";

GRANT SELECT ON TABLE "public"."fsrs_manual_save_receipts" TO "postgres";

GRANT UPDATE ON TABLE "public"."fsrs_manual_save_receipts" TO "postgres";

GRANT DELETE ON TABLE "public"."fsrs_manual_save_receipts" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."fsrs_manual_save_receipts" TO "postgres";

GRANT REFERENCES ON TABLE "public"."fsrs_manual_save_receipts" TO "postgres";

GRANT TRIGGER ON TABLE "public"."fsrs_manual_save_receipts" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."fsrs_manual_save_receipts" TO "postgres";

GRANT SELECT ON TABLE "public"."fsrs_manual_save_receipts" TO "authenticated";

CREATE POLICY "fsrs_manual_receipt_owner" ON "public"."fsrs_manual_save_receipts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = ( SELECT auth.uid() AS uid)));

ALTER TABLE "public"."fsrs_manual_save_receipts" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."fsrs_new_receipts" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT INSERT ON TABLE "public"."fsrs_new_receipts" TO "postgres";

GRANT SELECT ON TABLE "public"."fsrs_new_receipts" TO "postgres";

GRANT UPDATE ON TABLE "public"."fsrs_new_receipts" TO "postgres";

GRANT DELETE ON TABLE "public"."fsrs_new_receipts" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."fsrs_new_receipts" TO "postgres";

GRANT REFERENCES ON TABLE "public"."fsrs_new_receipts" TO "postgres";

GRANT TRIGGER ON TABLE "public"."fsrs_new_receipts" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."fsrs_new_receipts" TO "postgres";

GRANT SELECT ON TABLE "public"."fsrs_new_receipts" TO "authenticated";

CREATE POLICY "fsrs_receipt_owner" ON "public"."fsrs_new_receipts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = ( SELECT auth.uid() AS uid)));

ALTER TABLE "public"."fsrs_new_receipts" ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER learning_guard_first_question BEFORE INSERT ON public.fsrs_new_receipts FOR EACH ROW EXECUTE FUNCTION fsrs_private.guard_learning_first_question();

REVOKE ALL ON TABLE "public"."fsrs_operations" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT INSERT ON TABLE "public"."fsrs_operations" TO "postgres";

GRANT SELECT ON TABLE "public"."fsrs_operations" TO "postgres";

GRANT UPDATE ON TABLE "public"."fsrs_operations" TO "postgres";

GRANT DELETE ON TABLE "public"."fsrs_operations" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."fsrs_operations" TO "postgres";

GRANT REFERENCES ON TABLE "public"."fsrs_operations" TO "postgres";

GRANT TRIGGER ON TABLE "public"."fsrs_operations" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."fsrs_operations" TO "postgres";

GRANT SELECT ON TABLE "public"."fsrs_operations" TO "authenticated";

CREATE POLICY "fsrs_operation_owner" ON "public"."fsrs_operations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = ( SELECT auth.uid() AS uid)));

ALTER TABLE "public"."fsrs_operations" ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER learning_record_activity AFTER INSERT ON public.fsrs_operations FOR EACH ROW EXECUTE FUNCTION fsrs_private.record_learning_activity();

REVOKE ALL ON TABLE "public"."profiles" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT INSERT ON TABLE "public"."profiles" TO "postgres";

GRANT SELECT ON TABLE "public"."profiles" TO "postgres";

GRANT UPDATE ON TABLE "public"."profiles" TO "postgres";

GRANT DELETE ON TABLE "public"."profiles" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."profiles" TO "postgres";

GRANT REFERENCES ON TABLE "public"."profiles" TO "postgres";

GRANT TRIGGER ON TABLE "public"."profiles" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."profiles" TO "postgres";

GRANT INSERT ON TABLE "public"."profiles" TO "anon";

GRANT SELECT ON TABLE "public"."profiles" TO "anon";

GRANT UPDATE ON TABLE "public"."profiles" TO "anon";

GRANT DELETE ON TABLE "public"."profiles" TO "anon";

GRANT TRUNCATE ON TABLE "public"."profiles" TO "anon";

GRANT REFERENCES ON TABLE "public"."profiles" TO "anon";

GRANT TRIGGER ON TABLE "public"."profiles" TO "anon";

GRANT MAINTAIN ON TABLE "public"."profiles" TO "anon";

GRANT INSERT ON TABLE "public"."profiles" TO "authenticated";

GRANT SELECT ON TABLE "public"."profiles" TO "authenticated";

GRANT UPDATE ON TABLE "public"."profiles" TO "authenticated";

GRANT DELETE ON TABLE "public"."profiles" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."profiles" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."profiles" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."profiles" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."profiles" TO "authenticated";

GRANT INSERT ON TABLE "public"."profiles" TO "service_role";

GRANT SELECT ON TABLE "public"."profiles" TO "service_role";

GRANT UPDATE ON TABLE "public"."profiles" TO "service_role";

GRANT DELETE ON TABLE "public"."profiles" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."profiles" TO "service_role";

GRANT REFERENCES ON TABLE "public"."profiles" TO "service_role";

GRANT TRIGGER ON TABLE "public"."profiles" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."profiles" TO "service_role";

CREATE POLICY "Users can read own profile" ON "public"."profiles" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = id));

CREATE POLICY "Users can update own profile" ON "public"."profiles" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = id));

CREATE POLICY "anyone_read_basic_profile" ON "public"."profiles" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);

CREATE POLICY "profiles_insert" ON "public"."profiles" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = id));

CREATE POLICY "profiles_insert_student_only" ON "public"."profiles" AS RESTRICTIVE FOR INSERT TO "authenticated" WITH CHECK ((role = 'student'::text));

CREATE POLICY "profiles_select" ON "public"."profiles" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);

CREATE POLICY "profiles_update" ON "public"."profiles" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = id));

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_enforce_role_change BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.enforce_role_change_by_admin();

REVOKE ALL ON TABLE "public"."reading_materials" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT INSERT ON TABLE "public"."reading_materials" TO "postgres";

GRANT SELECT ON TABLE "public"."reading_materials" TO "postgres";

GRANT UPDATE ON TABLE "public"."reading_materials" TO "postgres";

GRANT DELETE ON TABLE "public"."reading_materials" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."reading_materials" TO "postgres";

GRANT REFERENCES ON TABLE "public"."reading_materials" TO "postgres";

GRANT TRIGGER ON TABLE "public"."reading_materials" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."reading_materials" TO "postgres";

GRANT INSERT ON TABLE "public"."reading_materials" TO "anon";

GRANT SELECT ON TABLE "public"."reading_materials" TO "anon";

GRANT UPDATE ON TABLE "public"."reading_materials" TO "anon";

GRANT DELETE ON TABLE "public"."reading_materials" TO "anon";

GRANT TRUNCATE ON TABLE "public"."reading_materials" TO "anon";

GRANT REFERENCES ON TABLE "public"."reading_materials" TO "anon";

GRANT TRIGGER ON TABLE "public"."reading_materials" TO "anon";

GRANT MAINTAIN ON TABLE "public"."reading_materials" TO "anon";

GRANT INSERT ON TABLE "public"."reading_materials" TO "authenticated";

GRANT SELECT ON TABLE "public"."reading_materials" TO "authenticated";

GRANT UPDATE ON TABLE "public"."reading_materials" TO "authenticated";

GRANT DELETE ON TABLE "public"."reading_materials" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."reading_materials" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."reading_materials" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."reading_materials" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."reading_materials" TO "authenticated";

GRANT INSERT ON TABLE "public"."reading_materials" TO "service_role";

GRANT SELECT ON TABLE "public"."reading_materials" TO "service_role";

GRANT UPDATE ON TABLE "public"."reading_materials" TO "service_role";

GRANT DELETE ON TABLE "public"."reading_materials" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."reading_materials" TO "service_role";

GRANT REFERENCES ON TABLE "public"."reading_materials" TO "service_role";

GRANT TRIGGER ON TABLE "public"."reading_materials" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."reading_materials" TO "service_role";

CREATE POLICY "Enable Read for All" ON "public"."reading_materials" AS PERMISSIVE FOR SELECT TO "anon" USING (true);

CREATE POLICY "Users can insert own materials" ON "public"."reading_materials" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((owner_id = auth.uid()));

CREATE POLICY "Users can read public or own materials" ON "public"."reading_materials" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((visibility = 'public'::text) OR (owner_id = auth.uid())));

CREATE POLICY "Users can update own materials" ON "public"."reading_materials" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((owner_id = auth.uid()));

CREATE POLICY "anyone_read_public_materials" ON "public"."reading_materials" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((visibility = 'public'::text));

CREATE POLICY "learning_material_visibility_guard" ON "public"."reading_materials" AS RESTRICTIVE FOR SELECT TO "anon", "authenticated" USING (((visibility = 'public'::text) OR (owner_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() AS is_admin)));

CREATE POLICY "owner_delete_material" ON "public"."reading_materials" AS PERMISSIVE FOR DELETE TO PUBLIC USING ((auth.uid() = owner_id));

CREATE POLICY "owner_read_private_materials" ON "public"."reading_materials" AS PERMISSIVE FOR SELECT TO PUBLIC USING (((visibility = 'private'::text) AND (owner_id = auth.uid())));

CREATE POLICY "owner_update_material" ON "public"."reading_materials" AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = owner_id));

ALTER TABLE "public"."reading_materials" ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER guard_source_passage_write BEFORE UPDATE OF raw_text, processed_json ON public.reading_materials FOR EACH ROW EXECUTE FUNCTION public.guard_source_passage_write();

CREATE TRIGGER library_book_preserve_metadata BEFORE UPDATE OF processed_json ON public.reading_materials FOR EACH ROW EXECUTE FUNCTION public.library_book_preserve_metadata();

CREATE TRIGGER library_protect_material_delete BEFORE DELETE ON public.reading_materials FOR EACH ROW EXECUTE FUNCTION library_private.protect_source_delete();

CREATE TRIGGER protect_composer_source BEFORE UPDATE OF raw_text, processed_json ON public.reading_materials FOR EACH ROW EXECUTE FUNCTION public.protect_composer_source();

CREATE TRIGGER validate_source_passage BEFORE INSERT ON public.reading_materials FOR EACH ROW EXECUTE FUNCTION public.validate_source_passage();

REVOKE ALL ON TABLE "public"."review_events" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT INSERT ON TABLE "public"."review_events" TO "postgres";

GRANT SELECT ON TABLE "public"."review_events" TO "postgres";

GRANT UPDATE ON TABLE "public"."review_events" TO "postgres";

GRANT DELETE ON TABLE "public"."review_events" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."review_events" TO "postgres";

GRANT REFERENCES ON TABLE "public"."review_events" TO "postgres";

GRANT TRIGGER ON TABLE "public"."review_events" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."review_events" TO "postgres";

GRANT INSERT ON TABLE "public"."review_events" TO "authenticated";

GRANT SELECT ON TABLE "public"."review_events" TO "authenticated";

GRANT UPDATE ON TABLE "public"."review_events" TO "authenticated";

GRANT DELETE ON TABLE "public"."review_events" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."review_events" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."review_events" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."review_events" TO "authenticated";

GRANT INSERT ON TABLE "public"."review_events" TO "service_role";

GRANT SELECT ON TABLE "public"."review_events" TO "service_role";

GRANT UPDATE ON TABLE "public"."review_events" TO "service_role";

GRANT DELETE ON TABLE "public"."review_events" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."review_events" TO "service_role";

GRANT REFERENCES ON TABLE "public"."review_events" TO "service_role";

GRANT TRIGGER ON TABLE "public"."review_events" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."review_events" TO "service_role";

CREATE POLICY "review_events_insert_own" ON "public"."review_events" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "review_events_select_own" ON "public"."review_events" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));

ALTER TABLE "public"."review_events" ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER fsrs_guard_legacy_event BEFORE INSERT OR DELETE OR UPDATE ON public.review_events FOR EACH ROW EXECUTE FUNCTION fsrs_private.guard_legacy_event();

CREATE TRIGGER guard_excluded_review_event BEFORE INSERT ON public.review_events FOR EACH ROW EXECUTE FUNCTION public.guard_excluded_review_event();

CREATE TRIGGER guard_korean_learning_contract BEFORE INSERT OR DELETE OR UPDATE ON public.review_events FOR EACH ROW EXECUTE FUNCTION public.guard_korean_learning_contract();

REVOKE ALL ON TABLE "public"."uploaded_pdfs" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT INSERT ON TABLE "public"."uploaded_pdfs" TO "postgres";

GRANT SELECT ON TABLE "public"."uploaded_pdfs" TO "postgres";

GRANT UPDATE ON TABLE "public"."uploaded_pdfs" TO "postgres";

GRANT DELETE ON TABLE "public"."uploaded_pdfs" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."uploaded_pdfs" TO "postgres";

GRANT REFERENCES ON TABLE "public"."uploaded_pdfs" TO "postgres";

GRANT TRIGGER ON TABLE "public"."uploaded_pdfs" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."uploaded_pdfs" TO "postgres";

GRANT INSERT ON TABLE "public"."uploaded_pdfs" TO "anon";

GRANT SELECT ON TABLE "public"."uploaded_pdfs" TO "anon";

GRANT UPDATE ON TABLE "public"."uploaded_pdfs" TO "anon";

GRANT DELETE ON TABLE "public"."uploaded_pdfs" TO "anon";

GRANT TRUNCATE ON TABLE "public"."uploaded_pdfs" TO "anon";

GRANT REFERENCES ON TABLE "public"."uploaded_pdfs" TO "anon";

GRANT TRIGGER ON TABLE "public"."uploaded_pdfs" TO "anon";

GRANT MAINTAIN ON TABLE "public"."uploaded_pdfs" TO "anon";

GRANT INSERT ON TABLE "public"."uploaded_pdfs" TO "authenticated";

GRANT SELECT ON TABLE "public"."uploaded_pdfs" TO "authenticated";

GRANT UPDATE ON TABLE "public"."uploaded_pdfs" TO "authenticated";

GRANT DELETE ON TABLE "public"."uploaded_pdfs" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."uploaded_pdfs" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."uploaded_pdfs" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."uploaded_pdfs" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."uploaded_pdfs" TO "authenticated";

GRANT INSERT ON TABLE "public"."uploaded_pdfs" TO "service_role";

GRANT SELECT ON TABLE "public"."uploaded_pdfs" TO "service_role";

GRANT UPDATE ON TABLE "public"."uploaded_pdfs" TO "service_role";

GRANT DELETE ON TABLE "public"."uploaded_pdfs" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."uploaded_pdfs" TO "service_role";

GRANT REFERENCES ON TABLE "public"."uploaded_pdfs" TO "service_role";

GRANT TRIGGER ON TABLE "public"."uploaded_pdfs" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."uploaded_pdfs" TO "service_role";

CREATE POLICY "Owner full access" ON "public"."uploaded_pdfs" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = owner_id)) WITH CHECK ((auth.uid() = owner_id));

ALTER TABLE "public"."uploaded_pdfs" ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER library_protect_pdf_delete BEFORE DELETE ON public.uploaded_pdfs FOR EACH ROW EXECUTE FUNCTION library_private.protect_source_delete();

REVOKE ALL ON TABLE "public"."user_known_words" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT INSERT ON TABLE "public"."user_known_words" TO "postgres";

GRANT SELECT ON TABLE "public"."user_known_words" TO "postgres";

GRANT UPDATE ON TABLE "public"."user_known_words" TO "postgres";

GRANT DELETE ON TABLE "public"."user_known_words" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."user_known_words" TO "postgres";

GRANT REFERENCES ON TABLE "public"."user_known_words" TO "postgres";

GRANT TRIGGER ON TABLE "public"."user_known_words" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."user_known_words" TO "postgres";

GRANT INSERT ON TABLE "public"."user_known_words" TO "authenticated";

GRANT SELECT ON TABLE "public"."user_known_words" TO "authenticated";

GRANT UPDATE ON TABLE "public"."user_known_words" TO "authenticated";

GRANT DELETE ON TABLE "public"."user_known_words" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."user_known_words" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."user_known_words" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."user_known_words" TO "authenticated";

GRANT INSERT ON TABLE "public"."user_known_words" TO "service_role";

GRANT SELECT ON TABLE "public"."user_known_words" TO "service_role";

GRANT UPDATE ON TABLE "public"."user_known_words" TO "service_role";

GRANT DELETE ON TABLE "public"."user_known_words" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."user_known_words" TO "service_role";

GRANT REFERENCES ON TABLE "public"."user_known_words" TO "service_role";

GRANT TRIGGER ON TABLE "public"."user_known_words" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."user_known_words" TO "service_role";

CREATE POLICY "user_known_words_delete_own" ON "public"."user_known_words" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((user_id = auth.uid()));

CREATE POLICY "user_known_words_insert_own" ON "public"."user_known_words" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "user_known_words_select_own" ON "public"."user_known_words" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = auth.uid()));

ALTER TABLE "public"."user_known_words" ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER guard_korean_learning_contract BEFORE INSERT OR DELETE OR UPDATE ON public.user_known_words FOR EACH ROW EXECUTE FUNCTION public.guard_korean_learning_contract();

CREATE TRIGGER lock_known_word_owner BEFORE INSERT OR DELETE ON public.user_known_words FOR EACH STATEMENT EXECUTE FUNCTION public.lock_vocabulary_exclusion_owner();

CREATE TRIGGER sync_known_word_review_exclusion AFTER INSERT OR DELETE ON public.user_known_words FOR EACH ROW EXECUTE FUNCTION public.sync_known_word_review_exclusion();

REVOKE ALL ON TABLE "public"."user_vocabulary" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT INSERT ON TABLE "public"."user_vocabulary" TO "postgres";

GRANT SELECT ON TABLE "public"."user_vocabulary" TO "postgres";

GRANT UPDATE ON TABLE "public"."user_vocabulary" TO "postgres";

GRANT DELETE ON TABLE "public"."user_vocabulary" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."user_vocabulary" TO "postgres";

GRANT REFERENCES ON TABLE "public"."user_vocabulary" TO "postgres";

GRANT TRIGGER ON TABLE "public"."user_vocabulary" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."user_vocabulary" TO "postgres";

GRANT INSERT ON TABLE "public"."user_vocabulary" TO "authenticated";

GRANT SELECT ON TABLE "public"."user_vocabulary" TO "authenticated";

GRANT UPDATE ON TABLE "public"."user_vocabulary" TO "authenticated";

GRANT DELETE ON TABLE "public"."user_vocabulary" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."user_vocabulary" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."user_vocabulary" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."user_vocabulary" TO "authenticated";

GRANT INSERT ON TABLE "public"."user_vocabulary" TO "service_role";

GRANT SELECT ON TABLE "public"."user_vocabulary" TO "service_role";

GRANT UPDATE ON TABLE "public"."user_vocabulary" TO "service_role";

GRANT DELETE ON TABLE "public"."user_vocabulary" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."user_vocabulary" TO "service_role";

GRANT REFERENCES ON TABLE "public"."user_vocabulary" TO "service_role";

GRANT TRIGGER ON TABLE "public"."user_vocabulary" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."user_vocabulary" TO "service_role";

CREATE POLICY "Users can manage own vocabulary" ON "public"."user_vocabulary" AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

ALTER TABLE "public"."user_vocabulary" ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER fsrs_guard_legacy_vocabulary BEFORE DELETE OR UPDATE ON public.user_vocabulary FOR EACH ROW EXECUTE FUNCTION fsrs_private.guard_legacy_vocabulary();

CREATE TRIGGER guard_excluded_vocabulary BEFORE INSERT OR UPDATE ON public.user_vocabulary FOR EACH ROW EXECUTE FUNCTION public.guard_excluded_vocabulary();

CREATE TRIGGER guard_korean_learning_contract BEFORE INSERT OR DELETE OR UPDATE ON public.user_vocabulary FOR EACH ROW EXECUTE FUNCTION public.guard_korean_learning_contract();

CREATE TRIGGER lock_vocabulary_exclusion_owner BEFORE INSERT OR DELETE OR UPDATE ON public.user_vocabulary FOR EACH STATEMENT EXECUTE FUNCTION public.lock_vocabulary_exclusion_owner();

CREATE TRIGGER preserve_deleted_vocabulary_exclusion BEFORE DELETE ON public.user_vocabulary FOR EACH ROW EXECUTE FUNCTION public.preserve_deleted_vocabulary_exclusion();

CREATE TRIGGER sync_vocabulary_exclusion_identity AFTER UPDATE OF word_text, base_form, language ON public.user_vocabulary FOR EACH ROW EXECUTE FUNCTION public.sync_vocabulary_exclusion_identity();

REVOKE ALL ON TABLE "public"."vocabulary_contexts" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT INSERT ON TABLE "public"."vocabulary_contexts" TO "postgres";

GRANT SELECT ON TABLE "public"."vocabulary_contexts" TO "postgres";

GRANT UPDATE ON TABLE "public"."vocabulary_contexts" TO "postgres";

GRANT DELETE ON TABLE "public"."vocabulary_contexts" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."vocabulary_contexts" TO "postgres";

GRANT REFERENCES ON TABLE "public"."vocabulary_contexts" TO "postgres";

GRANT TRIGGER ON TABLE "public"."vocabulary_contexts" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."vocabulary_contexts" TO "postgres";

GRANT INSERT ON TABLE "public"."vocabulary_contexts" TO "service_role";

GRANT SELECT ON TABLE "public"."vocabulary_contexts" TO "service_role";

GRANT UPDATE ON TABLE "public"."vocabulary_contexts" TO "service_role";

GRANT DELETE ON TABLE "public"."vocabulary_contexts" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."vocabulary_contexts" TO "service_role";

GRANT REFERENCES ON TABLE "public"."vocabulary_contexts" TO "service_role";

GRANT TRIGGER ON TABLE "public"."vocabulary_contexts" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."vocabulary_contexts" TO "service_role";

GRANT INSERT ON TABLE "public"."vocabulary_contexts" TO "authenticated";

GRANT SELECT ON TABLE "public"."vocabulary_contexts" TO "authenticated";

GRANT DELETE ON TABLE "public"."vocabulary_contexts" TO "authenticated";

CREATE POLICY "vocabulary_class_context_read" ON "public"."vocabulary_contexts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((kind = 'class'::text) AND (user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.user_vocabulary v
  WHERE ((v.id = vocabulary_contexts.vocabulary_id) AND (v.user_id = ( SELECT auth.uid() AS uid)))))));

CREATE POLICY "vocabulary_contexts_delete" ON "public"."vocabulary_contexts" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "vocabulary_contexts_insert" ON "public"."vocabulary_contexts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.user_vocabulary v
  WHERE ((v.id = vocabulary_contexts.vocabulary_id) AND (v.user_id = ( SELECT auth.uid() AS uid)) AND (v.language = vocabulary_contexts.lang)))) AND ((kind = 'textbook'::text) OR (EXISTS ( SELECT 1
   FROM public.reading_materials m
  WHERE ((m.id = vocabulary_contexts.material_id) AND ((m.owner_id = ( SELECT auth.uid() AS uid)) OR (m.visibility = 'public'::text))))) OR (EXISTS ( SELECT 1
   FROM public.uploaded_pdfs p
  WHERE ((p.id = vocabulary_contexts.pdf_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))))));

CREATE POLICY "vocabulary_contexts_read" ON "public"."vocabulary_contexts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.user_vocabulary v
  WHERE ((v.id = vocabulary_contexts.vocabulary_id) AND (v.user_id = ( SELECT auth.uid() AS uid))))) AND ((kind = 'textbook'::text) OR (EXISTS ( SELECT 1
   FROM public.reading_materials m
  WHERE ((m.id = vocabulary_contexts.material_id) AND ((m.owner_id = ( SELECT auth.uid() AS uid)) OR (m.visibility = 'public'::text))))) OR (EXISTS ( SELECT 1
   FROM public.uploaded_pdfs p
  WHERE ((p.id = vocabulary_contexts.pdf_id) AND (p.owner_id = ( SELECT auth.uid() AS uid))))))));

ALTER TABLE "public"."vocabulary_contexts" ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER guard_korean_learning_contract BEFORE INSERT OR DELETE OR UPDATE ON public.vocabulary_contexts FOR EACH ROW EXECUTE FUNCTION public.guard_korean_learning_contract();

REVOKE ALL ON TABLE "public"."vocabulary_exclusions" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT INSERT ON TABLE "public"."vocabulary_exclusions" TO "postgres";

GRANT SELECT ON TABLE "public"."vocabulary_exclusions" TO "postgres";

GRANT UPDATE ON TABLE "public"."vocabulary_exclusions" TO "postgres";

GRANT DELETE ON TABLE "public"."vocabulary_exclusions" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."vocabulary_exclusions" TO "postgres";

GRANT REFERENCES ON TABLE "public"."vocabulary_exclusions" TO "postgres";

GRANT TRIGGER ON TABLE "public"."vocabulary_exclusions" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."vocabulary_exclusions" TO "postgres";

GRANT INSERT ON TABLE "public"."vocabulary_exclusions" TO "service_role";

GRANT SELECT ON TABLE "public"."vocabulary_exclusions" TO "service_role";

GRANT UPDATE ON TABLE "public"."vocabulary_exclusions" TO "service_role";

GRANT DELETE ON TABLE "public"."vocabulary_exclusions" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."vocabulary_exclusions" TO "service_role";

GRANT REFERENCES ON TABLE "public"."vocabulary_exclusions" TO "service_role";

GRANT TRIGGER ON TABLE "public"."vocabulary_exclusions" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."vocabulary_exclusions" TO "service_role";

GRANT INSERT ON TABLE "public"."vocabulary_exclusions" TO "authenticated";

GRANT SELECT ON TABLE "public"."vocabulary_exclusions" TO "authenticated";

GRANT UPDATE ON TABLE "public"."vocabulary_exclusions" TO "authenticated";

GRANT DELETE ON TABLE "public"."vocabulary_exclusions" TO "authenticated";

CREATE POLICY "vocabulary_exclusion_owner" ON "public"."vocabulary_exclusions" AS PERMISSIVE FOR ALL TO "authenticated" USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND ((vocabulary_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.user_vocabulary v
  WHERE ((v.id = vocabulary_exclusions.vocabulary_id) AND (v.user_id = ( SELECT auth.uid() AS uid))))))));

ALTER TABLE "public"."vocabulary_exclusions" ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER guard_known_word_review_exclusion BEFORE DELETE OR UPDATE ON public.vocabulary_exclusions FOR EACH ROW EXECUTE FUNCTION public.guard_known_word_review_exclusion();

CREATE TRIGGER guard_korean_learning_contract BEFORE INSERT OR DELETE OR UPDATE ON public.vocabulary_exclusions FOR EACH ROW EXECUTE FUNCTION public.guard_korean_learning_contract();

CREATE TRIGGER lock_exclusion_owner BEFORE INSERT OR DELETE OR UPDATE ON public.vocabulary_exclusions FOR EACH STATEMENT EXECUTE FUNCTION public.lock_vocabulary_exclusion_owner();

REVOKE ALL ON TABLE "public"."vocabulary_with_exclusions" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT INSERT ON TABLE "public"."vocabulary_with_exclusions" TO "postgres";

GRANT SELECT ON TABLE "public"."vocabulary_with_exclusions" TO "postgres";

GRANT UPDATE ON TABLE "public"."vocabulary_with_exclusions" TO "postgres";

GRANT DELETE ON TABLE "public"."vocabulary_with_exclusions" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."vocabulary_with_exclusions" TO "postgres";

GRANT REFERENCES ON TABLE "public"."vocabulary_with_exclusions" TO "postgres";

GRANT TRIGGER ON TABLE "public"."vocabulary_with_exclusions" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."vocabulary_with_exclusions" TO "postgres";

GRANT INSERT ON TABLE "public"."vocabulary_with_exclusions" TO "service_role";

GRANT SELECT ON TABLE "public"."vocabulary_with_exclusions" TO "service_role";

GRANT UPDATE ON TABLE "public"."vocabulary_with_exclusions" TO "service_role";

GRANT DELETE ON TABLE "public"."vocabulary_with_exclusions" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."vocabulary_with_exclusions" TO "service_role";

GRANT REFERENCES ON TABLE "public"."vocabulary_with_exclusions" TO "service_role";

GRANT TRIGGER ON TABLE "public"."vocabulary_with_exclusions" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."vocabulary_with_exclusions" TO "service_role";

GRANT SELECT ON TABLE "public"."vocabulary_with_exclusions" TO "authenticated";

ALTER SEQUENCE "public"."reading_materials_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."reading_materials_id_seq" AS bigint INCREMENT 1 MINVALUE 1 MAXVALUE 9223372036854775807 START 1 CACHE 1 NO CYCLE;

REVOKE ALL ON SEQUENCE "public"."reading_materials_id_seq" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT SELECT ON SEQUENCE "public"."reading_materials_id_seq" TO "postgres";

GRANT UPDATE ON SEQUENCE "public"."reading_materials_id_seq" TO "postgres";

GRANT USAGE ON SEQUENCE "public"."reading_materials_id_seq" TO "postgres";

GRANT SELECT ON SEQUENCE "public"."reading_materials_id_seq" TO "anon";

GRANT UPDATE ON SEQUENCE "public"."reading_materials_id_seq" TO "anon";

GRANT USAGE ON SEQUENCE "public"."reading_materials_id_seq" TO "anon";

GRANT SELECT ON SEQUENCE "public"."reading_materials_id_seq" TO "authenticated";

GRANT UPDATE ON SEQUENCE "public"."reading_materials_id_seq" TO "authenticated";

GRANT USAGE ON SEQUENCE "public"."reading_materials_id_seq" TO "authenticated";

GRANT SELECT ON SEQUENCE "public"."reading_materials_id_seq" TO "service_role";

GRANT UPDATE ON SEQUENCE "public"."reading_materials_id_seq" TO "service_role";

GRANT USAGE ON SEQUENCE "public"."reading_materials_id_seq" TO "service_role";

ALTER SEQUENCE "public"."review_events_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."review_events_id_seq" AS bigint INCREMENT 1 MINVALUE 1 MAXVALUE 9223372036854775807 START 1 CACHE 1 NO CYCLE;

REVOKE ALL ON SEQUENCE "public"."review_events_id_seq" FROM PUBLIC, "dashboard_user", "authenticated", "anon", "service_role", "supabase_admin", "postgres", "supabase_auth_admin", "supabase_read_only_user", "supabase_privileged_role", "authenticator", "pg_database_owner";

GRANT SELECT ON SEQUENCE "public"."review_events_id_seq" TO "postgres";

GRANT UPDATE ON SEQUENCE "public"."review_events_id_seq" TO "postgres";

GRANT USAGE ON SEQUENCE "public"."review_events_id_seq" TO "postgres";

GRANT SELECT ON SEQUENCE "public"."review_events_id_seq" TO "anon";

GRANT UPDATE ON SEQUENCE "public"."review_events_id_seq" TO "anon";

GRANT USAGE ON SEQUENCE "public"."review_events_id_seq" TO "anon";

GRANT SELECT ON SEQUENCE "public"."review_events_id_seq" TO "authenticated";

GRANT UPDATE ON SEQUENCE "public"."review_events_id_seq" TO "authenticated";

GRANT USAGE ON SEQUENCE "public"."review_events_id_seq" TO "authenticated";

GRANT SELECT ON SEQUENCE "public"."review_events_id_seq" TO "service_role";

GRANT UPDATE ON SEQUENCE "public"."review_events_id_seq" TO "service_role";

GRANT USAGE ON SEQUENCE "public"."review_events_id_seq" TO "service_role";

-- Preserve the observed DDL event hooks (platform binary extensions omitted).

CREATE EVENT TRIGGER "issue_pg_graphql_access" ON ddl_command_end WHEN TAG IN ('CREATE FUNCTION') EXECUTE FUNCTION extensions.grant_pg_graphql_access();

ALTER EVENT TRIGGER "issue_pg_graphql_access" OWNER TO "supabase_admin";

CREATE EVENT TRIGGER "issue_graphql_placeholder" ON sql_drop WHEN TAG IN ('DROP EXTENSION') EXECUTE FUNCTION extensions.set_graphql_placeholder();

ALTER EVENT TRIGGER "issue_graphql_placeholder" OWNER TO "supabase_admin";

CREATE EVENT TRIGGER "pgrst_ddl_watch" ON ddl_command_end EXECUTE FUNCTION extensions.pgrst_ddl_watch();

ALTER EVENT TRIGGER "pgrst_ddl_watch" OWNER TO "supabase_admin";

CREATE EVENT TRIGGER "pgrst_drop_watch" ON sql_drop EXECUTE FUNCTION extensions.pgrst_drop_watch();

ALTER EVENT TRIGGER "pgrst_drop_watch" OWNER TO "supabase_admin";

CREATE EVENT TRIGGER "issue_pg_cron_access" ON ddl_command_end WHEN TAG IN ('CREATE EXTENSION') EXECUTE FUNCTION extensions.grant_pg_cron_access();

ALTER EVENT TRIGGER "issue_pg_cron_access" OWNER TO "supabase_admin";

CREATE EVENT TRIGGER "issue_pg_net_access" ON ddl_command_end WHEN TAG IN ('CREATE EXTENSION') EXECUTE FUNCTION extensions.grant_pg_net_access();

ALTER EVENT TRIGGER "issue_pg_net_access" OWNER TO "supabase_admin";

-- Synthetic local bootstrap: preserve the fingerprint QUERY, substitute only
-- its published scalar because local OIDs/catalog/platform differ. This is not
-- approval for republishing any production contract.
DO $local_pins$
DECLARE live_hash text; definition text;
BEGIN
 WITH RECURSIVE relevant_roles(oid) AS (
 SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN ('authenticated','anon','service_role')
 UNION SELECT m.roleid FROM pg_catalog.pg_auth_members m JOIN relevant_roles r ON r.oid=m.member
), tables AS (
 SELECT c.* FROM pg_catalog.pg_class c WHERE c.relnamespace='public'::pg_catalog.regnamespace
 AND c.relname IN ('user_vocabulary','vocabulary_contexts','user_known_words','vocabulary_exclusions','review_events','reading_materials','uploaded_pdfs','active_vocabulary','vocabulary_with_exclusions')
), objects AS (
 SELECT 'relation:'||c.relname AS key,pg_catalog.jsonb_build_array(c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.relacl,c.reloptions,c.relowner) AS val FROM tables c
 UNION ALL SELECT 'role:'||r.rolname,pg_catalog.jsonb_build_array(r.rolsuper,r.rolbypassrls,r.rolinherit) FROM pg_catalog.pg_roles r JOIN relevant_roles rr ON rr.oid=r.oid
 UNION ALL SELECT 'membership:'||m.member::text||':'||m.roleid::text,pg_catalog.to_jsonb(m) FROM pg_catalog.pg_auth_members m JOIN relevant_roles r ON r.oid=m.member
 UNION ALL SELECT 'schema:'||n.nspname,pg_catalog.jsonb_build_array(n.nspacl,n.nspowner) FROM pg_catalog.pg_namespace n WHERE n.nspname IN ('public','auth')
 UNION ALL SELECT 'constraint:'||c.relname||':'||x.conname,pg_catalog.to_jsonb(pg_catalog.pg_get_constraintdef(x.oid)) FROM pg_catalog.pg_constraint x JOIN tables c ON c.oid=x.conrelid
 UNION ALL SELECT 'index:'||c.relname||':'||i.indexrelid::text,pg_catalog.jsonb_build_array(pg_catalog.pg_get_indexdef(i.indexrelid),i.indisvalid,i.indisready) FROM pg_catalog.pg_index i JOIN tables c ON c.oid=i.indrelid
 UNION ALL SELECT 'policy:'||c.relname||':'||p.polname,pg_catalog.jsonb_build_array(p.polcmd,p.polpermissive,p.polroles,pg_catalog.pg_get_expr(p.polqual,p.polrelid),pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid)) FROM pg_catalog.pg_policy p JOIN tables c ON c.oid=p.polrelid
 UNION ALL SELECT 'trigger:'||c.relname||':'||t.tgname,pg_catalog.jsonb_build_array(pg_catalog.pg_get_triggerdef(t.oid),t.tgenabled) FROM pg_catalog.pg_trigger t JOIN tables c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal
 UNION ALL SELECT 'view:'||c.relname,pg_catalog.to_jsonb(pg_catalog.pg_get_viewdef(c.oid,true)) FROM tables c WHERE c.relkind='v'
 UNION ALL SELECT 'column:'||c.relname||':'||a.attname,pg_catalog.jsonb_build_array(a.atttypid,a.atttypmod,a.attnotnull,a.attacl,a.attidentity,a.attgenerated,pg_catalog.pg_get_expr(d.adbin,d.adrelid)) FROM pg_catalog.pg_attribute a JOIN tables c ON c.oid=a.attrelid LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attnum>0 AND NOT a.attisdropped
 UNION ALL SELECT 'function:'||p.oid::text,pg_catalog.jsonb_build_array(pg_catalog.pg_get_functiondef(p.oid),p.proacl,p.proowner) FROM pg_catalog.pg_proc p WHERE p.oid IN (
 SELECT pg_catalog.to_regprocedure(f.signature) FROM (VALUES ('public.save_vocabulary_context(jsonb,jsonb,uuid,text)'),('public.set_vocabulary_exclusion(text,text,uuid,boolean,uuid)'),('public.lock_vocabulary_exclusion_owner()'),('public.preserve_deleted_vocabulary_exclusion()'),('public.guard_excluded_vocabulary()'),('public.guard_excluded_review_event()'),('public.sync_vocabulary_exclusion_identity()'),('public.sync_known_word_review_exclusion()'),('public.guard_known_word_review_exclusion()')) f(signature)
 UNION SELECT dependency.oid FROM (VALUES ('public.save_vocabulary_context(jsonb,jsonb,uuid,text)'),('public.save_vocabulary_context_for(uuid,jsonb,jsonb,uuid,text)'),('public.viewer_replace_analysis(bigint,text,jsonb,text,jsonb,uuid)'),('public.viewer_undo_vocabulary_save(uuid,jsonb,uuid[])'),('public.classroom_save_vocabulary(uuid,bigint,integer,bigint,text,jsonb,jsonb,jsonb,jsonb,uuid,text)'),('library_private.protect_source_delete()'),('public.guard_source_passage_write()'),('public.library_book_preserve_metadata()'),('public.validate_source_passage()'),('public.protect_composer_source()')) f(signature)
 JOIN pg_catalog.pg_proc dependency ON dependency.oid::pg_catalog.regprocedure::text=f.signature
 UNION SELECT t.tgfoid FROM pg_catalog.pg_trigger t JOIN tables c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal)
) SELECT pg_catalog.md5(pg_catalog.jsonb_object_agg(key,val ORDER BY key)::text) FROM objects INTO live_hash;
 SELECT pg_catalog.pg_get_functiondef('public.learning_language_capabilities()'::regprocedure)
  INTO definition;
 IF position('47e0b3e8bb95bfdb705d279547f92b23' IN definition) = 0 THEN
  RAISE EXCEPTION 'm09_fixture_unexpected_capability_pin';
 END IF;
 EXECUTE replace(definition, '47e0b3e8bb95bfdb705d279547f92b23', live_hash);
 INSERT INTO fsrs_private.settings (singleton, enabled, activated_at, daily_new_limit)
  VALUES (true, false, '2026-10-06T04:00:00+09:00', 15);
 INSERT INTO fsrs_private.manual_save_settings (singleton, enabled) VALUES (true, true);
 INSERT INTO fsrs_private.admission_settings (singleton, enabled, starts_at)
  VALUES (true, false, '2026-10-06T04:00:00+09:00');
 INSERT INTO fsrs_private.activity_settings (singleton, enabled, starts_at)
  VALUES (true, false, '2026-10-06T04:00:00+09:00');
 UPDATE fsrs_private.settings SET enabled=true, contract_hash=fsrs_private.contract_hash();
 UPDATE fsrs_private.manual_save_settings SET contract_hash=fsrs_private.manual_contract_hash();
 UPDATE fsrs_private.admission_settings SET enabled=true, contract_hash=fsrs_private.admission_contract_hash();
 UPDATE fsrs_private.activity_settings SET enabled=true, profile_contract_hash=fsrs_private.activity_profile_hash();
 PERFORM fsrs_private.require_admission_integrity();
END $local_pins$;
COMMIT;


-- REFERENCE ONLY: captured platform metadata. The local PostgreSQL engine
-- provides builtins/system roles; do not execute these C/internal declarations.
/*
{
  "production_server_version": "17.6",
  "production_roles": [
    {
      "bypass_rls": false,
      "create_db": true,
      "create_role": true,
      "inherit": true,
      "name": "dashboard_user",
      "replication": true,
      "superuser": false
    },
    {
      "bypass_rls": false,
      "create_db": false,
      "create_role": false,
      "inherit": true,
      "name": "authenticated",
      "replication": false,
      "superuser": false
    },
    {
      "bypass_rls": false,
      "create_db": false,
      "create_role": false,
      "inherit": true,
      "name": "anon",
      "replication": false,
      "superuser": false
    },
    {
      "bypass_rls": true,
      "create_db": false,
      "create_role": false,
      "inherit": true,
      "name": "service_role",
      "replication": false,
      "superuser": false
    },
    {
      "bypass_rls": true,
      "create_db": true,
      "create_role": true,
      "inherit": true,
      "name": "supabase_admin",
      "replication": true,
      "superuser": true
    },
    {
      "bypass_rls": true,
      "create_db": true,
      "create_role": true,
      "inherit": true,
      "name": "postgres",
      "replication": true,
      "superuser": false
    },
    {
      "bypass_rls": false,
      "create_db": false,
      "create_role": true,
      "inherit": false,
      "name": "supabase_auth_admin",
      "replication": false,
      "superuser": false
    },
    {
      "bypass_rls": true,
      "create_db": false,
      "create_role": false,
      "inherit": true,
      "name": "supabase_read_only_user",
      "replication": false,
      "superuser": false
    },
    {
      "bypass_rls": false,
      "create_db": false,
      "create_role": false,
      "inherit": true,
      "name": "supabase_privileged_role",
      "replication": false,
      "superuser": false
    },
    {
      "bypass_rls": false,
      "create_db": false,
      "create_role": false,
      "inherit": true,
      "name": "pg_create_subscription",
      "replication": false,
      "superuser": false
    },
    {
      "bypass_rls": false,
      "create_db": false,
      "create_role": false,
      "inherit": true,
      "name": "pg_signal_backend",
      "replication": false,
      "superuser": false
    },
    {
      "bypass_rls": false,
      "create_db": false,
      "create_role": false,
      "inherit": true,
      "name": "pg_read_all_data",
      "replication": false,
      "superuser": false
    },
    {
      "bypass_rls": false,
      "create_db": false,
      "create_role": false,
      "inherit": true,
      "name": "pg_monitor",
      "replication": false,
      "superuser": false
    },
    {
      "bypass_rls": false,
      "create_db": false,
      "create_role": false,
      "inherit": false,
      "name": "authenticator",
      "replication": false,
      "superuser": false
    },
    {
      "bypass_rls": false,
      "create_db": false,
      "create_role": false,
      "inherit": true,
      "name": "pg_stat_scan_tables",
      "replication": false,
      "superuser": false
    },
    {
      "bypass_rls": false,
      "create_db": false,
      "create_role": false,
      "inherit": true,
      "name": "pg_read_all_stats",
      "replication": false,
      "superuser": false
    },
    {
      "bypass_rls": false,
      "create_db": false,
      "create_role": false,
      "inherit": true,
      "name": "pg_read_all_settings",
      "replication": false,
      "superuser": false
    }
  ],
  "production_memberships": [
    {
      "admin": false,
      "grantor": "supabase_admin",
      "inherit": true,
      "member": "postgres",
      "role": "supabase_privileged_role",
      "set": true
    },
    {
      "admin": true,
      "grantor": "supabase_admin",
      "inherit": true,
      "member": "postgres",
      "role": "pg_create_subscription",
      "set": true
    },
    {
      "admin": true,
      "grantor": "supabase_admin",
      "inherit": true,
      "member": "postgres",
      "role": "pg_signal_backend",
      "set": true
    },
    {
      "admin": true,
      "grantor": "supabase_admin",
      "inherit": true,
      "member": "postgres",
      "role": "pg_read_all_data",
      "set": true
    },
    {
      "admin": true,
      "grantor": "supabase_admin",
      "inherit": true,
      "member": "postgres",
      "role": "pg_monitor",
      "set": true
    },
    {
      "admin": true,
      "grantor": "supabase_admin",
      "inherit": true,
      "member": "postgres",
      "role": "authenticator",
      "set": true
    },
    {
      "admin": true,
      "grantor": "supabase_admin",
      "inherit": true,
      "member": "postgres",
      "role": "service_role",
      "set": true
    },
    {
      "admin": true,
      "grantor": "supabase_admin",
      "inherit": true,
      "member": "postgres",
      "role": "authenticated",
      "set": true
    },
    {
      "admin": true,
      "grantor": "supabase_admin",
      "inherit": true,
      "member": "postgres",
      "role": "anon",
      "set": true
    },
    {
      "admin": false,
      "grantor": "supabase_admin",
      "inherit": true,
      "member": "supabase_read_only_user",
      "role": "pg_monitor",
      "set": true
    },
    {
      "admin": false,
      "grantor": "supabase_admin",
      "inherit": true,
      "member": "supabase_read_only_user",
      "role": "pg_read_all_data",
      "set": true
    },
    {
      "admin": false,
      "grantor": "supabase_admin",
      "inherit": true,
      "member": "pg_monitor",
      "role": "pg_stat_scan_tables",
      "set": true
    },
    {
      "admin": false,
      "grantor": "supabase_admin",
      "inherit": true,
      "member": "pg_monitor",
      "role": "pg_read_all_stats",
      "set": true
    },
    {
      "admin": false,
      "grantor": "supabase_admin",
      "inherit": true,
      "member": "pg_monitor",
      "role": "pg_read_all_settings",
      "set": true
    },
    {
      "admin": false,
      "grantor": "supabase_admin",
      "inherit": false,
      "member": "authenticator",
      "role": "service_role",
      "set": true
    },
    {
      "admin": false,
      "grantor": "supabase_admin",
      "inherit": false,
      "member": "authenticator",
      "role": "authenticated",
      "set": true
    },
    {
      "admin": false,
      "grantor": "supabase_admin",
      "inherit": false,
      "member": "authenticator",
      "role": "anon",
      "set": true
    }
  ],
  "production_extension_memberships": [
    {
      "extension": "pg_stat_statements",
      "function": "extensions.pg_stat_statements_info()"
    },
    {
      "extension": "pg_stat_statements",
      "function": "extensions.pg_stat_statements(boolean)"
    },
    {
      "extension": "pg_stat_statements",
      "function": "extensions.pg_stat_statements_reset(oid,oid,bigint,boolean)"
    },
    {
      "extension": "uuid-ossp",
      "function": "extensions.uuid_nil()"
    },
    {
      "extension": "uuid-ossp",
      "function": "extensions.uuid_ns_dns()"
    },
    {
      "extension": "uuid-ossp",
      "function": "extensions.uuid_ns_url()"
    },
    {
      "extension": "uuid-ossp",
      "function": "extensions.uuid_ns_oid()"
    },
    {
      "extension": "uuid-ossp",
      "function": "extensions.uuid_ns_x500()"
    },
    {
      "extension": "uuid-ossp",
      "function": "extensions.uuid_generate_v1()"
    },
    {
      "extension": "uuid-ossp",
      "function": "extensions.uuid_generate_v1mc()"
    },
    {
      "extension": "uuid-ossp",
      "function": "extensions.uuid_generate_v3(uuid,text)"
    },
    {
      "extension": "uuid-ossp",
      "function": "extensions.uuid_generate_v4()"
    },
    {
      "extension": "uuid-ossp",
      "function": "extensions.uuid_generate_v5(uuid,text)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.digest(text,text)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.digest(bytea,text)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.hmac(text,text,text)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.hmac(bytea,bytea,text)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.crypt(text,text)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.gen_salt(text)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.gen_salt(text,integer)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.encrypt(bytea,bytea,text)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.decrypt(bytea,bytea,text)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.encrypt_iv(bytea,bytea,bytea,text)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.decrypt_iv(bytea,bytea,bytea,text)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.gen_random_bytes(integer)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.gen_random_uuid()"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.pgp_sym_encrypt(text,text)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.pgp_sym_encrypt_bytea(bytea,text)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.pgp_sym_encrypt(text,text,text)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.pgp_sym_encrypt_bytea(bytea,text,text)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.pgp_sym_decrypt(bytea,text)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.pgp_sym_decrypt_bytea(bytea,text)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.pgp_sym_decrypt(bytea,text,text)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.pgp_sym_decrypt_bytea(bytea,text,text)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.pgp_pub_encrypt(text,bytea)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.pgp_pub_encrypt_bytea(bytea,bytea)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.pgp_pub_encrypt(text,bytea,text)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.pgp_pub_encrypt_bytea(bytea,bytea,text)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.pgp_pub_decrypt(bytea,bytea)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.pgp_pub_decrypt_bytea(bytea,bytea)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.pgp_pub_decrypt(bytea,bytea,text)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.pgp_pub_decrypt_bytea(bytea,bytea,text)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.pgp_pub_decrypt(bytea,bytea,text,text)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.pgp_pub_decrypt_bytea(bytea,bytea,text,text)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.pgp_key_id(bytea)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.armor(bytea)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.armor(bytea,text[],text[])"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.dearmor(text)"
    },
    {
      "extension": "pgcrypto",
      "function": "extensions.pgp_armor_headers(text)"
    }
  ],
  "production_fingerprinted_builtins": [
    {
      "acl": null,
      "definition": "CREATE OR REPLACE FUNCTION pg_catalog.texteq(text, text)\n RETURNS boolean\n LANGUAGE internal\n IMMUTABLE PARALLEL SAFE STRICT LEAKPROOF\nAS $function$texteq$function$\n",
      "identity_arguments": "text, text",
      "leakproof": true,
      "md5": "c0a12881799fef79f18c0bf960f118a3",
      "name": "texteq",
      "owner": "supabase_admin",
      "parallel": "s",
      "schema": "pg_catalog",
      "search_path": null,
      "security_definer": false,
      "strict": true,
      "volatility": "i"
    },
    {
      "acl": null,
      "definition": "CREATE OR REPLACE FUNCTION pg_catalog.now()\n RETURNS timestamp with time zone\n LANGUAGE internal\n STABLE PARALLEL SAFE STRICT\nAS $function$now$function$\n",
      "identity_arguments": "",
      "leakproof": false,
      "md5": "97bc592b27a9ada2d9a4bb418ed0ebed",
      "name": "now",
      "owner": "supabase_admin",
      "parallel": "s",
      "schema": "pg_catalog",
      "search_path": null,
      "security_definer": false,
      "strict": true,
      "volatility": "s"
    },
    {
      "acl": null,
      "definition": "CREATE OR REPLACE FUNCTION pg_catalog.\"RI_FKey_check_ins\"()\n RETURNS trigger\n LANGUAGE internal\n PARALLEL SAFE STRICT\nAS $function$RI_FKey_check_ins$function$\n",
      "identity_arguments": "",
      "leakproof": false,
      "md5": "0202d6016df4e8a81b0062a40c6023ec",
      "name": "RI_FKey_check_ins",
      "owner": "supabase_admin",
      "parallel": "s",
      "schema": "pg_catalog",
      "search_path": null,
      "security_definer": false,
      "strict": true,
      "volatility": "v"
    },
    {
      "acl": null,
      "definition": "CREATE OR REPLACE FUNCTION pg_catalog.\"RI_FKey_check_upd\"()\n RETURNS trigger\n LANGUAGE internal\n PARALLEL SAFE STRICT\nAS $function$RI_FKey_check_upd$function$\n",
      "identity_arguments": "",
      "leakproof": false,
      "md5": "b95e5133ec61e5d6ef06f767aa556993",
      "name": "RI_FKey_check_upd",
      "owner": "supabase_admin",
      "parallel": "s",
      "schema": "pg_catalog",
      "search_path": null,
      "security_definer": false,
      "strict": true,
      "volatility": "v"
    },
    {
      "acl": null,
      "definition": "CREATE OR REPLACE FUNCTION pg_catalog.\"RI_FKey_cascade_del\"()\n RETURNS trigger\n LANGUAGE internal\n PARALLEL SAFE STRICT\nAS $function$RI_FKey_cascade_del$function$\n",
      "identity_arguments": "",
      "leakproof": false,
      "md5": "2f31bc6a0634a61665919631336df3a0",
      "name": "RI_FKey_cascade_del",
      "owner": "supabase_admin",
      "parallel": "s",
      "schema": "pg_catalog",
      "search_path": null,
      "security_definer": false,
      "strict": true,
      "volatility": "v"
    },
    {
      "acl": null,
      "definition": "CREATE OR REPLACE FUNCTION pg_catalog.\"RI_FKey_setnull_del\"()\n RETURNS trigger\n LANGUAGE internal\n PARALLEL SAFE STRICT\nAS $function$RI_FKey_setnull_del$function$\n",
      "identity_arguments": "",
      "leakproof": false,
      "md5": "b1cc723bfa4e6e7daf3f769789a148ab",
      "name": "RI_FKey_setnull_del",
      "owner": "supabase_admin",
      "parallel": "s",
      "schema": "pg_catalog",
      "search_path": null,
      "security_definer": false,
      "strict": true,
      "volatility": "v"
    },
    {
      "acl": null,
      "definition": "CREATE OR REPLACE FUNCTION pg_catalog.\"RI_FKey_noaction_upd\"()\n RETURNS trigger\n LANGUAGE internal\n PARALLEL SAFE STRICT\nAS $function$RI_FKey_noaction_upd$function$\n",
      "identity_arguments": "",
      "leakproof": false,
      "md5": "5909814be8c209a36e3f00dad2047ec7",
      "name": "RI_FKey_noaction_upd",
      "owner": "supabase_admin",
      "parallel": "s",
      "schema": "pg_catalog",
      "search_path": null,
      "security_definer": false,
      "strict": true,
      "volatility": "v"
    },
    {
      "acl": null,
      "definition": "CREATE OR REPLACE FUNCTION pg_catalog.uuid_in(cstring)\n RETURNS uuid\n LANGUAGE internal\n IMMUTABLE PARALLEL SAFE STRICT\nAS $function$uuid_in$function$\n",
      "identity_arguments": "cstring",
      "leakproof": false,
      "md5": "2514a1b913f278e2fc2c0b9e38e5e2f8",
      "name": "uuid_in",
      "owner": "supabase_admin",
      "parallel": "s",
      "schema": "pg_catalog",
      "search_path": null,
      "security_definer": false,
      "strict": true,
      "volatility": "i"
    },
    {
      "acl": null,
      "definition": "CREATE OR REPLACE FUNCTION pg_catalog.uuid_eq(uuid, uuid)\n RETURNS boolean\n LANGUAGE internal\n IMMUTABLE PARALLEL SAFE STRICT LEAKPROOF\nAS $function$uuid_eq$function$\n",
      "identity_arguments": "uuid, uuid",
      "leakproof": true,
      "md5": "449f471a03ad272f46b6c7a0d0977e9a",
      "name": "uuid_eq",
      "owner": "supabase_admin",
      "parallel": "s",
      "schema": "pg_catalog",
      "search_path": null,
      "security_definer": false,
      "strict": true,
      "volatility": "i"
    },
    {
      "acl": null,
      "definition": "CREATE OR REPLACE FUNCTION pg_catalog.jsonb_object_field_text(from_json jsonb, field_name text)\n RETURNS text\n LANGUAGE internal\n IMMUTABLE PARALLEL SAFE STRICT\nAS $function$jsonb_object_field_text$function$\n",
      "identity_arguments": "from_json jsonb, field_name text",
      "leakproof": false,
      "md5": "714a8f318111c19d56969f1699343963",
      "name": "jsonb_object_field_text",
      "owner": "supabase_admin",
      "parallel": "s",
      "schema": "pg_catalog",
      "search_path": null,
      "security_definer": false,
      "strict": true,
      "volatility": "i"
    },
    {
      "acl": null,
      "definition": "CREATE OR REPLACE FUNCTION pg_catalog.current_setting(text, boolean)\n RETURNS text\n LANGUAGE internal\n STABLE PARALLEL SAFE STRICT\nAS $function$show_config_by_name_missing_ok$function$\n",
      "identity_arguments": "text, boolean",
      "leakproof": false,
      "md5": "4348de2f4ad02b7ff16c7fd393ea533c",
      "name": "current_setting",
      "owner": "supabase_admin",
      "parallel": "s",
      "schema": "pg_catalog",
      "search_path": null,
      "security_definer": false,
      "strict": true,
      "volatility": "s"
    },
    {
      "acl": null,
      "definition": "CREATE OR REPLACE FUNCTION pg_catalog.pg_event_trigger_dropped_objects(OUT classid oid, OUT objid oid, OUT objsubid integer, OUT original boolean, OUT normal boolean, OUT is_temporary boolean, OUT object_type text, OUT schema_name text, OUT object_name text, OUT object_identity text, OUT address_names text[], OUT address_args text[])\n RETURNS SETOF record\n LANGUAGE internal\n STABLE PARALLEL RESTRICTED STRICT COST 10 ROWS 100\nAS $function$pg_event_trigger_dropped_objects$function$\n",
      "identity_arguments": "OUT classid oid, OUT objid oid, OUT objsubid integer, OUT original boolean, OUT normal boolean, OUT is_temporary boolean, OUT object_type text, OUT schema_name text, OUT object_name text, OUT object_identity text, OUT address_names text[], OUT address_args text[]",
      "leakproof": false,
      "md5": "e6092d646f6e984a244ee64cf6c2cc20",
      "name": "pg_event_trigger_dropped_objects",
      "owner": "supabase_admin",
      "parallel": "r",
      "schema": "pg_catalog",
      "search_path": null,
      "security_definer": false,
      "strict": true,
      "volatility": "s"
    },
    {
      "acl": null,
      "definition": "CREATE OR REPLACE FUNCTION pg_catalog.jsonb_in(cstring)\n RETURNS jsonb\n LANGUAGE internal\n IMMUTABLE PARALLEL SAFE STRICT\nAS $function$jsonb_in$function$\n",
      "identity_arguments": "cstring",
      "leakproof": false,
      "md5": "47a0ae06e0345b76fe5673ef8944c676",
      "name": "jsonb_in",
      "owner": "supabase_admin",
      "parallel": "s",
      "schema": "pg_catalog",
      "search_path": null,
      "security_definer": false,
      "strict": true,
      "volatility": "i"
    },
    {
      "acl": null,
      "definition": "CREATE OR REPLACE FUNCTION pg_catalog.pg_event_trigger_ddl_commands(OUT classid oid, OUT objid oid, OUT objsubid integer, OUT command_tag text, OUT object_type text, OUT schema_name text, OUT object_identity text, OUT in_extension boolean, OUT command pg_ddl_command)\n RETURNS SETOF record\n LANGUAGE internal\n STABLE PARALLEL RESTRICTED STRICT COST 10 ROWS 100\nAS $function$pg_event_trigger_ddl_commands$function$\n",
      "identity_arguments": "OUT classid oid, OUT objid oid, OUT objsubid integer, OUT command_tag text, OUT object_type text, OUT schema_name text, OUT object_identity text, OUT in_extension boolean, OUT command pg_ddl_command",
      "leakproof": false,
      "md5": "94249d8d755439e46455b026acb9ae27",
      "name": "pg_event_trigger_ddl_commands",
      "owner": "supabase_admin",
      "parallel": "r",
      "schema": "pg_catalog",
      "search_path": null,
      "security_definer": false,
      "strict": true,
      "volatility": "s"
    }
  ]
}
*/
