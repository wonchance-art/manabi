import { describe, it, expect } from 'vitest';
import { mergeChapter, isValidOverride } from '../contentOverrides';

const base = {
  slug: 'n5-04-desu-da',
  level: 'N5',
  order: 1,
  title: '원본 제목',
  topic: '원본 주제',
  summary: '원본 요약',
  sections: [{ heading: '원본 섹션' }],
};

describe('mergeChapter', () => {
  it('override의 필드로 얕게 병합한다', () => {
    const merged = mergeChapter(base, { title: '수정 제목', summary: '수정 요약' });
    expect(merged.title).toBe('수정 제목');
    expect(merged.summary).toBe('수정 요약');
    // override에 없는 필드는 base 유지
    expect(merged.topic).toBe('원본 주제');
    expect(merged.sections).toEqual([{ heading: '원본 섹션' }]);
  });

  it('slug·level·order는 override가 있어도 base 값을 강제한다', () => {
    const merged = mergeChapter(base, {
      slug: '해킹된-slug',
      level: 'N1',
      order: 999,
      title: '수정 제목',
    });
    expect(merged.slug).toBe('n5-04-desu-da');
    expect(merged.level).toBe('N5');
    expect(merged.order).toBe(1);
    expect(merged.title).toBe('수정 제목');
  });

  it('override가 null이면 base를 그대로 반환한다', () => {
    expect(mergeChapter(base, null)).toBe(base);
    expect(mergeChapter(base, undefined)).toBe(base);
  });

  it('override가 객체가 아니면 base를 그대로 반환한다', () => {
    expect(mergeChapter(base, 'not-an-object')).toBe(base);
    expect(mergeChapter(base, 42)).toBe(base);
  });

  it('base가 falsy면 그대로 반환한다', () => {
    expect(mergeChapter(null, { title: 'x' })).toBe(null);
    expect(mergeChapter(undefined, { title: 'x' })).toBe(undefined);
  });

  it('base에 없던 새 필드는 override로 추가된다', () => {
    const merged = mergeChapter(base, { duration: '약 8분' });
    expect(merged.duration).toBe('약 8분');
  });

  it('원본 객체를 변형하지 않는다(불변)', () => {
    const snapshot = JSON.parse(JSON.stringify(base));
    mergeChapter(base, { title: '수정', slug: 'x' });
    expect(base).toEqual(snapshot);
  });

  // ── Codex P1 회귀: malformed override는 fail-closed로 base 렌더 ──
  it('sections가 null인 override는 무시하고 base를 반환한다 (렌더 크래시 방지)', () => {
    expect(mergeChapter(base, { sections: null })).toBe(base);
  });

  it('sections가 배열이 아니거나 빈 배열인 override는 무시한다', () => {
    expect(mergeChapter(base, { sections: {} })).toBe(base);
    expect(mergeChapter(base, { sections: [] })).toBe(base);
    expect(mergeChapter(base, { sections: 'x' })).toBe(base);
  });

  it('섹션 항목이 객체가 아니면 무시한다', () => {
    expect(mergeChapter(base, { sections: [null] })).toBe(base);
    expect(mergeChapter(base, { sections: ['문자열'] })).toBe(base);
    expect(mergeChapter(base, { sections: [[1]] })).toBe(base);
  });

  it('문자열 필드에 비문자열이 오면 무시한다', () => {
    expect(mergeChapter(base, { title: 42 })).toBe(base);
    expect(mergeChapter(base, { sections: [{ heading: '유효', body: 123 }] })).toBe(base);
  });
});

describe('isValidOverride', () => {
  it('정상 오버라이드는 통과한다', () => {
    expect(isValidOverride({ title: '수정 제목' })).toBe(true);
    expect(isValidOverride({ sections: [{ heading: 'h', body: 'b', examples: [] }] })).toBe(true);
    expect(isValidOverride({ title: null, sections: [{ tip: null }] })).toBe(true); // null은 허용(렌더가 스킵)
  });

  it('렌더를 깨는 형태는 거부한다', () => {
    expect(isValidOverride(null)).toBe(false);
    expect(isValidOverride([])).toBe(false);
    expect(isValidOverride({ sections: null })).toBe(false);
    expect(isValidOverride({ sections: {} })).toBe(false);
    expect(isValidOverride({ sections: [] })).toBe(false);
    expect(isValidOverride({ sections: [{ examples: {} }] })).toBe(false);
    expect(isValidOverride({ summary: ['배열'] })).toBe(false);
  });

  // ── Codex 재검수 P1: 하위 컬렉션 원소까지 검증 ──
  it('examples 원소가 객체가 아니면 거부한다', () => {
    expect(isValidOverride({ sections: [{ heading: 'x', examples: [null] }] })).toBe(false);
    expect(isValidOverride({ sections: [{ examples: ['문자열'] }] })).toBe(false);
    expect(isValidOverride({ sections: [{ examples: [[1]] }] })).toBe(false);
    expect(isValidOverride({ sections: [{ examples: [{ ja: 'ok' }, null] }] })).toBe(false);
  });

  it('table.rows 원소가 배열이 아니면 거부한다', () => {
    expect(isValidOverride({ sections: [{ table: { headers: ['h'], rows: [null] } }] })).toBe(false);
    expect(isValidOverride({ sections: [{ table: { rows: ['행'] } }] })).toBe(false);
    expect(isValidOverride({ sections: [{ table: 'not-object' }] })).toBe(false);
    expect(isValidOverride({ sections: [{ table: { headers: 'x' } }] })).toBe(false);
  });

  it('story.body·questions가 객체 배열이 아니면 거부한다', () => {
    expect(isValidOverride({ sections: [{ story: { body: 'x' } }] })).toBe(false);
    expect(isValidOverride({ sections: [{ story: { body: [null] } }] })).toBe(false);
    expect(isValidOverride({ sections: [{ story: { body: [{ narr: 'ok' }], questions: [null] } }] })).toBe(false);
    expect(isValidOverride({ sections: [{ story: [] }] })).toBe(false);
  });

  it('media가 객체가 아니면 거부한다', () => {
    expect(isValidOverride({ sections: [{ media: 'youtube-id' }] })).toBe(false);
  });

  it('정상적인 중첩 구조는 통과한다', () => {
    expect(isValidOverride({
      sections: [{
        heading: 'h',
        examples: [{ ja: 'x', yomi: 'y', ko: 'z' }],
        table: { caption: 'c', headers: ['a'], rows: [['1', '2']] },
        story: { body: [{ narr: 'n' }, { ja: 'j', speaker: 's' }], questions: [{ type: 'fill' }] },
        media: { youtubeId: 'abc' },
      }],
    })).toBe(true);
  });

  it('malformed 하위 컬렉션은 mergeChapter에서도 fail-closed', () => {
    expect(mergeChapter(base, { sections: [{ examples: [null] }] })).toBe(base);
    expect(mergeChapter(base, { sections: [{ table: { rows: [null] } }] })).toBe(base);
    expect(mergeChapter(base, { sections: [{ story: { body: [null] } }] })).toBe(base);
  });

  // ── Codex 3차 P1: leaf가 스칼라가 아니면 거부 (React child 크래시 방지) ──
  it('table의 header·셀·caption leaf에 객체가 오면 거부한다', () => {
    expect(isValidOverride({ sections: [{ heading: 'x', table: { headers: [{}], rows: [['ok']] } }] })).toBe(false);
    expect(isValidOverride({ sections: [{ table: { headers: ['h'], rows: [[{}]] } }] })).toBe(false);
    expect(isValidOverride({ sections: [{ table: { caption: {}, headers: ['h'], rows: [['a']] } }] })).toBe(false);
  });

  it('example 텍스트 leaf에 객체가 오면 거부한다', () => {
    expect(isValidOverride({ sections: [{ examples: [{ ja: {} }] }] })).toBe(false);
    expect(isValidOverride({ sections: [{ examples: [{ ja: 'ok', ko: ['배열'] }] }] })).toBe(false);
  });

  it('story 본문·문항 leaf에 객체가 오면 거부한다', () => {
    expect(isValidOverride({ sections: [{ story: { body: [{ ja: {} }] } }] })).toBe(false);
    expect(isValidOverride({ sections: [{ story: { body: [{ narr: 'ok' }], questions: [{ why: {} }] } }] })).toBe(false);
    // 문항의 accept·model 같은 스칼라 배열은 허용
    expect(isValidOverride({ sections: [{ story: { body: [{ narr: 'ok' }], questions: [{ answer: 'a', accept: ['a', 'b'] }] } }] })).toBe(true);
  });

  it('media leaf에 객체가 오면 거부한다 (line만 평평한 객체 허용)', () => {
    expect(isValidOverride({ sections: [{ media: { youtubeId: 'x', songTitle: {} } }] })).toBe(false);
    expect(isValidOverride({ sections: [{ media: { youtubeId: 'x', line: { ja: 'l', ko: 'k' } } }] })).toBe(true);
    expect(isValidOverride({ sections: [{ media: { youtubeId: 'x', line: { ja: {} } } }] })).toBe(false);
  });
});

// 에디터는 전체 챕터 JSON을 저장하므로, 실제 챕터 전부가 무수정 상태로 검증을
// 통과해야 한다(아니면 정상 저장이 400에 막힘). 전 언어·전 챕터 라운드트립 고정.
describe('isValidOverride — 실제 챕터 전수 라운드트립', () => {
  it('일본어 전 챕터가 검증을 통과한다', async () => {
    const { ALL_CHAPTERS } = await import('../../content/japanese');
    expect(ALL_CHAPTERS.length).toBeGreaterThan(80);
    for (const ch of ALL_CHAPTERS) {
      expect(isValidOverride(ch), `챕터 ${ch.slug}가 검증에 걸림`).toBe(true);
    }
  });
});
