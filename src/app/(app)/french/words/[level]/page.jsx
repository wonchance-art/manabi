// 프랑스어 단어 페이지(오너 2026-10-26 KST — 몇 단어로 먼저 연다) — 레퍼런스 어휘(/french/vocab)는 그대로 두고 새 화면을 옆 주소에 둔다.
import { notFound } from 'next/navigation';
import LatinWordPage from '@/views/LatinWordPage';
import { latinSampleGroups } from '@/lib/latinLevelWords';
import a1 from '@/content/french/vocab/a1';

const NAME = '프랑스어';
// 테마 순번 — 가족 · 일상 필수 동사 · 음식 · 기초 형용사, 테마마다 앞 두 단어.
const LEVELS = { A1: () => latinSampleGroups(a1, { themes: [0, 1, 2, 5], per: 2 }) };

export const dynamicParams = false;
export function generateStaticParams() {
  return Object.keys(LEVELS).map((key) => ({ level: key.toLowerCase() }));
}

export async function generateMetadata({ params }) {
  const { level } = await params;
  const key = String(level || '').toUpperCase();
  if (!LEVELS[key]) return {};
  const title = `${key} 단어 | ${NAME}`;
  // 몇 단어로 먼저 연 화면이라 검색에 싣지 않는다.
  return { title, robots: { index: false, follow: false } };
}

export default async function Page({ params }) {
  const { level } = await params;
  const key = String(level || '').toUpperCase();
  const groups = LEVELS[key]?.();
  if (!groups) notFound();
  return <LatinWordPage lang="french" levelKey={key} groups={groups} />;
}
