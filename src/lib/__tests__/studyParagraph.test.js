import { describe, it, expect } from 'vitest';
import { buildParagraphPrompt, validateParagraph, mapParagraphToItems, PARAGRAPH_SCHEMA } from '../studyParagraph';

const MATERIALS = {
  language: 'Japanese',
  level: 'N4',
  newPattern: { pattern: 'ます형 어간 + ながら', patternKo: '~하면서' },
  newChapter: { lang: 'Japanese', slug: 'n4-12-nagara', title: '들으면서', level: 'N4', order: 12, href: '/japanese/grammar/n4-12-nagara' },
  duePatterns: [{ pattern: '〜たことがある', patternKo: '~한 적이 있다', srs: { lang: 'Japanese', slug: 'n4-02' }, meta: { slug: 'n4-02', title: 'た형' } }],
  dueWords: [{ word: '約束', meaning: '약속', row: { id: 7, word_text: '約束', meaning: '약속', interval: 2 } }],
  newWords: [{ word: '散歩', meaning: '산책', pron: 'さんぽ' }],
};

const GOOD = {
  paragraph: '私は音楽を聞きながら散歩します。友だちと約束したことがあります。',
  translation: '나는 음악을 들으면서 산책합니다. 친구와 약속한 적이 있습니다.',
  sentences: [
    { text: '私は音楽を聞きながら散歩します。', pron: 'わたしは おんがくを ききながら さんぽします', ko: '나는 음악을 들으면서 산책합니다.', tokens: ['私は', '音楽を', '聞きながら', '散歩します。'] },
    { text: '友だちと約束したことがあります。', pron: 'ともだちと やくそくしたことが あります', ko: '친구와 약속한 적이 있습니다.', tokens: ['友だちと', '約束した', 'ことが', 'あります。'] },
  ],
  questions: [
    { type: 'cloze', focus: 'new-grammar', key: 'ます형 어간 + ながら', prompt: '私は音楽を聞き＿＿＿散歩します。', answer: 'ながら', distractors: ['ばかり', 'ながらも', 'つつ'], ko: '나는 음악을 들으면서 산책합니다.' },
    { type: 'cloze', focus: 'due-grammar', key: '〜たことがある', prompt: '友だちと約束した＿＿＿があります。', answer: 'こと', distractors: ['もの', 'ところ', 'はず'], ko: '친구와 약속한 적이 있습니다.' },
    { type: 'vocab', focus: 'due-word', key: '約束', prompt: '約束', answer: '약속', distractors: ['산책', '음악', '친구'], ko: '' },
    { type: 'vocab', focus: 'new-word', key: '散歩', prompt: '散歩', answer: '산책', distractors: ['약속', '공부', '여행'], ko: '' },
    { type: 'comprehension', focus: '', key: '', prompt: '글쓴이는 무엇을 하면서 산책하나요?', answer: '음악 듣기', distractors: ['통화하기', '노래하기', '사진 찍기'], ko: '' },
  ],
};

describe('buildParagraphPrompt', () => {
  it('모든 재료가 프롬프트에 들어간다', () => {
    const p = buildParagraphPrompt(MATERIALS);
    expect(p).toContain('ながら');
    expect(p).toContain('たことがある');
    expect(p).toContain('約束');
    expect(p).toContain('散歩');
    expect(p).toContain('N4');
  });

  it('재료가 하나도 없으면 null', () => {
    expect(buildParagraphPrompt({ language: 'Japanese', level: 'N5', duePatterns: [], dueWords: [], newWords: [] })).toBeNull();
    expect(buildParagraphPrompt({ language: 'Korean' })).toBeNull();
  });

  it('일본어 입문 레벨(N5)에는 한자 배려 문구가 들어간다', () => {
    const p = buildParagraphPrompt({ ...MATERIALS, level: 'N5' });
    expect(p).toContain('입문 레벨 배려');
  });

  it('일본어 고급 레벨(N2)에는 한자 배려 문구가 없다', () => {
    const p = buildParagraphPrompt({ ...MATERIALS, level: 'N2' });
    expect(p).not.toContain('입문 레벨 배려');
  });

  it('중국어는 입문 레벨이어도 한자 배려 문구가 없다', () => {
    const p = buildParagraphPrompt({
      language: 'Chinese',
      level: 'H1',
      newPattern: null,
      duePatterns: [],
      dueWords: [{ word: '你好', meaning: '안녕' }],
      newWords: [],
    });
    expect(p).not.toContain('입문 레벨 배려');
  });
});

describe('validateParagraph', () => {
  it('정상 응답을 통과시킨다', () => {
    const v = validateParagraph(GOOD);
    expect(v.sentences).toHaveLength(2);
    expect(v.questions).toHaveLength(5);
  });

  it('깨진 문항은 걸러내고, 3개 미만이면 null', () => {
    const v = validateParagraph({
      ...GOOD,
      questions: [
        GOOD.questions[0],
        { type: 'cloze', prompt: 'x' },                       // answer 없음 — 제거
        { ...GOOD.questions[1], type: 'weird' },              // 타입 불량 — 제거
        GOOD.questions[2], GOOD.questions[4],
      ],
    });
    expect(v.questions).toHaveLength(3);
    expect(validateParagraph({ ...GOOD, questions: [GOOD.questions[0]] })).toBeNull();
  });

  it('문단·문장 없으면 null', () => {
    expect(validateParagraph({ ...GOOD, paragraph: '' })).toBeNull();
    expect(validateParagraph({ ...GOOD, sentences: [] })).toBeNull();
    expect(validateParagraph(null)).toBeNull();
  });

  it('distractors에서 정답과 같은 값·중복 제거', () => {
    const v = validateParagraph({
      ...GOOD,
      questions: GOOD.questions.map(q => ({ ...q, distractors: [q.answer, ...q.distractors, q.distractors[0]] })),
    });
    v.questions.forEach(q => {
      expect(q.distractors).not.toContain(q.answer);
      expect(new Set(q.distractors).size).toBe(q.distractors.length);
    });
  });
});

describe('mapParagraphToItems', () => {
  const para = validateParagraph(GOOD);
  const mapped = mapParagraphToItems(para, MATERIALS);

  it('문단 카드가 맨 앞 + 집계 제외', () => {
    expect(mapped.items[0].type).toBe('paragraph');
    expect(mapped.gradedCount).toBe(mapped.items.length - 1);
  });

  it('new-grammar cloze는 챕터 통과 효과에 연결', () => {
    const c = mapped.items.find(i => i.effect?.kind === 'new-chapter');
    expect(c.type).toBe('grammar-cloze');
    expect(c.effect.meta.slug).toBe('n4-12-nagara');
    expect(c.quiz.full).toContain('ながら');
  });

  it('due-grammar cloze는 srs 재스케줄 효과에 연결', () => {
    const c = mapped.items.find(i => i.effect?.kind === 'grammar-due');
    expect(c.effect.srs.slug).toBe('n4-02');
  });

  it('due 단어 문항은 FSRS 효과(wordId)에 연결, 새 단어는 아님', () => {
    const vocabItems = mapped.items.filter(i => i.type === 'vocab-choice');
    const due = vocabItems.find(i => i.effect.kind === 'vocab');
    expect(due.effect.wordId).toBe(7);
    const nw = vocabItems.find(i => i.word.word_text === '散歩');
    expect(nw.effect.kind).toBe('reading');
  });

  it('내용 이해는 한국어 프롬프트 표시, 어순 조립 1문항 추가', () => {
    const comp = mapped.items.find(i => i.type === 'read-meaning');
    expect(comp.sentence.isKoreanPrompt).toBe(true);
    const order = mapped.items.find(i => i.type === 'grammar-order');
    expect(order.quiz.tokens.join(' ').replace(/\s/g, '')).toBe(order.quiz.answer.replace(/\s/g, ''));
  });
});

describe('PARAGRAPH_SCHEMA', () => {
  it('Gemini responseSchema 필수 필드', () => {
    expect(PARAGRAPH_SCHEMA.required).toEqual(['paragraph', 'translation', 'sentences', 'questions']);
    expect(PARAGRAPH_SCHEMA.properties.sentences.items.required).toContain('tokens');
  });
});
