// 영어 단어 페이지(오너 2026-10-26 KST — 몇 단어로 먼저 연다) — 레퍼런스 어휘(/english/vocab)는 그대로 두고 새 화면을 옆 주소에 둔다.
// 항목은 조각 밖 정적 묶음(/api/level-words/english/{레벨}) — HSK · JLPT 단어 화면(levelListRoute)과 같은 길. 조립은 src/lib/latinWordsData.js.
import { notFound } from 'next/navigation';
import LatinWordPage from '@/views/LatinWordPage';
import LevelWordsPreload from '@/components/levels/LevelWordsPreload';
import { LATIN_WORD_LEVELS } from '@/lib/latinLevelWords';
import { levelWordsUrl } from '@/lib/levelWordsPayload';

const NAME = '영어';
const levelOf = (level) => {
  const key = String(level || '').toUpperCase();
  return LATIN_WORD_LEVELS.english.includes(key) ? key : null;
};

export const dynamicParams = false;
export function generateStaticParams() {
  return LATIN_WORD_LEVELS.english.map((key) => ({ level: key.toLowerCase() }));
}

export async function generateMetadata({ params }) {
  const key = levelOf((await params).level);
  if (!key) return {};
  // 몇 단어로 먼저 연 화면이라 검색에 싣지 않는다.
  return { title: `${key} 단어 | ${NAME}`, robots: { index: false, follow: false } };
}

export default async function Page({ params }) {
  const key = levelOf((await params).level);
  if (!key) notFound();
  const wordsUrl = levelWordsUrl('english', key);
  return <><LevelWordsPreload href={wordsUrl} />
    <LatinWordPage lang="english" levelKey={key} wordsUrl={wordsUrl} /></>;
}
