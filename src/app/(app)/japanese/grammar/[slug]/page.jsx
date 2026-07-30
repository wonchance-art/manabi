import ReferenceChapterPage from '@/views/ReferenceChapterPage';
import { getGrammarStaticParams, loadChapter } from '@/content/refGrammarLoaders';
import { getChapterOverride, mergeChapter } from '@/lib/contentOverrides';

// ISR — 오버라이드 저장 시 revalidatePath로 즉시 무효화되고, 그 외에는 60초 주기로 갱신.
export const revalidate = 60;
const LANGUAGE = 'Japanese';

export function generateStaticParams() {
  return getGrammarStaticParams(LANGUAGE);
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const { data } = await loadChapter(LANGUAGE, slug);
  if (!data) return { title: '일본어 문법 | Anatomy Studio' };
  const chapter = mergeChapter(data.chapter, await getChapterOverride('Japanese', slug));
  const topicPart = chapter.topic ? ` — ${chapter.topic}` : '';
  const title = `${chapter.title}${topicPart} | 일본어 문법 | Anatomy Studio`;
  const description = chapter.summary || '한국어 화자를 위한 일본어 문법 레퍼런스';
  return { title, description, openGraph: { title, description } };
}

export default async function Page({ params }) {
  const { slug } = await params;
  const loaded = await loadChapter(LANGUAGE, slug);
  return <ReferenceChapterPage lang={LANGUAGE} slug={slug} {...loaded} />;
}
