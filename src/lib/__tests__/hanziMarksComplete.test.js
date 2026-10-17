import { describe, expect, it } from 'vitest';
import { fetchLastHanziMarks } from '../hanziSession';

// 계약: 글자별 마지막 hanzi 기록은 1000행 상한에 잘리지 않는다(REVIEW-ROWS-CAP-001, 2026-10-17 KST).
// 가짜 client — 서버처럼 정렬(created_at desc, id desc)하고 한 응답을 1000행에서 자른다. 호출을 기록한다.
function fakeClient(rows, { failOn } = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      const s = { table, eq: {}, in: null, lte: null, order: [], range: null };
      const q = {
        select() { return q; },
        eq(c, v) { s.eq[c] = v; return q; },
        in(c, v) { s.in = v; return q; },
        lte(c, v) { s.lte = v; return q; },
        order(c, o) { s.order.push([c, o.ascending]); return q; },
        range(a, b) { s.range = [a, b]; return q; },
        then(resolve, reject) {
          calls.push(s);
          if (failOn && failOn(calls.length)) return Promise.resolve({ data: null, error: new Error('boom') }).then(resolve, reject);
          const hit = rows.filter((r) => s.in.includes(r.item_key) && r.created_at <= s.lte)
            .sort((a, b) => (b.created_at === a.created_at ? b.id - a.id : b.created_at.localeCompare(a.created_at)));
          const [from, to] = s.range;
          return Promise.resolve({ data: hit.slice(from, Math.min(to, from + 999) + 1), error: null }).then(resolve, reject);
        },
      };
      return q;
    },
  };
}
const at = (n) => new Date(Date.UTC(2026, 9, 1) + n * 1000).toISOString();
const UNTIL = at(1e6);

describe('fetchLastHanziMarks', () => {
  it('2500행이어도 글자마다 가장 최근 기록 — 오래된 기록만 있는 글자도 빠지지 않는다', async () => {
    // 「新」은 최근 2499번(마지막은 정답), 「旧」는 가장 오래된 1건(오답) — 예전 .limit 한 번이면 「旧」가 1000행 밖으로 밀렸다.
    const rows = [{ id: 1, item_key: '旧', correct: false, created_at: at(0) },
      ...Array.from({ length: 2499 }, (_, i) => ({ id: i + 2, item_key: '新', correct: i === 2498, created_at: at(i + 1) }))];
    const client = fakeClient(rows);
    const marks = await fetchLastHanziMarks(client, 'u1', ['新', '旧'], { untilIso: UNTIL });
    expect([...marks]).toEqual([['新', true], ['旧', false]]);
    expect(client.calls.length).toBeLessThanOrEqual(3);
    expect(client.calls[0]).toMatchObject({ table: 'review_events', eq: { user_id: 'u1', source: 'hanzi' }, lte: UNTIL,
      order: [['created_at', false], ['id', false]], range: [0, 999] });
  });

  it('묶음의 글자를 다 찾으면 다음 페이지를 읽지 않는다(조기 종료) — 앞 페이지(더 최신)가 이긴다', async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => ({ id: i + 1, item_key: i % 2 ? '甲' : '乙', correct: i >= 2498, created_at: at(i) }));
    const client = fakeClient(rows);
    const marks = await fetchLastHanziMarks(client, 'u1', ['甲', '乙'], { untilIso: UNTIL });
    expect(client.calls).toHaveLength(1);
    expect([...marks].sort()).toEqual([['乙', true], ['甲', true]]);
  });

  it('300자면 150자씩 묶음 2회 — 같은 상한', async () => {
    const chars = Array.from({ length: 300 }, (_, i) => String.fromCodePoint(0x4e00 + i));
    const client = fakeClient(chars.map((ch, i) => ({ id: i + 1, item_key: ch, correct: true, created_at: at(i) })));
    const marks = await fetchLastHanziMarks(client, 'u1', chars, { untilIso: UNTIL });
    expect(marks.size).toBe(300);
    expect(client.calls.map((c) => c.in.length)).toEqual([150, 150]);
    expect(new Set(client.calls.map((c) => c.lte))).toEqual(new Set([UNTIL]));
  });

  it('하나라도 오류면 reject — 화면은 빈 표시로 둔다(일부만 그리지 않는다)', async () => {
    const chars = Array.from({ length: 300 }, (_, i) => String.fromCodePoint(0x4e00 + i));
    const client = fakeClient([], { failOn: (n) => n === 2 });
    await expect(fetchLastHanziMarks(client, 'u1', chars, { untilIso: UNTIL })).rejects.toThrow('boom');
  });

  it('글자가 없으면 조회하지 않는다', async () => {
    const client = fakeClient([]);
    expect((await fetchLastHanziMarks(client, 'u1', [])).size).toBe(0);
    expect(client.calls).toHaveLength(0);
  });
});
