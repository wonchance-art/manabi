import LandingPage from '@/views/LandingPage';

export const metadata = {
  title: 'Anatomy Studio — AI로 언어를 해부하다',
  description: 'AI가 문장을 형태소 단위로 해부. 일본어·영어 원문을 붙여넣으면 후리가나·뜻·품사를 즉시 분석. FSRS 알고리즘으로 과학적 단어 복습.',
};

export default function Page() {
  return <LandingPage />;
}
