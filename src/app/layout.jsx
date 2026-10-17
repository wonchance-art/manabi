import { Inter, Noto_Sans, Noto_Sans_KR, Noto_Sans_JP, Noto_Sans_SC } from 'next/font/google';
import '../index.css';
import Providers from './providers';

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
});

// 중국어 본문 — 간체 표준 자형(오너 확정 2026-08-19, 폰트 시연장 비교 후 선택).
// 이전엔 중국어 전용 폰트가 없어 KR/JP 폰트의 자형(間·直·骨 등이 비대륙형)으로 렌더됐다.
const notoSc = Noto_Sans_SC({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sc',
  display: 'swap',
});

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
        <meta name="theme-color" content="#994A5A" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="manabi" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        {/* Supabase 연결을 HTML을 읽는 동안 미리 연다(VIEWER-FIRST-TOKEN-001). 첫 조회(뷰어 자료 등)가 CORS 사전 요청 앞에서 TCP·TLS를
            새로 맺느라 389ms를 썼다(운영 /viewer/45 실측, 2026-10-17 KST). supabase-js는 자격 증명 없이 보내므로 crossOrigin="anonymous"여야
            그 연결을 다시 쓴다. */}
        {SUPABASE_ORIGIN && <link rel="preconnect" href={SUPABASE_ORIGIN} crossOrigin="anonymous" />}
        {/* 테마 깜빡임 방지 + SW 등록 */}
        <script
          dangerouslySetInnerHTML={{
            /* SW는 프로덕션에서만 등록 — dev에서는 옛 번들 캐시 서빙으로 Fast Refresh·검수를 깨뜨려
               기존 등록까지 적극 해제한다(스테일 번들 사고 2회 재발 방지, 2026-07-22). */
            __html: `(function(){var t=localStorage.getItem('theme')||'dark';document.documentElement.setAttribute('data-theme',t);${
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
      <body className={`${inter.variable} ${notoKr.variable} ${notoJp.variable} ${notoSc.variable} ${notoSans.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
