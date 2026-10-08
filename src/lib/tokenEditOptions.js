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

/**
 * 사전 뜻 목록의 줄을 눌러 「이 자리 뜻」으로 교정할 때의 교정 구성(AE-R1 PR③ · VIEWER-V2-ROUNDS-001 §2.1 사전 뜻 목록).
 * TokenEditPanel에서 그 뜻 칩을 고르고 저장한 것과 같다 — 뜻 + (그 뜻에 품사 태그가 있으면) 품사. 발음은 싣지 않는다.
 * 품사는 buildMeaningOptions의 뜻별 pos만 쓴다(행 품사·refVocab 품사로 토큰 품사를 바꾸지 않는다).
 * @returns {object|null} 저장할 교정 — 지금 뜻과 같거나 빈 뜻이면 null(쓰기 0)
 */
export function senseCorrectionFor(token, dictEntry, meaning) {
  const next = String(meaning || '').trim();
  if (!next || next === (token?.meaning || '')) return null;
  const option = buildMeaningOptions(dictEntry, token).find((opt) => opt.meaning === next);
  return { meaning: next, ...(option?.pos ? { pos: option.pos } : {}) };
}

/**
 * 되돌리기 교정 — 바꾼 칸(corrections의 키)만 이전 토큰 값 그대로. 이전에 값이 없던 칸은 빈 문자열.
 * @returns {object}
 */
export function revertCorrections(beforeToken, corrections) {
  const out = {};
  for (const key of Object.keys(corrections || {})) out[key] = beforeToken?.[key] ?? '';
  return out;
}

/**
 * 교정 적용 — 토큰에 교정 칸을 덮고, 뜻을 교정했으면 「뜻 확인 필요」 내부 표식(meaningCheck)을 지운다
 * (뷰어 v2 AD-R4 §6.2·§6.3·§7: 사용자가 정한 뜻이 이긴다). 같은 뜻을 확정하는 교정([이대로 둘게요])도 지운다.
 * correctTokenMutation이 저장 직전과 카드 갱신에 같은 함수를 쓴다(새 쓰기 경로 아님).
 * @returns {object} 새 토큰
 */
export function applyTokenCorrections(token, corrections) {
  const next = { ...token, ...corrections };
  if (corrections && Object.hasOwn(corrections, 'meaning')) delete next.meaningCheck;
  return next;
}
