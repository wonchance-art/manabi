/**
 * 예보 탭 계측 — 카드가 '이어서' 덱에 흡수되며 순수 함수만 lib로 남았다(2026-08-24).
 */
/**
 * 예보 탭 계측 이벤트 — review_events의 source:'ui' 규약(docs/architecture-and-handoff.md §4.9).
 * review_events.correct는 NOT NULL이므로 ui 이벤트는 true로 채운다(qtype은 detail에 담는다 —
 * 코드베이스 전역 관례: 집계는 detail->>'qtype'로 필터). 순수 함수 — 테스트 대상.
 * @param {string} lang
 * @param {{count?: number}} [forecast]
 */
export function buildForecastTapEvent(lang, forecast) {
  return {
    lang,
    source: 'ui',
    item_key: '-',
    correct: true,
    detail: { qtype: 'forecast_tap', count: forecast?.count ?? 0 },
  };
}
