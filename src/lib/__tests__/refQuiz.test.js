import { describe, it, expect } from 'vitest';
import { buildChapterQuiz, buildReviewQuiz } from '../refQuiz';

// 합성 챕터 — 패턴·예문이 빈칸/어순/생산 문항을 모두 만들 수 있는 최소 구성
const CHAPTER = {
  slug: 'test-01',
  level: 'N5',
  order: 1,
  sections: [
    {
      heading: 'A',
      pattern: '〜ながら',
      distractors: ['ばかり', 'ながらも', 'つつ'],
      examples: [
        { ja: '音楽を 聞きながら 勉強します。', yomi: 'おんがくを ききながら べんきょうします', ko: '음악을 들으면서 공부해요.' },
        { ja: 'コーヒーを 飲みながら 新聞を 読む。', yomi: 'こーひーを のみながら しんぶんを よむ', ko: '커피를 마시면서 신문을 읽는다.' },
      ],
    },
    {
      heading: 'B',
      pattern: '〜たい',
      examples: [
        { ja: '水が 飲みたい。', yomi: 'みずが のみたい', ko: '물을 마시고 싶다.' },
      ],
    },
    {
      heading: 'C', // 패턴 없는 섹션 — 빈칸을 안 만드니 어순 문항으로 흘러간다
      examples: [
        { ja: 'わたしは 毎朝 コーヒーを 飲む。', yomi: 'わたしは まいあさ こーひーを のむ', ko: '나는 매일 아침 커피를 마신다.' },
      ],
    },
  ],
};

// 레지스트리 흉내 — 교차 챕터 보기 풀
const REF = {
  getGrammarChapters: () => [
    CHAPTER,
    { slug: 'other', level: 'N5', sections: [{ pattern: '〜ている' }, { pattern: '〜てある' }] },
  ],
};

describe('buildChapterQuiz', () => {
  it('meaning/apply/produce 3단계를 모두 생성한다', () => {
    const quiz = buildChapterQuiz(CHAPTER, REF);
    expect(quiz.meaning.length).toBeGreaterThan(0);
    expect(quiz.apply.length).toBeGreaterThan(0);
    expect(quiz.produce.length).toBeGreaterThan(0);
  });

  it('meaning 문항은 빈칸·정답·보기 2개 이상을 갖는다', () => {
    const { meaning } = buildChapterQuiz(CHAPTER, REF);
    for (const m of meaning) {
      expect(m.sentence).toContain('＿＿＿');
      expect(m.full).toContain(m.correct);
      expect(m.distractors.length).toBeGreaterThanOrEqual(2);
      expect(m.distractors).not.toContain(m.correct);
    }
  });

  it('apply(어순) 문항의 토큰을 이으면 원문이 된다', () => {
    const { apply } = buildChapterQuiz(CHAPTER, REF);
    for (const a of apply) {
      expect(a.type).toBe('order');
      expect(a.tokens.join(' ')).toBe(a.answer);
      expect(a.tokens.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('상한 옵션을 지킨다 (복습용 축소 퀴즈)', () => {
    const quiz = buildReviewQuiz(CHAPTER, REF);
    expect(quiz.meaning.length).toBeLessThanOrEqual(2);
    expect(quiz.apply.length).toBeLessThanOrEqual(1);
    expect(quiz.produce.length).toBeLessThanOrEqual(1);
  });

  it('결정적이다 — 같은 입력이면 같은 출력(셔플은 렌더 몫)', () => {
    const a = buildChapterQuiz(CHAPTER, REF);
    const b = buildChapterQuiz(CHAPTER, REF);
    expect(a).toEqual(b);
  });
});

describe('buildChapterQuiz — 실제 레지스트리 통합', () => {
  it('일본어 n4-12-nagara 챕터에서 퀴즈가 나온다', async () => {
    const { getRefLang } = await import('../../content/refLangs');
    const ref = getRefLang('Japanese');
    const { chapter } = ref.getChapter('n4-12-nagara');
    const quiz = buildChapterQuiz(chapter, ref);
    const total = quiz.meaning.length + quiz.apply.length + quiz.produce.length;
    expect(total).toBeGreaterThanOrEqual(3);
  });
});
