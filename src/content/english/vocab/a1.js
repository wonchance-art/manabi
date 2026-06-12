export default {
  level: "A1",
  title: "A1 기초 어휘",
  desc: "영어의 첫걸음 — 인사부터 기초 동사·형용사까지, 매일 입에 올리는 필수 단어 90개예요.",
  themes: [
    {
      name: "인사와 자기소개",
      icon: "👋",
      words: [
        {
          en: "hello", ipa: "[həˈloʊ]", ko: "안녕하세요", pos: "expr.",
          ex: { en: "Hello! Nice to meet you.", ko: "안녕하세요! 만나서 반가워요." },
        },
        {
          en: "hi", ipa: "[haɪ]", ko: "안녕 (편한 인사)", pos: "expr.",
          ex: { en: "Hi, Minho! How are you today?", ko: "안녕, 민호! 오늘 어때?" },
        },
        {
          en: "good morning", ipa: "[ˌɡʊd ˈmɔːrnɪŋ]", ko: "좋은 아침이에요", pos: "expr.",
          ex: { en: "Good morning! Did you sleep well?", ko: "좋은 아침! 잘 잤어요?" },
        },
        {
          en: "goodbye", ipa: "[ˌɡʊdˈbaɪ]", ko: "안녕히 가세요, 잘 가", pos: "expr.",
          etym: "God be with you(신이 함께하시길)가 줄어든 말이에요.",
          ex: { en: "Goodbye, everyone! Have a nice weekend.", ko: "안녕히 가세요, 여러분! 주말 잘 보내세요." },
        },
        {
          en: "please", ipa: "[pliːz]", ko: "부탁할 때 덧붙이는 말", pos: "adv.",
          ex: { en: "Two coffees, please.", ko: "커피 두 잔 주세요." },
        },
        {
          en: "thank you", ipa: "[ˈθæŋk juː]", ko: "감사합니다", pos: "expr.",
          ex: { en: "Thank you so much for your help.", ko: "도와주셔서 정말 감사해요." },
        },
        {
          en: "sorry", ipa: "[ˈsɑːri]", ko: "미안한, 죄송한", pos: "adj.",
          ex: { en: "I'm sorry I'm late.", ko: "늦어서 죄송해요." },
        },
        {
          en: "excuse me", ipa: "[ɪkˈskjuːz miː]", ko: "실례합니다, 저기요", pos: "expr.",
          etym: "라틴어 ex(밖)+causa(탓) — '탓에서 벗어나게 해 주세요'가 본래 뜻이에요.",
          ex: { en: "Excuse me, where is the restroom?", ko: "실례지만, 화장실이 어디예요?" },
        },
        {
          en: "name", ipa: "[neɪm]", ko: "이름", pos: "n.",
          ex: { en: "My name is Jiwoo.", ko: "제 이름은 지우예요." },
        },
        {
          en: "meet", ipa: "[miːt]", ko: "만나다", pos: "v.",
          ex: { en: "Let's meet at six.", ko: "여섯 시에 만나요." },
        },
        {
          en: "nice", ipa: "[naɪs]", ko: "좋은, 친절한, 멋진", pos: "adj.",
          ex: { en: "She is very nice to everyone.", ko: "그녀는 모두에게 친절해요." },
        },
        {
          en: "welcome", ipa: "[ˈwelkəm]", ko: "환영합니다", pos: "expr.",
          etym: "well(잘)+come(오다) — '잘 오셨어요'라는 뜻이 그대로 담겨 있어요.",
          ex: { en: "Welcome to Korea!", ko: "한국에 오신 걸 환영해요!" },
        },
        {
          en: "yes", ipa: "[jes]", ko: "네, 응", pos: "adv.",
          ex: { en: "Yes, I like Korean food very much.", ko: "네, 저는 한국 음식을 아주 좋아해요." },
        },
        {
          en: "no", ipa: "[noʊ]", ko: "아니요", pos: "adv.",
          ex: { en: "No, thank you. I am fine.", ko: "아니요, 괜찮아요. 전 됐어요." },
        },
        {
          en: "see you", ipa: "[ˈsiː juː]", ko: "또 봐요, 잘 가", pos: "expr.",
          ex: { en: "See you tomorrow!", ko: "내일 봐요!" },
        },
      ],
    },
    {
      name: "숫자·시간·날짜",
      icon: "🕐",
      words: [
        { en: "one", ipa: "[wʌn]", ko: "하나, 1", pos: "n." },
        { en: "two", ipa: "[tuː]", ko: "둘, 2", pos: "n." },
        { en: "three", ipa: "[θriː]", ko: "셋, 3", pos: "n." },
        { en: "ten", ipa: "[ten]", ko: "열, 10", pos: "n." },
        { en: "hundred", ipa: "[ˈhʌndrəd]", ko: "백, 100", pos: "n." },
        {
          en: "time", ipa: "[taɪm]", ko: "시간, 때", pos: "n.",
          ex: { en: "What time is it now?", ko: "지금 몇 시예요?" },
        },
        {
          en: "hour", ipa: "[ˈaʊər]", ko: "시간 (60분)", pos: "n.",
          etym: "h는 묵음이에요 — 프랑스어 heure를 거쳐 온 라틴어 hora가 뿌리거든요.",
          ex: { en: "The movie is about two hours long.", ko: "그 영화는 두 시간쯤 돼요." },
        },
        {
          en: "minute", ipa: "[ˈmɪnɪt]", ko: "분 (60초)", pos: "n.",
          etym: "라틴어 minutus(작은) — '시간을 잘게 나눈 조각'이라는 발상이에요.",
          ex: { en: "Wait a minute, please. I am almost ready.", ko: "잠깐만요. 거의 다 됐어요." },
        },
        {
          en: "today", ipa: "[təˈdeɪ]", ko: "오늘", pos: "adv.",
          ex: { en: "What day is it today?", ko: "오늘 무슨 요일이에요?" },
        },
        {
          en: "tomorrow", ipa: "[təˈmɑːroʊ]", ko: "내일", pos: "adv.",
          etym: "to+morrow(아침) — '다가오는 아침'에서 '내일'이 됐어요.",
          ex: { en: "I have a test tomorrow.", ko: "내일 시험이 있어요." },
        },
        {
          en: "yesterday", ipa: "[ˈjestərdeɪ]", ko: "어제", pos: "adv.",
          ex: { en: "I met an old friend yesterday.", ko: "어제 오랜 친구를 만났어요." },
        },
        {
          en: "week", ipa: "[wiːk]", ko: "주, 일주일", pos: "n.",
          ex: { en: "See you next week at school.", ko: "다음 주에 학교에서 봐요." },
        },
        { en: "month", ipa: "[mʌnθ]", ko: "달, 월", pos: "n." },
        { en: "year", ipa: "[jɪr]", ko: "해, 년", pos: "n." },
        {
          en: "birthday", ipa: "[ˈbɜːrθdeɪ]", ko: "생일", pos: "n.",
          etym: "birth(태어남)+day(날) — 합쳐서 '태어난 날'이에요.",
          ex: { en: "When is your birthday?", ko: "생일이 언제예요?" },
        },
      ],
    },
    {
      name: "가족과 사람",
      icon: "👨‍👩‍👧",
      words: [
        {
          en: "family", ipa: "[ˈfæməli]", ko: "가족", pos: "n.",
          etym: "라틴어 familia — familiar(친숙한)와 같은 뿌리예요.",
          ex: { en: "My family lives in Busan.", ko: "우리 가족은 부산에 살아요." },
        },
        { en: "mother", ipa: "[ˈmʌðər]", ko: "어머니", pos: "n." },
        { en: "father", ipa: "[ˈfɑːðər]", ko: "아버지", pos: "n." },
        { en: "parents", ipa: "[ˈperənts]", ko: "부모님", pos: "n." },
        { en: "sister", ipa: "[ˈsɪstər]", ko: "언니, 누나, 여동생", pos: "n." },
        { en: "brother", ipa: "[ˈbrʌðər]", ko: "형, 오빠, 남동생", pos: "n." },
        {
          en: "son", ipa: "[sʌn]", ko: "아들", pos: "n.",
          etym: "sun(해)과 발음이 똑같은 동음이의어예요 — 철자로만 구별해요.",
        },
        { en: "daughter", ipa: "[ˈdɔːtər]", ko: "딸", pos: "n." },
        {
          en: "child", ipa: "[tʃaɪld]", ko: "아이, 자녀", pos: "n.",
          etym: "복수형은 children [ˈtʃɪldrən] — 모음까지 바뀌는 불규칙이에요.",
          ex: { en: "They have two children.", ko: "그들은 아이가 둘 있어요." },
        },
        {
          en: "friend", ipa: "[frend]", ko: "친구", pos: "n.",
          ex: { en: "He is my best friend.", ko: "그는 제 가장 친한 친구예요." },
        },
        {
          en: "people", ipa: "[ˈpiːpl]", ko: "사람들", pos: "n.",
          etym: "라틴어 populus(민중) — popular(인기 있는)와 같은 뿌리예요.",
          ex: { en: "Many people like K-pop.", ko: "많은 사람들이 케이팝을 좋아해요." },
        },
        { en: "man", ipa: "[mæn]", ko: "남자 (복수: men)", pos: "n." },
        {
          en: "woman", ipa: "[ˈwʊmən]", ko: "여자", pos: "n.",
          etym: "복수 women은 [ˈwɪmɪn] — 첫 모음이 '위'로 바뀌는 게 발음 함정이에요.",
        },
        { en: "baby", ipa: "[ˈbeɪbi]", ko: "아기", pos: "n." },
        { en: "grandmother", ipa: "[ˈɡrænmʌðər]", ko: "할머니", pos: "n." },
      ],
    },
    {
      name: "음식과 주문",
      icon: "🍽️",
      words: [
        {
          en: "food", ipa: "[fuːd]", ko: "음식", pos: "n.",
          ex: { en: "Korean food is hot but delicious.", ko: "한국 음식은 맵지만 맛있어요." },
        },
        {
          en: "water", ipa: "[ˈwɔːtər]", ko: "물", pos: "n.",
          ex: { en: "Can I have some water, please?", ko: "물 좀 주시겠어요?" },
        },
        {
          en: "coffee", ipa: "[ˈkɔːfi]", ko: "커피", pos: "n.",
          etym: "아랍어 qahwa가 터키·이탈리아를 거쳐 온 말 — 강세는 한국어처럼 앞이에요.",
        },
        { en: "tea", ipa: "[tiː]", ko: "차", pos: "n." },
        { en: "milk", ipa: "[mɪlk]", ko: "우유", pos: "n." },
        { en: "bread", ipa: "[bred]", ko: "빵", pos: "n." },
        {
          en: "rice", ipa: "[raɪs]", ko: "밥, 쌀", pos: "n.",
          ex: { en: "Koreans eat rice every day.", ko: "한국인은 매일 밥을 먹어요." },
        },
        { en: "egg", ipa: "[eɡ]", ko: "달걀", pos: "n." },
        { en: "apple", ipa: "[ˈæpl]", ko: "사과", pos: "n." },
        {
          en: "breakfast", ipa: "[ˈbrekfəst]", ko: "아침 식사", pos: "n.",
          etym: "break(깨다)+fast(단식) — '밤새 단식을 깨는 식사'라는 뜻이에요.",
          ex: { en: "I eat breakfast at eight.", ko: "저는 여덟 시에 아침을 먹어요." },
        },
        {
          en: "lunch", ipa: "[lʌntʃ]", ko: "점심 식사", pos: "n.",
          ex: { en: "What do you want for lunch today?", ko: "오늘 점심 뭐 먹고 싶어요?" },
        },
        {
          en: "dinner", ipa: "[ˈdɪnər]", ko: "저녁 식사", pos: "n.",
          ex: { en: "Let's have dinner together at my house.", ko: "우리 집에서 같이 저녁 먹어요." },
        },
        {
          en: "menu", ipa: "[ˈmenjuː]", ko: "메뉴, 차림표", pos: "n.",
          etym: "프랑스어에서 온 말 — 라틴어 minutus(작은)의 후손으로, minute와 형제예요.",
          ex: { en: "Can I see the menu, please?", ko: "메뉴 좀 볼 수 있을까요?" },
        },
        {
          en: "order", ipa: "[ˈɔːrdər]", ko: "주문하다; 주문", pos: "v.",
          ex: { en: "Are you ready to order?", ko: "주문하시겠어요?" },
        },
        {
          en: "delicious", ipa: "[dɪˈlɪʃəs]", ko: "맛있는", pos: "adj.",
          etym: "라틴어 delicia(즐거움) — delight(기쁨)와 같은 뿌리예요.",
          ex: { en: "This bibimbap is delicious!", ko: "이 비빔밥 정말 맛있어요!" },
        },
      ],
    },
    {
      name: "기초 동사",
      icon: "🏃",
      words: [
        {
          en: "be", ipa: "[biː]", ko: "~이다, 있다 (am/is/are)", pos: "v.",
          ex: { en: "I am a student.", ko: "저는 학생이에요." },
        },
        {
          en: "have", ipa: "[hæv]", ko: "가지고 있다", pos: "v.",
          ex: { en: "I have a question.", ko: "질문이 있어요." },
        },
        {
          en: "go", ipa: "[ɡoʊ]", ko: "가다", pos: "v.",
          ex: { en: "I go to school by bus.", ko: "저는 버스로 학교에 가요." },
        },
        {
          en: "come", ipa: "[kʌm]", ko: "오다", pos: "v.",
          ex: { en: "Come to my house this weekend.", ko: "이번 주말에 우리 집에 와요." },
        },
        {
          en: "eat", ipa: "[iːt]", ko: "먹다", pos: "v.",
          ex: { en: "Let's eat lunch together.", ko: "점심 같이 먹어요." },
        },
        {
          en: "drink", ipa: "[drɪŋk]", ko: "마시다", pos: "v.",
          ex: { en: "I drink water with every meal.", ko: "저는 식사 때마다 물을 마셔요." },
        },
        {
          en: "like", ipa: "[laɪk]", ko: "좋아하다", pos: "v.",
          ex: { en: "I like Korean food.", ko: "저는 한국 음식을 좋아해요." },
        },
        {
          en: "want", ipa: "[wɑːnt]", ko: "원하다", pos: "v.",
          ex: { en: "I want some coffee.", ko: "커피가 마시고 싶어요." },
        },
        {
          en: "see", ipa: "[siː]", ko: "보다, 보이다", pos: "v.",
          ex: { en: "I see my friends every weekend.", ko: "저는 주말마다 친구들을 만나요." },
        },
        {
          en: "know", ipa: "[noʊ]", ko: "알다", pos: "v.",
          etym: "k는 묵음이에요 — knife(칼), knee(무릎)도 같은 패턴이에요.",
          ex: { en: "Do you know that man's name?", ko: "저 남자 이름 알아요?" },
        },
        {
          en: "make", ipa: "[meɪk]", ko: "만들다", pos: "v.",
          ex: { en: "My mother makes very delicious kimchi at home.", ko: "엄마는 집에서 아주 맛있는 김치를 담그세요." },
        },
        {
          en: "do", ipa: "[duː]", ko: "하다", pos: "v.",
          ex: { en: "What do you do on weekends?", ko: "주말에 뭐 해요?" },
        },
        {
          en: "say", ipa: "[seɪ]", ko: "말하다", pos: "v.",
          ex: { en: "What did you say? Please say it again.", ko: "뭐라고 했어요? 다시 말해 주세요." },
        },
        {
          en: "get", ipa: "[ɡet]", ko: "받다, 얻다, 구하다", pos: "v.",
          ex: { en: "I got a new phone for my birthday.", ko: "생일에 새 휴대폰을 받았어요." },
        },
        {
          en: "live", ipa: "[lɪv]", ko: "살다", pos: "v.",
          etym: "동사는 [lɪv], 형용사 live(생방송의)는 [laɪv] — 발음이 갈라져요.",
          ex: { en: "I live in Seoul.", ko: "저는 서울에 살아요." },
        },
      ],
    },
    {
      name: "기초 형용사",
      icon: "✨",
      words: [
        {
          en: "good", ipa: "[ɡʊd]", ko: "좋은", pos: "adj.",
          ex: { en: "Have a good day!", ko: "좋은 하루 보내세요!" },
        },
        {
          en: "bad", ipa: "[bæd]", ko: "나쁜", pos: "adj.",
          ex: { en: "The weather was very bad yesterday.", ko: "어제 날씨가 아주 나빴어요." },
        },
        {
          en: "big", ipa: "[bɪɡ]", ko: "큰", pos: "adj.",
          ex: { en: "Seoul is a very big city.", ko: "서울은 아주 큰 도시예요." },
        },
        {
          en: "small", ipa: "[smɔːl]", ko: "작은", pos: "adj.",
          ex: { en: "I live in a small apartment.", ko: "저는 작은 아파트에 살아요." },
        },
        {
          en: "hot", ipa: "[hɑːt]", ko: "뜨거운, 더운", pos: "adj.",
          ex: { en: "Be careful, the soup is hot.", ko: "조심하세요, 국이 뜨거워요." },
        },
        {
          en: "cold", ipa: "[koʊld]", ko: "차가운, 추운", pos: "adj.",
          ex: { en: "It is very cold in Korea in January.", ko: "한국은 1월에 아주 추워요." },
        },
        {
          en: "new", ipa: "[nuː]", ko: "새로운", pos: "adj.",
          ex: { en: "Is that a new bag? I like it.", ko: "그거 새 가방이에요? 마음에 들어요." },
        },
        {
          en: "old", ipa: "[oʊld]", ko: "오래된, 나이 든", pos: "adj.",
          ex: { en: "This is a very old palace.", ko: "이곳은 아주 오래된 궁궐이에요." },
        },
        {
          en: "happy", ipa: "[ˈhæpi]", ko: "행복한, 기쁜", pos: "adj.",
          ex: { en: "I'm so happy today.", ko: "오늘 너무 행복해요." },
        },
        {
          en: "sad", ipa: "[sæd]", ko: "슬픈", pos: "adj.",
          ex: { en: "Why are you sad? Tell me.", ko: "왜 슬퍼요? 말해 봐요." },
        },
        {
          en: "easy", ipa: "[ˈiːzi]", ko: "쉬운", pos: "adj.",
          ex: { en: "This book is easy to read.", ko: "이 책은 읽기 쉬워요." },
        },
        {
          en: "difficult", ipa: "[ˈdɪfɪkəlt]", ko: "어려운", pos: "adj.",
          etym: "라틴어 dis-(반대)+facilis(쉬운) — facility(시설)와 같은 뿌리예요.",
          ex: { en: "English is difficult, but I like it.", ko: "영어는 어렵지만 저는 좋아해요." },
        },
        {
          en: "beautiful", ipa: "[ˈbjuːtəfl]", ko: "아름다운", pos: "adj.",
          etym: "프랑스어 beau(아름다운)+-ful — 라틴어 bellus가 뿌리예요.",
          ex: { en: "Jeju Island is a very beautiful place.", ko: "제주도는 아주 아름다운 곳이에요." },
        },
        {
          en: "busy", ipa: "[ˈbɪzi]", ko: "바쁜", pos: "adj.",
          ex: { en: "I'm busy on Monday.", ko: "저는 월요일에 바빠요." },
        },
        {
          en: "tired", ipa: "[ˈtaɪərd]", ko: "피곤한", pos: "adj.",
          ex: { en: "I'm tired. Let's go home.", ko: "피곤해요. 집에 가요." },
        },
      ],
    },
  ],
}
