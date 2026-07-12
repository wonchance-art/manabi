-- 형태소 분석 결과 교정 히스토리
CREATE TABLE IF NOT EXISTS token_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES reading_materials(id) ON DELETE CASCADE,
  token_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS token_corrections_material_token_idx
  ON token_corrections (material_id, token_id);
CREATE INDEX IF NOT EXISTS token_corrections_user_idx
  ON token_corrections (user_id, created_at DESC);

ALTER TABLE token_corrections ENABLE ROW LEVEL SECURITY;

-- 자료 소유자 또는 교정한 본인이 볼 수 있음
DROP POLICY IF EXISTS "Owner or author can view corrections" ON token_corrections;
CREATE POLICY "Owner or author can view corrections"
  ON token_corrections FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM reading_materials m
      WHERE m.id = token_corrections.material_id AND m.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can insert corrections" ON token_corrections;
CREATE POLICY "Authenticated users can insert corrections"
  ON token_corrections FOR INSERT
  WITH CHECK (auth.uid() = user_id);
