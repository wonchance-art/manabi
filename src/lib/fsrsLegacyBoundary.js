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

/**
 * 경계 확인 증거(F5② — 같은 카드 · 같은 채점 1회화). 채점 하나는 쓰기 둘(review_events INSERT · user_vocabulary UPDATE)을 같은
 * lock 안에서 잇달아 하는데, 전에는 progressStore · logReviewEvents · persistVocabGrade가 같은 카드로 fsrs_legacy_boundary를 한 번씩
 * (채점당 3번) 물어 세 답이 서로 다른 시점을 볼 수 있었다(반쪽 저장 냄새). 이제 첫 확인이 돌려준 증거를 같은 채점의 쓰기 묶음에 넘겨
 * 나눠 쓴다 — 쓰기마다 확인이 있다는 것은 그대로다(그 묶음 바로 앞의 한 번). 증거는 이 모듈만 만들 수 있고(WeakSet · 동결),
 * 같은 카드 · 같은 계정 · 같은 표기 · 같은 언어만 덮으며 짧게만 산다. 기기 차단 캐시(assertCachedLegacyFsrsAllowed)는 늘 다시 본다.
 * DB 트리거(fsrs_guard_legacy_event · fsrs_guard_legacy_vocabulary)가 최종 권한이라는 전제는 그대로다.
 */
export const LEGACY_BOUNDARY_PROOF_MS = 15000;
const proofs = new WeakSet();
const issueProof = ({ userId = null, cardId = null, itemKey = null, language = null }) => {
  if (!cardId) return undefined;
  const proof = Object.freeze({ userId: userId || null, cardId, itemKey: itemKey ?? null, language: language ?? null, at: Date.now() });
  proofs.add(proof); return proof;
};
/** 이 증거가 이 확인을 덮는가 — 같은 카드이고, 호출이 준 계정 · 표기 · 언어가 증거와 같고, 아직 짧은 수명 안이다. */
export function legacyBoundaryCovers(proof, { userId = null, cardId = null, itemKey = null, language = null } = {}) {
  if (!proof || !proofs.has(proof) || !cardId || proof.cardId !== cardId) return false;
  const age = Date.now() - proof.at;
  if (!(age >= 0 && age <= LEGACY_BOUNDARY_PROOF_MS)) return false;
  return (!userId || proof.userId === userId) && (itemKey == null || proof.itemKey === itemKey)
    && (language == null || proof.language === language);
}

export async function assertLegacyFsrsAllowed(client, { userId, cardId = null, itemKey = null, language = null } = {}) {
  assertCachedLegacyFsrsAllowed(userId, cardId);
  // 기존 주입식 비-RPC 저장 adapter와 호환. 실제 Supabase client에는 rpc가 항상 존재한다.
  if (typeof client?.rpc !== 'function') return undefined;
  let response;
  try {
    response = await client.rpc('fsrs_legacy_boundary', { p_card_id: cardId, p_item_key: itemKey, p_language: language });
  } catch { throw boundaryError('fsrs_boundary_unavailable'); }
  if (response?.error) {
    // 정확한 미설치 함수만 기존 경로로 보낸다. 인증/연결 실패를 미등록으로 해석하지 않는다.
    if (response.error.code === 'PGRST202' && /(?:public\.)?fsrs_legacy_boundary\b/.test(response.error.message || '')) return undefined;
    throw boundaryError('fsrs_boundary_unavailable');
  }
  const data = response?.data;
  if (data?.version !== 1 || typeof data.enrolled !== 'boolean' || !data.actorId) throw boundaryError('fsrs_boundary_unavailable');
  if (userId && data.actorId !== userId) throw boundaryError('fsrs_account_changed');
  if (data.enrolled) {
    rememberFsrsEnrollments(data.actorId, cardId ? [cardId] : []);
    throw boundaryError('fsrs_legacy_write_blocked');
  }
  return issueProof({ userId: userId || data.actorId, cardId, itemKey, language });
}

/**
 * 같은 채점의 쓰기가 부른다 — 앞선 확인의 증거가 이 확인을 덮으면 서버에 다시 묻지 않고(기기 차단 캐시는 본다) 그 증거를 돌려준다.
 * 덮지 못하면(증거 없음 · 다른 카드 · 다른 표기 · 수명 지남) 지금처럼 묻는다.
 */
export async function assertLegacyFsrsAllowedOnce(client, args = {}, proof) {
  if (!legacyBoundaryCovers(proof, args)) return assertLegacyFsrsAllowed(client, args);
  const actorId = args.userId || proof.userId;
  assertCachedLegacyFsrsAllowed(actorId, args.cardId);
  // 서버 확인(RPC)이 하던 계정 대조는 쓰기 직전 로컬 세션으로 한다(독립 리뷰 2026-10-25 KST) — 채점 도중 계정이 바뀌었으면 지금처럼
  // fsrs_account_changed(차단 · 큐에 안 담음)로, 세션을 읽지 못하면 fsrs_boundary_unavailable(일시 — 큐에 담는다)로 같은 분류를 낸다.
  if (typeof client?.auth?.getSession === 'function') {
    let session;
    try { ({ data: { session } = {} } = await client.auth.getSession()); } catch { throw boundaryError('fsrs_boundary_unavailable'); }
    if (!session?.user?.id) throw boundaryError('fsrs_boundary_unavailable');
    if (session.user.id !== actorId) throw boundaryError('fsrs_account_changed');
  }
  return proof;
}
