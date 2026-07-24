/**
 * H1 (HSK 1급) 보강 어휘 — 표준 HSK1 어휘 중 기존 h1.js에 빠진 항목을 채우는 보강 세트.
 * 숫자·동사·명사·대명사/의문사·기능어(조사·접속사) 네 갈래로 묶었어요.
 */
const themes = {
  themes: [
    {
      name: "HSK1 보강 — 숫자",
      icon: "🟦",
      words: [
        { zh: "四", pinyin: "sì", ko: "넷, 4", pos: "수사", hanja: "사(四) — '넉 사'.", ex: { zh: "我有四本书。", pinyin: "wǒ yǒu sì běn shū", ko: "저는 책이 네 권 있어요." } },
        { zh: "六", pinyin: "liù", ko: "여섯, 6", pos: "수사", hanja: "육(六) — '여섯 육'.", ex: { zh: "现在六点。", pinyin: "xiànzài liù diǎn", ko: "지금 6시예요." } },
        { zh: "七", pinyin: "qī", ko: "일곱, 7", pos: "수사", hanja: "칠(七) — '일곱 칠'.", ex: { zh: "一个星期有七天。", pinyin: "yí ge xīngqī yǒu qī tiān", ko: "일주일은 7일이에요." } },
        { zh: "八", pinyin: "bā", ko: "여덟, 8", pos: "수사", hanja: "팔(八) — '여덟 팔'.", ex: { zh: "他八岁。", pinyin: "tā bā suì", ko: "그는 여덟 살이에요." } },
        { zh: "九", pinyin: "jiǔ", ko: "아홉, 9", pos: "수사", hanja: "구(九) — '아홉 구'.", ex: { zh: "现在九点。", pinyin: "xiànzài jiǔ diǎn", ko: "지금 9시예요." } },
        { zh: "零", pinyin: "líng", ko: "영, 0", pos: "수사", hanja: "령(零) — '떨어질 령', 숫자 0.", ex: { zh: "二零二五年。", pinyin: "èr líng èr wǔ nián", ko: "2025년이에요." } },
        { zh: "几", pinyin: "jǐ", ko: "몇 (수를 물음)", pos: "수사", ex: { zh: "你家有几个人？", pinyin: "nǐ jiā yǒu jǐ ge rén", ko: "가족이 몇 명이에요?" } },
        { zh: "多少", pinyin: "duōshǎo", ko: "얼마, 몇 (큰 수를 물음)", pos: "대명사", hanja: "다소(多少) — '많을 다 + 적을 소', 글자 그대로 '얼마'예요.", ex: { zh: "这个多少钱？", pinyin: "zhège duō shǎo qián", ko: "이거 얼마예요?" } },
      ],
    },
    {
      name: "HSK1 보강 — 동사·표현",
      icon: "🟦",
      words: [
        { zh: "会", pinyin: "huì", ko: "(배워서) ~할 줄 알다, ~할 것이다", pos: "동사", hanja: "회(會) — '모일 회'. 능력·가능성을 나타내요.", ex: { zh: "我会说汉语。", pinyin: "wǒ huì shuō Hànyǔ", ko: "저는 중국어를 할 줄 알아요." } },
        { zh: "能", pinyin: "néng", ko: "(조건·상황상) ~할 수 있다", pos: "동사", hanja: "능(能) — '능할 능'.", ex: { zh: "你能来吗？", pinyin: "nǐ néng lái ma", ko: "올 수 있어요?" } },
        { zh: "请", pinyin: "qǐng", ko: "청하다, 부탁하다; ~해 주세요", pos: "동사", hanja: "청(請) — '청할 청'. 정중한 부탁의 '~해 주세요'.", ex: { zh: "请坐。", pinyin: "qǐng zuò", ko: "앉으세요." } },
        { zh: "没关系", pinyin: "méiguānxi", ko: "괜찮아요, 상관없어요", pos: "표현", hanja: "관계(關係) — '관계없다', 즉 괜찮아요.", ex: { zh: "没关系，别担心。", pinyin: "méi guān xi, bié dān xīn", ko: "괜찮아요, 걱정 마세요." } },
        { zh: "喂", pinyin: "wéi", ko: "여보세요 (전화)", pos: "감탄사", ex: { zh: "喂，你好！", pinyin: "wéi, nǐ hǎo", ko: "여보세요, 안녕하세요!" } },
      ],
    },
    {
      name: "HSK1 보강 — 명사",
      icon: "🟦",
      words: [
        { zh: "电脑", pinyin: "diànnǎo", ko: "컴퓨터", pos: "명사", hanja: "전뇌(電腦) — '번개 전 + 뇌 뇌', 즉 '전자 두뇌' = 컴퓨터.", ex: { zh: "这是我的电脑。", pinyin: "zhè shì wǒ de diàn nǎo", ko: "이건 제 컴퓨터예요." } },
        { zh: "汉语", pinyin: "Hànyǔ", ko: "중국어", pos: "명사", hanja: "한어(漢語) — '한나라 한 + 말씀 어', 한족의 말 = 중국어.", ex: { zh: "我学汉语。", pinyin: "wǒ xué Hànyǔ", ko: "저는 중국어를 배워요." } },
        { zh: "饭馆", pinyin: "fànguǎn", ko: "식당, 음식점", pos: "명사", hanja: "반관(飯館) — '밥 반 + 집 관'.", ex: { zh: "我们去饭馆吃饭。", pinyin: "wǒmen qù fàn guǎn chī fàn", ko: "우리 식당에 가서 밥 먹어요." } },
        { zh: "小姐", pinyin: "xiǎojie", ko: "아가씨, ~양 (젊은 여성 호칭)", pos: "명사", hanja: "소저(小姐) — '작을 소 + 누이 저'. 젊은 여성을 부르는 호칭이에요.", ex: { zh: "王小姐是老师。", pinyin: "Wáng xiǎojie shì lǎoshī", ko: "왕 양은 선생님이에요." } },
        { zh: "椅子", pinyin: "yǐzi", ko: "의자", pos: "명사", hanja: "의자(椅子) — '椅'가 의자 의. 한국어 '의자'와 같아요.", ex: { zh: "这把椅子很好。", pinyin: "zhè bǎ yǐzi hěn hǎo", ko: "이 의자는 좋아요." } },
        { zh: "桌子", pinyin: "zhuōzi", ko: "탁자, 책상", pos: "명사", hanja: "탁자(桌子) — '桌'이 탁자 탁. 한국어 '탁자'와 같아요.", ex: { zh: "桌子上有书。", pinyin: "zhuōzi shàng yǒu shū", ko: "탁자 위에 책이 있어요." } },
        { zh: "狗", pinyin: "gǒu", ko: "개", pos: "명사", hanja: "구(狗) — '개 구'.", ex: { zh: "我家有一只狗。", pinyin: "wǒ jiā yǒu yì zhī gǒu", ko: "우리 집에는 개가 한 마리 있어요." } },
        { zh: "猫", pinyin: "māo", ko: "고양이", pos: "명사", hanja: "묘(貓) — '고양이 묘'.", ex: { zh: "这只猫很可爱。", pinyin: "zhè zhī māo hěn kě'ài", ko: "이 고양이는 귀여워요." } },
        { zh: "前面", pinyin: "qiánmiàn", ko: "앞, 앞쪽", pos: "명사", hanja: "전면(前面) — '앞 전 + 낯 면'. 글자 그대로 '앞쪽'.", ex: { zh: "前面有一个饭馆。", pinyin: "qiánmiàn yǒu yí ge fànguǎn", ko: "앞쪽에 식당이 하나 있어요." } },
        { zh: "后面", pinyin: "hòumian", ko: "뒤, 뒤쪽", pos: "명사", hanja: "후면(後面) — '뒤 후 + 낯 면'. 글자 그대로 '뒤쪽'.", ex: { zh: "桌子后面有椅子。", pinyin: "zhuōzi hòumian yǒu yǐzi", ko: "탁자 뒤에 의자가 있어요." } },
        { zh: "上午", pinyin: "shàngwǔ", ko: "오전", pos: "명사", hanja: "상오(上午) — '윗 상 + 낮 오'. 정오 이전 = 오전.", ex: { zh: "上午我有课。", pinyin: "shàngwǔ wǒ yǒu kè", ko: "오전에 저는 수업이 있어요." } },
        { zh: "下午", pinyin: "xiàwǔ", ko: "오후", pos: "명사", hanja: "하오(下午) — '아래 하 + 낮 오'. 정오 이후 = 오후.", ex: { zh: "下午我去学校。", pinyin: "xiàwǔ wǒ qù xuéxiào", ko: "오후에 저는 학교에 가요." } },
        { zh: "日", pinyin: "rì", ko: "날, 일; 해", pos: "명사", hanja: "일(日) — '날 일'. 날짜의 '일'.", ex: { zh: "今天是五月一日。", pinyin: "jīntiān shì wǔ yuè yī rì", ko: "오늘은 5월 1일이에요." } },
      ],
    },
    {
      name: "HSK1 보강 — 대명사·의문사",
      icon: "🟦",
      words: [
        { zh: "这", pinyin: "zhè", ko: "이, 이것", pos: "대명사", ex: { zh: "这是我的书。", pinyin: "zhè shì wǒ de shū", ko: "이건 제 책이에요." } },
        { zh: "那", pinyin: "nà", ko: "저, 저것; 그, 그것", pos: "대명사", ex: { zh: "那是谁？", pinyin: "nà shì shéi", ko: "저 사람은 누구예요?" } },
        { zh: "哪", pinyin: "nǎ", ko: "어느, 어디", pos: "대명사", ex: { zh: "你是哪国人？", pinyin: "nǐ shì nǎ guó rén", ko: "어느 나라 사람이에요?" } },
        { zh: "什么", pinyin: "shénme", ko: "무엇, 무슨", pos: "대명사", ex: { zh: "这是什么？", pinyin: "zhè shì shénme", ko: "이건 뭐예요?" } },
        { zh: "谁", pinyin: "shéi", ko: "누구", pos: "대명사", ex: { zh: "他是谁？", pinyin: "tā shì shéi", ko: "그는 누구예요?" } },
        { zh: "怎么", pinyin: "zěnme", ko: "어떻게, 왜", pos: "대명사", ex: { zh: "这个字怎么读？", pinyin: "zhège zì zěnme dú", ko: "이 글자는 어떻게 읽어요?" } },
        { zh: "怎么样", pinyin: "zěnmeyàng", ko: "어때요?, 어떻습니까?", pos: "대명사", ex: { zh: "今天天气怎么样？", pinyin: "jīntiān tiānqì zěnmeyàng", ko: "오늘 날씨 어때요?" } },
      ],
    },
    {
      name: "HSK1 보강 — 조사·접속사·양사",
      icon: "🟦",
      words: [
        { zh: "的", pinyin: "de", ko: "~의 (소유·수식)", pos: "조사", ex: { zh: "这是我的书。", pinyin: "zhè shì wǒ de shū", ko: "이건 제 책이에요." } },
        { zh: "了", pinyin: "le", ko: "~했다 (완료·변화)", pos: "조사", ex: { zh: "我吃饭了。", pinyin: "wǒ chī fàn le", ko: "저는 밥을 먹었어요." } },
        { zh: "吗", pinyin: "ma", ko: "~입니까? (의문)", pos: "조사", ex: { zh: "你是学生吗？", pinyin: "nǐ shì xuésheng ma", ko: "당신은 학생이에요?" } },
        { zh: "呢", pinyin: "ne", ko: "~는요? (되물음·진행)", pos: "조사", ex: { zh: "我很好，你呢？", pinyin: "wǒ hěn hǎo, nǐ ne", ko: "저는 잘 지내요, 당신은요?" } },
        { zh: "和", pinyin: "hé", ko: "~와/과 (열거); 그리고", pos: "접속사", hanja: "화(和) — '화할 화'. 두 가지를 잇는 '~와'.", ex: { zh: "我和他是朋友。", pinyin: "wǒ hé tā shì péngyou", ko: "저와 그는 친구예요." } },
        { zh: "些", pinyin: "xiē", ko: "조금, 약간 (불특정 소량)", pos: "양사", ex: { zh: "我买了一些水果。", pinyin: "wǒ mǎi le yìxiē shuǐguǒ", ko: "저는 과일을 좀 샀어요." } },
        { zh: "本", pinyin: "běn", ko: "권 (책을 세는 양사)", pos: "양사", hanja: "본(本) — '근본 본'. 책 등을 셀 때 써요.", ex: { zh: "我有三本书。", pinyin: "wǒ yǒu sān běn shū", ko: "저는 책이 세 권 있어요." } },
      ],
    },
  ],
};

export default themes;
