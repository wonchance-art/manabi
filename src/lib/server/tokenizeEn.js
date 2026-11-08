// 서버 전용 — 영어 토큰화 + lemmatization
// wink-lemmatizer (동사/명사) + 불규칙 사전 (형용사/명사 복수)

import lemmatizer from 'wink-lemmatizer';

const NOUN_IRREGULARS = {
  children: 'child', men: 'man', women: 'woman', people: 'person',
  teeth: 'tooth', feet: 'foot', mice: 'mouse', geese: 'goose',
  lives: 'life', knives: 'knife', wives: 'wife', leaves: 'leaf',
  wolves: 'wolf', shelves: 'shelf', halves: 'half',
  lenses: 'lens', // wink noun()은 lense(없는 낱말)로 돌린다
};

// 복수형이 곧 표제어인 명사 — 단수로 돌리면 다른 낱말(pants → pant 「헐떡이다」 · goods → good · shorts → short ·
// species → specie 「정화(正貨)」)이거나 없는 낱말(outskirt · crossroad)이 된다(EN-LEMMA-PLURAL · 2026-11-09 KST 로컬 점검,
// 운영 공개 · 비공개 영어 자료 영향 0 — 새 분석부터). 명사 후보 · 기본 lemma의 명사 단계에서만 그대로 둔다(동사 후보는 wink 그대로).
const PLURAL_ONLY_NOUNS = new Set([
  'species', 'physics', 'crossroads', 'outskirts', 'headquarters', 'means', 'series', 'news',
  'pants', 'trousers', 'jeans', 'shorts', 'pajamas', 'pyjamas', 'scissors', 'clothes',
  'goods', 'belongings', 'savings', 'surroundings',
]);

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

// -ss로 끝나는 낱말은 복수가 아니다 — wink noun()이 pass → pas · boss → bos로 s를 떼어 공유 사전의 다른 낱말(pas 「(발레) 걸음」)에
// 붙던 자리(공개 #127 · #132 · #150 실측, EN-LEMMA-SS · 2026-11-09 KST). passes · bosses(-sses)는 그대로 noun()이 단수로 돌린다.
const nounLemma = (lower) => (/ss$/.test(lower) || PLURAL_ONLY_NOUNS.has(lower) ? lower : lemmatizer.noun(lower));

function lemmatize(word) {
  const lower = word.toLowerCase();
  if (lower.length <= 2) return lower;
  if (IRREGULARS[lower]) return IRREGULARS[lower];

  // wink-lemmatizer: verb → noun → adjective 순서로 시도
  const asVerb = lemmatizer.verb(lower);
  if (asVerb !== lower) return asVerb;
  const asNoun = nounLemma(lower);
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
    '명사': NOUN_IRREGULARS[lower] || nounLemma(lower),
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
  // 마지막 갈래 = 위 어디에도 걸리지 않는 공백 아닌 글자 묶음(— $ % ’ _ 숫자 사이 - · 다른 문자) → 기호 토큰.
  // 버리면 토큰을 이은 값이 원문과 달라 완료 판정(completeAnalysis)이 매번 실패한다 — 공개 시드 134
  // 「010-1234-5678」이 서버 작업에서 3회 재시도 후 포기된 실측(2026-11-07 KST). 토큰을 이으면 공백만 빼고 원문과 같다.
  // 서수(1st · 2nd · 3rd · 21st · 25th)는 한 토큰 — 숫자와 접미를 쪼개면 「st」 · 「th」가 뜻 없는 낱말로 남는다
  // (공개 #125 「September 1st」 · #135 「…25th」 실측, SEED-QA-002 · 2026-11-08 KST). 뒤에 라틴 글자가 더 붙으면(2nds) 서수가 아니다.
  const ORDINAL = `\\d+(?:st|nd|rd|th|ST|ND|RD|TH)(?![${LATIN}])`;
  const PATTERN = new RegExp(`([${LATIN}][${LATIN}'\\-]*[${LATIN}]?|[${LATIN}]|[.,!?;:"'()\\[\\]]|${ORDINAL}|\\d+|[^\\s${LATIN}\\d.,!?;:"'()\\[\\]]+)`, 'g');
  const ORDINAL_ONLY = new RegExp(`^${ORDINAL}$`);
  const WORD_OR_NUMBER = new RegExp(`^[${LATIN}\\d]`);
  const tokens = [];
  let match;
  while ((match = PATTERN.exec(line)) !== null) {
    const surface = match[0];
    const isPunct = !WORD_OR_NUMBER.test(surface);
    const isNumber = /^\d+$/.test(surface);
    const isOrdinal = ORDINAL_ONLY.test(surface);

    tokens.push({
      text: surface,
      base_form: isPunct ? surface : isOrdinal ? surface.toLowerCase() : lemmatize(surface),
      furigana: '',
      pos: isPunct ? '기호' : isNumber || isOrdinal ? '수사' : null,
      ...(!isPunct && !isNumber && !isOrdinal ? { lemma_candidates: buildEnLemmaCandidates(surface) } : {}),
    });
  }
  return tokens;
}
