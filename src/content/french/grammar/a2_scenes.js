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
  {
    slug: "a2-16-si-conditions",
    level: "A2",
    order: 16,
    prerequisites: ["a1-15-modal-faire-present", "a1-30-elision", "a2-07-futur-simple"],
    title: "\"비 오면 미술관 가자\" — si 하나로 계획을 세워요",
    titleFr: "Si on part tôt… : proposer et planifier",
    topic: "주말 계획·제안(si + 현재)·플랜 B·조건 표현",
    summary:
      "친구와 주말 계획을 짜며 si + 현재로 제안하고, 비 오는 경우의 플랜 B까지 조건으로 말해요.",
    duration: "약 15분",
    sections: [
      {
        type: "authenticIntro",
        heading: "주말 계획 실전 대화 먼저 만나기",
        presentationFraming:
          "다 이해 안 돼도 정상이에요! 친구끼리 일요일 계획을 흥정하는 수다예요 — 문장마다 앞에 붙는 si(만약 ~하면) 하나만 눈에 걸리면 성공이에요.",
        dialogue: [
          { speaker: "클레르", fr: "Qu'est-ce qu'on fait dimanche ?", ipa: "[kɛs kɔ̃ fɛ dimɑ̃ʃ]", ko: "일요일에 뭐 할까?" },
          { speaker: "민수", fr: "Si tu veux, on peut faire un pique-nique au bord de la Seine.", ipa: "[si ty vø ɔ̃ pø fɛʁ œ̃ piknik o bɔʁ də la sɛn]", ko: "네가 원하면 센 강변에서 피크닉 할 수 있어." },
          { speaker: "클레르", fr: "Bonne idée ! Si on part tôt, on trouve une bonne place.", ipa: "[bɔn ide si ɔ̃ paʁ to ɔ̃ tʁuv yn bɔn plas]", ko: "좋은 생각이야! 일찍 나서면 좋은 자리를 잡아." },
          { speaker: "민수", fr: "Parfait. Si tu apportes le pain, moi, j'apporte le fromage.", ipa: "[paʁfɛ si ty apɔʁt lə pɛ̃ mwa ʒapɔʁt lə fʁɔmaʒ]", ko: "완벽해. 네가 빵을 가져오면 나는 치즈를 가져올게." },
          { speaker: "클레르", fr: "Marché conclu !", ipa: "[maʁʃe kɔ̃kly]", ko: "그럼 결정!" },
        ],
      },
      {
        type: "vocabPreview",
        heading: "오늘 배울 단어 6개",
        vocabs: [
          { word: "si", meanings: ["만약 ~하면"], exampleSentence: "Si tu veux, on peut faire un pique-nique.", note: "il 앞에서는 s'il로 줄어요(엘리종)" },
          { word: "apporter", meanings: ["가져오다"], exampleSentence: "Si tu apportes le pain, moi, j'apporte le fromage." },
          { word: "le pique-nique", meanings: ["피크닉"], exampleSentence: "On peut faire un pique-nique au bord de la Seine." },
          { word: "tôt", meanings: ["일찍"], exampleSentence: "Si on part tôt, on trouve une bonne place.", note: "반대말은 tard(늦게)" },
          { word: "faire la queue", meanings: ["줄을 서다"], exampleSentence: "On ne fait pas la queue." },
          { word: "en ligne", meanings: ["온라인으로"], exampleSentence: "On prend les billets en ligne." },
        ],
      },
      {
        type: "patternExplanation",
        heading: "조건은 현재형으로 — si + 현재, 뒤는 제안",
        pattern: "Si + 현재, on peut… / 현재",
        patternKo: "~하면, ~할 수 있어 / ~해",
        body:
          "계획과 제안의 열쇠는 **si + 현재형**이에요. 조건을 현재로 말하고, 뒤 문장에서 제안(**on peut…**)이나 결과(현재)를 붙이면 끝이에요.\n\n" +
          "한국어 '~하면'에 이끌려 si 뒤에 미래를 쓰고 싶어지지만, **si절은 현재형**이 규칙이에요. il 앞에서는 **s'il**로 줄어드는 것(a1-30 엘리종)도 함께 기억해요.",
        examples: [
          { fr: "Si tu veux, on peut faire un pique-nique.", ipa: "[si ty vø ɔ̃ pø fɛʁ œ̃ piknik]", ko: "네가 원하면 피크닉 할 수 있어.", note: "제안의 기본형" },
          { fr: "Si on part tôt, on trouve une bonne place.", ipa: "[si ɔ̃ paʁ to ɔ̃ tʁuv yn bɔn plas]", ko: "일찍 나서면 좋은 자리를 잡아.", note: "조건 → 결과(현재)" },
          { fr: "S'il pleut, on va au musée.", ipa: "[sil plø ɔ̃ va o myze]", ko: "비 오면 미술관에 가.", note: "si + il = s'il" },
        ],
        pitfall:
          "Si je serai libre(×) — si절에는 미래형을 쓰지 않아요. Si je suis libre(○, 현재형)처럼 조건은 항상 현재로 말해요.",
        tip:
          "프랑스 일요일은 상점 대부분이 문을 닫아요 — 대신 아침 시장과 공원 피크닉이 일요일의 풍경이에요. 여행 일정을 짤 때 일요일은 시장·공원 날로 잡는 게 요령이에요.",
      },
      {
        type: "patternExplanation",
        heading: "계획은 미래로, 걱정은 Et si…? 로",
        pattern: "Si + 현재, 주절 futur simple · Et si… ?",
        patternKo: "~하면 ~할 거야 · 근데 ~하면?",
        body:
          "확정에 가까운 계획은 주절을 **futur simple**(a2-07)로 올려 말해요: Si tu viens à Paris, on **ira** au bord de la Seine.\n\n" +
          "상대의 계획에 변수를 던질 때는 **Et si… ?**(근데 ~하면?) 한 마디면 돼요 — 플랜 B를 부르는 신호예요.",
        examples: [
          { fr: "Si tu viens à Paris, on ira au bord de la Seine.", ipa: "[si ty vjɛ̃ a paʁi ɔ̃n iʁa o bɔʁ də la sɛn]", ko: "네가 파리에 오면 우리 센 강변에 갈 거야.", note: "주절만 미래" },
          { fr: "Et s'il pleut dimanche ?", ipa: "[e sil plø dimɑ̃ʃ]", ko: "근데 일요일에 비 오면?", note: "변수 던지기" },
          { fr: "Et si le train est complet ?", ipa: "[e si lə tʁɛ̃ ɛ kɔ̃plɛ]", ko: "근데 기차가 만석이면?" },
        ],
      },
      {
        type: "authenticReplay",
        heading: "같은 대화, 이제 다시 읽어 보기",
        presentationFraming: "si + 현재를 배웠으니 계획 수다를 다시 읽어 보고, 비 오는 날의 플랜 B 장면까지 확장해 보세요.",
        original: {
          dialogue: [
            { speaker: "클레르", fr: "Qu'est-ce qu'on fait dimanche ?", ipa: "[kɛs kɔ̃ fɛ dimɑ̃ʃ]", ko: "일요일에 뭐 할까?" },
            { speaker: "민수", fr: "Si tu veux, on peut faire un pique-nique au bord de la Seine.", ipa: "[si ty vø ɔ̃ pø fɛʁ œ̃ piknik o bɔʁ də la sɛn]", ko: "네가 원하면 센 강변에서 피크닉 할 수 있어." },
            { speaker: "클레르", fr: "Bonne idée ! Si on part tôt, on trouve une bonne place.", ipa: "[bɔn ide si ɔ̃ paʁ to ɔ̃ tʁuv yn bɔn plas]", ko: "좋은 생각이야! 일찍 나서면 좋은 자리를 잡아." },
            { speaker: "민수", fr: "Parfait. Si tu apportes le pain, moi, j'apporte le fromage.", ipa: "[paʁfɛ si ty apɔʁt lə pɛ̃ mwa ʒapɔʁt lə fʁɔmaʒ]", ko: "완벽해. 네가 빵을 가져오면 나는 치즈를 가져올게." },
            { speaker: "클레르", fr: "Marché conclu !", ipa: "[maʁʃe kɔ̃kly]", ko: "그럼 결정!" },
          ],
        },
        variant: {
          dialogue: [
            { speaker: "클레르", fr: "Et s'il pleut dimanche ?", ipa: "[e sil plø dimɑ̃ʃ]", ko: "근데 일요일에 비 오면?" },
            { speaker: "민수", fr: "S'il pleut, on va au musée d'Orsay.", ipa: "[sil plø ɔ̃ va o myze dɔʁsɛ]", ko: "비 오면 오르세 미술관에 가자." },
            { speaker: "클레르", fr: "Bonne idée. Si on prend les billets en ligne, on ne fait pas la queue.", ipa: "[bɔn ide si ɔ̃ pʁɑ̃ le bijɛ ɑ̃ liɲ ɔ̃ nə fɛ pa la kø]", ko: "좋은 생각이야. 온라인으로 표를 사면 줄을 안 서." },
            { speaker: "민수", fr: "Et si le musée est fermé, on prend juste un chocolat chaud quelque part.", ipa: "[e si lə myze ɛ fɛʁme ɔ̃ pʁɑ̃ ʒyst œ̃ ʃɔkɔla ʃo kɛlkə paʁ]", ko: "미술관이 닫았으면 그냥 어디서 핫초콜릿이나 마시자." },
          ],
          transitionNote: "화창한 플랜 A(피크닉 흥정)에서 비 오는 플랜 B로 장면이 바뀌어요 — si가 '제안 카드를 꺼내는 말'이라는 건 그대로고, si + il이 s'il로 줄어드는 엘리종이 새로 등장해요.",
        },
        selfCheckOptions: [
          { label: "다 이해했어요 (막힘 없이)", value: "full", fsrsSignal: 1 },
          { label: "부분만 이해했어요 (주요 표현만)", value: "partial", fsrsSignal: 0.5 },
          { label: "아직이에요 (계속 연습 필요)", value: "notready", fsrsSignal: -1 },
        ],
      },
      {
        type: "practiceAndRegistration",
        heading: "연습: 내 주말 계획 흥정하기",
        writingPrompts: [
          "친구에게 주말 제안 하나를 Si tu veux, on peut…로 시작해 만들어 보세요.",
          "그 계획의 변수 하나를 Et si… ?로 던지고, 플랜 B를 S'il/Si + 현재로 답해 보세요.",
        ],
        autoRegisterVocabs: true,
      },
    ],
  },
  {
    slug: "a2-17-narrative-connectors",
    level: "A2",
    order: 17,
    prerequisites: ["a2-01-passe-compose-avoir", "a2-02-passe-compose-etre", "a2-03-imparfait"],
    title: "\"먼저 버스를 탔고, 마지막엔 밀물을 봤어\" — 하루를 이야기로 엮어요",
    titleFr: "D'abord, ensuite, enfin : raconter sa journée",
    topic: "하루 여행기·서사 연결사(d'abord/ensuite/enfin)·복합과거×반과거 종합",
    summary:
      "몽생미셸 당일치기 이야기를 d'abord·ensuite·enfin으로 엮고, 사건은 복합과거·배경은 반과거로 나눠 담아요.",
    duration: "약 15분",
    sections: [
      {
        type: "authenticIntro",
        heading: "하루 여행기 실전 대화 먼저 만나기",
        presentationFraming:
          "다 이해 안 돼도 정상이에요! 친구에게 하루를 통째로 들려주는 수다예요 — 이야기의 마디마다 붙는 d'abord(먼저)·ensuite(그다음)·enfin(마지막으로) 세 낱말만 눈에 걸리면 성공이에요.",
        dialogue: [
          { speaker: "클레르", fr: "Alors, ta journée au Mont-Saint-Michel ?", ipa: "[alɔʁ ta ʒuʁne o mɔ̃ sɛ̃ miʃɛl]", ko: "그래서, 몽생미셸에서 하루 어땠어?" },
          { speaker: "민수", fr: "Incroyable ! D'abord, on a pris le bus très tôt.", ipa: "[ɛ̃kʁwajabl dabɔʁ ɔ̃n a pʁi lə bys tʁɛ to]", ko: "굉장했어! 먼저 아침 일찍 버스를 탔어." },
          { speaker: "클레르", fr: "Et ensuite ?", ipa: "[e ɑ̃sɥit]", ko: "그리고 그다음엔?" },
          { speaker: "민수", fr: "Ensuite, on a visité l'abbaye, et enfin, on a regardé la marée. La mer montait très vite !", ipa: "[ɑ̃sɥit ɔ̃n a vizite labei e ɑ̃fɛ̃ ɔ̃n a ʁəɡaʁde la maʁe la mɛʁ mɔ̃tɛ tʁɛ vit]", ko: "그다음에 수도원을 구경했고, 마지막엔 밀물을 봤어. 바닷물이 정말 빠르게 차올랐어!" },
          { speaker: "클레르", fr: "Quelle journée ! Tu as pris des photos ?", ipa: "[kɛl ʒuʁne ty a pʁi de fɔto]", ko: "완전 알찬 하루네! 사진 찍었어?" },
        ],
      },
      {
        type: "vocabPreview",
        heading: "오늘 배울 단어 6개",
        vocabs: [
          { word: "d'abord", meanings: ["먼저", "우선"], exampleSentence: "D'abord, on a pris le bus." },
          { word: "ensuite", meanings: ["그다음에"], exampleSentence: "Ensuite, on a visité l'abbaye." },
          { word: "enfin", meanings: ["마지막으로", "마침내"], exampleSentence: "Enfin, on a regardé la marée." },
          { word: "la marée", meanings: ["조수", "밀물·썰물"], exampleSentence: "La mer montait très vite.", note: "marée haute 밀물 / marée basse 썰물" },
          { word: "l'abbaye", meanings: ["수도원"], exampleSentence: "On a visité l'abbaye.", note: "발음 [abei] — b 하나만 읽어요" },
          { word: "la journée", meanings: ["하루", "낮 동안"], exampleSentence: "Quelle journée !", note: "jour(날)와 달리 '꽉 찬 하루'의 느낌" },
        ],
      },
      {
        type: "patternExplanation",
        heading: "서사의 골격 — 먼저·그다음·마지막으로",
        pattern: "D'abord…, ensuite…, enfin… + 복합과거",
        patternKo: "먼저 ~했고, 그다음 ~했고, 마지막으로 ~했어요",
        body:
          "지난 일을 이야기로 엮는 골격은 **연결사 세 단**이에요: **d'abord**(먼저) → **ensuite**(그다음) → **enfin**(마지막으로). 각 마디에 사건을 복합과거(a2-01·02)로 하나씩 얹으면, 낱문장이 아니라 '이야기'가 돼요.\n\n" +
          "구어에서는 상대가 **Et ensuite ?**(그다음엔?) **Et après ?**(그리고?)로 장단을 맞춰 줘요 — 서사는 혼자 말하기가 아니라 주고받기예요.",
        examples: [
          { fr: "D'abord, on a pris le bus.", ipa: "[dabɔʁ ɔ̃n a pʁi lə bys]", ko: "먼저 버스를 탔어요.", note: "사건 1 — 복합과거" },
          { fr: "Ensuite, on a visité l'abbaye.", ipa: "[ɑ̃sɥit ɔ̃n a vizite labei]", ko: "그다음에 수도원을 구경했어요.", note: "사건 2" },
          { fr: "Enfin, on est rentrés le soir.", ipa: "[ɑ̃fɛ̃ ɔ̃n ɛ ʁɑ̃tʁe lə swaʁ]", ko: "마지막으로 저녁에 돌아왔어요.", note: "rentrer는 être 조동사(a2-02)" },
        ],
        pitfall:
          "et après, et après…만 반복하면 이야기가 늘어져요 — d'abord → ensuite → enfin 세 단으로 정리하면 같은 내용도 또렷한 서사가 돼요.",
        tip:
          "몽생미셸의 조수는 유럽에서 가장 커서, 밀물이 '말이 달리는 속도로 온다'는 말이 있을 정도예요. 물때표(horaires des marées)를 확인하고 가면 바다가 섬을 감싸는 장면을 만날 수 있어요.",
      },
      {
        type: "patternExplanation",
        heading: "사건은 복합과거, 배경은 반과거 — 서사의 두 층",
        pattern: "복합과거(사건) × 반과거(배경·상태)",
        patternKo: "~했어요(사건) × ~하고 있었어요/~였어요(배경)",
        body:
          "연결사가 이야기의 뼈대라면, 시제는 이야기의 두 층이에요. **무슨 일이 있었는지는 복합과거**, **그때 어땠는지는 반과거**(a2-03)가 맡아요.\n\n" +
          "Il y avait beaucoup de monde(사람이 많았다), la mer montait(물이 차오르고 있었다) — 배경 문장이 끼어들수록 이야기가 살아나요.",
        examples: [
          { fr: "Il y avait beaucoup de monde.", ipa: "[il javɛ boku də mɔ̃d]", ko: "사람이 많았어요.", note: "배경 — 반과거" },
          { fr: "Ensuite, il pleuvait, et je n'avais pas de parapluie.", ipa: "[ɑ̃sɥit il pløvɛ e ʒə navɛ pa də paʁaplɥi]", ko: "그다음엔 비가 오는데 우산이 없었어요.", note: "상태의 나열도 반과거" },
          { fr: "Quand on est arrivés, la mer montait déjà.", ipa: "[kɑ̃t ɔ̃n ɛt aʁive la mɛʁ mɔ̃tɛ deʒa]", ko: "도착했을 때 바닷물이 이미 차오르고 있었어요.", note: "사건×배경을 한 문장에" },
        ],
        tip:
          "프랑스 국공립 미술관·기념물은 월요일이나 화요일에 쉬는 곳이 많아요 — '월요일 휴관'은 여행자의 단골 참사예요. 일정을 짤 때 휴관일부터 확인해요.",
      },
      {
        type: "authenticReplay",
        heading: "같은 대화, 이제 다시 읽어 보기",
        presentationFraming: "서사의 골격을 배웠으니 여행기를 다시 읽어 보고, 반대로 '엉망이 된 하루'를 같은 골격으로 듣는 장면까지 확장해 보세요.",
        original: {
          dialogue: [
            { speaker: "클레르", fr: "Alors, ta journée au Mont-Saint-Michel ?", ipa: "[alɔʁ ta ʒuʁne o mɔ̃ sɛ̃ miʃɛl]", ko: "그래서, 몽생미셸에서 하루 어땠어?" },
            { speaker: "민수", fr: "Incroyable ! D'abord, on a pris le bus très tôt.", ipa: "[ɛ̃kʁwajabl dabɔʁ ɔ̃n a pʁi lə bys tʁɛ to]", ko: "굉장했어! 먼저 아침 일찍 버스를 탔어." },
            { speaker: "클레르", fr: "Et ensuite ?", ipa: "[e ɑ̃sɥit]", ko: "그리고 그다음엔?" },
            { speaker: "민수", fr: "Ensuite, on a visité l'abbaye, et enfin, on a regardé la marée. La mer montait très vite !", ipa: "[ɑ̃sɥit ɔ̃n a vizite labei e ɑ̃fɛ̃ ɔ̃n a ʁəɡaʁde la maʁe la mɛʁ mɔ̃tɛ tʁɛ vit]", ko: "그다음에 수도원을 구경했고, 마지막엔 밀물을 봤어. 바닷물이 정말 빠르게 차올랐어!" },
            { speaker: "클레르", fr: "Quelle journée ! Tu as pris des photos ?", ipa: "[kɛl ʒuʁne ty a pʁi de fɔto]", ko: "완전 알찬 하루네! 사진 찍었어?" },
          ],
        },
        variant: {
          dialogue: [
            { speaker: "민수", fr: "Et toi, ta journée à Paris ?", ipa: "[e twa ta ʒuʁne a paʁi]", ko: "너는? 파리에서 하루 어땠어?" },
            { speaker: "클레르", fr: "Quelle catastrophe ! D'abord, j'ai raté le métro.", ipa: "[kɛl katastʁɔf dabɔʁ ʒe ʁate lə metʁo]", ko: "완전 재난이었어! 먼저 지하철을 놓쳤어." },
            { speaker: "민수", fr: "Oh non. Et après ?", ipa: "[o nɔ̃ e apʁɛ]", ko: "저런. 그리고?" },
            { speaker: "클레르", fr: "Ensuite, il pleuvait, et je n'avais pas de parapluie. Enfin, le musée était fermé le lundi !", ipa: "[ɑ̃sɥit il pløvɛ e ʒə navɛ pa də paʁaplɥi ɑ̃fɛ̃ lə myze etɛ fɛʁme lə lœ̃di]", ko: "그다음엔 비가 오는데 우산이 없었어. 결정타로, 미술관이 월요일 휴관이었어!" },
            { speaker: "민수", fr: "Ma pauvre ! Si tu veux, on y retourne ensemble mardi.", ipa: "[ma povʁ si ty vø ɔ̃n i ʁətuʁn ɑ̃sɑ̃bl maʁdi]", ko: "저런! 원하면 화요일에 같이 다시 가자." },
          ],
          transitionNote: "빛나는 하루에서 엉망이 된 하루로 이야기가 뒤집혀요 — 그래도 d'abord·ensuite·enfin 골격은 그대로고, 비·우산 없음·휴관 같은 배경은 전부 반과거가 받쳐요. 마지막 위로에는 si(a2-16)와 y(a2-09)가 그대로 나와요.",
        },
        selfCheckOptions: [
          { label: "다 이해했어요 (막힘 없이)", value: "full", fsrsSignal: 1 },
          { label: "부분만 이해했어요 (주요 표현만)", value: "partial", fsrsSignal: 0.5 },
          { label: "아직이에요 (계속 연습 필요)", value: "notready", fsrsSignal: -1 },
        ],
      },
      {
        type: "practiceAndRegistration",
        heading: "연습: 내 하루를 서사로",
        writingPrompts: [
          "최근의 '좋았던 하루'를 d'abord·ensuite·enfin 세 문장으로 엮어 보세요 — 사건은 복합과거로.",
          "반대로 '엉망이었던 하루'를 같은 골격으로 만들되, 배경·상태 한 문장은 반과거로 넣어 보세요.",
        ],
        autoRegisterVocabs: true,
      },
    ],
  },
];

export default chapters;
