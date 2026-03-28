-- Admin 보안 강화
-- 1) is_admin() 헬퍼 함수
-- 2) profiles.role 변경을 어드민만 가능하도록 트리거
-- 3) content_sources 쓰기 정책 (기존에 정책 없어서 service_role만 가능했던 것을 명시화)

-- ── 1. 헬퍼 함수 ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ── 2. profiles.role 보호 트리거 ─────────────────────────────
-- role 필드 변경은 어드민만 가능, 일반 유저가 자기 role을 admin으로 올리는 것 차단
CREATE OR REPLACE FUNCTION enforce_role_change_by_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT is_admin() THEN
      RAISE EXCEPTION 'permission denied: only admins can change user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_role_change ON profiles;
CREATE TRIGGER trg_enforce_role_change
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_role_change_by_admin();

-- ── 3. content_sources 어드민 전용 쓰기 정책 ─────────────────
-- SELECT는 기존 public_read_sources 정책으로 이미 허용됨
CREATE POLICY "admin_insert_sources"
  ON content_sources FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "admin_update_sources"
  ON content_sources FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "admin_delete_sources"
  ON content_sources FOR DELETE
  USING (is_admin());
