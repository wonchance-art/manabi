// 일본어 문장 → 학습용 토큰 분해.
//   1순위: vocab 사전 매칭 (긴 단어 우선)
//   2순위: 어미 매칭 (です/ですか/じゃないです 등)
//   3순위: 조사 1글자 매칭 (は/が/を/に/で…)
//   4순위: 구두점은 별도 토큰
//   나머지: buffer로 누적하여 한 덩어리

const PARTICLES = ['は', 'が', 'を', 'に', 'で', 'と', 'も', 'の', 'へ', 'や', 'か', 'ね', 'よ'];
const ENDINGS = [
  'じゃないです', 'じゃありません',
  'ではないです', 'ではありません',
  'ですか', 'ですね', 'ですよ',
  'ますか', 'ましょう', 'ました', 'ません', 'ます',
  'です',
];
const PUNCT = new Set(['、', '。', '？', '！', '?', '!', ',']);

export function tokenizeJa(ja, vocab) {
  if (!ja) return [];
  const sortedVocab = (vocab || [])
    .filter(v => v && typeof v.ja === 'string' && v.ja.length > 0)
    .slice()
    .sort((a, b) => b.ja.length - a.ja.length);
  const sortedEndings = ENDINGS.slice().sort((a, b) => b.length - a.length);

  const out = [];
  let buf = '';
  const flush = () => { if (buf) { out.push(buf); buf = ''; } };

  let i = 0;
  while (i < ja.length) {
    const ch = ja[i];
    if (/\s/.test(ch)) { flush(); i++; continue; }
    if (PUNCT.has(ch)) { flush(); out.push(ch); i++; continue; }

    let matched = null;
    for (const v of sortedVocab) {
      if (ja.startsWith(v.ja, i)) { matched = v.ja; break; }
    }
    if (matched) { flush(); out.push(matched); i += matched.length; continue; }

    let ending = null;
    for (const e of sortedEndings) {
      if (ja.startsWith(e, i)) { ending = e; break; }
    }
    if (ending) { flush(); out.push(ending); i += ending.length; continue; }

    if (PARTICLES.includes(ch)) { flush(); out.push(ch); i++; continue; }

    buf += ch;
    i++;
  }
  flush();
  return out;
}
