-- 알림 테이블
CREATE TABLE IF NOT EXISTS notifications (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       text NOT NULL CHECK (type IN ('comment', 'mention')),
  actor_id   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  post_id    uuid REFERENCES forum_posts(id) ON DELETE CASCADE,
  message    text NOT NULL,
  is_read    boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 본인 알림만 조회 가능
CREATE POLICY "read_own_notifications"
  ON notifications FOR SELECT USING (user_id = auth.uid());

-- 로그인한 사용자는 다른 사람에게 알림 발송 가능 (댓글/멘션)
CREATE POLICY "insert_notifications"
  ON notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 본인 알림 읽음 처리
CREATE POLICY "update_own_notifications"
  ON notifications FOR UPDATE USING (user_id = auth.uid());
