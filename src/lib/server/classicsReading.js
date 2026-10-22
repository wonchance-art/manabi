// 고전 명작(DISCOVER-CLASSICS-001)의 DB 쪽 — 발행 기록 서가(canonical_book_shelf, CANON-RELEASE-001)만 읽는다.
// 표시는 저장소 대조표(classicsShelf.js)가 하고, 여기서는 「어느 자료를 열까」(첫 장 id · 공개 장 수)만 받는다.
// 실패하면 빈 서가 + failed — 화면은 빈 칸 안내 대신 「불러오지 못했어요」를 보인다(조용히 「책이 없어요」로 지나가지 않게).
import { classicsWorks, releasedClassics } from '../classicsShelf';

export async function canonicalShelfRows(client) {
  try {
    const { data, error } = await client.rpc('canonical_book_shelf');
    if (error) return { rows: [], failed: true };
    return { rows: Array.isArray(data) ? data : [], failed: false };
  } catch {
    return { rows: [], failed: true };
  }
}

/** 발행된 고전 명작 전부(카탈로그 차례) + 실패 여부. */
export async function releasedClassicsOf(client) {
  const { rows, failed } = await canonicalShelfRows(client);
  return { items: releasedClassics(classicsWorks(), rows), failed };
}
