-- 개인 서재 원장 RLS의 auth 호출을 질의당 한 번으로(RLS-INITPLAN-001 후속 — 오케스트레이터 판정 2026-11-06 KST,
-- 오너 11/4 「백엔드 · 데이터 자율(RLS 포함)」, #1660 · #1665 선례).
-- Supabase 성능 진단 auth_rls_initplan(WARN) 남은 3건: library_private의 정책 식에 맨 auth.uid()가 있어 행마다 다시 부른다.
-- (select auth.uid())로 감싸면 질의당 한 번(InitPlan) — 같은 값이라 보이는 행 · 쓸 수 있는 행이 같다.
--
-- 범위: library_private.operations · operation_items · folder_operations의 정책 3개(ALL · authenticated · PERMISSIVE)의 USING · WITH CHECK만.
--   명령 · 역할 · PERMISSIVE · 정책 수는 그대로다(ALTER POLICY는 USING / WITH CHECK만 바꾼다).
--   학습 계약 지문 범위 밖: capability(learning_language_capabilities)의 표 목록은 public 9개뿐이고, core · manual · admission ·
--   activity 지문도 library_private 정책을 읽지 않는다 — 아래 사후 검사가 지문 넷 + capability 문자열이 바이트 같음을 확인한다.
-- 적용 경로: main 병합 → supabase-migrations.yml(db push), 암묵 트랜잭션 하나(검사가 RAISE하면 전부 롤백).
-- 사후 검사(같은 트랜잭션): ⑴ 세 정책에 맨 auth.uid() 0 ⑵ 감싼 호출을 되돌린 식 = 적용 전 식 ⑶ 명령 · 역할 · PERMISSIVE 불변
--   ⑷ 지문(core · manual · admission · activity _live)과 capability 결과가 적용 전과 같음.
-- 되돌리기(쓸 일 없음 — 결과가 같다): docs/sql/library-rls-initplan-20261106-rollback.sql(원래 식 owner_id = auth.uid()로 ALTER POLICY).

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TEMP TABLE lri_before ON COMMIT DROP AS
SELECT p.tablename, p.policyname, p.cmd, p.permissive, p.roles, p.qual, p.with_check
FROM pg_catalog.pg_policies p
WHERE p.schemaname = 'library_private' AND p.policyname IN ('library_op_own', 'library_op_item_own', 'library_folder_op_own');

-- 지문 넷 + capability를 적용 전에 잰다(함수가 있을 때만 — 동적 호출이라 함수가 없는 로컬 fixture에서도 계획 단계에서 깨지지 않는다).
CREATE TEMP TABLE lri_pins (k text PRIMARY KEY, v text) ON COMMIT DROP;
CREATE FUNCTION pg_temp.lri_measure() RETURNS TABLE (k text, v text) LANGUAGE plpgsql AS $m$
DECLARE f record; val text;
BEGIN
  FOR f IN SELECT * FROM (VALUES ('core', 'fsrs_private', 'contract_hash_live'), ('manual', 'fsrs_private', 'manual_contract_hash_live'),
      ('admission', 'fsrs_private', 'admission_contract_hash_live'), ('activity', 'fsrs_private', 'activity_profile_hash_live'),
      ('capability', 'public', 'learning_language_capabilities')) x(k, sch, fn) LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = f.sch AND p.proname = f.fn AND p.pronargs = 0) THEN
      EXECUTE format('SELECT %I.%I()::text', f.sch, f.fn) INTO val;
    ELSE val := NULL; END IF;
    k := f.k; v := val; RETURN NEXT;
  END LOOP;
END $m$;
INSERT INTO pg_temp.lri_pins SELECT * FROM pg_temp.lri_measure();

DO $pre$
BEGIN
  IF (SELECT count(*) FROM pg_temp.lri_before) <> 3 THEN
    RAISE EXCEPTION 'library rls initplan: expected 3 policies, got %', (SELECT count(*) FROM pg_temp.lri_before);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_temp.lri_before WHERE qual IS DISTINCT FROM '(owner_id = auth.uid())' OR with_check IS DISTINCT FROM '(owner_id = auth.uid())') THEN
    RAISE EXCEPTION 'library rls initplan: unexpected policy expression (already changed?)';
  END IF;
END $pre$;

ALTER POLICY library_op_own ON library_private.operations
  USING ((owner_id = (select auth.uid()))) WITH CHECK ((owner_id = (select auth.uid())));
ALTER POLICY library_op_item_own ON library_private.operation_items
  USING ((owner_id = (select auth.uid()))) WITH CHECK ((owner_id = (select auth.uid())));
ALTER POLICY library_folder_op_own ON library_private.folder_operations
  USING ((owner_id = (select auth.uid()))) WITH CHECK ((owner_id = (select auth.uid())));

DO $post$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies a JOIN pg_temp.lri_before b USING (tablename, policyname)
    WHERE a.schemaname = 'library_private'
      AND (a.cmd IS DISTINCT FROM b.cmd OR a.permissive IS DISTINCT FROM b.permissive OR a.roles IS DISTINCT FROM b.roles
        OR replace(a.qual, '( SELECT auth.uid() AS uid)', 'auth.uid()') IS DISTINCT FROM b.qual
        OR replace(a.with_check, '( SELECT auth.uid() AS uid)', 'auth.uid()') IS DISTINCT FROM b.with_check
        OR replace(coalesce(a.qual, '') || coalesce(a.with_check, ''), '( SELECT auth.uid() AS uid)', '') LIKE '%auth.uid()%')
  ) OR (SELECT count(*) FROM pg_catalog.pg_policies a JOIN pg_temp.lri_before b USING (tablename, policyname) WHERE a.schemaname = 'library_private') <> 3 THEN
    RAISE EXCEPTION 'library rls initplan: post-check failed (policy shape or expression changed)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_temp.lri_pins b FULL JOIN pg_temp.lri_measure() a USING (k) WHERE a.v IS DISTINCT FROM b.v) THEN
    RAISE EXCEPTION 'library rls initplan: learning contract fingerprint changed — abort';
  END IF;
END $post$;

DROP FUNCTION pg_temp.lri_measure();
