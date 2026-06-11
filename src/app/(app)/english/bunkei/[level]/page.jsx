import ReferencePatternIndexPage from '@/views/ReferencePatternIndexPage';
import { REF_LANGS } from '@/content/refLangs';
import { getBunkei, countBunkei } from '@/content/english';

const ref = REF_LANGS.English;

// 문형 사전이 있는 레벨만 (OT 제외)
const BUNKEI_LEVELS = ref.LEVEL_META.filter(m => countBunkei(m.key) > 0);

export function generateStaticParams() {
  return BUNKEI_LEVELS.map(m => ({ level: m.key.toLowerCase() }));
}

export async function generateMetadata({ params }) {
  const { level } = await params;
  const bunkei = getBunkei(level);
  if (!bunkei) return { title: '영어 문형 사전 | Anatomy Studio' };
  const title = `${bunkei.title} | 영어 문형 사전 | Anatomy Studio`;
  const description = bunkei.desc || `영어 ${level.toUpperCase()} 핵심 구문·표현 전수 수록 — 구조·뜻·예문·챕터 링크`;
  return { title, description, openGraph: { title, description } };
}

export default async function Page({ params }) {
  const { level } = await params;
  return (
    <ReferencePatternIndexPage
      lang="English"
      refInfo={{ base: ref.base, flag: ref.flag, name: ref.name, langCode: ref.langCode }}
      levelMeta={BUNKEI_LEVELS}
      meta={ref.getLevelMeta(level)}
      bunkei={getBunkei(level)}
      hasVocab={ref.countVocab(level) > 0}
    />
  );
}
