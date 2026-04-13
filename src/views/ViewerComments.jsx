import Link from 'next/link';
import Button from '../components/Button';

export default function ViewerComments({
  user, comments, commentInput, setCommentInput,
  addCommentMutation, deleteCommentMutation,
}) {
  return (
    <div className="card" style={{ marginTop: '24px', padding: '24px' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '20px', color: 'var(--text-primary)' }}>
        💬 토론 {comments.length > 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.88rem' }}>({comments.length})</span>}
      </h3>

      {comments.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
          {comments.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: '10px' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: 'var(--primary-glow)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary-light)',
              }}>
                {(c.author?.display_name || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {c.author?.display_name || '익명'}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {new Date(c.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  {c.content}
                </p>
              </div>
              {user?.id === c.user_id && (
                <button
                  onClick={() => deleteCommentMutation.mutate(c.id)}
                  disabled={deleteCommentMutation.isPending}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', flexShrink: 0, alignSelf: 'flex-start', padding: '4px' }}
                  title="삭제"
                >✕</button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '20px' }}>
          첫 번째 댓글을 남겨보세요.
        </p>
      )}

      {user ? (
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={commentInput}
            onChange={e => setCommentInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && commentInput.trim() && addCommentMutation.mutate(commentInput.trim())}
            placeholder="이 자료에 대해 이야기해보세요..."
            className="search-input"
            style={{ flex: 1 }}
            maxLength={500}
          />
          <Button
            size="sm"
            disabled={!commentInput.trim() || addCommentMutation.isPending}
            onClick={() => addCommentMutation.mutate(commentInput.trim())}
          >
            {addCommentMutation.isPending ? '...' : '등록'}
          </Button>
        </div>
      ) : (
        <Link href="/auth" className="btn btn--secondary btn--sm">
          로그인하고 댓글 남기기
        </Link>
      )}
    </div>
  );
}
