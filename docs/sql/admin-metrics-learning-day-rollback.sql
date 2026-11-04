-- 복원: 20261105010000_admin_metrics_learning_day.sql → 예전 본문 둘(UTC 날짜 · 모든 기록 · vocab 정답률) 그대로.
-- 서명 · 반환 열 · 보안 속성 · 관리자 검사 · 실행권은 그대로. 앞뒤 네 계약 동치 검사. 실행은 오너 확인 뒤(운영 SQL 편집기 · 한 트랜잭션).
do $pre$ begin
  if (select contract_hash from fsrs_private.settings) is distinct from fsrs_private.contract_hash()
     or (select contract_hash from fsrs_private.manual_save_settings) is distinct from fsrs_private.manual_contract_hash()
     or (select contract_hash from fsrs_private.admission_settings) is distinct from fsrs_private.admission_contract_hash()
     or (select profile_contract_hash from fsrs_private.activity_settings) is distinct from fsrs_private.activity_profile_hash() then
    raise exception 'admin_metrics rollback: learning contracts already drifted — stop';
  end if;
end $pre$;

CREATE OR REPLACE FUNCTION public.admin_daily_metrics(days integer DEFAULT 30)
 RETURNS TABLE(day date, active_users bigint, sessions bigint, accuracy numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'permission denied: admin only';
  END IF;

  RETURN QUERY
  SELECT
    (r.created_at AT TIME ZONE 'UTC')::date            AS day,
    count(DISTINCT r.user_id)::bigint                  AS active_users,
    count(DISTINCT r.user_id)::bigint                  AS sessions,
    round(avg(CASE WHEN r.source = 'vocab' THEN r.correct::int END)::numeric, 4) AS accuracy
  FROM review_events r
  WHERE r.created_at >= now() - (days::text || ' days')::interval
  GROUP BY (r.created_at AT TIME ZONE 'UTC')::date
  ORDER BY 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_funnel(days integer DEFAULT 30)
 RETURNS TABLE(signups bigint, reached_first_session bigint, d1_return bigint, d7_retained bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'permission denied: admin only';
  END IF;

  RETURN QUERY
  WITH cohort AS (
    SELECT u.id, (u.created_at AT TIME ZONE 'UTC')::date AS signup_day
    FROM auth.users u
    WHERE u.created_at >= now() - (days::text || ' days')::interval
  ),
  ev AS (
    -- cohort 사용자의 이벤트 "날짜"만 (원문·detail 미접근)
    SELECT r.user_id, (r.created_at AT TIME ZONE 'UTC')::date AS ev_day
    FROM review_events r
    JOIN cohort c ON c.id = r.user_id
  )
  SELECT
    (SELECT count(*) FROM cohort)::bigint,
    (SELECT count(DISTINCT e.user_id) FROM ev e)::bigint,
    (SELECT count(DISTINCT c.id) FROM cohort c
       JOIN ev e ON e.user_id = c.id AND e.ev_day = c.signup_day + 1)::bigint,
    (SELECT count(DISTINCT c.id) FROM cohort c
       JOIN ev e ON e.user_id = c.id AND e.ev_day = c.signup_day + 7)::bigint;
END;
$function$;

revoke execute on function public.admin_daily_metrics(integer), public.admin_funnel(integer) from public, anon;
grant execute on function public.admin_daily_metrics(integer), public.admin_funnel(integer) to authenticated, service_role;

do $post$ begin
  if has_function_privilege('anon', 'public.admin_daily_metrics(integer)', 'EXECUTE')
     or has_function_privilege('anon', 'public.admin_funnel(integer)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.admin_daily_metrics(integer)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.admin_funnel(integer)', 'EXECUTE') then
    raise exception 'admin_metrics rollback: execute grants differ from production (public · anon revoked, authenticated · service_role)';
  end if;
  if (select contract_hash from fsrs_private.settings) is distinct from fsrs_private.contract_hash()
     or (select contract_hash from fsrs_private.manual_save_settings) is distinct from fsrs_private.manual_contract_hash()
     or (select contract_hash from fsrs_private.admission_settings) is distinct from fsrs_private.admission_contract_hash()
     or (select profile_contract_hash from fsrs_private.activity_settings) is distinct from fsrs_private.activity_profile_hash() then
    raise exception 'admin_metrics rollback: learning contract drift after change — rolled back';
  end if;
end $post$;
