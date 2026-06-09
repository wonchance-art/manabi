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
