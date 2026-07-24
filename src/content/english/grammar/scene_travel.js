/**
 * C2 여행 장면 — 공항·숙소·식당 실전 회화 (OT 레벨 6장)
 * 입국·표 구매·체크인·요청·식사 주문·결제까지 실제 장면 조합.
 */
const chapters = [
  {
    slug: "ot-08-scene-airport-immigration",
    level: "OT",
    order: 8,
    title: "입국 심사에서 필요한 답을 차분히 말해요",
    titleFr: "Airport arrival & immigration",
    topic: "여권 제시·방문 목적·체류 기간·숙소·신고 물품",
    summary:
      "입국 심사에서 여권과 입국 서류를 제시하고, 방문 목적·체류 기간·숙소·신고 물품을 짧고 정확하게 답해요.",
    duration: "약 16분",
    sections: [
      {
        heading: "1. 여권과 입국 서류를 함께 건네요",
        pattern: "Here is my + 서류.",
        patternKo: "여기 제 ~이/가 있어요.",
        body:
          "직원이 여권이나 입국 서류를 요청하면 **Here is my...**로 건네면서 말해요. 한 개를 건넬 때는 Here is, 여러 개를 함께 건넬 때는 Here are를 써요.\n\n" +
          "긴 설명을 덧붙이기보다 요청받은 서류를 확인해 차례로 보여 주는 것이 중요해요. 서류 이름을 잘못 들었다면 다시 말해 달라고 요청해요.",
        examples: [
          {
            en: "Here is my passport and arrival card.",
            ipa: "[hɪr ɪz maɪ ˈpæspɔːrt ən əˈraɪvəl kɑːrd]",
            ko: "여기 제 여권과 입국 카드가 있어요.",
            note: "두 서류를 한 묶음처럼 제시해 Here is로 말해요.",
          },
        ],
        tip:
          "여권을 펼쳐 사진이 있는 면이 보이게 건네면 직원이 확인하기 쉬워요.",
      },
      {
        heading: "2. 방문 목적을 짧게 밝혀요",
        pattern: "I'm here for + 목적.",
        patternKo: "~ 목적으로 왔어요.",
        body:
          "방문 목적을 물으면 **I'm here for + 목적**으로 답해요. tourism은 관광, a conference는 학회나 회의 참석, a family visit은 가족 방문을 뜻해요.\n\n" +
          "질문보다 길게 사연을 설명할 필요는 없어요. 실제 목적과 맞는 말 하나를 골라 또렷하게 답해요.",
        examples: [
          {
            en: "I'm here for tourism.",
            ipa: "[aɪm hɪr fər ˈtʊrɪzəm]",
            ko: "관광 목적으로 왔어요.",
            note: "for 뒤에 실제 방문 목적을 넣어요.",
          },
        ],
        pitfall:
          "관광인데 work라고 답하는 식으로 사실과 다른 목적을 말하지 않아요. 모르는 질문은 다시 확인해요.",
      },
      {
        heading: "3. 체류 기간을 말해요",
        pattern: "I'll be staying for + 기간.",
        patternKo: "~ 동안 머물 예정이에요.",
        body:
          "얼마나 머무는지 물으면 **I'll be staying for + 기간**으로 답해요. for 뒤에는 three days, one week처럼 기간을 넣어요.\n\n" +
          "도착일과 출국일을 포함해 실제 일정표와 맞는 기간을 말해요. 날짜 자체를 물으면 until + 날짜로 답할 수 있어요.",
        examples: [
          {
            en: "I'll be staying for five days.",
            ipa: "[aɪl bi ˈsteɪɪŋ fər faɪv deɪz]",
            ko: "5일 동안 머물 예정이에요.",
            note: "for는 체류가 이어지는 기간을 표시해요.",
          },
        ],
        vsKo:
          "한국어는 '5일 있어요'처럼 현재형으로도 일정을 말해요. 영어에서는 예정된 체류를 I'll be staying으로 자연스럽게 표현해요.",
      },
      {
        heading: "4. 머무를 숙소를 알려요",
        pattern: "I'm staying at + 숙소 유형/위치.",
        patternKo: "~에 머물러요.",
        body:
          "숙소를 물으면 **I'm staying at + 숙소 유형이나 위치**로 답해요. 실존 상호를 외우기보다 a hotel near the station처럼 유형과 위치를 말해도 돼요.\n\n" +
          "예약 확인서가 있다면 말로 설명한 뒤 화면이나 종이를 보여 줘요. 주소를 정확히 모르면 추측하지 말고 확인서를 찾아요.",
        examples: [
          {
            en: "I'm staying at a guesthouse near the station.",
            ipa: "[aɪm ˈsteɪɪŋ æt ə ˈɡesthaʊs nɪr ðə ˈsteɪʃən]",
            ko: "역 근처 게스트하우스에 머물러요.",
            note: "상호 대신 숙소 유형과 위치로 설명해요.",
          },
        ],
        tip:
          "숙소 주소와 예약 확인서는 입국 심사 전에 오프라인에서도 열 수 있게 준비해요.",
      },
      {
        heading: "5. 신고할 물품이 없다고 답해요",
        pattern: "I have nothing to declare.",
        patternKo: "신고할 물품이 없어요.",
        body:
          "세관 신고 대상 물품이 없는 경우 **I have nothing to declare**라고 답해요. declare는 가지고 온 물품을 규정에 따라 신고한다는 뜻이에요.\n\n" +
          "신고 대상인지 확실하지 않다면 nothing이라고 단정하지 말고 직원에게 물품을 설명해 확인해요. 실제 규정은 도착지 안내를 따라야 해요.",
        examples: [
          {
            en: "I have nothing to declare.",
            ipa: "[aɪ hæv ˈnʌθɪŋ tə dɪˈkler]",
            ko: "신고할 물품이 없어요.",
            note: "신고 대상이 실제로 없을 때만 사용해요.",
          },
        ],
        pitfall:
          "declare를 단순히 '말하다'로 이해하지 않아요. 입국 장면에서는 세관 신고를 뜻해요.",
      },
      {
        heading: "대화와 연습 — 입국 심사와 세관에서 답하기",
        story: {
          body: [
            {
              narr:
                "대화 예시 1. 여행자가 입국 심사대에서 서류를 건네고 방문 목적과 체류 기간을 답해요.",
            },
            {
              speaker: "Officer",
              en: "May I see your passport and arrival card?",
              ko: "여권과 입국 카드를 볼 수 있을까요?",
            },
            {
              speaker: "Traveler",
              en: "Here is my passport and arrival card.",
              ko: "여기 제 여권과 입국 카드가 있어요.",
            },
            {
              speaker: "Officer",
              en: "What is the purpose of your visit?",
              ko: "방문 목적이 무엇인가요?",
            },
            {
              speaker: "Traveler",
              en: "I'm here for tourism. I'll be staying for five days.",
              ko: "관광 목적으로 왔어요. 5일 동안 머물 예정이에요.",
            },
            {
              narr:
                "대화 예시 2. 여행자가 숙소 위치를 설명하고 세관 신고 여부를 정확히 답해요.",
            },
            {
              speaker: "Officer",
              en: "Where are you staying?",
              ko: "어디에 머무르나요?",
            },
            {
              speaker: "Traveler",
              en: "I'm staying at a guesthouse near the station.",
              ko: "역 근처 게스트하우스에 머물러요.",
            },
            {
              speaker: "Customs staff",
              en: "Do you have anything to declare?",
              ko: "신고할 물품이 있나요?",
            },
            {
              speaker: "Traveler",
              en: "I have nothing to declare.",
              ko: "신고할 물품이 없어요.",
            },
          ],
          questions: [
            {
              id: "ot-08-scene-airport-immigration-sq1",
              type: "order",
              pattern: "I'll be staying for + 기간.",
              q:
                "입국 심사관에게 3일 동안 머물 예정이라고 답해요. 타일을 순서대로 놓아요.",
              tiles: ["I'll", "be", "staying", "for", "three", "days."],
              answer: ["I'll", "be", "staying", "for", "three", "days."],
              ko: "3일 동안 머물 예정이에요.",
              why:
                "I'll be staying 뒤에 for + 기간을 붙여 예정된 체류 기간을 말해요.",
            },
            {
              id: "ot-08-scene-airport-immigration-sq2",
              type: "fill",
              pattern: "I'm here for + 목적.",
              q:
                "관광 목적으로 왔다고 답해요. 빈칸에 방문 목적을 넣어요.",
              en: "I'm here for ［　］.",
              answer: "tourism",
              accept: ["tourism", "Tourism"],
              why:
                "for 뒤에는 방문 목적이 와요. 관광 목적은 tourism으로 말해요.",
            },
            {
              id: "ot-08-scene-airport-immigration-sq3",
              type: "produce",
              prompt:
                "입국 심사관이 방문 목적과 체류 기간을 물어요. 사실에 맞는 짧은 답 두 문장을 영어로 만들어 봐요.",
              model: [
                "I'm here for tourism.",
                "I'll be staying for four days.",
              ],
              guide:
                "목적은 I'm here for..., 기간은 I'll be staying for...로 시작했는지 확인해요.",
            },
          ],
        },
      },
    ],
  },
  {
    slug: "ot-09-scene-airport-tickets-transfers",
    level: "OT",
    order: 9,
    title: "공항에서 표를 사고 환승 정보를 확인해요",
    titleFr: "Airport tickets & transfers",
    topic: "편도표·출발 시각·운임·승강장·환승 여부",
    summary:
      "공항 교통 창구에서 목적지까지 가는 표를 사고, 다음 출발 시각·운임·승강장·환승 여부를 차례로 확인해요.",
    duration: "약 16분",
    sections: [
      {
        heading: "1. 목적지까지 가는 편도표를 요청해요",
        pattern: "I'd like a one-way ticket to + 장소.",
        patternKo: "~까지 가는 편도표 한 장을 주세요.",
        body:
          "표를 살 때 **I'd like a one-way ticket to + 장소**라고 말해요. one-way는 편도, round-trip은 왕복을 뜻해요.\n\n" +
          "목적지를 먼저 정확히 확인하고 표 종류를 고르면 돼요. 인원이나 장수가 더 필요하면 two tickets처럼 수량을 바꿔요.",
        examples: [
          {
            en: "I'd like a one-way ticket to the city center.",
            ipa: "[aɪd laɪk ə ˌwʌn ˈweɪ ˈtɪkɪt tə ðə ˈsɪti ˈsentər]",
            ko: "도심까지 가는 편도표 한 장을 주세요.",
            note: "to 뒤에 표의 목적지를 넣어요.",
          },
        ],
        tip:
          "왕복 시간을 정하지 못했다면 편도와 왕복의 변경·환불 조건을 창구 안내로 확인해요.",
      },
      {
        heading: "2. 다음 교통편의 출발 시각을 물어요",
        pattern: "What time does the next + 교통편 + leave?",
        patternKo: "다음 ~은 몇 시에 출발하나요?",
        body:
          "가장 가까운 출발편을 찾을 때 **What time does the next... leave?**라고 물어요. 교통편 자리에 train, bus, shuttle을 넣을 수 있어요.\n\n" +
          "표시판 시각과 직원의 답을 함께 확인해요. 막차를 묻고 싶다면 next 대신 last를 써요.",
        examples: [
          {
            en: "What time does the next airport bus leave?",
            ipa: "[wʌt taɪm dʌz ðə nekst ˈerpɔːrt bʌs liːv]",
            ko: "다음 공항버스는 몇 시에 출발하나요?",
            note: "does가 있으므로 본동사 leave는 원형으로 써요.",
          },
        ],
        pitfall:
          "What time is the next bus leave?(X)처럼 is와 leave를 그대로 이어 붙이지 않아요. 일반동사 질문에는 does를 써요.",
      },
      {
        heading: "3. 운임이 얼마인지 확인해요",
        pattern: "How much is the fare to + 장소?",
        patternKo: "~까지 운임이 얼마인가요?",
        body:
          "교통비를 물을 때 **How much is the fare to + 장소?**라고 말해요. fare는 버스·기차·택시 같은 교통수단의 운임이에요.\n\n" +
          "가격을 들은 뒤 현금·카드 가능 여부나 추가 요금이 있는지는 별도로 확인해요. 숫자를 놓쳤다면 천천히 다시 말해 달라고 요청해요.",
        examples: [
          {
            en: "How much is the fare to the central station?",
            ipa: "[haʊ mʌtʃ ɪz ðə fer tə ðə ˈsentrəl ˈsteɪʃən]",
            ko: "중앙역까지 운임이 얼마인가요?",
            note: "fare는 교통수단 이용 가격을 뜻해요.",
          },
        ],
        vsKo:
          "한국어는 '표가 얼마예요?'라고 물어도 자연스러워요. 영어에서는 fare를 쓰면 표값뿐 아니라 해당 구간의 운임을 분명히 물을 수 있어요.",
      },
      {
        heading: "4. 출발 승강장을 찾아요",
        pattern: "Which platform does it leave from?",
        patternKo: "어느 승강장에서 출발하나요?",
        body:
          "표를 산 뒤 **Which platform does it leave from?**으로 승강장을 확인해요. it은 앞에서 말한 기차나 버스를 받아요.\n\n" +
          "platform 대신 gate나 stop을 쓰는 교통수단도 있어요. 현장 표지판의 용어를 보고 같은 단어로 되물으면 정확해요.",
        examples: [
          {
            en: "Which platform does it leave from?",
            ipa: "[wɪtʃ ˈplætfɔːrm dʌz ɪt liːv frəm]",
            ko: "어느 승강장에서 출발하나요?",
            note: "from은 출발 지점을 표시해요.",
          },
        ],
        tip:
          "승강장 번호만 듣고 끝내지 말고 출발 시각과 목적지도 전광판에서 다시 맞춰 봐요.",
      },
      {
        heading: "5. 도중에 갈아타야 하는지 물어요",
        pattern: "Do I need to change on the way?",
        patternKo: "가는 도중에 갈아타야 하나요?",
        body:
          "직행인지 확실하지 않을 때 **Do I need to change on the way?**라고 물어요. change는 이 장면에서 교통수단을 갈아탄다는 뜻이에요.\n\n" +
          "환승이 필요하다는 답을 들으면 어느 역인지, 표를 다시 사야 하는지까지 차례로 확인해요. 한꺼번에 여러 질문을 하기보다 하나씩 물어요.",
        examples: [
          {
            en: "Do I need to change on the way?",
            ipa: "[duː aɪ niːd tə tʃeɪndʒ ɑːn ðə weɪ]",
            ko: "가는 도중에 갈아타야 하나요?",
            note: "on the way는 목적지로 가는 도중을 뜻해요.",
          },
        ],
        pitfall:
          "change가 돈을 바꾼다는 뜻도 있지만, 표와 노선을 이야기하는 중이라면 환승을 뜻해요.",
      },
      {
        heading: "대화와 연습 — 교통 창구와 승강장에서 확인하기",
        story: {
          body: [
            {
              narr:
                "대화 예시 1. 여행자가 공항 교통 창구에서 편도표를 사고 출발 시각과 운임을 확인해요.",
            },
            {
              speaker: "Traveler",
              en: "I'd like a one-way ticket to the city center.",
              ko: "도심까지 가는 편도표 한 장을 주세요.",
            },
            {
              speaker: "Ticket staff",
              en: "The next bus leaves in twenty minutes.",
              ko: "다음 버스는 20분 뒤에 출발해요.",
            },
            {
              speaker: "Traveler",
              en: "How much is the fare to the city center?",
              ko: "도심까지 운임이 얼마인가요?",
            },
            {
              speaker: "Ticket staff",
              en: "It is twelve units.",
              ko: "12단위예요.",
            },
            {
              narr:
                "대화 예시 2. 여행자가 출발 구역에서 승강장과 환승 여부를 다시 확인해요.",
            },
            {
              speaker: "Traveler",
              en: "Which platform does it leave from?",
              ko: "어느 승강장에서 출발하나요?",
            },
            {
              speaker: "Station staff",
              en: "It leaves from platform six.",
              ko: "6번 승강장에서 출발해요.",
            },
            {
              speaker: "Traveler",
              en: "Do I need to change on the way?",
              ko: "가는 도중에 갈아타야 하나요?",
            },
            {
              speaker: "Station staff",
              en: "No, this bus goes directly to the city center.",
              ko: "아니요, 이 버스는 도심까지 바로 가요.",
            },
          ],
          questions: [
            {
              id: "ot-09-scene-airport-tickets-transfers-sq1",
              type: "order",
              pattern: "I'd like a one-way ticket to + 장소.",
              q:
                "중앙역까지 가는 편도표 한 장을 요청해요. 타일을 순서대로 놓아요.",
              tiles: ["I'd", "like", "a", "one-way", "ticket", "to", "the central station."],
              answer: ["I'd", "like", "a", "one-way", "ticket", "to", "the central station."],
              ko: "중앙역까지 가는 편도표 한 장을 주세요.",
              why:
                "I'd like 뒤에 표 종류와 to + 목적지를 차례로 붙여요.",
            },
            {
              id: "ot-09-scene-airport-tickets-transfers-sq2",
              type: "fill",
              pattern: "Which platform does it leave from?",
              q:
                "표를 산 뒤 어느 승강장에서 출발하는지 물어요. 빈칸에 장소 명사를 넣어요.",
              en: "Which ［　］ does it leave from?",
              answer: "platform",
              accept: ["platform", "Platform"],
              why:
                "기차나 공항철도의 출발 승강장은 platform으로 말해요.",
            },
            {
              id: "ot-09-scene-airport-tickets-transfers-sq3",
              type: "produce",
              prompt:
                "표를 산 뒤 아직 모르는 정보 하나를 골라 출발 시각·운임·승강장·환승 여부 중 하나를 영어로 물어봐요.",
              model: [
                "What time does the next train leave?",
                "How much is the fare to the city center?",
                "Do I need to change on the way?",
              ],
              guide:
                "필요한 정보 한 가지만 골라 해당 문형으로 짧고 분명하게 질문했는지 확인해요.",
            },
          ],
        },
      },
    ],
  },
  {
    slug: "ot-10-scene-accommodation-check-in-out",
    level: "OT",
    order: 10,
    title: "숙소에 도착해 체크인부터 출발 준비까지 해요",
    titleFr: "Accommodation check-in & check-out",
    topic: "체크인·예약 확인·객실 유형·체크아웃·짐 보관",
    summary:
      "숙소에 도착해 체크인을 요청하고 예약과 객실 유형을 확인한 뒤, 체크아웃 시각과 출발 전 짐 보관을 물어봐요.",
    duration: "약 16분",
    sections: [
      {
        heading: "1. 프런트에서 체크인을 요청해요",
        pattern: "I'd like to check in.",
        patternKo: "체크인하고 싶어요.",
        body:
          "숙소 프런트에 도착하면 **I'd like to check in**으로 용건을 먼저 밝혀요. check in은 도착 등록을 하고 객실을 배정받는 절차예요.\n\n" +
          "직원이 예약 정보나 신분증을 요청하면 준비한 확인서를 차례로 보여 줘요. 긴 인사보다 용건을 먼저 말해도 자연스러워요.",
        examples: [
          {
            en: "Hello, I'd like to check in.",
            ipa: "[həˈloʊ | aɪd laɪk tə tʃek ɪn]",
            ko: "안녕하세요, 체크인하고 싶어요.",
            note: "I'd like to는 원하는 절차를 공손하게 요청해요.",
          },
        ],
        tip:
          "예약 확인 번호와 신분증을 바로 찾을 수 있게 준비하면 체크인이 빨라져요.",
      },
      {
        heading: "2. 예약 기간을 알려요",
        pattern: "I have a reservation for + 기간.",
        patternKo: "~ 동안 예약했어요.",
        body:
          "예약이 있다고 말할 때 **I have a reservation for + 기간**을 써요. for two nights처럼 숙박 일수를 붙이면 같은 이름의 예약을 구분하는 데 도움이 돼요.\n\n" +
          "예약자 이름을 말해야 한다면 실제 예약 정보와 신분증을 기준으로 답해요. 이 레슨에서는 실존 인명을 예문으로 쓰지 않아요.",
        examples: [
          {
            en: "I have a reservation for three nights.",
            ipa: "[aɪ hæv ə ˌrezərˈveɪʃən fər θriː naɪts]",
            ko: "3박 동안 예약했어요.",
            note: "숙박 기간은 nights로 세는 경우가 많아요.",
          },
        ],
        pitfall:
          "3일 일정과 3박 숙박은 다를 수 있어요. 예약 확인서의 nights를 보고 정확히 말해요.",
      },
      {
        heading: "3. 예약한 객실 유형을 확인해요",
        pattern: "Could you confirm my + 예약 항목?",
        patternKo: "제 ~을/를 확인해 주시겠어요?",
        body:
          "객실 유형이나 조식 포함 여부를 다시 확인하려면 **Could you confirm my + 예약 항목?**이라고 말해요. room type, breakfast plan, check-out date 등을 넣을 수 있어요.\n\n" +
          "예약과 현장 안내가 다르면 감정적으로 단정하기보다 확인서를 보여 주고 한 항목씩 대조해요.",
        examples: [
          {
            en: "Could you confirm my room type?",
            ipa: "[kʊd ju kənˈfɜːrm maɪ ruːm taɪp]",
            ko: "제 객실 유형을 확인해 주시겠어요?",
            note: "confirm은 이미 정한 내용을 다시 맞춰 보는 말이에요.",
          },
        ],
        vsKo:
          "한국어의 '맞죠?'보다 Could you confirm...?은 상대에게 기록을 확인해 달라고 구체적으로 요청해요.",
      },
      {
        heading: "4. 체크아웃 시각을 물어요",
        pattern: "What time is check-out?",
        patternKo: "체크아웃은 몇 시인가요?",
        body:
          "퇴실 시각을 확인할 때 **What time is check-out?**이라고 물어요. check-out은 여기서 명사처럼 쓰여 숙소의 퇴실 절차나 시각을 뜻해요.\n\n" +
          "늦은 체크아웃이 필요하면 가능 여부와 추가 비용을 별도로 물어봐요. 정해진 시각을 임의로 넘기지 않아요.",
        examples: [
          {
            en: "What time is check-out tomorrow?",
            ipa: "[wʌt taɪm ɪz ˈtʃek aʊt təˈmɑːroʊ]",
            ko: "내일 체크아웃은 몇 시인가요?",
            note: "내일 퇴실이라면 tomorrow를 덧붙여요.",
          },
        ],
        tip:
          "객실 안내문과 프런트 답이 다르면 최신 안내가 무엇인지 다시 확인해요.",
      },
      {
        heading: "5. 체크아웃 뒤 짐 보관을 부탁해요",
        pattern: "Could you keep my luggage until + 시각?",
        patternKo: "~까지 제 짐을 보관해 주시겠어요?",
        body:
          "체크아웃 뒤 출발까지 시간이 남으면 **Could you keep my luggage until + 시각?**으로 보관 가능 여부를 물어요. until 뒤에는 three o'clock, this evening처럼 끝나는 시점을 넣어요.\n\n" +
          "보관표나 수령 절차가 있다면 안내를 따라요. 귀중품 보관 조건은 숙소 규정을 따로 확인해요.",
        examples: [
          {
            en: "Could you keep my luggage until four o'clock?",
            ipa: "[kʊd ju kiːp maɪ ˈlʌɡɪdʒ ənˈtɪl fɔːr əˈklɑːk]",
            ko: "4시까지 제 짐을 보관해 주시겠어요?",
            note: "until은 보관이 끝나는 시점을 표시해요.",
          },
        ],
        pitfall:
          "luggage는 보통 셀 수 없는 명사로 써요. 짐 한 개를 말하려면 one bag이라고 구체적으로 말해요.",
      },
      {
        heading: "대화와 연습 — 체크인하고 출발 전 짐 맡기기",
        story: {
          body: [
            {
              narr:
                "대화 예시 1. 여행자가 프런트에서 체크인을 요청하고 예약 기간과 객실 유형을 확인해요.",
            },
            {
              speaker: "Traveler",
              en: "Hello, I'd like to check in.",
              ko: "안녕하세요, 체크인하고 싶어요.",
            },
            {
              speaker: "Front desk staff",
              en: "Do you have a reservation?",
              ko: "예약하셨나요?",
            },
            {
              speaker: "Traveler",
              en: "Yes, I have a reservation for three nights.",
              ko: "네, 3박 동안 예약했어요.",
            },
            {
              speaker: "Traveler",
              en: "Could you confirm my room type?",
              ko: "제 객실 유형을 확인해 주시겠어요?",
            },
            {
              narr:
                "대화 예시 2. 여행자가 퇴실 시각을 확인하고 체크아웃 뒤 짐을 맡겨요.",
            },
            {
              speaker: "Traveler",
              en: "What time is check-out tomorrow?",
              ko: "내일 체크아웃은 몇 시인가요?",
            },
            {
              speaker: "Front desk staff",
              en: "Check-out is at eleven.",
              ko: "체크아웃은 11시예요.",
            },
            {
              speaker: "Traveler",
              en: "Could you keep my luggage until four o'clock?",
              ko: "4시까지 제 짐을 보관해 주시겠어요?",
            },
            {
              speaker: "Front desk staff",
              en: "Yes, please bring it to the desk after check-out.",
              ko: "네, 체크아웃 뒤에 데스크로 가져와 주세요.",
            },
          ],
          questions: [
            {
              id: "ot-10-scene-accommodation-check-in-out-sq1",
              type: "order",
              pattern: "I have a reservation for + 기간.",
              q:
                "숙소 직원에게 2박 예약이 있다고 말해요. 타일을 순서대로 놓아요.",
              tiles: ["I", "have", "a", "reservation", "for", "two", "nights."],
              answer: ["I", "have", "a", "reservation", "for", "two", "nights."],
              ko: "2박 동안 예약했어요.",
              why:
                "I have a reservation 뒤에 for + 숙박 기간을 붙여요.",
            },
            {
              id: "ot-10-scene-accommodation-check-in-out-sq2",
              type: "fill",
              pattern: "What time is check-out?",
              q:
                "내일 몇 시에 퇴실해야 하는지 물어요. 빈칸에 숙소 절차를 넣어요.",
              en: "What time is ［　］ tomorrow?",
              answer: "check-out",
              accept: ["check-out", "checkout", "Check-out", "Checkout"],
              why:
                "숙소 퇴실 절차와 시각은 check-out으로 말해요.",
            },
            {
              id: "ot-10-scene-accommodation-check-in-out-sq3",
              type: "produce",
              prompt:
                "프런트에 도착했거나 체크아웃을 앞둔 장면을 골라, 지금 필요한 요청 한 문장을 영어로 만들어 봐요.",
              model: [
                "I'd like to check in.",
                "Could you confirm my room type?",
                "Could you keep my luggage until five o'clock?",
              ],
              guide:
                "체크인은 I'd like to..., 확인이나 보관 부탁은 Could you...?로 시작했는지 확인해요.",
            },
          ],
        },
      },
    ],
  },
  {
    slug: "ot-11-scene-accommodation-requests-problems",
    level: "OT",
    order: 11,
    title: "숙소에서 필요한 것을 요청하고 문제를 알려요",
    titleFr: "Accommodation requests & problems",
    topic: "추가 수건·와이파이·고장·소음·객실 변경",
    summary:
      "숙소에서 추가 수건과 와이파이 정보를 요청하고, 객실 설비 고장이나 소음을 설명해 필요한 해결 방법을 물어봐요.",
    duration: "약 16분",
    sections: [
      {
        heading: "1. 추가 수건을 공손하게 요청해요",
        pattern: "Could I have an extra + 물품, please?",
        patternKo: "추가 ~을/를 받을 수 있을까요?",
        body:
          "객실에 필요한 물품이 더 있으면 **Could I have an extra + 물품, please?**라고 요청해요. towel, blanket, pillow 등을 넣을 수 있어요.\n\n" +
          "수량이 두 개 이상이면 two extra towels처럼 수량과 복수형을 함께 써요. 필요한 물품만 구체적으로 말해요.",
        examples: [
          {
            en: "Could I have an extra towel, please?",
            ipa: "[kʊd aɪ hæv ən ˈekstrə ˈtaʊəl pliːz]",
            ko: "추가 수건 한 장을 받을 수 있을까요?",
            note: "extra는 기본 제공분에 더 필요한 것을 뜻해요.",
          },
        ],
        tip:
          "하우스키핑 방문이 필요한지, 프런트에서 직접 받아야 하는지도 안내에 따라 확인해요.",
      },
      {
        heading: "2. 와이파이 비밀번호를 물어요",
        pattern: "Could you tell me the Wi-Fi password?",
        patternKo: "와이파이 비밀번호를 알려 주시겠어요?",
        body:
          "객실 인터넷 정보를 찾지 못했을 때 **Could you tell me the Wi-Fi password?**라고 물어요. tell me 뒤에 알고 싶은 정보를 바로 붙여요.\n\n" +
          "대문자와 숫자가 섞였다면 종이에 적어 달라고 부탁하거나 안내 카드를 보여 달라고 해요.",
        examples: [
          {
            en: "Could you tell me the Wi-Fi password?",
            ipa: "[kʊd ju tel mi ðə ˈwaɪ faɪ ˈpæswɜːrd]",
            ko: "와이파이 비밀번호를 알려 주시겠어요?",
            note: "tell me 뒤에는 전달받을 정보를 넣어요.",
          },
        ],
        pitfall:
          "공용 공간에서 비밀번호를 큰 소리로 반복하기보다 화면이나 안내 카드를 확인해요.",
      },
      {
        heading: "3. 객실 설비가 작동하지 않는다고 알려요",
        pattern: "The + 설비 + isn't working.",
        patternKo: "~이/가 작동하지 않아요.",
        body:
          "객실 설비가 고장 났거나 반응하지 않으면 **The + 설비 + isn't working**이라고 말해요. air conditioner, heater, shower 등을 넣을 수 있어요.\n\n" +
          "원인을 추측하기보다 작동하지 않는다는 관찰을 먼저 전달해요. 언제부터 문제였는지 알면 함께 말해요.",
        examples: [
          {
            en: "The air conditioner isn't working.",
            ipa: "[ði er kənˈdɪʃənər ˈɪzənt ˈwɜːrkɪŋ]",
            ko: "에어컨이 작동하지 않아요.",
            note: "isn't working은 지금 정상 작동하지 않는 상태를 말해요.",
          },
        ],
        vsKo:
          "한국어의 '고장 났어요'는 원인을 단정할 수 있어요. isn't working은 확인한 증상만 말해 숙소 직원이 점검하기 쉬워요.",
      },
      {
        heading: "4. 객실 소음이 너무 크다고 설명해요",
        pattern: "There is too much + 문제 + in my room.",
        patternKo: "제 방에 ~이/가 너무 많아요.",
        body:
          "객실에서 감당하기 어려운 문제가 이어지면 **There is too much + 문제 + in my room**으로 설명해요. noise, smoke, light처럼 양으로 느끼는 문제를 넣어요.\n\n" +
          "소음의 출처를 확실히 모르면 특정 사람을 지목하지 말고 객실에서 들리는 상황만 말해요.",
        examples: [
          {
            en: "There is too much noise in my room.",
            ipa: "[ðer ɪz tuː mʌtʃ nɔɪz ɪn maɪ ruːm]",
            ko: "제 방에 소음이 너무 많아요.",
            note: "noise는 보통 셀 수 없는 명사로 too much와 함께 써요.",
          },
        ],
        pitfall:
          "too many noise(X)라고 하지 않아요. noise처럼 셀 수 없는 명사에는 too much를 써요.",
      },
      {
        heading: "5. 다른 객실로 옮길 수 있는지 물어요",
        pattern: "Could I move to another room?",
        patternKo: "다른 방으로 옮길 수 있을까요?",
        body:
          "문제가 바로 해결되기 어렵다면 **Could I move to another room?**으로 객실 변경 가능 여부를 물어요. another room은 현재 방과 다른 방 하나를 뜻해요.\n\n" +
          "변경이 가능한지, 추가 비용이 있는지, 짐을 언제 옮길 수 있는지 차례로 확인해요.",
        examples: [
          {
            en: "Could I move to another room?",
            ipa: "[kʊd aɪ muːv tə əˈnʌðər ruːm]",
            ko: "다른 방으로 옮길 수 있을까요?",
            note: "move to는 다른 장소로 옮기는 동작을 말해요.",
          },
        ],
        tip:
          "긴급한 안전 문제가 있다면 객실 변경 협의보다 먼저 안전한 공용 공간으로 이동해 직원에게 알려요.",
      },
      {
        heading: "대화와 연습 — 물품을 요청하고 객실 문제 해결하기",
        story: {
          body: [
            {
              narr:
                "대화 예시 1. 여행자가 프런트에 전화해 추가 수건과 와이파이 정보를 요청해요.",
            },
            {
              speaker: "Traveler",
              en: "Could I have an extra towel, please?",
              ko: "추가 수건 한 장을 받을 수 있을까요?",
            },
            {
              speaker: "Front desk staff",
              en: "Yes, we can bring one to your room.",
              ko: "네, 객실로 한 장 가져다드릴 수 있어요.",
            },
            {
              speaker: "Traveler",
              en: "Could you tell me the Wi-Fi password?",
              ko: "와이파이 비밀번호를 알려 주시겠어요?",
            },
            {
              speaker: "Front desk staff",
              en: "It is written on the information card.",
              ko: "안내 카드에 적혀 있어요.",
            },
            {
              narr:
                "대화 예시 2. 여행자가 에어컨과 소음 문제를 설명하고 객실 변경을 요청해요.",
            },
            {
              speaker: "Traveler",
              en: "The air conditioner isn't working.",
              ko: "에어컨이 작동하지 않아요.",
            },
            {
              speaker: "Front desk staff",
              en: "We can send someone to check it.",
              ko: "직원을 보내 확인할 수 있어요.",
            },
            {
              speaker: "Traveler",
              en: "There is too much noise in my room. Could I move to another room?",
              ko: "제 방에 소음이 너무 많아요. 다른 방으로 옮길 수 있을까요?",
            },
            {
              speaker: "Front desk staff",
              en: "I will check which rooms are available.",
              ko: "이용 가능한 객실을 확인할게요.",
            },
          ],
          questions: [
            {
              id: "ot-11-scene-accommodation-requests-problems-sq1",
              type: "order",
              pattern: "Could I have an extra + 물품, please?",
              q:
                "프런트에 추가 담요 한 장을 요청해요. 타일을 순서대로 놓아요.",
              tiles: ["Could", "I", "have", "an", "extra", "blanket,", "please?"],
              answer: ["Could", "I", "have", "an", "extra", "blanket,", "please?"],
              ko: "추가 담요 한 장을 받을 수 있을까요?",
              why:
                "Could I have 뒤에 an extra + 물품을 붙이고 please로 공손하게 마무리해요.",
            },
            {
              id: "ot-11-scene-accommodation-requests-problems-sq2",
              type: "fill",
              pattern: "The + 설비 + isn't working.",
              q:
                "난방기가 작동하지 않는다고 알려요. 빈칸에 상태를 나타내는 말을 넣어요.",
              en: "The heater isn't ［　］.",
              answer: "working",
              accept: ["working", "Working"],
              why:
                "isn't working은 설비가 지금 정상 작동하지 않는 상태를 말해요.",
            },
            {
              id: "ot-11-scene-accommodation-requests-problems-sq3",
              type: "produce",
              prompt:
                "객실에서 필요한 물품이나 해결해야 할 문제 하나를 골라 프런트에 영어로 말해 봐요.",
              model: [
                "Could I have an extra pillow, please?",
                "The shower isn't working.",
                "Could I move to another room?",
              ],
              guide:
                "물품은 Could I have...?, 고장은 isn't working, 방 변경은 Could I move...?를 활용해요.",
            },
          ],
        },
      },
    ],
  },
  {
    slug: "ot-12-scene-restaurant-ordering-recommendations",
    level: "OT",
    order: 12,
    title: "식당에서 자리를 잡고 추천 메뉴를 주문해요",
    titleFr: "Restaurant seating, recommendations & ordering",
    topic: "인원 말하기·메뉴 요청·추천·주문·물 요청",
    summary:
      "식당에 들어가 인원에 맞는 자리를 요청하고, 메뉴와 추천을 확인한 뒤 음식과 음료를 공손하게 주문해요.",
    duration: "약 16분",
    sections: [
      {
        heading: "1. 인원에 맞는 자리가 있는지 물어요",
        pattern: "Do you have a table for + 인원?",
        patternKo: "~명이 앉을 자리가 있나요?",
        body:
          "식당에 들어가면 **Do you have a table for + 인원?**으로 자리를 요청해요. for one은 한 명, for two는 두 명이 앉을 자리를 뜻해요.\n\n" +
          "예약이 없다면 먼저 인원을 말하고 기다려야 하는지 확인해요. 야외석 같은 조건은 자리가 있는지 들은 뒤 덧붙여요.",
        examples: [
          {
            en: "Do you have a table for two?",
            ipa: "[duː ju hæv ə ˈteɪbəl fər tuː]",
            ko: "두 명이 앉을 자리가 있나요?",
            note: "for 뒤에 식사할 인원수를 넣어요.",
          },
        ],
        tip:
          "혼자라면 for one, 세 명이라면 for three처럼 숫자만 바꾸면 돼요.",
      },
      {
        heading: "2. 메뉴를 보여 달라고 요청해요",
        pattern: "Could I see the + 메뉴, please?",
        patternKo: "~ 메뉴를 볼 수 있을까요?",
        body:
          "메뉴가 보이지 않거나 별도 메뉴가 필요하면 **Could I see the + 메뉴, please?**라고 물어요. menu, drink menu, dessert menu를 넣을 수 있어요.\n\n" +
          "언어가 어려우면 사진 메뉴나 알레르기 안내가 있는지 별도로 요청해요.",
        examples: [
          {
            en: "Could I see the drink menu, please?",
            ipa: "[kʊd aɪ siː ðə drɪŋk ˈmenjuː pliːz]",
            ko: "음료 메뉴를 볼 수 있을까요?",
            note: "see는 메뉴를 받아 살펴본다는 뜻으로 써요.",
          },
        ],
        pitfall:
          "menu를 음식 하나라는 뜻으로 쓰지 않아요. 개별 음식은 dish나 item으로 말해요.",
      },
      {
        heading: "3. 추천 메뉴를 물어요",
        pattern: "What would you recommend?",
        patternKo: "무엇을 추천하시겠어요?",
        body:
          "무엇을 골라야 할지 모르겠다면 **What would you recommend?**라고 물어요. would를 쓰면 직원의 제안을 공손하게 묻는 느낌이에요.\n\n" +
          "맵기나 채식 여부처럼 원하는 조건이 있다면 추천을 받은 뒤 한 가지씩 추가로 확인해요.",
        examples: [
          {
            en: "What would you recommend for a light meal?",
            ipa: "[wʌt wʊd ju ˌrekəˈmend fər ə laɪt miːl]",
            ko: "가벼운 식사로 무엇을 추천하시겠어요?",
            note: "for 뒤에 원하는 식사 조건을 덧붙일 수 있어요.",
          },
        ],
        vsKo:
          "한국어는 '뭐가 맛있어요?'라고 자주 물어요. What would you recommend?는 직원의 추천을 직접 요청하는 표현이에요.",
      },
      {
        heading: "4. 고른 음식이나 음료를 주문해요",
        pattern: "I'd like to order + 음식/음료.",
        patternKo: "~을/를 주문하고 싶어요.",
        body:
          "주문할 메뉴를 정했다면 **I'd like to order + 음식/음료**라고 말해요. 가리키면서 this dish라고 해도 되고 메뉴 이름을 읽어도 돼요.\n\n" +
          "여러 개를 주문할 때는 and로 연결하되, 직원이 하나씩 확인할 수 있게 천천히 말해요.",
        examples: [
          {
            en: "I'd like to order the vegetable soup.",
            ipa: "[aɪd laɪk tə ˈɔːrdər ðə ˈvedʒtəbəl suːp]",
            ko: "채소 수프를 주문하고 싶어요.",
            note: "order 뒤에 고른 음식이나 음료를 넣어요.",
          },
        ],
        tip:
          "메뉴 이름을 읽기 어렵다면 항목을 가리키며 this dish라고 말해도 돼요.",
      },
      {
        heading: "5. 식사 중 물을 요청해요",
        pattern: "Could we have some + 음료, please?",
        patternKo: "~을/를 조금 받을 수 있을까요?",
        body:
          "함께 식사하는 사람을 대표해 음료를 부탁할 때 **Could we have some + 음료, please?**라고 말해요. 혼자라면 we 대신 I를 써도 돼요.\n\n" +
          "water처럼 양으로 요청하는 음료에는 some이 자연스러워요. 병이나 잔의 수를 지정하려면 two bottles처럼 단위를 말해요.",
        examples: [
          {
            en: "Could we have some water, please?",
            ipa: "[kʊd wi hæv səm ˈwɔːtər pliːz]",
            ko: "물을 조금 받을 수 있을까요?",
            note: "some은 정확한 양을 정하지 않은 요청에 잘 어울려요.",
          },
        ],
        pitfall:
          "water를 일반적인 의미로 요청할 때 waters라고 하지 않아요. 개수를 말하려면 glasses of water처럼 단위를 붙여요.",
      },
      {
        heading: "대화와 연습 — 자리를 요청하고 추천 메뉴 주문하기",
        story: {
          body: [
            {
              narr:
                "대화 예시 1. 두 여행자가 식당에 들어가 자리를 요청하고 음료 메뉴를 받아요.",
            },
            {
              speaker: "Traveler",
              en: "Do you have a table for two?",
              ko: "두 명이 앉을 자리가 있나요?",
            },
            {
              speaker: "Restaurant staff",
              en: "Yes, please follow me.",
              ko: "네, 이쪽으로 따라오세요.",
            },
            {
              speaker: "Traveler",
              en: "Could I see the drink menu, please?",
              ko: "음료 메뉴를 볼 수 있을까요?",
            },
            {
              speaker: "Restaurant staff",
              en: "Of course. I will bring it with the food menu.",
              ko: "물론이에요. 음식 메뉴와 함께 가져올게요.",
            },
            {
              narr:
                "대화 예시 2. 여행자가 가벼운 식사를 추천받고 수프와 물을 주문해요.",
            },
            {
              speaker: "Traveler",
              en: "What would you recommend for a light meal?",
              ko: "가벼운 식사로 무엇을 추천하시겠어요?",
            },
            {
              speaker: "Server",
              en: "The vegetable soup is light and warm.",
              ko: "채소 수프가 가볍고 따뜻해요.",
            },
            {
              speaker: "Traveler",
              en: "I'd like to order the vegetable soup. Could we have some water, please?",
              ko: "채소 수프를 주문하고 싶어요. 물도 조금 받을 수 있을까요?",
            },
            {
              speaker: "Server",
              en: "Certainly. I will bring them soon.",
              ko: "물론이에요. 곧 가져올게요.",
            },
          ],
          questions: [
            {
              id: "ot-12-scene-restaurant-ordering-recommendations-sq1",
              type: "order",
              pattern: "Do you have a table for + 인원?",
              q:
                "식당 직원에게 세 명이 앉을 자리가 있는지 물어요. 타일을 순서대로 놓아요.",
              tiles: ["Do", "you", "have", "a", "table", "for", "three?"],
              answer: ["Do", "you", "have", "a", "table", "for", "three?"],
              ko: "세 명이 앉을 자리가 있나요?",
              why:
                "Do you have a table 뒤에 for + 인원수를 붙여요.",
            },
            {
              id: "ot-12-scene-restaurant-ordering-recommendations-sq2",
              type: "fill",
              pattern: "I'd like to order + 음식/음료.",
              q:
                "따뜻한 차를 주문하고 싶다고 말해요. 빈칸에 주문 동사를 넣어요.",
              en: "I'd like to ［　］ some hot tea.",
              answer: "order",
              accept: ["order", "Order"],
              why:
                "I'd like to 뒤에는 동사원형 order를 써서 주문 의사를 말해요.",
            },
            {
              id: "ot-12-scene-restaurant-ordering-recommendations-sq3",
              type: "produce",
              prompt:
                "식당에서 자리를 요청하거나 추천을 받은 뒤, 먹고 싶은 음식이나 음료를 영어로 주문해 봐요.",
              model: [
                "What would you recommend?",
                "I'd like to order the rice dish.",
                "Could I have some water, please?",
              ],
              guide:
                "추천은 What would you recommend?, 주문은 I'd like to order...로 시작해요.",
            },
          ],
        },
      },
    ],
  },
  {
    slug: "ot-13-scene-restaurant-allergies-payment",
    level: "OT",
    order: 13,
    title: "알레르기를 확인하고 안전하게 계산해요",
    titleFr: "Restaurant allergies, exclusions & payment",
    topic: "알레르기·재료 확인·제외 요청·계산서·카드 결제",
    summary:
      "식당에서 알레르기와 피해야 할 재료를 분명히 알리고, 음식의 재료를 확인한 뒤 계산서와 결제 방법을 요청해요.",
    duration: "약 16분",
    sections: [
      {
        heading: "1. 알레르기가 있는 재료를 먼저 알려요",
        pattern: "I'm allergic to + 재료.",
        patternKo: "저는 ~에 알레르기가 있어요.",
        body:
          "음식 알레르기가 있다면 주문 전에 **I'm allergic to + 재료**로 분명히 알려요. nuts, shellfish, dairy처럼 피해야 할 재료를 넣어요. 참고: **shellfish는 새우·게 같은 갑각류와 조개·굴 같은 연체동물을 모두 포함**해요 — 특정 식품만 문제라면 shrimp, crab처럼 개별 이름으로 말하는 게 안전해요.\n\n" +
          "단순한 취향이나 선호와 알레르기는 다르므로 실제 상태에 맞게 말해요. 심한 알레르기라면 교차 접촉 가능성도 직원에게 따로 확인해요.",
        examples: [
          {
            en: "I'm allergic to shellfish.",
            ipa: "[aɪm əˈlɜːrdʒɪk tə ˈʃelfɪʃ]",
            ko: "저는 갑각류·조개류에 알레르기가 있어요.",
            note: "allergic to 뒤에 원인이 되는 재료를 넣어요.",
          },
        ],
        tip:
          "알레르기 정보를 현지 언어로 적은 카드가 있다면 말과 함께 보여 줘요.",
      },
      {
        heading: "2. 음식에 특정 재료가 들어가는지 물어요",
        pattern: "Does this dish contain + 재료?",
        patternKo: "이 음식에 ~이/가 들어가나요?",
        body:
          "메뉴 설명만으로 재료를 알 수 없을 때 **Does this dish contain + 재료?**라고 물어요. contain은 음식 안에 해당 재료가 포함된다는 뜻이에요.\n\n" +
          "소스나 육수에 들어가는 재료도 있을 수 있으므로, 중요한 제한 사항은 직원의 확인을 기다려요.",
        examples: [
          {
            en: "Does this dish contain peanuts?",
            ipa: "[dʌz ðɪs dɪʃ kənˈteɪn ˈpiːnʌts]",
            ko: "이 음식에 땅콩이 들어가나요?",
            note: "does가 있으므로 contain은 원형으로 써요.",
          },
        ],
        pitfall:
          "눈에 보이지 않는다고 재료가 없다고 단정하지 않아요. 소스와 조리 과정까지 직원에게 확인해요.",
      },
      {
        heading: "3. 특정 재료를 빼 달라고 요청해요",
        pattern: "Could you make it without + 재료?",
        patternKo: "~을/를 빼고 만들어 주시겠어요?",
        body:
          "조리 전에 재료를 뺄 수 있는지 **Could you make it without + 재료?**로 물어요. it은 앞에서 고른 음식을 받아요.\n\n" +
          "모든 음식이 변경 가능한 것은 아니므로 직원의 답을 확인해요. 알레르기라면 단순 제외 요청에 그치지 말고 알레르기임을 함께 알려요.",
        examples: [
          {
            en: "Could you make it without cheese?",
            ipa: "[kʊd ju meɪk ɪt wɪˈðaʊt tʃiːz]",
            ko: "치즈를 빼고 만들어 주시겠어요?",
            note: "without 뒤에 제외할 재료를 넣어요.",
          },
        ],
        vsKo:
          "한국어는 '치즈 빼 주세요'처럼 짧게 말해요. Could you make it without...?은 조리 변경이 가능한지 공손하게 묻는 표현이에요.",
      },
      {
        heading: "4. 계산서를 요청해요",
        pattern: "Could we have the bill, please?",
        patternKo: "계산서를 받을 수 있을까요?",
        body:
          "식사를 마치고 계산할 준비가 됐을 때 **Could we have the bill, please?**라고 말해요. 혼자라면 we 대신 I를 써도 돼요.\n\n" +
          "bill은 식사 항목과 금액이 적힌 계산서예요. 테이블 결제인지 계산대 결제인지는 직원 안내를 따라요.",
        examples: [
          {
            en: "Could we have the bill, please?",
            ipa: "[kʊd wi hæv ðə bɪl pliːz]",
            ko: "계산서를 받을 수 있을까요?",
            note: "식사를 마친 뒤 계산 의사를 알리는 표현이에요.",
          },
        ],
        tip:
          "항목과 수량을 확인하고 잘못된 부분이 보이면 결제 전에 차분히 물어봐요.",
      },
      {
        heading: "5. 카드 결제가 가능한지 확인해요",
        pattern: "Can I pay by + 결제 수단?",
        patternKo: "~로 결제할 수 있나요?",
        body:
          "결제 수단을 확인할 때 **Can I pay by + 결제 수단?**이라고 물어요. card, cash 등을 넣을 수 있어요.\n\n" +
          "카드가 가능하다는 답을 들어도 접촉식·비접촉식 여부나 분할 결제가 되는지는 다를 수 있어요. 필요한 조건은 결제 전에 확인해요.",
        examples: [
          {
            en: "Can I pay by card?",
            ipa: "[kæn aɪ peɪ baɪ kɑːrd]",
            ko: "카드로 결제할 수 있나요?",
            note: "by 뒤에 사용할 결제 수단을 넣어요.",
          },
        ],
        pitfall:
          "pay the card(X)라고 하지 않아요. 결제 수단은 pay by card로 말해요.",
      },
      {
        heading: "대화와 연습 — 재료를 확인하고 계산하기",
        story: {
          body: [
            {
              narr:
                "대화 예시 1. 여행자가 알레르기를 먼저 알리고 음식의 재료와 변경 가능 여부를 확인해요.",
            },
            {
              speaker: "Traveler",
              en: "I'm allergic to shellfish.",
              ko: "저는 갑각류·조개류에 알레르기가 있어요.",
            },
            {
              speaker: "Server",
              en: "Thank you for telling me. Which dish are you considering?",
              ko: "알려 주셔서 감사해요. 어떤 음식을 생각하고 계신가요?",
            },
            {
              speaker: "Traveler",
              en: "Does this dish contain shellfish?",
              ko: "이 음식에 갑각류나 조개류가 들어가나요?",
            },
            {
              speaker: "Server",
              en: "I will ask the kitchen and come back.",
              ko: "주방에 확인하고 돌아올게요.",
            },
            {
              narr:
                "대화 예시 2. 여행자가 계산서를 요청하고 카드 결제 가능 여부를 물어요.",
            },
            {
              speaker: "Traveler",
              en: "Could we have the bill, please?",
              ko: "계산서를 받을 수 있을까요?",
            },
            {
              speaker: "Server",
              en: "Certainly. I will bring it to the table.",
              ko: "물론이에요. 테이블로 가져올게요.",
            },
            {
              speaker: "Traveler",
              en: "Can I pay by card?",
              ko: "카드로 결제할 수 있나요?",
            },
            {
              speaker: "Server",
              en: "Yes, you can pay at the counter.",
              ko: "네, 계산대에서 결제할 수 있어요.",
            },
          ],
          questions: [
            {
              id: "ot-13-scene-restaurant-allergies-payment-sq1",
              type: "order",
              pattern: "Does this dish contain + 재료?",
              q:
                "이 음식에 견과류가 들어가는지 물어요. 타일을 순서대로 놓아요.",
              tiles: ["Does", "this", "dish", "contain", "nuts?"],
              answer: ["Does", "this", "dish", "contain", "nuts?"],
              ko: "이 음식에 견과류가 들어가나요?",
              why:
                "Does + this dish + contain + 재료 순서로 질문해요.",
            },
            {
              id: "ot-13-scene-restaurant-allergies-payment-sq2",
              type: "fill",
              pattern: "Could you make it without + 재료?",
              q:
                "양파를 빼고 만들어 달라고 요청해요. 빈칸에 제외를 나타내는 말을 넣어요.",
              en: "Could you make it ［　］ onions?",
              answer: "without",
              accept: ["without", "Without"],
              why:
                "without 뒤에 빼고 싶은 재료를 넣어요.",
            },
            {
              id: "ot-13-scene-restaurant-allergies-payment-sq3",
              type: "produce",
              prompt:
                "주문 전 재료를 확인하거나 식사 뒤 결제할 장면을 골라 필요한 영어 한 문장을 만들어 봐요.",
              model: [
                "I'm allergic to peanuts.",
                "Could you make it without milk?",
                "Can I pay by card?",
              ],
              guide:
                "알레르기는 allergic to, 제외는 without, 결제 수단은 pay by를 활용해요.",
            },
          ],
        },
      },
    ],
  },
];

export default chapters;
