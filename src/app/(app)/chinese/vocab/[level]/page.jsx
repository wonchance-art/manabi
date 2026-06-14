import ReferenceVocabPage from '@/views/ReferenceVocabPage';
import { REF_LANGS } from '@/content/refLangs';
import { countBunkei } from '@/content/chinese';

const ref = REF_LANGS.Chinese;

const VOCAB_LEVELS = ref.LEVEL_META.filter(m => ref.countVocab(m.key) > 0);

export function generateStaticParams() {
  return VOCAB_LEVELS.map(m => ({ level: m.key.toLowerCase() }));
}

export async function generateMetadata({ params }) {
  const { level } = await params;
  const vocab = ref.getVocab(level);
  if (!vocab) return { title: '중국어 어휘 | Anatomy Studio' };
  const title = `${vocab.title} | 중국어 어휘 | Anatomy Studio`;
  const description = vocab.desc || '한국어 화자를 위한 중국어 레벨별 어휘 레퍼런스';
  return { title, description, openGraph: { title, description } };
}

export default async function Page({ params }) {
  const { level } = await params;
  return (
    <ReferenceVocabPage
      lang="Chinese"
      refInfo={{ base: ref.base, flag: ref.flag, name: ref.name, langCode: ref.langCode }}
      levelMeta={VOCAB_LEVELS}
      meta={ref.getLevelMeta(level)}
      vocab={ref.getVocab(level)}
      hasBunkei={countBunkei(level) > 0}
    />
  );
}
