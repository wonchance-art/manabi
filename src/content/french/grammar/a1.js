/**
 * A1 기초 — 프랑스어 문장의 뼈대 세우기
 * 주어+동사부터 숫자·시간까지, 첫 문장을 만들고 굴리는 데 필요한 핵심 문법.
 */
const chapters = [
  {
    slug: "a1-01-pronouns-etre",
    level: "A1",
    order: 1,
    title: "\"저는 한국인이에요\" — 첫 문장 만들기",
    topic: "주어 인칭대명사·être",
    titleFr: "Les pronoms sujets et le verbe être",
    summary: "je/tu/il... 9개의 주어 대명사와 가장 중요한 동사 être. C'est와 구어의 만능 주어 on까지 함께 배워요.",
    duration: "약 9분",
    sections: [
      {
        heading: "주어 인칭대명사 — 프랑스어 문장의 필수품",
        pattern: "je · tu · il/elle/on · nous · vous · ils/elles + 동사",
        patternKo: "주어 대명사는 절대 생략 불가",
        body:
          "프랑스어 문장은 **주어 + 동사**로 시작하고, 그 주어 자리를 인칭대명사가 채워요.\n\n" +
          "주의 둘. il/elle은 사람뿐 아니라 **사물도** 가리켜요(le livre → il, la table → elle). 그리고 ils는 **남녀가 섞인 무리**에도 써요 — 남자 1명 + 여자 9명이어도 ils.",
        examples: [
          { fr: "Il est petit.", ipa: "[il ɛ pəti]", ko: "그는 (또는 그것은) 작아요.", note: "il = 남성 명사라면 무엇이든" },
          { fr: "Elle est grande.", ipa: "[ɛl ɛ gʁɑ̃d]", ko: "그녀는 (또는 그것은) 커요." },
        ],
        pitfall: "한국어는 '밥 먹었어?'처럼 주어를 자연스럽게 생략하지만, 프랑스어는 **주어 대명사를 절대 생략할 수 없어요**. 'Suis coréen'은 틀린 문장 — 반드시 'Je suis coréen'. 한국어 습관이 가장 오래 남는 실수 지점이에요.",
      },
      {
        heading: "être 활용 — 영어 be 동사의 프랑스 버전",
        pattern: "je suis · tu es · il est · nous sommes · vous êtes · ils sont",
        patternKo: "'~이다' être의 6인칭 불규칙 활용 한 세트",
        body:
          "**être**(~이다, 있다)는 프랑스어 최다 빈도 동사예요. 인칭마다 모양이 완전히 달라지는 불규칙 동사라 표를 통째로 입에 붙여야 해요.\n\n" +
          "발음 포인트: tu es와 il est는 둘 다 [ɛ]로 **소리가 같고**, vous êtes는 리에종으로 '부제트'[vuzɛt]가 돼요.",
        table: {
          caption: "être 직설법 현재",
          headers: ["인칭", "형태", "발음"],
          rows: [
            ["je", "suis", "[ʒə sɥi]"],
            ["tu", "es", "[ty ɛ]"],
            ["il / elle / on", "est", "[il ɛ]"],
            ["nous", "sommes", "[nu sɔm]"],
            ["vous", "êtes", "[vuzɛt]"],
            ["ils / elles", "sont", "[il sɔ̃]"],
          ],
        },
        examples: [
          { fr: "Je suis coréenne.", ipa: "[ʒə sɥi kɔʁeɛn]", ko: "저는 한국인이에요. (여성)" },
          { fr: "Nous sommes à Paris.", ipa: "[nu sɔm a paʁi]", ko: "우리는 파리에 있어요." },
          { fr: "Vous êtes professeur ?", ipa: "[vuzɛt pʁɔfɛsœʁ]", ko: "선생님이세요?", note: "직업 앞에는 관사를 안 붙여요" },
        ],
        vsEn: "être는 영어 be와 역할이 거의 같아요. I am = je suis, you are = tu es / vous êtes, he is = il est. 영어에서 am/are/is를 외웠듯 suis/es/est/sommes/êtes/sont를 한 세트로 외우면 돼요.",
        enParallel: {
          rows: [
            { en: "I **am** Korean.", fr: "Je **suis** coréen.", ipa: "[ʒə sɥi kɔʁeɛ̃]", ko: "저는 한국인이에요." },
            { en: "She **is** a teacher.", fr: "Elle **est** professeur.", ipa: "[ɛl ɛ pʁɔfɛsœʁ]", ko: "그녀는 선생님이에요." },
            { en: "We **are** in Paris.", fr: "Nous **sommes** à Paris.", ipa: "[nu sɔm a paʁi]", ko: "우리는 파리에 있어요." },
          ],
          note: "**주어 + be + 보어** 어순이 영어와 완전히 같아요. am/is/are 자리에 suis/est/sommes를 끼우면 끝 — 영어로 만든 문장을 그대로 단어만 바꾸면 돼요.",
        },
      },
      {
        heading: "C'est ... — '이것은/그것은 ~이에요'의 만능 공식",
        pattern: "C'est + 명사/형용사 · 복수 → Ce sont",
        patternKo: "'이것은/그것은 ~이에요'의 만능 소개 공식",
        body:
          "**c'est**(= ce + est)는 사물 소개, 사람 소개, 감상 표현까지 한 방에 처리하는 만능 표현이에요.\n\n" +
          "복수일 때는 **ce sont**을 쓰지만, 구어에서는 복수에도 c'est를 쓰는 경우가 많아요.",
        examples: [
          { fr: "C'est un livre.", ipa: "[sɛtœ̃ livʁ]", ko: "이것은 책이에요." },
          { fr: "C'est ma sœur.", ipa: "[sɛ ma sœʁ]", ko: "이 사람은 제 여동생(언니/누나)이에요." },
          { fr: "C'est bon !", ipa: "[sɛ bɔ̃]", ko: "맛있어요! / 좋아요!", note: "감상 한 마디의 만능 틀" },
          { fr: "Ce sont mes amis.", ipa: "[sə sɔ̃ mezami]", ko: "이 사람들은 제 친구들이에요." },
        ],
        tip: "뭐라고 말할지 막힐 때 C'est + 명사/형용사만으로도 대화가 굴러가요. C'est bien(좋네요), C'est vrai ?(정말요?), C'est ça(바로 그거예요)는 통째로 외워두세요.",
      },
      {
        heading: "on — 사전에 없는 진짜 '우리'",
        pattern: "on = 구어의 '우리' → 동사는 3인칭 단수 (on est)",
        patternKo: "구어의 '우리' — 뜻은 복수, 동사는 단수",
        body:
          "실제 프랑스인의 입에서 나오는 '우리'는 대부분 **on**이에요. 원래 '사람들, 누군가'를 뜻하는 대명사인데 구어에서 nous를 거의 대체했고, 문법적으로는 **3인칭 단수** 취급이라 활용도 쉬워요.\n\n" +
          "정리하면: 글·격식에서는 nous, 입으로 말할 때는 on. 둘 다 알아들을 수 있어야 해요.",
        examples: [
          { fr: "On est coréens.", ipa: "[ɔ̃nɛ kɔʁeɛ̃]", ko: "우리는 한국인이에요. (구어)", note: "동사는 단수형 est" },
          { fr: "On va au cinéma ?", ipa: "[ɔ̃ va o sinema]", ko: "우리 영화관 갈래?" },
          { fr: "En France, on mange du fromage.", ipa: "[ɑ̃ fʁɑ̃s ɔ̃ mɑ̃ʒ dy fʁɔmaʒ]", ko: "프랑스에서는 (사람들이) 치즈를 먹어요.", note: "'일반적인 사람들' 용법" },
        ],
        pitfall: "on은 뜻은 '우리(복수)'여도 동사는 반드시 **단수형**이에요. 'On sont'은 틀린 문장 — On est가 맞아요. 의미와 문법이 따로 노는 단어이니 'on = il/elle 자리에 끼워 넣는 우리'로 기억하세요.",
      },
    ],
  },

  {
    slug: "a1-02-avoir",
    level: "A1",
    order: 2,
    title: "\"배고파요\"도 '가지다'로 말한다",
    topic: "avoir·il y a",
    titleFr: "Le verbe avoir",
    summary: "두 번째 필수 동사 avoir. 활용표와 함께, 배고픔·나이까지 avoir로 말하는 프랑스어 특유의 발상을 배워요.",
    duration: "약 8분",
    sections: [
      {
        heading: "avoir 활용 — 리에종 주의보",
        pattern: "j'ai · tu as · il a · nous avons · vous avez · ils ont",
        patternKo: "'가지다' avoir의 6인칭 활용 — 리에종 [z] 주의",
        body:
          "**avoir**(가지다)는 être와 함께 프랑스어의 양대 기둥이에요. 나중에 배울 과거시제(passé composé)의 재료도 되니 활용을 입에 완전히 붙여야 해요.\n\n" +
          "발음 포인트: je + ai는 **j'ai**[ʒe]로 축약되고, nous avons, vous avez, ils ont은 모두 리에종으로 [z]가 끼어들어요 — '누자봉, 부자베, 일종'.",
        table: {
          caption: "avoir 직설법 현재",
          headers: ["인칭", "형태", "발음"],
          rows: [
            ["j'", "ai", "[ʒe]"],
            ["tu", "as", "[ty a]"],
            ["il / elle / on", "a", "[il a]"],
            ["nous", "avons", "[nuzavɔ̃]"],
            ["vous", "avez", "[vuzave]"],
            ["ils / elles", "ont", "[ilzɔ̃]"],
          ],
        },
        examples: [
          { fr: "J'ai un chat.", ipa: "[ʒe œ̃ ʃa]", ko: "저는 고양이 한 마리가 있어요." },
          { fr: "Tu as des frères ?", ipa: "[ty a de fʁɛʁ]", ko: "너 형제 있어?" },
          { fr: "Elles ont une question.", ipa: "[ɛlzɔ̃ yn kɛstjɔ̃]", ko: "그녀들은 질문이 하나 있어요." },
        ],
        pitfall: "ils ont(가지고 있다)[il-**z**ɔ̃]과 ils sont(~이다)[il-**s**ɔ̃]은 [z]와 [s] 하나로 갈려요. A0 리에종 챕터에서 예고했던 바로 그 함정 — 말할 때도 s를 [z]로 부활시키는 걸 잊으면 정반대 동사가 돼요.",
      },
      {
        heading: "avoir 숙어 — 배고픔도 나이도 '가지는' 언어",
        pattern: "avoir + faim / soif / chaud / froid / sommeil / peur / ... ans",
        patternKo: "상태와 나이는 '가지는' 것",
        body:
          "프랑스어는 몸의 상태와 나이를 **avoir로** 표현해요. 직역하면 '배고픔을 가지고 있다', '20년을 가지고 있다'가 되는 식이죠.\n\n" +
          "이때 faim, soif 등은 **관사 없이** 통째로 굳은 숙어예요. 분석하지 말고 덩어리로 외우세요.",
        examples: [
          { fr: "J'ai faim.", ipa: "[ʒe fɛ̃]", ko: "배고파요." },
          { fr: "Tu as soif ?", ipa: "[ty a swaf]", ko: "목말라?" },
          { fr: "J'ai vingt ans.", ipa: "[ʒe vɛ̃tɑ̃]", ko: "저는 스무 살이에요.", note: "vingt의 t가 리에종으로 부활 — '뱅떵'" },
          { fr: "Il a froid.", ipa: "[il a fʁwa]", ko: "그는 추워요." },
        ],
        vsEn: "영어는 be로 말하는 것들이에요 — I **am** hungry, I **am** 20 years old. 프랑스어는 전부 avoir: J'**ai** faim, J'**ai** 20 ans. 영어 습관대로 'Je suis faim', 'Je suis 20 ans'라고 하면 틀려요. '상태와 나이는 가지는 것'이라고 발상을 통째로 바꿔야 해요.",
      },
      {
        heading: "il y a — '~이 있다'의 공식",
        pattern: "il y a + 명사 → ~이 있다 (단수·복수 동일)",
        patternKo: "'~이 있다' — 단수든 복수든 형태는 하나",
        body:
          "영어 there is/there are에 해당하지만, 단수든 복수든 **형태가 il y a 하나**라서 오히려 쉬워요.\n\n" +
          "발음은 [ilja] '일리야' — 세 단어지만 한 덩어리로 굴러가요. 구어에서는 [ja]까지 줄어들기도 해요.",
        examples: [
          { fr: "Il y a un café ici.", ipa: "[ilja œ̃ kafe isi]", ko: "여기 카페가 하나 있어요." },
          { fr: "Il y a des livres sur la table.", ipa: "[ilja de livʁ syʁ la tabl]", ko: "탁자 위에 책들이 있어요.", note: "복수여도 il y a 그대로" },
          { fr: "Il y a un problème ?", ipa: "[ilja œ̃ pʁɔblɛm]", ko: "무슨 문제 있어요?" },
        ],
        enParallel: {
          rows: [
            { en: "There **is** a café here.", fr: "**Il y a** un café ici.", ipa: "[ilja œ̃ kafe isi]", ko: "여기 카페가 하나 있어요." },
            { en: "There **are** books on the table.", fr: "**Il y a** des livres sur la table.", ipa: "[ilja de livʁ syʁ la tabl]", ko: "탁자 위에 책들이 있어요." },
          ],
          note: "il y a 하나로 there is·there are 둘 다 — 영어처럼 단복수 구분이 없어요.",
        },
        tip: "il y a의 il은 '그'가 아니라 비인칭 가짜 주어예요. 날씨의 il fait(날씨가 ~하다)처럼, 프랑스어는 주어 없는 문장을 못 견뎌서 il을 채워 넣는다고 생각하면 돼요.",
      },
    ],
  },

  {
    slug: "a1-03-er-verbs",
    level: "A1",
    order: 3,
    title: "하나만 외우면 90%가 풀린다",
    topic: "1군 -er 동사 활용",
    titleFr: "Les verbes en -er",
    summary: "parler, aimer, habiter... 프랑스어 동사의 약 90%가 따르는 -er 패턴 하나로 동사 활용의 문이 열려요.",
    duration: "약 9분",
    sections: [
      {
        heading: "동사 원형과 1군 동사",
        pattern: "원형 - er = 어간 → 어간 + -e, -es, -e, -ons, -ez, -ent",
        patternKo: "-er를 뗀 어간에 인칭별 어미만 붙이면 끝",
        body:
          "사전에 실리는 기본형을 **원형(infinitif)**이라고 해요. parler, aimer처럼 **-er로 끝나는 1군 동사**가 프랑스어 동사의 약 90%예요.\n\n" +
          "원형에서 -er를 뗀 **어간**에 인칭별 어미를 붙이면 끝. 새 동사가 생겨도(googler, liker) 전부 이 패턴을 따라요.",
        examples: [
          { fr: "parler", ipa: "[paʁle]", ko: "말하다 (원형)", note: "-er의 r는 묵음 — '빠를레'" },
          { fr: "aimer", ipa: "[ɛme]", ko: "좋아하다, 사랑하다 (원형)" },
          { fr: "habiter", ipa: "[abite]", ko: "살다, 거주하다 (원형)", note: "h는 묵음" },
        ],
        etym: "habiter는 라틴어 habitāre(거주하다)에서 왔어요. 영어 inhabit(거주하다), habitat(서식지)와 같은 뿌리 — '해비탯'을 떠올리면 뜻이 바로 보여요.",
      },
      {
        heading: "활용표 — 쓰기는 6개, 소리는 사실상 3개",
        pattern: "-e, -es, -ent → 묵음 = [paʁl] · -ons → [ɔ̃] · -ez → [e]",
        patternKo: "철자는 여섯, 귀에 들리는 소리는 사실상 셋",
        body:
          "결정적인 발음 포인트: 어미 **-e, -es, -ent는 전부 묵음**이에요. 그래서 je parle, tu parles, il parle, ils parlent **네 개가 똑같은 소리** [paʁl]이죠.\n\n" +
          "귀로 구별되는 건 [paʁl] / [paʁlɔ̃] / [paʁle] 세 가지뿐이에요. 듣기가 편해지는 대신, 쓰기에서는 안 들리는 어미를 철자로 챙겨야 해요.",
        table: {
          caption: "parler 직설법 현재 — 묵음 어미 주의",
          headers: ["인칭", "형태", "발음"],
          rows: [
            ["je", "parle", "[ʒə paʁl]"],
            ["tu", "parles", "[ty paʁl]"],
            ["il / elle / on", "parle", "[il paʁl]"],
            ["nous", "parlons", "[nu paʁlɔ̃]"],
            ["vous", "parlez", "[vu paʁle]"],
            ["ils / elles", "parlent", "[il paʁl]"],
          ],
        },
        pitfall: "ils parlent을 한글 표기 감각으로 '일 빠를렁'이라고 읽는 실수가 정말 많아요. **-ent 어미는 완전한 묵음** — il parle와 ils parlent은 소리가 100% 같아요. 단수인지 복수인지는 리에종이나 문맥으로만 구별돼요.",
        vsEn: "영어 동사는 3인칭 단수에서만 -s가 붙죠(he speaks). 프랑스어는 여섯 인칭 모두 어미가 다르지만, 발음상으로는 영어 못지않게 단순해요. '철자는 화려하고 소리는 소박하다'가 1군 동사의 본질이에요.",
        enParallel: {
          rows: [
            { en: "I **speak** French.", fr: "Je **parle** français.", ipa: "[ʒə paʁl fʁɑ̃sɛ]", ko: "저는 프랑스어를 해요." },
            { en: "We **study** French.", fr: "Nous **étudions** le français.", ipa: "[nuzetydjɔ̃ lə fʁɑ̃sɛ]", ko: "우리는 프랑스어를 공부해요." },
            { en: "She **works** in Paris.", fr: "Elle **travaille** à Paris.", ipa: "[ɛl tʁavaj a paʁi]", ko: "그녀는 파리에서 일해요." },
          ],
          note: "주어+동사+목적어 어순이 영어와 같아요. 영어 3인칭 -s처럼, 프랑스어는 인칭마다 어미만 바뀔 뿐 골격은 동일.",
        },
      },
      {
        heading: "자주 쓰는 -er 동사로 문장 만들기",
        pattern: "je + 모음/무음 h 시작 동사 → j' (j'aime, j'habite)",
        patternKo: "모음으로 시작하는 동사 앞에서 je는 j'로 축약",
        body:
          "일상 대화의 주력 동사들이 거의 다 1군이에요: **aimer**(좋아하다), **habiter**(살다), **travailler**(일하다), **étudier**(공부하다), **regarder**(보다), **manger**(먹다).\n\n" +
          "모음(또는 무음 h)으로 시작하는 동사는 je가 **j'**로 축약돼요: j'aime, j'habite, j'étudie.",
        examples: [
          { fr: "J'habite à Séoul.", ipa: "[ʒabit a seul]", ko: "저는 서울에 살아요." },
          { fr: "Tu aimes le cinéma ?", ipa: "[ty ɛm lə sinema]", ko: "너 영화 좋아해?" },
          { fr: "Nous étudions le français.", ipa: "[nuzetydjɔ̃ lə fʁɑ̃sɛ]", ko: "우리는 프랑스어를 공부해요." },
          { fr: "Elle travaille à Paris.", ipa: "[ɛl tʁavaj a paʁi]", ko: "그녀는 파리에서 일해요." },
          { fr: "Ils regardent la télévision.", ipa: "[il ʁəgaʁd la televizjɔ̃]", ko: "그들은 텔레비전을 봐요.", note: "-ent 묵음 — '흐갸르드'까지만" },
        ],
        tip: "철자 미세 조정 두 가지만 미리 알아두세요. manger는 nous mang**e**ons(g 소리 [ʒ] 유지용 e), commencer는 nous commen**ç**ons(세디유로 [s] 유지). 발음 규칙을 지키기 위한 화장 같은 것이라 소리는 규칙 그대로예요.",
      },
    ],
  },

  {
    slug: "a1-04-negation",
    level: "A1",
    order: 4,
    title: "\"커피는 안 마셔요\" — 아니라고 말하기",
    topic: "부정문 ne…pas",
    titleFr: "La négation : ne ... pas",
    summary: "부정은 단어 하나가 아니라 ne와 pas 두 조각으로 동사를 감싸요. 구어의 ne 탈락과 pas de 규칙까지.",
    duration: "약 8분",
    sections: [
      {
        heading: "기본 공식 — ne + 동사 + pas",
        pattern: "ne + 동사 + pas",
        patternKo: "동사를 샌드위치처럼 감싸는 부정",
        body:
          "부정어 한 단어가 아니라, **ne와 pas 두 조각으로 동사를 감싸요**. Je parle → Je **ne** parle **pas**.\n\n" +
          "빵(ne)—패티(동사)—빵(pas) 구조예요. 감싸는 대상은 어디까지나 **활용된 동사**예요.",
        examples: [
          { fr: "Je ne parle pas chinois.", ipa: "[ʒə nə paʁl pa ʃinwa]", ko: "저는 중국어를 못해요." },
          { fr: "Il ne travaille pas.", ipa: "[il nə tʁavaj pa]", ko: "그는 일하지 않아요." },
          { fr: "Ce n'est pas vrai !", ipa: "[sə nɛ pa vʁɛ]", ko: "그건 사실이 아니에요!", note: "ne + est → n'est 축약" },
        ],
        vsEn: "영어는 don't/doesn't라는 조동사를 빌려와 동사 앞에 세우죠(I don't speak). 프랑스어는 조동사 없이 동사를 직접 포위해요. '부정 = 두 조각 포위'라는 그림만 잡으면 영어보다 오히려 단순해요.",
      },
      {
        heading: "모음 앞에서는 n' — 그리고 발음 흐름",
        pattern: "ne + 모음/무음 h → n' (Je n'aime pas)",
        patternKo: "모음 앞에서 ne는 n'로 — 부정의 무게는 pas에",
        body:
          "ne는 모음이나 무음 h 앞에서 **n'**로 축약돼요: Je n'aime pas, Je n'habite pas.\n\n" +
          "ne의 [ə]는 약한 소리라 실제 발화에서는 거의 스쳐 지나가요. 부정의 무게는 사실 **pas** 쪽에 실려 있어요.",
        examples: [
          { fr: "Je n'aime pas le sport.", ipa: "[ʒə nɛm pa lə spɔʁ]", ko: "저는 운동을 안 좋아해요." },
          { fr: "Elle n'écoute pas.", ipa: "[ɛl nekut pa]", ko: "그녀는 듣지 않아요." },
        ],
      },
      {
        heading: "pas de — 부정문에서 관사가 변신해요",
        pattern: "부정문: un/une/des → de (모음 앞 d')",
        patternKo: "부정문에서 부정관사가 de로 변신 (être 뒤는 예외)",
        body:
          "J'ai **un** chat → Je n'ai pas **de** chat. '하나도 없음'의 세계에서는 '하나(un)'라는 말이 무의미해지니 중립적인 de로 갈아탄다고 이해하면 돼요.\n\n" +
          "단, **être 뒤에서는 그대로**(Ce n'est pas un chat)이고, 정관사 le/la/les도 유지돼요(Je n'aime pas le café).",
        examples: [
          { fr: "Je n'ai pas de chat.", ipa: "[ʒə nɛ pa də ʃa]", ko: "저는 고양이가 없어요.", note: "un → de" },
          { fr: "Il n'y a pas de problème.", ipa: "[ilnja pa də pʁɔblɛm]", ko: "문제없어요.", note: "il y a의 부정 — 통째로 암기" },
          { fr: "Je n'ai pas d'amis ici.", ipa: "[ʒə nɛ pa dami isi]", ko: "저는 여기 친구가 없어요.", note: "des → d'" },
          { fr: "Ce n'est pas une question.", ipa: "[sə nɛ pa yn kɛstjɔ̃]", ko: "그건 질문이 아니에요.", note: "être 뒤라 une 유지" },
        ],
        pitfall: "'Je n'ai pas un chat'은 한국 학습자가 가장 오래 끌고 가는 실수예요. **부정의 pas 뒤에서 un/une/des는 de** — 영어에도 한국어에도 없는 규칙이라 의식적으로 연습해야 해요.",
        tip: "여기서는 '부정문에서 un/une/des가 de로 바뀐다'는 현상만 기억해두세요. 관사 자체(정관사·부정관사의 형태와 쓰임)는 뒤에 나오는 관사 챕터에서 처음부터 차근차근 정리해요.",
      },
      {
        heading: "구어에서는 ne가 사라져요",
        pattern: "구어: Je (ne) sais pas → Je sais pas",
        patternKo: "일상 대화에서는 ne가 자주 탈락",
        body:
          "일상 대화에서는 **ne가 매우 자주 탈락**해요. Je ne sais pas가 Je sais pas → 빠르게는 'J'sais pas'[ʃɛpa]까지 줄어들죠.\n\n" +
          "글에서는 ne를 꼭 챙기되, **들을 때는 pas만으로 부정을 감지**할 수 있어야 해요.",
        examples: [
          { fr: "Je sais pas.", ipa: "[ʒə sɛ pa]", ko: "몰라. (구어)", note: "글에서는 Je ne sais pas" },
          { fr: "C'est pas grave.", ipa: "[sɛ pa gʁav]", ko: "괜찮아, 별일 아니야. (구어)" },
        ],
        tip: "시험·이메일·격식 말하기 = ne ... pas 풀 세트, 친구와 수다 = pas만. 한국어로 치면 '하지 않아요'와 '안 해'의 차이 같은 격식 스위치라고 생각하세요.",
      },
    ],
  },

  {
    slug: "a1-05-questions",
    level: "A1",
    order: 5,
    title: "끝만 올려도 질문이 된다",
    topic: "의문문 3형식·의문사",
    titleFr: "Les questions",
    summary: "억양만 올리기, est-ce que, 도치 — 격식 단계별 의문문 3종 세트와 의문사 6총사를 정리해요.",
    duration: "약 9분",
    sections: [
      {
        heading: "방법 1 — 억양만 올리기 (구어의 기본값)",
        pattern: "평서문 + 억양 ↗ (Tu parles français ?)",
        patternKo: "끝만 올리면 의문문 — 구어의 기본값",
        body:
          "평서문 그대로 두고 **문장 끝 억양만 올리면** 의문문이 돼요.\n\n" +
          "일상 회화에서 압도적으로 많이 쓰는 방식이에요. 친구 사이, 편한 상황에서는 이걸로 충분해요.",
        examples: [
          { fr: "Tu as faim ?", ipa: "[ty a fɛ̃]", ko: "배고파?" },
          { fr: "Vous habitez à Séoul ?", ipa: "[vuzabite a seul]", ko: "서울에 사세요?" },
          { fr: "C'est ton livre ?", ipa: "[sɛ tɔ̃ livʁ]", ko: "이거 네 책이야?" },
        ],
        vsEn: "영어는 의문문마다 do/does를 세우거나 어순을 뒤집어야 하지만(Do you speak...?), 프랑스어 구어는 **억양만으로 합법적인 의문문**이 돼요. 영어보다 쉬운 흔치 않은 지점이니 마음껏 누리세요.",
      },
      {
        heading: "방법 2 — Est-ce que : 만능 의문문 변환기",
        pattern: "Est-ce que + 평서문 ? (모음 앞 Est-ce qu')",
        patternKo: "평서문 앞에 붙이는 만능 의문문 스위치",
        body:
          "평서문 앞에 **Est-ce que**[ɛskə]만 붙이면 돼요. 어순을 건드리지 않는 안전한 방법이라 말하기 시험과 일반 회화 모두에서 표준이에요.\n\n" +
          "직역하면 '~인 것인가요?'쯤 되지만, 의미는 따지지 말고 **의문문 스위치**라고 생각하세요.",
        examples: [
          { fr: "Est-ce que tu parles français ?", ipa: "[ɛskə ty paʁl fʁɑ̃sɛ]", ko: "너 프랑스어 할 줄 알아?" },
          { fr: "Est-ce que vous avez des questions ?", ipa: "[ɛskə vuzave de kɛstjɔ̃]", ko: "질문 있으세요?" },
          { fr: "Est-ce qu'il est coréen ?", ipa: "[ɛskil ɛ kɔʁeɛ̃]", ko: "그는 한국인인가요?" },
        ],
        tip: "막히면 무조건 Est-ce que. 억양 의문문은 너무 캐주얼할까 걱정되고 도치는 어려울 때, est-ce que는 모든 상황에서 안전한 중간 지대예요.",
      },
      {
        heading: "방법 3 — 도치 : 격식의 영역",
        pattern: "동사-주어 ? (Parlez-vous... · 모음 충돌 시 A-t-il ?)",
        patternKo: "주어와 동사를 뒤집는 격식 의문문",
        body:
          "주어와 동사를 뒤집고 하이픈으로 잇는 격식 의문문이에요. 3인칭에서 동사가 모음으로 끝나면 발음을 위해 **-t-**를 끼워 넣어요: Il a → A-**t**-il ?\n\n" +
          "A1에서는 직접 만들기보다, Parlez-vous anglais ? 같은 **굳은 표현으로 만나는 도치를 알아듣는 것**이 목표예요.",
        examples: [
          { fr: "Parlez-vous anglais ?", ipa: "[paʁle vu ɑ̃glɛ]", ko: "영어 하세요?" },
          { fr: "Êtes-vous fatigué ?", ipa: "[ɛt vu fatige]", ko: "피곤하세요?" },
          { fr: "A-t-il des frères ?", ipa: "[atil de fʁɛʁ]", ko: "그는 형제가 있나요?", note: "모음 충돌 방지용 -t-" },
        ],
      },
      {
        heading: "의문사 6총사 — où, quand, qui, que, comment, pourquoi",
        pattern: "의문사 + est-ce que ... ? · 구어: 평서문 + 의문사 ?",
        patternKo: "어디·언제·누구 등 의문사 여섯으로 묻기",
        body:
          "의문사 + est-ce que 조합이 가장 무난해요: Où est-ce que tu habites ?(어디 살아?)\n\n" +
          "구어에서는 의문사를 **문장 끝에 던지는** 방식도 아주 흔해요: Tu habites où ?",
        table: {
          caption: "기본 의문사",
          headers: ["의문사", "발음", "뜻", "예시"],
          rows: [
            ["où", "[u]", "어디", "Tu habites où ?"],
            ["quand", "[kɑ̃]", "언제", "C'est quand ?"],
            ["qui", "[ki]", "누구", "C'est qui ?"],
            ["que / quoi", "[kə / kwa]", "무엇", "Qu'est-ce que c'est ?"],
            ["comment", "[kɔmɑ̃]", "어떻게", "Comment ça va ?"],
            ["pourquoi", "[puʁkwa]", "왜", "Pourquoi pas ?"],
          ],
        },
        examples: [
          { fr: "Qu'est-ce que c'est ?", ipa: "[kɛskə sɛ]", ko: "이게 뭐예요?", note: "통째로 한 단어처럼 암기" },
          { fr: "Tu habites où ?", ipa: "[ty abit u]", ko: "너 어디 살아? (구어)" },
          { fr: "Pourquoi pas ?", ipa: "[puʁkwa pa]", ko: "왜 안 되겠어? (좋지!)", note: "제안 수락의 단골 표현" },
        ],
        pitfall: "'무엇'은 자리에 따라 모양이 달라요 — 문장 앞에서는 que(Qu'est-ce que...), 문장 끝이나 전치사 뒤에서는 quoi(C'est quoi ? / De quoi ?). 한국어 '뭐'는 하나뿐이라 헷갈리기 쉬운 지점이에요.",
      },
    ],
  },

  {
    slug: "a0-06-gender",
    level: "A1",
    order: 6,
    title: "모든 단어에 성별이 있다고?",
    topic: "명사의 성(genre)",
    titleFr: "Le genre des noms",
    summary: "한국인이 가장 낯설어하는 개념. 왜 책상이 '남성'인지, 그리고 단어 끝부분으로 성을 추측하는 요령을 배워요.",
    duration: "약 9분",
    sections: [
      {
        heading: "문법적 성이란 — '남자답다/여자답다'가 아니에요",
        pattern: "모든 명사 → masculin(남성) 또는 féminin(여성)",
        patternKo: "모든 명사는 남성 아니면 여성 — 뜻과는 무관한 칸 나누기",
        body:
          "**모든 명사**는 남성 아니면 여성이에요. '책이 왜 남자예요?'라는 질문의 답은 — **아무 이유 없어요**. 뜻과는 상관없이 문법이 정해놓은 칸 나누기일 뿐이라서, '수염'(la barbe 라 바흐브)은 여성, '화장'(le maquillage 르 마끼아주)은 남성이에요.\n\n" +
          "사람·동물은 대체로 자연 성별을 따라요: le père(르 뻬흐 — 아버지)/la mère(라 메흐 — 어머니).",
        examples: [
          { fr: "le livre", ipa: "[livʁ] 리브흐", ko: "책 (남성)", note: "이유는 묻지 않기로 해요" },
          { fr: "la table", ipa: "[tabl] 따블", ko: "탁자 (여성)" },
          { fr: "le père / la mère", ipa: "[pɛʁ / mɛʁ] 뻬흐 / 메흐", ko: "아버지 / 어머니", note: "사람은 자연 성별대로" },
        ],
        vsEn: "영어도 옛날엔 명사에 성이 있었어요(고대 영어). 지금은 사라져서 the 하나로 통일됐지만, 프랑스어는 라틴어의 성 구분을 그대로 물려받았어요. 영어가 오히려 유럽 언어 중 예외인 셈이에요.",
      },
      {
        heading: "어미를 보면 80%는 맞힌다",
        pattern: "-tion/-té/-ette/-ie → 여성 · -age/-ment/-eau/-isme → 남성",
        patternKo: "단어 끝부분만 보고 성을 80% 맞히는 추측 규칙",
        body:
          "단어의 **끝부분(어미)을 보면 성을 높은 확률로 추측**할 수 있어요. 아래 표의 대표 패턴만 외워두세요.",
        table: {
          caption: "성 추측 치트시트",
          headers: ["어미", "성", "예시"],
          rows: [
            ["-tion / -sion", "여성 (거의 100%)", "la question(께스띠옹), la télévision(뗄레비지옹)"],
            ["-té", "여성", "la liberté(리베흐떼), la beauté(보떼)"],
            ["-ette", "여성", "la baguette(바겟), la toilette(뚜알렛)"],
            ["-ie", "여성", "la vie(비), la boulangerie(불랑즈히)"],
            ["-age", "남성", "le fromage(프호마주), le voyage(부아야주)"],
            ["-ment", "남성 (거의 100%)", "le moment(모멍), le appartement → l'appartement(아빠흐뜨멍)"],
            ["-eau", "남성", "le bureau(뷔호), le cadeau(꺄도)"],
            ["-isme", "남성", "le tourisme(뚜히즘), l'optimisme(옵띠미즘)"],
          ],
        },
        etym: "-tion(여성)과 -té(여성)는 라틴어 여성 명사 어미 -tiō, -tās의 후손이에요. 영어 -tion, -ty가 같은 뿌리죠. 즉 nation/nationalité처럼 영어에서 -tion/-ty로 끝나는 단어는 프랑스어에서 거의 다 여성이라고 봐도 돼요.",
        pitfall: "물론 예외는 있어요. la page(빠주 — 페이지), le squelette(스껠렛 — 해골)처럼요. 그래서 규칙은 '추측용', 암기는 '관사째로' — 다음 섹션에서 이어집니다.",
      },
      {
        heading: "성을 외우는 유일한 정석 — 관사와 한 덩어리로",
        pattern: "암기 = 관사 + 명사 (livre ✗ → le livre ✓)",
        patternKo: "성 암기는 관사를 붙인 한 덩어리로",
        body:
          "단어는 **반드시 관사를 붙여서** 외우세요. 성을 틀리면 관사·형용사·대명사까지 줄줄이 틀리지만, 관사째 외워두면 나머지는 자동으로 따라와요.\n\n" +
          "모음으로 시작하는 단어는 l'eau(로)처럼 줄어들어 성이 안 보이니, **une eau(윈 오)처럼 '하나의'를 뜻하는 관사(부정관사)로** 외우는 요령이 있어요.",
        examples: [
          { fr: "le livre → un livre", ipa: "[lə livʁ] 르 리브흐", ko: "책 — 남성 세트로 암기" },
          { fr: "la table → une table", ipa: "[la tabl] 라 따블", ko: "탁자 — 여성 세트로 암기" },
          { fr: "l'eau (f.) → une eau", ipa: "[lo] 로", ko: "물 — 축약될 땐 부정관사로 성 확인" },
        ],
        tip: "단어장에 남성=파랑, 여성=빨강 색 코드를 정해두는 것도 좋지만, 브랜드명도 훌륭한 암기 카드예요. 라네즈(la neige 라 네주, 눈)는 여성이라 la가 맞고, 마몽드(Ma Monde)는 monde(몽드)가 남성이라 문법대로라면 mon monde — 이 '틀린 성'이 오히려 기억에 남죠. 성은 '이해'가 아니라 '습관'의 영역이에요.",
      },
    ],
  },

  {
    slug: "a0-07-articles",
    level: "A1",
    order: 7,
    title: "'커피 한 잔'의 '한'이 필수인 언어",
    topic: "관사 입문 le/la·un/une",
    titleFr: "Les articles",
    summary: "한국어에는 아예 없는 품사, 관사. 왜 프랑스어 명사는 거의 항상 관사를 데리고 다니는지 감을 잡아요.",
    duration: "약 8분",
    sections: [
      {
        heading: "관사 없는 명사는 벌거벗은 명사",
        pattern: "명사 → 거의 항상 관사와 함께 (정관사 le/la/les · 부정관사 un/une/des · 부분관사 du/de la)",
        patternKo: "명사는 거의 언제나 관사를 입고 다닌다",
        body:
          "관사는 명사 앞에 붙는 작은 단어예요. '정해진 그것'을 가리키면 **정관사**(le/la/les), '아무거나 하나'면 **부정관사**(un/une/des)라고 불러요. 한국어엔 관사가 없어서 한국 학습자는 관사를 빼먹는 실수를 정말 오래 해요. 프랑스어 명사는 **거의 언제나 관사와 함께** 다니고, J'aime le café(젬 르 까페)에서 le를 빼면 깨진 문장이 돼요.\n\n" +
          "영어보다도 철저해서, 영어가 관사 없이 쓰는 I like coffee 같은 문장에도 프랑스어는 관사가 필요해요.",
        examples: [
          { fr: "J'aime le café.", ipa: "[ʒɛm lə kafe] 젬 르 까페", ko: "저는 커피를 좋아해요.", note: "좋아하는 대상엔 정관사" },
          { fr: "C'est un livre.", ipa: "[sɛtœ̃ livʁ] 세떵 리브흐", ko: "이것은 책이에요.", note: "'하나의' 셀 수 있는 것엔 부정관사" },
        ],
        vsEn: "영어 the≈le/la/les, a≈un/une로 대응되지만 두 가지가 달라요. ① 프랑스어 관사는 명사의 성·수에 따라 모양이 변하고, ② 영어가 관사를 생략하는 자리(I like coffee, in school)에도 프랑스어는 관사를 써요. '영어보다 한 단계 더 깐깐하다'고 기억하세요.",
        enParallel: {
          rows: [
            { en: "**the** book", fr: "**le** livre", ipa: "[lə livʁ]", ko: "그 책 (정관사)" },
            { en: "**a** book", fr: "**un** livre", ipa: "[œ̃ livʁ]", ko: "책 한 권 (부정관사)" },
            { en: "**an** apple", fr: "**une** pomme", ipa: "[yn pɔm]", ko: "사과 하나 (부정관사)" },
          ],
          note: "le/la/les = the(정관사 '그'), un/une/des = a/an(부정관사 '하나'). 정/부정관사를 구별하는 발상 자체가 영어와 같아요. (차이: 프랑스어 관사는 명사의 성·수에 맞춰 모양이 바뀜.)",
        },
      },
      {
        heading: "정관사 le, la, les — 그리고 축약 l'",
        pattern: "le + 남성 단수 · la + 여성 단수 · l' + 모음 앞 · les + 복수",
        patternKo: "'정해진 그것'을 가리키는 정관사 네 형태",
        body:
          "'정해진 그것'을 가리키는 정관사는 **le**(르) livre, **la**(라) table, **l'**eau(모음/무음 h 앞, 성 불문), **les**(레) livres(모든 복수)예요.\n\n" +
          "정관사는 ① 이미 아는·특정한 것(그 책), ② 종류 전체(커피란 것), ③ **좋아하고 싫어하는 대상**을 말할 때 써요.",
        table: {
          headers: ["", "남성", "여성", "모음 앞", "복수"],
          rows: [
            ["정관사", "le", "la", "l'", "les"],
            ["부정관사", "un", "une", "un/une", "des"],
          ],
        },
        examples: [
          { fr: "les amis", ipa: "[lezami] 레자미", ko: "친구들", note: "les+모음 = 소리 잇기(리에종)" },
          { fr: "l'université", ipa: "[lynivɛʁsite] 뤼니베흐시떼", ko: "대학 (여성)", note: "축약되면 성이 숨어요" },
        ],
        etym: "le/la는 라틴어 지시사 ille/illa(저것)가 닳아서 된 말로, 스페인어 el/la, 이탈리아어 il/la도 같은 후손이에요. 그리고 이미 한국 마트에 진열돼 있죠 — 라네즈(la neige 라 네주, 여성 단수)의 la, 뚜레쥬르(Tous les jours 뚜 레 주흐, 복수)의 les가 전부 이 정관사예요. 브랜드명을 보며 '왜 la지? 왜 les지?'를 따져보면 그게 곧 관사 공부예요.",
      },
      {
        heading: "부정관사 un, une, des — '하나' 그리고 영어에 없는 des",
        pattern: "un + 남성 · une + 여성 · des + 복수",
        patternKo: "des는 영어에도 없는 '복수 부정관사'",
        body:
          "**un**(엉, 남성)/**une**(윈, 여성)은 영어 a/an과 같아요 — 정해지지 않은 '하나의' 무엇.\n\n" +
          "특이한 건 복수형 **des**(데)예요. 영어로는 I have books처럼 관사 없이 말하는 것을, 프랑스어는 J'ai **des** livres(줴 데 리브흐)처럼 des를 꼭 붙여요. 한국어로는 번역되지 않는 경우가 많아요.",
        examples: [
          { fr: "un café, s'il vous plaît", ipa: "[œ̃ kafe sil vu plɛ] 엉 까페 실 부 쁠레", ko: "커피 한 잔 주세요", note: "주문의 만능 공식" },
          { fr: "une question", ipa: "[yn kɛstjɔ̃] 윈 께스띠옹", ko: "질문 하나", note: "-tion은 여성 → une" },
          { fr: "J'ai des amis.", ipa: "[ʒe dezami] 줴 데자미", ko: "저는 친구들이 있어요.", note: "영어라면 관사 없이(I have friends) 말하는 자리" },
        ],
        pitfall: "한국어 직역 습관으로 'J'aime café'처럼 관사를 빼는 실수가 A1~B1 내내 이어져요. 지금부터 '프랑스어 명사는 옷(관사)을 입어야 외출한다'고 생각하는 습관을 들이면 몇 년 치 교정이 절약돼요.",
      },
    ],
  },

  {
    slug: "a1-06-adjectives",
    level: "A1",
    order: 8,
    title: "'레드 와인'이 아니라 '와인 레드'",
    topic: "형용사 성수 일치·위치(BAGS)",
    titleFr: "Les adjectifs",
    summary: "명사의 성과 수에 일치하는 형용사. 명사 뒤에 놓는 기본 어순과 앞에 오는 BAGS 예외, grand/grande 발음 변화까지.",
    duration: "약 9분",
    sections: [
      {
        heading: "성·수 일치 — 형용사는 명사를 따라가요",
        pattern: "여성형 = 남성형 + e · 복수형 = + s",
        patternKo: "형용사는 명사의 성·수 따라 네 가지 모습",
        body:
          "형용사는 꾸미는 명사의 **성과 수에 맞춰** 변해요. 한 형용사는 기본 네 가지 모습: petit / petit**e** / petit**s** / petit**es**.\n\n" +
          "이미 -e로 끝나는 형용사(rouge 등)는 여성형이 그대로이고, 복수 -s는 발음되지 않아요.",
        table: {
          caption: "petit(작은)의 4가지 모습",
          headers: ["", "단수", "복수"],
          rows: [
            ["남성", "petit [pəti]", "petits [pəti]"],
            ["여성", "petite [pətit]", "petites [pətit]"],
          ],
        },
        examples: [
          { fr: "un petit chat", ipa: "[œ̃ pəti ʃa]", ko: "작은 고양이" },
          { fr: "une petite table", ipa: "[yn pətit tabl]", ko: "작은 탁자" },
          { fr: "Elles sont contentes.", ipa: "[ɛl sɔ̃ kɔ̃tɑ̃t]", ko: "그녀들은 만족해요.", note: "주어가 여성 복수 → -es" },
        ],
      },
      {
        heading: "발음이 바뀌는 순간 — grand vs grande",
        pattern: "grand [gʁɑ̃] → grande [gʁɑ̃d]",
        patternKo: "여성형 -e는 잠자던 끝 자음을 깨우는 스위치",
        body:
          "남성형 grand은 끝 d가 묵음이라 [gʁɑ̃]인데, 여성형 grande는 **-e가 앞의 d를 깨워서** [gʁɑ̃d]가 돼요. petit/petite, français/française 전부 같은 원리예요.\n\n" +
          "듣기에서 남/여를 구별하는 결정적 단서가 바로 이 **끝 자음**이에요.",
        examples: [
          { fr: "Il est grand.", ipa: "[il ɛ gʁɑ̃]", ko: "그는 키가 커요.", note: "d 묵음" },
          { fr: "Elle est grande.", ipa: "[ɛl ɛ gʁɑ̃d]", ko: "그녀는 키가 커요.", note: "e가 d를 살려요" },
          { fr: "Il est coréen. / Elle est coréenne.", ipa: "[kɔʁeɛ̃ / kɔʁeɛn]", ko: "그는/그녀는 한국인이에요.", note: "비모음이 풀리며 n이 또렷해져요" },
        ],
        pitfall: "글로 배우면 '-e 하나 차이'로 보이지만, 귀로는 **자음이 들리느냐 마느냐**의 차이예요. grand과 grande를 같은 소리로 발음하면 성 일치를 한 보람이 사라져요. 쌍으로 소리 내어 연습하세요.",
      },
      {
        heading: "위치 — 형용사는 기본적으로 명사 뒤",
        pattern: "명사 + 형용사 (un vin rouge)",
        patternKo: "형용사의 기본 위치는 명사 뒤",
        body:
          "프랑스어 형용사는 **원칙적으로 명사 뒤**에 와요.\n\n" +
          "un vin **rouge**(직역: 와인 빨간), une voiture **française**. 색깔·국적·모양 등 대부분의 형용사가 뒤에 붙어요.",
        examples: [
          { fr: "un vin rouge", ipa: "[œ̃ vɛ̃ ʁuʒ]", ko: "레드 와인", note: "명사 + 형용사 어순" },
          { fr: "une voiture française", ipa: "[yn vwatyʁ fʁɑ̃sɛz]", ko: "프랑스 자동차" },
          { fr: "un film intéressant", ipa: "[œ̃ film ɛ̃teʁɛsɑ̃]", ko: "재미있는 영화" },
        ],
        vsEn: "영어는 a red wine처럼 형용사가 항상 명사 앞이죠. 한국어도 '빨간 와인'으로 앞이고요. 프랑스어만 '와인 빨간' 순서라, 두 언어 습관이 모두 방해가 돼요. '프랑스어는 결론(명사)부터 말하고 꾸밈은 나중'이라고 기억하세요.",
      },
      {
        heading: "앞에 오는 예외 — BAGS 형용사",
        pattern: "BAGS (Beauty·Age·Goodness·Size) → 명사 앞",
        patternKo: "미모·나이·선악·크기 형용사만 예외로 명사 앞",
        body:
          "자주 쓰는 짧은 형용사 한 줌은 예외적으로 **명사 앞**에 와요. **B**eauty(beau, joli), **A**ge(jeune, vieux, nouveau), **G**oodness(bon, mauvais), **S**ize(grand, petit, gros).\n\n" +
          "전부 빈도가 압도적으로 높은 형용사들이라, **'뒤가 원칙, BAGS만 앞'**으로 정리하면 실전 대부분이 커버돼요.",
        examples: [
          { fr: "un bon restaurant", ipa: "[œ̃ bɔ̃ ʁɛstoʁɑ̃]", ko: "좋은 식당" },
          { fr: "une jolie maison", ipa: "[yn ʒɔli mɛzɔ̃]", ko: "예쁜 집" },
          { fr: "un grand café et un petit gâteau", ipa: "[œ̃ gʁɑ̃ kafe e œ̃ pəti gato]", ko: "큰 커피 하나랑 작은 케이크 하나" },
        ],
        tip: "beau(아름다운)와 nouveau(새로운)는 모음 앞 남성 명사 앞에서 bel, nouvel로 변해요: un bel hôtel(멋진 호텔). 지금은 '그런 변형이 있다'만 알아두고, 만날 때마다 덩어리로 외우면 충분해요.",
      },
    ],
  },

  {
    slug: "a1-07-possessives",
    level: "A1",
    order: 9,
    title: "sa mère는 누구의 엄마일까?",
    topic: "소유 형용사 mon/ma/son",
    titleFr: "Les adjectifs possessifs",
    summary: "mon/ma/mes 시스템의 핵심 반전: 소유자가 아니라 소유물의 성에 일치해요. 영어 his/her 감각을 버려야 하는 챕터.",
    duration: "약 9분",
    sections: [
      {
        heading: "기본 시스템 — 인칭 × 소유물의 성·수",
        pattern: "mon/ma/mes · ton/ta/tes · son/sa/ses · notre/nos · votre/vos · leur/leurs",
        patternKo: "인칭 × 소유물의 성·수로 짜인 소유 형용사 표",
        body:
          "표가 커 보이지만 구조는 하나예요: **누구의 것인지(인칭)** × **소유물 명사의 성·수**.\n\n" +
          "nous/vous/ils 줄은 성 구별 없이 단·복수만 나뉘어서 오히려 쉬워요: notre/nos, votre/vos, leur/leurs.",
        table: {
          caption: "소유 형용사 전체표",
          headers: ["소유자", "남성 단수", "여성 단수", "복수"],
          rows: [
            ["나의", "mon", "ma", "mes"],
            ["너의", "ton", "ta", "tes"],
            ["그/그녀의", "son", "sa", "ses"],
            ["우리의", "notre", "notre", "nos"],
            ["당신(들)의", "votre", "votre", "vos"],
            ["그들의", "leur", "leur", "leurs"],
          ],
        },
        examples: [
          { fr: "mon père et ma mère", ipa: "[mɔ̃ pɛʁ e ma mɛʁ]", ko: "나의 아버지와 나의 어머니" },
          { fr: "mes amis", ipa: "[mezami]", ko: "내 친구들", note: "mes + 모음 = 리에종 '메자미'" },
          { fr: "C'est votre sac ?", ipa: "[sɛ vɔtʁ sak]", ko: "이거 당신 가방인가요?" },
        ],
      },
      {
        heading: "결정적 반전 — 소유자가 아니라 '소유물'의 성에 일치",
        pattern: "son/sa/ses → 뒤에 오는 명사의 성·수 기준 (소유자 무관)",
        patternKo: "기준은 소유자가 아니라 소유물 명사의 성",
        body:
          "mon/ma를 가르는 기준은 내가 남자냐 여자냐가 아니라, **뒤에 오는 명사가 남성이냐 여성이냐**예요. 여성인 제가 말해도 '나의 아버지'는 mon père죠.\n\n" +
          "그래서 **sa mère**는 '그의 어머니'일 수도, '그녀의 어머니'일 수도 있어요. 누구의 어머니인지는 오직 문맥이 말해줘요.",
        examples: [
          { fr: "Paul aime sa mère.", ipa: "[pɔl ɛm sa mɛʁ]", ko: "폴은 자기 어머니를 사랑해요.", note: "소유자는 남자지만 mère가 여성 → sa" },
          { fr: "Marie aime son père.", ipa: "[maʁi ɛm sɔ̃ pɛʁ]", ko: "마리는 자기 아버지를 사랑해요.", note: "소유자는 여자지만 père가 남성 → son" },
          { fr: "Il cherche ses clés.", ipa: "[il ʃɛʁʃ se kle]", ko: "그는 자기 열쇠들을 찾고 있어요.", note: "복수면 무조건 ses" },
        ],
        vsEn: "영어 his/her는 **소유자**의 성을 따라가죠(his mother = 남자의 엄마). 프랑스어 son/sa는 정반대로 **소유물**의 성을 따라가요. 영어 감각으로 'her mother니까 sa...'라고 추론하면 우연히 맞을 뿐, 논리가 틀린 거예요. '그의/그녀의' 구별 자체가 프랑스어에는 없어요.",
        pitfall: "한국어 '그의/그녀의'도 영어 his/her도 모두 소유자 기준이라, 한국인+영어 학습자에게 이중으로 함정인 지점이에요. 'son/sa/ses는 뒤 명사 보고 결정, 소유자는 쳐다보지도 않기' — 이 한 줄을 주문처럼 외우세요.",
      },
      {
        heading: "발음 보호 규칙 — 모음 앞에서는 ma 대신 mon",
        pattern: "여성 명사 + 모음 시작 → ma/ta/sa 대신 mon/ton/son (mon amie)",
        patternKo: "모음 충돌을 피하려고 여성 명사 앞에도 mon",
        body:
          "여성 명사라도 **모음(또는 무음 h)으로 시작하면 mon/ton/son**을 써요. ma amie처럼 모음이 충돌하는 걸 프랑스어가 못 견디기 때문이에요.\n\n" +
          "형태만 mon을 빌려 쓸 뿐 명사는 여전히 여성이라, 일치는 여성형으로 해요: mon amie est joli**e**.",
        examples: [
          { fr: "mon amie", ipa: "[mɔ̃nami]", ko: "내 (여자인) 친구", note: "amie는 여성이지만 모음 앞이라 mon" },
          { fr: "son école", ipa: "[sɔ̃nekɔl]", ko: "그/그녀의 학교", note: "école은 여성 명사" },
          { fr: "ton histoire", ipa: "[tɔ̃nistwaʁ]", ko: "너의 이야기", note: "h 묵음 → 모음 취급" },
        ],
        tip: "리에종 덕분에 mon amie는 '몽나미'처럼 n이 살아나요 — 볼펜 브랜드 모나미(Monami)가 바로 mon ami(내 친구)의 그 소리예요. '모음 앞 여성 명사 = mon/ton/son + 리에종' 세트로 소리째 외우면 자연스럽게 입에 붙어요.",
      },
    ],
  },

  {
    slug: "a1-08-aller-venir",
    level: "A1",
    order: 10,
    title: "\"방금 먹었어, 곧 갈 거야\"",
    topic: "aller/venir·근접 미래와 과거",
    titleFr: "Aller, venir et leurs constructions",
    summary: "필수 불규칙 동사 aller/venir. 여기에 futur proche(곧 ~할 거예요)와 passé récent(방금 ~했어요)이 따라와요.",
    duration: "약 10분",
    sections: [
      {
        heading: "aller(가다) — 최강 불규칙 동사",
        pattern: "je vais · tu vas · il va · nous allons · vous allez · ils vont",
        distractors: ["vas", "va", "allez", "vont"],
        patternKo: "'가다' aller의 완전 불규칙 활용",
        body:
          "**aller**(가다)는 -er로 끝나지만 1군이 아닌 완전 불규칙 동사예요 — 그만큼 많이 쓰여서 닳고 닳았다는 뜻이죠.\n\n" +
          "인사말 Ça va ?의 va도 사실 aller의 3인칭이에요. 이미 여러분은 aller를 쓰고 있었던 거죠.",
        table: {
          caption: "aller 직설법 현재",
          headers: ["인칭", "형태", "발음"],
          rows: [
            ["je", "vais", "[ʒə vɛ]"],
            ["tu", "vas", "[ty va]"],
            ["il / elle / on", "va", "[il va]"],
            ["nous", "allons", "[nuzalɔ̃]"],
            ["vous", "allez", "[vuzale]"],
            ["ils / elles", "vont", "[il vɔ̃]"],
          ],
        },
        examples: [
          { fr: "Je vais bien.", ipa: "[ʒə vɛ bjɛ̃]", ko: "저는 잘 지내요." },
          { fr: "Comment allez-vous ?", ipa: "[kɔmɑ̃tale vu]", ko: "어떻게 지내세요? (격식)" },
        ],
      },
      {
        heading: "aller à — 그리고 의무 축약 au / aux",
        pattern: "à + le → au · à + les → aux (à la / à l'는 그대로)",
        patternKo: "à와 정관사 le/les가 만나면 의무 축약",
        body:
          "'~에 가다'는 aller **à**인데, à 뒤에 정관사 le/les가 오면 **반드시 축약**해야 해요.\n\n" +
          "영어 to the처럼 따로 쓰는 선택지는 없어요 — à le라고 쓰면 그냥 틀린 문장이에요.",
        table: {
          caption: "à + 정관사 축약",
          headers: ["조합", "결과", "예시"],
          rows: [
            ["à + le", "au", "au cinéma (영화관에)"],
            ["à + la", "à la (그대로)", "à la maison (집에)"],
            ["à + l'", "à l' (그대로)", "à l'école (학교에)"],
            ["à + les", "aux", "aux toilettes (화장실에)"],
          ],
        },
        examples: [
          { fr: "Je vais au travail.", ipa: "[ʒə vɛ o tʁavaj]", ko: "저는 일하러 가요." },
          { fr: "On va à la plage ?", ipa: "[ɔ̃ va a la plaʒ]", ko: "우리 바닷가 갈래?" },
          { fr: "Elle va à l'université.", ipa: "[ɛl va a lynivɛʁsite]", ko: "그녀는 대학에 가요." },
        ],
        pitfall: "'à le cinéma'는 한국 학습자 답안지의 단골 오답이에요. à와 le가 만나는 순간 **자동으로 au** — 선택이 아니라 의무예요. de + le = du, de + les = des도 같은 원리인데, 다음 챕터(부분관사)에서 다시 만나요.",
      },
      {
        heading: "futur proche — aller + 원형 = '~할 거예요'",
        pattern: "aller 현재형 + 동사 원형 → 가까운 미래",
        patternKo: "'~할 거예요' — 두 번째 동사는 원형 그대로",
        body:
          "**aller 현재형 + 동사 원형**이면 가까운 미래(**futur proche**)를 표현해요. Je vais manger.(나 먹을 거야.)\n\n" +
          "두 번째 동사는 활용하지 않고 **원형 그대로** 두는 게 포인트예요. 일상 회화의 미래 표현은 대부분 이걸로 해결돼요.",
        examples: [
          { fr: "Je vais manger.", ipa: "[ʒə vɛ mɑ̃ʒe]", ko: "나 (이제) 먹을 거야." },
          { fr: "Tu vas travailler demain ?", ipa: "[ty va tʁavaje dəmɛ̃]", ko: "너 내일 일할 거야?" },
          { fr: "Il va pleuvoir.", ipa: "[il va pløvwaʁ]", ko: "비가 올 거예요." },
          { fr: "Nous allons visiter Paris.", ipa: "[nuzalɔ̃ vizite paʁi]", ko: "우리는 파리를 구경할 거예요." },
        ],
        vsEn: "영어 be going to와 구조가 완벽하게 평행해요: I'm going to eat = Je vais manger. '가다' 동사가 미래 표현으로 변신하는 발상까지 똑같으니, 영어 감각을 그대로 가져다 쓰면 돼요.",
        enParallel: {
          rows: [
            { en: "I'm **going to** eat.", fr: "Je **vais** manger.", ipa: "[ʒə vɛ mɑ̃ʒe]", ko: "나 (이제) 먹을 거야." },
            { en: "We're **going to** visit Paris.", fr: "Nous **allons** visiter Paris.", ipa: "[nuzalɔ̃ vizite paʁi]", ko: "우리는 파리를 구경할 거예요." },
            { en: "It's **going to** rain.", fr: "**Il va** pleuvoir.", ipa: "[il va pløvwaʁ]", ko: "비가 올 거예요." },
          ],
          note: "'가다(aller/go)'가 미래 표현으로 변신하는 발상까지 영어 be going to와 똑같아요. 영어 문장을 그대로 옮기면 돼요.",
        },
      },
      {
        heading: "venir(오다)와 passé récent — '방금 ~했어요'",
        pattern: "venir de + 동사 원형 → 방금 ~했어요 (passé récent)",
        patternKo: "'방금 ~했어요' — venir de 뒤에 원형",
        body:
          "**venir**(오다)도 필수 불규칙 동사예요: je viens, tu viens, il vient, nous venons, vous venez, ils viennent [vjɛn].\n\n" +
          "aller + 원형이 가까운 미래라면, **venir de + 원형**은 가까운 과거예요. Je viens de manger.(나 방금 먹었어.) — 직역 '먹는 것으로부터 오는 길이다'.",
        examples: [
          { fr: "Je viens de Corée.", ipa: "[ʒə vjɛ̃ də kɔʁe]", ko: "저는 한국에서 왔어요.", note: "출신을 말하는 venir de + 장소" },
          { fr: "Je viens de manger.", ipa: "[ʒə vjɛ̃ də mɑ̃ʒe]", ko: "나 방금 먹었어.", note: "venir de + 원형 = 방금 ~했다" },
          { fr: "Le train vient de partir.", ipa: "[lə tʁɛ̃ vjɛ̃ də paʁtiʁ]", ko: "기차가 방금 떠났어요." },
        ],
        enParallel: {
          rows: [
            { en: "I **have just** eaten.", fr: "Je **viens de** manger.", ipa: "[ʒə vjɛ̃ də mɑ̃ʒe]", ko: "나 방금 먹었어." },
            { en: "The train **has just** left.", fr: "Le train **vient de** partir.", ipa: "[lə tʁɛ̃ vjɛ̃ də paʁtiʁ]", ko: "기차가 방금 떠났어요." },
          ],
          note: "venir de + 원형 = 영어 have just + 과거분사.",
        },
        etym: "venir는 라틴어 venīre(오다)의 후손이에요. 영어 avenue(다다르는 길), advent(도래)에 같은 뿌리가 살아 있어요. '애비뉴 = 와 닿는 길'을 떠올리면 venir의 뜻이 붙잡혀요.",
      },
    ],
  },

  {
    slug: "a1-09-partitive",
    level: "A1",
    order: 11,
    title: "\"빵 좀 주세요\"의 '좀'을 문법으로",
    topic: "부분관사 du/de la",
    titleFr: "Les articles partitifs",
    summary: "영어에도 한국어에도 없는 du/de la. 셀 수 없는 것의 '일부'를 말하는 관사로, 음식 이야기의 필수품이에요.",
    duration: "약 9분",
    sections: [
      {
        heading: "왜 필요한가 — '빵 하나'도 '빵 전체'도 아닐 때",
        pattern: "du + 남성 · de la + 여성 · de l' + 모음 앞 · des + 복수",
        patternKo: "셀 수 없는 것의 '얼마간, 좀'",
        distractors: ["de la", "des", "le"],
        body:
          "un pain(한 덩어리 통째)도 le pain(빵이라는 것 전체)도 아닌, **'빵을 좀'**을 담당하는 게 **부분관사**예요. 물·빵·치즈처럼 셀 수 없는 것을 '일부' 먹고 마실 때 써요.\n\n" +
          "형태는 사실 **de + 정관사**라서, de + le = **du**라는 익숙한 축약이 또 등장해요.",
        table: {
          caption: "부분관사",
          headers: ["형태", "쓰는 곳", "예시"],
          rows: [
            ["du", "남성 단수", "du pain (빵 좀)"],
            ["de la", "여성 단수", "de la salade (샐러드 좀)"],
            ["de l'", "모음/무음 h 앞", "de l'eau (물 좀)"],
            ["des", "복수", "des pâtes (파스타 좀)"],
          ],
        },
        examples: [
          { fr: "Je mange du pain.", ipa: "[ʒə mɑ̃ʒ dy pɛ̃]", ko: "저는 빵을 (좀) 먹어요." },
          { fr: "Tu veux de l'eau ?", ipa: "[ty vø də lo]", ko: "물 마실래?" },
          { fr: "Elle achète de la salade.", ipa: "[ɛl aʃɛt də la salad]", ko: "그녀는 샐러드를 사요." },
        ],
        vsEn: "영어는 이 자리에 관사를 아예 안 써요 — I eat bread, I drink water. 그래서 영어 감각으로는 'Je mange pain'이라고 하기 쉽지만, 프랑스어 명사는 벌거벗고 다닐 수 없죠. 굳이 영어로 옮기면 some bread의 some이 항상 의무인 셈이에요.",
      },
      {
        heading: "음식·음료 회화의 주력 엔진",
        pattern: "manger / boire / prendre + du / de la + 음식",
        patternKo: "먹고 마시는 동사와 짝을 이루는 부분관사",
        distractors: ["de la", "des", "le"],
        body:
          "부분관사가 가장 바쁘게 일하는 곳은 식탁이에요. **manger**(먹다), **boire**(마시다, je bois), **prendre**(시키다, je prends) 같은 동사와 짝을 이뤄요.\n\n" +
          "카페 주문, 장보기, 아침 메뉴 — 전부 부분관사의 무대예요.",
        examples: [
          { fr: "Je bois du café le matin.", ipa: "[ʒə bwa dy kafe lə matɛ̃]", ko: "저는 아침에 커피를 마셔요." },
          { fr: "On prend du fromage ?", ipa: "[ɔ̃ pʁɑ̃ dy fʁɔmaʒ]", ko: "우리 치즈 (좀) 먹을까?" },
          { fr: "Il y a de la soupe et du riz.", ipa: "[ilja də la sup e dy ʁi]", ko: "수프와 밥이 있어요." },
        ],
        tip: "같은 명사라도 관사가 의미를 바꿔요. Je bois **du** café(커피를 마셔요 — 일부) vs J'aime **le** café(커피를 좋아해요 — 커피라는 것 전체). 카페오레(café **au** lait)의 au도 à+le 축약 — 메뉴판의 lait(우유) 앞에까지 관사가 꼬박꼬박 붙는 언어라는 증거죠. **좋아하는 대상엔 정관사, 먹고 마시는 양엔 부분관사** — 이 구별이 A1의 백미예요.",
      },
      {
        heading: "부정문에서는 전부 de로 변신",
        pattern: "부정문: du / de la / de l' / des → de",
        patternKo: "부정문에서는 부분관사도 전부 de로 통일",
        distractors: ["du", "des", "de la"],
        body:
          "부정문 챕터의 규칙이 그대로 적용돼요. Je bois du café → Je ne bois pas **de** café.\n\n" +
          "'없음'의 세계에서는 양을 따질 필요가 없으니 전부 중립적인 de로 통일되는 거예요.",
        examples: [
          { fr: "Je ne mange pas de viande.", ipa: "[ʒə nə mɑ̃ʒ pa də vjɑ̃d]", ko: "저는 고기를 안 먹어요.", note: "de la viande → pas de viande" },
          { fr: "Il n'y a pas de lait.", ipa: "[ilnja pa də lɛ]", ko: "우유가 없어요." },
          { fr: "Elle ne boit pas d'alcool.", ipa: "[ɛl nə bwa pa dalkɔl]", ko: "그녀는 술을 안 마셔요.", note: "모음 앞 d'" },
        ],
        pitfall: "긍정에서 du/de la를 익힌 직후라 부정문에서도 'pas du café'라고 하기 쉬워요. 부정의 pas 뒤는 **무조건 de** — un/une/des도, du/de la도 예외 없이요. (단, être 뒤와 J'aime의 정관사는 그대로라는 것도 함께 기억하세요: Ce n'est pas du café / Je n'aime pas le café.)",
      },
    ],
  },

  {
    slug: "a1-10-numbers-time",
    level: "A1",
    order: 12,
    title: "70을 '60+10'이라 부르는 사람들",
    topic: "숫자·시간·날짜",
    titleFr: "Les nombres, l'heure et la date",
    summary: "70 = 60+10, 80 = 4×20?! 악명 높은 프랑스 숫자 체계를 웃으며 넘기고, 시간 묻기와 날짜 말하기까지 정리해요.",
    duration: "약 10분",
    sections: [
      {
        heading: "0~69 — 여기까지는 평화로워요",
        pattern: "20~69 = 십 단위 + 일 단위 · 21/31... = ... et un",
        patternKo: "69까지는 십 단위 + 일 단위의 평범한 조립",
        body:
          "1~16은 고유한 단어, 17~19는 dix-sept(10+7) 식, 20~69는 '십 단위 + 일 단위'예요. 영어와 같은 논리라 무난해요.\n\n" +
          "발음 주의: six과 dix는 단독 [sis]/[dis], 명사 앞 [si]/[di], 모음 앞 [siz]/[diz]로 변해요.",
        table: {
          caption: "기둥이 되는 숫자들",
          headers: ["숫자", "프랑스어", "발음"],
          rows: [
            ["1 / 2 / 3", "un / deux / trois", "[œ̃] [dø] [tʁwa]"],
            ["4 / 5 / 6", "quatre / cinq / six", "[katʁ] [sɛ̃k] [sis]"],
            ["7 / 8 / 9", "sept / huit / neuf", "[sɛt] [ɥit] [nœf]"],
            ["10 / 20 / 30", "dix / vingt / trente", "[dis] [vɛ̃] [tʁɑ̃t]"],
            ["40 / 50 / 60", "quarante / cinquante / soixante", "[kaʁɑ̃t] [sɛ̃kɑ̃t] [swasɑ̃t]"],
          ],
        },
        examples: [
          { fr: "vingt et un", ipa: "[vɛ̃teœ̃]", ko: "21", note: "1의 자리만 et" },
          { fr: "trente-cinq", ipa: "[tʁɑ̃tsɛ̃k]", ko: "35" },
          { fr: "soixante-neuf", ipa: "[swasɑ̃tnœf]", ko: "69", note: "여기까지가 평화" },
        ],
      },
      {
        heading: "70~99 — 프랑스식 암산 체조",
        pattern: "70 = soixante-dix (60+10) · 80 = quatre-vingts (4×20) · 90 = 4×20+10",
        patternKo: "70부터는 60+10, 4×20 식의 암산 체조",
        body:
          "70부터 프랑스어는 수학 문제를 내요. 99는 quatre-vingt-dix-neuf(4×20+10+9) — 한 숫자에 단어가 네 개예요.\n\n" +
          "처음엔 멘붕이 정상이지만, 전화번호와 가격에서 무한 반복되니 외우려 하지 말고 **들으면서 익숙해지세요**.",
        table: {
          caption: "70~90 생존표",
          headers: ["숫자", "프랑스어", "계산식"],
          rows: [
            ["70", "soixante-dix [swasɑ̃tdis]", "60 + 10"],
            ["71", "soixante et onze [swasɑ̃teɔ̃z]", "60 + 11"],
            ["80", "quatre-vingts [katʁəvɛ̃]", "4 × 20"],
            ["81", "quatre-vingt-un [katʁəvɛ̃œ̃]", "4×20 + 1 (et 없음)"],
            ["90", "quatre-vingt-dix [katʁəvɛ̃dis]", "4×20 + 10"],
            ["99", "quatre-vingt-dix-neuf [katʁəvɛ̃diznœf]", "4×20 + 10 + 9"],
          ],
        },
        examples: [
          { fr: "Ça coûte quatre-vingts euros.", ipa: "[sa kut katʁəvɛ̃z øʁo]", ko: "그건 80유로예요." },
          { fr: "J'ai soixante-quinze ans.", ipa: "[ʒe swasɑ̃tkɛ̃z ɑ̃]", ko: "저는 75살이에요." },
        ],
        tip: "벨기에와 스위스에서는 septante(70), nonante(90)라는 '정상적인' 단어를 써요. 스위스 일부는 huitante(80)까지. 프랑스인만 고집스럽게 암산을 즐기는 셈이니, 너무 미워하지는 마세요.",
        pitfall: "듣기에서 soixante...까지 듣고 60대 숫자로 적으면 함정에 빠져요. 뒤에 -dix/-quinze가 따라붙으면 70대로 점프하니까, **soixante와 quatre-vingt 뒤에는 항상 한 박자 기다리는 습관**을 들이세요.",
      },
      {
        heading: "시간 묻고 답하기 — Quelle heure est-il ?",
        pattern: "Il est + 숫자 + heure(s) (+ et demie / et quart / moins le quart)",
        patternKo: "시간 대답은 Il est 틀에 숫자 끼우기 — heures 생략 불가",
        body:
          "시간 질문 **Quelle heure est-il ?**은 굳은 표현이라 통째로 외워요. 대답은 **Il est ... heure(s)** 틀에 숫자만 끼우면 돼요.\n\n" +
          "30분 = **et demie**, 15분 = **et quart**, 15분 전 = **moins le quart**. 정오는 midi, 자정은 minuit라는 전용 단어를 써요.",
        examples: [
          { fr: "Quelle heure est-il ?", ipa: "[kɛlœʁ ɛtil]", ko: "몇 시예요?" },
          { fr: "Il est deux heures.", ipa: "[il ɛ døzœʁ]", ko: "2시예요.", note: "리에종 '되죄르'" },
          { fr: "Il est huit heures et demie.", ipa: "[il ɛ ɥitœʁ e dəmi]", ko: "8시 반이에요." },
          { fr: "Il est midi moins le quart.", ipa: "[il ɛ midi mwɛ̃ lə kaʁ]", ko: "12시(정오) 15분 전이에요." },
        ],
        pitfall: "'2시예요'를 Il est deux라고 줄이면 안 돼요 — **heures를 생략할 수 없어요**. 한국어는 '두 시'에서 '시'가 자연스럽게 붙지만, 숫자만 말하는 영어식(It's two) 습관이 끼어들기 쉬운 지점이에요. 그리고 1시는 une heure(여성 단수)인 것도 체크!",
      },
      {
        heading: "날짜와 요일 — le 3 mai 공식",
        pattern: "le + 숫자 + 달 이름 (예외: 1일 = le premier)",
        patternKo: "날짜는 '일 → 월' 순서 — 1일만 premier",
        body:
          "날짜는 **le 3 mai**(5월 3일)처럼 어순이 한국어와 반대로 '일 → 월'이에요. 1일만 서수 **le premier**(le 1er)를 써요.\n\n" +
          "요일·달 이름은 **소문자**로 쓰고, '매주 월요일마다'는 le lundi처럼 정관사를 붙여요. '오늘 며칠이에요?'는 **On est le combien ?**",
        examples: [
          { fr: "On est le combien ? — On est le 9 juin.", ipa: "[ɔ̃nɛ lə kɔ̃bjɛ̃ — ɔ̃nɛ lə nœf ʒɥɛ̃]", ko: "오늘 며칠이에요? — 6월 9일이에요." },
          { fr: "Mon anniversaire, c'est le premier avril.", ipa: "[mɔ̃nanivɛʁsɛʁ sɛ lə pʁəmjɛʁ avʁil]", ko: "제 생일은 4월 1일이에요.", note: "1일만 premier" },
          { fr: "Je travaille le lundi.", ipa: "[ʒə tʁavaj lə lœ̃di]", ko: "저는 월요일마다 일해요.", note: "le + 요일 = 매주 반복" },
        ],
        vsEn: "영어는 May 3rd처럼 서수를 쓰지만, 프랑스어는 1일만 빼고 전부 기수예요(le trois mai). 그리고 영어와 달리 요일·달 이름을 **대문자로 쓰지 않는 것**도 작지만 자주 틀리는 차이예요.",
      },
    ],
  },

  {
    slug: "a0-08-survival",
    level: "A1",
    order: 13,
    title: "\"봉주르\" 없이는 시작도 없다",
    topic: "인사·생존 표현과 tu/vous",
    titleFr: "Salutations et expressions de survie",
    summary: "첫 회화에 필요한 인사·예의 표현 세트. 한국어 존댓말 감각이 그대로 통하는 tu/vous 구분도 함께!",
    duration: "약 8분",
    sections: [
      {
        heading: "기본 인사 세트",
        pattern: "Bonjour(낮) · Salut(친한 사이)",
        patternKo: "때와 친한 정도에 따라 갈리는 기본 인사 세트",
        body:
          "**Bonjour** [봉주흐] — 아침~낮의 만능 인사. 가게에 들어갈 때 점원에게 반드시 건네는 게 프랑스 예절이에요.\n" +
          "**Bonsoir** [봉수아흐] — 저녁 인사.\n" +
          "**Salut** [살뤼] — 친한 사이의 '안녕!' (만날 때도 헤어질 때도)\n" +
          "**Au revoir** [오 흐부아] — 헤어질 때.\n" +
          "**Bonne nuit** [본 뉘] — 자러 갈 때만 쓰는 '잘 자'.",
        examples: [
          { fr: "Bonjour, madame.", ipa: "[bɔ̃ʒuʁ madam] 봉주흐 마담", ko: "안녕하세요. (여성에게)", note: "madame(마담)/monsieur(므시외)를 붙이면 한층 정중" },
          { fr: "Salut, ça va ?", ipa: "[saly sa va] 살뤼 사 바", ko: "안녕, 잘 지내?", note: "친구 사이" },
          { fr: "Au revoir, merci !", ipa: "[o ʁəvwaʁ mɛʁsi] 오 흐부아 메흐시", ko: "안녕히 계세요, 감사합니다!" },
        ],
        pitfall: "Bonne nuit(본 뉘)는 '좋은 밤 되세요'가 아니라 '잘 자요'예요. 저녁에 헤어지며 Bonne nuit라고 하면 어색해요 — 저녁 작별 인사는 Bonne soirée(본 수아헤)를 쓰세요.",
      },
      {
        heading: "tu와 vous — 프랑스어의 반말과 존댓말",
        pattern: "tu(뛰) = 반말 (친구·가족) · vous(부) = 존댓말 + 복수 '여러분'",
        patternKo: "한국어 반말/존댓말 감각이 그대로 통하는 구분",
        body:
          "**tu**(뛰)는 친구·가족·아이에게, **vous**(부)는 처음 만난 사람·윗사람·격식 상황에서 써요. 한국어 **반말/존댓말 감각 그대로**라 우리에겐 큰 어드밴티지예요.\n\n" +
          "'말 놓다'에 해당하는 동사(tutoyer 뛰뚜아예)가 따로 있을 만큼 이 전환은 관계의 이정표예요. 확신이 없으면 무조건 vous — 한국에서처럼요.",
        examples: [
          { fr: "Comment vous appelez-vous ?", ipa: "[kɔmɑ̃ vuzaple vu] 꼬멍 부자쁠레 부", ko: "성함이 어떻게 되세요? (존대)" },
          { fr: "Tu t'appelles comment ?", ipa: "[ty tapɛl kɔmɑ̃] 뛰 따뻴 꼬멍", ko: "너 이름이 뭐야? (반말)" },
          { fr: "Vous allez bien ?", ipa: "[vuzale bjɛ̃] 부잘레 비앵", ko: "잘 지내세요?" },
        ],
        vsEn: "영어 you는 하나뿐이라 영어에는 이 구분이 없어요. 영어로 생각하고 말하면 tu/vous 선택을 잊기 쉬우니, 오히려 한국어로 '이 사람한테 존댓말 할 상황인가?'를 떠올리는 게 정확해요.",
      },
      {
        heading: "생존 필수 표현 10",
        body: "여행이든 수업이든, 이 열 개면 첫날을 버틸 수 있어요.",
        examples: [
          { fr: "Merci (beaucoup).", ipa: "[mɛʁsi boku] 메흐시 (보꾸)", ko: "감사합니다 (대단히)." },
          { fr: "S'il vous plaît.", ipa: "[sil vu plɛ] 실 부 쁠레", ko: "부탁합니다 / 저기요.", note: "주문·부탁의 필수 마무리" },
          { fr: "Pardon. / Excusez-moi.", ipa: "[paʁdɔ̃ / ɛkskyze mwa] 빠흐동 / 엑스뀌제 무아", ko: "실례합니다 / 죄송합니다." },
          { fr: "Oui. / Non.", ipa: "[wi / nɔ̃] 위 / 농", ko: "네. / 아니요." },
          { fr: "Je ne comprends pas.", ipa: "[ʒə nə kɔ̃pʁɑ̃ pa] 즈 느 꽁프헝 빠", ko: "이해하지 못했어요." },
          { fr: "Plus lentement, s'il vous plaît.", ipa: "[ply lɑ̃tmɑ̃ sil vu plɛ] 쁠뤼 렁뜨멍 실 부 쁠레", ko: "더 천천히 말씀해주세요." },
          { fr: "Parlez-vous anglais ?", ipa: "[paʁle vu ɑ̃glɛ] 빠흘레 부 엉글레", ko: "영어 하세요?" },
          { fr: "Je suis coréen(ne).", ipa: "[ʒə sɥi kɔʁeɛ̃ / kɔʁeɛn] 즈 스위 꼬헤앵 / 꼬헤엔", ko: "저는 한국인이에요. (남/녀)" },
          { fr: "C'est combien ?", ipa: "[sɛ kɔ̃bjɛ̃] 세 꽁비앵", ko: "얼마예요?" },
          { fr: "Où sont les toilettes ?", ipa: "[u sɔ̃ le twalɛt] 우 쏭 레 뚜알렛", ko: "화장실이 어디예요?" },
        ],
        tip: "프랑스에서는 가게에 들어가며 Bonjour(봉주흐), 나오며 Merci, au revoir(메흐시, 오 흐부아)를 말하는 게 기본 매너예요. 이 두 마디만 챙겨도 응대의 온도가 달라집니다.",
        etym: "merci(메흐시)는 라틴어 mercēs(보수, 호의)에서 왔어요. 영어 mercy(자비)와 같은 뿌리 — '당신의 호의에 감사하다'는 뜻이 압축된 말이에요.",
      },
    ],
  },
];

export default chapters;
