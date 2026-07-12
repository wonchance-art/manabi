const themes = {
  level: "A1",
  title: "A1 기초 어휘",
  desc: "영어의 첫걸음 — 인사부터 기초 동사·형용사까지, 매일 입에 올리는 필수 단어 245개예요.",
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
    {
      name: "사물과 생활용품",
      icon: "🎒",
      words: [
        {
          en: "banana", ipa: "[bəˈnænə]", ko: "바나나", pos: "n.",
          ex: { en: "I eat a banana every morning.", ko: "저는 매일 아침 바나나를 먹어요." },
        },
        {
          en: "bag", ipa: "[bæɡ]", ko: "가방", pos: "n.",
          ex: { en: "My bag is heavy.", ko: "제 가방은 무거워요." },
        },
        {
          en: "book", ipa: "[bʊk]", ko: "책", pos: "n.",
          ex: { en: "I bought a book. The book was boring.", ko: "책을 한 권 샀어요. 그 책은 지루했어요." },
        },
        {
          en: "box", ipa: "[bɑːks]", ko: "상자", pos: "n.",
          ex: { en: "What is in the box?", ko: "상자 안에 뭐가 있어요?" },
        },
        {
          en: "camera", ipa: "[ˈkæmərə]", ko: "카메라", pos: "n.",
          ex: { en: "This camera takes nice pictures.", ko: "이 카메라는 사진이 잘 나와요." },
        },
        {
          en: "cell phone", ipa: "[ˈsel foʊn]", ko: "휴대폰, 핸드폰", pos: "n.",
          ex: { en: "I lost my cell phone.", ko: "핸드폰을 잃어버렸어요." },
        },
        {
          en: "computer", ipa: "[kəmˈpjuːtər]", ko: "컴퓨터", pos: "n.",
          ex: { en: "I use my computer every day.", ko: "저는 매일 컴퓨터를 써요." },
        },
        {
          en: "radio", ipa: "[ˈreɪdioʊ]", ko: "라디오", pos: "n.",
          ex: { en: "My dad listens to the radio.", ko: "아빠는 라디오를 들으세요." },
        },
        {
          en: "TV", ipa: "[ˌtiːˈviː]", ko: "텔레비전, TV", pos: "n.",
          ex: { en: "He watches TV at night.", ko: "그는 밤에 TV를 봐요." },
        },
        {
          en: "copy", ipa: "[ˈkɑːpi]", ko: "복사(본); 복사하다", pos: "n., v.",
          ex: { en: "Can I get a copy of this?", ko: "이거 복사본 한 장 받을 수 있을까요?" },
        },
        {
          en: "fork", ipa: "[fɔːrk]", ko: "포크", pos: "n.",
          ex: { en: "Can I have a fork, please?", ko: "포크 하나 주시겠어요?" },
        },
        {
          en: "spoon", ipa: "[spuːn]", ko: "숟가락", pos: "n.",
          ex: { en: "The baby eats with a spoon.", ko: "아기가 숟가락으로 먹어요." },
        },
        {
          en: "fan", ipa: "[fæn]", ko: "선풍기; 팬", pos: "n.",
          ex: { en: "Turn on the fan — it's hot.", ko: "더우니까 선풍기 좀 켜요." },
        },
        {
          en: "van", ipa: "[væn]", ko: "밴, 승합차", pos: "n.",
          ex: { en: "The van is in front of the house.", ko: "승합차가 집 앞에 있어요." },
        },
        {
          en: "vest", ipa: "[vest]", ko: "조끼", pos: "n.",
          ex: { en: "He is wearing a blue vest.", ko: "그는 파란 조끼를 입고 있어요." },
        },
        {
          en: "vitamin", ipa: "[ˈvaɪtəmɪn]", ko: "비타민", pos: "n.",
          ex: { en: "Take your vitamins every day.", ko: "비타민을 매일 챙겨 드세요." },
        },
        {
          en: "umbrella", ipa: "[ʌmˈbrelə]", ko: "우산", pos: "n.",
          ex: { en: "Take an umbrella — it's going to rain.", ko: "비 올 것 같으니 우산 챙기세요." },
        },
        {
          en: "ticket", ipa: "[ˈtɪkɪt]", ko: "표, 티켓", pos: "n.",
          ex: { en: "I'd like a one-way ticket, please.", ko: "편도표 한 장 주세요." },
        },
        {
          en: "key", ipa: "[kiː]", ko: "열쇠", pos: "n.",
          ex: { en: "Your keys are on the desk.", ko: "열쇠는 책상 위에 있어요." },
        },
        {
          en: "desk", ipa: "[desk]", ko: "책상", pos: "n.",
          ex: { en: "Your keys are on the desk.", ko: "열쇠는 책상 위에 있어요." },
        },
        {
          en: "table", ipa: "[ˈteɪbl]", ko: "테이블, 탁자", pos: "n.",
          ex: { en: "The cup is on the table.", ko: "컵이 테이블 위에 있어요." },
        },
        {
          en: "door", ipa: "[dɔːr]", ko: "문", pos: "n.",
          ex: { en: "Can you close the door?", ko: "문 좀 닫아줄래요?" },
        },
        {
          en: "wall", ipa: "[wɔːl]", ko: "벽", pos: "n.",
          ex: { en: "The picture is on the wall.", ko: "그림이 벽에 걸려 있어요." },
        },
        {
          en: "picture", ipa: "[ˈpɪktʃər]", ko: "그림, 사진", pos: "n.",
          ex: { en: "The picture is on the wall.", ko: "그림이 벽에 걸려 있어요." },
        },
        {
          en: "glass", ipa: "[ɡlæs]", ko: "유리잔; 유리", pos: "n.",
          ex: { en: "Two glasses of water, please.", ko: "물 두 잔 주세요." },
        },
        {
          en: "jacket", ipa: "[ˈdʒækɪt]", ko: "재킷, 점퍼", pos: "n.",
          ex: { en: "He's wearing a red jacket.", ko: "그는 빨간 재킷을 입고 있어요." },
        },
        {
          en: "pen", ipa: "[pen]", ko: "펜", pos: "n.",
          ex: { en: "I have a pen.", ko: "저는 펜이 있어요." },
        },
      ],
    },
    {
      name: "음식",
      icon: "🍎",
      words: [
        {
          en: "ice cream", ipa: "[ˈaɪs kriːm]", ko: "아이스크림", pos: "n.",
          ex: { en: "I love chocolate ice cream.", ko: "저는 초콜릿 아이스크림을 정말 좋아해요." },
        },
        {
          en: "juice", ipa: "[dʒuːs]", ko: "주스", pos: "n.",
          ex: { en: "I'd like fresh juice, please.", ko: "생과일 주스 주세요." },
        },
        {
          en: "fresh", ipa: "[freʃ]", ko: "신선한", pos: "adj.",
          ex: { en: "This bread is fresh.", ko: "이 빵은 갓 만든 거예요." },
        },
        {
          en: "berry", ipa: "[ˈberi]", ko: "베리, 딸기류 열매", pos: "n.",
          ex: { en: "These berries are sweet.", ko: "이 베리들은 달아요." },
        },
        {
          en: "fruit", ipa: "[fruːt]", ko: "과일", pos: "n.",
          ex: { en: "I eat fruit every day.", ko: "저는 매일 과일을 먹어요." },
        },
        {
          en: "meat", ipa: "[miːt]", ko: "고기", pos: "n.",
          ex: { en: "I don't eat meat.", ko: "저는 고기를 안 먹어요." },
        },
        {
          en: "cake", ipa: "[keɪk]", ko: "케이크", pos: "n.",
          ex: { en: "We made a cake for her birthday.", ko: "그녀의 생일 케이크를 만들었어요." },
        },
      ],
    },
    {
      name: "사람과 직업",
      icon: "🧑‍⚕️",
      words: [
        {
          en: "boy", ipa: "[bɔɪ]", ko: "남자아이, 소년", pos: "n.",
          ex: { en: "The boy is playing outside.", ko: "남자아이가 밖에서 놀고 있어요." },
        },
        {
          en: "student", ipa: "[ˈstuːdnt]", ko: "학생", pos: "n.",
          ex: { en: "I am a student.", ko: "저는 학생이에요." },
        },
        {
          en: "teacher", ipa: "[ˈtiːtʃər]", ko: "교사, 선생님", pos: "n.",
          ex: { en: "What do you do? — I'm a teacher.", ko: "무슨 일 하세요? — 교사예요." },
        },
        {
          en: "doctor", ipa: "[ˈdɑːktər]", ko: "의사", pos: "n.",
          ex: { en: "She's a doctor.", ko: "그녀는 의사예요." },
        },
        {
          en: "nurse", ipa: "[nɜːrs]", ko: "간호사", pos: "n.",
          ex: { en: "My mom is a nurse. She works at night.", ko: "우리 엄마는 간호사예요. 밤에 일하세요." },
        },
        {
          en: "police", ipa: "[pəˈliːs]", ko: "경찰", pos: "n.",
          ex: { en: "Call the police!", ko: "경찰을 불러요!" },
        },
        {
          en: "dad", ipa: "[dæd]", ko: "아빠", pos: "n.",
          ex: { en: "My dad has a car.", ko: "아빠는 차가 있으세요." },
        },
        {
          en: "mom", ipa: "[mɑːm]", ko: "엄마", pos: "n.",
          ex: { en: "My mom is a nurse.", ko: "우리 엄마는 간호사예요." },
        },
        {
          en: "grandfather", ipa: "[ˈɡrænfɑːðər]", ko: "할아버지", pos: "n.",
          ex: { en: "My grandfather tells us stories.", ko: "할아버지는 우리에게 이야기를 들려주세요." },
        },
        {
          en: "kid", ipa: "[kɪd]", ko: "아이", pos: "n.",
          ex: { en: "The kids are running outside.", ko: "아이들이 밖에서 뛰고 있어요." },
        },
      ],
    },
    {
      name: "장소와 동네",
      icon: "🏫",
      words: [
        {
          en: "home", ipa: "[hoʊm]", ko: "집(에)", pos: "n., adv.",
          ex: { en: "They're at home.", ko: "그들은 집에 있어요." },
        },
        {
          en: "room", ipa: "[ruːm]", ko: "방", pos: "n.",
          ex: { en: "This is my sister's room.", ko: "여기는 제 여동생 방이에요." },
        },
        {
          en: "bathroom", ipa: "[ˈbæθruːm]", ko: "화장실", pos: "n.",
          ex: { en: "Where is the bathroom?", ko: "화장실이 어디예요?" },
        },
        {
          en: "floor", ipa: "[flɔːr]", ko: "바닥; 층", pos: "n.",
          ex: { en: "The bag is on the floor.", ko: "가방이 바닥에 있어요." },
        },
        {
          en: "school", ipa: "[skuːl]", ko: "학교", pos: "n.",
          ex: { en: "I go to school by bus.", ko: "저는 버스로 학교에 가요." },
        },
        {
          en: "university", ipa: "[ˌjuːnɪˈvɜːrsəti]", ko: "대학교", pos: "n.",
          ex: { en: "She goes to a university in Seoul.", ko: "그녀는 서울에 있는 대학교에 다녀요." },
        },
        {
          en: "hospital", ipa: "[ˈhɑːspɪtl]", ko: "병원", pos: "n.",
          ex: { en: "She works at a hospital.", ko: "그녀는 병원에서 일해요." },
        },
        {
          en: "bank", ipa: "[bæŋk]", ko: "은행", pos: "n.",
          ex: { en: "The bank opens at nine.", ko: "은행은 9시에 열어요." },
        },
        {
          en: "hotel", ipa: "[hoʊˈtel]", ko: "호텔", pos: "n.",
          ex: { en: "We arrived at the hotel at ten.", ko: "우리는 10시에 호텔에 도착했어요." },
        },
        {
          en: "class", ipa: "[klæs]", ko: "수업; 반", pos: "n.",
          ex: { en: "I have a class on Monday.", ko: "월요일에 수업이 있어요." },
        },
        {
          en: "movie", ipa: "[ˈmuːvi]", ko: "영화", pos: "n.",
          ex: { en: "The movie starts at seven.", ko: "영화는 7시에 시작해요." },
        },
        {
          en: "bus", ipa: "[bʌs]", ko: "버스", pos: "n.",
          ex: { en: "I go to school by bus.", ko: "저는 버스로 학교에 가요." },
        },
        {
          en: "car", ipa: "[kɑːr]", ko: "자동차", pos: "n.",
          ex: { en: "My dad has a car.", ko: "아빠는 차가 있으세요." },
        },
        {
          en: "subway", ipa: "[ˈsʌbweɪ]", ko: "지하철", pos: "n.",
          ex: { en: "I listen to music on the subway.", ko: "지하철에서 음악을 들어요." },
        },
        {
          en: "stop", ipa: "[stɑːp]", ko: "정류장; 멈추다", pos: "n., v.",
          ex: { en: "I'm waiting at the bus stop.", ko: "버스 정류장에서 기다리고 있어요." },
        },
        {
          en: "way", ipa: "[weɪ]", ko: "길; 방법", pos: "n.",
          ex: { en: "I'd like a one-way ticket.", ko: "편도표 한 장 주세요." },
        },
        {
          en: "outside", ipa: "[ˌaʊtˈsaɪd]", ko: "밖에(서)", pos: "adv.",
          ex: { en: "The kids are running outside.", ko: "아이들이 밖에서 뛰고 있어요." },
        },
        {
          en: "world", ipa: "[wɜːrld]", ko: "세계, 세상", pos: "n.",
          ex: { en: "I want to see the world.", ko: "세상을 보고 싶어요." },
        },
      ],
    },
    {
      name: "자연과 동물",
      icon: "🌳",
      words: [
        {
          en: "dog", ipa: "[dɔːɡ]", ko: "개", pos: "n.",
          ex: { en: "She has a dog and a cat.", ko: "그녀는 개와 고양이를 키워요." },
        },
        {
          en: "cat", ipa: "[kæt]", ko: "고양이", pos: "n.",
          ex: { en: "The cat is sleeping on the sofa.", ko: "고양이가 소파에서 자고 있어요." },
        },
        {
          en: "cow", ipa: "[kaʊ]", ko: "소", pos: "n.",
          ex: { en: "The cow eats grass.", ko: "소는 풀을 먹어요." },
        },
        {
          en: "pig", ipa: "[pɪɡ]", ko: "돼지", pos: "n.",
          ex: { en: "The pig is big.", ko: "그 돼지는 커요." },
        },
        {
          en: "sheep", ipa: "[ʃiːp]", ko: "양", pos: "n.",
          ex: { en: "There are many sheep on the farm.", ko: "농장에 양이 많아요." },
        },
        {
          en: "animal", ipa: "[ˈænɪml]", ko: "동물", pos: "n.",
          ex: { en: "Dogs are loyal animals.", ko: "개는 충성스러운 동물이에요." },
        },
        {
          en: "tree", ipa: "[triː]", ko: "나무", pos: "n.",
          ex: { en: "There is a big tree in the park.", ko: "공원에 큰 나무가 있어요." },
        },
        {
          en: "lake", ipa: "[leɪk]", ko: "호수", pos: "n.",
          ex: { en: "We swim in the lake in summer.", ko: "여름에 호수에서 수영해요." },
        },
        {
          en: "sun", ipa: "[sʌn]", ko: "해, 햇볕", pos: "n.",
          ex: { en: "The sun is hot today.", ko: "오늘 햇볕이 뜨겁네요." },
        },
        {
          en: "sky", ipa: "[skaɪ]", ko: "하늘", pos: "n.",
          ex: { en: "The sky is blue today.", ko: "오늘 하늘이 파래요." },
        },
        {
          en: "rain", ipa: "[reɪn]", ko: "비; 비가 오다", pos: "n., v.",
          ex: { en: "It rains a lot in summer.", ko: "여름엔 비가 많이 와요." },
        },
        {
          en: "summer", ipa: "[ˈsʌmər]", ko: "여름", pos: "n.",
          ex: { en: "It rains a lot in summer.", ko: "여름엔 비가 많이 와요." },
        },
        {
          en: "night", ipa: "[naɪt]", ko: "밤", pos: "n.",
          ex: { en: "He watches TV at night.", ko: "그는 밤에 TV를 봐요." },
        },
        {
          en: "lice", ipa: "[laɪs]", ko: "머릿니 (louse의 복수)", pos: "n.",
          ex: { en: "Rice and lice sound different.", ko: "rice와 lice는 발음이 달라요." },
        },
      ],
    },
    {
      name: "몸과 옷",
      icon: "👕",
      words: [
        {
          en: "hand", ipa: "[hænd]", ko: "손", pos: "n.",
          ex: { en: "Wash your hands.", ko: "손 씻으세요." },
        },
        {
          en: "shoe", ipa: "[ʃuː]", ko: "신발", pos: "n.",
          ex: { en: "I need new shoes.", ko: "새 신발이 필요해요." },
        },
        {
          en: "wear", ipa: "[wer]", ko: "입다, 쓰다, 신다", pos: "v.",
          ex: { en: "He's wearing a red jacket.", ko: "그는 빨간 재킷을 입고 있어요." },
        },
        {
          en: "wash", ipa: "[wɑːʃ]", ko: "씻다", pos: "v.",
          ex: { en: "Wash your hands.", ko: "손 씻으세요." },
        },
      ],
    },
    {
      name: "기초 동사 보강",
      icon: "🏃",
      words: [
        {
          en: "work", ipa: "[wɜːrk]", ko: "일하다; 일", pos: "v., n.",
          ex: { en: "I work at a bank.", ko: "저는 은행에서 일해요." },
        },
        {
          en: "study", ipa: "[ˈstʌdi]", ko: "공부하다", pos: "v.",
          ex: { en: "I study in the morning and work at night.", ko: "아침에 공부하고 밤에 일해요." },
        },
        {
          en: "play", ipa: "[pleɪ]", ko: "놀다, (경기·악기를) 하다", pos: "v.",
          ex: { en: "My brother plays soccer.", ko: "우리 형은 축구를 해요." },
        },
        {
          en: "think", ipa: "[θɪŋk]", ko: "생각하다", pos: "v.",
          ex: { en: "I think you are right.", ko: "당신이 맞다고 생각해요." },
        },
        {
          en: "love", ipa: "[lʌv]", ko: "사랑하다; 사랑", pos: "v., n.",
          ex: { en: "She loves him.", ko: "그녀는 그를 사랑해요." },
        },
        {
          en: "buy", ipa: "[baɪ]", ko: "사다", pos: "v.",
          ex: { en: "I bought a book.", ko: "책을 한 권 샀어요." },
        },
        {
          en: "lose", ipa: "[luːz]", ko: "잃어버리다; 지다", pos: "v.",
          ex: { en: "I lost my cell phone.", ko: "핸드폰을 잃어버렸어요." },
        },
        {
          en: "open", ipa: "[ˈoʊpən]", ko: "열다; 열려 있는", pos: "v., adj.",
          ex: { en: "The bank opens at nine.", ko: "은행은 9시에 열어요." },
        },
        {
          en: "close", ipa: "[kloʊz]", ko: "닫다", pos: "v.",
          ex: { en: "Can you close the door?", ko: "문 좀 닫아줄래요?" },
        },
        {
          en: "start", ipa: "[stɑːrt]", ko: "시작하다", pos: "v.",
          ex: { en: "The movie starts at seven.", ko: "영화는 7시에 시작해요." },
        },
        {
          en: "sleep", ipa: "[sliːp]", ko: "자다", pos: "v.",
          ex: { en: "The children are sleeping.", ko: "아이들이 자고 있어요." },
        },
        {
          en: "run", ipa: "[rʌn]", ko: "달리다", pos: "v.",
          ex: { en: "The kids are running outside.", ko: "아이들이 밖에서 뛰고 있어요." },
        },
        {
          en: "watch", ipa: "[wɑːtʃ]", ko: "보다, 시청하다", pos: "v.",
          ex: { en: "He watches TV at night.", ko: "그는 밤에 TV를 봐요." },
        },
        {
          en: "listen", ipa: "[ˈlɪsn]", ko: "듣다", pos: "v.",
          ex: { en: "I listen to music on the subway.", ko: "지하철에서 음악을 들어요." },
        },
        {
          en: "speak", ipa: "[spiːk]", ko: "말하다, (언어를) 하다", pos: "v.",
          ex: { en: "Do you speak English?", ko: "영어 하세요?" },
        },
        {
          en: "talk", ipa: "[tɔːk]", ko: "이야기하다", pos: "v.",
          ex: { en: "She's talking on the phone.", ko: "그녀는 통화 중이에요." },
        },
        {
          en: "cook", ipa: "[kʊk]", ko: "요리하다", pos: "v.",
          ex: { en: "What are you doing? — I'm cooking.", ko: "지금 뭐 해요? — 요리 중이에요." },
        },
        {
          en: "give", ipa: "[ɡɪv]", ko: "주다", pos: "v.",
          ex: { en: "She gave me a piece of advice.", ko: "그녀가 조언을 하나 해줬어요." },
        },
        {
          en: "need", ipa: "[niːd]", ko: "필요하다", pos: "v.",
          ex: { en: "I need some information.", ko: "정보가 좀 필요해요." },
        },
        {
          en: "understand", ipa: "[ˌʌndərˈstænd]", ko: "이해하다", pos: "v.",
          ex: { en: "I don't understand.", ko: "이해가 안 돼요." },
        },
        {
          en: "mean", ipa: "[miːn]", ko: "의미하다", pos: "v.",
          ex: { en: "What does this word mean?", ko: "이 단어 무슨 뜻이에요?" },
        },
        {
          en: "spell", ipa: "[spel]", ko: "철자를 말하다[쓰다]", pos: "v.",
          ex: { en: "How do you spell that?", ko: "철자가 어떻게 되나요?" },
        },
        {
          en: "hope", ipa: "[hoʊp]", ko: "바라다; 희망", pos: "v., n.",
          ex: { en: "I hope you have a good day.", ko: "좋은 하루 보내길 바라요." },
        },
        {
          en: "arrive", ipa: "[əˈraɪv]", ko: "도착하다", pos: "v.",
          ex: { en: "We arrived at the hotel at ten.", ko: "우리는 10시에 호텔에 도착했어요." },
        },
        {
          en: "answer", ipa: "[ˈænsər]", ko: "대답; 대답하다", pos: "n., v.",
          ex: { en: "I know the answer.", ko: "답을 알고 있어요." },
        },
        {
          en: "write", ipa: "[raɪt]", ko: "쓰다", pos: "v.",
          ex: { en: "I write in my diary every night.", ko: "저는 매일 밤 일기를 써요." },
        },
        {
          en: "dream", ipa: "[driːm]", ko: "꿈; 꿈꾸다", pos: "n., v.",
          ex: { en: "I had a strange dream last night.", ko: "어젯밤에 이상한 꿈을 꿨어요." },
        },
      ],
    },
    {
      name: "기초 형용사·부사",
      icon: "✨",
      words: [
        {
          en: "right", ipa: "[raɪt]", ko: "맞는; 오른쪽", pos: "adj., n.",
          ex: { en: "You are right.", ko: "당신 말이 맞아요." },
        },
        {
          en: "important", ipa: "[ɪmˈpɔːrtnt]", ko: "중요한", pos: "adj.",
          ex: { en: "This is very important.", ko: "이건 아주 중요해요." },
        },
        {
          en: "green", ipa: "[ɡriːn]", ko: "초록색(의)", pos: "adj., n.",
          ex: { en: "I like green tea.", ko: "저는 녹차를 좋아해요." },
        },
        {
          en: "red", ipa: "[red]", ko: "빨간(색)", pos: "adj., n.",
          ex: { en: "He's wearing a red jacket.", ko: "그는 빨간 재킷을 입고 있어요." },
        },
        {
          en: "blue", ipa: "[bluː]", ko: "파란(색)", pos: "adj., n.",
          ex: { en: "The sky is blue today.", ko: "오늘 하늘이 파래요." },
        },
        {
          en: "color", ipa: "[ˈkʌlər]", ko: "색, 색깔", pos: "n.",
          ex: { en: "What color do you like?", ko: "무슨 색 좋아해요?" },
        },
        {
          en: "hungry", ipa: "[ˈhʌŋɡri]", ko: "배고픈", pos: "adj.",
          ex: { en: "I'm not hungry.", ko: "배 안 고파요." },
        },
        {
          en: "kind", ipa: "[kaɪnd]", ko: "친절한", pos: "adj.",
          ex: { en: "You are very kind.", ko: "당신은 정말 친절하네요." },
        },
        {
          en: "boring", ipa: "[ˈbɔːrɪŋ]", ko: "지루한", pos: "adj.",
          ex: { en: "The book was boring.", ko: "그 책은 지루했어요." },
        },
        {
          en: "near", ipa: "[nɪr]", ko: "가까운; 가까이에", pos: "adj., prep.",
          ex: { en: "Do they live near here?", ko: "그들은 이 근처에 살아요?" },
        },
        {
          en: "much", ipa: "[mʌtʃ]", ko: "많은, 많이", pos: "adj., adv.",
          ex: { en: "Thank you very much.", ko: "정말 감사합니다." },
        },
        {
          en: "many", ipa: "[ˈmeni]", ko: "많은", pos: "adj.",
          ex: { en: "There are many books here.", ko: "여기 책이 많아요." },
        },
        {
          en: "a lot", ipa: "[ə ˈlɑːt]", ko: "많이", pos: "adv.",
          ex: { en: "It rains a lot in summer.", ko: "여름엔 비가 많이 와요." },
        },
        {
          en: "now", ipa: "[naʊ]", ko: "지금", pos: "adv.",
          ex: { en: "I'm studying English now.", ko: "지금 영어 공부하고 있어요." },
        },
        {
          en: "together", ipa: "[təˈɡeðər]", ko: "함께, 같이", pos: "adv.",
          ex: { en: "We had lunch together.", ko: "우리는 같이 점심을 먹었어요." },
        },
      ],
    },
    {
      name: "배움과 정보",
      icon: "📚",
      words: [
        {
          en: "word", ipa: "[wɜːrd]", ko: "단어, 말", pos: "n.",
          ex: { en: "What does this word mean?", ko: "이 단어 무슨 뜻이에요?" },
        },
        {
          en: "question", ipa: "[ˈkwestʃən]", ko: "질문", pos: "n.",
          ex: { en: "Do you have any questions?", ko: "질문 있으세요?" },
        },
        {
          en: "information", ipa: "[ˌɪnfərˈmeɪʃn]", ko: "정보", pos: "n.",
          ex: { en: "I need some information.", ko: "정보가 좀 필요해요." },
        },
        {
          en: "advice", ipa: "[ədˈvaɪs]", ko: "조언, 충고", pos: "n.",
          ex: { en: "She gave me a piece of advice.", ko: "그녀가 조언을 하나 해줬어요." },
        },
        {
          en: "piece", ipa: "[piːs]", ko: "조각, 한 개", pos: "n.",
          ex: { en: "She gave me a piece of advice.", ko: "그녀가 조언을 하나 해줬어요." },
        },
        {
          en: "homework", ipa: "[ˈhoʊmwɜːrk]", ko: "숙제", pos: "n.",
          ex: { en: "I have a lot of homework.", ko: "숙제가 많아요." },
        },
        {
          en: "story", ipa: "[ˈstɔːri]", ko: "이야기", pos: "n.",
          ex: { en: "My grandfather tells us stories.", ko: "할아버지는 우리에게 이야기를 들려주세요." },
        },
        {
          en: "music", ipa: "[ˈmjuːzɪk]", ko: "음악", pos: "n.",
          ex: { en: "I listen to music on the subway.", ko: "지하철에서 음악을 들어요." },
        },
        {
          en: "pop", ipa: "[pɑːp]", ko: "팝 (음악)", pos: "n.",
          ex: { en: "She loves K-pop.", ko: "그녀는 케이팝을 사랑해요." },
        },
        {
          en: "game", ipa: "[ɡeɪm]", ko: "게임, 경기", pos: "n.",
          ex: { en: "I like this game.", ko: "이 게임 좋아요." },
        },
        {
          en: "soccer", ipa: "[ˈsɑːkər]", ko: "축구", pos: "n.",
          ex: { en: "My brother plays soccer.", ko: "우리 형은 축구를 해요." },
        },
        {
          en: "echo", ipa: "[ˈekoʊ]", ko: "메아리, 에코", pos: "n.",
          ex: { en: "E as in Echo, not I.", ko: "Echo의 E요, I 말고요." },
        },
        {
          en: "mind", ipa: "[maɪnd]", ko: "마음, 정신", pos: "n.",
          ex: { en: "I'll keep it in mind.", ko: "명심할게요." },
        },
        {
          en: "seat", ipa: "[siːt]", ko: "자리, 좌석", pos: "n.",
          ex: { en: "This seat is yours.", ko: "이 자리는 당신 거예요." },
        },
      ],
    },
    {
      name: "숫자 보강",
      icon: "🔢",
      words: [
        {
          en: "four", ipa: "[fɔːr]", ko: "넷, 4", pos: "num.",
          ex: { en: "She has four children.", ko: "그녀는 아이가 넷이에요." },
        },
        {
          en: "five", ipa: "[faɪv]", ko: "다섯, 5", pos: "num.",
          ex: { en: "The store closes at five.", ko: "가게는 5시에 닫아요." },
        },
        {
          en: "six", ipa: "[sɪks]", ko: "여섯, 6", pos: "num.",
          ex: { en: "Let's meet at six.", ko: "여섯 시에 만나요." },
        },
        {
          en: "seven", ipa: "[ˈsevn]", ko: "일곱, 7", pos: "num.",
          ex: { en: "The movie starts at seven.", ko: "영화는 7시에 시작해요." },
        },
        {
          en: "nine", ipa: "[naɪn]", ko: "아홉, 9", pos: "num.",
          ex: { en: "The bank opens at nine.", ko: "은행은 9시에 열어요." },
        },
      ],
    },
    {
      name: "요일과 달",
      icon: "📅",
      words: [
        {
          en: "Monday", ipa: "[ˈmʌndeɪ]", ko: "월요일", pos: "n.",
          ex: { en: "I have a class on Monday.", ko: "월요일에 수업이 있어요." },
        },
        {
          en: "Tuesday", ipa: "[ˈtuːzdeɪ]", ko: "화요일", pos: "n.",
          ex: { en: "Can we meet on Tuesday?", ko: "화요일에 만날 수 있어요?" },
        },
        {
          en: "Wednesday", ipa: "[ˈwenzdeɪ]", ko: "수요일", pos: "n.",
          ex: { en: "The test is on Wednesday.", ko: "시험은 수요일이에요." },
        },
        {
          en: "Thursday", ipa: "[ˈθɜːrzdeɪ]", ko: "목요일", pos: "n.",
          ex: { en: "I work late on Thursdays.", ko: "목요일엔 늦게까지 일해요." },
        },
        {
          en: "Friday", ipa: "[ˈfraɪdeɪ]", ko: "금요일", pos: "n.",
          ex: { en: "The results will be announced on Friday.", ko: "결과는 금요일에 발표될 거예요." },
        },
        {
          en: "Saturday", ipa: "[ˈsætərdeɪ]", ko: "토요일", pos: "n.",
          ex: { en: "Does she work on Saturdays?", ko: "그녀는 토요일에도 일해요?" },
        },
        {
          en: "Sunday", ipa: "[ˈsʌndeɪ]", ko: "일요일", pos: "n.",
          ex: { en: "We rest on Sunday.", ko: "우리는 일요일에 쉬어요." },
        },
        {
          en: "March", ipa: "[mɑːrtʃ]", ko: "3월", pos: "n.",
          ex: { en: "We're going to move in March.", ko: "우리 3월에 이사할 거예요." },
        },
        {
          en: "October", ipa: "[ɑːkˈtoʊbər]", ko: "10월", pos: "n.",
          ex: { en: "My birthday is in October.", ko: "제 생일은 10월이에요." },
        },
        {
          en: "o'clock", ipa: "[əˈklɑːk]", ko: "~시 (정각)", pos: "adv.",
          ex: { en: "Let's meet at two o'clock.", ko: "2시 정각에 만나요." },
        },
      ],
    },
    {
      name: "일상 표현 보강",
      icon: "💬",
      words: [
        {
          en: "okay", ipa: "[ˌoʊˈkeɪ]", ko: "좋아, 괜찮아", pos: "expr.",
          ex: { en: "Okay, see you tomorrow!", ko: "좋아, 내일 봐!" },
        },
        {
          en: "yeah", ipa: "[jeə]", ko: "응, 어 (편한 yes)", pos: "expr.",
          ex: { en: "Yeah, that sounds good.", ko: "응, 좋아." },
        },
        {
          en: "hey", ipa: "[heɪ]", ko: "야, 저기 (부르는 말)", pos: "expr.",
          ex: { en: "Hey, got a minute?", ko: "야, 잠깐 시간 돼?" },
        },
        {
          en: "bed", ipa: "[bed]", ko: "침대", pos: "n.",
          ex: { en: "I went to bed early last night.", ko: "어젯밤엔 일찍 잤어요." },
        },
      ],
    },
  ],
}

export default themes;
