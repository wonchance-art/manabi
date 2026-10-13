// 관리자 보관함 전용 — 예전 레벨별 어휘 · 문형 레퍼런스 화면(#1287 이전 공개 경로의 본문).
// LEVEL-LIST-AJ-001이 일본어 · 중국어 /{lang}/{vocab,bunkei}/{레벨}을 새 화면으로 다시 열면서, 보관함 사본은
// 예전 렌더러를 그대로 보이도록 옛 라우트 본문을 여기로 옮겼다(학습자에게는 내보내지 않는다 — 인계 §1).
import ReferenceVocabPage from '@/views/ReferenceVocabPage';
import ReferencePatternIndexPage from '@/views/ReferencePatternIndexPage';
import { REF_LANGS } from '@/content/refLangs';
import { JAPANESE_VOCAB_REF } from '@/lib/japaneseVocabRegistry';
import { getBunkei as getJaBunkei, countBunkei as countJaBunkei } from '@/content/japanese';
import { getBunkei as getZhBunkei, countBunkei as countZhBunkei } from '@/content/chinese';

const refInfoOf = ref => ({ base: ref.base, flag: ref.flag, name: ref.name, langCode: ref.langCode });

export async function JapaneseVocabLegacy({ params }) {
  const { level } = await params;
  const ref = JAPANESE_VOCAB_REF;
  return (
    <ReferenceVocabPage
      lang="Japanese"
      refInfo={refInfoOf(ref)}
      levelMeta={ref.LEVEL_META.filter(m => ref.countVocab(m.key) > 0)}
      meta={ref.getLevelMeta(level)}
      vocab={ref.getVocab(level)}
      hasBunkei={ref.hasBunkei(level)}
    />
  );
}

export async function JapaneseBunkeiLegacy({ params }) {
  const { level } = await params;
  const ref = REF_LANGS.Japanese;
  return (
    <ReferencePatternIndexPage
      refInfo={refInfoOf(ref)}
      levelMeta={ref.LEVEL_META.filter(m => countJaBunkei(m.key) > 0)}
      meta={ref.getLevelMeta(level)}
      bunkei={getJaBunkei(level)}
      hasVocab={ref.countVocab(level) > 0}
    />
  );
}

export async function ChineseVocabLegacy({ params }) {
  const { level } = await params;
  const ref = REF_LANGS.Chinese;
  return (
    <ReferenceVocabPage
      lang="Chinese"
      refInfo={refInfoOf(ref)}
      levelMeta={ref.LEVEL_META.filter(m => ref.countVocab(m.key) > 0)}
      meta={ref.getLevelMeta(level)}
      vocab={ref.getVocab(level)}
      hasBunkei={countZhBunkei(level) > 0}
    />
  );
}

export async function ChineseBunkeiLegacy({ params }) {
  const { level } = await params;
  const ref = REF_LANGS.Chinese;
  return (
    <ReferencePatternIndexPage
      lang="Chinese"
      refInfo={refInfoOf(ref)}
      levelMeta={ref.LEVEL_META.filter(m => countZhBunkei(m.key) > 0)}
      meta={ref.getLevelMeta(level)}
      bunkei={getZhBunkei(level)}
      hasVocab={ref.countVocab(level) > 0}
    />
  );
}
