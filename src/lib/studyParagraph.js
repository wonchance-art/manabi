/**
 * 공부 모드 — 오늘의 문단 생성.
 * 새 문법·새 어휘·복습 문법·복습 어휘를 전부 녹인 문단 하나를 AI로 만들고,
 * 세션의 모든 문항이 이 문단에서 파생된다.
 * 프롬프트 조립·응답 검증은 서버(/api/study-paragraph) 전용, 문항 매핑은 클라 공용.
 */

const LANG_NAME = { Japanese: '일본어', English: '영어', French: '프랑스어', Chinese: '중국어' };

/** Gemini structured output 스키마 */
export const PARAGRAPH_SCHEMA = {
  type: 'OBJECT',
  properties: {
    paragraph: { type: 'STRING', description: '학습 언어로 된 문단 전체' },
    translation: { type: 'STRING', description: '문단의 자연스러운 한국어 번역' },
    sentences: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING' },
          pron: { type: 'STRING', description: '일본어=요미가나(히라가나) / 중국어=병음 / 영불=빈 문자열' },
          ko: { type: 'STRING', description: '이 문장의 한국어 뜻' },
          tokens: { type: 'ARRAY', items: { type: 'STRING' }, description: '어순 조립용 어절 분할(3~10조각)' },
        },
        required: ['text', 'pron', 'ko', 'tokens'],
      },
    },
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING', description: 'cloze | vocab | comprehension' },
          focus: { type: 'STRING', description: 'cloze: new-grammar|due-grammar / vocab: new-word|due-word / comprehension: 빈 문자열' },
          key: { type: 'STRING', description: 'cloze=대상 패턴 원문, vocab=대상 단어 원문, comprehension=빈 문자열' },
          prompt: { type: 'STRING', description: 'cloze=빈칸(＿＿＿) 포함 문장 / vocab=문단 속 그 단어 / comprehension=한국어 질문' },
          answer: { type: 'STRING', description: '정답 (cloze=빈칸에 들어갈 형태, vocab=한국어 뜻, comprehension=정답 선택지)' },
          distractors: { type: 'ARRAY', items: { type: 'STRING' }, description: '오답 3개 (같은 종류·비슷한 난이도)' },
          ko: { type: 'STRING', description: 'cloze일 때 그 문장의 한국어 뜻, 그 외 빈 문자열' },
        },
        required: ['type', 'focus', 'key', 'prompt', 'answer', 'distractors', 'ko'],
      },
    },
  },
  required: ['paragraph', 'translation', 'sentences', 'questions'],
};

/**
 * 문단 생성 프롬프트 (서버 전용)
 * @param {Object} m - materials
 *  { language, level, newPattern:{pattern,patternKo}|null,
 *    duePatterns:[{pattern,patternKo}], dueWords:[{word,meaning}], newWords:[{word,meaning}] }
 */
export function buildParagraphPrompt(m) {
  const name = LANG_NAME[m.language];
  if (!name) return null;
  const parts = [];
  if (m.newPattern) parts.push(`- [새 문법·최우선] ${m.newPattern.pattern}${m.newPattern.patternKo ? ` (${m.newPattern.patternKo})` : ''} — 2번 이상 사용`);
  (m.duePatterns || []).forEach(p => parts.push(`- [복습 문법] ${p.pattern}${p.patternKo ? ` (${p.patternKo})` : ''} — 1번 이상 사용`));
  (m.dueWords || []).forEach(w => parts.push(`- [복습 단어] ${w.word} (${w.meaning})`));
  (m.newWords || []).forEach(w => parts.push(`- [새 단어] ${w.word} (${w.meaning})`));
  if (parts.length === 0) return null;

  return (
    `당신은 ${name} 교재 집필자입니다. ${m.level} 레벨 한국인 학습자를 위한 오늘의 학습 문단을 만드세요.\n\n` +
    `[반드시 문단에 자연스럽게 녹일 재료]\n${parts.join('\n')}\n\n` +
    `[문단 규칙]\n` +
    `- ${name} 3~5문장, 하나의 일상적 상황·이야기로 자연스럽게 연결 (재료 나열식 금지).\n` +
    `- 재료 외 어휘·문법은 ${m.level} 이하만. 문장은 짧고 명확하게.\n` +
    `- sentences: 문단을 문장 단위로 나눠 pron(일본어=전체 요미가나 히라가나, 중국어=병음, 영어·프랑스어=빈 문자열), ko(문장 뜻), tokens(어순 조립용 3~10어절 분할 — 일본어·중국어는 의미 단위로 띄어 나누기)를 채우세요. tokens를 공백으로 이으면 원문과 일치해야 합니다(구두점 포함).\n\n` +
    `[문항 규칙 — questions]\n` +
    `- cloze: 새 문법으로 2개(focus=new-grammar, key=새 문법 패턴), 복습 문법마다 1개(focus=due-grammar, key=그 패턴). prompt는 문단의 실제 문장에서 해당 문법 부분만 ＿＿＿로 비운 것, answer는 빈칸 원형, distractors는 같은 자리에 올 법한 오답 3개, ko는 그 문장 뜻.\n` +
    `- vocab: 복습 단어·새 단어 각각 1개씩(focus=due-word|new-word, key=단어 원문, prompt=단어 원문, answer=한국어 뜻, distractors=그럴듯한 다른 뜻 3개).\n` +
    `- comprehension: 문단 내용 이해 질문 1개 (한국어 질문·선택지 4개 중 answer 1개).\n` +
    `- 문항 순서: cloze(새 문법) → vocab → cloze(복습) → comprehension.\n\n` +
    `지정된 JSON 스키마로만 응답하세요. 설명·번역은 전부 한국어로.`
  );
}

/** 응답 방어 검증 — 필수 구조가 없으면 null (writingPrompts.validateFeedback과 같은 철학) */
export function validateParagraph(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.paragraph !== 'string' || !raw.paragraph.trim()) return null;

  const sentences = Array.isArray(raw.sentences)
    ? raw.sentences
        .filter(s => s && typeof s.text === 'string' && s.text.trim() && typeof s.ko === 'string')
        .map(s => ({
          text: s.text.trim(),
          pron: typeof s.pron === 'string' && s.pron.trim() ? s.pron.trim() : null,
          ko: s.ko,
          tokens: Array.isArray(s.tokens) ? s.tokens.filter(t => typeof t === 'string' && t.trim()) : [],
        }))
    : [];
  if (sentences.length === 0) return null;

  const questions = Array.isArray(raw.questions)
    ? raw.questions
        .filter(q =>
          q && ['cloze', 'vocab', 'comprehension'].includes(q.type) &&
          typeof q.prompt === 'string' && q.prompt.trim() &&
          typeof q.answer === 'string' && q.answer.trim() &&
          Array.isArray(q.distractors) &&
          q.distractors.filter(d => typeof d === 'string' && d.trim() && d !== q.answer).length >= 2
        )
        .map(q => ({
          type: q.type,
          focus: typeof q.focus === 'string' ? q.focus : '',
          key: typeof q.key === 'string' ? q.key : '',
          prompt: q.prompt.trim(),
          answer: q.answer.trim(),
          distractors: [...new Set(q.distractors.filter(d => typeof d === 'string' && d.trim() && d !== q.answer))].slice(0, 3),
          ko: typeof q.ko === 'string' ? q.ko : '',
        }))
    : [];
  if (questions.length < 3) return null;

  return {
    paragraph: raw.paragraph.trim(),
    translation: typeof raw.translation === 'string' ? raw.translation : '',
    sentences,
    questions,
  };
}

/**
 * 문단 응답 → 세션 문항으로 매핑 (기존 렌더러 재사용).
 * materials의 id/slug를 focus·key 문자열로 되짚어 채점 효과를 연결한다.
 * @returns {{items: Array, gradedCount: number}}
 */
export function mapParagraphToItems(para, materials) {
  let seq = 0;
  const uid = p => `p${p}-${++seq}`;
  const items = [];

  // ① 문단 읽기 카드 (집계 제외)
  items.push({
    uid: uid('read'),
    type: 'paragraph',
    paragraph: para.paragraph,
    translation: para.translation,
    sentences: para.sentences,
    newChapter: materials.newChapter || null,
  });

  const findDueWord = key => (materials.dueWords || []).find(w => w.word === key || key.includes(w.word));
  const findNewWord = key => (materials.newWords || []).find(w => w.word === key || key.includes(w.word));
  const findDuePattern = key => (materials.duePatterns || []).find(p => p.pattern === key || key.includes(p.pattern) || p.pattern.includes(key));

  for (const q of para.questions) {
    if (q.type === 'cloze') {
      const isNew = q.focus === 'new-grammar';
      const due = !isNew ? findDuePattern(q.key) : null;
      items.push({
        uid: uid('c'),
        type: 'grammar-cloze',
        quiz: { sentence: q.prompt, ko: q.ko, correct: q.answer, distractors: q.distractors, full: q.prompt.replace(/＿+/g, q.answer), pron: null },
        chapter: isNew
          ? (materials.newChapter || { title: '오늘의 문단' })
          : (due?.meta || { title: '복습' }),
        effect: isNew && materials.newChapter
          ? { kind: 'new-chapter', meta: materials.newChapter }
          : due
            ? { kind: 'grammar-due', srs: due.srs }
            : { kind: 'reading', key: q.prompt.slice(0, 60) },
      });
    } else if (q.type === 'vocab') {
      const due = q.focus === 'due-word' ? findDueWord(q.key) : null;
      const isNew = q.focus === 'new-word' ? findNewWord(q.key) : null;
      items.push({
        uid: uid('v'),
        type: 'vocab-choice',
        word: due
          ? { ...due.row, meaning: q.answer }
          : { word_text: q.key || q.prompt, meaning: q.answer, furigana: isNew?.pron || null },
        options: [q.answer, ...q.distractors],
        effect: due ? { kind: 'vocab', wordId: due.row.id } : { kind: 'reading', key: `vocab:${q.key}` },
      });
    } else {
      items.push({
        uid: uid('q'),
        type: 'read-meaning',
        sentence: { main: q.prompt, pron: null, isKoreanPrompt: true },
        options: [q.answer, ...q.distractors],
        correct: q.answer,
        effect: { kind: 'reading', key: `comp:${q.prompt.slice(0, 60)}` },
      });
    }
  }

  // ② 어순 조립 1문항 — 토큰이 온전한 문장 중 가장 긴 것
  const orderable = para.sentences
    .filter(s => s.tokens.length >= 3 && s.tokens.length <= 10 && s.tokens.join(' ').replace(/\s+/g, '') === s.text.replace(/\s+/g, ''))
    .sort((a, b) => b.tokens.length - a.tokens.length)[0];
  if (orderable) {
    items.push({
      uid: uid('o'),
      type: 'grammar-order',
      quiz: { tokens: orderable.tokens, answer: orderable.tokens.join(' '), ko: orderable.ko, pron: orderable.pron },
      chapter: { title: '오늘의 문단' },
      effect: { kind: 'reading', key: `order:${orderable.text.slice(0, 60)}` },
    });
  }

  return { items, gradedCount: items.filter(i => i.type !== 'paragraph').length };
}
