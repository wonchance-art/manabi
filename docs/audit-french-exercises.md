# 프랑스어 연습문제 필드 전수 감사와 보강 초안

작성일: 2026-07-24

측정 기준: `origin/main` `865c5b139b6f825c2227af822a70e574109ff749`

범위: `src/content/french/grammar/*.js` 7개, `src/content/french/vocab/*.js` 15개

산출 초안: `src/content/french/exercises_draft.js` (소비 미연결)

## 결론

- 프랑스어 원본 22개 소스팩에는 명시적인 `exercise`, `quiz`, `questions`, `practice`,
  `drill`, `fill`, `cloze` 필드가 **하나도 없다**.
- 다만 “연습 경험이 전혀 없다”는 뜻은 아니다. 정규 문법 A1~C2는
  `sections[].pattern`과 `examples[]`를 `buildChapterQuiz()`가 읽어 챕터마다
  **4~11문항**을 자동 생성한다. 전체 55개 정규 챕터에서 실제 렌더되는 자동 문항은
  556개다.
- A0의 5개 내부 챕터도 28문항을 생성할 재료는 있지만, `ReferenceChapterPage`가
  입문 레벨 패턴 체크를 의도적으로 생략해 실제 렌더 문항은 0개다.
- 어휘는 고정 문항 필드 없이 SRS 숙련도에 따라 `vocab-choice` → `vocab-cloze` →
  `vocab-typing` → `vocab-listening`을 동적으로 만든다. 원시 어휘 4,076개 중
  예문 필드가 있는 것은 3,937개지만, 현재 exact 문자열 조건으로 곧바로 빈칸을 만들 수
  있는 것은 959개(23.53%)뿐이다. 나머지는 타이핑으로 폴백한다.
- 발주의 “문법 7챕터”는 실제 객체 수가 아니라 **CEFR 레벨 소스팩 7개**다.
  내부에는 문법 챕터 객체가 총 60개 있다. 이번 초안은 발주 수량을 따라
  7개 레벨팩 + 15개 어휘 소스팩을 단위로 팩당 3문항, 총 66문항을 제안했다.
- 초안은 기존 소비 형식을 복제했지만 어떤 레지스트리나 화면에도 연결하지 않았다.
  Claude가 문항 정확성·난이도·팩 단위와 실제 챕터 단위의 분할 정책을 검수한 뒤 확정해야 한다.

## 조사 기준

재귀 탐색 대상 필드는 다음과 같이 고정했다.

`exercise`, `exercises`, `quiz`, `quizzes`, `question`, `questions`, `practice`,
`practices`, `drill`, `drills`, `fill`, `fills`, `cloze`, `clozes`

어휘의 `ex`는 예문(example) 필드이므로 연습문제 필드로 세지 않았다.

문법 자동 문항 수는 현재 `buildChapterQuiz()` 기본 상한을 그대로 사용했다.

- `meaning`: 최대 4개 — 예문의 패턴 자리를 가리는 빈칸 선다
- `apply`: 최대 4개 — 예문 어순 배열
- `produce`: 최대 3개 — 한국어를 보고 말한 뒤 자가 채점

UI 실렌더 수는 A0 입문 우회 규칙까지 반영했다. 어휘 빈칸 가능 수는
`studySession.js`의 현재 조건과 같이 예문 원문에 `word_text` 또는 발음 문자열이
exact 포함되는지를 검사했다.

## 7개 문법 레벨팩 요약

| 소스팩 | 내부 챕터 | 패턴 섹션 | 예문 | 명시적 연습 필드 | 자동 생성 M/A/P | UI 실렌더 |
|---|---:|---:|---:|---:|---:|---:|
| `grammar/a0.js` | 5 | 16 | 49 | 0 | 8 / 5 / 15 = 28 | 0 |
| `grammar/a1.js` | 13 | 44 | 136 | 0 | 46 / 43 / 39 = 128 | 128 |
| `grammar/a2.js` | 12 | 42 | 128 | 0 | 40 / 45 / 36 = 121 | 121 |
| `grammar/b1.js` | 9 | 35 | 97 | 0 | 34 / 36 / 27 = 97 | 97 |
| `grammar/b2.js` | 10 | 41 | 126 | 0 | 36 / 39 / 30 = 105 | 105 |
| `grammar/c1.js` | 6 | 24 | 62 | 0 | 13 / 22 / 18 = 53 | 53 |
| `grammar/c2.js` | 5 | 18 | 51 | 0 | 19 / 18 / 15 = 52 | 52 |
| **합계** | **60** | **220** | **649** | **0** | **196 / 208 / 180 = 584** | **556** |

`M/A/P`는 각각 `meaning` / `apply` / `produce`다.

## 실제 문법 챕터별 연습 수

모든 행의 명시적 저작 문항은 0개다. 아래 자동 수는 `meaning / apply / produce = 합계`,
실렌더는 현재 챕터 화면에 실제로 나타나는 수다.

| 실제 챕터 slug | 레벨 | 자동 M/A/P | UI 실렌더 |
|---|---:|---:|---:|
| `a0-02-alphabet` | A0 | 0 / 0 / 3 = 3 | 0 |
| `a0-03-vowels` | A0 | 1 / 0 / 3 = 4 | 0 |
| `a0-04-consonants` | A0 | 2 / 0 / 3 = 5 | 0 |
| `a0-05-liaison` | A0 | 3 / 1 / 3 = 7 | 0 |
| `a0-06-word-order` | A0 | 2 / 4 / 3 = 9 | 0 |
| `a1-01-pronouns-etre` | A1 | 4 / 4 / 3 = 11 | 11 |
| `a1-02-avoir` | A1 | 4 / 4 / 3 = 11 | 11 |
| `a1-03-er-verbs` | A1 | 1 / 4 / 3 = 8 | 8 |
| `a1-04-negation` | A1 | 4 / 4 / 3 = 11 | 11 |
| `a1-05-questions` | A1 | 4 / 4 / 3 = 11 | 11 |
| `a0-06-gender` | A1 | 1 / 0 / 3 = 4 | 4 |
| `a0-07-articles` | A1 | 4 / 1 / 3 = 8 | 8 |
| `a1-06-adjectives` | A1 | 4 / 4 / 3 = 11 | 11 |
| `a1-07-possessives` | A1 | 4 / 2 / 3 = 9 | 9 |
| `a1-08-aller-venir` | A1 | 4 / 4 / 3 = 11 | 11 |
| `a1-09-partitive` | A1 | 4 / 4 / 3 = 11 | 11 |
| `a1-10-numbers-time` | A1 | 4 / 4 / 3 = 11 | 11 |
| `a0-08-survival` | A1 | 4 / 4 / 3 = 11 | 11 |
| `a2-01-passe-compose-avoir` | A2 | 3 / 4 / 3 = 10 | 10 |
| `a2-02-passe-compose-etre` | A2 | 1 / 4 / 3 = 8 | 8 |
| `a2-03-imparfait` | A2 | 1 / 4 / 3 = 8 | 8 |
| `a2-04-pronominal-verbs` | A2 | 4 / 4 / 3 = 11 | 11 |
| `a2-05-object-pronouns` | A2 | 4 / 3 / 3 = 10 | 10 |
| `a2-06-comparative` | A2 | 4 / 4 / 3 = 11 | 11 |
| `a2-07-futur-simple` | A2 | 3 / 4 / 3 = 10 | 10 |
| `a2-08-imperatif` | A2 | 4 / 3 / 3 = 10 | 10 |
| `a2-09-y-en` | A2 | 4 / 3 / 3 = 10 | 10 |
| `a2-10-relative-qui-que` | A2 | 4 / 4 / 3 = 11 | 11 |
| `a2-11-time-expressions` | A2 | 4 / 4 / 3 = 11 | 11 |
| `a2-12-quantity-tout` | A2 | 4 / 4 / 3 = 11 | 11 |
| `b1-01-conditionnel-present` | B1 | 4 / 4 / 3 = 11 | 11 |
| `b1-02-subjonctif-intro` | B1 | 4 / 4 / 3 = 11 | 11 |
| `b1-03-plus-que-parfait` | B1 | 2 / 4 / 3 = 9 | 9 |
| `b1-04-relative-advanced` | B1 | 4 / 4 / 3 = 11 | 11 |
| `b1-05-gerondif` | B1 | 4 / 4 / 3 = 11 | 11 |
| `b1-06-passive` | B1 | 4 / 4 / 3 = 11 | 11 |
| `b1-07-discours-indirect` | B1 | 4 / 4 / 3 = 11 | 11 |
| `b1-08-pronouns-advanced` | B1 | 4 / 4 / 3 = 11 | 11 |
| `b1-09-connectors-purpose-time` | B1 | 4 / 4 / 3 = 11 | 11 |
| `b2-01-subjonctif-advanced` | B2 | 4 / 4 / 3 = 11 | 11 |
| `b2-02-hypothese-si` | B2 | 3 / 4 / 3 = 10 | 10 |
| `b2-03-participe-present` | B2 | 4 / 3 / 3 = 10 | 10 |
| `b2-04-connecteurs` | B2 | 4 / 4 / 3 = 11 | 11 |
| `b2-05-verb-prepositions` | B2 | 2 / 4 / 3 = 9 | 9 |
| `b2-06-mise-en-relief` | B2 | 4 / 4 / 3 = 11 | 11 |
| `b2-07-nominalisation` | B2 | 3 / 4 / 3 = 10 | 10 |
| `b2-08-cause-consequence` | B2 | 4 / 4 / 3 = 11 | 11 |
| `b2-09-negation-advanced` | B2 | 4 / 4 / 3 = 11 | 11 |
| `b2-10-impersonal-formal` | B2 | 4 / 4 / 3 = 11 | 11 |
| `c1-01-passe-simple` | C1 | 1 / 3 / 3 = 7 | 7 |
| `c1-02-registres` | C1 | 0 / 4 / 3 = 7 | 7 |
| `c1-03-argumentation` | C1 | 1 / 3 / 3 = 7 | 7 |
| `c1-04-participiales` | C1 | 4 / 4 / 3 = 11 | 11 |
| `c1-05-nuances` | C1 | 3 / 4 / 3 = 10 | 10 |
| `c1-06-idiomatiques` | C1 | 4 / 4 / 3 = 11 | 11 |
| `c2-01-subjonctif-litteraire` | C2 | 4 / 3 / 3 = 10 | 10 |
| `c2-02-style` | C2 | 4 / 4 / 3 = 11 | 11 |
| `c2-03-francophonie` | C2 | 4 / 4 / 3 = 11 | 11 |
| `c2-04-culture-implicite` | C2 | 4 / 3 / 3 = 10 | 10 |
| `c2-05-traduction` | C2 | 3 / 4 / 3 = 10 | 10 |

## 15개 어휘 소스팩 전수 표

`pack`은 `{ level, title, themes }` 객체, `theme[]`는 FLELex 보강 배열이다.
단어 수는 레지스트리 병합·중복 제거 전 원시 소스 기준이다.

| 소스팩 | 형태 | 테마 | 단어 | `ex` 있음 | exact 빈칸 가능 | 명시적 연습 필드 |
|---|---|---:|---:|---:|---:|---:|
| `vocab/a0.js` | pack | 10 | 100 | 78 | 25 | 0 |
| `vocab/a1.js` | pack | 11 | 156 | 128 | 37 | 0 |
| `vocab/a1_flelex.js` | theme[] | 7 | 221 | 221 | 43 | 0 |
| `vocab/a2.js` | pack | 11 | 181 | 147 | 42 | 0 |
| `vocab/a2_flelex.js` | theme[] | 7 | 453 | 453 | 97 | 0 |
| `vocab/b1.js` | pack | 10 | 166 | 149 | 29 | 0 |
| `vocab/b1_flelex.js` | theme[] | 9 | 676 | 676 | 145 | 0 |
| `vocab/b1_flelex2.js` | theme[] | 7 | 27 | 27 | 7 | 0 |
| `vocab/b2.js` | pack | 12 | 217 | 198 | 71 | 0 |
| `vocab/b2_flelex.js` | theme[] | 9 | 828 | 828 | 199 | 0 |
| `vocab/b2_flelex2.js` | theme[] | 9 | 84 | 84 | 18 | 0 |
| `vocab/c1.js` | pack | 9 | 140 | 131 | 35 | 0 |
| `vocab/c1_flelex.js` | theme[] | 7 | 493 | 493 | 127 | 0 |
| `vocab/c2.js` | pack | 8 | 95 | 85 | 31 | 0 |
| `vocab/c2_flelex.js` | theme[] | 5 | 239 | 239 | 53 | 0 |
| **합계** |  | **131** | **4,076** | **3,937** | **959** | **0** |

예문 보유율은 96.59%지만 exact 빈칸 가능률은 23.53%다. 표제어에 관사가 붙고
예문에서는 소유사·부정관사·활용형으로 바뀌는 경우가 많기 때문이다. 예를 들어 표제어
`la famille`와 예문 `Ma famille habite à Séoul.`은 교육적으로는 올바르지만 현재
`clozeExampleUsable()`의 exact 포함 조건에는 맞지 않는다.

## 현재 형식

### 문법

프랑스어 콘텐츠가 직접 가진 연습 재료는 다음뿐이다.

```js
{
  pattern: "ne + 동사 + pas",
  distractors: ["plus", "jamais"], // 선택
  examples: [{ fr: "Je ne parle pas chinois.", ipa: "...", ko: "..." }],
}
```

런타임이 이를 아래 패턴 체크 payload로 바꾼다.

```js
{
  meaning: [{ sentence, full, ko, correct, distractors, pron }],
  apply: [{ type: "order", tokens, answer, ko, pron }],
  produce: [{ ko, main, pron }],
}
```

### 어휘

프랑스어 어휘 원본은 `themes[].words[]`의 `{ fr, ipa, ko, ex? }`만 가진다.
실제 학습 세션은 아래 채점 문항을 동적으로 만든다.

```js
{ type: "vocab-choice", word, options, sentence: null }
{ type: "vocab-cloze", word, options: null, sentence: { main, pron } }
{ type: "vocab-typing", word, options: null, sentence: null }
{ type: "vocab-listening", word, options: null, sentence: null }
```

`uid`와 `effect`는 콘텐츠가 아니라 세션 조립 시 붙는 런타임 메타다.

## 보강 초안 범위

명시적 저작 문항 수를 임계치로 잡으면 22개 소스팩 모두 0개라 “2개 미만”이다.
따라서 `exercises_draft.js`에 다음 66문항을 제안했다.

| 구분 | 대상 팩 | 팩당 문항 | 유형 | 합계 |
|---|---:|---:|---|---:|
| 문법 | 7 | 3 | meaning 1 + order 1 + produce 1 | 21 |
| 어휘 | 15 | 3 | choice 1 + cloze 1 + typing 1 | 45 |
| **전체** | **22** |  |  | **66** |

모든 팩 앞에 `DRAFT` 주석을 두었다. 어휘 cloze 초안은 현재 런타임 조건에서도
유효하도록 `sentence.main`에 `word.word_text`를 exact 포함한다.

## Claude 검수 필요 항목

1. 발주의 7개 문법 단위를 그대로 CEFR 레벨팩으로 유지할지, 내부 60개 챕터 단위로
   다시 쪼갤지 확정해야 한다.
2. A0에 패턴 체크를 실제로 열지는 별도 UX 결정이다. 이번 변경은 렌더 정책을 건드리지 않는다.
3. 문법 자동 생성 556문항과 저작 초안 21문항의 중복을 제거하고, 자동 생성이 약한
   `c1-02-registres` 같은 챕터에 저작 문항을 우선 배치하는 편이 안전하다.
4. 어휘 빈칸의 관사·활용형 매칭을 완화할지, 현 exact 계약을 유지한 채 문장만 보강할지
   결정해야 한다. 이번 초안은 런타임 로직을 수정하지 않는다.
5. IPA와 한국어 뜻·프랑스어 문장의 자연스러움은 콘텐츠 검수 후에만 확정한다.
