// 🚪 스트라스부르 프랑스어 문화 도어 2종 (fr-23~24) — Claude 소유 콘텐츠. 리옹·보르도·마르세유
// ·파리 도어와 별개 신규 세트(장면·챕터 비중복). 공식: 실전 한 장면 + 만능 표현 + 문화 사실 1개(헤지).
// track: 'french' — trackChapterHref 라우팅. 씬 배선은 strasbourg.js 라운드에서
// — tile 좌표는 geo 확정 후 주입(마르세유 선례).
// 사실·IP 규율: 도서관·자전거·공원은 일반 참조(특정 브랜드·기관명 무표기),
// 스트라스부르의 알자스 목조 건축·운하 경관은 외관·지리만.

export const STRASBOURG_DOORS = Object.freeze([
  Object.freeze({
    id: 'fr-23', name: '구시가 서점', nameFr: 'Librairie de la Grande-Île', track: 'french',
    chapter: 'a2-10-relative-clauses',
    culture: '스트라스부르의 구시가(그랑딜)는 보행자 중심 지구예요 — 운하를 바라보는 책 가게에서 책을 찾으며 도시의 거리를 배워요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Avez-vous des livres qui parlent de l\'histoire locale ?', reading: '아베 부 데 리브르 끼 파를 드 로아스투아르 로칼?', gloss: '지역 역사를 다룬 책이 있으세요? (관계절 qui)' }),
      Object.freeze({ fr: 'Le livre dont j\'ai parlé est celui-là.', reading: '르 리브르 동 제 파를 에 쓸뤼라.', gloss: '제가 말한 책은 저것이에요. (관계대명사 dont)' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-24', name: '유럽 지구 자전거 대여점', nameFr: 'Location de vélos', track: 'french',
    chapter: 'a2-12-instructions',
    culture: '스트라스부르는 자전거 도시로 알려져 있어요 — 이을 공원과 운하변을 따라 자전거 도로가 이어져 있어요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Je voudrais louer un vélo pour la journée.', reading: '즈 부드레 루에 운 벨로 푸르 라 주르네.', gloss: '하루 동안 자전거를 대여하고 싶어요.' }),
      Object.freeze({ fr: 'Quelle est la date limite de retour ?', reading: '켈 에 라 다트 리미트 드 르뛰르?', gloss: '반납 기한이 언제죠? (질문·반납 절차)' }),
    ]),
  }),
]);

export function strasbourgDoorById(id) {
  return STRASBOURG_DOORS.find((door) => door.id === id) ?? null;
}
