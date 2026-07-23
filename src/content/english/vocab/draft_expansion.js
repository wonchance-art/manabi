/**
 * DRAFT — 영어 기초 어휘 확충 후보 20세트.
 *
 * 콘텐츠 정본은 Claude 소유다. 표현·번역·난이도·레벨 배치는 Claude 검수 후 확정하며,
 * 검수 전에는 src/content/english/index.js 등 기존 소비 경로에 연결하지 않는다.
 */
const draftExpansion = {
  level: "DRAFT",
  title: "영어 기초 어휘 확충 초안",
  desc: "여행·일상·업무 기초 상황을 위한 20세트 초안이에요. Claude 검수 전에는 학습 콘텐츠로 배포하지 않아요.",
  themes: [
    {
      name: "공항 수속",
      icon: "🛫",
      words: [
        {
          en: "check-in counter", ipa: "[ˈtʃek ɪn ˌkaʊntər]", ko: "체크인 카운터, 탑승 수속대", pos: "n.",
          ex: { en: "The check-in counter opens at six.", ko: "체크인 카운터는 여섯 시에 열려요." },
        },
        {
          en: "boarding pass", ipa: "[ˈbɔːrdɪŋ pæs]", ko: "탑승권", pos: "n.",
          ex: { en: "Please show your boarding pass at the gate.", ko: "탑승구에서 탑승권을 보여 주세요." },
        },
        {
          en: "carry-on", ipa: "[ˈkæri ɑːn]", ko: "기내 반입 가방", pos: "n.",
          ex: { en: "This small suitcase is my carry-on.", ko: "이 작은 여행 가방은 제 기내 반입 가방이에요." },
        },
        {
          en: "baggage claim", ipa: "[ˈbæɡɪdʒ kleɪm]", ko: "수하물 찾는 곳", pos: "n.",
          ex: { en: "Baggage claim is on the first floor.", ko: "수하물 찾는 곳은 1층에 있어요." },
        },
        {
          en: "gate number", ipa: "[ɡeɪt ˈnʌmbər]", ko: "탑승구 번호", pos: "n.",
          ex: { en: "Check the screen for your gate number.", ko: "화면에서 탑승구 번호를 확인하세요." },
        },
        {
          en: "aisle seat", ipa: "[aɪl siːt]", ko: "통로 쪽 좌석", pos: "n.",
          ex: { en: "Could I have an aisle seat, please?", ko: "통로 쪽 좌석으로 주시겠어요?" },
        },
        {
          en: "window seat", ipa: "[ˈwɪndoʊ siːt]", ko: "창가 좌석", pos: "n.",
          ex: { en: "My child would like a window seat.", ko: "우리 아이가 창가 좌석을 원해요." },
        },
        {
          en: "security check", ipa: "[sɪˈkjʊrəti tʃek]", ko: "보안 검색", pos: "n.",
          ex: { en: "Leave extra time for the security check.", ko: "보안 검색에 쓸 시간을 넉넉히 두세요." },
        },
        {
          en: "departure board", ipa: "[dɪˈpɑːrtʃər bɔːrd]", ko: "출발 안내판", pos: "n.",
          ex: { en: "Our flight is not on the departure board yet.", ko: "우리 항공편은 아직 출발 안내판에 없어요." },
        },
      ],
    },
    {
      name: "숙소 도착",
      icon: "🛎️",
      words: [
        {
          en: "booking", ipa: "[ˈbʊkɪŋ]", ko: "예약", pos: "n.",
          ex: { en: "I have a booking under Kim.", ko: "김이라는 이름으로 예약했어요." },
        },
        {
          en: "front desk", ipa: "[ˌfrʌnt ˈdesk]", ko: "호텔 프런트, 안내 데스크", pos: "n.",
          ex: { en: "Ask the front desk for another towel.", ko: "프런트에 수건을 하나 더 요청하세요." },
        },
        {
          en: "single room", ipa: "[ˈsɪŋɡl ruːm]", ko: "1인실", pos: "n.",
          ex: { en: "I booked a single room for two nights.", ko: "이틀 동안 묵을 1인실을 예약했어요." },
        },
        {
          en: "double room", ipa: "[ˈdʌbl ruːm]", ko: "2인실", pos: "n.",
          ex: { en: "Is a double room available tonight?", ko: "오늘 밤 이용할 수 있는 2인실이 있나요?" },
        },
        {
          en: "vacancy", ipa: "[ˈveɪkənsi]", ko: "빈방, 공실", pos: "n.",
          ex: { en: "The sign says there is one vacancy.", ko: "표지판에 빈방이 하나 있다고 쓰여 있어요." },
        },
        {
          en: "check-in", ipa: "[ˈtʃek ɪn]", ko: "체크인, 입실 수속", pos: "n.",
          ex: { en: "Check-in begins at three in the afternoon.", ko: "체크인은 오후 세 시부터예요." },
        },
        {
          en: "check-out", ipa: "[ˈtʃek aʊt]", ko: "체크아웃, 퇴실 수속", pos: "n.",
          ex: { en: "Check-out is before eleven.", ko: "체크아웃은 열한 시 전이에요." },
        },
        {
          en: "room key", ipa: "[ruːm kiː]", ko: "객실 열쇠", pos: "n.",
          ex: { en: "I left my room key at the front desk.", ko: "객실 열쇠를 프런트에 맡겼어요." },
        },
        {
          en: "wake-up call", ipa: "[ˈweɪk ʌp kɔːl]", ko: "모닝콜", pos: "n.",
          ex: { en: "Can I get a wake-up call at five thirty?", ko: "다섯 시 반에 모닝콜을 받을 수 있을까요?" },
        },
      ],
    },
    {
      name: "대중교통",
      icon: "🚇",
      words: [
        {
          en: "platform", ipa: "[ˈplætfɔːrm]", ko: "승강장", pos: "n.",
          ex: { en: "The train leaves from platform four.", ko: "기차는 4번 승강장에서 출발해요." },
        },
        {
          en: "fare", ipa: "[fer]", ko: "교통 요금", pos: "n.",
          ex: { en: "How much is the bus fare?", ko: "버스 요금이 얼마예요?" },
        },
        {
          en: "route", ipa: "[ruːt]", ko: "노선, 경로", pos: "n.",
          ex: { en: "This route goes through the city center.", ko: "이 노선은 도심을 지나가요." },
        },
        {
          en: "transfer", ipa: "[ˈtrænsfɜːr]", ko: "환승", pos: "n.",
          ex: { en: "You need one transfer at Central Station.", ko: "중앙역에서 한 번 환승해야 해요." },
        },
        {
          en: "one-way", ipa: "[ˌwʌn ˈweɪ]", ko: "편도의", pos: "adj.",
          ex: { en: "I need a one-way ticket to Oxford.", ko: "옥스퍼드행 편도표가 필요해요." },
        },
        {
          en: "round trip", ipa: "[ˌraʊnd ˈtrɪp]", ko: "왕복 여행; 왕복표", pos: "n.",
          ex: { en: "A round trip is cheaper than two single tickets.", ko: "왕복표가 편도표 두 장보다 저렴해요." },
        },
        {
          en: "timetable", ipa: "[ˈtaɪmteɪbl]", ko: "시간표, 운행표", pos: "n.",
          ex: { en: "The weekend timetable is different.", ko: "주말 운행표는 달라요." },
        },
        {
          en: "rush hour", ipa: "[ˈrʌʃ aʊər]", ko: "출퇴근 시간대", pos: "n.",
          ex: { en: "The subway is crowded during rush hour.", ko: "출퇴근 시간에는 지하철이 붐벼요." },
        },
        {
          en: "last train", ipa: "[ˌlæst ˈtreɪn]", ko: "막차", pos: "n.",
          ex: { en: "What time is the last train home?", ko: "집에 가는 막차가 몇 시예요?" },
        },
      ],
    },
    {
      name: "택시와 이동",
      icon: "🚕",
      words: [
        {
          en: "destination", ipa: "[ˌdestɪˈneɪʃn]", ko: "목적지", pos: "n.",
          ex: { en: "Please enter your destination in the app.", ko: "앱에 목적지를 입력해 주세요." },
        },
        {
          en: "meter", ipa: "[ˈmiːtər]", ko: "택시 미터기; 계량기", pos: "n.",
          ex: { en: "Could you turn on the meter?", ko: "미터기를 켜 주시겠어요?" },
        },
        {
          en: "traffic jam", ipa: "[ˈtræfɪk dʒæm]", ko: "교통 체증", pos: "n.",
          ex: { en: "We were late because of a traffic jam.", ko: "교통 체증 때문에 늦었어요." },
        },
        {
          en: "taxi stand", ipa: "[ˈtæksi stænd]", ko: "택시 승강장", pos: "n.",
          ex: { en: "There is a taxi stand outside the station.", ko: "역 밖에 택시 승강장이 있어요." },
        },
        {
          en: "drop-off point", ipa: "[ˈdrɑːp ɔːf pɔɪnt]", ko: "하차 지점", pos: "n.",
          ex: { en: "The hotel entrance is the drop-off point.", ko: "호텔 입구가 하차 지점이에요." },
        },
        {
          en: "pick-up point", ipa: "[ˈpɪk ʌp pɔɪnt]", ko: "승차 지점", pos: "n.",
          ex: { en: "Meet your driver at the pick-up point.", ko: "승차 지점에서 기사님을 만나세요." },
        },
        {
          en: "back seat", ipa: "[ˌbæk ˈsiːt]", ko: "뒷좌석", pos: "n.",
          ex: { en: "Your bag is on the back seat.", ko: "가방은 뒷좌석에 있어요." },
        },
        {
          en: "trunk", ipa: "[trʌŋk]", ko: "자동차 트렁크", pos: "n.",
          ex: { en: "Could you put this suitcase in the trunk?", ko: "이 여행 가방을 트렁크에 넣어 주시겠어요?" },
        },
        {
          en: "exact change", ipa: "[ɪɡˈzækt tʃeɪndʒ]", ko: "거스름돈이 필요 없는 정확한 금액", pos: "n.",
          ex: { en: "You need exact change for this bus.", ko: "이 버스에서는 요금을 정확히 맞춰 내야 해요." },
        },
      ],
    },
    {
      name: "길 찾기",
      icon: "🧭",
      words: [
        {
          en: "intersection", ipa: "[ˌɪntərˈsekʃn]", ko: "교차로", pos: "n.",
          ex: { en: "Turn left at the next intersection.", ko: "다음 교차로에서 왼쪽으로 도세요." },
        },
        {
          en: "crosswalk", ipa: "[ˈkrɔːswɔːk]", ko: "횡단보도", pos: "n.",
          ex: { en: "Use the crosswalk to cross the road.", ko: "길을 건널 때 횡단보도를 이용하세요." },
        },
        {
          en: "landmark", ipa: "[ˈlændmɑːrk]", ko: "눈에 띄는 지형지물, 랜드마크", pos: "n.",
          ex: { en: "The clock tower is an easy landmark to find.", ko: "시계탑은 찾기 쉬운 지형지물이에요." },
        },
        {
          en: "block", ipa: "[blɑːk]", ko: "한 구획, 블록", pos: "n.",
          ex: { en: "The cafe is two blocks from here.", ko: "그 카페는 여기서 두 블록 떨어져 있어요." },
        },
        {
          en: "corner", ipa: "[ˈkɔːrnər]", ko: "모퉁이", pos: "n.",
          ex: { en: "The pharmacy is on the corner.", ko: "약국은 모퉁이에 있어요." },
        },
        {
          en: "entrance", ipa: "[ˈentrəns]", ko: "입구", pos: "n.",
          ex: { en: "The main entrance faces the park.", ko: "정문은 공원 쪽을 향하고 있어요." },
        },
        {
          en: "exit", ipa: "[ˈeɡzɪt]", ko: "출구", pos: "n.",
          ex: { en: "Take exit three from the station.", ko: "역 3번 출구로 나가세요." },
        },
        {
          en: "opposite", ipa: "[ˈɑːpəzɪt]", ko: "맞은편에; 반대편의", pos: "prep.",
          ex: { en: "The library is opposite the post office.", ko: "도서관은 우체국 맞은편에 있어요." },
        },
        {
          en: "nearby", ipa: "[ˌnɪrˈbaɪ]", ko: "근처에; 가까운", pos: "adv.",
          ex: { en: "Is there a restroom nearby?", ko: "근처에 화장실이 있나요?" },
        },
      ],
    },
    {
      name: "관광과 관람",
      icon: "🏛️",
      words: [
        {
          en: "admission", ipa: "[ədˈmɪʃn]", ko: "입장; 입장료", pos: "n.",
          ex: { en: "Admission is free on Sundays.", ko: "일요일에는 입장이 무료예요." },
        },
        {
          en: "guided tour", ipa: "[ˈɡaɪdɪd tʊr]", ko: "가이드 투어", pos: "n.",
          ex: { en: "The guided tour starts in ten minutes.", ko: "가이드 투어는 10분 뒤에 시작해요." },
        },
        {
          en: "opening hours", ipa: "[ˈoʊpənɪŋ aʊərz]", ko: "영업시간, 관람 시간", pos: "n.",
          ex: { en: "Check the opening hours before you visit.", ko: "방문하기 전에 관람 시간을 확인하세요." },
        },
        {
          en: "souvenir", ipa: "[ˌsuːvəˈnɪr]", ko: "기념품", pos: "n.",
          ex: { en: "I bought a small souvenir for my family.", ko: "가족에게 줄 작은 기념품을 샀어요." },
        },
        {
          en: "viewpoint", ipa: "[ˈvjuːpɔɪnt]", ko: "전망 지점", pos: "n.",
          ex: { en: "The viewpoint is a short walk uphill.", ko: "전망 지점은 오르막으로 조금만 걸으면 나와요." },
        },
        {
          en: "brochure", ipa: "[broʊˈʃʊr]", ko: "안내 책자", pos: "n.",
          ex: { en: "This brochure has a map of the old town.", ko: "이 안내 책자에는 구시가지 지도가 있어요." },
        },
        {
          en: "audio guide", ipa: "[ˈɔːdioʊ ɡaɪd]", ko: "음성 안내기", pos: "n.",
          ex: { en: "The audio guide is available in Korean.", ko: "음성 안내기는 한국어로도 이용할 수 있어요." },
        },
        {
          en: "day trip", ipa: "[ˈdeɪ trɪp]", ko: "당일치기 여행", pos: "n.",
          ex: { en: "We took a day trip to the coast.", ko: "우리는 해안으로 당일치기 여행을 갔어요." },
        },
        {
          en: "local market", ipa: "[ˈloʊkl ˈmɑːrkɪt]", ko: "현지 시장", pos: "n.",
          ex: { en: "The local market is busiest in the morning.", ko: "현지 시장은 아침에 가장 붐벼요." },
        },
      ],
    },
    {
      name: "여행 문제 해결",
      icon: "🆘",
      words: [
        {
          en: "delayed", ipa: "[dɪˈleɪd]", ko: "지연된", pos: "adj.",
          ex: { en: "Our flight is delayed by an hour.", ko: "우리 항공편이 한 시간 지연됐어요." },
        },
        {
          en: "cancellation", ipa: "[ˌkænsəˈleɪʃn]", ko: "취소", pos: "n.",
          ex: { en: "The airline sent a cancellation notice.", ko: "항공사에서 취소 안내를 보냈어요." },
        },
        {
          en: "missing luggage", ipa: "[ˈmɪsɪŋ ˈlʌɡɪdʒ]", ko: "분실 수하물", pos: "n.",
          ex: { en: "Where should I report missing luggage?", ko: "분실 수하물은 어디에 신고해야 하나요?" },
        },
        {
          en: "lost property", ipa: "[ˌlɔːst ˈprɑːpərti]", ko: "분실물", pos: "n.",
          ex: { en: "Ask at the lost property office.", ko: "분실물 보관소에 문의하세요." },
        },
        {
          en: "emergency", ipa: "[ɪˈmɜːrdʒənsi]", ko: "비상 상황", pos: "n.",
          ex: { en: "Call this number in an emergency.", ko: "비상 상황에는 이 번호로 전화하세요." },
        },
        {
          en: "travel insurance", ipa: "[ˈtrævl ɪnˌʃʊrəns]", ko: "여행자 보험", pos: "n.",
          ex: { en: "Travel insurance covered the medical bill.", ko: "여행자 보험으로 진료비를 처리했어요." },
        },
        {
          en: "embassy", ipa: "[ˈembəsi]", ko: "대사관", pos: "n.",
          ex: { en: "Contact the embassy if your passport is stolen.", ko: "여권을 도난당하면 대사관에 연락하세요." },
        },
        {
          en: "replacement", ipa: "[rɪˈpleɪsmənt]", ko: "대체품; 재발급품", pos: "n.",
          ex: { en: "I need a replacement for this damaged card.", ko: "이 손상된 카드를 재발급받아야 해요." },
        },
        {
          en: "refund", ipa: "[ˈriːfʌnd]", ko: "환불", pos: "n.",
          ex: { en: "Can I get a refund for the canceled tour?", ko: "취소된 투어를 환불받을 수 있을까요?" },
        },
      ],
    },
    {
      name: "식당 이용",
      icon: "🍽️",
      words: [
        {
          en: "reservation", ipa: "[ˌrezərˈveɪʃn]", ko: "예약", pos: "n.",
          ex: { en: "We have a reservation for seven o'clock.", ko: "일곱 시로 예약했어요." },
        },
        {
          en: "table for two", ipa: "[ˌteɪbl fər ˈtuː]", ko: "2인용 자리", pos: "n.",
          ex: { en: "A table for two, please.", ko: "두 명 자리 부탁합니다." },
        },
        {
          en: "appetizer", ipa: "[ˈæpətaɪzər]", ko: "전채 요리", pos: "n.",
          ex: { en: "Let's share one appetizer.", ko: "전채 요리 하나를 같이 먹어요." },
        },
        {
          en: "main course", ipa: "[ˈmeɪn kɔːrs]", ko: "주요리", pos: "n.",
          ex: { en: "Fish is the main course today.", ko: "오늘 주요리는 생선이에요." },
        },
        {
          en: "side dish", ipa: "[ˈsaɪd dɪʃ]", ko: "곁들임 요리, 반찬", pos: "n.",
          ex: { en: "Does this meal come with a side dish?", ko: "이 식사에는 곁들임 요리가 나오나요?" },
        },
        {
          en: "tap water", ipa: "[ˈtæp wɔːtər]", ko: "수돗물", pos: "n.",
          ex: { en: "Is the tap water safe to drink here?", ko: "여기 수돗물은 마셔도 안전한가요?" },
        },
        {
          en: "bill", ipa: "[bɪl]", ko: "계산서", pos: "n.",
          ex: { en: "Could we have the bill, please?", ko: "계산서 부탁합니다." },
        },
        {
          en: "service charge", ipa: "[ˈsɜːrvɪs tʃɑːrdʒ]", ko: "봉사료, 서비스 요금", pos: "n.",
          ex: { en: "The service charge is included in the bill.", ko: "봉사료는 계산서에 포함되어 있어요." },
        },
        {
          en: "tip", ipa: "[tɪp]", ko: "팁, 봉사료", pos: "n.",
          ex: { en: "We left a small tip on the table.", ko: "우리는 탁자에 팁을 조금 두었어요." },
        },
      ],
    },
    {
      name: "장보기",
      icon: "🛒",
      words: [
        {
          en: "grocery store", ipa: "[ˈɡroʊsəri stɔːr]", ko: "식료품점", pos: "n.",
          ex: { en: "The grocery store closes at nine.", ko: "식료품점은 아홉 시에 문을 닫아요." },
        },
        {
          en: "shopping list", ipa: "[ˈʃɑːpɪŋ lɪst]", ko: "장보기 목록", pos: "n.",
          ex: { en: "Bread is at the top of my shopping list.", ko: "장보기 목록 맨 위에 빵이 있어요." },
        },
        {
          en: "basket", ipa: "[ˈbæskɪt]", ko: "장바구니, 바구니", pos: "n.",
          ex: { en: "I only need a basket for these items.", ko: "이 물건들에는 장바구니 하나면 충분해요." },
        },
        {
          en: "cart", ipa: "[kɑːrt]", ko: "쇼핑 카트", pos: "n.",
          ex: { en: "The cart is full of vegetables.", ko: "카트에 채소가 가득해요." },
        },
        {
          en: "aisle", ipa: "[aɪl]", ko: "통로, 매대 사이 길", pos: "n.",
          ex: { en: "The cereal is in aisle five.", ko: "시리얼은 5번 통로에 있어요." },
        },
        {
          en: "checkout", ipa: "[ˈtʃekaʊt]", ko: "계산대", pos: "n.",
          ex: { en: "There is a short line at the checkout.", ko: "계산대 줄이 짧아요." },
        },
        {
          en: "label", ipa: "[ˈleɪbl]", ko: "라벨, 표시 사항", pos: "n.",
          ex: { en: "Read the label before you buy it.", ko: "사기 전에 라벨을 읽어 보세요." },
        },
        {
          en: "ingredient", ipa: "[ɪnˈɡriːdiənt]", ko: "재료, 성분", pos: "n.",
          ex: { en: "This sauce has only four ingredients.", ko: "이 소스에는 재료가 네 가지만 들어가요." },
        },
        {
          en: "expiration date", ipa: "[ˌekspəˈreɪʃn deɪt]", ko: "유통기한, 소비기한", pos: "n.",
          ex: { en: "Check the expiration date on the milk.", ko: "우유의 소비기한을 확인하세요." },
        },
      ],
    },
    {
      name: "주방 기초",
      icon: "🍳",
      words: [
        {
          en: "chopping board", ipa: "[ˈtʃɑːpɪŋ bɔːrd]", ko: "도마", pos: "n.",
          ex: { en: "Put the vegetables on the chopping board.", ko: "채소를 도마 위에 놓으세요." },
        },
        {
          en: "frying pan", ipa: "[ˈfraɪɪŋ pæn]", ko: "프라이팬", pos: "n.",
          ex: { en: "Heat the oil in a frying pan.", ko: "프라이팬에 기름을 데우세요." },
        },
        {
          en: "saucepan", ipa: "[ˈsɔːspæn]", ko: "손잡이가 달린 냄비", pos: "n.",
          ex: { en: "Warm the soup in a small saucepan.", ko: "작은 냄비에 수프를 데우세요." },
        },
        {
          en: "kettle", ipa: "[ˈketl]", ko: "주전자", pos: "n.",
          ex: { en: "The kettle is boiling.", ko: "주전자의 물이 끓고 있어요." },
        },
        {
          en: "microwave", ipa: "[ˈmaɪkrəweɪv]", ko: "전자레인지", pos: "n.",
          ex: { en: "Heat the rice in the microwave.", ko: "밥을 전자레인지에 데우세요." },
        },
        {
          en: "sink", ipa: "[sɪŋk]", ko: "싱크대, 개수대", pos: "n.",
          ex: { en: "The dirty cups are in the sink.", ko: "더러운 컵은 싱크대에 있어요." },
        },
        {
          en: "dishwasher", ipa: "[ˈdɪʃwɑːʃər]", ko: "식기세척기", pos: "n.",
          ex: { en: "Please load the dishwasher after dinner.", ko: "저녁 식사 뒤에 식기세척기에 그릇을 넣어 주세요." },
        },
        {
          en: "leftovers", ipa: "[ˈleftoʊvərz]", ko: "남은 음식", pos: "n.",
          ex: { en: "We ate the leftovers for lunch.", ko: "우리는 점심으로 남은 음식을 먹었어요." },
        },
        {
          en: "recipe", ipa: "[ˈresəpi]", ko: "조리법, 레시피", pos: "n.",
          ex: { en: "This recipe is easy to follow.", ko: "이 조리법은 따라 하기 쉬워요." },
        },
      ],
    },
    {
      name: "집안일",
      icon: "🧹",
      words: [
        {
          en: "laundry", ipa: "[ˈlɔːndri]", ko: "세탁물; 빨래", pos: "n.",
          ex: { en: "I do the laundry on Saturday morning.", ko: "저는 토요일 아침에 빨래해요." },
        },
        {
          en: "washing machine", ipa: "[ˈwɑːʃɪŋ məˌʃiːn]", ko: "세탁기", pos: "n.",
          ex: { en: "The washing machine is running.", ko: "세탁기가 돌아가고 있어요." },
        },
        {
          en: "vacuum cleaner", ipa: "[ˈvækjuːm ˌkliːnər]", ko: "진공청소기", pos: "n.",
          ex: { en: "The vacuum cleaner is in the closet.", ko: "진공청소기는 벽장 안에 있어요." },
        },
        {
          en: "mop", ipa: "[mɑːp]", ko: "대걸레; 대걸레질하다", pos: "n., v.",
          ex: { en: "Use this mop on the kitchen floor.", ko: "주방 바닥에는 이 대걸레를 쓰세요." },
        },
        {
          en: "broom", ipa: "[bruːm]", ko: "빗자루", pos: "n.",
          ex: { en: "Sweep the steps with a broom.", ko: "빗자루로 계단을 쓸어 주세요." },
        },
        {
          en: "dust", ipa: "[dʌst]", ko: "먼지; 먼지를 털다", pos: "n., v.",
          ex: { en: "There is dust under the shelf.", ko: "선반 아래에 먼지가 있어요." },
        },
        {
          en: "tidy up", ipa: "[ˈtaɪdi ʌp]", ko: "정리하다", pos: "phr.v.",
          ex: { en: "Let's tidy up the living room first.", ko: "먼저 거실을 정리해요." },
        },
        {
          en: "take out the trash", ipa: "[teɪk aʊt ðə træʃ]", ko: "쓰레기를 내다 버리다", pos: "expr.",
          ex: { en: "Please take out the trash tonight.", ko: "오늘 밤에 쓰레기를 내다 버려 주세요." },
        },
        {
          en: "fold", ipa: "[foʊld]", ko: "접다", pos: "v.",
          ex: { en: "Could you fold these towels?", ko: "이 수건들을 개어 주시겠어요?" },
        },
      ],
    },
    {
      name: "아침과 저녁 루틴",
      icon: "⏰",
      words: [
        {
          en: "shower", ipa: "[ˈʃaʊər]", ko: "샤워; 샤워하다", pos: "n., v.",
          ex: { en: "I take a quick shower before work.", ko: "저는 출근 전에 간단히 샤워해요." },
        },
        {
          en: "toothbrush", ipa: "[ˈtuːθbrʌʃ]", ko: "칫솔", pos: "n.",
          ex: { en: "I packed a new toothbrush for the trip.", ko: "여행을 위해 새 칫솔을 챙겼어요." },
        },
        {
          en: "toothpaste", ipa: "[ˈtuːθpeɪst]", ko: "치약", pos: "n.",
          ex: { en: "We need another tube of toothpaste.", ko: "치약 한 통이 더 필요해요." },
        },
        {
          en: "comb", ipa: "[koʊm]", ko: "빗; 빗질하다", pos: "n., v.",
          ex: { en: "I keep a comb in my bag.", ko: "저는 가방에 빗을 넣어 다녀요." },
        },
        {
          en: "get dressed", ipa: "[ɡet drest]", ko: "옷을 입다", pos: "expr.",
          ex: { en: "The children get dressed after breakfast.", ko: "아이들은 아침을 먹고 옷을 입어요." },
        },
        {
          en: "pack a lunch", ipa: "[pæk ə lʌntʃ]", ko: "도시락을 싸다", pos: "expr.",
          ex: { en: "I pack a lunch on busy days.", ko: "바쁜 날에는 도시락을 싸요." },
        },
        {
          en: "commute", ipa: "[kəˈmjuːt]", ko: "통근하다; 통근", pos: "v., n.",
          ex: { en: "She commutes by train every morning.", ko: "그녀는 매일 아침 기차로 통근해요." },
        },
        {
          en: "bedtime", ipa: "[ˈbedtaɪm]", ko: "잠자리에 들 시간", pos: "n.",
          ex: { en: "I turn off my phone before bedtime.", ko: "저는 잠자리에 들기 전에 휴대폰을 꺼요." },
        },
        {
          en: "oversleep", ipa: "[ˌoʊvərˈsliːp]", ko: "늦잠 자다", pos: "v.",
          ex: { en: "Set two alarms so you do not oversleep.", ko: "늦잠 자지 않도록 알람을 두 개 맞추세요." },
        },
      ],
    },
    {
      name: "진료와 약",
      icon: "🩺",
      words: [
        {
          en: "appointment", ipa: "[əˈpɔɪntmənt]", ko: "예약, 약속", pos: "n.",
          ex: { en: "I have a doctor's appointment at two.", ko: "두 시에 진료 예약이 있어요." },
        },
        {
          en: "clinic", ipa: "[ˈklɪnɪk]", ko: "의원, 진료소", pos: "n.",
          ex: { en: "The clinic is open on Saturday mornings.", ko: "그 의원은 토요일 오전에 문을 열어요." },
        },
        {
          en: "symptom", ipa: "[ˈsɪmptəm]", ko: "증상", pos: "n.",
          ex: { en: "When did this symptom begin?", ko: "이 증상은 언제 시작됐나요?" },
        },
        {
          en: "sore throat", ipa: "[ˌsɔːr ˈθroʊt]", ko: "인후통, 목 아픔", pos: "n.",
          ex: { en: "I have a sore throat and a mild fever.", ko: "목이 아프고 미열이 있어요." },
        },
        {
          en: "cough", ipa: "[kɔːf]", ko: "기침; 기침하다", pos: "n., v.",
          ex: { en: "This cough keeps me awake at night.", ko: "이 기침 때문에 밤에 잠을 못 자요." },
        },
        {
          en: "allergy", ipa: "[ˈælərdʒi]", ko: "알레르기", pos: "n.",
          ex: { en: "I have an allergy to peanuts.", ko: "저는 땅콩 알레르기가 있어요." },
        },
        {
          en: "prescription", ipa: "[prɪˈskrɪpʃn]", ko: "처방전", pos: "n.",
          ex: { en: "Take this prescription to the pharmacy.", ko: "이 처방전을 약국에 가져가세요." },
        },
        {
          en: "painkiller", ipa: "[ˈpeɪnkɪlər]", ko: "진통제", pos: "n.",
          ex: { en: "The nurse gave me a mild painkiller.", ko: "간호사가 순한 진통제를 주었어요." },
        },
        {
          en: "recover", ipa: "[rɪˈkʌvər]", ko: "회복하다", pos: "v.",
          ex: { en: "You need time to recover from the flu.", ko: "독감에서 회복하려면 시간이 필요해요." },
        },
      ],
    },
    {
      name: "전화와 인터넷",
      icon: "📱",
      words: [
        {
          en: "signal", ipa: "[ˈsɪɡnəl]", ko: "통신 신호", pos: "n.",
          ex: { en: "There is no phone signal in this tunnel.", ko: "이 터널에서는 휴대폰 신호가 잡히지 않아요." },
        },
        {
          en: "Wi-Fi", ipa: "[ˈwaɪ faɪ]", ko: "와이파이", pos: "n.",
          ex: { en: "Is free Wi-Fi available in the lobby?", ko: "로비에서 무료 와이파이를 이용할 수 있나요?" },
        },
        {
          en: "mobile data", ipa: "[ˈmoʊbl ˈdeɪtə]", ko: "모바일 데이터", pos: "n.",
          ex: { en: "Turn off mobile data when you land.", ko: "도착하면 모바일 데이터를 끄세요." },
        },
        {
          en: "battery", ipa: "[ˈbætəri]", ko: "배터리", pos: "n.",
          ex: { en: "My phone battery is almost empty.", ko: "휴대폰 배터리가 거의 다 됐어요." },
        },
        {
          en: "power bank", ipa: "[ˈpaʊər bæŋk]", ko: "보조 배터리", pos: "n.",
          ex: { en: "I keep a power bank in my backpack.", ko: "저는 배낭에 보조 배터리를 넣어 다녀요." },
        },
        {
          en: "voicemail", ipa: "[ˈvɔɪsmeɪl]", ko: "음성 메시지", pos: "n.",
          ex: { en: "Please leave a voicemail after the tone.", ko: "신호음 뒤에 음성 메시지를 남겨 주세요." },
        },
        {
          en: "video call", ipa: "[ˈvɪdioʊ kɔːl]", ko: "영상 통화", pos: "n.",
          ex: { en: "We have a video call every Friday.", ko: "우리는 금요일마다 영상 통화를 해요." },
        },
        {
          en: "log in", ipa: "[lɔːɡ ɪn]", ko: "로그인하다", pos: "phr.v.",
          ex: { en: "Use your email address to log in.", ko: "이메일 주소로 로그인하세요." },
        },
        {
          en: "log out", ipa: "[lɔːɡ aʊt]", ko: "로그아웃하다", pos: "phr.v.",
          ex: { en: "Remember to log out on a shared computer.", ko: "공용 컴퓨터에서는 로그아웃하는 것을 잊지 마세요." },
        },
      ],
    },
    {
      name: "약속과 모임",
      icon: "🗓️",
      words: [
        {
          en: "free time", ipa: "[ˌfriː ˈtaɪm]", ko: "자유 시간, 여가", pos: "n.",
          ex: { en: "What do you do in your free time?", ko: "여가 시간에 무엇을 하세요?" },
        },
        {
          en: "make plans", ipa: "[meɪk plænz]", ko: "약속을 잡다, 계획을 세우다", pos: "expr.",
          ex: { en: "Let's make plans for the weekend.", ko: "주말 약속을 잡아요." },
        },
        {
          en: "get together", ipa: "[ɡet təˈɡeðər]", ko: "모이다, 만나다", pos: "phr.v.",
          ex: { en: "Our friends get together once a month.", ko: "우리 친구들은 한 달에 한 번 모여요." },
        },
        {
          en: "be on time", ipa: "[bi ɑːn taɪm]", ko: "제시간에 오다", pos: "expr.",
          ex: { en: "Please be on time for the movie.", ko: "영화 시간에 늦지 말아 주세요." },
        },
        {
          en: "reschedule", ipa: "[ˌriːˈskedʒuːl]", ko: "일정을 다시 잡다", pos: "v.",
          ex: { en: "Can we reschedule lunch for Thursday?", ko: "점심 약속을 목요일로 다시 잡을 수 있을까요?" },
        },
        {
          en: "invitation", ipa: "[ˌɪnvɪˈteɪʃn]", ko: "초대; 초대장", pos: "n.",
          ex: { en: "Thank you for the dinner invitation.", ko: "저녁 초대 고마워요." },
        },
        {
          en: "host", ipa: "[hoʊst]", ko: "주최자, 초대한 사람", pos: "n.",
          ex: { en: "The host welcomed everyone at the door.", ko: "주최자가 문에서 모두를 맞이했어요." },
        },
        {
          en: "guest", ipa: "[ɡest]", ko: "손님, 초대받은 사람", pos: "n.",
          ex: { en: "Each guest brought something to eat.", ko: "손님마다 먹을 것을 하나씩 가져왔어요." },
        },
        {
          en: "bring a friend", ipa: "[brɪŋ ə frend]", ko: "친구를 데려오다", pos: "expr.",
          ex: { en: "You can bring a friend to the picnic.", ko: "소풍에 친구를 데려와도 돼요." },
        },
      ],
    },
    {
      name: "사무실 물건",
      icon: "🖇️",
      words: [
        {
          en: "workstation", ipa: "[ˈwɜːrksteɪʃn]", ko: "업무용 자리, 워크스테이션", pos: "n.",
          ex: { en: "Your workstation is next to the window.", ko: "당신의 업무용 자리는 창문 옆이에요." },
        },
        {
          en: "keyboard", ipa: "[ˈkiːbɔːrd]", ko: "키보드", pos: "n.",
          ex: { en: "This keyboard is quiet and comfortable.", ko: "이 키보드는 조용하고 편해요." },
        },
        {
          en: "mouse", ipa: "[maʊs]", ko: "컴퓨터 마우스", pos: "n.",
          ex: { en: "The wireless mouse needs a new battery.", ko: "무선 마우스에 새 배터리가 필요해요." },
        },
        {
          en: "monitor", ipa: "[ˈmɑːnɪtər]", ko: "모니터", pos: "n.",
          ex: { en: "The second monitor is for video calls.", ko: "두 번째 모니터는 영상 통화용이에요." },
        },
        {
          en: "notebook", ipa: "[ˈnoʊtbʊk]", ko: "공책, 노트", pos: "n.",
          ex: { en: "Write the phone number in your notebook.", ko: "전화번호를 공책에 적으세요." },
        },
        {
          en: "stapler", ipa: "[ˈsteɪplər]", ko: "스테이플러", pos: "n.",
          ex: { en: "Could I borrow your stapler?", ko: "스테이플러를 빌릴 수 있을까요?" },
        },
        {
          en: "folder", ipa: "[ˈfoʊldər]", ko: "서류철; 폴더", pos: "n.",
          ex: { en: "Put the signed form in this folder.", ko: "서명한 양식을 이 서류철에 넣으세요." },
        },
        {
          en: "photocopier", ipa: "[ˈfoʊtoʊkɑːpiər]", ko: "복사기", pos: "n.",
          ex: { en: "The photocopier is out of paper.", ko: "복사기에 종이가 떨어졌어요." },
        },
        {
          en: "break room", ipa: "[ˈbreɪk ruːm]", ko: "직원 휴게실", pos: "n.",
          ex: { en: "There is fresh coffee in the break room.", ko: "직원 휴게실에 갓 내린 커피가 있어요." },
        },
      ],
    },
    {
      name: "회의 기초",
      icon: "👥",
      words: [
        {
          en: "agenda", ipa: "[əˈdʒendə]", ko: "회의 안건, 의제", pos: "n.",
          ex: { en: "The first item on the agenda is the budget.", ko: "첫 번째 회의 안건은 예산이에요." },
        },
        {
          en: "meeting minutes", ipa: "[ˈmiːtɪŋ ˈmɪnɪts]", ko: "회의록", pos: "n.",
          ex: { en: "I will send the meeting minutes this afternoon.", ko: "오늘 오후에 회의록을 보내겠습니다." },
        },
        {
          en: "attendee", ipa: "[əˌtenˈdiː]", ko: "참석자", pos: "n.",
          ex: { en: "Each attendee received a name tag.", ko: "참석자마다 이름표를 받았어요." },
        },
        {
          en: "presenter", ipa: "[prɪˈzentər]", ko: "발표자", pos: "n.",
          ex: { en: "The presenter answered three questions.", ko: "발표자가 질문 세 개에 답했어요." },
        },
        {
          en: "take notes", ipa: "[teɪk noʊts]", ko: "메모하다", pos: "expr.",
          ex: { en: "Please take notes during the training.", ko: "교육 중에 메모해 주세요." },
        },
        {
          en: "action item", ipa: "[ˈækʃn ˌaɪtəm]", ko: "후속 실행 항목", pos: "n.",
          ex: { en: "Updating the schedule is my action item.", ko: "일정 갱신이 제가 맡은 후속 실행 항목이에요." },
        },
        {
          en: "follow-up", ipa: "[ˈfɑːloʊ ʌp]", ko: "후속 조치", pos: "n.",
          ex: { en: "We need a follow-up after the client call.", ko: "고객 통화 뒤에 후속 조치가 필요해요." },
        },
        {
          en: "conference room", ipa: "[ˈkɑːnfərəns ruːm]", ko: "회의실", pos: "n.",
          ex: { en: "The conference room is on the third floor.", ko: "회의실은 3층에 있어요." },
        },
        {
          en: "wrap up", ipa: "[ræp ʌp]", ko: "마무리하다", pos: "phr.v.",
          ex: { en: "Let's wrap up the meeting by four.", ko: "네 시까지 회의를 마무리해요." },
        },
      ],
    },
    {
      name: "업무 관리",
      icon: "✅",
      words: [
        {
          en: "workload", ipa: "[ˈwɜːrkloʊd]", ko: "업무량", pos: "n.",
          ex: { en: "My workload is lighter this week.", ko: "이번 주에는 업무량이 더 적어요." },
        },
        {
          en: "checklist", ipa: "[ˈtʃeklɪst]", ko: "점검 목록", pos: "n.",
          ex: { en: "Use this checklist before you submit the file.", ko: "파일을 제출하기 전에 이 점검 목록을 사용하세요." },
        },
        {
          en: "instruction", ipa: "[ɪnˈstrʌkʃn]", ko: "지시 사항, 설명", pos: "n.",
          ex: { en: "The first instruction is easy to follow.", ko: "첫 번째 지시 사항은 따라 하기 쉬워요." },
        },
        {
          en: "assignment", ipa: "[əˈsaɪnmənt]", ko: "맡은 업무, 과제", pos: "n.",
          ex: { en: "This assignment should take two days.", ko: "이 업무에는 이틀 정도 걸릴 거예요." },
        },
        {
          en: "responsibility", ipa: "[rɪˌspɑːnsəˈbɪləti]", ko: "책임, 담당 업무", pos: "n.",
          ex: { en: "Booking the room is my responsibility.", ko: "회의실 예약은 제 담당이에요." },
        },
        {
          en: "handover", ipa: "[ˈhændoʊvər]", ko: "업무 인계", pos: "n.",
          ex: { en: "We have a handover meeting on Monday.", ko: "월요일에 업무 인계 회의가 있어요." },
        },
        {
          en: "approval", ipa: "[əˈpruːvl]", ko: "승인", pos: "n.",
          ex: { en: "The plan needs the manager's approval.", ko: "그 계획은 관리자의 승인이 필요해요." },
        },
        {
          en: "reminder", ipa: "[rɪˈmaɪndər]", ko: "알림, 상기시키는 것", pos: "n.",
          ex: { en: "I set a reminder for the deadline.", ko: "마감일 알림을 설정했어요." },
        },
        {
          en: "status update", ipa: "[ˈsteɪtəs ˌʌpdeɪt]", ko: "진행 상황 보고", pos: "n.",
          ex: { en: "Please give us a short status update.", ko: "진행 상황을 짧게 알려 주세요." },
        },
      ],
    },
    {
      name: "이메일 기초",
      icon: "📧",
      words: [
        {
          en: "subject line", ipa: "[ˈsʌbdʒɪkt laɪn]", ko: "이메일 제목 줄", pos: "n.",
          ex: { en: "Keep the subject line short and clear.", ko: "이메일 제목은 짧고 명확하게 쓰세요." },
        },
        {
          en: "attachment", ipa: "[əˈtætʃmənt]", ko: "첨부 파일", pos: "n.",
          ex: { en: "The price list is in the attachment.", ko: "가격표는 첨부 파일에 있어요." },
        },
        {
          en: "inbox", ipa: "[ˈɪnbɑːks]", ko: "받은편지함", pos: "n.",
          ex: { en: "I check my inbox after lunch.", ko: "저는 점심 뒤에 받은편지함을 확인해요." },
        },
        {
          en: "reply", ipa: "[rɪˈplaɪ]", ko: "답장하다; 답장", pos: "v., n.",
          ex: { en: "Please reply by Friday morning.", ko: "금요일 오전까지 답장해 주세요." },
        },
        {
          en: "forward", ipa: "[ˈfɔːrwərd]", ko: "전달하다", pos: "v.",
          ex: { en: "Could you forward the email to Mina?", ko: "그 이메일을 미나에게 전달해 주시겠어요?" },
        },
        {
          en: "recipient", ipa: "[rɪˈsɪpiənt]", ko: "수신자", pos: "n.",
          ex: { en: "Check the recipient before you send the message.", ko: "메시지를 보내기 전에 수신자를 확인하세요." },
        },
        {
          en: "sender", ipa: "[ˈsendər]", ko: "발신자", pos: "n.",
          ex: { en: "I do not know the sender of this email.", ko: "이 이메일의 발신자를 모르겠어요." },
        },
        {
          en: "signature", ipa: "[ˈsɪɡnətʃər]", ko: "서명; 이메일 서명란", pos: "n.",
          ex: { en: "Add your phone number to your email signature.", ko: "이메일 서명란에 전화번호를 추가하세요." },
        },
        {
          en: "out of office", ipa: "[ˌaʊt əv ˈɔːfɪs]", ko: "부재중인", pos: "expr.",
          ex: { en: "I will be out of office until Tuesday.", ko: "화요일까지 자리를 비울 예정입니다." },
        },
      ],
    },
    {
      name: "구직과 근무 형태",
      icon: "💼",
      words: [
        {
          en: "job opening", ipa: "[ˈdʒɑːb oʊpənɪŋ]", ko: "채용 공고, 빈 일자리", pos: "n.",
          ex: { en: "I found a job opening near my home.", ko: "집 근처에서 채용 공고를 찾았어요." },
        },
        {
          en: "résumé", ipa: "[ˈrezəmeɪ]", ko: "이력서", pos: "n.",
          ex: { en: "Please send your résumé as a PDF.", ko: "이력서를 PDF로 보내 주세요." },
        },
        {
          en: "cover letter", ipa: "[ˈkʌvər ˌletər]", ko: "자기소개서, 지원 동기서", pos: "n.",
          ex: { en: "Her cover letter explains why she wants the job.", ko: "그녀의 자기소개서에는 그 일을 원하는 이유가 나와 있어요." },
        },
        {
          en: "qualification", ipa: "[ˌkwɑːləfɪˈkeɪʃn]", ko: "자격, 자격 요건", pos: "n.",
          ex: { en: "Customer service experience is a useful qualification.", ko: "고객 응대 경험은 유용한 자격 요건이에요." },
        },
        {
          en: "professional reference", ipa: "[prəˈfeʃənl ˈrefrəns]", ko: "직무 관련 추천인", pos: "n.",
          ex: { en: "The employer asked for one professional reference.", ko: "고용주가 직무 관련 추천인 한 명을 요청했어요." },
        },
        {
          en: "part-time", ipa: "[ˌpɑːrt ˈtaɪm]", ko: "시간제의", pos: "adj.",
          ex: { en: "He has a part-time job at a bookstore.", ko: "그는 서점에서 시간제로 일해요." },
        },
        {
          en: "full-time", ipa: "[ˌfʊl ˈtaɪm]", ko: "상근의, 전일제의", pos: "adj.",
          ex: { en: "She starts full-time work next month.", ko: "그녀는 다음 달부터 상근으로 일해요." },
        },
        {
          en: "shift", ipa: "[ʃɪft]", ko: "근무 교대; 근무 시간대", pos: "n.",
          ex: { en: "My morning shift begins at seven.", ko: "제 아침 근무는 일곱 시에 시작해요." },
        },
        {
          en: "training", ipa: "[ˈtreɪnɪŋ]", ko: "교육, 훈련", pos: "n.",
          ex: { en: "New staff receive two days of training.", ko: "신입 직원은 이틀 동안 교육을 받아요." },
        },
      ],
    },
  ],
};

export default draftExpansion;
