import { describe, it, expect } from 'vitest';
import { buildParagraphPrompt, validateParagraph, verifyParagraph, mapParagraphToItems, stripInlineReadings, PARAGRAPH_SCHEMA, THEMES } from '../studyParagraph';
import { alignFurigana } from '../../views/refShared';

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

describe('mapParagraphToItems · cloze 피드백 후리가나(pron)', () => {
  it('cloze pron이 복원 매칭된 문장의 pron으로 채워진다', () => {
    const para = validateParagraph(GOOD);
    const mapped = mapParagraphToItems(para, MATERIALS);
    const ng = mapped.items.find(i => i.effect?.kind === 'new-chapter'); // 새 문법 cloze
    expect(ng.quiz.pron).toBe('わたしは おんがくを ききながら さんぽします');
    const due = mapped.items.find(i => i.effect?.kind === 'grammar-due'); // 복습 cloze
    expect(due.quiz.pron).toBe('ともだちと やくそくしたことが あります');
  });

  it('복원문이 어떤 문장에도 매칭되지 않으면 pron은 null 유지', () => {
    const para = {
      paragraph: '私は音楽を聞きながら散歩します。',
      translation: '나는 음악을 들으면서 산책합니다.',
      sentences: [
        { text: '私は音楽を聞きながら散歩します。', pron: 'わたしは おんがくを ききながら さんぽします', ko: '나는 음악을 들으면서 산책합니다.', tokens: ['私は', '音楽を', '聞きながら', '散歩します。'] },
      ],
      // 복원해도 문단 문장에 없는 cloze(다른 문장) → pron 매칭 실패
      questions: [
        { type: 'cloze', focus: 'new-grammar', key: 'k', prompt: '存在しない文＿＿＿です。', answer: 'X', distractors: ['A', 'B', 'C'], ko: '' },
        GOOD.questions[2], GOOD.questions[4],
      ],
      preQuestion: null,
    };
    const mapped = mapParagraphToItems(para, {});
    const cloze = mapped.items.find(i => i.type === 'grammar-cloze');
    expect(cloze.quiz.pron).toBeNull();
  });
});

describe('mapParagraphToItems · 재료 단어 칩(materialWords)', () => {
  it('readCard에 dueWords·newWords가 word·meaning·pron으로 실린다', () => {
    const para = validateParagraph(GOOD);
    const read = mapParagraphToItems(para, MATERIALS).items.find(i => i.type === 'paragraph');
    expect(read.materialWords).toEqual(
      expect.arrayContaining([
        { word: '約束', meaning: '약속', pron: '' },
        { word: '散歩', meaning: '산책', pron: 'さんぽ' },
      ])
    );
  });

  it('재료가 없으면 빈 배열', () => {
    const para = validateParagraph(GOOD);
    const read = mapParagraphToItems(para, {}).items.find(i => i.type === 'paragraph');
    expect(read.materialWords).toEqual([]);
  });
});

describe('mapParagraphToItems · 채점 문항 하드캡 7', () => {
  // 어순 조립용 온전한 문장 1개
  const SENTENCES = [{ text: '私は 学生 です', pron: null, ko: '나는 학생입니다', tokens: ['私は', '学生', 'です'] }];
  const d3 = ['오답1', '오답2', '오답3'];

  it('과잉 questions(12개)를 채점 문항 7개로 절단 + 우선순위 보존', () => {
    const questions = [
      { type: 'cloze', focus: 'new-grammar', key: 'k1', prompt: 'a＿b', answer: 'A', distractors: d3, ko: '' },
      { type: 'cloze', focus: 'new-grammar', key: 'k2', prompt: 'c＿d', answer: 'C', distractors: d3, ko: '' },
      { type: 'comprehension', focus: '', key: '', prompt: '무엇을 했나요?', answer: '공부', distractors: d3, ko: '' },
      { type: 'cloze', focus: 'due-grammar', key: 'kd', prompt: 'e＿f', answer: 'E', distractors: d3, ko: '' },
      // 과잉 vocab 8개 (최하위 우선순위 → 먼저 잘림)
      ...Array.from({ length: 8 }, (_, i) => ({ type: 'vocab', focus: 'new-word', key: `w${i}`, prompt: `w${i}`, answer: `뜻${i}`, distractors: d3, ko: '' })),
    ];
    const para = { paragraph: 'X', translation: 'x', sentences: SENTENCES, questions, preQuestion: null };
    const mapped = mapParagraphToItems(para, {});
    const graded = mapped.items.filter(i => i.type !== 'paragraph');
    expect(mapped.gradedCount).toBe(7);
    expect(graded).toHaveLength(7);
    // 새 문법 cloze 2개·comprehension 1개는 반드시 생존
    expect(graded.filter(i => i.quiz?.correct === 'A' || i.quiz?.correct === 'C')).toHaveLength(2);
    expect(graded.some(i => i.type === 'read-meaning')).toBe(true);
    // 어순·복습 cloze 생존 후 vocab은 남은 2슬롯만 (8개 중 6개 잘림)
    expect(graded.some(i => i.type === 'grammar-order')).toBe(true);
    expect(graded.filter(i => i.type === 'vocab-choice')).toHaveLength(2);
  });

  it('7개 이하면 절단하지 않는다', () => {
    const questions = [
      { type: 'cloze', focus: 'new-grammar', key: 'k1', prompt: 'a＿b', answer: 'A', distractors: d3, ko: '' },
      { type: 'vocab', focus: 'new-word', key: 'w', prompt: 'w', answer: '뜻', distractors: d3, ko: '' },
      { type: 'comprehension', focus: '', key: '', prompt: 'q?', answer: '공부', distractors: d3, ko: '' },
    ];
    const para = { paragraph: 'X', translation: 'x', sentences: SENTENCES, questions, preQuestion: null };
    const mapped = mapParagraphToItems(para, {});
    // cloze 1 + vocab 1 + comp 1 + order 1 = 4
    expect(mapped.gradedCount).toBe(4);
  });
});

describe('mapParagraphToItems · 새 문법 cloze 간격', () => {
  const SENTENCES = [{ text: '私は 学生 です', pron: null, ko: '나는 학생입니다', tokens: ['私は', '学生', 'です'] }];
  const d3 = ['오답1', '오답2', '오답3'];
  const ng = (k, a) => ({ type: 'cloze', focus: 'new-grammar', key: k, prompt: `${a}＿x`, answer: a, distractors: d3, ko: '' });

  it('새 문법 cloze 2개는 인덱스 간격 ≥4 (첫째 맨 앞)', () => {
    const questions = [
      ng('k1', 'A'),
      ng('k2', 'C'),
      { type: 'cloze', focus: 'due-grammar', key: 'kd', prompt: 'e＿f', answer: 'E', distractors: d3, ko: '' },
      { type: 'vocab', focus: 'new-word', key: 'w1', prompt: 'w1', answer: '뜻1', distractors: d3, ko: '' },
      { type: 'vocab', focus: 'new-word', key: 'w2', prompt: 'w2', answer: '뜻2', distractors: d3, ko: '' },
      { type: 'comprehension', focus: '', key: '', prompt: 'q?', answer: '공부', distractors: d3, ko: '' },
    ];
    const para = { paragraph: 'X', translation: 'x', sentences: SENTENCES, questions, preQuestion: null };
    const graded = mapParagraphToItems(para, {}).items.filter(i => i.type !== 'paragraph');
    const idxA = graded.findIndex(i => i.quiz?.correct === 'A');
    const idxB = graded.findIndex(i => i.quiz?.correct === 'C');
    expect(idxA).toBe(0);
    expect(idxB - idxA).toBeGreaterThanOrEqual(4);
  });

  it('배열이 짧으면 둘째 새 문법 cloze는 맨 뒤로', () => {
    const questions = [
      ng('k1', 'A'),
      ng('k2', 'C'),
      { type: 'vocab', focus: 'new-word', key: 'w1', prompt: 'w1', answer: '뜻1', distractors: d3, ko: '' },
    ];
    // 토큰 없는 문단 → 어순 문항 생성 안 됨. graded = 새문법2 + vocab1 = 3
    const para = { paragraph: 'X', translation: 'x', sentences: [{ text: 'ab', pron: null, ko: 'x', tokens: [] }], questions, preQuestion: null };
    const graded = mapParagraphToItems(para, {}).items.filter(i => i.type !== 'paragraph');
    expect(graded).toHaveLength(3);
    expect(graded[0].quiz?.correct).toBe('A');
    expect(graded[graded.length - 1].quiz?.correct).toBe('C');
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

describe('stripInlineReadings', () => {
  it('리포트된 실제 문장의 인라인 괄호 독음을 괄호째 제거한다', () => {
    expect(stripInlineReadings('友達は「撃墜(げきつい)！」と話しました。')).toBe('友達は「撃墜！」と話しました。');
    expect(stripInlineReadings('わたしは「供述(きょうじゅつ)」と書きました。')).toBe('わたしは「供述」と書きました。');
  });

  it('가나만 든 한자 뒤 괄호는 제거하되 일반 괄호(숫자·한자 등)는 보존한다', () => {
    expect(stripInlineReadings('東京(とうきょう)に行く')).toBe('東京に行く');
    expect(stripInlineReadings('試験(3月)があります')).toBe('試験(3月)があります');
    expect(stripInlineReadings('会議(重要)の予定')).toBe('会議(重要)の予定');
  });

  it('전각 괄호 케이스도 제거한다', () => {
    expect(stripInlineReadings('友達は「撃墜（げきつい）！」と話しました。')).toBe('友達は「撃墜！」と話しました。');
  });

  it('한자가 앞에 없으면(순가나 괄호 등) 건드리지 않고, 비문자열은 그대로 반환한다', () => {
    expect(stripInlineReadings('あ(い)う')).toBe('あ(い)う');
    expect(stripInlineReadings('')).toBe('');
    expect(stripInlineReadings(null)).toBe(null);
  });
});

describe('mapParagraphToItems · 인라인 독음 정화', () => {
  const dirty = {
    paragraph: '友達は「撃墜(げきつい)！」と話しました。',
    translation: '친구는 "격추!"라고 말했습니다.',
    sentences: [
      { text: '友達は「撃墜(げきつい)！」と話しました。', pron: 'ともだちは「げきつい！」とはなしました。', ko: '친구는 "격추!"라고 말했습니다.', tokens: ['友達は', '「撃墜！」と', '話しました。'] },
    ],
    questions: [
      { type: 'cloze', focus: 'new-grammar', key: '話しました', prompt: '友達は「撃墜(げきつい)！」と＿＿＿。', answer: '話しました', distractors: ['聞きました', '見ました', '書きました'], ko: '친구는 말했습니다.' },
      GOOD.questions[2], GOOD.questions[3], GOOD.questions[4],
    ],
    preQuestion: null,
  };

  it('문항 텍스트 어디에도 괄호 독음이 남지 않는다', () => {
    const { items } = mapParagraphToItems(dirty, {});
    const read = items.find(i => i.type === 'paragraph');
    expect(read.paragraph).toBe('友達は「撃墜！」と話しました。');
    expect(read.sentences[0].text).toBe('友達は「撃墜！」と話しました。');
    const cloze = items.find(i => i.type === 'grammar-cloze');
    expect(cloze.quiz.sentence).not.toMatch(/[（(][ぁ-ゟ]+[)）]/);
    expect(cloze.quiz.full).toBe('友達は「撃墜！」と話しました。');
  });
});

describe('정규화 후 alignFurigana 정렬 성공', () => {
  it('오염 문장은 정렬 실패하지만 stripInlineReadings 후에는 루비 정렬에 성공한다', () => {
    const yomi = 'ともだちは「げきつい！」とはなしました。';
    expect(alignFurigana('友達は「撃墜(げきつい)！」と話しました。', yomi)).toBeNull();
    const clean = stripInlineReadings('友達は「撃墜(げきつい)！」と話しました。');
    const segs = alignFurigana(clean, yomi);
    expect(segs).not.toBeNull();
    expect(segs.some(s => s.rt)).toBe(true);
  });
});
