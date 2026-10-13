/**
 * H4 (HSK 4급) HSK 2026 보강 어휘 — 《HSK 考试大纲》(2025-11 发布 · 2026-07 实施) 词汇大纲 4급 단어 중
 * 우리 사전에 없던 42개를 채웠어요(ZH-LEVEL-2026-001 ④). 표제어·병음은 2026 원문 그대로
 * (docs/design/hsk2026/words.json), 뜻·품사·예문은 학습용으로 작성.
 */
const themes = {
  themes: [
    {
      name: "HSK4 2026 보강",
      words: [
        { zh: "查找", pinyin: "cházhǎo", ko: "찾다, 검색하다", pos: "동사", ex: { zh: "我在网上查找资料。", pinyin: "Wǒ zài wǎngshang cházhǎo zīliào.", ko: "저는 인터넷에서 자료를 찾아요." } },
        { zh: "车速", pinyin: "chēsù", ko: "차의 속도, 주행 속도", pos: "명사", ex: { zh: "下雨天要注意车速。", pinyin: "Xiàyǔ tiān yào zhùyì chēsù.", ko: "비 오는 날에는 차 속도에 주의해야 해요." } },
        { zh: "车位", pinyin: "chēwèi", ko: "주차 공간, 주차 자리", pos: "명사", ex: { zh: "这儿很难找到车位。", pinyin: "Zhèr hěn nán zhǎodào chēwèi.", ko: "여기는 주차 자리를 찾기 어려워요." } },
        { zh: "窗", pinyin: "chuāng", ko: "창, 창문", pos: "명사", ex: { zh: "请把窗打开。", pinyin: "Qǐng bǎ chuāng dǎkāi.", ko: "창문을 열어 주세요." } },
        { zh: "袋子", pinyin: "dàizi", ko: "봉지, 자루, 주머니", pos: "명사", ex: { zh: "你有没有袋子？我买的东西太多了。", pinyin: "Nǐ yǒuméiyǒu dàizi? Wǒ mǎi de dōngxi tài duō le.", ko: "봉지 있어요? 산 물건이 너무 많아요." } },
        { zh: "登机", pinyin: "dēngjī", ko: "(비행기에) 탑승하다", pos: "동사", ex: { zh: "请大家在八点前登机。", pinyin: "Qǐng dàjiā zài bādiǎn qián dēngjī.", ko: "모두 8시 전에 탑승해 주세요." } },
        { zh: "低价", pinyin: "dījià", ko: "낮은 가격, 저가", pos: "명사", ex: { zh: "这家店用低价吸引顾客。", pinyin: "Zhè jiā diàn yòng dījià xīyǐn gùkè.", ko: "이 가게는 낮은 가격으로 손님을 끌어요." } },
        { zh: "动车", pinyin: "dòngchē", ko: "고속 열차(중국의 D열차)", pos: "명사", ex: { zh: "我们坐动车去上海吧。", pinyin: "Wǒmen zuò dòngchē qù Shànghǎi ba.", ko: "우리 고속 열차 타고 상하이에 가요." } },
        { zh: "度假", pinyin: "dùjià", ko: "휴가를 보내다", pos: "동사", ex: { zh: "今年夏天我们去海边度假。", pinyin: "Jīnnián xiàtiān wǒmen qù hǎibiān dùjià.", ko: "올여름 우리는 바닷가로 휴가를 가요." } },
        { zh: "感", pinyin: "gǎn", ko: "~감(느낌)", pos: "접미사", ex: { zh: "他做事很有责任感。", pinyin: "Tā zuòshì hěn yǒu zérèn gǎn.", ko: "그는 일할 때 책임감이 강해요." } },
        { zh: "好笑", pinyin: "hǎoxiào", ko: "우습다, 웃기다", pos: "형용사", ex: { zh: "这个故事太好笑了。", pinyin: "Zhège gùshi tài hǎoxiào le.", ko: "이 이야기는 너무 웃겨요." } },
        { zh: "景区", pinyin: "jǐngqū", ko: "관광지, 관광 명소 구역", pos: "명사", ex: { zh: "周末景区里的人特别多。", pinyin: "Zhōumò jǐngqū lǐ de rén tèbié duō.", ko: "주말에는 관광지에 사람이 특히 많아요." } },
        { zh: "举例", pinyin: "jǔlì", ko: "예를 들다", pos: "동사", ex: { zh: "老师举例说明了这个词的用法。", pinyin: "Lǎoshī jǔlì shuōmíng le zhège cí de yòngfǎ.", ko: "선생님이 예를 들어 이 단어의 용법을 설명했어요." } },
        { zh: "聚餐", pinyin: "jùcān", ko: "회식하다, 모여서 식사하다", pos: "동사", ex: { zh: "下班后我们公司要聚餐。", pinyin: "Xiàbān hòu wǒmen gōngsī yào jùcān.", ko: "퇴근 후에 우리 회사는 회식을 해요." } },
        { zh: "剧院", pinyin: "jùyuàn", ko: "극장(공연장)", pos: "명사", ex: { zh: "我们晚上去剧院看京剧。", pinyin: "Wǒmen wǎnshang qù jùyuàn kàn jīngjù.", ko: "우리는 저녁에 극장에 가서 경극을 봐요." } },
        { zh: "烤", pinyin: "kǎo", ko: "굽다; (불을) 쬐다", pos: "동사", ex: { zh: "妈妈在厨房里烤面包。", pinyin: "Māma zài chúfáng lǐ kǎo miànbāo.", ko: "엄마가 부엌에서 빵을 굽고 있어요." } },
        { zh: "零花钱", pinyin: "línghuāqián", ko: "용돈", pos: "명사", ex: { zh: "我每个月有两百块零花钱。", pinyin: "Wǒ měige yuè yǒu liǎngbǎi kuài línghuāqián.", ko: "저는 매달 용돈이 200위안 있어요." } },
        { zh: "美景", pinyin: "měijǐng", ko: "아름다운 경치", pos: "명사", ex: { zh: "山上的美景让人难忘。", pinyin: "Shānshang de měijǐng ràng rén nánwàng.", ko: "산 위의 아름다운 경치는 잊을 수 없어요." } },
        { zh: "目的地", pinyin: "mùdìdì", ko: "목적지", pos: "명사", ex: { zh: "我们终于到达了目的地。", pinyin: "Wǒmen zhōngyú dàodá le mùdìdì.", ko: "우리는 마침내 목적지에 도착했어요." } },
        { zh: "入住", pinyin: "rùzhù", ko: "(호텔 등에) 체크인하다, 묵기 시작하다; 입주하다", pos: "동사", hanja: "입주(入住) — 한국어 '입주(새집에 들어가 삶)'와 쓰임이 달라요! 중국어에선 호텔에 '체크인'할 때 가장 많이 써요.", ex: { zh: "我们下午两点可以入住酒店。", pinyin: "Wǒmen xiàwǔ liǎngdiǎn kěyǐ rùzhù jiǔdiàn.", ko: "우리는 오후 2시에 호텔에 체크인할 수 있어요." } },
        { zh: "扫码", pinyin: "sǎomǎ", ko: "QR코드를 스캔하다", pos: "동사", ex: { zh: "请扫码付款。", pinyin: "Qǐng sǎomǎ fùkuǎn.", ko: "QR코드를 스캔해서 결제해 주세요." } },
        { zh: "少见", pinyin: "shǎojiàn", ko: "보기 드물다, 드물다", pos: "형용사", ex: { zh: "这么大的雪在南方很少见。", pinyin: "Zhème dà de xuě zài nánfāng hěn shǎojiàn.", ko: "이렇게 큰 눈은 남쪽에서는 아주 드물어요." } },
        { zh: "少量", pinyin: "shǎoliàng", ko: "소량의, 적은 양의", pos: "형용사", ex: { zh: "做这个菜只需要少量的盐。", pinyin: "Zuò zhège cài zhǐ xūyào shǎoliàng de yán.", ko: "이 요리를 만들 때는 소금이 조금만 필요해요." } },
        { zh: "摄氏度", pinyin: "shèshìdù", ko: "섭씨 ~도(℃)", pos: "양사", ex: { zh: "今天最高气温三十摄氏度。", pinyin: "Jīntiān zuìgāo qìwēn sānshí shèshìdù.", ko: "오늘 최고 기온은 섭씨 30도예요." } },
        { zh: "身", pinyin: "shēn", ko: "몸, 신체; 벌(옷을 세는 말)", pos: "명사", ex: { zh: "他今天穿了一身黑衣服。", pinyin: "Tā jīntiān chuān le yì shēn hēi yīfu.", ko: "그는 오늘 검은 옷을 한 벌 입었어요." } },
        { zh: "时间表", pinyin: "shíjiānbiǎo", ko: "시간표, 일정표", pos: "명사", ex: { zh: "火车时间表贴在墙上。", pinyin: "Huǒchē shíjiānbiǎo tiē zài qiángshang.", ko: "기차 시간표가 벽에 붙어 있어요." } },
        { zh: "使馆", pinyin: "shǐguǎn", ko: "대사관, 공관", pos: "명사", ex: { zh: "我明天去使馆办签证。", pinyin: "Wǒ míngtiān qù shǐguǎn bàn qiānzhèng.", ko: "저는 내일 대사관에 가서 비자를 신청해요." } },
        { zh: "售票员", pinyin: "shòupiàoyuán", ko: "매표원", pos: "명사", ex: { zh: "售票员告诉我票已经卖完了。", pinyin: "Shòupiàoyuán gàosu wǒ piào yǐjīng màiwán le.", ko: "매표원이 표가 이미 다 팔렸다고 알려 줬어요." } },
        { zh: "填写", pinyin: "tiánxiě", ko: "기입하다, 작성하다(빈칸을 채우다)", pos: "동사", ex: { zh: "请填写你的名字和电话。", pinyin: "Qǐng tiánxiě nǐ de míngzi hé diànhuà.", ko: "이름과 전화번호를 적어 주세요." } },
        { zh: "桶", pinyin: "tǒng", ko: "통, 양동이", pos: "명사", ex: { zh: "他提着一桶水回家了。", pinyin: "Tā tízhe yì tǒng shuǐ huíjiā le.", ko: "그는 물 한 통을 들고 집에 돌아왔어요." } },
        { zh: "头痛", pinyin: "tóutòng", ko: "머리가 아프다; 골치 아프다", pos: "형용사", ex: { zh: "我昨天没睡好，今天有点儿头痛。", pinyin: "Wǒ zuótiān méi shuì hǎo, jīntiān yǒudiǎnr tóutòng.", ko: "어제 잠을 못 자서 오늘 머리가 좀 아파요." } },
        { zh: "网购", pinyin: "wǎnggòu", ko: "인터넷 쇼핑을 하다", pos: "동사", ex: { zh: "现在很多人喜欢网购。", pinyin: "Xiànzài hěn duō rén xǐhuan wǎnggòu.", ko: "요즘 많은 사람들이 인터넷 쇼핑을 좋아해요." } },
        { zh: "味", pinyin: "wèi", ko: "맛; 냄새", pos: "명사", ex: { zh: "这个菜是什么味的？", pinyin: "Zhège cài shì shénme wèi de?", ko: "이 요리는 무슨 맛이에요?" } },
        { zh: "细心", pinyin: "xìxīn", ko: "세심하다, 꼼꼼하다", pos: "형용사", ex: { zh: "她做事很细心。", pinyin: "Tā zuòshì hěn xìxīn.", ko: "그녀는 일을 꼼꼼하게 해요." } },
        { zh: "线上", pinyin: "xiànshàng", ko: "온라인", pos: "명사", ex: { zh: "我们下周开线上会议。", pinyin: "Wǒmen xiàzhōu kāi xiànshàng huìyì.", ko: "우리는 다음 주에 온라인 회의를 해요." } },
        { zh: "线下", pinyin: "xiànxià", ko: "오프라인", pos: "명사", ex: { zh: "我们下次在线下见面吧。", pinyin: "Wǒmen xiàcì zài xiànxià jiànmiàn ba.", ko: "다음에는 오프라인에서 만나요." } },
        { zh: "夜晚", pinyin: "yèwǎn", ko: "밤, 야간", pos: "명사", ex: { zh: "城市的夜晚很漂亮。", pinyin: "Chéngshì de yèwǎn hěn piàoliang.", ko: "도시의 밤은 아름다워요." } },
        { zh: "友情", pinyin: "yǒuqíng", ko: "우정", pos: "명사", ex: { zh: "我们的友情已经有十年了。", pinyin: "Wǒmen de yǒuqíng yǐjīng yǒu shínián le.", ko: "우리의 우정은 벌써 10년이 됐어요." } },
        { zh: "纸巾", pinyin: "zhǐjīn", ko: "티슈, 휴지", pos: "명사", ex: { zh: "你有纸巾吗？", pinyin: "Nǐ yǒu zhǐjīn ma?", ko: "휴지 있어요?" } },
        { zh: "转发", pinyin: "zhuǎnfā", ko: "(메시지·게시물을) 전달하다, 공유하다", pos: "동사", ex: { zh: "我把这个消息转发给你了。", pinyin: "Wǒ bǎ zhège xiāoxi zhuǎnfā gěi nǐ le.", ko: "이 소식을 당신에게 전달했어요." } },
        { zh: "转机", pinyin: "zhuǎnjī", ko: "비행기를 갈아타다, 환승하다", pos: "동사", hanja: "전기(轉機) — 한국어 '전기(전환점)'와 뜻이 달라요! 4급에서는 비행기를 갈아타는 '환승'이에요. '전환점' 뜻은 7–9급에서 따로 나와요.", ex: { zh: "我们要在北京转机。", pinyin: "Wǒmen yào zài Běijīng zhuǎnjī.", ko: "우리는 베이징에서 비행기를 갈아타야 해요." } },
        { zh: "自习", pinyin: "zìxí", ko: "자습하다", pos: "동사", ex: { zh: "晚上我在图书馆自习。", pinyin: "Wǎnshang wǒ zài túshūguǎn zìxí.", ko: "저녁에 저는 도서관에서 자습해요." } },
      ],
    },
  ],
};

export default themes;
