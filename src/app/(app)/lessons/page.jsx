import LessonsPage from '@/views/LessonsPage';
import { buildRefManifest } from '@/content/refManifest';

export const metadata = {
  title: '강의 | Anatomy Studio',
  description: '단계별 패턴·표현 강의와 문법·어휘 레퍼런스. JLPT N5→N1, CEFR A1→C2, 프랑스어 A0→C2.',
};

export default function Page() {
  return <LessonsPage refManifest={buildRefManifest()} />;
}
