/**
 * A1 보강 어휘 — FLELex(루뱅대 CEFR 등급 어휘 자원) 기반.
 * 빈도 상위 어휘를 한국어 학습 사전 형식으로 보강. index.js의 mergeFrVocab가 본편과 병합.
 */
const themes = [
  {
    "name": "사람과 일상",
    "icon": "👥",
    "words": [
      {
        "fr": "le nom",
        "ipa": "[nɔ̃]",
        "ko": "이름, 성(姓)",
        "pos": "n.m.",
        "en": "name",
        "ex": {
          "fr": "Quel est ton nom ?",
          "ko": "네 이름이 뭐야?"
        }
      },
      {
        "fr": "l'exemple (m.)",
        "ipa": "[ɛɡzɑ̃pl]",
        "ko": "예, 보기, 본보기",
        "pos": "n.m.",
        "en": "example",
        "ex": {
          "fr": "Par exemple, le pain.",
          "ko": "예를 들면, 빵이요."
        }
      },
      {
        "fr": "l'effet (m.)",
        "ipa": "[efɛ]",
        "ko": "효과, 영향, 결과",
        "pos": "n.m.",
        "en": "effect",
        "ex": {
          "fr": "Le café a fait son effet.",
          "ko": "커피가 효과가 있었어요."
        }
      },
      {
        "fr": "la voix",
        "ipa": "[vwa]",
        "ko": "목소리, (선거의) 표",
        "pos": "n.f.",
        "en": "voice",
        "ex": {
          "fr": "Elle a une belle voix.",
          "ko": "그녀는 목소리가 예뻐요."
        }
      },
      {
        "fr": "le mot",
        "ipa": "[mo]",
        "ko": "단어, 말, 짧은 메모",
        "pos": "n.m.",
        "ex": {
          "fr": "Je ne connais pas ce mot.",
          "ko": "이 단어는 몰라요."
        }
      },
      {
        "fr": "la raison",
        "ipa": "[ʁɛzɔ̃]",
        "ko": "이유, 까닭, 이성 (avoir raison: 옳다)",
        "pos": "n.f.",
        "en": "reason",
        "ex": {
          "fr": "Tu as raison.",
          "ko": "네 말이 맞아."
        }
      },
      {
        "fr": "le besoin",
        "ipa": "[bəzwɛ̃]",
        "ko": "필요, 욕구 (avoir besoin de: ~이 필요하다)",
        "pos": "n.m.",
        "ex": {
          "fr": "J'ai besoin de repos.",
          "ko": "나는 휴식이 필요해요."
        }
      },
      {
        "fr": "l'étude (f.)",
        "ipa": "[etyd]",
        "ko": "공부, 연구, (-s) 학업",
        "pos": "n.f.",
        "en": "study",
        "ex": {
          "fr": "Elle aime l'étude des langues.",
          "ko": "그녀는 언어 공부를 좋아해요."
        }
      },
      {
        "fr": "l'affaire (f.)",
        "ipa": "[afɛʁ]",
        "ko": "일, 사건, (-s) 사업·물건",
        "pos": "n.f.",
        "en": "affair",
        "etym": "à faire(할 일)에서 왔어요. 영어 affair와 달리 '사업·사건'도 뜻해요.",
        "ex": {
          "fr": "C'est une affaire sérieuse.",
          "ko": "이건 심각한 일이에요."
        }
      },
      {
        "fr": "la mort",
        "ipa": "[mɔʁ]",
        "ko": "죽음",
        "pos": "n.f.",
        "ex": {
          "fr": "Il a peur de la mort.",
          "ko": "그는 죽음을 두려워해요."
        }
      },
      {
        "fr": "le roi",
        "ipa": "[ʁwa]",
        "ko": "왕",
        "pos": "n.m.",
        "etym": "라틴어 rex(왕)에서 — 영어 royal, regal과 같은 뿌리예요.",
        "ex": {
          "fr": "Le roi habite au château.",
          "ko": "왕은 성에 살아요."
        }
      },
      {
        "fr": "le cas",
        "ipa": "[kɑ]",
        "ko": "경우, 사례 (en tout cas: 어쨌든)",
        "pos": "n.m.",
        "en": "case",
        "ex": {
          "fr": "Dans ce cas, on attend.",
          "ko": "그런 경우엔 기다리죠."
        }
      },
      {
        "fr": "le garçon",
        "ipa": "[ɡaʁsɔ̃]",
        "ko": "소년, 남자아이",
        "pos": "n.m.",
        "ex": {
          "fr": "Ce garçon est très poli.",
          "ko": "그 남자아이는 아주 예의 발라요."
        }
      },
      {
        "fr": "l'âge (m.)",
        "ipa": "[ɑʒ]",
        "ko": "나이, 연령",
        "pos": "n.m.",
        "en": "age",
        "ex": {
          "fr": "Quel âge as-tu ?",
          "ko": "너 몇 살이야?"
        }
      },
      {
        "fr": "la suite",
        "ipa": "[sɥit]",
        "ko": "다음, 계속, 속편 (tout de suite: 곧바로)",
        "pos": "n.f.",
        "ex": {
          "fr": "Je reviens tout de suite.",
          "ko": "금방 돌아올게요."
        }
      },
      {
        "fr": "le visage",
        "ipa": "[vizaʒ]",
        "ko": "얼굴",
        "pos": "n.m.",
        "etym": "라틴어 visus(봄)에서 — 영어 visage, vision과 같은 뿌리예요.",
        "ex": {
          "fr": "Elle a un beau visage.",
          "ko": "그녀는 얼굴이 예뻐요."
        }
      },
      {
        "fr": "la façon",
        "ipa": "[fasɔ̃]",
        "ko": "방식, 방법 (de toute façon: 어쨌든)",
        "pos": "n.f.",
        "ex": {
          "fr": "J'aime ta façon de parler.",
          "ko": "나는 네 말투가 좋아."
        }
      },
      {
        "fr": "la grâce",
        "ipa": "[ɡʁɑs]",
        "ko": "우아함, 은혜 (grâce à: ~ 덕분에)",
        "pos": "n.f.",
        "en": "grace",
        "ex": {
          "fr": "Grâce à toi, j'ai réussi.",
          "ko": "네 덕분에 성공했어."
        }
      },
      {
        "fr": "l'habitude (f.)",
        "ipa": "[abityd]",
        "ko": "습관, 버릇 (avoir l'habitude de: ~에 익숙하다)",
        "pos": "n.f.",
        "en": "habit",
        "ex": {
          "fr": "J'ai l'habitude de marcher le matin.",
          "ko": "나는 아침에 걷는 습관이 있어요."
        }
      },
      {
        "fr": "le cheval",
        "ipa": "[ʃəval]",
        "ko": "말 (동물) (복수 chevaux)",
        "pos": "n.m.",
        "etym": "라틴어 caballus에서 — 영어 cavalry, chivalry와 같은 뿌리예요.",
        "ex": {
          "fr": "Elle monte à cheval.",
          "ko": "그녀는 말을 타요."
        }
      },
      {
        "fr": "les vacances",
        "ipa": "[vakɑ̃s]",
        "ko": "방학, 휴가 (보통 복수)",
        "pos": "n.f.pl.",
        "en": "vacation",
        "ex": {
          "fr": "Les vacances commencent demain.",
          "ko": "내일부터 방학이에요."
        }
      },
      {
        "fr": "l'envie (f.)",
        "ipa": "[ɑ̃vi]",
        "ko": "하고 싶음, 욕구 (avoir envie de: ~하고 싶다)",
        "pos": "n.f.",
        "ex": {
          "fr": "J'ai envie d'un café.",
          "ko": "커피 한 잔 마시고 싶어요."
        }
      },
      {
        "fr": "la face",
        "ipa": "[fas]",
        "ko": "면, 쪽, 얼굴 (en face de: ~ 맞은편에)",
        "pos": "n.f.",
        "en": "face",
        "etym": "영어 face와 같은 뿌리지만 '얼굴'은 보통 visage를 써요. face는 '면·맞은편' 쪽이에요.",
        "ex": {
          "fr": "La banque est en face.",
          "ko": "은행은 맞은편에 있어요."
        }
      },
      {
        "fr": "la demande",
        "ipa": "[dəmɑ̃d]",
        "ko": "요청, 신청, 수요",
        "pos": "n.f.",
        "en": "demand",
        "etym": "영어 demand는 '강하게 요구하다'지만 프랑스어 demander는 그냥 '묻다·부탁하다'예요. 함정 주의.",
        "ex": {
          "fr": "Il a fait une demande de visa.",
          "ko": "그는 비자를 신청했어요."
        }
      },
      {
        "fr": "l'attention (f.)",
        "ipa": "[atɑ̃sjɔ̃]",
        "ko": "주의, 관심 (Attention !: 조심해!)",
        "pos": "n.f.",
        "en": "attention",
        "ex": {
          "fr": "Fais attention à la marche.",
          "ko": "계단 조심해요."
        }
      },
      {
        "fr": "l'information (f.)",
        "ipa": "[ɛ̃fɔʁmasjɔ̃]",
        "ko": "정보, (-s) 뉴스",
        "pos": "n.f.",
        "en": "information",
        "ex": {
          "fr": "J'ai besoin d'une information.",
          "ko": "정보가 하나 필요해요."
        }
      },
      {
        "fr": "le bras",
        "ipa": "[bʁɑ]",
        "ko": "팔",
        "pos": "n.m.",
        "etym": "라틴어 brachium에서 — 영어 brace, bracelet과 같은 뿌리예요.",
        "ex": {
          "fr": "Il a mal au bras.",
          "ko": "그는 팔이 아파요."
        }
      },
      {
        "fr": "l'origine (f.)",
        "ipa": "[ɔʁiʒin]",
        "ko": "기원, 출신, 유래 (à l'origine: 본래)",
        "pos": "n.f.",
        "en": "origin",
        "ex": {
          "fr": "Il est d'origine coréenne.",
          "ko": "그는 한국계예요."
        }
      },
      {
        "fr": "le début",
        "ipa": "[deby]",
        "ko": "시작, 초반 (au début: 처음에)",
        "pos": "n.m.",
        "ex": {
          "fr": "Au début, c'était difficile.",
          "ko": "처음엔 힘들었어요."
        }
      },
      {
        "fr": "le plaisir",
        "ipa": "[plɛziʁ]",
        "ko": "즐거움, 기쁨 (avec plaisir: 기꺼이)",
        "pos": "n.m.",
        "en": "pleasure",
        "ex": {
          "fr": "C'est un plaisir de te voir.",
          "ko": "너를 보니 반가워."
        }
      },
      {
        "fr": "l'après-midi (m.)",
        "ipa": "[apʁɛmidi]",
        "ko": "오후",
        "pos": "n.m.",
        "ex": {
          "fr": "On se voit cet après-midi ?",
          "ko": "오늘 오후에 볼까요?"
        }
      },
      {
        "fr": "la peine",
        "ipa": "[pɛn]",
        "ko": "슬픔, 수고 (à peine: 겨우)",
        "pos": "n.f.",
        "ex": {
          "fr": "Ça vaut la peine d'essayer.",
          "ko": "그건 해 볼 만해요."
        }
      },
      {
        "fr": "le client",
        "ipa": "[klijɑ̃]",
        "ko": "손님, 고객",
        "pos": "n.m.",
        "en": "client",
        "ex": {
          "fr": "Le client attend à la caisse.",
          "ko": "손님이 계산대에서 기다려요."
        }
      },
      {
        "fr": "le doute",
        "ipa": "[dut]",
        "ko": "의심, 의혹",
        "pos": "n.m.",
        "en": "doubt",
        "etym": "라틴어 dubitare에서 — 영어 doubt와 같은 뿌리예요.",
        "ex": {
          "fr": "Sans doute, tu as raison.",
          "ko": "아마 네 말이 맞을 거예요."
        }
      },
      {
        "fr": "le retour",
        "ipa": "[ʁətuʁ]",
        "ko": "돌아옴, 귀가, 반환",
        "pos": "n.m.",
        "en": "return",
        "ex": {
          "fr": "Bon retour à la maison !",
          "ko": "집에 잘 돌아가요!"
        }
      },
      {
        "fr": "la chance",
        "ipa": "[ʃɑ̃s]",
        "ko": "운, 행운, 기회",
        "pos": "n.f.",
        "en": "chance",
        "etym": "영어 chance와 닮았지만 보통 '운, 행운'을 뜻해요. 함정 주의.",
        "ex": {
          "fr": "Tu as de la chance !",
          "ko": "너 운이 좋네!"
        }
      },
      {
        "fr": "le journaliste",
        "ipa": "[ʒuʁnalist]",
        "ko": "기자 (여성형 la journaliste)",
        "pos": "n.m.",
        "en": "journalist",
        "ex": {
          "fr": "Le journaliste pose une question.",
          "ko": "기자가 질문을 해요."
        }
      },
      {
        "fr": "l'habitant (m.)",
        "ipa": "[abitɑ̃]",
        "ko": "주민, 거주자",
        "pos": "n.m.",
        "en": "inhabitant",
        "ex": {
          "fr": "Cette ville a un million d'habitants.",
          "ko": "이 도시는 주민이 백만 명이에요."
        }
      },
      {
        "fr": "la classe",
        "ipa": "[klas]",
        "ko": "학급, 교실, 등급",
        "pos": "n.f.",
        "en": "class",
        "ex": {
          "fr": "Il y a vingt élèves dans la classe.",
          "ko": "교실에 학생이 스무 명 있어요."
        }
      },
      {
        "fr": "le regard",
        "ipa": "[ʁəɡaʁ]",
        "ko": "시선, 눈길",
        "pos": "n.m.",
        "ex": {
          "fr": "Son regard est doux.",
          "ko": "그의 눈길이 부드러워요."
        }
      },
      {
        "fr": "la reine",
        "ipa": "[ʁɛn]",
        "ko": "여왕",
        "pos": "n.f.",
        "ex": {
          "fr": "La reine habite dans un château.",
          "ko": "여왕은 성에 살아요."
        }
      },
      {
        "fr": "l'instant (m.)",
        "ipa": "[ɛ̃stɑ̃]",
        "ko": "순간, 잠깐",
        "pos": "n.m.",
        "en": "instant",
        "ex": {
          "fr": "Attends un instant, s'il te plaît.",
          "ko": "잠깐만 기다려 줘요."
        }
      },
      {
        "fr": "la manière",
        "ipa": "[manjɛʁ]",
        "ko": "방식, 방법",
        "pos": "n.f.",
        "en": "manner",
        "ex": {
          "fr": "Il parle d'une manière calme.",
          "ko": "그는 차분한 방식으로 말해요."
        }
      },
      {
        "fr": "l'auteur (m.)",
        "ipa": "[otœʁ]",
        "ko": "저자, 작가",
        "pos": "n.m.",
        "en": "author",
        "ex": {
          "fr": "Qui est l'auteur de ce livre ?",
          "ko": "이 책의 저자는 누구예요?"
        }
      },
      {
        "fr": "le dieu",
        "ipa": "[djø]",
        "ko": "신 (복수 dieux)",
        "pos": "n.m.",
        "ex": {
          "fr": "Les Grecs avaient beaucoup de dieux.",
          "ko": "그리스인들은 신이 많았어요."
        }
      },
      {
        "fr": "la guerre",
        "ipa": "[ɡɛʁ]",
        "ko": "전쟁",
        "pos": "n.f.",
        "ex": {
          "fr": "La guerre a duré quatre ans.",
          "ko": "전쟁은 4년 동안 계속됐어요."
        }
      },
      {
        "fr": "le personnage",
        "ipa": "[pɛʁsɔnaʒ]",
        "ko": "(이야기 속) 인물, 캐릭터",
        "pos": "n.m.",
        "en": "personage",
        "etym": "영어 person과 닮았지만 보통 소설·영화 속 '등장인물'을 뜻해요.",
        "ex": {
          "fr": "Ce personnage est très drôle.",
          "ko": "이 등장인물은 아주 웃겨요."
        }
      },
      {
        "fr": "la qualité",
        "ipa": "[kalite]",
        "ko": "질, 품질, 장점",
        "pos": "n.f.",
        "en": "quality",
        "ex": {
          "fr": "Ce produit est de bonne qualité.",
          "ko": "이 제품은 품질이 좋아요."
        }
      },
      {
        "fr": "la course",
        "ipa": "[kuʁs]",
        "ko": "달리기, 경주 (faire les courses: 장보기)",
        "pos": "n.f.",
        "ex": {
          "fr": "Je fais les courses au marché.",
          "ko": "저는 시장에서 장을 봐요."
        }
      },
      {
        "fr": "le programme",
        "ipa": "[pʁɔɡʁam]",
        "ko": "프로그램, 계획, 일정",
        "pos": "n.m.",
        "en": "program",
        "ex": {
          "fr": "Quel est le programme de la journée ?",
          "ko": "오늘 일정이 어떻게 되나요?"
        }
      },
      {
        "fr": "le cri",
        "ipa": "[kʁi]",
        "ko": "외침, 비명",
        "pos": "n.m.",
        "ex": {
          "fr": "J'ai entendu un cri dehors.",
          "ko": "밖에서 비명 소리를 들었어요."
        }
      },
      {
        "fr": "l'été (m.)",
        "ipa": "[ete]",
        "ko": "여름",
        "pos": "n.m.",
        "ex": {
          "fr": "En été, il fait très chaud.",
          "ko": "여름에는 아주 더워요."
        }
      },
      {
        "fr": "l'élève (m.)",
        "ipa": "[elɛv]",
        "ko": "학생 (초·중등) (남녀 동형: l'élève / une élève)",
        "pos": "n.m.",
        "ex": {
          "fr": "Cet élève travaille bien.",
          "ko": "이 학생은 공부를 잘해요."
        }
      },
      {
        "fr": "la population",
        "ipa": "[pɔpylasjɔ̃]",
        "ko": "인구, 주민",
        "pos": "n.f.",
        "en": "population",
        "ex": {
          "fr": "La population de cette ville augmente.",
          "ko": "이 도시의 인구가 늘어나요."
        }
      },
      {
        "fr": "la valeur",
        "ipa": "[valœʁ]",
        "ko": "가치, 값어치",
        "pos": "n.f.",
        "en": "value",
        "ex": {
          "fr": "Ce tableau a une grande valeur.",
          "ko": "이 그림은 가치가 아주 커요."
        }
      },
      {
        "fr": "le directeur",
        "ipa": "[diʁɛktœʁ]",
        "ko": "(기관·회사의) 책임자, 교장, 부장 (여성형 directrice)",
        "pos": "n.m.",
        "en": "director",
        "ex": {
          "fr": "Le directeur de l'école est gentil.",
          "ko": "학교 교장 선생님은 친절해요."
        }
      },
      {
        "fr": "la visite",
        "ipa": "[vizit]",
        "ko": "방문, 견학, 진찰",
        "pos": "n.f.",
        "en": "visit",
        "ex": {
          "fr": "On fait la visite du musée.",
          "ko": "우리는 박물관을 견학해요."
        }
      },
      {
        "fr": "le maître",
        "ipa": "[mɛtʁ]",
        "ko": "주인, 선생님, 거장 (여성형 maîtresse)",
        "pos": "n.m.",
        "en": "master",
        "etym": "라틴어 magister에서 — 영어 master와 같은 뿌리예요.",
        "ex": {
          "fr": "Le chien suit son maître.",
          "ko": "개가 주인을 따라가요."
        }
      },
      {
        "fr": "le commissaire",
        "ipa": "[kɔmisɛʁ]",
        "ko": "(경찰) 서장, 위원",
        "pos": "n.m.",
        "en": "commissioner",
        "ex": {
          "fr": "Le commissaire mène l'enquête.",
          "ko": "경찰서장이 수사를 이끌어요."
        }
      },
      {
        "fr": "la colère",
        "ipa": "[kɔlɛʁ]",
        "ko": "화, 분노 (en colère: 화가 난)",
        "pos": "n.f.",
        "ex": {
          "fr": "Il est en colère contre moi.",
          "ko": "그는 나한테 화가 났어요."
        }
      },
      {
        "fr": "le rôle",
        "ipa": "[ʁol]",
        "ko": "역할, 배역",
        "pos": "n.m.",
        "en": "role",
        "ex": {
          "fr": "Elle joue un rôle important.",
          "ko": "그녀는 중요한 역할을 맡아요."
        }
      },
      {
        "fr": "le type",
        "ipa": "[tip]",
        "ko": "유형, 종류 / (구어) 남자, 녀석",
        "pos": "n.m.",
        "en": "type",
        "ex": {
          "fr": "C'est quel type de musique ?",
          "ko": "이건 어떤 종류의 음악이에요?"
        }
      },
      {
        "fr": "l'aide (f.)",
        "ipa": "[ɛd]",
        "ko": "도움, 지원",
        "pos": "n.f.",
        "en": "aid",
        "ex": {
          "fr": "J'ai besoin de ton aide.",
          "ko": "당신의 도움이 필요해요."
        }
      },
      {
        "fr": "le sujet",
        "ipa": "[syʒɛ]",
        "ko": "주제, 화제",
        "pos": "n.m.",
        "en": "subject",
        "ex": {
          "fr": "C'est un sujet intéressant.",
          "ko": "이건 흥미로운 주제예요."
        }
      },
      {
        "fr": "l'enquête (f.)",
        "ipa": "[ɑ̃kɛt]",
        "ko": "조사, 수사, 설문",
        "pos": "n.f.",
        "ex": {
          "fr": "La police ouvre une enquête.",
          "ko": "경찰이 수사를 시작해요."
        }
      },
      {
        "fr": "l'oreille (f.)",
        "ipa": "[ɔʁɛj]",
        "ko": "귀",
        "pos": "n.f.",
        "ex": {
          "fr": "J'ai mal à l'oreille.",
          "ko": "귀가 아파요."
        }
      },
      {
        "fr": "le sentiment",
        "ipa": "[sɑ̃timɑ̃]",
        "ko": "감정, 느낌",
        "pos": "n.m.",
        "en": "sentiment",
        "ex": {
          "fr": "C'est un sentiment agréable.",
          "ko": "이건 기분 좋은 느낌이에요."
        }
      },
      {
        "fr": "la moitié",
        "ipa": "[mwatje]",
        "ko": "절반, 반",
        "pos": "n.f.",
        "ex": {
          "fr": "J'ai mangé la moitié du gâteau.",
          "ko": "케이크의 절반을 먹었어요."
        }
      },
      {
        "fr": "la garde",
        "ipa": "[ɡaʁd]",
        "ko": "보호, 감시, 당번 (le garde: 경비원)",
        "pos": "n.f.",
        "ex": {
          "fr": "Elle a la garde des enfants.",
          "ko": "그녀가 아이들을 돌봐요."
        }
      }
    ]
  },
  {
    "name": "집·사물·음식",
    "icon": "🏠",
    "words": [
      {
        "fr": "la chose",
        "ipa": "[ʃoz]",
        "ko": "것, 물건, 일",
        "pos": "n.f.",
        "ex": {
          "fr": "J'ai une chose à te dire.",
          "ko": "너한테 할 말이 하나 있어."
        }
      },
      {
        "fr": "le coup",
        "ipa": "[ku]",
        "ko": "타격, 한 번 (행위), 충격",
        "pos": "n.m.",
        "ex": {
          "fr": "Il a frappé un grand coup.",
          "ko": "그는 세게 한 번 쳤어요."
        }
      },
      {
        "fr": "la pièce",
        "ipa": "[pjɛs]",
        "ko": "방, 한 개(낱개), 동전, (연극) 작품",
        "pos": "n.f.",
        "ex": {
          "fr": "L'appartement a trois pièces.",
          "ko": "그 집은 방이 세 개예요."
        }
      },
      {
        "fr": "le million",
        "ipa": "[miljɔ̃]",
        "ko": "백만",
        "pos": "n.m.",
        "en": "million",
        "ex": {
          "fr": "La ville a deux millions d'habitants.",
          "ko": "그 도시는 인구가 200만 명이에요."
        }
      },
      {
        "fr": "le jeu",
        "ipa": "[ʒø]",
        "ko": "놀이, 게임 (복수 jeux)",
        "pos": "n.m.",
        "ex": {
          "fr": "Les enfants aiment ce jeu.",
          "ko": "아이들이 이 게임을 좋아해요."
        }
      },
      {
        "fr": "la partie",
        "ipa": "[paʁti]",
        "ko": "부분, 일부, (경기의) 판",
        "pos": "n.f.",
        "en": "part",
        "ex": {
          "fr": "C'est la meilleure partie du film.",
          "ko": "거기가 영화에서 제일 좋은 부분이에요."
        }
      },
      {
        "fr": "le point",
        "ipa": "[pwɛ̃]",
        "ko": "점, 요점, 지점",
        "pos": "n.m.",
        "en": "point",
        "ex": {
          "fr": "C'est un point important.",
          "ko": "그건 중요한 점이에요."
        }
      },
      {
        "fr": "la couleur",
        "ipa": "[kulœʁ]",
        "ko": "색, 색깔",
        "pos": "n.f.",
        "en": "color",
        "ex": {
          "fr": "Quelle est ta couleur préférée ?",
          "ko": "제일 좋아하는 색이 뭐야?"
        }
      },
      {
        "fr": "l'ordre (m.)",
        "ipa": "[ɔʁdʁ]",
        "ko": "순서, 질서, 명령",
        "pos": "n.m.",
        "en": "order",
        "ex": {
          "fr": "Mets les livres en ordre.",
          "ko": "책들을 순서대로 정리해."
        }
      },
      {
        "fr": "l'animal (m.)",
        "ipa": "[animal]",
        "ko": "동물",
        "pos": "n.m.",
        "en": "animal",
        "etym": "라틴어 anima(숨, 생명)에서 — 영어 animal과 같은 뿌리예요. 복수는 animaux.",
        "ex": {
          "fr": "Le chien est mon animal préféré.",
          "ko": "개는 제가 제일 좋아하는 동물이에요."
        }
      },
      {
        "fr": "la photo",
        "ipa": "[fɔto]",
        "ko": "사진",
        "pos": "n.f.",
        "en": "photo",
        "ex": {
          "fr": "Je prends une photo de la mer.",
          "ko": "바다 사진을 찍어요."
        }
      },
      {
        "fr": "l'objet (m.)",
        "ipa": "[ɔbʒɛ]",
        "ko": "물건, 대상",
        "pos": "n.m.",
        "en": "object",
        "etym": "라틴어 objectum(앞에 놓인 것)에서 — 영어 object와 같은 뿌리예요.",
        "ex": {
          "fr": "Quel est cet objet sur la table ?",
          "ko": "탁자 위의 저 물건은 뭐예요?"
        }
      },
      {
        "fr": "le mode",
        "ipa": "[mɔd]",
        "ko": "방식, 방법 (la mode: 유행, 패션)",
        "pos": "n.m.",
        "en": "mode",
        "etym": "남성 le mode는 '방식', 여성 la mode는 '유행·패션'이에요. 성에 따라 뜻이 달라져요.",
        "ex": {
          "fr": "Quel est le mode d'emploi ?",
          "ko": "사용 방법이 뭐예요?"
        }
      },
      {
        "fr": "le produit",
        "ipa": "[pʁɔdɥi]",
        "ko": "제품, 상품",
        "pos": "n.m.",
        "en": "product",
        "ex": {
          "fr": "Ce produit est très bon.",
          "ko": "이 제품은 아주 좋아요."
        }
      },
      {
        "fr": "le fond",
        "ipa": "[fɔ̃]",
        "ko": "바닥, 안쪽, 본질",
        "pos": "n.m.",
        "ex": {
          "fr": "Le café est au fond de la rue.",
          "ko": "카페는 거리 안쪽에 있어요."
        }
      },
      {
        "fr": "l'art (m.)",
        "ipa": "[aʁ]",
        "ko": "예술, 미술",
        "pos": "n.m.",
        "en": "art",
        "ex": {
          "fr": "J'aime l'art moderne.",
          "ko": "저는 현대 미술을 좋아해요."
        }
      },
      {
        "fr": "l'image (f.)",
        "ipa": "[imaʒ]",
        "ko": "이미지, 그림, 영상",
        "pos": "n.f.",
        "en": "image",
        "ex": {
          "fr": "Cette image est très belle.",
          "ko": "이 그림은 아주 예뻐요."
        }
      },
      {
        "fr": "le mur",
        "ipa": "[myʁ]",
        "ko": "벽, 담",
        "pos": "n.m.",
        "ex": {
          "fr": "Il y a une photo sur le mur.",
          "ko": "벽에 사진이 한 장 있어요."
        }
      },
      {
        "fr": "traverser",
        "ipa": "[tʁavɛʁse]",
        "ko": "건너다, 가로지르다",
        "pos": "v.",
        "ex": {
          "fr": "Il faut traverser la rue ici.",
          "ko": "여기서 길을 건너야 해요."
        }
      },
      {
        "fr": "le bois",
        "ipa": "[bwa]",
        "ko": "나무(목재), 숲",
        "pos": "n.m.",
        "ex": {
          "fr": "Cette table est en bois.",
          "ko": "이 탁자는 나무로 되어 있어요."
        }
      },
      {
        "fr": "le mètre",
        "ipa": "[mɛtʁ]",
        "ko": "미터 (길이 단위)",
        "pos": "n.m.",
        "en": "meter",
        "etym": "발음이 같은 maître(주인·선생)와 혼동 주의. mètre는 길이 단위예요.",
        "ex": {
          "fr": "La table fait deux mètres.",
          "ko": "이 탁자는 2미터예요."
        }
      },
      {
        "fr": "le papier",
        "ipa": "[papje]",
        "ko": "종이, 서류",
        "pos": "n.m.",
        "en": "paper",
        "ex": {
          "fr": "Donne-moi une feuille de papier.",
          "ko": "종이 한 장 줘요."
        }
      }
    ]
  },
  {
    "name": "도시와 장소",
    "icon": "🏙️",
    "words": [
      {
        "fr": "la nuit",
        "ipa": "[nɥi]",
        "ko": "밤",
        "pos": "n.f.",
        "ex": {
          "fr": "Bonne nuit !",
          "ko": "잘 자요!"
        }
      },
      {
        "fr": "le côté",
        "ipa": "[kote]",
        "ko": "쪽, 측면, 옆",
        "pos": "n.m.",
        "ex": {
          "fr": "Assieds-toi à côté de moi.",
          "ko": "내 옆에 앉아."
        }
      },
      {
        "fr": "le lieu",
        "ipa": "[ljø]",
        "ko": "장소, 곳",
        "pos": "n.m.",
        "ex": {
          "fr": "C'est un lieu calme.",
          "ko": "여긴 조용한 곳이에요."
        }
      },
      {
        "fr": "la terre",
        "ipa": "[tɛʁ]",
        "ko": "땅, 흙, 지구 (la Terre)",
        "pos": "n.f.",
        "ex": {
          "fr": "Les enfants jouent dans la terre.",
          "ko": "아이들이 흙에서 놀아요."
        }
      },
      {
        "fr": "la salle",
        "ipa": "[sal]",
        "ko": "방, 홀, (큰) 실(室)",
        "pos": "n.f.",
        "ex": {
          "fr": "La salle est pleine.",
          "ko": "방이 꽉 찼어요."
        }
      },
      {
        "fr": "le milieu",
        "ipa": "[miljø]",
        "ko": "한가운데, 중간, 환경 (복수 milieux)",
        "pos": "n.m.",
        "ex": {
          "fr": "Le vase est au milieu de la table.",
          "ko": "꽃병이 탁자 한가운데 있어요."
        }
      },
      {
        "fr": "la police",
        "ipa": "[pɔlis]",
        "ko": "경찰",
        "pos": "n.f.",
        "en": "police",
        "ex": {
          "fr": "Appelle la police !",
          "ko": "경찰 불러!"
        }
      },
      {
        "fr": "la région",
        "ipa": "[ʁeʒjɔ̃]",
        "ko": "지방, 지역",
        "pos": "n.f.",
        "en": "region",
        "ex": {
          "fr": "J'habite dans cette région.",
          "ko": "저는 이 지역에 살아요."
        }
      },
      {
        "fr": "le château",
        "ipa": "[ʃɑto]",
        "ko": "성, 궁(宮) (복수 châteaux)",
        "pos": "n.m.",
        "en": "castle",
        "etym": "라틴어 castellum에서 — 영어 castle과 같은 뿌리예요.",
        "ex": {
          "fr": "On visite un vieux château.",
          "ko": "우리는 오래된 성을 둘러봐요."
        }
      },
      {
        "fr": "le bout",
        "ipa": "[bu]",
        "ko": "끝, 한 조각 (au bout de: ~ 끝에)",
        "pos": "n.m.",
        "ex": {
          "fr": "La poste est au bout de la rue.",
          "ko": "우체국은 길 끝에 있어요."
        }
      },
      {
        "fr": "l'endroit (m.)",
        "ipa": "[ɑ̃dʁwa]",
        "ko": "장소, 곳",
        "pos": "n.m.",
        "ex": {
          "fr": "C'est un endroit tranquille.",
          "ko": "여긴 조용한 곳이에요."
        }
      },
      {
        "fr": "le chemin",
        "ipa": "[ʃəmɛ̃]",
        "ko": "길, 경로",
        "pos": "n.m.",
        "ex": {
          "fr": "On a perdu le chemin.",
          "ko": "우리는 길을 잃었어요."
        }
      },
      {
        "fr": "l'association (f.)",
        "ipa": "[asɔsjasjɔ̃]",
        "ko": "단체, 협회, 연관",
        "pos": "n.f.",
        "en": "association",
        "ex": {
          "fr": "Elle travaille dans une association.",
          "ko": "그녀는 단체에서 일해요."
        }
      },
      {
        "fr": "le service",
        "ipa": "[sɛʁvis]",
        "ko": "서비스, 봉사, 부서",
        "pos": "n.m.",
        "en": "service",
        "ex": {
          "fr": "Le service est rapide ici.",
          "ko": "여기 서비스가 빨라요."
        }
      },
      {
        "fr": "le jardin",
        "ipa": "[ʒaʁdɛ̃]",
        "ko": "정원, 뜰",
        "pos": "n.m.",
        "en": "garden",
        "etym": "영어 garden과 같은 게르만 어원에서 왔어요.",
        "ex": {
          "fr": "Il y a des fleurs dans le jardin.",
          "ko": "정원에 꽃이 있어요."
        }
      },
      {
        "fr": "l'internet (m.)",
        "ipa": "[ɛ̃tɛʁnɛt]",
        "ko": "인터넷",
        "pos": "n.m.",
        "en": "internet",
        "ex": {
          "fr": "Je cherche l'adresse sur internet.",
          "ko": "인터넷에서 주소를 찾아요."
        }
      },
      {
        "fr": "le centre",
        "ipa": "[sɑ̃tʁ]",
        "ko": "중심, 센터, 시내",
        "pos": "n.m.",
        "en": "center",
        "ex": {
          "fr": "On va au centre-ville.",
          "ko": "우리는 시내 중심으로 가요."
        }
      },
      {
        "fr": "le site",
        "ipa": "[sit]",
        "ko": "장소, 부지 / (웹)사이트",
        "pos": "n.m.",
        "en": "site",
        "ex": {
          "fr": "Je consulte le site internet.",
          "ko": "저는 그 웹사이트를 봐요."
        }
      },
      {
        "fr": "le bord",
        "ipa": "[bɔʁ]",
        "ko": "가장자리, 가 (au bord de: ~의 가에)",
        "pos": "n.m.",
        "en": "board",
        "ex": {
          "fr": "On marche au bord de la mer.",
          "ko": "우리는 바닷가를 걸어요."
        }
      },
      {
        "fr": "la campagne",
        "ipa": "[kɑ̃paɲ]",
        "ko": "시골 / 캠페인, 운동",
        "pos": "n.f.",
        "en": "campaign",
        "etym": "영어 campaign과 닮았지만 보통 '시골'을 뜻해요. '캠페인' 뜻도 있어요.",
        "ex": {
          "fr": "On passe le week-end à la campagne.",
          "ko": "주말을 시골에서 보내요."
        }
      },
      {
        "fr": "le passage",
        "ipa": "[pasaʒ]",
        "ko": "통로, 통과, (글의) 구절",
        "pos": "n.m.",
        "en": "passage",
        "ex": {
          "fr": "Le passage est étroit.",
          "ko": "그 통로는 좁아요."
        }
      },
      {
        "fr": "l'état (m.)",
        "ipa": "[eta]",
        "ko": "상태 / (대문자 État) 국가",
        "pos": "n.m.",
        "en": "state",
        "ex": {
          "fr": "La voiture est en bon état.",
          "ko": "그 차는 상태가 좋아요."
        }
      },
      {
        "fr": "l'espace (m.)",
        "ipa": "[ɛspas]",
        "ko": "공간, 우주",
        "pos": "n.m.",
        "en": "space",
        "ex": {
          "fr": "Il y a beaucoup d'espace ici.",
          "ko": "여기는 공간이 넓어요."
        }
      },
      {
        "fr": "l'intérieur (m.)",
        "ipa": "[ɛ̃teʁjœʁ]",
        "ko": "내부, 안 (à l'intérieur: 안에)",
        "pos": "n.m.",
        "en": "interior",
        "ex": {
          "fr": "On reste à l'intérieur quand il pleut.",
          "ko": "비가 오면 안에 있어요."
        }
      },
      {
        "fr": "la prison",
        "ipa": "[pʁizɔ̃]",
        "ko": "감옥, 교도소",
        "pos": "n.f.",
        "en": "prison",
        "ex": {
          "fr": "Le voleur est en prison.",
          "ko": "그 도둑은 감옥에 있어요."
        }
      }
    ]
  },
  {
    "name": "자주 쓰는 동사",
    "icon": "🏃",
    "words": [
      {
        "fr": "mettre",
        "ipa": "[mɛtʁ]",
        "ko": "놓다, 넣다, (옷을) 입다",
        "pos": "v.",
        "ex": {
          "fr": "Je mets le livre sur la table.",
          "ko": "책을 탁자 위에 놓아요."
        }
      },
      {
        "fr": "entendre",
        "ipa": "[ɑ̃tɑ̃dʁ]",
        "ko": "듣다, 들리다",
        "pos": "v.",
        "en": "to hear",
        "ex": {
          "fr": "Tu entends ce bruit ?",
          "ko": "이 소리 들려?"
        }
      },
      {
        "fr": "permettre",
        "ipa": "[pɛʁmɛtʁ]",
        "ko": "허락하다, 가능하게 하다",
        "pos": "v.",
        "en": "to permit",
        "ex": {
          "fr": "Permettez-moi d'entrer.",
          "ko": "들어가도 될까요."
        }
      },
      {
        "fr": "rendre",
        "ipa": "[ʁɑ̃dʁ]",
        "ko": "돌려주다, (어떤 상태로) 만들다",
        "pos": "v.",
        "ex": {
          "fr": "Je te rends ton livre.",
          "ko": "네 책 돌려줄게."
        }
      },
      {
        "fr": "tenir",
        "ipa": "[təniʁ]",
        "ko": "잡다, 쥐다, 유지하다",
        "pos": "v.",
        "ex": {
          "fr": "Tiens ma main.",
          "ko": "내 손 잡아."
        }
      },
      {
        "fr": "montrer",
        "ipa": "[mɔ̃tʁe]",
        "ko": "보여주다, 가리키다",
        "pos": "v.",
        "ex": {
          "fr": "Montre-moi ta photo.",
          "ko": "네 사진 보여줘."
        }
      },
      {
        "fr": "tomber",
        "ipa": "[tɔ̃be]",
        "ko": "넘어지다, 떨어지다",
        "pos": "v.",
        "ex": {
          "fr": "Attention, tu vas tomber !",
          "ko": "조심해, 넘어지겠다!"
        }
      },
      {
        "fr": "sentir",
        "ipa": "[sɑ̃tiʁ]",
        "ko": "느끼다, (냄새를) 맡다, 냄새가 나다",
        "pos": "v.",
        "ex": {
          "fr": "Ça sent bon !",
          "ko": "냄새 좋다!"
        }
      },
      {
        "fr": "crier",
        "ipa": "[kʁije]",
        "ko": "소리치다, 외치다",
        "pos": "v.",
        "en": "to cry",
        "etym": "영어 cry와 닮았지만 '울다'가 아니라 '소리치다'예요. 함정 주의.",
        "ex": {
          "fr": "Ne crie pas si fort !",
          "ko": "그렇게 크게 소리치지 마!"
        }
      },
      {
        "fr": "découvrir",
        "ipa": "[dekuvʁiʁ]",
        "ko": "발견하다, 알게 되다",
        "pos": "v.",
        "en": "to discover",
        "ex": {
          "fr": "J'ai découvert un bon café.",
          "ko": "괜찮은 카페를 발견했어요."
        }
      },
      {
        "fr": "créer",
        "ipa": "[kʁee]",
        "ko": "만들다, 창조하다",
        "pos": "v.",
        "en": "to create",
        "ex": {
          "fr": "Il a créé sa propre entreprise.",
          "ko": "그는 자기 회사를 만들었어요."
        }
      },
      {
        "fr": "proposer",
        "ipa": "[pʁɔpoze]",
        "ko": "제안하다, 권하다",
        "pos": "v.",
        "en": "to propose",
        "ex": {
          "fr": "Je te propose un café.",
          "ko": "커피 한 잔 어때?"
        }
      },
      {
        "fr": "occuper",
        "ipa": "[ɔkype]",
        "ko": "차지하다, (s'occuper de) ~을 돌보다·맡다",
        "pos": "v.",
        "en": "to occupy",
        "ex": {
          "fr": "Je m'occupe des enfants.",
          "ko": "내가 아이들을 돌볼게요."
        }
      },
      {
        "fr": "choisir",
        "ipa": "[ʃwaziʁ]",
        "ko": "고르다, 선택하다",
        "pos": "v.",
        "ex": {
          "fr": "Choisis ce que tu veux.",
          "ko": "원하는 걸 골라."
        }
      },
      {
        "fr": "monter",
        "ipa": "[mɔ̃te]",
        "ko": "올라가다, (물건을) 올리다, 타다",
        "pos": "v.",
        "en": "to mount",
        "ex": {
          "fr": "On monte au troisième étage.",
          "ko": "우리는 4층으로 올라가요."
        }
      },
      {
        "fr": "reconnaître",
        "ipa": "[ʁəkɔnɛtʁ]",
        "ko": "알아보다, 인정하다",
        "pos": "v.",
        "en": "to recognize",
        "ex": {
          "fr": "Je ne t'ai pas reconnu !",
          "ko": "너 못 알아봤어!"
        }
      },
      {
        "fr": "tuer",
        "ipa": "[tɥe]",
        "ko": "죽이다",
        "pos": "v.",
        "ex": {
          "fr": "Le chat a tué une souris.",
          "ko": "고양이가 쥐를 죽였어요."
        }
      },
      {
        "fr": "tourner",
        "ipa": "[tuʁne]",
        "ko": "돌다, 돌리다, 방향을 틀다",
        "pos": "v.",
        "en": "to turn",
        "ex": {
          "fr": "Tourne à droite.",
          "ko": "오른쪽으로 도세요."
        }
      },
      {
        "fr": "exister",
        "ipa": "[ɛɡziste]",
        "ko": "존재하다, 있다",
        "pos": "v.",
        "en": "to exist",
        "ex": {
          "fr": "Ce mot existe vraiment.",
          "ko": "이 단어 진짜로 있어요."
        }
      },
      {
        "fr": "agir",
        "ipa": "[aʒiʁ]",
        "ko": "행동하다 (il s'agit de: ~에 관한 것이다)",
        "pos": "v.",
        "en": "to act",
        "ex": {
          "fr": "Il faut agir vite.",
          "ko": "빨리 행동해야 해요."
        }
      },
      {
        "fr": "plaire",
        "ipa": "[plɛʁ]",
        "ko": "마음에 들다 (s'il vous plaît: 부탁해요)",
        "pos": "v.",
        "ex": {
          "fr": "Ce film me plaît beaucoup.",
          "ko": "이 영화 정말 마음에 들어요."
        }
      },
      {
        "fr": "rappeler",
        "ipa": "[ʁaple]",
        "ko": "다시 전화하다, 상기시키다 (se rappeler: 기억하다)",
        "pos": "v.",
        "ex": {
          "fr": "Je te rappelle ce soir.",
          "ko": "오늘 저녁에 다시 전화할게."
        }
      },
      {
        "fr": "intéresser",
        "ipa": "[ɛ̃teʁese]",
        "ko": "관심을 끌다 (s'intéresser à: ~에 관심이 있다)",
        "pos": "v.",
        "en": "to interest",
        "ex": {
          "fr": "Ce sujet m'intéresse.",
          "ko": "이 주제에 관심이 있어요."
        }
      },
      {
        "fr": "cacher",
        "ipa": "[kaʃe]",
        "ko": "숨기다 (se cacher: 숨다)",
        "pos": "v.",
        "ex": {
          "fr": "Il cache ses bonbons.",
          "ko": "그는 사탕을 숨겨요."
        }
      },
      {
        "fr": "offrir",
        "ipa": "[ɔfʁiʁ]",
        "ko": "선물하다, 제공하다, 권하다",
        "pos": "v.",
        "en": "to offer",
        "ex": {
          "fr": "Je t'offre un café.",
          "ko": "내가 커피 살게."
        }
      },
      {
        "fr": "jeter",
        "ipa": "[ʒəte]",
        "ko": "던지다, 버리다",
        "pos": "v.",
        "ex": {
          "fr": "Ne jette pas le papier par terre.",
          "ko": "종이를 바닥에 버리지 마."
        }
      },
      {
        "fr": "tirer",
        "ipa": "[tiʁe]",
        "ko": "당기다, 끌다, (총을) 쏘다",
        "pos": "v.",
        "ex": {
          "fr": "Tire la porte vers toi.",
          "ko": "문을 당기세요."
        }
      },
      {
        "fr": "reprendre",
        "ipa": "[ʁəpʁɑ̃dʁ]",
        "ko": "다시 잡다, 다시 시작하다, 더 먹다",
        "pos": "v.",
        "ex": {
          "fr": "On reprend le travail à deux heures.",
          "ko": "두 시에 일을 다시 시작해요."
        }
      },
      {
        "fr": "compter",
        "ipa": "[kɔ̃te]",
        "ko": "세다, 계산하다, ~할 작정이다",
        "pos": "v.",
        "en": "to count",
        "ex": {
          "fr": "Compte jusqu'à dix.",
          "ko": "열까지 세어 봐."
        }
      },
      {
        "fr": "descendre",
        "ipa": "[desɑ̃dʁ]",
        "ko": "내려가다, (탈것에서) 내리다",
        "pos": "v.",
        "en": "to descend",
        "ex": {
          "fr": "Je descends à la prochaine station.",
          "ko": "다음 역에서 내려요."
        }
      },
      {
        "fr": "ajouter",
        "ipa": "[aʒute]",
        "ko": "더하다, 추가하다, 덧붙여 말하다",
        "pos": "v.",
        "ex": {
          "fr": "Ajoute un peu de sel.",
          "ko": "소금을 조금 넣어."
        }
      },
      {
        "fr": "battre",
        "ipa": "[batʁ]",
        "ko": "치다, 때리다, 이기다 (se battre: 싸우다)",
        "pos": "v.",
        "ex": {
          "fr": "Notre équipe a battu l'autre.",
          "ko": "우리 팀이 상대를 이겼어요."
        }
      },
      {
        "fr": "installer",
        "ipa": "[ɛ̃stale]",
        "ko": "설치하다 (s'installer: 자리 잡다·이사하다)",
        "pos": "v.",
        "en": "to install",
        "ex": {
          "fr": "Il installe une étagère.",
          "ko": "그는 선반을 설치해요."
        }
      },
      {
        "fr": "pousser",
        "ipa": "[puse]",
        "ko": "밀다, (식물이) 자라다",
        "pos": "v.",
        "ex": {
          "fr": "Il faut pousser la porte.",
          "ko": "문을 밀어야 해요."
        }
      },
      {
        "fr": "approcher",
        "ipa": "[apʁɔʃe]",
        "ko": "다가가다, 가까이 가다",
        "pos": "v.",
        "en": "approach",
        "etym": "영어 approach와 같은 뿌리예요.",
        "ex": {
          "fr": "N'approche pas du feu.",
          "ko": "불에 가까이 가지 마세요."
        }
      },
      {
        "fr": "apercevoir",
        "ipa": "[apɛʁsəvwaʁ]",
        "ko": "언뜻 보다, 알아채다 (s'apercevoir: 깨닫다)",
        "pos": "v.",
        "ex": {
          "fr": "J'aperçois la mer au loin.",
          "ko": "멀리 바다가 언뜻 보여요."
        }
      },
      {
        "fr": "réaliser",
        "ipa": "[ʁealize]",
        "ko": "실현하다, 해내다 / 깨닫다",
        "pos": "v.",
        "en": "realize",
        "etym": "영어 realize와 같은 뿌리예요. '실현하다'와 '깨닫다' 둘 다 돼요.",
        "ex": {
          "fr": "Il a réalisé son rêve.",
          "ko": "그는 꿈을 이뤘어요."
        }
      },
      {
        "fr": "accepter",
        "ipa": "[aksɛpte]",
        "ko": "받아들이다, 수락하다",
        "pos": "v.",
        "en": "accept",
        "ex": {
          "fr": "J'accepte ton invitation.",
          "ko": "당신의 초대를 받아들일게요."
        }
      },
      {
        "fr": "conduire",
        "ipa": "[kɔ̃dɥiʁ]",
        "ko": "운전하다, 이끌다",
        "pos": "v.",
        "en": "conduct",
        "etym": "라틴어 conducere(함께 이끌다)에서 — 영어 conduct와 같은 뿌리예요.",
        "ex": {
          "fr": "Elle conduit prudemment.",
          "ko": "그녀는 조심스럽게 운전해요."
        }
      },
      {
        "fr": "lancer",
        "ipa": "[lɑ̃se]",
        "ko": "던지다, 시작하다, 출시하다",
        "pos": "v.",
        "en": "launch",
        "etym": "영어 launch와 같은 뿌리예요.",
        "ex": {
          "fr": "Il lance la balle au chien.",
          "ko": "그는 개에게 공을 던져요."
        }
      },
      {
        "fr": "représenter",
        "ipa": "[ʁəpʁezɑ̃te]",
        "ko": "나타내다, 대표하다, 표현하다",
        "pos": "v.",
        "en": "represent",
        "ex": {
          "fr": "Ce tableau représente la mer.",
          "ko": "이 그림은 바다를 나타내요."
        }
      },
      {
        "fr": "adorer",
        "ipa": "[adɔʁe]",
        "ko": "아주 좋아하다, 사랑하다",
        "pos": "v.",
        "en": "adore",
        "ex": {
          "fr": "J'adore le chocolat.",
          "ko": "저는 초콜릿을 정말 좋아해요."
        }
      },
      {
        "fr": "mener",
        "ipa": "[məne]",
        "ko": "이끌다, 데려가다, 진행하다",
        "pos": "v.",
        "ex": {
          "fr": "Cette rue mène à la gare.",
          "ko": "이 길은 역으로 이어져요."
        }
      },
      {
        "fr": "accompagner",
        "ipa": "[akɔ̃paɲe]",
        "ko": "동행하다, 함께 가다",
        "pos": "v.",
        "en": "accompany",
        "ex": {
          "fr": "Je t'accompagne à la gare.",
          "ko": "역까지 같이 가 줄게요."
        }
      },
      {
        "fr": "sauver",
        "ipa": "[sove]",
        "ko": "구하다, 살리다",
        "pos": "v.",
        "en": "save",
        "etym": "라틴어 salvare에서 — 영어 save와 같은 뿌리예요.",
        "ex": {
          "fr": "Il a sauvé un enfant.",
          "ko": "그는 아이 한 명을 구했어요."
        }
      },
      {
        "fr": "avancer",
        "ipa": "[avɑ̃se]",
        "ko": "앞으로 가다, 나아가다",
        "pos": "v.",
        "en": "advance",
        "ex": {
          "fr": "Avance un peu, s'il te plaît.",
          "ko": "조금만 앞으로 가 줘요."
        }
      },
      {
        "fr": "partager",
        "ipa": "[paʁtaʒe]",
        "ko": "나누다, 공유하다",
        "pos": "v.",
        "ex": {
          "fr": "On partage le gâteau ?",
          "ko": "케이크를 나눠 먹을까요?"
        }
      },
      {
        "fr": "considérer",
        "ipa": "[kɔ̃sideʁe]",
        "ko": "여기다, 고려하다",
        "pos": "v.",
        "en": "consider",
        "ex": {
          "fr": "Je le considère comme un ami.",
          "ko": "저는 그를 친구로 여겨요."
        }
      },
      {
        "fr": "souhaiter",
        "ipa": "[swɛte]",
        "ko": "바라다, 기원하다",
        "pos": "v.",
        "ex": {
          "fr": "Je te souhaite un bon voyage.",
          "ko": "좋은 여행 되길 바라요."
        }
      },
      {
        "fr": "déclarer",
        "ipa": "[deklaʁe]",
        "ko": "선언하다, 신고하다",
        "pos": "v.",
        "en": "declare",
        "ex": {
          "fr": "Il déclare qu'il est innocent.",
          "ko": "그는 자기가 무죄라고 말해요."
        }
      },
      {
        "fr": "rêver",
        "ipa": "[ʁɛve]",
        "ko": "꿈꾸다, 꿈을 꾸다",
        "pos": "v.",
        "ex": {
          "fr": "Je rêve de voyager au Japon.",
          "ko": "저는 일본에 여행 가는 걸 꿈꿔요."
        }
      },
      {
        "fr": "obtenir",
        "ipa": "[ɔptəniʁ]",
        "ko": "얻다, 획득하다",
        "pos": "v.",
        "en": "obtain",
        "ex": {
          "fr": "Elle a obtenu une bonne note.",
          "ko": "그녀는 좋은 점수를 받았어요."
        }
      },
      {
        "fr": "toucher",
        "ipa": "[tuʃe]",
        "ko": "만지다, 닿다, 감동시키다",
        "pos": "v.",
        "en": "touch",
        "ex": {
          "fr": "Ne touche pas à ça !",
          "ko": "그거 만지지 마!"
        }
      },
      {
        "fr": "imaginer",
        "ipa": "[imaʒine]",
        "ko": "상상하다",
        "pos": "v.",
        "en": "imagine",
        "ex": {
          "fr": "Imagine un monde sans guerre.",
          "ko": "전쟁이 없는 세상을 상상해 봐요."
        }
      },
      {
        "fr": "développer",
        "ipa": "[devlɔpe]",
        "ko": "발전시키다, 개발하다",
        "pos": "v.",
        "en": "develop",
        "ex": {
          "fr": "L'entreprise développe un nouveau produit.",
          "ko": "그 회사는 새 제품을 개발해요."
        }
      },
      {
        "fr": "situer",
        "ipa": "[sitɥe]",
        "ko": "위치시키다, 자리매김하다 (se situer: ~에 위치하다)",
        "pos": "v.",
        "en": "situate",
        "ex": {
          "fr": "L'hôtel se situe près de la gare.",
          "ko": "호텔은 역 근처에 있어요."
        }
      },
      {
        "fr": "essayer",
        "ipa": "[eseje]",
        "ko": "시도하다, 입어 보다",
        "pos": "v.",
        "en": "essay",
        "etym": "영어 essay와 같은 뿌리예요. 동사 essayer는 '시도하다, 입어 보다'예요.",
        "ex": {
          "fr": "Je peux essayer cette robe ?",
          "ko": "이 원피스를 입어 봐도 될까요?"
        }
      },
      {
        "fr": "posséder",
        "ipa": "[pɔsede]",
        "ko": "소유하다, 가지고 있다",
        "pos": "v.",
        "en": "possess",
        "ex": {
          "fr": "Elle possède une grande maison.",
          "ko": "그녀는 큰 집을 가지고 있어요."
        }
      },
      {
        "fr": "produire",
        "ipa": "[pʁɔdɥiʁ]",
        "ko": "생산하다, 만들어 내다 (se produire: 일어나다)",
        "pos": "v.",
        "en": "produce",
        "ex": {
          "fr": "Cette région produit du vin.",
          "ko": "이 지역은 와인을 생산해요."
        }
      },
      {
        "fr": "suffire",
        "ipa": "[syfiʁ]",
        "ko": "충분하다, 족하다 (il suffit de: ~하면 된다)",
        "pos": "v.",
        "en": "suffice",
        "ex": {
          "fr": "Ça suffit pour aujourd'hui.",
          "ko": "오늘은 이걸로 충분해요."
        }
      },
      {
        "fr": "embrasser",
        "ipa": "[ɑ̃bʁase]",
        "ko": "입맞추다, 껴안다",
        "pos": "v.",
        "ex": {
          "fr": "Elle embrasse son enfant.",
          "ko": "그녀는 아이에게 입맞춰요."
        }
      }
    ]
  },
  {
    "name": "기초 형용사",
    "icon": "🎨",
    "words": [
      {
        "fr": "nombreux / nombreuse",
        "ipa": "[nɔ̃bʁø / nɔ̃bʁøz]",
        "ko": "수많은, 다수의 (여성형 nombreuse)",
        "pos": "adj.",
        "en": "numerous",
        "ex": {
          "fr": "Il a de nombreux amis.",
          "ko": "그는 친구가 많아요."
        }
      },
      {
        "fr": "gros / grosse",
        "ipa": "[ɡʁo / ɡʁos]",
        "ko": "큰, 굵은, 뚱뚱한 (여성형 grosse)",
        "pos": "adj.",
        "ex": {
          "fr": "C'est un gros chien.",
          "ko": "큰 개네요."
        }
      },
      {
        "fr": "blanc / blanche",
        "ipa": "[blɑ̃ / blɑ̃ʃ]",
        "ko": "흰, 하얀 (여성형 blanche)",
        "pos": "adj.",
        "en": "blank",
        "etym": "영어 blank(빈)와 같은 뿌리지만 프랑스어 blanc는 '하얀'이에요.",
        "ex": {
          "fr": "Elle porte une robe blanche.",
          "ko": "그녀는 흰 원피스를 입었어요."
        }
      },
      {
        "fr": "plein / pleine",
        "ipa": "[plɛ̃ / plɛn]",
        "ko": "가득한, 꽉 찬 (여성형 pleine)",
        "pos": "adj.",
        "ex": {
          "fr": "Le verre est plein.",
          "ko": "잔이 가득 찼어요."
        }
      },
      {
        "fr": "différent / différente",
        "ipa": "[difeʁɑ̃ / difeʁɑ̃t]",
        "ko": "다른, 여러 가지의 (여성형 différente)",
        "pos": "adj.",
        "en": "different",
        "ex": {
          "fr": "Nos goûts sont différents.",
          "ko": "우리 취향은 달라요."
        }
      },
      {
        "fr": "noir / noire",
        "ipa": "[nwaʁ / nwaʁ]",
        "ko": "검은, 까만 (여성형 noire)",
        "pos": "adj.",
        "ex": {
          "fr": "Il porte un manteau noir.",
          "ko": "그는 검은 외투를 입었어요."
        }
      },
      {
        "fr": "général / générale",
        "ipa": "[ʒeneʁal / ʒeneʁal]",
        "ko": "일반적인, 전반적인 (en général: 보통) (여성형 générale)",
        "pos": "adj.",
        "en": "general",
        "ex": {
          "fr": "En général, je me lève tôt.",
          "ko": "보통 저는 일찍 일어나요."
        }
      },
      {
        "fr": "ancien / ancienne",
        "ipa": "[ɑ̃sjɛ̃ / ɑ̃sjɛn]",
        "ko": "오래된, 옛, 예전의 (여성형 ancienne)",
        "pos": "adj.",
        "en": "ancient",
        "etym": "영어 ancient와 닮았지만 명사 앞에선 '예전의(전직)' 뜻이 돼요. un ancien professeur = 전직 교수.",
        "ex": {
          "fr": "C'est une ancienne église.",
          "ko": "오래된 교회예요."
        }
      },
      {
        "fr": "simple",
        "ipa": "[sɛ̃pl]",
        "ko": "간단한, 단순한, 소박한",
        "pos": "adj.",
        "en": "simple",
        "ex": {
          "fr": "C'est une question simple.",
          "ko": "간단한 질문이에요."
        }
      },
      {
        "fr": "social / sociale",
        "ipa": "[sɔsjal / sɔsjal]",
        "ko": "사회의, 사회적인 (여성형 sociale, 남성복수 sociaux)",
        "pos": "adj.",
        "en": "social",
        "ex": {
          "fr": "C'est un problème social.",
          "ko": "이건 사회 문제예요."
        }
      },
      {
        "fr": "juste",
        "ipa": "[ʒyst]",
        "ko": "올바른, 정확한, 딱 맞는 (부사로 '단지')",
        "pos": "adj.",
        "en": "just",
        "ex": {
          "fr": "C'est une réponse juste.",
          "ko": "그건 맞는 답이에요."
        }
      },
      {
        "fr": "politique",
        "ipa": "[pɔlitik]",
        "ko": "정치의, 정치적인 (명사로 la politique: 정치)",
        "pos": "adj.",
        "en": "political",
        "ex": {
          "fr": "C'est un parti politique.",
          "ko": "그건 정당이에요."
        }
      },
      {
        "fr": "national / nationale",
        "ipa": "[nasjɔnal / nasjɔnal]",
        "ko": "국가의, 전국의 (여성형 nationale, 남성복수 nationaux)",
        "pos": "adj.",
        "en": "national",
        "ex": {
          "fr": "C'est une fête nationale.",
          "ko": "이건 국경일이에요."
        }
      },
      {
        "fr": "européen / européenne",
        "ipa": "[øʁɔpeɛ̃ / øʁɔpeɛn]",
        "ko": "유럽의 (여성형 européenne)",
        "pos": "adj.",
        "en": "European",
        "ex": {
          "fr": "C'est un pays européen.",
          "ko": "유럽 나라예요."
        }
      },
      {
        "fr": "célèbre",
        "ipa": "[selɛbʁ]",
        "ko": "유명한",
        "pos": "adj.",
        "en": "celebrated",
        "etym": "영어 celebrity(유명인)와 같은 뿌리예요.",
        "ex": {
          "fr": "C'est un peintre très célèbre.",
          "ko": "그는 아주 유명한 화가예요."
        }
      },
      {
        "fr": "propre",
        "ipa": "[pʁɔpʁ]",
        "ko": "깨끗한 / (명사 앞) 자신의",
        "pos": "adj.",
        "en": "proper",
        "etym": "영어 proper와 닮았지만 보통 '깨끗한'을 뜻해요. 명사 앞에 오면 '자신의'예요.",
        "ex": {
          "fr": "Mes mains sont propres.",
          "ko": "제 손은 깨끗해요."
        }
      },
      {
        "fr": "prêt / prête",
        "ipa": "[pʁɛ / pʁɛt]",
        "ko": "준비된 (여성형 prête)",
        "pos": "adj.",
        "ex": {
          "fr": "Je suis prêt à partir.",
          "ko": "저는 떠날 준비가 됐어요."
        }
      },
      {
        "fr": "international / internationale",
        "ipa": "[ɛ̃tɛʁnasjɔnal / ɛ̃tɛʁnasjɔnal]",
        "ko": "국제적인 (복수 internationaux)",
        "pos": "adj.",
        "en": "international",
        "ex": {
          "fr": "C'est un aéroport international.",
          "ko": "이건 국제공항이에요."
        }
      },
      {
        "fr": "bleu / bleue",
        "ipa": "[blø / blø]",
        "ko": "파란 (여성형 bleue)",
        "pos": "adj.",
        "ex": {
          "fr": "Le ciel est bleu.",
          "ko": "하늘이 파래요."
        }
      },
      {
        "fr": "pauvre",
        "ipa": "[povʁ]",
        "ko": "가난한 / (명사 앞) 불쌍한",
        "pos": "adj.",
        "en": "poor",
        "ex": {
          "fr": "Cette famille est pauvre.",
          "ko": "이 가족은 가난해요."
        }
      },
      {
        "fr": "haut / haute",
        "ipa": "[o / ot]",
        "ko": "높은 (여성형 haute)",
        "pos": "adj.",
        "ex": {
          "fr": "La montagne est très haute.",
          "ko": "그 산은 아주 높아요."
        }
      },
      {
        "fr": "impossible",
        "ipa": "[ɛ̃pɔsibl]",
        "ko": "불가능한",
        "pos": "adj.",
        "en": "impossible",
        "ex": {
          "fr": "C'est impossible de finir aujourd'hui.",
          "ko": "오늘 끝내는 건 불가능해요."
        }
      },
      {
        "fr": "terrible",
        "ipa": "[tɛʁibl]",
        "ko": "끔찍한 / (구어) 굉장한",
        "pos": "adj.",
        "en": "terrible",
        "etym": "영어 terrible과 같은 뿌리지만, 구어에서는 '굉장한(좋은)' 뜻으로도 써요.",
        "ex": {
          "fr": "Il fait un temps terrible.",
          "ko": "날씨가 끔찍해요."
        }
      },
      {
        "fr": "mondial / mondiale",
        "ipa": "[mɔ̃djal / mɔ̃djal]",
        "ko": "세계의, 세계적인 (복수 mondiaux)",
        "pos": "adj.",
        "ex": {
          "fr": "C'est un problème mondial.",
          "ko": "이건 세계적인 문제예요."
        }
      },
      {
        "fr": "culturel / culturelle",
        "ipa": "[kyltyʁɛl / kyltyʁɛl]",
        "ko": "문화의, 문화적인 (여성형 culturelle)",
        "pos": "adj.",
        "en": "cultural",
        "ex": {
          "fr": "C'est un événement culturel.",
          "ko": "이건 문화 행사예요."
        }
      },
      {
        "fr": "scientifique",
        "ipa": "[sjɑ̃tifik]",
        "ko": "과학의, 과학적인 / (명사) 과학자",
        "pos": "adj.",
        "en": "scientific",
        "ex": {
          "fr": "C'est une revue scientifique.",
          "ko": "이건 과학 잡지예요."
        }
      },
      {
        "fr": "humain / humaine",
        "ipa": "[ymɛ̃ / ymɛn]",
        "ko": "인간의, 인간적인 (여성형 humaine)",
        "pos": "adj.",
        "en": "human",
        "ex": {
          "fr": "Le corps humain est complexe.",
          "ko": "인체는 복잡해요."
        }
      },
      {
        "fr": "véritable",
        "ipa": "[veʁitabl]",
        "ko": "진짜의, 진정한",
        "pos": "adj.",
        "en": "veritable",
        "ex": {
          "fr": "C'est un véritable ami.",
          "ko": "그는 진정한 친구예요."
        }
      },
      {
        "fr": "vert / verte",
        "ipa": "[vɛʁ / vɛʁt]",
        "ko": "초록의, 녹색의 (여성형 verte)",
        "pos": "adj.",
        "ex": {
          "fr": "L'herbe est verte.",
          "ko": "풀이 초록색이에요."
        }
      }
    ]
  },
  {
    "name": "부사와 표현",
    "icon": "💬",
    "words": [
      {
        "fr": "bien",
        "ipa": "[bjɛ̃]",
        "ko": "잘, 정말",
        "pos": "adv.",
        "ex": {
          "fr": "Tu chantes bien.",
          "ko": "너 노래 잘한다."
        }
      },
      {
        "fr": "près",
        "ipa": "[pʁɛ]",
        "ko": "가까이 (près de ~: ~ 근처에)",
        "pos": "adv.",
        "ex": {
          "fr": "L'hôtel est tout près.",
          "ko": "호텔은 바로 가까이에 있어요."
        }
      },
      {
        "fr": "peut-être",
        "ipa": "[pøtɛtʁ]",
        "ko": "아마, 어쩌면",
        "pos": "adv.",
        "ex": {
          "fr": "Il viendra peut-être demain.",
          "ko": "그는 아마 내일 올 거예요."
        }
      },
      {
        "fr": "ah",
        "ipa": "[a]",
        "ko": "아! (감탄)",
        "pos": "interj.",
        "ex": {
          "fr": "Ah, c'est toi !",
          "ko": "아, 너구나!"
        }
      },
      {
        "fr": "mal",
        "ipa": "[mal]",
        "ko": "잘못, 나쁘게 (avoir mal: 아프다)",
        "pos": "adv.",
        "ex": {
          "fr": "J'ai mal à la tête.",
          "ko": "머리가 아파요."
        }
      },
      {
        "fr": "autour",
        "ipa": "[otuʁ]",
        "ko": "주위에, 둘레에 (autour de: ~ 주변에)",
        "pos": "adv.",
        "ex": {
          "fr": "Il y a des arbres autour.",
          "ko": "주위에 나무들이 있어요."
        }
      },
      {
        "fr": "presque",
        "ipa": "[pʁɛsk]",
        "ko": "거의",
        "pos": "adv.",
        "ex": {
          "fr": "C'est presque fini.",
          "ko": "거의 다 끝났어요."
        }
      },
      {
        "fr": "eh",
        "ipa": "[e]",
        "ko": "어이, 야 (부름·감탄)",
        "pos": "interj.",
        "ex": {
          "fr": "Eh, attends-moi !",
          "ko": "야, 나 좀 기다려!"
        }
      },
      {
        "fr": "également",
        "ipa": "[eɡalmɑ̃]",
        "ko": "또한, 마찬가지로",
        "pos": "adv.",
        "ex": {
          "fr": "Il parle également anglais.",
          "ko": "그는 영어도 해요."
        }
      },
      {
        "fr": "partout",
        "ipa": "[paʁtu]",
        "ko": "어디에나, 곳곳에",
        "pos": "adv.",
        "ex": {
          "fr": "Il y a des gens partout.",
          "ko": "어디에나 사람이 있어요."
        }
      },
      {
        "fr": "après",
        "ipa": "[apʁɛ]",
        "ko": "후에, 나중에",
        "pos": "adv.",
        "ex": {
          "fr": "On verra ça après.",
          "ko": "그건 나중에 봐요."
        }
      },
      {
        "fr": "lors",
        "ipa": "[lɔʁ]",
        "ko": "~할 때 (lors de: ~동안, ~때)",
        "pos": "adv.",
        "ex": {
          "fr": "Lors de la fête, on a beaucoup dansé.",
          "ko": "파티 때 우리는 춤을 많이 췄어요."
        }
      },
      {
        "fr": "là-bas",
        "ipa": "[laba]",
        "ko": "저기에, 저쪽에",
        "pos": "adv.",
        "ex": {
          "fr": "La gare est là-bas.",
          "ko": "역은 저쪽에 있어요."
        }
      }
    ]
  },
  {
    "name": "달력의 달",
    "icon": "📅",
    "words": [
      {
        "fr": "juillet",
        "ipa": "[ʒɥijɛ]",
        "ko": "7월",
        "pos": "n.m.",
        "ex": {
          "fr": "Les vacances commencent en juillet.",
          "ko": "방학은 7월에 시작해요."
        }
      },
      {
        "fr": "mai",
        "ipa": "[mɛ]",
        "ko": "5월",
        "pos": "n.m.",
        "ex": {
          "fr": "Mon anniversaire est en mai.",
          "ko": "제 생일은 5월이에요."
        }
      }
    ]
  }
];

export default themes;
