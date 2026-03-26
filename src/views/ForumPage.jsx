'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import Spinner from '../components/Spinner';
import Button from '../components/Button';

const PAGE_SIZE = 10;

async function fetchPosts(page) {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, error, count } = await supabase
    .from('forum_posts')
    .select('*, author:profiles(display_name, avatar_url, streak_count)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { posts: data || [], total: count ?? 0 };
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
  const toast = useToast();
  const queryClient = useQueryClient();
  const [newPost, setNewPost] = useState('');
  const [expandedPostId, setExpandedPostId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [page, setPage] = useState(0);
  const [allPosts, setAllPosts] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const realtimeRef = useRef(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['forum-posts', page],
    queryFn: () => fetchPosts(page),
    placeholderData: (prev) => prev,
  });

  // 페이지 데이터가 오면 누적
  useEffect(() => {
    if (!data) return;
    if (page === 0) {
      setAllPosts(data.posts);
    } else {
      setAllPosts(prev => {
        const ids = new Set(prev.map(p => p.id));
        return [...prev, ...data.posts.filter(p => !ids.has(p.id))];
      });
    }
    setHasMore(data.posts.length === PAGE_SIZE && (page + 1) * PAGE_SIZE < data.total);
  }, [data, page]);

  // Supabase Realtime — 새 게시글 실시간 반영
  useEffect(() => {
    realtimeRef.current = supabase
      .channel('forum_posts_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'forum_posts' },
        async (payload) => {
          // 새 글 작성자 프로필 보강
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url, streak_count')
            .eq('id', payload.new.author_id)
            .maybeSingle();
          const newEntry = { ...payload.new, author: profile || null };
          setAllPosts(prev => {
            if (prev.some(p => p.id === newEntry.id)) return prev;
            return [newEntry, ...prev];
          });
          // 자신이 쓴 글이 아닐 때만 알림
          if (payload.new.author_id !== user?.id) {
            toast(`${profile?.display_name || '누군가'}가 새 글을 올렸어요!`, 'info', 4000);
          }
        }
      )
      .subscribe();

    return () => {
      realtimeRef.current?.unsubscribe();
    };
  }, [user?.id]);

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
      setNewPost('');
      setPage(0);
      queryClient.invalidateQueries({ queryKey: ['forum-posts'] });
      toast('게시글을 올렸습니다!', 'success');
    },
    onError: (err) => toast('글 작성 실패: ' + err.message, 'error'),
  });

  const commentMutation = useMutation({
    mutationFn: async ({ postId, content }) => {
      const { error } = await supabase.from('forum_comments').insert([{ post_id: postId, author_id: user.id, content }]);
      if (error) throw error;
    },
    onSuccess: (_, { postId }) => {
      queryClient.invalidateQueries({ queryKey: ['forum-comments', postId] });
      setCommentText('');
      toast('댓글을 달았습니다.', 'success');
    },
    onError: (err) => toast('댓글 등록 실패: ' + err.message, 'error'),
  });

  const likeMutation = useMutation({
    mutationFn: async ({ postId, currentCount }) => {
      const { error } = await supabase
        .from('forum_posts')
        .update({ likes_count: currentCount + 1 })
        .eq('id', postId);
      if (error) throw error;
    },
    onMutate: async ({ postId }) => {
      setAllPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: (p.likes_count || 0) + 1 } : p));
    },
    onError: (err) => toast('좋아요 실패: ' + err.message, 'error'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!user) { toast('로그인이 필요합니다.', 'warning'); return; }
    if (!newPost.trim()) return;
    postMutation.mutate(newPost.trim());
  };

  const handleCommentSubmit = (postId) => {
    if (!user) { toast('로그인이 필요합니다.', 'warning'); return; }
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
                {user?.user_metadata?.display_name?.[0] || '✏️'}
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
        {isLoading && page === 0 ? (
          <Spinner message="이야기를 불러오는 중..." />
        ) : (
          <div className="forum-list">
            {allPosts.map(post => (
              <div key={post.id} className="card forum-post">
                <div className="forum-compose">
                  <div className="forum-avatar">👤</div>
                  <div className="forum-post__body">
                    <div className="forum-post__meta">
                      <span className="forum-post__name">{post.author?.display_name || '익명 사용자'}</span>
                      {post.author?.streak_count > 0 && (
                        <span className="forum-post__streak">🔥 {post.author.streak_count}</span>
                      )}
                      <span className="forum-post__date">· {new Date(post.created_at).toLocaleDateString('ko-KR')}</span>
                    </div>
                    <p className="forum-post__content">{post.content}</p>
                    <div className="forum-post__actions">
                      <button
                        className="forum-action-btn"
                        onClick={() => user && likeMutation.mutate({ postId: post.id, currentCount: post.likes_count || 0 })}
                        title={user ? '좋아요' : '로그인 후 좋아요를 누를 수 있어요'}
                      >
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

            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <Button
                  variant="secondary"
                  onClick={() => setPage(p => p + 1)}
                  disabled={isFetching}
                >
                  {isFetching ? '불러오는 중...' : '더 보기'}
                </Button>
              </div>
            )}

            {!isLoading && allPosts.length === 0 && (
              <div className="empty-state">
                <p>아직 게시글이 없어요. 첫 글을 남겨보세요!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
