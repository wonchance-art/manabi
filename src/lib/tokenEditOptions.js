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
