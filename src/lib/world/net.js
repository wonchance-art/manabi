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

export function createWorldNet({ userId, name, pet, channelName = 'world-plaza' }) {
  const peers = new Map();        // peerId -> {x,y,dir,name,pet,at}
  let channel = null;
  let peersCb = null;
  let peerLeftCb = null;
  let signalCb = null;

  const emitPeers = () => { if (peersCb) peersCb(new Map(peers)); };

  const flushState = createThrottle((state) => {
    if (!channel) return;
    channel.send({ type: 'broadcast', event: 'pos', payload: { id: userId, ...state } });
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

  async function join() {
    if (channel) return;
    channel = supabase.channel(channelName, {
      config: { presence: { key: userId }, broadcast: { self: false } },
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

    await new Promise((resolve, reject) => {
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try { await channel.track({ name, pet }); } catch { /* track 실패는 조용히 */ }
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(new Error(`world-net subscribe failed: ${status}`));
        }
      });
    });
  }

  function leave() {
    flushState.cancel();
    if (channel) {
      try { channel.unsubscribe(); } catch { /* noop */ }
      try { supabase.removeChannel?.(channel); } catch { /* noop */ }
      channel = null;
    }
    peers.clear();
  }

  function sendState(state) { flushState(state); }
  function onPeers(cb) { peersCb = cb; }
  function onPeerLeft(cb) { peerLeftCb = cb; }
  function sendSignal(toPeerId, payload) {
    if (!channel) return;
    channel.send({ type: 'broadcast', event: 'rtc', payload: { to: toPeerId, from: userId, payload } });
  }
  function onSignal(cb) { signalCb = cb; }

  return { join, leave, sendState, onPeers, onPeerLeft, sendSignal, onSignal };
}
