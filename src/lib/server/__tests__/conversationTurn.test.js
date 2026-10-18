// v2-Z Z-R1 ① — 대화 턴 경로 본체(runConversationTurn). 네트워크 없이 주입한 가짜 DB·AI·분석기로 전 경로를 돈다.
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { runConversationTurn } from '../conversationTurn';
import { CONVERSATION_DAILY_TURN_LIMIT, CONVERSATION_MAX_TURNS } from '../../conversation/turnModel';

const USER = 'u-1';
const NOW = Date.parse('2026-10-13T20:00:00+09:00');
const TODAY = '2026-10-13';

const getPath = (obj, p) => {
  // 'processed_json->metadata->conversation->>turnCount' → 값(마지막 ->>는 문자열)
  const text = p.includes('->>');
  const keys = p.replace('->>', '->').split('->');
  let v = obj;
  for (const k of keys) v = v?.[k];
  return text && v != null ? String(v) : v;
};

function fakeDb(rows = []) {
  const store = new Map(rows.map((r) => [String(r.id), structuredClone(r)]));
  let nextId = 1000;
  const writes = [];
  const from = (table) => {
    const q = { table, filters: [], notNull: [], op: 'select', cols: '*', payload: null };
    const run = () => {
      if (table !== 'reading_materials') return { data: [], error: null };
      if (q.op === 'insert') {
        const out = q.payload.map((r) => { const id = nextId++; store.set(String(id), { id, ...structuredClone(r) }); return { id }; });
        writes.push({ op: 'insert', rows: q.payload });
        return { data: out, error: null };
      }
      const match = [...store.values()].filter((r) => q.filters.every(([k, v]) => String(getPath(r, k)) === String(v))
        && q.notNull.every((k) => getPath(r, k) != null));
      if (q.op === 'update') {
        for (const r of match) Object.assign(r, structuredClone(q.payload));
        writes.push({ op: 'update', payload: q.payload, matched: match.length });
        return { data: match.map((r) => ({ id: r.id })), error: null };
      }
      const aliases = [...q.cols.matchAll(/(\w+):(processed_json->[^,\s]+)/g)];
      return { data: match.map((r) => (aliases.length
        ? Object.fromEntries([['id', r.id], ['created_at', r.created_at], ...aliases.map((a) => [a[1], getPath(r, a[2])])])
        : structuredClone(r))), error: null };
    };
    const api = {
      select(cols = '*') { if (q.op === 'select') q.cols = cols; return api; },
      eq(k, v) { q.filters.push([k, v]); return api; },
      limit() { return api; },
      order() { return api; },
      in() { return api; },
      not(k, op, v) { if (op === 'is' && v === null) q.notNull.push(k); return api; },
      insert(rows) { q.op = 'insert'; q.payload = rows; return api; },
      update(p) { q.op = 'update'; q.payload = p; return api; },
      maybeSingle: async () => { const r = run(); return { data: r.data[0] || null, error: r.error }; },
      then(resolve, reject) { try { resolve(run()); } catch (e) { reject(e); } },
    };
    return api;
  };
  return { from, store, writes };
}

const aiJson = (obj) => vi.fn(async () => ({ text: JSON.stringify(obj) }));
const charTokens = (lines) => ({ results: lines.map((line) => ({
  sequence: [...line].map((_, i) => `s${i}`),
  dictionary: Object.fromEntries([...line].map((ch, i) => [`s${i}`, { text: ch, pos: '명사', meaning: '' }])),
})), stats: {} });

function convRow({ turns, turnCount = 1, raw = '你好！你周末做什么？', dayTurns = 0, id = 7 } = {}) {
  return {
    id, owner_id: USER, visibility: 'private', title: '주말 계획', raw_text: raw,
    processed_json: {
      status: 'completed', sequence: ['id_0_0_1'], dictionary: { id_0_0_1: { text: raw } }, last_idx: 0, failed_indices: [],
      metadata: { language: 'Chinese', level: 'H2 초급', translations: {},
        conversation: { version: 1, topic: '주말 계획', level: 'H2 초급', language: 'Chinese', turnCount, day: TODAY, dayTurns,
          turns: turns || [{ who: 'tutor', lines: [0], at: NOW - 1000 }] } },
    },
  };
}

const deps = (db, callLLM, analyzeLines = vi.fn(async ({ lines }) => charTokens(lines))) => ({ supabase: db, callLLM, analyzeLines });

describe('시작 — 비공개 대화 자료 한 건 + 첫 질문 턴', () => {
  it('자료 id가 없으면 비공개 자료를 만들고 첫 문단 토큰만 돌려준다', async () => {
    const db = fakeDb();
    const callLLM = aiJson({ lines: [{ t: '你好！', ko: '안녕!' }, { t: '你周末做什么？', ko: '주말에 뭐 해?' }] });
    const out = await runConversationTurn({ userId: USER, now: NOW, deps: deps(db, callLLM),
      body: { topic: '주말 계획', language: 'Chinese', level: 'H2 초급' } });
    expect(out.status).toBe(200);
    const row = db.store.get(out.body.materialId);
    expect(row.visibility).toBe('private');
    expect(row.raw_text).toBe('你好！\n你周末做什么？');
    expect(row.processed_json.metadata.conversation).toMatchObject({ version: 1, turnCount: 1, dayTurns: 0, language: 'Chinese' });
    expect(row.processed_json.metadata.translations).toEqual({ '你好！': '안녕!', '你周末做什么？': '주말에 뭐 해?' });
    expect(out.body.tokens.sequence[0]).toBe(`id_0_0_${NOW}`);
    expect(callLLM).toHaveBeenCalledTimes(1);
    expect(callLLM.mock.calls[0][0]).toBe('standard');
  });

  it('같은 시도 id로 다시 부르면 새로 만들지 않고 그 대화를 연다', async () => {
    const db = fakeDb();
    const callLLM = aiJson({ lines: [{ t: '你好！', ko: '안녕!' }] });
    const body = { topic: '주말', language: 'Chinese', attemptId: '11111111-2222-4333-8444-555555555555' };
    const first = await runConversationTurn({ userId: USER, now: NOW, deps: deps(db, callLLM), body });
    const second = await runConversationTurn({ userId: USER, now: NOW, deps: deps(db, callLLM), body });
    expect(second.body).toEqual({ materialId: first.body.materialId, existing: true });
    expect(callLLM).toHaveBeenCalledTimes(1);
  });

  it('AI 답장이 없으면 502이고 자료를 만들지 않는다', async () => {
    const db = fakeDb();
    const out = await runConversationTurn({ userId: USER, now: NOW, deps: deps(db, vi.fn(async () => { throw new Error('x'); })),
      body: { topic: '주말', language: 'Chinese' } });
    expect(out.status).toBe(502);
    expect(db.writes).toHaveLength(0);
  });
});

describe('이어 쓰기 — 서버 왕복 1회(AI 1 + 분석 1) · 낙관 잠금', () => {
  const reply = { lines: [{ t: '看电影不错！', ko: '영화 좋죠!' }, { t: '你再说一遍，好吗？', ko: '다시 말해 볼래요?' }],
    feedback: '「见面」은 목적어를 바로 받지 못해요.', focus: { from: '见面了朋友', to: '我昨天跟朋友见面了。', level: 'retry', kind: 'grammar', hint: '跟' } };

  it('틀린 말 → 다시 말하기를 열고, 튜터 줄만 raw_text 새 문단으로 덧붙인다(내 말·피드백은 넣지 않음)', async () => {
    const db = fakeDb([convRow()]);
    const analyzeLines = vi.fn(async ({ lines }) => charTokens(lines));
    const callLLM = aiJson(reply);
    const out = await runConversationTurn({ userId: USER, now: NOW, deps: deps(db, callLLM, analyzeLines),
      body: { materialId: 7, text: '我想去看电影。我昨天见面了朋友。', inputMode: 'text', expectedTurn: 1 } });
    expect(out.status).toBe(200);
    expect(callLLM).toHaveBeenCalledTimes(1);
    expect(analyzeLines).toHaveBeenCalledTimes(1);
    const row = db.store.get('7');
    expect(row.raw_text).toBe('你好！你周末做什么？\n\n看电影不错！\n你再说一遍，好吗？');
    expect(row.raw_text).not.toContain('见面了朋友');
    const conv = row.processed_json.metadata.conversation;
    expect(conv.turnCount).toBe(2);
    expect(conv.turns.at(-2)).toMatchObject({ who: 'me', focus: { level: 'retry', state: 'open', to: '我昨天跟朋友见面了。' } });
    expect(conv.turns.at(-1)).toMatchObject({ who: 'tutor', lines: [2, 3] });
    expect(out.body.tokens.sequence).toEqual([`br_0_${NOW}`, `br_1_${NOW}`, ...[...'看电影不错！'].map((_, i) => `id_2_${i}_${NOW}`),
      `br_2_${NOW}`, ...[...'你再说一遍，好吗？'].map((_, i) => `id_3_${i}_${NOW}`)]);
    // 과거 토큰은 그대로
    expect(row.processed_json.sequence[0]).toBe('id_0_0_1');
    expect(conv.dayTurns).toBe(1);
  });

  it('못 고친 다시 말하기 → 정답 줄(저장한 focus.to)이 문단 맨 앞', async () => {
    const turns = [{ who: 'tutor', lines: [0], at: NOW - 3000 },
      { who: 'me', text: '我昨天见面了朋友。', at: NOW - 2000, focus: { from: '见面了朋友', to: '我昨天跟朋友见面了。', level: 'retry', kind: 'grammar', state: 'open' } },
      { who: 'tutor', lines: [2], at: NOW - 1000 }];
    const db = fakeDb([convRow({ turns, turnCount: 2, raw: '你好！\n\n你再说一遍？' })]);
    const callLLM = aiJson({ lines: [{ t: '没关系！你最近看了什么电影？' }], repair: 'no',
      focus: { from: '见面朋友', to: '我昨天和朋友见面了。', level: 'retry', kind: 'grammar' }, feedback: 'x' });
    const out = await runConversationTurn({ userId: USER, now: NOW, deps: deps(db, callLLM),
      body: { materialId: 7, text: '我昨天见面朋友了。', expectedTurn: 2 } });
    expect(out.status).toBe(200);
    expect(out.body.paragraph.lines).toEqual(['我昨天跟朋友见面了。', '没关系！你最近看了什么电影？']);
    expect(out.body.tutor).toMatchObject({ answer: 4, lines: [5] });
    expect(out.body.closeRetry).toEqual({ index: 1, state: 'missed' });
    const conv = db.store.get('7').processed_json.metadata.conversation;
    expect(conv.turns[1].focus.state).toBe('missed');
    expect(conv.turns.at(-2).focus.level).toBe('note'); // 연속 다시 말하기 금지
  });

  it('[답 보기] → 정답 줄 + 튜터 답, 내 말 턴은 없다', async () => {
    const turns = [{ who: 'tutor', lines: [0], at: NOW - 3000 },
      { who: 'me', text: '我昨天见面了朋友。', at: NOW - 2000, focus: { from: '见面了朋友', to: '我昨天跟朋友见面了。', level: 'retry', kind: 'grammar', state: 'open' } },
      { who: 'tutor', lines: [2], at: NOW - 1000 }];
    const db = fakeDb([convRow({ turns, turnCount: 2, raw: '你好！\n\n你再说一遍？' })]);
    const out = await runConversationTurn({ userId: USER, now: NOW, deps: deps(db, aiJson({ lines: [{ t: '没关系！' }] })),
      body: { materialId: 7, action: 'reveal', expectedTurn: 2 } });
    expect(out.status).toBe(200);
    expect(out.body.me).toBeNull();
    expect(out.body.paragraph.lines[0]).toBe('我昨天跟朋友见面了。');
    expect(db.store.get('7').processed_json.metadata.conversation.turns[1].focus.state).toBe('revealed');
  });

  it('기대 턴이 어긋나면 409 · 아무것도 쓰지 않는다(두 탭 동시 쓰기에서 턴 유실 0)', async () => {
    const db = fakeDb([convRow({ turnCount: 3 })]);
    const callLLM = aiJson(reply);
    const out = await runConversationTurn({ userId: USER, now: NOW, deps: deps(db, callLLM),
      body: { materialId: 7, text: '你好', expectedTurn: 2 } });
    expect(out.status).toBe(409);
    expect(callLLM).not.toHaveBeenCalled();
    expect(db.writes).toHaveLength(0);
  });

  it('읽은 뒤 다른 탭이 먼저 쓰면 조건부 기록이 0행 → 409', async () => {
    const db = fakeDb([convRow()]);
    const callLLM = vi.fn(async () => {
      // AI를 기다리는 사이 다른 탭이 한 턴을 먼저 기록했다
      db.store.get('7').processed_json.metadata.conversation.turnCount = 2;
      return { text: JSON.stringify(reply) };
    });
    const out = await runConversationTurn({ userId: USER, now: NOW, deps: deps(db, callLLM),
      body: { materialId: 7, text: '我昨天见面了朋友。', expectedTurn: 1 } });
    expect(out.status).toBe(409);
    expect(db.store.get('7').raw_text).toBe('你好！你周末做什么？');
  });

  it('분석 예산을 넘으면 글만 돌려준다(실패 줄 → 「다시 분석」), 입력은 막히지 않는다', async () => {
    const db = fakeDb([convRow()]);
    const slow = vi.fn(() => new Promise(() => {}));
    const out = await runConversationTurn({ userId: USER, now: NOW, budgetMs: 5, deps: deps(db, aiJson(reply), slow),
      body: { materialId: 7, text: '我昨天见面了朋友。', expectedTurn: 1 } });
    expect(out.status).toBe(200);
    expect(out.body.analysis).toBe('timeout');
    expect(out.body.tokens.sequence.filter((id) => id.startsWith('failed_'))).toHaveLength(2);
    expect(db.store.get('7').processed_json.failed_indices).toEqual([2, 3]);
  });

  it('분석 언어 밖(프랑스어)은 분석기를 부르지 않고 평문으로 동작한다', async () => {
    const row = convRow();
    row.processed_json.metadata.conversation.language = 'French';
    const db = fakeDb([row]);
    const analyzeLines = vi.fn();
    const out = await runConversationTurn({ userId: USER, now: NOW, deps: deps(db, aiJson({ lines: [{ t: 'Très bien !' }] }), analyzeLines),
      body: { materialId: 7, text: 'Je vais bien.', expectedTurn: 1 } });
    expect(out.status).toBe(200);
    expect(out.body.analysis).toBe('skipped');
    expect(analyzeLines).not.toHaveBeenCalled();
  });
});

describe('한도 · 권한', () => {
  it('오늘(KST) 내 모든 대화의 내 말이 150이면 429 「오늘은 여기까지」', async () => {
    const db = fakeDb([convRow({ dayTurns: 100 }), { ...convRow({ dayTurns: CONVERSATION_DAILY_TURN_LIMIT - 100, id: 8 }) }]);
    const callLLM = aiJson({ lines: [{ t: '好。' }] });
    const out = await runConversationTurn({ userId: USER, now: NOW, deps: deps(db, callLLM),
      body: { materialId: 7, text: '你好', expectedTurn: 1 } });
    expect(out.status).toBe(429);
    expect(out.body.error).toBe('오늘은 여기까지 · 내일 다시');
    expect(callLLM).not.toHaveBeenCalled();
  });

  it('어제 기록은 세지 않는다', async () => {
    const old = convRow({ dayTurns: CONVERSATION_DAILY_TURN_LIMIT, id: 8 });
    old.processed_json.metadata.conversation.day = '2026-10-12';
    const db = fakeDb([convRow(), old]);
    const out = await runConversationTurn({ userId: USER, now: NOW, deps: deps(db, aiJson({ lines: [{ t: '好。' }] })),
      body: { materialId: 7, text: '你好', expectedTurn: 1 } });
    expect(out.status).toBe(200);
  });

  it('대화당 40턴을 넘으면 「이어서 새 대화」', async () => {
    const turns = Array.from({ length: CONVERSATION_MAX_TURNS }, (_, i) => ({ who: 'me', text: 'x', at: NOW - 1e9 - i }));
    const db = fakeDb([convRow({ turns, turnCount: 40 })]);
    const out = await runConversationTurn({ userId: USER, now: NOW, deps: deps(db, aiJson({ lines: [{ t: '好。' }] })),
      body: { materialId: 7, text: '你好', expectedTurn: 40 } });
    expect(out.status).toBe(409);
    expect(out.body.code).toBe('conversation_full');
  });

  it('남의 대화·대화가 아닌 자료는 404', async () => {
    const other = { ...convRow(), owner_id: 'u-2' };
    const plain = { ...convRow({ id: 9 }), processed_json: { metadata: { language: 'Chinese' } } };
    const db = fakeDb([other, plain]);
    for (const materialId of [7, 9]) {
      const out = await runConversationTurn({ userId: USER, now: NOW, deps: deps(db, aiJson({ lines: [{ t: '好。' }] })),
        body: { materialId, text: '你好', expectedTurn: 1 } });
      expect(out.status).toBe(404);
    }
  });
});

describe('소스 계약', () => {
  const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
  it('라우트는 로그인 필수 · 분당 한도 · 분석 핵심 재사용(새 분석 경로 0)', () => {
    const route = read('src/app/api/conversation/turn/route.js');
    expect(route).toContain('requireUser(request)');
    expect(route).toContain('CONVERSATION_RATE');
    expect(route).toContain("from '@/lib/server/analyzeCore'");
    expect(read('src/app/api/analyze/route.js')).toContain('analyzeLines({ lines, language, boundaryRequest, truncatedLines, startedAt })');
  });
  it('안전 규칙 문안은 한 곳(lib/conversation/safety.js)뿐이다', () => {
    const phrase = 'politics of the Chinese-speaking world';
    const hits = ['src/components/conversation/ConversationThread.jsx', 'src/lib/server/conversationTurn.js', 'src/lib/conversation/turnModel.js']
      .filter((f) => read(f).includes(phrase));
    expect(hits).toEqual([]);
    expect(read('src/lib/conversation/safety.js')).toContain(phrase);
  });
  it('대화 턴 경로는 review_events·FSRS에 쓰지 않는다(M7)', () => {
    const src = read('src/lib/server/conversationTurn.js') + read('src/lib/conversation/turnModel.js');
    expect(src).not.toMatch(/review_events|fsrs/i);
  });
});

describe('Z-R3 순환 — 다시 꺼내기 · 새 단어 수', () => {
  const DAY = 24 * 3600e3;
  const past = (id, at) => convRow({ id, turns: [
    { who: 'tutor', lines: [0], at },
    { who: 'me', text: '我昨天见面了朋友。', at, focus: { from: '见面了朋友', to: '我昨天跟朋友见面了。', level: 'retry', state: 'fixed' } },
  ] });

  it('새 대화를 열면 하루 지난 고친 문형을 한 번 묻게 하고, 그 기록을 대화에 남긴다', async () => {
    const db = fakeDb([past(5, NOW - 2 * DAY)]);
    const callLLM = aiJson({ lines: [{ t: '你昨天做什么了？', ko: '어제 뭐 했어?' }] });
    const out = await runConversationTurn({ userId: USER, now: NOW, deps: deps(db, callLLM),
      body: { topic: '하루', language: 'Chinese', level: 'H2 초급' } });
    expect(out.status).toBe(200);
    expect(callLLM.mock.calls[0][1]).toContain('Earlier the student corrected a sentence to: "我昨天跟朋友见面了。"');
    expect(db.store.get(out.body.materialId).processed_json.metadata.conversation.reask)
      .toEqual([{ text: '我昨天见面了朋友。', from: '见面了朋友', to: '我昨天跟朋友见面了。', sourceId: '5', ok: null }]);
  });

  it('하루가 안 지났으면 묻지 않는다', async () => {
    const db = fakeDb([past(5, NOW - 3600e3)]);
    const callLLM = aiJson({ lines: [{ t: '你好！', ko: '안녕' }] });
    const out = await runConversationTurn({ userId: USER, now: NOW, deps: deps(db, callLLM),
      body: { topic: '하루', language: 'Chinese', level: 'H2 초급' } });
    expect(callLLM.mock.calls[0][1]).not.toContain('Earlier the student corrected');
    expect(db.store.get(out.body.materialId).processed_json.metadata.conversation.reask).toBeUndefined();
  });

  it('묻던 문형을 맞게 쓰면 ok로 닫고, 튜터 답장의 새 단어 수를 남긴다', async () => {
    const row = convRow({ id: 9 });
    row.processed_json.metadata.conversation.reask = [{ text: '我昨天见面了朋友。', to: '我昨天跟朋友见面了。', sourceId: '5', ok: null }];
    const db = fakeDb([row]);
    const callLLM = aiJson({ lines: [{ t: '太好了！', ko: '좋아!' }], feedback: null, focus: null, repair: null });
    const out = await runConversationTurn({ userId: USER, now: NOW, deps: deps(db, callLLM),
      body: { materialId: '9', expectedTurn: 1, text: '我今天跟朋友见面了。' } });
    expect(out.status).toBe(200);
    const conv = db.store.get('9').processed_json.metadata.conversation;
    expect(conv.reask[0]).toMatchObject({ ok: true, at: NOW });
    expect(conv.turns.at(-1)).toMatchObject({ who: 'tutor', newWords: 3 }); // 가짜 분석기는 글자마다 명사 — 太·好·了 셋(！는 글자가 아니라 뺀다)
  });
});

describe('못 한 줄 자동 채우기(CONV-CHAT-001) — 사용자에게 「다시 분석」을 떠넘기지 않는다', () => {
  const failedRow = () => {
    const row = convRow({ raw: '你好！\n你周末做什么？' });
    row.processed_json.sequence = ['id_0_0_1', 'br_0_1', 'failed_1_1'];
    row.processed_json.dictionary = { id_0_0_1: { text: '你好！' }, br_0_1: { text: '\n', pos: '개행' }, failed_1_1: { text: '你周末做什么？', failed: true, original_line_idx: 1 } };
    row.processed_json.failed_indices = [1];
    row.processed_json.status = 'partial';
    return row;
  };

  it('실패 토큰 자리에 분석 토큰을 끼우고 턴 수·하루 한도는 그대로 둔다', async () => {
    const db = fakeDb([failedRow()]);
    const callLLM = vi.fn();
    const out = await runConversationTurn({ userId: USER, now: NOW, deps: deps(db, callLLM), body: { materialId: '7', action: 'analyze' } });
    expect(out.status).toBe(200);
    expect(out.body.analysis).toBe('ok');
    expect(out.body.filled[1].remove).toBe('failed_1_1');
    const json = db.store.get('7').processed_json;
    expect(json.sequence.slice(0, 3)).toEqual(['id_0_0_1', 'br_0_1', `id_1_0_${NOW}`]);
    expect(json.dictionary.failed_1_1).toBeUndefined();
    expect(json.failed_indices).toEqual([]);
    expect(json.metadata.conversation.turnCount).toBe(1);
    expect(json.metadata.conversation.dayTurns).toBe(0);
    expect(callLLM).not.toHaveBeenCalled();
  });

  it('분석이 또 안 되면 기록하지 않고 남은 줄만 알려 준다(화면이 간격을 두고 다시 맡긴다)', async () => {
    const db = fakeDb([failedRow()]);
    const out = await runConversationTurn({ userId: USER, now: NOW, deps: deps(db, vi.fn(), vi.fn(async () => null)), body: { materialId: '7', action: 'analyze' } });
    expect(out.body).toMatchObject({ analysis: 'failed', missing: [1], filled: {} });
    expect(db.writes).toHaveLength(0);
  });

  it('남의 대화는 채우지 않는다', async () => {
    const db = fakeDb([{ ...failedRow(), owner_id: 'someone' }]);
    const out = await runConversationTurn({ userId: USER, now: NOW, deps: deps(db, vi.fn()), body: { materialId: '7', action: 'analyze' } });
    expect(out.status).toBe(404);
  });

  it('채울 줄이 없으면 분석기를 부르지 않는다', async () => {
    const analyze = vi.fn();
    const out = await runConversationTurn({ userId: USER, now: NOW, deps: deps(fakeDb([convRow()]), vi.fn(), analyze), body: { materialId: '7', action: 'analyze' } });
    expect(out.body.filled).toEqual({});
    expect(analyze).not.toHaveBeenCalled();
  });
});
