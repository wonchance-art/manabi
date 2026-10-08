import ClassCourseTestPage from '@/views/ClassCourseTestPage';

export const metadata = {
  title: '수업 테스트',
  description: '코스 전체 예문에서 10문제 — 한국어 문장을 일본어로 말해 보는 시험과 연습.',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ClassCourseTestPage />;
}
