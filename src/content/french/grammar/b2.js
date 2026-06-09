/**
 * B2 중상급 — 뉘앙스와 격식의 세계
 * 접속법의 완성, 가정문 3종, 논리적 글쓰기. DELF B2와 직결되는 실전 레벨이에요.
 */
export default [
  {
    slug: "b2-01-subjonctif-advanced",
    level: "B2",
    order: 1,
    title: "접속법 심화 — 접속법 과거와 접속사들",
    titleFr: "Le subjonctif : approfondissement",
    summary: "subjonctif passé, bien que·pour que·avant que 같은 접속사, 그리고 penser que 부정형의 미묘한 갈림길까지.",
    duration: "약 11분",
    sections: [
      {
        heading: "접속법 과거 — 평가 시점보다 앞선 일",
        pattern: "avoir/être 접속법 현재 + 과거분사 (que tu sois venu)",
        body:
          "평가하는 내용이 **이미 일어난 일**이면 **접속법 과거(subjonctif passé)**를 써요. 복합과거의 접속법 버전인 셈이죠.\n\n" +
          "Je suis content que tu **sois venu**(네가 와 줘서 기뻐) — 기쁜 건 지금, 온 건 그 전. **주절과 종속절의 시간 차이**가 핵심이에요.",
        table: {
          caption: "접속법 현재 vs 접속법 과거",
          headers: ["", "접속법 현재", "접속법 과거"],
          rows: [
            ["finir", "que je finisse", "que j'aie fini"],
            ["partir", "que je parte", "que je sois parti(e)"],
            ["faire", "qu'il fasse", "qu'il ait fait"],
          ],
        },
        examples: [
          { fr: "Je suis désolé que tu n'aies pas pu venir.", ko: "네가 못 와서 아쉬워." },
          { fr: "C'est dommage qu'ils soient déjà partis.", ko: "그들이 벌써 떠났다니 아쉽네요." },
          { fr: "Je ne crois pas qu'elle ait dit ça.", ko: "그녀가 그런 말을 했다고는 생각하지 않아요." },
        ],
        tip: "고르는 기준은 단순해요. que절의 일이 주절과 동시이거나 나중이면 접속법 현재, 먼저 일어났으면 접속법 과거. 시제가 둘뿐이라 직설법보다 오히려 단순합니다(문어의 접속법 반과거는 C1 영역이에요).",
      },
      {
        heading: "접속법을 부르는 접속사 — bien que, pour que, avant que...",
        pattern: "bien que · pour que · avant que · jusqu'à ce que · à moins que + 접속법",
        body:
          "B2에서는 **접속사**가 접속법을 부르는 경우를 정리해요. **양보**(bien que, quoique), **목적**(pour que, afin que), **시간**(avant que, jusqu'à ce que), **조건·제외**(à condition que, à moins que, sans que).\n\n" +
          "공통점은 '아직 사실로 확정되지 않았거나, 사실 여부와 무관하게 틀로 제시되는' 내용이라는 것이에요.",
        examples: [
          { fr: "Bien qu'il soit fatigué, il continue à travailler.", ko: "피곤하긴 하지만 그는 계속 일해요." },
          { fr: "Je t'explique encore une fois pour que ce soit clair.", ko: "확실해지도록 한 번 더 설명할게." },
          { fr: "Rentrons avant qu'il ne pleuve.", ko: "비가 오기 전에 들어가요.", note: "avant que 뒤의 ne는 부정이 아니라 격식 장치(허사 ne)" },
          { fr: "Restez ici jusqu'à ce que je revienne.", ko: "제가 돌아올 때까지 여기 계세요." },
        ],
        pitfall: "**après que(~한 후에)는 원칙상 직설법**이에요 — 이미 일어난 사실이니까요: après qu'il est parti. 짝꿍 avant que(접속법)에 이끌려 프랑스인들조차 접속법을 쓰곤 하지만, 시험·격식 작문에서는 직설법이 정답입니다. avant ↔ après가 법(法)까지 가르는 거예요.",
        tip: "avant que, à moins que 뒤에 붙는 **ne**는 부정의 ne가 아니라 '허사 ne(ne explétif)'라는 격식 장식이에요. 없어도 뜻은 같지만, 격식 글에서는 붙이는 게 세련됩니다. pas가 없으면 부정이 아니라고 기억하세요.",
      },
      {
        heading: "직설법과 갈리는 미묘한 경계 — penser que의 두 얼굴",
        pattern: "Je pense que + 직설법 · Je ne pense pas que + 접속법",
        body:
          "penser/croire/trouver que는 **긍정문이냐 부정·의문문이냐에 따라 법이 갈려요**. 부정하는 순간 que절은 사실이 아니라 의심의 대상이 되니까요.\n\n" +
          "도치 의문문(Penses-tu qu'il **ait** raison ?)도 같은 원리로 접속법이 격식이에요. il est certain que(직설법) ↔ il n'est pas certain que(접속법)도 같은 패턴입니다.",
        examples: [
          { fr: "Je crois que c'est une bonne idée.", ko: "좋은 생각인 것 같아요.", note: "긍정 → 직설법" },
          { fr: "Je ne crois pas que ce soit une bonne idée.", ko: "좋은 생각이라고는 생각하지 않아요.", note: "부정 → 접속법" },
          { fr: "Il est évident qu'elle a menti.", ko: "그녀가 거짓말한 게 분명해요." },
          { fr: "Il n'est pas sûr que nous puissions venir.", ko: "우리가 갈 수 있을지 확실하지 않아요." },
        ],
        vsEn: "영어는 I don't think he is right처럼 부정해도 동사가 그대로죠. 프랑스어는 화자의 확신도가 동사 형태에 새겨져요. '내 머릿속에서 이 내용이 사실로 서 있는가?'라는 B1의 직관이 여기서도 그대로 작동합니다 — 부정·의문은 그 확신을 무너뜨리니 접속법이 나오는 거예요.",
      },
      {
        heading: "최상급과 유일성 뒤의 접속법",
        pattern: "최상급 / le seul / le premier + 관계절 → 접속법",
        body:
          "**최상급이나 유일성 표현 뒤의 관계절**에는 접속법이 자주 와요. C'est le meilleur film que j'**aie** vu — '내가 본 것 중에서'라는 주관적 평가의 테두리 신호예요.\n\n" +
          "직설법(que j'ai vu)도 틀리지는 않지만, 접속법이 더 다듬어진 인상을 줘요.",
        examples: [
          { fr: "C'est le meilleur restaurant que je connaisse.", ko: "제가 아는 최고의 레스토랑이에요." },
          { fr: "Tu es la seule personne qui me comprenne.", ko: "너는 나를 이해해 주는 유일한 사람이야." },
        ],
      },
    ],
  },

  {
    slug: "b2-02-hypothese-si",
    level: "B2",
    order: 2,
    title: "si 가정문 3종 세트 — 그리고 조건법 과거",
    titleFr: "Les hypothèses avec si",
    summary: "영어 if 1·2·3형식과 거의 1:1로 포개지는 가정문 시스템. 영어 지식이 가장 큰 자산이 되는 챕터예요.",
    duration: "약 11분",
    sections: [
      {
        heading: "시스템 전체 보기 — 세 가지 거리감",
        pattern: "si + 현재 → 미래 · si + 반과거 → 조건법 현재 · si + 대과거 → 조건법 과거",
        patternKo: "si절을 과거로 밀수록 현실에서 멀어진다",
        body:
          "프랑스어 가정문은 '현실에서 얼마나 멀어지는가'에 따라 세 단계예요. **영어의 if 1·2·3형식과 거의 완벽하게 1:1 대응**해요.\n\n" +
          "공통 원리는 하나: **si절의 시제를 한 칸씩 과거로 밀수록 현실에서 멀어진다.**",
        table: {
          caption: "가정문 3종 세트",
          headers: ["유형", "si절", "주절", "영어 평행"],
          rows: [
            ["① 실현 가능", "si + 현재", "미래/현재/명령", "If it rains, I will..."],
            ["② 현재의 비현실", "si + 반과거", "조건법 현재", "If I were..., I would..."],
            ["③ 과거의 비현실", "si + 대과거", "조건법 과거", "If I had..., I would have..."],
          ],
        },
        examples: [
          { fr: "S'il pleut demain, on restera à la maison.", ko: "내일 비가 오면 집에 있을 거예요. (①)" },
          { fr: "S'il faisait beau, on irait à la plage.", ko: "날씨가 좋다면 해변에 갈 텐데. (② — 실제론 안 좋음)" },
          { fr: "S'il avait fait beau, on serait allés à la plage.", ko: "날씨가 좋았더라면 해변에 갔을 텐데. (③ — 이미 지나간 일)" },
        ],
        vsEn: "유형별 시제 조합까지 영어와 똑같아요: if + 과거 ↔ si + 반과거, would ↔ 조건법, would have ↔ 조건법 과거. 영어 가정법이 흔들리는 분은 거꾸로 프랑스어로 영어를 복습하게 되는, 일석이조의 지점입니다.",
      },
      {
        heading: "①형 — si + 현재: 충분히 일어날 수 있는 일",
        pattern: "si + 현재, 미래/현재/명령문",
        body:
          "조건이 **현실적으로 가능**할 때는 si절에 현재를 쓰고, 주절에는 미래·현재·명령문이 자유롭게 와요. 이미 아는 시제의 조합일 뿐이죠.\n\n" +
          "si + il(s)는 **s'il(s)**로 축약되지만, si + elle은 si elle 그대로라는 것만 챙기세요.",
        examples: [
          { fr: "Si tu as le temps ce week-end, appelle-moi.", ko: "이번 주말에 시간 되면 전화해." },
          { fr: "Si on part maintenant, on arrivera avant la nuit.", ko: "지금 출발하면 밤이 되기 전에 도착할 거예요." },
        ],
        pitfall: "**si절 안에는 미래도 조건법도 금지**예요. 영어와 같은 규칙이죠(If it will rain이 틀리듯 Si il pleuvra도 틀려요). si가 시간·조건의 틀을 잡고, 미래·조건법은 주절이 담당합니다.",
      },
      {
        heading: "②형 — si + 반과거: 지금과 다른 상상",
        pattern: "si + imparfait, conditionnel présent",
        patternKo: "제안 변형: Et si on + 반과거 ?",
        body:
          "**현재 사실과 반대되거나 실현 가능성이 낮은** 상상이에요. B1 조건법 챕터에서 만난 그 패턴이죠.\n\n" +
          "제안에도 변형돼 쓰여요: **Et si on partait en Italie ?**(이탈리아로 떠나는 거 어때?) — 주절 없이 si절만으로 부드러운 제안이 됩니다.",
        examples: [
          { fr: "Si j'étais toi, je refuserais cette offre.", ko: "내가 너라면 그 제안 거절할 거야." },
          { fr: "Si on habitait à Paris, on irait au théâtre toutes les semaines.", ko: "파리에 산다면 매주 연극을 보러 갈 텐데." },
          { fr: "Et si on prenait un café ?", ko: "우리 커피 한잔 어때?", note: "si + 반과거만으로 제안" },
        ],
      },
      {
        heading: "③형 — si + 대과거와 조건법 과거: 돌이킬 수 없는 일",
        pattern: "si + plus-que-parfait, conditionnel passé (avoir/être 조건법 + 과거분사)",
        body:
          "**이미 지나간 과거를 되돌리는 상상**이에요. 조건법 과거는 avoir/être의 조건법 현재 + 과거분사: j'aurais fait(했을 텐데), je serais venu(e).\n\n" +
          "가정문 밖에서도 후회와 비난의 단골이에요: **j'aurais dû** + 부정사(~했어야 했는데), **tu aurais pu** + 부정사(~할 수도 있었잖아).",
        examples: [
          { fr: "Si tu m'avais prévenu, je serais venu plus tôt.", ko: "네가 미리 알려줬더라면 더 일찍 왔을 거야." },
          { fr: "Si elle avait étudié en France, elle parlerait mieux français.", ko: "그녀가 프랑스에서 공부했더라면 지금 프랑스어를 더 잘할 텐데.", note: "혼합형 — 과거의 가정, 현재의 결과" },
          { fr: "J'aurais dû t'écouter.", ko: "네 말을 들었어야 했는데.", note: "후회의 만능 공식 aurais dû" },
          { fr: "Tu aurais pu me le dire !", ko: "나한테 말해줄 수도 있었잖아!", note: "가벼운 원망" },
        ],
        vsEn: "j'aurais dû = I should have, tu aurais pu = you could have. 영어의 should have/could have/would have 세트가 devoir/pouvoir + 조건법 과거로 그대로 옮겨져요. 후회를 말하는 회로를 영어에서 통째로 이식하세요.",
        tip: "예문의 혼합형처럼 si + 대과거(과거 가정) 뒤에 조건법 현재(현재 결과)가 오는 조합도 자연스러워요. 기계적으로 짝을 맞추기보다 '가정은 언제 일이고, 결과는 언제 일인가'를 따로 따지면 됩니다.",
      },
    ],
  },

  {
    slug: "b2-03-participe-present",
    level: "B2",
    order: 3,
    title: "현재분사 vs 제롱디프 vs 동사적 형용사",
    titleFr: "Participe présent, gérondif, adjectif verbal",
    summary: "-ant으로 끝나는 세 형제의 역할 분담. fatigant과 fatiguant, 철자 하나가 품사를 가르는 세계예요.",
    duration: "약 10분",
    sections: [
      {
        heading: "-ant 삼형제 — 한눈에 구별하기",
        pattern: "① 현재분사 (불변·문어) · ② en + -ant (제롱디프) · ③ 동사적 형용사 (성수 일치)",
        body:
          "B1의 제롱디프 외에도 -ant 형태는 셋으로 갈라져요. **현재분사**는 en 없이 쓰는 동사 성격의 -ant(불변), **제롱디프**는 en + -ant(부사 역할), **동사적 형용사**는 완전히 형용사가 된 -ant(성·수 일치)예요.\n\n" +
          "구별 신호: en이 붙으면 ②, 명사를 꾸미며 일치하면 ③, 목적어·보어를 끌고 다니면서 불변이면 ①.",
        examples: [
          { fr: "Les personnes ayant un billet peuvent entrer.", ko: "표를 가진 분들은 입장하실 수 있습니다.", note: "① 현재분사 — 목적어(un billet)를 끌고 다녀요" },
          { fr: "Elle est partie en courant.", ko: "그녀는 뛰어서 떠났어요.", note: "② 제롱디프" },
          { fr: "C'est une histoire amusante.", ko: "재미있는 이야기예요.", note: "③ 동사적 형용사 — 여성 일치 amusante" },
        ],
        vsEn: "영어 -ing 하나가 분사(running water), 동명사(I like running), 분사구문(Running fast, he...)을 다 하는 것과 달리, 프랑스어는 역할마다 형태와 규칙이 갈라져 있어요. 대신 영어 동명사 자리(I like running)는 프랑스어에서 -ant이 아니라 **부정사**(J'aime courir)가 맡는다는 게 최대 함정입니다.",
      },
      {
        heading: "현재분사 — 관계절을 압축하는 문어체 도구",
        pattern: "qui 관계절 → 현재분사 (les étudiants ayant fini)",
        body:
          "현재분사의 주 무대는 **글**이에요. qui 관계절을 한 단어로 압축하고, 원인 분사구문(**Étant** malade, il n'est pas venu)으로도 애용돼요. 회화에서는 Comme절로 풀어 말하는 게 보통이에요.\n\n" +
          "현재분사는 **절대 일치하지 않아요**. une femme parlant trois langues — 이 '불변'이 형용사와의 결정적 차이예요.",
        examples: [
          { fr: "Les passagers voyageant avec des enfants embarquent en premier.", ko: "아이를 동반한 승객은 먼저 탑승합니다.", note: "안내 방송·공지문의 단골 구조" },
          { fr: "N'ayant pas reçu de réponse, je vous écris de nouveau.", ko: "답장을 받지 못하여 다시 메일을 드립니다.", note: "격식 이메일 표현" },
        ],
        tip: "현재분사는 '읽고 쓸 줄 알면 되는' 문법이에요. 신문·공문·이메일에서 알아보고, 격식 작문에서 한두 번 써먹는 정도가 B2의 적정선입니다. 말할 때는 qui 관계절이나 comme절로 푸세요.",
      },
      {
        heading: "동사적 형용사 — 철자까지 달라지는 경우",
        pattern: "분사 fatiguant ↔ 형용사 fatigant",
        body:
          "일부 동사는 **현재분사와 동사적 형용사의 철자가 달라요**. 분사는 동사 활용(nous형)을 따르고, 형용사는 라틴어식 철자를 따로 갖기 때문이에요.\n\n" +
          "Un travail **fatigant**(피곤하게 하는 일 — 형용사, u 탈락) vs Ce travail, **fatiguant** tout le monde, ...(모두를 지치게 하면서 — 분사, u 유지).",
        table: {
          caption: "철자가 갈리는 대표 쌍 (분사 / 형용사)",
          headers: ["동사", "현재분사", "동사적 형용사"],
          rows: [
            ["fatiguer", "fatiguant", "fatigant"],
            ["provoquer", "provoquant", "provocant"],
            ["convaincre", "convainquant", "convaincant"],
            ["négliger", "négligeant", "négligent"],
            ["précéder", "précédant", "précédent"],
            ["différer", "différant", "différent"],
          ],
        },
        examples: [
          { fr: "Ce voyage était fatigant mais magnifique.", ko: "이번 여행은 피곤했지만 멋졌어요.", note: "형용사 — u 없음" },
          { fr: "Son argument est très convaincant.", ko: "그의 논거는 아주 설득력 있어요.", note: "-qu- → -c-" },
          { fr: "l'année précédente", ko: "전년도, 그 전 해", note: "형용사 précédent + 여성 일치" },
        ],
        pitfall: "différent(다른), excellent(훌륭한), précédent(이전의)처럼 이미 형용사로 굳은 단어들이 사실 이 계열이에요. 작문에서 '분사인지 형용사인지'를 정해야 철자가 정해집니다 — 일치가 일어나는 자리(명사 수식)면 형용사 철자를 쓰세요.",
        etym: "형용사 쪽 철자(-cant, -gent)는 라틴어 분사 어간을 직수입한 거라 영어와 똑같아요: convaincant=convincing이 아니라 **convincing의 사촌 convincent류** — provocant=provocative, négligent=negligent, différent=different. 헷갈리면 '영어 형용사와 닮은 쪽이 형용사'라고 기억해도 거의 맞습니다.",
      },
    ],
  },

  {
    slug: "b2-04-connecteurs",
    level: "B2",
    order: 4,
    title: "논리 연결사 — 글의 격을 올리는 접착제",
    titleFr: "Les connecteurs logiques",
    summary: "cependant, en revanche, par conséquent... mais와 donc만으로는 부족해지는 순간, DELF B2 작문의 핵심 무기예요.",
    duration: "약 11분",
    sections: [
      {
        heading: "왜 연결사인가 — B2 작문의 채점 기준",
        body:
          "B1까지는 mais(하지만), donc(그래서), parce que(왜냐하면)로 버틸 수 있어요. 하지만 B2부터는 **논증하는 글**(에세이, 독자 투고, 공식 이메일)을 써야 하고, DELF B2 작문 채점표에는 '담화의 결속(cohérence)' 항목이 따로 있어요.\n\n" +
          "연결사는 단순한 장식이 아니라 **글의 논리 지도**예요. 반박하는지, 양보하는지, 결론짓는지를 연결사가 미리 알려주죠. 이 챕터의 표현들을 범주별로 서너 개씩만 자기 것으로 만들어도 작문 점수가 눈에 띄게 달라집니다.",
        examples: [
          { fr: "Le télétravail a des avantages. Cependant, il isole parfois les employés.", ko: "재택근무에는 장점이 있어요. 그렇지만 직원들을 고립시키기도 하죠." },
        ],
        tip: "외울 때는 '한국어 뜻'이 아니라 **자기가 쓸 문장 틀**로 외우세요. 'Certes..., cependant...'(물론 ~이긴 하다. 그렇지만 ~) 같은 틀 서너 개면 에세이 한 편의 뼈대가 나옵니다.",
      },
      {
        heading: "대립과 양보 — cependant, néanmoins, en revanche",
        pattern: "cependant/toutefois = 그렇지만 · néanmoins = 그럼에도 · pourtant = 그런데도 · en revanche = 반면에",
        body:
          "전부 '하지만' 계열이지만 결이 달라요. **cependant/toutefois**는 mais의 문어체 업그레이드, **néanmoins**은 앞 내용을 인정하면서 뒤집기, **pourtant**은 모순에 대한 놀라움이에요.\n\n" +
          "**en revanche / par contre**는 반박이 아니라 **대조** — 두 대상을 나란히 비교할 때만 쓰세요. (par contre는 구어적, en revanche가 격식)",
        examples: [
          { fr: "Ce projet est ambitieux. Néanmoins, il reste réalisable.", ko: "이 프로젝트는 야심 차요. 그럼에도 실현 가능합니다." },
          { fr: "Il a très peu étudié. Pourtant, il a réussi l'examen.", ko: "그는 공부를 거의 안 했어요. 그런데도 시험에 합격했죠." },
          { fr: "L'été est très chaud à Séoul. En revanche, l'hiver est glacial.", ko: "서울의 여름은 아주 더워요. 반면에 겨울은 혹독하게 춥죠." },
        ],
        pitfall: "en revanche를 '하지만'의 만능 대체어로 쓰면 어색해요. 반박(앞 주장 뒤집기)에는 cependant, 대조(A는 이렇고 B는 저렇고)에는 en revanche — 이 분업을 지켜야 글이 논리적으로 읽힙니다.",
      },
      {
        heading: "원인과 결과 — par conséquent, en effet, ainsi",
        pattern: "par conséquent = 따라서 · en effet = 근거 뒷받침 · en fait = 반전·정정",
        body:
          "**par conséquent / c'est pourquoi**는 donc의 격식 버전으로 결론을 끌어내고, **ainsi**는 '이렇게 하여, 그 결과'예요.\n\n" +
          "**en effet**는 **앞 문장의 근거를 대는** 연결사예요 — '사실은'이라는 반전이 아닙니다(한국 학습자 최다 오용 1위). 반전·정정의 '실은'은 **en fait** — 글자 하나 차이로 정반대 방향이에요.",
        examples: [
          { fr: "Les billets sont chers. Par conséquent, peu de jeunes vont à l'opéra.", ko: "표가 비싸요. 따라서 오페라에 가는 젊은이가 적죠." },
          { fr: "Ce quartier est agréable. En effet, on y trouve beaucoup de parcs.", ko: "이 동네는 살기 좋아요. 실제로 공원이 많거든요.", note: "en effet = 앞 문장 뒷받침" },
          { fr: "Je pensais qu'il était français. En fait, il est belge.", ko: "그가 프랑스인인 줄 알았는데, 실은 벨기에 사람이에요.", note: "en fait = 반전·정정" },
        ],
        vsEn: "en effet ≈ indeed(뒷받침), en fait ≈ actually(반전) — 영어 쌍으로 기억하면 헷갈리지 않아요. however ≈ cependant, on the other hand ≈ en revanche, therefore ≈ par conséquent까지, 영어 에세이 연결사 체계가 거의 그대로 대응됩니다.",
      },
      {
        heading: "첨가·전환·구조화 — d'ailleurs, par ailleurs, d'abord...",
        pattern: "d'abord → ensuite → enfin · de plus = 게다가 · par ailleurs = 전환",
        body:
          "**de plus / en outre**는 논거를 쌓는 '게다가', **d'ailleurs**는 곁가지 근거를 슬쩍 보태는 '하긴', **par ailleurs**는 새 논점으로 **전환**하는 '한편'이에요 — 마지막 둘은 모양이 닮았지만 역할이 달라요.\n\n" +
          "글 전체의 뼈대는 **d'abord → ensuite → enfin**, 결론은 **en conclusion / pour conclure**로 잡아요.",
        examples: [
          { fr: "Ce film est magnifique. De plus, la musique est superbe.", ko: "이 영화는 훌륭해요. 게다가 음악도 멋지죠." },
          { fr: "Je n'ai pas envie de sortir. D'ailleurs, il pleut.", ko: "나갈 마음이 없어. 하긴 비도 오고." },
          { fr: "Le prix est raisonnable. Par ailleurs, la livraison est gratuite.", ko: "가격이 합리적이에요. 또한 배송도 무료고요." },
          { fr: "D'abord, je présenterai le problème ; ensuite, ses causes ; enfin, des solutions possibles.", ko: "우선 문제를 제시하고, 다음으로 원인을, 끝으로 가능한 해결책을 다루겠습니다.", note: "DELF B2 에세이 서론의 정석 틀" },
        ],
        tip: "DELF 작문에서는 같은 연결사를 두 번 쓰지 않는 게 암묵적 규칙이에요. 범주별로 2~3개씩 '교체 선수'를 준비해 두세요: 대립(cependant/toutefois/néanmoins), 결과(par conséquent/c'est pourquoi/ainsi), 첨가(de plus/en outre/par ailleurs).",
      },
    ],
  },

  {
    slug: "b2-05-verb-prepositions",
    level: "B2",
    order: 5,
    title: "동사 + 전치사 — penser à인가 penser de인가",
    titleFr: "Les verbes et leurs prépositions",
    summary: "동사 뒤에 à를 쓸지 de를 쓸지, 아니면 아무것도 안 쓸지. 영어 감각이 배신하는 지점을 콕 집어 정리해요.",
    duration: "약 11분",
    sections: [
      {
        heading: "왜 어려운가 — 전치사는 동사의 지문",
        pattern: "동사마다 정해진 전치사 — dépendre de · réussir à · attendre + ∅",
        body:
          "프랑스어 동사는 저마다 **정해진 전치사**를 데리고 다녀요. 영어 구동사(look for, depend on)를 외울 때와 같은 종류의 암기가 필요해요.\n\n" +
          "문제는 **영어와 어긋나는 지점**이에요. 목표는 '전부 외우기'가 아니라 '틀리는 자리를 아는 것'이에요.",
        examples: [
          { fr: "Ça dépend de toi.", ko: "그건 너한테 달렸어.", note: "영어 depend on ↔ 프랑스어 dépendre de" },
        ],
        tip: "B1까지의 동사 암기가 'attendre = 기다리다'였다면, B2부터는 '**attendre qqch / attendre de + inf**'처럼 전치사 패턴째로 외우세요. 사전의 동사 항목에서 예문 구조를 같이 읽는 습관이 지름길이에요.",
      },
      {
        heading: "penser à vs penser de — 같은 동사, 다른 전치사, 다른 뜻",
        pattern: "penser à = 떠올리다·챙기다 · penser de = 의견",
        body:
          "전치사가 **뜻을 가르는** 대표 사례예요. **penser à**는 생각이 대상으로 향하는 것, **penser de**는 의견(Qu'est-ce que tu penses **de** ce film ?) — 답은 Je pense que...로 받아요.\n\n" +
          "비슷한 짝: parler à(~에게 말하다) vs parler de(~에 대해), jouer à(스포츠) vs jouer de(악기).",
        examples: [
          { fr: "Je pense souvent à mes années d'université.", ko: "대학 시절을 자주 생각해요." },
          { fr: "Pense à acheter du pain !", ko: "빵 사는 거 잊지 마!", note: "penser à + inf = 챙기다, 잊지 않다" },
          { fr: "Qu'est-ce que vous pensez de cette idée ?", ko: "이 아이디어에 대해 어떻게 생각하세요?" },
          { fr: "Elle joue au tennis et il joue du piano.", ko: "그녀는 테니스를 치고 그는 피아노를 쳐요.", note: "jouer à 운동 / jouer de 악기" },
        ],
        pitfall: "'~에 대해 어떻게 생각해?'를 영어 What do you think about...의 직역으로 Qu'est-ce que tu penses à...(X)라고 하기 쉬워요. 의견을 물을 땐 반드시 **de**입니다.",
      },
      {
        heading: "à 군단과 de 군단 — 부정사를 연결하는 전치사",
        pattern: "commencer à + inf · finir de + inf · vouloir + inf (전치사 없음)",
        body:
          "동사 + 동사를 이을 때 어떤 동사는 à(commencer, réussir, apprendre, s'habituer), 어떤 동사는 de(finir, décider, essayer, oublier, éviter), 어떤 동사는 맨 부정사(vouloir, pouvoir, devoir, aimer, espérer)를 써요.\n\n" +
          "commencer à ↔ finir de가 짝으로 어긋나는 게 얄밉죠. 의미 규칙은 없어서, 짝문장으로 입에 붙이는 게 정석이에요.",
        table: {
          caption: "고빈도 동사 + 전치사 치트시트",
          headers: ["à + inf", "de + inf", "전치사 없음"],
          rows: [
            ["commencer à", "finir de", "vouloir"],
            ["réussir à", "essayer de", "pouvoir"],
            ["apprendre à", "décider de", "devoir"],
            ["s'habituer à", "oublier de", "aimer"],
            ["hésiter à", "éviter de", "espérer"],
          ],
        },
        examples: [
          { fr: "J'ai commencé à apprendre le français il y a deux ans.", ko: "2년 전에 프랑스어를 배우기 시작했어요." },
          { fr: "Elle a décidé de changer de travail.", ko: "그녀는 이직하기로 결심했어요." },
          { fr: "N'oublie pas de fermer la fenêtre.", ko: "창문 닫는 거 잊지 마." },
          { fr: "J'espère te revoir bientôt.", ko: "곧 다시 만나길 바라.", note: "espérer는 전치사 없이 바로 부정사" },
        ],
      },
      {
        heading: "영어 감각이 배신하는 동사들",
        pattern: "attendre/chercher/écouter + 직접목적어 (전치사 ✗) · téléphoner/répondre + à · dépendre + de",
        body:
          "**영어에는 전치사가 있는데 프랑스어에는 없는**(또는 그 반대인) 블랙리스트예요.\n\n" +
          "전치사 없음: attendre(wait **for**), chercher(look **for**), écouter(listen **to**), payer(pay **for**). à 필요: téléphoner à, répondre à, ressembler à. de 필요: dépendre de, se souvenir de, s'occuper de.",
        examples: [
          { fr: "J'attends le bus depuis vingt minutes.", ko: "버스를 20분째 기다리고 있어요.", note: "attendre pour(X) — 전치사 없음" },
          { fr: "Je cherche mes clés.", ko: "열쇠를 찾고 있어요.", note: "chercher pour(X)" },
          { fr: "Tu as répondu à son message ?", ko: "그 사람 메시지에 답장했어?", note: "répondre는 à 필수" },
          { fr: "Elle ressemble beaucoup à sa mère.", ko: "그녀는 어머니를 많이 닮았어요." },
        ],
        vsEn: "wait for의 for, listen to의 to를 번역해서 attendre pour, écouter à라고 하는 게 영어 학습자 출신의 단골 실수예요. 거꾸로 answer/call처럼 영어가 직접 목적어인 자리에 프랑스어는 à를 요구하기도 하고요(répondre à, téléphoner à). '영어와 같겠지'라는 가정이 가장 위험한 챕터입니다.",
        pitfall: "répondre à, téléphoner à처럼 à를 받는 동사는 **간접목적 대명사**(lui/leur)로 받아요: Je lui ai téléphoné(그에게 전화했어요). 전치사 선택이 대명사 선택까지 연쇄적으로 결정하니, 패턴째 암기가 두 배로 이득이에요.",
      },
    ],
  },

  {
    slug: "b2-06-mise-en-relief",
    level: "B2",
    order: 6,
    title: "강조 구문 — c'est ... qui / ce qui ..., c'est ...",
    titleFr: "La mise en relief",
    summary: "프랑스어는 목소리가 아니라 구문으로 강조해요. 문장의 스포트라이트를 옮기는 두 가지 장치를 배워요.",
    duration: "약 9분",
    sections: [
      {
        heading: "프랑스어의 정보구조 — 강세 대신 구문",
        pattern: "강조 = 구문으로: c'est ... qui/que · ce qui ..., c'est ...",
        body:
          "영어는 강세로, 한국어는 조사로 강조하지만 프랑스어는 둘 다 잘 안 통해요 — 강세 위치가 고정된 언어라서요. 대신 **문장 구조 자체를 바꿔서** 스포트라이트를 옮겨요(mise en relief).\n\n" +
          "이 구문들은 문어체 장식이 아니라 **일상 회화의 기본 어법**이에요. 프랑스인의 입에서 하루에도 수십 번 나옵니다.",
        examples: [
          { fr: "C'est moi qui ai fait ça.", ko: "그거 한 사람 나야. (내가 했어.)" },
          { fr: "Ce que j'aime ici, c'est l'ambiance.", ko: "여기서 내가 좋아하는 건 분위기야." },
        ],
        vsEn: "영어 it-cleft(It's me who did it)와 wh-cleft(What I like is...)에 정확히 대응해요. 다만 영어에서는 선택 사항인 이 구문이, 강세 강조가 불가능한 프랑스어에서는 **사실상 유일한 수단**이라 사용 빈도가 비교할 수 없이 높아요.",
      },
      {
        heading: "c'est ... qui / c'est ... que — 스포트라이트 분열문",
        pattern: "C'est + 강조어 + qui (주어) / que (목적어·부사구)",
        body:
          "강조하고 싶은 말을 c'est와 qui/que 사이에 끼워요. C'est **Marie qui** a appelé(주어 강조), C'est **ce livre que** je cherchais(목적어 강조), C'est **en 2002 que** je suis né(부사구 강조).\n\n" +
          "인칭대명사를 강조할 땐 강세형(moi, toi, lui...)을 써요: C'est **moi** qui...",
        examples: [
          { fr: "C'est Paul qui a préparé le dîner, pas moi.", ko: "저녁을 준비한 건 폴이에요, 제가 아니라." },
          { fr: "C'est cette chanson que j'écoutais tout le temps.", ko: "내가 늘 듣던 게 바로 이 노래야." },
          { fr: "C'est pour toi que je suis venu.", ko: "너 때문에(너를 위해서) 온 거야." },
          { fr: "C'est en forgeant qu'on devient forgeron.", ko: "쇠를 두드려야 대장장이가 된다. (속담)", note: "수단 강조 — B1 제롱디프 챕터의 그 속담이에요" },
        ],
        pitfall: "C'est moi qui 뒤의 **동사는 강조된 사람에 일치**해요: C'est moi qui **ai** raison(O), qui a raison(X). C'est toi qui **as**..., C'est nous qui **avons**... — qui 뒤에서 3인칭으로 굳히는 실수가 정말 흔하니, '일치는 스포트라이트 주인공을 따른다'고 기억하세요.",
      },
      {
        heading: "ce qui ..., c'est ... — 뜸 들이고 공개하기",
        pattern: "Ce qui / Ce que / Ce dont ..., c'est ...",
        patternKo: "궁금증을 먼저 만들고 답을 뒤에 공개",
        body:
          "**Ce qui** me plaît, **c'est** son humour.(내 마음에 드는 것, 그건 그의 유머예요.) — 뜸을 들인 뒤 쉼표 너머에서 답을 공개해요. 절의 주어면 ce qui, 목적어면 ce que, de 결합이면 ce dont.\n\n" +
          "회화에서는 거꾸로 뒤에 붙이는 변형도 많이 들려요: C'est génial, **ce que tu as fait**.",
        examples: [
          { fr: "Ce qui m'inquiète, c'est son silence.", ko: "걱정되는 건 그의 침묵이에요." },
          { fr: "Ce que je préfère en automne, c'est la lumière.", ko: "가을에 내가 제일 좋아하는 건 빛이에요." },
          { fr: "Ce dont on a besoin, c'est de temps.", ko: "우리에게 필요한 건 시간이에요.", note: "avoir besoin de → ce dont ..., c'est de ..." },
        ],
        tip: "DELF 말하기·쓰기에서 의견을 낼 때 Ce qui me semble important, c'est...(제게 중요해 보이는 것은 ~입니다)로 문장을 열면 단번에 B2다운 인상을 줘요. 틀 자체를 통째로 암기해 두세요.",
      },
      {
        heading: "일상 회화의 가벼운 강조 — 분리 구문",
        pattern: "Moi, je ... · Le café, j'adore ça",
        patternKo: "강조할 말을 앞뒤로 빼고 대명사로 받기",
        body:
          "격식은 떨어지지만 회화에서 더 흔한 **분리(dislocation)** 구문이에요. 프랑스인의 입버릇 Moi, je...가 바로 이거예요.\n\n" +
          "한국어의 '~는 말이야/말인데' 주제화와 감각이 비슷해서 우리에게는 오히려 자연스러운 구조입니다.",
        examples: [
          { fr: "Moi, je ne suis pas d'accord.", ko: "나는 (말이야) 동의 안 해." },
          { fr: "Cette série, tout le monde en parle.", ko: "그 드라마, 다들 얘기하더라." },
          { fr: "Il est sympa, ton frère.", ko: "괜찮네, 네 형(동생)." },
        ],
      },
    ],
  },

  {
    slug: "b2-07-nominalisation",
    level: "B2",
    order: 7,
    title: "명사화 — 동사를 명사로, 문장을 헤드라인으로",
    titleFr: "La nominalisation",
    summary: "augmenter → l'augmentation. 격식 문체의 핵심 기술이자 신문 헤드라인 해독의 열쇠. 영어 -tion 어휘가 그대로 자산이 돼요.",
    duration: "약 10분",
    sections: [
      {
        heading: "명사화란 — 격식 문체의 압축 기술",
        pattern: "Les prix ont augmenté → l'augmentation des prix",
        patternKo: "동사를 명사로 바꿔 문장 압축",
        body:
          "프랑스어의 격식 문체(신문, 보고서, 학술문)는 **동사 중심이 아니라 명사 중심**으로 돌아가요. 한국어도 '가격이 올라서 걱정이다'보다 '가격 상승이 우려된다'가 더 격식 있게 들리죠 — 같은 원리예요.\n\n" +
          "DELF B2 듣기·독해 지문이 바로 이 명사 문체로 쓰여 있고, 작문 요약에서도 명사화 능력이 점수를 가릅니다.",
        examples: [
          { fr: "la construction d'un nouveau pont", ko: "새 다리의 건설", note: "← On construit un nouveau pont." },
          { fr: "le départ du train", ko: "기차의 출발", note: "← Le train part." },
        ],
      },
      {
        heading: "접미사 패턴 — -tion, -ment, -age",
        pattern: "-tion/-sion/-ure → 여성 · -ment/-age → 남성",
        body:
          "명사화 접미사는 패턴이 있고, A0의 성 추측 규칙이 그대로 적용돼요: la construction, le développement, le recyclage, l'ouverture(f.).\n\n" +
          "접미사 없는 짧은 명사들도 고빈도예요: le départ, l'arrivée(여성), le choix, la hausse(상승), la baisse(하락).",
        table: {
          caption: "명사화 패턴과 성",
          headers: ["접미사", "성", "예시"],
          rows: [
            ["-tion / -sion", "여성", "la création, la réduction, la décision"],
            ["-ment", "남성", "le développement, le changement"],
            ["-age", "남성", "le recyclage, le chauffage"],
            ["-ure", "여성", "l'ouverture, la fermeture"],
            ["-ée", "여성", "l'arrivée, la montée"],
            ["(무접미)", "다양", "le départ, le choix, la hausse, la baisse"],
          ],
        },
        examples: [
          { fr: "la réduction des émissions de CO2", ko: "이산화탄소 배출량 감축" },
          { fr: "le développement durable", ko: "지속 가능한 발전", note: "시사 단골 표현" },
        ],
        etym: "-tion 명사는 라틴어 -tiō의 후손이라 영어와 거의 그대로 겹쳐요: construction, augmentation, réduction, création... 영어에서 아는 -tion 단어는 십중팔구 프랑스어에 같은 꼴로 존재하고, 게다가 **전부 여성 명사**예요. B1 영어 어휘가 한꺼번에 프랑스어 자산으로 환전되는 순간입니다.",
        pitfall: "명사화의 복병은 뜻이 아니라 **성(性)**이에요. le développement인지 la développement인지에서 무너지죠. 접미사 규칙(-tion 여성, -ment 남성)을 성 추측 치트키로 적극 활용하고, 무접미 명사(le choix, la hausse)만 따로 챙기세요.",
      },
      {
        heading: "신문 헤드라인 읽기 — 동사 없는 문장의 세계",
        pattern: "헤드라인 = 명사 + de + 명사 (Reprise du trafic lundi)",
        body:
          "프랑스 신문 헤드라인은 **동사를 거의 쓰지 않고** 명사화가 그 자리를 대신해요. Grève des transports : reprise du trafic lundi — 동사 없이 두 문장이 압축되어 있죠.\n\n" +
          "해독 요령은 **명사를 동사로 되돌려 읽기**: hausse → '오르다', reprise → '재개되다'. Le Monde 헤드라인을 하루 세 개씩 풀어 읽는 것만큼 좋은 B2 훈련이 없어요.",
        examples: [
          { fr: "Hausse du prix de l'électricité en janvier", ko: "1월 전기 요금 인상", note: "= Le prix de l'électricité augmentera en janvier." },
          { fr: "Réouverture du musée après deux ans de travaux", ko: "2년의 공사 끝에 미술관 재개관" },
          { fr: "Élection présidentielle : victoire de l'opposition", ko: "대통령 선거: 야당의 승리" },
        ],
        vsEn: "영어 헤드라인은 Museum reopens처럼 동사를 살리는 편이라면, 프랑스어 헤드라인은 Réouverture du musée처럼 명사로 못 박는 게 기본형이에요. 영어식으로 동사를 찾으며 읽으면 막히니, '명사 + de + 명사' 사슬을 통째로 받아들이는 연습이 필요해요.",
      },
      {
        heading: "작문에 써먹기 — 문장에서 명사구로",
        pattern: "avant que + 절 → avant + 명사구 (avant l'ouverture du magasin)",
        body:
          "종속절을 명사구로 바꾸면 문장이 단정해지고 격이 올라가요. Parce que les prix ont augmenté → **En raison de l'augmentation** des prix.\n\n" +
          "특히 avant/après 뒤에서 명사화를 쓰면 **접속법·시제 고민이 통째로 사라지니**, 시험장에서 실전 가치가 큰 기술이에요.",
        examples: [
          { fr: "Après la signature du contrat, nous commencerons les travaux.", ko: "계약 체결 후에 공사를 시작하겠습니다.", note: "= après que le contrat sera signé보다 훨씬 깔끔" },
          { fr: "En raison de la grève, les cours sont annulés.", ko: "파업으로 인해 수업이 취소되었습니다." },
          { fr: "La lecture quotidienne améliore le vocabulaire.", ko: "매일 하는 독서는 어휘력을 향상시켜요.", note: "lire → la lecture" },
        ],
        tip: "요약 과제(synthèse)에서는 지문의 동사 문장을 명사구로 바꾸는 것 자체가 채점 포인트예요. '~가 늘었다 → la hausse de ~', '~가 시작됐다 → le début de ~' 같은 변환 쌍을 10개쯤 장전해 두면 요약 속도가 확 빨라집니다.",
      },
    ],
  },
];
