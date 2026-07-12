/**
 * H5 추가 예문 — 섹션별 보강(slug → 섹션index → 예문).
 * index.js가 본편 챕터 섹션에 병합. 본문/원본 예문은 불변.
 */
const examples = {
  "h5-01-shumianyu": {
    "0": [
      {
        "zh": "本报告分析了市场现状以及未来的发展趋势。",
        "pinyin": "běn bàogào fēnxī le shìchǎng xiànzhuàng yǐjí wèilái de fāzhǎn qūshì.",
        "ko": "본 보고서는 시장 현황 및 향후 발전 추세를 분석했어요.",
        "note": "以及는 和의 글말 표현"
      },
      {
        "zh": "他做了充分的准备，然而结果并不理想。",
        "pinyin": "tā zuò le chōngfèn de zhǔnbèi, rán'ér jiéguǒ bìng bù lǐxiǎng.",
        "ko": "그는 충분히 준비했지만, 결과는 결코 이상적이지 않았어요.",
        "note": "然而는 但是의 글말형, a/e 경계라 然'而"
      }
    ],
    "1": [
      {
        "zh": "本次调查共收到了三千份问卷。",
        "pinyin": "běn cì diàochá gòng shōudào le sānqiān fèn wènjuàn.",
        "ko": "이번 조사에서는 모두 삼천 부의 설문지를 받았어요."
      },
      {
        "zh": "该地区近年来经济发展十分迅速。",
        "pinyin": "gāi dìqū jìnnián lái jīngjì fāzhǎn shífēn xùnsù.",
        "ko": "해당 지역은 최근 몇 년간 경제 발전이 매우 빨라요.",
        "note": "该는 '해당~'의 글말 지시어"
      }
    ],
    "2": [
      {
        "zh": "本研究存在一定的局限，然而仍具有参考价值。",
        "pinyin": "běn yánjiū cúnzài yídìng de júxiàn, rán'ér réng jùyǒu cānkǎo jiàzhí.",
        "ko": "본 연구는 일정한 한계가 있지만, 여전히 참고 가치가 있어요.",
        "note": "글말에서는 但是보다 然而가 자연스러움"
      },
      {
        "zh": "由于资料不足，此问题有待进一步研究。",
        "pinyin": "yóuyú zīliào bùzú, cǐ wèntí yǒudài jìnyíbù yánjiū.",
        "ko": "자료가 부족하여, 이 문제는 추가 연구가 필요해요.",
        "note": "此는 这의 글말형"
      }
    ]
  },
  "h5-02-connectors": {
    "0": [
      {
        "zh": "公司加强了管理，从而减少了不必要的浪费。",
        "pinyin": "gōngsī jiāqiáng le guǎnlǐ, cóng'ér jiǎnshǎo le bú bìyào de làngfèi.",
        "ko": "회사는 관리를 강화했고, 그리하여 불필요한 낭비를 줄였어요.",
        "note": "o/e 경계라 从'而로 표기"
      },
      {
        "zh": "他认真听取了大家的意见，从而做出了更好的决定。",
        "pinyin": "tā rènzhēn tīngqǔ le dàjiā de yìjiàn, cóng'ér zuòchū le gèng hǎo de juédìng.",
        "ko": "그는 모두의 의견을 진지하게 들었고, 그리하여 더 나은 결정을 내렸어요."
      }
    ],
    "1": [
      {
        "zh": "我们应当总结经验，进而提高工作效率。",
        "pinyin": "wǒmen yīngdāng zǒngjié jīngyàn, jìn'ér tígāo gōngzuò xiàolǜ.",
        "ko": "우리는 경험을 정리하고, 더 나아가 업무 효율을 높여야 해요.",
        "note": "o/e 경계라 进'而로 표기"
      },
      {
        "zh": "阅读能开阔视野，进而丰富我们的精神世界。",
        "pinyin": "yuèdú néng kāikuò shìyě, jìn'ér fēngfù wǒmen de jīngshén shìjiè.",
        "ko": "독서는 시야를 넓혀 주고, 나아가 우리의 정신세계를 풍부하게 해요."
      }
    ],
    "2": [
      {
        "zh": "无论遇到什么困难，总之我们都不会放弃。",
        "pinyin": "wúlùn yùdào shénme kùnnan, zǒngzhī wǒmen dōu bú huì fàngqì.",
        "ko": "어떤 어려움을 만나도, 요컨대 우리는 결코 포기하지 않을 거예요."
      },
      {
        "zh": "时间、地点、人物都安排好了，总之一切准备就绪。",
        "pinyin": "shíjiān, dìdiǎn, rénwù dōu ānpái hǎo le, zǒngzhī yíqiè zhǔnbèi jiùxù.",
        "ko": "시간, 장소, 인물 모두 정해졌어요. 한마디로 모든 준비가 끝났어요."
      }
    ]
  },
  "h5-03-chengyu": {
    "0": [
      {
        "zh": "这两个方案各有好处，真是各有千秋。",
        "pinyin": "zhè liǎng gè fāng'àn gè yǒu hǎochù, zhēn shì gè yǒu qiānqiū.",
        "ko": "이 두 방안은 각각 장점이 있어서, 정말 각기 나름의 장점이 있어요.",
        "note": "各有千秋: 저마다 장점이 있다"
      },
      {
        "zh": "他做事总是三心二意，很难成功。",
        "pinyin": "tā zuò shì zǒngshì sānxīn'èryì, hěn nán chénggōng.",
        "ko": "그는 일을 늘 딴마음 먹고 건성으로 해서, 성공하기 어려워요.",
        "note": "三心二意: 마음이 한곳에 없다, n/è 경계라 三心'二意"
      }
    ],
    "1": [
      {
        "zh": "做事要踏踏实实，不能三天打鱼，两天晒网。",
        "pinyin": "zuò shì yào tātāshíshí, bùnéng sān tiān dǎ yú, liǎng tiān shài wǎng.",
        "ko": "일은 착실하게 해야지, 작심삼일이면 안 돼요.",
        "note": "三天打鱼两天晒网: 한국 '작심삼일'에 해당"
      },
      {
        "zh": "两件事一起完成，简直是一箭双雕。",
        "pinyin": "liǎng jiàn shì yìqǐ wánchéng, jiǎnzhí shì yíjiàn shuāngdiāo.",
        "ko": "두 가지 일을 한 번에 끝내니, 그야말로 일석이조예요.",
        "note": "一箭双雕는 한국 '일석이조(一石二鸟)'와 글자가 다름"
      }
    ],
    "2": [
      {
        "zh": "听到这个好消息，大家都兴高采烈。",
        "pinyin": "tīngdào zhège hǎo xiāoxi, dàjiā dōu xìnggāo-cǎiliè.",
        "ko": "이 좋은 소식을 듣고 모두 신이 나서 들떴어요.",
        "note": "성어가 술어 자리에 들어간 예"
      },
      {
        "zh": "他认认真真地工作，从不马马虎虎。",
        "pinyin": "tā rènrèn-zhēnzhēn de gōngzuò, cóng bù mǎmǎhūhū.",
        "ko": "그는 아주 진지하게 일하고, 결코 대충 하지 않아요.",
        "note": "성어가 地 뒤 부사어로 쓰인 예"
      }
    ]
  },
  "h5-04-causative": {
    "0": [
      {
        "zh": "这次旅行的经历使我成长了很多。",
        "pinyin": "zhè cì lǚxíng de jīnglì shǐ wǒ chéngzhǎng le hěn duō.",
        "ko": "이번 여행의 경험은 저를 많이 성장하게 했어요.",
        "note": "使는 글말투 사역"
      },
      {
        "zh": "老师的一句话令我们深受鼓舞。",
        "pinyin": "lǎoshī de yí jù huà lìng wǒmen shēn shòu gǔwǔ.",
        "ko": "선생님의 한마디가 우리를 깊이 고무시켰어요."
      }
    ],
    "1": [
      {
        "zh": "他的进步令人感到欣慰。",
        "pinyin": "tā de jìnbù lìng rén gǎndào xīnwèi.",
        "ko": "그의 발전은 사람들을 흐뭇하게 해요.",
        "note": "令人 + 심리동사의 고정 결합"
      },
      {
        "zh": "这部电影的结局令人感动。",
        "pinyin": "zhè bù diànyǐng de jiéjú lìng rén gǎndòng.",
        "ko": "이 영화의 결말은 사람을 감동하게 해요."
      }
    ],
    "2": [
      {
        "zh": "经理让我把报告再检查一遍。",
        "pinyin": "jīnglǐ ràng wǒ bǎ bàogào zài jiǎnchá yí biàn.",
        "ko": "매니저가 저더러 보고서를 한 번 더 검토하라고 했어요.",
        "note": "회화체에서는 让이 자연스러움"
      },
      {
        "zh": "互联网的普及使信息传播变得更快。",
        "pinyin": "hùliánwǎng de pǔjí shǐ xìnxī chuánbō biàn de gèng kuài.",
        "ko": "인터넷의 보급은 정보 전파를 더 빠르게 만들어요.",
        "note": "격식 있는 글말에서는 使를 씀"
      }
    ]
  },
  "h5-05-passive": {
    "0": [
      {
        "zh": "他的建议被大家接受了。",
        "pinyin": "tā de jiànyì bèi dàjiā jiēshòu le.",
        "ko": "그의 제안이 모두에게 받아들여졌어요."
      },
      {
        "zh": "桌子上的蛋糕被孩子吃光了。",
        "pinyin": "zhuōzi shang de dàngāo bèi háizi chī guāng le.",
        "ko": "탁자 위의 케이크를 아이가 다 먹어 버렸어요.",
        "note": "被 + 행위자 + 동사 + 기타성분"
      }
    ],
    "1": [
      {
        "zh": "这次会议由公司总经理主持。",
        "pinyin": "zhè cì huìyì yóu gōngsī zǒngjīnglǐ zhǔchí.",
        "ko": "이번 회의는 회사 사장이 주재해요.",
        "note": "由 + 주체: 누가 하는지를 명시"
      },
      {
        "zh": "这位老师深受学生们的尊敬。",
        "pinyin": "zhè wèi lǎoshī shēn shòu xuéshengmen de zūnjìng.",
        "ko": "이 선생님은 학생들에게 깊이 존경받아요.",
        "note": "受 + 명사: 영향·대우를 받음"
      }
    ],
    "2": [
      {
        "zh": "这部电影深为观众所喜爱。",
        "pinyin": "zhè bù diànyǐng shēn wéi guānzhòng suǒ xǐ'ài.",
        "ko": "이 영화는 관객들에게 깊이 사랑받아요.",
        "note": "为 앞에 深(깊이)을 넣어 정도를 더한 격식 피동이에요."
      },
      {
        "zh": "他的观点不为同事所理解。",
        "pinyin": "tā de guāndiǎn bù wéi tóngshì suǒ lǐjiě.",
        "ko": "그의 견해는 동료들에게 이해받지 못해요.",
        "note": "부정은 为 앞에 不을 놓아요."
      },
      {
        "zh": "这首歌为年轻人所熟知。",
        "pinyin": "zhè shǒu gē wéi niánqīngrén suǒ shúzhī.",
        "ko": "이 노래는 젊은이들에게 잘 알려져 있어요."
      }
    ]
  },
  "h5-06-zhi-qi": {
    "0": [
      {
        "zh": "这是我一生之中最难忘的一天。",
        "pinyin": "zhè shì wǒ yìshēng zhī zhōng zuì nánwàng de yì tiān.",
        "ko": "이날은 제 일생에서 가장 잊지 못할 하루예요.",
        "note": "之中은 的中에 해당하는 글말 표현이에요."
      },
      {
        "zh": "学习外语，贵在坚持，难亦在此。",
        "pinyin": "xuéxí wàiyǔ, guì zài jiānchí, nán yì zài cǐ.",
        "ko": "외국어 공부는 꾸준함이 귀하고, 어려움도 여기에 있어요."
      },
      {
        "zh": "取之于民，用之于民。",
        "pinyin": "qǔ zhī yú mín, yòng zhī yú mín.",
        "ko": "백성에게서 거두어, 백성에게 써요.",
        "note": "동사 뒤 之는 它(그것)을 대신하는 목적어예요."
      }
    ],
    "1": [
      {
        "zh": "这些方案各有其优点。",
        "pinyin": "zhèxiē fāng'àn gè yǒu qí yōudiǎn.",
        "ko": "이 방안들은 저마다 그 나름의 장점이 있어요.",
        "note": "其 = 它们的(그것들의)로 쓰였어요."
      },
      {
        "zh": "他做事认真，尤其注重细节。",
        "pinyin": "tā zuòshì rènzhēn, yóuqí zhùzhòng xìjié.",
        "ko": "그는 일을 꼼꼼히 하는데, 특히 디테일을 중시해요."
      },
      {
        "zh": "我读过几本他的小说，其中这本最有名。",
        "pinyin": "wǒ dúguo jǐ běn tā de xiǎoshuō, qízhōng zhè běn zuì yǒumíng.",
        "ko": "그의 소설을 몇 권 읽었는데, 그중 이 책이 가장 유명해요."
      }
    ],
    "2": [
      {
        "zh": "总之，这件事还需要再考虑。",
        "pinyin": "zǒngzhī, zhè jiàn shì hái xūyào zài kǎolǜ.",
        "ko": "요컨대, 이 일은 좀 더 생각해 봐야 해요."
      },
      {
        "zh": "努力不一定成功，反之，不努力一定失败。",
        "pinyin": "nǔlì bù yídìng chénggōng, fǎnzhī, bù nǔlì yídìng shībài.",
        "ko": "노력한다고 꼭 성공하는 건 아니지만, 반대로 노력 안 하면 반드시 실패해요.",
        "note": "反之는 '반대로'라는 뜻의 접속 부사예요."
      },
      {
        "zh": "他之所以迟到，是因为路上堵车了。",
        "pinyin": "tā zhīsuǒyǐ chídào, shì yīnwèi lùshang dǔchē le.",
        "ko": "그가 늦은 까닭은 길이 막혔기 때문이에요."
      }
    ]
  },
  "h5-07-rhetorical-emphasis": {
    "0": [
      {
        "zh": "难道这点小事也要我来管吗？",
        "pinyin": "nándào zhè diǎn xiǎoshì yě yào wǒ lái guǎn ma?",
        "ko": "설마 이런 사소한 일까지 제가 챙겨야 하는 거예요?",
        "note": "难道...吗? 는 형식은 질문이나 강한 단정이에요."
      },
      {
        "zh": "你为他付出这么多，难道他不知道吗？",
        "pinyin": "nǐ wèi tā fùchū zhème duō, nándào tā bù zhīdào ma?",
        "ko": "당신이 그를 위해 이렇게 애썼는데, 설마 그가 모르겠어요?"
      },
      {
        "zh": "事到如今，岂能轻易放弃？",
        "pinyin": "shì dào rújīn, qǐ néng qīngyì fàngqì?",
        "ko": "일이 이 지경까지 왔는데, 어찌 쉽게 포기하겠어요?",
        "note": "岂能...? 은 '어찌 ~하겠는가'라는 글말 반어예요."
      }
    ],
    "1": [
      {
        "zh": "他连一句谢谢都没说就走了。",
        "pinyin": "tā lián yí jù xièxie dōu méi shuō jiù zǒu le.",
        "ko": "그는 고맙다는 말 한마디조차 안 하고 가 버렸어요."
      },
      {
        "zh": "这么有名的地方，连外国人也知道。",
        "pinyin": "zhème yǒumíng de dìfang, lián wàiguórén yě zhīdào.",
        "ko": "이렇게 유명한 곳은 외국인조차도 알아요."
      },
      {
        "zh": "我累得连话都不想说了。",
        "pinyin": "wǒ lèi de lián huà dōu bù xiǎng shuō le.",
        "ko": "저는 말조차 하기 싫을 만큼 지쳤어요."
      }
    ],
    "2": [
      {
        "zh": "为了实现梦想，他没有一天不努力。",
        "pinyin": "wèile shíxiàn mèngxiǎng, tā méiyǒu yì tiān bù nǔlì.",
        "ko": "꿈을 이루기 위해 그는 노력하지 않는 날이 하루도 없어요.",
        "note": "没有...不...은 '~하지 않는 ~이 없다'는 강한 긍정이에요."
      },
      {
        "zh": "他说的话，我不得不信。",
        "pinyin": "tā shuō de huà, wǒ bùdébù xìn.",
        "ko": "그가 한 말을 저는 믿지 않을 수 없어요.",
        "note": "不得不는 '~하지 않을 수 없다'예요."
      },
      {
        "zh": "看到这样的成绩，老师没有不满意的。",
        "pinyin": "kàndào zhèyàng de chéngjì, lǎoshī méiyǒu bù mǎnyì de.",
        "ko": "이런 성적을 보고 만족하지 않는 선생님은 없어요."
      }
    ]
  },
  "h5-08-de-summary": {
    "0": [
      {
        "zh": "他慢慢地走进了教室。",
        "pinyin": "tā mànmàn de zǒujìn le jiàoshì.",
        "ko": "그는 천천히 교실로 걸어 들어갔어요.",
        "note": "동사 앞은 地예요."
      },
      {
        "zh": "这是一个很重要的问题。",
        "pinyin": "zhè shì yí ge hěn zhòngyào de wèntí.",
        "ko": "이건 아주 중요한 문제예요.",
        "note": "명사 앞은 的예요."
      },
      {
        "zh": "孩子们玩得很开心。",
        "pinyin": "háizimen wán de hěn kāixīn.",
        "ko": "아이들이 아주 즐겁게 놀았어요.",
        "note": "동사 뒤 정도보어는 得예요."
      }
    ],
    "1": [
      {
        "zh": "他高兴得跳了起来。",
        "pinyin": "tā gāoxìng de tiào le qǐlái.",
        "ko": "그는 기뻐서 펄쩍 뛰었어요.",
        "note": "형용사 + 得 + 결과로 정도를 나타내요."
      },
      {
        "zh": "声音太小了，我听不清楚。",
        "pinyin": "shēngyīn tài xiǎo le, wǒ tīng bu qīngchu.",
        "ko": "소리가 너무 작아서 잘 안 들려요.",
        "note": "听不清楚는 가능보어의 부정형이에요."
      },
      {
        "zh": "这么多菜，我们吃得完吗？",
        "pinyin": "zhème duō cài, wǒmen chī de wán ma?",
        "ko": "이렇게 음식이 많은데, 우리가 다 먹을 수 있을까요?",
        "note": "吃得完은 가능보어의 긍정형이에요."
      }
    ],
    "2": [
      {
        "zh": "他认真地听老师讲课。",
        "pinyin": "tā rènzhēn de tīng lǎoshī jiǎngkè.",
        "ko": "그는 선생님의 수업을 열심히 들어요.",
        "note": "동사 앞에서 방식을 꾸미므로 地가 맞아요."
      },
      {
        "zh": "她是一个认真的人。",
        "pinyin": "tā shì yí ge rènzhēn de rén.",
        "ko": "그녀는 성실한 사람이에요.",
        "note": "같은 认真이라도 명사 앞에서는 的예요."
      }
    ]
  }
};

export default examples;
