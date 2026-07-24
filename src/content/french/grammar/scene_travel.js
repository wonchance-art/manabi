/**
 * A1 여행 장면 — 공항·숙소·식당 실전 회화 (A1 레벨 6장: 23-28번)
 * 입국·표 구매·체크인·요청·식사 주문·결제까지 실제 장면 조합.
 */
const chapters = [
  {
    slug: "a1-23-scene-airport-entry-baggage",
    level: "A1",
    order: 23,
    title: "\"입국하러 왔어요\" — 질문에 짧고 분명하게 답해요",
    titleFr: "Répondre au contrôle d'entrée et retrouver ses bagages",
    topic: "입국 목적·체류 기간·주소·수하물·세관 신고",
    summary:
      "입국 절차에서 방문 목적과 체류 정보를 답하고, 수하물과 신고할 물품이 있는지 확인해요.",
    duration: "약 15분",
    sections: [
      {
        heading: "방문 목적 말하기 — je viens pour로 이유를 붙여요",
        pattern:
          "Je viens pour + 명사. · Je viens pour + 동사원형.",
        patternKo:
          "~을 위해 왔어요. · ~하러 왔어요.",
        body:
          "**Je viens pour...** 뒤에는 tourisme 같은 명사나 visiter처럼 동사원형을 붙여 방문 목적을 말해요. 입국 질문에는 확인된 목적만 짧게 답하면 돼요.",
        examples: [
          {
            fr: "Je viens pour le tourisme.",
            ipa: "[ʒə vjɛ̃ puʁ lə tuʁism] 즈 비앵 푸흐 르 투히슴",
            ko: "관광하러 왔어요.",
          },
          {
            fr: "Je viens pour visiter la région.",
            ipa: "[ʒə vjɛ̃ puʁ vizite la ʁeʒjɔ̃] 즈 비앵 푸흐 비지테 라 헤지옹",
            ko: "이 지역을 둘러보러 왔어요.",
          },
        ],
        tip:
          "목적을 길게 설명하기보다 tourisme, études, travail처럼 질문에 맞는 핵심어부터 말해요.",
      },
      {
        heading: "체류 기간 답하기 — rester와 pendant를 써요",
        pattern:
          "Je reste + 기간. · Je reste pendant + 기간.",
        patternKo:
          "~ 동안 머물러요.",
        body:
          "**rester**는 머무르다라는 뜻이에요. 숫자와 기간 단위를 바로 붙이거나 **pendant**를 넣어 체류 기간을 답해요.",
        examples: [
          {
            fr: "Je reste cinq jours.",
            ipa: "[ʒə ʁɛst sɛ̃k ʒuʁ] 즈 헤스트 생크 주흐",
            ko: "5일 동안 머물러요.",
          },
          {
            fr: "Je reste pendant deux semaines.",
            ipa: "[ʒə ʁɛst pɑ̃dɑ̃ dø səmɛn] 즈 헤스트 팡당 되 스멘",
            ko: "2주 동안 머물러요.",
          },
        ],
        pitfall:
          "숫자 뒤에는 jour나 semaine을 기간에 맞게 써요. 2 이상이면 deux jours, deux semaines처럼 복수형으로 말해요.",
      },
      {
        heading: "머무를 곳 말하기 — je loge와 chez를 구별해요",
        pattern:
          "Je loge dans + 숙소 유형. · Je loge chez + 관계.",
        patternKo:
          "~에 묵어요. · ~의 집에 묵어요.",
        body:
          "호텔·호스텔 같은 숙소 유형은 **dans**, 아는 사람의 집은 **chez** 뒤에 관계를 붙여 말해요. 주소를 요청받으면 예약 확인서의 정보를 보여 줘도 돼요.",
        examples: [
          {
            fr: "Je loge dans un hôtel près de la gare.",
            ipa: "[ʒə lɔʒ dɑ̃z œ̃n otɛl pʁɛ də la ɡaʁ] 즈 로주 당쟁 오텔 프헤 드 라 가흐",
            ko: "역 근처 호텔에 묵어요.",
          },
          {
            fr: "Je loge chez des amis.",
            ipa: "[ʒə lɔʒ ʃe dezami] 즈 로주 셰 데자미",
            ko: "친구들 집에 묵어요.",
          },
        ],
        tip:
          "숙소 이름을 말하기 어렵다면 예약 확인서의 주소를 가리키며 Voici l'adresse라고 덧붙여도 돼요.",
      },
      {
        heading: "수하물 찾기 — tapis와 bagage로 위치를 물어요",
        pattern:
          "Sur quel tapis arrivent les bagages du vol de + 출발지 ? · Mon bagage n'est pas arrivé.",
        patternKo:
          "~ 출발 항공편의 수하물은 몇 번 벨트로 나와요? · 제 수하물이 나오지 않았어요.",
        body:
          "수하물 벨트는 **tapis**라고 해요. 벨트 번호를 묻고, 짐이 끝까지 나오지 않았다면 **n'est pas arrivé**로 도착하지 않았다고 알려요.",
        examples: [
          {
            fr: "Sur quel tapis arrivent les bagages du vol de Lyon ?",
            ipa: "[syʁ kɛl tapi aʁiv le baɡaʒ dy vɔl də ljɔ̃] 쉬흐 켈 타피 아히브 레 바가주 뒤 볼 드 리옹",
            ko: "리옹에서 온 항공편 수하물은 몇 번 벨트로 나와요?",
          },
          {
            fr: "Mon bagage n'est pas arrivé.",
            ipa: "[mɔ̃ baɡaʒ nɛ paz aʁive] 몽 바가주 네 파자히베",
            ko: "제 수하물이 나오지 않았어요.",
          },
        ],
        tip:
          "짐이 보이지 않으면 수하물표를 준비하고 항공편 출발지만 말해요. 가방의 특징은 직원이 물을 때 이어서 설명해요.",
      },
      {
        heading: "세관 질문 답하기 — rien과 quelque chose로 나눠요",
        pattern:
          "Je n'ai rien à déclarer. · J'ai quelque chose à déclarer.",
        patternKo:
          "신고할 것이 없어요. · 신고할 것이 있어요.",
        body:
          "신고할 물품이 없으면 **rien**, 있으면 **quelque chose**를 써요. 신고 대상 여부가 확실하지 않으면 임의로 판단하지 말고 직원에게 물어요.",
        examples: [
          {
            fr: "Je n'ai rien à déclarer.",
            ipa: "[ʒə nɛ ʁjɛ̃n a deklaʁe] 즈 네 히앵 아 데클라헤",
            ko: "신고할 것이 없어요.",
          },
          {
            fr: "J'ai quelque chose à déclarer.",
            ipa: "[ʒe kɛlk ʃoz a deklaʁe] 제 켈크 쇼자 데클라헤",
            ko: "신고할 것이 있어요.",
          },
        ],
        tip:
          "규정을 잘 모르겠다면 Est-ce que je dois déclarer ceci ?라고 물으며 해당 물품을 보여 줘요.",
      },
      {
        heading: "대화 예시 — 입국 질문과 수하물 문제에 대응하기",
        body:
          "질문 하나에 정보 하나씩 답하는 입국 대화와, 수하물표를 준비해 문제를 알리는 대화를 읽어 봐요.",
        examples: [
          {
            fr:
              "입국 직원 : Quel est le motif de votre voyage ?\n" +
              "여행자 : Je viens pour le tourisme.\n" +
              "입국 직원 : Vous restez combien de temps ?\n" +
              "여행자 : Je reste cinq jours. Je loge dans un hôtel près de la gare.",
            ipa:
              "[kɛl ɛ lə mɔtif də vɔtʁ vwajaʒ]\n" +
              "[ʒə vjɛ̃ puʁ lə tuʁism]\n" +
              "[vu ʁɛste kɔ̃bjɛ̃ də tɑ̃]\n" +
              "[ʒə ʁɛst sɛ̃k ʒuʁ ʒə lɔʒ dɑ̃z œ̃n otɛl pʁɛ də la ɡaʁ]",
            ko:
              "입국 직원: 여행 목적이 무엇인가요?\n" +
              "여행자: 관광하러 왔어요.\n" +
              "입국 직원: 얼마나 머무르나요?\n" +
              "여행자: 5일 동안 머물러요. 역 근처 호텔에 묵어요.",
          },
          {
            fr:
              "여행자 : Excusez-moi, mon bagage n'est pas arrivé.\n" +
              "수하물 직원 : Vous avez votre reçu de bagage ?\n" +
              "여행자 : Oui, le voici.\n" +
              "수하물 직원 : Merci. Je vais vérifier.",
            ipa:
              "[ɛkskyze mwa mɔ̃ baɡaʒ nɛ paz aʁive]\n" +
              "[vuzave vɔtʁ ʁəsy də baɡaʒ]\n" +
              "[wi lə vwasi]\n" +
              "[mɛʁsi ʒə vɛ veʁifje]",
            ko:
              "여행자: 실례해요, 제 수하물이 나오지 않았어요.\n" +
              "수하물 직원: 수하물표가 있나요?\n" +
              "여행자: 네, 여기 있어요.\n" +
              "수하물 직원: 감사해요. 확인해 볼게요.",
          },
        ],
      },
      {
        heading: "이야기 — 질문 순서대로 정보를 꺼내요",
        story: {
          body: [
            {
              narr:
                "여행자가 입국 심사대에 도착해요. 여권과 예약 확인서를 준비하고 질문에 필요한 정보만 차례로 답해요.",
            },
            {
              speaker: "입국 직원",
              fr: "Quel est le motif de votre voyage ?",
              ko: "여행 목적이 무엇인가요?",
            },
            {
              speaker: "여행자",
              fr: "Je viens pour visiter la région.",
              ko: "이 지역을 둘러보러 왔어요.",
            },
            {
              speaker: "입국 직원",
              fr: "Vous restez combien de temps ?",
              ko: "얼마나 머무르나요?",
            },
            {
              speaker: "여행자",
              fr: "Je reste cinq jours. Je loge dans un hôtel près de la gare.",
              ko: "5일 동안 머물러요. 역 근처 호텔에 묵어요.",
            },
            {
              narr:
                "입국 절차를 마친 뒤 수하물 벨트로 갔지만 여행자의 가방이 나오지 않아요. 수하물표를 들고 안내 창구로 가요.",
            },
            {
              speaker: "여행자",
              fr: "Mon bagage n'est pas arrivé.",
              ko: "제 수하물이 나오지 않았어요.",
            },
            {
              speaker: "수하물 직원",
              fr: "Vous avez votre reçu de bagage ?",
              ko: "수하물표가 있나요?",
            },
            {
              speaker: "여행자",
              fr: "Oui, le voici.",
              ko: "네, 여기 있어요.",
            },
          ],
          questions: [
            {
              id: "fr-a1-airport-entry-baggage-sq1",
              type: "order",
              pattern: "Je reste + 기간.",
              q: "'5일 동안 머물러요'가 되도록 타일을 놓아 보세요.",
              tiles: ["Je", "reste", "cinq", "jours", "."],
              answer: ["Je", "reste", "cinq", "jours", "."],
              ko: "5일 동안 머물러요.",
              why:
                "머무르다는 rester를 쓰고, je에 맞춘 reste 뒤에 기간을 붙여요.",
            },
            {
              id: "fr-a1-airport-entry-baggage-sq2",
              type: "fill",
              pattern: "Mon bagage n'est pas arrivé.",
              q: "수하물이 나오지 않았어요. 빈칸을 채워 문장을 완성해 보세요.",
              fr: "Mon bagage n'est pas ［　］.",
              answer: "arrivé",
              accept: [],
              why:
                "도착하지 않았다는 n'est pas arrivé로 말해요.",
            },
            {
              id: "fr-a1-airport-entry-baggage-sq3",
              type: "produce",
              prompt:
                "입국 직원이 방문 목적과 체류 기간을 물어요. 이번 레슨의 문형으로 두 정보를 프랑스어로 답해 보세요.",
              model: [
                "Je viens pour le tourisme. Je reste cinq jours.",
                "Je viens pour visiter la région. Je reste pendant deux semaines.",
              ],
              guide:
                "목적은 Je viens pour..., 기간은 Je reste...로 문장을 나누면 또렷해요.",
            },
          ],
        },
      },
    ],
  },

  {
    slug: "a1-24-scene-airport-ticket-connection",
    level: "A1",
    order: 24,
    title: "\"표 한 장 주세요\" — 공항에서 목적지까지 이어 가요",
    titleFr: "Acheter un billet et réussir une correspondance",
    topic: "표 구입·편도와 왕복·출발 시각·승강장·환승",
    summary:
      "공항에서 목적지행 표를 사고 출발 시각과 승강장을 확인한 뒤, 환승편을 놓치지 않게 물어요.",
    duration: "약 15분",
    sections: [
      {
        heading: "표 요청하기 — je voudrais로 목적지를 붙여요",
        pattern:
          "Je voudrais un billet pour + 목적지, s'il vous plaît.",
        patternKo:
          "~행 표 한 장 주세요.",
        body:
          "**Je voudrais**는 창구에서 원하는 것을 정중하게 말하는 기본 틀이에요. **pour** 뒤에 목적지를 붙이고 마지막에 s'il vous plaît를 더해요.",
        examples: [
          {
            fr: "Je voudrais un billet pour le centre, s'il vous plaît.",
            ipa: "[ʒə vudʁɛ œ̃ bijɛ puʁ lə sɑ̃tʁ sil vu plɛ] 즈 부드헤 앵 비예 푸흐 르 상트흐, 실 부 플레",
            ko: "도심행 표 한 장 주세요.",
          },
          {
            fr: "Je voudrais un billet pour la gare centrale, s'il vous plaît.",
            ipa: "[ʒə vudʁɛ œ̃ bijɛ puʁ la ɡaʁ sɑ̃tʁal sil vu plɛ] 즈 부드헤 앵 비예 푸흐 라 가흐 상트할, 실 부 플레",
            ko: "중앙역행 표 한 장 주세요.",
          },
        ],
        tip:
          "목적지 이름이 어려우면 화면이나 지도를 가리키며 pour ici라고 말해도 돼요.",
      },
      {
        heading: "편도와 왕복 고르기 — aller simple과 aller-retour를 써요",
        pattern:
          "Un aller simple. · Un aller-retour pour + 날짜.",
        patternKo:
          "편도 한 장이요. · ~ 날짜로 왕복 한 장이요.",
        body:
          "편도는 **un aller simple**, 왕복은 **un aller-retour**예요. 왕복표라면 돌아오는 날짜를 **pour** 뒤에 붙여 확인해요.",
        examples: [
          {
            fr: "Un aller simple, s'il vous plaît.",
            ipa: "[œ̃n ale sɛ̃pl sil vu plɛ] 앵날레 생플, 실 부 플레",
            ko: "편도 한 장 주세요.",
          },
          {
            fr: "Un aller-retour pour vendredi, s'il vous plaît.",
            ipa: "[œ̃n ale ʁətuʁ puʁ vɑ̃dʁədi sil vu plɛ] 앵날레 흐투흐 푸흐 방드흐디, 실 부 플레",
            ko: "금요일 왕복 한 장 주세요.",
          },
        ],
        pitfall:
          "aller-retour에서 돌아오는 날짜가 맞는지 결제 전에 표 화면을 다시 확인해요.",
      },
      {
        heading: "출발 시각 묻기 — à quelle heure로 시간을 확인해요",
        pattern:
          "À quelle heure part + 교통수단 ?",
        patternKo:
          "~은 몇 시에 출발해요?",
        body:
          "**partir**는 출발하다라는 뜻이에요. **À quelle heure part...?** 뒤에 열차·버스·셔틀을 넣어 정확한 출발 시각을 물어요.",
        examples: [
          {
            fr: "À quelle heure part le prochain train ?",
            ipa: "[a kɛl œʁ paʁ lə pʁɔʃɛ̃ tʁɛ̃] 아 켈 외흐 파흐 르 프호생 트행",
            ko: "다음 열차는 몇 시에 출발해요?",
          },
          {
            fr: "À quelle heure part la navette pour le centre ?",
            ipa: "[a kɛl œʁ paʁ la navɛt puʁ lə sɑ̃tʁ] 아 켈 외흐 파흐 라 나베트 푸흐 르 상트흐",
            ko: "도심행 셔틀은 몇 시에 출발해요?",
          },
        ],
        tip:
          "시간을 들은 뒤 Vous avez dit dix-huit heures ?처럼 숫자만 다시 확인하면 착오를 줄일 수 있어요.",
      },
      {
        heading: "타는 곳 찾기 — de quel quai와 d'où를 써요",
        pattern:
          "De quel quai part + 교통수단 ? · D'où part + 교통수단 ?",
        patternKo:
          "~은 몇 번 승강장에서 출발해요? · ~은 어디에서 출발해요?",
        body:
          "열차 승강장 번호는 **quai**로 묻고, 셔틀 정류장처럼 번호 체계가 확실하지 않으면 **D'où part...?**로 출발 장소를 물어요.",
        examples: [
          {
            fr: "De quel quai part le train pour le centre ?",
            ipa: "[də kɛl kɛ paʁ lə tʁɛ̃ puʁ lə sɑ̃tʁ] 드 켈 케 파흐 르 트행 푸흐 르 상트흐",
            ko: "도심행 열차는 몇 번 승강장에서 출발해요?",
          },
          {
            fr: "D'où part la navette de l'aéroport ?",
            ipa: "[du paʁ la navɛt də laeʁɔpɔʁ] 두 파흐 라 나베트 드 라에호포흐",
            ko: "공항 셔틀은 어디에서 출발해요?",
          },
        ],
        tip:
          "quai 번호는 출발 직전에 바뀔 수 있으니 표와 전광판을 함께 확인해요.",
      },
      {
        heading: "환승편 찾기 — correspondance와 porte로 물어요",
        pattern:
          "Où est la correspondance pour + 목적지 ? · De quelle porte part mon vol ?",
        patternKo:
          "~행 환승은 어디예요? · 제 항공편은 몇 번 탑승구에서 출발해요?",
        body:
          "환승은 **correspondance**, 탑승구는 **porte**라고 해요. 연결편 목적지나 탑승권을 보여 주며 다음 이동 지점을 확인해요.",
        examples: [
          {
            fr: "Où est la correspondance pour Bordeaux ?",
            ipa: "[u ɛ la kɔʁɛspɔ̃dɑ̃s puʁ bɔʁdo] 우 에 라 꼬헤스뽕당스 푸흐 보흐도",
            ko: "보르도행 환승은 어디예요?",
          },
          {
            fr: "De quelle porte part mon vol ?",
            ipa: "[də kɛl pɔʁt paʁ mɔ̃ vɔl] 드 켈 포흐트 파흐 몽 볼",
            ko: "제 항공편은 몇 번 탑승구에서 출발해요?",
          },
        ],
        tip:
          "환승 시간이 짧으면 Ma correspondance est dans trente minutes라고 남은 시간을 먼저 알려요.",
      },
      {
        heading: "대화 예시 — 표를 사고 환승 탑승구를 찾아요",
        body:
          "표 종류와 목적지를 먼저 정하는 창구 대화, 연결편의 방향과 탑승구를 확인하는 환승 대화를 읽어 봐요.",
        examples: [
          {
            fr:
              "여행자 : Je voudrais un billet pour le centre, s'il vous plaît.\n" +
              "발권 직원 : Un aller simple ou un aller-retour ?\n" +
              "여행자 : Un aller simple. À quelle heure part le prochain train ?\n" +
              "발권 직원 : À dix-huit heures, quai quatre.",
            ipa:
              "[ʒə vudʁɛ œ̃ bijɛ puʁ lə sɑ̃tʁ sil vu plɛ]\n" +
              "[œ̃n ale sɛ̃pl u œ̃n ale ʁətuʁ]\n" +
              "[œ̃n ale sɛ̃pl a kɛl œʁ paʁ lə pʁɔʃɛ̃ tʁɛ̃]\n" +
              "[a dizɥit œʁ kɛ katʁ]",
            ko:
              "여행자: 도심행 표 한 장 주세요.\n" +
              "발권 직원: 편도인가요, 왕복인가요?\n" +
              "여행자: 편도요. 다음 열차는 몇 시에 출발해요?\n" +
              "발권 직원: 18시에 4번 승강장에서 출발해요.",
          },
          {
            fr:
              "여행자 : Excusez-moi, où est la correspondance pour Bordeaux ?\n" +
              "환승 직원 : Suivez les panneaux « Correspondances ».\n" +
              "여행자 : De quelle porte part mon vol ?\n" +
              "환승 직원 : Porte douze. Vous avez encore quarante minutes.",
            ipa:
              "[ɛkskyze mwa u ɛ la kɔʁɛspɔ̃dɑ̃s puʁ bɔʁdo]\n" +
              "[sɥive le pano kɔʁɛspɔ̃dɑ̃s]\n" +
              "[də kɛl pɔʁt paʁ mɔ̃ vɔl]\n" +
              "[pɔʁt duz vuzave ɑ̃kɔʁ kaʁɑ̃t minyt]",
            ko:
              "여행자: 실례해요, 보르도행 환승은 어디예요?\n" +
              "환승 직원: '환승' 표지를 따라가세요.\n" +
              "여행자: 제 항공편은 몇 번 탑승구에서 출발해요?\n" +
              "환승 직원: 12번이에요. 아직 40분 남았어요.",
          },
        ],
      },
      {
        heading: "이야기 — 목적지, 시간, 타는 곳을 세 번 확인해요",
        story: {
          body: [
            {
              narr:
                "여행자가 공항 도착층에서 도심으로 가는 열차표를 사려고 해요. 창구 화면에서 목적지를 가리키며 필요한 표를 말해요.",
            },
            {
              speaker: "여행자",
              fr: "Je voudrais un billet pour le centre, s'il vous plaît.",
              ko: "도심행 표 한 장 주세요.",
            },
            {
              speaker: "발권 직원",
              fr: "Un aller simple ou un aller-retour ?",
              ko: "편도인가요, 왕복인가요?",
            },
            {
              speaker: "여행자",
              fr: "Un aller simple. À quelle heure part le prochain train ?",
              ko: "편도요. 다음 열차는 몇 시에 출발해요?",
            },
            {
              speaker: "발권 직원",
              fr: "À dix-huit heures, quai quatre.",
              ko: "18시에 4번 승강장에서 출발해요.",
            },
            {
              narr:
                "여행자는 출발 전광판에서 목적지와 시각을 확인해요. 다음 항공편으로 갈아타는 날에는 같은 방식으로 환승 방향과 탑승구를 물어요.",
            },
            {
              speaker: "여행자",
              fr: "Où est la correspondance pour Bordeaux ?",
              ko: "보르도행 환승은 어디예요?",
            },
            {
              speaker: "환승 직원",
              fr: "Porte douze. Suivez les panneaux.",
              ko: "12번 탑승구예요. 표지를 따라가세요.",
            },
          ],
          questions: [
            {
              id: "fr-a1-airport-ticket-connection-sq1",
              type: "order",
              pattern: "Je voudrais un billet pour + 목적지.",
              q: "'도심행 표 한 장 주세요'가 되도록 타일을 놓아 보세요.",
              tiles: ["Je voudrais", "un billet", "pour", "le centre", "."],
              answer: ["Je voudrais", "un billet", "pour", "le centre", "."],
              ko: "도심행 표 한 장 주세요.",
              why:
                "정중한 요청 Je voudrais 뒤에 un billet과 pour + 목적지를 놓아요.",
            },
            {
              id: "fr-a1-airport-ticket-connection-sq2",
              type: "fill",
              pattern: "À quelle heure part + 교통수단 ?",
              q: "다음 열차의 출발 시각을 물어요. 빈칸을 채워 보세요.",
              fr: "À quelle heure ［　］ le prochain train ?",
              answer: "part",
              accept: [],
              why:
                "단수 주어 le prochain train에 partir의 현재형 part를 써요.",
            },
            {
              id: "fr-a1-airport-ticket-connection-sq3",
              type: "produce",
              prompt:
                "공항에서 표를 산 뒤 출발 시각이나 타는 곳을 확인하려고 해요. 필요한 질문 한두 문장을 만들어 보세요.",
              model: [
                "À quelle heure part la navette pour le centre ?",
                "De quel quai part le train pour le centre ?",
                "D'où part la navette de l'aéroport ?",
              ],
              guide:
                "시각은 À quelle heure, 승강장은 De quel quai, 출발 장소는 D'où로 시작해요.",
            },
          ],
        },
      },
    ],
  },

  {
    slug: "a1-25-scene-lodging-check-in",
    level: "A1",
    order: 25,
    title: "\"예약했어요\" — 체크인 정보를 차례로 확인해요",
    titleFr: "Faire son arrivée et vérifier les informations du séjour",
    topic: "예약 확인·예약자 정보·숙박 기간·신분증·조식과 체크아웃",
    summary:
      "숙소에서 예약을 확인하고 예약자 정보와 숙박 기간을 말한 뒤, 조식 장소와 체크아웃 시각을 물어요.",
    duration: "약 15분",
    sections: [
      {
        heading: "예약 알리기 — j'ai une réservation으로 시작해요",
        pattern:
          "J'ai une réservation pour + 기간/날짜.",
        patternKo:
          "~ 기간/날짜로 예약했어요.",
        body:
          "체크인 창구에서는 **J'ai une réservation**으로 예약 사실부터 알려요. **pour** 뒤에 숙박 기간이나 도착 날짜를 붙이면 확인이 빨라져요.",
        examples: [
          {
            fr: "J'ai une réservation pour trois nuits.",
            ipa: "[ʒe yn ʁezeʁvasjɔ̃ puʁ tʁwa nɥi] 제 윈 헤제흐바시옹 푸흐 트후아 뉘",
            ko: "3박으로 예약했어요.",
          },
          {
            fr: "J'ai une réservation pour ce soir.",
            ipa: "[ʒe yn ʁezeʁvasjɔ̃ puʁ sə swaʁ] 제 윈 헤제흐바시옹 푸흐 스 수아흐",
            ko: "오늘 저녁으로 예약했어요.",
          },
        ],
        tip:
          "예약 번호와 확인서를 미리 열어 두면 같은 이름의 예약을 찾을 때 도움이 돼요.",
      },
      {
        heading: "예약자 정보 말하기 — au nom de를 써요",
        pattern:
          "La réservation est au nom de + 예약자 표기.",
        patternKo:
          "예약은 ~ 이름으로 되어 있어요.",
        body:
          "**au nom de**는 ~의 이름으로라는 뜻이에요. 예약 확인서에 적힌 표기를 그대로 보여 주고 천천히 읽어 줘요.",
        examples: [
          {
            fr: "La réservation est au nom de la personne indiquée ici.",
            ipa: "[la ʁezeʁvasjɔ̃ ɛt o nɔ̃ də la pɛʁsɔn ɛ̃dike isi] 라 헤제흐바시옹 에토 농 드 라 페흐손 앵디케 이시",
            ko: "예약은 여기에 적힌 사람 이름으로 되어 있어요.",
          },
          {
            fr: "La réservation est au nom indiqué ici.",
            ipa: "[la ʁezeʁvasjɔ̃ ɛt o nɔ̃ ɛ̃dike isi] 라 헤제흐바시옹 에토 농 앵디케 이시",
            ko: "예약은 여기에 적힌 이름으로 되어 있어요.",
          },
        ],
        tip:
          "이름 철자가 전달되지 않으면 C'est écrit ici라고 말하며 예약 확인서를 보여 줘요.",
      },
      {
        heading: "숙박 기간 바로잡기 — du... au...로 범위를 말해요",
        pattern:
          "Je reste du + 시작일 + au + 종료일.",
        patternKo:
          "~일부터 ~일까지 묵어요.",
        body:
          "날짜 범위는 **du... au...**로 말해요. 예약 화면의 날짜가 다르면 결제 전에 실제 숙박 범위를 다시 확인해요.",
        examples: [
          {
            fr: "Je reste du douze au quinze août.",
            ipa: "[ʒə ʁɛst dy duz o kɛ̃z u] 즈 헤스트 뒤 두즈 오 캥즈 우",
            ko: "8월 12일부터 15일까지 묵어요.",
          },
          {
            fr: "Je reste du lundi au jeudi.",
            ipa: "[ʒə ʁɛst dy lœ̃di o ʒødi] 즈 헤스트 뒤 랭디 오 죄디",
            ko: "월요일부터 목요일까지 묵어요.",
          },
        ],
        pitfall:
          "숙박의 마지막 날짜는 보통 체크아웃하는 날이에요. 박 수와 날짜가 모두 맞는지 예약 확인서와 대조해요.",
      },
      {
        heading: "신분증 건네기 — voici로 필요한 것을 보여 줘요",
        pattern:
          "Voici mon passeport. · Est-ce que cette pièce d'identité convient ?",
        patternKo:
          "여권 여기 있어요. · 이 신분증으로 괜찮나요?",
        body:
          "**Voici**는 요청받은 서류를 건넬 때 쓰기 좋아요. 어떤 신분증이 필요한지 불확실하면 **convient**를 써서 가능한지 확인해요.",
        examples: [
          {
            fr: "Voici mon passeport.",
            ipa: "[vwasi mɔ̃ paspɔʁ] 부아시 몽 파스포흐",
            ko: "여권 여기 있어요.",
          },
          {
            fr: "Est-ce que cette pièce d'identité convient ?",
            ipa: "[ɛs kə sɛt pjɛs didɑ̃tite kɔ̃vjɛ̃] 에스 크 세트 피에스 디당티테 꽁비앵",
            ko: "이 신분증으로 괜찮나요?",
          },
        ],
        tip:
          "서류를 건넬 때는 직원이 요청한 항목만 보여 주고, 돌려받았는지 바로 확인해요.",
      },
      {
        heading: "운영 시간 묻기 — où와 à quelle heure로 나눠요",
        pattern:
          "Où est servi le petit-déjeuner ? · À quelle heure faut-il libérer la chambre ?",
        patternKo:
          "조식은 어디에서 제공돼요? · 몇 시에 방을 비워야 해요?",
        body:
          "조식 장소는 **Où est servi...?**, 체크아웃 시각은 **À quelle heure faut-il libérer la chambre ?**로 물어요.",
        examples: [
          {
            fr: "Où est servi le petit-déjeuner ?",
            ipa: "[u ɛ sɛʁvi lə pəti deʒøne] 우 에 세흐비 르 프티 데죄네",
            ko: "조식은 어디에서 제공돼요?",
          },
          {
            fr: "À quelle heure faut-il libérer la chambre ?",
            ipa: "[a kɛl œʁ fotil libeʁe la ʃɑ̃bʁ] 아 켈 외흐 포틸 리베헤 라 샹브흐",
            ko: "몇 시에 방을 비워야 해요?",
          },
        ],
        tip:
          "장소와 시각을 한꺼번에 놓치지 않도록 조식과 체크아웃을 각각 한 문장으로 물어요.",
      },
      {
        heading: "대화 예시 — 예약을 찾고 이용 시간을 확인해요",
        body:
          "예약 사실과 예약자 표기를 차례로 말하는 대화, 조식 장소와 체크아웃 시각을 따로 묻는 대화를 읽어 봐요.",
        examples: [
          {
            fr:
              "여행자 : Bonjour, j'ai une réservation pour trois nuits.\n" +
              "숙소 직원 : À quel nom ?\n" +
              "여행자 : La réservation est au nom indiqué ici.\n" +
              "숙소 직원 : Merci. Puis-je voir votre passeport ?",
            ipa:
              "[bɔ̃ʒuʁ ʒe yn ʁezeʁvasjɔ̃ puʁ tʁwa nɥi]\n" +
              "[a kɛl nɔ̃]\n" +
              "[la ʁezeʁvasjɔ̃ ɛt o nɔ̃ ɛ̃dike isi]\n" +
              "[mɛʁsi pɥiʒ vwaʁ vɔtʁ paspɔʁ]",
            ko:
              "여행자: 안녕하세요, 3박으로 예약했어요.\n" +
              "숙소 직원: 어느 이름으로 예약했나요?\n" +
              "여행자: 여기에 적힌 이름으로 되어 있어요.\n" +
              "숙소 직원: 감사해요. 여권을 볼 수 있을까요?",
          },
          {
            fr:
              "여행자 : Où est servi le petit-déjeuner ?\n" +
              "숙소 직원 : Au rez-de-chaussée, à partir de sept heures.\n" +
              "여행자 : À quelle heure faut-il libérer la chambre ?\n" +
              "숙소 직원 : Avant onze heures.",
            ipa:
              "[u ɛ sɛʁvi lə pəti deʒøne]\n" +
              "[o ʁe də ʃose a paʁtiʁ də sɛt œʁ]\n" +
              "[a kɛl œʁ fotil libeʁe la ʃɑ̃bʁ]\n" +
              "[avɑ̃ ɔ̃z œʁ]",
            ko:
              "여행자: 조식은 어디에서 제공돼요?\n" +
              "숙소 직원: 1층에서 7시부터 제공돼요.\n" +
              "여행자: 몇 시에 방을 비워야 해요?\n" +
              "숙소 직원: 11시 전이에요.",
          },
        ],
      },
      {
        heading: "이야기 — 예약 확인서에서 필요한 정보만 찾아요",
        story: {
          body: [
            {
              narr:
                "여행자가 늦은 오후 숙소에 도착해요. 예약 확인서를 열고 숙박 기간과 예약자 표기를 차례로 알려 줘요.",
            },
            {
              speaker: "여행자",
              fr: "J'ai une réservation pour trois nuits.",
              ko: "3박으로 예약했어요.",
            },
            {
              speaker: "숙소 직원",
              fr: "À quel nom ?",
              ko: "어느 이름으로 예약했나요?",
            },
            {
              speaker: "여행자",
              fr: "La réservation est au nom indiqué ici. Voici mon passeport.",
              ko: "여기에 적힌 이름으로 되어 있어요. 여권 여기 있어요.",
            },
            {
              speaker: "숙소 직원",
              fr: "Votre chambre est prête.",
              ko: "객실이 준비됐어요.",
            },
            {
              narr:
                "열쇠를 받은 여행자는 다음 날 일정을 위해 조식 장소와 체크아웃 시각을 따로 물어 메모해요.",
            },
            {
              speaker: "여행자",
              fr: "Où est servi le petit-déjeuner ?",
              ko: "조식은 어디에서 제공돼요?",
            },
            {
              speaker: "여행자",
              fr: "À quelle heure faut-il libérer la chambre ?",
              ko: "몇 시에 방을 비워야 해요?",
            },
          ],
          questions: [
            {
              id: "fr-a1-lodging-check-in-sq1",
              type: "order",
              pattern: "J'ai une réservation pour + 기간.",
              q: "'3박으로 예약했어요'가 되도록 타일을 놓아 보세요.",
              tiles: ["J'ai", "une réservation", "pour", "trois nuits", "."],
              answer: ["J'ai", "une réservation", "pour", "trois nuits", "."],
              ko: "3박으로 예약했어요.",
              why:
                "예약 사실 J'ai une réservation 뒤에 pour + 기간을 붙여요.",
            },
            {
              id: "fr-a1-lodging-check-in-sq2",
              type: "fill",
              pattern: "La réservation est au nom de + 예약자 표기.",
              q: "예약자 표기를 가리켜 말해요. 빈칸을 채워 보세요.",
              fr: "La réservation est au ［　］ indiqué ici.",
              answer: "nom",
              accept: [],
              why:
                "~의 이름으로는 au nom de라는 덩어리로 써요.",
            },
            {
              id: "fr-a1-lodging-check-in-sq3",
              type: "produce",
              prompt:
                "체크인하면서 예약 기간을 말하고 신분증을 건네려고 해요. 두 문장을 프랑스어로 만들어 보세요.",
              model: [
                "J'ai une réservation pour trois nuits. Voici mon passeport.",
                "Je reste du lundi au jeudi. Voici mon passeport.",
              ],
              guide:
                "예약은 J'ai une réservation..., 서류는 Voici...로 문장을 나눠요.",
            },
          ],
        },
      },
    ],
  },

  {
    slug: "a1-26-scene-lodging-requests-problems",
    level: "A1",
    order: 26,
    title: "\"방에 문제가 있어요\" — 필요한 조치를 구체적으로 요청해요",
    titleFr: "Faire une demande et signaler un problème dans le logement",
    topic: "비품 요청·와이파이·시설 고장·소음·객실 변경",
    summary:
      "숙소에서 수건과 와이파이 정보를 요청하고, 시설 고장이나 소음을 설명해 해결 방법과 객실 변경을 물어요.",
    duration: "약 15분",
    sections: [
      {
        heading: "비품 더 요청하기 — est-ce que je peux avoir를 써요",
        pattern:
          "Est-ce que je peux avoir + 비품, s'il vous plaît ?",
        patternKo:
          "~을 받을 수 있을까요?",
        body:
          "**Est-ce que je peux avoir...?**는 필요한 비품을 정중하게 요청하는 틀이에요. 수량을 함께 말하면 직원이 준비하기 쉬워요.",
        examples: [
          {
            fr: "Est-ce que je peux avoir deux serviettes, s'il vous plaît ?",
            ipa: "[ɛs kə ʒə pø avwaʁ dø sɛʁvjɛt sil vu plɛ] 에스 크 즈 푀 아부아흐 되 세흐비에트, 실 부 플레",
            ko: "수건 두 장을 받을 수 있을까요?",
          },
          {
            fr: "Est-ce que je peux avoir une couverture, s'il vous plaît ?",
            ipa: "[ɛs kə ʒə pø avwaʁ yn kuvɛʁtyʁ sil vu plɛ] 에스 크 즈 푀 아부아흐 윈 쿠베흐튀흐, 실 부 플레",
            ko: "담요 한 장을 받을 수 있을까요?",
          },
        ],
        tip:
          "필요한 수량을 먼저 확인해 deux serviettes처럼 명사 앞에 숫자를 붙여요.",
      },
      {
        heading: "와이파이 정보 묻기 — mot de passe를 확인해요",
        pattern:
          "Quel est le mot de passe du Wi-Fi ? · Le Wi-Fi est-il gratuit ?",
        patternKo:
          "와이파이 비밀번호가 무엇인가요? · 와이파이는 무료인가요?",
        body:
          "비밀번호는 **mot de passe**예요. 객실 안내에 비용이 명확하지 않으면 연결 전에 무료인지 확인해요.",
        examples: [
          {
            fr: "Quel est le mot de passe du Wi-Fi ?",
            ipa: "[kɛl ɛ lə mo də pas dy wifi] 켈 에 르 모 드 파스 뒤 위피",
            ko: "와이파이 비밀번호가 무엇인가요?",
          },
          {
            fr: "Le Wi-Fi est-il gratuit ?",
            ipa: "[lə wifi ɛtil ɡʁatɥi] 르 위피 에틸 그하튀이",
            ko: "와이파이는 무료인가요?",
          },
        ],
        tip:
          "비밀번호 철자를 놓치면 Vous pouvez l'écrire, s'il vous plaît ?라고 적어 달라고 부탁해요.",
      },
      {
        heading: "시설 고장 알리기 — ne fonctionne pas로 말해요",
        pattern:
          "Le/La + 시설 + ne fonctionne pas.",
        patternKo:
          "~이/가 작동하지 않아요.",
        body:
          "**ne fonctionne pas**는 시설이 작동하지 않는다는 뜻이에요. 고장 원인을 추측하기보다 문제가 있는 기기를 정확히 말해요.",
        examples: [
          {
            fr: "La climatisation ne fonctionne pas.",
            ipa: "[la klimatizasjɔ̃ nə fɔ̃ksjɔn pa] 라 클리마티자시옹 느 퐁크시온 파",
            ko: "냉방이 작동하지 않아요.",
          },
          {
            fr: "Le chauffage ne fonctionne pas.",
            ipa: "[lə ʃofaʒ nə fɔ̃ksjɔn pa] 르 쇼파주 느 퐁크시온 파",
            ko: "난방이 작동하지 않아요.",
          },
        ],
        pitfall:
          "전기나 설비를 직접 분해하지 말고 직원에게 객실 번호와 증상을 알려요.",
      },
      {
        heading: "소음 설명하기 — il y a와 depuis를 써요",
        pattern:
          "Il y a beaucoup de bruit + 장소/시간. · Cela dure depuis + 기간.",
        patternKo:
          "~에 소음이 심해요. · ~ 동안 계속되고 있어요.",
        body:
          "소음은 **beaucoup de bruit**로 말해요. 얼마나 지속됐는지는 **depuis** 뒤에 기간을 붙여 전달해요.",
        examples: [
          {
            fr: "Il y a beaucoup de bruit dans le couloir.",
            ipa: "[il ja boku də bʁɥi dɑ̃ lə kulwaʁ] 일 야 보쿠 드 브휘 당 르 쿨루아흐",
            ko: "복도에 소음이 심해요.",
          },
          {
            fr: "Cela dure depuis une heure.",
            ipa: "[səla dyʁ dəpɥi yn œʁ] 슬라 뒤흐 드퓌 윈 외흐",
            ko: "한 시간 동안 계속되고 있어요.",
          },
        ],
        tip:
          "소리가 나는 방향과 지속 시간을 차분히 말하면 직원이 상황을 확인하기 쉬워요.",
      },
      {
        heading: "해결 방법 요청하기 — vérifier와 changer로 물어요",
        pattern:
          "Pouvez-vous vérifier, s'il vous plaît ? · Est-il possible de changer de chambre ?",
        patternKo:
          "확인해 주실 수 있나요? · 객실을 바꿀 수 있나요?",
        body:
          "먼저 **vérifier**로 확인을 요청하고, 바로 해결하기 어렵다면 **changer de chambre**가 가능한지 물어요.",
        examples: [
          {
            fr: "Pouvez-vous vérifier, s'il vous plaît ?",
            ipa: "[puve vu veʁifje sil vu plɛ] 푸베 부 베히피에, 실 부 플레",
            ko: "확인해 주실 수 있나요?",
          },
          {
            fr: "Est-il possible de changer de chambre ?",
            ipa: "[ɛtil pɔsibl də ʃɑ̃ʒe də ʃɑ̃bʁ] 에틸 포시블 드 샹제 드 샹브흐",
            ko: "객실을 바꿀 수 있나요?",
          },
        ],
        tip:
          "객실 변경에는 추가 비용이나 대기 시간이 있을 수 있으니 가능한 선택지를 먼저 들어 봐요.",
      },
      {
        heading: "대화 예시 — 비품을 부탁하고 시설 문제를 신고해요",
        body:
          "필요한 물품과 수량을 말하는 대화, 고장 증상을 알리고 확인이나 객실 변경을 요청하는 대화를 읽어 봐요.",
        examples: [
          {
            fr:
              "여행자 : Est-ce que je peux avoir deux serviettes, s'il vous plaît ?\n" +
              "숙소 직원 : Bien sûr. Nous les montons dans dix minutes.\n" +
              "여행자 : Merci. Quel est le mot de passe du Wi-Fi ?\n" +
              "숙소 직원 : Il est écrit sur la carte de la chambre.",
            ipa:
              "[ɛs kə ʒə pø avwaʁ dø sɛʁvjɛt sil vu plɛ]\n" +
              "[bjɛ̃ syʁ nu le mɔ̃tɔ̃ dɑ̃ dis minyt]\n" +
              "[mɛʁsi kɛl ɛ lə mo də pas dy wifi]\n" +
              "[il ɛt ekʁi syʁ la kaʁt də la ʃɑ̃bʁ]",
            ko:
              "여행자: 수건 두 장을 받을 수 있을까요?\n" +
              "숙소 직원: 물론이에요. 10분 안에 가져다드릴게요.\n" +
              "여행자: 감사해요. 와이파이 비밀번호가 무엇인가요?\n" +
              "숙소 직원: 객실 카드에 적혀 있어요.",
          },
          {
            fr:
              "여행자 : La climatisation ne fonctionne pas.\n" +
              "숙소 직원 : Nous allons envoyer quelqu'un.\n" +
              "여행자 : Pouvez-vous vérifier, s'il vous plaît ?\n" +
              "숙소 직원 : Oui. Si nécessaire, nous changerons votre chambre.",
            ipa:
              "[la klimatizasjɔ̃ nə fɔ̃ksjɔn pa]\n" +
              "[nuz alɔ̃z ɑ̃vwaje kɛlkœ̃]\n" +
              "[puve vu veʁifje sil vu plɛ]\n" +
              "[wi si nesesɛʁ nu ʃɑ̃ʒəʁɔ̃ vɔtʁ ʃɑ̃bʁ]",
            ko:
              "여행자: 냉방이 작동하지 않아요.\n" +
              "숙소 직원: 직원을 보내 드릴게요.\n" +
              "여행자: 확인해 주실 수 있나요?\n" +
              "숙소 직원: 네. 필요하면 객실을 바꿔 드릴게요.",
          },
        ],
      },
      {
        heading: "이야기 — 문제와 원하는 조치를 한 문장씩 말해요",
        story: {
          body: [
            {
              narr:
                "여행자가 객실에 들어가 보니 수건이 한 장뿐이고 냉방도 작동하지 않아요. 프런트에 연락해 필요한 물품부터 요청해요.",
            },
            {
              speaker: "여행자",
              fr: "Est-ce que je peux avoir deux serviettes, s'il vous plaît ?",
              ko: "수건 두 장을 받을 수 있을까요?",
            },
            {
              speaker: "숙소 직원",
              fr: "Oui, bien sûr.",
              ko: "네, 물론이에요.",
            },
            {
              speaker: "여행자",
              fr: "La climatisation ne fonctionne pas.",
              ko: "냉방이 작동하지 않아요.",
            },
            {
              speaker: "여행자",
              fr: "Pouvez-vous vérifier, s'il vous plaît ?",
              ko: "확인해 주실 수 있나요?",
            },
            {
              narr:
                "직원이 확인하는 동안 복도 소음도 한 시간째 이어져요. 여행자는 소음의 위치와 지속 시간을 말하고 가능한 해결책을 물어요.",
            },
            {
              speaker: "여행자",
              fr: "Il y a beaucoup de bruit dans le couloir. Cela dure depuis une heure.",
              ko: "복도에 소음이 심해요. 한 시간 동안 계속되고 있어요.",
            },
            {
              speaker: "여행자",
              fr: "Est-il possible de changer de chambre ?",
              ko: "객실을 바꿀 수 있나요?",
            },
          ],
          questions: [
            {
              id: "fr-a1-lodging-requests-problems-sq1",
              type: "order",
              pattern: "Le/La + 시설 + ne fonctionne pas.",
              q: "'냉방이 작동하지 않아요'가 되도록 타일을 놓아 보세요.",
              tiles: ["La climatisation", "ne", "fonctionne", "pas", "."],
              answer: ["La climatisation", "ne", "fonctionne", "pas", "."],
              ko: "냉방이 작동하지 않아요.",
              why:
                "부정은 활용 동사 fonctionne를 ne와 pas로 감싸요.",
            },
            {
              id: "fr-a1-lodging-requests-problems-sq2",
              type: "fill",
              pattern: "Est-ce que je peux avoir + 비품 ?",
              q: "수건 두 장을 요청해요. 빈칸을 채워 보세요.",
              fr: "Est-ce que je peux avoir deux ［　］, s'il vous plaît ?",
              answer: "serviettes",
              accept: [],
              why:
                "두 장이므로 serviette을 복수형 serviettes로 써요.",
            },
            {
              id: "fr-a1-lodging-requests-problems-sq3",
              type: "produce",
              prompt:
                "객실 시설 하나가 작동하지 않아요. 문제를 알리고 직원에게 확인을 요청하는 두 문장을 만들어 보세요.",
              model: [
                "Le chauffage ne fonctionne pas. Pouvez-vous vérifier, s'il vous plaît ?",
                "La climatisation ne fonctionne pas. Est-il possible de changer de chambre ?",
              ],
              guide:
                "문제는 ne fonctionne pas, 확인 요청은 Pouvez-vous vérifier로 이어 가요.",
            },
          ],
        },
      },
    ],
  },

  {
    slug: "a1-27-scene-restaurant-ordering",
    level: "A1",
    order: 27,
    title: "\"이걸로 주문할게요\" — 자리를 잡고 추천을 받아요",
    titleFr: "Demander une table, choisir et commander",
    topic: "자리 요청·메뉴·오늘의 메뉴·추천·음식과 음료 주문",
    summary:
      "식당에서 인원에 맞는 자리를 요청하고 메뉴와 추천을 확인한 뒤, 음식과 음료를 차례로 주문해요.",
    duration: "약 15분",
    sections: [
      {
        heading: "자리 요청하기 — une table pour로 인원을 말해요",
        pattern:
          "Une table pour + 인원, s'il vous plaît. · Nous sommes + 인원.",
        patternKo:
          "~명 자리 부탁해요. · 저희는 ~명이에요.",
        body:
          "입구에서는 **Une table pour...** 뒤에 인원수를 붙여요. 직원이 인원을 다시 물으면 **Nous sommes...**로 답해요.",
        examples: [
          {
            fr: "Une table pour deux, s'il vous plaît.",
            ipa: "[yn tabl puʁ dø sil vu plɛ] 윈 타블 푸흐 되, 실 부 플레",
            ko: "두 명 자리 부탁해요.",
          },
          {
            fr: "Nous sommes trois.",
            ipa: "[nu sɔm tʁwa] 누 솜 트후아",
            ko: "저희는 세 명이에요.",
          },
        ],
        tip:
          "아이용 의자나 휠체어 공간처럼 필요한 조건이 있다면 자리를 안내받기 전에 함께 말해요.",
      },
      {
        heading: "메뉴 요청하기 — carte와 menu를 구별해요",
        pattern:
          "Est-ce que je peux voir la carte ? · Quel est le menu du jour ?",
        patternKo:
          "전체 메뉴를 볼 수 있을까요? · 오늘의 메뉴가 무엇인가요?",
        body:
          "**la carte**는 개별 음식을 고르는 전체 메뉴판, **le menu du jour**는 그날 구성된 메뉴를 가리켜요.",
        examples: [
          {
            fr: "Est-ce que je peux voir la carte, s'il vous plaît ?",
            ipa: "[ɛs kə ʒə pø vwaʁ la kaʁt sil vu plɛ] 에스 크 즈 푀 부아흐 라 카흐트, 실 부 플레",
            ko: "전체 메뉴를 볼 수 있을까요?",
          },
          {
            fr: "Quel est le menu du jour ?",
            ipa: "[kɛl ɛ lə məny dy ʒuʁ] 켈 에 르 므뉘 뒤 주흐",
            ko: "오늘의 메뉴가 무엇인가요?",
          },
        ],
        pitfall:
          "프랑스어의 menu는 정해진 코스 구성을 뜻할 수 있어요. 전체 메뉴판을 원하면 la carte라고 말해요.",
      },
      {
        heading: "추천 받기 — recommander와 spécialité를 써요",
        pattern:
          "Qu'est-ce que vous recommandez ? · Quelle est la spécialité de la maison ?",
        patternKo:
          "무엇을 추천하세요? · 이 식당의 대표 메뉴가 무엇인가요?",
        body:
          "일반 추천은 **Qu'est-ce que vous recommandez ?**, 식당의 대표 메뉴는 **la spécialité de la maison**으로 물어요.",
        examples: [
          {
            fr: "Qu'est-ce que vous recommandez ?",
            ipa: "[kɛs kə vu ʁəkɔmɑ̃de] 케스 크 부 흐코망데",
            ko: "무엇을 추천하세요?",
          },
          {
            fr: "Quelle est la spécialité de la maison ?",
            ipa: "[kɛl ɛ la spesjalite də la mɛzɔ̃] 켈 에 라 스페시알리테 드 라 메종",
            ko: "이 식당의 대표 메뉴가 무엇인가요?",
          },
        ],
        tip:
          "추천을 들은 뒤 C'est épicé ?처럼 매운지, C'est copieux ?처럼 양이 많은지 한 가지 조건을 더 확인해도 돼요.",
      },
      {
        heading: "음식 주문하기 — je vais prendre로 선택을 정해요",
        pattern:
          "Je vais prendre + 음식. · Pour moi, ce sera + 음식.",
        patternKo:
          "~으로 주문할게요. · 저는 ~으로 할게요.",
        body:
          "메뉴를 고른 뒤에는 **Je vais prendre...** 또는 **Pour moi, ce sera...**로 선택을 말해요.",
        examples: [
          {
            fr: "Je vais prendre la soupe de légumes.",
            ipa: "[ʒə vɛ pʁɑ̃dʁ la sup də legym] 즈 베 프항드흐 라 수프 드 레귐",
            ko: "채소 수프로 주문할게요.",
          },
          {
            fr: "Pour moi, ce sera le plat du jour.",
            ipa: "[puʁ mwa sə səʁa lə pla dy ʒuʁ] 푸흐 무아, 스 스하 르 플라 뒤 주흐",
            ko: "저는 오늘의 요리로 할게요.",
          },
        ],
        tip:
          "메뉴판을 가리키면서 ce plat이라고 말해도 돼요. 주문을 마치기 전에 직원이 반복한 메뉴가 맞는지 들어 봐요.",
      },
      {
        heading: "음료와 물 고르기 — comme boisson으로 이어요",
        pattern:
          "Comme boisson, je voudrais + 음료. · Une carafe d'eau, s'il vous plaît.",
        patternKo:
          "음료로는 ~을 주세요. · 물 한 주전자 부탁해요.",
        body:
          "음식 뒤에 음료를 주문할 때는 **Comme boisson...**으로 화제를 이어요. **une carafe d'eau**는 식탁에 놓는 물병을 가리켜요.",
        examples: [
          {
            fr: "Comme boisson, je voudrais un jus de pomme.",
            ipa: "[kɔm bwasɔ̃ ʒə vudʁɛ œ̃ ʒy də pɔm] 꼼 부아송, 즈 부드헤 앵 쥐 드 폼",
            ko: "음료로는 사과 주스를 주세요.",
          },
          {
            fr: "Une carafe d'eau, s'il vous plaît.",
            ipa: "[yn kaʁaf do sil vu plɛ] 윈 카하프 도, 실 부 플레",
            ko: "물 한 주전자 부탁해요.",
          },
        ],
        tip:
          "탄산수나 병물이 필요한 경우에는 원하는 종류와 가격을 메뉴에서 확인한 뒤 주문해요.",
      },
      {
        heading: "대화 예시 — 메뉴를 보고 추천 음식까지 주문해요",
        body:
          "인원수를 알리고 메뉴판을 받는 대화, 추천을 들은 뒤 음식과 음료를 선택하는 대화를 읽어 봐요.",
        examples: [
          {
            fr:
              "여행자 : Bonsoir. Une table pour deux, s'il vous plaît.\n" +
              "식당 직원 : Bien sûr. Voici votre table.\n" +
              "여행자 : Est-ce que je peux voir la carte ?\n" +
              "식당 직원 : Oui, la voici.",
            ipa:
              "[bɔ̃swaʁ yn tabl puʁ dø sil vu plɛ]\n" +
              "[bjɛ̃ syʁ vwasi vɔtʁ tabl]\n" +
              "[ɛs kə ʒə pø vwaʁ la kaʁt]\n" +
              "[wi la vwasi]",
            ko:
              "여행자: 안녕하세요. 두 명 자리 부탁해요.\n" +
              "식당 직원: 물론이에요. 여기 앉으세요.\n" +
              "여행자: 전체 메뉴를 볼 수 있을까요?\n" +
              "식당 직원: 네, 여기 있어요.",
          },
          {
            fr:
              "여행자 : Qu'est-ce que vous recommandez ?\n" +
              "식당 직원 : La soupe de légumes est très demandée aujourd'hui.\n" +
              "여행자 : Je vais prendre la soupe. Comme boisson, un jus de pomme.\n" +
              "식당 직원 : Très bien.",
            ipa:
              "[kɛs kə vu ʁəkɔmɑ̃de]\n" +
              "[la sup də legym ɛ tʁɛ dəmɑ̃de oʒuʁdɥi]\n" +
              "[ʒə vɛ pʁɑ̃dʁ la sup kɔm bwasɔ̃ œ̃ ʒy də pɔm]\n" +
              "[tʁɛ bjɛ̃]",
            ko:
              "여행자: 무엇을 추천하세요?\n" +
              "식당 직원: 오늘은 채소 수프를 많이 찾으세요.\n" +
              "여행자: 수프로 주문할게요. 음료로는 사과 주스를 주세요.\n" +
              "식당 직원: 좋해요.",
          },
        ],
      },
      {
        heading: "이야기 — 자리에서 주문까지 한 단계씩 진행해요",
        story: {
          body: [
            {
              narr:
                "여행자 두 명이 저녁 식사를 하러 식당에 들어가요. 입구에서 인원수를 말하고 안내받은 자리에 앉아요.",
            },
            {
              speaker: "여행자",
              fr: "Une table pour deux, s'il vous plaît.",
              ko: "두 명 자리 부탁해요.",
            },
            {
              speaker: "식당 직원",
              fr: "Bien sûr. Voici votre table.",
              ko: "물론이에요. 여기 앉으세요.",
            },
            {
              speaker: "여행자",
              fr: "Quel est le menu du jour ?",
              ko: "오늘의 메뉴가 무엇인가요?",
            },
            {
              speaker: "식당 직원",
              fr: "Une soupe de légumes et un plat de poisson.",
              ko: "채소 수프와 생선 요리예요.",
            },
            {
              narr:
                "여행자는 추천을 한 번 더 확인하고 자신이 고른 음식과 음료를 나눠 말해요.",
            },
            {
              speaker: "여행자",
              fr: "Qu'est-ce que vous recommandez ?",
              ko: "무엇을 추천하세요?",
            },
            {
              speaker: "여행자",
              fr: "Je vais prendre la soupe. Comme boisson, un jus de pomme.",
              ko: "수프로 주문할게요. 음료로는 사과 주스를 주세요.",
            },
          ],
          questions: [
            {
              id: "fr-a1-restaurant-ordering-sq1",
              type: "order",
              pattern: "Une table pour + 인원.",
              q: "'두 명 자리 부탁해요'가 되도록 타일을 놓아 보세요.",
              tiles: ["Une table", "pour", "deux", "s'il vous plaît", "."],
              answer: ["Une table", "pour", "deux", "s'il vous plaît", "."],
              ko: "두 명 자리 부탁해요.",
              why:
                "Une table 뒤에 pour + 인원수를 놓고 정중한 표현을 덧붙여요.",
            },
            {
              id: "fr-a1-restaurant-ordering-sq2",
              type: "fill",
              pattern: "Je vais prendre + 음식.",
              q: "채소 수프로 주문해요. 빈칸을 채워 보세요.",
              fr: "Je vais ［　］ la soupe de légumes.",
              answer: "prendre",
              accept: [],
              why:
                "선택한 음식을 주문할 때 Je vais prendre를 한 덩어리로 써요.",
            },
            {
              id: "fr-a1-restaurant-ordering-sq3",
              type: "produce",
              prompt:
                "직원에게 추천을 물은 뒤 음식 하나와 음료 하나를 주문해 보세요.",
              model: [
                "Qu'est-ce que vous recommandez ? Je vais prendre la soupe.",
                "Pour moi, ce sera le plat du jour. Comme boisson, je voudrais un jus de pomme.",
              ],
              guide:
                "추천 질문과 주문 문장을 나누고, 음료는 Comme boisson으로 이어요.",
            },
          ],
        },
      },
    ],
  },

  {
    slug: "a1-28-scene-restaurant-allergy-payment",
    level: "A1",
    order: 28,
    title: "\"이 재료는 빼 주세요\" — 알레르기와 계산을 분명히 말해요",
    titleFr: "Signaler une allergie, demander une adaptation et payer",
    topic: "알레르기·성분 확인·제외 요청·계산서·결제 방법",
    summary:
      "식당에서 알레르기와 피해야 할 재료를 알리고 음식 성분을 확인한 뒤, 계산서와 결제 방법을 물어요.",
    duration: "약 15분",
    sections: [
      {
        heading: "알레르기 알리기 — allergique à를 써요",
        pattern:
          "Je suis allergique à la/au/aux + 재료.",
        patternKo:
          "저는 ~에 알레르기가 있어요.",
        body:
          "알레르기는 **Je suis allergique à...**로 말해요. 여성 단수는 à la, 남성 단수는 au, 복수는 aux와 연결해요.",
        examples: [
          {
            fr: "Je suis allergique aux fruits à coque.",
            ipa: "[ʒə sɥiz alɛʁʒik o fʁɥi a kɔk] 즈 쉬이잘레흐지크 오 프휘 아 코크",
            ko: "저는 견과류에 알레르기가 있어요.",
          },
          {
            fr: "Je suis allergique au lait.",
            ipa: "[ʒə sɥiz alɛʁʒik o lɛ] 즈 쉬이잘레흐지크 오 레",
            ko: "저는 우유에 알레르기가 있어요.",
          },
        ],
        tip:
          "알레르기가 심하면 주문 전에 직원에게 분명히 알리고, 재료와 조리 가능 여부를 직접 확인해요. 참고: noix는 기본적으로 '호두'예요. 견과류 전체를 말할 땐 fruits à coque를 써요.",
      },
      {
        heading: "성분 확인하기 — contenir로 재료를 물어요",
        pattern:
          "Est-ce que ce plat contient + 재료 ?",
        patternKo:
          "이 요리에 ~이/가 들어 있나요?",
        body:
          "**contenir**는 포함하다라는 뜻이에요. 메뉴 설명만으로 확실하지 않은 재료를 한 가지씩 구체적으로 물어요.",
        examples: [
          {
            fr: "Est-ce que ce plat contient des fruits à coque ?",
            ipa: "[ɛs kə sə pla kɔ̃tjɛ̃ de fʁɥi a kɔk] 에스 크 스 플라 꽁티앵 데 프휘 아 코크",
            ko: "이 요리에 견과류가 들어 있나요?",
          },
          {
            fr: "Est-ce que cette soupe contient du lait ?",
            ipa: "[ɛs kə sɛt sup kɔ̃tjɛ̃ dy lɛ] 에스 크 세트 수프 꽁티앵 뒤 레",
            ko: "이 수프에 우유가 들어 있나요?",
          },
        ],
        pitfall:
          "sans라고 적혀 있어도 교차 접촉 가능성까지 보장하는 것은 아니에요. 필요한 안전 조건은 직원에게 따로 확인해요.",
      },
      {
        heading: "재료 제외 요청하기 — sans로 빼 달라고 해요",
        pattern:
          "Sans + 재료, s'il vous plaît. · Est-il possible de préparer ce plat sans + 재료 ?",
        patternKo:
          "~은 빼 주세요. · 이 요리를 ~ 없이 준비할 수 있나요?",
        body:
          "간단한 제외 요청은 **Sans...**, 조리 변경이 가능한지 물을 때는 **Est-il possible de préparer...?**를 써요.",
        examples: [
          {
            fr: "Sans fromage, s'il vous plaît.",
            ipa: "[sɑ̃ fʁɔmaʒ sil vu plɛ] 상 프호마주, 실 부 플레",
            ko: "치즈는 빼 주세요.",
          },
          {
            fr: "Est-il possible de préparer ce plat sans beurre ?",
            ipa: "[ɛtil pɔsibl də pʁepaʁe sə pla sɑ̃ bœʁ] 에틸 포시블 드 프헤파헤 스 플라 상 뵈흐",
            ko: "이 요리를 버터 없이 준비할 수 있나요?",
          },
        ],
        tip:
          "선호에 따른 제외인지 알레르기 때문인지 직원이 알 수 있도록 필요한 경우 Je suis allergique...를 먼저 말해요.",
      },
      {
        heading: "계산서 요청하기 — l'addition을 써요",
        pattern:
          "L'addition, s'il vous plaît. · Est-ce que le service est compris ?",
        patternKo:
          "계산서 부탁해요. · 서비스 요금이 포함되어 있나요?",
        body:
          "식사를 마치면 **L'addition, s'il vous plaît**로 계산서를 요청해요. 추가 비용이 궁금하면 서비스 요금 포함 여부를 확인해요.",
        examples: [
          {
            fr: "L'addition, s'il vous plaît.",
            ipa: "[ladisjɔ̃ sil vu plɛ] 라디시옹, 실 부 플레",
            ko: "계산서 부탁해요.",
          },
          {
            fr: "Est-ce que le service est compris ?",
            ipa: "[ɛs kə lə sɛʁvis ɛ kɔ̃pʁi] 에스 크 르 세흐비스 에 꽁프히",
            ko: "서비스 요금이 포함되어 있나요?",
          },
        ],
        tip:
          "계산서를 받은 뒤 주문한 항목과 금액을 확인하고 결제 방법을 말해요.",
      },
      {
        heading: "결제 방법 묻기 — par carte와 séparément를 써요",
        pattern:
          "Je peux payer par carte ? · Est-ce qu'on peut payer séparément ?",
        patternKo:
          "카드로 결제할 수 있나요? · 따로 계산할 수 있나요?",
        body:
          "카드 결제는 **payer par carte**, 일행과 각자 결제하는 것은 **payer séparément**이라고 해요.",
        examples: [
          {
            fr: "Je peux payer par carte ?",
            ipa: "[ʒə pø peje paʁ kaʁt] 즈 푀 페예 파흐 카흐트",
            ko: "카드로 결제할 수 있나요?",
          },
          {
            fr: "Est-ce qu'on peut payer séparément ?",
            ipa: "[ɛs kɔ̃ pø peje sepaʁemɑ̃] 에스 꽁 푀 페예 세파헤망",
            ko: "따로 계산할 수 있나요?",
          },
        ],
        tip:
          "따로 계산하려면 결제 전에 가능한지 먼저 묻고, 각자 주문한 항목을 준비해요.",
      },
      {
        heading: "대화 예시 — 성분을 확인하고 원하는 방식으로 계산해요",
        body:
          "알레르기와 제외 재료를 주문 전에 알리는 대화, 계산서를 확인한 뒤 결제 방법을 묻는 대화를 읽어 봐요.",
        examples: [
          {
            fr:
              "여행자 : Je suis allergique aux fruits à coque.\n" +
              "식당 직원 : Merci de nous prévenir.\n" +
              "여행자 : Est-ce que ce plat contient des fruits à coque ?\n" +
              "식당 직원 : Oui. Je vais vous proposer un autre plat.",
            ipa:
              "[ʒə sɥiz alɛʁʒik o fʁɥi a kɔk]\n" +
              "[mɛʁsi də nu pʁəvəniʁ]\n" +
              "[ɛs kə sə pla kɔ̃tjɛ̃ de fʁɥi a kɔk]\n" +
              "[wi ʒə vɛ vu pʁɔpoze œ̃n otʁ pla]",
            ko:
              "여행자: 저는 견과류에 알레르기가 있어요.\n" +
              "식당 직원: 알려 주셔서 감사해요.\n" +
              "여행자: 이 요리에 견과류가 들어 있나요?\n" +
              "식당 직원: 네. 다른 요리를 안내해 드릴게요.",
          },
          {
            fr:
              "여행자 : L'addition, s'il vous plaît.\n" +
              "식당 직원 : Bien sûr. La voici.\n" +
              "여행자 : Est-ce qu'on peut payer séparément ?\n" +
              "식당 직원 : Oui. Qui paie en premier ?",
            ipa:
              "[ladisjɔ̃ sil vu plɛ]\n" +
              "[bjɛ̃ syʁ la vwasi]\n" +
              "[ɛs kɔ̃ pø peje sepaʁemɑ̃]\n" +
              "[wi ki pɛj ɑ̃ pʁəmje]",
            ko:
              "여행자: 계산서 부탁해요.\n" +
              "식당 직원: 물론이에요. 여기 있어요.\n" +
              "여행자: 따로 계산할 수 있나요?\n" +
              "식당 직원: 네. 누가 먼저 결제하나요?",
          },
        ],
      },
      {
        heading: "이야기 — 주문 전 확인하고 결제 전 다시 살펴요",
        story: {
          body: [
            {
              narr:
                "여행자는 견과류 알레르기가 있어 주문 전에 직원에게 먼저 알려요. 메뉴에서 고른 요리의 성분도 구체적으로 확인해요.",
            },
            {
              speaker: "여행자",
              fr: "Je suis allergique aux fruits à coque.",
              ko: "저는 견과류에 알레르기가 있어요.",
            },
            {
              speaker: "여행자",
              fr: "Est-ce que ce plat contient des fruits à coque ?",
              ko: "이 요리에 견과류가 들어 있나요?",
            },
            {
              speaker: "식당 직원",
              fr: "Oui. Je peux vous proposer un plat sans fruits à coque.",
              ko: "네. 견과류가 없는 요리를 안내해 드릴 수 있어요.",
            },
            {
              speaker: "여행자",
              fr: "Merci. Sans fromage aussi, s'il vous plaît.",
              ko: "감사합니다. 치즈도 빼 주세요.",
            },
            {
              narr:
                "식사를 마친 뒤 여행자는 계산서를 요청해 항목을 확인해요. 일행과 각자 결제할 수 있는지 결제 전에 물어요.",
            },
            {
              speaker: "여행자",
              fr: "L'addition, s'il vous plaît.",
              ko: "계산서 부탁해요.",
            },
            {
              speaker: "여행자",
              fr: "Est-ce qu'on peut payer séparément ?",
              ko: "따로 계산할 수 있나요?",
            },
          ],
          questions: [
            {
              id: "fr-a1-restaurant-allergy-payment-sq1",
              type: "order",
              pattern: "Je suis allergique aux + 재료.",
              q: "'저는 견과류에 알레르기가 있어요'가 되도록 타일을 놓아 보세요.",
              tiles: ["Je suis", "allergique", "aux", "fruits à coque", "."],
              answer: ["Je suis", "allergique", "aux", "fruits à coque", "."],
              ko: "저는 견과류에 알레르기가 있어요.",
              why:
                "복수 명사구 fruits à coque 앞에서는 à + les가 합쳐진 aux를 써요.",
            },
            {
              id: "fr-a1-restaurant-allergy-payment-sq2",
              type: "fill",
              pattern: "Est-ce que ce plat contient + 재료 ?",
              q: "이 요리에 견과류가 들어 있는지 물어요. 빈칸을 채워 보세요.",
              fr: "Est-ce que ce plat ［　］ des fruits à coque ?",
              answer: "contient",
              accept: [],
              why:
                "단수 주어 ce plat에 contenir의 현재형 contient를 써요.",
            },
            {
              id: "fr-a1-restaurant-allergy-payment-sq3",
              type: "produce",
              prompt:
                "피해야 할 재료를 알리고, 식사를 마친 뒤 계산과 결제 방법을 요청해 보세요.",
              model: [
                "Je suis allergique au lait. Est-ce que cette soupe contient du lait ?",
                "L'addition, s'il vous plaît. Je peux payer par carte ?",
              ],
              guide:
                "알레르기와 성분 확인은 주문 전에, 계산서와 결제 방법은 식사 뒤에 각각 말해요.",
            },
          ],
        },
      },
    ],
  },
];

export default chapters;
