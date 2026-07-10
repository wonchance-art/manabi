import { describe, it, expect } from 'vitest';

// readingProgress → supabase.js 가 모듈 로드 시 env 를 요구하므로 스텁 후 동적 import
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
const {
  READING_LANG,
  buildReadingEvents,
  accumulateAnswer,
  missingReviewSlugs,
  isReadingDrillId,
  drillId,
} = await import('../readingProgress');

// ── P2-9: 독해 이벤트 계약 — buildReadingEvents 가 단일 원천으로 강제하는 세 규칙 ──
describe('buildReadingEvents — lang 은 READING_LANG(Japanese) 고정', () => {
  it("'ja' 가 아니라 'Japanese' — 소비처(약점 집계·다이얼)의 lang 조회와 일치", () => {
    const [e] = buildReadingEvents('n5-tokyo-01', [
      { itemKey: '〜です', qtype: 'pattern', firstOk: true, tries: 1 },
    ]);
    expect(e.lang).toBe('Japanese');
    expect(e.lang).toBe(READING_LANG); // 상수 단일 원천 — 리터럴 재도입 방지
    expect(e.source).toBe('reading');
    expect(e.item_key).toBe('〜です');
    expect(e.detail).toEqual({ text_id: 'n5-tokyo-01', qtype: 'pattern', tries: 1 });
  });

  it('logReviewEvents 필터(lang·source·item_key·boolean correct)를 통과하는 형태', () => {
    const events = buildReadingEvents('t1', [
      { itemKey: '〜か', qtype: 'pattern', firstOk: false, tries: 2 },
      { itemKey: 'content', qtype: 'content', firstOk: true, tries: 1 },
    ]);
    for (const e of events) {
      expect(typeof e.lang).toBe('string');
      expect(typeof e.source).toBe('string');
      expect(typeof e.item_key).toBe('string');
      expect(typeof e.correct).toBe('boolean');
    }
  });
});

describe('buildReadingEvents — correct 는 최초 시도 기준(재시도는 detail.tries)', () => {
  it('재시도 끝에 정답이어도 최초 시도가 오답이면 correct:false', () => {
    // 게이팅 문항: 3번째 시도에 정답 도달 → 최종 정답으로 덮지 않는다
    const [e] = buildReadingEvents('t1', [
      { itemKey: '〜が', qtype: 'pattern', firstOk: false, tries: 3 },
    ]);
    expect(e.correct).toBe(false);
    expect(e.detail.tries).toBe(3);
  });

  it('1회에 맞힌 문항은 correct:true · tries:1', () => {
    const [e] = buildReadingEvents('t1', [
      { itemKey: '〜に', qtype: 'pattern', firstOk: true, tries: 1 },
    ]);
    expect(e.correct).toBe(true);
    expect(e.detail.tries).toBe(1);
  });
});

describe('buildReadingEvents — 미응답 문항은 이벤트 미발행', () => {
  it('tries 0(미응답 content)은 correct:false 로 깔지 않고 발행 자체를 생략한다', () => {
    const events = buildReadingEvents('t1', [
      { itemKey: 'content', qtype: 'content', firstOk: false, tries: 0 }, // 미응답 → 제외
      { itemKey: 'content', qtype: 'content', firstOk: false, tries: 1 }, // 응답(오답) → 기록
      { itemKey: '〜です', qtype: 'pattern', firstOk: true, tries: 1 },
    ]);
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.detail.qtype)).toEqual(['content', 'pattern']);
    expect(events[0].correct).toBe(false); // 응답한 content 오답은 그대로 남는다
  });

  it('빈/깨진 입력 방어', () => {
    expect(buildReadingEvents('t1', null)).toEqual([]);
    expect(buildReadingEvents('t1', [null, { qtype: 'pattern', tries: 1 }])).toEqual([]); // itemKey 없음
  });
});

// ── P2-9: content 문항 item_key 고유화 — 'content' 는 글마다 겹쳐 약점 집계를 오염시킨다 ──
describe('buildReadingEvents — content item_key 는 textId#c<index> 로 글·위치별 고유', () => {
  it('content 는 넘긴 index 로 textId#c<index> 키를 만든다(pattern 은 문형 문자열 유지)', () => {
    const events = buildReadingEvents('n5-tokyo-03', [
      { itemKey: '〜か', qtype: 'pattern', firstOk: true, tries: 1, index: 0 },
      { itemKey: 'content', qtype: 'content', firstOk: false, tries: 1, index: 1 },
      { itemKey: 'content', qtype: 'content', firstOk: true, tries: 1, index: 2 },
    ]);
    expect(events.map((e) => e.item_key)).toEqual(['〜か', 'n5-tokyo-03#c1', 'n5-tokyo-03#c2']);
  });

  it('다른 글의 같은 위치 content 는 서로 다른 키 — 한 키로 뭉개지지 않는다', () => {
    const a = buildReadingEvents('n5-tokyo-01', [{ itemKey: 'content', qtype: 'content', firstOk: true, tries: 1, index: 0 }]);
    const b = buildReadingEvents('n5-tokyo-02', [{ itemKey: 'content', qtype: 'content', firstOk: true, tries: 1, index: 0 }]);
    expect(a[0].item_key).toBe('n5-tokyo-01#c0');
    expect(b[0].item_key).toBe('n5-tokyo-02#c0');
    expect(a[0].item_key).not.toBe(b[0].item_key);
  });

  it('index 미제공 시 순번(loop i)으로 대체 — 여전히 고유·안정', () => {
    const events = buildReadingEvents('t1', [
      { itemKey: 'content', qtype: 'content', firstOk: true, tries: 1 },
      { itemKey: 'content', qtype: 'content', firstOk: true, tries: 1 },
    ]);
    expect(events.map((e) => e.item_key)).toEqual(['t1#c0', 't1#c1']);
  });
});

// ── P3-11: 안정 문항 id(q.id) 우선 — index 파생 키는 문항 추가·재배열에 취약하므로 폴백으로만 ──
describe('buildReadingEvents — content item_key 는 안정 id(q.id)를 우선 사용(P3-11)', () => {
  it('content 는 넘긴 id 를 그대로 item_key 로 쓴다(index 파생 아님)', () => {
    const events = buildReadingEvents('n5-tokyo-01', [
      { itemKey: '〜です', id: 'n5-tokyo-01-q1', qtype: 'pattern', firstOk: true, tries: 1, index: 0 },
      { itemKey: 'content', id: 'n5-tokyo-01-q5', qtype: 'content', firstOk: true, tries: 1, index: 4 },
      { itemKey: 'content', id: 'n5-tokyo-01-q6', qtype: 'content', firstOk: false, tries: 1, index: 5 },
    ]);
    // pattern 은 문형 문자열 유지, content 는 안정 id 사용(#c<index> 아님)
    expect(events.map((e) => e.item_key)).toEqual(['〜です', 'n5-tokyo-01-q5', 'n5-tokyo-01-q6']);
  });

  it('문항 추가로 위치가 밀려도 id 키는 안정 — 같은 문항은 같은 키', () => {
    const before = buildReadingEvents('n5-tokyo-01', [
      { itemKey: 'content', id: 'n5-tokyo-01-q5', qtype: 'content', firstOk: true, tries: 1, index: 4 },
    ]);
    const after = buildReadingEvents('n5-tokyo-01', [
      { itemKey: 'content', id: 'n5-tokyo-01-q5', qtype: 'content', firstOk: true, tries: 1, index: 6 }, // 위치 이동
    ]);
    expect(before[0].item_key).toBe(after[0].item_key); // index 가 달라도 동일
    expect(before[0].item_key).toBe('n5-tokyo-01-q5');
  });

  it('id 부재 시에만 레거시 #c<index> 폴백', () => {
    const events = buildReadingEvents('t1', [
      { itemKey: 'content', qtype: 'content', firstOk: true, tries: 1, index: 2 }, // id 없음 → 폴백
    ]);
    expect(events[0].item_key).toBe('t1#c2');
  });
});

// ── P2-8: 문항 응답 누적·잠금(accumulateAnswer) — 이중 클릭 이중 채점 차단 ──
describe('accumulateAnswer — 게이팅·잠금·firstOk 규칙(QuestionFlow 단일 원천)', () => {
  it('첫 응답: cur 없으면 tries 1·firstOk = 이번 정오', () => {
    expect(accumulateAnswer(undefined, { ok: true, gating: true })).toEqual({ ok: true, tries: 1, firstOk: true });
    expect(accumulateAnswer(undefined, { ok: false, gating: true })).toEqual({ ok: false, tries: 1, firstOk: false });
  });

  it('게이팅 재시도: firstOk 는 최초 시도로 고정, tries 만 누적', () => {
    const first = accumulateAnswer(undefined, { ok: false, gating: true }); // 오답
    const second = accumulateAnswer(first, { ok: true, gating: true });     // 재시도 정답
    expect(second).toEqual({ ok: true, tries: 2, firstOk: false }); // 최초 오답 기록 보존
  });

  it('정답 확정 문항은 재선택 무시(null) — 이중 클릭이 tries 를 늘리지 못한다', () => {
    const ok = accumulateAnswer(undefined, { ok: true, gating: true });
    expect(accumulateAnswer(ok, { ok: true, gating: true })).toBeNull();
    expect(accumulateAnswer(ok, { ok: false, gating: true })).toBeNull();
  });

  it('content(비게이팅)는 첫 응답으로 잠금 — 이후 클릭 무시(null)', () => {
    const first = accumulateAnswer(undefined, { ok: false, gating: false });
    expect(first).toEqual({ ok: false, tries: 1, firstOk: false });
    expect(accumulateAnswer(first, { ok: true, gating: false })).toBeNull(); // 재응답 차단
  });

  it('동기 ref 시나리오: 같은 확정 기록에 대한 2회째 pick 은 무시되어 이벤트가 1개로 유지된다', () => {
    // ref 가 첫 클릭 결과(cur)를 동기 보유 → 2회째 pick 은 accumulateAnswer 가 null → 무시.
    let cur = accumulateAnswer(undefined, { ok: true, gating: false }); // content 첫 응답 확정
    const second = accumulateAnswer(cur, { ok: true, gating: false });
    if (second) cur = second; // 실제 pick 은 null 이면 반영하지 않음
    // 최종 결과로 buildReadingEvents 를 만들면 문항당 이벤트 1개
    const events = buildReadingEvents('t1', [{ itemKey: cur.picked, qtype: 'content', firstOk: cur.firstOk, tries: cur.tries, index: 0 }]);
    expect(events).toHaveLength(1);
    expect(events[0].detail.tries).toBe(1); // 이중 클릭에도 tries 1 유지
  });
});

// ── P2-8: 로그인 동기화 백필 — 기존 큐 조회로 중복 방지 ──
describe('missingReviewSlugs — grammar_review 백필 대상 계산', () => {
  it('큐에 없는 글만 rt: slug 로 — 이미 큐에 있는 글은 재등록하지 않는다(중복 방지)', () => {
    const passed = new Set(['n5-tokyo-01', 'n5-tokyo-02', 'n5-tokyo-03']);
    const queued = ['rt:n5-tokyo-02'];
    expect(missingReviewSlugs(passed, queued)).toEqual(['rt:n5-tokyo-01', 'rt:n5-tokyo-03']);
  });

  it('전부 큐에 있으면 빈 배열 — 이중 등록 0', () => {
    const passed = new Set(['n5-tokyo-01']);
    expect(missingReviewSlugs(passed, ['rt:n5-tokyo-01'])).toEqual([]);
  });

  it('드릴은 글 단위 SRS 대상이 아니라 백필에서도 제외(handlePass 와 동일 규약)', () => {
    expect(isReadingDrillId(drillId(0))).toBe(true);
    expect(isReadingDrillId('n5-tokyo-01')).toBe(false);
    const passed = new Set(['n5-tokyo-01', drillId(0)]);
    expect(missingReviewSlugs(passed, [])).toEqual(['rt:n5-tokyo-01']);
  });

  it('빈/누락 입력 방어', () => {
    expect(missingReviewSlugs(null, null)).toEqual([]);
    expect(missingReviewSlugs(new Set(), ['rt:x'])).toEqual([]);
  });
});
