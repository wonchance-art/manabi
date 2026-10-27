// 영어 단어 페이지(오너 2026-10-26 KST — 몇 단어로 먼저 연다) — 레퍼런스 어휘(/english/vocab)는 그대로 두고 새 화면을 옆 주소에 둔다.
import { notFound } from 'next/navigation';
import LatinWordPage from '@/views/LatinWordPage';
import { latinSampleGroups } from '@/lib/latinLevelWords';
import a1 from '@/content/english/vocab/a1';
import notes from '@/content/english/wordNotes';

const NAME = '영어';
// 인사 · 가족 · 기초 동사 · 기초 형용사에서 두 단어씩 — 합성어(welcome) · 불규칙 동사(be · go) · 비교급(good · bad)이 한 번씩 보이게 고른다.
const LEVELS = { A1: () => latinSampleGroups(a1, { lang: 'en', picks: [[0, ['hello', 'welcome']], [2, 2], [4, ['be', 'go']], [5, 2]], notes }) };

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
  return <LatinWordPage lang="english" levelKey={key} groups={groups} />;
}
