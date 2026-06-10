import ReferencePatternIndexPage from '@/views/ReferencePatternIndexPage';
import { REF_LANGS } from '@/content/refLangs';
import { getBunkei, countBunkei } from '@/content/japanese';

const ref = REF_LANGS.Japanese;

// 문형 사전이 있는 레벨만 (OT 제외)
const BUNKEI_LEVELS = ref.LEVEL_META.filter(m => countBunkei(m.key) > 0);

export function generateStaticParams() {
  return BUNKEI_LEVELS.map(m => ({ level: m.key.toLowerCase() }));
}

export async function generateMetadata({ params }) {
  const { level } = await params;
  const bunkei = getBunkei(level);
  if (!bunkei) return { title: 'JLPT 문형 사전 | Anatomy Studio' };
  const title = `${bunkei.title} | JLPT 문형 사전 | Anatomy Studio`;
  const description = bunkei.desc || `JLPT ${level.toUpperCase()} 문형 전수 수록 — 접속·뜻·예문·챕터 링크`;
  return { title, description, openGraph: { title, description } };
}

export default async function Page({ params }) {
  const { level } = await params;
  return (
    <ReferencePatternIndexPage
      refInfo={{ base: ref.base, flag: ref.flag, name: ref.name, langCode: ref.langCode }}
      levelMeta={BUNKEI_LEVELS}
      meta={ref.getLevelMeta(level)}
      bunkei={getBunkei(level)}
    />
  );
}
