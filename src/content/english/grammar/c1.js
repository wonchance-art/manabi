/**
 * C1 고급 — 격식·뉘앙스·문체의 영어
 * 문법 규칙은 이미 아는 학습자를 위해, '교양 있는 영어'를 가르는 운용의 차원을 다뤄요.
 */
export default [
  {
    slug: "c1-01-subjunctive-formality",
    level: "C1",
    order: 1,
    title: "가정법 잔재와 격식 구문 — 화석이 된 접속법",
    titleFr: "The Subjunctive and Formal Constructions",
    summary: "I suggest he be..., If I were..., lest — 죽은 줄 알았던 접속법이 격식문 곳곳에 화석처럼 살아 있어요. 이 화석을 다룰 줄 알면 문장의 격이 달라집니다.",
    duration: "약 10분",
    sections: [
      {
        heading: "접속법이라는 유령 — 영어에도 '법(mood)'이 있었다",
        body:
          "프랑스어나 스페인어를 배워본 분이라면 subjonctif/subjuntivo라는 거대한 활용 체계에 시달려봤을 거예요. 영어에도 원래 그 체계가 있었어요. **사실을 말하는 직설법(indicative)과, 소망·요구·비현실을 말하는 접속법(subjunctive)**이 동사 모양으로 구분됐죠.\n\n" +
          "천 년에 걸쳐 영어가 어미를 깎아내면서 접속법은 거의 사라졌어요. 하지만 완전히 죽지는 않았습니다. **격식문, 법률문, 굳은 표현 속에 화석처럼 박혀** 지금도 쓰여요. 형태는 단 두 가지만 기억하면 돼요.\n\n" +
          "**① 동사원형 접속법**: 인칭·시제와 무관하게 동사원형. he be, she go, it remain.\n" +
          "**② were 접속법**: 비현실 가정에서 인칭과 무관하게 were. If I were, if she were.\n\n" +
          "이 챕터는 '새 문법'이 아니라, 여러분이 이미 본 적 있는 문장들의 **정체를 밝히는** 챕터예요.",
        examples: [
          { en: "God save the King.", ko: "국왕 폐하 만세. (왕을 구하소서)", note: "saves가 아닌 save — 기원을 나타내는 접속법 화석이에요." },
          { en: "So be it.", ko: "그렇다면 그렇게 하지. (될 대로 되라지)", note: "it is가 아니라 be it — 어순까지 옛 모습 그대로예요." },
          { en: "Long live the difference!", ko: "차이 만세! (차이여 영원하라)", note: "lives가 아닌 live." },
        ],
        etym: "subjunctive는 라틴어 subiungere(아래에 잇다)에서 왔어요 — sub(아래)+jungere(잇다, 영어 join·junction과 같은 뿌리). '주절 아래에 이어 붙는 절의 법'이라는 뜻이죠. 프랑스어 subjonctif와 같은 단어입니다.",
      },
      {
        heading: "요구·제안의 접속법 — I suggest (that) he be on time",
        body:
          "현대 영어에서 접속법이 가장 활발하게 살아 있는 자리예요. **요구·제안·주장·필수를 나타내는 동사와 형용사 뒤의 that절**에서는 동사원형을 써요.\n\n" +
          "**유발 동사**: suggest, recommend, demand, insist, require, request, propose, ask\n" +
          "**유발 형용사**: It is essential / important / vital / imperative / necessary that...\n\n" +
          "핵심은 3인칭 단수에서도 -s가 붙지 않고, **부정은 not + 동사원형**, be동사는 인칭 불문 be라는 것. 미국 영어는 이 형태를 일관되게 쓰고, 영국 영어는 should + 동사원형으로 풀어 쓰는 경향이 있어요(I suggest that he should be...). 둘 다 맞지만, 학술·비즈니스 문서에서는 원형 접속법이 더 간결하고 격식 있게 들립니다.",
        examples: [
          { en: "I suggest that he be present at the hearing.", ko: "그가 청문회에 출석할 것을 제안합니다.", note: "he is(X) — 격식문의 표준은 he be." },
          { en: "The committee demanded that the report not be released.", ko: "위원회는 보고서가 공개되지 않을 것을 요구했다.", note: "부정은 do를 쓰지 않고 not be." },
          { en: "It is essential that every applicant submit the form by Friday.", ko: "모든 지원자는 금요일까지 양식을 제출하는 것이 필수입니다.", note: "submits가 아니라 submit." },
          { en: "She insisted that the meeting be postponed.", ko: "그녀는 회의를 연기할 것을 강하게 요청했다.", note: "insist가 '사실 주장'의 뜻일 땐 직설법: She insisted that he was innocent." },
        ],
        pitfall: "한국 학습자는 수일치 훈련이 몸에 밴 나머지, 시험에서 that he be를 보고 '오타 아닌가?' 하고 he is로 고치는 실수를 해요. 반대 방향도 위험해요 — suggest가 '시사하다'라는 뜻일 땐 평범한 직설법입니다: The data suggest that the policy has failed. '요구의 뜻인가, 사실 서술인가'를 먼저 판별하세요.",
      },
      {
        heading: "were 접속법 — If I were you, as it were",
        body:
          "If I was와 If I were의 차이, 막연히 '둘 다 되는 것 같은데'로 넘어가셨다면 여기서 정리해요. **비현실·반사실 가정에서 인칭 불문 were를 쓰는 것**이 접속법의 두 번째 생존자예요.\n\n" +
          "구어에서는 If I was도 흔히 들리지만, **격식 글·시험·면접에서는 were가 표준**이에요. 특히 도치 구문에서는 선택의 여지가 없어요 — **Were I in your position**처럼 if를 빼고 도치하는 격식 구문은 was로는 아예 만들 수 없거든요.\n\n" +
          "굳은 표현으로는 **as it were**(말하자면, 이를테면)와 **if need be**(필요하다면)가 자주 나와요. as it was가 아니라 as it were인 이유 — 비현실의 화석이기 때문이에요.",
        examples: [
          { en: "If I were in your shoes, I would take the offer.", ko: "제가 당신 입장이라면 그 제안을 받아들이겠어요.", note: "현실이 아닌 가정 → were." },
          { en: "Were the project to fail, the entire team would be held responsible.", ko: "만에 하나 프로젝트가 실패한다면, 팀 전체가 책임을 지게 될 것이다.", note: "if 생략 + 도치 — 계약서·보고서의 격식 가정문." },
          { en: "He is, as it were, a walking dictionary.", ko: "그는 말하자면 걸어 다니는 사전이에요.", note: "직역하면 '그런 셈 치자면' — 비유를 쓸 때의 완충 장치." },
          { en: "I can work overtime, if need be.", ko: "필요하다면 야근도 할 수 있어요.", note: "if it is needed의 화석화된 압축형." },
        ],
        vsKo: "한국어 '-라면/-다면'은 현실 가정(내일 비가 오면)과 비현실 가정(내가 새라면)을 같은 어미로 처리하고 맥락이 구분해줘요. 영어는 이 구분을 동사 형태(is/were)에 새기는 언어예요. 한국어 감각으로는 잉여처럼 느껴지는 were가, 영어 화자에게는 '지금부터 비현실 모드'라는 신호등 역할을 합니다.",
      },
      {
        heading: "lest와 격식 기원문 — 법률·문학의 흔적들",
        body:
          "**lest**(~하지 않도록, ~할까 봐)는 접속법을 데리고 다니는 마지막 접속사예요. lest 뒤에는 동사원형(또는 should + 원형)이 와요. 일상 회화에서는 in case나 so that... not으로 풀어 말하지만, **연설·문학·추모 문구**에서는 lest가 특유의 무게를 만들어요. 전쟁 추모비의 **Lest we forget**(우리가 잊지 않도록)이 대표적이죠.\n\n" +
          "그 밖의 화석 기원문도 모아둘게요. 전부 '접속법 동사원형 + 도치'라는 같은 구조예요.\n\n" +
          "**Far be it from me to...** — 내가 감히 ~하려는 건 아니지만 (정중한 반론의 서두)\n" +
          "**Be that as it may** — 그렇다 하더라도\n" +
          "**Suffice it to say (that)...** — ~라고만 말해두죠\n" +
          "**Come what may** — 무슨 일이 있어도",
        examples: [
          { en: "He wrote everything down, lest he forget.", ko: "잊지 않도록 그는 모든 것을 적어두었다.", note: "forgets가 아니라 forget — lest는 접속법을 부릅니다." },
          { en: "Far be it from me to criticize your work, but the numbers don't add up.", ko: "제가 감히 당신 작업을 비판하려는 건 아니지만, 숫자가 맞지 않아요.", note: "반론 직전의 격식 완충재." },
          { en: "Be that as it may, we still need a decision by Friday.", ko: "그렇다 하더라도, 금요일까지는 결정이 필요합니다.", note: "회의에서 상대 말을 인정하면서 밀어붙일 때." },
          { en: "Suffice it to say, the negotiations did not go well.", ko: "협상이 잘 풀리지 않았다고만 말해두죠.", note: "자세히 말하고 싶지 않다는 신호." },
        ],
        tip: "이 표현들은 '만들어 쓰는' 문법이 아니라 '통째로 꺼내 쓰는' 관용구예요. 변형하지 말고 그대로 암기하세요. 회의에서 Be that as it may 한 마디를 정확한 자리에 놓으면, 문법 백 점짜리 문장 열 개보다 강한 인상을 남깁니다.",
      },
    ],
  },

  {
    slug: "c1-02-hedging-nuance",
    level: "C1",
    order: 2,
    title: "완곡과 헤징 — 단정하지 않는 기술",
    titleFr: "Hedging and Softening",
    summary: "would suggest, might want to, appear to — 학술·비즈니스 영어의 신뢰는 역설적으로 '단정하지 않는 기술'에서 나와요. 한국어 '-인 것 같다' 감각과는 작동 방식이 다릅니다.",
    duration: "약 11분",
    sections: [
      {
        heading: "왜 헤징인가 — 단정의 비용",
        body:
          "C1 학습자의 영어가 '정확한데 어딘가 거친' 이유의 팔 할이 여기 있어요. **헤징(hedging)**은 주장의 강도를 의도적으로 낮추는 언어 장치예요. 회피나 자신감 부족이 아니라, 영어 담화에서는 **전문성과 예의의 표지**입니다.\n\n" +
          "논리는 이래요. This proves that...이라고 단정하면, 반례가 하나만 나와도 주장 전체가 무너져요. The evidence suggests that...이라고 말하면 반례가 나와도 '시사한다고 했지 증명한다고 안 했다'는 지적 퇴로가 남죠. 학술 영어에서 헤징은 **검증 가능성에 대한 겸손**이고, 비즈니스 영어에서는 **상대의 체면(face)을 지켜주는 외교술**이에요.\n\n" +
          "그래서 영어 논문에는 may, appear, suggest가 빼곡하고, 영국식 비즈니스 이메일에서는 You are wrong 대신 I'm not sure that's quite right가 표준이 됩니다. 단정문을 헤징문으로 바꾸는 변환 능력 — 이게 이 챕터의 목표예요.",
        examples: [
          { en: "This proves the policy failed. → The evidence suggests the policy may have been less effective than intended.", ko: "이것은 정책이 실패했음을 증명한다. → 증거에 따르면 정책은 의도보다 효과가 적었을 수 있음이 시사된다.", note: "강도를 세 군데서 낮췄어요: proves→suggests, failed→less effective, 단정→may have been." },
          { en: "Your figures are wrong. → I wonder if these figures might need another look.", ko: "당신 수치가 틀렸어요. → 이 수치들은 한 번 더 검토가 필요할 수도 있지 않을까 싶은데요.", note: "지적은 그대로, 충돌만 제거." },
        ],
        vsKo: "한국어에도 완곡은 풍부하죠 — '-인 것 같아요', '-지 않을까 싶어요'. 그런데 작동 방식이 달라요. 한국어 '것 같다'는 확신이 있어도 붙이는 **사회적 겸양 어미**에 가까워서, 한국 학습자는 영어에서도 I think...를 만능 완충재로 남발해요. 영어 헤징은 겸양이 아니라 **확신의 정도를 계측해서 보고하는 장치**예요. 90% 확신이면 almost certainly, 60%면 probably, 40%면 might — 확신도와 표현이 일치해야 해요. 확실한 사실에 I think를 붙이면 겸손이 아니라 '자기 데이터도 모르는 사람'으로 읽힙니다.",
      },
      {
        heading: "조동사 헤징 — would, might, could, may의 온도 차",
        body:
          "헤징의 1차 도구는 조동사예요. 같은 문장도 조동사에 따라 온도가 달라져요.\n\n" +
          "**would** — 헤징의 만능 윤활유. I would suggest, I would argue, I would say는 '지금 단정하는 게 아니라 조심스럽게 내놓는다'는 신호예요. 의견 동사 앞에 would를 끼우는 것만으로 문장이 한 단계 부드러워져요.\n\n" +
          "**might / may / could** — 가능성의 3형제. 격식 글에서는 may가 가장 중립적이고, might는 그보다 한 칸 낮은 가능성, could는 '이론상 가능'의 뉘앙스예요.\n\n" +
          "특히 **might want to / may wish to**는 비즈니스 영어의 핵심 완곡 명령이에요. You might want to check the attachment는 표면상 '확인하고 싶을 수도 있겠다'지만, 실제 의미는 **'확인하세요'**예요. 이걸 문자 그대로 '안 하고 싶으면 안 해도 되는구나'로 읽으면 큰일 납니다.",
        table: {
          caption: "단정 강도 스펙트럼 — 같은 내용, 다른 온도",
          headers: ["강도", "표현", "체감 확신도"],
          rows: [
            ["단정", "The merger will reduce costs.", "100% — 책임을 전부 짊어짐"],
            ["강한 추정", "The merger will almost certainly reduce costs.", "~90%"],
            ["표준 헤징", "The merger is likely to reduce costs.", "~70%"],
            ["중립 헤징", "The merger may reduce costs.", "~50%"],
            ["약한 가능성", "The merger might/could reduce costs.", "~30%"],
            ["이중 헤징", "It seems possible that the merger might reduce costs.", "학술적 최저 단정 — 남용 주의"],
          ],
        },
        examples: [
          { en: "I would argue that the risks outweigh the benefits.", ko: "위험이 이익보다 크다고 저는 보는 편입니다.", note: "I argue보다 한결 외교적 — 학술 토론의 표준형." },
          { en: "You might want to run this by the legal team first.", ko: "이건 먼저 법무팀에 검토받으시는 게 좋겠어요.", note: "형태는 제안, 실질은 지시." },
          { en: "We may need to revisit the timeline.", ko: "일정을 재검토해야 할 수도 있겠습니다.", note: "사실상 '일정 못 지킵니다'의 비즈니스 번역." },
        ],
        pitfall: "상사의 You might want to...나 It would be good if...를 '선택 사항'으로 알아듣는 것 — 한국 학습자가 영어권 직장에서 겪는 대표적 사고예요. 영어의 완곡 지시는 표면이 부드러울수록 거절하기 어려운 경우가 많아요. 형태가 아니라 '누가, 어떤 권한으로 말하는가'로 해석하세요.",
      },
      {
        heading: "어휘적 헤징 — appear, suggest, tend, arguably",
        body:
          "조동사 다음 단계는 어휘예요. 학술 영어는 동사·부사 차원에서 헤징을 정교하게 운용해요.\n\n" +
          "**동사**: appear to / seem to (~로 보인다), suggest / indicate (시사하다), tend to (~하는 경향이 있다), point to (~를 가리킨다)\n" +
          "**부사**: arguably (따져보면 ~라 할 만하다), presumably (짐작건대), reportedly (보도에 따르면), to some extent (어느 정도는), broadly (대체로)\n" +
          "**명사 우회**: There is a tendency to... / One possible explanation is...\n\n" +
          "주목할 단어는 **arguably**예요. 직역하면 '논쟁의 여지가 있게'지만 실제로는 **'논거를 대서 주장할 수 있을 만큼' — 즉 꽤 강한 주장을 안전하게 던지는 장치**예요. Arguably the best defender in the league는 '최고가 아닐 수도 있다'가 아니라 '최고라고 말해도 무리가 아니다'에 가깝습니다.",
        examples: [
          { en: "The results appear to support the hypothesis.", ko: "결과는 가설을 뒷받침하는 것으로 보인다.", note: "support라고 단정하지 않는 논문의 표준 동사." },
          { en: "Participants tended to overestimate their own performance.", ko: "참가자들은 자신의 수행을 과대평가하는 경향을 보였다.", note: "예외가 있었어도 안전한 서술." },
          { en: "This is arguably the most important finding of the study.", ko: "이것은 이 연구에서 가장 중요한 발견이라 할 만하다.", note: "강한 주장 + 안전장치를 한 단어로." },
          { en: "Presumably, the delay was caused by the supply chain issue.", ko: "짐작건대 지연은 공급망 문제 때문이었을 것이다.", note: "근거 있는 추정 — '아마도'보다 논리적인 냄새." },
        ],
        etym: "arguably의 뿌리 argue는 라틴어 arguere(밝히다, 입증하다)에서 왔어요 — 원뜻은 '말다툼'이 아니라 '논증'이에요. argument가 논문에서 '주장·논지'를 뜻하는 것도, arguably가 '논증 가능하게'라는 강한 단어인 것도 이 뿌리 때문이에요.",
      },
      {
        heading: "비즈니스 완곡 문법 — 부탁·거절·반대의 공식",
        body:
          "마지막으로, 비즈니스 영어에서 헤징이 거의 **고정 문형**이 된 세 장면을 정리해요.\n\n" +
          "**① 부탁** — 과거형과 진행형이 부탁을 부드럽게 해요. I was wondering if you could...는 현재의 부탁을 일부러 과거진행으로 밀어내서 압박을 줄이는 문형이에요. Would you mind -ing...도 표준형이죠.\n\n" +
          "**② 거절** — 영어 비즈니스 거절은 No를 직접 말하지 않아요. I'm afraid... / Unfortunately... / not in a position to...가 No의 격식 포장지예요.\n\n" +
          "**③ 반대** — 반대는 부분 동의로 시작해요. I see your point, but... / That's a fair point, though I wonder if... 패턴이에요. with all due respect는 격식상 존중 표현이지만, 실전에서는 오히려 '지금부터 세게 반박한다'는 예고편으로 들리니 사용에 주의하세요.",
        examples: [
          { en: "I was wondering if you could send over the draft by Wednesday.", ko: "수요일까지 초안을 보내주실 수 있을까 해서요.", note: "과거진행 = 부탁의 에어백." },
          { en: "I'm afraid we're not in a position to lower the price at this stage.", ko: "죄송하지만 현 단계에서는 가격을 낮춰드릴 수 있는 상황이 아닙니다.", note: "No price cut을 세 겹으로 포장한 표준 거절문." },
          { en: "That's a fair point, though I wonder if we're underestimating the risk.", ko: "타당한 지적이에요. 다만 우리가 리스크를 과소평가하고 있는 건 아닐까 싶습니다.", note: "동의 → 전환 → 헤징된 반론. 회의 발언의 황금 공식." },
        ],
        tip: "헤징은 '많이'가 아니라 '정확히'예요. 모든 문장에 maybe와 I think를 뿌리면 오히려 무능해 보여요. 원칙은 하나 — **사실은 단정하고, 해석은 헤징하라**. The revenue fell 12%(사실, 단정)... which may reflect seasonal factors(해석, 헤징). 이 리듬이 신뢰감 있는 영어의 핵심입니다.",
      },
    ],
  },

  {
    slug: "c1-03-discourse-register",
    level: "C1",
    order: 3,
    title: "레지스터와 어휘 선택 — 영어의 두 핏줄",
    titleFr: "Register and Word Choice",
    summary: "get과 obtain, ask와 inquire — 영어에는 게르만계와 라틴계라는 두 핏줄이 흐르고, 어느 쪽 단어를 고르느냐가 곧 격식의 온도를 결정해요.",
    duration: "약 11분",
    sections: [
      {
        heading: "1066년, 영어가 이중 언어가 된 날",
        body:
          "영어 어휘의 가장 큰 비밀은 역사에 있어요. 1066년 노르망디 공작 윌리엄이 잉글랜드를 정복한 뒤 **약 300년간 지배층은 프랑스어를, 민중은 영어를** 썼어요. 그 결과 영어에는 같은 뜻의 단어가 **두 벌씩** 생겼습니다.\n\n" +
          "민중의 입에 남은 **게르만계 단어**는 짧고, 일상적이고, 몸에 가까워요: get, ask, buy, start, help. 지배층에서 내려온 **라틴계(프랑스어 경유) 단어**는 길고, 격식 있고, 추상적이에요: obtain, inquire, purchase, commence, assist.\n\n" +
          "유명한 예가 가축과 고기예요. 들판에서 기르는 동물은 영어 농부의 말(cow, pig, sheep)인데, 식탁에 오른 고기는 프랑스 귀족의 말(beef, pork, mutton)이에요. **기르는 자의 언어와 먹는 자의 언어가 달랐던** 역사가 단어에 화석으로 남은 거죠.\n\n" +
          "이 이중 구조를 알면, 단어 선택이 단순한 동의어 고르기가 아니라 **격식의 온도 조절**이라는 게 보이기 시작해요.",
        examples: [
          { en: "The cow becomes beef; the pig becomes pork; the sheep becomes mutton.", ko: "소는 비프가 되고, 돼지는 포크가 되고, 양은 머튼이 된다.", note: "산 동물은 게르만계, 요리된 고기는 프랑스계 — 노르만 정복의 식탁 흔적." },
          { en: "We got the visa. / We obtained the visa.", ko: "비자를 받았어요. / 비자를 취득하였습니다.", note: "같은 사건, 다른 온도 — 한국어 번역의 어감 차이가 정확히 대응해요." },
        ],
        etym: "프랑스어를 배우는 분이라면 이미 눈치챘겠지만 — 영어의 격식어는 사실상 프랑스어예요. commence는 프랑스어 commencer, inquire는 enquérir, purchase는 옛 프랑스어 porchacier(쫓아다니며 구하다)에서 왔어요. 영어 격식 어휘를 늘리는 일은 프랑스어 어휘를 늘리는 일과 절반쯤 겹칩니다.",
      },
      {
        heading: "게르만계 vs 라틴계 — 짝으로 외우는 격식 스위치",
        body:
          "실전 요령은 단어를 낱개가 아니라 **짝으로** 익히는 거예요. 평소형(게르만계)과 격식형(라틴계)을 세트로 갖고 있다가, 상황에 따라 스위치를 올리고 내리는 거죠.\n\n" +
          "쓰임의 직관은 이래요. **말할 때, 친한 사이, 감정을 전할 때**는 게르만계가 자연스럽고 진실하게 들려요. **계약서, 공지, 논문, 고객 응대**에서는 라틴계가 정확하고 전문적으로 들려요. 비행기 안내방송이 좋은 예예요 — 승무원은 We will be commencing our descent shortly라고 하지, We'll start going down soon이라고 하지 않죠.",
        table: {
          caption: "격식 스위치 — 게르만계(평소) ↔ 라틴계(격식)",
          headers: ["평소 (게르만계)", "격식 (라틴계)", "격식형이 어울리는 자리"],
          rows: [
            ["get", "obtain / acquire", "서류·자격·허가"],
            ["ask", "inquire / request", "문의·공식 요청"],
            ["buy", "purchase", "영수증·계약"],
            ["start", "commence", "공식 일정·법률문"],
            ["end", "terminate / conclude", "계약 해지·행사 종료"],
            ["help", "assist / facilitate", "고객 응대·공문"],
            ["show", "demonstrate / indicate", "논문·데이터 서술"],
            ["need", "require", "규정·요건"],
            ["think about", "consider", "공식 검토"],
            ["enough", "sufficient", "보고서·평가"],
          ],
        },
        examples: [
          { en: "Could I ask a question? / I would like to inquire about the status of my application.", ko: "질문 하나 해도 될까요? / 제 지원서의 진행 상황을 문의드리고자 합니다.", note: "구어 대화 vs 공식 이메일." },
          { en: "The event will commence at 7 p.m. and conclude at 10 p.m.", ko: "행사는 오후 7시에 시작하여 10시에 종료됩니다.", note: "초대장의 언어 — start/end로 바꾸면 격식이 무너져요." },
        ],
        vsKo: "한국어의 고유어/한자어 이중 구조와 정확히 평행해요 — '돕다/조력하다', '사다/구매하다', '끝내다/종료하다'. 한국어에서 한자어가 격식을 만들 듯, 영어에서는 라틴계가 격식을 만들어요. 여러분은 이 감각을 모어로 이미 갖고 있으니, '이 자리에 한자어를 쓸까 고유어를 쓸까'라는 익숙한 질문을 영어에 그대로 적용하면 됩니다.",
      },
      {
        heading: "구동사 vs 라틴 동사 — put off와 postpone",
        body:
          "이중 구조의 또 다른 전선이 **구동사(phrasal verbs)**예요. 게르만계 동사 + 부사·전치사 조합(put off, find out, look into)은 거의 모두 라틴계 한 단어 동사(postpone, discover, investigate)와 짝을 이뤄요.\n\n" +
          "여기서 한국 학습자의 고질적인 **역전 현상**이 일어나요. 시험 영어로 단련된 학습자는 postpone, investigate 같은 라틴계 단어가 오히려 편하고, put off, look into 같은 구동사가 어려워요. 그 결과 **친구와의 수다에서 논문 어휘를 쓰는** 부자연스러움이 생기죠. Let's postpone our dinner는 문법적으로 완벽하지만, 친구 사이라면 Let's put it off till next week가 자연스러워요.\n\n" +
          "원칙: **회화의 기본값은 구동사, 격식문의 기본값은 라틴 동사.** C1의 과제는 어려운 단어를 더 배우는 게 아니라, 이미 아는 쉬운 단어를 제자리에 돌려놓는 것이에요.",
        examples: [
          { en: "Sorry, I have to put off our meeting. / The committee has decided to postpone the vote.", ko: "미안, 우리 약속 미뤄야 할 것 같아. / 위원회는 표결을 연기하기로 결정하였다.", note: "메시지 vs 공식 발표." },
          { en: "Can you look into it? / We will investigate the matter thoroughly.", ko: "그것 좀 알아봐 줄래? / 해당 사안을 철저히 조사하겠습니다.", note: "동료 부탁 vs 회사 공식 입장문." },
          { en: "We found out the truth. / The inquiry revealed the truth.", ko: "우리는 진실을 알아냈다. / 조사 결과 진실이 드러났다.", note: "체감 온도가 완전히 달라요." },
        ],
        pitfall: "한국 학습자의 영어가 '딱딱하다'는 평을 듣는 최대 원인이 바로 이 역전이에요. 수능·토플 어휘(라틴계)는 강한데 생활 구동사(게르만계)가 약해서, 일상 대화가 공문서처럼 들리는 거죠. 원어민 평가는 냉정해요 — 격식 자리의 쉬운 단어는 '소탈하다'로 봐주지만, 일상 자리의 격식 단어는 '어색하다'로 읽힙니다. 구동사를 '비격식 속어'가 아니라 '회화의 표준어'로 재인식하세요.",
      },
      {
        heading: "격식 스펙트럼 실전 — 같은 용건, 세 가지 옷",
        body:
          "마무리로 같은 용건을 세 가지 격식으로 입혀볼게요. 용건: '회신이 늦었다, 다음 주에 보자.'\n\n" +
          "**캐주얼 (친구)**: Sorry for the late reply! Wanna meet up next week?\n" +
          "**중립 (동료)**: Sorry for the slow reply — could we meet sometime next week?\n" +
          "**격식 (외부 고객)**: I apologize for the delayed response. Would it be possible to arrange a meeting next week?\n\n" +
          "보이시죠 — 문법이 아니라 **어휘의 핏줄이 바뀌어요**. sorry→apologize, late reply→delayed response, meet up→arrange a meeting. 격식이 올라갈수록 라틴계 비중이 커지고 문장이 길어집니다.\n\n" +
          "단, 영어의 격식은 **상하 관계가 아니라 거리의 함수**라는 점을 기억하세요. 직급이 높아도 가까우면 캐주얼하게, 직급이 낮아도 처음 보는 외부인이면 격식 있게 — 한국어 존댓말이 '위아래'를 재는 동안, 영어 레지스터는 '멀고 가까움'을 잽니다.",
        examples: [
          { en: "Hey, got a sec? — Do you have a moment? — I was wondering if you might have a moment to discuss the proposal.", ko: "야, 잠깐 시간 돼? — 잠시 시간 괜찮으세요? — 제안서 논의를 위해 잠시 시간을 내주실 수 있을지 여쭙니다.", note: "같은 부탁의 3단 변속." },
          { en: "Thanks a lot! — Thank you for your help. — I greatly appreciate your assistance in this matter.", ko: "정말 고마워! — 도와주셔서 감사합니다. — 이 건에 대한 귀하의 조력에 깊이 감사드립니다.", note: "thank(게르만) → appreciate(라틴), help(게르만) → assistance(라틴)." },
        ],
        tip: "글을 쓸 때 격식이 헷갈리면 '받는 사람이 내 문장을 소리 내어 읽는 장면'을 상상하세요. 변호사가 읽어도 어색하지 않으면 라틴계로, 친구가 읽고 웃을 것 같으면 게르만계로. 그리고 한 문서 안에서는 온도를 통일하세요 — commence로 시작한 공문에 wanna가 나오는 순간 전체 신뢰가 무너집니다.",
      },
    ],
  },

  {
    slug: "c1-04-cleft-information",
    level: "C1",
    order: 4,
    title: "정보구조와 분열문 — 영어의 강조는 어순 조작",
    titleFr: "Cleft Sentences and Information Structure",
    summary: "한국어가 '은/는'과 어순으로 하는 일을, 영어는 it-cleft, what-cleft, 도치로 해요. 문장을 쪼개고 비틀어 스포트라이트를 옮기는 기술입니다.",
    duration: "약 11분",
    sections: [
      {
        heading: "정보구조 — 문장에는 스포트라이트가 있다",
        body:
          "문법적으로 완벽한데 어딘가 흐름이 어색한 영어 — 원인은 대개 **정보구조(information structure)**예요. 모든 문장에는 **이미 아는 정보(구정보)**와 **새로 전하는 정보(신정보)**가 있고, 영어의 기본 설계는 **구정보를 앞에, 신정보를 뒤에** 놓는 거예요. 문장 끝이 스포트라이트 자리인 셈이죠(end-focus 원칙).\n\n" +
          "문제는 영어의 어순이 SVO로 단단히 고정되어 있다는 것. 한국어처럼 조사를 믿고 단어를 자유롭게 옮길 수 없어요. 그래서 영어는 **문장 구조 자체를 바꾸는 장치들**을 발달시켰어요 — 문장을 둘로 쪼개는 분열문(cleft), 목적어를 앞으로 끌어내는 전치(fronting), 주어와 동사를 뒤집는 도치(inversion).\n\n" +
          "말로 할 때는 강세 하나로 강조할 수 있지만(I lent him the BOOK), **글에는 강세가 없어요**. 그래서 격식 글일수록 이 구조 장치들이 중요해집니다.",
        examples: [
          { en: "A: Who broke the printer? — B: Tom broke it. (TOM에 강세)", ko: "A: 누가 프린터를 망가뜨렸어? — B: 톰이 그랬어.", note: "말에서는 강세로 충분하지만—" },
          { en: "It was Tom who broke the printer.", ko: "프린터를 망가뜨린 건 (다름 아닌) 톰이었다.", note: "글에서는 구조로 강세를 만들어요. 이것이 분열문." },
        ],
        vsKo: "한국어는 이 작업을 조사로 해요. '톰이 프린터를 망가뜨렸다'(중립) vs '프린터는 톰이 망가뜨렸다'(주제-초점 재배치). '은/는'이 구정보·주제를 표시하고 '이/가'가 신정보·초점을 표시하니, 어순까지 자유롭죠. 영어에는 이 조사가 없어서 **구조 수술**로 같은 효과를 내는 거예요. '은/는을 어순 조작으로 번역한다'고 생각하면 분열문의 존재 이유가 단번에 이해됩니다.",
      },
      {
        heading: "it-cleft — It was Tom who broke it",
        body:
          "**It is/was + 초점 + that/who + 나머지** — 문장을 둘로 쪼개(cleave) 초점만 스포트라이트 자리에 올리는 구문이에요. 핵심 뉘앙스는 **대조와 배타**: '다른 누구도 아닌 바로 X'라는 함의가 실려요.\n\n" +
          "원문 Tom broke the printer yesterday에서 무엇이든 초점으로 끌어올릴 수 있어요.\n\n" +
          "**주어 초점**: It was Tom who broke the printer. (앤이 아니라)\n" +
          "**목적어 초점**: It was the printer that Tom broke. (스캐너가 아니라)\n" +
          "**부사어 초점**: It was yesterday that Tom broke it. (오늘이 아니라)\n\n" +
          "이 '바로 그것' 함의 때문에 it-cleft는 **반박과 정정**에 특히 강해요. 또 학술문에서는 It is this gap that the present study addresses(본 연구가 다루는 것이 바로 이 공백이다)처럼 연구의 초점을 선언하는 데 애용됩니다.",
        examples: [
          { en: "It was the timing, not the idea, that doomed the project.", ko: "프로젝트를 망친 건 아이디어가 아니라 타이밍이었다.", note: "대조를 문장 구조에 새겼어요." },
          { en: "It was only after the merger that the problems began to surface.", ko: "문제가 드러나기 시작한 것은 합병 이후에야였다.", note: "시간 부사구 초점 — 격식문 단골." },
          { en: "It is precisely this assumption that I want to challenge.", ko: "내가 문제 삼고 싶은 것이 바로 이 전제다.", note: "학술 토론의 창끝 — precisely가 초점을 더 조여요." },
        ],
        pitfall: "it-cleft를 가주어 it 구문과 혼동하지 마세요. It is important that he came(가주어 — important는 형용사 보어)과 It was yesterday that he came(분열문 — yesterday가 초점)은 구조가 달라요. 판별법: that 이하를 초점 자리에 도로 끼워 완전한 문장이 되면 분열문이에요(He came yesterday ○). 독해 시험과 번역에서 이 둘을 가르는 문제가 자주 나옵니다.",
      },
      {
        heading: "what-cleft — What we need is time",
        body:
          "**What + 구정보 + is/was + 신정보** — wh-절을 주어로 세우는 의사분열문(pseudo-cleft)이에요. it-cleft가 '바로 그것'이라며 찌르는 느낌이라면, what-cleft는 **뜸을 들여 기대를 만든 뒤 답을 공개하는** 느낌이에요. 문장 전체가 '질문 → 답'의 미니 드라마가 되죠.\n\n" +
          "그래서 it-cleft보다 회화에서 훨씬 자주 들려요. What I'm trying to say is...(내 말의 요지는), What bothers me is...(내가 거슬리는 건), What happened was...(무슨 일이 있었냐면) — 모두 입말의 단골 서두예요.\n\n" +
          "변형도 알아두세요. **All + 절**은 '오직 그것뿐'이라는 최소화 초점이에요: All we need is one more week(필요한 건 딱 일주일뿐). 역방향 배치(Time is what we need)도 가능합니다.",
        examples: [
          { en: "What this company lacks is not talent but direction.", ko: "이 회사에 부족한 것은 인재가 아니라 방향이다.", note: "뜸 들이기 → 공개. 프레젠테이션의 한 방." },
          { en: "What I'm trying to say is that we're running out of time.", ko: "제가 드리려는 말씀은, 우리에게 시간이 없다는 겁니다.", note: "회화에서 요점 정리의 표준 서두." },
          { en: "All I'm asking for is a little patience.", ko: "제가 부탁드리는 건 약간의 인내심, 그것뿐이에요.", note: "all-cleft = '겨우 이것뿐' 최소화 효과." },
          { en: "What happened was the server crashed during the demo.", ko: "무슨 일이 있었냐면, 시연 도중에 서버가 죽었어요.", note: "사건 보고를 여는 구어 공식." },
        ],
        tip: "수일치 주의 — what절 주어는 원칙적으로 단수 취급이에요: What we need is more engineers(복수 명사가 와도 is가 표준, 구어에선 are도 들림). 그리고 발표에서는 what-cleft 직후에 0.5초 멈추세요. What this data shows is — (멈춤) — a complete reversal of the trend. 구조가 만들어준 긴장을 침묵으로 한 번 더 증폭하는 거예요.",
      },
      {
        heading: "전치와 도치 — Never have I seen such a mess",
        body:
          "분열문 없이 어순만 비트는 장치도 있어요.\n\n" +
          "**전치(fronting)** — 목적어·보어를 문두로 끌어내는 것. This I know for certain(이것만은 확실히 안다), That much is clear(그 정도는 분명하다). 끌어낸 요소가 주제가 되면서 문장에 무게가 실려요. 문학·연설 톤이라 남발하면 부담스럽지만, 결정적인 한 문장에는 효과적이에요.\n\n" +
          "**부정어 도치(negative inversion)** — never, rarely, not only, under no circumstances 같은 부정·제한 부사가 문두에 오면 **주어와 조동사가 의문문처럼 도치**돼요. Never have I seen..., Not only did he resign, but... 격식문과 연설의 대표 장치로, '강조 기어'를 한 단 올리는 효과예요.\n\n" +
          "**장소구 도치**도 있어요 — 무대 지시처럼 장소를 먼저 깔고 주어를 뒤로: On the hill stood an old church. 묘사문·소설 문체의 향기가 나죠. 신정보(주어)를 문장 끝 스포트라이트로 보내는, end-focus 원칙의 정석적 응용이에요.",
        examples: [
          { en: "Never in my career have I seen such a complete failure of oversight.", ko: "내 경력을 통틀어 이토록 총체적인 감독 부실은 본 적이 없다.", note: "have I — 의문문형 도치. 청문회·사설의 톤." },
          { en: "Not only did the policy fail, but it made the problem worse.", ko: "그 정책은 실패했을 뿐 아니라 문제를 오히려 악화시켰다.", note: "not only 문두 = did 도치 필수." },
          { en: "Under no circumstances should this document leave the building.", ko: "어떤 경우에도 이 문서가 건물 밖으로 나가서는 안 된다.", note: "보안 규정·계약서의 최고 강도 금지문." },
          { en: "At the end of the corridor stood a single locked door.", ko: "복도 끝에는 잠긴 문 하나가 서 있었다.", note: "장소구 도치 — 소설의 카메라워크." },
        ],
        pitfall: "부정어 도치에서 도치를 빼먹는 게 단골 실수예요 — Never I have seen(X) → Never have I seen(○). 반대로 평범한 이메일에 도치를 쓰는 과잉도 문제예요. Not only did I attach the file...은 첨부파일 안내치고 너무 비장하죠. 도치는 연설·사설·강한 경고용 '예복'이라, 평상복 자리에 입고 나가면 어색합니다.",
      },
    ],
  },

  {
    slug: "c1-05-idioms-metaphor",
    level: "C1",
    order: 5,
    title: "관용구와 은유 체계 — TIME IS MONEY의 세계",
    titleFr: "Idioms and Conceptual Metaphor",
    summary: "영어 관용구는 무작위 암기 대상이 아니라 개념적 은유라는 지도 위에 놓여 있어요. 한국어와 겹치는 지점, 어긋나는 지점을 짚으면 통째로 보입니다.",
    duration: "약 10분",
    sections: [
      {
        heading: "개념적 은유 — 관용구에는 지도가 있다",
        body:
          "spend time, waste time, save time, invest time — 시간에 관한 영어 동사들이 전부 **돈 동사**라는 걸 눈치채셨나요? 우연이 아니에요. 인지언어학자 레이코프(Lakoff)와 존슨(Johnson)은 「Metaphors We Live By」(1980)에서 이를 **개념적 은유(conceptual metaphor)**라고 불렀어요 — 한 영역(시간)을 다른 영역(돈)의 논리로 통째로 이해하는 사고의 틀이죠.\n\n" +
          "**TIME IS MONEY**(시간은 돈이다)라는 은유 하나가 수십 개의 표현을 낳아요. 시간을 쓰고(spend), 아끼고(save), 빌리고(borrow), 누군가에게 시간을 '지불'할 가치가 있는지(worth your time) 따지죠.\n\n" +
          "이게 학습자에게 중요한 이유 — 관용구를 낱개로 외우면 수천 개의 무작위 암기지만, **은유 체계로 묶으면 수십 개의 지도**가 돼요. 새 표현을 만나도 '아, TIME IS MONEY 계열이구나' 하고 뜻을 추론할 수 있게 됩니다.",
        examples: [
          { en: "Thanks for your time — I know it's valuable.", ko: "시간 내주셔서 감사해요 — 귀한 시간인 거 알아요.", note: "시간이 '가치 있는 자산'으로 개념화돼 있어요." },
          { en: "We're running out of time. Let's not waste it on details.", ko: "시간이 떨어져 가요. 세부 사항에 낭비하지 맙시다.", note: "run out(고갈되다), waste(낭비하다) — 전부 자원의 어휘." },
          { en: "I've invested three years in this project.", ko: "이 프로젝트에 3년을 투자했어요.", note: "투자했으니 '수익(결실)'을 기대하는 함의까지 따라와요." },
        ],
        tip: "새 관용구를 만나면 '어느 은유 가족인가'를 먼저 물어보세요. 사전에 표현을 하나 추가하는 게 아니라 지도에 마을을 하나 추가하는 방식 — C1 어휘 학습의 가성비가 완전히 달라집니다.",
      },
      {
        heading: "큰 은유 가족들 — 논쟁은 전쟁, 인생은 여행, 위는 좋음",
        body:
          "영어 담화를 지배하는 대표 은유 가족을 더 소개할게요.\n\n" +
          "**ARGUMENT IS WAR(논쟁은 전쟁)** — 주장을 방어하고(defend), 약점을 공격하고(attack), 논리를 격추하고(shoot down), 진지를 사수해요(stand one's ground). 영어 토론 문화의 뼈대가 이 은유 위에 서 있어요.\n\n" +
          "**LIFE IS A JOURNEY(인생은 여행)** — 갈림길에 서고(at a crossroads), 길을 잃고(lost), 짐을 지고(baggage), 먼 길을 왔어요(come a long way).\n\n" +
          "**UP IS GOOD / DOWN IS BAD(위는 좋음, 아래는 나쁨)** — 기분이 뜨고(things are looking up), 가라앉고(feeling down), 경기가 살아나고(upturn), 침체해요(downturn).\n\n" +
          "**IDEAS ARE FOOD(생각은 음식)** — 생각을 소화하고(digest), 곱씹고(chew on), 날것의 데이터(raw data)를 다듬어요. 설익은 생각은 half-baked idea죠.",
        examples: [
          { en: "She shot down every objection and stood her ground.", ko: "그녀는 모든 반론을 격추하고 자기 입장을 사수했다.", note: "ARGUMENT IS WAR — 토론 기사 한 줄에 전쟁 어휘가 두 개." },
          { en: "After the scandal, his career is at a crossroads.", ko: "스캔들 이후 그의 경력은 갈림길에 서 있다.", note: "LIFE IS A JOURNEY." },
          { en: "Give me a day to digest the proposal — it's a lot to chew on.", ko: "제안서를 소화할 시간을 하루 주세요 — 곱씹을 게 많네요.", note: "IDEAS ARE FOOD." },
          { en: "Sales are looking up after two quarters of decline.", ko: "두 분기 하락 끝에 매출이 살아나고 있다.", note: "UP IS GOOD — 경제 기사 문체의 기본값." },
        ],
        etym: "metaphor는 그리스어 metapherein(meta 너머로 + pherein 나르다), 즉 '뜻을 다른 곳으로 실어 나르기'예요. 재미있게도 현대 그리스에서는 이삿짐 트럭에 metaphora(운송)라고 적혀 있어요 — 은유라는 단어 자체가 은유인 셈이죠. transfer(라틴어 trans+ferre)와 정확히 같은 구조의 단어예요.",
      },
      {
        heading: "한국어와 겹치는 것, 어긋나는 것",
        body:
          "좋은 소식: 큰 은유는 인간 보편이라 **한국어와 겹치는 게 많아요**. '시간을 아끼다/낭비하다', '주장을 방어하다', '기분이 가라앉다' — TIME IS MONEY, ARGUMENT IS WAR, DOWN IS BAD가 한국어에도 그대로 있죠. 이런 표현은 사실상 무료로 얻고 들어가는 거예요.\n\n" +
          "위험한 건 **비슷한데 어긋나는** 지점이에요. 같은 신체 부위로 다른 뜻을 만들거나, 한국어 직역이 영어에서 통하지 않는 경우죠. '눈이 높다'를 직역한 Her eyes are high는 의미 불명이고, 영어로는 She has high standards예요. 반대로 영어 pull one's leg(놀리다)를 '다리를 잡아당기다'로 직역하면 한국어에선 아무 관용 의미가 없죠.\n\n" +
          "특히 **신체 은유**가 어긋남의 최대 산지예요. 한국어는 '마음'이 가슴과 머리 사이 어딘가에 있는 추상 기관이지만, 영어는 감정은 heart, 이성은 head/mind로 분업이 명확해요. '마음에 들다'가 상황 따라 like(호감)도 되고 suit(적합)도 되는 이유예요.",
        table: {
          caption: "한–영 관용구 대조 — 겹침과 어긋남",
          headers: ["한국어", "직역하면", "실제 영어", "판정"],
          rows: [
            ["시간을 낭비하다", "waste time", "waste time", "겹침 — 그대로 통함"],
            ["입이 무겁다", "have a heavy mouth", "tight-lipped / can keep a secret", "어긋남"],
            ["눈이 높다", "have high eyes", "have high standards", "어긋남"],
            ["손이 크다", "have big hands", "be generous (with food/money)", "어긋남"],
            ["발이 넓다", "have wide feet", "well-connected / know everyone", "어긋남"],
            ["식은 죽 먹기", "eating cold porridge", "a piece of cake", "구조는 같음(쉬움=쉬운 음식), 재료만 다름"],
            ["귀가 얇다", "have thin ears", "easily swayed / gullible", "어긋남"],
          ],
        },
        examples: [
          { en: "Passing the test was a piece of cake.", ko: "시험 통과는 식은 죽 먹기였어.", note: "'쉬운 일 = 먹기 쉬운 음식'이라는 은유 구조는 두 언어가 같아요 — 케이크냐 식은 죽이냐만 달라요." },
          { en: "He knows everyone in the industry — he's incredibly well-connected.", ko: "그는 업계에서 발이 정말 넓어요.", note: "'발이 넓다'의 영어는 발이 아니라 연결망 은유." },
        ],
        vsKo: "어긋남의 패턴에도 결이 있어요. 한국어 신체 관용구는 신체 부위의 '크기·무게·온도'로 성격을 그리는 경향이 있고(입이 무겁다, 손이 크다, 귀가 얇다), 영어는 신체를 '행위·소유' 프레임으로 써요(keep an eye on, have a hand in, all ears). 한국어 관용구를 영어로 옮길 땐 부위가 아니라 **기능**을 번역하세요 — '귀가 얇다'의 기능은 '쉽게 설득됨'이니 easily swayed.",
      },
      {
        heading: "관용구 운용법 — 아는 것과 쓰는 것 사이",
        body:
          "마지막으로 솔직한 운용 가이드예요. C1 학습자에게 관용구의 일차 목표는 **수신(듣고 읽고 알아채기)**이지 송신이 아니에요.\n\n" +
          "이유는 셋. 첫째, 관용구는 **형태가 얼어붙어** 있어서 한 단어만 바꿔도 깨져요 — a piece of cake를 a slice of cake라고 하면 그냥 케이크 한 조각이에요. 둘째, **세대·지역 코드**가 강해요. It's raining cats and dogs는 교과서 단골이지만 실제 젊은 화자는 거의 안 쓰고, 들으면 살짝 옛날 말투로 느껴져요. 셋째, 격식 불일치 — 보고서에 over the moon(너무 신나는)을 쓰면 옷을 잘못 입은 거예요.\n\n" +
          "안전한 송신 전략: **빈도 높고 격식 중립적인 것부터** 손에 익히세요. make sense, in the long run, on the same page, the bottom line — 이런 '회색 지대' 표현은 회의에서도 수다에서도 안전해요. 화려한 것(kick the bucket, spill the beans)은 알아듣는 걸로 충분합니다.",
        examples: [
          { en: "That makes sense. Let's make sure we're all on the same page before we move on.", ko: "말이 되네요. 넘어가기 전에 우리 모두 같은 그림을 보고 있는지 확인합시다.", note: "비즈니스 안전권 관용구 2연속 — 어디서나 통해요." },
          { en: "The bottom line is, we can't afford another delay.", ko: "결론은, 더 이상의 지연은 감당할 수 없다는 겁니다.", note: "bottom line = 회계 장부 맨 아랫줄(순이익) — 비즈니스 은유 출신." },
          { en: "In the long run, investing in training pays off.", ko: "길게 보면 교육에 대한 투자는 보상으로 돌아온다.", note: "pay off까지 — TIME IS MONEY 가족이 격식문에서도 일하는 모습." },
        ],
        pitfall: "관용구 남용은 부족보다 위험해요. 원어민도 한 문단에 관용구를 두세 개씩 쓰지 않습니다. 특히 막 외운 표현을 시험해보고 싶은 욕심에 어색한 자리에 끼워 넣으면, '교과서를 외워 온 사람'이라는 인상만 남아요. 처음 쓰는 관용구는 반드시 원어민이 그 상황에서 쓰는 걸 두 번 이상 목격한 후에 따라 하세요.",
      },
    ],
  },

  {
    slug: "c1-06-academic-writing",
    level: "C1",
    order: 6,
    title: "학술 영어 — 명사화, 수동태, 객관화의 문법",
    titleFr: "Academic English",
    summary: "논문과 보고서의 영어는 별개의 방언이에요. 명사화로 압축하고, 수동태로 시선을 옮기고, 객관화 장치로 '나'를 지우는 — 학술 문체의 기계장치를 분해해봅니다.",
    duration: "약 12분",
    sections: [
      {
        heading: "학술 문체의 3원칙 — 압축, 탈인격, 신중함",
        body:
          "학술 영어(academic English)는 사실상 별도의 방언이에요. 원어민도 대학에서 따로 훈련받아야 쓸 수 있죠. 지배 원리는 세 가지예요.\n\n" +
          "**① 압축(density)** — 같은 내용을 더 적은 절(clause)에 담아요. 구어가 동사 중심의 긴 사슬이라면, 학술문은 명사 중심의 밀도 높은 덩어리예요.\n\n" +
          "**② 탈인격(impersonality)** — 행위자보다 행위·결과를 앞세워요. I found that... 대신 The results indicate that...로, '나'의 주관이 아니라 데이터가 말하는 형식을 취해요.\n\n" +
          "**③ 신중함(caution)** — 2챕터에서 배운 헤징이 전면 가동돼요. prove 대신 suggest, always 대신 typically.\n\n" +
          "이 세 원칙을 구현하는 기계장치가 **명사화, 수동태, 객관화 구문**이에요. 이제 하나씩 분해해볼게요.",
        examples: [
          { en: "We looked at how people behave when prices go up. → This study examines consumer behavior under rising prices.", ko: "우리는 가격이 오를 때 사람들이 어떻게 행동하는지 살펴봤다. → 본 연구는 물가 상승 하의 소비자 행동을 고찰한다.", note: "절 3개 → 절 1개. 같은 내용, 학술적 밀도." },
          { en: "I think this is wrong. → This interpretation is open to question.", ko: "내 생각엔 이건 틀렸다. → 이 해석은 의문의 여지가 있다.", note: "'나'를 지우고 비판의 강도도 낮춘 이중 변환." },
        ],
        vsKo: "한국어 논문 문체('-된다', '-로 사료된다', '고찰하였다')에 익숙하다면 큰 자산이에요 — 탈인격·신중함의 감각이 그대로 통하거든요. 다만 차이가 하나 있어요. 한국 논문의 '본 연구자는'식 겸양과 달리, 영어 학술문은 최근 **I/we를 점점 허용하는 추세**예요(특히 사회과학·인문학). We argue that...은 이제 표준이에요. '무조건 나를 숨겨야 한다'는 옛 규칙으로 과잉 교정하지 마세요 — 분야의 최신 논문 서너 편을 보고 그 분야의 관행을 따르는 게 정답입니다.",
      },
      {
        heading: "명사화 — 동사를 명사로 접는 기술",
        body:
          "**명사화(nominalization)**는 동사·형용사를 명사로 바꿔 절을 구로 접는 기술이에요. analyze→analysis, fail→failure, significant→significance.\n\n" +
          "왜 접을까요? 첫째, **압축** — The economy grew rapidly. This surprised analysts. 두 문장이 The rapid growth of the economy surprised analysts. 한 문장이 돼요. 둘째, **담화의 연결** — 앞 문장의 내용을 명사 하나로 받아서 다음 문장의 주어로 쓸 수 있어요. 셋째, **측정 가능한 대상화** — '실패했다'는 사건이지만 the failure rate(실패율)는 측정하고 비교할 수 있는 변수가 되죠.\n\n" +
          "다만 명사화는 양날의 검이에요. 과하면 문장이 관료적 안개가 됩니다. The implementation of the utilization of...(활용의 실행은...) 같은 문장은 학술이 아니라 그냥 나쁜 글이에요. 영어 글쓰기 교본들이 'zombie nouns(좀비 명사)'라고 비판하는 게 바로 이 과잉 명사화예요. 원칙: **개념을 다루거나 앞 내용을 받을 때만 명사화하고, 행위를 서술할 땐 동사로**.",
        table: {
          caption: "명사화 변환표 — 구어절 → 학술구",
          headers: ["구어 (동사 중심)", "학술 (명사 중심)"],
          rows: [
            ["because the company failed to comply", "due to the company's failure to comply"],
            ["when we analyzed the data", "the analysis of the data"],
            ["The policy changed, and this confused people.", "The policy change caused confusion."],
            ["if demand grows fast", "in the event of rapid demand growth"],
            ["The two groups differ significantly.", "a significant difference between the two groups"],
          ],
        },
        examples: [
          { en: "Prices rose sharply in 2024. This increase eroded household savings.", ko: "2024년 물가가 급등했다. 이 상승은 가계 저축을 잠식했다.", note: "앞 문장 전체를 This increase 한 덩어리로 받았어요 — 명사화의 담화 연결 기능." },
          { en: "The failure of the negotiations led to a six-month delay.", ko: "협상 결렬은 6개월의 지연으로 이어졌다.", note: "negotiations failed → the failure of the negotiations. 사건이 주어가 됐어요." },
        ],
        etym: "명사화 어미만 알아도 라틴계 어휘가 체계로 보여요. -tion(act→action), -ment(develop→development), -ance/-ence(signify→significance), -ity(valid→validity), -al(arrive→arrival). 전부 라틴어 명사 어미의 후손으로, 프랑스어를 거쳐 영어에 들어왔어요. 3챕터의 격식 어휘 이중 구조와 정확히 같은 핏줄이죠.",
      },
      {
        heading: "수동태 운용 — 언제 쓰고 언제 버리나",
        body:
          "'학술문은 수동태'라는 낡은 공식부터 버릴게요. 진짜 규칙은 **수동태는 시선 이동 장치**라는 거예요. 능동태는 행위자를, 수동태는 대상·과정을 카메라 중앙에 놓아요.\n\n" +
          "**수동태가 정답인 자리**\n" +
          "① 행위자가 뻔하거나 무의미할 때 — 실험 방법 서술: The samples were heated to 80°C. (누가 가열했는지는 정보 가치가 없죠.)\n" +
          "② 대상이 담화의 주제일 때 — 앞 문장에서 말한 대상을 주어로 이어받을 때.\n" +
          "③ 행위자를 전략적으로 숨길 때 — Mistakes were made.(실수가 있었다) 같은 책임 회피 화법. 정치 담화의 고전이에요.\n\n" +
          "**능동태가 정답인 자리**\n" +
          "① 주장을 펼 때 — We argue that...이 It is argued by us that...보다 명확하고 힘 있어요.\n" +
          "② 행위자가 핵심 정보일 때.\n\n" +
          "최신 학술지 투고 규정(Nature, APA 스타일 등)은 오히려 **명확성을 위해 능동태를 권장**해요. 현대 학술문의 실제 모습은 '방법은 수동, 주장은 능동'의 혼합이에요.",
        examples: [
          { en: "Data were collected over a six-month period and analyzed using regression models.", ko: "데이터는 6개월에 걸쳐 수집되었고 회귀 모형으로 분석되었다.", note: "방법 서술 — 행위자(연구자)는 정보 가치 0이므로 수동." },
          { en: "We argue that this framework overlooks informal labor.", ko: "우리는 이 틀이 비공식 노동을 간과한다고 주장한다.", note: "주장 — 능동으로 책임을 명시하는 게 현대 표준." },
          { en: "The hypothesis was first proposed by Kim (2019) and has since been tested in various contexts.", ko: "이 가설은 Kim(2019)이 처음 제안했으며 이후 다양한 맥락에서 검증되어 왔다.", note: "가설이 담화의 주인공이라 수동 — by구로 출처는 보존." },
          { en: "Mistakes were made, and lessons have been learned.", ko: "실수가 있었고, 교훈을 얻었습니다.", note: "행위자 실종 — 기업 사과문의 고전적(이고 악명 높은) 수동태." },
        ],
        pitfall: "한국 학습자의 수동태 문제는 둘 다예요 — 회화에선 안 써서 문제, 논문에선 너무 써서 문제. 특히 '학술문 = 전부 수동태'로 배운 세대는 It is thought by the author that...같은 괴물 문장을 만들어요. 판별 질문은 하나: **이 문장에서 독자가 알아야 할 주인공이 행위자인가, 대상인가?** 주인공을 주어 자리에 앉히면 태는 자동으로 정해집니다.",
      },
      {
        heading: "객관화 장치 — '나'를 지우는 문형들",
        body:
          "학술문이 주관적 의견을 객관적 진술처럼 들리게 만드는 정형 문형들을 모아볼게요. 전부 통째로 쓰는 공식이에요.\n\n" +
          "**가주어 it 구문** — It is widely accepted that...(널리 받아들여진다), It could be argued that...(~라고 주장할 수도 있다), It remains unclear whether...(~인지는 불분명하다). 의견의 출처를 익명화해요.\n\n" +
          "**무생물 주어** — 데이터·결과·표가 말하게 해요: The findings suggest..., Table 2 shows..., This evidence points to... 연구자의 해석을 증거의 발언으로 바꾸는 장치예요.\n\n" +
          "**There is 구문** — There is growing evidence that...(~라는 증거가 늘고 있다), There appears to be a correlation...(상관이 있는 것으로 보인다).\n\n" +
          "**양보 선행 구문** — 반론을 먼저 인정하고 재반박해요: While it is true that X, it does not follow that Y.(X가 사실이긴 하지만, 그렇다고 Y가 따라 나오는 것은 아니다.) 학술 논증의 가장 세련된 무기예요.",
        examples: [
          { en: "It is widely accepted that early intervention improves outcomes; however, the evidence for adults remains limited.", ko: "조기 개입이 결과를 개선한다는 것은 널리 받아들여지지만, 성인 대상 증거는 여전히 제한적이다.", note: "통설 인정 → 공백 지적. 서론(Introduction)의 표준 리듬." },
          { en: "The findings suggest a strong association, although causality cannot be established from this design.", ko: "결과는 강한 연관성을 시사하나, 본 설계로는 인과관계를 확정할 수 없다.", note: "무생물 주어 + 한계 명시 — 심사자가 좋아하는 한 문장." },
          { en: "While it is true that the sample was small, the effect size was consistent across all subgroups.", ko: "표본이 작았던 것은 사실이지만, 효과 크기는 모든 하위 집단에서 일관되게 나타났다.", note: "예상 비판을 선점하는 양보 구문." },
          { en: "Further research is needed to confirm these preliminary results.", ko: "이 예비적 결과를 확증하기 위해서는 후속 연구가 필요하다.", note: "결론부의 만국 공통 마무리 공식." },
        ],
        tip: "학술 문형은 분야별 '말뭉치'에서 훔치는 게 정석이에요. 자기 분야 논문 10편에서 서론·결론의 문형만 발췌해 개인 문형집을 만들어 보세요. Manchester Academic Phrasebank처럼 공개된 학술 문형 은행도 좋은 출발점이에요. 학술 영어는 창작이 아니라 **관습의 정확한 재사용**이라는 점 — 이게 이 챕터의 결론입니다.",
      },
    ],
  },
];
