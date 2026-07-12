/**
 * H1 추가 예문 — 섹션별 보강(slug → 섹션index → 예문).
 * index.js가 본편 챕터 섹션에 병합. 본문/원본 예문은 불변.
 */
const examples = {
  "h1-01-shi": {
    "0": [
      {
        "zh": "她是医生。",
        "pinyin": "Tā shì yīshēng.",
        "ko": "그녀는 의사예요."
      },
      {
        "zh": "这是我的朋友。",
        "pinyin": "Zhè shì wǒ de péngyou.",
        "ko": "이 사람은 제 친구예요."
      }
    ],
    "1": [
      {
        "zh": "她不是学生。",
        "pinyin": "Tā bú shì xuésheng.",
        "ko": "그녀는 학생이 아니에요.",
        "note": "不는 4성 是 앞에서 2성(bú)으로 변조"
      },
      {
        "zh": "这不是我的书。",
        "pinyin": "Zhè bú shì wǒ de shū.",
        "ko": "이것은 제 책이 아니에요."
      }
    ],
    "2": [
      {
        "zh": "今天很热。",
        "pinyin": "Jīntiān hěn rè.",
        "ko": "오늘은 더워요.",
        "note": "형용사 술어 앞에는 是 대신 很"
      },
      {
        "zh": "她很漂亮。",
        "pinyin": "Tā hěn piàoliang.",
        "ko": "그녀는 예뻐요."
      }
    ]
  },
  "h1-02-you": {
    "0": [
      {
        "zh": "我有一个女儿。",
        "pinyin": "Wǒ yǒu yí ge nǚ'ér.",
        "ko": "저는 딸이 한 명 있어요."
      },
      {
        "zh": "桌子上有书。",
        "pinyin": "Zhuōzi shàng yǒu shū.",
        "ko": "책상 위에 책이 있어요.",
        "note": "장소 + 有 + 명사 = 존재"
      }
    ],
    "1": [
      {
        "zh": "我没有儿子。",
        "pinyin": "Wǒ méiyǒu érzi.",
        "ko": "저는 아들이 없어요."
      },
      {
        "zh": "今天我没有钱。",
        "pinyin": "Jīntiān wǒ méiyǒu qián.",
        "ko": "오늘 저는 돈이 없어요."
      }
    ],
    "2": [
      {
        "zh": "你有没有钱？",
        "pinyin": "Nǐ yǒu méiyǒu qián?",
        "ko": "돈 있어요 없어요?"
      },
      {
        "zh": "他有没有姐姐？",
        "pinyin": "Tā yǒu méiyǒu jiějie?",
        "ko": "그는 누나(언니)가 있어요 없어요?"
      }
    ]
  },
  "h1-03-zhe-na": {
    "0": [
      {
        "zh": "这是我的猫。",
        "pinyin": "Zhè shì wǒ de māo.",
        "ko": "이것은 제 고양이예요."
      },
      {
        "zh": "那是医院。",
        "pinyin": "Nà shì yīyuàn.",
        "ko": "저것은 병원이에요."
      }
    ],
    "1": [
      {
        "zh": "老师在这儿。",
        "pinyin": "lǎoshī zài zhèr.",
        "ko": "선생님은 여기 계세요."
      },
      {
        "zh": "我的书在那儿。",
        "pinyin": "wǒ de shū zài nàr.",
        "ko": "제 책은 저기 있어요."
      },
      {
        "zh": "妈妈不在这儿。",
        "pinyin": "māma bú zài zhèr.",
        "ko": "엄마는 여기 안 계세요.",
        "note": "在 앞에 不를 붙여 부정해요."
      }
    ]
  },
  "h1-04-measure-words": {
    "0": [
      {
        "zh": "五个苹果",
        "pinyin": "wǔ ge píngguǒ",
        "ko": "사과 다섯 개"
      },
      {
        "zh": "四本书",
        "pinyin": "sì běn shū",
        "ko": "책 네 권"
      },
      {
        "zh": "一张桌子",
        "pinyin": "yì zhāng zhuōzi",
        "ko": "탁자 하나",
        "note": "桌子는 평평한 면이라 张을 써요."
      }
    ],
    "1": [
      {
        "zh": "三个老师",
        "pinyin": "sān ge lǎoshī",
        "ko": "선생님 세 분"
      },
      {
        "zh": "那个人是谁？",
        "pinyin": "nàge rén shì shuí?",
        "ko": "저 사람은 누구예요?",
        "note": "那 + 个로 '저 ~'를 만들어요."
      },
      {
        "zh": "我有一个问题。",
        "pinyin": "wǒ yǒu yí ge wèntí.",
        "ko": "저 질문이 하나 있어요."
      }
    ],
    "2": [
      {
        "zh": "我看了一本书。",
        "pinyin": "wǒ kàn le yì běn shū.",
        "ko": "저는 책 한 권을 봤어요."
      },
      {
        "zh": "这张照片很漂亮。",
        "pinyin": "zhè zhāng zhàopiàn hěn piàoliang.",
        "ko": "이 사진 아주 예뻐요.",
        "note": "照片(사진)은 평평해서 张을 써요."
      }
    ]
  },
  "h1-05-ma-questions": {
    "0": [
      {
        "zh": "你是医生吗？",
        "pinyin": "nǐ shì yīshēng ma?",
        "ko": "의사세요?"
      },
      {
        "zh": "今天很热吗？",
        "pinyin": "jīntiān hěn rè ma?",
        "ko": "오늘 더워요?"
      },
      {
        "zh": "你喜欢茶吗？",
        "pinyin": "nǐ xǐhuan chá ma?",
        "ko": "차 좋아하세요?"
      }
    ],
    "1": [
      {
        "zh": "你买什么？",
        "pinyin": "nǐ mǎi shénme?",
        "ko": "뭐 사세요?"
      },
      {
        "zh": "她是谁？",
        "pinyin": "tā shì shuí?",
        "ko": "그녀는 누구예요?"
      },
      {
        "zh": "你住在哪儿？",
        "pinyin": "nǐ zhù zài nǎr?",
        "ko": "어디 사세요?"
      }
    ],
    "2": [
      {
        "zh": "今天是什么天气？",
        "pinyin": "jīntiān shì shénme tiānqì?",
        "ko": "오늘 날씨가 어때요?"
      },
      {
        "zh": "你看什么书？",
        "pinyin": "nǐ kàn shénme shū?",
        "ko": "무슨 책 봐요?"
      }
    ]
  },
  "h1-06-negation": {
    "0": [
      {
        "zh": "我不喜欢狗。",
        "pinyin": "wǒ bù xǐhuan gǒu.",
        "ko": "저는 개를 안 좋아해요."
      },
      {
        "zh": "他不是老师。",
        "pinyin": "tā bú shì lǎoshī.",
        "ko": "그는 선생님이 아니에요.",
        "note": "是 앞에서 不는 bú로 변조돼요."
      },
      {
        "zh": "今天不冷。",
        "pinyin": "jīntiān bù lěng.",
        "ko": "오늘은 안 추워요."
      }
    ],
    "1": [
      {
        "zh": "我没看那本书。",
        "pinyin": "wǒ méi kàn nà běn shū.",
        "ko": "저는 그 책을 안 봤어요."
      },
      {
        "zh": "他没吃饭。",
        "pinyin": "tā méi chī fàn.",
        "ko": "그는 밥을 안 먹었어요."
      },
      {
        "zh": "我们没买东西。",
        "pinyin": "wǒmen méi mǎi dōngxi.",
        "ko": "우리는 물건을 안 샀어요."
      }
    ],
    "2": [
      {
        "zh": "我不去。",
        "pinyin": "wǒ bú qù.",
        "ko": "저 안 가요.",
        "note": "不는 미래·의지의 부정이에요."
      },
      {
        "zh": "我没去。",
        "pinyin": "wǒ méi qù.",
        "ko": "저 안 갔어요.",
        "note": "没는 과거의 부정이에요."
      }
    ]
  },
  "h1-07-de-possessive": {
    "0": [
      {
        "zh": "这是我的手机。",
        "pinyin": "zhè shì wǒ de shǒujī.",
        "ko": "이건 제 휴대폰이에요."
      },
      {
        "zh": "那是同学的椅子。",
        "pinyin": "nà shì tóngxué de yǐzi.",
        "ko": "저건 반 친구 의자예요."
      },
      {
        "zh": "这是他的杯子。",
        "pinyin": "zhè shì tā de bēizi.",
        "ko": "이건 그의 컵이에요."
      }
    ],
    "1": [
      {
        "zh": "好吃的菜",
        "pinyin": "hǎochī de cài",
        "ko": "맛있는 요리"
      },
      {
        "zh": "我买的水果",
        "pinyin": "wǒ mǎi de shuǐguǒ",
        "ko": "제가 산 과일"
      },
      {
        "zh": "很大的房子",
        "pinyin": "hěn dà de fángzi",
        "ko": "아주 큰 집"
      }
    ],
    "2": [
      {
        "zh": "我爸爸",
        "pinyin": "wǒ bàba",
        "ko": "우리 아빠"
      },
      {
        "zh": "你们老师",
        "pinyin": "nǐmen lǎoshī",
        "ko": "너희 선생님"
      }
    ]
  },
  "h1-08-serial-verbs": {
    "0": [
      {
        "zh": "我去买东西。",
        "pinyin": "wǒ qù mǎi dōngxi.",
        "ko": "저는 가서 물건을 사요."
      },
      {
        "zh": "他来学习汉语。",
        "pinyin": "tā lái xuéxí Hànyǔ.",
        "ko": "그는 중국어를 배우러 와요."
      },
      {
        "zh": "我们去看电影。",
        "pinyin": "wǒmen qù kàn diànyǐng.",
        "ko": "우리는 영화 보러 가요."
      }
    ],
    "1": [
      {
        "zh": "我坐出租车去医院。",
        "pinyin": "wǒ zuò chūzūchē qù yīyuàn.",
        "ko": "저는 택시를 타고 병원에 가요."
      },
      {
        "zh": "他坐车去学校。",
        "pinyin": "tā zuò chē qù xuéxiào.",
        "ko": "그는 차를 타고 학교에 가요."
      }
    ]
  },
  "h1-09-time-place": {
    "0": [
      {
        "zh": "我今天工作。",
        "pinyin": "wǒ jīntiān gōngzuò.",
        "ko": "저는 오늘 일해요."
      },
      {
        "zh": "明天他不来。",
        "pinyin": "míngtiān tā bù lái.",
        "ko": "내일 그는 안 와요."
      },
      {
        "zh": "我们明天看电影。",
        "pinyin": "wǒmen míngtiān kàn diànyǐng.",
        "ko": "우리 내일 영화 봐요."
      }
    ],
    "1": [
      {
        "zh": "我在饭店吃饭。",
        "pinyin": "wǒ zài fàndiàn chī fàn.",
        "ko": "저는 식당에서 밥을 먹어요."
      },
      {
        "zh": "她在家看书。",
        "pinyin": "tā zài jiā kàn shū.",
        "ko": "그녀는 집에서 책을 봐요."
      },
      {
        "zh": "他们在商店买东西。",
        "pinyin": "tāmen zài shāngdiàn mǎi dōngxi.",
        "ko": "그들은 상점에서 물건을 사요."
      }
    ],
    "2": [
      {
        "zh": "爸爸在医院。",
        "pinyin": "bàba zài yīyuàn.",
        "ko": "아빠는 병원에 계세요."
      },
      {
        "zh": "我的钱在桌子上。",
        "pinyin": "wǒ de qián zài zhuōzi shang.",
        "ko": "제 돈은 탁자 위에 있어요."
      }
    ]
  },
  "h1-10-numbers": {
    "0": [
      {
        "zh": "四十八",
        "pinyin": "sìshíbā",
        "ko": "48 (사십팔)"
      },
      {
        "zh": "九十九",
        "pinyin": "jiǔshíjiǔ",
        "ko": "99 (구십구)"
      },
      {
        "zh": "六十",
        "pinyin": "liùshí",
        "ko": "60 (육십)"
      }
    ],
    "1": [
      {
        "zh": "两本书",
        "pinyin": "liǎng běn shū",
        "ko": "책 두 권",
        "note": "양사 本 앞이라 两을 써요."
      },
      {
        "zh": "第二",
        "pinyin": "dì èr",
        "ko": "두 번째 (순서)",
        "note": "순서를 셀 때는 二를 써요."
      }
    ],
    "2": [
      {
        "zh": "你儿子几岁？",
        "pinyin": "nǐ érzi jǐ suì?",
        "ko": "아드님은 몇 살이에요?"
      },
      {
        "zh": "她今年五岁。",
        "pinyin": "tā jīnnián wǔ suì.",
        "ko": "그 아이는 올해 다섯 살이에요."
      },
      {
        "zh": "现在几点？",
        "pinyin": "xiànzài jǐ diǎn?",
        "ko": "지금 몇 시예요?"
      }
    ]
  },
  "h1-11-adverbs-dou-ye": {
    "0": [
      {
        "zh": "我们都喜欢中国菜。",
        "pinyin": "wǒmen dōu xǐhuan Zhōngguó cài.",
        "ko": "우리는 모두 중국 음식을 좋아해요."
      },
      {
        "zh": "他们都会说汉语。",
        "pinyin": "tāmen dōu huì shuō Hànyǔ.",
        "ko": "그들은 다 중국어를 할 줄 알아요."
      },
      {
        "zh": "我们都不忙。",
        "pinyin": "wǒmen dōu bù máng.",
        "ko": "우리는 다 안 바빠요.",
        "note": "都不는 '모두 ~하지 않다'예요."
      }
    ],
    "1": [
      {
        "zh": "我也想去。",
        "pinyin": "wǒ yě xiǎng qù.",
        "ko": "저도 가고 싶어요.",
        "note": "也는 동사·조동사 想 앞에 와요."
      },
      {
        "zh": "她也很忙。",
        "pinyin": "tā yě hěn máng.",
        "ko": "그녀도 바빠요.",
        "note": "형용사 앞에서도 也를 써요."
      },
      {
        "zh": "我们也是朋友。",
        "pinyin": "wǒmen yě shì péngyou.",
        "ko": "우리도 친구예요."
      }
    ],
    "2": [
      {
        "zh": "这本书真贵。",
        "pinyin": "zhè běn shū zhēn guì.",
        "ko": "이 책 정말 비싸요."
      },
      {
        "zh": "你的女儿真漂亮。",
        "pinyin": "nǐ de nǚ'ér zhēn piàoliang.",
        "ko": "당신 딸 정말 예뻐요.",
        "note": "女儿는 nǚ'ér, 모음 경계에 아포스트로피를 써요."
      }
    ],
    "3": [
      {
        "zh": "我们一起回家吧。",
        "pinyin": "wǒmen yìqǐ huí jiā ba.",
        "ko": "우리 같이 집에 가요."
      },
      {
        "zh": "你和我一起看电影。",
        "pinyin": "nǐ hé wǒ yìqǐ kàn diànyǐng.",
        "ko": "당신과 저 같이 영화 봐요.",
        "note": "一起는 동사 看 앞에 와요."
      }
    ]
  },
  "h1-12-modal-wishes": {
    "0": [
      {
        "zh": "我喜欢小狗。",
        "pinyin": "wǒ xǐhuan xiǎogǒu.",
        "ko": "저는 강아지를 좋아해요.",
        "note": "喜欢 뒤에 명사가 바로 와요."
      },
      {
        "zh": "她喜欢学习汉语。",
        "pinyin": "tā xǐhuan xuéxí Hànyǔ.",
        "ko": "그녀는 중국어 배우는 걸 좋아해요.",
        "note": "喜欢 뒤에 동사구가 와요."
      }
    ],
    "1": [
      {
        "zh": "我想喝水。",
        "pinyin": "wǒ xiǎng hē shuǐ.",
        "ko": "저는 물이 마시고 싶어요."
      },
      {
        "zh": "他想买一个手机。",
        "pinyin": "tā xiǎng mǎi yí ge shǒujī.",
        "ko": "그는 휴대폰을 하나 사고 싶어 해요.",
        "note": "想은 동사 买 앞에서 소망을 나타내요."
      }
    ],
    "2": [
      {
        "zh": "请进。",
        "pinyin": "qǐng jìn.",
        "ko": "들어오세요."
      },
      {
        "zh": "请看这里。",
        "pinyin": "qǐng kàn zhèlǐ.",
        "ko": "여기를 봐 주세요.",
        "note": "请 + 동사로 정중히 부탁해요."
      }
    ],
    "3": [
      {
        "zh": "今天不用上班。",
        "pinyin": "jīntiān búyòng shàngbān.",
        "ko": "오늘은 출근할 필요 없어요.",
        "note": "不用은 4성 앞에서 bú로 변조해요."
      },
      {
        "zh": "你不用买票。",
        "pinyin": "nǐ búyòng mǎi piào.",
        "ko": "당신은 표를 살 필요 없어요."
      }
    ]
  },
  "h1-13-greetings": {
    "0": [
      {
        "zh": "谢谢你的茶。",
        "pinyin": "xièxie nǐ de chá.",
        "ko": "차 고마워요."
      },
      {
        "zh": "不客气，再见。",
        "pinyin": "búkèqi, zàijiàn.",
        "ko": "천만에요, 안녕히 가세요."
      }
    ],
    "1": [
      {
        "zh": "对不起，我不知道。",
        "pinyin": "duìbuqǐ, wǒ bù zhīdào.",
        "ko": "미안해요, 저는 몰라요."
      },
      {
        "zh": "没关系，没问题。",
        "pinyin": "méi guānxi, méi wèntí.",
        "ko": "괜찮아요, 문제없어요."
      }
    ],
    "2": [
      {
        "zh": "请问，火车站在哪儿？",
        "pinyin": "qǐngwèn, huǒchēzhàn zài nǎr?",
        "ko": "실례지만, 기차역이 어디예요?"
      },
      {
        "zh": "请问，你叫什么名字？",
        "pinyin": "qǐngwèn, nǐ jiào shénme míngzi?",
        "ko": "실례지만, 이름이 뭐예요?"
      }
    ],
    "3": [
      {
        "zh": "认识你很高兴，我叫小明。",
        "pinyin": "rènshi nǐ hěn gāoxìng, wǒ jiào Xiǎomíng.",
        "ko": "만나서 반가워요, 저는 샤오밍이에요.",
        "note": "小明은 사람 이름, 고유명사라 대문자로 시작해요."
      },
      {
        "zh": "老师，认识你很高兴。",
        "pinyin": "lǎoshī, rènshi nǐ hěn gāoxìng.",
        "ko": "선생님, 만나서 반가워요."
      }
    ]
  }
};

export default examples;
