// 뜻·발음 수동 편집(링큐식)의 후보 구성 — 공유 사전 항목·현재 토큰 값·다음자 후보를
// 중복 없이 합친다. UI(TokenEditPanel)와 분리된 순수 로직: 후보 규칙이 곧 계약이다.

/**
 * 뜻 후보 — 사전의 다중 뜻(pos 태그 동반 가능, 흔한 순)이 먼저, 현재 표시 뜻(교정 이력
 * 반영값)이 사전에 없으면 뒤에 붙는다.
 * @returns {Array<{meaning: string, pos?: string}>}
 */
export function buildMeaningOptions(dictEntry, token) {
  const opts = [];
  const seen = new Set();
  const push = (meaning, pos) => {
    const m = String(meaning || '').trim();
    if (!m || seen.has(m)) return;
    seen.add(m);
    opts.push({ meaning: m, ...(pos ? { pos: String(pos).trim() } : {}) });
  };
  for (const m of dictEntry?.meanings || []) push(m?.meaning, m?.pos);
  push(token?.meaning);
  return opts;
}

/**
 * 발음 후보 — 현재 표시 발음(문장 문맥 병음 #1004)이 먼저, 사전 발음·추가 후보(다음자 등)
 * 순. 전부 트림·중복 제거.
 * @returns {string[]}
 */
export function buildReadingOptions(dictEntry, token, extra = []) {
  const out = [];
  const seen = new Set();
  for (const r of [token?.furigana, dictEntry?.reading, ...extra]) {
    const v = String(r || '').trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

/**
 * 저장할 교정 구성(패널 마감 ③) — 실제 바뀐 필드만 담는다.
 * - 뜻을 비우는 교정은 무시한다(빈 뜻은 표시상 '(뜻 없음)'일 뿐 교정으로 무의미).
 * - 발음 비우기는 허용한다(잘못 붙은 병음·후리가나 제거는 정당한 교정).
 * - pos는 뜻 칩 선택에 동반될 때만 실린다(뜻 교정 없이 pos만 바뀌는 일 없음).
 * @returns {object|null} 저장할 교정 — 바뀐 게 없으면 null(무저장 닫기 신호)
 */
export function buildTokenCorrections(token, { meaning, reading, meaningPos } = {}) {
  const corrections = {};
  const nextMeaning = String(meaning || '').trim();
  const nextReading = String(reading || '').trim();
  if (nextMeaning && nextMeaning !== (token?.meaning || '')) corrections.meaning = nextMeaning;
  if (nextReading !== (token?.furigana || '')) corrections.furigana = nextReading;
  if (corrections.meaning && meaningPos) corrections.pos = meaningPos;
  return Object.keys(corrections).length > 0 ? corrections : null;
}
