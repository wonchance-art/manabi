-- daily_suggestions: 어드민 INSERT 허용
-- 크론 엔드포인트가 service_role 없이 실행될 때를 위한 fallback
CREATE POLICY "admin_insert_suggestions"
  ON daily_suggestions FOR INSERT
  WITH CHECK (is_admin());
