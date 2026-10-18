// 간체 정본 책을 번체로 읽기(LIT-SRC-WS-1, 오너 「권장대로」 2026-10-17 KST — 시안 B 「한 권 + 보기 전환」).
//
// 분석은 간체 정본(raw_text) 한 번뿐이고, 번체는 같은 자리의 글자만 바꿔 보여 준다. 위키문헌의 글자 변환은 같은 교정본에서
// 글자 수를 바꾸지 않으므로(빌드가 문단마다 길이를 검사한다) 토큰이 정본에서 차지하는 자리를 번체 사본에서 그대로 잘라 쓴다.
// 단어 카드·저장·복습·문장 지정은 모두 간체 token.text 그대로 — 바뀌는 것은 화면의 글자 모양뿐이다.
// 하나라도 어긋나면(토큰이 정본 줄과 맞지 않음 · 길이가 다름) 아무것도 바꾸지 않는다(fail-closed — 간체로 보인다).

const LINE_ID = /^(?:id|failed)_(\d+)_/u;

/**
 * json(분석 결과) + 정본 원문 + 같은 길이의 번체 사본 → Map(tokenId → 화면 글자). 맞지 않으면 null.
 * 토큰 id의 줄 번호(id_<줄>_…)로 줄을 찾고, 그 줄 안에서 토큰 순서대로 자리를 센다(analyzeText는 줄 = raw_text.split('\n')).
 */
export function scriptVariantSurfaces(json, rawText, variantText) {
  if (typeof rawText !== 'string' || typeof variantText !== 'string' || rawText.length !== variantText.length) return null;
  const sequence = Array.isArray(json?.sequence) ? json.sequence : null;
  if (!sequence || !json.dictionary) return null;
  const lines = rawText.split('\n');
  const variants = variantText.split('\n');
  if (lines.length !== variants.length || lines.some((line, index) => line.length !== variants[index].length)) return null;
  const cursor = new Map();
  const surfaces = new Map();
  for (const tokenId of sequence) {
    const token = json.dictionary[tokenId];
    if (!token || token.pos === '개행' || token.text === '\n') continue;
    const match = LINE_ID.exec(tokenId);
    const lineIndex = match ? Number(match[1]) : -1;
    if (!(lineIndex >= 0 && lineIndex < lines.length) || typeof token.text !== 'string') return null;
    const at = cursor.get(lineIndex) ?? 0;
    const end = at + token.text.length;
    if (lines[lineIndex].slice(at, end) !== token.text) return null;
    cursor.set(lineIndex, end);
    const shown = variants[lineIndex].slice(at, end);
    if (shown !== token.text) surfaces.set(tokenId, shown);
  }
  return surfaces;
}

/** 토큰 안의 조각들(루비 나눔 — splitRuby 순서) → 화면 글자로 바꾼 조각들. shown이 없으면 그대로. */
export function variantPieces(pieces, shown) {
  if (!shown) return pieces;
  const total = pieces.reduce((sum, piece) => sum + String(piece.kanji ?? piece.plain ?? '').length, 0);
  if (total !== shown.length) return pieces;
  let at = 0;
  return pieces.map((piece) => {
    const key = piece.kanji != null ? 'kanji' : 'plain';
    const text = piece[key] ?? '';
    const next = { ...piece, [key]: shown.slice(at, at + text.length) };
    at += text.length;
    return next;
  });
}
