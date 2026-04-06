-- XP 시스템: profiles에 xp 컬럼, user_vocabulary에 last_reviewed_at 추가

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0;

ALTER TABLE user_vocabulary
  ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ;

-- XP 원자적 증가 RPC (race condition 방지)
CREATE OR REPLACE FUNCTION award_xp(uid UUID, amount INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET xp = COALESCE(xp, 0) + amount
  WHERE id = uid;
END;
$$;
