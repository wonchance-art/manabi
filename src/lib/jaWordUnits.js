// 일본어 학습 단위(어절) 묶기 — 정본. 듣기 자막(listenSubtitles)과 읽기 화면(jaReaderChunks)이 같은 규칙을 쓴다.
// 듣기 자막 안에 있던 것을 그대로 옮겨 공용으로 올렸다(JA-UNITS-001, 오너 확정 C2 2026-11-05 KST) — 새 규칙을 따로 만들지 않는다.

// ── 어절 단위 묶기(학습 친화) — analyze 형태소 → 학습 단위 ──
//
// analyze(kuromoji) 토큰은 형태소 단위라 학습자에겐 너무 잘게 쪼개진다
// (思い+ます, 届い+たら). 여기서 tokenizeJa.js가 실제로 주는 **한국어 pos 문자열**
// (POS_MAP: 名詞→'명사'·動詞→'동사'·助動詞→'조동사'·助詞→'조사'·記号→'기호' …)을
// 근거로 형태소를 "어절 단위"로 병합한다.
//
//   · 새 단위 시작 = 내용어(명사·대명사·동사·형용사·형용동사·부사·연체사·접속사·
//     감동사(감탄사)·수사·간투사). ← CONTENT_POS
//   · 이어붙임 = 조동사(思い+ます) + 補助動詞(食べて+いる, base_form 사전) + 활용
//     어미(히라가나 휴리스틱: 用言 뒤 짧은 히라가나로 格助詞 집합이 아닌 것 — て·たら 등).
//   · 조사·기호 = 단독 단위(조사는 탭 가능하되 홀로).
//
// kuromoji의 서브품사(動詞-非自立·名詞-接尾 등)는 top-level pos에 안 드러나므로
// 補助動詞는 base_form 사전(AUX_VERB_BASES), 활용 어미는 히라가나 휴리스틱으로 커버한다.
// en/fr/zh는 토큰=단어라 사실상 identity(구두점만 분리) — content가 아닌 pos(null)라도
// 히라가나가 아니어서 붙지 않고 각자 단독 단위가 된다.

const VERBAL_POS = new Set(['동사', '형용사', '형용동사']);

const CONTENT_POS = new Set([
  '명사', '대명사', '동사', '형용사', '형용동사',
  '부사', '연체사', '접속사', '감동사', '감탄사', '수사', '간투사',
]);

// 격·계·종조사 — 히라가나여도 用言에 붙이지 않고 단독 단위로 둔다(猫/が/…).
// (여기 없는 히라가나 조사 て·で(접속)·ば 등은 用言 뒤면 붙는다 — 食べ+て.)
const STANDALONE_PARTICLES = new Set([
  'が', 'を', 'に', 'は', 'で', 'と', 'も', 'の', 'へ',
  'から', 'まで', 'より', 'や', 'か', 'ね', 'よ', 'な', 'わ', 'ぞ', 'ぜ', 'し',
]);

// 補助動詞 base_form — 히라가나로 쓰인 채 用言 뒤에 오면 앞 단위에 붙인다(食べて+いる).
const AUX_VERB_BASES = new Set([
  'いる', 'ある', 'なる', 'くる', '来る', 'いく', '行く', 'ゆく',
  'みる', '見る', 'おく', '置く', 'しまう', 'もらう', 'くれる', 'あげる',
  'いただく', 'くださる', 'おる', 'やる',
]);

function isHiraganaOnly(s) {
  return /^[぀-ゟー]+$/.test(String(s || ''));
}

function hasLetterOrNumber(s) {
  return /[\p{L}\p{N}]/u.test(String(s || ''));
}

/**
 * analyze 토큰({text, base_form, pos, furigana, meaning})을 학습 어절 단위로 병합한다(순수).
 * @param {{text?:string, base_form?:string, pos?:string, furigana?:string|null, meaning?:string}[]} tokens
 * @returns {{surface:string, base:string, furigana:string|null, meaning:string, tokens:object[]}[]}
 *   각 단위: surface(이어붙인 표면형), base(선두 내용어 base_form), furigana(토큰 후리가나
 *   이어붙임 — 후리가나 없으면 null), meaning(선두 토큰 뜻), tokens(원 토큰들).
 */
// 굳은 표현(문형) — 형태소가 아니라 표현 하나로 배우는 말. 기본형 열로 맞춘다(Sudachi C · 장단위 「복합사」 착안).
// 앞 用言에 붙이지 않고 한 단위로 세우며, 뒤 활용(ませ · ん · でし · た)은 받는다: 難しい | かもしれません.
export const JA_SET_EXPRESSIONS = Object.freeze([
  { bases: ['かも', 'しれる'], lemma: 'かもしれない', gloss: '~일지도 모른다' },
  { bases: ['か', 'も', 'しれる'], lemma: 'かもしれない', gloss: '~일지도 모른다' },
]);

function matchExpression(tokens, i) {
  for (const e of JA_SET_EXPRESSIONS) {
    if (e.bases.every((b, k) => (tokens[i + k]?.base_form || tokens[i + k]?.text) === b)) return e;
  }
  return null;
}

/**
 * @param {object} [opts]
 * @param {boolean} [opts.copulaAfterNoun=true] - 명사 뒤 조동사(です · だ)를 붙일지. 읽기 화면은 false — 学生 | です(뜻 단위가 명사).
 *   형용동사 연체형 な(静か+な)는 늘 붙인다.
 */
export function groupTokensToUnits(tokens, { copulaAfterNoun = true } = {}) {
  if (!Array.isArray(tokens) || tokens.length === 0) return [];
  const units = [];
  let cur = null; // 현재 병합 중인 단위(units 배열 원소를 참조) 또는 null

  const startUnit = (t, pendingPrefix = false) => {
    const pos = t?.pos || '';
    cur = {
      surface: String(t?.text ?? ''),
      base: t?.base_form || t?.text || '',
      furigana: null,
      meaning: t?.meaning || '',
      tokens: [t],
      _verbal: VERBAL_POS.has(pos) || pos === '조동사', // でし+た처럼 조동사로 시작한 술어도 뒤 활용을 받는다
      _mergeable: true,       // 내용어·접두사로 시작 → 뒤 어미/조동사를 받을 수 있음
      _pendingPrefix: pendingPrefix,
    };
    units.push(cur);
  };

  const attach = (t) => {
    cur.surface += String(t?.text ?? '');
    cur.tokens.push(t);
    if (VERBAL_POS.has(t?.pos || '')) cur._verbal = true;
  };

  // 用言(또는 이미 조동사가 붙어 술어가 된 단위) 뒤에 오는 짧은 히라가나(格助詞 아님)인가.
  const isConjugationTail = (surface) =>
    cur && cur._mergeable && cur._verbal &&
    isHiraganaOnly(surface) && surface.length <= 3 &&
    !STANDALONE_PARTICLES.has(surface);

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const pos = t?.pos || '';
    const surface = String(t?.text ?? '');

    // 0) 굳은 표현 — 앞 단위와 떼어 한 단위로 세우고 뒤 활용을 받는다.
    const expr = matchExpression(tokens, i);
    if (expr) {
      startUnit(t);
      for (let k = 1; k < expr.bases.length; k++) attach(tokens[i + k]);
      cur.base = expr.lemma;
      cur.expression = expr;
      cur._verbal = true;
      i += expr.bases.length - 1;
      continue;
    }

    // 1) 기호·구두점(문자/숫자 없음) — 단독 단위
    if (pos === '기호' || pos === '개행' || (surface.trim() && !hasLetterOrNumber(surface))) {
      startUnit(t);
      cur = null;
      continue;
    }

    // 2) 조사 — 원칙 단독. 단, 접속조사류(て·ば 등, 格助詞 집합 아님)가 用言 뒤면 붙임.
    if (pos === '조사') {
      // 음편 뒤 접속조사 で(読ん+で · 泳い+で)는 格助詞 で와 표기가 같다 — 동사 바로 뒤면 접속이다.
      const afterVerb = cur && cur._mergeable && cur.tokens[cur.tokens.length - 1]?.pos === '동사';
      if (isConjugationTail(surface) || (surface === 'で' && afterVerb)) attach(t);
      else { startUnit(t); cur = null; }
      continue;
    }

    // 3) 내용어 — 새 단위 시작(단, 補助動詞·접두사 대기는 앞 단위에 병합)
    if (CONTENT_POS.has(pos)) {
      // 補助動詞(히라가나 いる·ある …)가 用言 뒤면 붙임(食べて+いる)
      if (pos === '동사' && cur && cur._mergeable && cur._verbal &&
          isHiraganaOnly(surface) && AUX_VERB_BASES.has(t?.base_form)) {
        attach(t);
        continue;
      }
      // 접두사 대기 중이면 병합하고 head를 내용어로 승격(お+名前)
      if (cur && cur._pendingPrefix) {
        attach(t);
        cur.base = t?.base_form || t?.text || cur.base;
        cur.meaning = t?.meaning || cur.meaning;
        cur._verbal = VERBAL_POS.has(pos);
        cur._pendingPrefix = false;
        continue;
      }
      startUnit(t);
      continue;
    }

    // 4) 접두사 — 다음 내용어와 병합 대기(앞으로 붙임)
    if (pos === '접두사' || pos === '접두어') {
      startUnit(t, true);
      continue;
    }

    // 5) 조동사 — 앞 내용어/술어에 붙임(思い+ます, 好き+です). 붙일 곳 없으면 단독.
    if (pos === '조동사') {
      if (cur && cur._mergeable && (copulaAfterNoun || cur._verbal || surface === 'な')) attach(t);
      else startUnit(t);
      continue;
    }

    // 6) 그 외 불명확 pos — 用言 뒤 짧은 히라가나면 활용 어미로 붙임, 아니면 단독.
    if (isConjugationTail(surface)) attach(t);
    else startUnit(t);
  }

  // furigana 확정 + 내부 플래그 정리. 토큰 후리가나가 하나라도 있으면 (furigana||text)를
  // 이어붙여 단위 전체 읽기를 만든다(思い[おもい]+ます → おもいます). 전부 없으면 null.
  for (const u of units) {
    const anyFuri = u.tokens.some((t) => t?.furigana);
    u.furigana = anyFuri ? u.tokens.map((t) => t?.furigana || t?.text || '').join('') : null;
    delete u._verbal;
    delete u._mergeable;
    delete u._pendingPrefix;
  }
  return units;
}
