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
