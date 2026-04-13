-- 공유 단어장 덱을 특정 자료와 연결 (선택)
ALTER TABLE vocab_decks
  ADD COLUMN IF NOT EXISTS source_material_id uuid REFERENCES reading_materials(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS vocab_decks_source_material_idx
  ON vocab_decks (source_material_id)
  WHERE source_material_id IS NOT NULL;
