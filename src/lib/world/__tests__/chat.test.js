import { describe, it, expect, vi } from 'vitest';

// chat.js → supabase.js 가 모듈 로드 시 env 를 요구하므로 스텁 후 동적 import(worldNet.test 관례).
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
const {
  sanitizeChatText, rateGate, normalizeMessage, createWorldChat,
  CHAT_MAX_LEN, CHAT_RATE_LIMIT,
} = await import('../chat.js');

// 학습 월드 도트 채팅 — 순수 가드(정제·스로틀·정규화)와 팩토리(로컬 에코·수신 필터) 검증.

describe('sanitizeChatText', () => {
  it('trim + 개행/중복 공백을 한 칸으로 접는다', () => {
    expect(sanitizeChatText('  안녕\n\n  하세요  ')).toBe('안녕 하세요');
  });
  it('빈 문자열/공백뿐/비문자열은 null', () => {
    expect(sanitizeChatText('')).toBe(null);
    expect(sanitizeChatText('   \n ')).toBe(null);
    expect(sanitizeChatText(null)).toBe(null);
    expect(sanitizeChatText(42)).toBe(null);
  });
  it('120자 초과분은 컷', () => {
    const long = 'あ'.repeat(200);
    expect(sanitizeChatText(long).length).toBe(CHAT_MAX_LEN);
  });
});

describe('rateGate (초당 2건 슬라이딩 윈도우)', () => {
  it('윈도우 안 limit 미만이면 허용하고 now 를 누적한다', () => {
    const a = rateGate([], 1000);
    expect(a.allowed).toBe(true);
    expect(a.recent).toEqual([1000]);
    const b = rateGate(a.recent, 1100);
    expect(b.allowed).toBe(true);
    expect(b.recent).toEqual([1000, 1100]);
  });
  it('윈도우 안 limit 도달이면 거부(목록 유지)', () => {
    const c = rateGate([1000, 1100], 1200, CHAT_RATE_LIMIT, 1000);
    expect(c.allowed).toBe(false);
    expect(c.recent).toEqual([1000, 1100]);
  });
  it('윈도우를 벗어난 과거 전송은 만료돼 다시 허용', () => {
    const d = rateGate([1000, 1100], 2200, CHAT_RATE_LIMIT, 1000);
    expect(d.allowed).toBe(true);
    expect(d.recent).toEqual([2200]); // 1000·1100 은 1000ms 밖 → 폐기
  });
});

describe('normalizeMessage', () => {
  it('필수 필드(userId·text) 없으면 null', () => {
    expect(normalizeMessage(null)).toBe(null);
    expect(normalizeMessage({ text: 'hi' })).toBe(null);
    expect(normalizeMessage({ userId: 'u1', text: '  ' })).toBe(null);
  });
  it('이름 비면 익명, id·at 없으면 생성', () => {
    const m = normalizeMessage({ userId: 'u1', text: '안녕', name: '  ' });
    expect(m.name).toBe('익명');
    expect(typeof m.id).toBe('string');
    expect(Number.isFinite(m.at)).toBe(true);
    expect(m.text).toBe('안녕');
  });
  it('주어진 id·at·name 은 보존', () => {
    const m = normalizeMessage({ id: 'x', userId: 'u1', name: '체연', text: 'hi', at: 5 });
    expect(m).toEqual({ id: 'x', userId: 'u1', name: '체연', text: 'hi', at: 5 });
  });
});

// 브로드캐스트 콜백을 붙잡아 수신을 흉내낼 수 있는 최소 fake 채널.
function makeFakeClient() {
  const handlers = {};
  const sent = [];
  const channel = {
    on(_type, { event }, cb) { handlers[event] = cb; return channel; },
    subscribe(cb) { cb('SUBSCRIBED'); return channel; },
    send(msg) { sent.push(msg); return channel; },
    unsubscribe() {},
  };
  return {
    client: { channel: () => channel, removeChannel() {} },
    emitBroadcast: (payload) => handlers.chat?.({ payload }),
    sent,
  };
}

describe('createWorldChat', () => {
  it('send 는 로컬 에코 후 채널로 broadcast 한다', () => {
    const { client, sent } = makeFakeClient();
    const chat = createWorldChat({ client, userId: 'me', name: '나' });
    const got = [];
    chat.onMessage((m) => got.push(m));
    const msg = chat.send('안녕하세요');
    expect(msg.text).toBe('안녕하세요');
    expect(got).toHaveLength(1);            // 로컬 에코
    expect(got[0].userId).toBe('me');
    expect(sent).toHaveLength(1);           // 채널 송신
    expect(sent[0].event).toBe('chat');
  });

  it('빈 문자열·스로틀 초과는 전송/에코하지 않는다', () => {
    const { client } = makeFakeClient();
    const chat = createWorldChat({ client, userId: 'me', name: '나' });
    const got = [];
    chat.onMessage((m) => got.push(m));
    expect(chat.send('   ')).toBe(null);
    chat.send('1'); chat.send('2');
    const third = chat.send('3');           // 같은 틱 → 3번째는 스로틀 거부
    expect(third).toBe(null);
    expect(got).toHaveLength(2);
  });

  it('자기 userId 로 되돌아온 broadcast 는 버린다(중복 방지)', () => {
    const { client, emitBroadcast } = makeFakeClient();
    const chat = createWorldChat({ client, userId: 'me', name: '나' });
    const got = [];
    chat.onMessage((m) => got.push(m));
    emitBroadcast({ id: 'a', userId: 'me', name: '나', text: 'echo', at: 1 });   // 무시
    emitBroadcast({ id: 'b', userId: 'peer', name: '상대', text: 'hi', at: 2 }); // 반영
    expect(got).toHaveLength(1);
    expect(got[0].userId).toBe('peer');
  });

  it('onStatus 는 구독 시 connected 를 통지하고 leave 후 채널을 정리한다', () => {
    const { client } = makeFakeClient();
    const spy = vi.spyOn(client, 'removeChannel');
    const chat = createWorldChat({ client, userId: 'me', name: '나' });
    let status = null;
    chat.onStatus((s) => { status = s; });
    expect(status).toBe('connected');
    chat.leave();
    expect(spy).toHaveBeenCalled();
    expect(chat.send('after-leave')).toBe(null);
  });
});
