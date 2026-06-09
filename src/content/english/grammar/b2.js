/**
 * B2 중상급 — 정확함을 넘어 '격'을 만드는 문법
 * 후회의 가정법, 관사의 빈칸, 도치와 분사구문 — 작문·스피킹 점수를 가르는 장치들을 다지는 레벨.
 */
export default [
  {
    slug: "b2-01-conditionals-3-mixed",
    level: "B2",
    order: 1,
    title: "가정문 3형·혼합 — 과거를 후회하는 문법",
    titleFr: "Third & Mixed Conditionals",
    summary: "'그때 알았더라면' — 돌이킬 수 없는 과거를 가정하는 3형과, should have p.p.의 후회 표현을 완성해요.",
    duration: "약 10분",
    sections: [
      {
        heading: "3형 — 이미 끝난 과거를 되돌려보는 상상",
        body:
          "2형이 '지금'과 반대되는 상상이라면, **3형은 '과거'와 반대되는 상상**이에요. 이미 벌어진 일이라 절대 바꿀 수 없는 것을, 머릿속에서만 되감아보는 문법이죠. 그래서 3형의 단골 정서는 **후회와 안도**예요.\n\n" +
          "공식: **If + had p.p., would have p.p.**\n\n" +
          "If I had studied harder, I would have passed the exam. — 실제로는 열심히 안 했고, 그래서 떨어졌어요. 그 과거를 거꾸로 돌려보는 거예요.\n\n" +
          "형태가 길어 보이지만 구조는 2형에서 시계만 과거로 민 것뿐이에요: had → had p.p., would + 원형 → would have p.p.",
        examples: [
          { en: "If I had studied harder, I would have passed the exam.", ko: "더 열심히 공부했더라면 시험에 합격했을 텐데요. (실제: 안 했고, 떨어짐)" },
          { en: "If you had told me earlier, I could have helped you.", ko: "더 일찍 말해줬더라면 도와줄 수 있었을 텐데." },
          { en: "If we hadn't taken a taxi, we would have missed the flight.", ko: "택시를 안 탔더라면 비행기를 놓쳤을 거예요. (안도)" },
        ],
        vsKo: "한국어 '-했더라면 -했을 텐데'가 3형과 거의 완벽하게 대응해요. '-더라면'이 들리면 if절은 had p.p., '-했을 텐데'가 들리면 주절은 would have p.p. — 이 짝만 기억하면 형태는 기계적으로 나옵니다.",
      },
      {
        heading: "should have p.p. — 후회의 일상 버전",
        body:
          "3형 문장은 길어요. 일상 회화에서 후회를 말할 땐 if절을 떼어버린 **조동사 + have p.p.**가 훨씬 자주 쓰여요.\n\n" +
          "**should have p.p.** — ~했어야 했는데 (안 했다): I should have listened to you.\n" +
          "**shouldn't have p.p.** — ~하지 말았어야 했는데 (해버렸다): I shouldn't have said that.\n" +
          "**could have p.p.** — ~할 수도 있었는데 (안 했다/못 했다): We could have won.\n" +
          "**would have p.p.** — (그 상황이었다면) ~했을 텐데: I would have done the same.\n\n" +
          "그리고 B1에서 배운 추측의 조동사도 have p.p.를 만나면 **과거 추측**이 돼요: must have p.p.(~했음에 틀림없다), might have p.p.(~했을지도), can't have p.p.(~했을 리 없다).",
        table: {
          caption: "조동사 + have p.p. 한눈에",
          headers: ["형태", "뜻", "정서"],
          rows: [
            ["should have p.p.", "~했어야 했는데", "후회·질책"],
            ["shouldn't have p.p.", "~하지 말았어야 했는데", "후회"],
            ["could have p.p.", "~할 수도 있었는데", "아쉬움"],
            ["must have p.p.", "~했음에 틀림없다", "과거 추측 (강)"],
            ["might have p.p.", "~했을지도 모른다", "과거 추측 (약)"],
            ["can't have p.p.", "~했을 리 없다", "과거 추측 부정"],
          ],
        },
        examples: [
          { en: "I should have brought an umbrella.", ko: "우산을 가져왔어야 했는데." },
          { en: "You shouldn't have spent so much money.", ko: "돈을 그렇게 많이 쓰지 말았어야지." },
          { en: "He must have forgotten about the meeting.", ko: "그는 회의를 깜빡한 게 틀림없어요." },
          { en: "She can't have said that. It's not like her.", ko: "그녀가 그런 말을 했을 리 없어요. 그녀답지 않은걸요." },
        ],
        pitfall: "**would have went / should have took** — have 뒤는 반드시 **과거분사**예요(would have gone, should have taken). 그리고 원어민이 발음을 흘려서 should've가 should of처럼 들리는데, **should of라고 쓰는 건 원어민조차 자주 하는 명백한 철자 오류**입니다. 여러분은 should have / should've로만 쓰세요.",
      },
      {
        heading: "혼합 가정문 — 과거의 원인, 현재의 결과",
        body:
          "현실의 후회는 시간을 가로질러요. '그때 안 샀더라면(과거), 지금 부자일 텐데(현재)' — 이렇게 **if절과 주절의 시간대가 다른** 것이 혼합 가정문이에요.\n\n" +
          "**과거 가정 → 현재 결과**: If + had p.p., **would + 원형**\n" +
          "If I had taken that job, I **would be** in New York now.\n\n" +
          "**현재 가정 → 과거 결과**: If + 과거, **would have p.p.**\n" +
          "If he weren't so careless, he **wouldn't have lost** his passport.\n\n" +
          "외울 건 없어요 — **각 절의 시간을 따로 묻고, 그 시간에 맞는 형태를 조립**하면 끝이에요. 과거 이야기면 had p.p./would have p.p., 현재 이야기면 과거형/would + 원형. now, today 같은 시간 부사가 큰 힌트가 됩니다.",
        examples: [
          { en: "If I had saved money in my twenties, I would be much richer now.", ko: "20대에 돈을 모았더라면 지금 훨씬 부자일 텐데요.", note: "과거 원인 → 현재 결과" },
          { en: "If she weren't afraid of flying, she would have come with us.", ko: "그녀가 비행공포증만 없다면 우리와 같이 왔을 거예요.", note: "현재 성격 → 과거 결과" },
        ],
        tip: "혼합형 판별의 치트키는 **시간 부사**예요. 주절에 now/today가 보이면 주절은 would + 원형(현재), if절에 yesterday/last year가 보이면 if절은 had p.p.(과거). 공식 암기보다 시간표 맞추기로 접근하세요.",
      },
      {
        heading: "wish와 If only — 가정법의 사촌",
        body:
          "후회·아쉬움은 wish로도 말해요. 시제 규칙이 가정문과 평행이라 같이 묶어두면 좋아요.\n\n" +
          "**wish + 과거형** — 현재에 대한 아쉬움: I wish I knew the answer.(지금 모르니까)\n" +
          "**wish + had p.p.** — 과거에 대한 후회: I wish I had studied abroad.(안 갔으니까)\n\n" +
          "**If only**는 wish의 강조 버전이에요 — '~하기만 했다면!': If only I had known!\n\n" +
          "2형 가정문처럼 be동사는 were를 써요: I wish I were taller.",
        examples: [
          { en: "I wish I had more time.", ko: "시간이 더 있으면 좋을 텐데요. (현재)" },
          { en: "I wish I had taken more photos that day.", ko: "그날 사진을 더 찍어둘 걸 그랬어요. (과거 후회)" },
          { en: "If only I had listened to your advice!", ko: "네 조언을 듣기만 했어도!" },
        ],
        pitfall: "'~하면 좋겠다'를 직역해 **I wish I can / I wish I will**이라고 하면 안 돼요. wish 뒤는 현실과의 거리 표시로 **한 칸 물러난 시제**(과거형·had p.p.)가 필수입니다. 실현 가능한 희망은 wish가 아니라 **I hope + 현재/미래**(I hope you pass!)로 — wish는 비현실, hope는 현실 담당이에요.",
      },
    ],
  },

  {
    slug: "b2-02-perfect-continuous",
    level: "B2",
    order: 2,
    title: "완료진행 시제 — '얼마나 오래 계속'의 프레임",
    titleFr: "Perfect Continuous Tenses",
    summary: "have been -ing는 '지금까지 얼마나 오래 하고 있는가'를 묻고 답하는 전용 프레임이에요. How long과 함께 세트로 익혀요.",
    duration: "약 9분",
    sections: [
      {
        heading: "have been -ing의 정체 — 기간을 강조하는 현재완료",
        body:
          "현재완료진행(have been -ing)은 이름이 무섭지만 하는 일은 하나예요. **과거에 시작해 지금까지 계속되는 행동의 '지속'을 강조**하는 것.\n\n" +
          "I have been studying English for ten years. — 10년 전 시작했고, 지금도 진행 중이고, 그 **기간**에 스포트라이트가 있어요.\n\n" +
          "그래서 단짝 질문이 **How long...?**이에요. How long have you been waiting? / How long have you been working here? — '얼마나 오래'를 묻고 답하는 거의 모든 문장이 이 시제의 영역입니다. **for/since**와의 결합률도 최상위예요.",
        examples: [
          { en: "How long have you been learning English?", ko: "영어 배운 지 얼마나 됐어요?", note: "'~한 지 얼마나'의 표준 질문" },
          { en: "I have been working at this company for five years.", ko: "이 회사에서 일한 지 5년 됐어요." },
          { en: "It has been raining since last night.", ko: "어젯밤부터 계속 비가 오고 있어요." },
          { en: "We have been waiting for over an hour!", ko: "한 시간 넘게 기다리고 있다고요!", note: "지속 강조 = 불만 표현에도 제격" },
        ],
        vsKo: "한국어 '**-한 지 ~ 됐다**', '**-고 있어요(예전부터 쭉)**'가 이 시제의 자리예요. '일한 지 5년 됐어요'를 영어로 옮길 때 I work(×), I am working(애매), I have been working(○) — 한국어에는 이 전용 형태가 없어서 단순현재로 새기 쉬운 지점이니, '-한 지'가 들리면 have been -ing를 자동 발사하도록 연결해두세요.",
      },
      {
        heading: "현재완료 단순 vs 진행 — 결과냐 과정이냐",
        body:
          "I have read the book.과 I have been reading the book.은 둘 다 맞는 문장이지만 말하는 바가 달라요.\n\n" +
          "**have p.p. (단순)** — **결과·완료**에 초점: I have read the book. (다 읽었어요 — 내용 물어봐도 돼요)\n" +
          "**have been -ing (진행)** — **과정·지속**에 초점: I have been reading the book. (요즘 계속 읽는 중이에요 — 아직 안 끝남)\n\n" +
          "그래서 **횟수·완성량은 단순형**(I have written three emails), **소요 시간은 진행형**(I have been writing emails all morning)이 어울려요.\n\n" +
          "주의: know, like, believe, own 같은 **상태동사는 진행형 불가** — 아무리 오래 알았어도 I have been knowing(×)이 아니라 I have known her for ten years(○)예요.",
        table: {
          caption: "단순 완료 vs 완료진행",
          headers: ["", "have p.p.", "have been -ing"],
          rows: [
            ["초점", "결과·완료", "과정·지속"],
            ["어울리는 정보", "횟수·완성량 (three times)", "기간 (for two hours)"],
            ["예", "I have painted the wall. (다 칠함)", "I have been painting the wall. (칠하는 중)"],
            ["상태동사 (know, like)", "○ I have known her.", "× I have been knowing her."],
          ],
        },
        examples: [
          { en: "I have written three reports this week.", ko: "이번 주에 보고서를 세 개 썼어요. (완성 개수 → 단순)" },
          { en: "I have been writing this report since Monday.", ko: "월요일부터 이 보고서를 계속 쓰고 있어요. (기간 → 진행)" },
          { en: "I have known him since college.", ko: "대학 때부터 그를 알고 지냈어요.", note: "know는 상태동사 — 진행형 ×" },
        ],
        pitfall: "**I have been knowing / I am loving(일상 동사로서)** — 상태동사의 진행형은 한국 학습자가 '지속이니까 -ing겠지'라고 과잉 적용하는 함정이에요. know, believe, own, belong, seem은 의미 자체에 지속이 내장돼 있어 진행형이 필요 없습니다. (McDonald's의 I'm lovin' it은 규칙을 일부러 비튼 광고 문구예요.)",
      },
      {
        heading: "흔적 읽기 — 방금까지 뭘 하고 있었길래",
        body:
          "완료진행의 두 번째 얼굴: **방금까지 계속된 행동이 현재에 남긴 흔적**을 읽을 때 써요. 행동은 막 끝났을 수 있지만, 증거가 눈앞에 있는 상황이에요.\n\n" +
          "Your eyes are red. **Have you been crying?** (눈이 빨개 — 방금까지 울고 있었구나)\n" +
          "The ground is wet. **It has been raining.** (땅이 젖었네 — 비가 계속 왔었구나)\n\n" +
          "이 용법은 추리의 말투예요. 셜록 홈즈가 '당신, 방금까지 ~하고 있었군요'라고 말할 때의 그 문법 — 현재의 단서에서 직전의 지속 행동을 읽어내는 거죠. 회화에 깔리면 굉장히 자연스러운 중상급 티가 납니다.",
        examples: [
          { en: "You're out of breath. Have you been running?", ko: "숨이 차네요. 뛰어왔어요?" },
          { en: "Sorry about the mess — I've been packing all day.", ko: "어질러져서 미안해요. 하루 종일 짐 싸는 중이었거든요." },
          { en: "Someone has been eating my snacks!", ko: "누가 내 과자를 계속 먹어왔어!", note: "다 먹었으면 has eaten — 야금야금 흔적은 has been eating" },
        ],
        tip: "단서 → 추리의 공식으로 외우세요: **현재의 증거 한 문장 + have been -ing 한 문장.** 'Your hands are dirty. You've been fixing the bike again.' 이 2문장 패턴을 몇 개 만들어보면 용법이 몸에 붙어요.",
      },
      {
        heading: "과거완료진행 — 기준점을 과거로 옮기면",
        body:
          "현재완료진행의 기준점은 '지금'이에요. 이 기준점을 과거의 한 시점으로 옮기면 **had been -ing(과거완료진행)**가 돼요.\n\n" +
          "When I arrived, they **had been waiting** for an hour. — 내가 도착한 그 시점까지, 그들이 한 시간째 기다리고 있었던 거예요.\n\n" +
          "구조는 똑같아요: '기준 시점까지 얼마나 오래 계속됐나'. 기준이 지금이면 have been -ing, 과거의 한 장면이면 had been -ing. 스토리텔링(과거 이야기)에서 배경 설명으로 자주 깔리는 시제입니다.",
        examples: [
          { en: "When I got there, she had been waiting for two hours.", ko: "내가 도착했을 때, 그녀는 두 시간째 기다리고 있었어요." },
          { en: "He was tired because he had been driving all night.", ko: "밤새 운전한 터라 그는 지쳐 있었어요." },
        ],
      },
    ],
  },

  {
    slug: "b2-03-articles-advanced",
    level: "B2",
    order: 3,
    title: "관사 심화 — 무관사·총칭·고유명사",
    titleFr: "Advanced Articles: Zero Article & Generic Use",
    summary: "go to school엔 왜 the가 없을까? a/the를 넘어 '관사 없음'이라는 제3의 선택지까지 — 한국인 영원한 숙제 2탄이에요.",
    duration: "약 11분",
    sections: [
      {
        heading: "무관사 — '관사 없음'도 하나의 선택이에요",
        body:
          "a와 the만 고민하던 단계를 넘어, B2에서는 **관사를 안 쓰는 것(무관사, zero article)도 의미가 있는 선택**이라는 걸 알아야 해요.\n\n" +
          "대표 케이스가 **go to school**이에요. school에 the가 없는 이유는, 여기서 school이 '그 건물'이 아니라 **'수업·학업이라는 기능'**을 가리키기 때문이에요. 학생이 공부하러 가면 go to school(무관사), 학부모가 상담하러 그 건물에 가면 go to the school(정관사).\n\n" +
          "같은 원리의 단어들: **bed**(잠), **church**(예배), **prison**(복역), **hospital**(입원·치료, 영국식), **work**(일), **home**.\n\n" +
          "**go to bed** = 자러 가다 / **go to the bed** = 그 침대 쪽으로 걸어가다 — 관사 하나로 뜻이 갈라져요.",
        examples: [
          { en: "My daughter goes to school at eight.", ko: "딸은 8시에 학교에 가요. (수업하러 — 기능)" },
          { en: "I went to the school to meet her teacher.", ko: "담임 선생님을 만나러 학교에 갔어요. (그 건물 — 장소)" },
          { en: "He's in hospital. (영국) / He's in the hospital. (미국)", ko: "그는 입원 중이에요.", note: "미국 영어는 hospital엔 the를 붙이는 편" },
          { en: "I'm going to bed.", ko: "자러 갈게요.", note: "the bed라고 하면 '그 침대로 간다'는 이동" },
        ],
        vsKo: "한국어에는 관사가 아예 없으니 '학교에 가다'를 옮길 때 the를 넣을지 말지 고민할 근거 자체가 없어요. 기준을 새로 심으세요 — **기능·활동이면 무관사, 특정 건물·물건이면 the.** '무엇 하러 가는가?'를 물었을 때 답이 활동(공부, 잠, 예배)이면 관사를 떼는 거예요.",
      },
      {
        heading: "총칭 — '~라는 것 전체'를 말하는 세 가지 방법",
        body:
          "'고양이는 독립적이다'처럼 **종 전체**를 말하는 방법이 영어엔 셋 있어요.\n\n" +
          "**① 무관사 복수 (Cats are independent.)** — 가장 자연스러운 일상 표현. 회화의 기본값.\n" +
          "**② the + 단수 (The cat is independent.)** — '고양이라는 종'을 학술적으로 대상화. 백과사전·논문 말투.\n" +
          "**③ a + 단수 (A cat is independent.)** — '아무 고양이나 한 마리 잡아도' — 개체 대표형.\n\n" +
          "B2에서 꼭 잡을 것은 ①이에요. 한국어 '나는 사과를 좋아해요'를 직역하면 I like apple(×)이 되기 쉬운데, 종류 전체를 좋아하는 거니까 **I like apples** — 무관사 **복수**가 정답이에요. 셀 수 없는 명사는 무관사 단수로: I like music. / Health is more important than money.",
        examples: [
          { en: "I like apples.", ko: "저는 사과를 좋아해요.", note: "I like apple × — 총칭은 무관사 복수" },
          { en: "Dogs are loyal animals.", ko: "개는 충성스러운 동물이에요." },
          { en: "The smartphone changed how we live.", ko: "스마트폰(이라는 발명품)은 우리의 삶을 바꿨어요.", note: "발명품·종은 the + 단수도 가능" },
          { en: "Life is short.", ko: "인생은 짧아요.", note: "추상명사 총칭 = 무관사" },
        ],
        pitfall: "**I like dog.** — 무관사 '단수'는 총칭이 아니라 **물질(고기)**로 읽힐 수 있어요. I like dog는 '개고기를 좋아한다'로 들립니다. chicken(닭고기)/a chicken(닭 한 마리)의 차이와 같은 원리예요. 셀 수 있는 명사의 총칭은 반드시 **복수**로 — I like dogs.",
      },
      {
        heading: "고유명사와 the — 붙는 이름, 안 붙는 이름",
        body:
          "고유명사는 원칙적으로 무관사예요(Korea, Seoul, Mount Halla, Lake Tahoe). 그런데 **the가 붙는 부류**가 정해져 있어요.\n\n" +
          "**the가 붙는 것**: 복수형 국가·군도(**the** Philippines, **the** Netherlands), 강·바다·해협(**the** Han River, **the** Pacific), 산맥(**the** Alps), 사막(**the** Sahara), 호텔·박물관·극장(**the** Hilton, **the** Louvre), 신문(**the** New York Times), 'of'가 든 이름(**the** University of Oxford)\n\n" +
          "**무관사인 것**: 대부분의 국가·도시(Korea, Paris), 단일 산(Mount Everest), 호수(Lake Baikal), 거리(Gangnam-daero), 공항·역(Incheon Airport), 공원(Central Park), 사람 이름\n\n" +
          "패턴이 보이죠? **여럿이 모여 이루어진 것(군도·산맥·복수국가)과 흐르는 물줄기·기관명**에는 the, **점 하나로 찍히는 것(도시·단일 산·호수)**은 무관사 — 거칠지만 강력한 경향이에요.",
        table: {
          caption: "고유명사 관사 치트시트",
          headers: ["분류", "관사", "예"],
          rows: [
            ["국가·도시 (대부분)", "무관사", "Korea, Japan, Seoul"],
            ["복수형 국가·군도", "the", "the Philippines, the Maldives"],
            ["강·바다·해양", "the", "the Han River, the Pacific Ocean"],
            ["산맥 / 단일 산", "the / 무관사", "the Himalayas / Mount Everest"],
            ["호수", "무관사", "Lake Baikal"],
            ["호텔·박물관·신문", "the", "the Hyatt, the British Museum, the Times"],
            ["공항·역·거리·공원", "무관사", "Incheon Airport, Central Park"],
          ],
        },
        examples: [
          { en: "The Han River runs through Seoul.", ko: "한강은 서울을 가로질러 흘러요.", note: "강에는 the" },
          { en: "She studied at the University of Tokyo.", ko: "그녀는 도쿄대학에서 공부했어요.", note: "of형 이름에는 the" },
          { en: "We climbed Mount Halla last fall.", ko: "지난가을에 한라산에 올랐어요.", note: "단일 산은 무관사" },
        ],
        tip: "지도를 펴고 외우지 말고, **글에서 만날 때마다 분류함에 넣는** 방식이 오래가요. 뉴스에서 the Alps를 보면 '산맥함', Lake Geneva를 보면 '호수함'. 분류함 일곱 개(위 표)면 고유명사 관사의 90%가 커버됩니다.",
      },
      {
        heading: "한 단어, 세 가지 관사 — 의미가 바뀌는 순간들",
        body:
          "마무리로, 같은 명사에 무관사/a/the를 갈아 끼우면 의미가 어떻게 변하는지 모아볼게요. 관사가 '장식'이 아니라 **의미의 스위치**라는 걸 체감하는 게 이 챕터의 목표예요.\n\n" +
          "**dinner**: have dinner(저녁 먹다 — 일상 식사는 무관사) / a dinner(만찬 행사 하나) / the dinner(아까 말한 그 저녁)\n" +
          "**school**: go to school(공부하러) / a school(학교 한 곳) / the school(그 학교 건물)\n" +
          "**by + 교통수단은 무관사**: by bus, by subway, by plane. 단, 특정한 차를 타면 in my car, on the 8 o'clock train.",
        examples: [
          { en: "Let's have dinner together. — The dinner was amazing.", ko: "같이 저녁 먹어요. — (먹고 나서) 그 저녁 정말 훌륭했어요.", note: "식사 자체는 무관사, 되짚으면 the" },
          { en: "I go to work by subway.", ko: "지하철로 출근해요.", note: "by + 교통수단 = 무관사" },
          { en: "She gave a dinner for the new ambassador.", ko: "그녀는 신임 대사를 위한 만찬을 열었어요.", note: "행사로서의 식사엔 a" },
        ],
        etym: "article(관사)은 라틴어 **articulus(작은 관절)**에서 왔어요 — 영어 articulate(또렷이 말하다), joint와 통하는 그림이죠. 관사는 문장의 작은 관절이라서, 빠져도 뼈대는 서 있지만 움직임이 어색해져요. 원어민이 관사 오류에 민감한 이유 — 관절이 삐걱대는 게 바로 느껴지기 때문이에요.",
      },
    ],
  },

  {
    slug: "b2-04-inversion-emphasis",
    level: "B2",
    order: 4,
    title: "도치와 강조 — Never have I... 의 위력",
    titleFr: "Inversion & Emphasis",
    summary: "Not only..., Never have I... — 어순을 뒤집어 문장에 스포트라이트를 켜는 격식 장치. 작문·스피킹 고득점의 단골 무기예요.",
    duration: "약 10분",
    sections: [
      {
        heading: "도치란 — 어순을 흔들어 시선을 끄는 장치",
        body:
          "영어는 어순(주어+동사)이 생명인 언어죠. 그래서 역설적으로, **어순을 일부러 뒤집으면 강한 스포트라이트 효과**가 나요. 이게 도치(inversion)예요.\n\n" +
          "I have never seen such a beautiful sunset. (평범)\n" +
          "**Never have I seen** such a beautiful sunset. (문학적·극적 — '이런 노을은 처음이야!')\n\n" +
          "구조는 의문문과 똑같아요. **부정·제한의 부사(구)를 문장 맨 앞으로 빼고, 그 뒤를 의문문 어순(조동사+주어+동사)으로** 만드는 거예요. Never have I seen... = Have I seen...?의 어순에 Never를 얹은 모양이죠.\n\n" +
          "일상 대화에서 남발하면 연극 톤이 되지만, **에세이·프레젠테이션·시험 라이팅**에서는 한두 번의 도치가 글의 격을 확실히 올려줍니다.",
        examples: [
          { en: "Never have I seen such a mess.", ko: "이런 난장판은 본 적이 없어요." },
          { en: "Rarely do we get a second chance like this.", ko: "이런 두 번째 기회는 좀처럼 오지 않죠." },
          { en: "Little did he know that everything was about to change.", ko: "모든 것이 바뀌기 직전이라는 걸 그는 까맣게 몰랐다.", note: "소설·내레이션의 단골 문형" },
        ],
        tip: "도치를 만들 때는 2단계로: ① 부정어를 맨 앞으로, ② 나머지를 **의문문으로 바꾼다고 생각**하세요. 일반동사 문장이면 do/does/did가 소환돼요 — Little did he know(그는 몰랐다)에서 did가 나타난 이유입니다.",
      },
      {
        heading: "Not only... but also — 도치의 에이스",
        body:
          "격식 작문에서 가장 활용도 높은 도치가 **Not only A but also B**예요.\n\n" +
          "기본형: She is not only smart but also kind.\n" +
          "도치형: **Not only is she smart, but she is also kind.** — Not only가 문두로 나오면 그 절은 의문문 어순!\n\n" +
          "비슷한 부류의 문두 트리거들:\n" +
          "**No sooner had I arrived than** it started to rain. (도착하자마자 비가 왔다)\n" +
          "**Hardly had we started when** the power went out. (시작하자마자 정전됐다)\n" +
          "**Under no circumstances should you** share this password. (어떤 경우에도 공유하지 마세요)\n" +
          "**Only then did I realize** my mistake. (그제야 깨달았다)",
        table: {
          caption: "문두에 오면 도치를 부르는 트리거",
          headers: ["트리거", "뜻", "예"],
          rows: [
            ["Never / Rarely / Seldom", "결코·좀처럼 ~않다", "Never have I felt so alive."],
            ["Not only", "~일 뿐 아니라", "Not only did he apologize, but he also paid for the damage."],
            ["No sooner... than", "~하자마자", "No sooner had she left than he called."],
            ["Hardly... when", "~하자마자", "Hardly had I sat down when the phone rang."],
            ["Under no circumstances", "어떤 경우에도 ~않다", "Under no circumstances should you open this door."],
            ["Only + 부사구", "오직 ~할 때에야", "Only later did we learn the truth."],
          ],
        },
        examples: [
          { en: "Not only does this plan save money, but it also saves time.", ko: "이 계획은 돈을 아낄 뿐 아니라 시간도 아껴줍니다.", note: "프레젠테이션 고득점 문형" },
          { en: "Only after the meeting did I understand the problem.", ko: "회의가 끝난 뒤에야 문제를 이해했어요." },
        ],
        pitfall: "**Not only he is smart...** — 도치 트리거를 문두에 놓고 어순을 평서문 그대로 두는 게 최다 오류예요. Not only가 앞에 나온 순간 그 절은 **반드시 의문문 어순**(Not only is he...)이어야 합니다. 거꾸로, 트리거가 문중에 있으면(He is not only...) 도치하지 않아요 — 위치가 어순을 결정해요.",
      },
      {
        heading: "So / Neither — 회화 속의 미니 도치",
        body:
          "사실 여러분은 도치를 이미 쓰고 있어요. 맞장구의 **So do I.(나도) / Neither do I.(나도 안 그래)**가 바로 도치거든요.\n\n" +
          "A: I love this song. — B: **So do I.** (긍정 맞장구)\n" +
          "A: I can't swim. — B: **Neither can I.** (부정 맞장구)\n\n" +
          "동사를 앞 문장에 맞추는 게 포인트예요: am이면 So am I, can이면 So can I, 일반동사 과거면 So did I.\n\n" +
          "확장형으로 **so + 형용사 도치**도 있어요: **So beautiful was the view that** we stayed another hour. (경치가 너무 아름다워서 한 시간 더 머물렀다) — so... that 구문의 격식 변형이에요.",
        examples: [
          { en: "A: I'm exhausted. — B: So am I.", ko: "A: 너무 피곤해. — B: 나도." },
          { en: "A: I didn't like the ending. — B: Neither did I.", ko: "A: 결말이 별로였어. — B: 나도 별로였어." },
          { en: "So strong was the wind that several trees fell.", ko: "바람이 어찌나 셌는지 나무가 몇 그루나 쓰러졌어요." },
        ],
        vsKo: "한국어 '나도'는 긍정·부정을 가리지 않지만, 영어는 **긍정 맞장구 So ~ I / 부정 맞장구 Neither ~ I**로 갈라져요. 'Me too'만 쓰던 단계에서 So do I / Neither do I로 넘어가면 맞장구의 해상도가 올라갑니다. (부정문에 Me too라고 하면 어색해요 — Me neither가 짝이에요.)",
      },
      {
        heading: "It is... that 강조 구문 — 스포트라이트 옮기기",
        body:
          "도치와 함께 알아둘 강조 장치가 **분열문(cleft sentence)**, 이른바 It is... that 강조 구문이에요. 문장의 한 조각을 It is와 that 사이에 끼워 스포트라이트를 쏘는 거예요.\n\n" +
          "Mina broke the vase yesterday. 에서:\n" +
          "**It was Mina that(who) broke the vase.** — 깬 사람은 (다른 누구도 아닌) 미나\n" +
          "**It was yesterday that** Mina broke the vase. — 깬 것은 (다른 날 아닌) 어제\n\n" +
          "**What I need is...** 형태(의사분열문)도 세트로: What I need is a long vacation. (내게 필요한 건 긴 휴가다) — 회화에서도 흔히 쓰이는, 자연스러운 강조법이에요.",
        examples: [
          { en: "It was the design that impressed me most.", ko: "가장 인상 깊었던 건 바로 디자인이었어요." },
          { en: "It wasn't me who left the door open!", ko: "문 열어둔 거 내가 아니야!" },
          { en: "What matters most is consistency.", ko: "가장 중요한 것은 꾸준함이에요." },
        ],
        tip: "스피킹 시험에서 의견을 말할 때 **What I find interesting is... / It is X that...** 한 문장을 심어보세요. 단조로운 'I think' 행렬을 끊어주는 것만으로 전달력 점수가 달라집니다.",
      },
    ],
  },

  {
    slug: "b2-05-participle-clauses",
    level: "B2",
    order: 5,
    title: "분사구문 — 문장을 압축하는 격식의 기술",
    titleFr: "Participle Clauses",
    summary: "Having finished the report, ... — 접속사와 주어를 떼어내 문장을 압축하는 문어의 기술과, 악명 높은 현수분사 함정을 다뤄요.",
    duration: "약 10분",
    sections: [
      {
        heading: "분사구문의 원리 — 접속사+주어를 떼어내는 압축",
        body:
          "분사구문은 새 문법이 아니라 **압축 기술**이에요. 두 절의 주어가 같을 때, 부사절의 '접속사+주어'를 지우고 동사를 분사(-ing)로 바꾸는 거예요.\n\n" +
          "**When I opened** the box, I found a letter.\n" +
          "→ **Opening** the box, I found a letter. (상자를 열었더니 편지가 있었다)\n\n" +
          "지워진 접속사의 의미(~할 때, ~해서, ~하면서)는 문맥이 채워요. 그래서 분사구문은 의미가 살짝 열려 있는, **간결함과 모호함을 맞바꾼** 문체예요.\n\n" +
          "주 서식지는 **격식 문어** — 논문, 보고서, 뉴스, 소설이에요. 회화에서는 -ing 분사구문보다 접속사를 살려 말하는 게 보통이지만, 듣고 읽는 양은 많으니 해석 속도를 위해서라도 꼭 잡아야 해요.",
        examples: [
          { en: "Feeling tired, I went to bed early.", ko: "피곤해서 일찍 잤어요. (= Because I felt tired)" },
          { en: "Walking along the beach, we talked about the future.", ko: "해변을 걸으면서 우리는 미래에 대해 이야기했어요. (= While we walked)" },
          { en: "Arriving at the station, she realized she had left her phone at home.", ko: "역에 도착하고서야 폰을 집에 두고 온 걸 깨달았어요. (= When she arrived)" },
        ],
        vsKo: "한국어 연결어미 '-하고, -하며, -해서'가 하는 일과 똑같아요. '상자를 열고, 편지를 발견했다'에서 '-고'가 접속사 없이 두 동작을 잇듯, 영어 분사구문도 접속사 없이 절을 이어요. 개념은 이미 알고 있는 셈 — 새로 배울 것은 '주어가 같아야 지울 수 있다'는 조건 하나예요.",
      },
      {
        heading: "세 가지 형태 — -ing / p.p. / Having p.p.",
        body:
          "**① 현재분사 (-ing)** — 주어가 그 동작을 **하는** 능동 관계: Seeing the police, he ran away. (경찰을 '보고')\n\n" +
          "**② 과거분사 (p.p.)** — 주어가 그 동작을 **당하는** 수동 관계: **Seen** from above, the island looks like a heart. (위에서 '보여질' 때 = 위에서 보면) — 원래 Being seen에서 Being이 생략된 형태예요.\n\n" +
          "**③ Having p.p.** — 주절보다 **분명히 먼저** 일어난 일: **Having finished** the report, she went home. (보고서를 다 끝낸 **뒤에** 퇴근) — 순서를 또렷이 못 박고 싶을 때 써요.\n\n" +
          "부정은 분사 앞에 not: **Not knowing** what to say, I stayed silent.",
        table: {
          caption: "분사구문 3형태",
          headers: ["형태", "관계", "예"],
          rows: [
            ["-ing", "능동·동시", "Smiling brightly, she waved at us."],
            ["p.p.", "수동", "Written in 1953, the novel still feels modern."],
            ["Having p.p.", "능동·완료(먼저 일어남)", "Having lived in Paris, he speaks French well."],
            ["Not + 분사", "부정", "Not wanting to wake the baby, we whispered."],
          ],
        },
        examples: [
          { en: "Having finished the report, she finally went home.", ko: "보고서를 끝낸 뒤, 그녀는 마침내 퇴근했어요." },
          { en: "Built in the 1970s, the bridge needs major repairs.", ko: "1970년대에 지어진 그 다리는 대대적인 보수가 필요해요.", note: "다리는 '지어진' 쪽 — 수동이라 p.p." },
          { en: "Not knowing anyone at the party, I left early.", ko: "파티에 아는 사람이 없어서 일찍 나왔어요." },
        ],
        pitfall: "능동/수동 선택 오류 — **Interesting in history, I...**(×) vs **Interested in history, I...**(○). 내가 흥미를 '느끼는'(주어지는) 쪽이니 p.p.예요. surprised/excited/bored 등 감정 분사에서 특히 자주 어긋나요. 주어가 '하는' 쪽이면 -ing, '당하는·느끼는' 쪽이면 p.p. — 분사구문에서도 이 원칙은 그대로입니다.",
      },
      {
        heading: "현수분사 — 분사구문 최대의 함정",
        body:
          "분사구문의 대원칙: **분사의 의미상 주어 = 주절의 주어.** 이게 깨진 문장이 악명 높은 **현수분사(dangling participle)**예요.\n\n" +
          "**Walking down the street, the building caught my eye.** (×)\n" +
          "— 문법대로 읽으면 '건물이 길을 걸어가다가' 내 눈을 사로잡은 게 돼요. 걸은 건 나인데 주절의 주어는 the building이라 분사가 허공에 매달린(dangling) 거죠.\n\n" +
          "고치는 법 두 가지: ① 주절 주어를 분사의 주인으로 교체 — Walking down the street, **I noticed** the building. ② 접속사와 주어를 복원 — **As I was walking** down the street, the building caught my eye.\n\n" +
          "원어민도 흔히 저지르는 실수라 영문 글쓰기 강의의 단골 경고 대상이에요. 분사구문을 쓸 때마다 '이 -ing의 주인이 주절 주어 맞나?'를 한 번 자문하는 습관이 보험입니다.",
        examples: [
          { en: "Walking down the street, I noticed a new cafe.", ko: "길을 걷다가 새 카페를 발견했어요.", note: "걷는 주체 = I — 올바른 분사구문" },
          { en: "Having reviewed your application, we are pleased to offer you the position.", ko: "지원서를 검토한 결과, 귀하께 합격을 알려드리게 되어 기쁩니다.", note: "검토한 주체 = we ○" },
          { en: "After reading the contract, the terms seemed unfair. (×) → After reading the contract, I felt the terms were unfair. (○)", ko: "계약서를 읽어보니 조건이 불공정해 보였어요.", note: "읽은 건 '계약 조건'이 아니라 '나'" },
        ],
        tip: "이메일·에세이를 퇴고할 때 -ing로 시작하는 문장만 골라 **콤마 바로 뒤의 주어에 동그라미**를 쳐보세요. 그 주어가 -ing의 주인이 아니면 현수분사예요. 30초짜리 점검으로 글의 신뢰도가 지켜집니다.",
      },
      {
        heading: "굳은 분사 표현 — 외워서 바로 쓰는 세트",
        body:
          "주어 일치 규칙을 면제받은, **관용구로 굳은 분사 표현**들이 있어요. 문장 전체에 걸리는 부사처럼 쓰이는 것들이라 그대로 외워서 쓰면 돼요.\n\n" +
          "**Generally speaking,** (일반적으로 말해) / **Strictly speaking,** (엄밀히 말하면) / **Judging from ~,** (~로 판단하건대) / **Considering ~,** (~을 고려하면) / **Speaking of ~,** (~ 얘기가 나와서 말인데) / **Given ~,** (~을 감안하면)\n\n" +
          "이 표현들은 격식 작문의 문단 도입부에서도, 일상 회화의 화제 전환에서도 두루 일해요. 분사구문 전체를 공격적으로 쓰기 전에, 이 굳은 세트부터 입에 붙이는 게 가성비 좋은 순서예요.",
        examples: [
          { en: "Generally speaking, prices rise in spring.", ko: "일반적으로 봄에는 물가가 올라요." },
          { en: "Judging from his accent, he must be from Busan.", ko: "억양으로 판단하건대 그는 부산 출신임에 틀림없어요." },
          { en: "Speaking of travel, have you booked your flight yet?", ko: "여행 얘기가 나와서 말인데, 비행기표 예약했어요?" },
        ],
        etym: "participle(분사)은 라틴어 **participare(참여하다, 나눠 갖다)** — part(부분)+capere(잡다)에서 왔어요. 동사의 성질과 형용사의 성질을 **둘 다 나눠 가진** 말이라는 뜻이죠. participate(참여하다)와 같은 뿌리예요. 이름 그대로, 분사는 동사이면서 형용사인 두 집 살림꾼이에요.",
      },
    ],
  },

  {
    slug: "b2-06-linking-devices",
    level: "B2",
    order: 6,
    title: "논리 연결어 — 글의 격을 올리는 라틴계 어휘",
    titleFr: "Linking Devices: however / whereas / hence",
    summary: "but과 so만으로 버텨온 글에 however, nevertheless, whereas, hence를 — 연결어의 격식 스펙트럼과 구두점 규칙까지 정리해요.",
    duration: "약 10분",
    sections: [
      {
        heading: "연결어에는 격식의 층이 있어요",
        body:
          "and, but, so만으로도 말은 통해요. 하지만 에세이·보고서·시험 라이팅에서 그 셋만 반복하면 글이 단조롭고 가벼워 보여요. 영어 연결어에는 **격식의 스펙트럼**이 있고, 위층 어휘는 대부분 라틴어 출신이에요.\n\n" +
          "**대조**: but (일상) → however (중립·격식) → nevertheless / nonetheless (격식)\n" +
          "**인과**: so (일상) → therefore (격식) → thus / hence / consequently (격식·문어)\n" +
          "**추가**: also (일상) → in addition / moreover (격식) → furthermore (격식)\n\n" +
          "요령은 **자리에 맞는 층을 고르는 것**이에요. 친구와의 채팅에 nevertheless를 쓰면 우스꽝스럽고, 학술 에세이가 but...but...so...로 이어지면 격이 떨어져요. 같은 뜻의 연결어를 층별로 한 개씩 갖춰두는 게 B2 라이팅의 기본 장비입니다.",
        table: {
          caption: "연결어 격식 스펙트럼",
          headers: ["기능", "일상", "중립~격식", "격식·문어"],
          rows: [
            ["대조", "but", "however", "nevertheless, nonetheless"],
            ["인과", "so", "therefore", "thus, hence, consequently"],
            ["추가", "also, plus", "in addition, moreover", "furthermore"],
            ["예시", "like", "for example", "for instance, namely"],
            ["요약", "anyway", "in short", "in conclusion, to sum up"],
          ],
        },
        examples: [
          { en: "The plan was risky. However, we decided to go ahead.", ko: "그 계획은 위험했어요. 하지만 우리는 추진하기로 했죠." },
          { en: "Sales fell sharply; therefore, the company cut costs.", ko: "매출이 급감했고, 따라서 회사는 비용을 줄였어요." },
          { en: "The hotel was expensive. Moreover, the service was disappointing.", ko: "그 호텔은 비쌌어요. 게다가 서비스도 실망스러웠죠." },
        ],
        etym: "위층 연결어는 라틴어 부품으로 뜻이 풀려요. **consequently**는 con(함께)+sequi(따라가다) — sequence(순서)와 한 가족, '결과가 따라온다'는 그림이에요. **moreover**와 **furthermore**는 '더 나아가', **nonetheless**는 'none the less(그렇다고 덜하지 않게)'가 굳은 말이에요. 부품을 보면 외울 필요 없이 읽힙니다.",
      },
      {
        heading: "however의 구두점 — 가장 많이 틀리는 지점",
        body:
          "however는 뜻은 but인데 **품사가 달라요**. but은 접속사라 두 절을 직접 이을 수 있지만, however는 **부사**라서 절을 잇는 힘이 없어요. 그래서 구두점 규칙이 달라집니다.\n\n" +
          "**It was raining, but we went out.** (○ — 접속사라 콤마로 연결)\n" +
          "**It was raining, however we went out.** (× — 부사는 절을 못 이어요. 이게 comma splice)\n\n" +
          "however로 두 절을 이으려면: ① 마침표로 끊고 새 문장 — It was raining. **However,** we went out. ② 세미콜론 — It was raining**; however,** we went out.\n\n" +
          "therefore, moreover, nevertheless, thus도 전부 같은 부류(접속부사)라 같은 규칙을 따라요. 'however류 = 마침표나 세미콜론이 선행' — 이 한 줄이 영문 라이팅 감점의 단골 하나를 지워줍니다.",
        examples: [
          { en: "The data was incomplete. However, the trend was clear.", ko: "데이터는 불완전했어요. 하지만 추세는 분명했죠.", note: "마침표 + However, 콤마" },
          { en: "The data was incomplete; however, the trend was clear.", ko: "(같은 뜻 — 세미콜론 버전)" },
          { en: "Prices rose; consequently, demand fell.", ko: "가격이 올랐고, 그 결과 수요가 줄었어요." },
        ],
        pitfall: "**..., however ...** 콤마 하나로 두 문장을 잇는 comma splice는 한국 학습자 에세이의 최다 감점 포인트 중 하나예요. 한국어 '그러나'는 문장 첫머리에 자유롭게 오니까 however도 그렇겠거니 하지만, however 앞은 **반드시 마침표 아니면 세미콜론**입니다. (문장 중간에 끼울 수도 있어요: The trend, however, was clear.)",
      },
      {
        heading: "whereas / while — 두 사실을 나란히 대조하기",
        body:
          "however가 '앞 내용에 대한 반전'이라면, **whereas**는 **두 사실을 나란히 놓고 비교·대조**할 때 써요. 이쪽은 진짜 접속사라 한 문장 안에서 두 절을 이어요.\n\n" +
          "**Exports rose by 10%, whereas imports fell by 3%.** (수출은 10% 늘어난 반면, 수입은 3% 줄었다)\n\n" +
          "**while**도 같은 일을 해요 — '~하는 동안'이라는 시간 의미 외에 '~인 반면'이라는 대조 의미가 있어요: While I prefer tea, my wife loves coffee.\n\n" +
          "통계·그래프 묘사, 두 입장 비교 에세이에서 whereas/while은 거의 필수 장비예요. '반면에'가 떠오를 때 on the other hand만 반복하지 말고 whereas로 한 문장에 압축해보세요.",
        examples: [
          { en: "The north of the country is mountainous, whereas the south is flat.", ko: "그 나라의 북부는 산악 지대인 반면, 남부는 평탄해요." },
          { en: "While online classes are convenient, they lack human connection.", ko: "온라인 수업은 편리한 반면, 사람 사이의 교감이 부족해요.", note: "양보로 문을 여는 에세이 단골 문형" },
          { en: "My sister is outgoing, whereas I am rather quiet.", ko: "언니는 외향적인 반면 저는 조용한 편이에요." },
        ],
        tip: "대조 에세이의 황금 패턴: **While(양보) + 주장** — While X has some merit, Y is more convincing. 상대 입장을 한 번 인정하고 내 주장으로 넘어가는 이 구조는 IELTS·TOEFL 라이팅 고득점 답안의 공통 골격이에요.",
      },
      {
        heading: "hence와 thus — 짧지만 묵직한 인과",
        body:
          "**hence**와 **thus**는 인과 연결어 중에서도 가장 문어적이에요. 학술문·보고서에서 빛나죠.\n\n" +
          "**thus** — '이렇게 하여, 따라서'. 절 전체를 받기도 하고, **thus + -ing**(분사구문과 결합)로 '그렇게 함으로써'를 표현하기도 해요: The company cut prices, **thus attracting** new customers.\n\n" +
          "**hence** — '그러므로'. 특히 **hence + 명사구**로 동사 없이 쓰는 용법이 독특해요: The demand doubled — **hence the higher prices.** (수요가 두 배가 됐고, 그래서 가격이 오른 것이다)\n\n" +
          "이 둘은 한 편의 글에 한두 번이면 충분해요. 향신료처럼 — 적게 써야 효과가 살아요.",
        examples: [
          { en: "The experiment failed twice; thus, we revised the design.", ko: "실험이 두 번 실패했고, 따라서 설계를 수정했어요." },
          { en: "The new policy reduced paperwork, thus saving everyone time.", ko: "새 정책은 서류 작업을 줄였고, 그럼으로써 모두의 시간을 아껴줬어요.", note: "thus + -ing" },
          { en: "He grew up in Rome — hence his love of Italian food.", ko: "그는 로마에서 자랐어요 — 이탈리아 음식 사랑은 거기서 온 거죠.", note: "hence + 명사구 (동사 없음!)" },
        ],
        etym: "**hence**는 원래 '여기로부터(from here)'라는 장소 부사였어요 — '여기서부터 출발하면 → 그러므로'로 의미가 번진 거죠. 같은 계열로 thence(거기로부터), whence(어디로부터)가 있었는데 hence만 살아남았어요. '10 years hence(지금부터 10년 뒤)'라는 시간 용법에 옛 뜻의 흔적이 남아 있어요.",
      },
    ],
  },

  {
    slug: "b2-07-collocations",
    level: "B2",
    order: 7,
    title: "콜로케이션 — 단어는 친구를 가린다",
    titleFr: "Collocations: make / do / have / take",
    summary: "heavy rain은 되는데 strong rain은 왜 안 될까? 단어들의 단짝 관계, 콜로케이션으로 '문법은 맞는데 어색한 영어'를 졸업해요.",
    duration: "약 11분",
    sections: [
      {
        heading: "문법은 맞는데 어색한 이유 — 단어의 교우 관계",
        body:
          "**strong rain** — 문법적으로 완벽하고 뜻도 통하지만, 원어민은 이렇게 말하지 않아요. 비는 **heavy rain**이거든요. 반면 커피는 strong coffee(○), heavy coffee(×).\n\n" +
          "이렇게 **단어마다 정해진 단짝 조합**을 콜로케이션(collocation)이라고 해요. 논리가 아니라 관습이라, '왜?'가 없어요. 그냥 그 단어의 교우 관계예요.\n\n" +
          "B2부터 영어 실력을 가르는 건 문법보다 콜로케이션이에요. 문법 오류는 '배우는 중이구나'로 들리지만, 콜로케이션이 자연스러우면 같은 문법 수준에서도 **확연히 유창하게** 들려요. 시험 라이팅·스피킹 채점 기준에 lexical resource(어휘 운용)가 따로 있는 이유이기도 하고요.",
        examples: [
          { en: "We had heavy rain all weekend.", ko: "주말 내내 폭우가 내렸어요.", note: "strong rain ×" },
          { en: "I need a strong coffee this morning.", ko: "오늘 아침엔 진한 커피가 필요해요.", note: "heavy coffee ×" },
          { en: "She has a strong accent. / He's a heavy smoker.", ko: "그녀는 억양이 강해요. / 그는 골초예요.", note: "단어마다 단짝이 달라요" },
        ],
        etym: "collocation은 라틴어 **com(함께)+locare(놓다)** — '함께 놓이는 것들'이라는 뜻 그대로예요. location(위치), locate(자리 잡다)와 한 가족이죠. 단어의 뜻만 외우면 절반만 아는 것 — **어디 옆에 놓이는지**까지 알아야 그 단어를 다 아는 거예요.",
      },
      {
        heading: "make vs do — 한국어 '하다'의 두 갈래",
        body:
          "한국어 '하다'는 만능 동사죠. 숙제도 하고, 실수도 하고, 약속도 해요. 영어는 이 '하다'를 최소 둘로 가르는데, 경향은 이래요.\n\n" +
          "**make = 만들어내다** — 결과물이 생기는 행위: make a mistake(실수), make a decision(결정), make a promise(약속), make money(돈), make progress(진전), make an effort(노력), make noise(소음)\n\n" +
          "**do = 수행하다** — 일·과업을 처리하는 행위: do homework(숙제), do the dishes(설거지), do business(사업), do research(연구), do your best(최선), do exercise(운동)\n\n" +
          "'결과물 창조 = make, 과업 수행 = do'라는 경향이 7할은 맞혀주지만, 결국은 **덩어리째 암기**가 정답이에요. make a decision을 'make+a+decision'이 아니라 한 단어처럼 외우세요.",
        table: {
          caption: "make vs do 핵심 콜로케이션",
          headers: ["make (결과물 창조)", "do (과업 수행)"],
          rows: [
            ["make a mistake 실수하다", "do homework 숙제하다"],
            ["make a decision 결정하다", "do the dishes 설거지하다"],
            ["make a promise 약속하다", "do research 연구하다"],
            ["make progress 진전을 보이다", "do business 사업하다"],
            ["make an effort 노력하다", "do your best 최선을 다하다"],
            ["make money 돈을 벌다", "do someone a favor 부탁을 들어주다"],
          ],
        },
        examples: [
          { en: "I made a big mistake on the report.", ko: "보고서에서 큰 실수를 했어요.", note: "did a mistake ×" },
          { en: "We need to make a decision by Friday.", ko: "금요일까지 결정을 내려야 해요." },
          { en: "Could you do me a favor?", ko: "부탁 하나 들어줄래요?" },
        ],
        pitfall: "**do a mistake / make homework** — '하다'를 직역하는 데서 오는 한국 학습자 최빈출 콜로케이션 오류예요. 실수는 '만드는' 것(make a mistake), 숙제는 '수행하는' 것(do homework). 헷갈리는 그 순간이 바로 덩어리 암기가 필요하다는 신호입니다.",
      },
      {
        heading: "have와 take — 경험과 동작의 동사",
        body:
          "**have = 겪다·누리다** — 식사·휴식·경험을 '가지는' 그림: have breakfast(아침 식사), have a break(휴식), have fun(즐기다), have a look(보다), have a conversation(대화하다), have a problem(문제가 있다)\n\n" +
          "**take = 잡아서 행하다** — 동작을 '집어 드는' 그림: take a shower(샤워), take a walk(산책), take a break(휴식 — have와 호환), take a picture(사진 찍다), take medicine(약을 먹다), take an exam(시험을 치다), take a taxi(택시를 타다)\n\n" +
          "여기서 한국어 간섭 주의보 — '약을 **먹다**'는 eat medicine이 아니라 **take medicine**, '사진을 **찍다**'는 cut/shoot이 아니라 **take a picture**, '샤워**하다**'는 do a shower가 아니라 **take(have) a shower**예요. 한국어 동사를 거치지 말고 영어 덩어리를 직통으로 불러와야 하는 대표 지점들이에요.",
        examples: [
          { en: "Don't forget to take your medicine.", ko: "약 먹는 거 잊지 마세요.", note: "eat medicine ×" },
          { en: "Let's take a break and have some coffee.", ko: "잠깐 쉬면서 커피 마셔요." },
          { en: "We had a great time at the festival.", ko: "축제에서 정말 즐거운 시간을 보냈어요.", note: "have a great time = 굳은 덩어리" },
          { en: "Can I take a look at the menu?", ko: "메뉴 좀 볼 수 있을까요?", note: "have a look도 ○ (영국에서 선호)" },
        ],
        vsKo: "한국어는 '먹다(약·밥·마음)', '찍다(사진·도장·점)'처럼 **한국어 동사 기준**으로 짝이 정해져 있죠. 영어도 마찬가지로 **영어 동사 기준**의 짝이 따로 있을 뿐이에요. 그러니 '먹다 = eat'라는 1:1 등식을 버리고, 명사 쪽에서 출발하세요 — medicine이 부르는 동사는 take, 이렇게 명사→동사 방향으로 외우는 게 콜로케이션 학습의 정석입니다.",
      },
      {
        heading: "형용사·부사 콜로케이션, 그리고 모으는 법",
        body:
          "동사 콜로케이션만큼 중요한 게 **형용사+명사, 부사+형용사** 조합이에요.\n\n" +
          "**형용사+명사**: heavy traffic(교통체증), strong opinion(강한 의견), high temperature(높은 온도 — big ×), fast food / quick meal(빠른 식사 — fast meal은 어색)\n\n" +
          "**부사+형용사**: highly unlikely(매우 ~할 것 같지 않은), deeply disappointed(몹시 실망한), fully aware(충분히 인지하는), bitterly cold(혹독하게 추운) — 전부 very로 바꿔도 통하지만, 단짝 부사를 쓰면 표현의 해상도가 달라져요.\n\n" +
          "**모으는 법**: ① 새 단어를 만나면 뜻 대신 **옆 단어**를 같이 적기 (decision → make a tough decision) ② 콜로케이션 사전(무료 온라인 사전 다수) 활용 ③ 다독 중에 '어, 이 조합 처음 보네' 하는 순간을 수집. 단어장을 '단어+뜻'에서 '**덩어리+장면**'으로 바꾸는 것이 B2에서 C1으로 가는 가장 확실한 길이에요.",
        examples: [
          { en: "We got stuck in heavy traffic.", ko: "교통체증에 갇혔어요.", note: "many traffic ×, heavy가 단짝" },
          { en: "It's highly unlikely that he'll come.", ko: "그가 올 가능성은 매우 낮아요.", note: "very unlikely보다 격 있는 조합" },
          { en: "I'm fully aware of the risks.", ko: "위험은 충분히 알고 있어요." },
          { en: "It was bitterly cold that morning.", ko: "그날 아침은 살을 에는 듯 추웠어요." },
        ],
        tip: "오늘부터 단어장 형식을 바꿔보세요. 왼쪽에 단어, 오른쪽에 뜻 대신 **그 단어의 단짝 3개**를 적는 거예요. rain → heavy / pouring / light. decision → make / tough / final. 뜻은 어차피 문맥이 알려주지만, 단짝은 수집하지 않으면 영영 모릅니다.",
      },
    ],
  },
];
