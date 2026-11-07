-- 되돌리기: 20261107050000_advisor_notifications_fk_indexes.sql (ADVISOR-RECHECK-002 · 2026-11-07 KST).
-- 오너 확인 뒤에만 SQL 편집기(postgres)에서 한 번 실행한다. 지운 옛 정책 3개를 적용 직전 운영 식(20261103000000 감싼 식) 그대로
-- 다시 만들고, 추가한 인덱스 2개를 지운다. 데이터는 건드리지 않는다. 사후 = notifications 정책 6개 · 두 인덱스 없음 · 지문 넷 불변.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE POLICY insert_notifications ON public.notifications FOR INSERT WITH CHECK (((select auth.uid()) IS NOT NULL));
CREATE POLICY read_own_notifications ON public.notifications FOR SELECT USING ((user_id = (select auth.uid())));
CREATE POLICY update_own_notifications ON public.notifications FOR UPDATE USING ((user_id = (select auth.uid())));
DROP INDEX IF EXISTS public.daily_suggestions_material_id_idx;
DROP INDEX IF EXISTS public.reading_progress_material_id_idx;
DO $post$
BEGIN
  IF (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'notifications') <> 6 THEN
    RAISE EXCEPTION 'rollback: expected 6 notifications policies';
  END IF;
END $post$;
COMMIT;
