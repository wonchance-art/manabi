/**
 * C1 영어 장면 레슨 초안 — 길 찾기·긴급 상황
 *
 * DRAFT_UNWIRED: 레지스트리·런타임에는 연결하지 않는다.
 * 기존 StoryCheck의 공유 전송 계약이 대사와 fill 문장에 `ja` 키를 사용하므로,
 * 영어 문자열도 그 키에 싣는다. `yomi`는 현행 story 검증과의 호환을 위해
 * 같은 영어 문자열을 담으며, 실제 영어 발음 표기로 사용하지 않는다.
 */

export const ENGLISH_SCENE_EMERGENCY_STATUS = "DRAFT_UNWIRED";

const chapters = [
  {
    slug: "a2-draft-11-scene-directions",
    level: "A2",
    order: 11,
    status: ENGLISH_SCENE_EMERGENCY_STATUS,
    title: "길을 잃어도 대화를 이어 가는 다섯 문형",
    topic: "길 묻기·경로 확인·방향 안내",
    titleFr: "Asking for and giving directions",
    summary:
      "도움을 청하고 목적지를 밝힌 뒤, 경로·회전 지점·목적지 위치를 차례로 확인하는 길 찾기 대화를 연습해요.",
    duration: "약 11분",
    sections: [
      {
        heading: "먼저 짧고 공손하게 말을 걸어요",
        pattern: "Excuse me. Could you help me?",
        patternKo: "실례합니다. 저를 도와주시겠어요?",
        body:
          "낯선 사람에게 바로 장소 이름부터 말하기보다 **Excuse me**로 주의를 정중하게 구해요. 이어서 **Could you help me?**라고 하면 상대가 대화할 수 있는지 먼저 확인할 수 있어요.\n\n" +
          "could는 여기서 과거가 아니라 부탁의 거리를 만드는 말이에요. 급하게 들리지 않으면서도 도움이 필요하다는 뜻을 분명하게 전해요.",
        examples: [
          { en: "Excuse me. Could you help me?", ko: "실례합니다. 저를 도와주시겠어요?" },
          { en: "Excuse me. Could you help us for a moment?", ko: "실례합니다. 잠시 저희를 도와주시겠어요?" },
        ],
        tip:
          "상대가 통화 중이거나 서두르는 모습이면 잠시 기다리거나 다른 사람에게 물어보세요. 공손한 문장만큼 대화를 걸 타이밍도 중요해요.",
      },
      {
        heading: "목적지는 I'm trying to get to로 밝혀요",
        pattern: "I'm trying to get to + 장소.",
        patternKo: "~에 가려고 하는 중이에요",
        body:
          "**I'm trying to get to...**는 목적지를 찾는 과정에서 도움이 필요하다는 맥락까지 자연스럽게 담아요. 단순한 I want to go to보다 지금 길을 찾고 있다는 장면이 더 선명해요.\n\n" +
          "get to 뒤에는 장소를 붙여요. home·here·there처럼 전치사 없이 쓰는 장소 부사는 get home, get here, get there라고 말해요.",
        examples: [
          { en: "I'm trying to get to the community center.", ko: "지역 문화 센터에 가려고 하는 중이에요." },
          { en: "We're trying to get to the east entrance.", ko: "저희는 동쪽 출입구에 가려고 하는 중이에요." },
        ],
        pitfall:
          "home 앞에는 to를 붙이지 않아요. 'I'm trying to get to home'(X)이 아니라 'I'm trying to get home'(O)이에요.",
      },
      {
        heading: "현재 경로가 맞는지 한 번 더 확인해요",
        pattern: "Am I going the right way for + 장소?",
        patternKo: "~로 가는 길이 맞나요?",
        body:
          "**Am I going the right way for...?**는 이미 걷고 있지만 방향이 맞는지 확신이 없을 때 써요. 지도를 보며 경로를 재확인하거나 갈림길에서 어느 쪽인지 물을 때 유용해요.\n\n" +
          "상대가 길을 알려 준 직후에는 **So this is the right way?**라고 짧게 되물을 수도 있어요. 핵심은 내가 이해한 경로를 소리 내어 확인하는 거예요.",
        examples: [
          { en: "Am I going the right way for the river path?", ko: "강변 산책로로 가는 길이 맞나요?" },
          { en: "Are we going the right way for the main gate?", ko: "저희가 정문으로 가는 길이 맞나요?" },
        ],
        vsKo:
          "한국어는 '이쪽 맞아요?'처럼 주어와 이동 동사를 자주 생략해요. 영어는 Am I going...으로 지금 이동 중인 사람과 경로를 함께 밝혀요.",
      },
      {
        heading: "직진과 회전을 한 문장으로 이어 줘요",
        pattern: "Go straight until + 기준점, then turn left/right.",
        patternKo: "~까지 직진한 다음 왼쪽/오른쪽으로 도세요",
        body:
          "**Go straight until...**은 직진을 멈출 기준점을 제시해요. 그 뒤 **then turn left/right**를 붙이면 행동 순서가 또렷해져요.\n\n" +
          "기준점은 눈에 잘 띄고 바뀌지 않는 일반 장소로 잡는 편이 좋아요. 거리 이름을 모를 때는 the next intersection, the crosswalk, the end of the block처럼 설명할 수 있어요.",
        examples: [
          { en: "Go straight until the next intersection, then turn left.", ko: "다음 교차로까지 직진한 다음 왼쪽으로 도세요." },
          { en: "Walk to the end of the block, then turn right.", ko: "블록 끝까지 걸어간 다음 오른쪽으로 도세요." },
        ],
        pitfall:
          "turn 뒤에 방향을 바로 붙일 때는 보통 전치사가 필요 없어요. 'turn to left'(X)보다 'turn left'(O)가 자연스러워요.",
      },
      {
        heading: "마지막 위치는 주변 관계로 고정해요",
        pattern: "It's next to / across from / between + 장소.",
        patternKo: "~ 옆에 / 맞은편에 / ~ 사이에 있어요",
        body:
          "목적지 가까이에서는 **next to**, **across from**, **between A and B**로 마지막 위치를 고정해요. 직진 거리만 알려 주는 것보다 주변 관계를 덧붙이면 지나칠 가능성이 줄어요.\n\n" +
          "next to는 바로 옆, across from은 길이나 공간을 사이에 둔 맞은편이에요. between은 기준점 두 개가 모두 필요해서 between A and B로 완성해요.",
        examples: [
          { en: "It's next to the public garden.", ko: "공공 정원 바로 옆에 있어요." },
          { en: "It's across from the information desk.", ko: "안내 데스크 맞은편에 있어요." },
          { en: "It's between the library and the sports hall.", ko: "도서관과 체육관 사이에 있어요." },
        ],
        tip:
          "안내를 들은 뒤 'Next to the garden, right?'처럼 마지막 기준점을 되말하면 서로 다른 장소를 떠올린 실수를 줄일 수 있어요.",
      },
      {
        heading: "장면으로 확인 — 갈림길에서 목적지를 찾았어요",
        story: {
          body: [
            {
              narr:
                "여행자는 작은 광장 옆 갈림길에서 지도를 다시 본다. 화면의 경로와 눈앞의 길이 달라 보여, 근처 행인에게 조심스럽게 말을 건다.",
            },
            {
              speaker: "여행자",
              ja: "Excuse me. Could you help me?",
              yomi: "Excuse me. Could you help me?",
              ko: "실례합니다. 저를 도와주시겠어요?",
            },
            {
              speaker: "행인",
              ja: "Of course. Where are you trying to go?",
              yomi: "Of course. Where are you trying to go?",
              ko: "물론이죠. 어디에 가려고 하세요?",
            },
            {
              speaker: "여행자",
              ja: "I'm trying to get to the community center.",
              yomi: "I'm trying to get to the community center.",
              ko: "지역 문화 센터에 가려고 하는 중이에요.",
            },
            {
              speaker: "여행자",
              ja: "Am I going the right way for it?",
              yomi: "Am I going the right way for it?",
              ko: "그곳으로 가는 길이 맞나요?",
            },
            {
              narr:
                "행인은 여행자가 가리킨 좁은 길 대신, 건널목이 있는 넓은 길을 손으로 가리킨다.",
            },
            {
              speaker: "행인",
              ja: "Not quite. Take this road and go straight until the next intersection.",
              yomi: "Not quite. Take this road and go straight until the next intersection.",
              ko: "조금 달라요. 이 길로 가서 다음 교차로까지 직진하세요.",
            },
            {
              speaker: "행인",
              ja: "Then turn left. It's across from the public garden.",
              yomi: "Then turn left. It's across from the public garden.",
              ko: "그다음 왼쪽으로 도세요. 공공 정원 맞은편에 있어요.",
            },
            {
              speaker: "여행자",
              ja: "So I go straight, turn left, and look across from the garden?",
              yomi: "So I go straight, turn left, and look across from the garden?",
              ko: "그러면 직진하고 왼쪽으로 돈 뒤 정원 맞은편을 보면 되나요?",
            },
            {
              speaker: "행인",
              ja: "That's right. You'll see the east entrance first.",
              yomi: "That's right. You'll see the east entrance first.",
              ko: "맞아요. 동쪽 출입구가 먼저 보일 거예요.",
            },
            {
              speaker: "여행자",
              ja: "Thank you. That makes it clear.",
              yomi: "Thank you. That makes it clear.",
              ko: "감사합니다. 이제 확실히 알겠어요.",
            },
            {
              narr:
                "여행자는 '직진—왼쪽—정원 맞은편'을 한 번 더 작게 말한 뒤 넓은 길로 방향을 바꾼다.",
            },
          ],
          questions: [
            {
              id: "a2-draft-11-scene-directions-sq1",
              type: "order",
              pattern: "I'm trying to get to + 장소.",
              q: "길을 물어보는 사람이라고 생각하고 '지역 문화 센터에 가려고 하는 중이에요'를 조립해 보세요.",
              tiles: ["the community center.", "I'm", "trying to", "get to"],
              answer: ["I'm", "trying to", "get to", "the community center."],
              ko: "지역 문화 센터에 가려고 하는 중이에요.",
              why:
                "지금 목적지를 찾는 과정은 I'm trying to get to + 장소로 말해요. get과 목적지 사이에 to가 필요해요.",
            },
            {
              id: "a2-draft-11-scene-directions-sq2",
              type: "fill",
              pattern: "Go straight until + 기준점, then turn left/right.",
              q: "행인 역할로 '다음 교차로까지 직진하세요'라고 안내해 보세요.",
              ja: "Go straight ［　］ the next intersection.",
              answer: "until",
              accept: ["until"],
              why:
                "until은 직진 동작이 이어지는 끝 기준점을 표시해요. 교차로에 닿으면 다음 행동으로 넘어가요.",
            },
            {
              id: "a2-draft-11-scene-directions-sq3",
              type: "produce",
              prompt:
                "목적지가 도서관과 체육관 사이에 있다고 알려 주세요. 마지막에는 상대가 이해했는지 짧게 확인해 보세요.",
              model: [
                "It's between the library and the sports hall. Does that make sense?",
                "It's between the library and the sports hall. Is that clear?",
              ],
              guide:
                "between A and B로 기준점 두 개를 모두 말해요. Does that make sense?나 Is that clear?로 안내가 전달됐는지 확인할 수 있어요.",
            },
          ],
        },
      },
    ],
  },

  {
    slug: "a2-draft-12-scene-emergency-call",
    level: "A2",
    order: 12,
    status: ENGLISH_SCENE_EMERGENCY_STATUS,
    title: "긴급 전화에서 먼저 전해야 할 다섯 문형",
    topic: "도움 요청·상황·위치·상태·지시 확인",
    titleFr: "Making an emergency call",
    summary:
      "현지 긴급 서비스에 도움을 요청하고, 무슨 일이 있었는지와 정확한 위치·사람의 상태를 짧고 분명하게 전하는 대화를 연습해요.",
    duration: "약 12분",
    sections: [
      {
        heading: "도움의 종류를 첫 문장에 밝혀요",
        pattern: "I need help. Please send + 필요한 도움.",
        patternKo: "도움이 필요해요. ~을 보내 주세요",
        body:
          "긴급 전화에서는 긴 설명보다 **I need help**로 시작하고, 필요한 지원을 알면 **Please send...**로 바로 말해요. 무엇이 필요한지 확실하지 않다면 추측하지 말고 상황을 설명한 뒤 안내원의 질문에 답해요.\n\n" +
          "지역마다 긴급 전화번호와 운영 방식이 다르므로 여행 전 현지 번호를 확인해 두는 편이 안전해요. 이 레슨에서는 특정 번호 대신 local emergency services라고 표현해요.",
        examples: [
          { en: "I need help. Please send an ambulance.", ko: "도움이 필요해요. 구급차를 보내 주세요." },
          { en: "We need emergency help.", ko: "저희는 긴급 도움이 필요해요." },
        ],
        tip:
          "전화가 연결되면 안내원이 필요한 정보를 순서대로 물어요. 모르는 내용은 지어내지 말고 'I don't know'라고 분명히 답하세요.",
      },
      {
        heading: "무슨 일이 있었는지 한 문장으로 말해요",
        pattern: "There has been + 사건. Someone is + 상태.",
        patternKo: "~이 발생했어요. 누군가 ~한 상태예요",
        body:
          "**There has been...**은 방금 발생해 지금 대응이 필요한 사건을 알릴 때 쓸 수 있어요. 이어서 **Someone is hurt / unconscious / having trouble breathing**처럼 관찰한 상태를 짧게 말해요.\n\n" +
          "의학적 원인을 추측하기보다 직접 본 사실을 전달하는 것이 중요해요. 안내원이 더 구체적인 질문을 하면 아는 범위에서 정확히 답해요.",
        examples: [
          { en: "There has been an accident. Someone is hurt.", ko: "사고가 발생했어요. 다친 사람이 있어요." },
          { en: "A person has fallen and is not responding.", ko: "한 사람이 쓰러졌고 반응이 없어요." },
        ],
        pitfall:
          "상태를 확실히 알 수 없는데 진단명으로 단정하지 않아요. 'I think...'를 반복하기보다 보이는 사실과 상대의 반응을 설명해요.",
      },
      {
        heading: "위치는 큰 범위에서 세부 지점으로 좁혀요",
        pattern: "We're at + 장소. The exact location is + 세부 위치.",
        patternKo: "저희는 ~에 있어요. 정확한 위치는 ~예요",
        body:
          "긴급 지원이 찾아오려면 **현재 위치**가 먼저 필요해요. **We're at...**으로 큰 장소를 말하고, **The exact location is...**로 출입구·층·교차로 같은 세부 지점을 덧붙여요.\n\n" +
          "주소를 모르면 눈에 보이는 표지, 건물 용도, 출입구 방향처럼 확인 가능한 기준점을 말해요. 이동하면 위치가 달라졌다는 사실도 안내원에게 알려요.",
        examples: [
          { en: "We're at the community sports hall.", ko: "저희는 지역 체육관에 있어요." },
          { en: "The exact location is outside the north entrance.", ko: "정확한 위치는 북쪽 출입구 밖이에요." },
          { en: "We're near the intersection by the public library.", ko: "저희는 공공 도서관 옆 교차로 근처에 있어요." },
        ],
        tip:
          "방향을 잘 모르면 north 같은 말을 추측하지 말고, 눈앞의 출입구 표지나 교차로 이름처럼 읽을 수 있는 정보를 그대로 전해요.",
      },
      {
        heading: "의식과 호흡 질문에는 짧게 답해요",
        pattern: "Is the person conscious? Are they breathing?",
        patternKo: "그 사람이 의식이 있나요? 숨을 쉬고 있나요?",
        body:
          "긴급 안내원은 **Is the person conscious?**, **Are they breathing?**처럼 상태를 확인해요. conscious는 깨어 있고 반응할 수 있는 상태, breathing은 호흡 여부를 묻는 말이에요.\n\n" +
          "대답은 **Yes, they are**, **No, they aren't**, **I'm not sure**처럼 짧고 명확하게 해요. 상태가 달라지면 즉시 안내원에게 변화를 알려요.",
        examples: [
          { en: "Is the person conscious?", ko: "그 사람이 의식이 있나요?" },
          { en: "They are breathing, but they are not responding.", ko: "숨은 쉬고 있지만 반응이 없어요." },
          { en: "I'm not sure. Their condition has changed.", ko: "확실하지 않아요. 상태가 달라졌어요." },
        ],
        vsKo:
          "성별을 모르거나 중요하지 않을 때 영어는 한 사람도 they로 받을 수 있어요. 긴급 상황에서는 he/she를 추측하지 않고 the person— they로 이어 가면 돼요.",
      },
      {
        heading: "전화를 유지하고 안내를 되확인해요",
        pattern: "I'll stay on the line and follow your instructions.",
        patternKo: "전화를 끊지 않고 안내를 따를게요",
        body:
          "긴급 안내원이 통화를 유지하라고 하면 **I'll stay on the line**으로 확인해요. 이어서 **I'll follow your instructions**라고 말하면 안내를 들을 준비가 됐다는 뜻이에요.\n\n" +
          "잘 듣지 못했거나 이해하지 못했다면 추측해서 행동하지 말고 **Could you repeat that, please?**라고 요청해요. 다친 사람을 옮길지 같은 안전 판단은 현장 위험과 안내원의 지시에 따라야 해요.",
        examples: [
          { en: "I'll stay on the line and follow your instructions.", ko: "전화를 끊지 않고 안내를 따를게요." },
          { en: "Could you repeat that more slowly, please?", ko: "그 말씀을 더 천천히 반복해 주시겠어요?" },
          { en: "I won't move the person unless you tell me to or there is immediate danger.", ko: "안내해 주시거나 즉각적인 위험이 있지 않는 한 그 사람을 옮기지 않을게요." },
        ],
        tip:
          "이 레슨은 언어 연습이에요. 실제 상황에서는 먼저 주변이 안전한지 확인하고, 현지 긴급 서비스 안내원의 지시를 우선해요.",
      },
      {
        heading: "장면으로 확인 — 긴급 안내원에게 핵심을 전했어요",
        story: {
          body: [
            {
              narr:
                "공공 체육관 북쪽 출입구 밖에서 한 사람이 넘어져 반응이 없다. 신고자는 주변의 추가 위험이 없는지 확인한 뒤 현지 긴급 서비스에 전화한다.",
            },
            {
              speaker: "긴급 안내원",
              ja: "Emergency services. What help do you need?",
              yomi: "Emergency services. What help do you need?",
              ko: "긴급 서비스입니다. 어떤 도움이 필요하신가요?",
            },
            {
              speaker: "신고자",
              ja: "I need help. Please send an ambulance.",
              yomi: "I need help. Please send an ambulance.",
              ko: "도움이 필요해요. 구급차를 보내 주세요.",
            },
            {
              speaker: "긴급 안내원",
              ja: "Tell me what happened.",
              yomi: "Tell me what happened.",
              ko: "무슨 일이 있었는지 말씀해 주세요.",
            },
            {
              speaker: "신고자",
              ja: "A person has fallen and is not responding.",
              yomi: "A person has fallen and is not responding.",
              ko: "한 사람이 쓰러졌고 반응이 없어요.",
            },
            {
              narr:
                "안내원은 지원을 보낼 위치부터 확인한다. 신고자는 건물 이름과 눈앞의 출입구 표지를 차례로 읽는다.",
            },
            {
              speaker: "긴급 안내원",
              ja: "Where are you now?",
              yomi: "Where are you now?",
              ko: "지금 어디에 계신가요?",
            },
            {
              speaker: "신고자",
              ja: "We're at the community sports hall. The exact location is outside the north entrance.",
              yomi: "We're at the community sports hall. The exact location is outside the north entrance.",
              ko: "저희는 지역 체육관에 있어요. 정확한 위치는 북쪽 출입구 밖이에요.",
            },
            {
              speaker: "긴급 안내원",
              ja: "Is the person conscious? Are they breathing?",
              yomi: "Is the person conscious? Are they breathing?",
              ko: "그 사람이 의식이 있나요? 숨을 쉬고 있나요?",
            },
            {
              speaker: "신고자",
              ja: "They are breathing, but they are not responding.",
              yomi: "They are breathing, but they are not responding.",
              ko: "숨은 쉬고 있지만 반응이 없어요.",
            },
            {
              speaker: "긴급 안내원",
              ja: "Stay on the line. I will tell you what to do next.",
              yomi: "Stay on the line. I will tell you what to do next.",
              ko: "전화를 끊지 마세요. 다음에 무엇을 할지 안내해 드릴게요.",
            },
            {
              speaker: "신고자",
              ja: "I'll stay on the line and follow your instructions.",
              yomi: "I'll stay on the line and follow your instructions.",
              ko: "전화를 끊지 않고 안내를 따를게요.",
            },
            {
              narr:
                "신고자는 전화를 스피커로 전환하고 사람 곁에 머문다. 상태가 달라지면 곧바로 알릴 준비를 하며 안내원의 다음 말을 기다린다.",
            },
          ],
          questions: [
            {
              id: "a2-draft-12-scene-emergency-call-sq1",
              type: "order",
              pattern: "We're at + 장소. The exact location is + 세부 위치.",
              q: "신고자 역할로 '정확한 위치는 북쪽 출입구 밖이에요'를 조립해 보세요.",
              tiles: ["outside", "The exact location", "the north entrance.", "is"],
              answer: ["The exact location", "is", "outside", "the north entrance."],
              ko: "정확한 위치는 북쪽 출입구 밖이에요.",
              why:
                "The exact location is 뒤에 확인 가능한 세부 지점을 붙여요. outside the north entrance가 출입구 바깥이라는 위치를 고정해요.",
            },
            {
              id: "a2-draft-12-scene-emergency-call-sq2",
              type: "fill",
              pattern: "I'll stay on the line and follow your instructions.",
              q: "안내원에게 전화를 유지하겠다고 답해 보세요.",
              ja: "I'll stay ［　］ the line and follow your instructions.",
              answer: "on",
              accept: ["on"],
              why:
                "stay on the line은 전화를 끊지 않고 통화를 유지한다는 고정 표현이에요.",
            },
            {
              id: "a2-draft-12-scene-emergency-call-sq3",
              type: "produce",
              prompt:
                "안내원이 의식과 호흡을 물었어요. '의식은 없지만 숨은 쉬고 있어요'라고 짧고 분명하게 답해 보세요.",
              model: [
                "They aren't conscious, but they are breathing.",
                "No, they aren't conscious. They are breathing.",
              ],
              guide:
                "한 사람을 성별 추측 없이 they로 받아요. 상태 두 가지를 but으로 나누면 짧고 분명하게 전달할 수 있어요.",
            },
          ],
        },
      },
    ],
  },
];

export const englishSceneEmergencyDraft = chapters;

export default chapters;
