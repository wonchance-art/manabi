/**
 * 프랑스어 연습문제 보강 초안.
 *
 * DRAFT — Claude 콘텐츠 검수 전에는 확정본이 아니다.
 * DRAFT — index.js나 어떤 런타임 소비자에도 연결하지 않는다.
 *
 * 문법 quiz는 buildChapterQuiz() → RefPatternCheck가 소비하는
 * { meaning, apply, produce } 형식을 그대로 따른다.
 *
 * 어휘 items는 studySession.js의 채점 문항 형식
 * (vocab-choice / vocab-cloze / vocab-typing)을 따른다. uid와 effect는
 * 세션 조립 시 붙는 런타임 메타이므로 이 저작 초안에서는 제외했다.
 */

const grammar = {
  // DRAFT — A0 레벨팩 대표 3문항. A0 UI는 현재 패턴 체크를 렌더하지 않는다.
  A0: {
    source: "grammar/a0.js",
    quiz: {
      meaning: [
        {
          sentence: "Je ＿＿＿ une pomme.",
          full: "Je mange une pomme.",
          ko: "저는 사과를 먹어요.",
          correct: "mange",
          distractors: ["manges", "mangez", "mangent"],
          pron: "[ʒə mɑ̃ʒ yn pɔm]",
        },
      ],
      apply: [
        {
          type: "order",
          tokens: ["Je", "mange", "une", "pomme."],
          answer: "Je mange une pomme.",
          ko: "저는 사과를 먹어요.",
          pron: "[ʒə mɑ̃ʒ yn pɔm]",
        },
      ],
      produce: [
        {
          ko: "저는 커피를 좋아해요.",
          main: "J'aime le café.",
          pron: "[ʒɛm lə kafe]",
        },
      ],
    },
  },

  // DRAFT — A1 레벨팩 대표 3문항.
  A1: {
    source: "grammar/a1.js",
    quiz: {
      meaning: [
        {
          sentence: "Je ne parle ＿＿＿ chinois.",
          full: "Je ne parle pas chinois.",
          ko: "저는 중국어를 못해요.",
          correct: "pas",
          distractors: ["plus", "jamais", "rien"],
          pron: "[ʒə nə paʁl pa ʃinwa]",
        },
      ],
      apply: [
        {
          type: "order",
          tokens: ["J'ai", "un", "chat."],
          answer: "J'ai un chat.",
          ko: "저는 고양이 한 마리가 있어요.",
          pron: "[ʒe œ̃ ʃa]",
        },
      ],
      produce: [
        {
          ko: "저는 잘 지내요.",
          main: "Je vais bien.",
          pron: "[ʒə vɛ bjɛ̃]",
        },
      ],
    },
  },

  // DRAFT — A2 레벨팩 대표 3문항.
  A2: {
    source: "grammar/a2.js",
    quiz: {
      meaning: [
        {
          sentence: "J'ai ＿＿＿ une pizza.",
          full: "J'ai mangé une pizza.",
          ko: "저는 피자를 먹었어요.",
          correct: "mangé",
          distractors: ["manger", "mange", "mangeais"],
          pron: "[ʒe mɑ̃ʒe yn pidza]",
        },
      ],
      apply: [
        {
          type: "order",
          tokens: ["Il", "est", "plus", "grand", "que", "moi."],
          answer: "Il est plus grand que moi.",
          ko: "그는 저보다 키가 커요.",
          pron: "[il ɛ ply gʁɑ̃ kə mwa]",
        },
      ],
      produce: [
        {
          ko: "3년째 프랑스어를 배우고 있어요.",
          main: "J'apprends le français depuis trois ans.",
          pron: "[ʒapʁɑ̃ lə fʁɑ̃sɛ dəpɥi tʁwazɑ̃]",
        },
      ],
    },
  },

  // DRAFT — B1 레벨팩 대표 3문항.
  B1: {
    source: "grammar/b1.js",
    quiz: {
      meaning: [
        {
          sentence: "Ce roman est ＿＿＿ en vingt langues.",
          full: "Ce roman est traduit en vingt langues.",
          ko: "이 소설은 20개 언어로 번역되어 있어요.",
          correct: "traduit",
          distractors: ["traduire", "traduira", "traduction"],
          pron: null,
        },
      ],
      apply: [
        {
          type: "order",
          tokens: ["Elle", "dit", "qu'elle", "a", "faim."],
          answer: "Elle dit qu'elle a faim.",
          ko: "그녀는 배고프다고 말해요.",
          pron: null,
        },
      ],
      produce: [
        {
          ko: "길 잃지 않게 약도를 보내 줄게.",
          main: "Je t'envoie le plan pour que tu ne te perdes pas.",
          pron: "[ʒə tɑ̃vwa lə plɑ̃ puʁ kə ty nə tə pɛʁd pa]",
        },
      ],
    },
  },

  // DRAFT — B2 레벨팩 대표 3문항.
  B2: {
    source: "grammar/b2.js",
    quiz: {
      meaning: [
        {
          sentence: "Il ne reste ＿＿＿ dans le frigo.",
          full: "Il ne reste rien dans le frigo.",
          ko: "냉장고에 아무것도 안 남았어요.",
          correct: "rien",
          distractors: ["jamais", "personne", "nulle part"],
          pron: "[il nə ʁɛst ʁjɛ̃ dɑ̃ lə fʁiɡo]",
        },
      ],
      apply: [
        {
          type: "order",
          tokens: ["C'est", "moi", "qui", "ai", "fait", "ça."],
          answer: "C'est moi qui ai fait ça.",
          ko: "그거 한 사람 나야.",
          pron: null,
        },
      ],
      produce: [
        {
          ko: "내일 비가 오면 집에 있을 거예요.",
          main: "S'il pleut demain, on restera à la maison.",
          pron: null,
        },
      ],
    },
  },

  // DRAFT — C1 레벨팩 대표 3문항.
  C1: {
    source: "grammar/c1.js",
    quiz: {
      meaning: [
        {
          sentence: "Depuis qu'elle est partie, j'ai ＿＿＿.",
          full: "Depuis qu'elle est partie, j'ai le cafard.",
          ko: "그녀가 떠난 뒤로 마음이 울적해요.",
          correct: "le cafard",
          distractors: ["la pêche", "la lune", "les pieds"],
          pron: null,
        },
      ],
      apply: [
        {
          type: "order",
          tokens: ["Ne", "sachant", "que", "répondre,", "elle", "garda", "le", "silence."],
          answer: "Ne sachant que répondre, elle garda le silence.",
          ko: "뭐라 답해야 할지 몰라, 그녀는 침묵을 지켰다.",
          pron: null,
        },
      ],
      produce: [
        {
          ko: "그녀가 어디 사는지는 알지만, 그 동네는 잘 몰라요.",
          main: "Je sais où elle habite, mais je ne connais pas son quartier.",
          pron: null,
        },
      ],
    },
  },

  // DRAFT — C2 레벨팩 대표 3문항.
  C2: {
    source: "grammar/c2.js",
    quiz: {
      meaning: [
        {
          sentence: "Ça fait ＿＿＿ euros.",
          full: "Ça fait nonante-cinq euros.",
          ko: "95유로입니다. (벨기에·스위스)",
          correct: "nonante-cinq",
          distractors: ["quatre-vingt-quinze", "septante-cinq", "huitante-cinq"],
          pron: null,
        },
      ],
      apply: [
        {
          type: "order",
          tokens: ["Il", "fallait", "qu'il", "partît", "avant", "l'aube."],
          answer: "Il fallait qu'il partît avant l'aube.",
          ko: "그는 동트기 전에 떠나야 했다.",
          pron: null,
        },
      ],
      produce: [
        {
          ko: "오후 내내 센 강변을 하릴없이 거닐며 보냈어요.",
          main: "J'ai passé l'après-midi à flâner le long de la Seine.",
          pron: null,
        },
      ],
    },
  },
};

const vocab = {
  // DRAFT — vocab/a0.js 대표 3문항.
  "a0.js": {
    source: "vocab/a0.js",
    items: [
      {
        type: "vocab-choice",
        word: { word_text: "bonjour", meaning: "안녕하세요 (아침~낮)", furigana: "[bɔ̃ʒuʁ]" },
        options: ["안녕하세요 (아침~낮)", "안녕하세요 (저녁)", "안녕히 가세요", "잘 자요"],
        sentence: null,
      },
      {
        type: "vocab-cloze",
        word: { word_text: "salut", meaning: "안녕 (친한 사이)", furigana: "[saly]" },
        options: null,
        sentence: { main: "Entre amis, on dit salut.", pron: "[ɑ̃tʁ ami ɔ̃ di saly]" },
      },
      {
        type: "vocab-typing",
        word: { word_text: "au revoir", meaning: "안녕히 가세요 / 안녕히 계세요", furigana: "[o ʁəvwaʁ]" },
        options: null,
        sentence: null,
      },
    ],
  },

  // DRAFT — vocab/a1.js 대표 3문항.
  "a1.js": {
    source: "vocab/a1.js",
    items: [
      {
        type: "vocab-choice",
        word: { word_text: "la famille", meaning: "가족", furigana: "[famij]" },
        options: ["가족", "아버지", "어머니", "형제"],
        sentence: null,
      },
      {
        type: "vocab-cloze",
        word: { word_text: "le père", meaning: "아버지", furigana: "[pɛʁ]" },
        options: null,
        sentence: { main: "Dans cette photo, le père est à gauche.", pron: "[dɑ̃ sɛt foto lə pɛʁ ɛ ta ɡoʃ]" },
      },
      {
        type: "vocab-typing",
        word: { word_text: "la mère", meaning: "어머니", furigana: "[mɛʁ]" },
        options: null,
        sentence: null,
      },
    ],
  },

  // DRAFT — vocab/a1_flelex.js 대표 3문항.
  "a1_flelex.js": {
    source: "vocab/a1_flelex.js",
    items: [
      {
        type: "vocab-choice",
        word: { word_text: "le nom", meaning: "이름, 성(姓)", furigana: "[nɔ̃]" },
        options: ["이름, 성(姓)", "단어", "목소리", "예, 보기"],
        sentence: null,
      },
      {
        type: "vocab-cloze",
        word: { word_text: "le mot", meaning: "단어, 말", furigana: "[mo]" },
        options: null,
        sentence: { main: "Je cherche le mot juste.", pron: "[ʒə ʃɛʁʃ lə mo ʒyst]" },
      },
      {
        type: "vocab-typing",
        word: { word_text: "la voix", meaning: "목소리, 표", furigana: "[vwa]" },
        options: null,
        sentence: null,
      },
    ],
  },

  // DRAFT — vocab/a2.js 대표 3문항.
  "a2.js": {
    source: "vocab/a2.js",
    items: [
      {
        type: "vocab-choice",
        word: { word_text: "le voyage", meaning: "여행", furigana: "[vwajaʒ]" },
        options: ["여행", "기차", "비행기", "표"],
        sentence: null,
      },
      {
        type: "vocab-cloze",
        word: { word_text: "le train", meaning: "기차", furigana: "[tʁɛ̃]" },
        options: null,
        sentence: { main: "Je prends le train pour Busan.", pron: "[ʒə pʁɑ̃ lə tʁɛ̃ puʁ Busan]" },
      },
      {
        type: "vocab-typing",
        word: { word_text: "le billet", meaning: "표, 티켓; 지폐", furigana: "[bijɛ]" },
        options: null,
        sentence: null,
      },
    ],
  },

  // DRAFT — vocab/a2_flelex.js 대표 3문항.
  "a2_flelex.js": {
    source: "vocab/a2_flelex.js",
    items: [
      {
        type: "vocab-choice",
        word: { word_text: "le public", meaning: "대중, 관객", furigana: "[pyblik]" },
        options: ["대중, 관객", "정치, 정책", "관심, 흥미", "소비"],
        sentence: null,
      },
      {
        type: "vocab-cloze",
        word: { word_text: "la politique", meaning: "정치; 정책", furigana: "[pɔlitik]" },
        options: null,
        sentence: { main: "Il s'intéresse à la politique.", pron: "[il sɛ̃teʁɛs a la pɔlitik]" },
      },
      {
        type: "vocab-typing",
        word: { word_text: "l'intérêt (m.)", meaning: "관심, 흥미; 이익, 이자", furigana: "[ɛ̃teʁɛ]" },
        options: null,
        sentence: null,
      },
    ],
  },

  // DRAFT — vocab/b1.js 대표 3문항.
  "b1.js": {
    source: "vocab/b1.js",
    items: [
      {
        type: "vocab-choice",
        word: { word_text: "le métier", meaning: "직업", furigana: "[metje]" },
        options: ["직업", "채용", "실업", "회의"],
        sentence: null,
      },
      {
        type: "vocab-cloze",
        word: { word_text: "la réunion", meaning: "회의", furigana: "[ʁeynjɔ̃]" },
        options: null,
        sentence: { main: "Elle prépare la réunion de demain.", pron: "[ɛl pʁepaʁ la ʁeynjɔ̃ də dəmɛ̃]" },
      },
      {
        type: "vocab-typing",
        word: { word_text: "le chômage", meaning: "실업", furigana: "[ʃomaʒ]" },
        options: null,
        sentence: null,
      },
    ],
  },

  // DRAFT — vocab/b1_flelex.js 대표 3문항.
  "b1_flelex.js": {
    source: "vocab/b1_flelex.js",
    items: [
      {
        type: "vocab-choice",
        word: { word_text: "le crime", meaning: "범죄, 중범죄", furigana: "[kʁim]" },
        options: ["범죄, 중범죄", "지지, 도움", "참여", "금지"],
        sentence: null,
      },
      {
        type: "vocab-cloze",
        word: { word_text: "le soutien", meaning: "지지, 후원, 도움", furigana: "[sutjɛ̃]" },
        options: null,
        sentence: { main: "Nous comptons sur le soutien de nos proches.", pron: "[nu kɔ̃tɔ̃ syʁ lə sutjɛ̃ də no pʁɔʃ]" },
      },
      {
        type: "vocab-typing",
        word: { word_text: "l'interdiction (f.)", meaning: "금지", furigana: "[ɛ̃tɛʁdiksjɔ̃]" },
        options: null,
        sentence: null,
      },
    ],
  },

  // DRAFT — vocab/b1_flelex2.js 대표 3문항.
  "b1_flelex2.js": {
    source: "vocab/b1_flelex2.js",
    items: [
      {
        type: "vocab-choice",
        word: { word_text: "l'alerte (f.)", meaning: "경보, 경고", furigana: "[alɛʁt]" },
        options: ["경보, 경고", "돈 (속어)", "풀, 접착제", "바이러스"],
        sentence: null,
      },
      {
        type: "vocab-cloze",
        word: { word_text: "le virus", meaning: "바이러스", furigana: "[viʁys]" },
        options: null,
        sentence: { main: "L'antivirus a bloqué le virus.", pron: "[lɑ̃tiviʁys a blɔke lə viʁys]" },
      },
      {
        type: "vocab-typing",
        word: { word_text: "le fric", meaning: "돈 (속어)", furigana: "[fʁik]" },
        options: null,
        sentence: null,
      },
    ],
  },

  // DRAFT — vocab/b2.js 대표 3문항.
  "b2.js": {
    source: "vocab/b2.js",
    items: [
      {
        type: "vocab-choice",
        word: { word_text: "le pouvoir", meaning: "권력, 힘", furigana: "[puvwaʁ]" },
        options: ["권력, 힘", "법, 법률", "선거", "경제 성장"],
        sentence: null,
      },
      {
        type: "vocab-cloze",
        word: { word_text: "la croissance", meaning: "(경제) 성장", furigana: "[kʁwasɑ̃s]" },
        options: null,
        sentence: { main: "Les chiffres confirment la croissance économique.", pron: "[le ʃifʁ kɔ̃fiʁm la kʁwasɑ̃s ekonomik]" },
      },
      {
        type: "vocab-typing",
        word: { word_text: "l'impôt (m.)", meaning: "세금", furigana: "[ɛ̃po]" },
        options: null,
        sentence: null,
      },
    ],
  },

  // DRAFT — vocab/b2_flelex.js 대표 3문항.
  "b2_flelex.js": {
    source: "vocab/b2_flelex.js",
    items: [
      {
        type: "vocab-choice",
        word: { word_text: "la minorité", meaning: "소수, 소수자", furigana: "[minɔʁite]" },
        options: ["소수, 소수자", "차별", "안전, 보안", "공개 협의"],
        sentence: null,
      },
      {
        type: "vocab-cloze",
        word: { word_text: "la discrimination", meaning: "차별", furigana: "[diskʁiminasjɔ̃]" },
        options: null,
        sentence: { main: "La loi interdit la discrimination à l'embauche.", pron: "[la lwa ɛ̃tɛʁdi la diskʁiminasjɔ̃ a lɑ̃boʃ]" },
      },
      {
        type: "vocab-typing",
        word: { word_text: "la sûreté", meaning: "안전, 보안", furigana: "[syʁte]" },
        options: null,
        sentence: null,
      },
    ],
  },

  // DRAFT — vocab/b2_flelex2.js 대표 3문항.
  "b2_flelex2.js": {
    source: "vocab/b2_flelex2.js",
    items: [
      {
        type: "vocab-choice",
        word: { word_text: "l'asile (m.)", meaning: "망명, 피난처", furigana: "[azil]" },
        options: ["망명, 피난처", "구금, 소지", "특파원, 사절", "일본인, 일본어"],
        sentence: null,
      },
      {
        type: "vocab-cloze",
        word: { word_text: "le japonais", meaning: "일본인, 일본어", furigana: "[ʒapɔnɛ]" },
        options: null,
        sentence: { main: "Elle apprend le japonais depuis deux ans.", pron: "[ɛl apʁɑ̃ lə ʒapɔnɛ dəpɥi døzɑ̃]" },
      },
      {
        type: "vocab-typing",
        word: { word_text: "la détention", meaning: "구금, 소지", furigana: "[detɑ̃sjɔ̃]" },
        options: null,
        sentence: null,
      },
    ],
  },

  // DRAFT — vocab/c1.js 대표 3문항.
  "c1.js": {
    source: "vocab/c1.js",
    items: [
      {
        type: "vocab-choice",
        word: { word_text: "l'enjeu (m.)", meaning: "쟁점, 관건", furigana: "[ɑ̃ʒø]" },
        options: ["쟁점, 관건", "파급력", "진단", "문제의식"],
        sentence: null,
      },
      {
        type: "vocab-cloze",
        word: { word_text: "la problématique", meaning: "문제의식, 논제", furigana: "[pʁɔblematik]" },
        options: null,
        sentence: { main: "Le rapport expose la problématique centrale.", pron: "[lə ʁapɔʁ ɛkspoz la pʁɔblematik sɑ̃tʁal]" },
      },
      {
        type: "vocab-typing",
        word: { word_text: "la portée", meaning: "범위, 파급력", furigana: "[pɔʁte]" },
        options: null,
        sentence: null,
      },
    ],
  },

  // DRAFT — vocab/c1_flelex.js 대표 3문항.
  "c1_flelex.js": {
    source: "vocab/c1_flelex.js",
    items: [
      {
        type: "vocab-choice",
        word: { word_text: "la molécule", meaning: "분자", furigana: "[mɔlekyl]" },
        options: ["분자", "종합, 통합", "내벽", "항생제"],
        sentence: null,
      },
      {
        type: "vocab-cloze",
        word: { word_text: "la synthèse", meaning: "종합, 통합", furigana: "[sɛ̃tɛz]" },
        options: null,
        sentence: { main: "Il présente la synthèse des résultats.", pron: "[il pʁezɑ̃t la sɛ̃tɛz de ʁezylta]" },
      },
      {
        type: "vocab-typing",
        word: { word_text: "l'antibiotique (m.)", meaning: "항생제", furigana: "[ɑ̃tibjɔtik]" },
        options: null,
        sentence: null,
      },
    ],
  },

  // DRAFT — vocab/c2.js 대표 3문항.
  "c2.js": {
    source: "vocab/c2.js",
    items: [
      {
        type: "vocab-choice",
        word: { word_text: "l'éloquence (f.)", meaning: "웅변, 능변", furigana: "[elɔkɑ̃s]" },
        options: ["웅변, 능변", "입담", "과장된 어조", "완서법"],
        sentence: null,
      },
      {
        type: "vocab-cloze",
        word: { word_text: "la litote", meaning: "완서법", furigana: "[litɔt]" },
        options: null,
        sentence: { main: "Cette phrase illustre la litote.", pron: "[sɛt fʁaz ilystʁ la litɔt]" },
      },
      {
        type: "vocab-typing",
        word: { word_text: "la verve", meaning: "생기, 입담", furigana: "[vɛʁv]" },
        options: null,
        sentence: null,
      },
    ],
  },

  // DRAFT — vocab/c2_flelex.js 대표 3문항.
  "c2_flelex.js": {
    source: "vocab/c2_flelex.js",
    items: [
      {
        type: "vocab-choice",
        word: { word_text: "le prolongement", meaning: "연장, 연속, 연장선", furigana: "[pʁɔlɔ̃ʒmɑ̃]" },
        options: ["연장, 연속, 연장선", "청취자", "좌식 생활", "낙관주의"],
        sentence: null,
      },
      {
        type: "vocab-cloze",
        word: { word_text: "la sédentarité", meaning: "정주성, 좌식 생활", furigana: "[sedɑ̃taʁite]" },
        options: null,
        sentence: { main: "Cette étude mesure la sédentarité au travail.", pron: "[sɛt etyd məzyʁ la sedɑ̃taʁite o tʁavaj]" },
      },
      {
        type: "vocab-typing",
        word: { word_text: "l'optimisme (m.)", meaning: "낙관주의, 낙천", furigana: "[ɔptimism]" },
        options: null,
        sentence: null,
      },
    ],
  },
};

const exercisesDraft = { grammar, vocab };

export default exercisesDraft;
