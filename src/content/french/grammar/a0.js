/**
 * A0 입문 — 본격 학습 전 프랑스어 기초 상식
 * 한국어 화자가 프랑스어를 처음 만날 때 막히는 지점을 먼저 풀어주는 오리엔테이션 레벨.
 */
export default [
  {
    slug: "a0-01-orientation",
    level: "A0",
    order: 1,
    title: "프랑스어라는 언어 — 시작 전 오리엔테이션",
    titleFr: "Bienvenue en français !",
    summary: "프랑스어가 어떤 언어인지, 그리고 여러분이 이미 가진 영어 자산을 어떻게 활용할지 큰 그림을 그려요.",
    duration: "약 6분",
    sections: [
      {
        heading: "프랑스어는 라틴어의 직계 후손",
        body:
          "프랑스어는 스페인어·이탈리아어와 함께 **라틴어에서 갈라져 나온 로망스어**예요. 그리고 1066년 노르만 정복 이후 영어 어휘의 **절반 가까이가 프랑스어·라틴어에서 온 말**이 됐어요.\n\n" +
          "그래서 영어를 B1 정도 해두신 분이라면 프랑스어 단어의 상당수를 **이미 아는 상태**로 시작하는 거예요. 이런 연결고리는 🌱 표시로 짚어드릴게요.",
        examples: [
          { fr: "la table", ipa: "[tabl]", ko: "테이블, 탁자", note: "영어 table이 바로 이 프랑스어에서 온 말이에요." },
          { fr: "important", ipa: "[ɛ̃pɔʁtɑ̃]", ko: "중요한", note: "철자가 영어와 똑같아요. 발음만 프랑스식." },
          { fr: "la question", ipa: "[kɛstjɔ̃]", ko: "질문", note: "-tion으로 끝나는 영어 단어는 거의 다 프랑스어 출신이에요." },
        ],
        tip: "영어 단어 중 -tion, -able, -age, -ment로 끝나는 말이 보이면 '아, 이거 프랑스어겠구나' 하고 의심해보세요. 십중팔구 맞습니다.",
      },
      {
        heading: "한국인에게 어려운 점, 오히려 쉬운 점",
        body:
          "한국어 화자의 난관은 셋이에요.\n" +
          "**1. 발음** — 한국어에 없는 모음([y], 비모음)과 r. 대신 규칙이 매우 일관적이라 규칙만 익히면 처음 보는 단어도 읽어요.\n" +
          "**2. 명사의 성(性)** — 모든 명사가 남성 아니면 여성. 어미를 보면 80% 이상 추측 가능해요.\n" +
          "**3. 동사 활용** — 인칭마다 동사 모양이 바뀌지만, 어미가 화려하게 변하는 한국어 화자에겐 익숙한 개념이에요.\n\n" +
          "반대로 **쉬운 점**도 있어요. 존댓말(tu/vous)은 한국어와 닮아 직관적이고, 리에종은 한국어 연음과 같은 원리이고, 어순은 영어와 거의 같아요.",
        pitfall: "프랑스어 발음이 어렵다는 말에 겁먹지 마세요. '불규칙해서 어려운' 영어와 달리 프랑스어는 '소리가 낯설 뿐 규칙은 정직한' 언어예요. A0 발음 챕터 2개만 제대로 넘기면 평생 자산이 됩니다.",
      },
      {
        heading: "이 레퍼런스 사용법",
        body:
          "문법 레퍼런스는 A0부터 C2까지 **학습 순서대로** 배열되어 있어요. 예문은 그 레벨까지 배운 문법·어휘만으로 만들었어요.\n\n" +
          "어휘 파트의 명사는 항상 **관사(le/la)와 함께** 실어요 — 성별까지 한 덩어리로 외우는 게 정석이거든요.\n\n" +
          "콜아웃 기호는 네 가지: 🚨 한국인이 헷갈리는 포인트, 🇬🇧 영어와 비교, 🌱 라틴어 뿌리 연결, 💡 팁.",
        etym: "당장 체감해볼까요? 영어 very(매우)는 옛 프랑스어 verai(진짜의)에서 왔고, 그 후손이 프랑스어 vrai(진실한)예요. '매우'라는 영어 부사의 심장에 프랑스어가 박혀 있는 셈이죠. 이런 연결이 앞으로 수백 번 나옵니다.",
      },
    ],
  },

  {
    slug: "a0-02-alphabet",
    level: "A0",
    order: 2,
    title: "알파벳과 악상 기호",
    titleFr: "L'alphabet et les accents",
    summary: "26개 알파벳의 프랑스식 이름과, 글자 위에 붙는 작은 기호(악상)의 정체를 알아봐요.",
    duration: "약 7분",
    sections: [
      {
        heading: "알파벳 26자 — 이름이 달라요",
        pattern: "g = '제'[ʒe] · j = '지'[ʒi] · e = '으'[ə]",
        patternKo: "영어와 이름이 뒤바뀐 듯한 글자들 주의",
        body:
          "프랑스어 알파벳은 영어와 똑같은 26자지만 글자의 **이름**이 달라요. 철자를 불러줄 일(이름 스펠링, 예약 확인)이 많으니 이름부터 익혀두세요.\n\n" +
          "특히 **g**[ʒe]와 **j**[ʒi]는 영어와 이름이 서로 뒤바뀐 느낌이라 한국 학습자들이 정말 자주 헷갈려요.",
        table: {
          caption: "헷갈리기 쉬운 글자 이름만 모음",
          headers: ["글자", "프랑스식 이름", "기억 포인트"],
          rows: [
            ["E e", "으 [ə]", "'이'가 아니라 '으'"],
            ["G g", "제 [ʒe]", "영어 J 이름과 비슷해서 혼동 주의"],
            ["J j", "지 [ʒi]", "영어 G 이름과 비슷해서 혼동 주의"],
            ["H h", "아슈 [aʃ]", "이름과 달리 단어 안에서는 항상 묵음"],
            ["R r", "에흐 [ɛʁ]", "목 안쪽에서 나는 소리"],
            ["W w", "두블르베 [dubləve]", "'V 두 개'라는 뜻"],
            ["Y y", "이그렉 [igʁɛk]", "'그리스의 I'라는 뜻"],
          ],
        },
        pitfall: "프랑스어 g[ʒe]와 j[ʒi]의 이름은 영어 j와 g의 이름을 서로 맞바꾼 것처럼 들려요. 전화로 이메일 주소를 불러줄 때 사고가 가장 많이 나는 지점입니다.",
      },
      {
        heading: "악상(accent) — 글자 위의 작은 기호",
        pattern: "é = [e] · è/ê = [ɛ] · ë/ï = 분리 발음 · ç = [s]",
        patternKo: "발음·의미를 바꾸는 정식 철자, 다섯 가지",
        body:
          "글자 위아래에 붙는 기호를 **악상**이라고 해요. 장식이 아니라 **발음이나 의미를 바꾸는 정식 철자**예요.\n\n" +
          "**é(테귀)**는 닫힌 '에', **è(그라브)**와 **ê(시르콩플렉스)**는 열린 '애'에 가까워요. **트레마(ë, ï)**는 앞 글자와 따로 발음하라는 분리 신호, **세디유(ç)**는 c를 a/o/u 앞에서도 [s]로 읽게 해요.",
        examples: [
          { fr: "le café", ipa: "[kafe]", ko: "커피, 카페", note: "é = 확실한 '에'" },
          { fr: "la mère", ipa: "[mɛʁ]", ko: "어머니", note: "è = 열린 '애'" },
          { fr: "la forêt", ipa: "[fɔʁɛ]", ko: "숲", note: "ê의 모자 = 사라진 s의 흔적. 영어 forest에는 s가 남아있죠!" },
          { fr: "Noël", ipa: "[nɔɛl]", ko: "크리스마스", note: "ë = o와 e를 따로 '노엘'" },
          { fr: "le français", ipa: "[fʁɑ̃sɛ]", ko: "프랑스어", note: "ç 덕분에 '프랑새'가 아니라 [s] 소리" },
        ],
        etym: "ê의 모자는 옛 s가 떨어져 나간 자리예요. forêt=forest, hôpital=hospital, île=isle(island). 모자를 보면 s를 끼워 영어 단어를 떠올려보세요 — 뜻이 보입니다.",
        tip: "악상은 '있으면 좋은 것'이 아니라 철자의 일부예요. café를 cafe로 쓰면 틀린 철자입니다. 다만 대문자에서는 생략되기도 해요 (Ecole = École).",
      },
      {
        heading: "한 가지 더 — 합자 œ",
        pattern: "o + e → œ = [œ]",
        patternKo: "입은 '오', 혀는 '에' — '외'를 짧게",
        body:
          "o와 e가 붙은 **œ**는 sœur(자매), cœur(심장), œuf(달걀) 같은 기초 단어에 나와요. 발음 [œ]는 입은 '오' 모양, 혀는 '에' 위치 — 한국어 **'외'를 짧게** 발음하는 느낌에 가까워요.",
        examples: [
          { fr: "la sœur", ipa: "[sœʁ]", ko: "자매 (언니, 누나, 여동생)" },
          { fr: "le cœur", ipa: "[kœʁ]", ko: "심장, 마음", note: "영어 courage(용기)의 cour-가 바로 이 '심장'이에요." },
        ],
      },
    ],
  },

  {
    slug: "a0-03-vowels",
    level: "A0",
    order: 3,
    title: "모음 발음 — 한국어에 없는 소리 정복",
    titleFr: "Les voyelles",
    summary: "u와 ou의 구별, 비모음(콧소리 모음) 등 한국인이 가장 고전하는 모음을 집중 공략해요.",
    duration: "약 10분",
    sections: [
      {
        heading: "u [y] vs ou [u] — 프랑스어 발음의 첫 관문",
        pattern: "u = [y] · ou = [u]",
        patternKo: "u는 입술 '우' + 혀 '이' / ou는 그냥 'ㅜ'",
        body:
          "**ou**는 한국어 'ㅜ'와 같아서 쉽지만, **u** [y]는 한국어에 없는 소리예요. **'이~' 소리를 내면서 혀는 그대로 두고 입술만 'ㅜ' 모양으로** 오므리세요.\n\n" +
          "이 둘을 구별 못 하면 tu(너)/tout(전부), rue(길)/roue(바퀴)처럼 단어가 통째로 바뀌어요.",
        examples: [
          { fr: "tu", ipa: "[ty]", ko: "너", note: "입술 '우' + 혀 '이'" },
          { fr: "tout", ipa: "[tu]", ko: "전부, 모든", note: "그냥 한국어 '뚜'에 가까워요" },
          { fr: "la rue", ipa: "[ʁy]", ko: "길, 거리" },
          { fr: "merci beaucoup", ipa: "[mɛʁsi boku]", ko: "대단히 감사합니다", note: "beaucoup의 ou는 편한 'ㅜ'" },
        ],
        pitfall: "u를 'ㅠ(유)'로 읽는 게 한국인의 대표 실수예요. [y]는 '이우'를 빠르게 합친 소리가 아니라, 처음부터 끝까지 하나의 모음이에요. 거울 보고 입술이 동그란지 확인하면서 '이' 소리를 내보세요.",
      },
      {
        heading: "비모음 — 코로 울리는 모음 3총사",
        pattern: "an/en = [ɑ̃] · on = [ɔ̃] · in/ain = [ɛ̃]",
        patternKo: "받침 없이 코로만 울리는 하나의 모음",
        body:
          "an/en, on, in/ain은 **모음+ㄴ받침이 아니라**, 코로 공기를 흘려보내는 **하나의 모음(비모음)**이에요. [ɑ̃]은 입을 크게 벌린 '엉', [ɔ̃]은 입술을 동그랗게 한 '옹', [ɛ̃]은 '앵'에 가까운 콧소리예요.\n\n" +
          "핵심은 끝에서 **혀가 입천장에 닿지 않는 것**. 한국어 'ㄴ' 받침은 혀끝이 닿지만, 비모음은 혀가 어디에도 닿지 않고 코로만 울려요.",
        examples: [
          { fr: "la France", ipa: "[fʁɑ̃s]", ko: "프랑스", note: "'프랑스'의 '랑'보다 혀가 닿지 않는 '헝'" },
          { fr: "bon", ipa: "[bɔ̃]", ko: "좋은", note: "'봉'에서 ㅇ받침 빼고 코로" },
          { fr: "le vin", ipa: "[vɛ̃]", ko: "와인, 포도주", note: "'뱅'에 가까운 콧소리" },
          { fr: "bonjour", ipa: "[bɔ̃ʒuʁ]", ko: "안녕하세요", note: "bon이 비모음 — '봉주르'의 받침 ㅇ을 코로" },
        ],
        pitfall: "한글 표기 '봉주르', '레스토랑' 때문에 비모음을 'ㅇ/ㄴ 받침'으로 발음하기 쉬워요. 받침을 발음하는 순간 프랑스인 귀에는 다른 소리로 들립니다. 코를 살짝 막고 연습해보면 코가 울리는 게 느껴져요 — 그게 정답입니다.",
        tip: "단, 뒤에 모음이 오면 비모음이 풀려요. bon은 [bɔ̃]이지만 bonne은 [bɔn]으로 n을 또렷이 발음해요.",
      },
      {
        heading: "나머지 모음 빠르게 정리",
        pattern: "oi = [wa] · au/eau = [o] · ai/ei = [ɛ] · eu = [ø]",
        body:
          "**oi [wa]** — '와'. trois(3), moi(나).\n" +
          "**eu [ø]/[œ]** — '외'를 짧게. deux(2), sœur.\n" +
          "**e (악상 없음)** — 보통 '으'[ə]로 약하게, 또는 아예 안 들려요. le [lə], petit [pəti].\n" +
          "**au/eau [o]** — '오'. eau(물)는 글자 세 개가 그냥 [o] 하나예요.\n" +
          "**ai/ei [ɛ]** — '애'. maison(집).",
        examples: [
          { fr: "trois", ipa: "[tʁwa]", ko: "셋, 3" },
          { fr: "deux", ipa: "[dø]", ko: "둘, 2" },
          { fr: "l'eau", ipa: "[lo]", ko: "물", note: "e-a-u 세 글자 = '오' 한 소리" },
          { fr: "la maison", ipa: "[mɛzɔ̃]", ko: "집" },
        ],
        vsEn: "영어 모음은 같은 철자도 단어마다 발음이 제각각이지만(예: ou — though/through/tough 전부 다름), 프랑스어 모음 조합은 발음이 거의 하나로 고정이에요. ou는 언제나 [u], eau는 언제나 [o]. 규칙을 외우는 보람이 있는 언어입니다.",
      },
    ],
  },

  {
    slug: "a0-04-consonants",
    level: "A0",
    order: 4,
    title: "자음과 묵음 — 안 읽는 글자의 규칙",
    titleFr: "Les consonnes et les lettres muettes",
    summary: "단어 끝 자음은 대부분 묵음! 프랑스어 특유의 r 소리와 함께, '안 읽는 글자'의 규칙을 배워요.",
    duration: "약 9분",
    sections: [
      {
        heading: "대원칙 — 단어 끝 자음은 읽지 않는다",
        pattern: "단어 끝 자음 → 묵음 (예외: c, r, f, l = CaReFuL)",
        body:
          "**단어 끝의 자음은 대부분 묵음**이에요. Paris는 '파히', grand은 '그헝'. 끝에서도 발음되는 자음은 **c, r, f, l** — 영어 단어 **CaReFuL**로 외우세요. (단 -er 동사의 r은 묵음.)\n\n" +
          "단어 끝 **e**(악상 없는)도 거의 항상 묵음이지만, 그 앞의 자음을 살려줘요: petit [pəti] vs petite [pətit].",
        examples: [
          { fr: "Paris", ipa: "[paʁi]", ko: "파리", note: "끝 s 묵음" },
          { fr: "beaucoup", ipa: "[boku]", ko: "많이", note: "끝 p 묵음" },
          { fr: "avec", ipa: "[avɛk]", ko: "~와 함께", note: "CaReFuL의 c — 발음됨" },
          { fr: "bonjour", ipa: "[bɔ̃ʒuʁ]", ko: "안녕하세요", note: "CaReFuL의 r — 발음됨" },
          { fr: "petite", ipa: "[pətit]", ko: "작은 (여성형)", note: "끝 e가 t를 살려줘요" },
        ],
        tip: "묵음 끝자음은 '죽은 글자'가 아니에요. 여성형을 만들거나(petit→petite) 뒤 단어와 연음될 때(다음 챕터!) 되살아나는, 잠자는 글자입니다.",
      },
      {
        heading: "h는 언제나 묵음",
        pattern: "h → 항상 묵음 (무음 h: l'hôtel · 유음 h: le héros)",
        body:
          "**h는 단어 어디에 있든 절대 발음하지 않아요**. hôtel은 '오텔', huit(8)은 '위트'.\n\n" +
          "다만 **무음 h**는 없는 글자 취급이라 축약·연음이 일어나고(l'hôtel), **유음 h**는 자음처럼 행동해 축약을 막아요(le héros). A0에서는 '축약 안 되는 h도 있다' 정도만 알면 충분해요.",
        examples: [
          { fr: "l'hôtel", ipa: "[lotɛl]", ko: "호텔", note: "무음 h — le+hôtel이 l'hôtel로 축약" },
          { fr: "l'heure", ipa: "[lœʁ]", ko: "시간, 시각" },
          { fr: "le héros", ipa: "[lə eʁo]", ko: "영웅", note: "유음 h — 축약이 일어나지 않아요" },
        ],
        pitfall: "한글 표기 '호텔', '에르메스(Hermès)' 때문에 h를 발음하고 싶어지지만, 프랑스어에서 [h] 소리를 내는 순간 외국인 억양이 확 드러나요. h는 눈으로만 보고 입으로는 무시하세요.",
      },
      {
        heading: "프랑스어의 r [ʁ] — 가글하듯 목 안쪽에서",
        pattern: "r = [ʁ] — 'ㄹ'이 아니라 목 안쪽 'ㅎ'",
        body:
          "프랑스어 r는 **목젖 근처를 좁혀 공기를 마찰시키는 소리** [ʁ]예요. 가글할 때 떨리는 위치에서 물 없이 약하게 'ㅎ'를 긁듯 내보세요 (Paris ≈ 빠히).\n\n" +
          "처음부터 완벽할 필요 없어요. **'ㅎ'로 대체**해도 'ㄹ'로 내는 것보다 훨씬 잘 통합니다.",
        examples: [
          { fr: "rouge", ipa: "[ʁuʒ]", ko: "빨간", note: "'후즈'에 가깝게" },
          { fr: "la rue", ipa: "[ʁy]", ko: "길" },
          { fr: "très", ipa: "[tʁɛ]", ko: "매우, 아주" },
        ],
      },
      {
        heading: "자주 나오는 자음 조합",
        pattern: "ch = [ʃ] · gn = [ɲ] · ill = [j] · qu = [k]",
        body:
          "**ch [ʃ]** — 영어 sh 소리. chat(고양이)은 '챗'이 아니라 '샤'.\n" +
          "**gn [ɲ]** — '뉴'에 가까운 소리. montagne(산) = '몽따뉴'.\n" +
          "**ill [j]** — 보통 '이유'의 y 소리. famille = '파미유'. (ville, mille은 예외로 [l].)\n" +
          "**qu [k]** — 영어처럼 '쿠ㅂ'가 아니라 그냥 [k]. qui = '끼'.\n" +
          "**c/g + e,i** — 부드러워져요: c→[s], g→[ʒ]. 그 외엔 c→[k], g→[g].",
        examples: [
          { fr: "le chat", ipa: "[ʃa]", ko: "고양이", note: "ch=[ʃ], 끝 t 묵음" },
          { fr: "la montagne", ipa: "[mɔ̃taɲ]", ko: "산" },
          { fr: "la famille", ipa: "[famij]", ko: "가족", note: "ill = [ij]" },
          { fr: "qui", ipa: "[ki]", ko: "누구" },
        ],
        vsEn: "영어 ch는 [tʃ](church)지만 프랑스어 ch는 [ʃ](마찰음만)예요. 영어에서 프랑스어 차용어인 chef, machine, champagne의 ch가 [ʃ]인 이유가 바로 이것 — 프랑스어 발음이 그대로 따라온 거예요.",
      },
    ],
  },

  {
    slug: "a0-05-liaison",
    level: "A0",
    order: 5,
    title: "리에종과 앙셴느망 — 단어를 이어 읽기",
    titleFr: "La liaison et l'enchaînement",
    summary: "잠자던 묵음 자음이 깨어나 다음 단어와 이어지는 현상. 한국어 연음과 같은 원리라 우리에게 유리해요!",
    duration: "약 7분",
    sections: [
      {
        heading: "리에종 — 묵음 자음의 부활",
        pattern: "묵음 끝 자음 + 모음 시작 단어 → 이어 발음 (vous avez = [vu-za-ve])",
        patternKo: "'옷이→오시'와 같은 연음 원리",
        body:
          "평소 묵음이던 단어 끝 자음이, **다음 단어가 모음으로 시작하면 살아나서 이어 발음**돼요. 이게 **리에종(liaison)**이에요.\n\n" +
          "한국어 연음과 똑같은 원리예요. '옷이'를 '오시'로 읽듯, 받침이 다음 모음으로 넘어가는 거죠.",
        examples: [
          { fr: "vous avez", ipa: "[vuzave]", ko: "당신은 가지고 있다", note: "s가 [z]로 부활" },
          { fr: "les amis", ipa: "[lezami]", ko: "친구들", note: "'레자미' — 한국어 '옷이→오시'와 같은 원리" },
          { fr: "un petit ami", ipa: "[œ̃ pətitami]", ko: "남자친구", note: "petit의 t가 살아나요" },
          { fr: "deux heures", ipa: "[døzœʁ]", ko: "2시", note: "x가 [z]로 — '되죄르'" },
        ],
        tip: "리에종 시 소리 변화: s, x → [z] / d → [t] / f → [v] (neuf heures '뇌뵈르'). 특히 s가 [z]가 되는 게 압도적으로 흔해요.",
      },
      {
        heading: "앙셴느망 — 원래 발음되던 자음도 이어 읽기",
        body:
          "리에종과 비슷한 **앙셴느망(enchaînement)**도 있어요. 원래 발음되던 끝 자음이 다음 모음 단어에 자연스럽게 붙는 현상이에요. il est는 '일 에'가 아니라 '이-레'[i-lɛ]로 흘러가죠.\n\n" +
          "둘을 굳이 구별해 외울 필요는 없어요. 핵심은 하나 — **프랑스어는 단어 단위가 아니라 의미 덩어리 단위로 물 흐르듯 읽는 언어**라는 것. 프랑스어가 노래처럼 들리는 이유가 바로 이거예요.",
        examples: [
          { fr: "il est", ipa: "[ilɛ]", ko: "그는 ~이다", note: "'이레'처럼 흘러가요" },
          { fr: "elle habite", ipa: "[ɛlabit]", ko: "그녀는 산다", note: "h는 묵음이니 l이 바로 a에 붙어요" },
        ],
        vsEn: "영어에도 연결 발음은 있어요 — an apple을 '어내플'처럼 잇죠. 다만 영어는 '편해서 잇는' 수준이고, 프랑스어 리에종은 '안 하면 틀리는' 의무 규칙이 따로 있다는 게 차이예요.",
      },
      {
        heading: "언제 하고 언제 안 하나",
        body:
          "모든 곳에서 리에종을 하는 건 아니에요. A0에서는 **꼭 해야 하는 경우**만 기억하세요.\n\n" +
          "**관사+명사**: les amis, un homme\n" +
          "**대명사+동사**: vous avez, ils ont\n" +
          "**형용사+명사**: petit ami\n" +
          "**짧은 전치사 뒤**: chez elle\n\n" +
          "반대로 **et(그리고) 뒤에서는 절대 리에종하지 않아요**. et un café는 '에 엉 까페'(O), '에뚱 까페'(X).",
        examples: [
          { fr: "et un café", ipa: "[e œ̃ kafe]", ko: "그리고 커피 한 잔", note: "et 뒤는 리에종 금지!" },
        ],
        pitfall: "ils ont [il-zɔ̃](그들은 가진다)과 ils sont [il-sɔ̃](그들은 ~이다)은 리에종의 [z]와 원래 [s]의 차이로만 구별돼요. 듣기에서 정말 자주 출제되는 함정이니 귀를 [z]/[s]에 민감하게 만들어두세요.",
      },
    ],
  },

  {
    slug: "a0-06-gender",
    level: "A0",
    order: 6,
    title: "명사의 성(性) — 모든 명사는 남성 아니면 여성",
    titleFr: "Le genre des noms",
    summary: "한국인이 가장 낯설어하는 개념. 왜 책상이 '남성'인지, 그리고 어미로 성을 추측하는 요령을 배워요.",
    duration: "약 9분",
    sections: [
      {
        heading: "문법적 성이란 — '남자답다/여자답다'가 아니에요",
        body:
          "프랑스어의 **모든 명사**는 남성(masculin) 아니면 여성(féminin) 둘 중 하나예요. le livre(책)는 남성, la table(탁자)는 여성.\n\n" +
          "여기서 한국 학습자가 가장 많이 하는 질문: '책이 왜 남자예요?' — 답은, **아무 이유 없어요**. 문법적 성은 의미가 아니라 그냥 단어의 문법적 분류예요. 한국어에서 '먹다'는 '-다'로 끝나고 명사는 조사가 붙는 것처럼, 임의의 문법 규칙일 뿐이에요. '남성 명사 = 남성적인 것'이라는 연상은 버리는 게 좋아요. 실제로 '수염'(la barbe)은 여성 명사, '화장'(le maquillage)은 남성 명사거든요.\n\n" +
          "사람·동물은 대체로 자연 성별을 따라요: le père(아버지)/la mère(어머니), le frère(형제)/la sœur(자매).",
        examples: [
          { fr: "le livre", ipa: "[livʁ]", ko: "책 (남성)", note: "이유는 묻지 않기로 해요" },
          { fr: "la table", ipa: "[tabl]", ko: "탁자 (여성)" },
          { fr: "le père / la mère", ipa: "[pɛʁ / mɛʁ]", ko: "아버지 / 어머니", note: "사람은 자연 성별대로" },
        ],
        vsEn: "영어도 옛날엔 명사에 성이 있었어요(고대 영어). 지금은 사라져서 the 하나로 통일됐지만, 프랑스어는 라틴어의 성 구분을 그대로 물려받았어요. 영어가 오히려 유럽 언어 중 예외인 셈이에요.",
      },
      {
        heading: "어미를 보면 80%는 맞힌다",
        body:
          "다행히 단어의 **끝부분(어미)을 보면 성을 높은 확률로 추측**할 수 있어요. 대표 패턴만 외워두세요.\n\n" +
          "**여성일 확률이 높은 어미**: -tion/-sion (la nation), -té (la liberté), -ette (la baguette), -ure (la culture), -ence/-ance (la France), -ie (la vie)\n\n" +
          "**남성일 확률이 높은 어미**: -age (le fromage), -ment (le moment), -eau (le bureau), -isme (le tourisme), -o (le métro)",
        table: {
          caption: "성 추측 치트시트",
          headers: ["어미", "성", "예시"],
          rows: [
            ["-tion / -sion", "여성 (거의 100%)", "la question, la télévision"],
            ["-té", "여성", "la liberté, la beauté"],
            ["-ette", "여성", "la baguette, la toilette"],
            ["-ie", "여성", "la vie, la boulangerie"],
            ["-age", "남성", "le fromage, le voyage"],
            ["-ment", "남성 (거의 100%)", "le moment, le appartement → l'appartement"],
            ["-eau", "남성", "le bureau, le cadeau"],
            ["-isme", "남성", "le tourisme, l'optimisme"],
          ],
        },
        etym: "-tion(여성)과 -té(여성)는 라틴어 여성 명사 어미 -tiō, -tās의 후손이에요. 영어 -tion, -ty가 같은 뿌리죠. 즉 nation/nationalité처럼 영어에서 -tion/-ty로 끝나는 단어는 프랑스어에서 거의 다 여성이라고 봐도 됩니다.",
        pitfall: "물론 예외는 있어요. la page(페이지), le squelette(해골)처럼요. 그래서 규칙은 '추측용', 암기는 '관사째로' — 다음 섹션에서 이어집니다.",
      },
      {
        heading: "성을 외우는 유일한 정석 — 관사와 한 덩어리로",
        body:
          "단어를 외울 때 **반드시 관사를 붙여서** 외우세요. 'livre = 책'이 아니라 '**le livre** = 책'으로요.\n\n" +
          "성을 틀리면 관사(le/la), 형용사(petit/petite), 대명사(il/elle)까지 줄줄이 틀리게 돼요. 반대로 단어를 처음 만날 때 관사째 외워두면 나머지는 자동으로 따라옵니다. 이 레퍼런스의 어휘 파트에서 명사를 전부 관사와 함께 싣는 이유예요.\n\n" +
          "모음으로 시작하는 단어는 l'eau처럼 축약돼서 성이 안 보여요. 그럴 땐 '물 = l'eau, 여성'처럼 성을 따로 메모하거나, une eau처럼 부정관사로 외우는 요령이 있어요.",
        examples: [
          { fr: "le livre → un livre", ipa: "[lə livʁ]", ko: "책 — 남성 세트로 암기" },
          { fr: "la table → une table", ipa: "[la tabl]", ko: "탁자 — 여성 세트로 암기" },
          { fr: "l'eau (f.) → une eau", ipa: "[lo]", ko: "물 — 축약될 땐 부정관사로 성 확인" },
        ],
        tip: "스마트폰 단어장에 색을 쓸 수 있다면 남성=파랑, 여성=빨강처럼 시각 코드를 정해두는 것도 효과가 좋아요. 성은 '이해'가 아니라 '습관'의 영역입니다.",
      },
    ],
  },

  {
    slug: "a0-07-articles",
    level: "A0",
    order: 7,
    title: "관사 미리보기 — 한국어에 없는 필수품",
    titleFr: "Les articles",
    summary: "한국어에는 아예 없는 품사, 관사. 왜 프랑스어 명사는 거의 항상 관사를 데리고 다니는지 감을 잡아요.",
    duration: "약 8분",
    sections: [
      {
        heading: "관사 없는 명사는 벌거벗은 명사",
        body:
          "한국어로는 '책 읽어요'라고 하지, '그 책을' '한 권의 책을'이라고 매번 말하지 않죠. 그래서 한국 학습자는 관사를 빼먹는 실수를 정말 오래 해요.\n\n" +
          "프랑스어에서 명사는 **거의 언제나 관사(또는 그 비슷한 말)와 함께** 다녀요. J'aime le café(저는 커피를 좋아해요)에서 le를 빼면 문법적으로 깨진 문장이 돼요. 영어보다도 관사 사용이 더 철저해서, 영어에서는 관사 없이 쓰는 I like coffee 같은 문장에도 프랑스어는 관사가 필요해요.\n\n" +
          "관사는 크게 세 종류: **정관사**(le/la/les), **부정관사**(un/une/des), 그리고 A1에서 배울 **부분관사**(du/de la)예요.",
        examples: [
          { fr: "J'aime le café.", ipa: "[ʒɛm lə kafe]", ko: "저는 커피를 좋아해요.", note: "좋아하는 대상엔 정관사" },
          { fr: "C'est un livre.", ipa: "[sɛtœ̃ livʁ]", ko: "이것은 책이에요.", note: "'하나의' 셀 수 있는 것엔 부정관사" },
        ],
        vsEn: "영어 the≈le/la/les, a≈un/une로 대응되지만 두 가지가 달라요. ① 프랑스어 관사는 명사의 성·수에 따라 모양이 변하고, ② 영어가 관사를 생략하는 자리(I like coffee, in school)에도 프랑스어는 관사를 써요. '영어보다 한 단계 더 깐깐하다'고 기억하세요.",
      },
      {
        heading: "정관사 le, la, les — 그리고 축약 l'",
        body:
          "**le** + 남성 단수 (le livre)\n" +
          "**la** + 여성 단수 (la table)\n" +
          "**l'** + 모음/무음 h로 시작하는 단수 (l'eau, l'hôtel) — 성 불문\n" +
          "**les** + 모든 복수 (les livres, les tables)\n\n" +
          "정관사는 ① 이미 아는·특정한 것(그 책), ② 종류 전체(커피란 것), ③ 좋아하고 싫어하는 대상을 말할 때 써요.",
        table: {
          headers: ["", "남성", "여성", "모음 앞", "복수"],
          rows: [
            ["정관사", "le", "la", "l'", "les"],
            ["부정관사", "un", "une", "un/une", "des"],
          ],
        },
        examples: [
          { fr: "les amis", ipa: "[lezami]", ko: "친구들", note: "les+모음 = 리에종 '레자미'" },
          { fr: "l'université", ipa: "[lynivɛʁsite]", ko: "대학 (여성)", note: "축약되면 성이 숨어요" },
        ],
        etym: "le/la는 라틴어 지시사 ille/illa(저것)가 닳아서 된 말이에요. 영어 the와 기원은 다르지만 운명은 같죠 — '저것'이라고 가리키던 말이 흔해져서 관사가 된 것. 스페인어 el/la, 이탈리아어 il/la도 모두 같은 ille의 후손이라, 프랑스어 관사를 익히면 다른 로망스어 절반은 먹고 들어갑니다.",
      },
      {
        heading: "부정관사 un, une, des — '하나' 그리고 영어에 없는 des",
        body:
          "**un**(남성)/**une**(여성)은 영어 a/an과 같아요 — 정해지지 않은 '하나의' 무엇.\n\n" +
          "특이한 건 **des** — 부정관사의 **복수형**이에요. 영어로는 I have books처럼 관사 없이 말하는 것을, 프랑스어는 J'ai des livres처럼 des를 꼭 붙여요. '몇 개의, 어떤(복수)'이라는 뜻인데 한국어로는 번역되지 않는 경우가 많아요.",
        examples: [
          { fr: "un café, s'il vous plaît", ipa: "[œ̃ kafe sil vu plɛ]", ko: "커피 한 잔 주세요", note: "주문의 만능 공식" },
          { fr: "une question", ipa: "[yn kɛstjɔ̃]", ko: "질문 하나", note: "-tion은 여성 → une" },
          { fr: "J'ai des amis.", ipa: "[ʒe dezami]", ko: "저는 친구들이 있어요.", note: "영어라면 무관사(I have friends)인 자리" },
        ],
        pitfall: "한국어 직역 습관으로 'J'aime café'처럼 관사를 빼는 실수가 A1~B1 내내 이어져요. 지금부터 '프랑스어 명사는 옷(관사)을 입어야 외출한다'고 생각하는 습관을 들이면 몇 년 치 교정이 절약됩니다.",
      },
    ],
  },

  {
    slug: "a0-08-survival",
    level: "A0",
    order: 8,
    title: "인사와 생존 표현 — 그리고 tu / vous",
    titleFr: "Salutations et expressions de survie",
    summary: "첫 회화에 필요한 인사·예의 표현 세트. 한국어 존댓말 감각이 그대로 통하는 tu/vous 구분도 함께!",
    duration: "약 8분",
    sections: [
      {
        heading: "기본 인사 세트",
        body:
          "**Bonjour** [봉주르] — 아침~낮의 만능 인사. 가게에 들어갈 때 점원에게 반드시 건네는 게 프랑스 예절이에요.\n" +
          "**Bonsoir** [봉수아르] — 저녁 인사.\n" +
          "**Salut** [살뤼] — 친한 사이의 '안녕!' (만날 때도 헤어질 때도)\n" +
          "**Au revoir** [오 흐부아] — 헤어질 때.\n" +
          "**Bonne nuit** [본 뉘] — 자러 갈 때만 쓰는 '잘 자'.",
        examples: [
          { fr: "Bonjour, madame.", ipa: "[bɔ̃ʒuʁ madam]", ko: "안녕하세요. (여성에게)", note: "madame/monsieur를 붙이면 한층 정중" },
          { fr: "Salut, ça va ?", ipa: "[saly sa va]", ko: "안녕, 잘 지내?", note: "친구 사이" },
          { fr: "Au revoir, merci !", ipa: "[o ʁəvwaʁ mɛʁsi]", ko: "안녕히 계세요, 감사합니다!" },
        ],
        pitfall: "Bonne nuit는 '좋은 밤 되세요'가 아니라 '잘 자요'예요. 저녁에 헤어지며 Bonne nuit라고 하면 어색해요 — 저녁 작별 인사는 Bonne soirée를 쓰세요.",
      },
      {
        heading: "tu와 vous — 프랑스어의 반말과 존댓말",
        body:
          "프랑스어는 '너'가 두 개예요. **tu**는 친구·가족·아이에게, **vous**는 처음 만난 사람·윗사람·격식 상황에서 써요. (vous는 '여러분'이라는 복수의 뜻도 겸해요.)\n\n" +
          "이 구분, 한국인에게는 전혀 새롭지 않죠? **반말과 존댓말의 감각 그대로**예요. 영어권 학습자들은 이 개념 자체가 없어서 한참 고생하는데, 우리는 '처음 보면 존댓말, 친해지면 말 놓기'라는 사회적 감각을 이미 갖고 있으니 큰 어드밴티지예요.\n\n" +
          "프랑스어에도 '말 놓다'에 해당하는 동사(tutoyer)가 따로 있을 정도로, 이 전환은 관계의 이정표예요. 확신이 없으면 무조건 vous — 한국에서처럼요.",
        examples: [
          { fr: "Comment vous appelez-vous ?", ipa: "[kɔmɑ̃ vuzaple vu]", ko: "성함이 어떻게 되세요? (존대)" },
          { fr: "Tu t'appelles comment ?", ipa: "[ty tapɛl kɔmɑ̃]", ko: "너 이름이 뭐야? (반말)" },
          { fr: "Vous allez bien ?", ipa: "[vuzale bjɛ̃]", ko: "잘 지내세요?" },
        ],
        vsEn: "영어 you는 하나뿐이라 영어에는 이 구분이 없어요. 영어로 생각하고 말하면 tu/vous 선택을 잊기 쉬우니, 오히려 한국어로 '이 사람한테 존댓말 할 상황인가?'를 떠올리는 게 정확해요.",
      },
      {
        heading: "생존 필수 표현 10",
        body: "여행이든 수업이든, 이 열 개면 첫날을 버틸 수 있어요.",
        examples: [
          { fr: "Merci (beaucoup).", ipa: "[mɛʁsi boku]", ko: "감사합니다 (대단히)." },
          { fr: "S'il vous plaît.", ipa: "[sil vu plɛ]", ko: "부탁합니다 / 저기요.", note: "주문·부탁의 필수 마무리" },
          { fr: "Pardon. / Excusez-moi.", ipa: "[paʁdɔ̃ / ɛkskyze mwa]", ko: "실례합니다 / 죄송합니다." },
          { fr: "Oui. / Non.", ipa: "[wi / nɔ̃]", ko: "네. / 아니요." },
          { fr: "Je ne comprends pas.", ipa: "[ʒə nə kɔ̃pʁɑ̃ pa]", ko: "이해하지 못했어요." },
          { fr: "Plus lentement, s'il vous plaît.", ipa: "[ply lɑ̃tmɑ̃ sil vu plɛ]", ko: "더 천천히 말씀해주세요." },
          { fr: "Parlez-vous anglais ?", ipa: "[paʁle vu ɑ̃glɛ]", ko: "영어 하세요?" },
          { fr: "Je suis coréen(ne).", ipa: "[ʒə sɥi kɔʁeɛ̃ / kɔʁeɛn]", ko: "저는 한국인이에요. (남/녀)" },
          { fr: "C'est combien ?", ipa: "[sɛ kɔ̃bjɛ̃]", ko: "얼마예요?" },
          { fr: "Où sont les toilettes ?", ipa: "[u sɔ̃ le twalɛt]", ko: "화장실이 어디예요?" },
        ],
        tip: "프랑스에서는 가게에 들어가며 Bonjour, 나오며 Merci, au revoir를 말하는 게 기본 매너예요. 이 두 마디만 챙겨도 응대의 온도가 달라집니다.",
        etym: "merci는 라틴어 mercēs(보수, 호의)에서 왔어요. 영어 mercy(자비)와 같은 뿌리 — '당신의 호의에 감사하다'는 뜻이 압축된 말이에요.",
      },
    ],
  },
];
