// 🚪 마르세유 프랑스어 문화 도어 6종 (fr-07~12) — Claude 소유 콘텐츠. 파리 fr-01~06과
// 별개의 신규 세트(장면·챕터 비중복 — 파리·MSM 사용 챕터와 겹치지 않는 a2 본편 픽).
// 공식: 실전 한 장면 + 만능 표현 + 문화 사실 1개(헤지). track: 'french' — trackChapterHref 라우팅.
// 씬 배선은 marseille.js 라운드에서 — tile 좌표는 geo 확정 후 주입(MSM 선례).
// 사실·IP 규율: 부야베스·마르세유 비누는 일반 참조(특정 상호·헌장 로고 재현 금지),
// 이프성은 소설 무대 통설 헤지, 페리 선사명 미표기(도착지 서술만).

export const MARSEILLE_DOORS = Object.freeze([
  Object.freeze({
    id: 'fr-07', name: '부야베스 식당', nameFr: 'Restaurant de bouillabaisse', track: 'french',
    chapter: 'a2-01-passe-compose-avoir',
    culture: '부야베스는 마르세유 어부들이 팔고 남은 생선으로 끓이던 스튜에서 유래한 것으로 전해져요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'J\'ai réservé une table pour deux.', reading: '제 레제르베 윈 타블 푸르 되.', gloss: '두 명 자리를 예약했어요. (avoir 복합과거)' }),
      Object.freeze({ fr: 'J\'ai goûté la bouillabaisse hier.', reading: '제 구테 라 부야베스 이에르.', gloss: '어제 부야베스를 맛봤어요.' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-08', name: '파니에 비누 공방', nameFr: 'Savonnerie du Panier', track: 'french',
    chapter: 'a2-06-comparative',
    culture: '마르세유 비누는 올리브유로 만드는 전통 제법으로 알려져 있어요 — 파니에 골목에 작은 공방들이 이어져요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Celui-ci est plus doux que celui-là.', reading: '쓸뤼시 에 플뤼 두 크 쓸뤼라.', gloss: '이게 저것보다 순해요. (비교급 plus … que)' }),
      Object.freeze({ fr: 'C\'est le savon le plus connu d\'ici.', reading: '세 르 사봉 르 플뤼 코뉘 디시.', gloss: '여기서 제일 유명한 비누예요. (최상급)' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-09', name: '이프성 페리 매표소', nameFr: 'Embarcadère pour le château d\'If', track: 'french',
    chapter: 'a2-11-time-expressions',
    culture: '이프성은 소설 몬테크리스토 백작의 무대로 알려진 바위섬 요새예요 — 구항에서 배로 건너가요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Le prochain bateau part dans vingt minutes.', reading: '르 프로섕 바토 파르 당 뱅 미뉘트.', gloss: '다음 배는 20분 뒤에 떠나요. (dans + 시간)' }),
      Object.freeze({ fr: 'La traversée dure combien de temps ?', reading: '라 트라베르세 뒤르 콩비앵 드 탕?', gloss: '건너는 데 얼마나 걸려요?' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-10', name: '구항 아침 생선 좌판', nameFr: 'Marché aux poissons', track: 'french',
    chapter: 'a2-09-y-en',
    culture: '구항 부두에서는 아침마다 어부들이 직접 생선을 파는 직판대가 서는 것으로 알려져 있어요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'J\'en prends deux, s\'il vous plaît.', reading: '정 프랑 되, 실 부 플레.', gloss: '그걸로 두 마리 주세요. (대명사 en)' }),
      Object.freeze({ fr: 'Il y en a encore ?', reading: '일 리 앙 나 앙코르?', gloss: '아직 남아 있어요? (y + en)' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-11', name: '본 메르 전망 테라스', nameFr: 'Parvis de la Bonne Mère', track: 'french',
    chapter: 'a2-08-imperatif',
    culture: '언덕 위 성모상은 뱃사람들을 지킨다고 전해져 \'본 메르(좋은 어머니)\'라 불려요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'Regardez la vue sur le port !', reading: '르가르데 라 뷔 쉬르 르 포르!', gloss: '항구 쪽 경치를 보세요! (명령법 vous)' }),
      Object.freeze({ fr: 'Montez doucement, ça grimpe.', reading: '몽테 두스망, 사 그랭프.', gloss: '천천히 올라오세요, 오르막이 가팔라요.' }),
    ]),
  }),
  Object.freeze({
    id: 'fr-12', name: '거리 미술 아틀리에', nameFr: 'Atelier d\'art de rue', track: 'french',
    chapter: 'a2-04-pronominal-verbs',
    culture: '쿠르 쥘리앵의 벽화는 수시로 새로 그려지는 것으로 알려져 있어요 — 골목 전체가 바뀌는 화폭이에요.',
    lines: Object.freeze([
      Object.freeze({ fr: 'On se promène dans les ruelles.', reading: '옹 스 프로멘 당 레 뤼엘.', gloss: '골목을 산책해요. (대명동사 se promener)' }),
      Object.freeze({ fr: 'Je m\'intéresse à l\'art de rue.', reading: '즈 맹테레스 아 라르 드 뤼.', gloss: '거리 미술에 관심이 있어요. (s\'intéresser à)' }),
    ]),
  }),
]);

export function marseilleDoorById(id) {
  return MARSEILLE_DOORS.find((door) => door.id === id) ?? null;
}
