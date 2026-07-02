import { describe, it, expect } from 'vitest';
import { buildParagraphPrompt, validateParagraph, verifyParagraph, mapParagraphToItems, PARAGRAPH_SCHEMA, THEMES } from '../studyParagraph';

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
  preQuestion: { q: '글쓴이는 무엇을 하면서 산책하나요?', answerHint: '음악' },
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
    expect(PARAGRAPH_SCHEMA.required).toEqual(['paragraph', 'translation', 'sentences', 'questions', 'preQuestion']);
    expect(PARAGRAPH_SCHEMA.properties.sentences.items.required).toContain('tokens');
    expect(PARAGRAPH_SCHEMA.properties.preQuestion.required).toEqual(['q', 'answerHint']);
  });
});

describe('buildParagraphPrompt · 기지어 제약 · 주제', () => {
  it('knownWords 30개 이상이면 기지어 제약 문구가 들어간다', () => {
    const known = Array.from({ length: 35 }, (_, i) => `단어${i}`);
    const p = buildParagraphPrompt({ ...MATERIALS, knownWords: known });
    expect(p).toContain('이미 아는 단어');
    expect(p).toContain('5% 이하');
    expect(p).toContain('단어0');
  });

  it('콜드스타트(knownWords<30)면 whitelist 조합 문구가 들어간다', () => {
    const p = buildParagraphPrompt({ ...MATERIALS, knownWords: ['あ'], whitelistWords: ['りんご', 'みかん'] });
    expect(p).toContain('이 단어 목록 안에서 최대한 조합');
    expect(p).toContain('りんご');
  });

  it('theme·avoidThemes가 프롬프트에 반영된다', () => {
    const p = buildParagraphPrompt({ ...MATERIALS, theme: '여행', avoidThemes: ['음식', '학교'] });
    expect(p).toContain('오늘의 주제: 여행');
    expect(p).toContain('음식');
    expect(p).toContain('학교');
  });

  it('THEMES 풀에 예상 주제가 있다', () => {
    expect(THEMES).toContain('여행');
    expect(THEMES.length).toBeGreaterThanOrEqual(10);
  });

  it('preQuestion 지시가 프롬프트에 들어간다', () => {
    const p = buildParagraphPrompt(MATERIALS);
    expect(p).toContain('preQuestion');
    expect(p).toContain('읽기 미션');
  });
});

describe('verifyParagraph', () => {
  const base = validateParagraph(GOOD);

  it('cloze 복원이 문단 문장에 없으면 그 문항을 제거', () => {
    const para = { ...base, questions: base.questions.map((q, i) => i === 0 ? { ...q, answer: 'ぜんぜん' } : q) };
    const v = verifyParagraph(para);
    expect(v.questions.find(q => q.focus === 'new-grammar')).toBeUndefined();
    expect(v.questions.length).toBe(base.questions.length - 1);
  });

  it('vocab key가 문단에 실재하지 않으면 제거', () => {
    const para = { ...base, questions: base.questions.map(q => (q.type === 'vocab' && q.key === '約束') ? { ...q, key: '存在しない語' } : q) };
    const v = verifyParagraph(para);
    expect(v.questions.find(q => q.key === '存在しない語')).toBeUndefined();
  });

  it('정상 문항·힌트는 유지', () => {
    const v = verifyParagraph(base);
    expect(v.questions).toHaveLength(base.questions.length);
    expect(v.preQuestion.answerHint).toBe('음악');
  });

  it('preQuestion 힌트가 번역·문장에 없으면 제네릭으로 강등', () => {
    const para = { ...base, preQuestion: { q: '질문?', answerHint: '전혀없는표현XYZ' } };
    const v = verifyParagraph(para);
    expect(v.preQuestion.answerHint).toBe('');
    expect(v.preQuestion.q).toContain('그려보며');
  });

  it('검증 후 문항이 3개 미만이면 null (재생성 신호)', () => {
    const para = { ...base, questions: base.questions.slice(0, 2) };
    expect(verifyParagraph(para)).toBeNull();
    expect(verifyParagraph(null)).toBeNull();
  });

  // 아래 verifyParagraph 호출에는 vocab 문항의 key가 paragraph 문자열에 실재해야
  // (기존 ①단계 검증) 통과하므로, 테스트 문단에 실제로 등장하는 단어를 key로 쓴다.
  const VOCAB_WEEKEND = { type: 'vocab', focus: 'due-word', key: '週末', prompt: '週末', answer: '주말', distractors: ['여행', '음악', '친구'], ko: '' };
  const VOCAB_TRAVEL = { type: 'vocab', focus: 'new-word', key: '旅行', prompt: '旅行', answer: '여행', distractors: ['주말', '공부', '산책'], ko: '' };

  it('버그 재현 — cloze 오답이 정답의 읽기(가나)면 제거하고 문항은 생존', () => {
    const para = {
      paragraph: '週末、旅行に行きました。',
      translation: '주말에 여행을 갔습니다.',
      sentences: [
        { text: '週末、旅行に行きました。', pron: 'しゅうまつ、りょこうに いきました', ko: '주말에 여행을 갔습니다.', tokens: ['週末、', '旅行に', '行きました。'] },
      ],
      questions: [
        { type: 'cloze', focus: 'new-grammar', key: '行きました', prompt: '週末、旅行に＿＿＿。', answer: '行きました', distractors: ['いきました', '行きます', '行きたいです'], ko: '주말에 여행을 갔습니다.' },
        VOCAB_WEEKEND,
        VOCAB_TRAVEL,
      ],
      preQuestion: null,
    };
    const v = verifyParagraph(para);
    const cloze = v.questions.find(q => q.type === 'cloze');
    expect(cloze).toBeDefined();
    expect(cloze.distractors).not.toContain('いきました');
    expect(cloze.distractors).toEqual(expect.arrayContaining(['行きます', '行きたいです']));
    expect(cloze.distractors).toHaveLength(2);
  });

  it('가타카나 표기 변형 오답도 제거된다', () => {
    const para = {
      paragraph: '朝はコーヒーを飲みます。',
      translation: '아침에는 커피를 마십니다.',
      sentences: [
        { text: '朝はコーヒーを飲みます。', pron: 'あさは コーヒーを のみます', ko: '아침에는 커피를 마십니다.', tokens: ['朝は', 'コーヒーを', '飲みます。'] },
      ],
      questions: [
        { type: 'cloze', focus: 'new-grammar', key: 'コーヒー', prompt: '朝は＿＿＿を飲みます。', answer: 'コーヒー', distractors: ['こーひー', '紅茶', '水'], ko: '아침에는 커피를 마십니다.' },
        { type: 'vocab', focus: 'due-word', key: '朝', prompt: '朝', answer: '아침', distractors: ['저녁', '낮', '밤'], ko: '' },
        { type: 'vocab', focus: 'new-word', key: '飲みます', prompt: '飲みます', answer: '마십니다', distractors: ['먹습니다', '잡니다', '봅니다'], ko: '' },
      ],
      preQuestion: null,
    };
    const v = verifyParagraph(para);
    const cloze = v.questions.find(q => q.type === 'cloze');
    expect(cloze.distractors).not.toContain('こーひー');
    expect(cloze.distractors).toEqual(expect.arrayContaining(['紅茶', '水']));
  });

  it('필터 후 distractors가 1개만 남으면 문항 자체가 제거된다', () => {
    const para = {
      paragraph: '週末、旅行に行きました。',
      translation: '주말에 여행을 갔습니다.',
      sentences: [
        { text: '週末、旅行に行きました。', pron: 'しゅうまつ、りょこうに いきました', ko: '주말에 여행을 갔습니다.', tokens: ['週末、', '旅行に', '行きました。'] },
      ],
      questions: [
        // distractors 2개가 표기·읽기로 걸러져 1개만 남음 → 문항 제거
        { type: 'cloze', focus: 'new-grammar', key: '行きました', prompt: '週末、旅行に＿＿＿。', answer: '行きました', distractors: ['いきました', 'イキマシタ', '行きたいです'], ko: '주말에 여행을 갔습니다.' },
        VOCAB_WEEKEND,
        VOCAB_TRAVEL,
        GOOD.questions[4],
      ],
      preQuestion: null,
    };
    const v = verifyParagraph(para);
    expect(v.questions.find(q => q.type === 'cloze')).toBeUndefined();
    expect(v.questions.length).toBe(3);
  });
});
