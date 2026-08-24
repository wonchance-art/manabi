// 엔진 벤치 전용 processed_json 합성기. 외부 자료·난수 상태 없이 같은 seed와 크기는
// 항상 같은 객체를 만든다. tokenCount는 sequence 길이와 정확히 일치한다.

const WORDS = ['학습', '언어', '문장', '기억', '발음', '독서', '표현', '대화'];
const POS = ['명사', '동사', '형용사', '부사', '조사', '기호'];

/** 32-bit 고정 PRNG(mulberry32). */
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {number} tokenCount
 * @param {number} seed
 * @returns {{sequence: string[], dictionary: Record<string, object>, lines: string[]}}
 */
export function synthProcessedJson(tokenCount, seed = 0x4d414e41) {
  if (!Number.isSafeInteger(tokenCount) || tokenCount < 0) {
    throw new RangeError('tokenCount must be a non-negative safe integer');
  }
  const random = seededRandom(seed);
  const sequence = new Array(tokenCount);
  const dictionary = {};
  const lineParts = [];
  const lines = [];

  for (let index = 0; index < tokenCount; index += 1) {
    const id = `t${index}`;
    const family = Math.floor(random() * WORDS.length);
    const variant = Math.floor(random() * 2048);
    const text = `${WORDS[family]}${variant}`;
    const pos = POS[Math.floor(random() * POS.length)];
    sequence[index] = id;
    dictionary[id] = { text, base_form: `${WORDS[family]}${variant % 1024}`, pos };
    lineParts.push(text);
    if (lineParts.length === 10) {
      lines.push(lineParts.join(' '));
      lineParts.length = 0;
    }
  }
  if (lineParts.length) lines.push(lineParts.join(' '));
  return { sequence, dictionary, lines };
}

