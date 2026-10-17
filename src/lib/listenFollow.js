// 듣기 따라가기(뷰어 기능 감사 목업 6 · 1단계, 2026-10-17 KST) — 「본문 전체 듣기」가 읽는 **문장**을 본문 토큰에 잇는다.
// 듣기(ListenControls)는 원문(raw_text)을 문장부호로 나눠 읽는다. 문장마다 원문의 어느 줄 · 줄 안 몇째 글자(공백 제외)부터
// 몇째까지인지 알면, 분석 안 된 줄이 0인 자료(줄마다 원문 글자 = 토큰 글자를 이은 것 — inspectAnalysisCoverage)에서는
// 그 글자 구간을 덮는 토큰을 그대로 고를 수 있다. 한 줄(문단)에 문장이 여럿이어도 그 문장만 강조한다(리뷰 차단 1).
// 나누는 규칙은 이 파일 한 곳 — 듣기와 잇기가 어긋나지 않게.

/** 듣기가 읽는 문장 목록 — 줄바꿈 묶음은 공백 하나, 문장부호 뒤에서 나눈다(ListenControls 정본 규칙 그대로). */
export function splitListenSentences(text) {
  return String(text || '')
    .replace(/\n+/g, ' ')
    .split(/(?<=[。.!?！？])\s*/)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * 문장 i의 원문 자리 — 줄마다 [{ line, from, to }](줄 안 공백 아닌 글자 번호, to 미포함). 못 찾으면 null.
 * 줄바꿈 묶음을 공백 하나로 바꾼 글(듣기가 나누는 글)에서 글자마다 원래 자리를 기억해 두고, 문장을 앞에서부터 차례로 찾는다.
 */
export function listenSentenceRanges(rawText) {
  const raw = String(rawText || '');
  let joined = '', line = 0, nw = 0;
  const at = [];
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '\n') {
      line++; nw = 0;
      if (raw[i - 1] !== '\n') { joined += ' '; at.push(null); }
      continue;
    }
    joined += ch;
    at.push(/\s/.test(ch) ? null : { line, nw: nw++ });
  }
  let cursor = 0;
  return splitListenSentences(raw).map(sentence => {
    const start = joined.indexOf(sentence, cursor);
    if (start < 0) return null;
    cursor = start + sentence.length;
    const segments = [];
    for (let j = start; j < start + sentence.length; j++) {
      const spot = at[j];
      if (!spot) continue;
      const last = segments[segments.length - 1];
      if (last && last.line === spot.line) last.to = spot.nw + 1;
      else segments.push({ line: spot.line, from: spot.nw, to: spot.nw + 1 });
    }
    return segments.length ? segments : null;
  });
}

/** 문장이 시작하는 원문 줄(문장마다) — 못 찾으면 null. */
export function listenSentenceLines(rawText) {
  return listenSentenceRanges(rawText).map(range => range?.[0]?.line ?? null);
}

/**
 * 문장 자리(listenSentenceRanges 한 칸)를 덮는 토큰 id — 본문 순서.
 * tokensOfLine(line) = 그 줄 토큰 [{ id, text }](개행 제외, 순서대로). 토큰 글자에서 공백을 빼고 길이를 이어 세어
 * 줄 안 글자 구간과 겹치는 토큰만 고른다. 글자가 맞지 않는 자료는 호출 쪽이 따라가기 자체를 끈다(분석 안 된 줄 0 조건).
 */
export function listenSentenceTokens(segments, tokensOfLine) {
  const ids = [];
  for (const { line, from, to } of segments || []) {
    let acc = 0;
    for (const { id, text } of tokensOfLine(line) || []) {
      const len = String(text || '').replace(/\s/g, '').length;
      const start = acc;
      acc += len;
      if (len && start < to && acc > from) ids.push(id);
    }
  }
  return ids;
}
