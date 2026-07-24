const chapters = [
  {
    slug: "a1-21-scene-directions-transit",
    level: "A1",
    order: 21,
    title: "\"어디로 가야 해요?\" — 길과 교통을 한 번에 물어요",
    topic: "길 묻기·안내 확인·대중교통",
    titleFr: "Demander son chemin et prendre les transports",
    summary:
      "목적지 위치를 묻고, 들은 안내를 확인한 뒤 노선·환승·하차 지점까지 이어서 물어요.",
    duration: "약 15분",
    sections: [
      {
        heading: "목적지 찾기 — où se trouve로 위치를 물어요",
        pattern:
          "Excusez-moi, où se trouve + 장소 ? · Je cherche + 장소.",
        patternKo:
          "실례합니다, ~은 어디에 있나요? · 저는 ~을 찾고 있어요.",
        body:
          "처음 말을 걸 때는 **Excusez-moi**로 시작하면 부드러워요. **où se trouve + 장소**는 건물·정류장·입구처럼 한 곳의 위치를 물을 때 쓰는 장면 공식이에요.\n\n" +
          "발음 힌트: où se trouve는 [u sə tʁuv]로, '우 스 트후브'처럼 이어져요. 장소 이름을 아직 모르거나 지도를 보여줄 때는 **Je cherche...** 뒤에 목적지만 붙여도 돼요.",
        examples: [
          {
            fr: "Excusez-moi, où se trouve la gare routière ?",
            ipa: "[ɛkskyze mwa u sə tʁuv la ɡaʁ ʁutjɛʁ] 엑스퀴제 무아, 우 스 트후브 라 가흐 후티에흐?",
            ko: "실례합니다, 버스 터미널은 어디에 있나요?",
          },
          {
            fr: "Je cherche le centre culturel.",
            ipa: "[ʒə ʃɛʁʃ lə sɑ̃tʁ kyltyʁɛl] 즈 셰흐슈 르 상트흐 퀼튀헬",
            ko: "문화 센터를 찾고 있어요.",
          },
        ],
        tip:
          "장소가 여성명사인지 남성명사인지 헷갈리면 지도나 표지의 이름을 그대로 읽고, où se trouve 앞뒤 틀만 유지해도 질문이 통해요.",
      },
      {
        heading: "들은 말 확인하기 — 뜻과 핵심 구절을 되물어요",
        pattern:
          "Ça veut dire quoi ? · Vous avez dit « ... » ?",
        patternKo:
          "그게 무슨 뜻이에요? · 방금 '~'라고 하셨나요?",
        body:
          "**Ça veut dire quoi ?**는 모르는 단어나 표지의 뜻을 묻는 구어 공식이에요. 길 안내에서 한 부분만 놓쳤다면 **Vous avez dit... ?** 뒤에 들은 말을 넣어 확인해요.\n\n" +
          "발음 힌트: Ça veut dire quoi ?는 [sa vø diʁ kwa] '사 브 디흐 쿠아?', Vous avez dit는 [vuzave di] '부자베 디'로 들려요. 전부 다시 말해 달라고 하기보다 놓친 구절만 되묻는 데 유용해요.",
        examples: [
          {
            fr: "« Correspondance », ça veut dire quoi ?",
            ipa: "[kɔʁɛspɔ̃dɑ̃s sa vø diʁ kwa] 꼬헤스뽕당스, 사 브 디흐 쿠아?",
            ko: "'환승'이 무슨 뜻이에요?",
          },
          {
            fr: "Vous avez dit « après le pont » ?",
            ipa: "[vuzave di apʁɛ lə pɔ̃] 부자베 디 '아프헤 르 뽕'?",
            ko: "'다리를 지난 뒤'라고 하셨나요?",
          },
        ],
        tip:
          "못 들은 전체 문장을 추측하지 않아도 돼요. 들린 단어만 인용하듯 올려 말하고 Vous avez dit... ?를 붙이면 상대가 그 부분을 다시 확인해 줘요.",
      },
      {
        heading: "안내 알아듣기 — 직진·회전·횡단 세 동작",
        pattern:
          "Allez tout droit. · Tournez à gauche/droite. · Traversez + 장소.",
        patternKo:
          "곧장 가세요. · 왼쪽/오른쪽으로 도세요. · ~을 건너세요.",
        body:
          "길 안내의 핵심 동작은 **aller tout droit**(직진하다), **tourner**(돌다), **traverser**(건너다)예요. 안내에서는 주어 vous가 빠지고 동사가 앞에 나오는 형태로 자주 들려요.\n\n" +
          "발음 힌트: tout droit [tu dʁwa]는 '투 드후아', à gauche [a ɡoʃ]는 '아 고슈', à droite [a dʁwat]는 '아 드후아트'에 가까워요. gauche와 droite의 첫소리를 구별해 두세요.",
        examples: [
          {
            fr: "Allez tout droit, puis tournez à droite.",
            ipa: "[ale tu dʁwa pɥi tuʁne a dʁwat] 알레 투 드후아, 퓌 투흐네 아 드후아트",
            ko: "곧장 가신 다음 오른쪽으로 도세요.",
          },
          {
            fr: "Traversez la place ; l'entrée est à gauche.",
            ipa: "[tʁavɛʁse la plas lɑ̃tʁe ɛ a ɡoʃ] 트하베흐세 라 플라스, 랑트헤 에 아 고슈",
            ko: "광장을 건너세요. 입구는 왼쪽에 있어요.",
          },
        ],
        pitfall:
          "à gauche는 왼쪽, à droite는 오른쪽이에요. 안내를 들으며 손으로 방향을 함께 가리키면 비슷하게 들리는 순간에도 실수를 줄일 수 있어요.",
      },
      {
        heading: "노선 고르기 — quelle ligne으로 탈 노선을 물어요",
        pattern:
          "Je prends quelle ligne pour aller à + 장소 ?",
        patternKo:
          "~에 가려면 몇 호선/어느 노선을 타야 하나요?",
        body:
          "**prendre une ligne**은 지하철·버스 등의 노선을 타다라는 뜻이에요. 회화에서는 **Je prends quelle ligne...?**처럼 quelle ligne을 문장 뒤쪽에 두면 자연스럽고 바로 써먹기 쉬워요.\n\n" +
          "발음 힌트: Je prends quelle ligne ?는 [ʒə pʁɑ̃ kɛl liɲ] '즈 프항 켈 리뉴?'처럼 들려요. pour aller à 뒤에 목적지를 붙이면 질문이 완성돼요.",
        examples: [
          {
            fr: "Je prends quelle ligne pour aller au musée ?",
            ipa: "[ʒə pʁɑ̃ kɛl liɲ puʁ ale o myze] 즈 프항 켈 리뉴 푸흐 알레 오 뮈제?",
            ko: "박물관에 가려면 어느 노선을 타야 하나요?",
          },
          {
            fr: "Prenez la ligne deux, direction le centre.",
            ipa: "[pʁəne la liɲ dø diʁɛksjɔ̃ lə sɑ̃tʁ] 프흐네 라 리뉴 되, 디헥시옹 르 상트흐",
            ko: "도심 방향 2호선을 타세요.",
          },
        ],
        tip:
          "노선 번호를 놓치면 La ligne combien ?(몇 호선이요?)만 짧게 되물어도 돼요. 숫자와 direction 뒤 목적지만 잡아도 다음 행동을 정할 수 있어요.",
      },
      {
        heading: "환승과 하차 — 내릴 곳과 갈아탈 곳을 따로 물어요",
        pattern:
          "Je descends à quel arrêt ? · Je change à quelle station ?",
        patternKo:
          "어느 정류장에서 내려요? · 어느 역에서 갈아타요?",
        body:
          "버스·트램의 정류장은 **arrêt**, 철도·지하철역은 보통 **station**이라고 해요. **descendre à**로 내릴 곳을, **changer à**로 갈아탈 곳을 물어요.\n\n" +
          "발음 힌트: Je descends [ʒə desɑ̃]은 끝의 ds를 읽지 않고 '즈 데상', Je change [ʒə ʃɑ̃ʒ]는 '즈 샹주'에 가까워요.",
        examples: [
          {
            fr: "Je descends à quel arrêt ?",
            ipa: "[ʒə desɑ̃ a kɛl aʁɛ] 즈 데상 아 켈 아헤?",
            ko: "어느 정류장에서 내려요?",
          },
          {
            fr: "Je change à quelle station ?",
            ipa: "[ʒə ʃɑ̃ʒ a kɛl stasjɔ̃] 즈 샹주 아 켈 스타시옹?",
            ko: "어느 역에서 갈아타요?",
          },
        ],
        tip:
          "환승이 필요 없다는 답은 C'est direct.(직행이에요), 필요하다는 답은 Vous changez à...(…에서 갈아타세요)로 자주 들려요.",
      },
      {
        heading: "대화 예시 — 길 위에서 두 번 묻기",
        body:
          "앞의 다섯 문형을 실제 응답과 함께 읽어 봐요. 화자 이름 대신 역할만 표시해 어느 여행지에서도 재사용할 수 있게 했어요.",
        examples: [
          {
            fr:
              "여행자 : Excusez-moi, où se trouve le jardin public ?\n" +
              "행인 : Allez tout droit, puis tournez à gauche.\n" +
              "여행자 : Vous avez dit « à gauche » ?\n" +
              "행인 : Oui, après la place.",
            ipa:
              "[ɛkskyze mwa u sə tʁuv lə ʒaʁdɛ̃ pyblik]\n" +
              "[ale tu dʁwa pɥi tuʁne a ɡoʃ]\n" +
              "[vuzave di a ɡoʃ]\n" +
              "[wi apʁɛ la plas]",
            ko:
              "여행자: 실례합니다, 공원은 어디에 있나요?\n" +
              "행인: 곧장 가신 다음 왼쪽으로 도세요.\n" +
              "여행자: '왼쪽'이라고 하셨나요?\n" +
              "행인: 네, 광장을 지난 뒤예요.",
          },
          {
            fr:
              "여행자 : Je prends quelle ligne pour aller au marché ?\n" +
              "안내 직원 : Prenez la ligne un.\n" +
              "여행자 : Je descends à quel arrêt ?\n" +
              "안내 직원 : Au troisième arrêt. C'est direct.",
            ipa:
              "[ʒə pʁɑ̃ kɛl liɲ puʁ ale o maʁʃe]\n" +
              "[pʁəne la liɲ œ̃]\n" +
              "[ʒə desɑ̃ a kɛl aʁɛ]\n" +
              "[o tʁwazjɛm aʁɛ sɛ diʁɛkt]",
            ko:
              "여행자: 시장에 가려면 어느 노선을 타야 하나요?\n" +
              "안내 직원: 1호선을 타세요.\n" +
              "여행자: 어느 정류장에서 내려요?\n" +
              "안내 직원: 세 번째 정류장이에요. 직행이에요.",
          },
        ],
      },
      {
        heading: "이야기 — 표지 하나를 놓친 여행자",
        story: {
          body: [
            {
              narr:
                "여행자가 버스 터미널로 가는 길을 찾고 있어요. 지도에는 현재 위치만 보이고 목적지 표지는 보이지 않아요.",
            },
            {
              speaker: "여행자",
              fr: "Excusez-moi, où se trouve la gare routière ?",
              ipa: "[ɛkskyze mwa u sə tʁuv la ɡaʁ ʁutjɛʁ]",
              ko: "실례합니다, 버스 터미널은 어디에 있나요?",
            },
            {
              speaker: "행인",
              fr: "Allez tout droit, traversez la place, puis tournez à gauche.",
              ipa: "[ale tu dʁwa tʁavɛʁse la plas pɥi tuʁne a ɡoʃ]",
              ko: "곧장 가서 광장을 건넌 다음 왼쪽으로 도세요.",
            },
            {
              speaker: "여행자",
              fr: "Vous avez dit « à gauche » ?",
              ipa: "[vuzave di a ɡoʃ]",
              ko: "'왼쪽'이라고 하셨나요?",
            },
            {
              speaker: "행인",
              fr: "Oui. Ensuite, prenez la ligne trois.",
              ipa: "[wi ɑ̃sɥit pʁəne la liɲ tʁwa]",
              ko: "네. 그런 다음 3호선을 타세요.",
            },
            {
              speaker: "여행자",
              fr: "Je descends à quel arrêt ?",
              ipa: "[ʒə desɑ̃ a kɛl aʁɛ]",
              ko: "어느 정류장에서 내려요?",
            },
            {
              speaker: "행인",
              fr: "Au deuxième arrêt. La gare est en face.",
              ipa: "[o døzjɛm aʁɛ la ɡaʁ ɛ ɑ̃ fas]",
              ko: "두 번째 정류장이에요. 터미널이 맞은편에 있어요.",
            },
            {
              narr:
                "여행자는 왼쪽 방향과 하차 순서를 다시 확인한 뒤 이동해요. 긴 안내를 전부 외우지 않고 다음 행동 하나씩만 잡아요.",
            },
          ],
          questions: [
            {
              id: "fr-a1-directions-transit-scene-sq1",
              type: "order",
              pattern: "Excusez-moi, où se trouve + 장소 ?",
              q: "버스 터미널의 위치를 정중히 물으려고 해요. '실례합니다, 버스 터미널은 어디에 있나요?'가 되도록 타일을 놓아 보세요.",
              tiles: [
                "Excusez-moi,",
                "où",
                "se trouve",
                "la gare routière",
                "?",
              ],
              answer: [
                "Excusez-moi,",
                "où",
                "se trouve",
                "la gare routière",
                "?",
              ],
              ko: "실례합니다, 버스 터미널은 어디에 있나요?",
              why:
                "정중한 말걸기 Excusez-moi 뒤에 où se trouve와 찾는 장소를 차례로 놓아요.",
            },
            {
              id: "fr-a1-directions-transit-scene-sq2",
              type: "fill",
              pattern: "Tournez à gauche.",
              q: "행인이 광장을 건넌 다음 왼쪽으로 돌라고 안내해요. 방향 말을 채워 보세요.",
              fr: "Traversez la place, puis tournez à ［　］.",
              answer: "gauche",
              accept: [],
              why:
                "왼쪽은 à gauche, 오른쪽은 à droite예요. 여기서는 이야기 속 왼쪽 안내를 완성해요.",
            },
            {
              id: "fr-a1-directions-transit-scene-sq3",
              type: "produce",
              prompt:
                "낯선 정류장에서 목적지로 갈 노선이나 내릴 곳을 묻는 상황이에요. 이번 장면의 문형 하나를 골라 프랑스어 질문 한 문장을 만들어 보세요.",
              model: [
                "Je prends quelle ligne pour aller au musée ?",
                "Je descends à quel arrêt ?",
                "Je change à quelle station ?",
              ],
              guide:
                "노선은 quelle ligne, 정류장은 quel arrêt, 역은 quelle station과 짝이 맞는지 확인해요.",
            },
          ],
        },
      },
    ],
  },

  {
    slug: "a1-22-scene-health-lost-property",
    level: "A1",
    order: 22,
    title: "\"아프고 잃어버렸어요\" — 필요한 도움을 또렷하게 말해요",
    topic: "통증·증상·도움 요청·분실 신고",
    titleFr: "Signaler un problème de santé ou un objet perdu",
    summary:
      "아픈 부위와 증상을 말하고 도움을 요청한 뒤, 잃어버린 물건과 특징을 차분히 설명해요.",
    duration: "약 15분",
    sections: [
      {
        heading: "아픈 부위 말하기 — avoir mal à를 한 덩어리로 써요",
        pattern:
          "J'ai mal à la/au/aux + 신체 부위.",
        patternKo:
          "~이/가 아파요.",
        body:
          "프랑스어는 통증을 **avoir mal à + 신체 부위**로 말해요. 여성명사 앞에는 à la, 남성명사 앞에는 au, 복수명사 앞에는 aux를 써요.\n\n" +
          "발음 힌트: J'ai mal은 [ʒe mal] '제 말', au dos는 [o do] '오 도', aux jambes는 [o ʒɑ̃b] '오 장브'처럼 이어져요.",
        examples: [
          {
            fr: "J'ai mal à la tête.",
            ipa: "[ʒe mal a la tɛt] 제 말 아 라 테트",
            ko: "머리가 아파요.",
          },
          {
            fr: "J'ai mal au dos.",
            ipa: "[ʒe mal o do] 제 말 오 도",
            ko: "허리가 아파요.",
          },
        ],
        pitfall:
          "신체 부위 앞에는 소유형용사보다 정관사를 쓰는 것이 기본이에요. J'ai mal à ma tête가 아니라 J'ai mal à la tête라고 해요.",
      },
      {
        heading: "증상 말하기 — j'ai와 je me sens로 상태를 나눠요",
        pattern:
          "J'ai + 증상 명사. · Je me sens + 상태 형용사.",
        patternKo:
          "~ 증상이 있어요. · 몸이 ~하게 느껴져요.",
        body:
          "열·어지럼증처럼 이름이 있는 증상은 **J'ai + 명사**, 몸이 약하다·메스껍다처럼 느끼는 상태는 **Je me sens + 형용사**로 말해요.\n\n" +
          "발음 힌트: J'ai de la fièvre는 [ʒe də la fjɛvʁ] '제 드 라 피에브흐', Je me sens faible은 [ʒə mə sɑ̃ fɛbl] '즈 므 상 페블'에 가까워요.",
        examples: [
          {
            fr: "J'ai de la fièvre.",
            ipa: "[ʒe də la fjɛvʁ] 제 드 라 피에브흐",
            ko: "열이 나요.",
          },
          {
            fr: "Je me sens faible.",
            ipa: "[ʒə mə sɑ̃ fɛbl] 즈 므 상 페블",
            ko: "몸에 힘이 없어요.",
          },
        ],
        tip:
          "정확한 병명을 추측하기보다 지금 느끼는 증상과 아픈 부위를 짧게 나눠 말하면 도움을 요청하기 쉬워요.",
      },
      {
        heading: "도움 요청하기 — besoin으로 필요한 대상을 바로 말해요",
        pattern:
          "J'ai besoin d'aide/d'un médecin. · C'est urgent.",
        patternKo:
          "도움/의사가 필요해요. · 긴급해요.",
        body:
          "**J'ai besoin de...**는 지금 필요한 도움이나 사람을 바로 말하는 공식이에요. de 뒤가 모음으로 시작하면 d'aide처럼 줄고, un médecin 앞에서는 de + un이 d'un이 돼요.\n\n" +
          "발음 힌트: J'ai besoin d'aide는 [ʒe bəzwɛ̃ dɛd] '제 브주앵 데드', C'est urgent는 [sɛ tyʁʒɑ̃] '세 튀흐장'처럼 들려요.",
        examples: [
          {
            fr: "J'ai besoin d'un médecin.",
            ipa: "[ʒe bəzwɛ̃ dœ̃ medsɛ̃] 제 브주앵 댕 메드생",
            ko: "의사가 필요해요.",
          },
          {
            fr: "C'est urgent. J'ai besoin d'aide.",
            ipa: "[sɛ tyʁʒɑ̃ ʒe bəzwɛ̃ dɛd] 세 튀흐장. 제 브주앵 데드",
            ko: "긴급해요. 도움이 필요해요.",
          },
        ],
        tip:
          "긴 문장을 만들기 어려우면 C'est urgent와 J'ai besoin d'aide를 각각 끊어 말해도 돼요. 주변 사람이 상황의 우선순위를 바로 파악할 수 있어요.",
      },
      {
        heading: "분실 사실 말하기 — perdu와 disparu를 구별해요",
        pattern:
          "J'ai perdu + 물건. · Mon/Ma + 물건 + a disparu.",
        patternKo:
          "~을 잃어버렸어요. · 제 ~이/가 없어졌어요.",
        body:
          "무엇을 잃어버렸는지 알면 **J'ai perdu + 물건**, 사라진 사실을 강조하려면 **물건 + a disparu**라고 해요. perdu는 물건의 성에 맞춰 바꾸지 않고 이 문형 그대로 써요.\n\n" +
          "발음 힌트: J'ai perdu는 [ʒe pɛʁdy] '제 페흐뒤', a disparu는 [a dispaʁy] '아 디스파휘'에 가까워요.",
        examples: [
          {
            fr: "J'ai perdu mon sac.",
            ipa: "[ʒe pɛʁdy mɔ̃ sak] 제 페흐뒤 몽 삭",
            ko: "가방을 잃어버렸어요.",
          },
          {
            fr: "Ma pochette a disparu.",
            ipa: "[ma pɔʃɛt a dispaʁy] 마 포셰트 아 디스파휘",
            ko: "제 작은 가방이 없어졌어요.",
          },
        ],
        tip:
          "분실과 절도를 확실히 구분할 정보가 없다면 먼저 perdu 또는 disparu로 사실만 말해요. 추측 대신 마지막으로 본 장소와 물건 특징을 이어서 설명하면 돼요.",
      },
      {
        heading: "분실 신고 이어가기 — perte와 description으로 정보를 보태요",
        pattern:
          "Je souhaite signaler la perte de + 물건. · Voici sa description : ...",
        patternKo:
          "~ 분실을 신고하려고 해요. · 물건의 특징은 이래요: ...",
        body:
          "안내소나 분실물 창구에서는 **signaler la perte de...**로 신고 목적을 말해요. 이어서 **Voici sa description** 뒤에 크기·색·재질 같은 눈에 보이는 특징을 붙여요.\n\n" +
          "발음 힌트: Je souhaite signaler는 [ʒə swɛt siɲale] '즈 스웨트 시냐레', Voici sa description은 [vwasi sa dɛskʁipsjɔ̃] '부아시 사 데스크힙시옹'처럼 들려요.",
        examples: [
          {
            fr: "Je souhaite signaler la perte de mon portefeuille.",
            ipa: "[ʒə swɛt siɲale la pɛʁt də mɔ̃ pɔʁtəfœj] 즈 스웨트 시냐레 라 페흐트 드 몽 포흐트푀유",
            ko: "지갑 분실을 신고하려고 해요.",
          },
          {
            fr: "Voici sa description : il est petit et noir.",
            ipa: "[vwasi sa dɛskʁipsjɔ̃ il ɛ pəti e nwaʁ] 부아시 사 데스크힙시옹. 일 에 프티 에 누아흐",
            ko: "특징은 이래요. 작고 검은색이에요.",
          },
        ],
        tip:
          "색과 크기 외에도 마지막으로 본 장소를 함께 적어 두면 신고가 쉬워요. 개인 식별 정보는 공개된 장소에서 큰소리로 말하지 않아요.",
      },
      {
        heading: "대화 예시 — 몸 상태와 잃어버린 물건 설명하기",
        body:
          "긴급도를 과장하지 않고, 확인된 증상과 물건 정보부터 차례로 말하는 두 대화를 읽어 봐요.",
        examples: [
          {
            fr:
              "여행자 : J'ai mal à la tête et j'ai de la fièvre.\n" +
              "보건 안내 직원 : Vous vous sentez faible ?\n" +
              "여행자 : Oui. J'ai besoin d'un médecin.\n" +
              "보건 안내 직원 : D'accord. Asseyez-vous ici.",
            ipa:
              "[ʒe mal a la tɛt e ʒe də la fjɛvʁ]\n" +
              "[vu vu sɑ̃te fɛbl]\n" +
              "[wi ʒe bəzwɛ̃ dœ̃ medsɛ̃]\n" +
              "[dakɔʁ aseje vu isi]",
            ko:
              "여행자: 머리가 아프고 열이 나요.\n" +
              "보건 안내 직원: 몸에 힘이 없나요?\n" +
              "여행자: 네. 의사가 필요해요.\n" +
              "보건 안내 직원: 알겠습니다. 여기에 앉으세요.",
          },
          {
            fr:
              "여행자 : Je souhaite signaler la perte de mon portefeuille.\n" +
              "분실물 직원 : Quelle est sa description ?\n" +
              "여행자 : Il est petit et noir.\n" +
              "분실물 직원 : Où l'avez-vous vu pour la dernière fois ?",
            ipa:
              "[ʒə swɛt siɲale la pɛʁt də mɔ̃ pɔʁtəfœj]\n" +
              "[kɛl ɛ sa dɛskʁipsjɔ̃]\n" +
              "[il ɛ pəti e nwaʁ]\n" +
              "[u lave vu puʁ la dɛʁnjɛʁ fwa]",
            ko:
              "여행자: 지갑 분실을 신고하려고 해요.\n" +
              "분실물 직원: 특징이 어떻게 되나요?\n" +
              "여행자: 작고 검은색이에요.\n" +
              "분실물 직원: 마지막으로 어디에서 보셨나요?",
          },
        ],
      },
      {
        heading: "이야기 — 필요한 정보부터 한 문장씩",
        story: {
          body: [
            {
              narr:
                "이동 중이던 여행자가 갑자기 몸에 힘이 빠지는 것을 느껴 보건 안내 창구로 가요. 병명을 추측하지 않고 지금 느끼는 증상부터 말해요.",
            },
            {
              speaker: "여행자",
              fr: "J'ai mal à la tête. J'ai de la fièvre.",
              ipa: "[ʒe mal a la tɛt ʒe də la fjɛvʁ]",
              ko: "머리가 아파요. 열이 나요.",
            },
            {
              speaker: "보건 안내 직원",
              fr: "Vous vous sentez faible ?",
              ipa: "[vu vu sɑ̃te fɛbl]",
              ko: "몸에 힘이 없나요?",
            },
            {
              speaker: "여행자",
              fr: "Oui. J'ai besoin d'un médecin.",
              ipa: "[wi ʒe bəzwɛ̃ dœ̃ medsɛ̃]",
              ko: "네. 의사가 필요해요.",
            },
            {
              narr:
                "도움을 받은 뒤 여행자는 가방에서 신분증을 꺼내려다가 작은 지갑이 없어진 것을 알아차려요. 가까운 분실물 창구에서 확인된 사실과 특징을 말해요.",
            },
            {
              speaker: "여행자",
              fr: "J'ai perdu mon portefeuille.",
              ipa: "[ʒe pɛʁdy mɔ̃ pɔʁtəfœj]",
              ko: "지갑을 잃어버렸어요.",
            },
            {
              speaker: "분실물 직원",
              fr: "Quelle est sa description ?",
              ipa: "[kɛl ɛ sa dɛskʁipsjɔ̃]",
              ko: "특징이 어떻게 되나요?",
            },
            {
              speaker: "여행자",
              fr: "Il est petit et noir.",
              ipa: "[il ɛ pəti e nwaʁ]",
              ko: "작고 검은색이에요.",
            },
            {
              narr:
                "여행자는 증상과 분실을 섞지 않고 각각 짧은 문장으로 전달해요. 확인된 정보부터 말하니 직원도 필요한 다음 질문을 이어 가요.",
            },
          ],
          questions: [
            {
              id: "fr-a1-health-lost-property-scene-sq1",
              type: "order",
              pattern: "J'ai mal au + 신체 부위.",
              q: "허리가 아프다는 사실을 먼저 말하려고 해요. '허리가 아파요'가 되도록 타일을 놓아 보세요.",
              tiles: ["J'ai", "mal", "au", "dos", "."],
              answer: ["J'ai", "mal", "au", "dos", "."],
              ko: "허리가 아파요.",
              why:
                "통증은 J'ai mal à 뒤에 부위를 붙여요. 남성명사 le dos 앞에서는 à + le가 au로 합쳐져요.",
            },
            {
              id: "fr-a1-health-lost-property-scene-sq2",
              type: "fill",
              pattern: "J'ai besoin d'aide.",
              q: "혼자 해결하기 어려운 상황이에요. '도움이 필요해요'가 되도록 빈칸을 채워 보세요.",
              fr: "J'ai besoin d'［　］.",
              answer: "aide",
              accept: [],
              why:
                "필요한 대상을 말하는 J'ai besoin de 뒤에 aide가 오면 모음 충돌을 피해 d'aide로 줄여요.",
            },
            {
              id: "fr-a1-health-lost-property-scene-sq3",
              type: "produce",
              prompt:
                "물건 하나를 잃어버려 분실물 창구에 왔어요. 잃어버린 물건이나 눈에 보이는 특징을 프랑스어 한두 문장으로 설명해 보세요.",
              model: [
                "J'ai perdu mon sac.",
                "Je souhaite signaler la perte de ma pochette. Elle est petite et bleue.",
              ],
              guide:
                "분실 사실은 J'ai perdu..., 신고 목적은 Je souhaite signaler..., 특징은 Il/Elle est...로 나눠 말해요.",
            },
          ],
        },
      },
    ],
  },
];

export default chapters;
