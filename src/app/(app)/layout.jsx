import { Noto_Serif_KR, Manrope } from 'next/font/google';
import Layout from '@/components/Layout';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });

const notoSerifKr = Noto_Serif_KR({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-serif-kr',
  display: 'swap',
  // 라틴 조각은 (app) 전체에서 미리 받지 않는다 — 세리프 KR을 첫 화면에 그리는 세그먼트(배움 · 산책)만 힌트를 건다(fontHints.js).
  // (app) preload는 세리프를 그리지 않는 화면에서도 34kB를 받았다(FIELD-AUDIT 2026-10-23 KST — 운영 · 로컬 빌드 실측).
  preload: false,
});

export default function AppLayout({ children }) {
  return (
    <div className={manrope.variable} style={{ display: 'contents' }}><div className={notoSerifKr.variable} style={{ display: 'contents' }}>
      <Layout>{children}</Layout>
    </div></div>
  );
}
