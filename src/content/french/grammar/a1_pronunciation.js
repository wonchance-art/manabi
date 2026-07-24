/**
 * A1 발음 핵심 — 프랑스어 음성 시스템의 기초 3챕터
 * 리에종·엘리종·리듬/강세는 문어와 구어를 가르는 가장 눈에 띄는 특징.
 * 규칙을 체계적으로 배우고 실제 발음으로 몸에 들이게 하는 단계.
 */
const chapters = [
  {
    slug: "a1-29-liaison",
    level: "A1",
    order: 2,
    title: "자음 이어붙이기 — 듣기 편하게",
    topic: "리에종(liaison)",
    titleFr: "La liaison — quand les consonnes réveillent",
    summary:
      "le, les, des, nous, vous 등 끝 자음이 보통 안 들리는 단어들이, 다음 모음 앞에서 갑자기 울어난다? 그게 리에종이에요. " +
      "어떤 경우에 반드시 일어나고, 언제는 금지되는지 규칙을 배워요.",
    duration: "약 10분",
    sections: [
      {
        heading: "리에종의 세 등급 — 의무, 선택, 금지",
        pattern: "모음 앞 끝 자음: 의무 / 선택 / 금지 환경으로 나뉨",
        patternKo: "통사 환경(syntaxe)에 따라 리에종 규칙이 바뀐다",
        body:
          "프랑스어는 음운적으로 자음군을 싫어해요. 끝 자음이 모음 앞에 올 때 이을 수 있으면 자연스럽게 이어붙이는데, " +
          "이 '리에종'은 단순히 개인의 선택이 아니라 **통사 문맥에 따라** 의무·선택·금지로 나뉨니다.\n\n" +
          "이제부터 배울 규칙을 익히고 실제 프랑스인의 말 속에서 인식하면, 듣기 실력이 비약적으로 늘어요.",
        examples: [
          {
            fr: "les amis",
            ipa: "[lezami]",
            ko: "친구들",
            note: "한정사 + 명사: 의무 리에종 (s→[z])",
          },
          {
            fr: "les élèves",
            ipa: "[lezɛlɛv]",
            ko: "학생들",
            note: "같은 구조, 같은 규칙: 의무 리에종",
          },
          {
            fr: "petit ami",
            ipa: "[pətit‿ami] 또는 [pətitami]",
            ko: "남자친구",
            note: "형용사 + 명사: 선택 리에종 (음절 경계 명확화 또는 음운적 연결)",
          },
          {
            fr: "et enfant",
            ipa: "[ɛ ɑ̃fɑ̃]",
            ko: "그리고 아이",
            note: "et 다음: 금지 리에종 (음절 경계 보존)",
          },
        ],
        tip:
          "리에종은 '편하니까' 일어나는 게 아니라 '문법적으로 같은 세트'를 나타내는 신호에요. " +
          "의무 리에종이 일어나지 않으면 문법적 결합이 약해 보이는 문제가 생기고, " +
          "금지된 곳에 일어나면 마치 알파벳 띄어쓰기를 무시하는 것처럼 어색해요.",
      },
      {
        heading: "의무 리에종 — 딱 이 경우들",
        pattern: "한정사/수사/대명사 + 명사/형용사, 전치사 + 명사, 다수 불규칙 동사",
        patternKo: "의무: 한정사·수사·일부 대명사 + 모음 시작 단어",
        body:
          "**의무 리에종**이 일어나는 환경은 비교적 명확해요. 대부분 **문법적으로 밀착된 단위**(한정사·수사·대명사가 명사/형용사를 수식)에서 발생해요.\n\n" +
          "• **한정사·수사 + 명사/형용사**: le, la(→ l' 융합), les, un, une, des, mon, ton, son, notre, votre, leur, " +
          "ce, cet(→ c' 융합), celui, quelques, deux, trois... (대부분 수사 끝 s, x, z, t, d, f, v)\n" +
          "• **대명사 + 동사**: nous, vous, ils, elles가 동사 모음 앞에 (리에종: s/z→[z], x→[z])\n" +
          "• **단음절 전치사 + 명사**: en, dans, chez, sous — 모음 앞에서 의무 리에종이에요: dans un [dɑ̃z‿œ̃], chez elle [ʃez‿ɛl], en été [ɑ̃n‿ete]\n" +
          "• **부사 très + 형용사**: très intéressant [tʁɛz‿ɛ̃teʁesɑ̃] — s→[z]로 잇는 것이 표준이에요\n\n" +
          "정확히: les, des, les amis / nous avons [nuzavɔ̃] / trois ans [tʁwazɑ̃] 는 명백한 의무 리에종.",
        examples: [
          {
            fr: "les amis",
            ipa: "[lezami]",
            ko: "친구들",
            note: "한정사 les 끝 s → [z]",
          },
          {
            fr: "nous avons",
            ipa: "[nuzavɔ̃]",
            ko: "우리는 있어요",
            note: "대명사 nous 끝 s → [z]",
          },
          {
            fr: "trois ans",
            ipa: "[tʁwazɑ̃]",
            ko: "3년",
            note: "수사 trois 끝 s → [z]",
          },
          {
            fr: "un enfant",
            ipa: "[œ̃nɑ̃fɑ̃]",
            ko: "한 아이",
            note: "수사·한정사 un 끝 n → [n]",
          },
          {
            fr: "des étudiants",
            ipa: "[dezɛtydijɑ̃]",
            ko: "학생들",
            note: "한정사 des 끝 s → [z]",
          },
        ],
      },
      {
        heading: "선택 리에종 — 속도·레지스터·개인 습관",
        pattern: "형용사 + 명사, 부사 + 형용사/명사, 상황에 따라 달라짐",
        patternKo: "선택: 격식체/서술체/빠른 말 vs. 명확하게 발음하는 구어",
        body:
          "**선택 리에종**은 의무는 아니지만 일어날 수 있는 경우예요. 주로 음절 구조를 명확히 하거나 음운적으로 리듬감 있게 말할 때 쓰여요.\n\n" +
          "• 주의: **선행하는 짧은 형용사 + 명사**(petit ami [pətit‿ami], grand arbre [gʁɑ̃t‿aʁbʁ], bon ami [bɔn‿ami])는 사실상 **의무**로 이어 읽어요 — 선택이 아니에요\n" +
          "• **부사 + 과거분사/긴 형용사** 등 그 밖의 조합이 상황에 따라 갈리는 선택 영역이에요\n" +
          "• **부사 très + 형용사**: très intelligent [tʁɛz‿ɛ̃tɛlijɑ̃] — 선택 중에서도 사실상 표준으로 이어 읽어요\n" +
          "• 반대로 **et 뒤는 리에종 금지**예요: et alors [e alɔʁ] — et의 t는 절대 잇지 않아요",
        examples: [
          {
            fr: "petit ami",
            ipa: "[pətit‿ami]",
            ko: "남자친구",
            note: "짧은 형용사 + 명사: 끝 t를 [t]로 이어 읽는 것이 표준(사실상 의무)",
          },
          {
            fr: "grand arbre",
            ipa: "[gʁɑ̃t‿aʁbʁ]",
            ko: "큰 나무",
            note: "grand의 d는 리에종에서 [t]로 — 남성 명사 앞 대표 예",
          },
          {
            fr: "très intelligent",
            ipa: "[tʁɛz‿ɛ̃tɛlijɑ̃]",
            ko: "매우 똑똑한",
            note: "très + 형용사: s→[z]로 잇는 것이 표준",
          },
        ],
      },
      {
        heading: "금지 리에종 — 이 경우는 절대 금지",
        pattern: "et 뒤, 고유명사 뒤, 단수 명사+형용사 h aspiré 시작, 수식 명사의 복수 형용사 뒤",
        patternKo: "금지: 특정 문법 경계에서는 음절을 명확히 분리",
        body:
          "프랑스어는 특정 **음절 경계**를 명확히 유지해야 하는 경우가 있어요. 이런 곳에 리에종을 하면 언어 사용자가 어색함을 느낍니다.\n\n" +
          "• **et 뒤**: et alors, et enfant → [ɛ ɑ̃fɑ̃] (절대 [ɛtɑ̃fɑ̃] 금지). 이유: et는 의미상 독립적인 절을 잇는 연결사\n" +
          "• **고유명사 뒤**: Paris est → [paʁi ɛ] (금지). Albert Einstein → [albɛʁ ‖ ɛ̃ʃtajn] (각각 발음)\n" +
          "• **단수 명사 + h aspiré 형용사**: le héros [lə ero] (금지 리에종, l' 융합도 안 함). l + h aspiré는 음절을 분리\n" +
          "• **단수 명사 + 뒤따르는 형용사**: chat adorable [ʃa ado‌ʁabl] (금지, 형용사가 뒤에 오면 음절 분리). " +
          "단, 전통적으로 bon, petit, grand 같은 빈 형용사가 명사 앞에 오면 선택적 리에종",
        examples: [
          {
            fr: "et enfant",
            ipa: "[ɛ ɑ̃fɑ̃]",
            ko: "그리고 아이",
            note: "et 뒤: 절대 금지. [ɛtɑ̃fɑ̃] 금지.",
          },
          {
            fr: "Paris est beau",
            ipa: "[paʁi ɛ bo]",
            ko: "파리는 아름다워요",
            note: "고유명사 뒤: 금지. [paʁiz‖ɛ] 발음하지 말 것",
          },
          {
            fr: "le héros",
            ipa: "[lə ero]",
            ko: "영웅",
            note: "h aspiré 앞: 금지 리에종. l' 융합도 안 함.",
          },
          {
            fr: "un chat adorable",
            ipa: "[œ̃ ʃa adɔʁabl]",
            ko: "귀여운 고양이",
            note: "단수 명사 + 뒤따르는 형용사 사이는 잇지 않아요(리에종 금지 환경)",
          },
        ],
      },
      {
        heading: "리에종의 음가 — 자음이 바뀐다",
        pattern: "s/x → [z] · d → [t] · f → [v](neuf 한정) — 리에종의 음가 변화",
        patternKo: "끝 자음이 모음 앞에 오면 일부 음가가 변한다",
        body:
          "리에종에서 중요한 건 **음가 변화**예요. 이어 읽는 순간 끝 자음의 소리가 바뀌는 경우가 있어요.\n\n" +
          "• **s/x → [z]**: les amis [lez‿ami], six ans [siz‿ɑ̃]\n" +
          "• **d → [t]**: grand arbre [gʁɑ̃t‿aʁbʁ], quand il [kɑ̃t‿il] — d는 리에종에서 [t]로 소리 나요\n" +
          "• **f → [v]**: neuf ans [nœv‿ɑ̃], neuf heures [nœv‿œʁ] — neuf 뒤의 이 두 단어에서 굳어진 표준 발음이에요\n" +
          "• **t, n**: 그대로 [t]·[n] — petit ami [pətit‿ami], bon ami [bɔn‿ami]",
        examples: [
          {
            fr: "les amis",
            ipa: "[lezami]",
            ko: "친구들",
            note: "s → [z]",
          },
          {
            fr: "six ans",
            ipa: "[sizɑ̃]",
            ko: "6년",
            note: "x → [z]",
          },
          {
            fr: "trois enfants",
            ipa: "[tʁwazɑ̃fɑ̃]",
            ko: "3명의 아이들",
            note: "s → [z]",
          },
          {
            fr: "neuf ans",
            ipa: "[nœv‿ɑ̃]",
            ko: "9년, 아홉 살",
            note: "neuf ans·neuf heures에서는 f가 [v]로 — 굳어진 표준 발음이에요",
          },
          {
            fr: "bon ami",
            ipa: "[bɔnami]",
            ko: "좋은 친구",
            note: "n은 [n]으로 그대로",
          },
        ],
      },
    ],
  },

  {
    slug: "a1-30-elision",
    level: "A1",
    order: 3,
    title: "모음이 사라진다 — 엘리종",
    topic: "엘리종(élision)",
    titleFr: "L'élision — quand les voyelles disparaissent",
    summary:
      "le가 l'이 되고, je가 j'이 된다. 뒤 단어가 모음으로 시작할 때, " +
      "앞 단어의 모음 끝이 사라지는 엘리종을 배워요. 철저한 규칙이에요.",
    duration: "약 8분",
    sections: [
      {
        heading: "엘리종의 원칙 — e/a + 모음 시작 단어 → 아포스트로피",
        pattern: "단어 끝 e/a + 모음/h muet → 모음 사라짐 + 아포스트로피",
        patternKo: "철저한 규칙: 특정 단어들의 끝 모음이 음운적으로 사라지고 표기상 ' 로 표시",
        body:
          "엘리종은 **음운학적 필연**이 아니라 **문법적 규칙**이에요. 두 모음이 연달아 나오는 것을 피하기 위해, " +
          "앞 단어의 **마지막 모음이 사라지고**, 철저하게 아포스트로피로 표기해요.\n\n" +
          "**엘리종이 일어나는 단어들**:\n" +
          "• **정관사**: le·la → l' (le+ami→l'ami, la+école→l'école)\n" +
          "• **부정관사**: un·une는 엘리종하지 않아요(un ami는 리에종 [œ̃n‿ami]). 다만 de는 d'(d'un)\n" +
          "• **인칭대명사**: je → j' (j'aime), me → m', te → t', se → s', ne → n' (부정)\n" +
          "• **관계대명사·접속사 que**: que → qu' (qu'il fasse)\n" +
          "• **전치사 de, à**: de → d' (d'un livre), à는 au/à la로 축약돼서 엘리종 없음(혼동 주의)\n" +
          "• **형용사 ce**: ce → cet (cet ami, cet enfant) — 발음상 모음 연결을 피함",
        examples: [
          {
            fr: "le ami → l'ami",
            ipa: "[lami]",
            ko: "친구",
            note: "정관사 le 끝 e 사라짐",
          },
          {
            fr: "je aime → j'aime",
            ipa: "[ʒɛm]",
            ko: "나는 좋아해요",
            note: "인칭대명사 je 끝 e 사라짐",
          },
          {
            fr: "ne oublie pas → n'oublie pas",
            ipa: "[nubli pa]",
            ko: "잊지 말아요",
            note: "부정 ne 끝 e 사라짐",
          },
          {
            fr: "que il parte → qu'il parte",
            ipa: "[kil paʁt]",
            ko: "그가 떠나기를",
            note: "관계사·접속사 que 끝 e 사라짐",
          },
          {
            fr: "de un livre → d'un livre",
            ipa: "[dœ̃ livʁ]",
            ko: "한 권의 책",
            note: "전치사 de 끝 e 사라짐",
          },
          {
            fr: "ce enfant → cet enfant",
            ipa: "[sɛtɑ̃fɑ̃]",
            ko: "이 아이",
            note: "지시형용사 ce → cet로 변형 (엘리종이라 보기보다 형태 변화)",
          },
        ],
      },
      {
        heading: "h muet vs h aspiré — 엘리종이 달라진다",
        pattern: "h muet 앞: 엘리종 일어남, h aspiré 앞: 엘리종 금지",
        patternKo: "프랑스어 h는 음성이 아니지만 두 종류가 있고 엘리종 규칙을 결정한다",
        body:
          "프랑스어 **h는 원래 소리가 없어요**. 그리고 **h muet**(무음 h)과 **h aspiré**(이름은 '숨쉬는 h'지만 **이것도 현대 프랑스어에서는 소리가 없어요** — 대신 리에종·엘리종을 '막는' 기능을 해요)로 나뉘어요.\n\n" +
          "• **h muet** (대부분의 h): 엘리종 일어남 — l'homme, l'histoire, l'habitude\n" +
          "• **h aspiré** (300여 단어 한정): 엘리종 금지, 리에종도 금지 — le héros (X l'héros), les héros (X lézéros)\n\n" +
          "사전에 h aspiré는 보통 * 또는 + 기호로 표시돼요. 처음 보는 단어면 사전을 확인하세요.",
        examples: [
          {
            fr: "l'homme",
            ipa: "[lɔm]",
            ko: "남자",
            note: "h muet: 엘리종 일어남",
          },
          {
            fr: "l'histoire",
            ipa: "[listwaʁ]",
            ko: "이야기",
            note: "h muet: 엘리종 일어남",
          },
          {
            fr: "le héros",
            ipa: "[lə ero]",
            ko: "영웅",
            note: "h aspiré: 엘리종 금지 (X l'héros)",
          },
          {
            fr: "le haricot",
            ipa: "[lə aʁiko]",
            ko: "콩",
            note: "h aspiré: 엘리종 금지 (X l'haricot)",
          },
          {
            fr: "la hauteur",
            ipa: "[la otœʁ]",
            ko: "높이",
            note: "h aspiré: 엘리종 금지 (X l'hauteur)",
          },
        ],
      },
      {
        heading: "엘리종과 리에종의 차이 — 음성 vs. 표기",
        pattern: "엘리종: 음가가 완전히 사라짐 + 아포스트로피 / 리에종: 자음이 이어붙음",
        patternKo: "엘리종은 음절 구조의 근본적 변화, 리에종은 음절 경계의 유연함",
        body:
          "헷갈리기 쉽지만 둘은 전혀 다른 현상이에요.\n\n" +
          "**엘리종**: 앞 단어의 **끝 모음이 완전히 탈락** → l'ami [lami] (le[lə] + ami[ami] 아님!)\n" +
          "**리에종**: 앞 단어의 **끝 자음이 뒤 모음으로 이어짐** → les amis [lezami]\n\n" +
          "• 엘리종: 철저하게 표기상 아포스트로피로 표시됨 — l', d', j', m', n', qu', s', t' 등\n" +
          "• 리에종: 표기상 변화 없음 — 철자는 그대로, 발음만 이어붙임",
        examples: [
          {
            fr: "l'ami vs. les amis",
            ipa: "[lami] vs. [lezami]",
            ko: "친구 vs. 친구들",
            note: "엘리종 (e 탈락) vs. 리에종 (s→[z], 그대로 이어붙임)",
          },
          {
            fr: "j'aime vs. vous aimez",
            ipa: "[ʒɛm] vs. [vuzɛme]",
            ko: "나는 좋아해요 vs. 여러분은 좋아해요",
            note: "엘리종 (e 탈락) vs. 리에종 (s→[z], 이어붙임)",
          },
          {
            fr: "d'un vs. deux un",
            ipa: "[dœ̃] vs. [dø ‖ œ̃]",
            ko: "'(한정사 +)명사' vs. '둘 하나'",
            note: "엘리종 (e 탈락) vs. 리에종 없음 (deux 끝 x는 모음 앞에서도 음성이 아님)",
          },
        ],
      },
      {
        heading: "엘리종의 의무성 — 반드시 표기해야 한다",
        pattern: "엘리종이 일어나는 모든 경우, 아포스트로피를 반드시 표기",
        patternKo: "발음이 같으면 표기상 엘리종 표시는 선택이 아니라 필수",
        body:
          "엘리종은 단순한 발음 현상이 아니라 **문법 규칙**이에요. 글을 쓸 때는 반드시 아포스트로피를 붙여야 해요.\n\n" +
          "틀린 표기: le ami, je aime, d un livre\n" +
          "올바른 표기: l'ami, j'aime, d'un livre\n\n" +
          "발음상으로는 구분이 안 될 수 있지만(je aime을 [ʒɛm]이라 해도 [ʒəɛm]으로 들을 수는 없으므로), " +
          "문법적으로 올바른 프랑스어를 쓰려면 반드시 지켜야 해요.",
        examples: [
          {
            fr: "l'école, j'adore, m'appeler, s'il vous plaît",
            ipa: "[lekɔl], [ʒador], [mapəle], [silvu plɛ]",
            ko: "학교, 나는 좋아해요, 나를 부르다, 제발",
            note: "모두 엘리종이 일어나고 아포스트로피 반드시 표시",
          },
        ],
      },
    ],
  },

  {
    slug: "a1-31-rhythm-stress",
    level: "A1",
    order: 4,
    title: "강세와 리듬 — 프랑스어만의 패턴",
    topic: "리듬·강세(rythme et accentuation)",
    titleFr: "Le rythme et l'accent tonique du français",
    summary:
      "영어처럼 단어마다 강한 음절이 있지 않아요. 프랑스어 강세는 **리듬 그룹의 끝 음절**에 옵니다. " +
      "같은 길이 음절, 균등한 속도 — 이것이 프랑스어의 리듬감이에요.",
    duration: "약 9분",
    sections: [
      {
        heading: "영어의 강세 vs. 프랑스어의 리듬",
        pattern: "영어: 단어마다 강세 위치 불규칙 / 프랑스어: 리듬 그룹 끝에만 강세",
        patternKo: "프랑스어는 개별 단어 강세가 아니라 음절 그룹의 리듬 강세",
        body:
          "**영어 강세**: PHOto vs. phoTOgraphy — 단어마다 강한 음절 위치가 달라요.\n\n" +
          "**프랑스어 강세**: 불규칙이 없어요. 대신 **음절이 균등하게 이어지다가**, **의미상 묶음(그룹)의 끝 음절**에만 약한 강세를 줍니다.\n\n" +
          "예: Je vais à la gare demain.\n" +
          "  = [ʒə] + [ve] + [a] + [la] + **[gaʁ]** + [də] + [mɛ̃]\n\n" +
          "마지막 의미 그룹이 'demain'의 첫음절 [dəmɛ̃]인데, 여기서 [mɛ̃]에 약한 강세.\n" +
          "하지만 영어 같은 강한 스트레스는 아니고, 음높이와 길이 미세 변화로 표현돼요.",
        examples: [
          {
            fr: "Bonjour",
            ipa: "[bɔ̃ʒuʁ]",
            ko: "안녕하세요",
            note: "2음절 단어: 끝 [ʒuʁ]에 약한 강세",
          },
          {
            fr: "A-do-rable",
            ipa: "[adɔʁabl]",
            ko: "사랑스러운",
            note: "3음절: a·do·rable — 끝 [bl]은 마지막 음절에 붙고 독립 음절이 아니에요",
          },
          {
            fr: "Je vais à Paris.",
            ipa: "[ʒə ve a paʁi]",
            ko: "나는 파리에 가요.",
            note: "문장: 각 의미 그룹(주어·동사·전치사구) 끝에 약한 강세, paʁi[i]에 가장 눈에 띄는 강세",
          },
          {
            fr: "Un professeur très intelligent.",
            ipa: "[œ̃ pʁɔfɛsœʁ tʁɛ ɛ̃tɛlijɑ̃]",
            ko: "매우 똑똑한 한 명의 선생님",
            note: "의미 그룹: 'professeur' 끝, 'intelligent' 끝에 각각 약한 강세",
          },
        ],
      },
      {
        heading: "리듬 그룹(groupes de souffle) — 음향 단위",
        pattern: "의미상 묶음 1개 = 음향상 리듬 1개 / 호흡 단위와 일치",
        patternKo: "문장을 의미 단위로 쪼개면 각 그룹이 음향적으로 1개 리듬",
        body:
          "프랑스어에서 **리듬 그룹**은 음향학적으로 정의되는 개념이에요. 보통 호흡을 끊지 않고 일관된 속도와 음조로 읽을 수 있는 단위를 말해요.\n\n" +
          "• **짧은 문장**: 전체가 1개 리듬 그룹 → Je suis coréen. [ʒə sɥi kɔʁeɛ̃]\n" +
          "• **긴 문장**: 의미상 경계에서 나뉨 → Je vais | à la gare | demain. (3개 그룹)\n" +
          "• **쉼표나 접속사**: 보통 그룹 경계 신호 → Je travaille, | et mon frère regarde la télé.\n\n" +
          "각 그룹의 끝에 약한 하강 음조와 음길이 미세 증가가 나타나요.",
        examples: [
          {
            fr: "Bonjour, comment ça va ?",
            ipa: "[bɔ̃ʒuʁ] / [kɔmɑ̃ sa va]",
            ko: "안녕하세요, 어떻게 지내세요?",
            note: "2개 그룹: 'Bonjour' + '나머지 질문'",
          },
          {
            fr: "Je vais à la gare demain.",
            ipa: "[ʒə ve] / [a la gaʁ] / [dəmɛ̃]",
            ko: "내일 나는 역에 가요.",
            note: "3개 그룹: 주어·동사 / 전치사구 / 시간표현",
          },
          {
            fr: "Quand je suis arrivé, tout le monde dormait.",
            ipa: "[kɑ̃ ʒə sɥi aʁive] / [tu lə mɔ̃d dɔʁmɛ]",
            ko: "내가 도착했을 때, 모두 자고 있었어요.",
            note: "2개 그룹: 때 절 / 주절",
          },
        ],
      },
      {
        heading: "음절 등길이 원칙 — 균등하고 빠르게",
        pattern: "모든 음절이 같은 길이(음향상 약 0.1초), 영어처럼 장단 차이 없음",
        patternKo: "프랑스어 음절은 거의 같은 길이를 유지하면서 빠르게 이어진다",
        body:
          "프랑스어의 가장 눈에 띄는 특징 중 하나는 **음절 등길이**예요. 영어처럼 강한 음절과 약한 음절의 길이 차이가 거의 없어요.\n\n" +
          "**영어**: stressed syllables are LONG / unstressed are SHORT → Photo [ˈfoʊ̯.toʊ̯] (첫째 음절 길음)\n" +
          "**프랑스어**: [fo.to.gʁa.fi] — 모든 음절이 약 같은 길이, 균등한 속도\n\n" +
          "이것이 프랑스어가 '리듬감 있고 빠르고 음악적'으로 들리는 이유에요. 음절을 쪼개면 일정한 박자감이 생깁니다.",
        examples: [
          {
            fr: "A-do-rable (3음절)",
            ipa: "[a.dɔ.ʁabl]",
            ko: "사랑스러운",
            note: "3개 음절이 거의 같은 길이로 균등하게 이어짐",
          },
          {
            fr: "In-tel-li-gent (4음절)",
            ipa: "[ɛ̃.tɛ.li.ʒɑ̃]",
            ko: "똑똑한",
            note: "균등한 음절 길이, 빠른 속도 유지",
          },
          {
            fr: "ter-mi-ner (3음절)",
            ipa: "[tɛr.mi.ne]",
            ko: "끝내다",
            note: "3개 음절 모두 거의 같은 발음 길이",
          },
          {
            fr: "pho-to-gra-phie (4음절, 영어와 비교)",
            ipa: "[fo.to.ɡʁa.fi]",
            ko: "사진",
            note: "영어 [ˈfoʊ̯.toʊ̯.ɡræ.fi]처럼 음절 길이 차이 X",
          },
        ],
      },
      {
        heading: "음높이 변화 — 언어적 의미와 음성학적 신호",
        pattern: "진술: 하강 / 의문: 상승 / 나열: 유지 → 의미상 신호",
        patternKo: "프랑스어의 기본 음조는 리듬 그룹 끝의 하강 또는 상승으로 나타난다",
        body:
          "프랑스어는 강세보다 **음높이 변화**로 의미를 구분해요.\n\n" +
          "• **진술문 (statement)**: 리듬 그룹 끝이 **하강** → Tu viens demain. [ty vjɛ̃ | dəmɛ̃↓]\n" +
          "• **의문문 (yes/no question)**: 문장 끝 음높이 **상승** → Tu viens demain ? [ty vjɛ̃ | dəmɛ̃↑]\n" +
          "• **나열 (enumeration)**: 각 항목 끝 음높이 **유지** 또는 **약간 상승** → Je voudrais une pomme, | une poire, | une orange. ([↑ | ↑ | ↓])\n\n" +
          "이 음높이 변화는 언어마다 다른데, 프랑스어를 자연스럽게 발음하려면 이 패턴을 몸에 들여야 해요.",
        examples: [
          {
            fr: "Je suis coréen.",
            ipa: "[ʒə sɥi kɔʁeɛ̃↓]",
            ko: "나는 한국인이에요.",
            note: "진술: 끝이 내려감",
          },
          {
            fr: "Je suis coréen ?",
            ipa: "[ʒə sɥi kɔʁeɛ̃↑]",
            ko: "나는 한국인이에요?",
            note: "의문: 끝이 올라감",
          },
          {
            fr: "Il aime lire, | jouer, | et dormir.",
            ipa: "[il ɛm liʁ↑] [ʒwe↑] [e dɔʁmiʁ↓]",
            ko: "그는 읽기, 놀기, 자기를 좋아해요.",
            note: "나열: 처음 두 항목은 올라가고, 마지막은 내려감",
          },
          {
            fr: "Quel est votre nom ?",
            ipa: "[kɛl e votʁ nɔ̃↑]",
            ko: "당신의 이름이 뭐예요?",
            note: "wh-질문도 끝이 올라감 (영어와 다름)",
          },
        ],
      },
      {
        heading: "학습자 발음 미세조정 — 리듬감 연습",
        pattern: "음절을 손뼉으로 치며 균등한 박자 체득 / 음높이 곡선 모사",
        patternKo: "리듬과 강세는 반복 듣기와 신체 동작으로 몸에 든다",
        body:
          "리듬과 강세는 문법 규칙이 아니라 **음성 습관**이에요. 이해했다고 바로 말해지지 않으므로, 반복 연습이 필수예요.\n\n" +
          "**연습법**:\n" +
          "1. **박자 감각**: A-do-ra-ble을 [1-2-3-4] 같은 박자로 손뼉 치며 읽기\n" +
          "2. **음높이 모사**: 의문문 끝 '올라감'을 입으로 흉내내기\n" +
          "3. **리듬 그룹 단위**: 의미 묶음을 끊지 않고 한 번에 읽기, 호흡 구간에서만 쉬기\n" +
          "4. **네이티브 음성**: 자막 없이 듣고 음높이·박자 패턴을 의식적으로 주목하기",
        examples: [
          {
            fr: "Je vais à la gare.",
            ipa: "[ʒə ve | a la gaʁ] (2개 리듬)",
            ko: "나는 역에 가요.",
            note: "주어+동사 / 전치사구로 나누고, 각각 마지막 음절에 약한 강세",
          },
          {
            fr: "Photographe",
            ipa: "[fɔ.tɔ.gʁaf] (3음절 균등)",
            ko: "사진작가",
            note: "각 음절을 손뼉으로 [1] [2] [3] 쳐가며 읽기",
          },
        ],
      },
    ],
  },
];

export default chapters;
