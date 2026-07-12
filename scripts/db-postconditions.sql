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

-- realtime 'world-plaza' 정책 — 최종 상태의 소유자는 20260712000400(전체 개방)이므로 version 을
-- 20260712000400 으로 귀속한다(20260709000100 은 같은 이름의 admin-only 구버전 — 존재만 보면
-- 구버전도 green 이 되는 사각을 막기 위해 qual/with_check 에 admin 조건이 "없어야" OK):
--   · roles 에 authenticated 포함 + 정의에 'world-plaza' 토픽 조건 포함 + admin 문자열 부재.
UNION ALL
SELECT '20260712000400', 'realtime policy world_plaza_admin_receive open to all authenticated (no admin cond)',
       CASE WHEN EXISTS (SELECT 1 FROM pg_policies
                         WHERE schemaname = 'realtime' AND tablename = 'messages'
                           AND policyname = 'world_plaza_admin_receive'
                           AND 'authenticated' = ANY(roles)
                           AND qual ILIKE '%world-plaza%'
                           AND qual NOT ILIKE '%admin%') THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260712000400', 'realtime policy world_plaza_admin_send open to all authenticated (no admin cond)',
       CASE WHEN EXISTS (SELECT 1 FROM pg_policies
                         WHERE schemaname = 'realtime' AND tablename = 'messages'
                           AND policyname = 'world_plaza_admin_send'
                           AND 'authenticated' = ANY(roles)
                           AND with_check ILIKE '%world-plaza%'
                           AND with_check NOT ILIKE '%admin%') THEN 'OK' ELSE 'MISSING' END
UNION ALL
-- 20260712000400 고유 검증 2/2: claim_world_session_v2 가 "신버전"(duplicate-ip 거부 제거)인지.
-- 함수 존재만 보면 구버전(20260712000300, IP 차단 포함)도 통과하므로 정의 본문을 검사한다.
-- 패턴은 따옴표 포함 리터럴 'duplicate-ip' 의 부재 — 구버전 RETURN jsonb_build_object(...,
-- 'duplicate-ip') 에만 존재하고, 신버전 본문 "주석"의 따옴표 없는 duplicate-ip 는 걸리지 않는다.
SELECT '20260712000400', 'fn claim_world_session_v2 is new version (no quoted duplicate-ip literal)',
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                         WHERE n.nspname = 'public' AND p.proname = 'claim_world_session_v2'
                           AND pg_get_functiondef(p.oid) NOT LIKE '%''duplicate-ip''%') THEN 'OK' ELSE 'MISSING' END

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
-- 20260712000200 harden_admin_fns — is_admin 존재만 보면 20260329000100 구버전(search_path
-- 미고정)이어도 green 이 되는 사각. 하드닝의 실체인 proconfig 의 search_path 고정을 검사한다.
SELECT '20260712000200', 'fn is_admin has pinned search_path (proconfig)',
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                         WHERE n.nspname = 'public' AND p.proname = 'is_admin'
                           AND EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg
                                       WHERE cfg LIKE 'search_path=%')) THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT '20260712000200', 'fn enforce_role_change_by_admin has pinned search_path (proconfig)',
       CASE WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                         WHERE n.nspname = 'public' AND p.proname = 'enforce_role_change_by_admin'
                           AND EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg
                                       WHERE cfg LIKE 'search_path=%')) THEN 'OK' ELSE 'MISSING' END
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
