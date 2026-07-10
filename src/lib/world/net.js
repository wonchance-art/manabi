// 학습 월드 — 멀티플레이 넷코드 (Supabase Realtime 기반)
//
// presence 로 참가자 목록/메타(name·pet)를, broadcast 로 좌표(pos)와
// WebRTC 시그널(rtc)을 실어 나른다. 좌표 보간은 캔버스 몫이라 여기선
// 수신값을 그대로 넘기되, 보간용 순수 헬퍼(lerpState)와 송신 스로틀
// (createThrottle)은 export 해 테스트 가능하게 둔다.
//
// 동일 계정 단일 접속은 world_sessions 테이블의 서버 권위 임대(createSessionLease)가
// 판정을 소유한다(P1-2). presence 휴리스틱(shouldYieldDuplicate)은 보조 방어로 유지.
// 중복 판정 시엔 영구 종료 상태(terminated)가 서서 자동 재연결·송수신이 봉인된다(P1-1).
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

// ── 중복 접속(동일 계정 다중 세션) 판정 — 순수 헬퍼 ──────────────
// 같은 userId로 두 세션(다른 기기·탭)이 동시에 presence를 track하면 Supabase Realtime
// presence는 같은 key(userId) 아래 항목을 여러 개(refs) 그대로 들고 있는다(덮어쓰지 않음).
// 그래서 "누가 남고 누가 물러날지"를 양쪽 클라이언트가 서버 개입 없이 독립적으로, 그러나
// 반드시 같은 결론으로 계산해야 한다 — 아래 두 함수가 그 결정 규칙이다.

// presence 항목들 중 "생존자"(먼저 접속한 세션)의 sessionId를 고른다.
// joinedAt 오름차순, 동률이면 sessionId 사전순(완전한 타이브레이커) — 두 세션이 각자
// 계산해도 항상 같은 승자에 도달하도록 결정적이어야 한다.
export function pickSurvivorSessionId(entries) {
  const list = (entries || []).filter((e) => e && e.sessionId);
  if (list.length === 0) return null;
  return list.reduce((best, e) => {
    const a = best.joinedAt ?? 0;
    const b = e.joinedAt ?? 0;
    if (b < a) return e;      // e가 더 이르면 e가 새 최선
    if (b > a) return best;   // best가 더 이르면 유지
    return e.sessionId < best.sessionId ? e : best; // 동률이면 사전순
  }).sessionId;
}

// 같은 presence key(=userId) 아래 나(selfSessionId)와 다른 sessionId가 하나라도 있고,
// 내가 생존자가 아니면 true(물러나야 함— 이 세션이 leave 해야 하는 "나중 세션").
// 재연결 과도기에 서버가 아직 청소하지 못한 내 이전 접속의 잔존 presence 항목이 섞여
// 있어도, sessionId가 재연결 내내 동일하게 유지되므로 "타 세션"으로 오인되지 않는다
// (=자기거부 self-reject 방지). presence_ref는 재연결마다 바뀌므로 판정 기준으로 쓰지 않는다.
export function shouldYieldDuplicate(entries, selfSessionId) {
  if (!selfSessionId) return false;
  const list = (entries || []).filter((e) => e && e.sessionId);
  const hasOther = list.some((e) => e.sessionId !== selfSessionId);
  if (!hasOther) return false;
  return pickSurvivorSessionId(list) !== selfSessionId;
}

// 이 net 인스턴스(브라우저 탭/세션)를 구분하는 로컬 ID. 재연결에도 유지된다.
// world_sessions.session_id 컬럼이 uuid 타입이라 crypto.randomUUID 를 우선 사용한다
// (fallback 문자열은 uuid 가 아니어서 임대 insert 가 거부되고 presence 강등으로 동작).
function makeSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

// ── 서버 권위 세션 임대(world_sessions) — P1-2 ─────────────────────
// 동일 계정 단일 접속의 "판정 소유"를 presence(클라이언트 제공 sessionId·joinedAt)에서
// DB 로 옮긴다: 계정당 임대 1행(world_sessions), 신원은 RLS(auth.uid()), 시각은 DB 에
// 기록된 heartbeat_at. presence 휴리스틱은 보조 방어로만 유지한다.
// 마이그레이션: supabase/migrations/20260710_world_sessions.sql (미적용 시 강등 동작).

export const LEASE_TABLE = 'world_sessions';
// 만료 창: 이 시간 동안 heartbeat 가 없으면 죽은 세션으로 보고 임대를 인수할 수 있다.
// 판정은 조회측(UPDATE 의 WHERE 절) — 청소 잡이 필요 없다.
export const LEASE_TTL_MS = 40000;
// 갱신 주기. TTL(40s)보다 짧지만 2회 연속 유실(50s)이면 임대를 빼앗길 수 있다 —
// 인수 주체는 같은 계정의 다른 세션뿐이고, 빼앗긴 쪽은 다음 heartbeat 의 'lost' 로
// 스스로 물러나므로 두 세션이 동시에 멀티로 남는 일은 없다.
export const LEASE_HEARTBEAT_MS = 25000;

// 임대 클라이언트 팩토리. client 주입으로 테스트 가능(기본은 실제 supabase).
// acquire(): 'acquired' | 'duplicate'(살아있는 타 세션 보유) | 'unavailable'(테이블
// 부재/권한/기타 오류 — presence 휴리스틱으로 강등, UX 가드일 뿐 보안 집행 아님).
export function createSessionLease({ client, userId, sessionId, table = LEASE_TABLE, ttlMs = LEASE_TTL_MS }) {
  const nowIso = () => new Date().toISOString();
  const cutoffIso = () => new Date(Date.now() - ttlMs).toISOString();

  async function acquire() {
    try {
      // ① 원자적 UPDATE — "내 세션이거나(재획득) 만료된 임대"만 덮어쓸 수 있다.
      //    WHERE 절이 곧 원자성 가드: 살아있는 타 세션의 행은 rowcount 0 으로 끝나
      //    "확인 후 탈취" 레이스가 없다(단일 문장, DB 가 직렬화).
      const upd = await client.from(table)
        .update({ session_id: sessionId, heartbeat_at: nowIso() })
        .eq('user_id', userId)
        .or(`session_id.eq.${sessionId},heartbeat_at.lt.${cutoffIso()}`)
        .select('session_id');
      if (upd.error) return 'unavailable';
      if (Array.isArray(upd.data) && upd.data.length > 0) return 'acquired';
      // ② 행이 아예 없으면 INSERT 로 신규 임대. 동시 접속 경합이면 unique 위반(23505).
      const ins = await client.from(table)
        .insert({ user_id: userId, session_id: sessionId, heartbeat_at: nowIso() })
        .select('session_id');
      if (!ins.error) return 'acquired';
      if (ins.error.code !== '23505') return 'unavailable';
      // ③ 살아있는 타 세션이 점유 중이거나 초경합 — 사유 판별.
      //    RLS 상 내 user_id 행만 보이므로 이 SELECT 는 항상 "내 계정의 임대"다.
      const sel = await client.from(table)
        .select('session_id, heartbeat_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (sel.error) return 'unavailable';
      if (sel.data && sel.data.session_id === sessionId) return 'acquired';
      return 'duplicate';
    } catch {
      return 'unavailable';
    }
  }

  // 주기 갱신 — 'ok' | 'lost'(다른 세션이 만료 인수) | 'unavailable'(일시 오류).
  async function heartbeat() {
    try {
      const upd = await client.from(table)
        .update({ heartbeat_at: nowIso() })
        .eq('user_id', userId)
        .eq('session_id', sessionId)
        .select('session_id');
      if (upd.error) return 'unavailable';
      return Array.isArray(upd.data) && upd.data.length > 0 ? 'ok' : 'lost';
    } catch {
      return 'unavailable';
    }
  }

  // 임대 반납 — 내 세션의 행만 지운다(session_id 조건 — 새 세션의 임대는 건드리지 않음).
  async function release() {
    try {
      await client.from(table).delete().eq('user_id', userId).eq('session_id', sessionId);
    } catch { /* 반납 실패는 조용히 — TTL 만료로 자연 회수된다 */ }
  }

  return { acquire, heartbeat, release };
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

export function createWorldNet({ userId, name, pet, channelName = 'world-plaza', client = supabase }) {
  const peers = new Map();        // peerId -> {x,y,dir,name,pet,at}
  let channel = null;
  let peersCb = null;
  let peerLeftCb = null;
  let signalCb = null;
  let statusCb = null;            // onStatus(cb): 'connected'|'reconnecting'|'failed'|'duplicate'

  let reconnectAttempt = 0;       // 연속 실패 횟수(SUBSCRIBED 시 0으로 리셋)
  let reconnectTimer = null;      // 예약된 재구독 타이머
  let closed = false;             // leave() 호출됨 — 모든 재연결 중단
  let joinResolve = null;         // join() Promise 1회성 정착용
  let joinSettled = false;

  // 동일 계정 중복 접속 판정용. sessionId는 이 net 인스턴스 생애 내내(재연결 포함) 고정 —
  // presence_ref(서버가 재연결마다 새로 부여)와 달리 "나"를 일관되게 식별해
  // 재연결 과도기의 내 잔존 presence를 타 세션으로 오인하지 않게 한다.
  const sessionId = makeSessionId();
  const joinedAt = Date.now();
  let duplicateFlagged = false;   // 이번 접속 사이클에서 이미 중복으로 판정·처리됨(재중복 방지)

  // 영구 종료 상태(P1-1). 'duplicate' 가 서면 자동 재연결·모든 송수신이 봉인되고,
  // 사용자의 명시적 join() 재호출만 이 상태를 풀어 임대/중복 재판정을 받는다.
  // (예전엔 duplicateFlagged 만으로 막았는데, unsubscribe 가 유발한 CLOSED 콜백이
  //  scheduleReconnect 를 태워 1초 뒤 새 채널이 열리는 구멍이 있었다 — Codex P1-1.)
  let terminated = null;          // null | 'duplicate'

  // 중복 판정의 소유(P1-2): 'db' = world_sessions 임대(서버 권위), 'presence' = 강등.
  let leaseMode = null;
  let heartbeatTimer = null;
  const lease = createSessionLease({ client, userId, sessionId });

  const emitPeers = () => { if (peersCb) peersCb(new Map(peers)); };
  const setStatus = (s, info) => { if (statusCb) statusCb(s, info); };

  const flushState = createThrottle((state) => {
    if (!channel || closed || terminated) return;
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
    const ch = client.channel(channelName, {
      config: { private: true, broadcast: { self: false }, presence: { key: userId } },
    });
    channel = ch;

    ch.on('broadcast', { event: 'pos' }, ({ payload }) => {
      if (ch !== channel) return;          // teardown 후 잔존 콜백 무시
      if (!payload || payload.id === userId) return;
      const prev = peers.get(payload.id) || {};
      peers.set(payload.id, {
        x: payload.x, y: payload.y, dir: payload.dir,
        name: prev.name, pet: prev.pet, at: Date.now(),
      });
      emitPeers();
    });

    ch.on('broadcast', { event: 'rtc' }, ({ payload }) => {
      if (ch !== channel) return;
      if (!payload || payload.to !== userId) return;   // 내 앞으로 온 것만
      if (signalCb) signalCb(payload.from, payload.payload);
    });

    ch.on('presence', { event: 'sync' }, () => {
      if (ch !== channel) return;
      const state = safePresenceState();
      if (checkDuplicate(state)) return;   // 중복 판정되면 peers 반영 없이 즉시 종료
      for (const key of Object.keys(state)) mergePresence(key, state[key]?.[0]);
      emitPeers();
    });
    ch.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      if (ch !== channel) return;
      mergePresence(key, newPresences?.[0]);
      emitPeers();
    });
    ch.on('presence', { event: 'leave' }, ({ key }) => {
      if (ch !== channel) return;
      if (peers.delete(key) && peerLeftCb) peerLeftCb(key);
      emitPeers();
    });

    // 이전 세대 채널의 상태 콜백(특히 unsubscribe 가 유발하는 CLOSED)이 새 상태기계를
    // 건드리지 못하게 세대(ch)를 캡처해 최신 채널의 콜백만 통과시킨다 — P1-1 의 재발 방지.
    ch.subscribe((status) => {
      if (ch !== channel) return;
      onSubscribeStatus(status);
    });
  }

  // subscribe 상태 전이 처리(핵심 장애 복구 로직).
  //   SUBSCRIBED                          → (중복 아니면) 'connected', 백오프 리셋, presence track
  //   CHANNEL_ERROR/TIMED_OUT/CLOSED      → 백오프 재구독 예약('reconnecting'),
  //                                         MAX 초과 시 'failed'(솔로)
  function onSubscribeStatus(status) {
    if (closed || terminated) return;   // 영구 종료 후의 CLOSED/에러 콜백은 재연결을 못 태운다(P1-1)
    if (status === 'SUBSCRIBED') {
      reconnectAttempt = 0;
      clearReconnect();
      // 선체크(최선노력): presence_state가 이미 도착해 있으면 track 없이 즉시 판정해
      // 중복 세션이 잠깐이라도 서로에게 노출되는 창을 줄인다. 다만 Realtime 클라이언트는
      // join 'ok' 응답과 presence_state 메시지의 도착 순서를 계약으로 보장하지 않으므로
      // (둘 다 같은 소켓 위 별개 메시지) 이 시점엔 아직 비어 있을 수 있다 — 그런 경우
      // 아래에서 무조건 track 하고, 이후 presence 'sync' 핸들러(위)의 지속 검사가
      // 방어적으로 중복을 잡아낸다(판정 소유는 DB 임대 — leaseMode 참조).
      if (checkDuplicate(safePresenceState())) return;
      // enforcement — WorldPage 가 강등 모드('presence')를 작게 표기하는 데 쓴다.
      setStatus('connected', { enforcement: leaseMode === 'db' ? 'lease' : 'presence' });
      trackPresence();
      settleJoin();
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      scheduleReconnect();
      settleJoin();   // 최초 시도 실패도 caller(join)를 막지 않고 솔로로 진행시킨다
    }
    // 'CLOSING' 등 그 외 상태는 무시.
  }

  // 내 presence 메타(name·pet·sessionId) 게시. Supabase track()은 reject 외에도
  // 'timed out'/'error' 를 정상 resolve 로 돌려줄 수 있으므로(Codex P2-3) 반환값을
  // 검사해 실패면 기존 백오프 재구독 경로로 태운다 — presence 없이 pos/RTC 만 흐르는
  // 유령 연결을 'connected' 로 방치하지 않는다.
  function trackPresence() {
    const ch = channel;
    if (!ch) return;
    const fail = () => {
      if (ch !== channel || closed || terminated) return;   // 이미 다른 세대/종료면 무시
      scheduleReconnect();   // 'reconnecting' 상태 반영 + 백오프 후 재구독(재시도 시 다시 track)
    };
    try {
      Promise.resolve(ch.track({ name, pet, sessionId, joinedAt }))
        .then((res) => { if (res != null && res !== 'ok') fail(); })
        .catch(fail);
    } catch { fail(); }
  }

  function safePresenceState() {
    try { return channel.presenceState(); } catch { return {}; }
  }

  // presence 휴리스틱 중복 검사 — 보조 방어. 판정 소유는 DB 임대(join 의 lease.acquire)지만,
  // 임대 성공 후에도 presence 에서 타 세션이 보이면(강등 모드의 상대 세션·초경합 등)
  // 방어적으로 양보한다. 같은 계정(userId) 아래 내(sessionId)가 생존자가 아니면 즉시 물러남.
  function checkDuplicate(state) {
    if (terminated || duplicateFlagged) return true;
    const mine = (state && state[userId]) || [];
    if (!shouldYieldDuplicate(mine, sessionId)) return false;
    markDuplicate();
    return true;
  }

  // 중복 판정 → 영구 종료(P1-1). 자동 재연결(backoff)은 걸지 않는다 — 이건 네트워크
  // 장애가 아니라 정책적 거부라서, 사용자가 명시적으로 재시도(join() 재호출)해야 임대와
  // 중복 판정을 다시 받는다. terminated 가 서 있는 동안에는:
  //   ① scheduleReconnect·onSubscribeStatus 가 단락되어 새 채널이 생기지 않고
  //   ② sendState/sendSignal 이 no-op 이며
  //   ③ channel 참조가 정리되어 join() 재호출이 정상 동작한다(channel===null 가드 통과).
  function markDuplicate() {
    duplicateFlagged = true;
    terminated = 'duplicate';
    clearReconnect();
    stopHeartbeat();
    reconnectAttempt = 0;
    teardownChannel();
    peers.clear();
    emitPeers();          // 남아있던 원격 캐릭터 표시 정리
    lease.release();      // 방어적 양보 시 상대가 임대를 이어받을 수 있게 내 행 반납(실패 무시)
    setStatus('duplicate');
    settleJoin();          // join() 대기자를 막지 않음(솔로로 진행)
  }

  function clearReconnect() {
    if (reconnectTimer != null) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  }

  function stopHeartbeat() {
    if (heartbeatTimer != null) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  }

  // 임대 유지(P1-2). 25초마다 heartbeat_at 갱신 — 'lost' 면 다른 세션이 만료 인수한
  // 것이므로 서버 권위 판정에 따라 이 세션이 물러난다. 일시 오류('unavailable')는
  // 다음 주기에 재시도(TTL 40초 안이면 임대 유지).
  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (closed || terminated) return;
      lease.heartbeat()
        .then((r) => {
          if (closed || terminated) return;
          if (r === 'lost') markDuplicate();
        })
        .catch(() => { /* 다음 주기에 재시도 */ });
    }, LEASE_HEARTBEAT_MS);
  }

  function scheduleReconnect() {
    if (closed || terminated || reconnectTimer != null) return;
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
    const ch = channel;
    channel = null;   // 먼저 참조를 끊어 unsubscribe 가 유발하는 CLOSED 콜백이 세대 검사에 걸리게 한다
    try { ch.unsubscribe(); } catch { /* noop */ }
    try { client.removeChannel?.(ch); } catch { /* noop */ }
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
    duplicateFlagged = false;        // 재시도(수동 join 재호출) 시 중복 판정을 다시 받는다
    terminated = null;               // 영구 종료 해제 — 명시적 재시도만 여기를 지난다
    // ── 서버 권위 임대(P1-2): 채널을 열기 전에 DB 임대부터 획득한다.
    //    살아있는 다른 세션이 임대를 보유하면 채널을 아예 열지 않고 물러난다 —
    //    presence 휴리스틱과 달리 신원(RLS)·시각(DB heartbeat)을 클라이언트가 못 만진다.
    const acquired = await lease.acquire();
    if (closed) { lease.release(); return; }   // acquire 대기 중 leave 된 경우
    if (acquired === 'duplicate') {
      markDuplicate();
      return;                        // 솔로로 진행 — 배너의 "다시 시도"가 join() 을 재호출한다
    }
    // 'unavailable' — 테이블 미적용(42P01 등)/권한 오류: 현행 presence 휴리스틱으로 강등.
    // ⚠️ 강등 모드는 UX 가드일 뿐 보안 집행이 아니다(변조 클라이언트를 막지 못함).
    //    supabase/migrations/20260710_world_sessions.sql 적용 시 자동으로 서버 권위가 된다.
    leaseMode = acquired === 'acquired' ? 'db' : 'presence';
    if (leaseMode === 'db') startHeartbeat();
    await new Promise((resolve) => { joinResolve = resolve; openChannel(); });
  }

  function leave() {
    closed = true;
    clearReconnect();
    stopHeartbeat();
    flushState.cancel();
    teardownChannel();
    lease.release();   // 자기 행 반납(비동기·실패 무시) — 실패해도 TTL 40초로 자연 만료
    peers.clear();
    // 콜백 참조 정리 — leave 후 잔존 콜백이 재사용/오인되지 않도록 끊는다.
    peersCb = null;
    peerLeftCb = null;
    signalCb = null;
    statusCb = null;
  }

  // 송신 API — terminated(중복 퇴장) 동안은 no-op(P1-1 ②: 봉인).
  function sendState(state) {
    if (closed || terminated) return;
    flushState(state);
  }
  function onPeers(cb) { peersCb = cb; }
  function onPeerLeft(cb) { peerLeftCb = cb; }
  function sendSignal(toPeerId, payload) {
    if (!channel || closed || terminated) return;
    try {
      channel.send({ type: 'broadcast', event: 'rtc', payload: { to: toPeerId, from: userId, payload } });
    } catch { /* 재연결 창에서의 시그널 송신 실패는 조용히 */ }
  }
  function onSignal(cb) { signalCb = cb; }
  // 연결 상태 알림 구독(추가 API, 하위호환).
  // cb(status, info?) — status: 'connected'|'reconnecting'|'failed'|'duplicate'.
  // 'connected' 의 info.enforcement: 'lease'(world_sessions 서버 권위) | 'presence'
  //   (테이블 미적용 강등 — UX 가드일 뿐 보안 집행 아님. 호출부는 작게만 표기할 것).
  // 'duplicate' — 같은 계정의 다른 세션이 이미 접속 중이라 이 세션은 멀티를 포기했다(솔로 계속).
  // 자동 재시도하지 않으므로, 호출부가 UI로 안내하고 join()을 재호출해야 다시 시도한다.
  function onStatus(cb) { statusCb = cb; }

  return { join, leave, sendState, onPeers, onPeerLeft, sendSignal, onSignal, onStatus };
}
