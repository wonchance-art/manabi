// 학습 월드 — 도트 채팅 전송 모듈 (Supabase Realtime broadcast 기반)
//
// net.js(멀티 좌표·음성)와 완전히 독립된 자체 채널 'world-chat' 을 연다. 좌표·presence 는
// 건드리지 않고 broadcast 'chat' 이벤트로 텍스트만 실어 나른다. 저장은 없다(세션 로그만).
//
// self:false — 서버 에코를 받지 않는다. 내 메시지는 send() 가 로컬로 즉시 emit 해 반응성을
// 확보하고(로컬 에코), 원격 수신분만 채널로 들어온다. 자기 userId 수신분은 방어적으로 버린다.
//
// 가드: 최대 120자 · 초당 2건 스로틀(슬라이딩 윈도우) · 빈 문자열 무시.
// 연결 실패는 조용히 — onStatus('connecting') 로만 알린다(호출부가 "연결 중…" 표기).
//
// 순수 헬퍼(sanitizeChatText·rateGate·normalizeMessage)는 export 해 유닛 테스트한다.
import { supabase } from '../supabase';

export const CHAT_MAX_LEN = 120;         // 메시지 최대 길이(초과분 컷)
export const CHAT_RATE_LIMIT = 2;        // 윈도우당 최대 전송 건수
export const CHAT_RATE_WINDOW_MS = 1000; // 스로틀 윈도우(초당 2건)
export const CHAT_NAME_MAX = 24;         // 화자명 표시 상한
const CHANNEL = 'world-chat';

// ── 순수 헬퍼 (테스트 대상) ──────────────────────────────────────

// 입력 정제 — 개행·중복 공백을 한 칸으로 접고 trim, 120자 컷. 빈 문자열이면 null.
// (대화창은 한 줄 흐름이라 개행을 공백으로 눕힌다.)
export function sanitizeChatText(raw) {
  if (typeof raw !== 'string') return null;
  const t = raw.replace(/\s+/g, ' ').trim();
  if (!t) return null;
  return t.length > CHAT_MAX_LEN ? t.slice(0, CHAT_MAX_LEN) : t;
}

// 슬라이딩 윈도우 스로틀 판정(순수). recent(전송 시각 배열)에서 window 안 건수가 limit
// 미만이면 허용하고, now 를 더한 새 목록을 함께 돌려준다(불변). 거부 시 목록만 정리해 반환.
export function rateGate(recent, now, limit = CHAT_RATE_LIMIT, windowMs = CHAT_RATE_WINDOW_MS) {
  const kept = (recent || []).filter((t) => now - t < windowMs);
  if (kept.length >= limit) return { allowed: false, recent: kept };
  return { allowed: true, recent: [...kept, now] };
}

// 수신·발신 공통 메시지 정규화(순수). 필수 필드(userId·text) 없으면 null.
// 화자명은 trim 후 CHAT_NAME_MAX 컷, 비면 '익명'. id·at 은 없으면 생성/보정한다.
export function normalizeMessage(m) {
  if (!m || typeof m !== 'object') return null;
  const text = sanitizeChatText(m.text);
  if (!text) return null;
  const userId = typeof m.userId === 'string' && m.userId ? m.userId : null;
  if (!userId) return null;
  const rawName = typeof m.name === 'string' ? m.name.trim() : '';
  const name = rawName ? rawName.slice(0, CHAT_NAME_MAX) : '익명';
  const at = Number.isFinite(m.at) ? m.at : Date.now();
  const id = typeof m.id === 'string' && m.id ? m.id : makeMessageId(userId, at);
  return { id, userId, name, text, at };
}

function makeMessageId(userId, at) {
  const rand = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${userId}-${at}-${rand}`;
}

// ── 채팅 팩토리 ─────────────────────────────────────────────────
// createWorldChat({ client, userId, name, isMuted }) → { send, onMessage, onStatus, leave }.
// 브라우저에서만 실제 채널을 연다(테스트는 client 를 주입하거나 생략해 순수부만 검증).
//
// isMuted(userId)?: 뮤트 판정 주입(선택). chat.js 는 muteStore 를 직접 import 하지 않고 이 옵션으로만
//   참조한다(테스트 용이 + 의존 최소). 수신 broadcast 에서 isMuted(발신자) 가 true 면 그 메시지를
//   드랍한다 — 로그 미추가이자 bus 'chat:msg'(GameCanvas 말풍선)도 자연히 차단된다. 매 수신 시
//   호출하므로 판정이 최신값(예: muteStore.isMuted)이면 뮤트 토글이 즉시 반영된다. 내 로컬 에코(send)는
//   필터하지 않는다(자기 뮤트 개념 없음).
export function createWorldChat({ client = supabase, userId = null, name = '나', channelName = CHANNEL, isMuted = null } = {}) {
  let channel = null;
  let msgCb = null;
  let statusCb = null;
  let closed = false;
  let sent = [];              // 최근 전송 시각(스로틀 슬라이딩 윈도우)
  let status = 'connecting';  // 'connecting' | 'connected'

  const emitStatus = (s) => { status = s; if (statusCb) statusCb(s); };
  const emitMsg = (m) => { if (m && msgCb) msgCb(m); };

  // 채널 개설 — 실패는 조용히(status='connecting' 유지, 게임은 계속).
  if (userId && client && typeof client.channel === 'function') {
    try {
      channel = client.channel(channelName, {
        config: { private: true, broadcast: { self: false } },
      });
      channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
        if (closed) return;
        const m = normalizeMessage(payload);
        if (!m || m.userId === userId) return; // 자기 메시지는 로컬 에코로 이미 반영됨
        if (typeof isMuted === 'function' && isMuted(m.userId)) return; // 뮤트한 상대는 수신 드랍(말풍선까지 차단)
        emitMsg(m);
      });
      channel.subscribe((s) => {
        if (closed) return;
        if (s === 'SUBSCRIBED') emitStatus('connected');
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') emitStatus('connecting');
      });
    } catch {
      channel = null; // 개설 실패 — 로컬 에코만 동작(송신은 no-op)
    }
  }

  // 전송 — 정제·스로틀 통과분만. 로컬 에코 후 채널로 broadcast(self:false라 서버 에코 없음).
  // 반환: 전송된 정규화 메시지 | null(빈 문자열·스로틀 거부·종료).
  function send(rawText) {
    if (closed) return null;
    const text = sanitizeChatText(rawText);
    if (!text) return null;
    const now = Date.now();
    const gate = rateGate(sent, now);
    if (!gate.allowed) return null;
    sent = gate.recent;
    const msg = normalizeMessage({ id: makeMessageId(userId, now), userId, name, text, at: now });
    if (!msg) return null;
    emitMsg(msg); // 로컬 에코 — 즉시 내 로그에 추가
    try {
      channel?.send({ type: 'broadcast', event: 'chat', payload: msg });
    } catch { /* 재연결 창 송신 실패는 조용히 */ }
    return msg;
  }

  function onMessage(cb) { msgCb = typeof cb === 'function' ? cb : null; }
  // onStatus(cb) — 등록 즉시 현재 상태 1회 통지(초기 'connecting' 반영).
  function onStatus(cb) { statusCb = typeof cb === 'function' ? cb : null; if (statusCb) statusCb(status); }

  function leave() {
    closed = true;
    msgCb = null; statusCb = null;
    if (channel) {
      try { channel.unsubscribe(); } catch { /* noop */ }
      try { client.removeChannel?.(channel); } catch { /* noop */ }
      channel = null;
    }
  }

  return { send, onMessage, onStatus, leave };
}
