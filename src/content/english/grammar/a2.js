/**
 * A2 초급 — 시제의 폭을 넓히고 문장에 입체감 더하기
 * 과거·미래·현재완료, 조동사, 비교 — 시험으로만 알던 문법을 입에서 나오는 문법으로.
 */
export default [
  {
    slug: "a2-01-past-simple",
    level: "A2",
    order: 1,
    title: "과거형과 불규칙동사 — -ed의 세 가지 발음",
    titleFr: "Past simple & irregular verbs",
    summary: "끝난 일을 말하는 과거형. -ed의 발음 삼분법 [t]/[d]/[ɪd]와 피해 갈 수 없는 불규칙동사를 정리해요.",
    duration: "약 10분",
    sections: [
      {
        heading: "과거형의 의미 — 지금과 분리된, 끝난 일",
        body:
          "과거형(past simple)은 **끝난 일**을 말해요. 어제, 작년, 2010년에 — 언제인지 짚을 수 있는 과거의 한 장면이죠.\n\n" +
          "좋은 소식 하나 — 영어 과거형은 **주어가 누구든 모양이 똑같아요**. I worked, she worked, they worked. 현재형의 3인칭 -s 같은 골칫거리가 없어요.\n\n" +
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
        body:
          "규칙동사는 -ed만 붙이면 되는데, 함정은 철자가 아니라 **발음**이에요. -ed는 세 가지로 발음돼요.\n\n" +
          "**[t]** — 무성음(p, k, s, sh, ch, f) 뒤: stopped, liked, washed\n" +
          "**[d]** — 유성음(모음, b, g, v, l, m, n 등) 뒤: played, loved, opened\n" +
          "**[ɪd]** — **t나 d** 뒤에만: wanted, needed, decided (음절이 하나 늘어요!)\n\n" +
          "원리는 간단해요 — 발음하기 편한 쪽으로 닮아가는 것뿐이에요. 단, t/d 뒤에서는 [t]/[d]를 또 붙일 수 없으니 모음을 끼워 [ɪd]가 되는 거죠.",
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
        body:
          "영어에서 가장 자주 쓰는 동사들은 -ed를 거부하고 **모양을 통째로 바꿔요** — go → went, have → had, eat → ate. 얄밉게도 빈도가 높은 동사일수록 불규칙이에요. (너무 자주 쓰여서 옛날 형태가 닳지 않고 살아남은 거예요.)\n\n" +
          "A2에서 꼭 잡아야 할 핵심만 추렸어요. 한꺼번에 다 외우려 하지 말고, 문장 속에서 하나씩 굳히는 게 빨라요.",
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
        body:
          "과거의 부정·의문은 **did**가 담당해요. 그리고 A1의 does에서 배운 원리가 그대로 적용돼요 — **과거 표시는 문장에 한 번만**. did가 이미 과거니까, 뒤의 동사는 원형으로 돌아갑니다.\n\n" +
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
    slug: "a2-02-future",
    level: "A2",
    order: 2,
    title: "will vs be going to — '-ㄹ게'와 '-ㄹ 거야'",
    titleFr: "Future: will vs be going to",
    summary: "영어의 두 미래 표현은 한국어 '-ㄹ게'와 '-ㄹ 거야'의 차이와 놀랍도록 닮았어요. 즉석 결정 vs 미리 정한 계획.",
    duration: "약 9분",
    sections: [
      {
        heading: "미래가 두 개인 이유 — 결정의 타이밍",
        body:
          "학교 영어에서는 'will = be going to = ~할 것이다'로 배우지만, 원어민에게 둘은 **다른 말**이에요. 가르는 기준은 단 하나 — **언제 결정했는가**.\n\n" +
          "**will** = 말하는 **지금 이 순간** 결정한 것. 즉석 결정, 약속, 자청.\n" +
          "**be going to** = 말하기 **전에 이미** 정해둔 것. 계획, 작정.\n\n" +
          "전화벨이 울릴 때 'I'll get it!'(내가 받을게!)은 벨 소리를 듣고 지금 결정한 거라 will. '나 내년에 유학 가'는 이미 정해둔 계획이라 I'm going to study abroad.",
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
        body:
          "**will**은 조동사라서 아주 단순해요 — 주어가 누구든 will + 원형. 축약은 'll, 부정은 won't.\n\n" +
          "**be going to**는 be 부분이 주어 따라 변해요(am/is/are going to). 부정·의문도 be 동사 규칙 그대로.\n\n" +
          "회화에서 going to는 **gonna** [ˈɡənə]로 뭉개지는 일이 많아요. 직접 쓰는 건 격식 없는 자리에서만 권하지만, 못 알아들으면 곤란하니 귀에는 꼭 등록해두세요.",
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
        body:
          "미래 '예측'에는 둘 다 쓸 수 있는데, 미묘한 분업이 있어요.\n\n" +
          "**be going to** — **눈앞의 근거**를 보고 하는 예측. 하늘에 먹구름이 가득하면 'It's going to rain.'(곧 비 오겠다) — 증거가 보이니까요.\n\n" +
          "**will** — 의견·짐작에 기댄 예측. 'I think he'll like this gift.'(그가 좋아할 거라고 생각해) — I think, probably, maybe와 단짝이에요.\n\n" +
          "경계가 칼같지는 않아요. 다만 '이미 굴러가기 시작한 일(먹구름, 기울어진 컵)'에는 going to가 압도적으로 자연스럽다는 것만 기억하세요.",
        examples: [
          { en: "Look at those clouds. It's going to rain.", ko: "저 구름 좀 봐요. 비 오겠어요.", note: "눈에 보이는 근거" },
          { en: "I think you'll pass the test.", ko: "시험에 합격할 거라고 생각해요.", note: "의견에 기댄 예측" },
          { en: "Watch out! You're going to drop it!", ko: "조심해요! 떨어뜨리겠어요!" },
        ],
        tip: "'I think + will'은 한 묶음으로 외워두면 좋아요. I think it'll be fine.(괜찮을 거예요) — 부드럽게 의견을 말하는 만능 패턴이에요.",
      },
      {
        heading: "보너스 — 현재진행형도 미래를 말해요",
        body:
          "이미 **약속이 잡힌** 가까운 미래는 현재진행형으로도 말해요. 'I'm meeting Yuna tomorrow.'(내일 유나 만나기로 했어요) — 시간·장소까지 잡힌 확정 일정이라는 뉘앙스예요.\n\n" +
          "be going to(작정)보다 한 단계 더 굳은 약속이라고 보면 돼요. 작정(going to) → 확정(진행형) 순으로 단단해지는 거죠. 한국어 '내일 유나 만나'처럼 현재형으로 미래를 말하는 감각과 비슷해요.",
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
    order: 3,
    title: "비교급과 최상급 — -er이냐 more냐",
    titleFr: "Comparatives & superlatives",
    summary: "taller인지 more tall인지 — 선택 기준은 단어의 길이예요. than 뒤에 me가 오는 이유까지 정리해요.",
    duration: "약 9분",
    sections: [
      {
        heading: "-er vs more — 기준은 단어의 길이",
        body:
          "'더 ~하다'를 만드는 방법은 두 가지 — 짧은 단어엔 **-er**, 긴 단어엔 **more**예요. 둘 중 하나만 골라 쓰는 게 핵심이에요.\n\n" +
          "**1음절** (tall, old, fast) → **-er**: taller, older, faster\n" +
          "**3음절 이상** (expensive, beautiful, difficult) → **more**: more expensive\n" +
          "**2음절**은 갈려요 — **-y로 끝나면 -er**(easy → easier, happy → happier), 그 외 대부분은 more(more famous, more useful).\n\n" +
          "원리로 이해하면: 짧은 단어에 -er을 붙이는 건 입이 편하지만, ex-pen-sive-er처럼 긴 단어가 더 길어지면 발음이 무너져서 more로 분리하는 거예요.",
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
        body:
          "비교 대상은 **than**으로 이어요. 한국어 '~보다'에 해당하는데, 어순이 반대예요 — 한국어는 '부산**보다** 크다'(보다가 앞), 영어는 'bigger **than** Busan'(than이 뒤).\n\n" +
          "than 뒤에 대명사가 올 때가 한국 학습자의 의문 지점이에요. 'He is taller than **me**.' — 학교에서는 'than I (am)'가 정답이라고 배웠을 텐데, **현대 일상 영어의 표준은 than me**예요. than I am처럼 동사까지 붙이면 자연스럽고, 동사 없이 than I만 쓰면 오히려 딱딱하게 들려요.",
        examples: [
          { en: "My brother is taller than me.", ko: "우리 형은 저보다 키가 커요.", note: "일상 표준" },
          { en: "She speaks English better than I do.", ko: "그녀는 저보다 영어를 잘해요.", note: "동사를 붙이면 than I do" },
          { en: "Today is colder than yesterday.", ko: "오늘이 어제보다 추워요." },
        ],
        tip: "수능·공무원 시험에서는 'than I (am)'을 정답 처리하는 경우가 아직 있어요. **시험에선 than I am, 입으로는 than me** — 장면에 따라 갈아 끼우면 양쪽 다 안전해요.",
      },
      {
        heading: "최상급 — the를 잊지 마세요",
        body:
          "'가장 ~하다'는 **the + -est / the most ~**예요. '여럿 중 1등'은 어느 것인지 특정되니까, A1에서 배운 '너도 아는 그것 the'가 자동으로 붙는 거예요.\n\n" +
          "범위는 **in**(장소·집단: in Korea, in my class)이나 **of**(복수: of the three)로 표시해요. '내 인생에서 최고'는 관용적으로 **ever**를 붙여 'the best ~ I've ever ~' 패턴으로 말하는데, 이건 5챕터(현재완료)에서 다시 만나요.",
        examples: [
          { en: "Jiho is the tallest student in our class.", ko: "지호는 우리 반에서 키가 제일 커요." },
          { en: "This is the most expensive item in the store.", ko: "이게 이 가게에서 제일 비싼 물건이에요." },
          { en: "What's the best season in Korea?", ko: "한국에서 제일 좋은 계절이 뭐예요?" },
        ],
        pitfall: "최상급 앞 the 누락 — 'She is best singer.'(X)는 관사 감각이 없는 한국어 화자의 전형적 실수예요. '최상급 = the 세트 메뉴'로 묶어서 암기하세요. (단, my best friend처럼 소유격이 오면 the는 안 붙어요 — 자리가 겹치니까요.)",
      },
      {
        heading: "as ~ as — '~만큼'의 비교",
        body:
          "차이가 없을 땐 **as + 원급 + as**를 써요. 'Busan is **as hot as** Daegu.'(부산은 대구만큼 더워요) — 비교급이 아니라 **원래 모양 그대로** 넣는 게 포인트예요.\n\n" +
          "부정형 not as ~ as는 '~만큼 …하지 않다', 즉 '~보다 덜하다'는 뜻이에요. 비교급을 뒤집은 말과 같아요: not as big as Seoul = smaller than Seoul.",
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
    order: 4,
    title: "조동사 can/must/should/have to — 부정의 함정",
    titleFr: "Modal verbs: can / must / should / have to",
    summary: "동사 앞에서 뉘앙스를 입히는 조동사. 특히 must not과 don't have to가 전혀 다른 뜻이 되는 함정을 집중 공략해요.",
    duration: "약 10분",
    sections: [
      {
        heading: "조동사의 공통 문법 — 세 가지 철칙",
        body:
          "can, must, should 같은 조동사는 본동사 앞에서 **가능·의무·조언** 같은 뉘앙스를 입혀요. 어떤 조동사든 공통 철칙 세 가지를 지켜요.\n\n" +
          "**① 뒤에는 동사원형** — She can swim. (swims X, to swim X)\n" +
          "**② 3인칭 -s를 안 붙여요** — He must go. (musts X)\n" +
          "**③ 부정·의문을 스스로 해결** — can't / Can you ~? (do 불필요)\n\n" +
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
        body:
          "can은 **능력**(할 수 있다), **허가**(해도 된다), **부탁**(해줄래요?)을 모두 커버하는 만능 조동사예요.\n\n" +
          "문제는 듣기예요. 긍정 can은 약하게 [kən] '큰'으로 뭉개지고, 부정 can't는 강하게 [kænt] '캔트'로 발음돼요. 즉 **'캔'이라고 또렷이 들리면 오히려 can't일 가능성**이 높아요. 끝의 t는 거의 안 들리니, 강세로 구별하는 훈련이 필요해요.",
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
        body:
          "must와 have to는 긍정문에서 둘 다 '~해야 한다'예요. (뉘앙스 차이: must는 말하는 사람의 판단, have to는 규칙·사정 때문 — A2에서는 '거의 같다'로 충분해요.)\n\n" +
          "**진짜 함정은 부정**이에요.\n\n" +
          "**must not (mustn't)** = **금지** — 하면 안 된다\n" +
          "**don't have to** = **불필요** — 안 해도 된다 (해도 되고)\n\n" +
          "긍정에서 같았던 둘이 부정에서는 정반대급으로 갈라져요. 'You don't have to pay.'는 '안 내도 돼요(공짜예요)'인데, must not로 잘못 말하면 '내면 안 됩니다!'라는 금지가 돼버려요.",
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
        body:
          "should는 '~하는 게 좋겠다'는 **조언·권유**예요. must(해야 한다)보다 훨씬 부드러워서, 충고할 때의 기본값이에요.\n\n" +
          "강도 순으로 줄을 세우면: **must/have to(해야 한다) > should(하는 게 좋다) > can(해도 된다)**. 한국어로 조언할 때 '~해야지!'보다 '~하는 게 좋을 것 같아'가 부드러운 것처럼, 영어도 should가 관계를 지켜주는 선택이에요.",
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
    order: 5,
    title: "현재완료 입문 — 과거가 지금까지 닿아 있다",
    titleFr: "Present perfect: an introduction",
    summary: "한국어에 없어서 평생 회피하게 되는 시제, 현재완료. '과거의 일이 지금까지 닿아 있다'는 프레임 하나로 입문해요.",
    duration: "약 10분",
    sections: [
      {
        heading: "한국어에 없는 시제 — 그래서 회피하게 된다",
        body:
          "현재완료(have + 과거분사)가 어려운 근본 이유: 한국어에는 **이에 대응하는 시제가 없어요**. '먹었어, 갔어, 잃어버렸어' — 한국어 '-었-'은 과거형과 현재완료를 구분 없이 다 덮어버려요. 그래서 한국 학습자는 전부 과거형으로 말하고 현재완료를 평생 회피하는 경향이 있어요.\n\n" +
          "프레임은 이거 하나예요 — **현재완료 = 과거에 시작된 일이 지금까지 닿아 있다.**\n\n" +
          "'I lost my key.'(과거형)는 그냥 과거의 사건 보고예요. 지금 찾았는지 어떤지는 관심 밖이죠. 'I **have lost** my key.'(현재완료)는 '잃어버려서 **지금도 없어**'라는 말이에요 — 과거의 사건이 지금의 상황(열쇠 없음, 못 들어감)에 닿아 있어요. 무게중심이 **지금**에 있는 시제예요.",
        examples: [
          { en: "I lost my key yesterday.", ko: "어제 열쇠를 잃어버렸어요.", note: "과거의 사건 보고 — 지금은 찾았을 수도" },
          { en: "I've lost my key. I can't get in!", ko: "열쇠를 잃어버렸어요. 못 들어가요!", note: "지금도 없음 — 현재에 닿아 있는 과거" },
          { en: "She has gone to Canada.", ko: "그녀는 캐나다에 가(서 지금 여기 없어)요.", note: "간 결과가 지금까지 유효" },
        ],
        vsKo: "'열쇠 잃어버렸어'라는 한국어 한 문장이 영어에선 lost(그때 얘기)와 have lost(지금도 그래) 둘로 갈라져요. 한국어 '-었-'이 두 시제를 모두 덮고 있다는 걸 자각하는 것이 현재완료 정복의 첫걸음이에요. 번역하지 말고 '지금에 닿아 있나?'를 물어보세요.",
      },
      {
        heading: "형태 — have/has + 과거분사(p.p.)",
        body:
          "형태는 **have/has + 과거분사**예요. 과거분사(p.p.)는 동사의 세 번째 모양 — 규칙동사는 과거형과 같고(-ed), 불규칙동사는 따로 외워요(go-went-**gone**, see-saw-**seen**, eat-ate-**eaten**).\n\n" +
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
        body:
          "현재완료의 가장 실용적인 용법이 **경험**이에요. '~해본 적 있다'는 과거의 경험이 '지금의 나'를 이루고 있다는 말이니, 현재에 닿아 있는 시제가 어울리는 거죠.\n\n" +
          "**have been to** = ~에 가본 적 있다. been인 이유는, 갔다가 **돌아왔기** 때문이에요. have **gone** to는 '가버려서 지금 없다'는 전혀 다른 말이 돼요.\n\n" +
          "경험 질문의 만능 패턴: **Have you ever + p.p. ~?**(~해본 적 있어요?) / 답: Yes, I have. / No, I never have. / No, never.",
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
        body:
          "구별 규칙 하나만 챙기면 A2 수준은 충분해요 — **yesterday, last year, in 2020, when ~처럼 '언제'가 박힌 문장에는 현재완료를 쓸 수 없어요.** 시점이 찍히는 순간 그 일은 과거에 고정되고, '지금까지 닿아 있다'는 현재완료와 모순되거든요.\n\n" +
          "그래서 'When **have you arrived**?'(X)는 불가능한 조합이에요 — when 자체가 시점을 묻는 말이니까요. → When **did** you arrive?(O)\n\n" +
          "반대로 just(방금), already(이미), yet(아직), ever/never(지금까지)는 현재완료의 단짝이에요 — 전부 '지금'을 기준으로 하는 말이라서요.",
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
    order: 6,
    title: "to부정사 vs 동명사 — 동사 뒤에 동사가 올 때",
    titleFr: "Infinitive vs gerund",
    summary: "want to go인데 enjoy going인 이유. 암기가 필요한 동사들과, stop to/-ing처럼 의미가 갈리는 함정을 정리해요.",
    duration: "약 9분",
    sections: [
      {
        heading: "동사 뒤에 동사를 이으려면 — 두 가지 연결 장치",
        body:
          "'수영하는 것을 좋아해요'처럼 동사 뒤에 또 동사가 올 때, 영어는 두 번째 동사를 그냥 둘 수 없어요. **to부정사(to swim)** 또는 **동명사(swimming)**로 모양을 바꿔야 해요.\n\n" +
          "'I want **swim**.'(X)처럼 원형을 그대로 이으면 틀려요 — 한 문장에 시제 달린 동사는 하나뿐이라는 영어의 원칙 때문이에요. 둘째 동사는 to나 -ing라는 옷을 입고 '명사 역할'로 변신해야 입장이 허락돼요.\n\n" +
          "어느 옷을 입힐지는 **앞 동사가 결정**해요. want는 to만 받고, enjoy는 -ing만 받아요. 여기에 논리는 절반, 암기가 절반이에요.",
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
        body:
          "to를 받는 동사들은 대체로 **'아직 안 한 일'을 향하는** 동사예요 — 원하고(want), 계획하고(plan), 결심하고(decide), 바라는(hope) 일은 모두 미래에 있죠. 'to = 화살표' 프레임이 잘 통하는 그룹이에요.\n\n" +
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
        body:
          "몇몇 동사는 둘 다 받지만 **뜻이 달라져요**. 대표가 stop이에요.\n\n" +
          "**stop smoking** = 담배를 끊다 (흡연이라는 행위를 중단 — 스냅사진을 정지)\n" +
          "**stop to smoke** = 담배 피우러 멈추다 (하던 일을 멈추고, 피우는 쪽**으로** — 화살표)\n\n" +
          "to/-ing의 감각 프레임이 그대로 적용되죠? remember/forget도 같은 원리예요 — remember **to lock**(잠가야 한다는 걸 기억해, 아직 안 한 일) vs remember **locking**(잠갔던 게 기억나, 이미 한 일).",
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
    order: 7,
    title: "빈도부사와 어순 — always의 지정석",
    titleFr: "Adverbs of frequency & word order",
    summary: "always부터 never까지 빈도의 사다리를 세우고, 한국어와 달리 자리가 정해져 있는 빈도부사의 지정석 규칙을 익혀요.",
    duration: "약 8분",
    sections: [
      {
        heading: "빈도의 사다리 — always에서 never까지",
        body:
          "'얼마나 자주'를 나타내는 부사를 **빈도부사**라고 해요. 100%에서 0%까지 사다리로 세워두면 감이 잡혀요. 숫자는 대략의 느낌이에요 — 정확한 수치라기보다 상대적 위치로 기억하세요.",
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
        body:
          "한국어 부사는 자리가 자유롭죠 — '나는 항상 아침을 먹어 / 항상 나는 아침을 먹어' 둘 다 자연스러워요. 영어 빈도부사는 **지정석**이 있어요.\n\n" +
          "**① be 동사 뒤** — She **is always** late.\n" +
          "**② 일반동사 앞** — She **always comes** late.\n\n" +
          "왜 자리가 둘이냐고요? 사실 지정석은 하나예요 — **'조동사가 앉을 자리'**, 즉 문장의 문법 엔진 바로 옆이에요. be는 엔진이 강해서 부사가 뒤로 가고, 일반동사는 엔진(do)이 숨어 있어서 부사가 그 빈자리(동사 앞)에 앉는 거예요. 실제로 조동사가 등장하면 그 뒤에 앉아요 — You should **always** check.",
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
        body:
          "다만 모든 빈도부사가 좌석에 묶인 건 아니에요. **sometimes, usually, often**은 강조를 위해 문장 맨 앞이나 맨 뒤로 이동할 수 있어요 — Sometimes I cook. / I visit my parents often.\n\n" +
          "반대로 **always와 never는 이동 금지**예요. 'Always I'm busy.'(X), 'Never I drink.'(X) — 이 둘은 지정석에서만 쓰세요. (Never를 문두에 두는 도치 구문이 있긴 하지만 C1의 영역이에요.)",
        examples: [
          { en: "Sometimes I just want to stay home.", ko: "가끔은 그냥 집에 있고 싶어요.", note: "sometimes는 문두 OK" },
          { en: "Usually, I take the subway to work.", ko: "보통은 지하철로 출근해요." },
          { en: "I'm always on your side.", ko: "난 항상 네 편이야.", note: "always는 지정석에서만" },
        ],
        tip: "헷갈리면 **무조건 지정석(be 뒤·일반동사 앞)**에 두세요. 이동은 '되는 부사도 있다' 수준으로만 알아두면 — 지정석은 모든 빈도부사에게 항상 합법이니까요.",
      },
      {
        heading: "빈도를 묻고 답하기 — How often?",
        body:
          "빈도를 묻는 질문은 **How often ~?**이에요. 답할 땐 빈도부사 말고도 **횟수 표현**을 자주 써요 — once(한 번), twice(두 번), three times(세 번부터는 times) + a day/week/month.\n\n" +
          "'일주일에 두 번'의 어순에 주의하세요 — 영어는 **횟수 먼저, 기간 나중**(twice a week)이에요. 한국어와 순서가 반대죠.",
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
    order: 8,
    title: "there is/are와 비인칭 it — '있다'가 갈라지는 길목",
    titleFr: "There is / there are & impersonal it",
    summary: "한국어 '있다' 하나가 영어에선 there is(존재)와 have(소유)로 갈라져요. 주어가 꼭 필요한 영어의 해결사, 비인칭 it도 함께.",
    duration: "약 9분",
    sections: [
      {
        heading: "'있다'의 두 갈래 — 존재의 there is, 소유의 have",
        body:
          "한국어 '있다'는 만능이에요 — '책상 위에 책이 있다'(존재)도, '나는 펜이 있다'(소유)도 같은 '있다'죠. 영어는 이 둘을 **다른 동사**로 갈라요.\n\n" +
          "**존재** — 어디에 무엇이 있다: **There is/are ~**\n" +
          "**소유** — 누가 무엇을 가지고 있다: **have**\n\n" +
          "'나는 펜이 있다'를 직역해서 'There is a pen to me.'(X)나 'I am have a pen.'(X)을 만들면 안 돼요 — 소유는 깔끔하게 **I have a pen.** 분기 질문은 하나예요: **주인이 있는 '있다'인가?** 주인이 있으면 have, 장소에 놓여 있으면 there is.",
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
        body:
          "뒤에 오는 명사가 단수면 **There is**, 복수면 **There are**. 여기서 there는 '거기'라는 뜻이 아니라 **자리만 채우는 가짜 주어**예요. 진짜 주어는 뒤의 명사라서, 수일치도 뒤의 명사에 맞춰요.\n\n" +
          "부정·의문은 be 동사 규칙 그대로 — There isn't ~ / Is there ~? 그리고 A1에서 배운 some/any 규칙이 여기서 활약해요: 긍정엔 some, 부정·의문엔 any.",
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
        body:
          "한국어는 '비 와', '3시야', '멀어'처럼 주어 없이 말하는 게 자연스럽죠. 그런데 영어는 **주어 없는 문장을 허용하지 않아요**(A1 1챕터의 제1법칙). 그래서 날씨·시간·거리·요일처럼 주어가 마땅치 않은 문장에 **빈자리를 채우는 전담 요원 it**을 투입해요.\n\n" +
          "이 it은 '그것'이라고 해석하면 안 돼요 — 뜻이 없는 **문법적 자리 채우기**예요. 'It's raining.'은 '그것이 비 온다'가 아니라 그냥 '비 와요'.",
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
        body:
          "둘 다 '뜻 없는 가짜 주어'라 헷갈리기 쉬운데, 분업은 명확해요.\n\n" +
          "**there is** = 새로운 것의 **등장** — '~가 있다'고 처음 소개할 때\n" +
          "**it** = 이미 아는 것·상황을 **지칭** — 앞에 나온 그것, 또는 날씨·시간\n\n" +
          "그래서 둘은 한 대화에서 자연스럽게 이어 등장해요: There is a cafe near my house.(카페가 하나 있어요 — 등장) **It** opens at eight.(거긴 8시에 열어요 — 그 카페를 지칭) — A1 관사에서 배운 a → the 흐름과 정확히 같은 원리예요.",
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
