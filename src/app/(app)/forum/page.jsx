import ForumPage from '@/views/ForumPage';

export const metadata = {
  title: '커뮤니티 | Anatomy Studio',
  description: '학습자들과 함께 공부하는 커뮤니티 포럼',
  openGraph: { title: '커뮤니티 | Anatomy Studio', description: '다른 학습자들과 소통하며 함께 공부하세요' },
};

export default function Page() {
  return <ForumPage />;
}
