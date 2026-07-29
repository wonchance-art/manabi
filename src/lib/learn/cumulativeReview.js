// 누적 복습(RFC learning-path 추가 설계) — 매 5번째 챕터에서 직전 4챕터의 드릴을
// 결정적으로 1문항씩 샘플해 재출제한다. 신규 저작 없음: 간격 재노출은 재사용이 본질이며,
// 드릴 저작 시점의 겹침 금지 게이트와 충돌하지 않는다(복습은 명시적 재출제).

const EVERY = 5;

/** 결정적 샘플 인덱스 — 렌더마다 흔들리지 않게 order 기반 해시 */
function pickIndex(order, len) {
  return len > 0 ? (order * 7 + 3) % len : 0;
}

/**
 * @param {Array} levelChapters - 레지스트리 getGrammarChapters(level) (order 정렬 보장)
 * @param {string} currentSlug
 * @returns {Array} 복습 드릴(출처 라벨 포함) — 5번째 챕터가 아니면 []
 */
export function buildCumulativeReview(levelChapters, currentSlug) {
  const idx = (levelChapters ?? []).findIndex((ch) => ch?.slug === currentSlug);
  if (idx < 0) return [];
  const position = idx + 1; // 1-기준 순번
  if (position % EVERY !== 0) return [];
  const out = [];
  for (const prev of levelChapters.slice(Math.max(0, idx - (EVERY - 1)), idx)) {
    const drills = Array.isArray(prev?.drills) ? prev.drills : [];
    if (drills.length === 0) continue;
    const d = drills[pickIndex(prev.order ?? 0, drills.length)];
    out.push({ ...d, id: `rev-${currentSlug}-${d.id}`, sourceLabel: prev.title ?? prev.slug });
  }
  return out;
}
