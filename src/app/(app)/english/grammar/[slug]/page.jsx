import ReferenceChapterPage from '@/views/ReferenceChapterPage';
import { ALL_CHAPTERS, getChapter } from '@/content/english';
import { getChapterOverride, mergeChapter } from '@/lib/contentOverrides';

// ISR — 오버라이드 저장 시 revalidatePath로 즉시 무효화되고, 그 외에는 60초 주기로 갱신.
export const revalidate = 60;

export function generateStaticParams() {
  return ALL_CHAPTERS.map(ch => ({ slug: ch.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const data = getChapter(slug);
  if (!data) return { title: '영어 문법 | Anatomy Studio' };
  const chapter = mergeChapter(data.chapter, await getChapterOverride('English', slug));
  const topicPart = chapter.topic ? ` — ${chapter.topic}` : '';
  const title = `${chapter.title}${topicPart} | 영어 문법 | Anatomy Studio`;
  const description = chapter.summary || '한국어 화자를 위한 영어 문법 레퍼런스';
  return { title, description, openGraph: { title, description } };
}

export default async function Page({ params }) {
  const { slug } = await params;
  return <ReferenceChapterPage lang="English" slug={slug} />;
}
