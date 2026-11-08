import Link from 'next/link';
import { MAIN_NAV } from '@/lib/webNavigation';
// (app) 레이아웃 밖이라 셸 CSS가 따라오지 않는다 — Layout과 같은 순서로 직접 불러온다.
import '@/components/books/reading-shell.css';
import '@/components/web/web-shell.css';

// 검색 메타(LAUNCH-META-001): 404 응답에는 Next가 `<meta name="robots" content="noindex">`를 직접 단다(app-render NonIndex).
// 루트의 index, follow를 물려받으면 두 robots 줄이 서로 어긋났다(운영 실측 2026-11-06 KST) — 여기서는 robots를 비워 Next의 noindex 한 줄만 남긴다.
// 정본 주소도 두지 않는다(없는 주소의 정본은 없다 — 루트도 이제 정본을 물려주지 않는다).
export const metadata = {
  title: '페이지를 찾을 수 없어요',
  robots: null,
};

// 루트 404는 (app) 레이아웃 밖이라 v2 셸 토큰을 직접 입는다(COLOR-V2-UNIFY-001).
// 돌아갈 곳은 메인 메뉴(MAIN_NAV)에서 그대로 가져온다 — 메뉴 이름이 바뀌어도 404만 옛 이름(자료실 · 단어장)으로
// 남지 않게(2026-10-16 실측).
export default function NotFound() {
  return (
    // 본문은 <main> 랜드마크(A11Y-LAUNCH-001 — axe landmark-one-main · region). main은 div와 같은 블록이라 화면은 그대로다.
    <div className="manabi-app"><main style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '70vh', padding: '40px 24px',
      color: 'var(--text-primary)', textAlign: 'center',
    }}>
      {/* 화면 문구 표준 §1 — HTTP 번호(404)를 화면에 쓰지 않는다. 제목은 탭 제목과 같은 말(오너 승인 2026-11-07 KST, 목업 CrsGiHf5bS4tmQk3n2HVBx ③-2). */}
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 8px' }}>페이지를 찾을 수 없어요</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 28, maxWidth: 360, lineHeight: 1.6 }}>
        주소가 바뀌었거나 지워진 페이지예요. 아래에서 다시 시작해 주세요.
      </p>
      <nav aria-label="돌아갈 곳" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {MAIN_NAV.map((item, index) => (
          <Link key={item.href} href={item.href} prefetch={item.prefetch}
            className={`btn ${index === 0 ? 'btn--primary' : 'btn--ghost'} btn--md`}>{item.label}</Link>
        ))}
      </nav>
    </main></div>
  );
}
