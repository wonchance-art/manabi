/**
 * H1 (HSK 1급) HSK 2026 보강 어휘 — 《HSK 考试大纲》(2025-11 发布 · 2026-07 实施) 词汇大纲 1급 단어 중
 * 우리 사전에 없던 5개를 채웠어요(ZH-LEVEL-2026-001 ④). 표제어·병음은 2026 원문 그대로
 * (docs/design/hsk2026/words.json), 뜻·품사·예문은 학습용으로 작성.
 */
const themes = {
  themes: [
    {
      name: "HSK1 2026 보강",
      words: [
        { zh: "没事", pinyin: "méishì", ko: "괜찮다, 별일 없다; 일이 없다(한가하다)", pos: "동사", ex: { zh: "我没事，你别担心。", pinyin: "Wǒ méishì, nǐ bié dānxīn.", ko: "저는 괜찮아요, 걱정하지 마세요." } },
        { zh: "哪个", pinyin: "nǎge", ko: "어느 (것), 어떤 (것)", pos: "대명사", ex: { zh: "这两件衣服，你喜欢哪个？", pinyin: "Zhè liǎng jiàn yīfu, nǐ xǐhuan nǎge?", ko: "이 옷 두 벌 중에서 어느 것이 좋아요?" } },
        { zh: "那个", pinyin: "nàge", ko: "그것, 저것; 그, 저", pos: "대명사", ex: { zh: "那个人是我的老师。", pinyin: "Nàge rén shì wǒ de lǎoshī.", ko: "저 사람은 제 선생님이에요." } },
        { zh: "一下", pinyin: "yíxià", ko: "좀 ~하다(동작을 가볍게·짧게); 잠깐", pos: "수량사", ex: { zh: "请等一下。", pinyin: "Qǐng děng yíxià.", ko: "잠깐만 기다려 주세요." } },
        { zh: "这个", pinyin: "zhège", ko: "이것; 이", pos: "대명사", ex: { zh: "这个苹果很好吃。", pinyin: "Zhège píngguǒ hěn hǎochī.", ko: "이 사과는 맛있어요." } },
      ],
    },
  ],
};

export default themes;
