-- 읽기 진행/완료 추적
CREATE TABLE IF NOT EXISTS reading_progress (
  id           bigserial PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id  bigint NOT NULL REFERENCES reading_materials(id) ON DELETE CASCADE,
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE (user_id, material_id)
);

ALTER TABLE reading_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_reading_progress" ON reading_progress
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 문법 노트 저장
CREATE TABLE IF NOT EXISTS grammar_notes (
  id              bigserial PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id     bigint REFERENCES reading_materials(id) ON DELETE SET NULL,
  selected_text   text NOT NULL,
  explanation     text NOT NULL,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE grammar_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_grammar_notes" ON grammar_notes
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
