import '../index.css';
import Providers from './providers';

export const metadata = {
  title: 'Anatomy Studio — AI 언어 해부 학습',
  description: 'AI가 문장을 형태소 단위로 해부하는 일본어·영어 학습 앱. FSRS 알고리즘으로 과학적 단어 복습.',
  keywords: ['일본어 학습', '영어 학습', 'AI 언어', 'JLPT', 'FSRS'],
  openGraph: {
    title: 'Anatomy Studio',
    description: 'AI가 문장을 해부하는 언어 학습 서비스',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#7C5CFC" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        {/* 테마 깜빡임 방지 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme')||'dark';document.documentElement.setAttribute('data-theme',t);})();`,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
