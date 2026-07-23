// 🚪 리옹 프랑스어 문화 도어 2종 (fr-19~20) — Claude 소유 콘텐츠. 마르세유·파리 도어와 별개
// 신규 세트(장면·챕터 비중복). 공식: 실전 한 장면 + 만능 표현 + 문화 사실 1개(헤지).
// track: 'french' — trackChapterHref 라우팅. 씬 배선은 lyon.js 라운드에서
// — tile 좌표는 geo 확정 후 주입(마르세유 선례).
// 사실·IP 규율: 식재료·식사 문화는 일반 참조(특정 상호·브랜드 무표기),
// 리옹 미식 전통은 도시 정체성 건축·문화 외관만.

export const LYON_DOORS = Object.freeze([
  Object.freeze({
    id: 'fr-19', name: '레알 식료품 시장', nameFr: 'Marché de produits frais', track: 'french',
    chapter: 'a2-02-articles',
    culture: '리옹은 미식 도시로 알려져 있어요 — 레알 지구의 시장에서는 신선한 채소·치즈·육류가 가득해요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Je prends une livre de fromage, s\'il vous plaît.', reading: '즈 프랑 윤 리브르 드 프로마주, 실 부 플레.', gloss: '치즈를 반 킬로 주세요. (수량 표현)' }),
      Object.freeze({ fr: 'Combien coûte la douzaine d\'oeufs ?', reading: '콩비앵 쿠트 라 두젠 도에프?', gloss: '계란 한 다스는 얼마예요? (계산·기수)' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-20', name: '프레스킬 노천 카페', nameFr: 'Café en terrasse', track: 'french',
    chapter: 'a2-03-descriptive-adjectives',
    culture: '리옹의 카페는 반도 광장과 강변에 많이 있어요 — 커피를 마시며 도시의 풍경을 즐기는 것이 전통이에요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Je voudrais un café crème, s\'il vous plaît.', reading: '즈 부드레 운 카페 크렘, 실 부 플레.', gloss: '크림 넣은 커피를 주세요. (정중한 요청)' }),
      Object.freeze({ fr: 'La terrasse est très ensoleillée.', reading: '라 떼라스 에 트레 앙솔레유.', gloss: '테라스에 햇빛이 많이 들어요. (형용사)' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-31', name: '실크 아틀리에', nameFr: 'Atelier de soie', track: 'french',
    chapter: 'a2-04-occupations',
    culture: '리옹은 비단 직물의 도시예요 — 크루아루스 언덕의 공방에서 수백 년 전부터 아름다운 비단이 만들어져요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Quel est votre métier ?', reading: '켈 에 보트르 메티에?', gloss: '당신의 직업이 뭐예요? (직업 묻기)' }),
      Object.freeze({ fr: 'Je suis tisserand de soie.', reading: '즈 수이 티세랑 드 쇠아.', gloss: '저는 비단 직공이에요. (직업 소개)' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-32', name: '부숑 식당', nameFr: 'Bouchon lyonnais', track: 'french',
    chapter: 'a2-05-dining',
    culture: '부숑은 리옹의 전통 식당이에요 — 소박하고 푸짐한 향토 요리를 대중적인 가격에 맛볼 수 있어요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Qu\'est-ce que vous nous recommandez ?', reading: '케스크 케 부 누 레코망더?', gloss: '뭘 추천해주세요? (메뉴 조언)' }),
      Object.freeze({ fr: 'C\'est une spécialité de la maison.', reading: '세 튠 스페시알리떼 드 라 메종.', gloss: '이건 이 집 특산이에요. (요리 소개)' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-33', name: '트라불 안뜰 서점', nameFr: 'Librairie dans la traboule', track: 'french',
    chapter: 'a2-06-hobbies',
    culture: '트라불 안의 조용한 서점에서 책을 읽으며 리옹의 역사를 배워요 — 이곳은 비 오는 날 발견의 보물창고예요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Vous aimez lire ?', reading: '부 제메 리르?', gloss: '책 읽는 거 좋아해요? (취미 묻기)' }),
      Object.freeze({ fr: 'J\'aime les livres sur l\'histoire.', reading: '제메 레 리브르 수르 리스투아르.', gloss: '난 역사 책을 좋아해요. (취미 표현)' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-34', name: '인형극 공방', nameFr: 'Atelier de guignol', track: 'french',
    chapter: 'a2-07-arts',
    culture: '인형극은 리옹의 전통 예술이에요 — 어린이 공연으로 시작되어 지금도 거리와 극장에서 펼쳐져요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Aimez-vous le théâtre de marionnettes ?', reading: '에메 부 르 떼아트르 드 마리오네트?', gloss: '인형극을 좋아해요? (예술 취향)' }),
      Object.freeze({ fr: 'C\'est un art très populaire ici.', reading: '세 튠 아르 트레 포퓰레르 이씨.', gloss: '이건 여기서 정말 인기 있는 예술이에요. (문화 설명)' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-35', name: '강변 과자점', nameFr: 'Pâtisserie au bord du Rhône', track: 'french',
    chapter: 'a2-08-sweets',
    culture: '리옹의 과자 중에서 가장 유명한 건 프랄린이에요 — 해질녘 론강변의 과자점에서 이 달콤한 간식을 맛보는 것이 여행자의 즐거움이에요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Donnez-moi trois pralines, s\'il vous plaît.', reading: '도느 무아 트루아 프랄린, 실 부 플레.', gloss: '프랄린 세 개 주세요. (수량·구매)' }),
      Object.freeze({ fr: 'Elles sont délicieuses.', reading: '엘 송 델리시외즈.', gloss: '정말 맛있어요. (맛 표현)' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-36', name: '언덕 전망 카페', nameFr: 'Café de la vue', track: 'french',
    chapter: 'a2-09-landscapes',
    culture: '푸르비에르 언덕의 카페에서 내려다보는 두 강의 풍경은 리옹의 가장 아름다운 장면이에요 — 해질녘의 조명이 강물에 반사되는 모습은 잊을 수 없어요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Quelle belle vue !', reading: '켈 벨 뷔!', gloss: '정말 아름다운 경치네요! (경관 감탄)' }),
      Object.freeze({ fr: 'Le coucher de soleil est magnifique.', reading: '르 쿠셰 드 솔레이 에 마니피크.', gloss: '일몰이 멋져요. (경관 묘사)' }),
    ]),
  }),
]);

export function lyonDoorById(id) {
  return LYON_DOORS.find((door) => door.id === id) ?? null;
}
