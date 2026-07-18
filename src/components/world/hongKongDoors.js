// 🚪 홍콩 중국어 문화 도어 3종 (zh-07~09) — Claude 소유 콘텐츠. 타이베이 zh-01~06과 별개의
// 신규 세트(장면·챕터 비중복). 대사는 중국어 트랙 정합(간체+병음), 광둥어는 문화 각주로만 반영.
// track: 'chinese' — trackChapterHref 라우팅(ot 동형 방어는 cultureDoors.js 계약).

export const HONG_KONG_DOORS = Object.freeze([
  Object.freeze({
    id: 'zh-07', name: '페리 매표소', nameZh: '渡轮售票处', track: 'chinese',
    chapter: 'h2-09-haishi',
    culture: '빅토리아항 도선은 100년 넘게 이어져 온 것으로 전해져요. 홍콩에선 광둥어 인사 \'네이호우\'가 표준중국어 \'니하오\'와 나란히 쓰여요.',
    lines: Object.freeze([
      Object.freeze({ zh: '坐船还是坐地铁？', pinyin: 'Zuò chuán háishi zuò dìtiě?', reading: '쭤 촨 하이스 쭤 디톄?', gloss: '배를 탈까요, 지하철을 탈까요? (선택의문 还是)' }),
      Object.freeze({ zh: '坐船吧，看海景。', pinyin: 'Zuò chuán ba, kàn hǎijǐng.', reading: '쭤 촨 바, 칸 하이징.', gloss: '배 타요, 바다 경치 보게요.' }),
    ]),
  }),
  Object.freeze({
    id: 'zh-08', name: '차찬텡', nameZh: '茶餐厅', track: 'chinese',
    chapter: 'h1-05-ma-questions',
    culture: '차찬텡(茶餐廳)은 홍콩식 퓨전 식당이에요 — 진하게 우린 밀크티와 파인애플빵이 대표 메뉴로 알려져 있어요.',
    lines: Object.freeze([
      Object.freeze({ zh: '有奶茶吗？', pinyin: 'Yǒu nǎichá ma?', reading: '유 나이차 마?', gloss: '밀크티 있나요? (吗 의문문)' }),
      Object.freeze({ zh: '要冻的吗？', pinyin: 'Yào dòng de ma?', reading: '야오 둥 더 마?', gloss: '차가운 걸로 드릴까요?' }),
    ]),
  }),
  Object.freeze({
    id: 'zh-09', name: '트램 정류장', nameZh: '电车站', track: 'chinese',
    chapter: 'h1-12-modal-wishes',
    culture: '홍콩섬의 2층 트램은 종소리를 딴 \'딩딩\'이라는 애칭으로 불려요 — 100년 넘게 달려온 것으로 전해져요.',
    lines: Object.freeze([
      Object.freeze({ zh: '我想坐电车。', pinyin: 'Wǒ xiǎng zuò diànchē.', reading: '워 샹 쭤 뎬처.', gloss: '트램을 타고 싶어요. (소망 想)' }),
      Object.freeze({ zh: '叮叮车来了！', pinyin: 'Dīngdīng chē lái le!', reading: '딩딩 처 라이 러!', gloss: '딩딩 트램이 왔어요!' }),
    ]),
  }),
]);

export function hongKongDoorById(id) {
  return HONG_KONG_DOORS.find((door) => door.id === id) || null;
}
