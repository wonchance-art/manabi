import { describe, it, expect } from 'vitest';

// readingPayload → readingProgress → supabase.js 가 모듈 로드 시 env 를 요구하므로 스텁 후 동적 import
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
const { questionOpenIds, buildTrackPayload } = await import('../readingPayload');
const { drillId } = await import('../readingProgress');

// 소형 트랙 픽스처 — 글 3편 + 드릴 2개(글 1·2 뒤). 문항엔 answer·why(정답표)가 실려 있어
// 스트립 검증의 표적이 된다. 잠금 체인: 글1 → 드릴0 → 글2 → 드릴1 → 글3.
const track = {
  track: 'n5-tokyo',
  title: '도쿄 도착',
  level: 'N5',
  estWeeks: 5,
  texts: [
    {
      id: 'n5-tokyo-01', order: 1, title: '여권 확인', situation: '입국심사',
      place: { name: '하네다 공항', ja: '羽田空港' }, frame: 'dialogue',
      newPatterns: ['〜です'],
      body: [{ ja: 'ミンジュンです。', yomi: 'みんじゅんです。', ko: '민준입니다.' }],
      questions: [{ type: 'pattern', pattern: '〜です', q: 'Q1', choices: ['a1', 'b1'], answer: 0, why: 'W1' }],
    },
    {
      id: 'n5-tokyo-02', order: 2, title: '전철 타기', situation: '이동',
      place: { name: '시나가와', ja: '品川' }, frame: 'dialogue',
      newPatterns: ['〜の'],
      body: [{ ja: 'わたしの きっぷです。', yomi: 'わたしの きっぷです。', ko: '제 표입니다.' }],
      questions: [{ type: 'pattern', pattern: '〜の', q: 'Q2', choices: ['a2', 'b2'], answer: 1, why: 'W2' }],
    },
    {
      id: 'n5-tokyo-03', order: 3, title: '호텔 도착', situation: '체크인',
      place: { name: '신주쿠', ja: '新宿' }, frame: 'dialogue',
      newPatterns: ['〜か'],
      body: [{ ja: 'ホテルですか。', yomi: 'ほてるですか。', ko: '호텔입니까?' }],
      questions: [{ type: 'content', q: 'Q3', choices: ['a3', 'b3'], answer: 0, why: 'W3' }],
    },
  ],
  drills: [
    {
      afterOrder: 1, title: '드릴 1', style: 'form-choice', patterns: ['〜です'],
      items: [{ q: 'D1', ja: 'これ___です。', choices: ['x1', 'y1'], answer: 1, why: 'DW1' }],
    },
    {
      afterOrder: 2, title: '드릴 2', style: 'form-choice', patterns: ['〜の'],
      items: [{ q: 'D2', choices: ['x2', 'y2'], answer: 0, why: 'DW2' }],
    },
  ],
};

const d0 = drillId(0);
const d1 = drillId(1);

describe('questionOpenIds — 문항 포함 범위(통과 + 열린 노드 1, 선전송 없음 P2-6)', () => {
  it('게스트(빈 통과 집합)는 order 1 글만 연다 — 드릴 선전송 없음', () => {
    const open = questionOpenIds(track, new Set());
    expect([...open]).toEqual(['n5-tokyo-01']); // 그 위치 드릴조차 글1 통과 전엔 잠금
  });

  it('글1 통과 시 열린 노드는 드릴0 하나 — 다음 글은 아직 잠긴다', () => {
    // 글1 통과 → 잠금 체인상 열린 노드는 드릴0. 글2 는 드릴 통과 후 재조회 몫.
    const open = questionOpenIds(track, new Set(['n5-tokyo-01']));
    expect(open.has('n5-tokyo-01')).toBe(true);
    expect(open.has(d0)).toBe(true);
    expect(open.has('n5-tokyo-02')).toBe(false);
  });

  it('드릴까지 통과하면 다음 글이 열린다 — 그 위치 드릴은 선전송 안 함', () => {
    const open = questionOpenIds(track, new Set(['n5-tokyo-01', d0]));
    expect([...open].sort()).toEqual([d0, 'n5-tokyo-01', 'n5-tokyo-02'].sort());
    expect(open.has(d1)).toBe(false); // 글2 위치 드릴은 글2 통과 후에야 열림
    expect(open.has('n5-tokyo-03')).toBe(false); // 두 칸 앞은 여전히 잠금
  });

  it('전부 통과하면 전 노드가 열린다', () => {
    const open = questionOpenIds(track, new Set(['n5-tokyo-01', d0, 'n5-tokyo-02', d1, 'n5-tokyo-03']));
    expect(open.size).toBe(5);
  });
});

// P2-6: 선전송 제거 — 서버 payload 는 순수하게 nodeStates(passed·open)만 문항을 싣는다.
// 같은 afterOrder 에 드릴이 2개여도, 어떤 드릴도 앞 노드 통과 전엔 open 이 아니다.
describe('questionOpenIds — 선전송 제거로 잠긴 드릴 정답표 미노출(P2-6)', () => {
  const twoDrill = {
    ...track,
    drills: [
      { afterOrder: 1, title: '드릴 1a', style: 'form-choice', patterns: ['〜です'],
        items: [{ q: 'D1a', choices: ['x', 'y'], answer: 0, why: 'W' }] },
      { afterOrder: 1, title: '드릴 1b', style: 'form-choice', patterns: ['〜です'],
        items: [{ q: 'D1b', choices: ['x', 'y'], answer: 1, why: 'W' }] },
    ],
  };

  it('게스트: order1 글만 열리고 두 드릴 모두 잠긴다(선전송 없음)', () => {
    const open = questionOpenIds(twoDrill, new Set());
    expect(open.has('n5-tokyo-01')).toBe(true);
    expect(open.has(drillId(0))).toBe(false); // 글1 통과 전이므로 잠금
    expect(open.has(drillId(1))).toBe(false);
    expect(open.size).toBe(1);
  });

  it('첫 드릴 통과 시에만 2번째 드릴이 열린다(1칸씩 전진)', () => {
    const open = questionOpenIds(twoDrill, new Set(['n5-tokyo-01', drillId(0)]));
    expect(open.has(drillId(1))).toBe(true);
    // 열린 노드가 드릴(drill1)이라 그 뒤 글은 선전송 없음
    expect(open.has('n5-tokyo-02')).toBe(false);
  });

  it('buildTrackPayload: 게스트 땐 두 드릴 items 가 빈 배열·정답 미노출', () => {
    const payload = buildTrackPayload(twoDrill, new Set());
    expect(payload.drills[0].items).toEqual([]);      // 선전송 제거 — 글1 통과 전 스트립
    expect(payload.drills[0].stripped).toBe(true);
    expect(payload.drills[1].items).toEqual([]);
    expect(payload.drills[1].stripped).toBe(true);
    expect(JSON.stringify(payload.drills)).not.toContain('"answer"');
  });
});

describe('buildTrackPayload — 잠긴 노드의 정답표(answer·why) 스트립', () => {
  it('잠긴 글은 questions 가 빈 배열이고 직렬화 결과에 answer/why 가 없다', () => {
    const payload = buildTrackPayload(track, new Set()); // 게스트
    const t2 = payload.texts.find((t) => t.id === 'n5-tokyo-02');
    const t3 = payload.texts.find((t) => t.id === 'n5-tokyo-03');
    for (const t of [t2, t3]) {
      expect(t.questions).toEqual([]);
      expect(t.stripped).toBe(true);
      // RSC 응답에 실리는 형태 그대로 검사 — 정답표 키 자체가 없어야 한다
      const json = JSON.stringify(t);
      expect(json).not.toContain('"answer"');
      expect(json).not.toContain('"why"');
    }
  });

  it('잠긴 드릴도 items 가 빈 배열로 스트립된다', () => {
    const payload = buildTrackPayload(track, new Set(['n5-tokyo-01'])); // 드릴0 이 열린 노드
    const locked = payload.drills[1]; // afterOrder 2 — 잠금
    expect(locked.items).toEqual([]);
    expect(locked.stripped).toBe(true);
    expect(JSON.stringify(locked)).not.toContain('"answer"');
  });

  it('열린 글은 문항이 온전하고 stripped 표식이 없다(드릴은 선전송 안 함)', () => {
    const payload = buildTrackPayload(track, new Set());
    const t1 = payload.texts.find((t) => t.id === 'n5-tokyo-01');
    expect(t1.questions).toHaveLength(1);
    expect(t1.questions[0].answer).toBe(0);
    expect(t1.stripped).toBeUndefined();
    // order 1 위치 드릴은 글1 통과 전이므로 잠금(선전송 제거, P2-6)
    expect(payload.drills[0].items).toEqual([]);
    expect(payload.drills[0].stripped).toBe(true);
  });

  it('잠긴 글도 목록·진도 헤더 요건(title·situation·newPatterns·patterns)은 유지한다', () => {
    const payload = buildTrackPayload(track, new Set());
    const t3 = payload.texts.find((t) => t.id === 'n5-tokyo-03');
    expect(t3.title).toBe('호텔 도착');
    expect(t3.situation).toBe('체크인');
    expect(t3.newPatterns).toEqual(['〜か']);   // computeTrackProgress 의 문형 총계 재료
    expect(t3.body.length).toBeGreaterThan(0);  // 본문은 정답이 아니므로 유지
    expect(payload.drills[1].patterns).toEqual(['〜の']);
  });

  it('cardsFor 매퍼가 문형 사전 카드를 붙인다(기본값은 빈 배열)', () => {
    const cardsFor = (patterns) => (patterns || []).map((p) => ({ pattern: p, ko: '', explain: '', contrast: '', ex: null }));
    const payload = buildTrackPayload(track, new Set(), cardsFor);
    expect(payload.texts[0].patternCards).toEqual([{ pattern: '〜です', ko: '', explain: '', contrast: '', ex: null }]);
    expect(buildTrackPayload(track, new Set()).texts[0].patternCards).toEqual([]);
  });
});
