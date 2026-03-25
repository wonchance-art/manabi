import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh', padding: '40px 24px',
      background: 'var(--bg-primary)', color: 'var(--text-primary)', textAlign: 'center',
    }}>
      <div style={{ fontSize: '5rem', marginBottom: '16px' }}>🔭</div>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px' }}>404</h1>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)' }}>
        페이지를 찾을 수 없습니다
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
        존재하지 않거나 삭제된 페이지입니다.
      </p>
      <Link href="/" className="btn btn--primary btn--md">홈으로 돌아가기</Link>
    </div>
  );
}
