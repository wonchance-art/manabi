// 영어 단어 페이지(오너 2026-10-26 KST — 몇 단어로 먼저 연다) — 레퍼런스 어휘(/english/vocab)는 그대로 두고 새 화면을 옆 주소에 둔다.
import { notFound } from 'next/navigation';
import LatinWordPage from '@/views/LatinWordPage';
import { latinSampleGroups } from '@/lib/latinLevelWords';
import a1 from '@/content/english/vocab/a1';
import notes from '@/content/english/wordNotes';
import { ENGLISH_A1_PICKS } from '@/content/english/wordDeckA1';

const NAME = '영어';
// 기존 A1 목록에서 보존할 8개를 포함한 1차 후보. 원본 등급·언어 검수 후 추가한다.
const LEVELS = { A1: () => latinSampleGroups(a1, { lang: 'en', picks: ENGLISH_A1_PICKS, notes }) };

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
