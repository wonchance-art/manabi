// 🚪 중국어 문화 도어 6종 (zh-01~06) — Claude 소유 콘텐츠. 도시 중립 저작(타이베이·홍콩·
// 상하이·베이징 공용 문법) — 도시별 tile 배선은 각 도시 파일에서 후속.
// 공식: 실전 한 장면 + 만능 표현 + 문화 사실 1개(헤지). 대사 표기는 중국어 트랙 정합(간체+병음),
// 한글 발음 reading / gloss 2축. track: 'chinese' — trackChapterHref 라우팅
// (ot-XX 슬러그가 일본어 트랙과 동형이라 track 필드 필수 — cultureDoors.js 참조).

export const ZH_DOORS = Object.freeze([
  Object.freeze({
    id: 'zh-01', name: '찻집', nameZh: '茶馆', track: 'chinese',
    chapter: 'h1-04-measure-words',
    culture: '찻집에서 주전자 뚜껑을 비스듬히 걸쳐 두면 물을 더 부어 달라는 신호로 통하는 곳이 많다고 알려져 있어요.',
    lines: Object.freeze([
      Object.freeze({ zh: '我要一壶茶。', pinyin: 'Wǒ yào yī hú chá.', reading: '워 야오 이 후 차.', gloss: '차 한 주전자 주세요. (양사 壶)' }),
      Object.freeze({ zh: '两杯乌龙茶。', pinyin: 'Liǎng bēi wūlóngchá.', reading: '량 베이 우룽차.', gloss: '우롱차 두 잔이요. (양사 杯)' }),
    ]),
  }),
  Object.freeze({
    id: 'zh-02', name: '야시장 노점', nameZh: '夜市摊子', track: 'chinese',
    chapter: 'h1-10-numbers',
    culture: '야시장에선 값을 물으면 계산기나 손가락으로 숫자를 보여주는 상인이 많아요 — 숫자만 알아도 흥정이 시작돼요.',
    lines: Object.freeze([
      Object.freeze({ zh: '多少钱？', pinyin: 'Duōshao qián?', reading: '둬사오 첸?', gloss: '얼마예요?' }),
      Object.freeze({ zh: '十五块。', pinyin: 'Shíwǔ kuài.', reading: '스우 콰이.', gloss: '15콰이예요. (구어 화폐 단위 块)' }),
    ]),
  }),
  Object.freeze({
    id: 'zh-03', name: '지하철 매표기', nameZh: '地铁售票机', track: 'chinese',
    chapter: 'h1-09-time-place',
    culture: '중국어권 지하철은 도시에 따라 개찰 전 보안 검색대를 지나는 곳도 있어요 — 가방을 벨트에 올리면 돼요.',
    lines: Object.freeze([
      Object.freeze({ zh: '地铁站在哪儿？', pinyin: 'Dìtiě zhàn zài nǎr?', reading: '디톄 잔 짜이 나얼?', gloss: '지하철역이 어디예요? (在+장소)' }),
      Object.freeze({ zh: '在前面。', pinyin: 'Zài qiánmiàn.', reading: '짜이 첸몐.', gloss: '앞쪽에 있어요.' }),
    ]),
  }),
  Object.freeze({
    id: 'zh-04', name: '사원 향로', nameZh: '寺庙香炉', track: 'chinese',
    chapter: 'h2-02-guo-experience',
    culture: '향은 세 개를 함께 올리는 것이 관례로 알려져 있어요 — 향로 앞에서는 천천히, 조용히.',
    lines: Object.freeze([
      Object.freeze({ zh: '我来过这儿。', pinyin: 'Wǒ láiguo zhèr.', reading: '워 라이궈 절.', gloss: '여기 와 본 적 있어요. (경험 过)' }),
      Object.freeze({ zh: '你去过庙会吗？', pinyin: 'Nǐ qùguo miàohuì ma?', reading: '니 취궈 먀오후이 마?', gloss: '묘회(사원 축제)에 가 본 적 있어요?' }),
    ]),
  }),
  Object.freeze({
    id: 'zh-05', name: '식당', nameZh: '饭馆', track: 'chinese',
    chapter: 'h2-01-le-completion',
    culture: '식당에선 차를 먼저 내주는 곳이 많고, 계산은 자리에서 "마이단(买单)"이라고 부르는 게 보통이에요.',
    lines: Object.freeze([
      Object.freeze({ zh: '我点了两个菜。', pinyin: 'Wǒ diǎnle liǎng ge cài.', reading: '워 뎬러 량 거 차이.', gloss: '요리 두 개 시켰어요. (완료 了)' }),
      Object.freeze({ zh: '吃完了，买单！', pinyin: 'Chīwán le, mǎidān!', reading: '츠완 러, 마이단!', gloss: '다 먹었어요, 계산이요!' }),
    ]),
  }),
  Object.freeze({
    id: 'zh-06', name: '시장 골목', nameZh: '市场小巷', track: 'chinese',
    chapter: 'h2-05-comparison-bi',
    culture: '같은 골목에서도 가게마다 값이 달라요 — 비교 표현 하나면 두 집을 저울질할 수 있어요.',
    lines: Object.freeze([
      Object.freeze({ zh: '这个比那个便宜。', pinyin: 'Zhège bǐ nàge piányi.', reading: '저거 비 나거 폔이.', gloss: '이게 저것보다 싸요. (比 비교)' }),
      Object.freeze({ zh: '有没有更大的？', pinyin: 'Yǒu méiyǒu gèng dà de?', reading: '유 메이유 겅 다 더?', gloss: '더 큰 거 있어요?' }),
    ]),
  }),
]);

export function zhDoorById(id) {
  return ZH_DOORS.find((door) => door.id === id) || null;
}
