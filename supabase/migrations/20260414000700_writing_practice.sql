-- 쓰기 연습 히스토리
CREATE TABLE IF NOT EXISTS writing_practice (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sentence text NOT NULL,
  score integer,
  corrected text,
  translation text,
  feedback text,
  used_words text[],
  missed_words text[],
  language text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS writing_practice_user_created_idx ON writing_practice (user_id, created_at DESC);

ALTER TABLE writing_practice ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own writing practice" ON writing_practice;
CREATE POLICY "Users can view their own writing practice"
  ON writing_practice FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own writing practice" ON writing_practice;
CREATE POLICY "Users can insert their own writing practice"
  ON writing_practice FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own writing practice" ON writing_practice;
CREATE POLICY "Users can delete their own writing practice"
  ON writing_practice FOR DELETE
  USING (auth.uid() = user_id);
