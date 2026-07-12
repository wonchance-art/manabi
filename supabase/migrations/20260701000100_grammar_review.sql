-- 문법 SRS 복습 큐 + 오답 이벤트 로그
-- 챕터 퀴즈(패턴 체크)를 통과한 챕터가 FSRS 스케줄로 되돌아오는 복습 루프의 저장소.
-- review_events는 모든 학습 기능(vocab/grammar/dictation/writing)의 오답을 모으는
-- append-only 로그 — 약점 진단·맞춤 드릴의 데이터 축.

-- ① 문법 복습 큐 — FSRS 컬럼명은 user_vocabulary와 동일 규약
--    (interval→stability, ease_factor→difficulty, repetitions→lapses; src/lib/fsrs.js 참고)
--    lang에 CHECK 제약을 두지 않음 — user_ref_progress에서 중국어 추가 때 제약 수정이
--    필요했던 전례 재발 방지.
CREATE TABLE IF NOT EXISTS grammar_review (
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lang             text NOT NULL,
  slug             text NOT NULL,
  interval         double precision NOT NULL DEFAULT 0,
  ease_factor      double precision NOT NULL DEFAULT 0,
  repetitions      int NOT NULL DEFAULT 0,
  next_review_at   timestamptz NOT NULL DEFAULT now(),
  last_reviewed_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lang, slug)
);

-- due 조회(user_id + next_review_at)는 PK 선두 컬럼 + 필터로 충분한 규모이나,
-- 홈 카드가 매 방문 count를 치므로 부분 정렬 인덱스를 하나 둔다.
CREATE INDEX IF NOT EXISTS grammar_review_due_idx
  ON grammar_review (user_id, next_review_at);

ALTER TABLE grammar_review ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grammar_review_select_own" ON grammar_review
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "grammar_review_insert_own" ON grammar_review
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "grammar_review_update_own" ON grammar_review
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "grammar_review_delete_own" ON grammar_review
  FOR DELETE USING (auth.uid() = user_id);

-- ② 오답 이벤트 로그 — append-only (update/delete 정책 없음)
CREATE TABLE IF NOT EXISTS review_events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lang       text NOT NULL,
  source     text NOT NULL,          -- 'vocab' | 'grammar' | 'dictation' | 'writing'
  item_key   text NOT NULL,          -- 기능별 식별자 (예: 문법은 "slug#문항id")
  correct    boolean NOT NULL,
  detail     jsonb,                  -- 오답 내용(문항 프롬프트·고른 답 등)
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS review_events_user_time_idx
  ON review_events (user_id, created_at DESC);

ALTER TABLE review_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_events_select_own" ON review_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "review_events_insert_own" ON review_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
