// JLPT 단어 페이지 예문 단어 나눔(오너 확정 2026-10-19 KST · 문서 「일본어 판에서 달라지는 점」) — 순수 함수.
// 형태소(kuromoji — tokenizeJaLine)를 단어로 묶는다: 활용어 뒤 조동사 · て/で/ば는 앞 단어에(して · あります · 忘れない),
// 조사 · 기호 · 띄어쓰기는 따로. 원형(して → する)을 같이 싣는다. 데이터 예문의 띄어쓰기는 어절 단위라 그대로는 단어 경계로 쓰지 않는다.
//
// 분석은 시험(jaExampleWordsBuild.test.js)이 미리 해 src/lib/data/jaExampleWords.json에 싣는다 — 정적 페이지 조립 안에서 kuromoji를
// 처음 실으면 사전 읽기가 깨졌다(next dev 실측 2026-10-19 KST: Maximum call stack · ConnectionCosts buffer overflow). jaYomiIndex.json과 같은 선례.

const CONTENT_POS = new Set(['명사', '동사', '형용사', '형용동사', '부사', '연체사', '접속사', '감탄사', '접두사', '대명사']);
const INFLECTING = new Set(['동사', '형용사', '조동사']);
const TE = new Set(['て', 'で', 'ば', 'ちゃ', 'じゃ']);

/** 형태소 → 단어 조각 [{ text, lemma }] — lemma ''는 누르지 않는 조각(조사 · 조동사만 · 기호 · 띄어쓰기). */
export function jaWordPieces(tokens) {
  const pieces = [];
  for (const t of tokens || []) {
    const prev = pieces[pieces.length - 1];
    if (prev?.lemma && INFLECTING.has(prev.lastPos) && (t.pos === '조동사' || (t.pos === '조사' && TE.has(t.text)))) {
      prev.text += t.text;
      prev.lastPos = t.pos;
      continue;
    }
    const content = CONTENT_POS.has(t.pos) && !/^[\s　]+$/.test(t.text);
    pieces.push({ text: t.text, lastPos: t.pos, lemma: content ? (t.base_form || t.text) : '' });
  }
  return pieces.map(({ text, lemma }) => ({ text, lemma }));
}

/** 예문 열쇠 — 예문 글의 FNV-1a 32비트(36진). 생성 표가 예문 글을 그대로 싣지 않게(파일 크기). 충돌은 생성 시험이 막는다. */
export function jaExampleKey(text) {
  let h = 0x811c9dc5;
  for (const ch of String(text || '')) {
    const c = ch.codePointAt(0);
    h ^= c & 0xff; h = Math.imul(h, 0x01000193);
    if (c > 0xff) { h ^= (c >>> 8) & 0xff; h = Math.imul(h, 0x01000193); }
    if (c > 0xffff) { h ^= (c >>> 16) & 0xff; h = Math.imul(h, 0x01000193); }
  }
  return (h >>> 0).toString(36);
}

/** 조각 → 표 한 칸 문자열: 조각마다 「글자 수」, 누르지 않으면 앞에 _, 원형이 조각과 다르면 「:원형」. 예) 2,_1,_1,2,_1,_1,2:する */
export function encodeJaPieces(pieces) {
  return pieces.map((p) => {
    const n = [...p.text].length;
    if (!p.lemma) return `_${n}`;
    return p.lemma === p.text ? String(n) : `${n}:${p.lemma}`;
  }).join(',');
}

/** 표 한 칸 + 예문 글 → 조각. 글자 수 합이 예문과 다르면 null(예문이 바뀌었는데 표가 그대로). */
export function decodeJaPieces(code, text) {
  if (!code) return null;
  const chars = [...String(text || '')];
  const pieces = [];
  let at = 0;
  for (const part of String(code).split(',')) {
    const m = /^(_?)(\d+)(?::(.+))?$/.exec(part);
    if (!m) return null;
    const n = Number(m[2]);
    const t = chars.slice(at, at + n).join('');
    pieces.push({ text: t, lemma: m[1] ? '' : (m[3] || t) });
    at += n;
  }
  return at === chars.length ? pieces : null;
}

/**
 * 화면에 싣는 나눔 — 카드 단어가 여러 조각으로 갈리면 한 조각으로, 후리가나(furi = [시작, 글자 수, 읽기])가 조각 경계를 넘으면 그 조각들을 합친다.
 * 결과 { seg: 글자 수 배열, lem: 0(누르지 않음) · 1(조각 그대로) · '원형' } 또는 null(조각을 이어 원문이 안 되거나 한 조각뿐).
 */
export function jaExampleWords(text, word, pieces, furi = null) {
  const chars = [...String(text || '')];
  if (!chars.length || !pieces?.length || pieces.map((p) => p.text).join('') !== chars.join('')) return null;
  let at = 0;
  let spans = pieces.map((p) => { const n = [...p.text].length; const s = { from: at, to: at + n, lemma: p.lemma }; at += n; return s; });
  const merge = (from, to, lemma) => {
    const inside = spans.filter((s) => s.to > from && s.from < to);
    if (inside.length < 2) return;
    const span = { from: inside[0].from, to: inside[inside.length - 1].to };
    // 후리가나로 합친 조각(大学|生 → 大学生)은 모두 내용어면 합친 글자 그대로를 찾는다.
    const all = inside.every((s) => s.lemma) ? chars.slice(span.from, span.to).join('') : inside.find((s) => s.lemma)?.lemma || '';
    const merged = { ...span, lemma: lemma ?? all };
    spans = [...spans.filter((s) => s.to <= from), merged, ...spans.filter((s) => s.from >= to)];
  };
  const w = [...String(word || '')];
  if (w.length > 1) {
    for (let i = 0; i + w.length <= chars.length; i++) {
      if (w.every((c, j) => chars[i + j] === c)) { merge(i, i + w.length, w.join('')); i += w.length - 1; }
    }
  }
  for (const [from, n] of furi || []) merge(from, from + n);
  if (spans.length < 2) return null;
  return {
    seg: spans.map((s) => s.to - s.from),
    lem: spans.map((s) => (!s.lemma ? 0 : s.lemma === chars.slice(s.from, s.to).join('') ? 1 : s.lemma)),
  };
}
