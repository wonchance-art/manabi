// 🚪 리옹 프랑스어 문화 도어 2종 (fr-13~14) — Claude 소유 콘텐츠. 마르세유·파리 도어와 별개
// 신규 세트(장면·챕터 비중복). 공식: 실전 한 장면 + 만능 표현 + 문화 사실 1개(헤지).
// track: 'french' — trackChapterHref 라우팅. 씬 배선은 lyon.js 라운드에서
// — tile 좌표는 geo 확정 후 주입(마르세유 선례).
// 사실·IP 규율: 식재료·식사 문화는 일반 참조(특정 상호·브랜드 무표기),
// 리옹 미식 전통은 도시 정체성 건축·문화 외관만.

export const LYON_DOORS = Object.freeze([
  Object.freeze({
    id: 'fr-13', name: '레알 식료품 시장', nameFr: 'Marché de produits frais', track: 'french',
    chapter: 'a2-02-articles',
    culture: '리옹은 미식 도시로 알려져 있어요 — 레알 지구의 시장에서는 신선한 채소·치즈·육류가 가득해요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Je prends une livre de fromage, s\'il vous plaît.', reading: '즈 프랑 윤 리브르 드 프로마주, 실 부 플레.', gloss: '치즈를 반 킬로 주세요. (수량 표현)' }),
      Object.freeze({ fr: 'Combien coûte la douzaine d\'oeufs ?', reading: '콩비앵 쿠트 라 두젠 도에프?', gloss: '계란 한 다스는 얼마예요? (계산·기수)' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-14', name: '프레스킬 노천 카페', nameFr: 'Café en terrasse', track: 'french',
    chapter: 'a2-03-descriptive-adjectives',
    culture: '리옹의 카페는 반도 광장과 강변에 많이 있어요 — 커피를 마시며 도시의 풍경을 즐기는 것이 전통이에요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Je voudrais un café crème, s\'il vous plaît.', reading: '즈 부드레 운 카페 크렘, 실 부 플레.', gloss: '크림 넣은 커피를 주세요. (정중한 요청)' }),
      Object.freeze({ fr: 'La terrasse est très ensoleillée.', reading: '라 떼라스 에 트레 앙솔레유.', gloss: '테라스에 햇빛이 많이 들어요. (형용사)' }),
    ]),
  }),
]);

export function lyonDoorById(id) {
  return LYON_DOORS.find((door) => door.id === id) ?? null;
}
