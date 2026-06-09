import FrenchChapterPage from '@/views/FrenchChapterPage';
import { ALL_CHAPTERS, getChapter } from '@/content/french';

export function generateStaticParams() {
  return ALL_CHAPTERS.map(ch => ({ slug: ch.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const data = getChapter(slug);
  if (!data) return { title: '프랑스어 문법 | Anatomy Studio' };
  const title = `${data.chapter.title} | 프랑스어 문법 | Anatomy Studio`;
  const description = data.chapter.summary || '한국어 화자를 위한 프랑스어 문법 레퍼런스';
  return { title, description, openGraph: { title, description } };
}

export default async function Page({ params }) {
  const { slug } = await params;
  return <FrenchChapterPage slug={slug} />;
}
