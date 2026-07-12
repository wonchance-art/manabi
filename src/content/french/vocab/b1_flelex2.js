/**
 * B1 보강 어휘 (2차) — FLELex 등급을 실제 빈도로 보정.
 * index.js의 mergeFrVocab가 본편과 병합.
 */
const themes = [
  {
    "name": "사회와 제도",
    "icon": "🏛️",
    "words": [
      {
        "fr": "l'alerte (f.)",
        "ipa": "[alɛʁt]",
        "ko": "경보, 경고",
        "pos": "n.f.",
        "en": "alert",
        "etym": "영어 alert와 같은 뿌리예요.",
        "ex": {
          "fr": "Une alerte météo a été lancée.",
          "ko": "기상 경보가 발령됐어요."
        }
      }
    ]
  },
  {
    "name": "일과 경제",
    "icon": "💼",
    "words": [
      {
        "fr": "le fric",
        "ipa": "[fʁik]",
        "ko": "돈 (속어)",
        "pos": "n.m.",
        "etym": "아주 구어적인 속어예요. 친구끼리 편하게 '돈'을 말할 때 써요.",
        "ex": {
          "fr": "Je n'ai plus de fric jusqu'à la fin du mois.",
          "ko": "월말까지 돈이 하나도 없어요."
        }
      }
    ]
  },
  {
    "name": "미디어·기술·문화",
    "icon": "📱",
    "words": [
      {
        "fr": "la colle",
        "ipa": "[kɔl]",
        "ko": "풀, 접착제",
        "pos": "n.f.",
        "ex": {
          "fr": "J'ai collé l'affiche avec de la colle.",
          "ko": "풀로 포스터를 붙였어요."
        }
      },
      {
        "fr": "le virus",
        "ipa": "[viʁys]",
        "ko": "바이러스",
        "pos": "n.m.",
        "en": "virus",
        "etym": "라틴어 virus(독) — 영어 virus와 같은 뿌리예요. 병원체와 컴퓨터 둘 다에 써요.",
        "ex": {
          "fr": "Un virus a infecté mon ordinateur.",
          "ko": "바이러스가 제 컴퓨터를 감염시켰어요."
        }
      },
      {
        "fr": "le tapis",
        "ipa": "[tapi]",
        "ko": "양탄자, 카펫, 매트",
        "pos": "n.m.",
        "ex": {
          "fr": "Il y a un beau tapis dans le salon.",
          "ko": "거실에 예쁜 양탄자가 있어요."
        }
      },
      {
        "fr": "le direct",
        "ipa": "[diʁɛkt]",
        "ko": "생방송, 라이브",
        "pos": "n.m.",
        "en": "direct",
        "etym": "영어 direct와 같은 뿌리지만, en direct는 '생방송으로'라는 뜻이에요.",
        "ex": {
          "fr": "Le match est diffusé en direct.",
          "ko": "경기가 생방송으로 중계돼요."
        }
      },
      {
        "fr": "le moteur",
        "ipa": "[mɔtœʁ]",
        "ko": "엔진, 모터",
        "pos": "n.m.",
        "en": "motor",
        "etym": "영어 motor와 같은 뿌리예요.",
        "ex": {
          "fr": "Le moteur de la voiture fait un bruit bizarre.",
          "ko": "차 엔진에서 이상한 소리가 나요."
        }
      }
    ]
  },
  {
    "name": "사람·관계·감정",
    "icon": "👥",
    "words": [
      {
        "fr": "l'estomac (m.)",
        "ipa": "[ɛstɔma]",
        "ko": "위, 속",
        "pos": "n.m.",
        "ex": {
          "fr": "J'ai mal à l'estomac.",
          "ko": "속이 아파요."
        }
      },
      {
        "fr": "le pote",
        "ipa": "[pɔt]",
        "ko": "친구, 동무 (구어)",
        "pos": "n.m.",
        "etym": "친구끼리 쓰는 편한 말이에요. ami보다 캐주얼해요.",
        "ex": {
          "fr": "Je sors avec mes potes ce soir.",
          "ko": "오늘 저녁에 친구들이랑 나가요."
        }
      },
      {
        "fr": "le crâne",
        "ipa": "[kʁɑn]",
        "ko": "두개골, 머리",
        "pos": "n.m.",
        "ex": {
          "fr": "Il s'est cogné le crâne contre la porte.",
          "ko": "그는 문에 머리를 부딪쳤어요."
        }
      }
    ]
  },
  {
    "name": "추상·개념 명사",
    "icon": "💭",
    "words": [
      {
        "fr": "le vécu",
        "ipa": "[veky]",
        "ko": "경험, 살아온 것, 체험",
        "pos": "n.m.",
        "ex": {
          "fr": "Elle parle de son vécu pendant la guerre.",
          "ko": "그녀는 전쟁 동안의 자기 경험을 이야기해요."
        }
      },
      {
        "fr": "l'aura (f.)",
        "ipa": "[ɔʁa]",
        "ko": "아우라, 분위기, 기운",
        "pos": "n.f.",
        "en": "aura",
        "etym": "영어 aura와 같은 뿌리예요.",
        "ex": {
          "fr": "Cette actrice a une aura mystérieuse.",
          "ko": "그 배우는 신비로운 아우라가 있어요."
        }
      }
    ]
  },
  {
    "name": "형용사",
    "icon": "🎨",
    "words": [
      {
        "fr": "liquide",
        "ipa": "[likid]",
        "ko": "액체의, 액상의; (돈이) 현금의",
        "pos": "adj.",
        "en": "liquid",
        "etym": "영어 liquid와 같은 뿌리예요. payer en liquide는 '현금으로 내다'예요.",
        "ex": {
          "fr": "Je préfère payer en liquide.",
          "ko": "저는 현금으로 내는 걸 더 좋아해요."
        }
      },
      {
        "fr": "clinique",
        "ipa": "[klinik]",
        "ko": "임상의, 진료의",
        "pos": "adj.",
        "en": "clinical",
        "etym": "영어 clinical과 같은 뿌리예요. la clinique는 명사로 '병원, 클리닉'이에요.",
        "ex": {
          "fr": "Le médecin a fait un examen clinique.",
          "ko": "의사가 임상 진찰을 했어요."
        }
      },
      {
        "fr": "obligé / obligée",
        "ipa": "[ɔbliʒe / ɔbliʒe]",
        "ko": "어쩔 수 없는, ~해야만 하는",
        "pos": "adj.",
        "ex": {
          "fr": "Je suis obligé de partir tôt.",
          "ko": "저는 일찍 떠나야만 해요."
        }
      },
      {
        "fr": "curieux / curieuse",
        "ipa": "[kyʁjø / kyʁjøz]",
        "ko": "호기심 많은; 이상한, 신기한",
        "pos": "adj.",
        "en": "curious",
        "etym": "영어 curious와 같은 뿌리예요.",
        "ex": {
          "fr": "Les enfants sont curieux de tout.",
          "ko": "아이들은 모든 것에 호기심이 많아요."
        }
      },
      {
        "fr": "forcé / forcée",
        "ipa": "[fɔʁse / fɔʁse]",
        "ko": "억지의, 강요된; 당연한",
        "pos": "adj.",
        "ex": {
          "fr": "Il m'a fait un sourire forcé.",
          "ko": "그는 저에게 억지웃음을 지었어요."
        }
      },
      {
        "fr": "imbécile",
        "ipa": "[ɛ̃besil]",
        "ko": "바보 같은, 멍청한",
        "pos": "adj.",
        "ex": {
          "fr": "C'était une idée imbécile.",
          "ko": "그건 바보 같은 생각이었어요."
        }
      },
      {
        "fr": "dingue",
        "ipa": "[dɛ̃ɡ]",
        "ko": "미친, 엄청난 (구어)",
        "pos": "adj.",
        "etym": "아주 구어적인 말이에요. '대박이다, 미쳤다' 느낌이에요.",
        "ex": {
          "fr": "C'est dingue, il fait trente degrés en hiver !",
          "ko": "겨울에 30도라니, 미쳤어요!"
        }
      },
      {
        "fr": "posé / posée",
        "ipa": "[poze / poze]",
        "ko": "차분한, 침착한",
        "pos": "adj.",
        "ex": {
          "fr": "Il a répondu d'une voix posée.",
          "ko": "그는 차분한 목소리로 대답했어요."
        }
      },
      {
        "fr": "réussi / réussie",
        "ipa": "[ʁeysi / ʁeysi]",
        "ko": "성공적인, 잘된",
        "pos": "adj.",
        "ex": {
          "fr": "La fête était très réussie.",
          "ko": "파티가 아주 성공적이었어요."
        }
      },
      {
        "fr": "assis / assise",
        "ipa": "[asi / asiz]",
        "ko": "앉아 있는",
        "pos": "adj.",
        "ex": {
          "fr": "Elle est assise près de la fenêtre.",
          "ko": "그녀는 창가에 앉아 있어요."
        }
      },
      {
        "fr": "pris / prise",
        "ipa": "[pʁi / pʁiz]",
        "ko": "(자리가) 찬, (사람이) 바쁜",
        "pos": "adj.",
        "ex": {
          "fr": "Désolé, je suis pris ce soir.",
          "ko": "미안해요, 오늘 저녁엔 제가 바빠요."
        }
      },
      {
        "fr": "réfléchi / réfléchie",
        "ipa": "[ʁefleʃi / ʁefleʃi]",
        "ko": "신중한, 사려 깊은",
        "pos": "adj.",
        "ex": {
          "fr": "C'est une personne calme et réfléchie.",
          "ko": "차분하고 사려 깊은 사람이에요."
        }
      },
      {
        "fr": "ravi / ravie",
        "ipa": "[ʁavi / ʁavi]",
        "ko": "매우 기쁜, 아주 반가운",
        "pos": "adj.",
        "ex": {
          "fr": "Je suis ravi de te voir !",
          "ko": "너를 봐서 정말 기뻐요!"
        }
      },
      {
        "fr": "élevé / élevée",
        "ipa": "[elve / elve]",
        "ko": "높은, (수준·가격이) 높은",
        "pos": "adj.",
        "ex": {
          "fr": "Le prix est trop élevé pour moi.",
          "ko": "가격이 저한테는 너무 높아요."
        }
      }
    ]
  },
  {
    "name": "부사와 연결어",
    "icon": "🔗",
    "words": [
      {
        "fr": "environ",
        "ipa": "[ɑ̃viʁɔ̃]",
        "ko": "약, 대략",
        "pos": "adv.",
        "ex": {
          "fr": "Il y a environ vingt personnes.",
          "ko": "사람이 약 스무 명 있어요."
        }
      }
    ]
  }
];

export default themes;
