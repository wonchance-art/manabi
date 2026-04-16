import Link from 'next/link';

export const metadata = {
  title: '페이지를 찾을 수 없어요 · Anatomy Studio',
};

export default function NotFound() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '70vh', padding: '40px 24px',
      color: 'var(--text-primary)', textAlign: 'center',
    }}>
      <div style={{ fontSize: '5rem', marginBottom: 12 }}>🔭</div>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 8px' }}>404</h1>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 10px', color: 'var(--text-secondary)' }}>
        길을 잃으셨군요
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 28, maxWidth: 360, lineHeight: 1.6 }}>
        주소가 잘못됐거나, 삭제된 페이지일 수 있어요. 아래로 돌아가서 계속 학습해보세요.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/home" className="btn btn--primary btn--md">🏠 홈으로</Link>
        <Link href="/materials" className="btn btn--ghost btn--md">📚 자료실</Link>
        <Link href="/vocab" className="btn btn--ghost btn--md">📖 단어장</Link>
      </div>
    </div>
  );
}
