/**
 * H3 (HSK 3급) HSK 2026 보강 어휘 — 《中文水平考试 HSK 考试大纲》(中外语言交流合作中心, 2025-11 발표 · 2026-07 시행)
 * 词汇大纲의 3급 단어 중 우리 사전에 없던 6개를 채웠어요(ZH-LEVEL-2026-001 ④).
 * 한자·병음은 대강 원문 그대로(설계 정본 docs/design/hsk2026/words.json), 품사는 원문 품사의 첫 갈래,
 * 뜻·예문은 학습용으로 작성 — AI 초안 → 콘텐츠 검사 → 다른 모델 표본 대조.
 */
const themes = {
  themes: [
    {
      name: "HSK3 2026 보강",
      words: [
        { zh: "冰激凌", pinyin: "bīngjīlíng", ko: "아이스크림", pos: "명사", ex: { zh: "夏天我很喜欢吃冰激凌。", pinyin: "Xiàtiān wǒ hěn xǐhuan chī bīngjīlíng.", ko: "여름에 저는 아이스크림 먹는 걸 좋아해요." } },
        { zh: "电子书", pinyin: "diànzǐshū", ko: "전자책", pos: "명사", ex: { zh: "我常常在手机上看电子书。", pinyin: "Wǒ chángcháng zài shǒujī shang kàn diànzǐshū.", ko: "저는 휴대폰으로 전자책을 자주 읽어요." } },
        { zh: "过节", pinyin: "guòjié", ko: "명절을 쇠다, 명절을 보내다", pos: "동사", ex: { zh: "过节的时候，我们全家一起吃饭。", pinyin: "Guòjié de shíhou, wǒmen quánjiā yìqǐ chīfàn.", ko: "명절에는 온 가족이 함께 밥을 먹어요." } },
        { zh: "检票", pinyin: "jiǎnpiào", ko: "검표하다, 개찰하다", pos: "동사", hanja: "검표(檢票) — 한자가 그대로", ex: { zh: "火车快开了，开始检票了。", pinyin: "Huǒchē kuài kāi le, kāishǐ jiǎnpiào le.", ko: "기차가 곧 출발해서 개찰을 시작했어요." } },
        { zh: "四季", pinyin: "sìjì", ko: "사계절", pos: "명사", hanja: "사계(四季) — 한자가 그대로", ex: { zh: "这里四季都很美。", pinyin: "Zhèlǐ sìjì dōu hěn měi.", ko: "이곳은 사계절 내내 아름다워요." } },
        { zh: "小区", pinyin: "xiǎoqū", ko: "(아파트) 단지, 주택 단지", pos: "명사", ex: { zh: "我住的小区很安静。", pinyin: "Wǒ zhù de xiǎoqū hěn ānjìng.", ko: "제가 사는 단지는 아주 조용해요." } },
      ],
    },
  ],
};

export default themes;
