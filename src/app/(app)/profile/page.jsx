import MyPage from '@/views/MyPage';
import { buildRefManifest } from '@/content/refManifest';

export const metadata = {
  title: '마이페이지 | Anatomy Studio',
};

export default function Page() {
  return <MyPage refManifest={buildRefManifest()} />;
}
