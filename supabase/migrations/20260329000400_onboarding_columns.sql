-- 온보딩 관련 컬럼 추가
-- onboarded: 온보딩 완료 여부 (기존 유저는 true로 초기화)
-- learning_language: 학습 언어 배열 (예: ['Japanese', 'English'])
-- learning_level_japanese, learning_level_english: 수준 선택값

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS learning_language text[] NOT NULL DEFAULT ARRAY['Japanese'],
  ADD COLUMN IF NOT EXISTS learning_level_japanese text NOT NULL DEFAULT 'N3 중급',
  ADD COLUMN IF NOT EXISTS learning_level_english text NOT NULL DEFAULT 'B1 중급';

-- 마이그레이션 시점에 존재하는 모든 유저는 이미 온보딩 불필요 → true로 표시
-- (이후 신규 가입자는 DEFAULT false를 받으므로 온보딩 모달이 표시됨)
UPDATE profiles SET onboarded = true;
