// 🚪 가와구치코 일본어 문화 도어 4종 (ja-01~04) — Claude 소유 콘텐츠. 일본 4도시 레거시
// ot 도어와 별개의 신규 세트(첫 n5 본편 챕터 세트 — track: 'japanese' 명시, #246 라우트 확장).
// 공식: 실전 한 장면 + 만능 표현 + 문화 사실 1개(헤지). 씬 배선은 kawaguchiko.js 라운드에서 —
// tile 좌표는 geo 확정 후 주입(MSM·마르세유 선례).
// 사실·IP 규율: 료칸·온천·산장·오미야게 전부 일반 참조(상호·브랜드 무언급), 관습은 전승 헤지.

export const KAWAGUCHIKO_DOORS = Object.freeze([
  Object.freeze({
    id: 'ja-01', name: '료칸 체크인', nameJa: '旅館のフロント', track: 'japanese',
    chapter: 'n5-04-desu-da',
    culture: '료칸에서는 저녁에 방에 이부자리를 깔아 주는 것으로 알려져 있어요 — 신발은 현관에서 벗어요.',
    lines: Object.freeze([
      Object.freeze({ ja: '今夜の予約です。', reading: '콘야노 요야쿠데스.', gloss: '오늘 밤 예약이에요. (명사+です)' }),
      Object.freeze({ ja: 'お部屋は二階です。', reading: '오헤야와 니카이데스.', gloss: '방은 2층이에요.' }),
    ]),
  }),
  Object.freeze({
    id: 'ja-02', name: '온천 탈의실', nameJa: '温泉の脱衣所', track: 'japanese',
    chapter: 'n5-08-te-form',
    culture: '온천은 탕에 들어가기 전에 몸을 씻는 것이 예절로 알려져 있어요.',
    lines: Object.freeze([
      Object.freeze({ ja: '入る前に体を洗ってください。', reading: '하이루 마에니 카라다오 아랏테 쿠다사이.', gloss: '들어가기 전에 몸을 씻어 주세요. (て형+ください)' }),
      Object.freeze({ ja: 'タオルは湯に入れないでください。', reading: '타오루와 유니 이레나이데 쿠다사이.', gloss: '수건은 탕에 넣지 말아 주세요. (ないでください)' }),
    ]),
  }),
  Object.freeze({
    id: 'ja-03', name: '산장 예약 창구', nameJa: '山小屋の受付', track: 'japanese',
    chapter: 'n5-07-existence',
    culture: '후지산 산장은 여름 등산철에만 여는 곳이 많은 것으로 알려져 있어요.',
    lines: Object.freeze([
      Object.freeze({ ja: '今夜、空きがありますか。', reading: '콘야, 아키가 아리마스카.', gloss: '오늘 밤 빈자리가 있어요? (존재 あります)' }),
      Object.freeze({ ja: '山小屋に布団があります。', reading: '야마고야니 후톤가 아리마스.', gloss: '산장에 이불이 있어요.' }),
    ]),
  }),
  Object.freeze({
    id: 'ja-04', name: '오미야게 가게', nameJa: 'お土産屋', track: 'japanese',
    chapter: 'n5-10-kosoado',
    culture: '오미야게는 여행지의 과자를 직장·이웃과 나누는 문화로 알려져 있어요.',
    lines: Object.freeze([
      Object.freeze({ ja: 'これをください。', reading: '코레오 쿠다사이.', gloss: '이걸 주세요. (こそあど)' }),
      Object.freeze({ ja: 'その箱はお菓子ですか。', reading: '소노 하코와 오카시데스카.', gloss: '그 상자는 과자예요?' }),
    ]),
  }),
]);

export function kawaguchikoDoorById(id) {
  return KAWAGUCHIKO_DOORS.find((door) => door.id === id) ?? null;
}
