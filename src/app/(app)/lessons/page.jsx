import LessonsPage from '@/views/LessonsPage';
import { buildRefManifest } from '@/content/refManifest';
import { applyManifestOverrides } from '@/lib/contentOverrides';

export const metadata = {
  title: '교재',
  description: '학습 순서대로 배치된 문법·어휘 레퍼런스. JLPT N5→N1, CEFR A1→C2, 프랑스어 A0→C2.',
};

// searchParams를 await하므로 이 라우트는 **dynamic SSR**이다(빌드 산출: `ƒ /lessons`).
// 여기 있던 `export const revalidate = 60`은 그래서 **아무 효과가 없었다** — 실측한 응답
// 헤더는 `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`다.
// 효과 없는 그 한 줄이 "비로그인 옛 버전" 조사를 CDN 캐시 오진으로 이끌었기에 지운다
// (판정 기록 #1077). 캐시가 필요해지면 라우트를 정적으로 바꾼 뒤 다시 논한다.

export default async function Page({ searchParams }) {
  const sp = await searchParams;
  const refManifest = await applyManifestOverrides(buildRefManifest());
  return <LessonsPage refManifest={refManifest} initialLang={sp?.lang} initialLevel={sp?.level} />;
}
