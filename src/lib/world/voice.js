// 학습 월드 — 근접 음성 (WebRTC 오디오 메시, P2P)
//
// 거리(타일 단위)로 연결을 게이팅한다: VOICE_RADIUS 밖이면 연결 해제,
// 안이면 연결을 수립하고 볼륨을 falloffVolume(거리)로 감쇠한다.
// 마이크가 꺼져 있어도 수신(듣기)은 유지되며, 송신 트랙만 mic 상태를 따른다.
//
// 시그널링은 주입된 sendSignal/onSignal(넷코드)을 통해 오간다.
// glare(동시 offer) 방지: selfId < peerId 쪽만 offerer(사전순).
// STUN 만 사용(무설정) — TURN 없어 일부 대칭형 NAT 에서 실패하면 status 로 명시 표출.
//
// 브라우저 전용 API 는 전부 가드해 vitest 에서 순수함수만 임포트 가능하다.

export const VOICE_RADIUS = 6;   // 타일 단위 가청 반경(볼륨 감쇠 기준 — 불변)

// 연결 게이팅 히스테리시스: 경계에서의 진동(스래싱)으로 pc 를 붙였다 뗐다 하지 않도록
// 연결 임계(안으로 들어올 때)와 해제 임계(밖으로 나갈 때)를 벌려 둔다.
// 볼륨 감쇠(falloffVolume)는 여전히 VOICE_RADIUS 기준이라, 6~8 밴드에서는
// "연결은 유지되지만 볼륨은 0"인 조용한 상태가 된다.
export const VOICE_CONNECT_RADIUS = VOICE_RADIUS;  // 6타일 이내로 들어오면 연결
export const VOICE_RELEASE_RADIUS = 8;             // 8타일 이상 벗어나면 해제
export const MAX_VOICE_PEERS = 8;                  // full-mesh 상한(거리 가까운 순)

const ICE_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const HAS_WEBRTC =
  typeof window !== 'undefined' && typeof RTCPeerConnection !== 'undefined';

// ── 순수 헬퍼 (테스트 대상) ──────────────────────────────────────

// 거리→볼륨(0~1). 0 에서 1, radius 에서 0. smoothstep 으로 부드럽게 감쇠.
// 범위 밖/비유한값은 0(무음), 0 이하는 1(최대).
export function falloffVolume(dist, radius = VOICE_RADIUS) {
  if (!Number.isFinite(dist) || dist >= radius) return 0;
  if (dist <= 0) return 1;
  const x = 1 - dist / radius;          // 1 @0 → 0 @radius
  return x * x * (3 - 2 * x);           // smoothstep
}

// glare 방지용 offerer 판정: 사전순으로 앞선 쪽만 offer 를 낸다.
export function isOfferer(selfId, peerId) {
  return String(selfId) < String(peerId);
}

// 근접 음성 연결 게이트 판정(순수, 히스테리시스).
// wasOn: 현재 연결(또는 연결 시도) 중인가. dist: 타일 거리.
//   · 연결 임계 미만        → 켠다(true)
//   · 해제 임계 이상/비유한  → 끈다(false)
//   · 그 사이(밴드)         → 직전 상태 유지(wasOn) — 경계 진동 흡수
export function voiceGate(wasOn, dist, connectR = VOICE_CONNECT_RADIUS, releaseR = VOICE_RELEASE_RADIUS) {
  if (!Number.isFinite(dist)) return false;
  if (dist >= releaseR) return false;
  if (dist < connectR) return true;
  return !!wasOn;
}

// 시그널 세대(epoch) 일치 판정(순수). 오래된 offer 에 대한 answer/ice 가
// 재생성된 새 pc 에 적용되는 레이스를 막는다. 한쪽이라도 세대 정보가 없으면
// (구버전 호환) 통과시키고, 둘 다 있으면 동일할 때만 수락한다.
export function epochMatches(currentEpoch, signalEpoch) {
  if (signalEpoch == null || currentEpoch == null) return true;
  return signalEpoch === currentEpoch;
}

// WebRTC 연결/ICE 상태를 UI 계약으로 정규화한다. 일시적인 disconnected 는
// 브라우저가 스스로 복구할 수 있으므로 실패로 단정하지 않고, 명시적 failed 만
// TURN 부재 등으로 도달 불가한 상태로 표출한다.
export function voiceConnectionStatus(connectionState, iceConnectionState) {
  if (connectionState === 'failed' || iceConnectionState === 'failed') return 'voice-unreachable';
  if (
    connectionState === 'connected'
    || iceConnectionState === 'connected'
    || iceConnectionState === 'completed'
  ) return 'connected';
  return 'connecting';
}

// full-mesh 연결 대상을 거리 가까운 순으로 제한한다. active 는 이미 선택돼
// 히스테리시스 밴드(6~8타일)에 있는 peer 를 유지할지 판단하는 데 사용한다.
// 동거리에서는 id 사전순으로 고정해 호출 순서와 무관한 결정성을 보장한다.
export function selectVoicePeerIds(candidates, limit = MAX_VOICE_PEERS) {
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  return (Array.isArray(candidates) ? candidates : [])
    .filter((candidate) => (
      candidate
      && candidate.id != null
      && voiceGate(candidate.active, candidate.distance)
    ))
    .sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      const aId = String(a.id);
      const bId = String(b.id);
      return aId < bId ? -1 : aId > bId ? 1 : 0;
    })
    .slice(0, safeLimit)
    .map((candidate) => candidate.id);
}

// ── 오디오 메시 팩토리 ───────────────────────────────────────────

export function createVoiceMesh({ selfId, sendSignal, onSignal }) {
  const peers = new Map();   // peerId -> { pc, audioEl, distance, connected, remoteMuted }
  let localStream = null;
  let micOn = false;
  let statusCb = null;
  let destroyed = false;

  const emit = () => {
    if (!statusCb) return;
    const peerStatuses = [...peers.entries()].map(([id, p]) => ({
      id,
      connected: !!p.connected,
      status: p.status,
      volume: p.distance < VOICE_RADIUS ? falloffVolume(p.distance) : 0,
    }));
    statusCb({
      micOn,
      status: peerStatuses.some((p) => p.status === 'voice-unreachable')
        ? 'voice-unreachable'
        : 'voice-ready',
      peers: peerStatuses,
    });
  };

  function makeAudioEl() {
    if (typeof document === 'undefined') return null;
    const el = document.createElement('audio');
    el.autoplay = true;
    el.setAttribute('playsinline', '');
    el.playsInline = true;
    el.style.display = 'none';
    (document.body || document.documentElement)?.appendChild(el);
    return el;
  }

  function createPeer(peerId) {
    // epoch: 이 peer 로 만든 pc 세대 카운터. sessionEpoch: 현재 협상 세션의 세대
    //   (오퍼러는 자신의 pc 세대, 앤서러는 받은 offer 의 세대) — 오가는 시그널에 실어
    //   불일치 시 무시한다.
    const peer = {
      pc: null, audioEl: null, distance: Infinity,
      connected: false, remoteMuted: false, epoch: 0, sessionEpoch: null,
      selected: false, pendingOffer: null, status: 'connecting',
    };
    peers.set(peerId, peer);
    return peer;
  }

  // 현재 mic 상태에 맞춰 송신 트랙을 붙이거나(replaceTrack) 뗀다. 재협상 불필요.
  function attachLocalTrack(peer) {
    if (!peer.pc) return;
    const track = localStream ? localStream.getAudioTracks()[0] || null : null;
    const sender = peer.pc.getSenders().find((s) => !s.track || s.track.kind === 'audio');
    if (sender) { try { sender.replaceTrack(track); } catch { /* noop */ } }
  }

  function ensurePc(peerId, peer) {
    if (peer.pc || !HAS_WEBRTC) return peer.pc;
    peer.epoch = (peer.epoch || 0) + 1;   // 새 pc → 세대 증가(재생성 시 이전 세대 시그널 무효화)
    const pc = new RTCPeerConnection(ICE_CONFIG);
    peer.pc = pc;
    peer.status = 'connecting';
    if (!peer.audioEl) peer.audioEl = makeAudioEl();
    pc.addTransceiver('audio', { direction: 'sendrecv' });  // 양방향 m-line 고정 → 재협상 없이 토글
    attachLocalTrack(peer);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        const c = e.candidate.toJSON ? e.candidate.toJSON() : e.candidate;
        sendSignal(peerId, { kind: 'ice', candidate: c, epoch: peer.sessionEpoch });
      }
    };
    pc.ontrack = (e) => {
      if (!peer.audioEl) return;
      peer.audioEl.srcObject = (e.streams && e.streams[0]) || new MediaStream([e.track]);
      if (peer.distance < VOICE_RADIUS) peer.audioEl.volume = falloffVolume(peer.distance);
    };
    const updateConnectionStatus = () => {
      if (peer.pc !== pc) return;   // close/rebalance 뒤 늦은 구 pc 이벤트 무시
      peer.status = voiceConnectionStatus(pc.connectionState, pc.iceConnectionState);
      peer.connected = peer.status === 'connected';
      emit();
    };
    pc.onconnectionstatechange = updateConnectionStatus;
    pc.oniceconnectionstatechange = updateConnectionStatus;
    return pc;
  }

  async function makeOffer(peerId, peer) {
    const pc = ensurePc(peerId, peer);
    if (!pc) return;
    peer.sessionEpoch = peer.epoch;   // 오퍼러: 이번 pc 세대를 세션 세대로 고정
    try {
      const offer = await pc.createOffer();
      if (destroyed || peer.pc !== pc || !peer.selected) return;
      await pc.setLocalDescription(offer);
      if (destroyed || peer.pc !== pc || !peer.selected) return;
      sendSignal(peerId, { kind: 'offer', sdp: pc.localDescription, epoch: peer.sessionEpoch });
    } catch { /* 조용히 허용 */ }
  }

  async function acceptOffer(from, peer, payload) {
    // 과거 세대 offer(재협상 이후 뒤늦게 도착)는 무시 — 세션 세대를 되돌리지 않는다.
    if (payload.epoch != null && peer.sessionEpoch != null && payload.epoch < peer.sessionEpoch) return;
    const pc = ensurePc(from, peer);
    if (!pc) return;
    if (payload.epoch != null) peer.sessionEpoch = payload.epoch;   // 앤서러: 오퍼러의 세대 채택
    try {
      await pc.setRemoteDescription(payload.sdp);
      if (destroyed || peer.pc !== pc || !peer.selected) return;
      attachLocalTrack(peer);
      const answer = await pc.createAnswer();
      if (destroyed || peer.pc !== pc || !peer.selected) return;
      await pc.setLocalDescription(answer);
      if (destroyed || peer.pc !== pc || !peer.selected) return;
      sendSignal(from, { kind: 'answer', sdp: pc.localDescription, epoch: peer.sessionEpoch });
    } catch { /* noop */ }
  }

  function rebalancePeers() {
    if (destroyed) return;
    const selectedIds = new Set(selectVoicePeerIds(
      [...peers.entries()].map(([id, peer]) => ({
        id,
        distance: peer.distance,
        active: peer.selected,
      })),
    ));

    for (const [peerId, peer] of peers) {
      const selected = selectedIds.has(peerId);
      peer.selected = selected;
      if (!selected && peer.pc) closePc(peer);
    }

    for (const [peerId, peer] of peers) {
      if (!peer.selected) continue;
      if (peer.pendingOffer) {
        const offer = peer.pendingOffer;
        peer.pendingOffer = null;
        acceptOffer(peerId, peer, offer);
      } else if (isOfferer(selfId, peerId) && !peer.pc) {
        makeOffer(peerId, peer);
      }
    }
    emit();
  }

  async function handleSignal(from, payload) {
    if (destroyed || !payload || from === selfId) return;   // destroy 후 늦은 시그널로 좀비 pc/오디오 생성 차단
    let peer = peers.get(from);

    if (payload.kind === 'offer') {
      if (!peer) peer = createPeer(from);
      peer.pendingOffer = payload;   // 거리 정보 도착 뒤 상위 8명에 들 때만 pc 생성
      rebalancePeers();
    } else if (payload.kind === 'answer') {
      // 오래된 offer 의 answer 가 재생성된 새 pc 에 적용되는 레이스 차단(세대 불일치 무시).
      if (peer?.pc && epochMatches(peer.sessionEpoch, payload.epoch)) {
        try { await peer.pc.setRemoteDescription(payload.sdp); } catch { /* noop */ }
      }
    } else if (payload.kind === 'ice') {
      if (peer?.pc && payload.candidate && epochMatches(peer.sessionEpoch, payload.epoch)) {
        try { await peer.pc.addIceCandidate(payload.candidate); } catch { /* noop */ }
      }
    } else if (payload.kind === 'mute') {
      if (peer) { peer.remoteMuted = true; emit(); }
    } else if (payload.kind === 'unmute') {
      if (peer) { peer.remoteMuted = false; emit(); }
    }
  }

  if (typeof onSignal === 'function') onSignal(handleSignal);

  function closePc(peer) {
    if (peer.pc) {
      const pc = peer.pc;
      peer.pc = null;   // close 이벤트보다 먼저 세대 가드 봉인
      try { pc.close(); } catch { /* noop */ }
    }
    if (peer.audioEl) {
      peer.audioEl.srcObject = null;
      try { peer.audioEl.remove(); } catch { /* noop */ }
      peer.audioEl = null;
    }
    peer.connected = false;
    peer.status = 'connecting';
  }

  // ── 공개 API ──

  async function enableMic() {
    if (!HAS_WEBRTC || typeof navigator === 'undefined' || !navigator.mediaDevices) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStream = stream;
      micOn = true;
      for (const [pid, peer] of peers) { attachLocalTrack(peer); sendSignal(pid, { kind: 'unmute' }); }
      emit();
      return true;
    } catch {
      micOn = false;
      emit();
      return false;   // 거부/예외 삼킴
    }
  }

  function disableMic() {
    if (localStream) { localStream.getTracks().forEach((t) => { try { t.stop(); } catch { /* noop */ } }); localStream = null; }
    micOn = false;
    for (const [pid, peer] of peers) { attachLocalTrack(peer); sendSignal(pid, { kind: 'mute' }); }
    emit();
  }

  function setPeerDistance(peerId, dist) {
    if (peerId === selfId || destroyed) return;
    let peer = peers.get(peerId);
    if (!peer && !voiceGate(false, dist)) {
      return;
    }
    if (!peer) peer = createPeer(peerId);
    peer.distance = dist;
    if (peer.audioEl && peer.pc) peer.audioEl.volume = falloffVolume(dist);
    rebalancePeers();
  }

  function removePeer(peerId) {
    const peer = peers.get(peerId);
    if (!peer) return;
    closePc(peer);
    if (peer.audioEl) { try { peer.audioEl.remove(); } catch { /* noop */ } }
    peers.delete(peerId);
    emit();
  }

  function destroy() {
    destroyed = true;
    if (localStream) { localStream.getTracks().forEach((t) => { try { t.stop(); } catch { /* noop */ } }); localStream = null; }
    for (const [, peer] of peers) {
      closePc(peer);
      if (peer.audioEl) { try { peer.audioEl.remove(); } catch { /* noop */ } }
    }
    peers.clear();
    micOn = false;
    statusCb = null;
  }

  function onStatus(cb) { statusCb = cb; emit(); }

  return { enableMic, disableMic, setPeerDistance, removePeer, destroy, onStatus };
}
