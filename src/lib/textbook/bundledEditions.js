// 저장소에 번들이 있는 판본 id — 책마다(GUEST-STATIC-001 5단계). 정본은 src/content/textbookEditions/<id>/bundle.json(bookId · editionId)이고,
// 이 표는 그 디렉터리 목록을 글자로 옮긴 것이다: middleware(엣지 — 파일을 읽지 않는다)가 `?edition=<id>` 하나뿐인 교재 요청을 판본별 판으로
// 넘길지 고르고, 판(/books/<책>/edition/[edition]/[hint])이 generateStaticParams로 이 id만 굽는다(dynamicParams false — 임의 id로 판을 만들지 않는다).
// 발행 여부는 여기서 정하지 않는다 — 판이 발행 도장(공개 행)을 확인해, 도장 없는 판본은 동적 화면의 손님과 같은 안내를 그린다.
// 판본 폴더를 더하거나 빼면 이 표도 고친다(계약: src/lib/__tests__/bookEditionStatic.test.js가 디렉터리 목록과 대조한다).
export const BUNDLED_EDITIONS = Object.freeze({
  'japanese-n5': Object.freeze(['7f572327dc67893e9453246c', '8a8c1c1fd452773810abaf8c', 'fdf070fa5123b18cc55f24c7']),
  'japanese-n4': Object.freeze(['f4a6411c0945bbd3f8767af7']),
  'japanese-n3': Object.freeze(['4978c146953f14140bcb49d2']),
});

export const isBundledEdition = (bookId, edition) => typeof edition === 'string' && Object.hasOwn(BUNDLED_EDITIONS, bookId) && BUNDLED_EDITIONS[bookId].includes(edition);
