import { REF_LANGS } from './refLangs';

/**
 * 레퍼런스 경량 매니페스트 — 목차·카운트만 클라이언트로 전달 (서버 전용 헬퍼).
 * 본문(섹션·예문·단어)은 서버 컴포넌트에만 존재해 클라이언트 번들을 가볍게 유지한다.
 */
export function buildRefManifest() {
  const out = {};
  for (const [name, ref] of Object.entries(REF_LANGS)) {
    out[name] = {
      base: ref.base,
      readKey: ref.readKey,
      blurb: ref.blurb,
      legend: ref.legend,
      levels: ref.LEVEL_META.map(m => ({
        key: m.key,
        short: m.short || null,
        label: m.label,
        focus: m.focus,
        chapters: ref.getGrammarChapters(m.key).map(c => ({
          slug: c.slug,
          order: c.order,
          title: c.title,
          topic: c.topic || null,
          summary: c.summary || null,
          duration: c.duration || null,
        })),
        vocabCount: ref.countVocab(m.key),
        bunkeiCount: ref.countBunkei ? ref.countBunkei(m.key) : 0,
      })),
    };
  }
  return out;
}

/**
 * 홈 화면용 초경량 매니페스트 — 이어서 학습 카드 계산에 필요한 최소 정보만.
 * (slug·order·title·레벨 라벨 — summary/topic 등은 제외해 홈 번들 최소화)
 */
export function buildContinueManifest() {
  const out = {};
  for (const [name, ref] of Object.entries(REF_LANGS)) {
    out[name] = {
      base: ref.base,
      readKey: ref.readKey,
      flag: ref.flag,
      name: ref.name,
      levels: ref.LEVEL_META.map(m => ({
        label: m.label,
        chapters: ref.getGrammarChapters(m.key).map(c => ({
          slug: c.slug,
          order: c.order,
          title: c.title,
        })),
      })),
    };
  }
  return out;
}
