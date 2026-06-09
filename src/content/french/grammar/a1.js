/**
 * A1 기초 — 프랑스어 문장의 뼈대 세우기
 * 주어+동사부터 숫자·시간까지, 첫 문장을 만들고 굴리는 데 필요한 핵심 문법.
 */
export default [
  {
    slug: "a1-01-pronouns-etre",
    level: "A1",
    order: 1,
    title: "주어 인칭대명사와 être — 문장의 첫 단추",
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
      },
      {
        heading: "C'est ... — '이것은/그것은 ~이에요'의 만능 공식",
        pattern: "C'est + 명사/형용사 · 복수 → Ce sont",
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
    title: "avoir — '가지다' 그 이상의 동사",
    titleFr: "Le verbe avoir",
    summary: "두 번째 필수 동사 avoir. 활용표와 함께, 배고픔·나이까지 avoir로 말하는 프랑스어 특유의 발상을 배워요.",
    duration: "약 8분",
    sections: [
      {
        heading: "avoir 활용 — 리에종 주의보",
        pattern: "j'ai · tu as · il a · nous avons · vous avez · ils ont",
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
        pitfall: "ils ont(가지고 있다)[il-**z**ɔ̃]과 ils sont(~이다)[il-**s**ɔ̃]은 [z]와 [s] 하나로 갈려요. A0 리에종 챕터에서 예고했던 바로 그 함정 — 말할 때도 s를 [z]로 부활시키는 걸 잊으면 정반대 동사가 됩니다.",
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
        body:
          "영어 there is/there are에 해당하지만, 단수든 복수든 **형태가 il y a 하나**라서 오히려 쉬워요.\n\n" +
          "발음은 [ilja] '일리야' — 세 단어지만 한 덩어리로 굴러가요. 구어에서는 [ja]까지 줄어들기도 해요.",
        examples: [
          { fr: "Il y a un café ici.", ipa: "[ilja œ̃ kafe isi]", ko: "여기 카페가 하나 있어요." },
          { fr: "Il y a des livres sur la table.", ipa: "[ilja de livʁ syʁ la tabl]", ko: "탁자 위에 책들이 있어요.", note: "복수여도 il y a 그대로" },
          { fr: "Il y a un problème ?", ipa: "[ilja œ̃ pʁɔblɛm]", ko: "무슨 문제 있어요?" },
        ],
        tip: "il y a의 il은 '그'가 아니라 비인칭 가짜 주어예요. 날씨의 il fait(날씨가 ~하다)처럼, 프랑스어는 주어 없는 문장을 못 견뎌서 il을 채워 넣는다고 생각하면 돼요.",
      },
    ],
  },

  {
    slug: "a1-03-er-verbs",
    level: "A1",
    order: 3,
    title: "1군 -er 동사 — 동사의 90%를 한 번에",
    titleFr: "Les verbes en -er",
    summary: "parler, aimer, habiter... 프랑스어 동사의 약 90%가 따르는 -er 패턴 하나로 동사 활용의 문이 열려요.",
    duration: "약 9분",
    sections: [
      {
        heading: "동사 원형과 1군 동사",
        pattern: "원형 - er = 어간 → 어간 + -e, -es, -e, -ons, -ez, -ent",
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
        pitfall: "ils parlent을 한글 표기 감각으로 '일 빠를렁'이라고 읽는 실수가 정말 많아요. **-ent 어미는 완전한 묵음** — il parle와 ils parlent은 소리가 100% 같아요. 단수인지 복수인지는 리에종이나 문맥으로만 구별됩니다.",
        vsEn: "영어 동사는 3인칭 단수에서만 -s가 붙죠(he speaks). 프랑스어는 여섯 인칭 모두 어미가 다르지만, 발음상으로는 영어 못지않게 단순해요. '철자는 화려하고 소리는 소박하다'가 1군 동사의 본질이에요.",
      },
      {
        heading: "자주 쓰는 -er 동사로 문장 만들기",
        pattern: "je + 모음/무음 h 시작 동사 → j' (j'aime, j'habite)",
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
    title: "부정문 — 동사를 감싸는 ne ... pas 샌드위치",
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
        body:
          "J'ai **un** chat → Je n'ai pas **de** chat. '하나도 없음'의 세계에서는 '하나(un)'라는 말이 무의미해지니 중립적인 de로 갈아탄다고 이해하면 돼요.\n\n" +
          "단, **être 뒤에서는 그대로**(Ce n'est pas un chat)이고, 정관사 le/la/les도 유지돼요(Je n'aime pas le café).",
        examples: [
          { fr: "Je n'ai pas de chat.", ipa: "[ʒə ne pa də ʃa]", ko: "저는 고양이가 없어요.", note: "un → de" },
          { fr: "Il n'y a pas de problème.", ipa: "[ilnja pa də pʁɔblɛm]", ko: "문제없어요.", note: "il y a의 부정 — 통째로 암기" },
          { fr: "Je n'ai pas d'amis ici.", ipa: "[ʒə ne pa dami isi]", ko: "저는 여기 친구가 없어요.", note: "des → d'" },
          { fr: "Ce n'est pas une question.", ipa: "[sə nɛ pa yn kɛstjɔ̃]", ko: "그건 질문이 아니에요.", note: "être 뒤라 une 유지" },
        ],
        pitfall: "'Je n'ai pas un chat'은 한국 학습자가 가장 오래 끌고 가는 실수예요. **부정의 pas 뒤에서 un/une/des는 de** — 영어에도 한국어에도 없는 규칙이라 의식적으로 연습해야 해요.",
      },
      {
        heading: "구어에서는 ne가 사라져요",
        pattern: "구어: Je (ne) sais pas → Je sais pas",
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
    title: "의문문 — 같은 질문을 묻는 세 가지 방법",
    titleFr: "Les questions",
    summary: "억양만 올리기, est-ce que, 도치 — 격식 단계별 의문문 3종 세트와 의문사 6총사를 정리해요.",
    duration: "약 9분",
    sections: [
      {
        heading: "방법 1 — 억양만 올리기 (구어의 기본값)",
        pattern: "평서문 + 억양 ↗ (Tu parles français ?)",
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
    slug: "a1-06-adjectives",
    level: "A1",
    order: 6,
    title: "형용사 — 성·수에 맞춰 옷을 갈아입어요",
    titleFr: "Les adjectifs",
    summary: "명사의 성과 수에 일치하는 형용사. 명사 뒤에 놓는 기본 어순과 앞에 오는 BAGS 예외, grand/grande 발음 변화까지.",
    duration: "약 9분",
    sections: [
      {
        heading: "성·수 일치 — 형용사는 명사를 따라가요",
        pattern: "여성형 = 남성형 + e · 복수형 = + s",
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
    order: 7,
    title: "소유 형용사 — sa mère는 '그의' 엄마일까 '그녀의' 엄마일까",
    titleFr: "Les adjectifs possessifs",
    summary: "mon/ma/mes 시스템의 핵심 반전: 소유자가 아니라 소유물의 성에 일치해요. 영어 his/her 감각을 버려야 하는 챕터.",
    duration: "약 9분",
    sections: [
      {
        heading: "기본 시스템 — 인칭 × 소유물의 성·수",
        pattern: "mon/ma/mes · ton/ta/tes · son/sa/ses · notre/nos · votre/vos · leur/leurs",
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
        body:
          "mon/ma를 가르는 기준은 내가 남자냐 여자냐가 아니라, **뒤에 오는 명사가 남성이냐 여성이냐**예요. 여성인 제가 말해도 '나의 아버지'는 mon père죠.\n\n" +
          "그래서 **sa mère**는 '그의 어머니'일 수도, '그녀의 어머니'일 수도 있어요. 누구의 어머니인지는 오직 문맥이 말해줘요.",
        examples: [
          { fr: "Paul aime sa mère.", ipa: "[pɔl ɛm sa mɛʁ]", ko: "폴은 자기 어머니를 사랑해요.", note: "소유자는 남자지만 mère가 여성 → sa" },
          { fr: "Marie aime son père.", ipa: "[maʁi ɛm sɔ̃ pɛʁ]", ko: "마리는 자기 아버지를 사랑해요.", note: "소유자는 여자지만 père가 남성 → son" },
          { fr: "Il cherche ses clés.", ipa: "[il ʃɛʁʃ se kle]", ko: "그는 자기 열쇠들을 찾고 있어요.", note: "복수면 무조건 ses" },
        ],
        vsEn: "영어 his/her는 **소유자**의 성을 따라가죠(his mother = 남자의 엄마). 프랑스어 son/sa는 정반대로 **소유물**의 성을 따라가요. 영어 감각으로 'her mother니까 sa...'라고 추론하면 우연히 맞을 뿐, 논리가 틀린 거예요. '그의/그녀의' 구별 자체가 프랑스어에는 없습니다.",
        pitfall: "한국어 '그의/그녀의'도 영어 his/her도 모두 소유자 기준이라, 한국인+영어 학습자에게 이중으로 함정인 지점이에요. 'son/sa/ses는 뒤 명사 보고 결정, 소유자는 쳐다보지도 않기' — 이 한 줄을 주문처럼 외우세요.",
      },
      {
        heading: "발음 보호 규칙 — 모음 앞에서는 ma 대신 mon",
        pattern: "여성 명사 + 모음 시작 → ma/ta/sa 대신 mon/ton/son (mon amie)",
        body:
          "여성 명사라도 **모음(또는 무음 h)으로 시작하면 mon/ton/son**을 써요. ma amie처럼 모음이 충돌하는 걸 프랑스어가 못 견디기 때문이에요.\n\n" +
          "형태만 mon을 빌려 쓸 뿐 명사는 여전히 여성이라, 일치는 여성형으로 해요: mon amie est joli**e**.",
        examples: [
          { fr: "mon amie", ipa: "[mɔ̃nami]", ko: "내 (여자인) 친구", note: "amie는 여성이지만 모음 앞이라 mon" },
          { fr: "son école", ipa: "[sɔ̃nekɔl]", ko: "그/그녀의 학교", note: "école은 여성 명사" },
          { fr: "ton histoire", ipa: "[tɔ̃nistwaʁ]", ko: "너의 이야기", note: "h 묵음 → 모음 취급" },
        ],
        tip: "리에종 덕분에 mon amie는 '몽나미'처럼 n이 살아나요. '모음 앞 여성 명사 = mon/ton/son + 리에종' 세트로 소리째 외우면 자연스럽게 입에 붙어요.",
      },
    ],
  },

  {
    slug: "a1-08-aller-venir",
    level: "A1",
    order: 8,
    title: "aller와 venir — 가고 오는 동사로 시간까지 표현",
    titleFr: "Aller, venir et leurs constructions",
    summary: "필수 불규칙 동사 aller/venir. 여기에 futur proche(곧 ~할 거예요)와 passé récent(방금 ~했어요)이 따라와요.",
    duration: "약 10분",
    sections: [
      {
        heading: "aller(가다) — 최강 불규칙 동사",
        pattern: "je vais · tu vas · il va · nous allons · vous allez · ils vont",
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
        vsEn: "영어 be going to와 구조가 완벽하게 평행해요: I'm going to eat = Je vais manger. '가다' 동사가 미래 표현으로 변신하는 발상까지 똑같으니, 영어 감각을 그대로 가져다 쓰면 됩니다.",
      },
      {
        heading: "venir(오다)와 passé récent — '방금 ~했어요'",
        pattern: "venir de + 동사 원형 → 방금 ~했어요 (passé récent)",
        body:
          "**venir**(오다)도 필수 불규칙 동사예요: je viens, tu viens, il vient, nous venons, vous venez, ils viennent [vjɛn].\n\n" +
          "aller + 원형이 가까운 미래라면, **venir de + 원형**은 가까운 과거예요. Je viens de manger.(나 방금 먹었어.) — 직역 '먹는 것으로부터 오는 길이다'.",
        examples: [
          { fr: "Je viens de Corée.", ipa: "[ʒə vjɛ̃ də kɔʁe]", ko: "저는 한국에서 왔어요.", note: "출신을 말하는 venir de + 장소" },
          { fr: "Je viens de manger.", ipa: "[ʒə vjɛ̃ də mɑ̃ʒe]", ko: "나 방금 먹었어.", note: "venir de + 원형 = 방금 ~했다" },
          { fr: "Le train vient de partir.", ipa: "[lə tʁɛ̃ vjɛ̃ də paʁtiʁ]", ko: "기차가 방금 떠났어요." },
        ],
        etym: "venir는 라틴어 venīre(오다)의 후손이에요. 영어 avenue(다다르는 길), advent(도래)에 같은 뿌리가 살아 있어요. '애비뉴 = 와 닿는 길'을 떠올리면 venir의 뜻이 붙잡혀요.",
      },
    ],
  },

  {
    slug: "a1-09-partitive",
    level: "A1",
    order: 9,
    title: "부분관사 — '빵을 좀' 말하는 법",
    titleFr: "Les articles partitifs",
    summary: "영어에도 한국어에도 없는 du/de la. 셀 수 없는 것의 '일부'를 말하는 관사로, 음식 이야기의 필수품이에요.",
    duration: "약 9분",
    sections: [
      {
        heading: "왜 필요한가 — '빵 하나'도 '빵 전체'도 아닐 때",
        pattern: "du + 남성 · de la + 여성 · de l' + 모음 앞 · des + 복수",
        patternKo: "셀 수 없는 것의 '얼마간, 좀'",
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
        body:
          "부분관사가 가장 바쁘게 일하는 곳은 식탁이에요. **manger**(먹다), **boire**(마시다, je bois), **prendre**(시키다, je prends) 같은 동사와 짝을 이뤄요.\n\n" +
          "카페 주문, 장보기, 아침 메뉴 — 전부 부분관사의 무대예요.",
        examples: [
          { fr: "Je bois du café le matin.", ipa: "[ʒə bwa dy kafe lə matɛ̃]", ko: "저는 아침에 커피를 마셔요." },
          { fr: "On prend du fromage ?", ipa: "[ɔ̃ pʁɑ̃ dy fʁɔmaʒ]", ko: "우리 치즈 (좀) 먹을까?" },
          { fr: "Il y a de la soupe et du riz.", ipa: "[ilja də la sup e dy ʁi]", ko: "수프와 밥이 있어요." },
        ],
        tip: "같은 명사라도 관사가 의미를 바꿔요. Je bois **du** café(커피를 마셔요 — 일부) vs J'aime **le** café(커피를 좋아해요 — 커피라는 것 전체). **좋아하고 싫어하는 대상엔 정관사, 먹고 마시는 양엔 부분관사** — 이 구별이 A1의 백미예요.",
      },
      {
        heading: "부정문에서는 전부 de로 변신",
        pattern: "부정문: du / de la / de l' / des → de",
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
    order: 10,
    title: "숫자 0~100, 시간과 날짜 — 4×20+10의 세계",
    titleFr: "Les nombres, l'heure et la date",
    summary: "70 = 60+10, 80 = 4×20?! 악명 높은 프랑스 숫자 체계를 웃으며 넘기고, 시간 묻기와 날짜 말하기까지 정리해요.",
    duration: "약 10분",
    sections: [
      {
        heading: "0~69 — 여기까지는 평화로워요",
        pattern: "20~69 = 십 단위 + 일 단위 · 21/31... = ... et un",
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
        body:
          "70부터 프랑스어는 갑자기 수학 문제를 내기 시작해요.\n\n" +
          "**70 = soixante-dix (60+10)** → 71은 soixante et onze(60+11), 75는 soixante-quinze(60+15)\n**80 = quatre-vingts (4×20)** → 곱셈까지 등장!\n**90 = quatre-vingt-dix (4×20+10)** → 99는 quatre-vingt-dix-neuf(4×20+10+9). 한 숫자에 단어가 네 개예요.\n\n" +
          "처음 보면 멘붕이 정상이에요. 하지만 생각해보면 우리도 '하나둘셋'과 '일이삼' 두 체계를 섞어 쓰고, 자릿수마다 '만, 억, 조'로 점프하는 언어를 쓰죠. 모든 언어는 어딘가 이상하고, 프랑스어는 그게 숫자일 뿐이에요. 전화번호와 가격에서 무한 반복되니, 외우려 하지 말고 들으면서 익숙해지세요.",
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
          { fr: "Ça coûte quatre-vingts euros.", ipa: "[sa kut katʁəvɛ̃ øʁo]", ko: "그건 80유로예요." },
          { fr: "J'ai soixante-quinze ans.", ipa: "[ʒe swasɑ̃tkɛ̃z ɑ̃]", ko: "저는 75살이에요." },
        ],
        tip: "벨기에와 스위스에서는 septante(70), nonante(90)라는 '정상적인' 단어를 써요. 스위스 일부는 huitante(80)까지. 프랑스인만 고집스럽게 암산을 즐기는 셈이니, 너무 미워하지는 마세요.",
        pitfall: "듣기에서 soixante...까지 듣고 60대 숫자로 적으면 함정에 빠져요. 뒤에 -dix/-quinze가 따라붙으면 70대로 점프하니까, **soixante와 quatre-vingt 뒤에는 항상 한 박자 기다리는 습관**을 들이세요.",
      },
      {
        heading: "시간 묻고 답하기 — Quelle heure est-il ?",
        body:
          "시간 질문은 **Quelle heure est-il ?**(몇 시예요?) — 도치형이지만 굳은 표현이라 통째로 외워요. 대답은 **Il est ... heure(s)** 틀에 숫자만 끼우면 돼요.\n\n" +
          "30분 = **et demie**, 15분 = **et quart**, '~시 15분 전' = **moins le quart**. 정오는 midi, 자정은 minuit라는 전용 단어를 써요.",
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
        body:
          "날짜는 **le + 숫자 + 달 이름**: le 3 mai(5월 3일). 어순이 한국어와 반대로 '일 → 월'이에요. 단 하나의 예외 — 1일만 서수를 써서 **le premier**(le 1er)예요.\n\n" +
          "요일(lundi 월 ~ dimanche 일)과 달 이름(janvier 1월 ~ décembre 12월)은 **소문자로** 써요. '매주 월요일마다'는 le lundi처럼 정관사를 붙여요.\n\n" +
          "'오늘 며칠이에요?'는 **On est le combien ?**(구어) 또는 Nous sommes le + 날짜로 답해요.",
        examples: [
          { fr: "On est le combien ? — On est le 9 juin.", ipa: "[ɔ̃nɛ lə kɔ̃bjɛ̃ — ɔ̃nɛ lə nœf ʒɥɛ̃]", ko: "오늘 며칠이에요? — 6월 9일이에요." },
          { fr: "Mon anniversaire, c'est le premier avril.", ipa: "[mɔ̃nanivɛʁsɛʁ sɛ lə pʁəmjɛʁ avʁil]", ko: "제 생일은 4월 1일이에요.", note: "1일만 premier" },
          { fr: "Je travaille le lundi.", ipa: "[ʒə tʁavaj lə lœ̃di]", ko: "저는 월요일마다 일해요.", note: "le + 요일 = 매주 반복" },
        ],
        vsEn: "영어는 May 3rd처럼 서수를 쓰지만, 프랑스어는 1일만 빼고 전부 기수예요(le trois mai). 그리고 영어와 달리 요일·달 이름을 **대문자로 쓰지 않는 것**도 작지만 자주 틀리는 차이예요.",
      },
    ],
  },
];
