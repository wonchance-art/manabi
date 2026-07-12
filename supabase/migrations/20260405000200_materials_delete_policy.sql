-- reading_materials: 소유자 삭제 정책
-- RLS가 활성화되어 있지만 DELETE 정책이 없어 삭제가 무시되던 문제 수정
CREATE POLICY "owner_delete_material"
  ON reading_materials FOR DELETE
  USING (auth.uid() = owner_id);
