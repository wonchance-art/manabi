// 🚪 시드니 영어 문화 도어 6종 (en-07~12) — Claude 소유 콘텐츠. 런던 en-01~06과 별개의
// 신규 세트(장면·챕터 비중복 — 1호 도시 단일 탑재 원칙은 '동일 도어 재사용 금지'이며 신규 세트는 무관).
// 공식: 실전 한 장면 + 만능 표현 + 문화 사실 1개(헤지). track: 'english' — trackChapterHref 라우팅.

export const SYDNEY_DOORS = Object.freeze([
  Object.freeze({
    id: 'en-07', name: '페리 매표소', nameEn: 'Ferry wharf', track: 'english',
    chapter: 'a2-02-future',
    culture: '시드니 하버 페리는 대중교통 요금으로 항구를 가로지르는 뱃길이라 여행자에게 크루즈 대신으로 사랑받는 것으로 알려져 있어요.',
    lines: Object.freeze([
      Object.freeze({ en: 'I\'m going to take the ferry to Manly.', reading: '아임 고잉 투 테이크 더 페리 투 맨리.', gloss: '맨리행 페리를 탈 거예요. (be going to 미래)' }),
      Object.freeze({ en: 'The next ferry leaves at ten.', reading: '더 넥스트 페리 리브즈 앳 텐.', gloss: '다음 배는 10시에 떠나요.' }),
    ]),
  }),
  Object.freeze({
    id: 'en-08', name: '서프보드 렌탈', nameEn: 'Surfboard rental', track: 'english',
    chapter: 'a2-06-infinitive-gerund',
    culture: '본다이에선 빨간·노란 깃발 사이에서 수영하는 것이 안전 수칙으로 알려져 있어요 — 깃발 밖은 서퍼들의 구역이에요.',
    lines: Object.freeze([
      Object.freeze({ en: 'I\'d like to rent a board for two hours.', reading: '아이드 라이크 투 렌트 어 보드 포 투 아워즈.', gloss: '보드를 두 시간 빌리고 싶어요. (to부정사)' }),
      Object.freeze({ en: 'Do you enjoy surfing?', reading: '두 유 인조이 서핑?', gloss: '서핑 즐기세요? (동명사)' }),
    ]),
  }),
  Object.freeze({
    id: 'en-09', name: '브런치 카페', nameEn: 'Brunch café', track: 'english',
    chapter: 'a1-02-present-simple',
    culture: '플랫화이트는 호주·뉴질랜드에서 시작된 것으로 전해지는 커피예요 — 시드니 카페 문화의 자부심이죠.',
    lines: Object.freeze([
      Object.freeze({ en: 'Do you have oat milk?', reading: '두 유 해브 오트 밀크?', gloss: '귀리 우유 있나요? (일반동사 현재)' }),
      Object.freeze({ en: 'The kitchen closes at three.', reading: '더 키친 클로지즈 앳 쓰리.', gloss: '주방은 3시에 닫아요. (3인칭 단수 -s)' }),
    ]),
  }),
  Object.freeze({
    id: 'en-10', name: '주말 마켓', nameEn: 'Weekend markets', track: 'english',
    chapter: 'a1-04-plural-countable',
    culture: '패딩턴 주말 마켓은 수공예·빈티지 노점으로 알려져 있어요 — 값을 깎기보다 시식과 대화를 즐기는 분위기예요.',
    lines: Object.freeze([
      Object.freeze({ en: 'How much are these peaches?', reading: '하우 머치 아 디즈 피치즈?', gloss: '이 복숭아들 얼마예요? (복수형)' }),
      Object.freeze({ en: 'Three apples and some grapes, please.', reading: '쓰리 애플즈 앤 섬 그레입스, 플리즈.', gloss: '사과 세 개랑 포도 좀 주세요. (가산·불가산)' }),
    ]),
  }),
  Object.freeze({
    id: 'en-11', name: '호스텔 라운지', nameEn: 'Hostel lounge', track: 'english',
    chapter: 'a2-01-past-simple',
    culture: '록스의 골목엔 배낭여행자 숙소가 많아요 — 라운지에서 하루 여행담을 나누는 것이 호스텔 문화의 핵심이에요.',
    lines: Object.freeze([
      Object.freeze({ en: 'Where did you go today?', reading: '웨어 디드 유 고 투데이?', gloss: '오늘 어디 갔었어요? (과거 의문)' }),
      Object.freeze({ en: 'I visited Bondi and watched the sunset.', reading: '아이 비지티드 본다이 앤 와치트 더 선셋.', gloss: '본다이에 갔다가 노을을 봤어요. (과거형)' }),
    ]),
  }),
  Object.freeze({
    id: 'en-12', name: '절벽 전망대', nameEn: 'Clifftop lookout', track: 'english',
    chapter: 'a1-08-prepositions-basic',
    culture: '왓슨스베이의 갭(The Gap)은 태평양이 처음 열리는 절벽 전망대예요 — 펜스 안쪽 산책로에서만 조망하는 게 수칙이에요.',
    lines: Object.freeze([
      Object.freeze({ en: 'The lighthouse is next to the cliff.', reading: '더 라이트하우스 이즈 넥스트 투 더 클리프.', gloss: '등대는 절벽 옆에 있어요. (전치사)' }),
      Object.freeze({ en: 'Look at the waves below us.', reading: '룩 앳 더 웨이브즈 빌로우 어스.', gloss: '우리 아래 파도를 보세요.' }),
    ]),
  }),
]);

export function sydneyDoorById(id) {
  return SYDNEY_DOORS.find((door) => door.id === id) || null;
}
