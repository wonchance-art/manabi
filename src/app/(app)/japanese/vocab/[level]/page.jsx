import ReferenceVocabPage from '@/views/ReferenceVocabPage';
import { REF_LANGS } from '@/content/refLangs';

const ref = REF_LANGS.Japanese;

export function generateStaticParams() {
  return ref.LEVEL_META.map(m => ({ level: m.key.toLowerCase() }));
}

export async function generateMetadata({ params }) {
  const { level } = await params;
  const vocab = ref.getVocab(level);
  if (!vocab) return { title: '일본어 어휘 | Anatomy Studio' };
  const title = `${vocab.title} | 일본어 어휘 | Anatomy Studio`;
  const description = vocab.desc || '한국어 화자를 위한 일본어 레벨별 어휘 레퍼런스';
  return { title, description, openGraph: { title, description } };
}

export default async function Page({ params }) {
  const { level } = await params;
  return (
    <ReferenceVocabPage
      lang="Japanese"
      refInfo={{ base: ref.base, flag: ref.flag, name: ref.name, langCode: ref.langCode }}
      levelMeta={ref.LEVEL_META}
      meta={ref.getLevelMeta(level)}
      vocab={ref.getVocab(level)}
    />
  );
}
