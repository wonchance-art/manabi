-- 단어 저장 시 출처 문장 보존
-- (reading_materials.id는 bigint)
ALTER TABLE user_vocabulary
  ADD COLUMN IF NOT EXISTS source_sentence text,
  ADD COLUMN IF NOT EXISTS source_material_id bigint REFERENCES reading_materials(id) ON DELETE SET NULL;
