/**
 * C2 최상급 — 수사·변이·문화·유머·번역
 * 문법의 끝에서 시작하는 언어의 교양. 영어를 '도구'에서 '세계'로 확장하는 마지막 다섯 챕터예요.
 */
export default [
  {
    slug: "c2-01-style-rhetoric",
    level: "C2",
    order: 1,
    title: "명연설은 왜 꼭 셋으로 말할까",
    topic: "수사 기법·삼항/두운",
    titleFr: "Style and Rhetoric",
    summary: "삼항 구조, 두운, understatement — 위대한 영어 연설과 에세이를 움직이는 설계 원리를 분해해요. 알고 들으면 모든 명연설이 다르게 들립니다.",
    duration: "약 11분",
    sections: [
      {
        heading: "수사학 — 영어 글쓰기의 보이지 않는 교과과정",
        pattern: "tricolon(삼항) · alliteration(두운) · understatement(절제)",
        patternKo: "목표는 송신이 아니라 수신 감도",
        body:
          "영미권 교육에는 한국 교육과정에 없는 과목이 숨어 있어요 — 그리스·로마에서 내려온 **수사학(rhetoric)**. 에세이, 디베이트, 졸업 연설 문화가 전부 이 전통 위에 서 있죠.\n\n" +
          "C2에서 수사를 배우는 이유는 연설가가 되기 위해서가 아니라 **수신 감도**를 올리기 위해서예요. 사설, TED 강연, 광고 카피 — 영어 담화의 고급 영역은 전부 수사 장치로 직조되어 있어서, 장치가 보여야 글쓴이의 의도와 솜씨가 보입니다.\n\n" +
          "이 챕터에서는 **삼항 구조(tricolon), 두운(alliteration), 절제 표현(understatement)**을 깊게 파고, 마지막에 대구(antithesis)와 반복(anaphora)을 묶어 정리해요.",
        examples: [
          { en: "Veni, vidi, vici. — I came, I saw, I conquered.", ko: "왔노라, 보았노라, 이겼노라.", note: "카이사르의 말로 전해지는 라틴어 명구 — 삼항 구조 + 두운의 원형이에요." },
          { en: "Friends, Romans, countrymen, lend me your ears.", ko: "친구들이여, 로마인들이여, 동포들이여, 귀를 빌려주시오.", note: "셰익스피어 「줄리어스 시저」 — 호칭마저 셋으로." },
        ],
        etym: "rhetoric은 그리스어 rhētōr(연설가)에서 왔어요. 고대 그리스에서 수사학은 문법·논리학과 함께 교양 3과(trivium)의 하나였죠. 재미있는 반전 — trivium(세 갈래 길)에서 나온 trivial은 '삼과 따위는 기초'라는 경멸을 거쳐 '사소한'이 됐어요. 수사학의 어휘사 자체가 한 편의 드라마예요.",
      },
      {
        heading: "삼항 구조(tricolon) — 왜 셋이어야 하는가",
        pattern: "A, B, and C — 셋의 규칙, 가장 강한 것을 마지막에",
        patternKo: "of the people, by the people, for the people",
        body:
          "영어 수사의 제1법칙은 **'셋의 규칙(rule of three)'** — 둘은 부족하고 넷은 넘쳐요. 링컨의 government **of the people, by the people, for the people**, 독립선언의 **Life, Liberty and the pursuit of Happiness** — 명연설의 핵심 대목은 어김없이 셋이에요.\n\n" +
          "고급 기술 둘 — **점층(ascending tricolon)**: 마지막을 가장 길고 무겁게 놓아 클라이맥스를 만들기. **세 번째 자리의 배신**: 둘로 패턴을 만들고 세 번째에서 비틀면 유머(He was tall, dark, and unemployed.).",
        examples: [
          { en: "...that government of the people, by the people, for the people, shall not perish from the earth.", ko: "국민의, 국민에 의한, 국민을 위한 정부는 지상에서 사라지지 않으리라는 것을.", note: "링컨, 게티즈버그 연설(1863) — 전치사만 바꾼 완벽한 삼항." },
          { en: "We can not dedicate — we can not consecrate — we can not hallow — this ground.", ko: "우리는 이 땅을 봉헌할 수도, 신성하게 할 수도, 거룩하게 할 수도 없습니다.", note: "같은 연설의 또 다른 삼항 — 부정의 반복으로 무게를 쌓아요." },
          { en: "Tonight, we gather to affirm the greatness of our nation — not because of the height of our skyscrapers, or the power of our military, or the size of our economy.", ko: "오늘 밤 우리는 우리나라의 위대함을 확인하러 모였습니다 — 그 위대함은 마천루의 높이도, 군사력도, 경제 규모도 아닙니다.", note: "오바마, 2004년 전당대회 기조연설 — 부정 삼항으로 진짜 답을 예고." },
          { en: "Our new app is fast, simple, and secure.", ko: "우리의 새 앱은 빠르고, 간단하고, 안전합니다.", note: "수사는 멀리 있지 않아요 — 모든 제품 소개 슬라이드가 삼항이에요." },
        ],
        tip: "실전 영어 발표에서 가장 가성비 좋은 수사가 삼항이에요. 형용사든 명사구든 절이든, 핵심 메시지를 셋으로 묶고 가장 강한 것을 마지막에 놓으세요. 둘밖에 없으면 하나를 쪼개서라도 셋을 만드는 게 연설문 작가들의 공공연한 비밀입니다.",
      },
      {
        heading: "두운(alliteration) — 소리로 묶는 기억",
        pattern: "safe and sound · last but not least — 첫소리 맞추기",
        patternKo: "같은 첫소리 3회 이상 = 우연이 아니라 설계",
        body:
          "**두운(alliteration)**은 단어 첫소리를 맞추는 기법으로, 영어에서는 **속담, 브랜드, 헤드라인, 연설**까지 어디에나 깔려 있어요 — busy as a bee, last but not least, safe and sound, 그리고 Coca-Cola, PayPal, Krispy Kreme.\n\n" +
          "첫소리가 맞으면 **기억 부담이 줄고 한 묶음이라는 느낌**이 생겨요. 처칠과 킹은 이 효과를 연설의 격조로 끌어올렸죠. 다만 송신은 절제가 필요해요 — 격식 문서에서 과한 두운은 광고 카피처럼 들립니다.",
        examples: [
          { en: "I have a dream that my four little children will one day live in a nation where they will not be judged by the color of their skin but by the content of their character.", ko: "나에게는 꿈이 있습니다. 내 네 아이가 언젠가 피부색(color)이 아니라 인격의 내용(content of their character)으로 평가받는 나라에 사는 꿈입니다.", note: "마틴 루서 킹, 「I Have a Dream」(1963) — color/content/character의 c 두운이 대조를 묶어요." },
          { en: "Let us go forth to lead the land we love.", ko: "우리가 사랑하는 이 땅을 이끌기 위해 나아갑시다.", note: "케네디 취임 연설(1961) — l 두운 네 번." },
          { en: "Last but not least, I'd like to thank my parents.", ko: "마지막이지만 결코 가볍지 않은 감사를 부모님께 전합니다.", note: "수상 소감의 만국 공통 공식 — l 두운 화석." },
        ],
        vsKo: "한국어 수사는 첫소리보다 **어미와 통사 구조의 반복**(대구, '-느냐'의 반복 등)으로 리듬을 만들어요. '소리 맞추기'가 격조가 된다는 감각 자체가 낯설죠. 그래서 한국 학습자는 두운을 '우연'으로 흘려듣기 쉬워요 — 영어 연설에서 같은 첫소리가 세 번 이상 들리면 우연이 아니라 설계라고 보시면 됩니다.",
      },
      {
        heading: "Understatement — 줄여 말하는 것의 힘",
        pattern: "not bad = 꽤 좋다 — 부정의 부정(litotes)",
        patternKo: "절제 문화권에서는 액면가에서 한두 단계 올려 듣기",
        body:
          "**Understatement(절제 표현)**는 실제보다 일부러 약하게 말하는 기법 — 핵심은 **여유의 과시**예요. 아폴로 13호 폭발 직후의 보고 **Houston, we've had a problem**처럼, 큰일 앞에서 작게 말하는 사람은 그 일을 감당할 수 있다는 인상을 주죠. 문법 장치로는 **완서법(litotes)** — not bad(꽤 좋다), not uncommon(흔하다), no small achievement(대단한 성취).\n\n" +
          "수신 주의보 — 영국인의 not too bad는 '꽤 좋다', a bit disappointing은 '심각하게 나쁘다'일 수 있어요. 절제 표현 문화권에서는 **말의 액면가에서 한두 단계 올려 들어야** 합니다.",
        examples: [
          { en: "Houston, we've had a problem.", ko: "휴스턴, 문제가 좀 생겼다.", note: "아폴로 13호(1970) 실제 교신 — 폭발 직후의 절제. 영화 제목은 we have a problem으로 바뀌었어요." },
          { en: "It's just a scratch.", ko: "그냥 긁힌 거야.", note: "몬티 파이선 영화의 팔 잘린 기사 대사로 유명해진, 영국식 절제의 희화화." },
          { en: "The exam didn't go entirely to plan.", ko: "시험이 계획대로만 흘러가진 않았어.", note: "= 망했다. 완서법의 일상 버전." },
          { en: "Securing this contract was no small feat.", ko: "이 계약을 따낸 것은 작지 않은 업적이었다.", note: "litotes — 격식문에서 칭찬의 격을 올리는 장치." },
        ],
        pitfall: "한국 학습자는 절제 표현을 액면 그대로 듣는 사고가 잦아요. 영국인 상사의 I have a few small concerns(작은 우려가 몇 가지)는 '대체로 괜찮다'가 아니라 '심각한 문제가 있다'일 가능성이 높아요. 반대로 여러분이 한국식 겸손으로 My English is poor라고 말하면, 절제 문화권에서는 겸손이 아니라 사실 보고로 들립니다 — 겸손하고 싶다면 I'm still working on my English 정도가 안전해요.",
      },
      {
        heading: "대구와 반복 — antithesis, anaphora, 그리고 리듬",
        pattern: "대구: Ask not A — ask B · 수구 반복: We shall fight ..., we shall fight ...",
        patternKo: "공통 원리 = 평행 구조(parallelism)",
        body:
          "**대구(antithesis)**는 반대 개념을 평행 구조에 나란히 놓아 충돌시켜요 — 케네디의 **Ask not what your country can do for you — ask what you can do for your country**. **수구 반복(anaphora)**은 문장 첫머리를 반복해 파도를 만들어요 — 처칠의 we shall fight 연속, 킹의 I have a dream 연속.\n\n" +
          "공통 원리는 **평행 구조(parallelism)** — 같은 문법 틀을 반복하면 내용의 차이가 도드라져요. 이력서 불릿을 모두 동사원형으로 시작하는 것도 평행 구조의 실무 응용입니다.",
        examples: [
          { en: "Ask not what your country can do for you — ask what you can do for your country.", ko: "조국이 여러분을 위해 무엇을 할 수 있는지 묻지 말고, 여러분이 조국을 위해 무엇을 할 수 있는지 물으십시오.", note: "케네디 취임 연설(1961) — 대구(antithesis)의 표준 예문." },
          { en: "We shall fight on the beaches, we shall fight on the landing grounds, we shall fight in the fields and in the streets, we shall fight in the hills; we shall never surrender.", ko: "우리는 해변에서 싸울 것이고, 상륙지에서 싸울 것이고, 들판과 거리에서 싸울 것이고, 언덕에서 싸울 것입니다. 우리는 결코 항복하지 않을 것입니다.", note: "처칠(1940) — we shall의 수구 반복이 결의를 쌓아 올려요." },
          { en: "It was the best of times, it was the worst of times.", ko: "최고의 시절이자 최악의 시절이었다.", note: "디킨스 「두 도시 이야기」 첫 문장 — 반복과 대구가 한 몸이 된 영문학 최고의 오프닝." },
          { en: "Designed in California. Assembled in China.", ko: "캘리포니아에서 설계. 중국에서 조립.", note: "애플 제품 문구 — 평행 구조는 광고 카피에서도 일합니다." },
        ],
        tip: "명연설 낭독은 C2 학습법으로 과소평가되어 있어요. 게티즈버그 연설(272단어)과 킹의 「I Have a Dream」 후반부를 소리 내어 외워보세요. 삼항, 두운, 반복이 혀와 귀에 새겨지면, 여러분의 영어 문장 감각 자체의 기준선이 올라갑니다.",
      },
    ],
  },

  {
    slug: "c2-02-varieties",
    level: "C2",
    order: 2,
    title: "\"지우개 있어?\"가 위험한 나라",
    topic: "영어 변이·세계 영어",
    titleFr: "Varieties of English",
    summary: "영국·미국·호주, 그리고 세계의 영어들. 발음·어휘·문법의 갈림길을 정리하고, 모어 화자보다 비모어 화자가 많은 lingua franca 시대의 영어관을 세워요.",
    duration: "약 11분",
    sections: [
      {
        heading: "표준은 하나가 아니다 — 영어라는 군도",
        pattern: "내심원(모어) → 외심원(공용어) → 확장원(외국어 학습)",
        patternKo: "목표 = 변이는 넓게 수신, 자기 영어는 하나로 일관",
        body:
          "'정확한 영어'라는 질문에는 함정이 있어요 — **어느 영어요?** 영어는 단일한 산이 아니라 군도예요. Kachru의 **동심원 모델**로 보면 내심원(영국·미국·호주), 외심원(인도·싱가포르), 확장원(한국·일본) — 핵심 통찰은 외심원·확장원 화자가 내심원보다 **압도적으로 많다**는 것이에요.\n\n" +
          "그러니 C2의 목표는 '어느 한 표준의 완벽한 모사'가 아니라, **변이를 알아듣고, 자신은 일관된 하나를 구사하는 것**이에요.",
        examples: [
          { en: "I'll ring you tonight. (BrE) / I'll call you tonight. (AmE)", ko: "오늘 밤 전화할게.", note: "둘 다 표준 — '맞는 쪽'은 없어요." },
          { en: "The team are playing well. (BrE) / The team is playing well. (AmE)", ko: "팀이 경기를 잘하고 있다.", note: "집합명사 수일치까지 갈라져요 — 영국은 구성원들로, 미국은 한 단위로 봐요." },
        ],
        tip: "한국 영어 교육은 사실상 미국 영어 기반이에요(발음 기호, 교과서, 시험). 그게 여러분의 기본값이라는 걸 인지하고 있으면, 영국 드라마나 호주 동료의 영어가 '틀린' 게 아니라 '다른' 것으로 들리기 시작합니다.",
      },
      {
        heading: "영국 vs 미국 ① — 어휘와 철자",
        pattern: "colour/color · centre/center · -ise/-ize · flat/apartment",
        patternKo: "철자는 한 문서 안에서 반드시 통일",
        body:
          "가장 체감 큰 차이는 어휘 — 같은 사물에 다른 단어를 쓰거나, 더 위험하게는 **같은 단어가 다른 뜻**이에요. **chips**(영국 감자튀김/미국 감자칩), **first floor**(영국 2층/미국 1층), **pants**(영국 속옷/미국 바지 — 런던에서 I like your pants는 사고!).\n\n" +
          "철자는 규칙적으로 갈라져요: **-our/-or, -re/-er, -ise/-ize, -ll-/-l-**. 미국 철자의 상당수는 사전 편찬자 노아 웹스터가 19세기에 의도적으로 단순화한 결과 — 철자 차이가 사실 한 사람의 작품인 셈이죠.",
        table: {
          caption: "영국 vs 미국 어휘 — 고빈도 갈림길",
          headers: ["의미", "영국 (BrE)", "미국 (AmE)"],
          rows: [
            ["아파트", "flat", "apartment"],
            ["엘리베이터", "lift", "elevator"],
            ["가을", "autumn", "fall"],
            ["휴가", "holiday", "vacation"],
            ["줄 (대기)", "queue", "line"],
            ["감자튀김", "chips", "fries"],
            ["과자 (단 비스킷)", "biscuit", "cookie"],
            ["축구", "football", "soccer"],
            ["지하철", "the Underground / the Tube", "the subway"],
            ["쓰레기", "rubbish", "garbage / trash"],
            ["바지", "trousers", "pants"],
            ["고무지우개", "rubber", "eraser (rubber는 속어로 콘돔!)"],
          ],
        },
        examples: [
          { en: "Do you have a rubber? (BrE: 지우개 / AmE: 콘돔)", ko: "지우개 있어요? — 미국 교실에서 말하면 폭소가 터지는 문장.", note: "변이 함정의 전설적 예." },
          { en: "The lift is broken, so take the stairs to the first floor.", ko: "엘리베이터가 고장이니 계단으로 2층까지 가세요.", note: "영국 first floor = 한국·미국의 2층. 약속 장소 사고 1순위." },
        ],
        pitfall: "어휘를 영·미 혼합으로 쓰는 것 자체는 큰 흠이 아니지만, **철자는 한 문서 안에서 반드시 통일**하세요. colour와 color가 한 보고서에 공존하면 교정 안 본 티가 확 나요. 워드프로세서 언어 설정을 English (US)든 (UK)든 하나로 고정하는 게 가장 쉬운 해결책이에요.",
      },
      {
        heading: "영국 vs 미국 ② — 문법과 발음의 갈림길",
        pattern: "I've just eaten.(BrE) = I just ate.(AmE) · gotten = AmE",
        patternKo: "r 발음(rhotic) = 미국 · t의 'ㄹ'화(워러) = 미국",
        body:
          "문법 차이 — **현재완료의 영토**(영국 I've just eaten. / 미국 I just ate.), **got의 분화**(미국만 gotten), **전치사 취향**(at/on the weekend, in (the) hospital, to/through Friday). 둘 다 표준이에요.\n\n" +
          "발음의 양대 갈림길 — **r의 운명**: 미국은 car의 r을 발음(rhotic), 잉글랜드 남부 표준은 발음하지 않아요. **t의 운명**: 미국은 water의 t가 부드러운 'ㄹ'(flap)이 돼 '워러', 영국은 t를 또렷이 지켜요. 한국에서 '워러/베러'로 익힌 발음은 미국식이라는 뜻이에요.",
        examples: [
          { en: "Have you eaten yet? (BrE 선호) / Did you eat yet? (AmE 구어)", ko: "밥 먹었어?", note: "미국 구어의 단순과거 — 시험 영작에서는 현재완료가 안전해요." },
          { en: "Your English has gotten much better. (AmE) / has got much better. (BrE)", ko: "네 영어 정말 많이 늘었다.", note: "gotten은 미국에 남은 옛 형태 — 사실 셰익스피어 시대 영어의 화석이에요." },
          { en: "I'll see you at the weekend. (BrE) / on the weekend. (AmE)", ko: "주말에 보자.", note: "전치사는 논리가 아니라 방언 — 둘 다 외울 필요 없이 한쪽만 일관되게." },
        ],
        etym: "'미국 영어가 영어를 망쳤다'는 통념은 역사적으로 부정확해요. gotten, fall(가을), I guess(~인 것 같아)는 모두 17세기 영국 이주민이 가져간 **당시의 표준 영어**예요. 영국 본토가 변하는 동안 식민지가 옛 형태를 보존한 거죠 — 언어학에서 말하는 '주변부의 보수성'이에요. 제주 방언에 중세 한국어 흔적이 남은 것과 같은 원리입니다.",
      },
      {
        heading: "호주, 그리고 세계의 영어들 — lingua franca 시대",
        pattern: "ELF 시대 — 원어민스러운 관용구보다 명료성",
        patternKo: "호주 arvo·barbie · 인도 prepone · 싱가포르 lah",
        body:
          "**호주 영어**는 모음이 독특하고(today가 to-die처럼) **줄임말 사랑**이 유명해요 — arvo(afternoon), brekkie(breakfast), barbie(barbecue). **외심원의 영어들**은 '서툰 영어'가 아니라 자체 규범을 가진 변종이에요 — 인도 영어의 prepone(앞당기다), 싱가포르 영어의 문말 첨사 lah.\n\n" +
          "가장 중요한 현실은 **lingua franca로서의 영어(ELF)** — 오늘날 영어 대화의 다수파는 비모어 화자끼리예요. 이 환경에서 통하는 조건은 원어민스러운 관용구가 아니라 **명료성**이에요. 역설적이게도 ELF 환경에서는 관용구 범벅의 원어민이 가장 알아듣기 어려운 화자가 되곤 합니다.",
        examples: [
          { en: "G'day mate, see you this arvo at the barbie.", ko: "안녕 친구, 오늘 오후에 바비큐에서 보자.", note: "호주 영어 풀코스 — arvo(오후), barbie(바비큐)." },
          { en: "Can we prepone the meeting to Tuesday?", ko: "회의를 화요일로 앞당길 수 있을까요?", note: "인도 영어의 신조어 prepone — 인도 비즈니스 맥락에서는 완전한 표준이에요." },
          { en: "Let me rephrase that — by 'table the motion', I mean let's discuss it now.", ko: "다시 말씀드릴게요 — 'table the motion'은 지금 논의하자는 뜻입니다.", note: "table은 영국에서 '상정하다', 미국에서 '보류하다' — 정반대! 국제회의에서는 풀어 말하는 게 ELF의 매너." },
        ],
        vsKo: "한국어에도 변이는 있지만(서울/경상/제주), 표준어의 구심력이 압도적이라 '복수 표준'이라는 개념이 낯설어요. 영어에는 **표준이 여러 개**예요 — 영국 BBC 영어와 미국 네트워크 영어는 동급의 표준이고, 어느 쪽도 상대를 교정할 권위가 없어요. '원어민처럼'이라는 목표 자체가 '어느 원어민?'이라는 반문 앞에서 흔들리는 이유이고, 그래서 C2의 목표는 모사가 아니라 **명료하고 일관된 자기 영어**입니다.",
      },
    ],
  },

  {
    slug: "c2-03-cultural-allusion",
    level: "C2",
    order: 3,
    title: "헤드라인 절반은 3천 년 전 이야기",
    topic: "문화적 암시·고전 인용",
    titleFr: "Cultural Allusion",
    summary: "Achilles' heel, catch-22, good Samaritan — 영어 담화의 뼈대에는 세 개의 고전 지층이 깔려 있어요. 이 레퍼런스를 모르면 뉴스 헤드라인의 절반이 절반만 읽힙니다.",
    duration: "약 12분",
    sections: [
      {
        heading: "암시(allusion) — 영어 화자들의 공유 메모리",
        pattern: "3대 지층: 그리스 신화 → 성경(KJV) → 셰익스피어",
        patternKo: "고사성어처럼 — 표현 + 배경 이야기를 세트로",
        body:
          "C2 독해의 마지막 벽은 **문화적 암시(cultural allusion)**예요 — 모든 단어를 알아도 David and Goliath battle이라는 헤드라인의 맛은 다윗 이야기를 알아야 살아나죠. 영어권의 공유 메모리는 **그리스·로마 신화, 성경(특히 킹 제임스 성경), 셰익스피어**의 세 지층이에요 — 무신론자도, 셰익스피어를 안 읽은 사람도 일상 어휘로 쓰는 **언어의 기반암**이죠.\n\n" +
          "한국어로 비유하면 '사면초가', '계륵' 같은 고사성어의 자리예요. 학습 전략도 같아요 — **표현과 배경 이야기를 세트로** 외우면 잊히지 않습니다.",
        examples: [
          { en: "The startup's lawsuit against the tech giant is a real David and Goliath story.", ko: "그 스타트업이 거대 IT 기업을 상대로 낸 소송은 그야말로 다윗과 골리앗 싸움이다.", note: "약자 vs 거인 — 그리고 이 표현에는 '약자가 이길지도 모른다'는 기대까지 실려 있어요." },
          { en: "Reading the article without the references is like watching a movie with half the screen covered.", ko: "레퍼런스 없이 그 기사를 읽는 건 화면 절반을 가리고 영화를 보는 것과 같아요.", note: "이 챕터의 존재 이유." },
        ],
        vsKo: "한국어 담화의 공유 메모리가 한문 고전 + 한국사(이순신, 세종)에서 온다면, 영어는 그리스 신화 + 성경 + 셰익스피어예요. 흥미로운 건 기능이 똑같다는 것 — '트로이 목마'와 '사면초가'는 둘 다 '고전 군사 고사에서 온 압축 표현'이죠. 여러분이 고사성어를 다루는 그 감각을 그대로 가져오면 됩니다.",
      },
      {
        heading: "성경에서 온 표현 — 무신론자도 쓰는 어휘",
        pattern: "good Samaritan · the writing on the wall · scapegoat · prodigal son",
        body:
          "성경 표현은 영어에 가장 넓게 퍼진 지층 — 종교색은 증발하고 어휘만 남았어요. **good Samaritan**(곤경의 낯선 이를 돕는 사람 — Good Samaritan law로 제도화), **the writing on the wall**(임박한 몰락의 징조 — 경제 기사 단골), **prodigal son**(떠났다 돌아온 사람), **scapegoat**(희생양).\n\n" +
          "**forbidden fruit, salt of the earth, go the extra mile**도 전부 성경 출신이에요.",
        examples: [
          { en: "A good Samaritan pulled the driver from the burning car.", ko: "한 의로운 행인이 불타는 차에서 운전자를 끌어냈다.", note: "뉴스에서 '익명의 구조자'를 부르는 표준 표현." },
          { en: "The CEO ignored the writing on the wall and kept expanding.", ko: "CEO는 명백한 몰락의 징조를 무시하고 확장을 계속했다.", note: "다니엘서 5장 출신 — 경제 기사에서 '파산 직전 징후'의 관용 표현." },
          { en: "He became the scapegoat for the entire department's failure.", ko: "그는 부서 전체의 실패에 대한 희생양이 되었다.", note: "한국어 '희생양'도 같은 성경 번역에서 온 말 — 드물게 완전히 겹치는 경우예요." },
          { en: "The prodigal son returns: Son Heung-min back at his boyhood club.", ko: "돌아온 탕아: 손흥민, 유년 시절의 클럽으로 복귀.", note: "스포츠 헤드라인의 전형적 활용 — 비난이 아니라 애정 어린 환영의 뉘앙스." },
        ],
        etym: "1611년의 킹 제임스 성경(King James Version)은 셰익스피어와 함께 근대 영어의 두 주형(틀)이에요. by the skin of one's teeth(간신히), a drop in the bucket(새 발의 피), no rest for the wicked — 전부 이 번역본의 문장이 그대로 관용구가 된 경우예요. 영어 관용구의 출처를 찾다 보면 절반은 KJV 아니면 셰익스피어에 닿습니다.",
      },
      {
        heading: "셰익스피어 — 일상 회화 속의 400년 전 대사",
        pattern: "break the ice · wild-goose chase · pound of flesh · green-eyed monster",
        body:
          "셰익스피어는 '읽는 고전'이기 전에 **현대 영어 어휘의 공장**이에요 — **break the ice**(「말괄량이 길들이기」), **wild-goose chase**(「로미오와 줄리엣」), **the green-eyed monster**(질투, 「오셀로」 — 영어에서 질투의 색이 초록인 이유), **pound of flesh**(「베니스의 상인」), in a pickle, heart of gold까지.\n\n" +
          "대사 자체가 관용구가 된 경우도 있어요 — **To be or not to be**는 패러디의 만능 틀(To buy or not to buy...), **star-crossed lovers**, **All the world's a stage**도 인용 단골이에요.",
        examples: [
          { en: "Let's play a quick game to break the ice.", ko: "어색함도 풀 겸 간단한 게임부터 할까요.", note: "「말괄량이 길들이기」 출신 — 워크숍 진행자의 필수 어휘." },
          { en: "The investors are demanding their pound of flesh.", ko: "투자자들이 가혹하리만치 자기 몫을 요구하고 있다.", note: "「베니스의 상인」 — '법적으론 정당하나 잔인한 요구'라는 뉘앙스까지 운반해요." },
          { en: "Searching for the original file turned into a wild-goose chase.", ko: "원본 파일 찾기는 부질없는 헛수고가 되어버렸다.", note: "「로미오와 줄리엣」 출신의 일상어." },
          { en: "Beware the green-eyed monster — don't let envy ruin your friendship.", ko: "질투라는 초록 눈의 괴물을 조심해 — 시기심이 우정을 망치게 두지 마.", note: "「오셀로」 — green with envy(질투로 새파래진)도 같은 뿌리." },
        ],
        tip: "셰익스피어 원전 독파는 원어민에게도 고행이에요. 가성비 좋은 경로는 ① 표현 → 출처 희곡 → 줄거리 요약 순서로 역추적하고, ② 현대어 자막이 달린 영화판(「로미오+줄리엣」, 「햄릿」)으로 이야기를 채우는 거예요. 표현 20개와 희곡 5편의 줄거리만 알아도 인용의 90%가 잡힙니다.",
      },
      {
        heading: "그리스 신화 — Achilles' heel에서 Pandora's box까지",
        pattern: "Achilles' heel · Pandora's box · Trojan horse · Sisyphean task",
        body:
          "가장 오래된 지층, 그리스 신화 — **Achilles' heel**(치명적 약점, 한국어에도 있어 무료 항목), **Pandora's box**(한번 열면 닫을 수 없는 재앙), **Trojan horse**(내부의 숨은 위협 — 컴퓨터 바이러스로 제2의 인생), **Midas touch**(닿는 것마다 황금), **Sisyphean**(끝없이 반복되는 헛수고).\n\n" +
          "신화가 보통명사가 된 경우도 많아요 — odyssey(긴 여정), herculean(초인적인), mentor(오디세우스 아들의 스승 이름!).",
        examples: [
          { en: "Customer data security has become the company's Achilles' heel.", ko: "고객 데이터 보안이 그 회사의 아킬레스건이 되었다.", note: "한국어와 완전히 겹치는 표현 — 일본 번역을 거쳐 들어온 같은 신화 유산이에요." },
          { en: "Easing the regulation could open a Pandora's box of fraud.", ko: "규제 완화는 사기라는 판도라의 상자를 열 수 있다.", note: "'연쇄적이고 회수 불가능한 부작용'의 압축 표현." },
          { en: "Updating the legacy codebase is a Sisyphean task.", ko: "그 레거시 코드베이스 업데이트는 시시포스의 형벌 같은 일이야.", note: "굴려 올리면 다시 굴러떨어지는 바위 — 개발자 유머의 단골." },
          { en: "She has the Midas touch — every product she launches becomes a hit.", ko: "그녀는 미다스의 손이야 — 출시하는 제품마다 히트를 친다니까.", note: "원래 신화에서는 저주였지만, 현대 용법은 거의 칭찬이에요." },
        ],
        etym: "신화는 어휘의 뿌리이기도 해요. panic은 목신 판(Pan)이 일으키는 공포에서, narcissism은 물에 비친 자신과 사랑에 빠진 나르키소스에서, echo는 목소리만 남은 님프 에코에서 왔어요. tantalize(애태우다)는 눈앞의 물과 과일에 영원히 닿지 못하는 탄탈로스의 형벌이고요. 단어 하나에 이야기 하나 — C2 어휘 암기의 최고급 연료입니다.",
      },
      {
        heading: "현대의 고전 — catch-22, Orwellian, Kafkaesque",
        pattern: "catch-22(순환 굴레) · Orwellian(감시·통제) · Kafkaesque(관료제 악몽)",
        patternKo: "충분히 수신해본 표현만 송신",
        body:
          "암시의 지층은 지금도 쌓여요 — **catch-22**(헬러, 1961: 조건이 서로를 잠그는 진퇴양난 — '경력이 없으면 취직이 안 되는데, 취직을 못 하면 경력이 안 쌓인다'), **Orwellian**(「1984」: 감시·검열·언어 조작의 전체주의 — Big Brother, doublethink도 같은 출신), **Kafkaesque**(이유도 출구도 없는 관료제의 미로).\n\n" +
          "그 밖에 **Jekyll and Hyde**(이중인격), **Frankenstein('s monster)**(창조자를 삼키는 피조물), **Brave New World**도 헤드라인 단골입니다.",
        examples: [
          { en: "You need experience to get a job, but you need a job to get experience — a classic catch-22.", ko: "취직하려면 경력이 필요한데, 경력을 쌓으려면 취직을 해야 해 — 전형적인 캐치-22지.", note: "헬러의 소설 「Catch-22」(1961)에서 — 신입 구직자의 만국 공통 한탄." },
          { en: "Critics called the new surveillance law Orwellian.", ko: "비판자들은 새 감시법을 오웰적이라고 불렀다.", note: "「1984」 한 권이 형용사가 된 경우 — 정치 기사 최고 빈도의 문학 암시." },
          { en: "Renewing my visa turned into a Kafkaesque ordeal of offices sending me back to each other.", ko: "비자 갱신은 부서들이 서로에게 떠넘기는 카프카적 악몽이 되었다.", note: "관료제 비판의 표준 형용사." },
          { en: "The medication turned him into a Jekyll and Hyde.", ko: "그 약은 그를 지킬과 하이드 같은 사람으로 바꿔놓았다.", note: "스티븐슨의 소설(1886) — '예측 불가능한 이중성'의 관용 표현." },
        ],
        pitfall: "암시는 송신 난도가 가장 높은 어휘예요. 뉘앙스의 결을 모르고 쓰면 바로 어긋나요 — Orwellian은 '감시·통제'에만 쓰지 단순히 '나쁜 정부'에 쓰면 어색하고, prodigal son은 '방탕했다 돌아온'이지 단순 '귀환'이 아니에요. catch-22도 '어려운 상황'이 아니라 '조건이 서로를 잠그는 순환 구조'에만 써야 해요. 원칙은 관용구와 같아요 — 충분히 수신해본 표현만 송신하세요.",
      },
    ],
  },

  {
    slug: "c2-04-humor-irony",
    level: "C2",
    order: 4,
    title: "\"Yeah, right\"은 칭찬이 아니다",
    topic: "유머·아이러니·언어유희",
    titleFr: "Humor, Irony, and Wordplay",
    summary: "sarcasm은 언제 무례가 아닌가, deadpan은 어떻게 알아채나, pun은 왜 신음을 부르나 — 영어 유머의 사회적 코드를 해독해요. C2의 진짜 최종 관문입니다.",
    duration: "약 11분",
    sections: [
      {
        heading: "아이러니와 sarcasm — 말과 뜻이 반대인 문장들",
        pattern: "irony = 말 ↔ 뜻 반대 · sarcasm = 표적 있는 아이러니",
        patternKo: "Oh, great. · Yeah, right. = 거의 항상 반어",
        body:
          "**언어적 아이러니(verbal irony)**는 말과 의도가 반대인 것 — 폭우 속의 Lovely weather! **sarcasm(빈정거림)**은 그중 **표적을 겨냥한** 아이러니예요. 모든 sarcasm은 아이러니지만 역은 아니에요 — 표적과 가시가 갈림길이죠.\n\n" +
          "알아채는 신호는 **과장된 긍정 어휘 + 평탄하거나 늘어진 억양 + 맥락 불일치**예요. Oh, great. / Yeah, right. / Good luck with that.은 **문자 그대로 쓰이는 일이 거의 없는** 굳은 sarcasm — 미드의 웃음 포인트를 놓친다면 십중팔구 여기서 새고 있는 겁니다.",
        examples: [
          { en: "Oh great, another Monday meeting that could have been an email.", ko: "아주 좋~네, 이메일이면 됐을 월요일 회의가 또 잡혔어.", note: "great의 문자 의미는 0% — 직장 sarcasm의 표준형." },
          { en: "A: I'll pay you back next week, I promise. — B: Yeah, right.", ko: "A: 다음 주에 꼭 갚을게, 약속해. — B: 퍽이나 그러겠다.", note: "yes+right 두 긍정어가 합쳐져 강한 불신이 되는 굳은 표현." },
          { en: "Well, that went well.", ko: "허, 아주 잘~ 풀렸네.", note: "발표를 망친 직후에 — 짧을수록 강한 영어 아이러니의 전형." },
        ],
        vsKo: "한국어에도 반어는 있죠 — '잘~한다', '퍽이나'. 하지만 운용 범위가 달라요. 한국어 반어는 주로 가까운 사이의 핀잔에 머무는 반면, 영어(특히 영국) 담화에서 sarcasm은 **사교의 기본 양념**이라 첫 만남의 스몰토크, 회의, 방송 인터뷰에까지 등장해요. 한국 감각으로는 '처음 본 사람이 왜 나를 놀리지?' 싶은 순간이, 그쪽 문화에서는 '너를 농담 상대로 인정한다'는 호의 신호일 수 있어요.",
      },
      {
        heading: "deadpan과 영국식 유머 — 웃지 않고 웃기기",
        pattern: "영국식 삼합 = deadpan + understatement + 자기비하",
        patternKo: "banter는 정색이 아니라 받아치는 게 정답",
        body:
          "**deadpan**은 무표정(dead + pan, pan은 얼굴의 속어)으로 농담해 청자가 스스로 '농담이구나'를 발견하게 만드는 기술이에요. 영국 유머는 deadpan + **understatement** + **자기비하(self-deprecation)**의 삼합 — 자기비하는 겸손이라기보다 **'나는 나를 농담거리로 삼을 만큼 여유 있다'는 사회적 신호**예요.\n\n" +
          "**banter**는 친한 사이의 가벼운 놀림 핑퐁 — 영국·호주 문화에서 우정의 통화(currency)예요. 놀림을 받으면 **받아치는 것**이 정답이고, 받아치는 순간 관계가 한 단계 가까워져요.",
        examples: [
          { en: "A: How was your blind date? — B: Well, the restaurant was nice.", ko: "A: 소개팅 어땠어? — B: 음… 식당은 괜찮더라.", note: "deadpan + understatement — 사람에 대한 언급을 비움으로써 모든 걸 말했어요." },
          { en: "I'm not saying I'm bad at cooking, but the smoke alarm cheers me on when I make toast.", ko: "내가 요리를 못한다는 건 아닌데, 토스트만 구우면 화재경보기가 응원을 해주더라고.", note: "자기비하 유머의 전형 — 스몰토크에서 호감을 사는 최고의 기술." },
          { en: "A: Nice haircut. Did you lose a bet? — B: Yeah, and the barber lost his license.", ko: "A: 머리 멋진데? 내기에서 졌냐? — B: 어, 그리고 이발사는 면허를 잃었지.", note: "banter의 정석 — 정색 대신 받아치기. 이 핑퐁이 우정의 신호예요." },
        ],
        pitfall: "한국식 겸손과 영국식 자기비하는 닮았지만 작동이 달라요. 한국에서 '제가 부족해서…'는 상대가 '아니에요'로 받아주는 의례지만, 영어 자기비하는 **웃기려는 농담**이라 정색하고 위로하면 어색해져요. 반대 방향이 더 위험해요 — banter로 놀림을 받았을 때 진지하게 사과하거나 상처받은 티를 내면, '농담이 안 통하는 사람'으로 분류되어 다음부터 대화의 온도가 내려갑니다. 최소 방어는 미소 + Fair enough(인정), 최선의 방어는 받아치기예요.",
      },
      {
        heading: "pun — 신음을 부르는 언어유희",
        pattern: "pun = 한 단어 · 두 의미 — I lost interest.(흥미/이자)",
        patternKo: "정답 반응은 폭소가 아니라 신음(groan)",
        body:
          "**pun**은 한 단어의 두 뜻 또는 비슷한 소리를 충돌시키는 유머예요. 영어가 pun의 천국인 이유는 구조적이에요 — 어휘의 이중 구조에 철자와 소리가 따로 놀아 **동음이의어가 비정상적으로 많거든요**(flour/flower, knight/night).\n\n" +
          "문화 코드: 좋은 pun의 표준 반응은 폭소가 아니라 **신음(groan)** — 한심하다는 듯 끙 소리가 사실상 '인정'이에요. dad joke는 한국 아재개그와 **정확히 같은 사회적 위치**고, pun은 **헤드라인·광고의 기본 기술**이라 수신 능력이 곧 실전 독해력입니다.",
        examples: [
          { en: "I used to be a banker, but I lost interest.", ko: "한때 은행원이었는데, 흥미(이자)를 잃었어.", note: "interest의 이중 의미 — 직업 시리즈 pun의 고전." },
          { en: "Time flies like an arrow; fruit flies like a banana.", ko: "시간은 화살처럼 날아가고, 초파리는 바나나를 좋아한다.", note: "flies(날다/파리들)와 like(처럼/좋아하다)가 두 번 갈라지는 언어학 교과서의 단골 예문." },
          { en: "A bakery sign: 'We knead the dough.'", ko: "빵집 간판: '우리는 반죽을 치댑니다(돈이 필요합니다).'", note: "knead(반죽하다)/need(필요하다) + dough(반죽/돈 속어) — 이중 pun." },
          { en: "A: Want to hear a joke about construction? — B: Sure. — A: Sorry, I'm still working on it.", ko: "A: 건설 농담 들어볼래? — B: 그래. — A: 미안, 아직 공사 중이야.", note: "working on it(작업 중/공사 중) — 전형적 dad joke. 정답 반응은 신음 소리." },
        ],
        etym: "한국 아재개그도 같은 원리예요 — '바나나 먹으면 나한테 반하나?'는 소리 충돌, 영어 pun과 완전히 같은 기계장치죠. 다른 점은 원료예요. 한국어 말장난은 음절 단위 유사음에서, 영어 pun은 동음이의어와 다의어에서 나와요. 언어는 달라도 '아빠들이 하고 아이들이 신음하는' 사회적 코드는 신기할 만큼 똑같습니다.",
      },
      {
        heading: "유머의 사회적 코드 — 언제 웃기고 언제 참나",
        pattern: "안전한 표적 = 상황 · 자기 자신 · 부재 대상 ↔ 위험 = 그 자리의 사람",
        patternKo: "글의 sarcasm은 사고 — 억양이라는 안전핀이 없어요",
        body:
          "**sarcasm의 안전 수칙**: 안전한 표적은 **상황, 자기 자신, 그 자리에 없는 추상적 대상**(월요일, 프린터, 관료제) — 그 자리에 있는 사람은 충분히 가까워지기 전엔 금물이에요. 또 sarcasm은 **글에서 거의 항상 사고**가 나요 — 억양이라는 안전핀이 빠지니까요.\n\n" +
          "영어권 회의는 농담 허용 온도가 높아서 아이스브레이킹·자기비하가 여유의 신호로 읽히지만, 종교·정치·외모는 강한 금기예요. 농담을 놓쳤을 땐 어색하게 따라 웃는 것보다 Wait, that one flew over my head — explain?이 훨씬 호감을 삽니다.",
        examples: [
          { en: "Ah, the printer is out of toner again. Truly, technology has peaked.", ko: "아, 프린터 토너가 또 떨어졌네. 정말이지 기술이 정점을 찍었어.", note: "안전한 sarcasm — 표적이 사람이 아니라 프린터예요." },
          { en: "Before we start — yes, the demo broke five minutes ago, so this should be exciting.", ko: "시작하기 전에 — 네, 데모가 5분 전에 죽었습니다. 아주 스릴 넘치는 발표가 되겠네요.", note: "위기를 자기비하 유머로 선점 — 영어권 발표 문화의 고급 기술." },
          { en: "Sorry, that joke flew right over my head — can you walk me through it?", ko: "미안, 방금 농담 머리 위로 지나갔어 — 설명 좀 해줄래?", note: "go over one's head(이해 못 하다) — 모르는 걸 유머러스하게 인정하는 표현." },
        ],
        tip: "유머 수신력을 올리는 최고의 교재는 시트콤이에요. 미국식은 「The Office(US)」(deadpan + 어색 유머), 「Brooklyn Nine-Nine」(속사포 banter), 영국식은 「The Office(UK)」와 패널 쇼들이 좋아요. 자막으로 한 번, 무자막으로 한 번 — 웃음 트랙이 터지는데 나만 안 웃긴 장면을 수집해서 분해해보세요. 그 간극이 바로 여러분의 다음 학습 목록입니다.",
      },
    ],
  },

  {
    slug: "c2-05-translation",
    level: "C2",
    order: 5,
    title: "'눈치'를 영어로 옮길 수 있을까",
    topic: "한영 번역·등가와 협상",
    titleFr: "The Art of Translation: Korean ↔ English",
    summary: "눈치, 정, 답답하다는 영어로 무엇인가 — 등가 없는 표현, 경어의 번역, 명사의 언어와 동사의 언어. 이 레퍼런스 전체를 관통해온 질문을 마지막으로 정리합니다.",
    duration: "약 12분",
    sections: [
      {
        heading: "번역은 등가 교환이 아니라 협상이다",
        pattern: "번역 = 등가 교환이 아니라 협상 — 어디서 손실을 감수할지 고르기",
        patternKo: "두 언어를 안다 = 두 세계의 환율을 안다",
        body:
          "레퍼런스의 마지막 챕터, 주제는 **번역**이에요. 초급의 번역관은 '단어 = 단어' 교환이지만, 언어는 세계를 **다르게 자르는** 체계라 정확히 겹치는 조각이 없는 경우가 많아요 — '파랗다'는 blue와 green에 걸쳐 있고, mind는 '마음'과 '정신' 사이 어딘가에 있죠.\n\n" +
          "그래서 번역은 **협상**이에요 — 의미를 지키면 리듬을 잃고, 직역하면 뉘앙스를 잃어요. 좋은 번역가는 손실을 없애는 사람이 아니라 **어디서 손실을 감수할지 가장 현명하게 고르는** 사람이고, 이 협상의 감각이야말로 C2의 진짜 능력이에요.",
        examples: [
          { en: "Korean 파랗다 covers both the blue sky and the green light.", ko: "'파랗다'는 파란 하늘과 '파란불'(실제로는 초록)을 모두 덮는다.", note: "색 스펙트럼을 자르는 칼금 자체가 언어마다 달라요." },
          { en: "I'll keep it in mind. — 마음에 새길게요? 명심할게요? 참고할게요?", ko: "mind 하나에 한국어 후보가 셋 — 어느 것도 완전한 등가가 아니에요.", note: "격식·진심의 정도에 따라 협상이 필요한 자리." },
        ],
        etym: "translate는 라틴어 trans(건너로)+latus(운반된), 즉 '건너편으로 옮기기'예요. 5챕터 전에 본 metaphor(meta+pherein, 너머로 나르다)와 완전히 같은 구조죠 — 라틴어와 그리스어로 같은 그림을 그린 단어예요. 번역과 은유는 어원부터 형제입니다: 둘 다 의미를 싣고 강을 건너는 일이에요.",
      },
      {
        heading: "등가 없는 한국어 — 눈치, 정, 답답하다",
        pattern: "눈치 → reading the room · 정 → a bond built over time · 억울하다 → feel wronged",
        patternKo: "번역 불가가 아니라 한 단어 압축이 안 될 뿐",
        body:
          "한국어에는 영어에 한 단어 등가가 없는 어휘들이 있어요 — 번역 불가가 아니라 **한 단어로 압축이 안 될 뿐**이에요. **눈치**는 reading the room이 가깝고 **nunchi라는 차용어로 옥스퍼드 사전에도** 올랐어요. **정(情)**은 '미운 정'이 가능하다는 점에서 love도 affection도 아니고, **답답하다**는 stuffy/frustrating/infuriatingly dense로 쪼개야 하고, **억울하다**는 I feel wronged가 최선의 근사치예요.\n\n" +
          "표의 '협상 포인트'까지 함께 보세요 — 같은 단어도 맥락에 따라 번역이 갈라집니다.",
        table: {
          caption: "등가 없는 한국어 — 번역 협상 카드",
          headers: ["한국어", "최선의 근사치", "협상 포인트"],
          rows: [
            ["눈치", "reading the room / social awareness / (차용) nunchi", "'보다'(위축)와 '빠르다'(능력)는 별도 번역"],
            ["정(情)", "a bond built over time / attachment", "'미운 정'은 영어 개념 체계에 없음 — 풀어 설명 필수"],
            ["답답하다", "frustrated / stifled / stuffy", "물리·심리·대인 중 어느 답답함인지 먼저 판별"],
            ["억울하다", "feel wronged / it's so unfair", "'알아주지 않음'의 호소가 핵심 — unfair만으론 부족"],
            ["아깝다", "what a waste / too good to waste / so close!", "아까운 대상(돈·사람·기회)마다 번역이 갈라짐"],
            ["수고하셨습니다", "Great work today / Thanks for your hard work", "직역 불가 — 기능(노고 인정 인사)으로 번역"],
          ],
        },
        examples: [
          { en: "He has no nunchi — he kept joking while the boss was clearly upset.", ko: "걔는 눈치가 없어 — 상사 기분이 안 좋은 게 뻔히 보이는데 계속 농담하더라.", note: "nunchi는 2019년 무렵부터 영어 매체에 차용어로 정착 중 — kimchi, chaebol의 길을 걷고 있어요." },
          { en: "It's not love exactly — it's jeong, the bond that grows even through fighting.", ko: "정확히 사랑은 아니야 — 정이지. 싸우면서도 쌓이는 그런 유대.", note: "설명을 데리고 다니는 차용 — 등가 없는 단어의 표준 처리법." },
          { en: "Talking to him is so frustrating — it's like hitting a wall.", ko: "걔랑 얘기하면 진짜 답답해 — 벽에 대고 말하는 것 같아.", note: "답답하다의 대인 버전 — 영어도 결국 '막힘'의 은유(wall)로 수렴해요." },
        ],
        vsKo: "반대 방향도 있어요 — 한국어에 한 단어 등가가 없는 영어. **privacy**(사생활? 프라이버시 그대로 차용), **accountability**(책임 + 설명 의무 — '책무성'은 번역가들의 고육책), **serendipity**(우연한 행운의 발견), **sibling**(형제자매를 성별 없이) 같은 단어들이죠. 등가 부재는 한국어의 결핍도 영어의 결핍도 아니라, 두 문화가 **다른 것을 한 단어로 압축할 만큼 자주 말해왔다**는 증거예요.",
      },
      {
        heading: "경어의 번역 — 영어에 존댓말이 없다는 거짓말",
        pattern: "한국어 = 어미 경어 ↔ 영어 = 구조 경어 (would/could · 간접화법 · 어휘)",
        patternKo: "Give me that ↔ Would you mind passing me that?",
        body:
          "영어에 없는 건 **문법화된 경어**(어미 변화)일 뿐, 공손함은 헤징·간접화법·라틴계 어휘·호칭으로 정교하게 표현돼요 — Give me that과 Would you mind passing me that? 사이의 거리는 '해'와 '해주시겠어요?' 사이의 거리와 같아요.\n\n" +
          "어려운 건 번역의 방향이에요. **한→영**은 반말/존댓말의 대비가 증발하고 형/오빠/선배가 모두 이름이 돼요(자막은 이름으로 바꾸거나 hyung, oppa를 차용). **영→한**은 반대로 원문에 없는 위계를 번역가가 **창작**해야 해요 — 같은 영화의 자막과 더빙에서 말투가 다른 이유죠.",
        examples: [
          { en: "Give me the report. → When you get a chance, could you send over the report?", ko: "보고서 줘. → 시간 되실 때 보고서 좀 보내주시겠어요?", note: "영어의 '존댓말'은 어미가 아니라 문장 구조 전체로 구현돼요." },
          { en: "'Oppa, you came!' — subtitled as 'Jun-ho, you came!' or 'Oppa, you came!'", ko: "'오빠, 왔어?' — 자막은 이름으로 바꾸거나 oppa를 그대로 살리는 두 갈래.", note: "관계 정보(연상·친밀·이성)를 전부 운반하는 호칭 — 번역가의 영원한 딜레마." },
          { en: "Dr. Kim → 김 박사님 / 김 선생님 / 김 박사 — the translator must invent the hierarchy.", ko: "영→한 번역가는 원문에 없는 존비 관계를 결정해야 해요.", note: "번역은 정보를 잃기만 하는 게 아니라, 때로 만들어 넣어야 하는 작업." },
        ],
        pitfall: "'영어는 존댓말이 없으니 편하다'는 방심이 한국 학습자 최대의 화용 실수를 낳아요. 영어의 공손 장치(would/could, might, 간접 의문)는 어미가 아니라서 **눈에 안 보일 뿐 위반은 정확히 감지**돼요. 처음 본 사람에게 Give me water는 한국어로 치면 반말 주문이에요. 거꾸로 친구 사이에 과도한 격식(Would you be so kind as to...)은 차갑거나 비꼬는 것으로 들려요 — 존댓말 없는 언어가 아니라, **존댓말이 숨어 있는** 언어로 대하세요.",
      },
      {
        heading: "명사의 언어, 동사의 언어 — 구조 차원의 번역",
        pattern: "영어 = 명사 중심 ↔ 한국어 = 동사 중심",
        patternKo: "영→한: 명사를 동사로 풀기 · 한→영: 동사를 명사로 접기",
        body:
          "통역사들의 경험칙 — **영어는 명사 중심, 한국어는 동사 중심**이에요. The discovery of the leak led to the cancellation of the launch를 직역하면 번역투('누출의 발견은...')가 되고, 자연스러운 한국어는 동사로 풀어요: '누출이 발견되면서 발사가 취소됐다'. 그래서 양대 변환 규칙이 나와요 — **영→한은 명사를 동사로, 한→영은 동사를 명사로**.\n\n" +
          "주어 선택도 갈라져요. 영어는 무생물 주어를 사랑하고(The news made me happy.), 한국어는 사람을 주어로 세워요('나는 그 소식을 듣고 기뻤다') — '그 소식이 나를 기쁘게 만들었다'가 번역투인 이유예요.",
        examples: [
          { en: "The failure of the talks resulted in the resumption of the strike.", ko: "(번역투) 회담의 실패는 파업의 재개를 초래했다. → (자연스럽게) 회담이 결렬되면서 파업이 다시 시작됐다.", note: "명사 4개의 영어 → 동사 2개의 한국어. 이 변환이 번역의 절반이에요." },
          { en: "What brings you here?", ko: "(직역) 무엇이 당신을 여기로 데려왔나요? → (자연) 여긴 어쩐 일이세요?", note: "무생물 주어 의문문 — 영어다움의 결정체라 직역이 가장 어색한 유형." },
          { en: "이 약을 먹으면 졸려요. → This medicine makes you drowsy.", ko: "한국어의 '-(으)면' 조건절이 영어에선 무생물 주어 + make로 접혀요.", note: "한→영 방향의 명사 중심 변환 — 영작이 늘었다는 신호는 이 문형이 먼저 나올 때예요." },
          { en: "His sudden departure surprised everyone. → 그가 갑자기 떠나서 모두가 놀랐다.", ko: "명사구(His sudden departure)를 절(그가 갑자기 떠나서)로 푸는 표준 변환.", note: "관형어 '갑작스러운 떠남' 대신 부사 '갑자기' — 품사까지 갈아타는 게 요령." },
        ],
        tip: "자기 번역투를 진단하는 테스트: 최근에 쓴 한국어 글에서 '~의 ~'가 연쇄된 문장과 무생물 주어 + '~을 초래했다/야기했다'를 찾아보세요. 영어 글에서는 반대로, 모든 문장의 주어가 I나 사람인지 보세요. 양쪽 다 발견된다면 — 축하해요, 두 언어의 중간 지대에 살고 있다는 증거예요. 의식적인 방향 전환 연습만 더하면 됩니다.",
      },
      {
        heading: "두 언어 사이에서 — 레퍼런스를 닫으며",
        pattern: "수신은 넓게 · 송신은 정확하게 · 한국어를 깊게",
        patternKo: "목표 = 완벽한 원어민이 아니라 명료한 이중언어자",
        body:
          "A1에서 C2까지의 여정을 한 문장으로 압축하면 — **영어 학습의 끝은 영어가 아니라, 두 언어 사이의 공간이다.** 이 레퍼런스가 줄곧 한국어와의 비교(🇰🇷)를 고집한 이유예요. 관사도, 현재완료도, sarcasm도 **한국어와의 낙차** 속에서 가장 선명하게 보이고, 그 낙차를 오가는 능력이야말로 번역기가 대신 못 해주는 자산이에요.\n\n" +
          "마지막 당부 셋 — **① 완벽한 원어민이 아니라 명료한 이중언어자를 목표로**(영어의 주류는 이미 비모어 화자예요), **② 수신은 넓게, 송신은 정확하게**(관용구·암시·sarcasm은 충분히 목격한 것만 입 밖에), **③ 한국어를 깊게**(번역이라는 협상은 양쪽 화폐를 다 아는 사람이 이겨요).\n\n" +
          "여기까지 오신 것을 축하해요. 이제 레퍼런스를 닫고, 두 언어 사이의 그 넓은 공간으로 나가세요.",
        examples: [
          { en: "To have another language is to possess a second soul.", ko: "또 하나의 언어를 갖는다는 것은 두 번째 영혼을 갖는 것이다.", note: "샤를마뉴의 말로 전해지는 격언 — 출처는 불확실하지만, C2까지 온 분이라면 그 뜻은 확실히 아실 거예요." },
          { en: "The limits of my language mean the limits of my world.", ko: "내 언어의 한계는 내 세계의 한계를 뜻한다.", note: "비트겐슈타인 「논리-철학 논고」(1922) — 그렇다면 두 언어의 화자에게 세계는 두 배가 아니라, 그 사이의 공간만큼 더 넓어요." },
        ],
        tip: "졸업 과제를 하나 드릴게요. 좋아하는 한국어 문장 하나(시 한 줄, 가사 한 소절)를 영어로 옮겨보고, 무엇을 지키고 무엇을 포기했는지 적어보세요. 그 메모가 곧 여러분의 번역론이고, 이 레퍼런스 전체의 살아 있는 복습입니다. 수고하셨어요 — 아, 이 인사부터 번역 협상이 필요하겠네요. Great work, and see you between the languages.",
      },
    ],
  },
];
