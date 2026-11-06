import GroupsPage from '@/views/GroupsPage';
import { PRIVATE_ROBOTS } from '@/lib/seo';

export const metadata = {
  title: '함께 읽기',
  description: '같은 자료를 함께 읽는 소그룹 — 주간 기록을 합계로 나란히 봐요.',
  robots: PRIVATE_ROBOTS,
};

export default function Page() {
  return <GroupsPage />;
}
