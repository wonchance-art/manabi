/**
 * A2 초급 — 시제와 대명사로 문장에 입체감 더하기
 * 과거·미래 시제, 대명동사, 목적 대명사, 관계대명사까지 — 진짜 이야기를 할 수 있게 되는 레벨.
 */
const chapters = [
  {
    slug: "a2-01-passe-compose-avoir",
    level: "A2",
    order: 1,
    title: "\"피자 먹었어요\" — 과거를 말하는 법",
    topic: "복합과거 passé composé (avoir)",
    titleFr: "Le passé composé avec avoir",
    summary: "프랑스어 회화 과거시제의 기본형. 형태는 영어 현재완료를 닮았지만 의미는 그냥 과거라는 게 핵심이에요.",
    duration: "약 10분",
    sections: [
      {
        heading: "공식 — avoir 현재형 + 과거분사",
        pattern: "avoir 현재형 + 과거분사",
        patternKo: "회화의 '~했어요'를 담당하는 복합과거",
        body:
          "회화에서 '~했어요'를 담당하는 시제가 **passé composé**(복합과거)예요. J'ai mangé.(나 먹었어.)\n\n" +
          "**avoir만 인칭에 따라 변하고**, 과거분사는 (avoir 조동사일 때는) 원칙적으로 변하지 않아요. 예외 하나만 예고: 직접목적어가 동사 **앞으로** 나오면 과거분사가 그에 일치해요 — la pomme que j'ai mang**ée**(내가 먹은 사과). 정밀 규칙은 뒤에서 다뤄요.",
        table: {
          caption: "manger의 passé composé",
          headers: ["인칭", "형태", "발음"],
          rows: [
            ["j'", "ai mangé", "[ʒe mɑ̃ʒe]"],
            ["tu", "as mangé", "[ty a mɑ̃ʒe]"],
            ["il / elle / on", "a mangé", "[il a mɑ̃ʒe]"],
            ["nous", "avons mangé", "[nuzavɔ̃ mɑ̃ʒe]"],
            ["vous", "avez mangé", "[vuzave mɑ̃ʒe]"],
            ["ils / elles", "ont mangé", "[ilzɔ̃ mɑ̃ʒe]"],
          ],
        },
        examples: [
          { fr: "J'ai mangé une pizza.", ipa: "[ʒe mɑ̃ʒe yn pidza]", ko: "저는 피자를 먹었어요." },
          { fr: "Tu as bien dormi ?", ipa: "[ty a bjɛ̃ dɔʁmi]", ko: "잘 잤어?" },
          { fr: "Nous avons regardé un film.", ipa: "[nuzavɔ̃ ʁəgaʁde œ̃ film]", ko: "우리는 영화를 한 편 봤어요." },
        ],
      },
      {
        heading: "과거분사 만들기 — 규칙과 단골 불규칙",
        pattern: "-er → -é (mangé) · -ir → -i (fini)",
        patternKo: "과거분사 만들기 — 규칙은 깔끔, 단골 동사는 불규칙",
        body:
          "규칙은 동사 그룹별로 깔끔해요. -er 동사의 -é는 발음이 원형과 같은 [e]예요.\n\n" +
          "자주 쓰는 동사일수록 불규칙이지만, 최빈출 불규칙은 한 줌이라 표로 끝낼 수 있어요.",
        table: {
          caption: "단골 불규칙 과거분사",
          headers: ["원형", "과거분사", "예시"],
          rows: [
            ["avoir (가지다)", "eu [y]", "J'ai eu peur. (무서웠어요)"],
            ["être (~이다)", "été [ete]", "Ça a été. (그럭저럭 괜찮았어요)"],
            ["faire (하다)", "fait [fɛ]", "J'ai fait du sport."],
            ["prendre (먹다/타다)", "pris [pʁi]", "J'ai pris le métro."],
            ["voir (보다)", "vu [vy]", "J'ai vu Marie."],
            ["boire (마시다)", "bu [by]", "J'ai bu du café."],
            ["vouloir (원하다)", "voulu [vuly]", "Il a voulu partir."],
          ],
        },
        examples: [
          { fr: "J'ai pris le métro.", ipa: "[ʒe pʁi lə metʁo]", ko: "저는 지하철을 탔어요." },
          { fr: "Elle a fait ses devoirs.", ipa: "[ɛl a fɛ se dəvwaʁ]", ko: "그녀는 숙제를 했어요." },
          { fr: "On a vu un bon film.", ipa: "[ɔ̃na vy œ̃ bɔ̃ film]", ko: "우리 좋은 영화 봤어." },
        ],
        tip: "avoir의 과거분사 eu는 철자와 달리 그냥 [y] — A0에서 연습한 그 u 소리 하나예요. 그리고 voir의 과거분사 vu는 이미 알고 계시죠 — 데자뷔(déjà vu)가 바로 '이미(déjà) 본(vu)'이거든요. 과거분사는 이렇게 한국어에 들어온 프랑스어 속에도 숨어 있어요.",
      },
      {
        heading: "의미 — 형태는 현재완료, 쓰임은 그냥 과거",
        pattern: "passé composé = 완료된 과거 사건 ('-었어요')",
        patternKo: "형태는 영어 현재완료, 쓰임은 그냥 과거",
        body:
          "passé composé는 **완료된 과거의 사건**을 말하는, 한국어 '-었어요/-했어요'에 해당하는 평범한 과거시제예요.\n\n" +
          "회화의 과거는 거의 전부 이걸로 처리돼요. hier(어제), la semaine dernière(지난주) 같은 시간 표현과 단짝이에요.",
        examples: [
          { fr: "Hier, j'ai travaillé.", ipa: "[jɛʁ ʒe tʁavaje]", ko: "어제 저는 일했어요." },
          { fr: "La semaine dernière, nous avons visité Lyon.", ipa: "[la səmɛn dɛʁnjɛʁ nuzavɔ̃ vizite ljɔ̃]", ko: "지난주에 우리는 리옹을 구경했어요." },
        ],
        vsEn: "형태만 보면 영어 현재완료(have + p.p.)와 똑같죠: J'ai mangé = I have eaten. 하지만 **의미는 I ate(단순과거)**예요. 영어에서는 'Yesterday I have eaten'이 비문이지만, 프랑스어 'Hier, j'ai mangé'는 완벽한 문장이에요. '형태는 영어 현재완료, 용법은 영어 과거형' — 이 비대칭을 받아들이는 게 A2의 첫 관문이에요.",
        enParallel: {
          rows: [
            { en: "I **have eaten** a pizza.", fr: "J'**ai mangé** une pizza.", ipa: "[ʒe mɑ̃ʒe yn pidza]", ko: "저는 피자를 먹었어요." },
            { en: "We **have watched** a film.", fr: "Nous **avons regardé** un film.", ipa: "[nuzavɔ̃ ʁəɡaʁde œ̃ film]", ko: "우리는 영화를 한 편 봤어요." },
            { en: "**Have** you **eaten**?", fr: "Tu **as mangé** ?", ipa: "[ty a mɑ̃ʒe]", ko: "너 밥 먹었어?" },
          ],
          note: "avoir + 과거분사 = 영어 have + p.p. 구조가 완전히 같아요. (단, 프랑스어는 회화 과거에도 이 형태를 써서 영어 단순과거 자리도 덮어요.)",
        },
      },
      {
        heading: "부정문과 의문문 — 샌드위치는 조동사만 감싸요",
        pattern: "ne + avoir + pas + 과거분사 (Je n'ai pas mangé)",
        patternKo: "복합과거의 부정은 조동사 avoir만 감싸기",
        body:
          "ne ... pas는 **조동사 avoir만** 감싸요. 과거분사는 샌드위치 바깥에 남아요 — 'Je n'ai mangé pas'가 아니에요.\n\n" +
          "의문문은 평소처럼: 억양만 올리거나, Est-ce que를 붙이거나, 조동사를 도치해요(As-tu mangé ?).",
        examples: [
          { fr: "Je n'ai pas fini.", ipa: "[ʒə nɛ pa fini]", ko: "저는 아직 못 끝냈어요." },
          { fr: "Il n'a pas pris de café.", ipa: "[il na pa pʁi də kafe]", ko: "그는 커피를 안 마셨어요.", note: "부정문이라 du → de" },
          { fr: "Est-ce que tu as mangé ?", ipa: "[ɛskə ty a mɑ̃ʒe]", ko: "너 밥 먹었어?" },
        ],
        pitfall: "ne...pas의 포위 대상은 어디까지나 **활용된 동사 = avoir**예요. 한국어 '안 먹었다'처럼 본동사를 부정하고 싶은 직감 때문에 pas를 과거분사 뒤로 보내는 실수가 잦아요. 'pas는 avoir 바로 뒤'로 고정하세요.",
      },
    ],
  },

  {
    slug: "a2-02-passe-compose-etre",
    level: "A2",
    order: 2,
    title: "\"어제 갔어요\"가 특별한 이유",
    topic: "복합과거 passé composé (être)",
    titleFr: "Le passé composé avec être",
    summary: "이동·상태변화 동사 한 줌과 모든 대명동사는 조동사로 être를 써요. 이때 과거분사가 주어에 성수 일치하는 것까지.",
    duration: "약 9분",
    sections: [
      {
        heading: "어떤 동사가 être를 고를까 — 이동과 상태변화",
        pattern: "이동·상태변화 동사 → être 현재형 + 과거분사 (Je suis allé)",
        patternKo: "이동·상태변화 동사는 조동사로 être와 결합",
        body:
          "대부분의 동사는 avoir를 쓰지만, **이동·상태변화를 나타내는 한 줌의 동사들은 être**를 써요.\n\n" +
          "aller/venir, arriver/partir, entrer/sortir, monter/descendre, naître/mourir, rester, tomber, retourner, passer — 대부분 **반의어 짝**이라 쌍으로 외우면 효율적이에요.\n\n" +
          "주의: 이 중 **sortir·monter·descendre·retourner·passer는 목적어를 가지면 avoir**로 갈아타요 — J'ai sorti la poubelle(쓰레기를 내놨어요), J'ai monté les valises(짐을 올렸어요). '이동 그 자체'면 être, '무언가를 ~하다'면 avoir예요.",
        examples: [
          { fr: "Je suis allé au cinéma.", ipa: "[ʒə sɥizale o sinema]", ko: "저는 영화관에 갔어요. (남성 화자)" },
          { fr: "Elle est partie à huit heures.", ipa: "[ɛl ɛ paʁti a ɥitœʁ]", ko: "그녀는 8시에 떠났어요." },
          { fr: "Nous sommes restés à la maison.", ipa: "[nu sɔm ʁɛste a la mɛzɔ̃]", ko: "우리는 집에 있었어요." },
        ],
        tip: "교사들이 즐겨 쓰는 암기법이 **la maison d'être** — 집 그림 하나에 '들어가고(entrer), 나가고(sortir), 올라가고(monter), 내려가고(descendre), 태어나고(naître), 죽는(mourir)' 동사들을 화살표로 그려 넣는 거예요. 영어권에서는 동사 머리글자로 DR MRS VANDERTRAMP라고도 불러요. 그림 한 장으로 정리해두면 평생 갑니다.",
        etym: "arriver는 라틴어 ad rīpam(강기슭에 닿다)에서 왔어요. 영어 arrive와 완전히 같은 뿌리 — '배가 기슭에 닿는' 이동 동사의 출신 성분이 être 조동사와도 잘 어울리죠.",
      },
      {
        heading: "결정적 차이 — 과거분사가 주어에 성수 일치",
        pattern: "être + 과거분사 → 주어에 성수 일치 (allé / allée / allés / allées)",
        patternKo: "être 조동사면 과거분사가 주어에 성수 일치",
        body:
          "être를 조동사로 쓰면 **과거분사가 형용사처럼 주어의 성·수에 일치**해요.\n\n" +
          "Elle est grande에서 grande가 여성형이 되듯, Elle est all**ée**에서 allée도 여성형이 되는 거예요.",
        table: {
          caption: "aller의 passé composé — 성수 일치",
          headers: ["주어", "형태", "발음"],
          rows: [
            ["il", "est allé", "[ilɛtale]"],
            ["elle", "est allée", "[ɛlɛtale]"],
            ["ils", "sont allés", "[il sɔ̃tale]"],
            ["elles", "sont allées", "[ɛl sɔ̃tale]"],
          ],
        },
        examples: [
          { fr: "Marie est née à Busan.", ipa: "[maʁi ɛ ne a pusan]", ko: "마리는 부산에서 태어났어요.", note: "여성 주어 → née" },
          { fr: "Mes parents sont venus.", ipa: "[me paʁɑ̃ sɔ̃ vəny]", ko: "부모님이 오셨어요.", note: "복수 → venus" },
          { fr: "Elles sont arrivées hier.", ipa: "[ɛl sɔ̃taʁive jɛʁ]", ko: "그녀들은 어제 도착했어요." },
        ],
        pitfall: "allé/allée/allés/allées — 철자는 네 가지지만 **발음은 전부 [ale]로 똑같아요**. 즉 이 일치는 거의 순수하게 글쓰기 규칙이에요. 말할 때는 티가 안 나니 방심하다가, 받아쓰기와 작문에서 무더기로 감점되는 단골 포인트예요.",
      },
      {
        heading: "대명동사도 전원 être — 그리고 정리",
        pattern: "이동·상태변화 + 모든 대명동사 → être · 나머지 전부 → avoir",
        patternKo: "대명동사도 전원 être — 헷갈리면 avoir가 기본값",
        body:
          "잠시 뒤 배울 **대명동사(se lever 등)도 전부 être**를 조동사로 써요: Je me suis levé(나는 일어났어요). 과거분사 일치는 대개 주어를 따르지만 예외가 있어요 — se가 간접목적이면 무일치(Elles se sont parlé — 서로 이야기했다), 뒤에 직접목적어가 오면 무일치(Elle s'est lavé les mains — 손을 씻었다).\n\n" +
          "조동사 선택은 이 공식 하나로 끝이에요. 헷갈리면 **avoir가 기본값**이에요.",
        examples: [
          { fr: "Je me suis levé tôt.", ipa: "[ʒə mə sɥi ləve to]", ko: "저는 일찍 일어났어요. (예고편)" },
          { fr: "J'ai quitté la maison à neuf heures.", ipa: "[ʒe kite la mɛzɔ̃ a nœvœʁ]", ko: "저는 9시에 집을 나섰어요.", note: "quitter는 목적어를 갖는 동사라 avoir" },
        ],
        vsEn: "영어는 모든 완료형이 have 하나죠(I have gone). 사실 옛 영어에는 he is come, she is gone처럼 be를 쓰는 흔적이 있었어요 — 크리스마스 캐럴의 «Joy to the world, the Lord is come»이 그 화석이에요. 프랑스어는 그 구분이 아직 현역인 언어인 셈이에요.",
        enParallel: {
          rows: [
            { en: "She **is** gone. / She **has** gone.", fr: "Elle **est** allée.", ipa: "[ɛl ɛtale]", ko: "그녀는 갔어요." },
            { en: "We **arrived** yesterday.", fr: "Nous **sommes** arrivés hier.", ipa: "[nu sɔmzaʁive jɛʁ]", ko: "우리는 어제 도착했어요." },
          ],
          note: "일부 이동 동사는 avoir 대신 être를 써요. 영어도 옛날엔 'She is come'처럼 be를 썼던 흔적(과거분사가 주어 성수에 일치).",
        },
      },
    ],
  },

  {
    slug: "a2-03-imparfait",
    level: "A2",
    order: 3,
    title: "\"자고 있었는데 전화가 왔어\"",
    topic: "반과거 imparfait",
    titleFr: "L'imparfait",
    summary: "'~하곤 했다, ~하고 있었다'의 반과거. 사건의 passé composé와 배경의 imparfait를 가르는 감각을 길러요.",
    duration: "약 10분",
    sections: [
      {
        heading: "형태 — nous에서 어간을 꺼내요",
        pattern: "nous 현재형 - ons + -ais, -ais, -ait, -ions, -iez, -aient",
        patternKo: "예외는 être(ét-) 단 하나",
        body:
          "imparfait(반과거) 만들기는 전 시제 중 가장 규칙적이에요. nous parlons → parl- → je parlais.\n\n" +
          "예외는 프랑스어 전체에서 **être(어간 ét-) 단 하나**예요: j'étais. 발음 포인트: -ais/-ait/-aient는 전부 [ɛ]로 같은 소리예요.",
        table: {
          caption: "parler의 imparfait",
          headers: ["인칭", "형태", "발음"],
          rows: [
            ["je", "parlais", "[ʒə paʁlɛ]"],
            ["tu", "parlais", "[ty paʁlɛ]"],
            ["il / elle / on", "parlait", "[il paʁlɛ]"],
            ["nous", "parlions", "[nu paʁljɔ̃]"],
            ["vous", "parliez", "[vu paʁlje]"],
            ["ils / elles", "parlaient", "[il paʁlɛ]"],
          ],
        },
        examples: [
          { fr: "J'étais fatigué.", ipa: "[ʒetɛ fatige]", ko: "저는 피곤했어요.", note: "유일한 불규칙 어간 ét-" },
          { fr: "Il faisait beau.", ipa: "[il fəzɛ bo]", ko: "날씨가 좋았어요.", note: "nous faisons → fais-" },
          { fr: "Nous avions un chien.", ipa: "[nuzavjɔ̃ œ̃ ʃjɛ̃]", ko: "우리는 개를 한 마리 키웠어요." },
        ],
        tip: "어간이 nous에서 나오기 때문에 manger의 imparfait는 je mangeais(nous mangeons의 e 유지), commencer는 je commençais가 돼요. A1에서 본 철자 화장 규칙이 그대로 따라옵니다.",
      },
      {
        heading: "용법 — 습관, 진행, 배경 묘사",
        pattern: "imparfait → ① 습관 '~하곤 했다' ② 진행 '~하고 있었다' ③ 배경 묘사",
        patternKo: "과거를 끝점 없이 펼쳐 보여주는 세 가지 용법",
        body:
          "imparfait는 과거를 **끝나는 지점 없이, 펼쳐진 상태로** 보여주는 시제예요.\n\n" +
          "**습관**(Avant, je fumais. 예전엔 피우곤 했어요), **진행**(Je dormais. 자고 있었어요), **배경 묘사**(Il pleuvait. / J'avais dix ans.) 세 가지로 잡으세요.",
        examples: [
          { fr: "Quand j'étais petit, j'habitais à Daegu.", ipa: "[kɑ̃ ʒetɛ pəti ʒabitɛ a tɛgu]", ko: "어렸을 때 저는 대구에 살았어요.", note: "습관·지속" },
          { fr: "Avant, elle travaillait dans un café.", ipa: "[avɑ̃ ɛl tʁavajɛ dɑ̃zœ̃ kafe]", ko: "예전에 그녀는 카페에서 일했어요." },
          { fr: "Il pleuvait et j'avais froid.", ipa: "[il pløvɛ e ʒavɛ fʁwa]", ko: "비가 내리고 있었고 저는 추웠어요.", note: "배경 묘사" },
        ],
      },
      {
        heading: "passé composé vs imparfait — 사진과 동영상",
        pattern: "passé composé = 사건 한 컷 (사진) · imparfait = 깔린 배경 (동영상)",
        patternKo: "사건 한 컷은 복합과거, 깔린 배경은 반과거",
        body:
          "두 과거시제는 한 문장 안에서 자주 협업해요: Je **dormais**(자고 있었는데 — 배경) quand le téléphone **a sonné**(전화가 울렸어요 — 사건).\n\n" +
          "이야기할 때 **무대 세팅은 imparfait**, **줄거리 진행은 passé composé**로 깔린다고 생각하면 돼요.",
        examples: [
          { fr: "Je dormais quand tu as téléphoné.", ipa: "[ʒə dɔʁmɛ kɑ̃ ty a telefɔne]", ko: "네가 전화했을 때 나는 자고 있었어." },
          { fr: "Il faisait beau, alors nous sommes sortis.", ipa: "[il fəzɛ bo alɔʁ nu sɔm sɔʁti]", ko: "날씨가 좋아서 우리는 밖에 나갔어요.", note: "배경(imparfait) → 행동(p.c.)" },
          { fr: "Quand j'étais petite, j'ai visité Paris une fois.", ipa: "[kɑ̃ ʒetɛ pətit ʒe vizite paʁi yn fwa]", ko: "어렸을 때 파리에 한 번 가봤어요.", note: "시절은 배경, '한 번'은 사건" },
        ],
        vsEn: "영어의 used to(~하곤 했다)와 was -ing(~하고 있었다)이 합쳐진 시제가 imparfait라고 보면 출발점으로 좋아요. I used to smoke = Je fumais, I was sleeping = Je dormais. 단, 영어 단순과거(I lived there for 10 years)도 지속·상태면 imparfait가 되는 등 완전히 겹치지는 않아요.",
        enParallel: {
          rows: [
            { en: "I **was watching** TV.", fr: "Je **regardais** la télé.", ipa: "[ʒə ʁəɡaʁdɛ la tele]", ko: "저는 TV를 보고 있었어요." },
            { en: "We **used to** live in Daegu.", fr: "Nous **habitions** à Daegu.", ipa: "[nuzabitjɔ̃ a daeɡu]", ko: "우리는 대구에 살았어요." },
            { en: "It **was** raining.", fr: "Il **pleuvait**.", ipa: "[il pløvɛ]", ko: "비가 내리고 있었어요." },
          ],
          note: "반과거 한 형태가 영어 was/were + -ing(과거진행)과 used to(습관) 둘 다를 덮어요.",
        },
        pitfall: "한국어 '-었었-'(살았었다)을 imparfait의 등가물로 외우면 위험해요. '-었었-'은 '지금은 아니다'라는 단절을 강조하는 표현이지 진행·배경의 표지가 아니거든요. 한국어 번역으로 고르지 말고, **'사건 한 컷인가, 깔린 배경인가'**라는 질문으로 고르세요. 시간이 얼마나 길었는지도 기준이 아니에요 — 10년이라도 '한 덩어리 사건'이면 passé composé예요(J'ai habité dix ans à Séoul).",
      },
    ],
  },

  {
    slug: "a2-04-pronominal-verbs",
    level: "A2",
    order: 4,
    title: "Je m'appelle의 m'의 정체",
    topic: "대명동사 se lever·s'appeler",
    titleFr: "Les verbes pronominaux",
    summary: "se lever, s'appeler처럼 se를 달고 다니는 동사들. 한국어에 없는 범주지만 '세수하다'의 감각으로 정복해요.",
    duration: "약 9분",
    sections: [
      {
        heading: "개념 — laver와 se laver의 차이",
        pattern: "laver(씻다) → se laver(자기 자신을 씻다)",
        patternKo: "행동이 자기에게 돌아오는 동사 = 대명동사",
        body:
          "**se**(자기 자신을)가 붙은 동사를 **대명동사**라고 해요. 한국어에 없는 범주지만, '아이를 씻기다'와 '(내가) 씻다'의 차이를 se라는 부품으로 명시하는 것뿐이에요.\n\n" +
          "사실 이미 하나 알고 있어요 — **Je m'appelle...**의 정체가 바로 대명동사 s'appeler(스스로를 ~라고 부르다)예요.",
        examples: [
          { fr: "Je lave la voiture.", ipa: "[ʒə lav la vwatyʁ]", ko: "저는 차를 닦아요.", note: "보통 동사 — 대상이 따로" },
          { fr: "Je me lave.", ipa: "[ʒə mə lav]", ko: "저는 씻어요.", note: "대명동사 — 행동이 나에게로" },
          { fr: "Je m'appelle Minji.", ipa: "[ʒə mapɛl mindʒi]", ko: "제 이름은 민지예요.", note: "직역: 나는 나를 민지라고 불러요" },
        ],
        vsEn: "영어는 이 범주가 없어서 wash (myself), get up, be called처럼 제각각으로 처리해요. myself 같은 재귀대명사가 살짝 비슷하지만, 프랑스어 se는 선택이 아니라 **동사에 박혀 있는 부품**이에요. se lever에서 se를 빼면 '일어나다'가 아니라 '(남을) 일으키다'가 돼요.",
      },
      {
        heading: "활용 — 재귀대명사도 인칭 따라 변신",
        pattern: "me · te · se · nous · vous · se + 동사",
        patternKo: "재귀대명사도 주어 따라 변신 — 모음 앞에선 m'/t'/s'",
        body:
          "se 부분도 주어에 맞춰 변해요. 동사 활용에 대명사 변화까지 이중 활용인 셈이지만, 표로 보면 패턴이 명확해요.\n\n" +
          "me/te/se는 모음 앞에서 m'/t'/s'로 축약돼요: Je **m'**appelle, Tu **t'**habilles.",
        table: {
          caption: "se lever(일어나다) 직설법 현재",
          headers: ["인칭", "형태", "발음"],
          rows: [
            ["je", "me lève", "[ʒə mə lɛv]"],
            ["tu", "te lèves", "[ty tə lɛv]"],
            ["il / elle / on", "se lève", "[il sə lɛv]"],
            ["nous", "nous levons", "[nu nu ləvɔ̃]"],
            ["vous", "vous levez", "[vu vu ləve]"],
            ["ils / elles", "se lèvent", "[il sə lɛv]"],
          ],
        },
        examples: [
          { fr: "Je me lève à sept heures.", ipa: "[ʒə mə lɛv a sɛtœʁ]", ko: "저는 7시에 일어나요." },
          { fr: "Tu te couches tard ?", ipa: "[ty tə kuʃ taʁ]", ko: "너 늦게 자?" },
          { fr: "Nous nous levons tôt.", ipa: "[nu nu ləvɔ̃ to]", ko: "우리는 일찍 일어나요.", note: "nous nous — 어색해 보여도 정상이에요" },
        ],
        pitfall: "부정문에서 ne...pas는 **재귀대명사+동사를 통째로** 감싸요: Je **ne** me lève **pas** tôt. 재귀대명사는 동사에서 떼어낼 수 없는 한 몸이라고 생각하세요. 'Je me ne lève pas'는 불가능해요.",
      },
      {
        heading: "아침 루틴 한 세트 + 상호 의미",
        pattern: "se réveiller → se lever → se laver → s'habiller → se coucher",
        patternKo: "하루 일과 묘사 동사 한 세트 — 복수면 '서로' 의미도",
        body:
          "대명동사가 가장 빛나는 곳은 하루 일과 묘사예요. 잠이 깨고, 일어나고, 씻고, 입고, 잠자리에 드는 흐름을 한 세트로 외우세요.\n\n" +
          "주어가 복수일 때는 '서로'라는 **상호 의미**도 가능해요. Ils s'aiment.(서로 사랑해요.) On se voit demain ?(내일 볼까?)",
        examples: [
          { fr: "Elle se réveille à six heures.", ipa: "[ɛl sə ʁevɛj a sizœʁ]", ko: "그녀는 6시에 잠이 깨요." },
          { fr: "Je m'habille vite.", ipa: "[ʒə mabij vit]", ko: "저는 옷을 빨리 입어요." },
          { fr: "Ils s'aiment beaucoup.", ipa: "[il sɛm boku]", ko: "그들은 서로 많이 사랑해요.", note: "상호 의미" },
          { fr: "On se voit demain !", ipa: "[ɔ̃ sə vwa dəmɛ̃]", ko: "내일 보자!", note: "약속 잡기의 단골 표현" },
        ],
        tip: "passé composé에서는 대명동사 전원이 **être 부대**라고 했죠(2챕터). Je me suis levé(e), Elle s'est couchée처럼요. 아침 루틴을 과거로 말하는 연습이 두 챕터를 한 번에 복습하는 지름길이에요.",
      },
    ],
  },

  {
    slug: "a2-05-object-pronouns",
    level: "A2",
    order: 5,
    title: "Je t'aime의 어순이 말해주는 것",
    topic: "목적 대명사 le/la/les·lui/leur",
    titleFr: "Les pronoms COD et COI",
    summary: "le/la/les와 lui/leur. 영어와 정반대로 동사 앞에 놓이는 어순이 핵심이에요.",
    duration: "약 10분",
    sections: [
      {
        heading: "직접목적 대명사 le, la, les — 어순 충격에 대비하세요",
        pattern: "주어 + le/la/les + 동사 (Je la vois)",
        patternKo: "목적 대명사는 동사 앞",
        body:
          "'그거/그를/그녀를'을 담당하는 직접목적 대명사 **le**(남성), **la**(여성), **les**(복수)는 정관사와 모양이 같고, 모음 앞에서 l'로 축약돼요.\n\n" +
          "충격 포인트는 위치 — **동사 앞**이에요. Tu vois Marie ? — Oui, je **la** vois. '나는-그녀를-본다' 순서인 거죠.",
        examples: [
          { fr: "Tu lis ce livre ? — Oui, je le lis.", ipa: "[ʒə lə li]", ko: "이 책 읽어? — 응, 그거 읽어." },
          { fr: "Tu aimes la France ? — Je l'aime !", ipa: "[ʒə lɛm]", ko: "프랑스 좋아해? — 좋아하지!", note: "모음 앞 l'" },
          { fr: "Je t'aime.", ipa: "[ʒə tɛm]", ko: "사랑해.", note: "me/te도 같은 자리 — 그 유명한 문장의 어순이 이거예요" },
          { fr: "Les devoirs ? Je les fais ce soir.", ipa: "[ʒə le fɛ sə swaʁ]", ko: "숙제? 오늘 저녁에 할 거야." },
        ],
        vsEn: "영어는 I see her — 목적어가 동사 **뒤**죠. 프랑스어는 Je la vois — 동사 **앞**이에요. 정반대 어순이라 영어 회로로 말하면 'Je vois la'라는 비문이 튀어나와요. 오히려 한국어 '나는 그녀를 본다'와 어순이 같으니, 이 문법만큼은 한국어 어순 감각을 믿으세요.",
      },
      {
        heading: "간접목적 대명사 lui, leur — '~에게'",
        pattern: "à + 사람 → lui (그/그녀에게) · leur (그들에게)",
        patternKo: "'~에게'를 받는 간접목적 대명사 — lui는 남녀 공용",
        body:
          "**parler à**, **téléphoner à**, **donner à**처럼 'à + 사람'을 받는 게 간접목적 대명사예요. 한국어 조사 **'~에게'**가 붙는 자리라고 생각하면 감이 빨라요.\n\n" +
          "me, te, nous, vous는 직접·간접 모양이 같아서, 새로 외울 건 lui와 leur 둘뿐이에요.",
        examples: [
          { fr: "Je téléphone à ma mère. → Je lui téléphone.", ipa: "[ʒə lɥi telefɔn]", ko: "어머니께 전화해요. → 그분께 전화해요." },
          { fr: "Tu parles à tes parents ? — Oui, je leur parle.", ipa: "[ʒə lœʁ paʁl]", ko: "부모님과 얘기해? — 응, (그분들께) 얘기해." },
          { fr: "Je lui donne un cadeau.", ipa: "[ʒə lɥi dɔn œ̃ kado]", ko: "그/그녀에게 선물을 줘요." },
        ],
        pitfall: "**lui는 남녀 공용**이에요 — '그에게'도 '그녀에게'도 lui. 소유 형용사 son/sa에서 봤듯, 프랑스어는 3인칭에서 영어식 he/she 구별에 무심해요. '그녀에게니까 la...'라고 하면 직접목적 대명사와 뒤섞이는 오답이 돼요. 동사가 à를 데리고 다니면(parler à, téléphoner à) lui/leur — 동사와 전치사를 세트로 외우는 게 답이에요.",
      },
      {
        heading: "어순 종합 — 부정문, 두 동사 문장, passé composé",
        pattern: "Je ne le vois pas · Je vais le faire · Je l'ai vu",
        patternKo: "부정문은 통째로 감싸기 · 원형 앞 · 조동사 앞",
        body:
          "**부정문**은 ne...pas가 대명사+동사를 통째로 감싸고, **동사 두 개** 문장은 원형 바로 앞, **passé composé**는 조동사 앞이에요.\n\n" +
          "공통 원리는 하나 — 대명사는 **자기 의미가 걸리는 동사에 최대한 바짝 붙는다**예요.",
        examples: [
          { fr: "Je ne le connais pas.", ipa: "[ʒə nə lə kɔnɛ pa]", ko: "저는 그를 몰라요." },
          { fr: "Tu vas le faire ? — Oui, je vais le faire.", ipa: "[ʒə vɛ lə fɛʁ]", ko: "그거 할 거야? — 응, 할 거야.", note: "원형 앞" },
          { fr: "Ce film, je l'ai vu hier.", ipa: "[ʒə le vy jɛʁ]", ko: "그 영화, 어제 봤어요.", note: "조동사 avoir 앞" },
        ],
        tip: "회화 순발력 연습법: 질문에 명사를 그대로 반복하지 말고 대명사로 받아치는 습관을 들이세요. Tu as les billets ? → (Oui, j'ai les billets ✗) → **Oui, je les ai** ✓. 프랑스인의 대화는 이 핑퐁으로 굴러갑니다.",
      },
    ],
  },

  {
    slug: "a2-06-comparative",
    level: "A2",
    order: 6,
    title: "\"지하철이 택시보다 싸요\" 말하기",
    topic: "비교급·최상급 plus/moins",
    titleFr: "Le comparatif et le superlatif",
    summary: "'더/덜/만큼'의 3종 비교와 le plus 최상급. 영어 better가 둘로 갈라지는 meilleur/mieux까지 정리해요.",
    duration: "약 8분",
    sections: [
      {
        heading: "비교급 3종 세트 — plus / moins / aussi ... que",
        pattern: "plus(더) / moins(덜) / aussi(만큼) + 형용사 + que + 비교 상대",
        patternKo: "'더/덜/만큼' 비교 — '~보다'는 que 자리에",
        body:
          "형용사·부사 앞에 부품 하나만 끼우면 끝이에요. Il est **plus grand que** moi. — 한국어 조사 '~보다'가 que 자리에 온다고 생각하면 돼요.\n\n" +
          "moins(덜)는 한국어로 어색해서 잘 안 쓰게 되는데, 프랑스어에서는 아주 자연스러워요(moins cher = 덜 비싼 = 더 싼).",
        examples: [
          { fr: "Il est plus grand que moi.", ipa: "[il ɛ ply gʁɑ̃ kə mwa]", ko: "그는 저보다 키가 커요." },
          { fr: "Le métro est moins cher que le taxi.", ipa: "[lə metʁo ɛ mwɛ̃ ʃɛʁ kə lə taksi]", ko: "지하철이 택시보다 (덜 비싸요 =) 싸요." },
          { fr: "Elle est aussi grande que sa mère.", ipa: "[ɛl ɛ osi gʁɑ̃d kə sa mɛʁ]", ko: "그녀는 자기 어머니만큼 키가 커요." },
        ],
        vsEn: "영어는 짧은 형용사엔 -er(taller), 긴 형용사엔 more(more expensive)로 갈라지죠. 프랑스어는 길든 짧든 **무조건 plus** 하나예요. 갈림길이 없으니 영어보다 단순해요 — taller than = plus grand que, more interesting than = plus intéressant que.",
        enParallel: {
          rows: [
            { en: "He is taller **than** me.", fr: "Il est plus grand **que** moi.", ipa: "[il ɛ ply ɡʁɑ̃ kə mwa]", ko: "그는 저보다 키가 커요." },
            { en: "It's **more** expensive **than** that.", fr: "C'est **plus** cher **que** ça.", ipa: "[sɛ ply ʃɛʁ kə sa]", ko: "그건 저것보다 더 비싸요." },
            { en: "It's **the most** beautiful museum.", fr: "C'est **le plus** beau musée.", ipa: "[sɛ lə ply bo myze]", ko: "가장 아름다운 미술관이에요." },
          ],
          note: "plus … que = more … than(또는 -er than). the most = le plus. 비교의 뼈대가 영어와 평행.",
        },
      },
      {
        heading: "최상급 — 비교급에 le/la/les만 얹기",
        pattern: "le/la/les + plus/moins + 형용사 (+ de ~중에서)",
        patternKo: "최상급은 비교급 앞에 정관사만 얹기",
        body:
          "최상급은 비교급 앞에 **정관사**를 붙이면 돼요: le plus ...(가장 ~한), le moins ...(가장 덜 ~한).\n\n" +
          "'~중에서'는 **de**로 표현해요: la plus grande ville **de** Corée. 영어 in Korea의 in에 끌려 dans을 쓰지 않도록 주의하세요.",
        examples: [
          { fr: "C'est le plus beau musée de Paris.", ipa: "[sɛ lə ply bo myze də paʁi]", ko: "이곳은 파리에서 가장 아름다운 미술관이에요." },
          { fr: "Séoul est la plus grande ville de Corée.", ipa: "[seul ɛ la ply gʁɑ̃d vil də kɔʁe]", ko: "서울은 한국에서 가장 큰 도시예요." },
          { fr: "C'est le restaurant le moins cher du quartier.", ipa: "[sɛ lə ʁɛstoʁɑ̃ lə mwɛ̃ ʃɛʁ dy kaʁtje]", ko: "여긴 동네에서 제일 싼 식당이에요.", note: "후치 형용사는 관사가 한 번 더" },
        ],
        tip: "plus의 발음은 카멜레온이에요. 비교급에서 자음 앞이면 [ply](plus grand), 모음 앞이면 리에종 [plyz](plus intéressant), 문장 끝이나 '더하기' 의미면 [plys]. 일단 '비교급은 [ply]'만 기본값으로 잡아두세요.",
      },
      {
        heading: "meilleur vs mieux — better가 둘로 갈라져요",
        pattern: "bon(좋은) → meilleur · bien(잘) → mieux",
        patternKo: "'더 좋은'은 meilleur, '더 잘'은 mieux — 전용 비교급",
        body:
          "bon과 bien은 plus를 못 쓰고 **전용 비교급**이 따로 있어요. Ce café est meilleur. / Tu parles mieux.\n\n" +
          "구별법은 원급으로 되돌려보기 — '좋은(bon)'이 어울리면 meilleur, '잘(bien)'이 어울리면 mieux. 최상급도 그대로 le meilleur, le mieux예요.",
        table: {
          caption: "불규칙 비교급",
          headers: ["원급", "비교급", "최상급"],
          rows: [
            ["bon(ne) 좋은", "meilleur(e) [mɛjœʁ]", "le/la meilleur(e)"],
            ["bien 잘", "mieux [mjø]", "le mieux"],
          ],
        },
        examples: [
          { fr: "Ce restaurant est meilleur que l'autre.", ipa: "[sə ʁɛstoʁɑ̃ ɛ mɛjœʁ kə lotʁ]", ko: "이 식당이 저기보다 더 맛있어요.", note: "bon의 비교급" },
          { fr: "Ça va mieux ?", ipa: "[sa va mjø]", ko: "(몸/기분) 좀 나아졌어?", note: "bien의 비교급 — 병문안 필수 표현" },
          { fr: "C'est la meilleure boulangerie du quartier.", ipa: "[sɛ la mɛjœʁ bulɑ̃ʒʁi dy kaʁtje]", ko: "여기가 동네 최고의 빵집이에요." },
        ],
        pitfall: "'plus bon'은 영어 'more good'처럼 비문이에요. 그런데 영어 better는 형용사·부사를 다 커버하는 반면 프랑스어는 **meilleur(형용사)/mieux(부사)로 쪼개져요**. 한국어 '더 좋다/더 잘한다'로 구별해보면 정확해요 — '더 좋은 커피' = meilleur, '더 잘 말한다' = mieux.",
      },
    ],
  },

  {
    slug: "a2-07-futur-simple",
    level: "A2",
    order: 7,
    title: "\"언젠가 떠날 거야\"를 한 단어로",
    topic: "단순미래 futur simple",
    titleFr: "Le futur simple",
    summary: "원형 어간에 avoir형 어미를 붙이는 단순 미래. futur proche와의 뉘앙스 분담과 4대 불규칙 어간까지.",
    duration: "약 9분",
    sections: [
      {
        heading: "형태 — 원형 + ai, as, a, ons, ez, ont",
        pattern: "동사 원형 + -ai, -as, -a, -ons, -ez, -ont",
        patternKo: "미래 어미 = avoir 현재형",
        body:
          "이 어미들은 **avoir의 현재형**이에요. 역사적으로 'manger + ai(먹는 것을 가지고 있다) → 먹을 것이다'로 굳은 형태라, 새로 외울 어미가 사실상 없어요.\n\n" +
          "-re로 끝나는 동사는 **끝의 e를 떼고** 붙여요: prendre → je prendr**ai**.",
        table: {
          caption: "parler의 futur simple",
          headers: ["인칭", "형태", "발음"],
          rows: [
            ["je", "parlerai", "[ʒə paʁləʁe]"],
            ["tu", "parleras", "[ty paʁləʁa]"],
            ["il / elle / on", "parlera", "[il paʁləʁa]"],
            ["nous", "parlerons", "[nu paʁləʁɔ̃]"],
            ["vous", "parlerez", "[vu paʁləʁe]"],
            ["ils / elles", "parleront", "[il paʁləʁɔ̃]"],
          ],
        },
        examples: [
          { fr: "Je parlerai bien français un jour.", ipa: "[ʒə paʁləʁe bjɛ̃ fʁɑ̃sɛ œ̃ ʒuʁ]", ko: "언젠가 프랑스어를 잘하게 될 거예요." },
          { fr: "On prendra le train.", ipa: "[ɔ̃ pʁɑ̃dʁa lə tʁɛ̃]", ko: "우리는 기차를 탈 거예요.", note: "prendre → prendr-" },
        ],
        tip: "'미래 어미 = avoir 현재형'만 기억하면 표 전체가 공짜예요. 단 nous/vous는 avons/avez에서 av-를 뗀 -ons/-ez만 붙는다는 것까지 챙기면 완벽해요.",
      },
      {
        heading: "4대 불규칙 어간 — serai, aurai, irai, ferai",
        pattern: "être → ser- · avoir → aur- · aller → ir- · faire → fer-",
        patternKo: "어미는 불변, 어간이 제멋대로인 핵심 동사들",
        body:
          "어미는 절대 불변이지만, 최중요 동사들은 **어간이 제멋대로**예요. 그 외 자주 나오는 것: venir → viendr-, pouvoir → pourr-, voir → verr-.\n\n" +
          "불규칙이라도 **어간이 r로 끝나는 것**은 모두 같아요 — 미래형에서는 항상 [ʁ] 소리가 들린다는 게 청취 단서예요.",
        table: {
          caption: "불규칙 어간 핵심 7",
          headers: ["원형", "미래 어간", "je 형태"],
          rows: [
            ["être", "ser-", "je serai [ʒə səʁe]"],
            ["avoir", "aur-", "j'aurai [ʒoʁe]"],
            ["aller", "ir-", "j'irai [ʒiʁe]"],
            ["faire", "fer-", "je ferai [ʒə fəʁe]"],
            ["venir", "viendr-", "je viendrai [ʒə vjɛ̃dʁe]"],
            ["pouvoir", "pourr-", "je pourrai [ʒə puʁe]"],
            ["voir", "verr-", "je verrai [ʒə vɛʁe]"],
          ],
        },
        examples: [
          { fr: "Je serai là demain.", ipa: "[ʒə səʁe la dəmɛ̃]", ko: "내일 거기 있을게요." },
          { fr: "Tu auras le temps ?", ipa: "[ty oʁa lə tɑ̃]", ko: "너 시간 있을 거야?" },
          { fr: "Nous irons en France l'année prochaine.", ipa: "[nuziʁɔ̃ ɑ̃ fʁɑ̃s lane pʁɔʃɛn]", ko: "우리는 내년에 프랑스에 갈 거예요." },
        ],
        pitfall: "j'aurai [ʒoʁe]는 글자보다 소리가 짧아요 — au가 그냥 [o]라서 '조헤'처럼 들려요. j'irai [ʒiʁe]와 헷갈리기 쉬우니 '가질 거다(aurai) = 오, 갈 거다(irai) = 이'로 모음을 구별해두세요.",
      },
      {
        heading: "futur proche vs futur simple — 체감 거리의 차이",
        pattern: "futur proche = 확정·근접 (Je vais partir) · futur simple = 계획·예측·격식 (Je partirai)",
        patternKo: "확정·근접 미래와 계획·예측 미래의 분담",
        body:
          "경계가 칼같지는 않아서 일상 회화는 **futur proche가 다수파**예요.\n\n" +
          "futur simple은 일기예보(Il fera beau), 약속(Je t'appellerai), 다짐 같은 데서 빛나요.",
        examples: [
          { fr: "Je vais partir. (지금/확정)", ipa: "[ʒə vɛ paʁtiʁ]", ko: "나 (곧) 갈 거야." },
          { fr: "Un jour, je partirai. (먼 미래)", ipa: "[œ̃ ʒuʁ ʒə paʁtiʁe]", ko: "언젠가 나는 떠날 거야." },
          { fr: "Demain, il fera beau.", ipa: "[dəmɛ̃ il fəʁa bo]", ko: "내일은 날씨가 좋겠습니다.", note: "일기예보의 시제" },
          { fr: "Je t'appellerai ce soir.", ipa: "[ʒə tapɛlʁe sə swaʁ]", ko: "오늘 저녁에 전화할게.", note: "약속" },
        ],
        vsEn: "영어의 be going to(확정·근접) vs will(예측·약속·다짐) 분담과 상당히 비슷해요. I'm going to leave ≈ Je vais partir, I'll call you ≈ Je t'appellerai. 완벽히 겹치진 않지만 첫 감각으로는 충분히 믿을 만한 지도예요.",
        enParallel: {
          rows: [
            { en: "I **will** call you.", fr: "Je t'**appellerai**.", ipa: "[ʒə tapɛlʁe]", ko: "전화할게요." },
            { en: "We **will** go to France.", fr: "Nous **irons** en France.", ipa: "[nuziʁɔ̃ ɑ̃ fʁɑ̃s]", ko: "우리는 프랑스에 갈 거예요." },
            { en: "It **will** be fine tomorrow.", fr: "Il **fera** beau demain.", ipa: "[il fəʁa bo dəmɛ̃]", ko: "내일은 날씨가 좋겠어요." },
          ],
          note: "영어는 will이라는 단어를, 프랑스어는 동사 끝에 미래 어미(-ai/-as/-a…)를 붙여 미래를 만들어요. '의지/예측의 미래'라는 의미는 같아요.",
        },
      },
    ],
  },

  {
    slug: "a2-08-imperatif",
    level: "A2",
    order: 8,
    title: "\"일어나, 8시야!\" — 명령과 권유",
    topic: "명령법 impératif",
    titleFr: "L'impératif",
    summary: "명령·권유의 형태는 셋뿐. tu형의 -s 탈락, 대명사의 자리 이동, 그리고 부드럽게 만드는 마법의 말까지.",
    duration: "약 8분",
    sections: [
      {
        heading: "형태 — 현재형에서 주어만 빼기 (그리고 -s 탈락)",
        pattern: "tu/nous/vous 현재형 - 주어 (-er 동사 tu형은 -s 탈락: Parle !)",
        patternKo: "명령은 현재형에서 주어 빼기 — tu형은 -s 탈락",
        body:
          "**tu / nous / vous의 현재형에서 주어를 지우면** 끝이에요. nous형은 '~하자'(권유), vous형은 정중한 명령이 돼요.\n\n" +
          "단 하나의 함정: **-er 동사(그리고 aller)의 tu형에서는 끝의 -s를 떼요**. Tu parles → **Parle !** 발음은 어차피 묵음이라 똑같고, 순수하게 철자 규칙이에요.",
        table: {
          caption: "명령법 3형태",
          headers: ["대상", "parler", "faire", "aller"],
          rows: [
            ["tu (반말)", "Parle ! [paʁl]", "Fais ! [fɛ]", "Va ! [va]"],
            ["nous (~하자)", "Parlons ! [paʁlɔ̃]", "Faisons ! [fəzɔ̃]", "Allons ! [alɔ̃]"],
            ["vous (정중)", "Parlez ! [paʁle]", "Faites ! [fɛt]", "Allez ! [ale]"],
          ],
        },
        examples: [
          { fr: "Écoute bien !", ipa: "[ekut bjɛ̃]", ko: "잘 들어!", note: "tu écoutes에서 -s 탈락" },
          { fr: "Regardez !", ipa: "[ʁəgaʁde]", ko: "보세요!" },
          { fr: "Allons au café !", ipa: "[alɔ̃ o kafe]", ko: "카페에 가자!" },
          { fr: "Ne parle pas si vite !", ipa: "[nə paʁl pa si vit]", ko: "그렇게 빨리 말하지 마!", note: "부정 명령은 ne...pas 샌드위치 그대로" },
        ],
        vsEn: "영어 명령문도 주어 you를 지우죠(Speak!). 발상이 똑같아서 개념은 공짜예요. 차이는 프랑스어가 반말(Parle)/권유(Parlons)/존대(Parlez) **세 단계**를 형태로 구별한다는 것 — 한국어 '말해/말하자/말하세요'와 정확히 평행해요.",
        enParallel: {
          rows: [
            { en: "**Listen** carefully!", fr: "**Écoute** bien !", ipa: "[ekut bjɛ̃]", ko: "잘 들어!" },
            { en: "**Wait** for me, please.", fr: "**Attendez**-moi, s'il vous plaît.", ipa: "[atɑ̃de mwa sil vu plɛ]", ko: "저 좀 기다려주세요." },
            { en: "**Let's go** to the café!", fr: "**Allons** au café !", ipa: "[alɔ̃ o kafe]", ko: "카페에 가자!" },
          ],
          note: "주어 없이 동사로 시작하는 명령문 구조가 영어와 같아요. Let's … = nous 명령형(Allons…).",
        },
      },
      {
        heading: "대명사의 자리 이동 — Lève-toi !",
        pattern: "긍정 명령: 동사-대명사 (Lève-toi !) · 부정 명령: 원위치 (Ne te lève pas !)",
        patternKo: "긍정 명령이면 대명사가 동사 뒤로 (te는 toi로)",
        body:
          "평소 동사 앞이던 대명사가 **긍정 명령문에서는 동사 뒤로 이동**하고 하이픈으로 연결돼요. 이때 me/te는 힘이 실린 형태 **moi/toi**로 변신해요: Téléphonez-**moi** !\n\n" +
          "**부정 명령에서는 원위치** — 긍정이면 뒤, 부정이면 앞. 이 시소만 기억하세요.",
        examples: [
          { fr: "Lève-toi, il est huit heures !", ipa: "[lɛv twa il ɛ ɥitœʁ]", ko: "일어나, 8시야!" },
          { fr: "Téléphonez-moi demain.", ipa: "[telefɔne mwa dəmɛ̃]", ko: "내일 전화 주세요." },
          { fr: "Prends-le.", ipa: "[pʁɑ̃ lə]", ko: "그거 가져가." },
          { fr: "Ne te couche pas tard !", ipa: "[nə tə kuʃ pa taʁ]", ko: "늦게 자지 마!", note: "부정이면 대명사 원위치" },
        ],
        pitfall: "'일어나!'를 배운 어순 감각으로 'Te lève !'라고 하면 틀려요. **긍정 명령 = 동사가 맨 앞, 대명사는 뒤에 하이픈으로** — 그리고 te가 아니라 toi. Lève-toi, Assieds-toi(앉아), Dépêche-toi(서둘러)를 통문장으로 외워두면 헷갈릴 틈이 없어요.",
      },
      {
        heading: "불규칙 둘 + 부드럽게 말하는 기술",
        pattern: "être → Sois / Soyez · avoir → Aie / Ayez",
        patternKo: "être와 avoir의 불규칙 명령형 두 쌍",
        body:
          "명령법 불규칙은 사실상 둘만 챙기면 돼요: Sois sage !(얌전히 있어!), N'ayez pas peur !(무서워하지 마세요!)\n\n" +
          "명령형은 그 자체로 꽤 직설적이라, 실전에서는 **s'il vous plaît**를 곁들이거나 의문문으로 돌려 말해요(Tu peux fermer la porte ?). '문 닫아!'보다 '문 좀 닫아줄래요?'가 부드러운 것과 같은 감각이에요.",
        examples: [
          { fr: "N'ayez pas peur !", ipa: "[nɛje pa pœʁ]", ko: "무서워하지 마세요!" },
          { fr: "Attendez-moi, s'il vous plaît !", ipa: "[atɑ̃de mwa sil vu plɛ]", ko: "저 좀 기다려주세요!" },
          { fr: "Vas-y !", ipa: "[vazi]", ko: "가! / 해봐! / 파이팅!", note: "aller 명령 + y — 다음 챕터 예고편. 이때는 -s가 부활해요" },
        ],
        tip: "Allez !는 '가세요'를 넘어 '자!, 힘내!, 어서!'라는 만능 추임새예요. 축구장에서 들리는 «Allez les Bleus !»(프랑스 대표팀 파이팅!)가 바로 이 명령형이에요.",
      },
    ],
  },

  {
    slug: "a2-09-y-en",
    level: "A2",
    order: 9,
    title: "On y va!의 y는 무슨 뜻일까?",
    topic: "대명사 y·en",
    titleFr: "Les pronoms y et en",
    summary: "장소를 받는 y, de+명사를 받는 en. 등가물이 없어 어렵지만, J'y vais와 Il y en a로 매일 쓰는 필수품이에요.",
    duration: "약 9분",
    sections: [
      {
        heading: "y — '거기에'를 받는 한 글자",
        pattern: "à/dans/chez + 장소 → y + 동사 (J'y vais)",
        patternKo: "'거기에'를 통째로 받는 대명사 y — 동사 앞에",
        body:
          "**y**는 '전치사 + 장소'를 통째로 받는 대명사예요. Tu vas à Paris ? — Oui, j'**y** vais. 위치는 목적 대명사처럼 **동사 앞**.\n\n" +
          "장소뿐 아니라 'à + 사물'도 받아요: Tu penses à ton examen ? — Oui, j'y pense.",
        examples: [
          { fr: "Tu vas au bureau ? — Oui, j'y vais.", ipa: "[ʒi vɛ]", ko: "사무실 가? — 응, 가." },
          { fr: "Elle habite à Lyon ? — Oui, elle y habite depuis deux ans.", ipa: "[ɛl i abit dəpɥi døzɑ̃]", ko: "그녀는 리옹에 살아요? — 네, 2년째 거기 살아요." },
          { fr: "On y va ?", ipa: "[ɔ̃ni va]", ko: "갈까? / 가자!", note: "출발 신호의 국민 표현" },
        ],
        pitfall: "한국어는 '응, 가'처럼 장소를 그냥 생략하지만, 프랑스어 aller는 **목적지 없이 못 서는 동사**예요. 'Oui, je vais.'는 비문 — 반드시 J'y vais. 사실 il **y** a(~이 있다)의 y도 같은 y였어요. '거기에 가진다 → 있다'였던 거죠.",
      },
      {
        heading: "en — 'de + 명사'와 수량을 받는 한 글자",
        pattern: "de + 명사 → en (J'en bois · J'en ai deux)",
        patternKo: "de + 명사와 수량을 받는 대명사 en",
        body:
          "**en**은 de가 이끄는 것들 — 특히 부분관사(du/de la/des)가 붙은 음식·음료를 받아요. Tu bois du café ? — Oui, j'**en** bois.\n\n" +
          "수량 표현에서 진가가 나와요: J'**en** ai deux.(두 명 있어.) 숫자만 말하면 안 되고 **en이 꼭 필요해요**.",
        examples: [
          { fr: "Tu manges du pain ? — Oui, j'en mange.", ipa: "[ʒɑ̃ mɑ̃ʒ]", ko: "빵 먹어? — 응, 먹어." },
          { fr: "Vous avez des enfants ? — Oui, j'en ai deux.", ipa: "[ʒɑ̃ne dø]", ko: "자녀가 있으세요? — 네, 둘 있어요." },
          { fr: "Des questions ? — Non, je n'en ai pas.", ipa: "[ʒə nɑ̃nɛ pa]", ko: "질문 있어요? — 아니요, 없어요." },
          { fr: "Tu viens de Corée ? — Oui, j'en viens.", ipa: "[ʒɑ̃ vjɛ̃]", ko: "한국에서 와? — 응, 거기서 와.", note: "venir de + 장소도 en" },
        ],
        vsEn: "y와 en은 영어에 등가물이 없어요. 굳이 옮기면 y ≈ there, en ≈ of it/some이지만, 영어에서는 'I have two'처럼 그냥 생략하는 자리에 프랑스어는 반드시 대명사를 세워요. **'영어라면 비워둘 자리를 프랑스어는 y/en으로 채운다'** — 이 한 줄이 두 대명사의 존재 이유예요.",
      },
      {
        heading: "il y en a — 그리고 통문장 무기고",
        pattern: "il y a + en → il y en a [iljɑ̃na]",
        patternKo: "il y a와 en의 합체 '그게 있어요' — 소리째 암기",
        body:
          "il y a와 en이 합체하면 **il y en a**(그게 (몇 개) 있다)예요. Il y a des croissants ? — Oui, il y **en** a trois. 분해하지 말고 소리째 삼키세요.\n\n" +
          "y와 en은 분석보다 **굳은 표현으로 먼저 입에 붙이는 게** 왕도예요. On y va !(가자!), Vas-y !(해봐!), J'en ai assez.(지긋지긋해!)",
        examples: [
          { fr: "Il y a du fromage ? — Oui, il y en a.", ipa: "[wi iljɑ̃na]", ko: "치즈 있어? — 응, 있어." },
          { fr: "Il n'y en a plus.", ipa: "[ilnjɑ̃na ply]", ko: "그거 이제 없어요. (다 떨어졌어요)", note: "가게에서 자주 듣는 문장" },
          { fr: "J'en ai assez !", ipa: "[ʒɑ̃ne ase]", ko: "지긋지긋해! / 그만하면 됐어!" },
        ],
        tip: "y와 en의 어순이 헷갈리면 일단 이 세 문장만 자동발사되게 만드세요 — **On y va ?**(갈까?) / **J'en ai deux.**(두 개 있어.) / **Il y en a.**(있어.) 문법 설명 열 줄보다 입에 붙은 세 문장이 실전에서 강해요.",
      },
    ],
  },

  {
    slug: "a2-10-relative-qui-que",
    level: "A2",
    order: 10,
    title: "\"파리에 사는 친구\"를 한 문장에",
    topic: "관계대명사 qui/que",
    titleFr: "Les pronoms relatifs qui et que",
    summary: "두 문장을 한 문장으로 묶는 qui와 que. 사람/사물이 아니라 주어/목적어 역할로 갈린다는 게 핵심이에요.",
    duration: "약 9분",
    sections: [
      {
        heading: "관계대명사란 — 명사 뒤에 설명 달기",
        pattern: "명사 + qui/que + 설명 문장",
        patternKo: "명사 뒤에 문장을 통째로 달아 설명하는 장치",
        body:
          "명사에 문장 하나를 통째로 달아 설명하는 장치예요. J'ai un ami. + Il étudie le français. → J'ai un ami **qui** étudie le français.\n\n" +
          "한국어는 꾸미는 문장이 명사 **앞**('공부하는 → 친구')이지만, 프랑스어는 명사 **뒤**예요 — 결론부터 말하고 설명은 나중에.",
        examples: [
          { fr: "J'ai un ami qui habite à Paris.", ipa: "[ʒe œ̃nami ki abit a paʁi]", ko: "파리에 사는 친구가 있어요." },
          { fr: "C'est le livre que je lis.", ipa: "[sɛ lə livʁ kə ʒə li]", ko: "이게 제가 읽고 있는 책이에요." },
        ],
      },
      {
        heading: "qui — 뒤 문장의 '주어' 자리를 채워요",
        pattern: "qui + 동사 (주어 역할 · 축약 불가)",
        patternKo: "관계절의 주어 자리를 채우는 qui — 바로 뒤에 동사",
        body:
          "**qui**는 관계절 안에서 **주어 역할**이라 **바로 뒤에 동사**가 와요. un ami **qui étudie**, le train **qui arrive** — 사람이든 사물이든 상관없어요.\n\n" +
          "qui는 모음 앞에서도 **절대 축약되지 않아요**: l'ami qui arrive (qu'arrive ✗).",
        examples: [
          { fr: "J'aime les gens qui chantent.", ipa: "[ʒɛm le ʒɑ̃ ki ʃɑ̃t]", ko: "저는 노래하는 사람들을 좋아해요.", note: "사람 + qui" },
          { fr: "Le train qui arrive vient de Lyon.", ipa: "[lə tʁɛ̃ ki aʁiv vjɛ̃ də ljɔ̃]", ko: "지금 들어오는 기차는 리옹에서 와요.", note: "사물 + qui — 사물이어도 qui!" },
          { fr: "C'est moi qui paie.", ipa: "[sɛ mwa ki pɛ]", ko: "내가 살게. (계산은 내가)", note: "C'est ... qui 강조 구문" },
        ],
      },
      {
        heading: "que — 뒤 문장의 '목적어' 자리를 채워요",
        pattern: "que + 주어 + 동사 (목적어 역할 · 모음 앞 qu')",
        patternKo: "관계절의 목적어 자리를 채우는 que — 뒤에 주어+동사",
        body:
          "**que**는 관계절 안에서 **목적어 역할**이라 **뒤에 주어+동사**가 따라와요. le livre **que je lis**(내가 읽는 책), la femme **que tu connais**.\n\n" +
          "qui와 달리 que는 모음 앞에서 **qu'로 축약돼요**: le film **qu'**il aime. 축약되는 쪽이 que라는 것도 둘을 가르는 단서예요.",
        examples: [
          { fr: "C'est le film que je préfère.", ipa: "[sɛ lə film kə ʒə pʁefɛʁ]", ko: "이게 제가 제일 좋아하는 영화예요." },
          { fr: "La femme que tu connais est ma sœur.", ipa: "[la fam kə ty kɔnɛ ɛ ma sœʁ]", ko: "네가 아는 그 여자분이 내 언니야.", note: "사람 + que" },
          { fr: "Le gâteau qu'elle fait est délicieux.", ipa: "[lə gato kɛl fɛ ɛ delisjø]", ko: "그녀가 만드는 케이크는 맛있어요.", note: "que + elle → qu'elle" },
        ],
        pitfall: "영어 'the book I read'처럼 관계대명사를 생략하는 건 프랑스어에서 **불가능**해요. le livre je lis ✗ — que는 어떤 경우에도 지울 수 없어요. 영어 습관 중에서도 특히 끈질기게 남는 오류이니 의식적으로 점검하세요.",
      },
      {
        heading: "구별법 총정리 — 사람/사물이 아니라 역할",
        pattern: "뒤에 동사 → qui · 뒤에 주어+동사 → que",
        patternKo: "사람/사물이 아니라 빠진 자리의 역할로 구별",
        body:
          "최대 함정: qui/que는 영어 who/which처럼 **선행사가 사람이냐 사물이냐로 갈리지 않아요**. 기준은 **관계절 안에서 빠진 자리가 주어냐 목적어냐**예요.\n\n" +
          "실전 판별법은 관계대명사 **바로 뒤**를 보는 것 — 이 한 줄이면 90%가 해결돼요.",
        table: {
          caption: "qui vs que 판별표",
          headers: ["", "역할", "바로 뒤에 오는 것", "예시"],
          rows: [
            ["qui", "주어", "동사", "l'ami qui parle (말하는 친구)"],
            ["que", "목적어", "주어 + 동사", "l'ami que je connais (내가 아는 친구)"],
          ],
        },
        examples: [
          { fr: "Le café qui est sur la table est froid.", ipa: "[lə kafe ki ɛ syʁ la tabl ɛ fʁwa]", ko: "탁자 위에 있는 커피는 식었어요.", note: "qui + 동사" },
          { fr: "Le café que je bois est froid.", ipa: "[lə kafe kə ʒə bwa ɛ fʁwa]", ko: "내가 마시는 커피는 식었어요.", note: "que + 주어 + 동사" },
        ],
        vsEn: "영어는 who(사람)/which(사물)로 **선행사의 종류**에 따라 갈리죠. 프랑스어 qui/que는 **관계절 안의 문법 역할**로 갈려요. 그래서 사물에도 qui(le train qui arrive), 사람에도 que(la femme que tu connais)가 옵니다. 'qui = who, que = which'라는 등식을 머리에서 지우는 게 이 챕터의 졸업 요건이에요.",
        enParallel: {
          rows: [
            { en: "the man **who** lives here", fr: "l'homme **qui** habite ici", ipa: "[lɔm ki abit isi]", ko: "여기 사는 남자" },
            { en: "the book **that** I read", fr: "le livre **que** je lis", ipa: "[lə livʁ kə ʒə li]", ko: "내가 읽는 책" },
          ],
          note: "qui=주어 자리 who/which/that, que=목적어 자리 whom/which/that. 선행사 뒤에 관계절이 붙는 어순이 영어와 동일.",
        },
        tip: "팝송 한 소절로 굳히기 — 에디트 피아프가 아니라 셀린 디옹도 좋지만, 가장 유명한 건 «Je veux un homme qui me regarde»류의 가사 패턴이에요. 'qui + 동사' 덩어리를 노래 가사에서 찾는 습관을 들이면 어느새 몸이 구별하게 돼요.",
      },
    ],
  },
  {
    slug: "a2-11-time-expressions",
    level: "A2",
    order: 11,
    title: "\"3년째 배우고 있어요\"를 한 단어로",
    topic: "시간 표현 depuis·pendant·il y a",
    titleFr: "Les expressions de temps",
    summary: "depuis, pendant, il y a, dans, en — 한국어 '~동안, ~전에, ~후에'가 프랑스어에서 일곱 갈래로 갈라지는 지도를 한 장에 그려요.",
    duration: "약 9분",
    sections: [
      {
        heading: "depuis — 시작점부터 지금까지, 현재형으로",
        pattern: "현재형 + depuis + 기간/시점",
        patternKo: "'3년째 ~하고 있어요'는 depuis 하나로",
        body:
          "**depuis**는 과거에 시작해 **지금도 계속되는 일**의 경과를 표시해요. J'apprends le français **depuis** trois ans.(3년째 배우고 있어요.)\n\n" +
          "핵심은 시제 — 지금도 하고 있으니 **현재형**을 써요. 뒤에는 기간(trois ans)도, 시점(2022, lundi)도 다 올 수 있어요.",
        examples: [
          { fr: "J'apprends le français depuis trois ans.", ipa: "[ʒapʁɑ̃ lə fʁɑ̃sɛ dəpɥi tʁwazɑ̃]", ko: "3년째 프랑스어를 배우고 있어요." },
          { fr: "Elle travaille ici depuis 2022.", ipa: "[ɛl tʁavaj isi dəpɥi dø mil vɛ̃tdø]", ko: "그녀는 2022년부터 여기서 일해요.", note: "시점도 OK" },
          { fr: "On se connaît depuis longtemps.", ipa: "[ɔ̃ sə kɔnɛ dəpɥi lɔ̃tɑ̃]", ko: "우리는 오래전부터 아는 사이예요." },
        ],
        vsEn: "영어라면 I **have been learning** French for three years — 현재완료진행이죠. 프랑스어는 '지금도 하는 중'이라는 현재성에 주목해 그냥 현재형을 써요. 영어 감각으로 J'ai appris ... depuis(✗)라고 복합과거를 쓰면 '계속'의 의미가 깨집니다.",
        enParallel: {
          rows: [
            { en: "**since** 2022", fr: "**depuis** 2022", ipa: "[dəpɥi dø mil vɛ̃tdø]", ko: "2022년부터" },
            { en: "**for** three years", fr: "**depuis** trois ans", ipa: "[dəpɥi tʁwazɑ̃]", ko: "3년째" },
          ],
          note: "영어는 시점이면 since, 기간이면 for로 갈라지지만, 프랑스어는 depuis 하나로 둘 다 — 현재시제와 함께 '지금까지 계속'을 나타내는 발상은 영어 현재완료진행과 통해요.",
        },
      },
      {
        heading: "ça fait ... que — 기간을 앞세워 강조하기",
        pattern: "Ça fait + 기간 + que + 현재형 (= Il y a + 기간 + que)",
        patternKo: "'~한 지 ...됐다' — 기간을 문장 앞으로 빼 강조",
        body:
          "depuis와 같은 뜻을 **기간을 문장 맨 앞으로** 빼서 강조하는 구어 변형이에요. **Ça fait** trois ans **que** j'habite ici.(여기 산 지 3년 됐어요.)\n\n" +
          "**il y a + 기간 + que**도 같은 틀이에요. 셋 다 동사는 현재형 — '아직 진행 중'이라는 신호죠.",
        examples: [
          { fr: "Ça fait six mois que je travaille ici.", ipa: "[sa fɛ si mwa kə ʒə tʁavaj isi]", ko: "여기서 일한 지 6개월 됐어요." },
          { fr: "Il y a une heure que j'attends !", ipa: "[ilja ynœʁ kə ʒatɑ̃]", ko: "기다린 지 한 시간째야!" },
          { fr: "Ça fait longtemps qu'on ne s'est pas vus !", ipa: "[sa fɛ lɔ̃tɑ̃ kɔ̃ nə sɛ pa vy]", ko: "우리 진짜 오랜만이다!", note: "재회 인사의 국민 표현" },
        ],
        tip: "한국어 '~한 지 ...이 되다'와 어순까지 닮아서(기간이 먼저) depuis보다 입에 잘 붙어요. 재회 인사 «Ça fait longtemps !»(오랜만이야!)부터 통째로 외워두세요.",
      },
      {
        heading: "pendant vs il y a — 닫힌 기간과 과거의 한 점",
        pattern: "pendant + 기간 (~ 동안) · 과거시제 + il y a + 기간 (~ 전에)",
        patternKo: "끝난 기간은 pendant, '~전에'는 il y a",
        body:
          "**pendant**은 시작과 끝이 **닫힌 기간**이에요. J'ai habité à Busan **pendant** deux ans.(2년 동안 살았어요 — 지금은 아님.) 격식 글에서는 같은 자리에 **au cours de**(~ 동안에)도 자주 보여요.\n\n" +
          "**il y a + 기간**은 '~ 전에'라는 **과거의 한 점** — 과거시제와 단짝이에요. Il est parti **il y a** dix minutes.(10분 전에 떠났어요.)",
        examples: [
          { fr: "J'ai étudié le piano pendant cinq ans.", ipa: "[ʒe etydje lə pjano pɑ̃dɑ̃ sɛ̃kɑ̃]", ko: "피아노를 5년 동안 배웠어요.", note: "지금은 안 침 — 그래서 복합과거" },
          { fr: "Elle est arrivée en France il y a un mois.", ipa: "[ɛl ɛtaʁive ɑ̃ fʁɑ̃s ilja œ̃ mwa]", ko: "그녀는 한 달 전에 프랑스에 왔어요." },
          { fr: "Pendant le dîner, on a parlé de tout.", ipa: "[pɑ̃dɑ̃ lə dine ɔ̃na paʁle də tu]", ko: "저녁 먹는 동안 이런저런 얘기를 했어요.", note: "pendant + 명사도 OK" },
        ],
        pitfall: "한국어 '3년 동안 배웠어요'는 지금도 배우는지 애매하지만, 프랑스어는 칼같이 갈려요 — **지금도 하면 depuis + 현재형, 끝났으면 pendant + 복합과거**. 'depuis인데 복합과거'인 문장이 보이면 십중팔구 오류예요.",
      },
      {
        heading: "dans vs en — '~ 후에'와 '~ 만에'",
        pattern: "dans + 기간 (지금부터 ~ 후에) · en + 기간 (~ 만에, 걸려서)",
        patternKo: "'~후에'는 dans, 소요 시간 '~만에'는 en",
        body:
          "**dans**은 **지금부터 잰 미래의 한 점**이에요. Le train part **dans** vingt minutes.(20분 후에 출발해요.) il y a(~ 전에)의 거울상이죠.\n\n" +
          "**en**은 **소요 시간** — '얼마나 걸려서'예요. Il a tout mangé **en** cinq minutes.(5분 만에 다 먹었어요.)",
        examples: [
          { fr: "Le train part dans vingt minutes.", ipa: "[lə tʁɛ̃ paʁ dɑ̃ vɛ̃ minyt]", ko: "기차는 20분 후에 출발해요." },
          { fr: "Il a tout mangé en cinq minutes.", ipa: "[il a tu mɑ̃ʒe ɑ̃ sɛ̃k minyt]", ko: "그는 5분 만에 다 먹었어요." },
          { fr: "Dans un an, je parlerai mieux français.", ipa: "[dɑ̃zœ̃nɑ̃ ʒə paʁləʁe mjø fʁɑ̃sɛ]", ko: "1년 후엔 프랑스어를 더 잘하게 될 거예요." },
        ],
        vsEn: "영어 in은 in ten minutes(10분 후에)와 in one hour(한 시간 만에)를 다 커버해요. 프랑스어는 이걸 **dans(후에)/en(만에)**으로 쪼개요. '지금부터 카운트다운이면 dans, 스톱워치 기록이면 en'으로 구별하세요.",
      },
      {
        heading: "시작점과 끝점 — à partir de·jusqu'à, 그리고 전체 지도",
        pattern: "à partir de + 시점 (~부터) · jusqu'à + 시점 (~까지)",
        patternKo: "시작점 '~부터'와 끝점 '~까지'",
        body:
          "**à partir de**는 시작점(특히 미래의), **jusqu'à**는 끝점이에요. à와 le가 만나면 **jusqu'au** matin처럼 축약돼요.\n\n" +
          "이 챕터의 일곱 표현은 결국 **시간축 위의 위치와 방향**이 전부예요. 표 한 장으로 정리하면 끝납니다.",
        table: {
          caption: "시간 표현 한눈에",
          headers: ["표현", "방향·의미", "예"],
          rows: [
            ["depuis + 현재형", "과거 → 지금 계속", "depuis trois ans (3년째)"],
            ["il y a", "과거의 한 점 (~ 전에)", "il y a une heure (한 시간 전에)"],
            ["pendant", "닫힌 기간 (~ 동안)", "pendant deux ans (2년 동안)"],
            ["en", "소요 시간 (~ 만에)", "en une heure (한 시간 만에)"],
            ["dans", "미래의 한 점 (~ 후에)", "dans une heure (한 시간 후에)"],
            ["à partir de", "시작점 (~부터)", "à partir de lundi (월요일부터)"],
            ["jusqu'à", "끝점 (~까지)", "jusqu'à minuit (자정까지)"],
          ],
        },
        examples: [
          { fr: "Le musée est ouvert jusqu'à dix-neuf heures.", ipa: "[lə myze ɛtuvɛʁ ʒyska diznœvœʁ]", ko: "미술관은 저녁 7시까지 열어요." },
          { fr: "À partir de demain, je me lève à six heures !", ipa: "[a paʁtiʁ də dəmɛ̃ ʒə mə lɛv a sizœʁ]", ko: "내일부터 6시에 일어날 거야!" },
        ],
        tip: "il y a(과거로 ~ 전)와 dans(미래로 ~ 후)은 현재를 축으로 한 거울 대칭이에요. «Il y a une heure ↔ dans une heure»를 짝으로 외우면 방향이 안 헷갈립니다.",
      },
    ],
  },

  {
    slug: "a2-12-quantity-tout",
    level: "A2",
    order: 12,
    title: "\"사람이 너무 많아요\" — 양 재는 법",
    topic: "수량 표현·tout 4형태",
    titleFr: "La quantité et tout",
    summary: "beaucoup de, trop de, un peu de의 수량 부사부터 형태가 넷인 tout까지 — '얼마나'를 말하는 부품을 한 상자에 모아요.",
    duration: "약 8분",
    sections: [
      {
        heading: "수량 부사 + de — 관사가 사라지는 자리",
        pattern: "beaucoup / trop / assez / (un) peu + de + 무관사 명사",
        patternKo: "양을 재는 순간 du/de la/des → de",
        body:
          "'많이, 너무, 충분히, 조금'을 명사에 붙일 때는 **부사 + de** 틀을 써요. 이때 부분관사·부정관사는 사라지고 **맨 de**만 남아요: du café → beaucoup **de** café.\n\n" +
          "**un peu de**(조금은 있는)와 **peu de**(거의 없는)는 뉘앙스가 반대니 따로 챙기세요.",
        examples: [
          { fr: "Il y a beaucoup de monde sur la place.", ipa: "[ilja boku də mɔ̃d syʁ la plas]", ko: "광장에 사람이 많아요." },
          { fr: "Je bois un peu de lait le matin.", ipa: "[ʒə bwa œ̃ pø də lɛ lə matɛ̃]", ko: "아침에 우유를 조금 마셔요." },
          { fr: "Tu poses trop de questions !", ipa: "[ty poz tʁo də kɛstjɔ̃]", ko: "너 질문이 너무 많아!" },
          { fr: "Il n'y a pas assez de temps.", ipa: "[il nja pa ase də tɑ̃]", ko: "시간이 충분하지 않아요." },
        ],
        pitfall: "beaucoup **des**(✗)가 최다 빈출 오류예요. '커피를 많이'에서 '그 커피(du café)'의 관사를 끌고 오고 싶어지지만, 수량 표현 뒤는 무조건 맨 de — beaucoup de café, trop d'eau처럼요.",
      },
      {
        heading: "단위와 개수 — un kilo de, quelques, plusieurs, chaque",
        pattern: "단위 명사 + de + 무관사 명사 · quelques(몇) · plusieurs(여러) · chaque(각, 매)",
        patternKo: "단위·개수를 세는 부품들 — 단위 뒤도 맨 de",
        body:
          "장보기의 핵심 틀 — **un kilo de** tomates, **une bouteille de** vin, un morceau **de** fromage. 단위 뒤도 역시 맨 de예요.\n\n" +
          "개수가 흐릿할 땐 **quelques**(몇몇) < **plusieurs**(여럿)예요. **chaque**(각, ~마다)는 항상 **단수**와 짝이에요: chaque jour(매일).",
        examples: [
          { fr: "Je voudrais un kilo de pommes et un morceau de fromage.", ipa: "[ʒə vudʁɛ œ̃ kilo də pɔm e œ̃ mɔʁso də fʁɔmaʒ]", ko: "사과 1킬로랑 치즈 한 조각 주세요." },
          { fr: "Il reste quelques places pour le concert.", ipa: "[il ʁɛst kɛlk plas puʁ lə kɔ̃sɛʁ]", ko: "콘서트 자리가 몇 개 남아 있어요." },
          { fr: "Il y a plusieurs solutions.", ipa: "[ilja plyzjœʁ sɔlysjɔ̃]", ko: "해결책은 여러 가지예요." },
          { fr: "Chaque chambre a une salle de bains.", ipa: "[ʃak ʃɑ̃bʁ a yn sal də bɛ̃]", ko: "방마다 욕실이 딸려 있어요." },
        ],
        tip: "시장·빵집에서는 «un kilo de ..., s'il vous plaît» 틀 하나로 거의 모든 주문이 해결돼요. 수량 표현은 문법이기 전에 생존 도구 — 입으로 먼저 외우세요.",
      },
      {
        heading: "tout의 4형태 — 명사 앞에서 성수 일치",
        pattern: "tout / toute / tous / toutes + 정관사·소유사 + 명사",
        patternKo: "'모든'의 tout는 명사의 성·수 따라 네 형태",
        body:
          "'모든, 전체'의 **tout**는 형용사처럼 **네 가지 형태**로 변해요. 뒤따르는 명사의 성·수가 결정해요: tout le temps, toute la journée, tous les jours, toutes les semaines.\n\n" +
          "특히 **tous les + 기간**은 '~마다'(반복)예요: tous les matins(매일 아침), toutes les dix minutes(10분마다).",
        table: {
          caption: "tout 4형태",
          headers: ["형태", "발음", "예"],
          rows: [
            ["tout (남성 단수)", "[tu]", "tout le monde, tout le temps"],
            ["toute (여성 단수)", "[tut]", "toute la journée (하루 종일)"],
            ["tous (남성 복수)", "[tu]", "tous les jours (매일)"],
            ["toutes (여성 복수)", "[tut]", "toutes les semaines (매주)"],
          ],
        },
        examples: [
          { fr: "J'ai dormi toute la matinée.", ipa: "[ʒe dɔʁmi tut la matine]", ko: "오전 내내 잤어요." },
          { fr: "Tous mes amis aiment ce café.", ipa: "[tu mezami ɛm sə kafe]", ko: "내 친구들 모두 이 카페를 좋아해요." },
          { fr: "Le bus passe toutes les quinze minutes.", ipa: "[lə bys pas tut le kɛ̃z minyt]", ko: "버스는 15분마다 와요." },
        ],
        pitfall: "한정사 tous는 **[tu]**(s 묵음)지만, '모두'라는 대명사로 쓰면 **[tus]**로 s를 발음해요: Ils sont **tous** là [tus].(다들 와 있어.) 철자는 같은데 소리가 갈리는 드문 경우라, 듣기에서 결정적 단서가 돼요.",
      },
      {
        heading: "굳은 표현 — tout le monde, tout ce que",
        pattern: "tout le monde + 단수 동사 · tout ce qui/que (~하는 모든 것)",
        patternKo: "'모두'는 단수 동사와 — tout의 굳은 표현들",
        body:
          "**tout le monde**(모두)는 뜻은 복수지만 **동사는 3인칭 단수**예요. 절을 통째로 받을 땐 **tout ce qui/que**: C'est **tout ce que** je sais.(그게 내가 아는 전부야.)\n\n" +
          "부사로 굳은 tout도 한 줌 있어요 — pas du tout(전혀), tout de suite(곧바로), tout droit(직진).",
        examples: [
          { fr: "Tout le monde veut venir samedi.", ipa: "[tu lə mɔ̃d vø vəniʁ samdi]", ko: "토요일에 다들 오고 싶어 해요." },
          { fr: "C'est tout ce que je sais.", ipa: "[sɛ tu sə kə ʒə sɛ]", ko: "그게 내가 아는 전부야." },
          { fr: "Merci pour tout !", ipa: "[mɛʁsi puʁ tu]", ko: "여러모로 고마웠어요!", note: "대명사로 쓰인 tout" },
        ],
        vsEn: "영어 everybody도 단수 취급이죠(Everybody **is** here). tout le monde **est** là — 똑같은 감각이에요. 단, 직역하면 'all the world'라서 '온 세상'으로 오해하기 쉬운데, 그냥 '모두'라는 뜻이에요.",
      },
      {
        heading: "quelque chose·quelqu'un — '무언가, 누군가' + 형용사",
        pattern: "quelque chose / quelqu'un + de + 형용사 (남성형 고정)",
        patternKo: "'무언가/누군가'에 형용사를 달 땐 de + 남성형",
        body:
          "'무언가(quelque chose)'와 '누군가(quelqu'un)'에 형용사를 붙이려면 **de**가 필요해요: quelque chose **de** bon(맛있는 거), quelqu'un **de** gentil(친절한 사람).\n\n" +
          "이때 형용사는 **항상 남성 단수형**으로 고정이에요 — quelque chose de bonne(✗).",
        examples: [
          { fr: "Tu veux manger quelque chose ?", ipa: "[ty vø mɑ̃ʒe kɛlkə ʃoz]", ko: "뭐 좀 먹을래?" },
          { fr: "Quelqu'un a laissé un message pour toi.", ipa: "[kɛlkœ̃ a lɛse œ̃ mesaʒ puʁ twa]", ko: "누가 너한테 메시지를 남겼어." },
          { fr: "Je cherche quelque chose de joli pour ma mère.", ipa: "[ʒə ʃɛʁʃ kɛlkə ʃoz də ʒɔli puʁ ma mɛʁ]", ko: "어머니께 드릴 예쁜 걸 찾고 있어요.", note: "de + 남성형 joli" },
        ],
        tip: "이 짝의 부정형이 바로 rien(아무것도)과 personne(아무도)예요. rien de grave(심각한 건 없어), personne d'intéressant처럼 de + 남성형 규칙도 그대로 — 부정 확장 챕터(B2)에서 다시 만나요.",
      },
    ],
  },
];

export default chapters;
