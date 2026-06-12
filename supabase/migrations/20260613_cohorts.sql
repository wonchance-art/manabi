-- 클래스(기수제) — 기수·팀·멤버 + 리더/총괄의 진도 조회 권한
-- 실행: Supabase 대시보드 SQL Editor

-- ① 기수
CREATE TABLE IF NOT EXISTS cohorts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  lang        text NOT NULL CHECK (lang IN ('Japanese', 'English', 'French')),
  level       text NOT NULL,
  start_date  date NOT NULL,
  weeks       int  NOT NULL DEFAULT 8 CHECK (weeks BETWEEN 1 AND 52),
  -- [{ "week": 1, "chapters": ["slug", ...] }, ...]
  curriculum  jsonb NOT NULL DEFAULT '[]',
  status      text NOT NULL DEFAULT 'recruiting' CHECK (status IN ('recruiting', 'active', 'done')),
  join_code   text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ② 팀
CREATE TABLE IF NOT EXISTS cohort_teams (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id  uuid NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  name       text NOT NULL,
  leader_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (cohort_id, name)
);

-- ③ 멤버
CREATE TABLE IF NOT EXISTS cohort_members (
  cohort_id  uuid NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id    uuid REFERENCES cohort_teams(id) ON DELETE SET NULL,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cohort_id, user_id)
);
CREATE INDEX IF NOT EXISTS cohort_members_team_idx ON cohort_members (team_id);
CREATE INDEX IF NOT EXISTS cohort_members_user_idx ON cohort_members (user_id);

-- ④ 권한 헬퍼 (SECURITY DEFINER — RLS 정책 간 재귀 참조 방지)
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION is_cohort_member(c uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM cohort_members WHERE cohort_id = c AND user_id = auth.uid());
$$;

-- 리더가 대상 사용자의 진도를 볼 수 있는가 (같은 팀의 리더)
CREATE OR REPLACE FUNCTION can_view_member_progress(target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM cohort_teams t
    JOIN cohort_members m ON m.team_id = t.id
    WHERE t.leader_id = auth.uid() AND m.user_id = target
  );
$$;

-- ⑤ RLS
ALTER TABLE cohorts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohort_teams   ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohort_members ENABLE ROW LEVEL SECURITY;

-- 기수: 로그인 사용자 모두 조회(모집 안내) / 쓰기는 관리자만
CREATE POLICY "cohorts_select_auth" ON cohorts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cohorts_write_admin" ON cohorts
  FOR ALL TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());

-- 팀: 같은 기수 멤버 + 관리자 조회 / 쓰기는 관리자만
CREATE POLICY "teams_select_member" ON cohort_teams
  FOR SELECT TO authenticated USING (is_cohort_member(cohort_id) OR is_admin_user());
CREATE POLICY "teams_write_admin" ON cohort_teams
  FOR ALL TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());

-- 멤버: 같은 기수 멤버 + 관리자 조회 / 본인 탈퇴 / 관리자 관리(팀 배정 등)
CREATE POLICY "members_select_member" ON cohort_members
  FOR SELECT TO authenticated USING (is_cohort_member(cohort_id) OR is_admin_user());
CREATE POLICY "members_delete_self" ON cohort_members
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "members_write_admin" ON cohort_members
  FOR ALL TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());

-- ⑥ 참가는 RPC로만 — 참가 코드 검증 후 본인 행 삽입
CREATE OR REPLACE FUNCTION join_cohort(code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c cohorts%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'login required';
  END IF;
  SELECT * INTO c FROM cohorts
   WHERE join_code = upper(trim(code)) AND status IN ('recruiting', 'active');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid code';
  END IF;
  INSERT INTO cohort_members (cohort_id, user_id)
  VALUES (c.id, auth.uid())
  ON CONFLICT DO NOTHING;
  RETURN c.id;
END;
$$;

-- ⑦ 진도 조회 확장 — 팀 리더는 팀원, 관리자는 전체의 user_ref_progress 읽기
CREATE POLICY "ref_progress_select_leader" ON user_ref_progress
  FOR SELECT TO authenticated
  USING (can_view_member_progress(user_id) OR is_admin_user());
