/**
 * H2 추가 예문 — 섹션별 보강(slug → 섹션index → 예문).
 * index.js가 본편 챕터 섹션에 병합. 본문/원본 예문은 불변.
 */
const examples = {
  "h2-01-le-completion": {
    "0": [
      {
        "zh": "我喝了一杯咖啡。",
        "pinyin": "wǒ hē le yì bēi kāfēi.",
        "ko": "저는 커피 한 잔을 마셨어요."
      },
      {
        "zh": "他昨天回家了。",
        "pinyin": "tā zuótiān huí jiā le.",
        "ko": "그는 어제 집에 갔어요."
      }
    ],
    "1": [
      {
        "zh": "我今天没喝咖啡。",
        "pinyin": "wǒ jīntiān méi hē kāfēi.",
        "ko": "저 오늘 커피 안 마셨어요.",
        "note": "没로 부정할 땐 了를 떼요."
      },
      {
        "zh": "她还没回来。",
        "pinyin": "tā hái méi huílai.",
        "ko": "그녀는 아직 안 돌아왔어요."
      }
    ],
    "2": [
      {
        "zh": "你做完作业了吗？",
        "pinyin": "nǐ zuòwán zuòyè le ma?",
        "ko": "숙제 다 했어요?"
      },
      {
        "zh": "他到了没有？",
        "pinyin": "tā dào le méiyǒu?",
        "ko": "그 도착했어요 안 했어요?",
        "note": "동사+了没有로 완료 여부를 물어요."
      }
    ]
  },
  "h2-02-guo-experience": {
    "0": [
      {
        "zh": "我吃过北京烤鸭。",
        "pinyin": "wǒ chī guo Běijīng kǎoyā.",
        "ko": "저는 베이징 오리구이를 먹어 본 적 있어요.",
        "note": "北京은 지명, 고유명사예요."
      },
      {
        "zh": "他坐过飞机吗？",
        "pinyin": "tā zuò guo fēijī ma?",
        "ko": "그는 비행기를 타 본 적 있어요?"
      }
    ],
    "1": [
      {
        "zh": "我看了那本书。",
        "pinyin": "wǒ kàn le nà běn shū.",
        "ko": "저는 그 책을 봤어요.",
        "note": "了는 그 일을 완료했다는 뜻이에요."
      },
      {
        "zh": "我看过那本书。",
        "pinyin": "wǒ kàn guo nà běn shū.",
        "ko": "저는 그 책을 본 적이 있어요.",
        "note": "过는 그 경험이 있다는 뜻이에요."
      }
    ],
    "2": [
      {
        "zh": "我没坐过船。",
        "pinyin": "wǒ méi zuò guo chuán.",
        "ko": "저는 배를 타 본 적 없어요.",
        "note": "没…过로 경험을 부정해요."
      },
      {
        "zh": "她没喝过中国茶。",
        "pinyin": "tā méi hē guo Zhōngguó chá.",
        "ko": "그녀는 중국차를 마셔 본 적 없어요."
      }
    ]
  },
  "h2-03-zai-progressive": {
    "0": [
      {
        "zh": "妈妈在做饭。",
        "pinyin": "māma zài zuò fàn.",
        "ko": "엄마는 밥을 짓는 중이에요."
      },
      {
        "zh": "孩子们在玩儿。",
        "pinyin": "háizimen zài wánr.",
        "ko": "아이들이 놀고 있어요.",
        "note": "在 + 동사로 진행을 나타내요."
      }
    ],
    "1": [
      {
        "zh": "他在打电话。",
        "pinyin": "tā zài dǎ diànhuà.",
        "ko": "그는 전화하는 중이에요.",
        "note": "在 뒤가 동사면 진행이에요."
      },
      {
        "zh": "他在公司。",
        "pinyin": "tā zài gōngsī.",
        "ko": "그는 회사에 있어요.",
        "note": "在 뒤가 장소면 '~에 있다'예요."
      }
    ]
  },
  "h2-04-le-change": {
    "0": [
      {
        "zh": "天黑了。",
        "pinyin": "tiān hēi le.",
        "ko": "날이 어두워졌어요.",
        "note": "문장 끝 了로 상황 변화를 나타내요."
      },
      {
        "zh": "他今年二十岁了。",
        "pinyin": "tā jīnnián èrshí suì le.",
        "ko": "그는 올해 스무 살이 됐어요."
      }
    ],
    "1": [
      {
        "zh": "我喝了两杯水。",
        "pinyin": "wǒ hē le liǎng bēi shuǐ.",
        "ko": "저는 물 두 잔을 마셨어요.",
        "note": "동사 뒤 了는 완료를 나타내요."
      },
      {
        "zh": "外面冷了。",
        "pinyin": "wàimian lěng le.",
        "ko": "밖이 추워졌어요.",
        "note": "문장 끝 了는 변화를 나타내요."
      }
    ]
  },
  "h2-05-comparison-bi": {
    "0": [
      {
        "zh": "这件衣服比那件便宜。",
        "pinyin": "zhè jiàn yīfu bǐ nà jiàn piányi.",
        "ko": "이 옷이 저것보다 싸요."
      },
      {
        "zh": "弟弟比哥哥高。",
        "pinyin": "dìdi bǐ gēge gāo.",
        "ko": "남동생이 형보다 키가 커요.",
        "note": "A 比 B + 형용사 어순이에요."
      }
    ],
    "1": [
      {
        "zh": "弟弟比哥哥更高。",
        "pinyin": "dìdi bǐ gēge gèng gāo.",
        "ko": "남동생이 형보다 더 커요.",
        "note": "비교문에서는 很 대신 更을 써요."
      },
      {
        "zh": "这件衣服比那件还贵。",
        "pinyin": "zhè jiàn yīfu bǐ nà jiàn hái guì.",
        "ko": "이 옷이 저 옷보다 더 비싸요."
      },
      {
        "zh": "他来得比我还早。",
        "pinyin": "tā lái de bǐ wǒ hái zǎo.",
        "ko": "그는 저보다 더 일찍 왔어요."
      }
    ],
    "2": [
      {
        "zh": "我没有他忙。",
        "pinyin": "wǒ méiyǒu tā máng.",
        "ko": "저는 그만큼 바쁘지 않아요."
      },
      {
        "zh": "这个房间没有那个房间大。",
        "pinyin": "zhège fángjiān méiyǒu nàge fángjiān dà.",
        "ko": "이 방은 저 방만큼 크지 않아요."
      }
    ]
  },
  "h2-06-modal-verbs": {
    "0": [
      {
        "zh": "我妹妹会跳舞。",
        "pinyin": "wǒ mèimei huì tiàowǔ.",
        "ko": "제 여동생은 춤을 출 줄 알아요."
      },
      {
        "zh": "你会开车吗？",
        "pinyin": "nǐ huì kāichē ma?",
        "ko": "운전할 줄 아세요?"
      }
    ],
    "1": [
      {
        "zh": "明天我不能来上课。",
        "pinyin": "míngtiān wǒ bù néng lái shàngkè.",
        "ko": "내일 저는 수업에 못 와요."
      },
      {
        "zh": "我可以坐这儿吗？",
        "pinyin": "wǒ kěyǐ zuò zhèr ma?",
        "ko": "여기 앉아도 돼요?"
      }
    ],
    "2": [
      {
        "zh": "我想买一件新衣服。",
        "pinyin": "wǒ xiǎng mǎi yí jiàn xīn yīfu.",
        "ko": "저는 새 옷을 한 벌 사고 싶어요."
      },
      {
        "zh": "明天我要早点儿起床。",
        "pinyin": "míngtiān wǒ yào zǎo diǎnr qǐchuáng.",
        "ko": "내일 저는 좀 일찍 일어나려고요."
      }
    ]
  },
  "h2-07-prepositions": {
    "0": [
      {
        "zh": "我给老师写了一封信。",
        "pinyin": "wǒ gěi lǎoshī xiě le yì fēng xìn.",
        "ko": "저는 선생님께 편지를 한 통 썼어요."
      },
      {
        "zh": "妈妈给我做了早饭。",
        "pinyin": "māma gěi wǒ zuò le zǎofàn.",
        "ko": "엄마가 저에게 아침을 만들어 줬어요."
      }
    ],
    "1": [
      {
        "zh": "大家对这个问题很感兴趣。",
        "pinyin": "dàjiā duì zhège wèntí hěn gǎn xìngqù.",
        "ko": "모두 이 문제에 관심이 많아요."
      },
      {
        "zh": "我们从这儿走吧。",
        "pinyin": "wǒmen cóng zhèr zǒu ba.",
        "ko": "우리 여기서 출발해요."
      }
    ],
    "2": [
      {
        "zh": "他给我介绍了一个朋友。",
        "pinyin": "tā gěi wǒ jièshào le yí ge péngyou.",
        "ko": "그가 저에게 친구를 한 명 소개해 줬어요.",
        "note": "개사구 给我는 동사 앞에 와요."
      },
      {
        "zh": "老师从早上工作到晚上。",
        "pinyin": "lǎoshī cóng zǎoshang gōngzuò dào wǎnshang.",
        "ko": "선생님은 아침부터 저녁까지 일해요."
      }
    ]
  },
  "h2-08-complement-duration": {
    "0": [
      {
        "zh": "我们走了半个小时。",
        "pinyin": "wǒmen zǒu le bàn ge xiǎoshí.",
        "ko": "우리는 30분 동안 걸었어요."
      },
      {
        "zh": "他跑了二十分钟。",
        "pinyin": "tā pǎo le èrshí fēnzhōng.",
        "ko": "그는 20분 동안 달렸어요."
      }
    ],
    "1": [
      {
        "zh": "我看电视看了一个小时。",
        "pinyin": "wǒ kàn diànshì kàn le yí ge xiǎoshí.",
        "ko": "저는 텔레비전을 한 시간 봤어요.",
        "note": "목적어 电视가 있어 동사 看을 반복해요."
      },
      {
        "zh": "他开车开了三个小时。",
        "pinyin": "tā kāichē kāi le sān ge xiǎoshí.",
        "ko": "그는 세 시간 동안 운전했어요."
      }
    ]
  },
  "h2-09-haishi": {
    "0": [
      {
        "zh": "你坐公共汽车还是坐出租车？",
        "pinyin": "nǐ zuò gōnggòng qìchē háishi zuò chūzūchē?",
        "ko": "버스 타고 가실래요, 택시 타고 가실래요?"
      },
      {
        "zh": "这本书是你的还是他的？",
        "pinyin": "zhè běn shū shì nǐ de háishi tā de?",
        "ko": "이 책은 당신 거예요, 아니면 그의 거예요?"
      }
    ],
    "1": [
      {
        "zh": "你想吃米饭还是面条？",
        "pinyin": "nǐ xiǎng chī mǐfàn háishi miàntiáo?",
        "ko": "밥 먹고 싶어요, 아니면 국수 먹고 싶어요?",
        "note": "묻는 '또는'은 还是를 써요."
      },
      {
        "zh": "你给我打电话或者发邮件都行。",
        "pinyin": "nǐ gěi wǒ dǎ diànhuà huòzhě fā yóujiàn dōu xíng.",
        "ko": "저한테 전화하든 메일 보내든 다 괜찮아요.",
        "note": "진술하는 '또는'은 或者를 써요."
      }
    ]
  },
  "h2-10-complement-frequency": {
    "0": [
      {
        "zh": "这个电影我看了三次。",
        "pinyin": "zhège diànyǐng wǒ kàn le sān cì.",
        "ko": "이 영화를 저는 세 번 봤어요."
      },
      {
        "zh": "今天我给他打了两次电话。",
        "pinyin": "jīntiān wǒ gěi tā dǎ le liǎng cì diànhuà.",
        "ko": "오늘 저는 그에게 전화를 두 번 했어요."
      }
    ],
    "1": [
      {
        "zh": "我帮过他一次。",
        "pinyin": "wǒ bāng guo tā yí cì.",
        "ko": "저는 그를 한 번 도운 적 있어요.",
        "note": "대명사 他는 횟수 一次 앞에 와요."
      },
      {
        "zh": "我学过一次太极拳。",
        "pinyin": "wǒ xué guo yí cì tàijíquán.",
        "ko": "저는 태극권을 한 번 배운 적 있어요.",
        "note": "명사 太极拳은 횟수 뒤에 와요."
      }
    ]
  },
  "h2-11-degree-mood-adverbs": {
    "0": [
      {
        "zh": "今天的天气真好。",
        "pinyin": "jīntiān de tiānqì zhēn hǎo.",
        "ko": "오늘 날씨 정말 좋아요."
      },
      {
        "zh": "这么简单的问题，他当然会。",
        "pinyin": "zhème jiǎndān de wèntí, tā dāngrán huì.",
        "ko": "이렇게 쉬운 문제는 그가 당연히 할 줄 알죠."
      }
    ],
    "1": [
      {
        "zh": "这个房间有点儿小。",
        "pinyin": "zhège fángjiān yǒudiǎnr xiǎo.",
        "ko": "이 방은 좀 작네요.",
        "note": "有点儿는 원치 않는 상황에 대한 불만을 담아요."
      },
      {
        "zh": "今天有点儿冷。",
        "pinyin": "jīntiān yǒudiǎnr lěng.",
        "ko": "오늘 좀 춥네요."
      }
    ],
    "2": [
      {
        "zh": "这个房间又大又干净。",
        "pinyin": "zhège fángjiān yòu dà yòu gānjìng.",
        "ko": "이 방은 크고 깨끗해요."
      },
      {
        "zh": "他写的字又快又好。",
        "pinyin": "tā xiě de zì yòu kuài yòu hǎo.",
        "ko": "그가 쓰는 글씨는 빠르고 잘 써요."
      }
    ]
  },
  "h2-12-time-expressions": {
    "0": [
      {
        "zh": "我上班的时候，孩子在学校。",
        "pinyin": "wǒ shàngbān de shíhou, háizi zài xuéxiào.",
        "ko": "제가 출근할 때 아이는 학교에 있어요."
      },
      {
        "zh": "见到他的时候，请告诉他一下。",
        "pinyin": "jiàndào tā de shíhou, qǐng gàosu tā yíxià.",
        "ko": "그를 만났을 때 그에게 좀 알려 주세요."
      }
    ],
    "1": [
      {
        "zh": "等了很久，公共汽车终于来了。",
        "pinyin": "děng le hěn jiǔ, gōnggòng qìchē zhōngyú lái le.",
        "ko": "오래 기다렸는데 버스가 드디어 왔어요."
      },
      {
        "zh": "这个问题我终于明白了。",
        "pinyin": "zhège wèntí wǒ zhōngyú míngbai le.",
        "ko": "이 문제를 저는 드디어 이해했어요."
      }
    ],
    "2": [
      {
        "zh": "外面还在下雨。",
        "pinyin": "wàimiàn hái zài xiàyǔ.",
        "ko": "밖에 아직 비가 오고 있어요."
      },
      {
        "zh": "我还没做完作业。",
        "pinyin": "wǒ hái méi zuò wán zuòyè.",
        "ko": "저 아직 숙제를 다 못 했어요."
      }
    ]
  }
};

export default examples;
