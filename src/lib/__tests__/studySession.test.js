import { describe, it, expect } from 'vitest';
import { composeSession, normalizeAnswer, gradeTyping, isChapterPassed } from '../studySession';

const VOCAB = [
  { id: 1, word_text: '約束', meaning: '약속', furigana: 'やくそく', language: 'Japanese' },
  { id: 2, word_text: '家族', meaning: '가족', furigana: 'かぞく', language: 'Japanese' },
  { id: 3, word_text: '無料', meaning: '무료', furigana: 'むりょう', language: 'Japanese' },
];
const MEANING_POOL = ['약속', '가족', '무료', '학교', '회사', '시간', '친구'];

const CLOZE = { sentence: 'a＿＿＿b', full: 'aXb', ko: '뜻', correct: 'X', distractors: ['Y', 'Z'], pron: null };
const ORDER = { type: 'order', tokens: ['私は', '学生', 'です'], answer: '私は 学生 です', ko: '뜻', pron: null };

const GRAMMAR_DUE = [
  { srs: { lang: 'Japanese', slug: 's1' }, meta: { slug: 's1', title: '챕터1', href: '/x' }, items: [CLOZE, ORDER] },
  { srs: { lang: 'Japanese', slug: 's2' }, meta: { slug: 's2', title: '챕터2', href: '/y' }, items: [CLOZE] },
];

const NEW_CHAPTER = {
  meta: { lang: 'Japanese', slug: 'new-1', title: '새 챕터', level: 'N5', order: 3, href: '/z' },
  teach: { pattern: '〜ながら', patternKo: '~하면서', examples: [{ main: 'a', pron: null, ko: 'ㄱ' }] },
  items: [CLOZE, ORDER, CLOZE],
};

const READING = [
  { main: '音楽を聞きながら勉強します。', pron: 'おんがくを…', ko: '음악을 들으면서 공부해요.' },
  { main: '水が飲みたい。', pron: null, ko: '물을 마시고 싶다.' },
];
const KO_POOL = ['음악을 들으면서 공부해요.', '물을 마시고 싶다.', '학교에 가요.', '밥을 먹어요.', '책을 읽어요.'];

describe('composeSession', () => {
  const FULL = { vocab: VOCAB, meaningPool: MEANING_POOL, grammarDue: GRAMMAR_DUE, newChapter: NEW_CHAPTER, reading: READING, koPool: KO_POOL };

  it('티칭 카드가 맨 앞, 집계에서 제외된다', () => {
    const s = composeSession(FULL);
    expect(s.items[0].type).toBe('teach');
    expect(s.gradedCount).toBe(s.items.length - 1);
  });

  it('레시피 구성 — 어휘 3 · 문법 due 2 · 신규 3 + 독해', () => {
    const s = composeSession(FULL);
    const by = t => s.items.filter(i => i.type === t || (t === 'vocab' && i.type.startsWith('vocab'))).length;
    expect(by('vocab')).toBe(3);
    expect(s.items.filter(i => i.effect?.kind === 'grammar-due')).toHaveLength(2);
    expect(s.items.filter(i => i.effect?.kind === 'new-chapter')).toHaveLength(3);
    expect(s.items.filter(i => i.type === 'read-meaning').length).toBeGreaterThanOrEqual(1);
    expect(s.gradedCount).toBeLessThanOrEqual(12);
  });

  it('due가 없으면 독해로 채워 세션이 성립한다', () => {
    const s = composeSession({ vocab: [], meaningPool: [], grammarDue: [], newChapter: NEW_CHAPTER, reading: READING, koPool: KO_POOL });
    expect(s.gradedCount).toBeGreaterThanOrEqual(4); // 신규 3 + 독해 1+
    expect(s.newChapter.slug).toBe('new-1');
  });

  it('새 챕터가 없어도(전부 통과) 복습만으로 성립', () => {
    const s = composeSession({ vocab: VOCAB, meaningPool: MEANING_POOL, grammarDue: GRAMMAR_DUE, newChapter: null, reading: READING, koPool: KO_POOL });
    expect(s.items.some(i => i.type === 'teach')).toBe(false);
    expect(s.newChapter).toBeNull();
    expect(s.gradedCount).toBeGreaterThanOrEqual(5);
  });

  it('보기 부족한 어휘는 타이핑으로 강등', () => {
    const s = composeSession({ vocab: [VOCAB[0]], meaningPool: ['약속'], grammarDue: [], newChapter: null, reading: [], koPool: [] });
    const v = s.items.find(i => i.type.startsWith('vocab'));
    expect(v.type).toBe('vocab-typing');
  });

  it('독해 보기는 정답 제외 중복 없이 채워진다', () => {
    const s = composeSession(FULL);
    const r = s.items.find(i => i.type === 'read-meaning');
    expect(new Set(r.options).size).toBe(r.options.length);
    expect(r.options).toContain(r.correct);
  });
});

describe('gradeTyping / normalizeAnswer', () => {
  const W = { word_text: '約束', furigana: 'やくそく' };
  it('표기·후리가나 모두 정답', () => {
    expect(gradeTyping('約束', W)).toBe(true);
    expect(gradeTyping('やくそく', W)).toBe(true);
    expect(gradeTyping(' やく そく ', W)).toBe(true);
  });
  it('오답·빈 입력은 false', () => {
    expect(gradeTyping('家族', W)).toBe(false);
    expect(gradeTyping('', W)).toBe(false);
  });
  it('라틴 문자 대소문자·구두점 무시', () => {
    expect(gradeTyping('Bonjour!', { word_text: 'bonjour' })).toBe(true);
  });
});

describe('isChapterPassed', () => {
  it('3문항 중 2개 이상이면 통과', () => {
    expect(isChapterPassed(2, 3)).toBe(true);
    expect(isChapterPassed(1, 3)).toBe(false);
    expect(isChapterPassed(2, 2)).toBe(true);
    expect(isChapterPassed(1, 1)).toBe(true);
    expect(isChapterPassed(0, 0)).toBe(false);
  });
});
