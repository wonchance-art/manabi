/**
 * B2 보강 어휘 (2차) — FLELex 등급을 실제 빈도로 보정.
 * index.js의 mergeFrVocab가 본편과 병합.
 */
const themes = [
  {
    "name": "정치·사회·시사",
    "icon": "🏛️",
    "words": [
      {
        "fr": "l'asile (m.)",
        "ipa": "[azil]",
        "ko": "망명, 피난처",
        "pos": "n.m.",
        "en": "asylum",
        "ex": {
          "fr": "Il a demandé l'asile dans un autre pays.",
          "ko": "그는 다른 나라에 망명을 신청했어요."
        }
      },
      {
        "fr": "la détention",
        "ipa": "[detɑ̃sjɔ̃]",
        "ko": "구금, 소지",
        "pos": "n.f.",
        "ex": {
          "fr": "Il est en détention depuis une semaine.",
          "ko": "그는 일주일째 구금되어 있어요."
        }
      },
      {
        "fr": "l'envoyé (m.)",
        "ipa": "[ɑ̃vwaje]",
        "ko": "특파원, 사절",
        "pos": "n.m.",
        "ex": {
          "fr": "L'envoyé spécial couvre la guerre sur place.",
          "ko": "특파원이 현장에서 전쟁을 취재해요."
        }
      },
      {
        "fr": "le japonais",
        "ipa": "[ʒapɔnɛ]",
        "ko": "일본인, 일본어",
        "pos": "n.m.",
        "ex": {
          "fr": "Le japonais s'écrit avec plusieurs systèmes.",
          "ko": "일본어는 여러 문자 체계로 써요."
        }
      },
      {
        "fr": "le drogué",
        "ipa": "[dʁɔge]",
        "ko": "마약 중독자",
        "pos": "n.m.",
        "ex": {
          "fr": "Le centre aide les drogués à s'en sortir.",
          "ko": "그 센터는 마약 중독자들의 재활을 도와요."
        }
      },
      {
        "fr": "l'adjoint (m.)",
        "ipa": "[adʒwɛ̃]",
        "ko": "부관, 보좌역",
        "pos": "n.m.",
        "ex": {
          "fr": "L'adjoint au maire a répondu à la presse.",
          "ko": "부시장이 기자단의 질문에 답했어요."
        }
      },
      {
        "fr": "le psy",
        "ipa": "[psi]",
        "ko": "정신과 의사, 심리상담사",
        "pos": "n.m.",
        "ex": {
          "fr": "Elle voit un psy depuis quelques mois.",
          "ko": "그녀는 몇 달째 심리상담사를 만나고 있어요."
        }
      },
      {
        "fr": "l'effraction (f.)",
        "ipa": "[efʁaksjɔ̃]",
        "ko": "(불법) 침입, 무단 침입",
        "pos": "n.f.",
        "ex": {
          "fr": "Les voleurs sont entrés par effraction.",
          "ko": "도둑들이 문을 부수고 침입했어요."
        }
      },
      {
        "fr": "le juif",
        "ipa": "[ʒɥif]",
        "ko": "유대인",
        "pos": "n.m.",
        "ex": {
          "fr": "Beaucoup de juifs habitent ce quartier.",
          "ko": "이 동네에는 유대인이 많이 살아요."
        }
      },
      {
        "fr": "l'otage (m.)",
        "ipa": "[ɔtaʒ]",
        "ko": "인질",
        "pos": "n.m.",
        "ex": {
          "fr": "Les otages ont été libérés sains et saufs.",
          "ko": "인질들은 무사히 풀려났어요."
        }
      },
      {
        "fr": "le tireur",
        "ipa": "[tiʁœʁ]",
        "ko": "사격수, 총격범",
        "pos": "n.m.",
        "ex": {
          "fr": "La police recherche le tireur.",
          "ko": "경찰이 총격범을 추적하고 있어요."
        }
      }
    ]
  },
  {
    "name": "경제와 산업",
    "icon": "📈",
    "words": [
      {
        "fr": "la fabrique",
        "ipa": "[fabʁik]",
        "ko": "공장, 제작소",
        "pos": "n.f.",
        "ex": {
          "fr": "Mon grand-père travaillait dans une fabrique de meubles.",
          "ko": "할아버지는 가구 공장에서 일하셨어요."
        }
      },
      {
        "fr": "la pompe",
        "ipa": "[pɔ̃p]",
        "ko": "펌프",
        "pos": "n.f.",
        "en": "pump",
        "ex": {
          "fr": "La pompe à essence est de l'autre côté.",
          "ko": "주유 펌프는 반대쪽에 있어요."
        }
      },
      {
        "fr": "la flotte",
        "ipa": "[flɔt]",
        "ko": "함대, (차량) 보유 대수",
        "pos": "n.f.",
        "ex": {
          "fr": "L'entreprise renouvelle sa flotte de camions.",
          "ko": "그 회사는 트럭 보유 차량을 새것으로 바꿔요."
        }
      },
      {
        "fr": "le bétail",
        "ipa": "[betaj]",
        "ko": "가축",
        "pos": "n.m.",
        "ex": {
          "fr": "Le fermier nourrit son bétail chaque matin.",
          "ko": "농부는 매일 아침 가축에게 먹이를 줘요."
        }
      },
      {
        "fr": "le chariot",
        "ipa": "[ʃaʁjo]",
        "ko": "카트, 수레",
        "pos": "n.m.",
        "ex": {
          "fr": "Elle remplit son chariot au supermarché.",
          "ko": "그녀는 마트에서 카트를 채워요."
        }
      }
    ]
  },
  {
    "name": "환경과 과학",
    "icon": "🔬",
    "words": [
      {
        "fr": "la fréquence",
        "ipa": "[fʁekɑ̃s]",
        "ko": "빈도, 주파수",
        "pos": "n.f.",
        "en": "frequency",
        "ex": {
          "fr": "Le bus passe à une fréquence de dix minutes.",
          "ko": "버스는 10분 간격으로 와요."
        }
      },
      {
        "fr": "l'infection (f.)",
        "ipa": "[ɛ̃fɛksjɔ̃]",
        "ko": "감염, 염증",
        "pos": "n.f.",
        "en": "infection",
        "ex": {
          "fr": "La plaie a provoqué une infection.",
          "ko": "상처가 감염을 일으켰어요."
        }
      },
      {
        "fr": "la dose",
        "ipa": "[doz]",
        "ko": "용량, 분량",
        "pos": "n.f.",
        "en": "dose",
        "ex": {
          "fr": "Ne dépasse pas la dose indiquée.",
          "ko": "표시된 용량을 넘기지 마세요."
        }
      },
      {
        "fr": "la météo",
        "ipa": "[meteo]",
        "ko": "일기 예보, 날씨",
        "pos": "n.f.",
        "ex": {
          "fr": "J'ai regardé la météo avant de partir.",
          "ko": "출발하기 전에 일기 예보를 봤어요."
        }
      },
      {
        "fr": "le tonnerre",
        "ipa": "[tɔnɛʁ]",
        "ko": "천둥",
        "pos": "n.m.",
        "ex": {
          "fr": "Le tonnerre a fait peur aux enfants.",
          "ko": "천둥소리에 아이들이 깜짝 놀랐어요."
        }
      },
      {
        "fr": "le cristal",
        "ipa": "[kʁistal]",
        "ko": "수정, 크리스탈",
        "pos": "n.m.",
        "en": "crystal",
        "ex": {
          "fr": "Les verres en cristal brillent à la lumière.",
          "ko": "크리스탈 잔이 빛에 반짝여요."
        }
      },
      {
        "fr": "le périmètre",
        "ipa": "[peʁimɛtʁ]",
        "ko": "둘레, 구역",
        "pos": "n.m.",
        "en": "perimeter",
        "ex": {
          "fr": "La police a bouclé le périmètre.",
          "ko": "경찰이 그 구역을 봉쇄했어요."
        }
      },
      {
        "fr": "la jetée",
        "ipa": "[ʒəte]",
        "ko": "방파제, 부두",
        "pos": "n.f.",
        "ex": {
          "fr": "Nous avons marché jusqu'au bout de la jetée.",
          "ko": "우리는 방파제 끝까지 걸어갔어요."
        }
      },
      {
        "fr": "la noix",
        "ipa": "[nwa]",
        "ko": "호두",
        "pos": "n.f.",
        "ex": {
          "fr": "J'ajoute des noix dans la salade.",
          "ko": "샐러드에 호두를 넣어요."
        }
      },
      {
        "fr": "l'orbite (f.)",
        "ipa": "[ɔʁbit]",
        "ko": "궤도",
        "pos": "n.f.",
        "en": "orbit",
        "ex": {
          "fr": "Le satellite est en orbite autour de la Terre.",
          "ko": "그 위성은 지구 궤도를 돌고 있어요."
        }
      },
      {
        "fr": "la tumeur",
        "ipa": "[tymœʁ]",
        "ko": "종양",
        "pos": "n.f.",
        "en": "tumor",
        "ex": {
          "fr": "Les médecins ont retiré la tumeur.",
          "ko": "의사들이 종양을 제거했어요."
        }
      },
      {
        "fr": "le chaos",
        "ipa": "[kao]",
        "ko": "혼돈, 무질서",
        "pos": "n.m.",
        "en": "chaos",
        "ex": {
          "fr": "La grève a plongé la ville dans le chaos.",
          "ko": "파업으로 도시가 혼란에 빠졌어요."
        }
      }
    ]
  },
  {
    "name": "예술과 문화",
    "icon": "🎭",
    "words": [
      {
        "fr": "le cocktail",
        "ipa": "[kɔktɛl]",
        "ko": "칵테일",
        "pos": "n.m.",
        "en": "cocktail",
        "ex": {
          "fr": "Elle a commandé un cocktail sans alcool.",
          "ko": "그녀는 무알코올 칵테일을 주문했어요."
        }
      },
      {
        "fr": "le show",
        "ipa": "[ʃo]",
        "ko": "쇼, 공연",
        "pos": "n.m.",
        "en": "show",
        "ex": {
          "fr": "Le chanteur a fait un show incroyable.",
          "ko": "그 가수는 굉장한 쇼를 펼쳤어요."
        }
      },
      {
        "fr": "le barbecue",
        "ipa": "[baʁbəkju]",
        "ko": "바비큐",
        "pos": "n.m.",
        "en": "barbecue",
        "ex": {
          "fr": "On fait un barbecue dans le jardin ce soir.",
          "ko": "오늘 저녁에 정원에서 바비큐를 해요."
        }
      },
      {
        "fr": "le casino",
        "ipa": "[kazino]",
        "ko": "카지노",
        "pos": "n.m.",
        "en": "casino",
        "ex": {
          "fr": "Il a perdu beaucoup d'argent au casino.",
          "ko": "그는 카지노에서 돈을 많이 잃었어요."
        }
      },
      {
        "fr": "la relecture",
        "ipa": "[ʁəlɛktyʁ]",
        "ko": "교정, 재독",
        "pos": "n.f.",
        "ex": {
          "fr": "Le texte a besoin d'une relecture attentive.",
          "ko": "이 글은 꼼꼼한 교정이 필요해요."
        }
      }
    ]
  },
  {
    "name": "추상·논증 명사",
    "icon": "💭",
    "words": [
      {
        "fr": "la destruction",
        "ipa": "[dɛstʁyksjɔ̃]",
        "ko": "파괴, 파손",
        "pos": "n.f.",
        "en": "destruction",
        "ex": {
          "fr": "La tempête a causé la destruction de plusieurs maisons.",
          "ko": "폭풍이 집 여러 채를 파괴했어요."
        }
      },
      {
        "fr": "le désastre",
        "ipa": "[dezastʁ]",
        "ko": "재난, 큰 실패",
        "pos": "n.m.",
        "en": "disaster",
        "ex": {
          "fr": "La soirée a été un vrai désastre.",
          "ko": "그 저녁 모임은 완전한 실패였어요."
        }
      },
      {
        "fr": "la division",
        "ipa": "[divizjɔ̃]",
        "ko": "분할, 나눗셈, 분열",
        "pos": "n.f.",
        "en": "division",
        "ex": {
          "fr": "La division du travail rend l'équipe plus efficace.",
          "ko": "분업이 팀을 더 효율적으로 만들어요."
        }
      },
      {
        "fr": "la trahison",
        "ipa": "[tʁɛzɔ̃]",
        "ko": "배신, 배반",
        "pos": "n.f.",
        "ex": {
          "fr": "Il a vécu son départ comme une trahison.",
          "ko": "그는 그의 떠남을 배신처럼 느꼈어요."
        }
      },
      {
        "fr": "le potentiel",
        "ipa": "[pɔtɑ̃sjɛl]",
        "ko": "잠재력, 가능성",
        "pos": "n.m.",
        "en": "potential",
        "ex": {
          "fr": "Ce jeune joueur a un grand potentiel.",
          "ko": "이 젊은 선수는 잠재력이 커요."
        }
      },
      {
        "fr": "la destinée",
        "ipa": "[dɛstine]",
        "ko": "운명, 숙명",
        "pos": "n.f.",
        "ex": {
          "fr": "Chacun forge sa propre destinée.",
          "ko": "사람은 저마다 자기 운명을 만들어 가요."
        }
      },
      {
        "fr": "l'éternité (f.)",
        "ipa": "[etɛʁnite]",
        "ko": "영원, 영겁",
        "pos": "n.f.",
        "en": "eternity",
        "ex": {
          "fr": "Je t'ai attendu une éternité.",
          "ko": "정말 한참을 너를 기다렸어요."
        }
      },
      {
        "fr": "la retenue",
        "ipa": "[ʁətəny]",
        "ko": "절제, 공제, (학교) 벌로 남기기",
        "pos": "n.f.",
        "ex": {
          "fr": "Il a parlé avec retenue.",
          "ko": "그는 절제 있게 말했어요."
        }
      },
      {
        "fr": "la détresse",
        "ipa": "[detʁɛs]",
        "ko": "고통, 곤경",
        "pos": "n.f.",
        "ex": {
          "fr": "Elle a appelé à l'aide dans sa détresse.",
          "ko": "그녀는 곤경에 빠져 도움을 청했어요."
        }
      },
      {
        "fr": "la cheville",
        "ipa": "[ʃəvij]",
        "ko": "발목",
        "pos": "n.f.",
        "ex": {
          "fr": "Je me suis foulé la cheville en courant.",
          "ko": "달리다가 발목을 삐었어요."
        }
      },
      {
        "fr": "l'objection (f.)",
        "ipa": "[ɔbʒɛksjɔ̃]",
        "ko": "이의, 반대",
        "pos": "n.f.",
        "en": "objection",
        "ex": {
          "fr": "Si personne n'a d'objection, on continue.",
          "ko": "아무도 이의가 없으면 계속할게요."
        }
      },
      {
        "fr": "le malentendu",
        "ipa": "[malɑ̃tɑ̃dy]",
        "ko": "오해",
        "pos": "n.m.",
        "ex": {
          "fr": "Tout cela n'était qu'un simple malentendu.",
          "ko": "그건 다 그저 단순한 오해였어요."
        }
      },
      {
        "fr": "l'instinct (m.)",
        "ipa": "[ɛ̃stɛ̃]",
        "ko": "본능, 직감",
        "pos": "n.m.",
        "en": "instinct",
        "ex": {
          "fr": "Suis ton instinct, il a souvent raison.",
          "ko": "직감을 따라요, 대개 맞으니까요."
        }
      },
      {
        "fr": "la pique",
        "ipa": "[pik]",
        "ko": "가시 돋친 말, 빈정거림",
        "pos": "n.f.",
        "ex": {
          "fr": "Il m'a lancé une petite pique.",
          "ko": "그가 나한테 살짝 가시 돋친 말을 던졌어요."
        }
      },
      {
        "fr": "le tir",
        "ipa": "[tiʁ]",
        "ko": "사격, 발사, 슛",
        "pos": "n.m.",
        "ex": {
          "fr": "Le joueur a réussi un beau tir.",
          "ko": "그 선수가 멋진 슛을 성공시켰어요."
        }
      },
      {
        "fr": "le restant",
        "ipa": "[ʁɛstɑ̃]",
        "ko": "나머지, 남은 것",
        "pos": "n.m.",
        "ex": {
          "fr": "J'ai gardé le restant pour demain.",
          "ko": "남은 건 내일 먹으려고 남겨 뒀어요."
        }
      },
      {
        "fr": "la culpabilité",
        "ipa": "[kylpabilite]",
        "ko": "죄책감, 유죄",
        "pos": "n.f.",
        "ex": {
          "fr": "Elle ressent une grande culpabilité.",
          "ko": "그녀는 큰 죄책감을 느껴요."
        }
      },
      {
        "fr": "la flèche",
        "ipa": "[flɛʃ]",
        "ko": "화살, 화살표",
        "pos": "n.f.",
        "ex": {
          "fr": "Suis la flèche pour trouver la sortie.",
          "ko": "화살표를 따라가면 출구가 나와요."
        }
      },
      {
        "fr": "l'innocence (f.)",
        "ipa": "[inɔsɑ̃s]",
        "ko": "무죄, 순수함",
        "pos": "n.f.",
        "en": "innocence",
        "ex": {
          "fr": "L'avocat a prouvé l'innocence de son client.",
          "ko": "변호사가 의뢰인의 무죄를 입증했어요."
        }
      },
      {
        "fr": "l'arrangement (m.)",
        "ipa": "[aʁɑ̃ʒmɑ̃]",
        "ko": "합의, 정리, 편곡",
        "pos": "n.m.",
        "ex": {
          "fr": "Nous avons trouvé un arrangement à l'amiable.",
          "ko": "우리는 원만하게 합의를 봤어요."
        }
      }
    ]
  },
  {
    "name": "핵심 동사",
    "icon": "🏃",
    "words": [
      {
        "fr": "localiser",
        "ipa": "[lɔkalize]",
        "ko": "위치를 찾다, 위치를 파악하다",
        "pos": "v.",
        "en": "locate",
        "ex": {
          "fr": "La police a réussi à localiser le téléphone.",
          "ko": "경찰은 그 휴대폰의 위치를 파악해 냈어요."
        }
      },
      {
        "fr": "se suicider",
        "ipa": "[sɥiside]",
        "ko": "자살하다",
        "pos": "v.pron.",
        "ex": {
          "fr": "Le personnage du roman finit par se suicider.",
          "ko": "소설 속 인물은 결국 스스로 목숨을 끊어요."
        }
      },
      {
        "fr": "buter",
        "ipa": "[byte]",
        "ko": "부딪치다, 걸려 넘어지다",
        "pos": "v.",
        "ex": {
          "fr": "J'ai buté contre une pierre.",
          "ko": "돌에 걸려 비틀거렸어요."
        }
      }
    ]
  },
  {
    "name": "형용사 — 뉘앙스",
    "icon": "🎨",
    "words": [
      {
        "fr": "conscient / consciente",
        "ipa": "[kɔ̃sjɑ̃ / kɔ̃sjɑ̃t]",
        "ko": "의식하는, 자각하는",
        "pos": "adj.",
        "en": "conscious",
        "ex": {
          "fr": "Elle est consciente du risque.",
          "ko": "그녀는 그 위험을 잘 알고 있어요."
        }
      },
      {
        "fr": "inconscient / inconsciente",
        "ipa": "[ɛ̃kɔ̃sjɑ̃ / ɛ̃kɔ̃sjɑ̃t]",
        "ko": "무의식적인, 무모한",
        "pos": "adj.",
        "en": "unconscious",
        "ex": {
          "fr": "Il est resté inconscient quelques minutes.",
          "ko": "그는 몇 분 동안 의식을 잃었어요."
        }
      },
      {
        "fr": "irlandais / irlandaise",
        "ipa": "[iʁlɑ̃dɛ / iʁlɑ̃dɛz]",
        "ko": "아일랜드의",
        "pos": "adj.",
        "ex": {
          "fr": "J'adore la musique irlandaise.",
          "ko": "저는 아일랜드 음악을 정말 좋아해요."
        }
      },
      {
        "fr": "conducteur / conductrice",
        "ipa": "[kɔ̃dyktœʁ / kɔ̃dyktʁis]",
        "ko": "전도성의, 전도하는",
        "pos": "adj.",
        "ex": {
          "fr": "Le cuivre est un métal conducteur.",
          "ko": "구리는 전도성이 있는 금속이에요."
        }
      },
      {
        "fr": "pervers / perverse",
        "ipa": "[pɛʁvɛʁ / pɛʁvɛʁs]",
        "ko": "비뚤어진, 도착적인",
        "pos": "adj.",
        "en": "perverse",
        "ex": {
          "fr": "Cette mesure a eu un effet pervers.",
          "ko": "그 조치는 예기치 못한 역효과를 냈어요."
        }
      },
      {
        "fr": "informé / informée",
        "ipa": "[ɛ̃fɔʁme / ɛ̃fɔʁme]",
        "ko": "정보에 밝은, 잘 아는",
        "pos": "adj.",
        "ex": {
          "fr": "C'est une lectrice bien informée.",
          "ko": "그녀는 정보에 아주 밝은 독자예요."
        }
      },
      {
        "fr": "croisé / croisée",
        "ipa": "[kʁwaze / kʁwaze]",
        "ko": "교차한, 엇갈린",
        "pos": "adj.",
        "ex": {
          "fr": "Ils ont échangé un regard croisé.",
          "ko": "그들은 서로 눈빛을 주고받았어요."
        }
      },
      {
        "fr": "rêvé / rêvée",
        "ipa": "[ʁɛve / ʁɛve]",
        "ko": "꿈에 그리던, 더없이 이상적인",
        "pos": "adj.",
        "ex": {
          "fr": "C'est l'endroit rêvé pour des vacances.",
          "ko": "여기는 휴가 보내기에 꿈 같은 곳이에요."
        }
      },
      {
        "fr": "étudié / étudiée",
        "ipa": "[etydje / etydje]",
        "ko": "신중히 계산된, 공들인",
        "pos": "adj.",
        "ex": {
          "fr": "Ses prix sont très étudiés.",
          "ko": "그 가게의 가격은 아주 합리적으로 책정돼 있어요."
        }
      },
      {
        "fr": "lié / liée",
        "ipa": "[lje / lje]",
        "ko": "연결된, 관련된",
        "pos": "adj.",
        "ex": {
          "fr": "Ces deux problèmes sont étroitement liés.",
          "ko": "이 두 문제는 밀접하게 관련돼 있어요."
        }
      },
      {
        "fr": "conçu / conçue",
        "ipa": "[kɔ̃sy / kɔ̃sy]",
        "ko": "설계된, 고안된",
        "pos": "adj.",
        "ex": {
          "fr": "Ce logiciel est conçu pour les débutants.",
          "ko": "이 소프트웨어는 초보자를 위해 만들어졌어요."
        }
      },
      {
        "fr": "excitant / excitante",
        "ipa": "[ɛksitɑ̃ / ɛksitɑ̃t]",
        "ko": "흥미진진한, 자극적인",
        "pos": "adj.",
        "en": "exciting",
        "ex": {
          "fr": "C'est un projet vraiment excitant.",
          "ko": "정말 흥미진진한 프로젝트예요."
        }
      },
      {
        "fr": "insensé / insensée",
        "ipa": "[ɛ̃sɑ̃se / ɛ̃sɑ̃se]",
        "ko": "터무니없는, 정신 나간",
        "pos": "adj.",
        "ex": {
          "fr": "C'est une idée complètement insensée.",
          "ko": "그건 완전히 터무니없는 생각이에요."
        }
      },
      {
        "fr": "junior",
        "ipa": "[ʒynjɔʁ]",
        "ko": "주니어의, 후배의",
        "pos": "adj.",
        "en": "junior",
        "ex": {
          "fr": "Il a rejoint l'équipe junior du club.",
          "ko": "그는 클럽의 주니어 팀에 들어갔어요."
        }
      },
      {
        "fr": "original / originale",
        "ipa": "[ɔʁiʒinal / ɔʁiʒinal]",
        "ko": "독창적인, 원래의",
        "pos": "adj.",
        "en": "original",
        "ex": {
          "fr": "Son idée est vraiment originale.",
          "ko": "그녀의 아이디어는 정말 독창적이에요."
        }
      },
      {
        "fr": "renversé / renversée",
        "ipa": "[ʁɑ̃vɛʁse / ʁɑ̃vɛʁse]",
        "ko": "뒤집힌, 엎질러진",
        "pos": "adj.",
        "ex": {
          "fr": "Le verre renversé a taché la nappe.",
          "ko": "엎질러진 잔이 식탁보를 더럽혔어요."
        }
      },
      {
        "fr": "standard",
        "ipa": "[stɑ̃daʁ]",
        "ko": "표준의, 기본의",
        "pos": "adj.",
        "en": "standard",
        "ex": {
          "fr": "C'est le modèle standard, sans options.",
          "ko": "옵션 없는 기본 모델이에요."
        }
      }
    ]
  },
  {
    "name": "부사와 담화 표지",
    "icon": "🔗",
    "words": [
      {
        "fr": "techniquement",
        "ipa": "[tɛknikmɑ̃]",
        "ko": "기술적으로, 엄밀히 말하면",
        "pos": "adv.",
        "ex": {
          "fr": "Techniquement, c'est encore possible.",
          "ko": "엄밀히 말하면 아직 가능해요."
        }
      },
      {
        "fr": "honnêtement",
        "ipa": "[ɔnɛtmɑ̃]",
        "ko": "솔직히, 정직하게",
        "pos": "adv.",
        "en": "honestly",
        "ex": {
          "fr": "Honnêtement, je ne sais pas quoi répondre.",
          "ko": "솔직히 뭐라고 답해야 할지 모르겠어요."
        }
      },
      {
        "fr": "soudainement",
        "ipa": "[sudɛnmɑ̃]",
        "ko": "갑자기, 별안간",
        "pos": "adv.",
        "ex": {
          "fr": "La pluie a soudainement cessé.",
          "ko": "비가 갑자기 그쳤어요."
        }
      }
    ]
  },
  {
    "name": "그 밖의 어휘",
    "icon": "📚",
    "words": [
      {
        "fr": "l'antenne (f.)",
        "ipa": "[ɑ̃tɛn]",
        "ko": "안테나, (방송) 출연",
        "pos": "n.f.",
        "ex": {
          "fr": "Règle l'antenne, l'image est mauvaise.",
          "ko": "안테나 좀 맞춰요, 화면이 안 좋아요."
        }
      },
      {
        "fr": "le relais",
        "ipa": "[ʁəlɛ]",
        "ko": "릴레이, 중계, 교대",
        "pos": "n.m.",
        "ex": {
          "fr": "Elle a pris le relais quand j'étais fatigué.",
          "ko": "내가 지쳤을 때 그녀가 교대로 맡아 줬어요."
        }
      },
      {
        "fr": "le pro",
        "ipa": "[pʁo]",
        "ko": "프로, 전문가",
        "pos": "n.m.",
        "ex": {
          "fr": "Pour ce travail, fais appel à un pro.",
          "ko": "이 일은 전문가한테 맡겨요."
        }
      },
      {
        "fr": "le kit",
        "ipa": "[kit]",
        "ko": "키트, 도구 세트",
        "pos": "n.m.",
        "en": "kit",
        "ex": {
          "fr": "J'ai acheté un kit de réparation pour le vélo.",
          "ko": "자전거 수리 키트를 샀어요."
        }
      },
      {
        "fr": "le portail",
        "ipa": "[pɔʁtaj]",
        "ko": "정문, (인터넷) 포털",
        "pos": "n.m.",
        "ex": {
          "fr": "Connecte-toi au portail de l'université.",
          "ko": "대학교 포털에 접속해요."
        }
      },
      {
        "fr": "la traverse",
        "ipa": "[tʁavɛʁs]",
        "ko": "가로대, 침목",
        "pos": "n.f.",
        "ex": {
          "fr": "Les traverses du chemin de fer sont en béton.",
          "ko": "철로의 침목은 콘크리트로 되어 있어요."
        }
      },
      {
        "fr": "le scanner",
        "ipa": "[skanɛʁ]",
        "ko": "스캐너, (의료) CT 촬영",
        "pos": "n.m.",
        "en": "scanner",
        "ex": {
          "fr": "Le médecin a demandé un scanner.",
          "ko": "의사가 CT 촬영을 요청했어요."
        }
      },
      {
        "fr": "le câlin",
        "ipa": "[kalɛ̃]",
        "ko": "포옹, 껴안기",
        "pos": "n.m.",
        "ex": {
          "fr": "L'enfant a fait un câlin à sa mère.",
          "ko": "아이가 엄마를 꼭 껴안았어요."
        }
      }
    ]
  }
];

export default themes;
