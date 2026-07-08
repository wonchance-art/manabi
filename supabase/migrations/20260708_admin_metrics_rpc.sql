-- V4-1 눈(증거 회로) — admin 집계 전용 RPC (기획 docs/plan-v4-eyes-and-voice.md §3.1)
-- 실행: Supabase 대시보드 SQL Editor (이 저장소는 마이그레이션 CI 자동적용이 없음).
--
-- ⚠️ 불변 규약 — 위반 금지:
--   1. admin 전체-행 SELECT 정책을 열지 않는다. 이 파일은 집계 "숫자"만 반환하는
--      SECURITY DEFINER 함수로 권한 경계를 만든다(함수 시그니처가 곧 경계).
--   2. 행 반환 admin 함수 금지 — 집계 숫자만 반환한다. user_id는 카운트로만 소멸한다.
--   3. review_events.detail(오답 프롬프트·사용자 응답)과 study_paragraphs 원문
--      (paragraph·materials)은 어떤 함수도 반환하지 않는다(PII, 진단 사각지대 #4).
--      detail은 내부 필터(detail->>'qtype')로만 읽고 결과 컬럼으로 절대 노출하지 않는다.
--   4. 모든 함수는 첫 줄에서 호출자(auth.uid())의 profiles.role='admin'을 검사하고
--      아니면 예외를 던진다. EXECUTE 권한은 authenticated 롤에만 부여한다(PUBLIC 회수).
--
-- 규약: source='ui' 행동 계측은 review_events에 {source:'ui', detail.qtype:...}로 적재
-- (docs/architecture-and-handoff.md §4.9). rung/FSRS 계산은 source='vocab'만 보므로 무간섭.

-- ① 가입 퍼널 — 가입 → 첫 세션 도달 → D1 재방문 → D7 유지 (전부 카운트)
--    가입 시각은 auth.users.created_at(진짜 가입 시각)을 기준으로 한다 — SECURITY
--    DEFINER 소유자(postgres)가 auth 스키마를 읽을 수 있다. user_id는 반환하지 않는다.
CREATE OR REPLACE FUNCTION admin_funnel(days int DEFAULT 30)
RETURNS TABLE (
  signups               bigint,
  reached_first_session bigint,
  d1_return             bigint,
  d7_retained           bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
$$;

-- ② 일별 지표 — 일자별 활성 사용자 수·세션 근사·vocab 정답률 (user_id 미반환)
--    세션 근사 = 일×유저 그룹(하루에 활동한 고유 유저 수). 정답률은 source='vocab'만.
CREATE OR REPLACE FUNCTION admin_daily_metrics(days int DEFAULT 30)
RETURNS TABLE (
  day          date,
  active_users bigint,
  sessions     bigint,
  accuracy     numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
$$;

-- ③ v3 지표 — 예보 탭·산출 제출·공동작가 반영·푸시 옵트인/발송/열림 (전부 카운트)
--    푸시 계열은 아직 0이어도 컬럼을 미리 준비한다(V4-2/3에서 채워짐).
CREATE OR REPLACE FUNCTION admin_v3_metrics(days int DEFAULT 30)
RETURNS TABLE (
  forecast_taps        bigint,
  produce_submits      bigint,
  coauthor_reflections bigint,
  push_optin           bigint,
  push_sent            bigint,
  push_open            bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'permission denied: admin only';
  END IF;

  RETURN QUERY
  SELECT
    count(*) FILTER (WHERE r.source = 'ui'      AND r.detail->>'qtype' = 'forecast_tap')::bigint,
    count(*) FILTER (WHERE r.source = 'writing' AND r.detail->>'qtype' = 'produce')::bigint,
    (SELECT count(*) FROM study_paragraphs sp
       WHERE sp.created_at >= now() - (days::text || ' days')::interval
         AND sp.paragraph ? 'userNext')::bigint,
    count(*) FILTER (WHERE r.source = 'ui' AND r.detail->>'qtype' = 'push_optin')::bigint,
    count(*) FILTER (WHERE r.source = 'ui' AND r.detail->>'qtype' = 'push_sent')::bigint,
    count(*) FILTER (WHERE r.source = 'ui' AND r.detail->>'qtype' = 'push_open')::bigint
  FROM review_events r
  WHERE r.created_at >= now() - (days::text || ' days')::interval;
END;
$$;

-- ④ 콘텐츠 건강도 — item_key별 오답률 상위 top_n. item_key·노출수·오답률만 반환한다.
--    ⚠️ detail은 어떤 형태로도 반환하지 않는다(불량 문항 탐지에 원문이 필요 없다).
--    ui 행동 계측(item_key='-')은 제외. 표본 3회 미만은 노이즈로 버린다.
CREATE OR REPLACE FUNCTION admin_content_health(days int DEFAULT 30, top_n int DEFAULT 10)
RETURNS TABLE (
  item_key   text,
  exposures  bigint,
  wrong_rate numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'permission denied: admin only';
  END IF;

  RETURN QUERY
  SELECT
    r.item_key,
    count(*)::bigint AS exposures,
    round((count(*) FILTER (WHERE NOT r.correct))::numeric / count(*), 4) AS wrong_rate
  FROM review_events r
  WHERE r.created_at >= now() - (days::text || ' days')::interval
    AND r.source <> 'ui'
    AND r.item_key <> '-'
  GROUP BY r.item_key
  HAVING count(*) >= 3
  ORDER BY wrong_rate DESC, exposures DESC
  LIMIT top_n;
END;
$$;

-- ── 권한 — PUBLIC 회수 후 authenticated 롤에만 EXECUTE 부여 ──
-- (호출자 JWT의 auth.uid()로 함수 내부에서 admin을 재검사하므로, EXECUTE 부여만으로는
--  비관리자가 집계에 접근할 수 없다.)
REVOKE ALL ON FUNCTION admin_funnel(int)             FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_daily_metrics(int)      FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_v3_metrics(int)         FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_content_health(int, int) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION admin_funnel(int)             TO authenticated;
GRANT EXECUTE ON FUNCTION admin_daily_metrics(int)      TO authenticated;
GRANT EXECUTE ON FUNCTION admin_v3_metrics(int)         TO authenticated;
GRANT EXECUTE ON FUNCTION admin_content_health(int, int) TO authenticated;
