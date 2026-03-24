export default function ForumPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-header__title">💬 커뮤니티 포럼</h1>
        <p className="page-header__subtitle">학습 성과를 공유하고 함께 성장하세요</p>
      </div>

      <div style={{ maxWidth: '640px' }}>
        {/* Mock post input */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--primary), var(--accent))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem', flexShrink: 0
            }}>
              ✏️
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
                padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.9rem',
                cursor: 'pointer'
              }}>
                오늘 배운 단어나 학습 소감을 공유해보세요...
              </div>
            </div>
          </div>
        </div>

        {/* Mock timeline posts */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: 'var(--bg-elevated)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0
            }}>
              🔥
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>
                학습봇 <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8rem' }}>· 방금 전</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                🎉 포럼 기능이 곧 오픈됩니다! Sprint 5에서 글 작성, 좋아요, 댓글 기능이 추가될 예정입니다.
              </p>
              <div style={{ marginTop: '12px', display: 'flex', gap: '16px' }}>
                <button style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>❤️ 좋아요</button>
                <button style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>💬 댓글</button>
                <button style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>🔗 공유</button>
              </div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          <span className="badge badge--coming-soon">🚧 Sprint 5에서 정식 오픈</span>
        </div>
      </div>
    </div>
  );
}
