// 🚪 제네바 프랑스어 문화 도어 3종 (fr-13~15) — Claude 소유 콘텐츠. 파리·마르세유 세트와
// 챕터 비중복(a2 잔여 픽). 공식: 실전 한 장면 + 만능 표현 + 문화 사실 1개(헤지).
// track: 'french' — trackChapterHref 라우팅. 사실·IP 규율: 시계·초콜릿·퐁뒤 전부 일반 참조
// (브랜드·상호·인명 무언급), 인증 마크·배합명 미표기.

export const GENEVA_DOORS = Object.freeze([
  Object.freeze({
    id: 'fr-13', name: '시계 공방', nameFr: 'Atelier d\'horlogerie', track: 'french',
    chapter: 'a2-10-relative-qui-que',
    culture: '제네바는 종교개혁기 장식 금지령 속에서 금세공 기술이 시계로 옮겨가며 시계의 도시가 된 것으로 전해져요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Voici l\'atelier qui répare les montres anciennes.', reading: '부아시 라틀리에 키 레파르 레 몽트르 앙시엔.', gloss: '오래된 시계를 고치는 공방이에요. (관계대명사 qui)' }),
      Object.freeze({ fr: 'C\'est la montre que je cherchais.', reading: '세 라 몽트르 크 즈 셰르셰.', gloss: '제가 찾던 그 시계예요. (관계대명사 que)' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-14', name: '퐁뒤 식당', nameFr: 'Restaurant de fondue', track: 'french',
    chapter: 'a2-12-quantity-tout',
    culture: '퐁뒤는 녹인 치즈에 빵을 찍어 먹는 스위스의 국민 요리로 통해요 — 냄비 하나를 모두가 나눠요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Tout le monde partage la même fondue.', reading: '투 르 몽드 파르타주 라 멤 퐁뒤.', gloss: '모두가 같은 퐁뒤를 나눠요. (tout le monde)' }),
      Object.freeze({ fr: 'On mange toute la soirée.', reading: '옹 망주 투트 라 수아레.', gloss: '저녁 내내 먹어요. (toute + 명사)' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-15', name: '초콜릿 가게', nameFr: 'Chocolaterie', track: 'french',
    chapter: 'a2-05-object-pronouns',
    culture: '19세기 스위스에서 밀크초콜릿 제법이 개발된 것으로 전해져요 — 카루주 골목의 작은 공방들이 그 전통을 이어요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Je les offre à ma famille.', reading: '즈 레 조프르 아 마 파미유.', gloss: '가족에게 선물할 거예요. (목적 대명사 les)' }),
      Object.freeze({ fr: 'Vous me le recommandez ?', reading: '부 므 르 르코망데?', gloss: '이거 추천하시는 거예요? (me·le 이중 대명사)' }),
    ]),
  }),
]);

export function genevaDoorById(id) {
  return GENEVA_DOORS.find((door) => door.id === id) ?? null;
}
