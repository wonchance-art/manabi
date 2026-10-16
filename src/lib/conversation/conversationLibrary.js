// 대화 자료(processed_json.metadata.conversation) 조회 — 대화 탭 방 목록·지난 턴 기록.
// 튜터 대화는 서재에 두지 않는다(오너 결정 「대화방에만」 2026-10-17, CONV-CHAT-001 8차): 서재 목록 RPC가
// 휴지통 밖에서 대화를 뺀다(docs/sql/library-hide-conversations.sql). 대화는 대화 탭 방 목록에서만 연다.
import { filterActiveSources } from '../libraryOperations';

const COLUMNS = [
  'id', 'title', 'created_at',
  'marker:processed_json->metadata->conversation->>version',
  'topic:processed_json->metadata->conversation->>topic',
  'language:processed_json->metadata->conversation->>language',
  'parentId:processed_json->metadata->conversation->>parentId',
].join(',');

/**
 * 대화 방 목록(CONV-CHAT-001 2차) — 내 대화 + 미리보기 · 마지막 활동 시각. 본문(raw_text)은 읽지 않는다.
 * 휴지통으로 옮긴 대화는 뺀다(서재 「대화」 묶음과 같은 규칙).
 * 대화 기록(turns)도 읽지 않는다 — 서버가 턴마다 남기는 preview · lastAt 두 칸만 읽는다(CONV-CHAT-001 6차 최적화).
 * 두 칸이 없는 옛 대화만 그 행들의 turns를 한 번 더 읽어 채운다(다음 턴부터는 서버가 남긴다).
 */
export async function fetchConversationRooms(client, userId, { limit = 60 } = {}) {
  const { data, error } = await client.from('reading_materials')
    .select([COLUMNS, 'preview:processed_json->metadata->conversation->>preview', 'lastAt:processed_json->metadata->conversation->>lastAt'].join(','))
    .eq('owner_id', userId)
    .not('processed_json->metadata->conversation', 'is', null)
    .order('id', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const active = await filterActiveSources(client, userId, (data || []).filter((row) => row.marker != null));
  const old = active.filter((row) => !row.preview || row.lastAt == null).map((row) => row.id);
  const turnsById = new Map();
  if (old.length) {
    const { data: rest, error: restError } = await client.from('reading_materials')
      .select('id,turns:processed_json->metadata->conversation->turns').eq('owner_id', userId).in('id', old);
    if (restError) throw restError;
    for (const row of rest || []) turnsById.set(String(row.id), Array.isArray(row.turns) ? row.turns : []);
  }
  return active.map((row) => ({
    id: String(row.id),
    title: row.title || row.topic || '대화',
    topic: row.topic || null,
    language: row.language || null,
    parentId: row.parentId || null,
    createdAt: row.created_at || null,
    turns: turnsById.get(String(row.id)) || [],
    preview: row.preview || '',
    lastAt: row.lastAt != null && row.lastAt !== '' ? Number(row.lastAt) : null,
  }));
}

/** 대화 자료 화면 링크. */
export const conversationHref = (id) => `/viewer/${encodeURIComponent(id)}`;

/**
 * 내 최근 대화의 턴 기록(Z-R3 — 새 대화 「지난번 고친 말」·작문 「못 쓴 말」 파생 재료).
 * @returns {Promise<Array<{id, created_at, language, turns, reask}>>}
 */
export async function fetchConversationTurns(client, userId, { limit = 20 } = {}) {
  const { data, error } = await client.from('reading_materials')
    .select('id,created_at,marker:processed_json->metadata->conversation->>version,language:processed_json->metadata->conversation->>language,turns:processed_json->metadata->conversation->turns,reask:processed_json->metadata->conversation->reask')
    .eq('owner_id', userId)
    .not('processed_json->metadata->conversation', 'is', null)
    .order('id', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).filter((row) => row.marker != null && Array.isArray(row.turns));
}
