// 🚪 보르도 프랑스어 문화 도어 2종 (fr-21~22) — Claude 소유 콘텐츠. 리옹·마르세유·파리
// 도어와 별개 신규 세트(장면·챕터 비중복). 공식: 실전 한 장면 + 만능 표현 + 문화 사실 1개(헤지).
// track: 'french' — trackChapterHref 라우팅. 씬 배선은 bordeaux.js 라운드에서
// — tile 좌표는 geo 확정 후 주입(마르세유 선례).
// 사실·IP 규율: 와인·상점가·제과는 일반 참조(특정 상호·가문·로고 무표기),
// 보르도 강변 상권·구시가 건축은 외관·업종만.

export const BORDEAUX_DOORS = Object.freeze([
  Object.freeze({
    id: 'fr-21', name: '구시가 제과점', nameFr: 'Boulangerie du vieux Bordeaux', track: 'french',
    chapter: 'a2-05-past-participles',
    culture: '보르도의 구시가는 18세기 신고전주의 건축으로 유명해요 — 이른 아침 제과점 앞에는 신선한 빵 냄새가 나가요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'J\'ai acheté une pain complet ce matin.', reading: '제 아슈테 윤 팽 콩플레 쎄 마탱.', gloss: '이 아침에 통곡 식빵을 샀어요. (복합과거)' }),
      Object.freeze({ fr: 'Le pain rassis est bon pour les tartines.', reading: '르 팽 라시 에 봉 푸르 레 타르틴.', gloss: '어제 빵은 토스트에 좋아요. (분사 형용사)' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-22', name: '북강변 골동품점', nameFr: 'Brocanteur du Quai des Chartrons', track: 'french',
    chapter: 'a2-07-conditional',
    culture: '보르도의 샤르트롱은 18세기 와인 상인 거리예요 — 옛 창고와 상인 집들이 남아 있고, 지금은 골동품점과 전시공간이 들어섰어요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Auriez-vous des vases anciens ?', reading: '오리에 부 데 바즈 앙씬?', gloss: '오래된 병풍이 있으실까요? (조건법)' }),
      Object.freeze({ fr: 'Si j\'achète cet objet, quel serait le prix ?', reading: '씨 자슈트 쎄 토브제, 켈 쎄레 르 프리?', gloss: '이 물건을 사면 가격은 얼마죠? (조건문)' }),
    ]),
  }),
]);

export function bordeauxDoorById(id) {
  return BORDEAUX_DOORS.find((door) => door.id === id) ?? null;
}
