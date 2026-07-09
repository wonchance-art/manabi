// 학습 월드 — 멀티플레이 넷코드 (Supabase Realtime 기반)
//
// presence 로 참가자 목록/메타(name·pet)를, broadcast 로 좌표(pos)와
// WebRTC 시그널(rtc)을 실어 나른다. 좌표 보간은 캔버스 몫이라 여기선
// 수신값을 그대로 넘기되, 보간용 순수 헬퍼(lerpState)와 송신 스로틀
// (createThrottle)은 export 해 테스트 가능하게 둔다.
//
// 브라우저에서만 실제 채널을 연다. supabase.js 는 모듈 로드시 env 를
// 요구하므로 테스트는 env 를 스텁한 뒤 동적 import 로 순수부만 가져간다.
import { supabase } from '../supabase';

// ── 순수 헬퍼 (테스트 대상) ──────────────────────────────────────

// 두 상태 사이 선형보간. dir(바라보는 방향)은 이산값이라 중점에서 스냅.
// prev/next 한쪽이 없으면 있는 쪽을 복제해 반환.
export function lerpState(prev, next, t) {
  if (!prev) return next ? { ...next } : null;
  if (!next) return { ...prev };
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  const mix = (a, b) => a + (b - a) * c;
  return {
    x: mix(prev.x ?? 0, next.x ?? 0),
    y: mix(prev.y ?? 0, next.y ?? 0),
    dir: c < 0.5 ? (prev.dir ?? next.dir) : (next.dir ?? prev.dir),
  };
}

// 리딩콜을 허용해도 되는지 판정(순수). lastAt 이 없거나 interval 이 지났으면 true.
export function throttleGate(lastAt, now, interval) {
  return lastAt == null || now - lastAt >= interval;
}

// 재구독 지수 백오프 지연(ms) 산출(순수). attempt 는 0부터의 연속 실패 횟수.
// 1s→2s→4s→8s→16s→30s(상한)로 증가하며 상한을 넘지 않는다.
// base·max 를 열어 두어 테스트에서 시퀀스를 그대로 검증할 수 있게 한다.
export function backoffDelay(attempt, base = 1000, max = 30000) {
  const n = attempt > 0 ? attempt : 0;
  const d = base * 2 ** n;
  return d > max ? max : d;
}

// 리딩+트레일링 스로틀. 마지막 인자는 항상 전송되도록 트레일링 콜을 예약한다.
export function createThrottle(fn, interval) {
  let lastAt = null;
  let timer = null;
  let pending = null;
  const fire = (args) => { lastAt = Date.now(); pending = null; fn(...args); };
  const throttled = (...args) => {
    const now = Date.now();
    if (throttleGate(lastAt, now, interval)) {
      fire(args);
    } else {
      pending = args;
      if (timer == null) {
        const wait = Math.max(0, interval - (now - lastAt));
        timer = setTimeout(() => { timer = null; if (pending) fire(pending); }, wait);
      }
    }
  };
  throttled.cancel = () => {
    if (timer != null) { clearTimeout(timer); timer = null; }
    pending = null;
  };
  return throttled;
}

// ── 넷코드 팩토리 ────────────────────────────────────────────────

// 재구독을 포기하고 솔로로 전환하기 전 최대 연속 시도 횟수.
// 권한 없음/정책 미적용(private 채널 거부)도 CHANNEL_ERROR 로 오므로,
// 무한 재시도 대신 이 횟수를 넘기면 조용히 'failed' → 솔로로 떨어진다.
const MAX_RECONNECT_ATTEMPTS = 6;

export function createWorldNet({ userId, name, pet, channelName = 'world-plaza' }) {
  const peers = new Map();        // peerId -> {x,y,dir,name,pet,at}
  let channel = null;
  let peersCb = null;
  let peerLeftCb = null;
  let signalCb = null;
  let statusCb = null;            // onStatus(cb): 'connected'|'reconnecting'|'failed'

  let reconnectAttempt = 0;       // 연속 실패 횟수(SUBSCRIBED 시 0으로 리셋)
  let reconnectTimer = null;      // 예약된 재구독 타이머
  let closed = false;             // leave() 호출됨 — 모든 재연결 중단
  let joinResolve = null;         // join() Promise 1회성 정착용
  let joinSettled = false;

  const emitPeers = () => { if (peersCb) peersCb(new Map(peers)); };
  const setStatus = (s) => { if (statusCb) statusCb(s); };

  const flushState = createThrottle((state) => {
    if (!channel) return;
    try {
      channel.send({ type: 'broadcast', event: 'pos', payload: { id: userId, ...state } });
    } catch { /* 재연결 창에서의 송신 실패는 조용히 */ }
  }, 100);

  // presence 메타(name·pet)를 반영. 좌표는 pos broadcast 로만 갱신하므로 여기선 유지.
  function mergePresence(key, meta) {
    if (key === userId) return;
    const prev = peers.get(key) || { x: 0, y: 0, dir: 'down', at: 0 };
    peers.set(key, {
      x: prev.x, y: prev.y, dir: prev.dir,
      name: meta?.name ?? prev.name,
      pet: meta?.pet ?? prev.pet,
      at: prev.at || Date.now(),
    });
  }

  // 채널 생성 + 이벤트 바인딩 + 구독. 최초/재구독의 공통 경로다.
  // private: true — Supabase Realtime Authorization(realtime.messages RLS)으로
  // 'world-plaza' 를 관리자 전용으로 잠근다(마이그레이션 참조). 정책 미적용/권한 없으면
  // 구독이 CHANNEL_ERROR 로 거부되고, 아래 상태기계가 조용히 솔로로 떨어뜨린다.
  function openChannel() {
    channel = supabase.channel(channelName, {
      config: { private: true, broadcast: { self: false }, presence: { key: userId } },
    });

    channel.on('broadcast', { event: 'pos' }, ({ payload }) => {
      if (!payload || payload.id === userId) return;
      const prev = peers.get(payload.id) || {};
      peers.set(payload.id, {
        x: payload.x, y: payload.y, dir: payload.dir,
        name: prev.name, pet: prev.pet, at: Date.now(),
      });
      emitPeers();
    });

    channel.on('broadcast', { event: 'rtc' }, ({ payload }) => {
      if (!payload || payload.to !== userId) return;   // 내 앞으로 온 것만
      if (signalCb) signalCb(payload.from, payload.payload);
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      for (const key of Object.keys(state)) mergePresence(key, state[key]?.[0]);
      emitPeers();
    });
    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      mergePresence(key, newPresences?.[0]);
      emitPeers();
    });
    channel.on('presence', { event: 'leave' }, ({ key }) => {
      if (peers.delete(key) && peerLeftCb) peerLeftCb(key);
      emitPeers();
    });

    channel.subscribe((status) => onSubscribeStatus(status));
  }

  // subscribe 상태 전이 처리(핵심 장애 복구 로직).
  //   SUBSCRIBED                          → 'connected', 백오프 리셋, presence 재track
  //   CHANNEL_ERROR/TIMED_OUT/CLOSED      → 백오프 재구독 예약('reconnecting'),
  //                                         MAX 초과 시 'failed'(솔로)
  function onSubscribeStatus(status) {
    if (closed) return;
    if (status === 'SUBSCRIBED') {
      reconnectAttempt = 0;
      clearReconnect();
      setStatus('connected');
      // 재구독 후 내 presence 메타(name·pet) 복원 — track 실패는 조용히.
      try { Promise.resolve(channel.track({ name, pet })).catch(() => {}); } catch { /* noop */ }
      settleJoin();
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      scheduleReconnect();
      settleJoin();   // 최초 시도 실패도 caller(join)를 막지 않고 솔로로 진행시킨다
    }
    // 'CLOSING' 등 그 외 상태는 무시.
  }

  function clearReconnect() {
    if (reconnectTimer != null) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  }

  function scheduleReconnect() {
    if (closed || reconnectTimer != null) return;
    if (reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      setStatus('failed');   // 포기 — 조용히 솔로(권한 실패/영구 장애)
      return;
    }
    const delay = backoffDelay(reconnectAttempt);
    reconnectAttempt += 1;
    setStatus('reconnecting');
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (closed) return;
      teardownChannel();   // 기존(에러난) 채널 정리 후 새 채널로 재구독 — 좀비 핸들러 방지
      openChannel();
    }, delay);
  }

  function teardownChannel() {
    if (!channel) return;
    try { channel.unsubscribe(); } catch { /* noop */ }
    try { supabase.removeChannel?.(channel); } catch { /* noop */ }
    channel = null;
  }

  function settleJoin() {
    if (joinSettled) return;
    joinSettled = true;
    const r = joinResolve;
    joinResolve = null;
    r?.();
  }

  async function join() {
    if (channel || closed) return;   // 이미 열림 / leave 후 재사용 금지
    joinSettled = false;
    await new Promise((resolve) => { joinResolve = resolve; openChannel(); });
  }

  function leave() {
    closed = true;
    clearReconnect();
    flushState.cancel();
    teardownChannel();
    peers.clear();
    // 콜백 참조 정리 — leave 후 잔존 콜백이 재사용/오인되지 않도록 끊는다.
    peersCb = null;
    peerLeftCb = null;
    signalCb = null;
    statusCb = null;
  }

  function sendState(state) { flushState(state); }
  function onPeers(cb) { peersCb = cb; }
  function onPeerLeft(cb) { peerLeftCb = cb; }
  function sendSignal(toPeerId, payload) {
    if (!channel) return;
    try {
      channel.send({ type: 'broadcast', event: 'rtc', payload: { to: toPeerId, from: userId, payload } });
    } catch { /* 재연결 창에서의 시그널 송신 실패는 조용히 */ }
  }
  function onSignal(cb) { signalCb = cb; }
  // 연결 상태 알림 구독(추가 API, 하위호환). cb('connected'|'reconnecting'|'failed').
  function onStatus(cb) { statusCb = cb; }

  return { join, leave, sendState, onPeers, onPeerLeft, sendSignal, onSignal, onStatus };
}
