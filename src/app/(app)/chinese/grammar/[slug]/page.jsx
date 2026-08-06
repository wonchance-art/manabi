import { notFound } from 'next/navigation';
import ReferenceChapterPage from '@/views/ReferenceChapterPage';
import { getGrammarStaticParams, loadChapter } from '@/content/refGrammarLoaders';
import { getChapterOverride, mergeChapter } from '@/lib/contentOverrides';

// ISR — 오버라이드 저장 시 revalidatePath로 즉시 무효화되고, 그 외에는 60초 주기로 갱신.
export const revalidate = 60;
const LANGUAGE = 'Chinese';

export function generateStaticParams() {
  return getGrammarStaticParams(LANGUAGE);
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const { data } = await loadChapter(LANGUAGE, slug);
  if (!data) return { title: '중국어 문법 | Anatomy Studio' };
  const chapter = mergeChapter(data.chapter, await getChapterOverride('Chinese', slug));
  const topicPart = chapter.topic ? ` — ${chapter.topic}` : '';
  const title = `${chapter.title}${topicPart} | 중국어 문법 | Anatomy Studio`;
  const description = chapter.summary || '한국어 화자를 위한 중국어 문법 레퍼런스';
  return { title, description, openGraph: { title, description } };
}

export default async function Page({ params }) {
  const { slug } = await params;
  const loaded = await loadChapter(LANGUAGE, slug);
  // 없는 챕터는 화면만 '찾을 수 없음'으로 두면 HTTP 200(soft 404)이라 검색엔진이 유령 페이지를
  // 색인하고 깨진 링크도 탐지되지 않는다 — 정식 404로 응답한다.
  if (!loaded?.data) notFound();
  return <ReferenceChapterPage lang={LANGUAGE} slug={slug} {...loaded} />;
}
