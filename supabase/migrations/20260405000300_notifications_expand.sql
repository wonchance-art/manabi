-- notifications.type 제약 확장 + post_id 필드 일반화
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('comment', 'mention', 'achievement', 'levelup', 'streak', 'system'));

-- post_id / actor_id 이미 nullable이므로 추가 변경 불필요
