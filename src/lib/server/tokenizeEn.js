// 서버 전용 — 영어 토큰화 + lemmatization
// wink-lemmatizer (동사/명사) + 불규칙 사전 (형용사/명사 복수)

import lemmatizer from 'wink-lemmatizer';

const NOUN_IRREGULARS = {
  children: 'child', men: 'man', women: 'woman', people: 'person',
  teeth: 'tooth', feet: 'foot', mice: 'mouse', geese: 'goose',
  lives: 'life', knives: 'knife', wives: 'wife', leaves: 'leaf',
  wolves: 'wolf', shelves: 'shelf', halves: 'half',
};

const ADJECTIVE_IRREGULARS = {
  better: 'good', best: 'good', worse: 'bad', worst: 'bad',
  more: 'many', most: 'many', less: 'little', least: 'little',
  bigger: 'big', biggest: 'big', larger: 'large', largest: 'large',
  smaller: 'small', smallest: 'small', older: 'old', oldest: 'old',
};

const VERB_IRREGULARS = {
  am: 'be', is: 'be', are: 'be', was: 'be', were: 'be', been: 'be',
};

// 기존 기본 lemma 선택 순서를 보존한다. 문맥 판별 실패 시 이 값으로 정확히 폴백해야 하므로
// POS 후보용 사전과 분리한다.
const IRREGULARS = {
  ...NOUN_IRREGULARS,
  ...ADJECTIVE_IRREGULARS,
  ...VERB_IRREGULARS,
};

function lemmatize(word) {
  const lower = word.toLowerCase();
  if (lower.length <= 2) return lower;
  if (IRREGULARS[lower]) return IRREGULARS[lower];

  // wink-lemmatizer: verb → noun → adjective 순서로 시도
  const asVerb = lemmatizer.verb(lower);
  if (asVerb !== lower) return asVerb;
  const asNoun = lemmatizer.noun(lower);
  if (asNoun !== lower) return asNoun;
  const asAdj = lemmatizer.adjective(lower);
  if (asAdj !== lower) return asAdj;

  return lower;
}

/**
 * 영어 표면형의 POS별 결정적 lemma 후보.
 * 기본(base_form)은 위 레거시 lemmatize 규칙을 그대로 쓰고, 이 후보는 문맥 판별이 성공했을 때만
 * 선택한다. 기타 품사는 표면 소문자를 유지한다.
 */
export function buildEnLemmaCandidates(word) {
  const lower = String(word || '').toLowerCase();
  if (!lower) return {};
  if (lower.length <= 2) {
    return { '동사': lower, '명사': lower, '형용사': lower, '기본': lower };
  }
  return {
    '동사': VERB_IRREGULARS[lower] || lemmatizer.verb(lower),
    '명사': NOUN_IRREGULARS[lower] || lemmatizer.noun(lower),
    '형용사': ADJECTIVE_IRREGULARS[lower] || lemmatizer.adjective(lower),
    '기본': lower,
  };
}

export function tokenizeEnLine(line) {
  if (!line || !line.trim()) return [];

  // 라틴 문자 클래스 — ASCII + 악상·합자(À-Ö·Ø-ö·ø-ÿ = ×·÷ 뺀 라틴-1, Œœ·Ÿ 보충).
  // 프랑스어 자료가 이 토크나이저를 공용하는데, ASCII만 매칭하면 café→caf처럼 악상에서
  // 단어가 끊겨 뜻 조회·만남 대조(rfc-vocab-encounter §4.7)가 전부 빗나간다.
  const LATIN = "A-Za-zÀ-ÖØ-öø-ÿŒœŸ";
  const PATTERN = new RegExp(`([${LATIN}][${LATIN}'\\-]*[${LATIN}]?|[${LATIN}]|[.,!?;:"'()\\[\\]]|\\d+)`, 'g');
  const tokens = [];
  let match;
  while ((match = PATTERN.exec(line)) !== null) {
    const surface = match[0];
    const isPunct = /^[.,!?;:"'()\[\]]$/.test(surface);
    const isNumber = /^\d+$/.test(surface);

    tokens.push({
      text: surface,
      base_form: isPunct ? surface : lemmatize(surface),
      furigana: '',
      pos: isPunct ? '기호' : isNumber ? '수사' : null,
      ...(!isPunct && !isNumber ? { lemma_candidates: buildEnLemmaCandidates(surface) } : {}),
    });
  }
  return tokens;
}
