/**
 * H1 여행 장면 — 공항·숙소·식당 실전 회화 (H1 레벨 6장: 17-22번)
 * 入境·买票·入住·服务·点餐·支付까지 실제 장면 조합.
 */
const chapters = [
  {
    slug: "h1-17-scene-airport-entry",
    level: "H1",
    order: 17,
    title: "\"여행하러 왔어요\" — 입국 질문에 답하기",
    titleFr: "入境问答",
    topic: "공항·입국 来・待・住在・这是・没有带",
    summary: "방문 목적·체류 기간·숙소를 답하고, 여권과 신고 물품을 확인하는 입국 장면을 연습해요.",
    duration: "약 15분",
    sections: [
      {
        heading: "방문 목적을 짧게 답해요",
        pattern: "我来 + 동사",
        patternKo: "저는 ~하러 왔어요",
        body:
          "입국 심사에서 방문 목적을 물으면 **我来 wǒ lái** 뒤에 할 일을 붙여요. 여행은 旅游, 공부는 学习를 넣으면 돼요.\n\n" +
          "질문의 모든 단어를 따라 하지 않아도 핵심 목적을 한 문장으로 답하면 충분해요.",
        examples: [
          { zh: "我来旅游。", pinyin: "wǒ lái lǚyóu", ko: "저는 여행하러 왔어요." },
          { zh: "我来学习中文。", pinyin: "wǒ lái xuéxí Zhōngwén", ko: "저는 중국어를 공부하러 왔어요." },
        ],
        pitfall: "来 뒤에는 목적을 나타내는 동사를 바로 놓아요. 한국어처럼 '~하러'에 해당하는 조사를 따로 붙이지 않아요.",
      },
      {
        heading: "얼마나 머무는지 말해요",
        pattern: "我会待 + 기간",
        patternKo: "저는 ~ 동안 머물 거예요",
        body:
          "**会 huì**는 여기서 앞으로의 일을 나타내고, **待 dāi**는 '머물다'예요. 뒤에 三天(3일), 一个星期(일주일)처럼 기간을 놓아요.\n\n" +
          "기간 앞에는 在를 쓰지 않아요. 동사 待 뒤에 기간을 바로 붙이는 어순이에요.",
        examples: [
          { zh: "我会待五天。", pinyin: "wǒ huì dāi wǔ tiān", ko: "저는 5일 동안 머물 거예요." },
          { zh: "我会待一个星期。", pinyin: "wǒ huì dāi yí ge xīngqī", ko: "저는 일주일 동안 머물 거예요." },
        ],
        vsKo: "한국어는 '5일 동안'처럼 조사를 붙이지만, 중국어는 待五天처럼 동사 뒤에 기간을 바로 놓아요.",
      },
      {
        heading: "머무를 곳을 알려요",
        pattern: "我住在 + 장소",
        patternKo: "저는 ~에 묵어요",
        body:
          "**住 zhù**는 '살다·묵다', **在 zài**는 장소를 이어요. 호텔이나 공항 근처처럼 실제로 머무를 곳을 住在 뒤에 말해요.\n\n" +
          "숙소 이름을 몰라도 市中心的酒店(도심의 호텔), 机场附近(공항 근처)처럼 위치로 답할 수 있어요.",
        examples: [
          { zh: "我住在市中心的酒店。", pinyin: "wǒ zhù zài shì zhōngxīn de jiǔdiàn", ko: "저는 도심의 호텔에 묵어요." },
          { zh: "我住在机场附近。", pinyin: "wǒ zhù zài jīchǎng fùjìn", ko: "저는 공항 근처에 묵어요." },
        ],
        hanja: "中心 zhōngxīn은 **중심(中心)**이에요. 장소 한자어를 알면 긴 답에서도 핵심을 잡기 쉬워요.",
      },
      {
        heading: "요청받은 서류를 건네요",
        pattern: "这是我的 + 서류",
        patternKo: "이것은 제 ~예요",
        body:
          "심사 직원이 서류를 요청하면 **这是我的 zhè shì wǒ de** 뒤에 서류 이름을 붙여요. 护照(여권), 入境卡(입국 카드)를 바꾸어 쓸 수 있어요.\n\n" +
          "서류를 내밀면서 말하는 짧은 문장이라 실제 창구에서도 바로 쓰기 좋아요.",
        examples: [
          { zh: "这是我的护照。", pinyin: "zhè shì wǒ de hùzhào", ko: "이것은 제 여권이에요." },
          { zh: "这是我的入境卡。", pinyin: "zhè shì wǒ de rùjìngkǎ", ko: "이것은 제 입국 카드예요." },
        ],
        tip: "질문 전체를 못 알아들었다면 서류를 보여 주며 这是我的护照라고 확인해도 돼요.",
      },
      {
        heading: "신고할 물건이 없다고 답해요",
        pattern: "我没有带 + 물건",
        patternKo: "저는 ~을 가져오지 않았어요",
        body:
          "**没有 méiyǒu** 뒤에 **带 dài**를 붙이면 '가지고 오지 않았다'가 돼요. 세관에서 음식이나 신고 물품이 있는지 확인할 때 쓸 수 있어요.\n\n" +
          "없다는 답을 먼저 말하고 필요한 경우 물건 이름을 뒤에 덧붙이면 뜻이 분명해요.",
        examples: [
          { zh: "我没有带肉类。", pinyin: "wǒ méiyǒu dài ròulèi", ko: "저는 육류를 가져오지 않았어요." },
          { zh: "我没有带需要申报的物品。", pinyin: "wǒ méiyǒu dài xūyào shēnbào de wùpǐn", ko: "저는 신고가 필요한 물품을 가져오지 않았어요." },
        ],
        hanja: "申报 shēnbào의 번체는 申報로 신고한다는 뜻이에요. 物品 wùpǐn은 **물품(物品)**과 글자도 뜻도 같아요.",
        story: {
          body: [
            { narr: "대화 1 — 여행자가 입국 심사대에서 방문 목적과 체류 계획을 답해요." },
            { speaker: "工作人员", zh: "您来做什么？", pinyin: "nín lái zuò shénme", ko: "무슨 목적으로 오셨어요?" },
            { speaker: "旅行者", zh: "我来旅游。", pinyin: "wǒ lái lǚyóu", ko: "저는 여행하러 왔어요." },
            { speaker: "工作人员", zh: "您会待几天？", pinyin: "nín huì dāi jǐ tiān", ko: "며칠 머무르세요?" },
            { speaker: "旅行者", zh: "我会待五天。我住在市中心的酒店。", pinyin: "wǒ huì dāi wǔ tiān, wǒ zhù zài shì zhōngxīn de jiǔdiàn", ko: "5일 머물 거예요. 도심의 호텔에 묵어요." },
            { narr: "대화 2 — 세관 직원이 여권과 신고 물품을 확인해요." },
            { speaker: "工作人员", zh: "请给我看您的护照。", pinyin: "qǐng gěi wǒ kàn nín de hùzhào", ko: "여권을 보여 주세요." },
            { speaker: "旅行者", zh: "这是我的护照。", pinyin: "zhè shì wǒ de hùzhào", ko: "이것은 제 여권이에요." },
            { speaker: "工作人员", zh: "您带了需要申报的物品吗？", pinyin: "nín dài le xūyào shēnbào de wùpǐn ma", ko: "신고가 필요한 물품을 가져오셨나요?" },
            { speaker: "旅行者", zh: "没有，我没有带肉类和水果。", pinyin: "méiyǒu, wǒ méiyǒu dài ròulèi hé shuǐguǒ", ko: "아니요, 육류와 과일을 가져오지 않았어요." },
          ],
          questions: [
            {
              id: "h1-17-scene-airport-entry-sq1",
              type: "order",
              pattern: "我会待 + 기간",
              q: "입국 심사 직원에게 5일 머문다고 답하도록 문장을 순서대로 놓아 보세요.",
              tiles: ["五天", "我", "会待"],
              answer: ["我", "会待", "五天"],
              ko: "저는 5일 동안 머물 거예요.",
              why: "주어 我 뒤에 会待를 놓고, 머무는 기간 五天을 동사 뒤에 붙여요.",
            },
            {
              id: "h1-17-scene-airport-entry-sq2",
              type: "fill",
              pattern: "我住在 + 장소",
              q: "공항 근처에 묵는다고 알려 주세요. 장소를 잇는 글자를 채워 보세요.",
              zh: "我住［　］机场附近。",
              answer: "在",
              accept: ["在"],
              why: "住在를 한 덩어리로 써서 뒤의 숙소 위치를 이어요.",
            },
            {
              id: "h1-17-scene-airport-entry-sq3",
              type: "produce",
              prompt: "여행 목적으로 와서 일주일 머물 예정이에요. 목적과 기간을 중국어 두 문장으로 답해 보세요.",
              model: ["我来旅游。我会待一个星期。"],
              guide: "첫 문장에는 我来旅游, 둘째 문장에는 我会待 + 기간을 넣었는지 확인해요.",
            },
          ],
        },
      },
    ],
  },
  {
    slug: "h1-18-scene-airport-ticket-transfer",
    level: "H1",
    order: 18,
    title: "\"표 한 장 주세요\" — 표를 사고 환승하기",
    titleFr: "购票・换乘",
    topic: "공항·이동 一张票・单程往返・几点开・换乘・几站",
    summary: "목적지 표를 사고 출발 시각을 확인하며, 환승 장소와 남은 정거장 수를 묻는 이동 장면을 연습해요.",
    duration: "약 15분",
    sections: [
      {
        heading: "목적지까지 가는 표를 사요",
        pattern: "我要一张去 + 장소 + 的票",
        patternKo: "~행 표 한 장 주세요",
        body:
          "**我要 wǒ yào** 뒤에 **一张票 yì zhāng piào**를 놓으면 표 한 장을 요청할 수 있어요. 去와 的 사이에 목적지를 넣어 '~행'을 만들어요.\n\n" +
          "票의 양사는 张이에요. 종이처럼 납작한 물건을 세는 양사라 一张票로 말해요.",
        examples: [
          { zh: "我要一张去市中心的票。", pinyin: "wǒ yào yì zhāng qù shì zhōngxīn de piào", ko: "도심행 표 한 장 주세요." },
          { zh: "我要一张去火车站的票。", pinyin: "wǒ yào yì zhāng qù huǒchēzhàn de piào", ko: "기차역행 표 한 장 주세요." },
        ],
        pitfall: "一票(×)라고 하지 않고 표를 세는 양사 张을 꼭 넣어 一张票라고 해요.",
      },
      {
        heading: "편도인지 왕복인지 정해요",
        pattern: "单程还是往返？",
        patternKo: "편도예요, 왕복이에요?",
        body:
          "**单程 dānchéng**은 편도, **往返 wǎngfǎn**은 왕복이에요. **还是 háishi**는 두 선택지 중 하나를 물을 때 써요.\n\n" +
          "직원이 묻는다면 单程，谢谢 또는 往返，谢谢처럼 필요한 쪽만 짧게 답해도 자연스러워요.",
        examples: [
          { zh: "单程还是往返？", pinyin: "dānchéng háishi wǎngfǎn", ko: "편도예요, 왕복이에요?" },
          { zh: "我要往返票。", pinyin: "wǒ yào wǎngfǎn piào", ko: "왕복표로 주세요." },
        ],
        hanja: "往返은 **왕복(往返)**과 같은 글자예요. 返이 '돌아올 반'이라 왕복 뜻을 바로 연결할 수 있어요.",
      },
      {
        heading: "출발 시각을 확인해요",
        pattern: "교통수단 + 几点开？",
        patternKo: "~은 몇 시에 출발해요?",
        body:
          "기차나 공항버스 뒤에 **几点开 jǐ diǎn kāi**를 붙이면 출발 시각을 물을 수 있어요. 여기서 开는 차량이 '출발하다'라는 뜻이에요.\n\n" +
          "표에 적힌 시각을 다시 확인하고 싶다면 这班车几点开처럼 这班车(이 차편)를 주어로 놓아요.",
        examples: [
          { zh: "机场大巴几点开？", pinyin: "jīchǎng dàbā jǐ diǎn kāi", ko: "공항버스는 몇 시에 출발해요?" },
          { zh: "这班火车几点开？", pinyin: "zhè bān huǒchē jǐ diǎn kāi", ko: "이 기차는 몇 시에 출발해요?" },
        ],
        tip: "출발편을 세는 양사 班을 기억하면 这班车(이 차편), 下一班车(다음 차편)처럼 말할 수 있어요.",
      },
      {
        heading: "어디에서 갈아타는지 물어요",
        pattern: "在哪儿换乘 + 노선/교통수단？",
        patternKo: "어디에서 ~로 갈아타요?",
        body:
          "**在哪儿 zài nǎr**는 '어디에서', **换乘 huànchéng**은 '환승하다'예요. 뒤에 지하철 노선이나 교통수단을 놓으면 환승 지점을 물을 수 있어요.\n\n" +
          "在 다음의 장소와 换乘 뒤의 노선을 나누어 들으면 긴 안내도 정리하기 쉬워요.",
        examples: [
          { zh: "在哪儿换乘二号线？", pinyin: "zài nǎr huànchéng èr hào xiàn", ko: "어디에서 2호선으로 갈아타요?" },
          { zh: "在哪儿换乘机场大巴？", pinyin: "zài nǎr huànchéng jīchǎng dàbā", ko: "어디에서 공항버스로 갈아타요?" },
        ],
        hanja: "换乘의 번체는 換乘으로 **환승(換乘)**과 같은 글자예요. 바꾸어 탄다는 뜻이 그대로 보여요.",
      },
      {
        heading: "몇 정거장 남았는지 확인해요",
        pattern: "还要坐 + 几/숫자 + 站？",
        patternKo: "아직 몇 정거장 더 가야 해요?",
        body:
          "**还要 hái yào**는 '아직 더 ~해야 한다', **坐 zuò**는 교통수단을 타고 이동한다는 뜻이에요. 숫자 뒤에 站을 붙여 남은 정거장 수를 확인해요.\n\n" +
          "还要坐几站처럼 几를 넣으면 몇 정거장인지 묻고, 숫자를 넣고 吗를 붙이면 들은 정보를 확인할 수 있어요.",
        examples: [
          { zh: "还要坐几站？", pinyin: "hái yào zuò jǐ zhàn", ko: "아직 몇 정거장 더 가야 해요?" },
          { zh: "还要坐四站吗？", pinyin: "hái yào zuò sì zhàn ma", ko: "아직 네 정거장 더 가야 해요?" },
        ],
        pitfall: "站은 여기서 역·정거장을 세는 단위처럼 쓰여요. 四个站보다 坐四站이 자연스러워요.",
        story: {
          body: [
            { narr: "대화 1 — 여행자가 공항 교통 창구에서 도심행 표를 사요." },
            { speaker: "旅行者", zh: "我要一张去市中心的票。", pinyin: "wǒ yào yì zhāng qù shì zhōngxīn de piào", ko: "도심행 표 한 장 주세요." },
            { speaker: "工作人员", zh: "单程还是往返？", pinyin: "dānchéng háishi wǎngfǎn", ko: "편도예요, 왕복이에요?" },
            { speaker: "旅行者", zh: "单程，谢谢。机场大巴几点开？", pinyin: "dānchéng, xièxie, jīchǎng dàbā jǐ diǎn kāi", ko: "편도로 주세요. 공항버스는 몇 시에 출발해요?" },
            { speaker: "工作人员", zh: "十点半开。", pinyin: "shí diǎn bàn kāi", ko: "10시 30분에 출발해요." },
            { narr: "대화 2 — 여행자가 지하철 안에서 환승 위치와 남은 정거장을 확인해요." },
            { speaker: "旅行者", zh: "请问，在哪儿换乘二号线？", pinyin: "qǐngwèn, zài nǎr huànchéng èr hào xiàn", ko: "실례지만, 어디에서 2호선으로 갈아타요?" },
            { speaker: "乘客", zh: "在中心站换乘。", pinyin: "zài zhōngxīn zhàn huànchéng", ko: "중심역에서 갈아타세요." },
            { speaker: "旅行者", zh: "还要坐几站？", pinyin: "hái yào zuò jǐ zhàn", ko: "아직 몇 정거장 더 가야 해요?" },
            { speaker: "乘客", zh: "还要坐两站。", pinyin: "hái yào zuò liǎng zhàn", ko: "두 정거장 더 가야 해요." },
          ],
          questions: [
            {
              id: "h1-18-scene-airport-ticket-transfer-sq1",
              type: "order",
              pattern: "我要一张去 + 장소 + 的票",
              q: "기차역행 표 한 장을 사도록 문장을 순서대로 놓아 보세요.",
              tiles: ["去火车站的票", "我要", "一张"],
              answer: ["我要", "一张", "去火车站的票"],
              ko: "기차역행 표 한 장 주세요.",
              why: "요청 我要 뒤에 수량 一张을 놓고, 去火车站的票로 목적지를 꾸며요.",
            },
            {
              id: "h1-18-scene-airport-ticket-transfer-sq2",
              type: "fill",
              pattern: "在哪儿换乘 + 노선",
              q: "어디에서 2호선으로 갈아타는지 물어보세요. 환승을 뜻하는 말을 채워 보세요.",
              zh: "在哪儿［　］二号线？",
              answer: "换乘",
              accept: ["换乘"],
              why: "换乘은 교통수단이나 노선을 바꾸어 탄다는 뜻이에요.",
            },
            {
              id: "h1-18-scene-airport-ticket-transfer-sq3",
              type: "produce",
              prompt: "도심행 왕복표 한 장을 사고, 공항버스 출발 시각도 확인해 보세요.",
              model: ["我要一张去市中心的往返票。机场大巴几点开？"],
              guide: "표 요청에는 一张과 往返票를, 시각 질문에는 几点开를 넣었는지 확인해요.",
            },
          ],
        },
      },
    ],
  },
  {
    slug: "h1-19-scene-lodging-checkin-checkout",
    level: "H1",
    order: 19,
    title: "\"예약했어요\" — 체크인하고 체크아웃하기",
    titleFr: "入住・退房",
    topic: "숙소 预订・几晚・办理・几点・寄存",
    summary: "예약과 숙박 일수를 확인하고, 체크인·체크아웃 시각과 짐 보관을 묻는 숙소 장면을 연습해요.",
    duration: "약 15분",
    sections: [
      {
        heading: "예약이 있다고 먼저 알려요",
        pattern: "我有一个预订",
        patternKo: "예약이 하나 있어요",
        body:
          "프런트에서 **我有一个预订 wǒ yǒu yí ge yùdìng**이라고 말하면 예약 확인을 시작할 수 있어요. 숙소에서는 뒤에 房间을 덧붙이지 않아도 뜻이 분명해요.\n\n" +
          "온라인 확인 화면을 함께 보여 주면 예약 정보를 더 빠르게 찾을 수 있어요.",
        examples: [
          { zh: "您好，我有一个预订。", pinyin: "nín hǎo, wǒ yǒu yí ge yùdìng", ko: "안녕하세요, 예약이 하나 있어요." },
          { zh: "我有一个酒店预订。", pinyin: "wǒ yǒu yí ge jiǔdiàn yùdìng", ko: "호텔 예약이 하나 있어요." },
        ],
        hanja: "预订의 번체는 預訂이에요. '미리 정해 둠', 즉 예약으로 연결돼요.",
      },
      {
        heading: "몇 박을 예약했는지 확인해요",
        pattern: "我订了 + 숫자 + 晚",
        patternKo: "~박을 예약했어요",
        body:
          "**订了 dìng le**는 '예약했다', **晚 wǎn**은 숙박 일수를 세는 '박'이에요. 两晚(2박), 三晚(3박)처럼 숫자와 晚을 바로 이어요.\n\n" +
          "날짜를 길게 설명하기 어렵다면 먼저 숙박 일수를 말해 예약을 좁힐 수 있어요.",
        examples: [
          { zh: "我订了两晚。", pinyin: "wǒ dìng le liǎng wǎn", ko: "2박을 예약했어요." },
          { zh: "我订了三晚。", pinyin: "wǒ dìng le sān wǎn", ko: "3박을 예약했어요." },
        ],
        pitfall: "숙박 수량에는 二보다 两를 써서 两晚이라고 말하는 것이 자연스러워요.",
      },
      {
        heading: "체크인과 체크아웃을 요청해요",
        pattern: "我想办理 + 入住/退房",
        patternKo: "체크인/체크아웃하고 싶어요",
        body:
          "**办理 bànlǐ**는 절차를 처리한다는 뜻이에요. 뒤에 入住(체크인)나 退房(체크아웃)을 붙이면 필요한 업무를 분명하게 말할 수 있어요.\n\n" +
          "더 짧게는 我想入住, 我想退房이라고 해도 되지만 办理를 넣으면 창구 표현답고 정중해요.",
        examples: [
          { zh: "我想办理入住。", pinyin: "wǒ xiǎng bànlǐ rùzhù", ko: "체크인하고 싶어요." },
          { zh: "我想办理退房。", pinyin: "wǒ xiǎng bànlǐ tuìfáng", ko: "체크아웃하고 싶어요." },
        ],
        hanja: "办理의 번체 辦理는 일을 처리한다는 뜻이에요. 入住는 들어가 묵고, 退房은 방에서 물러난다는 글자 그대로예요.",
      },
      {
        heading: "이용 시각을 물어요",
        pattern: "서비스/절차 + 是几点？",
        patternKo: "~은 몇 시예요?",
        body:
          "확인할 항목 뒤에 **是几点 shì jǐ diǎn**을 붙이면 시각을 물을 수 있어요. 早餐时间(조식 시간), 退房时间(체크아웃 시간)을 앞에 놓아요.\n\n" +
          "开始(시작하다)를 넣어 早餐几点开始처럼 물어도 자연스러워요.",
        examples: [
          { zh: "早餐时间是几点？", pinyin: "zǎocān shíjiān shì jǐ diǎn", ko: "조식 시간은 몇 시예요?" },
          { zh: "退房时间是几点？", pinyin: "tuìfáng shíjiān shì jǐ diǎn", ko: "체크아웃 시간은 몇 시예요?" },
        ],
        tip: "숫자로 답을 들으면 上午(오전)인지 下午(오후)인지 함께 확인하면 시각 착오를 줄일 수 있어요.",
      },
      {
        heading: "체크아웃 뒤 짐을 맡겨요",
        pattern: "可以寄存 + 물건 + 吗？",
        patternKo: "~을 보관해 주실 수 있나요?",
        body:
          "**寄存 jìcún**은 물건을 맡겨 보관한다는 뜻이에요. **可以…吗** 안에 넣으면 가능 여부를 공손하게 물을 수 있어요.\n\n" +
          "체크인 전이나 체크아웃 뒤에 行李(짐)를 맡기고 싶을 때 그대로 쓸 수 있어요.",
        examples: [
          { zh: "可以寄存行李吗？", pinyin: "kěyǐ jìcún xíngli ma", ko: "짐을 보관해 주실 수 있나요?" },
          { zh: "退房以后可以寄存行李吗？", pinyin: "tuìfáng yǐhòu kěyǐ jìcún xíngli ma", ko: "체크아웃 뒤에 짐을 보관해 주실 수 있나요?" },
        ],
        pitfall: "寄存은 호텔에 물건을 맡기는 상황에 쓰고, 사람에게 잠시 들어 달라는 뜻의 '맡다'와는 구별해요.",
        story: {
          body: [
            { narr: "대화 1 — 여행자가 프런트에서 예약을 확인하고 체크인해요." },
            { speaker: "旅行者", zh: "您好，我有一个预订。", pinyin: "nín hǎo, wǒ yǒu yí ge yùdìng", ko: "안녕하세요, 예약이 하나 있어요." },
            { speaker: "工作人员", zh: "您订了几晚？", pinyin: "nín dìng le jǐ wǎn", ko: "몇 박을 예약하셨어요?" },
            { speaker: "旅行者", zh: "我订了两晚。我想办理入住。", pinyin: "wǒ dìng le liǎng wǎn, wǒ xiǎng bànlǐ rùzhù", ko: "2박을 예약했어요. 체크인하고 싶어요." },
            { speaker: "工作人员", zh: "好的，请给我看您的预订确认。", pinyin: "hǎo de, qǐng gěi wǒ kàn nín de yùdìng quèrèn", ko: "네, 예약 확인서를 보여 주세요." },
            { narr: "대화 2 — 여행자가 다음 날 체크아웃 시각과 짐 보관을 확인해요." },
            { speaker: "旅行者", zh: "明天退房时间是几点？", pinyin: "míngtiān tuìfáng shíjiān shì jǐ diǎn", ko: "내일 체크아웃 시간은 몇 시예요?" },
            { speaker: "工作人员", zh: "中午十二点。", pinyin: "zhōngwǔ shí'èr diǎn", ko: "낮 12시예요." },
            { speaker: "旅行者", zh: "退房以后可以寄存行李吗？", pinyin: "tuìfáng yǐhòu kěyǐ jìcún xíngli ma", ko: "체크아웃 뒤에 짐을 보관해 주실 수 있나요?" },
            { speaker: "工作人员", zh: "可以寄存行李。", pinyin: "kěyǐ jìcún xíngli", ko: "짐을 보관하실 수 있어요." },
          ],
          questions: [
            {
              id: "h1-19-scene-lodging-checkin-checkout-sq1",
              type: "order",
              pattern: "我想办理 + 入住",
              q: "프런트에서 체크인하고 싶다고 말하도록 문장을 순서대로 놓아 보세요.",
              tiles: ["入住", "我想", "办理"],
              answer: ["我想", "办理", "入住"],
              ko: "체크인하고 싶어요.",
              why: "我想 뒤에 절차 동사 办理와 업무 入住를 차례로 놓아요.",
            },
            {
              id: "h1-19-scene-lodging-checkin-checkout-sq2",
              type: "fill",
              pattern: "我订了 + 숫자 + 晚",
              q: "2박을 예약했다고 알려 주세요. 숙박 수를 세는 말을 채워 보세요.",
              zh: "我订了两［　］。",
              answer: "晚",
              accept: ["晚"],
              why: "호텔 숙박 일수는 晚으로 세어 两晚이라고 해요.",
            },
            {
              id: "h1-19-scene-lodging-checkin-checkout-sq3",
              type: "produce",
              prompt: "체크아웃한 뒤 짐을 맡기고 싶어요. 요청과 질문을 중국어 두 문장으로 말해 보세요.",
              model: ["我想办理退房。可以寄存行李吗？"],
              guide: "첫 문장에는 退房, 둘째 문장에는 可以寄存行李吗를 넣었는지 확인해요.",
            },
          ],
        },
      },
    ],
  },
  {
    slug: "h1-20-scene-lodging-requests-problems",
    level: "H1",
    order: 20,
    title: "\"수건을 더 주세요\" — 요청하고 문제 알리기",
    titleFr: "客房请求・问题报告",
    topic: "숙소 再给・告诉・不能用・没有・换",
    summary: "수건과 와이파이 정보를 요청하고, 객실에 없거나 작동하지 않는 것을 알린 뒤 교체를 부탁하는 장면을 연습해요.",
    duration: "약 15분",
    sections: [
      {
        heading: "필요한 물건을 더 요청해요",
        pattern: "请再给我 + 수량 + 물건",
        patternKo: "~을 더 주세요",
        body:
          "**请 qǐng**으로 공손하게 시작하고 **再给我 zài gěi wǒ** 뒤에 필요한 수량과 물건을 놓아요. 再는 여기서 '하나 더, 추가로'라는 뜻이에요.\n\n" +
          "수건은 条, 생수병은 瓶처럼 물건에 맞는 양사를 함께 써요.",
        examples: [
          { zh: "请再给我两条毛巾。", pinyin: "qǐng zài gěi wǒ liǎng tiáo máojīn", ko: "수건 두 장을 더 주세요." },
          { zh: "请再给我一瓶水。", pinyin: "qǐng zài gěi wǒ yì píng shuǐ", ko: "생수 한 병을 더 주세요." },
        ],
        pitfall: "수건은 条, 병에 든 물은 瓶으로 세어요. 숫자와 명사 사이의 양사를 빼지 않아요.",
      },
      {
        heading: "와이파이 정보를 물어요",
        pattern: "可以告诉我 + 정보 + 吗？",
        patternKo: "~을 알려 주실 수 있나요?",
        body:
          "**告诉 gàosu**는 '알려 주다'예요. **可以…吗** 안에 넣고 알고 싶은 정보를 뒤에 놓으면 공손한 질문이 돼요.\n\n" +
          "无线网密码(와이파이 비밀번호), 早餐地点(조식 장소)처럼 정보 이름만 바꾸어 쓸 수 있어요.",
        examples: [
          { zh: "可以告诉我无线网密码吗？", pinyin: "kěyǐ gàosu wǒ wúxiànwǎng mìmǎ ma", ko: "와이파이 비밀번호를 알려 주실 수 있나요?" },
          { zh: "可以告诉我早餐地点吗？", pinyin: "kěyǐ gàosu wǒ zǎocān dìdiǎn ma", ko: "조식 장소를 알려 주실 수 있나요?" },
        ],
        hanja: "密码 mìmǎ의 번체는 密碼로 비밀번호예요. 地点 dìdiǎn은 **지점(地點)**과 같은 뜻이에요.",
      },
      {
        heading: "작동하지 않는 것을 알려요",
        pattern: "시설/물건 + 不能用",
        patternKo: "~을 사용할 수 없어요",
        body:
          "**不能用 bù néng yòng**은 '사용할 수 없다'예요. 작동하지 않는 시설이나 물건을 문장 앞에 놓으면 객실 문제를 바로 전달할 수 있어요.\n\n" +
          "왜 고장 났는지 설명하기 어려워도 空调不能用처럼 증상만 말하면 직원이 확인할 수 있어요.",
        examples: [
          { zh: "空调不能用。", pinyin: "kōngtiáo bù néng yòng", ko: "에어컨을 사용할 수 없어요." },
          { zh: "房间里的电话不能用。", pinyin: "fángjiān li de diànhuà bù néng yòng", ko: "객실 전화기를 사용할 수 없어요." },
        ],
        tip: "작동하지 않을 때는 不能用, 사용법을 모를 때는 我不会用이라고 구별하면 좋아요.",
      },
      {
        heading: "객실에 없는 것을 말해요",
        pattern: "房间里没有 + 물건",
        patternKo: "객실에 ~이 없어요",
        body:
          "**房间里 fángjiān li**는 '객실 안에', **没有 méiyǒu**는 '없다'예요. 필요한 비품이 보이지 않을 때 물건 이름을 뒤에 붙여요.\n\n" +
          "장소 + 没有 + 물건 순서로 존재하지 않는 것을 말해요.",
        examples: [
          { zh: "房间里没有热水。", pinyin: "fángjiān li méiyǒu rèshuǐ", ko: "객실에 온수가 없어요." },
          { zh: "房间里没有衣架。", pinyin: "fángjiān li méiyǒu yīguà", ko: "객실에 옷걸이가 없어요." },
        ],
        vsKo: "한국어 '객실에 온수가 없어요'와 큰 순서는 같아요. 장소 뒤에 바로 没有를 놓아요.",
      },
      {
        heading: "객실이나 물건 교체를 부탁해요",
        pattern: "可以给我换 + 대상 + 吗？",
        patternKo: "~을 바꿔 주실 수 있나요?",
        body:
          "**换 huàn**은 '바꾸다·교체하다'예요. **给我换** 뒤에 원하는 대상을 놓고 吗로 끝내면 교체 요청이 돼요.\n\n" +
          "객실은 一个房间, 수건은 一条毛巾처럼 수량과 양사를 포함해 말하면 요청이 구체적이에요.",
        examples: [
          { zh: "可以给我换一个房间吗？", pinyin: "kěyǐ gěi wǒ huàn yí ge fángjiān ma", ko: "객실을 바꿔 주실 수 있나요?" },
          { zh: "可以给我换一条毛巾吗？", pinyin: "kěyǐ gěi wǒ huàn yì tiáo máojīn ma", ko: "수건 한 장을 바꿔 주실 수 있나요?" },
        ],
        hanja: "换의 번체 換은 **바꿀 환(換)**이에요. 交换(교환), 换乘(환승)에도 같은 뜻이 이어져요.",
        story: {
          body: [
            { narr: "대화 1 — 여행자가 객실 비품과 와이파이 정보를 요청해요." },
            { speaker: "旅行者", zh: "请再给我两条毛巾。", pinyin: "qǐng zài gěi wǒ liǎng tiáo máojīn", ko: "수건 두 장을 더 주세요." },
            { speaker: "工作人员", zh: "好的，还需要什么吗？", pinyin: "hǎo de, hái xūyào shénme ma", ko: "네, 더 필요한 것이 있으세요?" },
            { speaker: "旅行者", zh: "可以告诉我无线网密码吗？", pinyin: "kěyǐ gàosu wǒ wúxiànwǎng mìmǎ ma", ko: "와이파이 비밀번호를 알려 주실 수 있나요?" },
            { speaker: "工作人员", zh: "可以，密码写在这张卡上。", pinyin: "kěyǐ, mìmǎ xiě zài zhè zhāng kǎ shàng", ko: "네, 비밀번호가 이 카드에 적혀 있어요." },
            { narr: "대화 2 — 에어컨과 온수 문제를 알리고 객실 교체를 요청해요." },
            { speaker: "旅行者", zh: "空调不能用，房间里也没有热水。", pinyin: "kōngtiáo bù néng yòng, fángjiān li yě méiyǒu rèshuǐ", ko: "에어컨을 사용할 수 없고 객실에 온수도 없어요." },
            { speaker: "工作人员", zh: "对不起，我们马上检查。", pinyin: "duìbuqǐ, wǒmen mǎshàng jiǎnchá", ko: "죄송합니다. 바로 확인할게요." },
            { speaker: "旅行者", zh: "可以给我换一个房间吗？", pinyin: "kěyǐ gěi wǒ huàn yí ge fángjiān ma", ko: "객실을 바꿔 주실 수 있나요?" },
            { speaker: "工作人员", zh: "可以，请稍等。", pinyin: "kěyǐ, qǐng shāo děng", ko: "네, 잠시만 기다려 주세요." },
          ],
          questions: [
            {
              id: "h1-20-scene-lodging-requests-problems-sq1",
              type: "order",
              pattern: "请再给我 + 수량 + 물건",
              q: "수건 두 장을 더 요청하도록 문장을 순서대로 놓아 보세요.",
              tiles: ["两条毛巾", "请", "再给我"],
              answer: ["请", "再给我", "两条毛巾"],
              ko: "수건 두 장을 더 주세요.",
              why: "请 뒤에 추가 요청 再给我와 수량·물건 两条毛巾을 놓아요.",
            },
            {
              id: "h1-20-scene-lodging-requests-problems-sq2",
              type: "fill",
              pattern: "시설 + 不能用",
              q: "에어컨을 사용할 수 없다고 알려 주세요. 가능하지 않다는 말을 채워 보세요.",
              zh: "空调［　］。",
              answer: "不能用",
              accept: ["不能用"],
              why: "不能用은 시설이나 물건을 사용할 수 없다는 뜻이에요.",
            },
            {
              id: "h1-20-scene-lodging-requests-problems-sq3",
              type: "produce",
              prompt: "객실에 온수가 없어요. 문제를 알리고 객실 교체를 공손하게 부탁해 보세요.",
              model: ["房间里没有热水。可以给我换一个房间吗？"],
              guide: "문제에는 房间里没有热水, 요청에는 可以给我换一个房间吗를 넣었는지 확인해요.",
            },
          ],
        },
      },
    ],
  },
  {
    slug: "h1-21-scene-restaurant-order-recommendation",
    level: "H1",
    order: 21,
    title: "\"추천 메뉴가 뭐예요?\" — 고르고 주문하기",
    titleFr: "推荐・点餐",
    topic: "식당 想要・给我・推荐・辣吗・就要",
    summary: "먹고 싶은 메뉴와 수량을 말하고, 추천과 맛을 확인한 뒤 선택을 확정하는 식당 장면을 연습해요.",
    duration: "약 15분",
    sections: [
      {
        heading: "먹고 싶은 메뉴를 말해요",
        pattern: "我想要 + 음식/음료",
        patternKo: "~을 먹고/마시고 싶어요",
        body:
          "**我想要 wǒ xiǎng yào**는 원하는 것을 부드럽게 말하는 표현이에요. 뒤에 음식이나 음료 이름을 놓으면 주문의 뼈대가 돼요.\n\n" +
          "想要를 함께 쓰면 원하는 메뉴나 물건이 있다는 뜻이 선명해요.",
        examples: [
          { zh: "我想要番茄炒蛋。", pinyin: "wǒ xiǎng yào fānqié chǎodàn", ko: "토마토 달걀볶음을 먹고 싶어요." },
          { zh: "我想要一杯茶。", pinyin: "wǒ xiǎng yào yì bēi chá", ko: "차 한 잔을 마시고 싶어요." },
        ],
        pitfall: "메뉴 이름 앞에 是를 넣지 않아요. 주문은 我想要 + 메뉴 순서로 바로 이어요.",
      },
      {
        heading: "수량까지 정확히 주문해요",
        pattern: "请给我 + 숫자 + 양사 + 메뉴",
        patternKo: "~을 몇 개/그릇/잔 주세요",
        body:
          "**请给我 qǐng gěi wǒ** 뒤에 숫자·양사·메뉴를 놓으면 수량이 분명한 주문이 돼요. 밥은 碗(그릇), 차는 杯(잔)로 세어요.\n\n" +
          "중국어 수량 표현은 숫자와 명사 사이에 양사가 꼭 들어가요.",
        examples: [
          { zh: "请给我一碗米饭。", pinyin: "qǐng gěi wǒ yì wǎn mǐfàn", ko: "밥 한 그릇 주세요." },
          { zh: "请给我们两杯茶。", pinyin: "qǐng gěi wǒmen liǎng bēi chá", ko: "저희에게 차 두 잔 주세요." },
        ],
        vsKo: "한국어도 '밥 한 그릇, 차 두 잔'처럼 단위를 쓰지만 중국어는 숫자 + 양사 + 명사 순서를 더 엄격하게 지켜요.",
      },
      {
        heading: "추천 메뉴를 물어요",
        pattern: "有什么推荐的？",
        patternKo: "추천할 만한 것이 뭐예요?",
        body:
          "**有什么 yǒu shénme**는 '무엇이 있나요', **推荐的 tuījiàn de**는 '추천할 만한 것'이에요. 메뉴를 잘 모를 때 통째로 질문하면 돼요.\n\n" +
          "채식 메뉴처럼 범위를 좁히려면 有什么推荐的素菜吗처럼 원하는 종류를 덧붙여요.",
        examples: [
          { zh: "请问，有什么推荐的？", pinyin: "qǐngwèn, yǒu shénme tuījiàn de", ko: "실례지만, 추천할 만한 것이 뭐예요?" },
          { zh: "有什么推荐的素菜吗？", pinyin: "yǒu shénme tuījiàn de sùcài ma", ko: "추천할 만한 채소 요리가 있나요?" },
        ],
        hanja: "推荐의 번체는 推薦으로 **추천(推薦)**과 같은 글자예요. 메뉴에서 推荐이라고 보이면 권하는 음식이에요.",
      },
      {
        heading: "맛이 어떤지 확인해요",
        pattern: "这个 + 맛 형용사 + 吗？",
        patternKo: "이것은 ~한가요?",
        body:
          "**这个 zhège** 뒤에 辣(맵다), 甜(달다), 咸(짜다) 같은 맛 형용사를 놓고 吗를 붙여요. 주문 전에 먹을 수 있는 맛인지 확인할 수 있어요.\n\n" +
          "중국어 형용사는 술어가 되므로 是를 넣지 않고 这个辣吗라고 말해요.",
        examples: [
          { zh: "这个辣吗？", pinyin: "zhège là ma", ko: "이것은 매워요?" },
          { zh: "这个汤咸吗？", pinyin: "zhège tāng xián ma", ko: "이 국은 짜요?" },
        ],
        pitfall: "这个是辣吗(×)처럼 是를 넣지 않아요. 맛 형용사 辣·甜·咸이 바로 술어가 돼요.",
      },
      {
        heading: "고른 메뉴로 주문을 확정해요",
        pattern: "就要 + 지시한 메뉴",
        patternKo: "바로 이것으로 할게요",
        body:
          "**就 jiù**는 선택을 딱 정하는 느낌이고, **要 yào**는 원한다는 뜻이에요. 메뉴를 가리키며 就要这个라고 하면 '이것으로 할게요'가 돼요.\n\n" +
          "여러 메뉴를 골랐다면 就要这两个菜처럼 수량과 메뉴 종류를 함께 말할 수 있어요.",
        examples: [
          { zh: "好，就要这个。", pinyin: "hǎo, jiù yào zhège", ko: "좋아요, 이것으로 할게요." },
          { zh: "我们就要这两个菜。", pinyin: "wǒmen jiù yào zhè liǎng ge cài", ko: "저희는 이 두 가지 요리로 할게요." },
        ],
        tip: "추천을 들은 뒤 好，就要这个라고 답하면 이해와 선택을 한 번에 전달할 수 있어요.",
        story: {
          body: [
            { narr: "대화 1 — 여행자가 메뉴를 잘 몰라 추천과 매운맛을 확인해요." },
            { speaker: "旅行者", zh: "请问，有什么推荐的？", pinyin: "qǐngwèn, yǒu shénme tuījiàn de", ko: "실례지만, 추천할 만한 것이 뭐예요?" },
            { speaker: "工作人员", zh: "番茄炒蛋很受欢迎。", pinyin: "fānqié chǎodàn hěn shòu huānyíng", ko: "토마토 달걀볶음이 인기가 많아요." },
            { speaker: "旅行者", zh: "这个辣吗？", pinyin: "zhège là ma", ko: "이것은 매워요?" },
            { speaker: "工作人员", zh: "不辣。", pinyin: "bú là", ko: "맵지 않아요." },
            { narr: "대화 2 — 여행자가 음식과 음료의 수량을 말하고 주문을 확정해요." },
            { speaker: "旅行者", zh: "我想要番茄炒蛋。请给我们两碗米饭。", pinyin: "wǒ xiǎng yào fānqié chǎodàn, qǐng gěi wǒmen liǎng wǎn mǐfàn", ko: "토마토 달걀볶음을 먹고 싶어요. 밥 두 그릇 주세요." },
            { speaker: "工作人员", zh: "还要喝什么？", pinyin: "hái yào hē shénme", ko: "마실 것은 더 필요하세요?" },
            { speaker: "旅行者", zh: "请给我们两杯茶。就要这些。", pinyin: "qǐng gěi wǒmen liǎng bēi chá, jiù yào zhèxiē", ko: "차 두 잔 주세요. 이것들로 할게요." },
            { speaker: "工作人员", zh: "好的，请稍等。", pinyin: "hǎo de, qǐng shāo děng", ko: "네, 잠시만 기다려 주세요." },
          ],
          questions: [
            {
              id: "h1-21-scene-restaurant-order-recommendation-sq1",
              type: "order",
              pattern: "请给我 + 숫자 + 양사 + 메뉴",
              q: "밥 한 그릇을 주문하도록 문장을 순서대로 놓아 보세요.",
              tiles: ["一碗", "请给我", "米饭"],
              answer: ["请给我", "一碗", "米饭"],
              ko: "밥 한 그릇 주세요.",
              why: "请给我 뒤에 수량·양사 一碗과 메뉴 米饭을 차례로 놓아요.",
            },
            {
              id: "h1-21-scene-restaurant-order-recommendation-sq2",
              type: "fill",
              pattern: "有什么推荐的？",
              q: "추천할 만한 것이 무엇인지 물어보세요. 추천을 뜻하는 말을 채워 보세요.",
              zh: "有什么［　］的？",
              answer: "推荐",
              accept: ["推荐"],
              why: "推荐的는 추천할 만한 것을 가리켜요.",
            },
            {
              id: "h1-21-scene-restaurant-order-recommendation-sq3",
              type: "produce",
              prompt: "추천 메뉴가 매운지 확인한 뒤, 맵지 않다면 그것으로 주문해 보세요.",
              model: ["这个辣吗？好，就要这个。"],
              guide: "맛 질문에는 这个辣吗, 선택 확정에는 就要这个을 넣었는지 확인해요.",
            },
          ],
        },
      },
    ],
  },
  {
    slug: "h1-22-scene-restaurant-bill-dietary",
    level: "H1",
    order: 22,
    title: "\"이 재료는 빼 주세요\" — 식사 조건과 계산",
    titleFr: "饮食要求・结账",
    topic: "식당 账单・付款・分开结账・有…吗・不要放",
    summary: "알레르기 재료와 제외 요청을 분명히 말하고, 계산서·결제 수단·나눠 계산하기를 확인하는 식당 장면을 연습해요.",
    duration: "약 15분",
    sections: [
      {
        heading: "계산서를 요청해요",
        pattern: "请给我账单",
        patternKo: "계산서를 주세요",
        body:
          "식사를 마치면 **请给我账单 qǐng gěi wǒ zhàngdān**이라고 계산서를 요청해요. 짧고 공손해서 식당에서 바로 쓸 수 있어요.\n\n" +
          "买单이라고 짧게 말하기도 하지만 초급 단계에서는 문장이 완전한 请给我账单이 안전해요.",
        examples: [
          { zh: "请给我账单。", pinyin: "qǐng gěi wǒ zhàngdān", ko: "계산서를 주세요." },
          { zh: "服务员，请给我们账单。", pinyin: "fúwùyuán, qǐng gěi wǒmen zhàngdān", ko: "직원분, 저희에게 계산서를 주세요." },
        ],
        hanja: "账单의 번체는 賬單이에요. 单은 목록이나 표를 뜻해 계산 내역이 적힌 문서라는 의미로 연결돼요.",
      },
      {
        heading: "결제 수단이 되는지 물어요",
        pattern: "可以用 + 결제 수단 + 付款吗？",
        patternKo: "~로 결제할 수 있나요?",
        body:
          "**用 yòng** 뒤에 결제 수단을 놓고 **付款 fùkuǎn**으로 끝내면 무엇으로 낼지 물을 수 있어요. 银行卡(카드), 现金(현금)을 바꾸어 써요.\n\n" +
          "가능 여부를 묻는 可以…吗 틀 안에 넣으면 정중한 결제 질문이 돼요.",
        examples: [
          { zh: "可以用银行卡付款吗？", pinyin: "kěyǐ yòng yínhángkǎ fùkuǎn ma", ko: "카드로 결제할 수 있나요?" },
          { zh: "可以用现金付款吗？", pinyin: "kěyǐ yòng xiànjīn fùkuǎn ma", ko: "현금으로 결제할 수 있나요?" },
        ],
        hanja: "现金의 번체 現金은 **현금(現金)**과 같은 글자라 바로 알아볼 수 있어요.",
      },
      {
        heading: "각자 계산할 수 있는지 물어요",
        pattern: "可以分开结账吗？",
        patternKo: "나누어 계산할 수 있나요?",
        body:
          "**分开 fēnkāi**는 '나누다·따로', **结账 jiézhàng**은 '계산을 마치다'예요. 함께 쓰면 나누어 계산할 수 있는지 묻게 돼요.\n\n" +
          "인원별 결제를 원하면 我们想分开结账이라고 의사를 먼저 말해도 돼요.",
        examples: [
          { zh: "可以分开结账吗？", pinyin: "kěyǐ fēnkāi jiézhàng ma", ko: "나누어 계산할 수 있나요?" },
          { zh: "我们想分开结账。", pinyin: "wǒmen xiǎng fēnkāi jiézhàng", ko: "저희는 나누어 계산하고 싶어요." },
        ],
        pitfall: "分开는 '따로'라는 뜻이고 免费(무료)와는 관계가 없어요. 分开结账은 계산을 나눈다는 말이에요.",
      },
      {
        heading: "알레르기 재료가 있는지 확인해요",
        pattern: "这个菜里有 + 재료 + 吗？",
        patternKo: "이 요리에 ~이 들어 있나요?",
        body:
          "**这个菜里 zhège cài li**는 '이 요리 안에', **有…吗**는 '~이 있나요?'예요. 알레르기가 있는 재료를 가운데 넣어 조리 전에 확인해요.\n\n" +
          "알레르기 사실을 먼저 말한 뒤 같은 재료를 질문에 넣으면 요청의 이유가 더 분명해요.",
        examples: [
          { zh: "我对花生过敏。这个菜里有花生吗？", pinyin: "wǒ duì huāshēng guòmǐn, zhège cài li yǒu huāshēng ma", ko: "저는 땅콩 알레르기가 있어요. 이 요리에 땅콩이 들어 있나요?" },
          { zh: "这个汤里有牛奶吗？", pinyin: "zhège tāng li yǒu niúnǎi ma", ko: "이 국에 우유가 들어 있나요?" },
        ],
        pitfall: "알레르기는 선호가 아니라 안전 정보예요. 我对…过敏으로 먼저 알리고 有…吗로 재료 포함 여부를 다시 확인해요.",
      },
      {
        heading: "먹지 못하는 재료를 빼 달라고 해요",
        pattern: "请不要放 + 재료",
        patternKo: "~을 넣지 말아 주세요",
        body:
          "**请不要 qǐng bú yào**는 공손한 제외 요청이고, **放 fàng**은 재료를 '넣다'라는 뜻이에요. 뒤에 빼야 할 재료를 놓아요.\n\n" +
          "메뉴를 주문할 때 바로 말하면 조리 전에 요청을 전달할 수 있어요.",
        examples: [
          { zh: "请不要放花生。", pinyin: "qǐng bú yào fàng huāshēng", ko: "땅콩을 넣지 말아 주세요." },
          { zh: "请不要放香菜。", pinyin: "qǐng bú yào fàng xiāngcài", ko: "고수를 넣지 말아 주세요." },
        ],
        vsKo: "한국어 '땅콩은 빼 주세요'와 달리 중국어는 不要放, 즉 '넣지 말다'라는 동작으로 요청을 만들어요.",
        story: {
          body: [
            { narr: "대화 1 — 여행자가 알레르기를 알리고 재료 제외를 요청해요." },
            { speaker: "旅行者", zh: "我对花生过敏。这个菜里有花生吗？", pinyin: "wǒ duì huāshēng guòmǐn, zhège cài li yǒu huāshēng ma", ko: "저는 땅콩 알레르기가 있어요. 이 요리에 땅콩이 들어 있나요?" },
            { speaker: "工作人员", zh: "有一点。", pinyin: "yǒu yìdiǎn", ko: "조금 들어 있어요." },
            { speaker: "旅行者", zh: "请不要放花生。", pinyin: "qǐng bú yào fàng huāshēng", ko: "땅콩을 넣지 말아 주세요." },
            { speaker: "工作人员", zh: "好的，我们可以不放花生。", pinyin: "hǎo de, wǒmen kěyǐ bú fàng huāshēng", ko: "네, 땅콩을 넣지 않을 수 있어요." },
            { narr: "대화 2 — 식사를 마친 여행자들이 계산서와 결제 방법을 확인해요." },
            { speaker: "旅行者", zh: "请给我们账单。可以分开结账吗？", pinyin: "qǐng gěi wǒmen zhàngdān, kěyǐ fēnkāi jiézhàng ma", ko: "저희에게 계산서를 주세요. 나누어 계산할 수 있나요?" },
            { speaker: "工作人员", zh: "可以。", pinyin: "kěyǐ", ko: "네." },
            { speaker: "旅行者", zh: "可以用银行卡付款吗？", pinyin: "kěyǐ yòng yínhángkǎ fùkuǎn ma", ko: "카드로 결제할 수 있나요?" },
            { speaker: "工作人员", zh: "可以，请在这里付款。", pinyin: "kěyǐ, qǐng zài zhèli fùkuǎn", ko: "네, 여기에서 결제해 주세요." },
          ],
          questions: [
            {
              id: "h1-22-scene-restaurant-bill-dietary-sq1",
              type: "order",
              pattern: "请不要放 + 재료",
              q: "땅콩을 넣지 말아 달라고 요청하도록 문장을 순서대로 놓아 보세요.",
              tiles: ["花生", "请", "不要放"],
              answer: ["请", "不要放", "花生"],
              ko: "땅콩을 넣지 말아 주세요.",
              why: "请 뒤에 금지 동작 不要放과 제외 재료 花生을 놓아요.",
            },
            {
              id: "h1-22-scene-restaurant-bill-dietary-sq2",
              type: "fill",
              pattern: "可以分开结账吗？",
              q: "각자 계산할 수 있는지 물어보세요. '나누어'에 해당하는 말을 채워 보세요.",
              zh: "可以［　］结账吗？",
              answer: "分开",
              accept: ["分开"],
              why: "分开는 함께 있는 것을 따로 나눈다는 뜻이라 分开结账이 '나누어 계산하다'가 돼요.",
            },
            {
              id: "h1-22-scene-restaurant-bill-dietary-sq3",
              type: "produce",
              prompt: "우유를 먹을 수 없어요. 이 국에 우유가 있는지 확인하고 빼 달라고 요청해 보세요.",
              model: ["这个汤里有牛奶吗？请不要放牛奶。"],
              guide: "재료 확인에는 有牛奶吗, 제외 요청에는 请不要放牛奶를 넣었는지 확인해요.",
            },
          ],
        },
      },
    ],
  },
];

export default chapters;
