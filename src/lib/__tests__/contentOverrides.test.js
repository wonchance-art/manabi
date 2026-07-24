import { describe, it, expect } from 'vitest';
import { mergeChapter, isValidOverride, missingStoryIds } from '../contentOverrides';

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

  it('dialogue 예문은 화자·원어 1개·선택 IPA·번역 구조로 통과한다', () => {
    expect(isValidOverride({
      sections: [{
        examples: [{
          dialogue: [
            { speaker: '여행자', fr: 'Bonjour.', ipa: '[bɔ̃ʒuʁ]', ko: '안녕하세요.' },
            { speaker: '직원', ja: 'こんにちは。', ko: '안녕하세요.' },
            { speaker: 'Traveler', en: 'Hello.', ipa: '[həˈloʊ]', ko: '안녕하세요.' },
            { speaker: '旅客', zh: '你好。', ipa: '[ni˨˩˦ xɑʊ˨˩˦]', ko: '안녕하세요.' },
          ],
          note: '상황에 맞는 인사를 골라요.',
        }],
      }],
    })).toBe(true);
  });

  it.each([
    ['빈 dialogue', { dialogue: [] }],
    ['배열이 아닌 dialogue', { dialogue: {} }],
    ['화자 누락', { dialogue: [{ fr: 'Bonjour.', ko: '안녕하세요.' }] }],
    ['번역 누락', { dialogue: [{ speaker: '여행자', fr: 'Bonjour.' }] }],
    ['원어 누락', { dialogue: [{ speaker: '여행자', ko: '안녕하세요.' }] }],
    ['원어 복수', { dialogue: [{ speaker: '여행자', fr: 'Bonjour.', en: 'Hello.', ko: '안녕하세요.' }] }],
    ['빈 필수 문자열', { dialogue: [{ speaker: ' ', fr: 'Bonjour.', ko: '안녕하세요.' }] }],
    ['빈 선택 IPA', { dialogue: [{ speaker: '여행자', fr: 'Bonjour.', ipa: '', ko: '안녕하세요.' }] }],
    ['허용 밖 line 키', { dialogue: [{ speaker: '여행자', fr: 'Bonjour.', ko: '안녕하세요.', note: 'x' }] }],
    ['flat 필드 혼합', { dialogue: [{ speaker: '여행자', fr: 'Bonjour.', ko: '안녕하세요.' }], fr: 'Bonjour.' }],
    ['flat 번역 혼합', { dialogue: [{ speaker: '여행자', fr: 'Bonjour.', ko: '안녕하세요.' }], ko: '안녕하세요.' }],
  ])('잘못된 dialogue 예문을 거부한다: %s', (_label, example) => {
    expect(isValidOverride({ sections: [{ examples: [example] }] })).toBe(false);
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

  // ── Codex 4차 P1: 고급 섹션 키(enParallel·hanjaBridge·gojuon) + 화이트리스트 ──
  it('enParallel.rows 원소가 평평한 객체가 아니면 거부한다', () => {
    expect(isValidOverride({ sections: [{ heading: 'x', enParallel: { rows: [null] } }] })).toBe(false);
    expect(isValidOverride({ sections: [{ enParallel: { rows: [{ en: {} }] } }] })).toBe(false);
    expect(isValidOverride({ sections: [{ enParallel: { rows: [{ en: 'e', fr: 'f', ko: 'k' }], note: 'n' } }] })).toBe(true);
    expect(isValidOverride({ sections: [{ enParallel: { rows: [{ en: 'e' }], note: {} } }] })).toBe(false);
  });

  it('hanjaBridge.rows 원소가 평평한 객체가 아니면 거부한다', () => {
    expect(isValidOverride({ sections: [{ hanjaBridge: { rows: [null] } }] })).toBe(false);
    expect(isValidOverride({ sections: [{ hanjaBridge: { rows: [{ zh: '简', trad: '繁', ja: '日', read: 'r', ko: 'k' }] } }] })).toBe(true);
  });

  it('gojuon이 스칼라 배열이 아니면 거부한다 (GojuonChart sets.includes 소비)', () => {
    expect(isValidOverride({ sections: [{ gojuon: {} }] })).toBe(false);
    expect(isValidOverride({ sections: [{ gojuon: [{}] }] })).toBe(false);
    expect(isValidOverride({ sections: [{ gojuon: ['basic', 'dakuten'] }] })).toBe(true);
  });

  it('화이트리스트 밖의 키는 챕터·섹션 어느 층에서든 거부한다', () => {
    expect(isValidOverride({ sections: [{ quiz: { anything: 1 } }] })).toBe(false); // 소비자 없는 키
    expect(isValidOverride({ sections: [{ unknownKey: 'x' }] })).toBe(false);
    expect(isValidOverride({ title: 'ok', unknownChapterKey: {} })).toBe(false);
  });

  it('kanjiExempt는 스칼라 배열만 허용한다', () => {
    expect(isValidOverride({ kanjiExempt: ['新幹線'] })).toBe(true);
    expect(isValidOverride({ kanjiExempt: [{}] })).toBe(false);
  });
});

// ── Codex 검수(#79): story 문항 id 불변 — 저장 API의 최종 방어 ──
describe('missingStoryIds', () => {
  const storyBase = {
    slug: 'x', level: 'N5', order: 1,
    sections: [
      { heading: 'a' },
      { heading: 'b', story: { body: [{ narr: 'n' }], questions: [{ id: 'x-sq1', type: 'fill' }, { id: 'x-sq2', type: 'produce' }] } },
    ],
  };

  it('id가 그대로면 위반 없음 (내용 수정·새 문항 추가 허용)', () => {
    const data = structuredClone(storyBase);
    data.sections[1].story.questions[0].q = '수정된 질문';
    data.sections[1].story.questions.push({ id: 'x-sq3', type: 'fill' });
    expect(missingStoryIds(storyBase, data)).toEqual([]);
  });

  it('문항 삭제를 잡는다', () => {
    const data = structuredClone(storyBase);
    data.sections[1].story.questions.pop();
    expect(missingStoryIds(storyBase, data)).toEqual(['x-sq2']);
  });

  it('id 오타(변경)를 잡는다', () => {
    const data = structuredClone(storyBase);
    data.sections[1].story.questions[0].id = 'x-sq1-typo';
    expect(missingStoryIds(storyBase, data)).toEqual(['x-sq1']);
  });

  it('문항이 다른 섹션으로 이동해도 id가 살아있으면 통과', () => {
    const data = structuredClone(storyBase);
    const q = data.sections[1].story.questions.shift();
    data.sections[0].story = { body: [{ narr: 'moved' }], questions: [q] };
    expect(missingStoryIds(storyBase, data)).toEqual([]);
  });

  it('sections 없는 부분 오버라이드는 검증 대상 아님 (얕은 병합이 base 유지)', () => {
    expect(missingStoryIds(storyBase, { title: '제목만' })).toEqual([]);
  });

  it('story 없는 챕터는 항상 통과', () => {
    expect(missingStoryIds(base, { sections: [{ heading: 'h' }] })).toEqual([]);
  });
});

// 에디터는 전체 챕터 JSON을 저장하므로, 실제 챕터 전부가 무수정 상태로 검증을
// 통과해야 한다(아니면 정상 저장이 400에 막힘). 전 언어·전 챕터 라운드트립 고정.
// 새 섹션 키를 콘텐츠에 도입하면 이 테스트가 먼저 깨진다 — 그때 화이트리스트와
// 검증 규칙을 함께 추가할 것(검증기-렌더러 차집합 방지).
describe('isValidOverride — 실제 챕터 전수 라운드트립 (4개 언어)', () => {
  // 대형 콘텐츠 전수 라운드트립 — 병렬 부하 flaky 방지(kyotoGeo/자갈치 선례의 명시 타임아웃).
  it.each(['japanese', 'french', 'english', 'chinese'])('%s 전 챕터가 검증을 통과한다', { timeout: 30_000 }, async (lang) => {
    const mod = await import(`../../content/${lang}`);
    const all = mod.default.ALL_CHAPTERS;
    expect(all.length).toBeGreaterThan(40);
    for (const ch of all) {
      expect(isValidOverride(ch), `챕터 ${ch.slug}가 검증에 걸림`).toBe(true);
    }
  });
});
