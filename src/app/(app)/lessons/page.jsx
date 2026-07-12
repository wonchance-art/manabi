import LessonsPage from '@/views/LessonsPage';
import { buildRefManifest } from '@/content/refManifest';
import { applyManifestOverrides } from '@/lib/contentOverrides';

export const metadata = {
  title: '교재 | Anatomy Studio',
  description: '단계별 패턴·표현 강의와 문법·어휘 레퍼런스. JLPT N5→N1, CEFR A1→C2, 프랑스어 A0→C2.',
};

// ISR — 목록의 챕터 제목·요약도 오버라이드를 반영. 저장 시 revalidatePath('/lessons')로 무효화.
export const revalidate = 60;

export default async function Page() {
  const refManifest = await applyManifestOverrides(buildRefManifest());
  return <LessonsPage refManifest={refManifest} />;
}
