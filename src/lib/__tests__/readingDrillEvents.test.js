import { describe, it, expect } from 'vitest';

// P2-6: 드릴 이벤트 키는 drillId 가 아니라 **문형(it.pattern)** 단위 — 드릴 A 의 〜は/〜を 가
// 분리 집계돼야 문형별 약점 신호가 살아남고 pattern 문항과 정합한다.
// readingProgress → supabase.js 가 모듈 로드 시 env 를 요구하므로 스텁 후 동적 import.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
const { buildReadingEvents } = await import('../readingProgress');

// ReadingDrillView 의 questions 매핑 재현 — itemKey: it.pattern(|| drillId), qtype:'pattern'.
// QuestionFlow.finish() 가 이 결과를 buildReadingEvents 로 넘겨 실제 이벤트를 낸다.
function drillEvents(drillId, items, firstOks) {
  const results = items.map((it, i) => ({
    itemKey: it.pattern || drillId,
    id: it.id,
    qtype: 'pattern',
    firstOk: firstOks[i],
    tries: 1,
    index: i,
  }));
  return buildReadingEvents(drillId, results);
}

describe('드릴 이벤트 — 문형(pattern) 단위 분리 집계(P2-6)', () => {
  const drillId = 'n5-tokyo-drill-1';
  const items = [
    { pattern: '〜は', id: 'n5-tokyo-drill-1-q1' },
    { pattern: '〜は', id: 'n5-tokyo-drill-1-q2' },
    { pattern: '〜を', id: 'n5-tokyo-drill-1-q3' },
    { pattern: '〜へ', id: 'n5-tokyo-drill-1-q4' },
  ];

  it('item_key 는 문형별로 나뉜다 — drillId 로 뭉쳐지지 않는다', () => {
    const events = drillEvents(drillId, items, [true, false, true, true]);
    expect(events.map((e) => e.item_key)).toEqual(['〜は', '〜は', '〜を', '〜へ']);
    // 어떤 이벤트도 드릴 노드 id 를 item_key 로 쓰지 않는다(문형 신호 소실 방지)
    expect(events.every((e) => e.item_key !== drillId)).toBe(true);
  });

  it('드릴 노드 id 는 detail.text_id 로 보존된다(집계는 문형, 소속은 드릴)', () => {
    const events = drillEvents(drillId, items, [true, true, true, true]);
    expect(events.every((e) => e.detail.text_id === drillId)).toBe(true);
    expect(events.every((e) => e.detail.qtype === 'pattern')).toBe(true);
  });

  it('같은 문형(〜は) 두 문항의 정오가 그 문형 키로 함께 모인다 — 분리·정합', () => {
    const events = drillEvents(drillId, items, [true, false, true, false]);
    const byKey = {};
    for (const e of events) (byKey[e.item_key] ||= []).push(e.correct);
    expect(byKey['〜は']).toEqual([true, false]); // 〜は 두 문항 함께
    expect(byKey['〜を']).toEqual([true]);
    expect(byKey['〜へ']).toEqual([false]);
  });

  it('본편 글의 문형 이벤트와 같은 키 규약 — 문형 문자열이 그대로 item_key', () => {
    // 글(pattern 문항)과 드릴이 같은 문형이면 같은 item_key 로 집계돼 신호가 합류한다.
    const drill = drillEvents(drillId, [{ pattern: '〜は', id: 'd-q1' }], [true]);
    const text = buildReadingEvents('n5-tokyo-05', [
      { itemKey: '〜は', qtype: 'pattern', firstOk: false, tries: 2, index: 0 },
    ]);
    expect(drill[0].item_key).toBe('〜は');
    expect(text[0].item_key).toBe('〜は'); // 같은 문형 → 같은 키(트랙 전체 문형 약점 통합)
  });

  it('문형 누락 시에만 drillId 로 폴백 — 이벤트 유실 없음', () => {
    const events = drillEvents(drillId, [{ id: 'd-q1' }], [true]); // pattern 없음
    expect(events).toHaveLength(1);
    expect(events[0].item_key).toBe(drillId); // 폴백(누락 방어)
  });
});
