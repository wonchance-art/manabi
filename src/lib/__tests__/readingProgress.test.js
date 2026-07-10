import { describe, it, expect } from 'vitest';

// readingProgress → supabase.js 가 모듈 로드 시 env 를 요구하므로 스텁 후 동적 import
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
const {
  readingSlug,
  isReadingSlug,
  readingIdFromSlug,
  drillId,
  roundHalf,
  readingIdsFromRows,
  mergeReadingSet,
  computeTrackProgress,
  buildNodes,
  nodeStates,
} = await import('../readingProgress');

// 소형 트랙 픽스처 — 글 3편 + afterOrder 2 드릴 1개
const track = {
  track: 'n5-tokyo',
  level: 'N5',
  texts: [
    { id: 'n5-tokyo-01', order: 1, newPatterns: ['〜です', '〜か'] },
    { id: 'n5-tokyo-02', order: 2, newPatterns: ['〜が', '〜です'] }, // 〜です 중복 도입(계상 1회 검증용)
    { id: 'n5-tokyo-03', order: 3, newPatterns: ['〜に'] },
  ],
  drills: [{ afterOrder: 2, patterns: ['〜は', '〜を'] }],
};

describe('rt: slug 헬퍼 — 챕터 slug 와 네임스페이스 분리(RT-12)', () => {
  it('readingSlug/isReadingSlug/readingIdFromSlug 왕복', () => {
    expect(readingSlug('n5-tokyo-01')).toBe('rt:n5-tokyo-01');
    expect(isReadingSlug('rt:n5-tokyo-01')).toBe(true);
    expect(isReadingSlug('n5-04-desu-da')).toBe(false); // 챕터 slug 는 rt: 아님
    expect(readingIdFromSlug('rt:n5-tokyo-01')).toBe('n5-tokyo-01');
    expect(readingIdFromSlug('n5-04-desu-da')).toBe(null);
  });
  it('drillId 는 index 기반 합성', () => {
    expect(drillId(0)).toBe('n5-tokyo-drill-0');
  });
});

describe('readingIdsFromRows — rt: 필터·Set 분리', () => {
  it('rt: 이며 read=true 인 행만 취하고 챕터 행은 버린다', () => {
    const rows = [
      { slug: 'rt:n5-tokyo-01', read: true },
      { slug: 'rt:n5-tokyo-02', read: false }, // read=false 제외
      { slug: 'n5-04-desu-da', read: true }, // 챕터 slug 제외(오염 0)
      { slug: 'rt:n5-tokyo-03', read: true },
    ];
    const ids = readingIdsFromRows(rows);
    expect([...ids].sort()).toEqual(['n5-tokyo-01', 'n5-tokyo-03']);
  });
  it('빈/누락 입력 방어', () => {
    expect(readingIdsFromRows(null).size).toBe(0);
    expect(readingIdsFromRows(undefined).size).toBe(0);
  });
});

describe('mergeReadingSet — 로컬 Set 과 서버 행 합집합', () => {
  it('로컬 전용 + 서버 전용을 모두 보존, 챕터 행은 무시', () => {
    const local = new Set(['n5-tokyo-01']);
    const rows = [
      { slug: 'rt:n5-tokyo-02', read: true },
      { slug: 'n5-04-desu-da', read: true }, // 챕터 오염 금지
    ];
    const merged = mergeReadingSet(local, rows);
    expect([...merged].sort()).toEqual(['n5-tokyo-01', 'n5-tokyo-02']);
  });
});

describe('computeTrackProgress — 진도 산식(문형 합산·잔여 주)', () => {
  it('통과 없음', () => {
    const p = computeTrackProgress(track, new Set());
    expect(p.textsTotal).toBe(3);
    expect(p.textsPassed).toBe(0);
    expect(p.patternsCovered).toBe(0);
  });

  it('전 글·드릴 문형 유니크 집계', () => {
    // 유니크 문형: 〜です,〜か,〜が,〜に (글) + 〜は,〜を (드릴) = 6
    const p = computeTrackProgress(track, new Set());
    expect(p.patternsTotal).toBe(6);
  });

  it('통과 글의 문형만 합산하되 중복 문형은 1회', () => {
    // 글1(〜です,〜か) + 글2(〜が,〜です) 통과 → 유니크 covered = 〜です,〜か,〜が = 3
    const p = computeTrackProgress(track, new Set(['n5-tokyo-01', 'n5-tokyo-02']));
    expect(p.textsPassed).toBe(2);
    expect(p.patternsCovered).toBe(3);
  });

  it('드릴 통과분(patterns)도 합산', () => {
    const p = computeTrackProgress(track, new Set(['n5-tokyo-01', drillId(0)]));
    // 글1(〜です,〜か) + 드릴0(〜는,〜을) = 4
    expect(p.patternsCovered).toBe(4);
  });

  it('잔여 주 = roundHalf((total - passed)/7)', () => {
    expect(roundHalf(0.5)).toBe(0.5);
    expect(roundHalf(29 / 7)).toBe(4); // 4.14 → 4.0
    expect(roundHalf(25 / 7)).toBe(3.5); // 3.57 → 3.5
    const p = computeTrackProgress(track, new Set(['n5-tokyo-01']));
    expect(p.weeksRemaining).toBe(roundHalf(2 / 7)); // (3-1)/7 = 0.28 → 0.5
  });
});

describe('buildNodes / nodeStates — 잠금 체인(드릴 포함)', () => {
  it('드릴을 afterOrder 위치에 끼워 동선 순 노드 생성', () => {
    const nodes = buildNodes(track);
    expect(nodes.map((n) => n.kind)).toEqual(['text', 'text', 'drill', 'text']);
    expect(nodes.map((n) => n.id)).toEqual(['n5-tokyo-01', 'n5-tokyo-02', 'n5-tokyo-drill-0', 'n5-tokyo-03']);
  });

  it('첫 노드만 열림, 나머지 잠김', () => {
    const st = nodeStates(buildNodes(track), new Set());
    expect(st.map((n) => n.status)).toEqual(['open', 'locked', 'locked', 'locked']);
  });

  it('직전 노드 통과 시에만 다음이 열림 — 드릴이 체인을 막는다', () => {
    // 글1·글2 통과했지만 드릴 미통과 → 드릴이 open, 글3 은 locked
    const st = nodeStates(buildNodes(track), new Set(['n5-tokyo-01', 'n5-tokyo-02']));
    expect(st.map((n) => n.status)).toEqual(['passed', 'passed', 'open', 'locked']);
  });

  it('드릴까지 통과하면 다음 글이 열린다', () => {
    const st = nodeStates(buildNodes(track), new Set(['n5-tokyo-01', 'n5-tokyo-02', drillId(0)]));
    expect(st.map((n) => n.status)).toEqual(['passed', 'passed', 'passed', 'open']);
  });
});
