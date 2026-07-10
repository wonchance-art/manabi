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
// from(): world_sessions 의미론을 재현하는 미니 테이블 — update().eq().or().select(),
// insert().select(), select().eq().maybeSingle(), delete().eq().eq() 만 지원.
function createFakeClient({ trackResult = 'ok', tableError = null } = {}) {
  const channels = [];
  const db = { rows: new Map(), error: tableError, ops: [] };

  function makeBuilder(op, values) {
    const q = { op, eqs: {}, orRaw: null, single: false };
    const exec = () => {
      db.ops.push({ op, eqs: { ...q.eqs } });
      if (db.error) return { data: null, error: db.error };
      const uid = q.eqs.user_id;
      const row = db.rows.get(uid);
      if (op === 'update') {
        let match = !!row;
        if (match && q.orRaw) {
          // 'col.eq.값,col.lt.값' — supabase-js or() 문법의 필요 부분만 해석
          match = q.orRaw.split(',').some((c) => {
            const m = c.match(/^([a-z_]+)\.(eq|lt)\.(.*)$/);
            if (!m) return false;
            const [, col, cmp, val] = m;
            if (cmp === 'eq') return String(row[col]) === val;
            return new Date(row[col]).getTime() < new Date(val).getTime();
          });
        }
        if (match && q.eqs.session_id != null && row.session_id !== q.eqs.session_id) match = false;
        if (match) {
          Object.assign(row, values);
          return { data: [{ session_id: row.session_id }], error: null };
        }
        return { data: [], error: null };
      }
      if (op === 'insert') {
        if (db.rows.has(values.user_id)) return { data: null, error: { code: '23505', message: 'duplicate key' } };
        db.rows.set(values.user_id, { session_id: values.session_id, heartbeat_at: values.heartbeat_at });
        return { data: [{ session_id: values.session_id }], error: null };
      }
      if (op === 'select') {
        const data = row ? { session_id: row.session_id, heartbeat_at: row.heartbeat_at } : null;
        return { data: q.single ? data : (data ? [data] : []), error: null };
      }
      if (op === 'delete') {
        if (row && (q.eqs.session_id == null || row.session_id === q.eqs.session_id)) db.rows.delete(uid);
        return { data: null, error: null };
      }
      return { data: null, error: null };
    };
    const b = {
      eq(col, val) { q.eqs[col] = val; return b; },
      or(raw) { q.orRaw = raw; return b; },
      select() { return b; },
      maybeSingle() { q.single = true; return b; },
      then(res, rej) { return Promise.resolve().then(exec).then(res, rej); },
    };
    return b;
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
    from() {
      return {
        update: (values) => makeBuilder('update', values),
        insert: (values) => makeBuilder('insert', values),
        select: () => makeBuilder('select', null),
        delete: () => makeBuilder('delete', null),
      };
    },
  };
}

const USER = 'u1';
const freshIso = () => new Date().toISOString();
const staleIso = () => new Date(Date.now() - LEASE_TTL_MS - 20000).toISOString();
// 마이크로태스크 체인(임대 질의 await 연쇄) 소화용.
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
describe('createSessionLease — world_sessions 서버 권위 임대', () => {
  it('빈 테이블이면 INSERT 로 획득하고 행이 생긴다', async () => {
    const client = createFakeClient();
    const lease = createSessionLease({ client, userId: USER, sessionId: 'me' });
    expect(await lease.acquire()).toBe('acquired');
    expect(client.db.rows.get(USER).session_id).toBe('me');
  });

  it('살아있는 타 세션이 보유하면 duplicate — 행은 그대로(원자 탈취 방지)', async () => {
    vi.useFakeTimers();
    const client = createFakeClient();
    client.db.rows.set(USER, { session_id: 'other-live', heartbeat_at: freshIso() });
    const lease = createSessionLease({ client, userId: USER, sessionId: 'me' });
    expect(await lease.acquire()).toBe('duplicate');
    expect(client.db.rows.get(USER).session_id).toBe('other-live'); // UPDATE 가 0행 — 덮어쓰기 실패
    vi.useRealTimers();
  });

  it('내 세션이 이미 보유 중이면 재획득(UPDATE 경로)', async () => {
    vi.useFakeTimers();
    const client = createFakeClient();
    client.db.rows.set(USER, { session_id: 'me', heartbeat_at: freshIso() });
    const lease = createSessionLease({ client, userId: USER, sessionId: 'me' });
    expect(await lease.acquire()).toBe('acquired');
    vi.useRealTimers();
  });

  it('만료(heartbeat 40초 초과) 임대는 원자적으로 인수한다', async () => {
    vi.useFakeTimers();
    const client = createFakeClient();
    client.db.rows.set(USER, { session_id: 'stale', heartbeat_at: staleIso() });
    const lease = createSessionLease({ client, userId: USER, sessionId: 'me' });
    expect(await lease.acquire()).toBe('acquired');
    expect(client.db.rows.get(USER).session_id).toBe('me');
    vi.useRealTimers();
  });

  it('테이블 부재/권한 오류(42P01 등)는 unavailable — 강등 신호', async () => {
    const client = createFakeClient({ tableError: { code: '42P01', message: 'relation does not exist' } });
    const lease = createSessionLease({ client, userId: USER, sessionId: 'me' });
    expect(await lease.acquire()).toBe('unavailable');
  });

  it('heartbeat: 내 행이면 ok, 다른 세션이 인수했으면 lost, 오류면 unavailable', async () => {
    vi.useFakeTimers();
    const client = createFakeClient();
    client.db.rows.set(USER, { session_id: 'me', heartbeat_at: freshIso() });
    const lease = createSessionLease({ client, userId: USER, sessionId: 'me' });
    expect(await lease.heartbeat()).toBe('ok');
    client.db.rows.get(USER).session_id = 'thief';
    expect(await lease.heartbeat()).toBe('lost');
    client.db.error = { code: '42P01' };
    expect(await lease.heartbeat()).toBe('unavailable');
    vi.useRealTimers();
  });

  it('release 는 내 세션의 행만 지운다 — 새 세션의 임대는 못 건드림', async () => {
    vi.useFakeTimers();
    const client = createFakeClient();
    client.db.rows.set(USER, { session_id: 'successor', heartbeat_at: freshIso() });
    const lease = createSessionLease({ client, userId: USER, sessionId: 'me' });
    await lease.release();
    expect(client.db.rows.has(USER)).toBe(true);   // session_id 불일치 → 삭제 안 됨
    client.db.rows.get(USER).session_id = 'me';
    await lease.release();
    expect(client.db.rows.has(USER)).toBe(false);
    vi.useRealTimers();
  });
});

// ─────────────────────────────────────────────────────────────
describe('createWorldNet — 임대 통합(획득/충돌/만료 인수/강등/heartbeat)', () => {
  it('임대 획득 → connected(enforcement=lease) + 25초 간격 heartbeat 갱신', async () => {
    vi.useFakeTimers();
    const client = createFakeClient();
    const net = makeNet(client);
    const statuses = [];
    net.onStatus((s, info) => statuses.push([s, info]));
    const ch = await joinAndSubscribe(client, net);
    expect(statuses.at(-1)).toEqual(['connected', { enforcement: 'lease' }]);
    // 임대 행의 세션 = presence track 에 실은 sessionId (같은 "나")
    expect(client.db.rows.get(USER).session_id).toBe(ch.tracked[0].sessionId);
    const hb0 = client.db.rows.get(USER).heartbeat_at;
    await vi.advanceTimersByTimeAsync(LEASE_HEARTBEAT_MS);
    await flush();
    expect(client.db.rows.get(USER).heartbeat_at).not.toBe(hb0);
    net.leave();
    vi.useRealTimers();
  });

  it('임대 충돌 — 살아있는 타 세션 보유 시 채널을 열지 않고 duplicate 로 물러난다', async () => {
    vi.useFakeTimers();
    const client = createFakeClient();
    client.db.rows.set(USER, { session_id: 'other-live', heartbeat_at: freshIso() });
    const net = makeNet(client);
    const statuses = [];
    net.onStatus((s) => statuses.push(s));
    await net.join();
    await flush();
    expect(statuses).toEqual(['duplicate']);
    expect(client.channels.length).toBe(0);          // 채널 생성 0
    expect(client.db.rows.get(USER).session_id).toBe('other-live'); // 임대 무손상
    await vi.advanceTimersByTimeAsync(60000);        // 자동 재연결 없음
    expect(client.channels.length).toBe(0);
    expect(statuses).toEqual(['duplicate']);
    vi.useRealTimers();
  });

  it('만료 임대 인수 — 죽은 세션(40초 무응답)의 행을 이어받고 정상 접속한다', async () => {
    vi.useFakeTimers();
    const client = createFakeClient();
    client.db.rows.set(USER, { session_id: 'stale', heartbeat_at: staleIso() });
    const net = makeNet(client);
    const statuses = [];
    net.onStatus((s, info) => statuses.push([s, info]));
    const ch = await joinAndSubscribe(client, net);
    expect(statuses.at(-1)).toEqual(['connected', { enforcement: 'lease' }]);
    expect(client.db.rows.get(USER).session_id).toBe(ch.tracked[0].sessionId);
    net.leave();
    vi.useRealTimers();
  });

  it('강등 — 테이블 부재 시 presence 휴리스틱으로 connected(enforcement=presence), heartbeat 없음', async () => {
    vi.useFakeTimers();
    const client = createFakeClient({ tableError: { code: '42P01' } });
    const net = makeNet(client);
    const statuses = [];
    net.onStatus((s, info) => statuses.push([s, info]));
    await joinAndSubscribe(client, net);
    expect(statuses.at(-1)).toEqual(['connected', { enforcement: 'presence' }]);
    const opsBefore = client.db.ops.length;
    await vi.advanceTimersByTimeAsync(LEASE_HEARTBEAT_MS * 2);
    await flush();
    expect(client.db.ops.length).toBe(opsBefore);    // 강등 모드에선 heartbeat 를 돌리지 않는다
    net.leave();
    vi.useRealTimers();
  });

  it('heartbeat lost — 다른 세션이 만료 인수하면 이 세션이 스스로 물러난다(서버 권위)', async () => {
    vi.useFakeTimers();
    const client = createFakeClient();
    const net = makeNet(client);
    const statuses = [];
    net.onStatus((s) => statuses.push(s));
    const ch = await joinAndSubscribe(client, net);
    client.db.rows.get(USER).session_id = 'thief';   // 다른 세션의 인수를 시뮬레이트
    await vi.advanceTimersByTimeAsync(LEASE_HEARTBEAT_MS);
    await flush();
    expect(statuses.at(-1)).toBe('duplicate');
    expect(ch.unsubCount).toBe(1);                   // 채널 정리
    expect(client.db.rows.get(USER).session_id).toBe('thief'); // release 가 남의 임대를 못 지움
    await vi.advanceTimersByTimeAsync(60000);        // 재연결 없음
    expect(client.channels.length).toBe(1);
    vi.useRealTimers();
  });

  it('임대 성공 후에도 presence 중복이 보이면 방어적으로 양보하고 임대를 반납한다', async () => {
    vi.useFakeTimers();
    const client = createFakeClient();
    const net = makeNet(client);
    const statuses = [];
    net.onStatus((s) => statuses.push(s));
    const ch = await joinAndSubscribe(client, net);
    // 생존자(더 이른 joinedAt)의 타 세션이 presence 에 나타남 — 보조 휴리스틱 발동
    ch.presence = { [USER]: [{ sessionId: 'survivor', joinedAt: 0 }] };
    ch.emit('presence', 'sync');
    await flush();
    expect(statuses.at(-1)).toBe('duplicate');
    expect(client.db.rows.has(USER)).toBe(false);    // 내 행 반납 → 상대가 임대 획득 가능
    await vi.advanceTimersByTimeAsync(60000);
    expect(client.channels.length).toBe(1);          // 재연결 없음
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
    const opsBefore = client.db.ops.length;
    await vi.advanceTimersByTimeAsync(LEASE_HEARTBEAT_MS * 3);
    await flush();
    expect(client.db.ops.length).toBe(opsBefore);    // heartbeat 정지
    vi.useRealTimers();
  });
});

// ─────────────────────────────────────────────────────────────
describe('createWorldNet — P1-1 하네스: 중복 퇴장 후 자동 재연결 봉인', () => {
  // Codex 하네스 재현 시나리오(강등 모드 = 기존 presence 휴리스틱 경로):
  // 예전 코드는 statuses=["duplicate","reconnecting"], 두 번째 채널 sent=1 이었다.
  it('중복 판정 후: 상태 duplicate 유지·재연결 없음·두 번째 채널 0·송신 0', async () => {
    vi.useFakeTimers();
    const client = createFakeClient({ tableError: { code: '42P01' } }); // 강등 → presence 판정
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
    const client = createFakeClient({ tableError: { code: '42P01' } });
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
