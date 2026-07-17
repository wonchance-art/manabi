// 🚪 런던 영어 문화 도어 6종 (en-01~06) — Claude 소유 콘텐츠. 런던 geo merge 시 tile 배선.
// 공식: ot 시리즈 이식 — 실전 한 장면 + 만능 표현 + 문화 사실 1개(헤지).
// 2축: en 원문 / reading 한글 발음 / gloss. track: 'english' — trackChapterHref 라우팅
// (영어·프랑스어 슬러그 동형이라 track 필드 필수 — cultureDoors.js 참조).

export const LONDON_DOORS = Object.freeze([
  Object.freeze({
    id: 'en-01', name: '튜브 승강장', nameEn: 'Tube platform', track: 'english',
    chapter: 'a1-07-questions-negatives',
    culture: '승강장의 "Mind the gap(틈을 조심하세요)" 안내는 1968년경부터 이어져온 런던 지하철의 상징 문구로 알려져 있어요.',
    lines: Object.freeze([
      Object.freeze({ en: 'Does this train go to King\'s Cross?', reading: '더즈 디스 트레인 고우 투 킹스 크로스?', gloss: '이 열차 킹스크로스 가나요?' }),
      Object.freeze({ en: 'Mind the gap, please.', reading: '마인드 더 갭, 플리즈.', gloss: '틈을 조심하세요.' }),
    ]),
  }),
  Object.freeze({
    id: 'en-02', name: '펍', nameEn: 'Pub', track: 'english',
    chapter: 'a2-04-modals-basic',
    culture: '펍에서는 테이블 서빙 대신 바에 직접 가서 주문하고 그 자리에서 계산하는 게 보통이에요.',
    lines: Object.freeze([
      Object.freeze({ en: 'Could I get a pint of ale, please?', reading: '쿠드 아이 겟 어 파인트 오브 에일, 플리즈?', gloss: '에일 한 파인트 주시겠어요? (could 공손)' }),
      Object.freeze({ en: 'Can I pay by card?', reading: '캔 아이 페이 바이 카드?', gloss: '카드로 계산되나요?' }),
    ]),
  }),
  Object.freeze({
    id: 'en-03', name: '카페', nameEn: 'Café', track: 'english',
    chapter: 'a1-03-articles',
    culture: '주문 끝에 "for here or to go" 대신 "eat in or take away?"라고 묻는 게 영국식이에요.',
    lines: Object.freeze([
      Object.freeze({ en: 'A flat white and the carrot cake, please.', reading: '어 플랫 화이트 앤 더 캐럿 케이크, 플리즈.', gloss: '플랫화이트 하나랑 그 당근케이크 주세요. (a/the 관사)' }),
      Object.freeze({ en: 'Eat in, please.', reading: '잇 인, 플리즈.', gloss: '먹고 갈게요.' }),
    ]),
  }),
  Object.freeze({
    id: 'en-04', name: '버러마켓', nameEn: 'Borough Market', track: 'english',
    chapter: 'a2-03-comparatives',
    culture: '버러마켓은 중세부터 이어진 시장으로 전해져요 — 시식을 권하면 가볍게 받아보세요.',
    lines: Object.freeze([
      Object.freeze({ en: 'Which one is cheaper?', reading: '위치 원 이즈 치퍼?', gloss: '어느 쪽이 더 싸요? (비교급)' }),
      Object.freeze({ en: 'This cheese is better than that one.', reading: '디스 치즈 이즈 베터 댄 댓 원.', gloss: '이 치즈가 저것보다 나아요.' }),
    ]),
  }),
  Object.freeze({
    id: 'en-05', name: '뮤지엄 매표소', nameEn: 'Museum ticket desk', track: 'english',
    chapter: 'a2-08-there-is',
    culture: '런던 국립 박물관·미술관 다수는 상설전 무료 입장이 원칙으로 알려져 있어요 — 특별전만 유료인 곳이 많아요.',
    lines: Object.freeze([
      Object.freeze({ en: 'Is there a student discount?', reading: '이즈 데어 어 스튜던트 디스카운트?', gloss: '학생 할인 있나요? (there is 의문)' }),
      Object.freeze({ en: 'There\'s a free tour at noon.', reading: '데어즈 어 프리 투어 앳 눈.', gloss: '정오에 무료 투어가 있어요.' }),
    ]),
  }),
  Object.freeze({
    id: 'en-06', name: 'B&B 체크인', nameEn: 'B&B check-in', track: 'english',
    chapter: 'a1-01-be-verb',
    culture: 'B&B(Bed and Breakfast)는 아침 식사가 포함된 가정식 숙소 — 호스트와의 아침 대화가 이 숙소 문화의 핵심이에요.',
    lines: Object.freeze([
      Object.freeze({ en: 'Hi, I\'m checking in. My name is Kim.', reading: '하이, 아임 체킹 인. 마이 네임 이즈 킴.', gloss: '체크인하려고요. 이름은 김입니다. (be동사)' }),
      Object.freeze({ en: 'Breakfast is at eight.', reading: '브렉퍼스트 이즈 앳 에이트.', gloss: '아침은 8시예요.' }),
    ]),
  }),
]);

export function londonDoorById(id) {
  return LONDON_DOORS.find((door) => door.id === id) || null;
}
