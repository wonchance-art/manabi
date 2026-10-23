// 고전 명작(DISCOVER-CLASSICS-001)의 DB 쪽 — 발행 기록 서가(canonical_book_shelf, CANON-RELEASE-001)와
// 그림 서가(canonical_art_shelf, DISCOVER-ART-001)만 읽는다.
// 표시는 저장소 대조표(classicsShelf.js) · 카탈로그(artShelf.js)가 하고, 여기서는 「어느 자료를 열까」(책 첫 장 id · 공개 장 수 · 작품별 장 id)만 받는다.
// 실패하면 빈 서가 + failed — 화면은 빈 칸 안내 대신 「불러오지 못했어요」를 보인다(조용히 「책이 없어요」로 지나가지 않게).
import { artShelfWorks, releasedArt } from '../artShelf';
import { classicsWorks, releasedClassics } from '../classicsShelf';

async function rpcRows(client, name) {
  try {
    const { data, error } = await client.rpc(name);
    if (error) return { rows: [], failed: true };
    return { rows: Array.isArray(data) ? data : [], failed: false };
  } catch {
    return { rows: [], failed: true };
  }
}

/** 그림 구간 — 발행된 그림 책의 공개 장(작품 · 순서 · 자료 id). */
export const canonicalArtRows = (client) => rpcRows(client, 'canonical_art_shelf');

/** 발행된 그림 전부(그림 구간 차례) + 실패 여부. */
export async function releasedArtOf(client) {
  const { rows, failed } = await canonicalArtRows(client);
  return { items: releasedArt(artShelfWorks(), rows), failed };
}

export const canonicalShelfRows = (client) => rpcRows(client, 'canonical_book_shelf');

/** 발행된 고전 명작 전부(카탈로그 차례) + 실패 여부. */
export async function releasedClassicsOf(client) {
  const { rows, failed } = await canonicalShelfRows(client);
  return { items: releasedClassics(classicsWorks(), rows), failed };
}
