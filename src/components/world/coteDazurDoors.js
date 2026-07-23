// 🚪 코트다쥐르 프랑스어 문화 도어 4종 (fr-25~28) — Claude 소유 콘텐츠. 기존 프랑스어권 5세트
// (파리·MSM·마르세유·제네바·레만)과 챕터 비중복(a1 03·04·07 + a0-06 미사용). 공식: 실전 한 장면 + 만능 표현
// + 문화 사실 1개(헤지). track: 'french' — trackChapterHref 라우팅.
// 사실·IP 규율: 예술·시장·해변은 일반 문화 참조(특정 작가·상호·로고 무표기),
// 구시가·요새·마을은 외관·업종만.

export const COTE_DAZUR_DOORS = Object.freeze([
  Object.freeze({
    id: 'fr-25', name: '구시가 공방', nameFr: 'Atelier d\'artisan', track: 'french',
    chapter: 'a1-03-er-verbs',
    culture: '지중해 연안의 오래 된 마을들은 예술가와 장인들의 거점이 되어 왔어요 — 지금도 골목 곳곳의 공방에서 지역 전통 도자기와 염직을 배울 수 있어요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Je fabrique la poterie chaque jour.', reading: '즈 파브리크 라 포트리 셰크 주르.', gloss: '저는 매일 도자기를 만들어요. (-er 동사 현재형)' }),
      Object.freeze({ fr: 'Vous démontrez cette technique?', reading: '부 데몬트레 쎄트 떼크니크?', gloss: '이 기법을 보여 주세요? (-er 동사 — démontrer)' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-26', name: '해변 제과점', nameFr: 'Pâtisserie côtière', track: 'french',
    chapter: 'a1-04-negation',
    culture: '니스의 해변 산책로는 지중해 관광객들로 북적이는데, 지역 베이커리에서 팔리는 아침 타르트와 에클레어는 프로방스 제과의 대표 경험이에요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Je n\'aime pas les gâteaux sucrés.', reading: '즈 네 팬 파 레 가토 쉬크레.', gloss: '저는 단 케이크를 좋아하지 않아요. (ne...pas)' }),
      Object.freeze({ fr: 'Vous n\'avez pas de tartes ce matin?', reading: '부 나베 파 드 타르트 쎄 마탱?', gloss: '이 아침에 타르트가 없으세요? (ne...pas + de)' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-27', name: '절벽 마을 식료품점', nameFr: 'Epicerie de village', track: 'french',
    chapter: 'a1-07-possessives',
    culture: '프로방스 절벽 마을들은 단지 관광지가 아니라 살아있는 공동체예요 — 지역 생산자들이 직접 진열한 포도주·올리브유·수제 치즈는 여행자와 주민의 만남 장소가 되어 주어요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Voici nos produits locaux.', reading: '브아씨 노 프로뒈 로칼.', gloss: '여기가 우리 지역 상품입니다. (notre)' }),
      Object.freeze({ fr: 'Vous cherchez votre fromage préféré?', reading: '부 셰르셰 보뜨르 프로마주 프레페레?', gloss: '당신의 좋아하는 치즈를 찾고 있어요? (votre)' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-28', name: '호텔 안내 데스크', nameFr: 'Accueil d\'hôtel', track: 'french',
    chapter: 'a0-06-gender',
    culture: '모나코 항구는 세계적 요트축제의 중심지예요 — 고급 호텔들은 손님들의 도시 탐방과 식사 예약을 도와주는 안내가 일상적인 서비스 문화에요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Le monsieur arrive ce matin.', reading: '르 므스유 아리브 쎄 마탱.', gloss: '그 신사분이 오늘 아침에 도착해요. (le — 남성)' }),
      Object.freeze({ fr: 'La madame demande une réservation pour deux.', reading: '라 마담 드망드 운 레제르바시옹 푸르 되.', gloss: '그 부인이 2명을 위한 예약을 요청해요. (la — 여성)' }),
    ]),
  }),
]);

export function coteDazurDoorById(id) {
  return COTE_DAZUR_DOORS.find((door) => door.id === id) ?? null;
}
