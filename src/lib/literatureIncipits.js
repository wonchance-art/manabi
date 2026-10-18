// 정본 문학책(아오조라) 장 첫 문장 — 서재 책 카드 목차 줄 전용(LIT-DISPLAY-001).
// 장 첫 문장 표(manifest.incipits.generated.json — 전체 대조표에서 빌드가 파생)는 표시용 대조표와 따로 둔다: 홈은 쓰지 않는데 40KB다.
import incipits from '../content/literature/aozora/manifest.incipits.generated.json';

/** 책 key · 장 순서 → 그 장 첫 문장(literatureDisplay.literatureIncipit 규칙으로 빌드가 만든 값). 표에 없으면 null. */
export function literatureChapterIncipit(key, order, works = incipits.works) {
  const chapters = typeof key === 'string' && Object.hasOwn(works, key) ? works[key] : null;
  const at = String(order);
  return chapters && Object.hasOwn(chapters, at) ? chapters[at] : null;
}
