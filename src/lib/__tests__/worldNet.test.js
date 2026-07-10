import { describe, it, expect, vi } from 'vitest';

// net.js → supabase.js 가 모듈 로드 시 env 를 요구하므로 스텁 후 동적 import.
// (여기서 검증하는 건 순수부: lerpState·throttleGate·createThrottle)
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
const {
  lerpState, throttleGate, createThrottle, backoffDelay,
  pickSurvivorSessionId, shouldYieldDuplicate,
  createWorldNet, createSessionLease, LEASE_HEARTBEAT_MS, LEASE_TTL_MS,
} = await import('../world/net.js');

// voice.js 는 supabase 무관 + 브라우저 API 가드 → 정적 import 로 순수부 사용.
import {
  falloffVolume, isOfferer, VOICE_RADIUS,
  voiceGate, epochMatches, VOICE_CONNECT_RADIUS, VOICE_RELEASE_RADIUS,
} from '../world/voice.js';

// ─────────────────────────────────────────────────────────────
describe('lerpState — 좌표 보간(순수)', () => {
  it('중점(t=0.5)에서 x·y 를 절반씩 섞는다', () => {
    const r = lerpState({ x: 0, y: 10, dir: 'up' }, { x: 10, y: 20, dir: 'down' }, 0.5);
    expect(r.x).toBe(5);
    expect(r.y).toBe(15);
  });

  it('dir 은 이산값이라 중점 기준으로 스냅한다', () => {
    const a = { x: 0, y: 0, dir: 'up' };
    const b = { x: 1, y: 1, dir: 'down' };
    expect(lerpState(a, b, 0.4).dir).toBe('up');    // 전반부 → prev
    expect(lerpState(a, b, 0.6).dir).toBe('down');  // 후반부 → next
  });

  it('t 를 0~1 로 클램프한다', () => {
    const a = { x: 0, y: 0, dir: 'up' };
    const b = { x: 10, y: 0, dir: 'up' };
    expect(lerpState(a, b, -3).x).toBe(0);
    expect(lerpState(a, b, 5).x).toBe(10);
  });

  it('한쪽이 없으면 있는 쪽을 복제', () => {
    expect(lerpState(null, { x: 2, y: 3, dir: 'l' }, 0.5)).toEqual({ x: 2, y: 3, dir: 'l' });
    expect(lerpState({ x: 4, y: 5, dir: 'r' }, null, 0.5)).toEqual({ x: 4, y: 5, dir: 'r' });
    expect(lerpState(null, null, 0.5)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
describe('throttleGate — 리딩콜 허용 판정(순수)', () => {
  it('lastAt 이 없으면 항상 허용', () => {
    expect(throttleGate(null, 1000, 100)).toBe(true);
  });
  it('interval 이 지나면 허용, 아니면 차단', () => {
    expect(throttleGate(1000, 1050, 100)).toBe(false);  // 50ms 경과
    expect(throttleGate(1000, 1100, 100)).toBe(true);   // 정확히 100ms
    expect(throttleGate(1000, 1200, 100)).toBe(true);   // 초과
  });
});

// ─────────────────────────────────────────────────────────────
describe('createThrottle — 리딩+트레일링 100ms 스로틀', () => {
  it('첫 호출은 즉시 통과, 인터벌 내 반복은 억제', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const t = createThrottle(fn, 100);
    t('a');            // 리딩 → 즉시
    t('b'); t('c');    // 인터벌 내 → 억제(트레일링 예약)
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith('a');
    vi.useRealTimers();
  });

  it('트레일링으로 마지막 인자가 인터벌 뒤 전송된다', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const t = createThrottle(fn, 100);
    t('a');            // 리딩
    t('b'); t('c');    // 마지막 pending = 'c'
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('c');
    vi.useRealTimers();
  });

  it('cancel 은 예약된 트레일링을 취소', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const t = createThrottle(fn, 100);
    t('a'); t('b');
    t.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);  // 리딩만
    vi.useRealTimers();
  });
});

// ─────────────────────────────────────────────────────────────
describe('backoffDelay — 재구독 지수 백오프(순수)', () => {
  it('1s→2s→4s→8s→16s→30s(상한) 시퀀스', () => {
    const seq = [0, 1, 2, 3, 4, 5, 6].map((n) => backoffDelay(n));
    expect(seq).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  });
  it('상한(max)을 절대 넘지 않는다', () => {
    for (const n of [5, 6, 10, 50]) {
      expect(backoffDelay(n)).toBeLessThanOrEqual(30000);
    }
  });
  it('음수 attempt 는 0 으로 취급(첫 지연 = base)', () => {
    expect(backoffDelay(-3)).toBe(1000);
    expect(backoffDelay(0)).toBe(1000);
  });
  it('base·max 를 주면 그대로 반영', () => {
    expect(backoffDelay(0, 500, 4000)).toBe(500);
    expect(backoffDelay(3, 500, 4000)).toBe(4000);   // 500*8=4000 = max
    expect(backoffDelay(4, 500, 4000)).toBe(4000);   // 상한
  });
});

// ─────────────────────────────────────────────────────────────
describe('pickSurvivorSessionId — 동일 계정 중복 접속 생존자 결정(순수)', () => {
  it('joinedAt 이 가장 이른 세션이 생존자', () => {
    const entries = [
      { sessionId: 'b', joinedAt: 200 },
      { sessionId: 'a', joinedAt: 100 },
      { sessionId: 'c', joinedAt: 300 },
    ];
    expect(pickSurvivorSessionId(entries)).toBe('a');
  });

  it('joinedAt 동률이면 sessionId 사전순(결정적 타이브레이커)', () => {
    const entries = [
      { sessionId: 'zzz', joinedAt: 100 },
      { sessionId: 'aaa', joinedAt: 100 },
    ];
    expect(pickSurvivorSessionId(entries)).toBe('aaa');
  });

  it('같은 sessionId 가 여러 항목(재연결 잔존 ref)이어도 한 세션으로 취급', () => {
    const entries = [
      { sessionId: 'me', joinedAt: 100 },
      { sessionId: 'me', joinedAt: 100 },
    ];
    expect(pickSurvivorSessionId(entries)).toBe('me');
  });

  it('빈 목록/sessionId 없는 항목은 무시 — 전부 무시되면 null', () => {
    expect(pickSurvivorSessionId([])).toBeNull();
    expect(pickSurvivorSessionId(null)).toBeNull();
    expect(pickSurvivorSessionId([{ joinedAt: 1 }, {}])).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
describe('shouldYieldDuplicate — 물러나야 하는 세션 판정(순수)', () => {
  it('나 혼자면(다른 sessionId 없음) 물러나지 않는다', () => {
    const entries = [{ sessionId: 'me', joinedAt: 100 }];
    expect(shouldYieldDuplicate(entries, 'me')).toBe(false);
  });

  it('재연결 유예: 내 이전 세션의 잔존 항목이 여러 개여도 sessionId 가 같으면 자기거부 없음', () => {
    // 재연결 과도기 — 서버가 아직 청소 못한 이전 presence_ref + 새 presence_ref가 공존해도
    // sessionId는 재연결 내내 고정이므로 "타 세션"으로 오인되지 않는다.
    const entries = [
      { sessionId: 'me', joinedAt: 100 },   // 이전 접속의 잔존 항목(다른 presence_ref)
      { sessionId: 'me', joinedAt: 100 },   // 재연결 후 새 항목
    ];
    expect(shouldYieldDuplicate(entries, 'me')).toBe(false);
  });

  it('내가 먼저 접속했으면(생존자) 물러나지 않는다', () => {
    const entries = [
      { sessionId: 'me', joinedAt: 100 },
      { sessionId: 'other', joinedAt: 200 },
    ];
    expect(shouldYieldDuplicate(entries, 'me')).toBe(false);
  });

  it('내가 나중에 접속했으면(나중 세션) 물러난다', () => {
    const entries = [
      { sessionId: 'other', joinedAt: 100 },
      { sessionId: 'me', joinedAt: 200 },
    ];
    expect(shouldYieldDuplicate(entries, 'me')).toBe(true);
  });

  it('동시 접속 경합(joinedAt 동률)도 결정적으로 한쪽만 물러난다', () => {
    const entries = [
      { sessionId: 'aaa', joinedAt: 100 },
      { sessionId: 'zzz', joinedAt: 100 },
    ];
    // 사전순 뒤(zzz)가 물러나고, 사전순 앞(aaa)은 남는다 — 양쪽에서 독립 계산해도 동일 결론.
    expect(shouldYieldDuplicate(entries, 'zzz')).toBe(true);
    expect(shouldYieldDuplicate(entries, 'aaa')).toBe(false);
  });

  it('selfSessionId 가 없으면(트랙 전) 판정 보류 — false', () => {
    const entries = [{ sessionId: 'other', joinedAt: 100 }];
    expect(shouldYieldDuplicate(entries, null)).toBe(false);
    expect(shouldYieldDuplicate(entries, undefined)).toBe(false);
  });

  it('entries 가 비어있으면 물러나지 않는다', () => {
    expect(shouldYieldDuplicate([], 'me')).toBe(false);
    expect(shouldYieldDuplicate(null, 'me')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// ── 하네스용 페이크 Supabase 클라이언트 ──
// channel(): Realtime 채널 흉내(핸들러 기록 + 테스트가 상태/이벤트를 수동 발화).
// rpc(): world_sessions SECURITY DEFINER RPC 3종의 서버 의미론을 재현한다 —
//   claim_world_session()·heartbeat_world_session(p_token)·release_world_session(p_token).
//   신원(uid)·시각(Date.now)·토큰을 서버측처럼 판정한다(클라는 토큰만 받는다).
//   rows: user_id -> { session_token, heartbeat_at(ms) }. rpcError 로 오류 주입.
const USER = 'u1';

function createFakeClient({ trackResult = 'ok', rpcError = null, uid = USER } = {}) {
  const channels = [];
  const db = { rows: new Map(), rpcError, calls: [] };
  let tokenSeq = 0;

  function rpc(fn, args) {
    db.calls.push({ fn, args });
    return Promise.resolve().then(() => {
      if (db.rpcError) return { data: null, error: db.rpcError };
      const now = Date.now();
      const row = db.rows.get(uid);
      if (fn === 'claim_world_session') {
        // 살아있는 임대(내것이든 타 세션이든)면 실패(NULL). 없음/만료(60s 초과)면 새 토큰 인수.
        const alive = row && (now - row.heartbeat_at) < LEASE_TTL_MS;
        if (alive) return { data: null, error: null };
        const token = `tok-${uid}-${(tokenSeq += 1)}`;
        db.rows.set(uid, { session_token: token, heartbeat_at: now });
        return { data: token, error: null };
      }
      if (fn === 'heartbeat_world_session') {
        if (row && row.session_token === args?.p_token) { row.heartbeat_at = now; return { data: true, error: null }; }
        return { data: false, error: null };   // 토큰 불일치(만료 인수됨) → 임대 상실
      }
      if (fn === 'release_world_session') {
        if (row && row.session_token === args?.p_token) db.rows.delete(uid);
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });
  }

  return {
    channels,
    db,
    channel(name, opts) {
      const handlers = [];
      const ch = {
        name, opts, sent: [], tracked: [], unsubCount: 0,
        presence: {}, statusCb: null, trackResult,
        on(type, filter, cb) { handlers.push({ type, event: filter?.event, cb }); return ch; },
        subscribe(cb) { ch.statusCb = cb; return ch; },
        send(msg) { ch.sent.push(msg); },
        track(meta) { ch.tracked.push(meta); return Promise.resolve(ch.trackResult); },
        presenceState() { return ch.presence; },
        unsubscribe() { ch.unsubCount += 1; },
        // 테스트 헬퍼
        emitStatus(s) { ch.statusCb?.(s); },
        emit(type, event, arg) { for (const h of handlers) if (h.type === type && h.event === event) h.cb(arg); },
      };
      channels.push(ch);
      return ch;
    },
    removeChannel() {},
    rpc(fn, args) { return rpc(fn, args); },
  };
}

const freshHb = () => Date.now();                       // 살아있는 임대(방금 heartbeat)
const staleHb = () => Date.now() - LEASE_TTL_MS - 20000; // 만료(60s 초과) 임대
// 마이크로태스크 체인(임대 RPC await 연쇄) 소화용.
const flush = async (n = 30) => { for (let i = 0; i < n; i += 1) await Promise.resolve(); };

function makeNet(client) {
  return createWorldNet({ userId: USER, name: '나', pet: '🐶', client });
}

// join → openChannel 까지 진행시키고 마지막 채널에 SUBSCRIBED 를 발화한다.
async function joinAndSubscribe(client, net) {
  const p = net.join();
  await flush();
  const ch = client.channels[client.channels.length - 1];
  ch.emitStatus('SUBSCRIBED');
  await p;
  await flush();
  return ch;
}

// ─────────────────────────────────────────────────────────────
describe('createSessionLease — world_sessions RPC 임대(서버 권위)', () => {
  it('빈 테이블이면 claim 으로 토큰을 획득하고 행이 생긴다', async () => {
    const client = createFakeClient();
    const lease = createSessionLease({ client, userId: USER });
    expect(await lease.claim()).toBe('acquired');
    expect(client.db.rows.has(USER)).toBe(true);
    // 토큰은 서버 발급 — 클라이언트가 지정·예측할 수 없다(밖으로 노출 안 됨).
    expect(client.db.rows.get(USER).session_token).toMatch(/^tok-/);
  });

  it('살아있는 타 세션이 보유하면 duplicate — 행은 그대로(원자 탈취 방지)', async () => {
    vi.useFakeTimers();
    const client = createFakeClient();
    client.db.rows.set(USER, { session_token: 'other-live', heartbeat_at: freshHb() });
    const lease = createSessionLease({ client, userId: USER });
    expect(await lease.claim()).toBe('duplicate');
    expect(client.db.rows.get(USER).session_token).toBe('other-live'); // upsert 0행 — 무손상
    vi.useRealTimers();
  });

  it('만료(60초 초과) 임대는 새 토큰으로 원자적으로 인수한다', async () => {
    vi.useFakeTimers();
    const client = createFakeClient();
    client.db.rows.set(USER, { session_token: 'stale', heartbeat_at: staleHb() });
    const lease = createSessionLease({ client, userId: USER });
    expect(await lease.claim()).toBe('acquired');
    expect(client.db.rows.get(USER).session_token).not.toBe('stale');
    vi.useRealTimers();
  });

  it('함수/테이블 부재(42883·42P01)·스키마캐시 부재(PGRST202)는 unavailable — presence 강등 신호', async () => {
    // PGRST202: PostgREST 가 미배포 RPC 를 DB 오류가 아니라 이 코드로 돌려주는 대표 신호(P2-3).
    for (const code of ['42883', '42P01', 'PGRST202']) {
      const client = createFakeClient({ rpcError: { code, message: 'missing' } });
      const lease = createSessionLease({ client, userId: USER });
      expect(await lease.claim()).toBe('unavailable');
    }
  });

  it('알 수 없는 DB 오류(예: 42501 권한)는 error — fail-closed 신호(P2-5)', async () => {
    const client = createFakeClient({ rpcError: { code: '42501', message: 'permission denied' } });
    const lease = createSessionLease({ client, userId: USER });
    expect(await lease.claim()).toBe('error');
  });

  it('heartbeat: 내 토큰이면 ok, 다른 세션이 인수했으면 lost, 부재는 unavailable·기타 오류는 error', async () => {
    vi.useFakeTimers();
    const client = createFakeClient();
    const lease = createSessionLease({ client, userId: USER });
    await lease.claim();
    expect(await lease.heartbeat()).toBe('ok');
    client.db.rows.get(USER).session_token = 'thief';   // 다른 세션의 만료 인수 시뮬레이트
    expect(await lease.heartbeat()).toBe('lost');
    client.db.rpcError = { code: '42P01' };
    expect(await lease.heartbeat()).toBe('unavailable');
    client.db.rpcError = { code: 'PGRST202' };       // 스키마 캐시 부재도 강등 신호(P2-3)
    expect(await lease.heartbeat()).toBe('unavailable');
    client.db.rpcError = { code: '08006' };
    expect(await lease.heartbeat()).toBe('error');
    vi.useRealTimers();
  });

  it('release 는 내 토큰의 행만 지운다 — 후임 세션의 임대는 못 건드림', async () => {
    const client = createFakeClient();
    const lease = createSessionLease({ client, userId: USER });
    await lease.claim();
    expect(client.db.rows.has(USER)).toBe(true);
    // 후임 세션이 인수(토큰 교체)한 상태 → release 가 남의 임대를 못 지운다
    client.db.rows.get(USER).session_token = 'successor';
    await lease.release();
    expect(client.db.rows.has(USER)).toBe(true);
  });

  it('release 는 토큰이 일치하면 자기 행을 지운다', async () => {
    const client = createFakeClient();
    const lease = createSessionLease({ client, userId: USER });
    await lease.claim();
    await lease.release();
    expect(client.db.rows.has(USER)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
describe('createWorldNet — 임대 통합(획득/충돌/만료 인수/강등/heartbeat/fail-closed)', () => {
  it('임대 획득 → connected(enforcement=lease) + 15초 간격 heartbeat 갱신', async () => {
    vi.useFakeTimers();
    const client = createFakeClient();
    const net = makeNet(client);
    const statuses = [];
    net.onStatus((s, info) => statuses.push([s, info]));
    await joinAndSubscribe(client, net);
    expect(statuses.at(-1)).toEqual(['connected', { enforcement: 'lease' }]);
    expect(client.db.rows.has(USER)).toBe(true);     // 서버가 임대 행을 소유
    const hb0 = client.db.rows.get(USER).heartbeat_at;
    await vi.advanceTimersByTimeAsync(LEASE_HEARTBEAT_MS);
    await flush();
    expect(client.db.rows.get(USER).heartbeat_at).not.toBe(hb0);  // heartbeat RPC 로 갱신됨
    net.leave();
    vi.useRealTimers();
  });

  it('임대 충돌 — 살아있는 타 세션 보유 시 채널을 열지 않고 duplicate 로 물러난다', async () => {
    vi.useFakeTimers();
    const client = createFakeClient();
    client.db.rows.set(USER, { session_token: 'other-live', heartbeat_at: freshHb() });
    const net = makeNet(client);
    const statuses = [];
    net.onStatus((s) => statuses.push(s));
    await net.join();
    await flush();
    expect(statuses).toEqual(['duplicate']);
    expect(client.channels.length).toBe(0);          // 채널 생성 0
    expect(client.db.rows.get(USER).session_token).toBe('other-live'); // 임대 무손상
    await vi.advanceTimersByTimeAsync(60000);        // 자동 재연결 없음
    expect(client.channels.length).toBe(0);
    expect(statuses).toEqual(['duplicate']);
    vi.useRealTimers();
  });

  it('만료 임대 인수 — 죽은 세션(60초 무응답)의 행을 이어받고 정상 접속한다', async () => {
    vi.useFakeTimers();
    const client = createFakeClient();
    client.db.rows.set(USER, { session_token: 'stale', heartbeat_at: staleHb() });
    const net = makeNet(client);
    const statuses = [];
    net.onStatus((s, info) => statuses.push([s, info]));
    await joinAndSubscribe(client, net);
    expect(statuses.at(-1)).toEqual(['connected', { enforcement: 'lease' }]);
    expect(client.db.rows.get(USER).session_token).not.toBe('stale');  // 새 토큰 인수
    net.leave();
    vi.useRealTimers();
  });

  it('강등 — 마이그레이션 미적용(42883) 시 presence 로 connected(enforcement=presence), heartbeat 없음', async () => {
    vi.useFakeTimers();
    const client = createFakeClient({ rpcError: { code: '42883' } });
    const net = makeNet(client);
    const statuses = [];
    net.onStatus((s, info) => statuses.push([s, info]));
    await joinAndSubscribe(client, net);
    expect(statuses.at(-1)).toEqual(['connected', { enforcement: 'presence' }]);
    const callsBefore = client.db.calls.length;      // claim 1회만
    await vi.advanceTimersByTimeAsync(LEASE_HEARTBEAT_MS * 2);
    await flush();
    expect(client.db.calls.length).toBe(callsBefore); // 강등 모드에선 heartbeat 를 돌리지 않는다
    net.leave();
    vi.useRealTimers();
  });

  it('P2-5 fail-closed — 알 수 없는 DB 오류면 멀티 차단(lease-error): 채널 0·presence 강등 없음·재연결 없음', async () => {
    vi.useFakeTimers();
    const client = createFakeClient({ rpcError: { code: '42501', message: 'permission denied' } });
    const net = makeNet(client);
    const statuses = [];
    net.onStatus((s) => statuses.push(s));
    await net.join();
    await flush();
    expect(statuses).toEqual(['lease-error']);        // 강등('connected') 아님 — 멀티 차단
    expect(client.channels.length).toBe(0);           // 채널을 열지 않는다
    await vi.advanceTimersByTimeAsync(60000);
    expect(client.channels.length).toBe(0);           // 자동 재연결 없음
    expect(statuses).toEqual(['lease-error']);
    // 송신 봉인
    net.sendState({ x: 1, y: 2, dir: 'down' });
    net.sendSignal('peer', { sdp: 'x' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(client.channels.length).toBe(0);
    vi.useRealTimers();
  });

  it('heartbeat lost — 다른 세션이 만료 인수하면 이 세션이 스스로 물러난다(서버 권위)', async () => {
    vi.useFakeTimers();
    const client = createFakeClient();
    const net = makeNet(client);
    const statuses = [];
    net.onStatus((s) => statuses.push(s));
    const ch = await joinAndSubscribe(client, net);
    client.db.rows.get(USER).session_token = 'thief';   // 다른 세션의 인수를 시뮬레이트
    await vi.advanceTimersByTimeAsync(LEASE_HEARTBEAT_MS);
    await flush();
    expect(statuses.at(-1)).toBe('duplicate');
    expect(ch.unsubCount).toBe(1);                   // 채널 정리
    expect(client.db.rows.get(USER).session_token).toBe('thief'); // release 가 남의 임대를 못 지움
    await vi.advanceTimersByTimeAsync(60000);        // 재연결 없음
    expect(client.channels.length).toBe(1);
    vi.useRealTimers();
  });

  it('P1 heartbeat 데드라인 — 연속 error(08006)로 (TTL−SAFETY) 경과 시 서버 인수 전 자진 봉인', async () => {
    // Codex 재현: A claim→heartbeat 연속 08006(마이그레이션 미적용 아님 → 강등 금지) →
    // 마지막 성공 이후 데드라인(TTL−SAFETY=55s) 경과 시 서버가 인수할 수 있는 시점(60s) 전에
    // A 가 스스로 lease-error 로 봉인(sent 0). 예전엔 error 를 무기한 무시해 split-brain 이 났다.
    vi.useFakeTimers();
    const client = createFakeClient();               // db 임대 정상 획득
    const net = makeNet(client);
    const statuses = [];
    net.onStatus((s) => statuses.push(s));
    const ch = await joinAndSubscribe(client, net);
    expect(statuses).toEqual(['connected']);
    // 이후 heartbeat 를 연속 실패시킨다 — 08006 은 강등 코드가 아니므로 presence 로 내려가지 않는다.
    client.db.rpcError = { code: '08006', message: 'connection failure' };
    // 15s×3(=45s)까지는 데드라인(55s) 이전 → 한 번의 실패로 물러나지 않고 임대를 견딘다.
    await vi.advanceTimersByTimeAsync(LEASE_HEARTBEAT_MS * 3);
    await flush();
    expect(statuses.at(-1)).toBe('connected');
    expect(client.db.rows.has(USER)).toBe(true);
    // 4번째 주기(t=60s): 마지막 성공 이후 60s > 55s → markLeaseError 로 봉인.
    await vi.advanceTimersByTimeAsync(LEASE_HEARTBEAT_MS);
    await flush();
    expect(statuses.at(-1)).toBe('lease-error');     // 강등('connected') 아님 — 멀티 차단 봉인
    expect(ch.unsubCount).toBe(1);                   // 채널 봉인
    // (release 도 08006 로 실패하므로 행은 서버 TTL 로 자연 회수된다 — A 는 어느 쪽이든 봉인 유지.)
    // 이후 B 가 claim 에 성공해도 A 는 봉인 유지: 자동 재연결·송신 없음.
    net.sendState({ x: 1, y: 2, dir: 'down' });
    net.sendSignal('peer', { sdp: 'x' });
    await vi.advanceTimersByTimeAsync(60000);
    expect(ch.sent.length).toBe(0);                  // 송신 0
    expect(client.channels.length).toBe(1);          // 새 채널 없음
    vi.useRealTimers();
  });

  it('P1-1신 — db 임대 모드에선 위조 presence 로 퇴장하지 않는다(표시 전용)', async () => {
    vi.useFakeTimers();
    const client = createFakeClient();               // 정상 → db 임대(enforcement=lease)
    const net = makeNet(client);
    const statuses = [];
    net.onStatus((s) => statuses.push(s));
    const ch = await joinAndSubscribe(client, net);
    expect(statuses).toEqual(['connected']);
    // Codex 스푸핑 하네스: 공격자가 피해자 user ID 를 key 로 이른 joinedAt 을 주입.
    // (예전엔 이 주입이 정상 임대 보유자를 퇴장·반납시켰다 — 역전한 회귀 테스트.)
    ch.presence = { [USER]: [{ sessionId: 'attacker', joinedAt: 0 }] };
    ch.emit('presence', 'sync');
    await flush();
    // 역전된 기대: 퇴장 없음 — 상태 connected 유지·임대 행 유지·채널 유지·재연결 없음.
    expect(statuses).toEqual(['connected']);
    expect(client.db.rows.has(USER)).toBe(true);     // 임대 반납 안 됨
    expect(ch.unsubCount).toBe(0);                   // 채널 유지
    await vi.advanceTimersByTimeAsync(60000);
    expect(client.channels.length).toBe(1);
    net.leave();
    vi.useRealTimers();
  });

  it('강등(presence) 모드에선 위조 presence 휴리스틱이 여전히 집행된다(임대 미적용 유일 방어)', async () => {
    vi.useFakeTimers();
    const client = createFakeClient({ rpcError: { code: '42883' } }); // 미적용 → presence 강등
    const net = makeNet(client);
    const statuses = [];
    net.onStatus((s) => statuses.push(s));
    const ch = await joinAndSubscribe(client, net);
    expect(statuses).toEqual(['connected']);
    ch.presence = { [USER]: [{ sessionId: 'survivor', joinedAt: 0 }] };
    ch.emit('presence', 'sync');
    await flush();
    expect(statuses.at(-1)).toBe('duplicate');       // 강등 모드에선 휴리스틱이 물러나게 한다
    expect(ch.unsubCount).toBe(1);
    vi.useRealTimers();
  });

  it('leave — heartbeat 중단 + 자기 행 반납', async () => {
    vi.useFakeTimers();
    const client = createFakeClient();
    const net = makeNet(client);
    await joinAndSubscribe(client, net);
    net.leave();
    await flush();
    expect(client.db.rows.has(USER)).toBe(false);
    const callsBefore = client.db.calls.length;
    await vi.advanceTimersByTimeAsync(LEASE_HEARTBEAT_MS * 3);
    await flush();
    expect(client.db.calls.length).toBe(callsBefore); // heartbeat 정지
    vi.useRealTimers();
  });

  it('P2-4 join() 연타 — 진행 중이면 같은 Promise, claim 은 한 번만(중복 없음)', async () => {
    // 예전엔 연타 시 둘째 claim 이 발사돼 NULL(중복)을 받고 첫 세션의 토큰을 release 해버렸다.
    // in-flight 가드로 "단일 claim·중복 없음" 으로 역전한다.
    vi.useFakeTimers();
    const client = createFakeClient();
    const net = makeNet(client);
    const statuses = [];
    net.onStatus((s) => statuses.push(s));
    const p1 = net.join();
    const p2 = net.join();               // 연타 — 진행 중이면 같은 Promise
    expect(p2).toBe(p1);
    await flush();
    expect(client.channels.length).toBe(1);   // 채널도 하나만
    const ch = client.channels[0];
    ch.emitStatus('SUBSCRIBED');
    await Promise.all([p1, p2]);
    await flush();
    const claimCalls = client.db.calls.filter((c) => c.fn === 'claim_world_session');
    expect(claimCalls.length).toBe(1);        // 중복 claim 발사 없음
    expect(statuses.at(-1)).toBe('connected');
    expect(client.db.rows.has(USER)).toBe(true); // 첫 토큰이 release 되지 않고 유지
    net.leave();
    vi.useRealTimers();
  });
});

// ─────────────────────────────────────────────────────────────
describe('createWorldNet — P1-1 하네스: 중복 퇴장 후 자동 재연결 봉인', () => {
  // Codex 하네스 재현 시나리오(강등 모드 = 기존 presence 휴리스틱 경로):
  // 예전 코드는 statuses=["duplicate","reconnecting"], 두 번째 채널 sent=1 이었다.
  it('중복 판정 후: 상태 duplicate 유지·재연결 없음·두 번째 채널 0·송신 0', async () => {
    vi.useFakeTimers();
    const client = createFakeClient({ rpcError: { code: '42P01' } }); // 강등 → presence 판정
    const net = makeNet(client);
    const statuses = [];
    net.onStatus((s) => statuses.push(s));
    const p = net.join();
    await flush();
    const ch1 = client.channels[0];
    // 다른 세션(생존자)이 이미 presence 에 있음 → SUBSCRIBED 선체크에서 중복 판정
    ch1.presence = { [USER]: [{ sessionId: 'survivor', joinedAt: 0 }] };
    ch1.emitStatus('SUBSCRIBED');
    await p;
    await flush();
    expect(statuses).toEqual(['duplicate']);
    expect(ch1.unsubCount).toBe(1);
    // unsubscribe 가 유발하는 CLOSED 콜백(예전 구멍) — 재연결을 태우지 못한다
    ch1.emitStatus('CLOSED');
    await vi.advanceTimersByTimeAsync(60000);
    await flush();
    expect(client.channels.length).toBe(1);          // 두 번째 채널 생성 0
    expect(statuses).toEqual(['duplicate']);         // 'reconnecting' 없음 — duplicate 유지
    // 송신 API 봉인 — pos·rtc 모두 no-op
    net.sendState({ x: 1, y: 2, dir: 'down' });
    net.sendSignal('peer', { sdp: 'x' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(ch1.sent.length).toBe(0);
    vi.useRealTimers();
  });

  it('join() 명시 재시도만 상태를 리셋하고 재판정을 받아 정상 재구독한다', async () => {
    vi.useFakeTimers();
    const client = createFakeClient({ rpcError: { code: '42P01' } });
    const net = makeNet(client);
    const statuses = [];
    net.onStatus((s) => statuses.push(s));
    // 1차 join — 중복으로 퇴장
    const p1 = net.join();
    await flush();
    client.channels[0].presence = { [USER]: [{ sessionId: 'survivor', joinedAt: 0 }] };
    client.channels[0].emitStatus('SUBSCRIBED');
    await p1;
    await flush();
    expect(statuses.at(-1)).toBe('duplicate');
    // 2차 join(사용자의 "다시 시도") — 상대가 떠난 상태(presence 비움) → 정상 접속
    const p2 = net.join();
    await flush();
    expect(client.channels.length).toBe(2);          // 명시 재시도에서만 새 채널
    const ch2 = client.channels[1];
    ch2.emitStatus('SUBSCRIBED');
    await p2;
    await flush();
    expect(statuses.at(-1)).toBe('connected');
    // 봉인 해제 — 송신이 다시 흐른다
    net.sendState({ x: 3, y: 4, dir: 'up' });
    expect(ch2.sent.length).toBe(1);
    expect(ch2.sent[0].event).toBe('pos');
    net.leave();
    vi.useRealTimers();
  });
});

// ─────────────────────────────────────────────────────────────
describe('createWorldNet — P2-6: 연속 track 실패 재시도 상한·백오프 봉인', () => {
  // Codex 하네스: 연속 error 7회 후 예전 결과는 channels=8·failed=false·backoff 중 sent=1.
  // (매 SUBSCRIBED 에서 reconnectAttempt=0 리셋 + teardown 지연 탓.) 역전한 기대:
  //   track 성공 전엔 리셋 안 됨 → 상한 도달·failed, teardown 선행 → 백오프 창 송신 0.
  it('연속 track 실패는 상한(MAX)에 쌓여 failed 로 떨어지고 송신은 0(백오프 봉인)', async () => {
    vi.useFakeTimers();
    const client = createFakeClient();             // db 임대 정상 — 실패는 track 에서만
    const net = makeNet(client);
    const statuses = [];
    net.onStatus((s) => statuses.push(s));
    const p = net.join();
    await flush();
    // 매 사이클: 새 채널의 track 을 실패시키고 백오프 창을 넘겨 다음 채널로 재구독.
    for (let i = 0; i < 7; i += 1) {
      const ch = client.channels[client.channels.length - 1];
      ch.trackResult = 'error';
      ch.emitStatus('SUBSCRIBED');
      await flush();
      await vi.advanceTimersByTimeAsync(30000);    // backoff 상한 넘겨 재구독 트리거
      await flush();
    }
    await p.catch(() => {});
    expect(statuses).toContain('failed');          // 상한 도달 — 솔로로 포기
    // 백오프 진입 시 teardown 이 먼저라, 어느 채널로도 pos/RTC 송신이 없었다.
    const totalSent = client.channels.reduce((n, c) => n + c.sent.length, 0);
    expect(totalSent).toBe(0);
    // failed 이후에도 송신은 봉인(채널 없음)
    net.sendState({ x: 1, y: 1, dir: 'down' });
    await flush();
    expect(client.channels.reduce((n, c) => n + c.sent.length, 0)).toBe(0);
    // failed 전환 시 임대 반납(P2-5) — 다른 탭을 막지 않는다
    expect(client.db.rows.has(USER)).toBe(false);
    vi.useRealTimers();
  });
});

// ─────────────────────────────────────────────────────────────
describe('createWorldNet — P2-3: track() resolved 실패 처리', () => {
  async function subscribeWithTrackResult(trackResult) {
    const client = createFakeClient({ trackResult });
    const net = makeNet(client);
    const statuses = [];
    net.onStatus((s) => statuses.push(s));
    await joinAndSubscribe(client, net);
    return { client, net, statuses };
  }

  it("'timed out' 이면 connected 로 방치하지 않고 백오프 재구독을 태운다", async () => {
    vi.useFakeTimers();
    const { client, net, statuses } = await subscribeWithTrackResult('timed out');
    expect(statuses).toEqual(['connected', 'reconnecting']);
    await vi.advanceTimersByTimeAsync(1000);         // backoff(attempt 0) = 1s
    expect(client.channels.length).toBe(2);          // 새 채널로 재구독
    // 재시도에서 track 이 성공하면 connected 로 안착
    const ch2 = client.channels[1];
    ch2.trackResult = 'ok';
    ch2.emitStatus('SUBSCRIBED');
    await flush();
    expect(statuses.at(-1)).toBe('connected');
    await vi.advanceTimersByTimeAsync(30000);
    expect(client.channels.length).toBe(2);          // 안착 후 추가 재구독 없음
    net.leave();
    vi.useRealTimers();
  });

  it("'error' 도 동일하게 재구독 경로로 보낸다", async () => {
    vi.useFakeTimers();
    const { statuses } = await subscribeWithTrackResult('error');
    expect(statuses).toEqual(['connected', 'reconnecting']);
    vi.useRealTimers();
  });

  it("'ok' 는 connected 유지 — 재구독 없음", async () => {
    vi.useFakeTimers();
    const { client, net, statuses } = await subscribeWithTrackResult('ok');
    expect(statuses).toEqual(['connected']);
    await vi.advanceTimersByTimeAsync(30000);
    expect(client.channels.length).toBe(1);
    net.leave();
    vi.useRealTimers();
  });

  it('반환값이 없으면(구버전 호환) 성공으로 취급한다', async () => {
    vi.useFakeTimers();
    const { client, statuses } = await subscribeWithTrackResult(undefined);
    expect(statuses).toEqual(['connected']);
    await vi.advanceTimersByTimeAsync(30000);
    expect(client.channels.length).toBe(1);
    vi.useRealTimers();
  });

  it('track reject 도 재구독 경로로 보낸다', async () => {
    vi.useFakeTimers();
    const client = createFakeClient();
    const net = makeNet(client);
    const statuses = [];
    net.onStatus((s) => statuses.push(s));
    const p = net.join();
    await flush();
    const ch = client.channels[0];
    ch.track = () => Promise.reject(new Error('boom'));
    ch.emitStatus('SUBSCRIBED');
    await p;
    await flush();
    expect(statuses).toEqual(['connected', 'reconnecting']);
    vi.useRealTimers();
  });
});

// ─────────────────────────────────────────────────────────────
describe('voiceGate — 근접 음성 연결 히스테리시스(순수)', () => {
  it('임계값: 연결 6타일 / 해제 8타일', () => {
    expect(VOICE_CONNECT_RADIUS).toBe(6);
    expect(VOICE_RELEASE_RADIUS).toBe(8);
  });
  it('연결 임계 미만이면 이전 상태와 무관하게 켠다', () => {
    expect(voiceGate(false, 5.9)).toBe(true);
    expect(voiceGate(false, 0)).toBe(true);
  });
  it('해제 임계 이상이면 이전 상태와 무관하게 끈다', () => {
    expect(voiceGate(true, 8)).toBe(false);
    expect(voiceGate(true, 12)).toBe(false);
  });
  it('밴드(6~8)에서는 직전 상태를 유지해 진동을 흡수한다', () => {
    expect(voiceGate(true, 7)).toBe(true);    // 켜져 있었으면 유지
    expect(voiceGate(false, 7)).toBe(false);  // 꺼져 있었으면 유지
    expect(voiceGate(true, 6)).toBe(true);    // 경계(=연결임계): 밴드 하단
    expect(voiceGate(false, 6)).toBe(false);
  });
  it('비유한 거리는 항상 해제(false)', () => {
    expect(voiceGate(true, NaN)).toBe(false);
    expect(voiceGate(true, Infinity)).toBe(false);
  });
  it('경계에서 스래싱 없음: 6↔7 왕복은 상태를 뒤집지 않는다', () => {
    let on = voiceGate(false, 5);   // 연결
    expect(on).toBe(true);
    on = voiceGate(on, 7);          // 밴드로 나감 → 유지
    expect(on).toBe(true);
    on = voiceGate(on, 6);          // 밴드 안 왕복 → 유지
    expect(on).toBe(true);
    on = voiceGate(on, 8);          // 해제 임계 → 끊김
    expect(on).toBe(false);
    on = voiceGate(on, 7);          // 다시 밴드 → 유지(꺼진 채)
    expect(on).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
describe('epochMatches — 시그널 세대 일치 판정(순수)', () => {
  it('동일 세대는 수락', () => {
    expect(epochMatches(3, 3)).toBe(true);
  });
  it('다른 세대는 무시(오래된 offer 의 answer 차단)', () => {
    expect(epochMatches(2, 1)).toBe(false);
    expect(epochMatches(1, 2)).toBe(false);
  });
  it('한쪽이라도 세대 정보 없으면 통과(구버전 호환)', () => {
    expect(epochMatches(null, 1)).toBe(true);
    expect(epochMatches(2, null)).toBe(true);
    expect(epochMatches(null, null)).toBe(true);
    expect(epochMatches(2, undefined)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
describe('falloffVolume — 근접 볼륨(순수, 0~1)', () => {
  it('거리 0 → 최대(1), 반경 이상 → 무음(0)', () => {
    expect(falloffVolume(0)).toBe(1);
    expect(falloffVolume(VOICE_RADIUS)).toBe(0);
    expect(falloffVolume(VOICE_RADIUS + 3)).toBe(0);
  });

  it('반경 안에서 거리가 멀수록 단조 감소한다', () => {
    const v1 = falloffVolume(1);
    const v3 = falloffVolume(3);
    const v5 = falloffVolume(5);
    expect(v1).toBeGreaterThan(v3);
    expect(v3).toBeGreaterThan(v5);
    for (const v of [v1, v3, v5]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('사용자 지정 반경을 존중', () => {
    expect(falloffVolume(10, 10)).toBe(0);
    expect(falloffVolume(0, 10)).toBe(1);
  });

  it('비유한값은 무음(0)으로 안전 처리', () => {
    expect(falloffVolume(NaN)).toBe(0);
    expect(falloffVolume(Infinity)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
describe('isOfferer — glare 방지 offerer 판정(사전순)', () => {
  it('사전순 앞선 쪽만 offerer', () => {
    expect(isOfferer('alice', 'bob')).toBe(true);
    expect(isOfferer('bob', 'alice')).toBe(false);
  });
  it('한쪽만 offerer 가 되어 동시 offer 를 막는다', () => {
    const a = 'user-111', b = 'user-999';
    expect(isOfferer(a, b)).not.toBe(isOfferer(b, a));
  });
  it('동일 id 는 offerer 아님', () => {
    expect(isOfferer('x', 'x')).toBe(false);
  });
});
