/**
 * 공부 모드 — 오늘의 문단 생성.
 * 새 문법·새 어휘·복습 문법·복습 어휘를 전부 녹인 문단 하나를 AI로 만들고,
 * 세션의 모든 문항이 이 문단에서 파생된다.
 * 프롬프트 조립·응답 검증은 서버(/api/study-paragraph) 전용, 문항 매핑은 클라 공용.
 */

import { levelBand } from './writingPrompts';

const LANG_NAME = { Japanese: '일본어', English: '영어', French: '프랑스어', Chinese: '중국어' };

/** 주제 로테이션 풀 — 매일 다른 상황을 배경으로 (studyMaterials가 avoidThemes를 빼고 하나 고름) */
export const THEMES = ['일상', '학교', '여행', '음식', '쇼핑', '날씨와 계절', '가족과 친구', '취미', '감정', '계획'];

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
    preQuestion: {
      type: 'OBJECT',
      description: '읽기 전 목적을 주는 질문 (읽기 미션)',
      properties: {
        q: { type: 'STRING', description: '문단을 읽기 전 목적을 주는 한국어 질문 1개(답이 문단 안에 있어야 함)' },
        answerHint: { type: 'STRING', description: '답의 핵심 표현(한국어, 번역문에 그대로 등장하는 말)' },
      },
      required: ['q', 'answerHint'],
    },
  },
  required: ['paragraph', 'translation', 'sentences', 'questions', 'preQuestion'],
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

  const beginnerKanjiCare = m.language === 'Japanese' && levelBand(m.language, m.level) === 'beginner';

  // ── 기지어 제약 — 사용자가 아는 단어 범위 안에서 쓰게 유도 ──
  const known = Array.isArray(m.knownWords) ? m.knownWords.filter(w => typeof w === 'string' && w.trim()) : [];
  const whitelist = Array.isArray(m.whitelistWords) ? m.whitelistWords.filter(w => typeof w === 'string' && w.trim()) : [];
  let vocabConstraint = '';
  if (known.length >= 30) {
    vocabConstraint =
      `\n[어휘 난이도 제약]\n` +
      `[사용자가 이미 아는 단어 예시 — 이 범위의 쉬운 표현을 우선 사용] ${known.slice(0, 30).join(', ')}\n` +
      `그 밖의 새 단어는 최소화(문단 전체의 5% 이하).\n`;
  } else if (whitelist.length) {
    vocabConstraint =
      `\n[어휘 난이도 제약]\n` +
      `[이 단어 목록 안에서 최대한 조합] ${whitelist.slice(0, 40).join(', ')}\n`;
  }

  // ── 주제 로테이션 — 오늘의 주제, 최근 주제와 겹치지 않게 ──
  let themeLine = '';
  if (typeof m.theme === 'string' && m.theme.trim()) {
    themeLine = `오늘의 주제: ${m.theme.trim()}`;
    const avoid = Array.isArray(m.avoidThemes) ? m.avoidThemes.filter(t => typeof t === 'string' && t.trim()) : [];
    if (avoid.length) themeLine += ` (최근 다룬 주제(${avoid.join(', ')})와 겹치지 않게)`;
    themeLine += '\n\n';
  }

  return (
    `당신은 ${name} 교재 집필자입니다. ${m.level} 레벨 한국인 학습자를 위한 오늘의 학습 문단을 만드세요.\n\n` +
    themeLine +
    `[반드시 문단에 자연스럽게 녹일 재료]\n${parts.join('\n')}\n` +
    vocabConstraint + `\n` +
    `[문단 규칙]\n` +
    `- ${name} 3~5문장, 하나의 일상적 상황·이야기로 자연스럽게 연결 (재료 나열식 금지).\n` +
    `- 재료 외 어휘·문법은 ${m.level} 이하만. 문장은 짧고 명확하게.\n` +
    (beginnerKanjiCare ? `- 입문 레벨 배려: 한자는 재료 단어에 이미 포함된 것만 쓰고, 그 밖의 단어는 히라가나로 표기하세요. 사용한 한자에는 반드시 정확한 요미가나(pron)가 대응돼야 합니다.\n` : '') +
    `- sentences: 문단을 문장 단위로 나눠 pron(일본어=전체 요미가나 히라가나, 중국어=병음, 영어·프랑스어=빈 문자열), ko(문장 뜻), tokens(어순 조립용 3~10어절 분할 — 일본어·중국어는 의미 단위로 띄어 나누기)를 채우세요. tokens를 공백으로 이으면 원문과 일치해야 합니다(구두점 포함).\n\n` +
    `[문항 규칙 — questions]\n` +
    `- cloze: 새 문법으로 2개(focus=new-grammar, key=새 문법 패턴), 복습 문법마다 1개(focus=due-grammar, key=그 패턴). prompt는 문단의 실제 문장에서 해당 문법 부분만 ＿＿＿로 비운 것, answer는 빈칸 원형, distractors는 같은 자리에 올 법한 오답 3개, ko는 그 문장 뜻. distractors는 정답과 같은 단어의 다른 표기(한자↔가나 표기 차이)나 정답의 읽기여서는 절대 안 됩니다 — 의미나 형태가 실제로 다른 오답만.\n` +
    `- vocab: 복습 단어·새 단어 각각 1개씩(focus=due-word|new-word, key=단어 원문, prompt=단어 원문, answer=한국어 뜻, distractors=그럴듯한 다른 뜻 3개).\n` +
    `- comprehension: 문단 내용 이해 질문 1개 (한국어 질문·선택지 4개 중 answer 1개).\n` +
    `- 문항 순서: cloze(새 문법) → vocab → cloze(복습) → comprehension.\n\n` +
    `[읽기 미션 — preQuestion]\n` +
    `- preQuestion: 문단을 읽기 전 목적을 주는 한국어 질문 1개(답이 문단 안에 있어야 함)와 answerHint(답의 핵심 표현 — 번역문에 그대로 등장하는 말).\n\n` +
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

  const preQuestion = raw.preQuestion && typeof raw.preQuestion === 'object'
    ? {
        q: typeof raw.preQuestion.q === 'string' ? raw.preQuestion.q.trim() : '',
        answerHint: typeof raw.preQuestion.answerHint === 'string' ? raw.preQuestion.answerHint.trim() : '',
      }
    : null;

  return {
    paragraph: raw.paragraph.trim(),
    translation: typeof raw.translation === 'string' ? raw.translation : '',
    sentences,
    questions,
    preQuestion,
  };
}

/**
 * 결정적 2차 검증 — validateParagraph 통과물을 받아 불량 문항을 제거한다.
 * 모델이 지어낸(문단에 실재하지 않는) cloze·vocab 문항을 걸러 채점 신뢰도를 지킨다.
 * comprehension은 주관 판단이라 통과. preQuestion 힌트 불일치는 제네릭으로 우아하게 강등.
 * @returns {Object|null} 검증 후 questions.length < 3이면 null(재생성 신호)
 */
export function verifyParagraph(para) {
  if (!para || typeof para !== 'object' || !Array.isArray(para.questions)) return null;
  const strip = s => String(s || '').replace(/\s+/g, '');
  // 가타카나 → 히라가나 정규화(같은 단어의 표기 차이를 잡아내기 위함)
  const kataToHira = s => String(s || '').replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const normJa = s => strip(kataToHira(s));
  const isPureKana = s => /^[ぁ-ゖー]+$/.test(normJa(s));
  const hasKanji = s => /[一-鿿]/.test(String(s || ''));

  const paraStrip = strip(para.paragraph);
  const sentences = para.sentences || [];
  const sentTexts = sentences.map(s => strip(s.text));

  // 오답이 정답과 같은 단어의 다른 표기이거나 정답의 읽기인지 판별
  const isSameAnswerDisguised = (d, answer, sentence) => {
    if (normJa(d) === normJa(answer)) return true; // 표기 차이(한자/가나·가타카나 등) 후 동일
    // 오답이 순가나이고 정답에 한자가 있는데, 그 가나가 문장 요미가나에 등장하면
    // 정답의 읽기일 가능성이 높음(요미의 다른 부분과 우연히 겹칠 수 있으나,
    // 오답 하나를 잃는 것이 정답 2개 문항보다 낫다)
    if (isPureKana(d) && hasKanji(answer) && sentence?.pron && normJa(sentence.pron).includes(normJa(d))) return true;
    return false;
  };

  // ① cloze: 빈칸을 정답으로 복원한 문장이 실제 문단 문장에 부분 포함되는지(매칭된 문장으로 오답 검사)
  //    vocab: key가 문단에 실재하는지 + 표기·읽기 인지 오답 제거
  const questions = para.questions
    .map(q => {
      if (q.type === 'cloze') {
        const restored = strip(String(q.prompt).replace(/＿+/g, q.answer));
        const sentIdx = sentTexts.findIndex(t => t.includes(restored));
        if (!restored || sentIdx === -1) return null;
        const sentence = sentences[sentIdx];
        const distractors = (q.distractors || []).filter(d => !isSameAnswerDisguised(d, q.answer, sentence));
        if (distractors.length < 2) return null;
        return { ...q, distractors };
      }
      if (q.type === 'vocab') {
        const key = strip(q.key);
        if (!key || !paraStrip.includes(key)) return null;
        const distractors = (q.distractors || []).filter(d => normJa(d) !== normJa(q.answer));
        if (distractors.length < 2) return null;
        return { ...q, distractors };
      }
      return q; // comprehension — 결정적 판단 불가, 통과
    })
    .filter(Boolean);
  if (questions.length < 3) return null;

  // ② preQuestion: answerHint가 번역문·문장 뜻 어딘가에 부분일치하면 유지, 아니면 제네릭으로 강등
  const koPool = strip(para.translation) + (para.sentences || []).map(s => strip(s.ko)).join('');
  const hint = para.preQuestion && strip(para.preQuestion.answerHint);
  const preQuestion = (para.preQuestion && para.preQuestion.q && hint && koPool.includes(hint))
    ? para.preQuestion
    : { q: '어떤 이야기인지 그려보며 읽어보세요.', answerHint: '' };

  return { ...para, questions, preQuestion };
}

/**
 * 문단 응답 → 세션 문항으로 매핑 (기존 렌더러 재사용).
 * materials의 id/slug를 focus·key 문자열로 되짚어 채점 효과를 연결한다.
 * @returns {{items: Array, gradedCount: number}}
 */
export function mapParagraphToItems(para, materials) {
  let seq = 0;
  const uid = p => `p${p}-${++seq}`;

  // ① 문단 읽기 카드 (집계 제외)
  const readCard = {
    uid: uid('read'),
    type: 'paragraph',
    paragraph: para.paragraph,
    translation: para.translation,
    sentences: para.sentences,
    preQuestion: para.preQuestion || null,
    newChapter: materials.newChapter || null,
  };

  const findDueWord = key => (materials.dueWords || []).find(w => w.word === key || key.includes(w.word));
  const findNewWord = key => (materials.newWords || []).find(w => w.word === key || key.includes(w.word));
  const findDuePattern = key => (materials.duePatterns || []).find(p => p.pattern === key || key.includes(p.pattern) || p.pattern.includes(key));

  // 채점 문항을 _prio(작을수록 보존 우선)로 태깅해 모은다.
  // 새 문법 cloze 0 > comprehension 1 > 복습 cloze 2 > 어순 3 > vocab 4
  let graded = [];
  let ngSeen = 0; // 새 문법 cloze는 최대 2개만 최우선 보존(초과분은 최하위로 강등)
  for (const q of para.questions) {
    if (q.type === 'cloze') {
      const isNew = q.focus === 'new-grammar';
      const due = !isNew ? findDuePattern(q.key) : null;
      graded.push({
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
        _prio: isNew ? (++ngSeen <= 2 ? 0 : 9) : 2,
        _ng: isNew,
      });
    } else if (q.type === 'vocab') {
      const due = q.focus === 'due-word' ? findDueWord(q.key) : null;
      const isNew = q.focus === 'new-word' ? findNewWord(q.key) : null;
      graded.push({
        uid: uid('v'),
        type: 'vocab-choice',
        word: due
          ? { ...due.row, meaning: q.answer }
          : { word_text: q.key || q.prompt, meaning: q.answer, furigana: isNew?.pron || null },
        options: [q.answer, ...q.distractors],
        effect: due ? { kind: 'vocab', wordId: due.row.id } : { kind: 'reading', key: `vocab:${q.key}` },
        _prio: 4,
      });
    } else {
      graded.push({
        uid: uid('q'),
        type: 'read-meaning',
        sentence: { main: q.prompt, pron: null, isKoreanPrompt: true },
        options: [q.answer, ...q.distractors],
        correct: q.answer,
        effect: { kind: 'reading', key: `comp:${q.prompt.slice(0, 60)}` },
        _prio: 1,
      });
    }
  }

  // ② 어순 조립 1문항 — 토큰이 온전한 문장 중 가장 긴 것
  const orderable = para.sentences
    .filter(s => s.tokens.length >= 3 && s.tokens.length <= 10 && s.tokens.join(' ').replace(/\s+/g, '') === s.text.replace(/\s+/g, ''))
    .sort((a, b) => b.tokens.length - a.tokens.length)[0];
  if (orderable) {
    graded.push({
      uid: uid('o'),
      type: 'grammar-order',
      quiz: { tokens: orderable.tokens, answer: orderable.tokens.join(' '), ko: orderable.ko, pron: orderable.pron },
      chapter: { title: '오늘의 문단' },
      effect: { kind: 'reading', key: `order:${orderable.text.slice(0, 60)}` },
      _prio: 3,
    });
  }

  // ③ 채점 문항 하드캡 7 — 초과 시 우선순위 낮은 것부터 절단(남는 것의 상대 순서 유지)
  if (graded.length > 7) {
    const keep = new Set(
      graded.map((it, i) => ({ it, i }))
        .sort((a, b) => (a.it._prio - b.it._prio) || (a.i - b.i))
        .slice(0, 7)
        .map(x => x.i)
    );
    graded = graded.filter((_, i) => keep.has(i));
  }

  // ④ 새 문법 cloze 2개는 "사이 3문항 이상" 간격 — 첫째는 맨 앞, 둘째는 인덱스 ≥4(짧으면 맨 뒤)
  const ngIdx = [];
  graded.forEach((it, i) => { if (it._ng) ngIdx.push(i); });
  if (ngIdx.length === 2) {
    const [ia, ib] = ngIdx;
    const rest = graded.filter((_, i) => i !== ia && i !== ib);
    const result = [graded[ia], ...rest];
    result.splice(Math.min(4, result.length), 0, graded[ib]);
    graded = result;
  }

  const items = [readCard, ...graded.map(({ _prio, _ng, ...it }) => it)];
  return { items, gradedCount: items.filter(i => i.type !== 'paragraph').length };
}
