/**
 * H4 (HSK 4급) HSK 2026 보강 어휘 — 《中文水平考试 HSK 考试大纲》(中外语言交流合作中心, 2025-11 발표 · 2026-07 시행)
 * 词汇大纲의 4급 단어 중 우리 사전에 없던 42개를 채웠어요(ZH-LEVEL-2026-001 ④).
 * 한자·병음은 대강 원문 그대로(설계 정본 docs/design/hsk2026/words.json), 품사는 원문 품사의 첫 갈래,
 * 뜻·예문은 학습용으로 작성 — AI 초안 → 콘텐츠 검사 → 다른 모델 표본 대조.
 */
const themes = {
  themes: [
    {
      name: "HSK4 2026 보강",
      words: [
        { zh: "查找", pinyin: "cházhǎo", ko: "찾다, 검색하다", pos: "동사", ex: { zh: "我在网上查找资料。", pinyin: "Wǒ zài wǎng shang cházhǎo zīliào.", ko: "저는 인터넷에서 자료를 찾아요." } },
        { zh: "车速", pinyin: "chēsù", ko: "차의 속도, 주행 속도", pos: "명사", ex: { zh: "下雨天车速不要太快。", pinyin: "Xiàyǔtiān chēsù bú yào tài kuài.", ko: "비 오는 날에는 차 속도를 너무 내지 마세요." } },
        { zh: "车位", pinyin: "chēwèi", ko: "주차 자리, 주차 공간", pos: "명사", ex: { zh: "这里很难找到车位。", pinyin: "Zhèlǐ hěn nán zhǎodào chēwèi.", ko: "여기는 주차 자리를 찾기가 어려워요." } },
        { zh: "窗", pinyin: "chuāng", ko: "창문, 창", pos: "명사", ex: { zh: "天冷了，请把窗关上。", pinyin: "Tiān lěng le, qǐng bǎ chuāng guānshang.", ko: "날씨가 추워졌으니 창문을 닫아 주세요." } },
        { zh: "袋子", pinyin: "dàizi", ko: "봉지, 자루, 주머니", pos: "명사", ex: { zh: "可以给我一个袋子吗？", pinyin: "Kěyǐ gěi wǒ yí ge dàizi ma?", ko: "봉지 하나 주실 수 있어요?" } },
        { zh: "登机", pinyin: "dēngjī", ko: "(비행기에) 탑승하다", pos: "동사", ex: { zh: "我们还有半个小时就要登机了。", pinyin: "Wǒmen hái yǒu bàn ge xiǎoshí jiù yào dēngjī le.", ko: "우리는 30분 후면 탑승해야 해요." } },
        { zh: "低价", pinyin: "dījià", ko: "낮은 가격, 저가", pos: "명사", hanja: "저가(低價) — 한자가 그대로", ex: { zh: "这家店低价卖水果。", pinyin: "Zhè jiā diàn dījià mài shuǐguǒ.", ko: "이 가게는 과일을 싸게 팔아요." } },
        { zh: "动车", pinyin: "dòngchē", ko: "고속 열차(D열차)", pos: "명사", ex: { zh: "我们坐动车去上海吧。", pinyin: "Wǒmen zuò dòngchē qù Shànghǎi ba.", ko: "우리 고속 열차 타고 상하이에 가요." } },
        { zh: "度假", pinyin: "dùjià", ko: "휴가를 보내다", pos: "동사", ex: { zh: "我们打算去海边度假。", pinyin: "Wǒmen dǎsuàn qù hǎibiān dùjià.", ko: "우리는 바닷가로 휴가를 갈 계획이에요." } },
        { zh: "感", pinyin: "gǎn", ko: "-감(느낌)", pos: "접미사", hanja: "감(感) — 한국어 '-감'(성취감·안정감)과 같은 쓰임이에요.", ex: { zh: "他是个很有幽默感的人。", pinyin: "Tā shì ge hěn yǒu yōumògǎn de rén.", ko: "그는 유머 감각이 아주 뛰어난 사람이에요." } },
        { zh: "好笑", pinyin: "hǎoxiào", ko: "우습다, 웃기다", pos: "형용사", ex: { zh: "这个故事太好笑了。", pinyin: "Zhège gùshi tài hǎoxiào le.", ko: "이 이야기는 너무 웃겨요." } },
        { zh: "景区", pinyin: "jǐngqū", ko: "관광지, 관광 명소", pos: "명사", ex: { zh: "周末景区的人特别多。", pinyin: "Zhōumò jǐngqū de rén tèbié duō.", ko: "주말에는 관광지에 사람이 특히 많아요." } },
        { zh: "举例", pinyin: "jǔlì", ko: "예를 들다", pos: "동사", ex: { zh: "老师举例说明了这个词的用法。", pinyin: "Lǎoshī jǔlì shuōmíngle zhège cí de yòngfǎ.", ko: "선생님이 예를 들어 이 단어의 쓰임을 설명했어요." } },
        { zh: "聚餐", pinyin: "jùcān", ko: "회식하다, 모여서 식사하다", pos: "동사", ex: { zh: "周五晚上我们公司聚餐。", pinyin: "Zhōuwǔ wǎnshang wǒmen gōngsī jùcān.", ko: "금요일 저녁에 우리 회사가 회식해요." } },
        { zh: "剧院", pinyin: "jùyuàn", ko: "극장, 공연장", pos: "명사", ex: { zh: "晚上我们去剧院看京剧。", pinyin: "Wǎnshang wǒmen qù jùyuàn kàn jīngjù.", ko: "저녁에 우리는 극장에 가서 경극을 봐요." } },
        { zh: "烤", pinyin: "kǎo", ko: "굽다", pos: "동사", ex: { zh: "妈妈在厨房烤面包。", pinyin: "Māma zài chúfáng kǎo miànbāo.", ko: "엄마가 부엌에서 빵을 구워요." } },
        { zh: "零花钱", pinyin: "línghuāqián", ko: "용돈", pos: "명사", ex: { zh: "妈妈每周给我零花钱。", pinyin: "Māma měi zhōu gěi wǒ línghuāqián.", ko: "엄마가 매주 저에게 용돈을 줘요." } },
        { zh: "美景", pinyin: "měijǐng", ko: "아름다운 경치", pos: "명사", ex: { zh: "山上的美景让人难忘。", pinyin: "Shān shang de měijǐng ràng rén nánwàng.", ko: "산 위의 아름다운 경치는 잊을 수가 없어요." } },
        { zh: "目的地", pinyin: "mùdìdì", ko: "목적지", pos: "명사", hanja: "목적지(目的地) — 한자가 그대로", ex: { zh: "我们终于到了目的地。", pinyin: "Wǒmen zhōngyú dàole mùdìdì.", ko: "우리는 드디어 목적지에 도착했어요." } },
        { zh: "入住", pinyin: "rùzhù", ko: "(호텔에) 체크인하다, 입주하다", pos: "동사", hanja: "입주(入住) — 한국어 '입주'와 비슷하지만 호텔 체크인에도 써요.", ex: { zh: "我们下午两点可以入住酒店。", pinyin: "Wǒmen xiàwǔ liǎng diǎn kěyǐ rùzhù jiǔdiàn.", ko: "우리는 오후 두 시에 호텔에 체크인할 수 있어요." } },
        { zh: "扫码", pinyin: "sǎomǎ", ko: "QR코드를 스캔하다", pos: "동사", ex: { zh: "在这儿扫码就可以付钱。", pinyin: "Zài zhèr sǎomǎ jiù kěyǐ fù qián.", ko: "여기서 QR코드를 스캔하면 바로 결제할 수 있어요." } },
        { zh: "少见", pinyin: "shǎojiàn", ko: "보기 드물다, 드물다", pos: "형용사", ex: { zh: "这么大的雪在这里很少见。", pinyin: "Zhème dà de xuě zài zhèlǐ hěn shǎojiàn.", ko: "이렇게 큰 눈은 여기서 보기 드물어요." } },
        { zh: "少量", pinyin: "shǎoliàng", ko: "소량의, 적은 양의", pos: "형용사", hanja: "소량(少量) — 한자가 그대로", ex: { zh: "做菜时放少量的盐就行。", pinyin: "Zuò cài shí fàng shǎoliàng de yán jiù xíng.", ko: "요리할 때 소금은 조금만 넣으면 돼요." } },
        { zh: "摄氏度", pinyin: "shèshìdù", ko: "섭씨 ~도", pos: "양사", ex: { zh: "今天最高气温三十摄氏度。", pinyin: "Jīntiān zuìgāo qìwēn sānshí shèshìdù.", ko: "오늘 최고 기온은 섭씨 30도예요." } },
        { zh: "身", pinyin: "shēn", ko: "몸, 신체; (옷) 벌", pos: "명사", ex: { zh: "今天出门我身上没带钱。", pinyin: "Jīntiān chūmén wǒ shēnshang méi dài qián.", ko: "오늘 나올 때 돈을 안 가지고 나왔어요." } },
        { zh: "时间表", pinyin: "shíjiānbiǎo", ko: "시간표", pos: "명사", hanja: "시간표(時間表) — 한자가 그대로", ex: { zh: "请把考试时间表发给我。", pinyin: "Qǐng bǎ kǎoshì shíjiānbiǎo fā gěi wǒ.", ko: "시험 시간표를 저에게 보내 주세요." } },
        { zh: "使馆", pinyin: "shǐguǎn", ko: "대사관, 공관", pos: "명사", ex: { zh: "我明天要去使馆办签证。", pinyin: "Wǒ míngtiān yào qù shǐguǎn bàn qiānzhèng.", ko: "저는 내일 대사관에 비자를 신청하러 가요." } },
        { zh: "售票员", pinyin: "shòupiàoyuán", ko: "매표원", pos: "명사", ex: { zh: "售票员告诉我票已经卖完了。", pinyin: "Shòupiàoyuán gàosu wǒ piào yǐjīng màiwán le.", ko: "매표원이 표가 이미 다 팔렸다고 알려 줬어요." } },
        { zh: "填写", pinyin: "tiánxiě", ko: "(서식에) 기입하다, 작성하다", pos: "동사", ex: { zh: "请先填写一下这张表。", pinyin: "Qǐng xiān tiánxiě yíxià zhè zhāng biǎo.", ko: "먼저 이 양식을 작성해 주세요." } },
        { zh: "桶", pinyin: "tǒng", ko: "통, 양동이", pos: "명사", ex: { zh: "请把垃圾扔进这个桶。", pinyin: "Qǐng bǎ lājī rēngjìn zhège tǒng.", ko: "쓰레기는 이 통에 버려 주세요." } },
        { zh: "头痛", pinyin: "tóutòng", ko: "머리가 아프다; 골치 아프다", pos: "형용사", hanja: "두통(頭痛) — 한자가 그대로, '골치 아프다'는 뜻으로도 써요.", ex: { zh: "我今天有点儿头痛。", pinyin: "Wǒ jīntiān yǒudiǎnr tóutòng.", ko: "저 오늘 머리가 좀 아파요." } },
        { zh: "网购", pinyin: "wǎnggòu", ko: "인터넷 쇼핑하다", pos: "동사", ex: { zh: "现在很多人喜欢网购。", pinyin: "Xiànzài hěn duō rén xǐhuan wǎnggòu.", ko: "요즘은 많은 사람이 인터넷 쇼핑을 좋아해요." } },
        { zh: "味", pinyin: "wèi", ko: "맛; 냄새", pos: "명사", ex: { zh: "这个汤没什么味，再放点儿盐吧。", pinyin: "Zhège tāng méi shénme wèi, zài fàng diǎnr yán ba.", ko: "이 국은 별맛이 없으니 소금을 좀 더 넣어요." } },
        { zh: "细心", pinyin: "xìxīn", ko: "세심하다, 꼼꼼하다", pos: "형용사", hanja: "세심(細心) — 한자가 그대로", ex: { zh: "她做事非常细心。", pinyin: "Tā zuòshì fēicháng xìxīn.", ko: "그녀는 일을 아주 꼼꼼하게 해요." } },
        { zh: "线上", pinyin: "xiànshàng", ko: "온라인", pos: "명사", ex: { zh: "我们下周开线上会议。", pinyin: "Wǒmen xià zhōu kāi xiànshàng huìyì.", ko: "우리는 다음 주에 온라인 회의를 해요." } },
        { zh: "线下", pinyin: "xiànxià", ko: "오프라인", pos: "명사", ex: { zh: "我们线上认识，后来线下见面了。", pinyin: "Wǒmen xiànshàng rènshi, hòulái xiànxià jiànmiàn le.", ko: "우리는 온라인에서 알게 됐고, 나중에 오프라인으로 만났어요." } },
        { zh: "夜晚", pinyin: "yèwǎn", ko: "밤, 야간", pos: "명사", ex: { zh: "夏天的夜晚很凉快。", pinyin: "Xiàtiān de yèwǎn hěn liángkuai.", ko: "여름밤은 시원해요." } },
        { zh: "友情", pinyin: "yǒuqíng", ko: "우정", pos: "명사", hanja: "우정(友情) — 한자가 그대로", ex: { zh: "我们的友情已经十年了。", pinyin: "Wǒmen de yǒuqíng yǐjīng shí nián le.", ko: "우리의 우정은 벌써 10년이 됐어요." } },
        { zh: "纸巾", pinyin: "zhǐjīn", ko: "티슈, 휴지", pos: "명사", ex: { zh: "能给我一张纸巾吗？", pinyin: "Néng gěi wǒ yì zhāng zhǐjīn ma?", ko: "티슈 한 장 주실 수 있어요?" } },
        { zh: "转发", pinyin: "zhuǎnfā", ko: "(글·메시지를) 전달하다, 공유하다", pos: "동사", ex: { zh: "我把这条消息转发给你了。", pinyin: "Wǒ bǎ zhè tiáo xiāoxi zhuǎnfā gěi nǐ le.", ko: "이 메시지를 당신에게 전달했어요." } },
        { zh: "转机", pinyin: "zhuǎnjī", ko: "(비행기를) 갈아타다, 환승하다", pos: "동사", hanja: "전기(轉機) — 동사로는 '비행기 환승'이 주로 쓰여요. 명사로 '전환점, 호전'의 뜻도 있어요.", ex: { zh: "我们要在北京转机。", pinyin: "Wǒmen yào zài Běijīng zhuǎnjī.", ko: "우리는 베이징에서 비행기를 갈아타야 해요." } },
        { zh: "自习", pinyin: "zìxí", ko: "자습하다", pos: "동사", hanja: "자습(自習) — 한자가 그대로", ex: { zh: "晚上我在图书馆自习。", pinyin: "Wǎnshang wǒ zài túshūguǎn zìxí.", ko: "저녁에 저는 도서관에서 자습해요." } },
      ],
    },
  ],
};

export default themes;
