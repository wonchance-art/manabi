import LessonsPage from '@/views/LessonsPage';
import { buildRefManifest } from '@/content/refManifest';
import { applyManifestOverrides } from '@/lib/contentOverrides';
import { buildLearnProgressCatalog } from '@/lib/learn/homeProgressCatalog';

export const metadata = {
  title: '교재 | Anatomy Studio',
  description: '단계별 패턴·표현 강의와 문법·어휘 레퍼런스. JLPT N5→N1, CEFR A1→C2, 프랑스어 A0→C2.',
};

// searchParams를 await하는 현재 구조는 dynamic SSR이다. revalidate는 유지하지만 ISR 전환을 의미하지 않는다.
export const revalidate = 60;

export default async function Page({ searchParams }) {
  const sp = await searchParams;
  const refManifest = await applyManifestOverrides(buildRefManifest());
  return <LessonsPage refManifest={refManifest} initialLang={sp?.lang} initialLevel={sp?.level} progressCatalog={buildLearnProgressCatalog()} />;
}
