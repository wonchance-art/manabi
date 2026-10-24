import { Inter, Noto_Sans, Noto_Sans_KR, Noto_Sans_JP } from 'next/font/google';
import '../index.css';
import Providers from './providers';
import { INSTALL_CAPTURE_SCRIPT } from '@/lib/installPrompt';

// Inter는 미리 받지 않는다(FONT-PRELOAD-001): 앱 화면(.manabi-app)은 Noto Sans KR · Manrope가 먼저라 Inter 라틴 조각(47kB)이
// 모든 페이지에서 미리 받아지고 쓰이지 않았다(Preview b8fc2b62 실측 2026-10-17 KST — 배움 · 산책 · 교재 · 뷰어 · 로그인 · 단어 목록 ·
// /study, 390 · 1440). 미리 받기만 뺀다 — @font-face는 그대로라 쓰는 곳(한국어 뷰어 「Inter」 선택 등)은 그때 받는다.
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
  preload: false,
});

const notoKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-kr',
  display: 'swap',
});

const notoJp = Noto_Sans_JP({
  subsets: ['latin'],
  // 400: 뷰어 본문 기본 굵기 — 없으면 브라우저가 500으로 대체해 본문이 미세하게 굵었다.
  // 가변 폰트 1벌을 조각 서빙이라 weight 추가로 다운로드 파일 수는 늘지 않는다(실측).
  weight: ['400', '500', '700'],
  variable: '--font-noto-jp',
  display: 'swap',
  // 라틴 조각은 루트에서 미리 받지 않는다 — 일본어를 첫 화면에 그리는 세그먼트(배움 · 책장)만 힌트를 건다(fontHints.js).
  // 루트 preload는 일본어가 없는 화면(산책 읽기 · 지역학 · 계정 · 뷰어 · 단어장 …)에서도 24kB를 받았다(FIELD-AUDIT 2026-10-23 KST).
  preload: false,
});

// 중국어 본문(간체 Noto Sans SC — 오너 확정 2026-08-19)은 중국어를 그릴 수 있는 세그먼트만 싣는다 —
// src/components/fonts/ScFontScope.jsx(FONT-SC-SCOPE-001). 루트에 두면 모든 페이지가 SC @font-face 303개를 받았다.

// 대만 번체(Noto Sans TC)는 번체를 그리는 세그먼트(viewer · pdf · suggestions · chinese)만 싣는다 —
// src/components/fonts/TcFontScope.jsx. 루트에 두면 모든 페이지가 TC @font-face 325개를 받았다.

// 병음 전용 라틴 — 성조 부호(ā á ǎ à…) 전 범위 보장, SC와 같은 계열(오너 확정).
// 미리 받기는 그리는 세그먼트(viewer · pdf · suggestions · chinese · quick)만 건다(FONT-HINT-001, 2026-10-17 KST):
// 루트 preload는 쓰지 않는 화면까지 라틴 조각을 미리 받았다(빌드 실측: /home · /discover · /vocab 첫 진입 −36.5kB,
// 중국어 뷰어는 1회 다운로드 · 교체 시점 같거나 빠름 · 최종 픽셀 동일, 390 · 1440). 선언은 여기 한 벌뿐이다 —
// 세그먼트에서 다시 선언하면 @font-face가 두 벌 생겨 두 번 받는다. 힌트: src/components/fonts/fontHints.js.
const notoSans = Noto_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sans',
  display: 'swap',
  preload: false,
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'manabi — 언어마다, 나만의 한 권',
    template: '%s · manabi',
  },
  description: '일본어·영어·프랑스어·중국어 학습 도구 — 문법 교재, 매일 조립되는 학습 세션, FSRS 복습, 형태소 해부 읽기.',
  keywords: ['일본어 학습', '영어 학습', 'AI 언어', 'JLPT', 'FSRS', '간격 반복', '단어장', '독해'],
  authors: [{ name: 'manabi' }],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'manabi — 언어마다, 나만의 한 권',
    description: '일본어·영어·프랑스어·중국어 학습 도구 — 문법 교재, 매일 조립되는 학습 세션, FSRS 복습, 형태소 해부 읽기.',
    url: SITE_URL,
    type: 'website',
    siteName: 'manabi',
    locale: 'ko_KR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'manabi — 언어마다, 나만의 한 권',
    description: '일본어·영어·프랑스어·중국어 학습 도구 — 문법 교재, 매일 조립되는 학습 세션, FSRS 복습, 형태소 해부 읽기.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};

// 화면 가장자리까지 그린다(PWA-SHELL-001). iOS는 viewport-fit=cover가 없으면 env(safe-area-inset-*)를 0으로 돌려줘서(설치 앱 세로 화면 포함)
// 하단 메뉴 · 채점 막대 · 시트에 이미 적어 둔 홈 막대 여백 49곳이 모두 0이었다. 노치 가로 화면의 좌우는 web-shell.css가 받는다.
// 확대 상한 · 확대 금지 값은 두지 않는다 — 손가락 확대는 접근성 몫이다(두 번 탭 확대만 touch-action이 막는다).
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

// 미리 열 Supabase 출처 — 값이 없거나 주소가 아니면 힌트를 빼고 넘어간다(힌트 하나 때문에 모든 화면이 깨지지 않게).
const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin;
  } catch {
    return null;
  }
})();

export default function RootLayout({ children }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#F6F4EE" />
        {/* 표준 이름(Chrome은 apple- 접두 이름만 있으면 콘솔에 지원 종료 경고를 낸다) + iOS 옛 이름을 함께 둔다. */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {/* 휴대폰 맨 위 상태 표시줄(시각 · 배터리) — 투명 표시줄(검은 반투명 값)은 표시줄을 비워 두고 페이지를 그 밑으로 밀어 넣어
            흰 글자가 화면 머리 위에 겹쳤다. default = 표시줄이 제 칸을 갖고 페이지는 그 아래에서 시작한다(오너 지시 2026-10-19 KST). */}
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="manabi" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        {/* Supabase 연결을 HTML을 읽는 동안 미리 연다(VIEWER-FIRST-TOKEN-001). 첫 조회(뷰어 자료 등)가 CORS 사전 요청 앞에서 TCP·TLS를
            새로 맺느라 389ms를 썼다(운영 /viewer/45 실측, 2026-10-17 KST). supabase-js는 자격 증명 없이 보내므로 crossOrigin="anonymous"여야
            그 연결을 다시 쓴다. */}
        {SUPABASE_ORIGIN && <link rel="preconnect" href={SUPABASE_ORIGIN} crossOrigin="anonymous" />}
        {/* 설치 이벤트 보관(맨 앞 — 아래 localStorage가 막혀도 받는다, src/lib/installPrompt.js) + 테마 깜빡임 방지 + SW 등록 */}
        <script
          dangerouslySetInnerHTML={{
            /* SW는 프로덕션에서만 등록 — dev에서는 옛 번들 캐시 서빙으로 Fast Refresh·검수를 깨뜨려
               기존 등록까지 적극 해제한다(스테일 번들 사고 2회 재발 방지, 2026-07-22). */
            __html: `(function(){${INSTALL_CAPTURE_SCRIPT}var t=localStorage.getItem('theme')||'dark';document.documentElement.setAttribute('data-theme',t);${
              process.env.NODE_ENV === 'production'
                ? "if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js')})}"
                : "if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){r.unregister()})});if(window.caches){caches.keys().then(function(ks){ks.forEach(function(k){caches.delete(k)})})}}"
            }})();`,
          }}
        />
        {/* Plausible Analytics — NEXT_PUBLIC_PLAUSIBLE_DOMAIN 설정 시에만 로드 */}
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
          <script
            defer
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src={process.env.NEXT_PUBLIC_PLAUSIBLE_SRC || 'https://plausible.io/js/script.js'}
          />
        )}
      </head>
      <body className={`${inter.variable} ${notoKr.variable} ${notoJp.variable} ${notoSans.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
