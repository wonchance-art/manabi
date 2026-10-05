/** 새 전체 상태 카드가 이전 날짜 기반 채점으로 되돌아가지 않도록 막는 경계.
 * 서버 RPC/DB trigger가 최종 권한을 검증한다. 클라이언트 캐시는 차단 근거만 보관한다.
 */
const enrolledByActor = new Map();
const boundaryError = code => Object.assign(new Error(code), { code });
const cacheKey = actorId => `manabi:fsrs-enrolled:v1:${actorId}`;
const identity = value => typeof value === 'string' && value.length > 0 && value.length <= 200;

function rememberedIds(actorId) {
  const ids = enrolledByActor.get(actorId) || new Set();
  // 같은 브라우저에서 뷰어로 바로 복귀해도 이전의 양성 근거를 잃지 않는다.
  // 저장소 부재/빈 목록은 미등록이라는 근거가 아니다. 서버 경계는 항상 별도로 확인한다.
  try {
    const stored = JSON.parse(globalThis.localStorage?.getItem(cacheKey(actorId)) || 'null');
    if (stored?.version === 1 && Array.isArray(stored.ids)) {
      stored.ids.filter(identity).forEach(id => ids.add(id));
    }
  } catch { /* 저장 제한 환경에서는 메모리 근거와 서버/DB 검증을 유지한다. */ }
  enrolledByActor.set(actorId, ids);
  return ids;
}

export function rememberFsrsEnrollments(actorId, entries = []) {
  if (!identity(actorId)) return;
  const ids = rememberedIds(actorId);
  for (const entry of entries) {
    const id = typeof entry === 'string' ? entry : entry?.cardId;
    if (identity(id)) ids.add(id);
  }
  enrolledByActor.set(actorId, ids);
  try { globalThis.localStorage?.setItem(cacheKey(actorId), JSON.stringify({ version: 1, ids: [...ids] })); }
  catch { /* 영속 캐시는 차단 근거의 보조 사본이며 성공 영수증이 아니다. */ }
}

export function isFsrsLegacyWriteError(error) {
  return ['fsrs_legacy_write_blocked', 'fsrs_boundary_unavailable', 'fsrs_account_changed'].includes(error?.code)
    || (['55000', 'P0001'].includes(error?.code) &&
      /\b(?:fsrs_legacy_(?:write|review|event)_blocked|fsrs_enrolled_card_protected)\b/.test(error?.message || ''));
}

export function assertCachedLegacyFsrsAllowed(actorId, cardId) {
  if (identity(actorId) && cardId && rememberedIds(actorId).has(cardId)) throw boundaryError('fsrs_legacy_write_blocked');
}

export async function assertLegacyFsrsAllowed(client, { userId, cardId = null, itemKey = null, language = null } = {}) {
  assertCachedLegacyFsrsAllowed(userId, cardId);
  // 기존 주입식 비-RPC 저장 adapter와 호환. 실제 Supabase client에는 rpc가 항상 존재한다.
  if (typeof client?.rpc !== 'function') return;
  let response;
  try {
    response = await client.rpc('fsrs_legacy_boundary', { p_card_id: cardId, p_item_key: itemKey, p_language: language });
  } catch { throw boundaryError('fsrs_boundary_unavailable'); }
  if (response?.error) {
    // 정확한 미설치 함수만 기존 경로로 보낸다. 인증/연결 실패를 미등록으로 해석하지 않는다.
    if (response.error.code === 'PGRST202' && /(?:public\.)?fsrs_legacy_boundary\b/.test(response.error.message || '')) return;
    throw boundaryError('fsrs_boundary_unavailable');
  }
  const data = response?.data;
  if (data?.version !== 1 || typeof data.enrolled !== 'boolean' || !data.actorId) throw boundaryError('fsrs_boundary_unavailable');
  if (userId && data.actorId !== userId) throw boundaryError('fsrs_account_changed');
  if (data.enrolled) {
    rememberFsrsEnrollments(data.actorId, cardId ? [cardId] : []);
    throw boundaryError('fsrs_legacy_write_blocked');
  }
}
