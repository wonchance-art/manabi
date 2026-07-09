import { describe, it, expect } from 'vitest';

// readingProgress → supabase.js 가 모듈 로드 시 env 를 요구하므로 스텁 후 동적 import
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
const {
  READING_LANG,
  buildReadingEvents,
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
