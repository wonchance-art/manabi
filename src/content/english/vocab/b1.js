const themes = {
  level: "B1",
  title: "B1 중급 어휘",
  desc: "직장·의견·기술·관계 — 일상 회화를 한 단계 끌어올리는 170개. 빈출 구동사와 형용사 뉘앙스까지 챙겨요.",
  themes: [
    {
      name: "일과 직장",
      icon: "💼",
      words: [
        {
          en: "apply", ipa: "[əˈplaɪ]", ko: "지원하다, 신청하다", pos: "v.",
          etym: "라틴어 ad+plicare(접어 붙이다) — '자신을 갖다 붙이다'. application(지원서)도 같은 뿌리예요.",
          ex: { en: "I applied for the job last week.", ko: "지난주에 그 일자리에 지원했어요." },
        },
        {
          en: "interview", ipa: "[ˈɪntərvjuː]", ko: "면접, 인터뷰", pos: "n.",
          etym: "inter(사이)+view(보다) — '서로 마주 보기'라는 뜻이에요.",
          ex: { en: "I have a job interview next Tuesday.", ko: "다음 주 화요일에 면접이 있어요." },
        },
        {
          en: "salary", ipa: "[ˈsæləri]", ko: "월급, 급여", pos: "n.",
          etym: "라틴어 salarium — 로마 병사에게 소금(sal) 살 돈을 주던 데서 왔어요.",
          ex: { en: "The salary is good, but the hours are long.", ko: "월급은 괜찮은데 근무 시간이 길어요." },
        },
        {
          en: "colleague", ipa: "[ˈkɑːliːɡ]", ko: "동료", pos: "n.",
          ex: { en: "I get along well with my colleagues.", ko: "저는 동료들과 잘 지내요." },
        },
        {
          en: "deadline", ipa: "[ˈdedlaɪn]", ko: "마감 기한", pos: "n.",
          ex: { en: "The deadline is this Friday.", ko: "마감이 이번 주 금요일이에요." },
        },
        {
          en: "schedule", ipa: "[ˈskedʒuːl]", ko: "일정; 일정을 잡다", pos: "n.",
          etym: "미국은 [스케줄], 영국은 [셰줄] — 발음이 크게 갈리는 단어예요.",
          ex: { en: "My schedule is full this week.", ko: "이번 주는 일정이 꽉 찼어요." },
        },
        {
          en: "meeting", ipa: "[ˈmiːtɪŋ]", ko: "회의", pos: "n.",
          ex: { en: "The meeting was moved to three o'clock.", ko: "회의가 세 시로 옮겨졌어요." },
        },
        {
          en: "promotion", ipa: "[prəˈmoʊʃn]", ko: "승진; 판촉", pos: "n.",
          etym: "pro(앞으로)+movere(움직이다) — move, motion과 같은 뿌리예요.",
          ex: { en: "She got a promotion after two years.", ko: "그녀는 2년 만에 승진했어요." },
        },
        {
          en: "quit", ipa: "[kwɪt]", ko: "그만두다", pos: "v.",
          ex: { en: "She quit her job to travel the world.", ko: "그녀는 세계 여행을 하려고 일을 그만뒀어요." },
        },
        {
          en: "hire", ipa: "[ˈhaɪər]", ko: "고용하다", pos: "v.",
          ex: { en: "The company is hiring new staff this month.", ko: "그 회사는 이번 달에 신입 직원을 뽑고 있어요." },
        },
        {
          en: "experience", ipa: "[ɪkˈspɪriəns]", ko: "경험, 경력", pos: "n.",
          ex: { en: "Do you have any experience in marketing?", ko: "마케팅 경력이 있으신가요?" },
        },
        {
          en: "skill", ipa: "[skɪl]", ko: "기술, 능력", pos: "n.",
          ex: { en: "Cooking is a useful skill to learn.", ko: "요리는 배워 두면 유용한 기술이에요." },
        },
        {
          en: "career", ipa: "[kəˈrɪr]", ko: "경력, 직업 인생", pos: "n.",
          etym: "프랑스어 carrière(경주로) — '인생이 달리는 길'. 강세는 뒤예요 [커리어 ✗ → 커**리**어].",
          ex: { en: "She wants a career in fashion.", ko: "그녀는 패션 분야에서 일하고 싶어 해요." },
        },
      ],
    },
    {
      name: "의견 표현",
      icon: "💬",
      words: [
        {
          en: "opinion", ipa: "[əˈpɪnjən]", ko: "의견", pos: "n.",
          ex: { en: "In my opinion, the movie was too long.", ko: "제 생각엔 그 영화는 너무 길었어요." },
        },
        {
          en: "agree", ipa: "[əˈɡriː]", ko: "동의하다", pos: "v.",
          etym: "라틴어 ad+gratus(기쁜) — grateful(감사하는)과 같은 뿌리예요. 사람에는 agree with, 안건에는 agree on.",
          ex: { en: "I totally agree with you.", ko: "전적으로 동의해요." },
        },
        {
          en: "disagree", ipa: "[ˌdɪsəˈɡriː]", ko: "동의하지 않다", pos: "v.",
          ex: { en: "I disagree with you on this point.", ko: "이 점에서는 당신과 생각이 달라요." },
        },
        {
          en: "believe", ipa: "[bɪˈliːv]", ko: "믿다, ~라고 생각하다", pos: "v.",
          ex: { en: "I believe everything will be fine.", ko: "다 잘될 거라고 믿어요." },
        },
        {
          en: "doubt", ipa: "[daʊt]", ko: "의심하다; 의심", pos: "v.",
          etym: "b는 묵음 — 라틴어 dubitare가 뿌리예요. debt(빚)도 같은 묵음 b 패턴이에요.",
          ex: { en: "I doubt that's true.", ko: "그게 사실인지 의심스러워요." },
        },
        {
          en: "prefer", ipa: "[prɪˈfɜːr]", ko: "더 좋아하다, 선호하다", pos: "v.",
          etym: "pre(앞)+ferre(나르다) — '앞에 가져다 두다'라는 발상이에요.",
          ex: { en: "I prefer tea to coffee.", ko: "저는 커피보다 차를 더 좋아해요." },
        },
        {
          en: "suggest", ipa: "[səˈdʒest]", ko: "제안하다", pos: "v.",
          ex: { en: "I suggest taking the subway.", ko: "지하철을 타는 걸 제안해요." },
        },
        {
          en: "persuade", ipa: "[pərˈsweɪd]", ko: "설득하다", pos: "v.",
          ex: { en: "I persuaded my parents to get a dog.", ko: "부모님을 설득해서 강아지를 키우게 됐어요." },
        },
        {
          en: "point of view", ipa: "[ˌpɔɪnt əv ˈvjuː]", ko: "관점, 견해", pos: "n.",
          ex: { en: "Try to understand his point of view.", ko: "그의 관점을 이해하려고 해 보세요." },
        },
        {
          en: "reason", ipa: "[ˈriːzn]", ko: "이유, 근거", pos: "n.",
          ex: { en: "What's the reason for your decision?", ko: "그렇게 결정한 이유가 뭐예요?" },
        },
        {
          en: "definitely", ipa: "[ˈdefɪnətli]", ko: "분명히, 확실히", pos: "adv.",
          ex: { en: "It's definitely worth a try.", ko: "분명히 해 볼 가치가 있어요." },
        },
        {
          en: "perhaps", ipa: "[pərˈhæps]", ko: "아마, 어쩌면", pos: "adv.",
          ex: { en: "Perhaps we should leave a little earlier.", ko: "어쩌면 조금 일찍 출발해야 할 것 같아요." },
        },
        {
          en: "depend", ipa: "[dɪˈpend]", ko: "~에 달려 있다 (depend on)", pos: "v.",
          etym: "de(아래)+pendere(매달리다) — pendant(매달린 장식), pending과 같은 뿌리예요.",
          ex: { en: "It depends on the weather.", ko: "날씨에 달려 있어요." },
        },
      ],
    },
    {
      name: "미디어와 기술",
      icon: "📱",
      words: [
        {
          en: "download", ipa: "[ˈdaʊnloʊd]", ko: "내려받다, 다운로드하다", pos: "v.",
          ex: { en: "You can download the app for free.", ko: "그 앱은 무료로 내려받을 수 있어요." },
        },
        {
          en: "upload", ipa: "[ˈʌploʊd]", ko: "올리다, 업로드하다", pos: "v.",
          ex: { en: "He uploaded the video to his channel.", ko: "그는 영상을 자기 채널에 올렸어요." },
        },
        {
          en: "search", ipa: "[sɜːrtʃ]", ko: "검색하다, 찾다", pos: "v.",
          ex: { en: "Just search for it online.", ko: "그냥 인터넷에서 검색해 보세요." },
        },
        { en: "website", ipa: "[ˈwebsaɪt]", ko: "웹사이트", pos: "n." },
        {
          en: "password", ipa: "[ˈpæswɜːrd]", ko: "비밀번호", pos: "n.",
          ex: { en: "I forgot the password for my email again.", ko: "이메일 비밀번호를 또 잊어버렸어요." },
        },
        { en: "screen", ipa: "[skriːn]", ko: "화면", pos: "n." },
        {
          en: "device", ipa: "[dɪˈvaɪs]", ko: "기기, 장치", pos: "n.",
          etym: "라틴어 dividere(나누다)에서 갈라져 나온 말 — divide와 먼 친척이에요.",
        },
        {
          en: "app", ipa: "[æp]", ko: "앱, 애플리케이션", pos: "n.",
          etym: "application의 준말 — '어플'보다 app [æp] 한 음절로 발음해요.",
          ex: { en: "This app helps me study English every day.", ko: "이 앱은 제가 매일 영어 공부하는 걸 도와줘요." },
        },
        {
          en: "social media", ipa: "[ˌsoʊʃl ˈmiːdiə]", ko: "소셜 미디어, SNS", pos: "n.",
          etym: "'SNS'는 한국·일본식 표현 — 영어권에서는 social media가 일반적이에요.",
          ex: { en: "She shares her recipes on social media.", ko: "그녀는 SNS에 요리법을 공유해요." },
        },
        {
          en: "post", ipa: "[poʊst]", ko: "게시하다; 게시물", pos: "v.",
          ex: { en: "She posted a photo of her lunch.", ko: "그녀는 점심 사진을 올렸어요." },
        },
        {
          en: "share", ipa: "[ʃer]", ko: "공유하다", pos: "v.",
          ex: { en: "Can you share the link with me?", ko: "그 링크 저한테 공유해 줄래요?" },
        },
        {
          en: "subscribe", ipa: "[səbˈskraɪb]", ko: "구독하다", pos: "v.",
          etym: "sub(아래)+scribere(쓰다) — '문서 아래에 서명하다'에서 왔어요. describe, script와 형제예요.",
          ex: { en: "Don't forget to subscribe to the channel.", ko: "채널 구독 잊지 마세요." },
        },
        {
          en: "update", ipa: "[ˈʌpdeɪt]", ko: "업데이트; 갱신하다", pos: "n.",
          ex: { en: "Your phone needs a software update.", ko: "휴대폰 소프트웨어 업데이트가 필요해요." },
        },
      ],
    },
    {
      name: "사회와 관계",
      icon: "🤝",
      words: [
        {
          en: "relationship", ipa: "[rɪˈleɪʃnʃɪp]", ko: "관계", pos: "n.",
          ex: { en: "They have a good relationship.", ko: "그들은 사이가 좋아요." },
        },
        {
          en: "neighbor", ipa: "[ˈneɪbər]", ko: "이웃", pos: "n.",
          etym: "nigh(가까운)+dweller — near(가까운)와 같은 뿌리의 옛 영어 합성어예요.",
          ex: { en: "Our new neighbors are very friendly.", ko: "새 이웃들이 아주 친절해요." },
        },
        {
          en: "community", ipa: "[kəˈmjuːnəti]", ko: "지역 사회, 공동체", pos: "n.",
          etym: "라틴어 communis(공동의) — common, communicate와 같은 뿌리예요.",
        },
        {
          en: "trust", ipa: "[trʌst]", ko: "신뢰하다; 신뢰", pos: "v.",
          ex: { en: "I trust her completely.", ko: "저는 그녀를 전적으로 믿어요." },
        },
        {
          en: "respect", ipa: "[rɪˈspekt]", ko: "존중하다; 존경", pos: "v.",
          etym: "re(다시)+spect(보다) — '다시 볼 만한 가치가 있다'. inspect, expect와 형제예요.",
          ex: { en: "We should respect each other's opinions.", ko: "서로의 의견을 존중해야 해요." },
        },
        {
          en: "support", ipa: "[səˈpɔːrt]", ko: "지지하다, 부양하다", pos: "v.",
          ex: { en: "My parents support my decision.", ko: "부모님은 제 결정을 지지해 주세요." },
        },
        {
          en: "promise", ipa: "[ˈprɑːmɪs]", ko: "약속하다; 약속", pos: "v.",
          ex: { en: "He always keeps his promises.", ko: "그는 약속을 꼭 지켜요." },
        },
        {
          en: "argue", ipa: "[ˈɑːrɡjuː]", ko: "말다툼하다, 논쟁하다", pos: "v.",
          ex: { en: "They argued about money again.", ko: "그들은 또 돈 문제로 다퉜어요." },
        },
        {
          en: "apologize", ipa: "[əˈpɑːlədʒaɪz]", ko: "사과하다", pos: "v.",
          ex: { en: "You should apologize to her.", ko: "그녀에게 사과해야 해요." },
        },
        {
          en: "forgive", ipa: "[fərˈɡɪv]", ko: "용서하다", pos: "v.",
          ex: { en: "Please forgive me for being late.", ko: "늦어서 미안해요, 용서해 주세요." },
        },
        {
          en: "get along", ipa: "[ˌɡet əˈlɔːŋ]", ko: "사이좋게 지내다", pos: "phr.v.",
          ex: { en: "Do you get along with your coworkers?", ko: "직장 동료들과 잘 지내요?" },
        },
        {
          en: "rely", ipa: "[rɪˈlaɪ]", ko: "의지하다 (rely on)", pos: "v.",
          ex: { en: "You can always rely on me.", ko: "언제든 저한테 의지해도 돼요." },
        },
        {
          en: "stranger", ipa: "[ˈstreɪndʒər]", ko: "낯선 사람", pos: "n.",
          etym: "strange(낯선)+-er — '낯선 사람'이지 '이상한 사람'이 아니에요.",
          ex: { en: "Don't share personal information with strangers online.", ko: "온라인에서 낯선 사람에게 개인 정보를 알려 주지 마세요." },
        },
      ],
    },
    {
      name: "구동사 빈출",
      icon: "🔧",
      words: [
        {
          en: "give up", ipa: "[ˌɡɪv ˈʌp]", ko: "포기하다", pos: "phr.v.",
          ex: { en: "Don't give up! You're almost there.", ko: "포기하지 마세요! 거의 다 왔어요." },
        },
        {
          en: "find out", ipa: "[ˌfaɪnd ˈaʊt]", ko: "알아내다, 알게 되다", pos: "phr.v.",
          ex: { en: "I finally found out the truth.", ko: "마침내 진실을 알아냈어요." },
        },
        {
          en: "look for", ipa: "[ˈlʊk fɔːr]", ko: "찾다, 구하다", pos: "phr.v.",
          ex: { en: "I'm looking for my keys.", ko: "열쇠를 찾고 있어요." },
        },
        {
          en: "look forward to", ipa: "[lʊk ˈfɔːrwərd tə]", ko: "~을 고대하다", pos: "phr.v.",
          etym: "뒤에 동명사(-ing)가 와요 — to부정사가 아니에요! look forward to seeing you.",
          ex: { en: "I'm looking forward to seeing you.", ko: "만날 날을 기대하고 있어요." },
        },
        {
          en: "put off", ipa: "[ˌpʊt ˈɔːf]", ko: "미루다, 연기하다", pos: "phr.v.",
          ex: { en: "Stop putting off your homework.", ko: "숙제 그만 미루세요." },
        },
        {
          en: "turn on", ipa: "[ˌtɜːrn ˈɑːn]", ko: "(전원을) 켜다", pos: "phr.v.",
          ex: { en: "Can you turn on the light, please?", ko: "불 좀 켜 줄래요?" },
        },
        {
          en: "turn off", ipa: "[ˌtɜːrn ˈɔːf]", ko: "(전원을) 끄다", pos: "phr.v.",
          ex: { en: "Turn off your phone during the movie.", ko: "영화 보는 동안 휴대폰을 꺼 주세요." },
        },
        {
          en: "pick up", ipa: "[ˌpɪk ˈʌp]", ko: "데리러 가다; 집어 들다", pos: "phr.v.",
          ex: { en: "I'll pick you up at six.", ko: "여섯 시에 데리러 갈게요." },
        },
        {
          en: "drop off", ipa: "[ˌdrɑːp ˈɔːf]", ko: "내려 주다, 갖다 주다", pos: "phr.v.",
          ex: { en: "I'll drop you off at the station.", ko: "역에 내려 줄게요." },
        },
        {
          en: "run out of", ipa: "[ˌrʌn ˈaʊt əv]", ko: "~이 다 떨어지다", pos: "phr.v.",
          ex: { en: "We ran out of milk.", ko: "우유가 다 떨어졌어요." },
        },
        {
          en: "figure out", ipa: "[ˌfɪɡjər ˈaʊt]", ko: "이해하다, 해결책을 찾아내다", pos: "phr.v.",
          ex: { en: "I can't figure out this problem.", ko: "이 문제를 도무지 모르겠어요." },
        },
        {
          en: "hang out", ipa: "[ˌhæŋ ˈaʊt]", ko: "어울려 놀다, 시간을 보내다", pos: "phr.v.",
          ex: { en: "Let's hang out this weekend.", ko: "이번 주말에 같이 놀아요." },
        },
        {
          en: "work out", ipa: "[ˌwɜːrk ˈaʊt]", ko: "운동하다; (일이) 잘 풀리다", pos: "phr.v.",
          etym: "두 가지 뜻을 함께 기억하세요 — I work out(운동해요) / It worked out(잘 풀렸어요).",
          ex: { en: "I work out every morning.", ko: "저는 매일 아침 운동해요." },
        },
        {
          en: "take care of", ipa: "[ˌteɪk ˈker əv]", ko: "돌보다, 처리하다", pos: "phr.v.",
          ex: { en: "She takes care of her grandmother.", ko: "그녀는 할머니를 돌봐요." },
        },
      ],
    },
    {
      name: "형용사 뉘앙스",
      icon: "🎨",
      words: [
        {
          en: "reliable", ipa: "[rɪˈlaɪəbl]", ko: "믿을 수 있는", pos: "adj.",
          ex: { en: "He's a reliable coworker.", ko: "그는 믿을 만한 동료예요." },
        },
        {
          en: "confident", ipa: "[ˈkɑːnfɪdənt]", ko: "자신감 있는", pos: "adj.",
          etym: "con(완전히)+fidere(믿다) — faith(믿음)와 같은 뿌리예요.",
          ex: { en: "Be confident in the interview.", ko: "면접에서 자신감을 가지세요." },
        },
        {
          en: "generous", ipa: "[ˈdʒenərəs]", ko: "너그러운, 후한", pos: "adj.",
          etym: "라틴어 genus(태생) — '좋은 태생의'에서 '너그러운'으로 뜻이 옮겨 왔어요.",
          ex: { en: "He's always generous with his time.", ko: "그는 늘 자기 시간을 아낌없이 내줘요." },
        },
        {
          en: "sensitive", ipa: "[ˈsensətɪv]", ko: "예민한, 민감한", pos: "adj.",
          etym: "sensible(분별 있는)과 혼동 주의 — sensitive는 '예민한'이에요.",
          ex: { en: "He is very sensitive about his weight.", ko: "그는 몸무게 얘기에 아주 민감해요." },
        },
        {
          en: "sensible", ipa: "[ˈsensəbl]", ko: "분별 있는, 합리적인", pos: "adj.",
          ex: { en: "Going home early was a sensible choice.", ko: "일찍 집에 간 건 현명한 선택이었어요." },
        },
        {
          en: "awkward", ipa: "[ˈɔːkwərd]", ko: "어색한, 곤란한", pos: "adj.",
          ex: { en: "There was an awkward silence.", ko: "어색한 침묵이 흘렀어요." },
        },
        {
          en: "embarrassed", ipa: "[ɪmˈbærəst]", ko: "민망한, 창피한", pos: "adj.",
          ex: { en: "I was so embarrassed when I fell.", ko: "넘어졌을 때 너무 창피했어요." },
        },
        {
          en: "disappointed", ipa: "[ˌdɪsəˈpɔɪntɪd]", ko: "실망한", pos: "adj.",
          ex: { en: "I was disappointed with the result.", ko: "결과에 실망했어요." },
        },
        {
          en: "annoying", ipa: "[əˈnɔɪɪŋ]", ko: "짜증 나게 하는", pos: "adj.",
          ex: { en: "The noise is really annoying.", ko: "그 소음 정말 거슬려요." },
        },
        {
          en: "impressive", ipa: "[ɪmˈpresɪv]", ko: "인상적인", pos: "adj.",
          etym: "im(안)+press(누르다) — '마음에 눌러 새겨지는'. express, pressure와 형제예요.",
          ex: { en: "His presentation was short but very impressive.", ko: "그의 발표는 짧았지만 무척 인상적이었어요." },
        },
        {
          en: "convenient", ipa: "[kənˈviːniənt]", ko: "편리한", pos: "adj.",
          ex: { en: "The subway is fast and convenient.", ko: "지하철은 빠르고 편리해요." },
        },
        {
          en: "available", ipa: "[əˈveɪləbl]", ko: "이용 가능한, 시간이 되는", pos: "adj.",
          ex: { en: "Are you available tomorrow afternoon?", ko: "내일 오후에 시간 되세요?" },
        },
        {
          en: "ordinary", ipa: "[ˈɔːrdneri]", ko: "평범한, 보통의", pos: "adj.",
          ex: { en: "It was just an ordinary Monday morning.", ko: "그저 평범한 월요일 아침이었어요." },
        },
        {
          en: "strict", ipa: "[strɪkt]", ko: "엄격한", pos: "adj.",
          ex: { en: "Our teacher is strict but fair.", ko: "우리 선생님은 엄격하지만 공정해요." },
        },
      ],
    },
    {
      name: "일과 직장 보강",
      icon: "💼",
      words: [
        {
          en: "boss", ipa: "[bɔːs]", ko: "상사, 사장", pos: "n.",
          ex: { en: "What would you do if you were the boss?", ko: "당신이 사장이라면 어떻게 하겠어요?" },
        },
        {
          en: "job", ipa: "[dʒɑːb]", ko: "일, 직장", pos: "n.",
          ex: { en: "If I won the lottery, I would quit my job.", ko: "복권에 당첨되면 일을 그만둘 텐데요." },
        },
        {
          en: "report", ipa: "[rɪˈpɔːrt]", ko: "보고서; 보고하다", pos: "n., v.",
          ex: { en: "I haven't finished the report yet.", ko: "보고서를 아직 못 끝냈어요." },
        },
        {
          en: "result", ipa: "[rɪˈzʌlt]", ko: "결과", pos: "n.",
          ex: { en: "The results will be announced on Friday.", ko: "결과는 금요일에 발표될 거예요." },
        },
        {
          en: "decision", ipa: "[dɪˈsɪʒn]", ko: "결정", pos: "n.",
          ex: { en: "The decision has been made.", ko: "결정이 내려졌습니다." },
        },
        {
          en: "message", ipa: "[ˈmesɪdʒ]", ko: "메시지", pos: "n.",
          ex: { en: "I can't figure out this error message.", ko: "이 에러 메시지를 도무지 모르겠어요." },
        },
        {
          en: "error", ipa: "[ˈerər]", ko: "오류, 에러", pos: "n.",
          ex: { en: "I can't figure out this error message.", ko: "이 에러 메시지를 도무지 모르겠어요." },
        },
        {
          en: "list", ipa: "[lɪst]", ko: "명단, 목록", pos: "n.",
          ex: { en: "I'm on the list, aren't I?", ko: "저 명단에 있는 거 맞죠?" },
        },
        {
          en: "conference", ipa: "[ˈkɑːnfərəns]", ko: "학회, 회의", pos: "n.",
          ex: { en: "Who did you meet at the conference?", ko: "학회에서 누구를 만났어요?" },
        },
        {
          en: "designer", ipa: "[dɪˈzaɪnər]", ko: "디자이너", pos: "n.",
          ex: { en: "She is the designer who made this logo.", ko: "그녀가 이 로고를 만든 디자이너예요." },
        },
        {
          en: "logo", ipa: "[ˈloʊɡoʊ]", ko: "로고", pos: "n.",
          ex: { en: "She is the designer who made this logo.", ko: "그녀가 이 로고를 만든 디자이너예요." },
        },
        {
          en: "pilot", ipa: "[ˈpaɪlət]", ko: "조종사, 파일럿", pos: "n.",
          ex: { en: "I have a friend whose father is a pilot.", ko: "아버지가 파일럿인 친구가 있어요." },
        },
        {
          en: "banker", ipa: "[ˈbæŋkər]", ko: "은행원", pos: "n.",
          ex: { en: "He worked as a banker for ten years.", ko: "그는 10년 동안 은행원으로 일했어요." },
        },
        {
          en: "task", ipa: "[tæsk]", ko: "업무, 과제", pos: "n.",
          ex: { en: "This task will take about a week.", ko: "이 업무는 일주일쯤 걸릴 거예요." },
        },
        {
          en: "cancel", ipa: "[ˈkænsl]", ko: "취소하다", pos: "v.",
          ex: { en: "The meeting was canceled.", ko: "회의가 취소됐어요." },
        },
        {
          en: "announce", ipa: "[əˈnaʊns]", ko: "발표하다", pos: "v.",
          ex: { en: "The results will be announced on Friday.", ko: "결과는 금요일에 발표될 거예요." },
        },
        {
          en: "fire", ipa: "[ˈfaɪər]", ko: "해고하다; 불", pos: "v., n.",
          ex: { en: "He got fired last month.", ko: "그는 지난달에 해고당했어요." },
        },
        {
          en: "explain", ipa: "[ɪkˈspleɪn]", ko: "설명하다", pos: "v.",
          ex: { en: "She's really good at explaining difficult things.", ko: "그녀는 어려운 걸 정말 잘 설명해요." },
        },
        {
          en: "improve", ipa: "[ɪmˈpruːv]", ko: "향상시키다, 나아지다", pos: "v.",
          ex: { en: "He improved his English by watching dramas.", ko: "그는 드라마를 보면서 영어 실력을 늘렸어요." },
        },
      ],
    },
    {
      name: "일상 동사 확장",
      icon: "🔁",
      words: [
        {
          en: "tell", ipa: "[tel]", ko: "말해 주다, 알려 주다", pos: "v.",
          ex: { en: "This is Mina, who I told you about.", ko: "이쪽은 미나예요, 내가 말했던 그 친구." },
        },
        {
          en: "ask", ipa: "[æsk]", ko: "묻다; 부탁하다", pos: "v.",
          ex: { en: "She asked if I had eaten lunch.", ko: "그녀가 점심 먹었냐고 물었어요." },
        },
        {
          en: "steal", ipa: "[stiːl]", ko: "훔치다", pos: "v.",
          ex: { en: "My wallet was stolen on the subway.", ko: "지하철에서 지갑을 도둑맞았어요." },
        },
        {
          en: "build", ipa: "[bɪld]", ko: "짓다, 만들다", pos: "v.",
          ex: { en: "This building was built in 1925.", ko: "이 건물은 1925년에 지어졌어요." },
        },
        {
          en: "invent", ipa: "[ɪnˈvent]", ko: "발명하다", pos: "v.",
          ex: { en: "Do you know who invented this machine?", ko: "이 기계를 누가 발명했는지 아세요?" },
        },
        {
          en: "invite", ipa: "[ɪnˈvaɪt]", ko: "초대하다", pos: "v.",
          ex: { en: "We were invited to the wedding.", ko: "우리는 결혼식에 초대받았어요." },
        },
        {
          en: "lend", ipa: "[lend]", ko: "빌려주다", pos: "v.",
          ex: { en: "I lost the book which you lent me.", ko: "네가 빌려준 책을 잃어버렸어." },
        },
        {
          en: "bear", ipa: "[ber]", ko: "낳다; 견디다", pos: "v.",
          ex: { en: "That's the hospital where I was born.", ko: "저기가 내가 태어난 병원이에요." },
        },
        {
          en: "worry", ipa: "[ˈwɜːri]", ko: "걱정하다", pos: "v.",
          ex: { en: "Don't worry, I won't tell anyone.", ko: "걱정 마요, 아무한테도 말 안 할게요." },
        },
        {
          en: "heat", ipa: "[hiːt]", ko: "가열하다; 열", pos: "v., n.",
          ex: { en: "If you heat ice, it melts.", ko: "얼음을 가열하면 녹아요." },
        },
        {
          en: "melt", ipa: "[melt]", ko: "녹다, 녹이다", pos: "v.",
          ex: { en: "If you heat ice, it melts.", ko: "얼음을 가열하면 녹아요." },
        },
        {
          en: "leave", ipa: "[liːv]", ko: "떠나다; 남기다", pos: "v.",
          ex: { en: "I just found out that she's leaving.", ko: "그녀가 떠난다는 걸 방금 알았어요." },
        },
        {
          en: "hold", ipa: "[hoʊld]", ko: "잡다, 유지하다", pos: "v.",
          ex: { en: "Hold on a second.", ko: "잠깐만 기다려요." },
        },
        {
          en: "miss", ipa: "[mɪs]", ko: "놓치다; 그리워하다", pos: "v.",
          ex: { en: "I apologized for missing the deadline.", ko: "마감을 놓친 것에 대해 사과했어요." },
        },
        {
          en: "prevent", ipa: "[prɪˈvent]", ko: "막다, 방지하다", pos: "v.",
          ex: { en: "The rain prevented us from going hiking.", ko: "비 때문에 등산을 못 갔어요." },
        },
        {
          en: "remind", ipa: "[rɪˈmaɪnd]", ko: "생각나게 하다, 상기시키다", pos: "v.",
          ex: { en: "This song always reminds me of that summer.", ko: "이 노래를 들으면 항상 그 여름이 떠올라요." },
        },
        {
          en: "wonder", ipa: "[ˈwʌndər]", ko: "궁금하다", pos: "v.",
          ex: { en: "I wonder if she got my message.", ko: "그녀가 내 메시지를 받았는지 모르겠네요." },
        },
        {
          en: "happen", ipa: "[ˈhæpən]", ko: "일어나다, 생기다", pos: "v.",
          ex: { en: "What happened at the meeting?", ko: "회의에서 무슨 일이 있었어요?" },
        },
        {
          en: "change", ipa: "[tʃeɪndʒ]", ko: "변경, 변화; 바꾸다", pos: "n., v.",
          ex: { en: "He may not know about the change yet.", ko: "그는 아직 변경 사항을 모를 수도 있어요." },
        },
        {
          en: "return", ipa: "[rɪˈtɜːrn]", ko: "돌아오다; 반납하다", pos: "v.",
          ex: { en: "He returned to his hometown.", ko: "그는 고향으로 돌아갔어요." },
        },
        {
          en: "join", ipa: "[dʒɔɪn]", ko: "함께하다, 가입하다", pos: "v.",
          ex: { en: "Will you be joining us for dinner?", ko: "저녁 함께하실 건가요?" },
        },
        {
          en: "land", ipa: "[lænd]", ko: "착륙하다; 땅", pos: "v., n.",
          ex: { en: "By the time you land, I'll have finished the slides.", ko: "네가 착륙할 때쯤이면 슬라이드를 다 끝내놨을 거야." },
        },
        {
          en: "lead", ipa: "[liːd]", ko: "이어지다; 이끌다", pos: "v.",
          ex: { en: "Hard work leads to good results.", ko: "노력은 좋은 결과로 이어져요." },
        },
      ],
    },
    {
      name: "생활과 사건",
      icon: "🎉",
      words: [
        {
          en: "wedding", ipa: "[ˈwedɪŋ]", ko: "결혼식", pos: "n.",
          ex: { en: "We were invited to the wedding.", ko: "우리는 결혼식에 초대받았어요." },
        },
        {
          en: "barbecue", ipa: "[ˈbɑːrbɪkjuː]", ko: "바비큐", pos: "n.",
          ex: { en: "Have you ever tried Korean barbecue?", ko: "한국식 바비큐 먹어본 적 있어요?" },
        },
        {
          en: "picnic", ipa: "[ˈpɪknɪk]", ko: "소풍, 피크닉", pos: "n.",
          ex: { en: "If it rains tomorrow, we will cancel the picnic.", ko: "내일 비가 오면 소풍을 취소할 거예요." },
        },
        {
          en: "lottery", ipa: "[ˈlɑːtəri]", ko: "복권", pos: "n.",
          ex: { en: "If I won the lottery, I would quit my job.", ko: "복권에 당첨되면 일을 그만둘 텐데요." },
        },
        {
          en: "wallet", ipa: "[ˈwɑːlɪt]", ko: "지갑", pos: "n.",
          ex: { en: "My wallet was stolen on the subway.", ko: "지하철에서 지갑을 도둑맞았어요." },
        },
        {
          en: "building", ipa: "[ˈbɪldɪŋ]", ko: "건물", pos: "n.",
          ex: { en: "This building was built in 1925.", ko: "이 건물은 1925년에 지어졌어요." },
        },
        {
          en: "restaurant", ipa: "[ˈrestrɑːnt]", ko: "식당, 레스토랑", pos: "n.",
          ex: { en: "Do you remember the restaurant that we went to?", ko: "우리가 갔던 식당 기억나?" },
        },
        {
          en: "museum", ipa: "[mjuˈziːəm]", ko: "박물관", pos: "n.",
          ex: { en: "Could you tell me what time the museum opens?", ko: "박물관이 몇 시에 여는지 알려 주시겠어요?" },
        },
        {
          en: "city", ipa: "[ˈsɪti]", ko: "도시", pos: "n.",
          ex: { en: "I want to live in a city where it never snows.", ko: "눈이 절대 안 오는 도시에서 살고 싶어요." },
        },
        {
          en: "place", ipa: "[pleɪs]", ko: "장소", pos: "n.",
          ex: { en: "This must be the place.", ko: "여기가 그 장소임에 틀림없어요." },
        },
        {
          en: "king", ipa: "[kɪŋ]", ko: "왕", pos: "n.",
          ex: { en: "The palace was built for the king.", ko: "그 궁전은 왕을 위해 지어졌어요." },
        },
        {
          en: "god", ipa: "[ɡɑːd]", ko: "신", pos: "n.",
          ex: { en: "God save the King.", ko: "국왕 폐하 만세." },
        },
        {
          en: "plane", ipa: "[pleɪn]", ko: "비행기", pos: "n.",
          ex: { en: "The plane took off on time.", ko: "비행기는 정시에 이륙했어요." },
        },
        {
          en: "afternoon", ipa: "[ˌæftərˈnuːn]", ko: "오후", pos: "n.",
          ex: { en: "It could rain this afternoon.", ko: "오후에 비가 올 수도 있어요." },
        },
        {
          en: "second", ipa: "[ˈsekənd]", ko: "잠깐, 초; 두 번째의", pos: "n., adj.",
          ex: { en: "Hold on a second.", ko: "잠깐만 기다려요." },
        },
        {
          en: "end", ipa: "[end]", ko: "끝; 끝나다", pos: "n., v.",
          ex: { en: "Things will work out in the end.", ko: "결국엔 다 잘 풀릴 거예요." },
        },
        {
          en: "thing", ipa: "[θɪŋ]", ko: "것, 일", pos: "n.",
          ex: { en: "Things will work out in the end.", ko: "결국엔 다 잘 풀릴 거예요." },
        },
        {
          en: "case", ipa: "[keɪs]", ko: "경우, 사례", pos: "n.",
          ex: { en: "Your case is similar to mine.", ko: "네 경우는 내 경우와 비슷해." },
        },
        {
          en: "song", ipa: "[sɔːŋ]", ko: "노래", pos: "n.",
          ex: { en: "This song always reminds me of that summer.", ko: "이 노래를 들으면 항상 그 여름이 떠올라요." },
        },
        {
          en: "interest", ipa: "[ˈɪntrəst]", ko: "흥미; 이자", pos: "n.",
          ex: { en: "She has an interest in history.", ko: "그녀는 역사에 흥미가 있어요." },
        },
        {
          en: "law", ipa: "[lɔː]", ko: "법", pos: "n.",
          ex: { en: "The new law starts next month.", ko: "새 법은 다음 달부터 시행돼요." },
        },
      ],
    },
    {
      name: "미디어와 기술 보강",
      icon: "💻",
      words: [
        {
          en: "podcast", ipa: "[ˈpɑːdkæst]", ko: "팟캐스트", pos: "n.",
          ex: { en: "I'm listening to a new podcast these days.", ko: "요즘 새 팟캐스트를 듣고 있어요." },
        },
        {
          en: "drama", ipa: "[ˈdrɑːmə]", ko: "드라마", pos: "n.",
          ex: { en: "He improved his English by watching dramas.", ko: "그는 드라마를 보면서 영어 실력을 늘렸어요." },
        },
        {
          en: "subtitle", ipa: "[ˈsʌbtaɪtl]", ko: "자막", pos: "n.",
          ex: { en: "He watches dramas without subtitles.", ko: "그는 자막 없이 드라마를 봐요." },
        },
        {
          en: "jazz", ipa: "[dʒæz]", ko: "재즈", pos: "n.",
          ex: { en: "Do you like jazz?", ko: "재즈 좋아해요?" },
        },
        {
          en: "ATM", ipa: "[ˌeɪtiːˈem]", ko: "현금 인출기, ATM", pos: "n.",
          ex: { en: "Do you know where the nearest ATM is?", ko: "가장 가까운 ATM이 어디 있는지 아세요?" },
        },
        {
          en: "technology", ipa: "[tekˈnɑːlədʒi]", ko: "기술", pos: "n.",
          ex: { en: "Technology changes our lives.", ko: "기술은 우리 삶을 바꿔요." },
        },
        {
          en: "slide", ipa: "[slaɪd]", ko: "슬라이드; 미끄러지다", pos: "n., v.",
          ex: { en: "I'll finish the slides tonight.", ko: "오늘 밤에 슬라이드를 끝낼게요." },
        },
        {
          en: "light", ipa: "[laɪt]", ko: "불, 빛; 가벼운", pos: "n., adj.",
          ex: { en: "The lights are off. They might be asleep.", ko: "불이 꺼져 있네요. 자고 있을지도 몰라요." },
        },
      ],
    },
    {
      name: "형용사·부사 보강",
      icon: "🎨",
      words: [
        {
          en: "great", ipa: "[ɡreɪt]", ko: "아주 좋은, 훌륭한", pos: "adj.",
          ex: { en: "It would be great if you could send it by Friday.", ko: "금요일까지 보내주시면 정말 감사하겠습니다." },
        },
        {
          en: "careful", ipa: "[ˈkerfl]", ko: "조심하는", pos: "adj.",
          ex: { en: "Be careful not to get hurt.", ko: "다치지 않게 조심하세요." },
        },
        {
          en: "amazing", ipa: "[əˈmeɪzɪŋ]", ko: "놀라운, 굉장한", pos: "adj.",
          ex: { en: "The movie we watched last night was amazing.", ko: "어젯밤에 본 영화 진짜 좋았어." },
        },
        {
          en: "exciting", ipa: "[ɪkˈsaɪtɪŋ]", ko: "신나는, 흥미진진한", pos: "adj.",
          ex: { en: "The game was really exciting.", ko: "그 경기는 정말 흥미진진했어요." },
        },
        {
          en: "exhausted", ipa: "[ɪɡˈzɔːstɪd]", ko: "녹초가 된", pos: "adj.",
          ex: { en: "You must be exhausted.", ko: "분명 녹초가 됐겠네요." },
        },
        {
          en: "asleep", ipa: "[əˈsliːp]", ko: "잠든", pos: "adj.",
          ex: { en: "They might be asleep.", ko: "자고 있을지도 몰라요." },
        },
        {
          en: "true", ipa: "[truː]", ko: "사실인, 진실한", pos: "adj.",
          ex: { en: "That can't be true.", ko: "그럴 리가 없어요." },
        },
        {
          en: "quiet", ipa: "[ˈkwaɪət]", ko: "조용한", pos: "adj.",
          ex: { en: "The kids are quiet.", ko: "애들이 조용하네." },
        },
        {
          en: "similar", ipa: "[ˈsɪmələr]", ko: "비슷한", pos: "adj.",
          ex: { en: "Your case is similar to mine.", ko: "네 경우는 내 경우와 비슷해." },
        },
        {
          en: "alike", ipa: "[əˈlaɪk]", ko: "닮은, 비슷한", pos: "adj.",
          ex: { en: "They look nothing alike.", ko: "하나도 안 닮았어요." },
        },
        {
          en: "little", ipa: "[ˈlɪtl]", ko: "조금(의); 작은", pos: "adj., adv.",
          ex: { en: "I might be a little late tonight.", ko: "오늘 밤 조금 늦을지도 몰라요." },
        },
        {
          en: "ago", ipa: "[əˈɡoʊ]", ko: "~ 전에", pos: "adv.",
          ex: { en: "I saw him an hour ago.", ko: "한 시간 전에 그를 봤어요." },
        },
      ],
    },
    {
      name: "대명사류 보강",
      icon: "🔤",
      words: [
        {
          en: "anyone", ipa: "[ˈeniwʌn]", ko: "누구든, 아무도", pos: "pron.",
          ex: { en: "Don't worry, I won't tell anyone.", ko: "걱정 마요, 아무한테도 말 안 할게요." },
        },
        {
          en: "nothing", ipa: "[ˈnʌθɪŋ]", ko: "아무것도 (~아니다)", pos: "pron.",
          ex: { en: "They look nothing alike.", ko: "하나도 안 닮았어요." },
        },
        {
          en: "everything", ipa: "[ˈevriθɪŋ]", ko: "모든 것", pos: "pron.",
          ex: { en: "Everything depends on the test results.", ko: "모든 게 검사 결과에 달려 있어요." },
        },
        {
          en: "neither", ipa: "[ˈniːðər]", ko: "둘 다 ~아니다; ~도 아니다", pos: "adv., pron.",
          ex: { en: "I can't cook at all. — Neither can I.", ko: "난 요리 정말 못해. — 나도 못해." },
        },
      ],
    },
    {
      name: "빈출 동사 보강",
      icon: "➕",
      words: [
        {
          en: "offer", ipa: "[ˈɔːfər]", ko: "제안하다; 제안", pos: "v., n.",
          ex: { en: "We are pleased to offer you the position.", ko: "귀하께 합격을 제안드리게 되어 기쁩니다." },
        },
        {
          en: "hike", ipa: "[haɪk]", ko: "하이킹하다, 등산하다; 하이킹", pos: "v., n.",
          ex: { en: "The rain prevented us from going hiking.", ko: "비 때문에 등산을 못 갔어요." },
        },
        {
          en: "hear", ipa: "[hɪr]", ko: "듣다, 들리다", pos: "v.",
          ex: { en: "I'm looking forward to hearing from you.", ko: "회신 기다리겠습니다." },
        },
      ],
    },
    {
      name: "공항 수속",
      icon: "🛫",
      words: [
        {
          en: "check-in counter", ipa: "[ˈtʃek ɪn ˌkaʊntər]", ko: "체크인 카운터, 탑승 수속대", pos: "n.",
          ex: { en: "The check-in counter opens at six.", ko: "체크인 카운터는 여섯 시에 열려요." },
        },
        {
          en: "boarding pass", ipa: "[ˈbɔːrdɪŋ pæs]", ko: "탑승권", pos: "n.",
          ex: { en: "Please show your boarding pass at the gate.", ko: "탑승구에서 탑승권을 보여 주세요." },
        },
        {
          en: "carry-on", ipa: "[ˈkæri ɑːn]", ko: "기내 반입 가방", pos: "n.",
          ex: { en: "This small suitcase is my carry-on.", ko: "이 작은 여행 가방은 제 기내 반입 가방이에요." },
        },
        {
          en: "baggage claim", ipa: "[ˈbæɡɪdʒ kleɪm]", ko: "수하물 찾는 곳", pos: "n.",
          ex: { en: "Baggage claim is on the first floor.", ko: "수하물 찾는 곳은 1층에 있어요." },
        },
        {
          en: "gate number", ipa: "[ɡeɪt ˈnʌmbər]", ko: "탑승구 번호", pos: "n.",
          ex: { en: "Check the screen for your gate number.", ko: "화면에서 탑승구 번호를 확인하세요." },
        },
        {
          en: "aisle seat", ipa: "[aɪl siːt]", ko: "통로 쪽 좌석", pos: "n.",
          ex: { en: "Could I have an aisle seat, please?", ko: "통로 쪽 좌석으로 주시겠어요?" },
        },
        {
          en: "window seat", ipa: "[ˈwɪndoʊ siːt]", ko: "창가 좌석", pos: "n.",
          ex: { en: "My child would like a window seat.", ko: "우리 아이가 창가 좌석을 원해요." },
        },
        {
          en: "security check", ipa: "[sɪˈkjʊrəti tʃek]", ko: "보안 검색", pos: "n.",
          ex: { en: "Leave extra time for the security check.", ko: "보안 검색에 쓸 시간을 넉넉히 두세요." },
        },
        {
          en: "departure board", ipa: "[dɪˈpɑːrtʃər bɔːrd]", ko: "출발 안내판", pos: "n.",
          ex: { en: "Our flight is not on the departure board yet.", ko: "우리 항공편은 아직 출발 안내판에 없어요." },
        },
      ],
    },
    {
      name: "숙소 도착",
      icon: "🛎️",
      words: [
        {
          en: "booking", ipa: "[ˈbʊkɪŋ]", ko: "예약", pos: "n.",
          ex: { en: "I have a booking under Kim.", ko: "김이라는 이름으로 예약했어요." },
        },
        {
          en: "front desk", ipa: "[ˌfrʌnt ˈdesk]", ko: "호텔 프런트, 안내 데스크", pos: "n.",
          ex: { en: "Ask the front desk for another towel.", ko: "프런트에 수건을 하나 더 요청하세요." },
        },
        {
          en: "single room", ipa: "[ˈsɪŋɡl ruːm]", ko: "1인실", pos: "n.",
          ex: { en: "I booked a single room for two nights.", ko: "이틀 동안 묵을 1인실을 예약했어요." },
        },
        {
          en: "double room", ipa: "[ˈdʌbl ruːm]", ko: "2인실", pos: "n.",
          ex: { en: "Is a double room available tonight?", ko: "오늘 밤 이용할 수 있는 2인실이 있나요?" },
        },
        {
          en: "vacancy", ipa: "[ˈveɪkənsi]", ko: "빈방, 공실", pos: "n.",
          ex: { en: "The sign says there is one vacancy.", ko: "표지판에 빈방이 하나 있다고 쓰여 있어요." },
        },
        {
          en: "check-in", ipa: "[ˈtʃek ɪn]", ko: "체크인, 입실 수속", pos: "n.",
          ex: { en: "Check-in begins at three in the afternoon.", ko: "체크인은 오후 세 시부터예요." },
        },
        {
          en: "check-out", ipa: "[ˈtʃek aʊt]", ko: "체크아웃, 퇴실 수속", pos: "n.",
          ex: { en: "Check-out is before eleven.", ko: "체크아웃은 열한 시 전이에요." },
        },
        {
          en: "room key", ipa: "[ruːm kiː]", ko: "객실 열쇠", pos: "n.",
          ex: { en: "I left my room key at the front desk.", ko: "객실 열쇠를 프런트에 맡겼어요." },
        },
        {
          en: "wake-up call", ipa: "[ˈweɪk ʌp kɔːl]", ko: "모닝콜", pos: "n.",
          ex: { en: "Can I get a wake-up call at five thirty?", ko: "다섯 시 반에 모닝콜을 받을 수 있을까요?" },
        },
      ],
    },
    {
      name: "대중교통",
      icon: "🚇",
      words: [
        {
          en: "platform", ipa: "[ˈplætfɔːrm]", ko: "승강장", pos: "n.",
          ex: { en: "The train leaves from platform four.", ko: "기차는 4번 승강장에서 출발해요." },
        },
        {
          en: "fare", ipa: "[fer]", ko: "교통 요금", pos: "n.",
          ex: { en: "How much is the bus fare?", ko: "버스 요금이 얼마예요?" },
        },
        {
          en: "route", ipa: "[ruːt]", ko: "노선, 경로", pos: "n.",
          ex: { en: "This route goes through the city center.", ko: "이 노선은 도심을 지나가요." },
        },
        {
          en: "transfer", ipa: "[ˈtrænsfɜːr]", ko: "환승", pos: "n.",
          ex: { en: "You need one transfer at Central Station.", ko: "중앙역에서 한 번 환승해야 해요." },
        },
        {
          en: "one-way", ipa: "[ˌwʌn ˈweɪ]", ko: "편도의", pos: "adj.",
          ex: { en: "I need a one-way ticket to Oxford.", ko: "옥스퍼드행 편도표가 필요해요." },
        },
        {
          en: "round trip", ipa: "[ˌraʊnd ˈtrɪp]", ko: "왕복 여행; 왕복표", pos: "n.",
          ex: { en: "A round trip is cheaper than two single tickets.", ko: "왕복표가 편도표 두 장보다 저렴해요." },
        },
        {
          en: "timetable", ipa: "[ˈtaɪmteɪbl]", ko: "시간표, 운행표", pos: "n.",
          ex: { en: "The weekend timetable is different.", ko: "주말 운행표는 달라요." },
        },
        {
          en: "rush hour", ipa: "[ˈrʌʃ aʊər]", ko: "출퇴근 시간대", pos: "n.",
          ex: { en: "The subway is crowded during rush hour.", ko: "출퇴근 시간에는 지하철이 붐벼요." },
        },
        {
          en: "last train", ipa: "[ˌlæst ˈtreɪn]", ko: "막차", pos: "n.",
          ex: { en: "What time is the last train home?", ko: "집에 가는 막차가 몇 시예요?" },
        },
      ],
    },
    {
      name: "택시와 이동",
      icon: "🚕",
      words: [
        {
          en: "destination", ipa: "[ˌdestɪˈneɪʃn]", ko: "목적지", pos: "n.",
          ex: { en: "Please enter your destination in the app.", ko: "앱에 목적지를 입력해 주세요." },
        },
        {
          en: "meter", ipa: "[ˈmiːtər]", ko: "택시 미터기; 계량기", pos: "n.",
          ex: { en: "Could you turn on the meter?", ko: "미터기를 켜 주시겠어요?" },
        },
        {
          en: "traffic jam", ipa: "[ˈtræfɪk dʒæm]", ko: "교통 체증", pos: "n.",
          ex: { en: "We were late because of a traffic jam.", ko: "교통 체증 때문에 늦었어요." },
        },
        {
          en: "taxi stand", ipa: "[ˈtæksi stænd]", ko: "택시 승강장", pos: "n.",
          ex: { en: "There is a taxi stand outside the station.", ko: "역 밖에 택시 승강장이 있어요." },
        },
        {
          en: "drop-off point", ipa: "[ˈdrɑːp ɔːf pɔɪnt]", ko: "하차 지점", pos: "n.",
          ex: { en: "The hotel entrance is the drop-off point.", ko: "호텔 입구가 하차 지점이에요." },
        },
        {
          en: "pick-up point", ipa: "[ˈpɪk ʌp pɔɪnt]", ko: "승차 지점", pos: "n.",
          ex: { en: "Meet your driver at the pick-up point.", ko: "승차 지점에서 기사님을 만나세요." },
        },
        {
          en: "back seat", ipa: "[ˌbæk ˈsiːt]", ko: "뒷좌석", pos: "n.",
          ex: { en: "Your bag is on the back seat.", ko: "가방은 뒷좌석에 있어요." },
        },
        {
          en: "trunk", ipa: "[trʌŋk]", ko: "자동차 트렁크", pos: "n.",
          ex: { en: "Could you put this suitcase in the trunk?", ko: "이 여행 가방을 트렁크에 넣어 주시겠어요?" },
        },
        {
          en: "exact change", ipa: "[ɪɡˈzækt tʃeɪndʒ]", ko: "거스름돈이 필요 없는 정확한 금액", pos: "n.",
          ex: { en: "You need exact change for this bus.", ko: "이 버스에서는 요금을 정확히 맞춰 내야 해요." },
        },
      ],
    },
    {
      name: "길 찾기",
      icon: "🧭",
      words: [
        {
          en: "intersection", ipa: "[ˌɪntərˈsekʃn]", ko: "교차로", pos: "n.",
          ex: { en: "Turn left at the next intersection.", ko: "다음 교차로에서 왼쪽으로 도세요." },
        },
        {
          en: "crosswalk", ipa: "[ˈkrɔːswɔːk]", ko: "횡단보도", pos: "n.",
          ex: { en: "Use the crosswalk to cross the road.", ko: "길을 건널 때 횡단보도를 이용하세요." },
        },
        {
          en: "landmark", ipa: "[ˈlændmɑːrk]", ko: "눈에 띄는 지형지물, 랜드마크", pos: "n.",
          ex: { en: "The clock tower is an easy landmark to find.", ko: "시계탑은 찾기 쉬운 지형지물이에요." },
        },
        {
          en: "block", ipa: "[blɑːk]", ko: "한 구획, 블록", pos: "n.",
          ex: { en: "The cafe is two blocks from here.", ko: "그 카페는 여기서 두 블록 떨어져 있어요." },
        },
        {
          en: "corner", ipa: "[ˈkɔːrnər]", ko: "모퉁이", pos: "n.",
          ex: { en: "The pharmacy is on the corner.", ko: "약국은 모퉁이에 있어요." },
        },
        {
          en: "entrance", ipa: "[ˈentrəns]", ko: "입구", pos: "n.",
          ex: { en: "The main entrance faces the park.", ko: "정문은 공원 쪽을 향하고 있어요." },
        },
        {
          en: "exit", ipa: "[ˈeɡzɪt]", ko: "출구", pos: "n.",
          ex: { en: "Take exit three from the station.", ko: "역 3번 출구로 나가세요." },
        },
        {
          en: "opposite", ipa: "[ˈɑːpəzɪt]", ko: "맞은편에; 반대편의", pos: "prep.",
          ex: { en: "The library is opposite the post office.", ko: "도서관은 우체국 맞은편에 있어요." },
        },
        {
          en: "nearby", ipa: "[ˌnɪrˈbaɪ]", ko: "근처에; 가까운", pos: "adv.",
          ex: { en: "Is there a restroom nearby?", ko: "근처에 화장실이 있나요?" },
        },
      ],
    },
    {
      name: "관광과 관람",
      icon: "🏛️",
      words: [
        {
          en: "admission", ipa: "[ədˈmɪʃn]", ko: "입장; 입장료", pos: "n.",
          ex: { en: "Admission is free on Sundays.", ko: "일요일에는 입장이 무료예요." },
        },
        {
          en: "guided tour", ipa: "[ˈɡaɪdɪd tʊr]", ko: "가이드 투어", pos: "n.",
          ex: { en: "The guided tour starts in ten minutes.", ko: "가이드 투어는 10분 뒤에 시작해요." },
        },
        {
          en: "opening hours", ipa: "[ˈoʊpənɪŋ aʊərz]", ko: "영업시간, 관람 시간", pos: "n.",
          ex: { en: "Check the opening hours before you visit.", ko: "방문하기 전에 관람 시간을 확인하세요." },
        },
        {
          en: "souvenir", ipa: "[ˌsuːvəˈnɪr]", ko: "기념품", pos: "n.",
          ex: { en: "I bought a small souvenir for my family.", ko: "가족에게 줄 작은 기념품을 샀어요." },
        },
        {
          en: "viewpoint", ipa: "[ˈvjuːpɔɪnt]", ko: "전망 지점", pos: "n.",
          ex: { en: "The viewpoint is a short walk uphill.", ko: "전망 지점은 오르막으로 조금만 걸으면 나와요." },
        },
        {
          en: "brochure", ipa: "[broʊˈʃʊr]", ko: "안내 책자", pos: "n.",
          ex: { en: "This brochure has a map of the old town.", ko: "이 안내 책자에는 구시가지 지도가 있어요." },
        },
        {
          en: "audio guide", ipa: "[ˈɔːdioʊ ɡaɪd]", ko: "음성 안내기", pos: "n.",
          ex: { en: "The audio guide is available in Korean.", ko: "음성 안내기는 한국어로도 이용할 수 있어요." },
        },
        {
          en: "day trip", ipa: "[ˈdeɪ trɪp]", ko: "당일치기 여행", pos: "n.",
          ex: { en: "We took a day trip to the coast.", ko: "우리는 해안으로 당일치기 여행을 갔어요." },
        },
        {
          en: "local market", ipa: "[ˈloʊkl ˈmɑːrkɪt]", ko: "현지 시장", pos: "n.",
          ex: { en: "The local market is busiest in the morning.", ko: "현지 시장은 아침에 가장 붐벼요." },
        },
      ],
    },
    {
      name: "여행 문제 해결",
      icon: "🆘",
      words: [
        {
          en: "delayed", ipa: "[dɪˈleɪd]", ko: "지연된", pos: "adj.",
          ex: { en: "Our flight is delayed by an hour.", ko: "우리 항공편이 한 시간 지연됐어요." },
        },
        {
          en: "cancellation", ipa: "[ˌkænsəˈleɪʃn]", ko: "취소", pos: "n.",
          ex: { en: "The airline sent a cancellation notice.", ko: "항공사에서 취소 안내를 보냈어요." },
        },
        {
          en: "missing luggage", ipa: "[ˈmɪsɪŋ ˈlʌɡɪdʒ]", ko: "분실 수하물", pos: "n.",
          ex: { en: "Where should I report missing luggage?", ko: "분실 수하물은 어디에 신고해야 하나요?" },
        },
        {
          en: "lost property", ipa: "[ˌlɔːst ˈprɑːpərti]", ko: "분실물", pos: "n.",
          ex: { en: "Ask at the lost property office.", ko: "분실물 보관소에 문의하세요." },
        },
        {
          en: "emergency", ipa: "[ɪˈmɜːrdʒənsi]", ko: "비상 상황", pos: "n.",
          ex: { en: "Call this number in an emergency.", ko: "비상 상황에는 이 번호로 전화하세요." },
        },
        {
          en: "travel insurance", ipa: "[ˈtrævl ɪnˌʃʊrəns]", ko: "여행자 보험", pos: "n.",
          ex: { en: "Travel insurance covered the medical bill.", ko: "여행자 보험으로 진료비를 처리했어요." },
        },
        {
          en: "embassy", ipa: "[ˈembəsi]", ko: "대사관", pos: "n.",
          ex: { en: "Contact the embassy if your passport is stolen.", ko: "여권을 도난당하면 대사관에 연락하세요." },
        },
        {
          en: "replacement", ipa: "[rɪˈpleɪsmənt]", ko: "대체품; 재발급품", pos: "n.",
          ex: { en: "I need a replacement for this damaged card.", ko: "이 손상된 카드를 재발급받아야 해요." },
        },
        {
          en: "refund", ipa: "[ˈriːfʌnd]", ko: "환불", pos: "n.",
          ex: { en: "Can I get a refund for the canceled tour?", ko: "취소된 투어를 환불받을 수 있을까요?" },
        },
      ],
    },
    {
      name: "전화와 인터넷",
      icon: "📱",
      words: [
        {
          en: "signal", ipa: "[ˈsɪɡnəl]", ko: "통신 신호", pos: "n.",
          ex: { en: "There is no phone signal in this tunnel.", ko: "이 터널에서는 휴대폰 신호가 잡히지 않아요." },
        },
        {
          en: "Wi-Fi", ipa: "[ˈwaɪ faɪ]", ko: "와이파이", pos: "n.",
          ex: { en: "Is free Wi-Fi available in the lobby?", ko: "로비에서 무료 와이파이를 이용할 수 있나요?" },
        },
        {
          en: "mobile data", ipa: "[ˈmoʊbl ˈdeɪtə]", ko: "모바일 데이터", pos: "n.",
          ex: { en: "Turn off mobile data when you land.", ko: "도착하면 모바일 데이터를 끄세요." },
        },
        {
          en: "battery", ipa: "[ˈbætəri]", ko: "배터리", pos: "n.",
          ex: { en: "My phone battery is almost empty.", ko: "휴대폰 배터리가 거의 다 됐어요." },
        },
        {
          en: "power bank", ipa: "[ˈpaʊər bæŋk]", ko: "보조 배터리", pos: "n.",
          ex: { en: "I keep a power bank in my backpack.", ko: "저는 배낭에 보조 배터리를 넣어 다녀요." },
        },
        {
          en: "voicemail", ipa: "[ˈvɔɪsmeɪl]", ko: "음성 메시지", pos: "n.",
          ex: { en: "Please leave a voicemail after the tone.", ko: "신호음 뒤에 음성 메시지를 남겨 주세요." },
        },
        {
          en: "video call", ipa: "[ˈvɪdioʊ kɔːl]", ko: "영상 통화", pos: "n.",
          ex: { en: "We have a video call every Friday.", ko: "우리는 금요일마다 영상 통화를 해요." },
        },
        {
          en: "log in", ipa: "[lɔːɡ ɪn]", ko: "로그인하다", pos: "phr.v.",
          ex: { en: "Use your email address to log in.", ko: "이메일 주소로 로그인하세요." },
        },
        {
          en: "log out", ipa: "[lɔːɡ aʊt]", ko: "로그아웃하다", pos: "phr.v.",
          ex: { en: "Remember to log out on a shared computer.", ko: "공용 컴퓨터에서는 로그아웃하는 것을 잊지 마세요." },
        },
      ],
    },
    {
      name: "약속과 모임",
      icon: "🗓️",
      words: [
        {
          en: "free time", ipa: "[ˌfriː ˈtaɪm]", ko: "자유 시간, 여가", pos: "n.",
          ex: { en: "What do you do in your free time?", ko: "여가 시간에 무엇을 하세요?" },
        },
        {
          en: "make plans", ipa: "[meɪk plænz]", ko: "약속을 잡다, 계획을 세우다", pos: "expr.",
          ex: { en: "Let's make plans for the weekend.", ko: "주말 약속을 잡아요." },
        },
        {
          en: "get together", ipa: "[ɡet təˈɡeðər]", ko: "모이다, 만나다", pos: "phr.v.",
          ex: { en: "Our friends get together once a month.", ko: "우리 친구들은 한 달에 한 번 모여요." },
        },
        {
          en: "be on time", ipa: "[bi ɑːn taɪm]", ko: "제시간에 오다", pos: "expr.",
          ex: { en: "Please be on time for the movie.", ko: "영화 시간에 늦지 말아 주세요." },
        },
        {
          en: "reschedule", ipa: "[ˌriːˈskedʒuːl]", ko: "일정을 다시 잡다", pos: "v.",
          ex: { en: "Can we reschedule lunch for Thursday?", ko: "점심 약속을 목요일로 다시 잡을 수 있을까요?" },
        },
        {
          en: "invitation", ipa: "[ˌɪnvɪˈteɪʃn]", ko: "초대; 초대장", pos: "n.",
          ex: { en: "Thank you for the dinner invitation.", ko: "저녁 초대 고마워요." },
        },
        {
          en: "host", ipa: "[hoʊst]", ko: "주최자, 초대한 사람", pos: "n.",
          ex: { en: "The host welcomed everyone at the door.", ko: "주최자가 문에서 모두를 맞이했어요." },
        },
        {
          en: "guest", ipa: "[ɡest]", ko: "손님, 초대받은 사람", pos: "n.",
          ex: { en: "Each guest brought something to eat.", ko: "손님마다 먹을 것을 하나씩 가져왔어요." },
        },
        {
          en: "bring a friend", ipa: "[brɪŋ ə frend]", ko: "친구를 데려오다", pos: "expr.",
          ex: { en: "You can bring a friend to the picnic.", ko: "소풍에 친구를 데려와도 돼요." },
        },
      ],
    },
    {
      name: "사무실 물건",
      icon: "🖇️",
      words: [
        {
          en: "workstation", ipa: "[ˈwɜːrksteɪʃn]", ko: "업무용 자리, 워크스테이션", pos: "n.",
          ex: { en: "Your workstation is next to the window.", ko: "당신의 업무용 자리는 창문 옆이에요." },
        },
        {
          en: "keyboard", ipa: "[ˈkiːbɔːrd]", ko: "키보드", pos: "n.",
          ex: { en: "This keyboard is quiet and comfortable.", ko: "이 키보드는 조용하고 편해요." },
        },
        {
          en: "mouse", ipa: "[maʊs]", ko: "컴퓨터 마우스", pos: "n.",
          ex: { en: "The wireless mouse needs a new battery.", ko: "무선 마우스에 새 배터리가 필요해요." },
        },
        {
          en: "monitor", ipa: "[ˈmɑːnɪtər]", ko: "모니터", pos: "n.",
          ex: { en: "The second monitor is for video calls.", ko: "두 번째 모니터는 영상 통화용이에요." },
        },
        {
          en: "notebook", ipa: "[ˈnoʊtbʊk]", ko: "공책, 노트", pos: "n.",
          ex: { en: "Write the phone number in your notebook.", ko: "전화번호를 공책에 적으세요." },
        },
        {
          en: "stapler", ipa: "[ˈsteɪplər]", ko: "스테이플러", pos: "n.",
          ex: { en: "Could I borrow your stapler?", ko: "스테이플러를 빌릴 수 있을까요?" },
        },
        {
          en: "folder", ipa: "[ˈfoʊldər]", ko: "서류철; 폴더", pos: "n.",
          ex: { en: "Put the signed form in this folder.", ko: "서명한 양식을 이 서류철에 넣으세요." },
        },
        {
          en: "photocopier", ipa: "[ˈfoʊtoʊkɑːpiər]", ko: "복사기", pos: "n.",
          ex: { en: "The photocopier is out of paper.", ko: "복사기에 종이가 떨어졌어요." },
        },
        {
          en: "break room", ipa: "[ˈbreɪk ruːm]", ko: "직원 휴게실", pos: "n.",
          ex: { en: "There is fresh coffee in the break room.", ko: "직원 휴게실에 갓 내린 커피가 있어요." },
        },
      ],
    },
    {
      name: "회의 기초",
      icon: "👥",
      words: [
        {
          en: "agenda", ipa: "[əˈdʒendə]", ko: "회의 안건, 의제", pos: "n.",
          ex: { en: "The first item on the agenda is the budget.", ko: "첫 번째 회의 안건은 예산이에요." },
        },
        {
          en: "meeting minutes", ipa: "[ˈmiːtɪŋ ˈmɪnɪts]", ko: "회의록", pos: "n.",
          ex: { en: "I will send the meeting minutes this afternoon.", ko: "오늘 오후에 회의록을 보내겠습니다." },
        },
        {
          en: "attendee", ipa: "[əˌtenˈdiː]", ko: "참석자", pos: "n.",
          ex: { en: "Each attendee received a name tag.", ko: "참석자마다 이름표를 받았어요." },
        },
        {
          en: "presenter", ipa: "[prɪˈzentər]", ko: "발표자", pos: "n.",
          ex: { en: "The presenter answered three questions.", ko: "발표자가 질문 세 개에 답했어요." },
        },
        {
          en: "take notes", ipa: "[teɪk noʊts]", ko: "메모하다", pos: "expr.",
          ex: { en: "Please take notes during the training.", ko: "교육 중에 메모해 주세요." },
        },
        {
          en: "action item", ipa: "[ˈækʃn ˌaɪtəm]", ko: "후속 실행 항목", pos: "n.",
          ex: { en: "Updating the schedule is my action item.", ko: "일정 갱신이 제가 맡은 후속 실행 항목이에요." },
        },
        {
          en: "follow-up", ipa: "[ˈfɑːloʊ ʌp]", ko: "후속 조치", pos: "n.",
          ex: { en: "We need a follow-up after the client call.", ko: "고객 통화 뒤에 후속 조치가 필요해요." },
        },
        {
          en: "conference room", ipa: "[ˈkɑːnfərəns ruːm]", ko: "회의실", pos: "n.",
          ex: { en: "The conference room is on the third floor.", ko: "회의실은 3층에 있어요." },
        },
        {
          en: "wrap up", ipa: "[ræp ʌp]", ko: "마무리하다", pos: "phr.v.",
          ex: { en: "Let's wrap up the meeting by four.", ko: "네 시까지 회의를 마무리해요." },
        },
      ],
    },
    {
      name: "업무 관리",
      icon: "✅",
      words: [
        {
          en: "workload", ipa: "[ˈwɜːrkloʊd]", ko: "업무량", pos: "n.",
          ex: { en: "My workload is lighter this week.", ko: "이번 주에는 업무량이 더 적어요." },
        },
        {
          en: "checklist", ipa: "[ˈtʃeklɪst]", ko: "점검 목록", pos: "n.",
          ex: { en: "Use this checklist before you submit the file.", ko: "파일을 제출하기 전에 이 점검 목록을 사용하세요." },
        },
        {
          en: "instruction", ipa: "[ɪnˈstrʌkʃn]", ko: "지시 사항, 설명", pos: "n.",
          ex: { en: "The first instruction is easy to follow.", ko: "첫 번째 지시 사항은 따라 하기 쉬워요." },
        },
        {
          en: "assignment", ipa: "[əˈsaɪnmənt]", ko: "맡은 업무, 과제", pos: "n.",
          ex: { en: "This assignment should take two days.", ko: "이 업무에는 이틀 정도 걸릴 거예요." },
        },
        {
          en: "responsibility", ipa: "[rɪˌspɑːnsəˈbɪləti]", ko: "책임, 담당 업무", pos: "n.",
          ex: { en: "Booking the room is my responsibility.", ko: "회의실 예약은 제 담당이에요." },
        },
        {
          en: "handover", ipa: "[ˈhændoʊvər]", ko: "업무 인계", pos: "n.",
          ex: { en: "We have a handover meeting on Monday.", ko: "월요일에 업무 인계 회의가 있어요." },
        },
        {
          en: "approval", ipa: "[əˈpruːvl]", ko: "승인", pos: "n.",
          ex: { en: "The plan needs the manager's approval.", ko: "그 계획은 관리자의 승인이 필요해요." },
        },
        {
          en: "reminder", ipa: "[rɪˈmaɪndər]", ko: "알림, 상기시키는 것", pos: "n.",
          ex: { en: "I set a reminder for the deadline.", ko: "마감일 알림을 설정했어요." },
        },
        {
          en: "status update", ipa: "[ˈsteɪtəs ˌʌpdeɪt]", ko: "진행 상황 보고", pos: "n.",
          ex: { en: "Please give us a short status update.", ko: "진행 상황을 짧게 알려 주세요." },
        },
      ],
    },
    {
      name: "이메일 기초",
      icon: "📧",
      words: [
        {
          en: "subject line", ipa: "[ˈsʌbdʒɪkt laɪn]", ko: "이메일 제목 줄", pos: "n.",
          ex: { en: "Keep the subject line short and clear.", ko: "이메일 제목은 짧고 명확하게 쓰세요." },
        },
        {
          en: "attachment", ipa: "[əˈtætʃmənt]", ko: "첨부 파일", pos: "n.",
          ex: { en: "The price list is in the attachment.", ko: "가격표는 첨부 파일에 있어요." },
        },
        {
          en: "inbox", ipa: "[ˈɪnbɑːks]", ko: "받은편지함", pos: "n.",
          ex: { en: "I check my inbox after lunch.", ko: "저는 점심 뒤에 받은편지함을 확인해요." },
        },
        {
          en: "reply", ipa: "[rɪˈplaɪ]", ko: "답장하다; 답장", pos: "v., n.",
          ex: { en: "Please reply by Friday morning.", ko: "금요일 오전까지 답장해 주세요." },
        },
        {
          en: "forward", ipa: "[ˈfɔːrwərd]", ko: "전달하다", pos: "v.",
          ex: { en: "Could you forward the email to Mina?", ko: "그 이메일을 미나에게 전달해 주시겠어요?" },
        },
        {
          en: "recipient", ipa: "[rɪˈsɪpiənt]", ko: "수신자", pos: "n.",
          ex: { en: "Check the recipient before you send the message.", ko: "메시지를 보내기 전에 수신자를 확인하세요." },
        },
        {
          en: "sender", ipa: "[ˈsendər]", ko: "발신자", pos: "n.",
          ex: { en: "I do not know the sender of this email.", ko: "이 이메일의 발신자를 모르겠어요." },
        },
        {
          en: "signature", ipa: "[ˈsɪɡnətʃər]", ko: "서명; 이메일 서명란", pos: "n.",
          ex: { en: "Add your phone number to your email signature.", ko: "이메일 서명란에 전화번호를 추가하세요." },
        },
        {
          en: "out of office", ipa: "[ˌaʊt əv ˈɔːfɪs]", ko: "부재중인", pos: "expr.",
          ex: { en: "I will be out of office until Tuesday.", ko: "화요일까지 자리를 비울 예정입니다." },
        },
      ],
    },
    {
      name: "구직과 근무 형태",
      icon: "💼",
      words: [
        {
          en: "job opening", ipa: "[ˈdʒɑːb oʊpənɪŋ]", ko: "채용 공고, 빈 일자리", pos: "n.",
          ex: { en: "I found a job opening near my home.", ko: "집 근처에서 채용 공고를 찾았어요." },
        },
        {
          en: "résumé", ipa: "[ˈrezəmeɪ]", ko: "이력서", pos: "n.",
          ex: { en: "Please send your résumé as a PDF.", ko: "이력서를 PDF로 보내 주세요." },
        },
        {
          en: "cover letter", ipa: "[ˈkʌvər ˌletər]", ko: "자기소개서, 지원 동기서", pos: "n.",
          ex: { en: "Her cover letter explains why she wants the job.", ko: "그녀의 자기소개서에는 그 일을 원하는 이유가 나와 있어요." },
        },
        {
          en: "qualification", ipa: "[ˌkwɑːləfɪˈkeɪʃn]", ko: "자격, 자격 요건", pos: "n.",
          ex: { en: "Customer service experience is a useful qualification.", ko: "고객 응대 경험은 유용한 자격 요건이에요." },
        },
        {
          en: "professional reference", ipa: "[prəˈfeʃənl ˈrefrəns]", ko: "직무 관련 추천인", pos: "n.",
          ex: { en: "The employer asked for one professional reference.", ko: "고용주가 직무 관련 추천인 한 명을 요청했어요." },
        },
        {
          en: "part-time", ipa: "[ˌpɑːrt ˈtaɪm]", ko: "시간제의", pos: "adj.",
          ex: { en: "He has a part-time job at a bookstore.", ko: "그는 서점에서 시간제로 일해요." },
        },
        {
          en: "full-time", ipa: "[ˌfʊl ˈtaɪm]", ko: "상근의, 전일제의", pos: "adj.",
          ex: { en: "She starts full-time work next month.", ko: "그녀는 다음 달부터 상근으로 일해요." },
        },
        {
          en: "shift", ipa: "[ʃɪft]", ko: "근무 교대; 근무 시간대", pos: "n.",
          ex: { en: "My morning shift begins at seven.", ko: "제 아침 근무는 일곱 시에 시작해요." },
        },
        {
          en: "training", ipa: "[ˈtreɪnɪŋ]", ko: "교육, 훈련", pos: "n.",
          ex: { en: "New staff receive two days of training.", ko: "신입 직원은 이틀 동안 교육을 받아요." },
        },
      ],
    },
  ],
}

export default themes;
