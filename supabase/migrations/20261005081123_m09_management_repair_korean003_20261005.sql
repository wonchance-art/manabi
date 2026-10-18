-- ROUND004 protected application. Original candidate body is byte-exact.
-- Operator execution only; no normal authenticated verification is asserted.
BEGIN;
-- BEGIN REVIEWED 022 PRE-GUARD korean003-protected
SET LOCAL search_path='';
DO $platform022$ DECLARE actual jsonb; BEGIN
 SELECT q.* INTO actual FROM (WITH functions AS (SELECT 'extensions.grant_pg_cron_access()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'procost',p.procost,'prokind',p.prokind,'prorows',p.prorows,'support',p.prosupport::pg_catalog.regproc::text,'language',l.lanname,'proconfig',p.proconfig,'proretset',p.proretset,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proargnames',p.proargnames,'proargtypes',p.proargtypes::text,'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provariadic',p.provariadic::pg_catalog.regtype::text,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'pronargdefaults',p.pronargdefaults,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('extensions.grant_pg_cron_access()') UNION ALL SELECT 'extensions.grant_pg_graphql_access()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'procost',p.procost,'prokind',p.prokind,'prorows',p.prorows,'support',p.prosupport::pg_catalog.regproc::text,'language',l.lanname,'proconfig',p.proconfig,'proretset',p.proretset,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proargnames',p.proargnames,'proargtypes',p.proargtypes::text,'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provariadic',p.provariadic::pg_catalog.regtype::text,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'pronargdefaults',p.pronargdefaults,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('extensions.grant_pg_graphql_access()') UNION ALL SELECT 'extensions.grant_pg_net_access()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'procost',p.procost,'prokind',p.prokind,'prorows',p.prorows,'support',p.prosupport::pg_catalog.regproc::text,'language',l.lanname,'proconfig',p.proconfig,'proretset',p.proretset,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proargnames',p.proargnames,'proargtypes',p.proargtypes::text,'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provariadic',p.provariadic::pg_catalog.regtype::text,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'pronargdefaults',p.pronargdefaults,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('extensions.grant_pg_net_access()') UNION ALL SELECT 'extensions.pgrst_ddl_watch()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'procost',p.procost,'prokind',p.prokind,'prorows',p.prorows,'support',p.prosupport::pg_catalog.regproc::text,'language',l.lanname,'proconfig',p.proconfig,'proretset',p.proretset,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proargnames',p.proargnames,'proargtypes',p.proargtypes::text,'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provariadic',p.provariadic::pg_catalog.regtype::text,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'pronargdefaults',p.pronargdefaults,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('extensions.pgrst_ddl_watch()') UNION ALL SELECT 'extensions.pgrst_drop_watch()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'procost',p.procost,'prokind',p.prokind,'prorows',p.prorows,'support',p.prosupport::pg_catalog.regproc::text,'language',l.lanname,'proconfig',p.proconfig,'proretset',p.proretset,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proargnames',p.proargnames,'proargtypes',p.proargtypes::text,'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provariadic',p.provariadic::pg_catalog.regtype::text,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'pronargdefaults',p.pronargdefaults,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('extensions.pgrst_drop_watch()') UNION ALL SELECT 'extensions.set_graphql_placeholder()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'procost',p.procost,'prokind',p.prokind,'prorows',p.prorows,'support',p.prosupport::pg_catalog.regproc::text,'language',l.lanname,'proconfig',p.proconfig,'proretset',p.proretset,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proargnames',p.proargnames,'proargtypes',p.proargtypes::text,'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provariadic',p.provariadic::pg_catalog.regtype::text,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'pronargdefaults',p.pronargdefaults,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('extensions.set_graphql_placeholder()') UNION ALL SELECT 'graphql_public.graphql(text,text,jsonb,jsonb)' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'prokind',p.prokind,'language',l.lanname,'proconfig',p.proconfig,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('graphql_public.graphql(text,text,jsonb,jsonb)') UNION ALL SELECT 'pg_event_trigger_ddl_commands()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'prokind',p.prokind,'language',l.lanname,'proconfig',p.proconfig,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e')) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('pg_event_trigger_ddl_commands()') UNION ALL SELECT 'pg_event_trigger_dropped_objects()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'prokind',p.prokind,'language',l.lanname,'proconfig',p.proconfig,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e')) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('pg_event_trigger_dropped_objects()') UNION ALL SELECT 'auth.uid()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'procost',p.procost,'prokind',p.prokind,'prorows',p.prorows,'support',p.prosupport::pg_catalog.regproc::text,'language',l.lanname,'proconfig',p.proconfig,'proretset',p.proretset,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proargnames',p.proargnames,'proargtypes',p.proargtypes::text,'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provariadic',p.provariadic::pg_catalog.regtype::text,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'pronargdefaults',p.pronargdefaults,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('auth.uid()') UNION ALL SELECT 'public.is_admin()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'procost',p.procost,'prokind',p.prokind,'prorows',p.prorows,'support',p.prosupport::pg_catalog.regproc::text,'language',l.lanname,'proconfig',p.proconfig,'proretset',p.proretset,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proargnames',p.proargnames,'proargtypes',p.proargtypes::text,'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provariadic',p.provariadic::pg_catalog.regtype::text,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'pronargdefaults',p.pronargdefaults,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('public.is_admin()') UNION ALL SELECT 'public.enforce_role_change_by_admin()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'procost',p.procost,'prokind',p.prokind,'prorows',p.prorows,'support',p.prosupport::pg_catalog.regproc::text,'language',l.lanname,'proconfig',p.proconfig,'proretset',p.proretset,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proargnames',p.proargnames,'proargtypes',p.proargtypes::text,'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provariadic',p.provariadic::pg_catalog.regtype::text,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'pronargdefaults',p.pronargdefaults,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('public.enforce_role_change_by_admin()')) SELECT jsonb_build_object('hooks',(SELECT jsonb_agg(jsonb_build_object('name',e.evtname,'tags',e.evttags,'event',e.evtevent,'owner',pg_catalog.pg_get_userbyid(e.evtowner),'enabled',e.evtenabled,'function',e.evtfoid::pg_catalog.regprocedure::text) ORDER BY e.evtname) FROM pg_catalog.pg_event_trigger e),'functions',(SELECT jsonb_object_agg(key,value ORDER BY key) FROM functions),'schemas',(SELECT jsonb_agg(jsonb_build_object('acl',n.nspacl::text,'owner',pg_catalog.pg_get_userbyid(n.nspowner),'schema',n.nspname) ORDER BY n.nspname) FROM pg_catalog.pg_namespace n WHERE n.nspname IN ('auth','extensions','public')),'extensions',(SELECT coalesce(jsonb_agg(e.extname ORDER BY e.extname),'[]'::jsonb) FROM pg_catalog.pg_extension e WHERE e.extname IN ('pg_graphql','pg_net','pg_cron')),'dormant_targets',(SELECT coalesce(jsonb_agg(p.oid::pg_catalog.regprocedure::text ORDER BY p.oid::pg_catalog.regprocedure::text),'[]'::jsonb) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='graphql' AND p.proname='resolve' OR n.nspname='net' AND p.proname IN ('http_get','http_post'))) ) q;
 IF actual IS DISTINCT FROM $platform_expected${"hooks":[{"name":"issue_graphql_placeholder","tags":["DROP EXTENSION"],"event":"sql_drop","owner":"supabase_admin","enabled":"O","function":"extensions.set_graphql_placeholder()"},{"name":"issue_pg_cron_access","tags":["CREATE EXTENSION"],"event":"ddl_command_end","owner":"supabase_admin","enabled":"O","function":"extensions.grant_pg_cron_access()"},{"name":"issue_pg_graphql_access","tags":["CREATE FUNCTION"],"event":"ddl_command_end","owner":"supabase_admin","enabled":"O","function":"extensions.grant_pg_graphql_access()"},{"name":"issue_pg_net_access","tags":["CREATE EXTENSION"],"event":"ddl_command_end","owner":"supabase_admin","enabled":"O","function":"extensions.grant_pg_net_access()"},{"name":"pgrst_ddl_watch","tags":null,"event":"ddl_command_end","owner":"supabase_admin","enabled":"O","function":"extensions.pgrst_ddl_watch()"},{"name":"pgrst_drop_watch","tags":null,"event":"sql_drop","owner":"supabase_admin","enabled":"O","function":"extensions.pgrst_drop_watch()"}],"functions":{"extensions.grant_pg_cron_access()":{"acl":"{=X/supabase_admin,supabase_admin=X*/supabase_admin,dashboard_user=X/supabase_admin}","owner":"supabase_admin","schema":"extensions","procost":100,"prokind":"f","prorows":0,"support":"-","language":"plpgsql","proconfig":["search_path=\"\""],"proretset":false,"prosecdef":false,"prosrc_md5":"3a3917aad6ddd66182bf45b7490c3029","proargnames":null,"proargtypes":"","proisstrict":false,"proparallel":"u","provariadic":"-","provolatile":"v","return_type":"event_trigger","proleakproof":false,"pronargdefaults":0,"extension_membership":null,"definition":"CREATE OR REPLACE FUNCTION extensions.grant_pg_cron_access()\n RETURNS event_trigger\n LANGUAGE plpgsql\n SET search_path TO ''\nAS $function$\nBEGIN\n  IF EXISTS (\n    SELECT\n    FROM pg_event_trigger_ddl_commands() AS ev\n    JOIN pg_extension AS ext\n    ON ev.objid = ext.oid\n    WHERE ext.extname = 'pg_cron'\n  )\n  THEN\n    grant usage on schema cron to postgres with grant option;\n\n    alter default privileges in schema cron grant all on tables to postgres with grant option;\n    alter default privileges in schema cron grant all on functions to postgres with grant option;\n    alter default privileges in schema cron grant all on sequences to postgres with grant option;\n\n    alter default privileges for user supabase_admin in schema cron grant all\n        on sequences to postgres with grant option;\n    alter default privileges for user supabase_admin in schema cron grant all\n        on tables to postgres with grant option;\n    alter default privileges for user supabase_admin in schema cron grant all\n        on functions to postgres with grant option;\n\n    grant all privileges on all tables in schema cron to postgres with grant option;\n    revoke all on table cron.job from postgres;\n    grant select on table cron.job to postgres with grant option;\n    revoke trigger on cron.job_run_details from postgres;\n  END IF;\nEND;\n$function$\n"},"extensions.grant_pg_graphql_access()":{"acl":"{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X*/supabase_admin}","owner":"supabase_admin","schema":"extensions","procost":100,"prokind":"f","prorows":0,"support":"-","language":"plpgsql","proconfig":["search_path=\"\""],"proretset":false,"prosecdef":false,"prosrc_md5":"dd3f3e2bb94cff45ef24b9cecb6af1c8","proargnames":null,"proargtypes":"","proisstrict":false,"proparallel":"u","provariadic":"-","provolatile":"v","return_type":"event_trigger","proleakproof":false,"pronargdefaults":0,"extension_membership":null,"definition":"CREATE OR REPLACE FUNCTION extensions.grant_pg_graphql_access()\n RETURNS event_trigger\n LANGUAGE plpgsql\n SET search_path TO ''\nAS $function$\nbegin\n    if not exists (\n        select 1\n        from pg_catalog.pg_event_trigger_ddl_commands() ev\n        join pg_catalog.pg_extension e on ev.objid = e.oid\n        where e.extname = 'pg_graphql'\n    ) then\n        return;\n    end if;\n\n    drop function if exists graphql_public.graphql;\n    create or replace function graphql_public.graphql(\n        \"operationName\" text default null,\n        query text default null,\n        variables jsonb default null,\n        extensions jsonb default null\n    )\n        returns jsonb\n        language sql\n    as $$\n        select graphql.resolve(\n            query := query,\n            variables := coalesce(variables, '{}'),\n            \"operationName\" := \"operationName\",\n            extensions := extensions\n        );\n    $$;\n\n    -- Attach the wrapper to the extension so DROP EXTENSION cascades to it,\n    -- which in turn triggers set_graphql_placeholder to reinstall the \"not enabled\" stub.\n    alter extension pg_graphql add function graphql_public.graphql(text, text, jsonb, jsonb);\n\n    grant usage on schema graphql to postgres, anon, authenticated, service_role;\n    grant execute on function graphql.resolve to postgres, anon, authenticated, service_role;\n    grant usage on schema graphql to postgres with grant option;\n    grant usage on schema graphql_public to postgres with grant option;\nend;\n$function$\n"},"extensions.grant_pg_net_access()":{"acl":"{=X/supabase_admin,supabase_admin=X*/supabase_admin,dashboard_user=X/supabase_admin}","owner":"supabase_admin","schema":"extensions","procost":100,"prokind":"f","prorows":0,"support":"-","language":"plpgsql","proconfig":["search_path=\"\""],"proretset":false,"prosecdef":false,"prosrc_md5":"2ee4e6920eeba3068bcfa838105352e2","proargnames":null,"proargtypes":"","proisstrict":false,"proparallel":"u","provariadic":"-","provolatile":"v","return_type":"event_trigger","proleakproof":false,"pronargdefaults":0,"extension_membership":null,"definition":"CREATE OR REPLACE FUNCTION extensions.grant_pg_net_access()\n RETURNS event_trigger\n LANGUAGE plpgsql\n SET search_path TO ''\nAS $function$\nBEGIN\n  IF EXISTS (\n    SELECT 1\n    FROM pg_event_trigger_ddl_commands() AS ev\n    JOIN pg_extension AS ext\n    ON ev.objid = ext.oid\n    WHERE ext.extname = 'pg_net'\n  )\n  THEN\n    IF NOT EXISTS (\n      SELECT 1\n      FROM pg_roles\n      WHERE rolname = 'supabase_functions_admin'\n    )\n    THEN\n      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;\n    END IF;\n\n    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;\n\n    IF EXISTS (\n      SELECT FROM pg_extension\n      WHERE extname = 'pg_net'\n      -- all versions in use on existing projects as of 2025-02-20\n      -- version 0.12.0 onwards don't need these applied\n      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8.0', '0.10.0', '0.11.0')\n    ) THEN\n      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;\n      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;\n\n      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;\n      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;\n\n      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;\n      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;\n\n      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;\n      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;\n    END IF;\n  END IF;\nEND;\n$function$\n"},"extensions.pgrst_ddl_watch()":{"acl":"{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X*/supabase_admin}","owner":"supabase_admin","schema":"extensions","procost":100,"prokind":"f","prorows":0,"support":"-","language":"plpgsql","proconfig":["search_path=\"\""],"proretset":false,"prosecdef":false,"prosrc_md5":"7f27b8118fea5c88b0164331292859e3","proargnames":null,"proargtypes":"","proisstrict":false,"proparallel":"u","provariadic":"-","provolatile":"v","return_type":"event_trigger","proleakproof":false,"pronargdefaults":0,"extension_membership":null,"definition":"CREATE OR REPLACE FUNCTION extensions.pgrst_ddl_watch()\n RETURNS event_trigger\n LANGUAGE plpgsql\n SET search_path TO ''\nAS $function$\nDECLARE\n  cmd record;\nBEGIN\n  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()\n  LOOP\n    IF cmd.command_tag IN (\n      'CREATE SCHEMA', 'ALTER SCHEMA'\n    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'\n    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'\n    , 'CREATE VIEW', 'ALTER VIEW'\n    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'\n    , 'CREATE FUNCTION', 'ALTER FUNCTION'\n    , 'CREATE TRIGGER'\n    , 'CREATE TYPE', 'ALTER TYPE'\n    , 'CREATE RULE'\n    , 'COMMENT'\n    )\n    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp\n    AND cmd.schema_name is distinct from 'pg_temp'\n    THEN\n      NOTIFY pgrst, 'reload schema';\n    END IF;\n  END LOOP;\nEND; $function$\n"},"extensions.pgrst_drop_watch()":{"acl":"{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X*/supabase_admin}","owner":"supabase_admin","schema":"extensions","procost":100,"prokind":"f","prorows":0,"support":"-","language":"plpgsql","proconfig":["search_path=\"\""],"proretset":false,"prosecdef":false,"prosrc_md5":"bc09cc3003d66f91844af4cb05e203b7","proargnames":null,"proargtypes":"","proisstrict":false,"proparallel":"u","provariadic":"-","provolatile":"v","return_type":"event_trigger","proleakproof":false,"pronargdefaults":0,"extension_membership":null,"definition":"CREATE OR REPLACE FUNCTION extensions.pgrst_drop_watch()\n RETURNS event_trigger\n LANGUAGE plpgsql\n SET search_path TO ''\nAS $function$\nDECLARE\n  obj record;\nBEGIN\n  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()\n  LOOP\n    IF obj.object_type IN (\n      'schema'\n    , 'table'\n    , 'foreign table'\n    , 'view'\n    , 'materialized view'\n    , 'function'\n    , 'trigger'\n    , 'type'\n    , 'rule'\n    )\n    AND obj.is_temporary IS false -- no pg_temp objects\n    THEN\n      NOTIFY pgrst, 'reload schema';\n    END IF;\n  END LOOP;\nEND; $function$\n"},"extensions.set_graphql_placeholder()":{"acl":"{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X*/supabase_admin}","owner":"supabase_admin","schema":"extensions","procost":100,"prokind":"f","prorows":0,"support":"-","language":"plpgsql","proconfig":["search_path=\"\""],"proretset":false,"prosecdef":false,"prosrc_md5":"a2bc2d00b2cc2f5e8d2d6b8d73e2c360","proargnames":null,"proargtypes":"","proisstrict":false,"proparallel":"u","provariadic":"-","provolatile":"v","return_type":"event_trigger","proleakproof":false,"pronargdefaults":0,"extension_membership":null,"definition":"CREATE OR REPLACE FUNCTION extensions.set_graphql_placeholder()\n RETURNS event_trigger\n LANGUAGE plpgsql\n SET search_path TO ''\nAS $function$\n    DECLARE\n    graphql_is_dropped bool;\n    BEGIN\n    graphql_is_dropped = (\n        SELECT ev.schema_name = 'graphql_public'\n        FROM pg_event_trigger_dropped_objects() AS ev\n        WHERE ev.schema_name = 'graphql_public'\n    );\n\n    IF graphql_is_dropped\n    THEN\n        create or replace function graphql_public.graphql(\n            \"operationName\" text default null,\n            query text default null,\n            variables jsonb default null,\n            extensions jsonb default null\n        )\n            returns jsonb\n            language plpgsql\n            set search_path to ''\n        as $$\n            DECLARE\n                server_version float;\n            BEGIN\n                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);\n\n                IF server_version >= 14 THEN\n                    RETURN jsonb_build_object(\n                        'errors', jsonb_build_array(\n                            jsonb_build_object(\n                                'message', 'pg_graphql extension is not enabled.'\n                            )\n                        )\n                    );\n                ELSE\n                    RETURN jsonb_build_object(\n                        'errors', jsonb_build_array(\n                            jsonb_build_object(\n                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'\n                            )\n                        )\n                    );\n                END IF;\n            END;\n        $$;\n    END IF;\n\n    END;\n$function$\n"},"graphql_public.graphql(text,text,jsonb,jsonb)":{"acl":"{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}","owner":"supabase_admin","schema":"graphql_public","prokind":"f","language":"plpgsql","proconfig":null,"prosecdef":false,"prosrc_md5":"4b822d188772a248642fbe43342f9f17","proisstrict":false,"proparallel":"u","provolatile":"v","return_type":"jsonb","proleakproof":false,"extension_membership":null,"definition":"CREATE OR REPLACE FUNCTION graphql_public.graphql(\"operationName\" text DEFAULT NULL::text, query text DEFAULT NULL::text, variables jsonb DEFAULT NULL::jsonb, extensions jsonb DEFAULT NULL::jsonb)\n RETURNS jsonb\n LANGUAGE plpgsql\nAS $function$\n            DECLARE\n                server_version float;\n            BEGIN\n                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);\n\n                IF server_version >= 14 THEN\n                    RETURN jsonb_build_object(\n                        'errors', jsonb_build_array(\n                            jsonb_build_object(\n                                'message', 'pg_graphql extension is not enabled.'\n                            )\n                        )\n                    );\n                ELSE\n                    RETURN jsonb_build_object(\n                        'errors', jsonb_build_array(\n                            jsonb_build_object(\n                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'\n                            )\n                        )\n                    );\n                END IF;\n            END;\n        $function$\n"},"pg_event_trigger_ddl_commands()":{"acl":null,"owner":"supabase_admin","schema":"pg_catalog","prokind":"f","language":"internal","proconfig":null,"prosecdef":false,"prosrc_md5":"94249d8d755439e46455b026acb9ae27","proisstrict":true,"proparallel":"r","provolatile":"s","return_type":"record","proleakproof":false,"extension_membership":null},"pg_event_trigger_dropped_objects()":{"acl":null,"owner":"supabase_admin","schema":"pg_catalog","prokind":"f","language":"internal","proconfig":null,"prosecdef":false,"prosrc_md5":"e6092d646f6e984a244ee64cf6c2cc20","proisstrict":true,"proparallel":"r","provolatile":"s","return_type":"record","proleakproof":false,"extension_membership":null},"auth.uid()":{"acl":"{=X/supabase_auth_admin,supabase_auth_admin=X/supabase_auth_admin,dashboard_user=X/supabase_auth_admin}","owner":"supabase_auth_admin","schema":"auth","procost":100,"prokind":"f","prorows":0,"support":"-","language":"sql","proconfig":null,"proretset":false,"prosecdef":false,"prosrc_md5":"cdef18c69c4f4cbbced2eaf81e628b49","proargnames":null,"proargtypes":"","proisstrict":false,"proparallel":"u","provariadic":"-","provolatile":"s","return_type":"uuid","proleakproof":false,"pronargdefaults":0,"extension_membership":null,"definition":"CREATE OR REPLACE FUNCTION auth.uid()\n RETURNS uuid\n LANGUAGE sql\n STABLE\nAS $function$\n  select \n  coalesce(\n    nullif(current_setting('request.jwt.claim.sub', true), ''),\n    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')\n  )::uuid\n$function$\n"},"public.is_admin()":{"acl":"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}","owner":"postgres","schema":"public","procost":100,"prokind":"f","prorows":0,"support":"-","language":"sql","proconfig":["search_path=public"],"proretset":false,"prosecdef":true,"prosrc_md5":"c6285e67e4e39f263d934fac2145035c","proargnames":null,"proargtypes":"","proisstrict":false,"proparallel":"u","provariadic":"-","provolatile":"s","return_type":"boolean","proleakproof":false,"pronargdefaults":0,"extension_membership":null,"definition":"CREATE OR REPLACE FUNCTION public.is_admin()\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'public'\nAS $function$\n  SELECT EXISTS (\n    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'\n  );\n$function$\n"},"public.enforce_role_change_by_admin()":{"acl":"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}","owner":"postgres","schema":"public","procost":100,"prokind":"f","prorows":0,"support":"-","language":"plpgsql","proconfig":["search_path=public"],"proretset":false,"prosecdef":true,"prosrc_md5":"a3d315a8c81181eccbb9072e8b9c3c7a","proargnames":null,"proargtypes":"","proisstrict":false,"proparallel":"u","provariadic":"-","provolatile":"v","return_type":"trigger","proleakproof":false,"pronargdefaults":0,"extension_membership":null,"definition":"CREATE OR REPLACE FUNCTION public.enforce_role_change_by_admin()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'public'\nAS $function$\nBEGIN\n  IF NEW.role IS DISTINCT FROM OLD.role THEN\n    IF NOT is_admin() THEN\n      RAISE EXCEPTION 'permission denied: only admins can change user roles';\n    END IF;\n  END IF;\n  RETURN NEW;\nEND;\n$function$\n"}},"schemas":[{"acl":"{supabase_admin=UC/supabase_admin,anon=U/supabase_admin,authenticated=U/supabase_admin,service_role=U/supabase_admin,supabase_auth_admin=UC/supabase_admin,dashboard_user=UC/supabase_admin,postgres=U/supabase_admin}","owner":"supabase_admin","schema":"auth"},{"acl":"{postgres=UC/postgres,anon=U/postgres,authenticated=U/postgres,service_role=U/postgres,dashboard_user=UC/postgres}","owner":"postgres","schema":"extensions"},{"acl":"{pg_database_owner=UC/pg_database_owner,=U/pg_database_owner,postgres=U/pg_database_owner,anon=U/pg_database_owner,authenticated=U/pg_database_owner,service_role=U/pg_database_owner}","owner":"pg_database_owner","schema":"public"}],"extensions":[],"dormant_targets":[]}$platform_expected$::jsonb THEN
  RAISE EXCEPTION 'learning022_platform_not_attested' USING ERRCODE='55000',HINT='Preserve all hooks and definitions; compare the scoped READ ONLY catalog with reviewed 022 metadata.';
 END IF;
 IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='postgres' AND NOT rolsuper AND rolbypassrls) THEN RAISE EXCEPTION 'learning022_operator_not_attested';END IF;
END $platform022$;
-- Management installation: database authority only; no learner/JWT identity.
DO $management_operator$ BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
  OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='postgres' AND NOT rolsuper AND rolbypassrls)
 THEN RAISE EXCEPTION 'management_install_operator_required' USING ERRCODE='42501'; END IF;
 IF NOT pg_catalog.has_table_privilege('postgres','auth.users','REFERENCES')
 THEN RAISE EXCEPTION 'management_install_references_required' USING ERRCODE='42501'; END IF;
 IF nullif(pg_catalog.current_setting('request.jwt.claim.sub',true),'') IS NOT NULL
  OR nullif(pg_catalog.current_setting('request.jwt.claims',true),'') IS NOT NULL
 THEN RAISE EXCEPTION 'management_install_app_context_forbidden' USING ERRCODE='42501'; END IF;
END $management_operator$;
-- Read-only catalog gate; execute inside the parent transaction with search_path empty.
DO $activity022_preflight$
DECLARE streak_proc pg_catalog.pg_proc%rowtype; c pg_catalog.pg_class%rowtype; helper pg_catalog.pg_proc%rowtype;
 cols integer; actual_policies jsonb; expected_policies jsonb; actual_acl jsonb;
 minimal_acl jsonb:='[["PUBLIC","EXECUTE",false,"postgres"],["postgres","EXECUTE",false,"postgres"]]'::jsonb;
 explicit_acl jsonb:='[["PUBLIC","EXECUTE",false,"postgres"],["anon","EXECUTE",false,"postgres"],["authenticated","EXECUTE",false,"postgres"],["postgres","EXECUTE",false,"postgres"],["service_role","EXECUTE",false,"postgres"]]'::jsonb;
BEGIN
 SELECT * INTO streak_proc FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('public.update_streak(uuid)');
 IF streak_proc.oid IS NULL OR md5(streak_proc.prosrc)<>'7f7c5295ab5c3e91beb70cef04990b6c'
  OR NOT streak_proc.prosecdef OR streak_proc.provolatile<>'v' OR streak_proc.proconfig IS DISTINCT FROM ARRAY['search_path=public']::text[]
  OR streak_proc.prorettype<>'void'::regtype OR streak_proc.prolang<>(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
  OR streak_proc.proowner<>(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='postgres')
  OR streak_proc.prokind<>'f' OR streak_proc.proretset OR streak_proc.proleakproof OR streak_proc.provariadic<>0 OR streak_proc.proargdefaults IS NOT NULL
  OR streak_proc.proargnames IS DISTINCT FROM ARRAY['uid']::text[] OR streak_proc.proparallel<>'u' OR streak_proc.prosupport<>0
  OR streak_proc.proisstrict OR streak_proc.procost<>100 OR streak_proc.prorows<>0 OR streak_proc.pronargdefaults<>0 OR streak_proc.probin IS NOT NULL OR streak_proc.prosqlbody IS NOT NULL
 THEN RAISE EXCEPTION 'activity_policy_not_attested' USING ERRCODE='55000'; END IF;
 actual_acl:=(SELECT coalesce(jsonb_agg(jsonb_build_array(coalesce(r.rolname,'PUBLIC'),a.privilege_type,a.is_grantable,grantor.rolname)
 ORDER BY coalesce(r.rolname,'PUBLIC'),a.privilege_type,a.is_grantable,grantor.rolname),'[]'::jsonb)
 FROM pg_catalog.pg_proc acl_proc CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(acl_proc.proacl,pg_catalog.acldefault('f',acl_proc.proowner))) a
 LEFT JOIN pg_catalog.pg_roles r ON r.oid=a.grantee JOIN pg_catalog.pg_roles grantor ON grantor.oid=a.grantor WHERE acl_proc.oid=streak_proc.oid);
 IF actual_acl IS DISTINCT FROM explicit_acl
 THEN RAISE EXCEPTION 'activity_policy_acl_not_attested' USING ERRCODE='55000'; END IF;
 SELECT * INTO c FROM pg_catalog.pg_class WHERE oid=pg_catalog.to_regclass('public.profiles');
 IF c.oid IS NULL OR c.relkind<>'r' OR c.relowner<>streak_proc.proowner OR NOT c.relrowsecurity OR c.relforcerowsecurity
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
  OR helper.prolang<>(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql') OR helper.proowner<>streak_proc.proowner
  OR helper.prokind<>'f' OR helper.proretset OR helper.proleakproof OR helper.provariadic<>0 OR helper.proargdefaults IS NOT NULL
  OR helper.proargnames IS NOT NULL OR helper.proparallel<>'u' OR helper.prosupport<>0
  OR helper.proisstrict OR helper.procost<>100 OR helper.prorows<>0 OR helper.pronargdefaults<>0 OR helper.probin IS NOT NULL OR helper.prosqlbody IS NOT NULL
 THEN RAISE EXCEPTION 'activity_role_guard_not_attested' USING ERRCODE='55000'; END IF;
 IF (SELECT coalesce(jsonb_agg(jsonb_build_array(coalesce(r.rolname,'PUBLIC'),a.privilege_type,a.is_grantable,grantor.rolname)
 ORDER BY coalesce(r.rolname,'PUBLIC'),a.privilege_type,a.is_grantable,grantor.rolname),'[]'::jsonb)
 FROM pg_catalog.pg_proc acl_proc CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(acl_proc.proacl,pg_catalog.acldefault('f',acl_proc.proowner))) a
 LEFT JOIN pg_catalog.pg_roles r ON r.oid=a.grantee JOIN pg_catalog.pg_roles grantor ON grantor.oid=a.grantor WHERE acl_proc.oid=helper.oid) IS DISTINCT FROM explicit_acl
 THEN RAISE EXCEPTION 'activity_role_guard_acl_not_attested' USING ERRCODE='55000'; END IF;
 SELECT * INTO helper FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('public.is_admin()');
 IF helper.oid IS NULL OR md5(helper.prosrc)<>'c6285e67e4e39f263d934fac2145035c' OR NOT helper.prosecdef
  OR helper.provolatile<>'s' OR helper.proconfig IS DISTINCT FROM ARRAY['search_path=public']::text[] OR helper.prorettype<>'boolean'::regtype
  OR helper.prolang<>(SELECT oid FROM pg_catalog.pg_language WHERE lanname='sql') OR helper.proowner<>streak_proc.proowner
  OR helper.prokind<>'f' OR helper.proretset OR helper.proleakproof OR helper.provariadic<>0 OR helper.proargdefaults IS NOT NULL
  OR helper.proargnames IS NOT NULL OR helper.proparallel<>'u' OR helper.prosupport<>0
  OR helper.proisstrict OR helper.procost<>100 OR helper.prorows<>0 OR helper.pronargdefaults<>0 OR helper.probin IS NOT NULL OR helper.prosqlbody IS NOT NULL
 THEN RAISE EXCEPTION 'activity_admin_helper_not_attested' USING ERRCODE='55000',DETAIL='Read-only evidence must include exact public.is_admin() definition and pg_proc/owner/ACL metadata.'; END IF;
 IF (SELECT coalesce(jsonb_agg(jsonb_build_array(coalesce(r.rolname,'PUBLIC'),a.privilege_type,a.is_grantable,grantor.rolname)
 ORDER BY coalesce(r.rolname,'PUBLIC'),a.privilege_type,a.is_grantable,grantor.rolname),'[]'::jsonb)
 FROM pg_catalog.pg_proc acl_proc CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(acl_proc.proacl,pg_catalog.acldefault('f',acl_proc.proowner))) a
 LEFT JOIN pg_catalog.pg_roles r ON r.oid=a.grantee JOIN pg_catalog.pg_roles grantor ON grantor.oid=a.grantor WHERE acl_proc.oid=helper.oid) IS DISTINCT FROM explicit_acl
 THEN RAISE EXCEPTION 'activity_admin_helper_acl_not_attested' USING ERRCODE='55000'; END IF;
 SELECT * INTO helper FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('auth.uid()');
 IF helper.oid IS NULL OR md5(helper.prosrc)<>'cdef18c69c4f4cbbced2eaf81e628b49' OR helper.prosecdef
  OR helper.provolatile<>'s' OR helper.proconfig IS NOT NULL OR helper.prorettype<>'uuid'::regtype
  OR helper.prolang<>(SELECT oid FROM pg_catalog.pg_language WHERE lanname='sql') OR helper.proowner<>(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='supabase_auth_admin')
  OR helper.prokind<>'f' OR helper.proretset OR helper.proleakproof OR helper.provariadic<>0 OR helper.proargdefaults IS NOT NULL
  OR helper.proargnames IS NOT NULL OR helper.proparallel<>'u' OR helper.prosupport<>0
  OR helper.proisstrict OR helper.procost<>100 OR helper.prorows<>0 OR helper.pronargdefaults<>0 OR helper.probin IS NOT NULL OR helper.prosqlbody IS NOT NULL
 THEN RAISE EXCEPTION 'activity_identity_helper_not_attested' USING ERRCODE='55000',DETAIL='Exact auth.uid source, ownership and execution metadata must match M09 catalog evidence.'; END IF;
 IF (SELECT coalesce(jsonb_agg(jsonb_build_array(coalesce(r.rolname,'PUBLIC'),a.privilege_type,a.is_grantable,grantor.rolname)
 ORDER BY coalesce(r.rolname,'PUBLIC'),a.privilege_type,a.is_grantable,grantor.rolname),'[]'::jsonb)
 FROM pg_catalog.pg_proc acl_proc CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(acl_proc.proacl,pg_catalog.acldefault('f',acl_proc.proowner))) a
 LEFT JOIN pg_catalog.pg_roles r ON r.oid=a.grantee JOIN pg_catalog.pg_roles grantor ON grantor.oid=a.grantor WHERE acl_proc.oid=helper.oid) IS DISTINCT FROM '[["PUBLIC","EXECUTE",false,"supabase_auth_admin"],["dashboard_user","EXECUTE",false,"supabase_auth_admin"],["supabase_auth_admin","EXECUTE",false,"supabase_auth_admin"]]'::jsonb
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
 IF EXISTS(SELECT 1 FROM jsonb_array_elements((WITH RECURSIVE expressions(source,body) AS (
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
 ) SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY source,classid,objid),'[]'::jsonb) FROM objects o)) d
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
 IF (SELECT jsonb_build_object(
  'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'number',a.attnum,'default',pg_catalog.pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity,'not_null',a.attnotnull,'collation',CASE WHEN a.attcollation=0 THEN NULL ELSE a.attcollation::regcollation::text END,'generated',a.attgenerated,'acl',a.attacl) ORDER BY a.attnum) FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='public.profiles'::regclass AND a.attnum>0 AND NOT a.attisdropped),
  'constraints',(SELECT jsonb_agg(jsonb_build_object('name',conname,'type',contype,'validated',convalidated,'definition',pg_catalog.pg_get_constraintdef(oid)) ORDER BY conname COLLATE "C") FROM pg_catalog.pg_constraint WHERE conrelid='public.profiles'::regclass AND contype<>'n'),
  'indexes',(SELECT jsonb_agg(jsonb_build_object('name',indexrelid::regclass::text,'ready',indisready,'valid',indisvalid,'unique',indisunique,'definition',pg_catalog.pg_get_indexdef(indexrelid)) ORDER BY indexrelid::regclass::text COLLATE "C") FROM pg_catalog.pg_index WHERE indrelid='public.profiles'::regclass))) IS DISTINCT FROM '{"columns":[{"acl":null,"name":"id","type":"uuid","number":1,"default":null,"identity":"","not_null":true,"collation":null,"generated":""},{"acl":null,"name":"display_name","type":"text","number":2,"default":null,"identity":"","not_null":false,"collation":"\"default\"","generated":""},{"acl":null,"name":"role","type":"text","number":3,"default":"''student''::text","identity":"","not_null":false,"collation":"\"default\"","generated":""},{"acl":null,"name":"level","type":"text","number":4,"default":"''beginner''::text","identity":"","not_null":false,"collation":"\"default\"","generated":""},{"acl":null,"name":"streak_count","type":"integer","number":5,"default":"0","identity":"","not_null":false,"collation":null,"generated":""},{"acl":null,"name":"created_at","type":"timestamp with time zone","number":6,"default":"now()","identity":"","not_null":false,"collation":null,"generated":""},{"acl":null,"name":"last_login_at","type":"timestamp with time zone","number":7,"default":"now()","identity":"","not_null":false,"collation":null,"generated":""},{"acl":null,"name":"avatar_url","type":"text","number":8,"default":null,"identity":"","not_null":false,"collation":"\"default\"","generated":""},{"acl":null,"name":"onboarded","type":"boolean","number":9,"default":"false","identity":"","not_null":false,"collation":null,"generated":""},{"acl":null,"name":"learning_language","type":"text[]","number":10,"default":"ARRAY[''Japanese''::text]","identity":"","not_null":false,"collation":"\"default\"","generated":""},{"acl":null,"name":"learning_level","type":"text","number":11,"default":"''N3''::text","identity":"","not_null":false,"collation":"\"default\"","generated":""},{"acl":null,"name":"learning_level_japanese","type":"text","number":12,"default":"''N3 중급''::text","identity":"","not_null":false,"collation":"\"default\"","generated":""},{"acl":null,"name":"learning_level_english","type":"text","number":13,"default":"''B1 중급''::text","identity":"","not_null":false,"collation":"\"default\"","generated":""},{"acl":null,"name":"last_streak_date","type":"date","number":14,"default":null,"identity":"","not_null":false,"collation":null,"generated":""},{"acl":null,"name":"xp","type":"integer","number":15,"default":"0","identity":"","not_null":true,"collation":null,"generated":""},{"acl":null,"name":"goal_review","type":"integer","number":16,"default":"5","identity":"","not_null":true,"collation":null,"generated":""},{"acl":null,"name":"goal_words","type":"integer","number":17,"default":"5","identity":"","not_null":true,"collation":null,"generated":""},{"acl":null,"name":"goal_read","type":"integer","number":18,"default":"1","identity":"","not_null":true,"collation":null,"generated":""},{"acl":null,"name":"active_lang","type":"text","number":19,"default":null,"identity":"","not_null":false,"collation":"\"default\"","generated":""},{"acl":null,"name":"streak_freeze_count","type":"integer","number":20,"default":"0","identity":"","not_null":true,"collation":null,"generated":""},{"acl":null,"name":"dday_date","type":"date","number":21,"default":null,"identity":"","not_null":false,"collation":null,"generated":""},{"acl":null,"name":"dday_label","type":"text","number":22,"default":null,"identity":"","not_null":false,"collation":"\"default\"","generated":""},{"acl":null,"name":"learning_level_french","type":"text","number":23,"default":null,"identity":"","not_null":false,"collation":"\"default\"","generated":""},{"acl":null,"name":"learning_level_chinese","type":"text","number":24,"default":null,"identity":"","not_null":false,"collation":"\"default\"","generated":""},{"acl":null,"name":"goal_lang","type":"text","number":25,"default":null,"identity":"","not_null":false,"collation":"\"default\"","generated":""},{"acl":null,"name":"goal_level","type":"text","number":26,"default":null,"identity":"","not_null":false,"collation":"\"default\"","generated":""}],"constraints":[{"name":"profiles_id_fkey","type":"f","validated":true,"definition":"FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE"},{"name":"profiles_pkey","type":"p","validated":true,"definition":"PRIMARY KEY (id)"},{"name":"profiles_role_check","type":"c","validated":true,"definition":"CHECK ((role = ANY (ARRAY[''student''::text, ''host''::text, ''admin''::text])))"}],"indexes":[{"name":"public.profiles_pkey","ready":true,"valid":true,"unique":true,"definition":"CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id)"}]}'::jsonb THEN
  RAISE EXCEPTION 'activity_profile_shape_not_attested' USING ERRCODE='55000'; END IF;
 IF c.relpersistence<>'p' OR c.reloptions IS NOT NULL OR
  (SELECT coalesce(jsonb_agg(jsonb_build_array(coalesce(r.rolname,'PUBLIC'),a.privilege_type,a.is_grantable,g.rolname) ORDER BY coalesce(r.rolname,'PUBLIC') COLLATE "C",a.privilege_type,a.is_grantable,g.rolname),'[]'::jsonb)
   FROM pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) a LEFT JOIN pg_catalog.pg_roles r ON r.oid=a.grantee JOIN pg_catalog.pg_roles g ON g.oid=a.grantor) IS DISTINCT FROM '[["anon","DELETE",false,"postgres"],["anon","INSERT",false,"postgres"],["anon","MAINTAIN",false,"postgres"],["anon","REFERENCES",false,"postgres"],["anon","SELECT",false,"postgres"],["anon","TRIGGER",false,"postgres"],["anon","TRUNCATE",false,"postgres"],["anon","UPDATE",false,"postgres"],["authenticated","DELETE",false,"postgres"],["authenticated","INSERT",false,"postgres"],["authenticated","MAINTAIN",false,"postgres"],["authenticated","REFERENCES",false,"postgres"],["authenticated","SELECT",false,"postgres"],["authenticated","TRIGGER",false,"postgres"],["authenticated","TRUNCATE",false,"postgres"],["authenticated","UPDATE",false,"postgres"],["postgres","DELETE",false,"postgres"],["postgres","INSERT",false,"postgres"],["postgres","MAINTAIN",false,"postgres"],["postgres","REFERENCES",false,"postgres"],["postgres","SELECT",false,"postgres"],["postgres","TRIGGER",false,"postgres"],["postgres","TRUNCATE",false,"postgres"],["postgres","UPDATE",false,"postgres"],["service_role","DELETE",false,"postgres"],["service_role","INSERT",false,"postgres"],["service_role","MAINTAIN",false,"postgres"],["service_role","REFERENCES",false,"postgres"],["service_role","SELECT",false,"postgres"],["service_role","TRIGGER",false,"postgres"],["service_role","TRUNCATE",false,"postgres"],["service_role","UPDATE",false,"postgres"]]'::jsonb
 THEN RAISE EXCEPTION 'activity_profile_privileges_not_attested' USING ERRCODE='55000'; END IF;
 IF (SELECT r.rolname FROM pg_catalog.pg_namespace n JOIN pg_catalog.pg_roles r ON r.oid=n.nspowner WHERE n.nspname='public') IS DISTINCT FROM 'pg_database_owner'
 OR (SELECT r.rolname FROM pg_catalog.pg_namespace n JOIN pg_catalog.pg_roles r ON r.oid=n.nspowner WHERE n.nspname='auth') IS DISTINCT FROM 'supabase_admin'
 OR NOT pg_catalog.has_schema_privilege('postgres','public','CREATE')
 THEN RAISE EXCEPTION 'activity_dependency_namespace_owner_not_attested' USING ERRCODE='55000'; END IF;
 IF (SELECT coalesce(jsonb_agg(jsonb_build_array(coalesce(r.rolname,'PUBLIC'),a.privilege_type,a.is_grantable,grantor.rolname)
 ORDER BY coalesce(r.rolname,'PUBLIC') COLLATE "C",a.privilege_type,a.is_grantable,grantor.rolname),'[]'::jsonb)
 FROM pg_catalog.pg_namespace n CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(n.nspacl,pg_catalog.acldefault('n',n.nspowner))) a
 LEFT JOIN pg_catalog.pg_roles r ON r.oid=a.grantee JOIN pg_catalog.pg_roles grantor ON grantor.oid=a.grantor WHERE n.nspname='public') IS DISTINCT FROM '[["PUBLIC","USAGE",false,"pg_database_owner"],["anon","USAGE",false,"pg_database_owner"],["authenticated","USAGE",false,"pg_database_owner"],["pg_database_owner","CREATE",false,"pg_database_owner"],["pg_database_owner","USAGE",false,"pg_database_owner"],["postgres","USAGE",false,"pg_database_owner"],["service_role","USAGE",false,"pg_database_owner"]]'::jsonb
 OR (SELECT coalesce(jsonb_agg(jsonb_build_array(coalesce(r.rolname,'PUBLIC'),a.privilege_type,a.is_grantable,grantor.rolname)
 ORDER BY coalesce(r.rolname,'PUBLIC') COLLATE "C",a.privilege_type,a.is_grantable,grantor.rolname),'[]'::jsonb)
 FROM pg_catalog.pg_namespace n CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(n.nspacl,pg_catalog.acldefault('n',n.nspowner))) a
 LEFT JOIN pg_catalog.pg_roles r ON r.oid=a.grantee JOIN pg_catalog.pg_roles grantor ON grantor.oid=a.grantor WHERE n.nspname='auth') IS DISTINCT FROM '[["anon","USAGE",false,"supabase_admin"],["authenticated","USAGE",false,"supabase_admin"],["dashboard_user","CREATE",false,"supabase_admin"],["dashboard_user","USAGE",false,"supabase_admin"],["postgres","USAGE",false,"supabase_admin"],["service_role","USAGE",false,"supabase_admin"],["supabase_admin","CREATE",false,"supabase_admin"],["supabase_admin","USAGE",false,"supabase_admin"],["supabase_auth_admin","CREATE",false,"supabase_admin"],["supabase_auth_admin","USAGE",false,"supabase_admin"]]'::jsonb
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
END
$activity022_preflight$;

DO $platform022_before$ DECLARE profile jsonb;BEGIN SELECT q.* INTO profile FROM (WITH objects AS (
 SELECT 'dependencies' k,(WITH RECURSIVE expressions(source,body) AS (
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
 ) SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY source,classid,objid),'[]'::jsonb) FROM objects o) v
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
 UNION ALL SELECT 'role_closure',(WITH RECURSIVE relevant(oid) AS (
  SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN ('postgres','supabase_admin','supabase_auth_admin','dashboard_user','anon','authenticated','service_role','pg_database_owner')
  UNION SELECT CASE WHEN m.roleid=r.oid THEN m.member ELSE m.roleid END FROM relevant r JOIN pg_catalog.pg_auth_members m ON m.roleid=r.oid OR m.member=r.oid
 ) SELECT jsonb_build_object(
  'roles',(SELECT jsonb_agg(to_jsonb(r)-ARRAY['rolpassword','rolvaliduntil'] ORDER BY r.oid) FROM pg_catalog.pg_roles r WHERE r.oid IN (SELECT oid FROM relevant)),
  'memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor) FROM pg_catalog.pg_auth_members m WHERE m.roleid IN (SELECT oid FROM relevant) OR m.member IN (SELECT oid FROM relevant))))
 UNION ALL SELECT 'role_database_override:'||setdatabase||':'||setrole,to_jsonb(d) FROM pg_catalog.pg_db_role_setting d WHERE setdatabase IN (0,(SELECT oid FROM pg_catalog.pg_database WHERE datname=current_database())) AND (setrole=0 OR setrole IN (SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN ('postgres','supabase_admin','supabase_auth_admin','dashboard_user','anon','authenticated','service_role')))
 UNION ALL SELECT 'function:'||oid,jsonb_build_array(pg_get_functiondef(oid),to_jsonb(p)) FROM pg_catalog.pg_proc p WHERE oid=pg_catalog.to_regprocedure('public.update_streak(uuid)')
 ) SELECT jsonb_object_agg(k,v ORDER BY k) FROM objects) q;PERFORM pg_catalog.set_config('manabi.catalog022_profile_before',profile::text,true);END $platform022_before$;
-- END REVIEWED 022 PRE-GUARD korean003-protected

SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL work_mem='4MB';
SET LOCAL search_path='';
-- Source/PDF writes, including metadata/document edits, are blocked BEFORE any
-- snapshot. Reads remain possible. Lock conflict/deadlock/timeouts abort safely.
LOCK TABLE public.reading_materials,public.uploaded_pdfs,public.user_vocabulary,
 public.vocabulary_contexts,public.user_known_words,public.review_events,
 public.vocabulary_exclusions IN SHARE ROW EXCLUSIVE MODE;
-- Audit all seven owners AFTER locks and BEFORE snapshots: owner changes need
-- conflicting DDL locks. A learner-owned source must never be fingerprint-blessed.
DO $round004_snapshot_owner$
BEGIN
 IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles
  WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'round004_snapshot_operator_rejected' USING ERRCODE='42501'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_catalog.pg_roles owner_role ON owner_role.oid=c.relowner
  WHERE n.nspname='public' AND c.relname IN ('user_vocabulary','vocabulary_contexts','user_known_words',
   'review_events','vocabulary_exclusions','reading_materials','uploaded_pdfs')
  AND c.relkind='r' AND owner_role.rolname='postgres')<>7
 THEN RAISE EXCEPTION 'round004_snapshot_owner_rejected' USING ERRCODE='42501'; END IF;
END $round004_snapshot_owner$;
-- Full typed rows in session-private temporary tables; never returned to caller.
CREATE TEMP TABLE round004_before_user_vocabulary ON COMMIT DROP AS TABLE public.user_vocabulary;
CREATE TEMP TABLE round004_before_vocabulary_contexts ON COMMIT DROP AS TABLE public.vocabulary_contexts;
CREATE TEMP TABLE round004_before_user_known_words ON COMMIT DROP AS TABLE public.user_known_words;
CREATE TEMP TABLE round004_before_review_events ON COMMIT DROP AS TABLE public.review_events;
CREATE TEMP TABLE round004_before_reading_materials ON COMMIT DROP AS TABLE public.reading_materials;
CREATE TEMP TABLE round004_before_uploaded_pdfs ON COMMIT DROP AS TABLE public.uploaded_pdfs;
CREATE TEMP TABLE round004_before_vocabulary_exclusions ON COMMIT DROP AS TABLE public.vocabulary_exclusions;
CREATE TEMP TABLE round004_expected_ko(user_id,language,word_text,known_word_keys) ON COMMIT DROP AS
 SELECT k.user_id,l.language,keys.word,array_agg(DISTINCT k.word_text)
 FROM public.user_known_words k
 JOIN (VALUES('ko','Korean')) l(code,language) ON l.code=k.lang
 CROSS JOIN LATERAL (
  SELECT normalize(btrim(k.word_text),NFC) AS word
  UNION SELECT normalize(btrim(coalesce(nullif(v.base_form,''),v.word_text)),NFC) FROM public.user_vocabulary v
   WHERE v.user_id=k.user_id AND v.language=l.language
   AND (normalize(btrim(v.word_text),NFC)=normalize(btrim(k.word_text),NFC)
    OR normalize(btrim(v.base_form),NFC)=normalize(btrim(k.word_text),NFC))
 ) keys
 GROUP BY k.user_id,l.language,keys.word;
DO $round004_apply$
DECLARE phase text:='candidate'; failure_state text; failure_message text; safe_reason text;
BEGIN
 -- The subtransaction guarantees candidate DDL/grants/backfill are rolled back
 -- before a sanitized error reaches any SQL tool. Outer transaction then aborts.
 BEGIN
  EXECUTE $round004_exact_candidate$SET LOCAL lock_timeout='5s';
SET LOCAL search_path='';
-- Stabilize concurrent writes while checking and widening this bounded contract.
LOCK TABLE public.user_vocabulary,public.vocabulary_contexts,public.user_known_words,
 public.vocabulary_exclusions,public.review_events IN SHARE ROW EXCLUSIVE MODE;
DO $preflight$
DECLARE r record; installed_proc pg_catalog.pg_proc%rowtype; language_check record; expr text; before_expr text; after_expr text;
owner_expr text; def text; known_check_count integer;
modern boolean:=pg_catalog.to_regprocedure('public.save_vocabulary_context_for(uuid,jsonb,jsonb,uuid,text)') IS NOT NULL;
BEGIN
 IF EXISTS(WITH RECURSIVE roles(oid) AS (SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN ('authenticated','anon') UNION SELECT m.roleid FROM pg_catalog.pg_auth_members m JOIN roles rr ON rr.oid=m.member)
  SELECT 1 FROM pg_catalog.pg_roles p JOIN roles rr ON p.oid=rr.oid WHERE p.rolsuper OR p.rolbypassrls)
 THEN RAISE EXCEPTION 'korean_support_unsafe_role_membership'; END IF;
 IF pg_catalog.to_regprocedure('public.guard_korean_learning_contract()') IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('public.guard_korean_learning_contract()')
  AND pg_catalog.md5(prosrc)='4d76f715e7ff2f0a11bfd507cd99e0a2' AND NOT prosecdef AND proconfig=ARRAY['search_path=""']::text[]
  AND proowner=(SELECT relowner FROM pg_catalog.pg_class WHERE oid='public.user_vocabulary'::pg_catalog.regclass)
  AND prolang=(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql') AND prorettype='trigger'::pg_catalog.regtype AND NOT proretset AND pronargs=0 AND provolatile='v')
 THEN RAISE EXCEPTION 'korean_support_unexpected_contract_guard'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::pg_catalog.regnamespace
  AND t.tgname='guard_korean_learning_contract' AND (c.relname NOT IN ('user_vocabulary','vocabulary_contexts','user_known_words','vocabulary_exclusions','review_events')
   OR t.tgenabled<>'O' OR t.tgtype<>31 OR t.tgfoid IS DISTINCT FROM pg_catalog.to_regprocedure('public.guard_korean_learning_contract()')
   OR t.tgqual IS NOT NULL OR t.tgnargs<>0 OR t.tgattr<>''::pg_catalog.int2vector OR t.tgisinternal))
 THEN RAISE EXCEPTION 'korean_support_unexpected_contract_trigger'; END IF;
 IF pg_catalog.to_regprocedure('public.learning_language_capabilities()') IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('public.learning_language_capabilities()')
  AND NOT prosecdef AND proconfig=ARRAY['search_path=""']::text[]
  AND proowner=(SELECT relowner FROM pg_catalog.pg_class WHERE oid='public.user_vocabulary'::pg_catalog.regclass)
  AND prolang=(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql') AND prorettype='jsonb'::pg_catalog.regtype AND NOT proretset AND pronargs=0 AND provolatile='s'
  AND (pg_catalog.md5(pg_catalog.regexp_replace(prosrc,'''[0-9a-f]{32}''','''CONTRACT_HASH''','g')) IN ('d37f20e64c538b7ee9f7f58fa96055a2','ebeef1bf6f66890a38e8a594491619d6')
   OR pg_catalog.md5(prosrc)='da8712353cfbe1668741183d5fd8d650'))
 THEN RAISE EXCEPTION 'korean_support_unexpected_capability_rpc'; END IF;
 FOR r IN SELECT * FROM (VALUES
   ('reading_materials','id','bigint',false),
   ('reading_materials','owner_id','uuid',false),
   ('reading_materials','visibility','text',false),
   ('reading_materials','title','text',false),
   ('review_events','user_id','uuid',false),
   ('review_events','lang','text',false),
   ('review_events','source','text',false),
   ('review_events','item_key','text',false),
   ('review_events','correct','boolean',false),
   ('review_events','detail','jsonb',false),
   ('review_events','created_at','timestamp with time zone',false),
   ('uploaded_pdfs','id','uuid',false),
   ('uploaded_pdfs','owner_id','uuid',false),
   ('uploaded_pdfs','title','text',false),
   ('user_known_words','user_id','uuid',true),
   ('user_known_words','lang','text',true),
   ('user_known_words','word_text','text',true),
   ('user_known_words','marked_at','timestamp with time zone',true),
   ('user_vocabulary','id','uuid',false),
   ('user_vocabulary','user_id','uuid',false),
   ('user_vocabulary','word_text','text',false),
   ('user_vocabulary','base_form','text',false),
   ('user_vocabulary','meaning','text',false),
   ('user_vocabulary','furigana','text',false),
   ('user_vocabulary','pos','text',false),
   ('user_vocabulary','language','text',false),
   ('user_vocabulary','source_sentence','text',false),
   ('user_vocabulary','source_material_id','bigint',false),
   ('user_vocabulary','interval','real',false),
   ('user_vocabulary','ease_factor','real',false),
   ('user_vocabulary','repetitions','integer',false),
   ('user_vocabulary','next_review_at','timestamp with time zone',false),
   ('user_vocabulary','last_reviewed_at','timestamp with time zone',false),
   ('vocabulary_contexts','id','uuid',true),
   ('vocabulary_contexts','user_id','uuid',true),
   ('vocabulary_contexts','vocabulary_id','uuid',true),
   ('vocabulary_contexts','kind','text',true),
   ('vocabulary_contexts','lang','text',true),
   ('vocabulary_contexts','chapter_slug','text',false),
   ('vocabulary_contexts','material_id','bigint',false),
   ('vocabulary_contexts','pdf_id','uuid',false),
   ('vocabulary_contexts','locator','jsonb',true),
   ('vocabulary_contexts','quote','text',true),
   ('vocabulary_contexts','translation','text',true),
   ('vocabulary_contexts','source_key','text',true),
   ('vocabulary_contexts','created_at','timestamp with time zone',true),
   ('vocabulary_exclusions','id','uuid',true),
   ('vocabulary_exclusions','user_id','uuid',true),
   ('vocabulary_exclusions','language','text',true),
   ('vocabulary_exclusions','word_text','text',true),
   ('vocabulary_exclusions','vocabulary_id','uuid',false),
   ('vocabulary_exclusions','retired_vocabulary_ids','uuid[]',true),
   ('vocabulary_exclusions','created_at','timestamp with time zone',true),
   ('vocabulary_exclusions','known_word_keys','text[]',true)
 ) expected(tab,col,type,required_not_null) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid=pg_catalog.to_regclass('public.'||r.tab) AND a.attname=r.col AND NOT a.attisdropped
   AND (pg_catalog.format_type(a.atttypid,a.atttypmod)=r.type
    OR (r.tab='user_vocabulary' AND r.col IN ('interval','ease_factor') AND pg_catalog.format_type(a.atttypid,a.atttypmod) IN ('real','double precision','numeric')))
   AND (NOT r.required_not_null OR a.attnotnull))
  THEN RAISE EXCEPTION 'korean_support_unexpected_column: %.%',r.tab,r.col; END IF;
 END LOOP;
 IF modern THEN
  IF current_user IS DISTINCT FROM (SELECT pg_catalog.pg_get_userbyid(relowner) FROM pg_catalog.pg_class WHERE oid='public.user_vocabulary'::pg_catalog.regclass)
  THEN RAISE EXCEPTION 'korean_support_trusted_operator_required'; END IF;
  FOR r IN SELECT * FROM (VALUES ('user_vocabulary','status','text'),('user_vocabulary','last_review','timestamp with time zone'),('user_vocabulary','material_id','bigint'),('user_vocabulary','created_at','timestamp with time zone'),('user_vocabulary','source_ref','text'),('user_vocabulary','etym','text'),('user_vocabulary','hanja','text'),('review_events','id','bigint'),('reading_materials','raw_text','text'),('reading_materials','processed_json','jsonb'),('reading_materials','document_json','jsonb')) expected(tab,col,type) LOOP
   IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid=pg_catalog.to_regclass('public.'||r.tab) AND a.attname=r.col AND NOT a.attisdropped AND pg_catalog.format_type(a.atttypid,a.atttypmod)=r.type)
   THEN RAISE EXCEPTION 'korean_support_unexpected_modern_column: %.%',r.tab,r.col; END IF;
  END LOOP;
 END IF;
 -- The committed dependent tables have fully known constraints. Match semantic
 -- definitions rather than catalog OIDs or user-selected constraint names.
 FOR r IN SELECT * FROM (VALUES
   ('user_known_words','CHECK ((lang ~ ''^[a-z]{2}$''::text))','CHECK ((lang ~ ''^[a-z]{2}$''::text))'),
   ('user_known_words','CHECK (((char_length(word_text) >= 1) AND (char_length(word_text) <= 100)))','CHECK (((char_length(word_text) >= 1) AND (char_length(word_text) <= 100)))'),
   ('user_known_words','PRIMARY KEY (user_id, lang, word_text)','PRIMARY KEY (user_id, lang, word_text)'),
   ('user_known_words','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
   ('vocabulary_contexts',CASE WHEN modern THEN 'CHECK ((kind = ANY (ARRAY[''textbook''::text, ''reading''::text, ''pdf''::text, ''class''::text])))' ELSE 'CHECK ((kind = ANY (ARRAY[''textbook''::text, ''reading''::text, ''pdf''::text])))' END,CASE WHEN modern THEN 'CHECK ((kind = ANY (ARRAY[''textbook''::text, ''reading''::text, ''pdf''::text, ''class''::text])))' ELSE 'CHECK ((kind = ANY (ARRAY[''textbook''::text, ''reading''::text, ''pdf''::text])))' END),
   ('vocabulary_contexts','CHECK ((lang = ANY (ARRAY[''Japanese''::text, ''Chinese''::text, ''English''::text, ''French''::text])))','CHECK ((lang = ANY (ARRAY[''Japanese''::text, ''Chinese''::text, ''English''::text, ''French''::text, ''Korean''::text])))'),
   ('vocabulary_contexts','CHECK ((jsonb_typeof(locator) = ''object''::text))','CHECK ((jsonb_typeof(locator) = ''object''::text))'),
   ('vocabulary_contexts','CHECK (((length(quote) >= 1) AND (length(quote) <= 4000)))','CHECK (((length(quote) >= 1) AND (length(quote) <= 4000)))'),
   ('vocabulary_contexts','CHECK ((length(translation) <= 2000))','CHECK ((length(translation) <= 2000))'),
   ('vocabulary_contexts',CASE WHEN modern THEN 'CHECK ((((kind = ''textbook''::text) AND (chapter_slug IS NOT NULL) AND (material_id IS NULL) AND (pdf_id IS NULL)) OR ((kind = ''reading''::text) AND (material_id IS NOT NULL) AND (chapter_slug IS NULL) AND (pdf_id IS NULL)) OR ((kind = ''pdf''::text) AND (pdf_id IS NOT NULL) AND (chapter_slug IS NULL) AND (material_id IS NULL)) OR ((kind = ''class''::text) AND (num_nonnulls(chapter_slug, material_id, pdf_id) = 0) AND (COALESCE((locator ->> ''team''::text), ''''::text) ~ ''^[a-z0-9][a-z0-9-]{0,15}$''::text) AND (COALESCE((locator ->> ''materialId''::text), ''''::text) ~ ''^[1-9][0-9]{0,15}$''::text))))' ELSE 'CHECK ((((kind = ''textbook''::text) AND (chapter_slug IS NOT NULL) AND (material_id IS NULL) AND (pdf_id IS NULL)) OR ((kind = ''reading''::text) AND (material_id IS NOT NULL) AND (chapter_slug IS NULL) AND (pdf_id IS NULL)) OR ((kind = ''pdf''::text) AND (pdf_id IS NOT NULL) AND (chapter_slug IS NULL) AND (material_id IS NULL))))' END,CASE WHEN modern THEN 'CHECK ((((kind = ''textbook''::text) AND (chapter_slug IS NOT NULL) AND (material_id IS NULL) AND (pdf_id IS NULL)) OR ((kind = ''reading''::text) AND (material_id IS NOT NULL) AND (chapter_slug IS NULL) AND (pdf_id IS NULL)) OR ((kind = ''pdf''::text) AND (pdf_id IS NOT NULL) AND (chapter_slug IS NULL) AND (material_id IS NULL)) OR ((kind = ''class''::text) AND (num_nonnulls(chapter_slug, material_id, pdf_id) = 0) AND (COALESCE((locator ->> ''team''::text), ''''::text) ~ ''^[a-z0-9][a-z0-9-]{0,15}$''::text) AND (COALESCE((locator ->> ''materialId''::text), ''''::text) ~ ''^[1-9][0-9]{0,15}$''::text))))' ELSE 'CHECK ((((kind = ''textbook''::text) AND (chapter_slug IS NOT NULL) AND (material_id IS NULL) AND (pdf_id IS NULL)) OR ((kind = ''reading''::text) AND (material_id IS NOT NULL) AND (chapter_slug IS NULL) AND (pdf_id IS NULL)) OR ((kind = ''pdf''::text) AND (pdf_id IS NOT NULL) AND (chapter_slug IS NULL) AND (material_id IS NULL))))' END),
   ('vocabulary_contexts','PRIMARY KEY (id)','PRIMARY KEY (id)'),
   ('vocabulary_contexts','UNIQUE (user_id, vocabulary_id, source_key)','UNIQUE (user_id, vocabulary_id, source_key)'),
   ('vocabulary_contexts','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
   ('vocabulary_contexts','FOREIGN KEY (vocabulary_id) REFERENCES public.user_vocabulary(id) ON DELETE CASCADE','FOREIGN KEY (vocabulary_id) REFERENCES public.user_vocabulary(id) ON DELETE CASCADE'),
   ('vocabulary_contexts','FOREIGN KEY (material_id) REFERENCES public.reading_materials(id) ON DELETE CASCADE','FOREIGN KEY (material_id) REFERENCES public.reading_materials(id) ON DELETE CASCADE'),
   ('vocabulary_contexts','FOREIGN KEY (pdf_id) REFERENCES public.uploaded_pdfs(id) ON DELETE CASCADE','FOREIGN KEY (pdf_id) REFERENCES public.uploaded_pdfs(id) ON DELETE CASCADE'),
   ('vocabulary_exclusions','CHECK ((language = ANY (ARRAY[''Japanese''::text, ''Chinese''::text, ''English''::text, ''French''::text, ''Unknown''::text])))','CHECK ((language = ANY (ARRAY[''Japanese''::text, ''Chinese''::text, ''English''::text, ''French''::text, ''Korean''::text, ''Unknown''::text])))'),
   ('vocabulary_exclusions','CHECK (((length(word_text) >= 1) AND (length(word_text) <= 300)))','CHECK (((length(word_text) >= 1) AND (length(word_text) <= 300)))'),
   ('vocabulary_exclusions','PRIMARY KEY (id)','PRIMARY KEY (id)'),
   ('vocabulary_exclusions','UNIQUE (user_id, vocabulary_id)','UNIQUE (user_id, vocabulary_id)'),
   ('vocabulary_exclusions','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
   ('vocabulary_exclusions','FOREIGN KEY (vocabulary_id) REFERENCES public.user_vocabulary(id) ON DELETE SET NULL','FOREIGN KEY (vocabulary_id) REFERENCES public.user_vocabulary(id) ON DELETE SET NULL')
 ) expected(tab,legacy_def,korean_def) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid=pg_catalog.to_regclass('public.'||r.tab) AND c.convalidated
   AND pg_catalog.pg_get_constraintdef(c.oid) IN (r.legacy_def,r.korean_def))
  THEN RAISE EXCEPTION 'korean_support_missing_constraint: %: %',r.tab,r.legacy_def; END IF;
 END LOOP;
 IF modern THEN
  FOR r IN SELECT * FROM (VALUES ('reading_materials','guard_source_passage_write',19,'1a35b1ec928d70551a6ff6b6db17cee3'),('reading_materials','library_book_preserve_metadata',19,'a9b4ad5b45a8864fcdf2c33af8452976'),('reading_materials','library_protect_material_delete',11,'18c684aeabe7a9a91fd97f1ba8cc7d9d'),('reading_materials','protect_composer_source',19,'fa93b2bf5f3e5eb4b2007a69f1e70c99'),('reading_materials','validate_source_passage',7,'c642edc1e173736e11da160f7f7da70e'),('uploaded_pdfs','library_protect_pdf_delete',11,'bbdcd701c0041da3d9801f0250ea4e20')) expected(tab,name,type,hash) LOOP
   IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger t WHERE t.tgrelid=pg_catalog.to_regclass('public.'||r.tab) AND t.tgname=r.name AND t.tgtype=r.type AND t.tgenabled='O'
    AND pg_catalog.md5(pg_catalog.pg_get_triggerdef(t.oid))=r.hash)
   THEN RAISE EXCEPTION 'korean_support_unexpected_modern_source_trigger: %.%',r.tab,r.name; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::pg_catalog.regnamespace
   AND c.relname IN ('reading_materials','uploaded_pdfs') AND NOT t.tgisinternal
   AND NOT EXISTS(SELECT 1 FROM (VALUES ('reading_materials','guard_source_passage_write',19,'1a35b1ec928d70551a6ff6b6db17cee3'),('reading_materials','library_book_preserve_metadata',19,'a9b4ad5b45a8864fcdf2c33af8452976'),('reading_materials','library_protect_material_delete',11,'18c684aeabe7a9a91fd97f1ba8cc7d9d'),('reading_materials','protect_composer_source',19,'fa93b2bf5f3e5eb4b2007a69f1e70c99'),('reading_materials','validate_source_passage',7,'c642edc1e173736e11da160f7f7da70e'),('uploaded_pdfs','library_protect_pdf_delete',11,'bbdcd701c0041da3d9801f0250ea4e20')) reviewed(tab,name,type,hash) WHERE reviewed.tab=c.relname AND reviewed.name=t.tgname))
  THEN RAISE EXCEPTION 'korean_support_unexpected_modern_source_trigger'; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_class t ON t.oid=c.conrelid WHERE t.relnamespace='public'::pg_catalog.regnamespace
  AND t.relname IN ('vocabulary_contexts','user_known_words','vocabulary_exclusions') AND c.contype<>'n'
  AND NOT EXISTS(SELECT 1 FROM (VALUES ('user_known_words','CHECK ((lang ~ ''^[a-z]{2}$''::text))','CHECK ((lang ~ ''^[a-z]{2}$''::text))'),
   ('user_known_words','CHECK (((char_length(word_text) >= 1) AND (char_length(word_text) <= 100)))','CHECK (((char_length(word_text) >= 1) AND (char_length(word_text) <= 100)))'),
   ('user_known_words','PRIMARY KEY (user_id, lang, word_text)','PRIMARY KEY (user_id, lang, word_text)'),
   ('user_known_words','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
   ('vocabulary_contexts',CASE WHEN modern THEN 'CHECK ((kind = ANY (ARRAY[''textbook''::text, ''reading''::text, ''pdf''::text, ''class''::text])))' ELSE 'CHECK ((kind = ANY (ARRAY[''textbook''::text, ''reading''::text, ''pdf''::text])))' END,CASE WHEN modern THEN 'CHECK ((kind = ANY (ARRAY[''textbook''::text, ''reading''::text, ''pdf''::text, ''class''::text])))' ELSE 'CHECK ((kind = ANY (ARRAY[''textbook''::text, ''reading''::text, ''pdf''::text])))' END),
   ('vocabulary_contexts','CHECK ((lang = ANY (ARRAY[''Japanese''::text, ''Chinese''::text, ''English''::text, ''French''::text])))','CHECK ((lang = ANY (ARRAY[''Japanese''::text, ''Chinese''::text, ''English''::text, ''French''::text, ''Korean''::text])))'),
   ('vocabulary_contexts','CHECK ((jsonb_typeof(locator) = ''object''::text))','CHECK ((jsonb_typeof(locator) = ''object''::text))'),
   ('vocabulary_contexts','CHECK (((length(quote) >= 1) AND (length(quote) <= 4000)))','CHECK (((length(quote) >= 1) AND (length(quote) <= 4000)))'),
   ('vocabulary_contexts','CHECK ((length(translation) <= 2000))','CHECK ((length(translation) <= 2000))'),
   ('vocabulary_contexts',CASE WHEN modern THEN 'CHECK ((((kind = ''textbook''::text) AND (chapter_slug IS NOT NULL) AND (material_id IS NULL) AND (pdf_id IS NULL)) OR ((kind = ''reading''::text) AND (material_id IS NOT NULL) AND (chapter_slug IS NULL) AND (pdf_id IS NULL)) OR ((kind = ''pdf''::text) AND (pdf_id IS NOT NULL) AND (chapter_slug IS NULL) AND (material_id IS NULL)) OR ((kind = ''class''::text) AND (num_nonnulls(chapter_slug, material_id, pdf_id) = 0) AND (COALESCE((locator ->> ''team''::text), ''''::text) ~ ''^[a-z0-9][a-z0-9-]{0,15}$''::text) AND (COALESCE((locator ->> ''materialId''::text), ''''::text) ~ ''^[1-9][0-9]{0,15}$''::text))))' ELSE 'CHECK ((((kind = ''textbook''::text) AND (chapter_slug IS NOT NULL) AND (material_id IS NULL) AND (pdf_id IS NULL)) OR ((kind = ''reading''::text) AND (material_id IS NOT NULL) AND (chapter_slug IS NULL) AND (pdf_id IS NULL)) OR ((kind = ''pdf''::text) AND (pdf_id IS NOT NULL) AND (chapter_slug IS NULL) AND (material_id IS NULL))))' END,CASE WHEN modern THEN 'CHECK ((((kind = ''textbook''::text) AND (chapter_slug IS NOT NULL) AND (material_id IS NULL) AND (pdf_id IS NULL)) OR ((kind = ''reading''::text) AND (material_id IS NOT NULL) AND (chapter_slug IS NULL) AND (pdf_id IS NULL)) OR ((kind = ''pdf''::text) AND (pdf_id IS NOT NULL) AND (chapter_slug IS NULL) AND (material_id IS NULL)) OR ((kind = ''class''::text) AND (num_nonnulls(chapter_slug, material_id, pdf_id) = 0) AND (COALESCE((locator ->> ''team''::text), ''''::text) ~ ''^[a-z0-9][a-z0-9-]{0,15}$''::text) AND (COALESCE((locator ->> ''materialId''::text), ''''::text) ~ ''^[1-9][0-9]{0,15}$''::text))))' ELSE 'CHECK ((((kind = ''textbook''::text) AND (chapter_slug IS NOT NULL) AND (material_id IS NULL) AND (pdf_id IS NULL)) OR ((kind = ''reading''::text) AND (material_id IS NOT NULL) AND (chapter_slug IS NULL) AND (pdf_id IS NULL)) OR ((kind = ''pdf''::text) AND (pdf_id IS NOT NULL) AND (chapter_slug IS NULL) AND (material_id IS NULL))))' END),
   ('vocabulary_contexts','PRIMARY KEY (id)','PRIMARY KEY (id)'),
   ('vocabulary_contexts','UNIQUE (user_id, vocabulary_id, source_key)','UNIQUE (user_id, vocabulary_id, source_key)'),
   ('vocabulary_contexts','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
   ('vocabulary_contexts','FOREIGN KEY (vocabulary_id) REFERENCES public.user_vocabulary(id) ON DELETE CASCADE','FOREIGN KEY (vocabulary_id) REFERENCES public.user_vocabulary(id) ON DELETE CASCADE'),
   ('vocabulary_contexts','FOREIGN KEY (material_id) REFERENCES public.reading_materials(id) ON DELETE CASCADE','FOREIGN KEY (material_id) REFERENCES public.reading_materials(id) ON DELETE CASCADE'),
   ('vocabulary_contexts','FOREIGN KEY (pdf_id) REFERENCES public.uploaded_pdfs(id) ON DELETE CASCADE','FOREIGN KEY (pdf_id) REFERENCES public.uploaded_pdfs(id) ON DELETE CASCADE'),
   ('vocabulary_exclusions','CHECK ((language = ANY (ARRAY[''Japanese''::text, ''Chinese''::text, ''English''::text, ''French''::text, ''Unknown''::text])))','CHECK ((language = ANY (ARRAY[''Japanese''::text, ''Chinese''::text, ''English''::text, ''French''::text, ''Korean''::text, ''Unknown''::text])))'),
   ('vocabulary_exclusions','CHECK (((length(word_text) >= 1) AND (length(word_text) <= 300)))','CHECK (((length(word_text) >= 1) AND (length(word_text) <= 300)))'),
   ('vocabulary_exclusions','PRIMARY KEY (id)','PRIMARY KEY (id)'),
   ('vocabulary_exclusions','UNIQUE (user_id, vocabulary_id)','UNIQUE (user_id, vocabulary_id)'),
   ('vocabulary_exclusions','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE','FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
   ('vocabulary_exclusions','FOREIGN KEY (vocabulary_id) REFERENCES public.user_vocabulary(id) ON DELETE SET NULL','FOREIGN KEY (vocabulary_id) REFERENCES public.user_vocabulary(id) ON DELETE SET NULL')) reviewed(tab,legacy_def,korean_def) WHERE reviewed.tab=t.relname AND pg_catalog.pg_get_constraintdef(c.oid) IN (reviewed.legacy_def,reviewed.korean_def)))
 THEN RAISE EXCEPTION 'korean_support_unexpected_constraint'; END IF;
 FOR r IN SELECT * FROM (VALUES
   ('public.save_vocabulary_context(jsonb,jsonb,uuid,text)','a31150064cf6db9288565e0c65844725','80acfe9427930f945f9ca0b07dbe8605','jsonb',2,ARRAY['p_word','p_source','p_confirm_id','p_confirm_meaning']::text[]),
   ('public.set_vocabulary_exclusion(text,text,uuid,boolean,uuid)','ab2fbcdce90647f4b36360c004aa50e0','026a8d6e4463b0b202bf0a6acb3fa65a','jsonb',1,ARRAY['p_language','p_word','p_vocabulary_id','p_excluded','p_exclusion_id']::text[]),
   ('public.lock_vocabulary_exclusion_owner()','0d6c6b7886c4264a3eea0310d4449e41','0d6c6b7886c4264a3eea0310d4449e41','trigger',0,NULL::text[]),
   ('public.preserve_deleted_vocabulary_exclusion()','79f0ef445d24e92c15fff8f4c179a629','79f0ef445d24e92c15fff8f4c179a629','trigger',0,NULL::text[]),
   ('public.guard_excluded_vocabulary()','ace98b29ea4c10a4d8b8950deda96bd7','ace98b29ea4c10a4d8b8950deda96bd7','trigger',0,NULL::text[]),
   ('public.guard_excluded_review_event()','69b5b53f1cc47887c81e8f4b9a70c06c','69b5b53f1cc47887c81e8f4b9a70c06c','trigger',0,NULL::text[]),
   ('public.sync_vocabulary_exclusion_identity()','8f484084d6216ba1bd6c1a1b0185d447','8f484084d6216ba1bd6c1a1b0185d447','trigger',0,NULL::text[]),
   ('public.sync_known_word_review_exclusion()','ced5892a8eb03cff1645d997dfca890e','fce35cab736c4986913d0e07043d67ce','trigger',0,NULL::text[]),
   ('public.guard_known_word_review_exclusion()','71ab352aa46bf375c16b2627c7dfbf0d','70d0bab5521ce7afa3956dc12bd60f10','trigger',0,NULL::text[])
 ) expected(signature,legacy_hash,korean_hash,return_type,default_count,argnames) LOOP
  IF modern AND r.signature='public.save_vocabulary_context(jsonb,jsonb,uuid,text)' THEN CONTINUE; END IF;
  SELECT * INTO installed_proc FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(r.signature);
  IF installed_proc.oid IS NULL OR pg_catalog.md5(installed_proc.prosrc) NOT IN (r.legacy_hash,r.korean_hash)
   OR installed_proc.prosecdef OR installed_proc.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
   OR installed_proc.prolang<>(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
   OR installed_proc.prorettype<>r.return_type::pg_catalog.regtype OR installed_proc.proretset OR installed_proc.proisstrict
   OR installed_proc.prokind<>'f' OR installed_proc.provolatile<>'v' OR installed_proc.pronargdefaults<>r.default_count
   OR pg_catalog.pg_get_expr(installed_proc.proargdefaults,0) IS DISTINCT FROM (CASE r.default_count WHEN 2 THEN 'NULL::uuid, NULL::text' WHEN 1 THEN 'NULL::uuid' ELSE NULL END)
   OR installed_proc.proargnames IS DISTINCT FROM r.argnames
   OR (modern AND installed_proc.proowner<>(SELECT relowner FROM pg_catalog.pg_class WHERE oid='public.user_vocabulary'::pg_catalog.regclass))
  THEN RAISE EXCEPTION 'korean_support_unexpected_function: %',r.signature; END IF;
  IF r.return_type='trigger' AND (pg_catalog.has_function_privilege('authenticated',r.signature,'EXECUTE') OR pg_catalog.has_function_privilege('anon',r.signature,'EXECUTE'))
  THEN RAISE EXCEPTION 'korean_support_unsafe_trigger_function_privileges: %',r.signature; END IF;
  IF modern AND ARRAY(SELECT CASE WHEN acl.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(acl.grantee)::text END
    FROM pg_catalog.aclexplode(coalesce(installed_proc.proacl,pg_catalog.acldefault('f',installed_proc.proowner))) acl
    WHERE acl.privilege_type='EXECUTE' ORDER BY 1) IS DISTINCT FROM
    (CASE WHEN r.return_type='trigger' THEN ARRAY['postgres','service_role']::text[] ELSE ARRAY['authenticated','postgres','service_role']::text[] END)
  THEN RAISE EXCEPTION 'korean_support_unexpected_modern_function_acl: %',r.signature; END IF;
  IF modern AND EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(installed_proc.proacl,pg_catalog.acldefault('f',installed_proc.proowner))) acl WHERE acl.is_grantable)
  THEN RAISE EXCEPTION 'korean_support_unexpected_modern_function_grant_option: %',r.signature; END IF;
 END LOOP;
 IF modern THEN
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='service_role' AND NOT rolsuper AND rolbypassrls)
  THEN RAISE EXCEPTION 'korean_support_unsupported_service_role'; END IF;
  IF (SELECT pg_catalog.pg_get_userbyid(relowner) FROM pg_catalog.pg_class WHERE oid='public.user_vocabulary'::pg_catalog.regclass)<>'postgres'
  THEN RAISE EXCEPTION 'korean_support_unexpected_modern_table_owner'; END IF;
  -- These are the complete, reviewed M09 bodies and security attributes.
  -- Shared wrapper/classroom/undo/analysis/source protection are dependencies,
  -- never replacement implementations. Only the _for Korean branch is extended.
  FOR r IN SELECT * FROM (VALUES
   ('public.save_vocabulary_context(jsonb,jsonb,uuid,text)','03b53aa8f7cdad5d23d503a26a873e61','03b53aa8f7cdad5d23d503a26a873e61',false,'sql','jsonb',2,'NULL::uuid, NULL::text',ARRAY['p_word','p_source','p_confirm_id','p_confirm_meaning']::text[],ARRAY['search_path=""']::text[]),
   ('public.save_vocabulary_context_for(uuid,jsonb,jsonb,uuid,text)','1facb74b4b7d33a572cef9642341342f','541ab691c7dc776410b8e746cf898319',false,'plpgsql','jsonb',2,'NULL::uuid, NULL::text',ARRAY['p_owner','p_word','p_source','p_confirm_id','p_confirm_meaning']::text[],ARRAY['search_path=""']::text[]),
   ('public.viewer_replace_analysis(bigint,text,jsonb,text,jsonb,uuid)','d9fa14687aa0b2afac161f4c6814781d','d9fa14687aa0b2afac161f4c6814781d',false,'plpgsql','jsonb',0,NULL::text,ARRAY['p_id','p_expected_raw','p_expected_json','p_raw','p_json','p_attempt']::text[],ARRAY['search_path=pg_catalog, public']::text[]),
   ('public.viewer_undo_vocabulary_save(uuid,jsonb,uuid[])','ace9c01a5df4556170e29f291bf0ed51','ace9c01a5df4556170e29f291bf0ed51',true,'plpgsql','boolean',0,NULL::text,ARRAY['p_id','p_expected','p_context_ids']::text[],ARRAY['search_path=pg_catalog, public']::text[]),
   ('public.classroom_save_vocabulary(uuid,bigint,integer,bigint,text,jsonb,jsonb,jsonb,jsonb,uuid,text)','f563cf7209213aa03433ca30be0fe4a5','f563cf7209213aa03433ca30be0fe4a5',false,'plpgsql','jsonb',3,'NULL::jsonb, NULL::uuid, NULL::text',ARRAY['p_owner','p_root','p_generation','p_material','p_expected_raw','p_expected_json','p_word','p_source','p_initial','p_confirm_id','p_confirm_meaning']::text[],ARRAY['search_path=""']::text[]),
   ('library_private.protect_source_delete()','306cf4349016b7a66408990ac48a4d63','306cf4349016b7a66408990ac48a4d63',false,'plpgsql','trigger',0,NULL::text,NULL::text[],ARRAY['search_path=""']::text[]),
   ('public.guard_source_passage_write()','3cca47555822970990d652c1a01205b8','3cca47555822970990d652c1a01205b8',false,'plpgsql','trigger',0,NULL::text,NULL::text[],ARRAY['search_path=pg_catalog, public']::text[]),
   ('public.library_book_preserve_metadata()','95b5dc5352234a531599207175baf099','95b5dc5352234a531599207175baf099',false,'plpgsql','trigger',0,NULL::text,NULL::text[],ARRAY['search_path=""']::text[]),
   ('public.validate_source_passage()','043b13610570a95efa49975299a123b2','043b13610570a95efa49975299a123b2',false,'plpgsql','trigger',0,NULL::text,NULL::text[],ARRAY['search_path=pg_catalog, public']::text[]),
   ('public.protect_composer_source()','dea10802e0aeaef706714fdace11a603','dea10802e0aeaef706714fdace11a603',false,'plpgsql','trigger',0,NULL::text,NULL::text[],ARRAY['search_path=pg_catalog, public']::text[])
  ) expected(signature,legacy_hash,korean_hash,definer,language,return_type,default_count,defaults_expr,argnames,config) LOOP
   SELECT * INTO installed_proc FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(r.signature);
   IF installed_proc.oid IS NULL OR pg_catalog.md5(installed_proc.prosrc) NOT IN (r.legacy_hash,r.korean_hash)
    OR installed_proc.prosecdef IS DISTINCT FROM r.definer OR installed_proc.proconfig IS DISTINCT FROM r.config
    OR installed_proc.prolang<>(SELECT oid FROM pg_catalog.pg_language WHERE lanname=r.language)
    OR installed_proc.prorettype<>r.return_type::pg_catalog.regtype OR installed_proc.proretset OR installed_proc.proisstrict
    OR installed_proc.prokind<>'f' OR installed_proc.provolatile<>'v' OR installed_proc.pronargdefaults<>r.default_count
    OR pg_catalog.pg_get_expr(installed_proc.proargdefaults,0) IS DISTINCT FROM r.defaults_expr
    OR installed_proc.proargnames IS DISTINCT FROM r.argnames
    OR installed_proc.proowner<>(SELECT relowner FROM pg_catalog.pg_class WHERE oid='public.user_vocabulary'::pg_catalog.regclass)
   THEN RAISE EXCEPTION 'korean_support_unexpected_modern_function: %',r.signature; END IF;
  END LOOP;
  FOR r IN SELECT * FROM (VALUES ('public.save_vocabulary_context(jsonb,jsonb,uuid,text)',ARRAY['authenticated','postgres','service_role']::text[]),
   ('public.save_vocabulary_context_for(uuid,jsonb,jsonb,uuid,text)',ARRAY['authenticated','postgres','service_role']::text[]),
   ('public.viewer_replace_analysis(bigint,text,jsonb,text,jsonb,uuid)',ARRAY['authenticated','postgres','service_role']::text[]),
   ('public.viewer_undo_vocabulary_save(uuid,jsonb,uuid[])',ARRAY['authenticated','postgres','service_role']::text[]),
   ('public.classroom_save_vocabulary(uuid,bigint,integer,bigint,text,jsonb,jsonb,jsonb,jsonb,uuid,text)',ARRAY['postgres','service_role']::text[]),
   ('library_private.protect_source_delete()',ARRAY['postgres']::text[]),
   ('public.guard_source_passage_write()',ARRAY['postgres','service_role']::text[]),
   ('public.library_book_preserve_metadata()',ARRAY['postgres','service_role']::text[]),
   ('public.validate_source_passage()',ARRAY['postgres','service_role']::text[]),
   ('public.protect_composer_source()',ARRAY['PUBLIC','anon','authenticated','postgres','service_role']::text[])) expected(signature,roles) LOOP
   IF ARRAY(SELECT CASE WHEN acl.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(acl.grantee)::text END
    FROM pg_catalog.pg_proc f CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(f.proacl,pg_catalog.acldefault('f',f.proowner))) acl
    WHERE f.oid=pg_catalog.to_regprocedure(r.signature) AND acl.privilege_type='EXECUTE' ORDER BY 1) IS DISTINCT FROM r.roles
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc f CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(f.proacl,pg_catalog.acldefault('f',f.proowner))) acl
     WHERE f.oid=pg_catalog.to_regprocedure(r.signature) AND acl.is_grantable)
   THEN RAISE EXCEPTION 'korean_support_unexpected_modern_function_acl: %',r.signature; END IF;
  END LOOP;
  IF pg_catalog.has_function_privilege('authenticated','public.classroom_save_vocabulary(uuid,bigint,integer,bigint,text,jsonb,jsonb,jsonb,jsonb,uuid,text)','EXECUTE')
   OR pg_catalog.has_function_privilege('anon','public.classroom_save_vocabulary(uuid,bigint,integer,bigint,text,jsonb,jsonb,jsonb,jsonb,uuid,text)','EXECUTE')
   OR NOT pg_catalog.has_function_privilege('service_role','public.classroom_save_vocabulary(uuid,bigint,integer,bigint,text,jsonb,jsonb,jsonb,jsonb,uuid,text)','EXECUTE')
   OR NOT pg_catalog.has_function_privilege('authenticated','public.save_vocabulary_context_for(uuid,jsonb,jsonb,uuid,text)','EXECUTE')
   OR NOT pg_catalog.has_function_privilege('service_role','public.save_vocabulary_context_for(uuid,jsonb,jsonb,uuid,text)','EXECUTE')
   OR pg_catalog.has_function_privilege('anon','public.save_vocabulary_context_for(uuid,jsonb,jsonb,uuid,text)','EXECUTE')
  THEN RAISE EXCEPTION 'korean_support_unsafe_modern_rpc_privileges'; END IF;
  FOR r IN SELECT * FROM (VALUES ('user_vocabulary',ARRAY['anon:DELETE','anon:INSERT','anon:MAINTAIN','anon:REFERENCES','anon:SELECT','anon:TRIGGER','anon:TRUNCATE','anon:UPDATE','authenticated:DELETE','authenticated:INSERT','authenticated:MAINTAIN','authenticated:REFERENCES','authenticated:SELECT','authenticated:TRIGGER','authenticated:TRUNCATE','authenticated:UPDATE','postgres:DELETE','postgres:INSERT','postgres:MAINTAIN','postgres:REFERENCES','postgres:SELECT','postgres:TRIGGER','postgres:TRUNCATE','postgres:UPDATE','service_role:DELETE','service_role:INSERT','service_role:MAINTAIN','service_role:REFERENCES','service_role:SELECT','service_role:TRIGGER','service_role:TRUNCATE','service_role:UPDATE']::text[],ARRAY['authenticated:DELETE','authenticated:INSERT','authenticated:MAINTAIN','authenticated:REFERENCES','authenticated:SELECT','authenticated:TRIGGER','authenticated:UPDATE','postgres:DELETE','postgres:INSERT','postgres:MAINTAIN','postgres:REFERENCES','postgres:SELECT','postgres:TRIGGER','postgres:TRUNCATE','postgres:UPDATE','service_role:DELETE','service_role:INSERT','service_role:MAINTAIN','service_role:REFERENCES','service_role:SELECT','service_role:TRIGGER','service_role:TRUNCATE','service_role:UPDATE']::text[]),
   ('review_events',ARRAY['anon:DELETE','anon:INSERT','anon:MAINTAIN','anon:REFERENCES','anon:SELECT','anon:TRIGGER','anon:TRUNCATE','anon:UPDATE','authenticated:DELETE','authenticated:INSERT','authenticated:MAINTAIN','authenticated:REFERENCES','authenticated:SELECT','authenticated:TRIGGER','authenticated:TRUNCATE','authenticated:UPDATE','postgres:DELETE','postgres:INSERT','postgres:MAINTAIN','postgres:REFERENCES','postgres:SELECT','postgres:TRIGGER','postgres:TRUNCATE','postgres:UPDATE','service_role:DELETE','service_role:INSERT','service_role:MAINTAIN','service_role:REFERENCES','service_role:SELECT','service_role:TRIGGER','service_role:TRUNCATE','service_role:UPDATE']::text[],ARRAY['authenticated:DELETE','authenticated:INSERT','authenticated:MAINTAIN','authenticated:REFERENCES','authenticated:SELECT','authenticated:TRIGGER','authenticated:UPDATE','postgres:DELETE','postgres:INSERT','postgres:MAINTAIN','postgres:REFERENCES','postgres:SELECT','postgres:TRIGGER','postgres:TRUNCATE','postgres:UPDATE','service_role:DELETE','service_role:INSERT','service_role:MAINTAIN','service_role:REFERENCES','service_role:SELECT','service_role:TRIGGER','service_role:TRUNCATE','service_role:UPDATE']::text[]),
   ('user_known_words',ARRAY['authenticated:DELETE','authenticated:INSERT','authenticated:MAINTAIN','authenticated:REFERENCES','authenticated:SELECT','authenticated:TRIGGER','authenticated:TRUNCATE','authenticated:UPDATE','postgres:DELETE','postgres:INSERT','postgres:MAINTAIN','postgres:REFERENCES','postgres:SELECT','postgres:TRIGGER','postgres:TRUNCATE','postgres:UPDATE','service_role:DELETE','service_role:INSERT','service_role:MAINTAIN','service_role:REFERENCES','service_role:SELECT','service_role:TRIGGER','service_role:TRUNCATE','service_role:UPDATE']::text[],ARRAY['authenticated:DELETE','authenticated:INSERT','authenticated:MAINTAIN','authenticated:REFERENCES','authenticated:SELECT','authenticated:TRIGGER','authenticated:UPDATE','postgres:DELETE','postgres:INSERT','postgres:MAINTAIN','postgres:REFERENCES','postgres:SELECT','postgres:TRIGGER','postgres:TRUNCATE','postgres:UPDATE','service_role:DELETE','service_role:INSERT','service_role:MAINTAIN','service_role:REFERENCES','service_role:SELECT','service_role:TRIGGER','service_role:TRUNCATE','service_role:UPDATE']::text[]),
   ('vocabulary_contexts',ARRAY['authenticated:DELETE','authenticated:INSERT','authenticated:SELECT','postgres:DELETE','postgres:INSERT','postgres:MAINTAIN','postgres:REFERENCES','postgres:SELECT','postgres:TRIGGER','postgres:TRUNCATE','postgres:UPDATE','service_role:DELETE','service_role:INSERT','service_role:MAINTAIN','service_role:REFERENCES','service_role:SELECT','service_role:TRIGGER','service_role:TRUNCATE','service_role:UPDATE']::text[],ARRAY['authenticated:DELETE','authenticated:INSERT','authenticated:SELECT','postgres:DELETE','postgres:INSERT','postgres:MAINTAIN','postgres:REFERENCES','postgres:SELECT','postgres:TRIGGER','postgres:TRUNCATE','postgres:UPDATE','service_role:DELETE','service_role:INSERT','service_role:MAINTAIN','service_role:REFERENCES','service_role:SELECT','service_role:TRIGGER','service_role:TRUNCATE','service_role:UPDATE']::text[]),
   ('vocabulary_exclusions',ARRAY['authenticated:DELETE','authenticated:INSERT','authenticated:SELECT','authenticated:UPDATE','postgres:DELETE','postgres:INSERT','postgres:MAINTAIN','postgres:REFERENCES','postgres:SELECT','postgres:TRIGGER','postgres:TRUNCATE','postgres:UPDATE','service_role:DELETE','service_role:INSERT','service_role:MAINTAIN','service_role:REFERENCES','service_role:SELECT','service_role:TRIGGER','service_role:TRUNCATE','service_role:UPDATE']::text[],ARRAY['authenticated:DELETE','authenticated:INSERT','authenticated:SELECT','authenticated:UPDATE','postgres:DELETE','postgres:INSERT','postgres:MAINTAIN','postgres:REFERENCES','postgres:SELECT','postgres:TRIGGER','postgres:TRUNCATE','postgres:UPDATE','service_role:DELETE','service_role:INSERT','service_role:MAINTAIN','service_role:REFERENCES','service_role:SELECT','service_role:TRIGGER','service_role:TRUNCATE','service_role:UPDATE']::text[]),
   ('active_vocabulary',ARRAY['authenticated:SELECT','postgres:DELETE','postgres:INSERT','postgres:MAINTAIN','postgres:REFERENCES','postgres:SELECT','postgres:TRIGGER','postgres:TRUNCATE','postgres:UPDATE','service_role:DELETE','service_role:INSERT','service_role:MAINTAIN','service_role:REFERENCES','service_role:SELECT','service_role:TRIGGER','service_role:TRUNCATE','service_role:UPDATE']::text[],ARRAY['authenticated:SELECT','postgres:DELETE','postgres:INSERT','postgres:MAINTAIN','postgres:REFERENCES','postgres:SELECT','postgres:TRIGGER','postgres:TRUNCATE','postgres:UPDATE','service_role:DELETE','service_role:INSERT','service_role:MAINTAIN','service_role:REFERENCES','service_role:SELECT','service_role:TRIGGER','service_role:TRUNCATE','service_role:UPDATE']::text[]),
   ('vocabulary_with_exclusions',ARRAY['authenticated:SELECT','postgres:DELETE','postgres:INSERT','postgres:MAINTAIN','postgres:REFERENCES','postgres:SELECT','postgres:TRIGGER','postgres:TRUNCATE','postgres:UPDATE','service_role:DELETE','service_role:INSERT','service_role:MAINTAIN','service_role:REFERENCES','service_role:SELECT','service_role:TRIGGER','service_role:TRUNCATE','service_role:UPDATE']::text[],ARRAY['authenticated:SELECT','postgres:DELETE','postgres:INSERT','postgres:MAINTAIN','postgres:REFERENCES','postgres:SELECT','postgres:TRIGGER','postgres:TRUNCATE','postgres:UPDATE','service_role:DELETE','service_role:INSERT','service_role:MAINTAIN','service_role:REFERENCES','service_role:SELECT','service_role:TRIGGER','service_role:TRUNCATE','service_role:UPDATE']::text[])) expected(tab,before_acl,after_acl) LOOP
   SELECT ARRAY(SELECT CASE WHEN acl.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(acl.grantee)::text END||':'||acl.privilege_type
    FROM pg_catalog.pg_class c CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) acl
    WHERE c.oid=pg_catalog.to_regclass('public.'||r.tab) ORDER BY 1)::text INTO def;
   IF (def::text[] IS DISTINCT FROM r.before_acl AND def::text[] IS DISTINCT FROM r.after_acl)
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_class c CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) acl WHERE c.oid=pg_catalog.to_regclass('public.'||r.tab) AND acl.is_grantable)
   THEN RAISE EXCEPTION 'korean_support_unexpected_modern_relation_acl: %',r.tab; END IF;
  END LOOP;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid IN ('public.user_vocabulary'::pg_catalog.regclass,'public.review_events'::pg_catalog.regclass,'public.user_known_words'::pg_catalog.regclass,'public.vocabulary_contexts'::pg_catalog.regclass,'public.vocabulary_exclusions'::pg_catalog.regclass) AND a.attnum>0 AND NOT a.attisdropped AND a.attacl IS NOT NULL)
 THEN RAISE EXCEPTION 'korean_support_unexpected_learning_column_acl'; END IF;
 -- Known/context/exclusion policies are the committed, owner-scoped contract.
 FOR r IN SELECT * FROM (VALUES
   ('user_known_words','user_known_words_delete_own','5aa1b76c7db798b1bc076c00da396b1a'),
   ('user_known_words','user_known_words_insert_own','c6131b84cf0c36af6d1d5d57c382bc5a'),
   ('user_known_words','user_known_words_select_own','8a1b3dbbadb76db8dce6ed89b7d3c309'),
   ('vocabulary_contexts','vocabulary_contexts_delete','5e89a55d2e8264026e0036cdf41cb39a'),
   ('vocabulary_contexts','vocabulary_contexts_insert','075762a417947f450b5d0dd424bf2a50'),
   ('vocabulary_contexts','vocabulary_contexts_read','54bd0bdce05f500318e95579dde19bc2'),
   ('vocabulary_exclusions','vocabulary_exclusion_owner','8ecc1c8016ca2dc921fbb085fcfafd2a')
 ) expected(tab,name,hash) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid
   WHERE c.relnamespace='public'::pg_catalog.regnamespace AND c.relname=r.tab AND p.polname=r.name
   AND pg_catalog.md5(row(p.polcmd,p.polpermissive,ARRAY(SELECT CASE WHEN role_oid=0 THEN 'PUBLIC' ELSE (SELECT rolname::text FROM pg_catalog.pg_roles WHERE oid=role_oid) END FROM unnest(p.polroles) role_oid ORDER BY 1),pg_catalog.pg_get_expr(p.polqual,p.polrelid),pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid))::text)=r.hash)
  THEN RAISE EXCEPTION 'korean_support_unexpected_policy: %.%',r.tab,r.name; END IF;
 END LOOP;
 IF modern AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy p WHERE p.polrelid='public.vocabulary_contexts'::pg_catalog.regclass
  AND p.polname='vocabulary_class_context_read' AND pg_catalog.md5(row(p.polcmd,p.polpermissive,ARRAY(SELECT CASE WHEN role_oid=0 THEN 'PUBLIC' ELSE (SELECT rolname::text FROM pg_catalog.pg_roles WHERE oid=role_oid) END FROM unnest(p.polroles) role_oid ORDER BY 1),pg_catalog.pg_get_expr(p.polqual,p.polrelid),pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid))::text)='419dbf2cb6d3b0b71986b2dc919f5e3c')
 THEN RAISE EXCEPTION 'korean_support_unexpected_class_policy'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid
  WHERE c.relnamespace='public'::pg_catalog.regnamespace AND c.relname IN ('vocabulary_contexts','user_known_words','vocabulary_exclusions'))<>7+(CASE WHEN modern THEN 1 ELSE 0 END)
 THEN RAISE EXCEPTION 'korean_support_additional_policy'; END IF;
 FOR r IN SELECT * FROM (VALUES
   ('review_events','guard_excluded_review_event','guard_excluded_review_event',7,'1496652189ebc1244abc11d64cec7da5'),
   ('user_known_words','lock_known_word_owner','lock_vocabulary_exclusion_owner',14,'c1bf2ffe619e2a44b2020ff79458dda9'),
   ('user_known_words','sync_known_word_review_exclusion','sync_known_word_review_exclusion',13,'49169c8042b4d2cf79b8895c5aa6c9b9'),
   ('user_vocabulary','guard_excluded_vocabulary','guard_excluded_vocabulary',23,'2ce904f752143cd6f2ac8ab6fc2b2259'),
   ('user_vocabulary','lock_vocabulary_exclusion_owner','lock_vocabulary_exclusion_owner',30,'a7450562eb615509d831e1f7ce431bed'),
   ('user_vocabulary','preserve_deleted_vocabulary_exclusion','preserve_deleted_vocabulary_exclusion',11,'e69871d5647f21b6d5eb2717da254370'),
   ('user_vocabulary','sync_vocabulary_exclusion_identity','sync_vocabulary_exclusion_identity',17,'7162279ca343e26a0aaf5f6df7847b91'),
   ('vocabulary_exclusions','guard_known_word_review_exclusion','guard_known_word_review_exclusion',27,'5808df33cb4c3b478bbc031d40c6577b'),
   ('vocabulary_exclusions','lock_exclusion_owner','lock_vocabulary_exclusion_owner',30,'3c0d6d56b2ef1f6f3fdbfa0874f4f1d6')
 ) expected(tab,name,fn,type,hash) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
   WHERE c.relnamespace='public'::pg_catalog.regnamespace AND c.relname=r.tab AND t.tgname=r.name
   AND p.pronamespace='public'::pg_catalog.regnamespace AND p.proname=r.fn AND t.tgtype=r.type AND t.tgenabled='O' AND t.tgqual IS NULL
   AND pg_catalog.md5(pg_catalog.pg_get_triggerdef(t.oid))=r.hash)
  THEN RAISE EXCEPTION 'korean_support_missing_guard: %.%',r.tab,r.name; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
  WHERE c.relnamespace='public'::pg_catalog.regnamespace AND c.relname IN ('user_vocabulary','vocabulary_contexts','user_known_words','vocabulary_exclusions','review_events') AND NOT t.tgisinternal
  AND NOT EXISTS(SELECT 1 FROM (VALUES ('review_events','guard_excluded_review_event'),('user_known_words','lock_known_word_owner'),('user_known_words','sync_known_word_review_exclusion'),('user_vocabulary','guard_excluded_vocabulary'),('user_vocabulary','lock_vocabulary_exclusion_owner'),('user_vocabulary','preserve_deleted_vocabulary_exclusion'),('user_vocabulary','sync_vocabulary_exclusion_identity'),('vocabulary_exclusions','guard_known_word_review_exclusion'),('vocabulary_exclusions','lock_exclusion_owner')) reviewed(tab,name) WHERE reviewed.tab=c.relname AND reviewed.name=t.tgname)
  AND t.tgname<>'guard_korean_learning_contract')
 THEN RAISE EXCEPTION 'korean_support_unexpected_trigger'; END IF;
 FOR r IN SELECT * FROM (VALUES ('active_vocabulary',CASE WHEN modern THEN '008081605dbf386a9242ac58bbfbd02f' ELSE '13c5a7ace84559e11eb69b4a34cd0c07' END),('vocabulary_with_exclusions',CASE WHEN modern THEN 'e171e8add613931bf2d3cbf25056a1f2' ELSE 'b93ad83e32686013f426dad9e646600f' END)) expected(name,hash) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.relnamespace='public'::pg_catalog.regnamespace
   AND c.relname=r.name AND c.relkind='v' AND c.reloptions @> ARRAY['security_invoker=true']
   AND pg_catalog.md5(pg_catalog.pg_get_viewdef(c.oid,true))=r.hash)
  THEN RAISE EXCEPTION 'korean_support_unexpected_view: %',r.name; END IF;
 END LOOP;
 -- Modern owner policies deliberately remain TO PUBLIC. The separate table
 -- privilege reduction below removes anonymous learner-table access; do not
 -- rewrite this observed owner/classroom contract into an older fixture.
 IF modern THEN
  FOR r IN SELECT * FROM (VALUES ('review_events','review_events_insert_own','c6a869d98ef0e16b67620cfaf91ce3bb'),
   ('review_events','review_events_select_own','398dbb737a36f04aa03253a26622ddb6'),
   ('user_vocabulary','Users can manage own vocabulary','6213f559ecfd5172b4408cc31d4f0b82')) expected(tab,name,hash) LOOP
   IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy p WHERE p.polrelid=pg_catalog.to_regclass('public.'||r.tab)
    AND p.polname=r.name AND pg_catalog.md5(row(p.polcmd,p.polpermissive,ARRAY(SELECT CASE WHEN role_oid=0 THEN 'PUBLIC' ELSE (SELECT rolname::text FROM pg_catalog.pg_roles WHERE oid=role_oid) END FROM unnest(p.polroles) role_oid ORDER BY 1),pg_catalog.pg_get_expr(p.polqual,p.polrelid),pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid))::text)=r.hash)
   THEN RAISE EXCEPTION 'korean_support_unexpected_modern_owner_policy: %.%',r.tab,r.name; END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_catalog.pg_policy p WHERE p.polrelid IN ('public.user_vocabulary'::pg_catalog.regclass,'public.review_events'::pg_catalog.regclass))<>3
  THEN RAISE EXCEPTION 'korean_support_additional_modern_owner_policy'; END IF;
 END IF;
 FOR r IN SELECT c.relname,p.polname,p.polcmd,p.polroles,p.polpermissive,
  pg_catalog.pg_get_expr(p.polqual,p.polrelid) qual,pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid) chk
  FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid
  WHERE c.relnamespace='public'::pg_catalog.regnamespace AND c.relname IN ('user_vocabulary','review_events') LOOP
  IF NOT r.polpermissive THEN RAISE EXCEPTION 'korean_support_unreviewed_restrictive_policy: %.%',r.relname,r.polname; END IF;
  IF r.polpermissive THEN
   IF r.polroles IS DISTINCT FROM (CASE WHEN modern THEN ARRAY[0]::oid[] ELSE ARRAY[(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='authenticated')]::oid[] END)
    THEN RAISE EXCEPTION 'korean_support_unexpected_owner_roles: %.%',r.relname,r.polname; END IF;
   FOREACH owner_expr IN ARRAY ARRAY[r.qual,r.chk] LOOP
    IF owner_expr IS NOT NULL AND pg_catalog.regexp_replace(owner_expr,'[()\s]','','g') NOT IN
     ('user_id=auth.uid','auth.uid=user_id','user_id=SELECTauth.uidASuid','SELECTauth.uidASuid=user_id')
    THEN RAISE EXCEPTION 'korean_support_unexpected_owner_policy: %.%',r.relname,r.polname; END IF;
   END LOOP;
   IF (r.polcmd IN ('*','r','w','d') AND r.qual IS NULL) OR (r.polcmd='a' AND r.chk IS NULL)
   THEN RAISE EXCEPTION 'korean_support_missing_owner_predicate: %.%',r.relname,r.polname; END IF;
  END IF;
 END LOOP;
 FOR r IN SELECT * FROM (VALUES ('user_vocabulary','r'),('user_vocabulary','a'),('user_vocabulary','w'),('review_events','r'),('review_events','a')) required(tab,cmd) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy p WHERE p.polrelid=pg_catalog.to_regclass('public.'||r.tab)
   AND p.polpermissive AND p.polcmd::text IN ('*',r.cmd)
   AND p.polroles=CASE WHEN modern THEN ARRAY[0]::oid[] ELSE ARRAY[(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='authenticated')]::oid[] END)
  THEN RAISE EXCEPTION 'korean_support_missing_owner_policy: %.%',r.tab,r.cmd; END IF;
 END LOOP;
 FOR r IN SELECT unnest(ARRAY['user_vocabulary','vocabulary_contexts','user_known_words','vocabulary_exclusions','review_events']) tab LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid=pg_catalog.to_regclass('public.'||r.tab) AND relrowsecurity AND relkind='r')
   OR NOT pg_catalog.has_table_privilege('authenticated','public.'||r.tab,'SELECT')
   OR NOT pg_catalog.has_table_privilege('authenticated','public.'||r.tab,'INSERT')
   OR (NOT modern AND pg_catalog.has_table_privilege('anon','public.'||r.tab,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'))
   OR (NOT modern AND pg_catalog.has_table_privilege('authenticated','public.'||r.tab,'TRUNCATE'))
  THEN RAISE EXCEPTION 'korean_support_unsafe_table_privileges_or_rls: %',r.tab; END IF;
 END LOOP;
 IF NOT pg_catalog.has_table_privilege('authenticated','public.user_vocabulary','UPDATE')
  OR NOT pg_catalog.has_table_privilege('authenticated','public.user_known_words','DELETE')
  OR NOT pg_catalog.has_table_privilege('authenticated','public.vocabulary_exclusions','UPDATE')
  OR NOT pg_catalog.has_table_privilege('authenticated','public.vocabulary_exclusions','DELETE')
 THEN RAISE EXCEPTION 'korean_support_missing_write_privileges'; END IF;
 FOR r IN SELECT unnest(ARRAY['public.save_vocabulary_context(jsonb,jsonb,uuid,text)','public.set_vocabulary_exclusion(text,text,uuid,boolean,uuid)']) signature LOOP
  IF NOT pg_catalog.has_function_privilege('authenticated',r.signature,'EXECUTE') OR pg_catalog.has_function_privilege('anon',r.signature,'EXECUTE')
  THEN RAISE EXCEPTION 'korean_support_unsafe_rpc_privileges: %',r.signature; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_index WHERE indrelid='public.user_vocabulary'::pg_catalog.regclass AND indisunique AND indisvalid AND indpred IS NULL
  AND (SELECT array_agg(a.attname::text ORDER BY x.ord) FROM unnest(indkey::smallint[]) WITH ORDINALITY x(num,ord) JOIN pg_catalog.pg_attribute a ON a.attrelid=indrelid AND a.attnum=x.num)=ARRAY['user_id','word_text'])
 THEN RAISE EXCEPTION 'korean_support_missing_vocabulary_uniqueness'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_index WHERE indrelid='public.vocabulary_contexts'::pg_catalog.regclass AND indisunique AND indisvalid AND indpred IS NULL
  AND (SELECT array_agg(a.attname::text ORDER BY x.ord) FROM unnest(indkey::smallint[]) WITH ORDINALITY x(num,ord) JOIN pg_catalog.pg_attribute a ON a.attrelid=indrelid AND a.attnum=x.num)=ARRAY['user_id','vocabulary_id','source_key'])
 THEN RAISE EXCEPTION 'korean_support_missing_context_uniqueness'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_index WHERE indrelid='public.vocabulary_exclusions'::pg_catalog.regclass AND indisunique AND indisvalid
  AND pg_catalog.pg_get_expr(indpred,indrelid)='(vocabulary_id IS NULL)'
  AND (SELECT array_agg(a.attname::text ORDER BY x.ord) FROM unnest(indkey::smallint[]) WITH ORDINALITY x(num,ord) JOIN pg_catalog.pg_attribute a ON a.attrelid=indrelid AND a.attnum=x.num)=ARRAY['user_id','language','word_text'])
 THEN RAISE EXCEPTION 'korean_support_missing_exclusion_uniqueness'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_class t ON t.oid=c.conrelid
  WHERE t.relnamespace='public'::pg_catalog.regnamespace AND t.relname IN ('user_vocabulary','review_events') AND c.contype='c'
  AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid=c.conrelid AND a.attname=CASE t.relname WHEN 'user_vocabulary' THEN 'language' ELSE 'lang' END AND a.attnum=ANY(c.conkey)))
 THEN RAISE EXCEPTION 'korean_support_unreviewed_original_table_check'; END IF;
 -- Only understood text-language checks are widened. Complex/unknown checks fail.
 FOR r IN SELECT * FROM (VALUES ('user_vocabulary','language',false,false),('vocabulary_contexts','lang',true,false),('vocabulary_exclusions','language',true,true),('review_events','lang',false,false)) spec(tab,col,required,unknown_allowed) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid=pg_catalog.to_regclass('public.'||r.tab) AND attname=r.col AND atttypid='text'::pg_catalog.regtype AND NOT attisdropped)
  THEN RAISE EXCEPTION 'korean_support_unexpected_language_type: %.%',r.tab,r.col; END IF;
  known_check_count:=0;
  FOR language_check IN SELECT con.*,pg_catalog.pg_get_expr(con.conbin,con.conrelid) expr FROM pg_catalog.pg_constraint con
   JOIN pg_catalog.pg_attribute a ON a.attrelid=con.conrelid AND a.attname=r.col
   WHERE con.conrelid=pg_catalog.to_regclass('public.'||r.tab) AND con.contype='c' AND a.attnum=ANY(con.conkey) LOOP
   expr:=language_check.expr;
   before_expr:='('||r.col||' = ANY (ARRAY[''Japanese''::text, ''Chinese''::text, ''English''::text, ''French''::text'||CASE WHEN r.unknown_allowed THEN ', ''Unknown''::text' ELSE '' END||']))';
   after_expr:=replace(before_expr,'''French''::text','''French''::text, ''Korean''::text');
   IF NOT language_check.convalidated OR expr NOT IN (before_expr,after_expr)
   THEN RAISE EXCEPTION 'korean_support_unexpected_language_check: %.%: %',r.tab,language_check.conname,expr; END IF;
   known_check_count:=known_check_count+1;
  END LOOP;
  IF r.required AND known_check_count<>1 THEN RAISE EXCEPTION 'korean_support_missing_language_check: %',r.tab; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='public.user_known_words'::pg_catalog.regclass AND contype='c' AND convalidated AND pg_catalog.pg_get_expr(conbin,conrelid)='(lang ~ ''^[a-z]{2}$''::text)')
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_attribute a ON a.attrelid=c.conrelid AND a.attname='lang' WHERE c.conrelid='public.user_known_words'::pg_catalog.regclass AND c.contype='c' AND a.attnum=ANY(c.conkey) AND pg_catalog.pg_get_expr(c.conbin,c.conrelid)<>'(lang ~ ''^[a-z]{2}$''::text)')
 THEN RAISE EXCEPTION 'korean_support_unexpected_known_language_check'; END IF;
END $preflight$;

-- Approved protective reduction only: do not alter owner policies, legitimate
-- authenticated CRUD, service-role permissions, or adjacent source-table ACLs.
REVOKE ALL ON public.user_vocabulary,public.review_events FROM anon;
REVOKE TRUNCATE ON public.user_vocabulary,public.review_events,public.user_known_words FROM authenticated;
DO $privileges$
DECLARE tab text;
BEGIN
 FOREACH tab IN ARRAY ARRAY['user_vocabulary','vocabulary_contexts','user_known_words','vocabulary_exclusions','review_events'] LOOP
  IF pg_catalog.has_table_privilege('anon','public.'||tab,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   OR pg_catalog.has_table_privilege('authenticated','public.'||tab,'TRUNCATE')
  THEN RAISE EXCEPTION 'korean_support_unsafe_effective_privileges: %',tab; END IF;
 END LOOP;
END $privileges$;

-- Existing verified v1 contract guards would reject administrative re-enable
-- after rollback. Suspend only these guards while all affected writes are locked;
-- the transaction restores them before publishing a fresh catalog fingerprint.
DO $suspend$
DECLARE tab text;
BEGIN
 FOREACH tab IN ARRAY ARRAY['user_vocabulary','vocabulary_contexts','user_known_words','vocabulary_exclusions','review_events'] LOOP
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid=pg_catalog.to_regclass('public.'||tab) AND tgname='guard_korean_learning_contract')
  THEN EXECUTE pg_catalog.format('ALTER TABLE public.%I DISABLE TRIGGER guard_korean_learning_contract',tab); END IF;
 END LOOP;
END $suspend$;

DO $extend$
DECLARE r record; definition text; before_hash text; after_hash text; body text;
BEGIN
 FOR r IN SELECT * FROM (VALUES ('user_vocabulary','language'),('vocabulary_contexts','lang'),('vocabulary_exclusions','language'),('review_events','lang')) spec(tab,col) LOOP
  FOR definition IN SELECT pg_catalog.format('ALTER TABLE public.%I DROP CONSTRAINT %I; ALTER TABLE public.%I ADD CONSTRAINT %I %s',r.tab,c.conname,r.tab,c.conname,
   replace(pg_catalog.pg_get_constraintdef(c.oid),'''French''::text','''French''::text, ''Korean''::text'))
   FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_attribute a ON a.attrelid=c.conrelid AND a.attname=r.col
   WHERE c.conrelid=pg_catalog.to_regclass('public.'||r.tab) AND c.contype='c' AND a.attnum=ANY(c.conkey)
   AND position('''Korean''' in pg_catalog.pg_get_constraintdef(c.oid))=0
  LOOP EXECUTE definition; END LOOP;
 END LOOP;
 SELECT pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.save_vocabulary_context(jsonb,jsonb,uuid,text)')),prosrc INTO definition,body FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('public.save_vocabulary_context(jsonb,jsonb,uuid,text)');
 IF pg_catalog.md5(body)='a31150064cf6db9288565e0c65844725' THEN
  definition:=replace(definition,body,'
declare
  v public.user_vocabulary%rowtype;
  who uuid := auth.uid();
  created boolean := false;
  added integer;
  matches integer;
  word text := btrim(p_word->>''word_text'');
  meaning text := btrim(p_word->>''meaning'');
begin
  if who is null then raise exception ''login_required'' using errcode=''42501''; end if;
  if word is null or length(word) not between 1 and 300 or meaning is null or length(meaning) not between 1 and 2000
    or p_word->>''language'' is null or p_word->>''language'' not in (''Japanese'',''Chinese'',''English'',''French'',''Korean'')
    or (p_word->>''language''=''Korean'' and p_source->>''kind''<>''reading'')
    or p_source->>''kind'' is null or p_source->>''kind'' not in (''textbook'',''reading'',''pdf'')
    then raise exception ''invalid_context'' using errcode=''22023''; end if;

  if p_word->>''language''=''Korean'' then
    if (public.learning_language_capabilities()->''languages''->''Korean''->>''save'')::boolean is distinct from true
      then raise exception ''korean_learning_not_ready'' using errcode=''55000''; end if;
    if p_word ?| array[''interval'',''ease_factor'',''repetitions'',''next_review_at''] then
      if jsonb_typeof(p_word->''interval'') is distinct from ''number''
        or jsonb_typeof(p_word->''ease_factor'') is distinct from ''number''
        or jsonb_typeof(p_word->''repetitions'') is distinct from ''number''
        or jsonb_typeof(p_word->''next_review_at'') is distinct from ''string''
        then raise exception ''invalid_initial_schedule'' using errcode=''22023''; end if;
      if (p_word->>''interval'')::numeric not between 0 and 36500
        or (p_word->>''ease_factor'')::numeric not between 1 and 10
        or (p_word->>''repetitions'')::numeric not between 0 and 100000
        or (p_word->>''repetitions'')::numeric<>trunc((p_word->>''repetitions'')::numeric)
        or not isfinite((p_word->>''next_review_at'')::timestamptz)
        then raise exception ''invalid_initial_schedule'' using errcode=''22023''; end if;
    end if;
  end if;

  -- 예전 뷰어가 활용형(word_text=books, base_form=book)으로 저장한 카드도 재사용한다.
  -- 후보가 여러 개면 추측해서 새 카드를 만들거나 임의로 합치지 않는다.
  select * into v from public.user_vocabulary where user_id=who and word_text=word for update;
  if not found then
    select count(*) into matches from public.user_vocabulary where user_id=who and language=p_word->>''language'' and base_form=word;
    if matches > 1 then raise exception ''vocabulary_ambiguous_match''; end if;
    if matches = 1 then
      select * into v from public.user_vocabulary where user_id=who and language=p_word->>''language'' and base_form=word for update;
    end if;
  end if;
  if v.id is null then
    insert into public.user_vocabulary(user_id,word_text,base_form,meaning,furigana,pos,language,source_sentence,source_material_id,next_review_at)
    values(who,word,word,meaning,coalesce(p_word->>''furigana'',''''),coalesce(p_word->>''pos'',''''),p_word->>''language'',p_source->>''quote'',
      case when p_source->>''kind''=''reading'' then (p_source->>''materialId'')::bigint end,now())
    on conflict(user_id,word_text) do nothing returning * into v;
    created := found;
    if created and p_word->>''language''=''Korean'' and p_word ? ''interval'' then
      update public.user_vocabulary set interval=(p_word->>''interval'')::real,
        ease_factor=(p_word->>''ease_factor'')::real,repetitions=(p_word->>''repetitions'')::integer,
        next_review_at=(p_word->>''next_review_at'')::timestamptz where id=v.id and user_id=who returning * into v;
    end if;
  end if;
  if not created and v.id is null then
    select * into v from public.user_vocabulary where user_id=who and word_text=word for update;
    if not found then raise exception ''word_not_available''; end if;
  end if;
  if not created then
    if v.language is distinct from p_word->>''language'' then raise exception ''vocabulary_language_conflict''; end if;
    if btrim(coalesce(v.meaning,'''')) <> meaning and not (
      p_confirm_id is not null and v.id=p_confirm_id and v.meaning is not distinct from p_confirm_meaning
    ) then raise exception ''vocabulary_meaning_conflict'' using detail=v.id::text; end if;
  end if;

  insert into public.vocabulary_contexts(user_id,vocabulary_id,kind,lang,chapter_slug,material_id,pdf_id,locator,quote,translation,source_key)
  values(who,v.id,p_source->>''kind'',p_word->>''language'',p_source->>''chapterSlug'',
    (p_source->>''materialId'')::bigint,(p_source->>''pdfId'')::uuid,coalesce(p_source->''locator'',''{}''::jsonb),
    p_source->>''quote'',coalesce(p_source->>''translation'',''''),
    md5((p_source - ''translation'')::text))
  on conflict(user_id,vocabulary_id,source_key) do nothing;
  get diagnostics added = row_count;
  return jsonb_build_object(''vocabularyId'',v.id,''created'',created,''contextAdded'',added>0);
end ');
  EXECUTE definition;
 END IF;
 SELECT pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.set_vocabulary_exclusion(text,text,uuid,boolean,uuid)')),prosrc INTO definition,body FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('public.set_vocabulary_exclusion(text,text,uuid,boolean,uuid)');
 IF pg_catalog.md5(body)='ab2fbcdce90647f4b36360c004aa50e0' THEN
  definition:=replace(definition,body,'
DECLARE who uuid:=auth.uid(); v public.user_vocabulary%rowtype; e public.vocabulary_exclusions%rowtype;
 lang text:=p_language; word text:=normalize(btrim(p_word),NFC); matches integer;
BEGIN
 IF who IS NULL OR p_excluded IS NULL THEN RAISE EXCEPTION ''login_required'' USING ERRCODE=''42501''; END IF;
 IF p_language=''Korean'' AND (public.learning_language_capabilities()->''languages''->''Korean''->>''exclude'')::boolean IS DISTINCT FROM true
  THEN RAISE EXCEPTION ''korean_learning_not_ready'' USING ERRCODE=''55000''; END IF;
 -- 같은 계정의 저장/제외는 행 잠금 전에 직렬화한다(새 단어 저장과 미저장 제외 경쟁 포함).
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(who::text,731));
 IF p_exclusion_id IS NOT NULL THEN
  IF p_excluded THEN RAISE EXCEPTION ''invalid_exclusion''; END IF;
  SELECT * INTO e FROM public.vocabulary_exclusions WHERE id=p_exclusion_id AND user_id=who;
  IF e.id IS NULL THEN RAISE EXCEPTION ''exclusion_not_available'' USING ERRCODE=''42501''; END IF;
  IF e.vocabulary_id IS NOT NULL THEN PERFORM 1 FROM public.user_vocabulary WHERE id=e.vocabulary_id AND user_id=who FOR UPDATE; END IF;
  DELETE FROM public.vocabulary_exclusions WHERE user_id=who AND (id=e.id OR
   (e.language IN (''Japanese'',''Chinese'',''English'',''French'',''Korean'') AND language=e.language AND word_text=e.word_text));
  RETURN jsonb_build_object(''excluded'',false,''entry'',to_jsonb(e));
 END IF;
 IF p_vocabulary_id IS NOT NULL THEN
  SELECT * INTO v FROM public.user_vocabulary WHERE id=p_vocabulary_id AND user_id=who FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION ''word_not_available'' USING ERRCODE=''42501''; END IF;
 ELSE
  IF lang IS NULL OR lang NOT IN (''Japanese'',''Chinese'',''English'',''French'',''Korean'') OR word IS NULL OR length(word) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION ''invalid_word''; END IF;
  SELECT count(*) INTO matches FROM public.user_vocabulary WHERE user_id=who AND language=lang
   AND (normalize(btrim(word_text),NFC)=word OR normalize(btrim(base_form),NFC)=word);
  IF matches>1 THEN RAISE EXCEPTION ''vocabulary_ambiguous_match''; END IF;
  IF matches=1 THEN SELECT * INTO v FROM public.user_vocabulary WHERE user_id=who AND language=lang
   AND (normalize(btrim(word_text),NFC)=word OR normalize(btrim(base_form),NFC)=word) FOR UPDATE; END IF;
 END IF;
 IF v.id IS NOT NULL THEN
  lang:=coalesce(v.language,''Unknown''); word:=normalize(btrim(coalesce(nullif(v.base_form,''''),v.word_text)),NFC);
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
   (e.language IN (''Japanese'',''Chinese'',''English'',''French'',''Korean'') AND language=e.language AND word_text=e.word_text));
  ELSE e.id:=gen_random_uuid();e.language:=lang;e.word_text:=word;e.vocabulary_id:=v.id; END IF;
 END IF;
 RETURN jsonb_build_object(''excluded'',p_excluded,''entry'',to_jsonb(e));
END ');
  EXECUTE definition;
 END IF;
 SELECT pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.sync_known_word_review_exclusion()')),prosrc INTO definition,body FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('public.sync_known_word_review_exclusion()');
 IF pg_catalog.md5(body)='ced5892a8eb03cff1645d997dfca890e' THEN
  definition:=replace(definition,body,'
DECLARE who uuid; code text; original text; lang text; key text; affected text[];
BEGIN
 IF TG_OP=''INSERT'' THEN who:=NEW.user_id;code:=NEW.lang;original:=NEW.word_text;
 ELSE who:=OLD.user_id;code:=OLD.lang;original:=OLD.word_text; END IF;
 lang:=CASE code WHEN ''ja'' THEN ''Japanese'' WHEN ''zh'' THEN ''Chinese'' WHEN ''en'' THEN ''English'' WHEN ''fr'' THEN ''French'' WHEN ''ko'' THEN ''Korean'' END;
 IF lang IS NULL THEN RETURN NULL; END IF;
 IF TG_OP=''INSERT'' THEN
  FOR key IN
   SELECT normalize(btrim(original),NFC)
   UNION SELECT normalize(btrim(coalesce(nullif(v.base_form,''''),v.word_text)),NFC)
    FROM public.user_vocabulary v WHERE v.user_id=who AND v.language=lang
    AND (normalize(btrim(v.word_text),NFC)=normalize(btrim(original),NFC)
     OR normalize(btrim(v.base_form),NFC)=normalize(btrim(original),NFC))
  LOOP
   IF length(key) NOT BETWEEN 1 AND 300 THEN RAISE EXCEPTION ''invalid_known_word''; END IF;
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
  -- 해제는 새 평가가 아니다. 같은 키의 과거 ''제외''도 해제하되 다른 known 표시는 보존한다.
  DELETE FROM public.vocabulary_exclusions e WHERE e.user_id=who AND e.language=lang AND e.word_text=ANY(affected)
   AND NOT EXISTS(SELECT 1 FROM public.vocabulary_exclusions other WHERE other.user_id=who AND other.language=lang
    AND other.word_text=e.word_text AND cardinality(other.known_word_keys)>0);
 END IF;
 RETURN NULL;
END ');
  EXECUTE definition;
 END IF;
 SELECT pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.guard_known_word_review_exclusion()')),prosrc INTO definition,body FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('public.guard_known_word_review_exclusion()');
 IF pg_catalog.md5(body)='71ab352aa46bf375c16b2627c7dfbf0d' THEN
  definition:=replace(definition,body,'
DECLARE active_keys text[];
BEGIN
 SELECT array_agg(k.word_text) INTO active_keys FROM public.user_known_words k WHERE k.user_id=OLD.user_id
  AND k.lang=CASE OLD.language WHEN ''Japanese'' THEN ''ja'' WHEN ''Chinese'' THEN ''zh'' WHEN ''English'' THEN ''en'' WHEN ''French'' THEN ''fr'' WHEN ''Korean'' THEN ''ko'' END
  AND k.word_text=ANY(OLD.known_word_keys);
 -- 신뢰된 FK cascade/known 동기화는 사용자·표시 자체를 지운다. 일반 RPC 삭제는 depth=1.
 IF TG_OP=''DELETE'' AND pg_catalog.pg_trigger_depth()>1 THEN RETURN OLD; END IF;
 IF cardinality(active_keys)>0 AND (TG_OP=''DELETE'' OR NEW.user_id IS DISTINCT FROM OLD.user_id
  OR NEW.language IS DISTINCT FROM OLD.language OR NEW.word_text IS DISTINCT FROM OLD.word_text
  OR NEW.vocabulary_id IS DISTINCT FROM OLD.vocabulary_id
  OR NOT active_keys <@ NEW.known_word_keys)
 THEN RAISE EXCEPTION ''known_word_active'' USING ERRCODE=''55000''; END IF;
 IF TG_OP=''DELETE'' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END ');
  EXECUTE definition;
 END IF;
 SELECT pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.save_vocabulary_context_for(uuid,jsonb,jsonb,uuid,text)')),prosrc INTO definition,body FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('public.save_vocabulary_context_for(uuid,jsonb,jsonb,uuid,text)');
 IF pg_catalog.md5(body)='1facb74b4b7d33a572cef9642341342f' THEN
  definition:=replace(definition,body,'
declare
  v public.user_vocabulary%rowtype;
  who uuid := p_owner;
  created boolean := false;
  added integer;
  matches integer;
  word text := btrim(p_word->>''word_text'');
  meaning text := btrim(p_word->>''meaning'');
begin
  if who is null or (current_user <> ''service_role'' and (who is distinct from auth.uid() or p_source->>''kind''=''class'')) then raise exception ''login_required'' using errcode=''42501''; end if;
  if word is null or length(word) not between 1 and 300 or meaning is null or length(meaning) not between 1 and 2000
    or p_word->>''language'' is null or p_word->>''language'' not in (''Japanese'',''Chinese'',''English'',''French'',''Korean'')
    or (p_word->>''language''=''Korean'' and p_source->>''kind''<>''reading'')
    or p_source->>''kind'' is null or p_source->>''kind'' not in (''textbook'',''reading'',''pdf'',''class'')
    then raise exception ''invalid_context'' using errcode=''22023''; end if;

  if p_word->>''language''=''Korean'' then
    if (public.learning_language_capabilities()->''languages''->''Korean''->>''save'')::boolean is distinct from true
      then raise exception ''korean_learning_not_ready'' using errcode=''55000''; end if;
    if p_word ?| array[''interval'',''ease_factor'',''repetitions'',''next_review_at''] then
      if jsonb_typeof(p_word->''interval'') is distinct from ''number''
        or jsonb_typeof(p_word->''ease_factor'') is distinct from ''number''
        or jsonb_typeof(p_word->''repetitions'') is distinct from ''number''
        or jsonb_typeof(p_word->''next_review_at'') is distinct from ''string''
        then raise exception ''invalid_initial_schedule'' using errcode=''22023''; end if;
      if (p_word->>''interval'')::numeric not between 0 and 36500
        or (p_word->>''ease_factor'')::numeric not between 1 and 10
        or (p_word->>''repetitions'')::numeric not between 0 and 100000
        or (p_word->>''repetitions'')::numeric<>trunc((p_word->>''repetitions'')::numeric)
        or not isfinite((p_word->>''next_review_at'')::timestamptz)
        then raise exception ''invalid_initial_schedule'' using errcode=''22023''; end if;
    end if;
  end if;

  -- 예전 뷰어가 활용형(word_text=books, base_form=book)으로 저장한 카드도 재사용한다.
  -- 후보가 여러 개면 추측해서 새 카드를 만들거나 임의로 합치지 않는다.
  select * into v from public.user_vocabulary where user_id=who and word_text=word for update;
  if not found then
    select count(*) into matches from public.user_vocabulary where user_id=who and language=p_word->>''language'' and base_form=word;
    if matches > 1 then raise exception ''vocabulary_ambiguous_match''; end if;
    if matches = 1 then
      select * into v from public.user_vocabulary where user_id=who and language=p_word->>''language'' and base_form=word for update;
    end if;
  end if;
  if v.id is null then
    insert into public.user_vocabulary(user_id,word_text,base_form,meaning,furigana,pos,language,source_sentence,source_material_id,next_review_at)
    values(who,word,word,meaning,coalesce(p_word->>''furigana'',''''),coalesce(p_word->>''pos'',''''),p_word->>''language'',p_source->>''quote'',
      case when p_source->>''kind''=''reading'' then (p_source->>''materialId'')::bigint end,now())
    on conflict(user_id,word_text) do nothing returning * into v;
    created := found;
    if created and p_word->>''language''=''Korean'' and p_word ? ''interval'' then
      update public.user_vocabulary set interval=(p_word->>''interval'')::real,
        ease_factor=(p_word->>''ease_factor'')::real,repetitions=(p_word->>''repetitions'')::integer,
        next_review_at=(p_word->>''next_review_at'')::timestamptz where id=v.id and user_id=who returning * into v;
    end if;
  end if;
  if not created and v.id is null then
    select * into v from public.user_vocabulary where user_id=who and word_text=word for update;
    if not found then raise exception ''word_not_available''; end if;
  end if;
  if not created then
    if v.language is distinct from p_word->>''language'' then raise exception ''vocabulary_language_conflict''; end if;
    if btrim(coalesce(v.meaning,'''')) <> meaning and not (
      p_confirm_id is not null and v.id=p_confirm_id and v.meaning is not distinct from p_confirm_meaning
    ) then raise exception ''vocabulary_meaning_conflict'' using detail=v.id::text; end if;
  end if;

  insert into public.vocabulary_contexts(user_id,vocabulary_id,kind,lang,chapter_slug,material_id,pdf_id,locator,quote,translation,source_key)
  values(who,v.id,p_source->>''kind'',p_word->>''language'',p_source->>''chapterSlug'',
    (p_source->>''materialId'')::bigint,(p_source->>''pdfId'')::uuid,coalesce(p_source->''locator'',''{}''::jsonb),
    p_source->>''quote'',coalesce(p_source->>''translation'',''''),
    md5((p_source - ''translation'')::text))
  on conflict(user_id,vocabulary_id,source_key) do nothing;
  get diagnostics added = row_count;
  return jsonb_build_object(''vocabularyId'',v.id,''created'',created,''contextAdded'',added>0);
end ');
  EXECUTE definition;
 END IF;
END $extend$;

INSERT INTO public.vocabulary_exclusions(user_id,language,word_text,known_word_keys)
 SELECT k.user_id,l.language,keys.word,array_agg(DISTINCT k.word_text)
 FROM public.user_known_words k
 JOIN (VALUES('ko','Korean')) l(code,language) ON l.code=k.lang
 CROSS JOIN LATERAL (
  SELECT normalize(btrim(k.word_text),NFC) AS word
  UNION SELECT normalize(btrim(coalesce(nullif(v.base_form,''),v.word_text)),NFC) FROM public.user_vocabulary v
   WHERE v.user_id=k.user_id AND v.language=l.language
   AND (normalize(btrim(v.word_text),NFC)=normalize(btrim(k.word_text),NFC)
    OR normalize(btrim(v.base_form),NFC)=normalize(btrim(k.word_text),NFC))
 ) keys
 GROUP BY k.user_id,l.language,keys.word
 ON CONFLICT(user_id,language,word_text) WHERE vocabulary_id IS NULL
 DO UPDATE SET known_word_keys=ARRAY(SELECT DISTINCT unnest(public.vocabulary_exclusions.known_word_keys||EXCLUDED.known_word_keys));


CREATE OR REPLACE FUNCTION public.guard_korean_learning_contract() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $guard$
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
END $guard$;
REVOKE ALL ON FUNCTION public.guard_korean_learning_contract() FROM PUBLIC,anon,authenticated;
DO $guard_acl$
DECLARE grantee_name text;
BEGIN
 FOR grantee_name IN SELECT DISTINCT pg_catalog.pg_get_userbyid(acl.grantee) FROM pg_catalog.pg_proc p
  CROSS JOIN LATERAL pg_catalog.aclexplode(p.proacl) acl WHERE p.oid=pg_catalog.to_regprocedure('public.guard_korean_learning_contract()') AND acl.grantee<>0 AND acl.grantee<>p.proowner
 LOOP EXECUTE pg_catalog.format('REVOKE ALL ON FUNCTION public.guard_korean_learning_contract() FROM %I',grantee_name); END LOOP;
END $guard_acl$;
DO $guards$
DECLARE tab text; trigger_def text;
BEGIN
 FOREACH tab IN ARRAY ARRAY['user_vocabulary','vocabulary_contexts','user_known_words','vocabulary_exclusions','review_events'] LOOP
  trigger_def:=pg_catalog.format('CREATE TRIGGER guard_korean_learning_contract BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_korean_learning_contract()',tab);
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid=pg_catalog.to_regclass('public.'||tab) AND tgname='guard_korean_learning_contract') THEN
   EXECUTE pg_catalog.format('ALTER TABLE public.%I ENABLE TRIGGER guard_korean_learning_contract',tab);
   IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid=pg_catalog.to_regclass('public.'||tab) AND tgname='guard_korean_learning_contract'
    AND tgenabled='O' AND tgtype=31 AND tgfoid=pg_catalog.to_regprocedure('public.guard_korean_learning_contract()')
    AND tgqual IS NULL AND tgnargs=0 AND tgattr=''::pg_catalog.int2vector AND NOT tgisinternal)
   THEN RAISE EXCEPTION 'korean_support_unexpected_contract_trigger: %',tab; END IF;
  ELSE EXECUTE trigger_def; END IF;
 END LOOP;
END $guards$;

-- The expected installed catalog fingerprint is private implementation data.
-- No table or readiness flag can be used to claim support after a regression.
DO $capability$
DECLARE contract_hash text;
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
) SELECT pg_catalog.md5(pg_catalog.jsonb_object_agg(key,val ORDER BY key)::text) FROM objects INTO contract_hash;
 EXECUTE pg_catalog.format($definition$
 CREATE OR REPLACE FUNCTION public.learning_language_capabilities()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $body$
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
  ready:=live_hash= %L;
  RETURN pg_catalog.jsonb_build_object('version',1,'languages',pg_catalog.jsonb_build_object('Korean',
   pg_catalog.jsonb_build_object('save',ready,'review',ready,'known',ready,'exclude',ready)));
 END $body$;
 $definition$,contract_hash);
END $capability$;
REVOKE ALL ON FUNCTION public.learning_language_capabilities() FROM PUBLIC,anon,authenticated;
DO $capability_acl$
DECLARE grantee_name text;
BEGIN
 FOR grantee_name IN SELECT DISTINCT pg_catalog.pg_get_userbyid(acl.grantee) FROM pg_catalog.pg_proc p
  CROSS JOIN LATERAL pg_catalog.aclexplode(p.proacl) acl WHERE p.oid=pg_catalog.to_regprocedure('public.learning_language_capabilities()') AND acl.grantee<>0 AND acl.grantee<>p.proowner
 LOOP EXECUTE pg_catalog.format('REVOKE ALL ON FUNCTION public.learning_language_capabilities() FROM %I',grantee_name); END LOOP;
END $capability_acl$;
GRANT EXECUTE ON FUNCTION public.learning_language_capabilities() TO authenticated;
NOTIFY pgrst,'reload schema';$round004_exact_candidate$;
  
  phase:='preservation';
  EXECUTE $round004_verify$DO $round004_checks$
BEGIN

 IF EXISTS(SELECT 1 FROM (
  (SELECT * FROM public.user_vocabulary EXCEPT ALL SELECT * FROM pg_temp.round004_before_user_vocabulary)
  UNION ALL
  (SELECT * FROM pg_temp.round004_before_user_vocabulary EXCEPT ALL SELECT * FROM public.user_vocabulary)
 ) differences) THEN RAISE EXCEPTION 'round004_preservation_failed:user_vocabulary'; END IF;

 IF EXISTS(SELECT 1 FROM (
  (SELECT * FROM public.vocabulary_contexts EXCEPT ALL SELECT * FROM pg_temp.round004_before_vocabulary_contexts)
  UNION ALL
  (SELECT * FROM pg_temp.round004_before_vocabulary_contexts EXCEPT ALL SELECT * FROM public.vocabulary_contexts)
 ) differences) THEN RAISE EXCEPTION 'round004_preservation_failed:vocabulary_contexts'; END IF;

 IF EXISTS(SELECT 1 FROM (
  (SELECT * FROM public.user_known_words EXCEPT ALL SELECT * FROM pg_temp.round004_before_user_known_words)
  UNION ALL
  (SELECT * FROM pg_temp.round004_before_user_known_words EXCEPT ALL SELECT * FROM public.user_known_words)
 ) differences) THEN RAISE EXCEPTION 'round004_preservation_failed:user_known_words'; END IF;

 IF EXISTS(SELECT 1 FROM (
  (SELECT * FROM public.review_events EXCEPT ALL SELECT * FROM pg_temp.round004_before_review_events)
  UNION ALL
  (SELECT * FROM pg_temp.round004_before_review_events EXCEPT ALL SELECT * FROM public.review_events)
 ) differences) THEN RAISE EXCEPTION 'round004_preservation_failed:review_events'; END IF;

 IF EXISTS(SELECT 1 FROM (
  (SELECT * FROM public.reading_materials EXCEPT ALL SELECT * FROM pg_temp.round004_before_reading_materials)
  UNION ALL
  (SELECT * FROM pg_temp.round004_before_reading_materials EXCEPT ALL SELECT * FROM public.reading_materials)
 ) differences) THEN RAISE EXCEPTION 'round004_preservation_failed:reading_materials'; END IF;

 IF EXISTS(SELECT 1 FROM (
  (SELECT * FROM public.uploaded_pdfs EXCEPT ALL SELECT * FROM pg_temp.round004_before_uploaded_pdfs)
  UNION ALL
  (SELECT * FROM pg_temp.round004_before_uploaded_pdfs EXCEPT ALL SELECT * FROM public.uploaded_pdfs)
 ) differences) THEN RAISE EXCEPTION 'round004_preservation_failed:uploaded_pdfs'; END IF;
 -- Every existing exclusion ID and every field other than the permitted
 -- Korean unsaved known-key union is preserved. No deletes/replacements.
 IF EXISTS(SELECT 1 FROM pg_temp.round004_before_vocabulary_exclusions before
  LEFT JOIN public.vocabulary_exclusions after ON after.id=before.id
  WHERE after.id IS NULL OR (to_jsonb(after)-'known_word_keys') IS DISTINCT FROM (to_jsonb(before)-'known_word_keys'))
 THEN RAISE EXCEPTION 'round004_preservation_failed:exclusion_existing_fields'; END IF;
 IF EXISTS(SELECT 1 FROM pg_temp.round004_before_vocabulary_exclusions before
  JOIN public.vocabulary_exclusions after ON after.id=before.id
  LEFT JOIN pg_temp.round004_expected_ko expected ON expected.user_id=before.user_id
   AND expected.language=before.language AND expected.word_text=before.word_text AND before.vocabulary_id IS NULL
  WHERE CASE WHEN expected.user_id IS NULL THEN after.known_word_keys IS DISTINCT FROM before.known_word_keys
   ELSE ARRAY(SELECT DISTINCT key COLLATE "C" FROM unnest(after.known_word_keys) key ORDER BY 1) IS DISTINCT FROM ARRAY(SELECT DISTINCT key COLLATE "C" FROM unnest(before.known_word_keys||expected.known_word_keys) key ORDER BY 1)
    OR cardinality(after.known_word_keys)<>cardinality(ARRAY(SELECT DISTINCT key COLLATE "C" FROM unnest(after.known_word_keys) key ORDER BY 1)) END)
 THEN RAISE EXCEPTION 'round004_preservation_failed:exclusion_existing_keys'; END IF;
 -- New rows must correspond exactly to previously absent unsaved targets.
 IF EXISTS(SELECT 1 FROM public.vocabulary_exclusions after
  LEFT JOIN pg_temp.round004_before_vocabulary_exclusions before ON before.id=after.id
  LEFT JOIN pg_temp.round004_expected_ko expected ON expected.user_id=after.user_id
   AND expected.language=after.language AND expected.word_text=after.word_text
  WHERE before.id IS NULL AND (expected.user_id IS NULL OR after.vocabulary_id IS NOT NULL
   OR after.retired_vocabulary_ids IS DISTINCT FROM '{}'::uuid[]
   OR after.created_at IS DISTINCT FROM transaction_timestamp()
   OR ARRAY(SELECT DISTINCT key COLLATE "C" FROM unnest(after.known_word_keys) key ORDER BY 1) IS DISTINCT FROM ARRAY(SELECT DISTINCT key COLLATE "C" FROM unnest(expected.known_word_keys) key ORDER BY 1)
   OR cardinality(after.known_word_keys)<>cardinality(ARRAY(SELECT DISTINCT key COLLATE "C" FROM unnest(after.known_word_keys) key ORDER BY 1))
   OR EXISTS(SELECT 1 FROM pg_temp.round004_before_vocabulary_exclusions prior WHERE prior.user_id=after.user_id
    AND prior.language=after.language AND prior.word_text=after.word_text AND prior.vocabulary_id IS NULL)))
 THEN RAISE EXCEPTION 'round004_preservation_failed:exclusion_unexpected_addition'; END IF;
 IF EXISTS(SELECT 1 FROM pg_temp.round004_expected_ko expected WHERE NOT EXISTS(
  SELECT 1 FROM public.vocabulary_exclusions after WHERE after.user_id=expected.user_id
   AND after.language=expected.language AND after.word_text=expected.word_text AND after.vocabulary_id IS NULL
   AND expected.known_word_keys <@ after.known_word_keys))
 THEN RAISE EXCEPTION 'round004_preservation_failed:exclusion_missing_target'; END IF;
END $round004_checks$;$round004_verify$;
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS failure_state=RETURNED_SQLSTATE,failure_message=MESSAGE_TEXT;
  safe_reason:=CASE WHEN failure_message ~ '^round004_preservation_failed:[a-z_]+$'
   THEN failure_message ELSE 'round004_candidate_rejected' END;
  RAISE EXCEPTION 'round004_db_safety_failed:%:%:%',phase,failure_state,safe_reason USING ERRCODE='P0001';
 END;
END $round004_apply$;
-- Checks have passed before COMMIT. Only counts and PASS booleans leave DB.
SELECT jsonb_build_object('status','PASS_precommit_preservation','operator',current_user,
 'normal_authenticated_verified',false,'counts',jsonb_build_object(
 'user_vocabulary',(SELECT count(*) FROM public.user_vocabulary),
 'vocabulary_contexts',(SELECT count(*) FROM public.vocabulary_contexts),
 'user_known_words',(SELECT count(*) FROM public.user_known_words),
 'review_events',(SELECT count(*) FROM public.review_events),
 'reading_materials',(SELECT count(*) FROM public.reading_materials),
 'uploaded_pdfs',(SELECT count(*) FROM public.uploaded_pdfs),
 'exclusions_before',(SELECT count(*) FROM pg_temp.round004_before_vocabulary_exclusions),
 'exclusions_after',(SELECT count(*) FROM public.vocabulary_exclusions),
 'expected_ko_targets',(SELECT count(*) FROM pg_temp.round004_expected_ko)),
 'unchanged_candidate_body',true,'protected_rows_pass',true,'exclusion_delta_pass',true) AS round004_db_safety;

-- BEGIN REVIEWED 022 POST-GUARD korean003-protected
DO $platform022$ DECLARE actual jsonb; BEGIN
 SELECT q.* INTO actual FROM (WITH functions AS (SELECT 'extensions.grant_pg_cron_access()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'procost',p.procost,'prokind',p.prokind,'prorows',p.prorows,'support',p.prosupport::pg_catalog.regproc::text,'language',l.lanname,'proconfig',p.proconfig,'proretset',p.proretset,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proargnames',p.proargnames,'proargtypes',p.proargtypes::text,'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provariadic',p.provariadic::pg_catalog.regtype::text,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'pronargdefaults',p.pronargdefaults,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('extensions.grant_pg_cron_access()') UNION ALL SELECT 'extensions.grant_pg_graphql_access()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'procost',p.procost,'prokind',p.prokind,'prorows',p.prorows,'support',p.prosupport::pg_catalog.regproc::text,'language',l.lanname,'proconfig',p.proconfig,'proretset',p.proretset,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proargnames',p.proargnames,'proargtypes',p.proargtypes::text,'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provariadic',p.provariadic::pg_catalog.regtype::text,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'pronargdefaults',p.pronargdefaults,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('extensions.grant_pg_graphql_access()') UNION ALL SELECT 'extensions.grant_pg_net_access()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'procost',p.procost,'prokind',p.prokind,'prorows',p.prorows,'support',p.prosupport::pg_catalog.regproc::text,'language',l.lanname,'proconfig',p.proconfig,'proretset',p.proretset,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proargnames',p.proargnames,'proargtypes',p.proargtypes::text,'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provariadic',p.provariadic::pg_catalog.regtype::text,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'pronargdefaults',p.pronargdefaults,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('extensions.grant_pg_net_access()') UNION ALL SELECT 'extensions.pgrst_ddl_watch()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'procost',p.procost,'prokind',p.prokind,'prorows',p.prorows,'support',p.prosupport::pg_catalog.regproc::text,'language',l.lanname,'proconfig',p.proconfig,'proretset',p.proretset,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proargnames',p.proargnames,'proargtypes',p.proargtypes::text,'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provariadic',p.provariadic::pg_catalog.regtype::text,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'pronargdefaults',p.pronargdefaults,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('extensions.pgrst_ddl_watch()') UNION ALL SELECT 'extensions.pgrst_drop_watch()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'procost',p.procost,'prokind',p.prokind,'prorows',p.prorows,'support',p.prosupport::pg_catalog.regproc::text,'language',l.lanname,'proconfig',p.proconfig,'proretset',p.proretset,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proargnames',p.proargnames,'proargtypes',p.proargtypes::text,'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provariadic',p.provariadic::pg_catalog.regtype::text,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'pronargdefaults',p.pronargdefaults,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('extensions.pgrst_drop_watch()') UNION ALL SELECT 'extensions.set_graphql_placeholder()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'procost',p.procost,'prokind',p.prokind,'prorows',p.prorows,'support',p.prosupport::pg_catalog.regproc::text,'language',l.lanname,'proconfig',p.proconfig,'proretset',p.proretset,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proargnames',p.proargnames,'proargtypes',p.proargtypes::text,'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provariadic',p.provariadic::pg_catalog.regtype::text,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'pronargdefaults',p.pronargdefaults,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('extensions.set_graphql_placeholder()') UNION ALL SELECT 'graphql_public.graphql(text,text,jsonb,jsonb)' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'prokind',p.prokind,'language',l.lanname,'proconfig',p.proconfig,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('graphql_public.graphql(text,text,jsonb,jsonb)') UNION ALL SELECT 'pg_event_trigger_ddl_commands()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'prokind',p.prokind,'language',l.lanname,'proconfig',p.proconfig,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e')) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('pg_event_trigger_ddl_commands()') UNION ALL SELECT 'pg_event_trigger_dropped_objects()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'prokind',p.prokind,'language',l.lanname,'proconfig',p.proconfig,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e')) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('pg_event_trigger_dropped_objects()') UNION ALL SELECT 'auth.uid()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'procost',p.procost,'prokind',p.prokind,'prorows',p.prorows,'support',p.prosupport::pg_catalog.regproc::text,'language',l.lanname,'proconfig',p.proconfig,'proretset',p.proretset,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proargnames',p.proargnames,'proargtypes',p.proargtypes::text,'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provariadic',p.provariadic::pg_catalog.regtype::text,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'pronargdefaults',p.pronargdefaults,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('auth.uid()') UNION ALL SELECT 'public.is_admin()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'procost',p.procost,'prokind',p.prokind,'prorows',p.prorows,'support',p.prosupport::pg_catalog.regproc::text,'language',l.lanname,'proconfig',p.proconfig,'proretset',p.proretset,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proargnames',p.proargnames,'proargtypes',p.proargtypes::text,'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provariadic',p.provariadic::pg_catalog.regtype::text,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'pronargdefaults',p.pronargdefaults,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('public.is_admin()') UNION ALL SELECT 'public.enforce_role_change_by_admin()' key,jsonb_build_object('acl',p.proacl::text,'owner',pg_catalog.pg_get_userbyid(p.proowner),'schema',n.nspname,'procost',p.procost,'prokind',p.prokind,'prorows',p.prorows,'support',p.prosupport::pg_catalog.regproc::text,'language',l.lanname,'proconfig',p.proconfig,'proretset',p.proretset,'prosecdef',p.prosecdef,'prosrc_md5',pg_catalog.md5(p.prosrc),'proargnames',p.proargnames,'proargtypes',p.proargtypes::text,'proisstrict',p.proisstrict,'proparallel',p.proparallel,'provariadic',p.provariadic::pg_catalog.regtype::text,'provolatile',p.provolatile,'return_type',pg_catalog.format_type(p.prorettype,NULL),'proleakproof',p.proleakproof,'pronargdefaults',p.pronargdefaults,'extension_membership',(SELECT jsonb_agg(e.extname ORDER BY e.extname) FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'),'definition',pg_catalog.pg_get_functiondef(p.oid)) value FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=pg_catalog.to_regprocedure('public.enforce_role_change_by_admin()')) SELECT jsonb_build_object('hooks',(SELECT jsonb_agg(jsonb_build_object('name',e.evtname,'tags',e.evttags,'event',e.evtevent,'owner',pg_catalog.pg_get_userbyid(e.evtowner),'enabled',e.evtenabled,'function',e.evtfoid::pg_catalog.regprocedure::text) ORDER BY e.evtname) FROM pg_catalog.pg_event_trigger e),'functions',(SELECT jsonb_object_agg(key,value ORDER BY key) FROM functions),'schemas',(SELECT jsonb_agg(jsonb_build_object('acl',n.nspacl::text,'owner',pg_catalog.pg_get_userbyid(n.nspowner),'schema',n.nspname) ORDER BY n.nspname) FROM pg_catalog.pg_namespace n WHERE n.nspname IN ('auth','extensions','public')),'extensions',(SELECT coalesce(jsonb_agg(e.extname ORDER BY e.extname),'[]'::jsonb) FROM pg_catalog.pg_extension e WHERE e.extname IN ('pg_graphql','pg_net','pg_cron')),'dormant_targets',(SELECT coalesce(jsonb_agg(p.oid::pg_catalog.regprocedure::text ORDER BY p.oid::pg_catalog.regprocedure::text),'[]'::jsonb) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='graphql' AND p.proname='resolve' OR n.nspname='net' AND p.proname IN ('http_get','http_post'))) ) q;
 IF actual IS DISTINCT FROM $platform_expected${"hooks":[{"name":"issue_graphql_placeholder","tags":["DROP EXTENSION"],"event":"sql_drop","owner":"supabase_admin","enabled":"O","function":"extensions.set_graphql_placeholder()"},{"name":"issue_pg_cron_access","tags":["CREATE EXTENSION"],"event":"ddl_command_end","owner":"supabase_admin","enabled":"O","function":"extensions.grant_pg_cron_access()"},{"name":"issue_pg_graphql_access","tags":["CREATE FUNCTION"],"event":"ddl_command_end","owner":"supabase_admin","enabled":"O","function":"extensions.grant_pg_graphql_access()"},{"name":"issue_pg_net_access","tags":["CREATE EXTENSION"],"event":"ddl_command_end","owner":"supabase_admin","enabled":"O","function":"extensions.grant_pg_net_access()"},{"name":"pgrst_ddl_watch","tags":null,"event":"ddl_command_end","owner":"supabase_admin","enabled":"O","function":"extensions.pgrst_ddl_watch()"},{"name":"pgrst_drop_watch","tags":null,"event":"sql_drop","owner":"supabase_admin","enabled":"O","function":"extensions.pgrst_drop_watch()"}],"functions":{"extensions.grant_pg_cron_access()":{"acl":"{=X/supabase_admin,supabase_admin=X*/supabase_admin,dashboard_user=X/supabase_admin}","owner":"supabase_admin","schema":"extensions","procost":100,"prokind":"f","prorows":0,"support":"-","language":"plpgsql","proconfig":["search_path=\"\""],"proretset":false,"prosecdef":false,"prosrc_md5":"3a3917aad6ddd66182bf45b7490c3029","proargnames":null,"proargtypes":"","proisstrict":false,"proparallel":"u","provariadic":"-","provolatile":"v","return_type":"event_trigger","proleakproof":false,"pronargdefaults":0,"extension_membership":null,"definition":"CREATE OR REPLACE FUNCTION extensions.grant_pg_cron_access()\n RETURNS event_trigger\n LANGUAGE plpgsql\n SET search_path TO ''\nAS $function$\nBEGIN\n  IF EXISTS (\n    SELECT\n    FROM pg_event_trigger_ddl_commands() AS ev\n    JOIN pg_extension AS ext\n    ON ev.objid = ext.oid\n    WHERE ext.extname = 'pg_cron'\n  )\n  THEN\n    grant usage on schema cron to postgres with grant option;\n\n    alter default privileges in schema cron grant all on tables to postgres with grant option;\n    alter default privileges in schema cron grant all on functions to postgres with grant option;\n    alter default privileges in schema cron grant all on sequences to postgres with grant option;\n\n    alter default privileges for user supabase_admin in schema cron grant all\n        on sequences to postgres with grant option;\n    alter default privileges for user supabase_admin in schema cron grant all\n        on tables to postgres with grant option;\n    alter default privileges for user supabase_admin in schema cron grant all\n        on functions to postgres with grant option;\n\n    grant all privileges on all tables in schema cron to postgres with grant option;\n    revoke all on table cron.job from postgres;\n    grant select on table cron.job to postgres with grant option;\n    revoke trigger on cron.job_run_details from postgres;\n  END IF;\nEND;\n$function$\n"},"extensions.grant_pg_graphql_access()":{"acl":"{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X*/supabase_admin}","owner":"supabase_admin","schema":"extensions","procost":100,"prokind":"f","prorows":0,"support":"-","language":"plpgsql","proconfig":["search_path=\"\""],"proretset":false,"prosecdef":false,"prosrc_md5":"dd3f3e2bb94cff45ef24b9cecb6af1c8","proargnames":null,"proargtypes":"","proisstrict":false,"proparallel":"u","provariadic":"-","provolatile":"v","return_type":"event_trigger","proleakproof":false,"pronargdefaults":0,"extension_membership":null,"definition":"CREATE OR REPLACE FUNCTION extensions.grant_pg_graphql_access()\n RETURNS event_trigger\n LANGUAGE plpgsql\n SET search_path TO ''\nAS $function$\nbegin\n    if not exists (\n        select 1\n        from pg_catalog.pg_event_trigger_ddl_commands() ev\n        join pg_catalog.pg_extension e on ev.objid = e.oid\n        where e.extname = 'pg_graphql'\n    ) then\n        return;\n    end if;\n\n    drop function if exists graphql_public.graphql;\n    create or replace function graphql_public.graphql(\n        \"operationName\" text default null,\n        query text default null,\n        variables jsonb default null,\n        extensions jsonb default null\n    )\n        returns jsonb\n        language sql\n    as $$\n        select graphql.resolve(\n            query := query,\n            variables := coalesce(variables, '{}'),\n            \"operationName\" := \"operationName\",\n            extensions := extensions\n        );\n    $$;\n\n    -- Attach the wrapper to the extension so DROP EXTENSION cascades to it,\n    -- which in turn triggers set_graphql_placeholder to reinstall the \"not enabled\" stub.\n    alter extension pg_graphql add function graphql_public.graphql(text, text, jsonb, jsonb);\n\n    grant usage on schema graphql to postgres, anon, authenticated, service_role;\n    grant execute on function graphql.resolve to postgres, anon, authenticated, service_role;\n    grant usage on schema graphql to postgres with grant option;\n    grant usage on schema graphql_public to postgres with grant option;\nend;\n$function$\n"},"extensions.grant_pg_net_access()":{"acl":"{=X/supabase_admin,supabase_admin=X*/supabase_admin,dashboard_user=X/supabase_admin}","owner":"supabase_admin","schema":"extensions","procost":100,"prokind":"f","prorows":0,"support":"-","language":"plpgsql","proconfig":["search_path=\"\""],"proretset":false,"prosecdef":false,"prosrc_md5":"2ee4e6920eeba3068bcfa838105352e2","proargnames":null,"proargtypes":"","proisstrict":false,"proparallel":"u","provariadic":"-","provolatile":"v","return_type":"event_trigger","proleakproof":false,"pronargdefaults":0,"extension_membership":null,"definition":"CREATE OR REPLACE FUNCTION extensions.grant_pg_net_access()\n RETURNS event_trigger\n LANGUAGE plpgsql\n SET search_path TO ''\nAS $function$\nBEGIN\n  IF EXISTS (\n    SELECT 1\n    FROM pg_event_trigger_ddl_commands() AS ev\n    JOIN pg_extension AS ext\n    ON ev.objid = ext.oid\n    WHERE ext.extname = 'pg_net'\n  )\n  THEN\n    IF NOT EXISTS (\n      SELECT 1\n      FROM pg_roles\n      WHERE rolname = 'supabase_functions_admin'\n    )\n    THEN\n      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;\n    END IF;\n\n    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;\n\n    IF EXISTS (\n      SELECT FROM pg_extension\n      WHERE extname = 'pg_net'\n      -- all versions in use on existing projects as of 2025-02-20\n      -- version 0.12.0 onwards don't need these applied\n      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8.0', '0.10.0', '0.11.0')\n    ) THEN\n      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;\n      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;\n\n      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;\n      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;\n\n      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;\n      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;\n\n      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;\n      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;\n    END IF;\n  END IF;\nEND;\n$function$\n"},"extensions.pgrst_ddl_watch()":{"acl":"{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X*/supabase_admin}","owner":"supabase_admin","schema":"extensions","procost":100,"prokind":"f","prorows":0,"support":"-","language":"plpgsql","proconfig":["search_path=\"\""],"proretset":false,"prosecdef":false,"prosrc_md5":"7f27b8118fea5c88b0164331292859e3","proargnames":null,"proargtypes":"","proisstrict":false,"proparallel":"u","provariadic":"-","provolatile":"v","return_type":"event_trigger","proleakproof":false,"pronargdefaults":0,"extension_membership":null,"definition":"CREATE OR REPLACE FUNCTION extensions.pgrst_ddl_watch()\n RETURNS event_trigger\n LANGUAGE plpgsql\n SET search_path TO ''\nAS $function$\nDECLARE\n  cmd record;\nBEGIN\n  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()\n  LOOP\n    IF cmd.command_tag IN (\n      'CREATE SCHEMA', 'ALTER SCHEMA'\n    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'\n    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'\n    , 'CREATE VIEW', 'ALTER VIEW'\n    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'\n    , 'CREATE FUNCTION', 'ALTER FUNCTION'\n    , 'CREATE TRIGGER'\n    , 'CREATE TYPE', 'ALTER TYPE'\n    , 'CREATE RULE'\n    , 'COMMENT'\n    )\n    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp\n    AND cmd.schema_name is distinct from 'pg_temp'\n    THEN\n      NOTIFY pgrst, 'reload schema';\n    END IF;\n  END LOOP;\nEND; $function$\n"},"extensions.pgrst_drop_watch()":{"acl":"{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X*/supabase_admin}","owner":"supabase_admin","schema":"extensions","procost":100,"prokind":"f","prorows":0,"support":"-","language":"plpgsql","proconfig":["search_path=\"\""],"proretset":false,"prosecdef":false,"prosrc_md5":"bc09cc3003d66f91844af4cb05e203b7","proargnames":null,"proargtypes":"","proisstrict":false,"proparallel":"u","provariadic":"-","provolatile":"v","return_type":"event_trigger","proleakproof":false,"pronargdefaults":0,"extension_membership":null,"definition":"CREATE OR REPLACE FUNCTION extensions.pgrst_drop_watch()\n RETURNS event_trigger\n LANGUAGE plpgsql\n SET search_path TO ''\nAS $function$\nDECLARE\n  obj record;\nBEGIN\n  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()\n  LOOP\n    IF obj.object_type IN (\n      'schema'\n    , 'table'\n    , 'foreign table'\n    , 'view'\n    , 'materialized view'\n    , 'function'\n    , 'trigger'\n    , 'type'\n    , 'rule'\n    )\n    AND obj.is_temporary IS false -- no pg_temp objects\n    THEN\n      NOTIFY pgrst, 'reload schema';\n    END IF;\n  END LOOP;\nEND; $function$\n"},"extensions.set_graphql_placeholder()":{"acl":"{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X*/supabase_admin}","owner":"supabase_admin","schema":"extensions","procost":100,"prokind":"f","prorows":0,"support":"-","language":"plpgsql","proconfig":["search_path=\"\""],"proretset":false,"prosecdef":false,"prosrc_md5":"a2bc2d00b2cc2f5e8d2d6b8d73e2c360","proargnames":null,"proargtypes":"","proisstrict":false,"proparallel":"u","provariadic":"-","provolatile":"v","return_type":"event_trigger","proleakproof":false,"pronargdefaults":0,"extension_membership":null,"definition":"CREATE OR REPLACE FUNCTION extensions.set_graphql_placeholder()\n RETURNS event_trigger\n LANGUAGE plpgsql\n SET search_path TO ''\nAS $function$\n    DECLARE\n    graphql_is_dropped bool;\n    BEGIN\n    graphql_is_dropped = (\n        SELECT ev.schema_name = 'graphql_public'\n        FROM pg_event_trigger_dropped_objects() AS ev\n        WHERE ev.schema_name = 'graphql_public'\n    );\n\n    IF graphql_is_dropped\n    THEN\n        create or replace function graphql_public.graphql(\n            \"operationName\" text default null,\n            query text default null,\n            variables jsonb default null,\n            extensions jsonb default null\n        )\n            returns jsonb\n            language plpgsql\n            set search_path to ''\n        as $$\n            DECLARE\n                server_version float;\n            BEGIN\n                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);\n\n                IF server_version >= 14 THEN\n                    RETURN jsonb_build_object(\n                        'errors', jsonb_build_array(\n                            jsonb_build_object(\n                                'message', 'pg_graphql extension is not enabled.'\n                            )\n                        )\n                    );\n                ELSE\n                    RETURN jsonb_build_object(\n                        'errors', jsonb_build_array(\n                            jsonb_build_object(\n                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'\n                            )\n                        )\n                    );\n                END IF;\n            END;\n        $$;\n    END IF;\n\n    END;\n$function$\n"},"graphql_public.graphql(text,text,jsonb,jsonb)":{"acl":"{=X/supabase_admin,supabase_admin=X/supabase_admin,postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}","owner":"supabase_admin","schema":"graphql_public","prokind":"f","language":"plpgsql","proconfig":null,"prosecdef":false,"prosrc_md5":"4b822d188772a248642fbe43342f9f17","proisstrict":false,"proparallel":"u","provolatile":"v","return_type":"jsonb","proleakproof":false,"extension_membership":null,"definition":"CREATE OR REPLACE FUNCTION graphql_public.graphql(\"operationName\" text DEFAULT NULL::text, query text DEFAULT NULL::text, variables jsonb DEFAULT NULL::jsonb, extensions jsonb DEFAULT NULL::jsonb)\n RETURNS jsonb\n LANGUAGE plpgsql\nAS $function$\n            DECLARE\n                server_version float;\n            BEGIN\n                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);\n\n                IF server_version >= 14 THEN\n                    RETURN jsonb_build_object(\n                        'errors', jsonb_build_array(\n                            jsonb_build_object(\n                                'message', 'pg_graphql extension is not enabled.'\n                            )\n                        )\n                    );\n                ELSE\n                    RETURN jsonb_build_object(\n                        'errors', jsonb_build_array(\n                            jsonb_build_object(\n                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'\n                            )\n                        )\n                    );\n                END IF;\n            END;\n        $function$\n"},"pg_event_trigger_ddl_commands()":{"acl":null,"owner":"supabase_admin","schema":"pg_catalog","prokind":"f","language":"internal","proconfig":null,"prosecdef":false,"prosrc_md5":"94249d8d755439e46455b026acb9ae27","proisstrict":true,"proparallel":"r","provolatile":"s","return_type":"record","proleakproof":false,"extension_membership":null},"pg_event_trigger_dropped_objects()":{"acl":null,"owner":"supabase_admin","schema":"pg_catalog","prokind":"f","language":"internal","proconfig":null,"prosecdef":false,"prosrc_md5":"e6092d646f6e984a244ee64cf6c2cc20","proisstrict":true,"proparallel":"r","provolatile":"s","return_type":"record","proleakproof":false,"extension_membership":null},"auth.uid()":{"acl":"{=X/supabase_auth_admin,supabase_auth_admin=X/supabase_auth_admin,dashboard_user=X/supabase_auth_admin}","owner":"supabase_auth_admin","schema":"auth","procost":100,"prokind":"f","prorows":0,"support":"-","language":"sql","proconfig":null,"proretset":false,"prosecdef":false,"prosrc_md5":"cdef18c69c4f4cbbced2eaf81e628b49","proargnames":null,"proargtypes":"","proisstrict":false,"proparallel":"u","provariadic":"-","provolatile":"s","return_type":"uuid","proleakproof":false,"pronargdefaults":0,"extension_membership":null,"definition":"CREATE OR REPLACE FUNCTION auth.uid()\n RETURNS uuid\n LANGUAGE sql\n STABLE\nAS $function$\n  select \n  coalesce(\n    nullif(current_setting('request.jwt.claim.sub', true), ''),\n    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')\n  )::uuid\n$function$\n"},"public.is_admin()":{"acl":"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}","owner":"postgres","schema":"public","procost":100,"prokind":"f","prorows":0,"support":"-","language":"sql","proconfig":["search_path=public"],"proretset":false,"prosecdef":true,"prosrc_md5":"c6285e67e4e39f263d934fac2145035c","proargnames":null,"proargtypes":"","proisstrict":false,"proparallel":"u","provariadic":"-","provolatile":"s","return_type":"boolean","proleakproof":false,"pronargdefaults":0,"extension_membership":null,"definition":"CREATE OR REPLACE FUNCTION public.is_admin()\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'public'\nAS $function$\n  SELECT EXISTS (\n    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'\n  );\n$function$\n"},"public.enforce_role_change_by_admin()":{"acl":"{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}","owner":"postgres","schema":"public","procost":100,"prokind":"f","prorows":0,"support":"-","language":"plpgsql","proconfig":["search_path=public"],"proretset":false,"prosecdef":true,"prosrc_md5":"a3d315a8c81181eccbb9072e8b9c3c7a","proargnames":null,"proargtypes":"","proisstrict":false,"proparallel":"u","provariadic":"-","provolatile":"v","return_type":"trigger","proleakproof":false,"pronargdefaults":0,"extension_membership":null,"definition":"CREATE OR REPLACE FUNCTION public.enforce_role_change_by_admin()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'public'\nAS $function$\nBEGIN\n  IF NEW.role IS DISTINCT FROM OLD.role THEN\n    IF NOT is_admin() THEN\n      RAISE EXCEPTION 'permission denied: only admins can change user roles';\n    END IF;\n  END IF;\n  RETURN NEW;\nEND;\n$function$\n"}},"schemas":[{"acl":"{supabase_admin=UC/supabase_admin,anon=U/supabase_admin,authenticated=U/supabase_admin,service_role=U/supabase_admin,supabase_auth_admin=UC/supabase_admin,dashboard_user=UC/supabase_admin,postgres=U/supabase_admin}","owner":"supabase_admin","schema":"auth"},{"acl":"{postgres=UC/postgres,anon=U/postgres,authenticated=U/postgres,service_role=U/postgres,dashboard_user=UC/postgres}","owner":"postgres","schema":"extensions"},{"acl":"{pg_database_owner=UC/pg_database_owner,=U/pg_database_owner,postgres=U/pg_database_owner,anon=U/pg_database_owner,authenticated=U/pg_database_owner,service_role=U/pg_database_owner}","owner":"pg_database_owner","schema":"public"}],"extensions":[],"dormant_targets":[]}$platform_expected$::jsonb THEN
  RAISE EXCEPTION 'learning022_platform_not_attested' USING ERRCODE='55000',HINT='Preserve all hooks and definitions; compare the scoped READ ONLY catalog with reviewed 022 metadata.';
 END IF;
 IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='postgres' AND NOT rolsuper AND rolbypassrls) THEN RAISE EXCEPTION 'learning022_operator_not_attested';END IF;
END $platform022$;
DO $platform022_after$ DECLARE profile jsonb;BEGIN SELECT q.* INTO profile FROM (WITH objects AS (
 SELECT 'dependencies' k,(WITH RECURSIVE expressions(source,body) AS (
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
 ) SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY source,classid,objid),'[]'::jsonb) FROM objects o) v
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
 UNION ALL SELECT 'role_closure',(WITH RECURSIVE relevant(oid) AS (
  SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN ('postgres','supabase_admin','supabase_auth_admin','dashboard_user','anon','authenticated','service_role','pg_database_owner')
  UNION SELECT CASE WHEN m.roleid=r.oid THEN m.member ELSE m.roleid END FROM relevant r JOIN pg_catalog.pg_auth_members m ON m.roleid=r.oid OR m.member=r.oid
 ) SELECT jsonb_build_object(
  'roles',(SELECT jsonb_agg(to_jsonb(r)-ARRAY['rolpassword','rolvaliduntil'] ORDER BY r.oid) FROM pg_catalog.pg_roles r WHERE r.oid IN (SELECT oid FROM relevant)),
  'memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor) FROM pg_catalog.pg_auth_members m WHERE m.roleid IN (SELECT oid FROM relevant) OR m.member IN (SELECT oid FROM relevant))))
 UNION ALL SELECT 'role_database_override:'||setdatabase||':'||setrole,to_jsonb(d) FROM pg_catalog.pg_db_role_setting d WHERE setdatabase IN (0,(SELECT oid FROM pg_catalog.pg_database WHERE datname=current_database())) AND (setrole=0 OR setrole IN (SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN ('postgres','supabase_admin','supabase_auth_admin','dashboard_user','anon','authenticated','service_role')))
 UNION ALL SELECT 'function:'||oid,jsonb_build_array(pg_get_functiondef(oid),to_jsonb(p)) FROM pg_catalog.pg_proc p WHERE oid=pg_catalog.to_regprocedure('public.update_streak(uuid)')
 ) SELECT jsonb_object_agg(k,v ORDER BY k) FROM objects) q;IF profile IS DISTINCT FROM pg_catalog.current_setting('manabi.catalog022_profile_before')::jsonb THEN RAISE EXCEPTION 'learning022_prerequisite_profile_delta';END IF;END $platform022_after$;
-- END REVIEWED 022 POST-GUARD korean003-protected
COMMIT;
