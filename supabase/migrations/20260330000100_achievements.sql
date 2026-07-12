CREATE TABLE IF NOT EXISTS user_achievements (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  achievement_id TEXT NOT NULL,
  earned_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_achievements" ON user_achievements
  FOR ALL USING (auth.uid() = user_id);
