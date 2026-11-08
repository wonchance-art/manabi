/**
 * 시드 자료 타이틀 파서 — `[N5 문법 #16] 의문사 정리 (...)` → 메타 추출
 *
 * 지원 패턴:
 *   [N5 문법 #1] ...        → { level: 'N5', series: '문법', num: 1 }
 *   [A1 grammar #10] ...    → { level: 'A1', series: 'grammar', num: 10 }
 *   [N5 카나 #2] ...        → { level: 'N5', series: '카나', num: 2 }
 *   [N5 실용 #3] ...        → { level: 'N5', series: '실용', num: 3 }
 *   [A1 phrases #1] ...     → { level: 'A1', series: 'phrases', num: 1 }
 *   [N5] 学校の一日 (...)    → { level: 'N5', series: null, num: null }
 *   사용자 임의 타이틀         → { level: null, series: null, num: null }
 */
export function parseTitle(title) {
  if (!title || typeof title !== 'string') {
    return { level: null, series: null, num: null, display: title || '' };
  }
  const m = title.match(/^\[(\w+)(?:\s+([^\]#]+?))?(?:\s+#(\d+))?\]\s*(.*)$/);
  if (!m) return { level: null, series: null, num: null, display: title };
  return {
    level: m[1] || null,
    series: m[2] ? m[2].trim() : null,
    num: m[3] ? parseInt(m[3], 10) : null,
    display: (m[4] || '').trim(),
  };
}

/** 시리즈 이름의 화면 말(발매 점검 M5, 오너 「권장대로」 2026-11-08 KST) — 한국어 화면에 영어 「grammar」가 보이지 않게. 모르는 이름은 그대로. */
const SERIES_LABEL_KO = Object.freeze({ grammar: '문법', phrases: '표현' });
export function seriesLabelKo(series) {
  if (!series) return '';
  return SERIES_LABEL_KO[String(series).toLowerCase()] || series;
}

/**
 * 카드에 보일 제목(M5) — 시리즈 형식(「[A1 grammar #5] Family & Relationships」)이면 코드 뒤 본문만. 급수는 메타 줄 · 시리즈는 위치 표지가 말한다.
 * 데이터 제목은 그대로다(숨김 규칙 · 이전 · 다음 편 · 쉬운순이 코드를 읽는다). 시리즈가 아니면(「[N5] …」 · 사용자 제목) 그대로.
 */
export function seriesCardTitle(title) {
  const meta = parseTitle(title);
  return meta.level && meta.series && meta.display ? meta.display : (title || '');
}

/**
 * 같은 레벨 안의 학습 경로 자연 순서: 시리즈 → 번호 → 최신순. 시리즈 없는 자료는 뒤로.
 * 자료 목록의 쉬운순과, 최신순에서 같은 시각을 나눠 가진 묶음이 함께 쓴다(SERIES-ORDER-001).
 */
export function compareSeriesPath(a, b) {
  const ma = parseTitle(a?.title);
  const mb = parseTitle(b?.title);
  const sa = ma.series || '\uffff';
  const sb = mb.series || '\uffff';
  if (sa !== sb) return sa.localeCompare(sb);
  if (ma.num != null && mb.num != null) return ma.num - mb.num;
  if (ma.num != null) return -1;
  if (mb.num != null) return 1;
  return new Date(b?.created_at) - new Date(a?.created_at);
}

/**
 * 시리즈별 총 편수(카드의 「#5/23」) — `level|series` → 가장 큰 번호.
 * 편수를 세면 빠진 번호가 있을 때 「2/1」이 된다(운영 실측 2026-11-08 KST: [H3 여행 #2]만 공개, SERIES-ORDER-001).
 */
export function seriesTotalsOf(items) {
  const totals = new Map();
  for (const item of items || []) {
    const m = parseTitle(item?.title);
    if (!m.level || !m.series || m.num == null) continue;
    const key = `${m.level}|${m.series}`;
    totals.set(key, Math.max(totals.get(key) || 0, m.num));
  }
  return totals;
}

/**
 * 같은 (level, series)에서 다음 번호 찾기. nextNum = currentNum + 1
 * 없으면 null.
 */
export function findNextInSeries(currentMeta, allTitles) {
  if (!currentMeta?.level || !currentMeta?.series || currentMeta.num == null) return null;
  let best = null;
  let bestDelta = Infinity;
  for (const t of allTitles) {
    const mm = parseTitle(t.title);
    if (
      mm.level === currentMeta.level &&
      mm.series === currentMeta.series &&
      mm.num != null &&
      mm.num > currentMeta.num &&
      mm.num - currentMeta.num < bestDelta
    ) {
      best = t;
      bestDelta = mm.num - currentMeta.num;
    }
  }
  return best;
}
