-- 웹 푸시 구독 저장소 — 기획 v4 §4.1 (docs/plan-v4-eyes-and-voice.md).
-- 브라우저 PushManager 구독(endpoint + p256dh/auth 키)을 사용자별로 보관한다.
-- 발송자(Vercel Cron /api/cron/send-forecast)가 preferred_hour == 현재 UTC시인
-- 구독 행만 골라 VAPID로 푸시한다. 만료(410) endpoint는 발송 회로가 행을 삭제한다.
--
-- ⚠️ 이 리포는 마이그레이션 자동 적용 CI가 없습니다.
--    Supabase 대시보드 → SQL Editor 에서 이 파일 전체를 붙여넣고 직접 실행하세요.
-- 주의: 테이블 부재 시에도 앱은 무해하게 동작해야 한다 — 구독/해제 실패는 조용히 무시(push.js).

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint       text NOT NULL UNIQUE,     -- 브라우저 구독 endpoint (기기·브라우저별 고유)
  keys           jsonb NOT NULL,           -- { p256dh, auth } — VAPID 암호화 키쌍
  lang           text,                     -- 학습 언어(카피 언어 선택용)
  preferred_hour smallint,                 -- 발송 시각(UTC 기준 0-23) — 관측 세션 시각 중앙값 또는 로컬 20시 근사
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON push_subscriptions (user_id);

-- 발송 회로가 매시 "이 시각에 보낼 구독"을 스캔하는 경로
CREATE INDEX IF NOT EXISTS push_subscriptions_hour_idx
  ON push_subscriptions (preferred_hour);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_select_own" ON push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_insert_own" ON push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_update_own" ON push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_delete_own" ON push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);
