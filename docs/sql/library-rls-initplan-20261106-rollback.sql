-- 복원: supabase/migrations/20261106140000_library_rls_initplan.sql → 세 정책을 원래 식(owner_id = auth.uid())으로.
-- 쓸 일 없음(결과가 같은 식) — 필요할 때만 오너 확인 뒤 실행. 학습 계약 지문 범위 밖이라 재게시가 필요 없다.
BEGIN;
ALTER POLICY library_op_own ON library_private.operations USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
ALTER POLICY library_op_item_own ON library_private.operation_items USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
ALTER POLICY library_folder_op_own ON library_private.folder_operations USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));
COMMIT;
