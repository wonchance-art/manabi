/**
 * RFC v2 "실전 샌드위치" 파일럿 — 프랑스어 A1 장면 레슨 2개
 *
 * 구조: 5단 (authenticIntro + vocabPreview + patternExplanation + authenticReplay + practiceAndRegistration)
 * 상태: PILOT (draft PR 단계, 검증 후 본격 확장)
 * 라이선스 주: 파일럿 창작 대화(표시용 placeholder) — 실음원·Tatoeba 원문 연결은 다음 단계
 *
 * 파일럿 사양:
 * - 오디오: 텍스트 대화로 구성 (실제 mp3 수집은 다음 단계)
 * - source/license: 실자료 연결 전이므로 placeholder 명시(가짜 출처 표기 금지)
 * - 어휘: cardModel.registerNoteFromLesson 연계
 * - 렌더: ReferenceChapterPage v2 수정 필요
 */

export const FRENCH_A1_SANDWICH_PILOT_STATUS = "PILOT_DRAFT";

const chapters = [
  {
    slug: "a1-pilot-32-cafe-voudrais",
    level: "A1",
    order: 32,
    status: FRENCH_A1_SANDWICH_PILOT_STATUS,
    title: "카페에서 음료 주문하기",
    topic: "주문·공손 표현·음료 이름",
    titleFr: "Commander une boisson au café",
    summary:
      "카페에서 원하는 음료를 주문해요. '저는 ~를 원해요(Je voudrais ~)'를 배우고, 실제 카페 대화를 듣고, 여러 상황에서 같은 표현을 써 봐요.",
    duration: "약 10분",
    sections: [
      // ① 실전 선노출 (authenticIntro)
      {
        type: "authenticIntro",
        heading: "카페 주문 실전 대화 들어 보기",
        presentationFraming:
          "못 알아들어도 정상이에요! 전체 대화를 몇 번 들으면서 '주문하는 사람'과 '카페 직원'의 목소리 차이를 느껴 보세요.",
        audio: {
          status: "placeholder",
          sourceId: "pilot-fr-cafe-01",
          duration: "0:28",
          attribution: "파일럿 창작 대화 — 실음원·원문 출처 연결 예정",
        },
        captions: {
          original:
            "— Bonjour, qu'est-ce que vous prenez?\n— Je voudrais un café, s'il vous plaît.\n— Un café crème ou un expresso?\n— Un expresso, merci.\n— Voilà, c'est trois euros.",
          translation:
            "— 안녕하세요, 뭘 드릴까요?\n— 저는 커피를 원해요, 부탁해요.\n— 크림 커피인가요, 에스프레소인가요?\n— 에스프레소로 주세요, 감사해요.\n— 여기 있어요, 3유로예요.",
        },
      },

      // ② 어휘 프리뷰 (vocabPreview)
      {
        type: "vocabPreview",
        heading: "오늘 배울 단어 5개",
        vocabs: [
          {
            word: "voudrais",
            meanings: ["원하다 (조건법)", "~를 원해요"],
            exampleSentence: "Je voudrais un café.",
            note: "vouloir의 조건법형 — 공손한 '원하다'",
          },
          {
            word: "café",
            meanings: ["커피", "카페"],
            exampleSentence: "Un café, s'il vous plaît.",
          },
          {
            word: "crème",
            meanings: ["크림", "크림 커피"],
            exampleSentence: "Un café crème.",
          },
          {
            word: "expresso",
            meanings: ["에스프레소"],
            exampleSentence: "Un expresso, merci.",
          },
          {
            word: "s'il vous plaît",
            meanings: ["부탁해요 (존댓말)", "please (formal)"],
            exampleSentence: "Un café, s'il vous plaît.",
            note: "가장 기본 공손 표현",
          },
        ],
      },

      // ③ 문법 패턴 (patternExplanation) — v1 호환 섹션
      {
        type: "patternExplanation",
        heading: "Je voudrais + 명사 — 공손하게 뭔가를 원하기",
        pattern: "Je voudrais + 명사",
        patternKo: "저는 ~를 원해요 (공손)",
        body:
          "**Je voudrais** (쥬 부드레)는 vouloir(원하다) 동사의 조건법 1인칭 단수 형태예요. \n\n" +
          "**'Je veux'는 '나 원해!'로 다소 거칠**지만, **'Je voudrais'는 '저는... 원해요'로 공손하고 정중**해요. 카페, 식당, 가게에서 주문할 때 쓰는 기본 표현이에요.\n\n" +
          "**패턴**: Je voudrais + 명사(un/une + 물건)\n" +
          "예: Je voudrais un café (커피를 원해요) / Je voudrais une eau (물을 원해요)",
        examples: [
          {
            fr: "Je voudrais un café, s'il vous plaît.",
            ko: "저는 커피를 원해요, 부탁합니다.",
            tip: "가장 기본적인 카페 주문",
          },
          {
            fr: "Je voudrais un croissant.",
            ko: "저는 크루아상을 원해요.",
            tip: "음식도 같은 패턴",
          },
          {
            fr: "Je voudrais l'addition, s'il vous plaît.",
            ko: "저는 계산서를 원해요, 부탁합니다.",
            note: "식당에서 계산할 때",
          },
        ],
        pitfall:
          "❌ 틀림: 'Je voudrais café' (명사 앞 관사 빠짐)\n✅ 맞음: 'Je voudrais un café' (관사 필수)",
      },

      // ④ 재노출 (authenticReplay)
      {
        type: "authenticReplay",
        heading: "같은 표현, 다른 상황에서",
        presentationFraming: "이제 같은 '주문' 상황을 2번 더 들어 보고, 마지막에 자신의 이해도를 체크해 보세요.",
        original: {
          audio: {
            status: "placeholder",
            sourceId: "pilot-fr-cafe-01",
            attribution: "파일럿 창작 대화 — 실음원·원문 출처 연결 예정",
            duration: "0:28",
          },
          captions: {
            original:
              "— Bonjour, qu'est-ce que vous prenez?\n— Je voudrais un café, s'il vous plaît.\n— Un café crème ou un expresso?\n— Un expresso, merci.",
            translation: "— 안녕하세요, 뭘 드릴까요?\n— 저는 커피를 원해요.\n— 크림 커피 또는 에스프레소?\n— 에스프레소로 주세요.",
          },
        },
        variant: {
          audio: {
            status: "placeholder",
            sourceId: "pilot-fr-cafe-02",
            attribution: "파일럿 창작 대화 — 실음원·원문 출처 연결 예정",
            duration: "0:25",
          },
          captions: {
            original:
              "— Qu'est-ce que je vous sers?\n— Je voudrais un croissant et un chocolat chaud, s'il vous plaît.\n— Oui, tout de suite!",
            translation: "— 뭘 드릴까요?\n— 저는 크루아상과 핫초콜릿을 원해요, 부탁해요.\n— 네, 바로요!",
          },
          transitionNote:
            "같은 'Je voudrais' 표현인데 이번엔 2개 물건을 주문해요. 그리고 음료 대신 더 일상적인 아침 식사 상황이에요.",
        },
        selfCheckOptions: [
          { label: "다 들었어요 (정확히 이해)", value: "full", fsrsSignal: 1 },
          { label: "부분만 들었어요 (주요 단어만)", value: "partial", fsrsSignal: 0.5 },
          { label: "아직이에요 (계속 연습 필요)", value: "notready", fsrsSignal: -1 },
        ],
      },

      // ⑤ 연습 + SRS 등록 (practiceAndRegistration)
      {
        type: "practiceAndRegistration",
        heading: "연습: 직접 주문해 보기",
        writingPrompts: [
          "카페에서 뭘 주문하고 싶나요? 'Je voudrais...'로 시작하는 문장 2개를 만들어 보세요.",
          "'Je voudrais'를 쓰지 않고 같은 의미의 다른 표현(예: Je prends...)을 찾아 보세요.",
        ],
        quizItems: [
          {
            type: "matching",
            question: "다음 상황에 맞는 주문을 고르세요.",
            pairs: [
              {
                situation: "카페에서 손님이 직원에게",
                options: [
                  "Je voudrais un café, s'il vous plaît.",
                  "Donne-moi un café!",
                  "Un café, oui?",
                ],
                correctIndex: 0,
              },
              {
                situation: "친구에게 야식을 주문할 때",
                options: [
                  "Je voudrais une pizza, s'il te plaît.",
                  "Tu as une pizza?",
                  "Prépare une pizza.",
                ],
                correctIndex: 0,
              },
            ],
          },
          {
            type: "fillBlank",
            question: "빈칸에 가장 공손한 주문 표현을 고르세요: ___ une eau, s'il vous plaît.",
            options: ["Je veux", "Je voudrais", "Je prends"],
            correctIndex: 1,
            explanation: "공손한 주문은 'Je voudrais'를 써요.",
          },
        ],
        autoRegisterVocabs: true,
      },
    ],
  },

  // ========================================
  // 레슨 2: 약국 — Il faut
  // ========================================
  {
    slug: "a1-pilot-33-pharmacy-il-faut",
    level: "A1",
    order: 33,
    status: FRENCH_A1_SANDWICH_PILOT_STATUS,
    title: "약국에서 약 받기",
    topic: "의무·조언·건강 용어",
    titleFr: "À la pharmacie — Il faut + infinitive",
    summary:
      "약국에서 약사의 조언을 듣고 '~해야 한다(Il faut ~)'를 배워요. 의료 상황에서 가장 자주 나오는 표현이에요.",
    duration: "약 12분",
    sections: [
      // ① 실전 선노출
      {
        type: "authenticIntro",
        heading: "약국 상황 대화 들어 보기",
        presentationFraming:
          "못 알아들어도 정상이에요! 약사(여성)와 고객(남성)의 대화를 듣고, 누가 조언하고 누가 듣고 있는지 느껴 보세요. (대화 속 약 이름·복용량은 표현 학습용 연출이에요 — 실제 복용은 반드시 약사·의사의 개별 안내를 따르세요.)",
        audio: {
          status: "placeholder",
          sourceId: "pilot-fr-pharmacy-01",
          duration: "0:32",
          attribution: "파일럿 창작 대화 — 실음원·원문 출처 연결 예정",
        },
        captions: {
          original:
            "— Bonjour, je ne me sens pas bien. J'ai la grippe.\n— Vous avez de la fièvre? Il faut prendre de l'aspirine trois fois par jour.\n— D'accord. Et il faut manger?\n— Oui, il faut manger léger. Beaucoup d'eau, beaucoup de repos.",
          translation:
            "— 안녕하세요, 저 몸이 안 좋아요. 독감 같아요.\n— 열이 나요? 아스피린을 하루 3번 먹어야 해요.\n— 알겠어요. 그리고 먹어야 해요?\n— 네, 가볍게 먹어야 해요. 물 많이, 휴식 많이요.",
        },
      },

      // ② 어휘 프리뷰
      {
        type: "vocabPreview",
        heading: "오늘 배울 단어 5개",
        vocabs: [
          {
            word: "il faut",
            meanings: ["~해야 한다", "필요하다", "~해야 함"],
            exampleSentence: "Il faut prendre de l'aspirine.",
            note: "비인칭 표현 — '~하는 것이 필요하다'",
          },
          {
            word: "aspirine",
            meanings: ["아스피린"],
            exampleSentence: "Il faut prendre de l'aspirine.",
          },
          {
            word: "grippe",
            meanings: ["독감", "인플루엔자"],
            exampleSentence: "J'ai la grippe.",
          },
          {
            word: "fièvre",
            meanings: ["열", "발열"],
            exampleSentence: "Vous avez de la fièvre?",
          },
          {
            word: "repos",
            meanings: ["휴식", "쉬기"],
            exampleSentence: "Beaucoup de repos.",
            note: "reposer = 휴식하다",
          },
        ],
      },

      // ③ 문법 패턴 (patternExplanation) — v1 호환 섹션
      {
        type: "patternExplanation",
        heading: "Il faut + 부정사 — 의무와 조언 표현",
        pattern: "Il faut + 부정사 (infinitive)",
        patternKo: "~해야 한다, ~해야 함",
        body:
          "**Il faut** (일 포) 는 프랑스어에서 가장 중요한 '의무/조언' 표현이에요.\n\n" +
          "**구조**: Il faut + 동사 원형(부정사) — ※ 아래 의료 예문의 약 이름·복용량은 상황 연출이에요. 실제 복용은 약사·의사의 개별 안내가 기준이에요.\n" +
          "- Il faut prendre (약을 먹어야 한다)\n" +
          "- Il faut manger léger (가볍게 먹어야 한다)\n" +
          "- Il faut boire de l'eau (물을 마셔야 한다)\n\n" +
          "'(일반적으로) ~해야 한다'는 뜻으로, 특정 사람이 주어가 아니에요. " +
          "의료/학교/법칙 상황에서 아주 자주 들려요.",
        examples: [
          {
            fr: "Il faut prendre de l'aspirine trois fois par jour.",
            ko: "아스피린을 하루 3번 먹어야 해요.",
            note: "의약품 지시",
          },
          {
            fr: "Il faut manger et boire beaucoup.",
            ko: "많이 먹고 마셔야 해요.",
            note: "생활 조언",
          },
          {
            fr: "Il faut rester à la maison.",
            ko: "집에 있어야 해요 (쉬어야 해요).",
            note: "의료 지시",
          },
        ],
        pitfall:
          "❌ 틀림: 'Je faut prendre' (faut의 주어는 항상 비인칭 il)\n✅ 맞음: 'Il faut prendre' (je/tu 등으로 바꿀 수 없어요)",
      },

      // ④ 재노출
      {
        type: "authenticReplay",
        heading: "같은 표현, 다른 상황에서",
        presentationFraming: "이번엔 약사가 아니라 엄마의 '일상 조언' 상황에서 같은 'Il faut'를 들어 봐요.",
        original: {
          audio: {
            status: "placeholder",
            sourceId: "pilot-fr-pharmacy-01",
            attribution: "파일럿 창작 대화 — 실음원·원문 출처 연결 예정",
            duration: "0:32",
          },
          captions: {
            original:
              "— Bonjour, je ne me sens pas bien. J'ai la grippe.\n— Vous avez de la fièvre? Il faut prendre de l'aspirine trois fois par jour.\n— D'accord. Et il faut manger?\n— Oui, il faut manger léger.",
            translation: "— 안녕하세요, 저 몸이 안 좋아요.\n— 열이 나요? 아스피린을 하루 3번 먹어야 해요.\n— 알겠어요. 먹어야 해요?\n— 네, 가볍게 먹어야 해요.",
          },
        },
        variant: {
          audio: {
            status: "placeholder",
            sourceId: "pilot-fr-pharmacy-02",
            attribution: "파일럿 창작 대화 — 실음원·원문 출처 연결 예정",
            duration: "0:28",
          },
          captions: {
            original:
              "— Maman, je suis fatigué.\n— Il faut dormir plus. Il faut aussi faire attention à ce que tu manges.\n— D'accord, maman!",
            translation: "— 엄마, 난 피곤해.\n— 더 자야 해. 뭘 먹는지도 신경 써야 해.\n— 알겠어, 엄마!",
          },
          transitionNote:
            "이번엔 의료 상황이 아니라 일상적인 가정 대화예요. 약사 대신 엄마가 조언하지만, 'Il faut'는 정확히 같은 의미로 쓰여요.",
        },
        selfCheckOptions: [
          { label: "다 들었어요 (정확히 이해)", value: "full", fsrsSignal: 1 },
          { label: "부분만 들었어요 (주요 단어만)", value: "partial", fsrsSignal: 0.5 },
          { label: "아직이에요 (계속 연습 필요)", value: "notready", fsrsSignal: -1 },
        ],
      },

      // ⑤ 연습
      {
        type: "practiceAndRegistration",
        heading: "연습: 직접 조언해 보기",
        writingPrompts: [
          "'Il faut'를 써서 친구에게 건강 조언 2개를 만들어 보세요. (예: 더 자야 해, 운동해야 해 등)",
          "'Il faut' 대신 다른 표현(예: Vous devez...)으로 같은 의미를 만들어 보세요.",
        ],
        quizItems: [
          {
            type: "matching",
            question: "다음 상황에 맞는 조언을 고르세요.",
            pairs: [
              {
                situation: "감기가 난 친구에게",
                options: [
                  "Il faut prendre des médicaments.",
                  "Il faut jouer au football.",
                  "Il faut danser.",
                ],
                correctIndex: 0,
              },
              {
                situation: "피로한 학생에게",
                options: [
                  "Il faut étudier plus.",
                  "Il faut dormir plus et manger bien.",
                  "Il faut courir.",
                ],
                correctIndex: 1,
              },
            ],
          },
          {
            type: "fillBlank",
            question: "누구에게나 하는 일반 조언이 되도록 고르세요: ___ boire de l'eau après le sport.",
            options: ["Je bois", "Il faut", "Tu dois"],
            correctIndex: 1,
            explanation: "특정 상대(tu/vous) 없이 누구에게나 하는 조언은 비인칭 'Il faut'를 써요.",
          },
        ],
        autoRegisterVocabs: true,
      },
    ],
  },
];

export default chapters;
