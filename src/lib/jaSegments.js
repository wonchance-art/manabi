// 일본어 본문을 vocab 매칭 + 조사 「は」 강조 가능한 세그먼트로 분할.
//
// 결과 세그먼트 타입:
//   - { type: 'text', text }                       일반 텍스트
//   - { type: 'vocab', text, ko }                  vocab 단어
//   - { type: 'particle', text: 'は', reading: 'わ' }  조사 「は」 (vocab 단어 직후)

const TOPIC_WA = 'は';

export function parseJaSegments(ja, vocab) {
  if (!ja) return [];
  const sorted = (vocab || [])
    .filter(v => v && typeof v.ja === 'string' && v.ja.length > 0)
    .slice()
    .sort((a, b) => b.ja.length - a.ja.length);

  const segs = [];
  let buf = '';
  let i = 0;
  const flush = () => { if (buf) { segs.push({ type: 'text', text: buf }); buf = ''; } };

  while (i < ja.length) {
    let matched = null;
    for (const v of sorted) {
      if (ja.startsWith(v.ja, i)) { matched = v; break; }
    }
    if (matched) {
      flush();
      segs.push({ type: 'vocab', text: matched.ja, ko: matched.ko });
      i += matched.ja.length;
      if (ja[i] === TOPIC_WA) {
        segs.push({ type: 'particle', text: TOPIC_WA, reading: 'わ' });
        i += 1;
      }
    } else {
      buf += ja[i];
      i += 1;
    }
  }
  flush();
  return segs;
}
