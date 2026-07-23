// 🗣️ 학습 월드 — NPC 도트 대화 스크립트(데이터 + 순수 판정 헬퍼).
//
// 배운 일본어를 "쓰는 곳" (마스터플랜 A-1). 부산→후쿠오카 페리 목적지에 선 NPC 2명:
//   · ramen  — 하카타 라멘 전문점(고정 점포) 주인 (챕터 ot-10-ramen 기반: 食券·바리카타·替え玉)
//       ※ 포장마차(屋台)가 아니라 고정 점포 — 후쿠오카시 공식 안내상 야타이는 직접 주문→식후
//         현금 계산 관행이라 券売機(식권) 첫 단계와 모순. 챕터가 가르치는 食券/券売機 표현을
//         살리는 쪽으로 고정 점포로 통일했다(Codex P1-2).
//   · shrine — 다자이후 신사 미코상 (챕터 ot-09-jinja 기반: 二礼二拍手一礼·五円=ご縁·おみくじ)
//
// 대사·문항은 해당 챕터에서 배운 표현 그대로. P6 톤(낄낄 우선)·P9-1(생초보 가나 위주,
// 실물 간판 한자는 요미 병기). React/Phaser 의존 0 — vitest 로 판정·오미쿠지 분포를 검증한다.
//
// 스텝 모양(NpcDialog 가 순차 소비):
//   { t:'narr', text }                                             한국어 지문 박스
//   { t:'say', who:'npc'|'me', ja, yomi, ko, narr? }               도트 대사(후리가나 루비 + 뜻 토글)
//   { t:'ask', mode:'choice', prompt, choices:[{ja,yomi}|{text}, correct?], why }
//   { t:'ask', mode:'type', prompt, before, after, answer, accept:[], hint?, why }
//   { t:'omikuji' }                                                오미쿠지 뽑기(shrine 전용)
// 완주(마지막 스텝 통과) 시 NpcDialog 가 onComplete()로 스탬프를 수집한다(1회).
// ※ 스탬프 시맨틱(P2): 이 완주 스탬프는 보안성 없는 "방문 기념"이다(/api/world/stamps 는 실존
//   노드+본인만 검증, 완주 검증 없음). 학습 달성·보상으로 쓰려면 서버 검증 claim(A-4 원칙) 필요.

// ── 순수 판정(타이핑 문항) ── NFKC 정규화 + 공백 제거 후 accept[] 중 하나와 일치하면 정답.
// (ReadingTextView.normalizeFill 과 같은 규칙을 이 모듈에 자립적으로 둔다 — 순수성 유지.)
export function normalizeAnswer(s) {
  return String(s ?? '').normalize('NFKC').replace(/[\s　]+/g, '').trim();
}
export function judgeType(input, accept) {
  const n = normalizeAnswer(input);
  if (!n) return false;
  return (Array.isArray(accept) ? accept : []).some((a) => normalizeAnswer(a) === n);
}

// ── 오미쿠지 결과 ── 확률 균등(drawOmikuji). **등급 서열은 전국 통일이 없음이 사실**
// (신사본청 명시, content-idea-backlog 광맥 3) — 그래서 어떤 결과 문구도 "무엇이 위/아래"를
// 단정하지 않는다. 실물 간판 한자는 요미 병기(P9-1). 凶은 "묶고 가기" 리추얼로 이어진다.
export const OMIKUJI_RESULTS = [
  { grade: '大吉', yomi: 'だいきち (다이키치)', ko: '대길', line: '좋은 기운! 종이는 지갑에 고이 넣어 두는 사람도 많아요.' },
  { grade: '吉', yomi: 'きち (키치)', ko: '길', line: '무난한 하루. 한자 그대로 "길"이네요.' },
  { grade: '中吉', yomi: 'ちゅうきち (추-키치)', ko: '중길', line: '서열은 신사마다 달라요 — 따지지 말고 한자 읽는 재미로!' },
  { grade: '小吉', yomi: 'しょうきち (쇼-키치)', ko: '소길', line: '작은 행운. 순서 논쟁은 접어두고 오늘을 즐겨요.' },
  { grade: '末吉', yomi: 'すえきち (스에키치)', ko: '말길', line: '천천히 풀리는 운. 조급해 말기로 해요.' },
  { grade: '凶', yomi: 'きょう (쿄-)', ko: '흉', line: '괜찮아요! 나쁜 운은 신사에 두고 가는 리추얼이 있어요.', isKyo: true },
];

// 균등 확률로 결과 1개. rnd 주입 가능(테스트 결정성). 서열 가정 없음 — 인덱스만 고른다.
export function drawOmikuji(rnd = Math.random) {
  const i = Math.floor(rnd() * OMIKUJI_RESULTS.length);
  return OMIKUJI_RESULTS[Math.max(0, Math.min(i, OMIKUJI_RESULTS.length - 1))];
}

export const NPC_SCRIPTS = {
  // ── 하카타 라멘 전문점 주인 (ot-10-ramen) — 고정 점포(입구에 券売機가 있는 그 가게) ──
  ramen: {
    label: '라멘집 주인',
    emoji: '🍜',
    intro: '하카타 돈코츠 라멘 전문점. 입구 券売機(켄바이키)에서 식권부터!',
    steps: [
      { t: 'narr', text: '라멘 가게의 붉은 노렌을 젖히고 들어서자 뽀얀 김이 확 — 카운터 너머 주인장이 씩 웃는다.' },
      {
        t: 'say', who: 'npc',
        ja: 'いらっしゃい！まずは 食券を どうぞ。',
        yomi: 'いらっしゃい！まずは しょっけんを どうぞ (이랏샤이! 마즈와 숏켄오 도-조)',
        ko: '어서 와요! 우선 식권(食券)부터 주세요.',
        narr: '입구 券売機(켄바이키)에서 뽑은 그 종이 말이지.',
      },
      {
        t: 'ask', mode: 'choice',
        prompt: '식권을 건네며 돈코츠 라멘을 주문해요. 맞는 말은?',
        choices: [
          { ja: 'とんこつラーメン、おねがいします。', yomi: 'とんこつラーメン、おねがいします (톤코츠 라-멘, 오네가이시마스)', correct: true },
          { ja: 'さようなら。', yomi: 'さようなら (사요-나라)' },
          { ja: 'いただきます。', yomi: 'いただきます (이타다키마스)' },
        ],
        why: '주문·부탁엔 만능 「お願いします」! 편의점에서 쓰던 그 한마디가 라멘집에서도 그대로예요.',
      },
      {
        t: 'say', who: 'npc',
        ja: 'はい！かたさは？',
        yomi: 'はい！かたさは？ (하이! 카타사와?)',
        ko: '좋아요! (면) 굳기는요?',
        narr: 'やわ→ふつう→カタ→バリカタ… 현지 고수는 バリカタ(엄청 단단하게)!',
      },
      {
        t: 'ask', mode: 'type',
        prompt: '면을 아주 단단하게! 「かたさは ___ で。」 빈칸을 채워 말해요.',
        before: 'かたさは ', after: ' で。',
        answer: 'バリカタ', accept: ['バリカタ', 'ばりかた'],
        hint: '바리카타 — バリ가 하카타 사투리로 "엄청".',
        why: 'バリカタ=엄청 단단하게. バリ는 하카타 사투리 "엄청"이에요. (히라가나 ばりかた도 정답)',
      },
      {
        t: 'say', who: 'npc',
        ja: 'おまち！',
        yomi: 'おまち！ (오마치!)',
        ko: '나왔어요!',
        narr: '가는 면이 국물에 조금. 어라, 벌써 부족해!',
      },
      {
        t: 'ask', mode: 'choice',
        prompt: '면이 반쯤 남았을 때 미리! 면 리필을 부탁하는 마법의 한마디는?',
        choices: [
          { ja: '替え玉 おねがいします。', yomi: 'かえだま おねがいします (카에다마 오네가이시마스)', correct: true },
          { ja: 'おかいけい おねがいします。', yomi: 'おかいけい おねがいします (오카이케- 오네가이시마스)' },
          { ja: 'ごちそうさまでした。', yomi: 'ごちそうさまでした (고치소-사마데시타)' },
        ],
        why: '替え玉(카에다마)는 "면 리필"이지 "한 그릇 더"가 아니에요. 국물이 남았을 때 미리 외치는 게 요령!',
      },
      {
        t: 'say', who: 'npc',
        ja: 'はい、替え玉！うまいでしょ？',
        yomi: 'はい、かえだま！うまいでしょ？ (하이, 카에다마! 우마이데쇼?)',
        ko: '자, 면 리필! 맛있죠?',
        narr: '후루룩— 여기선 소리 내 먹는 게 맛있다는 신호래요(통설).',
      },
      {
        t: 'say', who: 'me',
        ja: 'ごちそうさまでした。',
        yomi: 'ごちそうさまでした (고치소-사마데시타)',
        ko: '잘 먹었습니다.',
      },
    ],
    reward: '🍜 라멘 완주! 「替え玉お願いします」, 이제 진짜 하카타에서 통해요.',
  },

  // ── 다자이후 신사 미코상 (ot-09-jinja) ──
  shrine: {
    label: '미코상',
    emoji: '⛩️',
    intro: '붉은 鳥居(도리이) 너머 신사. 참배 예절과 오미쿠지!',
    steps: [
      { t: 'narr', text: '붉은 鳥居(도리이)를 지나자, 방울 곁에 선 미코상이 미소 짓는다.' },
      {
        t: 'say', who: 'npc',
        ja: 'ようこそ。まずは 二礼二拍手一礼。',
        yomi: 'ようこそ。まずは にれいにはくしゅいちれい (요-코소. 마즈와 니레이니하쿠슈이치레이)',
        ko: '잘 오셨어요. 먼저 참배 예절부터 — 두 번 절·두 번 박수·한 번 절(통설).',
        narr: '한국 절엔 없는 "박수"가 포인트!',
      },
      {
        t: 'ask', mode: 'choice',
        prompt: '미코상: 본전 앞 참배, 순서로 맞는 것은?',
        choices: [
          { text: '두 번 절 → 두 번 박수 → 한 번 절', correct: true },
          { text: '박수 세 번 → 한 번 절' },
          { text: '한 번 절 → 향 피우기' },
        ],
        why: '二礼二拍手一礼(통설) — 격식 완벽할 필요 없이 앞사람 따라 하면 돼요. 향은 절(お寺) 쪽이에요.',
      },
      {
        t: 'say', who: 'npc',
        ja: '五円は「ご縁」。いいご縁が ありますように。',
        yomi: 'ごえんは「ごえん」。いいごえんが ありますように (고엔와 고엔. 이- 고엔가 아리마스요-니)',
        ko: '5엔(五円)은 "인연(ご縁)". 좋은 인연이 있기를.',
        narr: '발음이 같아서 생긴 말장난(ダジャレ) — 효험 규칙이 아니라 재밌는 속설이에요.',
      },
      {
        t: 'ask', mode: 'choice',
        prompt: '미코상: 왜 하필 5엔(五円)을 賽銭(사이센)함에 넣을까요?',
        choices: [
          { text: '"인연(ご縁)"과 발음이 같아서 (말장난)', correct: true },
          { text: '5엔이 가장 비싼 동전이라서' },
          { text: '5엔만 받는 규칙이라서' },
        ],
        why: '五円(ごえん)=ご縁(인연) 말놀이. 통설·속설일 뿐, 효험 규칙은 아니에요.',
      },
      {
        t: 'say', who: 'npc',
        ja: 'では、おみくじを どうぞ。',
        yomi: 'では、おみくじを どうぞ (데와, 오미쿠지오 도-조)',
        ko: '그럼, 오미쿠지 한 장 뽑아 보세요.',
      },
      {
        t: 'ask', mode: 'type',
        prompt: '접수처에서 오미쿠지를 뽑는 한마디! 「おみくじを ___ 。」',
        before: 'おみくじを ', after: '。',
        answer: 'ください', accept: ['ください', '下さい'],
        hint: '원하는 것 + を + ください = "~ 주세요".',
        why: '「おみくじをください」 — 갖고 싶은 것 뒤에 をください를 붙이면 "~ 주세요"가 돼요.',
      },
      { t: 'omikuji' },
      {
        t: 'say', who: 'npc',
        ja: 'またどうぞ。よい ご縁を。',
        yomi: 'またどうぞ。よい ごえんを (마타 도-조. 요이 고엔오)',
        ko: '또 오세요. 좋은 인연을.',
      },
    ],
    reward: '⛩️ 신사 참배 완주! 오미쿠지는 언제든 다시 뽑을 수 있어요.',
  },

  // ── 보르도 생장역 안내인 — 불어 첫걸음: 인사 + 방향 묻기 (채움 라운드 1, 빈 역 지구) ──
  'gare-accueil': {
    label: '역 안내인',
    emoji: '🚉',
    intro: '생장역 앞 안내 부스. 프랑스에선 인사가 모든 대화의 열쇠야!',
    steps: [
      { t: 'narr', text: '아치형 유리 지붕 아래로 아침 햇살이 쏟아진다. 안내 부스의 직원과 눈이 마주쳤다 — 프랑스에선 용건보다 인사가 먼저다.' },
      {
        t: 'say', who: 'npc',
        ja: 'Bonjour ! Je peux vous aider ?',
        yomi: 'Bonjour ! Je peux vous aider ? (봉주르! 주 푸 부 제데?)',
        ko: '안녕하세요! 도와드릴까요?',
        narr: '먼저 인사를 돌려주고 용건을 말하자. 시내로 가고 싶다면?',
      },
      {
        t: 'ask', mode: 'choice',
        prompt: '인사 후 「시내 중심가로 가고 싶어요」라고 말하려면?',
        choices: [
          { ja: 'Bonjour, le centre-ville, s\'il vous plaît.', yomi: '(봉주르, 르 상트르빌, 실 부 플레)', correct: true },
          { ja: 'Au revoir !', yomi: '(오 르부아르!)' },
          { ja: 'Merci, c\'est tout.', yomi: '(메르시, 세 투)' },
        ],
        why: 's\'il vous plaît(부탁해요)를 붙이면 정중한 요청이 돼요. Au revoir는 헤어질 때, c\'est tout는 "그게 다예요(끝)"라는 뜻이에요.',
      },
      {
        t: 'ask', mode: 'type',
        prompt: '길을 알려줬다. 고마움을 담아 「___ beaucoup !」 빈칸을 채워 말해요.',
        before: '', after: ' beaucoup !',
        answer: 'Merci', accept: ['Merci', 'merci', 'MERCI'],
        hint: '고마워요 — 프랑스에서 하루에 제일 많이 쓰는 말이에요.',
        why: 'Merci beaucoup(메르시 보쿠) = 정말 고마워요. beaucoup(많이)를 붙이면 마음이 더 커져요.',
      },
      {
        t: 'say', who: 'npc',
        ja: 'Très bien ! Tout droit, puis à gauche.',
        yomi: 'Très bien ! Tout droit, puis à gauche. (트레 비앙! 투 드루아, 퓌 아 고슈)',
        ko: '좋아요! 곧장 가다가 왼쪽이에요.',
        narr: 'tout droit(직진)·à gauche(왼쪽) — 길 안내 단어는 여행 내내 만난다. 종탑 방향으로 걸어가자.',
      },
    ],
  },

  // ── 스트라스부르역 브레첼 노점 — 불어 첫걸음: 하나 주문하기 (채움 라운드 1, 빈 역 지구) ──
  'gare-bretzel': {
    label: '브레첼 노점',
    emoji: '🥨',
    intro: '역 앞 브레첼 노점. 알자스의 아침은 갓 구운 브레첼 냄새로 시작해!',
    steps: [
      { t: 'narr', text: '역 광장 모퉁이, 소금 알갱이가 반짝이는 브레첼이 줄줄이 걸려 있다. 고소한 냄새에 발이 멈춘다.' },
      {
        t: 'say', who: 'npc',
        ja: 'Bonjour ! Un bretzel tout chaud ?',
        yomi: 'Bonjour ! Un bretzel tout chaud ? (봉주르! 앙 브레첼 투 쇼?)',
        ko: '안녕하세요! 따끈한 브레첼 하나 어때요?',
        narr: '하나 사 먹고 싶다. 숫자 un(하나)과 부탁 표현을 붙이면?',
      },
      {
        t: 'ask', mode: 'choice',
        prompt: '「하나 주세요」라고 주문하려면?',
        choices: [
          { ja: 'Un bretzel, s\'il vous plaît !', yomi: '(앙 브레첼, 실 부 플레!)', correct: true },
          { ja: 'Non, merci.', yomi: '(농, 메르시)' },
          { ja: 'Combien ?', yomi: '(콩비앙?)' },
        ],
        why: '개수 + s\'il vous plaît가 가장 간단한 주문 공식이에요. Non merci는 사양, Combien?은 "얼마예요?"라고 값만 묻는 말이에요.',
      },
      {
        t: 'ask', mode: 'type',
        prompt: '값을 건네며 인사를 곁들이자. 「___ , merci !」 — 아침 인사를 채워요.',
        before: '', after: ' , merci !',
        answer: 'Bonjour', accept: ['Bonjour', 'bonjour', 'BONJOUR'],
        hint: '해가 떠 있는 동안의 인사 — 봉주르.',
        why: 'Bonjour(봉주르)는 아침~낮 인사예요. 저녁이면 Bonsoir(봉수아르)로 바뀌어요.',
      },
      {
        t: 'say', who: 'npc',
        ja: 'Voilà ! Bonne journée !',
        yomi: 'Voilà ! Bonne journée ! (부알라! 본 주르네!)',
        ko: '여기요! 좋은 하루 보내세요!',
        narr: '따끈한 브레첼을 받아 들었다 — Voilà(여기요)와 Bonne journée(좋은 하루)까지, 역 앞에서 배운 세 마디.',
      },
    ],
  },

  // ── 리옹 프레스킬 카페 테라스 종업원 — 불어 첫걸음: 카페 주문·계산 (채움 라운드 1) ──
  'lyon-presquile-cafe': {
    label: '카페 종업원',
    emoji: '☕',
    intro: '리옹 반도 카페 테라스. 유럽식 카페에서 첫 주문 — Un café, s\'il vous plaît!',
    steps: [
      { t: 'narr', text: '햇빛 아래 펼쳐진 카페 테라스. 초록빛 의자에 앉으니 종업원이 아스라한 미소로 다가온다 — 프랑스식 여유로움이다.' },
      {
        t: 'say', who: 'npc',
        ja: 'Bonjour ! Qu\'est-ce que vous désirez ?',
        yomi: 'Bonjour ! Qu\'est-ce que vous désirez ? (봉주르! 케스크 부 데지레?)',
        ko: '안녕하세요! 뭘 원하세요?',
        narr: '카페 커피를 정중히 부탁하려면?',
      },
      {
        t: 'ask', mode: 'choice',
        prompt: '「커피 하나 주세요」라고 주문하는 말은?',
        choices: [
          { ja: 'Un café, s\'il vous plaît.', yomi: '(앙 카페, 실 부 플레)', correct: true },
          { ja: 'L\'addition, s\'il vous plaît.', yomi: '(라디숑, 실 부 플레)' },
          { ja: 'Au revoir !', yomi: '(오 르부아르!)' },
        ],
        why: '개수 + 상품 + s\'il vous plaît = 정중한 주문. L\'addition은 계산 청구, Au revoir는 인사예요.',
      },
      {
        t: 'say', who: 'npc',
        ja: 'Un café. Crème ou sucre ?',
        yomi: 'Un café. Crème ou sucre ? (앙 카페. 크렘 우 슈크르?)',
        ko: '커피 한 잔. 크림이나 설탕요?',
        narr: '프랑스식 커피는 흑커피가 기본이지만, 물어봐 주는 게 배려다.',
      },
      {
        t: 'ask', mode: 'type',
        prompt: '설탕을 넣어 달라고 말해요. 「___ sucre, s\'il vous plaît.」',
        before: '', after: ' sucre, s\'il vous plaît.',
        answer: 'Avec', accept: ['Avec', 'avec', 'AVEC'],
        hint: '~와 함께라는 뜻 — 아벡.',
        why: 'Avec = ~와 함께. 「Avec sucre」= 설탕과 함께(설탕 넣어서). Avec eau(물)도 같은 패턴이에요.',
      },
      {
        t: 'say', who: 'npc',
        ja: 'Voilà ! Bon appétit !',
        yomi: 'Voilà ! Bon appétit ! (부알라! 본 아페티!)',
        ko: '여기요! 즐겁게 드세요!',
        narr: '따뜻한 커피가 담긴 잔이 탁자에 내려진다. 프랑스에서는 음식뿐 아니라 음료도 「Bon appétit!」라고 인사해요.',
      },
      {
        t: 'say', who: 'me',
        ja: 'Merci beaucoup !',
        yomi: 'Merci beaucoup ! (메르시 보쿠!)',
        ko: '정말 감사합니다!',
      },
    ],
    reward: '☕ 카페 테라스 완주! 「Un café」, 이제 리옹의 어떤 카페든 이 한마디예요.',
  },

  // ── 리옹 구시가 안내인 — 불어 첫걸음: 길 묻기·감사 (채움 라운드 1) ──
  'lyon-vieux-traboule': {
    label: '구시가 주민',
    emoji: '🏘️',
    intro: '구시가 골목 안내. 르네상스 통로 트라불의 미스터리 — 길을 물어보며 배워요.',
    steps: [
      { t: 'narr', text: '오래된 돌담과 창틀이 드문드문 남은 좁은 골목. 지붕 덮인 통로(트라불)를 찾고 있자, 주머니에 손을 넣은 주민이 손짓한다.' },
      {
        t: 'say', who: 'npc',
        ja: 'Bonjour ! Cherchez-vous quelque chose ?',
        yomi: 'Bonjour ! Cherchez-vous quelque chose ? (봉주르! 셰르셰 부 켈크 쇼즈?)',
        ko: '안녕하세요! 뭔가 찾으세요?',
        narr: '트라불을 찾고 있다고 말해야지. 「Où est traboule ?」라고 길을 물으려면?',
      },
      {
        t: 'ask', mode: 'choice',
        prompt: '「트라불이 어디 있어요?」라고 물으려면?',
        choices: [
          { ja: 'Où est la traboule ?', yomi: '(우 에 라 트라불?)', correct: true },
          { ja: 'Que est la traboule ?', yomi: '(크 에 라 트라불?)' },
          { ja: 'Comme la traboule ?', yomi: '(콤 라 트라불?)' },
        ],
        why: '「Où est」는 "~이 어디 있어요?"라고 위치를 묻는 표현이에요. Que(무엇)는 종류 질문, Comme(처럼)는 비교예요.',
      },
      {
        t: 'say', who: 'npc',
        ja: 'Ah, la traboule ! Celle-ci, regardez. C\'est un passage couvert, autrefois utilisé par les canuts.',
        yomi: 'Ah, la traboule ! Celle-ci, regardez. C\'est un passage couvert, autrefois utilisé par les canuts. (아, 라 트라불! 셀시, 르가르데. 세 앙 파사주 쿠베르, 오트르푸아 유틸리제 파르 레 카뉘)',
        ko: '아, 트라불! 이거 봐요. 옛날에 비단 직공(카뉘)들이 쓰던 지붕 덮인 통로였어요.',
        narr: '비를 피해 천을 나르던 견직물 상인들의 비밀 통로 — 리옹의 역사가 담긴 골목이다.',
      },
      {
        t: 'ask', mode: 'type',
        prompt: '친절한 설명에 감사해요. 「___ , merci beaucoup !」',
        before: '', after: ' , merci beaucoup !',
        answer: 'Merci', accept: ['Merci', 'merci', 'MERCI'],
        hint: '고마워요 — 메르시.',
        why: 'Merci beaucoup = 정말 고마워요. Merci만 해도 충분하지만, beaucoup를 붙이면 더 따뜻해요.',
      },
      {
        t: 'say', who: 'npc',
        ja: 'De rien ! Bonne visite à Lyon !',
        yomi: 'De rien ! Bonne visite à Lyon ! (드 리앙! 본 비지트 아 리용!)',
        ko: '천만에요! 리옹 구경 잘하세요!',
        narr: '구시가 돌담을 따라 걸으며, 트라불 골목의 어둠 속에서 리옹의 옛 모습을 상상한다.',
      },
    ],
    reward: '🏘️ 트라불 탐방 완주! 「Où est」로 시작하는 모든 길 찾기가 통해요.',
  },

  // ── 리옹 크루아루스 시장 과일 상인 — 불어 첫걸음: 가격 묻기·숫자 (채움 라운드 1) ──
  'lyon-croix-rousse-marche': {
    label: '시장 과일 상인',
    emoji: '🍎',
    intro: '크루아루스 골목 시장. 신선한 과일 냄새와 함께 숫자를 배워요.',
    steps: [
      { t: 'narr', text: '골목 양쪽으로 과일과 채소를 늘어놓은 노점들. 상인의 목소리가 늘어진 톤으로 호객을 하고, 붉은 딸기가 쌓인 상자 앞에서 발이 멈춘다.' },
      {
        t: 'say', who: 'npc',
        ja: 'Bonjour ! Des fraises fraîches ? Deux euros seulement !',
        yomi: 'Bonjour ! Des fraises fraîches ? Deux euros seulement ! (봉주르! 데 프레즈 프레슈? 드 외로 슬므앙!)',
        ko: '안녕하세요! 싱싱한 딸기? 겨우 2유로만!',
        narr: '정말 싱싱해 보인다. 가격을 확인해야겠다 — 불어로 숫자를 물어보려면?',
      },
      {
        t: 'ask', mode: 'choice',
        prompt: '「얼마예요?」라고 가격을 물으려면?',
        choices: [
          { ja: 'C\'est combien ?', yomi: '(세 콩비앙?)', correct: true },
          { ja: 'Combien d\'euros ?', yomi: '(콩비앙 도이로?)' },
          { ja: 'C\'est cher ?', yomi: '(세 셰르?)' },
        ],
        why: '「C\'est combien?」 = "이거 얼마예요?"가 가장 자연스러워요. Combien d\'euros도 맞지만 더 정식 표현, C\'est cher?는 "비싼가요?"라고 가격을 묻는 거예요.',
      },
      {
        t: 'say', who: 'npc',
        ja: 'Trois euros le kilo. Trois, quatre, cinq... prix spécial !',
        yomi: 'Trois euros le kilo. Trois, quatre, cinq... prix spécial ! (트루아 외로 르 킬로. 트루아, 카트르, 상크... 프리 스페시알!)',
        ko: '1킬로에 3유로예요. 3, 4, 5... 특가!',
        narr: '숫자를 세며 손가락을 펼친다. Trois(3)·quatre(4)·cinq(5)…',
      },
      {
        t: 'ask', mode: 'type',
        prompt: '과일 2킬로를 가져가며 가격을 재확인해요. 「Deux kilos, c\'est ___ euros ?」',
        before: 'Deux kilos, c\'est ', after: ' euros ?',
        answer: 'six', accept: ['six', 'Six', 'SIX'],
        hint: '3 + 3 = ? 여섯을 불어로 말해요.',
        why: '3유로 × 2킬로 = 6유로. Six(식스) — 6은 리옹 시장에서 제일 많이 쓰이는 숫자예요.',
      },
      {
        t: 'say', who: 'npc',
        ja: 'Oui, six euros ! Voilà, bon marché !',
        yomi: 'Oui, six euros ! Voilà, bon marché ! (우이, 식 외로! 부알라, 본 마르셰!)',
        ko: '네, 6유로! 여기요, 싼 가격이에요!',
        narr: '종이봉지에 담긴 빨간 딸기. Bon marché(좋은 시장가격)는 문자 그대로 "좋은 시장"이라는 뜻이에요.',
      },
      {
        t: 'say', who: 'me',
        ja: 'Merci ! Au revoir !',
        yomi: 'Merci ! Au revoir ! (메르시! 오 르부아르!)',
        ko: '감사합니다! 안녕히 가세요!',
      },
    ],
    reward: '🍎 시장 쇼핑 완주! 「C\'est combien?」와 숫자 1~10, 이제 유럽 어디 시장이든 충분해요.',
  },

  // ── 편의점 점원 (ot-07-konbini) — 계산대. 만능 대답 두 마디로 첫 결제 ──
  konbini: {
    label: '편의점 점원',
    emoji: '🏪',
    intro: '24시 편의점 계산대. 점원 질문은 정해져 있어 — 대답은 딱 두 개!',
    steps: [
      { t: 'narr', text: '자동문이 스르륵 — 사방에서 いらっしゃいませ!가 쏟아진다. 대답 대신 가벼운 목례. 계산대 옆 온장고엔 김 오르는 肉まん(니쿠만·이미 쪄서 보온 판매), 나는 도시락(おべんとう)을 계산대에 올린다.' },
      {
        t: 'say', who: 'npc',
        ja: 'いらっしゃいませ。おべんとう、あたためますか。',
        yomi: 'いらっしゃいませ。おべんとう、あたためますか (이랏샤이마세. 오벤토-, 아타타메마스카)',
        ko: '어서 오세요. 도시락, 데워 드릴까요?',
        narr: '끝이 「…마스카?」로 올라가면 뭔가 물은 것. 데워달라면?',
      },
      {
        t: 'ask', mode: 'choice',
        prompt: '따끈하게 데워 먹고 싶어요. 맞는 대답은?',
        choices: [
          { ja: 'おねがいします。', yomi: 'おねがいします (오네가이시마스)', correct: true },
          { ja: 'だいじょうぶです。', yomi: 'だいじょうぶです (다이죠-부데스)' },
          { ja: 'さようなら。', yomi: 'さようなら (사요-나라)' },
        ],
        why: '받고 싶을 땐 お願いします(네)! 大丈夫です는 "됐어요(사양)"이라 데움도 거절돼요.',
      },
      {
        t: 'say', who: 'npc',
        ja: 'ふくろは ごりようですか。',
        yomi: 'ふくろは ごりようですか (후쿠로와 고리요-데스카)',
        ko: '봉투 필요하세요?',
        narr: '가방이 있으니 봉투는 됐어. 사양하는 만능 한마디는?',
      },
      {
        t: 'ask', mode: 'type',
        prompt: '봉투는 필요 없어요. 정중히 사양해요. 「ふくろは、___。」',
        before: 'ふくろは、', after: '。',
        answer: '大丈夫です', accept: ['大丈夫です', 'だいじょうぶです', 'だいじょうぶ'],
        hint: '다이죠-부데스 — "됐어요(사양)". "좋다"가 아니에요!',
        why: '大丈夫です=됐어요(사양). 계산대의 大丈夫です는 거의 항상 거절이에요. 반대로 받고 싶을 땐 お願いします! (히라가나 だいじょうぶです도 정답)',
      },
      {
        t: 'say', who: 'npc',
        ja: 'カードは こちらへ どうぞ。ありがとうございました。',
        yomi: 'カードは こちらへ どうぞ。ありがとうございました (카-도와 코치라에 도-조. 아리가토-고자이마시타)',
        ko: '카드는 이쪽에 대 주세요. 감사합니다.',
        narr: '세미셀프 화면을 가리킨다. 삑 — 교실 밖 첫 일본어 결제 완료.',
      },
      {
        t: 'say', who: 'me',
        ja: 'どうも。',
        yomi: 'どうも (도-모)',
        ko: '감사합니다(가볍게).',
      },
    ],
    reward: '🏪 편의점 완주! お願いします(네)・大丈夫です(됐어요), 이 두 마디면 어떤 계산대도 OK.',
  },

  // ── 이자카야 점원 (ot-08-izakaya) — お通し의 정체 + 국민 첫 주문 とりあえず生で ──
  izakaya: {
    label: '이자카야 점원',
    emoji: '🏮',
    intro: '드르륵 미닫이문. 안 시킨 접시(お通し)의 정체와 첫 주문 한마디.',
    steps: [
      { t: 'narr', text: '드르륵 — 미닫이문을 열자 いらっしゃいませ!가 쏟아진다. 목례로 받고 카운터석에 앉는다.' },
      {
        t: 'say', who: 'npc',
        ja: 'いらっしゃいませ！なんめいさまですか。',
        yomi: 'いらっしゃいませ！なんめいさまですか (이랏샤이마세! 난메-사마데스카)',
        ko: '어서 오세요! 몇 분이세요?',
        narr: '혼자 왔으면 손가락 하나. 「ひとりです」.',
      },
      {
        t: 'say', who: 'me',
        ja: 'ひとりです。',
        yomi: 'ひとりです (히토리데스)',
        ko: '한 명이요.',
      },
      { t: 'narr', text: '앉자마자, 주문도 안 했는데 삶은 풋콩 접시가 툭 — "어? 이거 안 시켰는데?"' },
      {
        t: 'say', who: 'npc',
        ja: 'それは お通しです。',
        yomi: 'それは おとおしです (소레와 오토-시데스)',
        ko: '그건 오토시(기본 안주)예요.',
        narr: 'お通し=많은 이자카야에서 주문 전에 나오는 기본 안주 — 가게에 따라 유료(보통 1인 300~500엔)로 자릿세 성격이에요.',
      },
      {
        t: 'ask', mode: 'choice',
        prompt: '점원이 첫 주문을 기다려요. 많은 사람이 첫 잔으로 곧잘 외치는 정번 주문은?',
        choices: [
          { ja: 'とりあえず生で。', yomi: 'とりあえずなまで (토리아에즈 나마데)', correct: true },
          { ja: 'おあいそ おねがいします。', yomi: 'おあいそ おねがいします (오아이소 오네가이시마스)' },
          { ja: 'ごちそうさまでした。', yomi: 'ごちそうさまでした (고치소-사마데시타)' },
        ],
        why: 'とりあえず生で=일단 생맥으로. 生는 生ビール(생맥주)의 준말이고, 끝의 で는 「生ビールで おねがいします」의 줄임 — 주문할 것을 고르는 「Nで(선택·요청)」예요(수단의 で 아님). 술이 부담이면 ウーロン茶ください로 바꿔도 흐름은 똑같아요.',
      },
      {
        t: 'ask', mode: 'type',
        prompt: '점원이 멀리 있어요. 손 들고 불러요! 「___！」 (이자카야에선 큰 소리로 불러도 무례하지 않은 편이에요.)',
        before: '', after: '！',
        answer: 'すみません', accept: ['すみません', 'すいません'],
        hint: '스미마셍 — "여기요/저기요"로 점원 부르기.',
        why: 'すみません!=여기요! 한국에선 조심스럽지만 일본 이자카야에선 크게 불러도 무례하지 않은 편이에요(가게 분위기에 따라).',
      },
      {
        t: 'say', who: 'npc',
        ja: 'はい！生 おまちどおさま。',
        yomi: 'はい！なま おまちどおさま (하이! 나마 오마치도-사마)',
        ko: '네! 생맥 나왔습니다.',
        narr: '차가운 생맥 한 잔. 이자카야의 밤이 시작된다.',
      },
    ],
    reward: '🏮 이자카야 완주! お通し의 정체도 알고, とりあえず生で・すみません!까지 — 첫 방문도 당황 없어요.',
  },

  // ── 역무원 (ot-11-densha) — 도쿄 야마노테선 플랫폼. 〜行き 확인·まもなく 청해·뛰어들기 방송·IC카드 ──
  //   대사·문항 전부 챕터 기존 표현. 「駆け込み乗車…」 방송문·優先席·マナーモード 사실관계는 챕터에서 검증 완료.
  ekiin: {
    label: '역무원',
    emoji: '🚉',
    intro: '야마노테선 플랫폼. 방송은 まもなく와 〜行き 두 개만 잡으면 돼요!',
    steps: [
      { t: 'narr', text: '플랫폼 전광판에 행선지가 줄줄이. 제복 차림의 역무원이 손끝으로 안내 중이다.' },
      {
        t: 'ask', mode: 'choice',
        prompt: '이 전철이 시부야에 가는지 확신이 안 서요. 전광판을 가리키며 확인하는 한마디는?',
        choices: [
          { ja: 'すみません、渋谷行き？', yomi: 'すみません、しぶやゆき？ (스미마셍, 시부야유키?)', correct: true },
          { ja: 'ごちそうさまでした。', yomi: 'ごちそうさまでした (고치소-사마데시타)' },
          { ja: 'いらっしゃいませ。', yomi: 'いらっしゃいませ (이랏샤이마세)' },
        ],
        why: '행선지 꼬리표 〜行き(유키) 끝을 살짝 올리면 확인 질문이 돼요. 역 이름만 바꾸면 어느 노선에서든 통하고, すみません은 이자카야에서 점원을 부르던 그 "여기요"와 같은 만능 한마디예요.',
      },
      {
        t: 'say', who: 'npc',
        ja: 'はい、渋谷行きです。まもなく まいります。',
        yomi: 'はい、しぶやゆきです。まもなく まいります (하이, 시부야유키데스. 마모나쿠 마이리마스)',
        ko: '네, 시부야행이에요. 곧 옵니다.',
        narr: 'まもなく(곧)! 방송에서 이게 들리면 내릴 준비.',
      },
      {
        t: 'ask', mode: 'type',
        prompt: '차내 방송이 흘러요. 「___、渋谷。」 — "곧, 시부야". 빈칸은?',
        before: '', after: '、渋谷。',
        answer: 'まもなく', accept: ['まもなく'],
        hint: '마모나쿠 — 방송 청해의 열쇠 단어.',
        why: 'まもなく=곧. 방송을 100% 알아들을 필요 없이 まもなく와 〜行き 두 개만 잡아도 내릴 역도 행선지도 안 놓쳐요.',
      },
      { t: 'narr', text: '내린 순간, 옆 칸 문이 닫히려 한다. 뛰어들까?! 그때 방송 — 「かけこみじょうしゃは きけんですので おやめください」.' },
      {
        t: 'ask', mode: 'choice',
        prompt: '문이 닫히는 전철, 어떻게 할까요?',
        choices: [
          { text: '다음 전철을 기다린다 (몇 분이면 와요)', correct: true },
          { text: '몸을 밀어넣어 뛰어든다' },
          { text: '문을 손으로 잡는다' },
        ],
        why: '駆け込み乗車はおやめください — "무리하게 뛰어드는 승차는 삼가 주세요"는 일본 전철의 국민 방송문. 외우진 말고 뜻만 알면 충분해요.',
      },
      {
        t: 'say', who: 'npc',
        ja: 'ICカードは タッチで どうぞ。',
        yomi: 'アイシーカードは タッチで どうぞ (아이시-카-도와 탓치데 도-조)',
        ko: 'IC카드는 탭 한 번이면 돼요.',
        narr: 'Suica·PASMO 같은 IC카드 — 개찰도 편의점 결제도 탭 한 번. 優先席(우선석) 양보와 차내 통화 금지(マナーモード)도 잊지 말기!',
      },
      { t: 'say', who: 'me', ja: 'どうも。', yomi: 'どうも (도-모)', ko: '감사합니다(가볍게).' },
    ],
    reward: '🚉 역무원 완주! まもなく・〜行き 두 단어면 일본 전철 방송이 들리기 시작해요.',
  },

  // ── 면세 카운터 직원 (ot-12-menzei) — 긴자 상업가. 2026-11 신방식(매장 세금포함 결제→출국 시 환급)은
  //   챕터에서 검증된 사실. 챕터 스토리의 실제 점포(돈키호테)는 게임 노드로 재현하지 않는다(IP 정책) — 무브랜드 카운터.
  menzei: {
    label: '면세 카운터 직원',
    emoji: '🛍️',
    intro: '免税(멘제이)·TAX FREE 창구. 여권 들고 만능 한마디면 끝!',
    steps: [
      { t: 'narr', text: '과자와 화장품을 한 바구니. 계산대 옆 免税(めんぜい)·TAX FREE 간판의 창구로 향한다.' },
      {
        t: 'ask', mode: 'type',
        prompt: '카운터 앞. 편의점·라멘집에서 쓰던 만능 한마디로! 「めんぜい、___。」',
        before: 'めんぜい、', after: '。',
        answer: 'おねがいします', accept: ['おねがいします', 'お願いします'],
        hint: '오네가이시마스 — 부탁의 만능 표현, 세 번째 등장!',
        why: '면세든 리필이든 데움이든, 부탁은 전부 おねがいします 한마디. 편의점(ot-07)·라멘집(ot-10)에 이어 면세 카운터에서도 그대로예요.',
      },
      {
        t: 'say', who: 'npc',
        ja: 'パスポート、おねがいします。',
        yomi: 'パスポート、おねがいします (파스포-토, 오네가이시마스)',
        ko: '여권, 부탁드려요.',
        narr: '면세 절차는 여권으로 여행자임을 확인하는 데서 시작해요.',
      },
      {
        t: 'ask', mode: 'choice',
        prompt: '여권을 내밀며 하는 말은?',
        choices: [
          { ja: 'パスポート、これです。', yomi: 'パスポート、これです (파스포-토, 코레데스)', correct: true },
          { ja: 'ごちそうさまでした。', yomi: 'ごちそうさまでした (고치소-사마데시타)' },
          { ja: 'とりあえず生で。', yomi: 'とりあえずなまで (토리아에즈 나마데)' },
        ],
        why: 'これ(이거)+です만으로 충분! 길게 말할 필요 없어요.',
      },
      {
        t: 'say', who: 'npc',
        ja: 'はらいもどしは、しゅっこくの ときです。',
        yomi: 'はらいもどしは、しゅっこくの ときです (하라이모도시와, 슛코쿠노 토키데스)',
        ko: '환급은 출국하실 때예요.',
        narr: '2026년 11월부터의 새 방식 — 매장에선 세금 포함으로 결제하고, 출국할 때 반출 확인을 받으면 산 가게(또는 위탁 환급 사업자)가 세금분을 돌려줘요. 방법은 가게마다 달라요.',
      },
      {
        t: 'ask', mode: 'choice',
        prompt: '그럼 세금분은 언제 돌려받죠?',
        choices: [
          { text: '출국할 때 반출 확인을 받은 뒤', correct: true },
          { text: '매장에서 결제하는 즉시 (예전 방식)' },
          { text: '호텔 체크아웃할 때' },
        ],
        why: '2026년 11월부터: 매장 세금 포함 결제 → 출국 시 반출 확인 → 환급. 예전의 구분·상한·밀봉은 폐지 — 이 흐름만 기억하면 돼요.',
      },
      {
        t: 'say', who: 'npc',
        ja: 'ありがとうございました。',
        yomi: 'ありがとうございました (아리가토-고자이마시타)',
        ko: '감사합니다.',
      },
    ],
    reward: '🛍️ 면세 완주! 여권 + めんぜい、おねがいします — 쇼핑의 마지막 관문 통과.',
  },
};

export function getNpcScript(key) {
  return NPC_SCRIPTS[key] || null;
}
