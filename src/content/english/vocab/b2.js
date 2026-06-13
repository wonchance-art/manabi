export default {
  level: "B2",
  title: "B2 상급 어휘",
  desc: "뉴스·에세이·토론에 필요한 198개 — 추상 명사와 imply/suggest/indicate 같은 뉘앙스 동사를 가려 써요.",
  themes: [
    {
      name: "시사·경제",
      icon: "📰",
      words: [
        {
          en: "economy", ipa: "[ɪˈkɑːnəmi]", ko: "경제", pos: "n.",
          etym: "그리스어 oikos(집)+nomos(관리) — '집안 살림'이 원뜻이에요. 형용사 economic은 강세 이동 [ˌiːkəˈnɑːmɪk].",
          ex: { en: "The global economy is slowly recovering.", ko: "세계 경제가 서서히 회복되고 있어요." },
        },
        {
          en: "inflation", ipa: "[ɪnˈfleɪʃn]", ko: "물가 상승, 인플레이션", pos: "n.",
          etym: "라틴어 in+flare(불다) — '부풀어 오름'. 풍선(inflate a balloon)과 같은 그림이에요.",
          ex: { en: "Inflation makes everyday life more expensive.", ko: "인플레이션은 일상생활을 더 비싸게 만들어요." },
        },
        {
          en: "unemployment", ipa: "[ˌʌnɪmˈplɔɪmənt]", ko: "실업", pos: "n.",
          ex: { en: "The unemployment rate is rising again.", ko: "실업률이 다시 오르고 있어요." },
        },
        {
          en: "policy", ipa: "[ˈpɑːləsi]", ko: "정책; 보험 증권", pos: "n.",
          etym: "그리스어 polis(도시) — politics와 같은 뿌리. '보험 증권' 뜻도 있으니 문맥 주의예요.",
          ex: { en: "The government announced a new housing policy.", ko: "정부가 새 주택 정책을 발표했어요." },
        },
        {
          en: "election", ipa: "[ɪˈlekʃn]", ko: "선거", pos: "n.",
          etym: "e(밖으로)+legere(고르다) — select, collect와 같은 뿌리예요.",
          ex: { en: "The presidential election is next year.", ko: "대통령 선거가 내년이에요." },
        },
        {
          en: "government", ipa: "[ˈɡʌvərnmənt]", ko: "정부", pos: "n.",
          ex: { en: "The government raised the minimum wage.", ko: "정부가 최저임금을 인상했어요." },
        },
        {
          en: "budget", ipa: "[ˈbʌdʒɪt]", ko: "예산", pos: "n.",
          ex: { en: "The city cut its education budget.", ko: "시가 교육 예산을 삭감했어요." },
        },
        {
          en: "debt", ipa: "[det]", ko: "빚, 부채", pos: "n.",
          etym: "b는 묵음 — 라틴어 debere(빚지다)가 뿌리로, duty(의무)와 연결돼요.",
          ex: { en: "He finally paid off his student debt.", ko: "그는 마침내 학자금 빚을 다 갚았어요." },
        },
        {
          en: "investment", ipa: "[ɪnˈvestmənt]", ko: "투자", pos: "n.",
          ex: { en: "Education is the best investment.", ko: "교육이 최고의 투자예요." },
        },
        {
          en: "trade", ipa: "[treɪd]", ko: "무역, 거래", pos: "n.",
          ex: { en: "Trade between the two countries is growing.", ko: "두 나라 사이의 무역이 늘고 있어요." },
        },
        {
          en: "crisis", ipa: "[ˈkraɪsɪs]", ko: "위기", pos: "n.",
          etym: "그리스어 krinein(판단하다) — critic, criteria와 형제. 복수는 crises [ˈkraɪsiːz]예요.",
        },
        {
          en: "demand", ipa: "[dɪˈmænd]", ko: "수요; 요구하다", pos: "n.",
          ex: { en: "Demand for housing keeps growing.", ko: "주택 수요가 계속 늘고 있어요." },
        },
        {
          en: "supply", ipa: "[səˈplaɪ]", ko: "공급; 공급하다", pos: "n.",
          ex: { en: "The storm cut off the water supply.", ko: "폭풍으로 물 공급이 끊겼어요." },
        },
        {
          en: "growth", ipa: "[ɡroʊθ]", ko: "성장", pos: "n.",
          ex: { en: "The company reported strong growth this year.", ko: "그 회사는 올해 큰 성장을 보고했어요." },
        },
      ],
    },
    {
      name: "환경·과학",
      icon: "🌍",
      words: [
        {
          en: "climate", ipa: "[ˈklaɪmət]", ko: "기후", pos: "n.",
          ex: { en: "Climate change affects everyone.", ko: "기후 변화는 모두에게 영향을 미쳐요." },
        },
        {
          en: "pollution", ipa: "[pəˈluːʃn]", ko: "오염", pos: "n.",
          ex: { en: "Air pollution is getting worse in big cities.", ko: "대도시의 대기 오염이 심해지고 있어요." },
        },
        {
          en: "renewable", ipa: "[rɪˈnuːəbl]", ko: "재생 가능한", pos: "adj.",
          ex: { en: "Solar power is a renewable energy source.", ko: "태양광은 재생 가능한 에너지원이에요." },
        },
        { en: "carbon", ipa: "[ˈkɑːrbən]", ko: "탄소", pos: "n." },
        {
          en: "emission", ipa: "[ɪˈmɪʃn]", ko: "배출(물)", pos: "n.",
          etym: "e(밖)+mittere(보내다) — emit, transmit, mission이 모두 같은 뿌리예요.",
          ex: { en: "The city plans to cut carbon emissions in half.", ko: "시는 탄소 배출을 절반으로 줄일 계획이에요." },
        },
        {
          en: "sustainable", ipa: "[səˈsteɪnəbl]", ko: "지속 가능한", pos: "adj.",
          etym: "sus(아래에서)+tenere(붙잡다) — maintain, contain과 같은 뿌리예요.",
          ex: { en: "We need a more sustainable lifestyle.", ko: "더 지속 가능한 생활 방식이 필요해요." },
        },
        {
          en: "species", ipa: "[ˈspiːʃiːz]", ko: "(생물) 종", pos: "n.",
          etym: "라틴어 직수입 단어라 단수·복수 형태가 같아요 — a species, two species.",
          ex: { en: "This species is found only in Korea.", ko: "이 종은 한국에서만 발견돼요." },
        },
        {
          en: "extinction", ipa: "[ɪkˈstɪŋkʃn]", ko: "멸종", pos: "n.",
          ex: { en: "Many species are in danger of extinction.", ko: "많은 종이 멸종 위기에 처해 있어요." },
        },
        {
          en: "experiment", ipa: "[ɪkˈsperɪmənt]", ko: "실험", pos: "n.",
          ex: { en: "The experiment confirmed their hypothesis.", ko: "그 실험이 그들의 가설을 확인해 줬어요." },
        },
        {
          en: "evidence", ipa: "[ˈevɪdəns]", ko: "증거", pos: "n.",
          etym: "e(밖)+videre(보다) — '밖으로 또렷이 보이는 것'. video, view와 형제예요. 불가산명사!",
        },
        {
          en: "theory", ipa: "[ˈθiːəri]", ko: "이론", pos: "n.",
          ex: { en: "His theory explains the data quite well.", ko: "그의 이론은 데이터를 꽤 잘 설명해요." },
        },
        {
          en: "research", ipa: "[ˈriːsɜːrtʃ]", ko: "연구", pos: "n.",
          etym: "불가산명사예요 — researches가 아니라 a lot of research라고 써요.",
          ex: { en: "Her research focuses on marine biology.", ko: "그녀의 연구는 해양 생물학에 초점을 맞춰요." },
        },
        { en: "cell", ipa: "[sel]", ko: "세포", pos: "n." },
        { en: "gene", ipa: "[dʒiːn]", ko: "유전자", pos: "n." },
      ],
    },
    {
      name: "논증·에세이 어휘",
      icon: "✍️",
      words: [
        {
          en: "therefore", ipa: "[ˈðerfɔːr]", ko: "그러므로, 따라서", pos: "adv.",
          ex: { en: "The data is incomplete; therefore, we need more time.", ko: "데이터가 불완전해요. 따라서 시간이 더 필요해요." },
        },
        {
          en: "furthermore", ipa: "[ˌfɜːrðərˈmɔːr]", ko: "더욱이, 게다가", pos: "adv.",
          ex: { en: "The plan is cheap; furthermore, it is simple.", ko: "그 계획은 저렴하고, 게다가 간단해요." },
        },
        {
          en: "nevertheless", ipa: "[ˌnevərðəˈles]", ko: "그럼에도 불구하고", pos: "adv.",
          ex: { en: "The plan was risky; nevertheless, they went ahead.", ko: "계획은 위험했지만, 그럼에도 그들은 밀고 나갔어요." },
        },
        {
          en: "whereas", ipa: "[ˌwerˈæz]", ko: "~인 반면에", pos: "expr.",
          ex: { en: "He likes cities, whereas she prefers the countryside.", ko: "그는 도시를 좋아하는 반면, 그녀는 시골을 선호해요." },
        },
        {
          en: "consequently", ipa: "[ˈkɑːnsɪkwəntli]", ko: "그 결과, 결과적으로", pos: "adv.",
          etym: "라틴어 con+sequi(따르다) — sequence(연속), second와 같은 뿌리예요.",
          ex: { en: "He missed the bus and consequently arrived late.", ko: "그는 버스를 놓쳤고, 그 결과 늦게 도착했어요." },
        },
        {
          en: "in contrast", ipa: "[ɪn ˈkɑːntræst]", ko: "그에 반해, 대조적으로", pos: "expr.",
          ex: { en: "In contrast, sales in Asia rose sharply.", ko: "그에 반해 아시아 매출은 급격히 늘었어요." },
        },
        {
          en: "claim", ipa: "[kleɪm]", ko: "주장하다; 청구하다", pos: "v.",
          etym: "라틴어 clamare(외치다) — exclaim, clamor와 형제. 보험금 '청구' 뜻도 있어요.",
          ex: { en: "The company claims its product is safe.", ko: "그 회사는 자사 제품이 안전하다고 주장해요." },
        },
        {
          en: "refute", ipa: "[rɪˈfjuːt]", ko: "반박하다, 논박하다", pos: "v.",
          ex: { en: "The new evidence refuted his argument.", ko: "새 증거가 그의 주장을 반박했어요." },
        },
        {
          en: "emphasize", ipa: "[ˈemfəsaɪz]", ko: "강조하다", pos: "v.",
          ex: { en: "The report emphasizes the need for reform.", ko: "보고서는 개혁의 필요성을 강조해요." },
        },
        {
          en: "illustrate", ipa: "[ˈɪləstreɪt]", ko: "(예를 들어) 설명하다", pos: "v.",
          etym: "라틴어 in+lustrare(빛을 비추다) — '예를 들어 환히 밝히다'라는 그림이에요.",
          ex: { en: "Let me illustrate this point with an example.", ko: "이 점을 예를 들어 설명해 볼게요." },
        },
        {
          en: "summarize", ipa: "[ˈsʌməraɪz]", ko: "요약하다", pos: "v.",
          ex: { en: "Can you summarize the article in three sentences?", ko: "그 기사를 세 문장으로 요약해 줄래요?" },
        },
        {
          en: "conclude", ipa: "[kənˈkluːd]", ko: "결론을 내리다", pos: "v.",
          etym: "con+claudere(닫다) — close, include와 같은 뿌리. '논의를 닫다'예요.",
          ex: { en: "The study concludes that exercise improves memory.", ko: "그 연구는 운동이 기억력을 높인다고 결론지어요." },
        },
        {
          en: "assume", ipa: "[əˈsuːm]", ko: "가정하다, 추정하다", pos: "v.",
          ex: { en: "Let's assume the data is correct.", ko: "데이터가 맞다고 가정해 봐요." },
        },
        {
          en: "cite", ipa: "[saɪt]", ko: "인용하다", pos: "v.",
          etym: "site(장소), sight(시야)와 발음이 같은 삼총사 — 철자로 구별해요.",
          ex: { en: "Always cite your sources in an essay.", ko: "에세이에서는 출처를 꼭 인용하세요." },
        },
      ],
    },
    {
      name: "추상 명사",
      icon: "💭",
      words: [
        {
          en: "concept", ipa: "[ˈkɑːnsept]", ko: "개념", pos: "n.",
          ex: { en: "The concept of jeong is hard to translate.", ko: "정(情)이라는 개념은 번역하기 어려워요." },
        },
        {
          en: "perspective", ipa: "[pərˈspektɪv]", ko: "관점, 시각", pos: "n.",
          etym: "per(통해)+spect(보다) — '꿰뚫어 보는 눈'이에요.",
          ex: { en: "Try to see it from her perspective.", ko: "그녀의 관점에서 보려고 해 보세요." },
        },
        {
          en: "assumption", ipa: "[əˈsʌmpʃn]", ko: "가정, 전제", pos: "n.",
          ex: { en: "Your plan rests on a false assumption.", ko: "당신 계획은 잘못된 전제 위에 서 있어요." },
        },
        {
          en: "consequence", ipa: "[ˈkɑːnsɪkwəns]", ko: "결과 (주로 부정적)", pos: "n.",
          ex: { en: "Every choice has consequences.", ko: "모든 선택에는 결과가 따라요." },
        },
        {
          en: "priority", ipa: "[praɪˈɔːrəti]", ko: "우선순위", pos: "n.",
          ex: { en: "Safety is our top priority.", ko: "안전이 우리의 최우선이에요." },
        },
        {
          en: "dilemma", ipa: "[dɪˈlemə]", ko: "딜레마, 진퇴양난", pos: "n.",
          etym: "그리스어 di(둘)+lemma(전제) — '두 전제 사이에 낀 상태'예요.",
          ex: { en: "She faced a dilemma between career and family.", ko: "그녀는 일과 가족 사이에서 딜레마에 빠졌어요." },
        },
        {
          en: "insight", ipa: "[ˈɪnsaɪt]", ko: "통찰(력)", pos: "n.",
          ex: { en: "The book offers deep insight into human behavior.", ko: "그 책은 인간 행동에 대한 깊은 통찰을 줘요." },
        },
        {
          en: "bias", ipa: "[ˈbaɪəs]", ko: "편향, 편견", pos: "n.",
          ex: { en: "The article shows a clear political bias.", ko: "그 기사는 뚜렷한 정치적 편향을 보여요." },
        },
        {
          en: "tendency", ipa: "[ˈtendənsi]", ko: "경향", pos: "n.",
          ex: { en: "He has a tendency to put things off.", ko: "그는 일을 미루는 경향이 있어요." },
        },
        {
          en: "principle", ipa: "[ˈprɪnsəpl]", ko: "원칙, 원리", pos: "n.",
          etym: "principal(교장; 주요한)과 발음이 똑같아요 — -ple(원칙) vs -pal(사람) 철자로 구별해요.",
          ex: { en: "She refused the offer as a matter of principle.", ko: "그녀는 원칙의 문제로 그 제안을 거절했어요." },
        },
        {
          en: "phenomenon", ipa: "[fəˈnɑːmɪnən]", ko: "현상", pos: "n.",
          etym: "그리스어 직수입 — 복수는 phenomena예요.",
          ex: { en: "The Korean Wave is a global phenomenon.", ko: "한류는 세계적인 현상이에요." },
        },
        {
          en: "context", ipa: "[ˈkɑːntekst]", ko: "맥락, 문맥", pos: "n.",
          etym: "con(함께)+texere(짜다) — '함께 짜인 것'. textile, texture와 형제예요.",
          ex: { en: "The word changes meaning depending on context.", ko: "그 단어는 문맥에 따라 뜻이 달라져요." },
        },
        {
          en: "implication", ipa: "[ˌɪmplɪˈkeɪʃn]", ko: "함의, 암시; 영향", pos: "n.",
          ex: { en: "The new law has implications for small businesses.", ko: "새 법은 소상공인에게 영향을 미쳐요." },
        },
        {
          en: "strategy", ipa: "[ˈstrætədʒi]", ko: "전략", pos: "n.",
          ex: { en: "We need a new marketing strategy.", ko: "새로운 마케팅 전략이 필요해요." },
        },
      ],
    },
    {
      name: "뉘앙스 동사",
      icon: "🎯",
      words: [
        {
          en: "imply", ipa: "[ɪmˈplaɪ]", ko: "넌지시 비치다, 함의하다", pos: "v.",
          etym: "im(안)+plicare(접다) — '말 속에 접어 넣다'. suggest보다 간접적이에요.",
          ex: { en: "His silence implied disagreement.", ko: "그의 침묵은 반대를 암시했어요." },
        },
        {
          en: "indicate", ipa: "[ˈɪndɪkeɪt]", ko: "(자료가) 보여 주다, 나타내다", pos: "v.",
          etym: "imply(말 속에 숨김)·suggest(부드럽게 시사)·indicate(데이터가 객관적으로 가리킴) — 논문·보고서엔 indicate를 써요.",
          ex: { en: "The data indicates a clear upward trend.", ko: "데이터는 뚜렷한 상승 추세를 보여 줘요." },
        },
        {
          en: "demonstrate", ipa: "[ˈdemənstreɪt]", ko: "입증하다, 보여 주다", pos: "v.",
          ex: { en: "The study demonstrates the link between sleep and memory.", ko: "그 연구는 수면과 기억의 연관성을 입증해요." },
        },
        {
          en: "acknowledge", ipa: "[əkˈnɑːlɪdʒ]", ko: "인정하다", pos: "v.",
          ex: { en: "She acknowledged her mistake.", ko: "그녀는 자신의 실수를 인정했어요." },
        },
        {
          en: "address", ipa: "[əˈdres]", ko: "(문제를) 다루다, 해결에 나서다", pos: "v.",
          etym: "동사는 강세가 뒤 [어드**레**스] — '주소'라는 명사로만 알고 있으면 뉴스 독해가 막혀요.",
          ex: { en: "We need to address this issue now.", ko: "이 문제를 지금 다뤄야 해요." },
        },
        {
          en: "assess", ipa: "[əˈses]", ko: "평가하다", pos: "v.",
          ex: { en: "Teachers assess students through projects, not just tests.", ko: "교사들은 시험만이 아니라 과제로도 학생을 평가해요." },
        },
        {
          en: "enhance", ipa: "[ɪnˈhæns]", ko: "향상시키다, 높이다", pos: "v.",
          ex: { en: "Regular exercise can enhance your concentration.", ko: "규칙적인 운동은 집중력을 높여 줄 수 있어요." },
        },
        {
          en: "undermine", ipa: "[ˌʌndərˈmaɪn]", ko: "약화시키다, 훼손하다", pos: "v.",
          etym: "under+mine(굴을 파다) — '밑을 파서 무너뜨리다'라는 그림이에요.",
          ex: { en: "Rumors can undermine trust.", ko: "소문은 신뢰를 무너뜨릴 수 있어요." },
        },
        {
          en: "advocate", ipa: "[ˈædvəkeɪt]", ko: "옹호하다, 지지하다", pos: "v.",
          etym: "ad(향해)+vocare(부르다) — voice, vocal과 같은 뿌리. '편들어 목소리 내다'예요.",
          ex: { en: "She advocates for stronger privacy laws.", ko: "그녀는 더 강력한 개인 정보 보호법을 지지해요." },
        },
        {
          en: "anticipate", ipa: "[ænˈtɪsɪpeɪt]", ko: "예상하다, 대비하다", pos: "v.",
          ex: { en: "We anticipate strong demand for the new model.", ko: "신모델에 대한 높은 수요를 예상하고 있어요." },
        },
        {
          en: "distinguish", ipa: "[dɪˈstɪŋɡwɪʃ]", ko: "구별하다", pos: "v.",
          ex: { en: "It's hard to distinguish fact from opinion online.", ko: "온라인에서는 사실과 의견을 구별하기 어려워요." },
        },
        {
          en: "perceive", ipa: "[pərˈsiːv]", ko: "인식하다, 지각하다", pos: "v.",
          etym: "per(완전히)+capere(붙잡다) — receive, concept와 같은 뿌리예요.",
          ex: { en: "Time is perceived differently in different cultures.", ko: "시간은 문화마다 다르게 인식돼요." },
        },
        {
          en: "justify", ipa: "[ˈdʒʌstɪfaɪ]", ko: "정당화하다", pos: "v.",
          ex: { en: "Nothing can justify treating people unfairly.", ko: "사람을 부당하게 대하는 건 무엇으로도 정당화할 수 없어요." },
        },
        {
          en: "convey", ipa: "[kənˈveɪ]", ko: "(뜻·감정을) 전달하다", pos: "v.",
          ex: { en: "Words can't convey how grateful I am.", ko: "얼마나 감사한지 말로는 다 전할 수 없어요." },
        },
      ],
    },
    {
      name: "시사·경제 보강",
      icon: "📰",
      words: [
        {
          en: "company", ipa: "[ˈkʌmpəni]", ko: "회사", pos: "n.",
          ex: { en: "I have been working at this company for five years.", ko: "이 회사에서 일한 지 5년 됐어요." },
        },
        {
          en: "sale", ipa: "[seɪl]", ko: "판매, 매출", pos: "n.",
          ex: { en: "Sales fell sharply; therefore, the company cut costs.", ko: "매출이 급감했고, 따라서 회사는 비용을 줄였어요." },
        },
        {
          en: "cost", ipa: "[kɔːst]", ko: "비용", pos: "n.",
          ex: { en: "The company cut costs.", ko: "회사는 비용을 줄였어요." },
        },
        {
          en: "service", ipa: "[ˈsɜːrvɪs]", ko: "서비스", pos: "n.",
          ex: { en: "The service was disappointing.", ko: "서비스가 실망스러웠어요." },
        },
        {
          en: "contract", ipa: "[ˈkɑːntrækt]", ko: "계약(서)", pos: "n.",
          ex: { en: "After reading the contract, I felt the terms were unfair.", ko: "계약서를 읽어보니 조건이 불공정해 보였어요." },
        },
        {
          en: "term", ipa: "[tɜːrm]", ko: "조건; 기간; 용어", pos: "n.",
          ex: { en: "The terms of the contract seemed unfair.", ko: "계약 조건이 불공정해 보였어요." },
        },
        {
          en: "data", ipa: "[ˈdeɪtə]", ko: "데이터, 자료", pos: "n.",
          ex: { en: "The data was incomplete. However, the trend was clear.", ko: "데이터는 불완전했어요. 하지만 추세는 분명했죠." },
        },
        {
          en: "trend", ipa: "[trend]", ko: "추세, 경향", pos: "n.",
          ex: { en: "The trend was clear.", ko: "추세는 분명했죠." },
        },
        {
          en: "number", ipa: "[ˈnʌmbər]", ko: "수, 숫자", pos: "n.",
          ex: { en: "A number of students have complained about the schedule.", ko: "여러 학생이 일정에 대해 항의했어요." },
        },
        {
          en: "paperwork", ipa: "[ˈpeɪpərwɜːrk]", ko: "서류 작업", pos: "n.",
          ex: { en: "The new policy reduced paperwork.", ko: "새 정책은 서류 작업을 줄였어요." },
        },
        {
          en: "applicant", ipa: "[ˈæplɪkənt]", ko: "지원자", pos: "n.",
          ex: { en: "The number of applicants has doubled this year.", ko: "올해 지원자 수가 두 배가 됐어요." },
        },
        {
          en: "application", ipa: "[ˌæplɪˈkeɪʃn]", ko: "지원(서), 신청(서)", pos: "n.",
          ex: { en: "Having reviewed your application, we are pleased to offer you the position.", ko: "지원서를 검토한 결과, 합격을 알려드리게 되어 기쁩니다." },
        },
        {
          en: "position", ipa: "[pəˈzɪʃn]", ko: "자리, 직위; 위치", pos: "n.",
          ex: { en: "We are pleased to offer you the position.", ko: "귀하께 합격을 알려드리게 되어 기쁩니다." },
        },
        {
          en: "staff", ipa: "[stæf]", ko: "직원(들)", pos: "n.",
          ex: { en: "The staff were not allowed to take photos.", ko: "직원들은 사진 촬영이 허용되지 않았어요." },
        },
        {
          en: "member", ipa: "[ˈmembər]", ko: "구성원, 멤버", pos: "n.",
          ex: { en: "Each member has a different role.", ko: "각 멤버는 서로 다른 역할이 있어요." },
        },
        {
          en: "role", ipa: "[roʊl]", ko: "역할", pos: "n.",
          ex: { en: "Each member has a different role.", ko: "각 멤버는 서로 다른 역할이 있어요." },
        },
        {
          en: "ambassador", ipa: "[æmˈbæsədər]", ko: "대사", pos: "n.",
          ex: { en: "She gave a dinner for the new ambassador.", ko: "그녀는 신임 대사를 위한 만찬을 열었어요." },
        },
        {
          en: "country", ipa: "[ˈkʌntri]", ko: "나라; 시골", pos: "n.",
          ex: { en: "The north of the country is mountainous.", ko: "그 나라의 북부는 산악 지대예요." },
        },
        {
          en: "nation", ipa: "[ˈneɪʃn]", ko: "국가, 국민", pos: "n.",
          ex: { en: "The whole nation watched the final.", ko: "온 국민이 결승전을 지켜봤어요." },
        },
        {
          en: "power", ipa: "[ˈpaʊər]", ko: "힘, 권력; 전력", pos: "n.",
          ex: { en: "Knowledge is power.", ko: "아는 것이 힘이에요." },
        },
        {
          en: "traffic", ipa: "[ˈtræfɪk]", ko: "교통(량)", pos: "n.",
          ex: { en: "We got stuck in heavy traffic.", ko: "교통체증에 갇혔어요." },
        },
        {
          en: "exam", ipa: "[ɪɡˈzæm]", ko: "시험", pos: "n.",
          ex: { en: "If I had studied harder, I would have passed the exam.", ko: "더 열심히 공부했더라면 시험에 합격했을 텐데요." },
        },
        {
          en: "college", ipa: "[ˈkɑːlɪdʒ]", ko: "대학", pos: "n.",
          ex: { en: "I have known him since college.", ko: "대학 때부터 그를 알고 지냈어요." },
        },
        {
          en: "smartphone", ipa: "[ˈsmɑːrtfoʊn]", ko: "스마트폰", pos: "n.",
          ex: { en: "The smartphone changed how we live.", ko: "스마트폰은 우리의 삶을 바꿨어요." },
        },
        {
          en: "online", ipa: "[ˌɔːnˈlaɪn]", ko: "온라인의, 온라인으로", pos: "adj., adv.",
          ex: { en: "While online classes are convenient, they lack human connection.", ko: "온라인 수업은 편리한 반면, 사람 사이의 교감이 부족해요." },
        },
      ],
    },
    {
      name: "환경·자연 보강",
      icon: "🏞️",
      words: [
        {
          en: "river", ipa: "[ˈrɪvər]", ko: "강", pos: "n.",
          ex: { en: "The river runs through the city.", ko: "강이 도시를 가로질러 흘러요." },
        },
        {
          en: "mount", ipa: "[maʊnt]", ko: "~산 (산 이름 앞)", pos: "n.",
          ex: { en: "We climbed the mountain last fall.", ko: "지난가을에 그 산에 올랐어요." },
        },
        {
          en: "climb", ipa: "[klaɪm]", ko: "오르다, 등반하다", pos: "v.",
          ex: { en: "We climbed the mountain last fall.", ko: "지난가을에 그 산에 올랐어요." },
        },
        {
          en: "bridge", ipa: "[brɪdʒ]", ko: "다리", pos: "n.",
          ex: { en: "Built in the 1970s, the bridge needs major repairs.", ko: "1970년대에 지어진 그 다리는 대대적인 보수가 필요해요." },
        },
        {
          en: "north", ipa: "[nɔːrθ]", ko: "북쪽(의)", pos: "n., adj.",
          ex: { en: "The north of the country is mountainous.", ko: "그 나라의 북부는 산악 지대예요." },
        },
        {
          en: "south", ipa: "[saʊθ]", ko: "남쪽(의)", pos: "n., adj.",
          ex: { en: "The south of the country is flat.", ko: "그 나라의 남부는 평탄해요." },
        },
        {
          en: "mountainous", ipa: "[ˈmaʊntənəs]", ko: "산이 많은, 산악의", pos: "adj.",
          ex: { en: "The north is mountainous, whereas the south is flat.", ko: "북부는 산악 지대인 반면 남부는 평탄해요." },
        },
        {
          en: "flat", ipa: "[flæt]", ko: "평평한", pos: "adj.",
          ex: { en: "The south is flat.", ko: "남부는 평탄해요." },
        },
        {
          en: "heavy", ipa: "[ˈhevi]", ko: "(비·교통이) 심한; 무거운", pos: "adj.",
          ex: { en: "We had heavy rain all weekend.", ko: "주말 내내 폭우가 내렸어요." },
        },
        {
          en: "future", ipa: "[ˈfjuːtʃər]", ko: "미래", pos: "n.",
          ex: { en: "We talked about the future.", ko: "우리는 미래에 대해 이야기했어요." },
        },
        {
          en: "life", ipa: "[laɪf]", ko: "인생, 삶; 생명", pos: "n.",
          ex: { en: "Life is short.", ko: "인생은 짧아요." },
        },
      ],
    },
    {
      name: "논증·에세이 어휘 보강",
      icon: "🧷",
      words: [
        {
          en: "however", ipa: "[haʊˈevər]", ko: "하지만, 그러나", pos: "adv.",
          ex: { en: "The plan was risky. However, we decided to go ahead.", ko: "그 계획은 위험했어요. 하지만 우리는 추진하기로 했죠." },
        },
        {
          en: "thus", ipa: "[ðʌs]", ko: "따라서, 그러므로", pos: "adv.",
          ex: { en: "The experiment failed twice; thus, we revised the design.", ko: "실험이 두 번 실패했고, 따라서 설계를 수정했어요." },
        },
        {
          en: "moreover", ipa: "[mɔːrˈoʊvər]", ko: "게다가", pos: "adv.",
          ex: { en: "The hotel was expensive. Moreover, the service was disappointing.", ko: "그 호텔은 비쌌어요. 게다가 서비스도 실망스러웠죠." },
        },
        {
          en: "hence", ipa: "[hens]", ko: "그래서, 그런 이유로", pos: "adv.",
          ex: { en: "He grew up in Italy — hence his love of Italian food.", ko: "그는 이탈리아에서 자랐어요 — 그래서 이탈리아 음식을 사랑하죠." },
        },
        {
          en: "also", ipa: "[ˈɔːlsoʊ]", ko: "또한, ~도", pos: "adv.",
          ex: { en: "This plan saves money, and it also saves time.", ko: "이 계획은 돈을 아끼고, 시간도 아껴줍니다." },
        },
        {
          en: "rather", ipa: "[ˈræðər]", ko: "꽤, 다소; 오히려", pos: "adv.",
          ex: { en: "I am rather quiet.", ko: "저는 조용한 편이에요." },
        },
        {
          en: "generally", ipa: "[ˈdʒenrəli]", ko: "일반적으로", pos: "adv.",
          ex: { en: "Generally speaking, prices rise in spring.", ko: "일반적으로 봄에는 물가가 올라요." },
        },
        {
          en: "rarely", ipa: "[ˈrerli]", ko: "좀처럼 ~않다", pos: "adv.",
          ex: { en: "Rarely do we get a second chance like this.", ko: "이런 두 번째 기회는 좀처럼 오지 않죠." },
        },
        {
          en: "highly", ipa: "[ˈhaɪli]", ko: "매우", pos: "adv.",
          ex: { en: "It's highly unlikely that he'll come.", ko: "그가 올 가능성은 매우 낮아요." },
        },
        {
          en: "fully", ipa: "[ˈfʊli]", ko: "충분히, 완전히", pos: "adv.",
          ex: { en: "I'm fully aware of the risks.", ko: "위험은 충분히 알고 있어요." },
        },
        {
          en: "sharply", ipa: "[ˈʃɑːrpli]", ko: "급격히", pos: "adv.",
          ex: { en: "Sales fell sharply.", ko: "매출이 급감했어요." },
        },
        {
          en: "bitterly", ipa: "[ˈbɪtərli]", ko: "살을 에는 듯이; 몹시", pos: "adv.",
          ex: { en: "It was bitterly cold that morning.", ko: "그날 아침은 살을 에는 듯 추웠어요." },
        },
        {
          en: "clearly", ipa: "[ˈklɪrli]", ko: "분명히", pos: "adv.",
          ex: { en: "He was clearly upset.", ko: "그는 분명히 기분이 상해 있었어요." },
        },
        {
          en: "finally", ipa: "[ˈfaɪnəli]", ko: "마침내", pos: "adv.",
          ex: { en: "She finally went home.", ko: "그녀는 마침내 퇴근했어요." },
        },
        {
          en: "several", ipa: "[ˈsevrəl]", ko: "몇몇의", pos: "adj.",
          ex: { en: "So strong was the wind that several trees fell.", ko: "바람이 어찌나 셌는지 나무가 몇 그루나 쓰러졌어요." },
        },
        {
          en: "everyone", ipa: "[ˈevriwʌn]", ko: "모두", pos: "pron.",
          ex: { en: "The new policy saves everyone time.", ko: "새 정책은 모두의 시간을 아껴줘요." },
        },
        {
          en: "consistency", ipa: "[kənˈsɪstənsi]", ko: "꾸준함, 일관성", pos: "n.",
          ex: { en: "What matters most is consistency.", ko: "가장 중요한 것은 꾸준함이에요." },
        },
        {
          en: "connection", ipa: "[kəˈnekʃn]", ko: "교감, 연결", pos: "n.",
          ex: { en: "Online classes lack human connection.", ko: "온라인 수업은 사람 사이의 교감이 부족해요." },
        },
        {
          en: "human", ipa: "[ˈhjuːmən]", ko: "인간의; 인간", pos: "adj., n.",
          ex: { en: "Online classes lack human connection.", ko: "온라인 수업은 사람 사이의 교감이 부족해요." },
        },
        {
          en: "chance", ipa: "[tʃæns]", ko: "기회; 가능성", pos: "n.",
          ex: { en: "Rarely do we get a second chance like this.", ko: "이런 두 번째 기회는 좀처럼 오지 않죠." },
        },
        {
          en: "mistake", ipa: "[mɪˈsteɪk]", ko: "실수", pos: "n.",
          ex: { en: "I made a big mistake on the report.", ko: "보고서에서 큰 실수를 했어요." },
        },
        {
          en: "risk", ipa: "[rɪsk]", ko: "위험 (요소)", pos: "n.",
          ex: { en: "I'm fully aware of the risks.", ko: "위험은 충분히 알고 있어요." },
        },
        {
          en: "character", ipa: "[ˈkærəktər]", ko: "인격, 성격; 등장인물", pos: "n.",
          ex: { en: "Judge people by their character.", ko: "사람은 인격으로 판단하세요." },
        },
        {
          en: "content", ipa: "[ˈkɑːntent]", ko: "내용(물)", pos: "n.",
          ex: { en: "The content of the speech was simple.", ko: "연설의 내용은 단순했어요." },
        },
      ],
    },
    {
      name: "뉘앙스 동사 보강",
      icon: "🎯",
      words: [
        {
          en: "wish", ipa: "[wɪʃ]", ko: "~이면 좋겠다, 바라다", pos: "v.",
          ex: { en: "I wish I had more time.", ko: "시간이 더 있으면 좋을 텐데요." },
        },
        {
          en: "spend", ipa: "[spend]", ko: "(돈·시간을) 쓰다", pos: "v.",
          ex: { en: "You shouldn't have spent so much money.", ko: "돈을 그렇게 많이 쓰지 말았어야지." },
        },
        {
          en: "save", ipa: "[seɪv]", ko: "아끼다, 모으다; 구하다", pos: "v.",
          ex: { en: "This plan saves money and time.", ko: "이 계획은 돈과 시간을 아껴줍니다." },
        },
        {
          en: "plan", ipa: "[plæn]", ko: "계획; 계획하다", pos: "n., v.",
          ex: { en: "The plan was risky.", ko: "그 계획은 위험했어요." },
        },
        {
          en: "design", ipa: "[dɪˈzaɪn]", ko: "디자인, 설계; 설계하다", pos: "n., v.",
          ex: { en: "It was the design that impressed me most.", ko: "가장 인상 깊었던 건 바로 디자인이었어요." },
        },
        {
          en: "impress", ipa: "[ɪmˈpres]", ko: "깊은 인상을 주다", pos: "v.",
          ex: { en: "It was the design that impressed me most.", ko: "가장 인상 깊었던 건 바로 디자인이었어요." },
        },
        {
          en: "matter", ipa: "[ˈmætər]", ko: "중요하다; 문제", pos: "v., n.",
          ex: { en: "What matters most is consistency.", ko: "가장 중요한 것은 꾸준함이에요." },
        },
        {
          en: "realize", ipa: "[ˈriːəlaɪz]", ko: "깨닫다", pos: "v.",
          ex: { en: "She realized she had left her phone at home.", ko: "폰을 집에 두고 온 걸 깨달았어요." },
        },
        {
          en: "notice", ipa: "[ˈnoʊtɪs]", ko: "알아차리다", pos: "v.",
          ex: { en: "Walking down the street, I noticed a new cafe.", ko: "길을 걷다가 새 카페를 발견했어요." },
        },
        {
          en: "review", ipa: "[rɪˈvjuː]", ko: "검토하다; 검토, 후기", pos: "v., n.",
          ex: { en: "Having reviewed your application, we are pleased to offer you the position.", ko: "지원서를 검토한 결과, 합격을 알려드리게 되어 기쁩니다." },
        },
        {
          en: "judge", ipa: "[dʒʌdʒ]", ko: "판단하다; 판사", pos: "v., n.",
          ex: { en: "Judging from his accent, he must be from Busan.", ko: "억양으로 판단하건대 그는 부산 출신임에 틀림없어요." },
        },
        {
          en: "rise", ipa: "[raɪz]", ko: "오르다, 상승하다", pos: "v.",
          ex: { en: "Prices rise in spring.", ko: "봄에는 물가가 올라요." },
        },
        {
          en: "fail", ipa: "[feɪl]", ko: "실패하다", pos: "v.",
          ex: { en: "The experiment failed twice.", ko: "실험이 두 번 실패했어요." },
        },
        {
          en: "revise", ipa: "[rɪˈvaɪz]", ko: "수정하다", pos: "v.",
          ex: { en: "We revised the design.", ko: "설계를 수정했어요." },
        },
        {
          en: "reduce", ipa: "[rɪˈduːs]", ko: "줄이다", pos: "v.",
          ex: { en: "The new policy reduced paperwork.", ko: "새 정책은 서류 작업을 줄였어요." },
        },
        {
          en: "grow", ipa: "[ɡroʊ]", ko: "자라다; 키우다; 커지다", pos: "v.",
          ex: { en: "He grew up in a small town.", ko: "그는 작은 마을에서 자랐어요." },
        },
        {
          en: "admit", ipa: "[ədˈmɪt]", ko: "인정하다", pos: "v.",
          ex: { en: "I got my brother to admit his mistake.", ko: "동생이 실수를 인정하게 만들었어요." },
        },
        {
          en: "cross", ipa: "[krɔːs]", ko: "건너다", pos: "v.",
          ex: { en: "I saw her cross the street.", ko: "그녀가 길을 건너는 걸 봤어요." },
        },
        {
          en: "shout", ipa: "[ʃaʊt]", ko: "소리치다", pos: "v.",
          ex: { en: "We heard someone shouting outside.", ko: "밖에서 누가 소리치는 게 들렸어요." },
        },
        {
          en: "replace", ipa: "[rɪˈpleɪs]", ko: "교체하다", pos: "v.",
          ex: { en: "She got her phone screen replaced.", ko: "그녀는 폰 액정을 교체했어요." },
        },
        {
          en: "allow", ipa: "[əˈlaʊ]", ko: "허용하다", pos: "v.",
          ex: { en: "The staff were not allowed to take photos.", ko: "직원들은 사진 촬영이 허용되지 않았어요." },
        },
        {
          en: "complain", ipa: "[kəmˈpleɪn]", ko: "불평하다, 항의하다", pos: "v.",
          ex: { en: "A number of students have complained about the schedule.", ko: "여러 학생이 일정에 대해 항의했어요." },
        },
        {
          en: "double", ipa: "[ˈdʌbl]", ko: "두 배가 되다; 두 배의", pos: "v., adj.",
          ex: { en: "The number of applicants has doubled this year.", ko: "올해 지원자 수가 두 배가 됐어요." },
        },
        {
          en: "redo", ipa: "[ˌriːˈduː]", ko: "다시 하다", pos: "v.",
          ex: { en: "My boss made me redo the whole report.", ko: "상사가 보고서를 통째로 다시 쓰게 했어요." },
        },
        {
          en: "pack", ipa: "[pæk]", ko: "짐을 싸다", pos: "v.",
          ex: { en: "I've been packing all day.", ko: "하루 종일 짐 싸는 중이었어요." },
        },
        {
          en: "stick", ipa: "[stɪk]", ko: "꼼짝 못 하게 되다; 붙(이)다; 막대기", pos: "v., n.",
          ex: { en: "We got stuck in heavy traffic.", ko: "교통체증에 갇혔어요." },
        },
        {
          en: "break", ipa: "[breɪk]", ko: "휴식; 깨다, 부수다", pos: "n., v.",
          ex: { en: "Let's take a break and have some coffee.", ko: "잠깐 쉬면서 커피 마셔요." },
        },
        {
          en: "favor", ipa: "[ˈfeɪvər]", ko: "부탁; 호의", pos: "n.",
          ex: { en: "Could you do me a favor?", ko: "부탁 하나 들어줄래요?" },
        },
      ],
    },
    {
      name: "상태·평가 형용사",
      icon: "🌡️",
      words: [
        {
          en: "strong", ipa: "[strɔːŋ]", ko: "강한, 센", pos: "adj.",
          ex: { en: "So strong was the wind that several trees fell.", ko: "바람이 어찌나 셌는지 나무가 몇 그루나 쓰러졌어요." },
        },
        {
          en: "unfair", ipa: "[ˌʌnˈfer]", ko: "불공정한", pos: "adj.",
          ex: { en: "The terms seemed unfair.", ko: "조건이 불공정해 보였어요." },
        },
        {
          en: "incomplete", ipa: "[ˌɪnkəmˈpliːt]", ko: "불완전한", pos: "adj.",
          ex: { en: "The data was incomplete.", ko: "데이터는 불완전했어요." },
        },
        {
          en: "clear", ipa: "[klɪr]", ko: "분명한; 맑은", pos: "adj.",
          ex: { en: "The trend was clear.", ko: "추세는 분명했죠." },
        },
        {
          en: "afraid", ipa: "[əˈfreɪd]", ko: "두려워하는", pos: "adj.",
          ex: { en: "She is afraid of flying.", ko: "그녀는 비행을 무서워해요." },
        },
        {
          en: "long", ipa: "[lɔːŋ]", ko: "오래, 긴", pos: "adv., adj.",
          ex: { en: "How long have you been learning English?", ko: "영어 배운 지 얼마나 됐어요?" },
        },
        {
          en: "short", ipa: "[ʃɔːrt]", ko: "짧은", pos: "adj.",
          ex: { en: "Life is short.", ko: "인생은 짧아요." },
        },
        {
          en: "loyal", ipa: "[ˈlɔɪəl]", ko: "충성스러운", pos: "adj.",
          ex: { en: "Dogs are loyal animals.", ko: "개는 충성스러운 동물이에요." },
        },
        {
          en: "risky", ipa: "[ˈrɪski]", ko: "위험한", pos: "adj.",
          ex: { en: "The plan was risky.", ko: "그 계획은 위험했어요." },
        },
        {
          en: "disappointing", ipa: "[ˌdɪsəˈpɔɪntɪŋ]", ko: "실망스러운", pos: "adj.",
          ex: { en: "The service was disappointing.", ko: "서비스가 실망스러웠어요." },
        },
        {
          en: "frustrating", ipa: "[ˈfrʌstreɪtɪŋ]", ko: "답답하게 하는, 좌절감을 주는", pos: "adj.",
          ex: { en: "Talking to him is so frustrating.", ko: "걔랑 얘기하면 진짜 답답해." },
        },
        {
          en: "unlikely", ipa: "[ʌnˈlaɪkli]", ko: "~할 것 같지 않은", pos: "adj.",
          ex: { en: "It's highly unlikely that he'll come.", ko: "그가 올 가능성은 매우 낮아요." },
        },
        {
          en: "aware", ipa: "[əˈwer]", ko: "알고 있는, 인식하는", pos: "adj.",
          ex: { en: "I'm fully aware of the risks.", ko: "위험은 충분히 알고 있어요." },
        },
        {
          en: "whole", ipa: "[hoʊl]", ko: "전체의", pos: "adj.",
          ex: { en: "My boss made me redo the whole report.", ko: "상사가 보고서를 통째로 다시 쓰게 했어요." },
        },
        {
          en: "different", ipa: "[ˈdɪfrənt]", ko: "다른", pos: "adj.",
          ex: { en: "Each member has a different role.", ko: "각 멤버는 서로 다른 역할이 있어요." },
        },
        {
          en: "correct", ipa: "[kəˈrekt]", ko: "맞는, 정확한", pos: "adj.",
          ex: { en: "Neither answer is correct.", ko: "두 답 모두 틀렸어요." },
        },
        {
          en: "wet", ipa: "[wet]", ko: "젖은", pos: "adj.",
          ex: { en: "This towel is wet.", ko: "이 수건은 젖었어요." },
        },
        {
          en: "outgoing", ipa: "[ˌaʊtˈɡoʊɪŋ]", ko: "외향적인", pos: "adj.",
          ex: { en: "My sister is outgoing, whereas I am rather quiet.", ko: "언니는 외향적인 반면 저는 조용한 편이에요." },
        },
        {
          en: "major", ipa: "[ˈmeɪdʒər]", ko: "대대적인, 주요한", pos: "adj.",
          ex: { en: "The bridge needs major repairs.", ko: "그 다리는 대대적인 보수가 필요해요." },
        },
        {
          en: "ahead", ipa: "[əˈhed]", ko: "앞으로, 앞에", pos: "adv.",
          ex: { en: "We decided to go ahead.", ko: "우리는 추진하기로 했죠." },
        },
        {
          en: "sudden", ipa: "[ˈsʌdn]", ko: "갑작스러운", pos: "adj.",
          ex: { en: "His sudden departure surprised everyone.", ko: "그가 갑자기 떠나서 모두가 놀랐어요." },
        },
        {
          en: "anytime", ipa: "[ˈenitaɪm]", ko: "언제든지", pos: "adv.",
          ex: { en: "Call me anytime.", ko: "언제든 전화해요." },
        },
      ],
    },
    {
      name: "생활 명사 보강",
      icon: "🧳",
      words: [
        {
          en: "flight", ipa: "[flaɪt]", ko: "비행(편)", pos: "n.",
          ex: { en: "We almost missed the flight.", ko: "비행기를 놓칠 뻔했어요." },
        },
        {
          en: "photo", ipa: "[ˈfoʊtoʊ]", ko: "사진", pos: "n.",
          ex: { en: "I wish I had taken more photos that day.", ko: "그날 사진을 더 찍어둘 걸 그랬어요." },
        },
        {
          en: "mess", ipa: "[mes]", ko: "엉망(인 상태)", pos: "n.",
          ex: { en: "Sorry about the mess — I've been packing all day.", ko: "어질러져서 미안해요. 하루 종일 짐 싸는 중이었거든요." },
        },
        {
          en: "accent", ipa: "[ˈæksent]", ko: "억양, 악센트", pos: "n.",
          ex: { en: "Judging from his accent, he must be from Busan.", ko: "억양으로 판단하건대 그는 부산 출신임에 틀림없어요." },
        },
        {
          en: "breath", ipa: "[breθ]", ko: "숨, 호흡", pos: "n.",
          ex: { en: "You're out of breath. Have you been running?", ko: "숨이 차네요. 뛰어왔어요?" },
        },
        {
          en: "snack", ipa: "[snæk]", ko: "간식, 과자", pos: "n.",
          ex: { en: "Someone has been eating my snacks!", ko: "누가 내 과자를 계속 먹어왔어!" },
        },
        {
          en: "twenty", ipa: "[ˈtwenti]", ko: "스물, 20; 20대", pos: "num., n.",
          ex: { en: "I should have saved money in my twenties.", ko: "20대에 돈을 모았어야 했어요." },
        },
        {
          en: "festival", ipa: "[ˈfestɪvl]", ko: "축제", pos: "n.",
          ex: { en: "We had a great time at the festival.", ko: "축제에서 정말 즐거운 시간을 보냈어요." },
        },
        {
          en: "passport", ipa: "[ˈpæspɔːrt]", ko: "여권", pos: "n.",
          ex: { en: "He had his passport stolen in the crowd.", ko: "그는 인파 속에서 여권을 도둑맞았어요." },
        },
        {
          en: "crowd", ipa: "[kraʊd]", ko: "인파, 군중", pos: "n.",
          ex: { en: "He had his passport stolen in the crowd.", ko: "그는 인파 속에서 여권을 도둑맞았어요." },
        },
        {
          en: "front", ipa: "[frʌnt]", ko: "앞(쪽)", pos: "n.",
          ex: { en: "He was made to apologize in front of everyone.", ko: "그는 모두 앞에서 사과하게끔 됐어요." },
        },
        {
          en: "train", ipa: "[treɪn]", ko: "기차", pos: "n.",
          ex: { en: "We have a little time before the train.", ko: "기차 전까지 시간이 좀 있어요." },
        },
        {
          en: "towel", ipa: "[ˈtaʊəl]", ko: "수건", pos: "n.",
          ex: { en: "This towel is wet — can I get another?", ko: "이 수건 젖었는데 하나 더 주시겠어요?" },
        },
        {
          en: "repair", ipa: "[rɪˈper]", ko: "수리; 수리하다", pos: "n., v.",
          ex: { en: "The bridge needs major repairs.", ko: "그 다리는 대대적인 보수가 필요해요." },
        },
        {
          en: "smoker", ipa: "[ˈsmoʊkər]", ko: "흡연자", pos: "n.",
          ex: { en: "He's a heavy smoker.", ko: "그는 골초예요." },
        },
        {
          en: "lack", ipa: "[læk]", ko: "~이 부족하다; 부족", pos: "v., n.",
          ex: { en: "Online classes lack human connection.", ko: "온라인 수업은 교감이 부족해요." },
        },
      ],
    },
    {
      name: "상태 동사 보강",
      icon: "➕",
      words: [
        {
          en: "seem", ipa: "[siːm]", ko: "~처럼 보이다", pos: "v.",
          ex: { en: "The terms seemed unfair.", ko: "조건이 불공정해 보였어요." },
        },
        {
          en: "renew", ipa: "[rɪˈnuː]", ko: "갱신하다", pos: "v.",
          ex: { en: "I need to renew my visa.", ko: "비자를 갱신해야 해요." },
        },
      ],
    },
  ],
}
