/**
 * A2 실전 장면 — 샌드위치 v2 신규 저작 (오너 확정: fr A1~A2 시험 적용, 배치 5)
 * 복합과거·반과거를 실전 대화에서 먼저 만나고 문법으로 되짚는 2레슨.
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
    duration: "약 12분",
    sections: [
      {
        type: "authenticIntro",
        heading: "창구 실전 대화 통째로 듣기",
        presentationFraming:
          "못 알아들어도 정상이에요! 이미 벌어진 일을 설명하는 대화라 동사가 전부 과거형이에요 — j'ai raté(놓쳤어요)와 est arrivé(도착했어요) 두 소리만 귀에 걸리면 충분해요.",
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
        heading: "같은 대화, 이제 다시 들어 보기",
        presentationFraming: "복합과거를 배웠으니 처음 대화를 다시 들어 보고, 환불 요청 장면까지 확장해 보세요.",
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
          { label: "다 들렸어요 (정확히 이해)", value: "full", fsrsSignal: 1 },
          { label: "부분만 들렸어요 (주요 단어만)", value: "partial", fsrsSignal: 0.5 },
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
    duration: "약 12분",
    sections: [
      {
        type: "authenticIntro",
        heading: "카페 수다 실전 대화 통째로 듣기",
        presentationFraming:
          "못 알아들어도 정상이에요! 친구끼리 여행 사진을 보며 나누는 수다라 말투가 부드러워요 — c'était(~였어)가 반복해서 들리면 그게 오늘의 주인공이에요.",
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
        heading: "같은 대화, 이제 다시 들어 보기",
        presentationFraming: "반과거·복합과거의 갈림을 배웠으니 처음 수다를 다시 들어 보고, 아쉬움을 나누는 장면까지 확장해 보세요.",
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
          { label: "다 들렸어요 (정확히 이해)", value: "full", fsrsSignal: 1 },
          { label: "부분만 들렸어요 (주요 단어만)", value: "partial", fsrsSignal: 0.5 },
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
];

export default chapters;
