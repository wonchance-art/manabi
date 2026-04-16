import { Inter, Noto_Sans_KR, Noto_Sans_JP } from 'next/font/google';
import '../index.css';
import Providers from './providers';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const notoKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-noto-kr',
  display: 'swap',
});

const notoJp = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['300', '500', '700'],
  variable: '--font-noto-jp',
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Anatomy Studio — AI 언어 해부 학습',
    template: '%s · Anatomy Studio',
  },
  description: 'AI가 문장을 형태소 단위로 해부하는 일본어·영어 학습 앱. FSRS 알고리즘으로 과학적 단어 복습, 읽기가 곧 복습인 새로운 학습 경험.',
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
            __html: `(function(){var t=localStorage.getItem('theme')||'dark';document.documentElement.setAttribute('data-theme',t);if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js')})}})();`,
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
      <body className={`${inter.variable} ${notoKr.variable} ${notoJp.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
