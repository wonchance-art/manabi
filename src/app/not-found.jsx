import Link from 'next/link';
// (app) 레이아웃 밖이라 셸 CSS가 따라오지 않는다 — Layout과 같은 순서로 직접 불러온다.
import '@/components/books/reading-shell.css';
import '@/components/web/web-shell.css';

export const metadata = {
  title: '페이지를 찾을 수 없어요',
};

// 루트 404는 (app) 레이아웃 밖이라 v2 셸 토큰을 직접 입는다(COLOR-V2-UNIFY-001).
export default function NotFound() {
  return (
    <div className="manabi-app"><div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '70vh', padding: '40px 24px',
      color: 'var(--text-primary)', textAlign: 'center',
    }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 8px' }}>404</h1>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 10px', color: 'var(--text-secondary)' }}>
        길을 잃으셨군요
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 28, maxWidth: 360, lineHeight: 1.6 }}>
        주소가 잘못됐거나, 삭제된 페이지일 수 있어요. 아래로 돌아가서 계속 학습해보세요.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/home" className="btn btn--primary btn--md">홈으로</Link>
        <Link href="/materials" className="btn btn--ghost btn--md">자료실</Link>
        <Link href="/vocab" className="btn btn--ghost btn--md">단어장</Link>
      </div>
    </div></div>
  );
}
