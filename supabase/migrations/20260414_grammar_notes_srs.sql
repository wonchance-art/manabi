-- grammar_notes에 SRS 필드 추가 (단어와 동일한 FSRS 복습 대상으로)
ALTER TABLE grammar_notes
  ADD COLUMN IF NOT EXISTS interval double precision DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ease_factor double precision DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repetitions integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_review_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz;
