import { REF_LANGS } from '../../content/refLangs';

/**
 * /learn 진도 위젯용 서버 매니페스트.
 *
 * 챕터 본문은 클라이언트 번들로 보내지 않고, 레벨별 slug와 기존 localStorage
 * readKey만 직렬화한다. REF_LANGS의 언어·레벨 순서를 그대로 보존한다.
 */
export function buildLearnProgressCatalog() {
  return Object.fromEntries(
    Object.entries(REF_LANGS).map(([language, ref]) => [
      language,
      {
        language,
        name: ref.name,
        track: String(ref.base || '').replace(/^\//, ''),
        readKey: ref.readKey,
        levels: ref.LEVEL_META.map((meta) => ({
          key: meta.key,
          short: meta.short || meta.key,
          label: meta.label,
          intro: meta.key === 'OT' || meta.key === 'A0',
          chapterSlugs: ref.getGrammarChapters(meta.key).map((chapter) => chapter.slug),
        })),
      },
    ]),
  );
}
