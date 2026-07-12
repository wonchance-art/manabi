/**
 * H6 추가 예문 — 섹션별 보강(slug → 섹션index → 예문).
 * index.js가 본편 챕터 섹션에 병합. 본문/원본 예문은 불변.
 */
const examples = {
  "h6-01-advanced-chengyu": {
    "0": [
      {
        "zh": "出了问题就赶紧改，亡羊补牢，为时不晚。",
        "pinyin": "chū le wèntí jiù gǎnjǐn gǎi, wángyáng-bǔláo, wéishí bù wǎn.",
        "ko": "문제가 생기면 얼른 고쳐야죠, 소 잃고 외양간 고치기라도 늦지 않았어요."
      },
      {
        "zh": "塞翁失马，这次失败也许是好事。",
        "pinyin": "sàiwēng-shīmǎ, zhè cì shībài yěxǔ shì hǎoshì.",
        "ko": "새옹지마라고, 이번 실패가 어쩌면 좋은 일일지도 몰라요."
      },
      {
        "zh": "不主动找客户，只在办公室守株待兔，怎么会有订单？",
        "pinyin": "bù zhǔdòng zhǎo kèhù, zhǐ zài bàngōngshì shǒuzhū-dàitù, zěnme huì yǒu dìngdān?",
        "ko": "고객을 적극적으로 찾지 않고 사무실에서 요행만 바라니, 어떻게 주문이 들어오겠어요?"
      }
    ],
    "1": [
      {
        "zh": "塞翁失马，焉知非福，别太难过了。",
        "pinyin": "sàiwēng-shīmǎ, yān zhī fēi fú, bié tài nánguò le.",
        "ko": "새옹지마, 화가 복이 될지 누가 알겠어요, 너무 슬퍼하지 마세요.",
        "note": "한국어 '새옹지마'와 글자 순서가 같지만 焉知非福이 짝으로 붙어요."
      },
      {
        "zh": "他生病住院时，老同学雪中送炭，让他很感动。",
        "pinyin": "tā shēngbìng zhùyuàn shí, lǎo tóngxué xuězhōng-sòngtàn, ràng tā hěn gǎndòng.",
        "ko": "그가 입원했을 때 옛 동창이 어려울 때 결정적인 도움을 줘서 그를 감동시켰어요.",
        "note": "雪中送炭은 '금상첨화'가 아니라 어려운 때 돕는다는 뜻이에요."
      }
    ],
    "2": [
      {
        "zh": "这点小事，对他来说简直是小菜一碟。",
        "pinyin": "zhè diǎn xiǎoshì, duì tā lái shuō jiǎnzhí shì xiǎocài-yìdié.",
        "ko": "이런 사소한 일은 그에게는 그야말로 식은 죽 먹기예요.",
        "note": "简直是 + 성어로 강조해요."
      },
      {
        "zh": "做事别三心二意嘛，专心一点才能做好。",
        "pinyin": "zuòshì bié sānxīn-èryì ma, zhuānxīn yìdiǎn cái néng zuòhǎo.",
        "ko": "일할 때 딴마음 먹지 말고, 집중해야 잘할 수 있어요.",
        "note": "성어 뒤에 嘛를 붙여 구어 어감을 더했어요."
      }
    ]
  },
  "h6-02-idioms-xiehouyu": {
    "0": [
      {
        "zh": "他工作出了大错，被老板炒鱿鱼了。",
        "pinyin": "tā gōngzuò chū le dà cuò, bèi lǎobǎn chǎo yóuyú le.",
        "ko": "그는 일에서 큰 실수를 해서 사장에게 해고당했어요.",
        "note": "炒鱿鱼는 '해고하다'라는 관용구예요."
      },
      {
        "zh": "在公司光会拍马屁是不行的。",
        "pinyin": "zài gōngsī guāng huì pāi mǎpì shì bù xíng de.",
        "ko": "회사에서 아첨만 할 줄 알아서는 안 돼요."
      },
      {
        "zh": "这种走后门的事，我可不想做。",
        "pinyin": "zhè zhǒng zǒu hòumén de shì, wǒ kě bù xiǎng zuò.",
        "ko": "이런 뒷거래 같은 일은 저는 정말 하고 싶지 않아요."
      }
    ],
    "1": [
      {
        "zh": "他这是竹篮打水——一场空。",
        "pinyin": "tā zhè shì zhúlán dǎ shuǐ——yì chǎng kōng.",
        "ko": "그는 지금 대바구니로 물 긷는 격이에요 — 결국 헛수고죠.",
        "note": "앞 구절만 말하면 뒤의 一场空(헛수고)이 통해요."
      },
      {
        "zh": "你让他帮忙，简直是肉包子打狗——有去无回。",
        "pinyin": "nǐ ràng tā bāngmáng, jiǎnzhí shì ròubāozi dǎ gǒu——yǒu qù wú huí.",
        "ko": "그에게 도움을 청하는 건 그야말로 고기만두로 개 때리는 격 — 가면 돌아오지 않아요."
      }
    ],
    "2": [
      {
        "zh": "这次考试我准备得马马虎虎，没什么把握。",
        "pinyin": "zhè cì kǎoshì wǒ zhǔnbèi de mǎmǎ-hūhū, méi shénme bǎwò.",
        "ko": "이번 시험은 대충 준비해서 별로 자신이 없어요.",
        "note": "马马虎虎는 AABB 중첩으로 '대충'을 뜻해요."
      },
      {
        "zh": "这个问题我们晚上一起研究研究。",
        "pinyin": "zhège wèntí wǒmen wǎnshang yìqǐ yánjiū yánjiū.",
        "ko": "이 문제는 저녁에 같이 좀 연구해 봐요.",
        "note": "研究研究는 ABAB 중첩으로 어감을 부드럽게 해요."
      }
    ]
  },
  "h6-03-literary-particles": {
    "0": [
      {
        "zh": "他为人正直而善良。",
        "pinyin": "tā wéirén zhèngzhí ér shànliáng.",
        "ko": "그는 사람됨이 정직하고 또 선량해요.",
        "note": "여기서 而는 순접(그리고)이에요."
      },
      {
        "zh": "学而不思则罔。",
        "pinyin": "xué ér bù sī zé wǎng.",
        "ko": "배우기만 하고 생각하지 않으면 얻는 게 없어요.",
        "note": "而는 역접, 则는 '그러면'이에요."
      },
      {
        "zh": "他们为了共同的目标而努力。",
        "pinyin": "tāmen wèile gòngtóng de mùbiāo ér nǔlì.",
        "ko": "그들은 공동의 목표를 위해 노력해요.",
        "note": "여기서 而는 앞 구가 뒤 동사를 수식해요."
      }
    ],
    "1": [
      {
        "zh": "若准备充分，则成功在望。",
        "pinyin": "ruò zhǔnbèi chōngfèn, zé chénggōng zài wàng.",
        "ko": "준비가 충분하면 곧 성공이 눈앞에 있어요.",
        "note": "则는 '그러면·곧'이에요."
      },
      {
        "zh": "时至今日，问题尚未解决。",
        "pinyin": "shí zhì jīnrì, wèntí shàng wèi jiějué.",
        "ko": "오늘에 이르도록 문제는 아직 해결되지 않았어요.",
        "note": "尚은 '아직'으로 还에 해당해요."
      },
      {
        "zh": "此言不仅有理，亦颇有深意。",
        "pinyin": "cǐ yán bùjǐn yǒulǐ, yì pō yǒu shēnyì.",
        "ko": "이 말은 일리가 있을 뿐 아니라, 또한 자못 깊은 뜻이 있어요.",
        "note": "亦은 '또한'으로 也에 해당해요."
      }
    ],
    "2": [
      {
        "zh": "他既有才华，又很谦虚。",
        "pinyin": "tā jì yǒu cáihuá, yòu hěn qiānxū.",
        "ko": "그는 재능도 있고, 또 겸손하기도 해요.",
        "note": "既...又...는 '~하기도 하고 ~하기도 하다'예요."
      },
      {
        "zh": "他不仅会说英语，而且会说法语。",
        "pinyin": "tā bùjǐn huì shuō Yīngyǔ, érqiě huì shuō Fǎyǔ.",
        "ko": "그는 영어를 할 줄 알 뿐 아니라 프랑스어도 할 줄 알아요."
      },
      {
        "zh": "与其等别人帮忙，不如自己想办法。",
        "pinyin": "yǔqí děng biérén bāngmáng, bùrú zìjǐ xiǎng bànfǎ.",
        "ko": "남이 도와주길 기다리느니 차라리 스스로 방법을 찾는 게 나아요."
      }
    ]
  },
  "h6-04-rhetoric": {
    "0": [
      {
        "zh": "天上的云像棉花一样白。",
        "pinyin": "tiānshàng de yún xiàng miánhua yíyàng bái.",
        "ko": "하늘의 구름이 솜처럼 하얘요.",
        "note": "像...一样은 직유예요."
      },
      {
        "zh": "时间是金钱。",
        "pinyin": "shíjiān shì jīnqián.",
        "ko": "시간은 돈이에요.",
        "note": "A 是 B 형태의 은유예요."
      },
      {
        "zh": "孩子是祖国的花朵。",
        "pinyin": "háizi shì zǔguó de huāduǒ.",
        "ko": "아이들은 조국의 꽃이에요."
      }
    ],
    "1": [
      {
        "zh": "时间是宝贵的，生命是有限的。",
        "pinyin": "shíjiān shì bǎoguì de, shēngmìng shì yǒuxiàn de.",
        "ko": "시간은 귀중하고, 생명은 유한해요.",
        "note": "두 구의 글자 수와 구조를 맞춘 대구예요."
      },
      {
        "zh": "失败是成功之母，经验是智慧之源。",
        "pinyin": "shībài shì chénggōng zhī mǔ, jīngyàn shì zhìhuì zhī yuán.",
        "ko": "실패는 성공의 어머니이고, 경험은 지혜의 근원이에요."
      }
    ],
    "2": [
      {
        "zh": "他爱读书，爱思考，爱写作。",
        "pinyin": "tā ài dúshū, ài sīkǎo, ài xiězuò.",
        "ko": "그는 책 읽기를, 생각하기를, 글쓰기를 좋아해요.",
        "note": "같은 틀을 셋 거듭한 排比예요."
      },
      {
        "zh": "运动让身体健康，让心情愉快，让生活充实。",
        "pinyin": "yùndòng ràng shēntǐ jiànkāng, ràng xīnqíng yúkuài, ràng shēnghuó chōngshí.",
        "ko": "운동은 몸을 건강하게, 기분을 즐겁게, 생활을 충실하게 해요."
      }
    ]
  },
  "h6-05-register": {
    "0": [
      {
        "zh": "医生说他的肺部需要进一步检查。",
        "pinyin": "yīshēng shuō tā de fèibù xūyào jìnyíbù jiǎnchá.",
        "ko": "의사는 그의 폐 부위를 좀 더 검사해야 한다고 했어요.",
        "note": "肺部는 서면어 어휘, 구어로는 보통 부위명만 말해요."
      },
      {
        "zh": "公司决定给每位员工发一笔奖金。",
        "pinyin": "gōngsī juédìng gěi měi wèi yuángōng fā yì bǐ jiǎngjīn.",
        "ko": "회사는 직원 한 명 한 명에게 보너스를 주기로 했어요.",
        "note": "구어의 给는 서면어에서 予以·发放으로 바뀌어요."
      },
      {
        "zh": "请把这些文件予以归档。",
        "pinyin": "qǐng bǎ zhèxiē wénjiàn yǔyǐ guīdàng.",
        "ko": "이 서류들을 정리해서 보관해 주세요.",
        "note": "予以는 공문체, 같은 뜻을 구어로는 给 ... 归档으로 말해요."
      }
    ],
    "1": [
      {
        "zh": "我老婆做的菜特别好吃。",
        "pinyin": "wǒ lǎopó zuò de cài tèbié hǎochī.",
        "ko": "제 아내가 만든 음식은 정말 맛있어요.",
        "note": "老婆는 '노파'가 아니라 구어로 '아내'예요."
      },
      {
        "zh": "他和妻子结婚已经十年了。",
        "pinyin": "tā hé qīzi jiéhūn yǐjīng shí nián le.",
        "ko": "그는 아내와 결혼한 지 벌써 십 년 됐어요.",
        "note": "妻子는 '아내'만 가리키고 자녀는 포함하지 않아요."
      }
    ],
    "2": [
      {
        "zh": "经研究决定，该项目暂停实施。",
        "pinyin": "jīng yánjiū juédìng, gāi xiàngmù zàntíng shíshī.",
        "ko": "검토한 결과, 해당 사업은 시행을 잠정 중단합니다.",
        "note": "经···决定·该·实施는 전형적인 서면 공문체예요."
      },
      {
        "zh": "这个嘛，咱们慢慢再商量呗。",
        "pinyin": "zhège ma, zánmen mànmàn zài shāngliang bei.",
        "ko": "이건 말이야, 우리 천천히 다시 의논하자.",
        "note": "嘛·咱们·呗 등 어기조사가 많은 짧은 구어 문장이에요."
      }
    ]
  },
  "h6-06-advanced-conjunctions": {
    "0": [
      {
        "zh": "鉴于天气恶劣，今天的比赛取消了。",
        "pinyin": "jiànyú tiānqì èliè, jīntiān de bǐsài qǔxiāo le.",
        "ko": "날씨가 좋지 않은 점을 고려하여, 오늘 경기는 취소되었어요."
      },
      {
        "zh": "鉴于双方分歧较大，谈判被迫中止。",
        "pinyin": "jiànyú shuāngfāng fēnqí jiào dà, tánpàn bèipò zhōngzhǐ.",
        "ko": "양측의 견해 차이가 큰 점을 감안하여, 협상은 부득이 중단되었어요."
      }
    ],
    "1": [
      {
        "zh": "即便再忙，他每天也坚持锻炼。",
        "pinyin": "jíbiàn zài máng, tā měitiān yě jiānchí duànliàn.",
        "ko": "설령 아무리 바빠도, 그는 매일 빠짐없이 운동해요."
      },
      {
        "zh": "哪怕全世界都反对，我也支持你。",
        "pinyin": "nǎpà quán shìjiè dōu fǎnduì, wǒ yě zhīchí nǐ.",
        "ko": "설령 온 세상이 다 반대해도, 나는 너를 지지해요."
      }
    ],
    "2": [
      {
        "zh": "对错姑且不谈，你的态度就有问题。",
        "pinyin": "duìcuò gūqiě bù tán, nǐ de tàidù jiù yǒu wèntí.",
        "ko": "옳고 그름은 일단 제쳐 두더라도, 당신의 태도부터가 문제예요."
      },
      {
        "zh": "专家尚且无法解释，普通人就更难懂了。",
        "pinyin": "zhuānjiā shàngqiě wúfǎ jiěshì, pǔtōngrén jiù gèng nán dǒng le.",
        "ko": "전문가조차 설명하지 못하는데, 보통 사람은 더욱 이해하기 어려워요.",
        "note": "尚且···何况/更···는 정도를 끌어올려 강조해요."
      }
    ]
  },
  "h6-07-synonym-nuance": {
    "0": [
      {
        "zh": "停电来得太突然，大家都没准备。",
        "pinyin": "tíngdiàn lái de tài tūrán, dàjiā dōu méi zhǔnbèi.",
        "ko": "정전이 너무 갑작스럽게 와서, 다들 준비가 안 됐어요.",
        "note": "突然은 형용사로 쓰여 정도부사 太의 수식을 받아요."
      },
      {
        "zh": "天忽然下起了大雨。",
        "pinyin": "tiān hūrán xià qǐ le dàyǔ.",
        "ko": "하늘에서 갑자기 큰비가 내리기 시작했어요.",
        "note": "忽然은 부사라서 동사 앞에만 쓰여요."
      }
    ],
    "1": [
      {
        "zh": "进入实验室必须戴上手套。",
        "pinyin": "jìnrù shíyànshì bìxū dài shàng shǒutào.",
        "ko": "실험실에 들어갈 때는 반드시 장갑을 껴야 해요.",
        "note": "必须는 동사 앞에서 당위를 나타내요."
      },
      {
        "zh": "这些都是露营的必需装备。",
        "pinyin": "zhèxiē dōu shì lùyíng de bìxū zhuāngbèi.",
        "ko": "이것들은 모두 캠핑에 반드시 필요한 장비예요.",
        "note": "必需는 명사를 수식해 '필수의'라는 뜻이에요."
      }
    ],
    "2": [
      {
        "zh": "学校制定了新的考试制度。",
        "pinyin": "xuéxiào zhìdìng le xīn de kǎoshì zhìdù.",
        "ko": "학교는 새로운 시험 제도를 제정했어요.",
        "note": "制定은 확정해 공포하는 것을 뜻해요."
      },
      {
        "zh": "那次旅行的经历我至今难忘。",
        "pinyin": "nà cì lǚxíng de jīnglì wǒ zhìjīn nánwàng.",
        "ko": "그때 여행의 경험을 나는 아직도 잊지 못해요.",
        "note": "经历는 직접 '겪은 일', 经验은 쌓인 노하우를 가리켜요."
      }
    ]
  }
};

export default examples;
