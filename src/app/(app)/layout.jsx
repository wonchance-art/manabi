import { Noto_Serif_KR } from 'next/font/google';
import Layout from '@/components/Layout';

const notoSerifKr = Noto_Serif_KR({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-serif-kr',
  display: 'swap',
});

export default function AppLayout({ children }) {
  return (
    <div className={notoSerifKr.variable} style={{ display: 'contents' }}>
      <Layout>{children}</Layout>
    </div>
  );
}
