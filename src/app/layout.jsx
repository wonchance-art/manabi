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

export const metadata = {
  title: 'Anatomy Studio — AI 언어 해부 학습',
  description: 'AI가 문장을 형태소 단위로 해부하는 일본어·영어 학습 앱. FSRS 알고리즘으로 과학적 단어 복습.',
  keywords: ['일본어 학습', '영어 학습', 'AI 언어', 'JLPT', 'FSRS'],
  openGraph: {
    title: 'Anatomy Studio',
    description: 'AI가 문장을 해부하는 언어 학습 서비스',
    type: 'website',
    siteName: 'Anatomy Studio',
    locale: 'ko_KR',
  },
  twitter: {
    card: 'summary',
    title: 'Anatomy Studio',
    description: 'AI가 문장을 해부하는 언어 학습 서비스',
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
      </head>
      <body className={`${inter.variable} ${notoKr.variable} ${notoJp.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
