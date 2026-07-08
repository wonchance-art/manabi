// 학습 월드 — 근접 음성 (WebRTC 오디오 메시, P2P)
//
// 거리(타일 단위)로 연결을 게이팅한다: VOICE_RADIUS 밖이면 연결 해제,
// 안이면 연결을 수립하고 볼륨을 falloffVolume(거리)로 감쇠한다.
// 마이크가 꺼져 있어도 수신(듣기)은 유지되며, 송신 트랙만 mic 상태를 따른다.
//
// 시그널링은 주입된 sendSignal/onSignal(넷코드)을 통해 오간다.
// glare(동시 offer) 방지: selfId < peerId 쪽만 offerer(사전순).
// STUN 만 사용(무설정) — TURN 없어 일부 대칭형 NAT 은 조용히 실패, status 로만 표출.
//
// 브라우저 전용 API 는 전부 가드해 vitest 에서 순수함수만 임포트 가능하다.

export const VOICE_RADIUS = 6;   // 타일 단위 가청 반경

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

// ── 오디오 메시 팩토리 ───────────────────────────────────────────

export function createVoiceMesh({ selfId, sendSignal, onSignal }) {
  const peers = new Map();   // peerId -> { pc, audioEl, distance, connected, remoteMuted }
  let localStream = null;
  let micOn = false;
  let statusCb = null;
  let destroyed = false;

  const emit = () => {
    if (!statusCb) return;
    statusCb({
      micOn,
      peers: [...peers.entries()].map(([id, p]) => ({
        id,
        connected: !!p.connected,
        volume: p.distance < VOICE_RADIUS ? falloffVolume(p.distance) : 0,
      })),
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
    const peer = { pc: null, audioEl: makeAudioEl(), distance: Infinity, connected: false, remoteMuted: false };
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
    const pc = new RTCPeerConnection(ICE_CONFIG);
    peer.pc = pc;
    pc.addTransceiver('audio', { direction: 'sendrecv' });  // 양방향 m-line 고정 → 재협상 없이 토글
    attachLocalTrack(peer);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        const c = e.candidate.toJSON ? e.candidate.toJSON() : e.candidate;
        sendSignal(peerId, { kind: 'ice', candidate: c });
      }
    };
    pc.ontrack = (e) => {
      if (!peer.audioEl) return;
      peer.audioEl.srcObject = (e.streams && e.streams[0]) || new MediaStream([e.track]);
      if (peer.distance < VOICE_RADIUS) peer.audioEl.volume = falloffVolume(peer.distance);
    };
    pc.onconnectionstatechange = () => {
      peer.connected = pc.connectionState === 'connected';
      emit();   // failed/disconnected 도 여기서 status 로만 표출(조용히 허용)
    };
    return pc;
  }

  async function makeOffer(peerId, peer) {
    const pc = ensurePc(peerId, peer);
    if (!pc) return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal(peerId, { kind: 'offer', sdp: pc.localDescription });
    } catch { /* 조용히 허용 */ }
  }

  async function handleSignal(from, payload) {
    if (!payload || from === selfId) return;
    let peer = peers.get(from);

    if (payload.kind === 'offer') {
      if (!peer) peer = createPeer(from);
      const pc = ensurePc(from, peer);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(payload.sdp);
        attachLocalTrack(peer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal(from, { kind: 'answer', sdp: pc.localDescription });
      } catch { /* noop */ }
    } else if (payload.kind === 'answer') {
      if (peer?.pc) { try { await peer.pc.setRemoteDescription(payload.sdp); } catch { /* noop */ } }
    } else if (payload.kind === 'ice') {
      if (peer?.pc && payload.candidate) {
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
    if (peer.pc) { try { peer.pc.close(); } catch { /* noop */ } peer.pc = null; }
    if (peer.audioEl) peer.audioEl.srcObject = null;
    peer.connected = false;
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
    if (!(dist < VOICE_RADIUS)) {          // 밖(또는 NaN) → 연결 해제/보류
      if (peer) { closePc(peer); peer.distance = dist; }
      emit();
      return;
    }
    if (!peer) peer = createPeer(peerId);
    peer.distance = dist;
    if (isOfferer(selfId, peerId) && !peer.pc) makeOffer(peerId, peer);  // offerer 쪽만 개시
    if (peer.audioEl && peer.pc) peer.audioEl.volume = falloffVolume(dist);
    emit();
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
