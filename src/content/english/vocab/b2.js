export default {
  level: "B2",
  title: "B2 상급 어휘",
  desc: "뉴스·에세이·토론에 필요한 70개 — 추상 명사와 imply/suggest/indicate 같은 뉘앙스 동사를 가려 써요.",
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
  ],
}
