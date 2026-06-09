/**
 * C2 — 정점: 문학어, 문체, 프랑스어권, 문화 코드, 그리고 번역
 * 언어 지식을 넘어 문화 해독력으로. 레퍼런스 전체를 마무리하는 레벨이에요.
 */
export default [
  {
    slug: "c2-01-subjonctif-litteraire",
    level: "C2",
    order: 1,
    title: "접속법 반과거·대과거 — 고전을 읽기 위한 최소한",
    titleFr: "Le subjonctif imparfait et plus-que-parfait",
    summary: "qu'il fût, qu'il eût aimé... 현대 회화에서는 죽었지만 고전 문학에는 살아 있는 시제. 읽어내는 데 필요한 만큼만 정확히 배워요.",
    duration: "약 10분",
    sections: [
      {
        heading: "무엇이고, 왜 사라졌나",
        pattern: "주절 과거 → 접속법도 과거형 (Je voulais qu'il vînt)",
        patternKo: "고전 문학의 시제 일치 — 현대 구어에서는 소멸",
        body:
          "고전 문학에서는 주절이 과거이면 종속절의 접속법도 과거형으로 맞췄어요. 이 접속법 반과거·대과거는 **현대 구어에서 완전히 사라졌고**, 현대어는 그냥 접속법 현재·과거로 대체해요(Je voulais qu'il vienne).\n\n" +
          "학습 목표는 단 하나 — **17~20세기 초 텍스트(몰리에르, 발자크, 프루스트...)에서 만났을 때 알아보기.** 직접 쓸 일은 농담할 때 말고는 없어요.",
        examples: [
          { fr: "Il fallait qu'il partît avant l'aube.", ko: "그는 동트기 전에 떠나야 했다.", note: "현대어라면 qu'il parte. 고전 텍스트의 시제 일치" },
          { fr: "Je craignais qu'elle ne fût déjà partie.", ko: "나는 그녀가 이미 떠났을까 두려웠다.", note: "fût = être의 접속법 반과거. 허사 ne와 결합한 전형적 문어" },
        ],
        tip: "현대 작가가 일부러 쓰는 경우는 거의 항상 유머예요. 격식을 과장해 웃기려는 '의고체 개그' — 한국어로 치면 일상 대화에 '~하옵니다'를 섞는 느낌이에요. 그 뉘앙스까지 읽어내면 진짜 C2입니다.",
      },
      {
        heading: "형태 — 단순과거에서 만들어져요",
        pattern: "passé simple + ^(악상 시르콩플렉스) → 접속법 반과거 (fut → fût · eut → eût)",
        body:
          "**접속법 반과거는 passé simple 어간에서 규칙적으로** 만들어져요: il parla → qu'il parlât, il fut → qu'il fût.\n\n" +
          "텍스트에서 압도적으로 자주 나오는 건 3인칭 단수예요. 식별 포인트는 **모자(^)** — 단순과거(fut, eut)와 모자 하나 차이라는 것만 기억하면 돼요.",
        table: {
          caption: "최빈출 접속법 반과거 — 3인칭 단수",
          headers: ["동사", "passé simple", "subj. imparfait", "현대어 대체형"],
          rows: [
            ["être", "il fut", "qu'il fût", "qu'il soit"],
            ["avoir", "il eut", "qu'il eût", "qu'il ait"],
            ["faire", "il fit", "qu'il fît", "qu'il fasse"],
            ["aller", "il alla", "qu'il allât", "qu'il aille"],
            ["venir", "il vint", "qu'il vînt", "qu'il vienne"],
            ["pouvoir", "il put", "qu'il pût", "qu'il puisse"],
            ["parler", "il parla", "qu'il parlât", "qu'il parle"],
          ],
        },
        pitfall: "fut(단순과거, 직설법)와 fût(접속법 반과거)는 **모자(^) 하나로 법(mode)이 갈려요**. fût가 보이면 '의심·감정·가정의 그늘 아래 있는 절이구나'라고 읽으면 돼요. 발음은 둘 다 [fy]로 같아서, 구별은 오직 눈으로만 가능해요.",
      },
      {
        heading: "접속법 대과거 — 그리고 조건법 과거 제2형",
        pattern: "que + eût/fût + p.p. = 접속법 대과거 · que 없으면 = aurait/serait + p.p.",
        body:
          "접속법 대과거는 **eût/fût + 과거분사**예요: qu'il eût aimé. 종속절에서는 접속법 과거의 문어 버전으로 읽으면 돼요.\n\n" +
          "진짜 함정: 같은 형태가 종속절 밖에서 **조건법 과거 제2형**으로 쓰여요. Il eût aimé voyager = Il aurait aimé voyager(여행을 좋아했을 텐데) — que 없는 자리의 eût는 '~했을 텐데'로 번역하세요.",
        examples: [
          { fr: "On eût dit un tableau de Monet.", ko: "마치 모네의 그림 같았다.", note: "= On aurait dit... 문학 텍스트 최빈출 패턴이니 통째로 암기" },
          { fr: "Je regrettais qu'il n'eût rien compris.", ko: "나는 그가 아무것도 이해하지 못했음이 안타까웠다.", note: "que 뒤 → 접속법 대과거" },
          { fr: "Qui l'eût cru ?", ko: "누가 그걸 믿었으랴?", note: "= Qui l'aurait cru ? 굳은 표현으로 지금도 가끔 보여요." },
        ],
      },
      {
        heading: "고전 읽기 실전 전략",
        pattern: "fût/eût/vînt/pût · -ât/-ît/-ût → 현대어 접속법으로 읽기",
        body:
          "독서 전략 세 줄: ① 모자 쓴 짧은 동사(fût, eût, vînt, pût)는 접속법 반과거·대과거 — 의미는 현대어 접속법과 같아요. ② -ât, -ît, -ût 동사도 같은 식구. ③ que 없는 자리의 eût/fût + 과거분사는 '~했을 텐데'.\n\n" +
          "이 세 규칙이면 발자크와 프루스트의 시제 앞에서 길을 잃지 않아요. 활용표 전체 암기는 프랑스인들도 안 하는 일이에요.",
        examples: [
          { fr: "Bien qu'il fût tard, elle continuait d'écrire.", ko: "늦은 시각이었음에도 그녀는 계속 글을 쓰고 있었다.", note: "bien que + 접속법 — 반과거형이라 문학 텍스트임을 알 수 있어요." },
          { fr: "Il semblait qu'elle eût tout oublié.", ko: "그녀는 모든 것을 잊은 듯했다.", note: "il semblait que + 접속법 대과거" },
        ],
        vsEn: "영어에도 화석화된 접속법이 있어요 — if I were you, God save the Queen의 were/save가 그 흔적이죠. '일상에서는 거의 죽었지만 굳은 표현과 격식 문장에 남아 있는 법(mode)'이라는 처지가 프랑스어 접속법 반과거와 닮았어요. 다만 프랑스어 쪽이 문학 텍스트에서는 훨씬 체계적으로 살아 있어요.",
      },
    ],
  },

  {
    slug: "c2-02-style",
    level: "C2",
    order: 2,
    title: "수사법과 문체 기교 — 프랑스 글쓰기의 미학",
    titleFr: "Figures de style et élégance",
    summary: "«Va, je ne te hais point.» 덜 말함으로써 더 말하는 기술. 프랑스어가 아름답다고 느껴지는 장치들을 해부해요.",
    duration: "약 11분",
    sections: [
      {
        heading: "litote — 덜 말해서 더 말하기",
        pattern: "litote: 약하게 말해 강하게 전하기 (Je ne te hais point = 사랑해요)",
        body:
          "**litote**(완서법)는 부정·절제로 실제보다 약하게 말해 오히려 강한 뜻을 전하는, 프랑스 수사학의 간판이에요. 《르 시드》의 **«Va, je ne te hais point.»** — '미워하지 않는다'는 절제 아래 '여전히 사랑한다'가 타오르죠.\n\n" +
          "일상의 **C'est pas mal**(→ 꽤 좋다), **Ce n'est pas faux**(→ 맞는 말이다)도 같은 원리예요. 프랑스인의 칭찬이 인색해 보이는 건 litote가 문화적 기본값이기 때문이에요.",
        examples: [
          { fr: "Va, je ne te hais point.", ko: "가세요, 당신을 미워하지 않아요. (= 사랑해요)", note: "Corneille, Le Cid. point는 pas의 옛 강조형" },
          { fr: "C'est pas mal du tout, ton travail.", ko: "네 작업, 전혀 나쁘지 않은데. (= 아주 좋다)", note: "프랑스식 고급 칭찬 — 액면가로 받지 마세요." },
          { fr: "Il n'est pas sot.", ko: "그는 어리석지 않다. (= 꽤 영리하다)", note: "문어적 litote" },
        ],
        pitfall: "프랑스인의 pas mal을 한국어 '그냥 그래'로 알아들으면 정반대 오해예요. 부정형 평가는 일단 litote인지 의심하세요. 반대로 한국식으로 '정말 정말 최고예요!'를 남발하면 프랑스 귀에는 과장으로 들릴 수 있어요.",
      },
      {
        heading: "euphémisme — 완곡어법, 부드럽게 덮는 기술",
        pattern: "il nous a quittés = 별세 · plan social = 정리해고 · quartiers sensibles = 우범 지역",
        body:
          "**euphémisme**(완곡어법)은 불편한 현실을 부드러운 말로 감싸요. litote가 수사적 강조라면 euphémisme은 충격 완화가 목적 — 죽음 주변(s'éteindre, disparaître)과 사회·행정 언어(demandeur d'emploi ← 실업자)에 특히 많아요.\n\n" +
          "C2 독해력은 이 포장지를 벗겨 읽는 능력이에요. 정치·경제 기사에서는 사전적 뜻이 아니라 **무엇을 덮고 있는지**를 읽어야 해요.",
        examples: [
          { fr: "Son grand-père s'est éteint paisiblement dans la nuit.", ko: "그분의 할아버지는 밤사이 평온히 영면하셨다.", note: "s'éteindre — 촛불이 꺼지는 이미지의 완곡어" },
          { fr: "L'entreprise annonce un plan de sauvegarde de l'emploi.", ko: "회사가 «고용 보호 계획»을 발표했다.", note: "실제 내용은 대규모 감원 — 행정 완곡어법의 정점" },
        ],
        vsEn: "영어의 pass away, between jobs와 같은 메커니즘이라 개념 자체는 익숙할 거예요. 차이는 프랑스가 이런 기법에 이름을 붙여 학교에서 figures de style로 가르치고, 교양인의 표지로 여긴다는 점 — 그래서 시사 텍스트의 완곡어 밀도가 유난히 높아요.",
      },
      {
        heading: "도치 — 문어의 우아한 어순 바꾸기",
        pattern: "Peut-être / Sans doute / À peine + 동사-주어 도치",
        body:
          "격조 있는 문어는 어순을 뒤집어 리듬과 격을 만들어요. **부사 뒤 도치**(Peut-être a-t-il raison)가 대표 — 이 도치를 쓰느냐가 글의 격을 한 단계 가르죠.\n\n" +
          "**관계절 안의 도치**(le pays où vivait son père)와 **묘사 도치**(Au fond de la salle se trouvait un piano — 장소구 + 동사 + 주어)도 소설·격식 문어의 표준 카메라 워크예요.",
        examples: [
          { fr: "Peut-être faudrait-il repenser tout le système.", ko: "어쩌면 시스템 전체를 다시 생각해야 할지도 모른다.", note: "peut-être 문두 + 도치 = 격식 문어. 구어라면 Peut-être qu'il faudrait..." },
          { fr: "À peine était-elle sortie qu'il se mit à pleuvoir.", ko: "그녀가 나서자마자 비가 내리기 시작했다.", note: "à peine... que — 도치가 의무적인 구문" },
          { fr: "Sur la place se dressait une vieille église.", ko: "광장에는 오래된 성당이 서 있었다.", note: "장소구 + 동사 + 주어 — 묘사의 어순" },
        ],
        tip: "DALF C2 작문에서 Peut-être que... 대신 Peut-être + 도치를 한 번만 써도 채점자의 눈빛이 달라져요. 단, 도치를 매 문장 쓰면 부담스러운 글이 되니 한 단락에 하나 정도가 우아함의 적정선이에요.",
      },
      {
        heading: "삼항 리듬과 그 밖의 장치들",
        pattern: "rythme ternaire (Liberté, Égalité, Fraternité) · anaphore (수구 반복) · antiphrase (반어)",
        body:
          "프랑스 수사학은 셋을 사랑해요 — **삼항 리듬**의 원형이 Liberté, Égalité, Fraternité죠. **anaphore**는 문장 첫머리를 반복해 파도를 만드는 기법으로, 올랑드의 «Moi président...» 15회 반복 연설이 교과서적 사례예요.\n\n" +
          "**antiphrase**는 뜻과 반대로 말하기: C'est malin !(참 영리하기도 하지! → 멍청한 짓이야!) 억양과 맥락을 못 읽으면 칭찬으로 오해해요.",
        examples: [
          { fr: "Je suis venu, j'ai vu, j'ai vaincu.", ko: "왔노라, 보았노라, 이겼노라.", note: "카이사르의 말의 프랑스어 정착형 — 삼항 리듬의 원형" },
          { fr: "Il nous faut du courage, de la patience et de la lucidité.", ko: "우리에게 필요한 것은 용기와 인내, 그리고 냉철함이다.", note: "연설문의 표준 3박자" },
          { fr: "C'est malin ! Maintenant tout est à refaire.", ko: "참 잘했다! 이제 전부 다시 해야 하잖아.", note: "antiphrase — 글자 그대로 받으면 안 되는 '칭찬'" },
        ],
        etym: "anaphore는 그리스어 anaphorá(다시 들어 올리기)에서 왔어요 — 영어 anaphora와 동일해요. litote(단순함), euphémisme(좋게 말하기)도 그리스 수사학 용어가 영어·프랑스어에 나란히 정착한 것이라, 영어 교양 어휘가 그대로 자산이 됩니다.",
      },
    ],
  },

  {
    slug: "c2-03-francophonie",
    level: "C2",
    order: 3,
    title: "프랑스어권의 변이 — 하나의 언어, 여러 개의 목소리",
    titleFr: "Les variétés du français dans la francophonie",
    summary: "septante, courriel, char, essencerie... 파리의 프랑스어는 표준이 아니라 '하나의 변이형'일 뿐. 세계의 프랑스어를 만나요.",
    duration: "약 11분",
    sections: [
      {
        heading: "프랑코포니 — 프랑스어는 프랑스만의 것이 아니다",
        body:
          "프랑스어 화자 약 3억 명 중 본토 인구는 일부예요. 오늘날 화자의 다수는 **아프리카**에 있고 비중은 계속 커지고 있어요. 다행히 **문어는 거의 통일**되어 있어 차이는 발음·어휘·일부 표현에 집중돼요.\n\n" +
          "이 챕터의 목표는 '다른 게 아니라 틀린 것'이라는 함정을 피하는 것 — septante는 사투리가 아니라 벨기에·스위스의 **표준**이에요.",
        examples: [
          { fr: "Le français est la langue officielle de 29 pays.", ko: "프랑스어는 29개국의 공용어예요.", note: "영어 다음으로 많은 나라의 공용어" },
          { fr: "Elle parle français avec l'accent de Dakar.", ko: "그녀는 다카르 억양의 프랑스어를 해요.", note: "억양의 다양성은 영어(미국/영국/호주...)와 마찬가지" },
        ],
      },
      {
        heading: "벨기에와 스위스 — septante, nonante의 합리주의",
        pattern: "70 = septante · 90 = nonante · 80 = huitante (스위스 일부)",
        body:
          "본토의 soixante-dix(60+10), quatre-vingt-dix(4×20+10) 대신 벨기에·스위스는 **정직한 단어**를 써요. 식사 이름도 한 칸씩 밀려 있어요: **déjeuner = 아침, dîner = 점심, souper = 저녁**(퀘벡도 동일) — 어원적으로는 이쪽이 원조예요.\n\n" +
          "벨기에 특유 표현: savoir를 pouvoir 뜻으로(Je ne saurais pas venir = 못 가요), s'il vous plaît를 '여기요(물건을 건네며)'로 쓰는 용법이 유명해요.",
        table: {
          caption: "숫자와 식사 — 지역별 비교",
          headers: ["", "프랑스", "벨기에", "스위스", "퀘벡"],
          rows: [
            ["70", "soixante-dix", "septante", "septante", "soixante-dix"],
            ["80", "quatre-vingts", "quatre-vingts", "huitante (일부 주)", "quatre-vingts"],
            ["90", "quatre-vingt-dix", "nonante", "nonante", "quatre-vingt-dix"],
            ["아침 식사", "petit-déjeuner", "déjeuner", "déjeuner", "déjeuner"],
            ["점심 식사", "déjeuner", "dîner", "dîner", "dîner"],
            ["저녁 식사", "dîner", "souper", "souper", "souper"],
          ],
        },
        examples: [
          { fr: "Ça fait nonante-cinq euros.", ko: "95유로입니다. (벨기에·스위스)", note: "프랑스에서는 quatre-vingt-quinze" },
          { fr: "On soupe ensemble ce soir ?", ko: "오늘 저녁 같이 먹을래? (퀘벡·벨기에·스위스)", note: "프랑스에서 souper는 '밤참' 뉘앙스로만 남아 있어요." },
        ],
        pitfall: "퀘벡 사람과 점심 약속을 잡는데 dîner라고 하면 **점심**이에요. 저녁으로 알아듣고 7시에 나가면 다섯 시간 늦은 거예요. 지역이 확인될 때까지는 midi/ce soir 같은 시간 표현을 덧붙이는 게 안전해요.",
      },
      {
        heading: "퀘벡 — 대서양 건너의 프랑스어",
        pattern: "week-end → fin de semaine · e-mail → courriel · shopping → magasiner",
        body:
          "퀘벡 프랑스어는 17세기 프랑스어에서 갈라져 독자 진화했고, 영어의 바다에 둘러싸여 **본토보다 영어 차용에 훨씬 엄격**해요. courriel은 역수입되어 프랑스 공문서에서도 권장돼요.\n\n" +
          "일상 어휘도 달라요: **un char**(자동차), **une blonde**(여자친구), **c'est plate**(지루해). 발음은 [t]/[d]가 [i], [y] 앞에서 [ts]/[dz]로 — tu가 '츄'처럼 들리는 게 대표 신호예요.",
        examples: [
          { fr: "On va magasiner en fin de semaine ?", ko: "주말에 쇼핑 갈래? (퀘벡)", note: "본토: On va faire du shopping ce week-end ?" },
          { fr: "Envoie-moi un courriel.", ko: "이메일 보내줘.", note: "퀘벡발 단어 — 프랑스 행정 문서의 공식 권장어이기도 해요." },
          { fr: "Mon char est en panne, j'ai de la misère à me déplacer.", ko: "차가 고장 나서 이동하는 데 애를 먹고 있어. (퀘벡)", note: "char, avoir de la misère à — 퀘벡 일상어" },
        ],
        vsEn: "영국 영어와 미국 영어의 관계와 비슷하지만 한 가지가 달라요 — 퀘벡은 언어법(loi 101)으로 프랑스어를 제도적으로 보호하고, 표기·용어를 관리하는 기관(OQLF)까지 둬요. '언어를 지키는 일'이 정치 그 자체인 사회예요.",
      },
      {
        heading: "아프리카 — 프랑스어의 미래가 자라는 곳",
        body:
          "통계적으로 프랑스어의 무게중심은 아프리카로 이동 중이에요. 킨샤사(콩고민주공화국)는 파리보다 인구가 많은, 세계 최대의 프랑스어 사용 도시로 꼽혀요.\n\n" +
          "아프리카 프랑스어는 현지어와 어울리며 창의적인 어휘를 만들어왔어요. **une essencerie**(주유소 — 세네갈, essence+erie의 조어), **un maquis**(노점 식당 — 코트디부아르), **ambiancer**(분위기를 띄우다, 놀다), **présentement**(지금 — 본토에서는 드문 부사가 표준으로), **caillou**(돌 → 다이아몬드 등 맥락 확장).\n\n" +
          "아프리카 문학(셍고르, 마리아마 바, 아마두 쿠루마, 알랭 마방쿠...)을 읽는 것은 C2 독서의 큰 보상이에요. 쿠루마는 «프랑스어를 말링케어로 부러뜨려 쓴다»고 했을 만큼, 프랑스어의 가능성을 넓힌 문장들을 만날 수 있어요.",
        examples: [
          { fr: "On s'arrête à l'essencerie avant de prendre la route.", ko: "출발 전에 주유소에 들르자. (세네갈)", note: "essence(휘발유)에 -erie를 붙인 합리적 조어 — boulangerie와 같은 원리" },
          { fr: "Viens, on va ambiancer au maquis ce soir !", ko: "가자, 오늘 밤 마키(노점 식당)에서 신나게 놀자! (서아프리카)", note: "ambiancer ← ambiance(분위기)" },
          { fr: "Présentement, je suis au bureau.", ko: "지금 사무실이에요. (아프리카·퀘벡)", note: "본토라면 en ce moment" },
        ],
        tip: "변이형 어휘를 '시험에 나올 표준'과 분리해서 정리하세요. DELF/DALF는 본토 표준 기준이지만, 듣기 지문에 퀘벡·아프리카 화자가 등장하는 추세라 억양 노출 연습은 실전 대비이기도 해요. RFI(국제방송)와 TV5MONDE가 최고의 교재예요.",
      },
    ],
  },

  {
    slug: "c2-04-culture-implicite",
    level: "C2",
    order: 4,
    title: "속담·문화 코드·암시 — 행간을 읽는 법",
    titleFr: "Proverbes, références et implicite culturel",
    summary: "라퐁텐의 우화 한 줄, 성경의 이미지 하나가 뉴스 제목에 숨어 있어요. 프랑스인이라면 다 아는 '문화적 행간'을 채워요.",
    duration: "약 11분",
    sections: [
      {
        heading: "속담 — 대화에 양념처럼 박히는 지혜",
        body:
          "프랑스어 대화와 글에는 속담(proverbe)이 수시로, 종종 **반 토막만** 인용돼요. Qui vivra...라고만 해도 듣는 사람이 verra를 채우죠. 그래서 속담은 통째로 알아야 반 토막도 알아들어요.\n\n" +
          "최빈출만 추리면: **Qui vivra verra**(살다 보면 알게 되리라 — 두고 보자), **Petit à petit, l'oiseau fait son nid**(조금씩, 새는 둥지를 짓는다 — 티끌 모아 태산), **Il ne faut pas vendre la peau de l'ours avant de l'avoir tué**(곰을 잡기 전에 가죽부터 팔지 마라 — 김칫국부터 마시지 마라), **C'est en forgeant qu'on devient forgeron**(쇠를 두드려야 대장장이가 된다 — 하면서 는다), **Après la pluie, le beau temps**(비 온 뒤에 갠 하늘 — 고생 끝에 낙).\n\n" +
          "한국 속담과 그림은 달라도 뜻이 포개지는 짝이 많아요. 이 대응을 만들어두면 암기도 번역도 쉬워져요.",
        examples: [
          { fr: "Ne vendons pas la peau de l'ours : attendons les résultats.", ko: "김칫국부터 마시지 말자. 결과를 기다리자.", note: "속담을 반만 잘라 동사를 바꿔 쓰는 전형적 활용" },
          { fr: "Petit à petit, l'oiseau fait son nid — ton français progresse chaque jour.", ko: "티끌 모아 태산이라고, 네 프랑스어는 매일 늘고 있어.", note: "격려의 단골 속담" },
          { fr: "Les bons comptes font les bons amis.", ko: "셈이 깔끔해야 우정이 오래간다.", note: "돈 문제를 깔끔히 하자고 제안할 때의 완곡한 한 줄" },
        ],
        tip: "속담은 만들지 말고 수집하세요. 프랑스인이 실제로 쓴 맥락과 함께 적어두는 게 핵심이에요. 어색한 자리에 속담을 꽂으면 '속담 외운 외국인' 티가 나니, 처음에는 알아듣기 전용으로.",
      },
      {
        heading: "라퐁텐의 우화 — 프랑스인의 공통 교과서",
        body:
          "17세기 라퐁텐(La Fontaine)의 우화는 프랑스 초등학교에서 전 국민이 암송하는 텍스트예요. 그래서 우화의 구절과 캐릭터가 **성인들의 대화와 언론에 암호처럼** 돌아다녀요.\n\n" +
          "**《매미와 개미》(La Cigale et la Fourmi)** — cigale(베짱이처럼 노는 사람)과 fourmi(개미처럼 모으는 사람)는 경제 기사의 단골 은유예요. 우화 속 개미의 차가운 대답 **«Eh bien ! dansez maintenant.»**(그럼 이제 춤추시지요)는 '자업자득'의 시그니처 인용구고요.\n\n" +
          "**《까마귀와 여우》(Le Corbeau et le Renard)** — 아첨에 넘어가 치즈를 떨어뜨린 까마귀. 아첨꾼을 경계하라는 맥락에서 인용돼요.\n\n" +
          "**《늑대와 어린 양》(Le Loup et l'Agneau)** — 첫 줄 **«La raison du plus fort est toujours la meilleure»**(강자의 논리가 언제나 이긴다)는 국제 정치 기사 제목의 단골이에요.\n\n" +
          "**《토끼와 거북이》** — 교훈 **«Rien ne sert de courir ; il faut partir à point»**(달려봐야 소용없다, 제때 출발해야 한다)도 통째로 인용되는 명구예요.",
        examples: [
          { fr: "En matière d'épargne, il y a les cigales et les fourmis.", ko: "저축에 관한 한, 세상에는 베짱이형과 개미형이 있다.", note: "경제 기사의 전형적 라퐁텐 암시" },
          { fr: "Tirer les marrons du feu, voilà ce qu'il a fait pour son chef.", ko: "불 속의 밤을 대신 꺼내준 것 — 그가 상사를 위해 한 일이 바로 그거다.", note: "《원숭이와 고양이》에서 온 표현. 남 좋은 일에 위험을 무릅쓰다" },
          { fr: "Dans ce dossier, la raison du plus fort l'a encore emporté.", ko: "이 사안에서도 결국 강자의 논리가 이겼다.", note: "라퐁텐 첫 줄의 변주 — 시사 칼럼 문체" },
        ],
        etym: "fable(우화)은 라틴어 fābula(이야기)에서 — 영어 fable, fabulous와 같은 뿌리예요. 라퐁텐 자신도 이솝(Ésope) 우화를 다시 쓴 것이라, 한국에서 이솝우화로 읽은 이야기들과 줄거리가 상당히 겹쳐요. 내용은 이미 아는 셈이니 프랑스어 명구만 연결하면 됩니다.",
      },
      {
        heading: "성경과 역사에서 온 이미지",
        body:
          "세속 국가 프랑스지만, 언어에는 성경의 그림이 깊이 박혀 있어요. **s'en laver les mains**(손을 씻다 — 빌라도처럼 책임을 회피하다), **un bouc émissaire**(희생양), **jeter la première pierre**(첫 돌을 던지다 — 남을 함부로 단죄하다), **une traversée du désert**(광야의 횡단 — 정치인·예술가의 길고 어두운 침체기), **rendre à César ce qui est à César**(카이사르의 것은 카이사르에게 — 공은 공, 사는 사).\n\n" +
          "역사에서 온 코드도 있어요. **Paris vaut bien une messe**(파리는 미사 한 번의 값어치가 있다 — 앙리 4세가 왕위를 위해 개종하며 했다는 말, 실리를 위한 신념 타협), **un cadeau empoisonné**? 아니, 이건 일반 표현이고 — **après moi, le déluge**(내 뒤에야 홍수가 오든 말든 — 루이 15세 시대의 말로, 무책임의 극치)가 대표적이에요.\n\n" +
          "중세 희극에서 온 **revenons à nos moutons**(우리의 양들에게 돌아갑시다 — 본론으로 돌아가자)도 회의와 수업에서 지금도 매일 쓰여요. 《파틀랭 선생의 소극》(15세기)에서 재판이 곁길로 샐 때마다 판사가 외친 대사예요.",
        examples: [
          { fr: "Le ministre s'en lave les mains : ce sera au prochain gouvernement de décider.", ko: "장관은 손을 씻어버렸다. 결정은 다음 정부의 몫이 될 것이다.", note: "책임 회피 보도의 고정 이미지" },
          { fr: "Après sa défaite, il a connu une longue traversée du désert.", ko: "패배 이후 그는 길고 긴 침체기를 보냈다.", note: "정치 기사 최빈출 — 출애굽기의 광야 40년에서" },
          { fr: "Bon, revenons à nos moutons : où en était le budget ?", ko: "자, 본론으로 돌아갑시다. 예산 얘기 어디까지 했죠?", note: "회의 진행자의 만능 멘트" },
        ],
        pitfall: "이 표현들은 종교 표현이 아니라 **완전히 세속화된 관용구**예요. bouc émissaire(희생양)를 쓴다고 종교색이 느껴지지 않아요. 반대로 한국어 '십자가를 지다'처럼, 한국어에도 같은 경로로 들어온 표현이 많아 직역이 통하는 드문 행운 구역이기도 해요.",
      },
      {
        heading: "뉴스와 일상의 레퍼런스 — 환유의 나라",
        body:
          "프랑스 뉴스는 기관을 **건물·장소 이름으로 부르는 환유**(métonymie)가 표준이에요. 이 코드를 모르면 헤드라인이 풀리지 않아요.\n\n" +
          "**l'Élysée**(엘리제궁 → 대통령실), **Matignon**(마티뇽 → 총리실), **Bercy**(베르시 → 경제재정부), **le Quai d'Orsay**(케 도르세 → 외교부), **la place Beauvau**(보보 광장 → 내무부), **l'Hexagone**(육각형 → 프랑스 본토). 브뤼셀(Bruxelles)은 EU, 마티뇽과 엘리제의 '동거'(cohabitation)는 좌우 동거 정부를 뜻하죠.\n\n" +
          "일상 대화의 레퍼런스도 있어요. 학교에서 배우는 정형들 — **«Je pense, donc je suis»**(데카르트), **«L'enfer, c'est les autres»**(사르트르) — 은 패러디 형태로 광고와 SNS에 끝없이 변주돼요. 이런 인용의 변형을 알아채는 것이 모어 화자들이 말하는 '문화적 유창함'이에요.",
        examples: [
          { fr: "Bercy prévoit une croissance de 1,2 % pour l'Hexagone.", ko: "경제재정부는 프랑스 본토의 성장률을 1.2%로 전망한다.", note: "환유 두 개가 들어간 전형적 경제 기사 문장" },
          { fr: "L'Élysée et Matignon ne sont pas sur la même ligne.", ko: "대통령실과 총리실의 입장이 엇갈리고 있다.", note: "정치 기사의 표준 문형" },
          { fr: "Je consomme, donc je suis : voilà la devise de notre époque.", ko: "나는 소비한다, 고로 존재한다 — 이것이 우리 시대의 좌우명이다.", note: "데카르트 명제의 패러디 — 칼럼 제목의 단골 수법" },
        ],
        vsEn: "영어 뉴스의 the White House, Downing Street, Wall Street와 같은 메커니즘이라 원리는 익숙할 거예요. 다를 건 목록뿐이니, 프랑스 기관 환유 6~7개를 한 번에 외워두면 르몽드 헤드라인의 안개가 걷힙니다.",
      },
    ],
  },

  {
    slug: "c2-05-traduction",
    level: "C2",
    order: 5,
    title: "번역의 미학 — 한국어와 프랑스어 사이에서",
    titleFr: "L'art de traduire entre le coréen et le français",
    summary: "등가어가 없는 단어, 옮길 수 없는 존댓말, 한국어에 없는 관사와 시제. 두 언어를 잇는 전략으로 레퍼런스 전체를 마무리해요.",
    duration: "약 12분",
    sections: [
      {
        heading: "등가가 없을 때 — 번역은 단어가 아니라 효과를 옮기는 일",
        body:
          "C2의 마지막 질문은 이거예요. **이 말을 한국어로/프랑스어로 어떻게 옮기지?** 그리고 첫 번째 교훈은 — 옮길 수 없는 단어가 생각보다 많다는 것.\n\n" +
          "프랑스어 쪽: **flâner**(목적 없이, 그러나 음미하며 거니는 것 — '산책하다'로는 부족), **terroir**(땅+기후+사람의 손맛이 빚는 그 지역성), **bof**(무관심과 시큰둥함의 의성어 같은 한마디), **voilà**(자, 바로 이거, 그렇지, 끝 — 맥락이 곧 의미인 만능어).\n\n" +
          "한국어 쪽: **정(情)**, **눈치**, **답답하다**, **아깝다** — 프랑스어 한 단어로는 안 잡혀요. 눈치가 없다를 옮기려면 Il ne sait pas lire l'air? 아니죠, 프랑스어로는 Il manque de tact(요령이 없다)나 Il ne capte rien(눈치를 못 챈다)처럼 **상황별로 다른 표현을 골라야** 해요.\n\n" +
          "전략은 셋이에요. ① **풀어쓰기**(flâner → 하릴없이 거닐며 도시를 음미하다), ② **기능 등가**(같은 상황에서 한국어 화자가 실제로 하는 말로 교체), ③ **차용+설명**(테루아처럼 아예 들여오기). 어느 것을 고를지가 번역가의 판단이에요.",
        examples: [
          { fr: "J'ai passé l'après-midi à flâner le long de la Seine.", ko: "오후 내내 센 강변을 하릴없이 거닐며 보냈어요.", note: "flâner — 보들레르의 flâneur(산책자)로 문학 개념이 된 단어" },
          { fr: "Ce vin exprime bien son terroir.", ko: "이 와인은 제 땅의 개성을 잘 담고 있어요.", note: "와인 담론에서는 한국어로도 '테루아'로 차용 정착" },
          { fr: "C'était bien, le film ? — Bof.", ko: "영화 좋았어? — 글쎄, 별로.", note: "bof 한 마디에 담긴 시큰둥함 — 효과로 번역할 수밖에 없어요." },
        ],
        tip: "번역 연습의 왕도는 역번역이에요. 프랑스어 → 한국어로 옮긴 뒤, 며칠 뒤 그 한국어만 보고 다시 프랑스어로. 원문과 비교하면 자신의 '한국어식 프랑스어' 패턴이 정확히 드러나요.",
      },
      {
        heading: "존댓말의 번역 — tu/vous로는 다 담을 수 없는 위계",
        body:
          "한국어 경어법은 **어미, 호칭, 어휘(드시다/주무시다)**의 3중 시스템이지만 프랑스어는 사실상 **tu/vous 스위치 하나**예요. 그래서 한→프 번역에서는 정보가 뭉개지고, 프→한 번역에서는 정보를 **만들어내야** 해요.\n\n" +
          "프→한에서 번역가는 매 대사마다 결정해야 해요. 이 vous는 '하십시오체'인가 '해요체'인가? 이 tu는 반말인가, 가까운 사이의 해요체인가? 근거는 원문에 없어요 — **두 인물의 나이, 관계, 장면의 온도**에서 추론해야 하죠. 소설 중반에 인물들이 vous에서 tu로 넘어가는 순간(tutoiement의 개시)은 한국어로는 '말 놓기' 장면으로 옮기는 게 정석이에요.\n\n" +
          "한→프에서는 반대로, '부장님, 식사하셨어요?'의 존대 정보 대부분이 증발해요. 그 대신 프랑스어는 **조건법(Pourriez-vous...), 어휘 격(레지스터), Monsieur/Madame 호칭**으로 공손의 온도를 재구성해요. C1에서 배운 레지스터 감각이 여기서 번역 기술로 환생하는 거예요.",
        examples: [
          { fr: "Et si on se tutoyait ?", ko: "우리 말 놓을까요?", note: "관계의 전환점 — 한국어 '말 놓다'가 정확한 기능 등가" },
          { fr: "Auriez-vous l'amabilité de me transmettre le dossier ?", ko: "괜찮으시다면 그 서류를 보내주실 수 있을까요?", note: "조건법 + 격식 어휘 = 한국어 '-아 주실 수 있을까요'의 온도" },
          { fr: "Tu viens, papa ?", ko: "아빠, 가요? / 아빠, 갈 거야?", note: "프랑스 아이는 부모에게 tu — 해요체로 옮길지 반말로 옮길지는 번역가의 해석" },
        ],
        pitfall: "프랑스 아이들이 부모에게 tu를 쓴다고 해서 '버릇없는 반말'로 옮기면 오역이에요. tu는 무례가 아니라 친밀의 표지예요. 거꾸로 부부 사이에 vous를 쓰는 (보수적인) 가정도 있는데, 이걸 '존댓말 쓰는 서먹한 부부'로 옮기는 것도 위험해요. 형태가 아니라 관계를 번역하세요.",
      },
      {
        heading: "시제와 관사 — 한국어에 없는 칸을 비우고 채우기",
        body:
          "**시제** — 프랑스어의 imparfait/passé composé(passé simple) 구분은 한국어 '-었-' 하나로 수렴해요. 그래서 프→한에서는 imparfait의 지속·배경감을 **'-고 있었다', '-곤 했다', '-던'** 같은 상(相) 표현으로 살려야 해요. Il pleuvait를 '비가 왔다'로 옮기면 정확하지만 평평하고, '비가 내리고 있었다'로 옮기면 imparfait의 카메라가 살아나죠. 반대로 한→프에서는 한국어에 없는 그 구분을 **번역가가 결정**해야 해요. '어제 책을 읽었다'는 j'ai lu인가 je lisais인가? — 문맥이 답하게 해야 해요.\n\n" +
          "**관사** — 한국어에는 관사가 없으니 프→한에서는 대부분 지워도 돼요. 다만 un/le의 정보가 **'한', '그', '~라는 것'**으로 살아나야 할 때를 놓치면 안 돼요. Une femme est entrée(한 여자가/웬 여자가 들어왔다 — 신정보)와 La femme est entrée(그 여자가 들어왔다 — 구정보)의 차이는 한국어 조사 '이/가'와 '은/는'의 신·구정보 구분과 절묘하게 포개져요.\n\n" +
          "한→프 방향에서 관사는 한국인 최후의 보스죠. 요령은 명사를 만날 때마다 **셀 수 있나(un)? 서로 아는 거나 총칭인가(le)? 일부인가(du)?**를 묻는 3분기 알고리즘을 의식적으로 돌리는 것 — A0에서 시작한 그 관사 이야기가 여기까지 옵니다.",
        examples: [
          { fr: "Il lisait quand je suis entré.", ko: "내가 들어갔을 때 그는 책을 읽고 있었다.", note: "imparfait → '-고 있었다'로 상을 보존" },
          { fr: "Quand j'étais petit, on passait l'été chez ma grand-mère.", ko: "어릴 적 우리는 여름이면 할머니 댁에서 지내곤 했다.", note: "반복의 imparfait → '-곤 했다'" },
          { fr: "Un homme attendait devant la porte. L'homme tenait une lettre.", ko: "한 남자가 문 앞에서 기다리고 있었다. 남자는 편지를 들고 있었다.", note: "un(신정보) → '한/웬', le(구정보) → '은/는'으로 자연스럽게" },
        ],
        vsEn: "영어를 거쳐 번역하는 습관(프→영→한)은 C2에서 버려야 할 마지막 목발이에요. 영어에는 imparfait의 절반(used to/was -ing로 분산)도, tu/vous도 없어서, 영어를 경유하는 순간 뉘앙스가 한 번 더 깎여나가요. 프랑스어와 한국어를 직접 마주 세우세요.",
      },
      {
        heading: "마치며 — A0에서 C2까지, 그리고 그다음",
        body:
          "여기까지 오셨다면, 발음 규칙에서 시작해 관사와 성(性)을 지나, 시제의 숲과 접속법의 안개를 통과해, 문학의 시제와 수사학, 그리고 번역의 문턱까지 — 프랑스어라는 언어의 지도를 한 바퀴 도신 거예요.\n\n" +
          "C2는 끝이 아니라 **자율의 시작**이에요. 이제 문법책이 아니라 작품이 선생님이에요. 라퐁텐을 읽고, 퀘벡 영화를 보고, 르몽드의 환유를 풀고, 마음에 드는 문장을 한국어로 옮겨보세요. 옮기다 막히는 지점이 바로 다음에 배울 것의 좌표예요.\n\n" +
          "이 레퍼런스의 첫 챕터에서 했던 말을 기억하세요 — 여러분은 영어라는 자산을 들고 출발했어요. 이제는 프랑스어 자체가 자산이에요. 스페인어와 이탈리아어의 절반이 이미 눈에 들어올 것이고, 한국어를 보는 눈도 달라졌을 거예요. 언어를 하나 건넌 사람은 모든 언어 앞에서 용감해집니다.\n\n" +
          "Bonne continuation, et bonne route !",
        examples: [
          { fr: "Traduire, c'est faire se rencontrer deux langues sans qu'aucune ne se perde.", ko: "번역이란, 어느 쪽도 잃지 않으면서 두 언어를 만나게 하는 일이다.", note: "이 레퍼런스가 지향해온 태도이기도 해요." },
          { fr: "Ce n'est qu'un au revoir.", ko: "이것은 작별이 아니라 «다시 만날 때까지»일 뿐.", note: "au revoir의 본뜻 — re-voir, 다시 보기. A0의 첫 인사가 마지막 인사가 됩니다." },
        ],
        tip: "다음 걸음 추천: 대역본(bilingue) 문고판으로 단편소설부터, 그리고 좋아하는 한국 소설의 프랑스어 번역본을 원작과 나란히 읽기. 프로 번역가들이 존댓말과 '정'을 어떻게 처리했는지 보는 것만큼 좋은 C2 수업은 없어요.",
      },
    ],
  },
];
