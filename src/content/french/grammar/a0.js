/**
 * A0 입문 — 본격 학습 전 프랑스어 기초 상식
 * 한국어 화자가 프랑스어를 처음 만날 때 막히는 지점을 먼저 풀어주는 오리엔테이션 레벨.
 */
export default [
  {
    slug: "a0-01-orientation",
    level: "A0",
    order: 1,
    title: "영어 단어 절반이 프랑스어였다고?",
    topic: "프랑스어 입문 오리엔테이션",
    titleFr: "Bienvenue en français !",
    summary: "프랑스어가 어떤 언어인지, 그리고 여러분이 이미 가진 영어 자산을 어떻게 활용할지 큰 그림을 그려요.",
    duration: "약 6분",
    sections: [
      {
        heading: "프랑스어는 라틴어의 직계 후손",
        body:
          "프랑스어는 스페인어·이탈리아어와 함께 **라틴어에서 갈라져 나온 형제 언어(로망스어)**예요. 그리고 1066년 노르만 정복 이후 영어 어휘의 **절반 가까이가 프랑스어·라틴어에서 온 말**이 됐어요.\n\n" +
          "그래서 영어를 B1 정도 해두신 분이라면 프랑스어 단어의 상당수를 **이미 아는 상태**로 시작하는 거예요. 이런 연결고리는 🌱 표시로 짚어드릴게요.",
        examples: [
          { fr: "la table", ipa: "[tabl] 따블", ko: "테이블, 탁자", note: "영어 table이 바로 이 프랑스어에서 온 말이에요." },
          { fr: "important", ipa: "[ɛ̃pɔʁtɑ̃] 앵뽀흐땅", ko: "중요한", note: "철자가 영어와 똑같아요. 발음만 프랑스식." },
          { fr: "la question", ipa: "[kɛstjɔ̃] 께스띠옹", ko: "질문", note: "-tion으로 끝나는 영어 단어는 거의 다 프랑스어 출신이에요." },
        ],
        tip: "영어 단어 중 -tion, -able, -age, -ment로 끝나는 말이 보이면 '아, 이거 프랑스어겠구나' 하고 의심해보세요. 십중팔구 맞습니다.",
      },
      {
        heading: "한국인에게 어려운 점, 오히려 쉬운 점",
        body:
          "한국어 화자의 난관은 셋이에요.\n" +
          "**1. 발음** — 한국어에 없는 모음([y], 콧소리 모음(비모음))과 r. 대신 규칙이 매우 일관적이라 규칙만 익히면 처음 보는 단어도 읽어요.\n" +
          "**2. 명사의 성(性)** — 모든 명사가 남성 아니면 여성. 단어 끝부분(어미)을 보면 80% 이상 추측 가능해요.\n" +
          "**3. 동사 활용** — 주어가 나인지 너인지 그인지(인칭)에 따라 동사 모양이 바뀌지만, 어미가 화려하게 변하는 한국어 화자에겐 익숙한 개념이에요.\n\n" +
          "반대로 **쉬운 점**도 있어요. 존댓말(tu(뛰)/vous(부))은 한국어와 닮아 직관적이고, 소리 잇기(리에종)는 한국어 연음('옷이→오시')과 같은 원리이고, 어순은 영어와 거의 같아요.",
        pitfall: "프랑스어 발음이 어렵다는 말에 겁먹지 마세요. '불규칙해서 어려운' 영어와 달리 프랑스어는 '소리가 낯설 뿐 규칙은 정직한' 언어예요. A0 발음 챕터 2개만 제대로 넘기면 평생 자산이 됩니다.",
      },
      {
        heading: "이 레퍼런스 사용법",
        body:
          "문법 레퍼런스는 A0부터 C2까지 **학습 순서대로** 배열되어 있어요. 예문은 그 레벨까지 배운 문법·어휘만으로 만들었어요.\n\n" +
          "어휘 파트의 명사는 항상 **관사(명사 앞에 붙는 짝꿍 단어, le(르)/la(라))와 함께** 실어요 — 성별까지 한 덩어리로 외우는 게 정석이거든요.\n\n" +
          "콜아웃 기호는 네 가지: 🚨 한국인이 헷갈리는 포인트, 🇬🇧 영어와 비교, 🌱 라틴어 뿌리 연결, 💡 팁.",
        etym: "당장 체감해볼까요? 영어 very(매우)는 옛 프랑스어 verai(브헤 — 진짜의)에서 왔고, 그 후손이 프랑스어 vrai(브헤 — 진실한)예요. '매우'라는 영어 부사의 심장에 프랑스어가 박혀 있는 셈이죠. 이런 연결이 앞으로 수백 번 나옵니다.",
      },
    ],
  },

  {
    slug: "a0-02-alphabet",
    level: "A0",
    order: 2,
    title: "café의 é는 장식이 아니다",
    topic: "알파벳·악상 기호(é/è/ç)",
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
          "특히 **g**(제 [ʒe])와 **j**(지 [ʒi])는 영어와 이름이 서로 뒤바뀐 느낌이라 한국 학습자들이 정말 자주 헷갈려요.",
        table: {
          caption: "헷갈리기 쉬운 글자 이름만 모음",
          headers: ["글자", "프랑스식 이름", "기억 포인트"],
          rows: [
            ["E e", "으 [ə]", "'이'가 아니라 '으'"],
            ["G g", "제 [ʒe]", "영어 J 이름과 비슷해서 혼동 주의"],
            ["J j", "지 [ʒi]", "영어 G 이름과 비슷해서 혼동 주의"],
            ["H h", "아슈 [aʃ]", "이름과 달리 단어 안에서는 항상 소리 내지 않아요(묵음)"],
            ["R r", "에흐 [ɛʁ]", "목 안쪽에서 나는 소리"],
            ["W w", "두블르베 [dubləve]", "'V 두 개'라는 뜻"],
            ["Y y", "이그렉 [igʁɛk]", "'그리스의 I'라는 뜻"],
          ],
        },
        pitfall: "프랑스어 g(제)와 j(지)의 이름은 영어 j와 g의 이름을 서로 맞바꾼 것처럼 들려요. 전화로 이메일 주소를 불러줄 때 사고가 가장 많이 나는 지점입니다.",
      },
      {
        heading: "악상(accent) — 글자 위의 작은 기호",
        pattern: "é = [e] · è/ê = [ɛ] · ë/ï = 분리 발음 · ç = [s]",
        patternKo: "발음·의미를 바꾸는 정식 철자, 다섯 가지",
        body:
          "글자 위아래에 붙는 기호를 **악상**이라고 해요. 장식이 아니라 **발음이나 의미를 바꾸는 정식 철자**예요.\n\n" +
          "**é(테귀)**는 닫힌 '에', **è(그라브)**와 **ê(시르콩플렉스)**는 열린 '애'에 가까워요. **트레마(ë, ï)**는 앞 글자와 따로 발음하라는 분리 신호, **세디유(ç)**는 c를 a/o/u 앞에서도 [s]로 읽게 해요.",
        examples: [
          { fr: "le café", ipa: "[kafe] 까페", ko: "커피, 카페", note: "é = 확실한 '에'" },
          { fr: "la mère", ipa: "[mɛʁ] 메흐", ko: "어머니", note: "è = 열린 '애'" },
          { fr: "la forêt", ipa: "[fɔʁɛ] 포헤", ko: "숲", note: "ê의 모자 = 사라진 s의 흔적. 영어 forest에는 s가 남아있죠!" },
          { fr: "Noël", ipa: "[nɔɛl] 노엘", ko: "크리스마스", note: "ë = o와 e를 따로 '노엘'" },
          { fr: "le français", ipa: "[fʁɑ̃sɛ] 프헝세", ko: "프랑스어", note: "ç 덕분에 '프랑까'식 [k]가 아니라 [s] 소리" },
        ],
        etym: "ê의 모자는 옛 s가 떨어져 나간 자리예요. forêt(포헤)=forest, hôpital(오삐딸)=hospital, île(일)=isle(island). 모자를 보면 s를 끼워 영어 단어를 떠올려보세요 — 뜻이 보입니다.",
        tip: "악상은 '있으면 좋은 것'이 아니라 철자의 일부예요. café를 cafe로 쓰면 틀린 철자입니다. 다만 대문자에서는 생략되기도 해요 (Ecole = École, 에꼴).",
      },
      {
        heading: "한 가지 더 — 합자 œ",
        pattern: "o + e → œ = [œ]",
        patternKo: "입은 '오', 혀는 '에' — '외'를 짧게",
        body:
          "o와 e를 한 글자로 붙여 쓴 **œ**(이런 글자를 '합자'라고 해요)는 sœur(쇠흐 — 자매), cœur(꾀흐 — 심장), œuf(외프 — 달걀) 같은 기초 단어에 나와요. 발음 [œ]는 입은 '오' 모양, 혀는 '에' 위치 — 한국어 **'외'를 짧게** 발음하는 느낌에 가까워요.",
        examples: [
          { fr: "la sœur", ipa: "[sœʁ] 쇠흐", ko: "자매 (언니, 누나, 여동생)" },
          { fr: "le cœur", ipa: "[kœʁ] 꾀흐", ko: "심장, 마음", note: "영어 courage(용기)의 cour-가 바로 이 '심장'이에요." },
        ],
      },
    ],
  },

  {
    slug: "a0-03-vowels",
    level: "A0",
    order: 3,
    title: "'우'인 줄 알았던 u의 배신",
    topic: "모음 발음 u/ou·비모음",
    titleFr: "Les voyelles",
    summary: "u와 ou의 구별, 콧소리 모음(비모음) 등 한국인이 가장 고전하는 모음을 집중 공략해요.",
    duration: "약 10분",
    sections: [
      {
        heading: "u [y] vs ou [u] — 프랑스어 발음의 첫 관문",
        pattern: "u = [y] (위) · ou = [u] (우)",
        patternKo: "u는 입술 '우' + 혀 '이' / ou는 그냥 'ㅜ'",
        body:
          "**ou**(우)는 한국어 'ㅜ'와 같아서 쉽지만, **u** [y]는 한국어에 없는 소리예요. **'이~' 소리를 내면서 혀는 그대로 두고 입술만 'ㅜ' 모양으로** 오므리세요.\n\n" +
          "이 둘을 구별 못 하면 tu(뛰 — 너)/tout(뚜 — 전부), rue(휘 — 길)/roue(후 — 바퀴)처럼 단어가 통째로 바뀌어요.",
        examples: [
          { fr: "tu", ipa: "[ty] 뛰", ko: "너", note: "입술 '우' + 혀 '이'" },
          { fr: "tout", ipa: "[tu] 뚜", ko: "전부, 모든", note: "그냥 한국어 '뚜'에 가까워요" },
          { fr: "la rue", ipa: "[ʁy] 휘", ko: "길, 거리" },
          { fr: "merci beaucoup", ipa: "[mɛʁsi boku] 메흐시 보꾸", ko: "대단히 감사합니다", note: "beaucoup의 ou는 편한 'ㅜ'" },
        ],
        pitfall: "u를 'ㅠ(유)'로 읽는 게 한국인의 대표 실수예요. [y]는 '이우'를 빠르게 합친 소리가 아니라, 처음부터 끝까지 하나의 모음이에요. 거울 보고 입술이 동그란지 확인하면서 '이' 소리를 내보세요.",
      },
      {
        heading: "비모음 — 코로 울리는 모음 3총사",
        pattern: "an/en = [ɑ̃] (엉) · on = [ɔ̃] (옹) · in/ain = [ɛ̃] (앵)",
        patternKo: "받침 없이 코로만 울리는 하나의 모음",
        body:
          "an/en, on, in/ain은 **모음+ㄴ받침이 아니라**, 코로 공기를 흘려보내는 **하나의 모음, 곧 콧소리 모음(비모음)**이에요. [ɑ̃]은 입을 크게 벌린 '엉', [ɔ̃]은 입술을 동그랗게 한 '옹', [ɛ̃]은 '앵'에 가까운 콧소리예요.\n\n" +
          "핵심은 끝에서 **혀가 입천장에 닿지 않는 것**. 한국어 'ㄴ' 받침은 혀끝이 닿지만, 콧소리 모음은 혀가 어디에도 닿지 않고 코로만 울려요.",
        examples: [
          { fr: "la France", ipa: "[fʁɑ̃s] 프헝스", ko: "프랑스", note: "'프랑스'의 '랑'보다 혀가 닿지 않는 '헝'" },
          { fr: "bon", ipa: "[bɔ̃] 봉", ko: "좋은", note: "'봉'에서 ㅇ받침 빼고 코로" },
          { fr: "le vin", ipa: "[vɛ̃] 뱅", ko: "와인, 포도주", note: "'뱅'에 가까운 콧소리" },
          { fr: "bonjour", ipa: "[bɔ̃ʒuʁ] 봉주흐", ko: "안녕하세요", note: "bon이 콧소리 모음 — '봉주르'의 받침 ㅇ을 코로" },
        ],
        pitfall: "한글 표기 '봉주르', '레스토랑' 때문에 콧소리 모음을 'ㅇ/ㄴ 받침'으로 발음하기 쉬워요. 받침을 발음하는 순간 프랑스인 귀에는 다른 소리로 들립니다. 코를 살짝 막고 연습해보면 코가 울리는 게 느껴져요 — 그게 정답입니다.",
        tip: "단, 뒤에 모음이 오면 콧소리가 풀려요. bon은 [bɔ̃](봉)이지만 bonne은 [bɔn](본)으로 n을 또렷이 발음해요.",
      },
      {
        heading: "나머지 모음 빠르게 정리",
        pattern: "oi = [wa] (와) · au/eau = [o] (오) · ai/ei = [ɛ] (애) · eu = [ø] (외)",
        patternKo: "조합마다 발음이 하나로 고정된 나머지 모음들",
        body:
          "**oi [wa]** — '와'. trois(트후아 — 3), moi(무아 — 나).\n" +
          "**eu [ø]/[œ]** — '외'를 짧게. deux(되 — 2), sœur(쇠흐).\n" +
          "**e (악상 없음)** — 보통 '으'[ə]로 약하게, 또는 아예 안 들려요. le [lə](르), petit [pəti](쁘띠).\n" +
          "**au/eau [o]** — '오'. eau(오 — 물)는 글자 세 개가 그냥 [o] 하나예요.\n" +
          "**ai/ei [ɛ]** — '애'. maison(메종 — 집).",
        examples: [
          { fr: "trois", ipa: "[tʁwa] 트후아", ko: "셋, 3" },
          { fr: "deux", ipa: "[dø] 되", ko: "둘, 2" },
          { fr: "l'eau", ipa: "[lo] 로", ko: "물", note: "e-a-u 세 글자 = '오' 한 소리" },
          { fr: "la maison", ipa: "[mɛzɔ̃] 메종", ko: "집" },
        ],
        vsEn: "영어 모음은 같은 철자도 단어마다 발음이 제각각이지만(예: ou — though/through/tough 전부 다름), 프랑스어 모음 조합은 발음이 거의 하나로 고정이에요. ou는 언제나 [u](우), eau는 언제나 [o](오). 규칙을 외우는 보람이 있는 언어입니다.",
      },
    ],
  },

  {
    slug: "a0-04-consonants",
    level: "A0",
    order: 4,
    title: "Paris의 s는 왜 안 읽을까?",
    topic: "자음·묵음 규칙(CaReFuL)",
    titleFr: "Les consonnes et les lettres muettes",
    summary: "단어 끝 자음은 대부분 소리 내지 않아요(묵음)! 프랑스어 특유의 r 소리와 함께, '안 읽는 글자'의 규칙을 배워요.",
    duration: "약 9분",
    sections: [
      {
        heading: "대원칙 — 단어 끝 자음은 읽지 않는다",
        pattern: "단어 끝 자음 → 묵음 (예외: c, r, f, l = CaReFuL)",
        patternKo: "끝 자음은 안 읽기 — CaReFuL 네 글자만 예외",
        body:
          "**단어 끝의 자음은 대부분 소리 내지 않는 글자(묵음)**예요. Paris(빠히)는 '파히', grand(그헝)은 '그헝'. 끝에서도 발음되는 자음은 **c, r, f, l** — 영어 단어 **CaReFuL(케어풀)**로 외우세요. (단 -er 동사의 r은 묵음.)\n\n" +
          "단어 끝 **e**(악상 없는)도 거의 항상 묵음이지만, 그 앞의 자음을 살려줘요: petit [pəti](쁘띠) vs petite [pətit](쁘띳).",
        examples: [
          { fr: "Paris", ipa: "[paʁi] 빠히", ko: "파리", note: "끝 s 묵음" },
          { fr: "beaucoup", ipa: "[boku] 보꾸", ko: "많이", note: "끝 p 묵음" },
          { fr: "avec", ipa: "[avɛk] 아벡", ko: "~와 함께", note: "CaReFuL의 c — 발음됨" },
          { fr: "bonjour", ipa: "[bɔ̃ʒuʁ] 봉주흐", ko: "안녕하세요", note: "CaReFuL의 r — 발음됨" },
          { fr: "petite", ipa: "[pətit] 쁘띳", ko: "작은 (여성형)", note: "끝 e가 t를 살려줘요" },
        ],
        tip: "소리 안 나는 끝자음은 '죽은 글자'가 아니라, 여성형을 만들거나(petit→petite) 뒤 단어와 이어 읽을 때(다음 챕터!) 되살아나는 잠자는 글자입니다. 사실 한국에서 이미 쓰고 있어요 — 쁘띠(petit)의 끝 t, 그랑프리(grand prix)의 d와 x가 묵음인 채로 들어온 발음이거든요.",
      },
      {
        heading: "h는 언제나 묵음",
        pattern: "h → 항상 묵음 (무음 h: l'hôtel · 유음 h: le héros)",
        patternKo: "단어 어디에 있든 절대 소리 내지 않는 h",
        body:
          "**h는 단어 어디에 있든 절대 발음하지 않아요**. hôtel(오뗄)은 '오텔', huit(위트 — 8)은 '위트'.\n\n" +
          "다만 **무음 h**는 없는 글자 취급이라 줄여 붙이기(축약)·소리 잇기가 일어나고(l'hôtel), **유음 h**는 자음처럼 행동해 축약을 막아요(le héros). A0에서는 '축약 안 되는 h도 있다' 정도만 알면 충분해요.",
        examples: [
          { fr: "l'hôtel", ipa: "[lotɛl] 로뗄", ko: "호텔", note: "무음 h — le+hôtel이 l'hôtel로 축약" },
          { fr: "l'heure", ipa: "[lœʁ] 뢰흐", ko: "시간, 시각" },
          { fr: "le héros", ipa: "[lə eʁo] 르 에호", ko: "영웅", note: "유음 h — 축약이 일어나지 않아요" },
        ],
        pitfall: "한글 표기 '호텔', '에르메스(Hermès)' 때문에 h를 발음하고 싶어지지만, 프랑스어에서 [h] 소리를 내는 순간 외국인 억양이 확 드러나요. h는 눈으로만 보고 입으로는 무시하세요.",
      },
      {
        heading: "프랑스어의 r [ʁ] — 가글하듯 목 안쪽에서",
        pattern: "r = [ʁ] — 'ㄹ'이 아니라 목 안쪽 'ㅎ'",
        patternKo: "가글하듯 목 안쪽에서 긁는 r 소리",
        body:
          "프랑스어 r는 **목젖 근처를 좁혀 공기를 비비는 소리** [ʁ]예요. 가글할 때 떨리는 위치에서 물 없이 약하게 'ㅎ'를 긁듯 내보세요 (Paris ≈ 빠히).\n\n" +
          "처음부터 완벽할 필요 없어요. **'ㅎ'로 대체**해도 'ㄹ'로 내는 것보다 훨씬 잘 통합니다.",
        examples: [
          { fr: "rouge", ipa: "[ʁuʒ] 후주", ko: "빨간", note: "r를 목 안쪽 'ㅎ'로" },
          { fr: "la rue", ipa: "[ʁy] 휘", ko: "길" },
          { fr: "très", ipa: "[tʁɛ] 트헤", ko: "매우, 아주" },
        ],
      },
      {
        heading: "자주 나오는 자음 조합",
        pattern: "ch = [ʃ] (슈) · gn = [ɲ] (뉴) · ill = [j] (유) · qu = [k] (끄)",
        patternKo: "자주 나오는 자음 조합 4종의 고정 발음",
        body:
          "**ch [ʃ]** — 영어 sh 소리. chat(샤 — 고양이)은 '챗'이 아니라 '샤'.\n" +
          "**gn [ɲ]** — '뉴'에 가까운 소리. montagne(몽따뉴 — 산) = '몽따뉴'.\n" +
          "**ill [j]** — 보통 '이유'의 y 소리. famille(파미유) = '파미유'. (ville(빌), mille(밀)은 예외로 [l].)\n" +
          "**qu [k]** — 영어처럼 '쿠ㅂ'가 아니라 그냥 [k]. qui(끼) = '끼'.\n" +
          "**c/g + e,i** — 부드러워져요: c→[s], g→[ʒ]. 그 외엔 c→[k], g→[g].",
        examples: [
          { fr: "le chat", ipa: "[ʃa] 샤", ko: "고양이", note: "ch=[ʃ], 끝 t 묵음" },
          { fr: "la montagne", ipa: "[mɔ̃taɲ] 몽따뉴", ko: "산" },
          { fr: "la famille", ipa: "[famij] 파미유", ko: "가족", note: "ill = [ij]" },
          { fr: "qui", ipa: "[ki] 끼", ko: "누구" },
        ],
        vsEn: "영어 ch는 [tʃ](church 처치)지만 프랑스어 ch는 [ʃ](바람 소리만)예요. 영어 속 프랑스어 출신 단어인 chef(셰프), machine(머신), champagne(샴페인)의 ch가 [ʃ]인 이유가 바로 이것 — 프랑스어 발음이 그대로 따라온 거예요.",
      },
    ],
  },

  {
    slug: "a0-05-liaison",
    level: "A0",
    order: 5,
    title: "'옷이→오시', 프랑스어에도 있다",
    topic: "리에종·앙셴느망",
    titleFr: "La liaison et l'enchaînement",
    summary: "잠자던 묵음 자음이 깨어나 다음 단어와 이어지는 현상. 한국어 연음과 같은 원리라 우리에게 유리해요!",
    duration: "약 7분",
    sections: [
      {
        heading: "리에종 — 묵음 자음의 부활",
        pattern: "묵음 끝 자음 + 모음 시작 단어 → 이어 발음 (vous avez = [vu-za-ve] 부자베)",
        patternKo: "'옷이→오시'와 같은 연음 원리",
        body:
          "평소 소리 내지 않던 단어 끝 자음이, **다음 단어가 모음으로 시작하면 살아나서 이어 발음**돼요. 이게 **소리 잇기, 곧 리에종(liaison)**이에요.\n\n" +
          "한국어 연음과 똑같은 원리예요. '옷이'를 '오시'로 읽듯, 받침이 다음 모음으로 넘어가는 거죠.",
        examples: [
          { fr: "vous avez", ipa: "[vuzave] 부자베", ko: "당신은 가지고 있다", note: "s가 [z]로 부활" },
          { fr: "les amis", ipa: "[lezami] 레자미", ko: "친구들", note: "한국어 '옷이→오시'와 같은 원리" },
          { fr: "un petit ami", ipa: "[œ̃ pətitami] 엉 쁘띠따미", ko: "남자친구", note: "petit의 t가 살아나요" },
          { fr: "deux heures", ipa: "[døzœʁ] 되죄흐", ko: "2시", note: "x가 [z] 소리로 살아나요" },
        ],
        tip: "소리 잇기 때의 소리 변화: s, x → [z] / d → [t] / f → [v] (neuf heures 뇌뵈흐). 특히 s가 [z]가 되는 게 압도적으로 흔해요.",
      },
      {
        heading: "앙셴느망 — 원래 발음되던 자음도 이어 읽기",
        pattern: "발음되는 끝 자음 + 모음 → 한 덩어리 (il est = [i-lɛ] 일레)",
        patternKo: "원래 소리 나던 끝 자음도 다음 모음에 붙여 물 흐르듯",
        body:
          "**이어 읽기, 앙셴느망(enchaînement)**은 원래 발음되던 끝 자음이 다음 모음 단어에 자연스럽게 붙는 현상이에요. 리에종과 굳이 구별해 외울 필요는 없어요.\n\n" +
          "핵심은 하나 — **프랑스어는 단어 단위가 아니라 의미 덩어리 단위로** 물 흐르듯 읽는 언어라는 것.",
        examples: [
          { fr: "il est", ipa: "[ilɛ] 일레", ko: "그는 ~이다", note: "한 덩어리로 흘러가요" },
          { fr: "elle habite", ipa: "[ɛlabit] 엘라빗", ko: "그녀는 산다", note: "h는 묵음이니 l이 바로 a에 붙어요" },
        ],
        vsEn: "영어에도 연결 발음은 있어요 — an apple을 '어내플'처럼 잇죠. 다만 영어는 '편해서 잇는' 수준이고, 프랑스어 리에종은 '안 하면 틀리는' 의무 규칙이 따로 있다는 게 차이예요.",
      },
      {
        heading: "언제 하고 언제 안 하나",
        pattern: "관사/대명사/형용사/짧은 전치사 + 모음 → 리에종 필수 · et 뒤 → 금지",
        patternKo: "소리 잇기가 필수인 자리와 금지인 자리 구별",
        body:
          "A0에서는 **꼭 해야 하는 경우**만 기억하세요 — **관사+명사**(les amis 레자미), **대명사+동사**(vous avez 부자베), **형용사+명사**(petit ami 쁘띠따미), **짧은 전치사 뒤**(chez elle 셰젤).\n\n" +
          "반대로 **et(에 — 그리고) 뒤에서는 절대 소리를 잇지 않아요**. et un café는 '에 엉 까페'(O), '에뚱 까페'(X).",
        examples: [
          { fr: "et un café", ipa: "[e œ̃ kafe] 에 엉 까페", ko: "그리고 커피 한 잔", note: "et 뒤는 리에종 금지!" },
        ],
        pitfall: "ils ont [il-zɔ̃](일종 — 그들은 가진다)과 ils sont [il-sɔ̃](일쏭 — 그들은 ~이다)은 리에종의 [z]와 원래 [s]의 차이로만 구별돼요. 듣기에서 정말 자주 출제되는 함정이니 귀를 [z]/[s]에 민감하게 만들어두세요.",
      },
    ],
  },

  {
    slug: "a0-06-gender",
    level: "A0",
    order: 6,
    title: "모든 단어에 성별이 있다고?",
    topic: "명사의 성(genre)",
    titleFr: "Le genre des noms",
    summary: "한국인이 가장 낯설어하는 개념. 왜 책상이 '남성'인지, 그리고 단어 끝부분으로 성을 추측하는 요령을 배워요.",
    duration: "약 9분",
    sections: [
      {
        heading: "문법적 성이란 — '남자답다/여자답다'가 아니에요",
        pattern: "모든 명사 → masculin(남성) 또는 féminin(여성)",
        patternKo: "모든 명사는 남성 아니면 여성 — 뜻과는 무관한 칸 나누기",
        body:
          "**모든 명사**는 남성 아니면 여성이에요. '책이 왜 남자예요?'라는 질문의 답은 — **아무 이유 없어요**. 뜻과는 상관없이 문법이 정해놓은 칸 나누기일 뿐이라서, '수염'(la barbe 라 바흐브)은 여성, '화장'(le maquillage 르 마끼아주)은 남성이에요.\n\n" +
          "사람·동물은 대체로 자연 성별을 따라요: le père(르 뻬흐 — 아버지)/la mère(라 메흐 — 어머니).",
        examples: [
          { fr: "le livre", ipa: "[livʁ] 리브흐", ko: "책 (남성)", note: "이유는 묻지 않기로 해요" },
          { fr: "la table", ipa: "[tabl] 따블", ko: "탁자 (여성)" },
          { fr: "le père / la mère", ipa: "[pɛʁ / mɛʁ] 뻬흐 / 메흐", ko: "아버지 / 어머니", note: "사람은 자연 성별대로" },
        ],
        vsEn: "영어도 옛날엔 명사에 성이 있었어요(고대 영어). 지금은 사라져서 the 하나로 통일됐지만, 프랑스어는 라틴어의 성 구분을 그대로 물려받았어요. 영어가 오히려 유럽 언어 중 예외인 셈이에요.",
      },
      {
        heading: "어미를 보면 80%는 맞힌다",
        pattern: "-tion/-té/-ette/-ie → 여성 · -age/-ment/-eau/-isme → 남성",
        patternKo: "단어 끝부분만 보고 성을 80% 맞히는 추측 규칙",
        body:
          "단어의 **끝부분(어미)을 보면 성을 높은 확률로 추측**할 수 있어요. 아래 표의 대표 패턴만 외워두세요.",
        table: {
          caption: "성 추측 치트시트",
          headers: ["어미", "성", "예시"],
          rows: [
            ["-tion / -sion", "여성 (거의 100%)", "la question(께스띠옹), la télévision(뗄레비지옹)"],
            ["-té", "여성", "la liberté(리베흐떼), la beauté(보떼)"],
            ["-ette", "여성", "la baguette(바겟), la toilette(뚜알렛)"],
            ["-ie", "여성", "la vie(비), la boulangerie(불랑즈히)"],
            ["-age", "남성", "le fromage(프호마주), le voyage(부아야주)"],
            ["-ment", "남성 (거의 100%)", "le moment(모멍), le appartement → l'appartement(아빠흐뜨멍)"],
            ["-eau", "남성", "le bureau(뷔호), le cadeau(꺄도)"],
            ["-isme", "남성", "le tourisme(뚜히즘), l'optimisme(옵띠미즘)"],
          ],
        },
        etym: "-tion(여성)과 -té(여성)는 라틴어 여성 명사 어미 -tiō, -tās의 후손이에요. 영어 -tion, -ty가 같은 뿌리죠. 즉 nation/nationalité처럼 영어에서 -tion/-ty로 끝나는 단어는 프랑스어에서 거의 다 여성이라고 봐도 됩니다.",
        pitfall: "물론 예외는 있어요. la page(빠주 — 페이지), le squelette(스껠렛 — 해골)처럼요. 그래서 규칙은 '추측용', 암기는 '관사째로' — 다음 섹션에서 이어집니다.",
      },
      {
        heading: "성을 외우는 유일한 정석 — 관사와 한 덩어리로",
        pattern: "암기 = 관사 + 명사 (livre ✗ → le livre ✓)",
        patternKo: "성 암기는 관사를 붙인 한 덩어리로",
        body:
          "단어는 **반드시 관사를 붙여서** 외우세요. 성을 틀리면 관사·형용사·대명사까지 줄줄이 틀리지만, 관사째 외워두면 나머지는 자동으로 따라와요.\n\n" +
          "모음으로 시작하는 단어는 l'eau(로)처럼 줄어들어 성이 안 보이니, **une eau(윈 오)처럼 '하나의'를 뜻하는 관사(부정관사)로** 외우는 요령이 있어요.",
        examples: [
          { fr: "le livre → un livre", ipa: "[lə livʁ] 르 리브흐", ko: "책 — 남성 세트로 암기" },
          { fr: "la table → une table", ipa: "[la tabl] 라 따블", ko: "탁자 — 여성 세트로 암기" },
          { fr: "l'eau (f.) → une eau", ipa: "[lo] 로", ko: "물 — 축약될 땐 부정관사로 성 확인" },
        ],
        tip: "단어장에 남성=파랑, 여성=빨강 색 코드를 정해두는 것도 좋지만, 브랜드명도 훌륭한 암기 카드예요. 라네즈(la neige 라 네주, 눈)는 여성이라 la가 맞고, 마몽드(Ma Monde)는 monde(몽드)가 남성이라 문법대로라면 mon monde — 이 '틀린 성'이 오히려 기억에 남죠. 성은 '이해'가 아니라 '습관'의 영역입니다.",
      },
    ],
  },

  {
    slug: "a0-07-articles",
    level: "A0",
    order: 7,
    title: "'커피 한 잔'의 '한'이 필수인 언어",
    topic: "관사 입문 le/la·un/une",
    titleFr: "Les articles",
    summary: "한국어에는 아예 없는 품사, 관사. 왜 프랑스어 명사는 거의 항상 관사를 데리고 다니는지 감을 잡아요.",
    duration: "약 8분",
    sections: [
      {
        heading: "관사 없는 명사는 벌거벗은 명사",
        pattern: "명사 → 거의 항상 관사와 함께 (정관사 le/la/les · 부정관사 un/une/des · 부분관사 du/de la)",
        patternKo: "명사는 거의 언제나 관사를 입고 다닌다",
        body:
          "관사는 명사 앞에 붙는 작은 단어예요. '정해진 그것'을 가리키면 **정관사**(le/la/les), '아무거나 하나'면 **부정관사**(un/une/des)라고 불러요. 한국어엔 관사가 없어서 한국 학습자는 관사를 빼먹는 실수를 정말 오래 해요. 프랑스어 명사는 **거의 언제나 관사와 함께** 다니고, J'aime le café(젬 르 까페)에서 le를 빼면 깨진 문장이 돼요.\n\n" +
          "영어보다도 철저해서, 영어가 관사 없이 쓰는 I like coffee 같은 문장에도 프랑스어는 관사가 필요해요.",
        examples: [
          { fr: "J'aime le café.", ipa: "[ʒɛm lə kafe] 젬 르 까페", ko: "저는 커피를 좋아해요.", note: "좋아하는 대상엔 정관사" },
          { fr: "C'est un livre.", ipa: "[sɛtœ̃ livʁ] 세떵 리브흐", ko: "이것은 책이에요.", note: "'하나의' 셀 수 있는 것엔 부정관사" },
        ],
        vsEn: "영어 the≈le/la/les, a≈un/une로 대응되지만 두 가지가 달라요. ① 프랑스어 관사는 명사의 성·수에 따라 모양이 변하고, ② 영어가 관사를 생략하는 자리(I like coffee, in school)에도 프랑스어는 관사를 써요. '영어보다 한 단계 더 깐깐하다'고 기억하세요.",
      },
      {
        heading: "정관사 le, la, les — 그리고 축약 l'",
        pattern: "le + 남성 단수 · la + 여성 단수 · l' + 모음 앞 · les + 복수",
        patternKo: "'정해진 그것'을 가리키는 정관사 네 형태",
        body:
          "'정해진 그것'을 가리키는 정관사는 **le**(르) livre, **la**(라) table, **l'**eau(모음/무음 h 앞, 성 불문), **les**(레) livres(모든 복수)예요.\n\n" +
          "정관사는 ① 이미 아는·특정한 것(그 책), ② 종류 전체(커피란 것), ③ **좋아하고 싫어하는 대상**을 말할 때 써요.",
        table: {
          headers: ["", "남성", "여성", "모음 앞", "복수"],
          rows: [
            ["정관사", "le", "la", "l'", "les"],
            ["부정관사", "un", "une", "un/une", "des"],
          ],
        },
        examples: [
          { fr: "les amis", ipa: "[lezami] 레자미", ko: "친구들", note: "les+모음 = 소리 잇기(리에종)" },
          { fr: "l'université", ipa: "[lynivɛʁsite] 뤼니베흐시떼", ko: "대학 (여성)", note: "축약되면 성이 숨어요" },
        ],
        etym: "le/la는 라틴어 지시사 ille/illa(저것)가 닳아서 된 말로, 스페인어 el/la, 이탈리아어 il/la도 같은 후손이에요. 그리고 이미 한국 마트에 진열돼 있죠 — 라네즈(la neige 라 네주, 여성 단수)의 la, 뚜레쥬르(Tous les jours 뚜 레 주흐, 복수)의 les가 전부 이 정관사예요. 브랜드명을 보며 '왜 la지? 왜 les지?'를 따져보면 그게 곧 관사 공부입니다.",
      },
      {
        heading: "부정관사 un, une, des — '하나' 그리고 영어에 없는 des",
        pattern: "un + 남성 · une + 여성 · des + 복수",
        patternKo: "des는 영어에도 없는 '복수 부정관사'",
        body:
          "**un**(엉, 남성)/**une**(윈, 여성)은 영어 a/an과 같아요 — 정해지지 않은 '하나의' 무엇.\n\n" +
          "특이한 건 복수형 **des**(데)예요. 영어로는 I have books처럼 관사 없이 말하는 것을, 프랑스어는 J'ai **des** livres(줴 데 리브흐)처럼 des를 꼭 붙여요. 한국어로는 번역되지 않는 경우가 많아요.",
        examples: [
          { fr: "un café, s'il vous plaît", ipa: "[œ̃ kafe sil vu plɛ] 엉 까페 실 부 쁠레", ko: "커피 한 잔 주세요", note: "주문의 만능 공식" },
          { fr: "une question", ipa: "[yn kɛstjɔ̃] 윈 께스띠옹", ko: "질문 하나", note: "-tion은 여성 → une" },
          { fr: "J'ai des amis.", ipa: "[ʒe dezami] 줴 데자미", ko: "저는 친구들이 있어요.", note: "영어라면 관사 없이(I have friends) 말하는 자리" },
        ],
        pitfall: "한국어 직역 습관으로 'J'aime café'처럼 관사를 빼는 실수가 A1~B1 내내 이어져요. 지금부터 '프랑스어 명사는 옷(관사)을 입어야 외출한다'고 생각하는 습관을 들이면 몇 년 치 교정이 절약됩니다.",
      },
    ],
  },

  {
    slug: "a0-08-survival",
    level: "A0",
    order: 8,
    title: "\"봉주르\" 없이는 시작도 없다",
    topic: "인사·생존 표현과 tu/vous",
    titleFr: "Salutations et expressions de survie",
    summary: "첫 회화에 필요한 인사·예의 표현 세트. 한국어 존댓말 감각이 그대로 통하는 tu/vous 구분도 함께!",
    duration: "약 8분",
    sections: [
      {
        heading: "기본 인사 세트",
        pattern: "Bonjour(봉주흐) → 낮 · Bonsoir(봉수아흐) → 저녁 · Salut(살뤼) → 친한 사이 · Au revoir(오 흐부아) → 작별",
        patternKo: "때와 친한 정도에 따라 갈리는 기본 인사 세트",
        body:
          "**Bonjour** [봉주흐] — 아침~낮의 만능 인사. 가게에 들어갈 때 점원에게 반드시 건네는 게 프랑스 예절이에요.\n" +
          "**Bonsoir** [봉수아흐] — 저녁 인사.\n" +
          "**Salut** [살뤼] — 친한 사이의 '안녕!' (만날 때도 헤어질 때도)\n" +
          "**Au revoir** [오 흐부아] — 헤어질 때.\n" +
          "**Bonne nuit** [본 뉘] — 자러 갈 때만 쓰는 '잘 자'.",
        examples: [
          { fr: "Bonjour, madame.", ipa: "[bɔ̃ʒuʁ madam] 봉주흐 마담", ko: "안녕하세요. (여성에게)", note: "madame(마담)/monsieur(므시외)를 붙이면 한층 정중" },
          { fr: "Salut, ça va ?", ipa: "[saly sa va] 살뤼 사 바", ko: "안녕, 잘 지내?", note: "친구 사이" },
          { fr: "Au revoir, merci !", ipa: "[o ʁəvwaʁ mɛʁsi] 오 흐부아 메흐시", ko: "안녕히 계세요, 감사합니다!" },
        ],
        pitfall: "Bonne nuit(본 뉘)는 '좋은 밤 되세요'가 아니라 '잘 자요'예요. 저녁에 헤어지며 Bonne nuit라고 하면 어색해요 — 저녁 작별 인사는 Bonne soirée(본 수아헤)를 쓰세요.",
      },
      {
        heading: "tu와 vous — 프랑스어의 반말과 존댓말",
        pattern: "tu(뛰) = 반말 (친구·가족) · vous(부) = 존댓말 + 복수 '여러분'",
        patternKo: "한국어 반말/존댓말 감각이 그대로 통하는 구분",
        body:
          "**tu**(뛰)는 친구·가족·아이에게, **vous**(부)는 처음 만난 사람·윗사람·격식 상황에서 써요. 한국어 **반말/존댓말 감각 그대로**라 우리에겐 큰 어드밴티지예요.\n\n" +
          "'말 놓다'에 해당하는 동사(tutoyer 뛰뚜아예)가 따로 있을 만큼 이 전환은 관계의 이정표예요. 확신이 없으면 무조건 vous — 한국에서처럼요.",
        examples: [
          { fr: "Comment vous appelez-vous ?", ipa: "[kɔmɑ̃ vuzaple vu] 꼬멍 부자쁠레 부", ko: "성함이 어떻게 되세요? (존대)" },
          { fr: "Tu t'appelles comment ?", ipa: "[ty tapɛl kɔmɑ̃] 뛰 따뻴 꼬멍", ko: "너 이름이 뭐야? (반말)" },
          { fr: "Vous allez bien ?", ipa: "[vuzale bjɛ̃] 부잘레 비앵", ko: "잘 지내세요?" },
        ],
        vsEn: "영어 you는 하나뿐이라 영어에는 이 구분이 없어요. 영어로 생각하고 말하면 tu/vous 선택을 잊기 쉬우니, 오히려 한국어로 '이 사람한테 존댓말 할 상황인가?'를 떠올리는 게 정확해요.",
      },
      {
        heading: "생존 필수 표현 10",
        body: "여행이든 수업이든, 이 열 개면 첫날을 버틸 수 있어요.",
        examples: [
          { fr: "Merci (beaucoup).", ipa: "[mɛʁsi boku] 메흐시 (보꾸)", ko: "감사합니다 (대단히)." },
          { fr: "S'il vous plaît.", ipa: "[sil vu plɛ] 실 부 쁠레", ko: "부탁합니다 / 저기요.", note: "주문·부탁의 필수 마무리" },
          { fr: "Pardon. / Excusez-moi.", ipa: "[paʁdɔ̃ / ɛkskyze mwa] 빠흐동 / 엑스뀌제 무아", ko: "실례합니다 / 죄송합니다." },
          { fr: "Oui. / Non.", ipa: "[wi / nɔ̃] 위 / 농", ko: "네. / 아니요." },
          { fr: "Je ne comprends pas.", ipa: "[ʒə nə kɔ̃pʁɑ̃ pa] 즈 느 꽁프헝 빠", ko: "이해하지 못했어요." },
          { fr: "Plus lentement, s'il vous plaît.", ipa: "[ply lɑ̃tmɑ̃ sil vu plɛ] 쁠뤼 렁뜨멍 실 부 쁠레", ko: "더 천천히 말씀해주세요." },
          { fr: "Parlez-vous anglais ?", ipa: "[paʁle vu ɑ̃glɛ] 빠흘레 부 엉글레", ko: "영어 하세요?" },
          { fr: "Je suis coréen(ne).", ipa: "[ʒə sɥi kɔʁeɛ̃ / kɔʁeɛn] 즈 스위 꼬헤앵 / 꼬헤엔", ko: "저는 한국인이에요. (남/녀)" },
          { fr: "C'est combien ?", ipa: "[sɛ kɔ̃bjɛ̃] 세 꽁비앵", ko: "얼마예요?" },
          { fr: "Où sont les toilettes ?", ipa: "[u sɔ̃ le twalɛt] 우 쏭 레 뚜알렛", ko: "화장실이 어디예요?" },
        ],
        tip: "프랑스에서는 가게에 들어가며 Bonjour(봉주흐), 나오며 Merci, au revoir(메흐시, 오 흐부아)를 말하는 게 기본 매너예요. 이 두 마디만 챙겨도 응대의 온도가 달라집니다.",
        etym: "merci(메흐시)는 라틴어 mercēs(보수, 호의)에서 왔어요. 영어 mercy(자비)와 같은 뿌리 — '당신의 호의에 감사하다'는 뜻이 압축된 말이에요.",
      },
    ],
  },
];
