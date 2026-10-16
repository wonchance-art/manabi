// 「그림 한 장 읽기」 작품 → 읽을 자료(게시된 장) 연결(ART-READ-001). 카탈로그를 싣지 않는 클라이언트 모듈.
//
// 읽을 수 있는 장은 RLS가 정한다 — 공개 장은 모두, 비공개 장(공개 전 게시)은 게시한 관리자 본인만 읽힌다.
// 원문 해시가 카탈로그와 같은 장만 잇는다(남이 자기 자료에 provider 'art'를 꾸며 넣어도 목록에 끼지 않는다 — 뷰어 카드 대조와 같은 기준).
import { ART_BOOK_PROVIDER } from './artBookProvider';

export const ART_READING_SELECT = 'id,visibility,literature:processed_json->metadata->literature';

/**
 * 순수 판정 — 작품마다 장 하나: 공개 우선, 그다음 게시 책 순서(curationOrder), 그다음 작은 id.
 * @param {Array<{id, visibility, literature}>} rows
 * @param {Map<string, string>} expected 작품 id → 카탈로그 원문 해시
 * @param {string[]} curationOrder 게시 책 순서
 * @returns {Map<string, {id: string, visibility: string}>}
 */
export function pickArtChapters(rows, expected, curationOrder = []) {
  const rank = (row) => [
    row.visibility === 'public' ? 0 : 1,
    (() => { const at = curationOrder.indexOf(row.literature?.curation); return at === -1 ? curationOrder.length : at; })(),
    Number(row.id) || 0,
  ];
  const better = (a, b) => {
    const [x, y] = [rank(a), rank(b)];
    for (let i = 0; i < x.length; i += 1) if (x[i] !== y[i]) return x[i] < y[i];
    return false;
  };
  const best = new Map();
  for (const row of rows ?? []) {
    const literature = row?.literature;
    const work = literature?.work;
    if (literature?.provider !== ART_BOOK_PROVIDER || typeof work !== 'string') continue;
    if (!expected.has(work) || expected.get(work) !== literature.textSha256) continue;
    if (!best.has(work) || better(row, best.get(work))) best.set(work, row);
  }
  return new Map([...best].map(([work, row]) => [work, { id: String(row.id), visibility: row.visibility }]));
}

/** 읽을 수 있는 큐레이션 책 장을 한 번에 읽어 작품별로 고른다. 실패는 throw(목록은 감추고 /art는 안내). */
export async function fetchArtChapterIndex(client, expected, curationOrder = []) {
  const { data, error } = await client.from('reading_materials')
    .select(ART_READING_SELECT)
    .eq('processed_json->metadata->literature->>provider', ART_BOOK_PROVIDER)
    .limit(500);
  if (error) throw error;
  return pickArtChapters(data, expected, curationOrder);
}
