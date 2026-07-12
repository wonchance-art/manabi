-- Atomic like/unlike RPC functions
-- Race condition 방지: UPDATE + RETURNING으로 단일 트랜잭션 처리

-- 게시글 좋아요 추가
CREATE OR REPLACE FUNCTION add_post_like(p_post_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO forum_post_likes (post_id, user_id) VALUES (p_post_id, p_user_id)
    ON CONFLICT DO NOTHING;
  UPDATE forum_posts SET likes_count = likes_count + 1 WHERE id = p_post_id;
END;
$$;

-- 게시글 좋아요 취소
CREATE OR REPLACE FUNCTION remove_post_like(p_post_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM forum_post_likes WHERE post_id = p_post_id AND user_id = p_user_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  IF deleted_count > 0 THEN
    UPDATE forum_posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = p_post_id;
  END IF;
END;
$$;

-- 댓글 좋아요 추가
CREATE OR REPLACE FUNCTION add_comment_like(p_comment_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO forum_comment_likes (comment_id, user_id) VALUES (p_comment_id, p_user_id)
    ON CONFLICT DO NOTHING;
  UPDATE forum_comments SET likes_count = likes_count + 1 WHERE id = p_comment_id;
END;
$$;

-- 댓글 좋아요 취소
CREATE OR REPLACE FUNCTION remove_comment_like(p_comment_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM forum_comment_likes WHERE comment_id = p_comment_id AND user_id = p_user_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  IF deleted_count > 0 THEN
    UPDATE forum_comments SET likes_count = GREATEST(0, likes_count - 1) WHERE id = p_comment_id;
  END IF;
END;
$$;
