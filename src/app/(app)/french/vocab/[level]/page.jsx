import FrenchVocabPage from '@/views/FrenchVocabPage';
import { FR_LEVEL_META, getVocab } from '@/content/french';

export function generateStaticParams() {
  return FR_LEVEL_META.map(m => ({ level: m.key.toLowerCase() }));
}

export async function generateMetadata({ params }) {
  const { level } = await params;
  const vocab = getVocab(level);
  if (!vocab) return { title: '프랑스어 어휘 | Anatomy Studio' };
  const title = `${vocab.title} | 프랑스어 어휘 | Anatomy Studio`;
  const description = vocab.desc || '한국어 화자를 위한 프랑스어 레벨별 어휘 레퍼런스';
  return { title, description, openGraph: { title, description } };
}

export default async function Page({ params }) {
  const { level } = await params;
  return <FrenchVocabPage level={level} />;
}
