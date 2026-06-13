-- D-Day 타일 설정 — 기기 간 동기화 (profiles 칼럼, 본인 행 RLS는 기존 정책 적용)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS dday_date  date,
  ADD COLUMN IF NOT EXISTS dday_label text;
