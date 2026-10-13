/**
 * H3 (HSK 3급) HSK 2026 보강 어휘 — 《HSK 考试大纲》(2025-11 发布 · 2026-07 实施) 词汇大纲 3급 단어 중
 * 우리 사전에 없던 6개를 채웠어요(ZH-LEVEL-2026-001 ④). 표제어·병음은 2026 원문 그대로
 * (docs/design/hsk2026/words.json), 뜻·품사·예문은 학습용으로 작성.
 */
const themes = {
  themes: [
    {
      name: "HSK3 2026 보강",
      words: [
        { zh: "冰激凌", pinyin: "bīngjīlíng", ko: "아이스크림", pos: "명사", ex: { zh: "夏天我常常吃冰激凌。", pinyin: "Xiàtiān wǒ chángcháng chī bīngjīlíng.", ko: "여름에 저는 자주 아이스크림을 먹어요." } },
        { zh: "电子书", pinyin: "diànzǐshū", ko: "전자책", pos: "명사", ex: { zh: "我在手机上看电子书。", pinyin: "Wǒ zài shǒujī shàng kàn diànzǐshū.", ko: "저는 휴대폰으로 전자책을 읽어요." } },
        { zh: "过节", pinyin: "guòjié", ko: "명절을 쇠다, 명절을 보내다", pos: "동사", ex: { zh: "过节的时候，我们全家一起吃饭。", pinyin: "Guòjié de shíhou, wǒmen quánjiā yìqǐ chīfàn.", ko: "명절에는 우리 가족이 다 함께 밥을 먹어요." } },
        { zh: "检票", pinyin: "jiǎnpiào", ko: "개찰하다, 표를 검사하다", pos: "동사", ex: { zh: "火车快开了，大家排队检票吧。", pinyin: "Huǒchē kuài kāi le, dàjiā páiduì jiǎnpiào ba.", ko: "기차가 곧 출발하니 모두 줄을 서서 개찰해요." } },
        { zh: "四季", pinyin: "sìjì", ko: "사계절, 네 계절", pos: "명사", ex: { zh: "这里四季都很美。", pinyin: "Zhèlǐ sìjì dōu hěn měi.", ko: "이곳은 사계절 내내 아름다워요." } },
        { zh: "小区", pinyin: "xiǎoqū", ko: "(아파트) 단지, 주택 단지", pos: "명사", ex: { zh: "我家的小区里有一个小公园。", pinyin: "Wǒjiā de xiǎoqū lǐ yǒu yí ge xiǎo gōngyuán.", ko: "우리 아파트 단지 안에 작은 공원이 있어요." } },
      ],
    },
  ],
};

export default themes;
