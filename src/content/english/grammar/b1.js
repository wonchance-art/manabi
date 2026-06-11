/**
 * B1 중급 — 시험영어를 '쓰는 영어'로 바꾸는 핵심 문법
 * 규칙은 이미 아는데 입과 손에서 안 나오는 지점을 정면 공략하는 레벨.
 */
export default [
  {
    slug: "b1-01-present-perfect-past",
    level: "B1",
    order: 1,
    title: "\"열쇠 잃어버렸어\"가 둘로 갈릴 때",
    topic: "현재완료 vs 과거시제",
    titleFr: "Present Perfect vs Past Simple",
    summary: "have p.p.를 '경험·완료·계속'으로 암기만 하고 회피해온 분들을 위해, 두 시제의 진짜 차이를 한 장의 그림으로 정리해요.",
    duration: "약 11분",
    sections: [
      {
        heading: "왜 우리는 현재완료를 피하게 됐나",
        pattern: "I ate = 끝난 옛날이야기 ↔ I have eaten = 지금에 닿아 있는 이야기",
        patternKo: "현재완료 = 현재에 무게가 실린 시제",
        body:
          "한국어 '-았/었'은 하나뿐이라, 영어가 같은 '먹었다'를 **I ate**와 **I have eaten**으로 나누는 순간 우리는 본능적으로 둘 다 과거형으로 때우게 돼요. 핵심 그림: **과거시제는 '끝난 옛날이야기'**, **현재완료는 '과거에서 출발해 지금에 닿아 있는 이야기'**예요.\n\n" +
          "I lost my keys(그 후 찾았는지는 모름) vs I have lost my keys(**지금도 없다**). 현재완료는 이름과 달리 과거 시제가 아니라 '지금 어떤 상태인가'를 말하는 도구예요.",
        examples: [
          { en: "I lost my keys yesterday.", ko: "어제 열쇠를 잃어버렸어요. (끝난 과거 사건 — 지금은 찾았을 수도)", note: "과거의 한 점" },
          { en: "I have lost my keys.", ko: "열쇠를 잃어버렸어요. (그래서 지금 없어요)", note: "현재에 닿아 있는 결과" },
          { en: "She went to London in 2020.", ko: "그녀는 2020년에 런던에 갔어요.", note: "언제인지 명시 = 과거시제" },
          { en: "She has gone to London.", ko: "그녀는 런던에 가버렸어요. (지금 여기 없어요)" },
        ],
        vsKo: "한국어 '-았/었'은 시점을 가리지 않는 만능 과거예요. 그래서 '갔어요'를 영어로 옮길 때마다 went/has gone 중 선택을 강요받는 게 한국인의 고통 포인트죠. 선택 기준은 하나 — **'지금'과 연결되어 있나?** 연결되어 있으면 have p.p., 끊어진 옛일이면 과거시제예요.",
      },
      {
        heading: "결정적 판별법 — 시간 표현이 답을 알려줘요",
        pattern: "yesterday · ~ ago · in 2020 → 과거 ↔ since · for · just · yet · ever → 현재완료",
        body:
          "문장 속 시간 표현이 거의 답을 정해줘요. **끝난 시점을 콕 찍는 말**(yesterday, last week, in 2020, ago)이 있으면 무조건 과거시제 — 현재완료와는 절대 같이 못 써요.\n\n" +
          "반대로 **since + 시작점**(~이후로 지금까지), **for + 기간**(~동안 지금까지), just·already·yet·ever/never처럼 '지금까지'를 품은 말은 현재완료의 짝이에요.",
        table: {
          caption: "신호어로 시제 고르기",
          headers: ["신호어", "시제", "예문"],
          rows: [
            ["yesterday, last ~, ~ ago, in 2020", "과거", "I saw him yesterday."],
            ["since + 시작점", "현재완료", "I have lived here since 2021."],
            ["for + 기간 (지금까지)", "현재완료", "We have known each other for ten years."],
            ["just / already", "현재완료", "I have just finished lunch."],
            ["yet (부정·의문)", "현재완료", "Have you finished yet?"],
            ["ever / never", "현재완료", "Have you ever been to Busan?"],
          ],
        },
        examples: [
          { en: "I have lived in Seoul since 2021.", ko: "2021년부터 (지금까지) 서울에 살고 있어요.", note: "since = 현재완료의 단짝" },
          { en: "Have you ever tried Korean barbecue?", ko: "한국식 바비큐 먹어본 적 있어요?", note: "ever = 살면서 한 번이라도" },
          { en: "I haven't finished the report yet.", ko: "보고서를 아직 못 끝냈어요.", note: "yet은 문장 끝에" },
        ],
        pitfall: "**I have seen him yesterday.** — 한국 학습자 단골 오류 1위예요. yesterday처럼 '끝난 시점'을 찍는 말이 나오는 순간 현재완료는 탈락, 무조건 과거시제(I saw him yesterday)입니다. 반대로 since/for(지금까지)가 보이면 과거시제(I lived here since 2021 ×)가 탈락이에요.",
      },
      {
        heading: "경험 말하기 — have been to의 마법",
        pattern: "Have you ever + p.p.? → 네 답하면 → When did you ~? (과거시제 전환)",
        patternKo: "문 열기는 현재완료, 들어가서는 과거시제",
        body:
          "경험 질문의 만능 공식은 **Have you ever + p.p.?**예요. 그리고 **have been to**(가본 적 있다)와 **have gone to**(가버려서 지금 없다)는 전혀 다른 말 — 스몰토크에서 쓰는 건 거의 항상 have been to예요.\n\n" +
          "주의: 상대가 '네'라고 답한 뒤 구체적인 이야기('언제? 어땠어?')로 들어가면 **과거시제로 갈아타요**. 이 전환이 자연스러우면 중급 티가 확 납니다.",
        examples: [
          { en: "A: Have you ever been to Jeju? — B: Yes, I have.", ko: "A: 제주도 가본 적 있어요? — B: 네, 있어요." },
          { en: "A: When did you go? — B: I went there last spring. It was beautiful.", ko: "A: 언제 갔어요? — B: 지난봄에요. 정말 아름다웠어요.", note: "구체적 이야기 = 과거시제로 전환!" },
          { en: "He has gone to the bank. He'll be back soon.", ko: "그는 은행에 갔어요. (지금 자리에 없어요) 곧 돌아올 거예요." },
        ],
        tip: "대화의 리듬으로 외우세요 — **문 열기는 현재완료(Have you ever...?), 들어가서는 과거시제(When did you...?)**. 원어민 스몰토크의 80%가 이 패턴으로 흘러갑니다.",
      },
      {
        heading: "현실 체크 — 미국 영어는 과거시제를 더 좋아해요",
        pattern: "I just ate. (미국 구어) = I have just eaten. — 역방향은 불가",
        body:
          "교과서는 just/already/yet에 현재완료를 쓰지만, **미국 구어에서는 과거시제가 아주 흔해요** — I just ate. / Did you eat yet? 전부 자연스러워요. (영국 영어는 현재완료를 더 지키는 편이에요.)\n\n" +
          "단, **반대 방향은 안 돼요**. yesterday 같은 확정 과거 시점에 현재완료를 쓰는 건 어디서도 오류예요. 시험·격식 작문에서는 교과서 규칙대로 쓰는 게 안전합니다.",
        examples: [
          { en: "I just got home. (미국 구어) = I have just got home. (영국)", ko: "방금 집에 왔어요.", note: "둘 다 OK" },
          { en: "Did you eat lunch yet? (미국 구어) = Have you eaten lunch yet?", ko: "점심 벌써 먹었어요?" },
        ],
        etym: "perfect는 라틴어 **perfectum(완전히 이루어진)** — per(완전히)+facere(만들다)에서 왔어요. '완료'라는 문법 용어 자체가 '만들어져 **현재 완성돼 있는** 상태'라는 뜻이죠. factory, fact도 같은 facere 가족이에요.",
      },
    ],
  },

  {
    slug: "b1-02-conditionals-1-2",
    level: "B1",
    order: 2,
    title: "\"시간 있으면 갈게\"와 \"갈 텐데\"",
    topic: "가정문 1·2형",
    titleFr: "Conditionals: First & Second",
    summary: "If I have time과 If I had time은 시제가 아니라 '현실성'이 달라요. 한국어 '-면' 하나로 뭉뚱그려진 두 세계를 갈라봐요.",
    duration: "약 9분",
    sections: [
      {
        heading: "한국어 '-면'은 하나, 영어 if는 여러 개",
        pattern: "1형: If + 현재, will ↔ 2형: If + 과거, would",
        patternKo: "기준은 시제가 아니라 현실성 — 진짜 가능? 그냥 상상?",
        body:
          "'시간이 있으면 갈게'(진짜 갈 수도)와 '시간이 있으면 갈 텐데'(사실 못 감) — 한국어는 둘 다 '-면'이지만, 영어는 이 차이를 **동사 형태로** 표시해요. 실현 가능한 가정은 **1형(If + 현재, will)**, 비현실적 상상은 **2형(If + 과거, would)**.\n\n" +
          "가정문의 첫 질문은 '시제가 뭐지?'가 아니라 **'이거 진짜 일어날 수 있는 일인가, 그냥 상상인가?'**예요. 현실성을 먼저 정하면 형태는 따라옵니다.",
        examples: [
          { en: "If I have time, I will visit you.", ko: "시간이 있으면 갈게요. (있을 수도 있음 — 진짜 계획)" },
          { en: "If I had time, I would visit you.", ko: "시간이 있으면 갈 텐데요. (사실 없어서 못 가요 — 상상)" },
        ],
        vsKo: "한국어는 '-면' 뒤의 어미('-ㄹ게' vs '-ㄹ 텐데')로 현실성을 표현하지만, 영어는 **if절 안의 동사 시제**로 표현해요. '과거형 = 옛날 일'이라는 등식을 잠시 내려놓으세요. 가정문의 과거형은 시간이 아니라 **현실과의 거리**를 나타내는 장치예요.",
      },
      {
        heading: "1형 — 충분히 일어날 수 있는 일",
        pattern: "If + 현재시제, will + 동사원형",
        patternKo: "if절 안에는 will 금지 — 미래여도 현재시제",
        body:
          "조건이 충족되면 실제로 벌어질 일 — 약속, 경고, 계획, 협상의 주력 가정문이에요. 포인트는 하나: **if절 안에는 will을 쓰지 않아요**. 미래의 일이라도 if절은 현재시제 — If it rains(○), If it will rain(×).\n\n" +
          "주절에는 will 대신 can, may, 명령문도 올 수 있어요: If you finish early, you can go home.",
        examples: [
          { en: "If it rains tomorrow, we will cancel the picnic.", ko: "내일 비가 오면 소풍을 취소할 거예요.", note: "if절은 현재시제 — will rain ×" },
          { en: "If you heat ice, it melts.", ko: "얼음을 가열하면 녹아요.", note: "항상 참인 사실은 양쪽 다 현재 (0형)" },
          { en: "If you need help, just call me.", ko: "도움이 필요하면 그냥 전화해요.", note: "주절에 명령문도 OK" },
        ],
        pitfall: "**If it will rain tomorrow...** — 한국 학습자가 가장 자주 빠지는 함정이에요. '내일'이라는 말에 끌려 will을 넣고 싶어지지만, **if절(조건절)과 when절(시간절) 안은 미래 대신 현재시제**가 철칙입니다. When I will arrive ×, When I arrive ○.",
      },
      {
        heading: "2형 — 현실과 반대인 상상, 그리고 If I were",
        pattern: "If + 과거시제, would/could/might + 동사원형",
        patternKo: "be동사는 주어 불문 were — If I were you",
        body:
          "지금 사실과 반대거나 가망이 거의 없는 상상 — '복권에 당첨되면', '내가 너라면'이 전부 2형이에요. 2형 if절의 be동사는 주어가 무엇이든 **were**가 격식 표준이에요(회화에선 If I was...도 들리지만, 시험·격식 작문은 were).\n\n" +
          "특히 **If I were you(내가 너라면)는 통째로 굳은 표현**이라 was로 바꾸면 오히려 어색해요. 주절에는 would 외에 could(~할 수 있을 텐데), might(~할지도 모를 텐데)도 와요.",
        examples: [
          { en: "If I won the lottery, I would quit my job.", ko: "복권에 당첨되면 일을 그만둘 텐데요. (당첨 가능성 거의 없음)" },
          { en: "If I were you, I would apologize first.", ko: "내가 너라면 먼저 사과하겠어.", note: "조언의 만능 공식" },
          { en: "If we had more time, we could travel more.", ko: "시간이 더 있다면 여행을 더 다닐 수 있을 텐데요." },
          { en: "What would you do if you were the boss?", ko: "당신이 사장이라면 어떻게 하겠어요?" },
        ],
        tip: "2형의 would는 한국어 '**-ㄹ 텐데**'와 거의 1:1로 대응해요. 문장 끝에 '-ㄹ 텐데'가 붙는 상상이면 2형, '-ㄹ게/-ㄹ 거야'로 끝나는 계획이면 1형 — 이 감각 하나로 대부분 갈립니다.",
      },
      {
        heading: "1형이냐 2형이냐 — 같은 상황, 다른 태도",
        pattern: "1형 = 진지하게 봄 · 2형 = 거리 두기 → 공손·조심스러움",
        body:
          "**같은 상황도 화자의 태도에 따라 1형과 2형을 골라 쓸 수 있어요.** If you help me, we will finish by six.(도와줄 가능성을 진지하게 봄) vs If you helped me, we would finish by six.(그럴 것 같지는 않지만...).\n\n" +
          "그래서 2형은 **공손한 부탁·조심스러운 제안**에도 쓰여요. 현실과 거리를 두면 어조가 부드러워지거든요 — Would you...?가 Will you...?보다 공손한 것과 같은 원리예요.",
        examples: [
          { en: "If you have questions, I will be happy to help.", ko: "질문이 있으면 기꺼이 도와드릴게요. (실제 상황 대비)" },
          { en: "It would be great if you could send it by Friday.", ko: "금요일까지 보내주시면 정말 감사하겠습니다.", note: "비즈니스 이메일 단골 — 2형의 공손함" },
        ],
        table: {
          caption: "1형 vs 2형 한눈에",
          headers: ["", "형태", "현실성", "한국어 감각"],
          rows: [
            ["1형", "If + 현재, will + 원형", "충분히 가능", "-면 -ㄹ게/-ㄹ 거야"],
            ["2형", "If + 과거, would + 원형", "비현실·희박", "-면 -ㄹ 텐데"],
          ],
        },
      },
    ],
  },

  {
    slug: "b1-03-passive",
    level: "B1",
    order: 3,
    title: "\"지갑을 도둑맞았어요\" — 범인은 생략",
    topic: "수동태 be+p.p.",
    titleFr: "The Passive Voice",
    summary: "수동태는 시험용 변환 연습이 아니라 '누가 했는지'를 굳이 말하고 싶지 않을 때 꺼내는 실전 도구예요.",
    duration: "약 10분",
    sections: [
      {
        heading: "수동태는 언제 쓰나 — '누가'가 중요하지 않을 때",
        pattern: "행위자를 모르거나 · 뻔하거나 · 숨기고 싶을 때 → 수동태",
        patternKo: "by ~는 정말 필요할 때만",
        body:
          "실제 영어에서 수동태를 고르는 이유는 **행위자(누가)가 안 중요하거나, 모르거나, 숨기고 싶을 때**예요 — ① 누가 했는지 모름(My bike was stolen.), ② 뻔함(English is spoken in Australia.), ③ 대상이 화제(This temple was built in 1395.), ④ 책임 흐리기(Mistakes were made.).\n\n" +
          "그래서 by ~(행위자)는 **정말 필요할 때만** 붙여요. 실제 수동태 문장의 대부분은 by 없이 끝납니다.",
        examples: [
          { en: "My wallet was stolen on the subway.", ko: "지하철에서 지갑을 도둑맞았어요.", note: "범인을 모르니 수동태가 자연스러워요" },
          { en: "This building was built in 1925.", ko: "이 건물은 1925년에 지어졌어요." },
          { en: "The decision has been made.", ko: "결정이 내려졌습니다.", note: "누가 결정했는지 흐리기 — 회사 공지 말투" },
          { en: "Hangul was invented by King Sejong.", ko: "한글은 세종대왕이 만들었어요.", note: "행위자가 핵심 정보일 때만 by" },
        ],
        tip: "수동태를 쓸지 말지 고민될 때는 자문해보세요 — **'누가'를 말할 필요가 있나?** 없다면 수동태가 자연스러운 선택일 가능성이 높아요. 반대로 행위자가 이야기의 주인공이면 그냥 능동태로 쓰는 게 영어다워요.",
      },
      {
        heading: "형태 — be + p.p., 시제는 be가 담당",
        pattern: "be + 과거분사 — 시제·조동사는 be가 변신",
        patternKo: "is made → was made → will be made → has been made",
        body:
          "수동태의 뼈대는 **be + 과거분사(p.p.)** 하나예요. 시제·조동사는 전부 **be 부분이 변신**해서 표현하고, p.p.는 끝까지 그대로예요 — 'be의 일곱 가지 옷 갈아입기'라고 생각하면 표가 한눈에 들어와요.",
        table: {
          caption: "시제별 수동태 — make로 정리",
          headers: ["시제", "형태", "예문"],
          rows: [
            ["현재", "am/is/are + p.p.", "It is made in Korea."],
            ["과거", "was/were + p.p.", "It was made last year."],
            ["미래", "will be + p.p.", "It will be made soon."],
            ["현재진행", "is being + p.p.", "It is being made now."],
            ["현재완료", "has been + p.p.", "It has been made already."],
            ["조동사", "can/must be + p.p.", "It can be made cheaply."],
          ],
        },
        examples: [
          { en: "The room is being cleaned right now.", ko: "방은 지금 청소되고 있어요.", note: "진행 수동 = is being p.p." },
          { en: "The results will be announced on Friday.", ko: "결과는 금요일에 발표될 거예요." },
        ],
        pitfall: "한국 학습자의 2대 수동태 오류: ① **be 빼먹기** — The problem solved. (×) → The problem was solved. (○) ② **자동사를 수동태로** — happen, appear, arrive는 목적어가 없는 자동사라 수동태 불가예요. The accident was happened (×) → The accident happened (○). '사고가 일어났다'의 피동 느낌 때문에 was를 넣고 싶어지는 게 함정이에요.",
      },
      {
        heading: "한국어 피동과의 대응 — '-되다/-받다/-아지다'",
        pattern: "-되다 / -받다 / -아지다 / -당하다 → be + p.p.",
        patternKo: "1:1 번역 금물 — '놀랐어요'도 I was surprised",
        body:
          "한국어 피동과의 대응: **-되다**(취소되다 be canceled), **-받다**(초대받다 be invited), **-아/어지다**(만들어지다 be made), **-당하다**(해고당하다 be fired).\n\n" +
          "단, 1:1 기계 번역은 금물이에요 — 한국어는 능동인데 영어는 수동인 경우(놀랐어요 → I was surprised)가 수두룩해요. '한국어 피동 = 영어 수동'이 아니라 **'행위자를 숨기고 싶은 마음 = 수동태'**로 기억하세요.",
        examples: [
          { en: "The meeting was canceled.", ko: "회의가 취소됐어요.", note: "-되다 ↔ be p.p." },
          { en: "We were invited to the wedding.", ko: "우리는 결혼식에 초대받았어요.", note: "-받다 ↔ be p.p." },
          { en: "I was really surprised by the news.", ko: "그 소식에 정말 놀랐어요.", note: "한국어는 능동, 영어는 수동!" },
        ],
        vsKo: "한국어 피동은 어휘마다 형태가 제각각(-이/히/리/기, -되다, -받다, -아지다)이지만 영어는 **be + p.p. 단일 공식**이에요. 형태는 영어가 훨씬 단순해요. 어려운 건 형태가 아니라 '어느 동사를 어느 방향으로 쓰는가'의 감각 — surprised, interested, bored처럼 감정 동사는 영어에서 거의 항상 수동형으로 사람 기분을 표현한다는 것부터 챙기세요.",
      },
      {
        heading: "get 수동태 — 회화의 수동태",
        pattern: "get + p.p. = 사건이 탁 벌어지는 순간의 수동태",
        patternKo: "격식 문서엔 be, 입말엔 get",
        body:
          "일상 회화에서는 be 대신 **get + p.p.**를 정말 많이 써요 — 특히 **예기치 못한 일, 사고, 변화**에는 get이 더 자연스러워요. get fired, get hurt, get stolen, get caught, get paid, get married...\n\n" +
          "be 수동태가 '상태'에 가깝다면 get 수동태는 '**사건이 탁 벌어지는 순간**'의 느낌이에요. 격식 문서에는 be, 입말에는 get — 이 감각으로 구분하면 됩니다.",
        examples: [
          { en: "He got fired last month.", ko: "그는 지난달에 해고당했어요.", note: "회화에서는 was fired보다 흔해요" },
          { en: "Be careful not to get hurt.", ko: "다치지 않게 조심하세요." },
          { en: "I got paid yesterday.", ko: "어제 월급 받았어요.", note: "'-당하다/-받다'의 입말 짝꿍이 get" },
        ],
      },
    ],
  },

  {
    slug: "b1-04-relative-clauses",
    level: "B1",
    order: 4,
    title: "\"어제 만난 사람\"을 뒤집어 말하기",
    topic: "관계대명사 who/which/that",
    titleFr: "Relative Clauses: who / which / that",
    summary: "한국어는 '어제 만난 사람', 영어는 'the person who I met yesterday'. 머릿속 어순을 반전시키는 훈련이 이 챕터의 전부예요.",
    duration: "약 10분",
    sections: [
      {
        heading: "어순 반전 — 한국어는 앞에서, 영어는 뒤에서 꾸며요",
        pattern: "명사 먼저 + [who/which/that + 설명]",
        patternKo: "한국어 [어제 만난] 사람 ↔ 영어 the person [who I met]",
        body:
          "관계대명사가 어려운 진짜 이유는 who/which 선택이 아니라 **수식의 방향**이에요 — 한국어는 꾸미는 말이 명사 **앞**, 영어는 명사 **뒤**. 한국어로 문장을 다 설계한 뒤 번역하면 어순이 꼬여요.\n\n" +
          "요령은 **명사부터 먼저 말하고 설명을 뒤에 이어 붙이는 것** — 'the person... 누구냐면... who I met yesterday'의 리듬이에요. 관계대명사 자체는 두 문장을 잇는 접착제예요: I met a person **who** works at Google.",
        examples: [
          { en: "The man who lives next door is a doctor.", ko: "옆집에 사는 남자는 의사예요.", note: "한국어 [옆집에 사는]이 영어에선 뒤로" },
          { en: "I lost the book which you lent me.", ko: "네가 빌려준 책을 잃어버렸어." },
          { en: "Do you remember the restaurant that we went to last year?", ko: "작년에 우리가 갔던 식당 기억나?" },
        ],
        vsKo: "한국어는 아무리 긴 수식어도 명사 앞에 쌓는 좌분기 언어, 영어는 명사를 먼저 놓고 뒤로 풀어내는 우분기 언어예요. 그래서 영어 듣기에서는 **명사가 들리는 순간 '아직 끝이 아니다, 설명이 따라온다'**는 기대를 걸어야 해요. 이 기대 하나가 독해·청해 속도를 바꿉니다.",
      },
      {
        heading: "who / which / that — 선택은 생각보다 단순해요",
        pattern: "사람 → who · 사물 → which · 만능 → that (콤마 뒤 that 금지)",
        patternKo: "소유는 whose — a friend whose sister is a singer",
        body:
          "**who**는 사람, **which**는 사물·동물, **that**은 대부분 대체 가능(회화 최다 출전), **whose**는 소유 관계예요. 고민될 때 that을 쓰면 거의 안전하지만, **콤마 뒤(계속적 용법)에는 that을 못 써요** — 콤마가 보이면 who/which입니다.\n\n" +
          "콤마 있는 관계절은 '꼭 필요한 정보'가 아니라 **'덧붙이는 참고 정보'**예요: My brother, who lives in Busan, is visiting.",
        examples: [
          { en: "She is the designer who made this logo.", ko: "그녀가 이 로고를 만든 디자이너예요." },
          { en: "I bought a phone that has two cameras.", ko: "카메라가 두 개 달린 폰을 샀어요." },
          { en: "This is Mina, who I told you about.", ko: "이쪽은 미나예요, 내가 말했던 그 친구.", note: "콤마 뒤라 that 불가" },
          { en: "I have a friend whose father is a pilot.", ko: "아버지가 파일럿인 친구가 있어요." },
        ],
        pitfall: "**중복 대명사 함정** — The book that I read it was great. (×) 관계대명사 that이 이미 '그 책'을 대신하고 있으니 it을 또 넣으면 안 돼요. 한국어 머리로는 '내가 그것을 읽은'이라고 생각돼서 it이 들어가기 쉬운데, 관계사절 안에서 그 자리는 **비워두는 것**이 규칙입니다. The book that I read was great. (○)",
      },
      {
        heading: "생략 — 원어민이 짧게 말하는 비밀",
        pattern: "관계사 + 주어+동사 = 목적격 → 생략 OK · 관계사 + 동사 = 주격 → 생략 불가",
        body:
          "관계대명사는 **목적격일 때 생략 가능**하고, 원어민 회화에서는 생략하는 쪽이 압도적으로 자연스러워요 — The movie (that) we watched was boring.\n\n" +
          "반대로 **주격은 생략 불가**예요. The man who called you...에서 who를 빼면 '남자가 전화했다'라는 다른 문장이 돼버리니까요. 판별 공식: **관계사 바로 뒤에 '주어+동사'가 오면 생략 OK, 바로 동사가 오면 생략 불가.**",
        examples: [
          { en: "The movie we watched last night was amazing.", ko: "어젯밤에 본 영화 진짜 좋았어.", note: "(that) 생략 — 회화의 기본값" },
          { en: "Is this the bag you were looking for?", ko: "이게 찾던 가방이에요?", note: "(that/which) 생략" },
          { en: "The woman who called you is waiting outside.", ko: "전화했던 여자분이 밖에서 기다려요.", note: "주격 who — 생략 불가" },
        ],
        tip: "독해에서 **명사 뒤에 곧바로 '주어+동사'가 붙어 있으면** 십중팔구 관계사가 생략된 거예요. The book my friend recommended... 을 보고 '명사가 두 번? 문장이 이상한데?'라고 멈추지 말고 [my friend recommended]를 통째로 수식어 괄호로 묶으세요. 끊어 읽기 실력이 한 단계 올라갑니다.",
      },
      {
        heading: "where와 when — 장소·시간 버전",
        pattern: "장소 + where ~ · 시간 + when ~",
        patternKo: "where = in which의 압축",
        body:
          "선행사가 장소면 **where**, 시간이면 **when** — 용법은 같아요, 명사 뒤에 설명 붙이기. This is the cafe **where** we first met. / the day **when** we first met.\n\n" +
          "where는 'in which(그 안에서)'를 압축한 말이에요. B1에서는 where/when만 자연스럽게 쓸 수 있으면 충분합니다.",
        examples: [
          { en: "That's the hospital where I was born.", ko: "저기가 내가 태어난 병원이에요." },
          { en: "Do you remember the day when we first met?", ko: "우리가 처음 만난 날 기억해요?" },
          { en: "I want to live in a city where it never snows.", ko: "눈이 절대 안 오는 도시에서 살고 싶어요." },
        ],
      },
    ],
  },

  {
    slug: "b1-05-reported-speech",
    level: "B1",
    order: 5,
    title: "\"바쁘대\"를 영어로 옮기는 법",
    topic: "간접화법·시제 후퇴",
    titleFr: "Reported Speech",
    summary: "'그가 바쁘대'를 영어로 — 따옴표를 벗기는 순간 시제가 한 칸씩 뒤로 밀리는 규칙과, say/tell의 구별을 정리해요.",
    duration: "약 10분",
    sections: [
      {
        heading: "왜 시제가 뒤로 밀리나 — 보고 시점의 논리",
        pattern: "현재 → 과거 · 과거 → 과거완료 · will → would · can → could",
        patternKo: "보고 시점 기준으로 시계를 한 칸 뒤로 (backshift)",
        body:
          "He said, \"I am busy.\" → He said he **was** busy. — 이 **시제 후퇴(backshift)**는 암기 규칙이기 전에 논리예요. 그가 '바쁘다'고 말한 건 말하던 그 시점의 일이고, 지금 보고하는 시점에서 보면 이미 과거니까요.\n\n" +
          "공식: **현재→과거, 과거→과거완료, will→would, can→could, must→had to**. 시계를 한 칸씩 뒤로 돌린다고 생각하세요.",
        table: {
          caption: "시제 후퇴 한 칸 표",
          headers: ["직접화법", "간접화법", "예"],
          rows: [
            ["현재 (am/do)", "과거 (was/did)", "\"I am tired.\" → He said he was tired."],
            ["현재진행 (is doing)", "과거진행 (was doing)", "\"I am working.\" → She said she was working."],
            ["과거 (did)", "과거완료 (had done)", "\"I saw it.\" → He said he had seen it."],
            ["현재완료 (has done)", "과거완료 (had done)", "\"I have finished.\" → She said she had finished."],
            ["will", "would", "\"I will call.\" → He said he would call."],
            ["can", "could", "\"I can help.\" → She said she could help."],
          ],
        },
        examples: [
          { en: "\"I am busy.\" → He said (that) he was busy.", ko: "\"나 바빠.\" → 그가 바쁘다고 했어요." },
          { en: "\"I will be late.\" → She said she would be late.", ko: "\"늦을 거야.\" → 그녀가 늦을 거라고 했어요." },
        ],
        tip: "지금도 변함없는 사실이라면 후퇴를 안 해도 돼요. She said she **loves** coffee. (지금도 좋아하니까) — 후퇴는 의무가 아니라 '보고 시점과의 거리 표시'예요. 다만 시험에서는 후퇴시키는 게 안전한 기본값입니다.",
      },
      {
        heading: "say vs tell — 한 끗 차이로 감점되는 단골",
        pattern: "say + 내용 · tell + 사람 + 내용",
        patternKo: "said me(×) · told me(○) · said to me(○)",
        body:
          "**say + 내용**(He said he was tired. — 사람을 붙이려면 say to me), **tell + 사람 + 내용**(He told **me** he was tired. — 듣는 사람 필수).\n\n" +
          "tell이 들어가는 굳은 표현은 예외적으로 사람 없이도 써요: tell the truth, tell a lie, tell a story, tell the difference.",
        examples: [
          { en: "He told me that the meeting was canceled.", ko: "그가 회의가 취소됐다고 (나에게) 말해줬어요." },
          { en: "She said that she was moving to Busan.", ko: "그녀가 부산으로 이사 간다고 했어요." },
          { en: "Don't worry, I won't tell anyone.", ko: "걱정 마요, 아무한테도 말 안 할게요." },
        ],
        pitfall: "**He said me...** — 한국어 '나에게 말했다'를 직역하면서 나오는 최다 빈출 오류예요. say는 사람을 바로 못 받아요. 사람을 말하고 싶으면 **told me**로 동사를 갈아타거나 **said to me**로 to를 끼우세요. 면접·스피킹 시험에서 유난히 눈에 띄는 실수입니다.",
      },
      {
        heading: "질문과 부탁 옮기기",
        pattern: "asked if/wh- + 평서문 어순 · told/asked + 사람 + (not) to부정사",
        body:
          "**의문문 옮기기** — asked를 쓰고 어순은 **평서문으로 복귀**해요. Yes/No 질문은 **if/whether**(She asked **if** I was OK.), 의문사 질문은 의문사 유지(He asked **where I lived**. — where did I live ×).\n\n" +
          "**명령·부탁**은 to부정사로 압축해요: He told me **to wait** there. / 금지는 not to: He told me **not to be** late.",
        examples: [
          { en: "She asked if I had eaten lunch.", ko: "그녀가 점심 먹었냐고 물었어요." },
          { en: "He asked where I worked.", ko: "그가 어디서 일하냐고 물었어요.", note: "where did I work × — 평서문 어순으로" },
          { en: "The doctor told me to get more sleep.", ko: "의사가 잠을 더 자라고 했어요." },
          { en: "She asked me not to tell anyone.", ko: "그녀가 아무에게도 말하지 말아 달라고 부탁했어요." },
        ],
        pitfall: "간접 의문문 안에서 **의문문 어순을 유지하는 실수** — He asked where did I live. (×) 의문문을 옮기는 순간 do/does/did는 사라지고 평서문 어순(where I lived)으로 돌아갑니다. I don't know what time is it. (×) → what time it is. (○) 같은 간접의문문 전반에 통하는 규칙이에요.",
      },
      {
        heading: "한국어 '-대/-래'와 비교 — 우리는 이미 간접화법 고수",
        pattern: "-대 = said (that) · -래 = told me to · -냬 = asked if/wh-",
        patternKo: "차이는 시제 — 영어만 한 칸 후퇴",
        body:
          "한국어 화자는 간접화법을 매일 써요 — '바쁘**대**', '오**래**', '가**냬**'. 대응은 **-대** = said (that)..., **-래** = told me to..., **-냬** = asked if/wh-...예요.\n\n" +
          "차이는 시제예요. 한국어는 인용 내용의 시제를 원래대로 두지만, 영어는 보고 동사에 맞춰 **시제를 끌어내려요**. '-대'를 번역할 때는 ① said를 놓고 ② 내용 시제를 한 칸 후퇴 — 이 2단계만 기계적으로 적용하면 됩니다.",
        examples: [
          { en: "He says he is busy.", ko: "그가 바쁘대요. (지금 전하는 말 — says면 후퇴 없음)" },
          { en: "He said he was busy.", ko: "그가 바쁘다고 했어요. (과거 보고 — 한 칸 후퇴)" },
          { en: "She told me to come early.", ko: "그녀가 일찍 오래요." },
        ],
        vsKo: "한국어 인용 어미 '-대/-래/-냬'는 시제를 건드리지 않아요('바쁘대'의 '바쁘-'는 현재 그대로). 영어 backshift가 어색하게 느껴지는 근본 이유가 이거예요. '영어는 보고 시점 기준으로 시계를 다시 맞춘다'고 생각하면 후퇴가 논리로 다가옵니다.",
      },
    ],
  },

  {
    slug: "b1-06-modals-speculation",
    level: "B1",
    order: 6,
    title: "\"그럴 리 없어\"까지, 확신의 온도",
    topic: "추측 조동사 must/might/can't",
    titleFr: "Modals of Speculation: must / might / can't",
    summary: "must be(틀림없다)부터 can't be(그럴 리 없다)까지 — 확신의 정도를 조동사 하나로 조절하는 법을 배워요.",
    duration: "약 8분",
    sections: [
      {
        heading: "조동사는 확신의 온도계예요",
        pattern: "must be(95%) > should be(75%) > might be(30~50%) > can't be(0%)",
        patternKo: "-임에 틀림없어 > -일 거야 > -일지도 > -일 리 없어",
        body:
          "He is at home.(사실 단정)과 He must be at home.(정황상 틀림없음), He might be at home.(그럴 수도) — 영어는 **확신의 정도를 조동사로** 표현해요.\n\n" +
          "한국어 어미 '-임에 틀림없어 / -일 거야 / -일지도 몰라 / -일 리 없어'와 깔끔하게 대응돼요. 단정(is)과 추측(must be) 사이의 온도를 고르는 습관 — 이게 중급 회화의 품격을 만듭니다.",
        table: {
          caption: "확신의 온도계",
          headers: ["조동사", "확신도", "한국어 감각", "예문"],
          rows: [
            ["must be", "약 95%", "-임에 틀림없어", "He must be tired."],
            ["should be", "약 75%", "(정상이라면) -일 거야", "She should be home by now."],
            ["may / might / could be", "30~50%", "-일지도 몰라", "It might be true."],
            ["can't be", "거의 0%", "-일 리가 없어", "That can't be right."],
          ],
        },
        examples: [
          { en: "You've been working all day. You must be exhausted.", ko: "하루 종일 일했잖아요. 분명 녹초가 됐겠네요.", note: "증거 기반 추측" },
          { en: "The lights are off. They might be asleep.", ko: "불이 꺼져 있네요. 자고 있을지도 몰라요." },
          { en: "That can't be true. I saw him an hour ago.", ko: "그럴 리가 없어요. 한 시간 전에 그를 봤는걸요." },
        ],
      },
      {
        heading: "must be의 반대는 mustn't be가 아니라 can't be",
        pattern: "must be(틀림없다) ↔ can't be(그럴 리 없다)",
        patternKo: "mustn't = 금지 — 추측이 아니에요",
        body:
          "'틀림없다'의 반대, 즉 '**그럴 리 없다**'는 **can't be**예요 — mustn't be가 아니에요. **mustn't**는 추측이 아니라 **금지**(~하면 안 된다)예요: You mustn't smoke here.\n\n" +
          "참고로 의무의 must(~해야 한다)와 추측의 must(~임에 틀림없다)는 형태가 같아요. 뒤에 be나 상태가 오면 대개 추측, 행동 동사가 오면 대개 의무로 읽혀요.",
        examples: [
          { en: "She can't be his sister. They look nothing alike.", ko: "그녀가 그의 여동생일 리 없어요. 하나도 안 닮았는걸요.", note: "mustn't be ×" },
          { en: "You mustn't park here.", ko: "여기 주차하면 안 돼요.", note: "mustn't = 금지" },
          { en: "This must be the place.", ko: "여기가 그 장소임에 틀림없어요." },
        ],
        pitfall: "한국어 '~임에 틀림없지 않다'라는 발상으로 **mustn't be**를 만들면 '추측의 부정'이 아니라 '금지'가 돼버려요. 추측의 세계에서 must의 부정 파트너는 **can't**입니다. 시험 단골이자 회화에서도 자주 어긋나는 지점이에요.",
      },
      {
        heading: "might / may / could — '~일지도'의 삼형제",
        pattern: "may(격식) · might(입말) · could(가능성·제안)",
        patternKo: "부정은 might not(아닐지도) vs can't(그럴 리 없어)",
        body:
          "셋 다 '~일지도 모른다'로 거의 바꿔 쓸 수 있어요 — **may**는 가장 격식(문어·뉴스), **might**는 가장 흔한 입말, **could**는 '가능성이 열려 있다'는 결로 제안에도 자주 써요(We could try that new cafe).\n\n" +
          "부정형 주의: **might not / may not**은 가능성의 부정(아닐지도), **can't be**는 '~일 리 없다'는 강한 부정이에요.",
        examples: [
          { en: "I might be a little late tonight.", ko: "오늘 밤 조금 늦을지도 몰라요.", note: "약속 잡기 필수 표현" },
          { en: "It could rain this afternoon. Take an umbrella.", ko: "오후에 비가 올 수도 있어요. 우산 챙기세요." },
          { en: "He may not know about the change yet.", ko: "그는 아직 변경 사항을 모를 수도 있어요.", note: "might not = 아닐지도 (≠ can't)" },
        ],
        tip: "확신이 안 설 때 **I think... maybe...**만 반복하면 표현이 단조로워져요. maybe(부사) 대신 might(조동사)를 문장 안에 심는 습관을 들이세요. Maybe he is busy. → He might be busy. — 같은 뜻인데 후자가 훨씬 영어다운 리듬이에요.",
      },
      {
        heading: "진행형 추측 — must be -ing",
        pattern: "must/might + be + -ing = 지금 ~하는 중인 게 틀림없어/일지도",
        body:
          "지금 벌어지고 있는 일의 추측은 **조동사 + be + -ing**예요 — She must be sleeping. / They might be having dinner.\n\n" +
          "전화를 안 받을 때, 사무실에 불이 켜져 있을 때 — 출현 빈도가 높은 패턴이니 덩어리째 입에 붙이세요. 과거에 대한 추측(must have p.p.)은 B2 가정문 챕터에서 이어서 다룹니다.",
        examples: [
          { en: "He's not answering. He must be driving.", ko: "전화를 안 받네요. 운전 중인 게 틀림없어요." },
          { en: "The kids are quiet. They might be watching a movie.", ko: "애들이 조용하네. 영화 보고 있는 건지도." },
        ],
        etym: "modal(조동사의)은 라틴어 **modus(방식, 정도)**에서 왔어요 — mode(모드), moderate(적당한)와 한 가족이죠. 조동사는 말 그대로 문장의 '모드'를 조절하는 다이얼이에요. 사실 단정 모드에서 추측 모드로, 다이얼을 돌리는 감각으로 쓰세요.",
      },
    ],
  },

  {
    slug: "b1-07-phrasal-verbs-intro",
    level: "B1",
    order: 7,
    title: "원어민 입말의 절반을 되찾기",
    topic: "구동사 입문",
    titleFr: "Phrasal Verbs: An Introduction",
    summary: "postpone 대신 put off, discover 대신 find out — 원어민 입말의 심장인 구동사를 피하지 않고 정면으로 사귀는 법.",
    duration: "약 11분",
    sections: [
      {
        heading: "왜 우리는 구동사를 피해왔나 — 격의 문제",
        pattern: "put off(일상) ↔ postpone(격식) — 게르만계 vs 라틴계",
        patternKo: "구동사 = 영어의 '입말 절반'",
        body:
          "영어 어휘에는 **두 개의 층**이 있어요 — 라틴·프랑스계 어휘(postpone, discover, tolerate)는 격식·문어의 층, 게르만 토박이 동사로 만든 구동사(put off, find out, put up with)는 일상·구어의 층이에요.\n\n" +
          "회화에서 라틴계 단어만 쓰면 문법이 완벽해도 **딱딱하고 책 같은** 인상을 줘요 — 친구에게 '약속을 연기하자'라고 말하는 격이죠. 구동사는 어려운 추가 과제가 아니라 영어의 '입말 절반'을 되찾는 일이에요.",
        table: {
          caption: "같은 뜻, 다른 온도 — 구동사 vs 라틴계 동사",
          headers: ["구동사 (일상)", "라틴계 (격식)", "뜻"],
          rows: [
            ["put off", "postpone", "미루다"],
            ["find out", "discover", "알아내다"],
            ["give up", "abandon / quit", "포기하다"],
            ["go on", "continue", "계속하다"],
            ["turn down", "reject / refuse", "거절하다"],
            ["look into", "investigate", "조사하다"],
            ["put up with", "tolerate", "참다"],
          ],
        },
        examples: [
          { en: "Let's put off the meeting until next week.", ko: "회의를 다음 주로 미루죠.", note: "회화에서는 postpone보다 자연스러워요" },
          { en: "I just found out that she's leaving.", ko: "그녀가 떠난다는 걸 방금 알았어요." },
          { en: "Don't give up!", ko: "포기하지 마!", note: "Don't abandon!이라고는 아무도 안 해요" },
        ],
        etym: "postpone은 라틴어 **post(뒤)+ponere(놓다)** = '뒤에 놓다'예요. 그런데 보세요 — put off도 '놓다(put)+떨어뜨려(off)' = 같은 그림이에요! 라틴계 단어와 구동사는 대개 **같은 발상을 라틴어 부품과 게르만 부품으로 각각 조립한 것**이에요. component(com+ponere)=put together, eject(e+jacere)=throw out — 이 평행 구조를 보기 시작하면 구동사가 외계어에서 번역 가능한 언어로 바뀝니다.",
      },
      {
        heading: "구동사의 구조 — 동사에 방향을 더하다",
        pattern: "동사 + up(완전히) / off(분리) / out(밖으로) / on(계속)",
        patternKo: "불변화사의 그림으로 절반은 추측 가능",
        body:
          "구동사 = **동사 + 불변화사(particle)**. 불변화사는 동사에 **방향과 결**을 더해요 — **up**은 위로·완전히(eat up, use up), **off**는 분리·이탈(take off, turn off), **out**은 밖으로·드러나게(find out, run out), **on**은 계속·접촉(go on, hold on).\n\n" +
          "모든 구동사가 논리적으로 풀리지는 않지만, 핵심 불변화사 대여섯 개의 그림을 잡아두면 처음 보는 구동사도 절반은 추측이 됩니다.",
        examples: [
          { en: "We've run out of milk.", ko: "우유가 다 떨어졌어요.", note: "run out = 달리다 끝까지 → 바닥나다" },
          { en: "I can't figure out this error message.", ko: "이 에러 메시지를 도무지 모르겠어요." },
          { en: "Hold on a second.", ko: "잠깐만 기다려요." },
          { en: "The plane took off on time.", ko: "비행기는 정시에 이륙했어요." },
        ],
        tip: "구동사는 단어가 아니라 **장면**으로 외우세요. take off는 '비행기가 활주로에서 떨어져 나가는 장면', run out은 '모래시계 모래가 다 흘러나간 장면'. 불변화사의 그림과 함께 저장하면 10개 외울 노력으로 30개가 추측됩니다.",
      },
      {
        heading: "분리 가능 vs 불가 — it은 반드시 사이에",
        pattern: "turn off the light = turn the light off · 대명사는 turn it off만 ○",
        patternKo: "look after/run into류는 분리 불가",
        body:
          "**타동사 구동사는 대부분 분리 가능** — turn off the light = turn the light off. 그런데 **목적어가 대명사(it, them, him)면 반드시 사이에** 넣어야 해요: turn it off (○) / turn off it (×).\n\n" +
          "반면 전치사로 끝나는 **분리 불가 구동사**(look after, look into, get over, run into)는 목적어가 항상 뒤로 가요. 새 구동사를 만나면 분리 가능 여부를 함께 확인하는 습관을 들이세요.",
        examples: [
          { en: "Can you turn the music down? / Can you turn it down?", ko: "음악 좀 줄여줄래요?", note: "대명사면 무조건 사이에" },
          { en: "She turned down the offer. = She turned the offer down.", ko: "그녀는 그 제안을 거절했어요." },
          { en: "I ran into an old friend at the station.", ko: "역에서 옛 친구를 우연히 만났어요.", note: "run into = 분리 불가" },
          { en: "Who will look after the kids?", ko: "애들은 누가 돌봐요?", note: "look after = 분리 불가" },
        ],
        pitfall: "**turn off it / put off it / pick up them** — 전부 ×예요. 대명사 목적어는 분리형 구동사의 **사이에만** 들어갑니다(turn it off, put it off, pick them up). 한국어에는 없는 어순 규칙이라 머리로는 알아도 입에서 틀리는 대표 지점 — 'it은 샌드위치 속재료'라고 외우세요.",
      },
      {
        heading: "B1 필수 구동사 스타터 팩",
        pattern: "pick up · drop off · look for · look forward to -ing · set up · work out",
        patternKo: "목적어가 든 문장째로 암기",
        body:
          "출현 빈도 최상위부터: **get up · wake up · go out · come back · pick up**(데리러 가다·줍다) **· drop off · look for · look forward to**(기대하다) **· set up · work out**(운동하다·잘 풀리다).\n\n" +
          "외울 때는 반드시 **목적어가 든 문장째로** 외우세요 — 'pick up = 줍다'가 아니라 'I'll pick you up at seven.'으로요. 구동사는 문장 속에서만 진짜 모습이 보입니다.",
        examples: [
          { en: "I'll pick you up at the airport.", ko: "공항으로 데리러 갈게요." },
          { en: "I'm looking forward to seeing you.", ko: "만나길 기대하고 있어요.", note: "to 뒤에 동명사 — 이메일 마무리 단골" },
          { en: "Things will work out in the end.", ko: "결국엔 다 잘 풀릴 거예요." },
          { en: "Could you set up a meeting for Thursday?", ko: "목요일로 회의 좀 잡아줄래요?" },
        ],
        vsKo: "한국어는 '미루다, 알아내다, 참다'처럼 동사 하나가 통째로 바뀌지만, 영어 구어는 put/get/take/turn 같은 **기본 동사 십여 개에 방향 부품을 갈아 끼우는 조립식**이에요. 어휘를 늘리는 게 아니라 조합을 늘리는 시스템이라는 걸 받아들이면, 구동사가 '외울 게 또 늘었다'가 아니라 '부품 몇 개로 수백 단어를 만드는 치트키'로 보이기 시작해요.",
      },
    ],
  },

  {
    slug: "b1-08-preposition-combos",
    level: "B1",
    order: 8,
    title: "단어는 아는데 전치사에서 막힌다",
    topic: "동사·형용사+전치사",
    titleFr: "Preposition Combinations: depend on / interested in",
    summary: "listen, depend, interested — 단어는 다 아는데 to? on? in?에서 멈칫하는 순간을 위한 챕터예요. 전치사는 논리가 아니라 단짝이라, 덩어리 단위 공략법을 정리합니다.",
    duration: "약 10분",
    sections: [
      {
        heading: "동사+전치사 — 한 단어처럼 굳은 짝",
        pattern: "listen to · wait for · depend on · apologize to 사람 for 잘못",
        patternKo: "동사와 전치사는 세트 — 조사 감각으로 고르면 틀려요",
        body:
          "'음악을 듣다', '버스를 기다리다' — 한국어로는 둘 다 '-를'인데, 영어는 listen **to** music, wait **for** the bus예요. 동사 뒤 전치사는 논리가 아니라 **그 동사가 데리고 다니는 단짝**이라, 동사+전치사를 한 단어처럼 통째로 외우는 게 유일한 정공법이에요.\n\n" +
          "까다로운 대표가 **apologize** — 사과할 '상대'는 to, 사과할 '이유'는 for예요: apologize **to** her **for** being late. 같은 최상위 빈도 세트로 ask **for**(달라고 하다), pay **for**(값을 치르다), belong **to**(~에 속하다), rely/depend **on**(~에 기대다, ~에 달려 있다)이 있어요.",
        examples: [
          { en: "I'm listening to a new podcast these days.", ko: "요즘 새 팟캐스트를 듣고 있어요.", note: "listen music ×" },
          { en: "Everything depends on the test results.", ko: "모든 게 검사 결과에 달려 있어요.", note: "depend of ×" },
          { en: "I apologized to my boss for missing the deadline.", ko: "마감을 놓친 것에 대해 상사에게 사과했어요.", note: "상대는 to, 이유는 for" },
        ],
        pitfall: "거꾸로 **전치사를 붙이면 안 되는 동사**도 있어요 — discuss about it(×) → **discuss** it, marry with him(×) → **marry** him, answer to the question(×) → **answer** the question, enter into the room(×) → **enter** the room. 한국어 '~에 대해 논의하다'의 '-에 대해' 때문에 about이 끼어드는 게 최다 오류 — discuss는 이미 'about'을 품고 있는 동사예요.",
      },
      {
        heading: "형용사+전치사 — interested in이 한 덩어리인 이유",
        pattern: "interested in · good at · afraid of · different from · angry with/at",
        patternKo: "형용사도 전치사 단짝이 정해져 있어요",
        body:
          "형용사도 마찬가지로 짝이 등록되어 있어요 — **interested in, good at, afraid of, proud of, responsible for, similar to, different from**. 전부 형용사+전치사가 한 덩어리예요.\n\n" +
          "**angry**는 대상에 따라 갈려요 — 사람에게는 **with**(angry with him), 상황·행동에는 **at/about**(angry at the decision). 그리고 '~와 결혼한'은 married **to**(married with ×) — 한국어 '-와'의 직역이 가장 자주 어긋나는 자리예요.",
        table: {
          caption: "B1 필수 형용사+전치사",
          headers: ["덩어리", "뜻", "주의"],
          rows: [
            ["interested in", "~에 관심 있는", "about ×"],
            ["good / bad at", "~를 잘하는·못하는", "용도는 for (good for)"],
            ["afraid / scared of", "~를 무서워하는", "to + 명사 ×"],
            ["different from", "~와 다른", "격식 글은 from"],
            ["similar to", "~와 비슷한", "with ×"],
            ["angry with 사람 · at/about 상황", "~에게·~에 화난", "대상 따라 분기"],
            ["proud of / pleased with", "~를 자랑스러워하는 / ~에 만족하는", ""],
            ["married to", "~와 결혼한", "with ×"],
          ],
        },
        examples: [
          { en: "She's really good at explaining difficult things.", ko: "그녀는 어려운 걸 정말 잘 설명해요." },
          { en: "Why are you angry with me? I'm angry about the schedule, not you.", ko: "왜 나한테 화났어? — 화난 건 일정 때문이지 네가 아니야.", note: "사람 with, 상황 about" },
          { en: "Your case is similar to mine.", ko: "네 경우는 내 경우와 비슷해." },
        ],
        vsKo: "한국어 조사 '-에/-와/-를'과 영어 전치사는 1:1 대응이 안 돼요. '-와 다르다'는 different **from**(with가 아니라), '-와 결혼하다'는 married **to**. 조사를 번역하려는 본능을 끄고, **형용사 쪽에서 전치사를 불러오는** 방향으로 외우는 게 정답이에요.",
      },
      {
        heading: "전치사 뒤 동사는 무조건 -ing",
        pattern: "by -ing(~함으로써) · without -ing(~하지 않고) · instead of -ing(~하는 대신)",
        patternKo: "전치사 + to부정사는 존재하지 않아요",
        body:
          "**모든 전치사 뒤의 동사는 -ing** — 예외 없는 대원칙이에요. by analyzing(분석함으로써), without asking(묻지 않고), instead of taking(타는 대신), before/after leaving(떠나기 전에/후에).\n\n" +
          "함정은 **to가 전치사인 표현들** — look forward **to**, be used **to**, object **to**의 to는 부정사의 to가 아니라 전치사라서 뒤에 -ing가 와요. I'm looking forward to **seeing** you(to see ×). 이메일 맺음말 단골이라 꼭 챙기세요.",
        examples: [
          { en: "He improved his English by watching dramas without subtitles.", ko: "그는 자막 없이 드라마를 보면서 영어 실력을 늘렸어요.", note: "by + -ing = 수단" },
          { en: "She left without saying goodbye.", ko: "그녀는 인사도 없이 떠났어요." },
          { en: "I'm looking forward to hearing from you.", ko: "회신 기다리겠습니다.", note: "이 to는 전치사 — to hear ×" },
        ],
        pitfall: "**looking forward to see you / without to ask** — to부정사 자동 반사가 만드는 오류예요. 구별법: to 뒤에 명사를 넣어보세요. look forward to **the weekend**처럼 명사가 자연스럽게 들어가면 그 to는 전치사 → 동사는 -ing. want to, decide to처럼 명사가 못 들어가면 부정사의 to예요.",
      },
      {
        heading: "동사+목적어+전치사 — 3단 골격",
        pattern: "thank A for B · prevent A from -ing · accuse A of -ing · congratulate A on B",
        patternKo: "누구를 + 무엇 때문에 — 골격째로 암기",
        body:
          "B1 라이팅·스피킹에서 점수를 가르는 3단 골격이에요 — **thank** A **for** B(고마움), **blame** A **for** B(탓), **prevent/stop** A **from** -ing(저지), **accuse** A **of** -ing(비난), **congratulate** A **on** B(축하), **remind** A **of** B(상기).\n\n" +
          "구동사(put off, look after)와는 다른 부류예요 — 구동사는 동사+불변화사가 새 뜻을 만들지만(구동사 입문 챕터 참고), 여기는 **동사 본연의 뜻 + 등록된 전치사** 조합이에요. 단어 궁합의 더 큰 그림은 B2 콜로케이션 챕터로 이어집니다.",
        examples: [
          { en: "Thank you so much for inviting us.", ko: "초대해 주셔서 정말 감사해요.", note: "thank A for -ing" },
          { en: "The rain prevented us from going hiking.", ko: "비 때문에 등산을 못 갔어요.", note: "prevent A from -ing" },
          { en: "This song always reminds me of that summer.", ko: "이 노래를 들으면 항상 그 여름이 떠올라요." },
        ],
        tip: "전치사 결합은 문장째 수집이 정석이에요. 단어장에 'depend = 의존하다' 대신 **It depends on the weather.** 한 문장을 적으세요. 그리고 새 동사·형용사를 만나면 사전에서 **뒤에 오는 전치사부터** 확인하는 습관 — 이 습관 하나가 B1과 B2를 가릅니다.",
      },
    ],
  },

  {
    slug: "b1-09-question-craft",
    level: "B1",
    order: 9,
    title: "\"어디인지 아세요?\"의 어순 반전",
    topic: "간접의문·부가의문",
    titleFr: "Question Craft: Indirect Questions & Tags",
    summary: "Do you know where it is?의 어순, aren't I?의 부가의문, So do I의 맞장구, Who broke it?의 주어 의문까지 — 질문을 둘러싼 네 가지 기술을 한 챕터에 모았어요.",
    duration: "약 10분",
    sections: [
      {
        heading: "간접의문 — 질문을 문장 속에 넣으면 어순이 풀린다",
        pattern: "Where is it? → Do you know where it is?",
        patternKo: "간접의문 = 의문사 + 평서문 어순 · do/does/did 소멸",
        body:
          "질문을 Do you know..., Could you tell me... 속에 넣는 순간 **의문문 어순이 평서문으로 돌아가요** — Where **is the station**? → Do you know where **the station is**? 조동사 do/does/did는 아예 사라져요: What time **does it start**? → I don't know what time **it starts**.\n\n" +
          "yes/no 질문은 **if/whether**로 받아요: Is it open? → Do you know **if** it's open? 직설 질문보다 부드러워서 **공손한 질문의 기본형**이기도 해요 — 길 묻기, 전화 문의, 회사 메일이 전부 이 형태가 표준입니다.",
        examples: [
          { en: "Do you know where the nearest ATM is?", ko: "가장 가까운 ATM이 어디 있는지 아세요?", note: "where is the ATM ×" },
          { en: "Could you tell me what time the museum opens?", ko: "박물관이 몇 시에 여는지 알려 주시겠어요?", note: "does가 사라지고 opens로" },
          { en: "I wonder if she got my message.", ko: "그녀가 내 메시지를 받았는지 모르겠네요." },
        ],
        pitfall: "**Do you know where is the station?** — 간접의문 오류의 90%가 이 어순이에요. 의문문을 통째로 옮겨 심는 거죠. 묻는 힘은 문장 맨 앞의 Do you know가 이미 다 쓰고 있으니, 뒤따르는 절은 **평서문으로 쉬어도 됩니다**. 간접화법의 asked where I lived(간접화법 챕터)와 정확히 같은 규칙이에요.",
      },
      {
        heading: "부가의문 — 문장 끝에 붙이는 \"그렇죠?\"",
        pattern: "긍정문 + 부정 tag(..., isn't it?) · 부정문 + 긍정 tag(..., is it?)",
        patternKo: "앞이 긍정이면 꼬리는 부정 — 시소 규칙",
        body:
          "확인·동의를 구하는 한국어 '-죠?'의 자리에 영어는 **부가의문(tag)**을 붙여요. 규칙은 시소 — 본문이 긍정이면 tag는 부정, 본문이 부정이면 tag는 긍정. 동사는 본문 것을 그대로 받아요: be면 isn't it, 일반동사 현재면 don't you, 과거면 didn't she.\n\n" +
          "암기가 필요한 특수 tag 네 가지 — **I'm... → aren't I?**(amn't는 존재하지 않음), **Let's... → shall we?**, **명령문 → will you?**, **Nobody/Nothing 주어 → 긍정 tag + they/it**.",
        table: {
          caption: "특수 부가의문 모음",
          headers: ["본문", "tag", "예"],
          rows: [
            ["I am ...", "aren't I?", "I'm next, aren't I?"],
            ["Let's ...", "shall we?", "Let's start, shall we?"],
            ["명령문", "will you?", "Close the door, will you?"],
            ["Nobody / No one ...", "긍정 tag + they", "Nobody called, did they?"],
            ["Nothing ...", "긍정 tag + it", "Nothing broke, did it?"],
          ],
        },
        examples: [
          { en: "You're coming to the party, aren't you?", ko: "파티에 올 거죠?" },
          { en: "She didn't forget, did she?", ko: "그녀가 잊은 건 아니죠?", note: "부정문 → 긍정 tag" },
          { en: "I'm on the list, aren't I?", ko: "저 명단에 있는 거 맞죠?", note: "amn't I는 없어요" },
        ],
        pitfall: "**He doesn't know, doesn't he?** — 부정문에 부정 tag를 또 붙이는 실수예요. tag는 본문과 반대 극성이 철칙: He doesn't know, **does he?** 그리고 tag의 동사를 본문과 다르게 갈아 끼우는 것도 오류 — You can swim, do you?(×) → can't you?(○). 동사는 복사, 극성만 반전이에요.",
      },
      {
        heading: "짧은 대답과 맞장구 — Yes, I do.에서 So do I.까지",
        pattern: "Yes, I do. / No, I'm not. · 맞장구 So do I.(긍정) · Neither do I.(부정)",
        patternKo: "본동사 대신 조동사로 받기",
        body:
          "영어는 Yes/No 단독 대답이 퉁명스럽게 들릴 수 있어서 **조동사를 재활용한 짧은 대답**이 기본 매너예요 — Do you...?에는 Yes, I **do**., Are you...?에는 No, I'**m not**. 본동사를 반복하지 않고 조동사만 남기는 게 포인트예요.\n\n" +
          "맞장구도 같은 원리 — 긍정문에는 **So + 조동사 + I**(나도 그래), 부정문에는 **Neither + 조동사 + I**(나도 안 그래). 앞 문장이 am이면 So am I, can이면 So can I, 일반동사 과거면 So did I. 캐주얼하게는 Me too / Me neither예요. (이 어순이 도치라는 큰 그림은 B2 도치 챕터에서 이어집니다.)",
        examples: [
          { en: "A: Do you like jazz? — B: Yes, I do. / Not really.", ko: "A: 재즈 좋아해요? — B: 네, 좋아해요. / 그냥 그래요." },
          { en: "A: I can't cook at all. — B: Neither can I.", ko: "A: 난 요리 정말 못해. — B: 나도 못해.", note: "부정 맞장구에 Me too ×" },
          { en: "A: I loved the ending. — B: So did I.", ko: "A: 결말 너무 좋았어. — B: 나도.", note: "과거 일반동사 → did로 받기" },
        ],
        vsKo: "부정 의문에 답할 때 한국어와 영어가 정반대예요. '안 좋아해요?'에 한국어는 '**네**, 안 좋아해요'지만 영어는 **No**, I don't. 한국어 네/아니요는 **상대 말에 대한 동의 여부**를, 영어 Yes/No는 **내 대답 자체의 긍정/부정**을 따라가요. 'Yes 뒤에는 반드시 긍정문, No 뒤에는 반드시 부정문'으로 기억하면 안 헷갈려요.",
      },
      {
        heading: "주어 의문 vs 목적어 의문 — Who broke it?에 did가 없는 이유",
        pattern: "주어를 물으면 그대로(Who broke it?) · 목적어를 물으면 do 소환(Who did they invite?)",
        patternKo: "묻는 자리가 주어면 do/does/did 불필요",
        body:
          "Who가 **주어 자리**를 물을 땐 의문사가 주어 자리에 그대로 앉으니 어순 변화도, do도 필요 없어요 — **Who broke** the vase?(누가 깼어?) / **What happened?**(무슨 일이야?). 반대로 **목적어**를 물을 땐 평소처럼 do/does/did가 소환돼요 — **Who did they invite?**(누구를 초대했어?).\n\n" +
          "판별법은 답을 만들어보는 것 — Who broke it? → **Tom** broke it.(답이 주어 자리 = do 불필요) / Who did they invite? → They invited **Tom**.(답이 목적어 자리 = do 필요).",
        examples: [
          { en: "Who told you that?", ko: "누가 그래요?", note: "주어 질문 — Who did tell ×" },
          { en: "What happened at the meeting?", ko: "회의에서 무슨 일이 있었어요?" },
          { en: "Who did you meet at the conference?", ko: "학회에서 누구를 만났어요?", note: "목적어 질문 — did 필요" },
        ],
        pitfall: "**Who did break the vase?** — 주어를 묻는 질문에 did를 넣는 과잉교정이에요(따져 묻는 강조가 아닌 한 ×). 반대 방향 **Who you invited?**도 같은 빈도로 나와요. 한국어는 '누**가** 깼어?/누구**를** 초대했어?'처럼 조사가 구분해 주지만, 영어는 **do의 유무**가 그 일을 합니다.",
      },
    ],
  },
];
