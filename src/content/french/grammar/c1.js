/**
 * C1 — 숙달로 가는 길: 문어의 세계, 레지스터, 뉘앙스
 * 읽고 쓰는 프랑스어의 깊이를 더하는 레벨. 문학·시사 텍스트 해독과 격식 작문 능력을 다져요.
 */
export default [
  {
    slug: "c1-01-passe-simple",
    level: "C1",
    order: 1,
    title: "말로는 안 쓰고 책에만 사는 과거",
    topic: "단순과거 passé simple",
    titleFr: "Le passé simple",
    summary: "소설과 역사책에만 사는 시제. 말할 줄은 몰라도 되지만, 읽을 줄은 알아야 프랑스 문학의 문이 열려요.",
    duration: "약 10분",
    sections: [
      {
        heading: "어디에 쓰는 시제인가 — 현실적인 가이드부터",
        pattern: "passé simple = 문어 전용 과거 (소설·동화·역사 서술)",
        patternKo: "말하기 ✗ · 읽고 알아보기 ○",
        body:
          "의미는 passé composé와 거의 같지만 **서식지**가 달라요. passé simple은 소설·동화·역사 서술 같은 **문어에서만** 살아 있고, 회화에서 쓰면 옛날 말투 흉내처럼 들려요.\n\n" +
          "학습 전략: 활용 암기 대신 **알아보는 능력**만 있으면 돼요. 소설 서술은 3인칭이 대부분이라 il/elle, ils/elles 형태만 익혀도 독서의 90%가 해결돼요.",
        examples: [
          { fr: "Elle ouvrit la porte, entra et s'assit près de la fenêtre.", ko: "그녀는 문을 열고, 들어와, 창가에 앉았다.", note: "ouvrit·entra·s'assit — 사건이 차례로 '탁탁탁' 진행되는 서술의 시제" },
          { fr: "Victor Hugo naquit en 1802 et mourut en 1885.", ko: "빅토르 위고는 1802년에 태어나 1885년에 죽었다.", note: "위인전·역사 서술의 전형적 문체" },
        ],
        tip: "신문 기사도 대부분 passé composé를 써요. passé simple을 만나는 곳은 사실상 '책 속'이라고 보면 됩니다. 다만 어린이 동화책에도 표준으로 쓰이니, 프랑스 아이들은 글을 깨치면서 자연스럽게 이 시제를 읽기로 흡수해요.",
      },
      {
        heading: "규칙 동사의 형태 — 3인칭 중심으로",
        pattern: "-er → -a/-èrent · -ir → -it/-irent · 그 외 → -ut/-urent",
        patternKo: "동사 그룹별 단순과거 규칙 어미 (a/it/ut)",
        body:
          "어미는 동사 그룹에 따라 세 갈래예요.\n\n" +
          "읽기용 핵심: 본문에서 **동사 어간 + a, it, ut** 형태가 보이고 문맥이 과거 서술이면 passé simple이에요. parla(말했다), finit(끝냈다), voulut(원했다)처럼요.",
        table: {
          caption: "규칙 패턴 — 3인칭만 추린 표",
          headers: ["동사", "il/elle", "ils/elles", "뜻"],
          rows: [
            ["parler", "parla", "parlèrent", "말했다"],
            ["entrer", "entra", "entrèrent", "들어갔다"],
            ["finir", "finit", "finirent", "끝냈다"],
            ["répondre", "répondit", "répondirent", "대답했다"],
            ["vouloir", "voulut", "voulurent", "원했다"],
            ["croire", "crut", "crurent", "믿었다"],
          ],
        },
        pitfall: "-ir/-re 계열의 il finit, il répondit는 **직설법 현재와 모양이 똑같아요**. il finit son travail은 '끝낸다'일 수도 '끝냈다'일 수도 있죠. 주변 동사들의 시제와 서술의 흐름으로 판단해야 해요 — 소설 지문이라면 거의 passé simple입니다.",
      },
      {
        heading: "꼭 알아봐야 하는 불규칙 동사들",
        pattern: "fut(être) · eut(avoir) · fit(faire) · vint(venir) · prit(prendre)",
        patternKo: "꼭 알아봐야 하는 최빈출 불규칙 단순과거",
        body:
          "불규칙 형태는 짧고 강렬해서 처음 보면 정체를 못 알아봐요. fut가 être라는 걸 모르면 문장 전체가 무너지죠.\n\n" +
          "최빈출만 추렸으니 이 표는 **읽기용 치트시트**로 두고두고 참조하세요. 패턴의 다섯 개는 한 페이지에 몇 번씩 나오는 단골이에요.",
        table: {
          caption: "불규칙 passé simple — 3인칭 핵심표",
          headers: ["동사", "il/elle", "ils/elles", "뜻"],
          rows: [
            ["être", "fut", "furent", "~였다"],
            ["avoir", "eut", "eurent", "가졌다, ~했다"],
            ["faire", "fit", "firent", "했다, 만들었다"],
            ["aller", "alla", "allèrent", "갔다"],
            ["venir", "vint", "vinrent", "왔다"],
            ["prendre", "prit", "prirent", "잡았다, 탔다"],
            ["dire", "dit", "dirent", "말했다"],
            ["voir", "vit", "virent", "보았다"],
            ["pouvoir", "put", "purent", "할 수 있었다"],
            ["savoir", "sut", "surent", "알게 되었다"],
            ["naître", "naquit", "naquirent", "태어났다"],
            ["mourir", "mourut", "moururent", "죽었다"],
            ["vivre", "vécut", "vécurent", "살았다"],
            ["écrire", "écrivit", "écrivirent", "썼다"],
          ],
        },
        examples: [
          { fr: "Il fut un temps où Paris s'appelait Lutèce.", ko: "파리가 뤼테스라고 불리던 시절이 있었다.", note: "fut = être. il fut un temps는 '옛날 옛적에' 류의 관용 서두" },
          { fr: "Quand elle vit la mer pour la première fois, elle ne dit rien.", ko: "처음으로 바다를 보았을 때, 그녀는 아무 말도 하지 않았다.", note: "vit는 voir의 단순과거 — vivre의 현재 il vit와 동형이니 문맥으로!" },
        ],
        pitfall: "eut는 [y], eurent는 [yʁ]로 읽어요 — eu 철자가 [ø]가 아니라 [y]인 예외예요. 또 il vit는 voir의 단순과거이자 vivre의 현재, il fit 옆의 il fut처럼 한 글자 차이로 동사가 갈리니, 모르는 짧은 동사가 보이면 이 표부터 의심하세요.",
      },
      {
        heading: "텍스트 속에서 — imparfait와의 협업",
        pattern: "imparfait = 배경 · passé simple = 사건",
        patternKo: "배경은 반과거, 사건은 단순과거 (소설 서술의 분업)",
        body:
          "소설에서 **imparfait가 배경(무대, 상태)을 깔면, passé simple이 사건(행동, 전환)을 찍어요.** B1의 passé composé vs imparfait 구도에서 사건 담당만 교체된 셈이에요.\n\n" +
          "짝꿍 선행 시제 **passé antérieur**(quand il eut fini... 끝내자마자)도 가끔 나와요. avoir/être의 단순과거 + 과거분사라는 것만 알아두면 충분해요.",
        examples: [
          { fr: "Il pleuvait depuis trois jours. Soudain, on frappa à la porte.", ko: "사흘째 비가 내리고 있었다. 갑자기 누군가 문을 두드렸다.", note: "imparfait(배경) + passé simple(사건)의 전형적 콤비" },
          { fr: "Dès qu'elle eut terminé sa lettre, elle sortit la poster.", ko: "편지를 다 쓰자마자, 그녀는 부치러 나갔다.", note: "eut terminé = passé antérieur, '~하자마자'의 문어체" },
          { fr: "Le renard se tut et regarda longtemps le petit prince.", ko: "여우는 입을 다물고 어린 왕자를 오래 바라보았다.", note: "se tut ← se taire. 《어린 왕자》도 서술은 전부 passé simple이에요." },
        ],
        vsEn: "영어 소설은 회화에서도 쓰는 단순과거(he opened, she said)로 서술하니 '문어 전용 시제'라는 개념이 없어요. 프랑스어는 같은 과거 사건을 말로는 il a ouvert, 글로는 il ouvrit — 매체에 따라 시제를 갈아입는 언어라는 게 핵심 차이예요.",
      },
    ],
  },

  {
    slug: "c1-02-registres",
    level: "C1",
    order: 2,
    title: "같은 말이 세 가지 옷을 입는다",
    topic: "언어 레지스터(soutenu/familier)",
    titleFr: "Les registres de langue",
    summary: "같은 뜻을 세 가지 격으로 말하는 프랑스어. 상황에 맞는 격 선택은 C1의 진짜 실력이에요.",
    duration: "약 10분",
    sections: [
      {
        heading: "세 개의 층 — 그리고 한국어 존댓말과의 결정적 차이",
        pattern: "soutenu (격식·문어) · courant (표준) · familier (친근·구어)",
        patternKo: "프랑스어의 세 가지 격 (격식·표준·친근)",
        body:
          "한국어는 **어미**(-습니다/-어요/-어)가 격을 결정하지만, 프랑스어는 **단어 선택, 문장 구조, 발음 습관**이 통째로 바뀌어요. 같은 '차'가 automobile → voiture → bagnole로 단어부터 달라지죠.\n\n" +
          "그래서 tu/vous만 잘 고른다고 격이 맞는 게 아니에요. vous를 쓰며 bagnole, bouffer를 섞으면 '고객님, 밥 처드셨어요?' 같은 부조화가 생겨요. C1부터는 **단어마다 격 태그를 함께 외우는 습관**이 필요합니다.",
        examples: [
          { fr: "Je ne sais pas. / Je sais pas. / J'sais pas.", ko: "모르겠습니다. / 몰라요. / 몰라.", note: "같은 문장이 격에 따라 점점 줄어들어요. 마지막은 발음상 '셰파'처럼 들려요." },
          { fr: "Nous allons partir. / On va partir.", ko: "출발하겠습니다. / 우리 갈게.", note: "주어 nous ↔ on 교체도 대표적인 격 신호" },
        ],
        pitfall: "교과서는 courant 위주로 가르치지만, 실제 프랑스인의 일상 대화는 거의 familier예요. 듣기가 안 되는 건 어휘력이 아니라 'familier 층을 배운 적이 없어서'인 경우가 많아요. 쓰지는 않더라도 알아듣기 위해 familier를 의식적으로 학습해야 해요.",
      },
      {
        heading: "같은 뜻, 세 단어 — 레지스터 어휘표",
        pattern: "automobile → voiture → bagnole · ouvrage → livre → bouquin",
        patternKo: "같은 뜻을 격에 따라 다른 단어로 (3단 어휘)",
        body:
          "자주 쓰는 개념일수록 세 층의 단어가 따로 있어요. 아래 표의 familier 단어들은 영화·드라마·일상 대화의 최빈출 어휘이기도 해요.",
        table: {
          caption: "레지스터 3단 어휘 비교",
          headers: ["soutenu (격식)", "courant (표준)", "familier (친근)", "뜻"],
          rows: [
            ["une automobile", "une voiture", "une bagnole, une caisse", "자동차"],
            ["un ouvrage", "un livre", "un bouquin", "책"],
            ["un labeur", "un travail", "un boulot, un taf", "일, 직장"],
            ["se restaurer", "manger", "bouffer", "먹다"],
            ["demeurer", "habiter", "crécher", "살다, 거주하다"],
            ["las", "fatigué", "crevé, naze", "피곤한"],
            ["un vêtement", "des habits", "des fringues", "옷"],
            ["l'argent", "l'argent", "le fric, la thune", "돈"],
            ["un enfant", "un enfant", "un gosse, un gamin", "아이"],
          ],
        },
        examples: [
          { fr: "J'ai trouvé un nouveau boulot.", ko: "나 새 일자리 구했어. (familier)", note: "친구에게는 자연스럽지만 이력서에는 절대 금지" },
          { fr: "Il exerce une activité professionnelle exigeante.", ko: "그는 부담이 큰 직업 활동에 종사하고 있습니다. (soutenu)", note: "공식 문서 톤" },
        ],
        tip: "단어장에 (fam.) (sout.) 태그를 함께 적어두세요. 사전에서도 familier, populaire, vulgaire, littéraire, soutenu 표기를 꼭 확인하는 습관 — C1 어휘 학습의 기본기예요.",
      },
      {
        heading: "문법도 격을 입는다 — ne 탈락, 의문문 3형",
        pattern: "도치 (soutenu) → est-ce que (courant) → 억양만 (familier)",
        patternKo: "격에 따라 달라지는 의문문 세 가지 형태",
        body:
          "어휘만이 아니라 문법 구조 자체가 격 신호예요. **부정의 ne**는 문어에서 필수지만 구어 familier에서는 거의 항상 떨어져요(Je sais pas) — 글에서 빼면 틀리고, 말에서 꼬박꼬박 챙기면 딱딱하게 들려요.\n\n" +
          "**의문문**도 격에 따라 세 가지로 변하고, 의문사가 문장 끝으로 가는 것(Tu vas où ?)도 familier의 특징이에요.",
        table: {
          caption: "의문문의 세 가지 격",
          headers: ["격", "형태", "예문"],
          rows: [
            ["soutenu", "주어-동사 도치", "Où allez-vous ?"],
            ["courant", "est-ce que", "Où est-ce que tu vas ?"],
            ["familier", "억양 / 의문사 후치", "Tu vas où ?"],
          ],
        },
        examples: [
          { fr: "Pourrais-je vous poser une question ?", ko: "질문 하나 드려도 되겠습니까? (soutenu)", note: "도치 + 조건법 = 최고 격식의 공손함" },
          { fr: "J'peux te demander un truc ?", ko: "뭐 하나 물어봐도 돼? (familier)", note: "je의 축약 발음 + truc(거시기, 그거)" },
        ],
      },
      {
        heading: "어떤 상황에 어떤 격을 쓰나",
        pattern: "말하기 = courant · 듣기 = familier까지 · 쓰기 = soutenu까지",
        patternKo: "기능별 격 사용 전략 (비대칭으로 익히기)",
        body:
          "**soutenu**는 DALF 작문·자기소개서·공식 이메일, **courant**은 직장·상점·처음 만난 사람(외국인의 안전지대), **familier**는 친구·또래 — 단 vulgaire(비속어)로 넘어가는 단어는 따로 표시해 익히세요.\n\n" +
          "현실적인 조언은 패턴의 **비대칭 전략**이에요. familier를 어설프게 쓰면 어색하지만, 못 알아들으면 대화가 끊기니까요.",
        examples: [
          { fr: "Je vous prie d'agréer, Madame, l'expression de mes salutations distinguées.", ko: "삼가 깊은 경의를 표합니다. (공식 편지의 정형 맺음말)", note: "직역하면 과장 같지만 프랑스 격식 편지의 표준 클리셰예요." },
          { fr: "Ça te dit d'aller boire un verre ?", ko: "한잔하러 갈래?", note: "ça te dit = 친근한 제안의 만능 표현" },
        ],
        vsEn: "영어도 격식 차이는 있지만(purchase/buy, kids/children) 층이 흐릿한 편이에요. 프랑스어는 사전이 단어마다 격 라벨을 붙일 만큼 층이 제도화되어 있어요. 한국어 화자로서 '격을 가려 쓰는 감각' 자체는 이미 갖고 있으니, 그 감각을 어미가 아니라 어휘에 적용한다고 생각하면 빨라요.",
      },
    ],
  },

  {
    slug: "c1-03-argumentation",
    level: "C1",
    order: 3,
    title: "반대 입장을 안 쓰면 미완성 글",
    topic: "논증·dissertation 구조",
    titleFr: "L'argumentation et la dissertation",
    summary: "thèse-antithèse-synthèse. 프랑스 학교가 가르치는 사고의 틀과, DALF C1 작문에 바로 쓰는 표현들을 익혀요.",
    duration: "약 11분",
    sections: [
      {
        heading: "thèse — antithèse — synthèse: 프랑스식 사고의 틀",
        pattern: "problématique → thèse(정) → antithèse(반) → synthèse(합)",
        patternKo: "문제 제기 후 정-반-합으로 전개하는 글의 틀",
        body:
          "프랑스 dissertation은 주장을 펼친 뒤 **일부러 반대 입장을 충실히 검토**하고, 두 입장을 넘어서는 종합으로 마무리해요. 한국식 서론-본론-결론과 달리, **반대 입장을 다루지 않으면 미완성 글**로 평가받아요.\n\n" +
          "또 하나의 필수품이 **problématique**(문제 제기) — 주제를 긴장이 있는 질문으로 다듬어 서론에 명시해야 해요. '재택근무에 대하여'가 아니라 '재택근무는 자유의 확장인가, 노동의 침투인가?'처럼요.",
        examples: [
          { fr: "Dans quelle mesure le télétravail transforme-t-il notre rapport au travail ?", ko: "재택근무는 우리의 노동관을 어디까지 변화시키는가?", note: "dans quelle mesure(어느 정도까지)는 problématique의 단골 틀" },
          { fr: "Il convient de s'interroger sur les limites de ce modèle.", ko: "이 모델의 한계에 대해 질문을 던져볼 필요가 있다.", note: "il convient de + inf. = '~할 필요가 있다'의 격식형" },
        ],
        tip: "DALF 작문에서 가장 흔한 감점은 문법이 아니라 구조예요. 쓰기 전에 plan(개요)을 짜고, 각 부(partie)를 두세 단락으로, 단락마다 주장 하나 + 근거/예시 하나 — 이 규율만 지켜도 점수대가 달라져요.",
      },
      {
        heading: "서론과 전개 — 글을 여는 표현들",
        pattern: "서론 = 도입 → problématique 제시 → annonce du plan",
        patternKo: "서론 3단계 (도입·문제 제기·전개 예고)",
        body:
          "서론 3단계의 정형 표현을 통째로 외워두면 시험장에서 시간을 벌어요.\n\n" +
          "본론 전개에서는 단락 사이의 **connecteurs**가 이정표예요. premièrement만 반복하면 단조로우니 en premier lieu, par ailleurs, en outre, enfin처럼 변주하세요.",
        examples: [
          { fr: "De nos jours, la question de l'intelligence artificielle suscite de vifs débats.", ko: "오늘날 인공지능 문제는 격렬한 논쟁을 불러일으키고 있다.", note: "susciter de vifs débats — 서론 도입의 단골 콜로케이션" },
          { fr: "Nous verrons dans un premier temps..., avant d'examiner dans un second temps...", ko: "먼저 ~을 살펴본 뒤, 이어서 ~을 검토할 것이다.", note: "annonce du plan(전개 예고)의 정형 틀" },
          { fr: "Force est de constater que les mentalités évoluent lentement.", ko: "인식이 더디게 변하고 있음을 인정하지 않을 수 없다.", note: "force est de constater que = '~라는 사실은 부정할 수 없다'" },
          { fr: "Il en va de même pour l'éducation.", ko: "교육에 대해서도 사정은 마찬가지다.", note: "앞 논거를 다른 영역으로 확장할 때" },
        ],
      },
      {
        heading: "양보와 반박 — certes... mais의 기술",
        pattern: "Certes ..., mais ... (양보 → 반박)",
        patternKo: "물론 ~이지만 ... (양보 후 반박하기)",
        body:
          "프랑스식 논증의 꽃은 **양보(concession) 후 반박(réfutation)**이에요. 신호탄 **certes**(물론)가 보이면 100% 뒤에 mais나 cependant이 따라온다고 봐도 됩니다.\n\n" +
          "반박 강도 조절: **cependant/toutefois**(중립), **néanmoins**(그럼에도), **en revanche**(대조), **or**(논리 전환의 결정적 한 수 — 삼단논법에서 새 전제를 들이미는 접속사예요).",
        examples: [
          { fr: "Certes, le numérique facilite l'accès au savoir. Mais cet accès reste profondément inégal.", ko: "물론 디지털은 지식 접근을 쉽게 해준다. 그러나 그 접근은 여전히 극도로 불평등하다.", note: "certes... mais — 양보-반박의 골격" },
          { fr: "Si l'on ne peut nier les avantages de cette réforme, il n'en demeure pas moins qu'elle fragilise les plus précaires.", ko: "이 개혁의 장점을 부정할 수는 없다 해도, 그것이 가장 취약한 이들을 흔든다는 사실에는 변함이 없다.", note: "il n'en demeure pas moins que — C1 작문의 고득점 표현" },
          { fr: "D'aucuns affirment que la croissance résoudra tout. Or, les faits démontrent le contraire.", ko: "어떤 이들은 성장이 모든 것을 해결하리라 주장한다. 그런데 사실은 그 반대를 입증한다.", note: "d'aucuns = certains의 문어체, or = 논리의 반전 스위치" },
        ],
        pitfall: "or를 영어 or(또는)로 읽으면 문장이 와르르 무너져요. 프랑스어 접속사 or는 '그런데 (사실은)'이라는 논리 전환이에요. '또는'은 ou. 한 글자 차이로 품사도 뜻도 완전히 달라요.",
      },
      {
        heading: "결론 — 닫고, 열기",
        pattern: "결론 = bilan (최종 답변) + ouverture (더 넓은 질문으로 열기)",
        patternKo: "결론 쓰기 — 최종 답변으로 닫고 새 질문으로 열기",
        body:
          "요약만 하면 닫힌 글, 새 주제를 갑자기 던지면 산만한 글 — 기존 논의에서 자연스럽게 이어지는 한 걸음이 좋은 **ouverture**예요.\n\n" +
          "결론 신호어는 **en définitive, en somme, au terme de cette réflexion** 등 — 구어적인 au final이나 단순 나열의 finalement보다 격이 높아요.",
        examples: [
          { fr: "En définitive, le télétravail apparaît moins comme une révolution que comme un révélateur.", ko: "결국 재택근무는 혁명이라기보다 (기존 문제를 드러내는) 리트머스지에 가까워 보인다.", note: "moins comme A que comme B — 세련된 결론 구문" },
          { fr: "Reste à savoir si ces évolutions profiteront au plus grand nombre.", ko: "이 변화가 다수에게 이로울지는 두고 볼 일이다.", note: "reste à savoir si — ouverture의 단골 마무리" },
        ],
        vsEn: "영미식 에세이는 서론에서 결론(thesis statement)을 못 박고 시작하지만, 프랑스식 dissertation은 결론을 끝까지 아껴두고 변증법적 과정을 보여주는 데 무게를 둬요. 영어 에세이 훈련이 된 분일수록 '결론을 먼저 말해버리는' 습관을 의식적으로 눌러야 해요.",
      },
    ],
  },

  {
    slug: "c1-04-participiales",
    level: "C1",
    order: 4,
    title: "\"밤이 내리자\" — 문장을 접는 기술",
    topic: "분사구문·절대분사구문",
    titleFr: "Les propositions participiales",
    summary: "Une fois le travail terminé... 접속사도 관계대명사도 없이 문장을 접어 넣는, 신문·논문 프랑스어의 핵심 기술이에요.",
    duration: "약 10분",
    sections: [
      {
        heading: "왜 압축하는가 — 문어 프랑스어의 미학",
        pattern: "Comme il était fatigué, ... → Fatigué, il est rentré",
        patternKo: "종속절을 분사로 접어 넣기",
        body:
          "격식 문어는 **종속절을 분사 구조로 접어 넣어** 밀도를 높여요. 신문·논문·행정 문서의 기본 문체라, C1 독해 속도가 안 나오는 큰 이유가 이 압축 구조를 펼쳐 읽는 훈련 부족이에요.\n\n" +
          "재료는 셋: ① 현재분사(-ant), ② 과거분사, ③ 독자적 주어를 가진 **절대분사구문**. 목표는 **읽을 때 즉시 펼치기, 쓸 때 한 단계 접기**예요.",
        examples: [
          { fr: "Ne sachant que répondre, elle garda le silence.", ko: "뭐라 답해야 할지 몰라, 그녀는 침묵을 지켰다.", note: "= Comme elle ne savait pas... 현재분사의 이유 표현" },
          { fr: "Arrivé tard, il n'a pas pu assister à la réunion.", ko: "늦게 도착해서 그는 회의에 참석하지 못했다.", note: "과거분사 하나가 절 하나를 대신해요. 분사의 주어 = 주절의 주어" },
        ],
      },
      {
        heading: "절대분사구문 — 분사가 자기 주어를 데리고 올 때",
        pattern: "une fois + 명사 + 과거분사 (Une fois le travail terminé, ...)",
        patternKo: "분사가 주절과 다른 자기 주어를 가짐",
        body:
          "**La nuit tombée, les rues se vident.**(밤이 내리자, 거리가 빈다.) — la nuit는 주절이 아니라 분사 tombée만의 주어예요. 시간·이유의 부사절이 접속사 없이 통째로 압축된 거죠.\n\n" +
          "가장 생산적인 패턴이 **une fois + 명사 + 과거분사**예요. 과거분사는 자기 주어의 성·수에 일치해요: Une fois la décision **prise**(la décision이 여성이라 prise).",
        examples: [
          { fr: "Une fois le travail terminé, nous pourrons partir tranquilles.", ko: "일이 끝나고 나면, 우리는 마음 편히 떠날 수 있을 거예요.", note: "une fois + 명사 + p.p. — 최빈출 절대분사 패턴" },
          { fr: "La nuit tombée, le village retrouva son calme.", ko: "밤이 내리자, 마을은 고요를 되찾았다.", note: "분사의 주어(la nuit) ≠ 주절의 주어(le village)" },
          { fr: "Le président ayant démissionné, de nouvelles élections furent organisées.", ko: "대통령이 사임함에 따라, 새 선거가 치러졌다.", note: "ayant + p.p. = 완료 분사. 신문 문체의 단골" },
          { fr: "L'accord signé, les deux délégations se sont séparées.", ko: "협정이 서명되자, 양측 대표단은 헤어졌다.", note: "Une fois를 생략한 더 압축된 형태" },
        ],
        pitfall: "절대분사구문을 한국어로 직역하면 '밤이 떨어진, 마을은...'처럼 깨져요. 읽을 때 머릿속에서 **quand/comme/après que 절로 펼치는** 변환을 습관화하세요. La nuit tombée → Quand la nuit est tombée. 이 펼치기가 자동화되면 르몽드 독해 속도가 눈에 띄게 올라가요.",
        enParallel: {
          rows: [
            { en: "**The meeting over**, they left.", fr: "**La réunion terminée**, ils sont partis.", ko: "회의가 끝나자, 그들은 떠났다." },
            { en: "**Weather permitting**, we'll go out.", fr: "**Le temps le permettant**, nous sortirons.", ko: "날씨가 허락하면, 우리는 나갈 거예요." },
          ],
          note: "주어가 다른 분사구문(절대구문)이 영어에도 있어요(The meeting over…). 명사 + 분사로 배경 상황을 압축하는 구조가 평행.",
        },
      },
      {
        heading: "굳어진 분사 표현들 — 전치사가 된 분사",
        pattern: "étant donné (que) · y compris · excepté · cela dit · le cas échéant",
        patternKo: "전치사·접속사처럼 굳어진 분사 표현 (성·수 불변)",
        body:
          "일부 분사구문은 굳어서 전치사·접속사처럼 쓰여요: **étant donné (que)**(~이므로), **y compris**(~을 포함하여), **excepté**(~을 제외하고), **cela dit**(그렇긴 하지만), **le cas échéant**(필요하다면 — 행정 문서 최빈출). 분석하지 말고 덩어리로 외우세요.\n\n" +
          "굳어진 표현이라 대부분 **성·수 일치도 하지 않아요**: étant donné la situation에서 donné는 불변이에요.",
        examples: [
          { fr: "Étant donné la complexité du dossier, le jugement a été reporté.", ko: "사안의 복잡성을 고려하여, 판결이 연기되었다.", note: "étant donné = 격식 문어의 '~이므로'" },
          { fr: "Tous les employés, y compris la direction, sont concernés.", ko: "경영진을 포함한 전 직원이 해당된다.", note: "y compris — 불변" },
          { fr: "Vous pourrez, le cas échéant, faire appel de cette décision.", ko: "필요한 경우, 이 결정에 불복 신청을 하실 수 있습니다.", note: "행정 편지의 시그니처 표현" },
        ],
        tip: "cela dit는 회화에서도 아주 자주 쓰는 '그렇긴 한데'예요. 분사구문 출신 표현 중 말하기로 가져갈 수 있는 몇 안 되는 가성비 표현이니 입에 붙여두세요.",
      },
      {
        heading: "현재분사 vs 제롱디프 vs 동사적 형용사 — 마지막 정리",
        pattern: "en + -ant (제롱디프) · -ant 불변 (현재분사) · -ant 일치 (형용사)",
        patternKo: "-ant 형태의 세 갈래 구별 (제롱디프·분사·형용사)",
        body:
          "-ant 형태의 세 갈래를 C1에서 마무리해둘 지점이에요. **제롱디프**는 주절 주어의 동시 동작·수단, **현재분사**는 절을 압축하며 불변, **동사적 형용사**는 성·수 일치를 해요.\n\n" +
          "일부는 철자도 달라요: fatig**ant**(형용사) vs en fatig**uant**(분사), provocant vs provoquant.",
        examples: [
          { fr: "Les passagers ayant un billet électronique peuvent embarquer directement.", ko: "전자 티켓을 소지한 승객은 바로 탑승할 수 있다.", note: "ayant... = qui ont...의 압축. 안내문의 표준 문체" },
          { fr: "C'est une expérience fatigante, mais enrichissante.", ko: "피곤하지만 얻는 게 많은 경험이에요.", note: "fatigante — 형용사이므로 여성형 일치, 철자에 u 없음" },
        ],
        vsEn: "영어도 분사구문을 쓰지만(The work done, we left) 현대 영어에서는 다소 옛스럽죠. 프랑스어에서는 절대분사구문이 지금도 격식 문어의 현역이라는 점, 그리고 영어 -ing과 달리 프랑스어 -ant은 진행형(be -ing)으로는 절대 쓰이지 않는다는 점을 같이 기억해두세요.",
      },
    ],
  },

  {
    slug: "c1-05-nuances",
    level: "C1",
    order: 5,
    title: "'알다'가 둘로 갈라지는 언어",
    topic: "유의어 뉘앙스 savoir/connaître",
    titleFr: "Les nuances lexicales",
    summary: "savoir/connaître, amener/apporter, retourner/revenir/rentrer, an/année. 한국어 번역이 같아서 평생 헷갈리는 짝들을 한 번에 정리해요.",
    duration: "약 11분",
    sections: [
      {
        heading: "savoir vs connaître — 정보인가, 친숙함인가",
        pattern: "savoir + 절/동사원형 (정보·방법) · connaître + 명사 (친숙함)",
        patternKo: "정보·방법으로 알면 savoir, 경험으로 알면 connaître",
        body:
          "둘 다 '알다'라서 끝까지 헷갈리는 1순위 짝이에요. **savoir**는 머리로 아는 정보·사실·방법(Je sais nager), **connaître**는 경험으로 아는 친숙함 — 사람, 장소, 작품은 무조건 connaître예요(Je connais Marie).\n\n" +
          "C1다운 디테일: 복합과거에서 의미가 변해요. **j'ai su** = '알게 되었다', **j'ai connu** = '처음 만났다, 겪었다'.",
        examples: [
          { fr: "Je sais où elle habite, mais je ne connais pas son quartier.", ko: "그녀가 어디 사는지는 알지만(정보), 그 동네를 가본 적은 없어요(경험).", note: "한 문장 안에서 두 '알다'의 분업" },
          { fr: "J'ai su la nouvelle par hasard.", ko: "그 소식을 우연히 알게 됐어요.", note: "passé composé의 savoir = 앎의 '발생'" },
          { fr: "Elle a connu son mari à Lyon.", ko: "그녀는 남편을 리옹에서 만났어요.", note: "connaître의 passé composé = 만남의 시작" },
        ],
        tip: "헷갈리면 뒤를 보세요. **절이나 동사원형이면 savoir, 명사면 connaître** — 이 형태 규칙만으로 90%가 해결돼요. 나머지 10%(savoir + 명사: Je sais ma leçon 등)는 '암기해서 외고 있다'는 특수한 뜻이에요.",
        enParallel: {
          rows: [
            { en: "I **know** the answer.", fr: "Je **sais** la réponse.", ko: "나는 답을 알아요. (정보)" },
            { en: "I **know** Paris.", fr: "Je **connais** Paris.", ko: "나는 파리를 알아요. (경험·친숙)" },
          ],
          note: "영어 know 하나가 프랑스어에선 savoir(정보·사실·방법)와 connaître(사람·장소를 겪어 앎)로 갈라져요. 영어로는 같은 단어라 더 헷갈리는 지점.",
        },
      },
      {
        heading: "amener / emmener / apporter / emporter — 사람이냐 물건이냐, 오느냐 가느냐",
        pattern: "mener = 사람 · porter = 물건 × a- = 이쪽으로 · em- = 저쪽으로",
        patternKo: "데려오다/가져가다 — 사람·물건 × 방향의 2×2 구별",
        body:
          "네 동사가 전부 '데려가다/가져가다' 계열이라 대혼란이 오지만, **두 축**으로 가르면 단순해요. mener 계열은 스스로 움직이는 대상(사람·동물), porter 계열은 들고 옮기는 물건. a- 계열은 도착점 쪽으로(데려오다), em- 계열은 떠나는 쪽으로(데리고 떠나다).\n\n" +
          "테이크아웃의 **à emporter**(지니고 떠나기 = 포장)가 em- 방향성의 완벽한 예시예요.",
        table: {
          caption: "2×2로 끝내는 네 동사",
          headers: ["", "사람·동물 (mener)", "물건 (porter)"],
          rows: [
            ["이쪽으로 (a-)", "amener — 데려오다", "apporter — 가져오다"],
            ["저쪽으로 (em-)", "emmener — 데려가다", "emporter — 가져가다"],
          ],
        },
        examples: [
          { fr: "Tu peux amener ta sœur à la fête.", ko: "파티에 네 여동생 데려와도 돼.", note: "사람 + 이쪽으로 = amener" },
          { fr: "N'oublie pas d'apporter une bouteille de vin.", ko: "와인 한 병 가져오는 거 잊지 마.", note: "물건 + 이쪽으로 = apporter" },
          { fr: "Je t'emmène à l'aéroport demain.", ko: "내일 내가 공항까지 데려다줄게.", note: "사람을 데리고 떠남 = emmener" },
          { fr: "Un café à emporter, s'il vous plaît.", ko: "커피 한 잔 포장해 주세요.", note: "emporter = 지니고 떠나다" },
        ],
        pitfall: "실제 프랑스인들도 물건에 amener를 쓰는 등 구어에서는 경계가 흐려져 있어요. 하지만 시험·격식 문어에서는 구별이 살아 있고, apporter 자리에 emmener를 쓰는 류의 교차 실수는 구어에서도 어색하게 들려요. 표의 2×2를 기준선으로 잡아두세요.",
      },
      {
        heading: "retourner / revenir / rentrer — 세 개의 '돌아가다'",
        pattern: "revenir = 화자 쪽으로 · retourner = 제3의 장소로 다시 · rentrer = 본거지로 (귀가·귀국)",
        patternKo: "기준점에 따라 갈리는 세 가지 '돌아가다'",
        body:
          "기준점이 어디냐가 전부예요. **revenir**는 말하는 사람이 있는 곳으로(Reviens vite !), **retourner**는 전에 가봤던 제3의 장소로 다시(retourner au Japon — 화자는 지금 일본에 없음), **rentrer**는 집·고향·모국으로 — 한국어 '귀(歸)' 계열(귀가, 귀국)과 잘 포개져요.\n\n" +
          "같은 상황도 기준점 따라 달라져요. 파리 여행 중인 내가 한국 친구에게: Je rentre dimanche. 파리 친구가 나에게: Tu reviendras ? 나중의 나: J'aimerais retourner à Paris.",
        examples: [
          { fr: "Attends-moi ici, je reviens dans cinq minutes.", ko: "여기서 기다려, 5분 뒤에 돌아올게.", note: "지금 이 지점으로 = revenir" },
          { fr: "Nous sommes retournés dans le village de notre enfance.", ko: "우리는 어린 시절의 마을에 다시 가보았다.", note: "제3의 장소로 다시 = retourner" },
          { fr: "Il est tard, je dois rentrer.", ko: "늦었네, 집에 가야겠어.", note: "rentrer는 목적지를 생략해도 '귀가'로 통해요." },
        ],
      },
      {
        heading: "an / année — 그리고 jour/journée, soir/soirée",
        pattern: "an/jour/soir = 단위·눈금 (숫자와) · année/journée/soirée = 내용·지속 (형용사와)",
        patternKo: "시간 명사의 단위형 vs 내용·지속형 구별",
        body:
          "**an**은 셀 수 있는 단위·눈금(deux ans, J'ai trente ans), **année**는 그 시간의 내용물·경험(une bonne année, toute l'année, cette année)이에요.\n\n" +
          "같은 분업이 jour/journée, soir/soirée, matin/matinée에도 적용돼요. Bonsoir(만났을 때) vs **Bonne soirée**(헤어질 때 — '남은 저녁 잘 보내요').",
        table: {
          caption: "단위형 vs 지속형",
          headers: ["단위·눈금", "내용·지속", "대표 예"],
          rows: [
            ["an", "année", "deux ans / une année difficile"],
            ["jour", "journée", "trois jours / toute la journée"],
            ["soir", "soirée", "ce soir / Bonne soirée !"],
            ["matin", "matinée", "demain matin / en fin de matinée"],
          ],
        },
        examples: [
          { fr: "J'apprends le français depuis trois ans.", ko: "프랑스어를 배운 지 3년 됐어요.", note: "숫자 + an" },
          { fr: "Cette année a été riche en émotions.", ko: "올해는 감정적으로 다사다난한 해였어요.", note: "내용을 평가 — année" },
          { fr: "Bonne journée !", ko: "좋은 하루 보내세요!", note: "헤어질 때의 인사 — 하루의 '내용물'을 빌어줘요." },
        ],
        vsEn: "영어는 year 하나, day 하나로 끝나서 이 구별 자체가 없어요. 감을 잡는 한국어 보조선: an은 '3년, 30세'처럼 **숫자에 붙는 단위**, année는 '한 해, 그 해'처럼 **'해'라고 풀어 말하고 싶은 것** — 이 대응이 의외로 잘 맞아요.",
      },
    ],
  },

  {
    slug: "c1-06-idiomatiques",
    level: "C1",
    order: 6,
    title: "바퀴벌레를 가지면 우울하다고?",
    topic: "관용 표현 expressions idiomatiques",
    titleFr: "Les expressions idiomatiques",
    summary: "바퀴벌레가 우울이 되고, 토끼를 놓으면 바람맞히는 것이 되는 세계. 표현 뒤의 문화적 이미지를 함께 읽어요.",
    duration: "약 10분",
    sections: [
      {
        heading: "관용구를 대하는 자세 — 그리고 기분의 표현들",
        pattern: "avoir le cafard = 우울하다 · avoir la pêche = 컨디션 최고 · être dans la lune = 멍 때리다",
        patternKo: "기분·상태를 그리는 관용구 (우울·생기·딴생각)",
        body:
          "관용 표현은 단어 뜻의 합이 아니에요. avoir le cafard(바퀴벌레를 가지다)의 실제 뜻은 '**우울하다**' — 보들레르가 《악의 꽃》에서 퍼뜨린 이미지로 알려져 있어요.\n\n" +
          "관용구는 **이미지와 유래를 함께 외울 때** 기억에 남아요. 이 챕터는 기분·동물·음식·신체 계열로 묶어 소개할게요.",
        examples: [
          { fr: "Depuis qu'elle est partie, j'ai le cafard.", ko: "그녀가 떠난 뒤로 마음이 울적해요.", note: "직역: 바퀴벌레를 갖고 있다" },
          { fr: "T'as la pêche aujourd'hui !", ko: "너 오늘 컨디션 좋아 보인다!", note: "familier한 말투와 잘 어울리는 표현" },
          { fr: "Excuse-moi, j'étais dans la lune.", ko: "미안, 잠깐 딴생각하고 있었어.", note: "수업·회의 중 멍 때림의 표준 변명" },
        ],
        vsEn: "영어에도 같은 그림의 표현이 있을 때가 있어요 — être dans la lune은 영어 to be over the moon(너무 기쁘다)과 그림은 비슷한데 뜻이 전혀 달라요. '아는 영어 관용구와 닮았다'는 이유로 뜻을 추측하는 건 위험합니다.",
      },
      {
        heading: "동물의 이미지 — 토끼, 고양이, 닭",
        pattern: "poser un lapin = 바람맞히다 · donner sa langue au chat = 모르겠다, 항복",
        patternKo: "동물 이미지 관용구 (바람맞히다·항복하다)",
        body:
          "**poser un lapin**(토끼를 놓다 → 바람맞히다), **donner sa langue au chat**(혀를 고양이에게 주다 → 항복), **avoir un chat dans la gorge**(목에 고양이 → 목이 잠기다 — 영어는 개구리를 넣죠).\n\n" +
          "**quand les poules auront des dents**(닭에게 이가 나면)는 한국어 '해가 서쪽에서 뜨면'의 프랑스 버전이에요.",
        examples: [
          { fr: "Il m'a posé un lapin, je l'ai attendu une heure au café.", ko: "걔가 날 바람맞혔어. 카페에서 한 시간을 기다렸다니까.", note: "데이트·약속 불발의 표준 표현" },
          { fr: "Alors, la réponse ? — Je donne ma langue au chat !", ko: "자, 정답은? — 모르겠다, 항복!", note: "퀴즈 상황의 고정 표현" },
          { fr: "Il s'excusera quand les poules auront des dents.", ko: "걔가 사과하는 건 해가 서쪽에서 뜰 때나 가능할걸.", note: "미래시제 auront과 함께 통째로 굳은 형태" },
        ],
        tip: "관용구는 형태가 화석처럼 굳어 있어요. poser un lapin을 poser un petit lapin으로 바꾸는 식의 변형은 불가능해요. 동사 활용 말고는 통째로, 전치사까지 그대로 외우세요.",
      },
      {
        heading: "음식의 이미지 — 역시 프랑스",
        pattern: "raconter des salades = 둘러대다 · c'est du gâteau = 식은 죽 먹기",
        patternKo: "음식 이미지 관용구 (둘러대다·식은 죽 먹기)",
        body:
          "음식의 나라답게 풍년이에요. **raconter des salades**(샐러드를 이야기하다 → 둘러대다), **mettre son grain de sel**(소금 한 톨 넣다 → 참견하다), **les carottes sont cuites**(당근이 다 익었다 → 이제 끝났다).\n\n" +
          "**ce n'est pas de la tarte**(타르트가 아니다 → 만만치 않다)의 반대는 c'est du gâteau — 영어 a piece of cake와 그림이 같죠.",
        examples: [
          { fr: "Arrête de raconter des salades, dis-moi la vérité.", ko: "둘러대지 말고 사실대로 말해.", note: "복수형 des salades로 써요." },
          { fr: "Il faut toujours qu'il mette son grain de sel dans nos discussions.", ko: "걔는 우리 얘기에 꼭 끼어들어 한마디 해야 직성이 풀려.", note: "il faut que + 접속법과 자주 결합하는 짜증 섞인 어투" },
          { fr: "Apprendre le coréen, ce n'est pas de la tarte !", ko: "한국어 배우기, 그거 보통 일이 아니에요!", note: "프랑스인이 한국어를 배우면 이렇게 말하겠죠." },
        ],
        etym: "salade는 라틴어 sal(소금)에서 왔어요 — 영어 salad, salary(소금 배급에서 유래한 봉급), sauce가 모두 한 식구예요. '소금 친 것'이라는 뿌리를 알면 grain de sel(소금 한 톨)과 salades(버무린 말)가 한 그림으로 묶여요.",
      },
      {
        heading: "신체의 이미지 — 그리고 사용 설명서",
        pattern: "coûter les yeux de la tête = 터무니없이 비싸다 · casser les pieds = 귀찮게 하다",
        patternKo: "신체 이미지 관용구 (비싸다·귀찮게 하다)",
        body:
          "**coûter les yeux de la tête**(눈이 빠질 만큼 비싸다 — '눈이 튀어나올 가격'과 통하죠), **avoir le cœur sur la main**(심장을 손에 → 잘 베푼다), **casser les pieds**(발을 부수다 → 귀찮게 하다).\n\n" +
          "사용 전략: **이해는 최대로, 사용은 보수적으로.** 대부분 familier라 격식 작문에는 못 쓰고, 프랑스인이 쓰는 걸 들은 맥락 그대로 따라 쓰며 늘려가는 게 정석입니다.",
        examples: [
          { fr: "Ce sac coûte les yeux de la tête.", ko: "이 가방, 눈 튀어나오게 비싸요.", note: "쇼핑 회화의 단골" },
          { fr: "Elle a le cœur sur la main : elle aide tout le monde.", ko: "그녀는 정말 베푸는 사람이에요. 모두를 도와줘요.", note: "사람 칭찬의 고정 표현" },
          { fr: "Arrête de me casser les pieds avec tes questions !", ko: "질문 좀 그만해, 귀찮아 죽겠네!", note: "친한 사이에서만. 더 거친 변형들도 있으니 주의" },
        ],
        pitfall: "한국어 관용구를 프랑스어로 직역하는 것도 똑같이 위험해요. '미역국을 먹다', '발이 넓다'를 단어 그대로 옮기면 전혀 통하지 않아요. '발이 넓다'에 해당하는 프랑스어는 avoir le bras long(팔이 길다 — 인맥·영향력이 있다) — 신체 부위부터 달라요.",
      },
    ],
  },
];
