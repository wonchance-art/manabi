-- 학습 월드 신고 — world_reports 테이블 + RLS(본인 신고 · 관리자 열람).
--
-- 배경: 월드는 전체 로그인 유저에게 열려 있어(20260712d), 부적절한 채팅·이름을 만나면 사용자가
--   상대를 신고할 수 있어야 한다. WorldPage 의 "근처 사람" 패널에서 사유를 골라 이 테이블에 직접
--   insert 하고(사용자 세션 클라이언트 — service_role 미사용, RLS 로 방어), AdminPage «신고» 탭이
--   is_admin() 으로만 열람한다. 처리(차단·경고) 액션은 이 라운드 범위 밖(열람만, 후속 명시).
--
-- 이 파일이 더하는 것:
--   1) world_reports 테이블 — reporter/target(auth.users FK) · reason · detail · created_at.
--      UNIQUE(reporter, target, reason) — 같은 사유의 반복 신고를 멱등화(upsert 로 무해).
--   2) RLS 3정책 — insert 는 본인(reporter=auth.uid())만, select 는 is_admin() 만.
--      (update/delete 정책 없음 → 그 DML 은 전면 차단 = 신고는 불변 로그.)
--   3) 명시 GRANT — authenticated 에 SELECT·INSERT 만(행 필터는 RLS). anon 회수.
--
-- is_admin() 은 20260329_admin_rls.sql(+20260712b 하드닝)의 SECURITY DEFINER 헬퍼를 재사용한다.
--
-- ── 적용·롤백 ──
--   · 적용: main 병합 시 supabase-migrations.yml 이 `supabase db push` 로 자동 적용.
--   · 재실행 안전: 전면 멱등(CREATE TABLE IF NOT EXISTS · DROP POLICY IF EXISTS 뒤 CREATE ·
--                 REVOKE/GRANT). 롤백은 파일 하단.
--   · 무해성: 미적용이어도 월드·채팅은 정상 동작한다(신고 insert 만 실패 → WorldPage 가 조용히 토스트).
--
-- ── 검증(적용 후) ──
--   1) 테이블: select to_regclass('public.world_reports'); → world_reports.
--   2) RLS 정책 3종:
--        select policyname, cmd from pg_policies where tablename='world_reports'; → insert/select 2행.
--      (열람 select 1 + insert 1 = 2행. update/delete 정책 없음.)
--   3) 유니크: 같은 (reporter,target,reason) 재신고가 23505 없이 upsert 로 흡수되는지 UI 에서 확인.

-- ── 1. 테이블 ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.world_reports (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason     text        NOT NULL,
  detail     text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter, target, reason)
);

-- 관리자 열람은 최신순 정렬이 기본 — created_at 인덱스로 목록 조회를 받쳐 준다.
CREATE INDEX IF NOT EXISTS world_reports_created_idx ON public.world_reports (created_at DESC);

-- ── 2. RLS ───────────────────────────────────────────────────
ALTER TABLE public.world_reports ENABLE ROW LEVEL SECURITY;

-- INSERT 는 본인 명의로만 — reporter 가 자신의 auth.uid() 여야 한다(대리 신고 위조 차단).
DROP POLICY IF EXISTS "world_reports_insert_own" ON public.world_reports;
CREATE POLICY "world_reports_insert_own"
  ON public.world_reports FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = reporter);

-- SELECT 는 관리자만 — is_admin() SECURITY DEFINER 헬퍼로 최종 방어(열람 전용).
DROP POLICY IF EXISTS "world_reports_select_admin" ON public.world_reports;
CREATE POLICY "world_reports_select_admin"
  ON public.world_reports FOR SELECT TO authenticated
  USING (is_admin());

-- update/delete 정책은 두지 않는다 → RLS 기본 거부로 그 DML 은 전면 차단(신고는 불변 로그).

-- ── 3. 명시 GRANT ────────────────────────────────────────────
-- default privileges 에 의존하지 않고 최소 권한만 연다. 행 필터는 RLS, 테이블 접근은 GRANT.
REVOKE ALL ON TABLE public.world_reports FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.world_reports TO authenticated;

-- 롤백(역방향 마이그레이션 파일로):
--   DROP TABLE IF EXISTS public.world_reports;
