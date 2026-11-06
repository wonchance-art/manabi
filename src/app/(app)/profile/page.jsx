import MyPage from '@/views/MyPage';
import { PRIVATE_ROBOTS } from '@/lib/seo';

export const metadata = {
  title: '내 정보',
  robots: PRIVATE_ROBOTS,
};

export default function Page() {
  return <MyPage />;
}
