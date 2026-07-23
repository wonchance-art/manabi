// 🚪 코트다쥐르 프랑스어 문화 도어 4종 (fr-25~28) — Claude 소유 콘텐츠. 기존 fr 세트와
// 챕터·장면 비중복(비포함 단계: a2-03, a2-05, a2-07, a2-02). 공식: 실전 한 장면 + 만능 표현
// + 문화 사실 1개(헤지). track: 'french' — trackChapterHref 라우팅.
// 사실·IP 규율: 예술·시장·해변은 일반 문화 참조(특정 작가·상호·로고 무표기),
// 구시가·요새·마을은 외관·업종만.

export const COTE_DAZUR_DOORS = Object.freeze([
  Object.freeze({
    id: 'fr-25', name: '구시가 공방', nameFr: 'Atelier d\'artisan', track: 'french',
    chapter: 'a2-07-futur-simple',
    culture: '지중해 연안의 오래 된 마을들은 예술가와 장인들의 거점이 되어 왔어요 — 지금도 골목 곳곳의 공방에서 지역 전통 도자기와 염직을 배울 수 있어요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Vous verrez comment nous fabriquons la poterie.', reading: '부 베레 코맹 누 파브리콩 라 포트리.', gloss: '우리가 도자기를 어떻게 만드는지 보실 거예요. (단순미래)' }),
      Object.freeze({ fr: 'Vous pourrez essayer cette technique vous-même.', reading: '부 푸레 에세 쎄트 떼크니크 부 므.', gloss: '이 기법을 직접 시도해 보실 수 있어요. (단순미래 — pouvoir)' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-26', name: '해변 제과점', nameFr: 'Pâtisserie côtière', track: 'french',
    chapter: 'a1-05-questions',
    culture: '니스의 해변 산책로는 지중해 관광객들로 북적이는데, 지역 베이커리에서 팔리는 아침 타르트와 에클레어는 프로방스 제과의 대표 경험이에요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Avez-vous des tartes aux fruits?', reading: '아브 부 데 타르트 오 프뤼이?', gloss: '과일 타르트가 있어요? (의문문 — inversion)' }),
      Object.freeze({ fr: 'Qu\'est-ce que vous recommandez ce matin?', reading: '께스크 부 레코망데 쎄 마탱?', gloss: '이 아침에 뭘 추천하세요? (Qu\'est-ce que)' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-27', name: '절벽 마을 식료품점', nameFr: 'Epicerie de village', track: 'french',
    chapter: 'a1-08-aller-venir',
    culture: '프로방스 절벽 마을들은 단지 관광지가 아니라 살아있는 공동체예요 — 지역 생산자들이 직접 진열한 포도주·올리브유·수제 치즈는 여행자와 주민의 만남 장소가 되어 주어요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Je viens de la montagne pour acheter des fromages.', reading: '즈 비앙 드 라 몽따뉴 푸르 아슈테 데 프로마주.', gloss: '저는 치즈를 사기 위해 산에서 내려왔어요. (venir)' }),
      Object.freeze({ fr: 'Les touristes vont acheter le vin à côté.', reading: '레 투리스트 봉 타슈테 르 뱅 아 코테.', gloss: '관광객들은 옆에서 포도주를 사러 가요. (aller)' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-28', name: '호텔 안내 데스크', nameFr: 'Accueil d\'hôtel', track: 'french',
    chapter: 'a1-10-numbers-time',
    culture: '모나코 항구는 세계적 요트축제의 중심지예요 — 고급 호텔들은 손님들의 도시 탐방과 식사 예약을 도와주는 안내가 일상적인 서비스 문화에요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Le petit déjeuner est servi de sept heures à dix heures.', reading: '르 쁘띠 데제흐 에 세르비 드 셉 뢰르 아 디즈 뢰르.', gloss: '조식은 7시부터 10시까지 제공되어요. (시간 표현)' }),
      Object.freeze({ fr: 'À quelle heure voulez-vous dîner ce soir?', reading: '아 켈 뢰르 불레 부 디네 쎄 수아르?', gloss: '오늘 저녁에 몇 시에 식사하시겠어요? (시간 질문)' }),
    ]),
  }),
]);

export function coteDazurDoorById(id) {
  return COTE_DAZUR_DOORS.find((door) => door.id === id) ?? null;
}
