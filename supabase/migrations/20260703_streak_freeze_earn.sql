-- 스트릭 프리즈: XP 구매(buy_streak_freeze) → 자동 적립으로 전환
--
-- ⚠️ 이 리포는 마이그레이션 자동 적용 CI가 없습니다.
--    Supabase 대시보드 → SQL Editor 에서 이 파일 전체를 붙여넣고 직접 실행하세요.
--    (기존 20260408_streak_freeze.sql은 이력 보존을 위해 수정하지 않았습니다 —
--     이 파일이 update_streak을 CREATE OR REPLACE로 덮어쓰고, buy_streak_freeze는 제거합니다.)
--
-- 변경 사항:
--   1. streak_count가 7의 배수로 증가할 때마다 streak_freeze_count +1 (최대 2개 보유)
--   2. XP 소모 방식이었던 buy_streak_freeze RPC 삭제 (XP 시스템 폐기에 따른 잔재 정리)

-- 컬럼이 아직 없는 환경(20260408을 실행한 적 없는 DB)에서도 이 파일만으로 완결되도록 재확인
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS streak_freeze_count int NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION update_streak(uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_date date;
  today_date date := current_date;
  freezes int;
  new_streak int;
BEGIN
  SELECT last_streak_date, streak_freeze_count
  INTO last_date, freezes
  FROM profiles WHERE id = uid;

  IF last_date = today_date THEN
    RETURN; -- 이미 오늘 업데이트됨
  ELSIF last_date = today_date - INTERVAL '1 day' THEN
    -- 연속: 스트릭 +1
    UPDATE profiles
    SET streak_count     = COALESCE(streak_count, 0) + 1,
        last_streak_date = today_date
    WHERE id = uid
    RETURNING streak_count INTO new_streak;

    -- 7일 연속 달성마다 프리즈 티켓 1개 적립 (최대 2개)
    IF new_streak % 7 = 0 THEN
      UPDATE profiles
      SET streak_freeze_count = LEAST(streak_freeze_count + 1, 2)
      WHERE id = uid;
    END IF;
  ELSIF last_date = today_date - INTERVAL '2 day' AND freezes > 0 THEN
    -- 하루 빠졌지만 프리즈 티켓을 소모해 연속으로 이어감
    UPDATE profiles
    SET streak_count       = COALESCE(streak_count, 0) + 1,
        last_streak_date   = today_date,
        streak_freeze_count = streak_freeze_count - 1
    WHERE id = uid
    RETURNING streak_count INTO new_streak;

    -- 티켓을 소모해 이어간 경우에도 연속 카운트이므로 동일하게 7일마다 적립
    IF new_streak % 7 = 0 THEN
      UPDATE profiles
      SET streak_freeze_count = LEAST(streak_freeze_count + 1, 2)
      WHERE id = uid;
    END IF;
  ELSE
    -- 스트릭 리셋
    UPDATE profiles
    SET streak_count     = 1,
        last_streak_date = today_date
    WHERE id = uid;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION update_streak(uuid) TO authenticated;

-- XP 구매 잔재 제거 — 더 이상 XP로 구매하지 않음, 적립만으로 획득
DROP FUNCTION IF EXISTS buy_streak_freeze(uuid, int);
