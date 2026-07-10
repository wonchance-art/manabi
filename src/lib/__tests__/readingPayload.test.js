import { describe, it, expect, vi } from 'vitest';
import realTrack from '../../content/japanese/reading/n5_tokyo';
import bunkeiN5 from '../../content/japanese/bunkei/n5';

// readingPayload → readingProgress → supabase.js 가 모듈 로드 시 env 를 요구하므로 스텁 후 동적 import
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
const {
  contiguousPassedIds,
  questionOpenIds,
  buildTrackPayload,
  createPatternCardResolver,
} = await import('../readingPayload');
const { drillId } = await import('../readingProgress');

// 소형 트랙 픽스처 — 글 3편 + 드릴 2개(글 1·2 뒤).
// 잠금 체인: 글1 → 드릴0 → 글2 → 드릴1 → 글3.
const track = {
  track: 'n5-tokyo',
  title: '도쿄 도착',
  level: 'N5',
  estWeeks: 5,
  texts: [
    {
      id: 'n5-tokyo-01', order: 1, title: '여권 확인', situation: '입국심사',
      place: { name: '하네다 공항', ja: '羽田空港', landmark: 'airport' }, frame: 'dialogue',
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
      afterOrder: 1, title: '드릴 1', style: 'form-choice', patterns: ['〜は'],
      items: [{ q: 'D1', ja: 'これ___です。', choices: ['x1', 'y1'], answer: 1, why: 'DW1' }],
    },
    {
      afterOrder: 2, title: '드릴 2', style: 'form-choice', patterns: ['〜を'],
      items: [{ q: 'D2', choices: ['x2', 'y2'], answer: 0, why: 'DW2' }],
    },
  ],
};

const cardsFor = (patterns) => (patterns || []).map((pattern) => ({
  pattern, ko: `뜻:${pattern}`, explain: `설명:${pattern}`, contrast: '', ex: null,
}));
const d0 = drillId(0);
const d1 = drillId(1);

describe('questionOpenIds — 상세 요청 허용 범위(통과 + 열린 노드 1)', () => {
  it('게스트(빈 통과 집합)는 order 1 글만 연다', () => {
    expect([...questionOpenIds(track, new Set())]).toEqual(['n5-tokyo-01']);
  });

  it('글1 통과 시 드릴0 하나가 추가로 열린다', () => {
    const open = questionOpenIds(track, new Set(['n5-tokyo-01']));
    expect(open.has('n5-tokyo-01')).toBe(true);
    expect(open.has(d0)).toBe(true);
    expect(open.has('n5-tokyo-02')).toBe(false);
  });

  it('드릴까지 통과하면 다음 글이 열리고 그 위치 드릴은 선전송하지 않는다', () => {
    const open = questionOpenIds(track, new Set(['n5-tokyo-01', d0]));
    expect([...open].sort()).toEqual([d0, 'n5-tokyo-01', 'n5-tokyo-02'].sort());
    expect(open.has(d1)).toBe(false);
    expect(open.has('n5-tokyo-03')).toBe(false);
  });

  it('전부 통과하면 전 노드가 재열람 가능하다', () => {
    const open = questionOpenIds(track, new Set(['n5-tokyo-01', d0, 'n5-tokyo-02', d1, 'n5-tokyo-03']));
    expect(open.size).toBe(5);
  });

  it('선행 체인이 빈 비연속 rt: 행은 통과 권한으로 인정하지 않는다', () => {
    expect([...contiguousPassedIds(track, new Set(['n5-tokyo-03']))]).toEqual([]);
    expect([...questionOpenIds(track, new Set(['n5-tokyo-03']))]).toEqual(['n5-tokyo-01']);
    expect([...questionOpenIds(realTrack, new Set(['n5-tokyo-30']))]).toEqual(['n5-tokyo-01']);
  });
});

describe('questionOpenIds — 같은 위치 복수 드릴도 한 칸씩 전진', () => {
  const twoDrill = {
    ...track,
    drills: [
      { afterOrder: 1, title: '드릴 1a', patterns: ['〜は'], items: [{ q: 'D1a', answer: 0, why: 'W' }] },
      { afterOrder: 1, title: '드릴 1b', patterns: ['〜を'], items: [{ q: 'D1b', answer: 1, why: 'W' }] },
    ],
  };

  it('게스트는 두 드릴 모두 잠그고 order1 글만 연다', () => {
    const open = questionOpenIds(twoDrill, new Set());
    expect([...open]).toEqual(['n5-tokyo-01']);
  });

  it('첫 드릴 통과 뒤에만 두 번째 드릴을 연다', () => {
    const open = questionOpenIds(twoDrill, new Set(['n5-tokyo-01', drillId(0)]));
    expect(open.has(drillId(1))).toBe(true);
    expect(open.has('n5-tokyo-02')).toBe(false);
  });

  it('잠긴 드릴 id 직접 요청은 상세를 만들지 않는다', () => {
    const resolver = vi.fn(cardsFor);
    const payload = buildTrackPayload(twoDrill, new Set(), resolver, drillId(0));
    expect(payload.selection).toEqual({ id: drillId(0), kind: 'drill', status: 'locked', detail: null });
    expect(resolver).not.toHaveBeenCalled();
    expect(JSON.stringify(payload)).not.toContain('D1a');
  });
});

describe('buildTrackPayload — 목록 manifest + 선택 상세 1개', () => {
  it('목록에는 상태 표시·진도용 최소 메타데이터만 남긴다', () => {
    const payload = buildTrackPayload(track, new Set(), cardsFor);

    expect(payload.selection).toBeNull();
    expect(payload.patternsTotal).toBe(5);
    expect(Object.keys(payload.texts[0])).toEqual([
      'id', 'order', 'title', 'place', 'situation', 'patternCount',
    ]);
    expect(payload.texts[0].place).toEqual({ name: '하네다 공항', ja: '羽田空港' });
    expect(Object.keys(payload.drills[0])).toEqual(['id', 'afterOrder', 'title', 'patternCount']);

    const manifest = JSON.stringify({ texts: payload.texts, drills: payload.drills });
    for (const heavyKey of ['body', 'questions', 'items', 'patternCards', 'newPatterns', 'patterns', 'answer', 'why']) {
      expect(manifest).not.toContain(`"${heavyKey}"`);
    }
  });

  it('게스트가 열린 글1을 요청하면 그 상세만 온전히 싣는다', () => {
    const resolver = vi.fn(cardsFor);
    const payload = buildTrackPayload(track, new Set(), resolver, 'n5-tokyo-01');

    expect(payload.selection.id).toBe('n5-tokyo-01');
    expect(payload.selection.kind).toBe('text');
    expect(payload.selection.status).toBe('open');
    expect(payload.selection.detail.body).toEqual(track.texts[0].body);
    expect(payload.selection.detail.questions[0]).toMatchObject({ answer: 0, why: 'W1' });
    expect(payload.selection.detail.patternCards).toHaveLength(1);
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(resolver).toHaveBeenCalledWith(['〜です']);

    const json = JSON.stringify(payload);
    expect(json).not.toContain('わたしの きっぷです。');
    expect(json).not.toContain('"q":"Q2"');
    expect(json).not.toContain('"q":"D1"');
  });

  it('잠긴 글 요청은 상태만 알려주고 본문·정답·문형 카드를 만들지 않는다', () => {
    const resolver = vi.fn(cardsFor);
    const payload = buildTrackPayload(track, new Set(), resolver, 'n5-tokyo-02');

    expect(payload.selection).toEqual({
      id: 'n5-tokyo-02', kind: 'text', status: 'locked', detail: null,
    });
    expect(resolver).not.toHaveBeenCalled();
    const json = JSON.stringify(payload);
    expect(json).not.toContain('わたしの きっぷです。');
    expect(json).not.toContain('W2');
    expect(json).not.toContain('설명:〜の');
  });

  it('비연속 통과 행으로 요청한 후속 글도 서버에서 잠근다', () => {
    const resolver = vi.fn(cardsFor);
    const payload = buildTrackPayload(
      track,
      new Set(['n5-tokyo-03']),
      resolver,
      'n5-tokyo-03',
      'account-a'
    );
    expect(payload.viewerScope).toBe('account-a');
    expect(payload.selection).toEqual({
      id: 'n5-tokyo-03', kind: 'text', status: 'locked', detail: null,
    });
    expect(resolver).not.toHaveBeenCalled();
  });

  it('통과한 과거 글은 한 노드씩 재열람할 수 있다', () => {
    const payload = buildTrackPayload(
      track,
      new Set(['n5-tokyo-01', d0]),
      cardsFor,
      'n5-tokyo-01'
    );
    expect(payload.selection.status).toBe('passed');
    expect(payload.selection.detail.questions).toHaveLength(1);
  });

  it('글1 통과 뒤 열린 드릴0 요청에만 items를 싣는다', () => {
    const before = buildTrackPayload(track, new Set(), cardsFor, d0);
    expect(before.selection.status).toBe('locked');
    expect(before.selection.detail).toBeNull();

    const after = buildTrackPayload(track, new Set(['n5-tokyo-01']), cardsFor, d0);
    expect(after.selection.status).toBe('open');
    expect(after.selection.detail.items).toEqual(track.drills[0].items);
    expect(after.selection.detail.patternCards[0].pattern).toBe('〜は');
    expect(JSON.stringify(after)).not.toContain('"q":"D2"');
  });

  it('없는 id 요청도 상세 없이 fail-closed 한다', () => {
    const resolver = vi.fn(cardsFor);
    const payload = buildTrackPayload(track, new Set(), resolver, 'n5-tokyo-404');
    expect(payload.selection).toEqual({
      id: 'n5-tokyo-404', kind: null, status: 'missing', detail: null,
    });
    expect(resolver).not.toHaveBeenCalled();
  });

  it('실제 게스트의 열린 글 상세 포함 payload가 20KB 미만이다', () => {
    const resolver = createPatternCardResolver(bunkeiN5);
    const payload = buildTrackPayload(realTrack, new Set(), resolver, 'n5-tokyo-01');
    const bytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');

    expect(questionOpenIds(realTrack, new Set())).toEqual(new Set(['n5-tokyo-01']));
    expect(payload.patternsTotal).toBe(125);
    expect(payload.selection.detail.body.length).toBeGreaterThan(0);
    expect(payload.selection.detail.questions.length).toBeGreaterThan(0);
    expect(bytes).toBeLessThan(20 * 1024);
  });
});
