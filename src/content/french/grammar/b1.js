/**
 * B1 중급 — 문장의 입체화
 * 시제·법(法)이 본격적으로 갈라지는 단계. 영어 문법 지식이 가장 큰 지렛대가 되는 레벨이에요.
 */
export default [
  {
    slug: "b1-01-conditionnel-present",
    level: "B1",
    order: 1,
    title: "조건법 현재 — 공손함과 가정의 시제",
    titleFr: "Le conditionnel présent",
    summary: "je voudrais의 정체. 영어 would에 해당하는 조건법으로 공손한 부탁과 '만약에' 가정을 말해요.",
    duration: "약 10분",
    sections: [
      {
        heading: "형태 — 미래 어간 + 반과거 어미",
        pattern: "미래 어간 + -ais, -ais, -ait, -ions, -iez, -aient",
        body:
          "**단순미래의 어간**에 **반과거의 어미**를 붙이면 끝 — 이미 배운 두 시제의 조합이라 새로 외울 건 거의 없어요.\n\n" +
          "미래형이 불규칙한 동사(être→ser-, avoir→aur-, aller→ir-, vouloir→voudr-, pouvoir→pourr- 등)는 조건법에서도 **같은 어간**을 그대로 써요.",
        table: {
          caption: "parler 조건법 현재",
          headers: ["인칭", "형태", "발음"],
          rows: [
            ["je", "parlerais", "[paʁləʁɛ]"],
            ["tu", "parlerais", "[paʁləʁɛ]"],
            ["il/elle", "parlerait", "[paʁləʁɛ]"],
            ["nous", "parlerions", "[paʁləʁjɔ̃]"],
            ["vous", "parleriez", "[paʁləʁje]"],
            ["ils/elles", "parleraient", "[paʁləʁɛ]"],
          ],
        },
        examples: [
          { fr: "je serais", ipa: "[ʒə səʁɛ]", ko: "(나는) ~일 텐데", note: "être — 어간 ser-" },
          { fr: "j'aurais", ipa: "[ʒoʁɛ]", ko: "(나는) 가질 텐데", note: "avoir — 어간 aur-" },
          { fr: "j'irais", ipa: "[ʒiʁɛ]", ko: "(나는) 갈 텐데", note: "aller — 어간 ir-" },
        ],
        pitfall: "미래 je parlerai [-ʁe]와 조건법 je parlerais [-ʁɛ]는 글자 하나(s) 차이예요. 발음도 '에'[e]와 '애'[ɛ]로 미묘하게 갈리는데, 실제 회화에서는 문맥으로 구별하는 경우가 많아요. 쓰기에서 s를 빼먹는 실수가 정말 흔하니 주의하세요.",
      },
      {
        heading: "용법 1 — 공손한 부탁: je voudrais의 정체",
        pattern: "Je voudrais... · Pourriez-vous... ?",
        patternKo: "조건법 = '주세요' → '주시겠어요?'의 공손화 장치",
        body:
          "**Je voudrais un café**의 voudrais가 바로 조건법이에요. Je veux를 조건법으로 바꾸면 '괜찮으시다면...' 하고 한 발 물러선 뉘앙스가 돼요.\n\n" +
          "한국어 '주세요' → '주시겠어요?'와 같은 공손화 장치예요. pouvoir와 vouloir의 조건법은 서비스 상황의 만능 열쇠입니다.",
        examples: [
          { fr: "Je voudrais réserver une table.", ko: "테이블을 예약하고 싶은데요." },
          { fr: "Pourriez-vous répéter, s'il vous plaît ?", ko: "다시 한번 말씀해 주시겠어요?" },
          { fr: "Tu pourrais m'aider ?", ko: "나 좀 도와줄 수 있어?", note: "반말에서도 조건법을 쓰면 부드러워져요." },
          { fr: "J'aimerais visiter la Corse un jour.", ko: "언젠가 코르시카에 가보고 싶어요." },
        ],
        vsEn: "영어 would/could와 거의 1:1이에요. I would like = je voudrais, Could you...? = Pourriez-vous...? 영어에서 공손하게 말하던 감각을 그대로 가져오면 됩니다.",
      },
      {
        heading: "용법 2 — 가정: si + 반과거, 조건법",
        pattern: "si + imparfait, conditionnel présent",
        patternKo: "'만약 ~라면 ...할 텐데' — 현재 사실과 다른 가정",
        body:
          "Si j'avais le temps, je voyagerais. — 시간이 있다면 여행할 텐데. (실제로는 없죠.)\n\n" +
          "**si절에는 반과거, 결과절에는 조건법** — 이 분업이 핵심이에요. 두 절의 순서는 바꿔도 됩니다.",
        examples: [
          { fr: "Si j'avais plus d'argent, j'achèterais cet appartement.", ko: "돈이 더 있다면 이 아파트를 살 텐데." },
          { fr: "Si tu venais avec nous, ce serait parfait.", ko: "네가 우리랑 같이 가면 완벽할 텐데." },
          { fr: "Qu'est-ce que tu ferais à ma place ?", ko: "내 입장이라면 어떻게 할 거야?" },
        ],
        pitfall: "si절 안에는 절대 조건법을 쓰지 않아요. 'Si j'aurais...'는 프랑스 아이들도 자주 틀려서 «Les si n'aiment pas les -rais»(si는 -rais를 싫어한다)라는 교정 문구가 있을 정도예요. **si에는 반과거, 조건법은 결과절에만**.",
      },
      {
        heading: "용법 3 — 조심스러운 단정과 충고",
        pattern: "tu devrais + 원형 → ~하는 게 좋겠어 (= should)",
        body:
          "조건법은 '확실하지 않음'의 표지이기도 해요. 뉴스의 미확인 정보(~라고 한다), 충고(tu devrais) 등에 두루 쓰여요.\n\n" +
          "특히 **devoir의 조건법(devrais)**은 영어 should에 해당하는 충고 표현으로, 일상 회화 빈도가 아주 높아요.",
        examples: [
          { fr: "Tu devrais te reposer un peu.", ko: "너 좀 쉬는 게 좋겠어.", note: "devoir 조건법 = should" },
          { fr: "Il y aurait trois blessés dans l'accident.", ko: "사고로 부상자가 세 명 발생한 것으로 보입니다.", note: "미확인 보도의 조건법" },
          { fr: "On pourrait aller au cinéma ce soir.", ko: "오늘 저녁에 영화 보러 가는 거 어때?", note: "조심스러운 제안" },
        ],
        tip: "조건법의 공통 분모는 '현실과의 거리 두기'예요. 부탁이면 공손해지고, 가정이면 비현실이 되고, 정보면 미확인이 돼요. would 하나로 묶어 기억하면 용법 셋이 한 줄에 정리됩니다.",
      },
    ],
  },

  {
    slug: "b1-02-subjonctif-intro",
    level: "B1",
    order: 2,
    title: "접속법 입문 — 사실이 아니라 머릿속을 말하는 법",
    titleFr: "Le subjonctif présent",
    summary: "프랑스어의 최대 고비, 접속법. '사실 서술 vs 머릿속 평가'라는 하나의 직관으로 정복을 시작해요.",
    duration: "약 12분",
    sections: [
      {
        heading: "접속법이란 — 카메라 vs 머릿속 필터",
        pattern: "사실 보고 → 직설법 · 바람·필요·감정·의심 → 접속법",
        body:
          "지금까지의 시제는 전부 세상을 카메라로 찍듯 **사실로 서술**하는 **직설법**이었어요. **접속법(subjonctif)**은 사실이 아니라 그에 대한 **내 머릿속의 평가·바람·감정·의심**을 말하는 모드예요.\n\n" +
          "Il faut qu'il **vienne**(그가 와야 해요)에서 '그가 온다'는 아직 사실이 아니라 머릿속 요구사항이죠. **que 뒤를 사실로 보고하면 직설법, 바람·평가의 대상으로 다루면 접속법** — 이 한 줄이 전체를 관통해요.",
        examples: [
          { fr: "Je sais qu'il vient.", ko: "그가 온다는 걸 알아요.", note: "안다 = 사실 보고 → 직설법 vient" },
          { fr: "Je veux qu'il vienne.", ko: "그가 오기를 원해요.", note: "원한다 = 머릿속 바람 → 접속법 vienne" },
        ],
        vsEn: "영어에는 이 범주가 거의 사라져서(I suggest that he **be** on time 같은 화석만 남음) 영어 지식이 도움이 안 되는 드문 지점이에요. 차라리 한국어로 생각하세요 — '~하기를', '~해야', '~라니 (기쁘다/이상하다)'처럼 절 전체가 바람·평가의 목적어가 되는 느낌이 들면 접속법 신호입니다.",
      },
      {
        heading: "형태 — ils 어간 + e, es, e, ions, iez, ent",
        pattern: "ils 현재형 - ent + -e, -es, -e, -ions, -iez, -ent",
        body:
          "**직설법 현재 ils 형태에서 -ent을 떼고** 어미를 붙여요: ils finissent → que je finisse. nous/vous는 반과거와 모양이 같아요.\n\n" +
          "규칙 -er 동사는 단수형이 직설법 현재와 모양이 같아서, 접속법인 줄 모르고 이미 쓰고 있는 경우도 많아요.",
        table: {
          caption: "finir 접속법 현재",
          headers: ["인칭", "형태", "발음"],
          rows: [
            ["que je", "finisse", "[finis]"],
            ["que tu", "finisses", "[finis]"],
            ["qu'il/elle", "finisse", "[finis]"],
            ["que nous", "finissions", "[finisjɔ̃]"],
            ["que vous", "finissiez", "[finisje]"],
            ["qu'ils/elles", "finissent", "[finis]"],
          ],
        },
        examples: [
          { fr: "qu'ils partent", ipa: "[kil paʁt]", ko: "그들이 떠나기를", note: "-ent은 언제나처럼 묵음 — 단수와 발음이 같아요" },
        ],
        tip: "접속법은 항상 que와 세트로 등장하니, 활용을 외울 때부터 que je finisse처럼 que를 붙여 통째로 외우세요. 입에 붙는 속도가 달라집니다.",
      },
      {
        heading: "꼭 외워야 할 불규칙 6총사",
        pattern: "être → sois · avoir → aie · aller → aille · faire → fasse · pouvoir → puisse · savoir → sache",
        body:
          "자주 쓰는 동사일수록 불규칙이에요. 이 여섯 개는 사용 빈도가 압도적이니 표째로 암기하세요.\n\n" +
          "être와 avoir는 어미까지 특이하고, aller와 vouloir는 nous/vous에서 어간이 바뀌는 점(aille/allions, veuille/voulions)을 조심하세요.",
        table: {
          caption: "불규칙 접속법 — que je / que nous 형태",
          headers: ["동사", "que je...", "que nous..."],
          rows: [
            ["être", "sois [swa]", "soyons [swajɔ̃]"],
            ["avoir", "aie [ɛ]", "ayons [ɛjɔ̃]"],
            ["aller", "aille [aj]", "allions [aljɔ̃]"],
            ["faire", "fasse [fas]", "fassions [fasjɔ̃]"],
            ["pouvoir", "puisse [pɥis]", "puissions [pɥisjɔ̃]"],
            ["savoir", "sache [saʃ]", "sachions [saʃjɔ̃]"],
          ],
        },
        examples: [
          { fr: "Il faut que tu sois à l'heure.", ko: "너 제시간에 와야 해." },
          { fr: "Je ne pense pas qu'il fasse beau demain.", ko: "내일 날씨가 좋을 것 같지 않아요." },
        ],
      },
      {
        heading: "접속법을 부르는 표현 — 필요·바람·감정·의심",
        pattern: "il faut que / vouloir que / être content que / douter que + 접속법",
        body:
          "**필요·의무**(il faut que), **바람·요구**(vouloir que, demander que), **감정**(être content que, c'est dommage que), **의심·부정**(douter que, je ne pense pas que) — 전부 '머릿속 평가'라는 공통점이 있어요.\n\n" +
          "이 중에서도 **il faut que + 접속법**은 일상 회화 최고 빈도 패턴이에요. 여기서부터 입에 붙이세요.",
        examples: [
          { fr: "Il faut que je parte maintenant.", ko: "저 이제 가야 해요." },
          { fr: "Mes parents veulent que je fasse du droit.", ko: "부모님은 제가 법학을 하길 원하세요." },
          { fr: "Je suis contente que tu sois là.", ko: "네가 있어서 기뻐. (여성 화자)" },
          { fr: "C'est dommage qu'il ne puisse pas venir.", ko: "그가 못 온다니 아쉽네요." },
        ],
        pitfall: "**espérer(희망하다)는 예외로 직설법**을 써요: J'espère qu'il viendra. 또, 주절과 종속절의 주어가 같으면 que절 대신 부정사를 써야 해요 — '내가 떠나기를 내가 원한다'는 Je veux que je parte(X)가 아니라 Je veux partir(O)예요. 한국어 '~하고 싶다'를 직역하다 que를 남발하지 않도록 주의하세요.",
        tip: "처음부터 규칙을 완벽히 따지기보다, Il faut que j'y aille(나 가봐야 해), Je veux que tu saches(네가 알았으면 해) 같은 고빈도 문장을 덩어리째 외우는 게 빨라요. 직관은 덩어리에서 자라납니다.",
      },
    ],
  },

  {
    slug: "b1-03-plus-que-parfait",
    level: "B1",
    order: 3,
    title: "대과거 — 과거보다 더 과거",
    titleFr: "Le plus-que-parfait",
    summary: "과거 이야기 속에서 '그보다 먼저 일어난 일'을 표시하는 시제. 영어 past perfect와 정확히 평행해요.",
    duration: "약 9분",
    sections: [
      {
        heading: "개념 — 과거의 과거",
        pattern: "대과거(더 먼저) → 복합과거/반과거 → 현재",
        patternKo: "'이미 ~했던' — 과거보다 더 과거",
        body:
          "과거 이야기 속에서 **그 시점보다 더 먼저 일어난 일**을 말할 때가 있죠. '역에 도착했어요(과거). 기차는 이미 떠났던 거예요(그보다 먼저).'\n\n" +
          "이 '이미 ~했던'을 담당하는 시제가 **대과거(plus-que-parfait)**예요. 과거 시간축이 3단이 된 거예요.",
        examples: [
          { fr: "Quand je suis arrivé à la gare, le train était déjà parti.", ko: "역에 도착했을 때, 기차는 이미 떠난 뒤였어요." },
          { fr: "Elle était fatiguée parce qu'elle avait mal dormi.", ko: "그녀는 피곤했어요. 잠을 잘 못 잤었거든요." },
        ],
        vsEn: "영어 past perfect(had + p.p.)와 형태도 용법도 정확히 평행이에요. The train had already left = Le train était déjà parti. 영어에서 had를 쓸 자리면 프랑스어에서는 대과거 — 이 등식은 거의 배신하지 않아요.",
      },
      {
        heading: "형태 — avoir/être의 반과거 + 과거분사",
        pattern: "avoir/être 반과거 + 과거분사 (j'avais fini · j'étais parti)",
        body:
          "복합과거를 알면 공짜로 얻는 시제예요. 조동사를 **반과거형으로 바꾸기만** 하면 돼요: J'ai fini → J'**avais** fini.\n\n" +
          "조동사 선택, être일 때의 성·수 일치, 대명동사 처리 — 전부 **복합과거의 규칙 그대로**예요.",
        table: {
          caption: "대과거 만들기",
          headers: ["복합과거", "대과거", "뜻"],
          rows: [
            ["j'ai mangé", "j'avais mangé", "먹었었다"],
            ["elle est arrivée", "elle était arrivée", "(그녀가) 도착해 있었다"],
            ["nous nous sommes couchés", "nous nous étions couchés", "(우리가) 잠자리에 들었었다"],
          ],
        },
        examples: [
          { fr: "Il avait déjà mangé quand je l'ai appelé.", ko: "내가 전화했을 때 그는 이미 식사를 마친 상태였어요." },
          { fr: "Nous étions déjà sortis quand il a commencé à pleuvoir.", ko: "비가 오기 시작했을 때 우리는 이미 나와 있었어요." },
        ],
      },
      {
        heading: "3단 시간축 — 이야기 속에서 굴리기",
        pattern: "반과거 = 무대 · 복합과거 = 사건 · 대과거 = 그 이전의 사연",
        body:
          "실제 이야기에서는 세 시제가 분업해요. **반과거**가 무대를 깔고, **복합과거**가 사건을 진행시키고, **대과거**가 그 이전의 사연을 끼워 넣어요.\n\n" +
          "'마리를 만났어(사건). 행복해 보였어(상태). 막 새 직장을 구했던 거야(이전 사연).' — 이 리듬이 프랑스어 스토리텔링의 기본 박자예요.",
        examples: [
          { fr: "Hier, j'ai croisé Marie au café. Elle avait l'air heureuse : elle venait de changer de travail, un poste qu'elle avait cherché pendant des mois.", ko: "어제 카페에서 마리와 마주쳤어요. 행복해 보이더라고요. 직장을 막 옮긴 참이었는데, 몇 달 동안 찾아다녔던 자리였대요." },
          { fr: "Je ne savais pas que tu avais vécu au Japon.", ko: "네가 일본에 살았었는지 몰랐어." },
        ],
        pitfall: "한국어 '-었었-'과 1:1 대응이 아니에요. 한국어는 '기차는 이미 떠났어요'처럼 그냥 과거로 말해도 자연스럽지만, 프랑스어는 기준 시점보다 앞선 일이면 대과거를 챙겨 써야 해요. 번역이 아니라 **시간 관계**(어느 쪽이 먼저인가)를 보고 시제를 고르세요.",
        tip: "déjà(이미)는 대과거의 단짝이에요. 과거 문장에 '이미'를 넣어 자연스러우면 대과거가 어울리는 자리일 확률이 높아요.",
      },
      {
        heading: "보너스 — Si j'avais su !",
        pattern: "Si + 대과거 ! → ~했더라면! (탄식)",
        body:
          "**Si j'avais su !**(알았더라면!)처럼 si + 대과거만 던지고 뒷말을 생략하면 후회의 탄식이 돼요.\n\n" +
          "이 si + 대과거가 '과거 사실과 반대되는 가정문'으로 완성되는 모습은 B2 가정문 챕터에서 만나요.",
        examples: [
          { fr: "Si j'avais su !", ko: "(그럴 줄) 알았더라면!" },
          { fr: "Ah, si tu m'avais écouté...", ko: "아, 네가 내 말을 들었더라면..." },
        ],
      },
    ],
  },

  {
    slug: "b1-04-relative-advanced",
    level: "B1",
    order: 4,
    title: "관계대명사 심화 — dont, où, lequel",
    titleFr: "Les pronoms relatifs dont, où, lequel",
    summary: "qui/que 다음 단계. de를 삼키는 dont, 장소와 시간의 où, 전치사 뒤의 lequel 계열을 정리해요.",
    duration: "약 10분",
    sections: [
      {
        heading: "복습 30초 — qui와 que의 분업",
        pattern: "qui = 주어 자리 · que = 직접목적어 자리",
        body:
          "l'ami **qui** habite à Lyon(qui가 주어), le livre **que** je lis(que가 목적어)였죠.\n\n" +
          "그런데 동사가 **de나 다른 전치사**를 데리고 다니면 qui/que로는 부족해요. 그 빈자리를 채우는 게 dont, où, lequel 계열이에요.",
        examples: [
          { fr: "C'est une amie qui travaille avec moi.", ko: "저와 함께 일하는 친구예요." },
          { fr: "Le film que tu m'as conseillé était super.", ko: "네가 추천해 준 영화 정말 좋았어." },
        ],
      },
      {
        heading: "dont — de를 통째로 삼키는 관계대명사",
        pattern: "de + 선행사 → dont (parler de → le livre dont je parle)",
        body:
          "**dont = de + 무엇**이에요. parler **de**, avoir besoin **de**처럼 de와 결합하는 표현이 관계절에 들어가면, 'de + 선행사' 자리를 dont 하나가 흡수해요.\n\n" +
          "또 하나의 큰 용법이 **소유**예요. la femme **dont** le fils est médecin(아들이 의사인 그 여자) — '~의(de)'를 dont이 담당하죠.",
        examples: [
          { fr: "C'est le livre dont je t'ai parlé.", ko: "내가 너한테 말했던 그 책이야.", note: "parler de → dont" },
          { fr: "Voilà tout ce dont j'ai besoin.", ko: "이게 내가 필요한 전부예요.", note: "avoir besoin de → dont" },
          { fr: "C'est un travail dont elle est très fière.", ko: "그녀가 아주 자랑스러워하는 작업이에요." },
          { fr: "J'ai un voisin dont la fille étudie en Corée.", ko: "딸이 한국에서 공부하는 이웃이 있어요.", note: "소유의 dont = 영어 whose" },
        ],
        vsEn: "소유의 dont은 영어 whose, 나머지 용법은 of which/about which에 해당해요. 다만 영어보다 훨씬 일상적으로 써요. '이 동사가 de를 데리고 다니던가?'를 자문하는 게 dont 사용의 출발점입니다.",
        pitfall: "dont 뒤의 어순은 평서문 그대로예요(dont + 주어 + 동사). 그리고 dont 안에 이미 de가 들어 있으니 le livre dont je parle de(X)처럼 de를 또 쓰면 안 돼요. 한국어에는 관계대명사 자체가 없어서('내가 말한 책'처럼 어미로 해결) 이 중복 실수가 특히 잦아요.",
      },
      {
        heading: "où — 장소만이 아니라 시간도",
        pattern: "장소·시간 선행사 → où (la ville où · le jour où)",
        body:
          "**où**는 선행사가 **장소**일 때 쓰는 관계대명사예요: la ville **où** je suis né(내가 태어난 도시).\n\n" +
          "자주 놓치는 건 **시간 선행사**예요. le jour **où** je t'ai rencontré(너를 만난 날) — quand이 아니라 où입니다.",
        examples: [
          { fr: "Voici le quartier où j'habite.", ko: "여기가 제가 사는 동네예요." },
          { fr: "Je me souviens du jour où on s'est rencontrés.", ko: "우리가 만난 날을 기억해요.", note: "시간 선행사에도 où" },
          { fr: "C'était une époque où tout semblait possible.", ko: "모든 게 가능해 보이던 시절이었어요." },
        ],
        pitfall: "영어 the day **when**의 영향으로 le jour quand(X)이라고 쓰기 쉬워요. 관계절을 이끄는 자리에서 quand은 못 써요 — 장소든 시간이든 선행사가 있으면 où입니다.",
      },
      {
        heading: "lequel 계열 — 그 밖의 전치사 뒤에는",
        pattern: "전치사 + lequel/laquelle/lesquels/lesquelles (à+lequel → auquel · de+lequel → duquel)",
        body:
          "avec, pour, sur, dans 같은 전치사 뒤에서는 **lequel 계열**(선행사의 성·수에 일치)을 써요: la table **sur laquelle**..., les amis **avec lesquels**...\n\n" +
          "à나 de는 정관사처럼 축약돼요(auquel, duquel). 선행사가 **사람**이면 전치사 + qui도 가능해요: l'amie avec qui je voyage.",
        table: {
          caption: "lequel 계열과 축약형",
          headers: ["성·수", "기본형", "à + ...", "de + ..."],
          rows: [
            ["남성 단수", "lequel", "auquel", "duquel"],
            ["여성 단수", "laquelle", "à laquelle", "de laquelle"],
            ["남성 복수", "lesquels", "auxquels", "desquels"],
            ["여성 복수", "lesquelles", "auxquelles", "desquelles"],
          ],
        },
        examples: [
          { fr: "C'est la raison pour laquelle je suis venu.", ko: "그게 제가 온 이유예요.", note: "pour laquelle = 영어 for which — 통째로 외울 가치가 있는 표현" },
          { fr: "Le projet auquel je pense est ambitieux.", ko: "제가 생각하는 프로젝트는 야심 차요.", note: "penser à → auquel" },
          { fr: "Les collègues avec qui je déjeune sont sympas.", ko: "같이 점심 먹는 동료들은 친절해요.", note: "사람이면 avec qui도 OK" },
        ],
        tip: "고르는 순서를 알고리즘으로 만들면 편해요. ① 빈자리가 주어? → qui ② 직접목적어? → que ③ de 결합? → dont ④ 장소·시간? → où ⑤ 그 밖의 전치사? → 전치사 + lequel(사람이면 qui). 이 다섯 갈래면 B1 관계절은 끝납니다.",
      },
    ],
  },

  {
    slug: "b1-05-gerondif",
    level: "B1",
    order: 5,
    title: "제롱디프 — en + -ant, 한 문장에 두 동작 담기",
    titleFr: "Le gérondif",
    summary: "'~하면서, ~함으로써, ~하면'을 en + -ant 하나로. 영어 -ing과 닮았지만 주어 일치라는 깐깐한 규칙이 있어요.",
    duration: "약 9분",
    sections: [
      {
        heading: "형태 — nous 어간 + -ant",
        pattern: "en + (nous 현재형 - ons + -ant) → en parlant",
        body:
          "제롱디프는 **en + 현재분사**예요. nous parlons → parlant → **en parlant**(말하면서). 어간의 철자(mangeons → mangeant)도 nous형을 그대로 따라가요.\n\n" +
          "예외는 딱 셋: être → **étant**, avoir → **ayant**, savoir → **sachant**.",
        table: {
          caption: "제롱디프 만들기",
          headers: ["동사", "nous 형태", "제롱디프"],
          rows: [
            ["parler", "parlons", "en parlant"],
            ["finir", "finissons", "en finissant"],
            ["faire", "faisons", "en faisant"],
            ["prendre", "prenons", "en prenant"],
            ["être / avoir / savoir", "(예외)", "en étant / en ayant / en sachant"],
          ],
        },
        examples: [
          { fr: "Il travaille en écoutant de la musique.", ko: "그는 음악을 들으면서 일해요." },
        ],
      },
      {
        heading: "용법 1 — 동시동작: ~하면서",
        pattern: "en + -ant → ~하면서 (강조·대조: tout en + -ant)",
        body:
          "가장 기본 용법은 **두 동작이 동시에** 일어남을 나타내는 '~하면서'예요. 주절의 동사와 제롱디프의 동작이 같은 시간에 겹쳐요.\n\n" +
          "동시성을 강조하거나 두 동작이 살짝 모순될 때(웃으면서 비판하기 등)는 **tout en + -ant**을 써요.",
        examples: [
          { fr: "Elle téléphone en marchant.", ko: "그녀는 걸으면서 통화해요." },
          { fr: "Ne mange pas en regardant ton portable !", ko: "휴대폰 보면서 먹지 마!" },
          { fr: "Il m'a dit non tout en souriant.", ko: "그는 웃으면서도 안 된다고 했어요.", note: "tout en — 동시성·대조 강조" },
        ],
      },
      {
        heading: "용법 2 — 수단과 조건: ~함으로써, ~하면",
        pattern: "en + -ant → ~함으로써 · ~하면",
        body:
          "'어떻게?'에 답하는 **수단·방법**의 용법이에요: C'est en forgeant qu'on devient forgeron(쇠를 두드림으로써 대장장이가 된다 — 속담).\n\n" +
          "**조건**의 뉘앙스로도 써요: En partant maintenant, tu arriveras à l'heure(지금 떠나면 제시간에 도착할 거야).",
        examples: [
          { fr: "J'ai appris le français en regardant des séries.", ko: "드라마를 보면서(봄으로써) 프랑스어를 배웠어요." },
          { fr: "En lisant tous les jours, on enrichit son vocabulaire.", ko: "매일 읽으면 어휘가 풍부해져요.", note: "조건의 제롱디프" },
          { fr: "Tu peux payer en utilisant ton téléphone.", ko: "휴대폰으로(휴대폰을 사용해서) 결제할 수 있어요." },
        ],
        tip: "한국어 번역을 고르는 요령: 동시면 '~하면서', 수단이면 '~해서/함으로써', 조건이면 '~하면'. 프랑스어는 en + -ant 하나로 셋을 다 커버하니, 해석은 문맥이 결정해요.",
      },
      {
        heading: "제약 — 주어가 반드시 일치해야 해요",
        pattern: "제롱디프의 숨은 주어 = 주절의 주어",
        body:
          "Elle téléphone en marchant에서 걷는 사람과 통화하는 사람은 같은 '그녀'죠. 이 일치가 **의무**예요.\n\n" +
          "'비가 오면서 우리는 출발했다'처럼 두 동작의 주어가 다르면 제롱디프를 못 쓰고, Comme il pleuvait, nous sommes partis처럼 접속사로 풀어야 해요.",
        examples: [
          { fr: "En sortant du métro, j'ai vu Paul.", ko: "지하철에서 나오다가 폴을 봤어요.", note: "나온 사람 = 본 사람 = je ✓" },
          { fr: "Je l'ai croisée en allant au marché.", ko: "시장에 가다가 그녀와 마주쳤어요." },
        ],
        vsEn: "영어 -ing 분사구문과 닮았지만 프랑스어가 더 엄격해요. 영어에서도 dangling participle(주어 불일치 분사구문)은 문법 오류지만 일상에서 흔히 보이는 반면, 프랑스어 제롱디프의 주어 일치는 시험과 작문에서 칼같이 적용돼요.",
        pitfall: "한국어 '~하면서'는 주어가 달라도 됩니다('음악이 흐르면서 분위기가 좋아졌다'). 그 감각으로 제롱디프를 쓰면 비문이 돼요. 제롱디프를 쓰기 전에 '두 동작의 주인이 같은가?'를 꼭 확인하세요.",
      },
    ],
  },

  {
    slug: "b1-06-passive",
    level: "B1",
    order: 6,
    title: "수동태 — 그리고 프랑스어가 수동태를 피하는 법",
    titleFr: "La voix passive",
    summary: "être + 과거분사 + par로 만드는 수동태. 그런데 정작 프랑스어는 on을 써서 수동을 피하길 좋아해요.",
    duration: "약 9분",
    sections: [
      {
        heading: "형태 — être + 과거분사 (+ par)",
        pattern: "être + 과거분사 (+ par 행위자)",
        body:
          "능동문의 목적어가 주어로 올라오는 구조예요: Le chat mange la souris → La souris **est mangée** par le chat.\n\n" +
          "주의 둘. ① 과거분사는 **주어의 성·수에 일치**(mangée). ② 시제는 être가 짊어져요 — être를 복합과거로 바꾸면 수동태 과거가 됩니다.",
        examples: [
          { fr: "Ce roman est traduit en vingt langues.", ko: "이 소설은 20개 언어로 번역되어 있어요." },
          { fr: "La tour Eiffel a été construite en 1889.", ko: "에펠탑은 1889년에 건설되었어요.", note: "a été + construite — 복합과거 수동, 여성 일치" },
          { fr: "Les résultats seront annoncés demain.", ko: "결과는 내일 발표될 거예요.", note: "미래 수동" },
        ],
        table: {
          caption: "시제별 수동태 — inviter(초대하다), elle 기준",
          headers: ["시제", "형태", "뜻"],
          rows: [
            ["현재", "elle est invitée", "초대받는다/받았다"],
            ["복합과거", "elle a été invitée", "초대받았다"],
            ["반과거", "elle était invitée", "초대받곤 했다/받은 상태였다"],
            ["미래", "elle sera invitée", "초대받을 것이다"],
          ],
        },
      },
      {
        heading: "par냐 de냐 — 행위자 표시의 두 갈래",
        pattern: "구체적 행위·사건 → par · 감정·지속 상태 → de",
        body:
          "행위자는 보통 **par**지만, **감정·상태·동반**을 나타낼 때는 **de**를 써요: aimé **de** tous(모두에게 사랑받는), couvert **de** neige(눈으로 덮인).\n\n" +
          "처음엔 aimé de, couvert de, suivi de, accompagné de 같은 단골 표현을 통째로 외우는 게 실용적이에요.",
        examples: [
          { fr: "Elle est respectée de tous ses collègues.", ko: "그녀는 모든 동료에게 존경받아요.", note: "감정 → de" },
          { fr: "La maison a été détruite par l'incendie.", ko: "그 집은 화재로 파괴됐어요.", note: "사건 → par" },
        ],
        vsEn: "영어는 행위자를 by 하나로 통일하지만 프랑스어는 par/de 두 갈래예요. 그 외의 구조(be + p.p. ↔ être + p.p.)는 영어와 똑같으니, 차이점인 par/de와 과거분사 일치에만 집중하면 돼요.",
      },
      {
        heading: "프랑스어식 습관 — on으로 수동 피하기",
        pattern: "수동 회피: on + 능동문 · 대명동사 수동 (Ça se vend bien)",
        body:
          "**프랑스어 회화는 수동태를 별로 좋아하지 않아요**. 행위자가 불분명하면 **on**을 주어로 한 능동문이 훨씬 자연스러워요: On parle français en France. / On m'a volé mon portefeuille.\n\n" +
          "또 하나의 회피 장치는 **대명동사 수동**이에요: Ça **se vend** bien(잘 팔려요). 일반적 사실·관습을 말할 때 애용돼요.",
        examples: [
          { fr: "On m'a volé mon vélo.", ko: "자전거를 도둑맞았어요.", note: "수동태보다 훨씬 자연스러운 on 구문" },
          { fr: "On construit un nouveau musée ici.", ko: "여기에 새 미술관이 지어지고 있어요." },
          { fr: "Ce mot ne se dit plus.", ko: "그 단어는 이제 안 써요.", note: "대명동사 수동" },
          { fr: "Le champagne se sert très frais.", ko: "샴페인은 아주 차게 내요." },
        ],
        tip: "글(신문·보고서)에서는 수동태가 격식 있게 쓰이지만, 말에서는 on이 기본값이에요. '쓸 줄은 알되, 말할 땐 on부터 떠올리기' — 이게 B1의 현실적인 목표입니다.",
      },
      {
        heading: "한국어 피동과의 대응 — '-되다/-받다/-당하다'",
        pattern: "-되다/-받다 ≈ être + p.p. · -당하다 ≈ 수동 또는 on 구문",
        body:
          "한국어에도 피동이 있어서 개념 자체는 익숙해요. 다만 방향이 항상 일치하지는 않아요 — 한국어 피동을 프랑스어는 on 능동으로(도둑맞았다 → On m'a volé...) 말하는 경우가 많아요.\n\n" +
          "**형태 대응이 아니라 '그 상황에서 프랑스인이 뭐라고 하는가'**를 기준으로 삼으세요.",
        examples: [
          { fr: "Je suis invité au mariage de Léa.", ko: "레아 결혼식에 초대받았어요." },
          { fr: "Il a été licencié le mois dernier.", ko: "그는 지난달에 해고당했어요." },
        ],
        pitfall: "한국어 '-되다'에 이끌려 모든 문장을 수동으로 만들면 어색한 프랑스어가 돼요. 특히 '이해되다, 생각되다' 같은 표현은 수동이 아니라 Je comprends, Je pense처럼 능동으로 말해야 합니다.",
      },
    ],
  },

  {
    slug: "b1-07-discours-indirect",
    level: "B1",
    order: 7,
    title: "간접화법 — 남의 말 옮기기와 시제 후퇴",
    titleFr: "Le discours indirect",
    summary: "« Il m'a dit que... » 남의 말을 전할 때 일어나는 시제 후퇴와 의문문 변환 규칙. 영어 backshift와 평행해요.",
    duration: "약 10분",
    sections: [
      {
        heading: "기본 구조 — dire que로 문장 옮기기",
        body:
          "남의 말을 따옴표째 전하는 게 직접화법, 내 문장 속에 녹여 전하는 게 **간접화법**이에요. 평서문은 **dire que**(~라고 말하다)로 연결해요.\n\n" +
          "Il dit : « Je suis fatigué. » → Il dit **qu'il est** fatigué.\n\n" +
          "따옴표를 풀면서 **인칭이 화자 기준으로 바뀌는 것**(je → il, mon → son)에 주의하세요. 주절이 현재(Il dit)면 종속절 시제는 그대로 유지돼요.",
        examples: [
          { fr: "Elle dit qu'elle a faim.", ko: "그녀는 배고프다고 말해요." },
          { fr: "Il dit que son frère habite à Busan.", ko: "그는 자기 형이 부산에 산다고 해요.", note: "mon frère → son frère" },
        ],
      },
      {
        heading: "시제 후퇴 — 주절이 과거가 되면",
        body:
          "핵심 규칙: **주절이 과거(Il a dit, Elle a demandé...)면 종속절의 시제가 한 칸 뒤로 물러나요.**\n\n" +
          "현재 → 반과거, 복합과거 → 대과거, 미래 → 조건법 현재. '그가 말한 시점'을 기준으로 시간 전체가 과거 쪽으로 평행이동하는 거예요. 반과거·대과거·조건법은 이미 물러난 형태라 그대로 둡니다.",
        table: {
          caption: "시제 후퇴 — Il a dit que... 뒤에서",
          headers: ["직접화법", "간접화법", "예"],
          rows: [
            ["현재", "반과거", "« Je suis là » → qu'il était là"],
            ["복합과거", "대과거", "« J'ai fini » → qu'il avait fini"],
            ["단순미래", "조건법 현재", "« Je viendrai » → qu'il viendrait"],
            ["반과거", "(유지)", "« Il pleuvait » → qu'il pleuvait"],
          ],
        },
        examples: [
          { fr: "Il m'a dit qu'il était fatigué.", ko: "그는 피곤하다고 (내게) 말했어요." },
          { fr: "Elle a dit qu'elle avait déjà vu ce film.", ko: "그녀는 그 영화를 이미 봤다고 했어요." },
          { fr: "Tu m'avais promis que tu viendrais !", ko: "너 온다고 약속했잖아!" },
        ],
        vsEn: "영어 backshift와 완전히 평행이에요. He said he **was** tired = Il a dit qu'il **était** fatigué, he **would** come = qu'il **viendrait**. 영어에서 시제 일치를 익혔다면 표를 외울 필요 없이 그 감각을 그대로 옮기면 됩니다.",
        pitfall: "한국어는 '피곤하다고 했다'처럼 인용절 시제를 현재로 둬도 자연스러워서, 시제 후퇴를 빼먹는 실수가 정말 잦아요. 주절이 과거인지부터 확인하는 습관을 들이세요.",
      },
      {
        heading: "의문문 옮기기 — si와 ce que",
        body:
          "의문문은 **demander**(묻다)로 옮기는데, 의문문의 종류에 따라 연결사가 달라져요.\n\n" +
          "**네/아니오 의문문 → si**: « Tu viens ? » → Il demande **si** je viens.\n" +
          "**qu'est-ce que(무엇을) → ce que**: « Qu'est-ce que tu fais ? » → Il demande **ce que** je fais.\n" +
          "**qu'est-ce qui(무엇이) → ce qui**: « Qu'est-ce qui se passe ? » → Il demande **ce qui** se passe.\n" +
          "**그 밖의 의문사(où, quand, pourquoi, comment...)는 그대로 유지**: Il demande **où** j'habite.",
        examples: [
          { fr: "Elle m'a demandé si j'étais libre samedi.", ko: "그녀는 내가 토요일에 시간이 되는지 물었어요." },
          { fr: "Il m'a demandé ce que je faisais dans la vie.", ko: "그는 내 직업이 뭔지 물었어요." },
          { fr: "Je lui ai demandé pourquoi elle avait changé d'avis.", ko: "왜 마음을 바꿨는지 그녀에게 물었어요." },
        ],
        pitfall: "est-ce que는 따옴표 밖으로 살아남지 못해요. Il demande est-ce que...(X), qu'est-ce que를 그대로 둔 Il demande qu'est-ce que je fais(X)도 비문이에요. 간접의문문에는 의문문 어순도, est-ce que도 없습니다 — si/ce que + 평서문 어순!",
      },
      {
        heading: "명령문과 시간 표현의 변신",
        body:
          "**명령문은 de + 부정사**로 옮겨요: « Attends-moi ! » → Il m'a dit **de l'attendre**(기다리라고 했어요). 부정 명령은 de **ne pas** + 부정사.\n\n" +
          "말한 시점이 과거로 밀리면 **시간·장소 표현도 함께** 바뀌어요: aujourd'hui → ce jour-là(그날), demain → le lendemain(다음 날), hier → la veille(전날), ici → là.",
        examples: [
          { fr: "Le médecin m'a dit de me reposer.", ko: "의사가 쉬라고 했어요." },
          { fr: "Elle m'a dit de ne pas m'inquiéter.", ko: "그녀는 걱정하지 말라고 했어요." },
          { fr: "Il a dit qu'il partirait le lendemain.", ko: "그는 다음 날 떠날 거라고 했어요.", note: "demain → le lendemain" },
        ],
        tip: "간접화법은 규칙 암기보다 '말한 사람의 시점에 서 보기'가 본질이에요. 그 사람에게 '내일'이었던 날이 지금 보면 '그다음 날'이죠. 시점만 갈아타면 인칭·시제·시간 표현이 다 같은 원리로 풀립니다.",
      },
    ],
  },

  {
    slug: "b1-08-pronouns-advanced",
    level: "B1",
    order: 8,
    title: "지시대명사와 소유대명사 — celui, le mien, ce qui",
    titleFr: "Celui, le mien, ce qui / ce que",
    summary: "명사 반복을 끊어내는 대명사 세트. '~의 것' celui, '내 것' le mien, 그리고 만능 연결사 ce qui/ce que까지.",
    duration: "약 10분",
    sections: [
      {
        heading: "celui 계열 — '그것/그 사람'으로 명사 반복 피하기",
        body:
          "같은 명사를 두 번 말하기 싫을 때, **앞에 나온 명사를 성·수에 맞는 celui 계열로 대신**해요: celui(남단), celle(여단), ceux(남복), celles(여복).\n\n" +
          "단, celui는 혼자 못 서고 반드시 뒤에 보충이 붙어요. 붙는 것은 세 종류: ① **de + 명사**(소속·소유), ② **관계절**(qui/que/dont), ③ **-ci/-là**(이것/저것).",
        table: {
          caption: "celui 계열",
          headers: ["", "단수", "복수"],
          rows: [
            ["남성", "celui", "ceux"],
            ["여성", "celle", "celles"],
          ],
        },
        examples: [
          { fr: "Ma voiture est plus vieille que celle de Paul.", ko: "내 차는 폴의 것(차)보다 오래됐어요.", note: "celle = la voiture" },
          { fr: "Ceux qui veulent venir, levez la main !", ko: "오고 싶은 사람은 손 드세요!", note: "ceux qui = ~하는 사람들" },
          { fr: "Quel gâteau tu prends ? — Celui-ci ou celui-là ?", ko: "어떤 케이크 먹을래? — 이거, 아니면 저거?" },
          { fr: "Je préfère celle que tu portais hier.", ko: "네가 어제 입었던 게 더 좋아." },
        ],
        vsEn: "영어 the one(s)에 해당해요. the one I bought = celui/celle que j'ai acheté(e), those who = ceux qui. 영어와 달리 성·수 구별이 있다는 점만 추가하면 됩니다.",
      },
      {
        heading: "소유대명사 — le mien, la tienne, les leurs",
        body:
          "'내 것', '네 것'을 한 단어로 말하는 **소유대명사**예요. C'est mon livre → C'est **le mien**(그건 내 거야).\n\n" +
          "포인트는 둘. ① 정관사(le/la/les)가 세트의 일부예요 — 관사 없이 mien만 쓰지 않아요. ② 성·수는 **소유자가 아니라 가리키는 물건**에 일치해요. 그의 가방(le sac)이면 소유자가 여성이어도 le sien입니다.",
        table: {
          caption: "소유대명사 전체표",
          headers: ["소유자", "남성 단수", "여성 단수", "남성 복수", "여성 복수"],
          rows: [
            ["나", "le mien", "la mienne", "les miens", "les miennes"],
            ["너", "le tien", "la tienne", "les tiens", "les tiennes"],
            ["그/그녀", "le sien", "la sienne", "les siens", "les siennes"],
            ["우리", "le nôtre", "la nôtre", "les nôtres", "les nôtres"],
            ["당신(들)", "le vôtre", "la vôtre", "les vôtres", "les vôtres"],
            ["그들", "le leur", "la leur", "les leurs", "les leurs"],
          ],
        },
        examples: [
          { fr: "Ce parapluie, c'est le tien ?", ko: "이 우산 네 거야?" },
          { fr: "Mes parents habitent à Séoul, les siens à Lyon.", ko: "우리 부모님은 서울에, 그(그녀)의 부모님은 리옹에 사세요." },
          { fr: "À la vôtre !", ko: "건배! (당신의 건강을 위하여)", note: "축배 관용구 — à votre santé의 santé가 숨은 형태" },
        ],
        pitfall: "notre/votre(소유형용사)와 nôtre/vôtre(소유대명사)는 악상 시르콩플렉스 하나 차이지만 발음이 달라요 — notre [nɔtʁ](열린 오) vs le nôtre [notʁ](닫힌 오). 그리고 le sien은 영어 his/hers와 달리 소유자의 성별 정보가 없어요. 물건의 성만 따라갑니다.",
      },
      {
        heading: "ce qui / ce que — 선행사 없는 관계절",
        body:
          "qui/que 앞에 선행사 명사가 없을 때는 **중성 대명사 ce**를 받침대로 세워요. **ce qui**(~하는 것 — 주어 자리), **ce que**(~하는 것 — 목적어 자리). '무엇'인지 정해지지 않은 막연한 '것'을 가리켜요.\n\n" +
          "Dis-moi **ce que** tu veux(네가 원하는 것을 말해줘), **Ce qui** m'intéresse, c'est l'histoire(나를 흥미롭게 하는 것은 역사예요). de 결합 동사면 **ce dont**: ce dont j'ai besoin(내가 필요로 하는 것).\n\n" +
          "ce qui/ce que는 간접화법(qu'est-ce que → ce que)에서 이미 만났고, B2의 강조 구문(Ce qui..., c'est...)에서 주인공이 돼요. 여기서 확실히 잡아두면 두 챕터가 공짜로 풀립니다.",
        examples: [
          { fr: "Ce qui compte, c'est la santé.", ko: "중요한 것은 건강이에요." },
          { fr: "Je ne comprends pas ce que tu dis.", ko: "네가 무슨 말을 하는지 모르겠어." },
          { fr: "Prends tout ce dont tu as besoin.", ko: "필요한 건 전부 가져가." },
          { fr: "Il est arrivé en retard, ce qui m'a énervé.", ko: "그가 늦게 왔는데, 그게 나를 짜증나게 했어요.", note: "앞 문장 전체를 받는 ce qui" },
        ],
        vsEn: "영어 what(= the thing which)에 해당해요. what I want = ce que je veux. 영어는 what 하나지만 프랑스어는 절 안에서의 역할에 따라 ce qui(주어)/ce que(목적어)/ce dont(de 결합)으로 갈라진다는 점이 차이예요.",
        tip: "구별 요령은 관계대명사 때와 같아요. 뒤따르는 절에 주어가 없으면 ce qui(ce qui se passe — se passe의 주어가 없죠), 주어가 이미 있으면 ce que(ce que tu fais — tu가 주어). 5초 점검으로 충분합니다.",
      },
    ],
  },
];
