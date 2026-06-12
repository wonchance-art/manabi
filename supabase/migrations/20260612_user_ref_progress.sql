-- 레퍼런스 챕터 학습 진행 동기화 (읽음·패턴 체크 결과)
-- localStorage 전용이던 진행 기록을 로그인 사용자에 한해 기기 간 동기화한다.

-- ① 테이블
CREATE TABLE IF NOT EXISTS user_ref_progress (
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lang        text NOT NULL CHECK (lang IN ('Japanese', 'English', 'French')),
  slug        text NOT NULL,
  read        boolean NOT NULL DEFAULT false,
  check_right int,
  check_total int,
  passed      boolean,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lang, slug)
);

-- ② 인덱스 — PK(user_id, lang, slug)가 사용자별 조회를 커버하므로 추가 인덱스 불필요

-- ③ RLS — 본인 행만 읽기/쓰기
ALTER TABLE user_ref_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ref_progress_select_own" ON user_ref_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "ref_progress_insert_own" ON user_ref_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ref_progress_update_own" ON user_ref_progress
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ref_progress_delete_own" ON user_ref_progress
  FOR DELETE USING (auth.uid() = user_id);
