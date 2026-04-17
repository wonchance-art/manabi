// 서버 전용 — 영어 토큰화 + lemmatization
// wink-lemmatizer (동사/명사) + 불규칙 사전 (형용사/명사 복수)

import lemmatizer from 'wink-lemmatizer';

const IRREGULARS = {
  // 명사 불규칙 복수
  children: 'child', men: 'man', women: 'woman', people: 'person',
  teeth: 'tooth', feet: 'foot', mice: 'mouse', geese: 'goose',
  lives: 'life', knives: 'knife', wives: 'wife', leaves: 'leaf',
  wolves: 'wolf', shelves: 'shelf', halves: 'half',
  // 형용사 비교급/최상급
  better: 'good', best: 'good', worse: 'bad', worst: 'bad',
  more: 'many', most: 'many', less: 'little', least: 'little',
  bigger: 'big', biggest: 'big', larger: 'large', largest: 'large',
  smaller: 'small', smallest: 'small', older: 'old', oldest: 'old',
  // be 동사
  am: 'be', is: 'be', are: 'be', was: 'be', were: 'be', been: 'be',
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

export function tokenizeEnLine(line) {
  if (!line || !line.trim()) return [];

  const PATTERN = /([A-Za-z][A-Za-z'\-]*[A-Za-z]?|[A-Za-z]|[.,!?;:"'()\[\]]|\d+)/g;
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
    });
  }
  return tokens;
}
