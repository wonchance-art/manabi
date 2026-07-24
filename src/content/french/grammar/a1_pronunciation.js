/**
 * A1 발음 규칙 심화 — "듣는 것이 정확해야 말이 된다"
 * A0에서 기초 모음/자음을 배웠다면, A1에서는 단어 결합·음운 변화(리에종, 연음)를 배워서
 * 실제 발화를 알아듣고 발음할 수 있는 경지로 나아간다.
 * 특히 한국인은 받침 문화가 있어서 '묵음'과 '리에종'을 정반대로 헷갈리기 쉽다 — 이 단원이 핵심이다.
 */
const chapters = [
  {
    slug: "a1-21-liaison-intro",
    level: "A1",
    order: 14,
    title: "묵음이 갑자기 나타난다? — 리에종(liaison)",
    topic: "단어 경계의 음운 변화",
    titleFr: "La liaison et l'enchaînement",
    summary:
      "프랑스어 단어 끝의 자음은 보통 읽지 않지만, 다음 단어가 모음으로 시작하면 갑자기 나타나요. 이 현상을 리에종이라고 해요. A1 필수 패턴을 배워봅시다.",
    duration: "약 12분",
    sections: [
      {
        heading: "묵음의 예외 — 리에종은 언제 일어나는가?",
        pattern:
          "C(단자음)#V(모음) → C-V 결합 읽음 (# = 단어 경계) / 특히 s, t, n, d, p, z 자주 나타남",
        patternKo: "단어 끝 자음이 묵음이 아니라 다음 단어의 모음과 만난다",
        body:
          "프랑스어 규칙 1: '단어 끝 자음은 보통 읽지 않는다' (parler = 파를레, l 묵음)\n" +
          "프랑스어 규칙 2: '하지만 다음 단어가 모음으로 시작하면, 그 자음을 읽는다!' ← **이게 리에종**\n\n" +
          "**les_étudiants** [lez-etydijɑ̃] = 학생들(l읽음) / **bon_ami** [bɔn-ami] = 좋은 친구(n읽음)\n" +
          "**pas_encore** [paz-ɑ̃kɔʁ] = 아직도 안 함(s가 z로 읽힘!) / **deux_heures** [dø-zœʁ] = 두 시(x → z)\n\n" +
          "이 변화 때문에 처음 배우는 한국인은 \"어? 이 단어는 끝에 d가 있나?\"라고 헷갈려요. " +
          "아니에요 — **원래는 묵음인데, 다음 단어 때문에 나타나는 것**입니다.",
        examples: [
          {
            fr: "les amis",
            ipa: "[lez-ami] 레자미",
            ko: "친구들",
            note: "s → z로 소리 내는 것도 리에종의 일부(발음 강화)",
          },
          {
            fr: "bon appétit",
            ipa: "[bɔn-apeti] 보나페티",
            ko: "맛있게 드세요",
            note: "bon의 n이 appétit의 a와 결합",
          },
          {
            fr: "deux arbres",
            ipa: "[dø-zaʁbʁ] 되자르브",
            ko: "두 그루의 나무",
            note: "x(드)의 [ks]는 묵음, 그 대신 z 소리(liaison)",
          },
          {
            fr: "petit_enfant",
            ipa: "[pətit-ɑ̃fɑ̃] 프티장팡",
            ko: "어린 아이",
            note: "t는 항상 리에종 가능 (정책적 규칙)",
          },
        ],
        pitfall:
          "한국인 학습자는 받침(발음 묵음)에 익숙해서 리에종을 받침으로 착각해요. " +
          "하지만 리에종의 자음은 '이전 단어'가 아니라 '다음 단어'의 모음과 구체적으로 어울려야 생기는 현상입니다. " +
          "즉, **'이 자음을 읽을지 말지'는 '앞 단어가 아니라 뒤 단어'가 결정**한다는 뜻이에요.",
      },
      {
        heading: "주요 리에종 자음 5가지",
        pattern:
          "s(→z), t, n, p, d + #V → 리에종 높음 / z, g, r → 리에종 낮음 / b, c, f → 거의 안 함",
        patternKo: "리에종이 의무인지 선택인지 나뉜다",
        body:
          "모든 자음이 리에종하는 건 아니에요. 정책적으로 '높음/중간/낮음' 세 단계가 있어요.\n\n" +
          "**높음 (의무, 항상 읽음)**\n" +
          "- **s** (→ [z]로 변음): les, pas, dans, plus + 모음\n" +
          "- **t**: court, petit, direct + 모음\n" +
          "- **n**: bon, bien, un, mon, ton + 모음\n" +
          "- **p**: beaucoup + 모음\n" +
          "- **d**: grande + 모음\n\n" +
          "**중간 (선택적, 상황에 따라)**\n" +
          "- **z**: chez, vous, eux, nous + 모음 (자연스러운 속도에선 보통 읽음)\n" +
          "- **g**: sang, long + 모음 ([ŋ] → [ŋg] 합성음)\n" +
          "- **r**: finir, partir + 모음 (고급 말하기에서)\n\n" +
          "**낮음 (거의 안 함)**\n" +
          "- **b, c, f, l, m, x**: bob, parc, chef, mal, nom, deux (일상 회화에서 무시)\n",
        table: {
          caption: "프랑스어 리에종 지도",
          headers: ["자음", "예시", "리에종?", "발음"],
          rows: [
            [
              "s",
              "les amis / plus utile",
              "높음",
              "[lez-ami] / [ply-z-ytil]",
            ],
            [
              "t",
              "court ami / peut aller",
              "높음",
              "[kur-t-ami] / [pø-t-ale]",
            ],
            [
              "n",
              "bon ami / un enfant",
              "높음",
              "[bɔn-ami] / [œn-ɑ̃fɑ̃]",
            ],
            [
              "z",
              "vous aimez / chez eux",
              "중간",
              "[vuz-eme] / [ʃez-ø]",
            ],
            ["b", "bob aurait", "낮음", "[bɔb-ɔʁɛ] (읽지 않음)"],
          ],
        },
        etym:
          "리에종은 라틴어의 연속음 문화(누디 라틴어에선 단어 경계가 아예 없었음)의 흔적이에요. " +
          "영어는 이를 버렸지만 프랑스어는 유지했고, 그래서 프랑스 발음이 '비음의 언어'로 들려요.",
        tip: "리에종을 정확히 하는 핵심은 '앞 단어에 매달리지 말고 뒤 단어의 첫 모음에 자음을 붙인다'는 마음가짐. 마치 뒤 단어가 자신의 첫 소리를 자석처럼 빨아당기는 느낌이에요.",
      },
      {
        heading: "리에종과 생략: 같으면서도 다른 두 현상",
        pattern:
          "연음(enchaînement) = 모음으로 끝나는 단어 + 자음 시작 단어 (평상화) / 리에종 = 묵음 자음이 나타남",
        patternKo:
          "앞 단어 끝이 모음이면 연음, 보통 묵음인데 나타나면 리에종",
        body:
          "프랑스어에서 음운 변화는 두 가지예요:\n\n" +
          "**연음(enchaînement)** = '일반적인 앞뒤 결합'\n" +
          "앞 단어가 '모음'으로 끝나면, 뒤 단어의 첫 자음과 자연스럽게 어울려요.\n" +
          "**belle_enfant** [bɛl-ɑ̃fɑ̃] = 아름다운 아이 (l이 이미 읽히고 있었으므로 특별할 것 없음)\n\n" +
          "**리에종(liaison)** = '묵음이 갑자기 소리 난다'\n" +
          "앞 단어가 '자음으로 끝나는데 보통 묵음'이면, 뒤 단어가 모음으로 시작할 때만 그 자음이 나타나요.\n" +
          "**les_amis** [lez-ami] = les는 보통 [le](e만), 하지만 amis 앞에선 s가 튀어나옴\n\n" +
          "**이 둘을 구별하면 '내가 어느 자음을 읽어야 하는가'가 명확**해져요.",
        examples: [
          {
            fr: "une belle enfant",
            ipa: "[yn-bɛl-ɑ̃fɑ̃]",
            ko: "아름다운 한 명의 아이",
            note: "belle은 이미 e로 끝나므로 연음 (특별하지 않음)",
          },
          {
            fr: "un grand enfant",
            ipa: "[œn-gʁɑ̃-ɑ̃fɑ̃]",
            ko: "키 큰 아이",
            note: "grand의 d는 보통 묵음, 하지만 enfant 앞에선 리에종(d 나타남)",
          },
        ],
      },
    ],
  },

  {
    slug: "a1-22-elision",
    level: "A1",
    order: 15,
    title: "모음이 사라진다? — 엘리종(élision)과 생략",
    topic: "모음 탈락의 규칙",
    titleFr: "L'élision et l'apostrophe",
    summary:
      "l', d', s', t', n'처럼 글자 뒤에 작은 따옴표(apostrophe)가 붙는 것은 뭐예요? 모음이 떨어져 나가는 엘리종을 배워봅시다.",
    duration: "약 10분",
    sections: [
      {
        heading: "엘리종: 앞 단어의 모음이 사라진다",
        pattern: "V(모음) + #V(모음 시작) → 앞 모음 탈락 + apostrophe(') 표시",
        patternKo: "글자수를 줄이기 위해 의도적으로 모음을 삭제한다",
        body:
          "프랑스어는 **모음+모음 연결을 싫어해요**. 따라서 앞 단어의 마지막 모음을 삭제하고, " +
          "그 자리에 작은 따옴표 **apostrophe( ' )**를 붙여요. 이를 **엘리종**이라고 해요.\n\n" +
          "**le + espace** → **l'espace** (공간) (e 사라짐)\n" +
          "**je + aime** → **j'aime** (나는 사랑한다) (e 사라짐)\n" +
          "**de + eau** → **d'eau** (물) (e 사라짐)\n\n" +
          "이렇게 하는 이유는 발음의 매끄러움. 만약 엘리종이 없다면:\n" +
          "**le aime** [lə-ɛm] = 어색한 음절 끊김\n" +
          "**l'aime** [lɛm] = 자연스럽고 빠름\n\n" +
          "**엘리종하는 단어들:**\n" +
          "- **l'** (le, la)\n" +
          "- **d'** (de)\n" +
          "- **j'** (je)\n" +
          "- **m'** (me)\n" +
          "- **t'** (te)\n" +
          "- **s'** (se)\n" +
          "- **n'** (ne)\n" +
          "- **c'** (ce)\n" +
          "- **qu'** (que) — q가 포함되긴 하지만 '모음 탈락'의 범주에서는 봐요",
        examples: [
          {
            fr: "l'école",
            ipa: "[lekɔl] 레꼴",
            ko: "학교",
            note: "le + école → l' (e 탈락)",
          },
          {
            fr: "j'aime",
            ipa: "[ʒɛm] 젬",
            ko: "나는 좋아한다",
            note: "je + aime → j' (e 탈락), 2음절 → 1음절로 단축됨",
          },
          {
            fr: "d'accord",
            ipa: "[dakɔʁ] 다꼬르",
            ko: "좋아, 동의한다",
            note: "de + accord → d' (e 탈락)",
          },
          {
            fr: "s'il vous plaît",
            ipa: "[sil vu plɛ] 실 부 플레",
            ko: "제발요, 부탁합니다",
            note: "se + il → s'il (e 탈락), '만약' 의미도 있음",
          },
          {
            fr: "qu'est-ce que c'est",
            ipa: "[kɛs kə sɛ]",
            ko: "뭐예요?",
            note: "que + est → qu' (e 탈락)",
          },
        ],
        pitfall:
          "한국인은 엘리종을 보면 '어? 이 단어는 원래 이렇게 생겼나?' 하고 헷갈려요. " +
          "아니에요 — l'école는 '원본 le + école'을 줄인 것일 뿐, **원본 형태를 알아둬야 문법이 보여요**. " +
          "예: l'école는 feminine(la école이 아니라 le + école 줄인 것)을 암시합니다.",
      },
      {
        heading: "h muet vs h aspiré — 엘리종할 수 있나?",
        pattern:
          "h muet (묵음 h) → 엘리종 가능 (l'homme) / h aspiré (흡인 h) → 엘리종 불가 (le héros)",
        patternKo: "프랑스어의 h는 둘 다 발음 안 하지만, 문법 규칙은 다르다",
        body:
          "프랑스어의 **h는 절대 발음 안 해요**. 하지만 문법 규칙 면에서는 두 종류가 있어요:\n\n" +
          "**h muet (묵음 h)** — 모음처럼 취급\n" +
          "l'homme [ɔm] = 남자 (h는 소리 안 나지만, '보이지 않는 모음' 취급)\n" +
          "→ 앞 단어와 리에종·엘리종 모두 가능\n\n" +
          "**h aspiré (흡인 h)** — 자음처럼 취급\n" +
          "le héros [lə eʁo] = 영웅 (h가 '흡인' — 즉, 앞 단어와 끊어짐)\n" +
          "→ 앞 단어와 리에종·엘리종 불가\n\n" +
          "**차이의 원인:**\n" +
          "라틴어·게르만어 차용어 중 일부는 원래 h가 '발음 있었던' 말들인데, " +
          "프랑스어에서는 h 자체를 안 읽되, '문법상으로는 그 경계를 살려둬요'라는 의미예요.\n\n" +
          "**h muet 예**:\n" +
          "l'homme, l'heure, l'histoire, d'habitude, j'habite\n\n" +
          "**h aspiré 예**:\n" +
          "le héros, le hasard, la haine, le handicap, la hauteur",
        examples: [
          {
            fr: "l'hôtel",
            ipa: "[otɛl] 오텔",
            ko: "호텔",
            note: "h muet → 엘리종 가능 (l' + hôtel)",
          },
          {
            fr: "le haricot",
            ipa: "[lə aʁiko] 르 아리꼬",
            ko: "콩",
            note: "h aspiré → 엘리종 불가, 앞 단어는 le 유지",
          },
          {
            fr: "d'habitude",
            ipa: "[abityd] 아비튀드",
            ko: "보통, 일반적으로",
            note: "h muet → 엘리종 가능",
          },
          {
            fr: "le handicap",
            ipa: "[lə ɑ̃dikap]",
            ko: "장애, 핸디캡",
            note: "h aspiré → 엘리종 불가",
          },
        ],
        table: {
          caption: "h muet vs h aspiré 구분 목록 (초급 빈출)",
          headers: ["h muet (엘리종 O)", "h aspiré (엘리종 X)"],
          rows: [
            ["l'homme (남자)", "le héros (영웅)"],
            ["l'heure (시간)", "le hasard (우연)"],
            ["l'histoire (이야기)", "la haine (미움)"],
            ["l'hôtel (호텔)", "le handicap (장애)"],
            ["d'habitude (보통)", "la hauteur (높이)"],
          ],
        },
        tip: "h aspiré는 딕셔너리에 별표(*)나 중괄호{h}로 표시되기도 해요. 그럼 그건 '리에종 불가'라고 기억하면 돼요.",
      },
    ],
  },

  {
    slug: "a1-23-rhythm-stress",
    level: "A1",
    order: 16,
    title: "강세는 맨 뒤에 — 프랑스어 리듬의 비결",
    topic: "음절·강세·언어 음성학",
    titleFr: "Le rythme et l'accent tonique",
    summary:
      "영어는 단어마다 강세가 다르지만(PRE-sent / pre-SENT), 프랑스어는 항상 맨 뒤 음절을 강합니다. 이게 나와 원어민 사이의 발음 차이를 가장 크게 만들어요.",
    duration: "약 11분",
    sections: [
      {
        heading: "프랑스어는 언제나 맨 뒤를 강한다",
        pattern: "Stress position = 항상 '마지막 음절' (단어별로 안 바뀜)",
        patternKo: "영어처럼 불규칙하지 않고, 항상 같은 위치",
        body:
          "**영어**: \n" +
          "- PREsent (현재, 선물) vs. preSENT (증정하다)\n" +
          "- REc-ord vs. reC-ORD\n" +
          "→ 강세 위치가 단어마다 다름\n\n" +
          "**프랑스어**: \n" +
          "- **café** [ka-FÉ] = 카페/커피 (항상 맨 뒤)\n" +
          "- **professeur** [prɔ-fɛ-SÖR] = 교수 (항상 맨 뒤)\n" +
          "- **télévision** [té-lé-vi-SYON] = 텔레비전 (항상 맨 뒤)\n" +
          "- **alphabétique** [al-fa-bé-TIK] = 알파벳 순의 (항상 맨 뒤)\n\n" +
          "이 규칙이 **일관되게 유지**되기 때문에, 프랑스어는 '리듬'이 매우 규칙적으로 들려요. " +
          "\\[ta-ta-TA ta-ta-TA\\] 하는 식으로 박자감이 일정한 이유가 바로 이것.\n\n" +
          "**한국인이 주목할 점:**\n" +
          "한국어도 마지막 음절을 강하는 경향이 있어서 (예: 한국말, 공항, 시간), " +
          "이 규칙은 비교적 쉬워요. 대신 '영어식 강세'에 익숙하면 충돌이 생길 수 있어요.",
        examples: [
          { fr: "restaurant", ipa: "[ʁɛs-to-RAN] 레스토랑", ko: "음식점" },
          {
            fr: "comprendre",
            ipa: "[kɔ̃-PRⱭ̃dr] 콩프랑드르",
            ko: "이해하다",
            note: "끝에서 두 음절인가? 아니요, 끝 음절 're'에 강세",
          },
          {
            fr: "intéressant",
            ipa: "[ɛ̃-té-ré-sAN] 앵테레상",
            ko: "재미있는",
            note: "어디에 강세? '상' — 맨 뒤",
          },
          {
            fr: "imagination",
            ipa: "[i-ma-ji-na-SYON] 이마지나숑",
            ko: "상상력",
            note: "5음절이지만 강세는 '숑'(마지막)",
          },
        ],
      },
      {
        heading: "음절 세기: 프랑스식 vs. 영식의 차이",
        pattern: "프랑스어 음절 = 자음(선택)+모음 | 모음의 개수 = 음절 개수",
        patternKo:
          "한국어처럼 '음절=자음+모음+받침' 아니라, '음절=자음+모음' 단위",
        body:
          "**한국식 음절 (받침 포함)**\n" +
          "한 = 한(자음+모음+받침) = 1 음절\n\n" +
          "**영식 음절 (어중 강세로 복잡)**\n" +
          "understand = un-der-STAND (자음 배치가 음절 경계를 애매하게 함)\n\n" +
          "**프랑스식 음절 (명확함)**\n" +
          "café = ca-fé (모음 개수 = 음절 수)\n" +
          "**= 자음 + 모음**이 한 세트\n" +
          "→ ma-ter-ni-té = 4 음절(모음 4개)\n" +
          "→ re-com-men-cer = 4 음절(모음 4개)\n\n" +
          "**왜 중요한가?**\n" +
          "음절 수를 정확히 세야 '맨 뒤 음절'을 찾을 수 있고, " +
          "그래야 정확한 강세 위치를 알 수 있기 때문이에요.",
        examples: [
          {
            fr: "table",
            ipa: "[tabl] 타블",
            ko: "책상",
            note: "음절: ta-ble (모음 2개 = 2음절) → 강세: ble",
          },
          {
            fr: "semaine",
            ipa: "[səmɛn] 스멘",
            ko: "주간",
            note: "음절: se-mai-ne (모음 3개 = 3음절) → 강세: ne",
          },
          {
            fr: "déjà",
            ipa: "[deʒa] 데자",
            ko: "이미",
            note: "음절: dé-jà (모음 2개 = 2음절) → 강세: à",
          },
          {
            fr: "bibliothèque",
            ipa: "[bi-bli-o-TÈK]",
            ko: "도서관",
            note: "음절: bi-bli-o-thè-que (모음 5개 = 5음절) → 강세: que",
          },
        ],
      },
      {
        heading: "문장 리듬 — 단어 강세를 넘어서",
        pattern: "Phrase rhythm = 1~2초마다 강한 음절이 반복 (프로소디)",
        patternKo: "단어가 문장 속에선 강세가 이동한다",
        body:
          "**단어 독립**: café [ka-FÉ] (맨 뒤 강함)\n" +
          "**문장 속**: le café est bon [lə ka-FÉ ɛ BON]\n" +
          "→ 문장 끝 모음이 강해진다? 아니 — 그룹 단위로 다시 강세가 재배치돼요.\n\n" +
          "프랑스어 문장은 **'의미 그룹' 단위로 1~2초의 리듬을 만들어요**:\n" +
          "**[le café est] [bon et chaud]** — 각 그룹의 끝이 살짝 올라오고 강해짐.\n\n" +
          "이게 프랑스어 발음을 '음악적'으로 들리게 하는 비결이에요. " +
          "반면 영어는 단어마다 강세가 제각각이라 '음성학적으로' 들려요.",
        examples: [
          {
            fr: "Je m'appelle Marie.",
            ipa: "[ʒə ma-PEL ma-RI]",
            ko: "나는 마리예요.",
            note: "appelle(펠), Marie(리) — 각 그룹 끝이 강함",
          },
          {
            fr: "Pouvez-vous m'aider, s'il vous plaît?",
            ipa: "[pu-ve-VU] [me-DE] [sil vu PLƐ]",
            ko: "저를 도와주실 수 있어요?",
            note: "3개 의미 그룹, 각각 끝이 강함",
          },
        ],
        tip: "프랑스어를 자연스럽게 하려면 '음절 강세'뿐 아니라 '문장 리듬'도 훈련해야 해요. 약간 노래하듯이 말하면 정답이에요.",
      },
    ],
  },
];

export default chapters;
