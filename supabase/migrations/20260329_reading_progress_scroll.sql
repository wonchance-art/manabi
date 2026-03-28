-- 읽기 중 스크롤 위치 기억
ALTER TABLE reading_progress
  ADD COLUMN IF NOT EXISTS last_token_idx int DEFAULT 0;
