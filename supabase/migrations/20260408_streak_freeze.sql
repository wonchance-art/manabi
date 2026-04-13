-- 스트릭 프리즈 티켓
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS streak_freeze_count int NOT NULL DEFAULT 0;

-- update_streak: 프리즈 티켓 사용 로직 추가
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
    WHERE id = uid;
  ELSIF last_date = today_date - INTERVAL '2 day' AND freezes > 0 THEN
    -- 하루 빠졌지만 프리즈 티켓 사용
    UPDATE profiles
    SET streak_count       = COALESCE(streak_count, 0) + 1,
        last_streak_date   = today_date,
        streak_freeze_count = streak_freeze_count - 1
    WHERE id = uid;
  ELSE
    -- 스트릭 리셋
    UPDATE profiles
    SET streak_count     = 1,
        last_streak_date = today_date
    WHERE id = uid;
  END IF;
END;
$$;

-- 스트릭 프리즈 구매 (XP 차감)
CREATE OR REPLACE FUNCTION buy_streak_freeze(uid uuid, cost int DEFAULT 100)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_xp int;
BEGIN
  SELECT xp INTO current_xp FROM profiles WHERE id = uid;
  IF current_xp < cost THEN
    RETURN false;
  END IF;
  UPDATE profiles
  SET xp = xp - cost,
      streak_freeze_count = streak_freeze_count + 1
  WHERE id = uid;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION buy_streak_freeze(uuid, int) TO authenticated;
