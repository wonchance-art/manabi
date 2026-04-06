-- 커스텀 일일 목표 컬럼 추가
-- goal_review: 하루 복습 목표 (기본 5개)
-- goal_words:  하루 단어 수집 목표 (기본 5개)
-- goal_read:   하루 완독 목표 (기본 1편)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS goal_review INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS goal_words  INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS goal_read   INTEGER NOT NULL DEFAULT 1;
