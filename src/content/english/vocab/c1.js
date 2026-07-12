const themes = {
  level: "C1",
  title: "C1 고급 어휘",
  desc: "학술 영어의 골격 237개 — AWL 핵심, 라틴·그리스 어근 패밀리, 격식 동사, 그리고 회화의 윤활유인 관용구까지.",
  themes: [
    {
      name: "학술 어휘 (AWL 핵심)",
      icon: "🎓",
      words: [
        {
          en: "paradigm", ipa: "[ˈpærədaɪm]", ko: "패러다임, 인식 틀", pos: "n.",
          etym: "그리스어 para(곁)+deigma(보기) — g는 묵음이에요.",
          ex: { en: "The discovery shifted the scientific paradigm.", ko: "그 발견은 과학의 패러다임을 바꿔 놓았어요." },
        },
        {
          en: "empirical", ipa: "[ɪmˈpɪrɪkl]", ko: "경험적인, 실증적인", pos: "adj.",
          etym: "그리스어 empeiria(경험) — '이론이 아니라 관찰·실험에 근거한'이라는 뜻이에요.",
          ex: { en: "There is little empirical evidence for this claim.", ko: "이 주장에는 실증적 근거가 거의 없어요." },
        },
        {
          en: "coherent", ipa: "[koʊˈhɪrənt]", ko: "일관성 있는, 논리 정연한", pos: "adj.",
          ex: { en: "Her essay presents a coherent argument throughout.", ko: "그녀의 에세이는 처음부터 끝까지 일관된 논지를 펼쳐요." },
        },
        {
          en: "ambiguous", ipa: "[æmˈbɪɡjuəs]", ko: "중의적인, 모호한", pos: "adj.",
          ex: { en: "The contract language is deliberately ambiguous.", ko: "계약서 문구가 의도적으로 모호해요." },
        },
        {
          en: "arbitrary", ipa: "[ˈɑːrbɪtreri]", ko: "자의적인, 임의의", pos: "adj.",
          ex: { en: "The rule seems completely arbitrary.", ko: "그 규칙은 완전히 자의적으로 보여요." },
        },
        {
          en: "comprehensive", ipa: "[ˌkɑːmprɪˈhensɪv]", ko: "포괄적인, 종합적인", pos: "adj.",
          etym: "'이해심 많은'이 아니에요 — comprehension(이해)과 형태가 닮아 한국 학습자가 자주 헷갈려요.",
          ex: { en: "The report gives a comprehensive overview of the market.", ko: "그 보고서는 시장을 포괄적으로 개관해요." },
        },
        {
          en: "explicit", ipa: "[ɪkˈsplɪsɪt]", ko: "명시적인, 노골적인", pos: "adj.",
          etym: "ex(밖)+plicare(접다) — '접힌 것을 밖으로 펼친'. implicit(접어 넣은)과 짝이에요.",
          ex: { en: "The contract is explicit about payment terms.", ko: "계약서는 지급 조건을 명시하고 있어요." },
        },
        {
          en: "implicit", ipa: "[ɪmˈplɪsɪt]", ko: "암묵적인, 내포된", pos: "adj.",
          ex: { en: "There was an implicit threat in his words.", ko: "그의 말에는 암묵적인 위협이 담겨 있었어요." },
        },
        {
          en: "inherent", ipa: "[ɪnˈhɪrənt]", ko: "내재된, 고유한", pos: "adj.",
          ex: { en: "Risk is inherent in any investment.", ko: "위험은 모든 투자에 내재해 있어요." },
        },
        {
          en: "subsequent", ipa: "[ˈsʌbsɪkwənt]", ko: "그 이후의, 뒤이은", pos: "adj.",
          ex: { en: "Subsequent studies confirmed the original findings.", ko: "후속 연구들이 최초의 결과를 확인해 줬어요." },
        },
        {
          en: "preliminary", ipa: "[prɪˈlɪmɪneri]", ko: "예비의, 사전의", pos: "adj.",
          etym: "pre(앞)+limen(문지방) — '문턱을 넘기 전의'라는 그림이에요.",
          ex: { en: "The preliminary results look very promising.", ko: "예비 결과가 아주 유망해 보여요." },
        },
        {
          en: "rigorous", ipa: "[ˈrɪɡərəs]", ko: "엄밀한, 철저한", pos: "adj.",
          ex: { en: "The paper passed a rigorous review process.", ko: "그 논문은 엄밀한 심사 과정을 통과했어요." },
        },
        {
          en: "plausible", ipa: "[ˈplɔːzəbl]", ko: "그럴듯한, 타당해 보이는", pos: "adj.",
          ex: { en: "Her explanation sounds plausible.", ko: "그녀의 설명은 그럴듯하게 들려요." },
        },
        {
          en: "discrepancy", ipa: "[dɪˈskrepənsi]", ko: "불일치, 차이", pos: "n.",
          ex: { en: "There is a discrepancy between the two reports.", ko: "두 보고서 사이에 불일치가 있어요." },
        },
        {
          en: "correlation", ipa: "[ˌkɔːrəˈleɪʃn]", ko: "상관관계", pos: "n.",
          ex: { en: "Correlation does not imply causation.", ko: "상관관계가 인과관계를 뜻하지는 않아요." },
        },
      ],
    },
    {
      name: "라틴·그리스 어근 패밀리",
      icon: "🌱",
      words: [
        {
          en: "inspect", ipa: "[ɪnˈspekt]", ko: "점검하다, 검사하다", pos: "v.",
          etym: "spect(보다) 패밀리 — inspect(안을 보다)·respect(다시 보다)·prospect(앞을 보다)·retrospect(뒤를 보다). 어근 하나로 네 단어를 벌어요.",
          ex: { en: "Engineers inspected the bridge for cracks.", ko: "기술자들이 다리에 균열이 있는지 점검했어요." },
        },
        {
          en: "spectator", ipa: "[ˈspekteɪtər]", ko: "관중, 구경꾼", pos: "n.",
          etym: "spect(보다)+-or(사람) — '보는 사람'. spectacle(볼거리)도 형제예요.",
          ex: { en: "Thousands of spectators filled the stadium.", ko: "수천 명의 관중이 경기장을 가득 메웠어요." },
        },
        {
          en: "predict", ipa: "[prɪˈdɪkt]", ko: "예측하다", pos: "v.",
          etym: "dict(말하다) 패밀리 — pre(미리)+dict. dictionary, verdict, contradict가 모두 형제예요.",
          ex: { en: "No one can predict the market with certainty.", ko: "누구도 시장을 확실하게 예측할 수는 없어요." },
        },
        {
          en: "contradict", ipa: "[ˌkɑːntrəˈdɪkt]", ko: "반박하다, 모순되다", pos: "v.",
          etym: "contra(반대)+dict(말하다) — '맞서서 말하다'예요.",
          ex: { en: "His testimony contradicts the official report.", ko: "그의 증언은 공식 보고서와 모순돼요." },
        },
        {
          en: "verdict", ipa: "[ˈvɜːrdɪkt]", ko: "평결, 판단", pos: "n.",
          etym: "ver(진실)+dict(말하다) — '진실을 말함'. verify(검증하다)의 ver와 같아요.",
          ex: { en: "The jury reached a verdict after two days.", ko: "배심원단은 이틀 만에 평결에 도달했어요." },
        },
        {
          en: "export", ipa: "[ˈekspɔːrt]", ko: "수출(품); 수출하다", pos: "n.",
          etym: "port(나르다) 패밀리 — ex(밖)+port. import, transport, portable이 형제. 동사는 강세가 뒤 [ɪkˈspɔːrt]예요.",
          ex: { en: "Semiconductors remain Korea's most important export.", ko: "반도체는 여전히 한국의 가장 중요한 수출품이에요." },
        },
        {
          en: "portable", ipa: "[ˈpɔːrtəbl]", ko: "휴대용의", pos: "adj.",
          etym: "port(나르다)+-able — '나를 수 있는'. porter(짐꾼)도 같은 뿌리예요.",
          ex: { en: "I bought a portable charger for traveling.", ko: "여행용으로 휴대용 충전기를 샀어요." },
        },
        {
          en: "prescribe", ipa: "[prɪˈskraɪb]", ko: "처방하다; 규정하다", pos: "v.",
          etym: "scrib(쓰다) 패밀리 — pre(미리)+쓰다 = 처방하다. subscribe, manuscript, script가 형제예요.",
          ex: { en: "The doctor prescribed antibiotics.", ko: "의사가 항생제를 처방했어요." },
        },
        {
          en: "manuscript", ipa: "[ˈmænjuskrɪpt]", ko: "원고, 필사본", pos: "n.",
          etym: "manu(손)+script(쓴 것) — '손으로 쓴 것'. manual(수동의)과 연결돼요.",
          ex: { en: "She sent her manuscript to several publishers.", ko: "그녀는 여러 출판사에 원고를 보냈어요." },
        },
        {
          en: "induce", ipa: "[ɪnˈduːs]", ko: "유도하다, 유발하다", pos: "v.",
          etym: "duc(이끌다) 패밀리 — introduce, reduce, conduct, educate가 모두 형제예요.",
          ex: { en: "Lack of sleep can induce serious health problems.", ko: "수면 부족은 심각한 건강 문제를 유발할 수 있어요." },
        },
        {
          en: "conduct", ipa: "[kənˈdʌkt]", ko: "(조사 등을) 수행하다; 지휘하다", pos: "v.",
          etym: "con(함께)+duct(이끌다). 명사 '행동'은 강세가 앞 [ˈkɑːndʌkt]이에요.",
          ex: { en: "They conducted a nationwide survey.", ko: "그들은 전국 단위 설문 조사를 수행했어요." },
        },
        {
          en: "revoke", ipa: "[rɪˈvoʊk]", ko: "취소하다, 철회하다", pos: "v.",
          etym: "voc/vok(부르다) 패밀리 — re(도로)+부르다 = 취소하다. vocabulary, advocate, vocation이 형제예요.",
          ex: { en: "His driver's license was revoked after the accident.", ko: "사고 후 그의 운전면허가 취소됐어요." },
        },
        {
          en: "chronic", ipa: "[ˈkrɑːnɪk]", ko: "만성의, 고질적인", pos: "adj.",
          etym: "그리스어 chronos(시간) 패밀리 — chronology(연대기), synchronize(시간을 맞추다)가 형제예요.",
          ex: { en: "He suffers from chronic back pain.", ko: "그는 만성 허리 통증에 시달려요." },
        },
        {
          en: "sympathy", ipa: "[ˈsɪmpəθi]", ko: "동정, 공감", pos: "n.",
          etym: "그리스어 sym(함께)+pathos(감정) 패밀리 — empathy(감정 이입), apathy(무감정), pathetic이 형제예요.",
          ex: { en: "She expressed her sympathy for the victims.", ko: "그녀는 피해자들에게 위로의 마음을 전했어요." },
        },
        {
          en: "autonomy", ipa: "[ɔːˈtɑːnəmi]", ko: "자율(성), 자치", pos: "n.",
          etym: "그리스어 auto(스스로)+nomos(법) — '스스로 다스림'. automatic, autograph가 형제예요.",
          ex: { en: "The new policy gives schools greater autonomy.", ko: "새 정책은 학교에 더 큰 자율성을 줘요." },
        },
      ],
    },
    {
      name: "격식 동사",
      icon: "🖋️",
      words: [
        {
          en: "comprise", ipa: "[kəmˈpraɪz]", ko: "~로 구성되다, 차지하다", pos: "v.",
          ex: { en: "The committee comprises ten members.", ko: "위원회는 열 명의 위원으로 구성돼요." },
        },
        {
          en: "constitute", ipa: "[ˈkɑːnstɪtuːt]", ko: "구성하다, ~이 되다", pos: "v.",
          etym: "con+statuere(세우다) — statue, status, institute와 같은 뿌리예요.",
          ex: { en: "Women constitute over half of the workforce.", ko: "여성이 전체 노동 인구의 절반 이상을 차지해요." },
        },
        {
          en: "facilitate", ipa: "[fəˈsɪlɪteɪt]", ko: "용이하게 하다, 촉진하다", pos: "v.",
          etym: "라틴어 facilis(쉬운) — '쉽게 만들다'. difficult의 반대편 뿌리예요.",
          ex: { en: "The app facilitates communication between teams.", ko: "그 앱은 팀 간 소통을 쉽게 해 줘요." },
        },
        {
          en: "implement", ipa: "[ˈɪmplɪment]", ko: "시행하다, 실행에 옮기다", pos: "v.",
          ex: { en: "The policy will be implemented next year.", ko: "그 정책은 내년에 시행될 거예요." },
        },
        {
          en: "allocate", ipa: "[ˈæləkeɪt]", ko: "할당하다, 배분하다", pos: "v.",
          etym: "ad+locare(놓다) — location, local과 같은 뿌리예요.",
          ex: { en: "The city allocated more funds to public housing.", ko: "시는 공공 주택에 더 많은 예산을 배정했어요." },
        },
        {
          en: "articulate", ipa: "[ɑːrˈtɪkjuleɪt]", ko: "또렷이 표현하다", pos: "v.",
          ex: { en: "She articulated her vision clearly.", ko: "그녀는 자신의 비전을 명확히 표현했어요." },
        },
        {
          en: "compensate", ipa: "[ˈkɑːmpenseɪt]", ko: "보상하다, 상쇄하다", pos: "v.",
          ex: { en: "The airline compensated passengers for the delay.", ko: "항공사는 지연에 대해 승객들에게 보상했어요." },
        },
        {
          en: "deteriorate", ipa: "[dɪˈtɪriəreɪt]", ko: "악화되다", pos: "v.",
          ex: { en: "His health deteriorated rapidly.", ko: "그의 건강이 급속히 악화됐어요." },
        },
        {
          en: "mitigate", ipa: "[ˈmɪtɪɡeɪt]", ko: "완화하다, 누그러뜨리다", pos: "v.",
          ex: { en: "Trees help mitigate urban heat.", ko: "나무는 도시 열기를 완화하는 데 도움이 돼요." },
        },
        {
          en: "presume", ipa: "[prɪˈzuːm]", ko: "추정하다", pos: "v.",
          ex: { en: "I presume you have already heard the news.", ko: "이미 소식을 들으셨으리라 짐작해요." },
        },
        {
          en: "undertake", ipa: "[ˌʌndərˈteɪk]", ko: "(일을) 맡다, 착수하다", pos: "v.",
          ex: { en: "The team undertook a complete redesign of the app.", ko: "팀은 앱의 전면 재설계에 착수했어요." },
        },
        {
          en: "withstand", ipa: "[wɪðˈstænd]", ko: "견디다, 버티다", pos: "v.",
          ex: { en: "The building can withstand strong earthquakes.", ko: "그 건물은 강한 지진을 견딜 수 있어요." },
        },
        {
          en: "adhere", ipa: "[ədˈhɪr]", ko: "고수하다, 준수하다 (adhere to)", pos: "v.",
          etym: "ad+haerere(달라붙다) — adhesive(접착제), coherent와 같은 뿌리예요.",
          ex: { en: "All members must adhere to the safety rules.", ko: "모든 구성원은 안전 수칙을 준수해야 해요." },
        },
        {
          en: "endeavor", ipa: "[ɪnˈdevər]", ko: "노력하다; 노력", pos: "v.",
          ex: { en: "We endeavor to respond within twenty-four hours.", ko: "저희는 24시간 안에 답변드리려고 노력해요." },
        },
        {
          en: "supplement", ipa: "[ˈsʌplɪment]", ko: "보충하다; 보충제", pos: "v.",
          etym: "sub(아래)+plere(채우다) — complete, supply와 같은 뿌리예요.",
          ex: { en: "He supplements his income with weekend tutoring.", ko: "그는 주말 과외로 수입을 보충해요." },
        },
      ],
    },
    {
      name: "관용구",
      icon: "🗝️",
      words: [
        {
          en: "break the ice", ipa: "[ˌbreɪk ði ˈaɪs]", ko: "어색한 분위기를 깨다", pos: "idiom.",
          ex: { en: "He told a joke to break the ice.", ko: "그는 분위기를 풀려고 농담을 했어요." },
        },
        {
          en: "on the fence", ipa: "[ˌɑːn ðə ˈfens]", ko: "결정을 못 내리고 망설이는", pos: "idiom.",
          ex: { en: "I'm still on the fence about the job offer.", ko: "그 일자리 제안을 받을지 아직 망설이고 있어요." },
        },
        {
          en: "cut corners", ipa: "[ˌkʌt ˈkɔːrnərz]", ko: "(돈·노력을 아끼려고) 대충 하다", pos: "idiom.",
          ex: { en: "Don't cut corners on safety.", ko: "안전 문제는 대충 넘기지 마세요." },
        },
        {
          en: "the elephant in the room", ipa: "[ði ˈelɪfənt ɪn ðə ˈruːm]", ko: "모두 알지만 아무도 말 안 하는 문제", pos: "idiom.",
          ex: { en: "Let's talk about the elephant in the room: the budget.", ko: "다들 피하는 문제, 예산 얘기를 해 봅시다." },
        },
        {
          en: "bite the bullet", ipa: "[ˌbaɪt ðə ˈbʊlɪt]", ko: "이를 악물고 하다, 감수하다", pos: "idiom.",
          etym: "마취가 없던 시절 총알을 물고 수술을 견뎠다는 데서 왔다는 설이 유명해요.",
          ex: { en: "I bit the bullet and paid for the repairs.", ko: "이를 악물고 수리비를 냈어요." },
        },
        {
          en: "play it by ear", ipa: "[ˌpleɪ ɪt baɪ ˈɪr]", ko: "상황 봐 가며 즉흥적으로 하다", pos: "idiom.",
          ex: { en: "We don't have a plan; let's play it by ear.", ko: "계획은 없으니 상황 봐 가면서 해요." },
        },
        {
          en: "under the weather", ipa: "[ˌʌndər ðə ˈweðər]", ko: "몸이 안 좋은", pos: "idiom.",
          ex: { en: "I'm feeling a bit under the weather today.", ko: "오늘 몸이 좀 안 좋아요." },
        },
        {
          en: "cost an arm and a leg", ipa: "[ˌkɔːst ən ˌɑːrm ənd ə ˈleɡ]", ko: "엄청나게 비싸다", pos: "idiom.",
          ex: { en: "That car costs an arm and a leg.", ko: "그 차는 값이 어마어마해요." },
        },
        {
          en: "get cold feet", ipa: "[ˌɡet koʊld ˈfiːt]", ko: "막판에 겁먹고 주저하다", pos: "idiom.",
          ex: { en: "She got cold feet before the wedding.", ko: "그녀는 결혼식 직전에 겁이 났어요." },
        },
        {
          en: "the last straw", ipa: "[ðə ˌlæst ˈstrɔː]", ko: "인내심의 한계를 넘기는 마지막 한 방", pos: "idiom.",
          etym: "'낙타 등을 부러뜨린 마지막 지푸라기'라는 속담에서 온 표현이에요.",
          ex: { en: "The broken promise was the last straw for her.", ko: "그 깨진 약속이 그녀에게는 마지막 한 방이었어요." },
        },
        {
          en: "spill the beans", ipa: "[ˌspɪl ðə ˈbiːnz]", ko: "비밀을 누설하다", pos: "idiom.",
          ex: { en: "Who spilled the beans about the surprise party?", ko: "깜짝 파티 얘기 누가 흘렸어요?" },
        },
        {
          en: "burn the midnight oil", ipa: "[ˌbɜːrn ðə ˌmɪdnaɪt ˈɔɪl]", ko: "밤늦게까지 일하다, 밤새 공부하다", pos: "idiom.",
          etym: "전기가 없던 시절, 등잔 기름을 태우며 밤새 일하던 데서 왔어요.",
          ex: { en: "I burned the midnight oil to finish the report.", ko: "보고서를 끝내느라 밤늦게까지 일했어요." },
        },
        {
          en: "in a nutshell", ipa: "[ˌɪn ə ˈnʌtʃel]", ko: "한마디로 요약하면", pos: "idiom.",
          ex: { en: "In a nutshell, we need more time.", ko: "한마디로, 시간이 더 필요해요." },
        },
        {
          en: "take it with a grain of salt", ipa: "[ˌteɪk ɪt wɪð ə ˌɡreɪn əv ˈsɔːlt]", ko: "걸러서 듣다, 곧이곧대로 믿지 않다", pos: "idiom.",
          etym: "라틴어 cum grano salis의 직역 — 로마 시대 해독제 처방에 소금 한 알이 들어간 데서 유래했다는 설이 있어요.",
          ex: { en: "Take online reviews with a grain of salt.", ko: "인터넷 후기는 걸러서 들으세요." },
        },
        {
          en: "read between the lines", ipa: "[ˌriːd bɪˌtwiːn ðə ˈlaɪnz]", ko: "행간을 읽다, 숨은 뜻을 파악하다", pos: "idiom.",
          ex: { en: "Read between the lines of his email.", ko: "그의 이메일 행간을 읽어 보세요." },
        },
      ],
    },
    {
      name: "프로젝트와 조직",
      icon: "🏛️",
      words: [
        {
          en: "project", ipa: "[ˈprɑːdʒekt]", ko: "프로젝트", pos: "n.",
          ex: { en: "Were the project to fail, the entire team would be held responsible.", ko: "만에 하나 프로젝트가 실패한다면, 팀 전체가 책임을 지게 될 것이다." },
        },
        {
          en: "team", ipa: "[tiːm]", ko: "팀", pos: "n.",
          ex: { en: "The entire team would be held responsible.", ko: "팀 전체가 책임을 지게 될 것이다." },
        },
        {
          en: "committee", ipa: "[kəˈmɪti]", ko: "위원회", pos: "n.",
          ex: { en: "The committee demanded that the report not be released.", ko: "위원회는 보고서가 공개되지 않을 것을 요구했다." },
        },
        {
          en: "board", ipa: "[bɔːrd]", ko: "이사회", pos: "n.",
          ex: { en: "The board appointed her chief executive.", ko: "이사회는 그녀를 최고경영자로 임명했다." },
        },
        {
          en: "executive", ipa: "[ɪɡˈzekjətɪv]", ko: "경영진, 임원; 최고의", pos: "n., adj.",
          ex: { en: "The board appointed her chief executive.", ko: "이사회는 그녀를 최고경영자로 임명했다." },
        },
        {
          en: "chief", ipa: "[tʃiːf]", ko: "최고의, 주요한; 장(長)", pos: "adj., n.",
          ex: { en: "She became chief executive last year.", ko: "그녀는 작년에 최고경영자가 되었다." },
        },
        {
          en: "leader", ipa: "[ˈliːdər]", ko: "지도자, 정상", pos: "n.",
          ex: { en: "The two leaders are to meet next month.", ko: "두 정상은 다음 달 회동할 예정이다." },
        },
        {
          en: "merger", ipa: "[ˈmɜːrdʒər]", ko: "합병", pos: "n.",
          ex: { en: "It was only after the merger that the problems began to surface.", ko: "문제가 드러나기 시작한 것은 합병 이후에야였다." },
        },
        {
          en: "negotiation", ipa: "[nɪˌɡoʊʃiˈeɪʃn]", ko: "협상", pos: "n.",
          ex: { en: "Suffice it to say, the negotiations did not go well.", ko: "협상이 잘 풀리지 않았다고만 말해두죠." },
        },
        {
          en: "delay", ipa: "[dɪˈleɪ]", ko: "지연; 미루다", pos: "n., v.",
          ex: { en: "The failure of the negotiations led to a six-month delay.", ko: "협상 결렬은 6개월의 지연으로 이어졌다." },
        },
        {
          en: "failure", ipa: "[ˈfeɪljər]", ko: "실패", pos: "n.",
          ex: { en: "Critics declared the experiment a failure.", ko: "비평가들은 그 실험을 실패로 규정했다." },
        },
        {
          en: "proposal", ipa: "[prəˈpoʊzl]", ko: "제안(서)", pos: "n.",
          ex: { en: "I was wondering if you might have a moment to discuss the proposal.", ko: "제안서 논의를 위해 잠시 시간을 내주실 수 있을까요." },
        },
        {
          en: "draft", ipa: "[dræft]", ko: "초안", pos: "n.",
          ex: { en: "Could you send over the draft by Wednesday?", ko: "수요일까지 초안을 보내주실 수 있을까요?" },
        },
        {
          en: "timeline", ipa: "[ˈtaɪmlaɪn]", ko: "일정(표), 타임라인", pos: "n.",
          ex: { en: "We may need to revisit the timeline.", ko: "일정을 재검토해야 할 수도 있겠습니다." },
        },
        {
          en: "stage", ipa: "[steɪdʒ]", ko: "단계; 무대", pos: "n.",
          ex: { en: "We're not in a position to lower the price at this stage.", ko: "현 단계에서는 가격을 낮춰드릴 수 없습니다." },
        },
        {
          en: "oversight", ipa: "[ˈoʊvərsaɪt]", ko: "감독; 부주의에 의한 누락", pos: "n.",
          ex: { en: "Never have I seen such a complete failure of oversight.", ko: "이토록 총체적인 감독 부실은 본 적이 없다." },
        },
        {
          en: "scandal", ipa: "[ˈskændl]", ko: "스캔들, 추문", pos: "n.",
          ex: { en: "After the scandal, his career is at a crossroads.", ko: "스캔들 이후 그의 경력은 갈림길에 서 있다." },
        },
        {
          en: "crossroads", ipa: "[ˈkrɔːsroʊdz]", ko: "갈림길, 기로", pos: "n.",
          ex: { en: "His career is at a crossroads.", ko: "그의 경력은 갈림길에 서 있다." },
        },
        {
          en: "objection", ipa: "[əbˈdʒekʃn]", ko: "반론, 이의", pos: "n.",
          ex: { en: "She shot down every objection.", ko: "그녀는 모든 반론을 격추했다." },
        },
        {
          en: "circumstance", ipa: "[ˈsɜːrkəmstæns]", ko: "상황, 사정", pos: "n.",
          ex: { en: "Under no circumstances should this document leave the building.", ko: "어떤 경우에도 이 문서가 건물 밖으로 나가서는 안 된다." },
        },
        {
          en: "document", ipa: "[ˈdɑːkjəmənt]", ko: "문서", pos: "n.",
          ex: { en: "This document must not leave the building.", ko: "이 문서는 건물 밖으로 나가서는 안 된다." },
        },
        {
          en: "server", ipa: "[ˈsɜːrvər]", ko: "서버", pos: "n.",
          ex: { en: "The server crashed during the demo.", ko: "시연 도중에 서버가 죽었어요." },
        },
        {
          en: "demo", ipa: "[ˈdemoʊ]", ko: "시연, 데모", pos: "n.",
          ex: { en: "The server crashed during the demo.", ko: "시연 도중에 서버가 죽었어요." },
        },
        {
          en: "printer", ipa: "[ˈprɪntər]", ko: "프린터", pos: "n.",
          ex: { en: "Who broke the printer?", ko: "누가 프린터를 망가뜨렸어?" },
        },
        {
          en: "engine", ipa: "[ˈendʒɪn]", ko: "엔진", pos: "n.",
          ex: { en: "He left the engine running.", ko: "그는 시동을 켜 둔 채로 뒀다." },
        },
        {
          en: "industry", ipa: "[ˈɪndəstri]", ko: "업계, 산업", pos: "n.",
          ex: { en: "He knows everyone in the industry.", ko: "그는 업계의 모든 사람을 알아요." },
        },
        {
          en: "quarter", ipa: "[ˈkwɔːrtər]", ko: "분기; 4분의 1", pos: "n.",
          ex: { en: "Sales are looking up after two quarters of decline.", ko: "두 분기 하락 끝에 매출이 살아나고 있다." },
        },
        {
          en: "decline", ipa: "[dɪˈklaɪn]", ko: "하락; 감소하다; 거절하다", pos: "n., v.",
          ex: { en: "Sales are looking up after two quarters of decline.", ko: "두 분기 하락 끝에 매출이 살아나고 있다." },
        },
        {
          en: "corridor", ipa: "[ˈkɔːrɪdər]", ko: "복도", pos: "n.",
          ex: { en: "At the end of the corridor stood a single locked door.", ko: "복도 끝에는 잠긴 문 하나가 서 있었다." },
        },
        {
          en: "visa", ipa: "[ˈviːzə]", ko: "비자", pos: "n.",
          ex: { en: "We obtained the visa.", ko: "비자를 취득하였습니다." },
        },
        {
          en: "event", ipa: "[ɪˈvent]", ko: "행사; 사건", pos: "n.",
          ex: { en: "The event will commence at 7 p.m.", ko: "행사는 오후 7시에 시작합니다." },
        },
        {
          en: "court", ipa: "[kɔːrt]", ko: "법원, 법정", pos: "n.",
          ex: { en: "The court found the contract invalid.", ko: "법원은 그 계약이 무효라고 판단했다." },
        },
        {
          en: "overtime", ipa: "[ˈoʊvərtaɪm]", ko: "야근, 초과 근무", pos: "n.",
          ex: { en: "I can work overtime, if need be.", ko: "필요하다면 야근도 할 수 있어요." },
        },
        {
          en: "pandemic", ipa: "[pænˈdemɪk]", ko: "팬데믹, 세계적 유행병", pos: "n.",
          ex: { en: "The pandemic changed everything.", ko: "팬데믹이 모든 걸 바꿔놨어요." },
        },
      ],
    },
    {
      name: "학술 어휘 보강",
      icon: "🎓",
      words: [
        {
          en: "hypothesis", ipa: "[haɪˈpɑːθəsɪs]", ko: "가설", pos: "n.",
          ex: { en: "The results appear to support the hypothesis.", ko: "결과는 가설을 뒷받침하는 것으로 보인다." },
        },
        {
          en: "framework", ipa: "[ˈfreɪmwɜːrk]", ko: "틀, 프레임워크", pos: "n.",
          ex: { en: "We argue that this framework overlooks informal labor.", ko: "우리는 이 틀이 비공식 노동을 간과한다고 주장한다." },
        },
        {
          en: "model", ipa: "[ˈmɑːdl]", ko: "모형, 모델", pos: "n.",
          ex: { en: "The data were analyzed using regression models.", ko: "데이터는 회귀 모형으로 분석되었다." },
        },
        {
          en: "regression", ipa: "[rɪˈɡreʃn]", ko: "회귀 (분석)", pos: "n.",
          ex: { en: "The data were analyzed using regression models.", ko: "데이터는 회귀 모형으로 분석되었다." },
        },
        {
          en: "sample", ipa: "[ˈsæmpl]", ko: "표본, 샘플", pos: "n.",
          ex: { en: "The sample was small, but the effect was consistent.", ko: "표본은 작았지만 효과는 일관되었다." },
        },
        {
          en: "effect", ipa: "[ɪˈfekt]", ko: "효과, 영향", pos: "n.",
          ex: { en: "The effect size was consistent across subgroups.", ko: "효과 크기는 모든 하위 집단에서 일관되었다." },
        },
        {
          en: "subgroup", ipa: "[ˈsʌbɡruːp]", ko: "하위 집단", pos: "n.",
          ex: { en: "The effect was consistent across all subgroups.", ko: "효과는 모든 하위 집단에서 일관되었다." },
        },
        {
          en: "association", ipa: "[əˌsoʊsiˈeɪʃn]", ko: "연관(성); 협회", pos: "n.",
          ex: { en: "The findings suggest a strong association.", ko: "결과는 강한 연관성을 시사한다." },
        },
        {
          en: "causality", ipa: "[kɔːˈzæləti]", ko: "인과관계", pos: "n.",
          ex: { en: "Causality cannot be established from this design.", ko: "본 설계로는 인과관계를 확정할 수 없다." },
        },
        {
          en: "findings", ipa: "[ˈfaɪndɪŋz]", ko: "(연구) 결과, 발견", pos: "n.",
          ex: { en: "The findings suggest a strong association.", ko: "결과는 강한 연관성을 시사한다." },
        },
        {
          en: "intervention", ipa: "[ˌɪntərˈvenʃn]", ko: "개입", pos: "n.",
          ex: { en: "Early intervention improves outcomes.", ko: "조기 개입은 결과를 개선한다." },
        },
        {
          en: "outcome", ipa: "[ˈaʊtkʌm]", ko: "결과, 성과", pos: "n.",
          ex: { en: "Early intervention improves outcomes.", ko: "조기 개입은 결과를 개선한다." },
        },
        {
          en: "interpretation", ipa: "[ɪnˌtɜːrprɪˈteɪʃn]", ko: "해석", pos: "n.",
          ex: { en: "This interpretation is open to question.", ko: "이 해석은 의문의 여지가 있다." },
        },
        {
          en: "behavior", ipa: "[bɪˈheɪvjər]", ko: "행동", pos: "n.",
          ex: { en: "This study examines consumer behavior.", ko: "본 연구는 소비자 행동을 검토한다." },
        },
        {
          en: "consumer", ipa: "[kənˈsuːmər]", ko: "소비자", pos: "n.",
          ex: { en: "This study examines consumer behavior.", ko: "본 연구는 소비자 행동을 검토한다." },
        },
        {
          en: "household", ipa: "[ˈhaʊshoʊld]", ko: "가계, 가구", pos: "n.",
          ex: { en: "This increase eroded household savings.", ko: "이 상승은 가계 저축을 잠식했다." },
        },
        {
          en: "savings", ipa: "[ˈseɪvɪŋz]", ko: "저축, 예금", pos: "n.",
          ex: { en: "The increase eroded household savings.", ko: "그 상승은 가계 저축을 잠식했다." },
        },
        {
          en: "increase", ipa: "[ˈɪŋkriːs]", ko: "증가; 증가하다", pos: "n., v.",
          ex: { en: "This increase eroded household savings.", ko: "이 상승은 가계 저축을 잠식했다." },
        },
        {
          en: "period", ipa: "[ˈpɪriəd]", ko: "기간", pos: "n.",
          ex: { en: "Data were collected over a six-month period.", ko: "데이터는 6개월에 걸쳐 수집되었다." },
        },
        {
          en: "labor", ipa: "[ˈleɪbər]", ko: "노동", pos: "n.",
          ex: { en: "This framework overlooks informal labor.", ko: "이 틀은 비공식 노동을 간과한다." },
        },
        {
          en: "thesis", ipa: "[ˈθiːsɪs]", ko: "논문; 논지", pos: "n.",
          ex: { en: "She was awarded first prize for her thesis.", ko: "그녀는 논문으로 1등상을 받았다." },
        },
        {
          en: "prize", ipa: "[praɪz]", ko: "상", pos: "n.",
          ex: { en: "She was awarded first prize for her thesis.", ko: "그녀는 논문으로 1등상을 받았다." },
        },
        {
          en: "participant", ipa: "[pɑːrˈtɪsɪpənt]", ko: "참가자", pos: "n.",
          ex: { en: "Participants tended to overestimate their own performance.", ko: "참가자들은 자신의 수행을 과대평가하는 경향을 보였다." },
        },
        {
          en: "performance", ipa: "[pərˈfɔːrməns]", ko: "수행, 성과; 공연", pos: "n.",
          ex: { en: "Participants tended to overestimate their own performance.", ko: "참가자들은 자신의 수행을 과대평가하는 경향을 보였다." },
        },
        {
          en: "status", ipa: "[ˈsteɪtəs]", ko: "상태, 진행 상황; 지위", pos: "n.",
          ex: { en: "I would like to inquire about the status of my application.", ko: "제 지원서의 진행 상황을 문의드리고자 합니다." },
        },
        {
          en: "inquiry", ipa: "[ˈɪŋkwəri]", ko: "조사, 문의", pos: "n.",
          ex: { en: "The inquiry revealed the truth.", ko: "조사 결과 진실이 드러났다." },
        },
        {
          en: "difference", ipa: "[ˈdɪfrəns]", ko: "차이", pos: "n.",
          ex: { en: "Long live the difference!", ko: "차이 만세!" },
        },
        {
          en: "truth", ipa: "[truːθ]", ko: "진실", pos: "n.",
          ex: { en: "The inquiry revealed the truth.", ko: "조사 결과 진실이 드러났다." },
        },
        {
          en: "idea", ipa: "[aɪˈdiːə]", ko: "아이디어, 생각", pos: "n.",
          ex: { en: "It was the timing, not the idea, that doomed the project.", ko: "프로젝트를 망친 건 아이디어가 아니라 타이밍이었다." },
        },
        {
          en: "issue", ipa: "[ˈɪʃuː]", ko: "문제, 사안", pos: "n.",
          ex: { en: "The delay was caused by the supply chain issue.", ko: "지연은 공급망 문제 때문이었다." },
        },
        {
          en: "chain", ipa: "[tʃeɪn]", ko: "사슬, 체인; 연쇄", pos: "n.",
          ex: { en: "The delay was caused by the supply chain issue.", ko: "지연은 공급망 문제 때문이었다." },
        },
        {
          en: "lesson", ipa: "[ˈlesn]", ko: "교훈; 수업", pos: "n.",
          ex: { en: "Mistakes were made, and lessons have been learned.", ko: "실수가 있었고, 교훈을 얻었습니다." },
        },
        {
          en: "talent", ipa: "[ˈtælənt]", ko: "인재, 재능", pos: "n.",
          ex: { en: "What this company lacks is not talent but direction.", ko: "이 회사에 부족한 것은 인재가 아니라 방향이다." },
        },
        {
          en: "direction", ipa: "[dəˈrekʃn]", ko: "방향", pos: "n.",
          ex: { en: "What this company lacks is not talent but direction.", ko: "이 회사에 부족한 것은 인재가 아니라 방향이다." },
        },
        {
          en: "patience", ipa: "[ˈpeɪʃns]", ko: "인내심", pos: "n.",
          ex: { en: "All I'm asking for is a little patience.", ko: "제가 부탁드리는 건 약간의 인내심뿐이에요." },
        },
        {
          en: "benefit", ipa: "[ˈbenɪfɪt]", ko: "이익, 혜택", pos: "n.",
          ex: { en: "The risks outweigh the benefits.", ko: "위험이 이익보다 크다." },
        },
        {
          en: "assistance", ipa: "[əˈsɪstəns]", ko: "조력, 도움", pos: "n.",
          ex: { en: "I greatly appreciate your assistance in this matter.", ko: "이 건에 대한 귀하의 조력에 깊이 감사드립니다." },
        },
        {
          en: "voice", ipa: "[vɔɪs]", ko: "목소리", pos: "n.",
          ex: { en: "We consider it essential that every voice be heard.", ko: "우리는 모든 목소리가 들리는 것이 필수라고 본다." },
        },
        {
          en: "entry", ipa: "[ˈentri]", ko: "출품작; 입장, 항목", pos: "n.",
          ex: { en: "All entries are to be submitted electronically.", ko: "모든 출품작은 온라인으로 제출되어야 한다." },
        },
        {
          en: "form", ipa: "[fɔːrm]", ko: "양식; 형태", pos: "n.",
          ex: { en: "Every applicant must submit the form by Friday.", ko: "모든 지원자는 금요일까지 양식을 제출해야 합니다." },
        },
        {
          en: "dictionary", ipa: "[ˈdɪkʃəneri]", ko: "사전", pos: "n.",
          ex: { en: "He is, as it were, a walking dictionary.", ko: "그는 말하자면 걸어 다니는 사전이에요." },
        },
        {
          en: "moment", ipa: "[ˈmoʊmənt]", ko: "잠시, 순간", pos: "n.",
          ex: { en: "Do you have a moment?", ko: "잠시 시간 괜찮으세요?" },
        },
        {
          en: "sec", ipa: "[sek]", ko: "잠깐 (second의 구어)", pos: "n.",
          ex: { en: "Hey, got a sec?", ko: "야, 잠깐 시간 돼?" },
        },
        {
          en: "mutton", ipa: "[ˈmʌtn]", ko: "양고기", pos: "n.",
          ex: { en: "The sheep becomes mutton.", ko: "양은 머튼이 된다." },
        },
        {
          en: "ground", ipa: "[ɡraʊnd]", ko: "입장, 근거; 땅", pos: "n.",
          ex: { en: "She stood her ground.", ko: "그녀는 자기 입장을 사수했다." },
        },
        {
          en: "surface", ipa: "[ˈsɜːrfɪs]", ko: "드러나다; 표면", pos: "v., n.",
          ex: { en: "The problems began to surface after the merger.", ko: "문제는 합병 후에 드러나기 시작했다." },
        },
        {
          en: "sense", ipa: "[sens]", ko: "의미, 감각", pos: "n.",
          ex: { en: "That makes sense.", ko: "말이 되네요." },
        },
        {
          en: "bottom", ipa: "[ˈbɑːtəm]", ko: "맨 아래, 바닥", pos: "n.",
          ex: { en: "The bottom line is, we can't afford another delay.", ko: "결론은, 더 이상의 지연은 감당할 수 없다는 겁니다." },
        },
        {
          en: "detail", ipa: "[ˈdiːteɪl]", ko: "세부 사항", pos: "n.",
          ex: { en: "Let's not waste time on details.", ko: "세부 사항에 시간을 낭비하지 맙시다." },
        },
        {
          en: "waste", ipa: "[weɪst]", ko: "낭비하다; 낭비", pos: "v., n.",
          ex: { en: "Let's not waste time on details.", ko: "시간을 낭비하지 맙시다." },
        },
      ],
    },
    {
      name: "격식 동사 보강",
      icon: "🖋️",
      words: [
        {
          en: "become", ipa: "[bɪˈkʌm]", ko: "~이 되다", pos: "v.",
          ex: { en: "The cow becomes beef.", ko: "소는 비프가 된다." },
        },
        {
          en: "release", ipa: "[rɪˈliːs]", ko: "공개하다, 발표하다", pos: "v.",
          ex: { en: "The committee demanded that the report not be released.", ko: "위원회는 보고서가 공개되지 않을 것을 요구했다." },
        },
        {
          en: "submit", ipa: "[səbˈmɪt]", ko: "제출하다", pos: "v.",
          ex: { en: "Every applicant must submit the form by Friday.", ko: "모든 지원자는 금요일까지 양식을 제출해야 합니다." },
        },
        {
          en: "insist", ipa: "[ɪnˈsɪst]", ko: "강력히 요구하다, 고집하다", pos: "v.",
          ex: { en: "She insisted that the meeting be postponed.", ko: "그녀는 회의를 연기할 것을 강하게 요청했다." },
        },
        {
          en: "postpone", ipa: "[poʊˈspoʊn]", ko: "연기하다", pos: "v.",
          ex: { en: "She insisted that the meeting be postponed.", ko: "그녀는 회의를 연기할 것을 강하게 요청했다." },
        },
        {
          en: "criticize", ipa: "[ˈkrɪtɪsaɪz]", ko: "비판하다", pos: "v.",
          ex: { en: "Far be it from me to criticize your work.", ko: "제가 감히 당신 작업을 비판하려는 건 아니지만요." },
        },
        {
          en: "suffice", ipa: "[səˈfaɪs]", ko: "충분하다", pos: "v.",
          ex: { en: "Suffice it to say, the negotiations did not go well.", ko: "협상이 잘 풀리지 않았다고만 말해두죠." },
        },
        {
          en: "prove", ipa: "[pruːv]", ko: "증명하다", pos: "v.",
          ex: { en: "This proves the policy failed.", ko: "이것은 정책이 실패했음을 증명한다." },
        },
        {
          en: "intend", ipa: "[ɪnˈtend]", ko: "의도하다", pos: "v.",
          ex: { en: "The policy was less effective than intended.", ko: "정책은 의도보다 효과가 덜했다." },
        },
        {
          en: "outweigh", ipa: "[ˌaʊtˈweɪ]", ko: "~보다 크다[중요하다]", pos: "v.",
          ex: { en: "The risks outweigh the benefits.", ko: "위험이 이익보다 크다." },
        },
        {
          en: "revisit", ipa: "[ˌriːˈvɪzɪt]", ko: "재검토하다; 다시 방문하다", pos: "v.",
          ex: { en: "We may need to revisit the timeline.", ko: "일정을 재검토해야 할 수도 있겠습니다." },
        },
        {
          en: "appear", ipa: "[əˈpɪr]", ko: "~으로 보이다; 나타나다", pos: "v.",
          ex: { en: "The results appear to support the hypothesis.", ko: "결과는 가설을 뒷받침하는 것으로 보인다." },
        },
        {
          en: "overestimate", ipa: "[ˌoʊvərˈestɪmeɪt]", ko: "과대평가하다", pos: "v.",
          ex: { en: "Participants tended to overestimate their performance.", ko: "참가자들은 수행을 과대평가하는 경향을 보였다." },
        },
        {
          en: "underestimate", ipa: "[ˌʌndərˈestɪmeɪt]", ko: "과소평가하다", pos: "v.",
          ex: { en: "I wonder if we're underestimating the risk.", ko: "우리가 리스크를 과소평가하고 있는 건 아닐까요." },
        },
        {
          en: "cause", ipa: "[kɔːz]", ko: "야기하다; 원인", pos: "v., n.",
          ex: { en: "The delay was caused by the supply chain issue.", ko: "지연은 공급망 문제 때문이었다." },
        },
        {
          en: "lower", ipa: "[ˈloʊər]", ko: "낮추다; 더 낮은", pos: "v., adj.",
          ex: { en: "We're not in a position to lower the price.", ko: "가격을 낮춰드릴 수 있는 상황이 아닙니다." },
        },
        {
          en: "obtain", ipa: "[əbˈteɪn]", ko: "취득하다, 얻다", pos: "v.",
          ex: { en: "We obtained the visa.", ko: "비자를 취득하였습니다." },
        },
        {
          en: "inquire", ipa: "[ɪnˈkwaɪər]", ko: "문의하다", pos: "v.",
          ex: { en: "I would like to inquire about the status of my application.", ko: "제 지원서의 진행 상황을 문의드리고자 합니다." },
        },
        {
          en: "commence", ipa: "[kəˈmens]", ko: "시작되다", pos: "v.",
          ex: { en: "The event will commence at 7 p.m.", ko: "행사는 오후 7시에 시작합니다." },
        },
        {
          en: "investigate", ipa: "[ɪnˈvestɪɡeɪt]", ko: "조사하다", pos: "v.",
          ex: { en: "We will investigate the matter thoroughly.", ko: "해당 사안을 철저히 조사하겠습니다." },
        },
        {
          en: "reveal", ipa: "[rɪˈviːl]", ko: "드러내다, 밝히다", pos: "v.",
          ex: { en: "The inquiry revealed the truth.", ko: "조사 결과 진실이 드러났다." },
        },
        {
          en: "discuss", ipa: "[dɪˈskʌs]", ko: "논의하다", pos: "v.",
          ex: { en: "Do you have a moment to discuss the proposal?", ko: "제안서를 논의할 시간 있으세요?" },
        },
        {
          en: "appreciate", ipa: "[əˈpriːʃieɪt]", ko: "감사하다; 진가를 알다", pos: "v.",
          ex: { en: "I greatly appreciate your assistance.", ko: "귀하의 조력에 깊이 감사드립니다." },
        },
        {
          en: "begin", ipa: "[bɪˈɡɪn]", ko: "시작하다", pos: "v.",
          ex: { en: "The problems began to surface.", ko: "문제가 드러나기 시작했다." },
        },
        {
          en: "challenge", ipa: "[ˈtʃælɪndʒ]", ko: "문제 삼다, 이의를 제기하다; 도전", pos: "v., n.",
          ex: { en: "It is precisely this assumption that I want to challenge.", ko: "내가 문제 삼고 싶은 것이 바로 이 전제다." },
        },
        {
          en: "doom", ipa: "[duːm]", ko: "망치다, 실패하게 하다", pos: "v.",
          ex: { en: "It was the timing that doomed the project.", ko: "프로젝트를 망친 건 타이밍이었다." },
        },
        {
          en: "crash", ipa: "[kræʃ]", ko: "(컴퓨터가) 다운되다; 충돌하다", pos: "v.",
          ex: { en: "The server crashed during the demo.", ko: "시연 도중에 서버가 죽었어요." },
        },
        {
          en: "invest", ipa: "[ɪnˈvest]", ko: "투자하다", pos: "v.",
          ex: { en: "I've invested three years in this project.", ko: "이 프로젝트에 3년을 투자했어요." },
        },
        {
          en: "shoot", ipa: "[ʃuːt]", ko: "쏘다; (반론을) 격추하다", pos: "v.",
          ex: { en: "She shot down every objection.", ko: "그녀는 모든 반론을 격추했다." },
        },
        {
          en: "digest", ipa: "[daɪˈdʒest]", ko: "소화하다; 곱씹다", pos: "v.",
          ex: { en: "Give me a day to digest the proposal.", ko: "제안서를 소화할 시간을 하루 주세요." },
        },
        {
          en: "chew", ipa: "[tʃuː]", ko: "씹다; 곱씹다", pos: "v.",
          ex: { en: "It's a lot to chew on.", ko: "곱씹을 게 많네요." },
        },
        {
          en: "connect", ipa: "[kəˈnekt]", ko: "연결하다", pos: "v.",
          ex: { en: "He's incredibly well-connected.", ko: "그는 발이 정말 넓어요." },
        },
        {
          en: "afford", ipa: "[əˈfɔːrd]", ko: "감당하다, ~할 여유가 있다", pos: "v.",
          ex: { en: "We can't afford another delay.", ko: "더 이상의 지연은 감당할 수 없습니다." },
        },
        {
          en: "behave", ipa: "[bɪˈheɪv]", ko: "행동하다", pos: "v.",
          ex: { en: "We looked at how people behave when prices go up.", ko: "가격이 오를 때 사람들이 어떻게 행동하는지 살펴봤다." },
        },
        {
          en: "examine", ipa: "[ɪɡˈzæmɪn]", ko: "검토하다, 조사하다", pos: "v.",
          ex: { en: "This study examines consumer behavior.", ko: "본 연구는 소비자 행동을 검토한다." },
        },
        {
          en: "erode", ipa: "[ɪˈroʊd]", ko: "잠식하다, 침식하다", pos: "v.",
          ex: { en: "The increase eroded household savings.", ko: "그 상승은 가계 저축을 잠식했다." },
        },
        {
          en: "collect", ipa: "[kəˈlekt]", ko: "수집하다", pos: "v.",
          ex: { en: "Data were collected over a six-month period.", ko: "데이터는 6개월에 걸쳐 수집되었다." },
        },
        {
          en: "analyze", ipa: "[ˈænəlaɪz]", ko: "분석하다", pos: "v.",
          ex: { en: "The data were analyzed using regression models.", ko: "데이터는 회귀 모형으로 분석되었다." },
        },
        {
          en: "overlook", ipa: "[ˌoʊvərˈlʊk]", ko: "간과하다", pos: "v.",
          ex: { en: "This framework overlooks informal labor.", ko: "이 틀은 비공식 노동을 간과한다." },
        },
        {
          en: "propose", ipa: "[prəˈpoʊz]", ko: "제안하다", pos: "v.",
          ex: { en: "The hypothesis was first proposed by Kim (2019).", ko: "이 가설은 Kim(2019)이 처음 제안했다." },
        },
        {
          en: "accept", ipa: "[əkˈsept]", ko: "받아들이다", pos: "v.",
          ex: { en: "It is widely accepted that early intervention improves outcomes.", ko: "조기 개입이 결과를 개선한다는 것은 널리 받아들여진다." },
        },
        {
          en: "remain", ipa: "[rɪˈmeɪn]", ko: "여전히 ~이다, 남아 있다", pos: "v.",
          ex: { en: "The evidence remains limited.", ko: "증거는 여전히 제한적이다." },
        },
        {
          en: "establish", ipa: "[ɪˈstæblɪʃ]", ko: "확립하다, 입증하다", pos: "v.",
          ex: { en: "Causality cannot be established from this design.", ko: "본 설계로는 인과관계를 확정할 수 없다." },
        },
        {
          en: "confirm", ipa: "[kənˈfɜːrm]", ko: "확인하다, 확증하다", pos: "v.",
          ex: { en: "Further research is needed to confirm these results.", ko: "이 결과를 확증하기 위해 후속 연구가 필요하다." },
        },
        {
          en: "appoint", ipa: "[əˈpɔɪnt]", ko: "임명하다", pos: "v.",
          ex: { en: "The board appointed her chief executive.", ko: "이사회는 그녀를 최고경영자로 임명했다." },
        },
        {
          en: "declare", ipa: "[dɪˈkler]", ko: "선언하다, 규정하다", pos: "v.",
          ex: { en: "Critics declared the experiment a failure.", ko: "비평가들은 그 실험을 실패로 규정했다." },
        },
        {
          en: "consider", ipa: "[kənˈsɪdər]", ko: "여기다, 고려하다", pos: "v.",
          ex: { en: "We consider it essential that every voice be heard.", ko: "우리는 모든 목소리가 들리는 것이 필수라고 본다." },
        },
        {
          en: "award", ipa: "[əˈwɔːrd]", ko: "수여하다; 상", pos: "v., n.",
          ex: { en: "She was awarded first prize for her thesis.", ko: "그녀는 논문으로 1등상을 받았다." },
        },
        {
          en: "enable", ipa: "[ɪˈneɪbl]", ko: "~할 수 있게 하다", pos: "v.",
          ex: { en: "The new policy enables staff to work remotely.", ko: "새 정책은 직원들이 원격 근무를 할 수 있게 한다." },
        },
        {
          en: "resent", ipa: "[rɪˈzent]", ko: "분개하다", pos: "v.",
          ex: { en: "He resents being treated like a child.", ko: "그는 아이 취급받는 것에 분개해요." },
        },
        {
          en: "treat", ipa: "[triːt]", ko: "대하다, 취급하다; 치료하다", pos: "v.",
          ex: { en: "He resents being treated like a child.", ko: "그는 아이 취급받는 것에 분개해요." },
        },
        {
          en: "hurry", ipa: "[ˈhɜːri]", ko: "서두르다", pos: "v.",
          ex: { en: "Hurry — the store is about to close.", ko: "서둘러요. 가게가 막 닫으려는 참이에요." },
        },
        {
          en: "publish", ipa: "[ˈpʌblɪʃ]", ko: "발표하다, 출판하다", pos: "v.",
          ex: { en: "The report is due to be published on Monday.", ko: "보고서는 월요일에 발표될 예정이다." },
        },
        {
          en: "vote", ipa: "[voʊt]", ko: "표결, 투표; 투표하다", pos: "n., v.",
          ex: { en: "The committee has decided to postpone the vote.", ko: "위원회는 표결을 연기하기로 결정했다." },
        },
        {
          en: "add", ipa: "[æd]", ko: "더하다; (수가) 맞다", pos: "v.",
          ex: { en: "The numbers don't add up.", ko: "숫자가 맞지 않아요." },
        },
        {
          en: "stand", ipa: "[stænd]", ko: "서 있다; 견디다", pos: "v.",
          ex: { en: "At the end of the corridor stood a single locked door.", ko: "복도 끝에는 잠긴 문 하나가 서 있었다." },
        },
        {
          en: "present", ipa: "[ˈpreznt]", ko: "출석한; 현재의", pos: "adj.",
          ex: { en: "I suggest that he be present at the hearing.", ko: "그가 청문회에 출석할 것을 제안합니다." },
        },
      ],
    },
    {
      name: "격식 형용사·부사",
      icon: "⚖️",
      words: [
        {
          en: "essential", ipa: "[ɪˈsenʃl]", ko: "필수적인", pos: "adj.",
          ex: { en: "It is essential that every applicant submit the form.", ko: "모든 지원자가 양식을 제출하는 것이 필수입니다." },
        },
        {
          en: "entire", ipa: "[ɪnˈtaɪər]", ko: "전체의", pos: "adj.",
          ex: { en: "The entire team would be held responsible.", ko: "팀 전체가 책임을 지게 될 것이다." },
        },
        {
          en: "responsible", ipa: "[rɪˈspɑːnsəbl]", ko: "책임이 있는", pos: "adj.",
          ex: { en: "The team would be held responsible.", ko: "팀이 책임을 지게 될 것이다." },
        },
        {
          en: "wrong", ipa: "[rɔːŋ]", ko: "틀린, 잘못된", pos: "adj.",
          ex: { en: "Your figures are wrong.", ko: "당신 수치가 틀렸어요." },
        },
        {
          en: "effective", ipa: "[ɪˈfektɪv]", ko: "효과적인", pos: "adj.",
          ex: { en: "The policy may have been less effective than intended.", ko: "정책은 의도보다 효과가 덜했을 수 있다." },
        },
        {
          en: "legal", ipa: "[ˈliːɡl]", ko: "법무의, 법적인", pos: "adj.",
          ex: { en: "You might want to run this by the legal team first.", ko: "이건 먼저 법무팀에 검토받으시는 게 좋겠어요." },
        },
        {
          en: "fair", ipa: "[fer]", ko: "타당한, 공정한", pos: "adj.",
          ex: { en: "That's a fair point.", ko: "타당한 지적이에요." },
        },
        {
          en: "complete", ipa: "[kəmˈpliːt]", ko: "총체적인, 완전한", pos: "adj.",
          ex: { en: "It was a complete failure of oversight.", ko: "총체적인 감독 부실이었다." },
        },
        {
          en: "single", ipa: "[ˈsɪŋɡl]", ko: "단 하나의", pos: "adj.",
          ex: { en: "At the end of the corridor stood a single locked door.", ko: "복도 끝에는 잠긴 문 하나가 서 있었다." },
        },
        {
          en: "valuable", ipa: "[ˈvæljuəbl]", ko: "귀중한", pos: "adj.",
          ex: { en: "Thanks for your time — I know it's valuable.", ko: "시간 내주셔서 감사해요 — 귀한 시간인 거 알아요." },
        },
        {
          en: "invalid", ipa: "[ɪnˈvælɪd]", ko: "무효의", pos: "adj.",
          ex: { en: "The court found the contract invalid.", ko: "법원은 그 계약이 무효라고 판단했다." },
        },
        {
          en: "final", ipa: "[ˈfaɪnl]", ko: "최종의", pos: "adj.",
          ex: { en: "She made it clear that the decision was final.", ko: "그녀는 그 결정이 최종임을 분명히 했다." },
        },
        {
          en: "consistent", ipa: "[kənˈsɪstənt]", ko: "일관된", pos: "adj.",
          ex: { en: "The effect size was consistent across subgroups.", ko: "효과 크기는 하위 집단 전반에서 일관되었다." },
        },
        {
          en: "various", ipa: "[ˈveriəs]", ko: "다양한", pos: "adj.",
          ex: { en: "The hypothesis has been tested in various contexts.", ko: "이 가설은 다양한 맥락에서 검증되었다." },
        },
        {
          en: "informal", ipa: "[ɪnˈfɔːrml]", ko: "비공식의, 격식 없는", pos: "adj.",
          ex: { en: "This framework overlooks informal labor.", ko: "이 틀은 비공식 노동을 간과한다." },
        },
        {
          en: "limited", ipa: "[ˈlɪmɪtɪd]", ko: "제한된", pos: "adj.",
          ex: { en: "The evidence remains limited.", ko: "증거는 여전히 제한적이다." },
        },
        {
          en: "due", ipa: "[duː]", ko: "~할 예정인; 마감인", pos: "adj.",
          ex: { en: "The report is due to be published on Monday.", ko: "보고서는 월요일에 발표될 예정이다." },
        },
        {
          en: "arguably", ipa: "[ˈɑːrɡjuəbli]", ko: "~이라 할 만하게, 거의 틀림없이", pos: "adv.",
          ex: { en: "This is arguably the most important finding of the study.", ko: "이것은 이 연구에서 가장 중요한 발견이라 할 만하다." },
        },
        {
          en: "presumably", ipa: "[prɪˈzuːməbli]", ko: "짐작건대", pos: "adv.",
          ex: { en: "Presumably, the delay was caused by the supply chain issue.", ko: "짐작건대 지연은 공급망 문제 때문이었을 것이다." },
        },
        {
          en: "precisely", ipa: "[prɪˈsaɪsli]", ko: "바로, 정확히", pos: "adv.",
          ex: { en: "It is precisely this assumption that I want to challenge.", ko: "내가 문제 삼고 싶은 것이 바로 이 전제다." },
        },
        {
          en: "thoroughly", ipa: "[ˈθɜːroʊli]", ko: "철저히", pos: "adv.",
          ex: { en: "We will investigate the matter thoroughly.", ko: "해당 사안을 철저히 조사하겠습니다." },
        },
        {
          en: "greatly", ipa: "[ˈɡreɪtli]", ko: "깊이, 크게", pos: "adv.",
          ex: { en: "I greatly appreciate your assistance.", ko: "귀하의 조력에 깊이 감사드립니다." },
        },
        {
          en: "incredibly", ipa: "[ɪnˈkredəbli]", ko: "믿을 수 없을 만큼", pos: "adv.",
          ex: { en: "He's incredibly well-connected.", ko: "그는 발이 정말 넓어요." },
        },
        {
          en: "widely", ipa: "[ˈwaɪdli]", ko: "널리", pos: "adv.",
          ex: { en: "It is widely accepted that early intervention improves outcomes.", ko: "조기 개입이 결과를 개선한다는 것은 널리 받아들여진다." },
        },
        {
          en: "remotely", ipa: "[rɪˈmoʊtli]", ko: "원격으로", pos: "adv.",
          ex: { en: "The new policy enables staff to work remotely.", ko: "새 정책은 직원들이 원격 근무를 할 수 있게 한다." },
        },
        {
          en: "electronically", ipa: "[ɪˌlekˈtrɑːnɪkli]", ko: "전자적으로, 온라인으로", pos: "adv.",
          ex: { en: "All entries are to be submitted electronically.", ko: "모든 출품작은 온라인으로 제출되어야 한다." },
        },
        {
          en: "across", ipa: "[əˈkrɔːs]", ko: "~ 전반에 걸쳐; 건너", pos: "prep.",
          ex: { en: "The effect was consistent across subgroups.", ko: "효과는 하위 집단 전반에서 일관되었다." },
        },
        {
          en: "still", ipa: "[stɪl]", ko: "여전히, 그래도", pos: "adv.",
          ex: { en: "Be that as it may, we still need a decision.", ko: "그렇다 하더라도 여전히 결정이 필요합니다." },
        },
        {
          en: "lest", ipa: "[lest]", ko: "~하지 않도록", pos: "conj.",
          ex: { en: "He wrote everything down, lest he forget.", ko: "잊지 않도록 그는 모든 것을 적어두었다." },
        },
        {
          en: "nobody", ipa: "[ˈnoʊbədi]", ko: "아무도 ~않다", pos: "pron.",
          ex: { en: "Nobody likes to be kept waiting.", ko: "기다리게 되는 걸 좋아하는 사람은 없어요." },
        },
        {
          en: "adult", ipa: "[əˈdʌlt]", ko: "성인", pos: "n.",
          ex: { en: "The evidence for adults remains limited.", ko: "성인 대상 증거는 여전히 제한적이다." },
        },
        {
          en: "critic", ipa: "[ˈkrɪtɪk]", ko: "비평가", pos: "n.",
          ex: { en: "Critics declared the experiment a failure.", ko: "비평가들은 그 실험을 실패로 규정했다." },
        },
        {
          en: "approach", ipa: "[əˈproʊtʃ]", ko: "접근(법); 다가가다", pos: "n., v.",
          ex: { en: "He suggested a better approach to the team.", ko: "그는 팀에 더 나은 접근법을 제안했다." },
        },
        {
          en: "process", ipa: "[ˈprɑːses]", ko: "절차, 과정", pos: "n.",
          ex: { en: "Could you explain the process to me again?", ko: "그 절차를 다시 설명해 주시겠어요?" },
        },
      ],
    },
    {
      name: "핵심 개념어 보강",
      icon: "➕",
      words: [
        {
          en: "limit", ipa: "[ˈlɪmɪt]", ko: "한계; 제한하다", pos: "n., v.",
          ex: { en: "The limits of my language mean the limits of my world.", ko: "내 언어의 한계는 내 세계의 한계를 뜻한다." },
        },
        {
          en: "tend", ipa: "[tend]", ko: "~하는 경향이 있다", pos: "v.",
          ex: { en: "Participants tended to overestimate their performance.", ko: "참가자들은 수행을 과대평가하는 경향을 보였다." },
        },
      ],
    },
  ],
}

export default themes;
