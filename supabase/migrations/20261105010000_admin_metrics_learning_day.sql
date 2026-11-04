-- 관리자 지표 「일별 추이 · 가입 퍼널」을 학습자 화면과 같은 셈으로(ADMIN-METRICS-DAY-001, 목업 9kvCCoQjGa6KUWzUtoRCuN · 오너 승인 뒤 적용).
--   하루 = 04시 학습일(KST — growthStats.learningDateString과 같은 식). 예전: UTC 날짜.
--   활성 · 퍼널 이벤트 = 답(weeklyReport.countsAsStudyAnswer와 같은 출처 — ui · dict · assist · practice 제외). 예전: 모든 기록(화면 계측 포함).
--   정답률 = 채점 답(isGradedReviewEvent — 위 넷 + hanzi · level 제외, 단어 · 문법 · 읽기 · 작문). 예전: vocab만.
--   목록이 코드 상수와 같은지는 계약 adminMetricsLearningDay.migration.test.js가 대조한다.
-- 바꾸지 않는 것: 서명 · 반환 열 · SECURITY DEFINER · search_path · 관리자 검사 · 실행권(public · anon 회수, authenticated · service_role).
-- 학습 계약 지문 밖 함수 — 앞뒤 네 계약 동치 검사. 실행 형태: db push 한 트랜잭션(BEGIN/COMMIT 없음).
-- 복원: docs/sql/admin-metrics-learning-day-rollback.sql(예전 본문 둘, 같은 검사).
do $pre$ begin
  if (select contract_hash from fsrs_private.settings) is distinct from fsrs_private.contract_hash()
     or (select contract_hash from fsrs_private.manual_save_settings) is distinct from fsrs_private.manual_contract_hash()
     or (select contract_hash from fsrs_private.admission_settings) is distinct from fsrs_private.admission_contract_hash()
     or (select profile_contract_hash from fsrs_private.activity_settings) is distinct from fsrs_private.activity_profile_hash() then
    raise exception 'admin_metrics: learning contracts already drifted — stop';
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
    ((r.created_at AT TIME ZONE 'Asia/Seoul') - interval '4 hours')::date            AS day,
    count(DISTINCT r.user_id)::bigint                  AS active_users,
    count(DISTINCT r.user_id)::bigint                  AS sessions,
    round(avg(CASE WHEN r.source NOT IN ('ui', 'dict', 'assist', 'practice', 'hanzi', 'level') THEN r.correct::int END)::numeric, 4) AS accuracy
  FROM review_events r
  WHERE r.created_at >= now() - (days::text || ' days')::interval
    AND r.source NOT IN ('ui', 'dict', 'assist', 'practice')
  GROUP BY ((r.created_at AT TIME ZONE 'Asia/Seoul') - interval '4 hours')::date
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
    SELECT u.id, ((u.created_at AT TIME ZONE 'Asia/Seoul') - interval '4 hours')::date AS signup_day
    FROM auth.users u
    WHERE u.created_at >= now() - (days::text || ' days')::interval
  ),
  ev AS (
    -- cohort 사용자의 이벤트 "날짜"만 (원문·detail 미접근)
    SELECT r.user_id, ((r.created_at AT TIME ZONE 'Asia/Seoul') - interval '4 hours')::date AS ev_day
    FROM review_events r
    JOIN cohort c ON c.id = r.user_id
    WHERE r.source NOT IN ('ui', 'dict', 'assist', 'practice')
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
    raise exception 'admin_metrics: execute grants differ from production (public · anon revoked, authenticated · service_role)';
  end if;
  if (select contract_hash from fsrs_private.settings) is distinct from fsrs_private.contract_hash()
     or (select contract_hash from fsrs_private.manual_save_settings) is distinct from fsrs_private.manual_contract_hash()
     or (select contract_hash from fsrs_private.admission_settings) is distinct from fsrs_private.admission_contract_hash()
     or (select profile_contract_hash from fsrs_private.activity_settings) is distinct from fsrs_private.activity_profile_hash() then
    raise exception 'admin_metrics: learning contract drift after change — rolled back';
  end if;
end $post$;
