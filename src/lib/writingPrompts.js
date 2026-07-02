/**
 * 라이팅 스튜디오 — 언어별 첨삭 rubric·주제 은행·응답 스키마·검증.
 * 프롬프트는 서버(/api/writing-feedback)에서만 조립하고, 클라이언트는
 * validateFeedback을 통과한 구조화 결과만 받는다.
 */

/** 언어별 레벨 목록 (UI 칩 순서) */
export const WRITING_LEVELS = {
  Japanese: ['N5', 'N4', 'N3', 'N2', 'N1'],
  English: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  French: ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  Chinese: ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'],
};

/** 레벨 → 난이도 밴드 (주제 은행·rubric 눈높이) */
export function levelBand(language, level) {
  const order = WRITING_LEVELS[language] || [];
  const i = order.indexOf(String(level || '').toUpperCase());
  if (i < 0) return 'beginner';
  const t = i / Math.max(1, order.length - 1);
  return t < 0.4 ? 'beginner' : t < 0.75 ? 'intermediate' : 'advanced';
}

/** 주제 은행 — 밴드별 일상 주제 (한국어 프롬프트, 작문은 학습 언어로) */
const TOPICS = {
  beginner: [
    '오늘 아침에 무엇을 먹었는지 써 보세요.',
    '내 방에 무엇이 있는지 소개해 보세요.',
    '주말에 하고 싶은 일을 써 보세요.',
    '가장 좋아하는 음식과 그 이유를 써 보세요.',
    '오늘 날씨와 기분을 써 보세요.',
    '가족 중 한 명을 소개해 보세요.',
    '매일 하는 일과를 순서대로 써 보세요.',
    '지금 배우고 있는 것에 대해 써 보세요.',
  ],
  intermediate: [
    '최근에 본 영화나 드라마의 감상을 써 보세요.',
    '기억에 남는 여행 경험을 써 보세요.',
    '스트레스를 푸는 자신만의 방법을 설명해 보세요.',
    '10년 후의 나에게 하고 싶은 말을 써 보세요.',
    '최근에 산 물건과 그 이유를 써 보세요.',
    '친구에게 자기 동네를 추천하는 글을 써 보세요.',
    '어릴 때와 지금의 자신을 비교해 보세요.',
    '요즘 관심 있는 뉴스에 대한 생각을 써 보세요.',
  ],
  advanced: [
    '기술이 언어 학습을 어떻게 바꾸고 있는지 의견을 써 보세요.',
    '살면서 가치관이 바뀐 계기를 서술해 보세요.',
    '자신이 생각하는 좋은 어른의 조건을 논해 보세요.',
    '전통과 변화 중 무엇이 더 중요한지 주장해 보세요.',
    '일과 삶의 균형에 대한 자신의 철학을 써 보세요.',
    '최근 사회 이슈 하나를 골라 찬반 의견을 써 보세요.',
    '자신에게 영향을 준 책이나 인물을 소개하고 이유를 분석해 보세요.',
    '완벽한 하루를 묘사하되, 비유를 한 번 이상 써 보세요.',
  ],
};

export function topicsFor(language, level) {
  return TOPICS[levelBand(language, level)] || TOPICS.beginner;
}

/** 언어별 rubric — 한국인 학습자의 상투 전이 오류를 명시적으로 검사 지시 */
const LANG_RUBRIC = {
  Japanese: {
    name: '일본어',
    pitfalls:
      '- 조사 오용: は/が 구분, 가능형·희망(〜たい)·好き 계열의 を→が, に/で 혼동\n' +
      '- 한국어 직역: 한국어 관용구를 그대로 옮긴 부자연스러운 표현\n' +
      '- 정중체(です·ます)와 보통체가 한 글 안에서 뒤섞이는 문체 불일치\n' +
      '- 자동사/타동사 혼동(開く/開ける 등), 수수동사(あげる/くれる/もらう) 시점 오류\n' +
      '- 한자어 false friend(愛人·工夫·勉強 등 한국어와 뜻이 다른 한자어)',
  },
  English: {
    name: '영어',
    pitfalls:
      '- 관사(a/an/the) 누락·오용, 명사 단복수 일치\n' +
      '- 시제 일치와 완료형(have p.p.) 회피 경향\n' +
      '- 전치사 선택 오류(in/on/at, to/for)\n' +
      '- 한국어 어순 전이(부사 위치, 주어 생략)\n' +
      '- 콩글리시 어휘(handphone, service 등)와 직역 표현',
  },
  French: {
    name: '프랑스어',
    pitfalls:
      '- 명사·형용사의 성수 일치 누락\n' +
      '- 관사 체계 오류(부분관사 du/de la, 부정문에서 de)\n' +
      '- passé composé/imparfait 선택, être/avoir 조동사 선택\n' +
      '- 전치사 à/de 혼동, 동사별 전치사 결합\n' +
      '- 영어식 표현의 직역(불어에서 어색한 anglicisme)',
  },
  Chinese: {
    name: '중국어',
    pitfalls:
      '- 어순 오류: 시간·장소 부사어 위치(주어 뒤·동사 앞), 한국어 SOV 전이\n' +
      '- 양사 누락·오용(个 남용 포함)\n' +
      '- 了의 과잉·누락(완료 vs 변화), 과거 표현에서 무조건 了를 붙이는 습관\n' +
      '- 是/在/有 혼동, 이합사(见面 등)의 목적어 오류\n' +
      '- 한국 한자어를 그대로 옮긴 단어 선택(중국어에서 다른 뜻이거나 안 쓰는 말)',
  },
};

/** Gemini structured output 스키마 (responseSchema) */
export const FEEDBACK_SCHEMA = {
  type: 'OBJECT',
  properties: {
    score: { type: 'INTEGER', description: '1~5 종합 점수' },
    summary: { type: 'STRING', description: '한국어 총평 2~3문장' },
    levelFit: { type: 'STRING', description: 'below | fit | above' },
    sentences: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          original: { type: 'STRING' },
          corrected: { type: 'STRING' },
          errors: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                part: { type: 'STRING', description: '원문에서 문제인 조각' },
                fix: { type: 'STRING', description: '고친 형태' },
                why: { type: 'STRING', description: '한국어 설명 1문장' },
                tag: { type: 'STRING', description: '문법 포인트 이름' },
              },
              required: ['part', 'fix', 'why', 'tag'],
            },
          },
        },
        required: ['original', 'corrected', 'errors'],
      },
    },
    naturalness: { type: 'ARRAY', items: { type: 'STRING' }, description: '더 자연스러운 대안 제안 (한국어 설명 포함)' },
  },
  required: ['score', 'summary', 'levelFit', 'sentences', 'naturalness'],
};

/**
 * 첨삭 지시 프롬프트 조립 (서버 전용)
 * @param {Object} p - { language, level, text, promptType, prompt, chapterPatterns }
 */
export function buildFeedbackPrompt({ language, level, text, promptType, prompt, chapterPatterns }) {
  const r = LANG_RUBRIC[language];
  if (!r) return null;
  const band = levelBand(language, level);
  const bandKo = band === 'beginner' ? '초급' : band === 'intermediate' ? '중급' : '고급';

  let context = '';
  if (promptType === 'chapter' && chapterPatterns?.length) {
    context =
      `\n[과제] 학습자는 방금 배운 아래 문법 패턴을 써서 작문하는 과제를 받았습니다:\n` +
      chapterPatterns.map(p2 => `- ${p2.pattern}${p2.patternKo ? ` (${p2.patternKo})` : ''}`).join('\n') +
      `\n패턴을 실제로 썼는지 확인하고, 안 썼다면 naturalness에 패턴을 활용한 예시 문장을 1개 포함하세요.\n`;
  } else if (prompt) {
    context = `\n[과제] 작문 주제: "${prompt}"\n주제에서 벗어났으면 summary에서 짚어 주세요.\n`;
  }

  return (
    `당신은 ${r.name} 원어민 교사이며, 한국인 학습자 전문가입니다. ` +
    `학습자 레벨은 ${level}(${bandKo})입니다. 아래 작문을 첨삭하세요.\n` +
    context +
    `\n[한국인 학습자가 자주 틀리는 지점 — 반드시 점검]\n${r.pitfalls}\n` +
    `\n[첨삭 규칙]\n` +
    `- 문장 단위로 나눠 각 문장마다 original(원문 그대로)·corrected(자연스러운 교정)·errors를 채우세요.\n` +
    `- 오류가 없는 문장은 corrected를 원문과 같게, errors는 빈 배열로.\n` +
    `- errors의 why는 한국어 1문장, tag는 문법 포인트 이름(예: "조사 が", "관사", "성수 일치", "양사").\n` +
    `- 철자·활용 같은 기계적 오류도 잡되, 레벨(${bandKo})에서 아직 안 배웠을 고급 문법을 요구하지 마세요.\n` +
    `- naturalness: 문법은 맞지만 더 자연스러운 대안이 있으면 최대 3개 (대안 문장 + 한국어 설명).\n` +
    `- score: 5 자연스럽고 정확 / 4 사소한 오류 / 3 뜻은 통함 / 2 전달 어려움 / 1 대부분 비문.\n` +
    `- levelFit: 작문 난이도가 레벨보다 쉬우면 below, 맞으면 fit, 도전적이면 above.\n` +
    `- summary: 한국어 2~3문장. 잘한 점 1개를 반드시 포함하고, 최우선 개선점 1개를 짚으세요.\n` +
    `\n[학습자 작문]\n${text}\n` +
    `\n지정된 JSON 스키마로만 응답하세요. 설명은 전부 한국어로.`
  );
}

/**
 * 응답 방어 검증·정규화 — 필수 구조가 없으면 null.
 * 모델이 스키마를 살짝 벗어나도(필드 누락·타입 흔들림) 살릴 수 있는 만큼 살린다.
 */
export function validateFeedback(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const sentences = Array.isArray(raw.sentences)
    ? raw.sentences
        .filter(s => s && typeof s.original === 'string' && typeof s.corrected === 'string')
        .map(s => ({
          original: s.original,
          corrected: s.corrected,
          errors: (Array.isArray(s.errors) ? s.errors : [])
            .filter(e => e && typeof e.part === 'string' && typeof e.fix === 'string')
            .map(e => ({
              part: e.part,
              fix: e.fix,
              why: typeof e.why === 'string' ? e.why : '',
              tag: typeof e.tag === 'string' && e.tag ? e.tag : '기타',
            })),
        }))
    : [];
  if (sentences.length === 0) return null;

  const scoreNum = Number(raw.score);
  const score = Number.isFinite(scoreNum) ? Math.min(5, Math.max(1, Math.round(scoreNum))) : 3;
  const levelFit = ['below', 'fit', 'above'].includes(raw.levelFit) ? raw.levelFit : 'fit';

  return {
    score,
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    levelFit,
    sentences,
    naturalness: (Array.isArray(raw.naturalness) ? raw.naturalness : []).filter(n => typeof n === 'string').slice(0, 3),
  };
}
