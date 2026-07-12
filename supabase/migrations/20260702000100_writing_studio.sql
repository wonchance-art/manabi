-- 라이팅 스튜디오 — writing_practice 확장
-- 20260414에 만들어졌지만 UI가 없던 테이블을 부활시키며, 프롬프트 맥락과
-- 구조화 첨삭 결과·재작문 링크를 담을 컬럼을 더한다. 기존 행·정책은 그대로.

ALTER TABLE writing_practice ADD COLUMN IF NOT EXISTS prompt_type text;      -- 'chapter' | 'topic' | 'free'
ALTER TABLE writing_practice ADD COLUMN IF NOT EXISTS prompt text;           -- 표시된 프롬프트 원문
ALTER TABLE writing_practice ADD COLUMN IF NOT EXISTS level text;            -- N5·A1·H1 등
ALTER TABLE writing_practice ADD COLUMN IF NOT EXISTS chapter_slug text;     -- 챕터 연동 작문일 때
ALTER TABLE writing_practice ADD COLUMN IF NOT EXISTS errors jsonb;          -- 구조화 오류 목록 [{part,fix,why,tag}]
ALTER TABLE writing_practice ADD COLUMN IF NOT EXISTS revision_of uuid REFERENCES writing_practice(id) ON DELETE SET NULL;  -- 재작문 1차 링크
