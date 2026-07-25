/**
 * A2 실전 장면 — 샌드위치 v2 신규 저작 (오너 확정: fr A1~A2 시험 적용, 배치 5)
 * 실전 대화를 먼저 만나고 문법으로 되짚는 A2 샌드위치 레슨 묶음(13·14 + 기준표 갭 큐 신규 15~).
 * 실자료: 핵심 문형은 Tatoeba 다수 실재 계열(배치 1 검증 절차 준용), 대화는 자체 저작 — 실음원 연결은 확산 단계.
 */
const chapters = [
  {
    slug: "a2-scene-13-train-delay",
    level: "A2",
    order: 13,
    formulaic: true,
    prerequisites: ["a2-01-passe-compose-avoir", "a2-02-passe-compose-etre"],
    title: "\"열차를 놓쳤어요\" — 지연·환불을 복합과거로 말해요",
    titleFr: "Train raté : expliquer au passé composé",
    topic: "지연 신고·상황 설명(복합과거)·환불·다음 열차",
    summary:
      "열차 지연으로 환승을 놓친 상황을 복합과거로 설명하고, 다음 열차와 환불 규정을 확인해요.",
    duration: "약 15분",
    sections: [
      {
        type: "authenticIntro",
        heading: "창구 실전 대화 먼저 만나기",
        presentationFraming:
          "다 이해 안 돼도 정상이에요! 이미 벌어진 일을 설명하는 대화라 동사가 전부 과거형이에요 — j'ai raté(놓쳤어요)와 est arrivé(도착했어요) 두 표현만 눈에 걸리면 충분해요.",
        dialogue: [
          { speaker: "여행자", fr: "Bonjour. J'ai raté ma correspondance à Lyon.", ipa: "[bɔ̃ʒuʁ ʒe ʁate ma kɔʁɛspɔ̃dɑ̃s a ljɔ̃]", ko: "안녕하세요. 리옹에서 환승편을 놓쳤어요." },
          { speaker: "역무원", fr: "Qu'est-ce qui s'est passé ?", ipa: "[kɛs ki sɛ pase]", ko: "무슨 일이 있었나요?" },
          { speaker: "여행자", fr: "Mon premier train est arrivé avec trente minutes de retard.", ipa: "[mɔ̃ pʁəmje tʁɛ̃ ɛt aʁive avɛk tʁɑ̃t minyt də ʁətaʁ]", ko: "첫 열차가 30분 늦게 도착했어요." },
          { speaker: "역무원", fr: "Je comprends. Vous pouvez prendre le prochain train sans frais.", ipa: "[ʒə kɔ̃pʁɑ̃ vu puve pʁɑ̃dʁ lə pʁɔʃɛ̃ tʁɛ̃ sɑ̃ fʁɛ]", ko: "알겠습니다. 추가 요금 없이 다음 열차를 타실 수 있어요." },
        ],
      },
      {
        type: "vocabPreview",
        heading: "오늘 배울 단어 6개",
        vocabs: [
          { word: "rater", meanings: ["놓치다", "실패하다"], exampleSentence: "J'ai raté ma correspondance.", note: "manquer보다 구어적" },
          { word: "le retard", meanings: ["지연", "늦음"], exampleSentence: "Le train est arrivé avec trente minutes de retard.", note: "en retard = 늦은 상태" },
          { word: "se passer", meanings: ["(일이) 일어나다"], exampleSentence: "Qu'est-ce qui s'est passé ?" },
          { word: "le prochain train", meanings: ["다음 열차"], exampleSentence: "Vous pouvez prendre le prochain train." },
          { word: "les frais", meanings: ["요금", "비용"], exampleSentence: "Sans frais supplémentaires.", note: "복수형이 기본" },
          { word: "le remboursement", meanings: ["환불"], exampleSentence: "Est-ce que je peux demander un remboursement ?" },
        ],
      },
      {
        type: "patternExplanation",
        heading: "무슨 일이 있었는지 — 복합과거로 사건을 보고해요",
        pattern: "J'ai + 과거분사 · Le train est + 과거분사",
        patternKo: "~했어요 / (열차가) ~했어요",
        body:
          "지나간 사건 보고는 **복합과거**가 담당해요. 내가 한 일은 **j'ai raté**(avoir 조동사), 열차의 이동·도착은 **est arrivé**(être 조동사 — 이동 동사)로 갈려요.\n\n" +
          "창구에서는 '사건 나열'이 곧 설명이에요: J'ai raté… → Le train est arrivé en retard… → 순서대로 말하면 끝이에요.",
        examples: [
          { fr: "J'ai raté ma correspondance.", ipa: "[ʒe ʁate ma kɔʁɛspɔ̃dɑ̃s]", ko: "환승편을 놓쳤어요.", note: "avoir + raté" },
          { fr: "Le train est arrivé en retard.", ipa: "[lə tʁɛ̃ ɛt aʁive ɑ̃ ʁətaʁ]", ko: "열차가 늦게 도착했어요.", note: "이동 동사라 être" },
          { fr: "Je suis parti à l'heure.", ipa: "[ʒə sɥi paʁti a lœʁ]", ko: "저는 제시간에 출발했어요.", note: "잘못이 없음을 밝힐 때" },
        ],
        pitfall:
          "J'ai arrivé(×) — arriver는 être 조동사예요(A2-02의 이동 동사 목록). 사건 보고에서 제일 자주 틀리는 지점이에요.",
      },
      {
        type: "patternExplanation",
        heading: "다음 선택지 묻기 — prochain과 remboursement",
        pattern: "Quand part le prochain train ? · Est-ce que je peux demander un remboursement ?",
        patternKo: "다음 열차는 언제 떠나요? · 환불을 요청할 수 있나요?",
        body:
          "상황 설명 뒤에는 해결을 물어요. **le prochain + 명사**(다음 ~)와 **demander un remboursement**(환불 요청)가 창구의 양대 표현이에요.",
        examples: [
          { fr: "Quand part le prochain train pour Paris ?", ipa: "[kɑ̃ paʁ lə pʁɔʃɛ̃ tʁɛ̃ puʁ paʁi]", ko: "파리행 다음 열차는 언제 떠나요?" },
          { fr: "Est-ce que je peux demander un remboursement ?", ipa: "[ɛs kə ʒə pø dəmɑ̃de œ̃ ʁɑ̃buʁsəmɑ̃]", ko: "환불을 요청할 수 있나요?" },
        ],
        tip: "지연 증명이 필요하면 une attestation de retard(지연 확인서)를 요청해요 — 환불·보험 처리의 근거가 돼요.",
      },
      {
        type: "authenticReplay",
        heading: "같은 대화, 이제 다시 읽어 보기",
        presentationFraming: "복합과거를 배웠으니 처음 대화를 다시 읽어 보고, 환불 요청 장면까지 확장해 보세요.",
        original: {
          dialogue: [
            { speaker: "여행자", fr: "Bonjour. J'ai raté ma correspondance à Lyon.", ipa: "[bɔ̃ʒuʁ ʒe ʁate ma kɔʁɛspɔ̃dɑ̃s a ljɔ̃]", ko: "안녕하세요. 리옹에서 환승편을 놓쳤어요." },
            { speaker: "역무원", fr: "Qu'est-ce qui s'est passé ?", ipa: "[kɛs ki sɛ pase]", ko: "무슨 일이 있었나요?" },
            { speaker: "여행자", fr: "Mon premier train est arrivé avec trente minutes de retard.", ipa: "[mɔ̃ pʁəmje tʁɛ̃ ɛt aʁive avɛk tʁɑ̃t minyt də ʁətaʁ]", ko: "첫 열차가 30분 늦게 도착했어요." },
            { speaker: "역무원", fr: "Je comprends. Vous pouvez prendre le prochain train sans frais.", ipa: "[ʒə kɔ̃pʁɑ̃ vu puve pʁɑ̃dʁ lə pʁɔʃɛ̃ tʁɛ̃ sɑ̃ fʁɛ]", ko: "알겠습니다. 추가 요금 없이 다음 열차를 타실 수 있어요." },
          ],
        },
        variant: {
          dialogue: [
            { speaker: "여행자", fr: "Le dernier train est déjà parti. Est-ce que je peux demander un remboursement ?", ipa: "[lə dɛʁnje tʁɛ̃ ɛ deʒa paʁti ɛs kə ʒə pø dəmɑ̃de œ̃ ʁɑ̃buʁsəmɑ̃]", ko: "마지막 열차가 이미 떠났어요. 환불을 요청할 수 있나요?" },
            { speaker: "역무원", fr: "Oui. Vous avez gardé votre billet ?", ipa: "[wi vuz ave gaʁde vɔtʁ bijɛ]", ko: "네. 표는 보관하고 계시죠?" },
            { speaker: "여행자", fr: "Oui, le voici. Le train est arrivé avec une heure de retard.", ipa: "[wi lə vwasi lə tʁɛ̃ ɛt aʁive avɛk yn œʁ də ʁətaʁ]", ko: "네, 여기요. 열차가 한 시간 늦게 도착했거든요." },
            { speaker: "역무원", fr: "D'accord, je fais la demande tout de suite.", ipa: "[dakɔʁ ʒə fɛ la dəmɑ̃d tu də sɥit]", ko: "알겠습니다, 바로 신청해 드릴게요." },
          ],
          transitionNote: "다음 열차 타기에서 환불 요청으로 결이 바뀌지만, '복합과거로 상황 설명 → 해결 요청' 뼈대는 같아요 — est déjà parti와 vous avez gardé가 그대로 나와요.",
        },
        selfCheckOptions: [
          { label: "다 이해했어요 (막힘 없이)", value: "full", fsrsSignal: 1 },
          { label: "부분만 이해했어요 (주요 표현만)", value: "partial", fsrsSignal: 0.5 },
          { label: "아직이에요 (계속 연습 필요)", value: "notready", fsrsSignal: -1 },
        ],
      },
      {
        type: "practiceAndRegistration",
        heading: "연습: 직접 상황을 설명해 보기",
        writingPrompts: [
          "버스를 놓친 상황으로 바꿔, 무슨 일이 있었는지 복합과거 2문장 + 해결 요청 1문장을 만들어 보세요.",
          "같은 상황을 역무원 입장에서 답하는 2문장으로 뒤집어 보세요.",
        ],
        autoRegisterVocabs: true,
      },
    ],
  },
  {
    slug: "a2-scene-14-travel-memories",
    level: "A2",
    order: 14,
    formulaic: true,
    prerequisites: ["a2-03-imparfait", "a2-01-passe-compose-avoir"],
    title: "\"그때 니스는 정말 아름다웠어요\" — 반과거로 여행을 회상해요",
    titleFr: "Raconter un souvenir : l'imparfait en action",
    topic: "여행 회상·배경 묘사(반과거)·사건(복합과거)·감상 나누기",
    summary:
      "지난 여행을 이야기하며 배경·날씨·분위기는 반과거로, 그날의 사건은 복합과거로 갈라 말해요.",
    duration: "약 15분",
    sections: [
      {
        type: "authenticIntro",
        heading: "카페 수다 실전 대화 먼저 만나기",
        presentationFraming:
          "다 이해 안 돼도 정상이에요! 친구끼리 여행 사진을 보며 나누는 수다라 말투가 부드러워요 — c'était(~였어)가 반복해서 보이면 그게 오늘의 주인공이에요.",
        dialogue: [
          { speaker: "친구", fr: "Alors, c'était comment, Nice ?", ipa: "[alɔʁ setɛ kɔmɑ̃ nis]", ko: "그래서, 니스는 어땠어?" },
          { speaker: "여행자", fr: "C'était magnifique. Il faisait beau tous les jours.", ipa: "[setɛ maɲifik il fəzɛ bo tu le ʒuʁ]", ko: "정말 아름다웠어. 매일 날씨가 좋았어." },
          { speaker: "친구", fr: "Qu'est-ce que tu as fait là-bas ?", ipa: "[kɛs kə ty a fɛ la ba]", ko: "거기서 뭐 했어?" },
          { speaker: "여행자", fr: "Un jour, j'ai pris un bateau pour voir la côte.", ipa: "[œ̃ ʒuʁ ʒe pʁi œ̃ bato puʁ vwaʁ la kot]", ko: "하루는 해안을 보러 배를 탔어." },
        ],
      },
      {
        type: "vocabPreview",
        heading: "오늘 배울 단어 6개",
        vocabs: [
          { word: "un souvenir", meanings: ["추억", "기억"], exampleSentence: "C'est un très bon souvenir." },
          { word: "magnifique", meanings: ["아름다운", "멋진"], exampleSentence: "C'était magnifique." },
          { word: "il faisait", meanings: ["날씨가 ~였다"], exampleSentence: "Il faisait beau tous les jours.", note: "il fait의 반과거" },
          { word: "là-bas", meanings: ["거기", "그곳에"], exampleSentence: "Qu'est-ce que tu as fait là-bas ?" },
          { word: "la côte", meanings: ["해안"], exampleSentence: "J'ai pris un bateau pour voir la côte." },
          { word: "tous les jours", meanings: ["매일"], exampleSentence: "Il faisait beau tous les jours." },
        ],
      },
      {
        type: "patternExplanation",
        heading: "배경은 반과거 — c'était과 il faisait",
        pattern: "C'était + 형용사 · Il faisait + 날씨",
        patternKo: "~였어요(분위기) · 날씨가 ~였어요",
        body:
          "회상의 **배경·분위기·날씨**는 반과거가 담당해요. **C'était magnifique**(멋졌어), **Il faisait beau**(날씨가 좋았어) — 언제 시작하고 끝났는지 선을 긋지 않는, 화면을 채우는 과거예요.\n\n" +
          "A2-03에서 배운 반과거의 핵심 용법이 회화에서 가장 자주 나오는 자리예요 — 여행 이야기의 절반은 c'était으로 시작해요.",
        examples: [
          { fr: "C'était magnifique.", ipa: "[setɛ maɲifik]", ko: "정말 아름다웠어요.", note: "감상 한 방" },
          { fr: "Il faisait beau tous les jours.", ipa: "[il fəzɛ bo tu le ʒuʁ]", ko: "매일 날씨가 좋았어요." },
          { fr: "Il y avait beaucoup de monde sur la plage.", ipa: "[iljavɛ boku də mɔ̃d syʁ la plaʒ]", ko: "해변에 사람이 많았어요.", note: "il y a의 반과거" },
        ],
      },
      {
        type: "patternExplanation",
        heading: "사건은 복합과거 — un jour, j'ai…",
        pattern: "Un jour, j'ai + 과거분사",
        patternKo: "하루는 ~했어요 (사건)",
        body:
          "배경(반과거) 위에 **그날 일어난 사건**을 얹을 때 복합과거로 갈아타요. **Un jour, j'ai pris un bateau**(하루는 배를 탔어) — 시작과 끝이 분명한 '장면 전환'이에요.\n\n" +
          "이 갈림이 프랑스어 회상의 문법 전부예요: **화면은 반과거, 사건은 복합과거**.",
        examples: [
          { fr: "Un jour, j'ai pris un bateau.", ipa: "[œ̃ ʒuʁ ʒe pʁi œ̃ bato]", ko: "하루는 배를 탔어요." },
          { fr: "J'ai rencontré des gens très sympas.", ipa: "[ʒe ʁɑ̃kɔ̃tʁe de ʒɑ̃ tʁɛ sɛ̃pa]", ko: "아주 좋은 사람들을 만났어요." },
          { fr: "Pendant que je marchais, j'ai vu un vieux port.", ipa: "[pɑ̃dɑ̃ kə ʒə maʁʃɛ ʒe vy œ̃ vjø pɔʁ]", ko: "걷고 있는데 오래된 항구가 보였어요.", note: "반과거(배경) + 복합과거(사건) 한 문장" },
        ],
        pitfall:
          "감상·분위기까지 복합과거로 말하면 어색한 경우가 많아요 — 여운이 남는 배경 묘사는 c'était이 기본이에요.",
      },
      {
        type: "authenticReplay",
        heading: "같은 대화, 이제 다시 읽어 보기",
        presentationFraming: "반과거·복합과거의 갈림을 배웠으니 처음 수다를 다시 읽어 보고, 아쉬움을 나누는 장면까지 확장해 보세요.",
        original: {
          dialogue: [
            { speaker: "친구", fr: "Alors, c'était comment, Nice ?", ipa: "[alɔʁ setɛ kɔmɑ̃ nis]", ko: "그래서, 니스는 어땠어?" },
            { speaker: "여행자", fr: "C'était magnifique. Il faisait beau tous les jours.", ipa: "[setɛ maɲifik il fəzɛ bo tu le ʒuʁ]", ko: "정말 아름다웠어. 매일 날씨가 좋았어." },
            { speaker: "친구", fr: "Qu'est-ce que tu as fait là-bas ?", ipa: "[kɛs kə ty a fɛ la ba]", ko: "거기서 뭐 했어?" },
            { speaker: "여행자", fr: "Un jour, j'ai pris un bateau pour voir la côte.", ipa: "[œ̃ ʒuʁ ʒe pʁi œ̃ bato puʁ vwaʁ la kot]", ko: "하루는 해안을 보러 배를 탔어." },
          ],
        },
        variant: {
          dialogue: [
            { speaker: "친구", fr: "Tu veux y retourner ?", ipa: "[ty vø i ʁətuʁne]", ko: "다시 가고 싶어?" },
            { speaker: "여행자", fr: "Oui ! Quand j'étais là-bas, je voulais rester une semaine de plus.", ipa: "[wi kɑ̃ ʒetɛ la ba ʒə vulɛ ʁɛste yn səmɛn də plys]", ko: "응! 거기 있을 때 일주일 더 머물고 싶었어." },
            { speaker: "친구", fr: "Et qu'est-ce qui t'a plu le plus ?", ipa: "[e kɛs ki ta ply lə plys]", ko: "뭐가 제일 좋았어?" },
            { speaker: "여행자", fr: "Le marché du matin. Les gens étaient très accueillants.", ipa: "[lə maʁʃe dy matɛ̃ le ʒɑ̃ etɛ tʁɛ akœjɑ̃]", ko: "아침 시장. 사람들이 정말 따뜻했어." },
          ],
          transitionNote: "감상 나누기에서 아쉬움·최고의 순간으로 이야기가 깊어져요 — quand j'étais…(있을 때)와 les gens étaient…(사람들이 ~였어)의 반과거가 그대로 나와요.",
        },
        selfCheckOptions: [
          { label: "다 이해했어요 (막힘 없이)", value: "full", fsrsSignal: 1 },
          { label: "부분만 이해했어요 (주요 표현만)", value: "partial", fsrsSignal: 0.5 },
          { label: "아직이에요 (계속 연습 필요)", value: "notready", fsrsSignal: -1 },
        ],
      },
      {
        type: "practiceAndRegistration",
        heading: "연습: 내 여행을 회상해 보기",
        writingPrompts: [
          "최근 다녀온 곳을 떠올리고, 배경 2문장(c'était·il faisait)과 사건 1문장(un jour, j'ai…)을 만들어 보세요.",
          "같은 이야기를 짝에게 묻는 입장으로 바꿔, c'était comment ?부터 시작하는 질문 2개를 만들어 보세요.",
        ],
        autoRegisterVocabs: true,
      },
    ],
  },
  {
    slug: "a2-15-negation-variants",
    level: "A2",
    order: 15,
    prerequisites: ["a1-04-negation", "a1-09-partitive", "a2-01-passe-compose-avoir"],
    title: "\"크루아상은 이제 없어요\" — 네 가지 부정을 한 세트로",
    titleFr: "Négations : ne… plus, jamais, rien, personne",
    topic: "매진·품절 알아듣기·부정 변형(plus/jamais/rien/personne)·습관 말하기",
    summary:
      "늦은 오후 빵집에서 매진을 알아듣고, ne…pas를 넘어 plus·jamais·rien·personne 네 부정으로 상황과 습관을 말해요.",
    duration: "약 15분",
    sections: [
      {
        type: "authenticIntro",
        heading: "빵집 실전 대화 먼저 만나기",
        presentationFraming:
          "다 이해 안 돼도 정상이에요! 늦은 오후 빵집, 원하는 게 다 팔린 상황이에요 — ne…pas가 아닌 부정이 두 번 나와요. plus(더는)와 rien(아무것도)만 눈에 걸리면 성공이에요.",
        dialogue: [
          { speaker: "여행자", fr: "Bonjour, vous avez encore des croissants ?", ipa: "[bɔ̃ʒuʁ vuz ave ɑ̃kɔʁ de kʁwasɑ̃]", ko: "안녕하세요, 크루아상 아직 있나요?" },
          { speaker: "점원", fr: "Ah, désolée, il n'y a plus de croissants.", ipa: "[a dezɔle il nja ply də kʁwasɑ̃]", ko: "아, 죄송해요, 크루아상은 이제 없어요." },
          { speaker: "여행자", fr: "Vous n'avez rien d'autre ?", ipa: "[vu nave ʁjɛ̃ dotʁ]", ko: "다른 건 아무것도 없나요?" },
          { speaker: "점원", fr: "Il reste deux baguettes. On a tout vendu ce matin !", ipa: "[il ʁɛst dø baɡɛt ɔ̃n a tu vɑ̃dy sə matɛ̃]", ko: "바게트 두 개 남았어요. 오늘 아침에 다 팔렸거든요!" },
          { speaker: "여행자", fr: "Alors une baguette, s'il vous plaît.", ipa: "[alɔʁ yn baɡɛt sil vu plɛ]", ko: "그럼 바게트 하나 주세요." },
        ],
      },
      {
        type: "vocabPreview",
        heading: "오늘 배울 단어 6개",
        vocabs: [
          { word: "ne… plus", meanings: ["더는 ~않다", "이제 없다"], exampleSentence: "Il n'y a plus de croissants.", note: "부정의 plus는 s를 읽지 않아요 [ply]" },
          { word: "ne… jamais", meanings: ["전혀 ~않다", "한 번도 ~않다"], exampleSentence: "Je ne bois jamais de café le soir." },
          { word: "ne… rien", meanings: ["아무것도 ~않다"], exampleSentence: "Vous n'avez rien d'autre ?" },
          { word: "ne… personne", meanings: ["아무도 ~않다"], exampleSentence: "Il n'y a personne sur la terrasse." },
          { word: "Il reste…", meanings: ["~이 남아 있다"], exampleSentence: "Il reste deux baguettes.", note: "비인칭 il — 남은 것이 주어처럼 뒤에 와요" },
          { word: "vendre", meanings: ["팔다"], exampleSentence: "On a tout vendu ce matin.", note: "복합과거 과거분사는 vendu" },
        ],
      },
      {
        type: "patternExplanation",
        heading: "pas 자리를 갈아 끼워요 — 네 부정 한 세트",
        pattern: "ne + 동사 + plus / jamais / rien / personne",
        patternKo: "더는 / 전혀 / 아무것도 / 아무도 ~않다",
        body:
          "부정의 뼈대는 a1-04의 **ne…pas** 그대로예요. pas가 앉던 자리에 다른 낱말을 갈아 끼우면 뜻이 정교해져요: **plus**(더는), **jamais**(전혀·한 번도), **rien**(아무것도), **personne**(아무도).\n\n" +
          "짝이 되는 규칙도 그대로 따라와요 — pas de처럼 **plus de·jamais de** 뒤에서도 관사가 de로 줄어요(a1-09): Il n'y a plus **de** croissants.",
        examples: [
          { fr: "Il n'y a plus de pain.", ipa: "[il nja ply də pɛ̃]", ko: "빵이 이제 없어요.", note: "매진의 공식 문형" },
          { fr: "Je ne prends jamais de sucre.", ipa: "[ʒə nə pʁɑ̃ ʒamɛ də sykʁ]", ko: "설탕은 전혀 안 넣어요.", note: "습관의 부정" },
          { fr: "Je ne vois rien.", ipa: "[ʒə nə vwa ʁjɛ̃]", ko: "아무것도 안 보여요." },
          { fr: "Personne ne répond.", ipa: "[pɛʁsɔn nə ʁepɔ̃]", ko: "아무도 응답하지 않아요.", note: "personne이 주어면 문장 맨 앞 + ne" },
        ],
        pitfall:
          "Je ne mange pas plus(×)처럼 pas와 겹쳐 쓰지 않아요 — plus·jamais·rien·personne는 pas의 자리를 대신하는 낱말이에요. 하나만 골라요.",
        tip:
          "프랑스 빵집은 보통 하루 두 번 굽어서, 저녁이면 정말로 il n'y a plus예요. 갓 나온 빵을 원하면 아침이나 오후 4시쯤이 노려 볼 시간이에요.",
      },
      {
        type: "patternExplanation",
        heading: "과거·주어 자리에서도 그대로 — rien과 personne의 위치",
        pattern: "Je n'ai rien acheté · Je n'ai vu personne",
        patternKo: "아무것도 안 샀어요 · 아무도 못 봤어요",
        body:
          "복합과거(a2-01)와 만나면 자리만 조심해요: **rien은 조동사와 과거분사 사이**(Je n'ai **rien** acheté), **personne은 과거분사 뒤**(Je n'ai vu **personne**)예요.\n\n" +
          "jamais는 rien과 같은 자리예요: Nous n'avons **jamais** visité Lyon — '한 번도 ~해 본 적 없다'는 경험 부정이 이 한 줄로 끝나요.",
        examples: [
          { fr: "Je n'ai rien acheté.", ipa: "[ʒə ne ʁjɛ̃ aʃte]", ko: "아무것도 안 샀어요.", note: "rien은 acheté 앞" },
          { fr: "Je n'ai vu personne.", ipa: "[ʒə ne vy pɛʁsɔn]", ko: "아무도 못 봤어요.", note: "personne은 vu 뒤" },
          { fr: "Nous n'avons jamais visité Lyon.", ipa: "[nu navɔ̃ ʒamɛ vizite ljɔ̃]", ko: "리옹은 한 번도 가 본 적이 없어요.", note: "경험 부정" },
        ],
      },
      {
        type: "authenticReplay",
        heading: "같은 대화, 이제 다시 읽어 보기",
        presentationFraming: "네 부정을 배웠으니 빵집 대화를 다시 읽어 보고, 저녁 카페의 새 장면까지 확장해 보세요.",
        original: {
          dialogue: [
            { speaker: "여행자", fr: "Bonjour, vous avez encore des croissants ?", ipa: "[bɔ̃ʒuʁ vuz ave ɑ̃kɔʁ de kʁwasɑ̃]", ko: "안녕하세요, 크루아상 아직 있나요?" },
            { speaker: "점원", fr: "Ah, désolée, il n'y a plus de croissants.", ipa: "[a dezɔle il nja ply də kʁwasɑ̃]", ko: "아, 죄송해요, 크루아상은 이제 없어요." },
            { speaker: "여행자", fr: "Vous n'avez rien d'autre ?", ipa: "[vu nave ʁjɛ̃ dotʁ]", ko: "다른 건 아무것도 없나요?" },
            { speaker: "점원", fr: "Il reste deux baguettes. On a tout vendu ce matin !", ipa: "[il ʁɛst dø baɡɛt ɔ̃n a tu vɑ̃dy sə matɛ̃]", ko: "바게트 두 개 남았어요. 오늘 아침에 다 팔렸거든요!" },
            { speaker: "여행자", fr: "Alors une baguette, s'il vous plaît.", ipa: "[alɔʁ yn baɡɛt sil vu plɛ]", ko: "그럼 바게트 하나 주세요." },
          ],
        },
        variant: {
          dialogue: [
            { speaker: "클레르", fr: "Tu veux un café ?", ipa: "[ty vø œ̃ kafe]", ko: "커피 마실래?" },
            { speaker: "민수", fr: "Non merci, je ne bois jamais de café le soir.", ipa: "[nɔ̃ mɛʁsi ʒə nə bwa ʒamɛ də kafe lə swaʁ]", ko: "고맙지만 사양할게, 난 저녁엔 커피를 전혀 안 마셔." },
            { speaker: "클레르", fr: "Moi non plus. Un thé, alors ?", ipa: "[mwa nɔ̃ ply œ̃ te alɔʁ]", ko: "나도 안 마셔. 그럼 차 마실까?" },
            { speaker: "민수", fr: "Regarde, il n'y a personne sur la terrasse ce soir.", ipa: "[ʁəɡaʁd il nja pɛʁsɔn syʁ la teʁas sə swaʁ]", ko: "봐, 오늘 저녁엔 테라스에 아무도 없어." },
            { speaker: "클레르", fr: "Tant mieux, on est tranquilles !", ipa: "[tɑ̃ mjø ɔ̃n ɛ tʁɑ̃kil]", ko: "잘됐네, 우리끼리 조용하고!" },
          ],
          transitionNote: "빵집 매진(plus·rien)에서 저녁 카페의 습관·주변 이야기(jamais·personne)로 장면이 바뀌어요 — 상대가 vous에서 tu로 바뀌어도, ne와 짝을 이루는 네 낱말이 한 세트라는 건 그대로예요.",
        },
        selfCheckOptions: [
          { label: "다 이해했어요 (막힘 없이)", value: "full", fsrsSignal: 1 },
          { label: "부분만 이해했어요 (주요 표현만)", value: "partial", fsrsSignal: 0.5 },
          { label: "아직이에요 (계속 연습 필요)", value: "notready", fsrsSignal: -1 },
        ],
      },
      {
        type: "practiceAndRegistration",
        heading: "연습: 내 부정문 만들기",
        writingPrompts: [
          "요즘 그만둔 습관 하나를 ne… plus로, 한 번도 안 해 본 일 하나를 ne… jamais로 말해 보세요.",
          "가게에서 원하는 물건이 다 팔린 상황을 상상하고, rien으로 묻는 손님 문장과 plus로 답하는 점원 문장을 지어 보세요.",
        ],
        autoRegisterVocabs: true,
      },
    ],
  },
];

export default chapters;
