// 프로필 SELECT-only 갱신 — learningActivity.js에서 옮겼다(FIRSTLOAD-AUTH-001, 2026-11-01 KST). 학습일 계산 · 쓰기가 없다.
// learningActivity는 fsrsScheduler(→ ts-fsrs)를 정적으로 불러서, AuthContext가 마운트 때 쓰는 이 함수 때문에 그 모듈을 부르면
// 루트 레이아웃 첫 JS(모든 화면)에 FSRS 엔진이 실렸다. learningActivity가 그대로 다시 내보낸다(부르는 곳 · 시험은 그대로).
// profiles 쓰기(명시적 로그인 기록 recordExplicitProfileLogin)는 learningActivity에 그대로 둔다 — 쓰기 재고(profilesPrivacy.test.js)의 자리.
// 계약 authFirstLoad.test.js · 동작은 learningActivity.test.js · profileReadShare.test.js.

/**
 * 앱의 실제 login 처리와 독립된 SELECT-only 프로필 갱신. 계정 변경·후착 응답을 버린다.
 *
 * 공유(PROFILE-READ-SHARE-001, 2026-10-17 KST): refresh(actorId, { share: true })는 같은 계정의 **진행 중**이고 **가장 최근**
 * (세대가 그대로인) 읽기가 있으면 새로 보내지 않고 그 결과를 같이 받는다. 세션 경로(getSession · 인증 알림)만 쓴다 —
 * 페이지 로드마다 두 경로가 몇 ms 차이로 같은 select('*')를 보냈다. share가 없는 refresh는 「쓰기 뒤 재읽기」로 보고 늘 새로 읽는다 —
 * 그 읽기가 진행 중 자리를 차지하고 세대를 올리므로, 쓰기 전에 시작된 읽기에는 이후 누구도 합류하지 않는다(쓰기 경계 뒤 읽기만 공유).
 * 세대 검사는 그대로다: 새 읽기 · invalidate가 앞선 읽기의 결과를 버리고, invalidate는 진행 중 읽기도 공유 대상에서 뺀다.
 * 경쟁 순서 표 = __tests__/profileReadShare.test.js 머리말.
 */
export function createProfileReadOnlyRefresh({ getActor, read, onProfile }) {
  let generation = 0, inflight = null;
  async function load(actorId, request) {
    let response;
    try { response = await read(actorId); }
    catch (error) {
      if (request !== generation || getActor() !== actorId) return null;
      throw error;
    }
    const { data, error } = response;
    if (request !== generation || getActor() !== actorId) return null;
    if (error && error.code !== 'PGRST116') throw error;
    if (data && data.id !== actorId) throw new Error('profile_actor_mismatch');
    const profile = error ? null : data ?? null;
    onProfile(profile, actorId);
    return profile;
  }
  return {
    invalidate() { generation += 1; inflight = null; },
    async refresh(actorId, { share = false } = {}) {
      if (!actorId || getActor() !== actorId) return null;
      if (share && inflight && inflight.actorId === actorId && inflight.request === generation) return inflight.promise;
      const request = ++generation;
      const entry = { actorId, request, promise: null };
      entry.promise = load(actorId, request).finally(() => { if (inflight === entry) inflight = null; });
      inflight = entry;
      return entry.promise;
    },
  };
}
