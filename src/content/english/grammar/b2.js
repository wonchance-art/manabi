/**
 * B2 중상급 — 정확함을 넘어 '격'을 만드는 문법
 * 후회의 가정법, 관사의 빈칸, 도치와 분사구문 — 작문·스피킹 점수를 가르는 장치들을 다지는 레벨.
 */
const chapters = [
  {
    slug: "b2-01-conditionals-3-mixed",
    level: "B2",
    order: 1,
    title: "\"그때 살 걸\" — 지나간 후회의 문법",
    topic: "가정문 3형·혼합",
    titleFr: "Third & Mixed Conditionals",
    summary: "'그때 알았더라면' — 돌이킬 수 없는 과거를 가정하는 3형과, should have p.p.의 후회 표현을 완성해요.",
    duration: "약 10분",
    sections: [
      {
        heading: "3형 — 이미 끝난 과거를 되돌려보는 상상",
        pattern: "If + had p.p., would have p.p.",
        patternKo: "-했더라면 -했을 텐데 — 후회와 안도의 문법",
        body:
          "2형이 '지금'과 반대되는 상상이라면, **3형은 '과거'와 반대되는 상상**이에요. 이미 벌어져 바꿀 수 없는 일을 머릿속에서만 되감는 문법이라 단골 정서는 **후회와 안도**예요.\n\n" +
          "If I had studied harder, I would have passed the exam. — 실제로는 안 했고, 떨어졌어요. 형태는 2형에서 시계만 과거로 민 것뿐이에요: had → had p.p., would + 원형 → would have p.p.",
        examples: [
          { en: "If I had studied harder, I would have passed the exam.", ko: "더 열심히 공부했더라면 시험에 합격했을 텐데요. (실제: 안 했고, 떨어짐)" },
          { en: "If you had told me earlier, I could have helped you.", ko: "더 일찍 말해줬더라면 도와줄 수 있었을 텐데." },
          { en: "If we hadn't taken a taxi, we would have missed the flight.", ko: "택시를 안 탔더라면 비행기를 놓쳤을 거예요. (안도)" },
        ],
        vsKo: "한국어 '-했더라면 -했을 텐데'가 3형과 거의 완벽하게 대응해요. '-더라면'이 들리면 if절은 had p.p., '-했을 텐데'가 들리면 주절은 would have p.p. — 이 짝만 기억하면 형태는 기계적으로 나옵니다.",
      },
      {
        heading: "should have p.p. — 후회의 일상 버전",
        pattern: "should / could / must / might + have p.p.",
        patternKo: "~했어야 했는데 · ~할 수도 있었는데 · ~했음에 틀림없다",
        body:
          "일상 회화의 후회는 if절을 떼어버린 **조동사 + have p.p.**가 훨씬 자주 쓰여요 — **should have p.p.**(~했어야 했는데), **shouldn't have p.p.**(~하지 말았어야 했는데), **could have p.p.**(~할 수도 있었는데), **would have p.p.**(그 상황이었다면 ~했을 텐데).\n\n" +
          "B1의 추측 조동사도 have p.p.를 만나면 **과거 추측**이 돼요: must have p.p.(~했음에 틀림없다), might have p.p.(~했을지도), can't have p.p.(~했을 리 없다).",
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
        pattern: "If + had p.p., would + 원형 (과거 원인 → 현재 결과)",
        patternKo: "각 절의 시간을 따로 묻고 그 시간의 형태로 조립",
        body:
          "'그때 안 샀더라면(과거), 지금 부자일 텐데(현재)' — **if절과 주절의 시간대가 다른** 것이 혼합 가정문이에요. 과거 가정 → 현재 결과는 If + had p.p., **would + 원형**, 현재 가정 → 과거 결과는 If + 과거, **would have p.p.**\n\n" +
          "외울 건 없어요 — **각 절의 시간을 따로 묻고 그 시간에 맞는 형태를 조립**하면 끝이에요. now, today 같은 시간 부사가 큰 힌트가 됩니다.",
        examples: [
          { en: "If I had saved money in my twenties, I would be much richer now.", ko: "20대에 돈을 모았더라면 지금 훨씬 부자일 텐데요.", note: "과거 원인 → 현재 결과" },
          { en: "If she weren't afraid of flying, she would have come with us.", ko: "그녀가 비행공포증만 없다면 우리와 같이 왔을 거예요.", note: "현재 성격 → 과거 결과" },
        ],
        tip: "혼합형 판별의 치트키는 **시간 부사**예요. 주절에 now/today가 보이면 주절은 would + 원형(현재), if절에 yesterday/last year가 보이면 if절은 had p.p.(과거). 공식 암기보다 시간표 맞추기로 접근하세요.",
      },
      {
        heading: "wish와 If only — 가정법의 사촌",
        pattern: "wish + 과거형 = 현재 아쉬움 · wish + had p.p. = 과거 후회",
        patternKo: "If only = wish의 강조 버전",
        body:
          "**wish + 과거형**은 현재에 대한 아쉬움(I wish I knew the answer. — 지금 모르니까), **wish + had p.p.**는 과거에 대한 후회(I wish I had studied abroad.)예요. **If only**는 wish의 강조 버전 — If only I had known!\n\n" +
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
    title: "\"일한 지 5년 됐어요\"를 영어로",
    topic: "완료진행 have been -ing",
    titleFr: "Perfect Continuous Tenses",
    summary: "have been -ing는 '지금까지 얼마나 오래 하고 있는가'를 묻고 답하는 전용 프레임이에요. How long과 함께 세트로 익혀요.",
    duration: "약 9분",
    sections: [
      {
        heading: "have been -ing의 정체 — 기간을 강조하는 현재완료",
        pattern: "How long have you been -ing? → have been -ing + for/since",
        patternKo: "'-한 지 ~ 됐다' 전용 시제",
        body:
          "현재완료진행은 하는 일이 하나예요 — **과거에 시작해 지금까지 계속되는 행동의 '지속'을 강조**하는 것. I have been studying English for ten years.는 10년 전 시작했고 지금도 진행 중이며, 그 **기간**에 스포트라이트가 있어요.\n\n" +
          "그래서 단짝 질문이 **How long...?**이고, **for/since**와의 결합률도 최상위예요.",
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
        pattern: "have p.p. = 결과·횟수 ↔ have been -ing = 과정·기간",
        patternKo: "상태동사(know·like)는 진행형 불가",
        body:
          "**have p.p.(단순)**는 결과·완료에 초점(I have read the book. — 다 읽었어요), **have been -ing(진행)**는 과정·지속에 초점(I have been reading the book. — 아직 안 끝남)이에요. 그래서 **횟수·완성량은 단순형**, **소요 시간은 진행형**이 어울려요.\n\n" +
          "주의: know, like, believe, own 같은 **상태동사는 진행형 불가** — I have been knowing(×)이 아니라 I have known her for ten years(○)예요.",
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
        pattern: "현재의 증거 한 문장 + Have you been -ing?",
        patternKo: "방금까지 계속된 행동이 남긴 흔적 읽기",
        body:
          "완료진행의 두 번째 얼굴 — **방금까지 계속된 행동이 현재에 남긴 흔적**을 읽을 때 써요. Your eyes are red. **Have you been crying?** / The ground is wet. **It has been raining.**\n\n" +
          "셜록 홈즈가 '당신, 방금까지 ~하고 있었군요'라고 말할 때의 그 추리 말투예요. 회화에 깔리면 굉장히 자연스러운 중상급 티가 납니다.",
        examples: [
          { en: "You're out of breath. Have you been running?", ko: "숨이 차네요. 뛰어왔어요?" },
          { en: "Sorry about the mess — I've been packing all day.", ko: "어질러져서 미안해요. 하루 종일 짐 싸는 중이었거든요." },
          { en: "Someone has been eating my snacks!", ko: "누가 내 과자를 계속 먹어왔어!", note: "다 먹었으면 has eaten — 야금야금 흔적은 has been eating" },
        ],
        tip: "단서 → 추리의 공식으로 외우세요: **현재의 증거 한 문장 + have been -ing 한 문장.** 'Your hands are dirty. You've been fixing the bike again.' 이 2문장 패턴을 몇 개 만들어보면 용법이 몸에 붙어요.",
      },
      {
        heading: "과거완료진행 — 기준점을 과거로 옮기면",
        pattern: "had been -ing = 과거의 한 시점까지 계속",
        patternKo: "기준점 '지금'을 과거로 옮긴 버전 — 과거 이야기의 배경",
        body:
          "현재완료진행의 기준점 '지금'을 과거의 한 시점으로 옮기면 **had been -ing**가 돼요 — When I arrived, they **had been waiting** for an hour.(도착한 그 시점까지 한 시간째 대기 중)\n\n" +
          "구조는 똑같아요: '기준 시점까지 얼마나 오래 계속됐나'. 스토리텔링(과거 이야기)에서 배경 설명으로 자주 깔리는 시제입니다.",
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
    title: "school 앞 the가 사라진 이유",
    topic: "관사 심화·무관사/총칭",
    titleFr: "Advanced Articles: Zero Article & Generic Use",
    summary: "go to school엔 왜 the가 없을까? a/the를 넘어 '관사 없음'이라는 제3의 선택지까지 — 한국인 영원한 숙제 2탄이에요.",
    duration: "약 11분",
    sections: [
      {
        heading: "무관사 — '관사 없음'도 하나의 선택이에요",
        pattern: "go to school(기능·활동) ↔ go to the school(그 건물)",
        patternKo: "school·bed·church·work·home — 활동이면 무관사",
        body:
          "B2에서는 **관사를 안 쓰는 것(무관사)도 의미가 있는 선택**이라는 걸 알아야 해요. go to school의 school은 '그 건물'이 아니라 **'수업·학업이라는 기능'** — 학생이 공부하러 가면 go to school, 학부모가 그 건물에 가면 go to the school이에요.\n\n" +
          "같은 원리: **bed**(잠), **church**(예배), **prison**(복역), **hospital**(입원, 영국식), **work**, **home**. go to bed(자러 가다) vs go to the bed(그 침대로 걸어가다) — 관사 하나로 뜻이 갈라져요.",
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
        pattern: "총칭 = 무관사 복수 — Cats are independent. · I like apples.",
        patternKo: "the + 단수(학술적) · a + 단수(개체 대표)도 가능",
        body:
          "종 전체를 말하는 방법은 셋 — **① 무관사 복수**(Cats are independent. — 회화의 기본값), **② the + 단수**(The cat is independent. — 백과사전·논문 말투), **③ a + 단수**(A cat is independent. — 아무 고양이나 한 마리 잡아도).\n\n" +
          "B2에서 꼭 잡을 것은 ①이에요. '사과를 좋아해요'는 I like apple(×)이 아니라 **I like apples** — 무관사 **복수**예요. 셀 수 없는 명사는 무관사 단수로: I like music. / Health is more important than money.",
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
        pattern: "강·바다·산맥·군도·기관 = the · 도시·단일 산·호수·공항 = 무관사",
        patternKo: "여럿의 집합·물줄기엔 the, 점 하나는 무관사",
        body:
          "고유명사는 원칙적으로 무관사지만(Korea, Seoul, Mount Halla), **the가 붙는 부류**가 정해져 있어요 — 복수형 국가·군도(**the** Philippines), 강·바다(**the** Han River, **the** Pacific), 산맥(**the** Alps), 호텔·박물관·신문(**the** Hilton, **the** Times), 'of'형 이름(**the** University of Oxford).\n\n" +
          "패턴이 보이죠? **여럿이 모여 이루어진 것과 흐르는 물줄기·기관명**에는 the, **점 하나로 찍히는 것(도시·단일 산·호수)**은 무관사 — 거칠지만 강력한 경향이에요.",
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
        pattern: "have dinner(일상 식사) · a dinner(만찬 행사) · the dinner(그 저녁)",
        patternKo: "관사는 장식이 아니라 의미의 스위치",
        body:
          "같은 명사에 무관사/a/the를 갈아 끼우면 의미가 변해요 — **dinner**: have dinner(일상 식사) / a dinner(만찬 행사 하나) / the dinner(아까 말한 그 저녁). **school**: go to school(공부하러) / a school(한 곳) / the school(그 건물).\n\n" +
          "**by + 교통수단은 무관사**예요: by bus, by subway, by plane. 단, 특정한 차를 타면 in my car, on the 8 o'clock train.",
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
    title: "Never가 문장 맨 앞에 오면",
    topic: "도치·강조 구문",
    titleFr: "Inversion & Emphasis",
    summary: "Not only..., Never have I... — 어순을 뒤집어 문장에 스포트라이트를 켜는 격식 장치. 작문·스피킹 고득점의 단골 무기예요.",
    duration: "약 10분",
    sections: [
      {
        heading: "도치란 — 어순을 흔들어 시선을 끄는 장치",
        pattern: "부정어 문두 + 의문문 어순 — Never have I seen ...",
        patternKo: "① 부정어를 맨 앞으로 ② 나머지는 의문문처럼",
        body:
          "어순이 생명인 영어에서 **어순을 일부러 뒤집으면 강한 스포트라이트 효과**가 나요 — 이게 도치예요. **Never have I seen** such a beautiful sunset.(이런 노을은 처음이야!) 구조는 의문문과 똑같아요 — 부정·제한의 부사를 문두로 빼고, 뒤를 **조동사+주어+동사** 어순으로 만드는 거예요.\n\n" +
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
        pattern: "Not only + 도치(조동사+주어) ..., but (also) ...",
        patternKo: "No sooner ~ than · Hardly ~ when · Only then도 같은 부류",
        body:
          "격식 작문 최고 활용도의 도치 — She is not only smart but also kind. → **Not only is she smart, but she is also kind.** Not only가 문두로 나오면 그 절은 의문문 어순!\n\n" +
          "같은 부류의 문두 트리거: **No sooner had I arrived than** it started to rain. / **Hardly had we started when** the power went out. / **Under no circumstances should you** share this password. / **Only then did I realize** my mistake.",
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
        pattern: "긍정 맞장구 So do I. · 부정 맞장구 Neither do I.",
        patternKo: "동사는 앞 문장에 맞추기 — So am I / So can I / So did I",
        body:
          "맞장구의 **So do I.(나도) / Neither do I.(나도 안 그래)**가 바로 도치예요. 동사를 앞 문장에 맞추는 게 포인트 — am이면 So am I, can이면 So can I, 일반동사 과거면 So did I.\n\n" +
          "확장형으로 **so + 형용사 도치**도 있어요: **So beautiful was the view that** we stayed another hour. — so... that 구문의 격식 변형이에요.",
        examples: [
          { en: "A: I'm exhausted. — B: So am I.", ko: "A: 너무 피곤해. — B: 나도." },
          { en: "A: I didn't like the ending. — B: Neither did I.", ko: "A: 결말이 별로였어. — B: 나도 별로였어." },
          { en: "So strong was the wind that several trees fell.", ko: "바람이 어찌나 셌는지 나무가 몇 그루나 쓰러졌어요." },
        ],
        vsKo: "한국어 '나도'는 긍정·부정을 가리지 않지만, 영어는 **긍정 맞장구 So ~ I / 부정 맞장구 Neither ~ I**로 갈라져요. 'Me too'만 쓰던 단계에서 So do I / Neither do I로 넘어가면 맞장구의 해상도가 올라갑니다. (부정문에 Me too라고 하면 어색해요 — Me neither가 짝이에요.)",
      },
      {
        heading: "It is... that 강조 구문 — 스포트라이트 옮기기",
        pattern: "It is X that ... · What I need is ...",
        patternKo: "문장의 한 조각에 스포트라이트 쏘기 (분열문)",
        body:
          "문장의 한 조각을 It is와 that 사이에 끼워 스포트라이트를 쏘는 **분열문(cleft sentence)**이에요 — **It was Mina that(who) broke the vase.**(깬 사람은 다른 누구도 아닌 미나) / **It was yesterday that** Mina broke the vase.(깬 것은 어제)\n\n" +
          "**What I need is...** 형태(의사분열문)도 세트로: What I need is a long vacation. — 회화에서도 흔히 쓰이는 자연스러운 강조법이에요.",
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
    title: "문장을 반으로 접는 기술",
    topic: "분사구문",
    titleFr: "Participle Clauses",
    summary: "Having finished the report, ... — 접속사와 주어를 떼어내 문장을 압축하는 문어의 기술과, 악명 높은 현수분사 함정을 다뤄요.",
    duration: "약 10분",
    sections: [
      {
        heading: "분사구문의 원리 — 접속사+주어를 떼어내는 압축",
        pattern: "When I opened the box, ... → Opening the box, I ...",
        patternKo: "두 절의 주어가 같을 때 '접속사+주어'를 삭제",
        body:
          "분사구문은 새 문법이 아니라 **압축 기술**이에요. 두 절의 주어가 같을 때 부사절의 '접속사+주어'를 지우고 동사를 분사(-ing)로 바꿔요 — 지워진 접속사의 의미(~할 때, ~해서, ~하면서)는 문맥이 채우는, **간결함과 모호함을 맞바꾼** 문체예요.\n\n" +
          "주 서식지는 **격식 문어**(논문, 보고서, 뉴스, 소설)예요. 회화에서는 접속사를 살려 말하는 게 보통이지만, 해석 속도를 위해서라도 꼭 잡아야 해요.",
        examples: [
          { en: "Feeling tired, I went to bed early.", ko: "피곤해서 일찍 잤어요. (= Because I felt tired)" },
          { en: "Walking along the beach, we talked about the future.", ko: "해변을 걸으면서 우리는 미래에 대해 이야기했어요. (= While we walked)" },
          { en: "Arriving at the station, she realized she had left her phone at home.", ko: "역에 도착하고서야 폰을 집에 두고 온 걸 깨달았어요. (= When she arrived)" },
        ],
        vsKo: "한국어 연결어미 '-하고, -하며, -해서'가 하는 일과 똑같아요. '상자를 열고, 편지를 발견했다'에서 '-고'가 접속사 없이 두 동작을 잇듯, 영어 분사구문도 접속사 없이 절을 이어요. 개념은 이미 알고 있는 셈 — 새로 배울 것은 '주어가 같아야 지울 수 있다'는 조건 하나예요.",
      },
      {
        heading: "세 가지 형태 — -ing / p.p. / Having p.p.",
        pattern: "-ing(능동·동시) · p.p.(수동) · Having p.p.(먼저 일어남)",
        patternKo: "부정은 분사 앞에 not — Not knowing ~",
        body:
          "**① -ing** — 주어가 동작을 **하는** 능동(Seeing the police, he ran away.), **② p.p.** — 주어가 **당하는** 수동(**Seen** from above, the island looks like a heart. — Being seen에서 Being 생략), **③ Having p.p.** — 주절보다 **분명히 먼저** 일어난 일(**Having finished** the report, she went home.).\n\n" +
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
        pattern: "대원칙: 분사의 의미상 주어 = 주절의 주어",
        patternKo: "깨지면 현수분사(dangling participle)",
        body:
          "**Walking down the street, the building caught my eye.**(×) — 문법대로 읽으면 '건물이 길을 걸어간' 게 돼요. 걸은 건 나인데 주절 주어가 the building이라 분사가 허공에 매달린 **현수분사**예요.\n\n" +
          "고치는 법: ① 주절 주어를 분사의 주인으로 교체 — Walking down the street, **I noticed** the building. ② 접속사와 주어를 복원 — **As I was walking** down the street, ... 분사구문을 쓸 때마다 '이 -ing의 주인이 주절 주어 맞나?'를 자문하는 습관이 보험입니다.",
        examples: [
          { en: "Walking down the street, I noticed a new cafe.", ko: "길을 걷다가 새 카페를 발견했어요.", note: "걷는 주체 = I — 올바른 분사구문" },
          { en: "Having reviewed your application, we are pleased to offer you the position.", ko: "지원서를 검토한 결과, 귀하께 합격을 알려드리게 되어 기쁩니다.", note: "검토한 주체 = we ○" },
          { en: "After reading the contract, the terms seemed unfair. (×) → After reading the contract, I felt the terms were unfair. (○)", ko: "계약서를 읽어보니 조건이 불공정해 보였어요.", note: "읽은 건 '계약 조건'이 아니라 '나'" },
        ],
        tip: "이메일·에세이를 퇴고할 때 -ing로 시작하는 문장만 골라 **콤마 바로 뒤의 주어에 동그라미**를 쳐보세요. 그 주어가 -ing의 주인이 아니면 현수분사예요. 30초짜리 점검으로 글의 신뢰도가 지켜집니다.",
      },
      {
        heading: "굳은 분사 표현 — 외워서 바로 쓰는 세트",
        pattern: "Generally speaking · Judging from ~ · Considering ~ · Given ~",
        patternKo: "주어 일치 면제 — 문장 전체에 걸리는 부사처럼",
        body:
          "주어 일치 규칙을 면제받은 **관용구로 굳은 분사 표현**들 — **Generally speaking**(일반적으로), **Strictly speaking**(엄밀히), **Judging from ~**(~로 판단하건대), **Considering ~**(~을 고려하면), **Speaking of ~**(~ 얘기가 나와서), **Given ~**(~을 감안하면).\n\n" +
          "격식 작문의 문단 도입부에서도, 일상 회화의 화제 전환에서도 두루 일해요. 이 굳은 세트부터 입에 붙이는 게 가성비 좋은 순서예요.",
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
    title: "but과 so만 쓰면 티가 납니다",
    topic: "논리 연결어 however/whereas",
    titleFr: "Linking Devices: however / whereas / hence",
    summary: "but과 so만으로 버텨온 글에 however, nevertheless, whereas, hence를 — 연결어의 격식 스펙트럼과 구두점 규칙까지 정리해요.",
    duration: "약 10분",
    sections: [
      {
        heading: "연결어에는 격식의 층이 있어요",
        pattern: "but → however → nevertheless · so → therefore → hence",
        patternKo: "자리에 맞는 격식의 층 고르기",
        body:
          "and, but, so만 반복하면 에세이·보고서가 단조롭고 가벼워 보여요. 영어 연결어에는 **격식의 스펙트럼**이 있고, 위층 어휘는 대부분 라틴어 출신이에요 — 대조: but → however → nevertheless, 인과: so → therefore → thus/hence, 추가: also → moreover → furthermore.\n\n" +
          "요령은 **자리에 맞는 층을 고르는 것** — 채팅에 nevertheless는 우스꽝스럽고, 학술 에세이가 but...so...로 이어지면 격이 떨어져요. 같은 뜻의 연결어를 층별로 한 개씩 갖춰두는 게 B2 라이팅의 기본 장비입니다.",
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
        pattern: "절. However, 절 / 절; however, 절 — 콤마 단독 연결 금지",
        patternKo: "however는 부사 — 접속사 but과 달리 절을 못 이어요",
        body:
          "however는 뜻은 but인데 **품사가 부사**라 절을 잇는 힘이 없어요. It was raining, but we went out.(○) vs It was raining, however we went out.(× — comma splice). however로 이으려면 ① 마침표로 끊거나 ② 세미콜론을 쓰세요 — It was raining**; however,** we went out.\n\n" +
          "therefore, moreover, nevertheless, thus도 같은 부류(접속부사)라 같은 규칙이에요. 'however류 = 마침표나 세미콜론이 선행' — 이 한 줄이 영문 라이팅 감점의 단골 하나를 지워줍니다.",
        examples: [
          { en: "The data was incomplete. However, the trend was clear.", ko: "데이터는 불완전했어요. 하지만 추세는 분명했죠.", note: "마침표 + However, 콤마" },
          { en: "The data was incomplete; however, the trend was clear.", ko: "(같은 뜻 — 세미콜론 버전)" },
          { en: "Prices rose; consequently, demand fell.", ko: "가격이 올랐고, 그 결과 수요가 줄었어요." },
        ],
        pitfall: "**..., however ...** 콤마 하나로 두 문장을 잇는 comma splice는 한국 학습자 에세이의 최다 감점 포인트 중 하나예요. 한국어 '그러나'는 문장 첫머리에 자유롭게 오니까 however도 그렇겠거니 하지만, however 앞은 **반드시 마침표 아니면 세미콜론**입니다. (문장 중간에 끼울 수도 있어요: The trend, however, was clear.)",
      },
      {
        heading: "whereas / while — 두 사실을 나란히 대조하기",
        pattern: "A ..., whereas/while B ... = ~인 반면",
        patternKo: "진짜 접속사 — 한 문장 안에서 두 절 연결",
        body:
          "however가 '앞 내용에 대한 반전'이라면, **whereas**는 **두 사실을 나란히 놓고 비교·대조**해요 — Exports rose by 10%, whereas imports fell by 3%. **while**도 '~하는 동안' 외에 '~인 반면'이라는 대조 의미가 있어요: While I prefer tea, my wife loves coffee.\n\n" +
          "통계·그래프 묘사, 두 입장 비교 에세이에서 거의 필수 장비예요. '반면에'가 떠오를 때 on the other hand만 반복하지 말고 whereas로 한 문장에 압축해보세요.",
        examples: [
          { en: "The north of the country is mountainous, whereas the south is flat.", ko: "그 나라의 북부는 산악 지대인 반면, 남부는 평탄해요." },
          { en: "While online classes are convenient, they lack human connection.", ko: "온라인 수업은 편리한 반면, 사람 사이의 교감이 부족해요.", note: "양보로 문을 여는 에세이 단골 문형" },
          { en: "My sister is outgoing, whereas I am rather quiet.", ko: "언니는 외향적인 반면 저는 조용한 편이에요." },
        ],
        tip: "대조 에세이의 황금 패턴: **While(양보) + 주장** — While X has some merit, Y is more convincing. 상대 입장을 한 번 인정하고 내 주장으로 넘어가는 이 구조는 IELTS·TOEFL 라이팅 고득점 답안의 공통 골격이에요.",
      },
      {
        heading: "hence와 thus — 짧지만 묵직한 인과",
        pattern: "thus + -ing = 그렇게 함으로써 · hence + 명사구",
        patternKo: "향신료처럼 — 한 편에 한두 번이면 충분",
        body:
          "**thus**는 '이렇게 하여, 따라서' — **thus + -ing**로 '그렇게 함으로써'를 표현해요: The company cut prices, **thus attracting** new customers. **hence**는 '그러므로' — 특히 **hence + 명사구**로 동사 없이 쓰는 용법이 독특해요: The demand doubled — **hence the higher prices.**\n\n" +
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
    title: "단어는 친구를 가린다",
    topic: "콜로케이션 make/do/have/take",
    titleFr: "Collocations: make / do / have / take",
    summary: "heavy rain은 되는데 strong rain은 왜 안 될까? 단어들의 단짝 관계, 콜로케이션으로 '문법은 맞는데 어색한 영어'를 졸업해요.",
    duration: "약 11분",
    sections: [
      {
        heading: "문법은 맞는데 어색한 이유 — 단어의 교우 관계",
        pattern: "heavy rain(○) · strong rain(×) ↔ strong coffee(○) · heavy coffee(×)",
        patternKo: "콜로케이션 = 논리가 아니라 단어의 교우 관계",
        body:
          "**strong rain**은 문법적으로 완벽하지만 원어민은 그렇게 말하지 않아요 — 비는 **heavy rain**, 커피는 strong coffee예요. 이렇게 **단어마다 정해진 단짝 조합**이 콜로케이션(collocation)이에요. 논리가 아니라 관습이라 '왜?'가 없어요.\n\n" +
          "B2부터 실력을 가르는 건 문법보다 콜로케이션이에요. 콜로케이션이 자연스러우면 같은 문법 수준에서도 **확연히 유창하게** 들려요 — 시험 채점 기준에 lexical resource가 따로 있는 이유예요.",
        examples: [
          { en: "We had heavy rain all weekend.", ko: "주말 내내 폭우가 내렸어요.", note: "strong rain ×" },
          { en: "I need a strong coffee this morning.", ko: "오늘 아침엔 진한 커피가 필요해요.", note: "heavy coffee ×" },
          { en: "She has a strong accent. / He's a heavy smoker.", ko: "그녀는 억양이 강해요. / 그는 골초예요.", note: "단어마다 단짝이 달라요" },
        ],
        etym: "collocation은 라틴어 **com(함께)+locare(놓다)** — '함께 놓이는 것들'이라는 뜻 그대로예요. location(위치), locate(자리 잡다)와 한 가족이죠. 단어의 뜻만 외우면 절반만 아는 것 — **어디 옆에 놓이는지**까지 알아야 그 단어를 다 아는 거예요.",
      },
      {
        heading: "make vs do — 한국어 '하다'의 두 갈래",
        pattern: "make = 결과물 창조 (a mistake·a decision) · do = 과업 수행 (homework·the dishes)",
        patternKo: "'하다' 직역 금지 — 덩어리째 암기",
        body:
          "한국어 만능 동사 '하다'를 영어는 최소 둘로 갈라요 — **make = 만들어내다**(결과물이 생김: make a mistake, make a decision, make money, make progress), **do = 수행하다**(일·과업 처리: do homework, do the dishes, do research, do your best).\n\n" +
          "'결과물 창조 = make, 과업 수행 = do'가 7할은 맞혀주지만, 결국은 **덩어리째 암기**가 정답이에요. make a decision을 한 단어처럼 외우세요.",
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
        pattern: "take medicine(약을 먹다) · take a picture(사진을 찍다) · have a great time",
        patternKo: "have = 겪다·누리다 · take = 잡아서 행하다",
        body:
          "**have = 겪다·누리다**(have breakfast, have fun, have a look, have a problem), **take = 잡아서 행하다**(take a shower, take a walk, take a picture, take medicine, take an exam, take a taxi)예요.\n\n" +
          "한국어 간섭 주의보 — '약을 **먹다**'는 eat medicine이 아니라 **take medicine**, '사진을 **찍다**'는 **take a picture**, '샤워**하다**'는 **take(have) a shower**예요. 한국어 동사를 거치지 말고 영어 덩어리를 직통으로 불러와야 해요.",
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
        pattern: "heavy traffic · highly unlikely · deeply disappointed · bitterly cold",
        patternKo: "단어장은 '단어+뜻'이 아니라 '덩어리+장면'으로",
        body:
          "**형용사+명사**(heavy traffic, strong opinion, high temperature — big ×)와 **부사+형용사**(highly unlikely, deeply disappointed, fully aware, bitterly cold)도 동사 콜로케이션만큼 중요해요 — 전부 very로 바꿔도 통하지만, 단짝 부사를 쓰면 표현의 해상도가 달라져요.\n\n" +
          "모으는 법: ① 새 단어의 뜻 대신 **옆 단어**를 같이 적기(decision → make a tough decision) ② 콜로케이션 사전 활용 ③ 다독 중 낯선 조합 수집. 단어장을 '덩어리+장면'으로 바꾸는 것이 B2에서 C1으로 가는 가장 확실한 길이에요.",
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

  {
    slug: "b2-08-causative-perception",
    level: "B2",
    order: 8,
    title: "\"머리 잘랐어\"가 위험해지는 순간",
    topic: "사역·지각동사",
    titleFr: "Causatives & Perception Verbs: make / let / have / get",
    summary: "make him go에는 to가 없고, I cut my hair는 셀프 이발이 돼요. 사역동사 4총사와 지각동사, 그리고 have something done까지 — 동사원형 보어의 세계를 정리해요.",
    duration: "약 10분",
    sections: [
      {
        heading: "사역 4총사 — 강제, 의뢰, 설득, 허락",
        pattern: "make/let/have + 사람 + 동사원형 · get + 사람 + to 동사원형",
        patternKo: "make=강제 · have=시킴 · get=설득(to!) · let=허락",
        body:
          "'~하게 하다'를 영어는 네 단계의 온도로 갈라요 — **make**(강제로 시키다), **have**(업무·역할로 시키다), **get**(구슬리고 애써서 하게 하다), **let**(허락해 주다). 핵심 문법은 하나: make/let/have 뒤 동사는 **원형**(to 없음), **get만 to부정사**를 받아요.\n\n" +
          "force/allow/ask 같은 일반 동사가 전부 to를 받는 것(force him **to go**)과 대조적이에요. 사역 3인방의 원형은 영어에서 드문 예외라 시험 단골입니다.",
        table: {
          caption: "사역동사 온도계",
          headers: ["동사", "온도", "형태", "예"],
          rows: [
            ["make", "강제 — 선택권 없음", "make + O + 원형", "She made me wait."],
            ["have", "중립 — 업무·서비스", "have + O + 원형", "I'll have him call you."],
            ["get", "설득·노력", "get + O + to 원형", "I got him to help me."],
            ["let", "허락", "let + O + 원형", "Let me explain."],
          ],
        },
        examples: [
          { en: "My boss made me redo the whole report.", ko: "상사가 보고서를 통째로 다시 쓰게 했어요.", note: "made me to redo ×" },
          { en: "Her parents wouldn't let her travel alone.", ko: "부모님이 혼자 여행하는 걸 허락하지 않으셨어요." },
          { en: "I finally got my brother to admit his mistake.", ko: "마침내 동생이 실수를 인정하게 만들었어요.", note: "get만 to" },
        ],
        pitfall: "**made me to wait / let me to go** — to부정사 반사가 만드는 최다 오류예요. make/let/have는 **원형 직결**입니다. 거꾸로 **get him admit**(×)처럼 get에서 to를 빼는 역방향 오류도 같이 다녀요 — 'get만 to'를 한 묶음으로 외우세요.",
      },
      {
        heading: "지각동사 — see him leave vs see him leaving",
        pattern: "see/hear/watch/feel + O + 원형(전 과정) · -ing(진행 중인 장면)",
        patternKo: "끝까지 봤으면 원형, 한 장면이면 -ing",
        body:
          "see, hear, watch, feel, notice도 목적어 뒤에 **원형**을 받아요 — 단, **-ing와 의미가 갈려요**. 원형은 **처음부터 끝까지 전 과정**을 목격한 것(I saw him **leave** — 나가는 걸 다 봤다), -ing는 **진행 중인 한 장면**(I saw him **leaving** — 나가고 있는 모습을 봤다)이에요.\n\n" +
          "알리바이가 갈릴 수도 있는 차이죠. 소리도 똑같아요 — I heard her **sing** the whole song(완창을 들었다) vs I heard her **singing** in the shower(부르는 소리가 들려왔다).",
        examples: [
          { en: "I saw her cross the street.", ko: "그녀가 길을 건너는 걸 (처음부터 끝까지) 봤어요.", note: "전 과정 = 원형" },
          { en: "I saw her crossing the street.", ko: "그녀가 길을 건너고 있는 걸 봤어요.", note: "한 장면 = -ing" },
          { en: "We heard someone shouting outside.", ko: "밖에서 누가 소리치는 게 들렸어요." },
        ],
        vsKo: "한국어 '-하는 것을 보다'는 전 과정인지 한 장면인지 구분하지 않아요. 그래서 한국어에서 출발하면 이 선택지가 아예 안 보이죠. '봤다'를 말하기 전에 '끝까지 봤나, 스쳐 봤나'를 한 번 자문하는 습관 — 그게 이 문법의 전부예요.",
      },
      {
        heading: "have/get something done — 맡겨서 받는 일",
        pattern: "have/get + 사물 + p.p. = (남에게 맡겨) ~되게 하다",
        patternKo: "미용실·수리점·병원의 전용 문형",
        body:
          "**I cut my hair**는 '내가 (가위 들고) 내 머리를 잘랐다'예요. 미용실에 다녀왔다면 **I had my hair cut** — have + 사물 + **p.p.**로 '맡겨서 ~되게 했다'를 표현해요. get을 쓰면 더 구어적: Where did you **get** your hair **cut**?\n\n" +
          "이 문형은 **피해**에도 써요 — I **had my wallet stolen** on the subway(지갑을 도둑맞았다). 사물이 '당하는' 쪽이니 보어가 p.p.인 거예요 — 1절의 have him **call**(사람이 행동 = 원형)과 비교하면 구조가 보입니다. (be + p.p. 수동태의 큰 그림은 B1 수동태 챕터 참고.)",
        examples: [
          { en: "I'm having the car serviced tomorrow.", ko: "내일 차 점검 맡겨요." },
          { en: "She got her phone screen replaced.", ko: "그녀는 (맡겨서) 폰 액정을 교체했어요." },
          { en: "He had his passport stolen in the crowd.", ko: "그는 인파 속에서 여권을 도둑맞았어요.", note: "피해의 have + O + p.p." },
        ],
        pitfall: "**I cut my hair yesterday.** — 문법은 완벽한데 뜻이 '셀프 이발'이 되는 함정이에요. 맡긴 일은 **had/got + 사물 + p.p.**: I had my hair cut, I had my eyes checked(시력 검사를 받았다), We're getting the house painted. '내가 했다'와 '맡겨서 됐다'를 영어는 문형으로 가르니, 미용실·병원·수리점 이야기에서는 이 문형을 자동 소환하세요.",
      },
      {
        heading: "수동태가 되면 to가 돌아온다",
        pattern: "make him wait → He was made to wait · see him leave → He was seen to leave",
        patternKo: "원형의 면허는 능동태 한정",
        body:
          "make·지각동사의 원형 보어는 **능동태에서만** 허용돼요. 수동태로 뒤집으면 숨었던 to가 돌아옵니다 — They made him wait. → He **was made to wait**. / She **was seen to enter** the building.\n\n" +
          "**let은 수동태가 어색해서 be allowed to로 교체**해요 — He **was allowed to** leave(was let leave ×). help는 능동에서 원형·to 둘 다 가능(help me (to) carry), 수동에서는 to가 표준이에요.",
        examples: [
          { en: "He was made to apologize in front of everyone.", ko: "그는 모두 앞에서 사과하게끔 됐어요.", note: "수동에서 to 부활" },
          { en: "The staff were not allowed to take photos.", ko: "직원들은 사진 촬영이 허용되지 않았어요.", note: "let의 수동 대역 = be allowed to" },
        ],
        tip: "정리 공식 — **능동은 원형, 수동은 to**. was made wait(×)/was made to wait(○)를 가르는 시험 단골 포인트예요. 부정사의 수동형(to be done)까지 포함한 더 큰 보어 체계는 C1 동사 보어 챕터에서 이어집니다.",
      },
    ],
  },

  {
    slug: "b2-09-determiners-agreement",
    level: "B2",
    order: 9,
    title: "\"every people\"이 두 번 틀린 이유",
    topic: "한정사·수일치",
    titleFr: "Determiners & Agreement: all / every / each",
    summary: "all, every, each는 같은 '모든'이 아니고, a few와 few는 긍정과 부정으로 갈려요. 한정사의 뉘앙스부터 a number of의 수일치까지, 작문 감점 단골 지대를 정리해요.",
    duration: "약 10분",
    sections: [
      {
        heading: "all / every / each — '모든'의 세 얼굴",
        pattern: "all + 복수 · every + 단수(빠짐없이) · each + 단수(하나씩 따로)",
        patternKo: "둘에 대해서는 both(둘 다) · either(둘 중 하나) · neither(둘 다 아님)",
        body:
          "**all**은 덩어리 전체(all students), **every**는 전체를 빠짐없이 — 단 **뒤는 단수**예요(every student **is**). **each**는 하나하나 개별 조명(each student — 한 명씩 면담하는 그림). every는 셋 이상부터, each는 둘부터 쓸 수 있어요.\n\n" +
          "대상이 **둘**이면 전용 한정사로 갈아타요 — **both**(둘 다, 복수 취급), **either**(둘 중 어느 한쪽), **neither**(둘 다 아님, 단수 취급). 상관 구문 either A or B / neither A nor B도 이 가족이에요.",
        examples: [
          { en: "Every seat was taken.", ko: "모든 자리가 차 있었어요.", note: "every + 단수 명사 + 단수 동사" },
          { en: "Each member has a different role.", ko: "각 멤버는 서로 다른 역할이 있어요." },
          { en: "Neither answer is correct.", ko: "두 답 모두 틀렸어요.", note: "neither = 단수 취급" },
        ],
        pitfall: "**every students / every people** — every 뒤에 복수를 놓는 게 최다 감점이에요. every students are(×) → every student **is**(○). 참고로 people은 그 자체가 복수 개념이라 every people은 두 번 틀린 표현 — '모든 사람'은 **everyone** 또는 **all people**이에요.",
      },
      {
        heading: "many / much · (a) few / (a) little — a 하나로 갈리는 세계",
        pattern: "many/few + 가산 복수 · much/little + 불가산 — a가 붙으면 긍정, 없으면 부정",
        patternKo: "a few = 좀 있다 ↔ few = 거의 없다",
        body:
          "양의 한정사는 두 축으로 갈려요 — **셀 수 있으면 many/few, 셀 수 없으면 much/little**. 그리고 결정적인 한 끗: **a가 붙으면 긍정('좀 있다'), 없으면 부정('거의 없다')**. I have **a few** friends(친구가 좀 있다) vs I have **few** friends(친구가 거의 없다) — a 하나로 외로움이 갈려요.\n\n" +
          "비교급도 갈려요 — 가산은 **fewer**, 불가산은 **less**(less people은 구어에선 흔하지만 격식 글에선 fewer people). 그리고 much는 긍정 평서문에서 어색해서 **a lot of**가 기본값이에요(I have much money보다 a lot of money).",
        examples: [
          { en: "We have a little time before the train.", ko: "기차 전까지 시간이 좀 있어요." },
          { en: "There's little hope of finding it now.", ko: "이제 그걸 찾을 가망은 거의 없어요.", note: "a 없는 little = 부정" },
          { en: "Fewer students applied this year.", ko: "올해는 지원 학생이 더 적었어요.", note: "가산의 비교는 fewer" },
        ],
        vsKo: "한국어 '조금'은 '조금 있다(긍정)'와 '조금**밖에** 없다(부정)'를 조사로 가르죠. 영어는 그 일을 **관사 a**가 해요 — a few/a little = '조금 있다', few/little = '조금밖에 없다'. a의 유무 = '-밖에'의 유무라고 매핑해 두면 다시는 안 헷갈려요.",
      },
      {
        heading: "some과 any — 긍정·부정 공식을 넘어서",
        pattern: "some = 있다고 보는 마음 · any = 열어두는 마음",
        patternKo: "권유·부탁은 의문문이라도 some · 긍정문의 any = '아무 ~나'",
        body:
          "교과서 공식 'some은 긍정문, any는 부정·의문문'은 절반만 맞아요. 진짜 기준은 화자의 마음 — **some은 '있다'를 전제**하고, **any는 있는지 없는지를 열어둬요**.\n\n" +
          "그래서 **권유·부탁은 의문문이라도 some** — Would you like **some** coffee?(커피가 있고, 줄 생각이니까) / Can I have **some** water? 그리고 **긍정문의 any는 '아무 ~나'** — Take **any** seat you like(아무 자리나 앉으세요). something/anything/nothing 시리즈도 똑같은 논리로 움직여요.",
        examples: [
          { en: "Would you like some more rice?", ko: "밥 좀 더 드릴까요?", note: "권유 = 의문문이라도 some" },
          { en: "Call me anytime — any day works.", ko: "언제든 전화해요. 아무 날이나 괜찮아요.", note: "긍정문의 any = 아무 ~나" },
          { en: "Is there anything I can do to help?", ko: "제가 도울 수 있는 일이 있을까요?" },
        ],
      },
      {
        heading: "another / other / the other — '다른'의 교통정리",
        pattern: "another + 단수(하나 더) · other + 복수(다른 ~들) · the other(나머지 그것)",
        patternKo: "others = 다른 것들 · the others = 나머지 전부",
        body:
          "**another**는 an+other, 즉 '**또 하나**'라 단수 전용이에요(another cup). **other**는 복수·불가산 앞에(other people). **the가 붙으면 '나머지'로 확정** — 둘 중 하나는 one, 나머지 하나는 **the other**. 명사 없이 단독으로 쓰면 s가 붙어요 — **others**(다른 사람들·것들), **the others**(나머지 전부).\n\n" +
          "나열 공식: one ..., another ...(또 하나), the other(마지막 나머지) — 셋을 차례로 소개할 때의 표준 틀이에요.",
        examples: [
          { en: "This towel is wet — can I get another?", ko: "이 수건 젖었는데 하나 더 주시겠어요?" },
          { en: "I have two brothers. One lives in Seoul, and the other lives in Busan.", ko: "형제가 둘인데, 한 명은 서울, 나머지 한 명은 부산에 살아요." },
          { en: "Some people agreed; others didn't.", ko: "동의한 사람도 있고, 아닌 사람들도 있었어요." },
        ],
        pitfall: "**another books**(×) — another 뒤에 복수를 놓는 게 단골이에요(another book ○). 단, **another three days**처럼 수량 덩어리는 예외적으로 OK — three days를 한 묶음으로 보기 때문이에요. 그리고 막연한 '남들'을 the others로 쓰면 '(특정 집단의) 나머지 전원'이 돼버려요 — 막연하면 **others**입니다.",
      },
      {
        heading: "수일치의 함정 지대 — a number of vs the number of",
        pattern: "A number of + 복수 + 복수동사 ↔ The number of + 복수 + 단수동사",
        patternKo: "동사의 주인은 head noun — of 뒤에 속지 마세요",
        body:
          "**a number of**는 '여러'라는 수식어라 **뒤의 복수 명사가 주어**(복수동사), **the number of**는 '~의 수' 자체가 주어(단수동사)예요 — A number of issues **were** raised. / The number of issues **is** growing.\n\n" +
          "원리는 하나 — **동사의 주인(head noun)을 찾아라**. The increase in exports **was** significant(주어는 increase, exports 아님). each of / neither of / none of + 복수명사도 격식 글에서는 단수동사가 표준이에요(Neither of them **is** ready). **집합명사**(team, family, staff)는 미국식은 단수, 영국식은 의미에 따라 복수도 허용 — The team **is** strong(미) / The team **are** playing well(영).",
        table: {
          caption: "수일치 치트시트",
          headers: ["주어", "동사", "예"],
          rows: [
            ["a number of + 복수", "복수", "A number of questions remain."],
            ["the number of + 복수", "단수", "The number of users is rising."],
            ["each of / neither of + 복수", "단수 (격식)", "Each of the rooms has a view."],
            ["either A or B", "B에 일치", "Either he or I am wrong."],
            ["집합명사 (team, staff)", "미: 단수 · 영: 단·복", "The staff is/are friendly."],
          ],
        },
        examples: [
          { en: "A number of students have complained about the schedule.", ko: "여러 학생이 일정에 대해 항의했어요." },
          { en: "The number of applicants has doubled this year.", ko: "올해 지원자 수가 두 배가 됐어요." },
        ],
        tip: "수일치가 헷갈리면 **of 이하를 손으로 가리세요**. The quality (of the products) is... — 남는 명사에 동사를 맞추면 끝이에요. 이 30초 점검이 라이팅 감점의 절반을 막아줍니다.",
      },
    ],
  },
];

export default chapters;
