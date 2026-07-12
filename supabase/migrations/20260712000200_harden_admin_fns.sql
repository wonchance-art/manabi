-- 관리자 헬퍼 함수 하드닝 (Codex 검수 반영)
-- SECURITY DEFINER 함수에 search_path를 고정하고 참조 릴레이션을 스키마 한정한다
-- (search path 하이재킹 방지 — https://supabase.com/docs/guides/database/functions).
-- 동작은 20260329_admin_rls.sql의 원본과 동일. EXECUTE 권한 회수는 RLS 정책 평가
-- 경로(anon의 정책 평가가 함수 호출을 포함)와 얽혀 회귀 위험이 있어 이번에는 하지 않는다.

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION enforce_role_change_by_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
