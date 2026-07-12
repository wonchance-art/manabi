-- 오늘의 추천 자료 테이블
-- date + video_id 조합은 유일해야 함 (중복 방지)

CREATE TABLE IF NOT EXISTS daily_suggestions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL DEFAULT CURRENT_DATE,
  language text NOT NULL,          -- 'Japanese' | 'English'
  source text NOT NULL DEFAULT 'youtube',  -- 'youtube' | 'nhk_easy'
  video_id text NOT NULL,          -- YouTube video_id 또는 NHK article_id
  title text NOT NULL,
  channel_name text,
  thumbnail_url text,
  transcript text,                 -- 추출된 자막/본문 (NULL이면 자막 없음)
  level text,                      -- 'N3 중급', 'B1 중급' 등
  created_at timestamptz DEFAULT now(),
  UNIQUE(date, video_id)
);

ALTER TABLE daily_suggestions ENABLE ROW LEVEL SECURITY;

-- 누구나 읽을 수 있음
CREATE POLICY "public_read_suggestions"
  ON daily_suggestions FOR SELECT USING (true);
