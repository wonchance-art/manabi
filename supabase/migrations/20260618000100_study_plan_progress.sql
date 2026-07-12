-- 내 진도(관리자 학습 진도표) 기기 간 동기화
-- localStorage 전용이던 완료 체크를 로그인 사용자별로 서버에 저장한다.
-- (user, lang) 한 행에 완료 번호 배열(done)을 통째로 upsert.

-- ① 테이블
CREATE TABLE IF NOT EXISTS study_plan_progress (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lang       text NOT NULL CHECK (lang IN ('zh', 'fr')),
  done       int[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lang)
);

-- ② RLS — 본인 행만 읽기/쓰기
ALTER TABLE study_plan_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "study_plan_select_own" ON study_plan_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "study_plan_insert_own" ON study_plan_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "study_plan_update_own" ON study_plan_progress
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "study_plan_delete_own" ON study_plan_progress
  FOR DELETE USING (auth.uid() = user_id);
