# 프랑스어 레퍼런스 콘텐츠 형식 (French Reference Schema)

중추 레퍼런스 = **문법**(`grammar/<level>.js`) + **어휘**(`vocab/<level>.js`).
레벨: A0(입문 상식) → A1 → A2 → B1 → B2 → C1 → C2.
`index.js`가 전체를 레지스트리로 묶음. 콘텐츠는 코드가 단일 소스 (DB 불필요).

대상 독자: **한국어 모어 화자**, 영어 B1 수준 가정.
- 설명은 전부 한국어. 부드러운 해요체 (강의 lessons 톤과 동일).
- 영어 어휘/문법 지식을 지렛대로 활용하되 **남발 금지** — 진짜 도움될 때만 `vsEn`/`etym` 사용.
- 한국인이 특히 헷갈리는 지점은 `pitfall`로 명시적으로 처리.

## 문법 챕터 (grammar/<level>.js)

`export default [ chapter, chapter, ... ]` — order 순 배열.

```js
{
  slug: 'a1-04-negation',       // 필수. 전체에서 유일. '<level>-<번호>-<영문키워드>'
  level: 'A1',                  // 'A0'|'A1'|'A2'|'B1'|'B2'|'C1'|'C2'
  order: 4,                     // 레벨 내 순서 (학습 순서)

  // ── 제목 체계: 훅이 주인공, 용어는 라벨 ──
  title: '"커피는 안 마셔요" — 아니라고 말하기',  // 훅 (8~20자) — 배우면 할 수 있는 말/깨달음
  // 작법: 1순위 따옴표 실표현형 · 2순위 호기심 질문/선언형(개념 챕터)
  //       금지: 문법 용어 재등장, 추상 구호, 22자 초과
  topic: '부정문 ne…pas',        // 문법 용어 라벨 — 목록 우측·헤더 보조줄·SEO에 표시
  titleFr: 'La négation',       // 프랑스어 원어 제목

  summary: '한 줄 요약 — 챕터 목록 카드에 표시',
  duration: '약 8분',

  sections: [
    {
      heading: '소제목',

      // 핵심 패턴 (강력 권장) — 섹션이 가르치는 공식을 한 줄로.
      // 챕터 상단 '핵심 패턴 한눈에' 박스와 섹션 상단 공식 박스에 크게 표시됨.
      pattern: 'ne + 동사 + pas',          // 표기: 원어와 한국어 라벨 혼용, + / → 활용
      patternKo: '동사를 샌드위치처럼 감싸는 부정',  // 선택: 한 줄 글로스

      body: '한국어 설명. 빈 줄(\\n\\n)로 문단 구분. **굵게** 마크업만 지원.',

      // 예문 (선택) — 해당 레벨까지 배운 어휘·문법만 사용할 것
      examples: [
        { fr: 'Je suis coréenne.', ipa: '[ʒə sɥi kɔʁeɛn]', ko: '저는 한국인이에요. (여성)', note: '선택: 짧은 부가 설명' },
      ],

      // 표 (선택) — 활용표 등
      table: {
        caption: 'être 직설법 현재',          // 선택
        headers: ['인칭', '형태', '발음'],
        rows: [ ['je', 'suis', '[sɥi]'], ['tu', 'es', '[ɛ]'] ],
      },

      // 콜아웃 (각각 선택, 문자열, **굵게** 지원)
      pitfall: '한국인이 자주 틀리는/헷갈리는 점',       // 🚨 주황 띠
      vsEn:    '영어와의 유사점·차이점',                 // 🇬🇧 파랑 띠
      etym:    '라틴어 뿌리 — 영어 동족어와의 연결',      // 🌱 초록 띠
      tip:     '보너스 팁·암기 요령',                   // 💡 보라 띠
    },
  ],
}
```

### 가이드라인
- 챕터당 sections 3~5개. 섹션당 examples 2~5개.
- **패턴 우선 원칙**: 구체적 문형을 가르치는 섹션에는 반드시 `pattern` 한 줄.
  본문은 패턴을 보고도 남는 의문에 답하는 **부가 설명** — 스토리텔링·수사적 도입부 금지.
- **body 간결성**: 문단 최대 2개, 문단당 2~3문장. 핵심 용어·형태는 **굵게** (형광펜 강조로 렌더링됨).
  개념 도입 챕터(오리엔테이션 등)는 예외적으로 3문단까지.
- **예문은 해당 레벨에 맞는 어휘·표현만** — A1 챕터에 subjonctif 금지.
- 예문에는 가급적 ipa 병기 (A0~A2 필수, B1+ 선택).
- 콜아웃은 챕터 전체에서 3~5개 정도. 한 섹션에 모두 때려넣지 말 것.
- `etym`은 라틴어 뿌리가 같아 영어 단어로 뜻을 유추할 수 있을 때만.
  예: "arriver ← 라틴어 ad rīpam(강기슭에 닿다). 영어 arrive와 같은 뿌리예요."
- `vsEn`은 구조 비교가 이해를 단축할 때만.
  예: "영어 현재완료(have+p.p.)와 형태는 같지만, passé composé는 그냥 과거시제로 써요."

### JS 문자열 규칙 (중요)
- 프랑스어 아포스트로프(l'eau, c'est, j'ai)가 흔하므로 **콘텐츠 문자열은 작은따옴표 대신 큰따옴표** 사용을 기본으로.
- 또는 작은따옴표 사용 시 반드시 `\'` 이스케이프.
- 검증: `node -e "import('./src/content/french/grammar/a1.js').then(m=>console.log(m.default.length))"`

## 어휘 (vocab/<level>.js)

```js
export default {
  level: 'A1',
  title: 'A1 기초 어휘',
  desc: '한 줄 소개',
  themes: [
    {
      name: '가족과 사람', icon: '👨‍👩‍👧',
      words: [
        {
          fr: 'la famille',          // 명사는 관사 포함해서 (성 암기 습관)
          ipa: '[famij]',
          ko: '가족',
          pos: 'n.f.',               // n.m. | n.f. | v. | adj. | adv. | prep. | expr. 등
          en: 'family',              // 선택: 영어 동족어가 있을 때만
          etym: '라틴어 familia — 영어 family와 같은 뿌리',  // 선택: 도움될 때만
          ex: { fr: 'Ma famille habite à Séoul.', ko: '우리 가족은 서울에 살아요.' },  // 선택
        },
      ],
    },
  ],
}
```

### 가이드라인
- 테마 4~8개로 묶기. 테마당 단어 8~20개.
- 명사는 항상 관사 포함 (`le livre`, `l'eau (f.)` — 모음 축약 시 성 괄호 표기).
- `en`/`etym`은 동족어가 명확할 때만 (faux amis는 etym에 경고로 활용 가능).
- 레벨 어휘량 가이드: A0 ~40 / A1 ~100 / A2 ~100 / B1 ~80 / B2 ~80 / C1 ~60 / C2 ~50.

## 품질 루브릭 (100점) — 모든 언어 레퍼런스 공통 기준

| 항목 | 배점 | 합격 기준 |
|---|---|---|
| 구조 | 20 | 챕터당 sections 3~5 · 활용표 등 table 적재적소 · meta(summary/duration/원어 제목) 완비 |
| 예문 | 30 | 섹션당 2~5개 · **그 레벨까지의 어휘·문법만 사용** · 발음 표기(입문~초급 100%) · 자연스러운 한국어 번역 |
| 한국인 맞춤 | 25 | 챕터당 pitfall ≥1 · 모어 간섭(한글 표기·조사 감각·없는 범주)을 명시적으로 처리 |
| 지식 연결 | 15 | 기존 지식(영어·한자어) 연결 콜아웃 — 남발 없이 챕터당 1~2개, 진짜 도움될 때만 |
| 톤·일관성 | 10 | 해요체 · 용어 통일 · 콜아웃 3~5개/챕터, 한 섹션에 몰지 않기 |

어휘 합격선: 발음 표기 100% · 명사 관사(또는 성 정보) 100% · 어원 연결 20~50% · 예문 ≥30%.

## 문형 사전 (bunkei/<level>.js) — DELF 전수 커버 레이어

챕터가 '이해'라면 문형 사전은 '전수 검색'. 해당 레벨의 핵심 구문·표현을 빠짐없이 수록한다.
(일본어 `src/content/japanese/SCHEMA.md`의 문형 사전과 같은 구조 — 렌더러 공용)

```js
export default {
  level: 'A1',
  title: 'A1 문형 사전',
  desc: '한 줄 소개',
  themes: [
    {
      name: '부정·금지', icon: '🚫',
      items: [
        {
          pattern: 'ne … pas',                    // 문형 (대표 표기)
          conn: 'ne + 동사 + pas',                 // 구조·접속
          ko: '~하지 않다 (기본 부정)',              // 한국어 대응 (간결)
          ex:  { fr: 'Je ne parle pas anglais.', ipa: '[ʒə nə paʁl pa ɑ̃ɡlɛ]', ko: '저는 영어를 못해요.' },
          ex2: { fr: 'Il ne travaille pas le dimanche.', ipa: '[il nə tʁavaj pa lə dimɑ̃ʃ]', ko: '그는 일요일에는 일하지 않아요.' },  // 필수 — 항목당 예문 2개
          note: '구어에서는 ne를 자주 생략한다 — « Je parle pas. » (familier)',  // 선택 — 한 줄 주의점
          ch: 'a1-05-negation',                    // 선택 — 이 문형을 다루는 챕터 slug
        },
      ],
    },
  ],
}
```

- 모든 항목 필수: pattern · conn · ko · ex · ex2 (각 fr+ipa+ko). note/ch는 선택.
- **pattern에 한국어 괄호 금지** — 뜻·용법 구별은 ko나 note에서. 동음 문형은 하나로 합쳐 ko에 ①② 병기.
- **pattern 구분자 규칙** — 병렬 형태는 `・`로 구분(렌더링 시 줄바꿈): `c'est … qui・c'est … que`. `/`는 한 형태 안의 낱말 교체에만(`du/de la/des`) — 줄바꿈되지 않는다.
- **같은 문형의 긍정/부정 분리 금지** — 하나로 묶고 ex=긍정, ex2=부정.
- **레지스터(문체) 교차 표기** — 뚜렷한 격식·문어(soutenu) 문형엔 note에 구어 대응을, 뚜렷한 구어(familier) 문형엔 격식 대응을: 「구어에서는 « on » 쪽이 자연스럽다」 / 「격식·문어에서는 « ne … point »」. 중립 문형엔 강요하지 않는다.
- 예문 ipa 필수 (어휘 발음 표기 100% 기준과 동일). 예문은 그 레벨까지의 어휘·문법으로 짧게.
- 테마는 기능별 그룹 8~16개. 목표 수: A1 80+ / A2 90+ / B1 100+ / B2 100+ / C1 80+ / C2 60+.

---

## 영어 학습자용 나란히 비교 — `enParallel` (문법 챕터 섹션 선택 필드)

영어를 배운 적 있는 학습자를 위해, **프랑스어 문법 구조가 영어와 평행할 때** 두 언어를 시각적으로 나란히 대조한다. 섹션 객체에 선택 필드로 추가:

```js
{
  heading: '...', pattern: '...', patternKo: '...', examples: [...],
  vsEn: '...(기존 평문 영어 비교 — 유지)',
  enParallel: {
    rows: [
      { en: 'I **am** Korean.',      fr: 'Je **suis** coréen.',      ko: '저는 한국인이에요.' },
      { en: 'She **is** a teacher.', fr: 'Elle **est** professeur.', ko: '그녀는 선생님이에요.' },
    ],
    note: '**주어 + be + 보어** 어순이 영어와 같아요. am/is/are 자리에 suis/est/sommes만 끼우면 끝.',
  },
}
```

### 작성 규칙
- **평행할 때만** 추가한다. 구조가 어긋나는 지점(부정 do-support, 형용사 위치, his/her, 목적대명사 어순 등)은 기존 `pitfall`/`vsEn` 평문으로 다루고 enParallel은 넣지 않는다.
- `rows`: 2~4쌍. 각 쌍은 **의미가 같은 영어 문장 + 프랑스어 문장**. 가능하면 그 섹션 `examples`의 프랑스어를 그대로 쓰고 영어를 붙인다.
- **`**굵게**`로 평행 부분 강조** — en·fr 양쪽에서 서로 대응되는 핵심 단어를 굵게(am↔suis, will↔-ai, have+p.p.↔avoir+p.p.).
- `ko`(선택): 짧은 한국어 뜻. `note`(선택): 한 줄 구조 요약 — "둘 다 [조동사+과거분사]" 식으로 공유 골격을 명시.
- en은 자연스러운 표준 영어, fr은 그 레벨까지의 어휘로. 거짓 평행(억지 대응) 금지.

### 평행이 강한 대표 지점
être=be / aller+inf=be going to / passé composé=present perfect(have+p.p.) / plus-que-parfait=past perfect(had+p.p.) / futur=will / conditionnel=would / 비교급 plus…que=more…than·-er than / 관계대명사 qui·que·dont·où=who·which/that·whose·where / 수동태 être+p.p.=be+p.p. / 간접화법 시제후퇴=reported speech backshift / si 가정문=if-conditionals / 강조 c'est…qui/que=cleft it's…that / 제롱디프 en+-ant=by/while+-ing / 명령법=imperative / ne…ni=neither…nor / litote pas mal=not bad.
