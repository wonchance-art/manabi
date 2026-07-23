# 프랑스어 연습 필드 전수 감사와 미배선 초안

**작성일**: 2026-07-24
**기준 커밋**: `865c5b139b6f825c2227af822a70e574109ff749`
**범위**: `src/content/french/grammar/*.js` 7팩,
`src/content/french/vocab/*.js` 15팩
**산출물**: `src/content/french/exercises_draft.js` (소비 미연결 DRAFT)

---

## 1. 결론

- 문법 7팩의 60챕터·224섹션과 어휘 15팩의 131테마·4,076단어를 전수 순회했다.
- `question`, `questions`, `exercise`, `exercises`, `quiz`, `choice`, `choices`,
  `answer`, `correctAnswer`, `prompt` 연습 필드는 **22팩 모두 0건**이다.
- 원본 프랑스어 콘텐츠, `src/content/french/index.js`, 런타임 소비자, DB는 수정하지 않았다.
- 별도 초안 모듈에 팩당 3문항씩 **총 66문항**을 작성했다. 전 문항 상태는
  `DRAFT_UNWIRED`이며 Claude 검수 전에는 학습 화면에 배선하지 않는다.

## 2. 감사 방법

공식 nvm Node 22에서 각 모듈의 default export를 import한 뒤 객체 전체를 재귀
순회했다. 문법은 챕터·섹션 수, 어휘는 테마·단어 수를 실측했고 연습 필드 후보 키를
대소문자 무시 exact-match로 검사했다.

```text
/^(questions?|exercises?|quiz|choices?|answer|correctAnswer|prompt)$/i
```

어휘 export는 두 형태를 모두 처리했다.

- 본편 7팩: `{ level, title, desc, themes }`
- FLELex 보강 8팩: `themes[]`

문항 초안은 원본 팩에서 실제로 확인한 문법 공식·표제어만 사용한다. 자동 소비 계약을
추측하지 않기 위해 별도 스키마 버전과 `DRAFT_UNWIRED` 상태만 부여했고, 레지스트리
import나 런타임 변환기는 추가하지 않았다.

## 3. 문법 7팩

| 소스팩 | 챕터 | 섹션 | 기존 연습 필드 | DRAFT 문항 | SHA-256 |
|---|---:|---:|---:|---:|---|
| `grammar/a0.js` | 5 | 16 | 0 | 3 | `2725beec31ffa91de2cd166207ae57aa3d096f02fc0d8adb03f8d477f3ca26f8` |
| `grammar/a1.js` | 13 | 45 | 0 | 3 | `d3ea5904c9915a1566cf92034b8865bd4d3b0fc709cd44e906f0e1d6ae02619d` |
| `grammar/a2.js` | 12 | 42 | 0 | 3 | `870bc97aad462731b743bf7274ba8050cdd8d9fa54628e5daf9883acde8165a6` |
| `grammar/b1.js` | 9 | 35 | 0 | 3 | `21dbc03e4a34658acad8638b39049d4f7c634904f2edbfa369f401ad55918428` |
| `grammar/b2.js` | 10 | 42 | 0 | 3 | `d08b43af970ad7062a34f932c44a4719bb7b0ccb6bcaf9c29a28e9649cc42aa5` |
| `grammar/c1.js` | 6 | 24 | 0 | 3 | `4b592dac5d2145e07f787ff372e79e1668ccceb6b3262bae4466873610e8d86a` |
| `grammar/c2.js` | 5 | 20 | 0 | 3 | `a606aa463e6a307d08a27ef295ec645530f34ce0ecf3c7ccf9902350172b807c` |
| **합계** | **60** | **224** | **0** | **21** | — |

## 4. 어휘 15팩

| 소스팩 | 테마 | 단어 | 기존 연습 필드 | DRAFT 문항 | SHA-256 |
|---|---:|---:|---:|---:|---|
| `vocab/a0.js` | 10 | 100 | 0 | 3 | `2beba741485276c64fe66cc9f32fc6dab27e9768fda410a8535fbe05002cf8f7` |
| `vocab/a1.js` | 11 | 156 | 0 | 3 | `c8172f17a84e3cf772f35a938851dbf6752d479e6f1d532365d786702f4e06db` |
| `vocab/a1_flelex.js` | 7 | 221 | 0 | 3 | `78be6f9d7379d2b3ebcc22d2fc59547c316caa35e7df1d5f4a6703ddbb7ed75f` |
| `vocab/a2.js` | 11 | 181 | 0 | 3 | `e17162c8d9f5aa38daaf9f14f8065e7c07885c5696bfe690dcdcf773b4d609c5` |
| `vocab/a2_flelex.js` | 7 | 453 | 0 | 3 | `7f59ffedfc062c52fb36da4e3044ac70f505c4c4a778a1b2ae8e809d89889a87` |
| `vocab/b1.js` | 10 | 166 | 0 | 3 | `c6a718469a4fade532cf20d24f4a466a4dea9356f5ed1a70dd514625be3d7cdf` |
| `vocab/b1_flelex.js` | 9 | 676 | 0 | 3 | `3168290eb18f440d6de259537ddb6ca68f8a71d72c6d1683c67e38980738aaef` |
| `vocab/b1_flelex2.js` | 7 | 27 | 0 | 3 | `9d39e188c48f34c107e0fdf03405ba47c39c7f56674035b279bf717bc0a01943` |
| `vocab/b2.js` | 12 | 217 | 0 | 3 | `fae1742e0a4a85d0ffef929522a1530f9e54e8ca5352187f6fc131c4eaa98839` |
| `vocab/b2_flelex.js` | 9 | 828 | 0 | 3 | `7c857a95e811fa47ed0ada9402f4609659b91c8589cda14961a134401a2b98dd` |
| `vocab/b2_flelex2.js` | 9 | 84 | 0 | 3 | `8d2713261471b155ce150dec1124957dc56b5835a97e4b2f59f59ed5d4953ace` |
| `vocab/c1.js` | 9 | 140 | 0 | 3 | `5e32b798baa2f3e4c457b3efbe91ff903d78be88578e756b56595bc12dddd866` |
| `vocab/c1_flelex.js` | 7 | 493 | 0 | 3 | `bba39207e12a8c795b04c27e27420331b77100bd716edcb423a497e77d3df55e` |
| `vocab/c2.js` | 8 | 95 | 0 | 3 | `62dbdcca38620f613b196cb13dc47f8d07b4b40b6e0fed67472f47c42cc4395d` |
| `vocab/c2_flelex.js` | 5 | 239 | 0 | 3 | `82fdb5f953338daf68dfe56868a0e7bb31da31fb35edd70b0415ed7ac8043fec` |
| **합계** | **131** | **4,076** | **0** | **45** | — |

## 5. 초안 계약

`exercises_draft.js`는 다음 최소 구조만 고정한다.

```js
{
  sourcePath, // 감사한 원본 팩 exact 경로
  kind,       // "grammar" | "vocab"
  level,      // A0~C2
  status,     // "DRAFT_UNWIRED"
  questions: [
    { id, type: "short-answer", sourceRef, promptKo, answer },
  ],
}
```

- 소스팩 22개가 각각 정확히 한 번 등장한다.
- 각 팩은 SPEC 하한인 3문항을 가진다.
- 문항 ID는 전역 유일하고 정답은 빈 문자열이 아니다.
- 문법 문항은 해당 팩의 실제 `slug`, 어휘 문항은 실제 테마·표제어를 `sourceRef`로
  기록한다.
- 정답의 관사·성 표기 허용 범위, 악상 기호 정규화, 복수 정답, 자동 채점 방식은
  **Claude 검수 후 확정**한다.

## 6. 배선 전 필수 검수

1. 66문항의 난이도·표현·정답 허용 범위를 콘텐츠 오너가 검수한다.
2. 단답형만 유지할지 객관식·순서 배열·빈칸형으로 재배분할지 결정한다.
3. 정답 정규화 계약(대소문자, 악상 기호, 관사·성 괄호, 구두점)을 확정한다.
4. 확정 스키마와 소비 화면의 접근성·오답 피드백 계약을 별도 SPEC으로 발주한다.
5. 그 전까지 `src/content/french/index.js` 및 런타임에서 이 모듈을 import하지 않는다.
