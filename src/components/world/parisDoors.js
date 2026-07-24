// 🚪 그랑파리 프랑스어 문화 도어 6종 (fr-01~06) — Claude 소유 콘텐츠.
// 공식: 일본어 ot 시리즈 이식 — 실전 한 장면 + 만능 표현 + 문화 사실 1개(헤지).
// 2축: fr 원문 / reading 한글 발음(표기 가이드 v1: 리에종 반영·비모음 앙/옹/앵·묵음 제거) / gloss.
// 트랙 정합 감사 2026-07-16 통과 — 도어 표현 전부 기존 프랑스어 트랙(a0~a2)에 존재.
// 배선: 도시 노드 tile 연결은 후속(카페·불랑제리는 무브랜드 파사드 — 상호 재현 금지).

export const PARIS_DOORS = Object.freeze([
  Object.freeze({
    id: 'fr-01', name: '카페 테라스', nameFr: 'Café parisien',
    chapter: 'a1-13-survival',
    culture: '가게에 들어서면 Bonjour 인사가 필수 예절로 여겨져요. 테라스와 카운터의 가격이 다른 집도 있다고 알려져 있어요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Bonjour ! Un café, s\'il vous plaît.', reading: '봉주르! 앙 카페, 실 부 플레.', gloss: '안녕하세요! 커피 한 잔 주세요.' }),
      Object.freeze({ fr: 'L\'addition, s\'il vous plaît.', reading: '라디시옹, 실 부 플레.', gloss: '계산서 주세요.' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-02', name: '불랑제리', nameFr: 'Boulangerie',
    chapter: 'a1-10-numbers-time',
    culture: '\'트라디시옹\'은 전통 제법 바게트를 가리키는 이름으로 통해요 — 일반 바게트와 구분해 주문해 보세요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Une baguette tradition, s\'il vous plaît.', reading: '윈 바게트 트라디시옹, 실 부 플레.', gloss: '트라디시옹 바게트 하나 주세요.' }),
      Object.freeze({ fr: 'Deux croissants, c\'est tout.', reading: '되 크루아상, 세 투.', gloss: '크루아상 두 개요, 그게 다예요.' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-03', name: '메트로 승강장', nameFr: 'Station de métro',
    chapter: 'a1-05-questions',
    culture: 'Sortie는 출구, Correspondance는 환승 표지예요 — 이 두 단어만 알면 파리 지하철에서 길을 잃지 않아요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'C\'est bien la direction La Défense ?', reading: '세 비앵 라 디렉시옹 라 데팡스?', gloss: '라데팡스 방향 맞나요?' }),
      Object.freeze({ fr: 'Où est la sortie ?', reading: '우 에 라 소르티?', gloss: '출구가 어디예요?' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-04', name: '마르셰(시장)', nameFr: 'Marché',
    chapter: 'a1-12-articles',
    culture: '시장 상인이 맛보기를 권하면 "Oui, volontiers(네, 기꺼이요)"로 받는 게 자연스러워요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Je voudrais du fromage, s\'il vous plaît.', reading: '즈 부드레 뒤 프로마주, 실 부 플레.', gloss: '치즈 좀 주세요. (부분관사 du)' }),
      Object.freeze({ fr: 'C\'est combien ?', reading: '세 콩비앵?', gloss: '얼마예요?' }),
      Object.freeze({ fr: 'Oui, volontiers !', reading: '위, 볼롱티에!', gloss: '네, 기꺼이요! (맛보기 응답)' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-05', name: '미술관 매표소', nameFr: 'Billetterie du musée',
    chapter: 'a1-02-avoir',
    culture: '파리의 큰 미술관들은 요일·연령별 할인과 무료 입장일을 운영하는 곳이 많다고 알려져 있어요 — 매표소에서 물어보세요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Deux billets, s\'il vous plaît.', reading: '되 비예, 실 부 플레.', gloss: '표 두 장 주세요.' }),
      Object.freeze({ fr: 'Vous avez un tarif étudiant ?', reading: '부자베 앙 타리프 에튀디앙?', gloss: '학생 할인 있나요? (avoir·리에종 vous‿avez)' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-06', name: '호텔 체크인', nameFr: 'Réception de l\'hôtel',
    chapter: 'a0-02-alphabet',
    culture: '예약 확인 때 이름 철자를 프랑스식 알파벳 이름으로 불러줄 일이 많아요 — g(제)와 j(지)가 뒤바뀐 듯 들리니 주의!',
    lines: Object.freeze([
      Object.freeze({ fr: 'Bonsoir, j\'ai une réservation.', reading: '봉수아르, 제 윈 레제르바시옹.', gloss: '안녕하세요(저녁), 예약했어요.' }),
      Object.freeze({ fr: 'Ça s\'écrit K-I-M.', reading: '사 세크리 카-이-엠.', gloss: '철자는 K, I, M이에요.' }),
    ]),
  }),
]);

export function parisDoorById(id) {
  return PARIS_DOORS.find((door) => door.id === id) || null;
}
