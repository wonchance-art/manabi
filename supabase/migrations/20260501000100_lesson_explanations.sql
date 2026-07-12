-- 강의(Lesson) 한국어 설명 캐시 컬럼
-- Gemini로 첫 진입자가 생성, 영구 보관 → 다음 사용자는 즉시 노출

ALTER TABLE reading_materials
  ADD COLUMN IF NOT EXISTS lesson_explanation_ko text;
