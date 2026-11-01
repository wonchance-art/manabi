// 대화 모드 v2-Z — 자료가 대화인지(conversationOf)와 줄별 토큰 묶음(tokensByLineIndex)만(VIEWER-JS-001).
// 뷰어는 이 둘을 첫 렌더부터 동기로 묻는다. 턴을 끼우는 계산(applyTurnResult · applyFillResult — 분석 줄 대조 포함)은
// turnModel.js에 그대로 있고, 뷰어는 대화 화면이 열린 뒤 그 모듈을 받는다(첫 로드 page 청크에서 뺀다). turnModel이 여기 것을 다시 내보낸다.
// 이 파일은 네트워크·DB를 모른다.

export const CONVERSATION_VERSION = 1;

/** 대화 자료 표식 — 없으면 null. */
export function conversationOf(material) {
  const value = material?.processed_json?.metadata?.conversation;
  return value && value.version === CONVERSATION_VERSION && Array.isArray(value.turns) ? value : null;
}

/** 줄 번호 → 그 줄의 토큰 id(분석 줄·실패 줄). 개행 토큰은 뺀다. */
export function tokensByLineIndex(sequence) {
  const map = new Map();
  for (const id of sequence || []) {
    const m = /^(?:id|failed)_(\d+)_/.exec(id);
    if (!m) continue;
    const line = Number(m[1]);
    if (!map.has(line)) map.set(line, []);
    map.get(line).push(id);
  }
  return map;
}
