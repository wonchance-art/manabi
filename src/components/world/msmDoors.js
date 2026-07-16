// 🚪 몽생미셸 프랑스어 문화 도어 6종 (msm-01~06) — Claude 소유 콘텐츠.
// 각 도어 = 현장 대화 스니펫(2축: fr 원문/reading 한글 발음/gloss 뜻) + 실챕터 링크(chapter =
// 프랑스어 트랙 슬러그, cultureDoors.frenchChapterHref 로 라우팅). 씬 배선(#155)의
// mont-saint-michel 도시 노드가 이 목록을 소비한다 — tile 좌표는 배선 시 geo 기준으로 확정.
// 사실·IP 규율: 오믈렛은 명물 일반 참조(특정 상호 재현 금지), 순례 전승은 헤지.

export const MSM_DOORS = Object.freeze([
  Object.freeze({
    id: 'msm-01', name: '수도원 매표소', nameFr: 'Billetterie de l\'abbaye',
    chapter: 'a1-10-numbers-time',
    lines: Object.freeze([
      Object.freeze({ fr: 'Un billet, s\'il vous plaît.', reading: '엉 비예, 실 부 플레.', gloss: '표 한 장 주세요.' }),
      Object.freeze({ fr: 'C\'est ouvert jusqu\'à quelle heure ?', reading: '세 우베르 쥐스카 켈 뢰르?', gloss: '몇 시까지 열어요?' }),
    ]),
  }),
  Object.freeze({
    id: 'msm-02', name: '그랑드뤼 기념품점', nameFr: 'Boutique de souvenirs',
    chapter: 'a1-05-questions',
    lines: Object.freeze([
      Object.freeze({ fr: 'C\'est combien ?', reading: '세 콩비앵?', gloss: '얼마예요?' }),
      Object.freeze({ fr: 'Je regarde seulement, merci.', reading: '즈 르가르드 쇨망, 메르시.', gloss: '그냥 구경만 할게요, 감사해요.' }),
    ]),
  }),
  Object.freeze({
    id: 'msm-03', name: '오믈렛 레스토랑', nameFr: 'Restaurant d\'omelettes',
    chapter: 'a1-09-partitive',
    lines: Object.freeze([
      Object.freeze({ fr: 'Je voudrais de l\'omelette, s\'il vous plaît.', reading: '즈 부드레 드 로믈레트, 실 부 플레.', gloss: '오믈렛 주세요. (부분관사 de l\')' }),
      Object.freeze({ fr: 'C\'est la spécialité de l\'île.', reading: '세 라 스페시알리테 드 릴.', gloss: '이 섬의 명물이에요.' }),
    ]),
  }),
  Object.freeze({
    id: 'msm-04', name: '성벽 전망 포인트', nameFr: 'Point de vue des remparts',
    chapter: 'a1-06-adjectives',
    lines: Object.freeze([
      Object.freeze({ fr: 'Quelle vue magnifique !', reading: '켈 뷔 마니피크!', gloss: '정말 멋진 경치네요!' }),
      Object.freeze({ fr: 'La marée monte.', reading: '라 마레 몽트.', gloss: '밀물이 들어와요.' }),
    ]),
  }),
  Object.freeze({
    id: 'msm-05', name: '셔틀 정류장', nameFr: 'Arrêt de la navette',
    chapter: 'a1-08-aller-venir',
    lines: Object.freeze([
      Object.freeze({ fr: 'La navette va au Mont.', reading: '라 나베트 바 오 몽.', gloss: '셔틀이 몽(섬)으로 가요. (aller)' }),
      Object.freeze({ fr: 'Le prochain part à quelle heure ?', reading: '르 프로섕 파르 아 켈 뢰르?', gloss: '다음 편은 몇 시에 떠나요?' }),
    ]),
  }),
  Object.freeze({
    id: 'msm-06', name: '순례자 쉼터', nameFr: 'Halte des pèlerins',
    chapter: 'a1-01-pronouns-etre',
    lines: Object.freeze([
      Object.freeze({ fr: 'Je suis pèlerin.', reading: '즈 쉬 펠르랭.', gloss: '저는 순례자예요. (être)' }),
      Object.freeze({ fr: 'Nous sommes loin de Paris.', reading: '누 솜 루앵 드 파리.', gloss: '우리는 파리에서 멀리 있어요.' }),
    ]),
  }),
]);

export function msmDoorById(id) {
  return MSM_DOORS.find((door) => door.id === id) || null;
}
