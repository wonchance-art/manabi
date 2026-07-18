// 🚪 상하이 중국어 문화 도어 3종 (zh-10~12) — Claude 소유 콘텐츠. 타이베이·홍콩 세트와
// 장면·챕터 비중복 신규 세트. 대사는 중국어 트랙 정합(간체+병음).
// track: 'chinese' — trackChapterHref 라우팅.

export const SHANGHAI_DOORS = Object.freeze([
  Object.freeze({
    id: 'zh-10', name: '샤오룽바오 가게', nameZh: '小笼包店', track: 'chinese',
    chapter: 'h1-02-you',
    culture: '샤오룽바오는 얇은 피에 육즙이 담겨 나와요 — 숟가락에 올려 피를 살짝 뚫고 식혀 먹는 게 요령으로 알려져 있어요.',
    lines: Object.freeze([
      Object.freeze({ zh: '有小笼包吗？', pinyin: 'Yǒu xiǎolóngbāo ma?', reading: '유 샤오룽바오 마?', gloss: '샤오룽바오 있나요? (존재 有)' }),
      Object.freeze({ zh: '有，一笼八个。', pinyin: 'Yǒu, yì lóng bā ge.', reading: '유, 이 룽 바 거.', gloss: '있어요, 한 바구니에 여덟 개예요.' }),
    ]),
  }),
  Object.freeze({
    id: 'zh-11', name: '강변 산책로', nameZh: '滨江步道', track: 'chinese',
    chapter: 'h2-03-zai-progressive',
    culture: '와이탄 강변은 하루 두 번 붐벼요 — 이른 아침엔 태극권을 하는 사람들, 밤엔 루자쭈이 야경을 보러 온 인파로요.',
    lines: Object.freeze([
      Object.freeze({ zh: '我在看夜景。', pinyin: 'Wǒ zài kàn yèjǐng.', reading: '워 짜이 칸 예징.', gloss: '야경을 보고 있어요. (진행 在)' }),
      Object.freeze({ zh: '你在拍照吗？', pinyin: 'Nǐ zài pāizhào ma?', reading: '니 짜이 파이자오 마?', gloss: '사진 찍고 있어요?' }),
    ]),
  }),
  Object.freeze({
    id: 'zh-12', name: '기념품 가게', nameZh: '纪念品店', track: 'chinese',
    chapter: 'h1-07-de-possessive',
    culture: '톈쯔팡 골목 가게들엔 옛 스쿠먼 주택의 문패와 우편함이 그대로 남아 있어요 — 사는 물건보다 골목 구경이 절반이에요.',
    lines: Object.freeze([
      Object.freeze({ zh: '这是我朋友的礼物。', pinyin: 'Zhè shì wǒ péngyou de lǐwù.', reading: '저 스 워 펑유 더 리우.', gloss: '이건 제 친구의 선물이에요. (소유 的)' }),
      Object.freeze({ zh: '这个是手工的。', pinyin: 'Zhège shì shǒugōng de.', reading: '저거 스 서우궁 더.', gloss: '이건 수공예예요.' }),
    ]),
  }),
]);

export function shanghaiDoorById(id) {
  return SHANGHAI_DOORS.find((door) => door.id === id) || null;
}
