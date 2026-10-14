/**
 * H1 (HSK 1급) HSK 2026 보강 어휘 — 《中文水平考试 HSK 考试大纲》(中外语言交流合作中心, 2025-11 발표 · 2026-07 시행)
 * 词汇大纲의 1급 단어 중 우리 사전에 없던 5개를 채웠어요(ZH-LEVEL-2026-001 ④).
 * 한자·병음은 대강 원문 그대로(설계 정본 docs/design/hsk2026/words.json), 품사는 원문 품사의 첫 갈래,
 * 뜻·예문은 학습용으로 작성 — AI 초안 → 콘텐츠 검사 → 다른 모델 표본 대조.
 */
const themes = {
  themes: [
    {
      name: "HSK1 2026 보강",
      words: [
        { zh: "没事", pinyin: "méishì", ko: "괜찮다, 별일 없다; 할 일이 없다", pos: "동사", ex: { zh: "我没事，你别担心。", pinyin: "Wǒ méishì, nǐ bié dānxīn.", ko: "저는 괜찮아요, 걱정하지 마세요." } },
        { zh: "哪个", pinyin: "nǎge", ko: "어느, 어느 것", pos: "대명사", ex: { zh: "你喜欢哪个颜色？", pinyin: "Nǐ xǐhuan nǎge yánsè?", ko: "어느 색을 좋아해요?" } },
        { zh: "那个", pinyin: "nàge", ko: "그, 저; 그것, 저것", pos: "대명사", ex: { zh: "那个人是我的老师。", pinyin: "Nàge rén shì wǒ de lǎoshī.", ko: "저 사람은 제 선생님이에요." } },
        { zh: "一下", pinyin: "yíxià", ko: "좀 ~해 보다, 한번; 잠깐", pos: "수량사", ex: { zh: "请你在这儿等一下。", pinyin: "Qǐng nǐ zài zhèr děng yíxià.", ko: "여기서 잠깐 기다려 주세요." } },
        { zh: "这个", pinyin: "zhège", ko: "이; 이것", pos: "대명사", ex: { zh: "这个苹果很好吃。", pinyin: "Zhège píngguǒ hěn hǎochī.", ko: "이 사과는 아주 맛있어요." } },
      ],
    },
  ],
};

export default themes;
