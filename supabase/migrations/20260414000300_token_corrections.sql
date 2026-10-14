-- 형태소 분석 결과 교정 히스토리
-- material_id는 처음에 uuid로 적혀 reading_materials.id(bigint) 참조가 42804로 실패했다(새 DB에서 표가 생기지 않음).
-- 새 DB 체인이 여기서 멈추지 않게 bigint로 고쳤다(오너 승인 2026-10-14). 이미 다른 상태로 만들어진 DB는
-- 20261013150000_token_corrections_material_bigint.sql이 비파괴로 맞춘다.
CREATE TABLE IF NOT EXISTS token_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id bigint NOT NULL REFERENCES reading_materials(id) ON DELETE CASCADE,
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
