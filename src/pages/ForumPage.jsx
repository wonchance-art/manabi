import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

export default function ForumPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, []);

  async function fetchPosts() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('forum_posts')
        .select(`
          *,
          author:profiles(display_name, avatar_url, streak_count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (err) {
      console.error("포스트 로드 실패:", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!user) return alert("로그인이 필요합니다.");
    if (!newPost.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('forum_posts')
        .insert([{
          author_id: user.id,
          content: newPost.trim()
        }]);

      if (error) throw error;
      setNewPost('');
      fetchPosts(); // Refresh
    } catch (err) {
      alert("글 작성 실패: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-header__title">💬 커뮤니티 포럼</h1>
        <p className="page-header__subtitle">다른 학습자들과 소통하며 함께 공부하세요</p>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        {/* Post Input */}
        <div className="card" style={{ marginBottom: '24px', padding: '20px' }}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.1rem', flexShrink: 0, color: 'white'
              }}>
                {user?.display_name?.[0] || '✏️'}
              </div>
              <div style={{ flex: 1 }}>
                <textarea
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="오늘 어떤 공부를 하셨나요? 자유롭게 남겨보세요."
                  style={{
                    width: '100%', minHeight: '80px', background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                    padding: '12px', color: 'var(--text-primary)', outline: 'none',
                    resize: 'none', fontSize: '0.95rem'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button
                    type="submit"
                    disabled={isSubmitting || !newPost.trim()}
                    style={{
                      background: 'var(--primary)', color: 'white', border: 'none',
                      padding: '8px 20px', borderRadius: 'var(--radius-full)',
                      fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
                      opacity: (isSubmitting || !newPost.trim()) ? 0.6 : 1
                    }}
                  >
                    {isSubmitting ? '게시 중...' : '게시하기'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Timeline */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>⏳ 이야기를 불러오는 중...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {posts.map(post => (
              <div key={post.id} className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%',
                    background: 'var(--bg-elevated)', border: '2px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1rem', flexShrink: 0
                  }}>
                    👤
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{post.author?.display_name || '익명 사용자'}</span>
                      {post.author?.streak_count > 0 && (
                        <span style={{ fontSize: '0.75rem', color: '#ff922b', fontWeight: 600 }}>🔥 {post.author.streak_count}</span>
                      )}
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>· {new Date(post.created_at).toLocaleDateString()}</span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {post.content}
                    </p>
                    <div style={{ marginTop: '14px', display: 'flex', gap: '20px' }}>
                      <button 
                        onClick={() => {
                          const updatedPosts = posts.map(p => 
                            p.id === post.id ? { ...p, likes_count: (p.likes_count || 0) + 1 } : p
                          );
                          setPosts(updatedPosts);
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <span style={{ fontSize: '1rem' }}>❤️</span> {post.likes_count || 0}
                      </button>
                      <button 
                        onClick={() => alert("댓글 기능은 준비 중입니다! 포럼 업데이트를 기다려주세요.")}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <span>💬</span> 댓글 {post.comments_count || 0}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
