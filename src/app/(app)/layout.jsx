import { Noto_Serif_KR, Manrope } from 'next/font/google';
import Layout from '@/components/Layout';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });

const notoSerifKr = Noto_Serif_KR({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-serif-kr',
  display: 'swap',
});

export default function AppLayout({ children }) {
  return (
    <div className={manrope.variable} style={{ display: 'contents' }}><div className={notoSerifKr.variable} style={{ display: 'contents' }}>
      <Layout>{children}</Layout>
    </div></div>
  );
}
