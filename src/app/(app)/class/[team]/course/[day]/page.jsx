import ClassCourseDayPage from '@/views/ClassCourseDayPage';

export const metadata = {
  title: '수업 코스',
  description: '그날의 패턴·교재 대화·예문 연습·응용 번역 — 선생님께 받은 암호로 열어요.',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ClassCourseDayPage />;
}
