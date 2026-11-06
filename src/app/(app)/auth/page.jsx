import AuthPage from '@/views/AuthPage';
import { PRIVATE_ROBOTS } from '@/lib/seo';

export const metadata = {
  title: '로그인',
  robots: PRIVATE_ROBOTS,
};

export default function Page() {
  return <AuthPage />;
}
