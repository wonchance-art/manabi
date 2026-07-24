/**
 * DRAFT — 중국어 생활 어휘 확충 후보 15세트.
 *
 * 콘텐츠 정본은 Claude 소유다. 표현·번역·난이도·레벨 배치는 Claude 검수 후 확정하며,
 * 검수 전에는 src/content/chinese/index.js 등 기존 소비 경로에 연결하지 않는다.
 */
const draftExpansion = {
  level: "DRAFT",
  title: "중국어 생활 어휘 확충 초안",
  desc: "여행·일상·학습·업무 상황을 위한 15세트 초안이에요. Claude 검수 전에는 학습 콘텐츠로 배포하지 않아요.",
  themes: [
    {
      name: "공항 환승",
      words: [
        {
          zh: "国际转机", pinyin: "guójì zhuǎnjī", ko: "국제선 환승", pos: "명사",
          hanja: "국제(國際)는 한국어 한자음과 뜻이 그대로 이어져요.",
          ex: { zh: "我们在这里办理国际转机。", pinyin: "wǒmen zài zhèlǐ bànlǐ guójì zhuǎnjī", ko: "우리는 여기서 국제선 환승 수속을 해요." },
        },
        {
          zh: "转机柜台", pinyin: "zhuǎnjī guìtái", ko: "환승 카운터", pos: "명사",
          ex: { zh: "请去转机柜台确认登机口。", pinyin: "qǐng qù zhuǎnjī guìtái quèrèn dēngjīkǒu", ko: "환승 카운터에 가서 탑승구를 확인해 주세요." },
        },
        {
          zh: "行李直挂", pinyin: "xíngli zhíguà", ko: "수하물 연결 수속", pos: "명사",
          ex: { zh: "这趟航班可以办理行李直挂。", pinyin: "zhè tàng hángbān kěyǐ bànlǐ xíngli zhíguà", ko: "이 항공편은 수하물 연결 수속을 할 수 있어요." },
        },
        {
          zh: "登机口变更", pinyin: "dēngjīkǒu biàngēng", ko: "탑승구 변경", pos: "명사",
          ex: { zh: "屏幕上显示登机口变更。", pinyin: "píngmù shàng xiǎnshì dēngjīkǒu biàngēng", ko: "화면에 탑승구 변경이 표시돼요." },
        },
        {
          zh: "航班延误", pinyin: "hángbān yánwù", ko: "항공편 지연", pos: "명사",
          ex: { zh: "因为大雨，航班延误了一个小时。", pinyin: "yīnwèi dàyǔ, hángbān yánwù le yí ge xiǎoshí", ko: "큰비 때문에 항공편이 한 시간 지연됐어요." },
        },
        {
          zh: "电子登机牌", pinyin: "diànzǐ dēngjīpái", ko: "전자 탑승권", pos: "명사",
          hanja: "전자(電子)는 글자와 뜻이 한국어와 같아요.",
          ex: { zh: "我把电子登机牌存到手机里了。", pinyin: "wǒ bǎ diànzǐ dēngjīpái cún dào shǒujī lǐ le", ko: "전자 탑승권을 휴대전화에 저장했어요." },
        },
        {
          zh: "随身行李", pinyin: "suíshēn xíngli", ko: "휴대 수하물", pos: "명사",
          ex: { zh: "随身行李请放在座位下面。", pinyin: "suíshēn xíngli qǐng fàng zài zuòwèi xiàmiàn", ko: "휴대 수하물은 좌석 아래에 놓아 주세요." },
        },
        {
          zh: "安检通道", pinyin: "ānjiǎn tōngdào", ko: "보안 검색 통로", pos: "명사",
          ex: { zh: "这条安检通道排队的人比较少。", pinyin: "zhè tiáo ānjiǎn tōngdào páiduì de rén bǐjiào shǎo", ko: "이 보안 검색 통로는 줄을 선 사람이 비교적 적어요." },
        },
        {
          zh: "入境卡", pinyin: "rùjìngkǎ", ko: "입국 카드", pos: "명사",
          ex: { zh: "请在落地前填好入境卡。", pinyin: "qǐng zài luòdì qián tián hǎo rùjìngkǎ", ko: "착륙하기 전에 입국 카드를 작성해 주세요." },
        },
      ],
    },
    {
      name: "숙소 도착",
      words: [
        {
          zh: "预订确认单", pinyin: "yùdìng quèrèndān", ko: "예약 확인서", pos: "명사",
          hanja: "확인(確認)은 한국어와 글자 순서도 같아요.",
          ex: { zh: "入住时请出示预订确认单。", pinyin: "rùzhù shí qǐng chūshì yùdìng quèrèndān", ko: "입실할 때 예약 확인서를 보여 주세요." },
        },
        {
          zh: "提前入住", pinyin: "tíqián rùzhù", ko: "조기 체크인", pos: "명사",
          ex: { zh: "今天可以提前入住吗？", pinyin: "jīntiān kěyǐ tíqián rùzhù ma", ko: "오늘 일찍 체크인할 수 있나요?" },
        },
        {
          zh: "延迟退房", pinyin: "yánchí tuìfáng", ko: "늦은 체크아웃", pos: "명사",
          ex: { zh: "我想申请延迟退房。", pinyin: "wǒ xiǎng shēnqǐng yánchí tuìfáng", ko: "늦은 체크아웃을 신청하고 싶어요." },
        },
        {
          zh: "双床房", pinyin: "shuāngchuángfáng", ko: "트윈룸", pos: "명사",
          ex: { zh: "我们预订了一间双床房。", pinyin: "wǒmen yùdìng le yì jiān shuāngchuángfáng", ko: "우리는 트윈룸 한 개를 예약했어요." },
        },
        {
          zh: "大床房", pinyin: "dàchuángfáng", ko: "큰 침대가 있는 객실", pos: "명사",
          ex: { zh: "今晚还有大床房吗？", pinyin: "jīnwǎn hái yǒu dàchuángfáng ma", ko: "오늘 밤 큰 침대가 있는 객실이 남아 있나요?" },
        },
        {
          zh: "无烟房", pinyin: "wúyānfáng", ko: "금연실", pos: "명사",
          ex: { zh: "请给我安排无烟房。", pinyin: "qǐng gěi wǒ ānpái wúyānfáng", ko: "금연실로 배정해 주세요." },
        },
        {
          zh: "房卡", pinyin: "fángkǎ", ko: "객실 카드키", pos: "명사",
          ex: { zh: "我的房卡打不开门。", pinyin: "wǒ de fángkǎ dǎ bu kāi mén", ko: "제 객실 카드키로 문이 열리지 않아요." },
        },
        {
          zh: "行李寄存处", pinyin: "xíngli jìcúnchù", ko: "수하물 보관소", pos: "명사",
          ex: { zh: "退房后可以把行李放在行李寄存处。", pinyin: "tuìfáng hòu kěyǐ bǎ xíngli fàng zài xíngli jìcúnchù", ko: "체크아웃한 뒤 수하물을 보관소에 맡길 수 있어요." },
        },
        {
          zh: "前台服务", pinyin: "qiántái fúwù", ko: "프런트 서비스", pos: "명사",
          ex: { zh: "前台服务到晚上十点。", pinyin: "qiántái fúwù dào wǎnshang shí diǎn", ko: "프런트 서비스는 밤 열 시까지예요." },
        },
      ],
    },
    {
      name: "대중교통",
      words: [
        {
          zh: "换乘通道", pinyin: "huànchéng tōngdào", ko: "환승 통로", pos: "명사",
          ex: { zh: "请沿着换乘通道走。", pinyin: "qǐng yánzhe huànchéng tōngdào zǒu", ko: "환승 통로를 따라가 주세요." },
        },
        {
          zh: "末班地铁", pinyin: "mòbān dìtiě", ko: "지하철 막차", pos: "명사",
          ex: { zh: "我们得赶上末班地铁。", pinyin: "wǒmen děi gǎnshàng mòbān dìtiě", ko: "우리는 지하철 막차를 타야 해요." },
        },
        {
          zh: "首班公交车", pinyin: "shǒubān gōngjiāochē", ko: "첫 시내버스", pos: "명사",
          ex: { zh: "首班公交车早上五点出发。", pinyin: "shǒubān gōngjiāochē zǎoshang wǔ diǎn chūfā", ko: "첫 시내버스는 아침 다섯 시에 출발해요." },
        },
        {
          zh: "交通卡余额", pinyin: "jiāotōngkǎ yú'é", ko: "교통카드 잔액", pos: "명사",
          hanja: "교통(交通)은 그대로이고, 余额은 남은 금액을 뜻해요.",
          ex: { zh: "交通卡余额不足，请先充值。", pinyin: "jiāotōngkǎ yú'é bùzú, qǐng xiān chōngzhí", ko: "교통카드 잔액이 부족하니 먼저 충전해 주세요." },
        },
        {
          zh: "自动售票机", pinyin: "zìdòng shòupiàojī", ko: "자동 발매기", pos: "명사",
          hanja: "자동(自動)과 표(票)를 연결하면 뜻을 짐작하기 쉬워요.",
          ex: { zh: "可以在自动售票机上买票。", pinyin: "kěyǐ zài zìdòng shòupiàojī shàng mǎi piào", ko: "자동 발매기에서 표를 살 수 있어요." },
        },
        {
          zh: "临时停运", pinyin: "línshí tíngyùn", ko: "임시 운행 중단", pos: "명사",
          ex: { zh: "这条线路今天临时停运。", pinyin: "zhè tiáo xiànlù jīntiān línshí tíngyùn", ko: "이 노선은 오늘 임시로 운행을 중단해요." },
        },
        {
          zh: "到站提醒", pinyin: "dàozhàn tíxǐng", ko: "도착역 알림", pos: "명사",
          ex: { zh: "请打开到站提醒。", pinyin: "qǐng dǎkāi dàozhàn tíxǐng", ko: "도착역 알림을 켜 주세요." },
        },
        {
          zh: "优先座位", pinyin: "yōuxiān zuòwèi", ko: "우선 배려 좌석", pos: "명사",
          ex: { zh: "请把优先座位让给有需要的人。", pinyin: "qǐng bǎ yōuxiān zuòwèi ràng gěi yǒu xūyào de rén", ko: "우선 배려 좌석은 필요한 사람에게 양보해 주세요." },
        },
        {
          zh: "出站口", pinyin: "chūzhànkǒu", ko: "역 출구", pos: "명사",
          ex: { zh: "三号出站口离博物馆最近。", pinyin: "sān hào chūzhànkǒu lí bówùguǎn zuì jìn", ko: "3번 역 출구가 박물관에서 가장 가까워요." },
        },
      ],
    },
    {
      name: "택시와 차량 이동",
      words: [
        {
          zh: "上车地点", pinyin: "shàngchē dìdiǎn", ko: "승차 지점", pos: "명사",
          ex: { zh: "请在地图上确认上车地点。", pinyin: "qǐng zài dìtú shàng quèrèn shàngchē dìdiǎn", ko: "지도에서 승차 지점을 확인해 주세요." },
        },
        {
          zh: "下车地点", pinyin: "xiàchē dìdiǎn", ko: "하차 지점", pos: "명사",
          ex: { zh: "我把下车地点改到南门了。", pinyin: "wǒ bǎ xiàchē dìdiǎn gǎi dào nánmén le", ko: "하차 지점을 남문으로 바꿨어요." },
        },
        {
          zh: "预计车费", pinyin: "yùjì chēfèi", ko: "예상 차량 요금", pos: "명사",
          ex: { zh: "应用里会显示预计车费。", pinyin: "yìngyòng lǐ huì xiǎnshì yùjì chēfèi", ko: "앱에 예상 차량 요금이 표시돼요." },
        },
        {
          zh: "堵车路段", pinyin: "dǔchē lùduàn", ko: "정체 구간", pos: "명사",
          ex: { zh: "前面是堵车路段，我们走别的路吧。", pinyin: "qiánmiàn shì dǔchē lùduàn, wǒmen zǒu bié de lù ba", ko: "앞은 정체 구간이니 다른 길로 가요." },
        },
        {
          zh: "绕行路线", pinyin: "ràoxíng lùxiàn", ko: "우회 경로", pos: "명사",
          ex: { zh: "司机选择了一条绕行路线。", pinyin: "sījī xuǎnzé le yì tiáo ràoxíng lùxiàn", ko: "기사가 우회 경로를 하나 선택했어요." },
        },
        {
          zh: "后备箱", pinyin: "hòubèixiāng", ko: "자동차 트렁크", pos: "명사",
          ex: { zh: "请把行李箱放进后备箱。", pinyin: "qǐng bǎ xínglixiāng fàng jìn hòubèixiāng", ko: "여행 가방을 트렁크에 넣어 주세요." },
        },
        {
          zh: "系好安全带", pinyin: "jì hǎo ānquándài", ko: "안전띠를 매다", pos: "표현",
          ex: { zh: "上车后请系好安全带。", pinyin: "shàngchē hòu qǐng jì hǎo ānquándài", ko: "차에 탄 뒤 안전띠를 매 주세요." },
        },
        {
          zh: "开具发票", pinyin: "kāijù fāpiào", ko: "영수증을 발행하다", pos: "동사",
          ex: { zh: "到达后可以开具发票吗？", pinyin: "dàodá hòu kěyǐ kāijù fāpiào ma", ko: "도착한 뒤 영수증을 발행해 주실 수 있나요?" },
        },
        {
          zh: "车牌号码", pinyin: "chēpái hàomǎ", ko: "차량 번호", pos: "명사",
          ex: { zh: "上车前先核对车牌号码。", pinyin: "shàngchē qián xiān héduì chēpái hàomǎ", ko: "차에 타기 전에 차량 번호를 먼저 대조해요." },
        },
      ],
    },
    {
      name: "길 찾기",
      words: [
        {
          zh: "人行横道", pinyin: "rénxíng héngdào", ko: "횡단보도", pos: "명사",
          ex: { zh: "过马路时请走人行横道。", pinyin: "guò mǎlù shí qǐng zǒu rénxíng héngdào", ko: "길을 건널 때는 횡단보도로 가 주세요." },
        },
        {
          zh: "十字路口", pinyin: "shízì lùkǒu", ko: "십자로, 교차로", pos: "명사",
          ex: { zh: "在下一个十字路口向右转。", pinyin: "zài xià yí ge shízì lùkǒu xiàng yòu zhuǎn", ko: "다음 교차로에서 오른쪽으로 도세요." },
        },
        {
          zh: "地下通道", pinyin: "dìxià tōngdào", ko: "지하 통로", pos: "명사",
          ex: { zh: "过街可以走地下通道。", pinyin: "guòjiē kěyǐ zǒu dìxià tōngdào", ko: "길을 건널 때 지하 통로로 갈 수 있어요." },
        },
        {
          zh: "过街天桥", pinyin: "guòjiē tiānqiáo", ko: "육교", pos: "명사",
          ex: { zh: "过街天桥就在车站旁边。", pinyin: "guòjiē tiānqiáo jiù zài chēzhàn pángbiān", ko: "육교는 역 바로 옆에 있어요." },
        },
        {
          zh: "直走到底", pinyin: "zhí zǒu dàodǐ", ko: "끝까지 곧장 가다", pos: "표현",
          ex: { zh: "从这里直走到底就到了。", pinyin: "cóng zhèlǐ zhí zǒu dàodǐ jiù dào le", ko: "여기서 끝까지 곧장 가면 도착해요." },
        },
        {
          zh: "沿着河边", pinyin: "yánzhe hébiān", ko: "강변을 따라서", pos: "표현",
          ex: { zh: "沿着河边走十分钟。", pinyin: "yánzhe hébiān zǒu shí fēnzhōng", ko: "강변을 따라 10분 걸어요." },
        },
        {
          zh: "在拐角处", pinyin: "zài guǎijiǎo chù", ko: "모퉁이에", pos: "표현",
          ex: { zh: "药店就在拐角处。", pinyin: "yàodiàn jiù zài guǎijiǎo chù", ko: "약국은 바로 모퉁이에 있어요." },
        },
        {
          zh: "隔壁那栋", pinyin: "gébì nà dòng", ko: "옆 건물", pos: "표현",
          ex: { zh: "咖啡店在隔壁那栋楼的一层。", pinyin: "kāfēidiàn zài gébì nà dòng lóu de yì céng", ko: "카페는 옆 건물 1층에 있어요." },
        },
        {
          zh: "步行距离", pinyin: "bùxíng jùlí", ko: "도보 거리", pos: "명사",
          ex: { zh: "酒店离车站只有五分钟的步行距离。", pinyin: "jiǔdiàn lí chēzhàn zhǐ yǒu wǔ fēnzhōng de bùxíng jùlí", ko: "호텔은 역에서 걸어서 5분 거리예요." },
        },
      ],
    },
    {
      name: "관광과 관람",
      words: [
        {
          zh: "开放时间", pinyin: "kāifàng shíjiān", ko: "개방 시간, 관람 시간", pos: "명사",
          ex: { zh: "参观前请确认开放时间。", pinyin: "cānguān qián qǐng quèrèn kāifàng shíjiān", ko: "관람하기 전에 개방 시간을 확인해 주세요." },
        },
        {
          zh: "预约参观", pinyin: "yùyuē cānguān", ko: "관람을 예약하다", pos: "동사",
          ex: { zh: "这里需要提前预约参观。", pinyin: "zhèlǐ xūyào tíqián yùyuē cānguān", ko: "이곳은 미리 관람을 예약해야 해요." },
        },
        {
          zh: "现场购票", pinyin: "xiànchǎng gòupiào", ko: "현장 발권", pos: "명사",
          ex: { zh: "网上没有票了，只能现场购票。", pinyin: "wǎngshàng méiyǒu piào le, zhǐ néng xiànchǎng gòupiào", ko: "온라인 표가 없어서 현장에서만 표를 살 수 있어요." },
        },
        {
          zh: "语音导览", pinyin: "yǔyīn dǎolǎn", ko: "음성 안내", pos: "명사",
          ex: { zh: "语音导览可以在入口租用。", pinyin: "yǔyīn dǎolǎn kěyǐ zài rùkǒu zūyòng", ko: "음성 안내기는 입구에서 빌릴 수 있어요." },
        },
        {
          zh: "临时闭馆", pinyin: "línshí bìguǎn", ko: "임시 휴관", pos: "명사",
          ex: { zh: "博物馆今天临时闭馆。", pinyin: "bówùguǎn jīntiān línshí bìguǎn", ko: "박물관은 오늘 임시로 휴관해요." },
        },
        {
          zh: "观景平台", pinyin: "guānjǐng píngtái", ko: "전망대", pos: "명사",
          ex: { zh: "从观景平台可以看到整座城市。", pinyin: "cóng guānjǐng píngtái kěyǐ kàndào zhěng zuò chéngshì", ko: "전망대에서 도시 전체를 볼 수 있어요." },
        },
        {
          zh: "游客中心", pinyin: "yóukè zhōngxīn", ko: "관광 안내소", pos: "명사",
          ex: { zh: "可以在游客中心领取地图。", pinyin: "kěyǐ zài yóukè zhōngxīn lǐngqǔ dìtú", ko: "관광 안내소에서 지도를 받을 수 있어요." },
        },
        {
          zh: "纪念品商店", pinyin: "jìniànpǐn shāngdiàn", ko: "기념품점", pos: "명사",
          ex: { zh: "纪念品商店在出口旁边。", pinyin: "jìniànpǐn shāngdiàn zài chūkǒu pángbiān", ko: "기념품점은 출구 옆에 있어요." },
        },
        {
          zh: "禁止拍照", pinyin: "jìnzhǐ pāizhào", ko: "촬영 금지", pos: "표현",
          ex: { zh: "这个展厅里禁止拍照。", pinyin: "zhège zhǎntīng lǐ jìnzhǐ pāizhào", ko: "이 전시실에서는 사진 촬영이 금지돼요." },
        },
      ],
    },
    {
      name: "식당 이용",
      words: [
        {
          zh: "排队取号", pinyin: "páiduì qǔhào", ko: "줄을 서서 대기 번호를 받다", pos: "동사",
          ex: { zh: "周末吃饭要先排队取号。", pinyin: "zhōumò chīfàn yào xiān páiduì qǔhào", ko: "주말에는 식사하려면 먼저 줄을 서서 번호를 받아야 해요." },
        },
        {
          zh: "靠窗座位", pinyin: "kàochuāng zuòwèi", ko: "창가 자리", pos: "명사",
          ex: { zh: "如果可以，请给我们靠窗座位。", pinyin: "rúguǒ kěyǐ, qǐng gěi wǒmen kàochuāng zuòwèi", ko: "가능하면 창가 자리로 주세요." },
        },
        {
          zh: "过敏原", pinyin: "guòmǐnyuán", ko: "알레르기 유발 물질", pos: "명사",
          hanja: "과민(過敏)은 한국어 의학 용어와 뜻이 이어져요.",
          ex: { zh: "请告诉我这道菜的过敏原。", pinyin: "qǐng gàosu wǒ zhè dào cài de guòmǐnyuán", ko: "이 요리의 알레르기 유발 물질을 알려 주세요." },
        },
        {
          zh: "不放辣椒", pinyin: "bú fàng làjiāo", ko: "고추를 넣지 않다", pos: "표현",
          ex: { zh: "这道菜请不要放辣椒。", pinyin: "zhè dào cài qǐng bú yào fàng làjiāo", ko: "이 요리에는 고추를 넣지 말아 주세요." },
        },
        {
          zh: "少放点盐", pinyin: "shǎo fàng diǎn yán", ko: "소금을 조금만 넣다", pos: "표현",
          ex: { zh: "这碗汤请少放点盐。", pinyin: "zhè wǎn tāng qǐng shǎo fàng diǎn yán", ko: "이 국에는 소금을 조금만 넣어 주세요." },
        },
        {
          zh: "分开结账", pinyin: "fēnkāi jiézhàng", ko: "따로 계산하다", pos: "동사",
          ex: { zh: "我们可以分开结账吗？", pinyin: "wǒmen kěyǐ fēnkāi jiézhàng ma", ko: "저희가 따로 계산할 수 있나요?" },
        },
        {
          zh: "打包带走", pinyin: "dǎbāo dàizǒu", ko: "포장해서 가져가다", pos: "동사",
          ex: { zh: "吃不完的菜请帮我打包带走。", pinyin: "chī bu wán de cài qǐng bāng wǒ dǎbāo dàizǒu", ko: "남은 요리는 포장해 주세요." },
        },
        {
          zh: "加一套餐具", pinyin: "jiā yí tào cānjù", ko: "식기 한 벌을 추가하다", pos: "표현",
          ex: { zh: "麻烦再加一套餐具。", pinyin: "máfan zài jiā yí tào cānjù", ko: "식기 한 벌을 더 부탁해요." },
        },
        {
          zh: "推荐菜", pinyin: "tuījiàncài", ko: "추천 요리", pos: "명사",
          ex: { zh: "今天的推荐菜是什么？", pinyin: "jīntiān de tuījiàncài shì shénme", ko: "오늘의 추천 요리는 무엇인가요?" },
        },
      ],
    },
    {
      name: "카페와 빵집",
      words: [
        {
          zh: "无糖饮料", pinyin: "wútáng yǐnliào", ko: "무가당 음료", pos: "명사",
          ex: { zh: "这里有无糖饮料吗？", pinyin: "zhèlǐ yǒu wútáng yǐnliào ma", ko: "여기에 무가당 음료가 있나요?" },
        },
        {
          zh: "去冰", pinyin: "qù bīng", ko: "얼음 빼기", pos: "표현",
          ex: { zh: "这杯茶请去冰。", pinyin: "zhè bēi chá qǐng qù bīng", ko: "이 차는 얼음을 빼 주세요." },
        },
        {
          zh: "少冰", pinyin: "shǎo bīng", ko: "얼음 적게", pos: "표현",
          ex: { zh: "我的饮料要少冰。", pinyin: "wǒ de yǐnliào yào shǎo bīng", ko: "제 음료는 얼음을 적게 넣어 주세요." },
        },
        {
          zh: "常温水", pinyin: "chángwēn shuǐ", ko: "상온의 물", pos: "명사",
          ex: { zh: "可以给我一杯常温水吗？", pinyin: "kěyǐ gěi wǒ yì bēi chángwēn shuǐ ma", ko: "상온의 물 한 잔을 주실 수 있나요?" },
        },
        {
          zh: "外带杯", pinyin: "wàidài bēi", ko: "테이크아웃 컵", pos: "명사",
          ex: { zh: "请把咖啡装在外带杯里。", pinyin: "qǐng bǎ kāfēi zhuāng zài wàidài bēi lǐ", ko: "커피를 테이크아웃 컵에 담아 주세요." },
        },
        {
          zh: "纸吸管", pinyin: "zhǐ xīguǎn", ko: "종이 빨대", pos: "명사",
          ex: { zh: "我可以拿一根纸吸管吗？", pinyin: "wǒ kěyǐ ná yì gēn zhǐ xīguǎn ma", ko: "종이 빨대 하나를 가져가도 될까요?" },
        },
        {
          zh: "现烤面包", pinyin: "xiànkǎo miànbāo", ko: "갓 구운 빵", pos: "명사",
          ex: { zh: "现烤面包十分钟后出炉。", pinyin: "xiànkǎo miànbāo shí fēnzhōng hòu chūlú", ko: "갓 구운 빵이 10분 뒤에 나와요." },
        },
        {
          zh: "夹心面包", pinyin: "jiāxīn miànbāo", ko: "속을 넣은 빵", pos: "명사",
          ex: { zh: "这个夹心面包里面是红豆。", pinyin: "zhège jiāxīn miànbāo lǐmiàn shì hóngdòu", ko: "이 빵 안에는 팥이 들어 있어요." },
        },
        {
          zh: "甜度选择", pinyin: "tiándù xuǎnzé", ko: "당도 선택", pos: "명사",
          ex: { zh: "这杯饮料有三种甜度选择。", pinyin: "zhè bēi yǐnliào yǒu sān zhǒng tiándù xuǎnzé", ko: "이 음료는 당도를 세 가지 중에서 고를 수 있어요." },
        },
      ],
    },
    {
      name: "쇼핑과 결제",
      words: [
        {
          zh: "试衣间", pinyin: "shìyījiān", ko: "탈의실", pos: "명사",
          ex: { zh: "试衣间在收银台后面。", pinyin: "shìyījiān zài shōuyíntái hòumiàn", ko: "탈의실은 계산대 뒤에 있어요." },
        },
        {
          zh: "现货", pinyin: "xiànhuò", ko: "재고 상품", pos: "명사",
          ex: { zh: "这个颜色现在有现货吗？", pinyin: "zhège yánsè xiànzài yǒu xiànhuò ma", ko: "이 색상은 지금 재고가 있나요?" },
        },
        {
          zh: "缺货", pinyin: "quēhuò", ko: "품절되다", pos: "동사",
          ex: { zh: "这个尺寸暂时缺货。", pinyin: "zhège chǐcùn zànshí quēhuò", ko: "이 치수는 잠시 품절이에요." },
        },
        {
          zh: "退换期限", pinyin: "tuìhuàn qīxiàn", ko: "교환·환불 기한", pos: "명사",
          ex: { zh: "请在退换期限内保留收据。", pinyin: "qǐng zài tuìhuàn qīxiàn nèi bǎoliú shōujù", ko: "교환·환불 기한 안에는 영수증을 보관해 주세요." },
        },
        {
          zh: "电子收据", pinyin: "diànzǐ shōujù", ko: "전자 영수증", pos: "명사",
          ex: { zh: "电子收据会发到您的邮箱。", pinyin: "diànzǐ shōujù huì fā dào nín de yóuxiāng", ko: "전자 영수증은 이메일로 전송돼요." },
        },
        {
          zh: "移动支付", pinyin: "yídòng zhīfù", ko: "모바일 결제", pos: "명사",
          hanja: "지불(支付)은 한국어와 글자 순서는 다르지만 같은 한자 뜻을 써요.",
          ex: { zh: "这里可以使用移动支付。", pinyin: "zhèlǐ kěyǐ shǐyòng yídòng zhīfù", ko: "여기서는 모바일 결제를 이용할 수 있어요." },
        },
        {
          zh: "扫码付款", pinyin: "sǎomǎ fùkuǎn", ko: "코드를 스캔해 결제하다", pos: "동사",
          ex: { zh: "这里可以扫码付款吗？", pinyin: "zhèlǐ kěyǐ sǎomǎ fùkuǎn ma", ko: "여기서 코드를 스캔해 결제할 수 있나요?" },
        },
        {
          zh: "自助结账", pinyin: "zìzhù jiézhàng", ko: "셀프 계산", pos: "명사",
          ex: { zh: "我们去自助结账通道吧。", pinyin: "wǒmen qù zìzhù jiézhàng tōngdào ba", ko: "셀프 계산 통로로 가요." },
        },
        {
          zh: "保修期", pinyin: "bǎoxiūqī", ko: "보증 기간", pos: "명사",
          ex: { zh: "这台机器的保修期是两年。", pinyin: "zhè tái jīqì de bǎoxiūqī shì liǎng nián", ko: "이 기계의 보증 기간은 2년이에요." },
        },
      ],
    },
    {
      name: "병원과 약국",
      words: [
        {
          zh: "挂号处", pinyin: "guàhàochù", ko: "접수처", pos: "명사",
          ex: { zh: "挂号处在一楼大厅。", pinyin: "guàhàochù zài yì lóu dàtīng", ko: "접수처는 1층 로비에 있어요." },
        },
        {
          zh: "门诊时间", pinyin: "ménzhěn shíjiān", ko: "외래 진료 시간", pos: "명사",
          ex: { zh: "请先确认周末的门诊时间。", pinyin: "qǐng xiān quèrèn zhōumò de ménzhěn shíjiān", ko: "주말 외래 진료 시간을 먼저 확인해 주세요." },
        },
        {
          zh: "过敏反应", pinyin: "guòmǐn fǎnyìng", ko: "알레르기 반응", pos: "명사",
          hanja: "과민 반응(過敏反應)은 한국어 표현과 한자가 그대로 이어져요.",
          ex: { zh: "他吃药后出现了过敏反应。", pinyin: "tā chī yào hòu chūxiàn le guòmǐn fǎnyìng", ko: "그는 약을 먹은 뒤 알레르기 반응이 나타났어요." },
        },
        {
          zh: "退烧药", pinyin: "tuìshāoyào", ko: "해열제", pos: "명사",
          ex: { zh: "医生给我开了退烧药。", pinyin: "yīshēng gěi wǒ kāi le tuìshāoyào", ko: "의사가 해열제를 처방해 줬어요." },
        },
        {
          zh: "止痛药", pinyin: "zhǐtòngyào", ko: "진통제", pos: "명사",
          ex: { zh: "我需要买一种止痛药。", pinyin: "wǒ xūyào mǎi yì zhǒng zhǐtòngyào", ko: "진통제 한 종류를 사야 해요." },
        },
        {
          zh: "空腹服用", pinyin: "kōngfù fúyòng", ko: "빈속에 복용하다", pos: "동사",
          ex: { zh: "这种药需要空腹服用。", pinyin: "zhè zhǒng yào xūyào kōngfù fúyòng", ko: "이 약은 빈속에 복용해야 해요." },
        },
        {
          zh: "饭后服用", pinyin: "fànhòu fúyòng", ko: "식후에 복용하다", pos: "동사",
          ex: { zh: "请按说明饭后服用。", pinyin: "qǐng àn shuōmíng fànhòu fúyòng", ko: "설명에 따라 식후에 복용해 주세요." },
        },
        {
          zh: "一日三次", pinyin: "yí rì sān cì", ko: "하루 세 번", pos: "표현",
          ex: { zh: "药袋上写着一日三次。", pinyin: "yàodài shàng xiězhe yí rì sān cì", ko: "약 봉투에 하루 세 번이라고 적혀 있어요." },
        },
        {
          zh: "紧急联系人", pinyin: "jǐnjí liánxìrén", ko: "비상 연락 담당자", pos: "명사",
          ex: { zh: "请在表格上填写紧急联系人。", pinyin: "qǐng zài biǎogé shàng tiánxiě jǐnjí liánxìrén", ko: "양식에 비상 연락 담당자를 적어 주세요." },
        },
      ],
    },
    {
      name: "날씨와 옷차림",
      words: [
        {
          zh: "体感温度", pinyin: "tǐgǎn wēndù", ko: "체감 온도", pos: "명사",
          ex: { zh: "今天的体感温度比实际温度低。", pinyin: "jīntiān de tǐgǎn wēndù bǐ shíjì wēndù dī", ko: "오늘 체감 온도는 실제 온도보다 낮아요." },
        },
        {
          zh: "紫外线指数", pinyin: "zǐwàixiàn zhǐshù", ko: "자외선 지수", pos: "명사",
          hanja: "자외선 지수(紫外線指數)는 한국어와 거의 같은 한자 조합이에요.",
          ex: { zh: "中午的紫外线指数很高。", pinyin: "zhōngwǔ de zǐwàixiàn zhǐshù hěn gāo", ko: "한낮의 자외선 지수가 높아요." },
        },
        {
          zh: "降雨概率", pinyin: "jiàngyǔ gàilǜ", ko: "강수 확률", pos: "명사",
          ex: { zh: "下午的降雨概率是百分之六十。", pinyin: "xiàwǔ de jiàngyǔ gàilǜ shì bǎifēnzhī liùshí", ko: "오후 강수 확률은 60퍼센트예요." },
        },
        {
          zh: "防风外套", pinyin: "fángfēng wàitào", ko: "바람막이 겉옷", pos: "명사",
          ex: { zh: "海边风大，带一件防风外套吧。", pinyin: "hǎibiān fēng dà, dài yí jiàn fángfēng wàitào ba", ko: "바닷가는 바람이 세니 바람막이 겉옷을 하나 가져가요." },
        },
        {
          zh: "折叠雨伞", pinyin: "zhédié yǔsǎn", ko: "접이식 우산", pos: "명사",
          ex: { zh: "我的包里有一把折叠雨伞。", pinyin: "wǒ de bāo lǐ yǒu yì bǎ zhédié yǔsǎn", ko: "제 가방 안에 접이식 우산이 하나 있어요." },
        },
        {
          zh: "保暖内衣", pinyin: "bǎonuǎn nèiyī", ko: "보온 내의", pos: "명사",
          ex: { zh: "天冷时穿保暖内衣很舒服。", pinyin: "tiān lěng shí chuān bǎonuǎn nèiyī hěn shūfu", ko: "날씨가 추울 때 보온 내의를 입으면 편안해요." },
        },
        {
          zh: "防滑鞋", pinyin: "fánghuá xié", ko: "미끄럼 방지 신발", pos: "명사",
          ex: { zh: "下雪天最好穿防滑鞋。", pinyin: "xiàxuě tiān zuìhǎo chuān fánghuá xié", ko: "눈 오는 날에는 미끄럼 방지 신발을 신는 게 좋아요." },
        },
        {
          zh: "昼夜温差", pinyin: "zhòuyè wēnchā", ko: "낮과 밤의 기온 차", pos: "명사",
          hanja: "주야(晝夜)는 낮과 밤, 온차(溫差)는 온도의 차이를 뜻해요.",
          ex: { zh: "这里的昼夜温差很大。", pinyin: "zhèlǐ de zhòuyè wēnchā hěn dà", ko: "이곳은 낮과 밤의 기온 차가 커요." },
        },
        {
          zh: "空气湿度", pinyin: "kōngqì shīdù", ko: "공기 습도", pos: "명사",
          ex: { zh: "今天的空气湿度有点高。", pinyin: "jīntiān de kōngqì shīdù yǒudiǎn gāo", ko: "오늘은 공기 습도가 조금 높아요." },
        },
      ],
    },
    {
      name: "집과 생활",
      words: [
        {
          zh: "垃圾分类", pinyin: "lājī fēnlèi", ko: "쓰레기 분리배출", pos: "명사",
          hanja: "분류(分類)는 한국어와 한자와 뜻이 같아요.",
          ex: { zh: "这里要求住户做好垃圾分类。", pinyin: "zhèlǐ yāoqiú zhùhù zuò hǎo lājī fēnlèi", ko: "이곳은 거주자가 쓰레기를 잘 분리하도록 요구해요." },
        },
        {
          zh: "可回收物", pinyin: "kě huíshōuwù", ko: "재활용할 수 있는 물건", pos: "명사",
          ex: { zh: "纸箱属于可回收物。", pinyin: "zhǐxiāng shǔyú kě huíshōuwù", ko: "종이 상자는 재활용할 수 있는 물건에 속해요." },
        },
        {
          zh: "厨余垃圾", pinyin: "chúyú lājī", ko: "음식물 쓰레기", pos: "명사",
          ex: { zh: "请把厨余垃圾单独装好。", pinyin: "qǐng bǎ chúyú lājī dāndú zhuāng hǎo", ko: "음식물 쓰레기는 따로 잘 담아 주세요." },
        },
        {
          zh: "快递柜", pinyin: "kuàidìguì", ko: "무인 택배 보관함", pos: "명사",
          ex: { zh: "你的包裹放在一楼的快递柜里。", pinyin: "nǐ de bāoguǒ fàng zài yì lóu de kuàidìguì lǐ", ko: "당신의 소포는 1층 무인 택배 보관함에 있어요." },
        },
        {
          zh: "门禁密码", pinyin: "ménjìn mìmǎ", ko: "공동 출입문 비밀번호", pos: "명사",
          ex: { zh: "房东把门禁密码发给我了。", pinyin: "fángdōng bǎ ménjìn mìmǎ fā gěi wǒ le", ko: "집주인이 공동 출입문 비밀번호를 보내 줬어요." },
        },
        {
          zh: "停水通知", pinyin: "tíngshuǐ tōngzhī", ko: "단수 안내", pos: "명사",
          ex: { zh: "大厅里贴着明天的停水通知。", pinyin: "dàtīng lǐ tiēzhe míngtiān de tíngshuǐ tōngzhī", ko: "로비에 내일 단수 안내가 붙어 있어요." },
        },
        {
          zh: "停电通知", pinyin: "tíngdiàn tōngzhī", ko: "정전 안내", pos: "명사",
          hanja: "정전(停電)과 통지(通知)를 떠올리면 뜻이 바로 보여요.",
          ex: { zh: "我们还没收到停电通知。", pinyin: "wǒmen hái méi shōudào tíngdiàn tōngzhī", ko: "우리는 아직 정전 안내를 받지 못했어요." },
        },
        {
          zh: "晾衣架", pinyin: "liàngyījià", ko: "빨래 건조대", pos: "명사",
          ex: { zh: "阳台上有一个晾衣架。", pinyin: "yángtái shàng yǒu yí ge liàngyījià", ko: "베란다에 빨래 건조대가 하나 있어요." },
        },
        {
          zh: "清洁用品", pinyin: "qīngjié yòngpǐn", ko: "청소용품", pos: "명사",
          ex: { zh: "清洁用品放在水池下面。", pinyin: "qīngjié yòngpǐn fàng zài shuǐchí xiàmiàn", ko: "청소용품은 싱크대 아래에 있어요." },
        },
      ],
    },
    {
      name: "학습과 수업",
      words: [
        {
          zh: "课程表", pinyin: "kèchéngbiǎo", ko: "수업 시간표", pos: "명사",
          ex: { zh: "新课程表已经发到班级群里了。", pinyin: "xīn kèchéngbiǎo yǐjīng fā dào bānjí qún lǐ le", ko: "새 수업 시간표가 반 단체 대화방에 올라왔어요." },
        },
        {
          zh: "选修课", pinyin: "xuǎnxiūkè", ko: "선택 과목", pos: "명사",
          ex: { zh: "我这学期选了一门口语选修课。", pinyin: "wǒ zhè xuéqī xuǎn le yì mén kǒuyǔ xuǎnxiūkè", ko: "저는 이번 학기에 회화 선택 과목 하나를 골랐어요." },
        },
        {
          zh: "预习资料", pinyin: "yùxí zīliào", ko: "예습 자료", pos: "명사",
          ex: { zh: "老师课前发了预习资料。", pinyin: "lǎoshī kèqián fā le yùxí zīliào", ko: "선생님이 수업 전에 예습 자료를 보냈어요." },
        },
        {
          zh: "课堂笔记", pinyin: "kètáng bǐjì", ko: "수업 필기", pos: "명사",
          hanja: "필기(筆記)는 한국어와 한자가 그대로 같아요.",
          ex: { zh: "我下课后整理课堂笔记。", pinyin: "wǒ xiàkè hòu zhěnglǐ kètáng bǐjì", ko: "저는 수업이 끝난 뒤 수업 필기를 정리해요." },
        },
        {
          zh: "小组作业", pinyin: "xiǎozǔ zuòyè", ko: "조별 과제", pos: "명사",
          ex: { zh: "我们周五以前要完成小组作业。", pinyin: "wǒmen zhōuwǔ yǐqián yào wánchéng xiǎozǔ zuòyè", ko: "우리는 금요일 전까지 조별 과제를 끝내야 해요." },
        },
        {
          zh: "截止日期", pinyin: "jiézhǐ rìqī", ko: "마감일", pos: "명사",
          ex: { zh: "作业的截止日期是下周一。", pinyin: "zuòyè de jiézhǐ rìqī shì xià zhōuyī", ko: "과제 마감일은 다음 주 월요일이에요." },
        },
        {
          zh: "补交作业", pinyin: "bǔjiāo zuòyè", ko: "과제를 뒤늦게 제출하다", pos: "동사",
          ex: { zh: "我需要明天补交作业。", pinyin: "wǒ xūyào míngtiān bǔjiāo zuòyè", ko: "저는 내일 과제를 뒤늦게 제출해야 해요." },
        },
        {
          zh: "口语练习", pinyin: "kǒuyǔ liànxí", ko: "말하기 연습", pos: "명사",
          ex: { zh: "我每天做十分钟口语练习。", pinyin: "wǒ měitiān zuò shí fēnzhōng kǒuyǔ liànxí", ko: "저는 매일 10분 동안 말하기 연습을 해요." },
        },
        {
          zh: "学习进度", pinyin: "xuéxí jìndù", ko: "학습 진도", pos: "명사",
          hanja: "학습(學習)과 진도(進度)가 모두 한국어와 이어져요.",
          ex: { zh: "这个页面会保存你的学习进度。", pinyin: "zhège yèmiàn huì bǎocún nǐ de xuéxí jìndù", ko: "이 페이지가 학습 진도를 저장해요." },
        },
      ],
    },
    {
      name: "업무와 회의",
      words: [
        {
          zh: "会议链接", pinyin: "huìyì liànjiē", ko: "회의 링크", pos: "명사",
          ex: { zh: "会议链接已经发到群里了。", pinyin: "huìyì liànjiē yǐjīng fā dào qún lǐ le", ko: "회의 링크를 단체 대화방에 이미 보냈어요." },
        },
        {
          zh: "线上会议", pinyin: "xiànshàng huìyì", ko: "온라인 회의", pos: "명사",
          ex: { zh: "我们下午三点开线上会议。", pinyin: "wǒmen xiàwǔ sān diǎn kāi xiànshàng huìyì", ko: "우리는 오후 세 시에 온라인 회의를 해요." },
        },
        {
          zh: "议程安排", pinyin: "yìchéng ānpái", ko: "의제 일정", pos: "명사",
          ex: { zh: "请先看一下今天的议程安排。", pinyin: "qǐng xiān kàn yíxià jīntiān de yìchéng ānpái", ko: "오늘의 의제 일정을 먼저 봐 주세요." },
        },
        {
          zh: "会议纪要", pinyin: "huìyì jìyào", ko: "회의 요약 기록", pos: "명사",
          ex: { zh: "会后我来整理会议纪要。", pinyin: "huì hòu wǒ lái zhěnglǐ huìyì jìyào", ko: "회의가 끝난 뒤 제가 회의 요약 기록을 정리할게요." },
        },
        {
          zh: "待办事项", pinyin: "dàibàn shìxiàng", ko: "할 일", pos: "명사",
          ex: { zh: "今天还有三个待办事项。", pinyin: "jīntiān hái yǒu sān ge dàibàn shìxiàng", ko: "오늘은 할 일이 세 개 더 있어요." },
        },
        {
          zh: "进度汇报", pinyin: "jìndù huìbào", ko: "진행 상황 보고", pos: "명사",
          ex: { zh: "周五上午做进度汇报。", pinyin: "zhōuwǔ shàngwǔ zuò jìndù huìbào", ko: "금요일 오전에 진행 상황을 보고해요." },
        },
        {
          zh: "修改意见", pinyin: "xiūgǎi yìjiàn", ko: "수정 의견", pos: "명사",
          ex: { zh: "我已经把修改意见写在文档里了。", pinyin: "wǒ yǐjīng bǎ xiūgǎi yìjiàn xiě zài wéndàng lǐ le", ko: "수정 의견을 문서에 이미 적어 두었어요." },
        },
        {
          zh: "最终版本", pinyin: "zuìzhōng bǎnběn", ko: "최종본", pos: "명사",
          hanja: "최종(最終)과 판본(版本)을 연결하면 뜻을 쉽게 기억할 수 있어요.",
          ex: { zh: "请在发送前确认最终版本。", pinyin: "qǐng zài fāsòng qián quèrèn zuìzhōng bǎnběn", ko: "보내기 전에 최종본을 확인해 주세요." },
        },
        {
          zh: "延期申请", pinyin: "yánqī shēnqǐng", ko: "기한 연장 신청", pos: "명사",
          ex: { zh: "如果来不及，请提前提交延期申请。", pinyin: "rúguǒ lái bu jí, qǐng tíqián tíjiāo yánqī shēnqǐng", ko: "제때 끝내기 어렵다면 기한 연장 신청을 미리 제출해 주세요." },
        },
      ],
    },
    {
      name: "디지털 연락",
      words: [
        {
          zh: "视频通话", pinyin: "shìpín tōnghuà", ko: "영상 통화", pos: "명사",
          hanja: "통화(通話)는 한국어와 같은 두 글자를 써요.",
          ex: { zh: "我们晚上用视频通话联系。", pinyin: "wǒmen wǎnshang yòng shìpín tōnghuà liánxì", ko: "우리는 저녁에 영상 통화로 연락해요." },
        },
        {
          zh: "信号不好", pinyin: "xìnhào bù hǎo", ko: "신호가 좋지 않다", pos: "표현",
          ex: { zh: "地铁里信号不好，听不清楚。", pinyin: "dìtiě lǐ xìnhào bù hǎo, tīng bu qīngchu", ko: "지하철 안은 신호가 좋지 않아 잘 들리지 않아요." },
        },
        {
          zh: "断线重连", pinyin: "duànxiàn chónglián", ko: "연결이 끊긴 뒤 다시 연결하다", pos: "동사",
          ex: { zh: "应用会自动断线重连。", pinyin: "yìngyòng huì zìdòng duànxiàn chónglián", ko: "앱이 연결이 끊기면 자동으로 다시 연결해요." },
        },
        {
          zh: "静音模式", pinyin: "jìngyīn móshì", ko: "무음 모드", pos: "명사",
          ex: { zh: "上课前请打开静音模式。", pinyin: "shàngkè qián qǐng dǎkāi jìngyīn móshì", ko: "수업 전에 무음 모드를 켜 주세요." },
        },
        {
          zh: "位置共享", pinyin: "wèizhì gòngxiǎng", ko: "위치 공유", pos: "명사",
          ex: { zh: "我打开了位置共享。", pinyin: "wǒ dǎkāi le wèizhì gòngxiǎng", ko: "위치 공유를 켰어요." },
        },
        {
          zh: "文件下载", pinyin: "wénjiàn xiàzài", ko: "파일 다운로드", pos: "명사",
          ex: { zh: "文件下载还需要两分钟。", pinyin: "wénjiàn xiàzài hái xūyào liǎng fēnzhōng", ko: "파일 다운로드에 2분이 더 필요해요." },
        },
        {
          zh: "云端备份", pinyin: "yúnduān bèifèn", ko: "클라우드 백업", pos: "명사",
          ex: { zh: "照片已经完成云端备份。", pinyin: "zhàopiàn yǐjīng wánchéng yúnduān bèifèn", ko: "사진의 클라우드 백업이 이미 끝났어요." },
        },
        {
          zh: "账号登录", pinyin: "zhànghào dēnglù", ko: "계정 로그인", pos: "명사",
          ex: { zh: "账号登录需要验证码。", pinyin: "zhànghào dēnglù xūyào yànzhèngmǎ", ko: "계정 로그인에는 인증 코드가 필요해요." },
        },
        {
          zh: "密码重置", pinyin: "mìmǎ chóngzhì", ko: "비밀번호 재설정", pos: "명사",
          ex: { zh: "密码重置链接十分钟后失效。", pinyin: "mìmǎ chóngzhì liànjiē shí fēnzhōng hòu shīxiào", ko: "비밀번호 재설정 링크는 10분 뒤에 만료돼요." },
        },
      ],
    },
  ],
};

export default draftExpansion;
