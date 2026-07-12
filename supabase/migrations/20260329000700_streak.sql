-- 스트릭 추적용 컬럼 추가
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_streak_date date;

-- 스트릭 업데이트 RPC
-- 오늘 이미 업데이트 → 무시
-- 어제 업데이트   → 스트릭 +1
-- 그 외(공백)     → 1로 리셋
CREATE OR REPLACE FUNCTION update_streak(uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_date date;
  today_date date := current_date;
BEGIN
  SELECT last_streak_date INTO last_date
  FROM profiles WHERE id = uid;

  IF last_date = today_date THEN
    RETURN; -- 이미 오늘 업데이트됨
  ELSIF last_date = today_date - INTERVAL '1 day' THEN
    UPDATE profiles
    SET streak_count     = COALESCE(streak_count, 0) + 1,
        last_streak_date = today_date
    WHERE id = uid;
  ELSE
    UPDATE profiles
    SET streak_count     = 1,
        last_streak_date = today_date
    WHERE id = uid;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION update_streak(uuid) TO authenticated;
