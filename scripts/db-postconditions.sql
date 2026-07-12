-- Postcondition probe — supabase-repair.yml 의 `supabase db push` 직후 실행하는 읽기 전용 검증.
--
-- push 대상(20260613000200_dday + 20260708 이후 11건)이 만든 핵심 신규 객체가 프로덕션에
-- 실존하는지 확인한다. MISSING 이 하나라도 있으면 워크플로가 실패한다.
-- (형식·패턴은 scripts/db-probes.sql 과 동일: 테이블 to_regclass · 컬럼 information_schema ·
--  함수 pg_proc · 정책 pg_policies. realtime 정책은 schemaname='realtime' 로 조회.)

SELECT * FROM (

-- dday (20260613000200 — preflight 실사에서 부재 확인돼 push 로 이동한 항목)
SELECT '20260613000200'::text AS version, 'column profiles.dday_date'::text AS probe,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'dday_date') THEN 'OK' ELSE 'MISSING' END AS status
UNION ALL
SELECT '20260613000200', 'column profiles.dday_label',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'dday_label') THEN 'OK' ELSE 'MISSING' END

-- 20260708 — admin 집계 RPC · 푸시 구독
UNION ALL
SELECT '20260708000100', 'function admin_funnel',
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                         WHERE n.nspname = 'public' AND p.proname = 'admin_funnel') THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260708000200', 'table push_subscriptions',
       CASE WHEN to_regclass('public.push_subscriptions') IS NOT NULL THEN 'OK' ELSE 'MISSING' END

-- 20260709/20260712d — realtime 'world-plaza' 정책(20260712000400 이 같은 이름으로 대체)
UNION ALL
SELECT '20260709000100', 'realtime policy world_plaza_admin_receive',
       CASE WHEN EXISTS (SELECT 1 FROM pg_policies
                         WHERE schemaname = 'realtime' AND tablename = 'messages'
                           AND policyname = 'world_plaza_admin_receive') THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260709000100', 'realtime policy world_plaza_admin_send',
       CASE WHEN EXISTS (SELECT 1 FROM pg_policies
                         WHERE schemaname = 'realtime' AND tablename = 'messages'
                           AND policyname = 'world_plaza_admin_send') THEN 'OK' ELSE 'MISSING' END

-- 20260710 — world_sessions 임대
UNION ALL
SELECT '20260710000100', 'table world_sessions',
       CASE WHEN to_regclass('public.world_sessions') IS NOT NULL THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260710000100', 'function claim_world_session',
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                         WHERE n.nspname = 'public' AND p.proname = 'claim_world_session') THEN 'OK' ELSE 'MISSING' END

-- 20260712 시리즈
UNION ALL
SELECT '20260712000100', 'table content_overrides',
       CASE WHEN to_regclass('public.content_overrides') IS NOT NULL THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260712000300', 'function claim_world_session_v2',
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                         WHERE n.nspname = 'public' AND p.proname = 'claim_world_session_v2') THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260712000300', 'table world_positions',
       CASE WHEN to_regclass('public.world_positions') IS NOT NULL THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260712000300', 'column world_sessions.ip',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema = 'public' AND table_name = 'world_sessions' AND column_name = 'ip') THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260712000500', 'realtime policy world_chat_receive',
       CASE WHEN EXISTS (SELECT 1 FROM pg_policies
                         WHERE schemaname = 'realtime' AND tablename = 'messages'
                           AND policyname = 'world_chat_receive') THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260712000500', 'realtime policy world_chat_send',
       CASE WHEN EXISTS (SELECT 1 FROM pg_policies
                         WHERE schemaname = 'realtime' AND tablename = 'messages'
                           AND policyname = 'world_chat_send') THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260712000600', 'table world_stamps',
       CASE WHEN to_regclass('public.world_stamps') IS NOT NULL THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260712000700', 'table world_reports',
       CASE WHEN to_regclass('public.world_reports') IS NOT NULL THEN 'OK' ELSE 'MISSING' END

) postconditions
ORDER BY version, probe;
