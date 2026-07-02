-- 오늘의 문단 저장소 — 공부 모드에서 생성·검증을 통과한 문단 payload를 보관한다.
-- 용도: ① 내일 문단 프리페치(status='prefetched') → 다음 세션 즉시 시작,
--       ② 주제 로테이션(최근 theme 회피), ③ 효과 매핑 재현(materials에 slug·word id 포함).
-- 주의: 마이그레이션이 CI 자동 적용되지 않는 환경 — 테이블 부재 시에도 앱은 무해하게
--       동작해야 한다(프리페치 저장/조회 실패는 무시하고 라이브 경로로 폴백).
CREATE TABLE IF NOT EXISTS study_paragraphs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lang text NOT NULL,
  level text,
  status text NOT NULL DEFAULT 'used',   -- 'prefetched' | 'used' | 'expired'
  theme text,                            -- 주제 로테이션용
  materials jsonb NOT NULL,              -- 생성 재료 (slug·word id 포함 — 효과 매핑 재현용)
  paragraph jsonb NOT NULL,              -- 검증 통과한 문단 payload
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS study_paragraphs_user_idx
  ON study_paragraphs (user_id, lang, status, created_at DESC);

ALTER TABLE study_paragraphs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "study_paragraphs_select_own" ON study_paragraphs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "study_paragraphs_insert_own" ON study_paragraphs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "study_paragraphs_update_own" ON study_paragraphs
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "study_paragraphs_delete_own" ON study_paragraphs
  FOR DELETE USING (auth.uid() = user_id);
