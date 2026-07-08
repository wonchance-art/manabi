import { describe, it, expect } from 'vitest';
import { buildPushCopy } from '../server/pushSend.js';

// buildPushCopy — 예보 × 연재 결합 카피 엔진 (docs/plan-v4-eyes-and-voice.md §4.2, 순수함수).
// 4분기: 둘 다 없음(침묵) · 예보만 · 새 화만 · 둘 다.
describe('buildPushCopy — 발송 카피 엔진', () => {
  const FORBIDDEN = ['밀림', '실패', '해야', '퍼센트'];
  function expectClean(body) {
    for (const w of FORBIDDEN) expect(body).not.toContain(w);
  }

  it('(a) 침묵 — 예보도 새 화도 없으면 null(발송하지 않음)', () => {
    expect(buildPushCopy({ falling: [], top3: [], hasNewEpisode: false, userNextReflected: false })).toBeNull();
    expect(buildPushCopy({})).toBeNull();
    // 새 prefetched 화는 있어도 어제 userNext가 반영되지 않았으면 "새 화" 이벤트로 치지 않는다.
    expect(buildPushCopy({ falling: [], top3: [], hasNewEpisode: true, userNextReflected: false })).toBeNull();
  });

  it('(b) 예보만 — 단수(개수 1개)', () => {
    const copy = buildPushCopy({
      falling: [{ word_text: '約束' }],
      top3: [{ word_text: '約束' }],
      hasNewEpisode: false,
      userNextReflected: false,
    });
    expect(copy).toEqual({
      title: 'manabi — 오늘의 이야기',
      body: "'約束'이(가) 오늘 밤 안개로 들어가요. 3분이면 붙잡아요.",
    });
    expectClean(copy.body);
  });

  it('(c) 예보만 — 복수(개수 N개, "외 N-1개가" 형태)', () => {
    const copy = buildPushCopy({
      falling: [{ word_text: '約束' }, { word_text: 'a' }, { word_text: 'b' }, { word_text: 'c' }],
      top3: [{ word_text: '約束' }, { word_text: 'a' }, { word_text: 'b' }],
      hasNewEpisode: false,
      userNextReflected: false,
    });
    expect(copy).toEqual({
      title: 'manabi — 오늘의 이야기',
      body: "'約束' 외 3개가 오늘 밤 안개로 들어가요. 3분이면 붙잡아요.",
    });
    expectClean(copy.body);
  });

  it('(d) 새 화만 — 새 prefetched 화가 어제 userNext를 반영했을 때만 성립', () => {
    const copy = buildPushCopy({
      falling: [],
      top3: [],
      hasNewEpisode: true,
      userNextReflected: true,
    });
    expect(copy).toEqual({
      title: 'manabi — 오늘의 이야기',
      body: '당신이 정한 전개로 다음 화가 도착했어요.',
    });
    expectClean(copy.body);
  });

  it('(e) 둘 다 — 새 화 + 예보 결합', () => {
    const copy = buildPushCopy({
      falling: [{ word_text: '約束' }],
      top3: [{ word_text: '約束' }],
      hasNewEpisode: true,
      userNextReflected: true,
    });
    expect(copy).toEqual({
      title: 'manabi — 오늘의 이야기',
      body: "당신이 정한 전개로 다음 화가 도착했어요. 그리고 '約束'이(가) 오늘 밤 안개로 들어가요.",
    });
    expectClean(copy.body);
  });

  it('(f) protagonist는 예약 필드 — 넘겨도 카피에 영향 없음(현재 카피 확정본은 인물명 미사용)', () => {
    const withName = buildPushCopy({
      falling: [], top3: [], hasNewEpisode: true, userNextReflected: true, protagonist: '미나',
    });
    const withoutName = buildPushCopy({
      falling: [], top3: [], hasNewEpisode: true, userNextReflected: true,
    });
    expect(withName).toEqual(withoutName);
  });
});
