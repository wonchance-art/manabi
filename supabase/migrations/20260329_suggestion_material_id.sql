-- 추천 자료에 분석 완료된 material_id 연결
ALTER TABLE daily_suggestions
  ADD COLUMN IF NOT EXISTS material_id bigint REFERENCES reading_materials(id) ON DELETE SET NULL;
