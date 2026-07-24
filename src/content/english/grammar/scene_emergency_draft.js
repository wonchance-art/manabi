/**
 * DRAFT — C1 영어 길·긴급 장면 레슨 2개 초안
 *
 * docs/product-definition.md의 레벨 1 '길·긴급' 공백을 채우는 검수 대기본이다.
 * 기존 OT 챕터 order 1~5 다음의 독립 초안이며, 영어 index·레지스트리·소비 경로에는
 * 연결하지 않는다. 최종 카피·난이도·order·배선은 Claude 검수 뒤 확정한다.
 *
 * story/questions는 기존 문법 챕터의 이야기 연습 계약을 영어에 맞춰 옮겼다.
 * 대사는 en/ipa/ko, fill 문항은 en 필드를 사용한다.
 */

export const ENGLISH_SCENE_EMERGENCY_DRAFT_STATUS = "DRAFT_UNWIRED";

const chapters = [
  {
    slug: "ot-draft-06-directions-transport",
    level: "OT",
    order: 6,
    status: ENGLISH_SCENE_EMERGENCY_DRAFT_STATUS,
    title: "길을 묻고, 안내를 따라 이동해요",
    topic: "길 묻기·방향 안내·교통수단·환승",
    titleFr: "Directions & public transport",
    summary:
      "목적지까지 가는 길을 묻고, 방향 안내를 확인하며, 알맞은 버스·기차와 환승 지점을 물어봐요.",
    duration: "약 15분",
    sections: [
      {
        heading: "1. 처음 말을 걸고 목적지까지 가는 법을 물어요",
        pattern: "Excuse me, how do I get to + 장소?",
        patternIpa: "[ɪkˈskjuːz miː | haʊ də aɪ ɡet tə] + 장소",
        patternKo: "실례합니다, ~에 어떻게 가나요?",
        body:
          "낯선 사람에게 바로 질문하기보다 **Excuse me**로 먼저 말을 걸어요. 그다음 **How do I get to + 장소?**를 붙이면 도보·버스·기차 중 어떤 방법이든 포함해 길을 물을 수 있어요.\n\n" +
          "여기서 get to는 '그곳에 도착하다'라는 한 덩어리예요. 기존 의문문 문법을 다시 설명하기보다, 여행 중 바로 꺼내 쓰는 질문으로 통째로 익혀요.",
        examples: [
          {
            en: "Excuse me, how do I get to the station?",
            ipa: "[ɪkˈskjuːz miː | haʊ də aɪ ɡet tə ðə ˈsteɪʃən]",
            ko: "실례합니다, 역에 어떻게 가나요?",
            note: "목적지만 바꾸면 어디서든 쓸 수 있어요.",
          },
        ],
        tip:
          "상대가 바빠 보이면 'Excuse me' 뒤에 짧게 멈춰 반응을 확인해요. 대답을 들을 준비가 됐을 때 질문을 이어 가면 더 자연스러워요.",
      },
      {
        heading: "2. 가는 방향이 맞는지 확인해요",
        pattern: "Is this the right way to + 장소?",
        patternIpa: "[ɪz ðɪs ðə raɪt weɪ tə] + 장소",
        patternKo: "이쪽이 ~로 가는 길이 맞나요?",
        body:
          "안내를 들었지만 갈림길에서 확신이 없을 때 **Is this the right way to...?**로 확인해요. 손으로 현재 방향을 가리키며 말하면 this가 '지금 제가 가는 이쪽'을 뜻해요.\n\n" +
          "right는 여기서 '오른쪽'이 아니라 **맞는**이라는 뜻이에요. 오른쪽 방향은 turn right처럼 동사 turn과 함께 나와요.",
        examples: [
          {
            en: "Is this the right way to the museum?",
            ipa: "[ɪz ðɪs ðə raɪt weɪ tə ðə mjuˈziːəm]",
            ko: "이쪽이 박물관으로 가는 길이 맞나요?",
            note: "right way는 '오른쪽 길'이 아니라 '맞는 길'이에요.",
          },
        ],
        pitfall:
          "right가 나왔다고 무조건 오른쪽으로 돌면 안 돼요. the right way는 '맞는 길', turn right는 '오른쪽으로 돌다'로 덩어리를 구분해요.",
      },
      {
        heading: "3. 직진하고 모퉁이에서 도는 안내를 알아들어요",
        pattern: "Go straight and turn left/right at + 지점.",
        patternIpa: "[ɡoʊ streɪt ən tɜːrn left/raɪt æt] + 지점",
        patternKo: "곧장 가서 ~에서 왼쪽/오른쪽으로 도세요.",
        body:
          "길 안내의 뼈대는 **Go straight**와 **turn left/right**예요. 어디에서 도는지는 at the corner, at the light처럼 **at + 지점**으로 붙여요.\n\n" +
          "안내를 들을 때 모든 단어를 잡으려 하지 말고 straight, left/right, corner처럼 방향을 바꾸는 핵심어부터 들어요. 순서를 놓쳤다면 한 단계씩 다시 말해 달라고 요청해도 괜찮아요.",
        examples: [
          {
            en: "Go straight and turn left at the corner.",
            ipa: "[ɡoʊ streɪt ən tɜːrn left æt ðə ˈkɔːrnər]",
            ko: "곧장 가서 모퉁이에서 왼쪽으로 도세요.",
            note: "동작 순서는 go straight 다음 turn left예요.",
          },
        ],
        tip:
          "왼손의 엄지와 검지를 펴면 L 모양이 돼요. left를 순간적으로 놓칠 때 쓸 수 있는 간단한 확인법이에요.",
      },
      {
        heading: "4. 목적지로 가는 버스나 기차를 골라요",
        pattern: "Which bus/train should I take to + 장소?",
        patternIpa: "[wɪtʃ bʌs/treɪn ʃʊd aɪ teɪk tə] + 장소",
        patternKo: "~에 가려면 어느 버스/기차를 타야 하나요?",
        body:
          "**Which bus/train should I take...?**는 여러 노선 중 하나를 골라 달라는 질문이에요. 영어에서는 교통수단을 이용한다는 뜻으로 take a bus, take a train을 써요.\n\n" +
          "정류장에서는 bus, 역에서는 train이나 line을 넣어요. 노선 번호나 색을 들으면 화면이나 표지판과 대조해 확인해요.",
        examples: [
          {
            en: "Which bus should I take to the airport?",
            ipa: "[wɪtʃ bʌs ʃʊd aɪ teɪk tə ði ˈerpɔːrt]",
            ko: "공항에 가려면 어느 버스를 타야 하나요?",
            note: "버스를 실제로 손에 드는 뜻이 아니라 이용한다는 뜻의 take예요.",
          },
        ],
        vsKo:
          "한국어는 '몇 번 버스'처럼 번호를 먼저 묻기도 해요. 영어의 which bus는 번호·노선·종류를 모두 열어 둔 질문이라, 번호를 몰라도 안전하게 시작할 수 있어요.",
      },
      {
        heading: "5. 환승할 역을 물어요",
        pattern: "Where do I change trains for + 장소?",
        patternIpa: "[wer də aɪ tʃeɪndʒ treɪnz fər] + 장소",
        patternKo: "~에 가려면 어디에서 갈아타나요?",
        body:
          "기차나 지하철을 갈아탈 때 **change trains**를 써요. **for + 장소**는 그 목적지 방향으로 가기 위한 환승이라는 뜻이에요.\n\n" +
          "change는 여기서 돈을 바꾸거나 물건을 바꾼다는 뜻이 아니라 **교통수단을 갈아타다**라는 뜻이에요. 영국식 안내에서 자주 들리고, transfer로 바꿔 말해도 뜻이 통해요.",
        examples: [
          {
            en: "Where do I change trains for the city center?",
            ipa: "[wer də aɪ tʃeɪndʒ treɪnz fər ðə ˈsɪti ˈsentər]",
            ko: "도심에 가려면 어디에서 기차를 갈아타나요?",
            note: "change trains는 기차·지하철 환승을 말해요.",
          },
        ],
        pitfall:
          "change **the** train이라고 하면 특정 기차 자체를 바꾸는 느낌이 날 수 있어요. 환승 표현은 관사 없이 change trains로 익혀요.",
      },
      {
        heading: "대화와 연습 — 길 안내소에서 두 번 묻기",
        story: {
          body: [
            {
              narr:
                "대화 예시 1. 여행자가 길모퉁이에서 안내 직원을 발견해 역으로 가는 길을 물어요.",
            },
            {
              speaker: "Traveler",
              en: "Excuse me, how do I get to the station?",
              ipa: "[ɪkˈskjuːz miː | haʊ də aɪ ɡet tə ðə ˈsteɪʃən]",
              ko: "실례합니다, 역에 어떻게 가나요?",
            },
            {
              speaker: "Information staff",
              en: "Go straight and turn left at the corner.",
              ipa: "[ɡoʊ streɪt ən tɜːrn left æt ðə ˈkɔːrnər]",
              ko: "곧장 가서 모퉁이에서 왼쪽으로 도세요.",
            },
            {
              speaker: "Traveler",
              en: "Is this the right way to the station?",
              ipa: "[ɪz ðɪs ðə raɪt weɪ tə ðə ˈsteɪʃən]",
              ko: "이쪽이 역으로 가는 길이 맞나요?",
            },
            {
              speaker: "Information staff",
              en: "Yes. It is about five minutes from here.",
              ipa: "[jes | ɪt ɪz əˈbaʊt faɪv ˈmɪnɪts frəm hɪr]",
              ko: "네. 여기서 약 5분 거리예요.",
            },
            {
              narr:
                "대화 예시 2. 역에 도착한 여행자가 도심행 기차와 환승 지점을 차례로 확인해요.",
            },
            {
              speaker: "Traveler",
              en: "Which train should I take to the city center?",
              ipa: "[wɪtʃ treɪn ʃʊd aɪ teɪk tə ðə ˈsɪti ˈsentər]",
              ko: "도심에 가려면 어느 기차를 타야 하나요?",
            },
            {
              speaker: "Station staff",
              en: "Take the local train from platform two.",
              ipa: "[teɪk ðə ˈloʊkəl treɪn frəm ˈplætfɔːrm tuː]",
              ko: "2번 승강장에서 완행열차를 타세요.",
            },
            {
              speaker: "Traveler",
              en: "Where do I change trains for the city center?",
              ipa: "[wer də aɪ tʃeɪndʒ treɪnz fər ðə ˈsɪti ˈsentər]",
              ko: "도심에 가려면 어디에서 기차를 갈아타나요?",
            },
            {
              speaker: "Station staff",
              en: "Change at the next station and follow the blue signs.",
              ipa: "[tʃeɪndʒ æt ðə nekst ˈsteɪʃən ən ˈfɑːloʊ ðə bluː saɪnz]",
              ko: "다음 역에서 갈아타고 파란색 표지판을 따라가세요.",
            },
          ],
          questions: [
            {
              id: "ot-draft-06-directions-transport-sq1",
              type: "order",
              pattern: "Excuse me, how do I get to + 장소?",
              q:
                "여행자가 되어 진료소로 가는 길을 물어봐요. 타일을 순서대로 놓아 정중하게 질문해요.",
              tiles: [
                "Excuse me,",
                "how",
                "do",
                "I",
                "get",
                "to",
                "the clinic?",
              ],
              answer: [
                "Excuse me,",
                "how",
                "do",
                "I",
                "get",
                "to",
                "the clinic?",
              ],
              ko: "실례합니다, 진료소에 어떻게 가나요?",
              why:
                "Excuse me로 말을 건 뒤, how + do + I + get to + 장소 순서로 질문해요.",
            },
            {
              id: "ot-draft-06-directions-transport-sq2",
              type: "fill",
              pattern: "turn left/right at + 지점",
              q:
                "안내 직원이 '곧장 가서 모퉁이에서 오른쪽으로 도세요'라고 말해요. 빈칸에 방향 동사를 넣어요.",
              en: "Go straight and ［　］ right at the corner.",
              answer: "turn",
              accept: ["turn", "Turn"],
              why:
                "방향을 바꾸는 말은 turn right예요. 어디에서 도는지는 at the corner로 붙여요.",
            },
            {
              id: "ot-draft-06-directions-transport-sq3",
              type: "produce",
              prompt:
                "지금 있는 곳에서 목적지로 가야 해요. 길을 묻거나 탈 교통수단을 고르는 질문을 영어 한 문장으로 만들어 봐요.",
              model: [
                "Excuse me, how do I get to the bus station?",
                "Which train should I take to the airport?",
              ],
              guide:
                "길 자체를 물으면 How do I get to...?, 노선을 고르면 Which bus/train should I take...?로 시작했는지 확인해요.",
            },
          ],
        },
      },
    ],
  },

  {
    slug: "ot-draft-07-illness-lost-property",
    level: "OT",
    order: 7,
    status: ENGLISH_SCENE_EMERGENCY_DRAFT_STATUS,
    title: "아프거나 물건을 잃었을 때 바로 말해요",
    topic: "몸 상태·통증·긴급 요청·분실 신고",
    titleFr: "Illness, emergencies & lost property",
    summary:
      "몸 상태와 아픈 곳을 말하고 긴급 도움을 요청하며, 잃어버린 소지품과 마지막으로 본 곳을 설명해요.",
    duration: "약 15분",
    sections: [
      {
        heading: "1. 몸 상태가 좋지 않다고 먼저 알려요",
        pattern: "I don't feel well.",
        patternIpa: "[aɪ doʊnt fiːl wel]",
        patternKo: "몸이 좋지 않아요.",
        body:
          "**I don't feel well**은 증상을 정확히 모르더라도 몸 상태가 좋지 않다고 알리는 안전한 첫 문장이에요. 안내소·숙소·교통수단 안에서 도움을 청할 때 먼저 말할 수 있어요.\n\n" +
          "I feel sick도 쓰지만 메스꺼움을 뜻할 수 있어요. 원인을 모르는 전반적인 불편함에는 I don't feel well이 더 넓게 통해요.",
        examples: [
          {
            en: "Excuse me, I don't feel well.",
            ipa: "[ɪkˈskjuːz miː | aɪ doʊnt fiːl wel]",
            ko: "실례합니다, 몸이 좋지 않아요.",
            note: "정확한 병명을 몰라도 상태를 알릴 수 있어요.",
          },
        ],
        tip:
          "숨이 차거나 말을 길게 하기 어렵다면 이 한 문장부터 말해요. 그다음 손으로 아픈 곳을 가리켜도 상황 전달에 도움이 돼요.",
      },
      {
        heading: "2. 아픈 신체 부위를 짚어 말해요",
        pattern: "My + 신체 부위 + hurts.",
        patternIpa: "[maɪ] + 신체 부위 + [hɜːrts]",
        patternKo: "~가 아파요.",
        body:
          "아픈 곳 하나를 말할 때 **My ankle hurts**, **My head hurts**처럼 신체 부위 뒤에 hurts를 붙여요. 통증의 종류를 몰라도 위치부터 정확히 전달할 수 있어요.\n\n" +
          "두 눈이나 양쪽 무릎처럼 복수로 말하면 hurt를 써요. 초안에서는 긴 설명보다 신체 부위 + hurt(s)라는 생존 문형에 집중해요.",
        examples: [
          {
            en: "My ankle hurts.",
            ipa: "[maɪ ˈæŋkəl hɜːrts]",
            ko: "발목이 아파요.",
            note: "아픈 곳을 가리키며 말하면 더 분명해요.",
          },
        ],
        pitfall:
          "한국어처럼 'I am hurt my ankle'(X)이라고 이어 붙이지 않아요. 아픈 곳을 주어로 두어 My ankle hurts라고 말해요.",
      },
      {
        heading: "3. 즉시 구급차를 불러 달라고 요청해요",
        pattern: "Please call an ambulance.",
        patternIpa: "[pliːz kɔːl ən ˈæmbjələns]",
        patternKo: "구급차를 불러 주세요.",
        body:
          "즉시 의료 도움이 필요한 상황에서는 **Please call an ambulance**라고 짧고 분명하게 말해요. call은 여기서 전화 통화가 아니라 **불러 달라**는 뜻이에요.\n\n" +
          "긴급 상황에서는 복잡한 공손 표현보다 핵심 요청이 먼저예요. please를 붙이면 짧은 명령형도 무례하지 않게 들려요.",
        examples: [
          {
            en: "Please call an ambulance.",
            ipa: "[pliːz kɔːl ən ˈæmbjələns]",
            ko: "구급차를 불러 주세요.",
            note: "긴급할수록 천천히 또렷하게 말해요.",
          },
        ],
        tip:
          "현지 긴급 전화번호를 확실히 모르면 임의로 번호를 말하지 말고, 주변 직원에게 이 문장으로 즉시 요청해요.",
      },
      {
        heading: "4. 소지품을 찾을 수 없다고 말해요",
        pattern: "I can't find my + 소지품.",
        patternIpa: "[aɪ kænt faɪnd maɪ] + 소지품",
        patternKo: "제 ~을/를 찾을 수 없어요.",
        body:
          "**I can't find my...**는 단순히 눈앞에서 못 찾는 상황부터 분실 신고까지 넓게 쓸 수 있어요. passport, phone, wallet, bag처럼 잃어버린 물건을 뒤에 붙여요.\n\n" +
          "도난을 확신하지 못할 때 stolen이라고 단정하기보다, 먼저 찾을 수 없다는 사실을 말하는 편이 정확해요.",
        examples: [
          {
            en: "I can't find my passport.",
            ipa: "[aɪ kænt faɪnd maɪ ˈpæspɔːrt]",
            ko: "제 여권을 찾을 수 없어요.",
            note: "분실인지 도난인지 모를 때 사실만 정확히 말해요.",
          },
        ],
        vsKo:
          "한국어 '잃어버렸어요'는 사건과 현재 상태를 함께 말할 수 있어요. I can't find...는 지금 찾지 못한다는 상태에 초점을 두어, 원인을 모를 때도 안전하게 쓸 수 있어요.",
      },
      {
        heading: "5. 마지막으로 가지고 있던 곳을 알려요",
        pattern: "I last had it + 장소/시점.",
        patternIpa: "[aɪ læst hæd ɪt] + 장소/시점",
        patternKo: "마지막으로 ~에서/때 그것을 가지고 있었어요.",
        body:
          "분실 신고를 하면 마지막으로 물건을 본 곳이나 가지고 있던 때를 물어봐요. **I last had it + 장소/시점**으로 마지막 확인 지점을 알려요.\n\n" +
          "장소에는 on the train, at the station을, 시점에는 this morning, around noon을 붙일 수 있어요. 기억이 확실하지 않다면 I think를 앞에 붙여 추측임을 밝혀요.",
        examples: [
          {
            en: "I last had it on the train.",
            ipa: "[aɪ læst hæd ɪt ɑːn ðə treɪn]",
            ko: "마지막으로 기차에서 그것을 가지고 있었어요.",
            note: "it은 앞에서 말한 여권·가방 같은 물건을 받아요.",
          },
        ],
        tip:
          "정확한 시각을 모르면 around noon처럼 around를 붙여 대략적인 시간을 말해요. 모르는 정보를 지어내지 않는 것이 분실 신고에서 중요해요.",
      },
      {
        heading: "대화와 연습 — 진료소와 분실물 창구에서 말하기",
        story: {
          body: [
            {
              narr:
                "대화 예시 1. 걷던 중 발목이 아파진 여행자가 가까운 진료소 안내 데스크에서 상태를 말해요.",
            },
            {
              speaker: "Traveler",
              en: "Excuse me, I don't feel well.",
              ipa: "[ɪkˈskjuːz miː | aɪ doʊnt fiːl wel]",
              ko: "실례합니다, 몸이 좋지 않아요.",
            },
            {
              speaker: "Clinic staff",
              en: "Where does it hurt?",
              ipa: "[wer dʌz ɪt hɜːrt]",
              ko: "어디가 아픈가요?",
            },
            {
              speaker: "Traveler",
              en: "My ankle hurts. I can't walk well.",
              ipa: "[maɪ ˈæŋkəl hɜːrts | aɪ kænt wɔːk wel]",
              ko: "발목이 아파요. 잘 걸을 수 없어요.",
            },
            {
              speaker: "Clinic staff",
              en: "Please sit here. I will get help.",
              ipa: "[pliːz sɪt hɪr | aɪ wɪl ɡet help]",
              ko: "여기 앉으세요. 도움을 요청할게요.",
            },
            {
              narr:
                "대화 예시 2. 이동을 마친 여행자가 여권과 가방이 보이지 않아 분실물 창구에서 마지막 위치를 설명해요.",
            },
            {
              speaker: "Traveler",
              en: "I can't find my passport.",
              ipa: "[aɪ kænt faɪnd maɪ ˈpæspɔːrt]",
              ko: "제 여권을 찾을 수 없어요.",
            },
            {
              speaker: "Lost property staff",
              en: "When did you last have it?",
              ipa: "[wen dɪd juː læst hæv ɪt]",
              ko: "마지막으로 언제 가지고 있었나요?",
            },
            {
              speaker: "Traveler",
              en: "I last had it on the train.",
              ipa: "[aɪ læst hæd ɪt ɑːn ðə treɪn]",
              ko: "마지막으로 기차에서 가지고 있었어요.",
            },
            {
              speaker: "Lost property staff",
              en: "Please describe your bag.",
              ipa: "[pliːz dɪˈskraɪb jər bæɡ]",
              ko: "가방을 설명해 주세요.",
            },
            {
              speaker: "Traveler",
              en: "My bag is missing too. It is small and black.",
              ipa: "[maɪ bæɡ ɪz ˈmɪsɪŋ tuː | ɪt ɪz smɔːl ən blæk]",
              ko: "가방도 없어졌어요. 작고 검은색이에요.",
            },
          ],
          questions: [
            {
              id: "ot-draft-07-illness-lost-property-sq1",
              type: "order",
              pattern: "Please call an ambulance.",
              q:
                "주변 사람에게 구급차를 불러 달라고 즉시 요청해야 해요. 타일을 순서대로 놓아 문장을 만들어요.",
              tiles: ["Please", "call", "an", "ambulance."],
              answer: ["Please", "call", "an", "ambulance."],
              ko: "구급차를 불러 주세요.",
              why:
                "Please + call + an ambulance 순서로 핵심 요청을 짧고 분명하게 전달해요.",
            },
            {
              id: "ot-draft-07-illness-lost-property-sq2",
              type: "fill",
              pattern: "I can't find my + 소지품.",
              q:
                "분실물 창구에서 지갑을 찾을 수 없다고 말해요. 빈칸에 '찾다'를 넣어요.",
              en: "I can't ［　］ my wallet.",
              answer: "find",
              accept: ["find", "Find"],
              why:
                "can't 뒤에는 동사원형 find가 와요. I can't find my wallet로 현재 찾지 못하는 상태를 알려요.",
            },
            {
              id: "ot-draft-07-illness-lost-property-sq3",
              type: "produce",
              prompt:
                "진료소나 분실물 창구 중 한 장면을 골라, 지금 가장 먼저 알려야 할 사실을 영어 한 문장으로 말해 봐요.",
              model: [
                "My knee hurts.",
                "I can't find my phone.",
                "I last had it at the station.",
              ],
              guide:
                "아픈 곳은 My ... hurts, 잃어버린 물건은 I can't find my ..., 마지막 위치는 I last had it ...으로 시작해요.",
            },
          ],
        },
      },
    ],
  },
];

export default chapters;
