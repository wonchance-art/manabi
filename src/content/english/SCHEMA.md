# 영어 레퍼런스 콘텐츠 형식 (English Reference Schema)

프랑스어 레퍼런스(`src/content/french/SCHEMA.md`)와 **같은 구조·같은 품질 루브릭**.
레벨: A1 → A2 → B1 → B2 → C1 → C2. 대상: 한국어 모어 화자 (학교 영어 경험 가정 — '아는데 안 되는' 지점 공략).

차이점만 정리:

## 문법 챕터 (grammar/a1.js 등)

```js
{
  slug: 'a1-03-articles',
  level: 'A1',                 // 'A1'|'A2'|'B1'|'B2'|'C1'|'C2'
  order: 3,
  title: '관사 a/the — 한국어에 없는 필수품',
  titleFr: 'Articles: a / the',  // 필드명은 titleFr이지만 영어 원어 제목을 넣음 (렌더러 공유)
  summary: '...', duration: '약 8분',
  sections: [
    {
      heading: '...', body: '...',
      examples: [
        // ipa는 발음이 포인트일 때만 (발음·축약 챕터 등). 일반 문법 예문은 en+ko로 충분
        { en: 'I bought a book. The book was boring.', ko: '책을 한 권 샀어요. 그 책은 지루했어요.', note: '선택' },
      ],
      table: { caption, headers, rows },
      // 콜아웃 (각각 선택)
      pitfall: '한국인 고질 실수 — 콩글리시·시험영어 함정 포함',  // 🚨
      vsKo:    '한국어와 비교 — 구조 차이를 정면으로',           // 🇰🇷 (SOV vs SVO, 관사·복수 부재 등)
      etym:    '어원 연결 — 라틴·프랑스·그리스 뿌리, 이미 아는 외래어',  // 🌱
      tip:     '팁',                                        // 💡
    },
  ],
}
```

- 한국 학습자는 문법 지식은 있으나 **운용이 안 되는** 경우가 많음 — 규칙 나열보다 '왜 한국어 감각으로는 틀리는가'를 파고들 것.
- 단골 pitfall: 3인칭 -s, 관사 누락, 전치사, 현재완료 회피, 콩글리시(핸드폰/아이쇼핑), 수일치.
- `etym`은 어휘 확장 무기로: ex) spect(보다)→inspect/respect/expect.

## 어휘 (vocab/a1.js 등)

```js
export default {
  level: 'B1', title: 'B1 중급 어휘', desc: '...',
  themes: [
    { name: '의견과 토론', icon: '💬',
      words: [
        {
          en: 'achieve', ipa: '[əˈtʃiːv]', ko: '달성하다, 이루다', pos: 'v.',
          etym: '고대 프랑스어 achever(끝내다) — chief(우두머리)와 같은 뿌리',  // 선택 20~50%
          ex: { en: 'She achieved her goal.', ko: '그녀는 목표를 달성했다.' },   // 선택 ≥30%
        },
      ],
    },
  ],
}
```

- 모든 단어에 `ipa` 필수 (발음 표기 100% 기준 — 한국인 발음 교정 포인트).
- pos: n. / v. / adj. / adv. / prep. / phr.v. / expr.
- 콩글리시·faux friends는 `etym`을 경고로 활용 (예: "skinship은 영어에 없어요 — physical affection").

## 품질 루브릭
`src/content/french/SCHEMA.md`의 «품질 루브릭 (100점)» 표를 그대로 적용.

## 문형 사전 (bunkei/<level>.js) — CEFR 전수 커버 레이어

챕터가 '이해'라면 문형 사전은 '전수 검색'. 해당 레벨의 핵심 구문·표현을 빠짐없이 수록한다.
(일본어·프랑스어 문형 사전과 같은 구조 — 렌더러 공용)

```js
export default {
  level: 'A1',
  title: 'A1 문형 사전',
  desc: '한 줄 소개',
  themes: [
    {
      name: '존재·소유', icon: '📦',
      items: [
        {
          pattern: "there is・there are",          // 문형 (대표 표기)
          conn: "there is + 단수/불가산 / there are + 복수",  // 구조
          ko: "~이 있다 (존재)",                     // 한국어 대응 (간결)
          ex:  { en: "There is a cafe near the station.", ko: "역 근처에 카페가 있어요." },
          ex2: { en: "There are several reasons for this.", ko: "여기에는 몇 가지 이유가 있어요." },  // 필수 — 항목당 예문 2개
          note: "수 일치는 be 뒤 명사와: ❌ There is several issues → ✓ There **are** several issues.",  // 선택 — 한 줄 주의점
          ch: 'a2-08-there-is',                     // 선택 — 이 문형을 다루는 챕터 slug
        },
      ],
    },
  ],
}
```

- 모든 항목 필수: pattern · conn · ko · ex · ex2 (각 en+ko). note/ch는 선택.
- **예문에 발음기호(IPA) 쓰지 않음** — 발음은 TTS가 담당 (어휘 단어의 ipa와 구별).
- **pattern에 한국어 괄호 금지** — 뜻·용법 구별은 ko나 note에서. 동음 문형은 하나로 합쳐 ko에 ①② 병기.
- **pattern 구분자 규칙** — 병렬 형태는 `・`(렌더링 시 줄바꿈): `used to・would (과거 습관)` 금지 예 — 한국어 괄호이므로 ko로. `/`는 한 형태 안의 낱말 교체에만(`some/any`) — 줄바꿈되지 않는다.
- **같은 문형의 긍정/부정 분리 금지** — 하나로 묶고 ex=긍정, ex2=부정.
- **함정 note (❌→✓)** — 원천 데이터의 오류 대조를 살려 note에 한 줄로: "❌ discuss about it → ✓ **discuss** it (전치사 불필요)". **볼드**로 핵심 강조.
- **레지스터·영미 차이 교차 표기** — 격식 문형엔 구어 대응을, 구어 문형엔 격식 대응을: 「구어에서는 **have got**, 격식 글에서는 **have**」. 영미가 갈리면 명시: 「미국식은 bare subjunctive(*I insist that he go*), 영국식은 **should + 원형**」. 중립 문형엔 강요하지 않는다.
- 테마는 기능별 그룹 8~16개. 목표 수: A1 80+ / A2 90+ / B1 110+ / B2 110+ / C1 90+ / C2 60+.
- 예문은 그 레벨까지의 어휘로 짧게. 한국 문화 맥락 활용 환영.
