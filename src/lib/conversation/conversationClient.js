// 대화 모드 화면 쪽 호출 — 서버 대화 턴 경로(/api/conversation/turn) 하나만 부른다(v2-Z Z-R1 ③).
// 튜터 프롬프트·안전 규칙·교정 규칙은 서버가 쥐고, 화면은 요청과 캐시 합치기만 한다.
import { supabase } from '../supabase';

async function bearer() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  } catch {
    return {};
  }
}

/**
 * 한 턴 보내기. 실패는 {status, code, error}를 단 Error로 던진다(화면이 상태별 문구를 고른다).
 * 오프라인·네트워크 오류는 status 0.
 */
export async function postConversationTurn(payload, { signal } = {}) {
  let res;
  try {
    res = await fetch('/api/conversation/turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await bearer()) },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (cause) {
    if (cause?.name === 'AbortError') throw cause;
    throw Object.assign(new Error('offline'), { status: 0, code: 'offline' });
  }
  let body = {};
  try { body = await res.json(); } catch { body = {}; }
  if (!res.ok) throw Object.assign(new Error(body.error || 'conversation_failed'), { status: res.status, code: body.code || null, body });
  return body;
}

/** 이 자료로 한 최신 대화(내 것). 없으면 null. */
export async function findLatestConversation(userId, parentId) {
  const { data, error } = await supabase.from('reading_materials')
    .select('id')
    .eq('owner_id', userId)
    .eq('processed_json->metadata->conversation->>parentId', String(parentId))
    .order('id', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.id ?? null;
}

const newAttemptId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : null);

/**
 * 「대화」 입구 — 그 자료의 최신 대화를 열고, 없으면 새로 만든다(첫 질문까지 서버가 만든다).
 * @returns {Promise<string>} 대화 자료 id
 */
export async function openConversationFor({ userId, parentId, outputWords = [], fresh = false }) {
  if (!fresh) {
    const existing = await findLatestConversation(userId, parentId);
    if (existing != null) return String(existing);
  }
  const attemptId = newAttemptId();
  const body = await postConversationTurn({ parentId: String(parentId), outputWords, ...(attemptId ? { attemptId } : {}) });
  return String(body.materialId);
}

/** 자료 없이 새 대화(주제·언어·수준) — Z-R2 새 대화 화면이 쓴다. */
export async function startTopicConversation({ topic, language, level, outputWords = [] }) {
  const attemptId = newAttemptId();
  const body = await postConversationTurn({ topic, language, level, outputWords, ...(attemptId ? { attemptId } : {}) });
  return String(body.materialId);
}
