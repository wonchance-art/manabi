/**
 * H4 추가 예문 — 섹션별 보강(slug → 섹션index → 예문).
 * index.js가 본편 챕터 섹션에 병합. 본문/원본 예문은 불변.
 */
const examples = {
  "h4-01-complement-review": {
    "0": [
      {
        "zh": "你说的话我都听明白了。",
        "pinyin": "nǐ shuō de huà wǒ dōu tīng míngbai le.",
        "ko": "당신이 한 말을 저는 다 알아들었어요.",
        "note": "明白가 결과보어로 '동작의 결과'를 보충해요."
      },
      {
        "zh": "她高兴得跳了起来。",
        "pinyin": "tā gāoxìng de tiào le qǐlái.",
        "ko": "그녀는 기뻐서 뛰어올랐어요.",
        "note": "起来는 방향보어, 得 뒤는 정도를 보충해요."
      },
      {
        "zh": "这个箱子太重，我搬不动。",
        "pinyin": "zhège xiāngzi tài zhòng, wǒ bān bu dòng.",
        "ko": "이 상자는 너무 무거워서 옮길 수 없어요.",
        "note": "搬不动은 가능보어의 부정형이에요."
      }
    ],
    "1": [
      {
        "zh": "老师说得太快，我听不懂。",
        "pinyin": "lǎoshī shuō de tài kuài, wǒ tīng bu dǒng.",
        "ko": "선생님이 너무 빨리 말해서 못 알아들어요.",
        "note": "앞은 정도보어, 뒤 听不懂은 가능보어예요."
      },
      {
        "zh": "他跑得很快，我跑不过他。",
        "pinyin": "tā pǎo de hěn kuài, wǒ pǎo bu guò tā.",
        "ko": "그는 빨리 달려서 저는 그를 못 이겨요.",
        "note": "得很快는 정도, 跑不过는 가능보어예요."
      },
      {
        "zh": "这些菜太多了，我们吃不完。",
        "pinyin": "zhèxiē cài tài duō le, wǒmen chī bu wán.",
        "ko": "이 음식들은 너무 많아서 다 못 먹어요.",
        "note": "吃不完은 '다 먹을 수 없다'는 가능보어예요."
      }
    ]
  },
  "h4-02-hypothesis": {
    "0": [
      {
        "zh": "即使再难，我也要试一试。",
        "pinyin": "jíshǐ zài nán, wǒ yě yào shì yi shì.",
        "ko": "설령 더 어려워도 저는 한번 해 볼 거예요."
      },
      {
        "zh": "即使没有人帮忙，他也能做完。",
        "pinyin": "jíshǐ méiyǒu rén bāngmáng, tā yě néng zuò wán.",
        "ko": "설령 아무도 안 도와줘도 그는 다 끝낼 수 있어요."
      },
      {
        "zh": "即使生病了，她也坚持上课。",
        "pinyin": "jíshǐ shēngbìng le, tā yě jiānchí shàngkè.",
        "ko": "설령 아파도 그녀는 꿋꿋이 수업에 가요."
      }
    ],
    "1": [
      {
        "zh": "要是明天天气好，我们就去爬山。",
        "pinyin": "yàoshi míngtiān tiānqì hǎo, wǒmen jiù qù páshān.",
        "ko": "만약 내일 날씨가 좋으면 우리는 등산하러 가요."
      },
      {
        "zh": "孩子一回家就打开电视。",
        "pinyin": "háizi yì huí jiā jiù dǎkāi diànshì.",
        "ko": "아이는 집에 오자마자 텔레비전을 켜요."
      },
      {
        "zh": "要是有问题，你就给我打电话。",
        "pinyin": "yàoshi yǒu wèntí, nǐ jiù gěi wǒ dǎ diànhuà.",
        "ko": "만약 문제가 있으면 저에게 전화하세요."
      }
    ]
  },
  "h4-03-shi-de": {
    "0": [
      {
        "zh": "我是坐飞机来的。",
        "pinyin": "wǒ shì zuò fēijī lái de.",
        "ko": "저는 비행기를 타고 왔어요.",
        "note": "교통수단(방법)을 是…的로 강조해요."
      },
      {
        "zh": "这个蛋糕是我自己做的。",
        "pinyin": "zhège dàngāo shì wǒ zìjǐ zuò de.",
        "ko": "이 케이크는 제가 직접 만든 거예요.",
        "note": "행위의 주체를 是…的로 강조해요."
      },
      {
        "zh": "他是在大学认识她的。",
        "pinyin": "tā shì zài dàxué rènshi tā de.",
        "ko": "그는 대학교에서 그녀를 알게 됐어요.",
        "note": "장소를 是…的로 강조해요."
      }
    ],
    "1": [
      {
        "zh": "我是从首尔来的。",
        "pinyin": "wǒ shì cóng Shǒu'ěr lái de.",
        "ko": "저는 서울에서 왔어요.",
        "note": "이미 일어난 일의 출발지를 강조해요."
      },
      {
        "zh": "这双鞋是打折的时候买的。",
        "pinyin": "zhè shuāng xié shì dǎzhé de shíhou mǎi de.",
        "ko": "이 신발은 세일할 때 산 거예요.",
        "note": "산 '시점'을 是…的로 강조해요."
      },
      {
        "zh": "我们是去年结婚的。",
        "pinyin": "wǒmen shì qùnián jiéhūn de.",
        "ko": "우리는 작년에 결혼했어요.",
        "note": "了가 아니라 是…的로 시간을 강조해요."
      }
    ]
  },
  "h4-04-lian-dou": {
    "0": [
      {
        "zh": "他连水都没喝就走了。",
        "pinyin": "tā lián shuǐ dōu méi hē jiù zǒu le.",
        "ko": "그는 물조차 안 마시고 가 버렸어요."
      },
      {
        "zh": "这么晚了，连商店也关门了。",
        "pinyin": "zhème wǎn le, lián shāngdiàn yě guānmén le.",
        "ko": "이렇게 늦어서 상점조차 문을 닫았어요."
      },
      {
        "zh": "我累得连话都说不出来。",
        "pinyin": "wǒ lèi de lián huà dōu shuō bu chūlái.",
        "ko": "저는 말조차 못 할 만큼 지쳤어요."
      }
    ],
    "1": [
      {
        "zh": "他连早饭都没吃就去上班了。",
        "pinyin": "tā lián zǎofàn dōu méi chī jiù qù shàngbān le.",
        "ko": "그는 아침밥조차 안 먹고 출근했어요.",
        "note": "목적어 早饭을 连으로 앞에 끌어왔어요."
      },
      {
        "zh": "这个字我连听都没听过。",
        "pinyin": "zhège zì wǒ lián tīng dōu méi tīng guò.",
        "ko": "이 글자는 저는 들어 본 적조차 없어요.",
        "note": "동사 听을 连…都로 강조해요."
      },
      {
        "zh": "她连自己的生日都忘了。",
        "pinyin": "tā lián zìjǐ de shēngrì dōu wàng le.",
        "ko": "그녀는 자기 생일조차 잊어버렸어요.",
        "note": "목적어 生日을 동사 앞으로 끌어왔어요."
      }
    ]
  },
  "h4-05-chule": {
    "0": [
      {
        "zh": "除了小王以外，大家都同意了。",
        "pinyin": "chúle Xiǎo Wáng yǐwài, dàjiā dōu tóngyì le.",
        "ko": "샤오왕을 빼고 모두 동의했어요.",
        "note": "都가 와서 '제외'의 뜻이에요."
      },
      {
        "zh": "除了咖啡以外，他还喜欢喝茶。",
        "pinyin": "chúle kāfēi yǐwài, tā hái xǐhuan hē chá.",
        "ko": "커피 말고도 그는 차 마시는 것도 좋아해요.",
        "note": "还가 와서 '추가'의 뜻이에요."
      },
      {
        "zh": "除了数学以外，别的课我都喜欢。",
        "pinyin": "chúle shùxué yǐwài, biéde kè wǒ dōu xǐhuan.",
        "ko": "수학 빼고 다른 수업은 다 좋아해요.",
        "note": "都가 와서 '제외'의 뜻이에요."
      }
    ],
    "1": [
      {
        "zh": "除了你，我谁都不相信。",
        "pinyin": "chúle nǐ, wǒ shéi dōu bù xiāngxìn.",
        "ko": "당신 말고는 저는 아무도 안 믿어요.",
        "note": "以外를 생략하고 都로 '제외'를 나타내요."
      },
      {
        "zh": "除了汉语，她还在学法语。",
        "pinyin": "chúle Hànyǔ, tā hái zài xué Fǎyǔ.",
        "ko": "중국어 말고도 그녀는 프랑스어도 배우고 있어요.",
        "note": "以外 없이 还로 '추가'를 나타내요."
      },
      {
        "zh": "除了睡觉，他一天都在玩游戏。",
        "pinyin": "chúle shuìjiào, tā yì tiān dōu zài wán yóuxì.",
        "ko": "잠자는 것 빼고 그는 하루 종일 게임만 해요.",
        "note": "以外 생략, 都로 '제외'를 나타내요."
      }
    ]
  },
  "h4-06-yue-yue": {
    "0": [
      {
        "zh": "雨越来越大了。",
        "pinyin": "yǔ yuèláiyuè dà le.",
        "ko": "비가 점점 거세져요."
      },
      {
        "zh": "他的身体越来越好了。",
        "pinyin": "tā de shēntǐ yuèláiyuè hǎo le.",
        "ko": "그의 건강이 점점 좋아져요."
      },
      {
        "zh": "天黑了，路上的人越来越少。",
        "pinyin": "tiān hēi le, lùshang de rén yuèláiyuè shǎo.",
        "ko": "날이 어두워져서 길에 사람이 점점 줄어요."
      }
    ],
    "1": [
      {
        "zh": "这首歌我越听越喜欢。",
        "pinyin": "zhè shǒu gē wǒ yuè tīng yuè xǐhuan.",
        "ko": "이 노래는 들을수록 좋아져요."
      },
      {
        "zh": "他越忙越容易出错。",
        "pinyin": "tā yuè máng yuè róngyì chūcuò.",
        "ko": "그는 바쁠수록 실수하기 쉬워요."
      },
      {
        "zh": "天气越热,我越不想出门。",
        "pinyin": "tiānqì yuè rè, wǒ yuè bù xiǎng chūmén.",
        "ko": "날씨가 더울수록 저는 더 나가기 싫어요."
      }
    ]
  },
  "h4-07-rhetorical": {
    "0": [
      {
        "zh": "你不是已经吃过了吗？",
        "pinyin": "nǐ bú shì yǐjīng chī guò le ma?",
        "ko": "너 이미 먹었잖아?"
      },
      {
        "zh": "这件事你不是早就知道了吗？",
        "pinyin": "zhè jiàn shì nǐ bú shì zǎo jiù zhīdào le ma?",
        "ko": "이 일 너 진작에 알고 있었잖아?"
      },
      {
        "zh": "他不是你的同学吗？",
        "pinyin": "tā bú shì nǐ de tóngxué ma?",
        "ko": "그 사람 네 반 친구잖아?"
      }
    ],
    "1": [
      {
        "zh": "难道你忘了今天是他的生日吗？",
        "pinyin": "nándào nǐ wàng le jīntiān shì tā de shēngrì ma?",
        "ko": "설마 오늘이 그의 생일인 걸 잊은 거예요?",
        "note": "难道…吗?로 '잊었을 리 없다'는 강한 반문"
      },
      {
        "zh": "这件事我哪儿做得了？",
        "pinyin": "zhè jiàn shì wǒ nǎr zuò de liǎo?",
        "ko": "이 일을 내가 어떻게 해낼 수 있겠어요?",
        "note": "哪儿…得了?는 '도저히 못 한다'는 부정"
      },
      {
        "zh": "这么简单的题，他怎么会做错呢？",
        "pinyin": "zhème jiǎndān de tí, tā zěnme huì zuò cuò ne?",
        "ko": "이렇게 쉬운 문제를 그가 어떻게 틀리겠어요?"
      }
    ]
  },
  "h4-08-prepositional-frames": {
    "0": [
      {
        "zh": "对孩子来说，玩游戏比学习有意思。",
        "pinyin": "duì háizi lái shuō, wán yóuxì bǐ xuéxí yǒu yìsi.",
        "ko": "아이들에게는 게임하는 게 공부보다 재미있어요."
      },
      {
        "zh": "对我们来说，这次机会非常难得。",
        "pinyin": "duì wǒmen lái shuō, zhè cì jīhuì fēicháng nándé.",
        "ko": "우리에게 이번 기회는 정말 얻기 힘든 거예요."
      }
    ],
    "1": [
      {
        "zh": "关于这次旅行的计划，你有什么想法？",
        "pinyin": "guānyú zhè cì lǚxíng de jìhuà, nǐ yǒu shénme xiǎngfǎ?",
        "ko": "이번 여행 계획에 관해서 어떤 생각이 있어요?"
      },
      {
        "zh": "由于工作太忙，他没能来参加聚会。",
        "pinyin": "yóuyú gōngzuò tài máng, tā méi néng lái cānjiā jùhuì.",
        "ko": "일이 너무 바빠서 그는 모임에 오지 못했어요.",
        "note": "由于는 격식 있는 원인 도입"
      }
    ]
  },
  "h4-09-budan-erqie": {
    "0": [
      {
        "zh": "这家饭馆不但环境好，而且服务也很周到。",
        "pinyin": "zhè jiā fànguǎn bùdàn huánjìng hǎo, érqiě fúwù yě hěn zhōudào.",
        "ko": "이 식당은 분위기가 좋을 뿐 아니라 게다가 서비스도 세심해요."
      },
      {
        "zh": "他不但成绩好，而且特别爱帮助别人。",
        "pinyin": "tā bùdàn chéngjì hǎo, érqiě tèbié ài bāngzhù biérén.",
        "ko": "그는 성적이 좋을 뿐 아니라 게다가 남 돕는 걸 무척 좋아해요."
      }
    ],
    "1": [
      {
        "zh": "不但我喜欢这首歌，而且我的同学们也都喜欢。",
        "pinyin": "bùdàn wǒ xǐhuan zhè shǒu gē, érqiě wǒ de tóngxuémen yě dōu xǐhuan.",
        "ko": "저뿐만 아니라 제 반 친구들도 다 이 노래를 좋아해요.",
        "note": "주어가 다르면 不但을 주어 앞에 둠"
      },
      {
        "zh": "这次活动不但学生参加了，而且老师也来了。",
        "pinyin": "zhè cì huódòng bùdàn xuésheng cānjiā le, érqiě lǎoshī yě lái le.",
        "ko": "이번 행사에는 학생들뿐 아니라 선생님들도 오셨어요."
      }
    ]
  },
  "h4-10-discourse-adverbs": {
    "0": [
      {
        "zh": "你别担心，其实事情没那么复杂。",
        "pinyin": "nǐ bié dānxīn, qíshí shìqing méi nàme fùzá.",
        "ko": "걱정 마세요, 사실 일이 그렇게 복잡하지 않아요."
      },
      {
        "zh": "大家都以为他是老板，其实他只是个职员。",
        "pinyin": "dàjiā dōu yǐwéi tā shì lǎobǎn, qíshí tā zhǐ shì gè zhíyuán.",
        "ko": "다들 그가 사장인 줄 알지만, 사실 그는 그냥 직원이에요."
      }
    ],
    "1": [
      {
        "zh": "这件衣服挺好看的，不过有点儿大。",
        "pinyin": "zhè jiàn yīfu tǐng hǎokàn de, bùguò yǒudiǎnr dà.",
        "ko": "이 옷 꽤 예뻐요, 다만 좀 크네요."
      },
      {
        "zh": "我同意你的看法，不过还有一点想补充。",
        "pinyin": "wǒ tóngyì nǐ de kànfǎ, bùguò hái yǒu yì diǎn xiǎng bǔchōng.",
        "ko": "당신 생각에 동의해요, 다만 한 가지 덧붙이고 싶은 게 있어요."
      }
    ],
    "2": [
      {
        "zh": "别人都觉得难，这件事我倒觉得挺容易。",
        "pinyin": "biérén dōu juéde nán, zhè jiàn shì wǒ dào juéde tǐng róngyì.",
        "ko": "다들 어렵다고 하는데, 이 일은 오히려 저는 꽤 쉽게 느껴져요."
      },
      {
        "zh": "天气预报说有雨，今天倒挺晴的。",
        "pinyin": "tiānqì yùbào shuō yǒu yǔ, jīntiān dào tǐng qíng de.",
        "ko": "일기예보는 비가 온다고 했는데, 오늘은 의외로 꽤 맑네요."
      }
    ]
  }
};

export default examples;
