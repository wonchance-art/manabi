/**
 * A2 초급 — 시제의 폭을 넓히고 문장에 입체감 더하기
 * 과거·미래·현재완료, 조동사, 비교 — 시험으로만 알던 문법을 입에서 나오는 문법으로.
 */
export default [
  {
    slug: "a2-01-past-simple",
    level: "A2",
    order: 1,
    title: "\"어제 영화 봤어\" — 끝난 일 말하기",
    topic: "과거형·불규칙동사",
    titleFr: "Past simple & irregular verbs",
    summary: "끝난 일을 말하는 과거형. -ed의 발음 삼분법 [t]/[d]/[ɪd]와 피해 갈 수 없는 불규칙동사를 정리해요.",
    duration: "약 10분",
    sections: [
      {
        heading: "과거형의 의미 — 지금과 분리된, 끝난 일",
        pattern: "주어 + 동사-ed + yesterday / last ~ / ~ ago",
        patternKo: "언제인지 짚을 수 있는, 끝난 일",
        body:
          "과거형은 **끝난 일**을 말해요 — 언제인지 짚을 수 있는 과거의 한 장면이죠. 좋은 소식은 **주어가 누구든 모양이 똑같다**는 것(I/she/they worked) — 3인칭 -s 같은 골칫거리가 없어요.\n\n" +
          "yesterday, last week, two days ago, in 2020 같은 **과거 시점 표현**과 단짝이에요. 이 단짝 관계는 5챕터(현재완료)에서 중요한 복선이 되니 기억해두세요.",
        examples: [
          { en: "I watched a movie yesterday.", ko: "어제 영화 봤어요." },
          { en: "She lived in Japan in 2020.", ko: "그녀는 2020년에 일본에 살았어요." },
          { en: "We talked for two hours last night.", ko: "어젯밤에 두 시간 동안 얘기했어요." },
        ],
        tip: "ago는 '~ 전에'인데 어순이 한국어와 같아요 — two days **ago**(이틀 **전에**). 뒤에서 꾸미는 몇 안 되는 영어 단어라 한국인에게 오히려 편한 친구예요.",
      },
      {
        heading: "-ed 발음 삼분법 — [t] / [d] / [ɪd]",
        pattern: "무성음 뒤 [t] · 유성음 뒤 [d] · t/d 뒤 [ɪd]",
        patternKo: "음절이 늘어나는 건 t/d 뒤뿐",
        body:
          "규칙동사의 함정은 철자가 아니라 **발음**이에요 — 무성음 뒤 [t](stopped), 유성음 뒤 [d](played), **t/d 뒤에만** [ɪd](wanted, 음절 하나 추가).\n\n" +
          "원리는 발음하기 편한 쪽으로 닮아가는 것뿐이에요. 단, t/d 뒤에서는 [t]/[d]를 또 붙일 수 없으니 모음을 끼워 [ɪd]가 되는 거죠.",
        table: {
          caption: "-ed 발음 규칙",
          headers: ["발음", "조건", "예시"],
          rows: [
            ["[t]", "무성음 뒤", "stopped [stɑːpt], liked [laɪkt], finished [ˈfɪnɪʃt]"],
            ["[d]", "유성음·모음 뒤", "played [pleɪd], loved [lʌvd], opened [ˈoʊpənd]"],
            ["[ɪd]", "t / d 뒤", "wanted [ˈwɑːntɪd], needed [ˈniːdɪd]"],
          ],
        },
        examples: [
          { en: "I liked the movie.", ipa: "[laɪkt]", ko: "그 영화 좋았어요.", note: "'라이크드'(X) — '라잌트' 한 음절" },
          { en: "She wanted some water.", ipa: "[ˈwɑːntɪd]", ko: "그녀는 물을 원했어요.", note: "여기만 음절이 늘어요" },
          { en: "We stayed at home.", ipa: "[steɪd]", ko: "우리는 집에 있었어요." },
        ],
        pitfall: "한국 학습자는 -ed를 전부 '~드/~이드'로 읽는 경향이 있어요 — liked를 '라이크드'(3음절)처럼요. 실제로는 [laɪkt] 1음절이에요. **[ɪd]로 음절이 늘어나는 건 t/d 뒤뿐** — 나머지는 끝에 살짝 t/d를 붙이는 느낌으로 짧게 처리하세요. 발음이 길어지면 그게 바로 외국인 억양입니다.",
      },
      {
        heading: "불규칙동사 — 자주 쓰는 동사일수록 제멋대로",
        pattern: "go → went · have → had · eat → ate",
        patternKo: "빈도가 높을수록 불규칙 — 입으로 굳히기",
        body:
          "가장 자주 쓰는 동사들은 -ed를 거부하고 **모양을 통째로 바꿔요**. 너무 자주 쓰여서 옛날 형태가 닳지 않고 살아남은 거예요.\n\n" +
          "A2 필수 멤버만 추렸어요. 한꺼번에 다 외우려 하지 말고, 문장 속에서 하나씩 굳히는 게 빨라요.",
        table: {
          caption: "A2 필수 불규칙동사",
          headers: ["원형", "과거형", "뜻"],
          rows: [
            ["go", "went", "가다"],
            ["have", "had", "가지다, 먹다"],
            ["eat", "ate", "먹다"],
            ["see", "saw", "보다"],
            ["come", "came", "오다"],
            ["get", "got", "받다, 얻다"],
            ["make", "made", "만들다"],
            ["take", "took", "가져가다, (탈것을) 타다"],
            ["buy", "bought", "사다"],
            ["think", "thought", "생각하다"],
            ["say / tell", "said / told", "말하다"],
            ["read", "read", "읽다 (철자 같고 발음만 [red])"],
          ],
        },
        examples: [
          { en: "I went to Jeju last summer.", ko: "지난여름에 제주도에 갔어요." },
          { en: "She made kimchi for us.", ko: "그녀가 우리에게 김치를 만들어줬어요." },
          { en: "I read this book in middle school.", ipa: "[red]", ko: "이 책 중학교 때 읽었어요.", note: "과거형 read는 '레드'" },
        ],
        tip: "read의 과거형은 철자가 똑같고 발음만 [riːd]→[red]로 바뀌어요. 소리 내 읽지 않고 눈으로만 공부하면 평생 모르고 지나가는 대표 함정 — 불규칙동사는 꼭 입으로 외우세요.",
      },
      {
        heading: "부정과 의문 — didn't 뒤엔 원형",
        pattern: "didn't + 동사원형 · Did + 주어 + 동사원형?",
        patternKo: "과거 표시는 문장에 한 번만 — did가 가져가요",
        body:
          "과거의 부정·의문은 **did**가 담당해요. A1의 does 원리 그대로 — **과거 표시는 문장에 한 번만**, did가 이미 과거니까 동사는 원형으로 돌아가요.\n\n" +
          "I didn't **go**. (went 아님!) / Did you **see** it? (saw 아님!)",
        examples: [
          { en: "I didn't sleep well last night.", ko: "어젯밤에 잠을 잘 못 잤어요." },
          { en: "Did you have lunch?", ko: "점심 먹었어요?" },
          { en: "She didn't come to the party.", ko: "그녀는 파티에 안 왔어요." },
          { en: "What did you do on the weekend?", ko: "주말에 뭐 했어요?", note: "회화 단골 질문 — 통째로 암기" },
        ],
        pitfall: "'Did you went~?'(X), 'I didn't ate~'(X) — 이중 과거는 A2의 단골 실수예요. did가 등장하는 순간 본동사는 무조건 민낯(원형)! does 때와 똑같은 원리니, '시제 표시는 한 번만'을 주문처럼 외우세요.",
      },
    ],
  },

  {
    slug: "a2-02-past-continuous",
    level: "A2",
    order: 2,
    title: "\"자고 있었는데 전화가 왔어\"",
    topic: "과거진행·used to",
    titleFr: "Past continuous & used to",
    summary: "전화가 왔을 때(사건) 나는 자고 있었다(배경) — 과거를 입체적으로 그리는 was/were -ing, 그리고 '~하곤 했다'의 used to를 정리해요.",
    duration: "약 9분",
    sections: [
      {
        heading: "was/were + -ing — 과거의 배경 화면",
        pattern: "was/were + -ing",
        patternKo: "그 시점에 한창 진행 중이던 일",
        body:
          "과거진행형은 **과거의 한 시점에 한창 진행 중이던 장면**을 그려요. 1챕터의 과거형이 '찰칵' 찍힌 사진(끝난 사건)이라면, 과거진행형은 그 뒤에서 **흐르고 있던 동영상(배경 화면)**이에요.\n\n" +
          "그래서 at 8 p.m. yesterday, at that time처럼 **시점을 콕 찍는 표현**과 단짝이에요 — '어제 저녁 8시에 뭐 하고 있었어요?'",
        examples: [
          { en: "I was watching TV at eight last night.", ko: "어젯밤 8시에 TV를 보고 있었어요." },
          { en: "They were having dinner at that time.", ko: "그때 그들은 저녁을 먹고 있었어요." },
          { en: "What were you doing at ten?", ko: "10시에 뭐 하고 있었어요?" },
        ],
        vsKo: "한국어 **'-고 있었다'**가 정확히 이 시제예요 — '보고 있었어요' = was watching. '-었다'(과거형)와 '-고 있었다'(과거진행)를 가르는 모어 감각을 그대로 가져오면, 두 시제의 분기가 거의 자동으로 끝나요.",
      },
      {
        heading: "when/while — 배경 위에 사건이 끼어든다",
        pattern: "was -ing + when + 과거형 · while + was -ing + 과거형",
        patternKo: "배경은 진행형, 끼어든 사건은 과거형",
        body:
          "두 시제의 진짜 쓸모는 **결합**이에요 — '전화가 왔을 때(사건) 나는 자고 있었다(배경)' = I **was sleeping** when the phone **rang**. 길게 흐르던 배경 위에 짧은 사건이 '탁' 끼어드는 그림이죠.\n\n" +
          "**when은 사건(과거형) 쪽**, **while은 배경(진행형) 쪽**과 단짝이에요 — while I was cooking(요리하는 동안), when he arrived(그가 도착했을 때).",
        table: {
          caption: "past simple vs past continuous",
          headers: ["", "past simple", "past continuous"],
          rows: [
            ["역할", "사건 — '탁' 일어난 일", "배경 — 흐르고 있던 일"],
            ["그림", "사진 한 장", "흐르는 동영상"],
            ["단짝", "when, yesterday, ~ ago", "while, at 8 p.m., at that time"],
            ["예", "the phone rang", "I was sleeping"],
          ],
        },
        examples: [
          { en: "I was sleeping when the phone rang.", ko: "전화가 왔을 때 자고 있었어요.", note: "배경(진행) + 사건(과거)" },
          { en: "While I was cooking, he set the table.", ko: "제가 요리하는 동안 그가 상을 차렸어요." },
          { en: "It started to rain while we were walking home.", ko: "집에 걸어가는 동안 비가 오기 시작했어요." },
        ],
        pitfall: "'When the phone was ringing, I slept.'(X)처럼 역할을 뒤집는 게 전형적 실수예요 — 길게 흐르던 일(자다)이 배경=진행형, 끼어든 일(전화가 오다)이 사건=과거형이에요. 문장을 만들기 전에 '어느 쪽이 동영상이고 어느 쪽이 사진인가?'를 먼저 정하세요.",
      },
      {
        heading: "used to — 지금은 아닌 과거의 습관",
        pattern: "used to + 동사원형",
        patternKo: "예전엔 ~했다 (지금은 아니다)",
        body:
          "**used to + 동사원형**은 과거에 반복된 습관이나 오래 지속된 상태를 말하면서, **'지금은 아니다'라는 뉘앙스가 내장**돼 있어요 — I used to smoke.(예전엔 담배를 피웠어요 — 지금은 끊었고요.)\n\n" +
          "부정·의문은 did의 세계 규칙 그대로예요 — I **didn't use to** like coffee. / **Did you use to** live in Busan? (did가 과거를 가져가니 use로 돌아가요.)",
        examples: [
          { en: "I used to play the piano.", ko: "예전엔 피아노를 쳤어요. (지금은 안 쳐요)" },
          { en: "There used to be a bakery here.", ko: "여기 예전에 빵집이 있었어요.", note: "상태에도 OK — '~하곤 했다'로는 번역이 안 되는 지점" },
          { en: "I didn't use to like coffee, but now I love it.", ko: "예전엔 커피를 안 좋아했는데, 지금은 정말 좋아해요." },
        ],
        vsKo: "한국어 '-곤 했다'와 닮았지만 두 가지가 달라요 — ① used to는 **'지금은 아님'이 기본 내장**이고('피아노 치곤 했다'는 지금 여부가 열려 있죠), ② 상태(살다, 있다)에도 써요. '예전엔 ~했는데 (지금은 아냐)'가 떠오르면 used to — 이게 더 정확한 매핑이에요.",
      },
      {
        heading: "used to vs be used to -ing — 모양만 닮은 남남",
        pattern: "used to + 원형 = 옛 습관 ↔ be used to + -ing = 익숙하다",
        patternKo: "be가 보이면 '익숙하다'",
        body:
          "**be used to + -ing**는 전혀 다른 표현으로, '~에 **익숙하다**'예요 — I'm used to getting up early.(일찍 일어나는 데 익숙해요.) 여기서 used는 형용사이고, to는 부정사가 아니라 전치사라서 **뒤에 -ing**가 와요.\n\n" +
          "구별법은 간단해요 — **앞에 be(am/is/are/was)가 있으면 '익숙하다', 없으면 '옛 습관'**. get used to -ing는 '익숙해지다'예요.",
        examples: [
          { en: "I used to get up early.", ko: "예전엔 일찍 일어났어요. (지금은 아니에요)", note: "옛 습관" },
          { en: "I'm used to getting up early.", ko: "일찍 일어나는 데 익숙해요. (지금 얘기)", note: "be + used to + -ing" },
          { en: "She's getting used to driving in Seoul.", ko: "그녀는 서울 운전에 익숙해지는 중이에요." },
        ],
        pitfall: "'I'm used to get up early.'(X)가 단골 오답이에요 — be used to의 to는 전치사라 뒤에 동사원형이 못 와요. 그리고 발음 함정 하나: used to는 [juːstə] '유스터'로, use(쓰다)의 [juːz]와 달리 **s가 맑은 [s]**예요. '유즈드 투'로 읽으면 어색해져요.",
      },
    ],
  },

  {
    slug: "a2-02-future",
    level: "A2",
    order: 3,
    title: "\"내가 받을게!\"는 will입니다",
    topic: "미래 will·be going to",
    titleFr: "Future: will vs be going to",
    summary: "영어의 두 미래 표현은 한국어 '-ㄹ게'와 '-ㄹ 거야'의 차이와 놀랍도록 닮았어요. 즉석 결정 vs 미리 정한 계획.",
    duration: "약 9분",
    sections: [
      {
        heading: "미래가 두 개인 이유 — 결정의 타이밍",
        pattern: "will = 지금 막 결정(-ㄹ게) · be going to = 이미 정한 계획(-ㄹ 거야)",
        patternKo: "기준: 언제 결정했는가",
        body:
          "학교 영어에서는 둘 다 '~할 것이다'로 배우지만, 가르는 기준은 **언제 결정했는가**예요. **will**은 말하는 지금 이 순간의 결정(즉석 결정·약속·자청), **be going to**는 말하기 전에 이미 정해둔 계획이에요.\n\n" +
          "전화벨이 울릴 때 'I'll get it!'은 벨 소리를 듣고 지금 결정한 거라 will, '나 내년에 유학 가'는 이미 정해둔 계획이라 I'm going to study abroad.",
        examples: [
          { en: "The phone is ringing. — I'll get it!", ko: "전화 온다. — 내가 받을게!", note: "지금 막 결정 → will" },
          { en: "I'm going to study abroad next year.", ko: "내년에 유학 갈 거예요.", note: "이미 정한 계획 → be going to" },
          { en: "It's cold here. — I'll close the window.", ko: "여기 춥네요. — 제가 창문 닫을게요." },
          { en: "We're going to move in March.", ko: "우리 3월에 이사할 거예요." },
        ],
        vsKo: "한국어에도 정확히 같은 구분이 있어요! **'-ㄹ게'**(받을게, 닫을게)는 지금 막 한 결정·약속이고, **'-ㄹ 거야'**(유학 갈 거야)는 이미 정한 계획이죠. '제가 창문 닫을 거예요'가 어색한 것처럼 즉석 결정에 be going to를 쓰면 어색해요. **'-ㄹ게' = will, '-ㄹ 거야' = be going to** — 이 평행 관계 하나면 두 미래의 구분이 끝납니다.",
      },
      {
        heading: "형태 정리 — will은 만능, be going to는 be 변화 주의",
        pattern: "will('ll / won't) + 원형 · am/is/are going to + 원형",
        patternKo: "will은 모양 하나, be going to는 be가 주어 따라 변신",
        body:
          "**will**은 조동사라 주어가 누구든 will + 원형, 축약은 'll, 부정은 won't예요. **be going to**는 be 부분이 주어 따라 변하고(am/is/are), 부정·의문도 be 동사 규칙 그대로예요.\n\n" +
          "회화에서 going to는 **gonna** [ˈɡənə]로 뭉개지는 일이 많아요. 직접 쓰는 건 격식 없는 자리에서만 권하지만, 귀에는 꼭 등록해두세요.",
        examples: [
          { en: "I'll call you tonight.", ko: "오늘 밤에 전화할게요." },
          { en: "He won't be late.", ipa: "[woʊnt]", ko: "그는 늦지 않을 거예요.", note: "won't = will not. want와 발음 구별!" },
          { en: "Are you going to sell your car?", ko: "차 팔 거예요?" },
          { en: "I'm gonna be late!", ipa: "[ˈɡənə]", ko: "나 늦겠다!", note: "구어에서 going to → gonna" },
        ],
        pitfall: "won't [woʊnt]와 want [wɑːnt]는 모음이 달라요 — won't는 '워운트'에 가깝고 want는 '원트'에 가까워요. 'He won't come(안 올 거야)'을 'He want come'처럼 발음하면 정반대 오해가 생길 수 있는, 작지만 위험한 발음 차이예요.",
      },
      {
        heading: "예측 — 근거가 눈에 보이면 going to",
        pattern: "눈앞의 근거 → be going to · 의견·짐작 → will",
        patternKo: "예측: 근거가 눈에 보이면 going to, 짐작이면 will",
        body:
          "예측에는 둘 다 쓰지만 분업이 있어요 — **be going to**는 눈앞의 근거를 보고 하는 예측(먹구름 → It's going to rain.), **will**은 의견·짐작에 기댄 예측(I think he'll like this gift.)으로 I think, probably, maybe와 단짝이에요.\n\n" +
          "경계가 칼같지는 않아요. 다만 '이미 굴러가기 시작한 일(먹구름, 기울어진 컵)'에는 going to가 압도적으로 자연스러워요.",
        examples: [
          { en: "Look at those clouds. It's going to rain.", ko: "저 구름 좀 봐요. 비 오겠어요.", note: "눈에 보이는 근거" },
          { en: "I think you'll pass the test.", ko: "시험에 합격할 거라고 생각해요.", note: "의견에 기댄 예측" },
          { en: "Watch out! You're going to drop it!", ko: "조심해요! 떨어뜨리겠어요!" },
        ],
        tip: "'I think + will'은 한 묶음으로 외워두면 좋아요. I think it'll be fine.(괜찮을 거예요) — 부드럽게 의견을 말하는 만능 패턴이에요.",
      },
      {
        heading: "보너스 — 현재진행형도 미래를 말해요",
        pattern: "즉석 결정 will < 작정 be going to < 확정 일정 현재진행형",
        patternKo: "시간·장소까지 잡힌 약속은 진행형으로",
        body:
          "이미 **약속이 잡힌** 가까운 미래는 현재진행형으로 말해요 — 'I'm meeting Yuna tomorrow.'(시간·장소까지 잡힌 확정 일정).\n\n" +
          "작정(going to) → 확정(진행형) 순으로 단단해지는 거죠. 한국어 '내일 유나 만나'처럼 현재형으로 미래를 말하는 감각과 비슷해요.",
        examples: [
          { en: "I'm meeting Yuna tomorrow.", ko: "내일 유나 만나기로 했어요.", note: "약속 확정" },
          { en: "We're having dinner with my parents on Sunday.", ko: "일요일에 부모님과 저녁 먹기로 했어요." },
        ],
        tip: "정리하면 — 즉석 결정 will, 작정 be going to, 확정 일정 현재진행형. 셋 다 미래지만 '얼마나 굳었는가'가 달라요. 다이어리에 적혀 있는 일이면 진행형을 떠올리세요.",
      },
    ],
  },

  {
    slug: "a2-03-comparatives",
    level: "A2",
    order: 4,
    title: "\"서울이 부산보다 커요\"",
    topic: "비교급·최상급",
    titleFr: "Comparatives & superlatives",
    summary: "taller인지 more tall인지 — 선택 기준은 단어의 길이예요. than 뒤에 me가 오는 이유까지 정리해요.",
    duration: "약 9분",
    sections: [
      {
        heading: "-er vs more — 기준은 단어의 길이",
        pattern: "짧은 단어 + -er · 긴 단어 → more + 원급",
        patternKo: "2음절 -y는 -er(easier), 나머지 2음절은 대개 more",
        body:
          "'더 ~하다'는 **1음절 → -er**(taller), **3음절 이상 → more**(more expensive), **2음절은 -y로 끝나면 -er**(easier), 그 외 대부분 more예요. 둘 중 **하나만** 골라 써요.\n\n" +
          "원리는 발음이에요 — 짧은 단어에 -er은 입이 편하지만, ex-pen-sive-er처럼 긴 단어가 더 길어지면 발음이 무너져서 more로 분리하는 거예요.",
        table: {
          caption: "비교급·최상급 만들기",
          headers: ["유형", "비교급", "최상급"],
          rows: [
            ["1음절: +er/est", "taller", "the tallest"],
            ["e로 끝: +r/st", "nicer", "the nicest"],
            ["짧은모음+자음: 겹침", "bigger, hotter", "the biggest, the hottest"],
            ["2음절 -y: y→ier", "easier, happier", "the easiest"],
            ["긴 단어: more/most", "more expensive", "the most expensive"],
            ["불규칙", "better / worse / more(많이) / less", "the best / the worst / the most / the least"],
          ],
        },
        examples: [
          { en: "Seoul is bigger than Busan.", ko: "서울은 부산보다 커요." },
          { en: "This bag is more expensive than that one.", ko: "이 가방이 저것보다 비싸요." },
          { en: "Korean food is spicier than Japanese food.", ko: "한국 음식이 일본 음식보다 매워요.", note: "spicy → spicier" },
        ],
        pitfall: "'more easier'(X), 'more better'(X) — 이중 비교급은 한국 학습자 답안의 영원한 단골이에요. -er과 more는 같은 일을 하는 도구라 **하나만** 써요. 특히 better는 이미 비교급(good의)이라는 걸 잊기 쉬워요 — much better(O), more better(X).",
      },
      {
        heading: "than — 비교의 짝꿍, 그리고 그 뒤의 격",
        pattern: "비교급 + than + 비교 대상",
        patternKo: "일상 표준은 than me · 동사를 붙이면 than I do",
        body:
          "비교 대상은 **than**으로 이어요. 한국어 '~보다'와 어순이 반대예요 — '부산**보다** 크다'(보다가 앞) vs 'bigger **than** Busan'(than이 뒤).\n\n" +
          "than 뒤 대명사는 학교에서 'than I (am)'로 배웠겠지만, **현대 일상 영어의 표준은 than me**예요. 동사 없이 than I만 쓰면 오히려 딱딱하게 들려요.",
        examples: [
          { en: "My brother is taller than me.", ko: "우리 형은 저보다 키가 커요.", note: "일상 표준" },
          { en: "She speaks English better than I do.", ko: "그녀는 저보다 영어를 잘해요.", note: "동사를 붙이면 than I do" },
          { en: "Today is colder than yesterday.", ko: "오늘이 어제보다 추워요." },
        ],
        tip: "수능·공무원 시험에서는 'than I (am)'을 정답 처리하는 경우가 아직 있어요. **시험에선 than I am, 입으로는 than me** — 장면에 따라 갈아 끼우면 양쪽 다 안전해요.",
      },
      {
        heading: "최상급 — the를 잊지 마세요",
        pattern: "the + -est / the most ~ (+ in/of 범위)",
        patternKo: "여럿 중 1등 = 특정됨 → the 세트",
        body:
          "'가장 ~하다'는 **the + -est / the most ~**예요. '여럿 중 1등'은 어느 것인지 특정되니까, A1의 '너도 아는 그것 the'가 자동으로 붙어요.\n\n" +
          "범위는 **in**(장소·집단)이나 **of**(복수)로 표시해요. '내 인생 최고'는 **ever**를 붙인 'the best ~ I've ever ~' 패턴 — 5챕터(현재완료)에서 다시 만나요.",
        examples: [
          { en: "Jiho is the tallest student in our class.", ko: "지호는 우리 반에서 키가 제일 커요." },
          { en: "This is the most expensive item in the store.", ko: "이게 이 가게에서 제일 비싼 물건이에요." },
          { en: "What's the best season in Korea?", ko: "한국에서 제일 좋은 계절이 뭐예요?" },
        ],
        pitfall: "최상급 앞 the 누락 — 'She is best singer.'(X)는 관사 감각이 없는 한국어 화자의 전형적 실수예요. '최상급 = the 세트 메뉴'로 묶어서 암기하세요. (단, my best friend처럼 소유격이 오면 the는 안 붙어요 — 자리가 겹치니까요.)",
      },
      {
        heading: "as ~ as — '~만큼'의 비교",
        pattern: "as + 원급 + as = ~만큼 …하다",
        patternKo: "not as ~ as = ~보다 덜하다",
        body:
          "차이가 없을 땐 **as + 원급 + as**예요. 비교급이 아니라 **원래 모양 그대로** 넣는 게 포인트예요 — Busan is **as hot as** Daegu.\n\n" +
          "부정형 not as ~ as는 '~만큼 …하지 않다', 즉 비교급을 뒤집은 말이에요: not as big as Seoul = smaller than Seoul.",
        examples: [
          { en: "My English isn't as good as your Korean.", ko: "제 영어는 당신 한국어만큼 잘하지 못해요.", note: "겸손 표현으로도 유용" },
          { en: "This movie is as good as the book.", ko: "이 영화는 원작 책만큼 좋아요." },
          { en: "Call me as soon as possible.", ko: "가능한 한 빨리 전화 주세요.", note: "ASAP의 정체가 바로 이 패턴" },
        ],
        tip: "as ~ as 사이에는 비교급이 아니라 원급! 'as bigger as'(X)는 두 패턴이 섞인 오류예요. '~만큼'이 떠오르면 원급, '~보다'가 떠오르면 비교급 — 한국어 조사로 분기하면 정확해요.",
      },
    ],
  },

  {
    slug: "a2-04-modals-basic",
    level: "A2",
    order: 5,
    title: "'안 해도 돼'와 '하면 안 돼' 사이",
    topic: "조동사 can/must/should/have to",
    titleFr: "Modal verbs: can / must / should / have to",
    summary: "동사 앞에서 뉘앙스를 입히는 조동사. 특히 must not과 don't have to가 전혀 다른 뜻이 되는 함정을 집중 공략해요.",
    duration: "약 10분",
    sections: [
      {
        heading: "조동사의 공통 문법 — 세 가지 철칙",
        pattern: "조동사 + 동사원형 — -s 금지 · do 불필요",
        patternKo: "can/must/should는 스스로 부정·의문 해결",
        body:
          "조동사는 본동사 앞에서 **가능·의무·조언** 같은 뉘앙스를 입혀요. 철칙 셋 — **① 뒤에는 동사원형**(can swims X), **② 3인칭 -s 금지**(musts X), **③ 부정·의문을 스스로 해결**(can't / Can you ~?).\n\n" +
          "즉 조동사는 be처럼 '스스로 해결하는 세계'의 멤버예요. do의 세계와 또 한 번 구분되는 거죠.",
        examples: [
          { en: "She can speak three languages.", ko: "그녀는 3개 국어를 할 수 있어요.", note: "can speaks(X)" },
          { en: "Can I sit here?", ko: "여기 앉아도 돼요?", note: "허가를 구하는 만능 패턴" },
          { en: "You should see a doctor.", ko: "병원에 가보는 게 좋겠어요." },
        ],
        pitfall: "'She can swims.'(X), 'He musts go.'(X) — 3인칭 -s 습관이 이제 막 자리 잡은 학습자가 거꾸로 과잉 적용하는 실수예요. **조동사가 있으면 -s는 어디에도 안 붙는다** — 조동사가 시제·인칭 책임을 전부 흡수하기 때문이에요.",
      },
      {
        heading: "can — 능력·허가·부탁, 그리고 can/can't 듣기",
        pattern: "can = 능력 · 허가 · 부탁 + 동사원형",
        patternKo: "약한 [kən] = can · 강한 [kænt] = can't",
        body:
          "can은 **능력**(할 수 있다), **허가**(해도 된다), **부탁**(해줄래요?)을 모두 커버하는 만능 조동사예요.\n\n" +
          "문제는 듣기 — 긍정 can은 약하게 [kən] '큰'으로 뭉개지고, 부정 can't는 강하게 [kænt]로 발음돼요. **'캔'이 또렷이 들리면 오히려 can't일 가능성**이 높아요.",
        examples: [
          { en: "I can drive.", ipa: "[aɪ kən ˈdraɪv]", ko: "운전할 수 있어요.", note: "can이 약하게 '큰'" },
          { en: "I can't drive.", ipa: "[aɪ kænt ˈdraɪv]", ko: "운전 못 해요.", note: "can't에 강세 — '캐앤(트)'" },
          { en: "Can you help me with this?", ko: "이것 좀 도와줄래요?" },
          { en: "You can use my charger.", ko: "제 충전기 써도 돼요." },
        ],
        tip: "듣기 요령: 동사보다 **앞 단어가 세게 들리면 can't**, 동사가 세게 들리면 can이에요. I CAN'T drive vs I can DRIVE — 강세의 위치가 부정의 신호입니다.",
      },
      {
        heading: "must vs have to — 긍정은 쌍둥이, 부정은 남남",
        pattern: "must not = 금지(하면 안 돼) ↔ don't have to = 불필요(안 해도 돼)",
        patternKo: "부정에서 갈라짐 — '하면 안 돼' vs '안 해도 돼'",
        body:
          "긍정문에서 must와 have to는 둘 다 '~해야 한다'예요(must는 화자의 판단, have to는 규칙·사정 — A2에선 '거의 같다'로 충분). **진짜 함정은 부정** — **must not은 금지**, **don't have to는 불필요**로 정반대급으로 갈라져요.\n\n" +
          "'You don't have to pay.'는 '안 내도 돼요(공짜예요)'인데, must not로 잘못 말하면 '내면 안 됩니다!'라는 금지가 돼버려요.",
        table: {
          caption: "must vs have to — 의미 매트릭스",
          headers: ["", "must", "have to"],
          rows: [
            ["긍정", "~해야 한다 (의무)", "~해야 한다 (의무)"],
            ["부정", "must not = 하면 안 된다 (금지)", "don't have to = 안 해도 된다 (불필요)"],
            ["문법", "조동사 — 뒤에 원형, 과거형 없음", "일반동사 취급 — has to / had to / Do you have to?"],
          ],
        },
        examples: [
          { en: "You must not smoke here.", ko: "여기서 담배 피우면 안 돼요.", note: "금지" },
          { en: "You don't have to come early.", ko: "일찍 안 와도 돼요.", note: "불필요 — 와도 되고요" },
          { en: "She has to work on Saturdays.", ko: "그녀는 토요일마다 일해야 해요.", note: "have to는 3인칭 -s 적용" },
          { en: "I had to wait for an hour.", ko: "한 시간을 기다려야 했어요.", note: "must엔 과거형이 없어 had to가 대타" },
        ],
        pitfall: "한국어 '안 해도 돼'와 '하면 안 돼'는 글자가 비슷해서, 영어로 바꿀 때 회로가 자주 꼬여요. 변환 공식을 박아두세요 — **'하면 안 돼' → must not, '안 해도 돼' → don't have to**. 시험 단골이자, 실생활에서 틀리면 상대를 당황시키는 함정이에요.",
      },
      {
        heading: "should — 부드러운 조언",
        pattern: "must/have to(해야 한다) > should(하는 게 좋다) > can(해도 된다)",
        patternKo: "조언의 기본값은 should",
        body:
          "should는 '~하는 게 좋겠다'는 **조언·권유**예요. must(해야 한다)보다 훨씬 부드러워서 충고할 때의 기본값이에요.\n\n" +
          "한국어로도 '~해야지!'보다 '~하는 게 좋을 것 같아'가 부드러운 것처럼, 영어도 should가 관계를 지켜주는 선택이에요.",
        examples: [
          { en: "You should get some rest.", ko: "좀 쉬는 게 좋겠어요." },
          { en: "You shouldn't drink too much coffee.", ko: "커피를 너무 많이 마시지 않는 게 좋아요." },
          { en: "Should I bring anything?", ko: "뭐 가져갈까요?", note: "초대받았을 때 유용한 질문" },
        ],
        vsKo: "한국어 '~해야 돼요'는 일상에서 가볍게도 쓰이지만(이 식당 꼭 가봐야 돼!), 영어 must는 무게가 있어요. 가벼운 추천 의도로 You must ~를 남발하면 명령조로 들릴 수 있어요 — 추천·조언은 should, 강한 추천은 really should 정도가 안전합니다.",
      },
    ],
  },

  {
    slug: "a2-05-present-perfect-intro",
    level: "A2",
    order: 6,
    title: "\"가 본 적 있어요\" — 경험 말하기",
    topic: "현재완료 have+p.p.",
    titleFr: "Present perfect: an introduction",
    summary: "한국어에 없어서 평생 회피하게 되는 시제, 현재완료. '과거의 일이 지금까지 닿아 있다'는 프레임 하나로 입문해요.",
    duration: "약 10분",
    sections: [
      {
        heading: "한국어에 없는 시제 — 그래서 회피하게 된다",
        pattern: "have/has + 과거분사",
        patternKo: "과거가 지금까지 닿아 있는 시제",
        body:
          "현재완료가 어려운 근본 이유는 한국어에 **대응하는 시제가 없기** 때문이에요 — 한국어 '-었-'은 과거형과 현재완료를 구분 없이 다 덮어버려서, 한국 학습자는 전부 과거형으로 말하고 현재완료를 회피하게 돼요. 프레임은 하나 — **과거에 시작된 일이 지금까지 닿아 있다.**\n\n" +
          "'I lost my key.'(과거형)는 과거의 사건 보고일 뿐이지만, 'I **have lost** my key.'는 '잃어버려서 **지금도 없어**'라는 말이에요. 무게중심이 **지금**에 있는 시제예요.",
        examples: [
          { en: "I lost my key yesterday.", ko: "어제 열쇠를 잃어버렸어요.", note: "과거의 사건 보고 — 지금은 찾았을 수도" },
          { en: "I've lost my key. I can't get in!", ko: "열쇠를 잃어버렸어요. 못 들어가요!", note: "지금도 없음 — 현재에 닿아 있는 과거" },
          { en: "She has gone to Canada.", ko: "그녀는 캐나다에 가(서 지금 여기 없어)요.", note: "간 결과가 지금까지 유효" },
        ],
        vsKo: "'열쇠 잃어버렸어'라는 한국어 한 문장이 영어에선 lost(그때 얘기)와 have lost(지금도 그래) 둘로 갈라져요. 한국어 '-었-'이 두 시제를 모두 덮고 있다는 걸 자각하는 것이 현재완료 정복의 첫걸음이에요. 번역하지 말고 '지금에 닿아 있나?'를 물어보세요.",
      },
      {
        heading: "형태 — have/has + 과거분사(p.p.)",
        pattern: "I've / she's + p.p. · 부정 haven't/hasn't · 의문 Have you ~?",
        patternKo: "p.p.는 동사의 세 번째 모양 (go-went-gone)",
        body:
          "과거분사(p.p.)는 동사의 세 번째 모양이에요 — 규칙동사는 과거형과 같고(-ed), 불규칙동사는 따로 외워요(go-went-**gone**, see-saw-**seen**).\n\n" +
          "축약이 기본값이에요 — I've, she's, we've. 부정은 haven't/hasn't, 의문은 Have you ~?",
        table: {
          caption: "A2 필수 동사 3단 변화",
          headers: ["원형", "과거형", "과거분사"],
          rows: [
            ["go", "went", "gone (been)"],
            ["see", "saw", "seen"],
            ["eat", "ate", "eaten"],
            ["do", "did", "done"],
            ["have", "had", "had"],
            ["make", "made", "made"],
            ["lose", "lost", "lost"],
            ["be", "was/were", "been"],
          ],
        },
        examples: [
          { en: "I've finished my homework.", ko: "숙제 다 했어요. (그래서 지금 자유)" },
          { en: "She hasn't arrived yet.", ko: "그녀는 아직 도착 안 했어요." },
          { en: "Have you eaten lunch?", ko: "점심 먹었어요? (지금 배 안 고파요?)" },
        ],
        etym: "perfect는 라틴어 perfectum — per(완전히) + facere(만들다), 즉 '완전히 다 이루어진'이라는 뜻이에요. factory(만드는 곳), fact(이루어진 일)와 같은 뿌리죠. 현재완료(present perfect)라는 이름 자체가 '다 이루어진 일이 현재에 있다'는 이 시제의 본질을 담고 있어요.",
        tip: "she's는 she is일 수도, she has일 수도 있어요. 구별법: 뒤에 과거분사가 오면 has(She's gone), -ing나 명사·형용사가 오면 is(She's going).",
      },
      {
        heading: "경험 말하기 — have been to",
        pattern: "Have you ever + p.p. ~? · have been to = 가본 적 있다",
        patternKo: "been = 갔다가 돌아옴 ↔ gone = 가버림",
        body:
          "현재완료의 가장 실용적인 용법이 **경험**이에요 — 과거의 경험이 '지금의 나'를 이루고 있으니, 현재에 닿아 있는 시제가 어울려요. **have been to**가 '가본 적 있다'인 이유는 갔다가 **돌아왔기** 때문 — have **gone** to는 '가버려서 지금 없다'예요.\n\n" +
          "경험 질문의 만능 패턴: **Have you ever + p.p. ~?** / 답: Yes, I have. / No, never.",
        examples: [
          { en: "Have you ever been to Jeju?", ko: "제주도 가본 적 있어요?" },
          { en: "I've been to Japan twice.", ko: "일본에 두 번 가봤어요." },
          { en: "I've never eaten durian.", ko: "두리안은 한 번도 안 먹어봤어요.", note: "never가 not 역할까지 해요" },
          { en: "This is the best pizza I've ever had.", ko: "이건 제가 먹어본 것 중 최고의 피자예요.", note: "3챕터 최상급 + ever 패턴" },
        ],
        pitfall: "'She has gone to Canada.'는 '가버려서 여기 없다', 'She has been to Canada.'는 '가본 적 있다(지금은 여기)'예요. gone/been 한 단어로 사람의 현재 위치가 갈리는, 현재완료다운 함정이에요.",
      },
      {
        heading: "과거형과의 1차 구별 — 시점이 박히면 과거형",
        pattern: "yesterday · last ~ · when = 과거형 ↔ just · already · yet · ever = 현재완료",
        patternKo: "시점 부사와 현재완료는 같은 문장에 못 산다",
        body:
          "**yesterday, last year, in 2020, when ~처럼 '언제'가 박힌 문장에는 현재완료를 쓸 수 없어요.** 시점이 찍히면 그 일은 과거에 고정되어 '지금까지 닿아 있다'와 모순되거든요 — 그래서 When did you arrive?(O) / When have you arrived?(X).\n\n" +
          "반대로 just(방금), already(이미), yet(아직), ever/never(지금까지)는 전부 '지금' 기준의 말이라 현재완료의 단짝이에요.",
        examples: [
          { en: "I saw that movie last week.", ko: "그 영화 지난주에 봤어요.", note: "시점 명시 → 과거형" },
          { en: "I've already seen that movie.", ko: "그 영화 이미 봤어요.", note: "본 상태가 지금까지 → 현재완료" },
          { en: "When did you arrive? — I've just arrived.", ko: "언제 도착했어요? — 방금 도착했어요.", note: "질문은 시점(과거형), 답은 '방금'(현재완료)" },
          { en: "Have you finished yet? — Not yet.", ko: "다 했어요? — 아직요." },
        ],
        pitfall: "'I have seen him yesterday.'(X)는 한국 학습자 영작의 고전 오류예요. yesterday가 보이는 순간 무조건 과거형 — **'시점 부사와 현재완료는 같은 문장에 못 산다'**를 1차 규칙으로 새기세요. 계속·완료 용법 등 더 깊은 세계는 B1에서 이어져요.",
      },
    ],
  },

  {
    slug: "a2-06-infinitive-gerund",
    level: "A2",
    order: 7,
    title: "to는 화살표, -ing는 스냅사진",
    topic: "to부정사 vs 동명사",
    titleFr: "Infinitive vs gerund",
    summary: "want to go인데 enjoy going인 이유. 암기가 필요한 동사들과, stop to/-ing처럼 의미가 갈리는 함정을 정리해요.",
    duration: "약 9분",
    sections: [
      {
        heading: "동사 뒤에 동사를 이으려면 — 두 가지 연결 장치",
        pattern: "동사 + to부정사 / 동사 + -ing — 앞 동사가 결정",
        patternKo: "to = 화살표(아직 안 한 일) · -ing = 스냅사진(행위 자체)",
        body:
          "동사 뒤에 또 동사가 올 땐 **to부정사(to swim)** 또는 **동명사(swimming)**로 모양을 바꿔야 해요. 'I want **swim**.'(X) — 한 문장에 시제 달린 동사는 하나뿐이라, 둘째 동사는 to나 -ing 옷을 입고 명사 역할로 변신해야 해요.\n\n" +
          "어느 옷을 입힐지는 **앞 동사가 결정**해요. want는 to만, enjoy는 -ing만 — 논리 절반, 암기 절반이에요.",
        examples: [
          { en: "I want to learn English.", ko: "영어를 배우고 싶어요.", note: "want는 to파" },
          { en: "I enjoy learning English.", ko: "영어 배우는 게 즐거워요.", note: "enjoy는 -ing파" },
          { en: "She likes cooking. = She likes to cook.", ko: "그녀는 요리를 좋아해요.", note: "like는 양다리 — 둘 다 OK" },
        ],
        etym: "infinitive(부정사)는 라틴어 infinitus(한정되지 않은) — in(아닌) + finis(끝, 한계)예요. finish, final, define이 모두 같은 뿌리 fin(끝)에서 나왔죠. 주어·시제에 '한정되지 않은' 동사의 원형이라는 뜻 — 문법 용어가 갑자기 친근해지지 않나요?",
        tip: "감각 프레임: **to는 화살표** — 아직 안 한 일, 앞으로 향하는 일(want, plan, hope). **-ing는 스냅사진** — 행위 그 자체, 이미 굴러가는 일(enjoy, finish, stop). 100% 규칙은 아니지만 암기의 닻으로 훌륭해요.",
      },
      {
        heading: "to부정사를 받는 동사 — 미래로 향하는 동사들",
        pattern: "want / plan / decide / hope / promise + to + 동사원형",
        patternKo: "아직 안 한 일을 향하는 동사들 = to파",
        body:
          "to파는 대체로 **'아직 안 한 일'을 향하는** 동사예요 — 원하고(want), 계획하고(plan), 결심하고(decide), 바라는(hope) 일은 모두 미래에 있죠.\n\n" +
          "**필수 멤버**: want, need, plan, decide, hope, learn, promise, would like",
        examples: [
          { en: "We decided to take a taxi.", ko: "우리는 택시를 타기로 했어요." },
          { en: "I'm learning to drive.", ko: "운전을 배우고 있어요." },
          { en: "I'd like to order, please.", ko: "주문할게요.", note: "would like to — 식당 필수 패턴" },
          { en: "He promised to call me back.", ko: "그가 다시 전화하기로 약속했어요." },
        ],
        vsKo: "한국어 '-기로 하다, -고 싶다, -려고 하다'에 해당하는 동사들이 대체로 to파예요. 모두 아직 일어나지 않은 일을 향하죠 — 한국어 어미의 감각으로도 '미래 지향 = to'가 확인되는 셈이에요.",
      },
      {
        heading: "-ing를 받는 동사 — 통째로 외울 멤버들",
        pattern: "enjoy / finish / mind / keep / give up + -ing",
        patternKo: "-ing만 받는 동사들 = 명단 통째로 암기",
        body:
          "-ing파는 수가 적으니 **명단을 통째로** 외우는 게 정석이에요. 행위가 이미 존재해야 즐기고(enjoy) 끝내고(finish) 포기할(give up) 수 있다 — 'ing = 스냅사진' 프레임이 통하는 그룹이에요.",
        table: {
          caption: "-ing만 받는 필수 동사",
          headers: ["동사", "뜻", "예문"],
          rows: [
            ["enjoy", "즐기다", "I enjoy swimming."],
            ["finish", "끝내다", "I finished writing the report."],
            ["mind", "꺼리다", "Do you mind opening the window?"],
            ["keep", "계속하다", "Keep going!"],
            ["give up", "포기하다", "He gave up smoking."],
            ["practice", "연습하다", "Practice speaking every day."],
            ["avoid", "피하다", "Avoid eating late at night."],
          ],
        },
        examples: [
          { en: "I enjoy watching movies alone.", ko: "혼자 영화 보는 거 좋아해요.", note: "enjoy to watch(X)" },
          { en: "Have you finished eating?", ko: "다 먹었어요?" },
          { en: "Keep practicing — you're getting better.", ko: "계속 연습하세요 — 점점 늘고 있어요." },
        ],
        pitfall: "'I enjoy to watch movies.'(X)는 한국 학습자 영작 1순위 오답이에요. '~하는 것을 즐기다'의 '~하는 것'이 to부정사로 직역되기 쉬운 탓이죠. **enjoy, finish, mind, keep, give up** — 이 다섯만 입에 붙여도 사고의 90%가 예방돼요.",
      },
      {
        heading: "stop to vs stop -ing — 의미가 갈리는 동사",
        pattern: "stop -ing = 그만두다 ↔ stop to ~ = ~하러 멈추다",
        patternKo: "remember to(할 일) ↔ remember -ing(한 일)도 같은 원리",
        body:
          "몇몇 동사는 둘 다 받지만 **뜻이 달라져요**. **stop smoking**은 담배를 끊다(행위 중단), **stop to smoke**는 담배 피우러 멈추다(피우는 쪽**으로** 향함) — to/-ing의 감각 프레임 그대로죠.\n\n" +
          "remember/forget도 같은 원리예요 — remember **to lock**(잠가야 한다는 걸 기억해, 아직 안 한 일) vs remember **locking**(잠갔던 게 기억나, 이미 한 일).",
        examples: [
          { en: "He stopped smoking last year.", ko: "그는 작년에 담배를 끊었어요." },
          { en: "We stopped to take pictures.", ko: "우리는 사진 찍으려고 멈췄어요." },
          { en: "Remember to lock the door.", ko: "문 잠그는 거 잊지 마세요. (아직 안 잠금)" },
          { en: "I remember locking the door.", ko: "문 잠근 기억이 나요. (이미 잠갔음)", note: "그런데 왜 열려 있지...?" },
        ],
        tip: "stop은 의미가 갈리는 게 아니라 구조가 달라요 — stop의 목적어가 될 수 있는 건 -ing뿐이고, to부정사는 '~하기 위해'라는 목적(부사)이에요. '멈춘 대상은 -ing, 멈춘 이유는 to'로 정리하면 헷갈리지 않아요.",
      },
    ],
  },

  {
    slug: "a2-07-adverbs-frequency",
    level: "A2",
    order: 8,
    title: "\"난 항상 바빠\" — always의 자리",
    topic: "빈도부사 어순",
    titleFr: "Adverbs of frequency & word order",
    summary: "always부터 never까지 빈도의 사다리를 세우고, 한국어와 달리 자리가 정해져 있는 빈도부사의 지정석 규칙을 익혀요.",
    duration: "약 8분",
    sections: [
      {
        heading: "빈도의 사다리 — always에서 never까지",
        pattern: "always → usually → often → sometimes → rarely → never",
        patternKo: "100%에서 0%까지의 사다리",
        body:
          "'얼마나 자주'를 나타내는 **빈도부사**는 100%에서 0%까지 사다리로 세워두면 감이 잡혀요. 숫자는 정확한 수치라기보다 상대적 위치로 기억하세요.",
        table: {
          caption: "빈도의 사다리",
          headers: ["부사", "대략의 빈도", "뜻"],
          rows: [
            ["always", "100%", "항상"],
            ["usually", "80~90%", "보통, 대개"],
            ["often", "60~70%", "자주"],
            ["sometimes", "30~50%", "가끔"],
            ["rarely / seldom", "5~10%", "드물게"],
            ["never", "0%", "절대 안 함"],
          ],
        },
        examples: [
          { en: "I usually get up at seven.", ko: "보통 7시에 일어나요." },
          { en: "She sometimes skips breakfast.", ko: "그녀는 가끔 아침을 걸러요." },
          { en: "He never drinks coffee at night.", ko: "그는 밤에 커피를 절대 안 마셔요." },
        ],
        tip: "never는 그 자체가 부정이에요 — 'I don't never drink.'(X)처럼 not과 겹치면 이중부정이 돼요. never가 있으면 don't는 빼세요: I never drink coffee.",
      },
      {
        heading: "지정석 규칙 — be 뒤, 일반동사 앞",
        pattern: "be 뒤 · 일반동사 앞 · 조동사 뒤",
        patternKo: "지정석 = 문법 엔진(조동사 자리) 바로 옆",
        body:
          "한국어 부사는 자리가 자유롭지만, 영어 빈도부사는 **지정석**이 있어요 — **① be 동사 뒤**(She **is always** late.), **② 일반동사 앞**(She **always comes** late.).\n\n" +
          "사실 지정석은 하나예요 — **'조동사가 앉을 자리'** 옆. be는 엔진이 강해서 부사가 뒤로 가고, 일반동사는 엔진(do)이 숨어 있어 부사가 그 빈자리(동사 앞)에 앉아요. 조동사가 등장하면 그 뒤 — You should **always** check.",
        examples: [
          { en: "I'm always busy on Mondays.", ko: "월요일엔 항상 바빠요.", note: "be 뒤" },
          { en: "I always check my phone first.", ko: "항상 휴대폰부터 확인해요.", note: "일반동사 앞" },
          { en: "You should always wear a seatbelt.", ko: "항상 안전벨트를 매야 해요.", note: "조동사 뒤" },
          { en: "She has never been to Europe.", ko: "그녀는 유럽에 가본 적이 없어요.", note: "현재완료에서는 have 뒤" },
        ],
        pitfall: "'I always am busy.'(X) vs 'I am always busy.'(O) — be와 일반동사의 규칙이 헷갈려 자리가 꼬이는 게 전형적 실수예요. 7챕터에서 배운 'be의 세계 vs do의 세계' 분기가 또 등장한 거예요. **be가 보이면 부사는 그 뒤** — 이것부터 굳히세요.",
        vsKo: "한국어는 조사 덕분에 부사를 어디에 둬도 문장이 성립하지만, 영어는 어순이 곧 문법이라 부사조차 좌석이 배정돼요. A1 1챕터의 '순서가 곧 조사' 원리가 부사에까지 이어지는 셈이에요.",
      },
      {
        heading: "이동이 허용되는 부사들",
        pattern: "sometimes/usually/often = 문두·문미 이동 가능 · always/never = 지정석만",
        patternKo: "중간 빈도만 이동 허용, always/never는 못 움직여요",
        body:
          "**sometimes, usually, often**은 강조를 위해 문장 맨 앞이나 맨 뒤로 이동할 수 있어요 — Sometimes I cook. / I visit my parents often.\n\n" +
          "반대로 **always와 never는 이동 금지**예요 — 'Always I'm busy.'(X). (Never를 문두에 두는 도치 구문이 있긴 하지만 C1의 영역이에요.)",
        examples: [
          { en: "Sometimes I just want to stay home.", ko: "가끔은 그냥 집에 있고 싶어요.", note: "sometimes는 문두 OK" },
          { en: "Usually, I take the subway to work.", ko: "보통은 지하철로 출근해요." },
          { en: "I'm always on your side.", ko: "난 항상 네 편이야.", note: "always는 지정석에서만" },
        ],
        tip: "헷갈리면 **무조건 지정석(be 뒤·일반동사 앞)**에 두세요. 이동은 '되는 부사도 있다' 수준으로만 알아두면 — 지정석은 모든 빈도부사에게 항상 합법이니까요.",
      },
      {
        heading: "빈도를 묻고 답하기 — How often?",
        pattern: "How often ~? → once / twice / three times + a day/week",
        patternKo: "어순은 횟수 먼저, 기간 나중 (twice a week)",
        body:
          "빈도를 묻는 질문은 **How often ~?**, 답에는 빈도부사 외에 **횟수 표현**을 자주 써요 — once, twice, three times(셋부터 times) + a day/week/month.\n\n" +
          "'일주일에 두 번'의 어순에 주의하세요 — 영어는 **횟수 먼저, 기간 나중**(twice a week)으로 한국어와 반대예요.",
        examples: [
          { en: "How often do you exercise?", ko: "운동 얼마나 자주 해요?" },
          { en: "I go to the gym three times a week.", ko: "일주일에 세 번 헬스장에 가요.", note: "횟수 + a week 순서" },
          { en: "We eat out once a month.", ko: "한 달에 한 번 외식해요." },
          { en: "Every day. / Almost never.", ko: "매일이요. / 거의 안 해요.", note: "짧은 대답도 자연스러워요" },
        ],
        tip: "once와 twice는 한 단어지만 3부터는 three times, four times — 'one time, two times'도 틀린 건 아니지만 once/twice가 훨씬 자연스러워요.",
      },
    ],
  },

  {
    slug: "a2-08-there-is",
    level: "A2",
    order: 9,
    title: "\"근처에 약국 있어요?\"의 공식",
    topic: "there is/are·비인칭 it",
    titleFr: "There is / there are & impersonal it",
    summary: "한국어 '있다' 하나가 영어에선 there is(존재)와 have(소유)로 갈라져요. 주어가 꼭 필요한 영어의 해결사, 비인칭 it도 함께.",
    duration: "약 9분",
    sections: [
      {
        heading: "'있다'의 두 갈래 — 존재의 there is, 소유의 have",
        pattern: "존재(~에 있다) = There is/are ~ · 소유(~가 있다) = have",
        patternKo: "분기 질문: 주인이 있는 '있다'인가?",
        body:
          "한국어 '있다'는 존재('책이 있다')와 소유('펜이 있다')를 다 덮지만, 영어는 **다른 동사**로 갈라요 — 존재는 **There is/are ~**, 소유는 **have**.\n\n" +
          "'나는 펜이 있다'를 'There is a pen to me.'(X)로 직역하면 안 돼요 — 소유는 깔끔하게 **I have a pen.** 분기 질문은 하나: **주인이 있는 '있다'인가?**",
        examples: [
          { en: "There is a book on the desk.", ko: "책상 위에 책이 있어요.", note: "존재 — 장소에 놓임" },
          { en: "I have a pen.", ko: "저는 펜이 있어요.", note: "소유 — 주인이 있음" },
          { en: "There are two cafes near my house.", ko: "우리 집 근처에 카페가 두 개 있어요." },
          { en: "She has two brothers.", ko: "그녀는 남동생이 둘 있어요.", note: "가족도 '소유'로 표현" },
        ],
        vsKo: "한국어 '있다'가 하나로 통하는 건 조사('~에/~에게/~는')가 관계를 다 표시해주기 때문이에요. 영어는 조사가 없으니 동사 자체를 갈라서 관계를 표현해요 — '에 있다 = there is, 가 있다(소유) = have'로 조사 감각과 연결해두면 분기가 빨라져요.",
      },
      {
        heading: "there is / there are — 수일치와 부정·의문",
        pattern: "There is + 단수 · There are + 복수",
        patternKo: "수일치 기준은 뒤의 명사 — there는 가짜 주어",
        body:
          "there는 '거기'가 아니라 **자리만 채우는 가짜 주어**예요. 진짜 주어는 뒤의 명사라서, 수일치도 뒤의 명사에 맞춰요.\n\n" +
          "부정·의문은 be 동사 규칙 그대로 — There isn't ~ / Is there ~? 그리고 A1의 some/any 규칙이 여기서 활약해요: 긍정엔 some, 부정·의문엔 any.",
        examples: [
          { en: "There's some milk in the fridge.", ko: "냉장고에 우유가 좀 있어요." },
          { en: "There aren't any seats left.", ko: "남은 자리가 없어요." },
          { en: "Is there a pharmacy near here?", ko: "이 근처에 약국 있어요?", note: "여행 만능 패턴 — Is there ~ near here?" },
          { en: "Yes, there is. / No, there isn't.", ko: "네, 있어요. / 아뇨, 없어요." },
        ],
        pitfall: "'There is many people.'(X) — there is를 한 덩어리 관용구로 외워서 뒤가 복수여도 is를 쓰는 실수가 흔해요. **수일치 기준은 뒤의 명사** — people은 복수니까 There are many people. 말하기 전에 뒤 명사를 먼저 떠올리는 습관을 들이세요.",
      },
      {
        heading: "비인칭 it — 날씨·시간·거리의 전담 주어",
        pattern: "날씨 · 시간 · 거리 · 요일 → It's ~",
        patternKo: "뜻 없는 자리 채우기 주어 — '그것' 아님",
        body:
          "영어는 **주어 없는 문장을 허용하지 않아요**(A1 1챕터의 제1법칙). 그래서 날씨·시간·거리·요일처럼 주어가 마땅치 않은 문장에 **빈자리를 채우는 전담 요원 it**을 투입해요.\n\n" +
          "이 it은 '그것'이라고 해석하면 안 돼요 — 뜻이 없는 **문법적 자리 채우기**예요. 'It's raining.'은 그냥 '비 와요'.",
        examples: [
          { en: "It's raining.", ko: "비 와요.", note: "Is raining.(X) — 주어 자리를 it이 채워요" },
          { en: "It's three o'clock.", ko: "3시예요." },
          { en: "It's far from here.", ko: "여기서 멀어요." },
          { en: "It's Friday! ", ko: "금요일이에요!" },
        ],
        pitfall: "'Is raining.'(X), 'Today is rain.'(X) — 주어 없는 한국어 감각이 그대로 새는 지점이에요. 날씨는 **It's + 형용사**(It's rainy/sunny/cold) 또는 **It's + -ing**(It's raining/snowing) 두 패턴으로 굳혀두세요.",
        tip: "시간 묻고 답하기는 세트로: What time is it? — It's seven thirty. 날짜·요일도 it 담당이에요: What day is it? — It's Monday.",
      },
      {
        heading: "there vs it — 마지막 교통정리",
        pattern: "등장(새 정보) = there is · 지칭(아는 정보) = it",
        patternKo: "a → the 흐름과 같은 원리",
        body:
          "분업은 명확해요 — **there is**는 새로운 것의 **등장**('~가 있다'고 처음 소개), **it**은 이미 아는 것·상황의 **지칭**이에요.\n\n" +
          "그래서 한 대화에서 자연스럽게 이어져요: There is a cafe near my house.(등장) **It** opens at eight.(지칭) — A1 관사의 a → the 흐름과 정확히 같은 원리예요.",
        examples: [
          { en: "There's a new cafe on my street. It's really nice.", ko: "우리 동네에 새 카페가 생겼어요. 정말 괜찮아요.", note: "등장은 there, 지칭은 it" },
          { en: "There's someone at the door. — Who is it?", ko: "문 앞에 누가 왔어요. — 누구예요?" },
          { en: "Is there a problem? — No, it's fine.", ko: "무슨 문제 있어요? — 아뇨, 괜찮아요." },
        ],
        tip: "처음 소개할 땐 there + a/some(새 정보), 그다음부터는 it/the(아는 정보) — 관사의 a/the 흐름과 there/it의 흐름은 같은 강물이에요. 영어는 '새 정보 → 아는 정보'의 흐름을 문법 곳곳에서 표시하는 언어랍니다.",
      },
    ],
  },
];
