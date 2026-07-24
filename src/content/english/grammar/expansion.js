/**
 * F4-5 영어 문법 확장 — 7챕터 정본화
 *
 * A1·A2·B1(2)·B2·C1·C2의 독립적 운용 공백 7개. Claude 검수 완료 (f4-zh-en-canon 브랜치).
 * 기존 레벨별 챕터와 분리되어 있으며, 레슨 매핑 시 F1 어댑터를 통해 통합.
 */

export const ENGLISH_GRAMMAR_EXPANSION_STATUS = "DRAFT_UNWIRED";

const chapters = [
  // DRAFT: 기존 A1 대명사·소유격 챕터와 분리해 거리·수 지시와 명사 반복 회피만 다룬다.
  {
    slug: "a1-draft-09-demonstratives-one",
    level: "A1",
    order: 9,
    status: ENGLISH_GRAMMAR_EXPANSION_STATUS,
    title: "이 컵, 저 컵, 그리고 큰 걸로 주세요",
    topic: "지시사 this/that/these/those·대용 one/ones",
    titleFr: "Demonstratives & one / ones",
    summary:
      "가까운지 먼지, 하나인지 여럿인지에 따라 this·that·these·those를 고르고, 같은 명사를 반복하지 않도록 one·ones로 받아요.",
    duration: "약 9분",
    sections: [
      {
        heading: "거리와 수를 동시에 표시해요",
        pattern: "가까운 하나 this · 먼 하나 that · 가까운 여럿 these · 먼 여럿 those",
        patternKo: "이것/저것과 이 사람들/저 사람들을 한 번에 구분",
        body:
          "영어 지시사는 **거리와 수를 동시에** 보여 줘요. 손에 든 컵 하나는 this cup, 건너편 컵 하나는 that cup이에요. 여러 개라면 모양이 바뀌어 these cups, those cups가 돼요.\n\n" +
          "한국어는 '이/그/저'로 거리를 세밀하게 나누지만 단수·복수는 자주 생략해요. 영어는 거리 구분이 더 단순한 대신 **하나와 여럿을 반드시 맞추는 것**이 핵심이에요.",
        table: {
          caption: "거리와 수에 따른 지시사",
          headers: ["거리", "단수", "복수"],
          rows: [
            ["가까움", "this", "these"],
            ["멂", "that", "those"],
          ],
        },
        examples: [
          { en: "This seat is free.", ko: "이 자리는 비어 있어요.", note: "가까운 자리 하나" },
          { en: "Those windows are open.", ko: "저 창문들은 열려 있어요.", note: "먼 창문 여러 개" },
          { en: "Are these your keys?", ko: "이 열쇠들이 당신 것인가요?", note: "these + 복수 are" },
        ],
        pitfall:
          "these와 those 뒤에는 복수 명사와 복수 동사가 와요. 'This keys are'(X), 'These keys are'(O)처럼 지시사·명사·동사를 한 묶음으로 맞추세요.",
      },
      {
        heading: "명사 앞에도, 혼자서도 설 수 있어요",
        pattern: "this book / This is my book.",
        patternKo: "명사를 꾸미거나 명사를 대신하기",
        body:
          "지시사는 명사 앞에서 **this book**처럼 꾸밀 수도 있고, **This is mine.**처럼 혼자 명사를 대신할 수도 있어요. 어느 자리든 거리와 수의 뜻은 그대로예요.\n\n" +
          "전화나 화면 너머의 사람·상황을 가리킬 때는 물리적 거리보다 **대화 속 거리**가 중요해요. 지금 소개하는 내용은 this, 앞서 말했거나 조금 떨어뜨려 보는 내용은 that으로 받는 경우가 많아요.",
        examples: [
          { en: "This is the entrance.", ko: "여기가 입구예요." },
          { en: "That sounds difficult.", ko: "그건 어려울 것 같아요.", note: "앞서 들은 내용을 that으로 받아요." },
          { en: "These are for the meeting.", ko: "이것들은 회의용이에요." },
        ],
        vsKo:
          "한국어의 '그'는 듣는 사람 가까이에 있거나 앞서 말한 대상을 가리킬 수 있어요. 영어 that도 앞선 말 전체를 받을 수 있지만, 사람을 소개할 때는 'This is our guide.'처럼 this를 쓰는 관습이 있어요.",
      },
      {
        heading: "같은 명사를 반복하지 않도록 one으로 받아요",
        pattern: "the red cup → the red one · the small bags → the small ones",
        patternKo: "가산명사 하나는 one, 여럿은 ones",
        body:
          "이미 어떤 명사인지 분명하다면 같은 말을 반복하지 않고 **one/ones**로 받아요. 'the blue cup'을 다시 말할 때 'the blue one', 여러 가방이면 'the light ones'예요.\n\n" +
          "one/ones는 셀 수 있는 명사를 대신해요. 물이나 정보처럼 셀 수 없는 명사를 받을 때는 one을 억지로 붙이지 않고, 필요한 경우 some이나 the information처럼 다른 표현을 써요.",
        examples: [
          { en: "I prefer the smaller one.", ko: "저는 더 작은 걸로 할게요." },
          { en: "Which shoes are yours? The black ones.", ko: "어느 신발이 당신 것인가요? 검은색 신발들이에요." },
          { en: "This pen does not work. Can I use that one?", ko: "이 펜은 안 써져요. 저 펜을 써도 될까요?" },
        ],
        tip:
          "this one, that one, these ones, those ones처럼 지시사와 함께 쓸 수도 있어요. 다만 문맥이 아주 분명하면 'I like these.'처럼 ones를 생략하는 편이 더 자연스러울 때도 있어요.",
      },
    ],
  },

  // DRAFT: 기존 A2 조동사 챕터의 능력·의무와 겹치지 않게 부탁·권유의 대인 거리만 다룬다.
  {
    slug: "a2-draft-10-requests-suggestions",
    level: "A2",
    order: 10,
    status: ENGLISH_GRAMMAR_EXPANSION_STATUS,
    title: "명령하지 않고 부탁하고 제안하는 거리",
    topic: "would like·Would you like·Let's·How about",
    titleFr: "Polite requests, offers & suggestions",
    summary:
      "want보다 부드러운 would like, 상대에게 권하는 Would you like, 함께 정하는 Let's·Why don't we·How about을 상황에 맞게 골라요.",
    duration: "약 10분",
    sections: [
      {
        heading: "want를 한 걸음 부드럽게 만들어요",
        pattern: "would like + 명사 / would like to + 동사원형",
        patternKo: "~을 원해요 / ~하고 싶어요 (공손)",
        body:
          "**would like**는 want보다 부드럽고 공손하게 희망을 말해요. 물건이면 would like + 명사, 행동이면 would like to + 동사원형이에요.\n\n" +
          "가게·안내 데스크·처음 만난 사람과 대화할 때 'I want...'만 쓰면 요구가 너무 직접적으로 들릴 수 있어요. **I'd like...**를 한 덩어리로 익히면 부탁의 온도가 안정돼요.",
        examples: [
          { en: "I'd like a glass of water, please.", ko: "물 한 잔 부탁드려요." },
          { en: "We'd like to check the schedule.", ko: "저희는 일정을 확인하고 싶어요." },
          { en: "I'd like the window seat.", ko: "창가 자리로 하고 싶어요." },
        ],
        pitfall:
          "would like 뒤에 행동을 바로 붙이지 않아요. 'I'd like check'(X), 'I'd like **to check**'(O)처럼 to가 필요해요.",
      },
      {
        heading: "상대에게 권하거나 의향을 물어요",
        pattern: "Would you like + 명사 / Would you like to + 동사원형?",
        patternKo: "~ 드릴까요? / ~하실래요?",
        body:
          "**Would you like...?**는 상대에게 무언가를 권하거나 의향을 묻는 표현이에요. 물건을 권하면 Would you like + 명사, 함께 할 행동을 제안하면 Would you like to + 동사원형을 써요.\n\n" +
          "긍정은 'Yes, please.'나 'I'd love to.', 사양은 'No, thank you.'나 'I'd rather not.'처럼 답하면 자연스러워요. 단순히 Yes/No만 말하는 것보다 관계의 온도가 부드러워져요.",
        examples: [
          { en: "Would you like some tea?", ko: "차 좀 드릴까요?" },
          { en: "Would you like to sit here?", ko: "여기 앉으시겠어요?" },
          { en: "I'd love to, but I have another appointment.", ko: "그러고 싶지만 다른 약속이 있어요." },
        ],
        vsKo:
          "한국어의 '~하실래요?'는 권유와 의향 질문을 함께 처리해요. 영어도 Would you like to가 비슷하지만, 서비스 상황에서 '원하십니까'를 직역한 Do you want보다 더 안전한 기본값이에요.",
      },
      {
        heading: "함께 할 일은 제안의 강도를 골라요",
        pattern: "Let's + 동사원형 · Why don't we + 동사원형? · How about -ing?",
        patternKo: "~하자 / ~하는 게 어때요?",
        body:
          "**Let's**는 화자도 참여하는 직접적인 제안, **Why don't we...?**는 의견을 묻는 제안, **How about -ing?**는 선택지를 가볍게 올리는 표현이에요.\n\n" +
          "세 표현 모두 '함께 무엇을 할지' 정할 때 쓰지만 뒤 모양이 달라요. Let's와 Why don't we 뒤에는 동사원형, How about 뒤에는 **-ing**를 써요.",
        examples: [
          { en: "Let's meet near the station.", ko: "역 근처에서 만나요." },
          { en: "Why don't we take a short break?", ko: "잠깐 쉬는 게 어때요?" },
          { en: "How about meeting after lunch?", ko: "점심 뒤에 만나는 건 어때요?" },
        ],
        pitfall:
          "'How about meet'(X)처럼 동사원형을 바로 두지 않아요. How about 뒤에는 명사나 -ing가 와서 'How about **meeting**?'이 돼요.",
      },
    ],
  },

  // DRAFT: 기존 B1 현재완료·과거시제 비교와 분리해 '과거보다 앞선 과거'만 다룬다.
  {
    slug: "b1-draft-10-past-perfect",
    level: "B1",
    order: 10,
    status: ENGLISH_GRAMMAR_EXPANSION_STATUS,
    title: "과거보다 더 먼저 일어난 일을 세우는 법",
    topic: "과거완료 had+p.p.·by the time",
    titleFr: "Past perfect & earlier past",
    summary:
      "과거 사건이 둘일 때 먼저 일어난 일을 had+p.p.로 한 칸 뒤로 보내고, by the time·already·never로 시간 관계를 또렷하게 만들어요.",
    duration: "약 10분",
    sections: [
      {
        heading: "과거 사건 두 개의 순서를 표시해요",
        pattern: "먼저 일어난 과거: had + p.p. / 나중 과거: 과거형",
        patternKo: "~했었다 / 그 뒤 ~했다",
        body:
          "과거완료는 **과거의 기준점보다 먼저 끝난 일**을 표시해요. 사건이 둘일 때 먼저 일어난 쪽에 had + 과거분사를 붙이고, 기준이 되는 나중 사건은 단순과거로 말해요.\n\n" +
          "한국어는 '이미', '~하고 나서' 같은 말과 문맥으로 순서를 잡지만, 영어는 had+p.p. 자체가 시간 화살표 역할을 해요. 모든 과거에 붙이는 시제가 아니라 **두 과거의 앞뒤가 중요할 때** 쓰는 도구예요.",
        examples: [
          { en: "The train had left when we reached the platform.", ko: "우리가 승강장에 도착했을 때 기차는 이미 떠났어요." },
          { en: "She had saved the file before the computer stopped.", ko: "컴퓨터가 멈추기 전에 그분은 파일을 저장해 두었어요." },
          { en: "I realized that I had taken the wrong bag.", ko: "제가 잘못된 가방을 가져왔다는 걸 깨달았어요." },
        ],
        tip:
          "had는 모든 주어에서 같은 모양이에요. I had, she had, they had로 수일치 부담이 없으니 과거분사 형태에 집중하세요.",
      },
      {
        heading: "순서가 이미 분명하면 과거형만으로도 충분해요",
        pattern: "명확한 연속: past + and then + past / 순서 강조: had + p.p.",
        patternKo: "문맥만으로 충분한지, 앞선 과거를 강조할지 선택",
        body:
          "first, then, after처럼 순서가 이미 분명한 단순 나열에서는 과거형 두 개만 써도 자연스러워요. 과거완료는 **순서가 뒤집혀 말해지거나 원인·결과를 강조할 때** 특히 유용해요.\n\n" +
          "과거완료를 많이 쓴다고 더 고급스러운 건 아니에요. 기준 과거가 제시된 뒤, 그보다 앞선 일을 잠깐 돌아볼 때 쓰고 다시 단순과거로 돌아오는 흐름이 일반적이에요.",
        examples: [
          { en: "I checked the address and then entered the building.", ko: "주소를 확인한 뒤 건물에 들어갔어요.", note: "순서가 명확해 단순과거 두 개" },
          { en: "I entered the building, but I had checked the wrong address.", ko: "건물에 들어갔지만 잘못된 주소를 확인했던 거였어요." },
          { en: "After we finished the meeting, we went outside.", ko: "회의를 마친 뒤 밖으로 나갔어요.", note: "after가 순서를 이미 밝혀요." },
        ],
        pitfall:
          "과거 사건이 하나뿐인데 무조건 had+p.p.를 쓰지 않아요. 'Yesterday I had visited the library'(맥락 없음)는 어색하고, 단순히 'I visited the library'가 맞아요.",
      },
      {
        heading: "by the time과 already로 기준점을 잠가요",
        pattern: "By the time + 과거형, had + p.p.",
        patternKo: "~했을 무렵에는 이미 ~해 있었다",
        body:
          "**by the time**은 '그 시점에 이르렀을 때는'이라는 기준점을 만들어요. 기준점은 단순과거, 그전에 완료된 일은 과거완료로 놓으면 시간 관계가 선명해져요.\n\n" +
          "already·just·never는 had와 과거분사 사이에 두는 경우가 많아요. had already left, had just started, had never seen처럼 완료 시점의 뉘앙스를 보태요.",
        examples: [
          { en: "By the time the doors opened, a long line had formed.", ko: "문이 열렸을 무렵에는 긴 줄이 이미 생겨 있었어요." },
          { en: "The session had just started when the lights went out.", ko: "불이 꺼졌을 때 세션은 막 시작한 참이었어요." },
          { en: "I had never used that tool before the workshop.", ko: "그 워크숍 전에는 그 도구를 한 번도 사용해 본 적이 없었어요." },
        ],
        vsKo:
          "한국어 '~했을 때 이미'는 시간 부사로 앞뒤를 표시해요. 영어는 by the time과 had+p.p.가 함께 기준점과 선행 사건을 문법적으로 나눠 줘요.",
      },
    ],
  },

  // DRAFT: 기존 전치사 결합 챕터와 분리해 마감·지속·대비·예정의 운용 차이만 다룬다.
  {
    slug: "b1-draft-11-deadlines-contingency",
    level: "B1",
    order: 11,
    status: ENGLISH_GRAMMAR_EXPANSION_STATUS,
    title: "마감과 지속, 혹시 모를 상황을 구분해요",
    topic: "by/until·in case·be supposed to",
    titleFr: "Deadlines, duration & contingency",
    summary:
      "마감점 by와 지속 끝점 until, 대비책을 먼저 준비하는 in case, 정해진 기대를 나타내는 be supposed to를 실제 일정 문장으로 구분해요.",
    duration: "약 10분",
    sections: [
      {
        heading: "by는 완료 마감, until은 계속되는 끝점이에요",
        pattern: "finish by Friday · stay until Friday",
        patternKo: "금요일까지 끝내기 / 금요일까지 계속 있기",
        body:
          "**by**는 그 시각보다 늦지 않게 일이 완료되어야 하는 **마감**, **until**은 그 시각까지 상태나 행동이 이어지는 **지속의 끝점**이에요.\n\n" +
          "둘 다 한국어로 '~까지'라서 자주 바뀌어요. 동작이 끝나야 하면 by, 계속되고 있어야 하면 until이라고 질문하면 대부분 정리돼요.",
        examples: [
          { en: "Please send the form by noon.", ko: "정오까지 양식을 보내 주세요.", note: "정오 전에 전송 완료" },
          { en: "The desk is open until noon.", ko: "안내 데스크는 정오까지 열려 있어요.", note: "정오까지 열린 상태 지속" },
          { en: "We need to arrive by six, but we can stay until eight.", ko: "6시까지 도착해야 하지만 8시까지 머물 수 있어요." },
        ],
        pitfall:
          "'Wait by five'는 5시보다 늦지 않게 기다리라는 뜻이 불분명해요. '5시까지 계속 기다려요'라면 wait **until** five를 써요.",
      },
      {
        heading: "in case는 일이 생기기 전에 대비해요",
        pattern: "준비 행동 + in case + 주어 + 현재형",
        patternKo: "혹시 ~할 경우에 대비해서",
        body:
          "**in case**는 어떤 일이 실제로 일어나기 전에 대비책을 마련한다는 뜻이에요. 'Take an umbrella in case it rains.'는 비가 온 뒤 우산을 챙기는 게 아니라, 올지 모르니 미리 챙기는 행동이에요.\n\n" +
          "미래를 말해도 in case 절에는 보통 현재형을 써요. if는 조건이 성립하면 행동하고, in case는 조건이 성립하지 않아도 **미리 행동한다**는 차이가 있어요.",
        examples: [
          { en: "Save a copy in case the connection fails.", ko: "연결이 끊길 경우에 대비해 사본을 저장하세요." },
          { en: "Write down the address in case your phone runs out of power.", ko: "휴대전화 전원이 꺼질 경우에 대비해 주소를 적어 두세요." },
          { en: "Call me if you get lost.", ko: "길을 잃으면 전화하세요.", note: "실제로 길을 잃은 뒤 행동하므로 if" },
        ],
        pitfall:
          "미래 대비라고 'in case it will rain'이라고 쓰지 않아요. 시간·조건절처럼 현재형을 써서 'in case it **rains**'가 기본이에요.",
      },
      {
        heading: "be supposed to는 정해진 기대를 전해요",
        pattern: "be supposed to + 동사원형",
        patternKo: "~하기로 되어 있다 / ~해야 하는 것으로 여겨지다",
        body:
          "**be supposed to**는 일정·규칙·사회적 기대처럼 밖에서 정해진 기준을 말해요. 강한 개인 명령이라기보다 '원래 이렇게 하기로 되어 있다'는 배경을 전해요.\n\n" +
          "과거형 was/were supposed to는 실제로는 이루어지지 않았다는 뉘앙스를 자주 가져요. 'We were supposed to meet at ten.'은 10시에 만나기로 했지만 어긋났다는 맥락으로 이어지기 쉬워요.",
        examples: [
          { en: "The workshop is supposed to start at ten.", ko: "워크숍은 10시에 시작하기로 되어 있어요." },
          { en: "Visitors are supposed to leave their bags here.", ko: "방문객은 가방을 여기에 두게 되어 있어요." },
          { en: "We were supposed to meet outside, but the plan changed.", ko: "밖에서 만나기로 했지만 계획이 바뀌었어요." },
        ],
        tip:
          "should는 화자의 조언이 될 수 있고, be supposed to는 이미 존재하는 일정·규칙·기대를 전달하는 데 강해요. 둘의 출처가 다르다고 생각하세요.",
      },
    ],
  },

  // DRAFT: 기존 비교급·논리 연결어와 분리해 정도가 결과로 이어지는 네 구문만 묶는다.
  {
    slug: "b2-draft-10-degree-result",
    level: "B2",
    order: 10,
    status: ENGLISH_GRAMMAR_EXPANSION_STATUS,
    title: "너무, 충분히, 그래서의 문장 설계",
    topic: "so/such·too/enough 결과 구문",
    titleFr: "Degree & result clauses",
    summary:
      "so와 such가 결과절을 여는 방식, too가 만드는 불가능의 함의, enough의 위치를 품사별로 나눠 정도와 결과를 정확히 연결해요.",
    duration: "약 11분",
    sections: [
      {
        heading: "so는 형용사·부사, such는 명사 덩어리를 강조해요",
        pattern: "so + 형용사/부사 + that · such (a/an) + 명사 + that",
        patternKo: "너무 ~해서 …하다 / 어찌나 ~한 명사인지 …하다",
        body:
          "**so**는 형용사나 부사의 정도를, **such**는 명사 덩어리의 성질을 강조한 뒤 that 결과절로 이어요. so clear that..., such a clear explanation that...처럼 강조하는 중심이 달라요.\n\n" +
          "단수 가산명사 앞에서는 such **a/an**이 필요해요. 복수·불가산명사는 관사 없이 such useful tools, such helpful information처럼 써요.",
        examples: [
          { en: "The instructions were so clear that everyone finished early.", ko: "안내가 아주 명확해서 모두 일찍 끝냈어요." },
          { en: "It was such a clear explanation that no one asked another question.", ko: "설명이 어찌나 명확했는지 아무도 추가 질문을 하지 않았어요." },
          { en: "They provided such useful information that we changed the plan.", ko: "그들은 아주 유용한 정보를 제공해서 우리가 계획을 바꿨어요." },
        ],
        pitfall:
          "'so useful information'(X)처럼 so 뒤에 명사를 바로 두지 않아요. 형용사+명사 덩어리라면 'such useful information'을 써요.",
      },
      {
        heading: "too는 기준을 넘어서 결과가 막힌다는 뜻이에요",
        pattern: "too + 형용사/부사 + to + 동사원형",
        patternKo: "너무 ~해서 …할 수 없다",
        body:
          "**too...to**는 단순히 정도가 크다는 말이 아니라, 필요한 기준을 넘어 **뒤 행동이 어렵거나 불가능하다**는 함의를 가져요. 'too heavy to carry'는 무겁다는 감탄이 아니라 들 수 없다는 결론까지 포함해요.\n\n" +
          "사람을 넣을 때는 too + 형용사 + **for + 목적격 + to**를 써요. 'too fast for me to follow'처럼 누구에게 어려운지 표시할 수 있어요.",
        examples: [
          { en: "The box is too heavy to lift safely.", ko: "그 상자는 너무 무거워서 안전하게 들 수 없어요." },
          { en: "The speaker talked too quickly for me to follow.", ko: "발표자가 너무 빨리 말해서 제가 따라갈 수 없었어요." },
          { en: "It is too late to change the reservation.", ko: "예약을 바꾸기에는 너무 늦었어요." },
        ],
        vsKo:
          "한국어 '너무 좋아요'는 긍정 감탄에도 쓰이지만, 영어 too는 보통 기준 초과와 문제를 암시해요. 단순한 강한 긍정은 very나 really가 더 안전해요.",
      },
      {
        heading: "enough는 꾸미는 품사에 따라 자리가 달라요",
        pattern: "형용사/부사 + enough + to · enough + 명사 + to",
        patternKo: "…할 만큼 충분히 ~하다 / 충분한 명사가 있다",
        body:
          "**enough**가 형용사·부사를 꾸미면 뒤에 와서 clear enough, quickly enough가 돼요. 명사를 꾸미면 앞에 와서 enough time, enough chairs가 돼요.\n\n" +
          "too...to가 기준을 넘어서 실패하는 쪽이라면, enough to는 필요한 기준을 충족해 가능하다는 쪽이에요. 두 구문을 대조하면 결과의 방향이 선명해져요.",
        examples: [
          { en: "The room is quiet enough to record in.", ko: "그 방은 녹음할 만큼 충분히 조용해요." },
          { en: "We have enough time to check the figures again.", ko: "수치를 다시 확인할 시간이 충분해요." },
          { en: "She did not speak loudly enough for everyone to hear.", ko: "그분은 모두가 들을 만큼 충분히 크게 말하지 않았어요." },
        ],
        pitfall:
          "형용사 앞에 enough를 놓지 않아요. 'enough clear'(X), 'clear enough'(O)지만 명사에서는 'enough time'(O)이에요.",
      },
    ],
  },

  // DRAFT: 기존 C1 헤징·정보구조와 분리해 초점부사의 위치가 만드는 범위 차이만 다룬다.
  {
    slug: "c1-draft-09-focus-scope",
    level: "C1",
    order: 9,
    status: ENGLISH_GRAMMAR_EXPANSION_STATUS,
    title: "only와 even의 자리가 바꾸는 뜻",
    topic: "초점부사 only/even·범위",
    titleFr: "Focus adverbs & scope",
    summary:
      "only와 even이 어느 성분에 붙느냐에 따라 제외되는 대안과 놀라움의 초점이 어떻게 달라지는지 읽고, 모호한 문장을 다시 설계해요.",
    duration: "약 11분",
    sections: [
      {
        heading: "only는 바로 뒤의 대안을 지워요",
        pattern: "only + 초점 성분",
        patternKo: "오직 무엇만인지 자리가 결정",
        body:
          "**only**는 초점이 놓인 성분을 제외한 다른 가능성을 지워요. Only the coordinator approved it은 승인한 사람이 그 담당자뿐이고, The coordinator approved only the summary는 승인한 대상이 요약본뿐이에요.\n\n" +
          "일상 회화에서는 only가 동사 앞에 넓게 놓여 억양으로 초점을 드러내기도 하지만, 글에서는 가능한 한 **의도한 성분 가까이** 두어 모호함을 줄이는 편이 좋아요.",
        examples: [
          { en: "Only the morning group received the update.", ko: "오전 그룹만 업데이트를 받았어요.", note: "다른 그룹은 받지 않음" },
          { en: "The morning group only received the update.", ko: "오전 그룹은 업데이트를 받기만 했어요.", note: "읽거나 적용하지 않았다는 대조 가능" },
          { en: "The morning group received only the update.", ko: "오전 그룹은 업데이트만 받았어요.", note: "다른 자료는 받지 않음" },
        ],
        pitfall:
          "'I only discussed the budget with the manager.'는 토론만 했는지, 예산만 다뤘는지, 관리자와만 했는지 모호할 수 있어요. 중요한 문서에서는 only를 초점 바로 앞에 옮겨 쓰세요.",
      },
      {
        heading: "even은 기대 척도의 뜻밖인 끝을 가리켜요",
        pattern: "even + 뜻밖의 초점",
        patternKo: "심지어 ~조차 — 예상 밖의 대안",
        body:
          "**even**은 여러 가능성 가운데 가장 뜻밖이라고 여기는 항목을 가리켜요. Even the beginners finished는 초보자까지 끝냈다는 놀라움이고, The beginners even finished the optional task는 선택 과제까지 끝냈다는 놀라움이에요.\n\n" +
          "놀라움의 기준은 문맥에 달려 있어요. 같은 사실도 누가, 무엇을, 언제 했는지 가운데 어느 부분이 예상 밖인지에 따라 even의 위치가 달라져요.",
        examples: [
          { en: "Even the final section was easy to follow.", ko: "심지어 마지막 부분도 따라가기 쉬웠어요." },
          { en: "The final section even included a checklist.", ko: "마지막 부분에는 체크리스트까지 들어 있었어요." },
          { en: "The team worked even on the holiday.", ko: "그 팀은 휴일에도 일했어요.", note: "예상 밖의 시간에 초점" },
        ],
        vsKo:
          "한국어 '조차/까지/도'는 조사로 초점을 명사 뒤에 붙여요. 영어는 even을 초점 앞이나 절 안의 적절한 자리에 두고 억양으로 다시 표시해요.",
      },
      {
        heading: "모호한 초점을 문장 구조로 다시 고쳐요",
        pattern: "only/even 이동 · cleft로 초점 명시",
        patternKo: "부사 위치와 분열문으로 읽기 하나만 남기기",
        body:
          "초점부사만 옮겨도 뜻이 선명해지지만, 대조가 중요하면 **It was X that...** 분열문이나 문장 분리를 사용할 수 있어요. 'It was only after the review that we noticed the gap.'처럼 시간 초점을 앞으로 꺼내면 오독 가능성이 줄어요.\n\n" +
          "교정할 때는 '다른 누가?', '다른 무엇을?', '다른 언제?'를 차례로 물어보세요. 부정되는 대안이 무엇인지 답하면 only/even의 자리를 결정할 수 있어요.",
        examples: [
          { en: "It was only after the second check that we found the error.", ko: "두 번째 확인 뒤에야 오류를 찾았어요." },
          { en: "We found only one error after the second check.", ko: "두 번째 확인 뒤 오류를 하나만 찾았어요." },
          { en: "Even after the second check, the error remained hidden.", ko: "두 번째 확인 뒤에도 오류는 여전히 발견되지 않았어요." },
        ],
        tip:
          "소리 내어 읽을 때 강세를 둔 단어와 only/even이 가리키는 성분이 같은지 확인하세요. 글에서는 그 강세가 보이지 않으므로 위치가 더 중요해요.",
      },
    ],
  },

  // DRAFT: 기존 C2 수사·번역 챕터와 분리해 반복 제거를 위한 문법적 생략만 다룬다.
  {
    slug: "c2-draft-06-ellipsis-substitution",
    level: "C2",
    order: 6,
    status: ENGLISH_GRAMMAR_EXPANSION_STATUS,
    title: "반복을 지우되 뜻은 남기는 법",
    topic: "조동사·to부정사·절 생략과 대용",
    titleFr: "Ellipsis & substitution",
    summary:
      "앞 문맥이 복원할 수 있는 동사구·to부정사·병렬 성분을 생략하고, 조동사나 do so로 구조를 지탱해 밀도 높은 문장을 만들어요.",
    duration: "약 12분",
    sections: [
      {
        heading: "조동사가 사라진 동사구의 자리를 지켜요",
        pattern: "can / have / will / do + Ø",
        patternKo: "앞에 나온 동사구를 조동사 뒤에서 생략",
        body:
          "앞 문맥에 같은 동사구가 있으면 조동사 뒤에서 반복 부분을 생략할 수 있어요. 'I can attend, but they can't.'에서 can't 뒤에는 attend가 뜻으로 남아 있지만 소리로 반복되지 않아요.\n\n" +
          "시제·상·부정 정보는 조동사가 보존해요. has, will, did 같은 형태를 남겨야 독자가 무엇이 생략됐는지 정확히 복원할 수 있어요.",
        examples: [
          { en: "Some participants can attend in person, but others cannot.", ko: "일부 참가자는 직접 참석할 수 있지만 다른 참가자는 그럴 수 없어요." },
          { en: "I have reviewed the first draft, and the editor has too.", ko: "저도 초안을 검토했고 편집자도 검토했어요." },
          { en: "The first plan did not work, but the revised one did.", ko: "첫 계획은 효과가 없었지만 수정안은 효과가 있었어요." },
        ],
        pitfall:
          "시제를 무시하고 아무 조동사나 남기면 안 돼요. 앞 문장이 has completed라면 뒤에서도 has를 남겨 완료 의미를 보존해야 해요.",
      },
      {
        heading: "to를 남겨 의도한 행동을 복원해요",
        pattern: "want / expect / plan + to + Ø",
        patternKo: "to부정사에서 동사구만 생략",
        body:
          "to부정사가 앞 문맥의 행동을 반복하면 **to만 남기고 동사구를 생략**할 수 있어요. 'I didn't attend, though I wanted to.'에서 to 뒤에는 attend가 복원돼요.\n\n" +
          "to까지 지우면 문장이 끝난 것처럼 보이거나 뜻이 달라질 수 있어요. 특히 want, intend, expect, plan 뒤에서는 생략 표지인 to가 문장의 균형을 지켜 줘요.",
        examples: [
          { en: "I did not speak at the meeting, although I had planned to.", ko: "회의에서 발언하지 않았지만 원래는 발언할 계획이었어요." },
          { en: "The report was not published when we expected it to be.", ko: "그 보고서는 우리가 예상한 때에 발행되지 않았어요.", note: "be는 수동 의미를 보존해요." },
          { en: "You may join the discussion if you would like to.", ko: "원하시면 토론에 참여하셔도 돼요." },
        ],
        tip:
          "be가 의미를 지탱하면 남겨야 해요. 'expected it to be'는 앞의 수동 상태를, 'expected it to'는 앞의 일반 동작을 복원하는 식으로 달라질 수 있어요.",
      },
      {
        heading: "병렬 구조와 do so로 긴 반복을 압축해요",
        pattern: "do so · 병렬 gapping · if/when + necessary/possible",
        patternKo: "행동을 대용하거나 병렬문의 공통 성분 생략",
        body:
          "**do so**는 앞서 말한 행동 전체를 비교적 격식 있게 받아요. 병렬문에서는 두 절의 공통 동사를 두 번째 절에서 지우는 **gapping**도 가능해요. 독자가 빠진 자리를 하나로 복원할 수 있을 때만 안전해요.\n\n" +
          "if necessary, when possible처럼 주어+be를 관습적으로 생략한 축약절도 있어요. 압축의 목적은 짧아 보이는 게 아니라 **이미 주어진 정보를 반복하지 않고 새 정보에 초점을 두는 것**이에요.",
        examples: [
          { en: "Please update the figures and ask the finance team to do so as well.", ko: "수치를 갱신하고 재무팀에도 그렇게 해 달라고 요청하세요." },
          { en: "The first group chose tea; the second, coffee.", ko: "첫 번째 그룹은 차를, 두 번째 그룹은 커피를 골랐어요.", note: "두 번째 절의 chose 생략" },
          { en: "Revise the conclusion if necessary, and shorten the appendix when possible.", ko: "필요하면 결론을 고치고, 가능할 때 부록을 줄이세요." },
        ],
        pitfall:
          "앞에 복원할 행동이 여러 개라 do so가 무엇을 가리키는지 모호하면 생략하지 마세요. 생략은 독자의 추론 비용을 줄일 때만 좋은 문체예요.",
      },
    ],
  },
];

export const englishGrammarExpansion = chapters;

export default chapters;
