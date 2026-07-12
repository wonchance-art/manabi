/**
 * C1 보강 어휘 (2차) — FLELex 등급을 실제 빈도로 보정.
 * index.js의 mergeFrVocab가 본편과 병합.
 */
const themes = [
  {
    "name": "학술·지성 어휘",
    "icon": "📚",
    "words": [
      {
        "fr": "la synthèse",
        "ipa": "[sɛ̃tɛz]",
        "ko": "종합, 통합; (화학) 합성",
        "pos": "n.f.",
        "en": "synthesis",
        "etym": "그리스어 syn(함께)+thesis(놓음) — 영어 synthesis와 같은 뿌리예요.",
        "ex": {
          "fr": "Il a fait une synthèse claire des différentes théories.",
          "ko": "그는 여러 이론을 명료하게 종합했어요."
        }
      },
      {
        "fr": "la molécule",
        "ipa": "[mɔlekyl]",
        "ko": "분자",
        "pos": "n.f.",
        "en": "molecule",
        "etym": "라틴어 moles(덩어리)의 축소형 — 영어 molecule과 같은 뿌리예요.",
        "ex": {
          "fr": "Une molécule d'eau contient deux atomes d'hydrogène.",
          "ko": "물 분자 하나에는 수소 원자 두 개가 들어 있어요."
        }
      },
      {
        "fr": "la paroi",
        "ipa": "[paʁwa]",
        "ko": "(세포·기관·동굴 등의) 벽, 내벽; 암벽",
        "pos": "n.f.",
        "ex": {
          "fr": "La paroi de l'estomac est tapissée de muqueuse.",
          "ko": "위벽은 점막으로 덮여 있어요."
        }
      },
      {
        "fr": "l'antibiotique (m.)",
        "ipa": "[ɑ̃tibjɔtik]",
        "ko": "항생제",
        "pos": "n.m.",
        "en": "antibiotic",
        "etym": "그리스어 anti(반대)+bios(생명) — 영어 antibiotic과 같은 뿌리예요.",
        "ex": {
          "fr": "Le médecin lui a prescrit un antibiotique.",
          "ko": "의사가 그에게 항생제를 처방했어요."
        }
      },
      {
        "fr": "la faculté",
        "ipa": "[fakylte]",
        "ko": "능력; (대학의) 학부, 단과대",
        "pos": "n.f.",
        "en": "faculty",
        "etym": "라틴어 facultas(능력) — 영어 faculty와 같은 뿌리지만, 프랑스어는 '학부'·'능력'을 뜻하고 '교수진'의 뜻은 약해요.",
        "ex": {
          "fr": "Il a conservé toutes ses facultés intellectuelles.",
          "ko": "그는 지적 능력을 모두 유지하고 있어요."
        }
      },
      {
        "fr": "l'injection (f.)",
        "ipa": "[ɛ̃ʒɛksjɔ̃]",
        "ko": "주사, 주입",
        "pos": "n.f.",
        "en": "injection",
        "etym": "라틴어 injicere(던져 넣다) — 영어 injection과 같은 뿌리예요.",
        "ex": {
          "fr": "L'infirmière a fait une injection au patient.",
          "ko": "간호사가 환자에게 주사를 놓았어요."
        }
      },
      {
        "fr": "la particule",
        "ipa": "[paʁtikyl]",
        "ko": "(물리) 입자; 미립자",
        "pos": "n.f.",
        "en": "particle",
        "etym": "라틴어 particula(작은 부분) — 영어 particle과 같은 뿌리예요.",
        "ex": {
          "fr": "Les particules fines polluent l'air des villes.",
          "ko": "미세 입자가 도시의 공기를 오염시켜요."
        }
      },
      {
        "fr": "le nerf",
        "ipa": "[nɛʁ]",
        "ko": "신경",
        "pos": "n.m.",
        "en": "nerve",
        "etym": "라틴어 nervus(힘줄·신경) — 영어 nerve와 같은 뿌리예요. 끝의 f는 발음하지 않아요.",
        "ex": {
          "fr": "Ce nerf transmet la douleur au cerveau.",
          "ko": "이 신경이 통증을 뇌로 전달해요."
        }
      },
      {
        "fr": "l'index (m.)",
        "ipa": "[ɛ̃dɛks]",
        "ko": "색인; 집게손가락; 지수",
        "pos": "n.m.",
        "en": "index",
        "etym": "라틴어 index(가리키는 것) — 영어 index와 같은 뿌리예요.",
        "ex": {
          "fr": "Consultez l'index à la fin du livre.",
          "ko": "책 끝에 있는 색인을 참고하세요."
        }
      },
      {
        "fr": "l'hormone (f.)",
        "ipa": "[ɔʁmɔn]",
        "ko": "호르몬",
        "pos": "n.f.",
        "en": "hormone",
        "etym": "그리스어 hormôn(자극하는 것) — 영어 hormone과 같은 뿌리예요.",
        "ex": {
          "fr": "Le stress libère certaines hormones.",
          "ko": "스트레스는 특정 호르몬을 분비시켜요."
        }
      },
      {
        "fr": "le squelette",
        "ipa": "[skəlɛt]",
        "ko": "골격, 뼈대",
        "pos": "n.m.",
        "en": "skeleton",
        "etym": "그리스어 skeletos(마른 것) — 영어 skeleton과 같은 뿌리예요.",
        "ex": {
          "fr": "Le squelette humain compte 206 os.",
          "ko": "사람의 골격은 206개의 뼈로 이루어져 있어요."
        }
      },
      {
        "fr": "la schizophrénie",
        "ipa": "[skizɔfʁeni]",
        "ko": "조현병",
        "pos": "n.f.",
        "en": "schizophrenia",
        "etym": "그리스어 schizein(쪼개다)+phrên(정신) — 영어 schizophrenia와 같은 뿌리예요.",
        "ex": {
          "fr": "La schizophrénie est une maladie mentale complexe.",
          "ko": "조현병은 복합적인 정신 질환이에요."
        }
      },
      {
        "fr": "le réacteur",
        "ipa": "[ʁeaktœʁ]",
        "ko": "(원자로 등의) 원자로; (항공) 제트 엔진",
        "pos": "n.m.",
        "en": "reactor",
        "etym": "라틴어 reagere(반응하다) — 영어 reactor와 같은 뿌리예요.",
        "ex": {
          "fr": "Le réacteur a été arrêté pour maintenance.",
          "ko": "원자로는 정비를 위해 가동을 멈췄어요."
        }
      },
      {
        "fr": "l'oxyde (m.)",
        "ipa": "[ɔksid]",
        "ko": "산화물",
        "pos": "n.m.",
        "en": "oxide",
        "etym": "그리스어 oxys(신맛)에서 — 영어 oxide와 같은 뿌리예요.",
        "ex": {
          "fr": "La rouille est un oxyde de fer.",
          "ko": "녹은 철의 산화물이에요."
        }
      },
      {
        "fr": "les cristaux (m.pl.)",
        "ipa": "[kʁisto]",
        "ko": "결정(체)들 (cristal의 복수)",
        "pos": "n.m.pl.",
        "en": "crystals",
        "etym": "그리스어 krystallos(얼음·수정) — 영어 crystal과 같은 뿌리예요. 단수는 cristal이에요.",
        "ex": {
          "fr": "Des cristaux de glace se sont formés sur la vitre.",
          "ko": "유리창에 얼음 결정이 생겼어요."
        }
      },
      {
        "fr": "le colloque",
        "ipa": "[kɔlɔk]",
        "ko": "(학술) 심포지엄, 학술 대회",
        "pos": "n.m.",
        "en": "colloquium",
        "etym": "라틴어 colloqui(함께 이야기하다) — 영어 colloquium과 같은 뿌리예요.",
        "ex": {
          "fr": "Elle présente ses travaux à un colloque international.",
          "ko": "그녀는 국제 학술 대회에서 연구를 발표해요."
        }
      },
      {
        "fr": "l'anesthésie (f.)",
        "ipa": "[anɛstezi]",
        "ko": "마취",
        "pos": "n.f.",
        "en": "anaesthesia",
        "etym": "그리스어 an(없음)+aisthêsis(감각) — 영어 anaesthesia와 같은 뿌리예요.",
        "ex": {
          "fr": "L'opération se fait sous anesthésie générale.",
          "ko": "수술은 전신 마취로 진행돼요."
        }
      },
      {
        "fr": "la méthodologie",
        "ipa": "[metɔdɔlɔʒi]",
        "ko": "방법론",
        "pos": "n.f.",
        "en": "methodology",
        "etym": "그리스어 methodos(방법)+logos(학문) — 영어 methodology와 같은 뿌리예요.",
        "ex": {
          "fr": "La méthodologie de cette étude est rigoureuse.",
          "ko": "이 연구의 방법론은 엄밀해요."
        }
      },
      {
        "fr": "le soufre",
        "ipa": "[sufʁ]",
        "ko": "유황, 황",
        "pos": "n.m.",
        "ex": {
          "fr": "Cette source d'eau dégage une odeur de soufre.",
          "ko": "이 샘물에서는 유황 냄새가 나요."
        }
      },
      {
        "fr": "la pathologie",
        "ipa": "[patɔlɔʒi]",
        "ko": "병리(학); 질환",
        "pos": "n.f.",
        "en": "pathology",
        "etym": "그리스어 pathos(고통)+logos(학문) — 영어 pathology와 같은 뿌리예요.",
        "ex": {
          "fr": "Cette pathologie reste encore mal comprise.",
          "ko": "이 질환은 아직 잘 밝혀지지 않았어요."
        }
      },
      {
        "fr": "la concentration",
        "ipa": "[kɔ̃sɑ̃tʁasjɔ̃]",
        "ko": "집중; (물질의) 농도",
        "pos": "n.f.",
        "en": "concentration",
        "etym": "라틴어 concentrare(중심으로 모으다) — 영어 concentration과 같은 뿌리예요.",
        "ex": {
          "fr": "Ce travail exige une grande concentration.",
          "ko": "이 일은 높은 집중력을 요구해요."
        }
      },
      {
        "fr": "la géométrie",
        "ipa": "[ʒeɔmetʁi]",
        "ko": "기하학",
        "pos": "n.f.",
        "en": "geometry",
        "etym": "그리스어 geo(땅)+metron(측정) — 영어 geometry와 같은 뿌리예요.",
        "ex": {
          "fr": "La géométrie étudie les formes et les espaces.",
          "ko": "기하학은 형태와 공간을 연구해요."
        }
      },
      {
        "fr": "l'atome (m.)",
        "ipa": "[atɔm]",
        "ko": "원자",
        "pos": "n.m.",
        "en": "atom",
        "etym": "그리스어 atomos(더 쪼갤 수 없는) — 영어 atom과 같은 뿌리예요.",
        "ex": {
          "fr": "Un atome est constitué d'un noyau et d'électrons.",
          "ko": "원자는 핵과 전자들로 이루어져 있어요."
        }
      },
      {
        "fr": "le paragraphe",
        "ipa": "[paʁaɡʁaf]",
        "ko": "단락, 문단",
        "pos": "n.m.",
        "en": "paragraph",
        "etym": "그리스어 para(곁)+graphein(쓰다) — 영어 paragraph와 같은 뿌리예요.",
        "ex": {
          "fr": "Reprenez l'idée principale du premier paragraphe.",
          "ko": "첫 단락의 핵심 생각을 다시 짚어 보세요."
        }
      },
      {
        "fr": "la soustraction",
        "ipa": "[sustʁaksjɔ̃]",
        "ko": "뺄셈, 차감",
        "pos": "n.f.",
        "en": "subtraction",
        "etym": "라틴어 subtrahere(빼다, 끌어내다) — 영어 subtraction과 같은 뿌리예요.",
        "ex": {
          "fr": "L'élève maîtrise déjà la soustraction.",
          "ko": "그 학생은 이미 뺄셈을 익혔어요."
        }
      },
      {
        "fr": "l'électron (m.)",
        "ipa": "[elɛktʁɔ̃]",
        "ko": "전자",
        "pos": "n.m.",
        "en": "electron",
        "etym": "그리스어 elektron(호박) — 영어 electron과 같은 뿌리예요.",
        "ex": {
          "fr": "L'électron porte une charge négative.",
          "ko": "전자는 음전하를 띠어요."
        }
      },
      {
        "fr": "le paramètre",
        "ipa": "[paʁamɛtʁ]",
        "ko": "매개 변수, 파라미터, 변수",
        "pos": "n.m.",
        "en": "parameter",
        "etym": "그리스어 para(곁)+metron(측정) — 영어 parameter와 같은 뿌리예요.",
        "ex": {
          "fr": "Il faut tenir compte de tous les paramètres.",
          "ko": "모든 변수를 고려해야 해요."
        }
      },
      {
        "fr": "le cortex",
        "ipa": "[kɔʁtɛks]",
        "ko": "(대뇌) 피질",
        "pos": "n.m.",
        "en": "cortex",
        "etym": "라틴어 cortex(껍질) — 영어 cortex와 같은 뿌리예요.",
        "ex": {
          "fr": "Le cortex est le siège des fonctions supérieures.",
          "ko": "대뇌 피질은 고등 기능의 중심이에요."
        }
      },
      {
        "fr": "l'acception (f.)",
        "ipa": "[aksɛpsjɔ̃]",
        "ko": "(단어의) 뜻, 어의",
        "pos": "n.f.",
        "en": "acceptation (meaning)",
        "etym": "라틴어 acceptio(받아들임)에서 왔어요. 영어 acceptance와 닮았지만, 프랑스어 acception은 '단어의 의미'를 뜻해요. 주의하세요.",
        "ex": {
          "fr": "Ce terme a plusieurs acceptions.",
          "ko": "이 용어는 여러 가지 뜻을 가지고 있어요."
        }
      },
      {
        "fr": "le concret",
        "ipa": "[kɔ̃kʁɛ]",
        "ko": "구체적인 것, 구체성",
        "pos": "n.m.",
        "en": "the concrete",
        "etym": "라틴어 concretus(엉겨 굳은)에서 왔고, 영어 concrete와 같은 뿌리예요. 여기서는 추상에 대비되는 '구체'를 가리켜요.",
        "ex": {
          "fr": "Passons du concret à l'abstrait.",
          "ko": "구체적인 것에서 추상적인 것으로 넘어가 보죠."
        }
      },
      {
        "fr": "le diagnostic",
        "ipa": "[djagnɔstik]",
        "ko": "진단, (상황) 진단·분석",
        "pos": "n.m.",
        "en": "diagnosis",
        "etym": "그리스어 diagignoskein(식별하다)에서 왔어요. 영어 diagnosis와 같은 뿌리예요. 끝의 -c를 발음해요.",
        "ex": {
          "fr": "Le médecin a posé un diagnostic précis.",
          "ko": "의사가 정확한 진단을 내렸어요."
        }
      },
      {
        "fr": "l'anthropologie (f.)",
        "ipa": "[ɑ̃tʁɔpɔlɔʒi]",
        "ko": "인류학",
        "pos": "n.f.",
        "en": "anthropology",
        "etym": "그리스어 anthropos(인간)+logos(학문)에서 왔어요. 영어 anthropology와 같은 뿌리예요.",
        "ex": {
          "fr": "Elle s'est spécialisée en anthropologie culturelle.",
          "ko": "그녀는 문화인류학을 전공했어요."
        }
      },
      {
        "fr": "le parallèle",
        "ipa": "[paʁalɛl]",
        "ko": "유사점, 대비; (지리) 위도선",
        "pos": "n.m.",
        "en": "parallel",
        "etym": "그리스어 parallelos(나란한)에서 왔어요. 영어 parallel과 같은 뿌리예요. 명사로 '비교·대비'를 뜻할 땐 남성이에요.",
        "ex": {
          "fr": "L'auteur établit un parallèle entre les deux époques.",
          "ko": "저자는 두 시대를 서로 대비시켜 비교해요."
        }
      },
      {
        "fr": "l'automatisme (m.)",
        "ipa": "[otomatism]",
        "ko": "자동성, 반사적 행동, 무의식적 습관",
        "pos": "n.m.",
        "en": "automatism",
        "etym": "그리스어 automatos(스스로 움직이는)에서 왔어요. 영어 automatism과 같은 뿌리예요.",
        "ex": {
          "fr": "Avec l'expérience, ces gestes deviennent des automatismes.",
          "ko": "경험이 쌓이면 이런 동작들은 반사적인 습관이 돼요."
        }
      },
      {
        "fr": "la subjectivité",
        "ipa": "[sybʒɛktivite]",
        "ko": "주관성",
        "pos": "n.f.",
        "en": "subjectivity",
        "etym": "라틴어 subjectus(아래에 놓인, 주체)에서 왔어요. 영어 subjectivity와 같은 뿌리예요.",
        "ex": {
          "fr": "Toute interprétation comporte une part de subjectivité.",
          "ko": "모든 해석에는 주관성이 어느 정도 들어 있어요."
        }
      },
      {
        "fr": "la biotechnologie",
        "ipa": "[bjɔtɛknɔlɔʒi]",
        "ko": "생명공학, 바이오테크놀로지",
        "pos": "n.f.",
        "en": "biotechnology",
        "etym": "그리스어 bios(생명)+tekhne(기술)에서 왔어요. 영어 biotechnology와 같은 뿌리예요.",
        "ex": {
          "fr": "La biotechnologie ouvre de nouvelles voies en médecine.",
          "ko": "생명공학은 의학에 새로운 길을 열어줘요."
        }
      },
      {
        "fr": "la plasticité",
        "ipa": "[plastisite]",
        "ko": "가소성, 유연성, (뇌의) 가소성",
        "pos": "n.f.",
        "en": "plasticity",
        "etym": "그리스어 plassein(빚다, 형성하다)에서 왔어요. 영어 plasticity와 같은 뿌리예요.",
        "ex": {
          "fr": "La plasticité cérébrale permet au cerveau de s'adapter.",
          "ko": "뇌 가소성 덕분에 뇌가 적응할 수 있어요."
        }
      }
    ]
  },
  {
    "name": "추상과 시사의 명사",
    "icon": "💭",
    "words": [
      {
        "fr": "l'épidémie (f.)",
        "ipa": "[epidemi]",
        "ko": "전염병, 유행병",
        "pos": "n.f.",
        "en": "epidemic",
        "etym": "그리스어 epi(위에)+dêmos(사람들) — 영어 epidemic과 같은 뿌리예요.",
        "ex": {
          "fr": "L'épidémie s'est propagée à tout le continent.",
          "ko": "전염병이 대륙 전체로 퍼졌어요."
        }
      },
      {
        "fr": "la criminalité",
        "ipa": "[kʁiminalite]",
        "ko": "범죄(율), 범죄 발생",
        "pos": "n.f.",
        "en": "criminality / crime rate",
        "etym": "라틴어 crimen(죄) — 영어 crime과 같은 뿌리예요.",
        "ex": {
          "fr": "La criminalité a légèrement reculé cette année.",
          "ko": "올해 범죄율이 약간 줄었어요."
        }
      },
      {
        "fr": "l'émergence (f.)",
        "ipa": "[emɛʁʒɑ̃s]",
        "ko": "출현, 대두",
        "pos": "n.f.",
        "en": "emergence",
        "etym": "라틴어 emergere(떠오르다) — 영어 emergence와 같은 뿌리예요.",
        "ex": {
          "fr": "On assiste à l'émergence de nouvelles puissances.",
          "ko": "새로운 강국들의 대두를 목격하고 있어요."
        }
      },
      {
        "fr": "le diplômé",
        "ipa": "[diplome]",
        "ko": "(학위) 졸업자, 학위 취득자",
        "pos": "n.m.",
        "ex": {
          "fr": "Les jeunes diplômés peinent à trouver un emploi.",
          "ko": "젊은 졸업자들이 일자리를 찾기 힘들어해요."
        }
      },
      {
        "fr": "l'acquisition (f.)",
        "ipa": "[akizisjɔ̃]",
        "ko": "습득; 취득, 인수",
        "pos": "n.f.",
        "en": "acquisition",
        "etym": "라틴어 acquirere(얻다) — 영어 acquisition과 같은 뿌리예요.",
        "ex": {
          "fr": "L'acquisition d'une langue demande de la patience.",
          "ko": "언어 습득에는 인내가 필요해요."
        }
      },
      {
        "fr": "l'alternative (f.)",
        "ipa": "[altɛʁnativ]",
        "ko": "대안, 양자택일",
        "pos": "n.f.",
        "en": "alternative",
        "etym": "영어 alternative와 같은 뿌리지만, 프랑스어는 흔히 '두 선택지 사이의 선택' 자체를 가리켜요.",
        "ex": {
          "fr": "Il n'existe pas d'alternative crédible à ce projet.",
          "ko": "이 계획을 대신할 만한 신뢰할 대안이 없어요."
        }
      },
      {
        "fr": "le déclin",
        "ipa": "[deklɛ̃]",
        "ko": "쇠퇴, 하락",
        "pos": "n.m.",
        "en": "decline",
        "etym": "라틴어 declinare(기울다) — 영어 decline과 같은 뿌리예요.",
        "ex": {
          "fr": "L'empire était déjà en plein déclin.",
          "ko": "그 제국은 이미 한창 쇠퇴하고 있었어요."
        }
      },
      {
        "fr": "l'orientation (f.)",
        "ipa": "[ɔʁjɑ̃tasjɔ̃]",
        "ko": "방향 설정; (학업·진로) 진로 지도",
        "pos": "n.f.",
        "en": "orientation",
        "ex": {
          "fr": "Le conseiller l'a aidé dans son orientation professionnelle.",
          "ko": "상담사가 그의 진로 결정을 도와줬어요."
        }
      },
      {
        "fr": "l'ampleur (f.)",
        "ipa": "[ɑ̃plœʁ]",
        "ko": "규모, 범위; (사태의) 심각성",
        "pos": "n.f.",
        "ex": {
          "fr": "On mesure mal l'ampleur de la catastrophe.",
          "ko": "재앙의 규모를 제대로 가늠하기 어려워요."
        }
      },
      {
        "fr": "l'adoption (f.)",
        "ipa": "[adɔpsjɔ̃]",
        "ko": "입양; (법·안의) 채택, 가결",
        "pos": "n.f.",
        "en": "adoption",
        "etym": "라틴어 adoptare(택하여 받아들이다) — 영어 adoption과 같은 뿌리예요.",
        "ex": {
          "fr": "L'adoption de la loi a suscité des débats.",
          "ko": "그 법의 채택은 논쟁을 불러일으켰어요."
        }
      },
      {
        "fr": "la sensibilisation",
        "ipa": "[sɑ̃sibilizasjɔ̃]",
        "ko": "(문제에 대한) 의식 고취, 인식 제고",
        "pos": "n.f.",
        "ex": {
          "fr": "Une campagne de sensibilisation au tri des déchets a été lancée.",
          "ko": "쓰레기 분리수거에 대한 인식 제고 캠페인이 시작됐어요."
        }
      },
      {
        "fr": "l'acceptation (f.)",
        "ipa": "[aksɛptasjɔ̃]",
        "ko": "받아들임, 수용",
        "pos": "n.f.",
        "en": "acceptance",
        "etym": "라틴어 acceptare(받아들이다) — 영어 acceptance와 같은 뿌리예요.",
        "ex": {
          "fr": "L'acceptation de soi est essentielle au bien-être.",
          "ko": "자기 수용은 행복에 꼭 필요해요."
        }
      },
      {
        "fr": "l'abus (m.)",
        "ipa": "[aby]",
        "ko": "남용, 오용; 학대",
        "pos": "n.m.",
        "en": "abuse",
        "etym": "라틴어 abusus(잘못된 사용) — 영어 abuse와 같은 뿌리예요. 끝의 s는 발음하지 않아요.",
        "ex": {
          "fr": "L'abus d'alcool nuit à la santé.",
          "ko": "과도한 음주는 건강을 해쳐요."
        }
      },
      {
        "fr": "l'abolition (f.)",
        "ipa": "[abɔlisjɔ̃]",
        "ko": "폐지, 철폐",
        "pos": "n.f.",
        "en": "abolition",
        "etym": "라틴어 abolere(없애다) — 영어 abolition과 같은 뿌리예요.",
        "ex": {
          "fr": "L'abolition de l'esclavage fut une longue lutte.",
          "ko": "노예제 폐지는 오랜 투쟁이었어요."
        }
      },
      {
        "fr": "la suppression",
        "ipa": "[sypʁesjɔ̃]",
        "ko": "삭제, 폐지, (일자리 등의) 감축",
        "pos": "n.f.",
        "en": "suppression / removal",
        "etym": "라틴어 supprimere(억누르다) — 영어 suppression과 같은 뿌리지만, 프랑스어는 흔히 '삭제·폐지'를 뜻해요.",
        "ex": {
          "fr": "La suppression de ces postes a provoqué une grève.",
          "ko": "이 일자리들의 폐지가 파업을 불러왔어요."
        }
      },
      {
        "fr": "le dynamisme",
        "ipa": "[dinamism]",
        "ko": "활력, 역동성",
        "pos": "n.m.",
        "en": "dynamism",
        "etym": "그리스어 dynamis(힘) — 영어 dynamism과 같은 뿌리예요.",
        "ex": {
          "fr": "Le dynamisme de cette région attire les investisseurs.",
          "ko": "이 지역의 역동성이 투자자들을 끌어들여요."
        }
      },
      {
        "fr": "l'extension (f.)",
        "ipa": "[ɛkstɑ̃sjɔ̃]",
        "ko": "확장, 확대",
        "pos": "n.f.",
        "en": "extension",
        "etym": "라틴어 extendere(펼치다) — 영어 extension과 같은 뿌리예요.",
        "ex": {
          "fr": "L'extension du réseau est prévue pour 2027.",
          "ko": "망 확장은 2027년으로 예정돼 있어요."
        }
      },
      {
        "fr": "l'émancipation (f.)",
        "ipa": "[emɑ̃sipasjɔ̃]",
        "ko": "해방, 자립",
        "pos": "n.f.",
        "en": "emancipation",
        "etym": "라틴어 emancipare(자유롭게 하다) — 영어 emancipation과 같은 뿌리예요.",
        "ex": {
          "fr": "Ce mouvement prône l'émancipation des femmes.",
          "ko": "이 운동은 여성의 해방을 주창해요."
        }
      },
      {
        "fr": "la pertinence",
        "ipa": "[pɛʁtinɑ̃s]",
        "ko": "적절성, 타당성",
        "pos": "n.f.",
        "en": "pertinence / relevance",
        "etym": "라틴어 pertinere(관계되다) — 영어 pertinence와 같은 뿌리예요.",
        "ex": {
          "fr": "Personne ne conteste la pertinence de son analyse.",
          "ko": "그의 분석의 타당성을 아무도 반박하지 않아요."
        }
      },
      {
        "fr": "l'interrogation (f.)",
        "ipa": "[ɛ̃teʁɔɡasjɔ̃]",
        "ko": "의문, 물음; (학교) 시험, 쪽지시험",
        "pos": "n.f.",
        "en": "interrogation",
        "etym": "라틴어 interrogare(묻다) — 영어 interrogation과 같은 뿌리지만, 프랑스어는 '의문·질문'이나 '간단한 시험'을 흔히 뜻해요.",
        "ex": {
          "fr": "Cette nouvelle soulève bien des interrogations.",
          "ko": "이 소식은 많은 의문을 불러일으켜요."
        }
      },
      {
        "fr": "la frustration",
        "ipa": "[fʁystʁasjɔ̃]",
        "ko": "좌절감, 욕구 불만",
        "pos": "n.f.",
        "en": "frustration",
        "etym": "라틴어 frustrare(좌절시키다) — 영어 frustration과 같은 뿌리예요.",
        "ex": {
          "fr": "Ce refus a provoqué chez lui une grande frustration.",
          "ko": "그 거절은 그에게 큰 좌절감을 안겼어요."
        }
      },
      {
        "fr": "la conservation",
        "ipa": "[kɔ̃sɛʁvasjɔ̃]",
        "ko": "보존, 보관",
        "pos": "n.f.",
        "en": "conservation",
        "etym": "라틴어 conservare(지키다) — 영어 conservation과 같은 뿌리예요.",
        "ex": {
          "fr": "La conservation des aliments exige du froid.",
          "ko": "식품 보존에는 냉장이 필요해요."
        }
      },
      {
        "fr": "la propagation",
        "ipa": "[pʁɔpaɡasjɔ̃]",
        "ko": "전파, 확산",
        "pos": "n.f.",
        "en": "propagation",
        "etym": "라틴어 propagare(퍼뜨리다) — 영어 propagation과 같은 뿌리예요.",
        "ex": {
          "fr": "On cherche à freiner la propagation du virus.",
          "ko": "바이러스의 확산을 늦추려 하고 있어요."
        }
      },
      {
        "fr": "le renforcement",
        "ipa": "[ʁɑ̃fɔʁsəmɑ̃]",
        "ko": "강화, 보강",
        "pos": "n.m.",
        "en": "reinforcement",
        "ex": {
          "fr": "Le gouvernement a annoncé un renforcement des contrôles.",
          "ko": "정부가 단속 강화를 발표했어요."
        }
      },
      {
        "fr": "l'avortement (m.)",
        "ipa": "[avɔʁtəmɑ̃]",
        "ko": "낙태, 임신 중절; (계획의) 실패",
        "pos": "n.m.",
        "ex": {
          "fr": "Le droit à l'avortement reste un sujet de débat.",
          "ko": "낙태권은 여전히 논쟁거리예요."
        }
      },
      {
        "fr": "l'esclavage (m.)",
        "ipa": "[ɛsklavaʒ]",
        "ko": "노예제, 노예 상태",
        "pos": "n.m.",
        "en": "slavery",
        "etym": "중세 라틴어 sclavus(슬라브인·노예) — 영어 slave와 같은 뿌리예요.",
        "ex": {
          "fr": "L'esclavage a été aboli au XIXe siècle.",
          "ko": "노예제는 19세기에 폐지됐어요."
        }
      },
      {
        "fr": "le détriment",
        "ipa": "[detʁimɑ̃]",
        "ko": "손해, 손실 (주로 au détriment de: ~을 희생하여)",
        "pos": "n.m.",
        "en": "detriment",
        "etym": "라틴어 detrimentum(손상) — 영어 detriment와 같은 뿌리예요.",
        "ex": {
          "fr": "Il privilégie la vitesse au détriment de la qualité.",
          "ko": "그는 품질을 희생해 가며 속도를 우선해요."
        }
      },
      {
        "fr": "l'entraide (f.)",
        "ipa": "[ɑ̃tʁɛd]",
        "ko": "상부상조, 서로 돕기",
        "pos": "n.f.",
        "ex": {
          "fr": "La crise a renforcé l'entraide entre voisins.",
          "ko": "위기가 이웃 간의 상부상조를 강화했어요."
        }
      },
      {
        "fr": "l'enrichissement (m.)",
        "ipa": "[ɑ̃ʁiʃismɑ̃]",
        "ko": "부유해짐; (지적·문화적) 풍요로워짐",
        "pos": "n.m.",
        "ex": {
          "fr": "Ce voyage a été un véritable enrichissement personnel.",
          "ko": "이 여행은 진정한 자기 성장이었어요."
        }
      },
      {
        "fr": "la prétention",
        "ipa": "[pʁetɑ̃sjɔ̃]",
        "ko": "허세, 자만; (~하려는) 주장, 요구",
        "pos": "n.f.",
        "en": "pretension",
        "etym": "라틴어 praetendere(내세우다) — 영어 pretension과 같은 뿌리예요.",
        "ex": {
          "fr": "Ce livre n'a aucune prétention scientifique.",
          "ko": "이 책은 과학적이라고 내세울 의도가 전혀 없어요."
        }
      },
      {
        "fr": "l'impulsion (f.)",
        "ipa": "[ɛ̃pylsjɔ̃]",
        "ko": "충동; 추진력, 자극",
        "pos": "n.f.",
        "en": "impulse / impulsion",
        "etym": "라틴어 impellere(밀다) — 영어 impulse와 같은 뿌리예요.",
        "ex": {
          "fr": "Cette réforme a donné une nouvelle impulsion au secteur.",
          "ko": "이 개혁은 그 분야에 새로운 추진력을 줬어요."
        }
      },
      {
        "fr": "la productivité",
        "ipa": "[pʁɔdyktivite]",
        "ko": "생산성",
        "pos": "n.f.",
        "en": "productivity",
        "etym": "라틴어 producere(만들어 내다) — 영어 productivity와 같은 뿌리예요.",
        "ex": {
          "fr": "Le télétravail a amélioré la productivité de l'équipe.",
          "ko": "재택근무가 팀의 생산성을 높였어요."
        }
      },
      {
        "fr": "la réticence",
        "ipa": "[ʁetisɑ̃s]",
        "ko": "꺼림, 주저, 망설임",
        "pos": "n.f.",
        "en": "reticence",
        "etym": "라틴어 reticere(말하지 않다) — 영어 reticence와 같은 뿌리지만, 프랑스어는 흔히 '꺼림·반감'을 뜻해요.",
        "ex": {
          "fr": "Il a accepté la proposition sans réticence.",
          "ko": "그는 망설임 없이 그 제안을 받아들였어요."
        }
      },
      {
        "fr": "la collaboration",
        "ipa": "[kɔlabɔʁasjɔ̃]",
        "ko": "협력, 공동 작업",
        "pos": "n.f.",
        "en": "collaboration",
        "etym": "라틴어 com(함께)+laborare(일하다) — 영어 collaboration과 같은 뿌리예요.",
        "ex": {
          "fr": "Ce projet est le fruit d'une longue collaboration.",
          "ko": "이 프로젝트는 오랜 협력의 결실이에요."
        }
      },
      {
        "fr": "le tenant",
        "ipa": "[tənɑ̃]",
        "ko": "(어떤 입장의) 지지자, 옹호자",
        "pos": "n.m.",
        "etym": "동사 tenir(쥐다, 지키다)에서 왔어요. 흔히 'les tenants et les aboutissants(전말, 자초지종)' 표현으로 쓰여요.",
        "ex": {
          "fr": "Les tenants de cette théorie restent minoritaires.",
          "ko": "이 이론의 옹호자들은 여전히 소수예요."
        }
      },
      {
        "fr": "l'humiliation (f.)",
        "ipa": "[ymiljasjɔ̃]",
        "ko": "굴욕, 모욕",
        "pos": "n.f.",
        "en": "humiliation",
        "etym": "라틴어 humilis(낮은, 겸손한) — 영어 humiliation과 같은 뿌리예요.",
        "ex": {
          "fr": "Cette défaite a été vécue comme une humiliation.",
          "ko": "이 패배는 굴욕처럼 느껴졌어요."
        }
      },
      {
        "fr": "la confusion",
        "ipa": "[kɔ̃fyzjɔ̃]",
        "ko": "혼란, 혼동",
        "pos": "n.f.",
        "en": "confusion",
        "etym": "라틴어 confundere(섞다) — 영어 confusion과 같은 뿌리예요.",
        "ex": {
          "fr": "Une grande confusion régnait après l'annonce.",
          "ko": "발표 후에 큰 혼란이 감돌았어요."
        }
      },
      {
        "fr": "la mortalité",
        "ipa": "[mɔʁtalite]",
        "ko": "사망률, 사망",
        "pos": "n.f.",
        "en": "mortality",
        "etym": "라틴어 mors(죽음) — 영어 mortality와 같은 뿌리예요.",
        "ex": {
          "fr": "Le taux de mortalité a baissé ces dernières années.",
          "ko": "최근 몇 년 사이 사망률이 낮아졌어요."
        }
      },
      {
        "fr": "la limitation",
        "ipa": "[limitasjɔ̃]",
        "ko": "제한, 한정",
        "pos": "n.f.",
        "en": "limitation",
        "etym": "라틴어 limes(경계) — 영어 limitation과 같은 뿌리예요.",
        "ex": {
          "fr": "Une limitation de vitesse s'applique sur cette route.",
          "ko": "이 도로에는 속도 제한이 적용돼요."
        }
      },
      {
        "fr": "l'obésité (f.)",
        "ipa": "[ɔbezite]",
        "ko": "비만",
        "pos": "n.f.",
        "en": "obesity",
        "etym": "라틴어 obesus(살찐) — 영어 obesity와 같은 뿌리예요.",
        "ex": {
          "fr": "L'obésité est devenue un enjeu de santé publique.",
          "ko": "비만은 공중 보건의 과제가 되었어요."
        }
      },
      {
        "fr": "l'ignorance (f.)",
        "ipa": "[iɲɔʁɑ̃s]",
        "ko": "무지, 모름",
        "pos": "n.f.",
        "en": "ignorance",
        "etym": "라틴어 ignorare(모르다) — 영어 ignorance와 같은 뿌리예요.",
        "ex": {
          "fr": "L'ignorance des règles ne dispense pas de les respecter.",
          "ko": "규칙을 모른다고 해서 지키지 않아도 되는 건 아니에요."
        }
      },
      {
        "fr": "l'imposition (f.)",
        "ipa": "[ɛ̃pozisjɔ̃]",
        "ko": "과세, 부과",
        "pos": "n.f.",
        "en": "imposition",
        "etym": "faux ami 주의: 영어 imposition은 '강요·폐'를 뜻하지만, 프랑스어에서는 주로 '세금 부과(과세)'를 가리켜요.",
        "ex": {
          "fr": "Le barème d'imposition a été révisé cette année.",
          "ko": "올해 과세 기준표가 개정되었어요."
        }
      },
      {
        "fr": "la perception",
        "ipa": "[pɛʁsɛpsjɔ̃]",
        "ko": "지각, 인식; (세금) 징수",
        "pos": "n.f.",
        "en": "perception",
        "etym": "라틴어 percipere(붙잡다, 알아채다) — 영어 perception과 같은 뿌리예요. 프랑스어에서는 '세금 징수'라는 뜻도 있어요.",
        "ex": {
          "fr": "Sa perception de la situation a changé.",
          "ko": "상황에 대한 그의 인식이 바뀌었어요."
        }
      },
      {
        "fr": "l'avant-garde (f.)",
        "ipa": "[avɑ̃ɡaʁd]",
        "ko": "전위, 아방가르드, 선봉",
        "pos": "n.f.",
        "en": "avant-garde",
        "etym": "프랑스어 avant(앞)+garde(부대)에서 왔고, 영어 avant-garde도 그대로 빌려 갔어요.",
        "ex": {
          "fr": "Ce peintre appartient à l'avant-garde des années 1920.",
          "ko": "이 화가는 1920년대 전위 예술에 속해요."
        }
      },
      {
        "fr": "l'invasion (f.)",
        "ipa": "[ɛ̃vazjɔ̃]",
        "ko": "침략, 침입",
        "pos": "n.f.",
        "en": "invasion",
        "etym": "라틴어 invadere(쳐들어가다) — 영어 invasion과 같은 뿌리예요.",
        "ex": {
          "fr": "L'invasion a provoqué un exode massif.",
          "ko": "침략은 대규모 피난을 불러일으켰어요."
        }
      },
      {
        "fr": "le complément",
        "ipa": "[kɔ̃plemɑ̃]",
        "ko": "보충, 보완; (문법) 보어",
        "pos": "n.m.",
        "en": "complement",
        "etym": "faux ami 주의: 영어 compliment(칭찬)과 헷갈리기 쉬워요. complément은 '보충·보완'이에요.",
        "ex": {
          "fr": "Ce stage est un complément utile à la formation.",
          "ko": "이 실습은 교육 과정에 유용한 보완이에요."
        }
      },
      {
        "fr": "la provenance",
        "ipa": "[pʁɔvnɑ̃s]",
        "ko": "출처, 원산지",
        "pos": "n.f.",
        "etym": "동사 provenir(~에서 비롯되다)에서 왔어요. 'en provenance de(~발의)' 표현으로 자주 써요.",
        "ex": {
          "fr": "Il faut vérifier la provenance de ces produits.",
          "ko": "이 제품들의 출처를 확인해야 해요."
        }
      },
      {
        "fr": "la vaccination",
        "ipa": "[vaksinasjɔ̃]",
        "ko": "예방 접종, 백신 접종",
        "pos": "n.f.",
        "en": "vaccination",
        "etym": "라틴어 vacca(암소) — 우두에서 유래했고, 영어 vaccination과 같은 뿌리예요.",
        "ex": {
          "fr": "La vaccination reste le meilleur moyen de prévention.",
          "ko": "예방 접종은 여전히 최선의 예방책이에요."
        }
      },
      {
        "fr": "le tabou",
        "ipa": "[tabu]",
        "ko": "금기, 터부",
        "pos": "n.m.",
        "en": "taboo",
        "etym": "폴리네시아어 tabu에서 왔고, 영어 taboo와 같은 뿌리예요.",
        "ex": {
          "fr": "Ce sujet reste un tabou dans bien des familles.",
          "ko": "이 주제는 많은 가정에서 여전히 금기예요."
        }
      },
      {
        "fr": "la fatalité",
        "ipa": "[fatalite]",
        "ko": "숙명, 불가피한 운명",
        "pos": "n.f.",
        "en": "fatality",
        "etym": "faux ami 주의: 영어 fatality는 보통 '사망(자)'을 뜻하지만, 프랑스어 fatalité는 '피할 수 없는 숙명'이에요.",
        "ex": {
          "fr": "La pauvreté n'est pas une fatalité.",
          "ko": "가난은 피할 수 없는 숙명이 아니에요."
        }
      },
      {
        "fr": "la vérification",
        "ipa": "[veʁifikasjɔ̃]",
        "ko": "확인, 검증",
        "pos": "n.f.",
        "en": "verification",
        "etym": "라틴어 verus(참된)+facere(만들다) — 영어 verification과 같은 뿌리예요.",
        "ex": {
          "fr": "Une vérification s'impose avant la publication.",
          "ko": "발표 전에 검증이 꼭 필요해요."
        }
      },
      {
        "fr": "la télécommunication",
        "ipa": "[telekɔmynikasjɔ̃]",
        "ko": "원격 통신, 전기 통신",
        "pos": "n.f.",
        "en": "telecommunication",
        "etym": "그리스어 tele(멀리)+라틴어 communicare(전하다) — 영어 telecommunication과 같은 뿌리예요. 흔히 복수 télécommunications로 써요.",
        "ex": {
          "fr": "Le secteur des télécommunications connaît une forte croissance.",
          "ko": "통신 부문은 큰 성장을 겪고 있어요."
        }
      },
      {
        "fr": "l'anomalie (f.)",
        "ipa": "[anɔmali]",
        "ko": "이상, 변칙, 비정상",
        "pos": "n.f.",
        "en": "anomaly",
        "etym": "그리스어 an(부정)+homalos(고른) — 영어 anomaly와 같은 뿌리예요.",
        "ex": {
          "fr": "Les techniciens ont détecté une anomalie dans le système.",
          "ko": "기술자들이 시스템에서 이상을 발견했어요."
        }
      },
      {
        "fr": "la libéralisation",
        "ipa": "[libeʁalizasjɔ̃]",
        "ko": "자유화",
        "pos": "n.f.",
        "en": "liberalization",
        "etym": "라틴어 liber(자유로운) — 영어 liberalization과 같은 뿌리예요. 주로 경제·시장 문맥에서 써요.",
        "ex": {
          "fr": "La libéralisation du marché a fait baisser les prix.",
          "ko": "시장 자유화로 가격이 내려갔어요."
        }
      },
      {
        "fr": "l'isolement (m.)",
        "ipa": "[izɔlmɑ̃]",
        "ko": "고립, 격리",
        "pos": "n.m.",
        "etym": "동사 isoler(고립시키다)에서 왔어요. 영어 isolation과 같은 라틴어 insula(섬) 뿌리예요.",
        "ex": {
          "fr": "L'isolement des personnes âgées est un vrai problème.",
          "ko": "노인들의 고립은 정말 심각한 문제예요."
        }
      },
      {
        "fr": "l'impuissance (f.)",
        "ipa": "[ɛ̃pɥisɑ̃s]",
        "ko": "무력함, 무능",
        "pos": "n.f.",
        "etym": "in(부정)+puissance(힘)에서 왔어요. 영어 impotence와 같은 라틴어 posse(할 수 있다) 뿌리예요.",
        "ex": {
          "fr": "Il ressentait une profonde impuissance face à la situation.",
          "ko": "그는 상황 앞에서 깊은 무력감을 느꼈어요."
        }
      },
      {
        "fr": "la filiation",
        "ipa": "[filjasjɔ̃]",
        "ko": "혈통, 계보, 친자 관계",
        "pos": "n.f.",
        "etym": "라틴어 filius(아들) — 영어 filial(자식의)과 같은 뿌리예요.",
        "ex": {
          "fr": "Ce roman explore la filiation entre trois générations.",
          "ko": "이 소설은 세 세대 사이의 혈통을 탐구해요."
        }
      },
      {
        "fr": "l'extraction (f.)",
        "ipa": "[ɛkstʁaksjɔ̃]",
        "ko": "추출, 채굴",
        "pos": "n.f.",
        "en": "extraction",
        "etym": "라틴어 ex(밖)+trahere(끌다) — 영어 extraction과 같은 뿌리예요.",
        "ex": {
          "fr": "L'extraction du minerai pollue les rivières.",
          "ko": "광석 채굴이 강을 오염시켜요."
        }
      },
      {
        "fr": "l'exportation (f.)",
        "ipa": "[ɛkspɔʁtasjɔ̃]",
        "ko": "수출",
        "pos": "n.f.",
        "en": "exportation",
        "etym": "라틴어 ex(밖)+portare(나르다) — 영어 export과 같은 뿌리예요.",
        "ex": {
          "fr": "Les exportations agricoles ont progressé cette année.",
          "ko": "올해 농산물 수출이 늘었어요."
        }
      },
      {
        "fr": "la finesse",
        "ipa": "[finɛs]",
        "ko": "섬세함, 정교함, 예리함",
        "pos": "n.f.",
        "etym": "형용사 fin(가는, 섬세한)에서 왔어요. 영어 finesse도 여기서 빌려 갔어요.",
        "ex": {
          "fr": "Il analyse les situations avec beaucoup de finesse.",
          "ko": "그는 상황을 아주 예리하게 분석해요."
        }
      },
      {
        "fr": "la mention",
        "ipa": "[mɑ̃sjɔ̃]",
        "ko": "언급, 기재; (시험의) 우등 등급",
        "pos": "n.f.",
        "en": "mention",
        "etym": "라틴어 mentio(언급) — 영어 mention과 같은 뿌리예요. 프랑스어에서는 '시험 우등(mention bien 등)' 뜻도 있어요.",
        "ex": {
          "fr": "Elle a obtenu son diplôme avec mention.",
          "ko": "그녀는 우등으로 학위를 받았어요."
        }
      },
      {
        "fr": "l'échéance (f.)",
        "ipa": "[eʃeɑ̃s]",
        "ko": "만기, 기한, 마감일",
        "pos": "n.f.",
        "etym": "동사 échoir(만기가 되다)에서 왔어요. 금융·정치 문맥에서 '기한, 중대한 시점'으로 자주 써요.",
        "ex": {
          "fr": "Le paiement doit être effectué avant l'échéance.",
          "ko": "결제는 만기 전에 이루어져야 해요."
        }
      },
      {
        "fr": "le sacrement",
        "ipa": "[sakʁəmɑ̃]",
        "ko": "성사, 성례",
        "pos": "n.m.",
        "en": "sacrament",
        "etym": "라틴어 sacer(신성한) — 영어 sacrament와 같은 뿌리예요. 가톨릭 종교 용어예요.",
        "ex": {
          "fr": "Le baptême est le premier sacrement.",
          "ko": "세례는 첫 번째 성사예요."
        }
      },
      {
        "fr": "l'éventualité (f.)",
        "ipa": "[evɑ̃tɥalite]",
        "ko": "가능성, 만일의 경우",
        "pos": "n.f.",
        "en": "eventuality",
        "etym": "faux ami 주의: 영어 eventually(결국)와 헷갈리기 쉬워요. éventualité는 '일어날 수도 있는 가능성'이에요.",
        "ex": {
          "fr": "Il faut prévoir cette éventualité.",
          "ko": "이런 가능성에 대비해야 해요."
        }
      },
      {
        "fr": "l'empressement (m.)",
        "ipa": "[ɑ̃pʁɛsmɑ̃]",
        "ko": "서두름, 열성, 적극성",
        "pos": "n.m.",
        "etym": "동사 s'empresser(서둘러 ~하다)에서 왔어요. 친절히 앞장서는 '열성'을 가리켜요.",
        "ex": {
          "fr": "Il a accepté avec empressement.",
          "ko": "그는 흔쾌히 서둘러 수락했어요."
        }
      },
      {
        "fr": "l'endormissement (m.)",
        "ipa": "[ɑ̃dɔʁmismɑ̃]",
        "ko": "잠듦, 입면",
        "pos": "n.m.",
        "etym": "동사 s'endormir(잠들다)에서 왔어요. 잠에 빠져드는 과정을 가리켜요.",
        "ex": {
          "fr": "Une lumière douce facilite l'endormissement.",
          "ko": "은은한 빛이 잠드는 데 도움이 돼요."
        }
      },
      {
        "fr": "la radiation",
        "ipa": "[ʁadjasjɔ̃]",
        "ko": "방사, 복사; (명단에서) 삭제·제명",
        "pos": "n.f.",
        "en": "radiation",
        "etym": "라틴어 radius(광선) — 영어 radiation과 같은 뿌리예요. 프랑스어에서는 '명단 제명'이라는 뜻도 있어요.",
        "ex": {
          "fr": "La radiation solaire est plus forte en altitude.",
          "ko": "태양 복사는 고지대에서 더 강해요."
        }
      },
      {
        "fr": "le surcoût",
        "ipa": "[syʁku]",
        "ko": "추가 비용, 초과 비용",
        "pos": "n.m.",
        "etym": "접두사 sur(위, 초과)+coût(비용)에서 왔어요.",
        "ex": {
          "fr": "Ce retard entraîne un surcoût important.",
          "ko": "이 지연으로 상당한 추가 비용이 발생해요."
        }
      },
      {
        "fr": "le diabète",
        "ipa": "[djabɛt]",
        "ko": "당뇨병",
        "pos": "n.m.",
        "en": "diabetes",
        "etym": "그리스어 diabainein(가로질러 통과하다) — 영어 diabetes와 같은 뿌리예요.",
        "ex": {
          "fr": "Il doit surveiller son alimentation à cause de son diabète.",
          "ko": "그는 당뇨병 때문에 식단을 관리해야 해요."
        }
      },
      {
        "fr": "la firme",
        "ipa": "[fiʁm]",
        "ko": "회사, 기업",
        "pos": "n.f.",
        "en": "firm",
        "etym": "라틴어 firmus(견고한) — 영어 firm과 같은 뿌리예요. 특히 큰 기업을 가리키는 격식 있는 말이에요.",
        "ex": {
          "fr": "Cette firme domine le marché mondial.",
          "ko": "이 기업은 세계 시장을 지배해요."
        }
      },
      {
        "fr": "l'éloignement (m.)",
        "ipa": "[elwaɲmɑ̃]",
        "ko": "멀어짐, 거리감, 격리",
        "pos": "n.m.",
        "etym": "동사 éloigner(멀어지게 하다)에서 왔어요. 물리적·심리적 거리 모두에 써요.",
        "ex": {
          "fr": "L'éloignement de sa famille lui pèse.",
          "ko": "가족과 떨어져 있는 것이 그에게 부담이 돼요."
        }
      },
      {
        "fr": "la spéculation",
        "ipa": "[spekylasjɔ̃]",
        "ko": "투기; 사변, 추측",
        "pos": "n.f.",
        "en": "speculation",
        "etym": "라틴어 speculari(관찰하다) — 영어 speculation과 같은 뿌리예요. 경제의 '투기'와 사고의 '사변' 둘 다 뜻해요.",
        "ex": {
          "fr": "La spéculation immobilière fait flamber les prix.",
          "ko": "부동산 투기가 가격을 치솟게 해요."
        }
      },
      {
        "fr": "l'emprise (f.)",
        "ipa": "[ɑ̃pʁiz]",
        "ko": "지배력, 영향력, 장악",
        "pos": "n.f.",
        "etym": "동사 emprendre의 옛 분사에서 왔어요. 누군가를 휘어잡는 '심리적 지배'를 뜻해요.",
        "ex": {
          "fr": "Elle a fini par échapper à l'emprise de cet homme.",
          "ko": "그녀는 결국 그 남자의 지배에서 벗어났어요."
        }
      },
      {
        "fr": "la contingence",
        "ipa": "[kɔ̃tɛ̃ʒɑ̃s]",
        "ko": "우연성, 불확정성",
        "pos": "n.f.",
        "en": "contingency",
        "etym": "라틴어 contingere(닿다, 일어나다)에서 왔어요. 영어 contingency와 같은 뿌리예요.",
        "ex": {
          "fr": "Le philosophe insiste sur la contingence de toute existence.",
          "ko": "그 철학자는 모든 존재의 우연성을 강조해요."
        }
      },
      {
        "fr": "l'incidence (f.)",
        "ipa": "[ɛ̃sidɑ̃s]",
        "ko": "영향, 파급, 발생률",
        "pos": "n.f.",
        "en": "incidence",
        "etym": "라틴어 incidere(생기다)에서 왔어요. 영어 incidence와 같은 뿌리지만, 프랑스어에서는 '영향'의 뜻이 더 흔해요.",
        "ex": {
          "fr": "Cette mesure aura une forte incidence sur l'emploi.",
          "ko": "이 조치는 고용에 큰 영향을 미칠 거예요."
        }
      },
      {
        "fr": "l'émigration (f.)",
        "ipa": "[emiɡʁasjɔ̃]",
        "ko": "이주, 국외 이주",
        "pos": "n.f.",
        "en": "emigration",
        "etym": "라틴어 emigrare(떠나가다)에서 왔어요. 영어 emigration과 같은 뿌리로, 자기 나라를 '떠나는' 이주를 말해요.",
        "ex": {
          "fr": "L'émigration des jeunes inquiète le pays.",
          "ko": "젊은이들의 국외 이주가 그 나라를 걱정시키고 있어요."
        }
      },
      {
        "fr": "la retombée",
        "ipa": "[ʁətɔ̃be]",
        "ko": "여파, 파급 효과",
        "pos": "n.f.",
        "ex": {
          "fr": "Les retombées économiques du festival sont énormes.",
          "ko": "그 축제의 경제적 파급 효과는 엄청나요."
        }
      },
      {
        "fr": "la solidité",
        "ipa": "[sɔlidite]",
        "ko": "견고함, 탄탄함",
        "pos": "n.f.",
        "en": "solidity",
        "etym": "라틴어 solidus(단단한)에서 왔고, 영어 solidity와 같은 뿌리예요.",
        "ex": {
          "fr": "On admire la solidité de son argumentation.",
          "ko": "사람들은 그의 논증의 탄탄함에 감탄해요."
        }
      },
      {
        "fr": "le dessein",
        "ipa": "[desɛ̃]",
        "ko": "의도, 계획",
        "pos": "n.m.",
        "en": "design (intention)",
        "etym": "옛 프랑스어 dessein에서 왔어요. 영어 design과 같은 뿌리지만, 프랑스어에서는 '의도·계획'의 문어적 뜻이에요. 그림 '데생'은 dessin이니 혼동하지 마세요.",
        "ex": {
          "fr": "Il a formé le dessein de tout abandonner.",
          "ko": "그는 모든 것을 버리겠다는 계획을 세웠어요."
        }
      },
      {
        "fr": "le stéréotype",
        "ipa": "[steʁeɔtip]",
        "ko": "고정관념, 상투형",
        "pos": "n.m.",
        "en": "stereotype",
        "etym": "그리스어 stereos(단단한)+typos(형)에서 왔고, 영어 stereotype와 같은 뿌리예요.",
        "ex": {
          "fr": "Ce film renforce de nombreux stéréotypes.",
          "ko": "이 영화는 수많은 고정관념을 강화해요."
        }
      },
      {
        "fr": "le rendement",
        "ipa": "[ʁɑ̃dmɑ̃]",
        "ko": "수익률, 생산성",
        "pos": "n.m.",
        "ex": {
          "fr": "Le rendement de cette usine a doublé.",
          "ko": "이 공장의 생산성이 두 배가 됐어요."
        }
      },
      {
        "fr": "le glissement",
        "ipa": "[ɡlismɑ̃]",
        "ko": "미끄러짐, (의미의) 변화",
        "pos": "n.m.",
        "ex": {
          "fr": "On observe un glissement de sens de ce mot.",
          "ko": "이 단어의 의미가 점차 변화하는 게 보여요."
        }
      },
      {
        "fr": "la répercussion",
        "ipa": "[ʁepɛʁkysjɔ̃]",
        "ko": "여파, 반향",
        "pos": "n.f.",
        "en": "repercussion",
        "etym": "라틴어 repercutere(되튕기다)에서 왔고, 영어 repercussion과 같은 뿌리예요.",
        "ex": {
          "fr": "La crise a eu des répercussions mondiales.",
          "ko": "그 위기는 전 세계적인 여파를 미쳤어요."
        }
      },
      {
        "fr": "l'avancée (f.)",
        "ipa": "[avɑ̃se]",
        "ko": "진전, 발전",
        "pos": "n.f.",
        "ex": {
          "fr": "Cette découverte est une avancée majeure.",
          "ko": "이 발견은 중대한 진전이에요."
        }
      },
      {
        "fr": "le biais",
        "ipa": "[bjɛ]",
        "ko": "편향, 치우침; 방법",
        "pos": "n.m.",
        "en": "bias",
        "etym": "프로방스어 biais(비스듬함)에서 왔고, 영어 bias와 같은 뿌리예요. 'par le biais de'는 '~을 통해서'라는 뜻이에요.",
        "ex": {
          "fr": "Cette étude souffre d'un biais méthodologique.",
          "ko": "이 연구는 방법론적 편향을 안고 있어요."
        }
      },
      {
        "fr": "l'aune (f.)",
        "ipa": "[on]",
        "ko": "잣대, 척도 (옛 길이 단위)",
        "pos": "n.f.",
        "ex": {
          "fr": "On ne peut juger l'art à l'aune de l'argent.",
          "ko": "예술을 돈이라는 잣대로 판단할 수는 없어요."
        }
      },
      {
        "fr": "l'expatriation (f.)",
        "ipa": "[ɛkspatʁijasjɔ̃]",
        "ko": "국외 이주, 해외 파견",
        "pos": "n.f.",
        "en": "expatriation",
        "etym": "라틴어 ex-(밖으로)+patria(조국)에서 왔고, 영어 expatriation과 같은 뿌리예요.",
        "ex": {
          "fr": "L'expatriation est devenue courante chez les cadres.",
          "ko": "해외 파견은 간부들 사이에서 흔한 일이 됐어요."
        }
      },
      {
        "fr": "la consécration",
        "ipa": "[kɔ̃sekʁasjɔ̃]",
        "ko": "공인, (지위의) 확립; 봉헌",
        "pos": "n.f.",
        "en": "consecration",
        "etym": "라틴어 consecrare(봉헌하다)에서 왔고, 영어 consecration과 같은 뿌리예요.",
        "ex": {
          "fr": "Ce prix marque la consécration de sa carrière.",
          "ko": "이 상은 그의 경력이 정점에 올랐음을 보여줘요."
        }
      },
      {
        "fr": "le repérage",
        "ipa": "[ʁəpeʁaʒ]",
        "ko": "위치 파악, 사전 답사",
        "pos": "n.m.",
        "ex": {
          "fr": "L'équipe a fait un repérage avant le tournage.",
          "ko": "촬영 전에 팀이 사전 답사를 했어요."
        }
      },
      {
        "fr": "la détente",
        "ipa": "[detɑ̃t]",
        "ko": "긴장 완화, 휴식",
        "pos": "n.f.",
        "ex": {
          "fr": "Les deux pays cherchent une détente diplomatique.",
          "ko": "두 나라는 외교적 긴장 완화를 모색하고 있어요."
        }
      },
      {
        "fr": "la classification",
        "ipa": "[klasifikasjɔ̃]",
        "ko": "분류, 분류 체계",
        "pos": "n.f.",
        "en": "classification",
        "etym": "라틴어 classis(부류)에서 왔고, 영어 classification과 같은 뿌리예요.",
        "ex": {
          "fr": "Cette classification des espèces est dépassée.",
          "ko": "이 종(種) 분류 체계는 시대에 뒤떨어졌어요."
        }
      },
      {
        "fr": "l'expertise (f.)",
        "ipa": "[ɛkspɛʁtiz]",
        "ko": "전문성, 감정(鑑定)",
        "pos": "n.f.",
        "en": "expertise",
        "etym": "라틴어 expertus(경험 많은)에서 왔고, 영어 expertise와 같은 뿌리예요.",
        "ex": {
          "fr": "Son expertise dans ce domaine est reconnue.",
          "ko": "이 분야에서 그의 전문성은 인정받고 있어요."
        }
      },
      {
        "fr": "la prudence",
        "ipa": "[pʁydɑ̃s]",
        "ko": "신중함, 조심",
        "pos": "n.f.",
        "en": "prudence",
        "etym": "라틴어 prudentia(분별)에서 왔고, 영어 prudence와 같은 뿌리예요.",
        "ex": {
          "fr": "Les experts recommandent la plus grande prudence.",
          "ko": "전문가들은 최대한의 신중함을 권고해요."
        }
      },
      {
        "fr": "la dérogation",
        "ipa": "[deʁɔɡasjɔ̃]",
        "ko": "예외 인정, 특례",
        "pos": "n.f.",
        "en": "derogation",
        "etym": "라틴어 derogare(법의 일부를 폐지하다)에서 왔고, 영어 derogation과 같은 뿌리예요.",
        "ex": {
          "fr": "Il a obtenu une dérogation exceptionnelle.",
          "ko": "그는 예외적인 특례를 받았어요."
        }
      },
      {
        "fr": "le snobisme",
        "ipa": "[snɔbism]",
        "ko": "속물근성, 허세",
        "pos": "n.m.",
        "en": "snobbery",
        "etym": "영어 snob에서 온 차용어로, 영어 snobbism과 같은 뿌리예요.",
        "ex": {
          "fr": "Son snobisme agace tout le monde.",
          "ko": "그의 속물근성이 모두를 짜증나게 해요."
        }
      },
      {
        "fr": "la capture",
        "ipa": "[kaptyʁ]",
        "ko": "포획, 체포; 캡처",
        "pos": "n.f.",
        "en": "capture",
        "etym": "라틴어 capere(붙잡다)에서 왔고, 영어 capture와 같은 뿌리예요.",
        "ex": {
          "fr": "La capture du fugitif a duré des semaines.",
          "ko": "도주자 체포에는 몇 주가 걸렸어요."
        }
      },
      {
        "fr": "la confession",
        "ipa": "[kɔ̃fesjɔ̃]",
        "ko": "고백, 고해; 신앙 고백",
        "pos": "n.f.",
        "en": "confession",
        "etym": "라틴어 confiteri(고백하다)에서 왔고, 영어 confession과 같은 뿌리예요.",
        "ex": {
          "fr": "Ce livre est une longue confession intime.",
          "ko": "이 책은 긴 내밀한 고백이에요."
        }
      },
      {
        "fr": "la faille",
        "ipa": "[faj]",
        "ko": "결함, 허점; 단층",
        "pos": "n.f.",
        "ex": {
          "fr": "Les pirates ont exploité une faille de sécurité.",
          "ko": "해커들이 보안 허점을 파고들었어요."
        }
      },
      {
        "fr": "l'hydratation (f.)",
        "ipa": "[idʁatasjɔ̃]",
        "ko": "수분 공급, 수화",
        "pos": "n.f.",
        "en": "hydration",
        "etym": "그리스어 hydor(물)에서 왔고, 영어 hydration과 같은 뿌리예요.",
        "ex": {
          "fr": "Une bonne hydratation est essentielle en été.",
          "ko": "여름에는 충분한 수분 공급이 필수예요."
        }
      },
      {
        "fr": "la décomposition",
        "ipa": "[dekɔ̃pozisjɔ̃]",
        "ko": "분해, 해체, 부패",
        "pos": "n.f.",
        "en": "decomposition",
        "etym": "라틴어 de(분리)+componere(조립하다) — 영어 decomposition과 같은 뿌리예요. '조립을 풀다'라는 뜻이에요.",
        "ex": {
          "fr": "La décomposition du problème en étapes facilite l'analyse.",
          "ko": "문제를 단계별로 분해하면 분석이 쉬워져요."
        }
      },
      {
        "fr": "la posture",
        "ipa": "[pɔstyʁ]",
        "ko": "자세, (비유) 입장·태도",
        "pos": "n.f.",
        "en": "posture",
        "etym": "라틴어 ponere(놓다)에서 왔어요. 영어 posture와 같은 뿌리지만, 프랑스어에서는 '정치적 입장' 같은 비유적 뜻으로도 자주 써요.",
        "ex": {
          "fr": "Le ministre a adopté une posture défensive.",
          "ko": "장관은 방어적인 태도를 취했어요."
        }
      },
      {
        "fr": "le rapporteur",
        "ipa": "[ʁapɔʁtœʁ]",
        "ko": "(위원회의) 보고 담당자, 보고자",
        "pos": "n.m.",
        "ex": {
          "fr": "Le rapporteur a présenté ses conclusions devant la commission.",
          "ko": "보고 담당자가 위원회 앞에서 결론을 발표했어요."
        }
      },
      {
        "fr": "la rétribution",
        "ipa": "[ʁetʁibysjɔ̃]",
        "ko": "보수, 보상",
        "pos": "n.f.",
        "en": "retribution",
        "etym": "라틴어 retribuere(되돌려 주다)에서 왔어요. 영어 retribution은 '응징'이라는 부정적 뜻이지만, 프랑스어 rétribution은 '노동에 대한 보수'라는 중립적 뜻이에요. 가짜 친구(faux ami)에 주의하세요.",
        "ex": {
          "fr": "Il attend une juste rétribution de son travail.",
          "ko": "그는 자기 일에 대한 정당한 보수를 기대해요."
        }
      },
      {
        "fr": "le traumatisme",
        "ipa": "[tʁomatism]",
        "ko": "외상, 트라우마, 정신적 충격",
        "pos": "n.m.",
        "en": "trauma",
        "etym": "그리스어 trauma(상처)에서 왔어요. 영어 trauma와 같은 뿌리예요.",
        "ex": {
          "fr": "La guerre a laissé un profond traumatisme chez les survivants.",
          "ko": "전쟁은 생존자들에게 깊은 트라우마를 남겼어요."
        }
      },
      {
        "fr": "le baril",
        "ipa": "[baʁil]",
        "ko": "(석유 등의) 배럴, 통",
        "pos": "n.m.",
        "en": "barrel",
        "etym": "영어 barrel과 같은 뿌리예요. 끝의 -l을 발음해요.",
        "ex": {
          "fr": "Le prix du baril de pétrole a fortement augmenté.",
          "ko": "석유 한 배럴의 가격이 크게 올랐어요."
        }
      },
      {
        "fr": "le surcroît",
        "ipa": "[syʁkʁwa]",
        "ko": "추가분, 증가분",
        "pos": "n.m.",
        "ex": {
          "fr": "Ce projet demande un surcroît de travail considérable.",
          "ko": "이 프로젝트는 상당한 추가 작업을 요구해요."
        }
      },
      {
        "fr": "la trajectoire",
        "ipa": "[tʁaʒɛktwaʁ]",
        "ko": "궤적, (인생·경력의) 행로",
        "pos": "n.f.",
        "en": "trajectory",
        "etym": "라틴어 trajicere(가로질러 던지다)에서 왔어요. 영어 trajectory와 같은 뿌리예요.",
        "ex": {
          "fr": "Sa trajectoire professionnelle est exemplaire.",
          "ko": "그의 경력 행로는 모범적이에요."
        }
      },
      {
        "fr": "l'inhibition (f.)",
        "ipa": "[inibisjɔ̃]",
        "ko": "억제, 위축, 심리적 억압",
        "pos": "n.f.",
        "en": "inhibition",
        "etym": "라틴어 inhibere(막다)에서 왔어요. 영어 inhibition과 같은 뿌리예요.",
        "ex": {
          "fr": "Il parle sans aucune inhibition devant le public.",
          "ko": "그는 청중 앞에서 전혀 위축되지 않고 말해요."
        }
      },
      {
        "fr": "le tremblement",
        "ipa": "[tʁɑ̃bləmɑ̃]",
        "ko": "떨림, 진동; (de terre) 지진",
        "pos": "n.m.",
        "ex": {
          "fr": "Un tremblement de terre a secoué la région cette nuit.",
          "ko": "오늘 밤 지진이 그 지역을 뒤흔들었어요."
        }
      },
      {
        "fr": "la visée",
        "ipa": "[vize]",
        "ko": "목표, 의도, 지향",
        "pos": "n.f.",
        "ex": {
          "fr": "Ce parti a des visées hégémoniques sur la région.",
          "ko": "이 정당은 그 지역에 대한 패권적 의도를 품고 있어요."
        }
      },
      {
        "fr": "l'accomplissement (m.)",
        "ipa": "[akɔ̃plismɑ̃]",
        "ko": "성취, 완수, 실현",
        "pos": "n.m.",
        "en": "accomplishment",
        "etym": "라틴어 complere(채우다, 완성하다)에서 왔어요. 영어 accomplishment와 같은 뿌리예요.",
        "ex": {
          "fr": "Ce diplôme représente l'accomplissement de longues années d'efforts.",
          "ko": "이 학위는 오랜 노력의 성취를 의미해요."
        }
      },
      {
        "fr": "la provocation",
        "ipa": "[pʁɔvɔkasjɔ̃]",
        "ko": "도발, 자극",
        "pos": "n.f.",
        "en": "provocation",
        "etym": "라틴어 provocare(불러내다, 도전하다)에서 왔어요. 영어 provocation과 같은 뿌리예요.",
        "ex": {
          "fr": "Ses propos ont été perçus comme une provocation.",
          "ko": "그의 발언은 도발로 받아들여졌어요."
        }
      },
      {
        "fr": "la sécheresse",
        "ipa": "[seʃʁɛs]",
        "ko": "가뭄, 건조함; (태도의) 무뚝뚝함",
        "pos": "n.f.",
        "ex": {
          "fr": "La sécheresse a ravagé les récoltes cette année.",
          "ko": "올해 가뭄이 농작물을 황폐하게 했어요."
        }
      },
      {
        "fr": "l'épuration (f.)",
        "ipa": "[epyʁasjɔ̃]",
        "ko": "정화, 숙청",
        "pos": "n.f.",
        "etym": "라틴어 purus(순수한)에서 왔어요. 영어 pure와 같은 뿌리예요. 정치적 맥락에서는 '숙청'을 뜻해요.",
        "ex": {
          "fr": "L'épuration des eaux usées est essentielle pour l'environnement.",
          "ko": "오수 정화는 환경에 필수적이에요."
        }
      },
      {
        "fr": "la captivité",
        "ipa": "[kaptivite]",
        "ko": "감금 상태, 포로 신세, 사육 상태",
        "pos": "n.f.",
        "en": "captivity",
        "etym": "라틴어 captivus(포로의)에서 왔어요. 영어 captivity와 같은 뿌리예요.",
        "ex": {
          "fr": "Ces animaux ne se reproduisent pas en captivité.",
          "ko": "이 동물들은 사육 상태에서는 번식하지 않아요."
        }
      },
      {
        "fr": "la dictature",
        "ipa": "[diktatyʁ]",
        "ko": "독재, 독재 정권",
        "pos": "n.f.",
        "en": "dictatorship",
        "etym": "라틴어 dictare(명령하다)에서 왔어요. 영어 dictator, dictatorship과 같은 뿌리예요.",
        "ex": {
          "fr": "Le pays a vécu trente ans sous la dictature.",
          "ko": "그 나라는 30년 동안 독재 아래 살았어요."
        }
      },
      {
        "fr": "la faillite",
        "ipa": "[fajit]",
        "ko": "파산, 도산",
        "pos": "n.f.",
        "etym": "이탈리아어 fallita(실패)에서 왔어요. 영어 fail과 같은 뿌리예요.",
        "ex": {
          "fr": "L'entreprise a fait faillite l'an dernier.",
          "ko": "그 회사는 작년에 파산했어요."
        }
      },
      {
        "fr": "la maturité",
        "ipa": "[matyʁite]",
        "ko": "성숙, 원숙함; (과일의) 익음",
        "pos": "n.f.",
        "en": "maturity",
        "etym": "라틴어 maturus(익은)에서 왔어요. 영어 maturity와 같은 뿌리예요.",
        "ex": {
          "fr": "Il a fait preuve d'une grande maturité dans cette épreuve.",
          "ko": "그는 이 시련에서 대단한 성숙함을 보여줬어요."
        }
      },
      {
        "fr": "le repli",
        "ipa": "[ʁəpli]",
        "ko": "후퇴, 철수; (마음의) 위축, 폐쇄",
        "pos": "n.m.",
        "ex": {
          "fr": "On observe un repli des investisseurs sur les valeurs sûres.",
          "ko": "투자자들이 안전 자산으로 후퇴하는 모습이 보여요."
        }
      },
      {
        "fr": "la révision",
        "ipa": "[ʁevizjɔ̃]",
        "ko": "수정, 재검토; 복습; (기계) 점검",
        "pos": "n.f.",
        "en": "revision",
        "etym": "라틴어 revidere(다시 보다)에서 왔어요. 영어 revision과 같은 뿌리예요.",
        "ex": {
          "fr": "La révision de la loi est à l'ordre du jour.",
          "ko": "법안 수정이 의제로 올라 있어요."
        }
      },
      {
        "fr": "l'endurance (f.)",
        "ipa": "[ɑ̃dyʁɑ̃s]",
        "ko": "지구력, 인내력",
        "pos": "n.f.",
        "en": "endurance",
        "etym": "라틴어 indurare(견디다, 단단하게 하다)에서 왔어요. 영어 endurance와 같은 뿌리예요.",
        "ex": {
          "fr": "Le marathon exige une grande endurance.",
          "ko": "마라톤은 대단한 지구력을 요구해요."
        }
      },
      {
        "fr": "la fluctuation",
        "ipa": "[flyktɥasjɔ̃]",
        "ko": "변동, 등락",
        "pos": "n.f.",
        "en": "fluctuation",
        "etym": "라틴어 fluctuare(물결치다)에서 왔어요. 영어 fluctuation과 같은 뿌리예요.",
        "ex": {
          "fr": "Les fluctuations des prix inquiètent les consommateurs.",
          "ko": "가격 변동이 소비자들을 불안하게 해요."
        }
      },
      {
        "fr": "l'infraction (f.)",
        "ipa": "[ɛ̃fʁaksjɔ̃]",
        "ko": "위반, 위법 행위",
        "pos": "n.f.",
        "en": "infraction",
        "etym": "라틴어 infringere(깨뜨리다)에서 왔어요. 영어 infraction과 같은 뿌리예요.",
        "ex": {
          "fr": "Il a commis une infraction au code de la route.",
          "ko": "그는 도로교통법을 위반했어요."
        }
      },
      {
        "fr": "la réglementation",
        "ipa": "[ʁeɡləmɑ̃tasjɔ̃]",
        "ko": "규정, 규제, 법규",
        "pos": "n.f.",
        "ex": {
          "fr": "La nouvelle réglementation entre en vigueur en janvier.",
          "ko": "새 규정은 1월에 발효돼요."
        }
      },
      {
        "fr": "l'éveil (m.)",
        "ipa": "[evɛj]",
        "ko": "각성, 깨어남; (관심·재능의) 일깨움",
        "pos": "n.m.",
        "ex": {
          "fr": "Ces activités favorisent l'éveil des jeunes enfants.",
          "ko": "이런 활동은 어린아이들의 감각을 일깨우는 데 도움이 돼요."
        }
      },
      {
        "fr": "le péril",
        "ipa": "[peʁil]",
        "ko": "위험, 위난",
        "pos": "n.m.",
        "en": "peril",
        "etym": "라틴어 periculum(위험)에서 왔어요. 영어 peril과 같은 뿌리예요.",
        "ex": {
          "fr": "La liberté de la presse est en péril dans ce pays.",
          "ko": "이 나라에서는 언론의 자유가 위태로워요."
        }
      },
      {
        "fr": "la clause",
        "ipa": "[kloz]",
        "ko": "조항, 약관",
        "pos": "n.f.",
        "en": "clause",
        "etym": "라틴어 claudere(닫다)에서 왔어요. 영어 clause와 같은 뿌리예요.",
        "ex": {
          "fr": "Le contrat contient une clause de confidentialité.",
          "ko": "계약서에는 비밀 유지 조항이 들어 있어요."
        }
      },
      {
        "fr": "la maternité",
        "ipa": "[matɛʁnite]",
        "ko": "모성, 출산; 산부인과, 산과 병동",
        "pos": "n.f.",
        "en": "maternity",
        "etym": "라틴어 mater(어머니)에서 왔어요. 영어 maternity와 같은 뿌리예요.",
        "ex": {
          "fr": "Elle a accouché à la maternité de l'hôpital central.",
          "ko": "그녀는 중앙병원 산부인과에서 출산했어요."
        }
      },
      {
        "fr": "la restriction",
        "ipa": "[ʁɛstʁiksjɔ̃]",
        "ko": "제한, 제약",
        "pos": "n.f.",
        "en": "restriction",
        "etym": "라틴어 restringere(조이다, 제한하다)에서 왔어요. 영어 restriction과 같은 뿌리예요.",
        "ex": {
          "fr": "De nouvelles restrictions budgétaires ont été annoncées.",
          "ko": "새로운 예산 제한이 발표됐어요."
        }
      },
      {
        "fr": "l'enfermement (m.)",
        "ipa": "[ɑ̃fɛʁməmɑ̃]",
        "ko": "감금, 가둠; (심리적) 자기 폐쇄",
        "pos": "n.m.",
        "ex": {
          "fr": "L'enfermement prolongé a des effets graves sur la santé mentale.",
          "ko": "장기간의 감금은 정신 건강에 심각한 영향을 미쳐요."
        }
      }
    ]
  },
  {
    "name": "이야기와 구어의 명사",
    "icon": "🗣️",
    "words": [
      {
        "fr": "le parfumeur",
        "ipa": "[paʁfymœʁ]",
        "ko": "조향사, 향수 제조인",
        "pos": "n.m.",
        "ex": {
          "fr": "Le parfumeur a créé une fragrance inédite.",
          "ko": "조향사가 새로운 향을 만들어 냈어요."
        }
      },
      {
        "fr": "la tentation",
        "ipa": "[tɑ̃tasjɔ̃]",
        "ko": "유혹",
        "pos": "n.f.",
        "en": "temptation",
        "etym": "라틴어 tentare(시험하다) — 영어 temptation과 같은 뿌리예요.",
        "ex": {
          "fr": "Il a résisté à la tentation d'abandonner.",
          "ko": "그는 포기하고 싶은 유혹을 견뎌 냈어요."
        }
      },
      {
        "fr": "le demi-siècle",
        "ipa": "[dəmisjɛkl]",
        "ko": "반세기, 50년",
        "pos": "n.m.",
        "ex": {
          "fr": "Ce monument est resté debout un demi-siècle.",
          "ko": "이 기념물은 반세기 동안 서 있었어요."
        }
      },
      {
        "fr": "le sceau",
        "ipa": "[so]",
        "ko": "인장, 봉인",
        "pos": "n.m.",
        "en": "seal",
        "etym": "라틴어 sigillum(작은 표시) — 영어 seal과 같은 뿌리예요.",
        "ex": {
          "fr": "Le document portait le sceau du roi.",
          "ko": "그 문서에는 왕의 인장이 찍혀 있었어요."
        }
      },
      {
        "fr": "la croisade",
        "ipa": "[kʁwazad]",
        "ko": "십자군; (비유) 운동, 성전",
        "pos": "n.f.",
        "en": "crusade",
        "etym": "라틴어 crux(십자가) — 영어 crusade와 같은 뿌리예요.",
        "ex": {
          "fr": "Il a lancé une véritable croisade contre la corruption.",
          "ko": "그는 부패에 맞선 진정한 운동을 벌였어요."
        }
      },
      {
        "fr": "le formulaire",
        "ipa": "[fɔʁmylɛʁ]",
        "ko": "양식, 서식",
        "pos": "n.m.",
        "ex": {
          "fr": "Remplissez ce formulaire en majuscules.",
          "ko": "이 양식을 대문자로 작성하세요."
        }
      },
      {
        "fr": "le muguet",
        "ipa": "[myɡɛ]",
        "ko": "은방울꽃",
        "pos": "n.m.",
        "ex": {
          "fr": "On offre du muguet le premier mai en France.",
          "ko": "프랑스에서는 5월 1일에 은방울꽃을 선물해요."
        }
      },
      {
        "fr": "le pou",
        "ipa": "[pu]",
        "ko": "이 (기생충)",
        "pos": "n.m.",
        "ex": {
          "fr": "L'enfant a attrapé des poux à l'école.",
          "ko": "아이가 학교에서 이가 옮았어요."
        }
      },
      {
        "fr": "le jasmin",
        "ipa": "[ʒasmɛ̃]",
        "ko": "재스민",
        "pos": "n.m.",
        "en": "jasmine",
        "etym": "페르시아어 yâsamîn에서 — 영어 jasmine과 같은 뿌리예요.",
        "ex": {
          "fr": "Le jasmin embaume tout le jardin le soir.",
          "ko": "저녁이면 재스민 향이 정원 전체를 가득 채워요."
        }
      },
      {
        "fr": "la climatisation",
        "ipa": "[klimatizasjɔ̃]",
        "ko": "냉방, 에어컨 (장치)",
        "pos": "n.f.",
        "ex": {
          "fr": "La climatisation est tombée en panne en pleine canicule.",
          "ko": "한창 폭염일 때 에어컨이 고장 났어요."
        }
      },
      {
        "fr": "le bailleur",
        "ipa": "[bajœʁ]",
        "ko": "임대인, 세를 주는 사람; (자금) 출자자",
        "pos": "n.m.",
        "ex": {
          "fr": "Le bailleur exige une caution de deux mois.",
          "ko": "임대인이 두 달치 보증금을 요구해요."
        }
      },
      {
        "fr": "l'ambre (m.)",
        "ipa": "[ɑ̃bʁ]",
        "ko": "호박(琥珀); 호박색",
        "pos": "n.m.",
        "en": "amber",
        "etym": "아랍어 ʿanbar에서 — 영어 amber와 같은 뿌리예요.",
        "ex": {
          "fr": "Un insecte est figé dans ce morceau d'ambre.",
          "ko": "이 호박 조각 안에 곤충 한 마리가 갇혀 있어요."
        }
      },
      {
        "fr": "la téléphonie",
        "ipa": "[telefɔni]",
        "ko": "전화 통신 (사업·기술)",
        "pos": "n.f.",
        "ex": {
          "fr": "La téléphonie mobile a transformé nos vies.",
          "ko": "이동 전화 통신이 우리 삶을 바꿔 놓았어요."
        }
      },
      {
        "fr": "l'ego (m.)",
        "ipa": "[eɡo]",
        "ko": "자아, 자존심, 에고",
        "pos": "n.m.",
        "en": "ego",
        "etym": "라틴어 ego(나) — 영어 ego와 같은 뿌리예요.",
        "ex": {
          "fr": "Cette critique a blessé son ego.",
          "ko": "그 비판이 그의 자존심을 건드렸어요."
        }
      },
      {
        "fr": "la consigne",
        "ipa": "[kɔ̃siɲ]",
        "ko": "지시, 지침; (역 등의) 물품 보관소",
        "pos": "n.f.",
        "ex": {
          "fr": "Lisez bien les consignes avant de commencer.",
          "ko": "시작하기 전에 지시 사항을 잘 읽으세요."
        }
      },
      {
        "fr": "le lilas",
        "ipa": "[lila]",
        "ko": "라일락; 라일락색",
        "pos": "n.m.",
        "en": "lilac",
        "etym": "페르시아어 nîlak(푸르스름한)에서 — 영어 lilac과 같은 뿌리예요.",
        "ex": {
          "fr": "Le lilas fleurit au printemps.",
          "ko": "라일락은 봄에 꽃을 피워요."
        }
      },
      {
        "fr": "l'agneau (m.)",
        "ipa": "[aɲo]",
        "ko": "새끼 양; 양고기",
        "pos": "n.m.",
        "ex": {
          "fr": "Au printemps, les agneaux gambadent dans le pré.",
          "ko": "봄이면 새끼 양들이 풀밭에서 뛰놀아요."
        }
      },
      {
        "fr": "la frénésie",
        "ipa": "[fʁenezi]",
        "ko": "광란, 열광, 격렬함",
        "pos": "n.f.",
        "en": "frenzy",
        "etym": "그리스어 phrenêsis(정신 착란) — 영어 frenzy와 같은 뿌리예요.",
        "ex": {
          "fr": "Une véritable frénésie d'achats s'est emparée des clients.",
          "ko": "손님들이 사재기 열풍에 휩싸였어요."
        }
      },
      {
        "fr": "le biologiste",
        "ipa": "[bjɔlɔʒist]",
        "ko": "생물학자",
        "pos": "n.m.",
        "en": "biologist",
        "etym": "그리스어 bios(생명)+logos(학문) — 영어 biologist와 같은 뿌리예요.",
        "ex": {
          "fr": "Les biologistes étudient l'évolution des espèces.",
          "ko": "생물학자들은 종의 진화를 연구해요."
        }
      },
      {
        "fr": "la péripétie",
        "ipa": "[peʁipesi]",
        "ko": "우여곡절, (이야기의) 사건 전환",
        "pos": "n.f.",
        "en": "peripeteia",
        "etym": "그리스어 peripeteia(급변) — 영어 peripeteia와 같은 뿌리예요.",
        "ex": {
          "fr": "Le voyage a été plein de péripéties.",
          "ko": "여행은 우여곡절로 가득했어요."
        }
      },
      {
        "fr": "le shopping",
        "ipa": "[ʃɔpiŋ]",
        "ko": "쇼핑",
        "pos": "n.m.",
        "en": "shopping",
        "etym": "영어 shopping을 그대로 빌려 왔어요. 프랑스어에서는 남성 명사로 써요.",
        "ex": {
          "fr": "Elle adore faire du shopping le week-end.",
          "ko": "그녀는 주말에 쇼핑하는 걸 정말 좋아해요."
        }
      },
      {
        "fr": "le tramway",
        "ipa": "[tʁamwɛ]",
        "ko": "전차, 트램",
        "pos": "n.m.",
        "en": "tramway",
        "etym": "영어 tramway에서 왔어요. 구어에서는 흔히 'le tram'으로 줄여 써요.",
        "ex": {
          "fr": "Le tramway dessert tout le centre-ville.",
          "ko": "트램이 시내 중심부 전체를 운행해요."
        }
      },
      {
        "fr": "le muscle",
        "ipa": "[myskl]",
        "ko": "근육",
        "pos": "n.m.",
        "en": "muscle",
        "etym": "라틴어 musculus(작은 쥐) — 영어 muscle과 같은 뿌리예요. 끝의 le까지 발음해요.",
        "ex": {
          "fr": "Cet exercice renforce les muscles du dos.",
          "ko": "이 운동은 등 근육을 강화해요."
        }
      },
      {
        "fr": "le textile",
        "ipa": "[tɛkstil]",
        "ko": "직물, 섬유; 섬유 산업",
        "pos": "n.m.",
        "en": "textile",
        "etym": "라틴어 texere(짜다) — 영어 textile과 같은 뿌리예요.",
        "ex": {
          "fr": "Cette région vit encore de l'industrie du textile.",
          "ko": "이 지역은 여전히 섬유 산업으로 먹고살아요."
        }
      },
      {
        "fr": "la fragrance",
        "ipa": "[fʁaɡʁɑ̃s]",
        "ko": "향, 향기",
        "pos": "n.f.",
        "en": "fragrance",
        "etym": "라틴어 fragrare(향기를 내다) — 영어 fragrance와 같은 뿌리예요. 문어적이고 격식 있는 단어예요.",
        "ex": {
          "fr": "Une fragrance de jasmin flottait dans l'air.",
          "ko": "재스민 향기가 공기 중에 감돌았어요."
        }
      },
      {
        "fr": "le fragment",
        "ipa": "[fʁaɡmɑ̃]",
        "ko": "조각, 단편",
        "pos": "n.m.",
        "en": "fragment",
        "etym": "라틴어 frangere(부수다) — 영어 fragment와 같은 뿌리예요.",
        "ex": {
          "fr": "On n'a retrouvé qu'un fragment du manuscrit.",
          "ko": "원고는 한 조각만 발견되었어요."
        }
      },
      {
        "fr": "l'artère (f.)",
        "ipa": "[aʁtɛʁ]",
        "ko": "동맥; (도시의) 간선 도로",
        "pos": "n.f.",
        "en": "artery",
        "etym": "그리스어 artēria — 영어 artery와 같은 뿌리예요. 큰길을 '동맥'에 빗대 쓰기도 해요.",
        "ex": {
          "fr": "Cette avenue est l'artère principale de la ville.",
          "ko": "이 대로는 도시의 주요 간선 도로예요."
        }
      },
      {
        "fr": "la pastille",
        "ipa": "[pastij]",
        "ko": "알약, 정제, 작은 사탕",
        "pos": "n.f.",
        "etym": "스페인어 pastilla에서 왔어요. 동그란 정제나 작은 표시점도 가리켜요.",
        "ex": {
          "fr": "Il suce une pastille pour la gorge.",
          "ko": "그는 목에 좋은 사탕을 빨고 있어요."
        }
      },
      {
        "fr": "l'abattage (m.)",
        "ipa": "[abataʒ]",
        "ko": "도살; 벌목",
        "pos": "n.m.",
        "etym": "동사 abattre(쓰러뜨리다, 베다)에서 왔어요. 가축 도살이나 나무 벌목을 가리켜요.",
        "ex": {
          "fr": "L'abattage des arbres a suscité la colère des habitants.",
          "ko": "나무 벌목이 주민들의 분노를 일으켰어요."
        }
      },
      {
        "fr": "le cyclone",
        "ipa": "[siklɔn]",
        "ko": "사이클론, 열대성 폭풍",
        "pos": "n.m.",
        "en": "cyclone",
        "etym": "그리스어 kyklos(원, 회전) — 영어 cyclone과 같은 뿌리예요.",
        "ex": {
          "fr": "Le cyclone a ravagé toute la côte.",
          "ko": "사이클론이 해안 전체를 휩쓸었어요."
        }
      },
      {
        "fr": "le lifting",
        "ipa": "[liftiŋ]",
        "ko": "주름 제거 성형, 리프팅; (이미지) 쇄신",
        "pos": "n.m.",
        "en": "lifting (face-lift)",
        "etym": "영어 lifting을 빌려 왔지만, 프랑스어에서는 특히 '안면 성형(face-lift)'을 뜻해요.",
        "ex": {
          "fr": "La marque a offert un lifting à son logo.",
          "ko": "그 브랜드는 로고를 새단장했어요."
        }
      },
      {
        "fr": "le mâle",
        "ipa": "[mɑl]",
        "ko": "수컷",
        "pos": "n.m.",
        "en": "male",
        "etym": "라틴어 masculus(남성의) — 영어 male과 같은 뿌리예요.",
        "ex": {
          "fr": "Chez les lions, le mâle a une crinière.",
          "ko": "사자는 수컷에게 갈기가 있어요."
        }
      },
      {
        "fr": "la ration",
        "ipa": "[ʁasjɔ̃]",
        "ko": "할당량, 1인분, 배급량",
        "pos": "n.f.",
        "en": "ration",
        "etym": "라틴어 ratio(셈, 비율) — 영어 ration과 같은 뿌리예요.",
        "ex": {
          "fr": "Chaque soldat reçoit une ration quotidienne.",
          "ko": "병사들은 각자 하루치 배급을 받아요."
        }
      },
      {
        "fr": "la partition",
        "ipa": "[paʁtisjɔ̃]",
        "ko": "악보; 분할",
        "pos": "n.f.",
        "en": "partition",
        "etym": "faux ami 주의: 영어 partition은 '칸막이·분할'이지만, 프랑스어 partition은 흔히 '악보'를 뜻해요.",
        "ex": {
          "fr": "Le pianiste tourne les pages de sa partition.",
          "ko": "피아니스트가 악보를 넘겨요."
        }
      },
      {
        "fr": "la collision",
        "ipa": "[kɔlizjɔ̃]",
        "ko": "충돌",
        "pos": "n.f.",
        "en": "collision",
        "etym": "라틴어 collidere(서로 부딪치다) — 영어 collision과 같은 뿌리예요.",
        "ex": {
          "fr": "La collision entre les deux véhicules a fait deux blessés.",
          "ko": "두 차량의 충돌로 두 명이 다쳤어요."
        }
      },
      {
        "fr": "la calorie",
        "ipa": "[kalɔʁi]",
        "ko": "칼로리, 열량",
        "pos": "n.f.",
        "en": "calorie",
        "etym": "라틴어 calor(열) — 영어 calorie와 같은 뿌리예요.",
        "ex": {
          "fr": "Ce dessert est très riche en calories.",
          "ko": "이 디저트는 칼로리가 아주 높아요."
        }
      },
      {
        "fr": "l'ardeur (f.)",
        "ipa": "[aʁdœʁ]",
        "ko": "열정, 열의",
        "pos": "n.f.",
        "en": "ardour",
        "etym": "라틴어 ardere(불타다)에서 왔고, 영어 ardour와 같은 뿌리예요.",
        "ex": {
          "fr": "Il défend ses idées avec ardeur.",
          "ko": "그는 자기 생각을 열정적으로 옹호해요."
        }
      },
      {
        "fr": "le bataillon",
        "ipa": "[batajɔ̃]",
        "ko": "대대, 부대",
        "pos": "n.m.",
        "en": "battalion",
        "etym": "이탈리아어 battaglione에서 왔고, 영어 battalion과 같은 뿌리예요.",
        "ex": {
          "fr": "Un bataillon entier a été envoyé sur le front.",
          "ko": "한 대대 전체가 전선으로 파견됐어요."
        }
      },
      {
        "fr": "l'usure (f.)",
        "ipa": "[yzyʁ]",
        "ko": "마모, 닳음",
        "pos": "n.f.",
        "ex": {
          "fr": "L'usure des pneus est visible.",
          "ko": "타이어가 마모된 게 눈에 보여요."
        }
      },
      {
        "fr": "l'étendard (m.)",
        "ipa": "[etɑ̃daʁ]",
        "ko": "깃발, 군기",
        "pos": "n.m.",
        "en": "standard (flag)",
        "etym": "옛 프랑스어 estandart에서 왔고, 영어 standard(군기)와 같은 뿌리예요.",
        "ex": {
          "fr": "Ils ont brandi l'étendard de la liberté.",
          "ko": "그들은 자유의 깃발을 높이 들었어요."
        }
      },
      {
        "fr": "l'ouvre-boîte (m.)",
        "ipa": "[uvʁəbwat]",
        "ko": "깡통따개",
        "pos": "n.m.",
        "ex": {
          "fr": "Je ne trouve plus l'ouvre-boîte dans le tiroir.",
          "ko": "서랍에서 깡통따개를 못 찾겠어요."
        }
      },
      {
        "fr": "l'imprimeur (m.)",
        "ipa": "[ɛ̃pʁimœʁ]",
        "ko": "인쇄업자, 인쇄공",
        "pos": "n.m.",
        "en": "printer",
        "etym": "라틴어 imprimere(찍다)에서 왔고, 영어 printer와 같은 뿌리예요.",
        "ex": {
          "fr": "L'imprimeur a livré les affiches à temps.",
          "ko": "인쇄업자가 포스터를 제때 배달했어요."
        }
      },
      {
        "fr": "le ravage",
        "ipa": "[ʁavaʒ]",
        "ko": "참화, 막대한 피해",
        "pos": "n.m.",
        "en": "ravage",
        "etym": "프랑스어 ravir(앗아가다)에서 왔고, 영어 ravage와 같은 뿌리예요. 보통 복수형 ravages로 자주 써요.",
        "ex": {
          "fr": "La tempête a fait des ravages dans la région.",
          "ko": "폭풍이 그 지역에 막대한 피해를 입혔어요."
        }
      },
      {
        "fr": "l'iris (m.)",
        "ipa": "[iʁis]",
        "ko": "홍채, 붓꽃",
        "pos": "n.m.",
        "en": "iris",
        "etym": "그리스어 iris(무지개)에서 왔고, 영어 iris와 같은 뿌리예요. 눈의 홍채와 꽃 붓꽃을 모두 뜻해요.",
        "ex": {
          "fr": "Son iris est d'un bleu profond.",
          "ko": "그의 홍채는 짙은 파란색이에요."
        }
      },
      {
        "fr": "le bambin",
        "ipa": "[bɑ̃bɛ̃]",
        "ko": "꼬마, 어린아이",
        "pos": "n.m.",
        "ex": {
          "fr": "Un bambin courait dans le parc.",
          "ko": "한 꼬마가 공원에서 뛰어다니고 있었어요."
        }
      },
      {
        "fr": "le détour",
        "ipa": "[detuʁ]",
        "ko": "우회, 에움길",
        "pos": "n.m.",
        "en": "detour",
        "etym": "프랑스어 détourner(돌리다)에서 왔고, 영어 detour와 같은 뿌리예요.",
        "ex": {
          "fr": "Il a expliqué l'affaire sans détour.",
          "ko": "그는 그 일을 에두르지 않고 곧장 설명했어요."
        }
      },
      {
        "fr": "la fresque",
        "ipa": "[fʁɛsk]",
        "ko": "프레스코화, 벽화",
        "pos": "n.f.",
        "en": "fresco",
        "etym": "이탈리아어 fresco(신선한)에서 왔고, 영어 fresco와 같은 뿌리예요.",
        "ex": {
          "fr": "Ce roman est une vaste fresque historique.",
          "ko": "이 소설은 거대한 역사 벽화 같은 작품이에요."
        }
      },
      {
        "fr": "la passerelle",
        "ipa": "[pasʁɛl]",
        "ko": "구름다리, 가교, 연결 통로",
        "pos": "n.f.",
        "ex": {
          "fr": "Cette formation crée une passerelle vers l'emploi.",
          "ko": "이 교육 과정은 취업으로 가는 가교를 만들어 줘요."
        }
      },
      {
        "fr": "la bulle",
        "ipa": "[byl]",
        "ko": "거품, 방울; (만화의) 말풍선",
        "pos": "n.f.",
        "ex": {
          "fr": "La bulle immobilière risque d'éclater.",
          "ko": "부동산 거품이 터질 위험이 있어요."
        }
      },
      {
        "fr": "la querelle",
        "ipa": "[kəʁɛl]",
        "ko": "다툼, 언쟁",
        "pos": "n.f.",
        "ex": {
          "fr": "Une vieille querelle les oppose depuis des années.",
          "ko": "오래된 다툼이 그들을 몇 년째 갈라놓고 있어요."
        }
      },
      {
        "fr": "le téléviseur",
        "ipa": "[televizœʁ]",
        "ko": "텔레비전 수상기",
        "pos": "n.m.",
        "en": "television set",
        "etym": "그리스어 tele(멀리)+라틴어 visor(보는 것)에서 왔어요. 영어 television과 같은 뿌리예요.",
        "ex": {
          "fr": "Ils ont acheté un nouveau téléviseur.",
          "ko": "그들은 새 텔레비전을 샀어요."
        }
      },
      {
        "fr": "la canicule",
        "ipa": "[kanikyl]",
        "ko": "폭염, 무더위",
        "pos": "n.f.",
        "etym": "라틴어 canicula(작은 개, 큰개자리 별)에서 왔어요. 이 별이 뜨는 한여름의 더위를 가리켰어요.",
        "ex": {
          "fr": "La canicule a fait de nombreuses victimes.",
          "ko": "폭염으로 많은 희생자가 발생했어요."
        }
      },
      {
        "fr": "l'arrivant (m.)",
        "ipa": "[aʁivɑ̃]",
        "ko": "도착자, 새로 온 사람",
        "pos": "n.m.",
        "ex": {
          "fr": "Les nouveaux arrivants ont été chaleureusement accueillis.",
          "ko": "새로 온 사람들이 따뜻한 환영을 받았어요."
        }
      },
      {
        "fr": "le coiffeur",
        "ipa": "[kwafœʁ]",
        "ko": "미용사, 이발사",
        "pos": "n.m.",
        "ex": {
          "fr": "Je vais chez le coiffeur cet après-midi.",
          "ko": "오늘 오후에 미용실에 가요."
        }
      },
      {
        "fr": "la malice",
        "ipa": "[malis]",
        "ko": "장난기, 짓궂음",
        "pos": "n.f.",
        "en": "malice",
        "etym": "라틴어 malitia(악의)에서 왔어요. 영어 malice는 '악의'지만, 프랑스어 malice는 보통 '귀여운 장난기'를 뜻해요. 주의하세요.",
        "ex": {
          "fr": "Ses yeux brillaient de malice.",
          "ko": "그의 눈은 장난기로 반짝였어요."
        }
      },
      {
        "fr": "le germe",
        "ipa": "[ʒɛʁm]",
        "ko": "싹, 배아; 발단",
        "pos": "n.m.",
        "en": "germ",
        "etym": "라틴어 germen(싹)에서 왔고, 영어 germ과 같은 뿌리예요.",
        "ex": {
          "fr": "Cette idée portait en elle le germe d'une révolution.",
          "ko": "그 생각은 안에 혁명의 싹을 품고 있었어요."
        }
      },
      {
        "fr": "l'économiste (m./f.)",
        "ipa": "[ekɔnɔmist]",
        "ko": "경제학자",
        "pos": "n.m.",
        "en": "economist",
        "etym": "그리스어 oikonomia(살림살이)에서 왔고, 영어 economist와 같은 뿌리예요. 남녀 같은 형태예요.",
        "ex": {
          "fr": "L'économiste prévoit une récession.",
          "ko": "그 경제학자는 경기 침체를 예측해요."
        }
      },
      {
        "fr": "le tsunami",
        "ipa": "[tsynami]",
        "ko": "쓰나미, 지진 해일",
        "pos": "n.m.",
        "en": "tsunami",
        "etym": "일본어 津波(쓰나미)에서 왔고, 영어 tsunami와 같은 뿌리예요.",
        "ex": {
          "fr": "Le tsunami a ravagé toute la côte.",
          "ko": "쓰나미가 해안 전체를 휩쓸었어요."
        }
      },
      {
        "fr": "le porte-parole",
        "ipa": "[pɔʁtpaʁɔl]",
        "ko": "대변인",
        "pos": "n.m.",
        "ex": {
          "fr": "Le porte-parole du gouvernement a fait une déclaration.",
          "ko": "정부 대변인이 성명을 발표했어요."
        }
      },
      {
        "fr": "la lavandière",
        "ipa": "[lavɑ̃djɛʁ]",
        "ko": "빨래하는 여인, 세탁부",
        "pos": "n.f.",
        "ex": {
          "fr": "Les lavandières battaient le linge au bord de la rivière.",
          "ko": "세탁부들이 강가에서 빨래를 두드리고 있었어요."
        }
      },
      {
        "fr": "le reptile",
        "ipa": "[ʁɛptil]",
        "ko": "파충류",
        "pos": "n.m.",
        "en": "reptile",
        "etym": "라틴어 reptilis(기어다니는)에서 왔고, 영어 reptile과 같은 뿌리예요.",
        "ex": {
          "fr": "Le serpent est un reptile.",
          "ko": "뱀은 파충류예요."
        }
      },
      {
        "fr": "la rame",
        "ipa": "[ʁam]",
        "ko": "노; (지하철) 편성 열차",
        "pos": "n.f.",
        "ex": {
          "fr": "La rame de métro était bondée ce matin.",
          "ko": "오늘 아침 지하철 열차는 만원이었어요."
        }
      },
      {
        "fr": "le micro-ordinateur",
        "ipa": "[mikʁoɔʁdinatœʁ]",
        "ko": "마이크로컴퓨터, 개인용 컴퓨터",
        "pos": "n.m.",
        "ex": {
          "fr": "Le micro-ordinateur a révolutionné le bureau.",
          "ko": "개인용 컴퓨터는 사무실을 혁신했어요."
        }
      },
      {
        "fr": "la plongée",
        "ipa": "[plɔ̃ʒe]",
        "ko": "잠수, 다이빙; 깊이 파고듦",
        "pos": "n.f.",
        "ex": {
          "fr": "Ce roman est une plongée dans le passé.",
          "ko": "이 소설은 과거 속으로의 깊은 침잠이에요."
        }
      },
      {
        "fr": "le scoop",
        "ipa": "[skup]",
        "ko": "특종",
        "pos": "n.m.",
        "en": "scoop",
        "etym": "영어 scoop을 그대로 들여온 차용어예요.",
        "ex": {
          "fr": "Ce journaliste a décroché un scoop.",
          "ko": "그 기자가 특종을 잡았어요."
        }
      },
      {
        "fr": "le revers",
        "ipa": "[ʁəvɛʁ]",
        "ko": "뒷면; 좌절, 차질",
        "pos": "n.m.",
        "ex": {
          "fr": "L'entreprise a subi un sérieux revers.",
          "ko": "그 회사는 심각한 차질을 겪었어요."
        }
      },
      {
        "fr": "la saveur",
        "ipa": "[savœʁ]",
        "ko": "맛, 풍미",
        "pos": "n.f.",
        "en": "savour",
        "etym": "라틴어 sapor(맛)에서 왔고, 영어 savour와 같은 뿌리예요.",
        "ex": {
          "fr": "Ce plat a une saveur délicate.",
          "ko": "이 요리는 섬세한 풍미가 있어요."
        }
      },
      {
        "fr": "l'abattoir (m.)",
        "ipa": "[abatwaʁ]",
        "ko": "도살장",
        "pos": "n.m.",
        "ex": {
          "fr": "Les conditions dans cet abattoir sont scandaleuses.",
          "ko": "이 도살장의 환경은 충격적이에요."
        }
      },
      {
        "fr": "le questionnaire",
        "ipa": "[kɛstjɔnɛʁ]",
        "ko": "설문지",
        "pos": "n.m.",
        "en": "questionnaire",
        "etym": "라틴어 quaestio(질문)에서 왔고, 영어 questionnaire와 같은 뿌리예요.",
        "ex": {
          "fr": "Merci de remplir ce questionnaire.",
          "ko": "이 설문지를 작성해 주세요."
        }
      },
      {
        "fr": "l'anesthésique (m.)",
        "ipa": "[anɛstezik]",
        "ko": "마취제",
        "pos": "n.m.",
        "en": "anaesthetic",
        "etym": "그리스어 an-(없는)+aisthesis(감각)에서 왔고, 영어 anaesthetic과 같은 뿌리예요.",
        "ex": {
          "fr": "Le dentiste a injecté un anesthésique local.",
          "ko": "치과 의사가 국소 마취제를 주사했어요."
        }
      },
      {
        "fr": "le compatriote",
        "ipa": "[kɔ̃patʁijɔt]",
        "ko": "동포, 동향인",
        "pos": "n.m.",
        "en": "compatriot",
        "etym": "라틴어 com-(함께)+patria(조국)에서 왔고, 영어 compatriot과 같은 뿌리예요.",
        "ex": {
          "fr": "Il a rencontré un compatriote à l'étranger.",
          "ko": "그는 외국에서 동포를 만났어요."
        }
      },
      {
        "fr": "le jongleur",
        "ipa": "[ʒɔ̃ɡlœʁ]",
        "ko": "곡예사, 저글링하는 사람",
        "pos": "n.m.",
        "en": "juggler",
        "etym": "라틴어 joculator(익살꾼)에서 왔고, 영어 juggler와 같은 뿌리예요.",
        "ex": {
          "fr": "Un jongleur amusait la foule sur la place.",
          "ko": "한 곡예사가 광장에서 군중을 즐겁게 해 주고 있었어요."
        }
      },
      {
        "fr": "l'auditoire (m.)",
        "ipa": "[oditwaʁ]",
        "ko": "청중, 청취자들",
        "pos": "n.m.",
        "en": "auditory / audience",
        "etym": "라틴어 audire(듣다)에서 왔어요. 영어 auditory, audience와 같은 뿌리예요.",
        "ex": {
          "fr": "L'orateur a captivé son auditoire pendant une heure.",
          "ko": "연사는 한 시간 동안 청중을 사로잡았어요."
        }
      },
      {
        "fr": "la fève",
        "ipa": "[fɛv]",
        "ko": "잠두, 누에콩; (갈레트 속) 작은 인형",
        "pos": "n.f.",
        "ex": {
          "fr": "Celui qui trouve la fève dans la galette devient roi.",
          "ko": "갈레트 속 인형을 찾은 사람이 왕이 돼요."
        }
      },
      {
        "fr": "la loterie",
        "ipa": "[lɔtʁi]",
        "ko": "복권, 추첨",
        "pos": "n.f.",
        "en": "lottery",
        "etym": "이탈리아어 lotto(제비, 운명)에서 왔어요. 영어 lottery와 같은 뿌리예요.",
        "ex": {
          "fr": "Il a gagné une grosse somme à la loterie.",
          "ko": "그는 복권으로 큰돈을 땄어요."
        }
      },
      {
        "fr": "le rabais",
        "ipa": "[ʁabɛ]",
        "ko": "할인, 가격 인하",
        "pos": "n.m.",
        "ex": {
          "fr": "Le magasin accorde un rabais de vingt pour cent.",
          "ko": "그 가게는 20퍼센트 할인을 해줘요."
        }
      },
      {
        "fr": "le preneur",
        "ipa": "[pʁənœʁ]",
        "ko": "사려는 사람, 매수인, 임차인",
        "pos": "n.m.",
        "ex": {
          "fr": "Il vend sa voiture mais ne trouve pas de preneur.",
          "ko": "그는 차를 팔려고 하지만 살 사람을 못 찾고 있어요."
        }
      },
      {
        "fr": "le colza",
        "ipa": "[kɔlza]",
        "ko": "유채, 평지",
        "pos": "n.m.",
        "ex": {
          "fr": "Les champs de colza sont d'un jaune éclatant au printemps.",
          "ko": "유채밭은 봄에 눈부신 노란빛을 띠어요."
        }
      },
      {
        "fr": "l'encombrement (m.)",
        "ipa": "[ɑ̃kɔ̃bʁəmɑ̃]",
        "ko": "혼잡, 정체; 적치, 부피",
        "pos": "n.m.",
        "ex": {
          "fr": "L'encombrement des routes est insupportable aux heures de pointe.",
          "ko": "출퇴근 시간대의 도로 혼잡은 견디기 힘들어요."
        }
      },
      {
        "fr": "le stupéfiant",
        "ipa": "[stypefjɑ̃]",
        "ko": "마약, 마취제",
        "pos": "n.m.",
        "etym": "라틴어 stupefacere(멍하게 하다)에서 왔어요. 영어 stupefy와 같은 뿌리예요. 형용사로는 '깜짝 놀라게 하는'이라는 뜻도 있어요.",
        "ex": {
          "fr": "La police a saisi une grande quantité de stupéfiants.",
          "ko": "경찰이 다량의 마약을 압수했어요."
        }
      },
      {
        "fr": "le tire-bouchon",
        "ipa": "[tiʁbuʃɔ̃]",
        "ko": "코르크 따개, 와인 오프너",
        "pos": "n.m.",
        "ex": {
          "fr": "Je ne trouve pas le tire-bouchon pour ouvrir la bouteille.",
          "ko": "병을 딸 코르크 따개를 못 찾겠어요."
        }
      },
      {
        "fr": "la betterave",
        "ipa": "[bɛtʁav]",
        "ko": "사탕무, 비트",
        "pos": "n.f.",
        "ex": {
          "fr": "Le sucre est extrait de la betterave dans cette région.",
          "ko": "이 지역에서는 사탕무에서 설탕을 추출해요."
        }
      },
      {
        "fr": "l'oubliette (f.)",
        "ipa": "[ublijɛt]",
        "ko": "(주로 복수) 망각, 잊힘; (옛 성의) 지하 감옥",
        "pos": "n.f.",
        "ex": {
          "fr": "Ce projet est tombé aux oubliettes depuis longtemps.",
          "ko": "이 프로젝트는 오래전에 까맣게 잊혔어요."
        }
      },
      {
        "fr": "le garagiste",
        "ipa": "[gaʁaʒist]",
        "ko": "정비사, 자동차 정비소 주인",
        "pos": "n.m.",
        "ex": {
          "fr": "Le garagiste m'a dit que la réparation coûterait cher.",
          "ko": "정비사가 수리비가 비쌀 거라고 했어요."
        }
      },
      {
        "fr": "le prophète",
        "ipa": "[pʁɔfɛt]",
        "ko": "예언자, 선지자",
        "pos": "n.m.",
        "en": "prophet",
        "etym": "그리스어 prophetes(대신 말하는 자)에서 왔어요. 영어 prophet과 같은 뿌리예요.",
        "ex": {
          "fr": "Nul n'est prophète en son pays.",
          "ko": "예언자는 자기 고향에서 인정받지 못해요."
        }
      },
      {
        "fr": "l'allumage (m.)",
        "ipa": "[alymaʒ]",
        "ko": "점화, 점등; (엔진의) 점화 장치",
        "pos": "n.m.",
        "ex": {
          "fr": "Le problème vient du système d'allumage de la voiture.",
          "ko": "문제는 자동차의 점화 장치에서 비롯돼요."
        }
      }
    ]
  },
  {
    "name": "정밀한 고급 동사",
    "icon": "🏃",
    "words": [
      {
        "fr": "accroître",
        "ipa": "[akʁwatʁ]",
        "ko": "늘리다, 증대시키다",
        "pos": "v.",
        "ex": {
          "fr": "Cette mesure devrait accroître la productivité.",
          "ko": "이 조치는 생산성을 높일 거예요."
        }
      },
      {
        "fr": "commercialiser",
        "ipa": "[kɔmɛʁsjalize]",
        "ko": "상품화하다, 시판하다",
        "pos": "v.",
        "en": "to commercialize",
        "ex": {
          "fr": "Le laboratoire compte commercialiser ce vaccin l'an prochain.",
          "ko": "그 연구소는 내년에 이 백신을 시판할 계획이에요."
        }
      },
      {
        "fr": "absorber",
        "ipa": "[apsɔʁbe]",
        "ko": "흡수하다; (시간·관심을) 빨아들이다",
        "pos": "v.",
        "en": "to absorb",
        "etym": "라틴어 absorbere(빨아들이다) — 영어 absorb와 같은 뿌리예요.",
        "ex": {
          "fr": "Les plantes absorbent le dioxyde de carbone.",
          "ko": "식물은 이산화탄소를 흡수해요."
        }
      },
      {
        "fr": "soupçonner",
        "ipa": "[supsɔne]",
        "ko": "의심하다, 짐작하다",
        "pos": "v.",
        "en": "to suspect",
        "etym": "라틴어 suspectio(의심) — 영어 suspect와 같은 뿌리예요.",
        "ex": {
          "fr": "On le soupçonne d'avoir falsifié les comptes.",
          "ko": "사람들은 그가 회계를 조작했다고 의심해요."
        }
      },
      {
        "fr": "recréer",
        "ipa": "[ʁəkʁee]",
        "ko": "다시 만들다, 재현하다",
        "pos": "v.",
        "en": "to recreate",
        "ex": {
          "fr": "Le film recrée fidèlement l'ambiance des années 30.",
          "ko": "그 영화는 1930년대 분위기를 충실히 재현해요."
        }
      },
      {
        "fr": "garnir",
        "ipa": "[ɡaʁniʁ]",
        "ko": "(음식 등을) 곁들이다, 채우다, 장식하다",
        "pos": "v.",
        "ex": {
          "fr": "Elle a garni la tarte de fruits frais.",
          "ko": "그녀는 타르트에 신선한 과일을 얹었어요."
        }
      },
      {
        "fr": "décrypter",
        "ipa": "[dekʁipte]",
        "ko": "해독하다, 풀어내다",
        "pos": "v.",
        "en": "to decrypt / decipher",
        "etym": "그리스어 kryptos(숨겨진) — 영어 decrypt와 같은 뿌리예요.",
        "ex": {
          "fr": "L'éditorial décrypte les enjeux de la réforme.",
          "ko": "사설이 개혁의 쟁점을 풀어 설명해요."
        }
      },
      {
        "fr": "défiler",
        "ipa": "[defile]",
        "ko": "행진하다; (화면·이미지가) 연달아 지나가다",
        "pos": "v.",
        "ex": {
          "fr": "Les manifestants ont défilé jusqu'à la place.",
          "ko": "시위대가 광장까지 행진했어요."
        }
      },
      {
        "fr": "reconstituer",
        "ipa": "[ʁəkɔ̃stitɥe]",
        "ko": "복원하다, 재구성하다",
        "pos": "v.",
        "en": "to reconstitute / reconstruct",
        "ex": {
          "fr": "Les enquêteurs ont reconstitué le déroulement des faits.",
          "ko": "수사관들이 사건의 경위를 재구성했어요."
        }
      },
      {
        "fr": "refroidir",
        "ipa": "[ʁəfʁwadiʁ]",
        "ko": "식히다, 차게 하다; 식다",
        "pos": "v.",
        "ex": {
          "fr": "Laissez refroidir le plat avant de le servir.",
          "ko": "내기 전에 요리를 식게 두세요."
        }
      },
      {
        "fr": "injecter",
        "ipa": "[ɛ̃ʒɛkte]",
        "ko": "주입하다, 투입하다",
        "pos": "v.",
        "en": "to inject",
        "etym": "라틴어 injicere(던져 넣다) — 영어 inject와 같은 뿌리예요.",
        "ex": {
          "fr": "L'État a injecté des milliards dans l'économie.",
          "ko": "국가가 경제에 수십억을 투입했어요."
        }
      },
      {
        "fr": "insérer",
        "ipa": "[ɛ̃seʁe]",
        "ko": "삽입하다, 끼워 넣다",
        "pos": "v.",
        "en": "to insert",
        "etym": "라틴어 inserere(끼워 넣다) — 영어 insert와 같은 뿌리예요.",
        "ex": {
          "fr": "Insérez votre carte dans la fente.",
          "ko": "카드를 투입구에 넣으세요."
        }
      },
      {
        "fr": "accentuer",
        "ipa": "[aksɑ̃tɥe]",
        "ko": "강조하다, 두드러지게 하다, 심화시키다",
        "pos": "v.",
        "en": "to accentuate",
        "etym": "라틴어 accentus(악센트) — 영어 accentuate와 같은 뿌리예요.",
        "ex": {
          "fr": "La crise a accentué les inégalités.",
          "ko": "위기가 불평등을 심화시켰어요."
        }
      },
      {
        "fr": "tripler",
        "ipa": "[tʁiple]",
        "ko": "세 배로 늘리다, 세 배가 되다",
        "pos": "v.",
        "en": "to triple",
        "ex": {
          "fr": "Le chiffre d'affaires a triplé en cinq ans.",
          "ko": "매출이 5년 만에 세 배가 됐어요."
        }
      },
      {
        "fr": "cohabiter",
        "ipa": "[kɔabite]",
        "ko": "동거하다, 공존하다",
        "pos": "v.",
        "etym": "라틴어 co(함께)+habitare(살다) — 영어 cohabit과 같은 뿌리예요.",
        "ex": {
          "fr": "Plusieurs cultures cohabitent dans cette ville.",
          "ko": "여러 문화가 이 도시에서 공존해요."
        }
      },
      {
        "fr": "reconstruire",
        "ipa": "[ʁəkɔ̃stʁɥiʁ]",
        "ko": "재건하다, 다시 짓다",
        "pos": "v.",
        "en": "reconstruct",
        "etym": "라틴어 re(다시)+construere(쌓다) — 영어 reconstruct와 같은 뿌리예요.",
        "ex": {
          "fr": "La ville a dû reconstruire le pont détruit.",
          "ko": "도시는 무너진 다리를 재건해야 했어요."
        }
      },
      {
        "fr": "congeler",
        "ipa": "[kɔ̃ʒle]",
        "ko": "냉동하다, 얼리다",
        "pos": "v.",
        "etym": "라틴어 congelare(얼리다) — 영어 congeal(굳다)과 같은 뿌리예요.",
        "ex": {
          "fr": "On peut congeler ce plat pour plus tard.",
          "ko": "이 요리는 나중을 위해 냉동할 수 있어요."
        }
      },
      {
        "fr": "miser",
        "ipa": "[mize]",
        "ko": "(돈을) 걸다, 베팅하다; 기대를 걸다",
        "pos": "v.",
        "etym": "명사 mise(판돈, 투입)에서 온 동사예요. 'miser sur(~에 걸다)' 형태로 자주 써요.",
        "ex": {
          "fr": "L'entreprise mise sur l'innovation pour se développer.",
          "ko": "그 회사는 성장을 위해 혁신에 승부를 걸어요."
        }
      },
      {
        "fr": "expulser",
        "ipa": "[ɛkspylse]",
        "ko": "추방하다, 쫓아내다",
        "pos": "v.",
        "en": "expel",
        "etym": "라틴어 ex(밖)+pellere(밀다) — 영어 expel과 같은 뿌리예요.",
        "ex": {
          "fr": "Le locataire a été expulsé pour loyers impayés.",
          "ko": "세입자는 밀린 집세 때문에 쫓겨났어요."
        }
      },
      {
        "fr": "cibler",
        "ipa": "[sible]",
        "ko": "겨냥하다, 표적으로 삼다",
        "pos": "v.",
        "etym": "명사 cible(표적, 과녁)에서 온 동사예요. 마케팅에서 '타깃으로 삼다'로 자주 써요.",
        "ex": {
          "fr": "Cette campagne cible surtout les jeunes.",
          "ko": "이 캠페인은 특히 젊은 층을 겨냥해요."
        }
      },
      {
        "fr": "savourer",
        "ipa": "[savuʁe]",
        "ko": "음미하다, 만끽하다",
        "pos": "v.",
        "en": "savor",
        "etym": "라틴어 sapor(맛) — 영어 savor와 같은 뿌리예요. 맛뿐 아니라 순간·성공도 '음미하다'로 써요.",
        "ex": {
          "fr": "Elle savoure chaque instant de ces vacances.",
          "ko": "그녀는 이 휴가의 매 순간을 음미해요."
        }
      },
      {
        "fr": "collaborer",
        "ipa": "[kɔlabɔʁe]",
        "ko": "협력하다, 공동 작업하다",
        "pos": "v.",
        "en": "collaborate",
        "etym": "라틴어 com(함께)+laborare(일하다) — 영어 collaborate와 같은 뿌리예요.",
        "ex": {
          "fr": "Les deux laboratoires collaborent sur ce projet.",
          "ko": "두 연구소가 이 프로젝트에서 협력해요."
        }
      },
      {
        "fr": "mouvoir",
        "ipa": "[muvwaʁ]",
        "ko": "움직이게 하다, 작동시키다",
        "pos": "v.",
        "en": "move",
        "etym": "라틴어 movere(움직이다) — 영어 move와 같은 뿌리예요. 문어적이며, 흔히 대명동사 se mouvoir(움직이다)로 써요.",
        "ex": {
          "fr": "Cette machine est mue par l'énergie solaire.",
          "ko": "이 기계는 태양 에너지로 작동돼요."
        }
      },
      {
        "fr": "enchaîner",
        "ipa": "[ɑ̃ʃene]",
        "ko": "잇따라 하다, 연달아 이어 가다; 사슬로 묶다",
        "pos": "v.",
        "etym": "명사 chaîne(사슬)에서 왔어요. 동작이나 일을 '연달아 이어 가다'라는 뜻으로 자주 써요.",
        "ex": {
          "fr": "Il enchaîne les rendez-vous toute la journée.",
          "ko": "그는 하루 종일 약속을 연달아 소화해요."
        }
      },
      {
        "fr": "figer",
        "ipa": "[fiʒe]",
        "ko": "굳히다, 얼어붙게 하다, 멈춰 세우다",
        "pos": "v.",
        "etym": "라틴어 ficatum(간; '무화과' ficus에서 파생)에서 온 속라틴어 *feticare에서 유래했어요. 비유적으로 '꼼짝 못 하게 굳히다'로도 써요.",
        "ex": {
          "fr": "La peur l'a figé sur place.",
          "ko": "공포가 그를 그 자리에 얼어붙게 했어요."
        }
      },
      {
        "fr": "solder",
        "ipa": "[sɔlde]",
        "ko": "할인 판매하다; (결과로) 끝나다",
        "pos": "v.",
        "etym": "이탈리아어 saldo(잔액)에서 왔어요. 'se solder par(~로 귀결되다)' 표현으로도 자주 써요.",
        "ex": {
          "fr": "La négociation s'est soldée par un échec.",
          "ko": "협상은 결국 실패로 끝났어요."
        }
      },
      {
        "fr": "réapprendre",
        "ipa": "[ʁeapʁɑ̃dʁ]",
        "ko": "다시 배우다, 재학습하다",
        "pos": "v.",
        "etym": "접두사 ré(다시)+apprendre(배우다)에서 왔어요.",
        "ex": {
          "fr": "Après l'accident, il a dû réapprendre à marcher.",
          "ko": "사고 후에 그는 걷는 법을 다시 배워야 했어요."
        }
      },
      {
        "fr": "verrouiller",
        "ipa": "[veʁuje]",
        "ko": "빗장을 걸다, 잠그다, 봉쇄하다",
        "pos": "v.",
        "etym": "명사 verrou(빗장)에서 왔어요. 비유적으로 '단단히 틀어쥐다'로도 써요.",
        "ex": {
          "fr": "Le parti a verrouillé tout le débat interne.",
          "ko": "그 정당은 내부 논의를 완전히 봉쇄했어요."
        }
      },
      {
        "fr": "focaliser",
        "ipa": "[fɔkalize]",
        "ko": "초점을 맞추다, 집중시키다",
        "pos": "v.",
        "en": "to focus",
        "etym": "라틴어 focus(화덕, 초점)에서 왔고, 영어 focus와 같은 뿌리예요.",
        "ex": {
          "fr": "Le débat se focalise trop sur un seul aspect.",
          "ko": "그 논쟁은 한 측면에만 지나치게 초점을 맞추고 있어요."
        }
      },
      {
        "fr": "quantifier",
        "ipa": "[kɑ̃tifje]",
        "ko": "수량화하다, 정량화하다",
        "pos": "v.",
        "en": "to quantify",
        "etym": "라틴어 quantus(얼마)에서 왔고, 영어 quantify와 같은 뿌리예요.",
        "ex": {
          "fr": "Il est difficile de quantifier ce phénomène.",
          "ko": "이 현상을 수량화하기는 어려워요."
        }
      },
      {
        "fr": "alerter",
        "ipa": "[alɛʁte]",
        "ko": "경고하다, 알리다",
        "pos": "v.",
        "en": "to alert",
        "etym": "이탈리아어 all'erta(경계 태세로)에서 왔고, 영어 alert와 같은 뿌리예요.",
        "ex": {
          "fr": "Les scientifiques alertent sur le réchauffement.",
          "ko": "과학자들이 온난화에 대해 경고하고 있어요."
        }
      },
      {
        "fr": "exhiber",
        "ipa": "[ɛɡzibe]",
        "ko": "과시하다, 드러내 보이다",
        "pos": "v.",
        "en": "to exhibit",
        "etym": "라틴어 exhibere(내보이다)에서 왔어요. 영어 exhibit와 같은 뿌리지만, 프랑스어 exhiber는 '과시하다'라는 부정적 뉘앙스가 강해요.",
        "ex": {
          "fr": "Il aime exhiber sa richesse.",
          "ko": "그는 자기 부를 과시하기를 좋아해요."
        }
      },
      {
        "fr": "feuilleter",
        "ipa": "[fœjte]",
        "ko": "(책장을) 넘겨 보다, 훑어보다",
        "pos": "v.",
        "etym": "프랑스어 feuille(잎, 종이장)에서 왔어요.",
        "ex": {
          "fr": "Elle feuillette distraitement une revue.",
          "ko": "그녀는 잡지를 건성으로 훑어보고 있어요."
        }
      },
      {
        "fr": "puiser",
        "ipa": "[pɥize]",
        "ko": "(물 등을) 긷다, (자원·영감을) 끌어내다",
        "pos": "v.",
        "ex": {
          "fr": "L'écrivain puise son inspiration dans son enfance.",
          "ko": "그 작가는 어린 시절에서 영감을 길어 올려요."
        }
      },
      {
        "fr": "déjouer",
        "ipa": "[deʒwe]",
        "ko": "(음모 등을) 좌절시키다, 무산시키다",
        "pos": "v.",
        "ex": {
          "fr": "La police a déjoué un attentat.",
          "ko": "경찰이 테러 시도를 무산시켰어요."
        }
      },
      {
        "fr": "interviewer",
        "ipa": "[ɛ̃tɛʁvjuve]",
        "ko": "인터뷰하다, 면담하다",
        "pos": "v.",
        "en": "to interview",
        "etym": "영어 interview를 그대로 들여온 차용어예요.",
        "ex": {
          "fr": "Le journaliste a interviewé le ministre.",
          "ko": "기자가 장관을 인터뷰했어요."
        }
      },
      {
        "fr": "s'adonner",
        "ipa": "[adɔne]",
        "ko": "몰두하다, 빠져들다",
        "pos": "v.pron.",
        "ex": {
          "fr": "Il s'adonne entièrement à la peinture.",
          "ko": "그는 그림에 온전히 몰두해요."
        }
      },
      {
        "fr": "réutiliser",
        "ipa": "[ʁeytilize]",
        "ko": "재사용하다",
        "pos": "v.",
        "en": "to reuse",
        "etym": "라틴어 re-(다시)+utilis(쓸모 있는)에서 왔고, 영어 reuse와 같은 뿌리예요.",
        "ex": {
          "fr": "On peut réutiliser ces emballages.",
          "ko": "이 포장재는 재사용할 수 있어요."
        }
      },
      {
        "fr": "fuser",
        "ipa": "[fyze]",
        "ko": "터져 나오다, 솟구치다",
        "pos": "v.",
        "ex": {
          "fr": "Les rires ont fusé dans la salle.",
          "ko": "웃음이 객석에서 터져 나왔어요."
        }
      },
      {
        "fr": "cogner",
        "ipa": "[kɔɲe]",
        "ko": "치다, 부딪치다",
        "pos": "v.",
        "ex": {
          "fr": "Il s'est cogné la tête contre la porte.",
          "ko": "그는 문에 머리를 부딪쳤어요."
        }
      },
      {
        "fr": "se faufiler",
        "ipa": "[fofile]",
        "ko": "비집고 들어가다, 슬그머니 빠져나가다",
        "pos": "v.pron.",
        "ex": {
          "fr": "Il s'est faufilé entre les voitures.",
          "ko": "그는 차들 사이를 비집고 빠져나갔어요."
        }
      },
      {
        "fr": "s'écrouler",
        "ipa": "[ekʁule]",
        "ko": "무너지다, 붕괴하다",
        "pos": "v.pron.",
        "ex": {
          "fr": "Le vieux mur s'est écroulé d'un coup.",
          "ko": "낡은 벽이 한순간에 무너졌어요."
        }
      },
      {
        "fr": "piétiner",
        "ipa": "[pjetine]",
        "ko": "짓밟다; 제자리걸음 하다",
        "pos": "v.",
        "ex": {
          "fr": "Les négociations piétinent depuis des mois.",
          "ko": "협상이 몇 달째 제자리걸음이에요."
        }
      },
      {
        "fr": "interagir",
        "ipa": "[ɛ̃teʁaʒiʁ]",
        "ko": "상호 작용하다",
        "pos": "v.",
        "en": "to interact",
        "etym": "라틴어 inter-(사이에)+agere(행하다)에서 왔고, 영어 interact와 같은 뿌리예요.",
        "ex": {
          "fr": "Ces deux facteurs interagissent fortement.",
          "ko": "이 두 요인은 강하게 상호 작용해요."
        }
      },
      {
        "fr": "s'impatienter",
        "ipa": "[ɛ̃pasjɑ̃te]",
        "ko": "초조해하다, 안달하다",
        "pos": "v.pron.",
        "ex": {
          "fr": "Les clients commençaient à s'impatienter.",
          "ko": "손님들이 초조해하기 시작했어요."
        }
      },
      {
        "fr": "pomper",
        "ipa": "[pɔ̃pe]",
        "ko": "(펌프로) 퍼올리다, 빨아들이다",
        "pos": "v.",
        "en": "to pump",
        "ex": {
          "fr": "On pompe l'eau du puits avec une machine.",
          "ko": "기계로 우물에서 물을 퍼올려요."
        }
      },
      {
        "fr": "simplifier",
        "ipa": "[sɛ̃plifje]",
        "ko": "단순화하다, 간소화하다",
        "pos": "v.",
        "en": "to simplify",
        "etym": "라틴어 simplex(단순한)에서 왔어요. 영어 simplify와 같은 뿌리예요.",
        "ex": {
          "fr": "Cette réforme vise à simplifier les démarches administratives.",
          "ko": "이 개혁은 행정 절차를 간소화하는 것을 목표로 해요."
        }
      },
      {
        "fr": "inhiber",
        "ipa": "[inibe]",
        "ko": "억제하다, 위축시키다",
        "pos": "v.",
        "en": "to inhibit",
        "etym": "라틴어 inhibere(막다)에서 왔어요. 영어 inhibit과 같은 뿌리예요.",
        "ex": {
          "fr": "Le stress peut inhiber les capacités de mémorisation.",
          "ko": "스트레스는 기억력을 억제할 수 있어요."
        }
      },
      {
        "fr": "paralyser",
        "ipa": "[paʁalize]",
        "ko": "마비시키다, 마비되게 하다",
        "pos": "v.",
        "en": "to paralyze",
        "etym": "그리스어 paralusis(마비)에서 왔어요. 영어 paralyze와 같은 뿌리예요.",
        "ex": {
          "fr": "La grève a paralysé tout le réseau ferroviaire.",
          "ko": "파업이 철도망 전체를 마비시켰어요."
        }
      },
      {
        "fr": "transiter",
        "ipa": "[tʁɑ̃zite]",
        "ko": "경유하다, 통과하다",
        "pos": "v.",
        "en": "to transit",
        "etym": "라틴어 transire(가로질러 가다)에서 왔어요. 영어 transit과 같은 뿌리예요.",
        "ex": {
          "fr": "Les marchandises transitent par le port de Marseille.",
          "ko": "상품들은 마르세유 항구를 경유해요."
        }
      },
      {
        "fr": "anéantir",
        "ipa": "[aneɑ̃tiʁ]",
        "ko": "전멸시키다, 완전히 파괴하다; (사람을) 망연자실하게 하다",
        "pos": "v.",
        "etym": "à + néant(무, 무존재)에서 왔어요. '무로 만들다'라는 뜻이에요.",
        "ex": {
          "fr": "La nouvelle l'a complètement anéanti.",
          "ko": "그 소식은 그를 완전히 망연자실하게 했어요."
        }
      },
      {
        "fr": "dévaster",
        "ipa": "[devaste]",
        "ko": "황폐화하다, 파괴하다",
        "pos": "v.",
        "en": "to devastate",
        "etym": "라틴어 vastare(폐허로 만들다)에서 왔어요. 영어 devastate와 같은 뿌리예요.",
        "ex": {
          "fr": "L'ouragan a dévasté toute la côte.",
          "ko": "허리케인이 해안 전체를 황폐화했어요."
        }
      },
      {
        "fr": "truffer",
        "ipa": "[tʁyfe]",
        "ko": "잔뜩 채워 넣다, 가득 박아 넣다",
        "pos": "v.",
        "ex": {
          "fr": "Son discours était truffé de citations savantes.",
          "ko": "그의 연설은 학구적인 인용으로 가득 차 있었어요."
        }
      },
      {
        "fr": "pénaliser",
        "ipa": "[penalize]",
        "ko": "불리하게 하다, 벌하다, 페널티를 주다",
        "pos": "v.",
        "en": "to penalize",
        "etym": "라틴어 poena(벌)에서 왔어요. 영어 penalize와 같은 뿌리예요.",
        "ex": {
          "fr": "Cette mesure pénalise lourdement les petites entreprises.",
          "ko": "이 조치는 소규모 기업에 큰 불이익을 줘요."
        }
      },
      {
        "fr": "rôder",
        "ipa": "[ʁode]",
        "ko": "어슬렁거리다, 배회하다",
        "pos": "v.",
        "ex": {
          "fr": "Un individu suspect rôdait autour de l'immeuble.",
          "ko": "수상한 사람이 건물 주변을 어슬렁거리고 있었어요."
        }
      },
      {
        "fr": "cosigner",
        "ipa": "[kosiɲe]",
        "ko": "공동 서명하다",
        "pos": "v.",
        "en": "to cosign",
        "etym": "co(함께)+signer(서명하다) — 영어 cosign과 같은 구성이에요.",
        "ex": {
          "fr": "Plusieurs chercheurs ont cosigné cet article.",
          "ko": "여러 연구자가 이 논문에 공동 서명했어요."
        }
      },
      {
        "fr": "traquer",
        "ipa": "[tʁake]",
        "ko": "추적하다, 끈질기게 뒤쫓다",
        "pos": "v.",
        "en": "to track",
        "etym": "영어 track과 같은 뿌리예요.",
        "ex": {
          "fr": "La police traque les responsables du réseau.",
          "ko": "경찰이 그 조직의 책임자들을 추적하고 있어요."
        }
      },
      {
        "fr": "fidéliser",
        "ipa": "[fidelize]",
        "ko": "단골로 만들다, 충성 고객으로 유지하다",
        "pos": "v.",
        "etym": "라틴어 fidelis(충실한)에서 왔어요. 영어 fidelity와 같은 뿌리예요.",
        "ex": {
          "fr": "Cette marque cherche à fidéliser sa clientèle.",
          "ko": "이 브랜드는 고객을 단골로 만들려고 해요."
        }
      },
      {
        "fr": "conditionner",
        "ipa": "[kɔ̃disjɔne]",
        "ko": "좌우하다, 결정짓다; (제품을) 포장하다",
        "pos": "v.",
        "en": "to condition",
        "etym": "라틴어 condicio(조건)에서 왔어요. 영어 condition과 같은 뿌리예요.",
        "ex": {
          "fr": "Le climat conditionne fortement l'agriculture de la région.",
          "ko": "기후가 그 지역의 농업을 크게 좌우해요."
        }
      },
      {
        "fr": "ficher",
        "ipa": "[fiʃe]",
        "ko": "(자료를) 카드·파일로 정리하다, 명단에 올리다",
        "pos": "v.",
        "ex": {
          "fr": "La police a fiché plusieurs militants.",
          "ko": "경찰이 여러 활동가를 명단에 올렸어요."
        }
      },
      {
        "fr": "activer",
        "ipa": "[aktive]",
        "ko": "활성화하다, 작동시키다; 서두르다",
        "pos": "v.",
        "en": "to activate",
        "etym": "라틴어 activus(활동적인)에서 왔어요. 영어 activate와 같은 뿌리예요.",
        "ex": {
          "fr": "Il faut activer cette fonction dans les paramètres.",
          "ko": "설정에서 이 기능을 활성화해야 해요."
        }
      },
      {
        "fr": "trinquer",
        "ipa": "[tʁɛ̃ke]",
        "ko": "건배하다, 잔을 부딪치다; (구어) 손해를 보다",
        "pos": "v.",
        "ex": {
          "fr": "Nous avons trinqué à la réussite du projet.",
          "ko": "우리는 프로젝트의 성공을 위해 건배했어요."
        }
      },
      {
        "fr": "culpabiliser",
        "ipa": "[kylpabilize]",
        "ko": "죄책감을 느끼게 하다, 죄책감을 느끼다",
        "pos": "v.",
        "etym": "라틴어 culpa(잘못, 죄)에서 왔어요. 영어 culpable(유죄의)과 같은 뿌리예요.",
        "ex": {
          "fr": "Il ne faut pas culpabiliser les victimes.",
          "ko": "피해자들에게 죄책감을 느끼게 해서는 안 돼요."
        }
      },
      {
        "fr": "se cramponner",
        "ipa": "[kʁɑ̃pɔne]",
        "ko": "꽉 매달리다, 집요하게 붙잡다",
        "pos": "v.pron.",
        "ex": {
          "fr": "Elle se cramponne à ses anciennes habitudes.",
          "ko": "그녀는 옛 습관에 집요하게 매달려요."
        }
      },
      {
        "fr": "se démener",
        "ipa": "[demne]",
        "ko": "발버둥 치다, 갖은 애를 쓰다",
        "pos": "v.pron.",
        "ex": {
          "fr": "Elle se démène pour faire aboutir son projet.",
          "ko": "그녀는 프로젝트를 성사시키려고 갖은 애를 써요."
        }
      },
      {
        "fr": "basculer",
        "ipa": "[baskyle]",
        "ko": "기울어지다, (한쪽으로) 넘어가다, 급변하다",
        "pos": "v.",
        "ex": {
          "fr": "La situation a brusquement basculé dans la violence.",
          "ko": "상황이 갑자기 폭력 사태로 급변했어요."
        }
      },
      {
        "fr": "emballer",
        "ipa": "[ɑ̃bale]",
        "ko": "포장하다; (구어) 열광하게 하다, 매료하다",
        "pos": "v.",
        "ex": {
          "fr": "Ce projet a vraiment emballé toute l'équipe.",
          "ko": "이 프로젝트는 정말 팀 전체를 열광하게 했어요."
        }
      },
      {
        "fr": "infiltrer",
        "ipa": "[ɛ̃filtʁe]",
        "ko": "침투시키다, 스며들게 하다; (s'~) 잠입하다",
        "pos": "v.",
        "en": "to infiltrate",
        "etym": "라틴어 filtrum(여과기)에서 왔어요. 영어 infiltrate와 같은 뿌리예요.",
        "ex": {
          "fr": "Un agent a réussi à infiltrer le réseau criminel.",
          "ko": "한 요원이 범죄 조직에 잠입하는 데 성공했어요."
        }
      },
      {
        "fr": "féminiser",
        "ipa": "[feminize]",
        "ko": "여성화하다, (직종에) 여성 비율을 높이다",
        "pos": "v.",
        "etym": "라틴어 femina(여자)에서 왔어요. 영어 feminine과 같은 뿌리예요.",
        "ex": {
          "fr": "La profession s'est largement féminisée ces dernières années.",
          "ko": "이 직종은 최근 몇 년 사이 여성 비율이 크게 높아졌어요."
        }
      }
    ]
  },
  {
    "name": "문어와 논증의 동사",
    "icon": "✍️",
    "words": [
      {
        "fr": "déplorer",
        "ipa": "[deplɔʁe]",
        "ko": "유감스러워하다, 개탄하다",
        "pos": "v.",
        "en": "to deplore",
        "etym": "라틴어 deplorare(슬퍼하다) — 영어 deplore와 같은 뿌리예요.",
        "ex": {
          "fr": "Les autorités déplorent plusieurs victimes.",
          "ko": "당국은 여러 희생자가 발생한 것을 애통해해요."
        }
      },
      {
        "fr": "prévaloir",
        "ipa": "[pʁevalwaʁ]",
        "ko": "우세하다, 우위를 차지하다",
        "pos": "v.",
        "en": "to prevail",
        "etym": "라틴어 praevalere(더 강하다) — 영어 prevail과 같은 뿌리예요.",
        "ex": {
          "fr": "C'est le bon sens qui doit prévaloir.",
          "ko": "결국 상식이 우세해야 해요."
        }
      },
      {
        "fr": "engendrer",
        "ipa": "[ɑ̃ʒɑ̃dʁe]",
        "ko": "초래하다, 야기하다; 낳다",
        "pos": "v.",
        "en": "to engender",
        "etym": "라틴어 ingenerare(낳다) — 영어 engender와 같은 뿌리예요.",
        "ex": {
          "fr": "Cette politique a engendré de fortes inégalités.",
          "ko": "이 정책은 심한 불평등을 초래했어요."
        }
      },
      {
        "fr": "persister",
        "ipa": "[pɛʁsiste]",
        "ko": "지속되다; 고집하다",
        "pos": "v.",
        "en": "to persist",
        "etym": "라틴어 persistere(끝까지 버티다) — 영어 persist와 같은 뿌리예요.",
        "ex": {
          "fr": "Si les symptômes persistent, consultez un médecin.",
          "ko": "증상이 계속되면 의사와 상담하세요."
        }
      },
      {
        "fr": "compenser",
        "ipa": "[kɔ̃pɑ̃se]",
        "ko": "보상하다, 메우다, 상쇄하다",
        "pos": "v.",
        "en": "to compensate",
        "etym": "라틴어 compensare(저울질하다) — 영어 compensate와 같은 뿌리예요.",
        "ex": {
          "fr": "Les profits ne compensent pas les pertes.",
          "ko": "이익이 손실을 메우지 못해요."
        }
      },
      {
        "fr": "découler",
        "ipa": "[dekule]",
        "ko": "(결과로서) 비롯되다, 따라 나오다",
        "pos": "v.",
        "ex": {
          "fr": "Ces problèmes découlent d'un manque de moyens.",
          "ko": "이 문제들은 재원 부족에서 비롯돼요."
        }
      },
      {
        "fr": "façonner",
        "ipa": "[fasɔne]",
        "ko": "빚다, 형성하다, 만들어 내다",
        "pos": "v.",
        "ex": {
          "fr": "L'histoire a façonné l'identité de ce peuple.",
          "ko": "역사가 이 민족의 정체성을 빚어냈어요."
        }
      },
      {
        "fr": "concourir",
        "ipa": "[kɔ̃kuʁiʁ]",
        "ko": "경쟁하다, 출전하다; (함께) 기여하다",
        "pos": "v.",
        "en": "to compete / concur",
        "etym": "라틴어 concurrere(함께 달리다) — 영어 concur와 같은 뿌리예요.",
        "ex": {
          "fr": "Dix candidats concourent pour ce poste.",
          "ko": "열 명의 지원자가 이 자리를 두고 경쟁해요."
        }
      },
      {
        "fr": "exonérer",
        "ipa": "[ɛɡzɔneʁe]",
        "ko": "면제하다, (책임을) 벗겨 주다",
        "pos": "v.",
        "en": "exonerate",
        "etym": "라틴어 ex(밖)+onus(짐) — 영어 exonerate와 같은 뿌리예요. 프랑스어에서는 특히 '세금·부담을 면제하다'로 자주 써요.",
        "ex": {
          "fr": "Cette mesure exonère les petites entreprises de cette taxe.",
          "ko": "이 조치는 소기업을 이 세금에서 면제해 줘요."
        }
      },
      {
        "fr": "s'empresser",
        "ipa": "[ɑ̃pʁese]",
        "ko": "서둘러 ~하다, 부랴부랴 ~하다",
        "pos": "v.pron.",
        "etym": "presser(서두르다)에서 온 대명동사예요. 's'empresser de + 동사원형' 형태로 써요.",
        "ex": {
          "fr": "Il s'est empressé de répondre à l'invitation.",
          "ko": "그는 서둘러 초대에 답했어요."
        }
      },
      {
        "fr": "médiatiser",
        "ipa": "[medjatize]",
        "ko": "언론에 널리 알리다, 미디어로 다루다",
        "pos": "v.",
        "etym": "média(미디어)에서 온 동사예요. 흔히 수동형 'être médiatisé'로 '크게 보도되다'라는 뜻이에요.",
        "ex": {
          "fr": "Cette affaire a été très médiatisée.",
          "ko": "이 사건은 언론에 크게 보도되었어요."
        }
      },
      {
        "fr": "prohiber",
        "ipa": "[pʁɔibe]",
        "ko": "금지하다",
        "pos": "v.",
        "en": "prohibit",
        "etym": "라틴어 prohibere(막다) — 영어 prohibit과 같은 뿌리예요. 법률·행정 문맥의 격식 있는 단어예요.",
        "ex": {
          "fr": "La loi prohibe la vente de ces substances.",
          "ko": "법은 이 물질들의 판매를 금지해요."
        }
      },
      {
        "fr": "offenser",
        "ipa": "[ɔfɑ̃se]",
        "ko": "모욕하다, 기분 상하게 하다",
        "pos": "v.",
        "en": "offend",
        "etym": "라틴어 offendere(부딪치다, 상하게 하다) — 영어 offend와 같은 뿌리예요.",
        "ex": {
          "fr": "Je ne voulais pas vous offenser.",
          "ko": "당신을 모욕할 생각은 없었어요."
        }
      },
      {
        "fr": "reléguer",
        "ipa": "[ʁəleɡe]",
        "ko": "밀어내다, 강등시키다, 뒷전으로 두다",
        "pos": "v.",
        "en": "relegate",
        "etym": "라틴어 re(다시)+legare(보내다) — 영어 relegate와 같은 뿌리예요.",
        "ex": {
          "fr": "Ce sujet a été relégué au second plan.",
          "ko": "이 주제는 뒷전으로 밀려났어요."
        }
      },
      {
        "fr": "délibérer",
        "ipa": "[delibeʁe]",
        "ko": "심의하다, 숙의하다",
        "pos": "v.",
        "en": "deliberate",
        "etym": "라틴어 deliberare(숙고하다) — 영어 deliberate와 같은 뿌리예요.",
        "ex": {
          "fr": "Le jury va se retirer pour délibérer.",
          "ko": "배심원단은 심의를 위해 물러날 거예요."
        }
      },
      {
        "fr": "frustrer",
        "ipa": "[fʁystʁe]",
        "ko": "좌절시키다, 욕구를 채우지 못하게 하다",
        "pos": "v.",
        "en": "frustrate",
        "etym": "라틴어 frustrari(헛되게 하다) — 영어 frustrate와 같은 뿌리예요.",
        "ex": {
          "fr": "Ce manque de reconnaissance le frustre beaucoup.",
          "ko": "이런 인정 부족이 그를 무척 좌절시켜요."
        }
      },
      {
        "fr": "structurer",
        "ipa": "[stʁyktyʁe]",
        "ko": "구조화하다, 체계화하다",
        "pos": "v.",
        "en": "structure",
        "etym": "라틴어 structura(짜임새) — 영어 structure와 같은 뿌리예요.",
        "ex": {
          "fr": "Il faut mieux structurer cette argumentation.",
          "ko": "이 논증을 더 잘 구조화해야 해요."
        }
      },
      {
        "fr": "se conformer",
        "ipa": "[kɔ̃fɔʁme]",
        "ko": "(규칙 등에) 따르다, 순응하다",
        "pos": "v.pron.",
        "en": "to conform",
        "etym": "라틴어 conformare(형태를 맞추다)에서 왔고, 영어 conform과 같은 뿌리예요.",
        "ex": {
          "fr": "Chacun doit se conformer au règlement.",
          "ko": "모두가 규정에 따라야 해요."
        }
      },
      {
        "fr": "assouvir",
        "ipa": "[asuviʁ]",
        "ko": "(욕구를) 채우다, 충족시키다",
        "pos": "v.",
        "ex": {
          "fr": "Rien ne pouvait assouvir sa soif de savoir.",
          "ko": "그 무엇도 그의 지식욕을 채워 줄 수 없었어요."
        }
      },
      {
        "fr": "exporter",
        "ipa": "[ɛkspɔʁte]",
        "ko": "수출하다",
        "pos": "v.",
        "en": "to export",
        "etym": "라틴어 ex-(밖으로)+portare(나르다)에서 왔고, 영어 export와 같은 뿌리예요.",
        "ex": {
          "fr": "Ce pays exporte beaucoup de vin.",
          "ko": "이 나라는 포도주를 많이 수출해요."
        }
      },
      {
        "fr": "énoncer",
        "ipa": "[enɔ̃se]",
        "ko": "(원칙·생각을) 진술하다, 표명하다",
        "pos": "v.",
        "en": "to enunciate / to state",
        "etym": "라틴어 enuntiare(알리다)에서 왔어요. 영어 enunciate와 같은 뿌리예요.",
        "ex": {
          "fr": "L'auteur énonce clairement sa thèse dès l'introduction.",
          "ko": "저자는 서론에서부터 자신의 논제를 명확히 진술해요."
        }
      },
      {
        "fr": "décéder",
        "ipa": "[desede]",
        "ko": "사망하다, 별세하다",
        "pos": "v.",
        "en": "to decease",
        "etym": "라틴어 decedere(떠나다)에서 왔어요. 영어 deceased와 같은 뿌리예요. mourir보다 격식 있는 표현이에요.",
        "ex": {
          "fr": "L'ancien président est décédé à l'âge de quatre-vingts ans.",
          "ko": "전 대통령이 여든 살의 나이로 별세했어요."
        }
      },
      {
        "fr": "légitimer",
        "ipa": "[leʒitime]",
        "ko": "정당화하다, 합법화하다",
        "pos": "v.",
        "en": "to legitimize",
        "etym": "라틴어 legitimus(합법적인)에서 왔어요. 영어 legitimate와 같은 뿌리예요.",
        "ex": {
          "fr": "Rien ne peut légitimer un tel comportement.",
          "ko": "그 어떤 것도 그런 행동을 정당화할 수 없어요."
        }
      },
      {
        "fr": "renfermer",
        "ipa": "[ʁɑ̃fɛʁme]",
        "ko": "내포하다, 담고 있다, 안에 가두다",
        "pos": "v.",
        "ex": {
          "fr": "Ce texte renferme une critique implicite du pouvoir.",
          "ko": "이 글은 권력에 대한 암묵적 비판을 담고 있어요."
        }
      }
    ]
  },
  {
    "name": "정밀한 형용사와 부사",
    "icon": "🎨",
    "words": [
      {
        "fr": "raciste",
        "ipa": "[ʁasist]",
        "ko": "인종차별적인",
        "pos": "adj.",
        "en": "racist",
        "ex": {
          "fr": "Ces propos racistes ont été condamnés.",
          "ko": "그 인종차별적 발언은 규탄받았어요."
        }
      },
      {
        "fr": "créatif / créative",
        "ipa": "[kʁeatif / kʁeativ]",
        "ko": "창의적인, 창조적인",
        "pos": "adj.",
        "en": "creative",
        "ex": {
          "fr": "Elle a une approche très créative du problème.",
          "ko": "그녀는 문제에 아주 창의적으로 접근해요."
        }
      },
      {
        "fr": "aviaire",
        "ipa": "[avjɛʁ]",
        "ko": "조류의 (특히 조류 질병)",
        "pos": "adj.",
        "etym": "라틴어 avis(새)에서 — 영어 avian과 같은 뿌리예요.",
        "ex": {
          "fr": "La grippe aviaire inquiète les éleveurs.",
          "ko": "조류 독감이 사육 농가를 불안하게 해요."
        }
      },
      {
        "fr": "mental / mentale",
        "ipa": "[mɑ̃tal / mɑ̃tal]",
        "ko": "정신의, 심리적인",
        "pos": "adj.",
        "en": "mental",
        "etym": "라틴어 mens(정신) — 영어 mental과 같은 뿌리예요.",
        "ex": {
          "fr": "La santé mentale est un enjeu majeur.",
          "ko": "정신 건강은 중요한 문제예요."
        }
      },
      {
        "fr": "électromagnétique",
        "ipa": "[elɛktʁɔmaɲetik]",
        "ko": "전자기의",
        "pos": "adj.",
        "en": "electromagnetic",
        "ex": {
          "fr": "Les ondes électromagnétiques sont invisibles.",
          "ko": "전자기파는 눈에 보이지 않아요."
        }
      },
      {
        "fr": "purement",
        "ipa": "[pyʁmɑ̃]",
        "ko": "순전히, 오로지",
        "pos": "adv.",
        "ex": {
          "fr": "C'est une décision purement administrative.",
          "ko": "이건 순전히 행정적인 결정이에요."
        }
      },
      {
        "fr": "musculaire",
        "ipa": "[myskylɛʁ]",
        "ko": "근육의",
        "pos": "adj.",
        "en": "muscular",
        "etym": "라틴어 musculus(근육) — 영어 muscular와 같은 뿌리예요.",
        "ex": {
          "fr": "Il souffre d'une douleur musculaire au dos.",
          "ko": "그는 등에 근육통이 있어요."
        }
      },
      {
        "fr": "parlementaire",
        "ipa": "[paʁləmɑ̃tɛʁ]",
        "ko": "의회의, 국회의",
        "pos": "adj.",
        "en": "parliamentary",
        "ex": {
          "fr": "Le débat parlementaire a duré toute la nuit.",
          "ko": "의회 토론이 밤새 이어졌어요."
        }
      },
      {
        "fr": "résistant / résistante",
        "ipa": "[ʁezistɑ̃ / ʁezistɑ̃t]",
        "ko": "저항력 있는, 견고한; 내성이 있는",
        "pos": "adj.",
        "en": "resistant",
        "ex": {
          "fr": "Cette bactérie est résistante aux antibiotiques.",
          "ko": "이 박테리아는 항생제에 내성이 있어요."
        }
      },
      {
        "fr": "atomique",
        "ipa": "[atɔmik]",
        "ko": "원자의, 원자력의",
        "pos": "adj.",
        "en": "atomic",
        "etym": "그리스어 atomos(나눌 수 없는) — 영어 atomic과 같은 뿌리예요.",
        "ex": {
          "fr": "L'énergie atomique soulève de vifs débats.",
          "ko": "원자력 에너지는 격렬한 논쟁을 일으켜요."
        }
      },
      {
        "fr": "théorique",
        "ipa": "[teɔʁik]",
        "ko": "이론적인",
        "pos": "adj.",
        "en": "theoretical",
        "etym": "그리스어 theôria(관찰·고찰) — 영어 theoretical과 같은 뿌리예요.",
        "ex": {
          "fr": "Cette distinction reste purement théorique.",
          "ko": "이 구분은 순전히 이론적인 것에 그쳐요."
        }
      },
      {
        "fr": "provocateur / provocatrice",
        "ipa": "[pʁɔvɔkatœʁ / pʁɔvɔkatʁis]",
        "ko": "도발적인, 자극적인",
        "pos": "adj.",
        "en": "provocative",
        "etym": "라틴어 provocare(불러일으키다) — 영어 provocative와 같은 뿌리예요.",
        "ex": {
          "fr": "Il a tenu des propos volontairement provocateurs.",
          "ko": "그는 일부러 도발적인 발언을 했어요."
        }
      },
      {
        "fr": "préférable",
        "ipa": "[pʁefeʁabl]",
        "ko": "더 나은, 바람직한",
        "pos": "adj.",
        "en": "preferable",
        "etym": "라틴어 praeferre(더 좋아하다) — 영어 preferable과 같은 뿌리예요.",
        "ex": {
          "fr": "Il est préférable de réserver à l'avance.",
          "ko": "미리 예약하는 편이 좋아요."
        }
      },
      {
        "fr": "durablement",
        "ipa": "[dyʁabləmɑ̃]",
        "ko": "지속적으로, 오래도록",
        "pos": "adv.",
        "ex": {
          "fr": "Cette crise a durablement marqué l'économie.",
          "ko": "이 위기는 경제에 오래도록 흔적을 남겼어요."
        }
      },
      {
        "fr": "respiratoire",
        "ipa": "[ʁɛspiʁatwaʁ]",
        "ko": "호흡의, 호흡기의",
        "pos": "adj.",
        "en": "respiratory",
        "etym": "라틴어 respirare(숨 쉬다) — 영어 respiratory와 같은 뿌리예요.",
        "ex": {
          "fr": "La pollution aggrave les maladies respiratoires.",
          "ko": "공해는 호흡기 질환을 악화시켜요."
        }
      },
      {
        "fr": "respectable",
        "ipa": "[ʁɛspɛktabl]",
        "ko": "존경할 만한; 상당한 (규모)",
        "pos": "adj.",
        "en": "respectable",
        "ex": {
          "fr": "C'est une institution tout à fait respectable.",
          "ko": "그곳은 아주 존경받을 만한 기관이에요."
        }
      },
      {
        "fr": "fiable",
        "ipa": "[fjabl]",
        "ko": "믿을 만한, 신뢰할 수 있는",
        "pos": "adj.",
        "ex": {
          "fr": "Ces données proviennent d'une source fiable.",
          "ko": "이 자료는 신뢰할 수 있는 출처에서 나왔어요."
        }
      },
      {
        "fr": "lucide",
        "ipa": "[lysid]",
        "ko": "명석한, 명철한; 의식이 또렷한",
        "pos": "adj.",
        "en": "lucid",
        "etym": "라틴어 lucidus(밝은) — 영어 lucid와 같은 뿌리예요.",
        "ex": {
          "fr": "Il porte un regard lucide sur la situation.",
          "ko": "그는 상황을 명철하게 보고 있어요."
        }
      },
      {
        "fr": "organique",
        "ipa": "[ɔʁɡanik]",
        "ko": "유기의, 유기적인; 기관의",
        "pos": "adj.",
        "en": "organic",
        "etym": "그리스어 organon(기관·도구) — 영어 organic과 같은 뿌리예요.",
        "ex": {
          "fr": "La chimie organique étudie les composés du carbone.",
          "ko": "유기 화학은 탄소 화합물을 연구해요."
        }
      },
      {
        "fr": "fossile",
        "ipa": "[fɔsil]",
        "ko": "화석의; 화석 (명사)",
        "pos": "adj.",
        "en": "fossil",
        "etym": "라틴어 fossilis(파낸) — 영어 fossil과 같은 뿌리예요.",
        "ex": {
          "fr": "Il faut réduire notre dépendance aux énergies fossiles.",
          "ko": "화석 연료에 대한 의존을 줄여야 해요."
        }
      },
      {
        "fr": "insensible",
        "ipa": "[ɛ̃sɑ̃sibl]",
        "ko": "무감각한, 무심한; 감지할 수 없는",
        "pos": "adj.",
        "en": "insensitive / imperceptible",
        "etym": "라틴어 in(부정)+sensibilis(느끼는) — 영어 insensible과 같은 뿌리지만, 영어 insensible('의식 없는')과 뜻이 달라요(faux ami).",
        "ex": {
          "fr": "Il reste insensible aux critiques.",
          "ko": "그는 비판에 끄떡도 하지 않아요."
        }
      },
      {
        "fr": "satisfaisant / satisfaisante",
        "ipa": "[satisfəzɑ̃ / satisfəzɑ̃t]",
        "ko": "만족스러운, 충분한",
        "pos": "adj.",
        "en": "satisfactory",
        "ex": {
          "fr": "Les résultats sont jugés satisfaisants.",
          "ko": "결과는 만족스럽다고 평가돼요."
        }
      },
      {
        "fr": "minimal / minimale",
        "ipa": "[minimal / minimal]",
        "ko": "최소의, 최소한의",
        "pos": "adj.",
        "en": "minimal",
        "etym": "라틴어 minimus(가장 작은) — 영어 minimal과 같은 뿌리예요.",
        "ex": {
          "fr": "Le service minimal est assuré pendant la grève.",
          "ko": "파업 중에도 최소한의 서비스는 보장돼요."
        }
      },
      {
        "fr": "futuriste",
        "ipa": "[fytyʁist]",
        "ko": "미래적인, 미래지향적인",
        "pos": "adj.",
        "en": "futuristic",
        "ex": {
          "fr": "Le musée a une architecture futuriste.",
          "ko": "그 박물관은 미래적인 건축 양식을 갖고 있어요."
        }
      },
      {
        "fr": "mutuel / mutuelle",
        "ipa": "[mytɥɛl / mytɥɛl]",
        "ko": "상호의, 서로의",
        "pos": "adj.",
        "en": "mutual",
        "etym": "라틴어 mutuus(서로 주고받는) — 영어 mutual과 같은 뿌리예요.",
        "ex": {
          "fr": "Leur collaboration repose sur un respect mutuel.",
          "ko": "그들의 협력은 서로에 대한 존중에 기반해요."
        }
      },
      {
        "fr": "détestable",
        "ipa": "[detɛstabl]",
        "ko": "혐오스러운, 끔찍한",
        "pos": "adj.",
        "en": "detestable",
        "etym": "라틴어 detestari(저주하다) — 영어 detestable과 같은 뿌리예요.",
        "ex": {
          "fr": "Il était d'une humeur détestable ce matin.",
          "ko": "그는 오늘 아침 기분이 아주 고약했어요."
        }
      },
      {
        "fr": "intégré / intégrée",
        "ipa": "[ɛ̃teɡʁe / ɛ̃teɡʁe]",
        "ko": "통합된, 내장된",
        "pos": "adj.",
        "en": "integrated",
        "etym": "라틴어 integrare(완전하게 하다) — 영어 integrated와 같은 뿌리예요.",
        "ex": {
          "fr": "L'appareil possède une caméra intégrée.",
          "ko": "이 기기에는 카메라가 내장돼 있어요."
        }
      },
      {
        "fr": "sophistiqué / sophistiquée",
        "ipa": "[sɔfistike / sɔfistike]",
        "ko": "정교한, 세련된, 복잡한",
        "pos": "adj.",
        "en": "sophisticated",
        "ex": {
          "fr": "Ce système de sécurité est très sophistiqué.",
          "ko": "이 보안 시스템은 아주 정교해요."
        }
      },
      {
        "fr": "sanguin / sanguine",
        "ipa": "[sɑ̃ɡɛ̃ / sɑ̃ɡin]",
        "ko": "혈액의, 피의",
        "pos": "adj.",
        "etym": "라틴어 sanguis(피) — 영어 sanguine과 같은 뿌리지만, 영어 sanguine('낙천적인')과 뜻이 달라요(faux ami).",
        "ex": {
          "fr": "Il faut surveiller sa tension sanguine.",
          "ko": "혈압을 잘 지켜봐야 해요."
        }
      },
      {
        "fr": "neuronal / neuronale",
        "ipa": "[nøʁɔnal / nøʁɔnal]",
        "ko": "신경의, 뉴런의",
        "pos": "adj.",
        "en": "neuronal",
        "etym": "그리스어 neuron(신경) — 영어 neuronal과 같은 뿌리예요. 남성형·여성형 발음은 같아요.",
        "ex": {
          "fr": "L'activité neuronale s'intensifie pendant le sommeil.",
          "ko": "신경 활동은 수면 중에 강해져요."
        }
      },
      {
        "fr": "sociologique",
        "ipa": "[sɔsjɔlɔʒik]",
        "ko": "사회학적인",
        "pos": "adj.",
        "en": "sociological",
        "etym": "라틴어 socius(동료)+그리스어 logos(학문) — 영어 sociological과 같은 뿌리예요.",
        "ex": {
          "fr": "Cette étude adopte une approche sociologique.",
          "ko": "이 연구는 사회학적 접근을 취해요."
        }
      },
      {
        "fr": "involontaire",
        "ipa": "[ɛ̃vɔlɔ̃tɛʁ]",
        "ko": "비자발적인, 무의식적인",
        "pos": "adj.",
        "en": "involuntary",
        "etym": "라틴어 in(부정)+voluntas(의지) — 영어 involuntary와 같은 뿌리예요.",
        "ex": {
          "fr": "Il a eu un geste involontaire de surprise.",
          "ko": "그는 놀라서 무의식적인 몸짓을 했어요."
        }
      },
      {
        "fr": "souhaitable",
        "ipa": "[swɛtabl]",
        "ko": "바람직한, 바랄 만한",
        "pos": "adj.",
        "etym": "동사 souhaiter(바라다)에서 온 형용사예요.",
        "ex": {
          "fr": "Il serait souhaitable de revoir ce calendrier.",
          "ko": "이 일정을 다시 검토하는 게 바람직할 거예요."
        }
      },
      {
        "fr": "fondamentalement",
        "ipa": "[fɔ̃damɑ̃talmɑ̃]",
        "ko": "근본적으로",
        "pos": "adv.",
        "en": "fundamentally",
        "etym": "라틴어 fundamentum(기초) — 영어 fundamentally와 같은 뿌리예요.",
        "ex": {
          "fr": "Nos points de vue sont fondamentalement différents.",
          "ko": "우리의 관점은 근본적으로 달라요."
        }
      },
      {
        "fr": "indigène",
        "ipa": "[ɛ̃diʒɛn]",
        "ko": "토착의, 원주민의",
        "pos": "adj.",
        "en": "indigenous",
        "etym": "라틴어 indigena(토박이) — 영어 indigenous와 같은 뿌리예요.",
        "ex": {
          "fr": "Cette plante indigène ne pousse que dans cette région.",
          "ko": "이 토착 식물은 이 지역에서만 자라요."
        }
      },
      {
        "fr": "matrimonial / matrimoniale",
        "ipa": "[matʁimɔnjal / matʁimɔnjal]",
        "ko": "혼인의, 결혼의",
        "pos": "adj.",
        "en": "matrimonial",
        "etym": "라틴어 matrimonium(혼인) — 영어 matrimonial과 같은 뿌리예요. 남성형·여성형 발음은 같아요.",
        "ex": {
          "fr": "Ils ont signé un contrat matrimonial avant le mariage.",
          "ko": "그들은 결혼 전에 혼인 계약을 맺었어요."
        }
      },
      {
        "fr": "expérimental / expérimentale",
        "ipa": "[ɛkspeʁimɑ̃tal / ɛkspeʁimɑ̃tal]",
        "ko": "실험적인, 실험의",
        "pos": "adj.",
        "en": "experimental",
        "etym": "라틴어 experimentum(시험, 경험) — 영어 experimental과 같은 뿌리예요. 남성형·여성형 발음은 같아요.",
        "ex": {
          "fr": "Ce traitement est encore au stade expérimental.",
          "ko": "이 치료법은 아직 실험 단계에 있어요."
        }
      },
      {
        "fr": "thermique",
        "ipa": "[tɛʁmik]",
        "ko": "열의, 열에 관한",
        "pos": "adj.",
        "en": "thermal",
        "etym": "그리스어 thermos(뜨거운) — 영어 thermal과 같은 뿌리예요.",
        "ex": {
          "fr": "L'isolation thermique de ce bâtiment est excellente.",
          "ko": "이 건물의 단열 성능은 훌륭해요."
        }
      },
      {
        "fr": "xénophobe",
        "ipa": "[ksenɔfɔb]",
        "ko": "외국인을 혐오하는, 외국인 혐오의",
        "pos": "adj.",
        "en": "xenophobic",
        "etym": "그리스어 xenos(이방인)+phobos(공포) — 영어 xenophobic과 같은 뿌리예요. 남녀 동형이에요.",
        "ex": {
          "fr": "Il a tenu des propos ouvertement xénophobes.",
          "ko": "그는 노골적으로 외국인 혐오 발언을 했어요."
        }
      },
      {
        "fr": "externe",
        "ipa": "[ɛkstɛʁn]",
        "ko": "외부의, 바깥의",
        "pos": "adj.",
        "en": "external",
        "etym": "라틴어 externus(바깥의) — 영어 external과 같은 뿌리예요. 남녀 동형이에요.",
        "ex": {
          "fr": "L'entreprise a fait appel à un consultant externe.",
          "ko": "그 회사는 외부 컨설턴트에게 의뢰했어요."
        }
      },
      {
        "fr": "inacceptable",
        "ipa": "[inaksɛptabl]",
        "ko": "용납할 수 없는, 받아들일 수 없는",
        "pos": "adj.",
        "en": "unacceptable",
        "etym": "라틴어 in(부정)+acceptare(받아들이다) — 영어 unacceptable과 같은 뿌리예요. 남녀 동형이에요.",
        "ex": {
          "fr": "Un tel comportement est tout à fait inacceptable.",
          "ko": "그런 행동은 전혀 용납할 수 없어요."
        }
      },
      {
        "fr": "simultanément",
        "ipa": "[simyltanemɑ̃]",
        "ko": "동시에",
        "pos": "adv.",
        "en": "simultaneously",
        "etym": "라틴어 simul(함께) — 영어 simultaneously와 같은 뿌리예요.",
        "ex": {
          "fr": "Les deux événements se sont produits simultanément.",
          "ko": "두 사건은 동시에 일어났어요."
        }
      },
      {
        "fr": "artificiellement",
        "ipa": "[aʁtifisjɛlmɑ̃]",
        "ko": "인위적으로, 인공적으로",
        "pos": "adv.",
        "en": "artificially",
        "etym": "라틴어 ars(기술)+facere(만들다) — 영어 artificially와 같은 뿌리예요.",
        "ex": {
          "fr": "Les prix ont été maintenus artificiellement bas.",
          "ko": "가격은 인위적으로 낮게 유지되었어요."
        }
      },
      {
        "fr": "multimédia",
        "ipa": "[myltimedja]",
        "ko": "멀티미디어의",
        "pos": "adj.",
        "en": "multimedia",
        "etym": "라틴어 multi(많은)+media(매체) — 영어 multimedia와 같은 뿌리예요. 성·수 변화 없이 그대로 써요.",
        "ex": {
          "fr": "L'école s'est dotée d'une salle multimédia.",
          "ko": "학교는 멀티미디어실을 갖췄어요."
        }
      },
      {
        "fr": "pétrolier / pétrolière",
        "ipa": "[petʁɔlje / petʁɔljɛʁ]",
        "ko": "석유의, 석유 산업의",
        "pos": "adj.",
        "etym": "라틴어 petra(돌)+oleum(기름) — 영어 petroleum과 같은 뿌리예요.",
        "ex": {
          "fr": "Les cours pétroliers ont fortement augmenté.",
          "ko": "석유 시세가 크게 올랐어요."
        }
      },
      {
        "fr": "aigu / aiguë",
        "ipa": "[eɡy / eɡy]",
        "ko": "날카로운, 예리한; (병이) 급성의",
        "pos": "adj.",
        "en": "acute",
        "etym": "라틴어 acutus(뾰족한) — 영어 acute와 같은 뿌리예요. 남성형·여성형 발음은 같아요(여성형은 aiguë).",
        "ex": {
          "fr": "Le patient souffre d'une douleur aiguë.",
          "ko": "환자는 극심한 통증에 시달려요."
        }
      },
      {
        "fr": "énergétique",
        "ipa": "[enɛʁʒetik]",
        "ko": "에너지의, 에너지에 관한",
        "pos": "adj.",
        "en": "energetic",
        "etym": "faux ami 주의: 영어 energetic은 '활기찬'이지만, 프랑스어 énergétique는 주로 '에너지(자원)의'라는 뜻이에요.",
        "ex": {
          "fr": "La transition énergétique est un enjeu majeur.",
          "ko": "에너지 전환은 중대한 과제예요."
        }
      },
      {
        "fr": "analytique",
        "ipa": "[analitik]",
        "ko": "분석적인",
        "pos": "adj.",
        "en": "analytical",
        "etym": "그리스어 analysis(분해) — 영어 analytical과 같은 뿌리예요.",
        "ex": {
          "fr": "Elle a un esprit très analytique.",
          "ko": "그녀는 매우 분석적인 사고를 지녔어요."
        }
      },
      {
        "fr": "décisif / décisive",
        "ipa": "[desizif / desiziv]",
        "ko": "결정적인",
        "pos": "adj.",
        "en": "decisive",
        "etym": "라틴어 decidere(결정하다) — 영어 decisive와 같은 뿌리예요.",
        "ex": {
          "fr": "Son témoignage a été décisif dans ce procès.",
          "ko": "그의 증언이 이 재판에서 결정적이었어요."
        }
      },
      {
        "fr": "synthétique",
        "ipa": "[sɛ̃tetik]",
        "ko": "합성의, 인조의; 종합적인",
        "pos": "adj.",
        "en": "synthetic",
        "etym": "그리스어 syn(함께)+thesis(놓음) — 영어 synthetic과 같은 뿌리예요.",
        "ex": {
          "fr": "Ce vêtement est en fibre synthétique.",
          "ko": "이 옷은 합성 섬유로 되어 있어요."
        }
      },
      {
        "fr": "courageusement",
        "ipa": "[kuʁaʒøzmɑ̃]",
        "ko": "용감하게",
        "pos": "adv.",
        "etym": "명사 courage(용기)에서 왔어요. 영어 courage와 같은 라틴어 cor(심장) 뿌리예요.",
        "ex": {
          "fr": "Elle a courageusement affronté la maladie.",
          "ko": "그녀는 용감하게 병에 맞섰어요."
        }
      },
      {
        "fr": "intérimaire",
        "ipa": "[ɛ̃teʁimɛʁ]",
        "ko": "임시의, 대행의; 임시직",
        "pos": "adj.",
        "etym": "라틴어 interim(그동안) — 영어 interim과 같은 뿌리예요. 남녀 동형이에요.",
        "ex": {
          "fr": "Elle occupe un poste intérimaire depuis trois mois.",
          "ko": "그녀는 석 달째 임시직을 맡고 있어요."
        }
      },
      {
        "fr": "charnel / charnelle",
        "ipa": "[ʃaʁnɛl / ʃaʁnɛl]",
        "ko": "육체의, 육감적인",
        "pos": "adj.",
        "en": "carnal",
        "etym": "라틴어 caro(살, 육체) — 영어 carnal과 같은 뿌리예요. 남성형·여성형 발음은 같아요.",
        "ex": {
          "fr": "Le roman décrit un amour charnel et passionné.",
          "ko": "그 소설은 육체적이고 열정적인 사랑을 그려요."
        }
      },
      {
        "fr": "exécutif / exécutive",
        "ipa": "[ɛɡzekytif / ɛɡzekytiv]",
        "ko": "행정의, 집행의",
        "pos": "adj.",
        "en": "executive",
        "etym": "라틴어 exsequi(끝까지 수행하다) — 영어 executive와 같은 뿌리예요.",
        "ex": {
          "fr": "Le pouvoir exécutif appartient au gouvernement.",
          "ko": "행정권은 정부에 있어요."
        }
      },
      {
        "fr": "immatériel / immatérielle",
        "ipa": "[imateʁjɛl / imateʁjɛl]",
        "ko": "무형의, 비물질적인",
        "pos": "adj.",
        "en": "immaterial",
        "etym": "라틴어 in(부정)+materia(물질) — 영어 immaterial과 같은 뿌리예요. 남성형·여성형 발음은 같아요.",
        "ex": {
          "fr": "Ce savoir-faire fait partie du patrimoine immatériel.",
          "ko": "이 기예는 무형 유산의 일부예요."
        }
      },
      {
        "fr": "artériel / artérielle",
        "ipa": "[aʁteʁjɛl / aʁteʁjɛl]",
        "ko": "동맥의",
        "pos": "adj.",
        "en": "arterial",
        "etym": "그리스어 artēria(동맥) — 영어 arterial과 같은 뿌리예요. 남성형·여성형 발음은 같아요.",
        "ex": {
          "fr": "Le médecin a mesuré sa tension artérielle.",
          "ko": "의사가 그의 동맥 혈압을 쟀어요."
        }
      },
      {
        "fr": "incontestable",
        "ipa": "[ɛ̃kɔ̃tɛstabl]",
        "ko": "반박할 수 없는, 명백한",
        "pos": "adj.",
        "en": "incontestable",
        "etym": "라틴어 in(부정)+contestari(다투다) — 영어 incontestable과 같은 뿌리예요. 남녀 동형이에요.",
        "ex": {
          "fr": "Son talent est incontestable.",
          "ko": "그의 재능은 누구도 부정할 수 없어요."
        }
      },
      {
        "fr": "ras / rase",
        "ipa": "[ʁɑ / ʁɑz]",
        "ko": "짧게 깎은, 바싹 깎은; 빠듯한",
        "pos": "adj.",
        "etym": "라틴어 rasus(깎인) — 영어 raze(허물다)와 같은 뿌리예요. 'en avoir ras le bol(지긋지긋하다)' 구어 표현으로도 써요.",
        "ex": {
          "fr": "Il porte les cheveux ras.",
          "ko": "그는 머리를 바싹 깎았어요."
        }
      },
      {
        "fr": "centenaire",
        "ipa": "[sɑ̃tnɛʁ]",
        "ko": "백 년 된, 백 살의",
        "pos": "adj.",
        "etym": "라틴어 centum(백) — 영어 century와 같은 뿌리예요. 남녀 동형이고, 명사로 '백 세 노인'도 돼요.",
        "ex": {
          "fr": "Un chêne centenaire trône au milieu du parc.",
          "ko": "백 년 된 떡갈나무가 공원 한가운데 우뚝 서 있어요."
        }
      },
      {
        "fr": "psychique",
        "ipa": "[psiʃik]",
        "ko": "정신의, 심리의",
        "pos": "adj.",
        "en": "psychic",
        "etym": "faux ami 주의: 영어 psychic은 흔히 '초능력의'를 뜻하지만, 프랑스어 psychique는 '정신적·심리적'이라는 뜻이에요.",
        "ex": {
          "fr": "Le stress peut avoir des effets psychiques importants.",
          "ko": "스트레스는 정신에 큰 영향을 줄 수 있어요."
        }
      },
      {
        "fr": "réparateur / réparatrice",
        "ipa": "[ʁepaʁatœʁ / ʁepaʁatʁis]",
        "ko": "회복시키는, 원기를 되찾게 하는",
        "pos": "adj.",
        "etym": "동사 réparer(고치다)에서 왔어요. 영어 reparative와 같은 라틴어 reparare 뿌리예요.",
        "ex": {
          "fr": "Une bonne nuit de sommeil réparateur fait du bien.",
          "ko": "푹 자며 원기를 회복하는 밤은 정말 좋아요."
        }
      },
      {
        "fr": "indéfiniment",
        "ipa": "[ɛ̃definimɑ̃]",
        "ko": "무한정, 끝없이",
        "pos": "adv.",
        "en": "indefinitely",
        "etym": "라틴어 in(부정)+definire(한정하다) — 영어 indefinitely와 같은 뿌리예요.",
        "ex": {
          "fr": "On ne peut pas reporter cette décision indéfiniment.",
          "ko": "이 결정을 무한정 미룰 수는 없어요."
        }
      },
      {
        "fr": "volontairement",
        "ipa": "[vɔlɔ̃tɛʁmɑ̃]",
        "ko": "일부러, 고의로, 자발적으로",
        "pos": "adv.",
        "en": "voluntarily",
        "etym": "라틴어 voluntas(의지) — 영어 voluntarily와 같은 뿌리예요.",
        "ex": {
          "fr": "Il a volontairement omis ce détail.",
          "ko": "그는 일부러 이 부분을 빠뜨렸어요."
        }
      },
      {
        "fr": "fidèlement",
        "ipa": "[fidɛlmɑ̃]",
        "ko": "충실하게, 그대로",
        "pos": "adv.",
        "en": "faithfully",
        "etym": "라틴어 fidelis(충실한) — 영어 faithfully와 같은 뿌리예요.",
        "ex": {
          "fr": "Ce film reproduit fidèlement le roman.",
          "ko": "이 영화는 소설을 충실하게 재현해요."
        }
      },
      {
        "fr": "sensuel / sensuelle",
        "ipa": "[sɑ̃sɥɛl / sɑ̃sɥɛl]",
        "ko": "관능적인, 감각적인",
        "pos": "adj.",
        "en": "sensual",
        "etym": "라틴어 sensus(감각)에서 왔고, 영어 sensual과 같은 뿌리예요. 남성형과 여성형 발음은 같아요.",
        "ex": {
          "fr": "Sa voix grave avait quelque chose de sensuel.",
          "ko": "그의 낮은 목소리에는 어딘가 관능적인 데가 있었어요."
        }
      },
      {
        "fr": "pluriel / plurielle",
        "ipa": "[plyʁjɛl / plyʁjɛl]",
        "ko": "복수의, 다원적인",
        "pos": "adj.",
        "en": "plural",
        "etym": "라틴어 pluralis(여럿의)에서 왔고, 영어 plural과 같은 뿌리예요. 남성형과 여성형 발음은 같아요.",
        "ex": {
          "fr": "Nous vivons dans une société plurielle.",
          "ko": "우리는 다원적인 사회에 살고 있어요."
        }
      },
      {
        "fr": "éditorial / éditoriale",
        "ipa": "[editɔʁjal / editɔʁjal]",
        "ko": "편집의, 사설의",
        "pos": "adj.",
        "en": "editorial",
        "etym": "라틴어 edere(출판하다)에서 왔고, 영어 editorial과 같은 뿌리예요. 남성형과 여성형 발음은 같아요.",
        "ex": {
          "fr": "La ligne éditoriale du journal a beaucoup changé.",
          "ko": "그 신문의 편집 방향이 많이 바뀌었어요."
        }
      },
      {
        "fr": "illégitime",
        "ipa": "[ileʒitim]",
        "ko": "부당한, 불법적인",
        "pos": "adj.",
        "en": "illegitimate",
        "etym": "라틴어 in-(아닌)+legitimus(합법적인)에서 왔고, 영어 illegitimate와 같은 뿌리예요. 남성형과 여성형이 같아요.",
        "ex": {
          "fr": "Ils jugent ce pouvoir illégitime.",
          "ko": "그들은 이 권력을 부당하다고 여겨요."
        }
      },
      {
        "fr": "médiocre",
        "ipa": "[medjɔkʁ]",
        "ko": "평범한, 보잘것없는",
        "pos": "adj.",
        "en": "mediocre",
        "etym": "라틴어 mediocris(중간의)에서 왔고, 영어 mediocre와 같은 뿌리예요. 남성형과 여성형이 같아요.",
        "ex": {
          "fr": "Le film a reçu des critiques médiocres.",
          "ko": "그 영화는 보잘것없는 평을 받았어요."
        }
      },
      {
        "fr": "pharmaceutique",
        "ipa": "[faʁmasøtik]",
        "ko": "제약의, 약학의",
        "pos": "adj.",
        "en": "pharmaceutical",
        "etym": "그리스어 pharmakon(약)에서 왔고, 영어 pharmaceutical과 같은 뿌리예요. 남성형과 여성형이 같아요.",
        "ex": {
          "fr": "L'industrie pharmaceutique investit dans la recherche.",
          "ko": "제약 산업이 연구에 투자하고 있어요."
        }
      },
      {
        "fr": "initiatique",
        "ipa": "[inisjatik]",
        "ko": "입문의, 통과의례의",
        "pos": "adj.",
        "etym": "라틴어 initiare(입문시키다)에서 왔어요. 남성형과 여성형이 같아요.",
        "ex": {
          "fr": "Ce voyage fut une véritable épreuve initiatique.",
          "ko": "그 여행은 진정한 통과의례와도 같은 시련이었어요."
        }
      },
      {
        "fr": "exorbitant / exorbitante",
        "ipa": "[ɛɡzɔʁbitɑ̃ / ɛɡzɔʁbitɑ̃t]",
        "ko": "터무니없는, 엄청난",
        "pos": "adj.",
        "en": "exorbitant",
        "etym": "라틴어 ex-(벗어난)+orbita(궤도)에서 왔고, 영어 exorbitant와 같은 뿌리예요.",
        "ex": {
          "fr": "Le loyer de cet appartement est exorbitant.",
          "ko": "이 아파트 월세는 터무니없이 비싸요."
        }
      },
      {
        "fr": "effervescent / effervescente",
        "ipa": "[efɛʁvesɑ̃ / efɛʁvesɑ̃t]",
        "ko": "들끓는, 발포하는",
        "pos": "adj.",
        "en": "effervescent",
        "etym": "라틴어 effervescere(끓어오르다)에서 왔고, 영어 effervescent와 같은 뿌리예요.",
        "ex": {
          "fr": "Une atmosphère effervescente régnait dans la salle.",
          "ko": "그 방 안에는 들끓는 듯한 분위기가 감돌았어요."
        }
      },
      {
        "fr": "impérativement",
        "ipa": "[ɛ̃peʁativmɑ̃]",
        "ko": "반드시, 꼭",
        "pos": "adv.",
        "ex": {
          "fr": "Le dossier doit impérativement être rendu demain.",
          "ko": "그 서류는 반드시 내일까지 제출해야 해요."
        }
      },
      {
        "fr": "archaïque",
        "ipa": "[aʁkaik]",
        "ko": "낡은, 고풍의",
        "pos": "adj.",
        "en": "archaic",
        "etym": "그리스어 arkhaios(오래된)에서 왔고, 영어 archaic과 같은 뿌리예요. 남성형과 여성형이 같아요.",
        "ex": {
          "fr": "Ce système administratif est complètement archaïque.",
          "ko": "이 행정 체계는 완전히 낡았어요."
        }
      },
      {
        "fr": "serein / sereine",
        "ipa": "[səʁɛ̃ / səʁɛn]",
        "ko": "평온한, 차분한",
        "pos": "adj.",
        "en": "serene",
        "etym": "라틴어 serenus(맑은)에서 왔고, 영어 serene과 같은 뿌리예요.",
        "ex": {
          "fr": "Elle est restée sereine face à la critique.",
          "ko": "그녀는 비판 앞에서도 평온함을 유지했어요."
        }
      },
      {
        "fr": "hasardeux / hasardeuse",
        "ipa": "[azaʁdø / azaʁdøz]",
        "ko": "위험한, 무모한",
        "pos": "adj.",
        "en": "hazardous",
        "etym": "아랍어 az-zahr(주사위)에서 왔고, 영어 hazardous와 같은 뿌리예요.",
        "ex": {
          "fr": "C'est un pari hasardeux.",
          "ko": "그건 무모한 도박이에요."
        }
      },
      {
        "fr": "propice",
        "ipa": "[pʁɔpis]",
        "ko": "알맞은, 유리한",
        "pos": "adj.",
        "en": "propitious",
        "etym": "라틴어 propitius(호의적인)에서 왔고, 영어 propitious와 같은 뿌리예요. 남성형과 여성형이 같아요.",
        "ex": {
          "fr": "Le moment est propice à une réforme.",
          "ko": "지금이 개혁하기에 알맞은 때예요."
        }
      },
      {
        "fr": "diplomatique",
        "ipa": "[diplɔmatik]",
        "ko": "외교의, 외교적인",
        "pos": "adj.",
        "en": "diplomatic",
        "etym": "그리스어 diploma(접힌 문서)에서 왔고, 영어 diplomatic과 같은 뿌리예요. 남성형과 여성형이 같아요.",
        "ex": {
          "fr": "Les deux pays ont rompu leurs relations diplomatiques.",
          "ko": "두 나라는 외교 관계를 단절했어요."
        }
      },
      {
        "fr": "nocif / nocive",
        "ipa": "[nɔsif / nɔsiv]",
        "ko": "해로운, 유해한",
        "pos": "adj.",
        "etym": "라틴어 nocere(해치다)에서 왔어요. 영어 noxious와 같은 뿌리예요.",
        "ex": {
          "fr": "Ces produits sont nocifs pour l'environnement.",
          "ko": "이 제품들은 환경에 유해해요."
        }
      },
      {
        "fr": "départemental / départementale",
        "ipa": "[depaʁtəmɑ̃tal / depaʁtəmɑ̃tal]",
        "ko": "도(道)의, 데파르트망의",
        "pos": "adj.",
        "ex": {
          "fr": "La route départementale traverse plusieurs villages.",
          "ko": "그 지방도는 여러 마을을 가로질러요."
        }
      },
      {
        "fr": "physiologique",
        "ipa": "[fizjɔlɔʒik]",
        "ko": "생리적인, 생리학의",
        "pos": "adj.",
        "en": "physiological",
        "etym": "그리스어 physis(자연)+logos(학문)에서 왔고, 영어 physiological과 같은 뿌리예요. 남성형과 여성형이 같아요.",
        "ex": {
          "fr": "Le stress entraîne des réactions physiologiques.",
          "ko": "스트레스는 생리적 반응을 일으켜요."
        }
      },
      {
        "fr": "insultant / insultante",
        "ipa": "[ɛ̃syltɑ̃ / ɛ̃syltɑ̃t]",
        "ko": "모욕적인",
        "pos": "adj.",
        "en": "insulting",
        "etym": "라틴어 insultare(덤벼들다)에서 왔고, 영어 insulting과 같은 뿌리예요.",
        "ex": {
          "fr": "Ses propos étaient franchement insultants.",
          "ko": "그의 발언은 솔직히 모욕적이었어요."
        }
      },
      {
        "fr": "vraisemblablement",
        "ipa": "[vʁɛsɑ̃blabləmɑ̃]",
        "ko": "아마도, 십중팔구",
        "pos": "adv.",
        "ex": {
          "fr": "Il sera vraisemblablement absent demain.",
          "ko": "그는 아마도 내일 결석할 거예요."
        }
      },
      {
        "fr": "préventif / préventive",
        "ipa": "[pʁevɑ̃tif / pʁevɑ̃tiv]",
        "ko": "예방의, 예방적인",
        "pos": "adj.",
        "en": "preventive",
        "etym": "라틴어 praevenire(미리 오다)에서 왔고, 영어 preventive와 같은 뿌리예요.",
        "ex": {
          "fr": "Des mesures préventives ont été prises.",
          "ko": "예방 조치가 취해졌어요."
        }
      },
      {
        "fr": "simpliste",
        "ipa": "[sɛ̃plist]",
        "ko": "지나치게 단순한, 단순 논리의",
        "pos": "adj.",
        "en": "simplistic",
        "etym": "라틴어 simplex(단순한)에서 왔고, 영어 simplistic과 같은 뿌리예요. 남성형과 여성형이 같아요.",
        "ex": {
          "fr": "C'est une analyse un peu simpliste.",
          "ko": "그건 좀 단순 논리적인 분석이에요."
        }
      },
      {
        "fr": "aromatique",
        "ipa": "[aʁɔmatik]",
        "ko": "향기로운, 방향성의",
        "pos": "adj.",
        "en": "aromatic",
        "etym": "그리스어 aroma(향)에서 왔고, 영어 aromatic과 같은 뿌리예요. 남성형과 여성형이 같아요.",
        "ex": {
          "fr": "Ce plat est relevé d'herbes aromatiques.",
          "ko": "이 요리는 향신 허브로 맛을 냈어요."
        }
      },
      {
        "fr": "énergique",
        "ipa": "[enɛʁʒik]",
        "ko": "정력적인, 단호한",
        "pos": "adj.",
        "en": "energetic",
        "etym": "그리스어 energeia(활동)에서 왔고, 영어 energetic과 같은 뿌리예요. 남성형과 여성형이 같아요.",
        "ex": {
          "fr": "Le gouvernement a pris des mesures énergiques.",
          "ko": "정부는 단호한 조치를 취했어요."
        }
      },
      {
        "fr": "individualisé / individualisée",
        "ipa": "[ɛ̃dividɥalize / ɛ̃dividɥalize]",
        "ko": "개인 맞춤의, 개별화된",
        "pos": "adj.",
        "ex": {
          "fr": "L'école propose un suivi individualisé.",
          "ko": "그 학교는 개인 맞춤 지도를 제공해요."
        }
      },
      {
        "fr": "invraisemblable",
        "ipa": "[ɛ̃vʁɛsɑ̃blabl]",
        "ko": "있을 법하지 않은, 터무니없는",
        "pos": "adj.",
        "ex": {
          "fr": "Son histoire est tout à fait invraisemblable.",
          "ko": "그의 이야기는 도무지 있을 법하지가 않아요."
        }
      },
      {
        "fr": "exagéré / exagérée",
        "ipa": "[ɛɡzaʒeʁe / ɛɡzaʒeʁe]",
        "ko": "과장된, 지나친",
        "pos": "adj.",
        "en": "exaggerated",
        "etym": "라틴어 exaggerare(쌓아 올리다)에서 왔고, 영어 exaggerated와 같은 뿌리예요.",
        "ex": {
          "fr": "Ses craintes sont exagérées.",
          "ko": "그의 걱정은 지나쳐요."
        }
      },
      {
        "fr": "fervent / fervente",
        "ipa": "[fɛʁvɑ̃ / fɛʁvɑ̃t]",
        "ko": "열렬한, 독실한",
        "pos": "adj.",
        "en": "fervent",
        "etym": "라틴어 fervere(끓다)에서 왔고, 영어 fervent와 같은 뿌리예요.",
        "ex": {
          "fr": "C'est un fervent défenseur de la liberté.",
          "ko": "그는 자유의 열렬한 옹호자예요."
        }
      },
      {
        "fr": "entre-temps",
        "ipa": "[ɑ̃tʁətɑ̃]",
        "ko": "그동안에, 그사이에",
        "pos": "adv.",
        "ex": {
          "fr": "Entre-temps, la situation avait changé.",
          "ko": "그사이에 상황이 바뀌어 있었어요."
        }
      },
      {
        "fr": "inhabituel / inhabituelle",
        "ipa": "[inabitɥɛl / inabitɥɛl]",
        "ko": "이례적인, 평소와 다른",
        "pos": "adj.",
        "ex": {
          "fr": "Un silence inhabituel régnait dans la maison.",
          "ko": "집 안에는 평소와 다른 정적이 감돌았어요."
        }
      },
      {
        "fr": "espéré / espérée",
        "ipa": "[ɛspeʁe / ɛspeʁe]",
        "ko": "기대했던, 바라던",
        "pos": "adj.",
        "ex": {
          "fr": "Le résultat espéré n'est pas au rendez-vous.",
          "ko": "기대했던 결과가 나오지 않았어요."
        }
      },
      {
        "fr": "tertiaire",
        "ipa": "[tɛʁsjɛʁ]",
        "ko": "3차의, 서비스업의",
        "pos": "adj.",
        "en": "tertiary",
        "etym": "라틴어 tertius(세 번째)에서 왔고, 영어 tertiary와 같은 뿌리예요. 남성형과 여성형이 같아요.",
        "ex": {
          "fr": "Le secteur tertiaire emploie la majorité des actifs.",
          "ko": "서비스업 부문이 노동 인구의 다수를 고용해요."
        }
      },
      {
        "fr": "agro-alimentaire",
        "ipa": "[aɡʁoalimɑ̃tɛʁ]",
        "ko": "농식품의, 식품 가공의",
        "pos": "adj.",
        "ex": {
          "fr": "L'industrie agro-alimentaire est très réglementée.",
          "ko": "농식품 산업은 규제가 매우 엄격해요."
        }
      },
      {
        "fr": "emblématique",
        "ipa": "[ɑ̃blematik]",
        "ko": "상징적인, 대표적인",
        "pos": "adj.",
        "en": "emblematic",
        "etym": "그리스어 emblema(상감 장식)에서 왔고, 영어 emblematic과 같은 뿌리예요. 남성형과 여성형이 같아요.",
        "ex": {
          "fr": "La tour Eiffel est un monument emblématique.",
          "ko": "에펠탑은 상징적인 기념물이에요."
        }
      },
      {
        "fr": "géologique",
        "ipa": "[ʒeɔlɔʒik]",
        "ko": "지질의, 지질학의",
        "pos": "adj.",
        "en": "geological",
        "etym": "그리스어 gê(땅)+logos(학문)에서 왔고, 영어 geological과 같은 뿌리예요. 남성형과 여성형이 같아요.",
        "ex": {
          "fr": "Cette région présente une grande richesse géologique.",
          "ko": "이 지역은 풍부한 지질학적 자원을 지니고 있어요."
        }
      },
      {
        "fr": "faussement",
        "ipa": "[fosmɑ̃]",
        "ko": "거짓으로, 겉으로만",
        "pos": "adv.",
        "ex": {
          "fr": "Il prit un air faussement surpris.",
          "ko": "그는 짐짓 놀란 척하는 표정을 지었어요."
        }
      },
      {
        "fr": "divin / divine",
        "ipa": "[divɛ̃ / divin]",
        "ko": "신성한, 신의",
        "pos": "adj.",
        "en": "divine",
        "etym": "라틴어 divinus(신의)에서 왔고, 영어 divine과 같은 뿌리예요.",
        "ex": {
          "fr": "Les Anciens croyaient à l'origine divine des rois.",
          "ko": "고대인들은 왕의 신성한 기원을 믿었어요."
        }
      },
      {
        "fr": "infidèle",
        "ipa": "[ɛ̃fidɛl]",
        "ko": "불충실한, 부정(不貞)한",
        "pos": "adj.",
        "en": "unfaithful",
        "etym": "라틴어 in-(아닌)+fidelis(충실한)에서 왔고, 영어 infidel과 같은 뿌리예요. 남성형과 여성형이 같아요.",
        "ex": {
          "fr": "Cette traduction est infidèle à l'original.",
          "ko": "이 번역은 원문에 충실하지 않아요."
        }
      },
      {
        "fr": "volumineux / volumineuse",
        "ipa": "[vɔlyminø / vɔlyminøz]",
        "ko": "부피가 큰, 방대한",
        "pos": "adj.",
        "en": "voluminous",
        "etym": "라틴어 volumen(두루마리)에서 왔고, 영어 voluminous와 같은 뿌리예요.",
        "ex": {
          "fr": "Le dossier est très volumineux.",
          "ko": "그 서류는 분량이 아주 방대해요."
        }
      },
      {
        "fr": "préparatoire",
        "ipa": "[pʁepaʁatwaʁ]",
        "ko": "준비의, 예비의",
        "pos": "adj.",
        "en": "preparatory",
        "etym": "라틴어 praeparare(준비하다)에서 왔고, 영어 preparatory와 같은 뿌리예요. 남성형과 여성형이 같아요.",
        "ex": {
          "fr": "Il suit une classe préparatoire aux grandes écoles.",
          "ko": "그는 그랑제콜 입시 준비반에 다녀요."
        }
      },
      {
        "fr": "chaotique",
        "ipa": "[kaɔtik]",
        "ko": "혼란스러운, 무질서한",
        "pos": "adj.",
        "en": "chaotic",
        "etym": "그리스어 khaos(혼돈)에서 왔고, 영어 chaotic과 같은 뿌리예요. 남성형과 여성형이 같아요.",
        "ex": {
          "fr": "La circulation était totalement chaotique.",
          "ko": "교통이 완전히 무질서했어요."
        }
      },
      {
        "fr": "florissant / florissante",
        "ipa": "[flɔʁisɑ̃ / flɔʁisɑ̃t]",
        "ko": "번창하는, 융성한",
        "pos": "adj.",
        "etym": "라틴어 florere(꽃 피다)에서 왔어요. 영어 flourishing과 같은 뿌리예요.",
        "ex": {
          "fr": "Cette région connaît une économie florissante.",
          "ko": "이 지역은 번창하는 경제를 누리고 있어요."
        }
      },
      {
        "fr": "rétif / rétive",
        "ipa": "[ʁetif / ʁetiv]",
        "ko": "고집 센, 말을 듣지 않는, (말이) 앞으로 나아가지 않는",
        "pos": "adj.",
        "ex": {
          "fr": "Cet élève est rétif à toute discipline.",
          "ko": "이 학생은 어떤 규율에도 고집스럽게 저항해요."
        }
      },
      {
        "fr": "singulièrement",
        "ipa": "[sɛ̃gyljɛʁmɑ̃]",
        "ko": "특히, 유난히, 기묘하게",
        "pos": "adv.",
        "ex": {
          "fr": "Le débat s'est singulièrement durci ces derniers jours.",
          "ko": "논쟁이 최근 며칠 사이 유난히 격화됐어요."
        }
      },
      {
        "fr": "émergent / émergente",
        "ipa": "[emɛʁʒɑ̃ / emɛʁʒɑ̃t]",
        "ko": "신흥의, 떠오르는",
        "pos": "adj.",
        "en": "emergent / emerging",
        "etym": "라틴어 emergere(떠오르다)에서 왔어요. 영어 emerging과 같은 뿌리예요.",
        "ex": {
          "fr": "Les pays émergents jouent un rôle croissant dans l'économie mondiale.",
          "ko": "신흥국들은 세계 경제에서 점점 더 큰 역할을 해요."
        }
      },
      {
        "fr": "poli / polie",
        "ipa": "[pɔli / pɔli]",
        "ko": "예의 바른, 정중한; (표면이) 매끄럽게 닦인",
        "pos": "adj.",
        "en": "polite",
        "etym": "라틴어 polire(닦다, 광내다)에서 왔어요. 영어 polite, polished와 같은 뿌리예요. '갈고 닦인' 데서 '세련된, 예의 바른' 뜻이 나왔어요.",
        "ex": {
          "fr": "Il s'est montré très poli envers ses hôtes.",
          "ko": "그는 손님들에게 아주 정중하게 행동했어요."
        }
      },
      {
        "fr": "floral / florale",
        "ipa": "[flɔʁal / flɔʁal]",
        "ko": "꽃의, 꽃무늬의",
        "pos": "adj.",
        "en": "floral",
        "etym": "라틴어 flos(꽃)에서 왔어요. 영어 floral과 같은 뿌리예요. 남성 복수형은 floraux예요.",
        "ex": {
          "fr": "Ce parfum a des notes florales très délicates.",
          "ko": "이 향수는 아주 섬세한 꽃 향이 나요."
        }
      },
      {
        "fr": "syndical / syndicale",
        "ipa": "[sɛ̃dikal / sɛ̃dikal]",
        "ko": "노동조합의, 조합과 관련된",
        "pos": "adj.",
        "etym": "남성 복수형은 syndicaux예요. 명사 syndicat(노동조합)에서 왔어요.",
        "ex": {
          "fr": "Le délégué syndical a négocié avec la direction.",
          "ko": "노조 대표가 경영진과 협상했어요."
        }
      },
      {
        "fr": "londonien / londonienne",
        "ipa": "[lɔ̃dɔnjɛ̃ / lɔ̃dɔnjɛn]",
        "ko": "런던의, 런던 사람의",
        "pos": "adj.",
        "ex": {
          "fr": "La vie londonienne est réputée trépidante.",
          "ko": "런던의 생활은 분주하기로 유명해요."
        }
      },
      {
        "fr": "divertissant / divertissante",
        "ipa": "[divɛʁtisɑ̃ / divɛʁtisɑ̃t]",
        "ko": "재미있는, 즐거움을 주는",
        "pos": "adj.",
        "etym": "라틴어 divertere(다른 데로 돌리다)에서 왔어요. 영어 divert와 같은 뿌리예요. '마음을 (근심에서) 돌려 즐겁게 한다'는 뜻이에요.",
        "ex": {
          "fr": "C'est un film léger et divertissant.",
          "ko": "가볍고 재미있는 영화예요."
        }
      },
      {
        "fr": "dérisoire",
        "ipa": "[deʁizwaʁ]",
        "ko": "보잘것없는, 하찮은, 가소로운",
        "pos": "adj.",
        "etym": "라틴어 deridere(비웃다)에서 왔어요. 영어 derision(조롱)과 같은 뿌리예요.",
        "ex": {
          "fr": "La somme proposée est dérisoire.",
          "ko": "제안된 금액은 보잘것없어요."
        }
      },
      {
        "fr": "intellectuellement",
        "ipa": "[ɛ̃telɛktɥɛlmɑ̃]",
        "ko": "지적으로, 지성적인 면에서",
        "pos": "adv.",
        "en": "intellectually",
        "etym": "라틴어 intellectus(이해)에서 왔어요. 영어 intellectually와 같은 뿌리예요.",
        "ex": {
          "fr": "Ce travail est intellectuellement stimulant.",
          "ko": "이 일은 지적으로 자극을 주는 일이에요."
        }
      },
      {
        "fr": "acceptable",
        "ipa": "[aksɛptabl]",
        "ko": "받아들일 만한, 용인되는",
        "pos": "adj.",
        "en": "acceptable",
        "etym": "라틴어 acceptare(받아들이다)에서 왔어요. 영어 acceptable과 같은 뿌리예요.",
        "ex": {
          "fr": "Cette proposition reste acceptable pour les deux parties.",
          "ko": "이 제안은 양측 모두에게 받아들일 만해요."
        }
      },
      {
        "fr": "brusque",
        "ipa": "[bʁysk]",
        "ko": "갑작스러운, 퉁명스러운, 무뚝뚝한",
        "pos": "adj.",
        "etym": "이탈리아어 brusco(거친, 신)에서 왔어요. 영어 brusque와 같은 뿌리예요.",
        "ex": {
          "fr": "Il a eu un geste brusque qui m'a surpris.",
          "ko": "그가 갑작스러운 동작을 해서 깜짝 놀랐어요."
        }
      },
      {
        "fr": "hispanique",
        "ipa": "[ispanik]",
        "ko": "스페인계의, 히스패닉의",
        "pos": "adj.",
        "en": "Hispanic",
        "etym": "라틴어 Hispania(이베리아 반도)에서 왔어요. 영어 Hispanic과 같은 뿌리예요.",
        "ex": {
          "fr": "La culture hispanique est très présente dans cette ville.",
          "ko": "이 도시에는 히스패닉 문화가 강하게 자리 잡고 있어요."
        }
      },
      {
        "fr": "tangible",
        "ipa": "[tɑ̃ʒibl]",
        "ko": "만질 수 있는, 구체적인, 실질적인",
        "pos": "adj.",
        "en": "tangible",
        "etym": "라틴어 tangere(만지다)에서 왔어요. 영어 tangible과 같은 뿌리예요.",
        "ex": {
          "fr": "Cette politique a produit des résultats tangibles.",
          "ko": "이 정책은 실질적인 성과를 냈어요."
        }
      },
      {
        "fr": "amer / amère",
        "ipa": "[amɛʁ / amɛʁ]",
        "ko": "쓴; (감정이) 씁쓸한, 원통한",
        "pos": "adj.",
        "etym": "라틴어 amarus(쓴)에서 왔어요. 발음은 남성형·여성형이 같지만, 철자만 amer / amère로 달라져요.",
        "ex": {
          "fr": "Il garde un souvenir amer de cette époque.",
          "ko": "그는 그 시절에 대해 씁쓸한 기억을 간직하고 있어요."
        }
      },
      {
        "fr": "catalan / catalane",
        "ipa": "[katalɑ̃ / katalan]",
        "ko": "카탈루냐의, 카탈루냐어의",
        "pos": "adj.",
        "ex": {
          "fr": "La cuisine catalane est riche en saveurs.",
          "ko": "카탈루냐 요리는 풍미가 풍부해요."
        }
      },
      {
        "fr": "massivement",
        "ipa": "[masivmɑ̃]",
        "ko": "대규모로, 대량으로",
        "pos": "adv.",
        "en": "massively",
        "etym": "라틴어 massa(덩어리)에서 왔어요. 영어 massively와 같은 뿌리예요.",
        "ex": {
          "fr": "Les électeurs se sont massivement déplacés aux urnes.",
          "ko": "유권자들이 대규모로 투표소를 찾았어요."
        }
      },
      {
        "fr": "capitaliste",
        "ipa": "[kapitalist]",
        "ko": "자본주의의, 자본주의적인",
        "pos": "adj.",
        "en": "capitalist",
        "etym": "라틴어 capitalis(으뜸의)에서 왔어요. 영어 capitalist와 같은 뿌리예요.",
        "ex": {
          "fr": "Ce modèle capitaliste est de plus en plus contesté.",
          "ko": "이 자본주의 모델은 점점 더 비판받고 있어요."
        }
      },
      {
        "fr": "volcanique",
        "ipa": "[vɔlkanik]",
        "ko": "화산의, 화산성의; (성격이) 격정적인",
        "pos": "adj.",
        "en": "volcanic",
        "etym": "라틴어 Vulcanus(불의 신 불카누스)에서 왔어요. 영어 volcanic과 같은 뿌리예요.",
        "ex": {
          "fr": "Cette île est d'origine volcanique.",
          "ko": "이 섬은 화산 기원의 섬이에요."
        }
      },
      {
        "fr": "cathodique",
        "ipa": "[katɔdik]",
        "ko": "음극의; (구식) 브라운관의",
        "pos": "adj.",
        "etym": "그리스어 kathodos(하강로)에서 왔어요. 영어 cathode와 같은 뿌리예요. 'tube cathodique'는 구식 브라운관 텔레비전을 가리켜요.",
        "ex": {
          "fr": "Les anciens téléviseurs avaient un écran cathodique.",
          "ko": "옛날 텔레비전은 브라운관 화면을 썼어요."
        }
      },
      {
        "fr": "consumériste",
        "ipa": "[kɔ̃symeʁist]",
        "ko": "소비주의의, 소비지상주의적인",
        "pos": "adj.",
        "en": "consumerist",
        "etym": "영어 consumer(소비자)에서 온 consumerism과 같은 뿌리예요.",
        "ex": {
          "fr": "Il critique notre société consumériste.",
          "ko": "그는 우리의 소비지상주의 사회를 비판해요."
        }
      },
      {
        "fr": "transmissible",
        "ipa": "[tʁɑ̃smisibl]",
        "ko": "전염되는, 전달 가능한, 양도 가능한",
        "pos": "adj.",
        "en": "transmissible",
        "etym": "라틴어 transmittere(건네주다)에서 왔어요. 영어 transmissible과 같은 뿌리예요.",
        "ex": {
          "fr": "Cette maladie est transmissible par contact.",
          "ko": "이 병은 접촉을 통해 전염돼요."
        }
      },
      {
        "fr": "épidémiologique",
        "ipa": "[epidemjɔlɔʒik]",
        "ko": "역학의, 전염병학의",
        "pos": "adj.",
        "en": "epidemiological",
        "etym": "그리스어 epi(위)+demos(사람들)+logos(학문)에서 왔어요. 영어 epidemiological과 같은 뿌리예요.",
        "ex": {
          "fr": "Les données épidémiologiques montrent une baisse des cas.",
          "ko": "역학 데이터는 환자 수가 줄고 있음을 보여줘요."
        }
      },
      {
        "fr": "équatorial / équatoriale",
        "ipa": "[ekwatɔʁjal / ekwatɔʁjal]",
        "ko": "적도의, 적도 부근의",
        "pos": "adj.",
        "en": "equatorial",
        "etym": "라틴어 aequator(균등하게 하는 것, 적도)에서 왔어요. 영어 equatorial과 같은 뿌리예요. 남성 복수형은 équatoriaux예요.",
        "ex": {
          "fr": "La forêt équatoriale abrite une biodiversité exceptionnelle.",
          "ko": "적도 우림은 놀라운 생물 다양성을 품고 있어요."
        }
      },
      {
        "fr": "grotesque",
        "ipa": "[gʁɔtɛsk]",
        "ko": "기괴한, 우스꽝스러운",
        "pos": "adj.",
        "en": "grotesque",
        "etym": "이탈리아어 grotta(동굴)에서 왔어요. 동굴 벽에서 발견된 기이한 장식에서 비롯됐어요. 영어 grotesque와 같은 뿌리예요.",
        "ex": {
          "fr": "Sa réaction était tout simplement grotesque.",
          "ko": "그의 반응은 그저 우스꽝스러웠어요."
        }
      },
      {
        "fr": "explicitement",
        "ipa": "[ɛksplisitmɑ̃]",
        "ko": "명시적으로, 분명하게",
        "pos": "adv.",
        "en": "explicitly",
        "etym": "라틴어 explicare(펼치다, 설명하다)에서 왔어요. 영어 explicitly와 같은 뿌리예요.",
        "ex": {
          "fr": "La loi interdit explicitement cette pratique.",
          "ko": "법은 이 관행을 명시적으로 금지하고 있어요."
        }
      },
      {
        "fr": "pragmatique",
        "ipa": "[pʁagmatik]",
        "ko": "실용적인, 실리적인",
        "pos": "adj.",
        "en": "pragmatic",
        "etym": "그리스어 pragma(행위, 일)에서 왔어요. 영어 pragmatic과 같은 뿌리예요.",
        "ex": {
          "fr": "Il adopte une approche pragmatique des problèmes.",
          "ko": "그는 문제에 실용적인 방식으로 접근해요."
        }
      },
      {
        "fr": "ultra",
        "ipa": "[yltʁa]",
        "ko": "극단적인, 과격한; (접두사) 초~",
        "pos": "adj.",
        "en": "ultra",
        "etym": "라틴어 ultra(~을 넘어)에서 왔어요. 영어 ultra와 같은 뿌리예요. 명사로 '극단주의자'를 뜻하기도 해요.",
        "ex": {
          "fr": "Ce discours séduit surtout les militants ultras.",
          "ko": "이 연설은 특히 과격파 운동가들의 마음을 사로잡아요."
        }
      }
    ]
  },
  {
    "name": "그 밖의 어휘",
    "icon": "📚",
    "words": [
      {
        "fr": "le polluant",
        "ipa": "[pɔlɥɑ̃]",
        "ko": "오염 물질, 오염원",
        "pos": "n.m.",
        "en": "pollutant",
        "etym": "라틴어 polluere(더럽히다)에서 왔어요. 영어 pollutant과 같은 뿌리예요.",
        "ex": {
          "fr": "Ce gaz est un polluant dangereux pour l'atmosphère.",
          "ko": "이 기체는 대기에 위험한 오염 물질이에요."
        }
      },
      {
        "fr": "la déjection",
        "ipa": "[deʒɛksjɔ̃]",
        "ko": "배설물, 분비물",
        "pos": "n.f.",
        "ex": {
          "fr": "Les déjections animales polluent le cours d'eau.",
          "ko": "동물 배설물이 하천을 오염시켜요."
        }
      },
      {
        "fr": "l'humidité (f.)",
        "ipa": "[ymidite]",
        "ko": "습도, 습기",
        "pos": "n.f.",
        "en": "humidity",
        "etym": "라틴어 humidus(축축한)에서 왔어요. 영어 humidity와 같은 뿌리예요.",
        "ex": {
          "fr": "L'humidité de l'air est très élevée en été.",
          "ko": "여름에는 공기 중 습도가 아주 높아요."
        }
      },
      {
        "fr": "l'actif (m.)",
        "ipa": "[aktif]",
        "ko": "자산; 경제 활동 인구",
        "pos": "n.m.",
        "en": "asset",
        "etym": "라틴어 activus(활동적인)에서 왔어요. 회계에서 actif는 '자산'(영어 assets), passif는 '부채'를 뜻해요.",
        "ex": {
          "fr": "Cette entreprise possède des actifs considérables.",
          "ko": "이 회사는 상당한 자산을 보유하고 있어요."
        }
      },
      {
        "fr": "le clip",
        "ipa": "[klip]",
        "ko": "(짧은) 영상, 뮤직비디오",
        "pos": "n.m.",
        "en": "clip",
        "etym": "영어 clip을 그대로 빌려 왔어요. 특히 '뮤직비디오(clip vidéo)'를 가리켜요.",
        "ex": {
          "fr": "Le clip de cette chanson a été vu des millions de fois.",
          "ko": "이 노래의 뮤직비디오는 수백만 번 조회됐어요."
        }
      },
      {
        "fr": "le contribuable",
        "ipa": "[kɔ̃tʁibɥabl]",
        "ko": "납세자",
        "pos": "n.m.",
        "etym": "라틴어 contribuere(함께 내다)에서 왔어요. 영어 contribute와 같은 뿌리예요.",
        "ex": {
          "fr": "Cette dépense pèse lourdement sur les contribuables.",
          "ko": "이 지출은 납세자들에게 큰 부담이 돼요."
        }
      },
      {
        "fr": "le planning",
        "ipa": "[planiŋ]",
        "ko": "일정표, 계획표, 스케줄",
        "pos": "n.m.",
        "en": "planning / schedule",
        "etym": "영어 planning을 빌려 왔지만, 프랑스어에서는 '일정표·스케줄'이라는 더 구체적인 뜻으로 써요. 가짜 친구(faux ami)에 가까워요.",
        "ex": {
          "fr": "Mon planning de la semaine est déjà complet.",
          "ko": "이번 주 제 일정은 벌써 꽉 찼어요."
        }
      },
      {
        "fr": "la luminosité",
        "ipa": "[lyminozite]",
        "ko": "밝기, 광도, 명도",
        "pos": "n.f.",
        "en": "luminosity",
        "etym": "라틴어 lumen(빛)에서 왔어요. 영어 luminosity와 같은 뿌리예요.",
        "ex": {
          "fr": "On peut régler la luminosité de l'écran.",
          "ko": "화면의 밝기를 조절할 수 있어요."
        }
      },
      {
        "fr": "le solvant",
        "ipa": "[sɔlvɑ̃]",
        "ko": "용매, 용제",
        "pos": "n.m.",
        "en": "solvent",
        "etym": "라틴어 solvere(녹이다, 풀다)에서 왔어요. 영어 solvent와 같은 뿌리예요.",
        "ex": {
          "fr": "Ce solvant est très volatil et inflammable.",
          "ko": "이 용매는 휘발성이 매우 강하고 인화성이 있어요."
        }
      },
      {
        "fr": "le stagiaire",
        "ipa": "[staʒjɛʁ]",
        "ko": "인턴, 연수생, 실습생",
        "pos": "n.m.",
        "ex": {
          "fr": "Le stagiaire a rédigé un rapport très complet.",
          "ko": "인턴이 아주 충실한 보고서를 작성했어요."
        }
      },
      {
        "fr": "l'hémisphère (m.)",
        "ipa": "[emisfɛʁ]",
        "ko": "반구; (뇌의) 반구",
        "pos": "n.m.",
        "en": "hemisphere",
        "etym": "그리스어 hemi(반)+sphaira(구)에서 왔어요. 영어 hemisphere와 같은 뿌리예요.",
        "ex": {
          "fr": "C'est l'été dans l'hémisphère sud.",
          "ko": "남반구는 지금 여름이에요."
        }
      },
      {
        "fr": "le métrage",
        "ipa": "[metʁaʒ]",
        "ko": "길이(미터 수); (영화) 상영 길이",
        "pos": "n.m.",
        "ex": {
          "fr": "Ce court métrage a remporté un prix au festival.",
          "ko": "이 단편 영화가 영화제에서 상을 받았어요."
        }
      },
      {
        "fr": "le fournisseur",
        "ipa": "[fuʁnisœʁ]",
        "ko": "공급업체, 납품업자",
        "pos": "n.m.",
        "en": "supplier",
        "ex": {
          "fr": "Nous avons changé de fournisseur d'électricité.",
          "ko": "우리는 전기 공급업체를 바꿨어요."
        }
      }
    ]
  }
];

export default themes;
