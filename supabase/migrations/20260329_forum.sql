-- Forum tables: posts, comments, likes, notifications

CREATE TABLE IF NOT EXISTS forum_posts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 2000),
  likes_count int NOT NULL DEFAULT 0,
  comments_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS forum_comments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id bigint NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 1000),
  likes_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS forum_post_likes (
  post_id bigint NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS forum_comment_likes (
  comment_id bigint NOT NULL REFERENCES forum_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'comment' | 'mention' | 'like'
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  post_id bigint REFERENCES forum_posts(id) ON DELETE CASCADE,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- forum_posts
CREATE POLICY "Anyone can read posts" ON forum_posts FOR SELECT USING (true);
CREATE POLICY "Auth users can insert posts" ON forum_posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Author can delete own posts" ON forum_posts FOR DELETE USING (auth.uid() = author_id);

-- forum_comments
CREATE POLICY "Anyone can read comments" ON forum_comments FOR SELECT USING (true);
CREATE POLICY "Auth users can insert comments" ON forum_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Author can delete own comments" ON forum_comments FOR DELETE USING (auth.uid() = author_id);

-- forum_post_likes
CREATE POLICY "Anyone can read post likes" ON forum_post_likes FOR SELECT USING (true);
CREATE POLICY "Auth users can insert post likes" ON forum_post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User can delete own post likes" ON forum_post_likes FOR DELETE USING (auth.uid() = user_id);

-- forum_comment_likes
CREATE POLICY "Anyone can read comment likes" ON forum_comment_likes FOR SELECT USING (true);
CREATE POLICY "Auth users can insert comment likes" ON forum_comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User can delete own comment likes" ON forum_comment_likes FOR DELETE USING (auth.uid() = user_id);

-- notifications
CREATE POLICY "User can read own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "User can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Functions for likes (atomic increment/decrement)
CREATE OR REPLACE FUNCTION add_post_like(p_post_id bigint, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO forum_post_likes (post_id, user_id) VALUES (p_post_id, p_user_id)
  ON CONFLICT DO NOTHING;
  UPDATE forum_posts SET likes_count = likes_count + 1 WHERE id = p_post_id;
END;
$$;

CREATE OR REPLACE FUNCTION remove_post_like(p_post_id bigint, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted int;
BEGIN
  DELETE FROM forum_post_likes WHERE post_id = p_post_id AND user_id = p_user_id;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  IF deleted > 0 THEN
    UPDATE forum_posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = p_post_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION add_comment_like(p_comment_id bigint, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO forum_comment_likes (comment_id, user_id) VALUES (p_comment_id, p_user_id)
  ON CONFLICT DO NOTHING;
  UPDATE forum_comments SET likes_count = likes_count + 1 WHERE id = p_comment_id;
END;
$$;

CREATE OR REPLACE FUNCTION remove_comment_like(p_comment_id bigint, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted int;
BEGIN
  DELETE FROM forum_comment_likes WHERE comment_id = p_comment_id AND user_id = p_user_id;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  IF deleted > 0 THEN
    UPDATE forum_comments SET likes_count = GREATEST(0, likes_count - 1) WHERE id = p_comment_id;
  END IF;
END;
$$;

-- Trigger: update comments_count on forum_posts
CREATE OR REPLACE FUNCTION update_post_comments_count()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE forum_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE forum_posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_post_comments_count
AFTER INSERT OR DELETE ON forum_comments
FOR EACH ROW EXECUTE FUNCTION update_post_comments_count();
