// 서재의 「대화」 묶음(v2-Z Z-R1 ③) — 대화 자료(processed_json.metadata.conversation)만 따로 읽는다.
// 서재 목록 RPC(personal_library_page_v2)는 대화를 일반 글과 똑같이 돌려준다. RPC를 바꾸는 DB 변경 없이,
// 화면이 이 조회로 대화를 「대화」 묶음에 모으고, 목록의 같은 자료에는 「대화」 표시를 붙인다.
import { filterActiveSources } from '../libraryOperations';

export const CONVERSATION_SHELF_LIMIT = 200;
export const CONVERSATION_SHELF_PREVIEW = 3;

const COLUMNS = [
  'id', 'title', 'created_at',
  'marker:processed_json->metadata->conversation->>version',
  'topic:processed_json->metadata->conversation->>topic',
  'language:processed_json->metadata->conversation->>language',
  'parentId:processed_json->metadata->conversation->>parentId',
].join(',');

/** 내 대화 목록(최신순). 대화 표식이 있는 내 자료만. */
export async function fetchConversations(client, userId, { limit = CONVERSATION_SHELF_LIMIT } = {}) {
  const { data, error } = await client.from('reading_materials')
    .select(COLUMNS)
    .eq('owner_id', userId)
    .not('processed_json->metadata->conversation', 'is', null)
    .order('id', { ascending: false })
    .limit(limit);
  if (error) throw error;
  // 표식 열을 한 번 더 본다 — JSON 경로 필터를 모르는 경로(옛 프록시·테스트 백엔드)가 일반 자료를 섞어 보내도 대화만 남긴다.
  // 휴지통으로 옮긴 대화는 묶음에서 뺀다(서재 휴지통에서 되돌리면 다시 보인다).
  const active = await filterActiveSources(client, userId, (data || []).filter((row) => row.marker != null));
  return active.map((row) => ({
    id: String(row.id),
    title: row.topic || row.title || '대화',
    language: row.language || null,
    parentId: row.parentId || null,
    createdAt: row.created_at || null,
  }));
}

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

/** 대화 한 줄의 보조 정보 — 「중국어 · 자료로 시작한 대화 · 10월 14일」. 날짜는 KST.
 * 턴 수는 싣지 않는다 — turnCount는 낙관 잠금 값이라(답 보기도 1 올린다) 「말한 횟수」가 아니다. */
export function conversationShelfMeta(row, { languageName = (l) => l } = {}) {
  const parts = [];
  if (row.language) parts.push(languageName(row.language));
  parts.push(row.parentId ? '자료로 시작한 대화' : '주제 대화');
  if (row.createdAt) {
    const kst = new Date(new Date(row.createdAt).getTime() + 9 * 3600e3);
    if (!Number.isNaN(kst.getTime())) parts.push(`${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`);
  }
  return parts.join(' · ');
}

/** 대화 자료 화면 링크 — 돌아올 곳(returnTo)은 서재 링크(LibraryReaderLink)가 붙인다. */
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
