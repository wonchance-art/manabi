/**
 * H3 추가 예문 — 섹션별 보강(slug → 섹션index → 예문).
 * index.js가 본편 챕터 섹션에 병합. 본문/원본 예문은 불변.
 */
const examples = {
  "h3-01-ba": {
    "0": [
      {
        "zh": "请把窗户打开。",
        "pinyin": "qǐng bǎ chuānghu dǎkāi.",
        "ko": "창문 좀 열어 주세요.",
        "note": "특정한 목적어 窗户를 동사 앞으로 보내요."
      },
      {
        "zh": "我把这本书看完了。",
        "pinyin": "wǒ bǎ zhè běn shū kàn wán le.",
        "ko": "저는 이 책을 다 읽었어요."
      }
    ],
    "1": [
      {
        "zh": "请把这些菜放到冰箱里。",
        "pinyin": "qǐng bǎ zhèxiē cài fàngdào bīngxiāng lǐ.",
        "ko": "이 음식들을 냉장고에 넣어 주세요.",
        "note": "'어디에 두었는지'를 말할 땐 把가 거의 필수예요."
      },
      {
        "zh": "他把钱还给我了。",
        "pinyin": "tā bǎ qián huán gěi wǒ le.",
        "ko": "그가 돈을 저에게 돌려줬어요."
      }
    ],
    "2": [
      {
        "zh": "我知道这件事。",
        "pinyin": "wǒ zhīdào zhè jiàn shì.",
        "ko": "저는 이 일을 알아요.",
        "note": "知道는 처리동사가 아니라 把를 못 써요."
      },
      {
        "zh": "请把门关上。",
        "pinyin": "qǐng bǎ mén guān shàng.",
        "ko": "문을 닫아 주세요.",
        "note": "关은 처리·변화를 주므로 把가 자연스러워요."
      },
      {
        "zh": "他有两个孩子。",
        "pinyin": "tā yǒu liǎng ge háizi.",
        "ko": "그는 아이가 둘 있어요.",
        "note": "有는 존재동사라 把를 쓸 수 없어요."
      }
    ]
  },
  "h3-02-bei": {
    "0": [
      {
        "zh": "我的自行车被人借走了。",
        "pinyin": "wǒ de zìxíngchē bèi rén jiè zǒu le.",
        "ko": "제 자전거를 누가 빌려 갔어요."
      },
      {
        "zh": "那本书被妹妹拿走了。",
        "pinyin": "nà běn shū bèi mèimei ná zǒu le.",
        "ko": "그 책을 여동생이 가져갔어요."
      }
    ],
    "1": [
      {
        "zh": "我的手机被弟弟弄坏了。",
        "pinyin": "wǒ de shǒujī bèi dìdi nòng huài le.",
        "ko": "제 휴대폰을 남동생이 망가뜨렸어요.",
        "note": "고장·피해라서 被가 잘 어울려요."
      },
      {
        "zh": "他的钱被人拿走了。",
        "pinyin": "tā de qián bèi rén ná zǒu le.",
        "ko": "그의 돈을 누가 가져가 버렸어요."
      }
    ]
  },
  "h3-03-result-complement": {
    "0": [
      {
        "zh": "饭做好了，快来吃吧。",
        "pinyin": "fàn zuò hǎo le, kuài lái chī ba.",
        "ko": "밥 다 됐어요, 빨리 와서 드세요.",
        "note": "好는 '완성'을 나타내는 결과보어예요."
      },
      {
        "zh": "我找到我的手机了。",
        "pinyin": "wǒ zhǎodào wǒ de shǒujī le.",
        "ko": "제 휴대폰을 찾았어요.",
        "note": "到는 목적 달성을 나타내요."
      }
    ],
    "1": [
      {
        "zh": "我听了很久，可是没听懂。",
        "pinyin": "wǒ tīng le hěn jiǔ, kěshì méi tīng dǒng.",
        "ko": "오래 들었는데 못 알아들었어요.",
        "note": "听은 동작, 听懂은 이해라는 결과까지 이른 거예요."
      },
      {
        "zh": "我找了找，终于找到了。",
        "pinyin": "wǒ zhǎo le zhǎo, zhōngyú zhǎodào le.",
        "ko": "좀 찾아보다가 드디어 찾았어요."
      }
    ]
  },
  "h3-04-direction-complement": {
    "0": [
      {
        "zh": "外面冷，你回来吧。",
        "pinyin": "wàimiàn lěng, nǐ huílái ba.",
        "ko": "밖이 추우니까 돌아오세요.",
        "note": "화자 쪽으로 오니까 来를 써요."
      },
      {
        "zh": "妈妈下去买东西了。",
        "pinyin": "māma xiàqù mǎi dōngxi le.",
        "ko": "엄마는 물건 사러 내려가셨어요.",
        "note": "화자에게서 멀어지니까 去를 써요."
      }
    ],
    "1": [
      {
        "zh": "他从楼上走下来了。",
        "pinyin": "tā cóng lóu shàng zǒu xiàlái le.",
        "ko": "그는 위층에서 걸어 내려왔어요."
      },
      {
        "zh": "请你把椅子搬过来。",
        "pinyin": "qǐng nǐ bǎ yǐzi bān guòlái.",
        "ko": "의자를 이쪽으로 옮겨 주세요."
      }
    ],
    "2": [
      {
        "zh": "听到这个消息，我高兴起来了。",
        "pinyin": "tīngdào zhège xiāoxi, wǒ gāoxìng qǐlái le.",
        "ko": "이 소식을 듣고 기뻐지기 시작했어요.",
        "note": "起来가 '상태 시작'을 나타내요."
      },
      {
        "zh": "你别放弃，一定要坚持下去。",
        "pinyin": "nǐ bié fàngqì, yídìng yào jiānchí xiàqù.",
        "ko": "포기하지 말고 꼭 계속 버텨야 해요.",
        "note": "下去는 '계속'의 뜻이에요."
      }
    ]
  },
  "h3-05-degree-complement": {
    "0": [
      {
        "zh": "他起得很早。",
        "pinyin": "tā qǐ de hěn zǎo.",
        "ko": "그는 일찍 일어나요."
      },
      {
        "zh": "孩子们玩得很开心。",
        "pinyin": "háizimen wán de hěn kāixīn.",
        "ko": "아이들이 아주 즐겁게 놀아요."
      }
    ],
    "1": [
      {
        "zh": "我写汉字写得不太好。",
        "pinyin": "wǒ xiě hànzì xiě de bú tài hǎo.",
        "ko": "저는 한자를 그다지 잘 못 써요.",
        "note": "목적어가 있어 동사 写를 한 번 더 반복했어요."
      },
      {
        "zh": "弟弟踢足球踢得很好。",
        "pinyin": "dìdi tī zúqiú tī de hěn hǎo.",
        "ko": "남동생은 축구를 아주 잘해요."
      }
    ]
  },
  "h3-06-potential-complement": {
    "0": [
      {
        "zh": "这本书我看得懂。",
        "pinyin": "zhè běn shū wǒ kàn de dǒng.",
        "ko": "이 책은 제가 읽고 이해할 수 있어요.",
        "note": "看과 懂 사이에 得를 넣어 가능을 나타내요."
      },
      {
        "zh": "东西太多，箱子里放不下。",
        "pinyin": "dōngxi tài duō, xiāngzi lǐ fàng bú xià.",
        "ko": "물건이 너무 많아서 상자에 다 못 넣어요."
      }
    ],
    "1": [
      {
        "zh": "字太小了，我看不清楚。",
        "pinyin": "zì tài xiǎo le, wǒ kàn bù qīngchu.",
        "ko": "글자가 너무 작아서 잘 안 보여요.",
        "note": "결과(분명히 봄)에 못 이르는 점을 강조해요."
      },
      {
        "zh": "今天的菜很多，我们吃得完。",
        "pinyin": "jīntiān de cài hěn duō, wǒmen chī de wán.",
        "ko": "오늘 음식이 많지만 우리는 다 먹을 수 있어요."
      }
    ]
  },
  "h3-07-duration-complement": {
    "0": [
      {
        "zh": "昨天晚上我睡了八个小时。",
        "pinyin": "zuótiān wǎnshang wǒ shuì le bā ge xiǎoshí.",
        "ko": "어젯밤에 저는 여덟 시간 잤어요."
      },
      {
        "zh": "我们走了一个小时。",
        "pinyin": "wǒmen zǒu le yí ge xiǎoshí.",
        "ko": "우리는 한 시간 동안 걸었어요."
      }
    ],
    "1": [
      {
        "zh": "他打篮球打了两个小时。",
        "pinyin": "tā dǎ lánqiú dǎ le liǎng ge xiǎoshí.",
        "ko": "그는 농구를 두 시간 했어요.",
        "note": "목적어 篮球가 있어 동사 打를 반복했어요."
      },
      {
        "zh": "我看了一个小时的书。",
        "pinyin": "wǒ kàn le yí ge xiǎoshí de shū.",
        "ko": "저는 한 시간 동안 책을 봤어요.",
        "note": "시간을 的로 목적어의 관형어로 만들었어요."
      }
    ]
  },
  "h3-08-complex-sentence": {
    "0": [
      {
        "zh": "因为今天是周末，所以人很多。",
        "pinyin": "yīnwèi jīntiān shì zhōumò, suǒyǐ rén hěn duō.",
        "ko": "오늘은 주말이라서 사람이 많아요."
      },
      {
        "zh": "因为他生病了，所以没来上课。",
        "pinyin": "yīnwèi tā shēngbìng le, suǒyǐ méi lái shàngkè.",
        "ko": "그는 아파서 수업에 안 왔어요."
      }
    ],
    "1": [
      {
        "zh": "虽然外面下雪，但是我们还是出去玩了。",
        "pinyin": "suīrán wàimiàn xià xuě, dànshì wǒmen háishì chūqù wán le.",
        "ko": "비록 밖에 눈이 왔지만 우리는 그래도 나가서 놀았어요."
      },
      {
        "zh": "这家饭馆虽然不大，但是菜很好吃。",
        "pinyin": "zhè jiā fànguǎn suīrán bú dà, dànshì cài hěn hǎochī.",
        "ko": "이 식당은 크지 않지만 음식이 맛있어요."
      }
    ],
    "2": [
      {
        "zh": "如果你累了，就早点儿休息。",
        "pinyin": "rúguǒ nǐ lèi le, jiù zǎo diǎnr xiūxi.",
        "ko": "만약 피곤하면 좀 일찍 쉬세요.",
        "note": "如果…就 구문이에요."
      },
      {
        "zh": "她一边听音乐一边做作业。",
        "pinyin": "tā yìbiān tīng yīnyuè yìbiān zuò zuòyè.",
        "ko": "그녀는 음악을 들으면서 숙제를 해요.",
        "note": "一边…一边로 두 동작이 동시에 일어나요."
      }
    ]
  },
  "h3-09-comparison": {
    "0": [
      {
        "zh": "我哥哥比我大三岁。",
        "pinyin": "wǒ gēge bǐ wǒ dà sān suì.",
        "ko": "저희 형은 저보다 세 살 많아요.",
        "note": "차이의 구체적 수치 三岁를 형용사 뒤에 붙였어요."
      },
      {
        "zh": "这条路比那条路近一点儿。",
        "pinyin": "zhè tiáo lù bǐ nà tiáo lù jìn yìdiǎnr.",
        "ko": "이 길이 저 길보다 조금 가까워요."
      }
    ],
    "1": [
      {
        "zh": "雨越下越大了。",
        "pinyin": "yǔ yuè xià yuè dà le.",
        "ko": "비가 점점 더 많이 와요.",
        "note": "越…越…는 '~할수록 ~하다'예요."
      },
      {
        "zh": "今天没有昨天那么忙。",
        "pinyin": "jīntiān méiyǒu zuótiān nàme máng.",
        "ko": "오늘은 어제만큼 바쁘지 않아요.",
        "note": "A 没有 B 那么…는 'A가 B만큼 ~않다'예요."
      }
    ]
  },
  "h3-10-existential": {
    "0": [
      {
        "zh": "门口停着一辆车。",
        "pinyin": "ménkǒu tíng zhe yí liàng chē.",
        "ko": "입구에 차 한 대가 서 있어요.",
        "note": "장소 + 동사着 + 수량명사 어순이에요."
      },
      {
        "zh": "床上放着两个包。",
        "pinyin": "chuáng shàng fàng zhe liǎng ge bāo.",
        "ko": "침대 위에 가방 두 개가 놓여 있어요."
      }
    ],
    "1": [
      {
        "zh": "教室里走进来一位老师。",
        "pinyin": "jiàoshì lǐ zǒu jìnlái yí wèi lǎoshī.",
        "ko": "교실에 선생님 한 분이 걸어 들어왔어요.",
        "note": "출현을 나타내는 존현문이에요."
      },
      {
        "zh": "昨天我们家来了几个客人。",
        "pinyin": "zuótiān wǒmen jiā lái le jǐ ge kèrén.",
        "ko": "어제 우리 집에 손님 몇 명이 왔어요."
      }
    ]
  },
  "h3-11-degree-scope-adverbs": {
    "0": [
      {
        "zh": "这件衣服比较贵。",
        "pinyin": "zhè jiàn yīfu bǐjiào guì.",
        "ko": "이 옷은 비교적 비싼 편이에요."
      },
      {
        "zh": "他说汉语说得比较快。",
        "pinyin": "tā shuō hànyǔ shuō de bǐjiào kuài.",
        "ko": "그는 중국어를 비교적 빨리 말해요."
      }
    ],
    "1": [
      {
        "zh": "这个菜非常好吃。",
        "pinyin": "zhège cài fēicháng hǎochī.",
        "ko": "이 요리는 아주 맛있어요."
      },
      {
        "zh": "我妹妹特别喜欢小狗。",
        "pinyin": "wǒ mèimei tèbié xǐhuan xiǎogǒu.",
        "ko": "제 여동생은 강아지를 유난히 좋아해요."
      },
      {
        "zh": "昨天的考试非常难。",
        "pinyin": "zuótiān de kǎoshì fēicháng nán.",
        "ko": "어제 시험은 아주 어려웠어요."
      }
    ],
    "2": [
      {
        "zh": "我们几乎同时到了。",
        "pinyin": "wǒmen jīhū tóngshí dào le.",
        "ko": "우리는 거의 동시에 도착했어요."
      },
      {
        "zh": "这双鞋几乎和新的一样。",
        "pinyin": "zhè shuāng xié jīhū hé xīn de yíyàng.",
        "ko": "이 신발은 거의 새것과 똑같아요."
      },
      {
        "zh": "他累得几乎走不动了。",
        "pinyin": "tā lèi de jīhū zǒu bu dòng le.",
        "ko": "그는 거의 못 걸을 만큼 지쳤어요."
      }
    ],
    "3": [
      {
        "zh": "我只想休息一下。",
        "pinyin": "wǒ zhǐ xiǎng xiūxi yíxià.",
        "ko": "저는 그냥 좀 쉬고 싶어요."
      },
      {
        "zh": "冰箱里只有一瓶水了。",
        "pinyin": "bīngxiāng lǐ zhǐyǒu yì píng shuǐ le.",
        "ko": "냉장고에 물이 한 병만 남았어요."
      },
      {
        "zh": "这件事只有你知道。",
        "pinyin": "zhè jiàn shì zhǐyǒu nǐ zhīdào.",
        "ko": "이 일은 당신만 알아요."
      }
    ]
  },
  "h3-12-approximate-numbers": {
    "0": [
      {
        "zh": "他们两个人差不多高。",
        "pinyin": "tāmen liǎng ge rén chàbuduō gāo.",
        "ko": "그 두 사람은 키가 거의 비슷해요."
      },
      {
        "zh": "我差不多六点起床。",
        "pinyin": "wǒ chàbuduō liù diǎn qǐchuáng.",
        "ko": "저는 여섯 시쯤 일어나요."
      },
      {
        "zh": "这两件衣服的颜色差不多。",
        "pinyin": "zhè liǎng jiàn yīfu de yánsè chàbuduō.",
        "ko": "이 두 옷의 색깔은 거의 비슷해요."
      }
    ],
    "1": [
      {
        "zh": "这本书三十块钱左右。",
        "pinyin": "zhè běn shū sānshí kuài qián zuǒyòu.",
        "ko": "이 책은 30위안 정도예요."
      },
      {
        "zh": "晚饭七点前后开始。",
        "pinyin": "wǎnfàn qī diǎn qiánhòu kāishǐ.",
        "ko": "저녁은 일곱 시 전후로 시작해요."
      },
      {
        "zh": "教室里有二十个人左右。",
        "pinyin": "jiàoshì lǐ yǒu èrshí ge rén zuǒyòu.",
        "ko": "교실에는 스무 명 정도 있어요."
      }
    ],
    "2": [
      {
        "zh": "他在中国住了十多年。",
        "pinyin": "tā zài Zhōngguó zhù le shí duō nián.",
        "ko": "그는 중국에서 십여 년 살았어요."
      },
      {
        "zh": "桌子上有二十多本书。",
        "pinyin": "zhuōzi shàng yǒu èrshí duō běn shū.",
        "ko": "책상 위에 책이 스무 권 남짓 있어요."
      },
      {
        "zh": "我们走了三个多小时。",
        "pinyin": "wǒmen zǒu le sān ge duō xiǎoshí.",
        "ko": "우리는 세 시간 남짓 걸었어요."
      }
    ],
    "3": [
      {
        "zh": "这件衣服至少要两百块。",
        "pinyin": "zhè jiàn yīfu zhìshǎo yào liǎng bǎi kuài.",
        "ko": "이 옷은 적어도 200위안은 해요."
      },
      {
        "zh": "这个房间最多坐十个人。",
        "pinyin": "zhège fángjiān zuìduō zuò shí ge rén.",
        "ko": "이 방은 많아야 열 명 앉아요."
      },
      {
        "zh": "我们一共买了五本书。",
        "pinyin": "wǒmen yígòng mǎi le wǔ běn shū.",
        "ko": "우리는 모두 다섯 권을 샀어요."
      }
    ]
  },
  "h3-13-frequency-adverbs": {
    "0": [
      {
        "zh": "他一直没给我打电话。",
        "pinyin": "tā yìzhí méi gěi wǒ dǎ diànhuà.",
        "ko": "그는 줄곧 저에게 전화하지 않았어요."
      },
      {
        "zh": "下了一天的雨，一直没停。",
        "pinyin": "xià le yì tiān de yǔ, yìzhí méi tíng.",
        "ko": "하루 종일 비가 와서 계속 안 그쳤어요."
      },
      {
        "zh": "从早上到现在我一直在工作。",
        "pinyin": "cóng zǎoshang dào xiànzài wǒ yìzhí zài gōngzuò.",
        "ko": "아침부터 지금까지 저는 줄곧 일하고 있어요."
      }
    ],
    "1": [
      {
        "zh": "我们经常一起喝咖啡。",
        "pinyin": "wǒmen jīngcháng yìqǐ hē kāfēi.",
        "ko": "우리는 자주 같이 커피를 마셔요."
      },
      {
        "zh": "他常常忘记带手机。",
        "pinyin": "tā chángcháng wàngjì dài shǒujī.",
        "ko": "그는 자주 휴대폰 가져오는 걸 잊어요."
      },
      {
        "zh": "妈妈经常给我做我爱吃的菜。",
        "pinyin": "māma jīngcháng gěi wǒ zuò wǒ ài chī de cài.",
        "ko": "엄마는 자주 제가 좋아하는 요리를 해 주세요."
      }
    ]
  }
};

export default examples;
