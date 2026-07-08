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
  it('일본어 n4-12-nagara 챕터에서 퀴즈가 나온다', { timeout: 30000 }, async () => {
    // refLangs는 4개 언어 콘텐츠 전체(~10만 줄)를 로드하므로 기본 5초로는 빠듯하다
    const { getRefLang } = await import('../../content/refLangs');
    const ref = getRefLang('Japanese');
    const { chapter } = ref.getChapter('n4-12-nagara');
    const quiz = buildChapterQuiz(chapter, ref);
    const total = quiz.meaning.length + quiz.apply.length + quiz.produce.length;
    expect(total).toBeGreaterThanOrEqual(3);
  });
});

// ── 보기 유출 3종 회귀 방지 ──────────────────────────────────────────
// 유출 판정기(테스트 전용). 엔진 SUFFIX_FRAG와 동일 집합(est/en/on 같은 실단어는 제외).
const SUFFRAG = new Set(['er', 'es', 'ies', 'ed', 'ing', 'ent', 'ons', 'ez']);
const MNEMONIC_WORDS = new Set(['beauty', 'age', 'goodness', 'size', 'careful']);
const hasCaseDup = arr => {
  const seen = new Set();
  for (const d of arr) { const k = String(d).toLowerCase(); if (seen.has(k)) return true; seen.add(k); }
  return false;
};
// 한 문항 보기 배열이 3종 결함(니모닉·가운뎃점 / 접미 조각 / 대소문자 중복)에서 자유로운지
function assertCleanDistractors(m, label) {
  for (const d of m.distractors) {
    const s = String(d);
    expect(/[·・]/.test(s), `${label} 가운뎃점/니모닉 조각 유출: ${JSON.stringify(m.distractors)}`).toBe(false);
    expect(SUFFRAG.has(s.toLowerCase()), `${label} 비단어 접미 조각 유출: ${JSON.stringify(m.distractors)}`).toBe(false);
    expect(MNEMONIC_WORDS.has(s.toLowerCase()), `${label} 니모닉 구성어 유출: ${JSON.stringify(m.distractors)}`).toBe(false);
  }
  expect(hasCaseDup(m.distractors), `${label} 대소문자 중복 보기: ${JSON.stringify(m.distractors)}`).toBe(false);
  expect(
    m.distractors.some(d => String(d).toLowerCase() === String(m.correct).toLowerCase()),
    `${label} 정답과 같은 보기: correct=${m.correct} distractors=${JSON.stringify(m.distractors)}`,
  ).toBe(false);
}

describe('보기 유출 회귀 — 합성 챕터(콘텐츠 독립)', () => {
  // ① 니모닉(BAGS)·② 접미 조각(+es·y→ies): 다른 섹션 패턴이 오답 풀로 흘러도 새지 않아야 한다.
  const LEAK = {
    slug: 'leak-01', level: 'A1', order: 1,
    sections: [
      { heading: 'Q', pattern: 'aaa + zzz', examples: [{ fr: 'aaa bbb ccc', ipa: '', ko: '문항용 예문' }] },
      { heading: 'M', pattern: 'BAGS (Beauty·Age·Goodness·Size) → 명사 앞' },   // 니모닉
      { heading: 'S', pattern: '+s · +es · y→ies · 불규칙(men, feet)' },          // 접미 조각
      { heading: 'C', pattern: 'My mom → she · my brother → he' },                // 대소문자 변이
    ],
  };
  const LEAK_REF = { getGrammarChapters: () => [LEAK] };

  it('니모닉·접미 조각·가운뎃점이 오답으로 새지 않는다', () => {
    const quiz = buildChapterQuiz(LEAK, LEAK_REF);
    expect(quiz.meaning.length).toBe(1);                 // Q 섹션에서 결정적으로 1문항
    const m = quiz.meaning[0];
    expect(m.correct).toBe('aaa');
    expect(m.distractors.length).toBeGreaterThanOrEqual(2);
    assertCleanDistractors(m, '[LEAK/Q]');
    // 통짜 니모닉도, 그 구성어도 없어야 한다
    expect(m.distractors).not.toContain('Beauty·Age·Goodness·Size');
    expect(m.distractors.map(s => s.toLowerCase())).not.toContain('beauty');
  });

  // ③ 대소문자 중복: My/my가 같은 문항 보기에 동시에 뜨지 않아야 한다.
  const DEDUP = {
    slug: 'dedup-01', level: 'A1', order: 1,
    sections: [
      { heading: 'Q', pattern: 'aaa + zzz', examples: [{ fr: 'aaa bbb ccc', ipa: '', ko: '문항용 예문' }] },
      { heading: 'C', pattern: 'My · my · mine · yours' },   // My/my 대소문자 변이가 풀 선두에
    ],
  };
  const DEDUP_REF = { getGrammarChapters: () => [DEDUP] };

  it('대소문자만 다른 보기(My/my)는 하나로 합쳐진다', () => {
    const quiz = buildChapterQuiz(DEDUP, DEDUP_REF);
    expect(quiz.meaning.length).toBe(1);
    const m = quiz.meaning[0];
    assertCleanDistractors(m, '[DEDUP/Q]');
    const lowers = m.distractors.map(s => String(s).toLowerCase());
    expect(new Set(lowers).size).toBe(lowers.length);     // 대소문자 무시 시 전부 유일
  });
});

describe('보기 유출 회귀 — 실제 콘텐츠', () => {
  // 재현된 결함 챕터들이 보강 후 깨끗한 보기로 생성되는지 (실제 fr/a1.js·en/a1.js)
  const CASES = [
    ['French', 'a1-03-er-verbs'],
    ['French', 'a1-06-adjectives'],
    ['English', 'a1-04-plural-countable'],
    ['English', 'a1-05-pronouns-possessive'],
  ];
  it('재현 케이스 챕터가 유출 없이 문항을 생성한다', { timeout: 30000 }, async () => {
    const { getRefLang } = await import('../../content/refLangs');
    for (const [lang, slug] of CASES) {
      const ref = getRefLang(lang);
      const got = ref.getChapter(slug);
      expect(got, `${lang}/${slug} 챕터 존재`).toBeTruthy();
      const quiz = buildChapterQuiz(got.chapter, ref);
      // 무회귀: 여전히 빈칸 문항이 생성된다
      expect(quiz.meaning.length, `${lang}/${slug} 빈칸 문항 생성`).toBeGreaterThanOrEqual(1);
      for (const m of quiz.meaning) {
        expect(m.distractors.length).toBeGreaterThanOrEqual(2);
        assertCleanDistractors(m, `[${lang}/${slug}]`);
      }
    }
  });

  // 전 언어 입문 챕터 스윕 — 엔진 불변식(유출 0)이 모든 입문 콘텐츠에서 성립
  const INTRO = { French: ['A0', 'A1'], English: ['OT', 'A1'], Japanese: ['OT', 'N5'], Chinese: ['OT', 'H1'] };
  it('전 언어 입문 챕터에 유출이 남지 않는다', { timeout: 60000 }, async () => {
    const { getRefLang } = await import('../../content/refLangs');
    let scanned = 0;
    for (const [lang, levels] of Object.entries(INTRO)) {
      const ref = getRefLang(lang);
      for (const lvl of levels) {
        for (const ch of ref.getGrammarChapters(lvl)) {
          const quiz = buildChapterQuiz(ch, ref);
          for (const m of quiz.meaning) { scanned++; assertCleanDistractors(m, `[${lang}/${ch.slug}]`); }
        }
      }
    }
    expect(scanned).toBeGreaterThan(100);   // 입문 콘텐츠가 실제로 로드·스캔됐음을 보장
  });
});
