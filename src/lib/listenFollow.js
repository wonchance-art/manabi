// 듣기 따라가기(뷰어 기능 감사 목업 6 · 1단계, 2026-10-17 KST) — 「본문 전체 듣기」가 읽는 문장을 본문 줄에 잇는다.
// 듣기(ListenControls)는 원문(raw_text)을 문장부호로 나눠 읽는다. 그 문장이 원문의 몇째 줄에서 시작하는지 알면
// 뷰어가 그 줄의 첫 토큰이 있는 쪽으로 넘기고 그 줄을 강조할 수 있다. 나누는 규칙은 이 파일 한 곳 — 듣기와 잇기가 어긋나지 않게.

/** 듣기가 읽는 문장 목록 — 줄바꿈 묶음은 공백 하나, 문장부호 뒤에서 나눈다(ListenControls 정본 규칙 그대로). */
export function splitListenSentences(text) {
  return String(text || '')
    .replace(/\n+/g, ' ')
    .split(/(?<=[。.!?！？])\s*/)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * 듣기 문장 i가 시작하는 원문 줄 번호(0부터) — 못 찾으면 null.
 * 줄바꿈 묶음을 공백 하나로 바꾼 글(듣기가 나누는 글)에서 글자마다 원래 줄을 기억해 둔 뒤, 문장을 앞에서부터 차례로 찾는다.
 */
export function listenSentenceLines(rawText) {
  const raw = String(rawText || '');
  let joined = '', line = 0;
  const lineOf = [];
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '\n') {
      line++;
      if (raw[i - 1] !== '\n') { joined += ' '; lineOf.push(line); }
      continue;
    }
    joined += ch;
    lineOf.push(line);
  }
  let cursor = 0;
  return splitListenSentences(raw).map(sentence => {
    const at = joined.indexOf(sentence, cursor);
    if (at < 0) return null;
    cursor = at + sentence.length;
    return lineOf[at];
  });
}
