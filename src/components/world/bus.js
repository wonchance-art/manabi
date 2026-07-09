// 초경량 이벤트 버스 — 외부 의존 0. 학습 월드(솔로 코어)와 다음 웨이브의
// 멀티/음성 lib가 이 "싱글턴" 하나로만 대화한다(모듈 스코프 = 앱 전역 1개).
//
// 통합 계약 (다음 웨이브가 여기 꽂는다):
//   · 'local:state'  ← GameCanvas가 emit  {x, y, dir}         (내 캐릭터 위치, ~100ms 스로틀)
//   · 'peers:update' → GameCanvas가 on    Map|Object<peerId, {x,y,dir,emoji,nick}>
//                       (원격 플레이어 렌더·보간·이탈 정리. 솔로에선 아무도 emit 안 하므로 무해)
//   · 'peers:dist'   ← GameCanvas가 emit  {peerId: distancePx, …}  (음성 근접용, 매 500ms)
//
// 인게임 즉석 리뷰 계약 (QuestReview가 emit → GameCanvas 연출 · WorldPage 펫 성장):
//   · 'quest:scored' ← QuestReview가 emit  {correct}          (문항 채점마다 — 펫 하트 즉시)
//   · 'quest:done'   ← QuestReview가 emit  {right, total}     (리뷰 완료 — 펫 점프 + 그 자리 성장)
//
// API: on(ev, cb) / off(ev, cb) / emit(ev, data). 그게 전부다.

const listeners = new Map(); // ev(string) -> Set<callback>

function on(ev, cb) {
  if (typeof cb !== 'function') return;
  let set = listeners.get(ev);
  if (!set) { set = new Set(); listeners.set(ev, set); }
  set.add(cb);
}

function off(ev, cb) {
  const set = listeners.get(ev);
  if (!set) return;
  set.delete(cb);
  if (set.size === 0) listeners.delete(ev);
}

function emit(ev, data) {
  const set = listeners.get(ev);
  if (!set) return;
  // 스냅샷 후 순회 — 콜백이 emit 도중 off()를 호출해도 안전.
  for (const cb of [...set]) {
    try { cb(data); } catch { /* 구독자 하나의 오류가 나머지 구독자를 막지 않게 격리 */ }
  }
}

const bus = { on, off, emit };
export default bus;
