import { describe, it, expect } from 'vitest';
import { composeSession, normalizeAnswer, gradeTyping, isChapterPassed, qtypeForItem, grammarDueChapterCounts, buildWarmupItems } from '../studySession';

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
    expect(s.gradedCount).toBeLessThanOrEqual(10);
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

  it('예산 하드캡 10 — 집계 문항이 10을 넘지 않는다', () => {
    const s = composeSession(FULL);
    expect(s.gradedCount).toBeLessThanOrEqual(10);
    expect(s.items.filter(i => i.type !== 'teach').length).toBeLessThanOrEqual(10);
  });

  it('rung 기반 타입 배정 — rung 2→typing, rung 3→listening', () => {
    const vocabRungs = { '約束': 2, '家族': 3, '無料': 1 };
    const s = composeSession({ ...FULL, vocabRungs });
    const byWord = t => s.items.find(i => i.word?.word_text === t)?.type;
    expect(byWord('約束')).toBe('vocab-typing');
    expect(byWord('家族')).toBe('vocab-listening');
    // rung1 → choice (보기 충분)
    expect(byWord('無料')).toBe('vocab-choice');
  });

  it('dial easy — 신규 0, 어휘는 전부 choice', () => {
    const vocabRungs = { '約束': 3, '家族': 2, '無料': 3 };
    const s = composeSession({ ...FULL, vocabRungs, dial: 'easy' });
    expect(s.items.filter(i => i.effect?.kind === 'new-chapter')).toHaveLength(0);
    expect(s.items.some(i => i.type === 'teach')).toBe(false);
    const vocabTypes = s.items.filter(i => i.type?.startsWith('vocab')).map(i => i.type);
    expect(vocabTypes.length).toBeGreaterThan(0);
    expect(vocabTypes.every(t => t === 'vocab-choice')).toBe(true);
    // 신규 슬롯은 독해로 채워진다
    expect(s.items.filter(i => i.type === 'read-meaning').length).toBeGreaterThanOrEqual(1);
  });

  it('dial hard — 어휘 타입이 한 단계 상향', () => {
    const vocabRungs = { '約束': 1, '家族': 2, '無料': 1 };
    const s = composeSession({ ...FULL, vocabRungs, dial: 'hard' });
    const byWord = t => s.items.find(i => i.word?.word_text === t)?.type;
    expect(byWord('約束')).toBe('vocab-typing');   // choice→typing
    expect(byWord('家族')).toBe('vocab-listening'); // typing→listening
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

describe('qtypeForItem — 세션 문항 타입 → qtype', () => {
  it('어휘/문법/독해 문항 타입을 규약 qtype으로 매핑', () => {
    expect(qtypeForItem('vocab-choice')).toBe('choice');
    expect(qtypeForItem('vocab-typing')).toBe('typing');
    expect(qtypeForItem('vocab-listening')).toBe('listening');
    expect(qtypeForItem('grammar-cloze')).toBe('cloze');
    expect(qtypeForItem('grammar-order')).toBe('order');
    expect(qtypeForItem('read-meaning')).toBe('read');
  });
  it('채점 문항이 아니면 null', () => {
    expect(qtypeForItem('teach')).toBeNull();
    expect(qtypeForItem('paragraph')).toBeNull();
    expect(qtypeForItem(undefined)).toBeNull();
  });
});

describe('buildWarmupItems — 워밍업 문항', () => {
  const now = Date.now();
  const h = n => new Date(now - n * 3600 * 1000).toISOString();
  const ROWS = [
    { word_text: '約束', meaning: '약속', furigana: 'やくそく' },
    { word_text: '家族', meaning: '가족', furigana: 'かぞく' },
    { word_text: '会社', meaning: '회사', furigana: 'かいしゃ' },
  ];
  const POOL = ['약속', '가족', '회사', '학교', '시간', '친구'];

  it('최근(24~72h) 정답 어휘를 최신순 최대 2개로 만든다', () => {
    const events = [
      { source: 'vocab', item_key: '約束', correct: true, created_at: h(30) },
      { source: 'vocab', item_key: '家族', correct: true, created_at: h(48) },
      { source: 'vocab', item_key: '会社', correct: true, created_at: h(60) },
    ];
    const items = buildWarmupItems(events, ROWS, POOL, new Set());
    expect(items).toHaveLength(2);
    expect(items.map(i => i.word.word_text)).toEqual(['約束', '家族']);
    expect(items[0].type).toBe('vocab-choice');
    expect(items[0].warmup).toBe(true);
    expect(items[0].effect).toEqual({ kind: 'reading', key: 'warmup:約束' });
    expect(items[0].options).toContain('약속');
    expect(items[0].uid.startsWith('w-')).toBe(true);
  });

  it('24h 미만·72h 초과·오답·비어휘 이벤트는 제외', () => {
    const events = [
      { source: 'vocab', item_key: '約束', correct: true, created_at: h(10) },   // 너무 최근
      { source: 'vocab', item_key: '家族', correct: true, created_at: h(100) },  // 너무 오래
      { source: 'vocab', item_key: '会社', correct: false, created_at: h(48) },  // 오답
      { source: 'grammar', item_key: '約束', correct: true, created_at: h(48) }, // 문법 소스
    ];
    expect(buildWarmupItems(events, ROWS, POOL, new Set())).toHaveLength(0);
  });

  it('due 어휘와 겹치면 제외', () => {
    const events = [
      { source: 'vocab', item_key: '約束', correct: true, created_at: h(30) },
      { source: 'vocab', item_key: '家族', correct: true, created_at: h(40) },
    ];
    const items = buildWarmupItems(events, ROWS, POOL, new Set(['約束']));
    expect(items).toHaveLength(1);
    expect(items[0].word.word_text).toBe('家族');
  });

  it('이력이 없으면 폴백 단어로 채운다', () => {
    const fallback = [
      { word_text: '水', meaning: '물', furigana: 'みず' },
      { word_text: '本', meaning: '책', furigana: 'ほん' },
    ];
    const items = buildWarmupItems([], [], POOL, new Set(), fallback);
    expect(items).toHaveLength(2);
    expect(items[0].effect.key).toBe('warmup:水');
    expect(items[0].warmup).toBe(true);
  });

  it('보기 오답이 부족하면 해당 문항 제외', () => {
    const events = [{ source: 'vocab', item_key: '約束', correct: true, created_at: h(30) }];
    expect(buildWarmupItems(events, ROWS, ['약속'], new Set())).toHaveLength(0);
  });
});

describe('grammarDueChapterCounts — 문법 due 챕터별 문항 수', () => {
  it('grammar-due만 slug별로 센다', () => {
    const items = [
      { effect: { kind: 'grammar-due', srs: { slug: 's1' } } },
      { effect: { kind: 'grammar-due', srs: { slug: 's1' } } },
      { effect: { kind: 'grammar-due', srs: { slug: 's2' } } },
      { effect: { kind: 'vocab' } },
      { effect: { kind: 'new-chapter', meta: { slug: 'n1' } } },
      { effect: { kind: 'reading', key: 'x' } },
    ];
    expect(grammarDueChapterCounts(items)).toEqual({ s1: 2, s2: 1 });
  });
  it('slug 없는 항목·빈 입력은 무시', () => {
    expect(grammarDueChapterCounts([{ effect: { kind: 'grammar-due', srs: {} } }])).toEqual({});
    expect(grammarDueChapterCounts([])).toEqual({});
    expect(grammarDueChapterCounts(null)).toEqual({});
  });
});
