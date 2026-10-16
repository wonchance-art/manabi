import Link from 'next/link';
import { MAIN_NAV } from '@/lib/webNavigation';
// (app) 레이아웃 밖이라 셸 CSS가 따라오지 않는다 — Layout과 같은 순서로 직접 불러온다.
import '@/components/books/reading-shell.css';
import '@/components/web/web-shell.css';

export const metadata = {
  title: '페이지를 찾을 수 없어요',
};

// 루트 404는 (app) 레이아웃 밖이라 v2 셸 토큰을 직접 입는다(COLOR-V2-UNIFY-001).
// 돌아갈 곳은 메인 메뉴(MAIN_NAV)에서 그대로 가져온다 — 메뉴 이름이 바뀌어도 404만 옛 이름(자료실 · 단어장)으로
// 남지 않게(2026-10-16 실측).
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
      <nav aria-label="돌아갈 곳" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {MAIN_NAV.map((item, index) => (
          <Link key={item.href} href={item.href} prefetch={item.prefetch}
            className={`btn ${index === 0 ? 'btn--primary' : 'btn--ghost'} btn--md`}>{item.label}</Link>
        ))}
      </nav>
    </div></div>
  );
}
