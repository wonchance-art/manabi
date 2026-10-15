// 「그림 한 장 읽기」 기사형 목록(ART-READ-001, 2026-10-15 KST 오너 「뉴스 기사처럼 — 목록에서 고르면 바로 읽기」 「권장대로 ㄱㄱ」).
//
// 목록에 그리는 값은 카탈로그에서만 온다(서버 컴포넌트가 부른다 — 카탈로그 JSON을 클라이언트 번들에 싣지 않는다).
// 작품 → 읽을 자료(공개 장) 연결은 클라이언트가 artReadingIndex.js로 한다: 게시는 관리자 몫이라 공개 전에는
// 게시한 관리자 본인에게만 비공개 장이 보이고(RLS), 공개되면 모두에게 보인다 — 「공개 전에는 관리자만」(오너 결정 ⓑ)이 RLS로 성립한다.
import { ART_CATALOG } from '../content/art/index.js';
import { artDateDisplay } from './artCatalog.js';
import { ART_PUBLISHED_CURATIONS } from './artBook.js';

const BOOK_LANGUAGE = 'ja';

/**
 * 게시 책(ART_PUBLISHED_CURATIONS) 순서대로 작품 목록 — 같은 작품이 두 책에 있으면 처음 한 번만.
 * @returns {Array<{id, title, artist, date, level, chars, image, textSha256, curation}>}
 */
export function artReadingItems(catalog = ART_CATALOG) {
  const workById = new Map(catalog.works.map((work) => [work.id, work]));
  const artistById = new Map(catalog.artists.map((artist) => [artist.id, artist]));
  const seen = new Set();
  const items = [];
  for (const curationId of ART_PUBLISHED_CURATIONS) {
    const curation = catalog.curations.find((item) => item.id === curationId);
    for (const workId of curation?.works ?? []) {
      const work = workById.get(workId);
      const description = work?.descriptions.find((item) => item.language === BOOK_LANGUAGE);
      if (!work || !description || seen.has(workId)) continue;
      seen.add(workId);
      const artist = artistById.get(work.artist);
      items.push({
        id: work.id,
        title: { native: work.title.native, ko: work.title.ko ?? null },
        artist: artist ? { id: artist.id, native: artist.name.native, ko: artist.name.ko ?? artist.name.native } : null,
        date: artDateDisplay(work.date),
        level: curation.level ?? null,
        chars: [...description.text].length,
        image: work.image ? { url: work.image.url, width: work.image.width ?? null, height: work.image.height ?? null, alt: work.image.alt } : null,
        textSha256: description.textSha256,
        curation: curation.id,
      });
    }
  }
  return items;
}

/** 작품 하나(/art/<작품>) — 목록과 같은 값. 없거나 게시 책 밖이면 null. */
export function artReadingItem(workId, catalog = ART_CATALOG) {
  return artReadingItems(catalog).find((item) => item.id === workId) ?? null;
}

export { ART_PUBLISHED_CURATIONS };
