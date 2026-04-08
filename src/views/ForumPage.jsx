'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { checkAndAwardAchievements } from '../lib/achievements';
import { useCelebration } from '../lib/CelebrationContext';
import Button from '../components/Button';
import ConfirmModal from '../components/ConfirmModal';

const PAGE_SIZE = 10;

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

async function fetchPosts(page, userId) {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, error, count } = await supabase
    .from('forum_posts')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;

  const posts = data || [];
  if (posts.length === 0) return { posts: [], total: count ?? 0 };

  // 단일 IN 쿼리로 모든 author 한번에 가져오기 (N+1 제거)
  const authorIds = [...new Set(posts.map(p => p.author_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, streak_count')
    .in('id', authorIds);
  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

  let likedIds = new Set();
  if (userId) {
    const { data: likes } = await supabase
      .from('forum_post_likes')
      .select('post_id')
      .eq('user_id', userId)
      .in('post_id', posts.map(p => p.id));
    likedIds = new Set((likes || []).map(l => l.post_id));
  }

  return {
    posts: posts.map(p => ({ ...p, author: profileMap[p.author_id] || null, user_liked: likedIds.has(p.id) })),
    total: count ?? 0,
  };
}

async function fetchComments(postId, userId) {
  const { data, error } = await supabase
    .from('forum_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const rawComments = data || [];
  if (rawComments.length === 0) return [];

  const authorIds = [...new Set(rawComments.map(c => c.author_id).filter(Boolean))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', authorIds);
  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

  let likedSet = new Set();
  if (userId) {
    const { data: likes } = await supabase
      .from('forum_comment_likes')
      .select('comment_id')
      .eq('user_id', userId)
      .in('comment_id', rawComments.map(c => c.id));
    likedSet = new Set((likes || []).map(l => l.comment_id));
  }

  return rawComments.map(c => ({
    ...c,
    author: profileMap[c.author_id] || null,
    user_liked: likedSet.has(c.id),
  }));
}

function renderWithMentions(text) {
  if (!text) return null;
  const parts = text.split(/(@\S+)/g);
  return parts.map((part, i) =>
    part.startsWith('@')
      ? <span key={i} className="forum-mention">{part}</span>
      : part
  );
}

export default function ForumPage() {
  const { user, profile } = useAuth();
  const toast = useToast();
  const { celebrate } = useCelebration();
  const queryClient = useQueryClient();
  const [newPost, setNewPost] = useState('');
  const [expandedPostId, setExpandedPostId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [page, setPage] = useState(0);
  const [allPosts, setAllPosts] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionAnchor, setMentionAnchor] = useState(0);
  const realtimeRef = useRef(null);
  const commentInputRef = useRef(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [postCategory, setPostCategory] = useState('');

  const CATEGORIES = [
    { value: '', label: '일반' },
    { value: '[질문]', label: '질문' },
    { value: '[팁]', label: '팁/노하우' },
    { value: '[자료]', label: '자료 추천' },
    { value: '[인증]', label: '학습 인증' },
  ];

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['forum-posts', page, user?.id],
    queryFn: () => fetchPosts(page, user?.id),
    placeholderData: (prev) => prev,
  });

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

  useEffect(() => {
    realtimeRef.current = supabase
      .channel('forum_posts_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'forum_posts' }, async (payload) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, avatar_url, streak_count')
          .eq('id', payload.new.author_id)
          .maybeSingle();
        const newEntry = { ...payload.new, author: profile || null, user_liked: false };
        setAllPosts(prev => {
          if (prev.some(p => p.id === newEntry.id)) return prev;
          return [newEntry, ...prev];
        });
        if (payload.new.author_id !== user?.id) {
          toast(`${profile?.display_name || '누군가'}가 새 글을 올렸어요!`, 'info', 4000);
        }
      })
      .subscribe();

    return () => { realtimeRef.current?.unsubscribe(); };
  }, [user?.id]);

  const { data: comments = [], isLoading: commentsLoading, error: commentsError } = useQuery({
    queryKey: ['forum-comments', expandedPostId, user?.id],
    queryFn: () => fetchComments(expandedPostId, user?.id),
    enabled: !!expandedPostId,
  });

  const expandedPost = allPosts.find(p => p.id === expandedPostId);
  const mentionableUsers = expandedPost ? [
    ...(expandedPost.author?.display_name ? [expandedPost.author.display_name] : []),
    ...comments.map(c => c.author?.display_name).filter(Boolean),
  ].filter((name, i, arr) => arr.indexOf(name) === i && name !== (user?.user_metadata?.display_name)) : [];

  const filteredMentions = mentionQuery !== null
    ? mentionableUsers.filter(name => name.toLowerCase().includes(mentionQuery.toLowerCase()))
    : [];

  const postMutation = useMutation({
    mutationFn: async (content) => {
      const { error } = await supabase.from('forum_posts').insert([{ author_id: user.id, content }]);
      if (error) throw error;
    },
    onSuccess: () => {
      setNewPost('');
      setPostCategory('');
      setPage(0);
      queryClient.invalidateQueries({ queryKey: ['forum-posts'] });
      toast('게시글을 올렸습니다!', 'success');
      // first_post 업적 확인
      checkAndAwardAchievements(user.id, { xp: profile?.xp, streak: profile?.streak_count, firstPost: true }).then(newBadges => {
        newBadges.forEach(b => celebrate({ type: 'achievement', icon: b.icon, name: b.name, desc: b.desc }));
      });
    },
    onError: (err) => toast('글 작성 실패: ' + err.message, 'error'),
  });

  const commentMutation = useMutation({
    mutationFn: async ({ postId, content }) => {
      const { error } = await supabase.from('forum_comments').insert([{ post_id: postId, author_id: user.id, content }]);
      if (error) throw error;

      const actorName = profile?.display_name || '누군가';
      const notifs = [];

      // 게시글 작성자에게 댓글 알림 (본인 제외)
      const post = allPosts.find(p => p.id === postId);
      if (post?.author_id && post.author_id !== user.id) {
        notifs.push({
          user_id: post.author_id,
          type: 'comment',
          actor_id: user.id,
          post_id: postId,
          message: `${actorName}님이 회원님의 글에 댓글을 달았습니다.`,
        });
      }

      // @멘션된 유저에게 알림
      const mentions = [...content.matchAll(/@(\S+)/g)].map(m => m[1]);
      for (const name of mentions) {
        const { data: mentioned } = await supabase
          .from('profiles').select('id').eq('display_name', name).maybeSingle();
        if (mentioned && mentioned.id !== user.id) {
          notifs.push({
            user_id: mentioned.id,
            type: 'mention',
            actor_id: user.id,
            post_id: postId,
            message: `${actorName}님이 댓글에서 회원님을 태그했습니다.`,
          });
        }
      }

      if (notifs.length > 0) {
        await supabase.from('notifications').insert(notifs);
      }
    },
    onSuccess: (_, { postId }) => {
      queryClient.invalidateQueries({ queryKey: ['forum-comments', postId] });
      setCommentText('');
      setAllPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p
      ));
      toast('댓글을 달았습니다.', 'success');
    },
    onError: (err) => toast('댓글 등록 실패: ' + err.message, 'error'),
  });

  const likeMutation = useMutation({
    mutationFn: async ({ postId, liked }) => {
      const fn = liked ? 'remove_post_like' : 'add_post_like';
      const { error } = await supabase.rpc(fn, { p_post_id: postId, p_user_id: user.id });
      if (error) throw error;
    },
    onMutate: async ({ postId, liked }) => {
      setAllPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, likes_count: liked ? Math.max(0, (p.likes_count || 0) - 1) : (p.likes_count || 0) + 1, user_liked: !liked }
          : p
      ));
    },
    onError: (err, { postId, liked }) => {
      setAllPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, likes_count: liked ? (p.likes_count || 0) + 1 : Math.max(0, (p.likes_count || 0) - 1), user_liked: liked }
          : p
      ));
      toast('좋아요 실패: ' + err.message, 'error');
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId) => {
      const { error } = await supabase.from('forum_posts').delete().eq('id', postId);
      if (error) throw error;
    },
    onSuccess: (_, postId) => {
      setAllPosts(prev => prev.filter(p => p.id !== postId));
      if (expandedPostId === postId) setExpandedPostId(null);
      toast('게시글을 삭제했습니다.', 'success');
    },
    onError: (err) => toast('삭제 실패: ' + err.message, 'error'),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async ({ commentId, postId }) => {
      const { error } = await supabase.from('forum_comments').delete().eq('id', commentId);
      if (error) throw error;
      return postId;
    },
    onSuccess: (postId) => {
      queryClient.invalidateQueries({ queryKey: ['forum-comments', postId] });
      setAllPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, comments_count: Math.max(0, (p.comments_count || 1) - 1) } : p
      ));
      toast('댓글을 삭제했습니다.', 'success');
    },
    onError: (err) => toast('삭제 실패: ' + err.message, 'error'),
  });

  const commentLikeMutation = useMutation({
    mutationFn: async ({ commentId, liked }) => {
      const fn = liked ? 'remove_comment_like' : 'add_comment_like';
      const { error } = await supabase.rpc(fn, { p_comment_id: commentId, p_user_id: user.id });
      if (error) throw error;
    },
    onMutate: async ({ commentId, liked }) => {
      queryClient.setQueryData(['forum-comments', expandedPostId, user?.id], (old = []) =>
        old.map(c =>
          c.id === commentId
            ? { ...c, likes_count: liked ? Math.max(0, (c.likes_count || 0) - 1) : (c.likes_count || 0) + 1, user_liked: !liked }
            : c
        )
      );
    },
    onError: (err, { commentId, liked }) => {
      queryClient.setQueryData(['forum-comments', expandedPostId, user?.id], (old = []) =>
        old.map(c =>
          c.id === commentId
            ? { ...c, likes_count: liked ? (c.likes_count || 0) + 1 : Math.max(0, (c.likes_count || 0) - 1), user_liked: liked }
            : c
        )
      );
      toast('좋아요 실패: ' + err.message, 'error');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!user) { toast('로그인이 필요합니다.', 'warning'); return; }
    if (!newPost.trim()) return;
    const content = postCategory ? `${postCategory} ${newPost.trim()}` : newPost.trim();
    postMutation.mutate(content);
  };

  const handleCommentSubmit = (postId) => {
    if (!user) { toast('로그인이 필요합니다.', 'warning'); return; }
    if (!commentText.trim()) return;
    commentMutation.mutate({ postId, content: commentText.trim() });
  };

  const handleCommentChange = (e) => {
    const val = e.target.value;
    setCommentText(val);
    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    const atIdx = textBeforeCursor.lastIndexOf('@');
    if (atIdx !== -1) {
      const query = textBeforeCursor.slice(atIdx + 1);
      if (!query.includes(' ') && !query.includes('\n')) {
        setMentionQuery(query);
        setMentionAnchor(atIdx);
        return;
      }
    }
    setMentionQuery(null);
  };

  const insertMention = (displayName) => {
    const before = commentText.slice(0, mentionAnchor);
    const after = commentText.slice(mentionAnchor + 1 + (mentionQuery?.length || 0));
    setCommentText(before + '@' + displayName + ' ' + after);
    setMentionQuery(null);
    commentInputRef.current?.focus();
  };

  const handleReply = (displayName) => {
    setCommentText(`@${displayName} `);
    setMentionQuery(null);
    setTimeout(() => commentInputRef.current?.focus(), 0);
  };

  const togglePost = (postId) => {
    setExpandedPostId(prev => prev === postId ? null : postId);
    setCommentText('');
    setMentionQuery(null);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-header__title">💬 커뮤니티 포럼</h1>
        <p className="page-header__subtitle">다른 학습자들과 소통하며 함께 공부하세요</p>
      </div>

      <div className="forum-wrap">
        <div className="card forum-post-input">
          <form onSubmit={handleSubmit}>
            <div className="forum-compose">
              <div className="forum-avatar forum-avatar--gradient">
                {user?.user_metadata?.display_name?.[0] || '✏️'}
              </div>
              <div className="forum-compose__body">
                <textarea
                  id="new-post"
                  name="new-post"
                  value={newPost}
                  onChange={e => setNewPost(e.target.value)}
                  placeholder="오늘 어떤 공부를 하셨나요? 자유롭게 남겨보세요."
                  className="forum-textarea"
                />
                <div className="forum-compose__footer">
                  <div className="forum-category-pills">
                    {CATEGORIES.map(c => (
                      <button key={c.value} type="button"
                        className={`forum-category-pill ${postCategory === c.value ? 'forum-category-pill--active' : ''}`}
                        onClick={() => setPostCategory(postCategory === c.value ? '' : c.value)}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                  <Button type="submit" size="sm" disabled={postMutation.isPending || !newPost.trim()}
                    style={{ borderRadius: 'var(--radius-full)' }}>
                    {postMutation.isPending ? '게시 중...' : '게시하기'}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>

        {isLoading && page === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[1,2,3].map(i => (
              <div key={i} className="skeleton--card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton-line" style={{ width: '30%', height: 14, marginBottom: 10 }} />
                    <div className="skeleton-line" style={{ width: '90%', marginBottom: 8 }} />
                    <div className="skeleton-line" style={{ width: '60%' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="forum-list">
            {allPosts.map(post => {
              const authorName = post.author?.display_name || '익명';
              const authorInitial = authorName[0]?.toUpperCase() || '?';
              const categoryMatch = post.content?.match(/^\[(질문|팁|자료|인증)\]\s?/);
              const categoryTag = categoryMatch ? categoryMatch[0].trim() : null;
              const postContent = categoryTag ? post.content.slice(categoryMatch[0].length) : post.content;
              return (
              <div key={post.id} className="card forum-post">
                <div className="forum-compose">
                  <div className="forum-avatar forum-avatar--initial">{authorInitial}</div>
                  <div className="forum-post__body">
                    <div className="forum-post__meta">
                      <span className="forum-post__name">{authorName}</span>
                      {categoryTag && <span className="forum-post__tag">{categoryTag}</span>}
                      {post.author?.streak_count > 0 && (
                        <span className="forum-post__streak">🔥 {post.author.streak_count}</span>
                      )}
                      <span className="forum-post__date">{timeAgo(post.created_at)}</span>
                    </div>
                    <p className="forum-post__content">{renderWithMentions(postContent)}</p>
                    <div className="forum-post__actions">
                      <button
                        className={`forum-action-btn ${post.user_liked ? 'forum-action-btn--liked' : ''}`}
                        onClick={() => {
                          if (!user) { toast('로그인이 필요합니다.', 'warning'); return; }
                          likeMutation.mutate({ postId: post.id, liked: !!post.user_liked });
                        }}
                        title={user ? (post.user_liked ? '좋아요 취소' : '좋아요') : '로그인 후 좋아요를 누를 수 있어요'}
                      >
                        <span>{post.user_liked ? '❤️' : '🤍'}</span> {post.likes_count || 0}
                      </button>
                      <button
                        onClick={() => togglePost(post.id)}
                        className={`forum-action-btn ${expandedPostId === post.id ? 'forum-action-btn--active' : ''}`}
                      >
                        <span>💬</span> 댓글 {post.comments_count || 0}
                      </button>
                      {post.author_id === user?.id && (
                        <button
                          className="forum-action-btn forum-action-btn--danger"
                          disabled={deletePostMutation.isPending}
                          onClick={() => setConfirmAction({
                            message: '게시글을 삭제하시겠습니까?',
                            onConfirm: () => { deletePostMutation.mutate(post.id); setConfirmAction(null); },
                          })}
                        >
                          🗑️ 삭제
                        </button>
                      )}
                    </div>

                    {expandedPostId === post.id && (
                      <div className="forum-comments">
                        <div className="forum-comment-input" style={{ position: 'relative' }}>
                          <input
                            ref={commentInputRef}
                            id={`comment-input-${post.id}`}
                            name="comment"
                            type="text"
                            value={commentText}
                            onChange={handleCommentChange}
                            onKeyDown={e => {
                              if (e.key === 'Escape') { setMentionQuery(null); return; }
                              if (e.key === 'Enter' && mentionQuery === null) handleCommentSubmit(post.id);
                            }}
                            placeholder="댓글 달기... (@닉네임으로 태그)"
                            className="form-input"
                            style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                          />
                          {mentionQuery !== null && filteredMentions.length > 0 && (
                            <div className="forum-mention-dropdown">
                              {filteredMentions.map(name => (
                                <button
                                  key={name}
                                  className="forum-mention-item"
                                  onMouseDown={e => { e.preventDefault(); insertMention(name); }}
                                >
                                  @{name}
                                </button>
                              ))}
                            </div>
                          )}
                          <Button size="sm" onClick={() => handleCommentSubmit(post.id)}>게시</Button>
                        </div>

                        <div className="forum-comment-list">
                          {commentsLoading ? (
                            <p className="forum-empty-msg">전달받는 중...</p>
                          ) : commentsError ? (
                            <p className="forum-empty-msg" style={{ color: 'var(--danger)' }}>
                              ❌ 댓글 로드 오류: {commentsError.message}
                            </p>
                          ) : comments.length > 0 ? comments.map(c => (
                            <div key={c.id} className="forum-comment">
                              <div className="forum-comment__avatar">{c.author?.display_name?.[0]?.toUpperCase() || '?'}</div>
                              <div className="forum-comment__body">
                                <div className="forum-comment__text">
                                  <span className="forum-comment__name">{c.author?.display_name || '익명'}</span>
                                  {' '}{renderWithMentions(c.content)}
                                </div>
                                <div className="forum-comment__actions">
                                  <span className="forum-comment__time">{timeAgo(c.created_at)}</span>
                                  {c.author?.display_name && (
                                    <button
                                      className="forum-reply-btn"
                                      onClick={() => handleReply(c.author.display_name)}
                                    >
                                      답글 달기
                                    </button>
                                  )}
                                  {c.author_id === user?.id && (
                                    <button
                                      className="forum-reply-btn"
                                      style={{ color: 'var(--danger)' }}
                                      disabled={deleteCommentMutation.isPending}
                                      onClick={() => deleteCommentMutation.mutate({ commentId: c.id, postId: post.id })}
                                    >
                                      삭제
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="forum-comment-like">
                                <button
                                  className={`forum-comment-like__btn ${c.user_liked ? 'forum-comment-like__btn--liked' : ''}`}
                                  onClick={() => {
                                    if (!user) { toast('로그인이 필요합니다.', 'warning'); return; }
                                    commentLikeMutation.mutate({ commentId: c.id, liked: !!c.user_liked });
                                  }}
                                >
                                  {c.user_liked ? '❤️' : '🤍'}
                                </button>
                                {(c.likes_count || 0) > 0 && (
                                  <span className="forum-comment-like__count">{c.likes_count}</span>
                                )}
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
              );
            })}

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
                <div className="empty-state__icon">💬</div>
                <p className="empty-state__msg">아직 게시글이 없어요</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                  학습 중 궁금한 점이나 팁을 공유해보세요!
                </p>
                {user && (
                  <button onClick={() => {
                    const el = document.getElementById('new-post');
                    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => el.focus(), 300); }
                  }} className="btn btn--primary btn--md">
                    ✏️ 첫 글 작성하기
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <ConfirmModal
        open={!!confirmAction}
        message={confirmAction?.message}
        onConfirm={confirmAction?.onConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
