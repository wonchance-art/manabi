/**
 * A1 기초 — 영어 문장의 뼈대 세우기
 * 학교 영어로 '아는' 내용을 '쓸 수 있는' 상태로 — 한국어 감각과 정면충돌하는 지점부터 풀어요.
 */
const chapters = [
  {
    slug: "a1-01-be-verb",
    level: "A1",
    order: 1,
    title: "말 순서부터 뒤집고 시작합니다",
    topic: "be동사와 SVO 어순",
    titleFr: "The verb be & SVO word order",
    summary: "한국어 어순(SOV)과 영어 어순(SVO)의 정면 충돌을 먼저 정리하고, 모든 문장의 출발점인 am/is/are를 배워요.",
    duration: "약 9분",
    sections: [
      {
        heading: "be동사의 자리 — 주어 바로 뒤",
        pattern: "주어 + am/is/are + 보어 (SVC — 보어는 목적어가 아니에요)",
        patternKo: "주어를 말한 순간, 다음 칸은 무조건 동사",
        distractors: ["am", "is", "are", "be"],
        body:
          "영어가 SVO — **동사가 주어 바로 뒤**에 온다는 큰 그림은 OT의 어순 챕터에서 잡았어요. 여기서는 그 '주어 바로 뒤 동사' 자리에 **be동사**를 꽂는 연습을 해요. 참고로 be 문장의 세 번째 칸은 목적어가 아니라 주어를 설명하는 **보어**라서, 문형으로는 SVC라고 불러요 — '동사가 두 번째'라는 큰 그림은 똑같아요.\n\n" +
          "'나는 학생이다'의 머릿속 순서: ① 주어 I → ② **동사부터!** am → ③ 나머지 a student. 한국어 '이다'는 맨 끝에 오지만, 영어는 am을 **주어 바로 뒤**에 놓는 게 이 챕터의 첫 훈련이에요.",
        examples: [
          { en: "I am a student.", ko: "저는 학생이에요.", note: "나는(I) + 이다(am) + 학생(a student) — 동사가 두 번째" },
          { en: "She is my friend.", ko: "그녀는 제 친구예요." },
          { en: "We are in Seoul.", ko: "우리는 서울에 있어요.", note: "be는 '~에 있다'라는 위치도 표현해요" },
        ],
        vsKo: "한국어는 조사('은/는/이/가/을/를')가 역할을 표시하니까 어순이 자유로워요 — '학생이야, 나는'도 통하죠. 영어에는 조사가 없어서 **순서가 곧 조사**예요. 자리가 바뀌면 의미가 바뀌거나 문장이 무너집니다.",
      },
      {
        heading: "am / is / are — 주어에 따라 모양이 바뀐다",
        pattern: "I → am · he/she/it → is · you/we/they → are",
        distractors: ["am", "is", "are", "be"],
        patternKo: "주어와 동사의 짝 맞추기(수일치)",
        body:
          "한국어 '이다'는 누가 주어든 하나지만, 영어 be는 주어와 **짝을 맞춰** 세 가지로 변해요(수일치). 이 짝 맞추기는 영어 전체를 관통하는 습관이라 여기서 단단히 잡아두면 두고두고 편해요.",
        table: {
          caption: "be 동사 현재형",
          headers: ["주어", "be 동사", "축약형"],
          rows: [
            ["I", "am", "I'm"],
            ["you / we / they", "are", "you're / we're / they're"],
            ["he / she / it", "is", "he's / she's / it's"],
            ["단수 명사 (Tom, my mom)", "is", "Tom's"],
            ["복수 명사 (my friends)", "are", "—"],
          ],
        },
        examples: [
          { en: "You are very kind.", ko: "당신은 정말 친절하네요." },
          { en: "My parents are busy.", ko: "우리 부모님은 바쁘세요.", note: "parents = 복수 → are" },
          { en: "It is cold today.", ko: "오늘 추워요." },
        ],
        pitfall: "주어를 빼먹는 게 한국인 1호 실수예요. 한국어는 '학생이에요', '추워요'처럼 주어 없이 말하는 게 자연스럽지만, 영어 문장에는 **주어가 반드시** 있어야 해요. 'Am a student.'(X) → 'I am a student.'(O), '추워요' → 'It is cold.'(O — 날씨엔 it).",
      },
      {
        heading: "축약형 — 원어민의 기본값",
        pattern: "I am → I'm · she is → she's · they are → they're",
        patternKo: "축약이 기본값, 안 줄이면 강조",
        body:
          "실제 회화에서는 **I'm, she's, we're** 같은 축약형이 기본값이에요. 축약하지 않고 또박또박 말하면 오히려 '강조'로 들려요(I AM a student! — 진짜라니까요!).\n\n" +
          "발음이 포인트라 여기만 ipa를 붙여요. 특히 I'm은 '아이 엠' 두 박자가 아니라 [aɪm] **한 박자**예요.",
        examples: [
          { en: "I'm tired.", ipa: "[aɪm ˈtaɪərd]", ko: "피곤해요.", note: "'아임' 한 덩어리로" },
          { en: "She's a doctor.", ipa: "[ʃiːz ə ˈdɑːktər]", ko: "그녀는 의사예요." },
          { en: "They're at home.", ipa: "[ðer ət ˈhoʊm]", ko: "그들은 집에 있어요.", note: "they're는 there와 발음이 거의 같아요" },
        ],
        tip: "it's(it is의 축약)와 its(그것의)는 발음이 같지만 전혀 다른 말이에요. 아포스트로피(')가 보이면 '무언가 줄었다'는 신호 — it's = it is.",
      },
      {
        heading: "be 동사의 부정과 의문 — 자리만 바꾸면 끝",
        pattern: "부정: be + not · 의문: Be + 주어 ~?",
        patternKo: "be는 스스로 부정·의문을 처리해요",
        body:
          "부정은 be 뒤에 **not**, 의문은 be를 주어 **앞으로** — be 문장은 이걸로 끝이에요. 나중에 배울 일반동사(do가 필요한)와 달리, be는 스스로 모든 걸 처리해요.\n\n" +
          "한국어는 '학생이에요**?**'처럼 끝만 올리면 의문문이 되지만, 영어는 **어순 자체를 뒤집어요**. 이 뒤집기 감각을 미리 길러두세요.",
        examples: [
          { en: "I'm not hungry.", ko: "배 안 고파요." },
          { en: "She isn't here.", ko: "그녀는 여기 없어요.", note: "is not = isn't" },
          { en: "Are you okay?", ko: "괜찮아요?", note: "You are → Are you" },
          { en: "Is this your bag?", ko: "이거 당신 가방이에요?" },
        ],
        tip: "대답은 Yes, I am. / No, I'm not. 처럼 be 동사로 받아요. 단, Yes 뒤에서는 축약하지 않아요 — 'Yes, I'm.'(X), 'Yes, I am.'(O).",
      },
    ],
  },

  {
    slug: "a1-02-present-simple",
    level: "A1",
    order: 2,
    title: "한국인이 30년 틀리는 단 한 글자",
    topic: "일반동사 현재·3인칭 -s",
    titleFr: "Present simple & third person -s",
    summary: "습관과 사실을 말하는 현재형, 그리고 한국인이 10년을 틀리는 3인칭 단수 -s를 정면으로 다뤄요.",
    duration: "약 9분",
    sections: [
      {
        heading: "현재형은 '지금'이 아니라 '늘'",
        pattern: "주어 + 동사원형 → 습관·반복·사실",
        patternKo: "현재형 = '지금'이 아니라 '평소에 늘'",
        body:
          "영어 현재형의 진짜 의미는 **'평소에 늘 그렇다'**예요. 'I drink coffee.'는 지금 마시는 중이 아니라 '평소에 커피를 마시는 사람이다'라는 뜻이에요.\n\n" +
          "'지금 하는 중'은 나중에 배울 **현재진행형**의 몫이에요. 이 역할 분담을 처음부터 알아두면 두 시제가 헷갈리지 않아요.",
        examples: [
          { en: "I drink coffee every morning.", ko: "저는 매일 아침 커피를 마셔요.", note: "습관" },
          { en: "We live in Busan.", ko: "우리는 부산에 살아요.", note: "지속되는 사실" },
          { en: "The bank opens at nine.", ko: "은행은 9시에 열어요.", note: "정해진 일정" },
        ],
        tip: "every day, usually, always 같은 '늘'을 뜻하는 말이 보이면 현재형 신호예요.",
      },
      {
        heading: "3인칭 단수 -s — 왜 자꾸 빼먹는가",
        pattern: "he/she/it + 동사-s (works / plays / rains)",
        patternKo: "주어가 한 사람·한 개면 동사 끝에 -s",
        distractors: ["working", "playing", "raining"],
        body:
          "주어가 **he, she, it (또는 한 사람·한 개)**일 때 동사 끝에 **-s**를 붙여요. 한국어 동사는 주어가 누구든 모양이 같아서('나는 마셔요/걔는 마셔요'), 한국어 감각에는 -s를 붙일 이유가 아예 없어요.\n\n" +
          "해결책은 이해가 아니라 **습관**이에요. he/she/it가 떠오르는 순간 '쓰리인칭? 에스!'를 되뇌는 것만으로 교정 속도가 확 빨라져요.",
        examples: [
          { en: "She works at a hospital.", ko: "그녀는 병원에서 일해요." },
          { en: "My brother plays soccer.", ko: "우리 형은 축구를 해요.", note: "my brother = he → -s" },
          { en: "It rains a lot in summer.", ko: "여름엔 비가 많이 와요." },
        ],
        pitfall: "이 -s는 틀려도 의사소통엔 지장이 없어서 아무도 지적해주지 않아요. 그래서 10년씩 가는 거예요. '굳은 실수(fossilized error)'가 되기 전, A1인 지금이 가장 싸게 고칠 수 있는 시점입니다.",
        vsKo: "한국어는 주어 대신 **어미**가 변하는 언어예요(가요/갑니다/가셔). 영어는 어미 변화가 거의 없는 대신, 살아남은 몇 안 되는 변화가 바로 이 -s예요. 영어 입장에서 -s는 '수일치의 마지막 보루'라 원어민 귀에는 빠지면 꽤 크게 들립니다.",
      },
      {
        heading: "-s의 철자와 발음",
        pattern: "무성음 뒤 [s] · 유성음 뒤 [z] · 쉭쉭 소리 뒤 [ɪz]",
        patternKo: "앞 소리에 따라 -s 발음이 셋으로 갈려요",
        body:
          "대부분은 그냥 -s를 붙이고, 철자 규칙은 표 네 줄이 전부예요. 발음은 **앞 소리가 무성음이면 [s], 유성음이면 [z], 쉭쉭 소리(s/sh/ch) 뒤면 [ɪz]** — 이 삼분법 하나면 돼요.",
        table: {
          caption: "3인칭 단수 -s 만들기",
          headers: ["규칙", "예시", "발음"],
          rows: [
            ["대부분: +s", "works, plays, runs", "works [s] / plays [z]"],
            ["-s, -sh, -ch, -x, -o: +es", "watches, goes, does", "[ɪz] (goes는 [z])"],
            ["자음+y: y→ies", "study → studies", "[z]"],
            ["불규칙", "have → has", "[z]"],
          ],
        },
        examples: [
          { en: "He watches TV at night.", ipa: "[ˈwɑːtʃɪz]", ko: "그는 밤에 TV를 봐요.", note: "ch 뒤 → 음절 하나 추가 [ɪz]" },
          { en: "She studies English.", ipa: "[ˈstʌdiz]", ko: "그녀는 영어를 공부해요." },
          { en: "My dad has a car.", ipa: "[hæz]", ko: "아빠는 차가 있으세요.", note: "have의 3인칭은 has" },
        ],
      },
      {
        heading: "예고 — 부정·의문에서는 do가 등판해요",
        pattern: "She likes ~ → She doesn't like ~",
        patternKo: "-s 표시는 문장에 한 번만 — does가 가져가요",
        distractors: ["don't", "isn't", "not"],
        body:
          "일반동사의 부정·의문은 **조동사 do**의 도움을 받아요 — 'I don't drink coffee.', 'Do you like music?'\n\n" +
          "미리 한 가지만: 3인칭의 -s는 **does가 대신 가져가요**. 'She **doesn't like** coffee.'(likes 아님!) — -s 표시는 문장에 **한 번만**이라는 원리예요. 자세한 건 7챕터에서 다뤄요.",
        examples: [
          { en: "I don't eat breakfast.", ko: "저는 아침을 안 먹어요." },
          { en: "She doesn't like coffee.", ko: "그녀는 커피를 안 좋아해요.", note: "doesn't가 -s를 가져갔으니 동사는 원형 like" },
        ],
        tip: "'-s는 문장에 한 번만'이라는 원리를 지금 입에 붙여두세요. 7챕터에서 배울 'Does she likes~?'(X) 같은 이중 -s 실수를 예방하는 백신이에요.",
      },
    ],
  },

  {
    slug: "a1-03-articles",
    level: "A1",
    order: 3,
    title: "a였다가 the가 되는 순간",
    topic: "관사 a/the",
    titleFr: "Articles: a / the",
    summary: "한국어에는 아예 없는 품사라서 평생 헷갈리는 관사. '아무거나 하나 a, 너도 아는 그것 the' 프레임으로 정리해요.",
    duration: "약 10분",
    sections: [
      {
        heading: "관사가 어려운 진짜 이유 — 범주 자체가 없으니까",
        pattern: "a = 아무거나 하나 · the = 너도 아는 그것",
        patternKo: "기준: 듣는 사람이 어느 것인지 알 수 있나?",
        body:
          "영어는 명사를 말할 때마다 **'어떤 것인지' 신분을 밝히라고 요구**해요. 판단 기준은 단 하나 — **'듣는 사람이 어느 것인지 알 수 있나?'** 모르면 a, 알면 the예요.\n\n" +
          "그래서 같은 명사가 한 대화 안에서 a → the로 옷을 갈아입어요. 처음 언급할 땐 a(네가 모르는 하나), 두 번째부터는 the(이제 너도 아는 그것).",
        examples: [
          { en: "I bought a book. The book was boring.", ko: "책을 한 권 샀어요. 그 책은 지루했어요.", note: "첫 등장 a → 재등장 the" },
          { en: "She has a dog and a cat. The dog is very old.", ko: "그녀는 개와 고양이를 키워요. 그 개는 아주 늙었어요." },
        ],
        vsKo: "한국어가 관사 없이도 잘 굴러가는 건 **맥락이 그 역할을 대신**하기 때문이에요. 영어는 맥락에 덜 기대고 문법 표지에 더 기대는 언어라, 한국어 화자 입장에선 '당연한 걸 왜 말로 하지?' 싶은 정보를 매번 명시해야 해요. '귀찮은 게 아니라 다른 분업 방식'이라고 받아들이는 게 출발점이에요.",
      },
      {
        heading: "a vs an — 철자가 아니라 소리 기준",
        pattern: "다음 소리가 모음이면 an, 자음이면 a",
        patternKo: "an hour(h 묵음) · a university(첫소리 [j])",
        body:
          "다음 단어가 **모음 소리**로 시작하면 an, 자음 소리면 a — 핵심은 철자가 아니라 **소리**예요.\n\n" +
          "hour는 h가 묵음이라 첫소리가 모음 [aʊ] → **an hour**, university는 첫소리가 [j](유) → **a university**. 시험 단골 함정이지만 '소리 기준' 원리 하나면 외울 게 없어요.",
        examples: [
          { en: "an apple, an egg, an umbrella", ko: "사과 하나, 달걀 하나, 우산 하나", note: "모음 소리로 시작" },
          { en: "an hour", ipa: "[ən ˈaʊər]", ko: "한 시간", note: "h 묵음 → 첫소리가 모음" },
          { en: "a university", ipa: "[ə ˌjuːnɪˈvɜːrsəti]", ko: "대학교 하나", note: "첫소리 [j] = 자음 → a" },
          { en: "a one-way ticket", ipa: "[ə ˈwʌn weɪ]", ko: "편도표 한 장", note: "one의 첫소리 [w] = 자음" },
        ],
        etym: "a/an은 원래 **one(하나)**이 닳아서 된 말이에요. 그래서 a의 본질은 '하나의'. the는 **that(저것)**의 후손이라 본질이 '그'예요. '아무거나 하나 a / 너도 아는 그것 the' 프레임이 어원 그대로인 셈이죠.",
      },
      {
        heading: "the를 쓰는 자리 — '특정됨'의 여러 얼굴",
        pattern: "앞서 언급 · 상황상 하나 · 세상에 하나 · 수식어로 특정 → the",
        patternKo: "듣는 사람이 '아 그거!' 하고 짚을 수 있으면 the",
        body:
          "'너도 아는 그것'이 되는 경로는 네 가지예요 — **① 앞에서 언급됨**(a book → the book), **② 상황상 하나뿐**(the door, the kitchen), **③ 세상에 하나뿐**(the sun, the internet), **④ 수식어로 특정됨**(the bag on the table).\n\n" +
          "전부 같은 원리예요 — 듣는 사람이 '아 그거!' 하고 짚을 수 있으면 the.",
        examples: [
          { en: "Can you close the door?", ko: "문 좀 닫아줄래요?", note: "이 방의 문 — 둘 다 아는 그 문" },
          { en: "The sun is hot today.", ko: "오늘 햇볕이 뜨겁네요.", note: "세상에 하나뿐" },
          { en: "Where is the bathroom?", ko: "화장실이 어디예요?", note: "이 건물의 화장실" },
        ],
        tip: "식당·가게에서 'Where is the bathroom?'처럼, 그 장소에 당연히 있는 시설은 처음 말해도 the예요. '이 건물에 있는 바로 그것'으로 이미 특정되니까요.",
      },
      {
        heading: "관사를 안 쓰는 자리도 있어요",
        pattern: "종류 전체 = 무관사 복수 (I like dogs)",
        patternKo: "식사·by 교통수단·go to school/bed도 무관사",
        body:
          "관사를 **안 쓰는** 자리: **① 일반적인 복수·셀 수 없는 명사**(I like dogs, I drink coffee), **② 식사 이름**(have breakfast), **③ by + 교통수단**(by bus), **④ 본래 목적의 장소**(go to school, go to bed).\n\n" +
          "특히 ①이 중요해요. '개를 좋아해요'처럼 종류 전체를 말할 땐 **관사 없는 복수형**이 기본이에요.",
        examples: [
          { en: "I like dogs.", ko: "저는 개를 좋아해요.", note: "개라는 종류 전체 — 무관사 복수" },
          { en: "We had lunch together.", ko: "우리는 같이 점심을 먹었어요." },
          { en: "I go to school by bus.", ko: "저는 버스로 학교에 가요." },
        ],
        pitfall: "'I like dog.'(X)라고 하면 '개고기를 좋아한다'는 뜻으로 들릴 수 있어요. 관사 없는 단수는 '물질·고기'로 읽히거든요. 종류 전체를 좋아한다는 말은 꼭 복수로 — I like dogs. 한 글자 차이가 꽤 큰 사고를 칩니다.",
      },
    ],
  },

  {
    slug: "a1-04-plural-countable",
    level: "A1",
    order: 4,
    title: "\"물 두 잔이요\" — 세는 법부터",
    topic: "복수형·가산/불가산 명사",
    titleFr: "Plurals & countable / uncountable nouns",
    summary: "한국어는 복수 표시가 선택이지만 영어는 의무예요. 그리고 information처럼 '셀 수 없는' 명사의 함정을 파헤쳐요.",
    duration: "약 9분",
    sections: [
      {
        heading: "한국어는 선택, 영어는 의무",
        pattern: "둘 이상 → 명사 + -s (필수)",
        patternKo: "three apples — 숫자가 있어도 -s는 또 붙어요",
        body:
          "한국어 '-들'은 선택 사항이지만, 영어는 둘 이상이면 **반드시** -s를 붙여요. three apple(X) → three apples(O) — 숫자가 이미 알려줘도 또 표시하는, **개수에 진심인 언어**예요.\n\n" +
          "그래서 영어 명사를 말할 땐 매번 '하나야, 여러 개야?'를 판단해야 해요. 관사(a)와 복수(-s)는 사실 한 세트의 질문이에요.",
        examples: [
          { en: "I bought three apples.", ko: "사과 세 개 샀어요.", note: "three가 있어도 -s는 필수" },
          { en: "She has two brothers.", ko: "그녀는 오빠가 둘 있어요." },
          { en: "There are many books here.", ko: "여기 책이 많아요." },
        ],
        vsKo: "한국어 '-들'은 붙여도 그만 안 붙여도 그만이고, 오히려 '사과들을 샀다'는 어색하죠. 이 '복수는 굳이 표시 안 함' 감각이 영어에서 -s 누락으로 그대로 이어져요. 3인칭 -s와 함께, 한국인 영어에서 가장 오래 남는 흔적이에요.",
      },
      {
        heading: "복수형 만들기 — 철자와 발음",
        pattern: "+s · +es · y→ies · 불규칙(men, children, feet)",
        patternKo: "복수형 철자 규칙 + 통째로 외울 불규칙들",
        distractors: ["childs", "mans", "foots"],
        body:
          "철자 규칙은 3인칭 -s와 똑같고, 발음도 같은 삼분법이에요 — 무성음 뒤 [s], 유성음 뒤 [z], 쉭쉭 소리 뒤 [ɪz]. 다만 자주 쓰는 **불규칙 복수** 몇 개는 통째로 외워야 해요.",
        table: {
          caption: "복수형 만들기",
          headers: ["규칙", "예시", "비고"],
          rows: [
            ["대부분: +s", "books, apples", "books [s] / apples [z]"],
            ["-s, -sh, -ch, -x: +es", "buses, watches", "발음 [ɪz]"],
            ["자음+y: y→ies", "city → cities", ""],
            ["-f/-fe → ves", "knife → knives", "leaf → leaves"],
            ["불규칙", "man→men, woman→women, child→children", "통째로 암기"],
            ["불규칙", "foot→feet, tooth→teeth, person→people", ""],
          ],
        },
        examples: [
          { en: "Two coffees, please.", ko: "커피 두 잔 주세요.", note: "주문할 땐 '잔' 단위로 세어 복수 가능" },
          { en: "The children are sleeping.", ko: "아이들이 자고 있어요.", note: "children은 이미 복수 — childrens(X)" },
          { en: "Many people think so.", ipa: "[ˈpiːpl]", ko: "많은 사람들이 그렇게 생각해요.", note: "people 자체가 복수 취급" },
        ],
        pitfall: "women의 발음은 [ˈwɪmɪn] '위민'이에요 — 철자에 이끌려 '워먼/워멘'으로 읽기 쉬운데, 단수 woman [ˈwʊmən]과 구별되는 건 오히려 **첫 모음**이에요. 듣기에서 단복수를 가르는 포인트입니다.",
      },
      {
        heading: "셀 수 없는 명사 — 한국인의 4대 함정 단어",
        pattern: "information · advice · homework · furniture = 불가산",
        patternKo: "세고 싶으면 a piece of ~로 그릇에 담기",
        body:
          "물·쌀 같은 액체·알갱이는 직관적인데, 문제는 **추상명사**예요. **information, advice, homework, furniture**는 영어가 **덩어리(물질)처럼** 취급해서 an information(X), advices(X) 전부 틀려요.\n\n" +
          "세고 싶으면 그릇에 담아요 — **a piece of** information(정보 한 토막), **two pieces of** advice(조언 두 가지).",
        distractors: ["informations", "advices", "homeworks", "furnitures"],
        examples: [
          { en: "I need some information.", ko: "정보가 좀 필요해요.", note: "informations(X)" },
          { en: "She gave me a piece of advice.", ko: "그녀가 조언을 하나 해줬어요." },
          { en: "I have a lot of homework.", ko: "숙제가 많아요.", note: "homeworks(X), many(X) → a lot of" },
          { en: "Two glasses of water, please.", ko: "물 두 잔 주세요.", note: "물은 못 세지만 '잔'은 셀 수 있어요" },
        ],
        pitfall: "informations, advices, furnitures — 한국인(그리고 전 세계 학습자)의 단골 오답 3종이에요. 프랑스어·독일어에서는 실제로 셀 수 있는 명사라서 유럽 학습자도 똑같이 틀리는, 영어 쪽이 유별난 지점이에요. '정보·조언·가구·숙제는 물처럼'으로 묶어 외워두세요.",
      },
      {
        heading: "many / much / a lot of — 짝을 맞춰 쓰기",
        pattern: "many + 가산 복수 · much + 불가산 · a lot of = 만능",
        patternKo: "셀 수 있으면 many, 못 세면 much, 헷갈리면 a lot of",
        body:
          "'많다'도 가산/불가산에 따라 갈라져요 — **many** + 셀 수 있는 복수, **much** + 셀 수 없는 명사(주로 부정·의문문), **a lot of**는 아무거나.\n\n" +
          "헷갈리면 a lot of를 쓰세요 — 틀릴 일이 없는 안전한 선택이에요. some/any도 가산·불가산 모두에 붙어서 편해요.",
        examples: [
          { en: "I don't have much time.", ko: "시간이 별로 없어요." },
          { en: "She has a lot of friends.", ko: "그녀는 친구가 많아요." },
          { en: "Do you have any questions?", ko: "질문 있으세요?" },
        ],
        tip: "'How many ~?'(몇 개)와 'How much ~?'(얼마나/얼마)도 같은 짝이에요. 가격을 물을 때 How much예요? — 돈(money)이 불가산 명사이기 때문이랍니다.",
      },
    ],
  },

  {
    slug: "a1-05-pronouns-possessive",
    level: "A1",
    order: 5,
    title: "엄마 얘기에 he가 튀어나올 때",
    topic: "인칭대명사·소유격",
    titleFr: "Pronouns & possessives",
    summary: "I/my/me/mine 네 벌의 옷을 정리하고, 한국인이 말하다 보면 he와 she가 뒤바뀌는 이유를 파헤쳐요.",
    duration: "약 9분",
    sections: [
      {
        heading: "인칭대명사 한눈에 — 자리에 따라 옷을 갈아입어요",
        pattern: "I(주어) → my(소유) → me(목적어) → mine(~의 것)",
        patternKo: "조사 대신 단어 자체가 변신",
        body:
          "영어 대명사는 역할에 따라 모양이 바뀌어요 — 주어 자리 I, 소유 my, 목적어 자리 me. 한국어 '내가/나의/나를'처럼 조사가 바뀌는 것과 같은 원리인데, 영어는 조사 대신 **단어 자체가 변신**해요.",
        table: {
          caption: "인칭대명사 변화표",
          headers: ["주격 (~가)", "소유격 (~의)", "목적격 (~를)", "소유대명사 (~의 것)"],
          rows: [
            ["I", "my", "me", "mine"],
            ["you", "your", "you", "yours"],
            ["he", "his", "him", "his"],
            ["she", "her", "her", "hers"],
            ["it", "its", "it", "—"],
            ["we", "our", "us", "ours"],
            ["they", "their", "them", "theirs"],
          ],
        },
        examples: [
          { en: "She loves him.", ko: "그녀는 그를 사랑해요.", note: "주어 자리 she, 목적어 자리 him" },
          { en: "He loves her.", ko: "그는 그녀를 사랑해요." },
        ],
        vsKo: "한국어는 명사에 조사를 붙이고(나+가, 나+를), 영어는 대명사 자체를 바꿔요(I, me). 방식은 다르지만 '역할 표시'라는 목적은 같아요 — 표가 길어 보여도 한국어 화자에게 낯선 개념은 아니에요.",
      },
      {
        heading: "he/she 혼동 — 한국인 스피킹의 시그니처 실수",
        pattern: "My mom → she · my brother → he",
        patternKo: "첫 문장에서 성별을 의식적으로 박아두기",
        body:
          "한국어 3인칭은 '걔', '그 사람'처럼 **성별 구분 없는 말**이라, 머릿속에 '성별 선택' 회로 자체가 없어요. 그래서 엄마 얘기를 하면서 he라고 하는, 한국·중국·일본 화자의 시그니처 실수가 나와요.\n\n" +
          "교정 요령: 사람 얘기를 시작할 때 **첫 문장에서 성별을 의식적으로 한 번 박아두기** — 'My mom — she...'. 첫 단추만 끼우면 그 뒤는 관성으로 유지돼요.",
        examples: [
          { en: "My mom is a nurse. She works at night.", ko: "우리 엄마는 간호사예요. 밤에 일하세요.", note: "mom → she로 첫 연결을 의식적으로" },
          { en: "I met Minsu. He was with his sister.", ko: "민수를 만났어요. 여동생이랑 같이 있더라고요." },
        ],
        pitfall: "'My mom... he is very kind.'(X) — 듣는 원어민은 '아버지 얘기로 바뀌었나?' 하고 진짜로 헷갈려요. 한국어에선 정보가 아니었던 성별이 영어에선 문장을 추적하는 핵심 단서거든요. 문법 문제가 아니라 **의사소통 사고**가 나는 지점이에요.",
      },
      {
        heading: "소유격 my/your/his/her — 명사 앞의 옷",
        pattern: "소유격 + 명사 (my book) · 이름 + 's (Minsu's bag)",
        patternKo: "'~의'는 반드시 명사 앞에, 이름에는 's",
        body:
          "소유격은 **반드시 명사 앞**에 붙어요 — my book, her phone. 영어는 한국어보다 소유격을 훨씬 부지런히 써서, '손 씻어'도 'Wash **your** hands.'예요.\n\n" +
          "사람 이름에는 **'s**를 붙여요 — Minsu's bag(민수의 가방). 이 's는 한국어 '의'와 거의 같은 감각이라 쉬워요.",
        examples: [
          { en: "Wash your hands.", ko: "손 씻으세요.", note: "한국어엔 없는 your가 영어엔 필수" },
          { en: "This is my sister's room.", ko: "여기는 제 여동생 방이에요." },
          { en: "Her name is Jiyoung.", ko: "그녀의 이름은 지영이에요." },
        ],
        pitfall: "his(그의)와 her(그녀의)를 고르는 기준은 **가진 사람**의 성별이에요. '그의 어머니'는 his mother — mother가 여성이라고 her mother로 쓰면 '그녀의 어머니'가 돼버려요. 수식받는 명사가 아니라 주인을 보세요.",
      },
      {
        heading: "mine, yours — '~의 것' 한 단어로",
        pattern: "my book → mine · your bag → yours",
        patternKo: "명사 없이 '~의 것' 한 단어로",
        body:
          "명사 없이 소유를 말할 땐 **소유대명사**를 써요 — my book → mine, your bag → yours.\n\n" +
          "'Whose ~?'(누구의 ~?)에 답할 때 특히 유용해요. 'Whose phone is this?' — 'It's mine.' 한 단어로 끝나죠.",
        examples: [
          { en: "Whose umbrella is this? — It's mine.", ko: "이 우산 누구 거예요? — 제 거예요." },
          { en: "This seat is yours.", ko: "이 자리는 당신 거예요." },
          { en: "A friend of mine lives in Canada.", ko: "제 친구 한 명이 캐나다에 살아요.", note: "a my friend(X) — 이럴 때 mine을 써요" },
        ],
        tip: "its(그것의)와 it's(it is)를 헷갈리는 건 사실 원어민도 자주 하는 실수예요. 구별법은 하나 — '**it is**로 풀어 읽어서 말이 되면 it's'.",
      },
    ],
  },

  {
    slug: "a1-06-present-continuous",
    level: "A1",
    order: 6,
    title: "\"지금 뭐 해?\"에 답하는 법",
    topic: "현재진행형 be+-ing",
    titleFr: "Present continuous",
    summary: "be + -ing로 '지금 하는 중'을 표현해요. 현재형과의 역할 분담, 그리고 한국어 '-고 있다'와 어긋나는 지점까지.",
    duration: "약 9분",
    sections: [
      {
        heading: "형태는 be + -ing — be를 빼먹지 마세요",
        pattern: "주어 + am/is/are + 동사-ing",
        patternKo: "시제를 짊어지는 건 be 쪽",
        distractors: ["Is", "Am", "Do", "Does"],
        body:
          "현재진행형은 **be 동사 + 동사-ing** 두 조각이에요. 한국 학습자의 단골 실수가 be를 빼고 'I studying.'(X)이라고 하는 것 — **시제를 짊어지는 건 be 쪽**이라, be가 빠지면 문장에 시제가 없는 셈이에요.\n\n" +
          "부정은 be 뒤에 not(I'm not studying), 의문은 be를 앞으로(Are you studying?) — 1챕터의 be 동사 규칙 그대로예요.",
        examples: [
          { en: "I'm studying English now.", ko: "지금 영어 공부하고 있어요." },
          { en: "She's talking on the phone.", ko: "그녀는 통화 중이에요." },
          { en: "Are you listening to me?", ko: "내 말 듣고 있어요?" },
          { en: "They aren't working today.", ko: "그들은 오늘 일 안 해요." },
        ],
        pitfall: "'I am study English.'(X)도 흔한 변형 실수예요. be 뒤에 동사 원형이 오면 안 돼요 — be가 왔으면 짝꿍은 반드시 -ing(또는 명사·형용사). 'be + 원형'은 영어에 존재하지 않는 조합이라고 기억하세요.",
      },
      {
        heading: "현재형 vs 현재진행형 — '늘' 대 '지금'",
        pattern: "I drink coffee(늘) ↔ I'm drinking coffee(지금)",
        patternKo: "프로필 사진 vs 지금 찍은 스냅샷",
        body:
          "**현재형**은 평소·늘·반복, **현재진행형**은 지금 이 순간 진행 중이에요. 현재형은 그 사람의 **프로필 사진**(평소 모습), 진행형은 **지금 찍은 스냅샷**이라고 생각하세요.\n\n" +
          "'What do you do?'는 직업을 묻는 말, 'What are you doing?'은 지금 뭐 하느냐는 말 — 시제 하나로 질문이 완전히 달라져요.",
        examples: [
          { en: "I work at a bank, but today I'm working from home.", ko: "은행에서 일하는데, 오늘은 재택근무 중이에요.", note: "평소(현재형) + 지금(진행형)이 한 문장에" },
          { en: "What do you do? — I'm a teacher.", ko: "무슨 일 하세요? — 교사예요.", note: "직업 질문" },
          { en: "What are you doing? — I'm cooking.", ko: "지금 뭐 해요? — 요리 중이에요.", note: "지금 질문" },
        ],
        tip: "now, right now, at the moment가 보이면 진행형, every day, usually가 보이면 현재형 — 부사가 시제의 신호등이에요.",
      },
      {
        heading: "한국어 '-고 있다'와의 대응 — 그리고 어긋남",
        pattern: "know · love/loves · want · need → 보통 단순형 (상태동사)",
        patternKo: "'알고 있어요' = I know (I'm knowing X)",
        distractors: ["knowing", "loving", "wanting"],
        body:
          "현재진행형은 한국어 **'-고 있다'**와 잘 맞아요('공부하고 있어요' = I'm studying). 단, 한국어는 상태에도 '-고 있다'를 붙이지만 영어의 know, love, like, want, need 같은 **상태동사**는 **보통 진행형으로 쓰지 않아요** — '알고 있어요' → I know.(기본) / I'm knowing.(×)\n\n" +
          "다만 절대 금지는 아니에요 — 일시적·변화 중인 뉘앙스에서는 일부가 진행형이 돼요: She's loving the CD(요즘 한창 즐기는 중), I'm not liking this book(읽을수록 별로야). '기본은 단순형, 진행형은 특별한 뉘앙스'로 잡으세요.\n\n" +
          "또 한국어 '-고 있다'는 결과 상태도 표현해요('빨간 옷을 입고 있다' = 입은 상태). wearing은 다행히 이 뜻도 커버해요(She's wearing red.).",
        examples: [
          { en: "I know the answer.", ko: "답을 알고 있어요.", note: "I'm knowing(X) — know는 상태동사" },
          { en: "She loves K-pop.", ko: "그녀는 케이팝을 사랑해요.", note: "loves가 기본 — She's loving ~은 '한창 즐기는 중' 뉘앙스일 때만" },
          { en: "He's wearing a red jacket.", ko: "그는 빨간 재킷을 입고 있어요.", note: "입은 상태 — 영어도 진행형 OK" },
          { en: "I want some water.", ko: "물 마시고 싶어요.", note: "wanting(X)" },
        ],
        vsKo: "한국어 '-고 있다'는 동작 진행과 상태 지속을 모두 덮는 넓은 표현이지만, 영어 진행형은 '**눈앞에서 변화가 일어나는 중**'일 때만 써요. know·love·want처럼 시작도 끝도 안 보이는 상태에는 진행형이 안 붙는 이유예요. '-고 있다 = 진행형'으로 1:1 번역하면 안 되는 대표 지점입니다.",
      },
      {
        heading: "-ing 철자 규칙",
        pattern: "+ing · e 탈락(make→making) · 자음 겹침(run→running)",
        patternKo: "-ing 붙일 때 e는 빼고, 짧은 모음 뒤 자음은 겹쳐요",
        body: "-ing 붙이는 철자 규칙은 표의 네 줄이 전부예요.",
        table: {
          caption: "-ing 만들기",
          headers: ["규칙", "예시"],
          rows: [
            ["대부분: +ing", "study → studying, eat → eating"],
            ["e로 끝나면: e 빼고 +ing", "make → making, come → coming"],
            ["짧은 모음+자음 1개: 자음 겹치고 +ing", "run → running, sit → sitting, swim → swimming"],
            ["-ie로 끝나면: ie→y +ing", "lie → lying, die → dying"],
          ],
        },
        examples: [
          { en: "We're making dinner.", ko: "우리는 저녁을 만들고 있어요.", note: "make → making (e 탈락)" },
          { en: "The kids are running outside.", ko: "아이들이 밖에서 뛰고 있어요.", note: "run → running (n 두 번)" },
        ],
        tip: "자음을 겹치는 이유는 모음 발음을 지키기 위해서예요. writing(쓰는 중, write의 i는 '아이')과 written 계열을 비교해보면, 자음 하나/둘이 앞 모음의 길이를 결정하는 영어 철자의 큰 원리가 보여요.",
      },
    ],
  },

  {
    slug: "a1-07-questions-negatives",
    level: "A1",
    order: 7,
    title: "\"커피 좋아해요?\"를 만드는 do",
    topic: "do 의문문·부정문",
    titleFr: "Questions & negatives with do",
    summary: "일반동사의 의문문·부정문을 만드는 조동사 do. 왜 영어에는 이런 장치가 필요한지부터 이해하고 들어가요.",
    duration: "약 9분",
    sections: [
      {
        heading: "왜 do가 필요한가 — 한국어에 없는 장치",
        pattern: "Do + 주어 + 동사원형? · 주어 + don't + 동사원형",
        patternKo: "do = 뜻 없는 문법 도우미(조동사)",
        body:
          "'Do you like coffee?'의 do 자체에는 뜻이 없어요 — **문법 작업을 대신 해주는 도우미(조동사)**예요. 영어 의문문은 동사를 주어 앞으로 보내야 하는데, 일반동사 대신 **대리인 do가 앞으로 가고** 진짜 동사는 원형으로 제자리에 남아요.\n\n" +
          "부정도 마찬가지 — not을 붙일 받침대로 do가 들어와서 do not(don't)이 됩니다.",
        examples: [
          { en: "Do you like coffee?", ko: "커피 좋아해요?", note: "do가 앞으로, like는 제자리에" },
          { en: "I don't eat meat.", ko: "저는 고기를 안 먹어요." },
          { en: "Do they live near here?", ko: "그들은 이 근처에 살아요?" },
        ],
        vsKo: "한국어 '하다'에도 비슷한 그림자가 있어요 — '공부하다'를 부정하면 '공부 안 **하**다', 강조하면 '공부를 하긴 **하**지'처럼 '하다'가 문법 작업을 받아주죠. do도 정확히 그런 만능 받침대예요. 실제로 영어도 강조할 때 do를 써요: I **do** like coffee!(진짜 좋아한다니까요!)",
      },
      {
        heading: "부정문 — don't / doesn't + 동사원형",
        pattern: "주어 + don't/doesn't + 동사원형",
        patternKo: "-s는 doesn't로 이사 — 동사는 원형 복귀",
        body:
          "핵심은 3인칭이에요. she likes의 부정문에서 -s가 **doesn't로 이사**를 가서, 동사는 원형으로 돌아가요 — She doesn't **like** coffee. (likes 아님!)\n\n" +
          "2챕터에서 심어둔 원리 그대로 — **3인칭 -s 표시는 문장에 딱 한 번**. does가 이미 -s를 달고 있으니 동사까지 달면 이중 표시예요.",
        examples: [
          { en: "I don't understand.", ko: "이해가 안 돼요." },
          { en: "She doesn't like coffee.", ko: "그녀는 커피를 안 좋아해요.", note: "doesn't + like (원형)" },
          { en: "He doesn't have a car.", ko: "그는 차가 없어요.", note: "has가 아니라 have로 복귀" },
          { en: "It doesn't work.", ko: "이거 작동이 안 돼요.", note: "고장났을 때 만능 표현" },
        ],
        pitfall: "'She doesn't likes coffee.'(X) — 이중 -s는 한국 학습자 답안지의 최다 빈출 오류 중 하나예요. doesn't가 보이는 순간 뒤 동사는 무조건 민낯(원형)이라고 기억하세요. 의문문의 'Does she likes~?'(X)도 같은 원리로 차단됩니다.",
      },
      {
        heading: "의문문 — Do/Does를 문 앞에 세우기",
        pattern: "(의문사 +) Do/Does + 주어 + 동사원형 ~?",
        patternKo: "물을 땐 Do/Does를 맨 앞에, 의문사는 그보다 더 앞에",
        body:
          "대답은 do로 받아요 — Yes, I do. / No, I don't. 동사를 반복하는 대신 do가 동사를 대신해주는 거예요.\n\n" +
          "what, where, when 같은 의문사가 있으면 **의문사 + do/does + 주어 + 동사원형** — 의문사가 맨 앞, 그다음은 평소 의문문 그대로예요.",
        examples: [
          { en: "Do you speak English? — Yes, I do.", ko: "영어 하세요? — 네, 해요." },
          { en: "Does she work on Saturdays?", ko: "그녀는 토요일에도 일해요?" },
          { en: "Where do you live?", ko: "어디 살아요?" },
          { en: "What does this word mean?", ko: "이 단어 무슨 뜻이에요?", note: "수업 필수 표현 — What means this?(X)" },
        ],
        pitfall: "'What means this word?'(X)는 의문사를 주어로 착각해서 나오는 고전 오류예요. what은 목적어고 주어는 this word — 그러니 does가 필요해요: What **does** this word **mean**? 통째로 외워둘 가치가 있는 문장입니다.",
      },
      {
        heading: "be 동사 문장에는 do를 쓰지 않아요",
        pattern: "be 문장 → be 스스로 · 일반동사 문장 → do 호출",
        patternKo: "동사가 be인가, 일반동사인가 — 0.5초 분기",
        body:
          "영어 문장은 둘 중 하나예요 — be 문장은 be 스스로 해결(Are you ~? / I'm not ~), 일반동사 문장은 do의 도움(Do you ~? / I don't ~). 둘을 섞으면 'Do you be happy?'(X), 'I don't am tired.'(X)가 나와요.\n\n" +
          "문장을 만들기 전에 0.5초만 물으세요 — **'이 문장의 동사가 be인가, 일반동사인가?'** 이 분기 하나로 의문·부정의 절반이 해결돼요.",
        table: {
          caption: "be vs 일반동사 — 의문·부정 매트릭스",
          headers: ["", "be 동사", "일반동사"],
          rows: [
            ["평서", "She is busy.", "She works hard."],
            ["부정", "She isn't busy.", "She doesn't work hard."],
            ["의문", "Is she busy?", "Does she work hard?"],
          ],
        },
        examples: [
          { en: "Are you hungry?", ko: "배고파요?", note: "be의 세계 — do 없이" },
          { en: "Do you want some food?", ko: "뭐 좀 먹을래요?", note: "일반동사의 세계 — do로" },
        ],
        tip: "'Are you like coffee?'(X)는 be와 do의 세계가 충돌한 문장이에요. like는 일반동사 → Do you like coffee? 헷갈릴 땐 평서문을 먼저 떠올려보세요 — You **like** coffee(일반동사)인지 You **are** ~(be)인지 보면 답이 나와요.",
      },
    ],
  },

  {
    slug: "a1-08-prepositions-basic",
    level: "A1",
    order: 8,
    title: "점이냐, 면이냐, 공간이냐",
    topic: "전치사 in/on/at",
    titleFr: "Prepositions: in / on / at",
    summary: "한국어 조사 '에' 하나로 끝나던 시간·장소 표현이 영어에선 in/on/at 셋으로 갈라져요. 점·면·공간 프레임으로 정리합니다.",
    duration: "약 10분",
    sections: [
      {
        heading: "프레임 하나로 셋을 다 — 점·면·공간",
        pattern: "at = 점 · on = 면 · in = 공간",
        patternKo: "크기 순: at(점) < on(면) < in(공간)",
        body:
          "한국어 '에' 하나를 영어는 **at, on, in** 셋으로 나눠요. 무작정 외우기 전에 그림 하나를 잡으세요 — **at은 지도·시계 위의 한 점, on은 표면·달력의 한 칸, in은 둘러싸인 공간 안**.\n\n" +
          "크기로 줄을 세우면 **at(점) < on(면) < in(공간)**. 시간이든 장소든 이 그림이 그대로 적용돼요.",
        examples: [
          { en: "at the bus stop", ko: "버스 정류장에서", note: "지도 위의 한 점" },
          { en: "on the table", ko: "테이블 위에", note: "표면에 닿음" },
          { en: "in the box", ko: "상자 안에", note: "공간 속" },
        ],
        vsKo: "한국어 '에'는 시간·장소·방향을 다 덮는 만능 조사예요. 영어 전치사는 그 만능 키를 **모양별 열쇠 꾸러미**로 바꾼 것 — 처음엔 번거롭지만, '점이냐 면이냐 공간이냐'라는 질문 하나로 좁혀지니 생각보다 금방 손에 익어요.",
      },
      {
        heading: "시간의 in/on/at",
        pattern: "at 7:00 · on Monday · in May",
        patternKo: "하루보다 짧으면 at, 딱 하루면 on, 길면 in",
        body:
          "시간에 적용하면 **at + 시각**(at noon), **on + 요일·날짜**(on Monday), **in + 달·계절·연도**(in 2026)예요.\n\n" +
          "하루보다 짧으면 at, 딱 하루면 on, 하루보다 길면 in — 이 한 줄이면 80%는 해결돼요.",
        table: {
          caption: "시간 전치사 매트릭스",
          headers: ["전치사", "단위", "예시"],
          rows: [
            ["at", "시각 (점)", "at 7:30, at noon, at night"],
            ["on", "요일·날짜 (하루)", "on Friday, on June 9th, on weekends"],
            ["in", "달·계절·연도 (기간)", "in March, in summer, in 2026"],
            ["in", "하루의 부분 (예외 주의)", "in the morning / afternoon / evening"],
          ],
        },
        examples: [
          { en: "The movie starts at seven.", ko: "영화는 7시에 시작해요." },
          { en: "I have a class on Monday.", ko: "월요일에 수업이 있어요." },
          { en: "My birthday is in October.", ko: "제 생일은 10월에 있어요." },
          { en: "I study in the morning and work at night.", ko: "아침에 공부하고 밤에 일해요.", note: "morning은 in, night은 at — 짝으로 암기" },
        ],
        pitfall: "**in the morning이지만 at night** — 규칙의 예외라 시험에도 회화에도 단골이에요. 그리고 today, tomorrow, this week, last year, every day 앞에는 전치사를 **아예 안 써요**. 'I met him last year.'(O) / 'in last year'(X).",
      },
      {
        heading: "장소의 in/on/at",
        pattern: "at the station(지점) · on the wall(표면) · in Seoul(내부)",
        patternKo: "장소도 같은 그림 — 같은 곳도 보는 눈에 따라 전치사가 바뀜",
        body:
          "장소도 같은 그림이에요 — **at + 지점**(at the door, at school), **on + 표면·선**(on the wall, on the second floor), **in + 내부**(in my bag, in Seoul, in Korea).\n\n" +
          "재미있는 건 **같은 장소도 보는 눈에 따라 전치사가 바뀐다**는 거예요. 'at school'은 학교를 점으로 본 것, 'in the school'은 건물 내부에 있다는 뜻이에요.",
        examples: [
          { en: "I'm at the bus stop.", ko: "저 버스 정류장이에요.", note: "위치를 점으로" },
          { en: "Your keys are on the desk.", ko: "열쇠는 책상 위에 있어요." },
          { en: "She lives in Seoul.", ko: "그녀는 서울에 살아요.", note: "도시·나라는 in" },
          { en: "The picture is on the wall.", ko: "그림이 벽에 걸려 있어요.", note: "벽은 표면 → on" },
        ],
        tip: "교통수단도 이 그림을 따라요 — 버스·기차·비행기는 안에서 서서 걸을 수 있는 '바닥(면)'이 있어서 **on** the bus, 승용차는 몸을 구겨 넣는 공간이라 **in** the car. 원어민의 공간 감각이 보이는 재미있는 지점이에요.",
      },
      {
        heading: "한국인이 자주 틀리는 세트 모음",
        pattern: "go home(to 없이) · listen to music · marry her(with 없이)",
        patternKo: "전치사는 동사와 한 덩어리로 암기",
        body:
          "조사 '에/와' 감각 때문에 자주 틀리는 세트: **① go home** — to 없이(home은 부사), **② listen to music** — to 필수, **③ marry her** — with 없이.\n\n" +
          "전치사는 단어 단위가 아니라 **동사와 한 덩어리(go home / listen to / arrive at)**로 외우는 게 정석이에요.",
        examples: [
          { en: "I want to go home.", ko: "집에 가고 싶어요.", note: "go to home(X)" },
          { en: "I listen to music on the subway.", ko: "지하철에서 음악을 들어요.", note: "listen music(X)" },
          { en: "We arrived at the hotel at ten.", ko: "우리는 10시에 호텔에 도착했어요.", note: "arrive는 at과 짝" },
        ],
        pitfall: "go to home(X)은 '집에'의 '에'를 to로 직역해서 생기는, 한국인 영어의 대표 화석이에요. go home, come home, get home — home 앞은 항상 맨몸이라고 묶어서 기억하세요. (단, 명사로 쓰일 땐 전치사 가능: at home '집에서'.)",
      },
    ],
  },
];

export default chapters;
