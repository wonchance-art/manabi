const WORLD_POSITION_ENDPOINT = '/api/world/position';

// 공항 출구와 동일하게 dev guest는 제품 저장 API를 건드리지 않고 전환을 계속한다.
// 로그인 사용자는 기존 POST 성공 응답 뒤에만 이동을 승인한다.
export function createGuestAwarePositionPersister({
  devGuest = false,
  userId = null,
  request = globalThis.fetch,
} = {}) {
  return async function persistPosition(position) {
    if (devGuest) return true;
    if (!userId || !position || typeof request !== 'function') return false;

    try {
      const response = await request(WORLD_POSITION_ENDPOINT, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(position),
        keepalive: true,
      });
      return response?.ok === true;
    } catch {
      return false;
    }
  };
}
