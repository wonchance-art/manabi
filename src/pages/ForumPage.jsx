import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import Spinner from '../components/Spinner';
import Button from '../components/Button';

async function fetchPosts() {
  const { data, error } = await supabase
    .from('forum_posts')
    .select('*, author:profiles(display_name, avatar_url, streak_count)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function fetchComments(postId) {
  const { data, error } = await supabase
    .from('forum_comments')
    .select('*, author:profiles(display_name, avatar_url)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export default function ForumPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newPost, setNewPost] = useState('');
  const [expandedPostId, setExpandedPostId] = useState(null);
  const [commentText, setCommentText] = useState('');

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['forum-posts'],
    queryFn: fetchPosts,
  });

  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ['forum-comments', expandedPostId],
    queryFn: () => fetchComments(expandedPostId),
    enabled: !!expandedPostId,
  });

  const postMutation = useMutation({
    mutationFn: async (content) => {
      const { error } = await supabase.from('forum_posts').insert([{ author_id: user.id, content }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-posts'] });
      setNewPost('');
    },
    onError: (err) => alert("글 작성 실패: " + err.message),
  });

  const commentMutation = useMutation({
    mutationFn: async ({ postId, content }) => {
      const { error } = await supabase.from('forum_comments').insert([{ post_id: postId, author_id: user.id, content }]);
      if (error) throw error;
    },
    onSuccess: (_, { postId }) => {
      queryClient.invalidateQueries({ queryKey: ['forum-comments', postId] });
      setCommentText('');
    },
    onError: (err) => alert("댓글 등록 실패: " + err.message),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!user) return alert("로그인이 필요합니다.");
    if (!newPost.trim()) return;
    postMutation.mutate(newPost.trim());
  };

  const handleCommentSubmit = (postId) => {
    if (!user) return alert("로그인이 필요합니다.");
    if (!commentText.trim()) return;
    commentMutation.mutate({ postId, content: commentText.trim() });
  };

  const togglePost = (postId) => {
    setExpandedPostId(prev => prev === postId ? null : postId);
    setCommentText('');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-header__title">💬 커뮤니티 포럼</h1>
        <p className="page-header__subtitle">다른 학습자들과 소통하며 함께 공부하세요</p>
      </div>

      <div className="forum-wrap">
        {/* Post Input */}
        <div className="card forum-post-input">
          <form onSubmit={handleSubmit}>
            <div className="forum-compose">
              <div className="forum-avatar forum-avatar--gradient">
                {user?.display_name?.[0] || '✏️'}
              </div>
              <div className="forum-compose__body">
                <textarea
                  value={newPost}
                  onChange={e => setNewPost(e.target.value)}
                  placeholder="오늘 어떤 공부를 하셨나요? 자유롭게 남겨보세요."
                  className="forum-textarea"
                />
                <div className="forum-compose__footer">
                  <Button type="submit" size="sm" disabled={postMutation.isPending || !newPost.trim()}
                    style={{ borderRadius: 'var(--radius-full)' }}>
                    {postMutation.isPending ? '게시 중...' : '게시하기'}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Timeline */}
        {isLoading ? (
          <Spinner message="이야기를 불러오는 중..." />
        ) : (
          <div className="forum-list">
            {posts.map(post => (
              <div key={post.id} className="card forum-post">
                <div className="forum-compose">
                  <div className="forum-avatar">👤</div>
                  <div className="forum-post__body">
                    <div className="forum-post__meta">
                      <span className="forum-post__name">{post.author?.display_name || '익명 사용자'}</span>
                      {post.author?.streak_count > 0 && (
                        <span className="forum-post__streak">🔥 {post.author.streak_count}</span>
                      )}
                      <span className="forum-post__date">· {new Date(post.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="forum-post__content">{post.content}</p>
                    <div className="forum-post__actions">
                      <button className="forum-action-btn">
                        <span>❤️</span> {post.likes_count || 0}
                      </button>
                      <button
                        onClick={() => togglePost(post.id)}
                        className={`forum-action-btn ${expandedPostId === post.id ? 'forum-action-btn--active' : ''}`}
                      >
                        <span>💬</span> 댓글 {post.comments_count || 0}
                      </button>
                    </div>

                    {expandedPostId === post.id && (
                      <div className="forum-comments">
                        <div className="forum-comment-input">
                          <input
                            type="text"
                            value={commentText}
                            onChange={e => setCommentText(e.target.value)}
                            placeholder="따뜻한 댓글을 남겨주세요..."
                            onKeyDown={e => e.key === 'Enter' && handleCommentSubmit(post.id)}
                            className="form-input"
                            style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                          />
                          <Button size="sm" onClick={() => handleCommentSubmit(post.id)}>등록</Button>
                        </div>

                        <div className="forum-comment-list">
                          {commentsLoading ? (
                            <p className="forum-empty-msg">전달받는 중...</p>
                          ) : comments.length > 0 ? comments.map(c => (
                            <div key={c.id} className="forum-comment">
                              <div className="forum-comment__avatar">👤</div>
                              <div>
                                <div className="forum-comment__name">{c.author?.display_name || '익명'}</div>
                                <div className="forum-comment__text">{c.content}</div>
                              </div>
                            </div>
                          )) : (
                            <p className="forum-empty-msg">첫 댓글을 남겨보세요!</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
