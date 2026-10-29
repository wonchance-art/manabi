// 긴 글의 쪽 넘김을 구간 단위로 그리기(VIEWER-SECTIONS-001, 오너 「둘 다 ㄱㄱ」 2026-10-29 KST — 설계 · 목업 승인).
// 뷰어는 본문 낱말 칸 수에 비례해 느려진다(390 · CPU×4: 3,619칸 LCP 5.3 s · 낱말 누름 0.76 s — 첫 배치에서 화면 밖 본문까지 전부 배치).
// 쪽 넘김(다단)은 content-visibility가 쪽 수를 바꿔 쓸 수 없으므로(99 → 37쪽 실측), 전자책 리더(foliate-js · epub.js · Readium이 한 번에
// 한 장만 그린다)처럼 줄을 구간으로 묶어 지금 구간만 그린다. 이 파일은 순수 계산 — 줄 묶기 · 구간 나누기 · 쪽 표시 문구.

/**
 * 본문 줄 — sequence를 개행 토큰으로 자른 [{ rawIdx, tokenIds }]. 렌더 · 문장 목록(sentences)이 같은 규칙을 쓴다(따로 짓지 않는다).
 * rawIdx = 원문 줄 번호(토큰 id `id_<줄>_<n>`에서, 없으면 앞 줄 + 1).
 */
export function readerLineGroups(sequence, dictionary) {
  const lineGroups = [];
  if (!Array.isArray(sequence) || !dictionary) return lineGroups;
  let curGroup = { rawIdx: 0, tokenIds: [] };
  for (const tokenId of sequence) {
    const token = dictionary[tokenId];
    if (!token) continue;
    if (token.pos === '개행') {
      lineGroups.push(curGroup);
      const m = tokenId.match(/^(?:id|br|failed)_(\d+)_/);
      curGroup = { rawIdx: m ? parseInt(m[1]) + 1 : curGroup.rawIdx + 1, tokenIds: [] };
    } else {
      const m = tokenId.match(/^(?:id|failed)_(\d+)_/);
      if (m && curGroup.tokenIds.length === 0) curGroup.rawIdx = parseInt(m[1]);
      curGroup.tokenIds.push(tokenId);
    }
  }
  if (curGroup.tokenIds.length) lineGroups.push(curGroup);
  return lineGroups;
}

// 구간 하나의 낱말 칸 목표 — 600칸 실측(LCP 2.5 s · 누름 0.18 s)보다 가볍게. 이보다 짧은 글은 나누지 않는다(지금 그대로).
export const SECTION_TARGET_TOKENS = 500;
export const SECTIONED_MIN_TOKENS = 1200;

/**
 * 줄을 구간으로 — [{ start, end, tokens }] (줄 번호 [start, end)). 줄은 쪼개지 않는다: 목표 칸 수에 닿을 때까지 줄을 이어 붙이고, 남은 꼬리가
 * 목표의 절반보다 짧으면 앞 구간에 붙인다(마지막 쪽이 몇 줄뿐인 구간이 생기지 않게). 글 전체가 minTotal보다 짧으면 null(나누지 않음).
 */
export function buildReaderSections(lineGroups, { target = SECTION_TARGET_TOKENS, minTotal = SECTIONED_MIN_TOKENS } = {}) {
  const counts = (lineGroups || []).map(group => group?.tokenIds?.length || 0);
  const total = counts.reduce((a, b) => a + b, 0);
  if (total < minTotal || counts.length < 2) return null;
  const sections = [];
  let start = 0, tokens = 0;
  counts.forEach((n, i) => {
    tokens += n;
    if (tokens >= target) { sections.push({ start, end: i + 1, tokens }); start = i + 1; tokens = 0; }
  });
  if (start < counts.length) {
    if (sections.length && tokens < target / 2) { const last = sections[sections.length - 1]; last.end = counts.length; last.tokens += tokens; }
    else sections.push({ start, end: counts.length, tokens });
  }
  return sections.length > 1 ? sections : null;
}

/** 줄 번호 → 구간 번호(이진 탐색). 범위 밖이면 가장 가까운 끝 구간. */
export function sectionOfLine(sections, line) {
  if (!sections?.length) return 0;
  let lo = 0, hi = sections.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (sections[mid].start <= line) lo = mid; else hi = mid - 1;
  }
  return lo;
}

/** 토큰 id → 줄 번호 표(렌더 줄 기준). */
export function lineIndexOfTokens(lineGroups) {
  const map = new Map();
  (lineGroups || []).forEach((group, i) => { for (const id of group.tokenIds) map.set(id, i); });
  return map;
}

/**
 * 구간 쪽 표시(목업 승인): 앞 구간의 쪽 수를 모두 알면 「N쪽 · P%」, 모든 구간의 쪽 수를 알면 「N / 전체쪽 · P%」, 앞 구간을 아직 안 지나왔으면(가운데서
 * 연 글) 「P%」. 반환 = { page, count, percent } — page · count는 모르면 null(문구는 뷰어가 화면 언어로 짓는다).
 * counts = 구간별 쪽 수(모르면 undefined), percent = 글 전체 낱말 칸 기준 진도.
 */
export function sectionedPagePosition({ section, page, counts, percent }) {
  const pct = Math.min(100, Math.max(0, Math.round(percent)));
  const before = counts.slice(0, section);
  if (before.some(n => !(n > 0))) return { page: null, count: null, percent: pct };
  const number = before.reduce((a, b) => a + b, 0) + page + 1;
  const total = counts.length && counts.every(n => n > 0) ? counts.reduce((a, b) => a + b, 0) : null;
  return { page: number, count: total, percent: pct };
}

/** 글 전체 진도(%) — 앞 구간 낱말 칸 + 지금 구간 안 진도(쪽 기준 %)만큼. */
export function sectionedPercent(sections, section, withinPercent) {
  const total = sections.reduce((a, s) => a + s.tokens, 0);
  if (!total) return 0;
  const before = sections.slice(0, section).reduce((a, s) => a + s.tokens, 0);
  return ((before + (Math.min(100, Math.max(0, withinPercent)) / 100) * sections[section].tokens) / total) * 100;
}
