// 고전 명작(DISCOVER-CLASSICS-001)의 DB 쪽 — 발행 기록 서가(canonical_book_shelf, CANON-RELEASE-001)와
// 그림 서가(canonical_art_shelf, DISCOVER-ART-001)만 읽는다.
// 표시는 저장소 대조표(classicsShelf.js) · 카탈로그(artShelf.js)가 하고, 여기서는 「어느 자료를 열까」(책 첫 장 id · 공개 장 수 · 작품별 장 id)만 받는다.
// 실패하면 빈 서가 + failed — 화면은 빈 칸 안내 대신 「불러오지 못했어요」를 보인다(조용히 「책이 없어요」로 지나가지 않게).
import { artShelfWorks, releasedArt } from '../artShelf';
import { classicsProgress } from '../classicsProgress';
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

/** 읽은 자리 조회 예산 — 넘으면 상태 없이 그린다(부가 표시가 서가를 막지 않는다). */
const PROGRESS_TIMEOUT_MS = 2500;
/** 최근 줄만 — 서재 자료가 많은 사용자도 id 목록 질의가 주소 길이를 넘지 않게. */
const PROGRESS_ROWS = 400;
const NONE = Object.freeze({ resume: {}, read: new Set() });

/**
 * 고전 명작 카드의 읽은 자리(DISCOVER-CLASSICS-PROGRESS-001) — 로그인 사용자 세션 클라이언트로 자기 reading_progress(RLS 본인 줄)와
 * 그 줄 · 책 첫 장의 자료(book key · 장 순서 · 소유자 — 본문 없이)만 읽는다. 손님 · 실패 · 시간 초과는 상태 없음(서가는 그대로).
 */
export async function classicsProgressOf(session, { books, art }) {
  if (!session?.supabase || !session.user?.id || (!books.length && !art.length)) return NONE;
  try {
    const signal = AbortSignal.timeout(PROGRESS_TIMEOUT_MS);
    const { data: progress, error } = await session.supabase.from('reading_progress')
      .select('material_id, is_completed, last_token_idx, updated_at').eq('user_id', session.user.id)
      .order('updated_at', { ascending: false }).limit(PROGRESS_ROWS).abortSignal(signal);
    if (error || !progress?.length) return NONE;
    const artIds = new Set(art.map((item) => item.materialId));
    const ids = [...new Set([...books.map((item) => item.firstMaterialId),
      ...progress.map((row) => Number(row.material_id)).filter((id) => Number.isSafeInteger(id) && !artIds.has(id))])];
    const { data: materials, error: materialError } = books.length ? await session.supabase.from('reading_materials')
      .select('id, owner_id, visibility, key:processed_json->metadata->book->>key, order:processed_json->metadata->book->>order')
      .in('id', ids).eq('visibility', 'public').abortSignal(signal) : { data: [], error: null };
    if (materialError) return classicsProgress({ art, progress });
    return classicsProgress({ books, art, progress, materials });
  } catch {
    return NONE;
  }
}
