/**
 * DRAFT — E6 프랑스어 A1 문법 확장 초안 (Claude 콘텐츠 검수 전)
 *
 * 기존 grammar/a1.js와 상위 레벨 문법의 필드·해요체·예문 계약을 따르되,
 * 현재 소비 레지스트리에는 연결하지 않는다. 제목·설명·예문 카피는 Claude
 * 검수 뒤 확정하며, 검수 전에는 이 파일을 제품 경로에 import하지 않는다.
 */
const chapters = [
  // DRAFT: 기존 a1-03의 -er 현재형과 분리해, 규칙 -ir/-re 두 계열만 다룬다.
  {
    slug: "a1-draft-14-ir-re-present",
    level: "A1",
    order: 14,
    title: "\"고르고 기다려요\"도 현재형 한 세트",
    topic: "규칙 -ir·-re 동사 현재형",
    titleFr: "Le présent des verbes réguliers en -ir et en -re",
    summary:
      "-er 밖에서도 규칙은 보여요. finir형 -ir 동사와 attendre형 -re 동사의 현재형을 두 묶음으로 익혀요.",
    duration: "약 9분",
    sections: [
      {
        heading: "finir형 -ir 동사 — 복수에서 -iss-가 보여요",
        pattern:
          "어간 + -is/-is/-it/-issons/-issez/-issent",
        patternKo:
          "finir형 규칙 -ir 현재형 — 복수 세 형태에 -iss-",
        body:
          "규칙적인 **finir형 -ir 동사**는 원형의 -ir를 떼고 어미를 붙여요. 단수 세 형태는 finis, finis, finit이고, 복수 세 형태에는 **-iss-**가 나타나요.\n\n" +
          "choisir(고르다), finir(끝내다), réussir(성공하다)가 이 틀을 따라요. 철자는 여러 모양이지만 단수의 끝 -s, -t는 소리 내지 않아요.",
        table: {
          caption: "finir 직설법 현재",
          headers: ["인칭", "형태", "발음"],
          rows: [
            ["je", "finis", "[ʒə fini]"],
            ["tu", "finis", "[ty fini]"],
            ["il / elle / on", "finit", "[il fini]"],
            ["nous", "finissons", "[nu finisɔ̃]"],
            ["vous", "finissez", "[vu finise]"],
            ["ils / elles", "finissent", "[il finis]"],
          ],
        },
        examples: [
          {
            fr: "Je finis le travail à six heures.",
            ipa: "[ʒə fini lə tʁavaj a sizœʁ]",
            ko: "저는 6시에 일을 끝내요.",
          },
          {
            fr: "Nous choisissons un dessert.",
            ipa: "[nu ʃwazisɔ̃ œ̃ desɛʁ]",
            ko: "우리는 디저트 하나를 골라요.",
          },
          {
            fr: "Vous réussissez cet exercice.",
            ipa: "[vu ʁeyisise sɛt ɛɡzɛʁsis]",
            ko: "여러분은 이 연습문제를 해내요.",
          },
        ],
        pitfall:
          "-ir로 끝난다고 모두 이 규칙을 따르지는 않아요. partir, sortir, dormir는 nous partons, nous sortons, nous dormons처럼 **-iss-가 없는 별도 계열**이에요. 처음 보는 -ir 동사는 nous형을 함께 확인하세요.",
      },
      {
        heading: "attendre형 -re 동사 — 단수에서는 끝소리가 숨어요",
        pattern:
          "어간 + -s/-s/없음/-ons/-ez/-ent",
        patternKo:
          "규칙 -re 현재형 — 단수 세 형태는 대체로 같은 소리",
        body:
          "규칙 -re 동사는 원형의 **-re를 떼고** -s, -s, 아무것도 없음, -ons, -ez, -ent를 붙여요. attendre의 단수 attends, attends, attend는 철자가 달라도 모두 [atɑ̃]으로 들려요.\n\n" +
          "복수에서는 어간 끝 자음이 다시 들려요. nous attendons의 [d], vous attendez의 [d]가 그 신호예요.",
        table: {
          caption: "attendre 직설법 현재",
          headers: ["인칭", "형태", "발음"],
          rows: [
            ["j'", "attends", "[ʒatɑ̃]"],
            ["tu", "attends", "[ty atɑ̃]"],
            ["il / elle / on", "attend", "[il atɑ̃]"],
            ["nous", "attendons", "[nuzatɑ̃dɔ̃]"],
            ["vous", "attendez", "[vuzatɑ̃de]"],
            ["ils / elles", "attendent", "[ilzatɑ̃d]"],
          ],
        },
        examples: [
          {
            fr: "J'attends le train.",
            ipa: "[ʒatɑ̃ lə tʁɛ̃]",
            ko: "저는 기차를 기다려요.",
          },
          {
            fr: "Nous vendons des livres.",
            ipa: "[nu vɑ̃dɔ̃ de livʁ]",
            ko: "우리는 책을 팔아요.",
          },
          {
            fr: "Vous répondez à la question.",
            ipa: "[vu ʁepɔ̃de a la kɛstjɔ̃]",
            ko: "여러분은 질문에 답해요.",
          },
        ],
        tip:
          "-re 동사의 단수형은 끝 자음이 잠들고, 복수형에서 다시 깨어난다고 생각해 보세요. attend [atɑ̃]과 attendons [atɑ̃dɔ̃]을 한 쌍으로 소리 내면 어간이 더 잘 보여요.",
      },
      {
        heading: "원형 끝만 믿지 말고 활용 가족을 확인해요",
        pattern:
          "규칙형 확인 = nous형의 -issons 또는 -ons를 확인",
        patternKo:
          "사전에서 nous형까지 보고 활용 가족 판별",
        body:
          "프랑스어 동사는 원형 끝이 같아도 활용 가족이 다를 수 있어요. finir와 partir는 둘 다 -ir, attendre와 prendre는 둘 다 -re지만 현재형 만드는 법은 같지 않아요.\n\n" +
          "새 동사를 외울 때는 원형만 적지 말고 **je형과 nous형을 함께** 적으세요. je finis / nous finissons처럼 두 형태만 알아도 규칙 가족을 빠르게 판별할 수 있어요.",
        examples: [
          {
            fr: "Nous finissons à midi.",
            ipa: "[nu finisɔ̃ a midi]",
            ko: "우리는 정오에 끝내요.",
            note: "finir형 규칙 -ir",
          },
          {
            fr: "Nous partons à midi.",
            ipa: "[nu paʁtɔ̃ a midi]",
            ko: "우리는 정오에 떠나요.",
            note: "partir는 -iss-가 없는 불규칙 계열",
          },
          {
            fr: "Vous attendez ici.",
            ipa: "[vuzatɑ̃de isi]",
            ko: "여기서 기다리세요.",
            note: "attendre형 규칙 -re",
          },
          {
            fr: "Vous prenez le bus.",
            ipa: "[vu pʁəne lə bys]",
            ko: "버스를 타세요.",
            note: "prendre는 별도 활용",
          },
        ],
        vsEn:
          "영어도 -ed만 붙이는 규칙 동사와 take→took 같은 불규칙 동사를 나눠 외우죠. 프랑스어도 같은 발상이에요. 다만 현재형에서 가족이 더 많으니 원형과 nous형을 한 카드에 묶는 편이 효율적이에요.",
      },
    ],
  },

  // DRAFT: 기존 être/avoir/aller/venir과 겹치지 않는 A1 필수 불규칙 현재형만 추가한다.
  {
    slug: "a1-draft-15-modal-faire-present",
    level: "A1",
    order: 15,
    title: "\"할 수 있고, 하고 싶고, 해야 해요\"",
    topic: "faire·pouvoir·vouloir·devoir 현재형",
    titleFr: "Faire, pouvoir, vouloir et devoir au présent",
    summary:
      "일상에서 빠질 수 없는 faire와, 가능·바람·의무 뒤에 동사 원형을 잇는 pouvoir, vouloir, devoir를 현재형으로 써요.",
    duration: "약 10분",
    sections: [
      {
        heading: "faire — 하다, 만들다, 날씨까지",
        pattern:
          "je fais · tu fais · il fait · nous faisons · vous faites · ils font",
        patternKo:
          "faire 현재형 — 활동과 날씨를 함께 만드는 필수 동사",
        body:
          "**faire**는 '하다, 만들다'가 기본 뜻이지만 활동과 날씨에도 널리 써요. faire du sport는 운동하다, faire un gâteau는 케이크를 만들다, il fait froid는 날씨가 춥다는 뜻이에요.\n\n" +
          "nous faisons는 [nu fəzɔ̃]으로 발음해요. 철자의 ai를 [e]로 읽지 않는 점이 특히 중요해요.",
        table: {
          caption: "faire 직설법 현재",
          headers: ["인칭", "형태", "발음"],
          rows: [
            ["je", "fais", "[ʒə fɛ]"],
            ["tu", "fais", "[ty fɛ]"],
            ["il / elle / on", "fait", "[il fɛ]"],
            ["nous", "faisons", "[nu fəzɔ̃]"],
            ["vous", "faites", "[vu fɛt]"],
            ["ils / elles", "font", "[il fɔ̃]"],
          ],
        },
        examples: [
          {
            fr: "Je fais mes devoirs.",
            ipa: "[ʒə fɛ me dəvwaʁ]",
            ko: "저는 숙제를 해요.",
          },
          {
            fr: "Nous faisons du sport.",
            ipa: "[nu fəzɔ̃ dy spɔʁ]",
            ko: "우리는 운동해요.",
          },
          {
            fr: "Il fait froid aujourd'hui.",
            ipa: "[il fɛ fʁwa oʒuʁdɥi]",
            ko: "오늘은 날씨가 추워요.",
          },
        ],
        tip:
          "날씨를 말하는 il은 특정 사람이나 사물을 가리키지 않아요. il fait chaud, il fait beau처럼 **il fait + 날씨 표현**을 통째로 익혀두세요.",
      },
      {
        heading: "pouvoir와 vouloir — 할 수 있다, 하고 싶다",
        pattern:
          "pouvoir / vouloir 현재형 + 동사 원형",
        patternKo:
          "가능·바람을 나타낸 뒤 실제 행동은 원형으로",
        body:
          "**pouvoir + 동사 원형**은 '~할 수 있다', **vouloir + 동사 원형**은 '~하고 싶다'예요. 두 동사를 인칭에 맞게 활용하고, 뒤의 행동 동사는 원형 그대로 둬요.\n\n" +
          "pouvoir는 peux/peut의 끝 자음을 읽지 않고, vouloir의 je veux와 tu veux도 둘 다 [vø]로 들려요.",
        table: {
          caption: "pouvoir와 vouloir 직설법 현재",
          headers: ["인칭", "pouvoir", "vouloir"],
          rows: [
            ["je", "peux", "veux"],
            ["tu", "peux", "veux"],
            ["il / elle / on", "peut", "veut"],
            ["nous", "pouvons", "voulons"],
            ["vous", "pouvez", "voulez"],
            ["ils / elles", "peuvent", "veulent"],
          ],
        },
        examples: [
          {
            fr: "Je peux venir demain.",
            ipa: "[ʒə pø vəniʁ dəmɛ̃]",
            ko: "저는 내일 올 수 있어요.",
          },
          {
            fr: "Vous pouvez répéter ?",
            ipa: "[vu puve ʁepete]",
            ko: "다시 말씀해 주실 수 있나요?",
          },
          {
            fr: "Nous voulons apprendre le français.",
            ipa: "[nu vulɔ̃ apʁɑ̃dʁ lə fʁɑ̃sɛ]",
            ko: "우리는 프랑스어를 배우고 싶어요.",
          },
        ],
        vsEn:
          "영어 can/want to 뒤에 동사 원형이 오는 것처럼 프랑스어도 pouvoir/vouloir 뒤에 원형을 둬요. I can come = Je peux venir, I want to learn = Je veux apprendre처럼 뼈대가 평행해요.",
        enParallel: {
          rows: [
            {
              en: "I **can come** tomorrow.",
              fr: "Je **peux venir** demain.",
              ko: "저는 내일 올 수 있어요.",
            },
            {
              en: "We **want to learn** French.",
              fr: "Nous **voulons apprendre** le français.",
              ko: "우리는 프랑스어를 배우고 싶어요.",
            },
          ],
          note:
            "활용한 가능·바람 동사 뒤에 실제 행동의 **동사 원형**을 놓는 순서가 같아요.",
        },
      },
      {
        heading: "devoir — 해야 한다, 틀림없이 그렇다",
        pattern:
          "devoir 현재형 + 동사 원형",
        patternKo:
          "필요·의무 뒤에 해야 할 행동을 원형으로",
        body:
          "**devoir + 동사 원형**은 '~해야 한다'는 필요나 의무를 나타내요. dois, doit는 [dwa], devons는 [dəvɔ̃], devez는 [dəve]처럼 어간 소리가 달라져요.\n\n" +
          "A1에서는 우선 일정과 규칙을 말하는 용법에 집중해요. 강한 명령보다는 내가 해야 할 일을 설명할 때 자연스럽게 쓸 수 있어요.",
        table: {
          caption: "devoir 직설법 현재",
          headers: ["인칭", "형태", "발음"],
          rows: [
            ["je", "dois", "[ʒə dwa]"],
            ["tu", "dois", "[ty dwa]"],
            ["il / elle / on", "doit", "[il dwa]"],
            ["nous", "devons", "[nu dəvɔ̃]"],
            ["vous", "devez", "[vu dəve]"],
            ["ils / elles", "doivent", "[il dwav]"],
          ],
        },
        examples: [
          {
            fr: "Je dois partir maintenant.",
            ipa: "[ʒə dwa paʁtiʁ mɛ̃tənɑ̃]",
            ko: "저는 지금 떠나야 해요.",
          },
          {
            fr: "Nous devons acheter du pain.",
            ipa: "[nu dəvɔ̃ aʃte dy pɛ̃]",
            ko: "우리는 빵을 사야 해요.",
          },
          {
            fr: "Vous devez attendre ici.",
            ipa: "[vu dəve atɑ̃dʁ isi]",
            ko: "여기서 기다리셔야 해요.",
          },
        ],
        pitfall:
          "pouvoir, vouloir, devoir 뒤의 두 번째 동사까지 활용하지 마세요. **Je dois partir**가 맞고 Je dois pars는 틀려요. 한 문장에 활용하는 동사는 앞의 하나, 뒤는 원형이라고 기억하세요.",
      },
    ],
  },

  // DRAFT: 기존 성 개념·형용사 기본 일치와 분리해, 사람 명사의 여성형과 명사 복수 형태만 다룬다.
  {
    slug: "a1-draft-16-noun-gender-plural",
    level: "A1",
    order: 16,
    title: "\"학생 한 명\"이 둘이 되면 말도 바뀌어요",
    topic: "사람 명사의 여성형·명사 복수형",
    titleFr: "Le féminin et le pluriel des noms",
    summary:
      "사람을 가리키는 명사의 여성형과, -s·-x·-aux로 갈리는 명사 복수형을 실제 문장 안에서 맞춰요.",
    duration: "약 9분",
    sections: [
      {
        heading: "사람 명사의 기본 여성형 — 끝에 -e",
        pattern:
          "남성형 명사 + e → 여성형 명사",
        patternKo:
          "사람을 가리키는 명사의 기본 여성형 만들기",
        body:
          "사람을 가리키는 명사는 대상을 표현하는 문법적 성에 맞춰 형태가 달라질 수 있어요. 기본형은 남성형 끝에 **-e**를 붙이는 방식이에요: étudiant → étudiante, ami → amie.\n\n" +
          "끝의 -e가 앞 자음을 깨워 발음이 달라지기도 해요. étudiant [etydjɑ̃]의 끝 t는 잠들지만 étudiante [etydjɑ̃t]에서는 들려요.",
        examples: [
          {
            fr: "C'est un étudiant.",
            ipa: "[sɛtœ̃n etydjɑ̃]",
            ko: "이 사람은 남학생이에요.",
          },
          {
            fr: "C'est une étudiante.",
            ipa: "[sɛt yn etydjɑ̃t]",
            ko: "이 사람은 여학생이에요.",
          },
          {
            fr: "Mon voisin est français.",
            ipa: "[mɔ̃ vwazɛ̃ ɛ fʁɑ̃sɛ]",
            ko: "제 남자 이웃은 프랑스인이에요.",
          },
          {
            fr: "Ma voisine est française.",
            ipa: "[ma vwazin ɛ fʁɑ̃sɛz]",
            ko: "제 여자 이웃은 프랑스인이에요.",
          },
        ],
        vsEn:
          "영어 student, neighbor는 사람의 성별에 따라 형태가 바뀌지 않지만 프랑스어 étudiant/étudiante, voisin/voisine은 달라져요. 한국어도 '배우'처럼 보통 한 형태를 쓰므로 관사와 끝 철자를 함께 확인해야 해요.",
      },
      {
        heading: "-eur는 -euse 또는 -rice로 바뀌어요",
        pattern:
          "-eur → -euse 또는 -rice",
        patternKo:
          "직업·역할 명사에서 자주 만나는 두 여성형",
        body:
          "-eur로 끝나는 사람 명사는 여성형이 **-euse**나 **-rice**가 되는 경우가 많아요. vendeur → vendeuse, serveur → serveuse가 첫째 유형이고, acteur → actrice가 둘째 유형이에요.\n\n" +
          "두 유형을 철자만 보고 완벽하게 예측하기는 어려워요. 새 직업 명사는 남성형과 여성형을 한 쌍으로 익히세요.",
        table: {
          caption: "자주 쓰는 사람 명사의 성별 짝",
          headers: ["남성형", "여성형", "뜻"],
          rows: [
            ["un vendeur", "une vendeuse", "판매원"],
            ["un serveur", "une serveuse", "서빙 직원"],
            ["un acteur", "une actrice", "배우"],
            ["un lecteur", "une lectrice", "독자"],
          ],
        },
        examples: [
          {
            fr: "La vendeuse parle français.",
            ipa: "[la vɑ̃døz paʁl fʁɑ̃sɛ]",
            ko: "그 여성 판매원은 프랑스어를 해요.",
          },
          {
            fr: "Le serveur apporte de l'eau.",
            ipa: "[lə sɛʁvœʁ apɔʁt də lo]",
            ko: "그 남성 서빙 직원은 물을 가져와요.",
          },
          {
            fr: "Cette lectrice aime le livre.",
            ipa: "[sɛt lɛktʁis ɛm lə livʁ]",
            ko: "이 여성 독자는 그 책을 좋아해요.",
          },
        ],
        pitfall:
          "모든 -eur 명사를 기계적으로 -euse로 바꾸면 안 돼요. acteur의 여성형은 acteuse가 아니라 **actrice**예요. 사전에서 여성형 표기를 함께 확인하세요.",
      },
      {
        heading: "기본 복수 — 철자에는 -s, 소리에는 거의 변화 없음",
        pattern:
          "단수 명사 + s → 복수 명사",
        patternKo:
          "대부분의 명사는 -s를 붙이되 끝 s는 묵음",
        body:
          "대부분의 명사는 단수형에 **-s**를 붙여 복수를 만들어요. 하지만 끝 s는 보통 묵음이라 livre와 livres의 명사 자체 발음은 같아요.\n\n" +
          "그래서 복수 여부는 소리에서 관사로 먼저 드러나요. un livre [œ̃ livʁ]와 des livres [de livʁ]처럼 **관사까지 한 덩어리로** 말해야 해요.",
        examples: [
          {
            fr: "un livre → des livres",
            ipa: "[œ̃ livʁ → de livʁ]",
            ko: "책 한 권 → 책 여러 권",
          },
          {
            fr: "une question → des questions",
            ipa: "[yn kɛstjɔ̃ → de kɛstjɔ̃]",
            ko: "질문 하나 → 질문 여러 개",
          },
          {
            fr: "Les étudiantes arrivent.",
            ipa: "[lez etydjɑ̃t aʁiv]",
            ko: "여학생들이 도착해요.",
            note: "les의 [z] 리에종이 복수를 들려줘요.",
          },
        ],
        tip:
          "받아쓰기에서는 끝 s가 안 들리므로 관사와 동사 형태가 단서예요. les/des를 들었으면 뒤 명사의 복수 -s를 눈으로 챙기는 습관을 들이세요.",
      },
      {
        heading: "-eau는 -x, -al은 -aux — 자주 쓰는 복수 예외",
        pattern:
          "-eau/-au/-eu → -x · -al → -aux · 끝 -s/-x/-z → 변화 없음",
        patternKo:
          "복수형의 대표 철자 변화 세 묶음",
        body:
          "-eau, -au, -eu로 끝나는 명사는 주로 **-x**를 붙이고, -al은 주로 **-aux**로 바뀌어요: bateau → bateaux, journal → journaux.\n\n" +
          "이미 -s, -x, -z로 끝나면 철자는 그대로예요: un prix → des prix. festival → festivals처럼 -al인데도 -s를 붙이는 예외도 있어요.",
        table: {
          caption: "대표 복수형",
          headers: ["단수", "복수", "규칙"],
          rows: [
            ["un bateau", "des bateaux", "-eau → -eaux"],
            ["un journal", "des journaux", "-al → -aux"],
            ["un animal", "des animaux", "-al → -aux"],
            ["un prix", "des prix", "끝 -x라 변화 없음"],
            ["un festival", "des festivals", "-al 예외: +s"],
          ],
        },
        examples: [
          {
            fr: "Les bateaux arrivent.",
            ipa: "[le bato aʁiv]",
            ko: "배들이 도착해요.",
          },
          {
            fr: "Il y a deux journaux.",
            ipa: "[ilja dø ʒuʁno]",
            ko: "신문이 두 부 있어요.",
          },
          {
            fr: "Les prix sont différents.",
            ipa: "[le pʁi sɔ̃ difeʁɑ̃]",
            ko: "가격들이 달라요.",
          },
        ],
        pitfall:
          "-al → -aux는 강력한 규칙이지만 전부는 아니에요. festival, bal, carnaval 같은 자주 쓰는 예외는 **-s**를 붙여요. 규칙을 적용한 뒤 사전의 복수형도 한 번 확인하세요.",
      },
    ],
  },

  // DRAFT: 기존 관사 입문·부분관사·aller의 au/aux를 재설명하지 않고, de 축약의 두 정체와 나라명 체계를 연결한다.
  {
    slug: "a1-draft-17-article-contractions-countries",
    level: "A1",
    order: 17,
    title: "du는 빵 앞과 박물관 뒤에서 달라요",
    topic: "de의 관사 축약·나라명 전치사",
    titleFr: "Les contractions avec de et les noms de pays",
    summary:
      "de+le/les의 축약형 du/des를 부분관사와 구별하고, 나라의 성·수에 맞춰 목적지와 출발지를 말해요.",
    duration: "약 10분",
    sections: [
      {
        heading: "de와 정관사가 만나면 du, des",
        pattern:
          "de + le → du · de + les → des · de la / de l'는 그대로",
        patternKo:
          "'~의, ~에서' de가 정관사와 만나는 축약",
        body:
          "전치사 **de** 뒤에 정관사 le나 les가 오면 반드시 합쳐져요. de le는 **du**, de les는 **des**가 되고, de la와 de l'는 그대로 써요.\n\n" +
          "이 de는 소유·관계의 '~의', 출발점의 '~에서', 화제의 '~에 관해'처럼 앞뒤 관계를 만들어요.",
        table: {
          caption: "de + 정관사",
          headers: ["결합 전", "결합 후", "예"],
          rows: [
            ["de + le", "du", "du musée"],
            ["de + la", "de la", "de la gare"],
            ["de + l'", "de l'", "de l'hôtel"],
            ["de + les", "des", "des voisins"],
          ],
        },
        examples: [
          {
            fr: "La porte du musée est ouverte.",
            ipa: "[la pɔʁt dy myze ɛt uvɛʁt]",
            ko: "그 박물관의 문은 열려 있어요.",
          },
          {
            fr: "Je reviens de la gare.",
            ipa: "[ʒə ʁəvjɛ̃ də la gaʁ]",
            ko: "저는 역에서 돌아와요.",
          },
          {
            fr: "Nous parlons des livres.",
            ipa: "[nu paʁlɔ̃ de livʁ]",
            ko: "우리는 그 책들에 관해 이야기해요.",
          },
        ],
        tip:
          "du를 보면 머릿속에서 한 번 **de + le**로, des를 보면 **de + les**로 펼쳐 보세요. 앞 동사나 명사가 de를 요구하는지 확인하면 관계가 또렷해져요.",
      },
      {
        heading: "du와 des의 두 얼굴을 문맥으로 가려요",
        pattern:
          "du = de+le 또는 부분관사 · des = de+les 또는 복수 부정관사",
        patternKo:
          "같은 철자라도 앞말이 요구한 de인지 확인",
        body:
          "**du**는 de+le의 축약일 수도 있고, 셀 수 없는 일부를 나타내는 부분관사일 수도 있어요. **des**도 de+les의 축약 또는 복수 부정관사라는 두 역할이 있어요.\n\n" +
          "구별법은 앞말이에요. revenir de(어디에서 돌아오다), parler de(~에 관해 말하다)가 de를 요구하면 축약이고, 먹는 대상이나 처음 소개하는 복수 명사 앞이면 관사일 가능성이 커요.",
        examples: [
          {
            fr: "Je reviens du marché.",
            ipa: "[ʒə ʁəvjɛ̃ dy maʁʃe]",
            ko: "저는 그 시장에서 돌아와요.",
            note: "du = de + le",
          },
          {
            fr: "Je mange du pain.",
            ipa: "[ʒə mɑ̃ʒ dy pɛ̃]",
            ko: "저는 빵을 먹어요.",
            note: "du = 셀 수 없는 일부를 나타내는 부분관사",
          },
          {
            fr: "Je parle des voisins.",
            ipa: "[ʒə paʁl de vwazɛ̃]",
            ko: "저는 그 이웃들에 관해 말해요.",
            note: "des = de + les",
          },
          {
            fr: "J'ai des voisins sympathiques.",
            ipa: "[ʒe de vwazɛ̃ sɛ̃patik]",
            ko: "저에게는 친절한 이웃들이 있어요.",
            note: "des = 복수 부정관사",
          },
        ],
        pitfall:
          "철자가 같다고 뜻까지 같지는 않아요. 특히 parler du café는 '그 커피에 관해 말하다'일 수 있고 boire du café는 '커피를 마시다'예요. **앞 동사가 de를 요구하는지** 먼저 보세요.",
      },
      {
        heading: "어디로 가는지 — en, au, aux",
        pattern:
          "en + 여성/모음 시작 나라 · au + 남성 나라 · aux + 복수 나라",
        patternKo:
          "나라의 성·수에 맞추는 목적지 전치사",
        body:
          "도시는 à Paris처럼 **à + 도시명**으로 말하지만, 나라는 성과 수를 봐야 해요. 여성 나라와 모음으로 시작하는 나라는 **en**, 남성 나라는 **au**, 복수 나라는 **aux**를 써요.\n\n" +
          "많은 여성 나라 이름은 -e로 끝나지만 le Mexique처럼 -e로 끝나는 남성 예외도 있어요. 나라명은 관사까지 함께 익히는 편이 안전해요.",
        examples: [
          {
            fr: "Je vais en France.",
            ipa: "[ʒə vɛ ɑ̃ fʁɑ̃s]",
            ko: "저는 프랑스에 가요.",
          },
          {
            fr: "Nous habitons au Canada.",
            ipa: "[nuzabitɔ̃ o kanada]",
            ko: "우리는 캐나다에 살아요.",
          },
          {
            fr: "Elle voyage aux Pays-Bas.",
            ipa: "[ɛl vwajaʒ o peiba]",
            ko: "그녀는 네덜란드를 여행해요.",
          },
          {
            fr: "Il étudie en Italie.",
            ipa: "[il etydi ɑ̃n itali]",
            ko: "그는 이탈리아에서 공부해요.",
            note: "모음 시작 나라라 en",
          },
        ],
        vsEn:
          "영어는 in/to 하나로 대부분의 나라를 처리하지만, 프랑스어는 나라의 성·수에 따라 en/au/aux를 골라요. 그래서 le Canada, la France처럼 나라 이름도 관사와 한 덩어리로 외워야 해요.",
      },
      {
        heading: "어디에서 오는지 — de, du, des",
        pattern:
          "de/d' + 여성/모음 시작 나라 · du + 남성 나라 · des + 복수 나라",
        patternKo:
          "출발지·출신도 나라의 성·수에 맞추기",
        body:
          "출발지나 출신을 말할 때 여성 나라 앞에서는 **de**, 모음 앞에서는 **d'**, 남성 나라 앞에서는 **du**, 복수 나라 앞에서는 **des**를 써요.\n\n" +
          "목적지 en/au/aux와 출발지 de/du/des를 짝으로 외우면 좋아요: en France ↔ de France, au Canada ↔ du Canada.",
        examples: [
          {
            fr: "Je viens de Corée.",
            ipa: "[ʒə vjɛ̃ də kɔʁe]",
            ko: "저는 한국에서 왔어요.",
          },
          {
            fr: "Il vient du Canada.",
            ipa: "[il vjɛ̃ dy kanada]",
            ko: "그는 캐나다에서 왔어요.",
          },
          {
            fr: "Nous venons d'Italie.",
            ipa: "[nu vənɔ̃ ditali]",
            ko: "우리는 이탈리아에서 왔어요.",
          },
          {
            fr: "Elles viennent des Pays-Bas.",
            ipa: "[ɛl vjɛn de peiba]",
            ko: "그녀들은 네덜란드에서 왔어요.",
          },
        ],
        tip:
          "작은 표를 두 줄로 만들어 외워보세요. **목적지: en/au/aux**, **출발지: de/du/des**. 같은 나라를 두 방향으로 말하면 성·수 체계가 빠르게 자리 잡아요.",
      },
    ],
  },

  // DRAFT: 기존 정·부정·소유 관사/형용사와 분리해 지시·의문 한정사만 다룬다.
  {
    slug: "a1-draft-18-demonstrative-interrogative",
    level: "A1",
    order: 18,
    title: "\"이 가방\"과 \"어느 가방\"을 골라 말해요",
    topic: "지시 한정사 ce·의문 한정사 quel",
    titleFr: "Les déterminants démonstratifs et interrogatifs",
    summary:
      "ce/cet/cette/ces로 대상을 가리키고, quel/quelle/quels/quelles로 어느 것인지 물어요.",
    duration: "약 8분",
    sections: [
      {
        heading: "ce, cet, cette, ces — 명사의 성·수에 맞춰요",
        pattern:
          "ce + 남성 · cet + 남성 모음 앞 · cette + 여성 · ces + 복수",
        patternKo:
          "'이/그'를 뜻하며 뒤 명사의 성·수에 일치",
        body:
          "명사 앞의 **ce/cet/cette/ces**는 '이, 그, 저'처럼 대상을 가리켜요. 남성 단수는 ce, 모음이나 무음 h로 시작하는 남성 단수는 cet, 여성 단수는 cette, 모든 복수는 ces예요.\n\n" +
          "한국어 '이'는 한 형태지만 프랑스어는 뒤 명사의 성·수와 첫소리까지 확인해야 해요.",
        table: {
          caption: "지시 한정사",
          headers: ["명사", "형태", "예"],
          rows: [
            ["남성 단수", "ce", "ce livre"],
            ["남성 단수 + 모음/무음 h", "cet", "cet appartement"],
            ["여성 단수", "cette", "cette rue"],
            ["복수", "ces", "ces photos"],
          ],
        },
        examples: [
          {
            fr: "Je choisis ce livre.",
            ipa: "[ʒə ʃwazi sə livʁ]",
            ko: "저는 이 책을 고를게요.",
          },
          {
            fr: "Cet appartement est petit.",
            ipa: "[sɛt apaʁtəmɑ̃ ɛ pəti]",
            ko: "이 아파트는 작아요.",
          },
          {
            fr: "Cette rue est calme.",
            ipa: "[sɛt ʁy ɛ kalm]",
            ko: "이 거리는 조용해요.",
          },
          {
            fr: "Ces photos sont belles.",
            ipa: "[se foto sɔ̃ bɛl]",
            ko: "이 사진들은 아름다워요.",
          },
        ],
        pitfall:
          "cet은 여성형이 아니에요. **모음 충돌을 피하기 위한 남성 단수형**이에요. appartement가 남성이라 cet appartement, école이 여성이라 cette école라고 해요.",
      },
      {
        heading: "-ci와 -là로 '이쪽'과 '저쪽'을 또렷하게",
        pattern:
          "ce/cette/ces + 명사 + -ci / -là",
        patternKo:
          "가까운 것은 -ci, 먼 것·대조되는 것은 -là",
        body:
          "ce/cette/ces만으로는 영어 this와 that을 꼭 구별하지 않아요. 둘을 분명히 가르고 싶을 때 명사 뒤에 **-ci**(이쪽)나 **-là**(저쪽)를 붙여요.\n\n" +
          "두 물건을 비교하며 ce sac-ci, ce sac-là라고 하면 '이 가방, 저 가방'이 선명해져요.",
        examples: [
          {
            fr: "Je préfère ce sac-ci.",
            ipa: "[ʒə pʁefɛʁ sə sak si]",
            ko: "저는 이쪽 가방이 더 좋아요.",
          },
          {
            fr: "Nous regardons cette maison-là.",
            ipa: "[nu ʁəɡaʁdɔ̃ sɛt mɛzɔ̃ la]",
            ko: "우리는 저쪽 집을 봐요.",
          },
          {
            fr: "Ces chaussures-ci sont confortables.",
            ipa: "[se ʃosyʁ si sɔ̃ kɔ̃fɔʁtabl]",
            ko: "이쪽 신발들은 편안해요.",
          },
        ],
        vsEn:
          "영어는 처음부터 this/that을 골라야 하지만 프랑스어 ce/cette/ces는 가까움과 멂을 기본 형태에서 나누지 않아요. 구별이 필요할 때만 뒤에 -ci/-là를 덧붙여요.",
      },
      {
        heading: "quel, quelle, quels, quelles — 어느 것인지 물어요",
        pattern:
          "quel/quelle/quels/quelles + 명사 ?",
        patternKo:
          "'어느/무슨'도 뒤 명사의 성·수에 일치",
        body:
          "**quel**은 '어느, 무슨'을 뜻하고 뒤 명사의 성·수에 맞춰 quelle, quels, quelles로 바뀌어요. 답하는 사람의 성이 아니라 **질문 속 명사**가 기준이에요.\n\n" +
          "명사 바로 앞에도 쓰고, être 앞에도 쓸 수 있어요: Quel livre...? / Quel est votre numéro ?",
        table: {
          caption: "의문 한정사",
          headers: ["", "단수", "복수"],
          rows: [
            ["남성", "quel", "quels"],
            ["여성", "quelle", "quelles"],
          ],
        },
        examples: [
          {
            fr: "Quel livre préférez-vous ?",
            ipa: "[kɛl livʁ pʁefeʁe vu]",
            ko: "어느 책을 더 좋아하세요?",
          },
          {
            fr: "Quelle couleur aimez-vous ?",
            ipa: "[kɛl kulœʁ eme vu]",
            ko: "어느 색을 좋아하세요?",
          },
          {
            fr: "Quels jours travaillez-vous ?",
            ipa: "[kɛl ʒuʁ tʁavaje vu]",
            ko: "어느 요일에 일하세요?",
          },
          {
            fr: "Quel est votre numéro ?",
            ipa: "[kɛl ɛ vɔtʁ nymeʁo]",
            ko: "번호가 어떻게 되세요?",
          },
        ],
        tip:
          "질문을 만들기 전에 핵심 명사를 먼저 찾으세요. livre는 남성 단수라 quel, couleur는 여성 단수라 quelle이에요. 한국어 뜻 '어느'만 보고 형태를 고르면 놓치기 쉬워요.",
      },
    ],
  },

  // DRAFT: 기존 도시·나라 방향 전치사와 분리해, 사물의 위치와 사람의 공간을 나타내는 전치사만 다룬다.
  {
    slug: "a1-draft-19-place-prepositions",
    level: "A1",
    order: 19,
    title: "\"탁자 아래, 역 맞은편\"을 한 번에 찾아요",
    topic: "장소 전치사·chez",
    titleFr: "Les prépositions de lieu et chez",
    summary:
      "dans, sur, sous부터 devant, derrière, à côté de까지 사물과 장소의 위치를 설명하고 chez로 사람의 공간을 말해요.",
    duration: "약 9분",
    sections: [
      {
        heading: "dans, sur, sous — 안, 위, 아래",
        pattern:
          "dans + 안 · sur + 위 · sous + 아래",
        patternKo:
          "기준 물체와의 가장 기본적인 위치 세 가지",
        body:
          "**dans**는 경계 안, **sur**는 표면 위, **sous**는 아래를 나타내요. 모두 뒤에 기준이 되는 명사를 놓아요.\n\n" +
          "한국어는 '탁자 위에'처럼 명사 뒤에 위치말을 놓지만, 프랑스어는 **sur la table**처럼 명사 앞에 전치사를 놓아요.",
        examples: [
          {
            fr: "Le sac est dans la voiture.",
            ipa: "[lə sak ɛ dɑ̃ la vwatyʁ]",
            ko: "가방은 자동차 안에 있어요.",
          },
          {
            fr: "Le livre est sur la table.",
            ipa: "[lə livʁ ɛ syʁ la tabl]",
            ko: "책은 탁자 위에 있어요.",
          },
          {
            fr: "Le chat est sous la chaise.",
            ipa: "[lə ʃa ɛ su la ʃɛz]",
            ko: "고양이는 의자 아래에 있어요.",
          },
        ],
        vsEn:
          "영어 in/on/under와 프랑스어 dans/sur/sous는 어순과 기본 공간 그림이 거의 같아요. in the car = dans la voiture, on the table = sur la table처럼 대응시켜 익힐 수 있어요.",
        enParallel: {
          rows: [
            {
              en: "The bag is **in** the car.",
              fr: "Le sac est **dans** la voiture.",
              ko: "가방은 자동차 안에 있어요.",
            },
            {
              en: "The book is **on** the table.",
              fr: "Le livre est **sur** la table.",
              ko: "책은 탁자 위에 있어요.",
            },
            {
              en: "The cat is **under** the chair.",
              fr: "Le chat est **sous** la chaise.",
              ko: "고양이는 의자 아래에 있어요.",
            },
          ],
          note:
            "두 언어 모두 **전치사 + 관사 + 명사** 순서로 위치를 만들어요.",
        },
      },
      {
        heading: "devant, derrière, entre — 앞, 뒤, 사이",
        pattern:
          "devant + 앞 · derrière + 뒤 · entre A et B + A와 B 사이",
        patternKo:
          "두 장소의 앞뒤와 사이 관계 말하기",
        body:
          "**devant**은 앞, **derrière**는 뒤, **entre A et B**는 A와 B 사이예요. 길을 설명할 때 기준 장소를 함께 말하면 위치가 선명해져요.\n\n" +
          "entre 뒤에 두 대상을 놓을 때는 et로 연결해요. 한국어 '~와 ~ 사이'와 같은 구조예요.",
        examples: [
          {
            fr: "La gare est devant le parc.",
            ipa: "[la gaʁ ɛ dəvɑ̃ lə paʁk]",
            ko: "역은 공원 앞에 있어요.",
          },
          {
            fr: "La voiture est derrière la maison.",
            ipa: "[la vwatyʁ ɛ dɛʁjɛʁ la mɛzɔ̃]",
            ko: "자동차는 집 뒤에 있어요.",
          },
          {
            fr: "Le café est entre la gare et le parc.",
            ipa: "[lə kafe ɛ ɑ̃tʁ la gaʁ e lə paʁk]",
            ko: "카페는 역과 공원 사이에 있어요.",
          },
        ],
        tip:
          "내가 바라보는 방향보다 **기준 장소의 위치 관계**에 집중하세요. devant la gare는 '역을 기준으로 앞쪽', derrière la gare는 '역을 기준으로 뒤쪽'이에요.",
      },
      {
        heading: "옆과 맞은편 — de 뒤 관사까지 묶어요",
        pattern:
          "à côté de · en face de · près de · loin de + 장소",
        patternKo:
          "옆·맞은편·가까이·멀리 뒤에는 de",
        body:
          "**à côté de**는 옆, **en face de**는 맞은편, **près de**는 가까이, **loin de**는 멀리를 뜻해요. 네 표현 모두 끝의 de까지가 한 세트예요.\n\n" +
          "뒤에 le나 les가 오면 de+le=du, de+les=des 축약이 일어나요: à côté **du** marché, en face **des** magasins.",
        examples: [
          {
            fr: "La banque est à côté du marché.",
            ipa: "[la bɑ̃k ɛ a kote dy maʁʃe]",
            ko: "은행은 시장 옆에 있어요.",
          },
          {
            fr: "La gare est en face du musée.",
            ipa: "[la gaʁ ɛ ɑ̃ fas dy myze]",
            ko: "역은 박물관 맞은편에 있어요.",
          },
          {
            fr: "J'habite près de la gare.",
            ipa: "[ʒabit pʁɛ də la gaʁ]",
            ko: "저는 역 근처에 살아요.",
          },
          {
            fr: "L'hôtel est loin du centre.",
            ipa: "[lotɛl ɛ lwɛ̃ dy sɑ̃tʁ]",
            ko: "호텔은 중심가에서 멀어요.",
          },
        ],
        pitfall:
          "à côté, en face, près, loin만 쓰고 **de를 빼먹지 마세요**. 뒤에 장소가 오면 à côté de la gare, près du parc처럼 de와 관사까지 필요해요.",
      },
      {
        heading: "chez — 사람의 집·일터·전문 공간",
        pattern:
          "chez + 사람/강세형 대명사/직업",
        patternKo:
          "누군가의 집이나 그 사람이 일하는 공간에서",
        body:
          "**chez**는 사람을 기준으로 한 공간을 나타내요. chez un ami는 친구 집에서, chez le médecin은 의사가 일하는 진료 공간에서, chez moi는 우리 집에서라는 뜻이에요.\n\n" +
          "일반 건물에는 à를 써요: à la banque. 사람이나 직업을 기준으로 할 때 chez를 골라요.",
        examples: [
          {
            fr: "Je suis chez le médecin.",
            ipa: "[ʒə sɥi ʃe lə medsɛ̃]",
            ko: "저는 진료를 받으러 와 있어요.",
          },
          {
            fr: "Nous mangeons chez des amis.",
            ipa: "[nu mɑ̃ʒɔ̃ ʃe dezami]",
            ko: "우리는 친구들 집에서 식사해요.",
          },
          {
            fr: "Je reste chez moi ce soir.",
            ipa: "[ʒə ʁɛst ʃe mwa sə swaʁ]",
            ko: "저는 오늘 저녁 집에 있어요.",
          },
        ],
        pitfall:
          "chez 뒤에는 보통 장소명이 아니라 **사람·직업·강세형 대명사**가 와요. '은행에'는 chez la banque가 아니라 à la banque예요.",
      },
    ],
  },

  // DRAFT: 기존 부정·의문·시간 챕터와 분리해, 현재형 문장의 빈도·정도·수량·기초 연결 기능만 다룬다.
  {
    slug: "a1-draft-20-frequency-quantity-connectors",
    level: "A1",
    order: 20,
    title: "\"자주, 많이, 하지만\"으로 문장을 늘려요",
    topic: "빈도·정도·수량 부사와 기초 연결어",
    titleFr: "La fréquence, la quantité et les connecteurs simples",
    summary:
      "toujours·souvent으로 빈도를, très·beaucoup로 정도와 양을 말하고 et·mais·parce que로 짧은 문장을 연결해요.",
    duration: "약 10분",
    sections: [
      {
        heading: "얼마나 자주 — 동사 뒤에 빈도 부사",
        pattern:
          "주어 + 현재형 동사 + toujours/souvent/parfois/rarement",
        patternKo:
          "항상·자주·가끔·드물게를 현재형 동사 뒤에",
        body:
          "**toujours**(항상), **souvent**(자주), **parfois**(가끔), **rarement**(드물게)은 행동의 빈도를 말해요. 기본 현재형 문장에서는 대체로 활용한 동사 뒤에 놓아요.\n\n" +
          "한국어는 '자주 운동해요'처럼 동사 앞에 두지만, 프랑스어는 Je fais **souvent** du sport처럼 동사 뒤가 자연스러워요.",
        examples: [
          {
            fr: "Il arrive toujours à huit heures.",
            ipa: "[il aʁiv tuʒuʁ a ɥitœʁ]",
            ko: "그는 항상 8시에 도착해요.",
          },
          {
            fr: "Je travaille souvent le soir.",
            ipa: "[ʒə tʁavaj suvɑ̃ lə swaʁ]",
            ko: "저는 저녁에 자주 일해요.",
          },
          {
            fr: "Nous mangeons parfois dehors.",
            ipa: "[nu mɑ̃ʒɔ̃ paʁfwa dəɔʁ]",
            ko: "우리는 가끔 밖에서 먹어요.",
          },
          {
            fr: "Elle regarde rarement la télévision.",
            ipa: "[ɛl ʁəɡaʁd ʁaʁmɑ̃ la televizjɔ̃]",
            ko: "그녀는 텔레비전을 드물게 봐요.",
          },
        ],
        pitfall:
          "한국어 어순을 따라 souvent를 동사 앞에 고정하지 마세요. A1의 단순 현재형에서는 **활용 동사 뒤**가 기본이에요: Je parle souvent français.",
      },
      {
        heading: "très와 beaucoup — 무엇을 꾸미는지가 달라요",
        pattern:
          "très + 형용사/부사 · 동사 + beaucoup",
        patternKo:
          "상태·방식은 très, 행동의 정도는 beaucoup",
        body:
          "**très**는 형용사나 부사를 꾸며 '매우'를 만들고, **beaucoup**는 동사를 꾸며 '많이'를 만들어요. très bon, très vite이지만 aimer beaucoup라고 해요.\n\n" +
          "둘 다 한국어로 '아주, 많이'가 될 수 있어 번역만 보고 고르기 어려워요. 바로 뒤나 앞의 품사를 확인하세요.",
        examples: [
          {
            fr: "Ce livre est très intéressant.",
            ipa: "[sə livʁ ɛ tʁɛz ɛ̃teʁesɑ̃]",
            ko: "이 책은 매우 흥미로워요.",
          },
          {
            fr: "Vous parlez très vite.",
            ipa: "[vu paʁle tʁɛ vit]",
            ko: "말씀을 매우 빨리 하세요.",
          },
          {
            fr: "J'aime beaucoup ce quartier.",
            ipa: "[ʒɛm boku sə kaʁtje]",
            ko: "저는 이 동네를 아주 좋아해요.",
          },
        ],
        vsEn:
          "영어 very는 형용사·부사 앞, a lot은 동사 뒤에 오는 것처럼 프랑스어 très와 beaucoup도 역할이 나뉘어요. very interesting = très intéressant, like it a lot = aimer beaucoup처럼 대응돼요.",
      },
      {
        heading: "명사의 양 — beaucoup de, un peu de, trop de",
        pattern:
          "beaucoup/un peu/trop + de + 명사",
        patternKo:
          "많은·조금의·너무 많은 뒤에는 성·수와 관계없이 de",
        body:
          "명사의 양을 말할 때는 **beaucoup de**(많은), **un peu de**(조금의), **trop de**(너무 많은)를 써요. 뒤 명사가 남성인지 여성인지, 단수인지 복수인지와 관계없이 de를 유지해요.\n\n" +
          "모음 앞에서는 d'로 줄어요: beaucoup d'eau, un peu d'huile.",
        examples: [
          {
            fr: "Je bois beaucoup d'eau.",
            ipa: "[ʒə bwa boku do]",
            ko: "저는 물을 많이 마셔요.",
          },
          {
            fr: "Nous avons un peu de temps.",
            ipa: "[nuzavɔ̃ œ̃ pø də tɑ̃]",
            ko: "우리에게는 시간이 조금 있어요.",
          },
          {
            fr: "Il y a trop de voitures.",
            ipa: "[ilja tʁo də vwatyʁ]",
            ko: "자동차가 너무 많아요.",
          },
        ],
        pitfall:
          "beaucoup 뒤에 바로 du/de la/des를 붙이지 마세요. **beaucoup de pain, beaucoup de questions**처럼 양 표현 뒤에서는 de 하나로 통일해요.",
      },
      {
        heading: "et, ou, mais — 더하고, 고르고, 반전해요",
        pattern:
          "A et B · A ou B · A, mais B",
        patternKo:
          "그리고·또는·하지만으로 두 정보 연결",
        body:
          "**et**는 정보를 더하고, **ou**는 선택지를 나누고, **mais**는 앞내용과 다른 방향을 이어줘요. 짧은 문장 둘을 연결하면 말이 자연스럽게 길어져요.\n\n" +
          "프랑스어 ou(또는)에는 악상이 없고, où(어디)에는 악상이 있어요. 소리는 둘 다 [u]라 문맥과 철자로 구별해요.",
        examples: [
          {
            fr: "Je parle français et anglais.",
            ipa: "[ʒə paʁl fʁɑ̃sɛ e ɑ̃ɡlɛ]",
            ko: "저는 프랑스어와 영어를 해요.",
          },
          {
            fr: "Vous voulez du thé ou du café ?",
            ipa: "[vu vule dy te u dy kafe]",
            ko: "차와 커피 중 무엇을 원하세요?",
          },
          {
            fr: "Le livre est petit, mais intéressant.",
            ipa: "[lə livʁ ɛ pəti mɛ ɛ̃teʁesɑ̃]",
            ko: "그 책은 작지만 흥미로워요.",
          },
        ],
        tip:
          "ou와 où는 발음으로 구별할 수 없어요. 글에서는 **장소를 묻는 où에만 악상**이 있다고 기억하세요.",
      },
      {
        heading: "parce que와 pour — 이유와 목적을 붙여요",
        pattern:
          "문장 + parce que + 문장 · pour + 동사 원형",
        patternKo:
          "이유 뒤에는 문장, 목적 뒤에는 동사 원형",
        body:
          "**parce que**는 '왜냐하면'이라는 이유를 이어서 뒤에 주어와 활용 동사가 있는 문장을 놓아요. **pour + 동사 원형**은 '~하기 위해'라는 목적을 짧게 붙여요.\n\n" +
          "이유와 목적은 비슷해 보여도 구조가 달라요: parce que je travaille(제가 일하기 때문에), pour travailler(일하기 위해).",
        examples: [
          {
            fr: "Je reste ici parce que je travaille.",
            ipa: "[ʒə ʁɛst isi paʁs kə ʒə tʁavaj]",
            ko: "저는 일하기 때문에 여기 있어요.",
          },
          {
            fr: "Elle étudie le français parce qu'elle habite en France.",
            ipa: "[ɛl etydi lə fʁɑ̃sɛ paʁs kɛl abit ɑ̃ fʁɑ̃s]",
            ko: "그녀는 프랑스에 살기 때문에 프랑스어를 공부해요.",
          },
          {
            fr: "Nous allons à la bibliothèque pour étudier.",
            ipa: "[nuzalɔ̃ a la biblijɔtɛk puʁ etydje]",
            ko: "우리는 공부하러 도서관에 가요.",
          },
        ],
        pitfall:
          "pour 뒤에서 동사를 활용하지 마세요. **pour étudier**가 맞고 pour étudions는 틀려요. parce que 뒤에는 완전한 문장, pour 뒤에는 원형이라는 대비를 기억하세요.",
      },
    ],
  },
];

export default chapters;
