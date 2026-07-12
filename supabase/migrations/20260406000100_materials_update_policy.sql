-- reading_materials: 소유자 업데이트 정책
-- UPDATE 정책 없어서 onBatch DB 저장이 조용히 실패 → status가 'analyzing'에 고정되던 문제 수정
CREATE POLICY "owner_update_material"
  ON reading_materials FOR UPDATE
  USING (auth.uid() = owner_id);
