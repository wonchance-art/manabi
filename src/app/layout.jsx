import { Inter, Noto_Sans, Noto_Sans_KR, Noto_Sans_JP, Noto_Sans_SC } from 'next/font/google';
import '../index.css';
import Providers from './providers';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
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

// 병음 전용 라틴 — 성조 부호(ā á ǎ à…) 전 범위 보장, SC와 같은 계열(오너 확정).
const notoSans = Noto_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sans',
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Anatomy Studio — AI 언어 해부 학습',
    template: '%s · Anatomy Studio',
  },
  description: '일본어·영어·프랑스어·중국어 학습 도구 — 문법 교재, 매일 조립되는 학습 세션, FSRS 복습, 형태소 해부 읽기.',
  keywords: ['일본어 학습', '영어 학습', 'AI 언어', 'JLPT', 'FSRS', '간격 반복', '단어장', '독해'],
  authors: [{ name: 'Anatomy Studio' }],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Anatomy Studio — AI 언어 해부 학습',
    description: '일본어·영어 원문을 AI로 해부하고, FSRS로 과학적으로 복습하세요.',
    url: SITE_URL,
    type: 'website',
    siteName: 'Anatomy Studio',
    locale: 'ko_KR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Anatomy Studio — AI 언어 해부 학습',
    description: '일본어·영어 원문을 AI로 해부하고, FSRS로 과학적으로 복습하세요.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#7C5CFC" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Anatomy Studio" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <link rel="manifest" href="/manifest.webmanifest" />
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
