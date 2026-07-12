-- 추천 콘텐츠 소스 관리 테이블
-- source_type: 'wikipedia_random' | 'nhk_easy'
-- config 예시:
--   wikipedia_random: { "lang": "simple", "level": "B1 중급" }
--   nhk_easy:         { "level": "N3 중급" }

CREATE TABLE IF NOT EXISTS content_sources (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  language    text    NOT NULL CHECK (language IN ('Japanese', 'English')),
  source_type text    NOT NULL,
  name        text    NOT NULL,
  config      jsonb   NOT NULL DEFAULT '{}',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE content_sources ENABLE ROW LEVEL SECURITY;

-- 누구나 읽을 수 있음 (cron route에서 anon key로도 조회)
CREATE POLICY "public_read_sources"
  ON content_sources FOR SELECT USING (true);

-- INSERT/UPDATE/DELETE는 service_role만 (RLS bypass)
-- 또는 admin 클라이언트 측에서 service_role key 사용

-- 기본 소스 시드 데이터
INSERT INTO content_sources (language, source_type, name, config, is_active) VALUES
  ('Japanese', 'nhk_easy',         'NHK Web Easy',              '{"level": "N3 중급"}',           true),
  ('Japanese', 'wikipedia_random', '日本語 Wikipedia',           '{"lang": "ja", "level": "N3 중급"}', true),
  ('English',  'wikipedia_random', 'Simple English Wikipedia',  '{"lang": "simple", "level": "B1 중급"}', true);
